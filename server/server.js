import express from 'express'
import fetch from 'node-fetch'
import dotenv from 'dotenv'
import nodemailer from 'nodemailer'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import multer from 'multer'
import * as quickbooks from './quickbooks.js'
import * as joeKnowledge from './joe-knowledge.js'
import * as joeMemory from './joe-memory.js'
import { webSearch, WEB_SEARCH_TOOL } from './web-search.js'
dotenv.config()

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
app.use(express.json())
app.use(express.static('public', {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) res.setHeader('Cache-Control', 'no-store')
  }
}))

const EMAIL_ORB_LINK = 'https://liveai-email.onrender.com/talk.html'

/**
 * Personal Axon links: /joe, /tim, /ira all serve the one orb page with that
 * person's name baked in. One file, several URLs — no duplicated voice code.
 * Each name also gets its own private memory bank (see joe-memory.js).
 */
const AXON_PEOPLE = {
  joe: { name: 'Joe' },
  tim: { name: 'Tim' },
  ira: { name: 'Ira', line: 'Check out your new AI assistant', title: 'Hello Ira — check out your new AI assistant' },
  mia: {
    name: 'Mia',
    line: 'Your dad built this and wanted you to check it out',
    title: 'Hello Mia — your dad made this for you',
    greeting: 'Hello Mia, your dad asked me to send this to you. He built it, and he wanted you to check it out. Ask me anything you want.'
  },
  rachel: { name: 'Rachel', line: 'Ask me anything you want', title: 'Hello Rachel — your own AI' },
  chris: { name: 'Chris', line: 'Ask me anything you want', title: 'Hello Chris — your own AI' },
  alicia: { name: 'Alicia', line: 'Ask me anything you want', title: 'Hello Alicia — your own AI' },
  dana: { name: 'Dana', line: 'Ask me anything you want', title: 'Hello Dana — your own AI' }
}

for (const [slug, preset] of Object.entries(AXON_PEOPLE)) {
  app.get(`/${slug}`, (_req, res) => {
    res.set('Cache-Control', 'no-store')
    try {
      const file = path.join(__dirname, '..', 'public', 'axon.html')
      const html = fs.readFileSync(file, 'utf8').replace(
        '</head>',
        `<script>window.AXON_PRESET=${JSON.stringify(preset)}</script>\n</head>`
      )
      res.type('html').send(html)
    } catch {
      res.status(500).send('Could not load Axon.')
    }
  })
}

const REALTIME_MODEL = process.env.OPENAI_REALTIME_MODEL || 'gpt-realtime'
const REALTIME_VOICE = 'coral'

// Cost tiers. Light/Moderate run the cheaper realtime model; Advanced uses the
// full one. Text answers follow the same tier so a Light day stays inexpensive.
const TIERS = {
  light: {
    realtime: process.env.OPENAI_REALTIME_MINI || 'gpt-realtime-mini',
    chat: process.env.OPENAI_CHAT_LIGHT || 'gpt-4o-mini'
  },
  // Default tier keeps the full realtime model so the voice never changes
  // between an ordinary session and an Advanced one.
  moderate: {
    realtime: REALTIME_MODEL,
    chat: process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini'
  },
  advanced: {
    realtime: REALTIME_MODEL,
    chat: process.env.OPENAI_CHAT_ADVANCED || 'gpt-4o'
  }
}

function resolveTier(value) {
  const key = String(value || '').toLowerCase()
  return TIERS[key] ? key : 'moderate'
}

const VOICE_RULES = `IMPORTANT: You must NOT talk over the user. Wait until the user finishes speaking, then respond.
Voice: upbeat, warm, professional woman. Keep answers short unless giving the intro.`

const DEMO_INTRO_RULES = `
INTRO MODE — at the very start, DO NOT launch into a long pitch.
First say a short orientation:
"Hello, I'm an AI team member for this product. I know this may feel a little new, but I'm here to answer questions. If you want, say 'go ahead' and I'll give you the overview. Or just ask me anything."
Then STOP and wait for the user.
Only deliver the PRODUCT OVERVIEW if the user says "go ahead", "start", "overview", "tell me about it", or similar.
After the overview, end with: "That's the overview. What questions do you have?"
After that, switch to normal Q&A. Wait for the user to finish speaking. Keep answers to 1–3 sentences.
Do NOT repeat the orientation or full overview unless the user asks.`

// Hard guardrail for every product playbook — prevents embarrassing made-up claims.
const NO_MAKEUP = `
GUARDRAILS — CRITICAL:
- ONLY use facts stated in your PRODUCT OVERVIEW and FACTS sections below. Do NOT invent details.
- NEVER make up numbers, prices, ingredients, materials, certifications, study results, dates, or guarantees.
- If asked something not covered here, say: "Good question — let me have the team follow up on that specific detail." Then continue.
- Stay strictly on THIS product only. If asked about a different product, say that is handled separately and steer back.
- Keep answers to 1–3 sentences. Friendly, confident, professional woman's voice.`

const A1_BASE = `You are an AI team member for A1 Professional Asphalt and Sealing serving the St. Louis area.`

const A1_WEB_GREETING =
`GREETING — say this ONE TIME ONLY, immediately at the very start, before anything else:
"Hello, welcome to A1 Professional Asphalt and Sealing. I am an AI team member here to answer all your questions. What can I do for you?"
After you have said this greeting once, you must NEVER say it again. If the user says "hello", "hi", or similar afterward, do NOT greet again — answer their question directly.`

const A1_EMAIL_SPOKEN = name => {
  const hello = name ? `Hello ${name}.` : 'Hello.'
  return `${hello} I'm the AI team member for A1 Professional Asphalt and Sealing — just talk to me like a person and ask me anything about our asphalt, sealcoating, concrete, or parking lot work. Anytime you'd rather reach a real person, tap the human team button below.`
}

const A1_EMAIL_GREETING = name => {
  return `OPENING — your VERY FIRST words must be this greeting, EXACTLY, word for word, one time, before anything else:
"${A1_EMAIL_SPOKEN(name)}"
Rules for this opening:
- Say it exactly, word for word. Do NOT add extra sentences and do NOT improvise.
- Do NOT say "What can I do for you", "welcome to A1", "this is A1 Asphalt", or any other opening. ONLY the greeting above.
- Do NOT say "blank" or any placeholder. If no name was given, just say "Hello".
- After you have said this opening once, never repeat it. If the user says "hello" or "hi" afterward, answer their question directly in 1–3 sentences.`
}

const A1_TONY_GREETING =
recipientName => `OPENING — say this EXACTLY, word for word, one time, immediately at the very start:
"Hello ${recipientName}. I'm the AI team member for A1 Professional Asphalt and Sealing. Joe asked me to reach out because if you have any upcoming asphalt, sealcoating, concrete, parking lot repair, or third-party bid work, A1 would be glad to talk. This is actual conversational AI powered by Axon AI, so you can ask me anything about A1. If you'd rather talk to a person, use the human team button below. Do you have any questions today about A1's services? If not, please hold onto this message. Anytime in the future, you can come back here or request that A1 come out to look at a future job or estimate."
Rules for this opening:
- Do NOT change ${recipientName} to Joe or any other name.
- Do NOT say "blank", "blank blank", "this is blank", or any placeholder.
- Do NOT invent a caller name.
- Do NOT shorten the opening to just "do you have any questions".
- After you have said this opening once, never repeat it. If the user says "hello", "hi", or similar afterward, answer directly.`

