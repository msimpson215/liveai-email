/**
 * Auto Auction Rebuilds Impersonation Review.
 * Seed listings plus saved decisions, reports, and Randy's trademark authorization.
 */
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = process.env.AAR_REVIEW_DIR || path.join(__dirname, '..', 'data', 'aar-review')
const STATE_FILE = path.join(ROOT, 'state.json')
const UPLOADS_DIR = path.join(ROOT, 'shots')
const PLATES_DIR = path.join(__dirname, '..', 'public', 'aar', 'evidence')

// The repo is public, so only hashes live here. Env vars override for rotation.
const KEY_HASHES = {
  randy: 'b5ee5234a5b6a0bf805efa90b10ab516a61b566f1707e1ecaf98b64372a3830f',
  marty: 'd3c8945cf3d81779d4501a2a196238ec5a3a1141690f005e25d3b1139b255027'
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex')
}

/** Which reviewer a key belongs to, or null. */
export function roleForKey(key) {
  const k = String(key || '').trim()
  if (!k) return null
  for (const role of ['randy', 'marty']) {
    const envKey = process.env[`AAR_REVIEW_KEY_${role.toUpperCase()}`]
    const hash = envKey ? sha256(envKey) : KEY_HASHES[role]
    const a = Buffer.from(sha256(k), 'hex')
    const b = Buffer.from(hash, 'hex')
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) return role
  }
  return null
}

export const INTRO =
  "Randy, I did this half manually and half with AI. I wanted you to know I'm staying on it. I've put the screenshots and links in one place so you can tell me which listings are yours. Once we clear the old listings, we can start watching for new ones daily."

export const ANSWERS = ['mine', 'not_mine', 'mine_wrong', 'unsure']
export const MARKS = ['Official', 'Priority review', 'Directory correction', 'Evidence pending']
export const REPORT_STATUSES = ['Draft', 'Ready', 'Submitted', 'Resolved']
export const ROUTES = ['impersonation', 'trademark', 'host_registrar', 'directory', 'none']

export const SHOTS = {
  'shot-01-fb-aar-auto-sale-byars': {
    id: 'shot-01-fb-aar-auto-sale-byars',
    file: 'shot-01-fb-aar-auto-sale-byars.svg',
    title: 'Facebook: AAR Auto Sale Byars',
    captured: null,
    notes: 'Full-page Facebook capture. Vehicle posts, aarautosalesbyars.com, 405-709-2236.'
  },
  'shot-02-fb-byars-ok-search-a': {
    id: 'shot-02-fb-byars-ok-search-a',
    file: 'shot-02-fb-byars-ok-search-a.svg',
    title: 'Facebook search: AAR Auto Sales | Byars OK',
    captured: null,
    notes: 'Search result showing 937-563-3715 and aar-autosales.com.'
  },
  'shot-03-fb-byars-ok-search-b': {
    id: 'shot-03-fb-byars-ok-search-b',
    file: 'shot-03-fb-byars-ok-search-b.svg',
    title: 'Facebook search: AAR Auto Sales | Byars OK (second capture)',
    captured: null,
    notes: 'Second search screenshot of the same Facebook result.'
  },
  'shot-04-velora-contact': {
    id: 'shot-04-velora-contact',
    file: 'shot-04-velora-contact.svg',
    title: 'Search: veloramotors.net/contact',
    captured: null,
    notes: 'Same dealership lot address under a different business name.'
  },
  'shot-05-directories-yelp-mapquest': {
    id: 'shot-05-directories-yelp-mapquest',
    file: 'shot-05-directories-yelp-mapquest.svg',
    title: 'Directory results: Yelp and MapQuest',
    captured: null,
    notes: 'Tractor imagery on Yelp. Equipment thumbnail next to MapQuest.'
  },
  'shot-06-manta-number': {
    id: 'shot-06-manta-number',
    file: 'shot-06-manta-number.svg',
    title: 'Directory: Manta',
    captured: null,
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
    reportRoute: 'host_registrar'
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
    reportRoute: 'host_registrar'
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
    reportRoute: 'host_registrar'
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
    reportRoute: 'host_registrar'
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

const ROUTE_LABELS = {
  impersonation: 'Facebook impersonation report',
  trademark: 'Facebook trademark report',
  host_registrar: 'Hosting company and domain registrar abuse report',
  directory: 'Directory correction request',
  none: 'No report'
}

export function reportKey(listing) {
  const url = listing.url || listing.copyUrl || listing.id
  return `${listing.reportPlatform}::${url}`
}

export function buildDraft(listing, route = listing.reportRoute) {
  const url = listing.url || listing.copyUrl
  const lines = [
    `${ROUTE_LABELS[route] || 'Report'}: ${listing.name}`,
    url ? `Exact URL: ${url}` : 'Exact URL: not recovered yet. Recover it before filing.',
    `Why it was flagged: ${listing.why}`,
    listing.phones.length ? `Phone numbers observed: ${listing.phones.join('; ')}` : null,
    ...listing.observations.map(o => `Observation: ${o}`),
    listing.evidenceSources.length ? `Evidence sources: ${listing.evidenceSources.join(' ')}` : null,
    listing.screenshots.length
      ? `Screenshots: ${listing.screenshots.map(id => SHOTS[id] ? SHOTS[id].title : id).join('; ')}. Capture dates not recorded.`
      : null,
    'Official business for comparison: Auto Auction Rebuilds, https://aarsales.com/'
  ]
  if (route === 'impersonation') {
    lines.push(`Route: report the Page as impersonating a business. Meta guidance: ${LINKS.metaGuidance}`)
  }
  if (route === 'trademark') {
    lines.push(
      'Mark: AUTO AUCTION REBUILDS, U.S. Registration 8102075.',
      `Facebook Trademark Report Form: ${LINKS.trademarkForm}`,
      'Filed by Martin Simpson as authorized representative of Randy Shear, the rights owner.'
    )
  }
  if (route === 'host_registrar') {
    lines.push(
      'Send to the hosting company and the domain registrar abuse contacts for this domain.',
      'This site uses the Auto Auction Rebuilds name and lot details without permission. AUTO AUCTION REBUILDS is U.S. Registration 8102075.',
      'If the domain is offline, keep this record as evidence. Do not resend unless it returns or there is new evidence.'
    )
  }
  if (route === 'directory') {
    lines.push(
      'Ask the directory to correct the specific detail: phone, photo, website, address, or directions. Name exactly which one is wrong and what the right value is, using aarsales.com.',
      'Do not say who created or edited the listing unless that is verified.'
    )
  }
  return lines.filter(Boolean).join('\n')
}

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
    platformAccepted: false,
    updatedBy: null,
    updatedAt: null
  }
}

