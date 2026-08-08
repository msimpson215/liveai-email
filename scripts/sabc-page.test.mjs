/**
 * Checks the StartABusiness.Center page sits correctly on the finished artwork.
 *
 *   npm i --no-save playwright   (test-only, as with the other browser tests)
 *   node scripts/sabc-page.test.mjs
 *
 * Stand-in artwork is generated at the same proportions as Tim's PNG, with the
 * orb and the two buttons where the real ones are. The page is then loaded in a
 * real browser and the hotspots are measured against what is drawn — because a
 * button you cannot hit is the same as a button that does not work.
 */
import fs from 'fs'
import http from 'http'
import os from 'os'
import path from 'path'
import { fileURLToPath } from 'url'
import { chromium } from 'playwright'
import { keyFor, forget } from '../server/founder-file.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PUBLIC = path.join(__dirname, '..', 'public')
const WIDTH = 768
const HEIGHT = 1024

/* Where the real artwork puts things, in artwork pixels. */
const DRAWN = {
  orb: { x: 218, y: 286, d: 367 },
  upload: { x: 105, y: 822, w: 285, h: 57 },
  review: { x: 400, y: 822, w: 295, h: 57 }
}

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

async function makeFixture(browser) {
  const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT } })
  const btn = (b, label) =>
    `<div class="b" style="left:${b.x}px;top:${b.y}px;width:${b.w}px;height:${b.h}px">${label}</div>`
  await page.setContent(`<!doctype html><meta charset="utf-8"><style>
    html,body{margin:0}
    body{width:${WIDTH}px;height:${HEIGHT}px;background:#faf8f5;position:relative;overflow:hidden;
      font-family:Helvetica,Arial,sans-serif}
    .orb{position:absolute;left:${DRAWN.orb.x}px;top:${DRAWN.orb.y}px;width:${DRAWN.orb.d}px;height:${DRAWN.orb.d}px;
      border-radius:50%;background:radial-gradient(circle at 38% 30%,#7fb6ff,#0a4fd6 60%,#062f80)}
    .b{position:absolute;border:1px solid #dcd6cd;border-radius:14px;background:#fff;
      display:flex;align-items:center;justify-content:center;font-size:15px;color:#12203a}
  </style>
  <div class="orb"></div>
  ${btn(DRAWN.upload, 'Upload Documents')}
  ${btn(DRAWN.review, 'My Business Review')}`)
  await page.screenshot({ path: path.join(art, 'sabc-orb.png') })
  await page.close()
}

const inside = (hot, drawn) => {
  const cx = hot.x + hot.width / 2
  const cy = hot.y + hot.height / 2
  return cx > drawn.x && cx < drawn.x + (drawn.w || drawn.d) && cy > drawn.y && cy < drawn.y + (drawn.h || drawn.d)
}

async function run() {
  const browser = await chromium.launch()
  await makeFixture(browser)
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
  await page.waitForSelector('#orbHot')

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
    [...el.children].filter(child => child.tagName !== 'IMG').map(child => {
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

  /* Missing artwork says so rather than showing a blank page. */
  fs.renameSync(path.join(art, 'sabc-orb.png'), path.join(art, 'held.png'))
  await page.goto(`${base}/sabc.html`)
  await page.waitForSelector('.missing', { timeout: 5000 }).catch(() => {})
  check('missing artwork explains itself', await page.locator('.missing').count() === 1)

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
