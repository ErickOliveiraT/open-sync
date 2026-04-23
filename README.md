# OpenSync

A desktop app for scheduled folder synchronization. Define sync tasks, set a schedule, and OpenSync takes care of the rest — even when the app is closed. Powered by [rclone](https://rclone.org/) under the hood.

![Electron](https://img.shields.io/badge/Electron-34-47848F?logo=electron)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)

## Features

- **Sync & Copy tasks** — mirror or copy between local paths and any rclone remote (Google Drive, Dropbox, Box, pCloud, Yandex Disk, Amazon S3, Backblaze B2, Azure Blob, SFTP, FTP, WebDAV, and more)
- **Scheduled execution** — built-in cron builder with OS-level scheduling (crontab on Linux, Task Scheduler on Windows) that runs even when the app is closed
- **Live logs** — real-time output during manual runs; saved logs persist for scheduled runs
- **Filters** — include/exclude rules passed directly to rclone
- **Webhooks** — fire HTTP GET or POST requests on task success or error
- **Remotes manager** — add and delete rclone remotes directly from the UI; OAuth flow supported for Google Drive, Dropbox, Box, pCloud and Yandex
- **Light & dark mode** — toggle between themes, preference is persisted across sessions
- **Collapsible sidebar** — collapse to icon-only mode to save screen space

## Requirements

- [rclone](https://rclone.org/install/) installed and available in `PATH`
- Node.js 18+

## Development

```bash
npm install
npm run dev
```

## Build

```bash
# Preview production build without packaging
npm run build && npm run preview

# Generate installer
npm run dist
```

Output goes to `release/`. Platform targets:

| Platform | Format |
|----------|--------|
| Linux    | AppImage |
| Windows  | NSIS installer |

## Running on Linux

Electron requires sandbox configuration that may not be available in all environments. If the app fails to start, run with:

```bash
./release/OpenSync-*.AppImage --no-sandbox
```

## Data storage

All task configuration and logs are stored in the Electron user data directory:

- **Linux**: `~/.config/OpenSync/`
- **Windows**: `%APPDATA%\OpenSync\`

## Tech stack

- [Electron](https://www.electronjs.org/) — desktop shell
- [React](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) — UI
- [Tailwind CSS](https://tailwindcss.com/) — styling
- [Zustand](https://zustand-demo.pmnd.rs/) — state management
- [Vite](https://vitejs.dev/) + [vite-plugin-electron](https://github.com/electron-vite/vite-plugin-electron) — build tooling
- [rclone](https://rclone.org/) — sync engine
