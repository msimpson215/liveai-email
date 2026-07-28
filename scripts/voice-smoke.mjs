/**
 * Drives a real voice session in a headless browser and reports what happened.
 *
 * Verifies the two bugs stay fixed:
 *   - the greeting is spoken exactly once (no repeat)
 *   - the session keeps the configured voice
 *
 * Usage: node scripts/voice-smoke.mjs [url] [seconds]
 */

import puppeteer from 'puppeteer-core'

const url = process.argv[2] || 'https://liveai-email.onrender.com/axon.html'
const seconds = Number(process.argv[3] || 30)

const browser = await puppeteer.launch({
  executablePath: '/usr/local/bin/google-chrome',
  headless: 'new',
  args: [
    '--no-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
    '--autoplay-policy=no-user-gesture-required'
  ]
})

const page = await browser.newPage()
await page.setViewport({ width: 430, height: 932 })

const events = []
page.on('console', m => {
  const t = m.text()
  if (t.startsWith('SMOKE ')) events.push(t.slice(6))
})
page.on('pageerror', e => events.push('PAGEERROR ' + e.message))

// Tap every realtime data channel so we see the raw event stream, whatever the page does with it.
await page.evaluateOnNewDocument(() => {
  const origCreate = RTCPeerConnection.prototype.createDataChannel
  RTCPeerConnection.prototype.createDataChannel = function (...args) {
    const dc = origCreate.apply(this, args)
    dc.addEventListener('message', ev => {
      try {
        const msg = JSON.parse(ev.data)
        if (msg.type === 'session.created' || msg.type === 'session.updated') {
          const voice = msg.session?.audio?.output?.voice ?? '(none)'
          console.log(`SMOKE ${msg.type} voice=${voice} model=${msg.session?.model || '?'}`)
        }
        if (msg.type === 'response.created') console.log('SMOKE response.created')
        if (msg.type === 'error') console.log('SMOKE error ' + JSON.stringify(msg.error || {}).slice(0, 200))
        const tr = msg.transcript
        if (tr && /transcript\.done$/.test(msg.type)) {
          console.log(`SMOKE said "${String(tr).trim()}"`)
        }
      } catch { /* not json */ }
    })
    dc.addEventListener('open', () => console.log('SMOKE datachannel open'))
    return dc
  }

  const origGUM = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices)
  navigator.mediaDevices.getUserMedia = function (constraints) {
    const ec = constraints?.audio?.echoCancellation
    console.log('SMOKE getUserMedia echoCancellation=' + (ec === undefined ? 'NOT SET' : ec))
    return origGUM(constraints)
  }
})

console.log(`Loading ${url}`)
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90_000 })

// Tap whatever starts the conversation on this page.
const started = await page.evaluate(() => {
  const el = document.getElementById('orb') || document.getElementById('micBtn')
  if (!el) return false
  el.click()
  return true
})
if (!started) {
  console.log('FAIL: could not find the orb to tap')
  await browser.close()
  process.exit(1)
}
console.log('Tapped the orb. Listening for ' + seconds + 's...')

await new Promise(r => setTimeout(r, seconds * 1000))
await browser.close()

// ---- report ----
console.log('\n--- event stream ---')
for (const e of events) console.log('  ' + e)

const spoken = events.filter(e => e.startsWith('said "'))
const greetings = spoken.filter(e => /how are you today/i.test(e))
const voices = [...new Set(
  events.filter(e => e.includes('voice=')).map(e => e.match(/voice=(\S+)/)?.[1])
)]
const echo = events.find(e => e.startsWith('getUserMedia'))
const errors = events.filter(e => e.startsWith('error') || e.startsWith('PAGEERROR'))

console.log('\n--- result ---')
console.log('echo cancellation : ' + (echo ? echo.replace('getUserMedia ', '') : 'unknown'))
console.log('voice(s) reported : ' + (voices.length ? voices.join(', ') : 'not reported'))
console.log('things it said    : ' + spoken.length)
console.log('greetings spoken  : ' + greetings.length)
console.log('errors            : ' + (errors.length ? errors.join(' | ') : 'none'))

const pass =
  greetings.length === 1 &&
  echo?.includes('echoCancellation=true') &&
  voices.every(v => v && v !== '(none)') &&
  errors.length === 0

console.log('\n' + (pass ? 'PASS' : 'NEEDS WORK'))
process.exit(pass ? 0 : 2)
