import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import {
  createSession,
  emptyCart,
  getCartTotal,
  handleUtterance
} from '../public/grocery/shop-engine.js'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'public', 'grocery', 'catalog.json'), 'utf8'))

function say(text, session, cart) {
  return handleUtterance(text, session, catalog, cart)
}

let session = createSession()
let cart = emptyCart()
const steps = []

function run(user) {
  const r = say(user, session, cart)
  session = r.session
  cart = r.cart
  steps.push({ user, reply: session.reply, skus: (session.currentResults || []).map((p) => p.sku), view: session.view, total: getCartTotal(cart) })
  return r
}

run('I need apples.')
if (session.reply !== 'Red or green?') throw new Error(`apples: ${session.reply}`)
run('Red.')
if (session.currentProduct?.sku !== 'PRODUCE-APPLE-RED-001') throw new Error('red apples missing')
run('Put those in the cart.')
if (!cart.some((i) => i.sku === 'PRODUCE-APPLE-RED-001')) throw new Error('apples not in cart')
run('I also need sharp cheddar cheese. Give me the cheapest one.')
if (session.currentProduct?.sku !== 'DEMO-CHEDDAR-001') throw new Error(`cheapest cheddar was ${session.currentProduct?.sku} ${session.currentProduct?.priceCents}`)
run('Add it.')
if (!cart.some((i) => i.sku === 'DEMO-CHEDDAR-001')) throw new Error('cheddar not in cart')
run("What's in my cart?")
if (cart.length !== 2) throw new Error(`cart size ${cart.length}`)
if (getCartTotal(cart) !== 169 + 299) throw new Error(`total ${getCartTotal(cart)}`)
run('Checkout.')
if (session.view !== 'checkout') throw new Error('not checkout')
console.log('acceptance passed')
console.log(JSON.stringify(steps, null, 2))
console.log('catalog products', catalog.length)
