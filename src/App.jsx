import { useState, useEffect, useRef, useCallback, useMemo } from "react";

/* ── CONSTANTS ───────────────────────────────── */
const CATS = ["Food","Transport","Shopping","Health","Entertainment","Bills","Education","Others"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const ICONS = {Food:"🍔",Transport:"🚗",Shopping:"🛍️",Health:"💊",Entertainment:"🎮",Bills:"📄",Education:"📚",Others:"📦"};
const PAL = ["#06b6d4","#14b8a6","#6366f1","#f59e0b","#10b981","#f43f5e","#8b5cf6","#0ea5e9","#84cc16","#ec4899","#fb923c","#a78bfa"];

const DEFAULT_CHALLENGES = [
  {id:"dc1",name:"No Eating Out",desc:"Avoid restaurants & food delivery",icon:"🍽️",type:"streak",target:30,duration:30,progress:0,preset:true},
  {id:"dc2",name:"No Coffee Outside",desc:"Skip café coffee for 2 weeks",icon:"☕",type:"streak",target:14,duration:14,progress:0,preset:true},
  {id:"dc3",name:"Zero Shopping",desc:"No non-essential shopping",icon:"🛍️",type:"streak",target:30,duration:30,progress:0,preset:true},
  {id:"dc4",name:"Save ₹5,000",desc:"Save five thousand rupees",icon:"💰",type:"savings",target:5000,duration:30,progress:0,preset:true},
  {id:"dc5",name:"No OTT Streaming",desc:"Cancel Netflix/Prime for 2 weeks",icon:"📱",type:"streak",target:14,duration:14,progress:0,preset:true},
  {id:"dc6",name:"Public Transport Only",desc:"Use bus/metro for 30 days",icon:"🚌",type:"streak",target:30,duration:30,progress:0,preset:true},
  {id:"dc7",name:"Spend Under ₹500/day",desc:"Daily spending below ₹500",icon:"💸",type:"spending",target:15000,duration:30,progress:0,preset:true},
  {id:"dc8",name:"No Impulse Buying",desc:"24hr wait rule for all purchases",icon:"🧠",type:"streak",target:30,duration:30,progress:0,preset:true},
];

/* ── HELPERS ─────────────────────────────────── */
function useLS(key, def) {
  const [v,set] = useState(()=>{ try{ const s=localStorage.getItem(key); return s?JSON.parse(s):def; }catch{ return def; }});
  useEffect(()=>{ try{ localStorage.setItem(key,JSON.stringify(v)); }catch{} },[key,v]);
  return [v,set];
}
function fmt(n){ if(isNaN(n)||n==null) return "₹0"; if(Math.abs(n)>=1e7) return "₹"+(n/1e7).toFixed(2)+"Cr"; if(Math.abs(n)>=1e5) return "₹"+(n/1e5).toFixed(2)+"L"; return new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:0}).format(n); }
function sip(m,r,y){ const mo=r/12/100,n=y*12; if(mo===0) return m*n; return m*((Math.pow(1+mo,n)-1)/mo)*(1+mo); }
function lerp(a,b,t){ return a+(b-a)*t; }
function useAnim(trigger){ const [p,set]=useState(0); useEffect(()=>{ let s=null,r; function step(ts){ if(!s) s=ts; const x=Math.min((ts-s)/800,1); set(x<1?lerp(0,1,x*x*(3-2*x)):1); if(x<1) r=requestAnimationFrame(step); } r=requestAnimationFrame(step); return()=>cancelAnimationFrame(r); },[trigger]); return p; }

/* ── CONFETTI ────────────────────────────────── */
function Confetti({active}){
  const ref=useRef(null);
  useEffect(()=>{
    if(!active) return;
    const c=ref.current; if(!c) return;
    const ctx=c.getContext("2d"); c.width=window.innerWidth; c.height=window.innerHeight;
    const pieces=Array.from({length:150},()=>({x:Math.random()*c.width,y:Math.random()*c.height-c.height,r:Math.random()*8+3,d:Math.random()*100,color:PAL[Math.floor(Math.random()*PAL.length)],tilt:0,ti:Math.random()*.07+.04,vx:(Math.random()-.5)*3}));
    let angle=0,raf;
    function draw(){ ctx.clearRect(0,0,c.width,c.height); angle+=.01;
      pieces.forEach(p=>{ p.ti+=.01; p.y+=(Math.cos(angle+p.d)+1+p.r/2)*1.8; p.x+=p.vx+Math.sin(angle)*.5; p.tilt=Math.sin(p.ti)*15;
        if(p.y>c.height){p.y=-10;p.x=Math.random()*c.width;}
        ctx.beginPath(); ctx.fillStyle=p.color+"cc"; ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.tilt*Math.PI/180); ctx.ellipse(0,0,p.r,p.r*.4,0,0,Math.PI*2); ctx.fill(); ctx.restore();
      }); raf=requestAnimationFrame(draw);
    }
    draw(); const t=setTimeout(()=>cancelAnimationFrame(raf),5000);
    return()=>{cancelAnimationFrame(raf);clearTimeout(t);};
  },[active]);
  if(!active) return null;
  return <canvas ref={ref} style={{position:"fixed",inset:0,zIndex:9999,pointerEvents:"none"}}/>;
}

/* ── ANIMATED COUNTER ───────────────────────── */
function Counter({value,prefix="₹",suffix="",color="#fff",size=28}){
  const [disp,setDisp]=useState(0);
  const prev=useRef(0);
  useEffect(()=>{
    const start=prev.current,end=value; prev.current=value;
    let s=null,r;
    function step(ts){ if(!s) s=ts; const p=Math.min((ts-s)/600,1); setDisp(Math.round(lerp(start,end,p*p*(3-2*p)))); if(p<1) r=requestAnimationFrame(step); }
    r=requestAnimationFrame(step); return()=>cancelAnimationFrame(r);
  },[value]);
  const fmtNum=(n)=>{ if(Math.abs(n)>=1e7) return (n/1e7).toFixed(2)+"Cr"; if(Math.abs(n)>=1e5) return (n/1e5).toFixed(1)+"L"; return new Intl.NumberFormat("en-IN",{maximumFractionDigits:0}).format(n); };
  return <span style={{fontSize:size,fontWeight:900,color}}>{prefix}{fmtNum(disp)}{suffix}</span>;
}

/* ── ANIMATED DONUT WITH TOOLTIP ────────────── */
function Donut({segs,size=160,thick=24,label="",sub=""}){
  const anim=useAnim(segs.map(s=>s.value).join());
  const [tip,setTip]=useState(null);
  const cx=size/2,cy=size/2,r=(size-thick)/2;
  const total=segs.reduce((a,s)=>a+s.value,0);
  if(total===0) return(
    <svg width={size} height={size}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={thick}/>
      <text x={cx} y={cy+5} textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize={12}>No data</text>
    </svg>);
  let cum=0;
  const arcs=segs.map((s,i)=>{
    const pct=(s.value/total)*anim;
    const a1=cum*2*Math.PI-Math.PI/2, a2=(cum+pct)*2*Math.PI-Math.PI/2;
    cum+=s.value/total;
    if(Math.abs(a2-a1)<.001) return null;
    const x1=cx+r*Math.cos(a1),y1=cy+r*Math.sin(a1),x2=cx+r*Math.cos(a2),y2=cy+r*Math.sin(a2),lg=pct>.5?1:0;
    const mid=(a1+a2)/2, tx=cx+r*Math.cos(mid), ty=cy+r*Math.sin(mid);
    return(
      <path key={i} d={`M${x1} ${y1} A${r} ${r} 0 ${lg} 1 ${x2} ${y2}`} fill="none" stroke={s.color} strokeWidth={thick+2} strokeLinecap="round"
        style={{cursor:"pointer",filter:`drop-shadow(0 0 6px ${s.color}88)`,transition:"stroke-width .2s"}}
        onMouseEnter={e=>{setTip({label:s.label,value:s.value,color:s.color,pct:(s.value/total*100).toFixed(1),x:tx,y:ty}); e.target.setAttribute("stroke-width",thick+8);}}
        onMouseLeave={e=>{setTip(null); e.target.setAttribute("stroke-width",thick+2);}}/>
    );
  });
  return(
    <svg width={size} height={size} style={{overflow:"visible"}}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={thick}/>
      {arcs}
      <text x={cx} y={cy-8} textAnchor="middle" fill="#fff" fontSize={15} fontWeight="800">{label}</text>
      <text x={cx} y={cy+10} textAnchor="middle" fill="rgba(255,255,255,0.45)" fontSize={11}>{sub}</text>
      {tip&&(
        <g>
          <rect x={tip.x-45} y={tip.y-28} width={90} height={30} rx={8} fill="rgba(15,23,42,0.95)" stroke={tip.color} strokeWidth={1}/>
          <text x={tip.x} y={tip.y-16} textAnchor="middle" fill={tip.color} fontSize={10} fontWeight="700">{tip.label}</text>
          <text x={tip.x} y={tip.y-4} textAnchor="middle" fill="#fff" fontSize={10}>{fmt(tip.value)} ({tip.pct}%)</text>
        </g>
      )}
    </svg>
  );
}

