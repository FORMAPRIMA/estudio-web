'use client'

// Pantalla del PIN. Con la portada del proyecto de fondo: lo primero que ve el
// cliente ya es su casa, no un formulario.

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { desbloquearPropuestaWeb } from '@/app/actions/propuestasWeb'

interface Props {
  slug: string
  nombreCliente: string
  proyecto: string
  portada: string
  /** Por defecto: "Hola, <cliente>." y la paleta oscura de Forma Prima. */
  textos?: { antetitulo: string; titulo: string; texto: string }
  tema?: { fondo: string; tinta: string; acento: string; claro: boolean }
}

const rgba = (hex: string, a: number) => {
  const n = parseInt(hex.replace('#', ''), 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`
}

export default function PropuestaGate({ slug, nombreCliente, proyecto, portada, textos, tema }: Props) {
  const claro = !!tema?.claro
  const vars = tema ? ({
    '--fpg-fondo': tema.fondo, '--fpg-tinta': tema.tinta, '--fpg-acento': tema.acento,
    '--fpg-velo': `linear-gradient(90deg,${rgba(tema.fondo, 0.96)},${rgba(tema.fondo, 0.72)} 50%,${rgba(tema.fondo, 0.2)})`,
    '--fpg-velo-m': `linear-gradient(180deg,${rgba(tema.fondo, 0.5)},${rgba(tema.fondo, 0.78)} 40%,${rgba(tema.fondo, 0.96)})`,
    '--fpg-filtro': 'saturate(.85)', '--fpg-titulo': "'Cormorant Garamond',serif", '--fpg-peso': '500',
  } as React.CSSProperties) : undefined
  const router = useRouter()
  const [pin, setPin] = useState('')
  const [estado, setEstado] = useState<'idle' | 'comprobando' | 'error'>('idle')
  const input = useRef<HTMLInputElement>(null)

  const enviar = async (valor: string) => {
    if (valor.length < 4 || estado === 'comprobando') return
    setEstado('comprobando')
    const r = await desbloquearPropuestaWeb(slug, valor)
    if (r.ok) { router.refresh(); return }
    setEstado('error')
    setPin('')
    input.current?.focus()
  }

  return (
    <main className="fpg" style={vars}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      {tema && <style dangerouslySetInnerHTML={{ __html: `html,body{background:${tema.fondo}!important;}` }} />}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="fpg-fondo" src={portada} alt="" />
      <div className="fpg-velo" />
      <div className="fpg-caja">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={claro ? '/propuestas/logo-fp-negro.png' : '/propuestas/logo-fp.png'} alt="Forma Prima" className="fpg-logo" />
        <div>
          <div className="fpg-eyebrow">{textos?.antetitulo ?? 'Propuesta de honorarios'}</div>
          <h1 className="fpg-h1">{textos?.titulo ?? `Hola, ${nombreCliente}.`}</h1>
          <p className="fpg-p">{textos?.texto ?? `Esta es la propuesta para tu proyecto en ${proyecto}. Introduce el PIN que te hemos enviado para verla.`}</p>
          <form
            className="fpg-form"
            onSubmit={(e) => { e.preventDefault(); enviar(pin) }}
            onClick={() => input.current?.focus()}
          >
            <div className={`fpg-digitos${estado === 'error' ? ' mal' : ''}`} aria-hidden="true">
              {[0, 1, 2, 3].map((k) => (
                <span key={k} className={pin.length === k && estado !== 'comprobando' ? 'cursor' : ''}>{pin[k] ? '•' : ''}</span>
              ))}
            </div>
            <input
              ref={input}
              className="fpg-input"
              value={pin}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, '').slice(0, 4)
                setPin(v)
                if (estado === 'error') setEstado('idle')
                if (v.length === 4) enviar(v)
              }}
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              aria-label="PIN de 4 cifras"
              maxLength={4}
            />
          </form>
          <div className="fpg-estado" role="status">
            {estado === 'comprobando' ? 'Abriendo…' : estado === 'error' ? 'PIN incorrecto. Vuelve a intentarlo.' : ' '}
          </div>
        </div>
        <div className="fpg-pie">
          ¿No tienes el PIN? Escríbenos a <a href="mailto:contacto@formaprima.es">contacto@formaprima.es</a>
        </div>
      </div>
    </main>
  )
}

const CSS = `
html,body{background:#0d0d0d!important;}
.fpg{position:fixed;inset:0;overflow-x:hidden;overflow-y:auto;background:var(--fpg-fondo,#0d0d0d);color:var(--fpg-tinta,#fbfbfa);font-family:'Hanken Grotesk',sans-serif;font-weight:400;line-height:normal;}
.fpg *{box-sizing:border-box;-webkit-font-smoothing:antialiased;}
.fpg-fondo{position:fixed;inset:0;width:100%;height:100%;max-width:none;object-fit:cover;object-position:center 45%;filter:var(--fpg-filtro,saturate(.5) contrast(.96) brightness(.5));animation:fpg-in 2.4s cubic-bezier(.22,1,.36,1) both;}
.fpg-velo{position:fixed;inset:0;background:var(--fpg-velo,linear-gradient(90deg,rgba(13,13,13,.94),rgba(13,13,13,.65) 50%,rgba(13,13,13,.25)));}
.fpg-caja{position:relative;min-height:100%;gap:56px;max-width:760px;padding:clamp(32px,6vw,96px) clamp(24px,6vw,104px);display:flex;flex-direction:column;justify-content:space-between;animation:fpg-sube 1.4s cubic-bezier(.16,1,.3,1) .15s both;}
.fpg-logo{height:24px;width:auto;align-self:flex-start;}
.fpg-eyebrow{font-size:12px;font-weight:600;letter-spacing:.32em;text-transform:uppercase;color:var(--fpg-acento,#8fa596);}
.fpg-h1{margin:28px 0 0;font-family:var(--fpg-titulo,inherit);font-size:clamp(48px,7vw,96px);font-weight:var(--fpg-peso,200);letter-spacing:-.035em;line-height:.98;}
.fpg-p{margin:28px 0 0;max-width:520px;font-size:clamp(17px,1.6vw,21px);font-weight:300;line-height:1.5;opacity:.8;}
.fpg-form{position:relative;margin-top:36px;padding:8px 0 12px;width:max-content;cursor:text;}
.fpg-digitos{display:flex;gap:14px;}
.fpg-digitos span{width:58px;height:70px;border-bottom:1px solid currentColor;display:flex;align-items:center;justify-content:center;font-size:34px;font-weight:300;transition:border-color .3s;}
.fpg-digitos span{border-bottom-color:color-mix(in srgb,currentColor 35%,transparent);}
.fpg-digitos span.cursor{border-bottom-color:var(--fpg-acento,#8fa596);}
.fpg-digitos.mal span{border-bottom-color:#e0a39a;animation:fpg-no .4s;}
.fpg-input{position:absolute;inset:0;opacity:0;font-size:16px;border:0;background:none;color:transparent;caret-color:transparent;}
.fpg-estado{margin-top:18px;font-size:14px;font-weight:300;opacity:.7;min-height:1.4em;}
.fpg-pie{font-size:13px;font-weight:300;opacity:.5;}
.fpg-pie a{color:inherit;text-decoration:underline;text-underline-offset:3px;}
@media (max-width:640px){
  .fpg-velo{background:var(--fpg-velo-m,linear-gradient(180deg,rgba(13,13,13,.55),rgba(13,13,13,.75) 40%,rgba(13,13,13,.95)));}
  .fpg-digitos span{width:52px;height:64px;}
}
@keyframes fpg-in{from{transform:scale(1.06);opacity:0}to{transform:scale(1);opacity:1}}
@keyframes fpg-sube{from{transform:translateY(18px);opacity:0}to{transform:none;opacity:1}}
@keyframes fpg-no{0%,100%{transform:none}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
@media (prefers-reduced-motion:reduce){.fpg-fondo,.fpg-caja,.fpg-digitos.mal span{animation:none}}
`