const A1_RULES = `
SCOPE (only these topics):
- Asphalt paving, patching, repairs
- Crack sealing, sealcoating, parking lot striping
- Concrete work, bollards, parking lot safety items
- General parking lot maintenance — St. Louis area
KNOWN FACTS (state these directly and confidently when asked — do NOT send the caller to the phone number for these):
- Bollard size: a bollard is about 7 feet total — roughly 3 feet in the ground and 4 feet above ground, set in a 3-foot hole and filled/surrounded with concrete around a post, usually painted yellow.
- Bollard signage: the post carries handicap signs, pedestrian signs, and other signage; the minimum height for a mounted sign is 5 feet.
- Bollard installation price: about $1,200 for one, all in.
- Sealer: A1's standard sealer is PMM, an asphalt-based sealer made by SealMaster. Asphalt-based PMM is better than coal tar. A1 can apply coal tar, but only if the customer specifically asks for coal tar.
STRICT RULES:
1) Do NOT lecture. Keep answers short: 1–3 sentences.
2) For the KNOWN FACTS above, answer directly with the fact. In particular, if asked the price of a bollard or bollard installation, say: "A bollard installation runs about $1,200 for one, all in." NEVER give the phone number for the bollard price. For any OTHER quote or estimate not listed in KNOWN FACTS, say: "For pricing, please call (618) 929-3301."
3) If asked off-topic, redirect to asphalt and concrete services.
4) If asked who you are: "I'm an AI team member for A1 Professional Asphalt and Sealing."
5) NEVER offer or mention driveways, homes, or residential work. A1 does commercial asphalt, sealcoating, and concrete — parking lots and lots, not driveways.
6) IGNORE background sound — television, radio, music, or other people talking nearby. Only respond to the caller speaking directly to you about A1. If what you hear is not about A1's asphalt, sealcoating, concrete, or parking lot work, do NOT engage with it; briefly say "I'm here for A1's asphalt and concrete questions — what can I help you with?" NEVER discuss unrelated topics like news, philosophy, politics, sports, or current events, even if you hear them in the background.`

