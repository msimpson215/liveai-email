/**
 * The business profile that builds up underneath the conversation.
 *
 * Tim's seven guides supply the questions (sabc-questions.js). This holds what
 * a particular founder has said about them: what is answered, what was skipped,
 * what they asked to come back to, where the conversation was when it stopped,
 * and the contradictions worth raising next time.
 *
 * It lives beside that founder's uploaded documents, under the same code, so
 * one code is one business and nothing crosses between them.
 */

import fs from 'fs'
import path from 'path'
import { QUESTIONS, BY_ID, PROFILE_FIELDS, FIELD_SET, GUIDE_TITLES } from './sabc-questions.js'
import { ROOT as FILE_ROOT } from './founder-file.js'

const STATES = new Set(['answered', 'partial', 'skipped', 'later'])
const MAX_VALUE_CHARS = 1200
const MAX_LOOPS = 12
const MAX_CONTRADICTIONS = 20
const MAX_SESSIONS = 60
const MAX_HISTORY_PER_FIELD = 6

function fileFor(key) {
  return path.join(FILE_ROOT, key, 'profile.json')
}

function blank() {
  return {
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    profile: {},
    questions: {},
    openLoops: [],
    contradictions: [],
    lastPlace: '',
    sessions: []
  }
}

function load(key) {
  if (!key) return blank()
  const file = fileFor(key)
  if (!fs.existsSync(file)) return blank()
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'))
    return { ...blank(), ...raw }
  } catch {
    return blank()
  }
}

function save(key, state) {
  if (!key) return null
  fs.mkdirSync(path.join(FILE_ROOT, key), { recursive: true })
  state.updatedAt = new Date().toISOString()
  fs.writeFileSync(fileFor(key), JSON.stringify(state, null, 2), 'utf8')
  return state
}

const clean = (value, max = MAX_VALUE_CHARS) =>
  String(value == null ? '' : value).replace(/\0/g, '').trim().slice(0, max)

/**
 * Fold one bookkeeping pass into the stored profile.
 *
 * A field is never blindly overwritten: the previous value is kept in history,
 * which is what makes "you said thirty-five percent in March, this says
 * eighteen" possible months later.
 */
function applyUpdate(key, update = {}, meta = {}) {
  const state = load(key)
  const at = new Date().toISOString()
  const source = meta.source === 'document' ? 'document' : 'conversation'
  const changed = []

  for (const [rawField, rawValue] of Object.entries(update.profile || {})) {
    const field = String(rawField)
    if (!FIELD_SET.has(field)) continue
    const value = clean(rawValue)
    if (!value) continue
    const existing = state.profile[field]
    if (existing && existing.value === value) continue
    const history = existing ? [{ value: existing.value, at: existing.updatedAt, source: existing.source }, ...(existing.history || [])] : []
    state.profile[field] = {
      value,
      updatedAt: at,
      source,
      history: history.slice(0, MAX_HISTORY_PER_FIELD)
    }
    changed.push(field)
  }

  for (const [rawId, rawState] of Object.entries(update.questions || {})) {
    const id = String(rawId).toUpperCase()
    if (!BY_ID.has(id)) continue
    const next = typeof rawState === 'string' ? rawState : rawState?.state
    if (!STATES.has(next)) continue
    const previous = state.questions[id]
    // An answer never regresses to skipped just because it did not come up again.
    if (previous?.state === 'answered' && next !== 'answered') continue
    state.questions[id] = {
      state: next,
      at,
      note: clean(typeof rawState === 'object' ? rawState.note : '', 240)
    }
  }

  if (Array.isArray(update.openLoops)) {
    state.openLoops = update.openLoops.map(l => clean(l, 200)).filter(Boolean).slice(0, MAX_LOOPS)
  }
  for (const item of (Array.isArray(update.contradictions) ? update.contradictions : [])) {
    const note = clean(typeof item === 'string' ? item : item?.note, 400)
    if (!note) continue
    if (state.contradictions.some(c => c.note === note)) continue
    state.contradictions.unshift({ at, note, source })
  }
  state.contradictions = state.contradictions.slice(0, MAX_CONTRADICTIONS)

  if (update.lastPlace) state.lastPlace = clean(update.lastPlace, 300)
  if (update.sessionSummary) {
    state.sessions.unshift({ at, summary: clean(update.sessionSummary, 800), turns: Number(meta.turns) || 0, source })
    state.sessions = state.sessions.slice(0, MAX_SESSIONS)
  }

  save(key, state)
  return { changed, state }
}

