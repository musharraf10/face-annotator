import { useCallback, useEffect, useState } from 'react'
import { LogOut, RefreshCw, Plus, Building2, UserRoundCog } from 'lucide-react'
import {
  apiGetAdminBranches,
  apiGetAdminUnassignedAccounts,
  apiAdminCreateBranch,
  apiAdminAssignOperationsAccount,
  apiAdminReplaceOperationsAccount,
} from '../utils/api'

export function AdminConsole({ user, onLogout }) {
  const [branches, setBranches] = useState([])
  const [accounts, setAccounts] = useState([])
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [selected, setSelected] = useState({})
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [branchResult, accountResult] = await Promise.all([
        apiGetAdminBranches(),
        apiGetAdminUnassignedAccounts(),
      ])
      setBranches(branchResult.branches || [])
      setAccounts(accountResult.accounts || [])
    } catch (err) {
      setError(err.message || 'Could not load branch administration data.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // Initial load is an external request; refresh updates state when it settles.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh()
  }, [refresh])

  const runAction = async (action, successMessage) => {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await action()
      setNotice(successMessage)
      await refresh()
      return true
    } catch (err) {
      setError(err.message || 'The action could not be completed.')
      return false
    } finally {
      setBusy(false)
    }
  }

  const createBranch = (event) => {
    event.preventDefault()
    runAction(() => apiAdminCreateBranch({ name, code }), 'Branch created and ready for account assignment.')
      .then((success) => { if (success) { setName(''); setCode('') } })
  }

  const assign = (branch) => {
    const userId = selected[branch._id || branch.id]
    if (!userId) return setError('Select an account first.')
    const action = branch.operationsUserId
      ? apiAdminReplaceOperationsAccount(branch._id || branch.id, userId)
      : apiAdminAssignOperationsAccount(branch._id || branch.id, userId)
    runAction(() => action, `Operations Employee account assigned to ${branch.name}.`)
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex items-center justify-between border-b border-slate-800 pb-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-sky-400">Presence Check Portal</p>
            <h1 className="mt-2 text-2xl font-semibold">Administration</h1>
            <p className="mt-1 text-sm text-slate-400">Signed in as {user?.name || user?.email || 'Administrator'}</p>
          </div>
          <button onClick={onLogout} className="flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm hover:bg-slate-800">
            <LogOut size={16} /> Sign out
          </button>
        </header>

        {error && <div role="alert" className="mb-4 rounded-lg border border-rose-800 bg-rose-950/50 p-3 text-sm text-rose-200">{error}</div>}
        {notice && <div role="status" className="mb-4 rounded-lg border border-emerald-800 bg-emerald-950/40 p-3 text-sm text-emerald-200">{notice}</div>}

        <section className="mb-6 rounded-xl border border-slate-800 bg-slate-900 p-5">
          <h2 className="flex items-center gap-2 font-semibold"><Plus size={18} /> Create branch</h2>
          <form onSubmit={createBranch} className="mt-4 grid gap-3 sm:grid-cols-[1fr_180px_auto]">
            <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Branch name" className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-sky-500" />
            <input required value={code} onChange={(e) => setCode(e.target.value)} placeholder="Branch code" className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm uppercase outline-none focus:border-sky-500" />
            <button disabled={busy} className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium hover:bg-sky-500 disabled:opacity-50">Create</button>
          </form>
        </section>

        <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-semibold"><Building2 size={18} /> Branches and account assignments</h2>
            <button disabled={loading} onClick={refresh} aria-label="Refresh" className="rounded-lg border border-slate-700 p-2 hover:bg-slate-800 disabled:opacity-50"><RefreshCw size={16} /></button>
          </div>
          {loading ? <p className="text-sm text-slate-400">Loading administration data…</p> : branches.length === 0 ? <p className="text-sm text-slate-400">No branches have been created.</p> : (
            <div className="space-y-3">
              {branches.map((branch) => {
                const branchKey = branch._id || branch.id
                const operator = branch.operationsUserId && typeof branch.operationsUserId === 'object' ? branch.operationsUserId : null
                return <article key={branchKey} className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h3 className="font-medium">{branch.name} <span className="ml-1 text-xs text-slate-500">{branch.code}</span></h3>
                      <p className="mt-1 text-xs text-slate-400">{branch.active ? 'Active' : 'Inactive'} · {operator ? `Operations account: ${operator.name || operator.email}` : 'No Operations Employee account assigned'}</p>
                    </div>
                    {operator && <UserRoundCog className="text-sky-400" size={18} />}
                  </div>
                  {accounts.length > 0 && <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <select value={selected[branchKey] || ''} onChange={(e) => setSelected((current) => ({ ...current, [branchKey]: e.target.value }))} className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm">
                      <option value="">{operator ? 'Select replacement account' : 'Select an unassigned account'}</option>
                      {accounts.map((account) => <option key={account.id} value={account.id}>{account.name} · {account.email}</option>)}
                    </select>
                    <button disabled={busy || !selected[branchKey]} onClick={() => assign(branch)} className="rounded-lg border border-slate-700 px-4 py-2 text-sm hover:bg-slate-800 disabled:opacity-50">{operator ? 'Replace account' : 'Assign account'}</button>
                  </div>}
                </article>
              })}
            </div>
          )}
          {!loading && accounts.length === 0 && <p className="mt-4 text-xs text-amber-300">No unassigned accounts are available. New account registration creates unassigned accounts for an administrator to assign.</p>}
        </section>
      </div>
    </main>
  )
}