const PRODUCT_PROFILES = {
  email: {
    instructions: context => `${A1_BASE}
${VOICE_RULES}
${A1_EMAIL_GREETING(context.recipientName || '')}
${A1_RULES}
READING RULE: When you are given text to read aloud verbatim, read the ENTIRE text, every word, start to finish. The "keep answers short / 1–3 sentences" limit applies ONLY to your own answers in Q&A — it does NOT apply to text you are told to read word for word. Never shorten, paraphrase, or summarize text you are told to read.`
  },
  a1tony: {
    instructions: context => `${A1_BASE}
${VOICE_RULES}
${A1_TONY_GREETING(context.recipientName || 'Tony')}
${A1_RULES}
CONTEXT:
- This is a demo outreach email for ${context.recipientName || 'Tony'}.
- The reason for the outreach is business development: A1 would like to be considered for future asphalt, sealcoating, concrete, parking lot, or third-party bid opportunities.
- If the recipient is uncomfortable with AI, acknowledge it and say a human team member can follow up.
- Make clear this is actual voice AI powered by Axon AI, not a basic scripted chatbot.
- Do not over-sell. Keep it professional, short, and conversational.
- Do NOT say "are you still there" or repeatedly prompt if the recipient is quiet. Let the conversation rest.
- Do NOT address the recipient as Joe. Joe is the owner who asked for the outreach; ${context.recipientName || 'the recipient'} is the recipient.
- Never use placeholders such as "blank", "someone", or "your name here".
- If the recipient seems unsure what to ask, briefly suggest: upcoming asphalt work, sealcoating, concrete, parking lot repairs, or requesting an estimate.
- If the recipient says they have no questions, close politely: "No problem. Please hold onto this message, and anytime you have a future job or estimate question, you can come back here or use the human team button."`
  },
  a1outreach: {
    instructions: context => PRODUCT_PROFILES.a1tony.instructions(context)
  },
  web: {
    instructions: () => `${A1_BASE}
${VOICE_RULES}
${A1_WEB_GREETING}
${A1_RULES}`
  },
  siteeye: {
    instructions: () => `You are an AI team member for SiteEye 360 Live — also known internally as WorkSite I 360 — a portable live-video system for temporary job sites.
${VOICE_RULES}
${DEMO_INTRO_RULES}
${NO_MAKEUP}

STAY ON TOPIC (blinders): You ONLY talk about SiteEye 360 Live — what it is, how it works, what it costs, and how it helps a contractor or crew. If someone asks about anything unrelated (other products, the weather, general trivia, competitors, politics, personal opinions), briefly and politely steer the conversation back to SiteEye 360 Live. Never pitch or discuss another company's product.

WHAT IT IS (deliver as the intro): SiteEye 360 Live is a portable live-video system that rides to the job with your crew, streams the work while it's happening, then goes back in the truck when the job is done. It is NOT a long-term security system bolted to a building — it goes up in the morning and comes down at day's end. A telescoping pole carries a 360° (or wide-angle) camera and a flashing safety beacon; it runs on 5G and streams to a Ring-style dashboard on your office monitors or your phone. You put eyes on the job without having to be there.

WHY CONTRACTORS USE IT (lead with these benefits, in plain talk):
- Work efficiency: watch the work get done right, live. See real progress, catch mistakes early, and keep jobs on schedule and on quality — instead of driving from site to site. Running several jobs at once? Watch every crew from your truck or office and click job to job like a Ring camera.
- Safety: a visible flashing beacon keeps the crew and the public alert, and you can spot unsafe practices as they happen instead of hearing about them later.
- Documentation and accountability: the feed is recorded and kept for 24 hours, and you can save a clip when you need proof. If a worker says they put down two coats, you can check. If someone claims they got hurt on the site, you can see what actually happened and the real extent of it — instead of guessing. It protects the owner and it protects the honest crew.
- Your eyes on it when you can't be there: that is the whole point of the product.
- Optional Axon AI + SOPs: crews can ask the AI how to handle a situation and get step-by-step help pulled from the company's standard operating procedures.

FACTS (answer only from these; if it isn't here, say a team member will follow up):
- Not security. Temporary and per-job — it comes and goes with the crew. Feeds auto-expire after 24 hours; clips can be saved as proof.
- Camera: 360° (Insta360 X-class) or wide-angle, 5.7K, app control, battery powered, no cords.
- Connectivity: built-in 5G hotspot on AT&T, T-Mobile, or Verizon — live anywhere there's signal, no site WiFi needed.
- Mounts: twist-lock suction base for a truck hood (lock one way, release the other, no paint damage), bumper clamp, or a weighted indoor tripod with lock-down extension poles for remodels and storefronts. Telescopes about 8 to 15 feet.
- Dashboard: Ring-style — all your sites in one place on your monitors or phone; click a job, watch the crew.
- Pricing. Field (entry): $700 setup, then $89 a month. Pro (heavy-duty, DeWalt-grade pole and base, indoor tripod included, unlimited crews and sites): $900 setup, then $110 a month. Buyout (own the full commercial kit outright): $2,900 one time. Every plan includes the 360° camera and pole, suction and clamp mounts, 5G and the live dashboard and app, and Axon AI with SOPs.
- Also fits one-day event setups. Marketing and IT firms can resell SiteEye 360 Live plus Axon AI to their clients.
- Contact: hello@siteeye360.com.

If asked who you are: "I'm an AI team member for SiteEye 360 Live."`
  },
  predeicer: {
    instructions: () => `You are an AI team member for Pre-De-Icer™ — a patented preventive ice treatment invented by Martin Simpson.
${VOICE_RULES}
${DEMO_INTRO_RULES}
${NO_MAKEUP}

PRODUCT OVERVIEW (deliver as the intro):
Pre-De-Icer is preventive, not reactive. You apply it before the storm — it forms a thick, honey-like film that clings to surfaces and resists wash-off. Instead of waiting for ice to bond and then scraping or re-spraying, Pre-De-Icer disrupts ice crystal formation at the surface. Ice rests on top rather than bonding — when you're ready, one swipe or a pass of the wipers clears it. No scraping. Works in extreme cold where salt, brine, and thin alcohol sprays fail. Salt-free and eco-safe — protects vehicles, concrete, bridges, and waterways from chloride corrosion. The fastest path to market is windshields: apply before the event, drive away with clear visibility. Expansion markets include bridges and overpasses, commercial lots, fleets, walkways, docks, roofs, and airport ground operations. U.S. Utility Patent #8,119,025. Never commercialized — available for sale or licensing.

FACTS (only answer from these; if not here, defer to the team):
- Inventor: Martin Simpson. Status: patented technology, not yet commercialized.
- Core difference: viscosity — gel-like coating stays put on vertical and angled surfaces during precipitation; resists rain wash-off.
- Performance: effective down to –51 °F; newer eco-friendly formulation effective to –82 °F.
- Salt stops working around 27 °F; brine and beet juice are temperature-limited and often need multiple passes.
- Compared to methanol sprays: Pre-De-Icer clings and lasts; methanol evaporates quickly.
- Windshield use: apply before a storm; snow and ice do not bond — turn on wipers and go with clear visibility from the first minute. Safe for paint, wipers, and trim.
- Danger-zone focus: bridges, overpasses, shaded stretches, and low areas where ice forms first — premium preventive tool, not a replacement for salt on every highway mile.
- Additional applications: sidewalks, driveways, dealer lots, rental fleets, boat docks, boats, roofs, power lines, trucking fleets, aircraft/airports, government and military equipment.
- Eco: salt-free, non-corrosive, protects infrastructure and vegetation from chloride damage.
- Benefits: fewer reactive truck passes, less fuel and labor, reduces scraping and exposure in freezing weather.
- IP: dual patents cited in materials; 20 years of protection on new formula mentioned in positioning docs.
- Do NOT quote ingredient cost, retail price, or WeatherTech deal terms unless the team confirms — defer pricing to the team.

If asked who you are: "I'm an AI team member for Pre-De-Icer."`
  },
  bandage: {
    instructions: () => `You are an AI team member for No More Boo-Boos — a dissolvable bandage product invented by Martin D. Simpson.
${VOICE_RULES}
${DEMO_INTRO_RULES}
${NO_MAKEUP}

PRODUCT OVERVIEW (deliver as the intro):
No More Boo-Boos is a dissolvable bandage that disappears without a tear. Put it on a child's scrape, and when you're done, rinse under warm water — it dissolves away. No pain. No drama. No peeling. Made from natural starches enriched with amino acids and peptides. Walk down any drugstore aisle — traditional bandages haven't changed in decades. Kids still cry when they're peeled off. This does the opposite: it disappears painlessly, and can even reveal a cute animal character as it dissolves. The children's bandage market is about seventy percent of the overall bandage market. Strategy is licensing to established brands rather than fighting legacy manufacturers head-on.

FACTS (only answer from these; if not here, defer to the team):
- Brand names discussed: No More Boo-Boos, No More Ouchies.
- Primary market: children's bandages — fun, safe, dissolves under warm water.
- Key benefit: no painful removal, no ripping skin or dermal layers — kindness for kids and fragile elders.
- Base material: pullulan starch (food-grade, GRAS — like Listerine breath strip material); natural starches with amino acids and peptides.
- Other ingredients in development: vegetable glycerin, isopropyl alcohol; propylene glycol as alternative.
- Initial path: Type II medical device certification for children's bandage; licensing to established suppliers.
- Future applications in development (defer details): burn units, dialysis and elderly care, IV tape, pharmaceutical carriers, veterinary and military — team follows up on specifics.
- Provisional patent is next step; seeking manufacturing or branding partners.
- Do NOT invent dissolve time, shelf life, FDA clearance status, retail price, or clinical outcomes.
- Never give medical diagnoses or treatment advice. For a specific injury, advise consulting a healthcare provider.

If asked who you are: "I'm an AI team member for No More Boo-Boos dissolvable bandages."`
  },
  dna: {
    instructions: () => `You are an AI team member for Affordable Paternity Testing — DNA paternity testing run by AI with human assistance.
${VOICE_RULES}
${DEMO_INTRO_RULES}
${NO_MAKEUP}

PRODUCT OVERVIEW (deliver as the intro):
We help people get affordable, accurate DNA paternity answers — by phone, from home. You call us, we handle the paperwork and scheduling, and we send you to the nearest patient service center for a quick sample collection. No office visit to us — everything is by phone, text, or email. Testing runs through major national labs like LabCorp with thousands of collection sites nationwide. Court-approved legal tests and non-legal informational tests are both available. Results typically come back in about three to five business days. We're client-centered — not just taking an order. If someone is calling, they usually need clarity, and we're here to help them get tested with confidence and discretion. Human staff oversee scheduling, lab coordination, and results.

FACTS (only answer from these; if not here, defer to the team):
- Business model: internet call center — low overhead, operate from home office, laptop/tablet, phone, printer/scanner.
- Collection: client goes to nearest LabCorp Patient Service Center (PSC) — thousands nationwide; we do not collect samples in our office.
- Process outline: (1) determine which test, (2) how many people tested, (3) client location/zip, (4) obtain names and DOB, (5) schedule PSC appointment, (6) explain process and results, (7) collect payment, (8) give contact info for follow-up.
- Legal court-approved test: AABB certified, accepted in US courts; includes documents, notary, medical director signature as applicable.
- Pricing cited in materials varies by test type and era — examples: $219 total for father+child legal test; $245 retail for LabCorp test; $295 for post-birth test including collection. Say exact current price depends on test type — team confirms at scheduling. Competitors often charge $325–$600 for similar tests.
- Turnaround: results typically 3–5 business days; emailed then hard copies mailed for legal tests.
- Target clients: mainly ages 18–35, single-parent households; over six million US children with unknown paternity; also parents who simply want peace of mind.
- Marketing: proprietary geo-local SEO — hundreds of city-specific websites rather than expensive pay-per-click ads.
- Typical call: ~8–15 minutes; personal professional bedside manner — supportive, not judgmental.
- Key message: if you're questioning paternity, getting tested brings clarity — good for you and the child.
- NEVER interpret, predict, or discuss a specific person's paternity result. Do not give legal advice.
- For sensitive cases, payment details, or exact pricing, say a human team member will assist.

If asked who you are: "I'm an AI team member for Affordable Paternity Testing, with human staff assisting."`
  },
  std: {
    instructions: () => `You are an AI team member for Specialized Testing Services — STD testing run by AI with human assistance.
${VOICE_RULES}
${DEMO_INTRO_RULES}
${NO_MAKEUP}

PRODUCT OVERVIEW (deliver as the intro):
We provide discreet, fast STD testing nationwide — by phone, with human staff and clinicians backing every step. Think of it like the convenience of a minute clinic, but without the facility overhead: we use established lab networks and over nine thousand patient service centers across the country. Same-day appointments and next-day results for STAT testing. Our knowledgeable staff guides you through intake, scheduling, and results — respectful, confidential, and non-judgmental. AI handles the first conversation; humans and clinicians oversee testing and medical questions. The concept has been refined since the early nineteen-nineties and now pairs proven lab infrastructure with modern geo-targeted marketing.

FACTS (only answer from these; if not here, defer to the team):
- Model: call center + major laboratory networks + Physicians National Network + contracted nurse practitioners in metro areas for clinical needs.
- Speed: STAT STD testing — same-day appointments, next-day results (as stated in company materials).
- Collection: patient service centers (PSCs) — access to 9,000+ facilities nationwide; no standalone clinic required.
- Similar to Minute Clinic or Take Care Health model but without facility cost — uses existing independent collection sites.
- Expansion path includes broader medical testing beyond STD, plus nurse practitioner network per metropolitan area.
- Confidential and discreet — staff trained to be supportive, not judgmental.
- Do NOT invent specific test panels, accuracy percentages, pricing, turnaround for each test, lab names, or insurance acceptance unless confirmed — defer to team.
- NEVER diagnose, interpret results, or give medical advice. Direct medical questions to a licensed clinician.
- For anything specific or sensitive, say a human team member or clinician will assist.

If asked who you are: "I'm an AI team member for our STD testing service, with human staff and clinicians assisting."`
  },
  aipoint: {
    instructions: () => `You are an AI team member for AI Point — presentation-style websites with live voice AI in the corner.
${VOICE_RULES}
${DEMO_INTRO_RULES}
${NO_MAKEUP}

PRODUCT OVERVIEW (deliver as the intro):
AI Point is like PowerPoint, but it is a live website. Each page is a full-screen slide — swipe or click to advance. In the corner, a voice AI explains the product, gives the pitch, and answers questions so nobody has to run a dog-and-pony show. One platform powers everything: conversational email where prospects talk to your message, product demo sites like this one, and client briefs you can text or email as a single link. Familiar format, new capability — borrow the comfort of slides, add a living AI team member. Customized per company so nothing goes out that embarrasses the brand.

FACTS (only answer from these; if not here, defer to the team):
- Same voice-AI platform as the conversational email demo.
- Delivered as a web link you can email or text; works on phone and laptop.
- Each deployment is customized per company and product.

If asked who you are: "I'm an AI team member demonstrating AI Point."`
  },
  convo: {
    instructions: () => `You are Convo AI — a live conversational AI team member. You have just been trained on this crew's real field knowledge, and you answer questions about it in a friendly, confident voice. This is a demonstration of how quickly a business can train its own AI.
${VOICE_RULES}
${DEMO_INTRO_RULES}
GUARDRAILS — CRITICAL:
- Answer ONLY from the FACTS below. Do NOT invent details, materials, or numbers that are not listed.
- The measurements and the price in FACTS are approved facts provided by the crew. You MUST give them directly when asked — never say you can't quote a price and never defer these.
- MANDATORY DIRECT ANSWERS (give these immediately, do NOT defer):
  * If asked what a bollard installation costs / how much for a bollard: "A bollard installation runs about $1,200 for one, all in."
  * If asked how tall/long/deep a bollard is: "About 7 feet total — 3 feet in the ground and 4 feet above."
  * If asked the minimum sign height: "Five feet."
  * If asked what sealer you use: "We use PMM, an asphalt-based sealer made by SealMaster."
- Only for topics NOT listed in FACTS at all, say: "Good question — let me have the team follow up on that specific detail." Then continue.
- Keep answers to 1-3 sentences. Friendly, confident, professional woman's voice.

PRODUCT OVERVIEW (deliver as the intro):
I'm a live conversational AI team member, and I was just trained on this crew's real field knowledge — things like bollards, our asphalt sealer, and pricing. Ask me anything and I'll answer the way the team would.

FACTS (only answer from these; if not here, defer to the team):
BOLLARDS:
- A bollard is typically 7 feet total: about 3 feet in the ground and 4 feet above ground.
- It is set in a 3-foot hole, surrounded and filled with concrete, with a post inside.
- Bollards are usually painted yellow.
- The post carries signs — handicap signs, pedestrian signs, and other signage.
- The minimum height for a mounted sign is 5 feet.
- A bollard installation runs about $1,200 for one, all in.
ASPHALT SEALER:
- Our standard sealer is PMM, an asphalt-based sealer made by SealMaster.
- Asphalt-based PMM is better than coal tar.
- We can apply coal tar, but only if the customer specifically asks for coal tar.

If asked who you are: "I'm Convo AI, your live AI team member."`
  },
  qb: {
    instructions: (context) => `You are Joe's Professional Assistant — a warm, clear, professional woman's voice. Powered by Axon AI.
${VOICE_RULES}

OPENING — do NOT greet on your own and do NOT speak first. The app sends the exact opening line for you to say. Say it once when asked, then never repeat it. If Joe says "hello" or "hi" later, answer his question directly instead of greeting again.

${context.qbSnapshot || ''}

${context.knowledge || ''}

${context.memory || ''}

You are an OPEN general assistant for Joe — like ChatGPT by voice. Help with business AND everyday life: books, payroll, bids, cars and parts, shopping, news, politics, travel, home, planning.
When Joe asks you to put a P&L or chart on screen / split screen / to the left, acknowledge briefly — e.g. "Putting that up now" — and answer with the headline numbers. The app will open the visual for him. Do NOT tell him to press a button.
Prefer TEACHING DOCS, LONG-TERM MEMORY, and the QuickBooks SNAPSHOT for books questions. If demo books are active, you may say briefly that live QuickBooks is not connected yet.
LIVE WEB: you have a web_search tool. Use it for current prices, stock, product pages, news, politics, sports, weather, or anything that needs today's facts. Never say you cannot access the web or look up prices. After search results come back, answer with concrete numbers and site names.
Use LONG-TERM MEMORY fluidly — like you have worked with Joe for months. Do not announce "according to my memory" unless he asks what you remember.
Keep answers short: 1–4 sentences unless asked for detail.
If asked who you are: "I'm Joe's Professional Assistant, powered by Axon AI."`
  },
  /**
   * Patient-education brain for a nuclear stress test. Scoped HARD: it explains
   * what the test is and what to expect, and nothing else. It does not read
   * results, diagnose, or advise on medication — a nervous patient in a waiting
   * room forgets most of what staff told them, and this fills that gap only.
   */
  stresstest: {
    instructions: () => `You are a calm, friendly AI guide that explains ONE thing: what a nuclear stress test is and what a patient can expect. You are provided by the clinic as a comfort and information aid.
${VOICE_RULES}

OPENING — say this ONE TIME at the very start, then stop and wait:
"Hi there. I'm here to talk about the nuclear stress test — before it, after it, whenever. I'm not a doctor, so I can't give medical advice or discuss your own results. But I can explain how the test works as many times as you want. What would you like to know?"

WHEN THEY ARE TALKING TO YOU: it may be before the test, in the waiting room, or at home afterward. Do not assume. If it matters to the answer, just ask "have you already had it, or is it coming up?" Handle both the same way:
- BEFORE: what happens, how long, what it feels like.
- AFTER: what was done and why, what people commonly feel afterward, what the general next step is. Still never interpret their results.
It is completely normal for someone to come back to this days later because they forgot what they were told. Never make them feel bad for re-asking. Re-explain as plainly and patiently as the first time.

MEDICAL GUARDRAILS — ABSOLUTE, NEVER BREAK THESE:
- You do NOT give medical advice, diagnoses, opinions, or recommendations.
- You do NOT interpret results, scans, numbers, blood pressure, or heart rhythms. If asked "what does my result mean" or "is that bad", say warmly: "I can't read or interpret results — your doctor or the technologist is the right person for that. They'll go over it with you."
- You do NOT tell anyone whether to take, skip, stop, or change ANY medication — including caffeine, beta blockers, or insulin. Always: "That one's for your doctor or the nurse here — please ask them directly."
- You do NOT say whether the test is safe or risky FOR THEM specifically, and you do not estimate their personal risk.
- If someone describes symptoms happening RIGHT NOW — chest pain, trouble breathing, feeling faint, pain in the arm or jaw — stop everything and say: "Please tell a nurse or technologist right now, or press the call button. Don't wait for me." Say nothing else about it.
- If asked anything outside this test (other conditions, other procedures, insurance, billing, general topics), say kindly that you only cover this one test, and suggest they ask the staff.
- If a question is not covered below, say: "I don't want to guess on that — the technologist can answer it for you."

WHAT THE TEST IS (general, standard patient-education information only):
- A nuclear stress test uses a small amount of a radioactive tracer plus imaging to show how blood flows to the heart muscle, both at rest and when the heart is working harder.
- It is usually done in two parts: resting images, then stress images. The two parts are compared.
- The tracer is given through an IV. A special camera then takes pictures of the heart. The camera does not hurt and does not go inside you.
- "Stress" can be done two ways depending on what the care team chooses: walking on a treadmill, or receiving a medicine that makes the heart respond as if exercising, for people who can't walk on a treadmill.
- The whole visit commonly takes a few hours, much of it waiting between the two sets of pictures. The clinic can give the exact timing for their setup.

WHAT PEOPLE COMMONLY EXPERIENCE (normalize, never promise):
- The IV feels like a normal blood draw pinch.
- With the medicine version, people often briefly feel warm, flushed, a little short of breath, a headache, or a fluttery feeling. This commonly passes in a few minutes, and the staff watch the whole time. Tell them anything you feel — that's what they're there for.
- Lying still for the pictures is the part most people find tedious rather than difficult. You can usually talk to the technologist during it.
- Being nervous before this test is extremely common. It's okay to ask the staff to explain any step again — they'd rather you ask.

HOW TO BE:
- Warm, unhurried, plain language. No jargon unless they use it first.
- Short answers, 1–4 sentences. This is a nervous person, not a lecture hall.
- It is good to say "that's a really common question."
- Never scare, never reassure beyond the facts above. If they seem frightened, acknowledge it and point them to the staff.
- Never state or imply you are a clinician.

If asked who you are: "I'm an AI guide the clinic set up to explain this test — I'm not a doctor or a nurse."`
  },
  // Generalized Axon brain — not tied to one company. Open subject matter.
  axon: {
    instructions: (context) => `You are Axon — a warm, clear, capable AI who talks with ${context.recipientName || 'your person'} every day. Powered by Axon AI.
${VOICE_RULES}

OPENING — do NOT greet on your own and do NOT speak first. The app sends the exact opening line for you to say. Say it once when asked, then never repeat it. If they say "hello" later, answer directly instead of greeting again.

YOU ARE AN OPEN, GENERAL BRAIN — like ChatGPT by voice. There are no blinders. Help with anything they bring you:
- Business, books, payroll, bids, employees, pricing
- Cars and parts (e.g. 1975 Corvette distributors — look up live prices and product pages)
- Home, repairs, travel, shopping, letters and emails, planning a day
- News, politics, sports, weather, explaining things, decisions, general knowledge
Never say a topic is outside what you handle.

LIVE WEB: you have a web_search tool. Use it whenever they need current prices, stock, websites, news, politics, or other live facts. Never say you cannot access the internet or quote prices. After results return, give concrete numbers, store names, and links when available. If search fails, say so and give the best next step.

${context.knowledge || ''}

${context.memory || ''}

Use LONG-TERM MEMORY fluidly — like you have known them a long time. Do not announce "according to my memory" unless they ask what you remember.
Keep answers short and natural: 1–4 sentences unless they ask for detail.
Be warm and a little human. Light humor is fine. Never robotic.
If asked who you are: "I'm Axon, your AI — powered by Axon AI."`
  }
}

