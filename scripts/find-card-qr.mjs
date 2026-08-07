/**
 * Measure where the printed QR sits inside a finished card image.
 *
 *   node scripts/find-card-qr.mjs public/art/guides-qr.png
 *
 * Prints the data-qr-box percentages for the card page and what the printed
 * code currently resolves to. The card pages find the code themselves at run
 * time; this is for baking the numbers in as a fallback, and for checking what
 * a designer's code actually points at.
 */
import fs from 'fs'
import path from 'path'
import { PNG } from 'pngjs'
import jsQR from '../node_modules/jsqr/dist/jsQR.js'

const file = process.argv[2]
if (!file) {
  console.error('Usage: node scripts/find-card-qr.mjs <image.png>')
  process.exit(1)
}

const png = PNG.sync.read(fs.readFileSync(file))
const found = jsQR(new Uint8ClampedArray(png.data), png.width, png.height, { inversionAttempts: 'attemptBoth' })
if (!found) {
  console.log(`${path.basename(file)} — ${png.width}x${png.height}: no readable QR code found`)
  process.exit(2)
}

const corners = [
  found.location.topLeftCorner,
  found.location.topRightCorner,
  found.location.bottomRightCorner,
  found.location.bottomLeftCorner
]
const xs = corners.map(c => c.x)
const ys = corners.map(c => c.y)
const x = Math.min(...xs)
const y = Math.min(...ys)
const w = Math.max(...xs) - x
const h = Math.max(...ys) - y
const pct = (v, total) => ((v / total) * 100).toFixed(1)

console.log(`${path.basename(file)} — ${png.width}x${png.height}`)
console.log(`printed code resolves to: ${found.data}`)
console.log(`data-qr-box="${pct(x, png.width)},${pct(y, png.height)},${pct(w, png.width)},${pct(h, png.height)}"`)
