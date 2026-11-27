/**
 * AAR Facebook keyword search. Apify is the search engine: fixed keywords go in,
 * Facebook Pages results come out. One actor only: apify/facebook-search-scraper.
 * Voice, desk, and the 7 AM schedule all call runConfiguredSearch().
 * Keywords come only from Marty's saved list. Nothing here rewrites them.
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import nodemailer from 'nodemailer'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = process.env.AAR_MONITOR_DIR || path.join(__dirname, '..', 'data', 'aar-monitor')
const STATE_FILE = path.join(ROOT, 'state.json')
const KV_STORE_NAME = 'aar-monitor-state'
const KV_KEY = 'state'

export const ACTOR = 'apify/facebook-search-scraper'
export const ACTOR_ID = 'Us34x9p7VgjCz99H6'
export const SUCCESS_RUN_ID = '3yD1r2Q62QPBoyV3E'
export const SUCCESS_INPUT = {
  categories: ['AAR Auto Sales', '502 E Ripley St, Byars, OK 74831'],
  resultsLimit: 5,
  searchType: 'pages',
  locations: []
}

export const DEFAULT_TERMS = [
  'AAR Auto',
  'AAR Auto Sales',
  'AAR Auto Sales LLC',
  'A-R Auto',
  'A-R Auto Sales',
  '502 E Ripley St, Byars, OK 74831'
]

export const MAX_RESULTS = 20
export const DAILY_CAP_USD = 1
// Apify prices for this actor. Used only to size each run's hard charge limit.
export const PRICE = { startUsd: 0.005, resultUsd: 0.006, actorFloorUsd: 0.024, diamondStartUsd: 0.0005, diamondResultUsd: 0.002 }

const SKIP_NAMES = /(^|\s)(aaron|aarons|aardvark)(\s|$)/
const FLAG_STATUSES = new Set(['potential_impersonator', 'likely_clone', 'confirmed_fraud'])
const MAX_SCANS_KEPT = 30

let fetchImpl = (...args) => fetch(...args)
let mailerOverride = null
let scanLock = false
let tickTimer = null
let readyPromise = null
let pushChain = Promise.resolve()

export function setFetch(fn) { fetchImpl = fn }
export function setMailer(fn) { mailerOverride = fn }

export function isFlagged(page) {
  return FLAG_STATUSES.has(page && page.status)
}

function emptyState() {
  return {
    updatedAt: null,
    settings: {
      searchTerms: DEFAULT_TERMS.slice(),
      maxResults: MAX_RESULTS,
      dailyScanTime: '07:00',
      timezone: 'America/Chicago',
      monitoringEnabled: true,
      emailRecipients: ['aaraitmember@gmail.com'],
      publicUrl: '',
      dailyCapUsd: DAILY_CAP_USD
    },
    pages: {},
    scans: [],
    spend: [],
    lastAlert: null,
    lastEmail: null
  }
}

function ensureDir() {
  if (!fs.existsSync(ROOT)) fs.mkdirSync(ROOT, { recursive: true })
}

function normalizeState(raw) {
  const base = emptyState()
  const settings = { ...base.settings, ...((raw && raw.settings) || {}) }
  delete settings.paidSearchAuthorized
  delete settings.caps
  delete settings.searchType
  settings.dailyCapUsd = Math.min(DAILY_CAP_USD, Math.max(0, Number(settings.dailyCapUsd) || DAILY_CAP_USD))
  settings.maxResults = Math.max(1, Math.min(MAX_RESULTS, Number(settings.maxResults) || MAX_RESULTS))
  return {
    ...base,
    ...(raw || {}),
    settings,
    pages: (raw && raw.pages) || {},
    scans: Array.isArray(raw && raw.scans) ? raw.scans.filter((s) => Array.isArray(s.terms)) : [],
    spend: Array.isArray(raw && raw.spend) ? raw.spend : []
  }
}

export function readState() {
  ensureDir()
  if (!fs.existsSync(STATE_FILE)) return emptyState()
  try {
    return normalizeState(JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')))
  } catch {
    return emptyState()
  }
}

function writeState(state) {
  ensureDir()
  state.updatedAt = new Date().toISOString()
  const body = JSON.stringify(state, null, 2)
  fs.writeFileSync(STATE_FILE, body, 'utf8')
  pushChain = pushChain.then(() => pushRemote(body)).catch(() => {})
}

export function flush() {
  return pushChain
}

function apifyToken() {
  const env = process.env.APIFY_TOKEN || process.env.APIFY_API_TOKEN
  if (env && env.trim()) return env.trim()
  const file = path.join(__dirname, '..', '.secrets', 'apify.txt')
  if (fs.existsSync(file)) return fs.readFileSync(file, 'utf8').trim().replace(/^\w+=/, '')
  return ''
}

function authHeaders(json) {
  const h = { Authorization: `Bearer ${apifyToken()}` }
  if (json) h['Content-Type'] = 'application/json'
  return h
}

// Render's disk is wiped on restart, so history and spend live in an Apify key-value store.
let kvStoreId = null
async function kvStore() {
  if (kvStoreId) return kvStoreId
  const r = await fetchImpl(`https://api.apify.com/v2/key-value-stores?name=${KV_STORE_NAME}`, { method: 'POST', headers: authHeaders() })
  const body = await r.json()
  if (!r.ok || !body.data) throw new Error('Could not open the Apify storage for watch history.')
  kvStoreId = body.data.id
  return kvStoreId
}

async function pushRemote(body) {
  if (!apifyToken()) return
  const id = await kvStore()
  await fetchImpl(`https://api.apify.com/v2/key-value-stores/${id}/records/${KV_KEY}`, {
    method: 'PUT',
    headers: authHeaders(true),
    body
  })
}

async function hydrate() {
  if (!apifyToken()) return
  try {
    const id = await kvStore()
    const r = await fetchImpl(`https://api.apify.com/v2/key-value-stores/${id}/records/${KV_KEY}`, { headers: authHeaders() })
    const local = fs.existsSync(STATE_FILE) ? readState() : null
    if (r.status === 404) {
      if (local) await pushRemote(JSON.stringify(local, null, 2))
      return
    }
    if (!r.ok) return
    const remote = normalizeState(await r.json())
    if (!local || String(remote.updatedAt || '') >= String(local.updatedAt || '')) {
      ensureDir()
      fs.writeFileSync(STATE_FILE, JSON.stringify(remote, null, 2), 'utf8')
    } else {
      await pushRemote(JSON.stringify(local, null, 2))
    }
  } catch { /* keep the local copy */ }
}

