'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [formData, setFormData] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
    if (error) setError('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email: formData.email,
      password: formData.password,
    })

    if (authError) {
      setError('Credenciales incorrectas. Verifica tu email y contraseña.')
      setLoading(false)
      return
    }

    if (data.user) {
      // Dejar que el middleware gestione el routing según el rol
      // fp_* → /team, cliente → /area-privada
      window.location.href = '/team'
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-cream px-6">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-16">
          <Link href="/" className="inline-block hover:opacity-70 transition-opacity">
            <img src="/FORMA_PRIMA_NEGRO.png" alt="Forma Prima" style={{ height: 56, width: 'auto' }} />
          </Link>
        </div>

        {/* Form container */}
        <div className="border border-ink/10 p-8 lg:p-12">
          <p className="text-meta text-xs tracking-widest uppercase font-light mb-2 text-center">
            Acceso privado
          </p>
          <h1 className="text-ink font-light text-2xl text-center mb-10">
            Iniciar sesión
          </h1>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="text-xs tracking-widest uppercase font-light text-meta block mb-2">
                Email
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                autoComplete="email"
                className="w-full border border-ink/20 bg-transparent px-4 py-3 text-ink font-light text-sm focus:outline-none focus:border-ink transition-colors"
                placeholder="tu@email.com"
              />
            </div>

            <div>
              <label className="text-xs tracking-widest uppercase font-light text-meta block mb-2">
                Contraseña
              </label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                autoComplete="current-password"
                className="w-full border border-ink/20 bg-transparent px-4 py-3 text-ink font-light text-sm focus:outline-none focus:border-ink transition-colors"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p className="text-xs font-light text-center" style={{ color: '#c0392b' }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-ink text-cream text-xs tracking-widest uppercase font-light py-4 hover:opacity-80 transition-opacity disabled:opacity-50"
            >
              {loading ? 'Verificando...' : 'Ingresar'}
            </button>
          </form>
        </div>

        {/* Back link */}
        <div className="text-center mt-8">
          <Link
            href="/"
            className="text-meta text-xs tracking-widest uppercase font-light hover:text-ink transition-colors"
          >
            ← Volver al sitio
          </Link>
        </div>
      </div>
    </div>
  )
}