function defaultMeta() {
  return {
    trademarkAuth: {
      authorized: false,
      recordedBy: null,
      at: null,
      how: '',
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
        note: 'No paid scan runs without Marty confirming it first. The $5 charge is not confirmed. This project does have one earlier Apify Facebook Marketplace run from Cursor on Nov 13, 2026 that checked 810 listings and found 0 matches. Check Apify billing to see if that run was the $5.'
      }
    },
    email: {
      connected: false,
      note: 'Unconnected until authorized inbox access is working. Later Randy can say: Go through my email. Show me the people who sound serious about buying a car.'
    },
    metaSubmission: {
      configured: false,
      note: 'Until a Meta-supported submission method is verified and configured, Marty submits by hand.'
    },
    storage: {
      durable: false,
      note: 'Saved on the server until it restarts or redeploys. Each browser also keeps a copy and sends it back when the page reloads. Use Export review summary as the lasting record.'
    }
  }
}

function emptyState() {
  const reports = {}
  const listings = {}
  for (const item of SEED_LISTINGS) {
    listings[item.id] = { decision: null, history: [], lastVerified: { ...item.lastVerified } }
    reports[reportKey(item)] = blankReport(item)
  }
  return { listings, reports, ...defaultMeta() }
}

function ensureDir(dir = ROOT) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