export function ready() {
  if (!readyPromise) readyPromise = hydrate()
  return readyPromise
}

export async function refresh() {
  await ready()
  if (scanLock) return
  const state = readState()
  if (await reconcileSpend(state)) {
    writeState(state)
    await flush()
  }
}

export function normalizeName(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\bautosales\b/g, 'auto sales')
    .replace(/\s+/g, ' ')
    .trim()
}

export function isAddressTerm(term) {
  return /\d/.test(String(term || ''))
}

export function matchesSearchTerm(pageName, term) {
  if (isAddressTerm(term)) return false
  const name = normalizeName(pageName)
  const want = normalizeName(term)
  if (!name || !want) return false
  if (SKIP_NAMES.test(name) && !name.includes(want)) return false
  if (` ${name} `.includes(` ${want} `)) return true
  const need = want.split(' ').filter(Boolean)
  const have = name.split(' ').filter(Boolean)
  return need.length >= 2 && need.every((t) => have.includes(t))
}

export function reviewReason(name, keyword, terms) {
  const hit = (terms || []).find((t) => matchesSearchTerm(name, t))
  if (hit) {
    return {
      status: 'potential_impersonator',
      reason: `Name matches the keyword “${hit}”. Flagged for review only. A similar name does not make it a scam; a real business can share it.`
    }
  }
  return { status: 'not_flagged', reason: `Returned for “${keyword}”. Name does not match a watch keyword.` }
}

function chicagoParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date)
  const get = (t) => parts.find((p) => p.type === t).value
  return { year: get('year'), month: get('month'), day: get('day'), hour: Number(get('hour')), minute: Number(get('minute')) }
}

function chicagoDay(date = new Date()) {
  const p = chicagoParts(date)
  return `${p.year}-${p.month}-${p.day}`
}

// Apify totals a run's charge a few seconds after it ends. Until then, count the run's full cap.
function rowUsd(row) {
  const usd = Number(row.usd || 0)
  return row.settled === false ? Math.max(usd, Number(row.capUsd || 0)) : usd
}

export function spentToday(state, now = new Date()) {
  const day = chicagoDay(now)
  return (state.spend || [])
    .filter((row) => chicagoDay(new Date(row.at)) === day)
    .reduce((sum, row) => sum + rowUsd(row), 0)
}

function settledFloor(row) {
  return PRICE.diamondStartUsd + PRICE.diamondResultUsd * Number(row.items || 0)
}

export async function reconcileSpend(state) {
  if (!apifyToken()) return false
  let changed = false
  for (const row of state.spend || []) {
    if (row.settled !== false || !row.runId) continue
    const r = await apifyJson(`https://api.apify.com/v2/actor-runs/${row.runId}`, { headers: authHeaders() })
    const run = r.ok && r.body && r.body.data
    if (!run) continue
    const usd = Number(run.usageTotalUsd || 0)
    const ageMs = Date.now() - new Date(run.finishedAt || row.at).getTime()
    row.usd = usd
    if (usd >= settledFloor(row) || ageMs > 5 * 60000) row.settled = true
    changed = true
  }
  if (changed) {
    for (const scan of state.scans) {
      for (const t of scan.terms || []) {
        const row = state.spend.find((s) => s.runId && s.runId === t.runId)
        if (row) t.costUsd = row.usd
      }
      scan.totalUsd = Number((scan.terms || []).reduce((a, t) => a + Number(t.costUsd || 0), 0).toFixed(4))
    }
  }
  return changed
}

export function runCapUsd(resultsLimit) {
  const est = PRICE.startUsd + PRICE.resultUsd * resultsLimit
  return Number(Math.max(PRICE.actorFloorUsd, est).toFixed(3))
}

export function budget(state, now = new Date()) {
  const cap = Number(state.settings.dailyCapUsd) || DAILY_CAP_USD
  const spent = spentToday(state, now)
  const left = Math.max(0, cap - spent)
  const perSearch = runCapUsd(state.settings.maxResults)
  return { dailyCapUsd: cap, spentTodayUsd: Number(spent.toFixed(4)), leftTodayUsd: Number(left.toFixed(4)), perSearchCapUsd: perSearch }
}

export function searchInput(term, settings) {
  return {
    categories: [term],
    resultsLimit: Math.max(1, Math.min(MAX_RESULTS, Number(settings.maxResults) || MAX_RESULTS)),
    searchType: 'pages',
    locations: []
  }
}

function pageIdOf(item) {
  const id = String((item && (item.id || item.pageId || item.facebookId)) || '').trim()
  if (id) return id
  const url = String((item && (item.url || item.pageUrl)) || '')
  const m = url.match(/\/(\d{8,})\/?(\?|$)/) || url.match(/id=(\d{8,})/)
  return m ? m[1] : url
}

function descriptionOf(item) {
  const d = item.description || item.intro || item.about || item.info || item.category || item.categories || null
  if (!d) return null
  return Array.isArray(d) ? d.join(' · ') : String(d)
}

async function apifyJson(url, opts) {
  const r = await fetchImpl(url, opts)
  let body = null
  try { body = await r.json() } catch { body = null }
  return { ok: r.ok, status: r.status, body }
}

