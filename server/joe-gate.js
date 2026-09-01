/**
 * Joe's Axon desk — Marty is the host, Joe is a manager seat.
 *
 * Same idea as Google Places: the desk stays on Marty's account. Joe can use
 * it. He cannot copy the brain, export memory, or take ownership. First
 * successful login binds Joe's IP. A later open from anywhere else shuts the
 * desk off. Marty can also remove operator access anytime from /joe/host.
 *
 * Env (Render → Environment — do not commit values):
 *   JOE_GATE_USER       login name, default "joe"
 *   JOE_GATE_PASSWORD   required; desk returns 503 until this is set
 *   JOE_GATE_ADMIN      required to read the log / unlock
 *   JOE_ALLOWED_IPS     optional comma list; skip auto-bind and only allow these
 *   JOE_GATE_DIR        optional override for the state folder (tests)
 */

import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DEFAULT_ROOT = path.join(__dirname, '..', 'data', 'joe-gate')
const COOKIE = 'joe_axon'
const MAX_LOG = 400
const SESSION_MS = 30 * 24 * 60 * 60 * 1000
const OPEN_THROTTLE_MS = 10 * 60 * 1000

const OPEN_PATHS = new Set([
  '/joe/login',
  '/joe/logout',
  '/joe/log',
  '/joe/host',
  '/joe/unlock',
  '/joe/revoke',
  '/joe/restore',
  '/joe-login.html',
  '/joe-locked.html'
])

const PROTECTED_PAGES = new Set([
  '/joe',
  '/axon-brain.html',
  '/mockup1.html',
  '/mockup2.html'
])

let root = process.env.JOE_GATE_DIR || DEFAULT_ROOT

export function setRoot(dir) {
  root = dir
}

export function cookieName() {
  return COOKIE
}

function stateFile() {
  return path.join(root, 'state.json')
}

function ensureDir() {
  if (!fs.existsSync(root)) fs.mkdirSync(root, { recursive: true })
}

function emptyState() {
  return {
    boundIp: '',
    boundAt: null,
    locked: false,
    lockedAt: null,
    lockedReason: '',
    sessions: {},
    log: [],
    lastOpen: {},
    enabled: true
  }
}

function readState() {
  ensureDir()
  const file = stateFile()
  if (!fs.existsSync(file)) return emptyState()
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'))
    return {
      ...emptyState(),
      ...raw,
      sessions: raw.sessions || {},
      log: raw.log || [],
      lastOpen: raw.lastOpen || {},
      enabled: raw.enabled !== false
    }
  } catch {
    return emptyState()
  }
}

