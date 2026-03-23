import { useState, useEffect, useRef, useCallback, useMemo } from "react";

/* ─────────────────────────────────────────────
   CONSTANTS & HELPERS
───────────────────────────────────────────── */
const CATEGORIES = ["Food","Transport","Shopping","Health","Entertainment","Bills","Education","Others"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const SHORT_MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const CAT_ICONS = { Food:"🍔", Transport:"🚗", Shopping:"🛍️", Health:"💊", Entertainment:"🎮", Bills:"📄", Education:"📚", Others:"📦" };
const PALETTE = ["#0ea5e9","#14b8a6","#6366f1","#f59e0b","#10b981","#f43f5e","#8b5cf6","#06b6d4","#84cc16","#ec4899","#fb923c","#a78bfa"];

function useLocalStorage(key, def) {
  const [val, setVal] = useState(() => {
    try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : def; }
    catch { return def; }
  });
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} }, [key, val]);
  return [val, setVal];
}

function fmtINR(n) {
  if (isNaN(n) || n == null) return "₹0";
  if (Math.abs(n) >= 1e7) return "₹" + (n/1e7).toFixed(2) + "Cr";
  if (Math.abs(n) >= 1e5) return "₹" + (n/1e5).toFixed(2) + "L";
  return new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:0}).format(n);
}

function sipProjection(monthly, rate, years) {
  const r = rate / 12 / 100, n = years * 12;
  if (r === 0) return monthly * n;
  return monthly * ((Math.pow(1+r,n)-1)/r) * (1+r);
}

function lerp(a,b,t){ return a+(b-a)*t; }

/* ─────────────────────────────────────────────
   CONFETTI
───────────────────────────────────────────── */
function Confetti({ active }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const pieces = Array.from({length:120},()=>({
      x: Math.random()*canvas.width,
      y: Math.random()*canvas.height-canvas.height,
      r: Math.random()*8+4,
      d: Math.random()*120,
      color: PALETTE[Math.floor(Math.random()*PALETTE.length)],
      tilt: Math.floor(Math.random()*10)-10,
      tiltAngle: 0,
      tiltAngleIncrement: Math.random()*0.07+0.05
    }));
    let angle = 0, frame;
    function draw() {
      ctx.clearRect(0,0,canvas.width,canvas.height);
      angle += 0.01;
      pieces.forEach(p => {
        p.tiltAngle += p.tiltAngleIncrement;
        p.y += (Math.cos(angle+p.d)+1+p.r/2)*1.5;
        p.x += Math.sin(angle)*2;
        p.tilt = Math.sin(p.tiltAngle)*12;
        if(p.y > canvas.height) { p.y=-10; p.x=Math.random()*canvas.width; }
        ctx.beginPath();
        ctx.fillStyle = p.color;
        ctx.ellipse(p.x+p.tilt,p.y,p.r,p.r/2,Math.PI/4,0,2*Math.PI);
        ctx.fill();
      });
      frame = requestAnimationFrame(draw);
    }
    draw();
    const t = setTimeout(()=>cancelAnimationFrame(frame),4000);
    return ()=>{ cancelAnimationFrame(frame); clearTimeout(t); };
  },[active]);
  if(!active) return null;
  return <canvas ref={canvasRef} style={{position:"fixed",inset:0,zIndex:9999,pointerEvents:"none"}}/>;
}

/* ─────────────────────────────────────────────
   ANIMATED DONUT CHART
───────────────────────────────────────────── */
function AnimDonut({ segments, size=140, thick=22, label="" }) {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    let start = null, raf;
    function step(ts) {
      if(!start) start=ts;
      const p = Math.min((ts-start)/700,1);
      setProgress(p < 1 ? lerp(0,1,p*p*(3-2*p)) : 1);
      if(p < 1) raf = requestAnimationFrame(step);
    }
    raf = requestAnimationFrame(step);
    return ()=>cancelAnimationFrame(raf);
  },[segments]);
  const cx=size/2, cy=size/2, rr=(size-thick)/2;
  const total = segments.reduce((a,s)=>a+s.value,0);
  if(total===0) return (
    <svg width={size} height={size}>
      <circle cx={cx} cy={cy} r={rr} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={thick}/>
      <text x={cx} y={cy+5} textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize={12}>No data</text>
    </svg>
  );
  let cum=0;
  const arcs = segments.map((s,i)=>{
    const pct=(s.value/total)*progress;
    const a1=cum*2*Math.PI-Math.PI/2;
    const a2=(cum+pct)*2*Math.PI-Math.PI/2;
    cum+=s.value/total;
    const x1=cx+rr*Math.cos(a1), y1=cy+rr*Math.sin(a1);
    const x2=cx+rr*Math.cos(a2), y2=cy+rr*Math.sin(a2);
    const lg=pct>0.5?1:0;
    if(Math.abs(a2-a1)<0.001) return null;
    return <path key={i} d={`M ${x1} ${y1} A ${rr} ${rr} 0 ${lg} 1 ${x2} ${y2}`} fill="none" stroke={s.color} strokeWidth={thick} strokeLinecap="round" style={{filter:`drop-shadow(0 0 6px ${s.color}88)`}}/>;
  });
  return (
    <svg width={size} height={size}>
      <circle cx={cx} cy={cy} r={rr} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={thick}/>
      {arcs}
      <text x={cx} y={cy-6} textAnchor="middle" fill="rgba(255,255,255,0.9)" fontSize={13} fontWeight="700">{label}</text>
      <text x={cx} y={cy+12} textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize={10}>spending</text>
    </svg>
  );
}

/* ─────────────────────────────────────────────
   ANIMATED BAR CHART
───────────────────────────────────────────── */
function BarChart({ data, color="#0ea5e9", height=160 }) {
  const [anim, setAnim] = useState(0);
  useEffect(()=>{
    let start=null,raf;
    function step(ts){
      if(!start) start=ts;
      const p=Math.min((ts-start)/800,1);
      setAnim(p<1?lerp(0,1,p*p*(3-2*p)):1);
      if(p<1) raf=requestAnimationFrame(step);
    }
    raf=requestAnimationFrame(step);
    return()=>cancelAnimationFrame(raf);
  },[data]);
  const max=Math.max(...data.map(d=>d.value),1);
  return (
    <div style={{display:"flex",alignItems:"flex-end",gap:6,height,paddingBottom:24,position:"relative"}}>
      {data.map((d,i)=>{
        const h=((d.value/max)*height*0.75)*anim;
        return (
          <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2,position:"relative"}}>
            <div style={{fontSize:9,color:"rgba(255,255,255,0.6)",fontWeight:600,marginBottom:2}}>{d.value>0?fmtINR(d.value):""}</div>
            <div style={{width:"100%",height:h,borderRadius:"6px 6px 0 0",background:`linear-gradient(180deg,${color},${color}88)`,boxShadow:`0 0 12px ${color}44`,transition:"height 0.05s",minHeight:d.value>0?4:0}}/>
            <div style={{position:"absolute",bottom:0,fontSize:9,color:"rgba(255,255,255,0.5)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",maxWidth:"100%",textAlign:"center"}}>{d.label}</div>
          </div>
        );
      })}
    </div>
  );
}

/* ─────────────────────────────────────────────
   LINE CHART
───────────────────────────────────────────── */
function LineChart({ data, color="#14b8a6", height=120 }) {
  const [anim, setAnim] = useState(0);
  useEffect(()=>{
    let start=null,raf;
    function step(ts){
      if(!start) start=ts;
      const p=Math.min((ts-start)/900,1);
      setAnim(p<1?lerp(0,1,p*p*(3-2*p)):1);
      if(p<1) raf=requestAnimationFrame(step);
    }
    raf=requestAnimationFrame(step);
    return()=>cancelAnimationFrame(raf);
  },[data]);
  const w=420, h=height, pad=20;
  const max=Math.max(...data.map(d=>d.value),1);
  const pts=data.map((d,i)=>({
    x: pad+(i/(data.length-1||1))*(w-pad*2),
    y: h-pad-(d.value/max)*(h-pad*2)*anim
  }));
  const pathD=pts.map((p,i)=>i===0?`M${p.x},${p.y}`:`L${p.x},${p.y}`).join(" ");
  const areaD=pts.length>1?`${pathD} L${pts[pts.length-1].x},${h-pad} L${pts[0].x},${h-pad} Z`:"";
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} style={{overflow:"visible"}}>
      <defs>
        <linearGradient id="lg1" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35"/>
          <stop offset="100%" stopColor={color} stopOpacity="0"/>
        </linearGradient>
      </defs>
      {areaD && <path d={areaD} fill="url(#lg1)"/>}
      {pts.length>1 && <path d={pathD} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" style={{filter:`drop-shadow(0 0 6px ${color})`}}/>}
      {pts.map((p,i)=>(
        <g key={i}>
          <circle cx={p.x} cy={p.y} r={4} fill={color} stroke="rgba(255,255,255,0.3)" strokeWidth={2}/>
          <text x={p.x} y={h-2} textAnchor="middle" fill="rgba(255,255,255,0.45)" fontSize={9}>{data[i].label}</text>
        </g>
      ))}
    </svg>
  );
}

/* ─────────────────────────────────────────────
   ANIMATED RING (progress)
───────────────────────────────────────────── */
function Ring({ pct, size=90, stroke=8, color="#0ea5e9", label="", sublabel="" }) {
  const [anim, setAnim] = useState(0);
  useEffect(()=>{
    let start=null,raf;
    function step(ts){
      if(!start) start=ts;
      const p=Math.min((ts-start)/900,1);
      setAnim(p<1?lerp(0,1,p*p*(3-2*p)):1);
      if(p<1) raf=requestAnimationFrame(step);
    }
    raf=requestAnimationFrame(step);
    return()=>cancelAnimationFrame(raf);
  },[pct]);
  const r=(size-stroke*2)/2, circ=2*Math.PI*r, dash=circ*(pct/100)*anim;
  return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
      <svg width={size} height={size} style={{transform:"rotate(-90deg)"}}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke}/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          style={{filter:`drop-shadow(0 0 8px ${color})`,transition:"stroke-dasharray 0.05s"}}/>
      </svg>
      {label && <div style={{fontSize:16,fontWeight:800,color,marginTop:-size/2-8,zIndex:1,textAlign:"center",lineHeight:1}}>{label}</div>}
      {sublabel && <div style={{fontSize:10,color:"rgba(255,255,255,0.5)",marginTop:size/2-8}}>{sublabel}</div>}
    </div>
  );
}

/* ─────────────────────────────────────────────
   GLASS CARD
───────────────────────────────────────────── */
function GCard({ children, style={}, onClick, glow="" }) {
  return (
    <div onClick={onClick} style={{
      background:"rgba(255,255,255,0.05)",
      backdropFilter:"blur(16px)",
      WebkitBackdropFilter:"blur(16px)",
      border:"1px solid rgba(255,255,255,0.12)",
      borderRadius:20,
      padding:20,
      boxShadow: glow ? `0 8px 32px rgba(0,0,0,0.3), 0 0 20px ${glow}22` : "0 8px 32px rgba(0,0,0,0.3)",
      transition:"transform 0.2s, box-shadow 0.2s",
      cursor: onClick ? "pointer" : "default",
      ...style
    }}
    onMouseEnter={e=>{ if(onClick){ e.currentTarget.style.transform="translateY(-3px) scale(1.01)"; e.currentTarget.style.boxShadow=`0 16px 40px rgba(0,0,0,0.4)${glow?",0 0 30px "+glow+"44":""}`; }}}
    onMouseLeave={e=>{ if(onClick){ e.currentTarget.style.transform=""; e.currentTarget.style.boxShadow=glow?`0 8px 32px rgba(0,0,0,0.3),0 0 20px ${glow}22`:"0 8px 32px rgba(0,0,0,0.3)"; }}}
    >
      {children}
    </div>
  );
}

