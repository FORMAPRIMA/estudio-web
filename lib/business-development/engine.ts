// @ts-nocheck
// Motor de scoring y métricas de Business Development.
// Port fiel de crm-data.js (proyecto de diseño "CRM estratégico Forma Prima").
// STRICTLY CONFIDENTIAL — INTERNAL USE ONLY — PROPIEDAD DE FORMA PRIMA.

// FORMA PRIMA — Strategic BD CRM — seed data & scoring engine
// STRICTLY CONFIDENTIAL — INTERNAL USE ONLY — PROPIEDAD DE FORMA PRIMA
// Datos de empresas: importados del CRM Excel de Forma Prima (confirmados donde constan).
// Scores, hipótesis de valor, pain points y clasificaciones: INFERIDOS por el motor a partir del framework — editables y verificables.

export const SCORE_MAX = {"potencial":25,"fit":20,"valor":15,"acceso":15,"temporalidad":10,"posicionamiento":10,"facilidad":5};
export const SCORE_KEYS = ["potencial","fit","valor","acceso","temporalidad","posicionamiento","facilidad"];
export const SCORE_LABELS = {potencial:'Potencial de negocio',fit:'Fit con el core de Forma Prima',valor:'Valor que Forma Prima aporta',acceso:'Acceso y probabilidad de contacto',temporalidad:'Temporalidad y señales',posicionamiento:'Valor estratégico y posicionamiento',facilidad:'Facilidad y velocidad de activación'};

export const PROFILES = ["Agencias inmobiliarias","Promotoras / Developers","Inversores inmobiliarios","Fondos de inversión","Family Offices","Prescriptores","Instituciones","Otro","Property Finders","Constructoras","Project Managers","Hospitality","Retail","Marcas Premium","Estudios de arquitectura","Estudios de interiorismo","Empresas complementarias","Cliente final"];

export const PIPELINE_STAGES = ["Identificación","Research estratégico","Fit estratégico","Hipótesis de valor","Estrategia de entrada","Listo para contactar","Primer contacto","Follow-up 1","Follow-up 2","Discovery Meeting","Análisis interno","Propuesta personalizada","Negociación","Partnership activo","Oportunidad activa","Pausado","No prioritario","Cerrado sin avance"];

export const TIERS = [
  {tier:1,label:'Tier 1 — Prioridad crítica',min:85,max:100,rec:'Contacto inmediato.'},
  {tier:2,label:'Tier 2 — Alta prioridad',min:70,max:84,rec:'Activar en los próximos 30 días.'},
  {tier:3,label:'Tier 3 — Prioridad media',min:55,max:69,rec:'Nutrir y activar en 30–60 días.'},
  {tier:4,label:'Tier 4 — Baja prioridad',min:40,max:54,rec:'Mantener en observación.'},
  {tier:5,label:'Tier 5 — No prioritario',min:0,max:39,rec:'Sin recursos activos salvo nueva señal.'},
];

export function finalScore(c){
  let base=0; for(const k of SCORE_KEYS) base+=(+c.scores[k]||0);
  const bp=(c.bonuses||[]).reduce((a,x)=>a+(+x.pts||0),0);
  const pp=(c.penalties||[]).reduce((a,x)=>a+(+x.pts||0),0);
  return Math.max(0,Math.min(100, base+bp-pp));
}
export function tierOf(score){ for(const t of TIERS){ if(score>=t.min&&score<=t.max) return t; } return TIERS[4]; }

// Madrid-constructoras strategic exclusion rule.
export function applyEligibility(c, ruleActive){
  const g = c.gov || (c.gov={});
  const isConstructoraMadrid = c.perfilPrincipal==='Constructoras' && /madrid/i.test((c.region||'')+' '+(c.ciudad||'')+' '+(c.zona||''));
  if(ruleActive && isConstructoraMadrid && !g.excepcion){
    g.eligible=false; g.estadoEstrategico='PAUSADO — NO ACTIVAR';
    g.mercadoExcluido='Madrid';
    if(!g.motivoVisible) g.motivoVisible='Decisión interna de enfoque comercial. Revisar antes de activar.';
    if(!g.fechaExclusion) g.fechaExclusion='2026-07-14';
    g.aprobacionReactivar=true;
  } else if(!g.excepcion && isConstructoraMadrid && !ruleActive){
    g.eligible=true; g.estadoEstrategico='Activo'; g.mercadoExcluido='';
  }
  return c;
}