// One actor run. No retries. Apify stops charging at maxTotalChargeUsd.
async function runSearch(input, maxTotalChargeUsd) {
  if (!apifyToken()) return { failed: true, stopAll: true, reason: 'No Apify token on the server.', chargedUsd: 0, items: [] }
  const started = await apifyJson(
    `https://api.apify.com/v2/acts/${ACTOR_ID}/runs?maxTotalChargeUsd=${maxTotalChargeUsd}`,
    { method: 'POST', headers: authHeaders(true), body: JSON.stringify(input) }
  )
  if (!started.ok || !started.body || !started.body.data) {
    return { failed: true, stopAll: true, reason: `Apify refused the search (${started.status}).`, chargedUsd: 0, items: [] }
  }
  let run = started.body.data
  const done = new Set(['SUCCEEDED', 'FAILED', 'ABORTED', 'TIMED-OUT'])
  const begin = Date.now()
  while (!done.has(run.status) && Date.now() - begin < 240000) {
    await new Promise((r) => setTimeout(r, process.env.AAR_MONITOR_POLL_MS ? Number(process.env.AAR_MONITOR_POLL_MS) : 2500))
    const cur = await apifyJson(`https://api.apify.com/v2/actor-runs/${run.id}`, { headers: authHeaders() })
    if (cur.ok && cur.body && cur.body.data) run = cur.body.data
  }
  let items = []
  if (run.defaultDatasetId) {
    const ds = await apifyJson(`https://api.apify.com/v2/datasets/${run.defaultDatasetId}/items?clean=true`, { headers: authHeaders() })
    if (ds.ok && Array.isArray(ds.body)) items = ds.body
  }
  const floor = settledFloor({ items: items.length })
  let final = run
  for (let i = 0; i < 8; i++) {
    const cur = await apifyJson(`https://api.apify.com/v2/actor-runs/${run.id}`, { headers: authHeaders() })
    if (cur.ok && cur.body && cur.body.data) final = cur.body.data
    if (Number(final.usageTotalUsd || 0) >= floor) break
    await new Promise((r) => setTimeout(r, process.env.AAR_MONITOR_POLL_MS ? Number(process.env.AAR_MONITOR_POLL_MS) : 2500))
  }
  const chargedUsd = Number(final.usageTotalUsd || 0)
  const settled = chargedUsd >= floor
  if (final.status !== 'SUCCEEDED') {
    return { failed: true, reason: `Apify search ended ${final.status}. Not retried.`, runId: run.id, chargedUsd, settled, items }
  }
  return { runId: run.id, chargedUsd, settled, items }
}

function ingestItems(state, items, keyword, runId, at) {
  const terms = state.settings.searchTerms
  const discovered = []
  for (const item of items || []) {
    const id = pageIdOf(item)
    if (!id) continue
    const name = String(item.name || item.title || '').trim()
    const prior = state.pages[id]
    if (!prior) {
      const verdict = reviewReason(name, keyword, terms)
      state.pages[id] = {
        id,
        name,
        url: item.url || item.pageUrl || '',
        description: descriptionOf(item),
        isVerified: !!item.isVerified,
        profilePictureUrl: item.profilePictureUrl || null,
        firstSeenAt: at,
        lastSeenAt: at,
        firstKeyword: keyword,
        firstRunId: runId,
        keywords: [keyword],
        status: verdict.status,
        reason: verdict.reason,
        alertedAt: null,
        investigation: null
      }
      if (isFlagged(state.pages[id])) discovered.push(state.pages[id])
    } else {
      prior.lastSeenAt = at
      prior.name = name || prior.name
      prior.url = item.url || prior.url
      prior.description = descriptionOf(item) || prior.description || null
      prior.keywords = Array.from(new Set([...(prior.keywords || []), keyword]))
      if (!prior.firstKeyword) prior.firstKeyword = keyword
    }
  }
  return discovered
}

