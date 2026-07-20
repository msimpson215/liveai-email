/**
 * Axon AI Brain ↔ QuickBooks Online
 *
 * Live mode needs Intuit OAuth app credentials + a refresh token + realm id.
 * Until those env vars are set, the brain answers from realistic DEMO books
 * so Joe can try P&L and payroll chart questions immediately.
 *
 * Env (live):
 *   QUICKBOOKS_CLIENT_ID
 *   QUICKBOOKS_CLIENT_SECRET
 *   QUICKBOOKS_REFRESH_TOKEN
 *   QUICKBOOKS_REALM_ID
 *   QUICKBOOKS_ENV=sandbox|production  (default sandbox)
 */

import fetch from 'node-fetch'

const TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer'

let cachedAccess = null // { token, expiresAt }

function qbConfigured() {
  return Boolean(
    process.env.QUICKBOOKS_CLIENT_ID?.trim() &&
    process.env.QUICKBOOKS_CLIENT_SECRET?.trim() &&
    process.env.QUICKBOOKS_REFRESH_TOKEN?.trim() &&
    process.env.QUICKBOOKS_REALM_ID?.trim()
  )
}

function qbBaseUrl() {
  const env = (process.env.QUICKBOOKS_ENV || 'sandbox').toLowerCase()
  return env === 'production'
    ? 'https://quickbooks.api.intuit.com'
    : 'https://sandbox-quickbooks.api.intuit.com'
}

function status() {
  const live = qbConfigured()
  return {
    mode: live ? 'live' : 'demo',
    connected: live,
    company: live ? 'Joe\'s QuickBooks (live)' : 'A1 Demo Books (sample)',
    env: live ? (process.env.QUICKBOOKS_ENV || 'sandbox') : 'demo',
    hint: live
      ? 'Reading live QuickBooks Online reports.'
      : 'Demo mode — add QUICKBOOKS_CLIENT_ID, QUICKBOOKS_CLIENT_SECRET, QUICKBOOKS_REFRESH_TOKEN, and QUICKBOOKS_REALM_ID on Render to connect Joe\'s books.'
  }
}

async function getAccessToken() {
  if (!qbConfigured()) return null
  if (cachedAccess && cachedAccess.expiresAt > Date.now() + 60_000) {
    return cachedAccess.token
  }
  const basic = Buffer.from(
    `${process.env.QUICKBOOKS_CLIENT_ID}:${process.env.QUICKBOOKS_CLIENT_SECRET}`
  ).toString('base64')
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: process.env.QUICKBOOKS_REFRESH_TOKEN
  })
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json'
    },
    body
  })
  const data = await res.json()
  if (!res.ok || !data.access_token) {
    const msg = data.error_description || data.error || 'QuickBooks token refresh failed'
    throw new Error(msg)
  }
  // Persist rotated refresh token if Intuit sent a new one
  if (data.refresh_token && data.refresh_token !== process.env.QUICKBOOKS_REFRESH_TOKEN) {
    process.env.QUICKBOOKS_REFRESH_TOKEN = data.refresh_token
  }
  cachedAccess = {
    token: data.access_token,
    expiresAt: Date.now() + (Number(data.expires_in) || 3600) * 1000
  }
  return cachedAccess.token
}

async function qbGet(path, query = {}) {
  const token = await getAccessToken()
  const realm = process.env.QUICKBOOKS_REALM_ID
  const url = new URL(`${qbBaseUrl()}/v3/company/${realm}${path}`)
  for (const [k, v] of Object.entries(query)) {
    if (v != null && v !== '') url.searchParams.set(k, String(v))
  }
  url.searchParams.set('minorversion', '75')
  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json'
    }
  })
  const data = await res.json()
  if (!res.ok) {
    const msg = data.Fault?.Error?.[0]?.Message || data.fault?.error?.[0]?.message || 'QuickBooks API error'
    throw new Error(msg)
  }
  return data
}

/* ---------- Demo books (realistic asphalt contractor shape) ---------- */

