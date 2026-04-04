import Link from 'next/link'
import type { Proyecto } from '@/lib/types'

interface ProjectCardProps {
  proyecto: Proyecto
}

export default function ProjectCard({ proyecto }: ProjectCardProps) {
  return (
    <Link href={`/proyectos/${proyecto.slug}`} className="group block">
      {/* Image placeholder */}
      <div className="relative overflow-hidden aspect-[4/3] bg-gray-200 mb-4">
        <div className="absolute inset-0 bg-ink/0 group-hover:bg-ink/30 transition-all duration-500 z-10 flex items-center justify-center">
          <span className="text-cream text-xs tracking-widest uppercase font-light opacity-0 group-hover:opacity-100 transition-opacity duration-300 delay-100">
            Ver proyecto
          </span>
        </div>
        {/* Simulated architectural image texture */}
        <div className="w-full h-full bg-gradient-to-br from-gray-200 via-gray-300 to-gray-200" />
      </div>

      {/* Info */}
      <div>
        <h3 className="text-ink font-light text-base mb-2 group-hover:opacity-60 transition-opacity">
          {proyecto.nombre}
        </h3>
        <div className="flex flex-wrap gap-3 items-center">
          <span className="text-meta text-xs tracking-widest uppercase font-light">
            {proyecto.ubicacion.split(',')[0]}
          </span>
          <span className="text-meta text-xs">·</span>
          <span className="text-meta text-xs tracking-widest uppercase font-light">
            {proyecto.año}
          </span>
          <span className="text-meta text-xs">·</span>
          <span className="text-meta text-xs tracking-widest uppercase font-light">
            {proyecto.tipologia}
          </span>
        </div>
      </div>
    </Link>
  )
}
