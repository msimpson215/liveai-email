/**
 * Download US grocery products from Open Food Facts into catalog.json.
 * Deterministic demo prices. Guaranteed staples always win the cheddar demo.
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const outPublic = path.join(root, 'public', 'grocery', 'catalog.json')
const outData = path.join(root, 'data', 'catalog.json')

const UA = 'AxonGroceryShopper/0.1 (https://liveai-email.onrender.com/grocery/; grocery-prototype)'
const TARGET = 1000
const PAGE_SIZE = 50
const CATEGORIES = [
  'en:cheeses',
  'en:milks',
  'en:breads',
  'en:breakfast-cereals',
  'en:yogurts',
  'en:pastas',
  'en:frozen-foods',
  'en:salty-snacks',
  'en:fruit-juices',
  'en:meats',
  'en:fishes',
  'en:chocolates',
  'en:waters',
  'en:coffees',
  'en:teas'
]

function priceFromSku(sku) {
  let h = 2166136261
  const s = String(sku)
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  const span = 1499 - 99
  return 99 + (Math.abs(h) % (span + 1))
}

function looksLikeSharpCheddar(name, category) {
  const t = `${name} ${category}`.toLowerCase()
  return t.includes('sharp') && t.includes('cheddar')
}

function categoryOf(tags) {
  if (!Array.isArray(tags) || !tags.length) return 'grocery'
  const cleaned = tags
    .map((t) => String(t).replace(/^en:/, '').replace(/-/g, ' ').trim())
    .filter(Boolean)
  return cleaned[cleaned.length - 1] || 'grocery'
}

function normalizeOff(p) {
  const code = String(p.code || '').trim()
  const name = String(p.product_name || '').trim()
  if (!code || !name) return null
  const imageUrl = String(p.image_front_url || p.image_url || '').trim()
  const category = categoryOf(p.categories_tags_en)
  let priceCents = priceFromSku(code)
  if (looksLikeSharpCheddar(name, category)) {
    priceCents = 499 + (priceFromSku(code + ':cheddar') % 401)
  }
  return {
    id: `OFF-${code}`,
    sku: code,
    barcode: code,
    name,
    brand: String(p.brands || '').split(',')[0].trim(),
    quantity: String(p.quantity || '').trim() || 'each',
    category,
    imageUrl,
    priceCents,
    unit: 'each',
    source: 'Open Food Facts'
  }
}

const STAPLES = [
  {
    id: 'DEMO-PRODUCE-APPLE-RED-001',
    sku: 'PRODUCE-APPLE-RED-001',
    barcode: 'PRODUCE-APPLE-RED-001',
    name: 'Red Apples',
    brand: '',
    quantity: '1 lb',
    category: 'apples',
    imageUrl: '/grocery/images/apple-red.svg',
    priceCents: 169,
    unit: 'lb',
    source: 'Axon Demo'
  },
  {
    id: 'DEMO-PRODUCE-APPLE-GREEN-001',
    sku: 'PRODUCE-APPLE-GREEN-001',
    barcode: 'PRODUCE-APPLE-GREEN-001',
    name: 'Green Apples',
    brand: '',
    quantity: '1 lb',
    category: 'apples',
    imageUrl: '/grocery/images/apple-green.svg',
    priceCents: 179,
    unit: 'lb',
    source: 'Axon Demo'
  },
  {
    id: 'DEMO-PRODUCE-BANANA-001',
    sku: 'PRODUCE-BANANA-001',
    barcode: 'PRODUCE-BANANA-001',
    name: 'Bananas',
    brand: '',
    quantity: '1 lb',
    category: 'bananas',
    imageUrl: '/grocery/images/bananas.svg',
    priceCents: 59,
    unit: 'lb',
    source: 'Axon Demo'
  },
  {
    id: 'DEMO-DAIRY-MILK-WHOLE-001',
    sku: 'DEMO-MILK-WHOLE-001',
    barcode: 'DEMO-MILK-WHOLE-001',
    name: 'Whole Milk',
    brand: '',
    quantity: '1 gallon',
    category: 'milk',
    imageUrl: '/grocery/images/milk.svg',
    priceCents: 349,
    unit: 'each',
    source: 'Axon Demo'
  },
  {
    id: 'DEMO-DAIRY-EGGS-DOZEN-001',
    sku: 'DEMO-EGGS-DOZEN-001',
    barcode: 'DEMO-EGGS-DOZEN-001',
    name: 'Eggs - Dozen',
    brand: '',
    quantity: '12 ct',
    category: 'eggs',
    imageUrl: '/grocery/images/eggs.svg',
    priceCents: 299,
    unit: 'each',
    source: 'Axon Demo'
  },
  {
    id: 'DEMO-BAKERY-BREAD-WHITE-001',
    sku: 'DEMO-BREAD-WHITE-001',
    barcode: 'DEMO-BREAD-WHITE-001',
    name: 'White Bread',
    brand: '',
    quantity: '20 oz loaf',
    category: 'bread',
    imageUrl: '/grocery/images/bread.svg',
    priceCents: 249,
    unit: 'each',
    source: 'Axon Demo'
  },
  {
    id: 'DEMO-CHEDDAR-001',
    sku: 'DEMO-CHEDDAR-001',
    barcode: 'DEMO-CHEDDAR-001',
    name: 'Sharp Cheddar Cheese',
    brand: '',
    quantity: '8 oz',
    category: 'sharp cheddar cheese',
    imageUrl: '/grocery/images/cheddar.svg',
    priceCents: 299,
    unit: 'each',
    source: 'Axon Demo'
  },
  {
    id: 'DEMO-CHEDDAR-002',
    sku: 'DEMO-CHEDDAR-002',
    barcode: 'DEMO-CHEDDAR-002',
    name: 'Sharp Cheddar Cheese',
    brand: '',
    quantity: '8 oz',
    category: 'sharp cheddar cheese',
    imageUrl: '/grocery/images/cheddar.svg',
    priceCents: 349,
    unit: 'each',
    source: 'Axon Demo'
  },
  {
    id: 'DEMO-CHEDDAR-003',
    sku: 'DEMO-CHEDDAR-003',
    barcode: 'DEMO-CHEDDAR-003',
    name: 'Sharp Cheddar Cheese',
    brand: '',
    quantity: '12 oz',
    category: 'sharp cheddar cheese',
    imageUrl: '/grocery/images/cheddar.svg',
    priceCents: 449,
    unit: 'each',
    source: 'Axon Demo'
  }
]

async function fetchPage(page, category) {
  const url = new URL('https://world.openfoodfacts.org/api/v2/search')
  url.searchParams.set('countries_tags_en', 'united-states')
  if (category) url.searchParams.set('categories_tags', category)
  url.searchParams.set('fields', 'code,product_name,brands,quantity,image_front_url,image_url,categories_tags_en')
  url.searchParams.set('sort_by', 'popularity_key')
  url.searchParams.set('page_size', String(PAGE_SIZE))
  url.searchParams.set('page', String(page))
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } })
  if (!res.ok) throw new Error(`OFF ${res.status} on page ${page} ${category || ''}`)
  return res.json()
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function main() {
  const bySku = new Map()
  if (fs.existsSync(outPublic)) {
    try {
      for (const p of JSON.parse(fs.readFileSync(outPublic, 'utf8'))) {
        if (p?.sku) bySku.set(p.sku, p)
      }
    } catch {}
  }

  for (const category of [null, ...CATEGORIES]) {
    const offCount = () => [...bySku.values()].filter((p) => p.source !== 'Axon Demo').length
    if (offCount() >= TARGET) break
    for (let page = 1; page <= 4 && offCount() < TARGET; page++) {
      try {
        const data = await fetchPage(page, category)
        const products = Array.isArray(data.products) ? data.products : []
        let added = 0
        for (const raw of products) {
          const item = normalizeOff(raw)
          if (!item || bySku.has(item.sku)) continue
          bySku.set(item.sku, item)
          added++
          if (bySku.size >= TARGET) break
        }
        console.log(`${category || 'all'} p${page}: +${added} (total ${bySku.size})`)
        if (!products.length) break
      } catch (err) {
        console.warn(String(err.message || err))
        await sleep(2500)
      }
      await sleep(1200)
    }
  }

  const off = [...bySku.values()].filter((p) => p.source !== 'Axon Demo')
  const withImage = off.filter((p) => p.imageUrl)
  const without = off.filter((p) => !p.imageUrl)
  const preferred = [...withImage, ...without].slice(0, TARGET)

  const merged = new Map()
  for (const p of preferred) merged.set(p.sku, p)
  for (const p of STAPLES) merged.set(p.sku, p)

  const catalog = [...merged.values()]
  const json = JSON.stringify(catalog, null, 2)
  fs.mkdirSync(path.dirname(outPublic), { recursive: true })
  fs.mkdirSync(path.dirname(outData), { recursive: true })
  fs.writeFileSync(outPublic, json)
  fs.writeFileSync(outData, json)
  console.log(`wrote ${catalog.length} products`)
  if (catalog.length < TARGET + STAPLES.length - 5) {
    console.warn('catalog is thinner than 1000 OFF items; staples are still included')
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