function readState() {
  ensureDir()
  if (!fs.existsSync(STATE_FILE)) return emptyState()
  try {
    return mergeState(emptyState(), JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')))
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
    trademarkAuth: { ...base.trademarkAuth, ...(saved.trademarkAuth || {}) },
    listings: { ...base.listings },
    reports: { ...base.reports }
  }
  for (const [id, row] of Object.entries(saved.listings || {})) {
    if (next.listings[id]) next.listings[id] = { ...next.listings[id], ...row }
  }
  for (const [key, row] of Object.entries(saved.reports || {})) {
    if (!next.reports[key]) continue
    const merged = { ...next.reports[key], ...row }
    if (merged.status === 'Submitted' && !merged.platformAccepted) merged.status = 'Ready'
    next.reports[key] = merged
  }
  return next
}

function shotPayload(id) {
  const shot = SHOTS[id]
  if (!shot) return null
  const uploaded = fs.existsSync(path.join(UPLOADS_DIR, `${id}.img`))
  if (uploaded) {
    return { ...shot, src: `/api/aar/review/shot/${id}`, placeholder: false, needsKey: true }
  }
  const plate = fs.existsSync(path.join(PLATES_DIR, shot.file)) ? `/aar/evidence/${shot.file}` : null
  return { ...shot, src: plate, placeholder: true }
}

/** Not mine from Randy or Marty, and never on the official site. */
function isConfirmedUnauthorized(item, decision) {
  return !!decision && decision.answer === 'not_mine' && item.mark !== 'Official'
}

function publicListing(item, state) {
  const row = state.listings[item.id] || {}
  const report = state.reports[reportKey(item)] || blankReport(item)
  return {
    ...item,
    decision: row.decision || null,
    history: row.history || [],
    lastVerified: row.lastVerified || item.lastVerified,
    confirmedUnauthorized: isConfirmedUnauthorized(item, row.decision),
    screenshots: (item.screenshots || []).map(shotPayload).filter(Boolean),
    report
  }
}

export function snapshot(role) {
  const state = readState()
  return {
    role,
    intro: INTRO,
    listings: SEED_LISTINGS.map(item => publicListing(item, state)),
    trademarkAuth: state.trademarkAuth,
    monitoring: state.monitoring,
    email: state.email,
    metaSubmission: state.metaSubmission,
    storage: state.storage,
    routes: ROUTES.map(id => ({ id, label: ROUTE_LABELS[id] })),
    links: {
      trademarkForm: LINKS.trademarkForm,
      metaGuidance: LINKS.metaGuidance,
      googleVoice: LINKS.googleVoice,
      frankon: LINKS.frankon
    }
  }
}

/**
 * Read a spoken answer. Explicit phrases are sure. A bare yes or no could be
 * answering some other question, so it always comes back for confirmation.
 */
export function classifyAnswer(text) {
  const t = String(text || '').toLowerCase().replace(/[’]/g, "'").replace(/[.!?,]+/g, ' ').replace(/\s+/g, ' ').trim()
  if (!t) return null
  if (/\b(not sure|unsure|i don't know|i do not know|no idea)\b/.test(t)) return { answer: 'unsure', sure: true }
  if (/\b(details are wrong|(number|phone|photo|picture|website|address|directions) (is|are) wrong|wrong (number|phone|photo|picture|website|address|directions)|mine but|ours but)\b/.test(t)) {
    return { answer: 'mine_wrong', sure: true }
  }
  if (/\b(not mine|isn't mine|is not mine|not ours|isn't ours|that's not me|that is not me|not my (page|site|listing))\b/.test(t)) {
    return { answer: 'not_mine', sure: true }
  }
  if (/\b(that's mine|that is mine|it's mine|it is mine|that's ours|that is ours|that's my (page|site|listing))\b/.test(t)) {
    return { answer: 'mine', sure: true }
  }
  if (/^(yes|yeah|yep|yup|mine)( it is)?$/.test(t)) return { answer: 'mine', sure: false }
  if (/^(no|nope|nah)( it's not| it isn't)?$/.test(t)) return { answer: 'not_mine', sure: false }
  return null
}

function findListing(id) {
  return SEED_LISTINGS.find(row => row.id === id) || null
}

/**
 * Save Mine / Not mine / Mine but details are wrong / Unsure.
 * `by` always comes from the reviewer key, never from the request body.
 */
export function saveDecision(id, payload, role) {
  const item = findListing(id)
  if (!item) return { error: 'Unknown listing.' }
  let answer = ANSWERS.includes(payload.answer) ? payload.answer : null
  const via = payload.via === 'voice' ? 'voice' : 'button'
  if (!answer) {
    const read = classifyAnswer(payload.raw)
    if (!read) return { ignored: true }
    if (!read.sure) return { needsConfirm: true, text: String(payload.raw || ''), guess: read.answer }
    answer = read.answer
  }
  const state = readState()
  const row = state.listings[id] || {}
  const at = payload.syncAt && !Number.isNaN(Date.parse(payload.syncAt)) ? payload.syncAt : new Date().toISOString()
  if (payload.syncAt && row.decision && Date.parse(row.decision.at) >= Date.parse(at)) {
    return { ok: true, listing: publicListing(item, state), stale: true }
  }
  const decision = { answer, by: role, at, via, raw: String(payload.raw || '').slice(0, 500) }
  state.listings[id] = { ...row, decision, history: [...(row.history || []), decision].slice(-40) }
  writeState(state)
  return { ok: true, listing: publicListing(item, state) }
}

export function saveVerified(id, payload, role) {
  const item = findListing(id)
  if (!item) return { error: 'Unknown listing.' }
  if (role !== 'marty') return { error: 'Only Marty updates verified status.' }
  const status = ['unknown', 'online', 'offline'].includes(payload.status) ? payload.status : 'unknown'
  const state = readState()
  state.listings[id] = {
    ...(state.listings[id] || {}),
    lastVerified: { status, at: new Date().toISOString(), note: String(payload.note || '').slice(0, 400) }
  }
  writeState(state)
  return { ok: true, listing: publicListing(item, state) }
}

function readyBlocker(item, decision, route, auth) {
  if (route === 'none') return 'Pick a report route first.'
  if (route === 'directory') {
    if (!decision || decision.answer !== 'mine_wrong') return 'A directory correction needs Randy to mark it Mine, but details are wrong.'
    return null
  }
  if (!isConfirmedUnauthorized(item, decision)) return 'Only file after Randy or Marty marks this listing Not mine.'
  if (route === 'trademark' && !auth.authorized) return 'Record Randy’s one-time authorization before filing a trademark report.'
  if (!(item.url || item.copyUrl)) return 'The exact URL is still missing. Recover it before filing.'
  return null
}

export function saveReport(id, payload, role) {
  const item = findListing(id)
  if (!item) return { error: 'Unknown listing.' }
  if (role !== 'marty') return { error: 'Marty handles reports. Randy does not have to submit anything.' }
  const state = readState()
  const key = reportKey(item)
  const current = state.reports[key] || blankReport(item)
  const status = REPORT_STATUSES.includes(payload.status) ? payload.status : current.status
  const route = ROUTES.includes(payload.route) ? payload.route : current.route
  const platformAccepted = typeof payload.platformAccepted === 'boolean' ? payload.platformAccepted : current.platformAccepted
  const decision = (state.listings[id] || {}).decision
  if (status !== 'Draft') {
    const blocked = readyBlocker(item, decision, route, state.trademarkAuth)
    if (blocked) return { error: blocked }
  }
  if ((status === 'Submitted' || status === 'Resolved') && !platformAccepted) {
    return { error: 'Only mark Submitted after the platform actually accepted the report.' }
  }
  const routeChanged = route !== current.route
  const draftEdited = payload.draft != null && String(payload.draft) !== current.draft
  state.reports[key] = {
    ...current,
    status,
    route,
    platformAccepted,
    caseNumber: payload.caseNumber != null ? String(payload.caseNumber).slice(0, 80) : current.caseNumber,
    outcome: payload.outcome != null ? String(payload.outcome).slice(0, 400) : current.outcome,
    draft: draftEdited ? String(payload.draft).slice(0, 8000) : routeChanged ? buildDraft(item, route) : current.draft,
    submittedAt: status === 'Submitted' ? (current.submittedAt || new Date().toISOString()) : current.submittedAt,
    updatedBy: role,
    updatedAt: new Date().toISOString()
  }
  writeState(state)
  return { ok: true, listing: publicListing(item, state) }
}

/** Randy gives it himself, or Marty records how Randy gave it. */
export function saveAuthorization(payload, role) {
  if (!payload.authorized) return { error: 'Authorization was not given.' }
  const how = String(payload.how || '').trim().slice(0, 300)
  if (role === 'marty' && !how) return { error: 'Say how Randy authorized it, for example: email from Randy on Nov 25.' }
  const state = readState()
  state.trademarkAuth = {
    ...state.trademarkAuth,
    authorized: true,
    recordedBy: role,
    at: new Date().toISOString(),
    how: role === 'randy' ? 'Randy confirmed in Impersonation Review.' : how
  }
  writeState(state)
  return { ok: true, trademarkAuth: state.trademarkAuth }
}

const IMAGE_TYPES = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }

export function saveShot(shotId, file, role) {
  if (role !== 'marty') return { error: 'Only Marty replaces screenshots.' }
  if (!SHOTS[shotId]) return { error: 'Unknown screenshot.' }
  if (!file || !IMAGE_TYPES[file.mimetype]) return { error: 'Use a PNG, JPG, or WebP screenshot.' }
  ensureDir(UPLOADS_DIR)
  fs.writeFileSync(path.join(UPLOADS_DIR, `${shotId}.img`), file.buffer)
  fs.writeFileSync(path.join(UPLOADS_DIR, `${shotId}.json`), JSON.stringify({ type: file.mimetype, name: file.originalname, at: new Date().toISOString() }))
  return { ok: true }
}

export function readShot(shotId) {
  if (!SHOTS[shotId]) return null
  const img = path.join(UPLOADS_DIR, `${shotId}.img`)
  if (!fs.existsSync(img)) return null
  let type = 'image/png'
  try { type = JSON.parse(fs.readFileSync(path.join(UPLOADS_DIR, `${shotId}.json`), 'utf8')).type || type } catch { /* default */ }
  return { type, buffer: fs.readFileSync(img) }
}

export function exportHtml(base = '') {
  const data = snapshot('export')
  const abs = src => (src && src.startsWith('/') ? `${base}${src}` : src)
  const rows = data.listings.map(item => {
    const decision = item.decision
      ? `${labelAnswer(item.decision.answer)} (by ${cap(item.decision.by)}, ${item.decision.via}, ${item.decision.at.slice(0, 10)})`
      : 'No decision yet'
    const link = item.showDomainPlain
      ? `${esc(item.name)} (domain shown as plain text)`
      : item.url
        ? `<a href="${esc(item.url)}">${esc(item.url)}</a>`
        : 'No direct link recovered yet'
    const shots = (item.screenshots || []).map(s => s.placeholder
      ? `${esc(s.title)}: original screenshot not imported yet`
      : `${esc(s.title)}: imported screenshot (open in the review with a reviewer link)`).join('<br>')
    const sources = (item.evidenceSources || []).map(u => `<a href="${esc(u)}">${esc(u)}</a>`).join('<br>')
    const obs = (item.observations || []).map(o => `<li>${esc(o)}</li>`).join('')
    const verified = item.lastVerified && item.lastVerified.status !== 'unknown'
      ? `${esc(item.lastVerified.status)} on ${esc(String(item.lastVerified.at).slice(0, 10))}`
      : 'Not checked yet'
    return `<article>
      <h2>${esc(item.name)}</h2>
      <p><strong>${esc(item.mark)}</strong>${item.confirmedUnauthorized ? ' · Confirmed unauthorized' : ''}</p>
      <p>${link}</p>
      <p><strong>Why it was flagged:</strong> ${esc(item.why)}</p>
      ${obs ? `<ul>${obs}</ul>` : ''}
      <p><strong>Decision:</strong> ${esc(decision)}</p>
      <p><strong>Last verified:</strong> ${verified}</p>
      <p><strong>Report:</strong> ${esc(item.report.status)}, ${esc(ROUTE_LABELS[item.report.route] || item.report.route)}${item.report.caseNumber ? `, case ${esc(item.report.caseNumber)}` : ''}${item.report.outcome ? `, outcome: ${esc(item.report.outcome)}` : ''}</p>
      <p><strong>Evidence:</strong><br>${shots || 'No screenshot on this card.'}</p>
      ${sources ? `<p><strong>Sources:</strong><br>${sources}</p>` : ''}
      <p><strong>Next action:</strong> ${esc(item.nextAction)}</p>
    </article>`
  }).join('\n')
  const auth = data.trademarkAuth
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Auto Auction Rebuilds impersonation review</title>
<style>
  body{font-family:Arial,sans-serif;max-width:800px;margin:24px auto;padding:0 16px;color:#102043;line-height:1.45}
  h1{font-size:22px} article{border:1px solid #d5deec;border-radius:12px;padding:16px;margin:16px 0}
  a{color:#1546e6}
</style></head><body>
<h1>Auto Auction Rebuilds impersonation review</h1>
<p>Exported ${esc(new Date().toISOString().slice(0, 10))}.</p>
<p>${esc(INTRO)}</p>
<p>Daily monitoring: inactive. Email: not connected. Marty files the reports. A report is marked Submitted only after the platform accepted it.</p>
<p>Trademark authorization: ${auth.authorized ? `recorded ${esc(String(auth.at).slice(0, 10))} (${esc(auth.how)})` : 'not recorded yet'}</p>
${rows}
</body></html>`
}

export function voicePromptFor(id) {
  const item = findListing(id)
  if (!item) return null
  const link = item.url || (item.copyUrl ? item.name : 'no direct link recovered yet')
  return `You are on Impersonation Review. Do not say the long hello. Do not mention Jessica. Look at this one listing only.
Name: ${item.name}.
Kind: ${item.mark}.
Link: ${link}.
Why it was flagged: ${item.why}
Say one short sentence about it, then ask: Is this yours?
The answers are: Mine. Not mine. Mine, but details are wrong. Unsure.
If the answer is unclear, read those four back and let them pick. Do not guess.
Saying Not mine is what confirms a listing as unauthorized. Do not call it confirmed before they say so.
Marty files the reports. Randy does not have to submit anything.
Daily monitoring is not running yet. Email is not connected. Do not claim a scan already ran.`
}

export function reviewListingName(id) {
  const item = findListing(id)
  return item ? { name: item.name, why: item.why } : null
}

function labelAnswer(answer) {
  return ANSWER_LABELS[answer] || 'None'
}

function cap(value) {
  const s = String(value || '')
  return s.charAt(0).toUpperCase() + s.slice(1)
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
