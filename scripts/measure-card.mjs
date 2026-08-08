/**
 * Measure where things actually sit in a finished card image.
 *
 *   node scripts/measure-card.mjs public/art/sabc-orb.png
 *   node scripts/measure-card.mjs public/art/sabc-orb.png --write public/sabc.html
 *
 * Reads the real pixels rather than trusting a guess, so the invisible controls
 * land on the drawn ones exactly:
 *
 *   the orb     — the widest run of orb-blue is its equator, which gives both
 *                 the diameter and the centre. Measuring the blue's bounding
 *                 box instead would include the glow and the reflection under
 *                 it, and the hotspot would sit low and too tall.
 *   the buttons — outlines against the paper, taken as the pair of wide shapes
 *                 that share a top edge. The heading above them is also darker
 *                 than the paper, so a single widest-shape rule finds the text.
 *
 * With --write the numbers go straight into the page, so a re-exported card is
 * one command away from being aligned and nobody retypes a number.
 */
import fs from 'fs'
import path from 'path'
import { PNG } from 'pngjs'

const file = process.argv[2]
const writeTo = process.argv.includes('--write') ? process.argv[process.argv.indexOf('--write') + 1] : null
if (!file) {
  console.error('Usage: node scripts/measure-card.mjs <image.png> [--write <page.html>]')
  process.exit(1)
}

const png = PNG.sync.read(fs.readFileSync(file))
const { width: W, height: H, data } = png
const at = (x, y) => {
  const i = (y * W + x) << 2
  return [data[i], data[i + 1], data[i + 2]]
}
const pct = (v, total) => +((v / total) * 100).toFixed(1)
const measured = {}

console.log(`${path.basename(file)} — ${W}x${H}`)

/* ---- the orb ---- */

const isOrbBlue = (x, y) => {
  const [r, g, b] = at(x, y)
  return b > 110 && b - r > 55 && b - g > 25
}

let equator = { y: -1, x0: 0, x1: 0, w: 0 }
for (let y = 0; y < H; y++) {
  let x0 = -1
  let x1 = -1
  for (let x = 0; x < W; x++) {
    if (!isOrbBlue(x, y)) continue
    if (x0 < 0) x0 = x
    x1 = x
  }
  if (x1 - x0 > equator.w) equator = { y, x0, x1, w: x1 - x0 }
}

if (equator.w > W * 0.15) {
  const d = equator.w
  const left = equator.x0
  const top = equator.y - d / 2
  measured.orb = { left: pct(left, W), top: pct(top, H), width: pct(d, W) }
  console.log('\norb:')
  console.log(`  equator at y ${equator.y}, x ${equator.x0}-${equator.x1} — diameter ${d}px`)
  console.log(`  pixels: x ${left}-${left + d}, y ${Math.round(top)}-${Math.round(top + d)}`)
  console.log(`  ${JSON.stringify(measured.orb)}`)
} else {
  console.log('\nno orb on this card')
}

/* ---- the printed buttons ---- */

const paper = at(Math.round(W * 0.5), Math.round(H * 0.02))
const differs = (x, y) => {
  const [r, g, b] = at(x, y)
  return Math.abs(r - paper[0]) + Math.abs(g - paper[1]) + Math.abs(b - paper[2]) > 26
}

const bandTop = Math.round(H * 0.72)
const bandBottom = Math.round(H * 0.92)
const seen = new Uint8Array(W * H)
const shapes = []
for (let y = bandTop; y < bandBottom; y++) {
  for (let x = 0; x < W; x++) {
    if (seen[y * W + x] || !differs(x, y)) continue
    const stack = [[x, y]]
    seen[y * W + x] = 1
    let bx0 = x
    let bx1 = x
    let by0 = y
    let by1 = y
    while (stack.length) {
      const [cx, cy] = stack.pop()
      if (cx < bx0) bx0 = cx
      if (cx > bx1) bx1 = cx
      if (cy < by0) by0 = cy
      if (cy > by1) by1 = cy
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx
        const ny = cy + dy
        if (nx < 0 || ny < bandTop || nx >= W || ny >= bandBottom) continue
        if (seen[ny * W + nx] || !differs(nx, ny)) continue
        seen[ny * W + nx] = 1
        stack.push([nx, ny])
      }
    }
    if (bx1 - bx0 > W * 0.18) shapes.push({ x: bx0, y: by0, w: bx1 - bx0, h: by1 - by0 })
  }
}

// Two buttons side by side share a top edge; a heading does not.
let pair = null
for (const a of shapes) {
  for (const b of shapes) {
    if (a === b || a.x >= b.x) continue
    if (Math.abs(a.y - b.y) > H * 0.01) continue
    if (Math.abs(a.h - b.h) > H * 0.01) continue
    if (a.x + a.w >= b.x) continue
    if (!pair || a.y > pair[0].y) pair = [a, b]
  }
}

if (pair) {
  const [upload, review] = pair
  measured.upload = { left: pct(upload.x, W), top: pct(upload.y, H), width: pct(upload.w, W), height: pct(upload.h, H) }
  measured.review = { left: pct(review.x, W), top: pct(review.y, H), width: pct(review.w, W), height: pct(review.h, H) }
  console.log('\nprinted buttons:')
  console.log(`  upload: pixels x ${upload.x}-${upload.x + upload.w}, y ${upload.y}-${upload.y + upload.h}`)
  console.log(`  ${JSON.stringify(measured.upload)}`)
  console.log(`  review: pixels x ${review.x}-${review.x + review.w}, y ${review.y}-${review.y + review.h}`)
  console.log(`  ${JSON.stringify(measured.review)}`)
} else {
  console.log('\nno pair of printed buttons found')
}

/* ---- put them into the page ---- */

if (writeTo) {
  if (!measured.orb || !measured.upload || !measured.review) {
    console.error('\nNot writing: the orb or the buttons were not found. Check the image before trusting anything above.')
    process.exit(2)
  }
  const line = (name, box) =>
    `  ${name}:${' '.repeat(Math.max(1, 7 - name.length))}{ left:${box.left}, top:${box.top}, width:${box.width}${box.height ? `, height:${box.height}` : ''} }`
  const block = `window.SABC_HOTSPOTS = {\n${line('orb', measured.orb)},\n${line('upload', measured.upload)},\n${line('review', measured.review)}\n};`
  const page = fs.readFileSync(writeTo, 'utf8')
  const next = page.replace(/window\.SABC_HOTSPOTS = \{[\s\S]*?\};/, block)
  if (next === page) {
    console.error(`\nNot writing: no hotspot block found in ${writeTo}.`)
    process.exit(2)
  }
  fs.writeFileSync(writeTo, next)
  console.log(`\nwrote the measurements into ${writeTo}`)
}
