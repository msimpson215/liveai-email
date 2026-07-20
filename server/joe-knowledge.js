/**
 * Joe's Professional Assistant — uploaded teaching docs.
 * Stored under data/joe-knowledge/ as plain text extracts.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..', 'data', 'joe-knowledge')
const MAX_DOCS = 40
const MAX_CHARS_PER_DOC = 40_000
const MAX_INJECT_CHARS = 12_000

function ensureDir() {
  if (!fs.existsSync(ROOT)) fs.mkdirSync(ROOT, { recursive: true })
}

function safeName(name) {
  const base = String(name || 'document')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 80) || 'document'
  return base.endsWith('.txt') ? base : `${base}.txt`
}

function listDocs() {
  ensureDir()
  return fs.readdirSync(ROOT)
    .filter(f => f.endsWith('.txt'))
    .map(f => {
      const full = path.join(ROOT, f)
      const st = fs.statSync(full)
      return {
        id: f,
        name: f.replace(/^\d+-/, '').replace(/\.txt$/i, ''),
        bytes: st.size,
        updatedAt: st.mtime.toISOString()
      }
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

function saveDoc(filename, text) {
  ensureDir()
  const clean = String(text || '').replace(/\0/g, '').trim()
  if (!clean) throw new Error('Document was empty after reading.')
  const clipped = clean.slice(0, MAX_CHARS_PER_DOC)
  const id = `${Date.now()}-${safeName(filename)}`
  fs.writeFileSync(path.join(ROOT, id), clipped, 'utf8')

  // Cap total docs
  const all = listDocs()
  if (all.length > MAX_DOCS) {
    for (const old of all.slice(MAX_DOCS)) {
      try { fs.unlinkSync(path.join(ROOT, old.id)) } catch { /* ignore */ }
    }
  }
  return { id, name: filename, chars: clipped.length }
}

function deleteDoc(id) {
  const safe = path.basename(String(id || ''))
  if (!safe.endsWith('.txt')) return false
  const full = path.join(ROOT, safe)
  if (!fs.existsSync(full)) return false
  fs.unlinkSync(full)
  return true
}

/** Compact snippet injected into the voice / chat brain. */
function knowledgeSnippet() {
  ensureDir()
  const docs = listDocs()
  if (!docs.length) {
    return 'TEACHING DOCS: none uploaded yet. If Joe uploads SOPs or notes, use those facts first.'
  }
  let budget = MAX_INJECT_CHARS
  const parts = [`TEACHING DOCS (${docs.length} on file) — treat as Joe's approved knowledge:`]
  for (const doc of docs) {
    if (budget < 400) break
    const body = fs.readFileSync(path.join(ROOT, doc.id), 'utf8')
    const slice = body.slice(0, Math.min(2500, budget - 80))
    parts.push(`\n--- ${doc.name} ---\n${slice}`)
    budget -= slice.length + doc.name.length + 20
  }
  return parts.join('\n')
}

export { listDocs, saveDoc, deleteDoc, knowledgeSnippet, ROOT }
