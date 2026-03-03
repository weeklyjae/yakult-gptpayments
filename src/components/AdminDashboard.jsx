import React from 'react'

function AdminDashboard({ payments }) {
  return (
    <section className="admin-section">
      <h2 className="section-title">Admin dashboard</h2>
      <p className="section-caption">
        Only you can see this section. In the future you can expand this into a
        full table of all users and payments.
      </p>
      <div className="status-helper">
        For now, your own payment history is stored in Firestore under the{' '}
        <span className="mono">payments</span> collection. You can open Firebase
        console to review or adjust entries if needed.
      </div>
      {Array.isArray(payments) && (
        <div className="status-helper">
          You have uploaded{' '}
          <span className="mono">{payments.length}</span> receipt
          {payments.length === 1 ? '' : 's'} so far.
        </div>
      )}
    </section>
  )
}

export default AdminDashboard

