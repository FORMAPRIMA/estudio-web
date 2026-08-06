import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Aviso Legal · Forma Prima',
  robots: { index: false, follow: false },
}

const h1: React.CSSProperties = { fontSize: 30, fontWeight: 500, letterSpacing: '-.02em', margin: '0 0 8px' }
const h2: React.CSSProperties = { fontSize: 17, fontWeight: 600, margin: '36px 0 10px' }
const p: React.CSSProperties = { fontSize: 14.5, lineHeight: 1.7, color: '#333', margin: '0 0 12px' }
const li: React.CSSProperties = { fontSize: 14.5, lineHeight: 1.7, color: '#333', marginBottom: 6 }
const meta: React.CSSProperties = { fontSize: 12.5, color: '#999', margin: '0 0 4px' }

export default function AvisoLegalPage() {
  return (
    <article>
      <h1 style={h1}>Aviso Legal</h1>
      <p style={meta}>Última actualización: 24 de junio de 2026</p>
      <p style={p}>
        En cumplimiento de la Ley 34/2002, de Servicios de la Sociedad de la Información y de Comercio
        Electrónico (LSSI-CE), se facilitan los datos identificativos del titular de este sitio web.
      </p>

      <h2 style={h2}>1. Datos identificativos del titular</h2>
      <ul>
        <li style={li}><strong>Titular:</strong> Forma Prima Arquitectos, S.L.</li>
        {/* NIF XXXX: provisional hasta que Jose pase el de la nueva sociedad. */}
        <li style={li}><strong>NIF:</strong> XXXX</li>
        <li style={li}><strong>Domicilio social:</strong> CL/ Ppe de Vergara 56 6ª 2ª, 28006 Madrid (España)</li>
        <li style={li}><strong>Correo electrónico:</strong> contacto@formaprima.es</li>
      </ul>

      <h2 style={h2}>2. Objeto</h2>
      <p style={p}>
        El presente sitio web tiene por objeto presentar la actividad de Forma Prima, estudio de
        arquitectura y diseño, así como facilitar el contacto con personas interesadas en sus
        servicios. El acceso y uso del sitio atribuye la condición de usuario e implica la aceptación
        de las condiciones recogidas en este Aviso Legal.
      </p>

      <h2 style={h2}>3. Condiciones de uso</h2>
      <p style={p}>
        El usuario se compromete a hacer un uso adecuado y lícito del sitio y de sus contenidos,
        absteniéndose de utilizarlos con fines ilícitos, lesivos de derechos de terceros o que de
        cualquier forma puedan dañar, inutilizar o sobrecargar el sitio o impedir su normal uso.
      </p>

      <h2 style={h2}>4. Propiedad intelectual e industrial</h2>
      <p style={p}>
        Todos los contenidos del sitio (textos, imágenes, marcas, logotipos, diseños y demás
        elementos) son titularidad de Forma Prima Arquitectos, S.L. o de terceros que han autorizado su uso, y
        están protegidos por la normativa de propiedad intelectual e industrial. Queda prohibida su
        reproducción, distribución o transformación sin autorización expresa del titular.
      </p>

      <h2 style={h2}>5. Responsabilidad</h2>
      <p style={p}>
        El titular no se hace responsable de los daños que pudieran derivarse de un uso indebido del
        sitio, ni de las interrupciones, errores u omisiones que pudieran producirse, sin perjuicio de
        adoptar las medidas necesarias para evitarlos.
      </p>

      <h2 style={h2}>6. Protección de datos</h2>
      <p style={p}>
        El tratamiento de los datos personales recabados a través de este sitio se rige por nuestra{' '}
        <a href="/privacidad" style={{ color: '#D85A30', textDecoration: 'none' }}>Política de Privacidad</a>.
      </p>

      <h2 style={h2}>7. Legislación aplicable y jurisdicción</h2>
      <p style={p}>
        Este Aviso Legal se rige por la legislación española. Para la resolución de cualquier
        controversia, las partes se someten a los juzgados y tribunales del domicilio del titular,
        salvo que la normativa aplicable disponga otro fuero imperativo.
      </p>
    </article>
  )
}