/* ─────────────────────────────────────────────
   MODAL
───────────────────────────────────────────── */
function Modal({ open, onClose, title, children }) {
  useEffect(()=>{
    if(open) document.body.style.overflow="hidden";
    else document.body.style.overflow="";
    return()=>{ document.body.style.overflow=""; };
  },[open]);
  if(!open) return null;
  return (
    <div style={{position:"fixed",inset:0,zIndex:2000,background:"rgba(0,0,0,0.7)",backdropFilter:"blur(8px)",display:"flex",alignItems:"center",justifyContent:"center",padding:16,animation:"fadeIn 0.2s"}}
      onClick={onClose}>
      <div style={{background:"linear-gradient(135deg,rgba(14,165,233,0.15),rgba(20,184,166,0.1))",backdropFilter:"blur(24px)",WebkitBackdropFilter:"blur(24px)",border:"1px solid rgba(255,255,255,0.18)",borderRadius:24,padding:28,minWidth:340,maxWidth:500,width:"100%",boxShadow:"0 32px 80px rgba(0,0,0,0.5)",maxHeight:"90vh",overflowY:"auto",animation:"slideUp 0.25s"}}
        onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
          <div style={{fontWeight:800,fontSize:20,color:"#fff"}}>{title}</div>
          <button onClick={onClose} style={{background:"rgba(255,255,255,0.1)",border:"1px solid rgba(255,255,255,0.2)",borderRadius:10,width:34,height:34,cursor:"pointer",color:"rgba(255,255,255,0.7)",fontSize:18,display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   TOAST NOTIFICATION
───────────────────────────────────────────── */
function Toast({ notification }) {
  if(!notification) return null;
  const colors = { success:"#10b981", error:"#f43f5e", info:"#0ea5e9", warning:"#f59e0b" };
  const c = colors[notification.type] || colors.success;
  return (
    <div style={{position:"fixed",top:24,right:24,zIndex:9998,background:`linear-gradient(135deg,${c}dd,${c}aa)`,backdropFilter:"blur(12px)",border:`1px solid ${c}55`,borderRadius:16,padding:"14px 20px",color:"#fff",fontWeight:700,fontSize:14,boxShadow:`0 8px 32px ${c}44`,display:"flex",alignItems:"center",gap:10,animation:"slideInRight 0.3s",minWidth:200}}>
      <span style={{fontSize:18}}>{notification.type==="success"?"✅":notification.type==="error"?"❌":notification.type==="warning"?"⚠️":"ℹ️"}</span>
      {notification.msg}
    </div>
  );
}

/* ─────────────────────────────────────────────
   FORM INPUTS (glass style)
───────────────────────────────────────────── */
function GInput({ label, ...props }) {
  return (
    <div style={{display:"flex",flexDirection:"column",gap:6}}>
      {label && <label style={{fontSize:12,fontWeight:600,color:"rgba(255,255,255,0.6)",textTransform:"uppercase",letterSpacing:0.5}}>{label}</label>}
      <input style={{width:"100%",padding:"11px 14px",borderRadius:12,border:"1px solid rgba(255,255,255,0.15)",background:"rgba(255,255,255,0.07)",color:"#fff",fontSize:14,outline:"none",backdropFilter:"blur(8px)",transition:"border 0.2s"}}
        onFocus={e=>e.target.style.borderColor="#0ea5e9"}
        onBlur={e=>e.target.style.borderColor="rgba(255,255,255,0.15)"}
        {...props}/>
    </div>
  );
}
function GSelect({ label, children, ...props }) {
  return (
    <div style={{display:"flex",flexDirection:"column",gap:6}}>
      {label && <label style={{fontSize:12,fontWeight:600,color:"rgba(255,255,255,0.6)",textTransform:"uppercase",letterSpacing:0.5}}>{label}</label>}
      <select style={{width:"100%",padding:"11px 14px",borderRadius:12,border:"1px solid rgba(255,255,255,0.15)",background:"rgba(15,23,42,0.8)",color:"#fff",fontSize:14,outline:"none",backdropFilter:"blur(8px)"}} {...props}>{children}</select>
    </div>
  );
}
function GBtn({ children, variant="primary", style={}, ...props }) {
  const base = {padding:"11px 22px",borderRadius:12,border:"none",cursor:"pointer",fontWeight:700,fontSize:14,transition:"all 0.2s",display:"inline-flex",alignItems:"center",gap:6};
  const variants = {
    primary:{background:"linear-gradient(135deg,#0ea5e9,#14b8a6)",color:"#fff",boxShadow:"0 4px 16px rgba(14,165,233,0.35)"},
    ghost:{background:"rgba(255,255,255,0.07)",color:"rgba(255,255,255,0.8)",border:"1px solid rgba(255,255,255,0.15)"},
    danger:{background:"linear-gradient(135deg,#f43f5e,#e11d48)",color:"#fff",boxShadow:"0 4px 16px rgba(244,63,94,0.35)"},
    success:{background:"linear-gradient(135deg,#10b981,#059669)",color:"#fff",boxShadow:"0 4px 16px rgba(16,185,129,0.35)"},
  };
  return <button style={{...base,...(variants[variant]||variants.primary),...style}}
    onMouseEnter={e=>{e.currentTarget.style.transform="scale(1.04)";e.currentTarget.style.filter="brightness(1.1)";}}
    onMouseLeave={e=>{e.currentTarget.style.transform="";e.currentTarget.style.filter="";}}
    {...props}>{children}</button>;
}

/* ─────────────────────────────────────────────
   SPENDING HEATMAP (calendar view)
───────────────────────────────────────────── */
function SpendingHeatmap({ expenses, year, month }) {
  const daysInMonth = new Date(year, month+1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const mk = `${year}-${String(month+1).padStart(2,"0")}`;
  const dayMap = {};
  expenses.filter(e=>e.date&&e.date.startsWith(mk)).forEach(e=>{
    const d = parseInt(e.date.split("-")[2]);
    dayMap[d] = (dayMap[d]||0)+Number(e.amount);
  });
  const max = Math.max(...Object.values(dayMap),1);
  const today = new Date();
  const days = [];
  for(let i=0;i<firstDay;i++) days.push(null);
  for(let d=1;d<=daysInMonth;d++) days.push(d);
  return (
    <div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3,marginBottom:6}}>
        {["Su","Mo","Tu","We","Th","Fr","Sa"].map(d=><div key={d} style={{fontSize:9,textAlign:"center",color:"rgba(255,255,255,0.35)",fontWeight:600}}>{d}</div>)}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3}}>
        {days.map((d,i)=>{
          if(!d) return <div key={"x"+i}/>;
          const amt = dayMap[d]||0;
          const intensity = amt/max;
          const isToday = today.getDate()===d && today.getMonth()===month && today.getFullYear()===year;
          return (
            <div key={d} title={amt>0?`Day ${d}: ${fmtINR(amt)}":""} style={{
              aspectRatio:"1",borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:600,
              background: amt>0 ? `rgba(14,165,233,${0.2+intensity*0.8})` : "rgba(255,255,255,0.04)",
              color: amt>0 ? "#fff" : "rgba(255,255,255,0.3)",
              border: isToday ? "2px solid #0ea5e9" : "1px solid transparent",
              boxShadow: amt>0 ? `0 0 8px rgba(14,165,233,${intensity*0.5})` : "none",
              cursor:"default",transition:"transform 0.15s",
            }}
            onMouseEnter={e=>{ if(amt>0)e.currentTarget.style.transform="scale(1.15)"; }}
            onMouseLeave={e=>e.currentTarget.style.transform=""}
            >{d}</div>
          );
        })}
      </div>
      <div style={{display:"flex",alignItems:"center",gap:6,marginTop:10,fontSize:10,color:"rgba(255,255,255,0.4)"}}>
        <span>Less</span>
        {[0.1,0.3,0.5,0.7,0.9].map(v=>(
          <div key={v} style={{width:14,height:14,borderRadius:4,background:`rgba(14,165,233,${v})`}}/>
        ))}
        <span>More</span>
      </div>
    </div>
  );
}
/* ─────────────────────────────────────────────
   SPENDING FORECAST
───────────────────────────────────────────── */
function SpendingForecast({ expenses, income, activeMonth, activeYear }) {
  const today = new Date();
  const daysInMonth = new Date(activeYear, activeMonth+1, 0).getDate();
  const mk = `${activeYear}-${String(activeMonth+1).padStart(2,"0")}`;
  const monthExp = expenses.filter(e=>e.date&&e.date.startsWith(mk));
  const totalSoFar = monthExp.reduce((a,e)=>a+Number(e.amount),0);
  const dayOfMonth = today.getMonth()===activeMonth&&today.getFullYear()===activeYear ? today.getDate() : daysInMonth;
  const dailyAvg = dayOfMonth > 0 ? totalSoFar/dayOfMonth : 0;
  const projected = dailyAvg * daysInMonth;
  const daysLeft = Math.max(0, daysInMonth - dayOfMonth);
  const budgetLeft = income - totalSoFar;
  const safeDaily = daysLeft > 0 ? budgetLeft/daysLeft : 0;
  // Build 6-month trend for forecast line
  const histData = Array.from({length:5},(_,i)=>{
    const d = new Date(activeYear, activeMonth-4+i, 1);
    const m = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
    return { label:SHORT_MONTHS[d.getMonth()], value:expenses.filter(e=>e.date&&e.date.startsWith(m)).reduce((a,e)=>a+Number(e.amount),0) };
  });
  histData.push({ label: SHORT_MONTHS[activeMonth]+"*", value: Math.round(projected) });
  const overBudget = projected > income;
  const pctUsed = income > 0 ? (totalSoFar/income)*100 : 0;
  return (
    <div style={{display:"flex",flexDirection:"column",gap:18}}>
      <div style={{fontWeight:800,fontSize:18,color:"#fff"}}>📈 Spending Forecast</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        {[
          {label:"Spent So Far",value:fmtINR(totalSoFar),color:"#f59e0b",icon:"💸"},
          {label:"Projected Total",value:fmtINR(Math.round(projected)),color:overBudget?"#f43f5e":"#10b981",icon:"🔮"},
          {label:"Daily Average",value:fmtINR(Math.round(dailyAvg)),color:"#0ea5e9",icon:"📅"},
          {label:"Safe Daily Spend",value:fmtINR(Math.round(safeDaily)),color:"#8b5cf6",icon:"🛡️"},
        ].map((s,i)=>(
          <div key={i} style={{background:`rgba(255,255,255,0.05)`,borderRadius:14,padding:"12px 14px",border:`1px solid ${s.color}33`}}>
            <div style={{fontSize:18,marginBottom:4}}>{s.icon}</div>
            <div style={{fontSize:11,color:"rgba(255,255,255,0.5)",marginBottom:2}}>{s.label}</div>
            <div style={{fontSize:18,fontWeight:800,color:s.color}}>{s.value}</div>
          </div>
        ))}
      </div>
      <div>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:6,color:"rgba(255,255,255,0.7)"}}>
          <span>Budget Used: {pctUsed.toFixed(1)}%</span>
          <span style={{color:overBudget?"#f43f5e":"#10b981"}}>{overBudget?"⚠️ Over budget":"✅ On track"}</span>
        </div>
        <div style={{height:10,borderRadius:99,background:"rgba(255,255,255,0.08)",overflow:"hidden"}}>
          <div style={{height:"100%",borderRadius:99,width:`${Math.min(pctUsed,100)}%`,background:overBudget?"linear-gradient(90deg,#f59e0b,#f43f5e)":"linear-gradient(90deg,#0ea5e9,#14b8a6)",transition:"width 0.8s",boxShadow:overBudget?"0 0 12px #f43f5e88":"0 0 12px #0ea5e988"}}/>
        </div>
      </div>
      <div>
        <div style={{fontSize:13,fontWeight:700,color:"rgba(255,255,255,0.7)",marginBottom:8}}>6-Month Trend + Forecast</div>
        <LineChart data={histData} color={overBudget?"#f43f5e":"#14b8a6"} height={100}/>
      </div>
      <div style={{padding:"12px 16px",borderRadius:14,background:overBudget?"rgba(244,63,94,0.12)":"rgba(16,185,129,0.12)",border:`1px solid ${overBudget?"#f43f5e":"#10b981"}33`,fontSize:13,color:"rgba(255,255,255,0.85)",lineHeight:1.6}}>
        {overBudget
          ? `⚠️ At this rate, you'll spend ${fmtINR(Math.round(projected-income))} over budget. Reduce daily spending to ${fmtINR(Math.round(safeDaily))} for the rest of the month.`
          : `✅ You're on track! Projected to save ${fmtINR(Math.round(income-projected))} this month. Keep it up!`}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   SIDEBAR NAV
───────────────────────────────────────────── */
const NAV_ITEMS = [
  {id:"dashboard",icon:"📊",label:"Dashboard"},
  {id:"forecast",icon:"🔮",label:"Forecast"},
  {id:"insights",icon:"💡",label:"Insights"},
  {id:"history",icon:"📋",label:"History"},
  {id:"goals",icon:"🎯",label:"Goals"},
  {id:"loans",icon:"🏦",label:"Loans"},
  {id:"challenges",icon:"🏆",label:"Challenges"},
  {id:"invest",icon:"📈",label:"Invest"},
  {id:"ai",icon:"🤖",label:"AI Advisor"},
];

function Sidebar({ tab, setTab, income, totalSpent, balance }) {
  const [collapsed, setCollapsed] = useState(false);
  const savingsPct = income > 0 ? Math.max(0, Math.round((balance/income)*100)) : 0;
  return (
    <div style={{
      width:collapsed?68:220,height:"100vh",position:"sticky",top:0,display:"flex",flexDirection:"column",
      background:"rgba(255,255,255,0.03)",backdropFilter:"blur(20px)",WebkitBackdropFilter:"blur(20px)",
      borderRight:"1px solid rgba(255,255,255,0.08)",transition:"width 0.3s",flexShrink:0,zIndex:100,overflowY:"auto"
    }}>
      {/* Logo */}
      <div style={{padding:collapsed?"16px 0":"20px 20px 12px",display:"flex",alignItems:"center",justifyContent:collapsed?"center":"space-between",gap:10,borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
        {!collapsed && (
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:36,height:36,borderRadius:12,background:"linear-gradient(135deg,#0ea5e9,#14b8a6)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,fontSize:18,color:"#fff",boxShadow:"0 4px 16px rgba(14,165,233,0.4)"}}>V</div>
            <div>
              <div style={{fontWeight:900,fontSize:18,color:"#fff",letterSpacing:-0.5}}>Vatsu</div>
              <div style={{fontSize:10,color:"rgba(255,255,255,0.4)"}}>Finance Hub</div>
            </div>
          </div>
        )}
        {collapsed && <div style={{width:36,height:36,borderRadius:12,background:"linear-gradient(135deg,#0ea5e9,#14b8a6)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,fontSize:18,color:"#fff"}}>V</div>}
        <button onClick={()=>setCollapsed(c=>!c)} style={{background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:8,width:28,height:28,cursor:"pointer",color:"rgba(255,255,255,0.6)",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
          {collapsed?"›":"‹"}
        </button>
      </div>

      {/* Quick stats (only when expanded) */}
      {!collapsed && (
        <div style={{padding:"12px 14px",borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
          <div style={{fontSize:10,color:"rgba(255,255,255,0.4)",fontWeight:600,marginBottom:8,textTransform:"uppercase",letterSpacing:0.5}}>This Month</div>
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {[
              {l:"Income",v:fmtINR(income),c:"#0ea5e9"},
              {l:"Spent",v:fmtINR(totalSpent),c:"#f43f5e"},
              {l:"Saved",v:savingsPct+"%",c:"#10b981"},
            ].map((s,i)=>(
              <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{fontSize:11,color:"rgba(255,255,255,0.5)"}}>{s.l}</span>
                <span style={{fontSize:12,fontWeight:700,color:s.c}}>{s.v}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Nav items */}
      <nav style={{flex:1,padding:"10px 8px",display:"flex",flexDirection:"column",gap:2}}>
        {NAV_ITEMS.map(item=>(
          <button key={item.id} onClick={()=>setTab(item.id)} style={{
            display:"flex",alignItems:"center",gap:10,padding:collapsed?"10px":"10px 12px",
            borderRadius:12,border:"none",cursor:"pointer",textAlign:"left",
            background: tab===item.id ? "linear-gradient(135deg,rgba(14,165,233,0.25),rgba(20,184,166,0.2))" : "transparent",
            color: tab===item.id ? "#fff" : "rgba(255,255,255,0.55)",
            fontWeight: tab===item.id ? 700 : 500,
            fontSize:13,transition:"all 0.2s",
            boxShadow: tab===item.id ? "inset 0 0 0 1px rgba(14,165,233,0.35)" : "none",
            justifyContent:collapsed?"center":"flex-start",
          }}
          onMouseEnter={e=>{ if(tab!==item.id){ e.currentTarget.style.background="rgba(255,255,255,0.07)"; e.currentTarget.style.color="#fff"; }}}
          onMouseLeave={e=>{ if(tab!==item.id){ e.currentTarget.style.background="transparent"; e.currentTarget.style.color="rgba(255,255,255,0.55)"; }}}
          >
            <span style={{fontSize:18,flexShrink:0}}>{item.icon}</span>
            {!collapsed && <span>{item.label}</span>}
            {!collapsed && tab===item.id && <div style={{marginLeft:"auto",width:6,height:6,borderRadius:99,background:"#0ea5e9",boxShadow:"0 0 8px #0ea5e9"}}/>}
          </button>
        ))}
      </nav>
    </div>
  );
}

/* ─────────────────────────────────────────────
   MAIN APP
───────────────────────────────────────────── */
export default function Vatsu() {
  const [tab, setTab] = useState("dashboard");
  const [theme, setTheme] = useLocalStorage("vatsu_theme","dark");
  const [expenses, setExpenses] = useLocalStorage("vatsu_expenses",[]);
  const [income, setIncome] = useLocalStorage("vatsu_income",50000);
  const [goals, setGoals] = useLocalStorage("vatsu_goals",[]);
  const [loans, setLoans] = useLocalStorage("vatsu_loans",[]);
  const [challenges, setChallenges] = useLocalStorage("vatsu_challenges",[]);
  const [recurringList, setRecurringList] = useLocalStorage("vatsu_recurring",[]);
  const [customCats, setCustomCats] = useLocalStorage("vatsu_customcats",[]);
  const [activeMonth, setActiveMonth] = useLocalStorage("vatsu_month",new Date().getMonth());
  const [activeYear, setActiveYear] = useLocalStorage("vatsu_year",new Date().getFullYear());
  const [confetti, setConfetti] = useState(false);
  const [notification, setNotification] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showIncome, setShowIncome] = useState(false);
  const [showRecurring, setShowRecurring] = useState(false);
  const [showCustomCat, setShowCustomCat] = useState(false);
  const [editExpense, setEditExpense] = useState(null);

  const allCats = useMemo(()=>[...CATEGORIES,...customCats],[customCats]);

  const notify = useCallback((msg, type="success")=>{
    setNotification({msg,type});
    setTimeout(()=>setNotification(null),3500);
  },[]);

  const celebrate = useCallback(()=>{
    setConfetti(true);
    setTimeout(()=>setConfetti(false),4500);
  },[]);

  const mk = `${activeYear}-${String(Number(activeMonth)+1).padStart(2,"0")}`;
  const monthExpenses = useMemo(()=>expenses.filter(e=>e.date&&e.date.startsWith(mk)),[expenses,mk]);
  const totalSpent = useMemo(()=>monthExpenses.reduce((a,e)=>a+Number(e.amount),0),[monthExpenses]);
  const balance = income - totalSpent;
  const savingsRate = income > 0 ? Math.max(0,((balance/income)*100)) : 0;

  const catTotals = useMemo(()=>allCats.map((cat,i)=>({
    cat, color:PALETTE[i%PALETTE.length],
    total:monthExpenses.filter(e=>e.category===cat).reduce((a,e)=>a+Number(e.amount),0)
  })).filter(c=>c.total>0),[allCats,monthExpenses]);

  function addExpense(data) {
    if(editExpense){
      setExpenses(expenses.map(e=>e.id===editExpense.id?{...e,...data}:e));
      notify("Expense updated! ✏️");
    } else {
      setExpenses([{id:Date.now(),...data},...expenses]);
      notify("Expense added! 💸");
    }
    setEditExpense(null); setShowAdd(false);
  }
  function deleteExpense(id){ setExpenses(expenses.filter(e=>e.id!==id)); notify("Expense deleted","error"); }
  function applyRecurring(){
    const toAdd=recurringList.map(r=>({id:Date.now()+Math.random(),desc:r.desc,amount:r.amount,category:r.category,date:`${activeYear}-${String(Number(activeMonth)+1).padStart(2,"0")}-01`,note:"Recurring"}));
    setExpenses([...toAdd,...expenses]);
    notify(`Added ${toAdd.length} recurring expenses! 🔁`);
  }

  const bgStyle = {
    minHeight:"100vh",display:"flex",
    background:"linear-gradient(135deg,#0c1220 0%,#0f1e2e 30%,#0a1628 60%,#071220 100%)",
    color:"#fff",fontFamily:"'Inter',system-ui,sans-serif",position:"relative",overflow:"hidden"
  };

  return (
    <div style={bgStyle}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        ::-webkit-scrollbar{width:6px;height:6px;}
        ::-webkit-scrollbar-track{background:rgba(255,255,255,0.03);}
        ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.15);border-radius:99px;}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        @keyframes slideUp{from{opacity:0;transform:translateY(30px)}to{opacity:1;transform:translateY(0)}}
        @keyframes slideInRight{from{opacity:0;transform:translateX(40px)}to{opacity:1;transform:translateX(0)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.6}}
        @keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
        @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
        .vatsu-main{flex:1;overflow-y:auto;max-height:100vh;}
        .vatsu-content{max-width:1100px;margin:0 auto;padding:24px;}
        .grid2{display:grid;grid-template-columns:1fr 1fr;gap:16px;}
        .grid3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;}
        .grid4{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;}
        @media(max-width:900px){.grid3{grid-template-columns:1fr 1fr;}.grid4{grid-template-columns:1fr 1fr;}}
        @media(max-width:600px){.grid2,.grid3,.grid4{grid-template-columns:1fr;}}
        .expense-row{display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.06);transition:background 0.15s;border-radius:8px;}
        .expense-row:hover{background:rgba(255,255,255,0.03);padding-left:8px;}
        .expense-row:last-child{border-bottom:none;}
        input[type="range"]{-webkit-appearance:none;width:100%;height:6px;border-radius:99px;background:rgba(255,255,255,0.12);outline:none;}
        input[type="range"]::-webkit-slider-thumb{-webkit-appearance:none;width:18px;height:18px;border-radius:99px;background:linear-gradient(135deg,#0ea5e9,#14b8a6);cursor:pointer;box-shadow:0 0 8px rgba(14,165,233,0.6);}
        select option{background:#0f1e2e;color:#fff;}
      `}</style>

      {/* Ambient background orbs */}
      <div style={{position:"fixed",inset:0,zIndex:0,pointerEvents:"none",overflow:"hidden"}}>
        <div style={{position:"absolute",width:600,height:600,borderRadius:"50%",background:"radial-gradient(circle,rgba(14,165,233,0.08),transparent 70%)",top:-200,left:-200,animation:"float 8s ease-in-out infinite"}}/>
        <div style={{position:"absolute",width:500,height:500,borderRadius:"50%",background:"radial-gradient(circle,rgba(20,184,166,0.07),transparent 70%)",bottom:-150,right:-150,animation:"float 10s ease-in-out infinite reverse"}}/>
        <div style={{position:"absolute",width:300,height:300,borderRadius:"50%",background:"radial-gradient(circle,rgba(99,102,241,0.06),transparent 70%)",top:"40%",left:"50%",animation:"float 12s ease-in-out infinite"}}/>
      </div>

      <Confetti active={confetti}/>
      <Toast notification={notification}/>

      {/* Sidebar */}
      <div style={{position:"relative",zIndex:10}}>
        <Sidebar tab={tab} setTab={setTab} income={income} totalSpent={totalSpent} balance={balance}/>
      </div>

      {/* Main content */}
      <div className="vatsu-main" style={{position:"relative",zIndex:1}}>
        {/* Top header bar */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"16px 24px",borderBottom:"1px solid rgba(255,255,255,0.06)",background:"rgba(255,255,255,0.02)",backdropFilter:"blur(8px)",position:"sticky",top:0,zIndex:50}}>
          <div style={{fontWeight:800,fontSize:22,color:"#fff"}}>
            {NAV_ITEMS.find(n=>n.id===tab)?.icon} {NAV_ITEMS.find(n=>n.id===tab)?.label}
          </div>
          <div style={{display:"flex",gap:10,alignItems:"center"}}>
            <select style={{background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.15)",borderRadius:10,padding:"6px 12px",color:"#fff",fontSize:13,outline:"none"}} value={activeMonth} onChange={e=>setActiveMonth(Number(e.target.value))}>
              {MONTHS.map((m,i)=><option key={i} value={i}>{SHORT_MONTHS[i]}</option>)}
            </select>
            <select style={{background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.15)",borderRadius:10,padding:"6px 12px",color:"#fff",fontSize:13,outline:"none"}} value={activeYear} onChange={e=>setActiveYear(Number(e.target.value))}>
              {[2023,2024,2025,2026,2027].map(y=><option key={y} value={y}>{y}</option>)}
            </select>
            <button onClick={()=>setShowAdd(true)} style={{background:"linear-gradient(135deg,#0ea5e9,#14b8a6)",border:"none",borderRadius:10,padding:"8px 16px",color:"#fff",fontWeight:700,fontSize:13,cursor:"pointer",boxShadow:"0 4px 12px rgba(14,165,233,0.35)"}}>+ Add Expense</button>
          </div>
        </div>

        <div className="vatsu-content">
          {tab==="dashboard" && <DashTab income={income} totalSpent={totalSpent} balance={balance} savingsRate={savingsRate} monthExpenses={monthExpenses} catTotals={catTotals} allCats={allCats} activeMonth={activeMonth} activeYear={activeYear} onEdit={e=>{setEditExpense(e);setShowAdd(true);}} onDelete={deleteExpense} onSetIncome={()=>setShowIncome(true)} onApplyRecurring={applyRecurring} onAddRecurring={()=>setShowRecurring(true)} onCustomCat={()=>setShowCustomCat(true)} expenses={expenses}/>}
          {tab==="forecast" && <SpendingForecast expenses={expenses} income={income} activeMonth={activeMonth} activeYear={activeYear}/>}
          {tab==="insights" && <InsightsTab expenses={expenses} income={income} activeMonth={activeMonth} activeYear={activeYear} allCats={allCats}/>}
          {tab==="history" && <HistoryTab expenses={expenses} allCats={allCats} onDelete={deleteExpense} onEdit={e=>{setEditExpense(e);setShowAdd(true);}}/>}
          {tab==="goals" && <GoalsTab goals={goals} setGoals={setGoals} notify={notify} celebrate={celebrate}/>}
          {tab==="loans" && <LoansTab loans={loans} setLoans={setLoans} notify={notify}/>}
          {tab==="challenges" && <ChallengesTab challenges={challenges} setChallenges={setChallenges} notify={notify} celebrate={celebrate}/>}
          {tab==="invest" && <InvestTab income={income} totalSpent={totalSpent}/>}
          {tab==="ai" && <AITab income={income} expenses={expenses} goals={goals} loans={loans} activeMonth={activeMonth} activeYear={activeYear} allCats={allCats}/>}
        </div>
      </div>

      <Modal open={showAdd} onClose={()=>{setShowAdd(false);setEditExpense(null);}} title={editExpense?"✏️ Edit Expense":"💸 Add Expense"}>
        <AddExpenseForm allCats={allCats} onSubmit={addExpense} initial={editExpense} activeMonth={activeMonth} activeYear={activeYear}/>
      </Modal>
      <Modal open={showIncome} onClose={()=>setShowIncome(false)} title="💰 Set Monthly Income">
        <IncomeForm income={income} onSubmit={v=>{setIncome(v);setShowIncome(false);notify("Income updated! 💰");}}/>
      </Modal>
      <Modal open={showRecurring} onClose={()=>setShowRecurring(false)} title="🔁 Recurring Expenses">
        <RecurringForm recurringList={recurringList} setRecurringList={setRecurringList} allCats={allCats}/>
      </Modal>
      <Modal open={showCustomCat} onClose={()=>setShowCustomCat(false)} title="⚙️ Custom Categories">
        <CustomCatForm customCats={customCats} setCustomCats={setCustomCats}/>
      </Modal>
    </div>
  );
}

/* ─────────────────────────────────────────────
   DASHBOARD TAB
───────────────────────────────────────────── */
function DashTab({ income, totalSpent, balance, savingsRate, monthExpenses, catTotals, allCats, activeMonth, activeYear, onEdit, onDelete, onSetIncome, onApplyRecurring, onAddRecurring, onCustomCat, expenses }) {
  const pctUsed = income > 0 ? Math.min((totalSpent/income)*100, 100) : 0;
  const healthColor = savingsRate>30?"#10b981":savingsRate>10?"#f59e0b":"#f43f5e";

  return (
    <div style={{display:"flex",flexDirection:"column",gap:20,animation:"slideUp 0.4s"}}>
      {/* Quick action bar */}
      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
        <GBtn variant="ghost" onClick={onSetIncome} style={{fontSize:12,padding:"8px 14px"}}>💰 Set Income</GBtn>
        <GBtn variant="ghost" onClick={onAddRecurring} style={{fontSize:12,padding:"8px 14px"}}>🔁 Recurring</GBtn>
        <GBtn variant="ghost" onClick={onApplyRecurring} style={{fontSize:12,padding:"8px 14px"}}>⚡ Apply Recurring</GBtn>
        <GBtn variant="ghost" onClick={onCustomCat} style={{fontSize:12,padding:"8px 14px"}}>⚙️ Categories</GBtn>
      </div>

      {/* Stat cards */}
      <div className="grid4">
        {[
          {label:"Monthly Income",value:fmtINR(income),color:"#0ea5e9",icon:"💰",sub:"Set limit",glow:"#0ea5e9"},
          {label:"Total Spent",value:fmtINR(totalSpent),color:"#f43f5e",icon:"💸",sub:`${pctUsed.toFixed(0)}% of income`,glow:"#f43f5e"},
          {label:"Balance",value:fmtINR(balance),color:balance>=0?"#10b981":"#f43f5e",icon:"💳",sub:balance>=0?"Surplus":"Deficit",glow:balance>=0?"#10b981":"#f43f5e"},
          {label:"Savings Rate",value:savingsRate.toFixed(1)+"%",color:healthColor,icon:"📊",sub:savingsRate>20?"Great!":"Needs work",glow:healthColor},
        ].map((s,i)=>(
          <GCard key={i} glow={s.glow} style={{animation:`slideUp ${0.1+i*0.08}s`}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
              <div style={{fontSize:28}}>{s.icon}</div>
              <div style={{width:8,height:8,borderRadius:99,background:s.color,boxShadow:`0 0 8px ${s.color}`,animation:"pulse 2s infinite"}}/>
            </div>
            <div style={{fontSize:11,color:"rgba(255,255,255,0.45)",textTransform:"uppercase",letterSpacing:0.5,marginBottom:4}}>{s.label}</div>
            <div style={{fontSize:24,fontWeight:900,color:s.color,lineHeight:1.1}}>{s.value}</div>
            <div style={{fontSize:11,color:"rgba(255,255,255,0.4)",marginTop:4}}>{s.sub}</div>
          </GCard>
        ))}
      </div>

      {/* Budget progress */}
      <GCard>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
          <div style={{fontWeight:700,fontSize:16,color:"#fff"}}>💳 Budget Overview</div>
          <div style={{fontSize:13,color:"rgba(255,255,255,0.5)"}}>{MONTHS[activeMonth]} {activeYear}</div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:20}}>
          <Ring pct={pctUsed} size={90} stroke={10} color={pctUsed>90?"#f43f5e":pctUsed>70?"#f59e0b":"#0ea5e9"} label={pctUsed.toFixed(0)+"%"} sublabel="used"/>
          <div style={{flex:1}}>
            <div style={{height:12,borderRadius:99,background:"rgba(255,255,255,0.08)",overflow:"hidden",marginBottom:10}}>
              <div style={{height:"100%",borderRadius:99,width:`${pctUsed}%`,background:pctUsed>90?"linear-gradient(90deg,#f59e0b,#f43f5e)":"linear-gradient(90deg,#0ea5e9,#14b8a6)",transition:"width 1s",boxShadow:pctUsed>90?"0 0 16px #f43f5e88":"0 0 16px #0ea5e988"}}/>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
              {[{l:"Spent",v:fmtINR(totalSpent),c:"#f43f5e"},{l:"Budget",v:fmtINR(income),c:"#0ea5e9"},{l:"Remaining",v:fmtINR(Math.max(0,balance)),c:"#10b981"}].map((s,i)=>(
                <div key={i} style={{textAlign:"center",padding:"8px",background:"rgba(255,255,255,0.04)",borderRadius:10}}>
                  <div style={{fontSize:10,color:"rgba(255,255,255,0.4)"}}>{s.l}</div>
                  <div style={{fontSize:14,fontWeight:700,color:s.c,marginTop:2}}>{s.v}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </GCard>

      {/* Charts row */}
      <div className="grid2">
        <GCard>
          <div style={{fontWeight:700,fontSize:15,color:"#fff",marginBottom:14}}>🍩 Spending Breakdown</div>
          <div style={{display:"flex",alignItems:"center",gap:16}}>
            <AnimDonut segments={catTotals.map(c=>({value:c.total,color:c.color}))} label={catTotals.length>0?fmtINR(totalSpent):"₹0"}/>
            <div style={{flex:1,display:"flex",flexDirection:"column",gap:7,maxHeight:160,overflowY:"auto"}}>
              {catTotals.map((c,i)=>(
                <div key={i} style={{display:"flex",alignItems:"center",gap:8,fontSize:12}}>
                  <div style={{width:8,height:8,borderRadius:99,background:c.color,boxShadow:`0 0 6px ${c.color}`,flexShrink:0}}/>
                  <span style={{flex:1,color:"rgba(255,255,255,0.6)"}}>{c.cat}</span>
                  <span style={{fontWeight:700,color:"#fff"}}>{fmtINR(c.total)}</span>
                </div>
              ))}
              {catTotals.length===0 && <div style={{color:"rgba(255,255,255,0.3)",fontSize:13}}>No expenses yet</div>}
            </div>
          </div>
        </GCard>

        <GCard>
          <div style={{fontWeight:700,fontSize:15,color:"#fff",marginBottom:14}}>📊 Category Bars</div>
          <BarChart data={catTotals.slice(0,6).map(c=>({label:c.cat,value:c.total,color:c.color}))} color="#0ea5e9" height={150}/>
        </GCard>
      </div>

      {/* Spending heatmap */}
      <GCard>
        <div style={{fontWeight:700,fontSize:15,color:"#fff",marginBottom:14}}>🗓️ Daily Spending Heatmap</div>
        <SpendingHeatmap expenses={expenses} year={activeYear} month={activeMonth}/>
      </GCard>

      {/* Recent expenses */}
      <GCard>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
          <div style={{fontWeight:700,fontSize:15,color:"#fff"}}>💳 Recent Expenses</div>
          <div style={{fontSize:12,color:"rgba(255,255,255,0.4)"}}>{monthExpenses.length} transactions</div>
        </div>
        {monthExpenses.length===0 && <div style={{textAlign:"center",color:"rgba(255,255,255,0.3)",padding:"28px 0",fontSize:14}}>🌟 No expenses this month yet!</div>}
        {monthExpenses.slice(0,8).map(e=>{
          const ci=allCats.indexOf(e.category);
          const col=PALETTE[ci%PALETTE.length];
          return (
            <div key={e.id} className="expense-row">
              <div style={{width:40,height:40,borderRadius:12,background:`${col}22`,border:`1px solid ${col}44`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>
                {CAT_ICONS[e.category]||"💸"}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:600,fontSize:14,color:"#fff",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{e.desc}</div>
                <div style={{fontSize:11,color:"rgba(255,255,255,0.4)",marginTop:2}}>{e.category} • {e.date}</div>
              </div>
              <div style={{fontWeight:800,color:"#f43f5e",fontSize:15,flexShrink:0}}>{fmtINR(e.amount)}</div>
              <button onClick={()=>onEdit(e)} style={{background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:8,width:30,height:30,cursor:"pointer",color:"rgba(255,255,255,0.6)",fontSize:14,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>✏️</button>
              <button onClick={()=>onDelete(e.id)} style={{background:"rgba(244,63,94,0.12)",border:"1px solid rgba(244,63,94,0.25)",borderRadius:8,width:30,height:30,cursor:"pointer",color:"#f43f5e",fontSize:14,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>🗑️</button>
            </div>
          );
        })}
      </GCard>
    </div>
  );
}

/* ─────────────────────────────────────────────
   INSIGHTS TAB
───────────────────────────────────────────── */
function InsightsTab({ expenses, income, activeMonth, activeYear, allCats }) {
  const mk = `${activeYear}-${String(Number(activeMonth)+1).padStart(2,"0")}`;
  const currExp = expenses.filter(e=>e.date&&e.date.startsWith(mk));
  const totalSpent = currExp.reduce((a,e)=>a+Number(e.amount),0);
  const savingsRate = income>0?Math.max(0,((income-totalSpent)/income)*100):0;
  const healthScore = Math.min(100,Math.round(savingsRate*1.1+(totalSpent<income?15:0)+(income>0?5:0)));

  // 6-month bar chart
  const months6 = Array.from({length:6},(_,i)=>{
    const d=new Date(activeYear,activeMonth-5+i,1);
    const m=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
    return { label:SHORT_MONTHS[d.getMonth()], value:expenses.filter(e=>e.date&&e.date.startsWith(m)).reduce((a,e)=>a+Number(e.amount),0), color:"#0ea5e9" };
  });

  // Category breakdown
  const catBreakdown = allCats.map((cat,i)=>({
    cat, color:PALETTE[i%PALETTE.length],
    total:currExp.filter(e=>e.category===cat).reduce((a,e)=>a+Number(e.amount),0)
  })).filter(c=>c.total>0).sort((a,b)=>b.total-a.total);

  const healthColor = healthScore>70?"#10b981":healthScore>40?"#f59e0b":"#f43f5e";

  // Week-over-week analysis
  const thisWeek = currExp.filter(e=>{
    const d=new Date(e.date); const now=new Date();
    const diff=(now-d)/(1000*60*60*24);
    return diff>=0&&diff<7;
  }).reduce((a,e)=>a+Number(e.amount),0);
  const lastWeek = currExp.filter(e=>{
    const d=new Date(e.date); const now=new Date();
    const diff=(now-d)/(1000*60*60*24);
    return diff>=7&&diff<14;
  }).reduce((a,e)=>a+Number(e.amount),0);
  const weekDiff = lastWeek>0?((thisWeek-lastWeek)/lastWeek)*100:0;

  return (
    <div style={{display:"flex",flexDirection:"column",gap:20,animation:"slideUp 0.4s"}}>
      {/* Health + metrics */}
      <div className="grid2">
        <GCard glow={healthColor}>
          <div style={{fontWeight:700,fontSize:15,color:"#fff",marginBottom:16}}>🏥 Financial Health Score</div>
          <div style={{display:"flex",alignItems:"center",gap:24}}>
            <Ring pct={healthScore} size={100} stroke={10} color={healthColor} label={healthScore} sublabel="/ 100"/>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              <div style={{fontSize:22,fontWeight:900,color:healthColor}}>{healthScore>70?"Excellent 🌟":healthScore>40?"Good 👍":"Needs Work ⚠️"}</div>
              <div style={{fontSize:13,color:"rgba(255,255,255,0.5)"}}>Based on savings rate,<br/>budget adherence & more</div>
              {[{l:"Savings Rate",v:savingsRate.toFixed(1)+"%",c:savingsRate>20?"#10b981":"#f59e0b"},{l:"Budget Used",v:(income>0?(totalSpent/income*100):0).toFixed(1)+"%",c:totalSpent>income?"#f43f5e":"#0ea5e9"}].map((s,i)=>(
                <div key={i} style={{display:"flex",gap:8,alignItems:"center"}}>
                  <div style={{width:8,height:8,borderRadius:99,background:s.c,boxShadow:`0 0 6px ${s.c}`}}/>
                  <span style={{fontSize:12,color:"rgba(255,255,255,0.6)"}}>{s.l}:</span>
                  <span style={{fontSize:13,fontWeight:700,color:s.c}}>{s.v}</span>
                </div>
              ))}
            </div>
          </div>
        </GCard>

        <GCard>
          <div style={{fontWeight:700,fontSize:15,color:"#fff",marginBottom:16}}>📅 Week-over-Week</div>
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            {[
              {l:"This Week",v:fmtINR(thisWeek),c:"#0ea5e9"},
              {l:"Last Week",v:fmtINR(lastWeek),c:"rgba(255,255,255,0.5)"},
              {l:"Change",v:(weekDiff>0?"+":"")+weekDiff.toFixed(1)+"%",c:weekDiff>10?"#f43f5e":weekDiff<-10?"#10b981":"#f59e0b"},
            ].map((s,i)=>(
              <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 12px",background:"rgba(255,255,255,0.04)",borderRadius:10}}>
                <span style={{fontSize:13,color:"rgba(255,255,255,0.55)"}}>{s.l}</span>
                <span style={{fontSize:15,fontWeight:700,color:s.c}}>{s.v}</span>
              </div>
            ))}
            <div style={{padding:"10px 14px",borderRadius:12,background:weekDiff>10?"rgba(244,63,94,0.12)":weekDiff<-10?"rgba(16,185,129,0.12)":"rgba(245,158,11,0.12)",fontSize:13,color:"rgba(255,255,255,0.8)",lineHeight:1.5}}>
              {weekDiff>10?"📈 Spending up this week. Review recent transactions.":weekDiff<-10?"📉 Great! You're spending less than last week.":"📊 Spending is stable compared to last week."}
            </div>
          </div>
        </GCard>
      </div>

      {/* 6-month chart */}
      <GCard>
        <div style={{fontWeight:700,fontSize:15,color:"#fff",marginBottom:14}}>📊 6-Month Spending Trend</div>
        <BarChart data={months6} color="#0ea5e9" height={160}/>
      </GCard>

      {/* Category analysis */}
      <GCard>
        <div style={{fontWeight:700,fontSize:15,color:"#fff",marginBottom:16}}>🎨 Category Deep Dive</div>
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          {catBreakdown.map((c,i)=>{
            const pct = income>0?(c.total/income)*100:0;
            return (
              <div key={i}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontSize:18}}>{CAT_ICONS[c.cat]||"💸"}</span>
                    <span style={{fontSize:14,fontWeight:600,color:"#fff"}}>{c.cat}</span>
                  </div>
                  <div style={{display:"flex",gap:12,alignItems:"center"}}>
                    <span style={{fontSize:12,color:"rgba(255,255,255,0.4)"}}>{pct.toFixed(1)}% of income</span>
                    <span style={{fontSize:15,fontWeight:700,color:c.color}}>{fmtINR(c.total)}</span>
                  </div>
                </div>
                <div style={{height:7,borderRadius:99,background:"rgba(255,255,255,0.06)",overflow:"hidden"}}>
                  <div style={{height:"100%",borderRadius:99,width:`${Math.min(pct,100)}%`,background:`linear-gradient(90deg,${c.color},${c.color}88)`,boxShadow:`0 0 8px ${c.color}55`,transition:"width 0.8s"}}/>
                </div>
              </div>
            );
          })}
          {catBreakdown.length===0 && <div style={{color:"rgba(255,255,255,0.3)",textAlign:"center",padding:"20px 0"}}>No expense data this month</div>}
        </div>
      </GCard>

      {/* Smart tips */}
      <GCard>
        <div style={{fontWeight:700,fontSize:15,color:"#fff",marginBottom:14}}>💡 Smart Insights</div>
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {totalSpent>income && <Tip type="danger">⚠️ You've exceeded your budget by {fmtINR(totalSpent-income)}. Cut back on {catBreakdown[0]?.cat||"discretionary"} spending.</Tip>}
          {savingsRate<20&&totalSpent<=income && <Tip type="warning">💡 Savings rate is {savingsRate.toFixed(1)}% — below the recommended 20%. Try saving {fmtINR(Math.round(income*0.2))} this month.</Tip>}
          {savingsRate>=20 && <Tip type="success">🌟 Excellent! You're saving {savingsRate.toFixed(1)}% of income — {fmtINR(Math.round(income-totalSpent))} saved this month!</Tip>}
          {catBreakdown[0]&&catBreakdown[0].total>income*0.3 && <Tip type="info">📊 {catBreakdown[0].cat} is your biggest expense ({(catBreakdown[0].total/income*100).toFixed(0)}% of income). Consider setting a budget cap.</Tip>}
          {weekDiff>20 && <Tip type="warning">📈 Your spending jumped {weekDiff.toFixed(0)}% this week vs last week. Review recent purchases.</Tip>}
          {savingsRate>=30 && <Tip type="success">🚀 You're saving over 30%! Consider investing the surplus in SIP mutual funds for compound growth.</Tip>}
        </div>
      </GCard>
    </div>
  );
}

function Tip({ type, children }) {
  const styles = {
    danger:{bg:"rgba(244,63,94,0.1)",border:"rgba(244,63,94,0.3)",color:"#fca5a5"},
    warning:{bg:"rgba(245,158,11,0.1)",border:"rgba(245,158,11,0.3)",color:"#fcd34d"},
    success:{bg:"rgba(16,185,129,0.1)",border:"rgba(16,185,129,0.3)",color:"#6ee7b7"},
    info:{bg:"rgba(14,165,233,0.1)",border:"rgba(14,165,233,0.3)",color:"#7dd3fc"},
  };
  const s=styles[type]||styles.info;
  return <div style={{padding:"12px 16px",borderRadius:12,background:s.bg,border:`1px solid ${s.border}`,fontSize:13,color:s.color,lineHeight:1.6}}>{children}</div>;
}

/* ─────────────────────────────────────────────
   HISTORY TAB
───────────────────────────────────────────── */
function HistoryTab({ expenses, allCats, onDelete, onEdit }) {
  const [search,setSearch]=useState("");
  const [filterCat,setFilterCat]=useState("All");
  const [sortBy,setSortBy]=useState("date");
  const filtered = expenses
    .filter(e=>filterCat==="All"||e.category===filterCat)
    .filter(e=>!search||e.desc?.toLowerCase().includes(search.toLowerCase())||e.category?.toLowerCase().includes(search.toLowerCase()))
    .sort((a,b)=>sortBy==="date"?new Date(b.date)-new Date(a.date):Number(b.amount)-Number(a.amount));
  const total=filtered.reduce((a,e)=>a+Number(e.amount),0);

  return (
    <div style={{display:"flex",flexDirection:"column",gap:16,animation:"slideUp 0.4s"}}>
      <GCard>
        <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:12}}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Search transactions..." style={{flex:1,minWidth:180,padding:"10px 14px",borderRadius:12,border:"1px solid rgba(255,255,255,0.12)",background:"rgba(255,255,255,0.06)",color:"#fff",fontSize:13,outline:"none"}}/>
          <select value={filterCat} onChange={e=>setFilterCat(e.target.value)} style={{padding:"10px 14px",borderRadius:12,border:"1px solid rgba(255,255,255,0.12)",background:"rgba(15,23,42,0.8)",color:"#fff",fontSize:13,outline:"none"}}>
            <option value="All">All Categories</option>
            {allCats.map(c=><option key={c} value={c}>{c}</option>)}
          </select>
          <select value={sortBy} onChange={e=>setSortBy(e.target.value)} style={{padding:"10px 14px",borderRadius:12,border:"1px solid rgba(255,255,255,0.12)",background:"rgba(15,23,42,0.8)",color:"#fff",fontSize:13,outline:"none"}}>
            <option value="date">Sort: Date</option>
            <option value="amount">Sort: Amount</option>
          </select>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:13,color:"rgba(255,255,255,0.45)",marginBottom:14,paddingBottom:10,borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
          <span>{filtered.length} transactions</span>
          <span>Total: <b style={{color:"#f43f5e"}}>{fmtINR(total)}</b></span>
        </div>
        {filtered.length===0&&<div style={{textAlign:"center",color:"rgba(255,255,255,0.3)",padding:"28px 0"}}>No transactions found</div>}
        {filtered.map(e=>{
          const ci=allCats.indexOf(e.category), col=PALETTE[ci%PALETTE.length];
          return (
            <div key={e.id} className="expense-row">
              <div style={{width:40,height:40,borderRadius:12,background:`${col}22`,border:`1px solid ${col}33`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>{CAT_ICONS[e.category]||"💸"}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:600,fontSize:14,color:"#fff",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.desc}</div>
                <div style={{fontSize:11,color:"rgba(255,255,255,0.35)",marginTop:2}}>{e.category} • {e.date}{e.note&&<span style={{color:"rgba(255,255,255,0.25)"}}> • {e.note}</span>}</div>
              </div>
              <div style={{fontWeight:800,color:"#f43f5e",fontSize:15,flexShrink:0}}>{fmtINR(e.amount)}</div>
              <button onClick={()=>onEdit(e)} style={{background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:8,width:30,height:30,cursor:"pointer",color:"rgba(255,255,255,0.6)",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center"}}>✏️</button>
              <button onClick={()=>onDelete(e.id)} style={{background:"rgba(244,63,94,0.1)",border:"1px solid rgba(244,63,94,0.2)",borderRadius:8,width:30,height:30,cursor:"pointer",color:"#f43f5e",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center"}}>🗑️</button>
            </div>
          );
        })}
      </GCard>
    </div>
  );
}

/* ─────────────────────────────────────────────
   GOALS TAB
───────────────────────────────────────────── */
function GoalsTab({ goals, setGoals, notify, celebrate }) {
  const [showForm,setShowForm]=useState(false);
  function addGoal(g){ setGoals([...goals,{id:Date.now(),...g,saved:0}]); setShowForm(false); notify("Goal added! 🎯"); }
  function deleteGoal(id){ setGoals(goals.filter(g=>g.id!==id)); notify("Goal deleted","error"); }
  function addSaving(id,amt){
    setGoals(goals.map(g=>{
      if(g.id!==id) return g;
      const ns=Math.min(g.target,(g.saved||0)+Number(amt));
      if(ns>=g.target){ notify("🎉 Goal Achieved!","success"); celebrate(); }
      return {...g,saved:ns};
    }));
  }

  return (
    <div style={{display:"flex",flexDirection:"column",gap:16,animation:"slideUp 0.4s"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{fontSize:14,color:"rgba(255,255,255,0.5)"}}>{goals.length} active goals</div>
        <GBtn onClick={()=>setShowForm(true)}>+ New Goal</GBtn>
      </div>
      {goals.length===0&&<GCard style={{textAlign:"center",padding:40}}><div style={{fontSize:48,marginBottom:12}}>🎯</div><div style={{color:"rgba(255,255,255,0.5)"}}>No goals yet. Set your first financial goal!</div></GCard>}
      <div className="grid2">
        {goals.map(g=>{
          const pct=g.target>0?Math.min((g.saved||0)/g.target*100,100):0;
          const done=pct>=100;
          const color=done?"#10b981":pct>50?"#0ea5e9":"#8b5cf6";
          return (
            <GCard key={g.id} glow={color}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
                <div>
                  <div style={{fontWeight:800,fontSize:16,color:"#fff"}}>🎯 {g.name}</div>
                  {g.deadline&&<div style={{fontSize:11,color:"rgba(255,255,255,0.4)",marginTop:3}}>Target: {g.deadline}</div>}
                </div>
                <button onClick={()=>deleteGoal(g.id)} style={{background:"rgba(244,63,94,0.1)",border:"1px solid rgba(244,63,94,0.2)",borderRadius:8,width:30,height:30,cursor:"pointer",color:"#f43f5e",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center"}}>🗑️</button>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:12}}>
                <Ring pct={pct} size={70} stroke={7} color={color} label={pct.toFixed(0)+"%"}/>
                <div>
                  <div style={{fontSize:20,fontWeight:900,color}}>{fmtINR(g.saved||0)}</div>
                  <div style={{fontSize:12,color:"rgba(255,255,255,0.4)"}}>of {fmtINR(g.target)}</div>
                  <div style={{fontSize:11,color:"rgba(255,255,255,0.35)",marginTop:4}}>Left: {fmtINR(Math.max(0,g.target-(g.saved||0)))}</div>
                </div>
              </div>
              {done?<div style={{textAlign:"center",padding:"8px",background:"rgba(16,185,129,0.15)",border:"1px solid rgba(16,185,129,0.3)",borderRadius:10,color:"#6ee7b7",fontWeight:700}}>🎉 Goal Achieved!</div>:(
                <form onSubmit={e=>{e.preventDefault();const v=e.target.amt.value;if(!v)return;addSaving(g.id,v);e.target.reset();}} style={{display:"flex",gap:8}}>
                  <input name="amt" type="number" min="1" placeholder="Add savings (₹)" style={{flex:1,padding:"8px 12px",borderRadius:10,border:"1px solid rgba(255,255,255,0.12)",background:"rgba(255,255,255,0.06)",color:"#fff",fontSize:13,outline:"none"}}/>
                  <GBtn type="submit" style={{padding:"8px 14px",fontSize:12}}>Add</GBtn>
                </form>
              )}
            </GCard>
          );
        })}
      </div>
      <Modal open={showForm} onClose={()=>setShowForm(false)} title="🎯 New Goal"><GoalForm onSubmit={addGoal}/></Modal>
    </div>
  );
}

/* ─────────────────────────────────────────────
   LOANS TAB
───────────────────────────────────────────── */
function LoansTab({ loans, setLoans, notify }) {
  const [showForm,setShowForm]=useState(false);
  function addLoan(l){ setLoans([...loans,{id:Date.now(),...l,paid:0}]); setShowForm(false); notify("Loan added! 🏦"); }
  function deleteLoan(id){ setLoans(loans.filter(l=>l.id!==id)); notify("Loan deleted","error"); }
  function payEMI(id){ setLoans(loans.map(l=>l.id!==id?l:{...l,paid:Math.min(l.principal,(l.paid||0)+(l.emi||0))})); notify("EMI recorded! ✅"); }

  const totalDebt=loans.reduce((a,l)=>a+Math.max(0,l.principal-(l.paid||0)),0);

  return (
    <div style={{display:"flex",flexDirection:"column",gap:16,animation:"slideUp 0.4s"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{fontSize:14,color:"rgba(255,255,255,0.5)"}}>Total outstanding: <span style={{color:"#f43f5e",fontWeight:700}}>{fmtINR(totalDebt)}</span></div>
        <GBtn onClick={()=>setShowForm(true)}>+ Add Loan</GBtn>
      </div>
      {loans.length===0&&<GCard style={{textAlign:"center",padding:40}}><div style={{fontSize:48,marginBottom:12}}>🏦</div><div style={{color:"rgba(255,255,255,0.5)"}}>No loans tracked. Add a loan to track EMIs.</div></GCard>}
      <div className="grid2">
        {loans.map(l=>{
          const pct=l.principal>0?Math.min(((l.paid||0)/l.principal)*100,100):0;
          const remaining=l.principal-(l.paid||0);
          const done=pct>=100;
          return (
            <GCard key={l.id} glow={done?"#10b981":"#f43f5e"}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
                <div><div style={{fontWeight:800,fontSize:16,color:"#fff"}}>🏦 {l.name}</div><div style={{fontSize:11,color:"rgba(255,255,255,0.4)",marginTop:3}}>{l.rate}% p.a. • {l.tenureMonths} months</div></div>
                <button onClick={()=>deleteLoan(l.id)} style={{background:"rgba(244,63,94,0.1)",border:"1px solid rgba(244,63,94,0.2)",borderRadius:8,width:30,height:30,cursor:"pointer",color:"#f43f5e",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center"}}>🗑️</button>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:12}}>
                <Ring pct={pct} size={70} stroke={7} color={done?"#10b981":"#f43f5e"} label={pct.toFixed(0)+"%"}/>
                <div>
                  <div style={{fontSize:18,fontWeight:900,color:done?"#10b981":"#f43f5e"}}>{fmtINR(remaining)}</div>
                  <div style={{fontSize:12,color:"rgba(255,255,255,0.4)"}}>remaining</div>
                  <div style={{fontSize:11,color:"rgba(255,255,255,0.35)",marginTop:4}}>EMI: {fmtINR(l.emi)}/month</div>
                </div>
              </div>
              {done?<div style={{textAlign:"center",padding:"8px",background:"rgba(16,185,129,0.15)",border:"1px solid rgba(16,185,129,0.3)",borderRadius:10,color:"#6ee7b7",fontWeight:700}}>🎉 Fully Paid!</div>:<GBtn variant="success" onClick={()=>payEMI(l.id)} style={{width:"100%",justifyContent:"center",fontSize:13}}>✓ Pay EMI ({fmtINR(l.emi)})</GBtn>}
            </GCard>
          );
        })}
      </div>
      <Modal open={showForm} onClose={()=>setShowForm(false)} title="🏦 Add Loan"><LoanForm onSubmit={addLoan}/></Modal>
    </div>
  );
}

/* ─────────────────────────────────────────────
   CHALLENGES TAB
───────────────────────────────────────────── */
function ChallengesTab({ challenges, setChallenges, notify, celebrate }) {
  const [showForm,setShowForm]=useState(false);
  function addChallenge(c){ setChallenges([...challenges,{id:Date.now(),...c,progress:0}]); setShowForm(false); notify("Challenge added! 🏆"); }
  function deleteChallenge(id){ setChallenges(challenges.filter(c=>c.id!==id)); notify("Challenge deleted","error"); }
  function updateProgress(id,val){
    setChallenges(challenges.map(c=>{
      if(c.id!==id) return c;
      const np=Math.min(c.target,(c.progress||0)+Number(val));
      if(np>=c.target){ notify("🏆 Challenge Complete!","success"); celebrate(); }
      return {...c,progress:np};
    }));
  }

  return (
    <div style={{display:"flex",flexDirection:"column",gap:16,animation:"slideUp 0.4s"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{fontSize:14,color:"rgba(255,255,255,0.5)"}}>{challenges.length} challenges</div>
        <GBtn onClick={()=>setShowForm(true)}>+ New Challenge</GBtn>
      </div>
      {challenges.length===0&&<GCard style={{textAlign:"center",padding:40}}><div style={{fontSize:48,marginBottom:12}}>🏆</div><div style={{color:"rgba(255,255,255,0.5)"}}>No challenges yet. Set a savings or spending challenge!</div></GCard>}
      <div className="grid2">
        {challenges.map(c=>{
          const pct=c.target>0?Math.min(((c.progress||0)/c.target)*100,100):0;
          const done=pct>=100;
          const color=done?"#10b981":pct>60?"#0ea5e9":"#8b5cf6";
          return (
            <GCard key={c.id} glow={color}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
                <div><div style={{fontWeight:800,fontSize:16,color:"#fff"}}>🏆 {c.name}</div><div style={{fontSize:11,color:"rgba(255,255,255,0.4)",marginTop:3}}>{c.type} • {c.duration} days</div></div>
                <button onClick={()=>deleteChallenge(c.id)} style={{background:"rgba(244,63,94,0.1)",border:"1px solid rgba(244,63,94,0.2)",borderRadius:8,width:30,height:30,cursor:"pointer",color:"#f43f5e",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center"}}>🗑️</button>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:12}}>
                <Ring pct={pct} size={70} stroke={7} color={color} label={pct.toFixed(0)+"%"}/>
                <div><div style={{fontSize:20,fontWeight:900,color}}>{c.progress||0} / {c.target}</div><div style={{fontSize:12,color:"rgba(255,255,255,0.4)"}}>progress</div></div>
              </div>
              {done?<div style={{textAlign:"center",padding:"8px",background:"rgba(16,185,129,0.15)",border:"1px solid rgba(16,185,129,0.3)",borderRadius:10,color:"#6ee7b7",fontWeight:700}}>🏆 Challenge Complete!</div>:(
                <form onSubmit={e=>{e.preventDefault();const v=e.target.val.value;if(!v)return;updateProgress(c.id,v);e.target.reset();}} style={{display:"flex",gap:8}}>
                  <input name="val" type="number" min="1" placeholder="Update progress..." style={{flex:1,padding:"8px 12px",borderRadius:10,border:"1px solid rgba(255,255,255,0.12)",background:"rgba(255,255,255,0.06)",color:"#fff",fontSize:13,outline:"none"}}/>
                  <GBtn type="submit" style={{padding:"8px 14px",fontSize:12}}>Update</GBtn>
                </form>
              )}
            </GCard>
          );
        })}
      </div>
      <Modal open={showForm} onClose={()=>setShowForm(false)} title="🏆 New Challenge"><ChallengeForm onSubmit={addChallenge}/></Modal>
    </div>
  );
}

/* ─────────────────────────────────────────────
   INVEST TAB
───────────────────────────────────────────── */
function InvestTab({ income, totalSpent }) {
  const [monthly,setMonthly]=useState(Math.max(500,Math.round((income-totalSpent)*0.5)));
  const [yr,setYr]=useState(10);
  const [rate,setRate]=useState(12);
  const sipVal=sipProjection(monthly,rate,yr);
  const invested=monthly*yr*12;
  const returns=sipVal-invested;

  const instruments=[
    {name:"SIP – Equity Mutual Fund",icon:"📈",color:"#0ea5e9",returns:12,risk:"Medium",riskColor:"#f59e0b",desc:"Diversified equity via SIPs. Compounding works best over 10+ years."},
    {name:"PPF",icon:"🏛️",color:"#10b981",returns:7.1,risk:"Very Low",riskColor:"#10b981",desc:"Government-backed, 15-year lock-in. Tax-free returns under 80C."},
    {name:"Fixed Deposit",icon:"🏦",color:"#6366f1",returns:7,risk:"Very Low",riskColor:"#10b981",desc:"Safe guaranteed returns. Best for short-term emergency funds."},
    {name:"NPS",icon:"👴",color:"#8b5cf6",returns:10,risk:"Low-Med",riskColor:"#f59e0b",desc:"National Pension System. Tax benefit up to ₹2L. Retirement focus."},
    {name:"Gold ETF",icon:"🪙",color:"#f59e0b",returns:8,risk:"Medium",riskColor:"#f59e0b",desc:"Digital Gold — inflation hedge. Keep 5-10% of portfolio."},
    {name:"Direct Stocks",icon:"🚀",color:"#f43f5e",returns:15,risk:"High",riskColor:"#f43f5e",desc:"High risk, high reward. Research required. Don't put all eggs here."},
  ];

  const compareData=instruments.map(inst=>({
    label:inst.name.split("–")[0].split(" ")[0],
    value:Math.round(sipProjection(monthly,inst.returns,yr)),
    color:inst.color
  }));

  const monthlyFree=income-totalSpent;
  const readiness=income>0?Math.min(100,Math.round(Math.max(0,monthlyFree/income)*100*1.5)):0;

  return (
    <div style={{display:"flex",flexDirection:"column",gap:20,animation:"slideUp 0.4s"}}>
      {/* SIP Calculator */}
      <GCard glow="#0ea5e9">
        <div style={{fontWeight:800,fontSize:18,color:"#fff",marginBottom:20}}>🧮 SIP Calculator</div>
        <div style={{display:"flex",gap:24,flexWrap:"wrap",marginBottom:20}}>
          <div style={{flex:1,minWidth:220}}>
            <GInput label="Monthly Investment (₹)" type="number" value={monthly} onChange={e=>setMonthly(Number(e.target.value))} min="500"/>
            <div style={{marginTop:16}}>
              <label style={{fontSize:12,color:"rgba(255,255,255,0.5)",fontWeight:600,textTransform:"uppercase",letterSpacing:0.5}}>Duration: {yr} Years</label>
              <input type="range" min="1" max="30" value={yr} onChange={e=>setYr(Number(e.target.value))} style={{marginTop:8}}/>
            </div>
            <div style={{marginTop:16}}>
              <label style={{fontSize:12,color:"rgba(255,255,255,0.5)",fontWeight:600,textTransform:"uppercase",letterSpacing:0.5}}>Annual Return: {rate}%</label>
              <input type="range" min="4" max="20" value={rate} onChange={e=>setRate(Number(e.target.value))} style={{marginTop:8}}/>
            </div>
          </div>
          <div style={{flex:1,minWidth:220,display:"flex",flexDirection:"column",gap:10}}>
            {[
              {l:"Total Invested",v:fmtINR(invested),c:"#0ea5e9",icon:"💰"},
              {l:"Est. Returns",v:fmtINR(Math.round(returns)),c:"#10b981",icon:"📈"},
              {l:"Maturity Value",v:fmtINR(Math.round(sipVal)),c:"#f59e0b",icon:"🏆"},
              {l:"Returns Multiplier",v:(invested>0?(sipVal/invested).toFixed(2):0)+"x",c:"#8b5cf6",icon:"✨"},
            ].map((s,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 14px",background:`rgba(255,255,255,0.05)`,borderRadius:12,border:`1px solid ${s.c}33`}}>
                <span style={{fontSize:20}}>{s.icon}</span>
                <div>
                  <div style={{fontSize:11,color:"rgba(255,255,255,0.4)"}}>{s.l}</div>
                  <div style={{fontSize:17,fontWeight:800,color:s.c}}>{s.v}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div style={{fontWeight:700,fontSize:14,color:"rgba(255,255,255,0.7)",marginBottom:10}}>Projected Corpus by Instrument</div>
        <BarChart data={compareData} color="#0ea5e9" height={140}/>
      </GCard>

      {/* Investment options */}
      <div className="grid2">
        {instruments.map((inst,i)=>{
          const proj=sipProjection(monthly,inst.returns,yr);
          return (
            <GCard key={i} glow={inst.color}>
              <div style={{display:"flex",alignItems:"flex-start",gap:12,marginBottom:10}}>
                <div style={{width:44,height:44,borderRadius:12,background:`${inst.color}22`,border:`1px solid ${inst.color}44`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>{inst.icon}</div>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,fontSize:15,color:"#fff"}}>{inst.name}</div>
                  <div style={{display:"flex",gap:6,marginTop:4}}>
                    <span style={{fontSize:11,padding:"2px 8px",borderRadius:99,background:`${inst.riskColor}22`,color:inst.riskColor,fontWeight:600}}>{inst.risk} Risk</span>
                    <span style={{fontSize:11,padding:"2px 8px",borderRadius:99,background:"rgba(16,185,129,0.15)",color:"#10b981",fontWeight:600}}>{inst.returns}% p.a.</span>
                  </div>
                </div>
              </div>
              <div style={{fontSize:12,color:"rgba(255,255,255,0.45)",marginBottom:10,lineHeight:1.5}}>{inst.desc}</div>
              <div style={{fontSize:13,fontWeight:600,color:"rgba(255,255,255,0.7)"}}>In {yr} years: <span style={{color:inst.color,fontWeight:800}}>{fmtINR(Math.round(proj))}</span></div>
            </GCard>
          );
        })}
      </div>

      {/* Investment readiness */}
      <GCard>
        <div style={{fontWeight:700,fontSize:16,color:"#fff",marginBottom:16}}>🎯 Investment Readiness</div>
        <div style={{display:"flex",alignItems:"center",gap:24}}>
          <Ring pct={readiness} size={100} stroke={10} color={readiness>60?"#10b981":readiness>30?"#f59e0b":"#f43f5e"} label={readiness+"%"} sublabel="ready"/>
          <div>
            <div style={{fontSize:20,fontWeight:900,color:readiness>60?"#10b981":readiness>30?"#f59e0b":"#f43f5e",marginBottom:6}}>{readiness>60?"Excellent! Start Investing 🚀":readiness>30?"Good — Start Small 📈":"Build Emergency Fund First 🛡️"}</div>
            <div style={{fontSize:13,color:"rgba(255,255,255,0.5)",lineHeight:1.6}}>
              {monthlyFree>0?`You have ${fmtINR(monthlyFree)} free monthly. Allocate ${fmtINR(Math.round(monthlyFree*0.5))} to investments for best results.`:"No free cash this month. Focus on reducing expenses first."}
            </div>
          </div>
        </div>
      </GCard>
    </div>
  );
}
/* ─────────────────────────────────────────────
   AI ADVISOR TAB (detailed)
───────────────────────────────────────────── */
function AITab({ income, expenses, goals, loans, activeMonth, activeYear, allCats }) {
  const [query,setQuery]=useState('');
  const [response,setResponse]=useState('');
  const [loading,setLoading]=useState(false);
  const [history,setHistory]=useState([]);

  const mk=`${activeYear}-${String(Number(activeMonth)+1).padStart(2,'00')}`;
  const monthExp=expenses.filter(e=>e.date&&e.date.startsWith(mk));
  const totalSpent=monthExp.reduce((a,e)=>a+Number(e.amount),0);
  const balance=income-totalSpent;
  const savingsRate=income>0?Math.max(0,(balance/income)*100):0;
  const catArr=allCats.map((cat,i)=>({cat,color:PALETTE[i%PALETTE.length],total:monthExp.filter(e=>e.category===cat).reduce((a,e)=>a+Number(e.amount),0)})).filter(c=>c.total>0).sort((a,b)=>b.total-a.total);
  const totalDebt=loans.reduce((a,l)=>a+Math.max(0,l.principal-(l.paid||0)),0);
  const monthlyEMIs=loans.reduce((a,l)=>a+(l.emi||0),0);
  const last3=Array.from({length:3},(_,i)=>{
    const d=new Date(activeYear,activeMonth-2+i,1);
    const m=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'00')}`;
    return expenses.filter(e=>e.date&&e.date.startsWith(m)).reduce((a,e)=>a+Number(e.amount),0);
  });
  const spendTrend=last3[2]>last3[0]?'increasing':last3[2]<last3[0]?'decreasing':'stable';
  const emiRatio=income>0?(monthlyEMIs/income)*100:0;

  function generateResponse(q) {
    const ql=q.toLowerCase();
    const top0=catArr[0];
    const top1=catArr[1];
    const debtFreeMonths=monthlyEMIs>0?Math.ceil(totalDebt/monthlyEMIs):0;
    const investable=Math.max(0,Math.round(balance*0.6));

    if(ql.includes("save")||ql.includes("saving")||ql.includes("cut")) {
      const tip1=top0?"• "+top0.cat+" is biggest at "+fmtINR(top0.total)+". Cut 20% = save "+fmtINR(Math.round(top0.total*0.2))+"/month":"• Track expenses to find top spending category";
      const tip2=top1?"• "+top1.cat+" costs "+fmtINR(top1.total)+". Reduce 15% = save "+fmtINR(Math.round(top1.total*0.15))+"/month":"• Review subscriptions and cancel unused ones";
      const alert=savingsRate<10?"CRITICAL: Savings rate below 10% — no financial buffer!":savingsRate<20?"ACTION: Savings below 20%. Target: "+fmtINR(Math.round(income*0.2))+"/month":"GREAT: Saving "+savingsRate.toFixed(1)+"% — above 20% benchmark!";
      return "Savings Analysis\n\nYour Situation:\nIncome: "+fmtINR(income)+"/month\nSpent: "+fmtINR(totalSpent)+" ("+((totalSpent/income)*100).toFixed(1)+"%)\nSavings: "+fmtINR(balance)+" ("+savingsRate.toFixed(1)+"% rate)\nTrend: "+spendTrend+" over 3 months\n\n"+alert+"\n\nAction Plan:\n"+tip1+"\n"+tip2+"\n• Apply 50-30-20 rule: Needs "+fmtINR(income*0.5)+" | Wants "+fmtINR(income*0.3)+" | Savings "+fmtINR(income*0.2)+"\n• Automate "+fmtINR(Math.round(income*0.2))+" savings on payday\n• Emergency fund target: "+fmtINR(income*4)+" (4 months income)\n\nPotential savings: "+fmtINR(Math.round((top0?.total||0)*0.2+(top1?.total||0)*0.15))+"/month from top 2 categories!";
    }
    if(ql.includes("invest")||ql.includes("sip")||ql.includes("mutual")||ql.includes("wealth")) {
      return "Investment Roadmap\n\nYour Capacity:\nMonthly Free Cash: "+fmtINR(balance)+"\nRecommended: "+fmtINR(investable)+" (60% of surplus)\nEMI Burden: "+fmtINR(monthlyEMIs)+" ("+emiRatio.toFixed(0)+"% of income)\n\nPriority Order:\n1. Emergency Fund First: Target "+fmtINR(income*4)+" in liquid fund\n2. Tax Saving (80C): "+fmtINR(12500)+"/month in ELSS — saves up to "+fmtINR(45000)+"/year in taxes\n3. NPS: "+fmtINR(Math.min(4167,Math.round(balance*0.1)))+"/month — extra Rs50k deduction\n4. SIP Wealth: "+fmtINR(investable)+"/month @ 12% for 10yr = "+fmtINR(Math.round(sipProjection(investable,12,10)))+"\n   Same for 20yr = "+fmtINR(Math.round(sipProjection(investable,12,20)))+"\n5. Goal Funds: "+fmtINR(Math.round(balance*0.2))+"/month for "+goals.length+" active goals\n\nRule: Never invest more than you can afford. Keep 3 months expenses liquid.";
    }
    if(ql.includes("loan")||ql.includes("debt")||ql.includes("emi")) {
      return "Debt Analysis\n\nYour Debt Picture:\nTotal Outstanding: "+fmtINR(totalDebt)+"\nMonthly EMIs: "+fmtINR(monthlyEMIs)+" ("+emiRatio.toFixed(1)+"% of income)\n"+(emiRatio>40?"DANGER: EMI ratio above 40% — financially risky!":emiRatio>30?"CAUTION: EMI ratio is high. Aim below 30%":"HEALTHY: EMI ratio within safe limits")+"\nDebt-free in: "+debtFreeMonths+" months at current pace\n\nRepayment Strategies:\n\nAvalanche Method (Saves Most Interest):\n• Pay minimum on all, put extra on highest-interest loan first\n• Extra payment: "+fmtINR(Math.round(balance*0.3))+"/month\n\nSnowball Method (Best Motivation):\n• Pay minimum on all, clear smallest balance first\n• Good for psychological wins\n\nPro Tip: Paying even Rs1,000 extra/month on a Rs10L loan at 10% saves ~1.5 years of EMIs!";
    }
    if(ql.includes("budget")||ql.includes("plan")||ql.includes("alloc")) {
      return "Custom Budget Plan\n\nIncome: "+fmtINR(income)+"/month\n\nNEEDS (50%) — "+fmtINR(Math.round(income*0.5))+"\n• Rent/EMI: "+fmtINR(Math.round(income*0.25))+"\n• Groceries: "+fmtINR(Math.round(income*0.1))+"\n• Transport: "+fmtINR(Math.round(income*0.07))+"\n• Bills: "+fmtINR(Math.round(income*0.05))+"\n• Health: "+fmtINR(Math.round(income*0.03))+"\n\nWANTS (30%) — "+fmtINR(Math.round(income*0.3))+"\n• Dining/Entertainment: "+fmtINR(Math.round(income*0.1))+"\n• Shopping: "+fmtINR(Math.round(income*0.1))+"\n• Travel/Hobbies: "+fmtINR(Math.round(income*0.05))+"\n• Subscriptions: "+fmtINR(Math.round(income*0.03))+"\n\nSAVINGS (20%) — "+fmtINR(Math.round(income*0.2))+"\n• Emergency Fund: "+fmtINR(Math.round(income*0.05))+"\n• SIP/Investments: "+fmtINR(Math.round(income*0.1))+"\n• Short-term goals: "+fmtINR(Math.round(income*0.05))+"\n\nYou spent "+fmtINR(totalSpent)+" this month. "+(totalSpent>income*0.8?"Over 80% of income — reduce Wants!":"Within healthy range. Keep tracking!");
    }
    if(ql.includes("tax")||ql.includes("80c")||ql.includes("deduction")) {
      return "Tax Saving Guide (FY 2025-26)\n\nAnnual Income: "+fmtINR(income*12)+"\nMax Tax Savings: "+fmtINR(Math.round(Math.min(income*12*0.3,60000)))+"+ per year\n\nSection 80C (Rs1.5L limit):\n• ELSS Mutual Fund: Rs12,500/month — best returns, 3yr lock-in\n• PPF: Up to Rs1.5L/year — 7.1% tax-free, 15yr lock-in\n• NSC, LIC Premium, Tuition Fees also eligible\n\nBeyond 80C:\n• 80D: Health Insurance — Rs25,000 (Rs50,000 if parents 60+)\n• 80CCD(1B): NPS — extra Rs50,000 above 80C limit\n• HRA: If renting — submit rent receipts to employer\n• Section 24: Home Loan Interest — up to Rs2,00,000\n• 80E: Education Loan interest — unlimited deduction\n\nPersonalized Tip: Maxing 80C + NPS saves approximately "+fmtINR(Math.round(200000*0.3))+"/year in taxes!\nStart ELSS SIP of Rs12,500/month from April.";
    }
    return "Hello! I am your AI Financial Advisor.\n\nYour Financial Snapshot:\n• Income: "+fmtINR(income)+"/month\n• Spent: "+fmtINR(totalSpent)+" ("+((totalSpent/income)*100||0).toFixed(1)+"% of income)\n• Balance: "+fmtINR(balance)+"\n• Savings Rate: "+savingsRate.toFixed(1)+"%\n• Goals: "+goals.length+" active\n• Debt: "+fmtINR(totalDebt)+"\n• Spending trend: "+spendTrend+"\n\n"+(totalSpent>income?"ALERT: Overspent this month by "+fmtINR(totalSpent-income)+"!":savingsRate>20?"You are in a healthy financial position!":"There is room to improve.")+"\n\nAsk me about:\n• How to save more money\n• Investment advice (SIP, mutual funds)\n• Budget planning\n• Loan/debt management\n• Tax saving tips\n• How am I doing financially?";
  }

  async function handleAsk() {
    if(!query.trim()) return;
    setLoading(true);
    const q=query; setQuery("");
    await new Promise(r=>setTimeout(r,700));
    const resp=generateResponse(q);
    setResponse(resp);
    setHistory(h=>[{q,a:resp},...h.slice(0,4)]);
    setLoading(false);
  }

  const suggestions=["How to save more money?","Where should I invest?","Create a budget plan","Help with my loans","How to save on taxes?","How am I doing?"];

  return (
    <div style={{display:"flex",flexDirection:"column",gap:20,animation:"slideUp 0.4s"}}>
      <div className="grid4">
        {[{l:"Income",v:fmtINR(income),c:"#0ea5e9",i:"💰"},{l:"Spent",v:fmtINR(totalSpent),c:"#f43f5e",i:"💸"},{l:"Savings",v:savingsRate.toFixed(1)+"%",c:"#10b981",i:"📊"},{l:"Debt",v:fmtINR(totalDebt),c:"#8b5cf6",i:"🏦"}].map((s,i)=>(
          <GCard key={i} style={{padding:16}}>
            <div style={{fontSize:24,marginBottom:6}}>{s.i}</div>
            <div style={{fontSize:11,color:"rgba(255,255,255,0.4)"}}>{s.l}</div>
            <div style={{fontSize:18,fontWeight:900,color:s.c}}>{s.v}</div>
          </GCard>
        ))}
      </div>
      <GCard glow="#0ea5e9">
        <div style={{fontWeight:800,fontSize:16,color:"#fff",marginBottom:14}}>🤖 Ask Your AI Advisor</div>
        <div style={{display:"flex",gap:10,marginBottom:14}}>
          <input value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleAsk()} placeholder="Ask anything about your finances..." style={{flex:1,padding:"12px 16px",borderRadius:14,border:"1px solid rgba(255,255,255,0.15)",background:"rgba(255,255,255,0.07)",color:"#fff",fontSize:14,outline:"none"}}/>
          <GBtn onClick={handleAsk} disabled={loading} style={{padding:"12px 20px",minWidth:80,justifyContent:"center"}}>{loading?"⏳":"Ask →"}</GBtn>
        </div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {suggestions.map((s,i)=>(
            <button key={i} onClick={()=>setQuery(s)} style={{padding:"7px 14px",borderRadius:99,border:"1px solid rgba(255,255,255,0.12)",background:"rgba(255,255,255,0.05)",color:"rgba(255,255,255,0.65)",fontSize:12,cursor:"pointer",transition:"all 0.2s"}}
              onMouseEnter={e=>{e.currentTarget.style.background="rgba(14,165,233,0.15)";e.currentTarget.style.color="#7dd3fc";}}
              onMouseLeave={e=>{e.currentTarget.style.background="rgba(255,255,255,0.05)";e.currentTarget.style.color="rgba(255,255,255,0.65)";}}>
              {s}
            </button>
          ))}
        </div>
      </GCard>
      {(response||loading) && (
        <GCard glow="#14b8a6">
          <div style={{display:"flex",gap:12,marginBottom:12}}>
            <div style={{width:36,height:36,borderRadius:12,background:"linear-gradient(135deg,#0ea5e9,#14b8a6)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>🤖</div>
            <div style={{fontWeight:700,fontSize:15,color:"#fff",paddingTop:6}}>AI Advisor Response</div>
          </div>
          {loading?<div style={{color:"rgba(255,255,255,0.5)"}}>Analyzing your financial data...</div>:
          <div style={{fontSize:13,color:"rgba(255,255,255,0.85)",whiteSpace:"pre-line",lineHeight:1.8}}>{response}</div>}
        </GCard>
      )}
      {history.length>1 && (
        <GCard>
          <div style={{fontWeight:700,fontSize:14,color:"rgba(255,255,255,0.6)",marginBottom:12}}>Previous Questions</div>
          {history.slice(1).map((h,i)=>(
            <button key={i} onClick={()=>setResponse(h.a)} style={{display:"block",width:"100%",textAlign:"left",padding:"10px 14px",borderRadius:12,border:"1px solid rgba(255,255,255,0.08)",background:"rgba(255,255,255,0.03)",color:"rgba(255,255,255,0.6)",fontSize:13,cursor:"pointer",marginBottom:6,transition:"all 0.2s"}}
              onMouseEnter={e=>{e.currentTarget.style.background="rgba(255,255,255,0.07)";e.currentTarget.style.color="#fff";}}
              onMouseLeave={e=>{e.currentTarget.style.background="rgba(255,255,255,0.03)";e.currentTarget.style.color="rgba(255,255,255,0.6)";}}>
              💬 {h.q}
            </button>
          ))}
        </GCard>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   FORMS
───────────────────────────────────────────── */
function AddExpenseForm({ allCats, onSubmit, initial, activeMonth, activeYear }) {
  const today=new Date();
  const defDate=initial?.date||(`${activeYear}-${String(Number(activeMonth)+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`);
  const [form,setForm]=useState({desc:initial?.desc||"",amount:initial?.amount||"",category:initial?.category||allCats[0],date:defDate,note:initial?.note||""});
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  return (
    <form onSubmit={e=>{e.preventDefault();if(!form.desc||!form.amount)return;onSubmit({...form,amount:Number(form.amount)});}} style={{display:"flex",flexDirection:"column",gap:14}}>
      <GInput label="Description *" value={form.desc} onChange={e=>set("desc",e.target.value)} placeholder="e.g. Grocery shopping" required/>
      <GInput label="Amount (₹) *" type="number" value={form.amount} onChange={e=>set("amount",e.target.value)} placeholder="0" required min="1"/>
      <GSelect label="Category" value={form.category} onChange={e=>set("category",e.target.value)}>
        {allCats.map(c=><option key={c} value={c}>{CAT_ICONS[c]||"💸"} {c}</option>)}
      </GSelect>
      <GInput label="Date *" type="date" value={form.date} onChange={e=>set("date",e.target.value)} required/>
      <GInput label="Note (optional)" value={form.note} onChange={e=>set("note",e.target.value)} placeholder="Any notes..."/>
      <GBtn type="submit" style={{marginTop:4,justifyContent:"center"}}>{initial?"Update Expense ✏️":"Add Expense 💸"}</GBtn>
    </form>
  );
}

function IncomeForm({ income, onSubmit }) {
  const [val,setVal]=useState(income);
  return (
    <form onSubmit={e=>{e.preventDefault();onSubmit(Number(val));}} style={{display:"flex",flexDirection:"column",gap:14}}>
      <GInput label="Monthly Income (₹)" type="number" value={val} onChange={e=>setVal(e.target.value)} min="0"/>
      <div style={{fontSize:12,color:"rgba(255,255,255,0.4)"}}>This is your take-home salary / income for the month.</div>
      <GBtn type="submit" style={{justifyContent:"center"}}>Save Income 💰</GBtn>
    </form>
  );
}

function GoalForm({ onSubmit }) {
  const [form,setForm]=useState({name:"",target:"",deadline:""});
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  return (
    <form onSubmit={e=>{e.preventDefault();if(!form.name||!form.target)return;onSubmit({...form,target:Number(form.target)});}} style={{display:"flex",flexDirection:"column",gap:14}}>
      <GInput label="Goal Name *" value={form.name} onChange={e=>set("name",e.target.value)} placeholder="e.g. Emergency Fund, MacBook"/>
      <GInput label="Target Amount (₹) *" type="number" value={form.target} onChange={e=>set("target",e.target.value)} min="1"/>
      <GInput label="Target Date" type="date" value={form.deadline} onChange={e=>set("deadline",e.target.value)}/>
      <GBtn type="submit" style={{justifyContent:"center"}}>Set Goal 🎯</GBtn>
    </form>
  );
}

function LoanForm({ onSubmit }) {
  const [form,setForm]=useState({name:"",principal:"",rate:"",tenureMonths:"",emi:""});
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  function calcEMI(e){
    e.preventDefault();
    const p=Number(form.principal),r=Number(form.rate)/12/100,n=Number(form.tenureMonths);
    if(!p||!r||!n)return;
    set("emi",Math.round((p*r*Math.pow(1+r,n))/(Math.pow(1+r,n)-1)));
  }
  return (
    <form onSubmit={e=>{e.preventDefault();if(!form.name||!form.principal)return;onSubmit({...form,principal:Number(form.principal),rate:Number(form.rate),tenureMonths:Number(form.tenureMonths),emi:Number(form.emi)});}} style={{display:"flex",flexDirection:"column",gap:14}}>
      <GInput label="Loan Name *" value={form.name} onChange={e=>set("name",e.target.value)} placeholder="e.g. Home Loan, Car Loan"/>
      <GInput label="Principal Amount (₹) *" type="number" value={form.principal} onChange={e=>set("principal",e.target.value)} min="1"/>
      <GInput label="Interest Rate (%/year)" type="number" value={form.rate} onChange={e=>set("rate",e.target.value)} step="0.01"/>
      <GInput label="Tenure (months)" type="number" value={form.tenureMonths} onChange={e=>set("tenureMonths",e.target.value)} min="1"/>
      <div style={{display:"flex",gap:10,alignItems:"flex-end"}}>
        <div style={{flex:1}}><GInput label="EMI (₹)" type="number" value={form.emi} onChange={e=>set("emi",e.target.value)}/></div>
        <GBtn variant="ghost" onClick={calcEMI} style={{whiteSpace:"nowrap",flexShrink:0}}>Calc EMI</GBtn>
      </div>
      <GBtn type="submit" style={{justifyContent:"center"}}>Add Loan 🏦</GBtn>
    </form>
  );
}

function ChallengeForm({ onSubmit }) {
  const [form,setForm]=useState({name:"",target:"",type:"savings",duration:"30"});
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  return (
    <form onSubmit={e=>{e.preventDefault();if(!form.name||!form.target)return;onSubmit({...form,target:Number(form.target),duration:Number(form.duration)});}} style={{display:"flex",flexDirection:"column",gap:14}}>
      <GInput label="Challenge Name *" value={form.name} onChange={e=>set("name",e.target.value)} placeholder="e.g. No eating out for 30 days"/>
      <GInput label="Target *" type="number" value={form.target} onChange={e=>set("target",e.target.value)} min="1"/>
      <GSelect label="Type" value={form.type} onChange={e=>set("type",e.target.value)}>
        <option value="savings">Savings Challenge</option>
        <option value="spending">Spending Limit</option>
        <option value="streak">Streak Challenge</option>
      </GSelect>
      <GInput label="Duration (days)" type="number" value={form.duration} onChange={e=>set("duration",e.target.value)} min="1"/>
      <GBtn type="submit" style={{justifyContent:"center"}}>Start Challenge 🏆</GBtn>
    </form>
  );
}

function RecurringForm({ recurringList, setRecurringList, allCats }) {
  const [form,setForm]=useState({desc:"",amount:"",category:allCats[0]||"Others"});
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  return (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <form onSubmit={e=>{e.preventDefault();if(!form.desc||!form.amount)return;setRecurringList([...recurringList,{id:Date.now(),...form,amount:Number(form.amount)}]);setForm({desc:"",amount:"",category:allCats[0]||"Others"});}} style={{display:"flex",flexDirection:"column",gap:12}}>
        <GInput label="Description *" value={form.desc} onChange={e=>set("desc",e.target.value)} placeholder="e.g. Netflix, Gym"/>
        <GInput label="Amount (₹) *" type="number" value={form.amount} onChange={e=>set("amount",e.target.value)} min="1"/>
        <GSelect label="Category" value={form.category} onChange={e=>set("category",e.target.value)}>
          {allCats.map(c=><option key={c} value={c}>{c}</option>)}
        </GSelect>
        <GBtn type="submit" style={{justifyContent:"center"}}>Add Recurring 🔁</GBtn>
      </form>
      <div>
        {recurringList.map(r=>(
          <div key={r.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:"1px solid rgba(255,255,255,0.07)"}}>
            <div>
              <div style={{fontWeight:600,color:"#fff",fontSize:14}}>{r.desc}</div>
              <div style={{fontSize:12,color:"rgba(255,255,255,0.4)"}}>{r.category} • {fmtINR(r.amount)}</div>
            </div>
            <button onClick={()=>setRecurringList(recurringList.filter(x=>x.id!==r.id))} style={{background:"rgba(244,63,94,0.1)",border:"1px solid rgba(244,63,94,0.2)",borderRadius:8,width:30,height:30,cursor:"pointer",color:"#f43f5e",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center"}}>🗑️</button>
          </div>
        ))}
        {recurringList.length===0&&<div style={{color:"rgba(255,255,255,0.3)",textAlign:"center",padding:"16px 0"}}>No recurring expenses yet</div>}
      </div>
    </div>
  );
}

function CustomCatForm({ customCats, setCustomCats }) {
  const [val,setVal]=useState("");
  return (
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <form onSubmit={e=>{e.preventDefault();if(!val.trim())return;setCustomCats([...customCats,val.trim()]);setVal("");}} style={{display:"flex",gap:10}}>
        <GInput value={val} onChange={e=>setVal(e.target.value)} placeholder="New category name" style={{flex:1}}/>
        <GBtn type="submit" style={{flexShrink:0}}>Add</GBtn>
      </form>
      <div>
        {customCats.map((c,i)=>(
          <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:"1px solid rgba(255,255,255,0.07)"}}>
            <span style={{color:"#fff",fontSize:14}}>{c}</span>
            <button onClick={()=>setCustomCats(customCats.filter((_,j)=>j!==i))} style={{background:"rgba(244,63,94,0.1)",border:"1px solid rgba(244,63,94,0.2)",borderRadius:8,width:28,height:28,cursor:"pointer",color:"#f43f5e",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center"}}>🗑️</button>
          </div>
        ))}
        {customCats.length===0&&<div style={{color:"rgba(255,255,255,0.3)",textAlign:"center",padding:"12px 0"}}>No custom categories yet</div>}
      </div>
    </div>
  );
}