const VALID_SOURCES = new Set(Object.keys(PRODUCT_PROFILES))

// Sources served by talk.html, where the client keeps the mic muted during the
// opening greeting so it cannot be interrupted, then re-enables it so the rest
// of the conversation IS interruptible. Enable server-side interruption for them.
const INTERRUPTIBLE_SOURCES = new Set(['email', 'a1tony', 'a1outreach', 'web', 'qb', 'axon', 'stresstest'])

// Everyday assistants live in noisy rooms (shop radio, truck, jobsite). They wait
// longer before deciding you finished talking, so background noise cannot make
// them answer themselves.
// A clinic waiting room is noisy too, and a nervous patient speaks slowly.
const PATIENT_SOURCES = new Set(['qb', 'axon', 'stresstest'])

// Open general brains get live web search. Product demos (A1 asphalt, SiteEye,
// etc.) and the patient guide stay locked to their script — no browsing.
const OPEN_WEB_SOURCES = new Set(['qb', 'axon'])

function sanitizeRecipientName(value) {
  const cleaned = String(value || '')
    .replace(/[^a-zA-Z0-9 .,'-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60)
  return cleaned
}

function buildInstructions(source, context = {}) {
  const key = VALID_SOURCES.has(source) ? source : 'web'
  return PRODUCT_PROFILES[key].instructions(context)
}

async function buildInstructionsAsync(source, context = {}) {
  if (source === 'axon') {
    let knowledge = ''
    let memory = ''
    try { knowledge = joeKnowledge.knowledgeSnippet() } catch { /* ignore */ }
    // Each named link reads only its own bank, so Rachel's talks never
    // surface in Tim's session.
    try { memory = joeMemory.memorySnippet(context.recipientName) } catch { /* ignore */ }
    return buildInstructions(source, { ...context, knowledge, memory })
  }
  if (source === 'qb') {
    let qbSnapshot = ''
    let knowledge = ''
    let memory = ''
    try {
      qbSnapshot = await quickbooks.voiceContextSnippet()
    } catch {
      qbSnapshot = 'QUICKBOOKS MODE: demo — snapshot unavailable this session.'
    }
    try {
      knowledge = joeKnowledge.knowledgeSnippet()
    } catch {
      knowledge = 'TEACHING DOCS: unavailable this session.'
    }
    try {
      memory = joeMemory.memorySnippet()
    } catch {
      memory = 'LONG-TERM MEMORY: unavailable this session.'
    }
    return buildInstructions(source, { ...context, qbSnapshot, knowledge, memory })
  }
  return buildInstructions(source, context)
}

/** Turn raw conversation turns into one durable summary and store it. */
async function rememberTurns(turns, source = 'session', person = 'joe') {
  const who = joeMemory.personKey(person)
  const label = who.charAt(0).toUpperCase() + who.slice(1)
  const cleaned = (Array.isArray(turns) ? turns : [])
    .map(t => ({
      role: t?.role === 'assistant' ? 'assistant' : 'user',
      text: String(t?.text || t?.content || '').trim().slice(0, 2000)
    }))
    .filter(t => t.text)
  if (!cleaned.length) return null

  // Skip pure greeting-only noise
  const substantive = cleaned.filter(t => {
    const s = t.text.toLowerCase()
    if (t.role === 'assistant' && s.includes(`hello ${who}`) && s.includes('what can i do')) return false
    return s.length > 8
  })
  if (!substantive.length) return null

  const transcript = substantive
    .map(t => `${t.role === 'assistant' ? 'Assistant' : label}: ${t.text}`)
    .join('\n')
    .slice(0, 8000)

  let summary = ''
  if (hasApiKey()) {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini',
          temperature: 0.2,
          messages: [
            {
              role: 'system',
              content: `Summarize this conversation with ${label} for ${label}'s own long-term Axon memory bank. Write 2–5 dense sentences covering: preferences, decisions, facts, what they asked for, and anything to recall months later. No greeting fluff. Third person ("${label} asked…"). Max ${joeMemory.MAX_SUMMARY_CHARS} characters.`
            },
            { role: 'user', content: transcript }
          ]
        })
      })
      const data = await response.json()
      if (response.ok) {
        summary = data.choices?.[0]?.message?.content?.trim() || ''
      }
    } catch { /* fall through */ }
  }
  if (!summary) {
    summary = substantive
      .slice(0, 6)
      .map(t => `${t.role === 'assistant' ? 'A' : label.charAt(0)}: ${t.text}`)
      .join(' | ')
      .slice(0, joeMemory.MAX_SUMMARY_CHARS)
  }
  const saved = joeMemory.saveSummary(summary, {
    source,
    person: who,
    turns: substantive.length
  })
  // Keep older months recallable via digests (fire-and-forget)
  maybeRollupOlderMonths(who).catch(() => {})
  return saved
}

