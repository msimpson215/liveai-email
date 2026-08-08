/**
 * Checks the StartABusiness.Center page sits correctly on the finished artwork.
 *
 *   npm i --no-save playwright   (test-only, as with the other browser tests)
 *   node scripts/sabc-page.test.mjs
 *
 * Runs against the real artwork in public/art. The positions below were measured
 * off those files pixel by pixel (scripts/measure-card.mjs), and the page is
 * loaded in a real browser to check the invisible controls land on the drawn
 * ones — because a button you cannot hit is the same as a button that does not
 * work. The QR card is also scanned the way a phone camera would scan it.
 */
import fs from 'fs'
import http from 'http'
import os from 'os'
import path from 'path'
import { fileURLToPath } from 'url'
import { PNG } from 'pngjs'
import jsQR from '../node_modules/jsqr/dist/jsQR.js'
import { chromium } from 'playwright'
import { keyFor, forget } from '../server/founder-file.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PUBLIC = path.join(__dirname, '..', 'public')
/* Measured off public/art/sabc-orb.png (1086x1448) and sabc-qr.png (941x1672). */
const WIDTH = 1086
const HEIGHT = 1448
const DRAWN = {
  orb: { x: 274, y: 373, d: 582 },
  upload: { x: 151, y: 1155, w: 401, h: 94 },
  review: { x: 585, y: 1155, w: 400, h: 94 }
}
const QR_CARD = { width: 941, height: 1672, modules: { x: 187, y: 477, w: 567, h: 552 } }

