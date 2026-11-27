(function () {
  const params = new URLSearchParams(location.search)
  let key = params.get('k') || ''
  try { key = key || localStorage.getItem('aar-review-key') || '' } catch (e) {}

  const state = { data: null }

  function $(id) { return document.getElementById(id) }
  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  }
  function usd(n) { return '$' + Number(n || 0).toFixed(3) }
  function when(iso) { return iso ? String(iso).replace('T', ' ').slice(0, 16) : '' }

  async function api(path, body) {
    const opts = { cache: 'no-store', headers: { 'x-aar-key': key } }
    if (body !== undefined) {
      opts.method = 'POST'
      opts.headers['Content-Type'] = 'application/json'
      opts.body = JSON.stringify(body)
    }
    const r = await fetch(path, opts)
    return r.json().catch(function () { return {} })
  }

  function terms() {
    return ($('watchTerms').value || '').split('\n').map(function (t) { return t.trim() }).filter(Boolean)
  }
  function recipients() {
    return ($('watchEmails').value || '').split(/[\n,;]+/).map(function (t) { return t.trim() }).filter(Boolean)
  }

  function renderResults(scan) {
    if (!scan) return '<p class="tiny">No search stored yet.</p>'
    const head = '<p class="tiny">' + esc(when(scan.at)) + ' · ' + esc(scan.source) + ' · total ' + usd(scan.totalUsd) +
      ' · new flagged ' + esc(scan.newCount) + (scan.stoppedReason ? ' · ' + esc(scan.stoppedReason) : '') + '</p>'
    const blocks = (scan.terms || []).map(function (t) {
      const rows = (t.results || []).map(function (r) {
        const flagged = r.status && r.status !== 'not_flagged'
        return '<tr class="' + (flagged ? 'flag' : '') + '">' +
          '<td>' + esc(r.name) + '</td>' +
          '<td><a href="' + esc(r.url) + '" target="_blank" rel="noopener noreferrer">' + esc(r.url) + '</a></td>' +
          '<td>' + esc(r.id) + '</td>' +
          '<td>' + esc(r.description || '—') + '</td>' +
          '<td>' + esc(String(r.discoveredAt || '').slice(0, 10)) + '</td>' +
          '<td>' + esc(r.reason || '') + '</td></tr>'
      }).join('')
      return '<p class="wkw">“' + esc(t.keyword) + '” · ' + (t.results || []).length + ' results · cost ' + usd(t.costUsd) +
        (t.runId ? ' · run ' + esc(t.runId) : '') + (t.error ? ' · ' + esc(t.error) : '') + '</p>' +
        (rows
          ? '<table class="wres"><thead><tr><th>Page name</th><th>Facebook URL</th><th>Page ID</th><th>Description</th><th>Discovered</th><th>Reason</th></tr></thead><tbody>' + rows + '</tbody></table>'
          : '<p class="tiny">No results returned.</p>')
    }).join('')
    return head + blocks
  }

  function render() {
    const d = state.data
    if (!d || d.role !== 'marty') return
    document.body.classList.add('desk')
    const s = d.settings || {}
    if ($('watchTerms') && document.activeElement !== $('watchTerms')) $('watchTerms').value = (s.searchTerms || []).join('\n')
    if ($('watchMax') && document.activeElement !== $('watchMax')) $('watchMax').value = s.maxResults || 20
    if ($('watchCap') && document.activeElement !== $('watchCap')) $('watchCap').value = s.dailyCapUsd != null ? s.dailyCapUsd : 1
    if ($('watchTime') && document.activeElement !== $('watchTime')) $('watchTime').value = s.dailyScanTime || '07:00'
    if ($('watchOn')) $('watchOn').checked = !!s.monitoringEnabled
    if ($('watchEmails') && document.activeElement !== $('watchEmails')) $('watchEmails').value = (s.emailRecipients || []).join('\n')
    const b = d.budget || {}
    $('watchCaps').textContent = 'Spent today ' + usd(b.spentTodayUsd) + ' of $' + Number(b.dailyCapUsd || 0).toFixed(2) +
      ' · left ' + usd(b.leftTodayUsd) + ' · each keyword search capped at ' + usd(b.perSearchCapUsd) +
      (d.apifyReady ? '' : ' · Apify token missing on the server') +
      (d.mailReady ? ' · email connected' : ' · email not connected on the server')
    const latest = d.latestScan
    $('watchScan').textContent = latest
      ? ('Last search ' + when(latest.at) + ' · ' + latest.source + ' · ' + (latest.terms || []).length + ' keywords · ' + usd(latest.totalUsd))
      : 'No search stored yet.'
    $('watchList').innerHTML = (d.flagged || []).map(function (p) {
      return '<button type="button" class="qitem ' + (p.status === 'confirmed_fraud' ? 'bad' : '') + '" data-page="' + esc(p.id) + '">' +
        '<em>' + esc(String(p.status).replace(/_/g, ' ')) + '</em>' + esc(p.name) +
        '<small>' + esc(p.id) + ' · first seen ' + esc(String(p.firstSeenAt).slice(0, 10)) +
        (p.firstKeyword ? ' · keyword “' + esc(p.firstKeyword) + '”' : '') + '</small></button>'
    }).join('') || '<p class="tiny">Nothing flagged for review.</p>'
    $('watchResults').innerHTML = renderResults(latest)
  }

  async function load() {
    if (!key) return
    const d = await api('/api/aar/monitor').catch(function () { return {} })
    if (!d || d.unauthorized || d.error && !d.settings) return
    if (d.role !== 'marty') return
    state.data = d
    document.body.classList.add('can-watch')
    render()
  }

  async function save() {
    const d = await api('/api/aar/monitor/settings', {
      searchTerms: terms(),
      maxResults: Number($('watchMax').value),
      dailyCapUsd: Number($('watchCap').value),
      dailyScanTime: $('watchTime').value,
      monitoringEnabled: $('watchOn').checked,
      emailRecipients: recipients()
    })
    if (d.settings) state.data.settings = d.settings
    $('watchNotice').textContent = d.error || 'Settings saved.'
    await load()
  }

  async function runNow() {
    $('watchNotice').textContent = 'Searching Facebook Pages for each saved keyword…'
    $('watchRun').disabled = true
    try {
      const d = await api('/api/aar/monitor/search', {})
      if (d.error) { $('watchNotice').textContent = d.error; return }
      const mail = d.email && d.email.sent ? 'alert emailed' : 'no email (' + ((d.email && d.email.reason) || 'nothing new') + ')'
      $('watchNotice').textContent = 'Done. ' + (d.scan.terms || []).length + ' keywords · ' + usd(d.scan.totalUsd) +
        ' · new flagged ' + d.scan.newCount + ' · ' + mail + (d.scan.stoppedReason ? ' · ' + d.scan.stoppedReason : '')
    } finally {
      $('watchRun').disabled = false
      await load()
    }
  }

  async function testEmail() {
    const d = await api('/api/aar/monitor/test-email', {})
    $('watchNotice').textContent = d.error || 'Test email sent.'
  }

  function openWatch(on) {
    document.body.classList.toggle('show-watch', on)
    const chip = $('watchDot')
    if (chip) chip.classList.toggle('on', on)
    if (on) {
      document.body.classList.remove('show-files', 'show-why', 'show-text', 'show-review')
      ;['fileDot', 'whyDot', 'textDot', 'reviewDot'].forEach(function (id) {
        const el = $(id)
        if (el) el.classList.remove('on')
      })
    }
  }

  document.addEventListener('click', function (e) {
    const t = e.target
    if (t.id === 'watchDot') { openWatch(!document.body.classList.contains('show-watch')); return }
    if (t.id === 'watchSave') { save(); return }
    if (t.id === 'watchRun') { runNow(); return }
    if (t.id === 'watchTestMail') { testEmail(); return }
    const row = t.closest('[data-page]')
    if (row && state.data) {
      const page = (state.data.flagged || []).find(function (p) { return p.id === row.getAttribute('data-page') })
      if (!page) return
      $('watchDetail').innerHTML = '<p class="mark">' + esc(String(page.status).replace(/_/g, ' ')) + '</p><h3>' + esc(page.name) + '</h3>' +
        '<a class="listing-link" href="' + esc(page.url) + '" target="_blank" rel="noopener noreferrer">' + esc(page.url) + '</a>' +
        '<p class="tiny">Page ID ' + esc(page.id) + (page.firstKeyword ? ' · keyword “' + esc(page.firstKeyword) + '”' : '') + ' · discovered ' + esc(when(page.firstSeenAt)) + '</p>' +
        '<p class="tiny">' + esc(page.description || 'No description returned.') + '</p>' +
        '<p class="why-line">' + esc(page.reason) + '</p>' +
        '<p class="tiny">Flagged for review only. A matching name is not proof of a scam.</p>'
    }
  })

  window.AarWatch = { load: load, snapshot: function () { return state.data } }
  load()
})()
