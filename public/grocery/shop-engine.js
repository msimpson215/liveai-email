export function normalizeQuery(raw) {
  let t = String(raw || '').toLowerCase()
  t = t.replace(/[^a-z0-9\s]/g, ' ')
  t = t.replace(/\s+/g, ' ').trim()
  const map = {
    apples: 'apple',
    cheeses: 'cheese',
    sodas: 'soda',
    pops: 'pop',
    bananas: 'banana',
    eggs: 'egg',
    loaves: 'loaf'
  }
  t = t
    .split(' ')
    .map((w) => map[w] || w)
    .join(' ')
  t = t.replace(/\bpop\b/g, 'soda')
  t = t.replace(/\bcheddar cheese\b/g, 'cheddar')
  t = t.replace(/\bcheddar\b/g, 'cheddar cheese')
  return t.replace(/\s+/g, ' ').trim()
}

export function formatMoney(cents) {
  return `$${(cents / 100).toFixed(2)}`
}

function tokens(q) {
  return normalizeQuery(q).split(' ').filter((w) => w.length > 1)
}

function haystack(p) {
  return normalizeQuery(`${p.name} ${p.brand} ${p.category} ${p.quantity}`)
}

export function searchProducts(catalog, query) {
  const q = normalizeQuery(query)
  if (!q) return []
  const words = tokens(q)
  const scored = []
  for (const p of catalog) {
    const h = haystack(p)
    if (q && h.includes(q)) {
      scored.push({ p, s: 100 })
      continue
    }
    let hit = 0
    for (const w of words) if (h.includes(w)) hit++
    if (hit === words.length && words.length) scored.push({ p, s: 50 + hit })
    else if (hit >= Math.max(1, words.length - 1) && hit > 0) scored.push({ p, s: hit })
  }
  scored.sort((a, b) => b.s - a.s || a.p.priceCents - b.p.priceCents)
  return scored.map((x) => x.p)
}

export function getCheapestProduct(catalog, query) {
  const words = tokens(query)
  const list = catalog.filter((p) => {
    const h = haystack(p)
    return words.length && words.every((w) => h.includes(w))
  })
  if (!list.length) return null
  return [...list].sort((a, b) => a.priceCents - b.priceCents)[0]
}

export function getProductBySku(catalog, sku) {
  return catalog.find((p) => p.sku === sku) || null
}

export function emptyCart() {
  return []
}

export function addToCart(cart, product) {
  const next = cart.map((i) => ({ ...i }))
  const found = next.find((i) => i.sku === product.sku)
  if (found) found.quantity += 1
  else {
    next.push({
      sku: product.sku,
      name: product.name,
      priceCents: product.priceCents,
      quantity: 1,
      imageUrl: product.imageUrl,
      unit: product.unit || 'each'
    })
  }
  return next
}

export function removeFromCart(cart, sku) {
  return cart.filter((i) => i.sku !== sku)
}

export function updateQuantity(cart, sku, quantity) {
  if (quantity <= 0) return removeFromCart(cart, sku)
  return cart.map((i) => (i.sku === sku ? { ...i, quantity } : i))
}

export function getCart(cart) {
  return cart
}

export function getCartTotal(cart) {
  return cart.reduce((sum, i) => sum + i.priceCents * i.quantity, 0)
}

export function cartCount(cart) {
  return cart.reduce((sum, i) => sum + i.quantity, 0)
}

export function createSession() {
  return {
    lastUserRequest: '',
    pendingQuestion: null,
    currentProduct: null,
    currentResults: [],
    started: false,
    view: 'shop',
    reply: '',
    error: ''
  }
}

export const WEEKLY_SPECIALS = [
  { sku: 'PRODUCE-BANANA-001', wasCents: 89, kicker: 'Produce' },
  { sku: 'PRODUCE-APPLE-RED-001', wasCents: 229, kicker: 'Produce' },
  { sku: 'DEMO-MILK-WHOLE-001', wasCents: 429, kicker: 'Dairy' },
  { sku: 'DEMO-CHEDDAR-001', wasCents: 399, kicker: 'Cheese' },
  { sku: 'DEMO-BREAD-WHITE-001', wasCents: 329, kicker: 'Bakery' }
]

const STAPLE_MATCHES = [
  { keys: ['banana'], sku: 'PRODUCE-BANANA-001' },
  { keys: ['milk'], sku: 'DEMO-MILK-WHOLE-001' },
  { keys: ['egg'], sku: 'DEMO-EGGS-DOZEN-001' },
  { keys: ['bread', 'loaf'], sku: 'DEMO-BREAD-WHITE-001' }
]

function mergeResults(existing, incoming) {
  const out = [...(existing || [])]
  for (const p of incoming) {
    if (p && !out.some((x) => x.sku === p.sku)) out.push(p)
  }
  return out
}

function findStaplesInText(n, catalog) {
  const found = []
  for (const row of STAPLE_MATCHES) {
    if (row.keys.some((k) => n.includes(k))) {
      const p = getProductBySku(catalog, row.sku)
      if (p) found.push(p)
    }
  }
  return found
}

const ADD_PHRASES = [
  'add it',
  'add that',
  'add those',
  'put it in the cart',
  'put those in the cart',
  'put that in the cart',
  'put it in',
  'put those in',
  'that one',
  'yes add that',
  'yes add it'
]