function writeState(state) {
  ensureDir()
  const tmp = `${stateFile()}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2), 'utf8')
  fs.renameSync(tmp, stateFile())
}

function configured() {
  return Boolean(String(process.env.JOE_GATE_PASSWORD || '').trim())
}

function expectedUser() {
  return String(process.env.JOE_GATE_USER || 'joe').trim().toLowerCase() || 'joe'
}

function expectedPassword() {
  return String(process.env.JOE_GATE_PASSWORD || '')
}

function expectedAdmin() {
  return String(process.env.JOE_GATE_ADMIN || '')
}

function adminKeyFrom(req) {
  return (
    req.query?.key ||
    req.body?.key ||
    req.headers?.['x-joe-admin'] ||
    req.get?.('x-joe-admin') ||
    ''
  )
}

export function isHost(req) {
  return Boolean(expectedAdmin()) && secretsEqual(adminKeyFrom(req), expectedAdmin())
}

/** Bulk copy / wipe / import — host only, never the operator. */
export function isOwnerApi(req) {
  const pathName = String(req.path || '').split('?')[0]
  const method = String(req.method || 'GET').toUpperCase()
  if (pathName === '/api/brain/memory' && method === 'GET') return true
  if (pathName === '/api/brain/memory/import') return true
  if (pathName === '/api/brain/memory/rollup') return true
  if (method === 'DELETE' && pathName.startsWith('/api/brain/docs/')) return true
  return false
}

function secretsEqual(given, expected) {
  const a = Buffer.from(String(given || ''), 'utf8')
  const b = Buffer.from(String(expected || ''), 'utf8')
  if (!expected) return false
  if (a.length !== b.length) {
    crypto.timingSafeEqual(Buffer.alloc(32), Buffer.alloc(32))
    return false
  }
  return crypto.timingSafeEqual(a, b)
}

export function normalizeIp(raw) {
  let ip = String(raw || '').trim().replace(/^["']|["']$/g, '')
  if (ip.startsWith('::ffff:')) ip = ip.slice(7)
  if (/^\d{1,3}(?:\.\d{1,3}){3}:\d+$/.test(ip)) ip = ip.split(':')[0]
  if (ip === '::1') ip = '127.0.0.1'
  return ip
}

export function clientIp(req) {
  const xf = String(req.headers?.['x-forwarded-for'] || req.get?.('x-forwarded-for') || '')
    .split(',')[0]
    .trim()
  const raw = xf || req.socket?.remoteAddress || req.ip || ''
  return normalizeIp(raw)
}

function userAgent(req) {
  return String(req.headers?.['user-agent'] || req.get?.('user-agent') || '').slice(0, 240)
}

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex')
}

function parseCookies(req) {
  const header = String(req.headers?.cookie || req.get?.('cookie') || '')
  const out = {}
  for (const part of header.split(';')) {
    const idx = part.indexOf('=')
    if (idx < 0) continue
    const key = part.slice(0, idx).trim()
    const val = part.slice(idx + 1).trim()
    if (key) out[key] = decodeURIComponent(val)
  }
  return out
}

function allowedList() {
  return String(process.env.JOE_ALLOWED_IPS || '')
    .split(',')
    .map(s => normalizeIp(s))
    .filter(Boolean)
}

function ipAllowed(ip, state) {
  const list = allowedList()
  if (list.length) return list.includes(ip)
  if (!state.boundIp) return true
  return state.boundIp === ip
}

function pruneSessions(state, now = Date.now()) {
  const sessions = {}
  for (const [hash, sess] of Object.entries(state.sessions || {})) {
    const at = Date.parse(sess.createdAt || '') || 0
    if (now - at < SESSION_MS) sessions[hash] = sess
  }
  state.sessions = sessions
}

function pushLog(state, event, req, detail = '') {
  state.log.unshift({
    at: new Date().toISOString(),
    event,
    ip: clientIp(req),
    ua: userAgent(req),
    detail: String(detail || '').slice(0, 240)
  })
  if (state.log.length > MAX_LOG) state.log.length = MAX_LOG
}

function lockAccount(state, req, reason) {
  state.locked = true
  state.lockedAt = new Date().toISOString()
  state.lockedReason = reason
  state.sessions = {}
  pushLog(state, 'lock', req, reason)
}

function cookieHeader(token, req, clear = false) {
  const proto = String(req.get?.('x-forwarded-proto') || req.protocol || '').split(',')[0].trim()
  const secure = proto === 'https' || req.secure === true
  const parts = [
    `${COOKIE}=${clear ? '' : encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    clear ? 'Max-Age=0' : `Max-Age=${Math.floor(SESSION_MS / 1000)}`
  ]
  if (secure) parts.push('Secure')
  return parts.join('; ')
}

function wantsHtml(req) {
  const accept = String(req.headers?.accept || req.get?.('accept') || '')
  const pathName = req.path || req.url || ''
  if (PROTECTED_PAGES.has(pathName.split('?')[0])) return true
  if (/\.html$/i.test(pathName)) return true
  if (req.method === 'GET' && accept.includes('text/html')) return true
  return false
}

export function isProtected(req) {
  const pathName = String(req.path || '').split('?')[0]
  if (OPEN_PATHS.has(pathName)) return false
  if (PROTECTED_PAGES.has(pathName)) return true
  if (pathName.startsWith('/api/brain')) return true
  if (pathName === '/session') {
    const name = String(req.query?.name || '').trim().toLowerCase()
    const src = String(req.query?.src || '').trim().toLowerCase()
    const desk = String(req.query?.desk || '').trim().toLowerCase()
    if (desk === 'joe') return true
    if (src === 'qb') return true
    if (src === 'axon' && name === 'joe') return true
    if (name === 'joe') return true
  }
  return false
}

