
import { useState, useMemo, useEffect, useRef, useCallback } from "react";

/* ── Responsive hook ── */
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return isMobile;
}

/* ══════════════════════════════════════════════════════════ CONSTANTS */
const CATEGORIES = [
  { id:"food",          label:"Food & Dining",         icon:"🍜", color:"#ff9f43", glow:"#ff9f4366" },
  { id:"transport",     label:"Transport & Fuel",      icon:"🚗", color:"#ffd32a", glow:"#ffd32a55" },
  { id:"entertainment", label:"Entertainment",         icon:"🎬", color:"#54a0ff", glow:"#54a0ff55" },
  { id:"shopping",      label:"Shopping & Clothing",   icon:"🛍️", color:"#cd84f1", glow:"#cd84f155" },
  { id:"subscriptions", label:"Subscriptions",         icon:"🔄", color:"#00d2d3", glow:"#00d2d355" },
  { id:"savings",       label:"Savings & Investments", icon:"💰", color:"#1dd1a1", glow:"#1dd1a155" },
];
const LOAN_TYPES = ["Home Loan","Car Loan","Personal Loan","Education Loan","Gold Loan","Business Loan","Other"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const SHORT  = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DAYS_IN_MONTH = (y,m) => new Date(y, m+1, 0).getDate();
const NOW = new Date(), THIS_YEAR = NOW.getFullYear(), THIS_MONTH = NOW.getMonth(), TODAY = NOW.getDate();
const TF = "'Times New Roman', Times, serif";

/* ── INR formatter (lakh grouping) ── */
function fmtINR(n) {
  const neg = (n??0)<0, num = Math.round(Math.abs(n??0)), s = String(num);
  if(s.length<=3) return (neg?"-":"")+"₹"+s;
  let res=s.slice(-3),rem=s.slice(0,-3);
  while(rem.length>2){res=rem.slice(-2)+","+res;rem=rem.slice(0,-2);}
  return (neg?"-":"")+"₹"+rem+","+res;
}
const uid = () => Math.random().toString(36).slice(2,9);
const load = (k,fb)=>{try{const r=localStorage.getItem(k);return r?JSON.parse(r):fb;}catch{return fb;}};
const save = (k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));}catch{}};

/* ══════════════════════════════════════════════════════════ THEME */
const THEMES = {
  dark: {
    bg:"#050c18", surface:"#0d1a2f", surface2:"#091220", border:"#1a2e4a",
    border2:"#111e30", text:"#e8f4ff", textSub:"#4a6a8a", textMuted:"#2a4060",
    inputBg:"#07111e", headerBg:"linear-gradient(135deg,#07111e,#0a1628,#0d1f38)",
    tabBg:"#07111e", scrollThumb:"#1e3a5a",
  },
  light: {
    bg:"#f0f4f8", surface:"#ffffff", surface2:"#f7fafc", border:"#d0dce8",
    border2:"#e2ecf4", text:"#0d1a2f", textSub:"#5a7a9a", textMuted:"#9ab0c8",
    inputBg:"#eef4fa", headerBg:"linear-gradient(135deg,#1a3a5c,#1e4a70,#1a3a5c)",
    tabBg:"#ffffff", scrollThumb:"#9ab0c8",
  }
};

/* ══════════════════════════════════════════════════════════ HEALTH SCORE */
function computeHealthScore({ totalIncome, totalExpenses, totalEMI, goals, savingsPct, budgets, expenses, historyMonths, allCats }) {
  if(totalIncome===0) return { score:0, grade:"—", color:"#4a6a8a", breakdown:[] };
  let score = 100;
  const breakdown = [];
  const cats = allCats || CATEGORIES;
  // 1. Savings rate (max 35 pts)
  const savRate = savingsPct;
  const savPts = Math.min(35, Math.round(savRate/100*35));
  score -= (35-savPts);
  breakdown.push({ label:"Savings Rate", pts:savPts, max:35, detail:`${Math.round(savRate)}% of income saved` });
  // 2. Budget adherence (max 30 pts)
  let budgetPts = 30;
  cats.forEach(c=>{
    const bgt = budgets[c.id];
    if(!bgt) return;
    const spent = expenses.filter(e=>e.category===c.id).reduce((s,e)=>s+e.amount,0);
    if(spent>bgt) budgetPts -= 8;
    else if(spent/bgt>0.9) budgetPts -= 3;
  });
  budgetPts = Math.max(0,budgetPts);
  score -= (30-budgetPts);
  breakdown.push({ label:"Budget Adherence", pts:budgetPts, max:30, detail: budgetPts===30?"All budgets on track":"Some budgets exceeded" });
  // 3. Goal progress (max 20 pts)
  const goalPts = goals.length===0 ? 10 : Math.min(20, goals.filter(g=>g.saved>0).length/goals.length*20);
  score -= (20-Math.round(goalPts));
  breakdown.push({ label:"Goal Progress", pts:Math.round(goalPts), max:20, detail:`${goals.filter(g=>g.saved>0).length}/${goals.length} goals funded` });
  // 4. Consistency (max 15 pts) — months with positive savings
  const conPts = historyMonths.length===0 ? 7 : Math.min(15, Math.round(historyMonths.filter(h=>h.savings>=0).length/historyMonths.length*15));
  score -= (15-conPts);
  breakdown.push({ label:"Monthly Consistency", pts:conPts, max:15, detail:`${historyMonths.filter(h=>h.savings>=0).length}/${historyMonths.length} months positive` });

  score = Math.max(0,Math.min(100,score));
  const grade = score>=85?"A+" : score>=75?"A" : score>=65?"B+" : score>=55?"B" : score>=45?"C" : "D";
  const color = score>=75?"#1dd1a1" : score>=55?"#ffd32a" : score>=40?"#ffa94d" : "#ff6b6b";
  return { score, grade, color, breakdown };
}

/* ══════════════════════════════════════════════════════════ COMPONENTS */

function AnimCounter({ value, duration=800 }) {
  const [display, setDisplay] = useState(0);
  const raf = useRef(null);
  useEffect(()=>{
    const start=display,end=value,t0=performance.now();
    const step=t=>{
      const p=Math.min((t-t0)/duration,1), e=1-Math.pow(1-p,3);
      setDisplay(Math.round(start+(end-start)*e));
      if(p<1) raf.current=requestAnimationFrame(step);
    };
    raf.current=requestAnimationFrame(step);
    return()=>cancelAnimationFrame(raf.current);
  },[value]);
  return <span>{fmtINR(display)}</span>;
}

function DonutChart({ segments, centerLabel, centerSub, theme }) {
  const [hovered, setHovered] = useState(null);
  const T = THEMES[theme];
  const total = segments.reduce((s,x)=>s+x.value,0);
  const cx=90,cy=90,r=65,stroke=22;
  const toRad=d=>(d*Math.PI)/180;
  if(total===0) return(
    <svg viewBox="0 0 180 180" style={{width:"100%",maxWidth:220}}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={T.border} strokeWidth={stroke} strokeDasharray="6 4"/>
      <text x={cx} y={cy-6} textAnchor="middle" fill={T.textMuted} fontSize="11" fontFamily={TF}>No expenses</text>
      <text x={cx} y={cy+10} textAnchor="middle" fill={T.textMuted} fontSize="11" fontFamily={TF}>this month</text>
    </svg>
  );
  let angle=-90;
  const arcs=segments.map(seg=>{
    const sweep=(seg.value/total)*356, arc={...seg,a1:angle,a2:angle+sweep};
    angle+=sweep+2; return arc;
  });
  return(
    <svg viewBox="0 0 180 180" style={{width:"100%",maxWidth:220}}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={T.border} strokeWidth={stroke}/>
      {arcs.map((arc,i)=>{
        const isH=hovered===i, rr=isH?r+4:r;
        const x1=cx+rr*Math.cos(toRad(arc.a1)),y1=cy+rr*Math.sin(toRad(arc.a1));
        const x2=cx+rr*Math.cos(toRad(arc.a2)),y2=cy+rr*Math.sin(toRad(arc.a2));
        return(<path key={i} d={`M ${x1} ${y1} A ${rr} ${rr} 0 ${arc.a2-arc.a1>180?1:0} 1 ${x2} ${y2}`}
          fill="none" stroke={arc.color} strokeWidth={isH?stroke+4:stroke} strokeLinecap="round"
          style={{filter:`drop-shadow(0 0 ${isH?12:5}px ${arc.color}${isH?"cc":"66"})`,cursor:"pointer",transition:"all .2s"}}
          onMouseEnter={()=>setHovered(i)} onMouseLeave={()=>setHovered(null)}/>);
      })}
      <circle cx={cx} cy={cy} r={r-stroke/2-3} fill={theme==="dark"?"#060d18":"#ffffff"}/>
      {hovered!==null?<>
        <text x={cx} y={cy-8} textAnchor="middle" fill={arcs[hovered].color} fontSize="9" fontWeight="700" fontFamily={TF}>{arcs[hovered].label}</text>
        <text x={cx} y={cy+7} textAnchor="middle" fill={T.text} fontSize="12" fontWeight="800" fontFamily={TF}>{fmtINR(arcs[hovered].value)}</text>
        <text x={cx} y={cy+21} textAnchor="middle" fill={T.textSub} fontSize="9" fontFamily={TF}>{Math.round((arcs[hovered].value/total)*100)}%</text>
      </>:<>
        {centerLabel&&<text x={cx} y={cy-4} textAnchor="middle" fill={T.text} fontSize="12" fontWeight="700" fontFamily={TF}>{centerLabel}</text>}
        {centerSub&&<text x={cx} y={cy+12} textAnchor="middle" fill={T.textSub} fontSize="9" fontFamily={TF}>{centerSub}</text>}
      </>}
    </svg>
  );
}

/* ── Budget Allocation Wheel ── */
function BudgetWheel({ categories, budgets, expenses, income, theme }) {
  const [hov, setHov] = useState(null);
  const T = THEMES[theme];
  const cx=100,cy=100,r=75,stroke=28;
  const toRad=d=>(d*Math.PI)/180;
  const segs = categories.map(c=>({
    ...c,
    budget: budgets[c.id]||0,
    spent:  expenses.filter(e=>e.category===c.id).reduce((s,e)=>s+e.amount,0),
  })).filter(c=>c.budget>0);
  const totalBudget = segs.reduce((s,c)=>s+c.budget,0)||income||1;
  let angle=-90;
  const arcs = segs.map(seg=>{
    const sweep=(seg.budget/totalBudget)*356;
    const spentSweep=(seg.spent/totalBudget)*356;
    const a={...seg,a1:angle,a2:angle+sweep,spentAngle:angle+Math.min(spentSweep,sweep)};
    angle+=sweep+2; return a;
  });
  if(segs.length===0) return(
    <div style={{textAlign:"center",padding:"30px 0",color:T.textMuted,fontSize:13}}>
      Set budgets first to see the allocation wheel
    </div>
  );
  return(
    <svg viewBox="0 0 200 200" style={{width:"100%",maxWidth:240}}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={T.border} strokeWidth={stroke}/>
      {arcs.map((arc,i)=>{
        const isH=hov===i,rr=r;
        // Budget arc (full allocation)
        const x1=cx+rr*Math.cos(toRad(arc.a1)),y1=cy+rr*Math.sin(toRad(arc.a1));
        const x2=cx+rr*Math.cos(toRad(arc.a2)),y2=cy+rr*Math.sin(toRad(arc.a2));
        // Spent arc overlay
        const sx2=cx+rr*Math.cos(toRad(arc.spentAngle)),sy2=cy+rr*Math.sin(toRad(arc.spentAngle));
        const spentOver = arc.spent>arc.budget;
        return(<g key={i}>
          <path d={`M ${x1} ${y1} A ${rr} ${rr} 0 ${arc.a2-arc.a1>180?1:0} 1 ${x2} ${y2}`}
            fill="none" stroke={arc.color+"44"} strokeWidth={isH?stroke+6:stroke} strokeLinecap="round"
            style={{cursor:"pointer",transition:"all .2s"}}
            onMouseEnter={()=>setHov(i)} onMouseLeave={()=>setHov(null)}/>
          <path d={`M ${x1} ${y1} A ${rr} ${rr} 0 ${arc.spentAngle-arc.a1>180?1:0} 1 ${sx2} ${sy2}`}
            fill="none" stroke={spentOver?"#ff6b6b":arc.color} strokeWidth={isH?stroke+6:stroke} strokeLinecap="round"
            style={{filter:`drop-shadow(0 0 6px ${arc.color}66)`,transition:"all .2s"}}/>
        </g>);
      })}
      <circle cx={cx} cy={cy} r={r-stroke/2-3} fill={theme==="dark"?"#060d18":"#ffffff"}/>
      {hov!==null?<>
        <text x={cx} y={cy-10} textAnchor="middle" fill={arcs[hov].color} fontSize="9" fontFamily={TF}>{arcs[hov].label}</text>
        <text x={cx} y={cy+5} textAnchor="middle" fill={T.text} fontSize="11" fontWeight="800" fontFamily={TF}>{fmtINR(arcs[hov].spent)}</text>
        <text x={cx} y={cy+19} textAnchor="middle" fill={T.textSub} fontSize="8" fontFamily={TF}>of {fmtINR(arcs[hov].budget)}</text>
      </>:<>
        <text x={cx} y={cy-4} textAnchor="middle" fill={T.text} fontSize="10" fontWeight="700" fontFamily={TF}>Budget</text>
        <text x={cx} y={cy+12} textAnchor="middle" fill={T.textSub} fontSize="8" fontFamily={TF}>Wheel</text>
      </>}
    </svg>
  );
}

