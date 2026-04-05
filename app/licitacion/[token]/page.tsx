import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { marcarPaqueteVisto } from '@/app/actions/fp-licitacion'
import PortalOferta from '@/components/fp-licitacion/PortalOferta'

export const dynamic = 'force-dynamic'

export default async function PortalPage({ params }: { params: { token: string } }) {
  const admin = createAdminClient()

  // Load package by token
  const { data: paquete } = await admin
    .from('fp_paquetes_licitacion')
    .select('*, fp_procesos_licitacion(*, fp_execution_projects(*)), execution_partners(*), fp_ofertas(*)')
    .eq('token', params.token)
    .single()

  if (!paquete) return notFound()

  // Mark as viewed (fire and forget)
  if (paquete.status === 'enviado') {
    await marcarPaqueteVisto(params.token)
  }

  // Generate signed URLs for files
  const scope = paquete.scope as any
  const generalFiles = scope.generalFiles ?? []
  const capitulos = scope.capitulos ?? []

  const signedUrls: Record<string, string> = {}

  const pathsToSign: string[] = [
    ...generalFiles.filter((f: any) => f.path).map((f: any) => f.path),
    ...capitulos.flatMap((c: any) =>
      (c.zonas ?? []).flatMap((z: any) => [z.pdf?.path, z.dwg?.path, z.textFile?.path].filter(Boolean))
    ),
  ]

  if (pathsToSign.length > 0) {
    const { data: signed } = await admin.storage
      .from('fp-licitacion')
      .createSignedUrls(pathsToSign, 60 * 60 * 4) // 4h expiry

    signed?.forEach(s => { if (s.signedUrl && s.path) signedUrls[s.path] = s.signedUrl })
  }

  const proceso = paquete.fp_procesos_licitacion as any
  const project = proceso?.fp_execution_projects as any
  const partner = paquete.execution_partners as any
  const ofertaExistente = Array.isArray(paquete.fp_ofertas) ? paquete.fp_ofertas[0] : paquete.fp_ofertas

  return (
    <PortalOferta
      paqueteId={paquete.id}
      token={params.token}
      status={paquete.status}
      scope={scope}
      signedUrls={signedUrls}
      partner={partner}
      project={project}
      fechaLimite={proceso?.fecha_limite ?? null}
      ofertaExistente={ofertaExistente ?? null}
    />
  )
}
