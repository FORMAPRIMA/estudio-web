// @ts-nocheck
'use client'
/* Business development — CRM estratégico de partners.
   Port fiel del artifact "CRM estratégico Forma Prima" (proyecto de diseño de Ana),
   restilado a la plataforma internal y con persistencia en Supabase (Server Actions) +
   IA vía /api/business-development/asistente. STRICTLY CONFIDENTIAL — INTERNAL USE ONLY. */
import React from 'react'
import * as XLSX from 'xlsx'
import * as engine from '@/lib/business-development/engine'
import {
  saveCompanies, replaceWeeklyLog, setRule,
  restoreSeed as restoreSeedAction, crearLeadDesdePartner,
} from '@/app/actions/business-development'
import type { BusinessDevelopmentData } from '@/lib/business-development/types'

const FP_CSS = `@keyframes fpspin{to{transform:rotate(360deg)}}
@keyframes fpfade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
@keyframes fpslide{from{transform:translateX(24px);opacity:.4}to{transform:none;opacity:1}}
.fps::-webkit-scrollbar{width:11px;height:11px}
.fps::-webkit-scrollbar-track{background:transparent}
.fps::-webkit-scrollbar-thumb{background:#E2DED5;border:3px solid #F8F7F4;border-radius:8px}
.fps::-webkit-scrollbar-thumb:hover{background:#CFC9BC}`

class BusinessDevelopmentClient extends React.Component<{ initialData: BusinessDevelopmentData }, any> {
  mod = engine;
  C = { bg:'#F8F7F4', panel:'#ffffff', ink:'#1A1A1A', ink2:'#4A463E', ink3:'#8A8172', faint:'#B3AB9C',
        line:'#F0EEE8', line2:'#E2DED5', sidebar:'#1A1A1A',
        accent:'#D85A30', accentD:'#B0491F', accentSoft:'#FDF3EE',
        ok:'#5f7355', okSoft:'#eef1ea', warn:'#b0743a', danger:'#9c4a3c', dangerSoft:'#f5eae7' };
  F = { ui:'inherit', mono:"ui-monospace, 'SF Mono', Menlo, monospace" };
  state = { loading:true, view:'dashboard', selectedId:null, edit:false, draft:null,
            search:'', filters:{perfil:'',tier:'',estado:'',eligible:''}, sort:'score',
            ruleActive:true, adminUnlocked:false, importReport:null, aiBusy:false, toast:null,
            rankTab:'España', addOpen:false,
            wlog:[], weeklyText:'', weeklyPreview:null, weeklyBusy:false, wlogFilters:{empresa:'',tipo:''} };

  componentDidMount(){
    const mod = this.mod;
    const { companies, wlog, config } = this.props.initialData;
    const ruleActive = (config && config.ruleActive!=null) ? config.ruleActive : true;
    const cs = JSON.parse(JSON.stringify(companies||[]));
    cs.forEach(c=>{ mod.ensureFields(c); mod.applyEligibility(c, ruleActive); });
    this.setState({companies:cs, ruleActive, wlog:wlog||[], loading:false});
  }