export function buildAlert(discovered, settings) {
  const rows = discovered.map((p) => [
    `Name: ${p.name}`,
    `URL: ${p.url}`,
    `Facebook page ID: ${p.id}`,
    `Keyword searched: ${p.firstKeyword || 'unknown'}`,
    `Description: ${p.description || 'none returned'}`,
    `Discovered: ${p.firstSeenAt}`,
    `Reason flagged: ${p.reason}`
  ].join('\n')).join('\n\n')
  const dash = settings.publicUrl ? `\nDashboard: ${settings.publicUrl}\n` : '\nOpen AAR AI Team Member with your private link.\n'
  return {
    subject: `Scam alert — ${discovered.length} new Facebook page${discovered.length === 1 ? '' : 's'} to review for AAR Auto Sales`,
    text: `AAR AI Team Member found ${discovered.length === 1 ? 'a new page' : 'new pages'} whose name matches your watch keywords. These are flagged for review, not confirmed scams. Look at each page before reporting it.\n${dash}\n${rows}`
  }
}

async function sendMail({ to, subject, text }) {
  if (mailerOverride) return mailerOverride({ to, subject, text })
  const user = process.env.GMAIL_USER && process.env.GMAIL_USER.trim()
  const pass = process.env.GMAIL_APP_PASSWORD && process.env.GMAIL_APP_PASSWORD.trim()
  if (!user || !pass) return { sent: false, reason: 'Email is not connected on the server.' }
  const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user, pass } })
  await transporter.sendMail({ from: `"AAR AI Team Member" <${user}>`, to: to.join(', '), subject, text })
  return { sent: true }
}

async function maybeAlert(state, discovered) {
  const fresh = discovered.filter((p) => !p.alertedAt)
  if (!fresh.length) return { sent: false, reason: 'nothing_new' }
  const alert = buildAlert(fresh, state.settings)
  const at = new Date().toISOString()
  state.lastAlert = { at, pageIds: fresh.map((p) => p.id), subject: alert.subject, text: alert.text }
  const to = (state.settings.emailRecipients || []).map((e) => String(e || '').trim()).filter((e) => e.includes('@'))
  if (!to.length) {
    state.lastEmail = { at, sent: false, reason: 'no_recipients', subject: alert.subject }
    return { sent: false, reason: 'no_recipients', alert }
  }
  let result
  try {
    result = await sendMail({ to, subject: alert.subject, text: alert.text })
  } catch (e) {
    result = { sent: false, reason: e.message || 'Email failed.' }
  }
  state.lastEmail = { at, sent: !!result.sent, reason: result.reason || null, to, subject: alert.subject }
  if (result.sent) for (const p of fresh) p.alertedAt = at
  return { ...result, alert }
}

/**
 * The one search function. Voice, desk button, and the daily schedule call this.
 * opts.only limits the run to keywords already in the saved list (used for a single test keyword).
 */
export async function runConfiguredSearch(opts = {}) {
  if (scanLock) return { ok: false, error: 'A Facebook search is already running.' }
  scanLock = true
  try {
    await ready()
    const state = readState()
    await reconcileSpend(state)
    const source = opts.source || 'manual'
    let terms = state.settings.searchTerms.slice()
    if (Array.isArray(opts.only)) terms = terms.filter((t) => opts.only.includes(t))
    if (!terms.length) return { ok: false, error: 'No saved keywords to search.' }

    const at = new Date().toISOString()
    const scan = { id: `scan-${at}`, at, source, actor: ACTOR, terms: [], totalUsd: 0, newCount: 0, stoppedReason: null }
    state.scans.unshift(scan)
    state.scans = state.scans.slice(0, MAX_SCANS_KEPT)
    writeState(state)

    const discovered = []
    for (const keyword of terms) {
      const input = searchInput(keyword, state.settings)
      const cap = runCapUsd(input.resultsLimit)
      const left = budget(state).leftTodayUsd
      if (left < cap) {
        scan.stoppedReason = `Stopped before “${keyword}”: $${left.toFixed(3)} left of today’s $${Number(state.settings.dailyCapUsd).toFixed(2)} limit, and one search can cost up to $${cap.toFixed(3)}.`
        break
      }
      const runAt = new Date().toISOString()
      const r = await runSearch(input, cap)
      if (r.chargedUsd > 0 || r.runId) {
        state.spend.push({ at: runAt, usd: r.chargedUsd, capUsd: cap, settled: !!r.settled || !r.runId, items: r.items.length, runId: r.runId || null, keyword, source, scanId: scan.id })
      }
      scan.totalUsd = Number((scan.totalUsd + r.chargedUsd).toFixed(4))
      const found = r.failed && !r.items.length ? [] : ingestItems(state, r.items, keyword, r.runId, runAt)
      discovered.push(...found)
      scan.terms.push({
        keyword,
        input,
        runId: r.runId || null,
        costUsd: r.chargedUsd,
        capUsd: cap,
        error: r.failed ? r.reason : null,
        items: r.items
      })
      writeState(state)
      if (r.stopAll) {
        scan.stoppedReason = r.reason
        break
      }
    }
    scan.newCount = discovered.length
    scan.finishedAt = new Date().toISOString()
    const mail = await maybeAlert(state, discovered)
    scan.email = { sent: !!mail.sent, reason: mail.reason || null }
    writeState(state)
    await flush()
    return {
      ok: true,
      scan: scanView(state, scan),
      discovered: discovered.map(pageView),
      email: mail.alert ? { sent: !!mail.sent, reason: mail.reason || null, subject: mail.alert.subject } : { sent: false, reason: mail.reason },
      budget: budget(state)
    }
  } finally {
    scanLock = false
  }
}

