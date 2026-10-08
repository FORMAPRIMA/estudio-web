// Diapositiva del equipo: va justo después de la portada y antes del vídeo de
// las vigas. Foto de grupo en el piso en obra (con el forjado al descubierto,
// que enlaza con el vídeo) y los retratos de cada persona.

const BASE = '/open-house/cc38/equipo'

export const EQUIPO = [
  { nombre: 'José', apellido: 'Lora', foto: 'jose-lora' },
  { nombre: 'Ana Cristina', foto: 'ana-cristina' },
  { nombre: 'Daniel', foto: 'daniel' },
  { nombre: 'Gabriela', foto: 'gabriela' },
  { nombre: 'José Antonio', foto: 'jose-antonio' },
  { nombre: 'Ariana', foto: 'ariana' },
  { nombre: 'Aitana', foto: 'aitana' },
]

export default function SlideEquipo() {
  return (
    <div className="rc-equipo">
      <img className="rc-equipo-fondo" src={`${BASE}/equipo-cc38.jpg`} alt="El equipo de Forma Prima en Claudio Coello 38 durante la obra" />
      <div className="rc-equipo-txt">
        <span className="rc-eyebrow">Forma Prima · Claudio Coello 38</span>
        <h1 className="rc-serif">Las personas<br />detrás de la casa</h1>
        <p>Arquitectos e interioristas que han diseñado, coordinado y seguido cada decisión de este proyecto, de la primera visita a la última pieza.</p>
        <ul className="rc-equipo-retratos">
          {EQUIPO.map((p, i) => (
            <li key={p.foto} style={{ animationDelay: `${0.25 + i * 0.07}s` }}>
              <img src={`${BASE}/${p.foto}.jpg`} alt={p.nombre} loading="eager" />
              <span>{p.nombre}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
