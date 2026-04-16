import { create } from 'zustand'
import type { SyncTask, RcloneStats, LogEntry, TaskStatus } from '../types'

interface SyncStore {
  tasks: SyncTask[]
  progress: Record<string, RcloneStats>
  logs: Record<string, LogEntry[]>
  commands: Record<string, string>   // taskId → last rclone command string

  // Task actions
  setTasks: (tasks: SyncTask[]) => void
  /** Like setTasks but preserves in-memory runtime status for already-tracked tasks */
  mergeTasks: (tasks: SyncTask[]) => void
  addTask: (task: SyncTask) => void
  removeTask: (id: string) => void
  updateTaskStatus: (id: string, status: TaskStatus) => void

  // Progress, log & command actions
  setProgress: (taskId: string, stats: RcloneStats) => void
  appendLog: (taskId: string, entry: LogEntry) => void
  clearLogs: (taskId: string) => void
  setCommand: (taskId: string, command: string) => void
}

export const useSyncStore = create<SyncStore>((set) => ({
  tasks: [],
  progress: {},
  logs: {},
  commands: {},

  setTasks: (tasks) => set({ tasks }),

  mergeTasks: (loaded) =>
    set((state) => ({
      tasks: loaded.map((t) => {
        const existing = state.tasks.find((s) => s.id === t.id)
        // Keep the runtime status if the task is already tracked
        return existing ? { ...t, status: existing.status } : t
      }),
    })),

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

  setCommand: (taskId, command) =>
    set((state) => ({
      commands: { ...state.commands, [taskId]: command },
    })),
}))
