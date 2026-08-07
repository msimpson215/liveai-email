/**
 * Generate a printable QR code PNG for any Axon page.
 *
 *   node scripts/make-qr.mjs <url> <output-name> [quiet-zone-modules]
 *
 * High error correction so it still scans after printing, taping to a
 * clipboard, or getting scuffed in a waiting room. Pass 0 for the quiet zone
 * when the code is being laid over artwork that already leaves white space
 * around it.
 */
import path from 'path'
import { fileURLToPath } from 'url'
import QRCode from 'qrcode'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.join(__dirname, '..', 'public', 'qr')

const url = process.argv[2]
const name = process.argv[3] || 'qr'
const margin = process.argv[4] === undefined ? 2 : Number(process.argv[4])
if (!url || Number.isNaN(margin)) {
  console.error('Usage: node scripts/make-qr.mjs <url> [output-name] [quiet-zone-modules]')
  process.exit(1)
}

const out = path.join(outDir, `${name}.png`)
await QRCode.toFile(out, url, {
  errorCorrectionLevel: 'H',
  margin,
  width: 1200,
  color: { dark: '#000000ff', light: '#ffffffff' }
})
console.log('wrote', out, '→', url)

const svgOut = path.join(outDir, `${name}.svg`)
await QRCode.toFile(svgOut, url, {
  type: 'svg',
  errorCorrectionLevel: 'H',
  margin,
  color: { dark: '#000000ff', light: '#ffffffff' }
})
console.log('wrote', svgOut, '(vector, for print)')