export const COLLAB_MODELS = {"Agencias inmobiliarias":{"modelo":"Referral Partner","incentivo":"3% sobre el presupuesto de reforma contratada y efectivamente cobrada, sujeto a aprobación interna y formalización del acuerdo.","ganaPartner":"Ingreso adicional, mejor servicio al cliente, mayor diferenciación, más posibilidades de cierre y continuidad tras la compraventa con un partner de arquitectura de confianza.","ganaFP":"Acceso a clientes cualificados, flujo recurrente de leads, entrada en el momento de compra/venta y relación con agentes y propietarios.","dondeEntra":"En el momento de captación y venta del activo: anteproyecto, estudio de distribución y visualización del potencial para acelerar la decisión del comprador.","recurrencia":"Alta"},"Promotoras / Developers":{"modelo":"Strategic Partner por proyecto / relación recurrente","incentivo":"Sin comisión de referral como propuesta principal. Honorarios de arquitectura por proyecto + apoyo de preventa.","ganaPartner":"Producto más competitivo, mejor experiencia del comprador, menos cambios, mayor claridad de decisiones y apoyo a preventa y comercialización.","ganaFP":"Proyectos de arquitectura recurrentes, posicionamiento en producto residencial premium y relación de cartera de largo plazo.","dondeEntra":"En la definición de producto y en la comercialización: arquitectura que aumenta el valor percibido y reduce la incertidumbre del desarrollo.","recurrencia":"Alta"},"Inversores inmobiliarios":{"modelo":"Strategic Partner de cartera","incentivo":"Honorarios por proyecto de transformación / reposicionamiento del activo.","ganaPartner":"Revalorización del activo, transformación con criterio y gestión integral que reduce riesgo de ejecución.","ganaFP":"Convertirse en estudio de referencia para futuras adquisiciones y transformaciones de la cartera.","dondeEntra":"En la fase de adquisición y transformación: viabilidad, reposicionamiento y ejecución arquitectónica del activo.","recurrencia":"Media-alta"},"Fondos de inversión":{"modelo":"Strategic Partner de cartera","incentivo":"Honorarios por proyecto de transformación / reposicionamiento del activo.","ganaPartner":"Revalorización y transformación con criterio; gestión integral que reduce riesgo de ejecución.","ganaFP":"Estudio de referencia para futuras adquisiciones y transformaciones de la cartera.","dondeEntra":"Adquisición y transformación de activos: viabilidad, reposicionamiento y ejecución.","recurrencia":"Media"},"Family Offices":{"modelo":"Strategic Partner de cartera","incentivo":"Honorarios por proyecto de transformación / gestión integral del activo.","ganaPartner":"Arquitectura como herramienta de revalorización y gestión integral del patrimonio inmobiliario.","ganaFP":"Estudio de referencia para futuras adquisiciones y transformaciones patrimoniales.","dondeEntra":"Gestión integral del activo patrimonial: transformación, revalorización y ejecución.","recurrencia":"Media"},"Prescriptores":{"modelo":"Referral Partner / colaboración estratégica","incentivo":"A evaluar por proyecto cerrado cuando corresponda; base de colaboración de confianza.","ganaPartner":"Solución de arquitectura de confianza para sus clientes que necesiten reforma, interiorismo u obra nueva.","ganaFP":"Leads cualificados en fase temprana, antes de proyecto, con alta calidad de intención.","dondeEntra":"Antes del proyecto: viabilidad, anteproyecto y visualización cuando su cliente detecta una oportunidad.","recurrencia":"Media-alta"},"Instituciones":{"modelo":"Fuente de inteligencia de mercado (no comercial)","incentivo":"—","ganaPartner":"—","ganaFP":"Detección temprana de zonas en movimiento, licencias y promociones en tramitación.","dondeEntra":"No aplica outreach comercial directo; uso como inteligencia de mercado.","recurrencia":"—"},"Otro":{"modelo":"Fuente de inteligencia / mapeo","incentivo":"—","ganaPartner":"—","ganaFP":"Mapeo de agencias, agentes y activos internacionales recurrentes.","dondeEntra":"No aplica outreach directo; escaparate para identificar partners y activos.","recurrencia":"—"}};




