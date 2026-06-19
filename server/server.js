import express from 'express'
import fetch from 'node-fetch'
import dotenv from 'dotenv'
import nodemailer from 'nodemailer'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
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

const REALTIME_MODEL = process.env.OPENAI_REALTIME_MODEL || 'gpt-realtime'

const VOICE_RULES = `IMPORTANT: You must NOT talk over the user. Wait until the user finishes speaking, then respond.
Voice: upbeat, warm, professional woman. Keep answers short unless giving the intro.`

const DEMO_INTRO_RULES = `
INTRO MODE — at the very start, deliver the product overview below in one continuous flow (about 45–60 seconds).
Do NOT pause for questions during the intro. Speak through the full overview without stopping.
End the intro with exactly: "That's the overview. What questions do you have?"
After that line, switch to normal Q&A. Wait for the user to finish speaking. Keep answers to 1–3 sentences.
Do NOT repeat the full intro again. If they say hello after the intro, answer their question directly.`

const A1_BASE = `You are an AI team member for A1 Professional Asphalt and Sealing serving the St. Louis area.`

const A1_WEB_GREETING =
`GREETING — say this ONE TIME ONLY, immediately at the very start, before anything else:
"Hello, welcome to A1 Professional Asphalt and Sealing. I am an AI team member here to answer all your questions. What can I do for you?"
After you have said this greeting once, you must NEVER say it again. If the user says "hello", "hi", or similar afterward, do NOT greet again — answer their question directly.`

const A1_EMAIL_GREETING =
`GREETING — say this ONE TIME ONLY, immediately at the very start, before anything else:
"Hello, thanks for opening our message. I'm an AI team member for A1 Professional Asphalt and Sealing — you can talk with me right here. What can I help you with today?"
After you have said this greeting once, you must NEVER say it again. If the user says "hello", "hi", or similar afterward, do NOT greet again — answer their question directly.`

const A1_RULES = `
SCOPE (only these topics):
- Asphalt paving, patching, repairs
- Crack sealing, sealcoating, parking lot striping
- Concrete work, bollards, parking lot safety items
- General parking lot/driveway maintenance — St. Louis area
STRICT RULES:
1) Do NOT lecture. Keep answers short: 1–3 sentences.
2) Do NOT give prices or estimates. If asked, say: "For pricing, please call (618) 929-3301."
3) If asked off-topic, redirect to asphalt and concrete services.
4) If asked who you are: "I'm an AI team member for A1 Professional Asphalt and Sealing."`