function isAdd(n) {
  if (ADD_PHRASES.some((p) => n === p || n.includes(p))) return true
  if (n === 'yes' || n === 'add' || n === 'ok') return true
  return false
}

function wantsCheapest(n) {
  return (
    n.includes('cheapest') ||
    n.includes('least expensive') ||
    n.includes('least expensive') ||
    n.includes('lowest price') ||
    n.includes('least expensive one')
  )
}

export function handleUtterance(raw, session, catalog, cart) {
  const text = String(raw || '').trim()
  const n = normalizeQuery(text)
  const next = { ...session, lastUserRequest: text, error: '', view: session.view === 'complete' ? 'shop' : session.view }
  let nextCart = cart

  if (!n) {
    next.reply = ''
    return { session: next, cart: nextCart }
  }

  if (n.includes('checkout') || n === 'check out') {
    next.started = true
    next.view = 'checkout'
    next.reply = nextCart.length ? 'Here is your demo checkout.' : 'Your cart is empty.'
    return { session: next, cart: nextCart }
  }

  if (
    n.includes('what is in my cart') ||
    n.includes('what s in my cart') ||
    n.includes('whats in my cart') ||
    n.includes('show my cart') ||
    n === 'cart'
  ) {
    next.started = true
    next.view = 'shop'
    next.currentResults = []
    if (!nextCart.length) next.reply = 'Your cart is empty.'
    else next.reply = `You have ${cartCount(nextCart)} item${cartCount(nextCart) === 1 ? '' : 's'} · ${formatMoney(getCartTotal(nextCart))}`
    return { session: next, cart: nextCart, showCart: true }
  }

  if (next.pendingQuestion === 'apple_color') {
    if (n.includes('red')) {
      const product = getProductBySku(catalog, 'PRODUCE-APPLE-RED-001')
      next.pendingQuestion = null
      next.started = true
      next.currentProduct = product
      next.currentResults = product ? [product] : []
      next.reply = product ? 'Red apples.' : 'I could not find red apples.'
      return { session: next, cart: nextCart }
    }
    if (n.includes('green')) {
      const product = getProductBySku(catalog, 'PRODUCE-APPLE-GREEN-001')
      next.pendingQuestion = null
      next.started = true
      next.currentProduct = product
      next.currentResults = product ? [product] : []
      next.reply = product ? 'Green apples.' : 'I could not find green apples.'
      return { session: next, cart: nextCart }
    }
  }

  if (isAdd(n) && next.currentProduct) {
    next.started = true
    const those = /\b(those|them|all)\b/.test(n)
    const batch = those && next.currentResults?.length ? next.currentResults : [next.currentProduct]
    let flew = null
    for (const p of batch) {
      if (!p) continue
      nextCart = addToCart(nextCart, p)
      flew = p.sku
    }
    next.reply = batch.length > 1 ? `Added ${batch.length} items.` : `Added ${batch[0]?.name || 'it'}.`
    next.view = 'shop'
    return { session: next, cart: nextCart, flewSku: flew }
  }

  const staples = findStaplesInText(n, catalog)
  const appleAsk = (n.includes('apple') || n.includes('apples')) && !n.includes('pineapple')

  if (staples.length) {
    next.started = true
    next.pendingQuestion = appleAsk ? 'apple_color' : next.pendingQuestion
    next.currentResults = mergeResults(next.currentResults, staples)
    next.currentProduct = staples[staples.length - 1]
    for (const p of staples) nextCart = addToCart(nextCart, p)
    next.reply = appleAsk
      ? `Putting those in. Red or green apples?`
      : `Putting ${staples.map((p) => p.name.toLowerCase()).join(', ')} in your cart.`
    next.view = 'shop'
    return { session: next, cart: nextCart, flewSku: next.currentProduct.sku }
  }

  if (appleAsk) {
    next.started = true
    next.pendingQuestion = 'apple_color'
    next.currentProduct = null
    next.currentResults = []
    next.reply = 'Red or green?'
    next.view = 'shop'
    return { session: next, cart: nextCart }
  }

  const cheddarAsk = n.includes('cheddar') || (n.includes('sharp') && n.includes('cheese'))
  if (cheddarAsk && (wantsCheapest(n) || n.includes('least'))) {
    const product = getCheapestProduct(catalog, 'sharp cheddar')
    next.started = true
    next.pendingQuestion = null
    next.currentProduct = product
    next.currentResults = product ? [product] : []
    next.reply = product ? 'The least expensive sharp cheddar.' : 'I could not find sharp cheddar.'
    next.view = 'shop'
    return { session: next, cart: nextCart }
  }

  if (cheddarAsk) {
    const list = searchProducts(catalog, 'sharp cheddar cheese').slice(0, 4)
    next.started = true
    next.pendingQuestion = null
    next.currentResults = list
    next.currentProduct = list[0] || null
    next.reply = list.length ? 'I found a few good matches.' : 'I could not find cheddar.'
    next.view = 'shop'
    return { session: next, cart: nextCart }
  }

  const list = searchProducts(catalog, text).slice(0, 4)
  next.started = true
  next.pendingQuestion = null
  next.currentResults = list
  next.currentProduct = list[0] || null
  next.reply = list.length ? 'I found a few good matches.' : 'I could not find that yet.'
  next.view = 'shop'
  return { session: next, cart: nextCart }
}