/* ── ANIMATED BAR CHART ─────────────────────── */
function Bars({data,h=160,showVal=true}){
  const anim=useAnim(data.map(d=>d.value).join());
  const [tip,setTip]=useState(null);
  const max=Math.max(...data.map(d=>d.value),1);
  return(
    <div style={{position:"relative"}}>
      {tip&&<div style={{position:"absolute",top:-40,left:"50%",transform:"translateX(-50%)",background:"rgba(10,20,40,.95)",border:`1px solid ${tip.color}`,borderRadius:8,padding:"4px 10px",fontSize:11,color:"#fff",whiteSpace:"nowrap",zIndex:10,pointerEvents:"none"}}>{tip.label}: <b style={{color:tip.color}}>{fmt(tip.value)}</b></div>}
      <div style={{display:"flex",alignItems:"flex-end",gap:5,height:h+30,paddingBottom:24}}>
        {data.map((d,i)=>{
          const bh=((d.value/max)*h*.88)*anim;
          return(
            <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2,cursor:"pointer"}}
              onMouseEnter={()=>setTip({label:d.label,value:d.value,color:d.color||"#06b6d4"})}
              onMouseLeave={()=>setTip(null)}>
              {showVal&&d.value>0&&<div style={{fontSize:8,color:"rgba(255,255,255,0.6)",fontWeight:700,textAlign:"center",lineHeight:1}}>{fmt(d.value)}</div>}
              <div style={{width:"100%",borderRadius:"5px 5px 0 0",background:d.color?`linear-gradient(180deg,${d.color},${d.color}66)`:"linear-gradient(180deg,#06b6d4,#06b6d444)",height:bh,minHeight:d.value>0?3:0,transition:"height .05s",boxShadow:d.value>0?`0 0 10px ${d.color||"#06b6d4"}44`:"none"}}/>
              <div style={{fontSize:8,color:"rgba(255,255,255,0.4)",textAlign:"center",position:"absolute",bottom:4,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",maxWidth:"100%"}}>{d.label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── LINE CHART ──────────────────────────────── */
function LineC({data,color="#14b8a6",h=120,fill=true}){
  const anim=useAnim(data.map(d=>d.value).join());
  const [tip,setTip]=useState(null);
  const W=400,P=28,max=Math.max(...data.map(d=>d.value),1);
  const pts=data.map((d,i)=>({x:P+(i/(data.length-1||1))*(W-P*2),y:h-P-(d.value/max)*(h-P*2)*anim}));
  const path=pts.map((p,i)=>i===0?`M${p.x},${p.y}`:`L${p.x},${p.y}`).join(" ");
  const area=pts.length>1?`${path} L${pts[pts.length-1].x},${h-P} L${pts[0].x},${h-P} Z`:"";
  const gid="lg"+color.replace("#","");
  return(
    <svg viewBox={`0 0 ${W} ${h}`} width="100%" height={h} style={{overflow:"visible"}}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity=".4"/>
          <stop offset="100%" stopColor={color} stopOpacity="0"/>
        </linearGradient>
      </defs>
      {fill&&area&&<path d={area} fill={`url(#${gid})`}/>}
      {pts.length>1&&<path d={path} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" style={{filter:`drop-shadow(0 0 5px ${color}88)`}}/>}
      {pts.map((p,i)=>(
        <g key={i} style={{cursor:"pointer"}} onMouseEnter={()=>setTip({i,x:p.x,y:p.y,v:data[i].value,l:data[i].label})} onMouseLeave={()=>setTip(null)}>
          <circle cx={p.x} cy={p.y} r={5} fill={color} stroke="rgba(255,255,255,.3)" strokeWidth={2}/>
          <text x={p.x} y={h-4} textAnchor="middle" fill="rgba(255,255,255,.4)" fontSize={8}>{data[i].label}</text>
        </g>
      ))}
      {tip&&(
        <g>
          <rect x={tip.x-38} y={tip.y-30} width={76} height={22} rx={6} fill="rgba(10,20,40,.95)" stroke={color} strokeWidth={1}/>
          <text x={tip.x} y={tip.y-15} textAnchor="middle" fill={color} fontSize={9} fontWeight="700">{fmt(tip.v)}</text>
        </g>
      )}
    </svg>
  );
}

/* ── RING ────────────────────────────────────── */
function Ring({pct,size=90,sw=9,color="#06b6d4",label="",sub="",glow=true}){
  const anim=useAnim(pct);
  const r=(size-sw*2)/2,circ=2*Math.PI*r,dash=circ*(Math.min(pct,100)/100)*anim;
  return(
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2,position:"relative"}}>
      <svg width={size} height={size} style={{transform:"rotate(-90deg)"}}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,.07)" strokeWidth={sw}/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={sw} strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" style={glow?{filter:`drop-shadow(0 0 8px ${color}99)`}:{}}/>
      </svg>
      <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",textAlign:"center",pointerEvents:"none"}}>
        {label&&<div style={{fontSize:size*.18,fontWeight:900,color,lineHeight:1}}>{label}</div>}
        {sub&&<div style={{fontSize:size*.11,color:"rgba(255,255,255,.4)",marginTop:1}}>{sub}</div>}
      </div>
    </div>
  );
}

/* ── GLASS CARD ──────────────────────────────── */
function GC({children,style={},onClick,glow="",hover=true}){
  const [hov,setHov]=useState(false);
  return(
    <div onClick={onClick} onMouseEnter={()=>hover&&setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{background:"rgba(255,255,255,0.04)",backdropFilter:"blur(20px)",WebkitBackdropFilter:"blur(20px)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:20,padding:20,
        boxShadow:hov?`0 20px 60px rgba(0,0,0,.5)${glow?",0 0 30px "+glow+"33":""}`:`0 8px 32px rgba(0,0,0,.3)${glow?",0 0 16px "+glow+"18":""})`,
        transition:"all .25s",transform:hov&&onClick?"translateY(-4px) scale(1.01)":"",cursor:onClick?"pointer":"default",...style}}>
      {children}
    </div>
  );
}

/* ── MODAL ───────────────────────────────────── */
function Modal({open,onClose,title,children,wide=false}){
  useEffect(()=>{document.body.style.overflow=open?"hidden":"";return()=>{document.body.style.overflow="";};},[open]);
  if(!open) return null;
  return(
    <div style={{position:"fixed",inset:0,zIndex:3000,background:"rgba(0,0,0,.75)",backdropFilter:"blur(10px)",display:"flex",alignItems:"center",justifyContent:"center",padding:16,animation:"fi .2s"}} onClick={onClose}>
      <div style={{background:"linear-gradient(135deg,rgba(6,182,212,.12),rgba(20,184,166,.08))",backdropFilter:"blur(28px)",WebkitBackdropFilter:"blur(28px)",border:"1px solid rgba(255,255,255,.16)",borderRadius:24,padding:28,width:"100%",maxWidth:wide?620:480,boxShadow:"0 40px 100px rgba(0,0,0,.6)",maxHeight:"92vh",overflowY:"auto",animation:"su .25s"}} onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:22}}>
          <div style={{fontWeight:900,fontSize:20,color:"#fff"}}>{title}</div>
          <button onClick={onClose} style={{background:"rgba(255,255,255,.1)",border:"1px solid rgba(255,255,255,.2)",borderRadius:10,width:34,height:34,color:"rgba(255,255,255,.7)",fontSize:18,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ── TOAST ───────────────────────────────────── */
function Toast({n}){
  if(!n) return null;
  const C={success:"#10b981",error:"#f43f5e",info:"#06b6d4",warning:"#f59e0b"};
  const c=C[n.type]||C.success;
  return(
    <div style={{position:"fixed",top:20,right:20,zIndex:9998,background:`linear-gradient(135deg,${c}ee,${c}aa)`,backdropFilter:"blur(12px)",border:`1px solid ${c}55`,borderRadius:16,padding:"12px 20px",color:"#fff",fontWeight:700,fontSize:14,boxShadow:`0 8px 30px ${c}44`,display:"flex",alignItems:"center",gap:10,animation:"sir .3s",minWidth:220,maxWidth:320}}>
      <span style={{fontSize:20}}>{n.type==="success"?"✅":n.type==="error"?"❌":n.type==="warning"?"⚠️":"ℹ️"}</span>{n.msg}
    </div>
  );
}

/* ── FORM COMPONENTS ─────────────────────────── */
function GIn({label,style={},...p}){
  const [foc,setFoc]=useState(false);
  return(
    <div style={{display:"flex",flexDirection:"column",gap:5}}>
      {label&&<label style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,.5)",textTransform:"uppercase",letterSpacing:.6}}>{label}</label>}
      <input onFocus={()=>setFoc(true)} onBlur={()=>setFoc(false)} style={{width:"100%",padding:"11px 14px",borderRadius:12,border:`1px solid ${foc?"#06b6d4":"rgba(255,255,255,.12)"}`,background:"rgba(255,255,255,.06)",color:"#fff",fontSize:14,outline:"none",transition:"border .2s",...style}} {...p}/>
    </div>
  );
}
function GSel({label,children,...p}){
  return(
    <div style={{display:"flex",flexDirection:"column",gap:5}}>
      {label&&<label style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,.5)",textTransform:"uppercase",letterSpacing:.6}}>{label}</label>}
      <select style={{width:"100%",padding:"11px 14px",borderRadius:12,border:"1px solid rgba(255,255,255,.12)",background:"rgba(10,20,40,.9)",color:"#fff",fontSize:14,outline:"none"}} {...p}>{children}</select>
    </div>
  );
}
function GBtn({children,v="primary",style={},...p}){
  const [hov,setHov]=useState(false);
  const base={padding:"11px 22px",borderRadius:12,border:"none",cursor:"pointer",fontWeight:700,fontSize:14,transition:"all .2s",display:"inline-flex",alignItems:"center",gap:6,justifyContent:"center"};
  const vs={primary:{background:hov?"linear-gradient(135deg,#0891b2,#0d9488)":"linear-gradient(135deg,#06b6d4,#14b8a6)",color:"#fff",boxShadow:hov?"0 8px 24px rgba(6,182,212,.5)":"0 4px 16px rgba(6,182,212,.3)",transform:hov?"scale(1.04)":""},ghost:{background:hov?"rgba(255,255,255,.12)":"rgba(255,255,255,.07)",color:"rgba(255,255,255,.85)",border:"1px solid rgba(255,255,255,.15)"},danger:{background:hov?"linear-gradient(135deg,#e11d48,#be185d)":"linear-gradient(135deg,#f43f5e,#e11d48)",color:"#fff",boxShadow:hov?"0 8px 24px rgba(244,63,94,.5)":"0 4px 16px rgba(244,63,94,.3)",transform:hov?"scale(1.04)":""},success:{background:hov?"linear-gradient(135deg,#059669,#047857)":"linear-gradient(135deg,#10b981,#059669)",color:"#fff",boxShadow:hov?"0 8px 24px rgba(16,185,129,.5)":"0 4px 16px rgba(16,185,129,.3)",transform:hov?"scale(1.04)":""}};
  return <button onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)} style={{...base,...(vs[v]||vs.primary),...style}} {...p}>{children}</button>;
}

/* ── HEATMAP ─────────────────────────────────── */
function Heatmap({expenses,year,month}){
  const days=new Date(year,month+1,0).getDate(), first=new Date(year,month,1).getDay();
  const mk=`${year}-${String(month+1).padStart(2,"0")}`;
  const dm={};
  expenses.filter(e=>e.date&&e.date.startsWith(mk)).forEach(e=>{const d=parseInt(e.date.split("-")[2]);dm[d]=(dm[d]||0)+Number(e.amount);});
  const max=Math.max(...Object.values(dm),1);
  const today=new Date();
  const cells=[...Array(first).fill(null),...Array.from({length:days},(_,i)=>i+1)];
  return(
    <div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3,marginBottom:5}}>
        {["S","M","T","W","T","F","S"].map((d,i)=><div key={i} style={{fontSize:9,textAlign:"center",color:"rgba(255,255,255,.3)",fontWeight:700}}>{d}</div>)}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3}}>
        {cells.map((d,i)=>{
          if(!d) return <div key={"e"+i}/>;
          const amt=dm[d]||0,int=amt/max,isT=today.getDate()===d&&today.getMonth()===month&&today.getFullYear()===year;
          return(
            <div key={d} title={amt>0?`Day ${d}: ${fmt(amt)}`:`Day ${d}`}
              style={{aspectRatio:"1",borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,fontWeight:700,
                background:amt>0?`rgba(6,182,212,${.18+int*.82})`:"rgba(255,255,255,.03)",
                color:amt>0?"#fff":"rgba(255,255,255,.25)",
                border:isT?"2px solid #06b6d4":"1px solid transparent",
                boxShadow:amt>0?`0 0 8px rgba(6,182,212,${int*.5})`:"none",cursor:"default",transition:"transform .15s"}}
              onMouseEnter={e=>{if(amt>0)e.currentTarget.style.transform="scale(1.2)";}}
              onMouseLeave={e=>{e.currentTarget.style.transform="";}}>
              {d}
            </div>);
        })}
      </div>
      <div style={{display:"flex",alignItems:"center",gap:5,marginTop:8,fontSize:9,color:"rgba(255,255,255,.35)"}}>
        <span>Less</span>{[.15,.3,.5,.7,.9].map(v=><div key={v} style={{width:12,height:12,borderRadius:3,background:`rgba(6,182,212,${v})`}}/>)}<span>More</span>
      </div>
    </div>
  );
}

/* ── FINANCIAL MOOD ──────────────────────────── */
function FinancialMood({savingsRate,overBudget,health}){
  const moods=[
    {min:80,icon:"🚀",label:"Rocket Mode",desc:"Crushing it! Keep going!",color:"#10b981",bg:"rgba(16,185,129,.12)"},
    {min:60,icon:"🌟",label:"Star Performer",desc:"Excellent financial health",color:"#06b6d4",bg:"rgba(6,182,212,.12)"},
    {min:40,icon:"😊",label:"On Track",desc:"Good progress. Room to grow!",color:"#6366f1",bg:"rgba(99,102,241,.12)"},
    {min:20,icon:"😐",label:"Needs Attention",desc:"Review your budget habits",color:"#f59e0b",bg:"rgba(245,158,11,.12)"},
    {min:0,icon:"😟",label:"Red Alert",desc:"Overspending! Take action now",color:"#f43f5e",bg:"rgba(244,63,94,.12)"},
  ];
  const mood=moods.find(m=>health>=m.min)||moods[moods.length-1];
  return(
    <div style={{padding:"14px 18px",borderRadius:16,background:mood.bg,border:`1px solid ${mood.color}33`,display:"flex",alignItems:"center",gap:14}}>
      <div style={{fontSize:36,animation:"float 3s ease-in-out infinite"}}>{mood.icon}</div>
      <div>
        <div style={{fontWeight:800,fontSize:16,color:mood.color}}>{mood.label}</div>
        <div style={{fontSize:12,color:"rgba(255,255,255,.5)",marginTop:2}}>{mood.desc}</div>
      </div>
      <div style={{marginLeft:"auto",textAlign:"right"}}>
        <div style={{fontSize:28,fontWeight:900,color:mood.color}}>{health}</div>
        <div style={{fontSize:10,color:"rgba(255,255,255,.4)"}}>Health Score</div>
      </div>
    </div>
  );
}

/* ── NET WORTH ───────────────────────────────── */
function NetWorth({income,expenses,loans,goals}){
  const [assets,setAssets]=useLS("vatsu_assets",{savings:0,fd:0,mf:0,gold:0,property:0,other:0});
  const totalAssets=Object.values(assets).reduce((a,v)=>a+Number(v),0);
  const totalLiabilities=loans.reduce((a,l)=>a+Math.max(0,l.principal-(l.paid||0)),0);
  const nw=totalAssets-totalLiabilities;
  const fields=[{k:"savings",l:"Cash & Savings",i:"💰"},{k:"fd",l:"Fixed Deposits",i:"🏦"},{k:"mf",l:"Mutual Funds",i:"📈"},{k:"gold",l:"Gold",i:"🪙"},{k:"property",l:"Property",i:"🏠"},{k:"other",l:"Other Assets",i:"📦"}];
  const [edit,setEdit]=useState(false);
  return(
    <GC glow={nw>=0?"#10b981":"#f43f5e"}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
        <div style={{fontWeight:800,fontSize:17,color:"#fff"}}>💼 Net Worth</div>
        <GBtn v="ghost" onClick={()=>setEdit(e=>!e)} style={{fontSize:11,padding:"5px 10px"}}>{edit?"Done":"Edit Assets"}</GBtn>
      </div>
      <div style={{textAlign:"center",marginBottom:16}}>
        <div style={{fontSize:10,color:"rgba(255,255,255,.45)",textTransform:"uppercase",letterSpacing:.5}}>Total Net Worth</div>
        <Counter value={nw} color={nw>=0?"#10b981":"#f43f5e"} size={34}/>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
        <div style={{padding:"10px",background:"rgba(16,185,129,.1)",borderRadius:12,border:"1px solid rgba(16,185,129,.2)"}}>
          <div style={{fontSize:10,color:"rgba(255,255,255,.4)"}}>Total Assets</div>
          <div style={{fontSize:18,fontWeight:800,color:"#10b981"}}>{fmt(totalAssets)}</div>
        </div>
        <div style={{padding:"10px",background:"rgba(244,63,94,.1)",borderRadius:12,border:"1px solid rgba(244,63,94,.2)"}}>
          <div style={{fontSize:10,color:"rgba(255,255,255,.4)"}}>Total Liabilities</div>
          <div style={{fontSize:18,fontWeight:800,color:"#f43f5e"}}>{fmt(totalLiabilities)}</div>
        </div>
      </div>
      {edit&&(
        <div style={{display:"flex",flexDirection:"column",gap:8,borderTop:"1px solid rgba(255,255,255,.07)",paddingTop:12}}>
          {fields.map(f=>(
            <div key={f.k} style={{display:"flex",alignItems:"center",gap:8}}>
              <span style={{fontSize:16,width:24}}>{f.i}</span>
              <span style={{flex:1,fontSize:12,color:"rgba(255,255,255,.6)"}}>{f.l}</span>
              <input type="number" value={assets[f.k]} onChange={e=>setAssets(a=>({...a,[f.k]:Number(e.target.value)}))} style={{width:110,padding:"5px 8px",borderRadius:8,border:"1px solid rgba(255,255,255,.15)",background:"rgba(255,255,255,.07)",color:"#fff",fontSize:12,outline:"none",textAlign:"right"}}/>
            </div>
          ))}
        </div>
      )}
    </GC>
  );
}

