import type { Metadata } from 'next'
import { getContent } from '@/app/actions/web-content'
import { ContactoPage } from '@/components/public/site/contacto/ContactoPage'

export const metadata: Metadata = {
  title: 'Contacto',
  description: 'Hablemos de tu proyecto. Estudio de arquitectura e interiorismo en Madrid.',
}

export const dynamic = 'force-dynamic'

export default async function Page() {
  const content = await getContent('contacto')
  return <ContactoPage content={content} />
}