// ============================================================
// EVOLUCIÓN — MÉTRICAS ESTRATÉGICAS, RECORDATORIOS Y WEEKLY UPDATE
// STRICTLY CONFIDENTIAL — INTERNAL USE ONLY
// ============================================================

export const PARTNERSHIP_TYPES = ["Referral Partner","Strategic Partner","Client Opportunity","Developer Partner","Brand Partner","Prescriptor","Institutional","Visibility Partner","Operational Partner","Long-Term Relationship","Other"];
export const EBV_SCALE = ["Muy bajo","Bajo","Medio","Alto","Muy alto"];
export const PTC_SCALE = ["Muy baja","Baja","Media","Alta","Muy alta"];
export const TIMING_SCALE = ["Inmediata","0–30 días","30–60 días","60–90 días","3–6 meses","6–12 meses","Largo plazo","Sin definir"];
export const EFFORT_SCALE = ["Bajo","Medio","Alto"];
export const ROE_SCALE = ["Prioridad inmediata","Alto retorno","Retorno medio","Bajo retorno","No recomendable actualmente"];
export const INTEREST_SCALE = ["Sin señal","Bajo","Medio","Alto"];

const PARTNERSHIP_BY_PROFILE = {
  'Agencias inmobiliarias':'Referral Partner','Promotoras / Developers':'Developer Partner',
  'Inversores inmobiliarios':'Strategic Partner','Fondos de inversión':'Strategic Partner',
  'Family Offices':'Strategic Partner','Prescriptores':'Prescriptor','Instituciones':'Institutional',
  'Otro':'Visibility Partner','Constructoras':'Operational Partner','Project Managers':'Strategic Partner',
  'Marcas Premium':'Brand Partner','Hospitality':'Client Opportunity','Retail':'Client Opportunity',
  'Estudios de arquitectura':'Long-Term Relationship','Estudios de interiorismo':'Long-Term Relationship',
  'Empresas complementarias':'Operational Partner','Cliente final':'Client Opportunity','Property Finders':'Referral Partner',
};
export function partnershipTypeFor(c){ return PARTNERSHIP_BY_PROFILE[c.perfilPrincipal] || 'Other'; }

const STAGE_PROB = {'Partnership activo':4.4,'Oportunidad activa':4.2,'Negociación':4.0,'Propuesta personalizada':3.6,'Análisis interno':3.2,'Discovery Meeting':3.2,'Follow-up 2':2.6,'Follow-up 1':2.6,'Primer contacto':2.5,'Listo para contactar':2.1,'Estrategia de entrada':1.7,'Hipótesis de valor':1.6,'Fit estratégico':1.5,'Research estratégico':1.1,'Identificación':1.0,'Pausado':0.6,'No prioritario':0.5,'Cerrado sin avance':0.4};
const STAGE_TIMING = {'Partnership activo':'Inmediata','Oportunidad activa':'0–30 días','Negociación':'0–30 días','Propuesta personalizada':'0–30 días','Análisis interno':'0–30 días','Discovery Meeting':'0–30 días','Primer contacto':'0–30 días','Follow-up 1':'0–30 días','Follow-up 2':'0–30 días','Listo para contactar':'0–30 días','Estrategia de entrada':'30–60 días','Hipótesis de valor':'30–60 días','Fit estratégico':'30–60 días','Research estratégico':'60–90 días','Identificación':'3–6 meses','Pausado':'Sin definir','No prioritario':'Largo plazo','Cerrado sin avance':'Sin definir'};

