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
app.use(express.static('public'))

const EMAIL_ORB_LINK = 'https://liveai-email.onrender.com/email-plate.html?src=email&popup=1&autostart=1'

const REALTIME_MODEL = process.env.OPENAI_REALTIME_MODEL || 'gpt-realtime'

const BASE_INSTRUCTIONS = `You are an AI team member for A1 Professional Asphalt and Concrete serving the St. Louis area.
IMPORTANT: You must NOT talk over the user. Wait until the user finishes speaking, then respond.`

const WEB_GREETING =
`START OF SESSION (say exactly this once, and only once):
"Hello, welcome to A1 Professional Asphalt and Sealing. I am an AI team member here to answer all your questions. What can I do for you?"`

const EMAIL_GREETING =
`START OF SESSION (say exactly this once, and only once):
"Hello, thanks for opening our message. I'm an AI team member for A1 Professional Asphalt and Sealing — you can talk with me right here. What can I help you with today?"`

const SHARED_RULES = `
SCOPE (only these topics):
- Asphalt paving, patching, repairs
- Crack sealing
- Sealcoating
- Parking lot striping
- Concrete work
- Bollards (yellow safety posts), signage posts, parking lot safety items
- General parking lot/driveway maintenance
- St. Louis area context
STRICT RULES:
1) Do NOT explain what asphalt is made of unless the user specifically asks "what is asphalt made of" or similar.
2) Do NOT lecture. Keep answers short: 1–3 sentences, then ask 1 clarifying question if needed.
3) Do NOT give prices, quotes, or estimates.
   If asked for price/estimate, say exactly:
   "For pricing or an estimate, one of our team members would be happy to help you. Please call (618) 929-3301."
4) If asked anything unrelated to A1 asphalt/concrete services, say:
   "I'm here to help with asphalt and concrete services. What can I help you with today?"
5) If the user asks "What are you?" or "Who are you?", answer in ONE sentence:
   "I'm an AI team member for A1 Professional Asphalt and Concrete, here to answer questions about our asphalt and concrete services."
STYLE:
- Friendly, calm, local, professional.
- Answer what was asked. No extra topics. No repeated greeting.`

function buildInstructions(source) {
  const greeting = source === 'email' ? EMAIL_GREETING : WEB_GREETING
  return `${BASE_INSTRUCTIONS}
${greeting}${SHARED_RULES}`
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
  if (!hasApiKey()) {
    return res.status(503).json({
      error: 'OPENAI_API_KEY is not set on the server. Add it in Render → Environment.'
    })
  }

  try {
    const source = req.query.src === 'email' ? 'email' : 'web'
    const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: REALTIME_MODEL,
        voice: 'alloy',
        modalities: ['audio', 'text'],
        turn_detection: {
          type: 'server_vad',
          silence_duration_ms: 900,
          prefix_padding_ms: 300,
          create_response: true
        },
        instructions: buildInstructions(source)
      })
    })

    const data = await response.json()

    if (!response.ok || data.error) {
      const message = data.error?.message || 'OpenAI session creation failed'
      return res.status(response.status || 502).json({ error: message })
    }

    if (!data.client_secret?.value) {
      return res.status(502).json({ error: 'OpenAI did not return a session token.' })
    }

    res.json({ ...data, model: REALTIME_MODEL })
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
