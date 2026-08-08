/**
 * Checks the machinery behind the StartABusiness.Center conversation.
 *
 *   node scripts/sabc-profile.test.mjs
 *
 * The bookkeeping runs without touching a model: the question bank is checked
 * for shape, then a profile is built by hand the way a tracking pass would
 * build it, and the briefing the live conversation receives is checked for the
 * things that make it behave — answered questions absent, unanswered ones
 * present in priority order, the place it left off, parked items honoured, and
 * contradictions carried forward.
 */
import assert from 'assert'
import { QUESTIONS, BY_ID, CONCEPTS, FIELD_SET, GUIDE_TITLES, questionIndex } from '../server/sabc-questions.js'
import * as profile from '../server/business-profile.js'
import { keyFor, forget } from '../server/founder-file.js'

const KEY = keyFor('test-sabc-engine')
const OTHER = keyFor('test-sabc-other')
const failures = []
const check = (name, ok, detail) => {
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${name}${detail ? ' — ' + detail : ''}`)
  if (!ok) failures.push(name)
}

try {
  forget(KEY)
  forget(OTHER)

  /* ---- the methodology, as a bank ---- */
  check('every guide is represented', [1, 2, 3, 4, 5, 6, 7].every(g => QUESTIONS.some(q => q.guide === g)))
  check('ids are unique and stable in shape',
    new Set(QUESTIONS.map(q => q.id)).size === QUESTIONS.length && QUESTIONS.every(q => /^G[1-7]-Q\d{2}$/.test(q.id)))
  check('every question lands in a known profile field', QUESTIONS.every(q => FIELD_SET.has(q.field)))
  check('every teachable term has a plain explanation', QUESTIONS.every(q => !q.needs || CONCEPTS[q.needs]))
  check('the index the bookkeeper reads carries id, field and question',
    questionIndex().split('\n').length === QUESTIONS.length && questionIndex().includes('G1-Q01 [businessConcept]'))
  check('all seven guide titles are known', Object.keys(GUIDE_TITLES).length === 7)

  /* Every profile category the brief names has somewhere to live and something
     that asks about it. */
  const REQUIRED = ['businessConcept', 'founderBackground', 'founderSkills', 'offer', 'customerProblem',
    'targetCustomer', 'marketSize', 'competition', 'valueProposition', 'pricing', 'revenueModel',
    'startupCosts', 'funding', 'marketingChannels', 'outreach', 'operations', 'staffing', 'suppliers',
    'financialAssumptions', 'risks', 'goals', 'milestones', 'assumptions']
  const homeless = REQUIRED.filter(f => !FIELD_SET.has(f))
  check('every profile category in the brief exists', homeless.length === 0, homeless.join(','))
  const unasked = REQUIRED.filter(f => !QUESTIONS.some(q => q.field === f))
  check('and something in the conversation asks about it', unasked.length === 0, unasked.join(','))
  check('every guide has real depth', [1, 2, 3, 4, 5, 6, 7].every(g => QUESTIONS.filter(q => q.guide === g).length >= 8))

  /* ---- a first conversation, filed the way a tracking pass files it ---- */
  const first = profile.applyUpdate(KEY, {
    profile: {
      businessConcept: 'Meal prep kits for working parents in suburban Denver.',
      targetCustomer: 'Working parents with kids under ten, spending $60 to $80 a week on takeout.',
      pricing: 'Charging $79 a week for a family of four.',
      unitEconomics: 'Targeting about a 35 percent gross margin.',
      demandEvidence: 'Ten interviews, five paid up front for a pilot.'
    },
    questions: {
      'G1-Q01': { state: 'answered', note: 'meal prep kits, Denver' },
      'G1-Q03': { state: 'answered', note: 'dinnertime scramble' },
      'G1-Q07': { state: 'answered', note: 'working parents, kids under ten' },
      'G1-Q13': { state: 'answered', note: '$79 a week' },
      'G1-Q04': { state: 'answered', note: 'five prepaid' },
      'G1-Q12': { state: 'later', note: 'wants to think about what she needs to earn' },
      'G1-Q17': { state: 'partial', note: 'mentioned a roaster but no total' },
      'BOGUS-Q99': { state: 'answered' },
      'G1-Q02': { state: 'nonsense' }
    },
    openLoops: ['Worried about financing; wants to come back to funding options'],
    lastPlace: 'in the middle of who her first customers are',
    sessionSummary: 'First conversation. Meal prep kits in Denver, $79 a week, five prepaid pilot customers.'
  }, { turns: 24 })

  check('good answers are filed', first.state.questions['G1-Q01'].state === 'answered')
  check('a parked question is remembered as parked', first.state.questions['G1-Q12'].state === 'later')
  check('a half answer is filed as partial', first.state.questions['G1-Q17'].state === 'partial')
  check('an unknown id is ignored', !first.state.questions['BOGUS-Q99'])
  check('an unknown state is ignored', !first.state.questions['G1-Q02'])
  check('profile fields are stored', first.state.profile.pricing.value.includes('$79'))

  const s1 = profile.stats(KEY)
  check('coverage is counted', s1.answered === 5 && s1.partial === 1 && s1.later === 1, JSON.stringify(s1))
  check('the rest are still open', s1.open === QUESTIONS.length - 7)

  /* ---- what the live conversation is told ---- */
  const brief = profile.promptBlock(KEY)
  check('the briefing carries what she said', brief.includes('$79 a week') && brief.includes('suburban Denver'))
  check('it does not re-ask what was answered', !brief.includes(BY_ID.get('G1-Q01').ask) && !brief.includes(BY_ID.get('G1-Q13').ask))
  check('it does raise what is unanswered', brief.includes(BY_ID.get('G1-Q05').ask))
  check('half answers come before untouched ones',
    brief.indexOf(BY_ID.get('G1-Q17').ask) < brief.indexOf(BY_ID.get('G1-Q05').ask))
  check('it knows where the talk stopped', /WHERE YOU LEFT OFF: in the middle of who her first customers are/.test(brief))
  check('it carries the thing she wanted to return to', brief.includes('come back to funding'))
  check('parked questions are listed as parked', /PARKED[\s\S]*needs? this business to pay you/i.test(brief))
  check('it forbids reading the notes aloud', /Never read this back as a list/.test(brief))
  check('it never leaks an id as something to say', !/say .*G1-Q/.test(brief))

  /* ---- the same questions are not raised twice next session ---- */
  const nextUp = profile.nextQuestions(KEY, 8).map(q => q.id)
  check('answered questions are off the list', !nextUp.includes('G1-Q01') && !nextUp.includes('G1-Q04'))
  check('parked questions are off the list', !nextUp.includes('G1-Q12'))
  check('the partial one is first', nextUp[0] === 'G1-Q17', nextUp.join(','))

  /* ---- a document that disagrees with what she said ---- */
  profile.applyUpdate(KEY, {
    profile: { unitEconomics: 'August P&L shows an 18 percent gross margin.' },
    contradictions: ['Targeted a 35 percent gross margin in the first conversation; the August P&L is closer to 18 percent.']
  }, { source: 'document' })

  const withDoc = profile.load(KEY)
  check('the newer figure replaces the old one', withDoc.profile.unitEconomics.value.includes('18 percent'))
  check('the old figure is kept as history', withDoc.profile.unitEconomics.history[0].value.includes('35 percent'))
  check('the document is marked as the source', withDoc.profile.unitEconomics.source === 'document')
  const brief2 = profile.promptBlock(KEY)
  check('the mismatch is put in front of the consultant', /WORTH RAISING GENTLY[\s\S]*35 percent[\s\S]*18 percent/.test(brief2))

  /* ---- an answer never regresses ---- */
  profile.applyUpdate(KEY, { questions: { 'G1-Q01': { state: 'skipped' } } })
  check('an answered question cannot be un-answered', profile.load(KEY).questions['G1-Q01'].state === 'answered')

  /* ---- a pass mid-conversation files the substance, not a second summary ---- */
  const before = profile.load(KEY).sessions.length
  profile.applyUpdate(KEY, {
    profile: { location: 'Operates out of a licensed home kitchen in Denver.' },
    questions: { 'G1-Q28': { state: 'answered', note: 'home kitchen, Denver' } }
  })
  const after = profile.load(KEY)
  check('a mid-conversation pass still files answers', after.questions['G1-Q28'].state === 'answered')
  check('and does not add another entry to the history', after.sessions.length === before, `${before} -> ${after.sessions.length}`)

  /* ---- what the review writer reads ---- */
  const text = profile.profileText(KEY)
  check('the review source has the figures', text.includes('18 percent') && text.includes('$79'))
  check('it shows what changed', /earlier: "August|earlier: "Targeting about a 35/.test(text))
  check('it lists what is still missing', /not yet answered:/.test(text))
  check('it states coverage without a score', /coverage: \d+ of \d+ questions answered/.test(text) && !/out of 100/.test(text))

  /* ---- the portable copy ---- */
  const exported = profile.exportProfile(KEY)
  check('the export is labelled', exported.kind === 'startabusiness.center/business-profile')
  const restored = profile.importProfile(OTHER, exported)
  check('it restores onto a fresh code', restored.answered === profile.stats(KEY).answered, JSON.stringify(restored))
  check('the restored profile has the business', profile.load(OTHER).profile.businessConcept.value.includes('Denver'))
  check('the restored profile keeps the mismatch', profile.load(OTHER).contradictions.length === 1)
  let rejected = false
  try { profile.importProfile(OTHER, { kind: 'something-else' }) } catch { rejected = true }
  check('a file that is not a profile is refused', rejected)

  /* ---- one code is one business ---- */
  const third = keyFor('test-sabc-third')
  check('an untouched code knows nothing', profile.stats(third).answered === 0)
  check('and is told so', /this is the first conversation/.test(profile.promptBlock(third)))
  forget(third)
} catch (error) {
  console.error(error)
  failures.push('threw')
} finally {
  forget(KEY)
  forget(OTHER)
}

console.log(failures.length ? `\n${failures.length} failed` : '\nall good')
process.exit(failures.length ? 1 : 0)
