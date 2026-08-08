/**
 * The bookkeeping behind the conversation.
 *
 * The live voice model does the talking. After a session — and whenever a
 * document arrives — these passes read what was said, decide which of Tim's
 * questions it actually answered, and fold the substance into the business
 * profile. That is what lets the next conversation skip what is already covered
 * and pick up where this one stopped.
 *
 * Deliberately a separate model call rather than something the voice model is
 * asked to emit: it can take its time, return strict JSON, and be wrong without
 * making the conversation weird.
 */

import fetch from 'node-fetch'
import { questionIndex, PROFILE_FIELDS } from './sabc-questions.js'
import * as profileStore from './business-profile.js'

const FIELD_LIST = PROFILE_FIELDS.join(', ')

const CHAT_MODEL = () => process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini'
const hasKey = () => Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim())

async function chat(messages, { json = false, temperature = 0.2, max = 2400 } = {}) {
  if (!hasKey()) throw new Error('OPENAI_API_KEY is not set on the server.')
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: CHAT_MODEL(),
      temperature,
      max_tokens: max,
      ...(json ? { response_format: { type: 'json_object' } } : {}),
      messages
    })
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data?.error?.message || 'model call failed')
  return data.choices?.[0]?.message?.content?.trim() || ''
}

const BOOKKEEPER = `You keep the record behind a business consulting conversation. You never talk to the founder; you only file what was said.

The consultant works from Tim Donahue's StartABusiness.Center methodology. Every question in it has an id. Your job is to decide, from the material given to you, which ids the founder has actually answered, and to write down the substance of what they said.

Return ONE JSON object, no prose:

{
  "profile": { "<field>": "<what is now known, written as a short factual note in the third person>" },
  "questions": { "<ID>": { "state": "answered|partial|skipped|later", "note": "<up to 20 words of evidence>" } },
  "openLoops": ["<something they raised that has not been resolved, phrased so a consultant could pick it up>"],
  "contradictions": ["<what they said before vs what is true now, one sentence, only when they genuinely conflict>"],
  "lastPlace": "<what the conversation was in the middle of when it stopped>",
  "sessionSummary": "<3 to 5 sentences: what they covered, what changed, what they decided>"
}

Rules that matter:
- "answered" means they gave real information, even briefly, even inside a long answer about something else. One two-minute answer commonly answers six separate ids — mark them all.
- "partial" means they touched it but the substance is missing (a number, a name, a decision).
- "skipped" means they declined. "later" means they asked to come back to it, or said they need to think.
- Never mark a question answered because the consultant explained the concept. Only the founder's own information counts.
- Only use field names from the profile field list given to you. Only use ids from the question index.
- profile values: facts and figures in their own terms, not advice. Write "charges $79 a week for a family of four" not "should consider raising prices".
- Include a field only if there is something real to record. Omit everything else. Do not invent, infer beyond what was said, or fill gaps.
- contradictions: only when a figure or plan genuinely changed. Say both sides and the date if you have it.`

/**
 * Fold a voice session into the profile.
 *
 * `interim` is for a conversation still in progress: everything is filed except
 * the session summary, so a long talk survives a browser being killed without
 * leaving a trail of half-summaries in the history.
 */
async function trackConversation(key, turns, { source = 'conversation', interim = false } = {}) {
  const cleaned = (Array.isArray(turns) ? turns : [])
    .map(t => ({
      role: t?.role === 'assistant' ? 'assistant' : 'user',
      text: String(t?.text || t?.content || '').trim().slice(0, 2000)
    }))
    .filter(t => t.text.length > 2)
  if (cleaned.length < 2) return null

  const transcript = cleaned
    .map(t => `${t.role === 'assistant' ? 'CONSULTANT' : 'FOUNDER'}: ${t.text}`)
    .join('\n')
    .slice(0, 14_000)

  const raw = await chat([
    { role: 'system', content: BOOKKEEPER },
    {
      role: 'user',
      content: `PROFILE FIELDS YOU MAY USE:\n${FIELD_LIST}\n\nQUESTION INDEX (id, field, question):\n${questionIndex()}\n\nWHAT WAS ALREADY ON FILE BEFORE THIS SESSION:\n${profileStore.profileText(key) || '(nothing)'}\n\nTRANSCRIPT OF THE SESSION JUST FINISHED:\n${transcript}`
    }
  ], { json: true })

  let update
  try {
    update = JSON.parse(raw)
  } catch {
    return null
  }
  if (interim) delete update.sessionSummary
  return profileStore.applyUpdate(key, update, { source, turns: cleaned.length })
}