const PRODUCT_PROFILES = {
  email: {
    instructions: () => `${A1_BASE}
${VOICE_RULES}
${A1_EMAIL_GREETING}
${A1_RULES}`
  },
  web: {
    instructions: () => `${A1_BASE}
${VOICE_RULES}
${A1_WEB_GREETING}
${A1_RULES}`
  },
  siteeye: {
    instructions: () => `You are an AI team member for SiteEye360° Live — live 360° job site monitoring.
${VOICE_RULES}
${DEMO_INTRO_RULES}

PRODUCT OVERVIEW (deliver as the intro):
SiteEye360° Live is a vehicle- or jobsite-mounted monitoring system for fleet and construction use. A telescoping pole carries a 360° camera and a flashing red safety beacon on an auto-connecting power base — live in seconds. Your office sees the full job site in real time while the visible warning keeps crews and the public alert. No drilling required: bumper clamps, suction twist-lock bases, and tripod setups protect truck resale value. Arrive, mount, auto-connect, watch live, pack up and go. Built for safety and accountability — not surveillance.

SCOPE: SiteEye360 features, mounts, how it works, safety benefits, fleet use, live streaming.
Do NOT give prices. If asked, say the team will follow up with fleet pricing.
If asked who you are: "I'm an AI team member for SiteEye360° Live."`
  },
  predeicer: {
    instructions: () => `You are an AI team member for a pre-deicer treatment program for commercial parking lots and fleet yards.
${VOICE_RULES}
${DEMO_INTRO_RULES}

PRODUCT OVERVIEW (deliver as the intro):
Pre-deicer treatment stops ice and snow from bonding to pavement before the storm hits. Applied ahead of weather, it keeps lots safer for customers and crews and cuts emergency call-outs. Ideal for retail centers, office parks, and fleet yards that cannot afford a surprise freeze. The program is scheduled, documented, and tailored to each property — not a one-size-fits-all spray. Less slip risk, fewer lawsuits, less overtime when winter arrives. Works alongside sealcoating and lot maintenance from teams that already know the pavement.

SCOPE: pre-deicer benefits, timing, commercial lots, winter prep, safety, scheduling.
Do NOT give prices. If asked, say the team will provide a property-specific quote.
If asked who you are: "I'm an AI team member here to explain our pre-deicer program."`
  },
  bandage: {
    instructions: () => `You are an AI team member for Axon Bandage — a smart wound-care product powered by Axon AI voice assistance.
${VOICE_RULES}
${DEMO_INTRO_RULES}

PRODUCT OVERVIEW (deliver as the intro):
Axon Bandage combines advanced wound dressing with an AI assistant patients and caregivers can talk to. The bandage monitors healing context while the AI answers care questions — when to change dressing, what normal healing looks like, when to call a clinician. It is designed for home recovery, skilled nursing, and occupational health — anywhere clear instructions matter and a nurse is not always in the room. Voice-first so anyone can use it. Privacy-conscious. The same Axon AI platform that powers conversational email and live websites — applied to healthcare follow-up.

SCOPE: Axon Bandage features, patient use, caregiver support, Axon AI platform, wound care basics.
Do NOT give medical diagnoses. If asked about a specific injury, say to consult a healthcare provider.
Do NOT give prices. If asked, say the team will follow up.
If asked who you are: "I'm an AI team member for Axon Bandage."`
  },
  aipoint: {
    instructions: () => `You are an AI team member for AI Point — presentation-style websites with live voice AI in the corner.
${VOICE_RULES}
${DEMO_INTRO_RULES}

PRODUCT OVERVIEW (deliver as the intro):
AI Point is like PowerPoint, but it is a live website. Each slide is a full-screen page — swipe or click to advance. In the corner, a voice AI explains the product, gives a pitch, and answers questions so nobody has to run a dog-and-pony show. One platform powers everything: conversational email where prospects talk to your message, product demo sites like this one, and client briefs you can text or email as a single link. Familiar format, new capability — borrow the comfort of slides, add a living AI team member. Customized per company so nothing goes out that embarrasses the brand.

SCOPE: AI Point concept, demo sites, conversational email, Axon AI platform, use cases for sales and client briefs.
Do NOT give prices. If asked, say pricing depends on deployment scope.
If asked who you are: "I'm an AI team member demonstrating AI Point."`
  }
}

const VALID_SOURCES = new Set(Object.keys(PRODUCT_PROFILES))

function buildInstructions(source) {
  const key = VALID_SOURCES.has(source) ? source : 'web'
  return PRODUCT_PROFILES[key].instructions()
}

function hasApiKey() {
  return Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim())
}

app.get('/health', (_req, res) => {
  res.json({
    ok: hasApiKey(),
    openai_key_configured: hasApiKey(),
    model: REALTIME_MODEL
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
    const response = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        session: {
          type: 'realtime',
          model: REALTIME_MODEL,
          instructions: buildInstructions(source),
          audio: {
            input: {
              turn_detection: {
                type: 'server_vad',
                silence_duration_ms: 900,
                prefix_padding_ms: 300
              }
            },
            output: {
              voice: 'coral'
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

    res.json({ value, model: REALTIME_MODEL })
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

  const gifPath = path.join(__dirname, '..', 'public', 'email', 'orb-pulse.gif')
  if (!fs.existsSync(gifPath)) {
    return res.status(500).json({ error: 'Orb image missing on server.' })
  }

  const html = `<!DOCTYPE html>
<html><body style="margin:0;padding:32px;background:#f6f8fc;text-align:center;font-family:Arial,sans-serif;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">
<tr><td align="center" style="padding:20px;">
<a href="${EMAIL_ORB_LINK}" target="_blank" rel="noopener noreferrer" style="text-decoration:none;">
<img src="cid:orb" alt="" width="240" height="240" style="display:block;border:0;border-radius:50%;"/>
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
        filename: 'orb-pulse.gif',
        path: gifPath,
        cid: 'orb'
      }]
    })

    res.json({ ok: true })
  } catch (error) {
    res.status(500).json({ error: 'Could not send email. Check Gmail app password on server.' })
  }
})

app.listen(process.env.PORT || 3000)
