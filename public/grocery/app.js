import {
  addToCart,
  cartCount,
  createSession,
  formatMoney,
  getCartTotal,
  getProductBySku,
  handleUtterance,
  removeFromCart,
  updateQuantity,
  WEEKLY_SPECIALS
} from './shop-engine.js'

const CART_KEY = 'axon-grocery-cart'
const PHOTOS = {
  'PRODUCE-BANANA-001': '/grocery/images/photo-bananas.jpg',
  'PRODUCE-APPLE-RED-001': '/grocery/images/photo-apples-red.jpg',
  'PRODUCE-APPLE-GREEN-001': '/grocery/images/photo-apples-green.jpg',
  'DEMO-MILK-WHOLE-001': '/grocery/images/photo-milk.jpg',
  'DEMO-EGGS-DOZEN-001': '/grocery/images/photo-eggs.jpg',
  'DEMO-BREAD-WHITE-001': '/grocery/images/photo-bread.jpg',
  'DEMO-CHEDDAR-001': '/grocery/images/photo-cheddar.jpg',
  'DEMO-CHEDDAR-002': '/grocery/images/photo-cheddar.jpg',
  'DEMO-CHEDDAR-003': '/grocery/images/photo-cheddar.jpg'
}
const $ = (id) => document.getElementById(id)

function photoFor(item) {
  return PHOTOS[item?.sku] || item?.imageUrl || '/grocery/images/photo-cheddar.jpg'
}

let catalog = []
let session = createSession()
let cart = loadCart()

function loadCart() {
  try {
    const raw = JSON.parse(localStorage.getItem(CART_KEY) || '[]')
    return Array.isArray(raw) ? raw : []
  } catch {
    return []
  }
}
function saveCart() {
  localStorage.setItem(CART_KEY, JSON.stringify(cart))
}

function setOrb(state) {
  document.body.classList.remove('listening', 'thinking', 'ready')
  if (state) document.body.classList.add(state)
}

function renderCartButton() {
  const btn = $('cartBtn')
  if (!session.started) {
    btn.hidden = true
    return
  }
  btn.hidden = false
  const n = cartCount(cart)
  $('cartMeta').textContent = `${n} item${n === 1 ? '' : 's'} · ${formatMoney(getCartTotal(cart))}`
}

function renderReply() {
  const talk = $('talk')
  const said = $('said')
  const el = $('reply')
  if (!session.started) {
    talk.hidden = true
    return
  }
  talk.hidden = false
  said.hidden = !session.lastUserRequest
  said.textContent = session.lastUserRequest || ''
  el.hidden = !session.reply
  el.textContent = session.reply || ''
}

function productCard(p) {
  const brand = p.brand ? `<div class="meta">${p.brand}</div>` : ''
  const img = photoFor(p)
  return `<article class="card" data-sku="${p.sku}">
    <img src="${img}" alt="" data-fly="${p.sku}"/>
    <div class="name">${p.name}</div>
    ${brand}
    <div class="meta">${p.quantity || ''} ${p.unit && p.unit !== 'each' ? `· ${p.unit}` : ''}</div>
    <div class="price">${formatMoney(p.priceCents)}</div>
    <button class="add" type="button" data-add="${p.sku}">Add to Cart</button>
  </article>`
}

function renderResults() {
  const el = $('results')
  if (session.view !== 'shop' || !session.currentResults?.length) {
    el.hidden = true
    el.innerHTML = ''
    return
  }
  el.hidden = false
  el.innerHTML = session.currentResults.map(productCard).join('')
}

