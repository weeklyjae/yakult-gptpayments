import './App.css'
import { useEffect, useRef, useState } from 'react'
import {
  addDoc,
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
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
  const [adminPayments, setAdminPayments] = useState([])
  const [adminUsers, setAdminUsers] = useState([])
  const [loadingAdmin, setLoadingAdmin] = useState(false)
  const [adminError, setAdminError] = useState(null)
  const [updatingPaymentId, setUpdatingPaymentId] = useState(null)
  const [billingSummary, setBillingSummary] = useState(null)
  const [effectiveBillingStartMonth, setEffectiveBillingStartMonth] =
    useState(BILLING_START_MONTH)
  const [loadingPayments, setLoadingPayments] = useState(false)
  const [paymentsError, setPaymentsError] = useState(null)
  const [selectedFile, setSelectedFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState(null)
  const [uploadSuccess, setUploadSuccess] = useState(null)
  const [activeView, setActiveView] = useState('home')
  const fileInputRef = useRef(null)

  const toMonthId = (dateInput) => {
    const date = new Date(dateInput)
    if (Number.isNaN(date.getTime())) return null
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    return `${year}-${month}`
  }

  const laterMonthId = (a, b) => {
    return a > b ? a : b
  }

  useEffect(() => {
    if (!user) return

    const loadPayments = async () => {
      setLoadingPayments(true)
      setPaymentsError(null)
      try {
        const accountStartMonth =
          toMonthId(user?.metadata?.creationTime) || BILLING_START_MONTH
        const startMonth = laterMonthId(BILLING_START_MONTH, accountStartMonth)
        setEffectiveBillingStartMonth(startMonth)

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
          calculateDueSummary(rows, { billingStartMonth: startMonth })
        )
      } catch (err) {
        console.error('[Yakult GPT Payments] Failed to load payments', err)
        if (String(err?.code || '') === 'permission-denied') {
          setPaymentsError(
            'Signed in ka na. Temporary unavailable lang yung payment history ngayon, pero pwede ka pa rin mag-upload ng receipt image.'
          )
        } else {
          setPaymentsError(
            'Could not load your payment history. Please refresh in a moment.'
          )
        }
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

  const hasPendingVerification = payments.some(
    (payment) => String(payment?.status || '').toLowerCase() === 'submitted'
  )

  useEffect(() => {
    if (!isAdmin && activeView === 'admin') {
      setActiveView('home')
    }
  }, [isAdmin, activeView])

  const handleFileChange = (event) => {
    setSelectedFile(event.target.files?.[0] ?? null)
    setUploadError(null)
    setUploadSuccess(null)
  }

  const handleUpload = async () => {
    if (!user) return
    setUploadError(null)
    setUploadSuccess(null)

    if (hasPendingVerification) {
      setUploadError('Waiting for admin verification.')
      return
    }

    if (!selectedFile) {
      setUploadError('Choose an image first.')
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
            billingStartMonth: effectiveBillingStartMonth,
          })
        )
        return updated
      })
      if (isAdmin) {
        setAdminPayments((prev) => [newPaymentWithId, ...prev])
      }

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
      if (String(err?.code || '') === 'permission-denied') {
        setUploadError(
          'Na-upload ang file pero hindi pa ma-save ang record ngayon. Paki-try ulit mamaya or i-check muna Firestore access.'
        )
        return
      }
      setUploadError(
        err.message ||
          'Something went wrong while uploading your receipt. Please try again.'
      )
    } finally {
      setUploading(false)
    }
  }

  useEffect(() => {
    if (!user || !isAdmin) {
      setAdminPayments([])
      setAdminUsers([])
      setAdminError(null)
      return
    }

    const loadAdminData = async () => {
      setLoadingAdmin(true)
      setAdminError(null)
      try {
        const paymentsSnapshot = await getDocs(
          query(collection(db, 'payments'), orderBy('uploadedAt', 'desc'))
        )
        const usersSnapshot = await getDocs(
          query(collection(db, 'users'), orderBy('email'))
        )

        setAdminPayments(
          paymentsSnapshot.docs.map((paymentDoc) => ({
            id: paymentDoc.id,
            ...paymentDoc.data(),
          }))
        )
        setAdminUsers(
          usersSnapshot.docs.map((userDoc) => ({
            id: userDoc.id,
            ...userDoc.data(),
          }))
        )
      } catch (err) {
        console.error('[Yakult GPT Payments] Failed to load admin data', err)
        setAdminError('Could not load admin data.')
      } finally {
        setLoadingAdmin(false)
      }
    }

    loadAdminData()
  }, [user, isAdmin])

  const handleVerifyPayment = async (paymentId) => {
    if (!isAdmin || !paymentId) return
    setUpdatingPaymentId(paymentId)
    try {
      await updateDoc(doc(db, 'payments', paymentId), {
        status: 'verified',
        verifiedAt: serverTimestamp(),
        verifiedBy: user?.email || user?.uid || 'admin',
      })

      setAdminPayments((prev) =>
        prev.map((payment) =>
          payment.id === paymentId ? { ...payment, status: 'verified' } : payment
        )
      )
      setPayments((prev) => {
        const updated = prev.map((payment) =>
          payment.id === paymentId ? { ...payment, status: 'verified' } : payment
        )
        setBillingSummary(
          calculateDueSummary(updated, {
            billingStartMonth: effectiveBillingStartMonth,
          })
        )
        return updated
      })
    } catch (err) {
      console.error('[Yakult GPT Payments] Failed to verify payment', err)
      setAdminError('Failed to verify payment.')
    } finally {
      setUpdatingPaymentId(null)
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
              Sign in to continue.
            </p>
          </div>

          {authError === 'not-authorized' && (
            <div className="alert alert-error">
              <p>
                Account not in whitelist.
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
        <div className="hero-banner" />
        <Header user={user} isAdmin={isAdmin} onSignOut={signOut} />

        <main className="card-body">
          {activeView !== 'admin' && (
            <>
              <PaymentStatus
                loadingPayments={loadingPayments}
                paymentsError={paymentsError}
                billingSummary={billingSummary}
                payments={payments}
                billingStartMonth={effectiveBillingStartMonth}
              />

              <UploadSection
                fileInputRef={fileInputRef}
                selectedFile={selectedFile}
                uploading={uploading}
                hasPendingVerification={hasPendingVerification}
                uploadError={uploadError}
                uploadSuccess={uploadSuccess}
                billingSummary={billingSummary}
                monthsForNextUpload={monthsForNextUpload}
                onFileChange={handleFileChange}
                onUpload={handleUpload}
              />
            </>
          )}

          {isAdmin && activeView === 'admin' && (
            <AdminDashboard
              users={adminUsers}
              payments={adminPayments}
              loading={loadingAdmin}
              error={adminError}
              updatingPaymentId={updatingPaymentId}
              onVerifyPayment={handleVerifyPayment}
              billingStartMonth={effectiveBillingStartMonth}
            />
          )}

          <nav className="dock-menu" aria-label="Main menu">
            <button
              className={`dock-btn ${activeView !== 'admin' ? 'dock-btn-active' : ''}`}
              onClick={() => setActiveView('home')}
            >
              Home
            </button>
            {isAdmin && (
              <button
                className={`dock-btn ${activeView === 'admin' ? 'dock-btn-active' : ''}`}
                onClick={() => setActiveView('admin')}
              >
                Admin
              </button>
            )}
          </nav>
        </main>
      </div>
    </div>
  )
}

export default App
