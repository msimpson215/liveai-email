import assert from 'node:assert/strict'
import fs from 'fs'
import os from 'os'
import path from 'path'

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aar-monitor-'))
process.env.AAR_MONITOR_DIR = tmp
process.env.APIFY_TOKEN = 'test-token'
process.env.AAR_MONITOR_POLL_MS = '1'
process.env.GMAIL_USER = ''
process.env.GMAIL_APP_PASSWORD = ''

const mon = await import('../server/aar-monitor.js')

// Fake Apify: records every request, returns canned results per keyword.
const calls = []
const kv = {}
const resultsFor = {
  'AAR Auto Sales': [
    { id: '61573016283471', name: 'Aar autosales', url: 'https://www.facebook.com/people/Aar-autosales/61573016283471/' },
    { id: '100065300507766', name: 'Aardvark Auto Sales', url: 'https://www.facebook.com/people/Aardvark-Auto-Sales/100065300507766/' },
    { id: '100063653966154', name: 'AAR', url: 'https://www.facebook.com/hancers.shop' }
  ]
}
let runSeq = 0
const runs = {}
mon.setFetch(async (url, opts = {}) => {
  const method = opts.method || 'GET'
  calls.push({ url, method, body: opts.body ? JSON.parse(opts.body) : null })
  const json = (body, status = 200) => ({ ok: status < 300, status, json: async () => body })
  if (url.includes('/key-value-stores?name=')) return json({ data: { id: 'kv1' } })
  if (url.includes('/key-value-stores/kv1/records/state')) {
    if (method === 'PUT') { kv.state = opts.body; return json({}) }
    return kv.state ? json(JSON.parse(kv.state)) : json({ error: 'not found' }, 404)
  }
  const start = url.match(/\/acts\/([^/]+)\/runs\?maxTotalChargeUsd=([\d.]+)/)
  if (start && method === 'POST') {
    const input = JSON.parse(opts.body)
    const id = `run${++runSeq}`
    const items = (resultsFor[input.categories[0]] || []).slice(0, input.resultsLimit)
    runs[id] = { id, status: 'SUCCEEDED', defaultDatasetId: `ds-${id}`, usageTotalUsd: Number((0.001 + 0.005 * items.length).toFixed(3)), items }
    return json({ data: { id, status: 'RUNNING' } }, 201)
  }
  const run = url.match(/\/actor-runs\/(run\d+)/)
  if (run) return json({ data: runs[run[1]] })
  const ds = url.match(/\/datasets\/ds-(run\d+)\/items/)
  if (ds) return json(runs[ds[1]].items)
  throw new Error('unexpected fetch ' + url)
})
const mail = []
mon.setMailer(async (m) => { mail.push(m); return { sent: true } })

