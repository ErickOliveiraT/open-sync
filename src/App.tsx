import { useState, useEffect, useCallback } from 'react'
import { HashRouter as BrowserRouter, Routes, Route } from 'react-router-dom'
import { useSyncEvents } from './hooks/useSyncEvents'
import Layout from './components/Layout'
import RcloneNotFound from './components/RcloneNotFound'
import HomePage from './pages/HomePage'
import TaskListPage from './pages/TaskListPage'
import NewTaskPage from './pages/NewTaskPage'
import EditTaskPage from './pages/EditTaskPage'
import ExecutionPage from './pages/ExecutionPage'
import LogsPage from './pages/LogsPage'
import RemotesPage from './pages/RemotesPage'

type CheckState = 'loading' | 'ok' | 'missing'

function AppRoutes() {
  useSyncEvents()
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/"              element={<HomePage />} />
          <Route path="/tasks"         element={<TaskListPage />} />
          <Route path="/tasks/new"      element={<NewTaskPage />} />
          <Route path="/tasks/:id/edit" element={<EditTaskPage />} />
          <Route path="/tasks/:id/run"  element={<ExecutionPage />} />
          <Route path="/tasks/:id/logs" element={<LogsPage />} />
          <Route path="/remotes"       element={<RemotesPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default function App() {
  const [checkState, setCheckState] = useState<CheckState>('loading')
  const [platform, setPlatform] = useState('linux')

  const runCheck = useCallback(async () => {
    const [installed, plat] = await Promise.all([
      window.electronAPI.checkRclone(),
      window.electronAPI.getPlatform(),
    ])
    setPlatform(plat)
    setCheckState(installed ? 'ok' : 'missing')
  }, [])

  useEffect(() => { runCheck() }, [runCheck])

  if (checkState === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-900">
        <p className="text-slate-400 text-sm">Checking dependencies...</p>
      </div>
    )
  }

  if (checkState === 'missing') {
    return <RcloneNotFound platform={platform} onRetry={runCheck} />
  }

  return <AppRoutes />
}
