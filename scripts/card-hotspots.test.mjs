/**
 * Proves the card pages make finished artwork functional without changing it.
 *
 *   npm i --no-save playwright pngjs jsqr   (test-only, as with the voice tests)
 *   node scripts/card-hotspots.test.mjs
 *
 * Stand-in artwork is generated here (the real PNGs are Canva files that live
 * in public/art), each card page is loaded in a real browser, and the rendered
 * result is screenshotted and scanned the way a phone camera would scan it. A
 * pass means: the orb is a link, and the code on screen resolves to the target
 * URL even when the code printed in the artwork points somewhere else.
 */
import fs from 'fs'
import http from 'http'
import os from 'os'
import path from 'path'
import { fileURLToPath } from 'url'
import QRCode from 'qrcode'
import { PNG } from 'pngjs'
import jsQR from '../node_modules/jsqr/dist/jsQR.js'
import { chromium } from 'playwright'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PUBLIC = path.join(__dirname, '..', 'public')
const TARGET = 'https://liveai-email.onrender.com/mentor'
const WIDTH = 819
const HEIGHT = 1024

const art = fs.mkdtempSync(path.join(os.tmpdir(), 'card-art-'))
const failures = []
const check = (name, ok, detail) => {
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${name}${detail ? ' — ' + detail : ''}`)
  if (!ok) failures.push(name)
}

/* ---------- stand-in artwork ---------- */

/** Where the fixtures put things, in artwork pixels. */
const PRINTED = {
  combo: { orb: { x: 62, y: 317, d: 328 }, qr: { x: 480, y: 340, size: 278 } },
  orbOnly: { orb: { x: 235, y: 300, d: 350 } },
  qrOnly: { qr: { x: 228, y: 338, size: 357 } }
}

async function qrDataUrl(text, margin = 0) {
  return QRCode.toDataURL(text, { errorCorrectionLevel: 'H', margin, width: 900 })
}

function fixtureHtml(parts) {
  return `<!doctype html><meta charset="utf-8"><style>
    html,body{margin:0}
    body{width:${WIDTH}px;height:${HEIGHT}px;background:#fbfdff;position:relative;overflow:hidden}
    .orb{position:absolute;border-radius:50%;
      background:radial-gradient(circle at 36% 30%,#7fb6ff,#0a4fd6 62%,#062f80)}
    .qr{position:absolute;background:#fff}
    .qr img{display:block;width:100%;height:100%}
  </style>${parts}`
}

async function makeFixtures(browser) {
  const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT } })

  const orbEl = o => `<div class="orb" style="left:${o.x}px;top:${o.y}px;width:${o.d}px;height:${o.d}px"></div>`
  const qrEl = (q, src) =>
    `<div class="qr" style="left:${q.x}px;top:${q.y}px;width:${q.size}px;height:${q.size}px"><img src="${src}"></div>`

  // The printed code here points at the wrong place on purpose: the page has to
  // cover it with a working one.
  const stale = await qrDataUrl('https://example.com/old-link-from-the-designer')
  const good = await qrDataUrl(TARGET)

  const shots = [
    ['mbm-combo.png', fixtureHtml(orbEl(PRINTED.combo.orb) + qrEl(PRINTED.combo.qr, stale))],
    ['mbm-orb.png', fixtureHtml(orbEl(PRINTED.orbOnly.orb))],
    // This one already carries the right link, so the page must leave it alone.
    ['mbm-qr.png', fixtureHtml(qrEl(PRINTED.qrOnly.qr, good))]
  ]
  for (const [name, html] of shots) {
    await page.setContent(html)
    await page.waitForLoadState('networkidle')
    await page.screenshot({ path: path.join(art, name) })
  }
  await page.close()
}

/* ---------- serve public/, with the stand-in artwork standing in ---------- */

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' }

function serve() {
  const server = http.createServer((req, res) => {
    const url = req.url.split('?')[0]
    const file = url.startsWith('/art/')
      ? path.join(art, path.basename(url))
      : path.join(PUBLIC, url.replace(/^\/+/, ''))
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404).end('not found')
      return
    }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' })
    fs.createReadStream(file).pipe(res)
  })
  return new Promise(resolve => server.listen(0, () => resolve(server)))
}

/* ---------- read the page back the way a camera would ---------- */

function scanPng(buffer) {
  const png = PNG.sync.read(buffer)
  const found = jsQR(new Uint8ClampedArray(png.data), png.width, png.height, { inversionAttempts: 'dontInvert' })
  return found && found.data
}

const covers = (outer, inner) =>
  outer.x <= inner.x && outer.y <= inner.y &&
  outer.x + outer.width >= inner.x + inner.width &&
  outer.y + outer.height >= inner.y + inner.height

async function run() {
  const browser = await chromium.launch()
  await makeFixtures(browser)
  const server = await serve()
  const base = `http://127.0.0.1:${server.address().port}`
  const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1 })
  page.on('pageerror', err => check('no page errors', false, err.message))

  /* --- combo: orb links, stale printed code gets covered --- */
  await page.goto(`${base}/cards/mbm-combo.html`)
  await page.waitForSelector('.orb')
  await page.waitForSelector('.qr', { timeout: 15000 })

  const orb = await page.locator('.orb').boundingBox()
  const printedOrb = PRINTED.combo.orb
  const orbCentre = { x: orb.x + orb.width / 2, y: orb.y + orb.height / 2 }
  const drawnCentre = { x: printedOrb.x + printedOrb.d / 2, y: printedOrb.y + printedOrb.d / 2 }
  const drift = Math.hypot(orbCentre.x - drawnCentre.x, orbCentre.y - drawnCentre.y)
  check('combo: orb hotspot sits on the orb', drift < printedOrb.d * 0.1, `centre off by ${drift.toFixed(0)}px`)
  check('combo: orb hotspot is round', Math.abs(orb.width - orb.height) < 2)
  check('combo: orb opens the mentor', (await page.locator('.orb').getAttribute('href')) === TARGET)

  const cover = await page.locator('.qr').boundingBox()
  const printedQr = { x: PRINTED.combo.qr.x, y: PRINTED.combo.qr.y, width: PRINTED.combo.qr.size, height: PRINTED.combo.qr.size }
  check('combo: the printed code is fully covered', covers(cover, printedQr),
    `cover ${JSON.stringify(cover)} vs printed ${JSON.stringify(printedQr)}`)
  check('combo: cover is not oversized', cover.width < printedQr.width * 1.3)

  const comboScan = scanPng(await page.screenshot())
  check('combo: what a phone reads on screen is the mentor link', comboScan === TARGET, String(comboScan))

  /* --- orb only: nothing but the orb --- */
  await page.goto(`${base}/cards/mbm-orb.html`)
  await page.waitForSelector('.orb')
  const orbOnly = await page.locator('.orb').boundingBox()
  const o2 = PRINTED.orbOnly.orb
  const drift2 = Math.hypot(orbOnly.x + orbOnly.width / 2 - (o2.x + o2.d / 2), orbOnly.y + orbOnly.height / 2 - (o2.y + o2.d / 2))
  check('orb card: hotspot sits on the orb', drift2 < o2.d * 0.1, `centre off by ${drift2.toFixed(0)}px`)
  check('orb card: no QR is added', (await page.locator('.qr').count()) === 0)

  /* --- qr only: printed code already correct, so leave the artwork be --- */
  await page.goto(`${base}/cards/mbm-qr.html`)
  await page.waitForSelector('.qr-passthrough', { timeout: 15000 })
  check('qr card: a correct printed code is left alone', (await page.locator('.qr').count()) === 0)
  check('qr card: tapping the code still opens the mentor',
    (await page.locator('.qr-passthrough').getAttribute('href')) === TARGET)
  const qrScan = scanPng(await page.screenshot())
  check('qr card: what a phone reads on screen is the mentor link', qrScan === TARGET, String(qrScan))

  /* --- artwork not uploaded yet: say so instead of showing nothing --- */
  fs.renameSync(path.join(art, 'mbm-orb.png'), path.join(art, 'held.png'))
  await page.goto(`${base}/cards/mbm-orb.html`)
  await page.waitForSelector('.missing', { timeout: 5000 }).catch(() => {})
  check('missing artwork explains itself', (await page.locator('.missing').count()) === 1)
  fs.renameSync(path.join(art, 'held.png'), path.join(art, 'mbm-orb.png'))

  await browser.close()
  server.close()
  fs.rmSync(art, { recursive: true, force: true })

  console.log(failures.length ? `\n${failures.length} failed` : '\nall good')
  process.exit(failures.length ? 1 : 0)
}

run().catch(err => {
  console.error(err)
  process.exit(1)
})