try {
  assert.equal(mon.ACTOR, 'apify/facebook-search-scraper')
  assert.equal(mon.ACTOR_ID, 'Us34x9p7VgjCz99H6')
  assert.deepEqual(mon.SUCCESS_INPUT, { categories: ['AAR Auto Sales', '502 E Ripley St, Byars, OK 74831'], resultsLimit: 5, searchType: 'pages', locations: [] })

  const fresh = mon.readState()
  assert.deepEqual(fresh.settings.searchTerms, ['AAR Auto', 'AAR Auto Sales', 'AAR Auto Sales LLC', 'A-R Auto', 'A-R Auto Sales', '502 E Ripley St, Byars, OK 74831'])
  assert.equal(fresh.settings.maxResults, 20)
  assert.equal(fresh.settings.dailyCapUsd, 1)

  // Same request shape as the working manual run, one keyword per run.
  assert.deepEqual(mon.searchInput('AAR Auto Sales', fresh.settings), { categories: ['AAR Auto Sales'], resultsLimit: 20, searchType: 'pages', locations: [] })
  assert.equal(JSON.stringify(mon.searchInput('x', fresh.settings)).toLowerCase().includes('marketplace'), false)

  assert.equal(mon.matchesSearchTerm('Aar autosales', 'AAR Auto Sales'), true)
  assert.equal(mon.matchesSearchTerm('AAR AUTO SALES, LLC', 'AAR Auto Sales LLC'), true)
  assert.equal(mon.matchesSearchTerm('AUTO SALES A-R', 'A-R Auto Sales'), true)
  assert.equal(mon.matchesSearchTerm('Aardvark Auto Sales', 'AAR Auto'), false)
  assert.equal(mon.matchesSearchTerm('AAR', 'AAR Auto'), false)
  assert.equal(mon.matchesSearchTerm('Anything', '502 E Ripley St, Byars, OK 74831'), false)

  // Spending: a $1 day with $0.95 spent cannot start a 20-result search.
  const cap = mon.runCapUsd(20)
  assert.ok(cap > 0.1 && cap < 0.2)
  const tight = { settings: { dailyCapUsd: 1, maxResults: 20 }, spend: [{ at: new Date().toISOString(), usd: 0.95 }] }
  assert.ok(mon.budget(tight).leftTodayUsd < cap)
  const pending = { settings: { dailyCapUsd: 1, maxResults: 20 }, spend: [{ at: new Date().toISOString(), usd: 0.001, capUsd: 0.125, settled: false }] }
  assert.equal(mon.spentToday(pending), 0.125, 'an untotaled run counts at its full cap')

  // Single controlled keyword through the one search function.
  const one = await mon.runConfiguredSearch({ source: 'test', only: ['AAR Auto Sales'] })
  assert.equal(one.ok, true)
  const starts = calls.filter((c) => c.method === 'POST' && c.url.includes('/runs?'))
  assert.equal(starts.length, 1)
  assert.match(starts[0].url, /acts\/Us34x9p7VgjCz99H6\/runs\?maxTotalChargeUsd=0\.125$/)
  assert.deepEqual(starts[0].body, { categories: ['AAR Auto Sales'], resultsLimit: 20, searchType: 'pages', locations: [] })
  assert.equal(one.scan.terms.length, 1)
  assert.equal(one.scan.terms[0].results.length, 3, 'every result is kept and shown')
  const byName = Object.fromEntries(one.scan.terms[0].results.map((r) => [r.name, r]))
  assert.equal(byName['Aar autosales'].status, 'potential_impersonator')
  assert.match(byName['Aar autosales'].reason, /review only/)
  assert.equal(byName['Aardvark Auto Sales'].status, 'not_flagged')
  assert.equal(byName['AAR'].status, 'not_flagged')
  assert.equal(one.scan.terms[0].costUsd, 0.016)
  assert.equal(one.discovered.length, 1)
  assert.equal(mail.length, 1)
  assert.deepEqual(mail[0].to, ['aaraitmember@gmail.com'])
  assert.match(mail[0].text, /61573016283471/)
  assert.match(mail[0].text, /not confirmed scams/)
  const saved = mon.readState()
  assert.equal(saved.scans[0].terms[0].items.length, 3, 'raw Apify items stored before filtering')
  assert.equal(mon.spentToday(saved), 0.016)
  assert.ok(kv.state && JSON.parse(kv.state).spend.length === 1, 'spend persisted to Apify storage')

  // Same results again: nothing new, no second email.
  const again = await mon.runConfiguredSearch({ source: 'test', only: ['AAR Auto Sales'] })
  assert.equal(again.discovered.length, 0)
  assert.equal(mail.length, 1)

  // Full list, each keyword its own run, exactly as saved.
  calls.length = 0
  const all = await mon.runConfiguredSearch({ source: 'test' })
  const allStarts = calls.filter((c) => c.method === 'POST' && c.url.includes('/runs?'))
  assert.deepEqual(allStarts.map((c) => c.body.categories), fresh.settings.searchTerms.map((t) => [t]))
  assert.equal(all.scan.terms.length, 6)

  // Budget stop before a search it cannot cover.
  await mon.saveSettings({ dailyCapUsd: 0.15 }, 'marty')
  calls.length = 0
  const stopped = await mon.runConfiguredSearch({ source: 'test' })
  assert.match(stopped.scan.stoppedReason, /Stopped before “AAR Auto”/)
  assert.equal(calls.filter((c) => c.method === 'POST' && c.url.includes('/runs?')).length, 0, 'no search started')
  assert.ok(mon.spentToday(mon.readState()) <= 0.15)
  await mon.saveSettings({ dailyCapUsd: 5 }, 'marty')
  assert.equal(mon.readState().settings.dailyCapUsd, 1, 'limit cannot go above $1')

  // Keywords are saved exactly as typed.
  await mon.saveSettings({ searchTerms: ['AAR Auto', '  A-R Auto Sales  ', 'AAR Auto'] }, 'marty')
  assert.deepEqual(mon.readState().settings.searchTerms, ['AAR Auto', 'A-R Auto Sales'])
  assert.equal((await mon.saveSettings({ monitoringEnabled: false }, 'randy')).error, 'Only Marty can change watch settings.')

  // Voice tool takes no keywords.
  const tool = mon.MONITOR_TOOLS.find((t) => t.name === 'search_facebook')
  assert.deepEqual(tool.parameters.properties, {})

  // Daily schedule: once per Central day inside the morning window.
  const st = mon.readState()
  st.settings.monitoringEnabled = true
  st.settings.dailyScanTime = '07:00'
  st.scans = []
  const at7 = new Date('2026-11-27T13:05:00Z')
  const at6 = new Date('2026-11-27T12:30:00Z')
  assert.equal(mon.dailyDue(st, at7), true)
  assert.equal(mon.dailyDue(st, at6), false)
  st.scans = [{ source: 'schedule', at: '2026-11-27T13:01:00Z', terms: [] }]
  assert.equal(mon.dailyDue(st, at7), false)
  st.settings.monitoringEnabled = false
  st.scans = []
  assert.equal(mon.dailyDue(st, at7), false)

  assert.ok(mon.briefing().includes('Never call a same-name page a scam'))
  console.log('aar-monitor tests ok')
} finally {
  mon.stopScheduler()
  fs.rmSync(tmp, { recursive: true, force: true })
}
