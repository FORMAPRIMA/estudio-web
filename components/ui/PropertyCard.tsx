import Link from 'next/link'
import type { Propiedad } from '@/lib/types'

interface PropertyCardProps {
  propiedad: Propiedad
}

function formatPrice(precio: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(precio)
}

export default function PropertyCard({ propiedad }: PropertyCardProps) {
  return (
    <div className="group">
      {/* Image placeholder */}
      <div className="relative overflow-hidden aspect-[4/3] bg-gray-200 mb-4">
        <div className="w-full h-full bg-gradient-to-br from-gray-100 via-gray-200 to-gray-300" />
        {/* Availability badge */}
        <div className="absolute top-3 left-3">
          <span
            className={`text-xs tracking-widest uppercase font-light px-3 py-1 ${
              propiedad.disponible
                ? 'bg-ink text-cream'
                : 'bg-meta text-cream'
            }`}
          >
            {propiedad.disponible ? 'Disponible' : 'Reservada'}
          </span>
        </div>
      </div>

      {/* Info */}
      <div className="space-y-2">
        <h3 className="text-ink font-light text-base">{propiedad.nombre}</h3>
        <p className="text-meta text-xs tracking-widest uppercase font-light">
          {propiedad.ubicacion}
        </p>
        <p className="text-ink font-light text-lg">{formatPrice(propiedad.precio)}</p>
        <p className="text-meta text-sm font-light leading-relaxed line-clamp-2">
          {propiedad.descripcion}
        </p>
      </div>

      {/* CTA */}
      <div className="mt-4">
        {propiedad.disponible ? (
          <Link
            href={`/real-estate/${propiedad.slug}`}
            className="inline-block text-xs tracking-widest uppercase font-light text-ink border border-ink px-6 py-3 hover:bg-ink hover:text-cream transition-all duration-300"
          >
            Mostrar interés
          </Link>
        ) : (
          <span className="inline-block text-xs tracking-widest uppercase font-light text-meta border border-meta/40 px-6 py-3 cursor-not-allowed">
            No disponible
          </span>
        )}
      </div>
    </div>
  )
}
