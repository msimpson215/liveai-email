/**
 * Checks the founder's private file end to end: upload a document, have the
 * brain see it, get a PDF write-up, and erase it.
 *
 *   node scripts/founder-file.test.mjs
 *
 * Runs against a real server process with no OpenAI key, so it covers the
 * storage, the isolation between codes, and the PDF — everything except the
 * model call that writes the prose.
 */
import fs from 'fs'
import path from 'path'
import { spawn } from 'child_process'
import { fileURLToPath } from 'url'
import * as founderFile from '../server/founder-file.js'
import { directImageUrl, refuseInternal } from '../server/image-links.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const PORT = 3211
const base = `http://127.0.0.1:${PORT}`
const MINE = 'test-founder-aaa'
const THEIRS = 'test-founder-bbb'

const failures = []
const check = (name, ok, detail) => {
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${name}${detail ? ' — ' + detail : ''}`)
  if (!ok) failures.push(name)
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
      const r = await fetch(`${base}/api/founder/status?code=${MINE}`)
      if (r.status) return
    } catch { /* not up yet */ }
    await new Promise(r => setTimeout(r, 250))
  }
  throw new Error('server never came up:\n' + log.join(''))
}

const PL = [
  'Line,Amount',
  'Revenue,18400',
  'Ingredients,7100',
  'Delivery,2050',
  'Kitchen rent,600',
  'Net,8650'
].join('\n')

async function run() {
  await waitForServer()

  /* --- a code is required; nothing is ever pooled into a shared file --- */
  const noCode = await fetch(`${base}/api/founder/status`)
  check('a missing code is refused', noCode.status === 400)
  const shortCode = await fetch(`${base}/api/founder/status?code=ab`)
  check('a too-short code is refused', shortCode.status === 400)

  /* --- upload a document --- */
  const body = new FormData()
  body.append('code', MINE)
  body.append('file', new Blob([PL], { type: 'text/csv' }), 'august-pl.csv')
  const up = await fetch(`${base}/api/founder/doc`, { method: 'POST', body })
  const upData = await up.json()
  check('a CSV uploads', up.ok && upData.ok, JSON.stringify(upData))
  check('the document is on file', upData.docs === 1)

  const status = await (await fetch(`${base}/api/founder/status?code=${MINE}`)).json()
  check('status lists it by name', status.docs?.[0]?.name === 'august-pl.csv', JSON.stringify(status.docs))

  /* --- a PDF, which is what people actually have --- */
  const { default: PDFDocument } = await import('pdfkit')
  const made = new PDFDocument()
  const chunks = []
  made.on('data', c => chunks.push(c))
  made.fontSize(12).text('Quarterly numbers: revenue 41200, cost of goods 19800.')
  made.end()
  await new Promise(r => made.on('end', r))
  const pdfBody = new FormData()
  pdfBody.append('code', MINE)
  pdfBody.append('file', new Blob([Buffer.concat(chunks)], { type: 'application/pdf' }), 'q3.pdf')
  const pdfUp = await (await fetch(`${base}/api/founder/doc`, { method: 'POST', body: pdfBody })).json()
  check('a PDF uploads and is read', pdfUp.ok && pdfUp.chars > 20, JSON.stringify(pdfUp))
  check('the PDF text reaches the brain', founderFile.docsSnippet(founderFile.keyFor(MINE)).includes('41200'))

  /* --- the brain is told the real figures --- */
  const snippet = founderFile.docsSnippet(founderFile.keyFor(MINE))
  check('the brain sees their numbers', snippet.includes('18400') && snippet.includes('Kitchen rent'))
  check('the brain is told not to invent numbers', /never invent a number/i.test(snippet))

  /* --- one founder's file is not another's --- */
  const theirs = await (await fetch(`${base}/api/founder/status?code=${THEIRS}`)).json()
  check('another code sees nothing', (theirs.docs || []).length === 0)
  check('another code gets an empty prompt block', founderFile.docsSnippet(founderFile.keyFor(THEIRS)).includes('none uploaded'))

  /* --- the printout --- */
  const seeded = founderFile.saveSummary(founderFile.keyFor(MINE), {
    title: 'Session summary — test',
    text: '## Where you are\n- Meal prep business doing about $18,400 a month.\n## Your next steps\n- Raise prices 20 percent for new customers.\n- Take the tax question to a CPA.'
  })
  const pdfRes = await fetch(`${base}/api/founder/summary/${seeded.id}.pdf?code=${MINE}`)
  check('the PDF route answers', pdfRes.ok, `status ${pdfRes.status}`)
  check('it is served as a PDF', (pdfRes.headers.get('content-type') || '').includes('application/pdf'))
  check('it downloads as a file', /attachment; filename=/.test(pdfRes.headers.get('content-disposition') || ''))
  const pdfBuffer = Buffer.from(await pdfRes.arrayBuffer())
  check('the file is a real PDF', pdfBuffer.subarray(0, 5).toString() === '%PDF-', pdfBuffer.subarray(0, 5).toString())

  const { PDFParse } = await import('pdf-parse')
  const parser = new PDFParse({ data: pdfBuffer })
  const parsed = await parser.getText()
  await parser.destroy()
  const text = parsed.text.replace(/\s+/g, ' ')
  check('the write-up is in it', text.includes('Where you are') && text.includes('18,400'), text.slice(0, 120))
  check('the next steps are in it', text.includes('Raise prices 20 percent'))
  check('it says what it is not', /not legal, tax or accounting advice/i.test(text))

  const otherPdf = await fetch(`${base}/api/founder/summary/${seeded.id}.pdf?code=${THEIRS}`)
  check('another code cannot fetch it', otherPdf.status === 404, `status ${otherPdf.status}`)

  /* --- their erase button --- */
  const wiped = await (await fetch(`${base}/api/founder/forget`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: MINE })
  })).json()
  check('erase reports success', wiped.ok && wiped.removed)
  const after = await (await fetch(`${base}/api/founder/status?code=${MINE}`)).json()
  check('nothing is left afterwards', (after.docs || []).length === 0 && (after.summaries || []).length === 0)

  /* --- a share link points at a viewer page; it has to be turned into the file --- */
  const rewrites = [
    ['https://drive.google.com/file/d/1AbC_dEf/view?usp=sharing', 'drive.google.com/uc?export=download&id=1AbC_dEf'],
    ['https://drive.google.com/open?id=XYZ123', 'id=XYZ123'],
    ['https://www.dropbox.com/s/abc/orb.png?dl=0', 'dl=1'],
    ['https://github.com/user/repo/blob/main/orb.png', 'raw.githubusercontent.com/user/repo/main/orb.png'],
    ['https://example.com/plain/orb.png', 'https://example.com/plain/orb.png']
  ]
  const wrong = rewrites.filter(([from, expect]) => !String(directImageUrl(new URL(from))).includes(expect))
  check('share links become the actual file', wrong.length === 0, wrong.map(w => w[0]).join(' '))

  const internal = ['http://localhost/x.png', 'http://127.0.0.1:22/x.png', 'http://192.168.1.5/x.png',
    'http://169.254.169.254/latest/meta-data', 'http://10.0.0.9/x.png', 'ftp://example.com/x.png']
  const allowed = internal.filter(u => {
    try { refuseInternal(new URL(u)); return true } catch { return false }
  })
  check('links pointing inward are refused', allowed.length === 0, allowed.join(' '))

  /* --- artwork arriving by link, since a browser cannot always hand over a file --- */
  const LIVE_IMAGE = 'https://liveai-email.onrender.com/qr/mbm-ask.png'
  let online = false
  try { online = (await fetch(LIVE_IMAGE, { method: 'HEAD' })).ok } catch { online = false }
  if (online) {
    const linked = await (await fetch(`${base}/api/upload-art`, {
      method: 'POST',
      body: (() => {
        const f = new FormData()
        f.append('as', 'test-linked.png')
        f.append('url', LIVE_IMAGE)
        return f
      })()
    })).json()
    check('artwork can be fetched from a link', linked.ok && linked.name === 'test-linked.png', JSON.stringify(linked))
    check('and lands where the page expects it', fs.existsSync(path.join(ROOT, 'public', 'art', 'test-linked.png')))
    fs.rmSync(path.join(ROOT, 'public', 'art', 'test-linked.png'), { force: true })
  } else {
    console.log('  skip  artwork from a link — no outbound network from this machine')
  }

  const inward = await (await fetch(`${base}/api/upload-art`, {
    method: 'POST',
    body: (() => {
      const f = new FormData()
      f.append('as', 'test-bad.png')
      f.append('url', 'http://127.0.0.1:22/secrets')
      return f
    })()
  })).json()
  check('a link pointing inside the server is refused', !inward.ok && /inside the server/.test(inward.error), JSON.stringify(inward))

  const notImage = await (await fetch(`${base}/api/upload-art`, {
    method: 'POST',
    body: (() => {
      const f = new FormData()
      f.append('as', 'test-page.png')
      f.append('url', 'https://example.com/')
      return f
    })()
  })).json()
  check('a link to a page says what to do instead', !notImage.ok && /not an image/.test(notImage.error), JSON.stringify(notImage))

  /* --- a session with no OpenAI key fails politely rather than crashing --- */
  const summary = await fetch(`${base}/api/founder/summary`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: MINE, turns: [{ role: 'user', text: 'I sell meal prep kits in Denver.' }, { role: 'assistant', text: 'What are you charging?' }] })
  })
  check('a summary without a key fails cleanly', summary.status >= 400 && summary.status < 500, `status ${summary.status}`)
}

try {
  await run()
} catch (error) {
  console.error(error)
  failures.push('threw')
} finally {
  founderFile.forget(founderFile.keyFor(MINE))
  founderFile.forget(founderFile.keyFor(THEIRS))
  server.kill('SIGTERM')
}

console.log(failures.length ? `\n${failures.length} failed` : '\nall good')
process.exit(failures.length ? 1 : 0)
