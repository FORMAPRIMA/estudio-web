import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

interface ProyectoCliente {
  id: string
  nombre: string
  tipologia: string
  estado: string
  ubicacion: string
  documentos?: { id: string; nombre: string; fecha: string; url: string }[]
}

function estadoLabel(estado: string) {
  switch (estado) {
    case 'activo': return 'En diseño'
    case 'en_construccion': return 'En construcción'
    case 'finalizado': return 'Finalizado'
    default: return estado
  }
}

function estadoColor(estado: string) {
  switch (estado) {
    case 'activo': return 'bg-blue-50 text-blue-700'
    case 'en_construccion': return 'bg-amber-50 text-amber-700'
    case 'finalizado': return 'bg-green-50 text-green-700'
    default: return 'bg-gray-100 text-gray-600'
  }
}

// Mock data for the client dashboard (used when no real DB data)
const mockClientProjects: ProyectoCliente[] = [
  {
    id: '4',
    nombre: 'Apartamento Reforma',
    tipologia: 'Interiorismo',
    estado: 'activo',
    ubicacion: 'Ciudad de México, México',
    documentos: [
      { id: 'd1', nombre: 'Planta Arquitectónica — Rev. 3', fecha: '2024-03-15', url: '#' },
      { id: 'd2', nombre: 'Moodboard de Materiales', fecha: '2024-03-10', url: '#' },
      { id: 'd3', nombre: 'Propuesta Económica', fecha: '2024-02-28', url: '#' },
    ],
  },
]

export default async function AreaPrivadaPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('nombre, email, rol')
    .eq('id', user.id)
    .single()

  if (!profile) {
    redirect('/login')
  }

  // Fetch client's projects (join via clientes table by email)
  const { data: clienteData } = await supabase
    .from('clientes')
    .select('id')
    .eq('email', profile.email)
    .single()

  let proyectos: ProyectoCliente[] = mockClientProjects

  if (clienteData) {
    const { data: proyectosData } = await supabase
      .from('proyectos')
      .select(`
        id,
        nombre,
        tipologia,
        estado,
        ubicacion,
        documentos (
          id,
          nombre,
          fecha,
          url
        )
      `)
      .eq('cliente_id', clienteData.id)

    if (proyectosData && proyectosData.length > 0) {
      proyectos = proyectosData
    }
  }

  return (
    <div className="p-8 lg:p-12">
      {/* Welcome header */}
      <div className="mb-12 pb-8 border-b border-ink/10">
        <p className="text-meta text-xs tracking-widest uppercase font-light mb-2">
          Bienvenido/a
        </p>
        <h1 className="text-ink font-light text-3xl lg:text-4xl">
          {profile.nombre}
        </h1>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-6 mb-12">
        <div className="border border-ink/10 p-6">
          <p className="text-meta text-xs tracking-widest uppercase font-light mb-2">
            Proyectos activos
          </p>
          <p className="text-ink font-light text-3xl">
            {proyectos.filter((p) => p.estado === 'activo').length}
          </p>
        </div>
        <div className="border border-ink/10 p-6">
          <p className="text-meta text-xs tracking-widest uppercase font-light mb-2">
            En construcción
          </p>
          <p className="text-ink font-light text-3xl">
            {proyectos.filter((p) => p.estado === 'en_construccion').length}
          </p>
        </div>
        <div className="border border-ink/10 p-6">
          <p className="text-meta text-xs tracking-widest uppercase font-light mb-2">
            Finalizados
          </p>
          <p className="text-ink font-light text-3xl">
            {proyectos.filter((p) => p.estado === 'finalizado').length}
          </p>
        </div>
      </div>

      {/* Projects list */}
      <div className="mb-12">
        <p className="text-meta text-xs tracking-widest uppercase font-light mb-6">
          Mis proyectos
        </p>

        {proyectos.length === 0 ? (
          <div className="border border-ink/10 p-10 text-center">
            <p className="text-meta font-light text-sm">
              No tienes proyectos activos en este momento.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {proyectos.map((proyecto) => (
              <div key={proyecto.id} className="border border-ink/10">
                {/* Project header */}
                <div className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-ink/10">
                  <div>
                    <h3 className="text-ink font-light text-lg mb-1">{proyecto.nombre}</h3>
                    <div className="flex flex-wrap gap-3 items-center">
                      <span className="text-meta text-xs tracking-widest uppercase font-light">
                        {proyecto.tipologia}
                      </span>
                      <span className="text-meta text-xs">·</span>
                      <span className="text-meta text-xs tracking-widest uppercase font-light">
                        {proyecto.ubicacion}
                      </span>
                    </div>
                  </div>
                  <span
                    className={`text-xs tracking-widest uppercase font-light px-3 py-1 whitespace-nowrap ${estadoColor(proyecto.estado)}`}
                  >
                    {estadoLabel(proyecto.estado)}
                  </span>
                </div>

                {/* Documents */}
                <div className="p-6">
                  <p className="text-meta text-xs tracking-widest uppercase font-light mb-4">
                    Documentos
                  </p>
                  {proyecto.documentos && proyecto.documentos.length > 0 ? (
                    <div className="space-y-2">
                      {proyecto.documentos.map((doc) => (
                        <div
                          key={doc.id}
                          className="flex items-center justify-between py-2 border-b border-ink/5 last:border-0"
                        >
                          <span className="text-ink font-light text-sm">{doc.nombre}</span>
                          <div className="flex items-center gap-4">
                            <span className="text-meta text-xs font-light">
                              {new Date(doc.fecha).toLocaleDateString('es-MX', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </span>
                            <a
                              href={doc.url}
                              className="text-xs tracking-widest uppercase font-light text-ink hover:opacity-60 transition-opacity"
                            >
                              Ver →
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-meta text-sm font-light">
                      No hay documentos disponibles aún.
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Contact section */}
      <div className="bg-dark text-cream p-8">
        <p className="text-meta text-xs tracking-widest uppercase font-light mb-4">
          ¿Tienes alguna pregunta?
        </p>
        <p className="text-cream font-light text-lg mb-6">
          Tu equipo de Forma Prima está disponible para resolver cualquier duda.
        </p>
        <a
          href="mailto:hola@formaprima.mx"
          className="text-xs tracking-widest uppercase font-light text-cream border border-cream/40 px-6 py-3 hover:bg-cream hover:text-dark transition-all duration-300 inline-block"
        >
          Contactar al estudio
        </a>
      </div>
    </div>
  )
}
