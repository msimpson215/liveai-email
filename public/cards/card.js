/**
 * Makes a finished card image functional. The artwork is never modified.
 *
 * Two behaviors get drawn on top of the image and nothing else:
 *   1. the orb becomes a link to the assistant
 *   2. the printed QR gets covered by one that resolves to the same link
 *
 * The printed QR is found by decoding the artwork itself (public/js/jsqr.js,
 * vendored from the jsqr package), so the exact pixels are read off the real
 * file instead of measured by hand. data-qr-box is only a fallback for artwork
 * whose printed code cannot be read at all. If the printed code already points
 * at the target, nothing is covered — the region is just made clickable.
 *
 * Markup contract:
 *   <div class="stage" data-card
 *        data-url="https://…"          where the orb and QR go
 *        data-qr="/qr/x-overlay.svg"   QR with no quiet zone, or omit for orb-only art
 *        data-orb="7.6,31,40"          left%, top%, diameter% of the artwork
 *        data-qr-box="58.6,33.2,33.6,27.1">  fallback left%, top%, w%, h%
 *     <img class="art" src="/art/x.png" alt="…">
 *   </div>
 *
 * Add ?tune=1 to the URL to outline the orb hotspot and drag it into place; the
 * readout prints the data-orb value to paste back into the page.
 */
