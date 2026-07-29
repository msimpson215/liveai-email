/**
 * Axon long-term memory bank.
 *
 * Every talk is auto-summarized and stored. Next session loads those
 * summaries silently so the assistant can recall things from months ago.
 *
 * Each person gets their OWN bank file, so what Rachel says never leaks
 * into Tim's session. Storage: data/joe-memory/<person>.json
 * Joe keeps the original summaries.json so existing history survives.
 *
 * Retention: keeps many months of session summaries + monthly digests.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..', 'data', 'joe-memory')
const DEFAULT_PERSON = 'joe'

/** Person name/slug → safe file key. Anything unusable falls back to Joe. */
function personKey(person) {
  const key = String(person || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  return key || DEFAULT_PERSON
}

/**
 * Joe's history predates per-person banks and lives in summaries.json.
 * Everyone else gets <person>.json.
 */
function bankFile(person) {
  const key = personKey(person)
  return key === DEFAULT_PERSON
    ? path.join(ROOT, 'summaries.json')
    : path.join(ROOT, `${key}.json`)
}

function bankRelPath(person) {
  return path.join('data', 'joe-memory', path.basename(bankFile(person)))
}

/** Plenty of headroom for ~daily use over many months. */
const MAX_ENTRIES = 800
const MAX_INJECT_CHARS = 12_000
const MAX_SUMMARY_CHARS = 1200
/** Recent window kept in fuller detail when injecting into the model. */
const RECENT_DAYS = 45
const RECENT_INJECT_LIMIT = 40
const OLDER_INJECT_LIMIT = 60

function ensureDir() {
  if (!fs.existsSync(ROOT)) fs.mkdirSync(ROOT, { recursive: true })
}

function readAll(person) {
  ensureDir()
  const file = bankFile(person)
  if (!fs.existsSync(file)) return []
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'))
    return Array.isArray(raw) ? raw : []
  } catch {
    return []
  }
}

function writeAll(entries, person) {
  ensureDir()
  fs.writeFileSync(bankFile(person), JSON.stringify(entries, null, 2), 'utf8')
}

function listMemories(person) {
  return readAll(person).slice().sort((a, b) => String(b.at).localeCompare(String(a.at)))
}

function monthKey(iso) {
  return String(iso || '').slice(0, 7) // YYYY-MM
}

function daysAgo(iso) {
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return Infinity
  return (Date.now() - t) / (24 * 60 * 60 * 1000)
}

function saveSummary(summary, meta = {}) {
  const clean = String(summary || '').replace(/\0/g, '').trim().slice(0, MAX_SUMMARY_CHARS)
  if (!clean) return null
  const person = personKey(meta.person)
  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: new Date().toISOString(),
    summary: clean,
    source: meta.source || 'session',
    kind: meta.kind || 'session',
    month: monthKey(new Date().toISOString()),
    person,
    turns: Number(meta.turns) || 0
  }
  const all = readAll(person)
  all.push(entry)
  const trimmed = all.length > MAX_ENTRIES ? all.slice(all.length - MAX_ENTRIES) : all
  writeAll(trimmed, person)
  return entry
}

/**
 * Build / refresh a monthly digest from session summaries in that month.
 * Keeps older months recallable without stuffing every session into the prompt.
 */
function upsertMonthDigest(month, text, person) {
  const clean = String(text || '').replace(/\0/g, '').trim().slice(0, MAX_SUMMARY_CHARS)
  if (!month || !clean) return null
  const key = personKey(person)
  const all = readAll(key)
  const existingIdx = all.findIndex(e => e.kind === 'month_digest' && e.month === month)
  const entry = {
    id: existingIdx >= 0 ? all[existingIdx].id : `digest-${month}`,
    at: new Date().toISOString(),
    summary: clean,
    source: 'rollup',
    kind: 'month_digest',
    month,
    person: key,
    turns: 0
  }
  if (existingIdx >= 0) all[existingIdx] = entry
  else all.push(entry)
  writeAll(all.length > MAX_ENTRIES ? all.slice(all.length - MAX_ENTRIES) : all, key)
  return entry
}

/** Sessions for a month (excludes digests). */
function sessionsForMonth(month, person) {
  return readAll(person).filter(
    e => (e.kind || 'session') !== 'month_digest' && monthKey(e.at) === month
  )
}

/**
 * Compact block injected into voice + text instructions automatically.
 * Recent sessions in detail; older months via digests / short dated lines.
 */
function memorySnippet(person) {
  const who = personKey(person)
  const label = who.charAt(0).toUpperCase() + who.slice(1)
  const all = listMemories(who)
  if (!all.length) {
    return `LONG-TERM MEMORY: none yet. As you talk with ${label}, summaries will accumulate automatically in their own private memory bank.`
  }

  const sessions = all.filter(e => (e.kind || 'session') !== 'month_digest')
  const digests = all.filter(e => e.kind === 'month_digest')
  const recent = sessions.filter(e => daysAgo(e.at) <= RECENT_DAYS).slice(0, RECENT_INJECT_LIMIT)
  const olderSessions = sessions.filter(e => daysAgo(e.at) > RECENT_DAYS)

  // Prefer month digests for older history; fall back to short session lines.
  const digestByMonth = new Map(digests.map(d => [d.month, d]))
  const olderMonths = [...new Set(olderSessions.map(e => monthKey(e.at)))].sort().reverse()

  let budget = MAX_INJECT_CHARS
  const parts = [
    `LONG-TERM MEMORY BANK for ${label} only (${sessions.length} session summaries` +
      (digests.length ? `, ${digests.length} monthly digests` : '') +
      `) — these are ${label}'s own conversations. Use naturally, like you have known them for months. Do NOT dump this list unless they ask what you remember:`,
    '',
    'RECENT (last ~45 days):'
  ]

  const push = (line) => {
    if (budget < 80) return false
    const slice = line.slice(0, Math.min(line.length, budget - 20))
    parts.push(slice)
    budget -= slice.length + 1
    return true
  }

  for (const m of recent) {
    if (!push(`- [${m.at.slice(0, 10)}] ${m.summary}`)) break
  }

  if (olderMonths.length && budget > 200) {
    parts.push('')
    push('OLDER MONTHS (still in the bank — recall if relevant):')
    let olderCount = 0
    for (const month of olderMonths) {
      if (olderCount >= OLDER_INJECT_LIMIT) break
      const digest = digestByMonth.get(month)
      if (digest) {
        if (!push(`- [${month}] ${digest.summary}`)) break
        olderCount++
        continue
      }
      // No digest yet — inject a few short session lines from that month
      const monthSessions = olderSessions.filter(e => monthKey(e.at) === month).slice(0, 3)
      for (const m of monthSessions) {
        if (!push(`- [${m.at.slice(0, 10)}] ${m.summary.slice(0, 280)}`)) break
        olderCount++
      }
    }
  }

  return parts.join('\n')
}

function status(person) {
  const who = personKey(person)
  const all = listMemories(who)
  const sessions = all.filter(e => (e.kind || 'session') !== 'month_digest')
  const digests = all.filter(e => e.kind === 'month_digest')
  const oldest = sessions.length ? sessions[sessions.length - 1] : null
  return {
    person: who,
    count: sessions.length,
    digests: digests.length,
    latestAt: sessions[0]?.at || null,
    oldestAt: oldest?.at || null,
    bankPath: bankRelPath(who)
  }
}

export {
  listMemories,
  saveSummary,
  upsertMonthDigest,
  sessionsForMonth,
  memorySnippet,
  status,
  personKey,
  ROOT,
  MAX_SUMMARY_CHARS,
  monthKey
}