/* ── BILL REMINDERS ──────────────────────────── */
function Bills({bills,setBills}){
  const [show,setShow]=useState(false);
  const [form,setForm]=useState({name:"",amount:"",dueDay:"1",category:"Bills"});
  const today=new Date().getDate();
  const sorted=[...bills].sort((a,b)=>Number(a.dueDay)-Number(b.dueDay));
  const upcomingDays=bills.map(b=>{const d=Number(b.dueDay)-today; return d<0?d+30:d;});
  return(
    <GC>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <div style={{fontWeight:800,fontSize:16,color:"#fff"}}>📋 Bill Reminders</div>
        <GBtn v="ghost" onClick={()=>setShow(s=>!s)} style={{fontSize:11,padding:"5px 10px"}}>+ Add Bill</GBtn>
      </div>
      {show&&(
        <form onSubmit={e=>{e.preventDefault();if(!form.name||!form.amount)return;setBills(b=>[...b,{id:Date.now(),...form,amount:Number(form.amount)}]);setShow(false);setForm({name:"",amount:"",dueDay:"1",category:"Bills"});}} style={{display:"flex",flexDirection:"column",gap:10,marginBottom:14,padding:14,background:"rgba(255,255,255,.04)",borderRadius:12}}>
          <GIn label="Bill Name" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="e.g. Electricity"/>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <GIn label="Amount (₹)" type="number" value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))} min="1"/>
            <GIn label="Due Day of Month" type="number" value={form.dueDay} onChange={e=>setForm(f=>({...f,dueDay:e.target.value}))} min="1" max="31"/>
          </div>
          <div style={{display:"flex",gap:8}}>
            <GBtn type="submit" style={{flex:1}}>Add Bill</GBtn>
            <GBtn v="ghost" onClick={()=>setShow(false)} style={{flex:1}} type="button">Cancel</GBtn>
          </div>
        </form>
      )}
      {sorted.length===0&&<div style={{textAlign:"center",color:"rgba(255,255,255,.3)",padding:"16px 0",fontSize:13}}>No bills tracked yet</div>}
      {sorted.map((b,i)=>{
        const daysLeft=Number(b.dueDay)-today; const dl=daysLeft<0?daysLeft+30:daysLeft;
        const urgColor=dl<=3?"#f43f5e":dl<=7?"#f59e0b":"#10b981";
        return(
          <div key={b.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 0",borderBottom:"1px solid rgba(255,255,255,.05)"}}>
            <div style={{width:36,height:36,borderRadius:10,background:`rgba(6,182,212,.15)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>📄</div>
            <div style={{flex:1}}>
              <div style={{fontWeight:600,fontSize:13,color:"#fff"}}>{b.name}</div>
              <div style={{fontSize:11,color:"rgba(255,255,255,.4)"}}>Due: {b.dueDay}th every month</div>
            </div>
            <div style={{textAlign:"right"}}>
              <div style={{fontWeight:700,color:"#f43f5e",fontSize:13}}>{fmt(b.amount)}</div>
              <div style={{fontSize:10,color:urgColor,fontWeight:600}}>{dl===0?"Due today!":dl===1?"Tomorrow":dl+" days"}</div>
            </div>
            <button onClick={()=>setBills(bs=>bs.filter(x=>x.id!==b.id))} style={{background:"rgba(244,63,94,.1)",border:"1px solid rgba(244,63,94,.2)",borderRadius:7,width:26,height:26,cursor:"pointer",color:"#f43f5e",fontSize:12,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>×</button>
          </div>
        );
      })}
    </GC>
  );
}

/* ── CATEGORY BUDGET LIMITS ──────────────────── */
function BudgetLimits({limits,setLimits,catTotals,allCats}){
  return(
    <GC>
      <div style={{fontWeight:800,fontSize:16,color:"#fff",marginBottom:14}}>🎯 Category Limits</div>
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {allCats.map((cat,ci)=>{
          const spent=catTotals.find(c=>c.cat===cat)?.total||0;
          const lim=limits[cat]||0;
          const pct=lim>0?(spent/lim)*100:0;
          const over=lim>0&&spent>lim;
          const warn=lim>0&&pct>=80&&!over;
          const col=over?"#f43f5e":warn?"#f59e0b":"#06b6d4";
          return(
            <div key={cat}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:5}}>
                <span style={{fontSize:16}}>{ICONS[cat]||"💸"}</span>
                <span style={{flex:1,fontSize:12,color:"rgba(255,255,255,.7)",fontWeight:600}}>{cat}</span>
                {(over||warn)&&<span style={{fontSize:10,padding:"2px 7px",borderRadius:99,background:over?"rgba(244,63,94,.2)":"rgba(245,158,11,.2)",color:col,fontWeight:700}}>{over?"OVER LIMIT":"NEAR LIMIT"}</span>}
                <span style={{fontSize:12,fontWeight:700,color:col}}>{fmt(spent)}{lim>0?<span style={{color:"rgba(255,255,255,.35)"}}> / {fmt(lim)}</span>:""}</span>
                <input type="number" min="0" placeholder="Set limit" value={lim||""} onChange={e=>setLimits(l=>({...l,[cat]:Number(e.target.value)}))}
                  style={{width:80,padding:"4px 8px",borderRadius:8,border:`1px solid ${over?"#f43f5e44":warn?"#f59e0b44":"rgba(255,255,255,.12)"}`,background:"rgba(255,255,255,.06)",color:"#fff",fontSize:11,outline:"none",textAlign:"right"}}/>
              </div>
              {lim>0&&(
                <div style={{height:5,borderRadius:99,background:"rgba(255,255,255,.06)",overflow:"hidden"}}>
                  <div style={{height:"100%",borderRadius:99,width:`${Math.min(pct,100)}%`,background:`linear-gradient(90deg,${col},${col}99)`,boxShadow:`0 0 8px ${col}55`,transition:"width .8s"}}/>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </GC>
  );
}

/* ── QUICK ADD EXPENSE ───────────────────────── */
function QuickAdd({allCats,onAdd,activeMonth,activeYear}){
  const [open,setOpen]=useState(false);
  const [form,setForm]=useState({desc:"",amount:"",category:allCats[0]||"Food"});
  const today=new Date();
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  function submit(e){
    e.preventDefault();
    if(!form.desc||!form.amount)return;
    onAdd({...form,amount:Number(form.amount),date:`${activeYear}-${String(Number(activeMonth)+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`,note:"Quick add"});
    setForm({desc:"",amount:"",category:allCats[0]||"Food"});
    setOpen(false);
  }
  if(!open) return(
    <button onClick={()=>setOpen(true)} style={{width:"100%",padding:"14px",borderRadius:16,background:"linear-gradient(135deg,rgba(6,182,212,.15),rgba(20,184,166,.1))",border:"2px dashed rgba(6,182,212,.4)",color:"rgba(255,255,255,.7)",fontSize:14,fontWeight:600,cursor:"pointer",transition:"all .2s",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}
      onMouseEnter={e=>{e.currentTarget.style.background="linear-gradient(135deg,rgba(6,182,212,.25),rgba(20,184,166,.2))";e.currentTarget.style.color="#fff";}}
      onMouseLeave={e=>{e.currentTarget.style.background="linear-gradient(135deg,rgba(6,182,212,.15),rgba(20,184,166,.1))";e.currentTarget.style.color="rgba(255,255,255,.7)";}}>
      ⚡ Quick Add Expense
    </button>
  );
  return(
    <GC glow="#06b6d4">
      <div style={{fontWeight:700,fontSize:15,color:"#fff",marginBottom:12}}>⚡ Quick Add Expense</div>
      <form onSubmit={submit} style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"flex-end"}}>
        <div style={{flex:2,minWidth:120}}><GIn placeholder="What did you spend on?" value={form.desc} onChange={e=>set("desc",e.target.value)} required/></div>
        <div style={{flex:1,minWidth:90}}><GIn type="number" placeholder="₹ Amount" value={form.amount} onChange={e=>set("amount",e.target.value)} min="1" required/></div>
        <div style={{flex:1,minWidth:100}}>
          <select value={form.category} onChange={e=>set("category",e.target.value)} style={{width:"100%",padding:"11px 10px",borderRadius:12,border:"1px solid rgba(255,255,255,.12)",background:"rgba(10,20,40,.9)",color:"#fff",fontSize:13,outline:"none"}}>
            {allCats.map(c=><option key={c} value={c}>{ICONS[c]||"💸"} {c}</option>)}
          </select>
        </div>
        <GBtn type="submit" style={{padding:"11px 16px"}}>Add</GBtn>
        <GBtn v="ghost" type="button" onClick={()=>setOpen(false)} style={{padding:"11px 14px"}}>✕</GBtn>
      </form>
    </GC>
  );
}

/* ── INCOME CARD (persistent) ────────────────── */
function IncomeCard({income,onSet,monthlyExpenses}){
  const [editing,setEditing]=useState(false);
  const [val,setVal]=useState(income);
  const pct=income>0?Math.min((monthlyExpenses/income)*100,100):0;
  const col=pct>90?"#f43f5e":pct>70?"#f59e0b":"#06b6d4";
  return(
    <GC glow="#06b6d4" style={{borderTop:`3px solid #06b6d4`}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
        <div>
          <div style={{fontSize:11,color:"rgba(255,255,255,.45)",textTransform:"uppercase",letterSpacing:.6}}>Monthly Income</div>
          {editing?(
            <form onSubmit={e=>{e.preventDefault();onSet(Number(val));setEditing(false);}} style={{display:"flex",gap:6,marginTop:4}}>
              <input autoFocus type="number" value={val} onChange={e=>setVal(e.target.value)} style={{width:130,padding:"6px 10px",borderRadius:10,border:"1px solid #06b6d4",background:"rgba(255,255,255,.08)",color:"#fff",fontSize:18,fontWeight:900,outline:"none"}}/>
              <GBtn type="submit" style={{padding:"6px 12px",fontSize:12}}>✓</GBtn>
            </form>
          ):<Counter value={income} color="#06b6d4" size={28}/>}
        </div>
        <button onClick={()=>setEditing(e=>!e)} style={{background:"rgba(6,182,212,.15)",border:"1px solid rgba(6,182,212,.3)",borderRadius:8,padding:"5px 10px",color:"#06b6d4",fontSize:11,fontWeight:700,cursor:"pointer"}}>
          {editing?"Cancel":"✏️ Edit"}
        </button>
      </div>
      <div style={{height:7,borderRadius:99,background:"rgba(255,255,255,.06)",overflow:"hidden",marginBottom:6}}>
        <div style={{height:"100%",borderRadius:99,width:`${pct}%`,background:`linear-gradient(90deg,#06b6d4,${col})`,boxShadow:`0 0 10px ${col}66`,transition:"width 1s"}}/>
      </div>
      <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"rgba(255,255,255,.4)"}}>
        <span>Spent: <b style={{color:"#f43f5e"}}>{fmt(monthlyExpenses)}</b></span>
        <span>Remaining: <b style={{color:"#10b981"}}>{fmt(Math.max(0,income-monthlyExpenses))}</b></span>
        <span style={{color:col}}>{pct.toFixed(0)}% used</span>
      </div>
    </GC>
  );
}

/* ── SIDEBAR ─────────────────────────────────── */
const NAV=[{id:"dashboard",icon:"📊",label:"Dashboard"},{id:"insights",icon:"💡",label:"Insights"},{id:"forecast",icon:"🔮",label:"Forecast"},{id:"history",icon:"📋",label:"History"},{id:"networth",icon:"💼",label:"Net Worth"},{id:"goals",icon:"🎯",label:"Goals"},{id:"loans",icon:"🏦",label:"Loans"},{id:"challenges",icon:"🏆",label:"Challenges"},{id:"invest",icon:"📈",label:"Invest"},{id:"ai",icon:"🤖",label:"AI Advisor"}];

function Sidebar({tab,setTab,income,spent,balance,theme,setTheme}){
  const [col,setCol]=useState(false);
  const sr=income>0?Math.max(0,Math.round((balance/income)*100)):0;
  return(
    <div style={{width:col?64:210,height:"100vh",position:"sticky",top:0,display:"flex",flexDirection:"column",background:"rgba(255,255,255,.025)",backdropFilter:"blur(20px)",WebkitBackdropFilter:"blur(20px)",borderRight:"1px solid rgba(255,255,255,.07)",transition:"width .3s",flexShrink:0,zIndex:100,overflowY:"auto",overflowX:"hidden"}}>
      {/* Header */}
      <div style={{padding:col?"14px 0":"18px 16px 12px",display:"flex",alignItems:"center",justifyContent:col?"center":"space-between",borderBottom:"1px solid rgba(255,255,255,.05)"}}>
        {!col&&<div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:36,height:36,borderRadius:12,background:"linear-gradient(135deg,#06b6d4,#14b8a6)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,fontSize:18,color:"#fff",boxShadow:"0 4px 16px rgba(6,182,212,.4)"}}>V</div>
          <div><div style={{fontWeight:900,fontSize:17,color:"#fff",letterSpacing:-.5}}>Vatsu</div><div style={{fontSize:9,color:"rgba(255,255,255,.35)"}}>Finance Hub v3</div></div>
        </div>}
        {col&&<div style={{width:34,height:34,borderRadius:11,background:"linear-gradient(135deg,#06b6d4,#14b8a6)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,fontSize:17,color:"#fff"}}>V</div>}
        <button onClick={()=>setCol(c=>!c)} style={{background:"rgba(255,255,255,.07)",border:"1px solid rgba(255,255,255,.1)",borderRadius:7,width:26,height:26,cursor:"pointer",color:"rgba(255,255,255,.5)",fontSize:13,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{col?"›":"‹"}</button>
      </div>
      {/* Quick stats */}
      {!col&&<div style={{padding:"10px 12px",borderBottom:"1px solid rgba(255,255,255,.05)"}}>
        {[{l:"Income",v:fmt(income),c:"#06b6d4"},{l:"Spent",v:fmt(spent),c:"#f43f5e"},{l:"Saved",v:sr+"%",c:"#10b981"}].map((s,i)=>(
          <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"3px 0"}}>
            <span style={{fontSize:10,color:"rgba(255,255,255,.4)"}}>{s.l}</span>
            <span style={{fontSize:11,fontWeight:700,color:s.c}}>{s.v}</span>
          </div>
        ))}
      </div>}
      {/* Nav */}
      <nav style={{flex:1,padding:"8px 6px",display:"flex",flexDirection:"column",gap:1}}>
        {NAV.map(item=>{
          const active=tab===item.id;
          return(
            <button key={item.id} onClick={()=>setTab(item.id)} style={{display:"flex",alignItems:"center",gap:9,padding:col?"10px":"9px 11px",borderRadius:11,border:"none",cursor:"pointer",textAlign:"left",background:active?"linear-gradient(135deg,rgba(6,182,212,.22),rgba(20,184,166,.18))":"transparent",color:active?"#fff":"rgba(255,255,255,.5)",fontWeight:active?700:500,fontSize:12,transition:"all .15s",boxShadow:active?"inset 0 0 0 1px rgba(6,182,212,.3)":"none",justifyContent:col?"center":"flex-start"}}
              onMouseEnter={e=>{if(!active){e.currentTarget.style.background="rgba(255,255,255,.07)";e.currentTarget.style.color="#fff";}}}
              onMouseLeave={e=>{if(!active){e.currentTarget.style.background="transparent";e.currentTarget.style.color="rgba(255,255,255,.5)";}}}
            >
              <span style={{fontSize:17,flexShrink:0}}>{item.icon}</span>
              {!col&&<span style={{flex:1}}>{item.label}</span>}
              {!col&&active&&<div style={{width:5,height:5,borderRadius:99,background:"#06b6d4",boxShadow:"0 0 6px #06b6d4"}}/>}
            </button>
          );
        })}
      </nav>
      {/* Theme toggle */}
      {!col&&<div style={{padding:"10px 12px",borderTop:"1px solid rgba(255,255,255,.05)"}}>
        <button onClick={()=>setTheme(t=>t==="dark"?"light":"dark")} style={{width:"100%",padding:"8px",borderRadius:10,background:"rgba(255,255,255,.07)",border:"1px solid rgba(255,255,255,.1)",color:"rgba(255,255,255,.7)",fontSize:12,cursor:"pointer",display:"flex",alignItems:"center",gap:6,justifyContent:"center"}}>
          {theme==="dark"?"☀️ Light Mode":"🌙 Dark Mode"}
        </button>
      </div>}
    </div>
  );
}

/* ── BOTTOM NAV (mobile) ─────────────────────── */
function BottomNav({tab,setTab}){
  const main=NAV.slice(0,5);
  return(
    <div style={{position:"fixed",bottom:0,left:0,right:0,height:60,background:"rgba(10,20,35,.95)",backdropFilter:"blur(20px)",borderTop:"1px solid rgba(255,255,255,.08)",display:"flex",alignItems:"stretch",zIndex:500}}>
      {main.map(item=>{
        const active=tab===item.id;
        return(
          <button key={item.id} onClick={()=>setTab(item.id)} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:2,background:"none",border:"none",cursor:"pointer",color:active?"#06b6d4":"rgba(255,255,255,.4)",transition:"color .2s"}}>
            <span style={{fontSize:20}}>{item.icon}</span>
            <span style={{fontSize:9,fontWeight:active?700:500}}>{item.label}</span>
            {active&&<div style={{position:"absolute",bottom:0,width:24,height:2,background:"#06b6d4",borderRadius:99,boxShadow:"0 0 6px #06b6d4"}}/>}
          </button>
        );
      })}
    </div>
  );
}

/* ── MAIN APP ────────────────────────────────── */
export default function Vatsu(){
  const [tab,setTab]=useState("dashboard");
  const [theme,setTheme]=useLS("v3_theme","dark");
  const [expenses,setExpenses]=useLS("v3_exp",[]);
  const [income,setIncome]=useLS("v3_income",50000);
  const [goals,setGoals]=useLS("v3_goals",[]);
  const [loans,setLoans]=useLS("v3_loans",[]);
  const [challenges,setChallenges]=useLS("v3_challenges",DEFAULT_CHALLENGES);
  const [recurring,setRecurring]=useLS("v3_recurring",[]);
  const [customCats,setCustomCats]=useLS("v3_customcats",[]);
  const [limits,setLimits]=useLS("v3_limits",{});
  const [bills,setBills]=useLS("v3_bills",[]);
  const [activeMonth,setActiveMonth]=useLS("v3_month",new Date().getMonth());
  const [activeYear,setActiveYear]=useLS("v3_year",new Date().getFullYear());
  const [confetti,setConfetti]=useState(false);
  const [notif,setNotif]=useState(null);
  const [showAdd,setShowAdd]=useState(false);
  const [editExp,setEditExp]=useState(null);
  const [showRecurModal,setShowRecurModal]=useState(false);
  const [recurringPrompt,setRecurringPrompt]=useState(false);
  const [isMobile,setIsMobile]=useState(window.innerWidth<768);

  useEffect(()=>{
    const fn=()=>setIsMobile(window.innerWidth<768);
    window.addEventListener("resize",fn);
    return()=>window.removeEventListener("resize",fn);
  },[]);

  // Light/dark theme
  useEffect(()=>{
    document.documentElement.style.setProperty("--bg",theme==="dark"?"#070d1a":"#f0f4f8");
    document.documentElement.style.setProperty("--text",theme==="dark"?"#fff":"#0f172a");
  },[theme]);

  const allCats=useMemo(()=>[...CATS,...customCats],[customCats]);
  const mk=`${activeYear}-${String(Number(activeMonth)+1).padStart(2,"0")}`;
  const monthExp=useMemo(()=>expenses.filter(e=>e.date&&e.date.startsWith(mk)),[expenses,mk]);
  const totalSpent=useMemo(()=>monthExp.reduce((a,e)=>a+Number(e.amount),0),[monthExp]);
  const balance=income-totalSpent;
  const savingsRate=income>0?Math.max(0,(balance/income)*100):0;
  const health=Math.min(100,Math.round(savingsRate*1.1+(totalSpent<income?15:0)+5));
  const catTotals=useMemo(()=>allCats.map((cat,i)=>({cat,color:PAL[i%PAL.length],total:monthExp.filter(e=>e.category===cat).reduce((a,e)=>a+Number(e.amount),0)})).filter(c=>c.total>0),[allCats,monthExp]);

  const notify=useCallback((msg,type="success")=>{ setNotif({msg,type}); setTimeout(()=>setNotif(null),3500); },[]);
  const celebrate=useCallback(()=>{ setConfetti(true); setTimeout(()=>setConfetti(false),5000); },[]);

  function addExp(data){
    if(editExp){ setExpenses(expenses.map(e=>e.id===editExp.id?{...e,...data}:e)); notify("Expense updated ✏️"); }
    else { setExpenses([{id:Date.now(),...data},...expenses]); notify("Expense added 💸"); }
    setEditExp(null); setShowAdd(false);
  }
  function delExp(id){ setExpenses(expenses.filter(e=>e.id!==id)); notify("Deleted","error"); }
  function applyRecurring(){
    const toAdd=recurring.map(r=>({id:Date.now()+Math.random(),desc:r.desc,amount:r.amount,category:r.category,date:`${activeYear}-${String(Number(activeMonth)+1).padStart(2,"0")}-01`,note:"Recurring"}));
    setExpenses([...toAdd,...expenses]); notify("Added "+toAdd.length+" recurring expenses 🔁");
    setRecurringPrompt(false);
  }

  // Check limits
  const overLimitCats=catTotals.filter(c=>limits[c.cat]&&c.total>limits[c.cat]);

  const isLight=theme==="light";
  const appBg=isLight?"linear-gradient(135deg,#e8f4fd 0%,#f0f9ff 40%,#ecfdf5 100%)":"linear-gradient(135deg,#070d1a 0%,#0a1628 40%,#071220 100%)";
  const textCol=isLight?"#0f172a":"#fff";
  const cardBg=isLight?"rgba(255,255,255,0.8)":"rgba(255,255,255,0.04)";
  const cardBorder=isLight?"rgba(0,0,0,0.08)":"rgba(255,255,255,0.1)";

  return(
    <div style={{minHeight:"100vh",display:"flex",background:appBg,color:textCol,fontFamily:"'Inter',system-ui,sans-serif",position:"relative",overflow:"hidden"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        ::-webkit-scrollbar{width:5px;height:5px;}
        ::-webkit-scrollbar-track{background:transparent;}
        ::-webkit-scrollbar-thumb{background:rgba(6,182,212,.3);border-radius:99px;}
        @keyframes fi{from{opacity:0}to{opacity:1}}
        @keyframes su{from{opacity:0;transform:translateY(28px)}to{opacity:1;transform:translateY(0)}}
        @keyframes sir{from{opacity:0;transform:translateX(40px)}to{opacity:1;transform:translateX(0)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
        @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes shimmer{0%{background-position:-400px 0}100%{background-position:400px 0}}
        @keyframes slideIn{from{opacity:0;transform:translateX(-20px)}to{opacity:1;transform:translateX(0)}}
        .g2{display:grid;grid-template-columns:1fr 1fr;gap:16px;}
        .g3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;}
        .g4{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;}
        @media(max-width:900px){.g3{grid-template-columns:1fr 1fr;}.g4{grid-template-columns:1fr 1fr;}}
        @media(max-width:600px){.g2,.g3,.g4{grid-template-columns:1fr;}}
        .er{display:flex;align-items:center;gap:11px;padding:11px 0;border-bottom:1px solid rgba(255,255,255,.05);transition:all .15s;border-radius:9px;}
        .er:hover{background:rgba(255,255,255,.03);padding-left:8px;}
        .er:last-child{border-bottom:none;}
        input[type=range]{-webkit-appearance:none;width:100%;height:6px;border-radius:99px;background:rgba(255,255,255,.1);outline:none;}
        input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:18px;height:18px;border-radius:99px;background:linear-gradient(135deg,#06b6d4,#14b8a6);cursor:pointer;box-shadow:0 0 8px rgba(6,182,212,.6);}
        select option{background:#0a1628;color:#fff;}
        .tab-content{animation:slideIn .3s;}
      `}</style>

      {/* BG Orbs */}
      {!isLight&&<>
        <div style={{position:"fixed",inset:0,zIndex:0,pointerEvents:"none"}}>
          <div style={{position:"absolute",width:700,height:700,borderRadius:"50%",background:"radial-gradient(circle,rgba(6,182,212,.07),transparent 70%)",top:-300,left:-300,animation:"float 10s ease-in-out infinite"}}/>
          <div style={{position:"absolute",width:500,height:500,borderRadius:"50%",background:"radial-gradient(circle,rgba(20,184,166,.06),transparent 70%)",bottom:-200,right:-200,animation:"float 13s ease-in-out infinite reverse"}}/>
          <div style={{position:"absolute",width:350,height:350,borderRadius:"50%",background:"radial-gradient(circle,rgba(99,102,241,.05),transparent 70%)",top:"45%",left:"45%",animation:"float 9s ease-in-out infinite"}}/>
        </div>
      </>}

      <Confetti active={confetti}/>
      <Toast n={notif}/>

      {/* Recurring prompt */}
      {recurringPrompt&&recurring.length>0&&(
        <div style={{position:"fixed",bottom:80,left:"50%",transform:"translateX(-50%)",zIndex:2000,background:"linear-gradient(135deg,rgba(6,182,212,.2),rgba(20,184,166,.15))",backdropFilter:"blur(20px)",border:"1px solid rgba(6,182,212,.4)",borderRadius:18,padding:"16px 24px",display:"flex",gap:14,alignItems:"center",boxShadow:"0 20px 60px rgba(0,0,0,.5)",animation:"su .3s"}}>
          <div style={{fontSize:24}}>🔁</div>
          <div><div style={{fontWeight:700,color:"#fff",fontSize:14}}>Apply {recurring.length} recurring expenses?</div><div style={{fontSize:11,color:"rgba(255,255,255,.5)"}}>For {MON[activeMonth]} {activeYear}</div></div>
          <GBtn onClick={applyRecurring} style={{padding:"8px 16px",fontSize:12}}>Apply</GBtn>
          <GBtn v="ghost" onClick={()=>setRecurringPrompt(false)} style={{padding:"8px 12px",fontSize:12}}>Later</GBtn>
        </div>
      )}

      {/* Over-limit alert */}
      {overLimitCats.length>0&&(
        <div style={{position:"fixed",top:20,left:"50%",transform:"translateX(-50%)",zIndex:2001,background:"rgba(244,63,94,.15)",backdropFilter:"blur(12px)",border:"1px solid rgba(244,63,94,.4)",borderRadius:14,padding:"10px 18px",color:"#f43f5e",fontWeight:700,fontSize:13,boxShadow:"0 8px 30px rgba(244,63,94,.3)",animation:"sir .3s"}}>
          ⚠️ Over budget: {overLimitCats.map(c=>c.cat).join(", ")}
        </div>
      )}

      {/* Sidebar — hidden on mobile */}
      {!isMobile&&(
        <div style={{position:"relative",zIndex:10}}>
          <Sidebar tab={tab} setTab={setTab} income={income} spent={totalSpent} balance={balance} theme={theme} setTheme={setTheme}/>
        </div>
      )}

      {/* Main */}
      <div style={{flex:1,overflowY:"auto",maxHeight:"100vh",position:"relative",zIndex:1}}>
        {/* Top bar */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 20px",borderBottom:`1px solid ${isLight?"rgba(0,0,0,.07)":"rgba(255,255,255,.06)"}`,background:isLight?"rgba(255,255,255,.6)":"rgba(255,255,255,.02)",backdropFilter:"blur(8px)",position:"sticky",top:0,zIndex:50}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            {isMobile&&<div style={{width:32,height:32,borderRadius:10,background:"linear-gradient(135deg,#06b6d4,#14b8a6)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,fontSize:16,color:"#fff"}}>V</div>}
            <div style={{fontWeight:800,fontSize:20,color:textCol}}>{NAV.find(n=>n.id===tab)?.icon} {NAV.find(n=>n.id===tab)?.label}</div>
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
            <select style={{background:isLight?"rgba(0,0,0,.06)":"rgba(255,255,255,.07)",border:`1px solid ${isLight?"rgba(0,0,0,.1)":"rgba(255,255,255,.13)"}`,borderRadius:9,padding:"6px 10px",color:textCol,fontSize:12,outline:"none"}} value={activeMonth} onChange={e=>{ setActiveMonth(Number(e.target.value)); if(recurring.length>0) setRecurringPrompt(true); }}>
              {MONTHS.map((m,i)=><option key={i} value={i}>{MON[i]}</option>)}
            </select>
            <select style={{background:isLight?"rgba(0,0,0,.06)":"rgba(255,255,255,.07)",border:`1px solid ${isLight?"rgba(0,0,0,.1)":"rgba(255,255,255,.13)"}`,borderRadius:9,padding:"6px 10px",color:textCol,fontSize:12,outline:"none"}} value={activeYear} onChange={e=>setActiveYear(Number(e.target.value))}>
              {[2023,2024,2025,2026,2027].map(y=><option key={y} value={y}>{y}</option>)}
            </select>
            {isMobile&&<button onClick={()=>setTheme(t=>t==="dark"?"light":"dark")} style={{background:"rgba(255,255,255,.1)",border:"1px solid rgba(255,255,255,.15)",borderRadius:8,padding:"6px 10px",color:textCol,fontSize:14,cursor:"pointer"}}>{theme==="dark"?"☀️":"🌙"}</button>}
            <GBtn onClick={()=>setShowAdd(true)} style={{padding:"8px 16px",fontSize:12}}>+ Add Expense</GBtn>
          </div>
        </div>

        <div style={{maxWidth:1080,margin:"0 auto",padding:isMobile?"16px 12px 80px":"20px 20px 24px"}} className="tab-content">
          {tab==="dashboard"&&<DashTab income={income} setIncome={setIncome} totalSpent={totalSpent} balance={balance} savingsRate={savingsRate} health={health} monthExp={monthExp} catTotals={catTotals} allCats={allCats} activeMonth={activeMonth} activeYear={activeYear} expenses={expenses} onEdit={e=>{setEditExp(e);setShowAdd(true);}} onDelete={delExp} limits={limits} setLimits={setLimits} onAddExp={addExp} bills={bills} setBills={setBills} isLight={isLight} textCol={textCol}/>}
          {tab==="insights"&&<InsightsTab expenses={expenses} income={income} activeMonth={activeMonth} activeYear={activeYear} allCats={allCats} health={health} savingsRate={savingsRate} totalSpent={totalSpent} catTotals={catTotals} textCol={textCol}/>}
          {tab==="forecast"&&<ForecastTab expenses={expenses} income={income} activeMonth={activeMonth} activeYear={activeYear}/>}
          {tab==="history"&&<HistoryTab expenses={expenses} allCats={allCats} onDelete={delExp} onEdit={e=>{setEditExp(e);setShowAdd(true);}} textCol={textCol}/>}
          {tab==="networth"&&<NetWorth income={income} expenses={expenses} loans={loans} goals={goals}/>}
          {tab==="goals"&&<GoalsTab goals={goals} setGoals={setGoals} notify={notify} celebrate={celebrate}/>}
          {tab==="loans"&&<LoansTab loans={loans} setLoans={setLoans} notify={notify}/>}
          {tab==="challenges"&&<ChallengesTab challenges={challenges} setChallenges={setChallenges} notify={notify} celebrate={celebrate}/>}
          {tab==="invest"&&<InvestTab income={income} totalSpent={totalSpent}/>}
          {tab==="ai"&&<AITab income={income} expenses={expenses} goals={goals} loans={loans} activeMonth={activeMonth} activeYear={activeYear} allCats={allCats} catTotals={catTotals} savingsRate={savingsRate} totalSpent={totalSpent} balance={balance}/>}
        </div>
      </div>

      {isMobile&&<BottomNav tab={tab} setTab={setTab}/>}

      <Modal open={showAdd} onClose={()=>{setShowAdd(false);setEditExp(null);}} title={editExp?"✏️ Edit Expense":"💸 Add Expense"}>
        <AddExpForm allCats={allCats} onSubmit={addExp} initial={editExp} activeMonth={activeMonth} activeYear={activeYear}/>
      </Modal>
      <Modal open={showRecurModal} onClose={()=>setShowRecurModal(false)} title="🔁 Recurring Expenses">
        <RecurForm recurring={recurring} setRecurring={setRecurring} allCats={allCats}/>
      </Modal>
    </div>
  );
}

/* ── DASHBOARD TAB ───────────────────────────── */
function DashTab({income,setIncome,totalSpent,balance,savingsRate,health,monthExp,catTotals,allCats,activeMonth,activeYear,expenses,onEdit,onDelete,limits,setLimits,onAddExp,bills,setBills,isLight,textCol}){
  const pct=income>0?Math.min((totalSpent/income)*100,100):0;
  const hcol=health>70?"#10b981":health>40?"#f59e0b":"#f43f5e";
  const months6=Array.from({length:6},(_,i)=>{
    const d=new Date(activeYear,activeMonth-5+i,1);
    const m=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
    return{label:MON[d.getMonth()],value:expenses.filter(e=>e.date&&e.date.startsWith(m)).reduce((a,e)=>a+Number(e.amount),0),color:PAL[i]};
  });

  return(
    <div style={{display:"flex",flexDirection:"column",gap:18,animation:"su .4s"}}>
      {/* Income card */}
      <IncomeCard income={income} onSet={setIncome} monthlyExpenses={totalSpent}/>

      {/* Mood + Health */}
      <FinancialMood savingsRate={savingsRate} overBudget={totalSpent>income} health={health}/>

      {/* Stat cards */}
      <div className="g4">
        {[
          {label:"Spent",value:totalSpent,icon:"💸",color:"#f43f5e",sub:pct.toFixed(0)+"% of budget"},
          {label:"Balance",value:Math.abs(balance),icon:balance>=0?"💚":"🔴",color:balance>=0?"#10b981":"#f43f5e",sub:balance>=0?"Surplus 🎉":"Deficit ⚠️"},
          {label:"Savings Rate",value:null,display:savingsRate.toFixed(1)+"%",icon:"📊",color:savingsRate>=20?"#10b981":savingsRate>=10?"#f59e0b":"#f43f5e",sub:savingsRate>=20?"Target met! ✅":"Target: 20%"},
          {label:"Transactions",value:null,display:monthExp.length+"",icon:"🧾",color:"#8b5cf6",sub:"This month"},
        ].map((s,i)=>(
          <GC key={i} glow={s.color} style={{animation:`su ${.1+i*.07}s`}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
              <div style={{fontSize:26}}>{s.icon}</div>
              <div style={{width:7,height:7,borderRadius:99,background:s.color,boxShadow:`0 0 8px ${s.color}`,animation:"pulse 2s infinite"}}/>
            </div>
            <div style={{fontSize:10,color:"rgba(255,255,255,.4)",textTransform:"uppercase",letterSpacing:.5,marginBottom:3}}>{s.label}</div>
            {s.value!=null?<Counter value={s.value} color={s.color} size={22}/>:<div style={{fontSize:22,fontWeight:900,color:s.color}}>{s.display}</div>}
            <div style={{fontSize:10,color:"rgba(255,255,255,.35)",marginTop:3}}>{s.sub}</div>
          </GC>
        ))}
      </div>

      {/* Charts row */}
      <div className="g2">
        <GC>
          <div style={{fontWeight:800,fontSize:15,color:textCol,marginBottom:14}}>🍩 Spending by Category</div>
          <div style={{display:"flex",alignItems:"center",gap:14}}>
            <Donut segs={catTotals.map(c=>({value:c.total,color:c.color,label:c.cat}))} label={fmt(totalSpent)} sub="total"/>
            <div style={{flex:1,display:"flex",flexDirection:"column",gap:6,maxHeight:160,overflowY:"auto"}}>
              {catTotals.map((c,i)=>(
                <div key={i} style={{display:"flex",alignItems:"center",gap:7,fontSize:12}}>
                  <div style={{width:8,height:8,borderRadius:99,background:c.color,boxShadow:`0 0 5px ${c.color}`,flexShrink:0}}/>
                  <span style={{flex:1,color:"rgba(255,255,255,.6)",fontSize:11}}>{c.cat}</span>
                  <span style={{fontWeight:700,color:"#fff",fontSize:12}}>{fmt(c.total)}</span>
                </div>
              ))}
              {catTotals.length===0&&<div style={{color:"rgba(255,255,255,.3)",fontSize:12}}>No expenses yet</div>}
            </div>
          </div>
        </GC>
        <GC>
          <div style={{fontWeight:800,fontSize:15,color:textCol,marginBottom:8}}>📊 6-Month Trend</div>
          <Bars data={months6} h={130}/>
        </GC>
      </div>

      {/* Quick add + heatmap */}
      <QuickAdd allCats={allCats} onAdd={onAddExp} activeMonth={activeMonth} activeYear={activeYear}/>

      <GC>
        <div style={{fontWeight:800,fontSize:15,color:textCol,marginBottom:14}}>🗓️ Daily Spending Heatmap</div>
        <Heatmap expenses={expenses} year={activeYear} month={activeMonth}/>
      </GC>

      {/* Budget ring + limits */}
      <div className="g2">
        <GC>
          <div style={{fontWeight:800,fontSize:15,color:textCol,marginBottom:14}}>🎯 Budget Progress</div>
          <div style={{display:"flex",alignItems:"center",gap:20}}>
            <Ring pct={pct} size={100} sw={11} color={pct>90?"#f43f5e":pct>70?"#f59e0b":"#06b6d4"} label={pct.toFixed(0)+"%"} sub="used"/>
            <div style={{flex:1}}>
              <div style={{height:9,borderRadius:99,background:"rgba(255,255,255,.07)",overflow:"hidden",marginBottom:10}}>
                <div style={{height:"100%",borderRadius:99,width:`${pct}%`,background:pct>90?"linear-gradient(90deg,#f59e0b,#f43f5e)":"linear-gradient(90deg,#06b6d4,#14b8a6)",transition:"width 1s",boxShadow:pct>90?"0 0 14px #f43f5e88":"0 0 14px #06b6d488"}}/>
              </div>
              {[{l:"Income",v:income,c:"#06b6d4"},{l:"Spent",v:totalSpent,c:"#f43f5e"},{l:"Saved",v:Math.max(0,balance),c:"#10b981"}].map((s,i)=>(
                <div key={i} style={{display:"flex",justifyContent:"space-between",fontSize:12,padding:"3px 0"}}>
                  <span style={{color:"rgba(255,255,255,.45)"}}>{s.l}</span>
                  <b style={{color:s.c}}>{fmt(s.v)}</b>
                </div>
              ))}
            </div>
          </div>
        </GC>
        <GC>
          <div style={{fontWeight:800,fontSize:15,color:textCol,marginBottom:8}}>💊 Health Score</div>
          <div style={{display:"flex",alignItems:"center",gap:16}}>
            <Ring pct={health} size={90} sw={10} color={hcol} label={health} sub="/100"/>
            <div>
              <div style={{fontSize:18,fontWeight:900,color:hcol,marginBottom:4}}>{health>70?"Excellent 🌟":health>40?"Good 👍":"Needs Work ⚠️"}</div>
              <div style={{fontSize:11,color:"rgba(255,255,255,.45)",lineHeight:1.5}}>Based on savings rate,<br/>budget adherence & more</div>
            </div>
          </div>
        </GC>
      </div>

      {/* Category limits */}
      <BudgetLimits limits={limits} setLimits={setLimits} catTotals={catTotals} allCats={allCats}/>

      {/* Bills */}
      <Bills bills={bills} setBills={setBills}/>

      {/* Recent */}
      <GC>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <div style={{fontWeight:800,fontSize:15,color:textCol}}>💳 Recent Expenses</div>
          <div style={{fontSize:11,color:"rgba(255,255,255,.4)"}}>{monthExp.length} total</div>
        </div>
        {monthExp.length===0&&<div style={{textAlign:"center",color:"rgba(255,255,255,.3)",padding:"24px 0",fontSize:14}}>🌟 No expenses this month</div>}
        {monthExp.slice(0,8).map(e=>{
          const ci=allCats.indexOf(e.category),col=PAL[ci%PAL.length];
          return(
            <div key={e.id} className="er">
              <div style={{width:38,height:38,borderRadius:11,background:`${col}20`,border:`1px solid ${col}40`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:19,flexShrink:0}}>{ICONS[e.category]||"💸"}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:600,fontSize:13,color:textCol,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.desc}</div>
                <div style={{fontSize:10,color:"rgba(255,255,255,.38)",marginTop:1}}>{e.category} • {e.date}</div>
              </div>
              <div style={{fontWeight:800,color:"#f43f5e",fontSize:14,flexShrink:0}}>{fmt(e.amount)}</div>
              <button onClick={()=>onEdit(e)} style={{background:"rgba(255,255,255,.07)",border:"1px solid rgba(255,255,255,.1)",borderRadius:7,width:28,height:28,cursor:"pointer",color:"rgba(255,255,255,.55)",fontSize:13,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>✏️</button>
              <button onClick={()=>onDelete(e.id)} style={{background:"rgba(244,63,94,.1)",border:"1px solid rgba(244,63,94,.2)",borderRadius:7,width:28,height:28,cursor:"pointer",color:"#f43f5e",fontSize:13,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>🗑️</button>
            </div>
          );
        })}
      </GC>
    </div>
  );
}

/* ── INSIGHTS TAB ────────────────────────────── */
function InsightsTab({expenses,income,activeMonth,activeYear,allCats,health,savingsRate,totalSpent,catTotals,textCol}){
  const hcol=health>70?"#10b981":health>40?"#f59e0b":"#f43f5e";
  const months6=Array.from({length:6},(_,i)=>{
    const d=new Date(activeYear,activeMonth-5+i,1);
    const m=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
    return{label:MON[d.getMonth()],value:expenses.filter(e=>e.date&&e.date.startsWith(m)).reduce((a,e)=>a+Number(e.amount),0),color:PAL[i]};
  });
  const today=new Date();
  const mk=`${activeYear}-${String(Number(activeMonth)+1).padStart(2,"0")}`;
  const thisW=expenses.filter(e=>{if(!e.date||!e.date.startsWith(mk))return false;const d=new Date(e.date),diff=(today-d)/(864e5);return diff>=0&&diff<7;}).reduce((a,e)=>a+Number(e.amount),0);
  const lastW=expenses.filter(e=>{if(!e.date||!e.date.startsWith(mk))return false;const d=new Date(e.date),diff=(today-d)/(864e5);return diff>=7&&diff<14;}).reduce((a,e)=>a+Number(e.amount),0);
  const wdiff=lastW>0?((thisW-lastW)/lastW)*100:0;
  return(
    <div style={{display:"flex",flexDirection:"column",gap:18,animation:"su .4s"}}>
      <div className="g2">
        <GC glow={hcol}>
          <div style={{fontWeight:800,fontSize:15,color:"#fff",marginBottom:14}}>🏥 Health Score</div>
          <div style={{display:"flex",alignItems:"center",gap:18}}>
            <Ring pct={health} size={100} sw={11} color={hcol} label={health} sub="/100"/>
            <div>
              <div style={{fontSize:20,fontWeight:900,color:hcol,marginBottom:6}}>{health>70?"Excellent 🌟":health>40?"Good 👍":"Needs Work ⚠️"}</div>
              {[{l:"Savings Rate",v:savingsRate.toFixed(1)+"%",c:savingsRate>20?"#10b981":"#f59e0b"},{l:"Budget Used",v:(income>0?(totalSpent/income*100):0).toFixed(1)+"%",c:totalSpent>income?"#f43f5e":"#06b6d4"}].map((s,i)=>(
                <div key={i} style={{display:"flex",gap:8,alignItems:"center",marginBottom:4}}>
                  <div style={{width:7,height:7,borderRadius:99,background:s.c}}/>
                  <span style={{fontSize:11,color:"rgba(255,255,255,.5)"}}>{s.l}:</span>
                  <b style={{fontSize:12,color:s.c}}>{s.v}</b>
                </div>
              ))}
            </div>
          </div>
        </GC>
        <GC>
          <div style={{fontWeight:800,fontSize:15,color:"#fff",marginBottom:14}}>📅 Week-over-Week</div>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {[{l:"This Week",v:fmt(thisW),c:"#06b6d4"},{l:"Last Week",v:fmt(lastW),c:"rgba(255,255,255,.5)"},{l:"Change",v:(wdiff>0?"+":"")+wdiff.toFixed(1)+"%",c:wdiff>10?"#f43f5e":wdiff<-10?"#10b981":"#f59e0b"}].map((s,i)=>(
              <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"8px 12px",background:"rgba(255,255,255,.04)",borderRadius:10}}>
                <span style={{fontSize:12,color:"rgba(255,255,255,.5)"}}>{s.l}</span>
                <b style={{fontSize:14,color:s.c}}>{s.v}</b>
              </div>
            ))}
            <div style={{padding:"10px 12px",borderRadius:12,background:wdiff>10?"rgba(244,63,94,.1)":wdiff<-10?"rgba(16,185,129,.1)":"rgba(245,158,11,.1)",fontSize:12,color:"rgba(255,255,255,.75)",lineHeight:1.5}}>
              {wdiff>10?"📈 Spending up! Review transactions.":wdiff<-10?"📉 Great! Less spending this week.":"📊 Spending is stable."}
            </div>
          </div>
        </GC>
      </div>
      <GC>
        <div style={{fontWeight:800,fontSize:15,color:"#fff",marginBottom:10}}>📊 6-Month Spending Trend</div>
        <Bars data={months6} h={150}/>
        <div style={{marginTop:12}}>
          <LineC data={months6} color="#06b6d4" h={90}/>
        </div>
      </GC>
      <GC>
        <div style={{fontWeight:800,fontSize:15,color:"#fff",marginBottom:14}}>🎨 Category Analysis</div>
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          {catTotals.map((c,i)=>{
            const pct=income>0?(c.total/income)*100:0;
            return(
              <div key={i}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                  <div style={{display:"flex",alignItems:"center",gap:7}}><span style={{fontSize:17}}>{ICONS[c.cat]||"💸"}</span><span style={{fontSize:13,fontWeight:600,color:"#fff"}}>{c.cat}</span></div>
                  <div style={{display:"flex",gap:10,alignItems:"center"}}><span style={{fontSize:11,color:"rgba(255,255,255,.4)"}}>{pct.toFixed(1)}%</span><b style={{fontSize:14,color:c.color}}>{fmt(c.total)}</b></div>
                </div>
                <div style={{height:7,borderRadius:99,background:"rgba(255,255,255,.06)",overflow:"hidden"}}>
                  <div style={{height:"100%",borderRadius:99,width:`${Math.min(pct,100)}%`,background:`linear-gradient(90deg,${c.color},${c.color}88)`,boxShadow:`0 0 8px ${c.color}44`,transition:"width .8s"}}/>
                </div>
              </div>
            );
          })}
          {catTotals.length===0&&<div style={{color:"rgba(255,255,255,.3)",textAlign:"center",padding:"20px 0"}}>No data this month</div>}
        </div>
      </GC>
      <GC>
        <div style={{fontWeight:800,fontSize:15,color:"#fff",marginBottom:12}}>💡 Smart Insights</div>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {totalSpent>income&&<Tip t="danger">⚠️ Over budget by {fmt(totalSpent-income)}. Cut back on {catTotals[0]?.cat||"top"} spending immediately.</Tip>}
          {savingsRate<20&&totalSpent<=income&&<Tip t="warning">💡 Savings {savingsRate.toFixed(1)}% — below 20% target. Save {fmt(Math.round(income*.2))}/month.</Tip>}
          {savingsRate>=20&&<Tip t="success">🌟 Saving {savingsRate.toFixed(1)}% — {fmt(Math.round(income-totalSpent))} saved this month!</Tip>}
          {catTotals[0]&&catTotals[0].total>income*.3&&<Tip t="info">📊 {catTotals[0].cat} is {(catTotals[0].total/income*100).toFixed(0)}% of income. Set a spending cap.</Tip>}
          {wdiff>20&&<Tip t="warning">📈 Spending jumped {wdiff.toFixed(0)}% this week vs last.</Tip>}
          {savingsRate>=30&&<Tip t="success">🚀 Saving 30%+! Invest the surplus in SIP for compound growth.</Tip>}
        </div>
      </GC>
    </div>
  );
}
function Tip({t,children}){
  const s={danger:{bg:"rgba(244,63,94,.1)",b:"rgba(244,63,94,.3)",c:"#fca5a5"},warning:{bg:"rgba(245,158,11,.1)",b:"rgba(245,158,11,.3)",c:"#fcd34d"},success:{bg:"rgba(16,185,129,.1)",b:"rgba(16,185,129,.3)",c:"#6ee7b7"},info:{bg:"rgba(6,182,212,.1)",b:"rgba(6,182,212,.3)",c:"#7dd3fc"}};
  const x=s[t]||s.info;
  return <div style={{padding:"11px 15px",borderRadius:12,background:x.bg,border:`1px solid ${x.b}`,fontSize:13,color:x.c,lineHeight:1.6}}>{children}</div>;
}

/* ── FORECAST TAB ────────────────────────────── */
function ForecastTab({expenses,income,activeMonth,activeYear}){
  const today=new Date(); const dim=new Date(activeYear,activeMonth+1,0).getDate();
  const mk=activeYear+"-"+String(activeMonth+1).padStart(2,"0");
  const mExp=expenses.filter(e=>e.date&&e.date.startsWith(mk));
  const spent=mExp.reduce((a,e)=>a+Number(e.amount),0);
  const dom=today.getMonth()===activeMonth&&today.getFullYear()===activeYear?today.getDate():dim;
  const daily=dom>0?spent/dom:0; const proj=Math.round(daily*dim);
  const left=Math.max(0,dim-dom); const safeDailyLeft=left>0?(income-spent)/left:0;
  const over=proj>income; const pct=income>0?(spent/income)*100:0;
  const hist6=Array.from({length:5},(_,i)=>{
    const d=new Date(activeYear,activeMonth-4+i,1);
    const m=d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0");
    return{label:MON[d.getMonth()],value:expenses.filter(e=>e.date&&e.date.startsWith(m)).reduce((a,e)=>a+Number(e.amount),0),color:PAL[i]};
  });
  hist6.push({label:MON[activeMonth]+"*",value:proj,color:over?"#f43f5e":"#10b981"});
  const msg=over?"Over budget by "+fmt(proj-income)+". Reduce to "+fmt(Math.round(Math.max(0,safeDailyLeft)))+"/day for "+left+" days remaining.":"On track to save "+fmt(income-proj)+" this month. Keep it up!";
  return(
    <div style={{display:"flex",flexDirection:"column",gap:18,animation:"su .4s"}}>
      <GC glow={over?"#f43f5e":"#10b981"}>
        <div style={{fontWeight:800,fontSize:18,color:"#fff",marginBottom:16}}>📈 Spending Forecast</div>
        <div className="g4" style={{marginBottom:16}}>
          {[{l:"Spent So Far",v:fmt(spent),c:"#f59e0b",i:"💸"},{l:"Projected",v:fmt(proj),c:over?"#f43f5e":"#10b981",i:"🔮"},{l:"Daily Avg",v:fmt(Math.round(daily)),c:"#06b6d4",i:"📅"},{l:"Safe Daily",v:fmt(Math.round(Math.max(0,safeDailyLeft))),c:"#8b5cf6",i:"🛡️"}].map((s,i)=>(
            <div key={i} style={{padding:"12px",background:"rgba(255,255,255,.05)",borderRadius:13,border:"1px solid "+s.c+"22"}}>
              <div style={{fontSize:20,marginBottom:5}}>{s.i}</div>
              <div style={{fontSize:10,color:"rgba(255,255,255,.4)",marginBottom:2}}>{s.l}</div>
              <div style={{fontSize:16,fontWeight:900,color:s.c}}>{s.v}</div>
            </div>
          ))}
        </div>
        <div style={{marginBottom:10}}>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:5,color:"rgba(255,255,255,.6)"}}>
            <span>Budget used: {pct.toFixed(1)}%</span>
            <span style={{color:over?"#f43f5e":"#10b981",fontWeight:700}}>{over?"OVER BUDGET":"ON TRACK"}</span>
          </div>
          <div style={{height:10,borderRadius:99,background:"rgba(255,255,255,.07)",overflow:"hidden"}}>
            <div style={{height:"100%",borderRadius:99,width:Math.min(pct,100)+"%",background:over?"linear-gradient(90deg,#f59e0b,#f43f5e)":"linear-gradient(90deg,#06b6d4,#14b8a6)",transition:"width .8s",boxShadow:over?"0 0 12px #f43f5e88":"0 0 12px #06b6d488"}}/>
          </div>
        </div>
        <Bars data={hist6} h={120}/>
        <div style={{marginTop:10}}><LineC data={hist6} color={over?"#f43f5e":"#14b8a6"} h={80}/></div>
        <div style={{padding:"12px 15px",borderRadius:13,background:over?"rgba(244,63,94,.1)":"rgba(16,185,129,.1)",border:"1px solid "+(over?"#f43f5e":"#10b981")+"30",fontSize:13,color:"rgba(255,255,255,.8)",lineHeight:1.6,marginTop:10}}>
          {over?"⚠️ "+msg:"✅ "+msg}
        </div>
      </GC>
    </div>
  );
}

/* ── HISTORY TAB ─────────────────────────────── */
function HistoryTab({expenses,allCats,onDelete,onEdit}){
  const [q,setQ]=useState(""); const [fc,setFc]=useState("All"); const [sb,setSb]=useState("date");
  const fil=expenses.filter(e=>fc==="All"||e.category===fc).filter(e=>!q||e.desc?.toLowerCase().includes(q.toLowerCase())||e.category?.toLowerCase().includes(q.toLowerCase())).sort((a,b)=>sb==="date"?new Date(b.date)-new Date(a.date):Number(b.amount)-Number(a.amount));
  const tot=fil.reduce((a,e)=>a+Number(e.amount),0);
  return(
    <div style={{display:"flex",flexDirection:"column",gap:14,animation:"su .4s"}}>
      <GC>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:12}}>
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search..." style={{flex:1,minWidth:150,padding:"9px 13px",borderRadius:11,border:"1px solid rgba(255,255,255,.1)",background:"rgba(255,255,255,.06)",color:"#fff",fontSize:13,outline:"none"}}/>
          <select value={fc} onChange={e=>setFc(e.target.value)} style={{padding:"9px 12px",borderRadius:11,border:"1px solid rgba(255,255,255,.1)",background:"rgba(10,20,40,.9)",color:"#fff",fontSize:12,outline:"none"}}>
            <option value="All">All Cats</option>{allCats.map(c=><option key={c}>{c}</option>)}
          </select>
          <select value={sb} onChange={e=>setSb(e.target.value)} style={{padding:"9px 12px",borderRadius:11,border:"1px solid rgba(255,255,255,.1)",background:"rgba(10,20,40,.9)",color:"#fff",fontSize:12,outline:"none"}}>
            <option value="date">By Date</option><option value="amount">By Amount</option>
          </select>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:"rgba(255,255,255,.4)",marginBottom:12,paddingBottom:10,borderBottom:"1px solid rgba(255,255,255,.06)"}}>
          <span>{fil.length} transactions</span><span>Total: <b style={{color:"#f43f5e"}}>{fmt(tot)}</b></span>
        </div>
        {fil.length===0&&<div style={{textAlign:"center",color:"rgba(255,255,255,.3)",padding:"24px 0"}}>No transactions found</div>}
        {fil.map(e=>{const ci=allCats.indexOf(e.category),col=PAL[ci%PAL.length];return(
          <div key={e.id} className="er">
            <div style={{width:37,height:37,borderRadius:11,background:col+"20",border:"1px solid "+col+"35",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>{ICONS[e.category]||"💸"}</div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontWeight:600,fontSize:13,color:"#fff",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.desc}</div>
              <div style={{fontSize:10,color:"rgba(255,255,255,.35)",marginTop:1}}>{e.category} • {e.date}{e.note&&" • "+e.note}</div>
            </div>
            <b style={{color:"#f43f5e",fontSize:13,flexShrink:0}}>{fmt(e.amount)}</b>
            <button onClick={()=>onEdit(e)} style={{background:"rgba(255,255,255,.07)",border:"1px solid rgba(255,255,255,.1)",borderRadius:7,width:27,height:27,cursor:"pointer",color:"rgba(255,255,255,.55)",fontSize:13,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>✏️</button>
            <button onClick={()=>onDelete(e.id)} style={{background:"rgba(244,63,94,.1)",border:"1px solid rgba(244,63,94,.2)",borderRadius:7,width:27,height:27,cursor:"pointer",color:"#f43f5e",fontSize:13,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>🗑️</button>
          </div>
        );})}
      </GC>
    </div>
  );
}

/* ── GOALS TAB ───────────────────────────────── */
function GoalsTab({goals,setGoals,notify,celebrate}){
  const [show,setShow]=useState(false);
  function add(g){setGoals([...goals,{id:Date.now(),...g,saved:0}]);setShow(false);notify("Goal added! 🎯");}
  function del(id){setGoals(goals.filter(g=>g.id!==id));notify("Deleted","error");}
  function addSaving(id,amt){setGoals(goals.map(g=>{if(g.id!==id)return g;const ns=Math.min(g.target,(g.saved||0)+Number(amt));if(ns>=g.target){notify("Goal Achieved! 🎉");celebrate();}return{...g,saved:ns};}));}
  return(
    <div style={{display:"flex",flexDirection:"column",gap:14,animation:"su .4s"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{fontSize:13,color:"rgba(255,255,255,.45)"}}>{goals.length} goals active</div>
        <GBtn onClick={()=>setShow(true)}>+ New Goal</GBtn>
      </div>
      {goals.length===0&&<GC style={{textAlign:"center",padding:40}}><div style={{fontSize:52,marginBottom:12}}>🎯</div><div style={{color:"rgba(255,255,255,.45)"}}>Set your first financial goal!</div></GC>}
      <div className="g2">
        {goals.map(g=>{const pct=g.target>0?Math.min((g.saved||0)/g.target*100,100):0;const done=pct>=100;const col=done?"#10b981":pct>50?"#06b6d4":"#8b5cf6";
          return(<GC key={g.id} glow={col}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
              <div><div style={{fontWeight:800,fontSize:15,color:"#fff"}}>🎯 {g.name}</div>{g.deadline&&<div style={{fontSize:10,color:"rgba(255,255,255,.35)",marginTop:2}}>Target: {g.deadline}</div>}</div>
              <button onClick={()=>del(g.id)} style={{background:"rgba(244,63,94,.1)",border:"1px solid rgba(244,63,94,.2)",borderRadius:7,width:28,height:28,cursor:"pointer",color:"#f43f5e",fontSize:13,display:"flex",alignItems:"center",justifyContent:"center"}}>🗑️</button>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:12}}>
              <Ring pct={pct} size={72} sw={8} color={col} label={pct.toFixed(0)+"%"}/>
              <div><div style={{fontSize:20,fontWeight:900,color:col}}>{fmt(g.saved||0)}</div><div style={{fontSize:11,color:"rgba(255,255,255,.35)"}}>of {fmt(g.target)}</div><div style={{fontSize:10,color:"rgba(255,255,255,.25)",marginTop:3}}>Left: {fmt(Math.max(0,g.target-(g.saved||0)))}</div></div>
            </div>
            {done?<div style={{textAlign:"center",padding:"8px",background:"rgba(16,185,129,.15)",border:"1px solid rgba(16,185,129,.3)",borderRadius:10,color:"#6ee7b7",fontWeight:700}}>🎉 Goal Achieved!</div>:(
              <form onSubmit={e=>{e.preventDefault();const v=e.target.a.value;if(!v)return;addSaving(g.id,v);e.target.reset();}} style={{display:"flex",gap:8}}>
                <input name="a" type="number" min="1" placeholder="Add (₹)" style={{flex:1,padding:"8px 11px",borderRadius:9,border:"1px solid rgba(255,255,255,.1)",background:"rgba(255,255,255,.06)",color:"#fff",fontSize:12,outline:"none"}}/>
                <GBtn type="submit" style={{padding:"8px 13px",fontSize:12}}>Add</GBtn>
              </form>
            )}
          </GC>);
        })}
      </div>
      <Modal open={show} onClose={()=>setShow(false)} title="🎯 New Goal">
        <GoalForm onSubmit={add}/>
      </Modal>
    </div>
  );
}

/* ── LOANS TAB ───────────────────────────────── */
function LoansTab({loans,setLoans,notify}){
  const [show,setShow]=useState(false);
  function add(l){setLoans([...loans,{id:Date.now(),...l,paid:0}]);setShow(false);notify("Loan added 🏦");}
  function del(id){setLoans(loans.filter(l=>l.id!==id));notify("Deleted","error");}
  function payEMI(id){setLoans(loans.map(l=>l.id!==id?l:{...l,paid:Math.min(l.principal,(l.paid||0)+(l.emi||0))}));notify("EMI recorded ✅");}
  const totalDebt=loans.reduce((a,l)=>a+Math.max(0,l.principal-(l.paid||0)),0);
  return(
    <div style={{display:"flex",flexDirection:"column",gap:14,animation:"su .4s"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{fontSize:13,color:"rgba(255,255,255,.45)"}}>Outstanding: <b style={{color:"#f43f5e"}}>{fmt(totalDebt)}</b></div>
        <GBtn onClick={()=>setShow(true)}>+ Add Loan</GBtn>
      </div>
      {loans.length===0&&<GC style={{textAlign:"center",padding:40}}><div style={{fontSize:52,marginBottom:12}}>🏦</div><div style={{color:"rgba(255,255,255,.45)"}}>No loans tracked yet</div></GC>}
      <div className="g2">
        {loans.map(l=>{const pct=l.principal>0?Math.min(((l.paid||0)/l.principal)*100,100):0;const done=pct>=100;const col=done?"#10b981":"#f43f5e";
          return(<GC key={l.id} glow={col}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
              <div><div style={{fontWeight:800,fontSize:15,color:"#fff"}}>🏦 {l.name}</div><div style={{fontSize:10,color:"rgba(255,255,255,.35)",marginTop:2}}>{l.rate}% p.a. • {l.tenureMonths} months</div></div>
              <button onClick={()=>del(l.id)} style={{background:"rgba(244,63,94,.1)",border:"1px solid rgba(244,63,94,.2)",borderRadius:7,width:28,height:28,cursor:"pointer",color:"#f43f5e",display:"flex",alignItems:"center",justifyContent:"center"}}>🗑️</button>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:12}}>
              <Ring pct={pct} size={72} sw={8} color={col} label={pct.toFixed(0)+"%"}/>
              <div><div style={{fontSize:18,fontWeight:900,color:col}}>{fmt(Math.max(0,l.principal-(l.paid||0)))}</div><div style={{fontSize:11,color:"rgba(255,255,255,.35)"}}>remaining</div><div style={{fontSize:10,color:"rgba(255,255,255,.25)",marginTop:3}}>EMI: {fmt(l.emi)}/mo</div></div>
            </div>
            {done?<div style={{textAlign:"center",padding:"8px",background:"rgba(16,185,129,.15)",border:"1px solid rgba(16,185,129,.3)",borderRadius:10,color:"#6ee7b7",fontWeight:700}}>🎉 Fully Paid!</div>:<GBtn v="success" onClick={()=>payEMI(l.id)} style={{width:"100%",fontSize:12}}>✓ Pay EMI ({fmt(l.emi)})</GBtn>}
          </GC>);
        })}
      </div>
      <Modal open={show} onClose={()=>setShow(false)} title="🏦 Add Loan"><LoanForm onSubmit={add}/></Modal>
    </div>
  );
}

/* ── CHALLENGES TAB ──────────────────────────── */
function ChallengesTab({challenges,setChallenges,notify,celebrate}){
  const [show,setShow]=useState(false);
  function add(c){setChallenges([...challenges,{id:Date.now(),...c,progress:0,preset:false}]);setShow(false);notify("Challenge added 🏆");}
  function del(id){setChallenges(challenges.filter(c=>c.id!==id));notify("Deleted","error");}
  function upd(id,val){setChallenges(challenges.map(c=>{if(c.id!==id)return c;const np=Math.min(c.target,(c.progress||0)+Number(val));if(np>=c.target){notify("Challenge Complete! 🏆");celebrate();}return{...c,progress:np};}));}
  return(
    <div style={{display:"flex",flexDirection:"column",gap:14,animation:"su .4s"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{fontSize:13,color:"rgba(255,255,255,.45)"}}>{challenges.length} challenges</div>
        <GBtn onClick={()=>setShow(true)}>+ Custom Challenge</GBtn>
      </div>
      <div className="g2">
        {challenges.map(c=>{const pct=c.target>0?Math.min(((c.progress||0)/c.target)*100,100):0;const done=pct>=100;const col=done?"#10b981":pct>60?"#06b6d4":"#8b5cf6";
          return(<GC key={c.id} glow={col}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
              <div style={{flex:1}}>
                <div style={{fontWeight:800,fontSize:15,color:"#fff"}}>{c.icon||"🏆"} {c.name}</div>
                {c.desc&&<div style={{fontSize:10,color:"rgba(255,255,255,.35)",marginTop:2}}>{c.desc}</div>}
                <div style={{fontSize:10,color:"rgba(255,255,255,.28)",marginTop:1}}>{c.type} • {c.duration} days{c.preset?<span style={{color:"#06b6d4",marginLeft:5}}>✦ Built-in</span>:""}</div>
              </div>
              <button onClick={()=>del(c.id)} style={{background:"rgba(244,63,94,.1)",border:"1px solid rgba(244,63,94,.2)",borderRadius:7,width:27,height:27,cursor:"pointer",color:"#f43f5e",fontSize:12,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>×</button>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:10}}>
              <Ring pct={pct} size={65} sw={7} color={col} label={pct.toFixed(0)+"%"}/>
              <div><div style={{fontSize:18,fontWeight:900,color:col}}>{c.progress||0}</div><div style={{fontSize:10,color:"rgba(255,255,255,.35)"}}>of {c.target}</div></div>
            </div>
            {done?<div style={{textAlign:"center",padding:"7px",background:"rgba(16,185,129,.15)",border:"1px solid rgba(16,185,129,.3)",borderRadius:9,color:"#6ee7b7",fontWeight:700,fontSize:13}}>🏆 Complete!</div>:(
              <form onSubmit={e=>{e.preventDefault();const v=e.target.v.value;if(!v)return;upd(c.id,v);e.target.reset();}} style={{display:"flex",gap:7}}>
                <input name="v" type="number" min="1" placeholder="Update progress" style={{flex:1,padding:"7px 10px",borderRadius:9,border:"1px solid rgba(255,255,255,.1)",background:"rgba(255,255,255,.06)",color:"#fff",fontSize:12,outline:"none"}}/>
                <GBtn type="submit" style={{padding:"7px 12px",fontSize:12}}>+</GBtn>
              </form>
            )}
          </GC>);
        })}
      </div>
      <Modal open={show} onClose={()=>setShow(false)} title="🏆 Custom Challenge"><ChallengeForm onSubmit={add}/></Modal>
    </div>
  );
}

/* ── INVEST TAB ──────────────────────────────── */
function InvestTab({income,totalSpent}){
  const [monthly,setMonthly]=useState(Math.max(500,Math.round((income-totalSpent)*.5)));
  const [yr,setYr]=useState(10); const [rate,setRate]=useState(12);
  const sipVal=sip(monthly,rate,yr); const invested=monthly*yr*12; const returns=sipVal-invested;
  const insts=[{n:"SIP – Equity MF",i:"📈",c:"#06b6d4",r:12,risk:"Medium",rc:"#f59e0b",d:"Diversified equity. Best for long-term wealth."},{n:"PPF",i:"🏛️",c:"#10b981",r:7.1,risk:"Very Low",rc:"#10b981",d:"Govt-backed. 15yr lock-in. Tax-free returns."},{n:"Fixed Deposit",i:"🏦",c:"#6366f1",r:7,risk:"Very Low",rc:"#10b981",d:"Safe & guaranteed. Best for short-term."},{n:"NPS",i:"👴",c:"#8b5cf6",r:10,risk:"Low-Med",rc:"#f59e0b",d:"Pension system. Extra Rs50k deduction."},{n:"Gold ETF",i:"🪙",c:"#f59e0b",r:8,risk:"Medium",rc:"#f59e0b",d:"Digital gold. Inflation hedge."},{n:"Direct Stocks",i:"🚀",c:"#f43f5e",r:15,risk:"High",rc:"#f43f5e",d:"High risk, high reward."}];
  const cmpData=insts.map(i=>({label:i.n.split(" ")[0],value:Math.round(sip(monthly,i.r,yr)),color:i.c}));
  const free=income-totalSpent; const ready=income>0?Math.min(100,Math.round(Math.max(0,free/income)*150)):0;
  return(
    <div style={{display:"flex",flexDirection:"column",gap:18,animation:"su .4s"}}>
      <GC glow="#06b6d4">
        <div style={{fontWeight:800,fontSize:18,color:"#fff",marginBottom:18}}>🧮 SIP Calculator</div>
        <div style={{display:"flex",gap:20,flexWrap:"wrap"}}>
          <div style={{flex:1,minWidth:200}}>
            <GIn label="Monthly Investment (₹)" type="number" value={monthly} onChange={e=>setMonthly(Number(e.target.value))} min="500"/>
            <div style={{marginTop:14}}><label style={{fontSize:11,color:"rgba(255,255,255,.45)",fontWeight:700,textTransform:"uppercase",letterSpacing:.5}}>Duration: {yr} Years</label><input type="range" min="1" max="30" value={yr} onChange={e=>setYr(Number(e.target.value))} style={{marginTop:7,display:"block"}}/></div>
            <div style={{marginTop:14}}><label style={{fontSize:11,color:"rgba(255,255,255,.45)",fontWeight:700,textTransform:"uppercase",letterSpacing:.5}}>Return: {rate}% p.a.</label><input type="range" min="4" max="20" value={rate} onChange={e=>setRate(Number(e.target.value))} style={{marginTop:7,display:"block"}}/></div>
          </div>
          <div style={{flex:1,minWidth:200,display:"flex",flexDirection:"column",gap:9}}>
            {[{l:"Invested",v:fmt(invested),c:"#06b6d4",i:"💰"},{l:"Returns",v:fmt(Math.round(returns)),c:"#10b981",i:"📈"},{l:"Maturity",v:fmt(Math.round(sipVal)),c:"#f59e0b",i:"🏆"},{l:"Multiplier",v:(invested>0?(sipVal/invested).toFixed(2):0)+"x",c:"#8b5cf6",i:"✨"}].map((s,i)=>(
              <div key={i} style={{display:"flex",gap:10,alignItems:"center",padding:"9px 12px",background:"rgba(255,255,255,.05)",borderRadius:11,border:"1px solid "+s.c+"22"}}>
                <span style={{fontSize:18}}>{s.i}</span>
                <div><div style={{fontSize:10,color:"rgba(255,255,255,.4)"}}>{s.l}</div><div style={{fontSize:16,fontWeight:900,color:s.c}}>{s.v}</div></div>
              </div>
            ))}
          </div>
        </div>
        <div style={{marginTop:16}}>
          <div style={{fontSize:12,fontWeight:700,color:"rgba(255,255,255,.6)",marginBottom:8}}>Corpus by Instrument (at same investment)</div>
          <Bars data={cmpData} h={130} showVal={false}/>
        </div>
      </GC>
      <div className="g2">
        {insts.map((inst,i)=>{const proj=Math.round(sip(monthly,inst.r,yr));return(
          <GC key={i} glow={inst.c}>
            <div style={{display:"flex",gap:10,marginBottom:10}}>
              <div style={{width:42,height:42,borderRadius:11,background:inst.c+"20",border:"1px solid "+inst.c+"35",display:"flex",alignItems:"center",justifyContent:"center",fontSize:21,flexShrink:0}}>{inst.i}</div>
              <div style={{flex:1}}>
                <div style={{fontWeight:700,fontSize:14,color:"#fff"}}>{inst.n}</div>
                <div style={{display:"flex",gap:5,marginTop:3}}>
                  <span style={{fontSize:10,padding:"2px 7px",borderRadius:99,background:inst.rc+"20",color:inst.rc,fontWeight:600}}>{inst.risk}</span>
                  <span style={{fontSize:10,padding:"2px 7px",borderRadius:99,background:"rgba(16,185,129,.15)",color:"#10b981",fontWeight:600}}>{inst.r}% p.a.</span>
                </div>
              </div>
            </div>
            <div style={{fontSize:11,color:"rgba(255,255,255,.4)",marginBottom:8,lineHeight:1.5}}>{inst.d}</div>
            <div style={{fontSize:12,fontWeight:600,color:"rgba(255,255,255,.65)"}}>{yr}yr corpus: <span style={{color:inst.c,fontWeight:900,fontSize:14}}>{fmt(proj)}</span></div>
          </GC>
        );})}
      </div>
      <GC>
        <div style={{fontWeight:800,fontSize:15,color:"#fff",marginBottom:14}}>🎯 Investment Readiness</div>
        <div style={{display:"flex",alignItems:"center",gap:20}}>
          <Ring pct={ready} size={95} sw={10} color={ready>60?"#10b981":ready>30?"#f59e0b":"#f43f5e"} label={ready+"%"} sub="ready"/>
          <div>
            <div style={{fontSize:18,fontWeight:900,color:ready>60?"#10b981":ready>30?"#f59e0b":"#f43f5e",marginBottom:5}}>{ready>60?"Start Investing Now 🚀":ready>30?"Start Small 📈":"Build Fund First 🛡️"}</div>
            <div style={{fontSize:12,color:"rgba(255,255,255,.45)",lineHeight:1.5}}>{free>0?"Free cash: "+fmt(free)+"/month. Invest "+fmt(Math.round(free*.5))+" for best results.":"Focus on reducing expenses first."}</div>
          </div>
        </div>
      </GC>
    </div>
  );
}

/* ── AI ADVISOR TAB ──────────────────────────── */
function AITab({income,expenses,goals,loans,activeMonth,activeYear,allCats,catTotals,savingsRate,totalSpent,balance}){
  const [q,setQ]=useState(""); const [resp,setResp]=useState(""); const [loading,setLoading]=useState(false); const [hist,setHist]=useState([]);
  const totalDebt=loans.reduce((a,l)=>a+Math.max(0,l.principal-(l.paid||0)),0);
  const monthlyEMIs=loans.reduce((a,l)=>a+(l.emi||0),0);
  const emiRatio=income>0?(monthlyEMIs/income)*100:0;
  const last3=Array.from({length:3},(_,i)=>{const d=new Date(activeYear,activeMonth-2+i,1);const m=d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0");return expenses.filter(e=>e.date&&e.date.startsWith(m)).reduce((a,e)=>a+Number(e.amount),0);});
  const trend=last3[2]>last3[0]?"increasing":last3[2]<last3[0]?"decreasing":"stable";
  const top0=catTotals[0], top1=catTotals[1];

  function genResp(q){
    const ql=q.toLowerCase();
    if(ql.includes("save")||ql.includes("saving")||ql.includes("cut")){
      const alert=savingsRate<10?"CRITICAL: Below 10% — no buffer!":savingsRate<20?"Below 20% target. Save "+fmt(Math.round(income*.2))+"/month.":"Great — "+savingsRate.toFixed(1)+"% savings rate!";
      const t1=top0?"Cut "+top0.cat+" by 20% = save "+fmt(Math.round(top0.total*.2))+"/month":"Track expenses to find top category";
      const t2=top1?"Cut "+top1.cat+" by 15% = save "+fmt(Math.round(top1.total*.15))+"/month":"Review subscriptions";
      return "SAVINGS ANALYSIS

Your Situation:
• Income: "+fmt(income)+"/month
• Spent: "+fmt(totalSpent)+" ("+((totalSpent/income||0)*100).toFixed(1)+"%)
• Balance: "+fmt(balance)+" ("+savingsRate.toFixed(1)+"% saved)
• Trend: "+trend+" over 3 months

"+alert+"

Action Plan:
1. "+t1+"
2. "+t2+"
3. Automate "+fmt(Math.round(income*.2))+" savings on payday
4. 50/30/20 Rule: Needs "+fmt(income*.5)+" | Wants "+fmt(income*.3)+" | Save "+fmt(income*.2)+"
5. Emergency fund target: "+fmt(income*4)+" (4 months income)

Potential extra savings: "+fmt(Math.round((top0?.total||0)*.2+(top1?.total||0)*.15))+"/month!";
    }
    if(ql.includes("invest")||ql.includes("sip")||ql.includes("mutual")){
      const inv=Math.max(0,Math.round(balance*.6));
      return "INVESTMENT ROADMAP

Your Capacity:
• Free cash: "+fmt(balance)+"/month
• Recommended: "+fmt(inv)+" (60% of surplus)
• EMI burden: "+fmt(monthlyEMIs)+" ("+emiRatio.toFixed(0)+"% of income)

Priority Order:
1. Emergency Fund: "+fmt(income*4)+" target in liquid fund
2. 80C Tax Saving: Rs12,500/month in ELSS — saves up to Rs45,000/year
3. NPS: Rs4,167/month — extra Rs50k deduction
4. SIP: "+fmt(inv)+"/month @ 12% for 10yr = "+fmt(Math.round(sip(inv,12,10)))+"
   Same for 20yr = "+fmt(Math.round(sip(inv,12,20)))+"
5. Goal Funds: "+fmt(Math.round(balance*.2))+"/month for "+goals.length+" active goals

Rule: Always keep 3 months expenses as liquid emergency fund!";
    }
    if(ql.includes("loan")||ql.includes("debt")||ql.includes("emi")){
      const dfm=monthlyEMIs>0?Math.ceil(totalDebt/monthlyEMIs):0;
      return "DEBT ANALYSIS

Your Debt:
• Outstanding: "+fmt(totalDebt)+"
• Monthly EMIs: "+fmt(monthlyEMIs)+" ("+emiRatio.toFixed(1)+"% of income)
• Status: "+(emiRatio>40?"DANGER — above 40%!":emiRatio>30?"CAUTION — aim below 30%":"HEALTHY — within limits")+"
• Debt-free in: "+dfm+" months at current pace

Strategies:
Avalanche (saves most interest):
  Pay min on all, extra on highest-rate loan
  Extra payment: "+fmt(Math.round(balance*.3))+"/month

Snowball (best motivation):
  Clear smallest balance first for quick wins

Pro Tip: Rs1,000 extra/month on Rs10L @ 10% saves ~1.5 years of EMIs!";
    }
    if(ql.includes("budget")||ql.includes("plan")){
      return "BUDGET PLAN for "+fmt(income)+"/month

NEEDS (50%) — "+fmt(income*.5)+"
  Rent/EMI: "+fmt(income*.25)+"
  Groceries: "+fmt(income*.1)+"
  Transport: "+fmt(income*.07)+"
  Bills: "+fmt(income*.05)+"
  Health: "+fmt(income*.03)+"

WANTS (30%) — "+fmt(income*.3)+"
  Dining: "+fmt(income*.1)+"
  Shopping: "+fmt(income*.1)+"
  Travel: "+fmt(income*.05)+"
  Subscriptions: "+fmt(income*.03)+"

SAVINGS (20%) — "+fmt(income*.2)+"
  Emergency: "+fmt(income*.05)+"
  Investments: "+fmt(income*.1)+"
  Goals: "+fmt(income*.05)+"

You spent "+fmt(totalSpent)+" this month. "+(totalSpent>income*.8?"Over 80% — reduce Wants!":"Healthy range!");
    }
    if(ql.includes("tax")||ql.includes("80c")){
      return "TAX SAVING GUIDE (FY 2025-26)

Annual income: "+fmt(income*12)+"

80C (Rs1.5L limit):
  ELSS MF: Rs12,500/month — best returns, 3yr lock
  PPF: Rs1.5L/year — 7.1% tax-free
  NSC, LIC, Tuition fees also eligible

Beyond 80C:
  80D: Health insurance — Rs25,000 (Rs50k for parents)
  80CCD(1B): NPS — extra Rs50,000
  HRA: Submit rent receipts to employer
  Section 24: Home loan interest — up to Rs2L
  80E: Education loan interest — unlimited

Estimated tax savings: "+fmt(Math.round(200000*.3))+"/year by maxing 80C + NPS!";
    }
    if(ql.includes("health")||ql.includes("doing")||ql.includes("score")){
      return "YOUR FINANCIAL HEALTH REPORT

Health Score: "+Math.min(100,Math.round(savingsRate*1.1+15+5))+"/100

Strengths:
"+(savingsRate>20?"✅ Savings rate above 20%
":"")+(totalSpent<income?"✅ Spending within income
":"")+(goals.length>0?"✅ "+goals.length+" active goals
":"")+(monthlyEMIs<income*.3?"✅ EMI ratio healthy
":"")+"
Improvement Areas:
"+(savingsRate<20?"❌ Savings "+savingsRate.toFixed(1)+"% — target 20%+
":"")+(totalSpent>income?"❌ Overspending by "+fmt(totalSpent-income)+"
":"")+(goals.length===0?"❌ No goals set
":"")+(emiRatio>40?"❌ EMI burden too high
":"")+"
30-Day Challenge: Cut "+(top0?.cat||"top")+" spending by "+fmt(Math.round((top0?.total||0)*.15))+" this month!";
    }
    return "AI FINANCIAL ADVISOR

Your Snapshot:
• Income: "+fmt(income)+"/month
• Spent: "+fmt(totalSpent)+" ("+((totalSpent/income||0)*100).toFixed(1)+"%)
• Balance: "+fmt(balance)+"
• Savings: "+savingsRate.toFixed(1)+"%
• Goals: "+goals.length+" active
• Debt: "+fmt(totalDebt)+"
• Trend: "+trend+"

"+(totalSpent>income?"ALERT: Overspent by "+fmt(totalSpent-income)+"!":savingsRate>20?"Financial position is healthy!":"Room to improve finances.")+"

Ask me about:
• How to save more money?
• Where should I invest?
• Create a budget plan
• Help with my loans
• Tax saving tips
• How am I doing financially?";
  }

  async function ask(){
    if(!q.trim()) return;
    setLoading(true); const qv=q; setQ("");
    await new Promise(r=>setTimeout(r,600));
    const r=genResp(qv); setResp(r); setHist(h=>[{q:qv,a:r},...h.slice(0,4)]); setLoading(false);
  }

  const sugg=["How to save more?","Investment advice?","Budget plan","Loan management","Tax saving tips","Financial health check"];
  return(
    <div style={{display:"flex",flexDirection:"column",gap:18,animation:"su .4s"}}>
      <div className="g4">
        {[{l:"Income",v:fmt(income),c:"#06b6d4",i:"💰"},{l:"Spent",v:fmt(totalSpent),c:"#f43f5e",i:"💸"},{l:"Savings",v:savingsRate.toFixed(1)+"%",c:"#10b981",i:"📊"},{l:"Debt",v:fmt(totalDebt),c:"#8b5cf6",i:"🏦"}].map((s,i)=>(
          <GC key={i} style={{padding:14}}>
            <div style={{fontSize:22,marginBottom:5}}>{s.i}</div>
            <div style={{fontSize:10,color:"rgba(255,255,255,.4)"}}>{s.l}</div>
            <div style={{fontSize:17,fontWeight:900,color:s.c}}>{s.v}</div>
          </GC>
        ))}
      </div>
      <GC glow="#06b6d4">
        <div style={{fontWeight:800,fontSize:16,color:"#fff",marginBottom:13}}>🤖 Ask AI Advisor</div>
        <div style={{display:"flex",gap:9,marginBottom:12}}>
          <input value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>e.key==="Enter"&&ask()} placeholder="Ask anything about your finances..." style={{flex:1,padding:"11px 15px",borderRadius:13,border:"1px solid rgba(255,255,255,.13)",background:"rgba(255,255,255,.07)",color:"#fff",fontSize:13,outline:"none"}}/>
          <GBtn onClick={ask} disabled={loading} style={{padding:"11px 18px",minWidth:75}}>{loading?"⏳":"Ask →"}</GBtn>
        </div>
        <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
          {sugg.map((s,i)=>(
            <button key={i} onClick={()=>setQ(s)} style={{padding:"6px 13px",borderRadius:99,border:"1px solid rgba(255,255,255,.1)",background:"rgba(255,255,255,.05)",color:"rgba(255,255,255,.6)",fontSize:11,cursor:"pointer",transition:"all .2s"}}
              onMouseEnter={e=>{e.currentTarget.style.background="rgba(6,182,212,.15)";e.currentTarget.style.color="#7dd3fc";}}
              onMouseLeave={e=>{e.currentTarget.style.background="rgba(255,255,255,.05)";e.currentTarget.style.color="rgba(255,255,255,.6)";}}>
              {s}
            </button>
          ))}
        </div>
      </GC>
      {(resp||loading)&&(
        <GC glow="#14b8a6">
          <div style={{display:"flex",gap:11,marginBottom:11}}>
            <div style={{width:34,height:34,borderRadius:11,background:"linear-gradient(135deg,#06b6d4,#14b8a6)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,flexShrink:0}}>🤖</div>
            <div style={{fontWeight:700,fontSize:14,color:"#fff",paddingTop:7}}>AI Response</div>
          </div>
          {loading?<div style={{color:"rgba(255,255,255,.45)",animation:"pulse 1s infinite",fontSize:13}}>Analyzing your finances...</div>:
          <div style={{fontSize:13,color:"rgba(255,255,255,.82)",whiteSpace:"pre-line",lineHeight:1.8}}>{resp}</div>}
        </GC>
      )}
      {hist.length>1&&(
        <GC>
          <div style={{fontWeight:700,fontSize:13,color:"rgba(255,255,255,.5)",marginBottom:10}}>Recent Questions</div>
          {hist.slice(1).map((h,i)=>(
            <button key={i} onClick={()=>setResp(h.a)} style={{display:"block",width:"100%",textAlign:"left",padding:"9px 13px",borderRadius:11,border:"1px solid rgba(255,255,255,.07)",background:"rgba(255,255,255,.03)",color:"rgba(255,255,255,.55)",fontSize:12,cursor:"pointer",marginBottom:5,transition:"all .2s"}}
              onMouseEnter={e=>{e.currentTarget.style.background="rgba(255,255,255,.07)";e.currentTarget.style.color="#fff";}}
              onMouseLeave={e=>{e.currentTarget.style.background="rgba(255,255,255,.03)";e.currentTarget.style.color="rgba(255,255,255,.55)";}}>
              💬 {h.q}
            </button>
          ))}
        </GC>
      )}
    </div>
  );
}

/* ── ALL FORMS ───────────────────────────────── */
function AddExpForm({allCats,onSubmit,initial,activeMonth,activeYear}){
  const today=new Date();
  const def=initial?.date||(activeYear+"-"+String(Number(activeMonth)+1).padStart(2,"0")+"-"+String(today.getDate()).padStart(2,"0"));
  const [f,setF]=useState({desc:initial?.desc||"",amount:initial?.amount||"",category:initial?.category||allCats[0],date:def,note:initial?.note||""});
  const s=(k,v)=>setF(x=>({...x,[k]:v}));
  return(
    <form onSubmit={e=>{e.preventDefault();if(!f.desc||!f.amount)return;onSubmit({...f,amount:Number(f.amount)});}} style={{display:"flex",flexDirection:"column",gap:13}}>
      <GIn label="Description *" value={f.desc} onChange={e=>s("desc",e.target.value)} placeholder="e.g. Grocery run" required/>
      <GIn label="Amount (₹) *" type="number" value={f.amount} onChange={e=>s("amount",e.target.value)} min="1" required/>
      <GSel label="Category" value={f.category} onChange={e=>s("category",e.target.value)}>
        {allCats.map(c=><option key={c} value={c}>{ICONS[c]||"💸"} {c}</option>)}
      </GSel>
      <GIn label="Date *" type="date" value={f.date} onChange={e=>s("date",e.target.value)} required/>
      <GIn label="Note" value={f.note} onChange={e=>s("note",e.target.value)} placeholder="Optional note"/>
      <GBtn type="submit" style={{marginTop:4}}>{initial?"Update Expense":"Add Expense"}</GBtn>
    </form>
  );
}
function GoalForm({onSubmit}){
  const [f,setF]=useState({name:"",target:"",deadline:""});
  const s=(k,v)=>setF(x=>({...x,[k]:v}));
  return(
    <form onSubmit={e=>{e.preventDefault();if(!f.name||!f.target)return;onSubmit({...f,target:Number(f.target)});}} style={{display:"flex",flexDirection:"column",gap:13}}>
      <GIn label="Goal Name *" value={f.name} onChange={e=>s("name",e.target.value)} placeholder="e.g. Emergency Fund"/>
      <GIn label="Target Amount (₹) *" type="number" value={f.target} onChange={e=>s("target",e.target.value)} min="1"/>
      <GIn label="Target Date" type="date" value={f.deadline} onChange={e=>s("deadline",e.target.value)}/>
      <GBtn type="submit">Set Goal 🎯</GBtn>
    </form>
  );
}
function LoanForm({onSubmit}){
  const [f,setF]=useState({name:"",principal:"",rate:"",tenureMonths:"",emi:""});
  const s=(k,v)=>setF(x=>({...x,[k]:v}));
  function calc(e){e.preventDefault();const p=Number(f.principal),r=Number(f.rate)/12/100,n=Number(f.tenureMonths);if(!p||!r||!n)return;s("emi",Math.round((p*r*Math.pow(1+r,n))/(Math.pow(1+r,n)-1)));}
  return(
    <form onSubmit={e=>{e.preventDefault();if(!f.name||!f.principal)return;onSubmit({...f,principal:Number(f.principal),rate:Number(f.rate),tenureMonths:Number(f.tenureMonths),emi:Number(f.emi)});}} style={{display:"flex",flexDirection:"column",gap:13}}>
      <GIn label="Loan Name *" value={f.name} onChange={e=>s("name",e.target.value)} placeholder="e.g. Home Loan"/>
      <GIn label="Principal (₹) *" type="number" value={f.principal} onChange={e=>s("principal",e.target.value)} min="1"/>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <GIn label="Rate (%/yr)" type="number" value={f.rate} onChange={e=>s("rate",e.target.value)} step=".01"/>
        <GIn label="Tenure (months)" type="number" value={f.tenureMonths} onChange={e=>s("tenureMonths",e.target.value)} min="1"/>
      </div>
      <div style={{display:"flex",gap:9,alignItems:"flex-end"}}>
        <div style={{flex:1}}><GIn label="EMI (₹)" type="number" value={f.emi} onChange={e=>s("emi",e.target.value)}/></div>
        <GBtn v="ghost" onClick={calc} type="button" style={{flexShrink:0}}>Calc EMI</GBtn>
      </div>
      <GBtn type="submit">Add Loan 🏦</GBtn>
    </form>
  );
}
function ChallengeForm({onSubmit}){
  const [f,setF]=useState({name:"",target:"",type:"savings",duration:"30",icon:"🏆"});
  const s=(k,v)=>setF(x=>({...x,[k]:v}));
  return(
    <form onSubmit={e=>{e.preventDefault();if(!f.name||!f.target)return;onSubmit({...f,target:Number(f.target),duration:Number(f.duration)});}} style={{display:"flex",flexDirection:"column",gap:13}}>
      <GIn label="Challenge Name *" value={f.name} onChange={e=>s("name",e.target.value)} placeholder="e.g. No eating out 30 days"/>
      <GIn label="Target *" type="number" value={f.target} onChange={e=>s("target",e.target.value)} min="1"/>
      <GSel label="Type" value={f.type} onChange={e=>s("type",e.target.value)}>
        <option value="savings">Savings Challenge</option>
        <option value="spending">Spending Limit</option>
        <option value="streak">Streak Challenge</option>
      </GSel>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <GIn label="Duration (days)" type="number" value={f.duration} onChange={e=>s("duration",e.target.value)} min="1"/>
        <GIn label="Icon (emoji)" value={f.icon} onChange={e=>s("icon",e.target.value)} placeholder="🏆"/>
      </div>
      <GBtn type="submit">Start Challenge 🏆</GBtn>
    </form>
  );
}
function RecurForm({recurring,setRecurring,allCats}){
  const [f,setF]=useState({desc:"",amount:"",category:allCats[0]||"Food"});
  const s=(k,v)=>setF(x=>({...x,[k]:v}));
  return(
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <form onSubmit={e=>{e.preventDefault();if(!f.desc||!f.amount)return;setRecurring(r=>[...r,{id:Date.now(),...f,amount:Number(f.amount)}]);setF({desc:"",amount:"",category:allCats[0]||"Food"});}} style={{display:"flex",flexDirection:"column",gap:11}}>
        <GIn label="Description *" value={f.desc} onChange={e=>s("desc",e.target.value)} placeholder="e.g. Netflix, Gym"/>
        <GIn label="Amount (₹) *" type="number" value={f.amount} onChange={e=>s("amount",e.target.value)} min="1"/>
        <GSel label="Category" value={f.category} onChange={e=>s("category",e.target.value)}>{allCats.map(c=><option key={c}>{c}</option>)}</GSel>
        <GBtn type="submit">Add Recurring 🔁</GBtn>
      </form>
      {recurring.map(r=>(
        <div key={r.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 0",borderBottom:"1px solid rgba(255,255,255,.06)"}}>
          <div><div style={{fontWeight:600,color:"#fff",fontSize:13}}>{r.desc}</div><div style={{fontSize:10,color:"rgba(255,255,255,.35)"}}>{r.category} • {fmt(r.amount)}</div></div>
          <button onClick={()=>setRecurring(rr=>rr.filter(x=>x.id!==r.id))} style={{background:"rgba(244,63,94,.1)",border:"1px solid rgba(244,63,94,.2)",borderRadius:7,width:27,height:27,cursor:"pointer",color:"#f43f5e",display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
        </div>
      ))}
      {recurring.length===0&&<div style={{color:"rgba(255,255,255,.3)",textAlign:"center",padding:"12px 0",fontSize:12}}>No recurring expenses yet</div>}
    </div>
  );
}