function renderCartPanel(force) {
  const el = $('cartPanel')
  const show = force || (session.started && !session.currentResults?.length && session.view === 'shop' && cart.length)
  if (!show) {
    el.hidden = true
    return
  }
  el.hidden = false
  const lines = cart.map((i) => {
    const img = photoFor(i)
    return `<div class="line">
      <img src="${img}" alt=""/>
      <div>
        <div class="name">${i.name}</div>
        <div class="meta">${formatMoney(i.priceCents)} · ${formatMoney(i.priceCents * i.quantity)}</div>
        <div class="qty">
          <button type="button" data-qty="${i.sku}" data-d="-1">−</button>
          <span>${i.quantity}</span>
          <button type="button" data-qty="${i.sku}" data-d="1">+</button>
          <button type="button" data-remove="${i.sku}">Remove</button>
        </div>
      </div>
      <strong>${formatMoney(i.priceCents * i.quantity)}</strong>
    </div>`
  }).join('')
  el.innerHTML = `${lines}<div class="total"><span>Total</span><span>${formatMoney(getCartTotal(cart))}</span></div>
    <button class="place" id="toCheckout" type="button">Proceed to Checkout</button>`
}

function renderCheckout() {
  const el = $('checkout')
  if (session.view !== 'checkout' && session.view !== 'complete') {
    el.hidden = true
    el.innerHTML = ''
    return
  }
  el.hidden = false
  if (session.view === 'complete') {
    el.innerHTML = `<div class="done"><div class="ok"></div>Demo order complete!<br/><span class="meta">Thanks for shopping with Axon. What do you need next?</span>
      <button class="place" id="newOrder" type="button" style="margin-top:1rem;background:#fff;color:var(--ink);border:1px solid var(--border)">Start a New Order</button></div>`
    return
  }
  const lines = cart.map((i) => `<div class="line">
    <img src="${photoFor(i)}" alt=""/>
    <div><div class="name">${i.name}</div><div class="meta">${i.quantity} × ${formatMoney(i.priceCents)}</div></div>
    <strong>${formatMoney(i.priceCents * i.quantity)}</strong>
  </div>`).join('')
  el.innerHTML = `${lines || '<p>Your cart is empty.</p>'}
    <div class="total"><span>Subtotal</span><span>${formatMoney(getCartTotal(cart))}</span></div>
    <div class="total"><span>Total</span><span>${formatMoney(getCartTotal(cart))}</span></div>
    ${cart.length ? '<button class="place" id="place" type="button">Place Demo Order</button><p class="note">This is a demo. No payment will be processed.</p>' : ''}`
}

function paint(opts = {}) {
  document.body.classList.toggle('shopping', session.started)
  renderCartButton()
  renderReply()
  renderResults()
  renderCartPanel(opts.showCart)
  renderCheckout()
}

function flyToCart(sku) {
  const img = document.querySelector(`[data-fly="${sku}"]`)
  const cartBtn = $('cartBtn')
  if (!img || !cartBtn) return
  const from = img.getBoundingClientRect()
  const to = cartBtn.getBoundingClientRect()
  const flyer = img.cloneNode(true)
  flyer.className = 'flyer'
  flyer.style.left = `${from.left}px`
  flyer.style.top = `${from.top}px`
  flyer.style.width = `${from.width}px`
  flyer.style.height = `${from.height}px`
  document.body.appendChild(flyer)
  const dx = to.left + to.width / 2 - (from.left + from.width / 2)
  const dy = to.top + to.height / 2 - (from.top + from.height / 2)
  const anim = flyer.animate(
    [
      { transform: 'translate(0,0) scale(1.04)', opacity: 1 },
      { transform: `translate(${dx * 0.55}px, ${dy * 0.35 - 24}px) scale(.72)`, opacity: .95, offset: .45 },
      { transform: `translate(${dx}px, ${dy}px) scale(.18)`, opacity: 0 }
    ],
    { duration: 600, easing: 'cubic-bezier(.22,.61,.36,1)' }
  )
  anim.onfinish = () => flyer.remove()
  cartBtn.classList.remove('pulse')
  void cartBtn.offsetWidth
  cartBtn.classList.add('pulse')
}

function applyResult(result, { skipFly } = {}) {
  session = result.session
  cart = result.cart
  saveCart()
  paint({ showCart: result.showCart })
  if (result.flewSku && !skipFly) flyToCart(result.flewSku)
}

