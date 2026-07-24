/**
 * Joe's Professional Assistant — long-term session memory.
 * Summaries auto-saved after talks; silently re-injected on the next session.
 * Stored under data/joe-memory/ (same pattern as teaching docs).
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..', 'data', 'joe-memory')
const INDEX = path.join(ROOT, 'summaries.json')
const MAX_ENTRIES = 200
const MAX_INJECT_CHARS = 10_000
const MAX_SUMMARY_CHARS = 1200

function ensureDir() {
  if (!fs.existsSync(ROOT)) fs.mkdirSync(ROOT, { recursive: true })
}

function readAll() {
  ensureDir()
  if (!fs.existsSync(INDEX)) return []
  try {
    const raw = JSON.parse(fs.readFileSync(INDEX, 'utf8'))
    return Array.isArray(raw) ? raw : []
  } catch {
    return []
  }
}

function writeAll(entries) {
  ensureDir()
  fs.writeFileSync(INDEX, JSON.stringify(entries, null, 2), 'utf8')
}

function listMemories() {
  return readAll().slice().sort((a, b) => String(b.at).localeCompare(String(a.at)))
}

function saveSummary(summary, meta = {}) {
  const clean = String(summary || '').replace(/\0/g, '').trim().slice(0, MAX_SUMMARY_CHARS)
  if (!clean) return null
  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: new Date().toISOString(),
    summary: clean,
    source: meta.source || 'session',
    turns: Number(meta.turns) || 0
  }
  const all = readAll()
  all.push(entry)
  // Keep newest MAX_ENTRIES
  const trimmed = all.length > MAX_ENTRIES ? all.slice(all.length - MAX_ENTRIES) : all
  writeAll(trimmed)
  return entry
}

/** Compact block injected into voice + text instructions automatically. */
function memorySnippet() {
  const all = listMemories()
  if (!all.length) {
    return 'LONG-TERM MEMORY: none yet. As you talk with Joe, summaries will accumulate automatically.'
  }
  let budget = MAX_INJECT_CHARS
  const parts = [
    `LONG-TERM MEMORY (${all.length} session summaries — use naturally, like you have known Joe for a long time. Do NOT dump this list back at him unless he asks what you remember):`
  ]
  for (const m of all) {
    if (budget < 120) break
    const line = `- [${m.at.slice(0, 10)}] ${m.summary}`
    const slice = line.slice(0, Math.min(line.length, budget - 20))
    parts.push(slice)
    budget -= slice.length + 1
  }
  return parts.join('\n')
}

function status() {
  const all = listMemories()
  return {
    count: all.length,
    latestAt: all[0]?.at || null
  }
}

export { listMemories, saveSummary, memorySnippet, status, ROOT, MAX_SUMMARY_CHARS }
