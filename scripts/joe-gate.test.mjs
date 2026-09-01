/**
 * Joe’s gated Axon desk: login, first-IP bind, foreign-IP shutoff, Marty log.
 *
 *   node scripts/joe-gate.test.mjs
 */

import fs from 'fs'
import os from 'os'
import path from 'path'
import { spawn } from 'child_process'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const PORT = 3215
const base = `http://127.0.0.1:${PORT}`
const gateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'joe-gate-'))
const PASS = 'test-joe-password'
const ADMIN = 'test-joe-admin-key'

const failures = []
const check = (name, ok, detail) => {
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${name}${detail ? ' — ' + detail : ''}`)
  if (!ok) failures.push(name)
}

const server = spawn('node', ['server/server.js'], {
  cwd: ROOT,
  env: {
    ...process.env,
    PORT: String(PORT),
    OPENAI_API_KEY: '',
    JOE_GATE_USER: 'joe',
    JOE_GATE_PASSWORD: PASS,
    JOE_GATE_ADMIN: ADMIN,
    JOE_GATE_DIR: gateDir
  },
  stdio: ['ignore', 'pipe', 'pipe']
})
const log = []
server.stdout.on('data', d => log.push(String(d)))
server.stderr.on('data', d => log.push(String(d)))

async function waitForServer() {
  const deadline = Date.now() + 8000
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`${base}/health`)
      if (r.ok || r.status === 200) return
    } catch { /* not up yet */ }
    await new Promise(r => setTimeout(r, 80))
  }
  throw new Error('server did not start\n' + log.join(''))
}

function cookieFrom(res) {
  const raw = res.headers.getSetCookie?.() || []
  if (raw.length) return raw.map(c => c.split(';')[0]).join('; ')
  const one = res.headers.get('set-cookie')
  return one ? one.split(';')[0] : ''
}

async function hit(pathName, { ip = '1.1.1.1', cookie = '', method = 'GET', body, json = false, headers = {} } = {}) {
  const opts = {
    method,
    redirect: 'manual',
    headers: {
      'x-forwarded-for': ip,
      'user-agent': 'joe-gate-test',
      ...(cookie ? { cookie } : {}),
      ...headers
    }
  }
  if (body !== undefined) {
    if (json) {
      opts.headers['content-type'] = 'application/json'
      opts.headers.accept = 'application/json'
      opts.body = JSON.stringify(body)
    } else {
      opts.headers['content-type'] = 'application/x-www-form-urlencoded'
      opts.body = new URLSearchParams(body).toString()
    }
  }
  const res = await fetch(base + pathName, opts)
  const text = await res.text()
  let data = null
  try { data = JSON.parse(text) } catch { /* html */ }
  return { res, text, data, cookie: cookieFrom(res) }
}

try {
  await waitForServer()

  const tim = await hit('/tim', { ip: '9.9.9.9' })
  check('Tim’s link stays open', tim.res.status === 200 && /Ira|Tim|Axon/i.test(tim.text), `status ${tim.res.status}`)

  const guest = await hit('/joe', { ip: '8.8.8.8' })
  check('Joe’s desk shows a login', guest.res.status === 200 && /Joe’s Axon desk/.test(guest.text), `status ${guest.res.status}`)

  const docs = await hit('/api/brain/docs', { ip: '8.8.8.8' })
  check('Teaching docs stay closed', docs.res.status === 401 && docs.data?.code === 'login', `status ${docs.res.status}`)

  const timSession = await hit('/session?gate=1&src=axon&name=Tim', { ip: '8.8.8.8' })
  check(
    'Tim’s voice token is not IP-locked',
    timSession.res.status === 503 && /OPENAI_API_KEY/i.test(timSession.text + JSON.stringify(timSession.data || {})),
    `status ${timSession.res.status}`
  )

  const joeSession = await hit('/session?gate=1&src=axon&name=Joe', { ip: '8.8.8.8' })
  check('Joe’s voice token needs login', joeSession.res.status === 401, `status ${joeSession.res.status}`)

  const qbSession = await hit('/session?gate=1&src=qb', { ip: '8.8.8.8' })
  check('Books voice token needs login', qbSession.res.status === 401, `status ${qbSession.res.status}`)

  const bad = await hit('/joe/login', {
    ip: '1.1.1.1',
    method: 'POST',
    json: true,
    body: { user: 'joe', password: 'nope' }
  })
  check('Bad password is rejected', bad.res.status === 401 && bad.data?.code === 'bad_login', `status ${bad.res.status}`)

  const ok = await hit('/joe/login', {
    ip: '1.1.1.1',
    method: 'POST',
    json: true,
    body: { user: 'joe', password: PASS }
  })
  check('First login binds Joe’s IP', ok.res.status === 200 && ok.data?.ok === true && ok.data?.boundIp === '1.1.1.1', JSON.stringify(ok.data))
  check('Login sets a cookie', Boolean(ok.cookie), ok.cookie)

  const desk = await hit('/joe', { ip: '1.1.1.1', cookie: ok.cookie })
  check('Joe can open the orb from that IP', desk.res.status === 200 && /Tap the orb to talk/.test(desk.text), `status ${desk.res.status}`)

  const books = await hit('/axon-brain.html', { ip: '1.1.1.1', cookie: ok.cookie })
  check('Joe can open the books page', books.res.status === 200 && /Joe/.test(books.text), `status ${books.res.status}`)

  const other = await hit('/joe/login', {
    ip: '2.2.2.2',
    method: 'POST',
    json: true,
    body: { user: 'joe', password: PASS }
  })
  check('Someone else opening it shuts the desk off', other.res.status === 403 && other.data?.code === 'locked', JSON.stringify(other.data))

  const lockedPage = await hit('/joe', { ip: '1.1.1.1', cookie: ok.cookie })
  check('Joe’s own session is also shut off', lockedPage.res.status === 403 && /shut off/i.test(lockedPage.text), `status ${lockedPage.res.status}`)

  const logPage = await hit(`/joe/log?key=${ADMIN}&format=json`, { ip: '9.9.9.9' })
  check('Marty can read the log from anywhere', logPage.data?.ok === true && logPage.data?.locked === true, JSON.stringify(logPage.data && { locked: logPage.data.locked, boundIp: logPage.data.boundIp }))
  const events = (logPage.data?.log || []).map(e => e.event)
  check('Log recorded the foreign login lock', events.includes('lock') && events.includes('login_ok'), events.join(','))

  const noKey = await hit('/joe/log?key=wrong', { ip: '9.9.9.9' })
  check('Log rejects a wrong admin key', noKey.res.status === 401, `status ${noKey.res.status}`)

  const unlock = await hit('/joe/unlock', {
    ip: '9.9.9.9',
    method: 'POST',
    json: true,
    body: { key: ADMIN }
  })
  check('Marty can unlock', unlock.data?.ok === true, JSON.stringify(unlock.data))

  const again = await hit('/joe/login', {
    ip: '3.3.3.3',
    method: 'POST',
    json: true,
    body: { user: 'joe', password: PASS }
  })
  check('After unlock, Joe’s next login rebinds', again.res.status === 200 && again.data?.boundIp === '3.3.3.3', JSON.stringify(again.data))

  const mem = await hit('/api/brain/memory', { ip: '3.3.3.3', cookie: again.cookie })
  check('Joe cannot download the memory bank', mem.res.status === 403 && mem.data?.code === 'host_only', JSON.stringify(mem.data))

  const wipe = await hit('/api/brain/docs/nope.txt', { ip: '3.3.3.3', cookie: again.cookie, method: 'DELETE' })
  check('Joe cannot delete teaching docs', wipe.res.status === 403 && wipe.data?.code === 'host_only', JSON.stringify(wipe.data))

  const hostMem = await hit('/api/brain/memory', { ip: '9.9.9.9', headers: { 'x-joe-admin': ADMIN } })
  check('Host can open the memory bank', hostMem.res.status === 200 && hostMem.data?.ok === true, `status ${hostMem.res.status}`)

  const hostPage = await hit(`/joe/host?key=${ADMIN}`, { ip: '9.9.9.9' })
  check('Host console names Marty as host', hostPage.res.status === 200 && /You are the host/.test(hostPage.text) && /manager/.test(hostPage.text), `status ${hostPage.res.status}`)

  const revoke = await hit('/joe/revoke', {
    ip: '9.9.9.9',
    method: 'POST',
    json: true,
    body: { key: ADMIN }
  })
  check('Host can remove Joe’s access', revoke.data?.ok === true, JSON.stringify(revoke.data))

  const blocked = await hit('/joe', { ip: '3.3.3.3', cookie: again.cookie })
  check('Revoked operator cannot open the desk', blocked.res.status === 403 && /host/i.test(blocked.text), `status ${blocked.res.status}`)

  const restore = await hit('/joe/restore', {
    ip: '9.9.9.9',
    method: 'POST',
    json: true,
    body: { key: ADMIN }
  })
  check('Host can give Joe access again', restore.data?.ok === true, JSON.stringify(restore.data))

  const back = await hit('/joe/login', {
    ip: '3.3.3.3',
    method: 'POST',
    json: true,
    body: { user: 'joe', password: PASS }
  })
  check('Restored operator can sign in on the bound connection', back.res.status === 200 && back.data?.boundIp === '3.3.3.3', JSON.stringify(back.data))
} catch (error) {
  check('ran without throwing', false, error.message)
} finally {
  server.kill('SIGTERM')
  try { fs.rmSync(gateDir, { recursive: true, force: true }) } catch { /* ignore */ }
}

if (failures.length) {
  console.error('\nFailed:', failures.join(', '))
  process.exit(1)
}
console.log('\nJoe gate checks passed.')