/** Compress prior months into digests so 3–6+ month recall stays in the bank. */
async function maybeRollupOlderMonths(person = 'joe') {
  const who = joeMemory.personKey(person)
  const label = who.charAt(0).toUpperCase() + who.slice(1)
  const now = new Date()
  const thisMonth = joeMemory.monthKey(now.toISOString())
  const memories = joeMemory.listMemories(who)
  const sessionMonths = [...new Set(
    memories
      .filter(e => (e.kind || 'session') !== 'month_digest')
      .map(e => joeMemory.monthKey(e.at))
      .filter(m => m && m !== thisMonth)
  )]
  const existingDigests = new Set(
    memories.filter(e => e.kind === 'month_digest').map(e => e.month)
  )

  for (const month of sessionMonths.slice(0, 6)) {
    const sessions = joeMemory.sessionsForMonth(month, who)
    if (sessions.length < 2) continue
    // Refresh digest when month has grown a lot, or create if missing
    const digest = memories.find(e => e.kind === 'month_digest' && e.month === month)
    if (digest && sessions.length < 8) continue
    if (existingDigests.has(month) && sessions.length < 8) continue

    const blob = sessions
      .map(s => `- ${s.at.slice(0, 10)}: ${s.summary}`)
      .join('\n')
      .slice(0, 9000)

    let text = ''
    if (hasApiKey()) {
      try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini',
            temperature: 0.2,
            messages: [
              {
                role: 'system',
                content: `Create a monthly memory digest of ${label}'s Axon conversations for ${month}. 4–8 dense sentences: lasting prefs, facts, decisions, recurring asks. Third person. Max ${joeMemory.MAX_SUMMARY_CHARS} chars.`
              },
              { role: 'user', content: blob }
            ]
          })
        })
        const data = await response.json()
        if (response.ok) text = data.choices?.[0]?.message?.content?.trim() || ''
      } catch { /* ignore */ }
    }
    if (!text) {
      text = sessions.slice(0, 8).map(s => s.summary).join(' ').slice(0, joeMemory.MAX_SUMMARY_CHARS)
    }
    joeMemory.upsertMonthDigest(month, text, who)
  }
}