function pageView(p) {
  return {
    id: p.id,
    name: p.name,
    url: p.url,
    description: p.description || null,
    firstSeenAt: p.firstSeenAt,
    firstKeyword: p.firstKeyword || null,
    status: p.status,
    reason: p.reason
  }
}

function scanView(state, scan) {
  if (!scan) return null
  return {
    id: scan.id,
    at: scan.at,
    finishedAt: scan.finishedAt || null,
    source: scan.source,
    totalUsd: scan.totalUsd,
    newCount: scan.newCount,
    stoppedReason: scan.stoppedReason,
    email: scan.email || null,
    terms: scan.terms.map((t) => ({
      keyword: t.keyword,
      input: t.input,
      runId: t.runId,
      costUsd: t.costUsd,
      error: t.error,
      results: (t.items || []).map((item) => {
        const id = pageIdOf(item)
        const page = state.pages[id] || {}
        return {
          keyword: t.keyword,
          name: String(item.name || item.title || page.name || ''),
          url: item.url || item.pageUrl || page.url || '',
          id,
          description: descriptionOf(item) || page.description || null,
          discoveredAt: page.firstSeenAt || null,
          status: page.status || 'not_flagged',
          reason: page.reason || null,
          costUsd: t.costUsd
        }
      })
    }))
  }
}

export function snapshot(role) {
  const state = readState()
  const pages = Object.values(state.pages).sort((a, b) => String(b.firstSeenAt).localeCompare(String(a.firstSeenAt)))
  return {
    role,
    settings: role === 'marty' ? state.settings : {
      searchTerms: state.settings.searchTerms,
      monitoringEnabled: state.settings.monitoringEnabled,
      dailyScanTime: state.settings.dailyScanTime
    },
    flagged: pages.filter(isFlagged),
    latestScan: scanView(state, state.scans[0]),
    lastAlert: state.lastAlert,
    lastEmail: role === 'marty' ? state.lastEmail : null,
    budget: budget(state),
    mailReady: Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD),
    apifyReady: Boolean(apifyToken()),
    actor: ACTOR,
    successRunId: SUCCESS_RUN_ID,
    successInput: SUCCESS_INPUT
  }
}

