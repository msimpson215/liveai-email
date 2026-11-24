(function () {
  const ANSWERS = [
    { id: 'mine', label: 'Mine' },
    { id: 'not_mine', label: 'Not mine' },
    { id: 'mine_wrong', label: 'Mine, but details are wrong' },
    { id: 'unsure', label: 'Unsure' }
  ]
  const KEY_STORE = 'aar-review-key'
  const LOCAL_KEY = 'aar-review-v2'

  const params = new URLSearchParams(location.search)
  const urlKey = params.get('k')
  if (urlKey) {
    try { localStorage.setItem(KEY_STORE, urlKey) } catch (e) {}
    params.delete('k')
    const rest = params.toString()
    history.replaceState(null, '', location.pathname + (rest ? '?' + rest : '') + location.hash)
  }
  let key = urlKey || ''
  try { key = key || localStorage.getItem(KEY_STORE) || '' } catch (e) {}

  const state = { data: null, role: null, index: 0, shot: 0, pending: null, notice: '' }

  function $(id) { return document.getElementById(id) }
  function listings() { return (state.data && state.data.listings) || [] }
  function current() { return listings()[state.index] || null }
  function desk() { return state.role === 'marty' }

  function esc(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  }

  function answerLabel(id) {
    const row = ANSWERS.find(function (a) { return a.id === id })
    return row ? row.label : 'No decision yet'
  }

  function readLocal() {
    try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || '{}') } catch (e) { return {} }
  }

  function writeLocal() {
    if (!state.data) return
    const saved = {}
    state.data.listings.forEach(function (item) {
      if (item.decision) saved[item.id] = item.decision
    })
    try { localStorage.setItem(LOCAL_KEY, JSON.stringify(saved)) } catch (e) {}
  }

  async function api(path, body) {
    const opts = { cache: 'no-store', headers: { 'x-aar-key': key } }
    if (body !== undefined) {
      opts.method = 'POST'
      opts.headers['Content-Type'] = 'application/json'
      opts.body = JSON.stringify(body)
    }
    const r = await fetch(path, opts)
    const d = await r.json().catch(function () { return {} })
    if (r.status === 401) d.unauthorized = true
    return d
  }

  /** The server forgets on restart; send back anything this browser saved later. */
  async function resync() {
    const saved = readLocal()
    for (const item of listings()) {
      const mine = saved[item.id]
      if (!mine) continue
      const serverAt = item.decision ? Date.parse(item.decision.at) : 0
      if (Date.parse(mine.at) <= serverAt) continue
      const d = await api('/api/aar/review/decision', { id: item.id, answer: mine.answer, via: mine.via, raw: mine.raw, syncAt: mine.at })
      if (d.listing) replaceListing(d.listing)
    }
  }

  async function load() {
    if (!key) return
    const d = await api('/api/aar/review').catch(function () { return {} })
    if (!d || d.unauthorized || !d.listings) {
      if (d && d.unauthorized) { try { localStorage.removeItem(KEY_STORE) } catch (e) {} }
      return
    }
    state.data = d
    state.role = d.role
    document.body.classList.add('can-review')
    document.body.classList.toggle('desk', desk())
    await resync()
    writeLocal()
    if (desk()) openReview(true)
    render()
  }

  function openReview(on) {
    if (!state.data) return
    document.body.classList.toggle('show-review', on)
    const chip = $('reviewDot')
    if (chip) chip.classList.toggle('on', on)
    if (on) {
      document.body.classList.remove('show-files', 'show-why', 'show-text')
      ;['fileDot', 'whyDot', 'textDot'].forEach(function (id) {
        const el = $(id)
        if (el) el.classList.remove('on')
      })
      cueListing()
    }
  }

  function cueListing() {
    const item = current()
    if (item && typeof window.aarCueReview === 'function') window.aarCueReview(item)
  }

  function go(i) {
    state.index = Math.max(0, Math.min(listings().length - 1, i))
    state.shot = 0
    state.pending = null
    state.notice = ''
    render()
    cueListing()
  }

  function replaceListing(listing) {
    const i = listings().findIndex(function (row) { return row.id === listing.id })
    if (i >= 0) state.data.listings[i] = listing
  }

  function shotSrc(shot) {
    if (!shot || !shot.src) return ''
    return shot.needsKey ? shot.src + '?k=' + encodeURIComponent(key) : shot.src
  }

  function render() {
    if (!state.data) return
    const item = current()
    $('reviewIntro').textContent = state.data.intro || ''
    $('reviewMeta').innerHTML =
      '<span>Reviewing as ' + (desk() ? 'Marty' : 'Randy') + '</span>' +
      '<span>Daily monitoring: not running yet</span>' +
      '<span>Email: not connected</span>'
    $('reviewQueue').innerHTML = desk() ? listings().map(function (row, i) {
      const cls = [i === state.index ? 'on' : '', row.decision ? 'done' : '', row.confirmedUnauthorized ? 'bad' : ''].filter(Boolean).join(' ')
      return '<button type="button" class="qitem ' + cls + '" data-jump="' + i + '">' +
        '<em>' + esc(row.mark) + '</em>' + esc(row.name) +
        '<small>' + esc(row.decision ? answerLabel(row.decision.answer) + ' · ' + row.decision.by : 'Waiting') +
        ' · Report ' + esc(row.report.status) + '</small></button>'
    }).join('') : ''
    if (!item) { $('reviewCard').innerHTML = '<p>No listings loaded.</p>'; return }

    const shots = item.screenshots || []
    const shot = shots[state.shot] || shots[0]
    let linkHtml
    if (item.showDomainPlain) linkHtml = '<p class="domain">' + esc(item.name) + '</p>'
    else if (item.url) linkHtml = '<a class="listing-link" href="' + esc(item.url) + '" target="_blank" rel="noopener noreferrer">' + esc(item.displayUrl || item.url) + '</a>'
    else linkHtml = '<p class="nolink">No direct link recovered yet.</p>'
    const copy = item.copyUrl ? '<button type="button" class="ghost" id="copyUrl">Copy URL</button>' : ''
    const shotHtml = shot && shot.src
      ? '<button type="button" class="shot" id="openShot" aria-label="Enlarge screenshot"><img src="' + esc(shotSrc(shot)) + '" alt="' + esc(shot.title) + '"></button>' +
        '<p class="tiny">' + (shot.placeholder ? 'Summary card. Original screenshot not imported yet.' : esc(shot.title)) +
        (shots.length > 1 ? ' · ' + (state.shot + 1) + ' of ' + shots.length + ' · <button type="button" class="linkish" id="nextShot">Next capture</button>' : '') + '</p>'
      : ''
    const verified = item.lastVerified && item.lastVerified.status !== 'unknown'
      ? '<p class="tiny">Last verified: ' + esc(item.lastVerified.status) + ' on ' + esc(String(item.lastVerified.at).slice(0, 10)) + '</p>'
      : ''
    const saved = item.decision
      ? '<p class="saved">Saved: ' + esc(answerLabel(item.decision.answer)) + ' (by ' + esc(item.decision.by) + ', ' + esc(item.decision.via) + '). Tap another answer to change it.</p>'
      : ''
    $('reviewCard').innerHTML =
      '<p class="mark">' + esc(item.mark) + '</p>' +
      '<h3>' + esc(item.name) + '</h3>' +
      linkHtml + copy + shotHtml +
      '<p class="why-line">' + esc(item.why) + '</p>' +
      '<p class="next"><strong>Next:</strong> ' + esc(item.nextAction) + '</p>' +
      (item.confirmedUnauthorized ? '<p class="flag">Confirmed unauthorized</p>' : '') +
      saved + verified +
      (state.notice ? '<p class="tiny">' + esc(state.notice) + '</p>' : '') +
      '<p class="ask">Is this yours?</p>' +
      '<div class="choices">' + ANSWERS.map(function (a) {
        const on = item.decision && item.decision.answer === a.id ? ' on' : ''
        return '<button type="button" class="choice' + on + '" data-answer="' + a.id + '">' + a.label + '</button>'
      }).join('') + '</div>'

    const confirm = $('reviewConfirm')
    if (state.pending) {
      confirm.hidden = false
      confirm.innerHTML = '<p>I heard “' + esc(state.pending.text) + '.” Which one do you mean?</p><div class="choices">' +
        ANSWERS.map(function (a) {
          const hint = state.pending.guess === a.id ? ' on' : ''
          return '<button type="button" class="choice' + hint + '" data-confirm="' + a.id + '">' + a.label + '</button>'
        }).join('') + '<button type="button" class="ghost" data-cancel="1">Cancel</button></div>'
    } else {
      confirm.hidden = true
      confirm.innerHTML = ''
    }
    $('reviewPos').textContent = (state.index + 1) + ' of ' + listings().length
    renderAuth()
    if (desk()) renderDesk(item)
    else $('reviewDesk').innerHTML = ''
  }

  function renderAuth() {
    const el = $('reviewAuth')
    const auth = state.data.trademarkAuth || {}
    if (auth.authorized) {
      el.innerHTML = '<p class="tiny">Trademark authorization recorded ' + esc(String(auth.at).slice(0, 10)) + '. ' + esc(auth.how || '') + '</p>'
      return
    }
    el.innerHTML = desk()
      ? '<p class="tiny">Trademark authorization: not recorded yet. Randy can tap it on his link, or record how he gave it below.</p>'
      : '<p class="tiny">' + esc(auth.statement) + '</p><button type="button" class="ghost" id="randyAuth">I authorize Marty to file these for me</button>'
  }

  function renderDesk(item) {
    const report = item.report || {}
    const data = state.data
    const routes = (data.routes || []).map(function (r) {
      return '<option value="' + r.id + '"' + (report.route === r.id ? ' selected' : '') + '>' + esc(r.label) + '</option>'
    }).join('')
    const statuses = ['Draft', 'Ready', 'Submitted', 'Resolved'].map(function (s) {
      return '<option' + (report.status === s ? ' selected' : '') + '>' + s + '</option>'
    }).join('')
    const verifiedNow = (item.lastVerified && item.lastVerified.status) || 'unknown'
    const shots = (item.screenshots || []).map(function (s) {
      return '<option value="' + esc(s.id) + '">' + esc(s.title) + (s.placeholder ? ' (summary card)' : ' (imported)') + '</option>'
    }).join('')
    $('reviewDesk').innerHTML =
      '<h3>Marty’s desk</h3>' +
      (data.trademarkAuth.authorized ? '' :
        '<label>How Randy authorized trademark filing</label><input id="authHow" placeholder="Example: email from Randy, Nov 25">' +
        '<button type="button" class="ghost" id="martyAuth">Record Randy’s authorization</button>') +
      '<label>Report route</label><select id="repRoute">' + routes + '</select>' +
      '<label>Report status</label><select id="repStatus">' + statuses + '</select>' +
      '<label class="check"><input type="checkbox" id="repAccepted"' + (report.platformAccepted ? ' checked' : '') + '> The platform accepted this report</label>' +
      '<label>Case number</label><input id="repCase" value="' + esc(report.caseNumber || '') + '">' +
      '<label>Outcome</label><input id="repOutcome" value="' + esc(report.outcome || '') + '">' +
      '<label>Ready-to-submit draft</label><textarea id="repDraft" rows="9">' + esc(report.draft || '') + '</textarea>' +
      '<div class="desk-actions">' +
        '<button type="button" class="ghost" id="saveReport">Save report</button>' +
        '<button type="button" class="ghost" id="copyDraft">Copy draft</button>' +
        (item.copyUrl || item.url ? '<button type="button" class="ghost" id="copyUrlDesk">Copy URL</button>' : '') +
      '</div>' +
      '<label>Last verified</label><div class="desk-actions"><select id="verifiedStatus">' +
        ['unknown', 'online', 'offline'].map(function (s) { return '<option' + (verifiedNow === s ? ' selected' : '') + '>' + s + '</option>' }).join('') +
      '</select><button type="button" class="ghost" id="saveVerified">Save status</button></div>' +
      (shots ? '<label>Import the real screenshot</label><div class="desk-actions"><select id="shotPick">' + shots + '</select>' +
        '<input type="file" id="shotFile" accept="image/png,image/jpeg,image/webp"><button type="button" class="ghost" id="saveShot">Upload</button></div>' +
        '<p class="tiny">Crop out browser tabs, account details, and home photos before uploading.</p>' : '') +
      '<p class="tiny">' + esc(data.metaSubmission.note) + '</p>' +
      '<p class="tiny">Monitoring: ' + esc(data.monitoring.note) + ' ' + esc(data.monitoring.paidScanner.note) + '</p>' +
      '<p class="tiny">Email: ' + esc(data.email.note) + '</p>' +
      '<p class="tiny">Storage: ' + esc(data.storage.note) + '</p>'
  }

  async function saveAnswer(answer, via, raw) {
    const item = current()
    if (!item) return
    const d = await api('/api/aar/review/decision', { id: item.id, answer: answer, via: via, raw: raw || '' }).catch(function () { return {} })
    if (d.ignored) return
    if (d.needsConfirm) {
      state.pending = { text: d.text, guess: d.guess }
      render()
      return
    }
    if (!d.listing) {
      state.notice = d.error || 'Could not save just now. Try again.'
      render()
      return
    }
    state.pending = null
    state.notice = ''
    replaceListing(d.listing)
    writeLocal()
    render()
    if (typeof window.aarRememberDecision === 'function') window.aarRememberDecision(d.listing)
  }

  function onUserSpeech(text) {
    if (!state.data || !document.body.classList.contains('show-review')) return
    saveAnswer(null, 'voice', text)
  }

  function copyText(value) {
    if (!value) return
    if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(value); return }
    const ta = document.createElement('textarea')
    ta.value = value
    document.body.appendChild(ta)
    ta.select()
    try { document.execCommand('copy') } catch (e) {}
    ta.remove()
  }

  async function exportSummary() {
    const r = await fetch('/api/aar/review/export', { cache: 'no-store', headers: { 'x-aar-key': key } })
    if (!r.ok) return
    const blob = new Blob([await r.text()], { type: 'text/html' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'aar-impersonation-review-' + new Date().toISOString().slice(0, 10) + '.html'
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(function () { URL.revokeObjectURL(a.href) }, 5000)
  }

  async function deskAction(id) {
    const item = current()
    if (id === 'saveReport') {
      const d = await api('/api/aar/review/report', {
        id: item.id,
        route: $('repRoute').value,
        status: $('repStatus').value,
        platformAccepted: $('repAccepted').checked,
        caseNumber: $('repCase').value,
        outcome: $('repOutcome').value,
        draft: $('repDraft').value
      })
      state.notice = d.error || 'Report saved.'
      if (d.listing) replaceListing(d.listing)
      render()
    } else if (id === 'saveVerified') {
      const d = await api('/api/aar/review/verified', { id: item.id, status: $('verifiedStatus').value })
      if (d.listing) replaceListing(d.listing)
      render()
    } else if (id === 'martyAuth' || id === 'randyAuth') {
      const d = await api('/api/aar/review/authorize', { authorized: true, how: id === 'martyAuth' ? $('authHow').value : '' })
      state.notice = d.error || ''
      if (d.trademarkAuth) state.data.trademarkAuth = d.trademarkAuth
      render()
    } else if (id === 'saveShot') {
      const file = $('shotFile').files[0]
      if (!file) return
      const body = new FormData()
      body.append('shotId', $('shotPick').value)
      body.append('file', file)
      const r = await fetch('/api/aar/review/shot', { method: 'POST', headers: { 'x-aar-key': key }, body: body })
      const d = await r.json().catch(function () { return {} })
      state.notice = d.error || 'Screenshot imported.'
      const fresh = await api('/api/aar/review')
      if (fresh.listings) state.data = fresh
      render()
    }
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && $('shotBox')) $('shotBox').hidden = true
  })

  document.addEventListener('click', function (e) {
    if (!state.data) return
    const t = e.target
    const jump = t.closest('[data-jump]')
    if (jump) { go(Number(jump.getAttribute('data-jump'))); return }
    const choice = t.closest('#reviewCard [data-answer]')
    if (choice) { saveAnswer(choice.getAttribute('data-answer'), 'button', ''); return }
    const confirmed = t.closest('[data-confirm]')
    if (confirmed) { saveAnswer(confirmed.getAttribute('data-confirm'), 'voice', state.pending ? state.pending.text : ''); return }
    if (t.closest('[data-cancel]')) { state.pending = null; render(); return }
    if (t.closest('#openShot')) {
      const shot = (current().screenshots || [])[state.shot]
      if (shot && shot.src) {
        const box = $('shotBox')
        box.querySelector('img').src = shotSrc(shot)
        box.querySelector('img').alt = shot.title
        box.hidden = false
      }
      return
    }
    const id = t.id
    if (id === 'copyUrl' || id === 'copyUrlDesk') { const it = current(); copyText(it.copyUrl || it.url); return }
    if (id === 'copyDraft') { copyText($('repDraft').value); return }
    if (id === 'nextShot') { state.shot = (state.shot + 1) % current().screenshots.length; render(); return }
    if (id === 'prevItem') { go(state.index - 1); return }
    if (id === 'nextItem') { go(state.index + 1); return }
    if (id === 'exportReview') { exportSummary(); return }
    if (['saveReport', 'saveVerified', 'martyAuth', 'randyAuth', 'saveShot'].indexOf(id) >= 0) deskAction(id)
  })

  window.AarReview = {
    load: load,
    toggle: function () { openReview(!document.body.classList.contains('show-review')) },
    isOpen: function () { return !!state.data && document.body.classList.contains('show-review') },
    onUserSpeech: onUserSpeech,
    current: current,
    key: function () { return key }
  }
})()
