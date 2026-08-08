/**
 * Measure where things actually sit in a finished card image.
 *
 *   node scripts/measure-card.mjs public/art/sabc-orb.png
 *
 * Reads the real pixels rather than trusting a guess: the orb is found by its
 * blue, the printed buttons by their outlines against the paper. Prints the
 * percentages the page uses for its hotspots, so the invisible controls land on
 * the drawn ones exactly.
 */
import fs from 'fs'
import path from 'path'
import { PNG } from 'pngjs'

const file = process.argv[2]
if (!file) {
  console.error('Usage: node scripts/measure-card.mjs <image.png>')
  process.exit(1)
}

const png = PNG.sync.read(fs.readFileSync(file))
const { width: W, height: H, data } = png
const at = (x, y) => {
  const i = (y * W + x) << 2
  return [data[i], data[i + 1], data[i + 2]]
}

console.log(`${path.basename(file)} — ${W}x${H}`)

/* ---- the orb: strongly blue, and nothing else on the card is ---- */
let ox0 = W, oy0 = H, ox1 = 0, oy1 = 0, blue = 0
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const [r, g, b] = at(x, y)
    if (b > 110 && b - r > 55 && b - g > 25) {
      blue++
      if (x < ox0) ox0 = x
      if (x > ox1) ox1 = x
      if (y < oy0) oy0 = y
      if (y > oy1) oy1 = y
    }
  }
}
if (blue > 500) {
  // The logo and the footer are blue too; keep the largest run, which is the orb.
  const rows = []
  for (let y = 0; y < H; y++) {
    let count = 0
    for (let x = 0; x < W; x++) {
      const [r, g, b] = at(x, y)
      if (b > 110 && b - r > 55 && b - g > 25) count++
    }
    rows.push(count)
  }
  const wide = rows.map((c, y) => ({ c, y })).filter(r => r.c > W * 0.12)
  if (wide.length) {
    // longest unbroken band of wide blue rows
    let best = { start: wide[0].y, end: wide[0].y }
    let cur = { start: wide[0].y, end: wide[0].y }
    for (let i = 1; i < wide.length; i++) {
      if (wide[i].y === wide[i - 1].y + 1) cur.end = wide[i].y
      else {
        if (cur.end - cur.start > best.end - best.start) best = { ...cur }
        cur = { start: wide[i].y, end: wide[i].y }
      }
    }
    if (cur.end - cur.start > best.end - best.start) best = { ...cur }

    let x0 = W, x1 = 0
    for (let y = best.start; y <= best.end; y++) {
      for (let x = 0; x < W; x++) {
        const [r, g, b] = at(x, y)
        if (b > 110 && b - r > 55 && b - g > 25) {
          if (x < x0) x0 = x
          if (x > x1) x1 = x
        }
      }
    }
    const w = x1 - x0
    const h = best.end - best.start
    const d = Math.max(w, h)
    const cx = x0 + w / 2
    const cy = best.start + h / 2
    console.log('\norb (the sphere itself, glow excluded by the colour test):')
    console.log(`  pixels: x ${x0}-${x1}, y ${best.start}-${best.end}  (${w}x${h})`)
    console.log(`  orb: { left:${(((cx - d / 2) / W) * 100).toFixed(1)}, top:${(((cy - d / 2) / H) * 100).toFixed(1)}, width:${((d / W) * 100).toFixed(1)} }`)
  }
} else {
  console.log('\nno orb on this card')
}

/* ---- the printed buttons: outlines against the paper ---- */
const paper = at(Math.round(W * 0.5), Math.round(H * 0.02))
const differs = (x, y) => {
  const [r, g, b] = at(x, y)
  return Math.abs(r - paper[0]) + Math.abs(g - paper[1]) + Math.abs(b - paper[2]) > 26
}

// Look only in the band where buttons live, above the footer bar.
const top = Math.round(H * 0.70)
const bottom = Math.round(H * 0.94)
const seen = new Uint8Array(W * H)
const boxes = []
for (let y = top; y < bottom; y++) {
  for (let x = 0; x < W; x++) {
    if (seen[y * W + x] || !differs(x, y)) continue
    // flood fill this blob
    const stack = [[x, y]]
    let bx0 = x, bx1 = x, by0 = y, by1 = y, size = 0
    seen[y * W + x] = 1
    while (stack.length) {
      const [cx, cy] = stack.pop()
      size++
      if (cx < bx0) bx0 = cx
      if (cx > bx1) bx1 = cx
      if (cy < by0) by0 = cy
      if (cy > by1) by1 = cy
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx
        const ny = cy + dy
        if (nx < 0 || ny < top || nx >= W || ny >= bottom) continue
        if (seen[ny * W + nx] || !differs(nx, ny)) continue
        seen[ny * W + nx] = 1
        stack.push([nx, ny])
      }
    }
    const bw = bx1 - bx0
    const bh = by1 - by0
    if (bw > W * 0.2 && bh > H * 0.02 && bh < H * 0.09) boxes.push({ bx0, by0, bw, bh, size })
  }
}
boxes.sort((a, b) => a.bx0 - b.bx0)
if (boxes.length) {
  console.log('\nprinted buttons:')
  const names = ['upload', 'review']
  boxes.slice(0, 2).forEach((b, i) => {
    console.log(`  ${names[i] || 'button' + i}: pixels x ${b.bx0}-${b.bx0 + b.bw}, y ${b.by0}-${b.by0 + b.bh}`)
    console.log(`  ${names[i] || 'button' + i}: { left:${((b.bx0 / W) * 100).toFixed(1)}, top:${((b.by0 / H) * 100).toFixed(1)}, width:${((b.bw / W) * 100).toFixed(1)}, height:${((b.bh / H) * 100).toFixed(1)} }`)
  })
} else {
  console.log('\nno printed buttons found in the lower band')
}
