import { UserProvider } from '@/components/UserProvider'
import { BottomNav } from '@/components/BottomNav'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <UserProvider>
      <div className="max-w-md mx-auto px-4 pt-4 flex justify-end">
        <LanguageSwitcher />
      </div>
      <main className="min-h-screen pb-16">
        {children}
      </main>
      <BottomNav />
    </UserProvider>
  )
}