/** Fold an uploaded document into the profile, and notice what changed. */
async function trackDocument(key, name, text) {
  const body = String(text || '').trim()
  if (body.length < 40) return null
  const raw = await chat([
    { role: 'system', content: BOOKKEEPER },
    {
      role: 'user',
      content: `PROFILE FIELDS YOU MAY USE:\n${FIELD_LIST}\n\nQUESTION INDEX (id, field, question):\n${questionIndex()}\n\nWHAT WAS ALREADY ON FILE:\n${profileStore.profileText(key) || '(nothing)'}\n\nTHE FOUNDER JUST UPLOADED A DOCUMENT NAMED "${name}". Read it and file what it tells you about the business. Pay particular attention to figures that differ from what is already on file — those go in contradictions, with both numbers. Do not write a sessionSummary or a lastPlace for a document; leave those out.\n\nDOCUMENT:\n${body.slice(0, 24_000)}`
    }
  ], { json: true })

  let update
  try {
    update = JSON.parse(raw)
  } catch {
    return null
  }
  delete update.lastPlace
  delete update.sessionSummary
  return profileStore.applyUpdate(key, update, { source: 'document' })
}

const REVIEWER = `You are an experienced business consultant writing up a client's business for the client themselves. You work from Tim Donahue's StartABusiness.Center methodology, so the seven areas it covers are the areas you assess: the idea and its demand, validation, setup and money, the offer and pricing, the website, finding customers, and growing without breaking.

Write the review as plain text with headings on their own line starting with "## " and short bullets starting with "- ". Nothing else — no markdown bold, no numbered lists, no preamble, no sign-off.

Use only these headings, and only the ones you have real material for, in this order:
## Executive Summary
## Business Concept
## Founder Background
## Target Customer
## Market Opportunity
## Competition
## Value Proposition
## Products or Services
## Pricing
## Revenue Model
## Startup Costs
## Funding
## Marketing
## Sales
## Operations
## Financial Readiness
## Strengths
## Weaknesses
## Opportunities
## Risks
## Contradictions or Concerns
## Assumptions That Need Testing
## Missing Information
## Priority Decisions
## Recommended Next Steps
## Questions Still Requiring Answers

How to write it:
- Analyse, do not transcribe. The founder already knows what they told you. Tell them what it means, what fits together, and what does not.
- Be specific and use their real numbers and names. Where the numbers imply something they have not said out loud — a break-even they cannot reach, a margin that will not carry their salary, a customer count that needs a market ten times bigger — say it plainly.
- Under Contradictions or Concerns, name anything that changed or does not add up, quoting both sides.
- Under Missing Information and Questions Still Requiring Answers, use the unanswered questions supplied to you, in the founder's terms.
- Priority Decisions: the two or three calls only they can make, and what each one hinges on.
- Recommended Next Steps: three to six actions in order, each one startable this week, sized to what they said about their time and money.
- No numerical scores or grades of any kind.
- Write to them as "you". Direct, warm, unsentimental. No filler, no motivational language.
- Do not give legal, tax or accounting instructions. Where those come up, say what the decision is and that it goes to a CPA or an attorney.
- Never invent a fact, a figure or a customer. If a section has nothing behind it, leave the heading out entirely rather than padding it.`

/** The whole business, read back as analysis. */
async function writeReview(key, { extra = '' } = {}) {
  const profile = profileStore.profileText(key)
  const s = profileStore.stats(key)
  if (!profile.trim() || (!s.answered && !s.partial)) return null
  const text = await chat([
    { role: 'system', content: REVIEWER },
    {
      role: 'user',
      content: `EVERYTHING ON FILE FOR THIS BUSINESS:\n${profile}\n${extra ? `\nDOCUMENTS THEY UPLOADED (extracts):\n${extra.slice(0, 12_000)}\n` : ''}`
    }
  ], { temperature: 0.35, max: 3200 })
  return text || null
}

export { trackConversation, trackDocument, writeReview, hasKey }
