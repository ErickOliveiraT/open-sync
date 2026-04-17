import { NavLink } from 'react-router-dom'

interface NavItem {
  to: string
  label: string
  icon: string
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Home', icon: '⌂' },
  { to: '/tasks', label: 'Tasks', icon: '⇄' },
  { to: '/remotes', label: 'Remotes', icon: '☁' },
]

export default function Sidebar() {
  return (
    < aside className="flex flex-col w-52 shrink-0 bg-slate-900 border-r border-slate-700 h-screen" >
      {/* Brand */}
      < div className="px-5 py-5 border-b border-slate-700" >
        <span className="text-white font-bold text-lg tracking-tight">OpenSync</span>
        <p className="text-slate-500 text-xs mt-0.5">v.1.0.0</p>
      </div >

      {/* Navigation */}
      < nav className="flex-1 px-3 py-4 space-y-1" >
        {
          NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              <span className="text-base w-5 text-center">{item.icon}</span>
              {item.label}
            </NavLink>
          ))
        }
      </nav >

      {/* Footer */}
      < div className="px-5 py-3 border-t border-slate-700" >
        <p className="text-slate-600 text-xs">
          powered by{' '}
          <a
            href="https://rclone.org/"
            target="_blank"
            rel="noreferrer"
            className="hover:text-slate-400 transition-colors underline underline-offset-2"
          >
            rclone
          </a>
        </p>
      </div >
    </aside >
  )
}
