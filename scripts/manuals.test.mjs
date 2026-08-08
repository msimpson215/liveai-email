/**
 * Checks the talk-me-through-it side: a manual goes in, a page and a code for
 * the box come out, and the assistant is handed the real text.
 *
 *   node scripts/manuals.test.mjs
 *
 * Runs a real server with no OpenAI key, so everything except the model call
 * is exercised. The PDF is generated here rather than fetched, so the test does
 * not depend on somebody else's website staying up.
 */
import fs from 'fs'
import path from 'path'
import { spawn } from 'child_process'
import { fileURLToPath } from 'url'
import { PNG } from 'pngjs'
import jsQR from '../node_modules/jsqr/dist/jsQR.js'
import * as manuals from '../server/manuals.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const PORT = 3213
const base = `http://127.0.0.1:${PORT}`

const failures = []
const check = (name, ok, detail) => {
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${name}${detail ? ' — ' + detail : ''}`)
  if (!ok) failures.push(name)
}

const STEPS = [
  'OWNERS MANUAL',
  'TEST-9000: 30 Inch Safety Bed Rail',
  'WARNING: Do not assemble or use until you have read the entrapment prevention guidelines.',
  'Maximum user weight: 300lbs (136kg).',
  'ASSEMBLY INSTRUCTIONS',
  'Step 1. Slide the Base A under the mattress with the uprights facing the ceiling.',
  'Step 2. Attach the Rail B to the Base A using the two bolts C and tighten with the hex key D.',
  'Step 3. Extend the Safety Strap G under the mattress to the far side of the bed.',
  'Step 4. Loop the strap around the bed frame, re-buckle and tighten until there is no slack.',
  'Step 5. Check there is no gap between the mattress and the rail before use.',
  'For questions contact the manufacturer at (800) 555-0101.'
]

async function makePdf() {
  const { default: PDFDocument } = await import('pdfkit')
  const doc = new PDFDocument()
  const chunks = []
  doc.on('data', c => chunks.push(c))
  for (const line of STEPS) doc.fontSize(12).text(line).moveDown(0.4)
  doc.end()
  await new Promise(r => doc.on('end', r))
  return Buffer.concat(chunks)
}

const server = spawn('node', ['server/server.js'], {
  cwd: ROOT,
  env: { ...process.env, PORT: String(PORT), OPENAI_API_KEY: '' },
  stdio: ['ignore', 'pipe', 'pipe']
})
const log = []
server.stdout.on('data', d => log.push(String(d)))
server.stderr.on('data', d => log.push(String(d)))

async function waitForServer() {
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch(`${base}/api/manual`)
      if (r.ok) return
    } catch { /* not up yet */ }
    await new Promise(r => setTimeout(r, 250))
  }
  throw new Error('server never came up:\n' + log.join(''))
}

let slug = ''

try {
  await waitForServer()

  /* --- a manual goes in --- */
  const body = new FormData()
  body.append('file', new Blob([await makePdf()], { type: 'application/pdf' }), 'test-bed-rail.pdf')
  const added = await (await fetch(`${base}/api/manual`, { method: 'POST', body })).json()
  slug = added.slug
  check('a PDF manual is read', added.ok && added.chars > 200, JSON.stringify(added))
  check('it is named from the document, not the filename',
    added.title === 'TEST-9000: 30 Inch Safety Bed Rail', String(added.title))

  /* --- the assistant gets the actual steps --- */
  const block = manuals.promptBlock(slug)
  check('every step reaches the assistant', STEPS.every(line => block.includes(line.slice(0, 40))))
  check('so does the phone number for when it goes wrong', block.includes('(800) 555-0101'))
  check('and it is told to use nothing else', /and nowhere else/.test(block))

  /* --- the page you land on --- */
  const page = await (await fetch(`${base}/manual/${slug}`)).text()
  check('the page names the product', page.includes('TEST-9000: 30 Inch Safety Bed Rail'))
  check('the page knows which manual to load', page.includes(`SLUG='${slug}'`))
  check('nothing is left unfilled in the template', !/__MANUAL_(SLUG|TITLE)__/.test(page))
  check('it tells you how to drive it', /say <b>next<\/b>/i.test(page))

  /* --- the code for the box --- */
  const qrRes = await fetch(`${base}/qr/manual/${slug}.png`)
  check('a code is drawn on request', qrRes.ok && (qrRes.headers.get('content-type') || '').includes('png'))
  const png = PNG.sync.read(Buffer.from(await qrRes.arrayBuffer()))
  const scan = jsQR(new Uint8ClampedArray(png.data), png.width, png.height)
  check('scanning it opens this manual', scan && scan.data === `${base}/manual/${slug}`, scan && scan.data)

  /* --- things that do not exist --- */
  const missing = await fetch(`${base}/manual/not-a-real-manual`, { redirect: 'manual' })
  check('an unknown manual sends you to the upload page', missing.status === 404 || missing.status === 302)
  check('and no code is drawn for it', (await fetch(`${base}/qr/manual/not-a-real-manual.png`)).status === 404)

  /* --- a file with no text in it --- */
  const junk = new FormData()
  junk.append('file', new Blob([Buffer.from([0x89, 0x50, 0x4e, 0x47])], { type: 'image/png' }), 'photo.png')
  const rejected = await (await fetch(`${base}/api/manual`, { method: 'POST', body: junk })).json()
  check('a photo of a page is refused with an explanation',
    !rejected.ok && /cannot read|no readable text|PDF, Word/i.test(rejected.error), JSON.stringify(rejected))
} catch (error) {
  console.error(error)
  failures.push('threw')
} finally {
  if (slug) manuals.remove(slug)
  server.kill('SIGTERM')
}

console.log(failures.length ? `\n${failures.length} failed` : '\nall good')
process.exit(failures.length ? 1 : 0)
