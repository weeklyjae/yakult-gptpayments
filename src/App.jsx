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
  BILLING_START_MONTH,
  MONTHLY_PRICE_PHP,
  calculateDueSummary,
  formatMonthLabel,
} from './utils/billing.js'
import Header from './components/Header.jsx'
import PaymentStatus from './components/PaymentStatus.jsx'
import UploadSection from './components/UploadSection.jsx'
import AdminDashboard from './components/AdminDashboard.jsx'

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
        <Header user={user} isAdmin={isAdmin} onSignOut={signOut} />

        <main className="card-body">
          <PaymentStatus
            loadingPayments={loadingPayments}
            paymentsError={paymentsError}
            billingSummary={billingSummary}
          />

          <UploadSection
            fileInputRef={fileInputRef}
            selectedFile={selectedFile}
            uploading={uploading}
            uploadError={uploadError}
            uploadSuccess={uploadSuccess}
            billingSummary={billingSummary}
            monthsForNextUpload={monthsForNextUpload}
            onFileChange={handleFileChange}
            onUpload={handleUpload}
          />

          {isAdmin && <AdminDashboard payments={payments} />}
        </main>
      </div>
    </div>
  )
}

export default App
