import { useState } from 'react'

const INSTALL_INFO: Record<string, { label: string; steps: string[]; url: string }> = {
  linux: {
    label: 'Linux',
    steps: ['sudo -v ; curl https://rclone.org/install.sh | sudo bash'],
    url: 'https://rclone.org/install/#linux',
  },
  darwin: {
    label: 'macOS',
    steps: [
      'brew install rclone',
      'or via script: sudo -v ; curl https://rclone.org/install.sh | sudo bash',
    ],
    url: 'https://rclone.org/install/#macos',
  },
  win32: {
    label: 'Windows',
    steps: [
      'winget install Rclone.Rclone',
      'or download the installer at rclone.org/downloads',
    ],
    url: 'https://rclone.org/install/#windows',
  },
}

interface Props {
  platform: string
  onRetry: () => void
}

export default function RcloneNotFound({ platform, onRetry }: Props) {
  const [checking, setChecking] = useState(false)
  const info = INSTALL_INFO[platform] ?? INSTALL_INFO['linux']

  async function handleRetry() {
    setChecking(true)
    await onRetry()
    setChecking(false)
  }

  return (
    <div className="flex h-screen items-center justify-center bg-slate-100 dark:bg-slate-900 p-8">
      <div className="max-w-lg w-full rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-transparent p-8 space-y-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-500/20">
            <svg className="h-5 w-5 text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-white">rclone not found</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">OpenSync requires rclone to work</p>
          </div>
        </div>

        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
          <span className="font-mono text-slate-800 dark:text-slate-100">rclone</span> is the sync engine powering OpenSync and must
          be installed and available in your terminal before opening the app.
        </p>

        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Installation on {info.label}
          </p>
          <div className="rounded-lg bg-slate-900 p-4 space-y-1.5">
            {info.steps.map((step, i) => (
              <code key={i} className="block text-sm text-green-300 break-all">{step}</code>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            onClick={() => window.electronAPI.openExternal(info.url)}
            className="flex-1 rounded-lg border border-slate-300 dark:border-slate-600 px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            View official documentation
          </button>
          <button
            onClick={handleRetry}
            disabled={checking}
            className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-500 disabled:opacity-50 transition-colors"
          >
            {checking ? 'Checking...' : 'Already installed — check again'}
          </button>
        </div>
      </div>
    </div>
  )
}
