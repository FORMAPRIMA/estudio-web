import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Política de Privacidad · Forma Prima',
  robots: { index: false, follow: false },
}

const h1: React.CSSProperties = { fontSize: 30, fontWeight: 500, letterSpacing: '-.02em', margin: '0 0 8px' }
const h2: React.CSSProperties = { fontSize: 17, fontWeight: 600, margin: '36px 0 10px' }
const p: React.CSSProperties = { fontSize: 14.5, lineHeight: 1.7, color: '#333', margin: '0 0 12px' }
const li: React.CSSProperties = { fontSize: 14.5, lineHeight: 1.7, color: '#333', marginBottom: 6 }
const meta: React.CSSProperties = { fontSize: 12.5, color: '#999', margin: '0 0 4px' }

export default function PrivacidadPage() {
  return (
    <article>
      <h1 style={h1}>Política de Privacidad</h1>
      <p style={meta}>Última actualización: 24 de junio de 2026</p>
      <p style={p}>
        En Forma Prima nos tomamos en serio la protección de tus datos personales. Esta política
        explica qué datos recogemos a través de este sitio web, con qué finalidad, sobre qué base
        jurídica y qué derechos te asisten, conforme al Reglamento (UE) 2016/679 (RGPD) y a la Ley
        Orgánica 3/2018 (LOPDGDD).
      </p>

      <h2 style={h2}>1. Responsable del tratamiento</h2>
      <ul>
        <li style={li}><strong>Titular:</strong> Forma Prima Arquitectos, S.L.</li>
        <li style={li}><strong>NIF:</strong> B44873552</li>
        <li style={li}><strong>Domicilio:</strong> CL/ Ppe de Vergara 56 6ª 2ª, 28006 Madrid (España)</li>
        <li style={li}><strong>Correo electrónico:</strong> contacto@formaprima.es</li>
      </ul>

      <h2 style={h2}>2. Datos que tratamos</h2>
      <p style={p}>
        Cuando completas el formulario de contacto tratamos los datos que nos facilitas: nombre,
        dirección de correo electrónico y, opcionalmente, teléfono, empresa y el contenido del
        mensaje. También conservamos la fecha y el registro de tu consentimiento, así como datos
        técnicos básicos de la conexión (dirección IP) con fines de seguridad y prevención de abuso.
      </p>

      <h2 style={h2}>3. Finalidad del tratamiento</h2>
      <ul>
        <li style={li}>Atender tu solicitud de contacto y responder a tus consultas.</li>
        <li style={li}>Crear y habilitar tu espacio personal de cliente, y enviarte por correo el enlace de acceso.</li>
        <li style={li}>Gestionar la relación precontractual y, en su caso, la prestación de nuestros servicios.</li>
        <li style={li}>Si lo autorizas expresamente, enviarte comunicaciones comerciales sobre nuestros servicios.</li>
      </ul>

      <h2 style={h2}>4. Base jurídica (legitimación)</h2>
      <ul>
        <li style={li}><strong>Tu consentimiento</strong> (art. 6.1.a RGPD), que prestas al marcar la casilla y enviar el formulario.</li>
        <li style={li}><strong>La aplicación de medidas precontractuales</strong> a petición tuya (art. 6.1.b RGPD).</li>
        <li style={li}><strong>El consentimiento específico</strong> para el envío de comunicaciones comerciales, cuando lo otorgues (art. 6.1.a RGPD y art. 21 LSSI).</li>
        <li style={li}><strong>Nuestro interés legítimo</strong> en garantizar la seguridad del sitio (art. 6.1.f RGPD).</li>
      </ul>

      <h2 style={h2}>5. Conservación de los datos</h2>
      <p style={p}>
        Conservaremos tus datos mientras se mantenga la relación o el interés mutuo y no solicites su
        supresión. Si la relación no llega a concretarse, los conservaremos durante el plazo necesario
        para atender posibles responsabilidades y, después, los suprimiremos o anonimizaremos. Los
        datos de consentimiento se conservan como prueba mientras puedan derivarse responsabilidades.
      </p>

      <h2 style={h2}>6. Destinatarios y encargados de tratamiento</h2>
      <p style={p}>
        No cedemos tus datos a terceros, salvo obligación legal. Para prestar el servicio nos apoyamos
        en proveedores tecnológicos que actúan como encargados de tratamiento bajo contrato: Supabase
        (alojamiento de la base de datos), Resend (envío de correo electrónico) y Vercel (alojamiento
        de la aplicación). Algunos de estos proveedores pueden tratar datos fuera del Espacio Económico
        Europeo; en tal caso, las transferencias se amparan en las garantías previstas en el RGPD
        (cláusulas contractuales tipo u otros mecanismos válidos).
      </p>

      <h2 style={h2}>7. Tus derechos</h2>
      <p style={p}>
        Puedes ejercer en cualquier momento tus derechos de acceso, rectificación, supresión,
        oposición, limitación del tratamiento y portabilidad, así como retirar el consentimiento
        prestado, escribiéndonos a <strong>contacto@formaprima.es</strong>, indicando el derecho que
        deseas ejercer. Si consideras que el tratamiento no se ajusta a la normativa, tienes derecho a
        presentar una reclamación ante la Agencia Española de Protección de Datos (www.aepd.es).
      </p>

      <h2 style={h2}>8. Seguridad</h2>
      <p style={p}>
        Aplicamos medidas técnicas y organizativas apropiadas para proteger tus datos frente a accesos
        no autorizados, pérdida o alteración. El acceso a tu espacio de cliente está protegido mediante
        un enlace único y un PIN que tú mismo defines.
      </p>

      <h2 style={h2}>9. Cambios en esta política</h2>
      <p style={p}>
        Podemos actualizar esta política para adaptarla a novedades legislativas o cambios en el
        servicio. Publicaremos cualquier modificación en esta misma página.
      </p>
    </article>
  )
}