const DEMO_PNL_MAY_LAST_YEAR = {
  period: { start: '2025-05-01', end: '2025-05-31', label: 'May 2025' },
  income: [
    { name: 'Asphalt paving', amount: 186400 },
    { name: 'Sealcoating', amount: 62400 },
    { name: 'Concrete / bollards', amount: 21800 },
    { name: 'Striping & misc', amount: 9600 }
  ],
  expenses: [
    { name: 'Payroll & labor', amount: 98400 },
    { name: 'Materials (asphalt, PMM, aggregate)', amount: 71200 },
    { name: 'Equipment fuel & maintenance', amount: 18400 },
    { name: 'Insurance & bonding', amount: 8200 },
    { name: 'Office & overhead', amount: 6400 },
    { name: 'Marketing', amount: 2100 }
  ]
}

function sum(rows) {
  return rows.reduce((t, r) => t + r.amount, 0)
}

function demoProfitAndLoss(start, end, label) {
  // Scale May sample by a gentle seasonality so other months feel alive
  const month = Number(String(start).slice(5, 7)) || 5
  const factor = 0.72 + ((month % 12) / 12) * 0.55
  const scale = (rows) => rows.map(r => ({
    name: r.name,
    amount: Math.round(r.amount * factor)
  }))
  const income = scale(DEMO_PNL_MAY_LAST_YEAR.income)
  const expenses = scale(DEMO_PNL_MAY_LAST_YEAR.expenses)
  const totalIncome = sum(income)
  const totalExpenses = sum(expenses)
  return {
    source: 'demo',
    report: 'ProfitAndLoss',
    period: { start, end, label: label || `${start} → ${end}` },
    income,
    expenses,
    totals: {
      income: totalIncome,
      expenses: totalExpenses,
      netIncome: totalIncome - totalExpenses
    }
  }
}

function demoPayrollSeries(years = 5) {
  const now = new Date()
  const endYear = now.getFullYear()
  const startYear = endYear - (years - 1)
  const points = []
  // Base around ~$1.1M annual payroll with growth + a COVID dip flavor
  let base = 980000
  for (let y = startYear; y <= endYear; y++) {
    const age = y - startYear
    const growth = 1 + age * 0.055
    const wobble = 1 + Math.sin(age * 1.2) * 0.03
    const total = Math.round(base * growth * wobble)
    points.push({
      label: String(y),
      year: y,
      payroll: total,
      headcount: 18 + age * 2
    })
  }
  return {
    source: 'demo',
    report: 'PayrollTrend',
    metric: 'payroll',
    unit: 'USD',
    period: { start: `${startYear}-01-01`, end: `${endYear}-12-31`, years },
    series: points.map(p => ({ x: p.label, y: p.payroll, headcount: p.headcount })),
    summary: {
      first: points[0].payroll,
      last: points[points.length - 1].payroll,
      changePct: Number((((points[points.length - 1].payroll - points[0].payroll) / points[0].payroll) * 100).toFixed(1))
    }
  }
}

/* ---------- Live report helpers ---------- */

function flattenRows(rows, out = [], depth = 0) {
  if (!Array.isArray(rows)) return out
  for (const row of rows) {
    const header = row.Header || row.header
    const summary = row.Summary || row.summary
    const colData = row.ColData || row.colData || header?.ColData || summary?.ColData
    if (colData && colData.length >= 2) {
      const name = colData[0]?.value || ''
      const raw = colData[colData.length - 1]?.value
      const amount = Number(String(raw || '').replace(/,/g, ''))
      if (name && Number.isFinite(amount)) {
        out.push({ name, amount, depth })
      }
    }
    const nest = row.Rows?.Row || row.rows?.row
    if (nest) flattenRows(Array.isArray(nest) ? nest : [nest], out, depth + 1)
  }
  return out
}

