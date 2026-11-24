/**
 * Auto Auction Rebuilds Impersonation Review.
 * Seed listings plus saved decisions, reports, and Randy's trademark authorization.
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..', 'data', 'aar-review')
const STATE_FILE = path.join(ROOT, 'state.json')
const SHOTS_DIR = path.join(__dirname, '..', 'public', 'aar', 'evidence')

export const INTRO =
  "Randy, I did this half manually and half with AI. I wanted you to know I'm staying on it. I've put the screenshots and links in one place so you can tell me which listings are yours. Once we clear the old listings, we can start watching for new ones daily."

export const ANSWERS = ['mine', 'not_mine', 'mine_wrong', 'unsure']
export const MARKS = ['Official', 'Priority review', 'Directory correction', 'Evidence pending']
export const REPORT_STATUSES = ['Draft', 'Ready', 'Submitted', 'Resolved']
const REVIEWERS = new Set(['randy', 'marty'])

export const SHOTS = {
  'shot-01-fb-aar-auto-sale-byars': {
    id: 'shot-01-fb-aar-auto-sale-byars',
    file: 'shot-01-fb-aar-auto-sale-byars.svg',
    title: 'Facebook: AAR Auto Sale Byars',
    captured: '2026-11',
    notes: 'Full-page Facebook capture. Vehicle posts, aarautosalesbyars.com, 405-709-2236.'
  },
  'shot-02-fb-byars-ok-search-a': {
    id: 'shot-02-fb-byars-ok-search-a',
    file: 'shot-02-fb-byars-ok-search-a.svg',
    title: 'Facebook search: AAR Auto Sales | Byars OK',
    captured: '2026-11',
    notes: 'Search result showing 937-563-3715 and aar-autosales.com.'
  },
  'shot-03-fb-byars-ok-search-b': {
    id: 'shot-03-fb-byars-ok-search-b',
    file: 'shot-03-fb-byars-ok-search-b.svg',
    title: 'Facebook search: AAR Auto Sales | Byars OK (second capture)',
    captured: '2026-11',
    notes: 'Second search screenshot of the same Facebook result.'
  },
  'shot-04-velora-contact': {
    id: 'shot-04-velora-contact',
    file: 'shot-04-velora-contact.svg',
    title: 'Search: veloramotors.net/contact',
    captured: '2026-11',
    notes: 'Same dealership lot address under a different business name.'
  },
  'shot-05-directories-yelp-mapquest': {
    id: 'shot-05-directories-yelp-mapquest',
    file: 'shot-05-directories-yelp-mapquest.svg',
    title: 'Directory results: Yelp and MapQuest',
    captured: '2026-11',
    notes: 'Tractor imagery on Yelp. Equipment thumbnail next to MapQuest.'
  },
  'shot-06-manta-number': {
    id: 'shot-06-manta-number',
    file: 'shot-06-manta-number.svg',
    title: 'Directory: Manta',
    captured: '2026-11',
    notes: 'Manta number also appears on another business result.'
  }
}

const LINKS = {
  official: 'https://aarsales.com/',
  frankon: 'https://frankonfraud.com/dealer-cloning/sites.html',
  fbByars: 'https://www.facebook.com/p/AAR-Auto-Sale-Byars-61592472606226/',
  trademarkForm: 'https://www.facebook.com/help/contact/1057530390957243',
  metaGuidance: 'https://www.meta.com/help/policies/3234337743488413/',
  googleVoice: 'https://support.google.com/voice/answer/115061',
  yelp: 'https://www.yelp.com/biz/aar-auto-sales-byars',
  mapquest: 'https://www.mapquest.com/us/oklahoma/aar-auto-sales-430730621',
  buzzfile: 'https://www.buzzfile.com/business/AAR-Auto-Sales-LLC-405-479-9504',
  manta: 'https://www.manta.com/c/mkcksds/aar-auto-sales-llc',
  usjunkyards: 'https://usjunkyards.com/st-oklahoma/cy-mcclain/ci-byars/'
}

function listing(partial) {
  return {
    url: null,
    displayUrl: null,
    showDomainPlain: false,
    copyUrl: null,
    phones: [],
    observations: [],
    screenshots: [],
    evidenceSources: [],
    lastVerified: { status: 'unknown', at: null, note: '' },
    preserveOffline: false,
    reportPlatform: 'web',
    reportRoute: 'none',
    nextAction: '',
    ...partial
  }
}

export const SEED_LISTINGS = [
  listing({
    id: 'official-aarsales',
    mark: 'Official',
    name: 'Auto Auction Rebuilds',
    url: LINKS.official,
    displayUrl: LINKS.official,
    why: 'Official website. Use this as the reference when comparing dealership websites and contact details.',
    nextAction: 'Confirm this is the real site, then use it to check the others.',
    reportPlatform: 'web',
    reportRoute: 'none'
  }),
  listing({
    id: 'fb-aar-auto-sale-byars',
    mark: 'Priority review',
    name: 'Facebook: AAR Auto Sale Byars',
    url: LINKS.fbByars,
    displayUrl: LINKS.fbByars,
    phones: ['405-709-2236'],
    observations: [
      'Full-page Facebook screenshot shows vehicle posts.',
      'Page lists aarautosalesbyars.com and 405-709-2236.',
      'Both match a domain listed by FrankonFraud as a suspected dealer clone.'
    ],
    screenshots: ['shot-01-fb-aar-auto-sale-byars'],
    evidenceSources: [LINKS.frankon],
    why: 'The Facebook page lists aarautosalesbyars.com and 405-709-2236, both matching a FrankonFraud suspected dealer clone.',
    nextAction: 'Tell me if this Page is yours. If it is not, Marty can prepare an impersonation report.',
    reportPlatform: 'facebook',
    reportRoute: 'impersonation'
  }),
  listing({
    id: 'fb-aar-auto-sales-byars-ok',
    mark: 'Priority review',
    name: 'Facebook: AAR Auto Sales | Byars OK',
    url: null,
    displayUrl: null,
    phones: ['937-563-3715', '405-288-1526'],
    observations: [
      'This is a separate Facebook result from AAR Auto Sale Byars.',
      'Search screenshots showed 937-563-3715 and aar-autosales.com.',
      'The website’s indexed contact page showed a different number, 405-288-1526.',
      'Direct Facebook URL is blank until recovered. Do not invent it.'
    ],
    screenshots: ['shot-02-fb-byars-ok-search-a', 'shot-03-fb-byars-ok-search-b'],
    why: 'A separate Facebook result. Search showed 937-563-3715 and aar-autosales.com; the site contact page showed 405-288-1526.',
    nextAction: 'Tell me if this Page is yours. The direct Facebook URL is still missing.',
    reportPlatform: 'facebook',
    reportRoute: 'impersonation'
  }),
  listing({
    id: 'web-aar-autosalesus',
    mark: 'Priority review',
    name: 'aar-autosalesus.com',
    showDomainPlain: true,
    copyUrl: 'https://aar-autosalesus.com/',
    observations: ['Randy publicly identified this domain in his warning.'],
    why: 'Lookalike website Randy publicly identified in his warning.',
    nextAction: 'Tell me if this domain is yours. If not, Marty can prepare a host and registrar report.',
    preserveOffline: true,
    reportPlatform: 'web',
    reportRoute: 'trademark'
  }),
  listing({
    id: 'web-aar-autosales',
    mark: 'Priority review',
    name: 'aar-autosales.com',
    showDomainPlain: true,
    copyUrl: 'https://aar-autosales.com/',
    phones: ['405-288-1526'],
    observations: [
      'Indexed pages showed the same business address and 405-288-1526 as the domain Randy flagged.'
    ],
    screenshots: ['shot-02-fb-byars-ok-search-a'],
    why: 'Indexed pages showed the same business address and 405-288-1526 as the domain Randy flagged.',
    nextAction: 'Tell me if this domain is yours. Copy the URL only when a report needs it.',
    preserveOffline: true,
    reportPlatform: 'web',
    reportRoute: 'trademark'
  }),
  listing({
    id: 'web-aarautosalesbyars',
    mark: 'Priority review',
    name: 'aarautosalesbyars.com',
    showDomainPlain: true,
    copyUrl: 'https://aarautosalesbyars.com/',
    phones: ['405-709-2236'],
    observations: ['Matches the website and phone on Facebook Page 61592472606226.'],
    screenshots: ['shot-01-fb-aar-auto-sale-byars'],
    evidenceSources: [LINKS.frankon],
    why: 'Matches the website and phone listed on Facebook Page 61592472606226.',
    nextAction: 'Tell me if this domain is yours.',
    preserveOffline: true,
    reportPlatform: 'web',
    reportRoute: 'trademark'
  }),
  listing({
    id: 'web-aarautosalebyars',
    mark: 'Priority review',
    name: 'aarautosalebyars.com',
    showDomainPlain: true,
    copyUrl: 'https://aarautosalebyars.com/',
    phones: ['405-709-2236'],
    observations: [
      'Drops the “s” in “sales.”',
      'Indexed pages showed the same 405-709-2236 number as aarautosalesbyars.com.'
    ],
    why: 'Drops the “s” in “sales,” and indexed pages showed the same 405-709-2236 number as aarautosalesbyars.com.',
    nextAction: 'Tell me if this domain is yours.',
    preserveOffline: true,
    reportPlatform: 'web',
    reportRoute: 'trademark'
  }),
  listing({
    id: 'velora-motors',
    mark: 'Priority review',
    name: 'Velora Motors',
    url: 'https://veloramotors.net/contact',
    displayUrl: 'https://veloramotors.net/contact',
    observations: [
      'Search screenshot shows veloramotors.net/contact using the same dealership lot address under a different business name.',
      'Keep this separate from the truck or farm equipment lead. Do not assume a shared operator.'
    ],
    screenshots: ['shot-04-velora-contact'],
    why: 'The contact page uses the same dealership lot address under a different business name.',
    nextAction: 'Ask Randy whether he recognizes Velora Motors.',
    reportPlatform: 'web',
    reportRoute: 'none'
  }),
  listing({
    id: 'dir-yelp',
    mark: 'Directory correction',
    name: 'Yelp: AAR Auto Sales Byars',
    url: LINKS.yelp,
    displayUrl: LINKS.yelp,
    observations: [
      'Screenshot shows tractor imagery associated with this Yelp listing.',
      'Verify the photos, phone, website, and directions.',
      'A directory listing can look like independent confirmation to a buyer.'
    ],
    screenshots: ['shot-05-directories-yelp-mapquest'],
    why: 'Yelp can look like independent confirmation. The capture shows tractor imagery that needs to be checked.',
    nextAction: 'Tell me if this listing is yours, and whether the photo, phone, website, or directions are wrong.',
    reportPlatform: 'directory',
    reportRoute: 'directory'
  }),
  listing({
    id: 'dir-mapquest',
    mark: 'Directory correction',
    name: 'MapQuest: AAR Auto Sales',
    url: LINKS.mapquest,
    displayUrl: LINKS.mapquest,
    observations: [
      'Equipment thumbnail sits next to this MapQuest result.',
      'Verify the photos, phone, website, and directions.'
    ],
    screenshots: ['shot-05-directories-yelp-mapquest'],
    why: 'MapQuest can send buyers to the wrong number or location. An equipment thumbnail sits next to this result.',
    nextAction: 'Tell me if this listing is yours, and whether the photo, phone, website, or directions are wrong.',
    reportPlatform: 'directory',
    reportRoute: 'directory'
  }),
  listing({
    id: 'dir-buzzfile',
    mark: 'Directory correction',
    name: 'Buzzfile: AAR Auto Sales LLC',
    url: LINKS.buzzfile,
    displayUrl: LINKS.buzzfile,
    phones: ['405-479-9504'],
    observations: ['Verify the photos, phone, website, and directions. Do not claim who created or edited this listing.'],
    why: 'A directory page can look like independent confirmation. Check the phone, website, and directions.',
    nextAction: 'Tell me if this listing is yours, and whether any details are wrong.',
    reportPlatform: 'directory',
    reportRoute: 'directory'
  }),
  listing({
    id: 'dir-manta',
    mark: 'Directory correction',
    name: 'Manta: AAR Auto Sales LLC',
    url: LINKS.manta,
    displayUrl: LINKS.manta,
    observations: [
      'Manta screenshot shows a number that also appears on another business result.',
      'Verify the photos, phone, website, and directions. Do not claim who created or edited this listing.'
    ],
    screenshots: ['shot-06-manta-number'],
    why: 'The Manta number also appears on another business result, so the phone and details need a check.',
    nextAction: 'Tell me if this listing is yours, and whether the phone or other details are wrong.',
    reportPlatform: 'directory',
    reportRoute: 'directory'
  }),
  listing({
    id: 'dir-usjunkyards',
    mark: 'Directory correction',
    name: 'USJunkyards: Byars, McClain County',
    url: LINKS.usjunkyards,
    displayUrl: LINKS.usjunkyards,
    observations: ['Verify the photos, phone, website, and directions. Do not claim who created or edited this listing.'],
    why: 'A directory page can send customers to the wrong number or location.',
    nextAction: 'Tell me if this listing is yours, and whether any details are wrong.',
    reportPlatform: 'directory',
    reportRoute: 'directory'
  }),
  listing({
    id: 'evidence-truck',
    mark: 'Evidence pending',
    name: 'Truck or farm equipment listing',
    url: null,
    displayUrl: null,
    phones: [],
    observations: [
      'Marty called the listed number and heard a Google Voice greeting.',
      'The exact URL and number are still missing. Leave those fields blank.',
      'Google Voice alone does not establish fraud.'
    ],
    evidenceSources: [LINKS.googleVoice],
    why: 'Marty heard a Google Voice greeting on a listed number. The exact URL and number are still missing, and Google Voice alone does not establish fraud.',
    nextAction: 'Leave this pending until the URL and number are recovered. Keep it separate from Velora Motors.',
    reportPlatform: 'other',
    reportRoute: 'none'
  })
]

function blankReport(listing) {
  return {
    key: reportKey(listing),
    platform: listing.reportPlatform,
    contentUrl: listing.url || listing.copyUrl || null,
    status: 'Draft',
    route: listing.reportRoute || 'none',
    caseNumber: '',
    outcome: '',
    draft: buildDraft(listing),
    submittedAt: null,
    platformAccepted: false
  }
}

export function reportKey(listing) {
  const url = listing.url || listing.copyUrl || listing.id
  return `${listing.reportPlatform}::${url}`
}

export function buildDraft(listing) {
  const url = listing.url || listing.copyUrl
  const lines = [
    `Subject: ${listing.name}`,
    `Mark: ${listing.mark}`,
    url ? `Exact URL: ${url}` : 'Exact URL: not recovered. Do not invent one.',
    `Why it was flagged: ${listing.why}`,
    listing.phones.length ? `Phone numbers observed: ${listing.phones.join('; ')}` : null,
    ...listing.observations.map(o => `Observation: ${o}`),
    listing.evidenceSources.length ? `Evidence sources: ${listing.evidenceSources.join(' ')}` : null,
    listing.screenshots.length ? `Dated evidence attached: ${listing.screenshots.join(', ')}` : 'Dated evidence: screenshots on the review card.',
    listing.reportRoute === 'impersonation'
      ? `Suggested route: Facebook impersonation reporting. Trademark form if the AUTO AUCTION REBUILDS mark is used: ${LINKS.trademarkForm}`
      : null,
    listing.reportRoute === 'trademark'
      ? `Suggested route: trademark / host / registrar. U.S. registration 8102075, AUTO AUCTION REBUILDS. Facebook Trademark Report Form: ${LINKS.trademarkForm}. Meta guidance: ${LINKS.metaGuidance}`
      : null,
    listing.reportRoute === 'directory'
      ? 'Directory correction should name the specific phone, photo, website, address, or directions that need to change. Do not claim who created or edited the listing unless verified.'
      : null,
    'Reporter: Martin Simpson, acting for Randy Shear after one-time trademark authorization when a trademark claim is filed.',
    'Status is Draft until Marty marks it Ready. Do not label Submitted unless the platform accepted it.'
  ]
  return lines.filter(Boolean).join('\n')
}

function defaultMeta() {
  return {
    trademarkAuth: {
      authorized: false,
      by: null,
      at: null,
      statement:
        'Randy Shear authorizes Martin Simpson to file trademark reports for U.S. Registration 8102075, AUTO AUCTION REBUILDS, as his representative.'
    },
    monitoring: {
      active: false,
      lastScanAt: null,
      lastAlertAt: null,
      note: 'Inactive until a scheduled scan and a real alert have both been verified.',
      terms: [
        'Auto Auction Rebuilds',
        'AAR Auto Sales',
        'aarsales.com',
        'aar-autosalesus.com',
        'aar-autosales.com',
        'aarautosalesbyars.com',
        'aarautosalebyars.com',
        '405-709-2236',
        '405-288-1526',
        '937-563-3715',
        '405-479-9504'
      ],
      spendCapUsd: 5,
      resultLimit: 25,
      paidScanner: {
        confirmed: false,
        assumedService: null,
        note: 'The $5 scan is still unconfirmed. Apify fits the credit amount, but there is no record tying that run to ChatGPT or Cursor. Do not assume Apify was the previous service. Do not start a paid run without confirmation.'
      }
    },
    email: {
      connected: false,
      note: 'Unconnected until authorized inbox access is working. Randy can later say: Go through my email. Show me the people who sound serious about buying a car.'
    },
    metaSubmission: {
      configured: false,
      note: 'Until a Meta-supported submission method is verified and configured, the final submission goes through Marty.'
    }
  }
}

function emptyState() {
  const reports = {}
  const listings = {}
  for (const item of SEED_LISTINGS) {
    listings[item.id] = {
      decision: null,
      history: [],
      lastVerified: { ...item.lastVerified },
      confirmedUnauthorized: false
    }
    reports[reportKey(item)] = blankReport(item)
  }
  return { listings, reports, ...defaultMeta() }
}

function ensureDir() {
  if (!fs.existsSync(ROOT)) fs.mkdirSync(ROOT, { recursive: true })
}

function readState() {
  ensureDir()
  if (!fs.existsSync(STATE_FILE)) return emptyState()
  try {
    const saved = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'))
    return mergeState(emptyState(), saved)
  } catch {
    return emptyState()
  }
}

function writeState(state) {
  ensureDir()
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8')
}

function mergeState(base, saved) {
  const next = {
    ...base,
    ...saved,
    trademarkAuth: { ...base.trademarkAuth, ...(saved.trademarkAuth || {}) },
    monitoring: {
      ...base.monitoring,
      ...(saved.monitoring || {}),
      paidScanner: { ...base.monitoring.paidScanner, ...((saved.monitoring && saved.monitoring.paidScanner) || {}) },
      active: false
    },
    email: { ...base.email, ...(saved.email || {}), connected: false },
    metaSubmission: { ...base.metaSubmission, ...(saved.metaSubmission || {}) },
    listings: { ...base.listings },
    reports: { ...base.reports }
  }
  for (const [id, row] of Object.entries(saved.listings || {})) {
    next.listings[id] = { ...(next.listings[id] || {}), ...row }
  }
  for (const [key, row] of Object.entries(saved.reports || {})) {
    const merged = { ...(next.reports[key] || {}), ...row }
    if (merged.status === 'Submitted' && !merged.platformAccepted) merged.status = 'Ready'
    next.reports[key] = merged
  }
  return next
}

function shotPayload(id) {
  const shot = SHOTS[id]
  if (!shot) return null
  const uploaded = path.join(SHOTS_DIR, 'uploads', `${id}.png`)
  const native = path.join(SHOTS_DIR, shot.file)
  const file = fs.existsSync(uploaded)
    ? `/aar/evidence/uploads/${id}.png`
    : fs.existsSync(native)
      ? `/aar/evidence/${shot.file}`
      : null
  return { ...shot, src: file }
}

function publicListing(item, state) {
  const row = state.listings[item.id] || {}
  const report = state.reports[reportKey(item)] || blankReport(item)
  return {
    ...item,
    decision: row.decision || null,
    history: row.history || [],
    lastVerified: row.lastVerified || item.lastVerified,
    confirmedUnauthorized: !!row.confirmedUnauthorized,
    screenshots: (item.screenshots || []).map(shotPayload).filter(Boolean),
    report
  }
}

export function snapshot() {
  const state = readState()
  return {
    intro: INTRO,
    listings: SEED_LISTINGS.map(item => publicListing(item, state)),
    trademarkAuth: state.trademarkAuth,
    monitoring: state.monitoring,
    email: state.email,
    metaSubmission: state.metaSubmission,
    links: {
      trademarkForm: LINKS.trademarkForm,
      metaGuidance: LINKS.metaGuidance,
      googleVoice: LINKS.googleVoice,
      frankon: LINKS.frankon
    }
  }
}

export function classifyAnswer(text) {
  const t = String(text || '').toLowerCase().replace(/[’]/g, "'")
  if (!t.trim()) return null
  if (/\b(not sure|unsure|don't know|do not know|hard to say)\b/.test(t)) return 'unsure'
  if (/\b(details are wrong|wrong (number|phone|photo|picture|website|address|directions)|mine but|ours but)\b/.test(t)) {
    return 'mine_wrong'
  }
  if (/\b(not mine|isn't mine|is not mine|not ours|that's not (me|mine|us|ours)|that is not (me|mine)|fake|scam page)\b/.test(t)) {
    return 'not_mine'
  }
  if (/\b(that's mine|that is mine|it's mine|it is mine|yes(?: that's)? mine|ours|yes that's me|yes it is)\b/.test(t)) {
    return 'mine'
  }
  if (/^(yes|yeah|yep|yup|mine)\.?$/.test(t.trim())) return 'mine'
  if (/^(no|nope|nah)\.?$/.test(t.trim())) return 'not_mine'
  return null
}

function normalizeActor(value) {
  const v = String(value || '').toLowerCase()
  return REVIEWERS.has(v) ? v : 'randy'
}

function applyDecision(item, row, payload) {
  const answer = ANSWERS.includes(payload.answer) ? payload.answer : null
  if (!answer) return { error: 'Pick Mine, Not mine, Mine but details are wrong, or Unsure.' }
  const actor = normalizeActor(payload.by)
  const via = payload.via === 'voice' ? 'voice' : 'button'
  const decision = {
    answer,
    by: actor,
    at: new Date().toISOString(),
    via,
    confirmed: payload.confirmed !== false,
    raw: String(payload.raw || '').slice(0, 500)
  }
  const history = [...(row.history || []), decision].slice(-40)
  const confirmedUnauthorized = answer === 'not_mine' && REVIEWERS.has(actor)
  let mark = item.mark
  if (item.id === 'official-aarsales' && (answer === 'mine' || answer === 'mine_wrong')) mark = 'Official'
  else if (answer === 'mine_wrong' && item.reportPlatform === 'directory') mark = 'Directory correction'
  else if (confirmedUnauthorized && item.mark !== 'Official') mark = item.mark
  return {
    listing: {
      ...row,
      decision,
      history,
      confirmedUnauthorized,
      markOverride: mark
    }
  }
}

export function saveDecision(id, payload) {
  const item = SEED_LISTINGS.find(row => row.id === id)
  if (!item) return { error: 'Unknown listing.' }
  if (payload.confirmOnly || (payload.via === 'voice' && !ANSWERS.includes(payload.answer))) {
    const guessed = classifyAnswer(payload.raw)
    if (!guessed) return { needsConfirm: true, text: payload.raw }
    payload = { ...payload, answer: guessed, confirmed: true }
  }
  const state = readState()
  const applied = applyDecision(item, state.listings[id] || {}, payload)
  if (applied.error) return applied
  state.listings[id] = applied.listing
  writeState(state)
  return { ok: true, listing: publicListing(item, state) }
}

export function saveVerified(id, payload) {
  const item = SEED_LISTINGS.find(row => row.id === id)
  if (!item) return { error: 'Unknown listing.' }
  const status = ['unknown', 'online', 'offline'].includes(payload.status) ? payload.status : 'unknown'
  const state = readState()
  state.listings[id] = {
    ...(state.listings[id] || {}),
    lastVerified: {
      status,
      at: new Date().toISOString(),
      note: String(payload.note || '').slice(0, 400)
    }
  }
  writeState(state)
  return { ok: true, listing: publicListing(item, state) }
}

export function saveReport(id, payload) {
  const item = SEED_LISTINGS.find(row => row.id === id)
  if (!item) return { error: 'Unknown listing.' }
  const state = readState()
  const key = reportKey(item)
  const current = state.reports[key] || blankReport(item)
  let status = REPORT_STATUSES.includes(payload.status) ? payload.status : current.status
  const platformAccepted = payload.platformAccepted === true || current.platformAccepted === true
  if (status === 'Submitted' && !platformAccepted) {
    return { error: 'The app must not say Submitted unless the platform actually accepted it.' }
  }
  if (payload.route === 'trademark' && status === 'Ready' && !state.trademarkAuth.authorized) {
    return { error: 'Record Randy’s one-time authorization before Marty files a trademark report.' }
  }
  const next = {
    ...current,
    status,
    route: payload.route || current.route,
    caseNumber: payload.caseNumber != null ? String(payload.caseNumber).slice(0, 80) : current.caseNumber,
    outcome: payload.outcome != null ? String(payload.outcome).slice(0, 400) : current.outcome,
    draft: payload.draft != null ? String(payload.draft).slice(0, 8000) : current.draft,
    platformAccepted,
    submittedAt: status === 'Submitted' ? (current.submittedAt || new Date().toISOString()) : current.submittedAt
  }
  state.reports[key] = next
  writeState(state)
  return { ok: true, listing: publicListing(item, state) }
}

export function saveAuthorization(payload) {
  if (normalizeActor(payload.by) !== 'randy') {
    return { error: 'Only Randy can give the one-time trademark authorization.' }
  }
  if (!payload.authorized) return { error: 'Authorization was not given.' }
  const state = readState()
  state.trademarkAuth = {
    ...state.trademarkAuth,
    authorized: true,
    by: 'randy',
    at: new Date().toISOString()
  }
  writeState(state)
  return { ok: true, trademarkAuth: state.trademarkAuth }
}

export function saveShot(id, shotId, buffer, ext) {
  const item = SEED_LISTINGS.find(row => row.id === id)
  if (!item) return { error: 'Unknown listing.' }
  if (!item.screenshots.includes(shotId) && !SHOTS[shotId]) return { error: 'Unknown screenshot.' }
  const dir = path.join(SHOTS_DIR, 'uploads')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  const safeExt = ext === '.jpg' || ext === '.jpeg' || ext === '.webp' ? '.png' : '.png'
  fs.writeFileSync(path.join(dir, `${shotId}${safeExt === '.png' ? '.png' : '.png'}`), buffer)
  return { ok: true }
}

export function exportHtml() {
  const data = snapshot()
  const rows = data.listings.map(item => {
    const decision = item.decision
      ? `${labelAnswer(item.decision.answer)} · ${item.decision.by} · ${item.decision.via} · ${item.decision.at}`
      : 'No decision yet'
    const link = item.url || item.copyUrl
    const linkHtml = link
      ? (item.showDomainPlain
        ? `<span>${esc(item.name)}</span> · <a href="${esc(link)}">${esc(link)}</a>`
        : `<a href="${esc(link)}">${esc(link)}</a>`)
      : 'No direct link recovered'
    const shots = (item.screenshots || [])
      .map(s => `${esc(s.title)}${s.src ? ` · <a href="${esc(s.src)}">${esc(s.src)}</a>` : ''}`)
      .join('<br>')
    const sources = (item.evidenceSources || []).map(u => `<a href="${esc(u)}">${esc(u)}</a>`).join('<br>')
    return `<article>
      <h2>${esc(item.name)}</h2>
      <p><strong>${esc(item.mark)}</strong>${item.confirmedUnauthorized ? ' · Confirmed unauthorized' : ''}</p>
      <p>${linkHtml}</p>
      <p>${esc(item.why)}</p>
      <p><strong>Decision:</strong> ${esc(decision)}</p>
      <p><strong>Report:</strong> ${esc(item.report.status)} · ${esc(item.report.route)}${item.report.caseNumber ? ` · case ${esc(item.report.caseNumber)}` : ''}</p>
      <p><strong>Evidence:</strong><br>${shots || 'No screenshot file on this card yet.'}</p>
      ${sources ? `<p><strong>Sources:</strong><br>${sources}</p>` : ''}
      <p><strong>Next action:</strong> ${esc(item.nextAction)}</p>
    </article>`
  }).join('\n')
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>AAR impersonation review</title>
<style>
  body{font-family:Arial,sans-serif;max-width:800px;margin:24px auto;padding:0 16px;color:#102043;line-height:1.45}
  h1{font-size:22px} article{border:1px solid #d5deec;border-radius:12px;padding:16px;margin:16px 0}
  a{color:#1546e6}
</style></head><body>
<h1>Auto Auction Rebuilds impersonation review</h1>
<p>${esc(INTRO)}</p>
<p>Daily monitoring: inactive. Email operator: unconnected. Marty files reports. Submitted is used only when a platform accepted the report.</p>
<p>Trademark authorization: ${data.trademarkAuth.authorized ? `recorded ${esc(data.trademarkAuth.at)}` : 'not recorded'}</p>
${rows}
</body></html>`
}

export function voicePrompt(listing) {
  const link = listing.url || listing.copyUrl || 'no direct link recovered'
  return `You are on Impersonation Review. Do not say the long hello. Do not mention Jessica. Look at this one listing only.
Name: ${listing.name}.
Mark: ${listing.mark}.
Link: ${link}.
Why it was flagged: ${listing.why}.
After one short sentence, ask: Is this yours?
If they say it is theirs: Mine.
If they say it is not: Not mine.
If they say it is theirs but a number, photo, website, or address is wrong: Mine, but details are wrong.
If they are not sure: Unsure.
If the answer is unclear, confirm those four choices. Do not guess.
Only Randy or an authorized reviewer can call a listing confirmed unauthorized.
Marty files reports. Randy does not have to submit them.
Daily monitoring is inactive. Email is unconnected. Do not claim a scan already ran. The five-dollar scan is unconfirmed. Do not name Apify as the previous service.`
}

function labelAnswer(answer) {
  if (answer === 'mine') return 'Mine'
  if (answer === 'not_mine') return 'Not mine'
  if (answer === 'mine_wrong') return 'Mine, but details are wrong'
  if (answer === 'unsure') return 'Unsure'
  return 'None'
}

function esc(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export const ANSWER_LABELS = {
  mine: 'Mine',
  not_mine: 'Not mine',
  mine_wrong: 'Mine, but details are wrong',
  unsure: 'Unsure'
}