/* ---------- reading it back ---------- */

function stats(key) {
  const state = load(key)
  const counts = { answered: 0, partial: 0, skipped: 0, later: 0, open: 0 }
  for (const q of QUESTIONS) {
    const s = state.questions[q.id]?.state
    if (s && counts[s] !== undefined) counts[s] += 1
    else counts.open += 1
  }
  return {
    total: QUESTIONS.length,
    ...counts,
    fields: Object.keys(state.profile).length,
    sessions: state.sessions.length,
    lastAt: state.sessions[0]?.at || null,
    updatedAt: state.updatedAt
  }
}

/**
 * The questions worth raising next: never asked, or half answered, in guide
 * order, skipping anything the person parked.
 */
function nextQuestions(key, limit = 8) {
  const state = load(key)
  const open = []
  const partial = []
  for (const q of QUESTIONS) {
    const s = state.questions[q.id]?.state
    if (!s) open.push(q)
    else if (s === 'partial') partial.push(q)
  }
  // Half-answered first: finishing a thought beats starting a new one.
  return [...partial, ...open].slice(0, limit)
}

/** Everything the person parked for later, so it can be brought back. */
function parked(key) {
  const state = load(key)
  return QUESTIONS
    .filter(q => ['later', 'skipped'].includes(state.questions[q.id]?.state))
    .map(q => ({ id: q.id, ask: q.ask, state: state.questions[q.id].state }))
}

/**
 * What gets injected into the live conversation. Written as briefing notes for
 * a consultant walking back into a meeting, not as data.
 */
function promptBlock(key, { limit = 8 } = {}) {
  const state = load(key)
  const s = stats(key)
  if (!s.answered && !s.partial && !Object.keys(state.profile).length) {
    return `WHAT YOU ALREADY KNOW ABOUT THIS PERSON: nothing yet — this is the first conversation. Start by asking what they are building, let them talk, and take note of everything they cover.`
  }

  const lines = [
    `WHAT YOU ALREADY KNOW ABOUT THIS BUSINESS (from ${s.sessions} previous ${s.sessions === 1 ? 'conversation' : 'conversations'} and their documents). Talk as though you remember it, because you do. Never read this back as a list:`
  ]

  for (const field of PROFILE_FIELDS) {
    const entry = state.profile[field]
    if (!entry) continue
    lines.push(`- ${field}: ${entry.value}${entry.source === 'document' ? ' (from a document they uploaded)' : ''}`)
  }

  if (state.lastPlace) {
    lines.push('', `WHERE YOU LEFT OFF: ${state.lastPlace}`)
  }

  const loops = state.openLoops.filter(Boolean)
  if (loops.length) {
    lines.push('', 'THINGS THEY WANTED TO COME BACK TO:')
    for (const loop of loops) lines.push(`- ${loop}`)
  }

  const conflicts = state.contradictions.slice(0, 5)
  if (conflicts.length) {
    lines.push('', 'WORTH RAISING GENTLY — what they said before does not match what you have now:')
    for (const c of conflicts) lines.push(`- [${c.at.slice(0, 10)}] ${c.note}`)
  }

  const next = nextQuestions(key, limit)
  if (next.length) {
    lines.push('', `STILL UNANSWERED, in priority order. Work these in when the conversation allows, in your own words, one at a time — never as a list, never as a form. ${s.answered} of ${s.total} are already covered, so do NOT ask about anything above:`)
    for (const q of next) {
      lines.push(`- (${q.id}, ${GUIDE_TITLES[q.guide]}) ${q.ask}`)
    }
  } else {
    lines.push('', 'Every question in the methodology has been covered at least once. Go deeper on what has changed, and on anything still marked as an assumption.')
  }

  const park = parked(key)
  if (park.length) {
    lines.push('', 'PARKED — they asked to leave these. Only revisit if they bring it up or a lot of time has passed:')
    for (const q of park.slice(0, 8)) lines.push(`- ${q.ask}`)
  }

  return lines.join('\n')
}