const art = fs.mkdtempSync(path.join(os.tmpdir(), 'sabc-art-'))
const failures = []
const check = (name, ok, detail) => {
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${name}${detail ? ' — ' + detail : ''}`)
  if (!ok) failures.push(name)
}

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' }

function serve() {
  const server = http.createServer((req, res) => {
    const url = req.url.split('?')[0]
    // The page talks to endpoints this harness does not run; answer the few it
    // needs so the browser side can be exercised on its own.
    if (url === '/api/sabc/profile') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      return res.end(JSON.stringify({ ok: true, total: 101, answered: 7, docs: 1, sessions: 2 }))
    }
    if (url === '/api/sabc/review') {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      return res.end(JSON.stringify({ ok: false, error: 'Talk with me about your business first, then I can write the review.' }))
    }
    const file = url.startsWith('/art/') ? path.join(art, path.basename(url)) : path.join(PUBLIC, url.replace(/^\/+/, ''))
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404).end('not found')
      return
    }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' })
    fs.createReadStream(file).pipe(res)
  })
  return new Promise(resolve => server.listen(0, () => resolve(server)))
}

/* The real files, served exactly as the site serves them. */
function useRealArtwork() {
  for (const name of ['sabc-orb.png', 'sabc-qr.png']) {
    const from = path.join(PUBLIC, 'art', name)
    if (!fs.existsSync(from)) throw new Error(`missing artwork: ${from}`)
    fs.copyFileSync(from, path.join(art, name))
  }
}

function scanPng(buffer) {
  const png = PNG.sync.read(buffer)
  const found = jsQR(new Uint8ClampedArray(png.data), png.width, png.height, { inversionAttempts: 'dontInvert' })
  return found && found.data
}

const inside = (hot, drawn) => {
  const cx = hot.x + hot.width / 2
  const cy = hot.y + hot.height / 2
  return cx > drawn.x && cx < drawn.x + (drawn.w || drawn.d) && cy > drawn.y && cy < drawn.y + (drawn.h || drawn.d)
}

async function run() {
  const browser = await chromium.launch()
  useRealArtwork()
  const server = await serve()
  const base = `http://127.0.0.1:${server.address().port}`
  const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT + 260 }, deviceScaleFactor: 1 })
  // Script failures only. The review button is expected to be told "not yet",
  // and a rejected request logs a console error that is not a page fault.
  const errors = []
  page.on('pageerror', e => errors.push(e.message))
  page.on('console', m => {
    if (m.type() === 'error' && !/status of 4\d\d/.test(m.text())) errors.push(m.text())
  })

  await page.goto(`${base}/sabc.html`)
  // Render at the artwork's own size so hotspot boxes can be compared with the
  // pixel positions measured off the file.
  await page.addStyleTag({ content: '.stage{max-width:none !important}' })
  await page.waitForSelector('#orbHot')
  await page.waitForTimeout(300)

  const orb = await page.locator('#orbHot').boundingBox()
  const orbCentre = { x: orb.x + orb.width / 2, y: orb.y + orb.height / 2 }
  const drawnCentre = { x: DRAWN.orb.x + DRAWN.orb.d / 2, y: DRAWN.orb.y + DRAWN.orb.d / 2 }
  const drift = Math.hypot(orbCentre.x - drawnCentre.x, orbCentre.y - drawnCentre.y)
  check('the orb hotspot sits on the orb', drift < DRAWN.orb.d * 0.08, `centre off by ${drift.toFixed(0)}px`)
  check('the orb hotspot is round and the right size',
    Math.abs(orb.width - orb.height) < 2 && Math.abs(orb.width - DRAWN.orb.d) < DRAWN.orb.d * 0.1,
    `${orb.width.toFixed(0)}px vs ${DRAWN.orb.d}px`)

  const upload = await page.locator('#uploadHot').boundingBox()
  const review = await page.locator('#reviewHot').boundingBox()
  check('Upload Documents is hittable', inside(upload, DRAWN.upload), JSON.stringify(upload))
  check('My Business Review is hittable', inside(review, DRAWN.review), JSON.stringify(review))
  check('the two buttons do not overlap', upload.x + upload.width < review.x)
  check('the hotspots are invisible', await page.locator('#uploadHot').evaluate(el => {
    const s = getComputedStyle(el)
    return s.backgroundColor === 'rgba(0, 0, 0, 0)' && s.borderTopWidth === '0px'
  }))

  /* Nothing may be painted on, over or around the artwork — the orb especially. */
  const paint = await page.locator('#stage').evaluate(el =>
    [...el.children].filter(child => child.tagName !== 'IMG' && getComputedStyle(child).display !== 'none').map(child => {
      const s = getComputedStyle(child)
      return {
        tag: child.id || child.tagName,
        background: s.backgroundColor,
        image: s.backgroundImage,
        shadow: s.boxShadow,
        outline: s.outlineStyle,
        border: s.borderTopWidth,
        opacity: s.opacity
      }
    }))
  const painted = paint.filter(p =>
    p.background !== 'rgba(0, 0, 0, 0)' || p.image !== 'none' || p.shadow !== 'none' ||
    (p.outline !== 'none' && p.outline !== '') || p.border !== '0px')
  check('nothing is drawn on the artwork', painted.length === 0, JSON.stringify(painted))
  check('the only thing over the image is invisible hotspots', paint.length === 3, JSON.stringify(paint.map(p => p.tag)))
  check('the fallback notice stays hidden when the artwork is there',
    await page.locator('#missing').isHidden())

  /* The artwork must be shown as delivered, at its own proportions. */
  const shown = await page.locator('#art').evaluate(el => ({ w: el.clientWidth, h: el.clientHeight, nw: el.naturalWidth, nh: el.naturalHeight }))
  check('the artwork keeps its proportions',
    Math.abs((shown.w / shown.h) - (shown.nw / shown.nh)) < 0.01, JSON.stringify(shown))

  /* What the person is told, and the code that carries them forward. */
  await page.waitForFunction(() => /code/.test(document.querySelector('#row').textContent), null, { timeout: 8000 })
  const row = await page.locator('#row').textContent()
  check('the code and their progress are shown', /7 of 101 covered/.test(row) && /1 document/.test(row), row.replace(/\s+/g, ' ').slice(0, 120))
  check('the profile can be downloaded and reloaded', /Download my business profile/.test(row) && /Load a profile/.test(row))
  check('they can erase everything', /Erase everything/.test(row))

  await page.locator('#reviewHot').click()
  await page.waitForFunction(() => /business first/.test(document.querySelector('#status').textContent), null, { timeout: 8000 })
  check('the review button reports back in plain language',
    /Talk with me about your business first/.test(await page.locator('#status').textContent()))

  check('the upload button opens a file picker', await page.locator('#docInput').count() === 1)
  check('no page errors', errors.length === 0, errors.join(' | '))

  /* --- the QR card: the printed code is decorative, so it must be covered --- */
  const qrPage = await browser.newPage({ viewport: { width: QR_CARD.width, height: QR_CARD.height }, deviceScaleFactor: 1 })
  await qrPage.goto(`${base}/cards/sabc-qr.html`)
  await qrPage.addStyleTag({ content: '.stage{max-width:none !important}' })   // render at the file's own size
  await qrPage.waitForSelector('.qr', { timeout: 20000 })
  await qrPage.waitForTimeout(400)
  const artBox = await qrPage.locator('.art').boundingBox()
  const cover = await qrPage.locator('.qr').boundingBox()
  const rel = { x: cover.x - artBox.x, y: cover.y - artBox.y, width: cover.width, height: cover.height }
  const m = QR_CARD.modules
  check('the working code covers the printed one',
    rel.x <= m.x && rel.y <= m.y && rel.x + rel.width >= m.x + m.w && rel.y + rel.height >= m.y + m.h,
    JSON.stringify(rel))
  check('and stays inside the printed frame',
    rel.x > 150 && rel.y > 430 && rel.x + rel.width < 800 && rel.y + rel.height < 1075, JSON.stringify(rel))
  const shot = await qrPage.screenshot({ fullPage: true })
  const scan = scanPng(shot)
  check('a phone reading the card gets the live page', scan === 'https://liveai-email.onrender.com/start', String(scan))
  check('both printed buttons on the card are live', await qrPage.locator('a.printed').count() === 2)
  await qrPage.close()

  /* Missing artwork says so rather than showing a blank page. */
  await page.route('**/art/sabc-orb.png', route => route.fulfill({ status: 404, body: 'gone' }))
  await page.goto(`${base}/sabc.html`)
  await page.waitForSelector('body.noart', { timeout: 5000 }).catch(() => {})
  check('missing artwork explains itself', await page.locator('#missing').isVisible())
  // Nothing stands in for the artwork: no controls, no stand-in orb, no layout
  // that could be mistaken for a design.
  check('nothing stands in for the artwork',
    !(await page.locator('#orbHot').isVisible()) &&
    !(await page.locator('#uploadHot').isVisible()) &&
    !(await page.locator('#reviewHot').isVisible()) &&
    !(await page.locator('#art').isVisible()))
  check('it says plainly that nothing was substituted',
    /Nothing has been designed, drawn or substituted/.test(await page.locator('#missing').innerText()))
  check('it offers the plain test page instead',
    (await page.locator('#missing a').nth(1).getAttribute('href')) === '/talk-to-the-consultant')
  check('it points at the right drop page',
    (await page.locator('#missing a').first().getAttribute('href')) === '/cards/sabc-artwork.html')

  await browser.close()
  server.close()
}

try {
  await run()
} catch (error) {
  console.error(error)
  failures.push('threw')
} finally {
  fs.rmSync(art, { recursive: true, force: true })
  forget(keyFor('sabc-page-test'))
}

console.log(failures.length ? `\n${failures.length} failed` : '\nall good')
process.exit(failures.length ? 1 : 0)
