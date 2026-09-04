import {
  addToCart,
  cartCount,
  createSession,
  formatMoney,
  getCartTotal,
  getProductBySku,
  handleUtterance,
  removeFromCart,
  updateQuantity
} from './shop-engine.js'

const CART_KEY = 'axon-grocery-cart'
const $ = (id) => document.getElementById(id)

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
  const el = $('reply')
  if (!session.started) {
    el.hidden = true
    return
  }
  el.hidden = !session.reply
  el.textContent = session.reply || ''
}

function productCard(p) {
  const brand = p.brand ? `<div class="meta">${p.brand}</div>` : ''
  const img = p.imageUrl || '/grocery/images/cheddar.svg'
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
    const img = i.imageUrl || '/grocery/images/cheddar.svg'
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
  el.innerHTML = `${lines}<div class="total"><span>Total</span><span>${formatMoney(getCartTotal(cart))}</span></div>`
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
    el.innerHTML = `<div class="done">Demo order complete.</div>`
    return
  }
  const lines = cart.map((i) => `<div class="line">
    <img src="${i.imageUrl || '/grocery/images/cheddar.svg'}" alt=""/>
    <div><div class="name">${i.name}</div><div class="meta">${i.quantity} × ${formatMoney(i.priceCents)}</div></div>
    <strong>${formatMoney(i.priceCents * i.quantity)}</strong>
  </div>`).join('')
  el.innerHTML = `${lines || '<p>Your cart is empty.</p>'}
    <div class="total"><span>Subtotal</span><span>${formatMoney(getCartTotal(cart))}</span></div>
    <div class="total"><span>Total</span><span>${formatMoney(getCartTotal(cart))}</span></div>
    ${cart.length ? '<button class="place" id="place" type="button">Place Demo Order</button>' : ''}`
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

$('form').addEventListener('submit', (e) => {
  e.preventDefault()
  const input = $('q')
  const text = input.value.trim()
  if (!text) return
  input.value = ''
  thinkThen(() => applyResult(handleUtterance(text, session, catalog, cart)))
})

document.addEventListener('click', (e) => {
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
  if (e.target.closest('#cartBtn')) {
    paint({ showCart: true })
  }
})

const res = await fetch('/grocery/catalog.json', { cache: 'no-store' })
catalog = await res.json()
if (cart.length) {
  session.started = true
  paint({ showCart: false })
}