// Métricas derivadas (calculadas — se recalculan solas). No sobrescriben datos manuales.
export function deriveMetrics(c){
  const s=c.scores||{};
  const eligible = !(c.gov && c.gov.eligible===false);
  // Expected Business Value
  const evRaw = (+s.potencial||0) + (+s.valor||0)*0.4;   // 0..~31
  const ebv = evRaw>=24?'Muy alto':evRaw>=19?'Alto':evRaw>=13?'Medio':evRaw>=8?'Bajo':'Muy bajo';
  // Probability to convert
  let p = STAGE_PROB[c.pipeline?c.pipeline.estado:'']||1.5;
  const acceso=+s.acceso||0;
  p += acceso>=11?1.1:acceso>=8?0.6:acceso>=5?0.25:0;
  if(c.contacto&&c.contacto.introDisponible) p+=0.5;
  if(c.contacto&&c.contacto.verificado) p+=0.2;
  const interestBoost={'Alto':0.5,'Medio':0.25}[c.interestLevel]||0;
  p+=interestBoost;
  p=Math.max(0,Math.min(5,p));
  const ptc = p>=4.1?'Muy alta':p>=3.1?'Alta':p>=2.1?'Media':p>=1.2?'Baja':'Muy baja';
  // Timing
  let timing = STAGE_TIMING[c.pipeline?c.pipeline.estado:'']||'Sin definir';
  if(c.pipeline&&c.pipeline.fechaProximaAccion){ const d=(new Date(c.pipeline.fechaProximaAccion)-new Date())/86400000; if(!isNaN(d)){ timing = d<=0?'Inmediata':d<=30?'0–30 días':d<=60?'30–60 días':d<=90?'60–90 días':d<=180?'3–6 meses':d<=365?'6–12 meses':'Largo plazo'; } }
  // Effort
  const ease = (acceso/15)*0.6 + ((+s.facilidad||0)/5)*0.4;
  const effort = ease>=0.6?'Bajo':ease>=0.36?'Medio':'Alto';
  // Return on effort
  const vIdx=EBV_SCALE.indexOf(ebv), pIdx=PTC_SCALE.indexOf(ptc), eIdx=EFFORT_SCALE.indexOf(effort);
  let roe;
  if(!eligible) roe='No recomendable actualmente';
  else { const r=vIdx+pIdx-eIdx; roe = r>=6?'Prioridad inmediata':r>=4?'Alto retorno':r>=2?'Retorno medio':r>=0?'Bajo retorno':'No recomendable actualmente'; }
  return {ebv,ptc,timing,effort,roe,partnershipType:c.partnershipType||partnershipTypeFor(c)};
}

const MONTHS={enero:1,febrero:2,marzo:3,abril:4,mayo:5,junio:6,julio:7,agosto:8,septiembre:9,setiembre:9,octubre:10,noviembre:11,diciembre:12};
// Parse "Viernes, 3 julio" / "16 de julio de 2026" / "10/07/2026" → ISO or ''
export function parseLooseDate(txt, defYear){
  if(!txt) return '';
  txt=(''+txt).toLowerCase().trim();
  if(/^\d{4}-\d{2}-\d{2}$/.test(txt)) return txt;
  let m=txt.match(/(\d{1,2})[\/](\d{1,2})[\/](\d{2,4})/);
  if(m){ let y=+m[3]; if(y<100)y+=2000; return y+'-'+String(+m[2]).padStart(2,'0')+'-'+String(+m[1]).padStart(2,'0'); }
  m=txt.match(/(\d{1,2})\s*(?:de\s*)?([a-záéíóú]+)(?:\s*(?:de\s*)?(\d{4}))?/);
  if(m && MONTHS[m[2]]){ const y=m[3]?+m[3]:(defYear||new Date().getFullYear()); return y+'-'+String(MONTHS[m[2]]).padStart(2,'0')+'-'+String(+m[1]).padStart(2,'0'); }
  return '';
}

