'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useUser } from './UserProvider'

const employeeLinksByLang = {
  sv: [
    { href: '/dashboard', label: 'Hem', icon: '🏠' },
    { href: '/history', label: 'Historik', icon: '📋' },
    { href: '/vacation', label: 'Semester', icon: '🌴' },
    { href: '/sick', label: 'Sjuk', icon: '🤒' },
    { href: '/corrections', label: 'Rättelser', icon: '✏️' },
  ],
  uk: [
    { href: '/dashboard', label: 'Дім', icon: '🏠' },
    { href: '/history', label: 'Історія', icon: '📋' },
    { href: '/vacation', label: 'Відпустка', icon: '🌴' },
    { href: '/sick', label: 'Лікарняний', icon: '🤒' },
    { href: '/corrections', label: 'Виправлення', icon: '✏️' },
  ],
}

const adminLinks = [
  { href: '/dashboard', label: 'Hem', icon: '🏠' },
  { href: '/admin', label: 'Admin', icon: '👥' },
  { href: '/history', label: 'Historik', icon: '📋' },
  { href: '/admin/settings', label: 'Inställn.', icon: '⚙️' },
]

export function BottomNav() {
  const pathname = usePathname()
  const { profile } = useUser()
  const lang = (profile?.language ?? 'sv') as 'sv' | 'uk'

  const links = profile?.role === 'admin' ? adminLinks : employeeLinksByLang[lang]

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50">
      <div className="flex">
        {links.map(link => {
          const active = pathname === link.href || (link.href === '/dashboard' && pathname === '/')
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex-1 flex flex-col items-center py-2 text-xs ${
                active ? 'text-blue-700 font-semibold' : 'text-gray-600'
              }`}
            >
              <span className="text-xl mb-0.5">{link.icon}</span>
              {link.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