export function briefing() {
  const state = readState()
  const flagged = Object.values(state.pages).filter(isFlagged)
    .sort((a, b) => String(b.firstSeenAt).localeCompare(String(a.firstSeenAt)))
  const last = state.scans[0]
  const lines = [
    'FACEBOOK SEARCH — when he says search Facebook or scan Facebook, call search_facebook. It runs Marty’s saved keywords exactly as saved; you do not choose or change keywords. When he asks what was found, call get_facebook_findings. Do not invent pages. Do not say a search ran unless the tool says it did.',
    `Saved keywords: ${state.settings.searchTerms.join(' | ')}. Daily search: ${state.settings.monitoringEnabled ? 'on' : 'off'} at ${state.settings.dailyScanTime} Central. Daily spending limit $${Number(state.settings.dailyCapUsd).toFixed(2)}.`,
    'Randy has no AAR Auto Sales Facebook page. A page whose name matches a keyword is flagged for review only. Never call a same-name page a scam, and never tell anyone to report a page Marty or Randy has not confirmed. Real businesses share these names.',
    flagged.length
      ? `Flagged for review (${flagged.length}): ${flagged.slice(0, 5).map((p) => `${p.name} (${p.status.replace(/_/g, ' ')}, id ${p.id})`).join('; ')}.`
      : 'No pages are flagged for review yet.',
    last ? `Last search: ${last.at}, ${last.source}, ${last.terms.length} keyword${last.terms.length === 1 ? '' : 's'}, $${Number(last.totalUsd || 0).toFixed(3)}, new flagged ${last.newCount}.${last.stoppedReason ? ' ' + last.stoppedReason : ''}` : 'No search stored yet.'
  ]
  return lines.join('\n')
}

export async function handleTool(name, args = {}, role = 'randy') {
  await ready()
  if (name === 'get_facebook_findings') {
    const snap = snapshot(role)
    if (args.pageId) {
      return snap.flagged.find((p) => p.id === String(args.pageId)) || { error: 'That page is not in the watch file.' }
    }
    return {
      count: snap.flagged.length,
      pages: snap.flagged.map(pageView),
      lastSearch: snap.latestScan && {
        at: snap.latestScan.at,
        totalUsd: snap.latestScan.totalUsd,
        stoppedReason: snap.latestScan.stoppedReason,
        keywords: snap.latestScan.terms.map((t) => ({ keyword: t.keyword, results: t.results.length, costUsd: t.costUsd, error: t.error }))
      }
    }
  }
  if (name === 'search_facebook') {
    const out = await runConfiguredSearch({ source: 'voice' })
    if (!out.ok) return out
    return {
      ok: true,
      totalUsd: out.scan.totalUsd,
      stoppedReason: out.scan.stoppedReason,
      keywords: out.scan.terms.map((t) => ({
        keyword: t.keyword,
        results: t.results.length,
        costUsd: t.costUsd,
        error: t.error,
        names: t.results.map((r) => r.name)
      })),
      newFlaggedForReview: out.discovered,
      email: out.email,
      budget: out.budget
    }
  }
  return { error: 'Unknown tool.' }
}

export const MONITOR_TOOLS = [
  {
    type: 'function',
    name: 'search_facebook',
    description: 'Run the saved Facebook Pages keyword search through Apify. Uses only Marty’s saved keyword list, exactly as saved. Takes no keywords. Enforces the daily spending limit. Returns every result per keyword and any new pages flagged for review.',
    parameters: { type: 'object', properties: {}, additionalProperties: false }
  },
  {
    type: 'function',
    name: 'get_facebook_findings',
    description: 'Read stored Facebook search findings and the last search. Does not spend money. Use when asked what was found or to show pages flagged for review.',
    parameters: { type: 'object', properties: { pageId: { type: 'string' } }, additionalProperties: false }
  }
]

