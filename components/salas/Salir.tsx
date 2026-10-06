'use client'

import { useRouter } from 'next/navigation'
import { salirSalas } from '@/app/actions/salas'
import { S } from './theme'

export default function Salir() {
  const router = useRouter()
  return (
    <button
      onClick={async () => { await salirSalas(); router.replace('/'); router.refresh() }}
      style={{ background: 'none', border: 0, padding: 0, fontSize: 12, color: S.soft, cursor: 'pointer', fontFamily: 'inherit' }}
    >
      Salir
    </button>
  )
}
