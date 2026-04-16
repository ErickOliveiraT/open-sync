import { create } from 'zustand'
import type { SyncTask, RcloneStats, LogEntry, TaskStatus } from '../types'

interface SyncStore {
  tasks: SyncTask[]
  progress: Record<string, RcloneStats>
  logs: Record<string, LogEntry[]>

  // Task actions
  setTasks: (tasks: SyncTask[]) => void
  addTask: (task: SyncTask) => void
  removeTask: (id: string) => void
  updateTaskStatus: (id: string, status: TaskStatus) => void

  // Progress & log actions
  setProgress: (taskId: string, stats: RcloneStats) => void
  appendLog: (taskId: string, entry: LogEntry) => void
  clearLogs: (taskId: string) => void
}

export const useSyncStore = create<SyncStore>((set) => ({
  tasks: [],
  progress: {},
  logs: {},

  setTasks: (tasks) => set({ tasks }),

  addTask: (task) =>
    set((state) => ({ tasks: [...state.tasks, task] })),

  removeTask: (id) =>
    set((state) => ({ tasks: state.tasks.filter((t) => t.id !== id) })),

  updateTaskStatus: (id, status) =>
    set((state) => ({
      tasks: state.tasks.map((t) => (t.id === id ? { ...t, status } : t)),
    })),

  setProgress: (taskId, stats) =>
    set((state) => ({
      progress: { ...state.progress, [taskId]: stats },
    })),

  appendLog: (taskId, entry) =>
    set((state) => ({
      logs: {
        ...state.logs,
        [taskId]: [...(state.logs[taskId] ?? []), entry],
      },
    })),

  clearLogs: (taskId) =>
    set((state) => ({
      logs: { ...state.logs, [taskId]: [] },
    })),
}))
