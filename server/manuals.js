/**
 * Instruction manuals you can talk to.
 *
 * Someone with a box of parts and greasy hands cannot hold a phone and scroll a
 * PDF. Drop the manual in, get a QR code, stick it on the box: scanning it
 * opens a voice assistant that has read the whole thing and walks you through
 * it one step at a time while your hands stay on the job.
 *
 * Storage: data/manuals/<slug>.json — the extracted text and a title, nothing else.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..', 'data', 'manuals')

/**
 * Manuals that ship with the code.
 *
 * A QR code stuck on a box has to keep working. Uploads land on Render's disk,
 * which is wiped on every deploy, so anything meant to last is committed here
 * and read from the repo. Uploads win when both exist, so a newer version of
 * the same instructions replaces the shipped one until the next deploy.
 */
const SEED = path.join(__dirname, '..', 'manuals')

const MAX_CHARS = 60_000
const MAX_INJECT = 40_000

function slugify(name) {
  const base = String(name || 'manual')
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
  return base || 'manual'
}

function fileFor(slug) {
  return path.join(ROOT, `${path.basename(slug)}.json`)
}

/** Uploaded copy if there is one, otherwise the copy that ships with the code. */
function anyFileFor(slug) {
  const uploaded = fileFor(slug)
  if (fs.existsSync(uploaded)) return uploaded
  const seeded = path.join(SEED, `${path.basename(slug)}.json`)
  return fs.existsSync(seeded) ? seeded : null
}

function list() {
  const seen = new Map()
  for (const dir of [SEED, ROOT]) {          // uploads listed second so they win
    if (!fs.existsSync(dir)) continue
    for (const f of fs.readdirSync(dir).filter(n => n.endsWith('.json'))) {
      try {
        const raw = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))
        seen.set(raw.slug, {
          slug: raw.slug,
          title: raw.title,
          addedAt: raw.addedAt,
          chars: (raw.text || '').length,
          shipped: dir === SEED
        })
      } catch { /* skip anything unreadable */ }
    }
  }
  return [...seen.values()].sort((a, b) => String(b.addedAt).localeCompare(String(a.addedAt)))
}

function get(slug) {
  const file = anyFileFor(slugify(slug))
  if (!file) return null
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}

/**
 * A filename is usually a poor name for a manual ("bedrail.pdf"), while the
 * document itself nearly always says what it is in its first few lines. Take
 * the longest line that reads like a product name, and fall back to the file.
 */
function titleFromText(text, fallback) {
  const lines = String(text || '')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 6 && l.length < 70)
    .slice(0, 12)
    .filter(l =>
      !/^page \d|^\d+ of \d+|warning|caution|copyright|^www\.|@/i.test(l) &&
      /[a-z]/.test(l) &&
      (l.match(/[A-Za-z]/g) || []).length > 6)
  // A product line usually carries a number or a size; prefer one that does.
  const named = lines.find(l => /\d/.test(l)) || lines[0]
  return named || fallback
}

function save(title, text, wanted) {
  const body = String(text || '').replace(/\0/g, '').trim()
  if (body.length < 80) throw new Error('There was no readable text in that file. A scanned photo of a page will not work; the PDF has to have real text in it.')
  fs.mkdirSync(ROOT, { recursive: true })

  // A slug people can read, kept unique so a second upload does not silently
  // overwrite the first.
  let slug = slugify(wanted || title)
  if (fs.existsSync(fileFor(slug))) {
    let n = 2
    while (fs.existsSync(fileFor(`${slug}-${n}`))) n++
    slug = `${slug}-${n}`
  }

  const entry = {
    slug,
    title: String(titleFromText(body, title) || 'Instructions').trim().slice(0, 120),
    addedAt: new Date().toISOString(),
    text: body.slice(0, MAX_CHARS)
  }
  fs.writeFileSync(fileFor(slug), JSON.stringify(entry, null, 2), 'utf8')
  return entry
}

function remove(slug) {
  const file = fileFor(slugify(slug))
  if (!fs.existsSync(file)) return false
  fs.unlinkSync(file)
  return true
}

/** The whole manual, handed to the assistant verbatim. */
function promptBlock(slug) {
  const entry = get(slug)
  if (!entry) return ''
  return `THE INSTRUCTIONS, IN FULL — this is "${entry.title}". Everything you say about this product comes from here and nowhere else:\n\n${entry.text.slice(0, MAX_INJECT)}`
}

export { list, get, save, remove, promptBlock, slugify, ROOT, SEED }
