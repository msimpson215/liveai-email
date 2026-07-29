/**
 * Live web lookup via OpenAI Responses API + web_search tool.
 * Used by open brains (Axon / Joe). Product demos stay offline.
 */

function extractResponseText(data) {
  if (typeof data?.output_text === 'string' && data.output_text.trim()) {
    return data.output_text.trim()
  }
  const chunks = []
  for (const item of data?.output || []) {
    if (item?.type !== 'message') continue
    for (const part of item.content || []) {
      if (part?.type === 'output_text' && part.text) chunks.push(part.text)
      else if (part?.type === 'text' && part.text) chunks.push(part.text)
    }
  }
  return chunks.join('\n').trim()
}

function extractCitations(data) {
  const urls = []
  const seen = new Set()
  for (const item of data?.output || []) {
    if (item?.type !== 'message') continue
    for (const part of item.content || []) {
      for (const ann of part?.annotations || []) {
        const url = ann?.url || ann?.href
        if (url && !seen.has(url)) {
          seen.add(url)
          urls.push(url)
        }
      }
    }
  }
  return urls.slice(0, 6)
}

/**
 * @param {string} query
 * @param {{ apiKey: string, model?: string }} opts
 */
export async function webSearch(query, opts) {
  const q = String(query || '').trim().slice(0, 500)
  if (!q) {
    return { ok: false, summary: 'No search query was provided.', sources: [] }
  }
  if (!opts?.apiKey) {
    return { ok: false, summary: 'Web search is not configured on the server.', sources: [] }
  }

  const model = opts.model || process.env.OPENAI_WEB_SEARCH_MODEL || 'gpt-4o-mini'
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${opts.apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      tools: [{ type: 'web_search' }],
      tool_choice: 'auto',
      input: [
        {
          role: 'system',
          content: [
            {
              type: 'input_text',
              text:
                'You look up live web facts for a voice assistant. Answer in plain, short prose a person can speak aloud: prices, stock, product links, news, politics, sports, weather. Include dollar amounts and 1–3 concrete store or site names with URLs when available. If results conflict or are thin, say so. Do not invent prices.'
            }
          ]
        },
        {
          role: 'user',
          content: [{ type: 'input_text', text: q }]
        }
      ]
    })
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message = data?.error?.message || `Web search failed (${response.status})`
    return { ok: false, summary: message, sources: [] }
  }

  const summary = extractResponseText(data)
  const sources = extractCitations(data)
  if (!summary) {
    return {
      ok: false,
      summary: 'Search ran but returned no usable text. Try a more specific query.',
      sources
    }
  }

  return { ok: true, summary, sources, model }
}

/** Realtime session function tool — client executes, server runs webSearch. */
export const WEB_SEARCH_TOOL = {
  type: 'function',
  name: 'web_search',
  description:
    'Search the live internet for current facts: prices, stock, product pages, news, politics, sports, weather, company info, how-to details. Use this whenever the user needs up-to-date information — do not say you cannot access the web.',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description:
          'A focused search query, e.g. "1975 Corvette distributor price RockAuto Summit Racing"'
      }
    },
    required: ['query'],
    additionalProperties: false
  }
}
