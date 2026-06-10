'use client'

import { useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')

  async function signIn(e: React.FormEvent) {
    e.preventDefault()
    setMessage('')

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setMessage(error.message)
      return
    }

    router.push('/dashboard')
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <form onSubmit={signIn} className="bg-white border rounded-2xl shadow-sm p-6 w-full max-w-md">
        <h1 className="text-3xl font-bold mb-2">Login</h1>
        <p className="text-gray-600 mb-6">Sign in to TimeTracker.</p>

        <input
          className="w-full border rounded-xl p-3 mb-3"
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <input
          className="w-full border rounded-xl p-3 mb-3"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <button className="w-full bg-gray-900 text-white rounded-xl p-3 font-semibold">
          Login
        </button>

        {message && <p className="mt-4 text-red-600">{message}</p>}
      </form>
    </main>
  )
}