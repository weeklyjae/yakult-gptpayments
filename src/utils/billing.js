// Billing utilities for Yakult GPT Payments
// Handles calculation of due months and total amount based on 80 PHP/month

export const MONTHLY_PRICE_PHP = 80
export const BILLING_DAY = 5 // payments are due every 5th of the month
export const BILLING_START_MONTH = '2026-03' // YYYY-MM

function parseMonthId(monthId) {
  const [yearStr, monthStr] = String(monthId).split('-')
  const year = Number(yearStr)
  const month = Number(monthStr)
  if (!year || !month) {
    throw new Error(`Invalid monthId: ${monthId}`)
  }
  return { year, month }
}

function formatMonthId(year, month) {
  const mm = String(month).padStart(2, '0')
  return `${year}-${mm}`
}

function nextMonthId(monthId) {
  const { year, month } = parseMonthId(monthId)
  if (month === 12) {
    return formatMonthId(year + 1, 1)
  }
  return formatMonthId(year, month + 1)
}

export function formatMonthLabel(monthId) {
  const { year, month } = parseMonthId(monthId)
  const date = new Date(year, month - 1, 1)
  return date.toLocaleDateString(undefined, {
    month: 'short',
    year: 'numeric',
  })
}

export function extractCoveredMonthsFromPayments(payments) {
  const covered = new Set()
  payments.forEach((payment) => {
    const status = String(payment?.status || '').toLowerCase()
    const isApproved =
      status === '' ||
      status === 'verified' ||
      status === 'paid' ||
      status === 'approved'
    if (!isApproved) return

    const months = Array.isArray(payment.monthsCovered)
      ? payment.monthsCovered
      : []
    months.forEach((m) => {
      if (typeof m === 'string' && m.includes('-')) {
        covered.add(m)
      }
    })
  })
  return covered
}

export function calculateDueSummary(payments, options = {}) {
  const today = options.today || new Date()
  const billingStartMonth = options.billingStartMonth || BILLING_START_MONTH
  const billingDay = options.billingDay || BILLING_DAY

  const coveredMonths = extractCoveredMonthsFromPayments(payments)

  // Determine last month that can be considered \"due\"
  const currentYear = today.getFullYear()
  const currentMonth = today.getMonth() + 1
  const currentMonthId = formatMonthId(currentYear, currentMonth)

  let lastDueMonthId
  if (today.getDate() >= billingDay) {
    lastDueMonthId = currentMonthId
  } else {
    // Before the 5th, only previous months can be due
    const prevMonth =
      currentMonth === 1
        ? { year: currentYear - 1, month: 12 }
        : { year: currentYear, month: currentMonth - 1 }
    lastDueMonthId = formatMonthId(prevMonth.year, prevMonth.month)
  }

  const dueMonths = []
  let iter = billingStartMonth

  while (true) {
    // Stop once we go past the last due month
    const { year: iterYear, month: iterMonth } = parseMonthId(iter)
    const { year: lastYear, month: lastMonth } = parseMonthId(lastDueMonthId)

    const pastLast =
      iterYear > lastYear || (iterYear === lastYear && iterMonth > lastMonth)
    if (pastLast) break

    if (!coveredMonths.has(iter)) {
      dueMonths.push(iter)
    }

    iter = nextMonthId(iter)
  }

  const totalDue = dueMonths.length * MONTHLY_PRICE_PHP

  return {
    dueMonths,
    totalDue,
    coveredMonths: Array.from(coveredMonths),
  }
}

