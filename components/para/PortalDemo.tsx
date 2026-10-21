'use client'

// Demo del portal de cliente para el dossier de prospección: una obra de EJEMPLO
// que se puede tocar (pestañas, cronograma, documentos, actas y una decisión por
// aprobar). Nada de esto es de un cliente real y lo dice siempre el sello. El
// portal de verdad vive en /portal/[id] (components/portal/ClientPortal.tsx).

import { useEffect, useState } from 'react'
import type { Idioma } from '@/lib/para/textos'
import { useEnPantalla } from './Presentacion'

type Pestana = 'obra' | 'cronograma' | 'documentos' | 'visitas'

const TX = {
  es: {
    sello: 'Demostración · datos de ejemplo', obra: 'Vivienda en Madrid · reforma integral',
    pestanas: { obra: 'Resumen', cronograma: 'Cronograma', documentos: 'Documentos', visitas: 'Visitas' } as Record<Pestana, string>,
    avance: 'Avance de obra', proximo: 'Próximo hito', hito: 'Entrega de carpinterías · 14 nov',
    decision: 'Decisión pendiente', decisionT: 'Piedra del baño principal', decisionD: 'Travertino apomazado, 2 cm. Muestra validada en obra.',
    aprobar: 'Aprobar', aprobado: (h: string) => `Aprobado hoy a las ${h} · queda registrado`, comentar: 'Comentar',
    fases: [['Demoliciones', 1], ['Albañilería', 1], ['Instalaciones', 0.7], ['Carpinterías', 0.2], ['Acabados', 0], ['Mobiliario', 0]] as [string, number][],
    semanas: 'semanas',
    docs: [['Planos de ejecución', 'v3 · 21 láminas', 'Nuevo'], ['Presupuesto de obra', 'v2 · aprobado', ''], ['Memoria de calidades', 'v2', ''], ['Acta de visita 14', '12 oct · PDF', '']] as [string, string, string][],
    verDoc: 'Ver', cerrar: 'Cerrar',
    visitas: [['Visita 14', '12 oct', 'Instalaciones al 70 %. Revisado el trazado de climatización; se adelanta el falso techo del salón.'], ['Visita 13', '5 oct', 'Cerrada la albañilería. Replanteo de carpinterías con el taller.'], ['Visita 12', '28 sep', 'Validada la muestra de tarima en obra.']] as [string, string, string][],
  },
  en: {
    sello: 'Demo · sample data', obra: 'Home in Madrid · full renovation',
    pestanas: { obra: 'Overview', cronograma: 'Schedule', documentos: 'Documents', visitas: 'Site visits' } as Record<Pestana, string>,
    avance: 'Construction progress', proximo: 'Next milestone', hito: 'Joinery delivery · 14 Nov',
    decision: 'Pending decision', decisionT: 'Master bathroom stone', decisionD: 'Honed travertine, 2 cm. Sample approved on site.',
    aprobar: 'Approve', aprobado: (h: string) => `Approved today at ${h} · logged`, comentar: 'Comment',
    fases: [['Demolition', 1], ['Masonry', 1], ['Services', 0.7], ['Joinery', 0.2], ['Finishes', 0], ['Furniture', 0]] as [string, number][],
    semanas: 'weeks',
    docs: [['Construction drawings', 'v3 · 21 sheets', 'New'], ['Construction budget', 'v2 · approved', ''], ['Specifications', 'v2', ''], ['Site report 14', '12 Oct · PDF', '']] as [string, string, string][],
    verDoc: 'View', cerrar: 'Close',
    visitas: [['Visit 14', '12 Oct', 'Services at 70%. HVAC routing reviewed; living room ceiling brought forward.'], ['Visit 13', '5 Oct', 'Masonry complete. Joinery set-out with the workshop.'], ['Visit 12', '28 Sep', 'Timber floor sample approved on site.']] as [string, string, string][],
  },
}

const LAMINA_DOC = ['/para/laminas/cc38-05.webp', '/para/laminas/cc38-14.webp', '/para/laminas/cc38-18.webp', '/para/laminas/cc38-06.webp']

