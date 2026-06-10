'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useRouter, usePathname } from 'next/navigation'

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    async function checkUser() {
      if (pathname === '/login') {
        setChecking(false)
        return
      }

      const { data } = await supabase.auth.getUser()

      if (!data.user) {
        router.push('/login')
        return
      }

      setChecking(false)
    }

    checkUser()
  }, [pathname, router])

  if (checking) {
    return <div className="p-6">Loading...</div>
  }

  return <>{children}</>
}