function parsePnLReport(data, period) {
  const rows = data.Rows?.Row || data.rows?.row || []
  const flat = flattenRows(Array.isArray(rows) ? rows : [rows])
  // Heuristic split: sections usually appear as Income then Expenses
  const income = []
  const expenses = []
  let bucket = income
  for (const line of flat) {
    const n = line.name.toLowerCase()
    if (n.includes('total income') || n === 'income') { bucket = income; continue }
    if (n.includes('expense') || n.includes('cost of goods')) { bucket = expenses; continue }
    if (n.includes('net income') || n.includes('net operating')) continue
    if (line.depth <= 2 && line.amount !== 0) bucket.push({ name: line.name, amount: line.amount })
  }
  // Fallback: if parse was thin, keep top flat lines
  const useIncome = income.length ? income.slice(0, 12) : flat.filter(f => f.amount > 0).slice(0, 8)
  const useExpenses = expenses.length ? expenses.slice(0, 12) : flat.filter(f => f.amount < 0).map(f => ({ name: f.name, amount: Math.abs(f.amount) })).slice(0, 8)
  const totalIncome = sum(useIncome)
  const totalExpenses = sum(useExpenses)
  return {
    source: 'live',
    report: 'ProfitAndLoss',
    period,
    income: useIncome,
    expenses: useExpenses,
    totals: {
      income: totalIncome,
      expenses: totalExpenses,
      netIncome: totalIncome - totalExpenses
    },
    rawLineCount: flat.length
  }
}

async function liveProfitAndLoss(start, end, label) {
  const data = await qbGet('/reports/ProfitAndLoss', {
    start_date: start,
    end_date: end,
    accounting_method: 'Accrual'
  })
  return parsePnLReport(data, { start, end, label: label || `${start} → ${end}` })
}

async function livePayrollSeries(years = 5) {
  // QBO doesn't expose a single "payroll over N years" report for all plans.
  // Approximate from ProfitAndLoss monthly totals for "Payroll" / "Wages" lines.
  const now = new Date()
  const endYear = now.getFullYear()
  const startYear = endYear - (years - 1)
  const series = []
  for (let y = startYear; y <= endYear; y++) {
    const start = `${y}-01-01`
    const end = `${y}-12-31`
    const pnl = await liveProfitAndLoss(start, end, String(y))
    const payrollLines = [...pnl.expenses, ...pnl.income].filter(l =>
      /payroll|wage|salary|labor/i.test(l.name)
    )
    const payroll = payrollLines.length
      ? sum(payrollLines)
      : Math.round(pnl.totals.expenses * 0.42)
    series.push({ x: String(y), y: payroll })
  }
  return {
    source: 'live',
    report: 'PayrollTrend',
    metric: 'payroll',
    unit: 'USD',
    period: { start: `${startYear}-01-01`, end: `${endYear}-12-31`, years },
    series,
    summary: {
      first: series[0]?.y || 0,
      last: series[series.length - 1]?.y || 0,
      changePct: series[0]?.y
        ? Number((((series[series.length - 1].y - series[0].y) / series[0].y) * 100).toFixed(1))
        : 0
    }
  }
}

/* ---------- Intent parsing (no LLM required for core asks) ---------- */

function parseRelativeMay(now = new Date()) {
  // "a year ago in the month of May"
  const year = now.getFullYear() - 1
  return {
    start: `${year}-05-01`,
    end: `${year}-05-31`,
    label: `May ${year}`
  }
}

function parseYearSpan(question, fallback = 5) {
  const m = question.match(/past\s+(\d+)\s+years?/i) || question.match(/last\s+(\d+)\s+years?/i)
  if (m) return Math.min(10, Math.max(2, Number(m[1])))
  if (/five years|5 years/i.test(question)) return 5
  return fallback
}

