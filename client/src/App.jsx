import { useState, useCallback, useEffect } from 'react'
import { PresenceEditor } from './pages/PresenceEditor'
import { AdminConsole } from './pages/AdminConsole'
import { AuthPage } from './pages/AuthPage'
import { getAuthSession, clearAuthSession, saveAuthSession } from './utils/storage'
import { apiGetMe } from './utils/api'

function App() {
  // Check 14-day persistent login session
  const [authSession, setAuthSession] = useState(() => getAuthSession())
  const [authLoading, setAuthLoading] = useState(() => Boolean(getAuthSession()?.token))

  useEffect(() => {
    if (!authSession?.token) {
      return undefined
    }
    let cancelled = false
    apiGetMe().then((res) => {
      if (cancelled) return
      const current = getAuthSession()
      if (!current) return setAuthSession(null)
      saveAuthSession(current.token, res.user, current.expiresAt)
      setAuthSession({ ...current, user: res.user })
    }).catch((error) => {
      if (cancelled) return
      if (error.status === 401) {
        clearAuthSession()
        setAuthSession(null)
      } else {
        // A cached branch assignment is not trusted while the server is unavailable.
        setAuthSession((current) => current ? { ...current, user: { ...current.user, role: 'unassigned', branchId: null, branchName: null } } : null)
      }
    }).finally(() => {
      if (!cancelled) setAuthLoading(false)
    })
    return () => { cancelled = true }
  }, [authSession?.token])

  const handleLoginSuccess = useCallback(() => {
    // Reload full valid session state
    setAuthSession(getAuthSession())
  }, [])

  const handleLogout = useCallback(() => {
    clearAuthSession()
    setAuthSession(null)
  }, [])

  if (!authSession || !authSession.user) {
    return <AuthPage onLoginSuccess={handleLoginSuccess} />
  }

  if (authLoading) {
    return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-xs text-slate-300">Verifying account and branch access…</div>
  }

  if (authSession.user.role === 'admin') {
    return <AdminConsole user={authSession.user} onLogout={handleLogout} />
  }

  return (
    <PresenceEditor
      key={authSession.user.id}
      user={authSession.user}
      onLogout={handleLogout}
    />
  )
}

export default App
