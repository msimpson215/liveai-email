/**
 * Voice/text function calls for Facebook watch. Hits the AAR backend.
 * Does not talk to Apify from the browser.
 */
(function (global) {
  function key() {
    try { return localStorage.getItem('aar-review-key') || '' } catch (e) { return '' }
  }

  async function callTool(name, args) {
    const r = await fetch('/api/aar/monitor/tool', {
      method: 'POST',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json', 'x-aar-key': key() },
      body: JSON.stringify({ name: name, arguments: args || {} })
    })
    return r.json().catch(function () { return { error: 'Watch tool failed.' } })
  }

  function callsFrom(msg) {
    const out = []
    if (!msg) return out
    if (msg.type === 'response.function_call_arguments.done' && msg.name && msg.call_id) {
      out.push({ name: msg.name, call_id: msg.call_id, arguments: msg.arguments })
    }
    const outputs = (msg.response && msg.response.output) || msg.output || []
    for (let i = 0; i < outputs.length; i++) {
      const o = outputs[i]
      if (o && o.type === 'function_call' && o.name && o.call_id) {
        out.push({ name: o.name, call_id: o.call_id, arguments: o.arguments })
      }
    }
    return out.filter(function (c) { return c.name === 'search_facebook' || c.name === 'get_facebook_findings' })
  }

  async function handle(msg, dc) {
    const calls = callsFrom(msg)
    if (!calls.length || !dc || dc.readyState !== 'open') return false
    for (let i = 0; i < calls.length; i++) {
      const call = calls[i]
      let args = {}
      try { args = typeof call.arguments === 'string' ? JSON.parse(call.arguments || '{}') : (call.arguments || {}) } catch (e) {}
      const result = await callTool(call.name, args)
      try {
        dc.send(JSON.stringify({
          type: 'conversation.item.create',
          item: { type: 'function_call_output', call_id: call.call_id, output: JSON.stringify(result).slice(0, 8000) }
        }))
      } catch (e) { return true }
    }
    try { dc.send(JSON.stringify({ type: 'response.create' })) } catch (e) {}
    return true
  }

  global.AarMonitorTools = { handle: handle, callTool: callTool }
})(typeof window !== 'undefined' ? window : globalThis)
