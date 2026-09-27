import { useState, useCallback } from 'react'
import { PresenceEditor } from './pages/PresenceEditor'
import { AuthPage } from './pages/AuthPage'
import { getAuthSession, clearAuthSession } from './utils/storage'

function App() {
  // Check 14-day persistent login session
  const [authSession, setAuthSession] = useState(() => getAuthSession())

  const handleLoginSuccess = useCallback((user) => {
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

  return (
    <PresenceEditor
      key={authSession.user.id}
      user={authSession.user}
      onLogout={handleLogout}
    />
  )
}

export default App