/* ── Spending Heatmap Calendar ── */
function HeatmapCalendar({ year, month, expenses, theme }) {
  const T = THEMES[theme];
  const days = DAYS_IN_MONTH(year,month);
  const firstDay = new Date(year,month,1).getDay();
  const dayTotals = {};
  expenses.forEach(e=>{
    if(e.date==="Recurring") return;
    const d = parseInt((e.date||"").split("/")[0]);
    if(d>=1&&d<=days) dayTotals[d]=(dayTotals[d]||0)+e.amount;
  });
  const maxDay = Math.max(...Object.values(dayTotals),1);
  const cells = [];
  for(let i=0;i<firstDay;i++) cells.push(null);
  for(let d=1;d<=days;d++) cells.push(d);
  const getColor=(amt,isToday)=>{
    if(isToday&&!amt) return theme==="dark"?"#1a2e4a":"#d0e4f4";
    if(!amt) return theme==="dark"?"#0a1525":"#f0f4f8";
    const pct=amt/maxDay;
    if(pct>0.8) return "#ff6b6b";
    if(pct>0.6) return "#ffa94d";
    if(pct>0.4) return "#ffd32a";
    if(pct>0.2) return "#54a0ff";
    return "#1dd1a1";
  };
  return(
    <div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3,marginBottom:6}}>
        {["Su","Mo","Tu","We","Th","Fr","Sa"].map(d=>(
          <div key={d} style={{textAlign:"center",fontSize:9,color:T.textSub,fontFamily:TF,padding:"2px 0"}}>{d}</div>
        ))}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3}}>
        {cells.map((d,i)=>{
          if(!d) return <div key={`e${i}`}/>;
          const amt=dayTotals[d]||0;
          const isToday=d===TODAY&&month===THIS_MONTH&&year===THIS_YEAR;
          return(
            <div key={d} title={amt?`${d}: ${fmtINR(amt)}`:`${d}: No expenses`}
              style={{
                aspectRatio:"1",borderRadius:4,background:getColor(amt,isToday),
                display:"flex",alignItems:"center",justifyContent:"center",
                fontSize:9,color:amt>0?"#ffffff":T.textMuted,fontFamily:TF,
                cursor:"default",border:isToday?"2px solid #1dd1a1":"1px solid transparent",
                transition:"transform .15s",boxSizing:"border-box",
              }}
              onMouseEnter={e=>e.currentTarget.style.transform="scale(1.2)"}
              onMouseLeave={e=>e.currentTarget.style.transform="scale(1)"}
            >{d}</div>
          );
        })}
      </div>
      <div style={{display:"flex",gap:8,marginTop:10,alignItems:"center",flexWrap:"wrap"}}>
        <span style={{fontSize:10,color:T.textSub}}>Low</span>
        {["#1dd1a1","#54a0ff","#ffd32a","#ffa94d","#ff6b6b"].map(c=>(
          <div key={c} style={{width:14,height:14,borderRadius:3,background:c}}/>
        ))}
        <span style={{fontSize:10,color:T.textSub}}>High</span>
      </div>
    </div>
  );
}

/* ── Trend Bar ── */
function TrendBar({ label, income, expenses, maxVal, isActive, onClick }) {
  const [hov,setHov]=useState(false);
  const iP=maxVal>0?(income/maxVal)*100:0, eP=maxVal>0?(expenses/maxVal)*100:0;
  return(
    <div onClick={onClick} onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:5,flex:1,position:"relative"}}>
      {hov&&<div style={{position:"absolute",bottom:"110%",left:"50%",transform:"translateX(-50%)",background:"#0e1e35",border:"1px solid #1e3a5a",borderRadius:8,padding:"6px 10px",zIndex:10,whiteSpace:"nowrap",pointerEvents:"none"}}>
        <div style={{fontSize:10,color:"#1dd1a1",fontFamily:TF}}>↑ {fmtINR(income)}</div>
        <div style={{fontSize:10,color:"#ff6b6b",fontFamily:TF}}>↓ {fmtINR(expenses)}</div>
      </div>}
      <div style={{position:"relative",width:"100%",height:100,display:"flex",alignItems:"flex-end",justifyContent:"center",gap:3}}>
        <div style={{width:"42%",height:`${iP}%`,minHeight:income>0?4:0,background:"linear-gradient(180deg,#1dd1a1,#10ac84)",borderRadius:"4px 4px 0 0",transition:"height .5s cubic-bezier(.34,1.56,.64,1)",boxShadow:isActive?"0 0 8px #1dd1a166":"none",opacity:isActive||hov?1:0.5}}/>
        <div style={{width:"42%",height:`${eP}%`,minHeight:expenses>0?4:0,background:"linear-gradient(180deg,#ff6b6b,#c0392b)",borderRadius:"4px 4px 0 0",transition:"height .5s cubic-bezier(.34,1.56,.64,1)",boxShadow:isActive?"0 0 8px #ff6b6b66":"none",opacity:isActive||hov?1:0.5}}/>
        {isActive&&<div style={{position:"absolute",inset:0,border:"1.5px solid #1dd1a144",borderRadius:6,background:"#1dd1a108",pointerEvents:"none"}}/>}
      </div>
      <span style={{fontSize:9,color:isActive?"#1dd1a1":hov?"#c8d8f0":"#3a5575",fontFamily:TF,fontWeight:isActive?700:400,transition:"color .2s"}}>{label}</span>
    </div>
  );
}