// Backfill de campos nuevos — idempotente, no destruye datos existentes.
export function ensureFields(c){
  if(c.partnershipType==null) c.partnershipType = partnershipTypeFor(c);
  if(c.interestLevel==null) c.interestLevel = /muy buena relación|interesad|pidió|respondió/i.test((c.pipeline&&c.pipeline.notas)||'')?'Alto':(c.pipeline&&/en seguimiento|contacto activo/i.test(c.pipeline.estado))?'Medio':'Sin señal';
  if(c.thisWeekPin==null) c.thisWeekPin=false;
  if(c.weeklyUpdateSource==null) c.weeklyUpdateSource='';
  if(c.nextReviewDate==null) c.nextReviewDate='';
  if(!c.reminder) c.reminder={status:'',reason:'',by:'',snoozeUntil:''};
  if(c.lastMeaningfulInteraction==null){
    let iso = parseLooseDate(c.pipeline&&c.pipeline.ultimaInteraccion, 2026);
    c.lastMeaningfulInteraction = iso || (c.pipeline&&c.pipeline.fechaIncorporacion) || '2026-07-14';
  }
  if(!c.strategicNotes) c.strategicNotes={
    queDecir:'Arquitectura residencial high-end que mejora el producto inmobiliario y acelera la decisión de compra.',
    queNoDecir:'No presentar Visual Lab ni Portal Cliente como productos independientes: son diferenciadores del servicio de arquitectura.',
    comoPosicionar:'Forma Prima como estudio de arquitectura de referencia, no como proveedor de renders.',
    credencial:'Selected Works de residencial premium + Visual Lab.',
    material:c.pipeline&&c.pipeline.materialEnviado?c.pipeline.materialEnviado:'Dossier Selected Works + one-pager de colaboración por perfil.',
    quienLidera:'', quienSeguimiento:'', resultadoBuscado:'Reunión de descubrimiento y, a medio plazo, un proyecto piloto.',
    riesgos:(c.fit&&c.fit.riesgos)||'', conflictos:(c.fit&&c.fit.conflictos)||'', observaciones:''
  };
  if(!c.playbook){
    const p=c.perfilPrincipal;
    c.playbook={
      thesis:(c.research&&c.research.descripcion)?('Merece tiempo porque '+c.research.descripcion.slice(0,140)).replace(/\s+$/,''):'Definir tesis estratégica.',
      howToWin:'Entrar por su cadena de valor con arquitectura que resuelve un pain concreto; empezar con un piloto de bajo riesgo.',
      firstMeetingGoal:'Validar el encaje y detectar una oportunidad concreta donde la arquitectura aporte valor.',
      firstPilot: p==='Agencias inmobiliarias'?'Un activo en cartera que gane con visualización de potencial (anteproyecto + render).':p==='Promotoras / Developers'?'Una promoción en definición de producto o preventa.':'Un activo o proyecto acotado para validar el encaje.',
      longTermVision:'Relación recurrente donde Forma Prima es el estudio de referencia para sus proyectos residenciales premium.',
      exitCriteria:'Dejar de invertir tiempo si tras 2–3 toques no hay señal de proyecto ni acceso a decisor.',
      nextDecision:(c.pipeline&&c.pipeline.proximaAccion)||'Definir la próxima acción concreta.'
    };
  }
  return c;
}

