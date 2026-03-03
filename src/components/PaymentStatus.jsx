import React from 'react'
import {
  BILLING_DAY,
  BILLING_START_MONTH,
  MONTHLY_PRICE_PHP,
  formatMonthLabel,
} from '../utils/billing'

function PaymentStatus({
  loadingPayments,
  paymentsError,
  billingSummary,
}) {
  return (
    <section className="status-section">
      <h2 className="section-title">Payment status</h2>
      {loadingPayments && (
        <>
          <p className="status-pill status-pill-neutral">
            Checking your payment history…
          </p>
          <p className="status-helper">
            We’re looking up which months you’re covered for since{' '}
            <strong>{BILLING_START_MONTH}</strong>.
          </p>
        </>
      )}

      {!loadingPayments && paymentsError && (
        <div className="alert alert-error">
          <p>{paymentsError}</p>
        </div>
      )}

      {!loadingPayments && !paymentsError && billingSummary && (
        <>
          {billingSummary.dueMonths.length === 0 ? (
            <>
              <p className="status-pill status-pill-success">
                You’re fully up to date. No payments due right now.
              </p>
              <p className="status-helper">
                If you just paid, you can still upload a fresh receipt for this
                month for your own records.
              </p>
            </>
          ) : (
            <>
              <p className="status-pill status-pill-warning">
                You have{' '}
                <strong>{billingSummary.dueMonths.length} month(s)</strong> due
                ·{' '}
                <strong>
                  {billingSummary.totalDue.toLocaleString('en-PH')} PHP
                </strong>
              </p>
              <p className="status-helper">
                Payments are <strong>80 PHP per month</strong>. They become due
                every <strong>{BILLING_DAY}th</strong> and accumulate if unpaid.
              </p>
              <div className="chips-row">
                {billingSummary.dueMonths.map((monthId) => (
                  <span key={monthId} className="chip chip-due">
                    {formatMonthLabel(monthId)}
                  </span>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {!loadingPayments && !paymentsError && !billingSummary && (
        <p className="status-helper">
          We’ll show your payment status here once your account loads.
        </p>
      )}

      <div className="status-footer-note">
        Starting month for billing:{' '}
        <span className="mono">{BILLING_START_MONTH}</span> ·{' '}
        <span className="mono">
          {MONTHLY_PRICE_PHP.toLocaleString('en-PH')} PHP / month
        </span>
      </div>
    </section>
  )
}

export default PaymentStatus