export function brainNeedsJoe(req) {
  const pathName = String(req.path || '').split('?')[0]
  if (!pathName.startsWith('/api/brain')) return false
  // All personal orbs save memory and show a count. Only Joe's desk itself
  // (docs, chat, books, imports) stays behind the login.
  if (pathName === '/api/brain/status') return false
  if (pathName === '/api/brain/memory/remember') {
    const person = String(req.body?.person || req.body?.name || req.query?.person || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
    return !person || person === 'joe'
  }
  return true
}

function pathNeedsGate(req) {
  const pathName = String(req.path || '').split('?')[0]
  if (pathName.startsWith('/api/brain')) return brainNeedsJoe(req)
  return isProtected(req)
}

export function isAuthed(req) {
  return authorize(req).ok
}

export function authorize(req) {
  if (!configured()) {
    return { ok: false, status: 503, code: 'unconfigured', message: 'Joe’s desk is not open yet. Set JOE_GATE_PASSWORD on the server.' }
  }
  const state = readState()
  const ip = clientIp(req)
  if (state.enabled === false) {
    return { ok: false, status: 403, code: 'revoked', message: 'The host removed operator access to this desk.' }
  }
  if (state.locked) {
    return { ok: false, status: 403, code: 'locked', message: 'This account was shut off because someone opened it from a different location. Contact Marty.' }
  }
  const token = parseCookies(req)[COOKIE]
  if (!token) {
    return { ok: false, status: 401, code: 'login', message: 'Sign in to open Joe’s Axon desk.' }
  }
  pruneSessions(state)
  const sess = state.sessions[hashToken(token)]
  if (!sess) {
    return { ok: false, status: 401, code: 'login', message: 'Sign in to open Joe’s Axon desk.' }
  }
  if (!ipAllowed(ip, state)) {
    lockAccount(state, req, `open from ${ip} (bound to ${state.boundIp || allowedList().join(', ') || 'none'})`)
    writeState(state)
    return { ok: false, status: 403, code: 'locked', message: 'This account was shut off because someone opened it from a different location. Contact Marty.' }
  }
  if (sess.ip && sess.ip !== ip && !allowedList().includes(ip)) {
    lockAccount(state, req, `session moved from ${sess.ip} to ${ip}`)
    writeState(state)
    return { ok: false, status: 403, code: 'locked', message: 'This account was shut off because someone opened it from a different location. Contact Marty.' }
  }
  if (maybeLogOpen(state, req, ip)) writeState(state)
  return { ok: true, ip, state }
}

function maybeLogOpen(state, req, ip) {
  const pathName = String(req.path || '').split('?')[0]
  if (req.method !== 'GET') return false
  if (!PROTECTED_PAGES.has(pathName)) return false
  const key = `${ip}|${pathName}`
  const last = Date.parse(state.lastOpen[key] || '') || 0
  if (Date.now() - last < OPEN_THROTTLE_MS) return false
  state.lastOpen[key] = new Date().toISOString()
  pushLog(state, 'open', req, pathName)
  return true
}

export function login(req, { user, password }) {
  if (!configured()) {
    return { ok: false, status: 503, code: 'unconfigured', message: 'Joe’s desk is not open yet.' }
  }
  const state = readState()
  const ip = clientIp(req)
  if (state.enabled === false) {
    pushLog(state, 'login_blocked', req, 'host revoked operator access')
    writeState(state)
    return { ok: false, status: 403, code: 'revoked', message: 'The host removed operator access to this desk.' }
  }
  if (state.locked) {
    pushLog(state, 'login_blocked', req, 'account locked')
    writeState(state)
    return { ok: false, status: 403, code: 'locked', message: 'This account was shut off because someone opened it from a different location. Contact Marty.' }
  }
  const userOk = String(user || '').trim().toLowerCase() === expectedUser()
  const passOk = secretsEqual(password, expectedPassword())
  if (!userOk || !passOk) {
    pushLog(state, 'login_fail', req, userOk ? 'bad password' : 'bad user')
    writeState(state)
    return { ok: false, status: 401, code: 'bad_login', message: 'That login did not work.' }
  }
  if (!ipAllowed(ip, state)) {
    lockAccount(state, req, `login from ${ip} (bound to ${state.boundIp || allowedList().join(', ')})`)
    writeState(state)
    return { ok: false, status: 403, code: 'locked', message: 'This account was shut off because someone opened it from a different location. Contact Marty.' }
  }
  if (!allowedList().length && !state.boundIp) {
    state.boundIp = ip
    state.boundAt = new Date().toISOString()
    pushLog(state, 'ip_bound', req, ip)
  }
  pruneSessions(state)
  const token = crypto.randomBytes(24).toString('hex')
  state.sessions[hashToken(token)] = {
    ip,
    ua: userAgent(req),
    createdAt: new Date().toISOString()
  }
  pushLog(state, 'login_ok', req, ip)
  writeState(state)
  return {
    ok: true,
    token,
    cookie: cookieHeader(token, req),
    boundIp: state.boundIp,
    ip
  }
}

export function logout(req) {
  const state = readState()
  const token = parseCookies(req)[COOKIE]
  if (token) delete state.sessions[hashToken(token)]
  pushLog(state, 'logout', req)
  writeState(state)
  return { ok: true, cookie: cookieHeader('', req, true) }
}

export function unlock(req, key) {
  if (!expectedAdmin() || !secretsEqual(key, expectedAdmin())) {
    return { ok: false, status: 401, message: 'Admin key did not match.' }
  }
  const state = readState()
  state.locked = false
  state.lockedAt = null
  state.lockedReason = ''
  state.boundIp = ''
  state.boundAt = null
  state.sessions = {}
  pushLog(state, 'unlock', req, 'bound IP cleared — next Joe login rebinds')
  writeState(state)
  return { ok: true }
}

export function revoke(req, key) {
  if (!expectedAdmin() || !secretsEqual(key, expectedAdmin())) {
    return { ok: false, status: 401, message: 'Admin key did not match.' }
  }
  const state = readState()
  state.enabled = false
  state.sessions = {}
  pushLog(state, 'revoke', req, 'host removed operator access — desk stays with Marty')
  writeState(state)
  return { ok: true }
}

export function restore(req, key) {
  if (!expectedAdmin() || !secretsEqual(key, expectedAdmin())) {
    return { ok: false, status: 401, message: 'Admin key did not match.' }
  }
  const state = readState()
  state.enabled = true
  state.locked = false
  state.lockedAt = null
  state.lockedReason = ''
  pushLog(state, 'restore', req, 'host restored operator access')
  writeState(state)
  return { ok: true }
}

export function readLog(key) {
  if (!expectedAdmin() || !secretsEqual(key, expectedAdmin())) {
    return { ok: false, status: 401, message: 'Admin key did not match.' }
  }
  const state = readState()
  return {
    ok: true,
    locked: state.locked,
    lockedAt: state.lockedAt,
    lockedReason: state.lockedReason,
    boundIp: state.boundIp,
    boundAt: state.boundAt,
    enabled: state.enabled !== false,
    host: 'Martin Simpson / Axon AI',
    operator: 'Joe — manager seat, not owner',
    sessions: Object.keys(state.sessions || {}).length,
    log: state.log
  }
}

function loginPage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="robots" content="noindex,nofollow"/>
<title>Joe’s Axon desk</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{
  min-height:100dvh;display:grid;place-items:center;
  font-family:system-ui,-apple-system,sans-serif;color:#fff;
  background:radial-gradient(115% 78% at 50% 66%, #2f8bf2 0%, #1a6bd2 24%, #0d4098 48%, #061c56 76%, #030f34 100%);
}
form{
  width:min(92vw,380px);padding:1.6rem 1.4rem 1.5rem;
  background:rgba(4,20,56,.55);border:1px solid rgba(180,214,255,.22);
  border-radius:18px;backdrop-filter:blur(10px);
}
h1{font-size:1.35rem;letter-spacing:-.03em;margin-bottom:.35rem}
p{color:rgba(214,235,255,.9);font-size:.95rem;line-height:1.45;margin-bottom:1.1rem}
label{display:block;font-size:.8rem;font-weight:650;margin:0 0 .35rem;opacity:.9}
input{
  width:100%;margin-bottom:.85rem;padding:.7rem .8rem;border-radius:10px;
  border:1px solid rgba(180,214,255,.35);background:rgba(255,255,255,.96);color:#102;
  font:inherit;
}
button{
  width:100%;margin-top:.2rem;padding:.8rem;border:0;border-radius:10px;cursor:pointer;
  font:700 1rem system-ui;color:#062056;background:#f5c518;
}
.err{color:#ffd0d0;min-height:1.2em;margin:.2rem 0 .7rem;font-size:.9rem}
</style>
</head>
<body>
<form method="post" action="/joe/login" id="f">
  <h1>Joe’s Axon desk</h1>
  <p>This login only works from Joe’s connection. The first time he opens it, that connection is saved. Anyone else who opens it shuts the desk off.</p>
  <div class="err" id="err"></div>
  <label for="user">Login</label>
  <input id="user" name="user" autocomplete="username" required>
  <label for="password">Password</label>
  <input id="password" name="password" type="password" autocomplete="current-password" required>
  <button type="submit">Open Axon</button>
</form>
<script>
const q=new URLSearchParams(location.search);
if(q.get('err')==='1')document.getElementById('err').textContent='That login did not work.';
if(q.get('locked')==='1')document.getElementById('err').textContent='This account was shut off. Contact Marty.';
if(q.get('revoked')==='1')document.getElementById('err').textContent='The host removed access to this desk.';
</script>
</body>
</html>`
}

function lockedPage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="robots" content="noindex,nofollow"/>
<title>Desk shut off</title>
<style>
body{margin:0;min-height:100dvh;display:grid;place-items:center;font-family:system-ui,sans-serif;
background:#140a12;color:#fff;padding:1.5rem}
div{max-width:28rem;line-height:1.5}
h1{font-size:1.3rem;margin:0 0 .5rem}
p{margin:0;color:#f3d6de}
</style>
</head>
<body>
<div>
  <h1>This desk is shut off</h1>
  <p>Someone opened Joe’s Axon account from a different location. It will stay closed until the host unlocks it.</p>
</div>
</body>
</html>`
}

function revokedPage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="robots" content="noindex,nofollow"/>
<title>Access removed</title>
<style>
body{margin:0;min-height:100dvh;display:grid;place-items:center;font-family:system-ui,sans-serif;
background:#061c56;color:#fff;padding:1.5rem}
div{max-width:28rem;line-height:1.5}
h1{font-size:1.3rem;margin:0 0 .5rem}
p{margin:0;color:#d6ebff}
</style>
</head>
<body>
<div>
  <h1>Access removed</h1>
  <p>The host still owns this Axon desk. Operator access was taken off, the same way a Google Places manager can be removed without giving them the business.</p>
</div>
</body>
</html>`
}

function hostPage(data, key) {
  const k = escapeHtml(key || '')
  const rows = (data.log || []).map(e => `<tr>
    <td>${escapeHtml(e.at || '')}</td>
    <td>${escapeHtml(e.event || '')}</td>
    <td>${escapeHtml(e.ip || '')}</td>
    <td>${escapeHtml(e.detail || '')}</td>
  </tr>`).join('')
  const status = data.enabled === false
    ? '<p class="bad">Joe’s operator access is <b>off</b>. You still own the desk.</p>'
    : data.locked
      ? `<p class="bad">Shut off — someone else opened it. ${escapeHtml(data.lockedReason || '')}</p>`
      : '<p class="ok">Joe can use the desk. He does not own it.</p>'
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="robots" content="noindex"/>
<title>Axon host — Joe’s desk</title>
<style>
body{font:16px/1.45 system-ui,sans-serif;margin:0;color:#111;background:#f6f7fb}
main{max-width:42rem;margin:0 auto;padding:1.3rem 1.1rem 2.5rem}
h1{font-size:1.35rem;letter-spacing:-.03em;margin:0 0 .35rem}
.lead{color:#444;margin:0 0 1.1rem}
.card{background:#fff;border:1px solid #e6e8ef;border-radius:14px;padding:1rem 1.05rem;margin:0 0 1rem}
.row{display:flex;justify-content:space-between;gap:1rem;padding:.45rem 0;border-bottom:1px solid #f0f1f5}
.row:last-child{border:0}
.ok{color:#0a7} .bad{color:#b00}
form{display:inline}
button{margin:.35rem .4rem .15rem 0;padding:.65rem .9rem;border:0;border-radius:10px;font:700 .92rem system-ui;cursor:pointer}
.rev{background:#b00;color:#fff}
.go{background:#0a7;color:#fff}
.rebind{background:#eee;color:#222}
table{border-collapse:collapse;width:100%;margin-top:.7rem;font-size:13px}
td,th{border-bottom:1px solid #eee;text-align:left;padding:.4rem .3rem;vertical-align:top}
</style></head>
<body><main>
<h1>You are the host</h1>
<p class="lead">Same idea as Google Places. This Axon desk stays on your account. Joe is a manager — he can use it to help build. He cannot copy the brain, share the login, or take the desk with him. You can remove him anytime and you still own it.</p>
<p><a href="/marty/core?key=${k}">Open the host core desk</a> — the only place that can talk about how Axon is built. Interactive resume, Joe’s seat, A1, and every other orb will say they are not authorized.</p>
<div class="card">
  <div class="row"><span>Host</span><b>Martin Simpson / Axon AI</b></div>
  <div class="row"><span>Operator</span><b>Joe — manager, not owner</b></div>
  <div class="row"><span>Joe’s saved connection</span><b>${escapeHtml(data.boundIp || 'not bound yet')}</b></div>
  <div class="row"><span>Live sessions</span><b>${data.sessions || 0}</b></div>
</div>
${status}
<div class="card">
  <form method="post" action="/joe/revoke">
    <input type="hidden" name="key" value="${k}">
    <button class="rev" type="submit">Remove Joe’s access</button>
  </form>
  <form method="post" action="/joe/restore">
    <input type="hidden" name="key" value="${k}">
    <button class="go" type="submit">Give Joe access again</button>
  </form>
  <form method="post" action="/joe/unlock">
    <input type="hidden" name="key" value="${k}">
    <button class="rebind" type="submit">Turn it back on and let Joe’s next login save a new connection</button>
  </form>
</div>
<div class="card">
  <b>Who opened it</b>
  <table>
    <thead><tr><th>When</th><th>What</th><th>From</th><th>Detail</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="4">No opens yet.</td></tr>'}</tbody>
  </table>
</div>
</main></body></html>`
}

function logPage(data) {
  const rows = (data.log || []).map(e => `<tr>
    <td>${escapeHtml(e.at || '')}</td>
    <td>${escapeHtml(e.event || '')}</td>
    <td>${escapeHtml(e.ip || '')}</td>
    <td>${escapeHtml(e.detail || '')}</td>
    <td>${escapeHtml((e.ua || '').slice(0, 80))}</td>
  </tr>`).join('')
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="robots" content="noindex"/>
<title>Joe desk log</title>
<style>
body{font:15px/1.45 system-ui,sans-serif;margin:1.2rem;color:#111}
.ok{color:#0a7} .bad{color:#b00}
table{border-collapse:collapse;width:100%;margin-top:1rem;font-size:13px}
td,th{border-bottom:1px solid #ddd;text-align:left;padding:.4rem .35rem;vertical-align:top}
</style></head>
<body>
<h1>Joe’s Axon desk</h1>
<p>Bound IP: <b>${escapeHtml(data.boundIp || '(not bound yet)')}</b>
${data.boundAt ? ` · first bound ${escapeHtml(data.boundAt)}` : ''}</p>
<p class="${data.locked ? 'bad' : 'ok'}">${data.locked
    ? `SHUT OFF at ${escapeHtml(data.lockedAt || '')} — ${escapeHtml(data.lockedReason || '')}`
    : 'Open'}</p>
<p>${data.sessions || 0} live session(s).</p>
<table>
<thead><tr><th>When</th><th>What</th><th>IP</th><th>Detail</th><th>Browser</th></tr></thead>
<tbody>${rows || '<tr><td colspan="5">No opens yet.</td></tr>'}</tbody>
</table>
</body></html>`
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]))
}

function notReadyPage() {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="robots" content="noindex"/><title>Joe’s desk</title>
<style>body{margin:0;min-height:100dvh;display:grid;place-items:center;font-family:system-ui;background:#061c56;color:#fff;padding:1.5rem}</style>
</head><body><p>Joe’s Axon desk is not open yet. Marty still needs to set the login on the server.</p></body></html>`
}

function deny(req, res, verdict) {
  if (verdict.code === 'unconfigured' && wantsHtml(req)) {
    res.status(503).type('html').set('Cache-Control', 'no-store').send(notReadyPage())
    return
  }
  if (verdict.code === 'locked' && wantsHtml(req)) {
    res.status(403).type('html').set('Cache-Control', 'no-store').send(lockedPage())
    return
  }
  if (verdict.code === 'revoked' && wantsHtml(req)) {
    res.status(403).type('html').set('Cache-Control', 'no-store').send(revokedPage())
    return
  }
  if (verdict.code === 'login' && wantsHtml(req)) {
    res.status(200).type('html').set('Cache-Control', 'no-store').send(loginPage())
    return
  }
  res.status(verdict.status || 401).set('Cache-Control', 'no-store').json({
    ok: false,
    error: verdict.message,
    code: verdict.code
  })
}

const SAFE_NEXT = new Set(['/joe', '/axon-brain.html', '/mockup2.html', '/mockup1.html'])

function nextPath(req) {
  const n = String(req.body?.next || req.query?.next || '/joe')
  return SAFE_NEXT.has(n) ? n : '/joe'
}

export function middleware(req, res, next) {
  if (isOwnerApi(req)) {
    if (isHost(req)) return next()
    return res.status(403).set('Cache-Control', 'no-store').json({
      ok: false,
      code: 'host_only',
      error: 'Only the host can copy, export, or wipe this desk.'
    })
  }
  if (!pathNeedsGate(req)) return next()
  const verdict = authorize(req)
  if (verdict.ok) return next()
  return deny(req, res, verdict)
}

export function mount(app) {
  app.get('/joe/login', (_req, res) => {
    res.set('Cache-Control', 'no-store').type('html').send(loginPage())
  })

  app.post('/joe/login', (req, res) => {
    const result = login(req, {
      user: req.body?.user,
      password: req.body?.password
    })
    const wants = String(req.headers.accept || '').includes('application/json') ||
      req.is?.('application/json')
    if (!result.ok) {
      if (wants) return res.status(result.status).json({ ok: false, error: result.message, code: result.code })
      const q = result.code === 'locked' ? 'locked=1' : result.code === 'revoked' ? 'revoked=1' : 'err=1'
      return res.redirect(303, `/joe/login?${q}`)
    }
    res.setHeader('Set-Cookie', result.cookie)
    if (wants) return res.json({ ok: true, boundIp: result.boundIp })
    res.redirect(303, nextPath(req))
  })

  app.post('/joe/logout', (req, res) => {
    const result = logout(req)
    res.setHeader('Set-Cookie', result.cookie)
    if (String(req.headers.accept || '').includes('application/json')) {
      return res.json({ ok: true })
    }
    res.redirect(303, '/joe/login')
  })

  app.get('/joe/logout', (req, res) => {
    const result = logout(req)
    res.setHeader('Set-Cookie', result.cookie)
    res.redirect(303, '/joe/login')
  })

  app.get('/joe/log', (req, res) => {
    const result = readLog(req.query.key)
    if (!result.ok) return res.status(result.status).type('html').send('Not allowed.')
    if (req.query.format === 'json') {
      return res.set('Cache-Control', 'no-store').json(result)
    }
    res.set('Cache-Control', 'no-store').type('html').send(hostPage(result, req.query.key))
  })

  app.get('/joe/host', (req, res) => {
    const result = readLog(req.query.key)
    if (!result.ok) return res.status(result.status).type('html').send('Not allowed.')
    res.set('Cache-Control', 'no-store').type('html').send(hostPage(result, req.query.key))
  })

  function hostRedirect(req, res, result, message) {
    if (!result.ok) return res.status(result.status).json({ ok: false, error: result.message })
    const wants = String(req.headers.accept || '').includes('application/json') ||
      req.is?.('application/json')
    if (wants) return res.json({ ok: true, message })
    const key = encodeURIComponent(req.body?.key || req.query.key || '')
    res.redirect(303, `/joe/host?key=${key}`)
  }

  app.post('/joe/unlock', (req, res) => {
    const key = req.body?.key || req.query.key
    hostRedirect(req, res, unlock(req, key), 'Unlocked. Joe’s next login binds a new IP.')
  })

  app.post('/joe/revoke', (req, res) => {
    const key = req.body?.key || req.query.key
    hostRedirect(req, res, revoke(req, key), 'Joe’s operator access is off. You still own the desk.')
  })

  app.post('/joe/restore', (req, res) => {
    const key = req.body?.key || req.query.key
    hostRedirect(req, res, restore(req, key), 'Joe can use the desk again. He still does not own it.')
  })
}
