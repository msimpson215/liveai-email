/**
 * Generate a printable QR code PNG for any Axon page.
 *
 *   node scripts/make-qr.mjs <url> <output-name>
 *
 * High error correction so it still scans after printing, taping to a
 * clipboard, or getting scuffed in a waiting room.
 */
import path from 'path'
import { fileURLToPath } from 'url'
import QRCode from 'qrcode'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.join(__dirname, '..', 'public', 'qr')

const url = process.argv[2]
const name = process.argv[3] || 'qr'
if (!url) {
  console.error('Usage: node scripts/make-qr.mjs <url> [output-name]')
  process.exit(1)
}

const out = path.join(outDir, `${name}.png`)
await QRCode.toFile(out, url, {
  errorCorrectionLevel: 'H',
  margin: 2,
  width: 1200,
  // A friendlier blue than near-black. Still far more contrast than a
  // scanner needs, and verified by decoding the result.
  color: { dark: '#1e40afff', light: '#ffffffff' }
})
console.log('wrote', out, '→', url)

const svgOut = path.join(outDir, `${name}.svg`)
await QRCode.toFile(svgOut, url, {
  type: 'svg',
  errorCorrectionLevel: 'H',
  margin: 2,
  // A friendlier blue than near-black. Still far more contrast than a
  // scanner needs, and verified by decoding the result.
  color: { dark: '#1e40afff', light: '#ffffffff' }
})
console.log('wrote', svgOut, '(vector, for print)')
