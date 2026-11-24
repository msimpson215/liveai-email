import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aar-review-'))
process.env.AAR_REVIEW_DIR = tmp
process.env.AAR_REVIEW_KEY_RANDY = 'test-randy'
process.env.AAR_REVIEW_KEY_MARTY = 'test-marty'

const {
  SEED_LISTINGS,
  roleForKey,
  snapshot,
  saveDecision,
  saveReport,
  saveAuthorization,
  classifyAnswer,
  exportHtml,
  voicePromptFor
} = await import('../server/aar-review.js')

try {
  assert.equal(roleForKey('test-randy'), 'randy')
  assert.equal(roleForKey('test-marty'), 'marty')
  assert.equal(roleForKey(''), null)
  assert.equal(roleForKey('guess'), null)

  const fb = SEED_LISTINGS.filter(item => item.reportPlatform === 'facebook')
  assert.equal(fb.length, 2)
  assert.notEqual(fb[0].id, fb[1].id)
  assert.equal(SEED_LISTINGS.find(item => item.id === 'fb-aar-auto-sales-byars-ok').url, null)
  const truck = SEED_LISTINGS.find(item => item.id === 'evidence-truck')
  assert.equal(truck.url, null)
  assert.deepEqual(truck.phones, [])
  assert.equal(SEED_LISTINGS.filter(item => item.showDomainPlain).every(item => !item.url && item.copyUrl), true)

  assert.deepEqual(classifyAnswer('that is not mine'), { answer: 'not_mine', sure: true })
  assert.deepEqual(classifyAnswer('mine but the phone is wrong'), { answer: 'mine_wrong', sure: true })
  assert.deepEqual(classifyAnswer('no'), { answer: 'not_mine', sure: false })
  assert.equal(classifyAnswer('that looks fake to me'), null)
  assert.equal(classifyAnswer('maybe later we should look'), null)

  const button = saveDecision('fb-aar-auto-sale-byars', { answer: 'not_mine', via: 'button', by: 'marty' }, 'randy')
  assert.equal(button.listing.decision.by, 'randy')
  const voice = saveDecision('fb-aar-auto-sales-byars-ok', { via: 'voice', raw: "that's not mine" }, 'randy')
  assert.equal(voice.listing.decision.answer, button.listing.decision.answer)
  assert.equal(voice.listing.decision.via, 'voice')
  assert.equal(voice.listing.confirmedUnauthorized, true)

  assert.equal(saveDecision('velora-motors', { via: 'voice', raw: 'no' }, 'randy').needsConfirm, true)
  assert.equal(saveDecision('velora-motors', { via: 'voice', raw: 'kind of familiar' }, 'randy').ignored, true)
  assert.equal(saveDecision('official-aarsales', { answer: 'not_mine' }, 'randy').listing.confirmedUnauthorized, false)

  const reloaded = snapshot('randy').listings.find(item => item.id === 'fb-aar-auto-sale-byars')
  assert.equal(reloaded.decision.answer, 'not_mine')

  const older = saveDecision('fb-aar-auto-sale-byars', { answer: 'mine', syncAt: '2020-01-01T00:00:00.000Z' }, 'randy')
  assert.equal(older.stale, true)
  assert.equal(older.listing.decision.answer, 'not_mine')

  assert.match(saveReport('fb-aar-auto-sale-byars', { status: 'Ready' }, 'randy').error, /Marty/)
  assert.match(saveReport('fb-aar-auto-sale-byars', { status: 'Submitted', platformAccepted: false }, 'marty').error, /accepted/)
  assert.match(saveReport('fb-aar-auto-sales-byars-ok', { status: 'Ready' }, 'marty').error, /URL/)
  assert.match(saveReport('fb-aar-auto-sale-byars', { status: 'Ready', route: 'trademark' }, 'marty').error, /authorization/)
  assert.match(saveAuthorization({ authorized: true }, 'marty').error, /how/)
  assert.equal(saveAuthorization({ authorized: true }, 'randy').trademarkAuth.recordedBy, 'randy')
  const ready = saveReport('fb-aar-auto-sale-byars', { status: 'Ready', route: 'trademark' }, 'marty')
  assert.equal(ready.listing.report.status, 'Ready')
  assert.match(ready.listing.report.draft, /8102075/)
  const sent = saveReport('fb-aar-auto-sale-byars', { status: 'Submitted', platformAccepted: true, caseNumber: '123' }, 'marty')
  assert.equal(sent.listing.report.status, 'Submitted')

  const data = snapshot('marty')
  assert.equal(data.monitoring.active, false)
  assert.equal(data.email.connected, false)
  assert.equal(new Set(data.listings.map(item => item.report.key)).size, data.listings.length)

  const html = exportHtml('https://example.test')
  assert.match(html, /Facebook: AAR Auto Sale Byars/)
  assert.match(html, /Facebook: AAR Auto Sales \| Byars OK/)
  assert.doesNotMatch(html, /href="https:\/\/aar-autosales\.com/)
  assert.match(voicePromptFor('velora-motors'), /Velora Motors/)
  assert.equal(voicePromptFor('nope'), null)

  console.log('aar-review tests ok', data.listings.length, 'listings')
} finally {
  fs.rmSync(tmp, { recursive: true, force: true })
}
