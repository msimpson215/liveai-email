(function () {
  const ANSWERS = [
    { id: 'mine', label: 'Mine' },
    { id: 'not_mine', label: 'Not mine' },
    { id: 'mine_wrong', label: 'Mine, but details are wrong' },
    { id: 'unsure', label: 'Unsure' }
  ]
  const LOCAL_KEY = 'aar-review-v1'
  const params = new URLSearchParams(location.search)
  const desk = params.get('desk') === '1' || params.get('op') === '1'

  const state = {
    data: null,
    index: 0,
    actor: desk ? 'marty' : 'randy',
    pending: null,
    shot: 0
  }

  function $(id) { return document.getElementById(id) }
  function listings() { return (state.data && state.data.listings) || [] }
  function current() { return listings()[state.index] || null }

  function localOverlay(data) {
    try {
      const saved = JSON.parse(localStorage.getItem(LOCAL_KEY) || '{}')
      if (!saved.listings) return data
      data.listings.forEach(function (item) {
        const row = saved.listings[item.id]
        if (row && row.decision) {
          item.decision = row.decision
          item.history = row.history || item.history
          item.confirmedUnauthorized = !!row.confirmedUnauthorized
        }
      })
      if (saved.trademarkAuth) data.trademarkAuth = Object.assign({}, data.trademarkAuth, saved.trademarkAuth)
    } catch (e) {}
    return data
  }

  function persistLocal() {
    if (!state.data) return
    const listingsMap = {}
    state.data.listings.forEach(function (item) {
      listingsMap[item.id] = {
        decision: item.decision,
        history: item.history,
        confirmedUnauthorized: item.confirmedUnauthorized
      }
    })
    localStorage.setItem(LOCAL_KEY, JSON.stringify({
      listings: listingsMap,
      trademarkAuth: state.data.trademarkAuth
    }))
  }

  async function load() {
    let data = null
    try {
      const r = await fetch('/api/aar/review', { cache: 'no-store' })
      if (r.ok) data = await r.json()
    } catch (e) {}
    if (!data || !data.listings) {
      data = { intro: '', listings: [], trademarkAuth: {}, monitoring: { active: false }, email: { connected: false }, metaSubmission: {}, links: {} }
    }
    state.data = localOverlay(data)
    if (desk) openReview(true)
    render()
  }

  function openReview(on) {
    document.body.classList.toggle('show-review', on)
    document.body.classList.toggle('desk', desk)
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

  function toggleReview() {
    openReview(!document.body.classList.contains('show-review'))
  }

  function cueListing() {
    const item = current()
    if (!item || typeof window.aarCueReview !== 'function') return
    window.aarCueReview(item)
  }

  function answerLabel(id) {
    const row = ANSWERS.find(function (a) { return a.id === id })
    return row ? row.label : 'No decision yet'
  }

  function render() {
    if (!state.data) return
    const item = current()
    const intro = $('reviewIntro')
    const meta = $('reviewMeta')
    const card = $('reviewCard')
    const queue = $('reviewQueue')
    const confirm = $('reviewConfirm')
    const deskPane = $('reviewDesk')
    if (intro) intro.textContent = state.data.intro || ''
    if (meta) {
      const mon = state.data.monitoring && state.data.monitoring.active ? 'active' : 'inactive'
      const mail = state.data.email && state.data.email.connected ? 'connected' : 'unconnected'
      meta.innerHTML =
        '<span>Daily monitoring: ' + mon + '</span>' +
        '<span>Email operator: ' + mail + '</span>' +
        '<span>Recording as ' +
        '<button type="button" class="mini' + (state.actor === 'randy' ? ' on' : '') + '" data-actor="randy">Randy</button> ' +
        '<button type="button" class="mini' + (state.actor === 'marty' ? ' on' : '') + '" data-actor="marty">Marty</button></span>'
    }
    if (!item) {
      if (card) card.innerHTML = '<p>No listings loaded.</p>'
      return
    }
    if (queue) {
      queue.innerHTML = listings().map(function (row, i) {
        const cls = [
          i === state.index ? 'on' : '',
          row.decision ? 'done' : '',
          row.confirmedUnauthorized ? 'bad' : ''
        ].filter(Boolean).join(' ')
        return '<button type="button" class="qitem ' + cls + '" data-jump="' + i + '">' +
          '<em>' + esc(row.mark) + '</em>' + esc(row.name) +
          (row.decision ? '<small>' + esc(answerLabel(row.decision.answer)) + '</small>' : '') +
          '</button>'
      }).join('')
    }
    const shot = (item.screenshots || [])[state.shot] || (item.screenshots || [])[0]
    const moreShots = (item.screenshots || []).length > 1
    const linkHtml = item.url
      ? '<a class="listing-link" href="' + esc(item.url) + '" target="_blank" rel="noopener">' + esc(item.displayUrl || item.url) + '</a>'
      : (item.showDomainPlain
        ? '<p class="domain">' + esc(item.name) + '</p>'
        : '<p class="nolink">No direct link recovered.</p>')
    const copy = item.copyUrl
      ? '<button type="button" class="ghost" id="copyUrl">Copy URL</button>'
      : ''
    const verified = item.lastVerified && item.lastVerified.status !== 'unknown'
      ? '<p class="tiny">Last verified: ' + esc(item.lastVerified.status) + (item.lastVerified.at ? ' · ' + esc(item.lastVerified.at.slice(0, 10)) : '') + '</p>'
      : ''
    const decision = item.decision
      ? '<p class="saved">Saved: ' + esc(answerLabel(item.decision.answer)) + ' · ' + esc(item.decision.by) + ' · ' + esc(item.decision.via) + '</p>'
      : ''
    const unauth = item.confirmedUnauthorized ? '<p class="flag">Confirmed unauthorized</p>' : ''
    card.innerHTML =
      '<p class="mark">' + esc(item.mark) + '</p>' +
      '<h3>' + esc(item.name) + '</h3>' +
      linkHtml + copy +
      (shot ? '<button type="button" class="shot" id="openShot" aria-label="Enlarge screenshot"><img src="' + esc(shot.src) + '" alt="' + esc(shot.title) + '"></button>' +
        (moreShots ? '<p class="tiny">Screenshot ' + (state.shot + 1) + ' of ' + item.screenshots.length + ' · <button type="button" class="linkish" id="nextShot">Next capture</button></p>' : '')
        : '') +
      '<p class="why-line">' + esc(item.why) + '</p>' +
      '<p class="next"><strong>Next:</strong> ' + esc(item.nextAction) + '</p>' +
      unauth + decision + verified +
      '<p class="ask">Is this yours?</p>' +
      '<div class="choices">' + ANSWERS.map(function (a) {
        const on = item.decision && item.decision.answer === a.id ? ' on' : ''
        return '<button type="button" class="choice' + on + '" data-answer="' + a.id + '">' + a.label + '</button>'
      }).join('') + '</div>'
    if (confirm) {
      if (state.pending) {
        confirm.hidden = false
        confirm.innerHTML = '<p>I heard “' + esc(state.pending) + '.” Which did you mean?</p>' +
          ANSWERS.map(function (a) {
            return '<button type="button" class="choice" data-answer="' + a.id + '">' + a.label + '</button>'
          }).join('') +
          '<button type="button" class="ghost" data-cancel="1">Cancel</button>'
      } else {
        confirm.hidden = true
        confirm.innerHTML = ''
      }
    }
    if (deskPane) {
      if (desk) renderDesk(deskPane, item)
      else deskPane.innerHTML = ''
    }
    const pos = $('reviewPos')
    if (pos) pos.textContent = (state.index + 1) + ' of ' + listings().length
  }

  function renderDesk(el, item) {
    const auth = state.data.trademarkAuth || {}
    const report = item.report || {}
    const mon = state.data.monitoring || {}
    const mail = state.data.email || {}
    el.innerHTML =
      '<h3>Marty desk</h3>' +
      '<p class="tiny">Review and report without Randy opening each item. Randy still has to decide ownership unless you are recording his answer.</p>' +
      '<p>Trademark authorization: <strong>' + (auth.authorized ? 'recorded' : 'not recorded') + '</strong></p>' +
      (auth.authorized ? '' : '<button type="button" class="ghost" id="recordAuth">Record Randy’s one-time authorization</button>') +
      '<p class="tiny">' + esc(auth.statement || '') + '</p>' +
      '<label>Report status</label>' +
      '<select id="repStatus">' + ['Draft', 'Ready', 'Submitted', 'Resolved'].map(function (s) {
        return '<option' + (report.status === s ? ' selected' : '') + '>' + s + '</option>'
      }).join('') + '</select>' +
      '<label class="check"><input type="checkbox" id="repAccepted"' + (report.platformAccepted ? ' checked' : '') + '> Platform accepted this report</label>' +
      '<label>Case number</label><input id="repCase" value="' + esc(report.caseNumber || '') + '">' +
      '<label>Outcome</label><input id="repOutcome" value="' + esc(report.outcome || '') + '">' +
      '<label>Draft</label><textarea id="repDraft" rows="8">' + esc(report.draft || '') + '</textarea>' +
      '<div class="desk-actions">' +
        '<button type="button" class="ghost" id="saveReport">Save report</button>' +
        (item.showDomainPlain || item.copyUrl ? '<button type="button" class="ghost" id="copyUrlDesk">Copy URL</button>' : '') +
        '<label>Verified <select id="verifiedStatus">' +
          ['unknown', 'online', 'offline'].map(function (s) {
            const cur = (item.lastVerified && item.lastVerified.status) || 'unknown'
            return '<option' + (cur === s ? ' selected' : '') + '>' + s + '</option>'
          }).join('') +
        '</select></label>' +
        '<button type="button" class="ghost" id="saveVerified">Save status</button>' +
      '</div>' +
      '<p class="tiny">' + esc((state.data.metaSubmission && state.data.metaSubmission.note) || '') + '</p>' +
      '<p class="tiny">Monitoring: inactive. ' + esc(mon.note || '') + '</p>' +
      '<p class="tiny">' + esc((mon.paidScanner && mon.paidScanner.note) || '') + '</p>' +
      '<p class="tiny">Email: unconnected. ' + esc(mail.note || '') + '</p>' +
      '<div class="email-stub"><p>Inbox is not connected yet. When it is, Randy can say “Go through my email. Show me the people who sound serious about buying a car.”</p></div>'
  }

  function classifyLocal(text) {
    const t = String(text || '').toLowerCase().replace(/[’]/g, "'")
    if (/\b(not sure|unsure|don't know|do not know)\b/.test(t)) return 'unsure'
    if (/\b(details are wrong|wrong (number|phone|photo|website|address)|mine but)\b/.test(t)) return 'mine_wrong'
    if (/\b(not mine|isn't mine|is not mine|not ours|that's not mine)\b/.test(t)) return 'not_mine'
    if (/\b(that's mine|that is mine|it's mine|yes that's mine)\b/.test(t)) return 'mine'
    if (/^(yes|yeah|yep|mine)\.?$/.test(t.trim())) return 'mine'
    if (/^(no|nope)\.?$/.test(t.trim())) return 'not_mine'
    return null
  }

  function esc(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  }

  async function post(url, body) {
    const r = await fetch(url, {
      method: 'POST',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    return r.json().catch(function () { return {} })
  }

  function applyListing(listing) {
    if (!listing) return
    const i = listings().findIndex(function (row) { return row.id === listing.id })
    if (i >= 0) state.data.listings[i] = listing
    persistLocal()
    render()
  }

  async function saveAnswer(answer, via, raw, confirmed) {
    const item = current()
    if (!item) return
    const payload = {
      id: item.id,
      answer: answer,
      by: state.actor,
      via: via || 'button',
      raw: raw || '',
      confirmed: confirmed !== false
    }
    let listing = null
    try {
      const d = await post('/api/aar/review/decision', payload)
      if (d.needsConfirm) {
        state.pending = d.text || raw
        render()
        return
      }
      if (d.listing) listing = d.listing
    } catch (e) {}
    const guessed = answer || classifyLocal(raw)
    if (!listing && !guessed) {
      state.pending = raw || ''
      render()
      return
    }
    if (!listing) {
      listing = Object.assign({}, item, {
        decision: {
          answer: guessed,
          by: state.actor,
          at: new Date().toISOString(),
          via: via || 'button',
          confirmed: true,
          raw: raw || ''
        },
        confirmedUnauthorized: guessed === 'not_mine'
      })
    }
    state.pending = null
    applyListing(listing)
    if (typeof window.aarRememberDecision === 'function') window.aarRememberDecision(listing)
  }

  function onUserSpeech(text) {
    if (!document.body.classList.contains('show-review')) return
    const item = current()
    if (!item) return
    saveAnswer(null, 'voice', text, false)
  }

  function copyText(value) {
    if (!value) return
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(value)
    else {
      const ta = document.createElement('textarea')
      ta.value = value
      document.body.appendChild(ta)
      ta.select()
      try { document.execCommand('copy') } catch (e) {}
      ta.remove()
    }
  }

  function openLightbox(src, title) {
    const box = $('shotBox')
    if (!box) return
    box.hidden = false
    box.querySelector('img').src = src
    box.querySelector('img').alt = title || ''
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      const box = $('shotBox')
      if (box) box.hidden = true
    }
  })

  document.addEventListener('click', function (e) {
    const actor = e.target.closest && e.target.closest('[data-actor]')
    if (actor) {
      state.actor = actor.getAttribute('data-actor')
      render()
      return
    }
    const jump = e.target.closest && e.target.closest('[data-jump]')
    if (jump && $('reviewQueue') && $('reviewQueue').contains(jump)) {
      state.index = Number(jump.getAttribute('data-jump'))
      state.shot = 0
      state.pending = null
      render()
      cueListing()
      return
    }
    const choice = e.target.closest && e.target.closest('[data-answer]')
    if (choice && (e.target.closest('#reviewCard') || e.target.closest('#reviewConfirm'))) {
      saveAnswer(choice.getAttribute('data-answer'), state.pending ? 'voice' : 'button', state.pending || '', true)
      return
    }
    if (e.target.closest && e.target.closest('[data-cancel]')) {
      state.pending = null
      render()
      return
    }
    if (e.target.id === 'copyUrl' || e.target.id === 'copyUrlDesk') {
      const item = current()
      copyText(item && (item.copyUrl || item.url))
      return
    }
    if (e.target.id === 'nextShot') {
      const item = current()
      if (item && item.screenshots && item.screenshots.length) {
        state.shot = (state.shot + 1) % item.screenshots.length
        render()
      }
      return
    }
    if (e.target.id === 'openShot' || (e.target.closest && e.target.closest('#openShot'))) {
      const item = current()
      const shot = item && (item.screenshots || [])[state.shot]
      if (shot && shot.src) openLightbox(shot.src, shot.title)
      return
    }
    if (e.target.id === 'prevItem') {
      state.index = Math.max(0, state.index - 1)
      state.shot = 0
      render()
      cueListing()
      return
    }
    if (e.target.id === 'nextItem') {
      state.index = Math.min(listings().length - 1, state.index + 1)
      state.shot = 0
      render()
      cueListing()
      return
    }
    if (e.target.id === 'exportReview') {
      window.open('/api/aar/review/export', '_blank')
      return
    }
    if (e.target.id === 'recordAuth') {
      post('/api/aar/review/authorize', { by: 'randy', authorized: true }).then(function (d) {
        if (d.trademarkAuth) state.data.trademarkAuth = d.trademarkAuth
        persistLocal()
        render()
      })
      return
    }
    if (e.target.id === 'saveReport') {
      const item = current()
      post('/api/aar/review/report', {
        id: item.id,
        status: $('repStatus').value,
        platformAccepted: $('repAccepted').checked,
        caseNumber: $('repCase').value,
        outcome: $('repOutcome').value,
        draft: $('repDraft').value,
        route: item.report && item.report.route
      }).then(function (d) {
        if (d.error) alert(d.error)
        if (d.listing) applyListing(d.listing)
      })
      return
    }
    if (e.target.id === 'saveVerified') {
      const item = current()
      post('/api/aar/review/verified', {
        id: item.id,
        status: $('verifiedStatus').value
      }).then(function (d) {
        if (d.listing) applyListing(d.listing)
      })
    }
  })

  window.AarReview = {
    load: load,
    toggle: toggleReview,
    open: function () { openReview(true) },
    isOpen: function () { return document.body.classList.contains('show-review') },
    onUserSpeech: onUserSpeech,
    current: current,
    isDesk: function () { return desk }
  }
})()