(function () {
  const stage = document.querySelector('[data-card]')
  if (!stage) return
  const art = stage.querySelector('.art')
  const target = stage.dataset.url
  const tuning = /[?&]tune=1/.test(location.search)

  const nums = value => (value || '').split(',').map(Number).filter(n => !Number.isNaN(n))

  function link(className, label) {
    const a = document.createElement('a')
    a.className = 'hot ' + className
    a.href = target
    a.setAttribute('aria-label', label)
    stage.appendChild(a)
    return a
  }

  /* ---- buttons printed in the artwork ---- */

  // data-links='[{"rect":[5.2,79.1,44.6,5.3],"href":"/start?do=upload","label":"Upload documents"}]'
  try {
    for (const spot of JSON.parse(stage.dataset.links || '[]')) {
      const [l, t, w, h] = spot.rect
      const a = document.createElement('a')
      a.className = 'hot printed'
      a.href = spot.href
      a.setAttribute('aria-label', spot.label || 'Open')
      a.style.left = l + '%'
      a.style.top = t + '%'
      a.style.width = w + '%'
      a.style.height = h + '%'
      stage.appendChild(a)
    }
  } catch (err) { /* a malformed list must not take the card down */ }

  /* ---- the orb ---- */

  const orbBox = nums(stage.dataset.orb)
  let orb = null
  if (orbBox.length === 3) {
    orb = link('orb', stage.dataset.orbLabel || 'Open the AI assistant')
    orb.style.left = orbBox[0] + '%'
    orb.style.top = orbBox[1] + '%'
    orb.style.width = orbBox[2] + '%'
  }

  /* ---- the QR ---- */

  /** Cover the printed code with a live one, padded so no old modules peek out. */
  function coverQr(box) {
    const pad = 0.06 * box.w
    const outer = { x: box.x - pad, y: box.y - pad, w: box.w + 2 * pad, h: box.h + 2 * pad }
    const a = link('qr', 'Open the AI assistant')
    a.style.left = (outer.x / art.naturalWidth) * 100 + '%'
    a.style.top = (outer.y / art.naturalHeight) * 100 + '%'
    a.style.width = (outer.w / art.naturalWidth) * 100 + '%'
    a.style.height = (outer.h / art.naturalHeight) * 100 + '%'
    a.style.padding = (pad / outer.w) * 100 + '%'
    const img = document.createElement('img')
    img.alt = 'QR code — scan to open the AI assistant'
    img.src = stage.dataset.qr
    a.appendChild(img)
    return a
  }

  /** Leave the printed code alone; a tap still opens the same page. */
  function clickableQr(box) {
    const a = link('qr-passthrough', 'Open the AI assistant')
    a.style.left = (box.x / art.naturalWidth) * 100 + '%'
    a.style.top = (box.y / art.naturalHeight) * 100 + '%'
    a.style.width = (box.w / art.naturalWidth) * 100 + '%'
    a.style.height = (box.h / art.naturalHeight) * 100 + '%'
    return a
  }

  function fallbackBox() {
    const p = nums(stage.dataset.qrBox)
    if (p.length !== 4) return null
    return {
      x: (p[0] / 100) * art.naturalWidth,
      y: (p[1] / 100) * art.naturalHeight,
      w: (p[2] / 100) * art.naturalWidth,
      h: (p[3] / 100) * art.naturalHeight
    }
  }

  /** Read the printed QR out of the artwork: returns its pixel box and payload. */
  async function readPrintedQr() {
    if (!window.jsQR) {
      await new Promise((resolve, reject) => {
        const s = document.createElement('script')
        s.src = '/js/jsqr.js'
        s.onload = resolve
        s.onerror = reject
        document.head.appendChild(s)
      }).catch(() => {})
    }
    if (!window.jsQR) return null

    const scale = Math.min(1, 1100 / art.naturalWidth)
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(art.naturalWidth * scale)
    canvas.height = Math.round(art.naturalHeight * scale)
    const ctx = canvas.getContext('2d')
    ctx.drawImage(art, 0, 0, canvas.width, canvas.height)
    let pixels
    try {
      pixels = ctx.getImageData(0, 0, canvas.width, canvas.height)
    } catch (err) {
      return null
    }
    const found = window.jsQR(pixels.data, canvas.width, canvas.height, { inversionAttempts: 'dontInvert' })
    if (!found) return null

    const corners = [
      found.location.topLeftCorner,
      found.location.topRightCorner,
      found.location.bottomRightCorner,
      found.location.bottomLeftCorner
    ]
    const xs = corners.map(c => c.x / scale)
    const ys = corners.map(c => c.y / scale)
    const x = Math.min.apply(null, xs)
    const y = Math.min.apply(null, ys)
    return { text: found.data, x, y, w: Math.max.apply(null, xs) - x, h: Math.max.apply(null, ys) - y }
  }

  async function wireQr() {
    if (!stage.dataset.qr) return
    const printed = await readPrintedQr()
    if (printed && printed.text.trim() === target) {
      clickableQr(printed)
      return
    }
    const box = printed || fallbackBox()
    if (box) coverQr(box)
  }

  /* ---- alignment helper ---- */

  function tune() {
    if (!orb) return
    stage.classList.add('tuning')
    const out = document.createElement('div')
    out.className = 'tuneOut'
    document.body.appendChild(out)
    const show = () =>
      (out.textContent =
        'data-orb="' +
        [parseFloat(orb.style.left), parseFloat(orb.style.top), parseFloat(orb.style.width)]
          .map(n => n.toFixed(1))
          .join(',') +
        '"  — drag to move, shift-drag to resize')
    show()

    let from = null
    orb.addEventListener('click', e => e.preventDefault())
    orb.addEventListener('pointerdown', e => {
      from = { x: e.clientX, y: e.clientY, l: parseFloat(orb.style.left), t: parseFloat(orb.style.top), w: parseFloat(orb.style.width), resize: e.shiftKey }
      orb.setPointerCapture(e.pointerId)
    })
    orb.addEventListener('pointermove', e => {
      if (!from) return
      const dx = ((e.clientX - from.x) / stage.clientWidth) * 100
      const dy = ((e.clientY - from.y) / stage.clientHeight) * 100
      if (from.resize) {
        orb.style.width = Math.max(2, from.w + dx) + '%'
      } else {
        orb.style.left = from.l + dx + '%'
        orb.style.top = from.t + dy + '%'
      }
      show()
    })
    orb.addEventListener('pointerup', () => (from = null))
  }

  /* ---- start ---- */

  function missing() {
    const note = document.createElement('p')
    note.className = 'missing'
    note.innerHTML =
      'The artwork <code>' +
      art.getAttribute('src') +
      '</code> is not on the server yet. <a href="/cards/artwork.html">Drop the PNG in here</a> and reload this page.'
    stage.appendChild(note)
  }

  function start() {
    if (!art.naturalWidth) return missing()
    wireQr()
    if (tuning) tune()
  }

  if (art.complete) start()
  else {
    art.addEventListener('load', start)
    art.addEventListener('error', missing)
  }
})()
