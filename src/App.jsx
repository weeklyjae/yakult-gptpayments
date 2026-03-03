import './App.css'
import { useEffect, useRef, useState } from 'react'
import {
  addDoc,
  collection,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  where,
} from 'firebase/firestore'
import { useAuth } from './auth/AuthProvider.jsx'
import { db } from './firebase'
import {
  BILLING_DAY,
  BILLING_START_MONTH,
  MONTHLY_PRICE_PHP,
  calculateDueSummary,
  formatMonthLabel,
} from './utils/billing.js'

function App() {
  const { user, isAdmin, checkingAuth, authError, signInWithGoogle, signOut } =
    useAuth()
  const [payments, setPayments] = useState([])
  const [billingSummary, setBillingSummary] = useState(null)
  const [loadingPayments, setLoadingPayments] = useState(false)
  const [paymentsError, setPaymentsError] = useState(null)
  const [selectedFile, setSelectedFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState(null)
  const [uploadSuccess, setUploadSuccess] = useState(null)
  const fileInputRef = useRef(null)

  useEffect(() => {
    if (!user) return

    const loadPayments = async () => {
      setLoadingPayments(true)
      setPaymentsError(null)
      try {
        const paymentsRef = collection(db, 'payments')
        const q = query(
          paymentsRef,
          where('userId', '==', user.uid),
          orderBy('uploadedAt', 'desc')
        )
        const snapshot = await getDocs(q)
        const rows = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
        setPayments(rows)
        setBillingSummary(
          calculateDueSummary(rows, { billingStartMonth: BILLING_START_MONTH })
        )
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[Yakult GPT Payments] Failed to load payments', err)
        setPaymentsError(
          'Could not load your payment history. Please refresh in a moment.'
        )
      } finally {
        setLoadingPayments(false)
      }
    }

    loadPayments()
  }, [user])

  const currentMonthId = () => {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    return `${year}-${month}`
  }

  const monthsForNextUpload = () => {
    if (billingSummary && billingSummary.dueMonths.length > 0) {
      return billingSummary.dueMonths
    }
    return [currentMonthId()]
  }

  const handleFileChange = (event) => {
    setSelectedFile(event.target.files?.[0] ?? null)
    setUploadError(null)
    setUploadSuccess(null)
  }

  const handleUpload = async () => {
    if (!user) return
    setUploadError(null)
    setUploadSuccess(null)

    if (!selectedFile) {
      setUploadError('Please choose a receipt image or PDF before uploading.')
      return
    }

    const months = monthsForNextUpload()

    try {
      setUploading(true)
      const idToken = await user.getIdToken()
      const formData = new FormData()
      formData.append('file', selectedFile)
      formData.append('monthsCovered', JSON.stringify(months))

      const response = await fetch('/api/upload-receipt', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
        body: formData,
      })

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}))
        throw new Error(errorBody.error || 'Upload failed')
      }

      const result = await response.json()

      const amountPaid = months.length * MONTHLY_PRICE_PHP
      const paymentDoc = {
        userId: user.uid,
        email: user.email,
        monthsCovered: months,
        amountPaid,
        receiptKey: result.key,
        receiptUrl: result.publicUrl || null,
        uploadedAt: serverTimestamp(),
        status: 'submitted',
      }

      const paymentsRef = collection(db, 'payments')
      const docRef = await addDoc(paymentsRef, paymentDoc)

      const newPaymentWithId = { id: docRef.id, ...paymentDoc }

      setPayments((prev) => {
        const updated = [newPaymentWithId, ...prev]
        setBillingSummary(
          calculateDueSummary(updated, {
            billingStartMonth: BILLING_START_MONTH,
          })
        )
        return updated
      })

      setUploadSuccess(
        `Receipt uploaded for ${months
          .map((m) => formatMonthLabel(m))
          .join(', ')}.`
      )
      setSelectedFile(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[Yakult GPT Payments] Upload failed', err)
      setUploadError(
        err.message ||
          'Something went wrong while uploading your receipt. Please try again.'
      )
    } finally {
      setUploading(false)
    }
  }

  if (checkingAuth) {
    return (
      <div className="app-root">
        <div className="glow-orb glow-orb-lg" />
        <div className="glow-orb glow-orb-sm" />
        <div className="card-shell">
          <div className="app-header">
            <h1 className="app-title">Yakult GPT Payments</h1>
            <p className="app-subtitle">Loading your account…</p>
          </div>
          <div className="loading-pulse" />
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="app-root">
        <div className="glow-orb glow-orb-lg" />
        <div className="glow-orb glow-orb-sm" />
        <div className="card-shell">
          <div className="app-header">
            <h1 className="app-title">Yakult GPT Payments</h1>
            <p className="app-subtitle">
              Log in with your Google account to upload your monthly receipt.
            </p>
          </div>

          {authError === 'not-authorized' && (
            <div className="alert alert-error">
              <p>
                Your Google account is not whitelisted. Please contact the admin
                to be added.
              </p>
            </div>
          )}

          {authError === 'signin-failed' && (
            <div className="alert alert-error">
              <p>Sign-in failed. Please try again in a few seconds.</p>
            </div>
          )}

          <button className="btn-primary google-btn" onClick={signInWithGoogle}>
            <span className="google-icon">G</span>
            Continue with Google
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="app-root">
      <div className="glow-orb glow-orb-lg" />
      <div className="glow-orb glow-orb-sm" />

      <div className="card-shell">
        <header className="top-bar">
          <div className="brand">
            <div className="brand-pip" />
            <div>
              <div className="brand-title">Yakult GPT Payments</div>
              <div className="brand-tagline">80 PHP / month · due every 5th</div>
            </div>
          </div>

          <div className="user-pill">
            {user.photoURL && (
              <img
                src={user.photoURL}
                alt={user.displayName || user.email}
                className="user-avatar"
              />
            )}
            <div className="user-meta">
              <span className="user-name">
                {user.displayName || 'Yakult Friend'}
              </span>
              <span className="user-email">{user.email}</span>
            </div>
            {isAdmin && <span className="admin-badge">Admin</span>}
            <button className="pill-logout" onClick={signOut}>
              Log out
            </button>
          </div>
        </header>

        <main className="card-body">
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
                      If you just paid, you can still upload a fresh receipt
                      for this month for your own records.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="status-pill status-pill-warning">
                      You have{' '}
                      <strong>{billingSummary.dueMonths.length} month(s)</strong>{' '}
                      due ·{' '}
                      <strong>
                        {billingSummary.totalDue.toLocaleString('en-PH')} PHP
                      </strong>
                    </p>
                    <p className="status-helper">
                      Payments are <strong>80 PHP per month</strong>. They
                      become due every <strong>{BILLING_DAY}th</strong> and
                      accumulate if unpaid.
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

          <section className="upload-section">
            <h2 className="section-title">Upload receipt</h2>
            <p className="section-caption">
              Attach a clear screenshot or PDF of your payment. We will mark the
              oldest unpaid months first.
            </p>

            <div className="upload-row">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf"
                onChange={handleFileChange}
                className="file-input"
              />
              <button
                className="btn-primary"
                onClick={handleUpload}
                disabled={uploading}
              >
                {uploading ? 'Uploading…' : 'Upload receipt'}
              </button>
            </div>

            {billingSummary && (
              <p className="status-helper">
                This upload will apply to:{' '}
                {monthsForNextUpload()
                  .map((m) => formatMonthLabel(m))
                  .join(', ')}
                .
              </p>
            )}

            {uploadError && (
              <div className="alert alert-error">
                <p>{uploadError}</p>
              </div>
            )}

            {uploadSuccess && (
              <div className="alert alert-success">
                <p>{uploadSuccess}</p>
              </div>
            )}
          </section>

          {isAdmin && (
            <section className="admin-section">
              <h2 className="section-title">Admin dashboard</h2>
              <p className="section-caption">
                Only you can see this section. In the future you can expand this
                into a full table of all users and payments.
              </p>
              <div className="status-helper">
                For now, your own payment history is stored in Firestore under
                the <span className="mono">payments</span> collection. You can
                open Firebase console to review or adjust entries if needed.
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  )
}

export default App
