/**
 * Render Axon Partner app icons (blue mark) at 180 / 192 / 512.
 * Renders a 1024 master once, then scales with ffmpeg.
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { spawnSync } from 'child_process'
import puppeteer from 'puppeteer-core'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.join(__dirname, '..', 'public', 'icons')
const sizes = [180, 192, 512]
const masterSize = 1024

function pageHtml(size) {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<style>
  html,body{margin:0;background:#061a4e}
  #stage{width:${size}px;height:${size}px;display:block}
</style>
</head>
<body>
<canvas id="stage" width="${size}" height="${size}"></canvas>
<script>
const c = document.getElementById('stage');
const ctx = c.getContext('2d');
const W = ${size}, H = ${size};
const s = W / 1024;

const bg = ctx.createRadialGradient(W*0.5, H*0.42, 40*s, W*0.5, H*0.55, W*0.72);
bg.addColorStop(0, '#1e4fb8');
bg.addColorStop(0.35, '#123a8c');
bg.addColorStop(0.7, '#0a2466');
bg.addColorStop(1, '#061a4e');
ctx.fillStyle = bg;
ctx.fillRect(0, 0, W, H);

const vig = ctx.createRadialGradient(W/2, H/2, W*0.28, W/2, H/2, W*0.72);
vig.addColorStop(0, 'rgba(0,0,0,0)');
vig.addColorStop(1, 'rgba(3,15,52,0.45)');
ctx.fillStyle = vig;
ctx.fillRect(0, 0, W, H);

function drawA(strokeStyle, lineWidth) {
  ctx.save();
  ctx.strokeStyle = strokeStyle;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'miter';
  ctx.miterLimit = 2;
  const topY = 250 * s;
  const botY = 780 * s;
  const apexX = W / 2;
  const leftX = 250 * s;
  const rightX = 774 * s;
  const ridge = 56 * s;
  ctx.beginPath();
  ctx.moveTo(leftX, botY);
  ctx.lineTo(apexX - ridge, topY);
  ctx.lineTo(apexX + ridge, topY);
  ctx.lineTo(rightX, botY);
  ctx.stroke();
  ctx.restore();
}

ctx.save();
ctx.shadowColor = 'rgba(147, 197, 253, 0.55)';
ctx.shadowBlur = 48 * s;
const glow = ctx.createLinearGradient(0, 220*s, 0, 800*s);
glow.addColorStop(0, '#dbeafe');
glow.addColorStop(0.35, '#93c5fd');
glow.addColorStop(0.7, '#3b82f6');
glow.addColorStop(1, '#1e40af');
drawA(glow, 118 * s);
ctx.restore();

const face = ctx.createLinearGradient(0, 230*s, 0, 790*s);
face.addColorStop(0, '#eff6ff');
face.addColorStop(0.25, '#bfdbfe');
face.addColorStop(0.55, '#60a5fa');
face.addColorStop(0.85, '#2563eb');
face.addColorStop(1, '#1e3a8a');
drawA(face, 108 * s);

const rim = ctx.createLinearGradient(0, 230*s, 0, 500*s);
rim.addColorStop(0, 'rgba(255,255,255,0.85)');
rim.addColorStop(1, 'rgba(255,255,255,0)');
drawA(rim, 18 * s);
</script>
</body>
</html>`
}

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH || '/usr/local/bin/google-chrome',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  headless: 'new'
})

const masterPath = path.join(outDir, '_master.png')
try {
  const page = await browser.newPage()
  await page.setViewport({ width: masterSize, height: masterSize, deviceScaleFactor: 1 })
  await page.setContent(pageHtml(masterSize), { waitUntil: 'networkidle0' })
  await page.waitForFunction(() => {
    const c = document.getElementById('stage')
    const d = c.getContext('2d').getImageData(512, 400, 1, 1).data
    return d[2] > 80
  })
  await page.screenshot({
    path: masterPath,
    type: 'png',
    clip: { x: 0, y: 0, width: masterSize, height: masterSize }
  })
} finally {
  await browser.close()
}

for (const size of sizes) {
  const out = path.join(outDir, `axon-${size}.png`)
  const r = spawnSync(
    'ffmpeg',
    ['-y', '-i', masterPath, '-vf', `scale=${size}:${size}`, out],
    { encoding: 'utf8' }
  )
  if (r.status !== 0) throw new Error(r.stderr || 'ffmpeg failed')
  console.log('wrote', out)
}
fs.unlinkSync(masterPath)

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" role="img" aria-label="Axon Partner">
  <defs>
    <radialGradient id="bg" cx="50%" cy="42%" r="72%">
      <stop offset="0%" stop-color="#1e4fb8"/>
      <stop offset="35%" stop-color="#123a8c"/>
      <stop offset="70%" stop-color="#0a2466"/>
      <stop offset="100%" stop-color="#061a4e"/>
    </radialGradient>
    <linearGradient id="a" x1="0" y1="230" x2="0" y2="790" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#eff6ff"/>
      <stop offset="25%" stop-color="#bfdbfe"/>
      <stop offset="55%" stop-color="#60a5fa"/>
      <stop offset="85%" stop-color="#2563eb"/>
      <stop offset="100%" stop-color="#1e3a8a"/>
    </linearGradient>
  </defs>
  <rect width="1024" height="1024" fill="url(#bg)"/>
  <path d="M250 780 L456 250 H568 L774 780" fill="none" stroke="url(#a)" stroke-width="108" stroke-linejoin="miter"/>
</svg>
`
fs.writeFileSync(path.join(outDir, 'axon-mark.svg'), svg)
console.log('wrote', path.join(outDir, 'axon-mark.svg'))
