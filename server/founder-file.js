/**
 * A founder's private file: the documents they upload and the written summaries
 * of their sessions.
 *
 * Everything hangs off a short code the founder keeps. No account, no email, no
 * name — the code is the whole identity, so a card handed to a stranger can
 * still remember them next month without collecting anything about them.
 *
 * Conversation memory is not here. That reuses the per-person memory bank in
 * joe-memory.js under the same key, so the digest and injection logic stays in
 * one place.
 *
 * Storage: data/founder-files/<key>/docs/*.txt and .../summaries/*.json
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..', 'data', 'founder-files')

const MAX_DOCS = 12
const MAX_CHARS_PER_DOC = 30_000
const MAX_INJECT_CHARS = 9_000
const MAX_SUMMARIES = 40

/**
 * A code becomes a directory name, so this is the only place it is trusted.
 * Anything that does not survive the scrub is rejected rather than pooled into
 * a shared bucket — one founder must never read another's file.
 */
function keyFor(code) {
  const key = String(code || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  return /^[a-z0-9][a-z0-9-]{3,}$/.test(key) ? `f-${key}` : ''
}

function dirFor(key, kind) {
  return path.join(ROOT, key, kind)
}

function ensure(key, kind) {
  const dir = dirFor(key, kind)
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

/* ---------- documents ---------- */

function safeName(name) {
  const base = String(name || 'document')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 70) || 'document'
  return base.endsWith('.txt') ? base : `${base}.txt`
}

function listDocs(key) {
  if (!key) return []
  const dir = dirFor(key, 'docs')
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.txt'))
    .map(f => {
      const st = fs.statSync(path.join(dir, f))
      return {
        id: f,
        name: f.replace(/^\d+-/, '').replace(/\.txt$/i, ''),
        bytes: st.size,
        updatedAt: st.mtime.toISOString()
      }
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

function saveDoc(key, filename, text) {
  if (!key) throw new Error('No code for this file.')
  const clean = String(text || '').replace(/\0/g, '').trim()
  if (!clean) throw new Error('That file had no readable text in it.')
  const dir = ensure(key, 'docs')
  const id = `${Date.now()}-${safeName(filename)}`
  fs.writeFileSync(path.join(dir, id), clean.slice(0, MAX_CHARS_PER_DOC), 'utf8')

  // Oldest out first, so uploading a thirteenth statement never silently
  // pushes the assistant over its context budget.
  for (const old of listDocs(key).slice(MAX_DOCS)) {
    try { fs.unlinkSync(path.join(dir, old.id)) } catch { /* ignore */ }
  }
  return { id, name: filename, chars: Math.min(clean.length, MAX_CHARS_PER_DOC) }
}

function deleteDoc(key, id) {
  if (!key) return false
  const safe = path.basename(String(id || ''))
  if (!safe.endsWith('.txt')) return false
  const full = path.join(dirFor(key, 'docs'), safe)
  if (!fs.existsSync(full)) return false
  fs.unlinkSync(full)
  return true
}

/** What the assistant is told about this founder's own paperwork. */
function docsSnippet(key) {
  const docs = listDocs(key)
  if (!docs.length) {
    return `THEIR DOCUMENTS: none uploaded. They can upload a spreadsheet, statement, plan or notes with the upload button on the page, and you will have it in this session and every one after.`
  }
  let budget = MAX_INJECT_CHARS
  const parts = [
    `THEIR DOCUMENTS (${docs.length} on file, uploaded by this person) — these are their real numbers and notes. Use them when answering, quote figures from them accurately, and never invent a number that is not in them:`
  ]
  for (const doc of docs) {
    if (budget < 400) break
    let body = ''
    try { body = fs.readFileSync(path.join(dirFor(key, 'docs'), doc.id), 'utf8') } catch { continue }
    const slice = body.slice(0, Math.min(2600, budget - 90))
    parts.push(`\n--- ${doc.name} (uploaded ${doc.updatedAt.slice(0, 10)}) ---\n${slice}`)
    budget -= slice.length + doc.name.length + 30
  }
  return parts.join('\n')
}

/* ---------- written summaries ---------- */

function listSummaries(key) {
  if (!key) return []
  const dir = dirFor(key, 'summaries')
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .map(f => {
      try {
        const raw = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))
        return { id: raw.id, at: raw.at, title: raw.title }
      } catch {
        return null
      }
    })
    .filter(Boolean)
    .sort((a, b) => String(b.at).localeCompare(String(a.at)))
}

function saveSummary(key, { title, text }) {
  if (!key) throw new Error('No code for this summary.')
  const body = String(text || '').trim()
  if (!body) throw new Error('Nothing to summarize yet.')
  const dir = ensure(key, 'summaries')
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const entry = {
    id,
    at: new Date().toISOString(),
    title: String(title || 'Session summary').slice(0, 120),
    text: body.slice(0, 20_000)
  }
  fs.writeFileSync(path.join(dir, `${id}.json`), JSON.stringify(entry, null, 2), 'utf8')
  for (const old of listSummaries(key).slice(MAX_SUMMARIES)) {
    try { fs.unlinkSync(path.join(dir, `${old.id}.json`)) } catch { /* ignore */ }
  }
  return entry
}

function getSummary(key, id) {
  if (!key) return null
  const safe = path.basename(String(id || ''))
  const full = path.join(dirFor(key, 'summaries'), `${safe}.json`)
  if (!fs.existsSync(full)) return null
  try {
    return JSON.parse(fs.readFileSync(full, 'utf8'))
  } catch {
    return null
  }
}

/* ---------- housekeeping ---------- */

function status(key) {
  return {
    docs: listDocs(key).map(d => ({ id: d.id, name: d.name, updatedAt: d.updatedAt })),
    summaries: listSummaries(key)
  }
}

/** Erase everything held under a code. The founder's own delete button. */
function forget(key) {
  if (!key) return false
  const dir = path.join(ROOT, key)
  if (!fs.existsSync(dir)) return false
  fs.rmSync(dir, { recursive: true, force: true })
  return true
}

export {
  keyFor,
  listDocs,
  saveDoc,
  deleteDoc,
  docsSnippet,
  listSummaries,
  saveSummary,
  getSummary,
  status,
  forget,
  ROOT
}
