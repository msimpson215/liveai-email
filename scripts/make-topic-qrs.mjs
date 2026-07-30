/**
 * Generate a QR code for every topic in ASK_TOPICS.
 *
 *   npm run qr                              (uses the live site)
 *   BASE_URL=http://localhost:3000 npm run qr
 */
import path from 'path'
import { fileURLToPath } from 'url'
import QRCode from 'qrcode'
import { ASK_TOPICS } from '../server/ask-topics.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.join(__dirname, '..', 'public', 'qr')
const base = (process.env.BASE_URL || 'https://liveai-email.onrender.com').replace(/\/+$/, '')

for (const slug of Object.keys(ASK_TOPICS)) {
  const url = `${base}/ask/${slug}`
  const opts = {
    errorCorrectionLevel: 'H',
    margin: 2,
    color: { dark: '#0a2466ff', light: '#ffffffff' }
  }
  await QRCode.toFile(path.join(outDir, `ask-${slug}.png`), url, { ...opts, width: 1200 })
  await QRCode.toFile(path.join(outDir, `ask-${slug}.svg`), url, { ...opts, type: 'svg' })
  console.log(`ask-${slug}.png / .svg  →  ${url}`)
}
console.log(`\n${Object.keys(ASK_TOPICS).length} topic(s) done.`)
