'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { submitRsvpForm } from '../actions'

const MAPS_URL =
  'https://www.google.com/maps/search/?api=1&query=C.+de+Navaridas+9%2C+28022+Madrid'

type RsvpStep = 'idle' | 'submitting' | 'done_yes' | 'done_no'

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Bowlby+One&family=Caveat:wght@600;700&display=swap');

:root{
  --yellow:#FFD93B;--yellow-deep:#F4B400;--yellow-soft:#FFE680;
  --denim:#1F4FA8;--denim-deep:#13316E;--denim-soft:#3E78D6;
  --sky:#7CC8FF;--ink:#0E1A33;--cream:#FFF8E1;
  --grass:#5BB36B;--grass-deep:#3E8E50;--pink:#FF7AA8;--red:#E94B3C;
}
*{box-sizing:border-box;margin:0;padding:0}
html,body{background:#0b1736;color:var(--ink);font-family:'Fredoka',system-ui,sans-serif;overflow-x:hidden;-webkit-font-smoothing:antialiased}
body{min-height:100vh}

main{position:relative;width:100%;max-width:520px;margin:0 auto;background:var(--cream);box-shadow:0 30px 80px rgba(0,0,0,.45);overflow:hidden}
@media(min-width:560px){main{margin:24px auto;border-radius:36px}}
section{position:relative;width:100%;overflow:hidden}

/* HERO */
.hero{min-height:760px;background:radial-gradient(120% 70% at 50% 110%,var(--denim-deep) 0%,var(--denim) 45%,var(--denim-soft) 80%,var(--sky) 100%);color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;padding:34px 18px 0;isolation:isolate}
@media(max-width:380px){.hero{min-height:720px;padding:28px 14px 0}}

.hero .stars{position:absolute;inset:0;pointer-events:none;z-index:0}
.hero .star{position:absolute;width:6px;height:6px;background:#fff;border-radius:50%;opacity:.85;filter:blur(.3px);animation:twinkle 2.4s ease-in-out infinite}
.hero .star.s2{width:3px;height:3px;opacity:.7}
.hero .star.s3{width:9px;height:9px;opacity:.55}
@keyframes twinkle{0%,100%{opacity:.2;transform:scale(.6)}50%{opacity:1;transform:scale(1.1)}}

.cloud{position:absolute;background:#fff;border-radius:50px;opacity:.95;filter:drop-shadow(0 6px 0 rgba(0,0,0,.05));z-index:1}
.cloud::before,.cloud::after{content:"";position:absolute;background:#fff;border-radius:50%}
.cloud.c1{width:90px;height:22px;top:80px;left:-30px;animation:drift 22s linear infinite}
.cloud.c1::before{width:38px;height:38px;left:14px;top:-18px}
.cloud.c1::after{width:28px;height:28px;left:50px;top:-12px}
.cloud.c2{width:120px;height:26px;top:160px;right:-40px;animation:drift2 28s linear infinite;opacity:.85}
.cloud.c2::before{width:48px;height:48px;left:18px;top:-22px}
.cloud.c2::after{width:32px;height:32px;left:64px;top:-14px}
.cloud.c3{width:70px;height:18px;top:300px;left:30px;opacity:.7;animation:drift 34s linear infinite reverse}
.cloud.c3::before{width:30px;height:30px;left:10px;top:-14px}
.cloud.c3::after{width:22px;height:22px;left:40px;top:-10px}
@keyframes drift{from{transform:translateX(-40px)}to{transform:translateX(560px)}}
@keyframes drift2{from{transform:translateX(40px)}to{transform:translateX(-560px)}}

.pill{position:relative;z-index:3;display:inline-flex;align-items:center;gap:8px;background:var(--yellow);color:var(--denim-deep);padding:7px 14px 7px 10px;border-radius:999px;font-weight:700;font-size:11px;letter-spacing:.1em;text-transform:uppercase;white-space:nowrap;max-width:92vw;box-shadow:0 4px 0 var(--yellow-deep),0 10px 24px rgba(0,0,0,.25);animation:pop .8s .1s cubic-bezier(.34,1.56,.64,1) backwards}
.pill .dot{width:8px;height:8px;border-radius:50%;background:var(--red);box-shadow:0 0 0 3px rgba(255,255,255,.4);animation:pulse 1.6s ease-in-out infinite}
@keyframes pulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.3);opacity:.7}}
@keyframes pop{from{transform:scale(.4);opacity:0}to{transform:scale(1);opacity:1}}

.title-wrap{position:relative;z-index:3;text-align:center;margin-top:14px;max-width:100%}
.kicker{font-family:'Caveat',cursive;font-size:30px;color:var(--yellow);transform:rotate(-4deg);text-shadow:0 3px 0 rgba(0,0,0,.18);animation:slideDown .9s .25s cubic-bezier(.34,1.56,.64,1) backwards;display:block}
.name{display:block;font-family:'Bowlby One',sans-serif;font-size:clamp(40px,13vw,72px);line-height:.92;color:var(--yellow);-webkit-text-stroke:2px var(--denim-deep);text-shadow:0 6px 0 var(--denim-deep),0 10px 0 rgba(0,0,0,.15),0 18px 30px rgba(0,0,0,.45);letter-spacing:-2px;margin-top:4px;animation:bounceIn 1s .35s cubic-bezier(.34,1.56,.64,1) backwards}
@keyframes bounceIn{0%{transform:translateY(-80px) rotate(-8deg) scale(.6);opacity:0}60%{transform:translateY(8px) rotate(2deg) scale(1.05);opacity:1}100%{transform:translateY(0) rotate(0) scale(1)}}
@keyframes slideDown{from{transform:translateY(-20px);opacity:0}to{transform:translateY(0);opacity:1}}

.age-row{display:flex;align-items:center;justify-content:center;gap:12px;margin-top:14px;flex-wrap:wrap;animation:slideUp .9s .9s backwards}
.age-row .line{width:48px;height:3px;background:var(--yellow);border-radius:2px}
.age-row .four{font-family:'Bowlby One',sans-serif;background:var(--yellow);color:var(--denim-deep);width:78px;height:78px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:54px;box-shadow:0 6px 0 var(--yellow-deep),0 12px 24px rgba(0,0,0,.3),inset 0 -4px 0 rgba(0,0,0,.1);transform:rotate(-6deg);animation:wiggleFour 3s ease-in-out infinite}
@keyframes wiggleFour{0%,100%{transform:rotate(-6deg) scale(1)}50%{transform:rotate(6deg) scale(1.06)}}
.age-row .label{font-family:'Caveat',cursive;font-size:30px;color:#fff}
@keyframes slideUp{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}

/* SCENE */
.scene{position:absolute;left:0;right:0;bottom:0;height:340px;z-index:2;pointer-events:none}
.ground{position:absolute;left:-5%;right:-5%;bottom:0;height:140px;background:linear-gradient(180deg,var(--grass) 0%,var(--grass-deep) 100%);border-radius:60% 60% 0 0/30px 30px 0 0;box-shadow:inset 0 8px 0 rgba(255,255,255,.18)}
.ground::before{content:"";position:absolute;inset:0;background:radial-gradient(circle at 20% 30%,rgba(0,0,0,.08) 0 6px,transparent 7px),radial-gradient(circle at 70% 60%,rgba(0,0,0,.06) 0 4px,transparent 5px),radial-gradient(circle at 45% 80%,rgba(255,255,255,.15) 0 5px,transparent 6px)}

.buddy{position:absolute;bottom:90px;width:120px;height:170px;animation:bobbing 2.6s ease-in-out infinite}
.buddy.b1{left:18%;animation-delay:0s;--s:.95}
.buddy.b2{left:48%;animation-delay:.4s;z-index:3}
.buddy.b3{left:78%;animation-delay:.8s;--s:.85}
@keyframes bobbing{0%,100%{transform:translateY(0) scale(var(--s,1))}50%{transform:translateY(-10px) scale(var(--s,1))}}

.buddy .body{position:absolute;inset:18% 0 12% 0;background:linear-gradient(180deg,#FFE066 0%,var(--yellow) 50%,var(--yellow-deep) 100%);border-radius:60px 60px 50px 50px;border:4px solid var(--ink);box-shadow:inset 0 -10px 0 rgba(0,0,0,.08),inset 6px 0 0 rgba(255,255,255,.25)}
.buddy .hair{position:absolute;top:6%;left:50%;transform:translateX(-50%);width:60%;height:18px;display:flex;justify-content:space-around;z-index:3}
.buddy .hair span{width:3px;height:18px;background:var(--ink);border-radius:2px;transform-origin:bottom}
.buddy .hair span:nth-child(odd){height:14px}
.buddy.b1 .hair span{transform:rotate(-8deg)}
.buddy.b3 .hair span{transform:rotate(8deg)}
.buddy .strap{position:absolute;left:0;right:0;top:46%;height:34%;background:var(--denim);border:4px solid var(--ink);border-radius:0 0 40px 40px;box-shadow:inset 0 6px 0 rgba(255,255,255,.15),inset 0 -6px 0 rgba(0,0,0,.18)}
.buddy .strap::before,.buddy .strap::after{content:"";position:absolute;top:-14px;width:14px;height:30px;background:var(--denim);border:4px solid var(--ink);border-radius:6px}
.buddy .strap::before{left:18%}
.buddy .strap::after{right:18%}
.buddy .button{position:absolute;top:6px;left:50%;transform:translateX(-50%);width:10px;height:10px;background:#FFD93B;border:2px solid var(--ink);border-radius:50%}
.buddy .goggles{position:absolute;top:24%;left:50%;transform:translateX(-50%);display:flex;gap:0;align-items:center;z-index:4}
.buddy.b2 .goggles{gap:2px}
.buddy .lens{width:46px;height:46px;border-radius:50%;background:radial-gradient(circle at 35% 35%,#fff 0 6px,#f3f3f3 8px,#cfd2d6 60%,#8e9298 100%);border:4px solid var(--ink);position:relative;box-shadow:inset 0 0 0 3px #fff,0 3px 0 rgba(0,0,0,.15)}
.buddy.b1 .lens:nth-child(2),.buddy.b3 .lens:nth-child(2){display:none}
.buddy.b1 .lens,.buddy.b3 .lens{width:60px;height:60px}
.buddy .pupil{position:absolute;top:50%;left:50%;width:18px;height:18px;border-radius:50%;background:radial-gradient(circle at 30% 30%,#6B3F1F 0 30%,#3a2110 100%);transform:translate(-50%,-50%);animation:lookAround 4s ease-in-out infinite}
.buddy .pupil::after{content:"";position:absolute;top:2px;left:2px;width:6px;height:6px;background:#fff;border-radius:50%}
@keyframes lookAround{0%,100%{transform:translate(-50%,-50%)}25%{transform:translate(-30%,-50%)}50%{transform:translate(-50%,-30%)}75%{transform:translate(-70%,-50%)}}
.buddy .strap-line{position:absolute;top:32%;left:-2px;right:-2px;height:6px;background:var(--ink);z-index:3}
.buddy .smile{position:absolute;top:60%;left:50%;transform:translateX(-50%);width:40px;height:18px;border:4px solid var(--ink);border-top:none;border-radius:0 0 40px 40px;background:#fff;z-index:4}
.buddy.b1 .smile{width:30px;transform:translateX(-50%) rotate(-8deg)}
.buddy.b3 .smile{width:30px;transform:translateX(-50%) rotate(6deg)}
.buddy .arm{position:absolute;top:55%;width:18px;height:40px;background:var(--yellow-deep);border:3px solid var(--ink);border-radius:10px;z-index:1}
.buddy .arm.l{left:-6px;transform-origin:top center;animation:waveL 1.6s ease-in-out infinite}
.buddy .arm.r{right:-6px;transform-origin:top center;animation:waveR 1.6s ease-in-out infinite}
@keyframes waveL{0%,100%{transform:rotate(20deg)}50%{transform:rotate(-30deg)}}
@keyframes waveR{0%,100%{transform:rotate(-20deg)}50%{transform:rotate(30deg)}}
.buddy .hand{position:absolute;bottom:-8px;left:50%;transform:translateX(-50%);width:16px;height:16px;background:var(--ink);border-radius:50%}
.buddy .leg{position:absolute;bottom:0;width:14px;height:24px;background:var(--ink);border-radius:4px}
.buddy .leg.l{left:30%}
.buddy .leg.r{right:30%}
.buddy .shoe{position:absolute;bottom:-2px;width:24px;height:10px;background:var(--ink);border-radius:8px}
.buddy .leg.l .shoe{left:-5px}
.buddy .leg.r .shoe{right:-5px}

.balloon{position:absolute;width:48px;height:60px;border-radius:50%;animation:float 3.4s ease-in-out infinite}
.balloon::after{content:"";position:absolute;top:100%;left:50%;width:2px;height:90px;background:rgba(255,255,255,.6)}
.balloon::before{content:"";position:absolute;bottom:-6px;left:50%;transform:translateX(-50%) rotate(45deg);width:8px;height:8px;border-radius:2px;background:inherit}
.balloon.b-yellow{background:var(--yellow);top:60px;left:8%;animation-delay:.2s}
.balloon.b-red{background:var(--red);top:120px;right:10%;animation-delay:.6s;width:42px;height:54px}
.balloon.b-pink{background:var(--pink);top:30px;left:42%;animation-delay:1.1s;width:38px;height:48px}
@keyframes float{0%,100%{transform:translateY(0) rotate(-2deg)}50%{transform:translateY(-14px) rotate(3deg)}}

.confetti{position:absolute;inset:0;overflow:hidden;z-index:1;pointer-events:none}
.conf{position:absolute;top:-20px;width:8px;height:14px;border-radius:2px;animation:fall linear infinite}
@keyframes fall{0%{transform:translateY(-30px) rotate(0)}100%{transform:translateY(820px) rotate(720deg)}}

/* TICKET */
.ticket-section{background:var(--cream);padding:60px 22px 30px;position:relative}
.ticket-section::before{content:"";position:absolute;top:-30px;left:0;right:0;height:60px;background:radial-gradient(circle at 15px 30px,var(--cream) 14px,transparent 15px) 0 0/30px 60px}
.section-eyebrow{display:flex;align-items:center;gap:10px;justify-content:center;color:var(--denim);font-weight:600;font-size:12px;letter-spacing:.22em;text-transform:uppercase;margin-bottom:18px}
.section-eyebrow .b{width:30px;height:2px;background:var(--denim);border-radius:2px;opacity:.4}
.ticket{background:#fff;border:3px solid var(--ink);border-radius:24px;box-shadow:0 8px 0 var(--denim-deep),0 20px 50px rgba(0,0,0,.15);padding:0;overflow:hidden}
.ticket-head{background:repeating-linear-gradient(45deg,var(--yellow) 0 18px,var(--yellow-deep) 18px 36px);padding:14px 20px;display:flex;align-items:center;justify-content:space-between;border-bottom:3px solid var(--ink);color:var(--denim-deep);font-weight:700;font-size:12px;letter-spacing:.18em;text-transform:uppercase}
.ticket-head .stamp{background:var(--red);color:#fff;padding:4px 10px;border-radius:6px;transform:rotate(-3deg);font-family:'Bowlby One';letter-spacing:1px;font-size:11px;border:2px solid var(--ink);box-shadow:0 3px 0 rgba(0,0,0,.2)}
.ticket-body{padding:24px 22px 26px}
.ticket-row{display:grid;grid-template-columns:46px 1fr;gap:16px;align-items:flex-start;padding:14px 0;border-bottom:2px dashed rgba(14,26,51,.18)}
.ticket-row:last-child{border-bottom:none}
.ticket-row .ico{width:46px;height:46px;border-radius:14px;background:var(--yellow);display:flex;align-items:center;justify-content:center;border:2px solid var(--ink);box-shadow:0 3px 0 var(--yellow-deep);color:var(--denim-deep)}
.ticket-row .ico svg{width:24px;height:24px}
.ticket-row .lbl{font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:var(--denim);font-weight:600;margin-bottom:2px}
.ticket-row .val{font-family:'Bowlby One';font-size:22px;color:var(--ink);line-height:1.05}
.ticket-row .sub{font-size:13px;color:rgba(14,26,51,.7);margin-top:3px;font-weight:500}
.ticket-row .maps-link{display:inline-flex;align-items:center;gap:4px;margin-top:5px;font-size:12px;font-weight:600;color:var(--denim);text-decoration:none;background:rgba(31,79,168,.08);border:1px solid rgba(31,79,168,.2);padding:3px 10px;border-radius:999px}
.ticket-row .maps-link:hover{background:rgba(31,79,168,.14)}
.ticket-foot{background:var(--denim);color:#fff;padding:18px 22px;display:flex;align-items:center;justify-content:space-between;gap:14px;border-top:3px solid var(--ink)}
.ticket-foot .num{font-family:'Bowlby One';font-size:26px;color:var(--yellow);text-shadow:0 2px 0 rgba(0,0,0,.3)}
.ticket-foot .num small{display:block;font-family:'Fredoka';font-size:10px;letter-spacing:.2em;color:#fff;opacity:.8;font-weight:600}
.barcode{display:flex;gap:2px;align-items:center;height:36px}
.barcode i{display:block;width:2px;height:100%;background:#fff}
.barcode i:nth-child(2n){width:1px;height:80%}
.barcode i:nth-child(3n){width:3px}
.barcode i:nth-child(5n){height:60%}
.barcode i:nth-child(7n){width:1px;height:90%}

/* JUMP */
.jump{background:linear-gradient(180deg,var(--cream) 0%,#FFE680 100%);padding:30px 22px 60px;position:relative}
.jump-card{background:var(--ink);color:#fff;border-radius:28px;overflow:hidden;border:3px solid var(--ink);box-shadow:0 10px 0 var(--denim-deep),0 24px 50px rgba(0,0,0,.2)}
.jump-vis{height:240px;background:radial-gradient(circle at 50% 110%,var(--yellow) 0 80px,transparent 81px),linear-gradient(180deg,#2a1a4f 0%,#5b2d8f 60%,#b94d9a 100%);position:relative;overflow:hidden}
.neon-line{position:absolute;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,#FF7AA8,transparent);box-shadow:0 0 14px #FF7AA8,0 0 30px #FF7AA8}
.neon-line.l1{top:30%;animation:neonShift 3s ease-in-out infinite}
.neon-line.l2{top:55%;animation:neonShift 3.6s ease-in-out infinite reverse;background:linear-gradient(90deg,transparent,#7CC8FF,transparent);box-shadow:0 0 14px #7CC8FF}
.neon-line.l3{top:80%;animation:neonShift 4.2s ease-in-out infinite;background:linear-gradient(90deg,transparent,#FFD93B,transparent);box-shadow:0 0 14px #FFD93B}
@keyframes neonShift{0%,100%{transform:scaleX(.6);opacity:.5}50%{transform:scaleX(1);opacity:1}}
.tramp{position:absolute;left:50%;bottom:20px;transform:translateX(-50%);width:200px;height:24px;background:linear-gradient(180deg,#FF3D71 0%,#B81F4F 100%);border:3px solid #fff;border-radius:50%;box-shadow:0 6px 0 rgba(0,0,0,.4),0 0 24px rgba(255,61,113,.6);z-index:2}
.tramp::before{content:"";position:absolute;inset:4px;border-radius:50%;background:repeating-linear-gradient(90deg,#fff 0 2px,transparent 2px 8px);opacity:.4}
.jumper{position:absolute;left:50%;bottom:42px;transform:translateX(-50%);width:90px;height:130px;animation:jumpUp 1.8s cubic-bezier(.5,0,.5,1) infinite;z-index:3;transform-origin:50% 100%}
@keyframes jumpUp{0%{transform:translateX(-50%) translateY(6px) scale(1.05,.88)}15%{transform:translateX(-50%) translateY(0) scale(1,1)}50%{transform:translateX(-50%) translateY(-80px) scale(.98,1.02)}85%{transform:translateX(-50%) translateY(0) scale(1,1)}100%{transform:translateX(-50%) translateY(6px) scale(1.05,.88)}}
.jumper-shadow{position:absolute;left:50%;bottom:24px;transform:translateX(-50%);width:80px;height:10px;background:radial-gradient(ellipse,rgba(0,0,0,.55) 0%,transparent 70%);filter:blur(2px);animation:shadowPulse 1.8s ease-in-out infinite;z-index:2}
@keyframes shadowPulse{0%,100%{transform:translateX(-50%) scale(1);opacity:.7}50%{transform:translateX(-50%) scale(.45);opacity:.25}}
.jump-info{padding:24px 22px 26px;text-align:center}
.jump-info .head{font-family:'Bowlby One';font-size:32px;color:var(--yellow);letter-spacing:1px}
.jump-info .sub{font-size:14px;opacity:.85;margin-top:6px;line-height:1.5}
.jump-info .place{margin-top:14px;display:inline-flex;align-items:center;gap:8px;background:rgba(255,255,255,.1);padding:8px 14px;border-radius:999px;font-size:13px;font-weight:600;border:1px solid rgba(255,255,255,.2)}
.activities{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:18px}
.act{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.15);border-radius:14px;padding:12px 8px;text-align:center}
.act .e{font-size:24px;display:block;margin-bottom:4px}
.act .t{font-size:11px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:var(--yellow)}
.act .d{font-size:10px;opacity:.7;margin-top:2px}

/* COUNTDOWN */
.countdown{background:var(--denim);padding:50px 22px;text-align:center;color:#fff;position:relative;overflow:hidden}
.countdown::before,.countdown::after{content:"";position:absolute;width:200px;height:200px;border-radius:50%;background:var(--yellow);opacity:.08}
.countdown::before{top:-80px;left:-80px}
.countdown::after{bottom:-80px;right:-80px}
.countdown h2{font-family:'Bowlby One';font-size:24px;color:var(--yellow);margin-bottom:6px;position:relative}
.countdown p{font-family:'Caveat';font-size:24px;margin-bottom:22px;opacity:.95;position:relative}
.clocks{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;position:relative;max-width:420px;margin:0 auto}
.clock{background:var(--ink);border:3px solid var(--yellow);border-radius:14px;padding:14px 4px;box-shadow:0 4px 0 rgba(0,0,0,.35);position:relative;overflow:hidden}
.clock::before{content:"";position:absolute;top:0;left:0;right:0;height:50%;background:rgba(255,255,255,.04)}
.clock .n{font-family:'Bowlby One';font-size:34px;color:var(--yellow);line-height:1;display:block;position:relative}
.clock .l{font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:#fff;opacity:.7;margin-top:6px;font-weight:600;position:relative}

/* RSVP */
.rsvp{background:var(--cream);padding:50px 22px 40px;text-align:center}
.rsvp h2{font-family:'Bowlby One';font-size:38px;color:var(--denim-deep);line-height:.95;letter-spacing:-.5px}
.rsvp h2 em{font-style:normal;color:var(--yellow-deep);display:block;font-size:46px;text-shadow:0 3px 0 var(--denim-deep)}
.rsvp > .rsvp-subtitle{font-family:'Caveat';font-size:24px;color:var(--ink);margin-top:6px}

/* Form elements */
.form-block{margin-top:22px;text-align:left}
.form-label{font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:var(--denim);font-weight:600;margin-bottom:8px;display:block}
.form-input{width:100%;background:#fff;border:3px solid var(--ink);border-radius:14px;padding:14px 16px;font-family:'Fredoka',sans-serif;font-size:17px;color:var(--ink);outline:none;box-shadow:0 4px 0 rgba(14,26,51,.08);transition:border-color .15s}
.form-input:focus{border-color:var(--denim)}
.form-input::placeholder{color:rgba(14,26,51,.3)}

.asiste-row{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px}
.asiste-btn{padding:14px 12px;border-radius:14px;border:3px solid var(--ink);font-family:'Fredoka';font-weight:700;font-size:15px;cursor:pointer;transition:all .15s ease;background:#fff;color:var(--ink);box-shadow:0 4px 0 rgba(14,26,51,.1)}
.asiste-btn.yes.selected{background:var(--grass);color:#fff;border-color:var(--grass-deep);box-shadow:0 4px 0 var(--grass-deep)}
.asiste-btn.no.selected{background:var(--red);color:#fff;border-color:#c0392b;box-shadow:0 4px 0 #c0392b}
.asiste-btn:hover:not(.selected){transform:translateY(-2px)}

.menu-block{margin-top:20px;animation:fadeIn .4s ease}
@keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
.menu-title{font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:var(--denim);font-weight:600;margin-bottom:10px}
.menu-cards{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.menu-card{padding:18px 12px;border-radius:18px;border:3px solid transparent;background:#fff;text-align:center;cursor:pointer;transition:all .15s ease;box-shadow:0 4px 0 rgba(14,26,51,.08)}
.menu-card:hover:not(.selected){transform:translateY(-2px)}
.menu-card.selected{border-color:var(--denim);background:var(--denim);color:#fff;box-shadow:0 4px 0 var(--denim-deep)}
.menu-card .me{font-size:30px;display:block;margin-bottom:8px;line-height:1}
.menu-card .ml{font-family:'Bowlby One';font-size:14px;color:var(--ink);line-height:1.2}
.menu-card.selected .ml{color:#fff}
.menu-card .md{font-size:11px;color:rgba(14,26,51,.5);margin-top:4px}
.menu-card.selected .md{color:rgba(255,255,255,.7)}

.btn-submit{width:100%;margin-top:18px;padding:18px;border-radius:16px;border:3px solid var(--ink);background:var(--yellow);color:var(--denim-deep);font-family:'Bowlby One';font-size:20px;cursor:pointer;box-shadow:0 5px 0 var(--yellow-deep);transition:all .15s ease}
.btn-submit:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 7px 0 var(--yellow-deep)}
.btn-submit:disabled{opacity:.45;cursor:not-allowed}

.deadline{margin-top:16px;font-size:12px;color:var(--denim-deep);font-weight:600;letter-spacing:.05em;text-align:center}
.deadline strong{color:var(--red)}

/* DONE STATE */
.rsvp-done{margin-top:24px;padding:28px 20px;background:#fff;border:3px solid var(--ink);border-radius:20px;box-shadow:0 6px 0 var(--denim-deep);text-align:center}
.rsvp-done .big-emoji{font-size:56px;display:block;margin-bottom:10px}
.rsvp-done .done-title{font-family:'Bowlby One';font-size:26px;color:var(--denim-deep);margin-bottom:6px}
.rsvp-done .done-sub{font-family:'Caveat';font-size:20px;color:var(--ink)}
.rsvp-done .menu-badge{display:inline-flex;align-items:center;gap:6px;margin-top:12px;background:var(--yellow);padding:8px 16px;border-radius:999px;border:2px solid var(--ink);font-weight:600;font-size:14px;color:var(--denim-deep)}

.foot{background:var(--ink);color:#fff;padding:24px 22px 30px;text-align:center}
.foot .heart{display:inline-flex;align-items:center;gap:6px;font-family:'Caveat';font-size:24px;color:var(--yellow)}
.foot .heart svg{width:18px;height:18px;animation:heartBeat 1.4s ease-in-out infinite}
@keyframes heartBeat{0%,100%{transform:scale(1)}50%{transform:scale(1.2)}}
.foot .small{font-size:11px;opacity:.5;margin-top:10px;letter-spacing:.05em}

.intro{position:fixed;inset:0;background:var(--denim-deep);z-index:50;display:flex;align-items:center;justify-content:center;transition:opacity .6s ease,visibility .6s}
.intro.gone{opacity:0;visibility:hidden;pointer-events:none}
.intro .big{font-family:'Bowlby One';font-size:80px;color:var(--yellow);-webkit-text-stroke:3px var(--ink);text-shadow:0 6px 0 var(--ink),0 18px 30px rgba(0,0,0,.5);animation:introPop 1.4s cubic-bezier(.34,1.56,.64,1)}
@keyframes introPop{0%{transform:scale(.2) rotate(-30deg);opacity:0}50%{transform:scale(1.15) rotate(5deg);opacity:1}70%{transform:scale(.95) rotate(-2deg)}100%{transform:scale(1) rotate(0)}}

.reveal{opacity:0;transform:translateY(30px);transition:opacity .8s cubic-bezier(.2,.8,.2,1),transform .8s cubic-bezier(.2,.8,.2,1)}
.reveal.in{opacity:1;transform:translateY(0)}

.music-btn{position:fixed;bottom:18px;right:18px;z-index:60;width:54px;height:54px;border-radius:50%;background:var(--yellow);border:3px solid var(--ink);box-shadow:0 5px 0 var(--yellow-deep),0 10px 20px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:transform .15s ease;color:var(--denim-deep)}
.music-btn:hover{transform:translateY(-2px)}
.music-btn svg{width:24px;height:24px}
.music-btn .bars{display:none;gap:2px;align-items:flex-end;height:18px}
.music-btn.on .bars{display:flex}
.music-btn.on .ico-mute{display:none}
.music-btn .bars i{display:block;width:3px;background:var(--denim-deep);border-radius:1px;animation:bars 1s ease-in-out infinite}
.music-btn .bars i:nth-child(1){height:60%}
.music-btn .bars i:nth-child(2){height:100%;animation-delay:.2s}
.music-btn .bars i:nth-child(3){height:75%;animation-delay:.4s}
.music-btn .bars i:nth-child(4){height:90%;animation-delay:.1s}
@keyframes bars{0%,100%{transform:scaleY(.4)}50%{transform:scaleY(1)}}
.music-hint{position:fixed;bottom:24px;right:84px;z-index:60;background:#fff;border:2px solid var(--ink);border-radius:14px;padding:8px 12px;font-family:'Caveat',cursive;font-size:18px;color:var(--ink);box-shadow:0 4px 0 var(--denim-deep);animation:hintBob 2s ease-in-out infinite,hintIn .6s 1.8s backwards;pointer-events:none}
.music-hint::after{content:"";position:absolute;right:-8px;top:50%;transform:translateY(-50%);width:0;height:0;border-left:8px solid var(--ink);border-top:6px solid transparent;border-bottom:6px solid transparent}
.music-hint.gone{opacity:0;transform:translateX(10px);transition:opacity .4s,transform .4s}
@keyframes hintBob{0%,100%{transform:translateX(0)}50%{transform:translateX(-4px)}}
@keyframes hintIn{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:translateX(0)}}
`

function BuddyB1() {
  return (
    <div className="buddy b1">
      <div className="hair"><span /><span /><span /><span /><span /></div>
      <div className="body" />
      <div className="goggles"><div className="lens"><div className="pupil" /></div></div>
      <div className="strap-line" /><div className="smile" />
      <div className="strap"><div className="button" /></div>
      <div className="arm l"><div className="hand" /></div><div className="arm r"><div className="hand" /></div>
      <div className="leg l"><div className="shoe" /></div><div className="leg r"><div className="shoe" /></div>
    </div>
  )
}
function BuddyB2() {
  return (
    <div className="buddy b2">
      <div className="hair"><span /><span /><span /><span /><span /><span /><span /></div>
      <div className="body" />
      <div className="goggles">
        <div className="lens"><div className="pupil" /></div>
        <div className="lens"><div className="pupil" style={{ animationDelay: '.3s' }} /></div>
      </div>
      <div className="strap-line" /><div className="smile" />
      <div className="strap"><div className="button" /></div>
      <div className="arm l"><div className="hand" /></div><div className="arm r"><div className="hand" /></div>
      <div className="leg l"><div className="shoe" /></div><div className="leg r"><div className="shoe" /></div>
    </div>
  )
}
function BuddyB3() {
  return (
    <div className="buddy b3">
      <div className="hair"><span /><span /><span /><span /><span /></div>
      <div className="body" />
      <div className="goggles"><div className="lens"><div className="pupil" style={{ animationDelay: '.6s' }} /></div></div>
      <div className="strap-line" /><div className="smile" />
      <div className="strap"><div className="button" /></div>
      <div className="arm l"><div className="hand" /></div><div className="arm r"><div className="hand" /></div>
      <div className="leg l"><div className="shoe" /></div><div className="leg r"><div className="shoe" /></div>
    </div>
  )
}
function JumperBuddy() {
  return (
    <div className="buddy" style={{ position: 'relative', width: 90, height: 130, animation: 'none' }}>
      <div className="hair"><span /><span /><span /><span /><span /></div>
      <div className="body" />
      <div className="goggles" style={{ top: '22%' }}>
        <div className="lens" style={{ width: 42, height: 42 }}><div className="pupil" /></div>
        <div className="lens" style={{ width: 42, height: 42 }}><div className="pupil" style={{ animationDelay: '.4s' }} /></div>
      </div>
      <div className="strap-line" /><div className="smile" />
      <div className="strap"><div className="button" /></div>
      <div className="arm l" style={{ animation: 'none', transform: 'rotate(-130deg)' }}><div className="hand" /></div>
      <div className="arm r" style={{ animation: 'none', transform: 'rotate(130deg)' }}><div className="hand" /></div>
      <div className="leg l" style={{ left: '25%', transform: 'rotate(-15deg)' }}><div className="shoe" /></div>
      <div className="leg r" style={{ right: '25%', transform: 'rotate(15deg)' }}><div className="shoe" /></div>
    </div>
  )
}

export default function InvitacionClient() {
  const [rsvpStep, setRsvpStep] = useState<RsvpStep>('idle')
  const [nombreNino, setNombreNino] = useState('')
  const [asiste, setAsiste] = useState<boolean | null>(null)
  const [menuOpcion, setMenuOpcion] = useState<string | null>(null)
  const [musicOn, setMusicOn] = useState(false)
  const [hintGone, setHintGone] = useState(false)

  const audioRef = useRef<{ ctx: AudioContext; master: GainNode; scheduler: number | null } | null>(null)
  const melTimeRef = useRef(0), melStepRef = useRef(0)
  const nextTimeRef = useRef(0), stepRef = useRef(0)

  useEffect(() => {
    const t = setTimeout(() => document.getElementById('cumple-intro')?.classList.add('gone'), 1500)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    const c = document.getElementById('cumple-confetti')
    if (!c) return
    const colors = ['#FFD93B', '#F4B400', '#E94B3C', '#FF7AA8', '#7CC8FF', '#5BB36B', '#fff']
    for (let i = 0; i < 28; i++) {
      const el = document.createElement('div')
      el.className = 'conf'
      el.style.left = Math.random() * 100 + '%'
      el.style.background = colors[i % colors.length]
      el.style.animationDuration = (4 + Math.random() * 4) + 's'
      el.style.animationDelay = (Math.random() * 5) + 's'
      el.style.transform = `rotate(${Math.random() * 360}deg)`
      if (Math.random() > 0.5) el.style.borderRadius = '50%'
      c.appendChild(el)
    }
  }, [])

  useEffect(() => {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target) } })
    }, { threshold: 0.15 })
    document.querySelectorAll('.reveal').forEach(el => io.observe(el))
    return () => io.disconnect()
  }, [rsvpStep])

  useEffect(() => {
    const target = new Date('2026-06-13T12:30:00+02:00').getTime()
    const pad = (n: number) => String(Math.max(0, n)).padStart(2, '0')
    function tick() {
      let diff = Math.max(0, target - Date.now())
      const d = Math.floor(diff / 86400000); diff -= d * 86400000
      const h = Math.floor(diff / 3600000); diff -= h * 3600000
      const m = Math.floor(diff / 60000); diff -= m * 60000
      const s = Math.floor(diff / 1000)
      const ids = ['cd-d', 'cd-h', 'cd-m', 'cd-s']
      ;[d, h, m, s].forEach((v, i) => { const el = document.getElementById(ids[i]); if (el) el.textContent = pad(v) })
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const t = setTimeout(() => setHintGone(true), 8000)
    return () => clearTimeout(t)
  }, [])

  const celebrate = useCallback((label: string) => {
    const c = document.getElementById('cumple-confetti')
    if (!c) return
    const colors = ['#FFD93B', '#E94B3C', '#FF7AA8', '#7CC8FF', '#5BB36B', '#fff']
    for (let i = 0; i < 60; i++) {
      const el = document.createElement('div')
      el.className = 'conf'
      el.style.left = Math.random() * 100 + '%'
      el.style.background = colors[i % colors.length]
      el.style.animationDuration = (2 + Math.random() * 2) + 's'
      el.style.animationDelay = (Math.random() * 0.4) + 's'
      el.style.top = '-30px'
      c.appendChild(el)
      setTimeout(() => el.remove(), 5000)
    }
    const t = document.createElement('div')
    t.textContent = label
    Object.assign(t.style, { position: 'fixed', top: '40%', left: '50%', transform: 'translate(-50%,-50%) scale(.4)', fontFamily: "'Bowlby One',sans-serif", fontSize: '56px', color: '#FFD93B', WebkitTextStroke: '3px #13316E', textShadow: '0 6px 0 #13316E', transition: 'transform .6s cubic-bezier(.34,1.56,.64,1),opacity .6s', zIndex: '100', pointerEvents: 'none', textAlign: 'center' })
    document.body.appendChild(t)
    requestAnimationFrame(() => { t.style.transform = 'translate(-50%,-50%) scale(1)' })
    setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translate(-50%,-50%) scale(1.4)' }, 1400)
    setTimeout(() => t.remove(), 2200)
  }, [])

  const startMusic = useCallback(() => {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const master = ctx.createGain(); master.gain.value = 0.35; master.connect(ctx.destination)
    const bpm = 132, beat = 60 / bpm, baseFreq = 261.63
    const f = (s: number) => baseFreq * Math.pow(2, s / 12)
    const melody = [[0,.5],[4,.5],[7,.5],[12,1],[7,.5],[12,1.5],[0,.5],[5,.5],[9,.5],[12,1],[9,.5],[5,1.5],[2,.5],[5,.5],[9,.5],[14,1],[12,.5],[9,1.5],[-1,.5],[2,.5],[7,.5],[11,1],[12,.5],[7,1.5]]
    const bass = [[0,1],[7,1],[5,1],[7,1],[0,1],[5,1],[7,1],[0,1],[-3,1],[2,1],[5,1],[2,1],[-5,1],[-1,1],[2,1],[7,1]]
    function note(freq: number, start: number, dur: number, type: OscillatorType = 'triangle', gain = 0.18) {
      const o = ctx.createOscillator(), g = ctx.createGain()
      o.type = type; o.frequency.value = freq
      g.gain.setValueAtTime(0, start); g.gain.linearRampToValueAtTime(gain, start + 0.02); g.gain.exponentialRampToValueAtTime(0.001, start + dur * 0.95)
      o.connect(g).connect(master); o.start(start); o.stop(start + dur)
    }
    function kick(start: number) {
      const o = ctx.createOscillator(), g = ctx.createGain()
      o.frequency.setValueAtTime(120, start); o.frequency.exponentialRampToValueAtTime(40, start + 0.15)
      g.gain.setValueAtTime(0.5, start); g.gain.exponentialRampToValueAtTime(0.001, start + 0.18)
      o.connect(g).connect(master); o.start(start); o.stop(start + 0.2)
    }
    nextTimeRef.current = ctx.currentTime + 0.1; melTimeRef.current = nextTimeRef.current; stepRef.current = 0; melStepRef.current = 0
    function tick() {
      const la = ctx.currentTime + 0.5
      while (nextTimeRef.current < la) {
        const bi = stepRef.current % 16, b = bass[bi]
        note(f(b[0] - 12), nextTimeRef.current, beat * 0.95, 'sine', 0.22)
        if (bi % 2 === 0) kick(nextTimeRef.current)
        nextTimeRef.current += beat; stepRef.current++
      }
      while (melTimeRef.current < la) {
        const n = melody[melStepRef.current % melody.length]
        note(f(n[0] + 12), melTimeRef.current, beat * n[1] * 0.95, 'triangle', 0.14)
        if (n[1] >= 0.5) note(f(n[0] + 12 + 4), melTimeRef.current, beat * n[1] * 0.8, 'sine', 0.05)
        melTimeRef.current += beat * n[1]; melStepRef.current++
      }
    }
    tick()
    const scheduler = window.setInterval(tick, 100) as unknown as number
    audioRef.current = { ctx, master, scheduler }
    setMusicOn(true)
  }, [])

  const stopMusic = useCallback(() => {
    const a = audioRef.current
    if (!a) return
    if (a.scheduler !== null) clearInterval(a.scheduler)
    a.master.gain.cancelScheduledValues(a.ctx.currentTime)
    a.master.gain.setValueAtTime(a.master.gain.value, a.ctx.currentTime)
    a.master.gain.linearRampToValueAtTime(0, a.ctx.currentTime + 0.15)
    setTimeout(() => a.ctx.suspend(), 200)
    audioRef.current = null
    setMusicOn(false)
  }, [])

  const toggleMusic = useCallback(() => {
    setHintGone(true)
    if (musicOn) stopMusic(); else startMusic()
  }, [musicOn, startMusic, stopMusic])

  const canSubmit = nombreNino.trim().length > 0 && asiste !== null && (asiste === false || menuOpcion !== null)

  const handleSubmit = async () => {
    if (!canSubmit) return
    setRsvpStep('submitting')
    try {
      await submitRsvpForm(nombreNino, asiste!, menuOpcion)
      if (asiste) {
        celebrate('¡YUPI! 🎉')
        setRsvpStep('done_yes')
      } else {
        celebrate('¡Gracias por avisar! 💛')
        setRsvpStep('done_no')
      }
    } catch {
      setRsvpStep('idle')
    }
  }

  const menuLabel = menuOpcion === 'pizza' ? '🍕 Pizza + 🎂 Tarta + 🍬 Chuches' : menuOpcion === 'perrito' ? '🌭 Perrito + 🎂 Tarta + 🍬 Chuches' : null

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <div className="intro" id="cumple-intro"><div className="big">¡Hey!</div></div>

      <button className={`music-btn${musicOn ? ' on' : ''}`} onClick={toggleMusic} aria-label="Música">
        <svg className="ico-mute" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>
        <span className="bars" aria-hidden="true"><i /><i /><i /><i /></span>
      </button>
      <div className={`music-hint${hintGone ? ' gone' : ''}`}>¡Dale al play! 🎵</div>

      <main>
        {/* HERO */}
        <section className="hero">
          <div className="stars">
            <div className="star" style={{ top: '6%', left: '12%', animationDelay: '0s' }} />
            <div className="star s2" style={{ top: '14%', left: '80%', animationDelay: '.4s' }} />
            <div className="star s3" style={{ top: '22%', left: '35%', animationDelay: '.8s' }} />
            <div className="star" style={{ top: '32%', left: '88%', animationDelay: '1.2s' }} />
            <div className="star s2" style={{ top: '44%', left: '6%', animationDelay: '.2s' }} />
            <div className="star" style={{ top: '50%', left: '65%', animationDelay: '1.6s' }} />
          </div>
          <div className="confetti" id="cumple-confetti" />
          <div className="cloud c1" /><div className="cloud c2" /><div className="cloud c3" />
          <div className="balloon b-yellow" /><div className="balloon b-red" /><div className="balloon b-pink" />
          <div className="pill"><span className="dot" /> Estás invitado · Save the date</div>
          <div className="title-wrap">
            <span className="kicker">¡Cumple de…!</span>
            <span className="name">MACARENA</span>
            <div className="age-row">
              <span className="line" /><span className="four">4</span><span className="label">años</span><span className="line" />
            </div>
          </div>
          <div className="scene">
            <BuddyB1 /><BuddyB2 /><BuddyB3 />
            <div className="ground" />
          </div>
        </section>

        {/* TICKET */}
        <section className="ticket-section">
          <div className="section-eyebrow reveal"><span className="b" /> Tu pase oficial <span className="b" /></div>
          <div className="ticket reveal">
            <div className="ticket-head">
              <span>★ CUMPLE PASS ★</span>
              <span className="stamp">N° 04</span>
              <span>JUNIO 2026</span>
            </div>
            <div className="ticket-body">
              <div className="ticket-row">
                <div className="ico">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 11h18" /></svg>
                </div>
                <div><div className="lbl">Fecha</div><div className="val">Sábado 13 de junio</div><div className="sub">2026 · Que no se te olvide ✨</div></div>
              </div>
              <div className="ticket-row">
                <div className="ico">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
                </div>
                <div><div className="lbl">Hora</div><div className="val">12:30 — 14:30 h</div><div className="sub">Llega 10 min antes para el check-in</div></div>
              </div>
              <div className="ticket-row">
                <div className="ico">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s7-7.5 7-13a7 7 0 1 0-14 0c0 5.5 7 13 7 13Z" /><circle cx="12" cy="9" r="2.5" /></svg>
                </div>
                <div>
                  <div className="lbl">Lugar</div>
                  <div className="val">Urban Planet</div>
                  <div className="sub">C. de Navaridas 9 · Las Mercedes, Madrid</div>
                  <a href={MAPS_URL} target="_blank" rel="noopener noreferrer" className="maps-link">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s7-7.5 7-13a7 7 0 1 0-14 0c0 5.5 7 13 7 13Z" /><circle cx="12" cy="9" r="2.5" /></svg>
                    Ver en Google Maps
                  </a>
                </div>
              </div>
              <div className="ticket-row">
                <div className="ico">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16v3a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V7Z" /><path d="M9 7V5a3 3 0 0 1 6 0v2M8 13v8M16 13v8M6 21h12" /></svg>
                </div>
                <div><div className="lbl">Trae</div><div className="val">Calcetines antideslizantes</div><div className="sub">Y muchas, muchas ganas de saltar 🤸</div></div>
              </div>
            </div>
            <div className="ticket-foot">
              <div className="num">04<small>cumpleaños</small></div>
              <div className="barcode" aria-hidden="true">{Array.from({ length: 28 }).map((_, i) => <i key={i} />)}</div>
              <div className="num" style={{ fontSize: 18 }}>★★★<small>Macarena</small></div>
            </div>
          </div>
        </section>

        {/* JUMP */}
        <section className="jump">
          <div className="section-eyebrow reveal" style={{ color: 'var(--denim-deep)' }}>
            <span className="b" style={{ background: 'var(--denim-deep)' }} /> El sitio del salto <span className="b" style={{ background: 'var(--denim-deep)' }} />
          </div>
          <div className="jump-card reveal">
            <div className="jump-vis">
              <div className="neon-line l1" /><div className="neon-line l2" /><div className="neon-line l3" />
              <div className="jumper-shadow" />
              <div className="jumper"><JumperBuddy /></div>
              <div className="tramp" />
            </div>
            <div className="jump-info">
              <div className="head">A SALTAR SE HA DICHO</div>
              <div className="sub">Camas elásticas, zonas de aventura<br />y diversión sin parar para los peques</div>
              <div className="place">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s7-7.5 7-13a7 7 0 1 0-14 0c0 5.5 7 13 7 13Z" /><circle cx="12" cy="9" r="2.5" /></svg>
                Urban Planet · Las Mercedes, Madrid
              </div>
              <div className="activities">
                <div className="act"><span className="e">🤸‍♀️</span><span className="t">Saltar</span><span className="d">camas elásticas</span></div>
                <div className="act"><span className="e">🏰</span><span className="t">Trepar</span><span className="d">zonas aventura</span></div>
                <div className="act"><span className="e">🎂</span><span className="t">Tarta</span><span className="d">¡y soplar velas!</span></div>
              </div>
            </div>
          </div>
        </section>

        {/* COUNTDOWN */}
        <section className="countdown">
          <h2 className="reveal">CUENTA ATRÁS</h2>
          <p className="reveal">para el gran salto…</p>
          <div className="clocks reveal">
            <div className="clock"><span className="n" id="cd-d">00</span><span className="l">Días</span></div>
            <div className="clock"><span className="n" id="cd-h">00</span><span className="l">Horas</span></div>
            <div className="clock"><span className="n" id="cd-m">00</span><span className="l">Min</span></div>
            <div className="clock"><span className="n" id="cd-s">00</span><span className="l">Seg</span></div>
          </div>
        </section>

        {/* RSVP */}
        <section className="rsvp">
          <h2 className="reveal">¿Vienes a<br /><em>la fiesta?</em></h2>
          <p className="rsvp-subtitle reveal">Confírmanos plis 🎈</p>

          {(rsvpStep === 'idle' || rsvpStep === 'submitting') && (
            <div className="form-block reveal">
              {/* Nombre */}
              <label className="form-label" htmlFor="nombre-nino">Nombre del niño/a</label>
              <input
                id="nombre-nino"
                className="form-input"
                type="text"
                placeholder="Escribe aquí el nombre"
                value={nombreNino}
                onChange={e => setNombreNino(e.target.value)}
                disabled={rsvpStep === 'submitting'}
                autoComplete="off"
              />

              {/* ¿Asiste? */}
              <div style={{ marginTop: 18 }}>
                <div className="form-label">¿Podrá asistir?</div>
                <div className="asiste-row">
                  <button
                    className={`asiste-btn yes${asiste === true ? ' selected' : ''}`}
                    onClick={() => setAsiste(true)}
                    disabled={rsvpStep === 'submitting'}
                  >
                    ✅ ¡Sí viene!
                  </button>
                  <button
                    className={`asiste-btn no${asiste === false ? ' selected' : ''}`}
                    onClick={() => { setAsiste(false); setMenuOpcion(null) }}
                    disabled={rsvpStep === 'submitting'}
                  >
                    ❌ No puede ir
                  </button>
                </div>
              </div>

              {/* Menú — solo si asiste */}
              {asiste === true && (
                <div className="menu-block">
                  <div className="menu-title">¿Qué menú prefiere?</div>
                  <div className="menu-cards">
                    <div
                      className={`menu-card${menuOpcion === 'pizza' ? ' selected' : ''}`}
                      onClick={() => setMenuOpcion('pizza')}
                    >
                      <span className="me">🍕🎂🍬</span>
                      <div className="ml">Pizza</div>
                      <div className="md">+ Tarta + Chuches</div>
                    </div>
                    <div
                      className={`menu-card${menuOpcion === 'perrito' ? ' selected' : ''}`}
                      onClick={() => setMenuOpcion('perrito')}
                    >
                      <span className="me">🌭🎂🍬</span>
                      <div className="ml">Perrito</div>
                      <div className="md">+ Tarta + Chuches</div>
                    </div>
                  </div>
                </div>
              )}

              <button
                className="btn-submit"
                onClick={handleSubmit}
                disabled={!canSubmit || rsvpStep === 'submitting'}
              >
                {rsvpStep === 'submitting' ? 'Enviando…' : '¡Confirmar! 🎉'}
              </button>

              <div className="deadline">Confirma antes del <strong>6 de junio</strong></div>
            </div>
          )}

          {rsvpStep === 'done_yes' && (
            <div className="rsvp-done reveal">
              <span className="big-emoji">🎉</span>
              <div className="done-title">¡{nombreNino} viene!</div>
              <div className="done-sub">¡Te esperamos el 13 de junio en Urban Planet! 💛</div>
              {menuLabel && <div className="menu-badge">{menuLabel}</div>}
            </div>
          )}

          {rsvpStep === 'done_no' && (
            <div className="rsvp-done reveal">
              <span className="big-emoji">💛</span>
              <div className="done-title">¡Anotado!</div>
              <div className="done-sub">{nombreNino ? `${nombreNino} se lo perderá,` : ''} ¡gracias por avisarnos!</div>
            </div>
          )}
        </section>

        <div className="foot">
          <div className="heart">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21s-7-4.5-9.5-9C.8 8.7 2.6 5 6 5c2 0 3.4 1 4 2.4C10.6 6 12 5 14 5c3.4 0 5.2 3.7 3.5 7-2.5 4.5-9.5 9-9.5 9z" /></svg>
            hecho con cariño para Maca
          </div>
          <div className="small">13.06.2026 · MADRID</div>
        </div>
      </main>
    </>
  )
}