async function thinkThen(fn) {
  setOrb('listening')
  await new Promise((r) => setTimeout(r, 180))
  setOrb('thinking')
  await new Promise((r) => setTimeout(r, 220))
  fn()
  setOrb('ready')
  setTimeout(() => setOrb(''), 420)
}

function addSku(sku) {
  const product = getProductBySku(catalog, sku)
  if (!product) return
  session = { ...session, started: true, currentProduct: product, view: 'shop' }
  const result = handleUtterance('add it', session, catalog, cart)
  applyResult(result)
}

function say(text) {
  thinkThen(() => applyResult(handleUtterance(text, session, catalog, cart)))
}

function renderSpecials() {
  const el = $('specials')
  if (!el) return
  el.innerHTML = WEEKLY_SPECIALS.map((s) => {
    const p = getProductBySku(catalog, s.sku)
    if (!p) return ''
    return `<button class="deal" type="button" data-special="${p.sku}">
      <img src="${photoFor(p)}" alt=""/>
      <div class="kicker">${s.kicker}</div>
      <div class="name">${p.name}</div>
      <div><span class="was">${formatMoney(s.wasCents)}</span><span class="now">${formatMoney(p.priceCents)}</span></div>
    </button>`
  }).join('')
}

function openSpecial(sku) {
  const product = getProductBySku(catalog, sku)
  if (!product) return
  session = {
    ...session,
    started: true,
    view: 'shop',
    pendingQuestion: null,
    currentProduct: product,
    currentResults: [product],
    reply: `${product.name} is on special this week.`
  }
  paint()
}

$('form').addEventListener('submit', (e) => {
  e.preventDefault()
  const input = $('q')
  const text = input.value.trim()
  if (!text) return
  input.value = ''
  thinkThen(() => applyResult(handleUtterance(text, session, catalog, cart)))
})

document.addEventListener('click', (e) => {
  const chip = e.target.closest('[data-say]')
  if (chip) {
    say(chip.dataset.say)
    return
  }
  const special = e.target.closest('[data-special]')
  if (special) {
    openSpecial(special.dataset.special)
    return
  }
  const add = e.target.closest('[data-add]')
  if (add) {
    addSku(add.dataset.add)
    return
  }
  const qty = e.target.closest('[data-qty]')
  if (qty) {
    const item = cart.find((i) => i.sku === qty.dataset.qty)
    if (!item) return
    cart = updateQuantity(cart, item.sku, item.quantity + Number(qty.dataset.d))
    saveCart()
    paint({ showCart: true })
    return
  }
  const rm = e.target.closest('[data-remove]')
  if (rm) {
    cart = removeFromCart(cart, rm.dataset.remove)
    saveCart()
    paint({ showCart: true })
    return
  }
  if (e.target.id === 'place') {
    session = { ...session, view: 'complete', reply: 'Demo order complete.' }
    paint()
    return
  }
  if (e.target.id === 'toCheckout') {
    thinkThen(() => applyResult(handleUtterance('Checkout.', session, catalog, cart)))
    return
  }
  if (e.target.id === 'newOrder') {
    cart = []
    saveCart()
    session = createSession()
    paint()
    return
  }
  if (e.target.closest('#heroOrb') || e.target.closest('#orbFloat')) {
    $('q').focus()
    setOrb('listening')
    setTimeout(() => setOrb(''), 700)
    return
  }
  if (e.target.closest('#cartBtn')) {
    paint({ showCart: true })
  }
})

try {
  const res = await fetch('/grocery/catalog.json', { cache: 'no-store' })
  if (!res.ok) throw new Error(`catalog ${res.status}`)
  catalog = await res.json()
  renderSpecials()
} catch (err) {
  console.error(err)
  const reply = $('reply')
  if (reply) {
    reply.hidden = false
    reply.textContent = 'The grocery list is still loading. Try Send again in a moment.'
  }
}
if (cart.length) {
  session.started = true
  paint({ showCart: false })
}
