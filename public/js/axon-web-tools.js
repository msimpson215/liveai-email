/**
 * Client helper: when the Realtime model calls web_search, hit our server
 * and feed the result back into the voice session.
 */
(function (global) {
  async function fetchWebSearch(query) {
    const r = await fetch('/api/brain/web-search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: String(query || '').trim() })
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || data.ok === false) {
      return {
        ok: false,
        summary: data.summary || data.error || 'Web search failed.',
        sources: data.sources || []
      };
    }
    return data;
  }

  function parseArgs(raw) {
    try {
      const obj = typeof raw === 'string' ? JSON.parse(raw || '{}') : raw || {};
      return String(obj.query || obj.q || '').trim();
    } catch (e) {
      return String(raw || '').trim();
    }
  }

  /**
   * @param {object} msg realtime event
   * @param {RTCDataChannel} dc
   * @param {{ onStatus?: (s:string)=>void }} [opts]
   * @returns {Promise<boolean>} true if a tool round was handled
   */
  async function handleRealtimeWebTools(msg, dc, opts) {
    if (!msg || msg.type !== 'response.done' || !dc || dc.readyState !== 'open') return false;
    const outputs = (msg.response && msg.response.output) || [];
    const calls = outputs.filter(function (o) {
      return o && o.type === 'function_call' && o.name === 'web_search' && o.call_id;
    });
    if (!calls.length) return false;

    if (opts && typeof opts.onStatus === 'function') opts.onStatus('Looking that up…');

    for (let i = 0; i < calls.length; i++) {
      const call = calls[i];
      const query = parseArgs(call.arguments);
      let result;
      try {
        result = await fetchWebSearch(query);
      } catch (e) {
        result = { ok: false, summary: 'Web search could not reach the server.', sources: [] };
      }
      const output = JSON.stringify({
        ok: !!result.ok,
        summary: result.summary || '',
        sources: result.sources || []
      });
      try {
        dc.send(
          JSON.stringify({
            type: 'conversation.item.create',
            item: {
              type: 'function_call_output',
              call_id: call.call_id,
              output: output
            }
          })
        );
      } catch (e) {
        return true;
      }
    }

    try {
      dc.send(JSON.stringify({ type: 'response.create' }));
    } catch (e) {}
    return true;
  }

  global.AxonWebTools = {
    fetchWebSearch: fetchWebSearch,
    handleRealtimeWebTools: handleRealtimeWebTools
  };
})(typeof window !== 'undefined' ? window : globalThis);
