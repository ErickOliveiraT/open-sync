import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useSyncEvents } from './hooks/useSyncEvents'
import TaskListPage from './pages/TaskListPage'
import NewTaskPage from './pages/NewTaskPage'
import ExecutionPage from './pages/ExecutionPage'

export default function App() {
  // Wire IPC events → Zustand store for the entire app lifetime
  useSyncEvents()

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<TaskListPage />} />
        <Route path="/tasks/new" element={<NewTaskPage />} />
        <Route path="/tasks/:id/run" element={<ExecutionPage />} />
      </Routes>
    </BrowserRouter>
  )
}
