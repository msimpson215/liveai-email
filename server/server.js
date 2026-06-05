import express from 'express'
import fetch from 'node-fetch'
import dotenv from 'dotenv'
dotenv.config()

const app = express()
app.use(express.static('public'))

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

app.listen(process.env.PORT || 3000)