// Exact words the AI must speak first. Used to force the opening over the
// data channel so the model cannot improvise its own greeting.
/**
 * Time of day comes from the caller's own device, since the server clock is UTC
 * and would greet a St. Louis morning as afternoon.
 */
function resolveTimeOfDay(value) {
  const v = String(value || '').toLowerCase()
  if (v === 'morning' || v === 'afternoon' || v === 'evening') {
    return `Good ${v}`
  }
  return 'Hello'
}

function buildSpokenGreeting(source, context = {}) {
  if (source === 'email') return A1_EMAIL_SPOKEN(context.recipientName || '')
  const opener = resolveTimeOfDay(context.timeOfDay)
  if (source === 'qb') {
    return `${opener} Joe, how are you today? What can I do for you?`
  }
  if (source === 'axon') {
    const name = context.recipientName ? ` ${context.recipientName}` : ''
    return `${opener}${name}, how are you today? What can I do for you?`
  }
  return ''
}

function hasApiKey() {
  return Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim())
}

app.get('/health', (_req, res) => {
  res.json({
    ok: hasApiKey(),
    openai_key_configured: hasApiKey(),
    model: REALTIME_MODEL,
    voice: REALTIME_VOICE
  })
})

app.get('/session', async (req, res) => {
  // Never cache: each call must mint a fresh token with the CURRENT voice.
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
  res.set('Pragma', 'no-cache')
  res.set('Expires', '0')
  if (!hasApiKey()) {
    return res.status(503).json({
      error: 'OPENAI_API_KEY is not set on the server. Add it in Render → Environment.'
    })
  }

  try {
    const raw = String(req.query.src || 'web').toLowerCase()
    const source = VALID_SOURCES.has(raw) ? raw : 'web'
    const recipientName = sanitizeRecipientName(req.query.name)
    const interruptible = INTERRUPTIBLE_SOURCES.has(source)
    const tier = resolveTier(req.query.tier || req.query.mode)
    const timeOfDay = req.query.tod
    const instructions = await buildInstructionsAsync(source, { recipientName })
    const response = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        session: {
          type: 'realtime',
          model: TIERS[tier].realtime,
          instructions,
          ...(OPEN_WEB_SOURCES.has(source) ? { tools: [WEB_SEARCH_TOOL] } : {}),
          audio: {
            input: {
              // Server-side noise reduction — the same class of processing the
              // ChatGPT app leans on. near_field = phone/headset held close; it
              // strips room noise (TV, music, a sound machine) before turn-detection.
              noise_reduction: { type: 'near_field' },
              // Set here, not by a client session.update. A partial session.update
              // from the browser drops audio.output.voice, which made the voice
              // change between sessions.
              transcription: { model: 'gpt-4o-mini-transcribe' },
              turn_detection: interruptible ? {
                // Semantic turn-detection — a model decides when the caller has
                // actually finished, so a TV, music, or room chatter doesn't cut
                // the AI off. Hands-free and interruptible, no tap needed.
                // 'low' eagerness waits longer before answering: slightly slower,
                // but it stops a radio or shop noise from making it talk to itself.
                type: 'semantic_vad',
                eagerness: PATIENT_SOURCES.has(source) ? 'low' : 'medium',
                interrupt_response: true,
                create_response: true
              } : {
                // Demo intros stay uninterruptible so they always finish.
                type: 'server_vad',
                threshold: 0.95,
                silence_duration_ms: 1200,
                prefix_padding_ms: 300,
                interrupt_response: false,
                create_response: true
              }
            },
            output: {
              voice: REALTIME_VOICE
            }
          }
        }
      })
    })

    const data = await response.json()

    if (!response.ok || data.error) {
      const message = data.error?.message || 'OpenAI session creation failed'
      return res.status(response.status || 502).json({ error: message })
    }

    const value = data.value || data.client_secret?.value
    if (!value) {
      return res.status(502).json({ error: 'OpenAI did not return a session token.' })
    }

    res.json({
      value,
      model: TIERS[tier].realtime,
      tier,
      voice: REALTIME_VOICE,
      source,
      recipientName,
      webSearch: OPEN_WEB_SOURCES.has(source),
      greeting: buildSpokenGreeting(source, { recipientName, timeOfDay })
    })
  } catch (error) {
    res.status(500).json({ error: 'API Failure' })
  }
})