export async function saveSettings(patch, role) {
  if (role !== 'marty') return { error: 'Only Marty can change watch settings.' }
  await ready()
  const state = readState()
  const next = { ...state.settings }
  if (Array.isArray(patch.searchTerms)) {
    const seen = new Set()
    next.searchTerms = patch.searchTerms
      .map((t) => String(t || '').trim())
      .filter((t) => t && !seen.has(t) && seen.add(t))
    if (!next.searchTerms.length) return { error: 'Keep at least one keyword.' }
  }
  if (patch.maxResults != null) next.maxResults = Math.max(1, Math.min(MAX_RESULTS, Number(patch.maxResults) || MAX_RESULTS))
  if (patch.dailyScanTime) {
    if (!/^\d{2}:\d{2}$/.test(String(patch.dailyScanTime))) return { error: 'Use 24-hour time like 07:00.' }
    next.dailyScanTime = String(patch.dailyScanTime)
  }
  if (typeof patch.monitoringEnabled === 'boolean') next.monitoringEnabled = patch.monitoringEnabled
  if (Array.isArray(patch.emailRecipients)) {
    next.emailRecipients = patch.emailRecipients.map((e) => String(e || '').trim()).filter((e) => e.includes('@'))
  }
  if (patch.publicUrl != null) next.publicUrl = String(patch.publicUrl || '').trim()
  if (patch.dailyCapUsd != null) next.dailyCapUsd = Math.min(DAILY_CAP_USD, Math.max(0, Number(patch.dailyCapUsd) || 0))
  state.settings = next
  writeState(state)
  await flush()
  return { settings: state.settings }
}

export async function markPage(id, status, role) {
  if (role !== 'marty' && role !== 'randy') return { error: 'Need a review key.' }
  await ready()
  const state = readState()
  const page = state.pages[String(id)]
  if (!page) return { error: 'Page not in the watch file.' }
  if (!['confirmed_fraud', 'potential_impersonator', 'same_name', 'not_flagged'].includes(status)) return { error: 'Unknown status.' }
  page.status = status
  page.markedBy = role
  writeState(state)
  await flush()
  return { page }
}

export async function saveInvestigation(id, fields, role) {
  if (role !== 'marty') return { error: 'Only Marty can save an investigation.' }
  await ready()
  const state = readState()
  const page = state.pages[String(id)]
  if (!page) return { error: 'Page not in the watch file.' }
  page.investigation = { ...(page.investigation || {}), ...fields, at: new Date().toISOString() }
  writeState(state)
  await flush()
  return { page }
}

export async function sendTestEmail(role) {
  if (role !== 'marty') return { error: 'Only Marty can send a test email.' }
  await ready()
  const state = readState()
  const to = (state.settings.emailRecipients || []).filter((e) => String(e).includes('@'))
  if (!to.length) return { error: 'Add at least one email recipient first.' }
  const subject = 'AAR test alert — not a live hit'
  const result = await sendMail({
    to,
    subject,
    text: 'This is a test from AAR AI Team Member. No new page was found. If you received this, email delivery is connected.'
  }).catch((e) => ({ sent: false, reason: e.message }))
  state.lastEmail = { at: new Date().toISOString(), sent: !!result.sent, reason: result.reason || 'test', to, subject }
  writeState(state)
  return result.sent ? { ok: true } : { error: result.reason || 'Could not send.' }
}

// Due once per Central day, from the saved time until four hours after it.
export function dailyDue(state, now = new Date()) {
  if (!state.settings.monitoringEnabled) return false
  const [h, m] = String(state.settings.dailyScanTime || '07:00').split(':').map(Number)
  const p = chicagoParts(now)
  const minutes = p.hour * 60 + p.minute
  const start = h * 60 + m
  if (minutes < start || minutes >= start + 240) return false
  const today = chicagoDay(now)
  return !state.scans.some((s) => s.source === 'schedule' && chicagoDay(new Date(s.at)) === today)
}

export async function runDaily() {
  await ready()
  const state = readState()
  if (!dailyDue(state)) {
    return { ok: true, ran: false, reason: state.settings.monitoringEnabled ? 'Not due. The daily search already ran today or it is outside the morning window.' : 'Daily search is off.' }
  }
  const out = await runConfiguredSearch({ source: 'schedule' })
  return { ran: true, ...out }
}

export function armScheduler() {
  if (tickTimer) clearInterval(tickTimer)
  ready()
  tickTimer = setInterval(() => {
    runDaily().catch(() => {})
  }, 60000)
}

export function stopScheduler() {
  if (tickTimer) clearInterval(tickTimer)
  tickTimer = null
}
