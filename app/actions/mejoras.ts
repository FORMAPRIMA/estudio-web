'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

const PATH = '/team/mejoras'

export async function addMejora(data: {
  tipo: 'mejora' | 'bug'
  titulo: string
  descripcion?: string
}): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Sin sesión activa.' }

  const admin = createAdminClient()
  const { error } = await admin.from('mejoras').insert({
    tipo: data.tipo,
    titulo: data.titulo.trim(),
    descripcion: data.descripcion?.trim() || null,
    autor_id: user.id,
    status: 'pendiente',
  })

  if (error) return { error: error.message }
  revalidatePath(PATH)
  return { success: true }
}

export async function updateMejoraStatus(
  id: string,
  status: 'pendiente' | 'en_proceso' | 'implementada' | 'descartada'
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Sin sesión activa.' }

  const { data: profile } = await supabase
    .from('profiles').select('rol').eq('id', user.id).single()
  if (!profile || (profile.rol !== 'fp_manager' && profile.rol !== 'fp_partner')) {
    return { error: 'Sin permisos.' }
  }

  const admin = createAdminClient()

  // If implementing: send personal aviso to the autor
  if (status === 'implementada') {
    const { data: mejora } = await admin
      .from('mejoras').select('titulo, autor_id').eq('id', id).single()

    if (mejora) {
      const today = new Date().toISOString().split('T')[0]
      const caducidad = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      await admin.from('avisos').insert({
        tipo: 'personal',
        nivel: 'informativo',
        autor_id: user.id,
        destinatario_id: mejora.autor_id,
        titulo: '¡Tu petición ha sido implementada!',
        contenido: `Tu petición "${mejora.titulo}" ya está activa en la plataforma. ¡Gracias por contribuir a mejorar Forma Prima!`,
        fecha_activa: today,
        fecha_caducidad: caducidad,
      })
    }
  }

  const { error } = await admin.from('mejoras').update({ status }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath(PATH)
  revalidatePath('/team/dashboard')
  return { success: true }
}

// ── Seed: inserta las peticiones recogidas en reuniones de equipo ─────────────

const SEED_DATA: { tipo: 'mejora' | 'bug'; titulo: string; descripcion: string | null }[] = [
  // Reunión con Gaby
  { tipo: 'mejora', titulo: 'Diferenciar pedidos extras de clientes del trabajo de ejecución', descripcion: 'Separar lo que pide el cliente como extra de lo que realmente nos lleva a ejecutar y terminar el proyecto.' },
  { tipo: 'mejora', titulo: 'Asignar nivel de proyecto (functional, select, masterpiece) con horas', descripcion: 'Poder asignar a cada proyecto un nivel (functional, select, masterpiece) con sus horas respectivas según el nivel.' },
  { tipo: 'mejora', titulo: 'Tasks de extra de cliente: linkear con portal y time tracker', descripcion: 'Cuando un task sea un extra del cliente, que se linkee con el dashboard del cliente (lista de extras) y aparezca en el time tracker bajo el nombre de la propuesta como extra.' },
  { tipo: 'mejora', titulo: 'Mostrar estado de fase en vez de número de fase', descripcion: 'Debajo del título del proyecto mostrar "en fase de diseño" o "en fase de obra" en lugar del número de fase.' },
  { tipo: 'mejora', titulo: 'Botón "Documentación" al lado de "Fases y Tasks"', descripcion: 'Añadir un botón de Documentación junto a Fases y Tasks para renders, planos, etc.' },
  { tipo: 'mejora', titulo: 'Aviso automático a los 20 días para actualizar versión final', descripcion: 'A los 20 días de que se cree un anteproyecto o proyecto ejecutivo/interiorismo, automatizar un aviso para actualizar la versión final.' },
  { tipo: 'bug', titulo: 'Time tracker: recuadro rojo al borrar no debe aparecer ni volver', descripcion: 'Cuando se borra algo en el time tracker no debe salir el recuadro rojo, y una vez borrado no debe volver a aparecer.' },
  { tipo: 'mejora', titulo: 'Documentación: zona privada y pública (pública linkeada con portal cliente)', descripcion: 'En la pestaña de documentación dividir en zona privada y pública. La zona pública se linkea con el portal del cliente.' },
  { tipo: 'mejora', titulo: 'Visitas de obra: GH siempre presente por defecto', descripcion: 'En las visitas de obra, poner siempre por defecto que GH está presente.' },
  { tipo: 'mejora', titulo: 'Actas de obra: texto separado para cliente y constructor', descripcion: 'Dividir las actas de obra: texto para el cliente, texto para el constructor, y vista interna vs vista del cliente.' },
  { tipo: 'mejora', titulo: 'Portal de cliente: todos pueden añadir personas en los tasks', descripcion: 'Que cada persona pueda añadir a todos los miembros del equipo en los tasks del portal de cliente.' },
  // Ari
  { tipo: 'mejora', titulo: 'Agregar renders en los proyectos internos', descripcion: null },
  { tipo: 'mejora', titulo: 'Agregar avisos personales', descripcion: null },
  { tipo: 'mejora', titulo: 'Nueva fase: VIDEO RENDER', descripcion: 'Crear una nueva fase en el catálogo para Video Render.' },
  // Reunión con Costela
  { tipo: 'mejora', titulo: 'Pipeline: incluir horas de interiorismo en el cálculo total', descripcion: 'En las horas del pipeline también hay que sumar las horas de proyecto de interiorismo y gestión de interiorismo.' },
  { tipo: 'mejora', titulo: 'Contratos: nivel de proyecto para generar contrato estándar', descripcion: 'Al crear un contrato, poder seleccionar functional/select/masterpiece para que dé el contrato estándar de ese tipo, editable después.' },
  { tipo: 'bug', titulo: 'BUG: cuadro resumen de honorarios de interiorismo', descripcion: 'Error en el cuadro resumen de honorarios de interiorismo.' },
  { tipo: 'mejora', titulo: 'PDF propuestas y contratos: palazzo en semanas redondeando al alza', descripcion: 'En el PDF de propuestas y contratos, los palazzo de servicios contratados deben presentarse en semanas redondeando al alza.' },
  { tipo: 'mejora', titulo: 'Propuestas de honorarios: enviar siempre al emisor y a partners', descripcion: 'Las propuestas de honorarios siempre deben enviarse por defecto a la persona que lo envió y a partners.' },
  { tipo: 'mejora', titulo: 'Correo de contrato: nombre de persona, no de empresa', descripcion: 'Cuando se envía un contrato, que en el correo aparezca el nombre de la persona y no el de la empresa.' },
  { tipo: 'mejora', titulo: 'Contratos de servicios: solo desde propuestas aceptadas', descripcion: 'En los contratos de servicios, solo se debe poder agregar contratos desde propuestas con status "aceptadas".' },
  { tipo: 'mejora', titulo: 'Archivo histórico dentro de cada propuesta de honorarios', descripcion: 'Crear un archivo histórico dentro de cada propuesta de honorarios.' },
  { tipo: 'mejora', titulo: 'Modal de contratos: verificar retención automática para persona jurídica', descripcion: 'Al escoger persona jurídica en el modal de contratos, verificar si hay que automatizar la retención de las facturas.' },
  { tipo: 'mejora', titulo: 'Portal de cliente: descargar documentos en PDF y Word', descripcion: null },
  { tipo: 'mejora', titulo: 'Footer de contrato: nombres de firmantes', descripcion: 'En el footer del contrato deben aparecer los nombres de los firmantes.' },
  { tipo: 'mejora', titulo: 'Revisar posible integración con DocuSign', descripcion: null },
  { tipo: 'mejora', titulo: 'Time tracker calendario: sábados y domingos en rojo (horas extra)', descripcion: 'En el calendario del time tracker, los sábados y domingos deben estar siempre en color rojo como horas extra.' },
]

export async function seedMejoras(): Promise<{ success: true; count: number } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Sin sesión activa.' }

  const { data: profile } = await supabase
    .from('profiles').select('rol').eq('id', user.id).single()
  if (!profile || profile.rol !== 'fp_partner') return { error: 'Sin permisos.' }

  const admin = createAdminClient()
  const { error } = await admin.from('mejoras').insert(
    SEED_DATA.map(item => ({ ...item, autor_id: user.id, status: 'pendiente' }))
  )

  if (error) return { error: error.message }
  revalidatePath(PATH)
  return { success: true, count: SEED_DATA.length }
}