  persist=(companies,extra)=>{
    this.setState(Object.assign({companies},extra||{}));
    saveCompanies(companies).then(r=>{ if(r&&r.error) this.toast('No se pudo guardar: '+r.error,'danger'); }).catch(()=>{});
    if(extra && Object.prototype.hasOwnProperty.call(extra,'ruleActive')) setRule(!!extra.ruleActive).catch(()=>{});
  };
  saveWlog=(wlog)=>{ this.setState({wlog}); replaceWeeklyLog(wlog).then(r=>{ if(r&&r.error) this.toast('No se pudo guardar el log: '+r.error,'danger'); }).catch(()=>{}); };
  aiComplete=async(prompt)=>{
    const res=await fetch('/api/business-development/asistente',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt})});
    if(!res.ok) throw new Error('IA no disponible ('+res.status+')');
    const j=await res.json(); if(j.error) throw new Error(j.error); return j.texto||'';
  };
  generarLead=(id)=>{
    const c=this.state.companies.find(x=>x.id===id); if(!c)return;
    if(c.pipeline&&c.pipeline.leadGeneradoId){ this.navToLead(c.pipeline.leadGeneradoId); return; }
    crearLeadDesdePartner(id).then(r=>{
      if(r&&r.error){ this.toast('No se pudo generar el lead: '+r.error,'danger'); return; }
      const cs=JSON.parse(JSON.stringify(this.state.companies)); const x=cs.find(y=>y.id===id);
      if(x){ x.pipeline=x.pipeline||{}; x.pipeline.leadGeneradoId=r.leadId;
        x.pipeline.historial=x.pipeline.historial||[];
        x.pipeline.historial.unshift({date:new Date().toISOString().slice(0,10),who:'Sistema',text:'Lead generado en Captación desde Business development.'}); }
      this.setState({companies:cs});
      this.toast(r.alreadyExisted?'Ya existía un lead para este partner':'Lead creado en Captación ✓');
    }).catch(e=>this.toast('Error: '+e.message,'danger'));
  };
  navToLead=(leadId)=>{ try{ window.location.href='/team/captacion/leads'; }catch(e){} };
  now=()=>new Date();
  toast=(msg,kind)=>{ this.setState({toast:{msg,kind:kind||'ok'}}); clearTimeout(this._t); this._t=setTimeout(()=>this.setState({toast:null}),3400); };
  navTo=(view)=>this.setState({view,selectedId:null,edit:false});
  fmtDate=(d)=>d||'—';

  enrich(){
    const m=this.mod, list=(this.state.companies||[]).map(c=>{const s=m.finalScore(c);const mx=m.deriveMetrics(c);return Object.assign({},c,{_score:s,_tier:m.tierOf(s).tier,_m:mx});});
    const active=list.filter(c=>c.gov&&c.gov.eligible!==false)
      .sort((a,b)=> b._score-a._score || (b.scores.acceso-a.scores.acceso) || (b.scores.temporalidad-a.scores.temporalidad) || (b.scores.facilidad-a.scores.facilidad));
    active.forEach((c,i)=>c._rankGlobal=i+1);
    const byPais={}; active.forEach(c=>{(byPais[c.pais]=byPais[c.pais]||[]).push(c);});
    Object.values(byPais).forEach(a=>a.forEach((c,i)=>c._rankPais=i+1));
    return {all:list, active};
  }
  daysNoMove(c){ if(!c.lastMeaningfulInteraction)return null; const d=Math.floor((this.now()-new Date(c.lastMeaningfulInteraction))/86400000); return isNaN(d)?null:d; }
  reminders(){ const now=this.now(); const order={'Crítico':0,'Alto':1,'Medio':2,'Informativo':3};
    return (this._e.all).map(c=>this.mod.leadReminder(c,now)).filter(Boolean)
      .sort((a,b)=>(order[a.level]-order[b.level])||(b.score-a.score)); }
  // This Week Priorities: eligibles, scored by tier + ROE + PTC + timing + reminder + manual pin.
  thisWeekPriorities(){ const roeW={'Prioridad inmediata':4,'Alto retorno':3,'Retorno medio':2,'Bajo retorno':1,'No recomendable actualmente':0};
    const ptcW={'Muy alta':4,'Alta':3,'Media':2,'Baja':1,'Muy baja':0};
    const timW={'Inmediata':4,'0–30 días':3,'30–60 días':1.5,'60–90 días':1,'3–6 meses':.5,'6–12 meses':.2,'Largo plazo':0,'Sin definir':0};
    const rem={}; this.reminders().forEach(r=>rem[r.id]=r.level);
    const remW={'Crítico':4,'Alto':3,'Medio':1.5,'Informativo':.5};
    const scored=this._e.active.filter(c=>!['Cerrado sin avance','Pausado','No prioritario'].includes(c.pipeline.estado)).map(c=>{
      let w=(6-c._tier)*2 + (roeW[c._m.roe]||0) + (ptcW[c._m.ptc]||0)*0.8 + (timW[c._m.timing]||0) + (remW[rem[c.id]]||0) + (c.thisWeekPin?100:0);
      return {c,w}; });
    scored.sort((a,b)=>b.w-a.w);
    return scored.slice(0,Math.max(5,Math.min(10, scored.filter(x=>x.w>=8).length||8))).map(x=>x.c);
  }
  pendingDecisions(){ const out=[];
    this._e.all.forEach(c=>{
      if(c.gov&&c.gov.clasificacionPendiente) out.push({empresa:c.empresa,id:c.id,text:'Validar clasificación de '+c.empresa+' (promoción vs. construcción) antes de activar.'});
      if(c.contacto&&c.contacto.introDisponible&&c.gov.eligible!==false&&['Identificación','Research estratégico','Fit estratégico','Listo para contactar'].includes(c.pipeline.estado)) out.push({empresa:c.empresa,id:c.id,text:'Decidir quién activa la introducción cálida a '+c.empresa+' ('+(c.contacto.personaIntro||'')+').'});
      if(c._tier<=2 && c.gov.eligible!==false && !c.contacto.verificado) out.push({empresa:c.empresa,id:c.id,text:'Verificar contacto/decisor de '+c.empresa+' (Tier alto sin verificar).'});
    });
    return out.slice(0,6);
  }
  smartAlerts(){ const now=this.now(); const out=[];
    this._e.active.forEach(c=>{
      const p=c.pipeline;
      if(p.fechaProximaAccion){const d=new Date(p.fechaProximaAccion); if(!isNaN(d)&&d<now) out.push({id:c.id,k:'danger',t:c.empresa+': próxima acción vencida'});}
      if(['Discovery Meeting','Negociación','Propuesta personalizada'].includes(p.estado)&&!p.materialEnviado) out.push({id:c.id,k:'warn',t:c.empresa+': reunión/propuesta próxima sin material preparado'});
      if(c._tier<=2&&!c.contacto.nombre) out.push({id:c.id,k:'warn',t:c.empresa+': alto valor sin decisor identificado'});
      if(c._tier<=2&&!p.proximaAccion) out.push({id:c.id,k:'warn',t:c.empresa+': sin próxima acción definida'});
    });
    this.state.wlog.filter(w=>w.status==='pendiente').forEach(w=>out.push({id:w.empresaId,k:'muted',t:'Actualización semanal pendiente de confirmar: '+w.empresa}));
    return out.slice(0,8);
  }

  // ---- alerts ----
  alertsFor(c){
    const a=[]; const p=c.pipeline||{};
    if(c.gov&&c.gov.clasificacionPendiente) a.push({k:'warn',t:'Clasificación pendiente de revisión'});
    if(p.estado==='Research estratégico') a.push({k:'warn',t:'En research — completar y priorizar'});
    if(c.contacto&&!c.contacto.verificado&&c._tier<=2) a.push({k:'warn',t:'Datos de contacto sin verificar (Tier alto)'});
    if(!c.contacto||!c.contacto.nombre) a.push({k:'muted',t:'Sin contacto/decisor identificado'});
    if(c.research&&c.research.nivelConfianza==='Baja') a.push({k:'muted',t:'Research de baja confianza'});
    if(p.fechaProximaAccion){ const d=new Date(p.fechaProximaAccion); if(!isNaN(d)&&d<new Date()) a.push({k:'danger',t:'Próxima acción vencida'}); }
    return a;
  }

  h(...a){ return React.createElement(...a); }

  // ================= NAV =================
  renderNav(){
    const {C,F}=this, e=this._e, h=this.h.bind(this);
    const all=e.all, act=e.active;
    const nEs=all.filter(c=>c.pais==='España').length, nEc=all.filter(c=>c.pais==='Ecuador').length, nMx=all.filter(c=>c.pais==='México').length;
    const nResearch=all.filter(c=>(c.research&&c.research.nivelConfianza==='Baja')||(c.gov&&c.gov.clasificacionPendiente)||(c.contacto&&!c.contacto.verificado)).length;
    const nAct=act.filter(c=>!['Partnership activo','Cerrado sin avance','Oportunidad activa'].includes(c.pipeline.estado)).length;
    const nRem=this.reminders().length, nWpend=this.state.wlog.filter(w=>w.status==='pendiente').length;
    const groups=[
      {g:'PANEL',items:[['dashboard','Executive Dashboard',null]]},
      {g:'OPERACIÓN SEMANAL',items:[['weekly','Weekly Update',nWpend||null],['wlog','Weekly Update Log',this.state.wlog.length||null],['reminders','Lead Reminders',nRem||null]]},
      {g:'MERCADOS',items:[['es','España',nEs],['ec','Ecuador',nEc],['mx','México',nMx],['master','Master CRM',all.length]]},
      {g:'INTELIGENCIA',items:[['ranking','Priority Ranking',act.length],['pipeline','Pipeline',null],['research','Research Queue',nResearch],['partners','Partner Profiles',null]]},
      {g:'ACCIÓN',items:[['actions','Action Center',nAct]]},
      {g:'SISTEMA',items:[['data','Import / Export',null],['admin','Admin & Reglas',null]]},
    ];
    return h('div',{key:'nav'}, groups.map(gr=>h('div',{key:gr.g,style:{padding:'10px 0 2px'}},
      h('div',{style:{fontSize:9,letterSpacing:'.26em',color:C.ink3,fontWeight:700,padding:'0 22px 7px'}},gr.g),
      gr.items.map(([id,label,cnt])=>{
        const on=this.state.view===id;
        return h('button',{key:id,onClick:()=>this.navTo(id),style:{width:'100%',display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,padding:'8px 22px',background:on?C.accentSoft:'transparent',border:'none',borderLeft:on?'3px solid '+C.accent:'3px solid transparent',color:on?C.ink:C.ink3,textAlign:'left',fontSize:12.5,fontWeight:on?600:400,letterSpacing:'.01em',transition:'background .12s'}},
          h('span',null,label),
          cnt!=null?h('span',{style:{fontFamily:F.mono,fontSize:10.5,color:on?C.accent:C.faint,fontWeight:500}},cnt):null);
      })
    )));
  }

  // ================= TOPBAR =================
  viewMeta(){
    const m={dashboard:['Executive Dashboard','Visión estratégica consolidada de Business Development'],
      es:['España','Red de partners — mercado España'],ec:['Ecuador','Red de partners — mercado Ecuador'],
      mx:['México','Red de partners — mercado México'],master:['Master CRM','Vista consolidada de todos los mercados'],
      ranking:['Priority Ranking','Ranking activo por Strategic Priority Score'],pipeline:['Pipeline','Estado comercial por etapa'],
      research:['Research Queue','Empresas pendientes de investigación o verificación'],partners:['Partner Profiles','Agrupación por tipología de partner'],
      actions:['Action Center','Acciones priorizadas por impacto y urgencia'],data:['Import / Export','Importar, limpiar y exportar el CRM'],
      admin:['Admin & Reglas','Gobernanza estratégica y reglas de elegibilidad'],
      weekly:['Weekly Update','Actualiza el CRM escribiendo en lenguaje natural — sin volver a importar'],
      wlog:['Weekly Update Log','Historial de actualizaciones semanales con opción de deshacer'],
      reminders:['Lead Reminders','Leads valiosos sin movimiento que requieren atención']};
    return m[this.state.view]||['',''];
  }
  renderTopbar(){
    const {C,F}=this, h=this.h.bind(this), [title,sub]=this.viewMeta();
    const searchViews=['es','ec','mx','master','ranking','research','partners','actions'];
    const btn=(label,on,extra)=>h('button',{onClick:on,style:Object.assign({padding:'8px 14px',fontSize:11.5,fontWeight:600,letterSpacing:'.02em',border:'1px solid '+C.line2,background:C.panel,color:C.ink2,borderRadius:2,whiteSpace:'nowrap'},extra||{})},label);
    return h('div',{key:'tb',style:{background:C.bg,borderBottom:'1px solid '+C.line,padding:'16px 30px 15px',display:'flex',alignItems:'flex-end',justifyContent:'space-between',gap:20}},
      h('div',null,
        h('h1',{style:{margin:0,fontSize:23,fontWeight:600,letterSpacing:'-.01em',color:C.ink}},title),
        h('div',{style:{fontSize:12,color:C.ink3,marginTop:3}},sub)),
      h('div',{style:{display:'flex',alignItems:'center',gap:10}},
        searchViews.includes(this.state.view)?h('div',{style:{position:'relative'}},
          h('input',{key:'search',value:this.state.search,placeholder:'Buscar empresa, zona, contacto…',onChange:ev=>this.setState({search:ev.target.value}),
            style:{width:230,padding:'8px 12px 8px 30px',fontSize:12,border:'1px solid '+C.line2,borderRadius:2,background:C.panel,outline:'none'}}),
          h('span',{style:{position:'absolute',left:10,top:8,color:C.faint,fontSize:13}},'⌕')):null,
        btn('+ Empresa',()=>this.setState({addOpen:true}),{background:C.ink,color:'#fff',border:'1px solid '+C.ink}),
        btn('↻ Recalcular',()=>{this.recalc();}),
        btn('↓ Exportar',()=>this.navTo('data')),
        h('div',{style:{marginLeft:4,padding:'6px 10px',border:'1px solid '+C.dangerSoft,background:C.dangerSoft,borderRadius:2,fontSize:8.5,letterSpacing:'.12em',color:C.danger,fontWeight:600,lineHeight:1.35,textAlign:'center'}},'STRICTLY CONFIDENTIAL',h('br'),'INTERNAL USE ONLY')));
  }
  recalc=()=>{ const c=JSON.parse(JSON.stringify(this.state.companies)); c.forEach(x=>this.mod.applyEligibility(x,this.state.ruleActive)); this.persist(c); this.toast('Ranking recalculado · elegibilidad reaplicada'); };

  // ---- shared UI atoms ----
  card(children,extra){ const {C}=this; return this.h('div',{style:Object.assign({background:C.panel,border:'1px solid '+C.line,borderRadius:3},extra||{})},children); }
  tag(text,color,bg,extra){ const {C}=this; return this.h('span',{style:Object.assign({display:'inline-block',padding:'2px 8px',fontSize:10,fontWeight:600,letterSpacing:'.03em',color:color,background:bg||'transparent',border:'1px solid '+(color+'44'),borderRadius:2,whiteSpace:'nowrap'},extra||{})},text); }
  tierChip(t){ const {C,F}=this; const map={1:C.accent,2:C.accentD,3:C.ink2,4:C.ink3,5:C.faint}; const col=map[t]||C.ink3;
    return this.h('span',{style:{display:'inline-flex',alignItems:'center',gap:5,fontFamily:F.mono,fontSize:10.5,fontWeight:500,color:col}},this.h('span',{style:{width:7,height:7,borderRadius:'50%',background:col}}),'T'+t); }
  scoreNum(s,big){ const {C,F}=this; const col=s>=85?C.accent:s>=70?C.accentD:s>=55?C.ink2:C.ink3;
    return this.h('span',{style:{fontFamily:F.mono,fontWeight:500,fontSize:big?26:14,color:col,letterSpacing:'-.02em'}},s); }
  provBadge(kind){ const {C}=this; const m={confirmado:['Confirmado',C.ok],publico:['Público',C.ink3],inferido:['Inferido',C.accent],'inferido-ia':['Inferido · IA',C.accent],manual:['Manual',C.ink2],pendiente:['Pendiente',C.danger]}; const [l,c]=m[kind]||m.pendiente;
    return this.h('span',{title:'Origen del dato',style:{fontSize:8.5,letterSpacing:'.08em',fontWeight:600,color:c,border:'1px solid '+c+'55',padding:'1px 5px',borderRadius:2,whiteSpace:'nowrap'}},l.toUpperCase()); }
  eligPill(c){ const {C}=this; const ok=c.gov&&c.gov.eligible!==false;
    return this.tag(ok?'Elegible':'No elegible', ok?C.ok:C.danger, ok?C.okSoft:C.dangerSoft); }

  // ================= DASHBOARD =================
  viewDashboard(){
    const {C,F}=this, h=this.h.bind(this), e=this._e, all=e.all, act=e.active;
    const byPais=p=>all.filter(c=>c.pais===p).length;
    const tierCount=t=>act.filter(c=>c._tier===t).length;
    const nElig=all.filter(c=>c.gov.eligible!==false).length;
    const listo=act.filter(c=>c.pipeline.estado==='Listo para contactar').length;
    const sinContacto=all.filter(c=>!c.contacto.nombre).length;
    const research=all.filter(c=>c.research.nivelConfianza==='Baja'||c.gov.clasificacionPendiente).length;
    const activos=all.filter(c=>c.pipeline.estado==='Partnership activo').length;
    const oport=all.filter(c=>['Oportunidad activa','Discovery Meeting','Propuesta personalizada','Negociación'].includes(c.pipeline.estado)).length;
    const stat=(label,val,sub,accent)=>h('div',{style:{flex:'1 1 150px',padding:'16px 18px',background:C.panel,border:'1px solid '+C.line,borderRadius:3}},
      h('div',{style:{fontSize:10,letterSpacing:'.14em',color:C.ink3,fontWeight:600,textTransform:'uppercase'}},label),
      h('div',{style:{fontFamily:F.mono,fontSize:30,fontWeight:500,color:accent||C.ink,marginTop:8,letterSpacing:'-.02em'}},val),
      sub?h('div',{style:{fontSize:11,color:C.ink3,marginTop:2}},sub):null);
    const secTitle=t=>h('div',{style:{fontSize:11,letterSpacing:'.16em',color:C.ink3,fontWeight:600,margin:'4px 0 12px',textTransform:'uppercase'}},t);
    const topList=(arr,showPais)=>h('div',{style:{display:'flex',flexDirection:'column'}}, arr.map((c,i)=>h('button',{key:c.id,onClick:()=>this.openFicha(c.id),style:{display:'flex',alignItems:'center',gap:12,padding:'9px 4px',border:'none',borderBottom:'1px solid '+C.line,background:'transparent',textAlign:'left',width:'100%'}},
      h('span',{style:{fontFamily:F.mono,fontSize:11,color:C.faint,width:18}},String(i+1).padStart(2,'0')),
      h('span',{style:{flex:1,fontSize:13,fontWeight:500,color:C.ink,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}},c.empresa),
      showPais?h('span',{style:{fontSize:10.5,color:C.ink3,width:64,textAlign:'right'}},c.perfilPrincipal.split(' ')[0]):null,
      this.tierChip(c._tier), this.scoreNum(c._score))));
    // pipeline distribution
    const stages=this.mod.PIPELINE_STAGES.filter(s=>all.some(c=>c.pipeline.estado===s));
    const maxStage=Math.max(1,...stages.map(s=>all.filter(c=>c.pipeline.estado===s).length));
    // profile distribution
    const profs={}; all.forEach(c=>profs[c.perfilPrincipal]=(profs[c.perfilPrincipal]||0)+1);
    const profArr=Object.entries(profs).sort((a,b)=>b[1]-a[1]);
    const maxProf=Math.max(...profArr.map(p=>p[1]));
    const secBig=(t,sub,extra)=>h('div',{style:{display:'flex',alignItems:'baseline',justifyContent:'space-between',margin:(extra&&extra.mt||'30')+'px 0 13px'}},
      h('div',null,h('div',{style:{fontSize:16,fontWeight:600,color:C.ink,letterSpacing:'-.01em'}},t),sub?h('div',{style:{fontSize:11.5,color:C.ink3,marginTop:2}},sub):null),
      extra&&extra.link?h('button',{onClick:extra.link,style:{border:'none',background:'transparent',color:C.accent,fontSize:11.5,fontWeight:600,cursor:'pointer'}},extra.linkLabel||'Ver todo →'):null);
    const twp=this.thisWeekPriorities();
    const rems=this.reminders();
    const alerts=this.smartAlerts();
    const decisions=this.pendingDecisions();
    const recent=this.state.wlog.slice(0,5);
    const topOpp=act.slice().sort((a,b)=>{const w={'Prioridad inmediata':4,'Alto retorno':3,'Retorno medio':2,'Bajo retorno':1,'No recomendable actualmente':0};return (w[b._m.roe]-w[a._m.roe])||(b._score-a._score);}).slice(0,6);
    const lvlCol={'Crítico':C.danger,'Alto':C.warn,'Medio':C.ink2,'Informativo':C.ink3};
    const twpCard=(c)=>{const rec=this.mod.strategicRecommendation(c); const notes=c.strategicNotes||{};
      return h('div',{key:c.id,style:{background:C.panel,border:'1px solid '+C.line,borderLeft:'3px solid '+(c._tier===1?C.accent:c._tier===2?C.accentD:C.line2),borderRadius:3,padding:'15px 17px',display:'flex',flexDirection:'column',gap:9}},
        h('div',{style:{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:10}},
          h('button',{onClick:()=>this.openFicha(c.id),style:{border:'none',background:'transparent',padding:0,textAlign:'left',cursor:'pointer'}},
            h('div',{style:{fontSize:15,fontWeight:600,color:C.ink}},c.empresa),
            h('div',{style:{marginTop:4,display:'flex',gap:6,alignItems:'center',flexWrap:'wrap'}},this.tierChip(c._tier),this.ptBadge(c._m.partnershipType))),
          this.scoreNum(c._score,true)),
        h('div',{style:{display:'flex',gap:'4px 14px',flexWrap:'wrap',fontSize:10.5,color:C.ink3}},
          h('span',null,'EBV: ',h('b',{style:{color:C.ink2}},c._m.ebv)),h('span',null,'PTC: ',h('b',{style:{color:C.ink2}},c._m.ptc)),h('span',null,'Timing: ',h('b',{style:{color:C.ink2}},c._m.timing))),
        h('div',{style:{fontSize:12.5,color:C.ink,fontWeight:500,lineHeight:1.4}},'→ '+rec.proximaAccion),
        h('div',{style:{fontSize:11,color:C.ink2,lineHeight:1.6,borderTop:'1px solid '+C.line,paddingTop:8}},
          h('div',null,h('span',{style:{color:C.ink3}},'Responsable: '),notes.quienLidera||c.pipeline.responsable||'Sin asignar'),
          h('div',null,h('span',{style:{color:C.ink3}},'Material: '),notes.material||'Selected Works'),
          h('div',{style:{color:C.warn}},h('span',{style:{color:C.ink3}},'Riesgo: '),rec.riesgo)));
    };
    return h('div',{key:'dash',style:{padding:'22px 30px 60px',animation:'fpfade .3s'}},
      secBig('This Week Priorities','Entre 5 y 10 focos accionables de la semana, priorizados por Tier, retorno y señales.',{mt:2}),
      (twp.length
        ? h('div',{style:{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))',gap:12}}, twp.map(twpCard))
        : this.card(h('div',{style:{padding:26,textAlign:'center',color:C.faint,fontSize:12.5}},'Sin prioridades activas esta semana.'))),
      h('div',{style:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginTop:16,alignItems:'start'}},
        this.card(h('div',{style:{padding:'16px 18px'}},
          h('div',{style:{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:10}},
            secTitle('Lead Reminders'),
            h('button',{onClick:()=>this.navTo('reminders'),style:{border:'none',background:'transparent',color:C.accent,fontSize:11,fontWeight:600,cursor:'pointer'}},'Ver todos ('+rems.length+') →')),
          (rems.length
            ? rems.slice(0,5).map(r=>h('button',{key:r.id,onClick:()=>this.openFicha(r.id),style:{display:'flex',alignItems:'center',gap:10,width:'100%',textAlign:'left',border:'none',borderBottom:'1px solid '+C.line,background:'transparent',padding:'8px 0'}},
                h('span',{style:{width:7,height:7,borderRadius:'50%',background:lvlCol[r.level],flex:'none'}}),
                h('span',{style:{flex:1,fontSize:12.5,fontWeight:500,color:C.ink}},r.empresa,h('span',{style:{fontSize:10.5,color:C.ink3,fontWeight:400}},' — '+r.reason)),
                this.tierChip(r.tier)))
            : h('div',{style:{fontSize:12,color:C.faint,padding:'10px 0'}},'Sin recordatorios pendientes.')))),
        this.card(h('div',{style:{padding:'16px 18px'}},
          secTitle('Alertas críticas'),
          (alerts.length
            ? alerts.map((a,i)=>h('button',{key:i,onClick:()=>a.id&&this.openFicha(a.id),style:{display:'flex',alignItems:'center',gap:9,width:'100%',textAlign:'left',border:'none',borderBottom:'1px solid '+C.line,background:'transparent',padding:'8px 0'}},
                h('span',{style:{width:6,height:6,borderRadius:'50%',background:a.k==='danger'?C.danger:a.k==='warn'?C.warn:C.faint,flex:'none'}}),
                h('span',{style:{flex:1,fontSize:12,color:C.ink2}},a.t)))
            : h('div',{style:{fontSize:12,color:C.faint,padding:'10px 0'}},'Sin alertas críticas.'))))),
      secBig('Top Opportunities','Mejor retorno sobre esfuerzo ahora mismo.'),
      this.card(h('div',{style:{overflowX:'auto'}},
        h('table',{style:{width:'100%',borderCollapse:'collapse',minWidth:720}},
          h('thead',null,h('tr',{style:{borderBottom:'1px solid '+C.line2}},
            ['Empresa','Partnership','EBV','PTC','Return on Effort','Tier','Score'].map((t,i)=>h('th',{key:i,style:{textAlign:i>=5?'right':'left',padding:'0 12px 9px',fontSize:9.5,letterSpacing:'.1em',color:C.ink3,fontWeight:600,textTransform:'uppercase'}},t)))),
          h('tbody',null, topOpp.map(c=>h('tr',{key:c.id,onClick:()=>this.openFicha(c.id),style:{borderBottom:'1px solid '+C.line,cursor:'pointer'},onMouseEnter:ev=>ev.currentTarget.style.background=C.accentSoft,onMouseLeave:ev=>ev.currentTarget.style.background='transparent'},
            h('td',{style:{padding:'10px 12px',fontSize:13,fontWeight:600,color:C.ink}},c.empresa),
            h('td',{style:{padding:'10px 12px'}},this.ptBadge(c._m.partnershipType)),
            h('td',{style:{padding:'10px 12px',fontSize:11.5,color:C.ink2}},c._m.ebv),
            h('td',{style:{padding:'10px 12px',fontSize:11.5,color:C.ink2}},c._m.ptc),
            h('td',{style:{padding:'10px 12px',fontSize:11.5,fontWeight:600,color:/inmediata|Alto/.test(c._m.roe)?C.ok:C.ink2}},c._m.roe),
            h('td',{style:{padding:'10px 12px',textAlign:'right'}},this.tierChip(c._tier)),
            h('td',{style:{padding:'10px 12px',textAlign:'right'}},this.scoreNum(c._score)))))))),
      secBig('Métricas principales'),
      h('div',{style:{display:'flex',flexWrap:'wrap',gap:12}},
        stat('Total empresas',all.length,byPais('España')+' España · '+byPais('Ecuador')+' Ecuador · '+byPais('México')+' México'),
        stat('En ranking activo',act.length,nElig+' elegibles · '+(all.length-nElig)+' excluidas'),
        stat('Tier 1 · crítico',tierCount(1),'Contacto inmediato',C.accent),
        stat('Listas para contactar',listo,'Con contacto identificado'),
        stat('Oportunidades activas',oport,'En discovery / propuesta'),
        stat('Partnerships activos',activos,'Relaciones vivas',C.ok)),
      h('div',{style:{display:'flex',flexWrap:'wrap',gap:12,marginTop:12}},
        stat('Pendientes de research',research,'Baja confianza / a revisar',C.warn),
        stat('Sin contacto identificado',sinContacto,'Requieren mapeo de decisor',C.warn),
        stat('Tier 2 · alta',tierCount(2),'Activar en 30 días'),
        stat('Tier 3 · media',tierCount(3),'Nutrir 30–60 días'),
        stat('Tier 4 · baja',tierCount(4),'Observación'),
        stat('Tier 5 · no prioritario',tierCount(5),'Sin recursos activos')),
      secBig('Pipeline'),
      h('div',{style:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,alignItems:'start'}},
        this.card(h('div',{style:{padding:'18px 20px'}},
          secTitle('Distribución del pipeline'),
          h('div',{style:{display:'flex',flexDirection:'column',gap:8}}, stages.map(s=>{const n=all.filter(c=>c.pipeline.estado===s).length; return h('div',{key:s,style:{display:'flex',alignItems:'center',gap:10}},
            h('span',{style:{fontSize:11,color:C.ink2,width:130,textAlign:'right',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}},s),
            h('div',{style:{flex:1,height:9,background:C.bg,borderRadius:1}},h('div',{style:{width:(n/maxStage*100)+'%',height:'100%',background:C.accent,borderRadius:1}})),
            h('span',{style:{fontFamily:F.mono,fontSize:11,color:C.ink3,width:20}},n));})))),
        this.card(h('div',{style:{padding:'18px 20px'}},
          secTitle('Empresas por perfil'),
          h('div',{style:{display:'flex',flexDirection:'column',gap:7}}, profArr.map(([p,n])=>h('div',{key:p,style:{display:'flex',alignItems:'center',gap:10}},
            h('span',{style:{fontSize:11,color:C.ink2,width:130,textAlign:'right',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}},p),
            h('div',{style:{flex:1,height:9,background:C.bg,borderRadius:1}},h('div',{style:{width:(n/maxProf*100)+'%',height:'100%',background:C.ink2,borderRadius:1}})),
            h('span',{style:{fontFamily:F.mono,fontSize:11,color:C.ink3,width:20}},n))))))),
      secBig('Rankings',null,{link:()=>this.navTo('ranking'),linkLabel:'Priority Ranking →'}),
      h('div',{style:{display:'grid',gridTemplateColumns:'1.4fr 1fr 1fr 1fr',gap:16,alignItems:'start'}},
        this.card(h('div',{style:{padding:'18px 20px'}},secTitle('Top 10 global'),topList(act.slice(0,10),true))),
        ['España','Ecuador','México'].map(p=>{const arr=act.filter(c=>c.pais===p).slice(0,10);
          return this.card(h('div',{style:{padding:'18px 20px'}},secTitle('Top '+p),
            (arr.length?topList(arr,false):h('div',{style:{fontSize:12,color:C.faint,padding:'20px 0',textAlign:'center'}},'Sin empresas'))),{});})),
      secBig('Actividad reciente'),
      this.card(recent.length
        ? recent.map(w=>h('button',{key:w.id,onClick:()=>this.openFicha(w.empresaId),style:{display:'flex',gap:12,width:'100%',textAlign:'left',border:'none',borderBottom:'1px solid '+C.line,background:'transparent',padding:'11px 18px'}},
            h('span',{style:{fontFamily:F.mono,fontSize:10.5,color:C.faint,width:78,flex:'none'}},w.date),
            h('span',{style:{flex:1,fontSize:12,color:C.ink2}},h('b',{style:{color:C.ink}},w.empresa+': '),w.text),
            h('span',{style:{fontFamily:F.mono,fontSize:10.5,color:C.ink3}},w.scoreBefore+'→'+w.scoreAfter)))
        : h('div',{style:{padding:'20px',fontSize:12,color:C.faint,textAlign:'center'}},'Sin actividad registrada. Usa Weekly Update para empezar.')),
      secBig('Pending Decisions','Decisiones que el equipo debe tomar.'),
      this.card(decisions.length
        ? decisions.map((d,i)=>h('button',{key:i,onClick:()=>d.id&&this.openFicha(d.id),style:{display:'flex',gap:10,width:'100%',textAlign:'left',border:'none',borderBottom:'1px solid '+C.line,background:'transparent',padding:'11px 18px',alignItems:'center'}},
            h('span',{style:{width:6,height:6,borderRadius:'50%',background:C.accent,flex:'none'}}),
            h('span',{style:{flex:1,fontSize:12.5,color:C.ink2}},d.text)))
        : h('div',{style:{padding:'20px',fontSize:12,color:C.faint,textAlign:'center'}},'No hay decisiones pendientes.')),
      h('div',{style:{marginTop:24,fontSize:10.5,color:C.faint,lineHeight:1.6,borderTop:'1px solid '+C.line,paddingTop:14}},
        'Datos de empresa importados del CRM Excel de Forma Prima (confirmados). Scores, métricas y clasificaciones son ',
        h('b',{style:{color:C.accent}},'inferidos'),' por el motor — editables y verificables. STRICTLY CONFIDENTIAL — INTERNAL USE ONLY — Propiedad de Forma Prima.'));
  }

  // ================= TABLE (master + country) =================
  filtered(base){
    const {search,filters,sort}=this.state, m=this.mod;
    let l=base.filter(c=>{
      if(filters.perfil&&c.perfilPrincipal!==filters.perfil) return false;
      if(filters.tier&&String(c._tier)!==filters.tier) return false;
      if(filters.estado&&c.pipeline.estado!==filters.estado) return false;
      if(filters.eligible==='si'&&c.gov.eligible===false) return false;
      if(filters.eligible==='no'&&c.gov.eligible!==false) return false;
      if(search){const q=search.toLowerCase(); const hay=[c.empresa,c.zona,c.contacto.nombre,c.perfilPrincipal,c.ciudad].join(' ').toLowerCase(); if(!hay.includes(q)) return false;}
      return true;
    });
    if(sort==='score') l.sort((a,b)=>b._score-a._score);
    else if(sort==='empresa') l.sort((a,b)=>a.empresa.localeCompare(b.empresa));
    else if(sort==='actividad') l.sort((a,b)=>(b.pipeline.ultimaInteraccion||'').localeCompare(a.pipeline.ultimaInteraccion||''));
    return l;
  }
  viewTable(base,ctx){
    const {C,F}=this, h=this.h.bind(this), m=this.mod;
    if(!base.length) return this.emptyMarket(ctx);
    const list=this.filtered(base);
    const {filters,sort}=this.state;
    const sel=(val,onCh,opts,ph)=>h('select',{value:val,onChange:ev=>onCh(ev.target.value),style:{padding:'6px 10px',fontSize:11.5,border:'1px solid '+C.line2,borderRadius:2,background:C.panel,color:val?C.ink:C.ink3,maxWidth:170}},
      h('option',{value:''},ph),opts.map(o=>h('option',{key:o[0]||o,value:o[0]!=null?o[0]:o},o[1]!=null?o[1]:o)));
    const perfs=[...new Set(base.map(c=>c.perfilPrincipal))];
    const estados=[...new Set(base.map(c=>c.pipeline.estado))];
    const th=(t,w,r)=>h('th',{style:{textAlign:r?'right':'left',padding:'0 10px 9px',fontSize:9.5,letterSpacing:'.12em',color:C.ink3,fontWeight:600,textTransform:'uppercase',width:w,whiteSpace:'nowrap'}},t);
    return h('div',{key:'tbl',style:{padding:'20px 30px 60px',animation:'fpfade .3s'}},
      h('div',{style:{display:'flex',flexWrap:'wrap',gap:8,alignItems:'center',marginBottom:16}},
        this.setFilterUI(),
        sel(filters.perfil,v=>this.setState({filters:{...filters,perfil:v}}),perfs,'Todos los perfiles'),
        sel(filters.tier,v=>this.setState({filters:{...filters,tier:v}}),[['1','Tier 1'],['2','Tier 2'],['3','Tier 3'],['4','Tier 4'],['5','Tier 5']],'Todos los Tiers'),
        sel(filters.estado,v=>this.setState({filters:{...filters,estado:v}}),estados,'Todos los estados'),
        sel(filters.eligible,v=>this.setState({filters:{...filters,eligible:v}}),[['si','Elegibles'],['no','No elegibles']],'Elegibilidad'),
        h('div',{style:{flex:1}}),
        h('div',{style:{fontSize:10.5,color:C.ink3,marginRight:6}},list.length+' de '+base.length),
        sel(sort,v=>this.setState({sort:v}),[['score','Score'],['empresa','Nombre'],['actividad','Última actividad']],'Ordenar')),
      this.card(h('div',{style:{overflowX:'auto'}},h('table',{style:{width:'100%',borderCollapse:'collapse',minWidth:820}},
        h('thead',null,h('tr',{style:{borderBottom:'1px solid '+C.line2}},th('#',36),th('Empresa'),th('Perfil',140),th('Zona',150),th('Estado',130),th('Contacto',120),th('Elegib.',80),th('Tier',56,true),th('Score',56,true))),
        h('tbody',null,list.map((c,i)=>{const al=this.alertsFor(c);
          return h('tr',{key:c.id,onClick:()=>this.openFicha(c.id),style:{borderBottom:'1px solid '+C.line,cursor:'pointer',background:c.gov.eligible===false?'#faf7f2':'transparent'},
            onMouseEnter:ev=>ev.currentTarget.style.background=C.accentSoft,onMouseLeave:ev=>ev.currentTarget.style.background=c.gov.eligible===false?'#faf7f2':'transparent'},
            h('td',{style:{padding:'11px 10px',fontFamily:F.mono,fontSize:10.5,color:C.faint}},c._rankGlobal||'—'),
            h('td',{style:{padding:'11px 10px'}},h('div',{style:{fontSize:13,fontWeight:600,color:C.ink,display:'flex',alignItems:'center',gap:7}},c.empresa,
              al.some(a=>a.k==='danger')?h('span',{style:{width:6,height:6,borderRadius:'50%',background:C.danger}}):al.length?h('span',{style:{width:6,height:6,borderRadius:'50%',background:C.warn}}):null),
              h('div',{style:{fontSize:10.5,color:C.faint,fontFamily:F.mono}},c.id)),
            h('td',{style:{padding:'11px 10px',fontSize:11.5,color:C.ink2}},c.perfilPrincipal,h('div',{style:{marginTop:3}},this.ptBadge(c._m.partnershipType))),
            h('td',{style:{padding:'11px 10px',fontSize:11,color:C.ink3,maxWidth:150,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}},c.ciudad),
            h('td',{style:{padding:'11px 10px',fontSize:11,color:C.ink2}},c.pipeline.estado),
            h('td',{style:{padding:'11px 10px',fontSize:11,color:c.contacto.nombre?C.ink2:C.faint}},c.contacto.nombre||'—'),
            h('td',{style:{padding:'11px 10px'}},this.eligPill(c)),
            h('td',{style:{padding:'11px 10px',textAlign:'right'}},this.tierChip(c._tier)),
            h('td',{style:{padding:'11px 10px',textAlign:'right'}},this.scoreNum(c._score)));
        }))))));
  }
  setFilterUI(){ return null; }
  emptyMarket(ctx){
    const {C}=this, h=this.h.bind(this);
    return h('div',{key:'empty',style:{padding:'80px 30px',display:'flex',justifyContent:'center',animation:'fpfade .3s'}},
      h('div',{style:{maxWidth:440,textAlign:'center'}},
        h('div',{style:{fontSize:15,fontWeight:600,color:C.ink}},'Mercado '+ctx+' — sin empresas'),
        h('div',{style:{fontSize:12.5,color:C.ink3,marginTop:8,lineHeight:1.6}},'La arquitectura del CRM está lista para '+ctx+'. Importa un Excel/CSV de este mercado o añade empresas manualmente; el motor las clasificará, puntuará y rankeará automáticamente.'),
        h('div',{style:{display:'flex',gap:10,justifyContent:'center',marginTop:18}},
          h('button',{onClick:()=>this.navTo('data'),style:{padding:'9px 16px',background:C.ink,color:'#fff',border:'none',borderRadius:2,fontSize:12,fontWeight:600}},'Importar '+ctx),
          h('button',{onClick:()=>this.setState({addOpen:true}),style:{padding:'9px 16px',background:C.panel,color:C.ink2,border:'1px solid '+C.line2,borderRadius:2,fontSize:12,fontWeight:600}},'+ Añadir empresa'))));
  }

  // ================= RANKING =================
  viewRanking(){
    const {C,F}=this, h=this.h.bind(this), e=this._e;
    const paises=[...new Set(e.all.map(c=>c.pais))];
    const tab=this.state.rankTab; const act=e.active.filter(c=>c.pais===tab);
    const excluded=e.all.filter(c=>c.gov.eligible===false&&c.pais===tab);
    const row=(c)=>h('div',{key:c.id,onClick:()=>this.openFicha(c.id),style:{display:'grid',gridTemplateColumns:'40px 1fr 150px 90px 74px',gap:12,alignItems:'center',padding:'12px 16px',borderBottom:'1px solid '+C.line,cursor:'pointer'},
      onMouseEnter:ev=>ev.currentTarget.style.background=C.accentSoft,onMouseLeave:ev=>ev.currentTarget.style.background='transparent'},
      h('div',{style:{fontFamily:F.mono,fontSize:15,color:c._rankPais<=3?C.accent:C.faint,fontWeight:500}},String(c._rankPais).padStart(2,'0')),
      h('div',null,h('div',{style:{fontSize:13.5,fontWeight:600,color:C.ink}},c.empresa),
        h('div',{style:{fontSize:11,color:C.ink3,marginTop:2,display:'flex',alignItems:'center',gap:7,flexWrap:'wrap'}},h('span',null,c.perfilPrincipal+' · '+c.ciudad),this.ptBadge(c._m.partnershipType))),
      h('div',null,this.miniBars(c)),
      h('div',null,this.tierChip(c._tier)),
      h('div',{style:{textAlign:'right'}},this.scoreNum(c._score,false)));
    return h('div',{key:'rk',style:{padding:'20px 30px 60px',animation:'fpfade .3s'}},
      h('div',{style:{display:'flex',gap:4,marginBottom:16}},paises.map(p=>h('button',{key:p,onClick:()=>this.setState({rankTab:p}),style:{padding:'8px 16px',fontSize:12,fontWeight:600,border:'1px solid '+(tab===p?C.ink:C.line2),background:tab===p?C.ink:C.panel,color:tab===p?'#fff':C.ink2,borderRadius:2}},p+' ('+e.active.filter(c=>c.pais===p).length+')'))),
      this.card(h('div',null,
        h('div',{style:{display:'grid',gridTemplateColumns:'40px 1fr 150px 90px 74px',gap:12,padding:'11px 16px',borderBottom:'1px solid '+C.line2,fontSize:9.5,letterSpacing:'.12em',color:C.ink3,fontWeight:600,textTransform:'uppercase'}},
          h('div',null,'#'),h('div',null,'Empresa'),h('div',null,'Desglose'),h('div',null,'Tier'),h('div',{style:{textAlign:'right'}},'Score')),
        act.length?act.map(row):h('div',{style:{padding:30,textAlign:'center',color:C.faint,fontSize:12}},'Sin empresas activas en este mercado'))),
      excluded.length?h('div',{style:{marginTop:22}},
        h('div',{style:{fontSize:11,letterSpacing:'.14em',color:C.danger,fontWeight:600,marginBottom:10,textTransform:'uppercase'}},'Fuera del ranking activo por elegibilidad ('+excluded.length+')'),
        this.card(excluded.map(c=>h('div',{key:c.id,onClick:()=>this.openFicha(c.id),style:{display:'flex',alignItems:'center',gap:12,padding:'11px 16px',borderBottom:'1px solid '+C.line,cursor:'pointer',opacity:.75}},
          h('div',{style:{flex:1,fontSize:13,fontWeight:600,color:C.ink}},c.empresa),
          this.tag(c.gov.estadoEstrategico||'PAUSADO',C.danger,C.dangerSoft),
          h('span',{style:{fontFamily:F.mono,fontSize:11,color:C.faint}},'score '+c._score+' (analítico)'))))):null,
      h('div',{style:{marginTop:18,fontSize:10.5,color:C.faint,lineHeight:1.6}},'El desglose muestra los 7 criterios del Strategic Priority Score (0–100). Las empresas no elegibles conservan su score como dato analítico interno pero quedan fuera del ranking operativo. Abre una ficha para ver justificación, bonificaciones y penalizaciones.'));
  }
  miniBars(c){
    const {C}=this, h=this.h.bind(this), m=this.mod;
    return h('div',{style:{display:'flex',gap:2,alignItems:'flex-end',height:22}}, m.SCORE_KEYS.map(k=>{const v=c.scores[k]/m.SCORE_MAX[k];
      return h('div',{key:k,title:m.SCORE_LABELS[k]+': '+c.scores[k]+'/'+m.SCORE_MAX[k],style:{width:8,height:Math.max(3,v*22)+'px',background:v>=.8?C.accent:v>=.55?C.accentD:C.line2,borderRadius:1}});}));
  }

  // ================= PIPELINE =================
  viewPipeline(){
    const {C,F}=this, h=this.h.bind(this), e=this._e, m=this.mod;
    const stages=m.PIPELINE_STAGES.filter(s=>e.all.some(c=>c.pipeline.estado===s));
    return h('div',{key:'pp',style:{padding:'20px 24px 40px',animation:'fpfade .3s',height:'100%',overflowX:'auto'}},
      h('div',{style:{display:'flex',gap:12,alignItems:'stretch',minHeight:'80%'}}, stages.map(s=>{
        const arr=e.all.filter(c=>c.pipeline.estado===s).sort((a,b)=>b._score-a._score);
        const paused=['Pausado','No prioritario','Cerrado sin avance'].includes(s);
        return h('div',{key:s,style:{width:230,flex:'none',display:'flex',flexDirection:'column'}},
          h('div',{style:{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 4px 9px',borderBottom:'2px solid '+(paused?C.line2:C.accent),marginBottom:10}},
            h('span',{style:{fontSize:11,fontWeight:600,color:C.ink,letterSpacing:'.01em'}},s),
            h('span',{style:{fontFamily:F.mono,fontSize:11,color:C.ink3}},arr.length)),
          h('div',{style:{display:'flex',flexDirection:'column',gap:8}}, arr.map(c=>h('button',{key:c.id,onClick:()=>this.openFicha(c.id),style:{textAlign:'left',padding:'11px 12px',background:C.panel,border:'1px solid '+C.line,borderLeft:'2px solid '+(c.gov.eligible===false?C.danger:C.accent),borderRadius:2}},
            h('div',{style:{display:'flex',justifyContent:'space-between',gap:8,alignItems:'flex-start'}},
              h('span',{style:{fontSize:12.5,fontWeight:600,color:C.ink,lineHeight:1.25}},c.empresa),this.scoreNum(c._score)),
            h('div',{style:{fontSize:10.5,color:C.ink3,marginTop:5}},c.perfilPrincipal),
            c.pipeline.proximaAccion?h('div',{style:{fontSize:10.5,color:C.ink2,marginTop:6,lineHeight:1.4,display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',overflow:'hidden'}},'→ '+c.pipeline.proximaAccion):null))));
      })));
  }

  // ================= RESEARCH QUEUE =================
  viewResearch(){
    const {C,F}=this, h=this.h.bind(this), e=this._e;
    let list=e.all.filter(c=>c.research.nivelConfianza==='Baja'||c.gov.clasificacionPendiente||!c.contacto.verificado||!c.contacto.nombre);
    if(this.state.search){const q=this.state.search.toLowerCase(); list=list.filter(c=>c.empresa.toLowerCase().includes(q));}
    list.sort((a,b)=>b._score-a._score);
    return h('div',{key:'rq',style:{padding:'20px 30px 60px',animation:'fpfade .3s'}},
      h('div',{style:{fontSize:12.5,color:C.ink2,marginBottom:16,lineHeight:1.6,maxWidth:760}},
        'Este entorno no navega la web en vivo. Cada ficha incluye una ',h('b',null,'lista de búsqueda recomendada'),' y un asistente de research con IA que redacta hipótesis a partir de lo conocido — nunca inventa datos: lo que falta se marca como “Pendiente de verificar”.'),
      this.card(list.map(c=>{const miss=c.research.infoPendiente||[];
        return h('div',{key:c.id,style:{padding:'15px 18px',borderBottom:'1px solid '+C.line}},
          h('div',{style:{display:'flex',alignItems:'center',gap:12}},
            h('button',{onClick:()=>this.openFicha(c.id),style:{flex:1,textAlign:'left',border:'none',background:'transparent'}},
              h('div',{style:{fontSize:14,fontWeight:600,color:C.ink}},c.empresa),
              h('div',{style:{fontSize:11,color:C.ink3,marginTop:2}},c.perfilPrincipal+' · '+c.ciudad+' · '+c.pais)),
            this.tag('Confianza '+c.research.nivelConfianza,c.research.nivelConfianza==='Baja'?C.warn:C.ok),
            c.gov.clasificacionPendiente?this.tag('Clasificación a revisar',C.danger,C.dangerSoft):null,
            this.tierChip(c._tier),this.scoreNum(c._score)),
          h('div',{style:{display:'flex',flexWrap:'wrap',gap:6,marginTop:10}}, miss.slice(0,5).map((x,i)=>h('span',{key:i,style:{fontSize:10,color:C.ink3,background:C.bg,border:'1px solid '+C.line,padding:'3px 8px',borderRadius:2}},x))),
          h('div',{style:{display:'flex',gap:8,marginTop:12}},
            h('button',{onClick:()=>this.openFicha(c.id,'research'),style:{padding:'6px 12px',fontSize:11,fontWeight:600,border:'1px solid '+C.accent,background:C.panel,color:C.accent,borderRadius:2}},'Research con IA →'),
            h('a',{href:'https://www.google.com/search?q='+encodeURIComponent(c.empresa+' '+c.ciudad+' inmobiliaria'),target:'_blank',style:{padding:'6px 12px',fontSize:11,fontWeight:600,border:'1px solid '+C.line2,background:C.panel,color:C.ink2,borderRadius:2}},'Buscar en Google ↗')));
      })));
  }

  // ================= PARTNER PROFILES =================
  viewPartners(){
    const {C,F}=this, h=this.h.bind(this), e=this._e, m=this.mod;
    const groups={}; e.all.forEach(c=>{(groups[c.perfilPrincipal]=groups[c.perfilPrincipal]||[]).push(c);});
    const arr=Object.entries(groups).sort((a,b)=>b[1].length-a[1].length);
    return h('div',{key:'pf',style:{padding:'20px 30px 60px',animation:'fpfade .3s',display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}},
      arr.map(([prof,cs])=>{const avg=Math.round(cs.reduce((a,c)=>a+c._score,0)/cs.length); const collab=m.COLLAB_MODELS[prof];
        const top=cs.slice().sort((a,b)=>b._score-a._score).slice(0,4);
        return this.card(h('div',{style:{padding:'18px 20px'}},
          h('div',{style:{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}},
            h('div',null,h('div',{style:{fontSize:15,fontWeight:600,color:C.ink}},prof),
              h('div',{style:{fontSize:11,color:C.ink3,marginTop:2}},cs.length+' empresas · score medio '+avg)),
            h('div',{style:{fontFamily:F.mono,fontSize:22,color:C.accent}},cs.length)),
          collab?h('div',{style:{marginTop:12,padding:'10px 12px',background:C.bg,borderRadius:2,fontSize:11,color:C.ink2,lineHeight:1.5}},
            h('b',{style:{color:C.ink}},'Modelo: '),collab.modelo,collab.incentivo&&collab.incentivo!=='—'?h('div',{style:{marginTop:5,color:C.ink3}},h('b',null,'Incentivo: '),collab.incentivo):null):null,
          h('div',{style:{marginTop:12,display:'flex',flexDirection:'column',gap:1}}, top.map(c=>h('button',{key:c.id,onClick:()=>this.openFicha(c.id),style:{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'7px 0',border:'none',borderTop:'1px solid '+C.line,background:'transparent',textAlign:'left'}},
            h('span',{style:{fontSize:12.5,color:C.ink,fontWeight:500}},c.empresa),
            h('span',{style:{display:'flex',gap:8,alignItems:'center'}},this.tierChip(c._tier),this.scoreNum(c._score)))))));
      }));
  }

  // ================= ACTION CENTER =================
  entryStrategy(c){
    const p=c.perfilPrincipal, ct=c.contacto, collab=c.fit;
    const persona={'Agencias inmobiliarias':'Responsable de captación / obra nueva de la zona','Promotoras / Developers':'Director de Desarrollo de Negocio o Comercial','Family Offices':'Responsable de inversiones inmobiliarias','Fondos de inversión':'Director de Real Estate / Asset Management','Inversores inmobiliarios':'Director de inversiones','Prescriptores':'Socio director / responsable de cliente','Instituciones':'—','Otro':'—'}[p]||'Dirección comercial';
    const canal=ct.introDisponible?'Introducción cálida vía '+ct.personaIntro:ct.linkedin?'LinkedIn (mensaje personalizado)':ct.email?'Email directo + seguimiento telefónico':'LinkedIn / email a identificar';
    return {
      objetivo:'Conseguir una reunión de descubrimiento para presentar cómo la arquitectura de Forma Prima genera valor en su modelo de negocio en '+c.ciudad+'.',
      persona:ct.nombre?(ct.nombre+(ct.cargo?' — '+ct.cargo:'')):persona,
      cargoAlt:persona,
      canal,
      introCalida:ct.introDisponible?ct.personaIntro:'No disponible — identificar ruta',
      hipotesis:collab.hipotesisValor,
      mensaje:'No vender arquitectura de forma genérica: posicionar Forma Prima como la herramienta que convierte el potencial inmobiliario de '+c.empresa+' en claridad comercial y decisión de compra.',
      credencial:'Estudio de arquitectura residencial high-end con Visual Lab y Portal Cliente como diferenciadores del servicio.',
      caso:'Selected Works — reforma integral / obra nueva residencial premium.',
      material:c.pipeline.materialEnviado||'Dossier Selected Works + one-pager de colaboración por perfil',
      cta:'Proponer una llamada de 20 min esta o la próxima semana.',
      followUp:'Follow-up a los 4–5 días laborables si no hay respuesta; segundo toque con caso de estudio relevante.',
      tiempo:c.contacto.introDisponible?'1–2 semanas':'2–4 semanas',
      dificultad:c._tier<=2?'Media':c._tier===3?'Media-alta':'Alta',
    };
  }
  viewActions(){
    const {C,F}=this, h=this.h.bind(this), e=this._e;
    let list=e.active.filter(c=>!['Partnership activo','Cerrado sin avance','Pausado','No prioritario'].includes(c.pipeline.estado)&&c.pipeline.proximaAccion);
    const roeW={'Prioridad inmediata':4,'Alto retorno':3,'Retorno medio':2,'Bajo retorno':1,'No recomendable actualmente':0};
    const timW={'Inmediata':4,'0–30 días':3,'30–60 días':1.5,'60–90 días':1,'3–6 meses':.5,'6–12 meses':.2,'Largo plazo':0,'Sin definir':0};
    const overdue=(c)=>{const f=c.pipeline.fechaProximaAccion; if(!f)return 0; const dd=new Date(f); return (!isNaN(dd)&&dd<this.now())?1:0;};
    list.sort((a,b)=> overdue(b)-overdue(a) || a._tier-b._tier || (roeW[b._m.roe]-roeW[a._m.roe]) || (timW[b._m.timing]-timW[a._m.timing]) || b._score-a._score);
    return h('div',{key:'ac',style:{padding:'20px 30px 60px',animation:'fpfade .3s'}},
      h('div',{style:{fontSize:12.5,color:C.ink3,marginBottom:16}},list.length+' acciones ordenadas por urgencia, impacto, retorno y esfuerzo. Las empresas no elegibles para outreach activo quedan excluidas.'),
      h('div',{style:{display:'flex',flexDirection:'column',gap:10}}, list.map((c,i)=>{const st=this.entryStrategy(c); const al=this.alertsFor(c); const isOverdue=overdue(c); const notes=c.strategicNotes||{}; const rec=this.mod.strategicRecommendation(c);
        const btn=(label,on,extra)=>h('button',{onClick:on,style:Object.assign({padding:'6px 12px',fontSize:11,fontWeight:600,borderRadius:2,whiteSpace:'nowrap',cursor:'pointer'},extra)},label);
        return this.card(h('div',{style:{padding:'16px 20px',borderLeft:'3px solid '+(isOverdue?C.danger:c._tier===1?C.accent:c._tier===2?C.accentD:C.line2)}},
          h('div',{style:{display:'flex',alignItems:'flex-start',gap:14}},
            h('div',{style:{fontFamily:F.mono,fontSize:14,color:C.faint,width:26,paddingTop:2}},String(i+1).padStart(2,'0')),
            h('div',{style:{flex:1}},
              h('div',{style:{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}},
                h('button',{onClick:()=>this.openFicha(c.id),style:{border:'none',background:'transparent',padding:0,fontSize:15,fontWeight:600,color:C.ink,cursor:'pointer'}},c.empresa),
                this.tierChip(c._tier),this.ptBadge(c._m.partnershipType),this.tag(c.pipeline.estado,C.ink2),
                isOverdue?this.tag('VENCIDA',C.danger,C.dangerSoft):null,
                h('span',{style:{fontSize:11,color:C.ink3}},c.ciudad+' · '+c.pais)),
              h('div',{style:{fontSize:13,color:C.ink,marginTop:9,lineHeight:1.5,fontWeight:500}},'→ '+c.pipeline.proximaAccion),
              h('div',{style:{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(210px,1fr))',gap:'6px 22px',marginTop:11,fontSize:11.5,color:C.ink2}},
                h('div',null,h('span',{style:{color:C.ink3}},'Motivo: '),rec.porQueAhora),
                h('div',null,h('span',{style:{color:C.ink3}},'Contacto: '),st.persona),
                h('div',null,h('span',{style:{color:C.ink3}},'Canal: '),st.canal),
                h('div',null,h('span',{style:{color:C.ink3}},'Responsable: '),notes.quienLidera||c.pipeline.responsable||'Sin asignar'),
                h('div',null,h('span',{style:{color:C.ink3}},'Material: '),notes.material||st.material),
                h('div',null,h('span',{style:{color:C.ink3}},'Resultado esperado: '),'Reunión de descubrimiento agendada'),
                h('div',null,h('span',{style:{color:C.ink3}},'Fecha límite: '),c.pipeline.fechaProximaAccion||'Sin fecha'),
                h('div',null,h('span',{style:{color:C.ink3}},'Esfuerzo: '),c._m.effort+' · RoE: '+c._m.roe)),
              al.length?h('div',{style:{marginTop:9,fontSize:11,color:C.warn}},'⚠ '+al.map(a=>a.t).join(' · ')):null,
              h('div',{style:{display:'flex',gap:8,marginTop:12,flexWrap:'wrap'}},
                btn('✓ Completar',()=>this.completeAction(c.id),{border:'1px solid '+C.ok,background:C.okSoft,color:C.ok}),
                btn('Posponer',()=>this.postponeAction(c.id),{border:'1px solid '+C.line2,background:C.panel,color:C.ink2}),
                btn('Reasignar',()=>this.reassignAction(c.id),{border:'1px solid '+C.line2,background:C.panel,color:C.ink2}))),
            h('div',{style:{textAlign:'right'}},this.scoreNum(c._score,true),
              h('button',{onClick:()=>this.openFicha(c.id,'strategy'),style:{display:'block',marginTop:10,padding:'6px 12px',fontSize:11,fontWeight:600,border:'1px solid '+C.ink,background:C.ink,color:'#fff',borderRadius:2,whiteSpace:'nowrap'}},'Estrategia →')))));
      })));
  }
  completeAction(id){ const res=prompt('Resultado de la acción (se registra en el historial):','Realizada'); if(res===null)return;
    const cs=JSON.parse(JSON.stringify(this.state.companies)); const x=cs.find(y=>y.id===id); if(!x)return;
    const today=new Date().toISOString().slice(0,10);
    x.pipeline.historial.unshift({date:today,who:'Action Center',text:'Acción completada: '+x.pipeline.proximaAccion+' — Resultado: '+res});
    x.lastMeaningfulInteraction=today; x.pipeline.ultimaInteraccion=today;
    // recomendar siguiente paso por etapa
    const nextByStage={'Listo para contactar':['Primer contacto','Registrar respuesta del primer contacto.'],'Primer contacto':['Follow-up 1','Enviar follow-up si no hay respuesta en 5 días.'],'Follow-up 1':['Follow-up 2','Segundo follow-up por canal alternativo.'],'Follow-up 2':['Discovery Meeting','Agendar reunión de descubrimiento.'],'Discovery Meeting':['Propuesta personalizada','Preparar propuesta / hipótesis de colaboración.'],'Research estratégico':['Listo para contactar','Definir estrategia de entrada y contacto.']};
    const nx=nextByStage[x.pipeline.estado];
    if(nx){ x.pipeline.estado=nx[0]; x.pipeline.proximaAccion=nx[1]; }
    x.pipeline.fechaProximaAccion=''; this.mod.applyEligibility(x,this.state.ruleActive); this.persist(cs);
    this.toast('Acción completada · siguiente paso: '+(nx?nx[0]:x.pipeline.estado));
  }
  postponeAction(id){ const cs=JSON.parse(JSON.stringify(this.state.companies)); const x=cs.find(y=>y.id===id); if(!x)return;
    const d=new Date(); d.setDate(d.getDate()+7); const iso=d.toISOString().slice(0,10);
    x.pipeline.fechaProximaAccion=iso; x.pipeline.historial.unshift({date:new Date().toISOString().slice(0,10),who:'Action Center',text:'Acción pospuesta a '+iso}); this.persist(cs); this.toast('Pospuesta 7 días'); }
  reassignAction(id){ const cs=JSON.parse(JSON.stringify(this.state.companies)); const x=cs.find(y=>y.id===id); if(!x)return;
    const who=prompt('Reasignar responsable a:',x.pipeline.responsable||''); if(who===null)return;
    x.pipeline.responsable=who; x.strategicNotes=x.strategicNotes||{}; x.strategicNotes.quienLidera=who;
    x.pipeline.historial.unshift({date:new Date().toISOString().slice(0,10),who:'Action Center',text:'Responsable reasignado a '+who}); this.persist(cs); this.toast('Reasignada a '+who); }

  // ================= ADMIN =================
  viewAdmin(){
    const {C,F}=this, h=this.h.bind(this), e=this._e;
    const constructoras=e.all.filter(c=>c.perfilPrincipal==='Constructoras'||c.capacidadConstructora);
    const excluded=e.all.filter(c=>c.gov.eligible===false);
    const sec=(t,d)=>h('div',{style:{margin:'0 0 12px'}},h('div',{style:{fontSize:13,fontWeight:600,color:C.ink}},t),d?h('div',{style:{fontSize:11.5,color:C.ink3,marginTop:2,lineHeight:1.5}},d):null);
    if(!this.state.adminUnlocked) return h('div',{key:'lock',style:{padding:'80px 30px',display:'flex',justifyContent:'center',animation:'fpfade .3s'}},
      h('div',{style:{maxWidth:420,textAlign:'center'}},
        h('div',{style:{fontSize:22,marginBottom:10}},'🔒'),
        h('div',{style:{fontSize:15,fontWeight:600,color:C.ink}},'Panel reservado a administradores'),
        h('div',{style:{fontSize:12.5,color:C.ink3,marginTop:8,lineHeight:1.6}},'Este panel gestiona reglas de gobernanza estratégica confidenciales, incluida la exclusión temporal de constructoras en Madrid. Requiere confirmación de rol administrador.'),
        h('button',{onClick:()=>this.setState({adminUnlocked:true}),style:{marginTop:18,padding:'10px 20px',background:C.ink,color:'#fff',border:'none',borderRadius:2,fontSize:12.5,fontWeight:600}},'Soy administrador — continuar')));
    return h('div',{key:'ad',style:{padding:'22px 30px 60px',animation:'fpfade .3s',maxWidth:900}},
      this.card(h('div',{style:{padding:'20px 22px'}},
        h('div',{style:{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:20}},
          h('div',{style:{flex:1}},sec('Regla estratégica — Constructoras en Madrid',
            'Las constructoras cuya actividad principal esté en Madrid quedan clasificadas como “PAUSADO — NO ACTIVAR” y fuera de rankings activos, Top 10 España, Action Center y outreach. Decisión interna, temporal y confidencial. Se conservan en el CRM para inteligencia de mercado. El score se mantiene como dato analítico pero no determina activación.')),
          h('button',{onClick:()=>this.toggleRule(),style:{flex:'none',width:56,height:30,borderRadius:16,border:'none',background:this.state.ruleActive?C.accent:C.line2,position:'relative',transition:'background .2s'}},
            h('span',{style:{position:'absolute',top:3,left:this.state.ruleActive?29:3,width:24,height:24,borderRadius:'50%',background:'#fff',transition:'left .2s',boxShadow:'0 1px 3px rgba(0,0,0,.2)'}}))),
        h('div',{style:{marginTop:6,fontSize:11.5,fontWeight:600,color:this.state.ruleActive?C.accent:C.ink3}},this.state.ruleActive?'REGLA ACTIVA':'REGLA DESACTIVADA'),
        h('div',{style:{marginTop:14,padding:'11px 14px',background:C.bg,borderRadius:2,fontSize:11,color:C.ink3,lineHeight:1.6}},
          'Motivo visible (único texto permitido): ',h('b',{style:{color:C.ink2}},'“Decisión interna de enfoque comercial. Revisar antes de activar.”'),
          h('br'),'No se registra ni infiere ningún motivo adicional. La exclusión no aplica automáticamente a constructoras de Ecuador/México, otras regiones de España, project managers, promotoras con capacidad constructora interna ni empresas de desarrollo.'))),
      h('div',{style:{marginTop:20}},sec('Empresas con perfil o capacidad de construcción ('+constructoras.length+')')),
      this.card(constructoras.length?constructoras.map(c=>h('div',{key:c.id,style:{display:'flex',alignItems:'center',gap:12,padding:'12px 18px',borderBottom:'1px solid '+C.line}},
        h('div',{style:{flex:1}},h('button',{onClick:()=>this.openFicha(c.id),style:{border:'none',background:'transparent',padding:0,fontSize:13.5,fontWeight:600,color:C.ink,cursor:'pointer'}},c.empresa),
          h('div',{style:{fontSize:11,color:C.ink3,marginTop:2}},c.perfilPrincipal+(c.capacidadConstructora?' · capacidad constructora interna':'')+' · '+c.ciudad)),
        c.gov.clasificacionPendiente?this.tag('Clasificación pendiente',C.danger,C.dangerSoft):null,
        this.eligPill(c),
        h('button',{onClick:()=>this.toggleExcepcion(c.id),style:{padding:'6px 11px',fontSize:10.5,fontWeight:600,border:'1px solid '+C.line2,background:C.panel,color:C.ink2,borderRadius:2}},c.gov.excepcion?'Quitar excepción':'Autorizar excepción'))):
        h('div',{style:{padding:'20px',fontSize:12,color:C.faint,textAlign:'center'}},'Ninguna empresa del CRM actual se clasifica como constructora con mercado principal Madrid. Dlux Homes está marcada como “clasificación pendiente de revisión” por combinar promoción y construcción.')),
      h('div',{style:{marginTop:24}},sec('Empresas fuera de outreach activo ('+excluded.length+')','Conservan score analítico; excluidas de rankings, Action Center y campañas.')),
      this.card(excluded.length?excluded.map(c=>h('div',{key:c.id,style:{display:'flex',alignItems:'center',gap:12,padding:'11px 18px',borderBottom:'1px solid '+C.line}},
        h('div',{style:{flex:1,fontSize:13,fontWeight:600,color:C.ink}},c.empresa),this.tag(c.gov.estadoEstrategico,C.danger,C.dangerSoft),h('span',{style:{fontSize:11,color:C.faint}},'Rev.: '+(c.gov.fechaRevision||'—')))):
        h('div',{style:{padding:'20px',fontSize:12,color:C.faint,textAlign:'center'}},'No hay empresas excluidas actualmente.')),
      h('div',{style:{marginTop:28,borderTop:'1px solid '+C.line,paddingTop:18}},sec('Datos y sistema')),
      h('div',{style:{display:'flex',gap:10,flexWrap:'wrap'}},
        h('button',{onClick:()=>this.restoreSeed(),style:{padding:'9px 15px',fontSize:11.5,fontWeight:600,border:'1px solid '+C.line2,background:C.panel,color:C.ink2,borderRadius:2}},'Restaurar datos del CRM original'),
        h('button',{onClick:()=>this.exportJSON(),style:{padding:'9px 15px',fontSize:11.5,fontWeight:600,border:'1px solid '+C.line2,background:C.panel,color:C.ink2,borderRadius:2}},'Backup JSON'),
        h('button',{onClick:()=>this.setState({adminUnlocked:false}),style:{padding:'9px 15px',fontSize:11.5,fontWeight:600,border:'1px solid '+C.line2,background:C.panel,color:C.ink3,borderRadius:2}},'Bloquear panel')));
  }
  toggleRule=()=>{ const ra=!this.state.ruleActive;
    const c=JSON.parse(JSON.stringify(this.state.companies)); c.forEach(x=>this.mod.applyEligibility(x,ra)); this.persist(c,{ruleActive:ra}); this.toast('Regla de constructoras Madrid '+(ra?'activada':'desactivada')); };
  toggleExcepcion=(id)=>{ const c=JSON.parse(JSON.stringify(this.state.companies)); const x=c.find(y=>y.id===id); if(!x)return;
    x.gov.excepcion=!x.gov.excepcion; if(x.gov.excepcion){x.gov.autorizadoPor='Administrador'; x.gov.eligible=true; x.gov.estadoEstrategico='Activo — excepción autorizada';} this.mod.applyEligibility(x,this.state.ruleActive);
    x.pipeline.historial.unshift({date:new Date().toISOString().slice(0,10),who:'Administrador',text:x.gov.excepcion?'Excepción autorizada — empresa reactivada para outreach.':'Excepción retirada.'});
    this.persist(c); this.toast('Excepción '+(x.gov.excepcion?'autorizada':'retirada')); };
  restoreSeed=()=>{ if(!confirm('¿Restaurar los datos originales del CRM Excel? Se perderán los cambios locales no exportados.'))return;
    restoreSeedAction().then(r=>{ if(r&&r.error){ this.toast('No se pudo restaurar: '+r.error,'danger'); return; } const c=r.companies; c.forEach(x=>{ this.mod.ensureFields(x); this.mod.applyEligibility(x,this.state.ruleActive); }); this.setState({companies:c}); this.toast('Datos originales restaurados'); }).catch(e=>this.toast('Error: '+e.message,'danger')); };

  // ================= DATA / IMPORT-EXPORT =================
  viewData(){
    const {C,F}=this, h=this.h.bind(this), e=this._e, rep=this.state.importReport;
    const quality=this.qualityReport(e.all);
    const box=(children)=>this.card(h('div',{style:{padding:'20px 22px'}},children));
    return h('div',{key:'dt',style:{padding:'22px 30px 60px',animation:'fpfade .3s',display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,alignItems:'start'}},
      box(h('div',null,
        h('div',{style:{fontSize:14,fontWeight:600,color:C.ink,marginBottom:4}},'Importar CRM (Excel / CSV)'),
        h('div',{style:{fontSize:11.5,color:C.ink3,marginBottom:14,lineHeight:1.55}},'No se elimina ninguna fila automáticamente. Se detectan duplicados por nombre y dominio, se normalizan países/ciudades/perfiles y se genera un reporte de calidad antes de confirmar.'),
        h('label',{style:{display:'block',border:'1.5px dashed '+C.line2,borderRadius:3,padding:'26px 18px',textAlign:'center',cursor:'pointer',background:C.bg}},
          h('input',{type:'file',accept:'.xlsx,.xls,.csv',style:{display:'none'},onChange:ev=>{const f=ev.target.files[0];if(f)this.handleImport(f);}}),
          h('div',{style:{fontSize:13,fontWeight:600,color:C.ink2}},'Arrastra o selecciona un archivo'),
          h('div',{style:{fontSize:11,color:C.faint,marginTop:4}},'.xlsx · .xls · .csv')),
        rep?h('div',{style:{marginTop:16}},
          h('div',{style:{fontSize:12,fontWeight:600,color:C.ink,marginBottom:8}},'Reporte de importación — '+rep.file),
          h('div',{style:{display:'flex',flexDirection:'column',gap:5,fontSize:11.5,color:C.ink2}},
            h('div',null,rep.total+' filas leídas · '+rep.nuevas+' nuevas · '+rep.dupes+' posibles duplicados · '+rep.vacias+' con campos críticos vacíos'),
            rep.dupeList.length?h('div',{style:{color:C.warn}},'Duplicados: '+rep.dupeList.join(', ')):null),
          h('div',{style:{display:'flex',gap:8,marginTop:12}},
            h('button',{onClick:()=>this.confirmImport(false),style:{padding:'8px 14px',fontSize:11.5,fontWeight:600,background:C.ink,color:'#fff',border:'none',borderRadius:2}},'Importar solo nuevas ('+rep.nuevas+')'),
            h('button',{onClick:()=>this.confirmImport(true),style:{padding:'8px 14px',fontSize:11.5,fontWeight:600,background:C.panel,color:C.ink2,border:'1px solid '+C.line2,borderRadius:2}},'Importar todas'),
            h('button',{onClick:()=>this.setState({importReport:null}),style:{padding:'8px 14px',fontSize:11.5,fontWeight:600,background:'transparent',color:C.ink3,border:'1px solid '+C.line,borderRadius:2}},'Cancelar'))):null)),
      h('div',{style:{display:'flex',flexDirection:'column',gap:16}},
        box(h('div',null,
          h('div',{style:{fontSize:14,fontWeight:600,color:C.ink,marginBottom:4}},'Exportar'),
          h('div',{style:{fontSize:11.5,color:C.ink3,marginBottom:14,lineHeight:1.55}},'Exporta el Master CRM con todos los campos calculados (score, tier, ranking, elegibilidad).'),
          h('div',{style:{display:'flex',gap:8,flexWrap:'wrap'}},
            h('button',{onClick:()=>this.exportXlsx(),style:{padding:'9px 15px',fontSize:12,fontWeight:600,background:C.ink,color:'#fff',border:'none',borderRadius:2}},'↓ Excel (.xlsx)'),
            h('button',{onClick:()=>this.exportCsv(),style:{padding:'9px 15px',fontSize:12,fontWeight:600,background:C.panel,color:C.ink2,border:'1px solid '+C.line2,borderRadius:2}},'↓ CSV'),
            h('button',{onClick:()=>this.exportJSON(),style:{padding:'9px 15px',fontSize:12,fontWeight:600,background:C.panel,color:C.ink2,border:'1px solid '+C.line2,borderRadius:2}},'↓ Backup JSON')))),
        box(h('div',null,
          h('div',{style:{fontSize:14,fontWeight:600,color:C.ink,marginBottom:12}},'Calidad del CRM'),
          h('div',{style:{display:'flex',flexDirection:'column',gap:9}}, quality.map((q,i)=>h('div',{key:i,style:{display:'flex',alignItems:'center',gap:10}},
            h('div',{style:{flex:1,fontSize:11.5,color:C.ink2}},q.label),
            h('div',{style:{width:120,height:7,background:C.bg,borderRadius:1}},h('div',{style:{width:q.pct+'%',height:'100%',background:q.pct>=70?C.ok:q.pct>=40?C.warn:C.danger,borderRadius:1}})),
            h('span',{style:{fontFamily:F.mono,fontSize:11,color:C.ink3,width:40,textAlign:'right'}},q.txt)))))),
        box(h('div',null,
          h('div',{style:{fontSize:14,fontWeight:600,color:C.ink,marginBottom:8}},'Cómo usar y actualizar'),
          h('ol',{style:{margin:0,paddingLeft:18,fontSize:11.5,color:C.ink2,lineHeight:1.7}},
            h('li',null,'Los cambios se guardan automáticamente en Supabase, compartidos por todo el equipo.'),
            h('li',null,'Edita cualquier dato desde la ficha de empresa; el ranking se recalcula al instante.'),
            h('li',null,'Exporta a Excel/CSV como copia de seguridad o para compartir internamente.'),
            h('li',null,'Importa nuevas empresas o mercados (Ecuador/México) cuando dispongas del archivo.'),
            h('li',null,'Research en vivo no disponible offline: usa el asistente IA y la lista de búsqueda por empresa.')),
          h('div',{style:{marginTop:12,fontSize:10,color:C.danger,letterSpacing:'.08em',fontWeight:600}},'STRICTLY CONFIDENTIAL — INTERNAL USE ONLY')))));
  }
  qualityReport(all){
    const n=all.length||1, pct=x=>Math.round(x/n*100);
    const withContact=all.filter(c=>c.contacto.nombre).length;
    const withEmail=all.filter(c=>c.contacto.email).length;
    const withWeb=all.filter(c=>c.website).length;
    const verified=all.filter(c=>c.contacto.verificado).length;
    const researched=all.filter(c=>c.research.nivelConfianza!=='Baja').length;
    return [
      {label:'Contacto identificado',pct:pct(withContact),txt:withContact+'/'+n},
      {label:'Email disponible',pct:pct(withEmail),txt:withEmail+'/'+n},
      {label:'Website registrado',pct:pct(withWeb),txt:withWeb+'/'+n},
      {label:'Contacto verificado',pct:pct(verified),txt:verified+'/'+n},
      {label:'Research con confianza ≥ media',pct:pct(researched),txt:researched+'/'+n},
    ];
  }
  flatten(c){ const s=this.mod.finalScore(c); return {
    ID:c.id,Empresa:c.empresa,Pais:c.pais,Ciudad:c.ciudad,Zona:c.zona,Website:c.website,LinkedIn:c.linkedin,
    'Perfil principal':c.perfilPrincipal,'Perfil secundario':c.perfilSecundario,'Modelo de negocio':c.modeloNegocio,Tipo:c.tipoRelacion,
    'Score final':s,Tier:this.mod.tierOf(s).tier,'Rank global':c._rankGlobal||'',
    Potencial:c.scores.potencial,Fit:c.scores.fit,Valor:c.scores.valor,Acceso:c.scores.acceso,Temporalidad:c.scores.temporalidad,Posicionamiento:c.scores.posicionamiento,Facilidad:c.scores.facilidad,
    Bonificaciones:(c.bonuses||[]).reduce((a,x)=>a+x.pts,0),Penalizaciones:(c.penalties||[]).reduce((a,x)=>a+x.pts,0),
    'Eligible outreach':c.gov.eligible!==false?'Sí':'No','Estado estrategico':c.gov.estadoEstrategico,'Motivo exclusion':c.gov.motivoVisible,
    'Estado pipeline':c.pipeline.estado,Responsable:c.pipeline.responsable,'Proxima accion':c.pipeline.proximaAccion,'Ultima interaccion':c.pipeline.ultimaInteraccion,
    Contacto:c.contacto.nombre,Cargo:c.contacto.cargo,Email:c.contacto.email,Telefono:c.contacto.telefono,
    'Modelo colaboracion':c.fit.modeloColaboracion,Incentivo:c.fit.incentivo,'Nivel confianza':c.research.nivelConfianza,
  }; }
  exportXlsx=()=>{ const rows=this._e.all.map(c=>this.flatten(c)); const ws=XLSX.utils.json_to_sheet(rows); const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,'Master CRM'); XLSX.writeFile(wb,'FormaPrima_CRM_'+new Date().toISOString().slice(0,10)+'.xlsx'); this.toast('Exportado a Excel'); };
  exportCsv=()=>{ const rows=this._e.all.map(c=>this.flatten(c)); const ws=XLSX.utils.json_to_sheet(rows); const csv=XLSX.utils.sheet_to_csv(ws); this.download(new Blob([csv],{type:'text/csv'}),'FormaPrima_CRM.csv'); this.toast('Exportado a CSV'); };
  exportJSON=()=>{ this.download(new Blob([JSON.stringify(this.state.companies,null,1)],{type:'application/json'}),'FormaPrima_CRM_backup.json'); this.toast('Backup JSON descargado'); };
  download(blob,name){ const u=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=u; a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(u),1000); }
  async handleImport(file){
    try{
      const buf=await file.arrayBuffer(); const wb=XLSX.read(buf,{type:'array'}); const ws=wb.Sheets[wb.SheetNames[0]];
      const rows=XLSX.utils.sheet_to_json(ws,{defval:''});
      const existing=new Set(this.state.companies.map(c=>c.empresa.toLowerCase().trim()));
      const nameKey=Object.keys(rows[0]||{}).find(k=>/empresa|company|nombre|fuente/i.test(k))||Object.keys(rows[0]||{})[0];
      let nuevas=0,dupes=0,vacias=0; const dupeList=[];
      rows.forEach(r=>{const nm=(r[nameKey]||'').toString().trim(); if(!nm){vacias++;return;} if(existing.has(nm.toLowerCase())){dupes++;if(dupeList.length<8)dupeList.push(nm);}else nuevas++;});
      this.setState({importReport:{file:file.name,total:rows.length,nuevas,dupes,vacias,dupeList,rows,nameKey}});
      this.toast('Archivo leído — revisa el reporte');
    }catch(e){ this.toast('No se pudo leer el archivo: '+e.message,'danger'); }
  }
  confirmImport(all){
    const rep=this.state.importReport; if(!rep)return;
    const existing=new Set(this.state.companies.map(c=>c.empresa.toLowerCase().trim()));
    const c=JSON.parse(JSON.stringify(this.state.companies)); let added=0;
    const guessProfile=(t)=>{t=(t||'').toLowerCase(); if(t.includes('agencia'))return'Agencias inmobiliarias'; if(t.includes('promotor'))return'Promotoras / Developers'; if(t.includes('construc'))return'Constructoras'; if(t.includes('family'))return'Family Offices'; if(t.includes('fondo'))return'Fondos de inversión'; if(t.includes('prescri')||t.includes('consultora'))return'Prescriptores'; if(t.includes('project'))return'Project Managers'; return'Otro';};
    const nextNum=()=>'FP-'+String(c.length+1).padStart(3,'0');
    rep.rows.forEach(r=>{const nm=(r[rep.nameKey]||'').toString().trim(); if(!nm)return; if(!all&&existing.has(nm.toLowerCase()))return;
      const get=(re)=>{const k=Object.keys(r).find(k=>re.test(k)); return k?(r[k]||'').toString().trim():'';};
      const prof=guessProfile(get(/tipo|perfil/i));
      const nc={id:nextNum(),demo:false,empresa:nm,pais:get(/pais|país|country/i)||'España',ciudad:get(/ciudad|city|zona/i)||'',region:'',zona:get(/zona|activo|foco/i),website:get(/web|url|link/i),linkedin:get(/linkedin/i),
        perfilPrincipal:prof,perfilSecundario:'',modeloNegocio:'',tipoRelacion:'Partner',tipoRaw:get(/tipo/i),capacidadConstructora:prof==='Constructoras',
        research:{descripcion:get(/descrip|por qué|nota/i),clienteObjetivo:'',comoGeneraIngresos:'',servicios:get(/activo|foco|servicio/i),proyectos:'Pendiente de verificar',escala:'',posicionamiento:'',painPoints:'Pendiente de verificar',señales:get(/siguiente|acción/i),fechaResearch:new Date().toISOString().slice(0,10),fuentes:[],nivelConfianza:'Baja',infoPendiente:['Research completo pendiente','Verificar contacto']},
        fit:{dondeEntra:'Pendiente de análisis',hipotesisValor:'Pendiente de análisis',ganaPartner:'',ganaFP:'',diferenciadores:'',riesgos:'',conflictos:'',modeloColaboracion:'Por definir',incentivo:'Por definir',recurrencia:'Por evaluar'},
        scores:{potencial:13,fit:10,valor:8,acceso:7,temporalidad:5,posicionamiento:5,facilidad:3},bonuses:[],penalties:[{label:'Research insuficiente por ahora',pts:3}],scoreProvenance:'pendiente',
        gov:{eligible:true,motivoVisible:'',motivoConfidencial:'',fechaExclusion:'',fechaRevision:'',aprobacionReactivar:false,estadoEstrategico:'Activo',mercadoExcluido:'',excepcion:false,autorizadoPor:'',clasificacionPendiente:prof==='Constructoras'},
        contacto:{nombre:get(/contacto|nombre/i),cargo:get(/cargo/i),email:get(/email|correo/i),telefono:get(/tel/i),linkedin:get(/linkedin/i),relacion:'Importado',introDisponible:false,personaIntro:'',nivelDecision:'Por determinar',verificado:false},
        pipeline:{estado:'Research estratégico',responsable:'Sin asignar',fechaIncorporacion:new Date().toISOString().slice(0,10),ultimaInteraccion:'',proximaAccion:get(/siguiente|acción|próximo/i)||'Completar research y clasificar',fechaProximaAccion:'',materialEnviado:'',reunionRealizada:false,propuestaEnviada:false,resultado:'',notas:get(/nota/i),prioridadOriginal:'',historial:[{date:new Date().toISOString().slice(0,10),who:'Importación',text:'Empresa importada desde '+rep.file}]}};
      this.mod.applyEligibility(nc,this.state.ruleActive); c.push(nc); existing.add(nm.toLowerCase()); added++;});
    this.persist(c,{importReport:null,view:'master'}); this.toast(added+' empresas importadas y clasificadas');
  }

  // ================= FICHA =================
  openFicha=(id,scrollTo)=>{ this.setState({selectedId:id,edit:false,draft:null}); if(scrollTo) this._scrollTo=scrollTo; else this._scrollTo=null; };
  closeFicha=()=>this.setState({selectedId:null,edit:false,draft:null});
  startEdit=()=>{ const c=this.state.companies.find(x=>x.id===this.state.selectedId); this.setState({edit:true,draft:JSON.parse(JSON.stringify(c))}); };
  cancelEdit=()=>this.setState({edit:false,draft:null});
  saveEdit=()=>{ const c=JSON.parse(JSON.stringify(this.state.companies)); const idx=c.findIndex(x=>x.id===this.state.selectedId); const d=this.state.draft;
    d.scoreProvenance='manual'; this.mod.applyEligibility(d,this.state.ruleActive);
    d.pipeline.historial=d.pipeline.historial||[]; d.pipeline.historial.unshift({date:new Date().toISOString().slice(0,10),who:'Edición manual',text:'Ficha actualizada manualmente (datos y/o score).'});
    c[idx]=d; this.persist(c,{edit:false,draft:null}); this.toast('Cambios guardados · ranking actualizado'); };
  df=(path,val)=>{ const d=JSON.parse(JSON.stringify(this.state.draft)); const ks=path.split('.'); let o=d; for(let i=0;i<ks.length-1;i++)o=o[ks[i]]; o[ks[ks.length-1]]=val; this.setState({draft:d}); };
  markVerified=()=>{ const c=JSON.parse(JSON.stringify(this.state.companies)); const x=c.find(y=>y.id===this.state.selectedId); x.contacto.verificado=!x.contacto.verificado;
    x.pipeline.historial.unshift({date:new Date().toISOString().slice(0,10),who:'Sistema',text:x.contacto.verificado?'Contacto marcado como verificado.':'Verificación de contacto retirada.'}); this.persist(c); this.toast(x.contacto.verificado?'Contacto verificado':'Verificación retirada'); };
  async aiResearch(){
    const c=this.state.companies.find(x=>x.id===this.state.selectedId); if(!c)return;
    if(false){ this.toast('Asistente IA no disponible en este entorno','danger'); return; }
    this.setState({aiBusy:true});
    try{
      const prompt='Eres analista de Business Development de Forma Prima, estudio de arquitectura residencial high-end en Madrid. A partir SOLO de estos datos conocidos de una empresa (no inventes datos privados; si no hay evidencia escribe "Pendiente de verificar"), redacta una hipótesis comercial concreta.\n\nEmpresa: '+c.empresa+'\nPerfil: '+c.perfilPrincipal+'\nZona: '+c.zona+'\nActividad conocida: '+c.research.descripcion+'\nModelo de colaboración base: '+c.fit.modeloColaboracion+'\n\nDevuelve JSON con claves exactas: {"executiveSummary": string (max 90 palabras), "painPoints": string, "dondeEntra": string, "ganaPartner": string, "ganaFP": string, "señalOportunidad": string}. Solo JSON, sin markdown.';
      const res=await this.aiComplete(prompt);
      let obj; try{ obj=JSON.parse(res.replace(/```json|```/g,'').trim()); }catch(e){ obj=null; }
      const cc=JSON.parse(JSON.stringify(this.state.companies)); const x=cc.find(y=>y.id===this.state.selectedId);
      if(obj){ if(obj.executiveSummary)x.research.descripcion=obj.executiveSummary; if(obj.painPoints)x.research.painPoints=obj.painPoints; if(obj.dondeEntra)x.fit.dondeEntra=obj.dondeEntra; if(obj.ganaPartner)x.fit.ganaPartner=obj.ganaPartner; if(obj.ganaFP)x.fit.ganaFP=obj.ganaFP; if(obj['señalOportunidad'])x.research['señales']=obj['señalOportunidad'];
        x.research.nivelConfianza='Media'; x.research.aiGenerated=true;
        x.pipeline.historial.unshift({date:new Date().toISOString().slice(0,10),who:'Asistente IA',text:'Research redactado por IA a partir de datos conocidos (verificar antes de usar).'});
        this.persist(cc); this.toast('Research IA generado — revisar y verificar'); }
      else { this.toast('Respuesta IA no interpretable — reintenta','danger'); }
    }catch(e){ this.toast('Error IA: '+e.message,'danger'); }
    this.setState({aiBusy:false});
  }
  renderOverlay(){
    const {C,F}=this, h=this.h.bind(this); const id=this.state.selectedId;
    if(this.state.addOpen) return this.renderAddModal();
    if(!id) return null;
    const c=this._e.all.find(x=>x.id===id); if(!c) return null;
    const edit=this.state.edit, d=edit?this.state.draft:c;
    const m=this.mod, score=c._score, tier=m.tierOf(score);
    const eligible=c.gov.eligible!==false;
    const st=this.entryStrategy(c);
    const sectionT=(n,t)=>h('div',{style:{display:'flex',alignItems:'center',gap:10,margin:'26px 0 12px'}},
      h('span',{style:{fontFamily:F.mono,fontSize:11,color:C.accent}},String(n).padStart(2,'0')),
      h('span',{style:{fontSize:11,letterSpacing:'.18em',color:C.ink2,fontWeight:600,textTransform:'uppercase'}},t),
      h('span',{style:{flex:1,height:1,background:C.line}}));
    const field=(label,value,prov)=>h('div',{style:{marginBottom:11}},
      h('div',{style:{fontSize:10,letterSpacing:'.1em',color:C.ink3,fontWeight:600,textTransform:'uppercase',marginBottom:3,display:'flex',gap:8,alignItems:'center'}},label,prov?this.provBadge(prov):null),
      h('div',{style:{fontSize:12.5,color:C.ink2,lineHeight:1.55}},value||h('span',{style:{color:C.faint}},'—')));
    const inp=(path,ph,area)=>h(area?'textarea':'input',{value:this.getPath(d,path)||'',placeholder:ph,onChange:ev=>this.df(path,ev.target.value),rows:area?3:undefined,
      style:{width:'100%',padding:'7px 9px',fontSize:12.5,border:'1px solid '+C.line2,borderRadius:2,background:C.panel,outline:'none',resize:'vertical',lineHeight:1.5}});
    return h('div',{key:'ov',onClick:this.closeFicha,style:{position:'fixed',inset:0,background:'rgba(20,17,15,.42)',zIndex:60,display:'flex',justifyContent:'flex-end',animation:'fpfade .2s'}},
      h('div',{className:'fps',onClick:ev=>ev.stopPropagation(),style:{width:'min(760px,92vw)',height:'100%',background:C.bg,overflowY:'auto',animation:'fpslide .28s',boxShadow:'-10px 0 40px rgba(0,0,0,.18)'}},
        // header
        h('div',{style:{position:'sticky',top:0,zIndex:2,background:C.ink,color:'#efe9dd',padding:'20px 30px'}},
          h('div',{style:{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:16}},
            h('div',{style:{flex:1}},
              h('div',{style:{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}},
                h('span',{style:{fontFamily:F.mono,fontSize:11,color:'#8a8172'}},c.id),
                h('span',{style:{fontSize:11,color:'#8a8172'}},c.pais+' · '+c.ciudad)),
              h('div',{style:{fontSize:24,fontWeight:600,marginTop:5,color:'#fff'}},c.empresa),
              h('div',{style:{fontSize:12,color:'#c9c2b4',marginTop:3}},c.perfilPrincipal+(c.perfilSecundario?' · '+c.perfilSecundario:'')+' · '+c.pipeline.estado),
              h('div',{style:{marginTop:8}},this.tag(c._m.partnershipType,'#d8cfbf','rgba(216,207,191,.12)'))),
            h('div',{style:{textAlign:'right'}},
              h('div',{style:{fontFamily:F.mono,fontSize:36,fontWeight:500,color:tier.tier<=2?'#c98f5a':'#c9c2b4',lineHeight:1}},score),
              h('div',{style:{fontSize:10,color:'#8a8172',marginTop:4}},tier.label.split('—')[0]),
              h('div',{style:{marginTop:6}},this.tag(eligible?'Elegible':'No elegible',eligible?'#8fae82':'#c98479',eligible?'rgba(143,174,130,.14)':'rgba(201,132,121,.16)')))),
          h('div',{style:{display:'flex',gap:8,marginTop:16,flexWrap:'wrap'}},
            edit?h('div',{style:{display:'flex',gap:8}},
              h('button',{onClick:this.saveEdit,style:{padding:'7px 15px',fontSize:11.5,fontWeight:600,background:'#9a6b3f',color:'#fff',border:'none',borderRadius:2}},'Guardar cambios'),
              h('button',{onClick:this.cancelEdit,style:{padding:'7px 15px',fontSize:11.5,fontWeight:600,background:'transparent',color:'#c9c2b4',border:'1px solid #3a352e',borderRadius:2}},'Cancelar')):
            h('div',{style:{display:'flex',gap:8,flexWrap:'wrap'}},
              h('button',{onClick:this.startEdit,style:{padding:'7px 15px',fontSize:11.5,fontWeight:600,background:'#efe9dd',color:'#1b1916',border:'none',borderRadius:2}},'✎ Editar'),
              h('button',{onClick:()=>this.aiResearch(),disabled:this.state.aiBusy,style:{padding:'7px 15px',fontSize:11.5,fontWeight:600,background:'transparent',color:'#c98f5a',border:'1px solid #6b5236',borderRadius:2,opacity:this.state.aiBusy?.6:1}},this.state.aiBusy?'Generando…':'✦ Research IA'),
              h('button',{onClick:()=>this.generarLead(c.id),title:'Crear un lead en Captación a partir de este partner',style:{padding:'7px 15px',fontSize:11.5,fontWeight:600,background:c.pipeline&&c.pipeline.leadGeneradoId?'transparent':this.C.accent,color:c.pipeline&&c.pipeline.leadGeneradoId?'#c98f5a':'#fff',border:c.pipeline&&c.pipeline.leadGeneradoId?'1px solid #6b5236':'none',borderRadius:2}},c.pipeline&&c.pipeline.leadGeneradoId?'Lead generado →':'+ Generar lead'),
              h('button',{onClick:this.markVerified,style:{padding:'7px 15px',fontSize:11.5,fontWeight:600,background:'transparent',color:c.contacto.verificado?'#8fae82':'#c9c2b4',border:'1px solid #3a352e',borderRadius:2}},c.contacto.verificado?'✓ Verificado':'Marcar verificado'),
              h('button',{onClick:this.closeFicha,style:{padding:'7px 15px',fontSize:11.5,fontWeight:600,background:'transparent',color:'#c9c2b4',border:'1px solid #3a352e',borderRadius:2}},'Cerrar ✕'))),
        ),
        h('div',{style:{padding:'4px 30px 60px'}},
          c.gov.clasificacionPendiente?h('div',{style:{marginTop:16,padding:'10px 14px',background:C.dangerSoft,border:'1px solid '+C.danger+'33',borderRadius:2,fontSize:11.5,color:C.danger}},'⚠ Clasificación pendiente de revisión — combina promoción y construcción. Validar perfil principal antes de activar outreach.'):null,
          // STRATEGIC RECOMMENDATION (30s)
          this.strategicRecoPanel(c,eligible),
          // metrics row
          h('div',{style:{marginTop:14}},this.metricRow(c)),
          // S1 executive summary
          sectionT(1,'Executive Summary'),
          edit?inp('research.descripcion','Resumen ejecutivo',true):field('Resumen estratégico',d.research.descripcion,c.research.aiGenerated?'inferido-ia':'inferido'),
          // decision panel
          h('div',{style:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginTop:6}},
            this.qa('¿Debemos contactar?',eligible?(c._tier<=3?'Sí — prioridad '+tier.label.split('—')[1]:'Solo con nueva señal'):'No — excluida por decisión interna'),
            this.qa('¿Por qué ahora?',c.pipeline.proximaAccion?c.pipeline.proximaAccion:tier.rec),
            this.qa('¿Es elegible para activación?',eligible?'Sí':'No — '+c.gov.motivoVisible),
            this.qa('¿Qué haría cambiar su prioridad?','Introducción cálida a decisor, oportunidad concreta o señal de expansión.')),
          // S2 business model
          sectionT(2,'Business Model'),
          h('div',{style:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0 24px'}},
            field('Modelo de negocio',c.modeloNegocio,'inferido'),field('Cliente objetivo',c.research.clienteObjetivo,'inferido'),
            field('Cómo genera ingresos',c.research.comoGeneraIngresos,'inferido'),field('Servicios / activos',c.research.servicios,'publico'),
            field('Escala y zona',c.research.escala,'confirmado'),field('Posicionamiento',c.research.posicionamiento,'inferido')),
          // S3 strategic fit
          sectionT(3,'Strategic Fit'),
          edit?h('div',null,inp('fit.dondeEntra','Dónde entra Forma Prima',true),h('div',{style:{height:8}}),inp('fit.hipotesisValor','Hipótesis de valor',true)):h('div',null,
            field('Dónde entra Forma Prima',c.fit.dondeEntra,'inferido'),
            field('Hipótesis de valor',c.fit.hipotesisValor,'inferido'),
            h('div',{style:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0 24px'}},
              field('Qué gana el partner',c.fit.ganaPartner,'inferido'),field('Qué gana Forma Prima',c.fit.ganaFP,'inferido'),
              field('Diferenciadores relevantes',c.fit.diferenciadores,'inferido'),field('Riesgos / conflictos',c.fit.riesgos+' · '+c.fit.conflictos,'inferido'))),
          // S4 score breakdown
          sectionT(4,'Score Breakdown'),
          this.scoreBreakdown(c,edit,d),
          // S5 collaboration
          sectionT(5,'Collaboration Model'),
          h('div',{style:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0 24px'}},
            field('Tipo de partnership',c.fit.modeloColaboracion,'inferido'),field('Incentivo recomendado',c.fit.incentivo,'inferido'),
            field('Potencial de recurrencia',c.fit.recurrencia,'inferido'),field('Primer piloto posible','Un activo / proyecto piloto para validar el encaje antes de formalizar.','inferido')),
          // S6 entry strategy
          sectionT(6,'Entry Strategy'),
          eligible?h('div',{style:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0 24px'}},
            field('Objetivo de la conversación',st.objetivo,'inferido'),field('Persona ideal a contactar',st.persona,c.contacto.nombre?'confirmado':'inferido'),
            field('Cargo alternativo',st.cargoAlt,'inferido'),field('Canal de entrada',st.canal,'inferido'),
            field('Introducción cálida',st.introCalida,c.contacto.introDisponible?'confirmado':'pendiente'),field('Mensaje de apertura',st.mensaje,'inferido'),
            field('Credencial a mostrar',st.credencial,'inferido'),field('Material recomendado',st.material,'inferido'),
            field('CTA',st.cta,'inferido'),field('Follow-up',st.followUp,'inferido'),
            field('Tiempo estimado a reunión',st.tiempo,'inferido'),field('Nivel de dificultad',st.dificultad,'inferido')):
            h('div',{style:{padding:'18px 20px',background:C.dangerSoft,borderRadius:2,fontSize:12.5,color:C.danger,lineHeight:1.6}},'🔒 Estrategia de entrada bloqueada. Esta empresa no es elegible para outreach activo por decisión interna. '+(c.gov.motivoVisible||'')+' No se genera estrategia salvo autorización manual del administrador.'),
          // S7 research sources
          sectionT(7,'Research Sources'),
          h('div',{style:{fontSize:12,color:C.ink2,lineHeight:1.7}},
            h('div',null,h('span',{style:{color:C.ink3}},'Fecha de research: '),c.research.fechaResearch+' · Confianza: '+c.research.nivelConfianza),
            c.research.fuentes&&c.research.fuentes.length?c.research.fuentes.map((f,i)=>h('div',{key:i},h('a',{href:f,target:'_blank'},f))):h('div',{style:{color:C.faint}},'Fuentes públicas pendientes de registrar'),
            h('div',{style:{marginTop:8,color:C.ink3}},'Pendiente de verificar: '+(c.research.infoPendiente||[]).join(' · '))),
          // S8 history
          sectionT(8,'Activity History'),
          edit?h('div',null,inp('pipeline.proximaAccion','Próxima acción'),h('div',{style:{height:8}}),inp('pipeline.notas','Notas',true)):
          h('div',{style:{display:'flex',flexDirection:'column',gap:0}},
            c.pipeline.notas?h('div',{style:{fontSize:12,color:C.ink2,padding:'8px 12px',background:C.panel,border:'1px solid '+C.line,borderRadius:2,marginBottom:10}},h('b',{style:{color:C.ink3}},'Notas: '),c.pipeline.notas):null,
            (c.pipeline.historial||[]).map((hh,i)=>h('div',{key:i,style:{display:'flex',gap:12,padding:'8px 0',borderBottom:'1px solid '+C.line}},
              h('span',{style:{fontFamily:F.mono,fontSize:10.5,color:C.faint,width:78,flex:'none'}},hh.date),
              h('span',{style:{fontSize:12,color:C.ink2}},h('b',{style:{color:C.ink3}},hh.who+': '),hh.text)))),
          // S9 governance
          sectionT(9,'Governance'),
          h('div',{style:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0 24px'}},
            field('Eligible for Active Outreach',eligible?'Sí':'No'),field('Estado estratégico',c.gov.estadoEstrategico),
            field('Motivo de exclusión visible',c.gov.motivoVisible||'—'),field('Mercado excluido',c.gov.mercadoExcluido||'—'),
            field('Fecha de revisión',c.gov.fechaRevision||'—'),field('Aprobación para reactivar',c.gov.aprobacionReactivar?'Requerida':'No requerida'),
            field('Excepción autorizada',c.gov.excepcion?'Sí — '+(c.gov.autorizadoPor||''):'No'),field('Provenance del score',c.scoreProvenance)),
          // S10 strategic notes (editable)
          sectionT(10,'Strategic Notes'),
          this.strategicNotesBlock(c,edit,d,inp),
          // S11 strategic playbook
          sectionT(11,'Strategic Playbook'),
          this.playbookBlock(c,edit,d,inp),
          h('div',{style:{marginTop:26,fontSize:9.5,letterSpacing:'.1em',color:C.faint,textAlign:'center'}},'STRICTLY CONFIDENTIAL — INTERNAL USE ONLY — PROPIEDAD DE FORMA PRIMA'))));
  }
  strategicRecoPanel(c,eligible){ const {C,F}=this, h=this.h.bind(this); const r=this.mod.strategicRecommendation(c);
    const recCol={'Contactar':C.accent,'Priorizar':C.accentD,'Nutrir':C.ink2,'Pausar':C.warn,'No activar':C.danger}[r.recomendacion]||C.ink2;
    return h('div',{style:{marginTop:16,background:C.panel,border:'1px solid '+C.line,borderLeft:'3px solid '+recCol,borderRadius:3,padding:'16px 18px'}},
      h('div',{style:{display:'flex',alignItems:'center',gap:10,marginBottom:12}},
        h('span',{style:{fontSize:10.5,letterSpacing:'.16em',color:C.accent,fontWeight:600}},'STRATEGIC RECOMMENDATION'),
        h('span',{style:{flex:1,height:1,background:C.line}}),
        this.tag(r.recomendacion.toUpperCase(),recCol)),
      h('div',{style:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px 22px'}},
        h('div',null,h('div',{style:{fontSize:10,letterSpacing:'.1em',color:C.ink3,fontWeight:600,marginBottom:5}},'POR QUÉ IMPORTA'),
          h('ul',{style:{margin:0,paddingLeft:16,fontSize:12,color:C.ink2,lineHeight:1.55}},r.porQueImporta.map((x,i)=>h('li',{key:i},x)))),
        h('div',null,
          h('div',{style:{fontSize:10,letterSpacing:'.1em',color:C.ink3,fontWeight:600,marginBottom:5}},'POR QUÉ AHORA'),
          h('div',{style:{fontSize:12,color:C.ink2,lineHeight:1.5,marginBottom:11}},r.porQueAhora),
          h('div',{style:{fontSize:10,letterSpacing:'.1em',color:C.ink3,fontWeight:600,marginBottom:5}},'RIESGO PRINCIPAL'),
          h('div',{style:{fontSize:12,color:C.warn,lineHeight:1.5}},r.riesgo))),
      h('div',{style:{marginTop:12,paddingTop:11,borderTop:'1px solid '+C.line}},
        h('span',{style:{fontSize:10,letterSpacing:'.1em',color:C.ink3,fontWeight:600}},'PRÓXIMA ACCIÓN  '),
        h('span',{style:{fontSize:12.5,color:C.ink,fontWeight:500}},r.proximaAccion)));
  }
  strategicNotesBlock(c,edit,d,inp){ const {C}=this, h=this.h.bind(this); const sn=(edit?d:c).strategicNotes||{};
    const rows=[['queDecir','Qué decir'],['queNoDecir','Qué NO decir'],['comoPosicionar','Cómo posicionar Forma Prima'],['credencial','Qué credencial mostrar'],['material','Qué material enviar'],['quienLidera','Quién lidera'],['quienSeguimiento','Quién hace seguimiento'],['resultadoBuscado','Qué resultado buscamos'],['riesgos','Riesgos'],['conflictos','Conflictos potenciales'],['observaciones','Observaciones internas']];
    return h('div',{style:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:edit?'10px 20px':'2px 24px'}}, rows.map(([k,label])=>h('div',{key:k,style:{marginBottom:edit?0:9}},
      h('div',{style:{fontSize:10,letterSpacing:'.08em',color:k==='queNoDecir'?C.warn:C.ink3,fontWeight:600,textTransform:'uppercase',marginBottom:3}},label),
      edit?inp('strategicNotes.'+k,label,k==='queDecir'||k==='queNoDecir'||k==='observaciones'):h('div',{style:{fontSize:12,color:k==='queNoDecir'?C.warn:C.ink2,lineHeight:1.5}},sn[k]||h('span',{style:{color:C.faint}},'—')))));
  }
  playbookBlock(c,edit,d,inp){ const {C}=this, h=this.h.bind(this); const pb=(edit?d:c).playbook||{};
    const rows=[['thesis','1 · Strategic Thesis','¿Por qué merece tiempo esta empresa?'],['howToWin','2 · How to Win','¿Cómo conseguimos trabajar con ellos?'],['firstMeetingGoal','3 · First Meeting Goal','¿Qué debe ocurrir en la primera reunión?'],['firstPilot','4 · First Pilot','¿Cuál sería el mejor proyecto inicial?'],['longTermVision','5 · Long-Term Vision','¿Cómo sería la relación ideal?'],['exitCriteria','6 · Exit Criteria','¿Cuándo dejamos de invertir tiempo?'],['nextDecision','7 · Next Decision','¿Qué decisión debe tomar el equipo?']];
    return h('div',{style:{display:'flex',flexDirection:'column',gap:edit?10:2}}, rows.map(([k,label,q])=>h('div',{key:k,style:{padding:edit?0:'10px 0',borderBottom:edit?'none':'1px solid '+C.line}},
      h('div',{style:{fontSize:11,fontWeight:600,color:C.ink}},label),
      h('div',{style:{fontSize:10,color:C.faint,marginBottom:edit?5:3}},q),
      edit?inp('playbook.'+k,label,true):h('div',{style:{fontSize:12.5,color:C.ink2,lineHeight:1.55}},pb[k]||h('span',{style:{color:C.faint}},'Pendiente de definir')))));
  }
  getPath(o,p){ return p.split('.').reduce((a,k)=>a&&a[k],o); }
  qa(q,a){ const {C}=this; return this.h('div',{style:{padding:'10px 13px',background:this.C.panel,border:'1px solid '+C.line,borderRadius:2}},
    this.h('div',{style:{fontSize:11,fontWeight:600,color:C.ink,marginBottom:3}},q),
    this.h('div',{style:{fontSize:11.5,color:C.ink2,lineHeight:1.45}},a)); }
  scoreBreakdown(c,edit,d){
    const {C,F}=this, h=this.h.bind(this), m=this.mod;
    return h('div',null,
      h('div',{style:{display:'flex',flexDirection:'column',gap:9}}, m.SCORE_KEYS.map(k=>{const v=(edit?d.scores[k]:c.scores[k]); const mx=m.SCORE_MAX[k];
        return h('div',{key:k,style:{display:'flex',alignItems:'center',gap:12}},
          h('div',{style:{width:210,fontSize:11.5,color:C.ink2}},m.SCORE_LABELS[k],h('span',{style:{color:C.faint}},' /'+mx)),
          h('div',{style:{flex:1,height:8,background:C.bg,borderRadius:1}},h('div',{style:{width:(v/mx*100)+'%',height:'100%',background:C.accent,borderRadius:1}})),
          edit?h('input',{type:'number',min:0,max:mx,value:v,onChange:ev=>this.df('scores.'+k,Math.max(0,Math.min(mx,+ev.target.value||0))),style:{width:52,padding:'4px 6px',fontFamily:F.mono,fontSize:11,border:'1px solid '+C.line2,borderRadius:2,textAlign:'right'}}):
            h('span',{style:{fontFamily:F.mono,fontSize:12,color:C.ink,width:44,textAlign:'right'}},v+'/'+mx));})),
      h('div',{style:{marginTop:14,display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}},
        h('div',null,h('div',{style:{fontSize:10.5,letterSpacing:'.1em',color:C.ok,fontWeight:600,marginBottom:6}},'BONIFICACIONES'),
          (c.bonuses||[]).length?c.bonuses.map((b,i)=>h('div',{key:i,style:{display:'flex',justifyContent:'space-between',fontSize:11.5,color:C.ink2,padding:'3px 0'}},h('span',null,b.label),h('span',{style:{fontFamily:F.mono,color:C.ok}},'+'+b.pts))):h('div',{style:{fontSize:11.5,color:C.faint}},'Ninguna')),
        h('div',null,h('div',{style:{fontSize:10.5,letterSpacing:'.1em',color:C.danger,fontWeight:600,marginBottom:6}},'PENALIZACIONES'),
          (c.penalties||[]).length?c.penalties.map((b,i)=>h('div',{key:i,style:{display:'flex',justifyContent:'space-between',fontSize:11.5,color:C.ink2,padding:'3px 0'}},h('span',null,b.label),h('span',{style:{fontFamily:F.mono,color:C.danger}},'−'+b.pts))):h('div',{style:{fontSize:11.5,color:C.faint}},'Ninguna'))),
      h('div',{style:{marginTop:12,padding:'10px 14px',background:C.panel,border:'1px solid '+C.line,borderRadius:2,fontSize:11.5,color:C.ink2,lineHeight:1.5}},
        h('b',{style:{color:C.ink}},'Justificación: '),'Suma de criterios '+m.SCORE_KEYS.reduce((a,k)=>a+c.scores[k],0)+' + bonificaciones '+(c.bonuses||[]).reduce((a,x)=>a+x.pts,0)+' − penalizaciones '+(c.penalties||[]).reduce((a,x)=>a+x.pts,0)+' = '+c._score+'/100 → '+m.tierOf(c._score).label+'.'));
  }
  renderAddModal(){
    const {C,F}=this, h=this.h.bind(this); const d=this.state.addDraft||{empresa:'',pais:'España',ciudad:'',perfilPrincipal:'Agencias inmobiliarias',zona:''};
    const set=(k,v)=>this.setState({addDraft:Object.assign({},d,{[k]:v})});
    const inp=(k,ph)=>h('input',{value:d[k]||'',placeholder:ph,onChange:ev=>set(k,ev.target.value),style:{width:'100%',padding:'9px 11px',fontSize:12.5,border:'1px solid '+C.line2,borderRadius:2,marginTop:5,outline:'none'}});
    return h('div',{key:'add',onClick:()=>this.setState({addOpen:false,addDraft:null}),style:{position:'fixed',inset:0,background:'rgba(20,17,15,.42)',zIndex:70,display:'flex',alignItems:'center',justifyContent:'center',animation:'fpfade .2s'}},
      h('div',{onClick:ev=>ev.stopPropagation(),style:{width:'min(460px,92vw)',background:C.bg,borderRadius:4,padding:'26px 28px',boxShadow:'0 20px 60px rgba(0,0,0,.28)'}},
        h('div',{style:{fontSize:17,fontWeight:600,color:C.ink}},'Añadir empresa'),
        h('div',{style:{fontSize:11.5,color:C.ink3,marginTop:4,marginBottom:16}},'Se creará con score pendiente y entrará en Research Queue para completar.'),
        h('label',{style:{fontSize:10.5,letterSpacing:'.08em',color:C.ink3,fontWeight:600}},'EMPRESA'),inp('empresa','Nombre de la empresa'),
        h('div',{style:{display:'flex',gap:10,marginTop:12}},
          h('div',{style:{flex:1}},h('label',{style:{fontSize:10.5,letterSpacing:'.08em',color:C.ink3,fontWeight:600}},'PAÍS'),
            h('select',{value:d.pais,onChange:ev=>set('pais',ev.target.value),style:{width:'100%',padding:'9px 11px',fontSize:12.5,border:'1px solid '+C.line2,borderRadius:2,marginTop:5,background:C.panel}},['España','Ecuador','México'].map(p=>h('option',{key:p},p)))),
          h('div',{style:{flex:1}},h('label',{style:{fontSize:10.5,letterSpacing:'.08em',color:C.ink3,fontWeight:600}},'CIUDAD'),inp('ciudad','Ciudad'))),
        h('div',{style:{marginTop:12}},h('label',{style:{fontSize:10.5,letterSpacing:'.08em',color:C.ink3,fontWeight:600}},'PERFIL PRINCIPAL'),
          h('select',{value:d.perfilPrincipal,onChange:ev=>set('perfilPrincipal',ev.target.value),style:{width:'100%',padding:'9px 11px',fontSize:12.5,border:'1px solid '+C.line2,borderRadius:2,marginTop:5,background:C.panel}},this.mod.PROFILES.map(p=>h('option',{key:p},p)))),
        h('div',{style:{marginTop:12}},h('label',{style:{fontSize:10.5,letterSpacing:'.08em',color:C.ink3,fontWeight:600}},'ZONA / FOCO'),inp('zona','Zona principal o activo/foco')),
        h('div',{style:{display:'flex',gap:10,marginTop:22,justifyContent:'flex-end'}},
          h('button',{onClick:()=>this.setState({addOpen:false,addDraft:null}),style:{padding:'9px 16px',fontSize:12,fontWeight:600,background:'transparent',color:C.ink3,border:'1px solid '+C.line2,borderRadius:2}},'Cancelar'),
          h('button',{onClick:()=>this.addCompany(),style:{padding:'9px 16px',fontSize:12,fontWeight:600,background:C.ink,color:'#fff',border:'none',borderRadius:2}},'Crear empresa'))));
  }
  addCompany=()=>{ const d=this.state.addDraft; if(!d||!d.empresa){this.toast('Indica el nombre de la empresa','danger');return;}
    const c=JSON.parse(JSON.stringify(this.state.companies)); const id='FP-'+String(c.length+1).padStart(3,'0'); const today=new Date().toISOString().slice(0,10);
    const isC=d.perfilPrincipal==='Constructoras';
    const nc={id,demo:false,empresa:d.empresa,pais:d.pais,ciudad:d.ciudad||'',region:d.pais==='España'?'':'',zona:d.zona||'',website:'',linkedin:'',
      perfilPrincipal:d.perfilPrincipal,perfilSecundario:'',modeloNegocio:'',tipoRelacion:'Partner',tipoRaw:'',capacidadConstructora:isC,
      research:{descripcion:'Pendiente de research.',clienteObjetivo:'',comoGeneraIngresos:'',servicios:d.zona||'',proyectos:'Pendiente de verificar',escala:d.ciudad,posicionamiento:'',painPoints:'Pendiente de verificar',señales:'',fechaResearch:today,fuentes:[],nivelConfianza:'Baja',infoPendiente:['Research completo','Contacto','Verificación']},
      fit:{dondeEntra:'Pendiente de análisis',hipotesisValor:'Pendiente de análisis',ganaPartner:'',ganaFP:'',diferenciadores:'',riesgos:'',conflictos:'',modeloColaboracion:'Por definir',incentivo:'Por definir',recurrencia:'Por evaluar'},
      scores:{potencial:12,fit:10,valor:7,acceso:6,temporalidad:4,posicionamiento:5,facilidad:3},bonuses:[],penalties:[{label:'Research insuficiente por ahora',pts:3}],scoreProvenance:'pendiente',
      gov:{eligible:true,motivoVisible:'',motivoConfidencial:'',fechaExclusion:'',fechaRevision:'',aprobacionReactivar:false,estadoEstrategico:'Activo',mercadoExcluido:'',excepcion:false,autorizadoPor:'',clasificacionPendiente:isC},
      contacto:{nombre:'',cargo:'',email:'',telefono:'',linkedin:'',relacion:'Alta manual',introDisponible:false,personaIntro:'',nivelDecision:'Por determinar',verificado:false},
      pipeline:{estado:'Identificación',responsable:'Sin asignar',fechaIncorporacion:today,ultimaInteraccion:'',proximaAccion:'Completar research y clasificar perfil',fechaProximaAccion:'',materialEnviado:'',reunionRealizada:false,propuestaEnviada:false,resultado:'',notas:'',prioridadOriginal:'',historial:[{date:today,who:'Alta manual',text:'Empresa añadida manualmente al CRM.'}]}};
    this.mod.applyEligibility(nc,this.state.ruleActive); c.push(nc); this.persist(c,{addOpen:false,addDraft:null,selectedId:id}); this.toast('Empresa creada — completa su research'); };

  // ---- metric / partnership atoms ----
  ptBadge(type){ const {C}=this; return this.tag(type, C.ink2, '#efe9dd'); }
  metricChip(label,value,kind){ const {C,F}=this;
    let col=C.ink2;
    if(kind==='ebv'||kind==='ptc') col=/Muy alt|Alta|Muy alta|Alto/.test(value)?C.accent:/Medi/.test(value)?C.ink2:C.ink3;
    if(kind==='effort') col=value==='Bajo'?C.ok:value==='Medio'?C.ink2:C.warn;
    if(kind==='roe') col=/inmediata|Alto retorno/.test(value)?C.ok:/medio/.test(value)?C.ink2:/No recomendable/.test(value)?C.danger:C.ink3;
    return this.h('div',{style:{flex:'1 1 90px',minWidth:88}},
      this.h('div',{style:{fontSize:8.5,letterSpacing:'.1em',color:C.ink3,fontWeight:600,textTransform:'uppercase'}},label),
      this.h('div',{style:{fontSize:12.5,fontWeight:600,color:col,marginTop:3}},value)); }
  metricRow(c){ const {C}=this, h=this.h.bind(this), m=c._m||this.mod.deriveMetrics(c);
    return h('div',{style:{display:'flex',flexWrap:'wrap',gap:'12px 8px',padding:'13px 16px',background:C.panel,border:'1px solid '+C.line,borderRadius:3,alignItems:'center'}},
      this.metricChip('Expected Business Value',m.ebv,'ebv'),
      this.metricChip('Probability to Convert',m.ptc,'ptc'),
      this.metricChip('Opportunity Timing',m.timing,'timing'),
      this.metricChip('Estimated Effort',m.effort,'effort'),
      this.metricChip('Return on Effort',m.roe,'roe'),
      h('div',{style:{flex:'1 1 120px',minWidth:120,paddingLeft:12,borderLeft:'1px solid '+C.line}},
        h('div',{style:{fontSize:8.5,letterSpacing:'.1em',color:C.ink3,fontWeight:600}},'PARTNERSHIP TYPE'),
        h('div',{style:{marginTop:4}},this.ptBadge(m.partnershipType)))); }

  // ================= LEAD REMINDERS =================
  remAction(id,kind){ const c=JSON.parse(JSON.stringify(this.state.companies)); const x=c.find(y=>y.id===id); if(!x)return;
    if(!x.reminder)x.reminder={};
    if(kind==='atendido'){ x.reminder.status='atendido'; x.lastMeaningfulInteraction=new Date().toISOString().slice(0,10);
      x.pipeline.historial.unshift({date:x.lastMeaningfulInteraction,who:'Lead Reminder',text:'Recordatorio marcado como atendido.'}); this.toast('Marcado como atendido'); }
    else if(kind==='posponer'){ const d=new Date(); d.setDate(d.getDate()+7); x.reminder.snoozeUntil=d.toISOString().slice(0,10); this.toast('Pospuesto 7 días'); }
    this.persist(c); }
  viewReminders(){ const {C,F}=this, h=this.h.bind(this); const rems=this.reminders();
    const crit=rems.filter(r=>r.level==='Crítico'||r.level==='Alto').slice(0,5);
    const rest=rems.filter(r=>!crit.includes(r));
    const lvlCol={'Crítico':C.danger,'Alto':C.warn,'Medio':C.ink2,'Informativo':C.ink3};
    const card=(r)=>h('div',{key:r.id,style:{display:'flex',alignItems:'center',gap:14,padding:'14px 18px',borderBottom:'1px solid '+C.line}},
      h('span',{style:{width:8,height:8,borderRadius:'50%',background:lvlCol[r.level],flex:'none'}}),
      h('div',{style:{flex:1,minWidth:0}},
        h('div',{style:{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}},
          h('button',{onClick:()=>this.openFicha(r.id),style:{border:'none',background:'transparent',padding:0,fontSize:14,fontWeight:600,color:C.ink,cursor:'pointer'}},r.empresa),
          this.tierChip(r.tier),this.tag(r.level,lvlCol[r.level]),h('span',{style:{fontSize:11,color:C.ink3}},r.days!=null?r.days+' días sin movimiento':'')),
        h('div',{style:{fontSize:12,color:C.ink2,marginTop:5}},h('span',{style:{color:C.ink3}},'Motivo: '),r.reason),
        h('div',{style:{fontSize:12,color:C.ink,marginTop:3}},h('span',{style:{color:C.ink3}},'Acción: '),r.action),
        h('div',{style:{fontSize:11,color:C.ink3,marginTop:3}},'Responsable: '+r.responsable+' · EBV '+r.ebv+' · PTC '+r.ptc)),
      h('div',{style:{display:'flex',flexDirection:'column',gap:6}},
        h('button',{onClick:()=>this.remAction(r.id,'atendido'),style:{padding:'6px 11px',fontSize:10.5,fontWeight:600,border:'1px solid '+C.ok,background:C.okSoft,color:C.ok,borderRadius:2,whiteSpace:'nowrap'}},'Atendido'),
        h('button',{onClick:()=>this.remAction(r.id,'posponer'),style:{padding:'6px 11px',fontSize:10.5,fontWeight:600,border:'1px solid '+C.line2,background:C.panel,color:C.ink2,borderRadius:2}},'Posponer'),
        h('button',{onClick:()=>this.navTo('weekly'),style:{padding:'6px 11px',fontSize:10.5,fontWeight:600,border:'1px solid '+C.line2,background:C.panel,color:C.ink2,borderRadius:2}},'Actualizar')));
    return h('div',{key:'rem',style:{padding:'20px 30px 60px',animation:'fpfade .3s'}},
      h('div',{style:{fontSize:12.5,color:C.ink3,marginBottom:16}},rems.length+' recordatorios activos. Reglas simples por Tier, tiempo sin movimiento, introducciones sin usar y próximas acciones vencidas. Las empresas no elegibles quedan excluidas.'),
      crit.length?h('div',{style:{marginBottom:22}},h('div',{style:{fontSize:11,letterSpacing:'.14em',color:C.danger,fontWeight:600,marginBottom:8,textTransform:'uppercase'}},'Críticos y altos ('+crit.length+')'),this.card(crit.map(card))):null,
      rest.length?h('div',null,h('div',{style:{fontSize:11,letterSpacing:'.14em',color:C.ink3,fontWeight:600,marginBottom:8,textTransform:'uppercase'}},'Otros leads para revisar ('+rest.length+')'),this.card(rest.map(card))):null,
      !rems.length?this.card(h('div',{style:{padding:40,textAlign:'center',color:C.faint,fontSize:13}},'Sin recordatorios pendientes. Todo al día.')):null);
  }

  // ================= WEEKLY UPDATE =================
  async weeklyParse(){
    const txt=(this.state.weeklyText||'').trim(); if(!txt){this.toast('Escribe una actualización','danger');return;}
    this.setState({weeklyBusy:true});
    const names=this.state.companies.map(c=>c.empresa);
    let obj=null;
    if(true){
      try{
        const prompt='Eres el asistente del CRM de Business Development de Forma Prima (estudio de arquitectura, Madrid). Interpreta esta nota en lenguaje natural y devuelve SOLO JSON, sin markdown. No inventes datos que no estén en la nota; deja "" si no hay dato.\n\nEmpresas existentes: '+names.join(', ')+'\n\nNota: "'+txt+'"\n\nHoy es 2026-07-14. Devuelve: {"empresa": string (nombre exacto de la lista o el nuevo si se pide añadir), "isNew": bool, "tipo": string (Reunión|Llamada|Email|Visita|Introducción|Nota|Otro), "fechaInteraccion": "YYYY-MM-DD"|"", "persona": string, "resultado": string, "proximaAccion": string, "fechaProxima": "YYYY-MM-DD"|"", "estadoSugerido": string (uno de: Identificación, Research estratégico, Listo para contactar, Primer contacto, Follow-up 1, Follow-up 2, Discovery Meeting, Propuesta personalizada, Negociación, Partnership activo, Oportunidad activa, Pausado), "interes": string (Sin señal|Bajo|Medio|Alto), "materialSolicitado": string, "materialEnviado": string, "introDisponible": bool, "senal": string, "notas": string, "responsable": string}';
        const res=await this.aiComplete(prompt);
        obj=JSON.parse(res.replace(/```json|```/g,'').trim());
      }catch(e){ obj=null; }
    }
    if(!obj) obj=this.weeklyHeuristic(txt, names);
    // match company
    let comp=null;
    if(!obj.isNew){ const low=(obj.empresa||'').toLowerCase(); comp=this.state.companies.find(c=>c.empresa.toLowerCase()===low)||this.state.companies.find(c=>low&&c.empresa.toLowerCase().includes(low))||this.state.companies.find(c=>obj.empresa&&txt.toLowerCase().includes(c.empresa.toLowerCase())); }
    const preview={ raw:txt, isNew:!!obj.isNew&&!comp, empresaId:comp?comp.id:null, empresa:comp?comp.empresa:(obj.empresa||'Nueva empresa'),
      estadoActual:comp?comp.pipeline.estado:'—',
      fields:{ fechaInteraccion:obj.fechaInteraccion||'', tipo:obj.tipo||'Nota', persona:obj.persona||'', resultado:obj.resultado||'', proximaAccion:obj.proximaAccion||'', fechaProxima:obj.fechaProxima||'', estadoSugerido:obj.estadoSugerido||(comp?comp.pipeline.estado:'Identificación'), interes:obj.interes||'', materialSolicitado:obj.materialSolicitado||'', materialEnviado:obj.materialEnviado||'', introDisponible:!!obj.introDisponible, senal:obj.senal||'', notas:obj.notas||txt, responsable:obj.responsable||'' },
      checked:{ fechaInteraccion:true,estadoSugerido:true,proximaAccion:true,fechaProxima:true,interes:!!obj.interes,materialEnviado:!!obj.materialEnviado,materialSolicitado:!!obj.materialSolicitado,introDisponible:!!obj.introDisponible,senal:!!obj.senal,responsable:!!obj.responsable,notas:true },
      thisWeek:true, source: (true)?'IA':'heurística' };
    this.setState({weeklyPreview:preview, weeklyBusy:false});
  }
  weeklyHeuristic(txt, names){
    const low=txt.toLowerCase(); const m=this.mod;
    let empresa=''; let best=0; names.forEach(n=>{ if(low.includes(n.toLowerCase())&&n.length>best){empresa=n;best=n.length;} });
    const isNew=/añadir\s+(nueva\s+)?empresa|nueva empresa:/i.test(txt);
    if(isNew){ const mm=txt.match(/empresa:?\s*([A-Za-zÁÉÍÓÚñÑ0-9 .&-]+?)(?:,|\.|$)/i); empresa=mm?mm[1].trim():empresa; }
    const dates=[]; (txt.match(/(\d{1,2}\s*(?:de\s*)?[a-záéíóú]+(?:\s*(?:de\s*)?\d{4})?)|(\d{1,2}\/\d{1,2}\/\d{2,4})/gi)||[]).forEach(d=>{const iso=m.parseLooseDate(d,2026); if(iso)dates.push(iso);});
    const future=/próxim|visita|jueves|retomar|agendad|siguiente|reunión el|llamar/i;
    let fechaInteraccion='', fechaProxima='';
    if(dates.length){ dates.sort(); if(future.test(low)&&dates.length>1){fechaInteraccion=dates[0];fechaProxima=dates[dates.length-1];} else if(future.test(low)){fechaProxima=dates[0];} else {fechaInteraccion=dates[0];} }
    let tipo='Nota';
    if(/reunión|reunion|visita/.test(low))tipo='Reunión'; else if(/llam/.test(low))tipo='Llamada'; else if(/correo|email|mail/.test(low))tipo='Email'; else if(/introduc/.test(low))tipo='Introducción';
    let estado='';
    if(/visita|reunión|reunion|agendad/.test(low))estado='Discovery Meeting'; else if(/respondió|respondio|interesad|pidió|pidio/.test(low))estado='Follow-up 1'; else if(/no respond|no contest|llam/.test(low))estado='Primer contacto';
    const interes=/interesad|pidió|pidio|quiere|encantad/.test(low)?'Alto':/respondió|respondio/.test(low)?'Medio':'';
    const intro=/introduc|puede present|nos present/.test(low);
    const material=/dossier|selected works|material|propuesta/.test(low)?(txt.match(/(dossier[^.]*|selected works)/i)||[''])[0]:'';
    return {empresa,isNew,tipo,fechaInteraccion,persona:'',resultado:'',proximaAccion:txt.trim(),fechaProxima,estadoSugerido:estado,interes,materialSolicitado:/pidió|solicit|pidan|envíen|enviemos/.test(low)?material:'',materialEnviado:/envié|enviado|mandé/.test(low)?material:'',introDisponible:intro,senal:'',notas:txt.trim(),responsable:''};
  }
  setPrevField(k,v){ const p=JSON.parse(JSON.stringify(this.state.weeklyPreview)); p.fields[k]=v; this.setState({weeklyPreview:p}); }
  togglePrevField(k){ const p=JSON.parse(JSON.stringify(this.state.weeklyPreview)); p.checked[k]=!p.checked[k]; this.setState({weeklyPreview:p}); }
  weeklyApply(){
    const p=this.state.weeklyPreview; if(!p)return;
    if(p.isNew){ this.setState({addOpen:true,addDraft:{empresa:p.empresa,pais:'España',ciudad:'',perfilPrincipal:'Agencias inmobiliarias',zona:p.fields.notas||''},weeklyPreview:null,weeklyText:''}); this.toast('Completa los datos de la nueva empresa'); return; }
    const cs=JSON.parse(JSON.stringify(this.state.companies)); const x=cs.find(y=>y.id===p.empresaId); if(!x){this.toast('Empresa no encontrada','danger');return;}
    const before=JSON.parse(JSON.stringify(x)); const scoreBefore=this.mod.finalScore(x); const m=this.mod.deriveMetrics(x);
    const f=p.fields, ck=p.checked, changes=[]; const rec=(field,oldV,newV)=>{ if(oldV!==newV){changes.push({field,old:''+(oldV||'—'),new:''+(newV||'—')});} };
    if(ck.fechaInteraccion&&f.fechaInteraccion){ rec('Última interacción',x.lastMeaningfulInteraction,f.fechaInteraccion); x.lastMeaningfulInteraction=f.fechaInteraccion; x.pipeline.ultimaInteraccion=f.fechaInteraccion+(f.tipo?' · '+f.tipo:''); }
    if(ck.estadoSugerido&&f.estadoSugerido){ rec('Estado pipeline',x.pipeline.estado,f.estadoSugerido); x.pipeline.estado=f.estadoSugerido; }
    if(ck.proximaAccion&&f.proximaAccion){ rec('Próxima acción',x.pipeline.proximaAccion,f.proximaAccion); x.pipeline.proximaAccion=f.proximaAccion; }
    if(ck.fechaProxima&&f.fechaProxima){ rec('Fecha próxima acción',x.pipeline.fechaProximaAccion,f.fechaProxima); x.pipeline.fechaProximaAccion=f.fechaProxima; }
    if(ck.interes&&f.interes){ rec('Nivel de interés',x.interestLevel,f.interes); x.interestLevel=f.interes; }
    if(ck.materialEnviado&&f.materialEnviado){ rec('Material enviado',x.pipeline.materialEnviado,f.materialEnviado); x.pipeline.materialEnviado=f.materialEnviado; }
    if(ck.materialSolicitado&&f.materialSolicitado){ x.strategicNotes=x.strategicNotes||{}; rec('Material solicitado','',f.materialSolicitado); }
    if(ck.introDisponible&&f.introDisponible){ rec('Introducción disponible',x.contacto.introDisponible?'Sí':'No','Sí'); x.contacto.introDisponible=true; if(f.persona)x.contacto.personaIntro=f.persona; }
    if(ck.senal&&f.senal){ rec('Señal de oportunidad',x.research.señales,f.senal); x.research.señales=f.senal; }
    if(ck.responsable&&f.responsable){ rec('Responsable',x.pipeline.responsable,f.responsable); x.pipeline.responsable=f.responsable; }
    if(ck.notas&&f.notas){ x.pipeline.notas=(x.pipeline.notas?x.pipeline.notas+' · ':'')+f.notas; }
    if(p.thisWeek) x.thisWeekPin=true;
    // recalcular score cuando corresponda (momentum): interacción positiva / avance de etapa
    const positive=/Alto/.test(f.interes)||['Discovery Meeting','Propuesta personalizada','Negociación','Oportunidad activa','Partnership activo'].includes(f.estadoSugerido);
    if(positive && (x.scores.temporalidad||0)<10){ const old=x.scores.temporalidad; x.scores.temporalidad=Math.min(10,(x.scores.temporalidad||0)+1); rec('Score · Temporalidad',old,x.scores.temporalidad); }
    x.weeklyUpdateSource=p.source; x.scoreProvenance='manual'; this.mod.applyEligibility(x,this.state.ruleActive);
    const scoreAfter=this.mod.finalScore(x); const m2=this.mod.deriveMetrics(x);
    x.pipeline.historial.unshift({date:new Date().toISOString().slice(0,10),who:'Weekly Update ('+p.source+')',text:p.raw});
    const entry={id:'W'+Date.now(),date:new Date().toISOString().slice(0,10),text:p.raw,empresaId:x.id,empresa:x.empresa,tipo:f.tipo,changes,scoreBefore,scoreAfter,ptcBefore:m.ptc,ptcAfter:m2.ptc,by:f.responsable||'Equipo BD',status:'aplicado',snapshot:before};
    const wlog=[entry,...this.state.wlog]; this.saveWlog(wlog);
    this.persist(cs,{weeklyPreview:null,weeklyText:''});
    this.toast('Actualización aplicada a '+x.empresa+' · '+changes.length+' cambios');
  }
  viewWeekly(){ const {C,F}=this, h=this.h.bind(this); const p=this.state.weeklyPreview;
    const examples=['Última reunión con BeGrand viernes 10 de julio. Tenemos agendada otra visita el jueves 16.','Promora respondió al correo y pidió que enviemos el dossier residencial.','Llamé a Miguel de Spacio4. No respondió. Hacer follow-up el viernes.','Gilmar está interesado en el modelo de referral del 3%.'];
    const fieldRow=(k,label,type)=>{ const val=p.fields[k]; return h('div',{key:k,style:{display:'flex',alignItems:'flex-start',gap:10,padding:'9px 0',borderBottom:'1px solid '+C.line}},
      h('input',{type:'checkbox',checked:!!p.checked[k],onChange:()=>this.togglePrevField(k),style:{marginTop:4,accentColor:C.accent}}),
      h('div',{style:{width:150,flex:'none',fontSize:11,color:C.ink3,paddingTop:6,fontWeight:600}},label),
      type==='select'?h('select',{value:val,onChange:ev=>this.setPrevField(k,ev.target.value),style:{flex:1,padding:'7px 9px',fontSize:12,border:'1px solid '+C.line2,borderRadius:2,background:C.panel}},this.mod.PIPELINE_STAGES.map(s=>h('option',{key:s,value:s},s))):
      type==='interes'?h('select',{value:val,onChange:ev=>this.setPrevField(k,ev.target.value),style:{flex:1,padding:'7px 9px',fontSize:12,border:'1px solid '+C.line2,borderRadius:2,background:C.panel}},['','Sin señal','Bajo','Medio','Alto'].map(s=>h('option',{key:s,value:s},s||'—'))):
      type==='bool'?h('label',{style:{flex:1,fontSize:12,color:C.ink2,paddingTop:6}},h('input',{type:'checkbox',checked:!!val,onChange:ev=>this.setPrevField(k,ev.target.checked),style:{accentColor:C.accent,marginRight:6}}),'Introducción disponible'):
      h('input',{type:type||'text',value:val,onChange:ev=>this.setPrevField(k,ev.target.value),style:{flex:1,padding:'7px 9px',fontSize:12,border:'1px solid '+C.line2,borderRadius:2,background:C.panel}})); };
    return h('div',{key:'wk',style:{padding:'22px 30px 60px',animation:'fpfade .3s',maxWidth:900}},
      h('div',{style:{display:'grid',gridTemplateColumns:p?'1fr 1fr':'1fr',gap:18,alignItems:'start'}},
        this.card(h('div',{style:{padding:'20px 22px'}},
          h('div',{style:{fontSize:14,fontWeight:600,color:C.ink,marginBottom:4}},'Escribe la actualización'),
          h('div',{style:{fontSize:11.5,color:C.ink3,marginBottom:12,lineHeight:1.55}},'En lenguaje natural. El sistema interpreta empresa, fechas, tipo de interacción, próxima acción y estado — y te muestra una vista previa antes de guardar. Nunca actualiza en silencio.'),
          h('textarea',{value:this.state.weeklyText,onChange:ev=>this.setState({weeklyText:ev.target.value}),placeholder:'Ej.: Última reunión con BeGrand el viernes 10 de julio, agendada visita el jueves 16…',rows:5,style:{width:'100%',padding:'11px 13px',fontSize:13,border:'1px solid '+C.line2,borderRadius:2,resize:'vertical',lineHeight:1.5,outline:'none'}}),
          h('div',{style:{display:'flex',gap:8,marginTop:12,alignItems:'center'}},
            h('button',{onClick:()=>this.weeklyParse(),disabled:this.state.weeklyBusy,style:{padding:'9px 18px',fontSize:12.5,fontWeight:600,background:C.ink,color:'#fff',border:'none',borderRadius:2,opacity:this.state.weeklyBusy?.6:1}},this.state.weeklyBusy?'Interpretando…':'Interpretar →'),
            h('span',{style:{fontSize:10.5,color:C.faint}},(true)?'Interpretación asistida por IA':'Interpretación heurística (IA no disponible)')),
          h('div',{style:{marginTop:16,borderTop:'1px solid '+C.line,paddingTop:12}},
            h('div',{style:{fontSize:10,letterSpacing:'.1em',color:C.ink3,fontWeight:600,marginBottom:7}},'EJEMPLOS'),
            examples.map((ex,i)=>h('button',{key:i,onClick:()=>this.setState({weeklyText:ex}),style:{display:'block',textAlign:'left',width:'100%',padding:'7px 10px',marginBottom:5,fontSize:11.5,color:C.ink2,background:C.bg,border:'1px solid '+C.line,borderRadius:2,lineHeight:1.4}},ex))))),
        p?this.card(h('div',{style:{padding:'20px 22px'}},
          h('div',{style:{display:'flex',justifyContent:'space-between',alignItems:'center'}},
            h('div',{style:{fontSize:11,letterSpacing:'.14em',color:C.accent,fontWeight:600,textTransform:'uppercase'}},'Actualización interpretada'),
            this.tag(p.source==='IA'?'IA':'Heurística',C.ink3)),
          h('div',{style:{fontSize:18,fontWeight:600,color:C.ink,margin:'8px 0 4px'}},p.empresa),
          p.isNew?h('div',{style:{padding:'11px 13px',background:C.accentSoft,borderRadius:2,fontSize:12,color:C.ink2,marginBottom:10}},'Nueva empresa detectada. Al confirmar se abrirá el alta para completar sus datos.'):
          h('div',{style:{fontSize:11.5,color:C.ink3,marginBottom:8}},'Estado actual: '+p.estadoActual+' → sugerido: '+(p.fields.estadoSugerido||'—')),
          !p.isNew?h('div',null,
            fieldRow('fechaInteraccion','Última interacción','date'),
            fieldRow('tipo','Tipo'),
            fieldRow('estadoSugerido','Estado sugerido','select'),
            fieldRow('proximaAccion','Próxima acción'),
            fieldRow('fechaProxima','Fecha próxima','date'),
            fieldRow('interes','Nivel de interés','interes'),
            fieldRow('responsable','Responsable'),
            fieldRow('materialEnviado','Material enviado'),
            fieldRow('senal','Señal de oportunidad'),
            fieldRow('introDisponible','Introducción','bool')):null,
          h('div',{style:{marginTop:12,padding:'10px 12px',background:C.bg,borderRadius:2}},
            h('div',{style:{fontSize:10,letterSpacing:'.1em',color:C.ink3,fontWeight:600,marginBottom:5}},'IMPACTO SUGERIDO'),
            h('div',{style:{fontSize:11.5,color:C.ink2,lineHeight:1.6}},'Se actualizará última interacción, estado y próxima acción. Probability to Convert y Return on Effort se recalculan. Se marca como prioridad de la semana.')),
          h('div',{style:{display:'flex',gap:8,marginTop:16,flexWrap:'wrap'}},
            h('button',{onClick:()=>this.weeklyApply(),style:{padding:'9px 16px',fontSize:12,fontWeight:600,background:C.accent,color:'#fff',border:'none',borderRadius:2}},p.isNew?'Confirmar y crear':'Confirmar y aplicar'),
            h('button',{onClick:()=>{const pp=JSON.parse(JSON.stringify(p));Object.keys(pp.checked).forEach(k=>pp.checked[k]=false);this.setState({weeklyPreview:pp});},style:{padding:'9px 16px',fontSize:12,fontWeight:600,background:C.panel,color:C.ink2,border:'1px solid '+C.line2,borderRadius:2}},'Deseleccionar todo'),
            h('button',{onClick:()=>this.setState({weeklyPreview:null}),style:{padding:'9px 16px',fontSize:12,fontWeight:600,background:'transparent',color:C.ink3,border:'1px solid '+C.line,borderRadius:2}},'Cancelar'))
          )):null));
  }

  // ================= WEEKLY UPDATE LOG =================
  undoWlog(id){ const entry=this.state.wlog.find(w=>w.id===id); if(!entry||!entry.snapshot){this.toast('Sin snapshot para deshacer','danger');return;}
    if(!confirm('¿Deshacer esta actualización y restaurar el estado anterior de '+entry.empresa+'?'))return;
    const cs=JSON.parse(JSON.stringify(this.state.companies)); const idx=cs.findIndex(c=>c.id===entry.empresaId);
    if(idx>=0){ cs[idx]=JSON.parse(JSON.stringify(entry.snapshot)); this.mod.applyEligibility(cs[idx],this.state.ruleActive); }
    const wlog=this.state.wlog.map(w=>w.id===id?Object.assign({},w,{status:'deshecho'}):w); this.saveWlog(wlog); this.persist(cs);
    this.toast('Actualización deshecha · estado restaurado'); }
  viewWlog(){ const {C,F}=this, h=this.h.bind(this); const wf=this.state.wlogFilters;
    let log=this.state.wlog.slice();
    if(wf.empresa) log=log.filter(w=>w.empresaId===wf.empresa);
    if(wf.tipo) log=log.filter(w=>w.tipo===wf.tipo);
    const empresas=[...new Map(this.state.wlog.map(w=>[w.empresaId,w.empresa])).entries()];
    const tipos=[...new Set(this.state.wlog.map(w=>w.tipo).filter(Boolean))];
    const sel=(val,onCh,opts,ph)=>h('select',{value:val,onChange:ev=>onCh(ev.target.value),style:{padding:'6px 10px',fontSize:11.5,border:'1px solid '+C.line2,borderRadius:2,background:C.panel,color:val?C.ink:C.ink3}},h('option',{value:''},ph),opts.map(o=>h('option',{key:o[0]!=null?o[0]:o,value:o[0]!=null?o[0]:o},o[1]!=null?o[1]:o)));
    return h('div',{key:'wl',style:{padding:'20px 30px 60px',animation:'fpfade .3s'}},
      h('div',{style:{display:'flex',gap:8,marginBottom:16,alignItems:'center'}},
        sel(wf.empresa,v=>this.setState({wlogFilters:{...wf,empresa:v}}),empresas,'Todas las empresas'),
        sel(wf.tipo,v=>this.setState({wlogFilters:{...wf,tipo:v}}),tipos,'Todos los tipos'),
        h('div',{style:{flex:1}}),h('div',{style:{fontSize:10.5,color:C.ink3}},log.length+' actualizaciones')),
      log.length?this.card(log.map(w=>h('div',{key:w.id,style:{padding:'15px 18px',borderBottom:'1px solid '+C.line,opacity:w.status==='deshecho'?.55:1}},
        h('div',{style:{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}},
          h('span',{style:{fontFamily:F.mono,fontSize:10.5,color:C.faint}},w.date),
          h('button',{onClick:()=>this.openFicha(w.empresaId),style:{border:'none',background:'transparent',padding:0,fontSize:13.5,fontWeight:600,color:C.ink,cursor:'pointer'}},w.empresa),
          w.tipo?this.tag(w.tipo,C.ink3):null,
          this.tag(w.status==='deshecho'?'Deshecho':'Aplicado',w.status==='deshecho'?C.danger:C.ok,w.status==='deshecho'?C.dangerSoft:C.okSoft),
          h('span',{style:{fontSize:11,color:C.ink3}},'por '+w.by),
          h('div',{style:{flex:1}}),
          h('span',{style:{fontFamily:F.mono,fontSize:11,color:C.ink3}},'score '+w.scoreBefore+'→'+w.scoreAfter+' · PTC '+w.ptcBefore+'→'+w.ptcAfter)),
        h('div',{style:{fontSize:12,color:C.ink2,marginTop:8,fontStyle:'italic'}},'“'+w.text+'”'),
        w.changes&&w.changes.length?h('div',{style:{display:'flex',flexWrap:'wrap',gap:6,marginTop:9}},w.changes.map((ch,i)=>h('span',{key:i,style:{fontSize:10.5,color:C.ink2,background:C.bg,border:'1px solid '+C.line,padding:'3px 8px',borderRadius:2}},ch.field+': '+ch.old+' → '+ch.new))):null,
        h('div',{style:{marginTop:10}},w.status!=='deshecho'?h('button',{onClick:()=>this.undoWlog(w.id),style:{padding:'5px 11px',fontSize:10.5,fontWeight:600,border:'1px solid '+C.line2,background:C.panel,color:C.ink2,borderRadius:2}},'↩ Deshacer'):null)))):
      this.card(h('div',{style:{padding:40,textAlign:'center',color:C.faint,fontSize:13}},'Aún no hay actualizaciones. Usa Weekly Update para registrar la primera.')));
  }

  renderToast(){ const t=this.state.toast; if(!t)return null; const {C}=this;
    const col=t.kind==='danger'?C.danger:C.ink;
    return this.h('div',{key:'toast',style:{position:'fixed',bottom:24,left:'50%',transform:'translateX(-50%)',zIndex:90,background:col,color:'#fff',padding:'11px 20px',borderRadius:3,fontSize:12.5,fontWeight:500,boxShadow:'0 8px 30px rgba(0,0,0,.25)',animation:'fpfade .2s',letterSpacing:'.01em'}},t.msg); }

  renderVals(){
    if(this.state.loading||!this.mod) return {loading:true,nav:null,topbar:null,mainView:null,overlay:null,toast:null};
    this._e=this.enrich();
    const v=this.state.view; let mainView;
    if(v==='dashboard') mainView=this.viewDashboard();
    else if(v==='master') mainView=this.viewTable(this._e.all,'Master');
    else if(v==='es') mainView=this.viewTable(this._e.all.filter(c=>c.pais==='España'),'España');
    else if(v==='ec') mainView=this.viewTable(this._e.all.filter(c=>c.pais==='Ecuador'),'Ecuador');
    else if(v==='mx') mainView=this.viewTable(this._e.all.filter(c=>c.pais==='México'),'México');
    else if(v==='ranking') mainView=this.viewRanking();
    else if(v==='pipeline') mainView=this.viewPipeline();
    else if(v==='research') mainView=this.viewResearch();
    else if(v==='partners') mainView=this.viewPartners();
    else if(v==='actions') mainView=this.viewActions();
    else if(v==='data') mainView=this.viewData();
    else if(v==='admin') mainView=this.viewAdmin();
    else if(v==='weekly') mainView=this.viewWeekly();
    else if(v==='wlog') mainView=this.viewWlog();
    else if(v==='reminders') mainView=this.viewReminders();
    return {loading:false,nav:this.renderNav(),topbar:this.renderTopbar(),mainView,overlay:this.renderOverlay(),toast:this.renderToast()};
  }
  render(){
    const {C,F}=this; const h=this.h.bind(this);
    const v=this.renderVals();
    return h('div',{style:{display:'flex',height:'100vh',overflow:'hidden',background:C.bg,fontFamily:F.ui,color:C.ink}},
      h('style',{dangerouslySetInnerHTML:{__html:FP_CSS}}),
      h('aside',{style:{width:230,flex:'none',background:C.panel,color:C.ink2,display:'flex',flexDirection:'column',borderRight:'1px solid '+C.line}},
        h('div',{style:{padding:'20px 22px 16px',borderBottom:'1px solid '+C.line}},
          h('div',{style:{fontSize:9,letterSpacing:'.28em',color:C.ink3,fontWeight:700}},'CAPTACIÓN'),
          h('div',{style:{fontSize:17,letterSpacing:'.01em',fontWeight:600,color:C.ink,marginTop:6}},'Business development'),
          h('div',{style:{fontSize:10.5,letterSpacing:'.02em',color:C.accent,marginTop:3,fontWeight:600}},'CRM estratégico de partners')),
        h('div',{className:'fps',style:{flex:1,overflowY:'auto',padding:'8px 0'}}, v.nav),
        h('div',{style:{padding:'12px 22px',borderTop:'1px solid '+C.line}},
          h('div',{style:{display:'flex',alignItems:'center',gap:7}},
            h('span',{style:{width:6,height:6,background:C.danger,borderRadius:'50%',flex:'none'}}),
            h('span',{style:{fontSize:8.5,letterSpacing:'.13em',color:C.ink3,lineHeight:1.5,fontWeight:600}},'STRICTLY CONFIDENTIAL',h('br'),'INTERNAL USE ONLY')))),
      h('main',{style:{flex:1,display:'flex',flexDirection:'column',minWidth:0}},
        h('div',{style:{flex:'none'}}, v.topbar),
        h('div',{className:'fps',style:{flex:1,overflowY:'auto',position:'relative'}},
          v.loading?h('div',{style:{position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:16,color:C.ink3}},
            h('div',{style:{width:30,height:30,border:'2px solid '+C.line,borderTopColor:C.accent,borderRadius:'50%',animation:'fpspin .8s linear infinite'}}),
            h('div',{style:{fontSize:11,letterSpacing:'.22em'}},'CARGANDO CRM…')):null,
          v.mainView)),
      v.overlay,
      v.toast);
  }
}


export default BusinessDevelopmentClient
