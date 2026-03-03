import React from 'react'
import { MONTHLY_PRICE_PHP, formatMonthLabel } from '../utils/billing'

function PaymentStatus({
  loadingPayments,
  paymentsError,
  billingSummary,
  payments,
  billingStartMonth,
}) {
  const hasVerifying = Array.isArray(payments)
    ? payments.some((payment) => payment?.status === 'submitted')
    : false

  const overdueMonths = billingSummary?.dueMonths?.length || 0
  const overdueAmount = billingSummary?.totalDue || 0
  const dueMonthsPreview = billingSummary?.dueMonths?.slice(0, 6) || []
  const hiddenDueCount = Math.max(overdueMonths - dueMonthsPreview.length, 0)

  let accountState = 'verifying'
  if (overdueMonths > 0) {
    accountState = 'overdue'
  } else if (!hasVerifying) {
    accountState = 'paid'
  }

  return (
    <section className="status-section">
      <div className="section-head-row">
        <h2 className="section-title">Status</h2>
        <span className={`status-chip status-chip-${accountState}`}>
          {accountState}
        </span>
      </div>

      {loadingPayments && (
        <div className="status-grid">
          <article className="metric-card">
            <span className="metric-label">Checking</span>
            <strong className="metric-value">Loading...</strong>
          </article>
        </div>
      )}

      {!loadingPayments && paymentsError && (
        <div className="status-grid">
          <article className="metric-card metric-card-muted">
            <span className="metric-label">Connection</span>
            <strong className="metric-value">Limited</strong>
            <span className="metric-subtle">Try refresh</span>
          </article>
        </div>
      )}

      {!loadingPayments && !paymentsError && billingSummary && (
        <>
          <div className="status-grid">
            <article className="metric-card">
              <span className="metric-label">Overdue</span>
              <strong className="metric-value">{overdueMonths} mo</strong>
            </article>
            <article className="metric-card">
              <span className="metric-label">Amount due</span>
              <strong className="metric-value">
                PHP {overdueAmount.toLocaleString('en-PH')}
              </strong>
            </article>
            <article className="metric-card">
              <span className="metric-label">Verifying</span>
              <strong className="metric-value">{hasVerifying ? 'Yes' : 'No'}</strong>
            </article>
          </div>

          {overdueMonths > 0 && (
            <div className="chips-row">
              {dueMonthsPreview.map((monthId) => (
                <span key={monthId} className="chip chip-due">
                  {formatMonthLabel(monthId)}
                </span>
              ))}
              {hiddenDueCount > 0 && <span className="chip">+{hiddenDueCount} more</span>}
            </div>
          )}
        </>
      )}

      {!loadingPayments && !paymentsError && !billingSummary && (
        <div className="status-grid">
          <article className="metric-card metric-card-muted">
            <span className="metric-label">Status</span>
            <strong className="metric-value">Waiting</strong>
          </article>
        </div>
      )}

      <div className="status-footer-note">
        Since <span className="mono">{billingStartMonth}</span> • PHP{' '}
        <span className="mono">{MONTHLY_PRICE_PHP}</span>/mo
      </div>
    </section>
  )
}

export default PaymentStatus