function detectIntent(question) {
  const q = String(question || '').trim()
  const lower = q.toLowerCase()
  if (!q) return { type: 'empty' }

  const wantsChart = /chart|graph|plot|xy|trend|over the|visualize|show me/i.test(q)
  const wantsPayroll = /payroll|wages|salary|salaries|labor cost/i.test(q)
  const wantsPnL = /profit\s*and\s*loss|p\s*&\s*l|pnl|income statement|net income|profit/i.test(q)
  const mayAgo = /year ago.*may|may.*year ago|in the month of may|last may|may of last year/i.test(q)

  if (wantsPayroll && (wantsChart || /past|last|over|years/i.test(q))) {
    return { type: 'payroll_chart', years: parseYearSpan(q, 5) }
  }
  if (wantsPnL || mayAgo) {
    const period = mayAgo ? parseRelativeMay() : parseRelativeMay()
    // Try explicit month/year
    const monthNames = {
      january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
      july: 7, august: 8, september: 9, october: 10, november: 11, december: 12
    }
    let year = null
    let month = null
    const ym = q.match(/\b(20\d{2})\b/)
    if (ym) year = Number(ym[1])
    for (const [name, num] of Object.entries(monthNames)) {
      if (new RegExp(`\\b${name}\\b`, 'i').test(q)) { month = num; break }
    }
    if (mayAgo) {
      // already set
    } else if (year && month) {
      const mm = String(month).padStart(2, '0')
      const lastDay = new Date(year, month, 0).getDate()
      period.start = `${year}-${mm}-01`
      period.end = `${year}-${mm}-${lastDay}`
      period.label = `${Object.keys(monthNames)[month - 1].replace(/^\w/, c => c.toUpperCase())} ${year}`
    } else if (year) {
      period.start = `${year}-01-01`
      period.end = `${year}-12-31`
      period.label = `Year ${year}`
    }
    return { type: 'pnl', period, chart: wantsChart }
  }
  if (wantsPayroll) {
    return { type: 'payroll_chart', years: parseYearSpan(q, 5) }
  }
  return { type: 'chat', question: q }
}

function money(n) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(n || 0)
}

function narratePnL(report) {
  const { period, totals, income, expenses, source } = report
  const topIncome = [...income].sort((a, b) => b.amount - a.amount)[0]
  const topExpense = [...expenses].sort((a, b) => b.amount - a.amount)[0]
  const modeNote = source === 'demo'
    ? ' (demo books — connect QuickBooks to read Joe\'s live numbers)'
    : ''
  return [
    `Profit & Loss for ${period.label}${modeNote}:`,
    `Income ${money(totals.income)}, expenses ${money(totals.expenses)}, net ${money(totals.netIncome)}.`,
    topIncome ? `Biggest income line: ${topIncome.name} at ${money(topIncome.amount)}.` : '',
    topExpense ? `Biggest expense: ${topExpense.name} at ${money(topExpense.amount)}.` : ''
  ].filter(Boolean).join(' ')
}

function narratePayroll(report) {
  const { series, summary, period, source } = report
  const modeNote = source === 'demo'
    ? ' Demo books until QuickBooks is connected.'
    : ''
  const first = series[0]
  const last = series[series.length - 1]
  return `Payroll over ${period.years} years (${first?.x}–${last?.x}): ${money(summary.first)} → ${money(summary.last)} (${summary.changePct >= 0 ? '+' : ''}${summary.changePct}%).${modeNote}`
}

async function getProfitAndLoss(period) {
  if (qbConfigured()) {
    try {
      return await liveProfitAndLoss(period.start, period.end, period.label)
    } catch (err) {
      const fallback = demoProfitAndLoss(period.start, period.end, period.label)
      fallback.warning = `Live QuickBooks failed (${err.message}). Showing demo books.`
      fallback.source = 'demo'
      return fallback
    }
  }
  return demoProfitAndLoss(period.start, period.end, period.label)
}

async function getPayrollTrend(years) {
  if (qbConfigured()) {
    try {
      return await livePayrollSeries(years)
    } catch (err) {
      const fallback = demoPayrollSeries(years)
      fallback.warning = `Live QuickBooks failed (${err.message}). Showing demo books.`
      fallback.source = 'demo'
      return fallback
    }
  }
  return demoPayrollSeries(years)
}