function hasMailer() {
  return Boolean(
    process.env.GMAIL_USER?.trim() &&
    process.env.GMAIL_APP_PASSWORD?.trim()
  )
}

app.get('/download/orb.gif', (_req, res) => {
  const gifPath = path.join(__dirname, '..', 'public', 'email', 'orb-pulse.gif')
  res.download(gifPath, 'orb.gif')
})

app.get('/download/orb.png', (_req, res) => {
  const pngPath = path.join(__dirname, '..', 'public', 'email', 'orb-static.png')
  res.download(pngPath, 'orb.png')
})

app.get('/orb.png', (_req, res) => {
  const pngPath = path.join(__dirname, '..', 'public', 'email', 'orb-static.png')
  res.set('Content-Type', 'image/png')
  res.set('Cache-Control', 'public, max-age=86400')
  res.sendFile(pngPath)
})

app.get('/api/email-link', (_req, res) => {
  res.json({ link: EMAIL_ORB_LINK })
})

app.get('/api/mail-ready', (_req, res) => {
  res.json({ ok: hasMailer() })
})

app.post('/api/send-orb', async (req, res) => {
  const to = String(req.body?.email || '').trim()
  if (!to || !to.includes('@')) {
    return res.status(400).json({ error: 'Enter a valid email address.' })
  }
  if (!hasMailer()) {
    return res.status(503).json({
      error: 'Server cannot send email yet. Add GMAIL_USER and GMAIL_APP_PASSWORD in Render Environment.'
    })
  }

  const orbPath = path.join(__dirname, '..', 'public', 'email', 'a1-orb-eclipse.png')
  if (!fs.existsSync(orbPath)) {
    return res.status(500).json({ error: 'Orb image missing on server.' })
  }

  const html = `<!DOCTYPE html>
<html><body style="margin:0;padding:32px;background:#ffffff;text-align:center;font-family:Arial,sans-serif;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">
<tr><td align="center" style="padding:20px;">
<a href="${EMAIL_ORB_LINK}" target="_blank" rel="noopener noreferrer" style="text-decoration:none;">
<img src="cid:orb" alt="Talk to our AI team member now — powered by Axon AI" width="480" height="578" style="display:block;border:0;max-width:100%;height:auto;"/>
</a>
</td></tr>
</table>
</body></html>`

  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD
      }
    })

    await transporter.sendMail({
      from: `"A1 Asphalt" <${process.env.GMAIL_USER}>`,
      to,
      subject: 'Click the orb',
      html,
      attachments: [{
        filename: 'a1-orb-eclipse.png',
        path: orbPath,
        cid: 'orb'
      }]
    })

    res.json({ ok: true })
  } catch (error) {
    res.status(500).json({ error: 'Could not send email. Check Gmail app password on server.' })
  }
})

/* ---------- Joe's Professional Assistant (books + teaching docs) ---------- */

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 1 }
})

async function extractUploadedText(file) {
  const name = file.originalname || 'document'
  const lower = name.toLowerCase()
  const mime = file.mimetype || ''

  if (lower.endsWith('.txt') || lower.endsWith('.md') || mime.startsWith('text/')) {
    return file.buffer.toString('utf8')
  }
  if (lower.endsWith('.docx') || mime.includes('wordprocessingml')) {
    const mammoth = await import('mammoth')
    const result = await mammoth.extractRawText({ buffer: file.buffer })
    return result.value || ''
  }
  if (lower.endsWith('.pdf') || mime === 'application/pdf') {
    const pdfParse = (await import('pdf-parse')).default
    const result = await pdfParse(file.buffer)
    return result.text || ''
  }
  throw new Error('Use a .txt, .md, .pdf, or .docx file.')
}

app.get('/api/brain/status', (req, res) => {
  res.set('Cache-Control', 'no-store')
  let docs = []
  let memory = { count: 0, latestAt: null }
  try { docs = joeKnowledge.listDocs() } catch { docs = [] }
  try { memory = joeMemory.status(req.query.person || req.query.name) } catch { /* ignore */ }
  res.json({
    ok: true,
    ...quickbooks.status(),
    openai: hasApiKey(),
    memory,
    docs: docs.map(d => ({ id: d.id, name: d.name, updatedAt: d.updatedAt }))
  })
})

app.get('/api/brain/memory', (req, res) => {
  res.set('Cache-Control', 'no-store')
  try {
    const person = joeMemory.personKey(req.query.person || req.query.name)
    res.json({
      ok: true,
      ...joeMemory.status(person),
      memories: joeMemory.listMemories(person).slice(0, 60)
    })
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message || 'memory list failed' })
  }
})

/** Rebuild monthly digests so older months stay easy to recall. */
app.post('/api/brain/memory/rollup', async (req, res) => {
  res.set('Cache-Control', 'no-store')
  try {
    const person = joeMemory.personKey(req.body?.person || req.query.person)
    await maybeRollupOlderMonths(person)
    res.json({ ok: true, ...joeMemory.status(person) })
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message || 'rollup failed' })
  }
})

/** Client (or server) posts conversation turns; we summarize + store automatically. */
app.post('/api/brain/memory/remember', async (req, res) => {
  res.set('Cache-Control', 'no-store')
  try {
    const person = joeMemory.personKey(req.body?.person || req.body?.name)
    const entry = await rememberTurns(req.body?.turns, req.body?.source || 'session', person)
    if (!entry) {
      return res.json({ ok: true, saved: false, reason: 'nothing_to_remember' })
    }
    res.json({
      ok: true,
      saved: true,
      entry: { id: entry.id, at: entry.at },
      ...joeMemory.status(person)
    })
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message || 'remember failed' })
  }
})

/**
 * Import a ChatGPT data export (conversations.json) into the memory bank so a
 * new assistant starts out already knowing the user's history.
 */
app.post('/api/brain/memory/import', upload.single('file'), async (req, res) => {
  res.set('Cache-Control', 'no-store')
  try {
    if (!req.file) {
      return res.status(400).json({ ok: false, error: 'Upload conversations.json from your ChatGPT export.' })
    }
    let parsed
    try {
      parsed = JSON.parse(req.file.buffer.toString('utf8'))
    } catch {
      return res.status(400).json({ ok: false, error: 'That file is not valid JSON. Use conversations.json from the export.' })
    }

    const conversations = extractChatGptConversations(parsed)
    if (!conversations.length) {
      return res.status(400).json({ ok: false, error: 'No conversations found in that file.' })
    }

    const limit = Math.min(Number(req.body?.limit) || 60, 150)
    const chosen = conversations
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
      .slice(0, limit)

    const person = joeMemory.personKey(req.body?.person || req.body?.name)
    let saved = 0
    for (const convo of chosen) {
      const entry = await rememberTurns(convo.turns, 'chatgpt-import', person)
      if (entry) saved++
    }
    maybeRollupOlderMonths(person).catch(() => {})

    res.json({
      ok: true,
      found: conversations.length,
      imported: saved,
      ...joeMemory.status(person)
    })
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message || 'import failed' })
  }
})