export default function PortalDemo({ idioma, alEvento }: { idioma: Idioma; alEvento: (k: string, d?: string) => void }) {
  const t = TX[idioma]
  const [ref, dentro] = useEnPantalla<HTMLDivElement>('0px')
  const [vista, setVista] = useState(false)
  useEffect(() => { if (dentro) setVista(true) }, [dentro])
  const [p, setP] = useState<Pestana>('obra')
  const [doc, setDoc] = useState<number | null>(null)
  const [aprobado, setAprobado] = useState<string | null>(null)
  const ir = (x: Pestana) => { setP(x); setDoc(null); alEvento('3d', `portal:${x}`) }

  return (
    <div ref={ref} className={`p-pd${vista ? ' vista' : ''}`}>
      <div className="p-pd-barra" aria-hidden><i /><i /><i /><span>portal.formaprima.es</span></div>
      <div className="p-pd-cab">
        <div><b>{t.obra}</b><span className="p-pd-sello">{t.sello}</span></div>
      </div>
      <div className="p-pd-tabs" role="tablist">
        {(Object.keys(t.pestanas) as Pestana[]).map((x) => (
          <button key={x} type="button" role="tab" aria-selected={p === x} className={p === x ? 'on' : ''} onClick={() => ir(x)}>{t.pestanas[x]}</button>
        ))}
      </div>

      <div className="p-pd-cuerpo" data-scroll-propio>
        {p === 'obra' && (
          <div className="p-pd-obra">
            <div className="p-pd-avance">
              <span>{t.avance}</span>
              <b>62 %</b>
              <span className="p-pd-barra-av"><i style={{ width: vista ? '62%' : '0%' }} /></span>
              <span className="p-pd-sub">{t.proximo}: {t.hito}</span>
            </div>
            <div className={`p-pd-decision${aprobado ? ' ok' : ''}`}>
              <span className="p-pd-et">{t.decision}</span>
              <b>{t.decisionT}</b>
              <span className="p-pd-sub">{t.decisionD}</span>
              {aprobado
                ? <span className="p-pd-hecho">✓ {t.aprobado(aprobado)}</span>
                : <span className="p-pd-botones">
                    <button type="button" onClick={() => { setAprobado(new Date().toLocaleTimeString(idioma === 'en' ? 'en-GB' : 'es-ES', { hour: '2-digit', minute: '2-digit' })); alEvento('3d', 'portal:aprobar') }}>{t.aprobar}</button>
                    <button type="button" className="sec">{t.comentar}</button>
                  </span>}
            </div>
          </div>
        )}

        {p === 'cronograma' && (
          <ul className="p-pd-gantt">
            {t.fases.map(([n, k], i) => (
              <li key={n}>
                <span>{n}</span>
                <span className="p-pd-pista">
                  <i style={{ left: `${i * 13}%`, width: `${22 + (i % 2) * 6}%` }}>
                    <em style={{ width: `${k * 100}%`, transitionDelay: `${0.1 + i * 0.12}s` }} />
                  </i>
                </span>
              </li>
            ))}
            <li className="p-pd-eje"><span /><span>{[2, 4, 6, 8, 10, 12, 14].map((s) => <small key={s}>{s}</small>)}</span></li>
          </ul>
        )}

        {p === 'documentos' && (doc == null ? (
          <ul className="p-pd-docs">
            {t.docs.map(([n, v, e], i) => (
              <li key={n}>
                <span className="p-pd-ico" aria-hidden>▤</span>
                <span><b>{n}</b><small>{v}</small></span>
                {e && <span className="p-pd-nuevo">{e}</span>}
                <button type="button" onClick={() => { setDoc(i); alEvento('3d', `portal:doc:${i}`) }}>{t.verDoc}</button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="p-pd-visor">
            <img src={LAMINA_DOC[doc]} alt="" />
            <button type="button" onClick={() => setDoc(null)}>← {t.cerrar}</button>
          </div>
        ))}

        {p === 'visitas' && (
          <ul className="p-pd-visitas">
            {t.visitas.map(([n, f, d], i) => (
              <li key={n}>
                <span className="p-pd-punto" data-primero={i === 0 || undefined} />
                <span><b>{n} <small>· {f}</small></b><p>{d}</p></span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

export const CSS_PORTAL_DEMO = `
.p-pd{position:relative;background:#f8f7f4;color:#1a1a1a;border-radius:12px;overflow:hidden;box-shadow:0 40px 90px -30px rgba(0,0,0,.75),0 0 0 1px rgba(251,251,250,.08);
  font-size:13px;display:flex;flex-direction:column;min-height:420px;opacity:0;transform:translateY(24px) scale(.98);transition:opacity 1.2s var(--p-curva),transform 1.4s var(--p-curva);}
.p-pd.vista{opacity:1;transform:none;}
.p-pd button{font:inherit;cursor:pointer;}
.p-pd-barra{display:flex;align-items:center;gap:6px;padding:10px 14px;background:#ecebe6;border-bottom:1px solid #e2e0d9;}
.p-pd-barra i{width:9px;height:9px;border-radius:50%;background:#d3d0c8;}
.p-pd-barra span{margin-left:10px;flex:1;max-width:260px;background:#f8f7f4;border-radius:6px;padding:4px 10px;font-size:11.5px;color:#1a1a1a99;}
.p-pd-cab{display:flex;justify-content:space-between;align-items:center;padding:16px 18px 6px;}
.p-pd-cab b{display:block;font-size:15px;font-weight:500;}
.p-pd-sello{display:inline-block;margin-top:6px;font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:#8A6220;border:1px solid #8A622055;padding:3px 7px;font-weight:600;}
.p-pd-tabs{display:flex;gap:2px;padding:0 12px;border-bottom:1px solid #e6e2da;overflow-x:auto;scrollbar-width:none;}
.p-pd-tabs::-webkit-scrollbar{display:none;}
.p-pd-tabs button{flex:none;background:none;border:0;padding:11px 10px;margin-bottom:-1px;border-bottom:2px solid transparent;color:#1a1a1a99;font-size:13px;}
.p-pd-tabs button.on{color:#1a1a1a;border-color:#1a1a1a;font-weight:500;}
.p-pd-cuerpo{padding:16px 18px 20px;flex:1;}
.p-pd-obra{display:grid;gap:12px;}
.p-pd-avance,.p-pd-decision{background:#fff;border:1px solid #e6e2da;border-radius:8px;padding:14px 16px;display:flex;flex-direction:column;gap:5px;}
.p-pd-avance b{font-size:30px;font-weight:300;letter-spacing:-.02em;}
.p-pd-avance>span:first-child,.p-pd-et{font-size:10.5px;letter-spacing:.14em;text-transform:uppercase;color:#1a1a1a99;font-weight:600;}
.p-pd-barra-av{display:block;height:6px;background:#f0ede7;border-radius:3px;overflow:hidden;margin:4px 0 2px;}
.p-pd-barra-av i{display:block;height:100%;background:#2f4238;border-radius:3px;transition:width 1.8s var(--p-curva) .3s;}
.p-pd-sub{font-size:12.5px;color:#1a1a1a99;line-height:1.45;}
.p-pd-decision{border-color:#D85A3055;background:#fdf6f2;transition:background .5s,border-color .5s;}
.p-pd-decision .p-pd-et{color:#D85A30;}
.p-pd-decision b{font-size:15px;font-weight:500;}
.p-pd-decision.ok{background:#f1f6f2;border-color:#2f7d5555;}
.p-pd-decision.ok .p-pd-et{color:#2f7d55;}
.p-pd-botones{display:flex;gap:8px;margin-top:8px;}
.p-pd-botones button{min-height:38px;padding:0 16px;border-radius:6px;border:1px solid #1a1a1a;background:#1a1a1a;color:#fff;font-size:12.5px;font-weight:500;}
.p-pd-botones button.sec{background:#fff;color:#1a1a1a;border-color:#e6e2da;}
.p-pd-hecho{margin-top:8px;font-size:12.5px;color:#2f7d55;font-weight:500;animation:p-sube .5s var(--p-curva);}
.p-pd-gantt{list-style:none;margin:0;padding:0;display:grid;gap:10px;}
.p-pd-gantt li{display:grid;grid-template-columns:96px 1fr;gap:10px;align-items:center;font-size:12.5px;}
.p-pd-pista{position:relative;height:16px;background:repeating-linear-gradient(90deg,#f0ede7 0 1px,transparent 1px 14.28%);}
.p-pd-pista i{position:absolute;top:2px;height:12px;background:#e6e2da;border-radius:3px;overflow:hidden;}
.p-pd-pista em{display:block;height:100%;width:0;background:#2f4238;transition:width 1.2s var(--p-curva);}
.p-pd:not(.vista) .p-pd-pista em{width:0!important;}
.p-pd-eje span:last-child{display:flex;justify-content:space-between;color:#1a1a1a66;}
.p-pd-docs,.p-pd-visitas{list-style:none;margin:0;padding:0;}
.p-pd-docs li{display:flex;align-items:center;gap:12px;padding:11px 0;border-top:1px solid #f0ede7;}
.p-pd-docs li:first-child{border-top:0;}
.p-pd-ico{width:32px;height:38px;border:1px solid #e6e2da;border-radius:4px;display:grid;place-items:center;color:#1a1a1a66;background:#fff;}
.p-pd-docs li>span:nth-child(2){flex:1;display:flex;flex-direction:column;gap:2px;}
.p-pd-docs b{font-weight:500;}
.p-pd-docs small{color:#1a1a1a80;font-size:12px;}
.p-pd-nuevo{font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:#D85A30;background:#D85A3014;padding:2px 7px;border-radius:999px;font-weight:600;}
.p-pd-docs button{border:1px solid #e6e2da;background:#fff;border-radius:6px;padding:7px 12px;font-size:12px;}
.p-pd-visor{display:flex;flex-direction:column;gap:10px;animation:p-sube .4s var(--p-curva);}
.p-pd-visor img{width:100%;max-height:260px;object-fit:contain;background:#fff;border:1px solid #e6e2da;}
.p-pd-visor button{align-self:flex-start;background:none;border:0;color:#1a1a1a99;font-size:12.5px;padding:4px 0;}
.p-pd-visitas li{display:grid;grid-template-columns:16px 1fr;gap:10px;padding:10px 0;}
.p-pd-punto{width:9px;height:9px;border-radius:50%;background:#d3d0c8;margin-top:5px;}
.p-pd-punto[data-primero]{background:#2f4238;box-shadow:0 0 0 4px #2f423822;}
.p-pd-visitas b{font-weight:500;}
.p-pd-visitas small{color:#1a1a1a80;font-weight:400;}
.p-pd-visitas p{margin:3px 0 0;color:#1a1a1aa0;font-size:12.5px;line-height:1.5;}
@media (min-width:1024px){.p-pd{min-height:440px;font-size:13.5px;}}
`