/**
 * Main brain entry: natural-language question → structured answer + optional chart.
 */
async function ask(question) {
  const intent = detectIntent(question)
  const st = status()

  if (intent.type === 'empty') {
    return {
      ok: false,
      mode: st.mode,
      answer: 'Ask me something like: “A year ago in May, give me a profit and loss,” or “Chart my payroll over the past five years.”'
    }
  }

  if (intent.type === 'pnl') {
    const report = await getProfitAndLoss(intent.period)
    const chart = {
      type: 'bar',
      title: `P&L — ${report.period.label}`,
      series: [
        {
          name: 'Income',
          color: '#F5C518',
          points: report.income.map(r => ({ x: r.name, y: r.amount }))
        },
        {
          name: 'Expenses',
          color: '#E85D04',
          points: report.expenses.map(r => ({ x: r.name, y: r.amount }))
        }
      ]
    }
    return {
      ok: true,
      mode: report.source,
      intent: 'pnl',
      answer: narratePnL(report),
      warning: report.warning || null,
      report,
      chart: intent.chart ? chart : {
        type: 'waterfall',
        title: `P&L — ${report.period.label}`,
        points: [
          { x: 'Income', y: report.totals.income, color: '#F5C518' },
          { x: 'Expenses', y: -report.totals.expenses, color: '#E85D04' },
          { x: 'Net', y: report.totals.netIncome, color: report.totals.netIncome >= 0 ? '#7CFC7A' : '#ff6b6b' }
        ]
      }
    }
  }

  if (intent.type === 'payroll_chart') {
    const report = await getPayrollTrend(intent.years)
    return {
      ok: true,
      mode: report.source,
      intent: 'payroll_chart',
      answer: narratePayroll(report),
      warning: report.warning || null,
      report,
      chart: {
        type: 'line',
        title: `Payroll — past ${report.period.years} years`,
        xLabel: 'Year',
        yLabel: 'Payroll ($)',
        series: [{
          name: 'Payroll',
          color: '#F5C518',
          points: report.series
        }]
      }
    }
  }

  // Generic coaching reply when we don't have a structured report intent
  return {
    ok: true,
    mode: st.mode,
    intent: 'chat',
    answer: st.connected
      ? `I'm connected to Joe's QuickBooks. Try: “Profit and loss for May last year,” or “XY chart of payroll over five years.”`
      : `I'm the Axon AI Brain for Joe's books. Right now I'm on demo data — connect QuickBooks with an Intuit app (Client ID, Client Secret, Refresh Token, Realm ID) and I'll read the live company. Meanwhile try: “A year ago in May, give me a P&L,” or “Chart payroll over the past five years.”`,
    chart: null
  }
}

/** Compact facts string injected into the voice playbook. */
async function voiceContextSnippet() {
  const st = status()
  const may = parseRelativeMay()
  const pnl = await getProfitAndLoss(may)
  const pay = await getPayrollTrend(5)
  return `
QUICKBOOKS MODE: ${st.mode.toUpperCase()} — ${st.company}
${st.hint}

SAMPLE SNAPSHOT (May last year P&L):
- Income ${money(pnl.totals.income)}, Expenses ${money(pnl.totals.expenses)}, Net ${money(pnl.totals.netIncome)}
- Top income: ${pnl.income[0]?.name || 'n/a'}
- Top expense: ${pnl.expenses[0]?.name || 'n/a'}

PAYROLL TREND (${pay.period.years} yrs): ${pay.series.map(p => `${p.x}: ${money(p.y)}`).join(', ')}
Change: ${pay.summary.changePct}%

When the user asks for a chart, tell them you posted it on the brain screen, and summarize the numbers in plain talk.
`.trim()
}

export {
  status,
  ask,
  detectIntent,
  getProfitAndLoss,
  getPayrollTrend,
  voiceContextSnippet,
  qbConfigured
}
