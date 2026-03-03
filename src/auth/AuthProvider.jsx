import { createContext, useContext, useEffect, useState } from 'react'
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut as firebaseSignOut,
} from 'firebase/auth'
import { doc, serverTimestamp, setDoc } from 'firebase/firestore'
import { auth, googleProvider, db } from '../firebase'
import whitelist, { ADMIN_EMAILS } from '../config/whitelist'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [authError, setAuthError] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)

  const normalizedAdmins = ADMIN_EMAILS.map((email) =>
    String(email).trim().toLowerCase()
  )

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null)
        setIsAdmin(false)
        setAuthError(null)
        setCheckingAuth(false)
        return
      }

      const email = firebaseUser.email?.toLowerCase()
      const isAllowed = !!email && whitelist.includes(email)

      if (!isAllowed) {
        setAuthError('not-authorized')
        setUser(null)
        setIsAdmin(false)
        setCheckingAuth(false)
        await firebaseSignOut(auth)
        return
      }

      setUser(firebaseUser)
      setIsAdmin(!!email && normalizedAdmins.includes(email))
      setAuthError(null)
      setCheckingAuth(false)

      // Upsert basic user profile in Firestore
      try {
        const userRef = doc(db, 'users', firebaseUser.uid)
        await setDoc(
          userRef,
          {
            email: firebaseUser.email,
            displayName: firebaseUser.displayName || '',
            photoURL: firebaseUser.photoURL || '',
            lastLoginAt: serverTimestamp(),
            createdAt: serverTimestamp(),
          },
          { merge: true }
        )
      } catch (err) {
        console.error('[Yakult GPT Payments] Failed to sync user profile', err)
      }
    })

    return () => unsubscribe()
  }, [normalizedAdmins])

  const signInWithGoogle = async () => {
    setAuthError(null)
    try {
      await signInWithPopup(auth, googleProvider)
    } catch (err) {
      const code = String(err?.code || '')
      const message = String(err?.message || '')
      const isPopupIssue =
        code === 'auth/popup-closed-by-user' ||
        code === 'auth/popup-blocked' ||
        code === 'auth/cancelled-popup-request' ||
        message.toLowerCase().includes('cross-origin-opener-policy')

      if (isPopupIssue) {
        try {
          await signInWithRedirect(auth, googleProvider)
          return
        } catch (redirectErr) {
          console.error(
            '[Yakult GPT Payments] Google redirect sign-in failed',
            redirectErr
          )
        }
      }

      console.error('[Yakult GPT Payments] Google sign-in failed', err)
      setAuthError('signin-failed')
    }
  }

  const signOut = async () => {
    await firebaseSignOut(auth)
    setUser(null)
    setIsAdmin(false)
  }

  const value = {
    user,
    isAdmin,
    checkingAuth,
    authError,
    signInWithGoogle,
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return ctx
}