// Reglas de recordatorios de leads (simples y claras). now = Date. Devuelve reminder o null.
export function leadReminder(c, now){
  if(c.gov && c.gov.eligible===false) return null;
  if(c.reminder && c.reminder.status==='atendido') return null;
  if(c.reminder && c.reminder.snoozeUntil && new Date(c.reminder.snoozeUntil)>now) return null;
  const score=finalScore(c), tier=tierOf(score).tier;
  const est=c.pipeline?c.pipeline.estado:'';
  const last=c.lastMeaningfulInteraction?new Date(c.lastMeaningfulInteraction):null;
  const days=last?Math.floor((now-last)/86400000):null;
  const hasNext=!!(c.pipeline&&c.pipeline.proximaAccion);
  const introUnused=c.contacto&&c.contacto.introDisponible&&['Identificación','Research estratégico','Fit estratégico','Listo para contactar'].includes(est);
  let level=null, reason=null, action=null;
  if(tier<=1 && days!=null && days>=7){ level='Crítico'; reason='Tier 1 sin movimiento '+days+' días'; }
  else if(tier===2 && days!=null && days>=14){ level='Alto'; reason='Tier 2 sin movimiento '+days+' días'; }
  else if(tier===3 && days!=null && days>=30){ level='Medio'; reason='Tier 3 sin movimiento '+days+' días'; }
  if(!level && est==='Discovery Meeting' && days!=null && days>=5){ level='Alto'; reason='Reunión sin follow-up ('+days+' días)'; action='Enviar follow-up con resumen y siguiente paso.'; }
  if(!level && est==='Primer contacto' && days!=null && days>=5){ level='Medio'; reason='Primer contacto sin respuesta ('+days+' días)'; action='Segundo toque por otro canal.'; }
  if(!level && est==='Follow-up 1' && days!=null && days>=10){ level='Medio'; reason='Follow-up pendiente ('+days+' días)'; }
  if(!level && (tier<=2) && !hasNext){ level='Alto'; reason='Empresa de alto valor sin próxima acción'; action='Definir próxima acción concreta.'; }
  if(!level && introUnused){ level='Alto'; reason='Introducción cálida disponible sin utilizar'; action='Activar introducción vía '+(c.contacto.personaIntro||'contacto cálido')+'.'; }
  if(!level && score>=70 && est==='Research estratégico'){ level='Medio'; reason='Score alto todavía en Research'; action='Cerrar research y pasar a estrategia de entrada.'; }
  if(!level && c.interestLevel==='Alto' && days!=null && days>=10){ level='Alto'; reason='Mostró interés y lleva '+days+' días sin actividad'; }
  if(!level && est==='Pausado'){ level='Informativo'; reason='Oportunidad pausada — revisar'; }
  if(!level) return null;
  return {id:c.id, empresa:c.empresa, tier, score, level, reason,
    action: action || (c.pipeline&&c.pipeline.proximaAccion) || 'Retomar contacto con acción concreta.',
    days, responsable:(c.strategicNotes&&c.strategicNotes.quienSeguimiento)||(c.pipeline&&c.pipeline.responsable)||'Sin asignar',
    ptc: deriveMetrics(c).ptc, ebv: deriveMetrics(c).ebv, ultima:c.lastMeaningfulInteraction};
}

// Recomendación estratégica derivada (30s).
export function strategicRecommendation(c){
  const score=finalScore(c), tier=tierOf(score);
  const eligible=!(c.gov&&c.gov.eligible===false);
  const m=deriveMetrics(c);
  const porQueImporta=[];
  if(/Agencias|Promotor|Developer/i.test(c.perfilPrincipal)) porQueImporta.push('Comparte el cliente objetivo de residencial premium.');
  if(m.ebv==='Alto'||m.ebv==='Muy alto') porQueImporta.push('Valor de negocio esperado '+m.ebv.toLowerCase()+'.');
  if(c.fit&&/recurren/i.test(c.fit.recurrencia||'')) porQueImporta.push('Potencial de recurrencia.');
  if(c.contacto&&c.contacto.introDisponible) porQueImporta.push('Existe introducción cálida ('+(c.contacto.personaIntro||'')+').');
  if(c.contacto&&c.contacto.nombre && porQueImporta.length<4) porQueImporta.push('Contacto ya identificado: '+c.contacto.nombre+'.');
  if(!porQueImporta.length) porQueImporta.push((c.research&&c.research.descripcion||'').slice(0,90));
  const porQueAhora = (c.pipeline&&c.pipeline.proximaAccion)?c.pipeline.proximaAccion:(c.research&&c.research.señales)||tier.rec;
  let rec;
  if(!eligible) rec='No activar';
  else if(tier.tier===1) rec='Contactar';
  else if(tier.tier===2) rec='Priorizar';
  else if(tier.tier===3) rec='Nutrir';
  else if(tier.tier===4) rec='Nutrir';
  else rec='Pausar';
  return {
    porQueImporta:porQueImporta.slice(0,4),
    porQueAhora,
    recomendacion:rec,
    riesgo: (c.fit&&c.fit.riesgos)||'No presentar Visual Lab como producto independiente.',
    proximaAccion:(c.pipeline&&c.pipeline.proximaAccion)||'Definir próxima acción concreta.',
    metrics:m, score, tier
  };
}