/* ── Stat Card ── */
function StatCard({ title, value, sub, accent, icon, extra, theme }) {
  const [hov,setHov]=useState(false);
  const T=THEMES[theme];
  return(
    <div onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{position:"relative",borderRadius:20,padding:"22px 24px",background:`linear-gradient(135deg,${T.surface},${T.surface2})`,border:`1px solid ${hov?accent+"55":T.border}`,boxShadow:hov?`0 8px 32px ${accent}22,0 0 0 1px ${accent}22`:"0 2px 12px #00000033",transition:"all .3s",overflow:"hidden"}}>
      <div style={{position:"absolute",top:-30,right:-30,width:120,height:120,borderRadius:"50%",background:accent+"15",filter:"blur(30px)",pointerEvents:"none",opacity:hov?1:0.4,transition:"opacity .3s"}}/>
      <div style={{position:"relative"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
          <span style={{fontSize:11,fontWeight:700,color:T.textSub,letterSpacing:"0.12em",textTransform:"uppercase",fontFamily:TF}}>{title}</span>
          <div style={{width:36,height:36,borderRadius:10,background:accent+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,border:`1px solid ${accent}33`}}>{icon}</div>
        </div>
        <div style={{fontSize:30,fontWeight:800,color:accent,letterSpacing:"-1px",fontFamily:TF,lineHeight:1}}>
          <AnimCounter value={value}/>
        </div>
        {sub&&<div style={{fontSize:12,color:T.textSub,marginTop:6,fontFamily:TF}}>{sub}</div>}
        {extra}
      </div>
    </div>
  );
}

/* ── Swipeable Expense Row ── */
function SwipeRow({ expense, onDelete, theme, categories }) {
  const T=THEMES[theme];
  const cat=categories.find(c=>c.id===expense.category)||categories[0]||{icon:"📦",label:"Other",color:"#a29bfe",glow:"#a29bfe55"};
  const [offset,setOffset]=useState(0);
  const [swiped,setSwiped]=useState(false);
  const startX=useRef(null);
  const THRESHOLD=80;
  const onTouchStart=e=>{ startX.current=e.touches[0].clientX; };
  const onTouchMove=e=>{
    if(startX.current===null) return;
    const dx=e.touches[0].clientX-startX.current;
    if(dx<0) setOffset(Math.max(dx,-THRESHOLD*1.5));
  };
  const onTouchEnd=()=>{
    if(offset<-THRESHOLD){ setSwiped(true); setTimeout(()=>onDelete(expense.id),300); }
    else setOffset(0);
    startX.current=null;
  };
  return(
    <div style={{position:"relative",overflow:"hidden",borderRadius:13,marginBottom:6}}>
      {/* Red delete bg revealed by swipe */}
      <div style={{position:"absolute",right:0,top:0,bottom:0,width:80,background:"linear-gradient(135deg,#c0392b,#ff6b6b)",display:"flex",alignItems:"center",justifyContent:"center",borderRadius:"0 13px 13px 0"}}>
        <span style={{color:"#fff",fontSize:20}}>🗑️</span>
      </div>
      <div className="row-item"
        onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
        style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"11px 16px",background:swiped?"#ff6b6b22":`linear-gradient(135deg,${T.surface},${T.surface2})`,borderRadius:13,border:`1px solid ${T.border2}`,transition:offset===0?"all .3s":"none",transform:`translateX(${swiped?-100:offset}px)`,opacity:swiped?0:1,cursor:"default"}}>
        <div style={{display:"flex",gap:12,alignItems:"center"}}>
          <div style={{width:38,height:38,borderRadius:11,background:cat.color+"22",border:`1px solid ${cat.color}44`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>{cat.icon}</div>
          <div>
            <div style={{fontSize:14,color:T.text,fontWeight:600}}>{expense.description}</div>
            <div style={{fontSize:11,color:T.textMuted,marginTop:2}}>{expense.date}{expense.recurringId?" · 🔄 recurring":""}{expense.goalId?" · 🎯 goal":""}</div>
          </div>
        </div>
        <div style={{display:"flex",gap:10,alignItems:"center"}}>
          <span style={{display:"inline-flex",alignItems:"center",padding:"3px 10px",borderRadius:20,background:cat.color+"22",color:cat.color,fontSize:11,fontWeight:700}}>{cat.label}</span>
          <span style={{fontWeight:800,color:T.text,minWidth:90,textAlign:"right",fontSize:15}}>{fmtINR(expense.amount)}</span>
          <button style={{background:"#ff6b6b18",border:"none",color:"#ff6b6b",borderRadius:8,width:28,height:28,cursor:"pointer",fontSize:12}}
            onClick={()=>onDelete(expense.id)}>✕</button>
        </div>
      </div>
    </div>
  );
}

/* ── Modal ── */
function Modal({ show, onClose, title, subtitle, children, maxWidth=480 }) {
  if(!show) return null;
  return(
    <div className="vatsu-modal-inner" style={{position:"fixed",inset:0,zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:20}} onClick={onClose}>
      <div style={{position:"absolute",inset:0,background:"rgba(4,9,20,0.8)",backdropFilter:"blur(8px)"}}/>
      <div className="vatsu-modal-box" style={{position:"relative",width:"100%",maxWidth,maxHeight:"90vh",overflowY:"auto",background:"linear-gradient(135deg,#0d1a30,#091525)",border:"1px solid #1e3555",borderRadius:24,boxShadow:"0 24px 80px #00000088",padding:"28px 30px",animation:"modalIn .25s cubic-bezier(.34,1.56,.64,1)"}} onClick={e=>e.stopPropagation()}>
        {/* Pull handle for mobile sheet */}
        <div style={{width:40,height:4,borderRadius:99,background:"#2a4a6a",margin:"0 auto 20px",display:"block"}}/>
        <div style={{position:"absolute",top:0,left:30,right:30,height:2,background:"linear-gradient(90deg,transparent,#1dd1a1,transparent)",borderRadius:99}}/>
        <div style={{fontSize:20,fontWeight:800,color:"#e8f4ff",marginBottom:subtitle?4:20,fontFamily:TF}}>{title}</div>
        {subtitle&&<div style={{fontSize:12,color:"#4a6a8a",marginBottom:22,fontFamily:TF}}>{subtitle}</div>}
        {children}
      </div>
    </div>
  );
}

/* ── Field / Btn ── */
const mkInput=(theme)=>({background:THEMES[theme].inputBg,border:`1px solid ${THEMES[theme].border}`,borderRadius:12,padding:"11px 14px",color:THEMES[theme].text,fontSize:14,fontFamily:TF,width:"100%",outline:"none",transition:"border-color .2s"});
function Field({label,children,theme}){const T=THEMES[theme||"dark"];return <div><label style={{fontSize:12,color:T.textSub,fontWeight:600,marginBottom:6,display:"block",fontFamily:TF}}>{label}</label>{children}</div>;}
function Btn({variant="ghost",onClick,children,style={},full}){
  const base={padding:"10px 20px",borderRadius:12,border:"none",cursor:"pointer",fontSize:13,fontWeight:700,fontFamily:TF,transition:"all .2s",width:full?"100%":undefined,...style};
  const themes={primary:{background:"linear-gradient(135deg,#1dd1a1,#10ac84)",color:"#060d18",boxShadow:"0 4px 20px #1dd1a144"},danger:{background:"#ff6b6b18",color:"#ff6b6b",border:"1px solid #ff6b6b33"},ghost:{background:"#1a2e4a",color:"#7ab0d0"},orange:{background:"linear-gradient(135deg,#ffa94d,#e67e22)",color:"#060d18",boxShadow:"0 4px 20px #ffa94d44"},purple:{background:"linear-gradient(135deg,#cd84f1,#9b59b6)",color:"#fff",boxShadow:"0 4px 20px #cd84f144"}};
  return <button style={{...base,...themes[variant]}} onClick={onClick}>{children}</button>;
}

/* ── Toast ── */
function Toast({show}){
  return(<div style={{position:"fixed",bottom:28,right:28,zIndex:9999,background:"linear-gradient(135deg,#0a2018,#071510)",border:"1px solid #1dd1a155",borderRadius:14,padding:"11px 20px",display:"flex",alignItems:"center",gap:10,opacity:show?1:0,transform:show?"translateY(0)":"translateY(12px)",transition:"all .35s cubic-bezier(.34,1.56,.64,1)",pointerEvents:"none",boxShadow:"0 8px 32px #00000066"}}>
    <div style={{width:22,height:22,borderRadius:"50%",background:"#1dd1a1",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12}}>✓</div>
    <span style={{color:"#1dd1a1",fontSize:13,fontWeight:600,fontFamily:TF}}>Vatsu saved your data</span>
  </div>);
}

/* ══════════════════════════════════════════════════════════ AI ADVISOR */
function AIAdvisor({ monthlyData, goals, loans, activeMonth, activeYear, theme, allCats }) {
  const T=THEMES[theme];
  const [messages,setMessages]=useState([{role:"assistant",content:"👋 Hi! I'm your Vatsu AI Advisor. I can analyse your spending, suggest savings strategies, and answer any finance questions. What would you like to know?"}]);
  const [input,setInput]=useState("");
  const [loading,setLoading]=useState(false);
  const bottomRef=useRef(null);
  useEffect(()=>{bottomRef.current?.scrollIntoView({behavior:"smooth"});},[messages]);

  const monthKey=`${activeYear}-${activeMonth}`;
  const mData=monthlyData[monthKey]||{incomeSources:[],expenses:[],budgets:{}};
  const totalInc=mData.incomeSources.reduce((s,x)=>s+x.amount,0);
  const totalExp=mData.expenses.reduce((s,x)=>s+x.amount,0);
  const cats = allCats || CATEGORIES;
  const catBreakdown=cats.map(c=>({label:c.label,spent:mData.expenses.filter(e=>e.category===c.id).reduce((s,e)=>s+e.amount,0)})).filter(c=>c.spent>0);

  async function send() {
    if(!input.trim()||loading) return;
    const userMsg={role:"user",content:input.trim()};
    setMessages(p=>[...p,userMsg]);
    setInput(""); setLoading(true);
    const context = `You are Vatsu's AI Financial Advisor, a friendly Indian personal finance expert. The user's financial data for ${MONTHS[activeMonth]}:
- Income: ${fmtINR(totalInc)}
- Total Expenses: ${fmtINR(totalExp)}
- Remaining: ${fmtINR(totalInc-totalExp)}
- Category breakdown: ${catBreakdown.map(c=>`${c.label}: ${fmtINR(c.spent)}`).join(", ")||"None"}
- Active loans: ${loans.length}, Goals: ${goals.length}
Give concise, actionable, encouraging advice. Use INR (₹). Keep response under 150 words. Be warm and motivating.`;
    try {
      const res=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:300,system:context,messages:[...messages,userMsg].filter(m=>m.role!=="assistant"||m!==messages[0]).map(m=>({role:m.role,content:m.content}))})});
      const data=await res.json();
      const reply=data.content?.[0]?.text||"Sorry, I couldn't get a response. Please try again.";
      setMessages(p=>[...p,{role:"assistant",content:reply}]);
    } catch {
      setMessages(p=>[...p,{role:"assistant",content:"I'm having trouble connecting right now. Please try again in a moment."}]);
    }
    setLoading(false);
  }

  const quickQ=["How can I save more this month?","Where am I overspending?","Tips to reduce food expenses","How to build an emergency fund?"];

  return(
    <div className="ai-advisor-wrap" style={{display:"flex",flexDirection:"column",height:520,background:`linear-gradient(135deg,${T.surface},${T.surface2})`,border:`1px solid ${T.border}`,borderRadius:20,overflow:"hidden"}}>
      {/* Header */}
      <div style={{padding:"16px 20px",background:"linear-gradient(135deg,#0a1e35,#071525)",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",gap:12}}>
        <div style={{width:40,height:40,borderRadius:"50%",background:"linear-gradient(135deg,#1dd1a1,#10ac84)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,boxShadow:"0 0 16px #1dd1a155"}}>🤖</div>
        <div>
          <div style={{fontWeight:700,color:"#e8f4ff",fontFamily:TF}}>Vatsu AI Advisor</div>
          <div style={{fontSize:11,color:"#1dd1a1"}}>● Powered by Claude · Always available</div>
        </div>
      </div>
      {/* Messages */}
      <div style={{flex:1,overflowY:"auto",padding:"16px 20px",display:"flex",flexDirection:"column",gap:12}}>
        {messages.map((m,i)=>(
          <div key={i} style={{display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start"}}>
            <div style={{maxWidth:"80%",padding:"10px 14px",borderRadius:m.role==="user"?"16px 16px 4px 16px":"16px 16px 16px 4px",background:m.role==="user"?"linear-gradient(135deg,#1dd1a1,#10ac84)":"linear-gradient(135deg,#1a2e4a,#111e30)",color:m.role==="user"?"#060d18":"#c8d8f0",fontSize:13,fontFamily:TF,lineHeight:1.6,boxShadow:`0 2px 8px ${m.role==="user"?"#1dd1a133":"#00000033"}`}}>
              {m.content}
            </div>
          </div>
        ))}
        {loading&&<div style={{display:"flex",gap:6,padding:"10px 14px",background:"linear-gradient(135deg,#1a2e4a,#111e30)",borderRadius:"16px 16px 16px 4px",width:"fit-content"}}>
          {[0,1,2].map(i=><div key={i} style={{width:7,height:7,borderRadius:"50%",background:"#4a6a8a",animation:`pulse 1.2s ${i*0.2}s infinite`}}/>)}
        </div>}
        <div ref={bottomRef}/>
      </div>
      {/* Quick suggestions */}
      <div style={{padding:"8px 16px",display:"flex",gap:6,overflowX:"auto",borderTop:`1px solid ${T.border}`}}>
        {quickQ.map(q=>(
          <button key={q} onClick={()=>{setInput(q);}} style={{whiteSpace:"nowrap",padding:"6px 12px",borderRadius:20,border:`1px solid ${T.border}`,background:"transparent",color:T.textSub,fontSize:11,cursor:"pointer",fontFamily:TF,transition:"all .2s"}}
            onMouseEnter={e=>{e.target.style.borderColor="#1dd1a1";e.target.style.color="#1dd1a1";}}
            onMouseLeave={e=>{e.target.style.borderColor=T.border;e.target.style.color=T.textSub;}}>{q}</button>
        ))}
      </div>
      {/* Input */}
      <div style={{padding:"12px 16px",borderTop:`1px solid ${T.border}`,display:"flex",gap:10}}>
        <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()}
          placeholder="Ask about your finances…"
          style={{...mkInput(theme),flex:1,padding:"10px 14px"}}/>
        <Btn variant="primary" onClick={send} style={{padding:"10px 18px",whiteSpace:"nowrap"}}>{loading?"…":"Send ➤"}</Btn>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════ SMART INSIGHTS */
function SmartInsights({ monthlyData, activeMonth, activeYear, historyMonths, theme, allCats }) {
  const T=THEMES[theme];
  const monthKey=`${activeYear}-${activeMonth}`;
  const cur=monthlyData[monthKey]||{incomeSources:[],expenses:[],budgets:{}};
  const cats = allCats || CATEGORIES;
  const insights=useMemo(()=>{
    const list=[];
    const prevKey=activeMonth===0?`${activeYear-1}-11`:`${activeYear}-${activeMonth-1}`;
    const prev=monthlyData[prevKey]||{expenses:[]};
    // 1. Biggest spending category
    const catTotals=cats.map(c=>({...c,amt:cur.expenses.filter(e=>e.category===c.id).reduce((s,e)=>s+e.amount,0)})).sort((a,b)=>b.amt-a.amt);
    if(catTotals[0].amt>0) list.push({type:"top",icon:"📊",title:"Top Category",msg:`Your highest spend is ${catTotals[0].label} at ${fmtINR(catTotals[0].amt)} this month.`,color:"#54a0ff"});
    // 2. Month-over-month change
    const curTotal=cur.expenses.reduce((s,e)=>s+e.amount,0);
    const prevTotal=prev.expenses.reduce((s,e)=>s+e.amount,0);
    if(prevTotal>0){
      const delta=curTotal-prevTotal, pct=Math.round(Math.abs(delta)/prevTotal*100);
      if(Math.abs(pct)>10) list.push({type:delta>0?"warn":"good",icon:delta>0?"📈":"📉",title:`Spend ${delta>0?"Up":"Down"} vs Last Month`,msg:`You've spent ${pct}% ${delta>0?"more":"less"} than last month. ${delta>0?"Consider reviewing your expenses.":"Great job controlling costs!"}`,color:delta>0?"#ffa94d":"#1dd1a1"});
    }
    // 3. Subscription check
    const subTotal=cur.expenses.filter(e=>e.category==="subscriptions").reduce((s,e)=>s+e.amount,0);
    if(subTotal>0) list.push({type:"info",icon:"🔄",title:"Subscription Check",msg:`You're spending ${fmtINR(subTotal)} on subscriptions. Review for unused services.`,color:"#00d2d3"});
    // 4. Savings rate
    const inc=cur.incomeSources.reduce((s,x)=>s+x.amount,0);
    const savAmt=cur.expenses.filter(e=>e.category==="savings").reduce((s,e)=>s+e.amount,0);
    if(inc>0){
      const rate=savAmt/inc*100;
      if(rate<20&&rate>=0) list.push({type:"warn",icon:"💡",title:"Savings Rate Low",msg:`You're saving ${Math.round(rate)}% of income. Financial experts recommend at least 20%. Try to increase by ${fmtINR(Math.round(inc*0.2-savAmt))}.`,color:"#ffd32a"});
      else if(rate>=20) list.push({type:"good",icon:"🌟",title:"Excellent Savings Rate!",msg:`You're saving ${Math.round(rate)}% of income — well above the 20% benchmark. Keep it up!`,color:"#1dd1a1"});
    }
    // 5. Anomaly: single large expense
    const largeExp=cur.expenses.filter(e=>inc>0&&e.amount>inc*0.15&&e.category!=="savings");
    if(largeExp.length>0) list.push({type:"warn",icon:"⚡",title:"Large Expense Detected",msg:`"${largeExp[0].description}" (${fmtINR(largeExp[0].amount)}) is over 15% of your monthly income.`,color:"#ffa94d"});
    return list.slice(0,5);
  },[cur,monthlyData,activeMonth,activeYear]);

  if(insights.length===0) return(
    <div style={{textAlign:"center",padding:"30px 0",color:T.textMuted}}>
      <div style={{fontSize:32,marginBottom:8}}>🔍</div>
      <div>Add income and expenses to generate insights</div>
    </div>
  );
  return(
    <div style={{display:"flex",flexDirection:"column",gap:10}}>
      {insights.map((ins,i)=>(
        <div key={i} style={{display:"flex",gap:14,padding:"14px 18px",background:`linear-gradient(135deg,${T.surface},${T.surface2})`,border:`1px solid ${ins.color}33`,borderRadius:14,borderLeft:`3px solid ${ins.color}`,animation:`slideIn .3s ${i*0.08}s both`}}>
          <span style={{fontSize:22,flexShrink:0}}>{ins.icon}</span>
          <div>
            <div style={{fontWeight:700,color:ins.color,fontSize:13,marginBottom:4,fontFamily:TF}}>{ins.title}</div>
            <div style={{fontSize:12,color:T.textSub,lineHeight:1.6,fontFamily:TF}}>{ins.msg}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════ CHALLENGES */
const CHALLENGE_TEMPLATES = [
  {id:"no_food_out",  label:"No Eating Out Week",    icon:"🥗", desc:"Avoid restaurants & food delivery for 7 days", target:"food",    limit:0,  duration:7  },
  {id:"50_rule",      label:"50% Rule Month",         icon:"⚖️", desc:"Keep expenses under 50% of income",         target:"total",   limit:50, duration:30 },
  {id:"sub_audit",    label:"Subscription Audit",     icon:"✂️", desc:"Reduce subscriptions by 20% this month",    target:"subs",    limit:20, duration:30 },
  {id:"save_10k",     label:"Save ₹10,000 Challenge", icon:"🏆", desc:"Contribute ₹10,000 to a goal this month",   target:"savings", limit:10000,duration:30},
  {id:"transport",    label:"Green Commute Week",     icon:"🚲", desc:"Halve your transport spending for 7 days",  target:"transport",limit:50,duration:7  },
];

function ChallengesTab({ monthlyData, activeMonth, activeYear, challenges, setChallenges, theme }) {
  const T=THEMES[theme];
  const monthKey=`${activeYear}-${activeMonth}`;
  const cur=monthlyData[monthKey]||{incomeSources:[],expenses:[],budgets:{}};
  const inc=cur.incomeSources.reduce((s,x)=>s+x.amount,0);

  function joinChallenge(tpl) {
    if(challenges.find(c=>c.id===tpl.id&&c.month===activeMonth&&c.year===activeYear)) return;
    setChallenges(p=>[...p,{...tpl,month:activeMonth,year:activeYear,joined:new Date().toLocaleDateString("en-IN")}]);
  }
  function getProgress(c) {
    if(c.target==="food") return cur.expenses.filter(e=>e.category==="food"&&!e.recurringId).reduce((s,e)=>s+e.amount,0);
    if(c.target==="total") return inc>0?(cur.expenses.reduce((s,e)=>s+e.amount,0)/inc*100):0;
    if(c.target==="subs") return cur.expenses.filter(e=>e.category==="subscriptions").reduce((s,e)=>s+e.amount,0);
    if(c.target==="savings") return cur.expenses.filter(e=>e.category==="savings").reduce((s,e)=>s+e.amount,0);
    if(c.target==="transport") return cur.expenses.filter(e=>e.category==="transport").reduce((s,e)=>s+e.amount,0);
    return 0;
  }
  function isCompleted(c) {
    const prog=getProgress(c);
    if(c.target==="food") return prog===0;
    if(c.target==="total") return prog<=c.limit;
    if(c.target==="sub_audit") return true;
    if(c.target==="savings") return prog>=c.limit;
    if(c.target==="transport") return true;
    return false;
  }
  const activeChallenges=challenges.filter(c=>c.month===activeMonth&&c.year===activeYear);

  return(
    <div style={{display:"flex",flexDirection:"column",gap:20}}>
      {/* Active challenges */}
      {activeChallenges.length>0&&(
        <div>
          <div style={{fontSize:11,fontWeight:700,color:T.textSub,letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:12,fontFamily:TF}}>Active Challenges — {MONTHS[activeMonth]}</div>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {activeChallenges.map(c=>{
              const done=isCompleted(c);
              return(
                <div key={c.id} style={{padding:"16px 20px",background:`linear-gradient(135deg,${T.surface},${T.surface2})`,border:`1px solid ${done?"#1dd1a155":T.border}`,borderRadius:16,display:"flex",gap:14,alignItems:"center"}}>
                  <span style={{fontSize:28}}>{c.icon}</span>
                  <div style={{flex:1}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                      <span style={{fontWeight:700,color:T.text,fontFamily:TF}}>{c.label}</span>
                      {done?<span style={{padding:"3px 10px",borderRadius:20,background:"#1dd1a122",color:"#1dd1a1",fontSize:11,fontWeight:700}}>🎉 Completed!</span>
                        :<span style={{padding:"3px 10px",borderRadius:20,background:"#ffa94d22",color:"#ffa94d",fontSize:11}}>In Progress</span>}
                    </div>
                    <div style={{fontSize:12,color:T.textSub,fontFamily:TF}}>{c.desc}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {/* Available challenges */}
      <div>
        <div style={{fontSize:11,fontWeight:700,color:T.textSub,letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:12,fontFamily:TF}}>Available Challenges</div>
        <div className="grid-auto" style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:14}}>
          {CHALLENGE_TEMPLATES.map(tpl=>{
            const already=activeChallenges.find(c=>c.id===tpl.id);
            return(
              <div key={tpl.id} style={{padding:"20px",background:`linear-gradient(135deg,${T.surface},${T.surface2})`,border:`1px solid ${already?"#1dd1a133":T.border}`,borderRadius:16,position:"relative",overflow:"hidden"}}>
                <div style={{position:"absolute",top:-15,right:-15,width:80,height:80,borderRadius:"50%",background:"#1dd1a108",filter:"blur(20px)"}}/>
                <div style={{fontSize:32,marginBottom:10}}>{tpl.icon}</div>
                <div style={{fontWeight:700,color:T.text,fontSize:15,marginBottom:6,fontFamily:TF}}>{tpl.label}</div>
                <div style={{fontSize:12,color:T.textSub,marginBottom:14,lineHeight:1.6,fontFamily:TF}}>{tpl.desc}</div>
                <div style={{fontSize:11,color:T.textMuted,marginBottom:14}}>⏱ {tpl.duration} day challenge</div>
                {already
                  ?<div style={{padding:"8px 14px",borderRadius:10,background:"#1dd1a118",color:"#1dd1a1",fontSize:12,textAlign:"center",fontFamily:TF}}>✓ Already joined this month</div>
                  :<Btn variant="primary" full onClick={()=>joinChallenge(tpl)} style={{fontSize:12,padding:"9px 14px"}}>🚀 Accept Challenge</Btn>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════ HEALTH SCORE CARD */
function HealthScoreCard({ score, grade, color, breakdown, theme }) {
  const T=THEMES[theme];
  const circumference=2*Math.PI*44;
  const dashOffset=circumference-(score/100)*circumference;
  return(
    <div style={{background:`linear-gradient(135deg,${T.surface},${T.surface2})`,border:`1px solid ${T.border}`,borderRadius:20,padding:"22px 24px"}}>
      <div style={{fontSize:11,fontWeight:700,color:T.textSub,letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:16,fontFamily:TF}}>Monthly Health Score</div>
      <div style={{display:"flex",gap:24,alignItems:"center",flexWrap:"wrap"}}>
        {/* Circular progress */}
        <div style={{position:"relative",width:110,height:110,flexShrink:0}}>
          <svg viewBox="0 0 100 100" style={{width:"100%",height:"100%",transform:"rotate(-90deg)"}}>
            <circle cx="50" cy="50" r="44" fill="none" stroke={T.border} strokeWidth="8"/>
            <circle cx="50" cy="50" r="44" fill="none" stroke={color} strokeWidth="8"
              strokeDasharray={circumference} strokeDashoffset={dashOffset}
              strokeLinecap="round" style={{transition:"stroke-dashoffset 1s ease",filter:`drop-shadow(0 0 6px ${color}66)`}}/>
          </svg>
          <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
            <span style={{fontSize:26,fontWeight:800,color,fontFamily:TF,lineHeight:1}}>{score}</span>
            <span style={{fontSize:16,fontWeight:800,color,fontFamily:TF}}>{grade}</span>
          </div>
        </div>
        {/* Breakdown bars */}
        <div style={{flex:1,display:"flex",flexDirection:"column",gap:10,minWidth:180}}>
          {breakdown.map(b=>(
            <div key={b.label}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                <span style={{fontSize:12,color:T.textSub,fontFamily:TF}}>{b.label}</span>
                <span style={{fontSize:12,fontWeight:700,color:b.pts/b.max>0.7?"#1dd1a1":b.pts/b.max>0.4?"#ffd32a":"#ff6b6b"}}>{b.pts}/{b.max}</span>
              </div>
              <div style={{height:6,background:T.border,borderRadius:99}}>
                <div style={{height:6,width:`${(b.pts/b.max)*100}%`,background:b.pts/b.max>0.7?"#1dd1a1":b.pts/b.max>0.4?"#ffd32a":"#ff6b6b",borderRadius:99,transition:"width .8s ease"}}/>
              </div>
              <div style={{fontSize:10,color:T.textMuted,marginTop:2,fontFamily:TF}}>{b.detail}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════ MAIN APP */
export default function Vatsu() {
  const isMobile = useIsMobile();
  const [monthlyData,       setMonthlyData]       = useState(()=>load("vatsu_monthly",{}));
  const [recurringExpenses, setRecurringExpenses] = useState(()=>load("vatsu_recurring",[]));
  const [goals,             setGoals]             = useState(()=>load("vatsu_goals",[]));
  const [loans,             setLoans]             = useState(()=>load("vatsu_loans",[]));
  const [challenges,        setChallenges]        = useState(()=>load("vatsu_challenges",[]));
  const [theme,             setTheme]             = useState(()=>load("vatsu_theme","dark"));
  const [customCategories,  setCustomCategories]  = useState(()=>load("vatsu_custom_cats",[]));
  const [showCatModal,      setShowCatModal]      = useState(false);
  const [catForm,           setCatForm]           = useState({ label:"", icon:"📌", color:"#a29bfe" });

  const [activeMonth,setActiveMonth]=useState(THIS_MONTH);
  const [activeYear]=useState(THIS_YEAR);
  const [tab,setTab]=useState("dashboard");
  const [toast,setToast]=useState(false);

  const [showIncomeModal,setShowIncomeModal]=useState(false);
  const [showBudgetModal,setShowBudgetModal]=useState(false);
  const [showLoanModal,  setShowLoanModal  ]=useState(false);

  const [incomeForm,setIncomeForm]=useState({label:"Monthly Salary",amount:""});
  const [expForm,   setExpForm   ]=useState({description:"",amount:"",category:"food",isRecurring:false});
  const [budgetForm,setBudgetForm]=useState({});
  const [goalForm,  setGoalForm  ]=useState({label:"",target:"",saved:""});
  const [loanForm,  setLoanForm  ]=useState({bankName:"",loanType:"Home Loan",principal:"",emi:"",interestRate:"",tenureMonths:"",startMonth:THIS_MONTH,startYear:THIS_YEAR});
  const [contributionAmounts,setContributionAmounts]=useState({});
  const [showManageCats, setShowManageCats]=useState(false);

  const T=THEMES[theme];
  const IS=mkInput(theme);

  function flash(){setToast(true);setTimeout(()=>setToast(false),2200);}
  useEffect(()=>{save("vatsu_monthly",   monthlyData);      flash();},[monthlyData]);
  useEffect(()=>{save("vatsu_recurring", recurringExpenses);flash();},[recurringExpenses]);
  useEffect(()=>{save("vatsu_goals",     goals);            flash();},[goals]);
  useEffect(()=>{save("vatsu_loans",     loans);            flash();},[loans]);
  useEffect(()=>{save("vatsu_challenges",challenges);       flash();},[challenges]);
  useEffect(()=>{save("vatsu_theme",     theme);            },[theme]);
  useEffect(()=>{save("vatsu_custom_cats",customCategories);flash();},[customCategories]);

  /* All categories = built-in + user-created */
  const allCategories = useMemo(()=>[
    ...CATEGORIES,
    ...customCategories.map(c=>({...c, glow: c.color+"55"})),
  ],[customCategories]);

  function addCustomCategory() {
    if(!catForm.label.trim()) return;
    const id = "custom_" + uid();
    setCustomCategories(p=>[...p,{
      id, label: catForm.label.trim(), icon: catForm.icon||"📌",
      color: catForm.color||"#a29bfe", isCustom: true,
    }]);
    setCatForm({ label:"", icon:"📌", color:"#a29bfe" });
    setShowCatModal(false);
    // Auto-select the new category in the expense form
    setExpForm(p=>({...p, category: id}));
  }

  function deleteCustomCategory(id) {
    setCustomCategories(p=>p.filter(c=>c.id!==id));
    // If current expense form has this category, reset to food
    setExpForm(p=>p.category===id ? {...p, category:"food"} : p);
  }

  const monthKey=`${activeYear}-${activeMonth}`;
  const currentMonth=useMemo(()=>{
    const base=monthlyData[monthKey]||{incomeSources:[],expenses:[],budgets:{}};
    const existIds=new Set(base.expenses.filter(e=>e.recurringId).map(e=>e.recurringId));
    const injected=recurringExpenses.filter(r=>!existIds.has(r.id)).map(r=>({id:uid(),description:r.description,amount:r.amount,category:r.category,date:"Recurring",recurringId:r.id}));
    return{...base,expenses:[...base.expenses,...injected]};
  },[monthlyData,monthKey,recurringExpenses]);

  const activeLoans=useMemo(()=>loans.filter(l=>{const s=l.startYear*12+l.startMonth,c=activeYear*12+activeMonth;return c>=s&&c<s+(l.tenureMonths||9999);}),[loans,activeMonth,activeYear]);
  const totalEMI     =useMemo(()=>activeLoans.reduce((s,l)=>s+l.emi,0),[activeLoans]);
  const totalIncome  =useMemo(()=>currentMonth.incomeSources.reduce((s,x)=>s+x.amount,0),[currentMonth]);
  const totalExpenses=useMemo(()=>currentMonth.expenses.reduce((s,x)=>s+x.amount,0),[currentMonth]);
  const totalOutflow =totalExpenses+totalEMI;
  const remaining    =totalIncome-totalOutflow;
  const spentPct     =totalIncome>0?Math.min(100,(totalOutflow/totalIncome)*100):0;
  const savingsPct   =totalIncome>0?Math.max(0,((totalIncome-totalOutflow)/totalIncome)*100):0;

  const categoryBreakdown=useMemo(()=>{
    const map={};
    currentMonth.expenses.forEach(e=>{map[e.category]=(map[e.category]||0)+e.amount;});
    return allCategories.filter(c=>map[c.id]>0).map(c=>({...c,value:map[c.id]}));
  },[currentMonth]);

  const warnings=useMemo(()=>{
    const b=currentMonth.budgets||{};
    return allCategories.filter(c=>{if(!b[c.id])return false;const spent=currentMonth.expenses.filter(e=>e.category===c.id).reduce((s,e)=>s+e.amount,0);return spent/b[c.id]>=0.9;}).map(c=>{const spent=currentMonth.expenses.filter(e=>e.category===c.id).reduce((s,e)=>s+e.amount,0);return{...c,spent,bgt:b[c.id],pct:Math.round((spent/b[c.id])*100)};});
  },[currentMonth,allCategories]);

  const historyMonths=useMemo(()=>Object.keys(monthlyData).map(key=>{
    const [y,m]=key.split("-").map(Number),d=monthlyData[key];
    const inc=d.incomeSources.reduce((s,x)=>s+x.amount,0);
    const existIds=new Set(d.expenses.filter(e=>e.recurringId).map(e=>e.recurringId));
    const recAmt=recurringExpenses.filter(r=>!existIds.has(r.id)).reduce((s,r)=>s+r.amount,0);
    const emiAmt=loans.filter(l=>{const ls=l.startYear*12+l.startMonth,ca=y*12+m;return ca>=ls&&ca<ls+(l.tenureMonths||9999);}).reduce((s,l)=>s+l.emi,0);
    const exp=d.expenses.reduce((s,x)=>s+x.amount,0)+recAmt+emiAmt;
    return{key,year:y,month:m,income:inc,expenses:exp,savings:inc-exp};
  }).sort((a,b)=>a.year!==b.year?a.year-b.year:a.month-b.month),[monthlyData,recurringExpenses,loans]);

  const maxHistVal=useMemo(()=>Math.max(...historyMonths.map(h=>Math.max(h.income,h.expenses)),1),[historyMonths]);

  const healthData=useMemo(()=>computeHealthScore({totalIncome,totalExpenses:totalOutflow,totalEMI,goals,savingsPct,budgets:currentMonth.budgets||{},expenses:currentMonth.expenses,historyMonths,allCats:allCategories}),[totalIncome,totalOutflow,totalEMI,goals,savingsPct,currentMonth,historyMonths,allCategories]);

  const hc=remaining<0?"#ff6b6b":spentPct>90?"#ffa94d":spentPct>70?"#ffd32a":"#1dd1a1";
  const healthMsg=remaining<0?"⚠️ Over budget!":spentPct>90?"🔴 Critical":spentPct>70?"🟡 Caution":"🟢 On track";

  /* Mutations */
  function addIncomeSource(){const amt=parseFloat(incomeForm.amount);if(!incomeForm.label.trim()||!amt||amt<=0)return;setMonthlyData(p=>{const m=p[monthKey]||{incomeSources:[],expenses:[],budgets:{}};return{...p,[monthKey]:{...m,incomeSources:[...m.incomeSources,{id:uid(),label:incomeForm.label.trim(),amount:amt}]}};});setIncomeForm({label:"Monthly Salary",amount:""});setShowIncomeModal(false);}
  function removeIncomeSource(id){setMonthlyData(p=>{const m=p[monthKey]||{incomeSources:[],expenses:[],budgets:{}};return{...p,[monthKey]:{...m,incomeSources:m.incomeSources.filter(x=>x.id!==id)}};});}
  function addExpense(){const amt=parseFloat(expForm.amount);if(!expForm.description.trim()||!amt||amt<=0)return;const ne={id:uid(),description:expForm.description.trim(),amount:amt,category:expForm.category,date:new Date().toLocaleDateString("en-IN")};if(expForm.isRecurring)setRecurringExpenses(p=>[...p,{id:uid(),description:ne.description,amount:amt,category:expForm.category}]);setMonthlyData(p=>{const m=p[monthKey]||{incomeSources:[],expenses:[],budgets:{}};return{...p,[monthKey]:{...m,expenses:[...m.expenses,ne]}};});setExpForm(f=>({description:"",amount:"",category:f.category,isRecurring:false}));}
  function deleteExpense(id){setMonthlyData(p=>{const m=p[monthKey]||{incomeSources:[],expenses:[],budgets:{}};return{...p,[monthKey]:{...m,expenses:m.expenses.filter(e=>e.id!==id)}};});}
  function saveBudgets(){const parsed={};Object.entries(budgetForm).forEach(([k,v])=>{if(v)parsed[k]=parseFloat(v)||0;});setMonthlyData(p=>{const m=p[monthKey]||{incomeSources:[],expenses:[],budgets:{}};return{...p,[monthKey]:{...m,budgets:{...m.budgets,...parsed}}};});setShowBudgetModal(false);}
  function addGoal(){const target=parseFloat(goalForm.target),saved=parseFloat(goalForm.saved)||0;if(!goalForm.label.trim()||!target||target<=0)return;setGoals(p=>[...p,{id:uid(),label:goalForm.label.trim(),target,saved}]);setGoalForm({label:"",target:"",saved:""});}
  function contributeToGoal(goalId,amtStr){const amt=parseFloat(amtStr);if(!amt||amt<=0)return;setGoals(prev=>prev.map(g=>g.id!==goalId?g:{...g,saved:Math.min(g.target,g.saved+amt)}));const goalLabel=goals.find(g=>g.id===goalId)?.label||"Goal";const ne={id:uid(),description:`🎯 Goal: ${goalLabel}`,amount:amt,category:"savings",date:new Date().toLocaleDateString("en-IN"),goalId};setMonthlyData(prev=>{const m=prev[monthKey]||{incomeSources:[],expenses:[],budgets:{}};return{...prev,[monthKey]:{...m,expenses:[...m.expenses,ne]}};});}
  function deleteGoal(id){setGoals(p=>p.filter(g=>g.id!==id));}
  function addLoan(){const principal=parseFloat(loanForm.principal),emi=parseFloat(loanForm.emi);if(!loanForm.bankName.trim()||!principal||!emi)return;setLoans(p=>[...p,{id:uid(),bankName:loanForm.bankName.trim(),loanType:loanForm.loanType,principal,emi,interestRate:parseFloat(loanForm.interestRate)||0,tenureMonths:parseInt(loanForm.tenureMonths)||0,startMonth:parseInt(loanForm.startMonth),startYear:parseInt(loanForm.startYear)}]);setLoanForm({bankName:"",loanType:"Home Loan",principal:"",emi:"",interestRate:"",tenureMonths:"",startMonth:THIS_MONTH,startYear:THIS_YEAR});setShowLoanModal(false);}
  function deleteLoan(id){setLoans(p=>p.filter(l=>l.id!==id));}

  return(
    <div style={{minHeight:"100vh",background:T.bg,color:T.text,fontFamily:TF,transition:"background .3s,color .3s"}}>
      <style>{`
        @keyframes modalIn{from{opacity:0;transform:scale(.94) translateY(20px)}to{opacity:1;transform:scale(1) translateY(0)}}
        @keyframes sheetUp{from{opacity:0;transform:translateY(100%)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulse{0%,100%{opacity:.5}50%{opacity:1}}
        @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
        @keyframes slideIn{from{opacity:0;transform:translateX(-12px)}to{opacity:1;transform:translateX(0)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        /* Scrollbars */
        ::-webkit-scrollbar{width:4px;height:4px}
        ::-webkit-scrollbar-track{background:${T.bg}}
        ::-webkit-scrollbar-thumb{background:${T.scrollThumb};border-radius:3px}

        /* Typography base */
        html { font-size: 16px; -webkit-text-size-adjust: 100%; }
        body { overscroll-behavior: none; }

        /* Inputs */
        input::placeholder{color:${T.textMuted}}
        select option{background:${T.surface};color:${T.text}}
        input[type=checkbox]{accent-color:#1dd1a1;width:16px;height:16px;cursor:pointer;flex-shrink:0}
        input:focus{border-color:#1dd1a188!important;box-shadow:0 0 0 3px #1dd1a111!important;outline:none}
        select:focus{border-color:#1dd1a188!important;outline:none}

        /* Interactive states */
        .tab-btn:hover{color:#a0c8e8!important}
        .row-item:hover{border-color:#1e3a5a!important}
        .del-btn:hover{background:#ff6b6b33!important}
        button:active{opacity:.75;transform:scale(.97)}

        /* ── RESPONSIVE GRID SYSTEM ── */
        .grid-auto { display: grid; gap: 16px; }
        .grid-auto { grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }

        /* Card base */
        .vatsu-card {
          background: linear-gradient(135deg, ${T.surface}, ${T.surface2});
          border: 1px solid ${T.border};
          border-radius: 20px;
          padding: 20px 22px;
          animation: fadeUp .3s ease both;
        }

        /* Expense row */
        .exp-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 11px 14px;
          background: ${T.surface2};
          border-radius: 13px;
          border: 1px solid ${T.border2};
          transition: border-color .2s;
          gap: 10px;
        }
        .exp-row:hover { border-color: #1e3a5a; }

        /* Bottom nav (mobile only) */
        .bottom-nav {
          display: none;
          position: fixed;
          bottom: 0; left: 0; right: 0;
          background: ${T.surface};
          border-top: 1px solid ${T.border};
          padding: 8px 4px;
          padding-bottom: max(8px, env(safe-area-inset-bottom));
          z-index: 200;
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
        }
        .bottom-nav-inner {
          display: flex;
          justify-content: space-around;
          align-items: center;
          max-width: 600px;
          margin: 0 auto;
        }
        .bnav-btn {
          display: flex; flex-direction: column; align-items: center; gap: 3px;
          padding: 6px 10px; border: none; background: none; cursor: pointer;
          border-radius: 12px; transition: all .2s; min-width: 52px;
          -webkit-tap-highlight-color: transparent;
        }
        .bnav-btn.active { background: #1dd1a122; }
        .bnav-icon { font-size: 22px; line-height: 1; }
        .bnav-label { font-size: 9px; font-weight: 600; font-family: ${TF}; }

        /* Desktop tab bar */
        .top-tabs { display: flex; }

        /* Main content padding to clear bottom nav on mobile */
        .main-content { padding: 20px 16px 90px; max-width: 1200px; margin: 0 auto; }

        /* ── MOBILE BREAKPOINT ── */
        @media (max-width: 767px) {
          html { font-size: 15px; }

          .bottom-nav { display: block; }
          .top-tabs { display: none !important; }

          /* Header compact */
          .vatsu-header {
            padding: 0 16px !important;
            flex-wrap: nowrap !important;
            gap: 8px !important;
          }
          .vatsu-logo-text { font-size: 20px !important; }
          .vatsu-month-nav { gap: 6px !important; }
          .vatsu-month-label { min-width: 130px !important; font-size: 13px !important; }
          .vatsu-score-badge { display: none !important; }
          .header-logo-sub { display: none !important; }
          .nav-btn-size { width: 30px !important; height: 30px !important; }

          /* Cards full width, tighter padding */
          .vatsu-card { border-radius: 16px !important; padding: 16px !important; }

          /* Grid: single column on mobile */
          .grid-auto { grid-template-columns: 1fr !important; gap: 12px !important; }
          .grid-2 { grid-template-columns: 1fr !important; }
          .grid-3 { grid-template-columns: 1fr !important; }
          .grid-4 { grid-template-columns: 1fr 1fr !important; gap: 10px !important; }

          /* Stat cards: 2 per row */
          .stat-grid { grid-template-columns: 1fr 1fr !important; gap: 10px !important; }
          .stat-card-num { font-size: 20px !important; }
          .stat-card-pad { padding: 14px 14px !important; }

          /* Goal form grid */
          .goal-form-grid { grid-template-columns: 1fr 1fr !important; }

          /* Expense row wrapping */
          .exp-row { padding: 10px 12px !important; }
          .exp-row-right { flex-shrink: 0; }
          .exp-pill { display: none !important; } /* hide category pill to save space */
          .exp-desc { font-size: 13px !important; }
          .exp-amt { font-size: 13px !important; min-width: 70px !important; }

          /* Forms full-width */
          .form-grid-2 { grid-template-columns: 1fr !important; }
          .loan-form-grid { grid-template-columns: 1fr 1fr !important; gap: 8px !important; }

          /* Budget wheel hide on mobile (too small) */
          .budget-wheel-card { display: none !important; }

          /* Donut chart smaller */
          .donut-wrap { flex: 0 0 140px !important; }

          /* History row compact */
          .hist-row-month { min-width: 90px !important; font-size: 12px !important; }
          .hist-row-num { min-width: 80px !important; font-size: 12px !important; }

          /* Main padding clears bottom nav */
          .main-content { padding: 16px 12px 96px !important; }

          /* AI advisor height */
          .ai-advisor-wrap { height: 440px !important; }

          /* Heatmap cells slightly bigger touch target */
          .heatmap-cell { min-height: 28px; }

          /* Warning banner */
          .warn-banner { padding: 8px 16px !important; font-size: 11px !important; }

          /* Big numbers in loans/history */
          .big-num { font-size: 22px !important; }

          /* Health score card */
          .health-ring-wrap { width: 90px !important; height: 90px !important; }
          .health-score-num { font-size: 20px !important; }

          /* Bottom sheet modals on mobile */
          .vatsu-modal-box {
            position: fixed !important;
            bottom: 0 !important; left: 0 !important; right: 0 !important;
            top: auto !important;
            max-width: 100% !important;
            border-radius: 24px 24px 0 0 !important;
            max-height: 90vh !important;
            animation: sheetUp .3s cubic-bezier(.34,1.56,.64,1) !important;
            padding-bottom: max(24px, env(safe-area-inset-bottom)) !important;
          }
          .vatsu-modal-inner {
            align-items: flex-end !important;
          }
        }

        /* ── TABLET BREAKPOINT ── */
        @media (min-width: 768px) and (max-width: 1023px) {
          .main-content { padding: 20px 20px; }
          .stat-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .grid-auto { grid-template-columns: repeat(2, 1fr) !important; }
        }

        /* Touch ripple */
        .touchable { -webkit-tap-highlight-color: transparent; touch-action: manipulation; }
      `}</style>
      <Toast show={toast}/>

      {/* HEADER */}
      <header className="vatsu-header" style={{background:T.headerBg,borderBottom:`1px solid ${T.border}`,padding:"0 32px",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:12,position:"sticky",top:0,zIndex:100,backdropFilter:"blur(12px)",boxShadow:"0 4px 24px #00000055"}}>
        <div style={{display:"flex",alignItems:"center",gap:14,padding:"12px 0"}}>
          <div style={{animation:"float 4s ease-in-out infinite"}}>
            <svg width="44" height="44" viewBox="0 0 50 50" fill="none">
              <defs>
                <radialGradient id="cg" cx="35%" cy="30%" r="70%"><stop offset="0%" stopColor="#ffe066"/><stop offset="50%" stopColor="#f4c542"/><stop offset="100%" stopColor="#b8860b"/></radialGradient>
                <filter id="glow"><feGaussianBlur stdDeviation="2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
              </defs>
              <circle cx="25" cy="25" r="23" stroke="#1dd1a1" strokeWidth="1" strokeDasharray="5 3" opacity="0.6" style={{animation:"pulse 3s ease-in-out infinite"}}/>
              <circle cx="25" cy="25" r="20" fill="url(#cg)" filter="url(#glow)"/>
              <ellipse cx="19" cy="18" rx="5" ry="3" fill="white" opacity="0.18" transform="rotate(-25 19 18)"/>
              <text x="25" y="31" textAnchor="middle" fontSize="17" fontWeight="900" fill="#7a5c00" fontFamily={TF}>₹</text>
              <rect x="32" y="36" width="2.5" height="5" rx="1" fill="#1dd1a1"/>
              <rect x="35.5" y="33" width="2.5" height="8" rx="1" fill="#1dd1a1"/>
              <rect x="39" y="29" width="2.5" height="12" rx="1" fill="#1dd1a1"/>
              <polyline points="32,32 35.5,28 39,29" stroke="#1dd1a1" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
            </svg>
          </div>
          <div>
            <div className="vatsu-logo-text" style={{fontSize:26,fontWeight:800,color:theme==="dark"?"#e8f4ff":"#ffffff",fontFamily:TF,lineHeight:1,letterSpacing:"-0.5px"}}>Vatsu<span style={{color:"#1dd1a1"}}>.</span></div>
            <div className="header-logo-sub" style={{fontSize:9,color:theme==="dark"?"#2a4a6a":"#a0c8e8",letterSpacing:"0.22em",textTransform:"uppercase",marginTop:2}}>Personal Finance</div>
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:10,padding:"12px 0"}}>
          {/* Health score mini badge */}
          <div className="vatsu-score-badge" style={{padding:"6px 12px",borderRadius:20,background:healthData.color+"22",border:`1px solid ${healthData.color}44`,display:"flex",alignItems:"center",gap:6}}>
            <span style={{fontSize:11,color:healthData.color,fontWeight:700}}>Score {healthData.score}</span>
            <span style={{fontSize:13,fontWeight:800,color:healthData.color}}>{healthData.grade}</span>
          </div>
          {/* Theme toggle */}
          <button className="nav-btn-size touchable" onClick={()=>setTheme(t=>t==="dark"?"light":"dark")}
            style={{width:40,height:40,borderRadius:12,background:T.border,border:"none",cursor:"pointer",fontSize:18,display:"flex",alignItems:"center",justifyContent:"center",transition:"all .2s",flexShrink:0}}>
            {theme==="dark"?"☀️":"🌙"}
          </button>
          <div className="vatsu-month-nav" style={{display:"flex",alignItems:"center",gap:10}}>
            <button className="nav-btn-size touchable" onClick={()=>setActiveMonth(m=>m===0?11:m-1)} style={{background:T.border,border:"none",color:T.textSub,width:34,height:34,borderRadius:10,cursor:"pointer",fontSize:18,display:"flex",alignItems:"center",justifyContent:"center"}}>‹</button>
            <div className="vatsu-month-label" style={{textAlign:"center",minWidth:170}}>
              <div style={{fontSize:16,fontWeight:700,color:theme==="dark"?"#e8f4ff":"#ffffff",fontFamily:TF}}>{MONTHS[activeMonth]} {activeYear}</div>
              {totalIncome>0&&<div style={{fontSize:10,color:"#1dd1a1",marginTop:1}}>{fmtINR(totalIncome)}</div>}
            </div>
            <button className="nav-btn-size touchable" onClick={()=>setActiveMonth(m=>m===11?0:m+1)} style={{background:T.border,border:"none",color:T.textSub,width:34,height:34,borderRadius:10,cursor:"pointer",fontSize:18,display:"flex",alignItems:"center",justifyContent:"center"}}>›</button>
          </div>
        </div>
      </header>

      {/* TABS - desktop */}
      <div className="top-tabs" style={{background:T.tabBg,borderBottom:`1px solid ${T.border}`,padding:"0 32px",gap:2,overflowX:"auto"}}>
        {[["dashboard","📊 Dashboard"],["insights","🔍 Insights"],["history","📈 History"],["goals","🎯 Goals"],["loans","🏦 Loans"],["challenges","🏆 Challenges"],["advisor","🤖 AI Advisor"]].map(([id,lbl])=>(
          <button key={id} className="tab-btn" onClick={()=>setTab(id)}
            style={{padding:"13px 18px",fontSize:12,fontWeight:600,cursor:"pointer",border:"none",background:"none",color:tab===id?"#1dd1a1":T.textSub,borderBottom:tab===id?"2px solid #1dd1a1":"2px solid transparent",transition:"all .2s",fontFamily:TF,whiteSpace:"nowrap",position:"relative"}}>
            {lbl}
            {id==="dashboard"&&warnings.length>0&&<span style={{position:"absolute",top:8,right:6,width:7,height:7,borderRadius:"50%",background:"#ffa94d",animation:"pulse 1.5s infinite"}}/>}
          </button>
        ))}
      </div>

      {/* BOTTOM NAV - mobile */}
      <nav className="bottom-nav touchable">
        <div className="bottom-nav-inner">
          {[
            ["dashboard","📊","Home"],
            ["insights","🔍","Insights"],
            ["goals","🎯","Goals"],
            ["challenges","🏆","Challenges"],
            ["advisor","🤖","Advisor"],
          ].map(([id,icon,lbl])=>(
            <button key={id} className={`bnav-btn touchable${tab===id?" active":""}`}
              onClick={()=>setTab(id)}>
              <span className="bnav-icon">{icon}</span>
              <span className="bnav-label" style={{color:tab===id?"#1dd1a1":T.textSub}}>{lbl}</span>
              {id==="dashboard"&&warnings.length>0&&<span style={{position:"absolute",top:4,right:6,width:7,height:7,borderRadius:"50%",background:"#ffa94d",animation:"pulse 1.5s infinite"}}/>}
            </button>
          ))}
          {/* More menu button */}
          <button className={`bnav-btn touchable${["history","loans"].includes(tab)?" active":""}`}
            onClick={()=>setTab(t=>["history","loans"].includes(t)?"dashboard":t==="history"?"loans":"history")}>
            <span className="bnav-icon">⋯</span>
            <span className="bnav-label" style={{color:["history","loans"].includes(tab)?"#1dd1a1":T.textSub}}>More</span>
          </button>
        </div>
      </nav>

      {/* WARNING BANNER */}
      {warnings.length>0&&tab==="dashboard"&&(
        <div style={{background:theme==="dark"?"linear-gradient(90deg,#1a0800,#1a0e00)":"#fff8f0",borderBottom:`1px solid #ffa94d33`,padding:"10px 32px",display:"flex",flexWrap:"wrap",gap:10}}>
          {warnings.map(w=>(
            <div key={w.id} style={{display:"flex",alignItems:"center",gap:8,background:"#ffa94d15",border:"1px solid #ffa94d44",borderRadius:10,padding:"8px 14px"}}>
              <span style={{animation:"pulse 1.5s infinite",display:"inline-block"}}>⚠️</span>
              <span style={{fontSize:12,color:"#ffa94d",fontFamily:TF}}><b>{w.label}</b> at {w.pct}% — {fmtINR(w.spent)} of {fmtINR(w.bgt)}</span>
            </div>
          ))}
        </div>
      )}

      <main className="main-content" style={{padding:"28px 32px",maxWidth:1200,margin:"0 auto"}}>

        {/* ═══ DASHBOARD ═══ */}
        {tab==="dashboard"&&(
          <div style={{display:"flex",flexDirection:"column",gap:22}}>
            {/* Health score */}
            <HealthScoreCard {...healthData} theme={theme}/>
            {/* Stat cards */}
            <div className="stat-grid" style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:16}}>
              <StatCard title="Total Income" value={totalIncome} sub={`${currentMonth.incomeSources.length} source(s)`} accent="#1dd1a1" icon="💵" theme={theme} extra={<Btn variant="primary" full onClick={()=>setShowIncomeModal(true)} style={{marginTop:14,fontSize:12,padding:"8px 14px"}}>+ Add Income</Btn>}/>
              <StatCard title="Expenses" value={totalExpenses} sub={`${currentMonth.expenses.length} items`} accent="#ff6b6b" icon="💸" theme={theme}/>
              <StatCard title="EMI This Month" value={totalEMI} sub={`${activeLoans.length} active loan(s)`} accent="#ffa94d" icon="🏦" theme={theme}/>
              <StatCard title="Remaining" value={Math.abs(remaining)} sub={healthMsg} accent={hc} icon={remaining<0?"🚨":"✅"} theme={theme}/>
            </div>

            {/* Progress bar */}
            {totalIncome>0&&(
              <div style={{background:`linear-gradient(135deg,${T.surface},${T.surface2})`,border:`1px solid ${T.border}`,borderRadius:20,padding:"20px 24px"}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:14,alignItems:"center",flexWrap:"wrap",gap:8}}>
                  <span style={{fontSize:11,fontWeight:700,color:T.textSub,letterSpacing:"0.12em",textTransform:"uppercase"}}>Monthly Budget Health</span>
                  <div style={{display:"flex",gap:14,flexWrap:"wrap"}}>
                    <span style={{fontSize:11,color:"#ff6b6b"}}>▮ Expenses {fmtINR(totalExpenses)}</span>
                    {totalEMI>0&&<span style={{fontSize:11,color:"#ffa94d"}}>▮ EMI {fmtINR(totalEMI)}</span>}
                    <span style={{fontSize:11,color:"#1dd1a1"}}>▮ Left {fmtINR(Math.max(0,remaining))}</span>
                  </div>
                </div>
                <div style={{height:16,background:T.border,borderRadius:99,overflow:"hidden",position:"relative"}}>
                  <div style={{position:"absolute",left:0,height:"100%",width:`${(totalExpenses/totalIncome)*100}%`,background:"linear-gradient(90deg,#c0392b,#ff6b6b)",borderRadius:99,transition:"width .8s ease"}}/>
                  {totalEMI>0&&<div style={{position:"absolute",left:`${(totalExpenses/totalIncome)*100}%`,height:"100%",width:`${(totalEMI/totalIncome)*100}%`,background:"linear-gradient(90deg,#e67e22,#ffa94d)",borderRadius:"0 99px 99px 0",transition:"width .8s ease"}}/>}
                </div>
                <div style={{display:"flex",justifyContent:"space-between",marginTop:8}}>
                  <span style={{fontSize:12,color:T.textMuted}}>0%</span>
                  <span style={{fontSize:12,color:hc,fontWeight:700}}>{Math.round(spentPct)}% used</span>
                  <span style={{fontSize:12,color:T.textMuted}}>100%</span>
                </div>
              </div>
            )}

            {/* Income sources */}
            {currentMonth.incomeSources.length>0&&(
              <div style={{background:`linear-gradient(135deg,${T.surface},${T.surface2})`,border:`1px solid #1a3a28`,borderRadius:20,padding:"20px 24px"}}>
                <div style={{fontSize:11,fontWeight:700,color:T.textSub,letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:14}}>Income Sources — {MONTHS[activeMonth]}</div>
                {currentMonth.incomeSources.map(src=>(
                  <div key={src.id} className="row-item" style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 16px",background:T.surface2,borderRadius:12,border:`1px solid ${T.border2}`,marginBottom:6,transition:"all .2s"}}>
                    <div style={{display:"flex",alignItems:"center",gap:10}}>
                      <div style={{width:32,height:32,borderRadius:9,background:"#1dd1a122",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>💼</div>
                      <span style={{color:T.text,fontSize:14}}>{src.label}</span>
                    </div>
                    <div style={{display:"flex",gap:10,alignItems:"center"}}>
                      <span style={{color:"#1dd1a1",fontWeight:700,fontSize:15}}>{fmtINR(src.amount)}</span>
                      <button className="del-btn" style={{background:"#ff6b6b18",border:"none",color:"#ff6b6b",borderRadius:8,width:28,height:28,cursor:"pointer",fontSize:12,transition:"all .2s"}} onClick={()=>removeIncomeSource(src.id)}>✕</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Expense form + Donut + Budget Wheel */}
            <div className="grid-auto" style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(300px,1fr))",gap:20}}>
              {/* Add expense */}
              <div style={{background:`linear-gradient(135deg,${T.surface},${T.surface2})`,border:`1px solid ${T.border}`,borderRadius:20,padding:"22px 24px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
                  <div style={{fontSize:11,fontWeight:700,color:T.textSub,letterSpacing:"0.12em",textTransform:"uppercase"}}>Add Expense</div>
                  <div style={{display:"flex",gap:8}}>
                    {customCategories.length>0&&(
                      <button onClick={()=>setShowManageCats(true)}
                        style={{fontSize:11,padding:"6px 10px",borderRadius:9,background:T.border,border:"none",color:T.textSub,cursor:"pointer",fontFamily:TF}}>
                        🏷️ My Cats
                      </button>
                    )}
                    <Btn onClick={()=>{setBudgetForm(currentMonth.budgets||{});setShowBudgetModal(true);}} style={{fontSize:11,padding:"6px 12px"}}>⚙ Budgets</Btn>
                  </div>
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:12}}>
                  <Field label="Description" theme={theme}><input style={IS} placeholder="e.g. Swiggy, petrol, movie…" value={expForm.description} onChange={e=>setExpForm(p=>({...p,description:e.target.value}))}/></Field>
                  <div className="form-grid-2" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                    <Field label="Amount (₹)" theme={theme}><input style={IS} type="number" placeholder="0" value={expForm.amount} onChange={e=>setExpForm(p=>({...p,amount:e.target.value}))}/></Field>
                    <Field label="Category" theme={theme}>
                      <div style={{display:"flex",gap:6}}>
                        <select style={{...IS,flex:1}} value={expForm.category} onChange={e=>setExpForm(p=>({...p,category:e.target.value}))}>
                          <optgroup label="Built-in">
                            {CATEGORIES.map(c=><option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
                          </optgroup>
                          {customCategories.length>0&&(
                            <optgroup label="My Categories">
                              {customCategories.map(c=><option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
                            </optgroup>
                          )}
                        </select>
                        {/* + button opens create category modal */}
                        <button title="Create new category" onClick={()=>setShowCatModal(true)}
                          style={{flexShrink:0,width:42,height:42,borderRadius:10,background:"linear-gradient(135deg,#1dd1a1,#10ac84)",border:"none",cursor:"pointer",fontSize:20,display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 4px 14px #1dd1a133",transition:"all .2s"}}>
                          ＋
                        </button>
                      </div>
                    </Field>
                  </div>
                  <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",color:T.textSub,fontSize:13,userSelect:"none"}}>
                    <input type="checkbox" checked={expForm.isRecurring} onChange={e=>setExpForm(p=>({...p,isRecurring:e.target.checked}))}/>
                    Recurring — auto-add every month
                  </label>
                  <Btn variant="primary" full onClick={addExpense}>+ Add Expense</Btn>
                </div>
              </div>
              {/* Donut */}
              <div style={{background:`linear-gradient(135deg,${T.surface},${T.surface2})`,border:`1px solid ${T.border}`,borderRadius:20,padding:"22px 24px"}}>
                <div style={{fontSize:11,fontWeight:700,color:T.textSub,letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:16}}>Spending Breakdown <span style={{color:T.textMuted,fontSize:10,fontWeight:400}}>(hover)</span></div>
                <div style={{display:"flex",gap:16,alignItems:"center",flexWrap:"wrap"}}>
                  <div style={{flex:"0 0 180px"}}><DonutChart segments={categoryBreakdown} centerLabel={fmtINR(totalExpenses)} centerSub="total spent" theme={theme}/></div>
                  <div style={{flex:1,display:"flex",flexDirection:"column",gap:10,minWidth:140}}>
                    {categoryBreakdown.map(c=>{
                      const bgt=(currentMonth.budgets||{})[c.id];
                      const pct=bgt?Math.min(100,(c.value/bgt)*100):null;
                      return(<div key={c.id}>
                        <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                          <span style={{fontSize:12,color:T.textSub}}>{c.icon} {c.label}</span>
                          <span style={{fontSize:12,fontWeight:700,color:c.color,textShadow:`0 0 8px ${c.glow}`}}>{fmtINR(c.value)}</span>
                        </div>
                        {pct!==null&&<><div style={{height:5,background:T.border,borderRadius:99}}>
                          <div style={{height:5,width:`${pct}%`,background:pct>=90?"#ff6b6b":c.color,borderRadius:99,transition:"width .5s ease"}}/>
                        </div><div style={{fontSize:10,color:T.textMuted,marginTop:2}}>Budget: {fmtINR(bgt)}</div></>}
                      </div>);
                    })}
                    {categoryBreakdown.length===0&&<span style={{color:T.textMuted,fontSize:13}}>No expenses yet</span>}
                  </div>
                </div>
              </div>
              {/* Budget Wheel */}
              <div className="budget-wheel-card vatsu-card" style={{background:`linear-gradient(135deg,${T.surface},${T.surface2})`,border:`1px solid ${T.border}`,borderRadius:20,padding:"22px 24px"}}>
                <div style={{fontSize:11,fontWeight:700,color:T.textSub,letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:16}}>Budget Allocation Wheel <span style={{color:T.textMuted,fontSize:10,fontWeight:400}}>(hover)</span></div>
                <div style={{display:"flex",gap:16,alignItems:"center",flexWrap:"wrap"}}>
                  <div style={{flex:"0 0 200px"}}><BudgetWheel categories={allCategories} budgets={currentMonth.budgets||{}} expenses={currentMonth.expenses} income={totalIncome} theme={theme}/></div>
                  <div style={{flex:1,display:"flex",flexDirection:"column",gap:8,minWidth:120}}>
                    {allCategories.filter(c=>(currentMonth.budgets||{})[c.id]).map(c=>{
                      const bgt=(currentMonth.budgets||{})[c.id];
                      const spent=currentMonth.expenses.filter(e=>e.category===c.id).reduce((s,e)=>s+e.amount,0);
                      const pct=Math.round((spent/bgt)*100);
                      return(<div key={c.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                        <span style={{fontSize:11,color:T.textSub}}>{c.icon} {c.label}</span>
                        <span style={{fontSize:11,color:pct>=100?"#ff6b6b":pct>=90?"#ffa94d":c.color,fontWeight:700}}>{pct}%</span>
                      </div>);
                    })}
                    {Object.keys(currentMonth.budgets||{}).length===0&&<span style={{color:T.textMuted,fontSize:12}}>Set budgets to see the wheel</span>}
                  </div>
                </div>
              </div>
            </div>

            {/* Heatmap */}
            <div style={{background:`linear-gradient(135deg,${T.surface},${T.surface2})`,border:`1px solid ${T.border}`,borderRadius:20,padding:"22px 24px"}}>
              <div style={{fontSize:11,fontWeight:700,color:T.textSub,letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:16}}>Spending Heatmap — {MONTHS[activeMonth]} {activeYear}</div>
              <HeatmapCalendar year={activeYear} month={activeMonth} expenses={currentMonth.expenses} theme={theme}/>
            </div>

            {/* Expense list with swipe-to-delete */}
            <div style={{background:`linear-gradient(135deg,${T.surface},${T.surface2})`,border:`1px solid ${T.border}`,borderRadius:20,padding:"22px 24px"}}>
              <div style={{fontSize:11,fontWeight:700,color:T.textSub,letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:16}}>
                All Expenses — {MONTHS[activeMonth]}
                <span style={{color:T.textMuted,fontSize:10,fontWeight:400,marginLeft:8}}>Swipe left on mobile to delete</span>
              </div>
              {currentMonth.expenses.length===0
                ?<div style={{textAlign:"center",padding:"30px 0",color:T.textMuted}}><div style={{fontSize:36,marginBottom:8}}>📋</div><div>No expenses yet</div></div>
                :[...currentMonth.expenses].reverse().map(e=><SwipeRow key={e.id} expense={e} onDelete={deleteExpense} theme={theme} categories={allCategories}/>)
              }
            </div>
          </div>
        )}

        {/* ═══ INSIGHTS ═══ */}
        {tab==="insights"&&(
          <div style={{display:"flex",flexDirection:"column",gap:20}}>
            <div style={{background:`linear-gradient(135deg,${T.surface},${T.surface2})`,border:`1px solid ${T.border}`,borderRadius:20,padding:"22px 24px"}}>
              <div style={{fontSize:11,fontWeight:700,color:T.textSub,letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:16}}>Smart Spending Insights — {MONTHS[activeMonth]}</div>
              <SmartInsights monthlyData={monthlyData} activeMonth={activeMonth} activeYear={activeYear} historyMonths={historyMonths} theme={theme} allCats={allCategories}/>
            </div>
            <HealthScoreCard {...healthData} theme={theme}/>
          </div>
        )}

        {/* ═══ HISTORY ═══ */}
        {tab==="history"&&(
          <div style={{display:"flex",flexDirection:"column",gap:22}}>
            <div style={{background:`linear-gradient(135deg,${T.surface},${T.surface2})`,border:`1px solid ${T.border}`,borderRadius:20,padding:"22px 24px"}}>
              <div style={{fontSize:11,fontWeight:700,color:T.textSub,letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:18}}>Month-by-Month Comparison</div>
              {historyMonths.length===0
                ?<div style={{textAlign:"center",padding:"40px 0",color:T.textMuted}}><div style={{fontSize:40,marginBottom:10}}>📊</div><div>No history yet</div></div>
                :<>
                  <div style={{display:"flex",alignItems:"flex-end",gap:5,height:130,paddingTop:10}}>
                    {historyMonths.map(h=><TrendBar key={h.key} label={SHORT[h.month]} income={h.income} expenses={h.expenses} maxVal={maxHistVal} isActive={h.month===activeMonth&&h.year===activeYear} onClick={()=>{setActiveMonth(h.month);setTab("dashboard");}}/>)}
                  </div>
                  <div style={{display:"flex",gap:16,marginTop:10,justifyContent:"flex-end"}}>
                    <span style={{fontSize:11,color:"#1dd1a1"}}>▮ Income</span>
                    <span style={{fontSize:11,color:"#ff6b6b"}}>▮ Outflow</span>
                  </div>
                  <div style={{marginTop:20,display:"flex",flexDirection:"column",gap:6}}>
                    {historyMonths.map(h=>(
                      <div key={h.key} className="row-item" style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"13px 18px",background:h.month===activeMonth?T.border:T.surface2,borderRadius:13,border:`1px solid ${h.month===activeMonth?"#1e3a5a":T.border2}`,cursor:"pointer",flexWrap:"wrap",gap:8,transition:"all .2s"}} onClick={()=>{setActiveMonth(h.month);setTab("dashboard");}}>
                        <span style={{fontWeight:700,color:T.textSub,minWidth:130,fontFamily:TF}}>{MONTHS[h.month]} {h.year}</span>
                        <span style={{color:"#1dd1a1",minWidth:110,textAlign:"right"}}>↑ {fmtINR(h.income)}</span>
                        <span style={{color:"#ff6b6b",minWidth:110,textAlign:"right"}}>↓ {fmtINR(h.expenses)}</span>
                        <span style={{color:h.savings>=0?"#1dd1a1":"#ff6b6b",fontWeight:800,minWidth:110,textAlign:"right"}}>{h.savings>=0?"+":""}{fmtINR(h.savings)}</span>
                      </div>
                    ))}
                  </div>
                </>
              }
            </div>
            {historyMonths.length>1&&(()=>{
              const tot=historyMonths.reduce((a,h)=>({i:a.i+h.income,e:a.e+h.expenses}),{i:0,e:0});
              return(<div style={{background:"linear-gradient(135deg,#071a0f,#05120a)",border:"1px solid #1a3a28",borderRadius:20,padding:"22px 28px"}}>
                <div style={{fontSize:11,fontWeight:700,color:T.textSub,letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:18}}>Year-to-Date</div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:16}}>
                  <div><div style={{fontSize:12,color:T.textSub}}>Total Earned</div><div style={{fontSize:26,fontWeight:800,color:"#1dd1a1",fontFamily:TF,marginTop:4}}>{fmtINR(tot.i)}</div></div>
                  <div><div style={{fontSize:12,color:T.textSub}}>Total Spent</div><div style={{fontSize:26,fontWeight:800,color:"#ff6b6b",fontFamily:TF,marginTop:4}}>{fmtINR(tot.e)}</div></div>
                  <div><div style={{fontSize:12,color:T.textSub}}>Net Saved</div><div style={{fontSize:26,fontWeight:800,color:tot.i-tot.e>=0?"#1dd1a1":"#ff6b6b",fontFamily:TF,marginTop:4}}>{fmtINR(tot.i-tot.e)}</div></div>
                </div>
              </div>);
            })()}
          </div>
        )}

        {/* ═══ GOALS ═══ */}
        {tab==="goals"&&(
          <div style={{display:"flex",flexDirection:"column",gap:22}}>
            <div style={{background:"linear-gradient(135deg,#071a14,#050f0e)",border:"1px solid #1dd1a133",borderRadius:16,padding:"14px 20px",display:"flex",alignItems:"flex-start",gap:12}}>
              <span style={{fontSize:20,flexShrink:0}}>🔗</span>
              <div>
                <div style={{fontSize:13,fontWeight:700,color:"#1dd1a1",marginBottom:3,fontFamily:TF}}>Goals are linked to your Dashboard</div>
                <div style={{fontSize:12,color:T.textSub,lineHeight:1.6,fontFamily:TF}}>Contributions create a real <b style={{color:T.text}}>Savings & Investments</b> expense in {MONTHS[activeMonth]}, reducing your remaining balance.</div>
              </div>
            </div>
            <div style={{background:`linear-gradient(135deg,${T.surface},${T.surface2})`,border:`1px solid ${T.border}`,borderRadius:20,padding:"22px 24px"}}>
              <div style={{fontSize:11,fontWeight:700,color:T.textSub,letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:18}}>Create a New Goal</div>
              <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr auto",gap:10,alignItems:"flex-end"}}>
                <Field label="Goal Name" theme={theme}><input style={IS} placeholder="Emergency Fund, MacBook…" value={goalForm.label} onChange={e=>setGoalForm(p=>({...p,label:e.target.value}))}/></Field>
                <Field label="Target (₹)" theme={theme}><input style={IS} type="number" placeholder="500000" value={goalForm.target} onChange={e=>setGoalForm(p=>({...p,target:e.target.value}))}/></Field>
                <Field label="Opening Balance (₹)" theme={theme}><input style={IS} type="number" placeholder="0" value={goalForm.saved} onChange={e=>setGoalForm(p=>({...p,saved:e.target.value}))}/></Field>
                <Btn variant="primary" onClick={addGoal} style={{whiteSpace:"nowrap"}}>+ Add Goal</Btn>
              </div>
            </div>
            {goals.length===0
              ?<div style={{background:`linear-gradient(135deg,${T.surface},${T.surface2})`,border:`1px solid ${T.border}`,borderRadius:20,padding:"50px",textAlign:"center",color:T.textMuted}}><div style={{fontSize:48,marginBottom:10}}>🎯</div><div>No savings goals yet</div></div>
              :<div className="grid-auto" style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(300px,1fr))",gap:16}}>
                {goals.map((g,gi)=>{
                  const pct=Math.min(100,(g.saved/g.target)*100), done=g.saved>=g.target;
                  const colors=["#1dd1a1","#54a0ff","#cd84f1","#ffd32a","#ff9f43","#00d2d3"], gc=colors[gi%colors.length];
                  const contribVal=contributionAmounts[g.id]||"";
                  const thisMonthContribs=((monthlyData[monthKey]?.expenses||[]).filter(e=>e.goalId===g.id).reduce((s,e)=>s+e.amount,0));
                  return(
                    <div key={g.id} style={{background:`linear-gradient(135deg,${T.surface},${T.surface2})`,border:`1px solid ${done?gc+"55":T.border}`,borderRadius:20,padding:"22px 24px",position:"relative",overflow:"hidden"}}>
                      <div style={{position:"absolute",top:-20,right:-20,width:110,height:110,borderRadius:"50%",background:gc+"18",filter:"blur(28px)",pointerEvents:"none"}}/>
                      <div style={{position:"relative"}}>
                        <div style={{display:"flex",justifyContent:"space-between",marginBottom:16}}>
                          <div>
                            <div style={{fontWeight:700,color:T.text,fontSize:17,fontFamily:TF}}>{g.label}</div>
                            <div style={{fontSize:12,color:T.textSub,marginTop:3}}>Target: <b style={{color:T.text}}>{fmtINR(g.target)}</b></div>
                          </div>
                          <div style={{display:"flex",gap:6,alignItems:"flex-start"}}>
                            {done&&<span style={{display:"inline-flex",alignItems:"center",padding:"4px 10px",borderRadius:20,background:"#1dd1a122",color:"#1dd1a1",fontSize:11,fontWeight:700}}>🎉 Done!</span>}
                            <button className="del-btn" style={{background:"#ff6b6b18",border:"none",color:"#ff6b6b",borderRadius:8,width:28,height:28,cursor:"pointer"}} onClick={()=>deleteGoal(g.id)}>✕</button>
                          </div>
                        </div>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginBottom:10}}>
                          <div>
                            <div style={{fontSize:10,color:T.textSub,marginBottom:2}}>Saved</div>
                            <div style={{color:gc,fontWeight:800,fontSize:26,fontFamily:TF,textShadow:`0 0 14px ${gc}55`}}>{fmtINR(g.saved)}</div>
                          </div>
                          <div style={{textAlign:"right"}}>
                            <div style={{color:gc,fontSize:22,fontWeight:800,fontFamily:TF}}>{Math.round(pct)}%</div>
                            <div style={{fontSize:11,color:T.textSub}}>of target</div>
                          </div>
                        </div>
                        <div style={{height:12,background:T.border,borderRadius:99,overflow:"hidden"}}>
                          <div style={{height:12,width:`${pct}%`,background:done?"linear-gradient(90deg,#1dd1a1,#10ac84)":`linear-gradient(90deg,${gc}aa,${gc})`,borderRadius:99,boxShadow:`0 0 10px ${gc}66`,transition:"width .8s cubic-bezier(.34,1.56,.64,1)"}}/>
                        </div>
                        {!done&&<div style={{fontSize:12,color:T.textSub,marginTop:7}}>Still need: <b style={{color:"#ffa94d"}}>{fmtINR(g.target-g.saved)}</b></div>}
                        {thisMonthContribs>0&&<div style={{marginTop:12,padding:"8px 12px",background:gc+"12",border:`1px solid ${gc}33`,borderRadius:10,display:"flex",justifyContent:"space-between"}}>
                          <span style={{fontSize:12,color:gc}}>💳 This month</span>
                          <span style={{fontSize:13,fontWeight:700,color:gc}}>{fmtINR(thisMonthContribs)}</span>
                        </div>}
                        {!done&&<div style={{marginTop:16,paddingTop:16,borderTop:`1px solid ${T.border2}`}}>
                          <div style={{fontSize:11,fontWeight:700,color:T.textSub,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:10}}>Contribute</div>
                          <div style={{display:"flex",gap:8}}>
                            <input style={{...IS,flex:1}} type="number" placeholder="Enter amount (₹)" value={contribVal}
                              onChange={e=>setContributionAmounts(p=>({...p,[g.id]:e.target.value}))}
                              onKeyDown={e=>{if(e.key==="Enter"&&contribVal){contributeToGoal(g.id,contribVal);setContributionAmounts(p=>({...p,[g.id]:""}));}}}/>
                            <Btn variant="primary" onClick={()=>{if(!contribVal)return;contributeToGoal(g.id,contribVal);setContributionAmounts(p=>({...p,[g.id]:""}));}} style={{whiteSpace:"nowrap",padding:"10px 16px",fontSize:13}}>💸 Add</Btn>
                          </div>
                          <div style={{fontSize:11,color:T.textMuted,marginTop:6}}>Recorded as expense in {MONTHS[activeMonth]}</div>
                        </div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            }
          </div>
        )}

        {/* ═══ LOANS ═══ */}
        {tab==="loans"&&(
          <div style={{display:"flex",flexDirection:"column",gap:22}}>
            <div style={{background:"linear-gradient(135deg,#1a0e00,#120900)",border:"1px solid #ffa94d33",borderRadius:20,padding:"22px 28px"}}>
              <div style={{fontSize:11,fontWeight:700,color:T.textSub,letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:16}}>EMI Impact — {MONTHS[activeMonth]}</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:16}}>
                <div><div style={{fontSize:12,color:T.textSub}}>Total EMI</div><div style={{fontSize:28,fontWeight:800,color:"#ffa94d",fontFamily:TF,marginTop:4}}>{fmtINR(totalEMI)}</div></div>
                <div><div style={{fontSize:12,color:T.textSub}}>Active Loans</div><div style={{fontSize:28,fontWeight:800,color:T.text,fontFamily:TF,marginTop:4}}>{activeLoans.length}</div></div>
                <div><div style={{fontSize:12,color:T.textSub}}>Remaining After EMI</div><div style={{fontSize:28,fontWeight:800,color:remaining<0?"#ff6b6b":"#1dd1a1",fontFamily:TF,marginTop:4}}>{fmtINR(remaining)}</div></div>
              </div>
            </div>
            <div style={{display:"flex",justifyContent:"flex-end"}}><Btn variant="orange" onClick={()=>setShowLoanModal(true)} style={{fontSize:14,padding:"11px 22px"}}>🏦 + Add Bank Loan</Btn></div>
            {loans.length===0
              ?<div style={{background:`linear-gradient(135deg,${T.surface},${T.surface2})`,border:`1px solid ${T.border}`,borderRadius:20,padding:"50px",textAlign:"center",color:T.textMuted}}><div style={{fontSize:48,marginBottom:10}}>🏦</div><div>No loans yet</div></div>
              :<div style={{display:"flex",flexDirection:"column",gap:14}}>
                {loans.map(loan=>{
                  const sa=loan.startYear*12+loan.startMonth,ca=activeYear*12+activeMonth,el=Math.max(0,ca-sa);
                  const isAct=el>=0&&el<(loan.tenureMonths||9999),pct=loan.tenureMonths?Math.min(100,(el/loan.tenureMonths)*100):0,left=loan.tenureMonths?Math.max(0,loan.tenureMonths-el):"∞";
                  return(<div key={loan.id} style={{background:`linear-gradient(135deg,${T.surface},${T.surface2})`,border:`1px solid ${isAct?"#ffa94d33":T.border}`,borderRadius:20,padding:"22px 26px",opacity:isAct?1:0.6,position:"relative",overflow:"hidden"}}>
                    <div style={{position:"absolute",top:-30,right:-30,width:130,height:130,borderRadius:"50%",background:"#ffa94d0e",filter:"blur(30px)",pointerEvents:"none"}}/>
                    <div style={{position:"relative"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:10,marginBottom:16}}>
                        <div style={{display:"flex",alignItems:"center",gap:12}}>
                          <div style={{width:44,height:44,borderRadius:13,background:"#ffa94d22",border:"1px solid #ffa94d44",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>🏦</div>
                          <div>
                            <div style={{fontWeight:700,color:T.text,fontSize:17,fontFamily:TF}}>{loan.bankName}</div>
                            <div style={{fontSize:12,color:T.textSub,marginTop:2}}>{loan.loanType} · Started {MONTHS[loan.startMonth]} {loan.startYear}</div>
                          </div>
                        </div>
                        <div style={{display:"flex",gap:8,alignItems:"center"}}>
                          <span style={{display:"inline-flex",alignItems:"center",padding:"4px 12px",borderRadius:20,background:isAct?"#ffa94d22":"#1a2e4a",color:isAct?"#ffa94d":T.textSub,fontSize:12,fontWeight:700,gap:5}}>
                            <span style={{width:7,height:7,borderRadius:"50%",background:"currentColor",display:"inline-block",animation:isAct?"pulse 1.8s infinite":"none"}}/>
                            {isAct?"Active":"Closed"}
                          </span>
                          <button className="del-btn" style={{background:"#ff6b6b18",border:"none",color:"#ff6b6b",borderRadius:8,width:30,height:30,cursor:"pointer"}} onClick={()=>deleteLoan(loan.id)}>✕</button>
                        </div>
                      </div>
                      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:12,marginBottom:16}}>
                        {[["Principal",fmtINR(loan.principal),T.text],["Monthly EMI",fmtINR(loan.emi),"#ffa94d"],["Interest Rate",loan.interestRate?loan.interestRate+"% p.a.":"—",T.text]].map(([lbl,val,col])=>(
                          <div key={lbl} style={{background:T.surface2,borderRadius:12,padding:"12px 14px",border:`1px solid ${T.border2}`}}>
                            <div style={{fontSize:11,color:T.textSub,marginBottom:4}}>{lbl}</div>
                            <div style={{fontWeight:700,color:col,fontSize:15}}>{val}</div>
                          </div>
                        ))}
                      </div>
                      {loan.tenureMonths>0&&<>
                        <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                          <span style={{fontSize:12,color:T.textSub}}>{el} of {loan.tenureMonths} months{typeof left==="number"?` · ${left} remaining`:""}</span>
                          <span style={{fontSize:12,color:"#ffa94d",fontWeight:700}}>{Math.round(pct)}% repaid</span>
                        </div>
                        <div style={{height:10,background:T.border,borderRadius:99}}>
                          <div style={{height:10,width:`${pct}%`,background:"linear-gradient(90deg,#e67e22,#ffa94d)",borderRadius:99,transition:"width .8s ease"}}/>
                        </div>
                        <div style={{fontSize:12,color:T.textSub,marginTop:6}}>Paid (EMI): {fmtINR(el*loan.emi)}</div>
                      </>}
                    </div>
                  </div>);
                })}
              </div>
            }
          </div>
        )}

        {/* ═══ CHALLENGES ═══ */}
        {tab==="challenges"&&<ChallengesTab monthlyData={monthlyData} activeMonth={activeMonth} activeYear={activeYear} challenges={challenges} setChallenges={setChallenges} theme={theme}/>}

        {/* ═══ AI ADVISOR ═══ */}
        {tab==="advisor"&&<AIAdvisor monthlyData={monthlyData} goals={goals} loans={loans} activeMonth={activeMonth} activeYear={activeYear} theme={theme} allCats={allCategories}/>}

      </main>

      {/* CREATE CATEGORY MODAL */}
      <Modal show={showCatModal} onClose={()=>setShowCatModal(false)} title="Create Custom Category" subtitle="Add your own spending category with a custom icon and colour.">
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          {/* Name */}
          <Field label="Category Name" theme={theme}>
            <input style={IS} placeholder="e.g. Pet Care, Gym, Rent…" autoFocus
              value={catForm.label} onChange={e=>setCatForm(p=>({...p,label:e.target.value}))}
              onKeyDown={e=>e.key==="Enter"&&addCustomCategory()}/>
          </Field>

          {/* Icon picker */}
          <div>
            <label style={{fontSize:12,color:T.textSub,fontWeight:600,marginBottom:8,display:"block",fontFamily:TF}}>Pick an Icon</label>
            <div style={{display:"grid",gridTemplateColumns:"repeat(8,1fr)",gap:6}}>
              {["🐾","🏋️","🏠","💊","✈️","🎓","🎁","🧴","🪴","🍺","🎮","🎸","📚","🧹","💇","🔧","🚿","🐕","🏖️","💌","🎪","🧘","🛒","⚽"].map(em=>(
                <button key={em} onClick={()=>setCatForm(p=>({...p,icon:em}))}
                  style={{fontSize:22,padding:"6px",borderRadius:10,border:`2px solid ${catForm.icon===em?"#1dd1a1":T.border}`,background:catForm.icon===em?"#1dd1a122":T.surface2,cursor:"pointer",transition:"all .15s",lineHeight:1}}>
                  {em}
                </button>
              ))}
            </div>
            <div style={{display:"flex",alignItems:"center",gap:10,marginTop:10}}>
              <span style={{fontSize:12,color:T.textSub,fontFamily:TF}}>Or type any emoji:</span>
              <input style={{...IS,width:70,textAlign:"center",fontSize:20,padding:"6px 10px"}}
                maxLength={2} value={catForm.icon}
                onChange={e=>setCatForm(p=>({...p,icon:e.target.value||"📌"}))}/>
            </div>
          </div>

          {/* Colour picker */}
          <div>
            <label style={{fontSize:12,color:T.textSub,fontWeight:600,marginBottom:8,display:"block",fontFamily:TF}}>Pick a Colour</label>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              {["#a29bfe","#fd79a8","#e17055","#fdcb6e","#00cec9","#6c5ce7","#00b894","#74b9ff","#55efc4","#fab1a0","#dfe6e9","#b2bec3"].map(col=>(
                <button key={col} onClick={()=>setCatForm(p=>({...p,color:col}))}
                  style={{width:32,height:32,borderRadius:"50%",background:col,border:`3px solid ${catForm.color===col?"#e8f4ff":"transparent"}`,cursor:"pointer",transition:"all .15s",boxShadow:catForm.color===col?`0 0 10px ${col}99`:"none"}}/>
              ))}
            </div>
            <div style={{display:"flex",alignItems:"center",gap:10,marginTop:10}}>
              <span style={{fontSize:12,color:T.textSub,fontFamily:TF}}>Custom hex:</span>
              <input style={{...IS,width:110,fontFamily:"monospace"}} placeholder="#a29bfe"
                value={catForm.color} onChange={e=>setCatForm(p=>({...p,color:e.target.value}))}/>
              <div style={{width:32,height:32,borderRadius:8,background:catForm.color,border:`1px solid ${T.border}`,flexShrink:0}}/>
            </div>
          </div>

          {/* Preview */}
          <div style={{padding:"12px 16px",background:T.surface2,borderRadius:12,border:`1px solid ${T.border}`,display:"flex",alignItems:"center",gap:12}}>
            <div style={{width:40,height:40,borderRadius:11,background:catForm.color+"22",border:`1px solid ${catForm.color}55`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>{catForm.icon||"📌"}</div>
            <div>
              <div style={{fontWeight:700,color:catForm.color,fontSize:15,fontFamily:TF}}>{catForm.label||"Category Name"}</div>
              <div style={{fontSize:11,color:T.textMuted,fontFamily:TF}}>Custom category preview</div>
            </div>
          </div>

          <div style={{display:"flex",gap:10,marginTop:4}}>
            <Btn full onClick={()=>setShowCatModal(false)}>Cancel</Btn>
            <Btn variant="primary" full onClick={addCustomCategory}
              style={{opacity:catForm.label.trim()?1:0.5}}>
              ✓ Create Category
            </Btn>
          </div>
        </div>
      </Modal>

      {/* MANAGE CUSTOM CATEGORIES — shown inside the budget modal as a section,
          and also accessible by clicking "Manage" in the expense form area */}
      {customCategories.length>0&&tab==="dashboard"&&(
        <div style={{position:"fixed",bottom:isMobile?90:28,left:isMobile?"50%":28,transform:isMobile?"translateX(-50%)":"none",zIndex:500,animation:"fadeUp .3s ease both"}}>
          <button onClick={()=>setShowManageCats(p=>!p)}
            style={{padding:"8px 16px",borderRadius:20,background:T.surface,border:`1px solid ${T.border}`,color:T.textSub,fontSize:12,cursor:"pointer",fontFamily:TF,boxShadow:"0 4px 16px #00000033",display:"flex",alignItems:"center",gap:6}}>
            <span>🏷️</span> My Categories ({customCategories.length})
          </button>
        </div>
      )}

      {/* MANAGE CATEGORIES PANEL */}
      <Modal show={showManageCats} onClose={()=>setShowManageCats(false)} title="My Custom Categories" subtitle="Categories you've created. Delete any you no longer need.">
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {customCategories.length===0
            ? <div style={{textAlign:"center",padding:"20px 0",color:T.textSub,fontFamily:TF}}>No custom categories yet.</div>
            : customCategories.map(c=>(
                <div key={c.id} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",background:T.surface2,borderRadius:14,border:`1px solid ${c.color}33`}}>
                  <div style={{width:40,height:40,borderRadius:11,background:c.color+"22",border:`1px solid ${c.color}44`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>{c.icon}</div>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:700,color:c.color,fontSize:14,fontFamily:TF}}>{c.label}</div>
                    <div style={{fontSize:11,color:T.textMuted,marginTop:2,fontFamily:TF}}>Custom · {c.color}</div>
                  </div>
                  <button onClick={()=>deleteCustomCategory(c.id)}
                    style={{background:"#ff6b6b18",border:"1px solid #ff6b6b33",color:"#ff6b6b",borderRadius:8,width:32,height:32,cursor:"pointer",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>✕</button>
                </div>
              ))
          }
          <div style={{marginTop:8,display:"flex",gap:10}}>
            <Btn full onClick={()=>setShowManageCats(false)}>Close</Btn>
            <Btn variant="primary" full onClick={()=>{setShowManageCats(false);setShowCatModal(true);}}>+ Create New</Btn>
          </div>
        </div>
      </Modal>
      <Modal show={showIncomeModal} onClose={()=>setShowIncomeModal(false)} title="Add Income Source" subtitle="Counted for the selected month only.">
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <Field label="Source Label" theme={theme}><input style={IS} placeholder="Salary, Freelance, Rental…" autoFocus value={incomeForm.label} onChange={e=>setIncomeForm(p=>({...p,label:e.target.value}))}/></Field>
          <Field label="Amount (₹)" theme={theme}><input style={IS} type="number" placeholder="0" value={incomeForm.amount} onChange={e=>setIncomeForm(p=>({...p,amount:e.target.value}))}/></Field>
          <div style={{display:"flex",gap:10,marginTop:4}}>
            <Btn full onClick={()=>setShowIncomeModal(false)}>Cancel</Btn>
            <Btn variant="primary" full onClick={addIncomeSource}>Add Income Source</Btn>
          </div>
        </div>
      </Modal>

      <Modal show={showBudgetModal} onClose={()=>setShowBudgetModal(false)} title="Set Monthly Budgets" subtitle="Alerts fire at 90% of each limit.">
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {allCategories.map(c=>(
            <div key={c.id} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 14px",background:T.surface2,borderRadius:12,border:`1px solid ${T.border2}`}}>
              <span style={{fontSize:20}}>{c.icon}</span>
              <span style={{flex:1,fontSize:13,color:T.text}}>{c.label}</span>
              <input style={{...IS,width:130}} type="number" placeholder="No limit" value={budgetForm[c.id]||""} onChange={e=>setBudgetForm(p=>({...p,[c.id]:e.target.value}))}/>
            </div>
          ))}
          <div style={{display:"flex",gap:10,marginTop:6}}>
            <Btn full onClick={()=>setShowBudgetModal(false)}>Cancel</Btn>
            <Btn variant="primary" full onClick={saveBudgets}>Save Budgets</Btn>
          </div>
        </div>
      </Modal>

      <Modal show={showLoanModal} onClose={()=>setShowLoanModal(false)} title="Add Bank Loan" subtitle="EMI auto-deducted from remaining balance each active month." maxWidth={500}>
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <Field label="Bank Name" theme={theme}><input style={IS} placeholder="SBI, HDFC, ICICI…" value={loanForm.bankName} onChange={e=>setLoanForm(p=>({...p,bankName:e.target.value}))}/></Field>
            <Field label="Loan Type" theme={theme}><select style={IS} value={loanForm.loanType} onChange={e=>setLoanForm(p=>({...p,loanType:e.target.value}))}>{LOAN_TYPES.map(t=><option key={t} value={t}>{t}</option>)}</select></Field>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <Field label="Principal (₹)" theme={theme}><input style={IS} type="number" placeholder="2000000" value={loanForm.principal} onChange={e=>setLoanForm(p=>({...p,principal:e.target.value}))}/></Field>
            <Field label="Monthly EMI (₹)" theme={theme}><input style={IS} type="number" placeholder="18000" value={loanForm.emi} onChange={e=>setLoanForm(p=>({...p,emi:e.target.value}))}/></Field>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <Field label="Interest Rate (% p.a.)" theme={theme}><input style={IS} type="number" placeholder="8.5" value={loanForm.interestRate} onChange={e=>setLoanForm(p=>({...p,interestRate:e.target.value}))}/></Field>
            <Field label="Tenure (months)" theme={theme}><input style={IS} type="number" placeholder="240" value={loanForm.tenureMonths} onChange={e=>setLoanForm(p=>({...p,tenureMonths:e.target.value}))}/></Field>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <Field label="Start Month" theme={theme}><select style={IS} value={loanForm.startMonth} onChange={e=>setLoanForm(p=>({...p,startMonth:e.target.value}))}>{MONTHS.map((m,i)=><option key={i} value={i}>{m}</option>)}</select></Field>
            <Field label="Start Year" theme={theme}><input style={IS} type="number" placeholder={String(THIS_YEAR)} value={loanForm.startYear} onChange={e=>setLoanForm(p=>({...p,startYear:e.target.value}))}/></Field>
          </div>
          <div style={{display:"flex",gap:10,marginTop:4}}>
            <Btn full onClick={()=>setShowLoanModal(false)}>Cancel</Btn>
            <Btn variant="orange" full onClick={addLoan}>Add Loan</Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}