/** Pull {title, turns[]} out of ChatGPT's export shape (mapping tree per convo). */
function extractChatGptConversations(parsed) {
  const list = Array.isArray(parsed) ? parsed : (parsed?.conversations || [])
  const out = []

  for (const convo of list) {
    const mapping = convo?.mapping
    const turns = []

    if (mapping && typeof mapping === 'object') {
      const nodes = Object.values(mapping)
        .map(n => n?.message)
        .filter(Boolean)
        .sort((a, b) => (a.create_time || 0) - (b.create_time || 0))

      for (const msg of nodes) {
        const role = msg?.author?.role
        if (role !== 'user' && role !== 'assistant') continue
        const parts = msg?.content?.parts
        const text = Array.isArray(parts)
          ? parts.filter(p => typeof p === 'string').join('\n').trim()
          : ''
        if (text) turns.push({ role, text })
      }
    } else if (Array.isArray(convo?.messages)) {
      for (const msg of convo.messages) {
        const role = msg?.role === 'assistant' ? 'assistant' : 'user'
        const text = String(msg?.content || '').trim()
        if (text) turns.push({ role, text })
      }
    }

    if (turns.length) {
      const title = String(convo?.title || '').trim()
      if (title) turns.unshift({ role: 'user', text: `Conversation topic: ${title}` })
      out.push({
        title,
        updatedAt: Number(convo?.update_time || convo?.create_time || 0),
        turns
      })
    }
  }
  return out
}

app.get('/api/brain/docs', (_req, res) => {
  res.set('Cache-Control', 'no-store')
  try {
    res.json({ ok: true, docs: joeKnowledge.listDocs() })
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message || 'list failed' })
  }
})

app.post('/api/brain/teach', upload.single('file'), async (req, res) => {
  res.set('Cache-Control', 'no-store')
  try {
    if (!req.file) {
      return res.status(400).json({ ok: false, error: 'Choose a file to upload.' })
    }
    const text = await extractUploadedText(req.file)
    const saved = joeKnowledge.saveDoc(req.file.originalname, text)
    res.json({
      ok: true,
      doc: saved,
      message: `Got it — I learned from “${req.file.originalname}”.`
    })
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message || 'Upload failed.' })
  }
})

app.delete('/api/brain/docs/:id', (req, res) => {
  res.set('Cache-Control', 'no-store')
  const ok = joeKnowledge.deleteDoc(req.params.id)
  if (!ok) return res.status(404).json({ ok: false, error: 'Doc not found.' })
  res.json({ ok: true })
})

app.post('/api/brain/ask', async (req, res) => {
  res.set('Cache-Control', 'no-store')
  try {
    const question = String(req.body?.question || req.body?.q || '').trim()
    const result = await quickbooks.ask(question)
    res.json(result)
  } catch (error) {
    res.status(500).json({
      ok: false,
      answer: 'The brain hit a snag reading the books. Try again in a moment.',
      error: error.message || 'ask failed'
    })
  }
})

app.post('/api/brain/web-search', async (req, res) => {
  res.set('Cache-Control', 'no-store')
  if (!hasApiKey()) {
    return res.status(503).json({
      ok: false,
      summary: 'Web search needs OPENAI_API_KEY on the server.',
      sources: []
    })
  }
  const query = String(req.body?.query || req.body?.q || '').trim()
  if (!query) {
    return res.status(400).json({ ok: false, summary: 'Missing search query.', sources: [] })
  }
  try {
    const result = await webSearch(query, {
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_WEB_SEARCH_MODEL || TIERS[resolveTier(req.body?.tier)].chat
    })
    const status = result.ok ? 200 : 502
    return res.status(status).json(result)
  } catch (error) {
    return res.status(500).json({
      ok: false,
      summary: error.message || 'Web search failed.',
      sources: []
    })
  }
})

app.post('/api/brain/chat', async (req, res) => {
  res.set('Cache-Control', 'no-store')
  const question = String(req.body?.question || req.body?.q || '').trim()
  if (!question) {
    return res.status(400).json({ ok: false, answer: 'Type a question first.' })
  }

  // Books-shaped questions → structured QuickBooks/demo answer
  try {
    const intent = quickbooks.detectIntent(question)
    if (intent.type === 'pnl' || intent.type === 'payroll_chart') {
      const result = await quickbooks.ask(question)
      if (result?.answer) {
        rememberTurns(
          [{ role: 'user', text: question }, { role: 'assistant', text: result.answer }],
          'books'
        ).catch(() => {})
      }
      return res.json(result)
    }
  } catch { /* fall through to chat */ }

  if (!hasApiKey()) {
    return res.status(503).json({
      ok: false,
      answer: 'Text chat needs OPENAI_API_KEY on the server.'
    })
  }

  try {
    let knowledge = ''
    let qbSnapshot = ''
    let memory = ''
    try { knowledge = joeKnowledge.knowledgeSnippet() } catch { /* ignore */ }
    try { qbSnapshot = await quickbooks.voiceContextSnippet() } catch { /* ignore */ }
    try { memory = joeMemory.memorySnippet() } catch { /* ignore */ }

    const tier = resolveTier(req.body?.tier)
    // Open brain text chat uses Responses + live web_search (ChatGPT-like).
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: TIERS[tier].chat,
        tools: [{ type: 'web_search' }],
        tool_choice: 'auto',
        input: [
          {
            role: 'system',
            content: [
              {
                type: 'input_text',
                text: `You are Joe's Professional Assistant (powered by Axon AI) — an open general brain like ChatGPT. Use live web search for current prices, stock, product pages, news, and politics. Prefer teaching docs, long-term memory, and the books snapshot for company books questions — do not invent dollar amounts that are not in those sources. Answer briefly and helpfully.

${qbSnapshot}

${knowledge}

${memory}`
              }
            ]
          },
          {
            role: 'user',
            content: [{ type: 'input_text', text: question }]
          }
        ]
      })
    })
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.error?.message || 'Chat failed')
    }
    let answer = typeof data.output_text === 'string' ? data.output_text.trim() : ''
    if (!answer) {
      const chunks = []
      for (const item of data.output || []) {
        if (item?.type !== 'message') continue
        for (const part of item.content || []) {
          if (part?.text) chunks.push(part.text)
        }
      }
      answer = chunks.join('\n').trim()
    }
    if (!answer) answer = 'I did not get a clear answer — try again.'
    // Auto-remember this exchange (fire-and-forget)
    rememberTurns(
      [{ role: 'user', text: question }, { role: 'assistant', text: answer }],
      'text'
    ).catch(() => {})
    res.json({ ok: true, intent: 'chat', answer, chart: null, webSearch: true })
  } catch (error) {
    res.status(500).json({
      ok: false,
      answer: 'Text chat hit a snag. Try again in a moment.',
      error: error.message || 'chat failed'
    })
  }
})

app.listen(process.env.PORT || 3000)
