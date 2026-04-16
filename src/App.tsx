import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useSyncEvents } from './hooks/useSyncEvents'
import Layout from './components/Layout'
import HomePage from './pages/HomePage'
import TaskListPage from './pages/TaskListPage'
import NewTaskPage from './pages/NewTaskPage'
import EditTaskPage from './pages/EditTaskPage'
import ExecutionPage from './pages/ExecutionPage'
import RemotesPage from './pages/RemotesPage'

export default function App() {
  // Wire IPC events → Zustand store for the entire app lifetime
  useSyncEvents()

  return (
    <BrowserRouter>
      <Routes>
        {/* All main routes share the sidebar layout */}
        <Route element={<Layout />}>
          <Route path="/"              element={<HomePage />} />
          <Route path="/tasks"         element={<TaskListPage />} />
          <Route path="/tasks/new"      element={<NewTaskPage />} />
          <Route path="/tasks/:id/edit" element={<EditTaskPage />} />
          <Route path="/tasks/:id/run"  element={<ExecutionPage />} />
          <Route path="/remotes"       element={<RemotesPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
