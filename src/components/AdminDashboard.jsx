import React, { useEffect, useMemo, useState } from 'react'
import {
  BILLING_DAY,
  BILLING_START_MONTH,
  formatMonthLabel,
} from '../utils/billing'

function toDateLabel(value) {
  if (!value) return '--'
  try {
    if (typeof value?.toDate === 'function') {
      return value.toDate().toLocaleDateString()
    }
    if (typeof value?.seconds === 'number') {
      return new Date(value.seconds * 1000).toLocaleDateString()
    }
    return new Date(value).toLocaleDateString()
  } catch {
    return '--'
  }
}

function parseMonthId(monthId) {
  const [yearStr, monthStr] = String(monthId).split('-')
  return { year: Number(yearStr), month: Number(monthStr) }
}

function formatMonthId(year, month) {
  const mm = String(month).padStart(2, '0')
  return `${year}-${mm}`
}

function nextMonthId(monthId) {
  const { year, month } = parseMonthId(monthId)
  if (month === 12) return formatMonthId(year + 1, 1)
  return formatMonthId(year, month + 1)
}

function getLastDueMonthId(today = new Date()) {
  const year = today.getFullYear()
  const month = today.getMonth() + 1
  if (today.getDate() >= BILLING_DAY) {
    return formatMonthId(year, month)
  }
  if (month === 1) {
    return formatMonthId(year - 1, 12)
  }
  return formatMonthId(year, month - 1)
}

function monthRange(startMonthId, endMonthId) {
  const months = []
  let iter = startMonthId
  while (iter <= endMonthId) {
    months.push(iter)
    iter = nextMonthId(iter)
  }
  return months.reverse()
}

function maxMonthId(a, b) {
  return a > b ? a : b
}

function toPaymentState(statusValue) {
  const status = String(statusValue || '').toLowerCase()
  if (status === 'verified' || status === 'paid' || status === 'approved') {
    return 'paid'
  }
  if (status === 'submitted') {
    return 'verifying'
  }
  return 'unknown'
}