/** Flat text of the profile, for the review writer and the PDF. */
function profileText(key) {
  const state = load(key)
  const lines = []
  for (const field of PROFILE_FIELDS) {
    const entry = state.profile[field]
    if (!entry) continue
    lines.push(`${field}: ${entry.value}`)
    const older = (entry.history || []).filter(h => h.value)
    if (older.length) {
      lines.push(`  earlier: ${older.map(h => `"${h.value.slice(0, 200)}" (${String(h.at).slice(0, 10)})`).join('; ')}`)
    }
  }
  if (state.contradictions.length) {
    lines.push('', 'noted mismatches:')
    for (const c of state.contradictions) lines.push(`- [${c.at.slice(0, 10)}] ${c.note}`)
  }
  const s = stats(key)
  lines.push('', `coverage: ${s.answered} of ${s.total} questions answered, ${s.partial} partly, ${s.skipped + s.later} parked, ${s.open} not yet raised`)
  const missing = nextQuestions(key, 12)
  if (missing.length) {
    lines.push('', 'not yet answered:')
    for (const q of missing) lines.push(`- ${q.ask}`)
  }
  if (state.sessions.length) {
    lines.push('', 'conversation history, newest first:')
    for (const session of state.sessions.slice(0, 12)) {
      lines.push(`- [${session.at.slice(0, 10)}] ${session.summary}`)
    }
  }
  return lines.join('\n')
}

/* ---------- portable copy ---------- */

function exportProfile(key) {
  const state = load(key)
  return {
    kind: 'startabusiness.center/business-profile',
    version: 1,
    exportedAt: new Date().toISOString(),
    profile: state.profile,
    questions: state.questions,
    openLoops: state.openLoops,
    contradictions: state.contradictions,
    lastPlace: state.lastPlace,
    sessions: state.sessions
  }
}

/** Bring a downloaded profile back, on any device, however long afterwards. */
function importProfile(key, incoming) {
  if (!key) throw new Error('No code to import into.')
  if (!incoming || incoming.kind !== 'startabusiness.center/business-profile') {
    throw new Error('That is not a business profile file.')
  }
  const state = load(key)
  const merged = { ...state }
  merged.profile = { ...state.profile }
  for (const [field, entry] of Object.entries(incoming.profile || {})) {
    if (!FIELD_SET.has(field) || !entry?.value) continue
    const existing = merged.profile[field]
    // Whichever is newer wins; the other becomes history.
    if (!existing || String(entry.updatedAt || '') > String(existing.updatedAt || '')) {
      merged.profile[field] = {
        value: clean(entry.value),
        updatedAt: entry.updatedAt || new Date().toISOString(),
        source: entry.source === 'document' ? 'document' : 'conversation',
        history: [...(existing ? [{ value: existing.value, at: existing.updatedAt, source: existing.source }] : []), ...(entry.history || [])].slice(0, MAX_HISTORY_PER_FIELD)
      }
    }
  }
  merged.questions = { ...state.questions }
  for (const [id, entry] of Object.entries(incoming.questions || {})) {
    const upper = String(id).toUpperCase()
    if (!BY_ID.has(upper)) continue
    const next = entry?.state
    if (!STATES.has(next)) continue
    if (merged.questions[upper]?.state === 'answered') continue
    merged.questions[upper] = { state: next, at: entry.at || new Date().toISOString(), note: clean(entry.note, 240) }
  }
  const seen = new Set(merged.contradictions.map(c => c.note))
  for (const c of (incoming.contradictions || [])) {
    const note = clean(c?.note, 400)
    if (!note || seen.has(note)) continue
    merged.contradictions.push({ at: c.at || new Date().toISOString(), note, source: c.source || 'conversation' })
  }
  merged.contradictions = merged.contradictions.slice(0, MAX_CONTRADICTIONS)
  merged.openLoops = [...new Set([...(incoming.openLoops || []).map(l => clean(l, 200)), ...merged.openLoops])].filter(Boolean).slice(0, MAX_LOOPS)
  merged.lastPlace = merged.lastPlace || clean(incoming.lastPlace, 300)
  merged.sessions = [...merged.sessions, ...(incoming.sessions || []).map(s => ({
    at: s.at || new Date().toISOString(),
    summary: clean(s.summary, 800),
    turns: Number(s.turns) || 0,
    source: s.source || 'conversation'
  }))]
    .filter((s, i, all) => all.findIndex(o => o.at === s.at && o.summary === s.summary) === i)
    .sort((a, b) => String(b.at).localeCompare(String(a.at)))
    .slice(0, MAX_SESSIONS)

  save(key, merged)
  return stats(key)
}

function forget(key) {
  if (!key) return false
  const file = fileFor(key)
  if (!fs.existsSync(file)) return false
  fs.unlinkSync(file)
  return true
}

export {
  load,
  save,
  applyUpdate,
  stats,
  nextQuestions,
  parked,
  promptBlock,
  profileText,
  exportProfile,
  importProfile,
  forget
}