function AdminDashboard({
  users,
  payments,
  loading,
  error,
  updatingPaymentId,
  onVerifyPayment,
  billingStartMonth,
}) {
  const [adminTab, setAdminTab] = useState('month')
  const [monthIndex, setMonthIndex] = useState(0)

  const startMonth = billingStartMonth || BILLING_START_MONTH

  const userMap = new Map((users || []).map((user) => [user.id, user]))

  const userCards = useMemo(() => {
    const grouped = new Map()

    ;(payments || []).forEach((payment) => {
      const key = payment.userId || payment.email || payment.id
      const owner = userMap.get(payment.userId) || null
      const existing = grouped.get(key)

      if (!existing) {
        grouped.set(key, {
          key,
          userId: payment.userId,
          displayName: owner?.displayName || payment.email || 'Unknown user',
          email: owner?.email || payment.email || 'No email',
          receipts: [payment],
        })
        return
      }

      existing.receipts.push(payment)
    })

    ;(users || []).forEach((user) => {
      if (!grouped.has(user.id)) {
        grouped.set(user.id, {
          key: user.id,
          userId: user.id,
          displayName: user.displayName || user.email || 'Unknown user',
          email: user.email || 'No email',
          receipts: [],
        })
      }
    })

    return Array.from(grouped.values())
  }, [payments, users])

  const monthBreakdown = useMemo(() => {
    const monthUserState = new Map()

    ;(payments || []).forEach((payment) => {
      const userKey = payment.userId || payment.email || payment.id
      const state = toPaymentState(payment.status)
      const monthsCovered = Array.isArray(payment.monthsCovered)
        ? payment.monthsCovered
        : []

      monthsCovered.forEach((monthId) => {
        if (!monthUserState.has(monthId)) {
          monthUserState.set(monthId, new Map())
        }
        const usersForMonth = monthUserState.get(monthId)
        const prevState = usersForMonth.get(userKey)

        if (prevState === 'paid') return
        if (prevState === 'verifying' && state !== 'paid') return
        usersForMonth.set(userKey, state)
      })
    })

    const lastDueMonth = getLastDueMonthId()
    const visibleMonthEnd = maxMonthId(startMonth, lastDueMonth)
    const months = monthRange(startMonth, visibleMonthEnd)

    return months.map((monthId) => {
      const usersForMonth = monthUserState.get(monthId) || new Map()

      const paid = []
      const verifying = []
      const unpaid = []

      userCards.forEach((entry) => {
        const state = usersForMonth.get(entry.key)
        const label = entry.displayName || entry.email || 'Unknown user'
        if (state === 'paid') {
          paid.push(label)
        } else if (state === 'verifying') {
          verifying.push(label)
        } else {
          unpaid.push(label)
        }
      })

      return {
        monthId,
        paid,
        verifying,
        unpaid,
      }
    })
  }, [payments, startMonth, userCards])

  useEffect(() => {
    setMonthIndex(0)
  }, [startMonth, monthBreakdown.length])

  const currentMonth = monthBreakdown[monthIndex]

  const canViewPrevious = monthIndex < monthBreakdown.length - 1
  const canViewNext = monthIndex > 0

  return (
    <section className="admin-section">
      <div className="section-head-row">
        <h2 className="section-title">Admin</h2>
        <span className="mini-note">{userCards.length} users</span>
      </div>

      <div className="admin-menu">
        <button
          className={`admin-menu-btn ${adminTab === 'month' ? 'admin-menu-btn-active' : ''}`}
          onClick={() => setAdminTab('month')}
        >
          Month
        </button>
        <button
          className={`admin-menu-btn ${adminTab === 'users' ? 'admin-menu-btn-active' : ''}`}
          onClick={() => setAdminTab('users')}
        >
          Users
        </button>
        <button
          className={`admin-menu-btn ${adminTab === 'receipts' ? 'admin-menu-btn-active' : ''}`}
          onClick={() => setAdminTab('receipts')}
        >
          Receipts
        </button>
      </div>

      {loading && <p className="status-helper">Loading admin data...</p>}
      {error && <p className="status-helper">{error}</p>}

      {!loading && !error && adminTab === 'month' && currentMonth && (
        <div className="admin-month-item">
          <div className="admin-month-nav">
            <button
              className="admin-nav-btn"
              disabled={!canViewPrevious}
              onClick={() => canViewPrevious && setMonthIndex((prev) => prev + 1)}
            >
              Previous
            </button>
            <button className="admin-nav-btn admin-nav-btn-current" disabled>
              Calendar • {formatMonthLabel(currentMonth.monthId)}
            </button>
            <button
              className="admin-nav-btn"
              disabled={!canViewNext}
              onClick={() => canViewNext && setMonthIndex((prev) => prev - 1)}
            >
              Next
            </button>
          </div>

          <div className="admin-month-columns">
            <div className="admin-month-col">
              <h4 className="admin-col-title">Paid ({currentMonth.paid.length})</h4>
              <div className="admin-name-list">
                {currentMonth.paid.length ? (
                  currentMonth.paid.map((name) => (
                    <span key={`paid-${currentMonth.monthId}-${name}`} className="chip">
                      {name}
                    </span>
                  ))
                ) : (
                  <span className="mini-note">None</span>
                )}
              </div>
            </div>

            <div className="admin-month-col">
              <h4 className="admin-col-title">
                Verifying ({currentMonth.verifying.length})
              </h4>
              <div className="admin-name-list">
                {currentMonth.verifying.length ? (
                  currentMonth.verifying.map((name) => (
                    <span
                      key={`verifying-${currentMonth.monthId}-${name}`}
                      className="chip status-chip-verifying"
                    >
                      {name}
                    </span>
                  ))
                ) : (
                  <span className="mini-note">None</span>
                )}
              </div>
            </div>

            <div className="admin-month-col">
              <h4 className="admin-col-title">Unpaid ({currentMonth.unpaid.length})</h4>
              <div className="admin-name-list">
                {currentMonth.unpaid.length ? (
                  currentMonth.unpaid.map((name) => (
                    <span
                      key={`unpaid-${currentMonth.monthId}-${name}`}
                      className="chip status-chip-overdue"
                    >
                      {name}
                    </span>
                  ))
                ) : (
                  <span className="mini-note">None</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {!loading && !error && adminTab === 'users' && (
        <div className="admin-users-list">
          {userCards.map((entry) => (
            <article key={entry.key} className="admin-user-card">
              <div className="admin-user-head">
                <div>
                  <strong className="admin-user-name">{entry.displayName}</strong>
                  <p className="admin-user-email">{entry.email}</p>
                </div>
                <span className="mini-note">{entry.receipts.length} receipt(s)</span>
              </div>
            </article>
          ))}
        </div>
      )}

      {!loading && !error && adminTab === 'receipts' && (
        <div className="admin-users-list">
          {userCards.map((entry) => (
            <article key={entry.key} className="admin-user-card">
              <div className="admin-user-head">
                <div>
                  <strong className="admin-user-name">{entry.displayName}</strong>
                  <p className="admin-user-email">{entry.email}</p>
                </div>
                <span className="mini-note">{entry.receipts.length} receipt(s)</span>
              </div>

              <div className="admin-receipts-list">
                {entry.receipts.map((receipt) => {
                  const status = String(receipt.status || 'submitted').toLowerCase()
                  const isSubmitted = status === 'submitted'
                  return (
                    <div key={receipt.id} className="admin-receipt-item">
                      <div className="admin-receipt-main">
                        <span
                          className={`status-chip status-chip-${
                            status === 'verified' ? 'paid' : 'verifying'
                          }`}
                        >
                          {status}
                        </span>
                        <span className="admin-receipt-months">
                          {(receipt.monthsCovered || [])
                            .slice(0, 2)
                            .map((month) => formatMonthLabel(month))
                            .join(', ') || '--'}
                        </span>
                        <span className="admin-receipt-date">
                          {toDateLabel(receipt.uploadedAt)}
                        </span>
                      </div>

                      <div className="admin-receipt-actions">
                        {receipt.receiptUrl && (
                          <a
                            href={receipt.receiptUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="admin-link-btn"
                          >
                            View receipt
                          </a>
                        )}
                        {isSubmitted && (
                          <button
                            className="admin-action-btn"
                            onClick={() => onVerifyPayment(receipt.id)}
                            disabled={updatingPaymentId === receipt.id}
                          >
                            {updatingPaymentId === receipt.id
                              ? 'Verifying...'
                              : 'Mark verified'}
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

export default AdminDashboard
