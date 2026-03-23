import { useState, useMemo, useEffect, useRef } from "react";

function useIsMobile() {
  const [m, setM] = useState(() => typeof window !== "undefined" && window.innerWidth < 768);
  useEffect(() => {
    const h = () => setM(window.innerWidth < 768);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return m;
}

const CATS = [
  { id:"food",          label:"Food & Dining",         icon:"🍜", color:"#ff9f43" },
  { id:"transport",     label:"Transport & Fuel",      icon:"🚗", color:"#ffd32a" },
  { id:"entertainment", label:"Entertainment",         icon:"🎬", color:"#54a0ff" },
  { id:"shopping",      label:"Shopping & Clothing",   icon:"🛍️", color:"#cd84f1" },
  { id:"subscriptions", label:"Subscriptions",         icon:"🔄", color:"#00d2d3" },
  { id:"savings",       label:"Savings & Investments", icon:"💰", color:"#1dd1a1" },
];

const LOAN_TYPES = ["Home Loan","Car Loan","Personal Loan","Education Loan","Gold Loan","Business Loan","Other"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const SHORT  = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const NOW = new Date();
const THIS_YEAR  = NOW.getFullYear();
const THIS_MONTH = NOW.getMonth();

const TF   = "'Playfair Display', Georgia, serif";
const BODY = "'DM Sans', 'Helvetica Neue', sans-serif";
const MONO = "'DM Mono', 'Noto Sans Mono', 'Courier New', monospace";

const THEMES = {
  dark: {
    bg:"#03080f", surface:"#0b1421", surface2:"#071018", surface3:"#111e2e",
    border:"#162234", border2:"#0e1a28", borderAccent:"#1e3a5a",
    text:"#ddeeff", textSub:"#4e7090", textMuted:"#213344", textBright:"#f0f8ff",
    inputBg:"#060d18",
    headerBg:"linear-gradient(160deg,#04090f 0%,#07111e 50%,#0a162a 100%)",
    tabBg:"#060d18", scrollThumb:"#1a3352",
    cardGrad:"linear-gradient(145deg,#0b1421 0%,#071018 100%)",
    gold:"#f0c040",
  },
  light: {
    bg:"#f2f6fb", surface:"#ffffff", surface2:"#f7fafd", surface3:"#edf2f8",
    border:"#dce6f0", border2:"#e8eff7", borderAccent:"#b8d0e8",
    text:"#0d1e30", textSub:"#52789a", textMuted:"#a0bcd4", textBright:"#040d18",
    inputBg:"#eef3f9",
    headerBg:"linear-gradient(160deg,#0d2340 0%,#1a3a62 50%,#0d2340 100%)",
    tabBg:"#ffffff", scrollThumb:"#b0c8e0",
    cardGrad:"linear-gradient(145deg,#ffffff 0%,#f7fafd 100%)",
    gold:"#c89a20",
  }
};

function fmtINR(n) {
  const val = n ?? 0;
  const neg = val < 0;
  const num = Math.round(Math.abs(val));
  const RUPEE = "\u20B9";
  if (num === 0) return RUPEE + "0";
  const s = String(num);
  if (s.length <= 3) return (neg ? "-" : "") + RUPEE + s;
  let result = s.slice(-3);
  let rem = s.slice(0, -3);
  while (rem.length > 2) {
    result = rem.slice(-2) + "," + result;
    rem = rem.slice(0, -2);
  }
  return (neg ? "-" : "") + RUPEE + rem + "," + result;
}

const uid  = () => Math.random().toString(36).slice(2, 9);
const load = (k, fb) => { try { const r = localStorage.getItem(k); return r ? JSON.parse(r) : fb; } catch { return fb; } };
const save = (k, v)  => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

// FIX 1: * operators restored
function sipProjection(monthlyAmt, years, cagr) {
  const r = cagr / 100 / 12;
  const n = years * 12;
  if (r === 0) return monthlyAmt * n;
  return Math.round(monthlyAmt * ((Math.pow(1 + r, n) - 1) / r) * (1 + r));
}

function AnimNum({ value }) {
  const [disp, setDisp] = useState(0);
  const dispRef = useRef(0);
  const raf = useRef(null);
  useEffect(() => {
    const start = dispRef.current, end = value, t0 = performance.now();
    cancelAnimationFrame(raf.current);
    const step = t => {
      const p = Math.min((t - t0) / 700, 1);
      const e = 1 - Math.pow(1 - p, 3);
      const next = Math.round(start + (end - start) * e);
      dispRef.current = next;
      setDisp(next);
      if (p < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [value]);
  const RUPEE = "\u20B9";
  const fmt = fmtINR(disp);
  const digits = fmt.replace(RUPEE, "").replace("-", "");
  const prefix = fmt.replace(digits, "");
  return (
    <span>
      <span style={{ fontFamily: BODY, fontWeight: 700 }}>{prefix}</span>
      <span style={{ fontFamily: MONO, letterSpacing: "-0.5px" }}>{digits}</span>
    </span>
  );
}

function calcHealth({ income, outflow, goals, savePct, budgets, expenses, history, allCats }) {
  if (!income) return { score: 0, grade: " - ", color: "#4e7090", breakdown: [] };
  let score = 100;
  const bd = [];
  const cats = allCats || CATS;
  const sp = Math.min(35, Math.round(savePct / 100 * 35));
  score -= (35 - sp);
  bd.push({ label: "Savings Rate", pts: sp, max: 35, detail: Math.round(savePct) + "% of income saved" });
  let bp = 30;
  cats.forEach(c => {
    const bgt = budgets[c.id];
    if (!bgt) return;
    const spent = expenses.filter(e => e.category === c.id).reduce((s, e) => s + e.amount, 0);
    if (spent > bgt) bp -= 8;
    else if (spent / bgt > 0.9) bp -= 3;
  });
  bp = Math.max(0, bp);
  score -= (30 - bp);
  bd.push({ label: "Budget Adherence", pts: bp, max: 30, detail: bp === 30 ? "All budgets on track" : "Some exceeded" });
  const gp = goals.length === 0 ? 10 : Math.min(20, goals.filter(g => g.saved > 0).length / goals.length * 20);
  score -= (20 - Math.round(gp));
  bd.push({ label: "Goal Progress", pts: Math.round(gp), max: 20, detail: goals.filter(g => g.saved > 0).length + "/" + goals.length + " goals funded" });
  const cp = history.length === 0 ? 7 : Math.min(15, Math.round(history.filter(h => h.savings >= 0).length / history.length * 15));
  score -= (15 - cp);
  bd.push({ label: "Consistency", pts: cp, max: 15, detail: history.filter(h => h.savings >= 0).length + "/" + history.length + " months positive" });
  score = Math.max(0, Math.min(100, score));
  const grade = score >= 85 ? "A+" : score >= 75 ? "A" : score >= 65 ? "B+" : score >= 55 ? "B" : score >= 45 ? "C" : "D";
  const color = score >= 75 ? "#1dd1a1" : score >= 55 ? "#ffd32a" : score >= 40 ? "#ffa94d" : "#ff6b6b";
  return { score, grade, color, breakdown: bd };
}

function Donut({ segs, label, sub, theme }) {
  const [hov, setHov] = useState(null);
  const T = THEMES[theme];
  const total = segs.reduce((s, x) => s + x.value, 0);
  const cx = 90, cy = 90, r = 65, sw = 22;
  const toRad = d => d * Math.PI / 180;
  if (!total) return (
    <svg viewBox="0 0 180 180" style={{ width: "100%", maxWidth: 200 }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={T.border} strokeWidth={sw} strokeDasharray="6 4" />
      <text x={cx} y={cy} textAnchor="middle" fill={T.textMuted} fontSize="11" fontFamily={BODY}>No data</text>
    </svg>
  );
  let angle = -90;
  const arcs = segs.map(s => {
    const sweep = (s.value / total) * 360;
    const a = { ...s, a1: angle, a2: angle + sweep };
    angle += sweep + 2;
    return a;
  });
  return (
    <svg viewBox="0 0 180 180" style={{ width: "100%", maxWidth: 200 }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={T.border} strokeWidth={sw} />
      {arcs.map((arc, i) => {
        const isH = hov === i;
        const rr = isH ? r + 4 : r;
        // FIX 2: * operators restored
        const x1 = cx + rr * Math.cos(toRad(arc.a1)), y1 = cy + rr * Math.sin(toRad(arc.a1));
        const x2 = cx + rr * Math.cos(toRad(arc.a2)), y2 = cy + rr * Math.sin(toRad(arc.a2));
        const large = arc.a2 - arc.a1 > 180 ? 1 : 0;
        return (
          <path key={i}
            d={"M " + x1 + " " + y1 + " A " + rr + " " + rr + " 0 " + large + " 1 " + x2 + " " + y2}
            fill="none" stroke={arc.color} strokeWidth={isH ? sw + 4 : sw} strokeLinecap="round"
            style={{ filter: "drop-shadow(0 0 " + (isH ? 10 : 4) + "px " + arc.color + "88)", cursor: "pointer", transition: "all .2s" }}
            onMouseEnter={() => setHov(i)} onMouseLeave={() => setHov(null)}
          />
        );
      })}
      <circle cx={cx} cy={cy} r={r - sw / 2 - 3} fill={theme === "dark" ? "#060d18" : "#ffffff"} />
      {hov !== null ? (
        <>
          <text x={cx} y={cy - 7} textAnchor="middle" fill={arcs[hov].color} fontSize="9" fontFamily={BODY}>{arcs[hov].label}</text>
          <text x={cx} y={cy + 7} textAnchor="middle" fill={T.text} fontSize="11" fontWeight="700" fontFamily={MONO}>{fmtINR(arcs[hov].value)}</text>
          <text x={cx} y={cy + 20} textAnchor="middle" fill={T.textSub} fontSize="9" fontFamily={BODY}>{Math.round(arcs[hov].value / total * 100)}%</text>
        </>
      ) : (
        <>
          {label && <text x={cx} y={cy - 4} textAnchor="middle" fill={T.text} fontSize="11" fontWeight="700" fontFamily={MONO}>{label}</text>}
          {sub && <text x={cx} y={cy + 11} textAnchor="middle" fill={T.textSub} fontSize="9" fontFamily={BODY}>{sub}</text>}
        </>
      )}
    </svg>
  );
}

function TrendBar({ label, income, expenses, maxVal, isActive, onClick }) {
  const [hov, setHov] = useState(false);
  const iP = maxVal > 0 ? (income / maxVal) * 100 : 0;
  const eP = maxVal > 0 ? (expenses / maxVal) * 100 : 0;
  return (
    <div onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, flex: 1, position: "relative" }}>
      {hov && (
        <div style={{ position: "absolute", bottom: "108%", left: "50%", transform: "translateX(-50%)", background: "#0e1e35", border: "1px solid #1e3a5a", borderRadius: 8, padding: "6px 10px", zIndex: 10, whiteSpace: "nowrap", pointerEvents: "none" }}>
          <div style={{ fontSize: 10, color: "#1dd1a1", fontFamily: MONO }}>{fmtINR(income)}</div>
          <div style={{ fontSize: 10, color: "#ff6b6b", fontFamily: MONO }}>{fmtINR(expenses)}</div>
        </div>
      )}
      <div style={{ position: "relative", width: "100%", height: 90, display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 3 }}>
        <div style={{ width: "42%", height: iP + "%", minHeight: income > 0 ? 3 : 0, background: "linear-gradient(180deg,#1dd1a1,#10ac84)", borderRadius: "4px 4px 0 0", transition: "height .4s ease", opacity: isActive || hov ? 1 : 0.5 }} />
        <div style={{ width: "42%", height: eP + "%", minHeight: expenses > 0 ? 3 : 0, background: "linear-gradient(180deg,#ff6b6b,#c0392b)", borderRadius: "4px 4px 0 0", transition: "height .4s ease", opacity: isActive || hov ? 1 : 0.5 }} />
        {isActive && <div style={{ position: "absolute", inset: 0, border: "1.5px solid #1dd1a144", borderRadius: 6, pointerEvents: "none" }} />}
      </div>
      <span style={{ fontSize: 9, color: isActive ? "#1dd1a1" : hov ? "#c8d8f0" : "#4e7090", fontFamily: BODY, fontWeight: isActive ? 700 : 400 }}>{label}</span>
    </div>
  );
}

function StatCard({ title, value, sub, accent, icon, extra, theme }) {
  const [hov, setHov] = useState(false);
  const T = THEMES[theme];
  return (
    <div onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ position: "relative", borderRadius: 20, padding: "20px 22px", background: T.cardGrad, border: "1px solid " + (hov ? accent + "55" : T.border), boxShadow: hov ? "0 8px 32px " + accent + "22" : "0 2px 12px #00000033", transition: "all .3s", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: -30, right: -30, width: 120, height: 120, borderRadius: "50%", background: accent + "15", filter: "blur(30px)", opacity: hov ? 1 : 0.4, transition: "opacity .3s", pointerEvents: "none" }} />
      <div style={{ position: "relative" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: T.textSub, letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: BODY }}>{title}</span>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: accent + "22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, border: "1px solid " + accent + "33" }}>{icon}</div>
        </div>
        <div style={{ fontSize: 28, fontWeight: 800, color: accent, lineHeight: 1 }}>
          <AnimNum value={value} />
        </div>
        {sub && <div style={{ fontSize: 12, color: T.textSub, marginTop: 5, fontFamily: BODY }}>{sub}</div>}
        {extra}
      </div>
    </div>
  );
}

function Modal({ show, onClose, title, sub, children, wide }) {
  if (!show) return null;
  return (
    <div className="vmodal-wrap" onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(3,8,15,0.82)", backdropFilter: "blur(8px)" }} />
      <div className="vmodal-box" onClick={e => e.stopPropagation()} style={{ position: "relative", width: "100%", maxWidth: wide ? 560 : 480, maxHeight: "90vh", overflowY: "auto", background: "linear-gradient(145deg,#0b1421,#060d18)", border: "1px solid #162234", borderRadius: 24, padding: "28px 30px", boxShadow: "0 24px 80px #00000088" }}>
        <div style={{ position: "absolute", top: 0, left: 30, right: 30, height: 2, background: "linear-gradient(90deg,transparent,#1dd1a1,transparent)", borderRadius: 99 }} />
        <div style={{ width: 36, height: 4, borderRadius: 99, background: "#1e3a5a", margin: "0 auto 18px" }} />
        <div style={{ fontSize: 20, fontWeight: 800, color: "#f0f8ff", marginBottom: sub ? 4 : 20, fontFamily: TF }}>{title}</div>
        {sub && <div style={{ fontSize: 12, color: "#4e7090", marginBottom: 20, fontFamily: BODY }}>{sub}</div>}
        {children}
      </div>
    </div>
  );
}

function Toast({ show }) {
  return (
    <div style={{ position: "fixed", bottom: 26, right: 26, zIndex: 9999, background: "linear-gradient(135deg,#071510,#0a2018)", border: "1px solid #1dd1a144", borderRadius: 14, padding: "10px 18px", display: "flex", alignItems: "center", gap: 10, opacity: show ? 1 : 0, transform: show ? "translateY(0)" : "translateY(10px)", transition: "all .35s cubic-bezier(.34,1.56,.64,1)", pointerEvents: "none", boxShadow: "0 6px 24px #00000066" }}>
      <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#1dd1a1", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11 }}>✓</div>
      <span style={{ color: "#1dd1a1", fontSize: 13, fontWeight: 600, fontFamily: BODY }}>Vatsu saved your data</span>
    </div>
  );
}

function iStyle(T) {
  return { background: T.inputBg, border: "1px solid " + T.borderAccent, borderRadius: 12, padding: "11px 14px", color: T.text, fontSize: 14, fontFamily: BODY, width: "100%", outline: "none" };
}

function Field({ label, T, children }) {
  return (
    <div>
      <label style={{ fontSize: 12, color: T.textSub, fontWeight: 600, marginBottom: 6, display: "block", fontFamily: BODY }}>{label}</label>
      {children}
    </div>
  );
}

function Btn({ v = "ghost", onClick, children, full, style: sx = {}, theme: btnTheme }) {
  const base = { padding: "10px 18px", borderRadius: 12, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700, fontFamily: BODY, transition: "all .2s", width: full ? "100%" : undefined };
  const T = THEMES[btnTheme || "dark"];
  const variants = {
    primary: { background: "linear-gradient(135deg,#1dd1a1,#0abf8a)", color: "#02080f", boxShadow: "0 4px 18px #1dd1a144" },
    danger:  { background: "#ff6b6b18", color: "#ff6b6b", border: "1px solid #ff6b6b33" },
    ghost:   { background: T.surface3, color: T.textSub, border: "1px solid " + T.border },
    orange:  { background: "linear-gradient(135deg,#ffba5e,#e67e22)", color: "#07040a", boxShadow: "0 4px 18px #ffa94d44" },
  };
  return <button style={{ ...base, ...(variants[v] || variants.ghost), ...sx }} onClick={onClick}>{children}</button>;
}

function SwipeRow({ exp, onDelete, theme, allCats }) {
  const T = THEMES[theme];
  const cat = allCats.find(c => c.id === exp.category) || CATS[0];
  const [offset, setOffset] = useState(0);
  const [gone, setGone] = useState(false);
  const startX = useRef(null);
  const onTS = e => { startX.current = e.touches[0].clientX; };
  const onTM = e => { if (startX.current === null) return; const dx = e.touches[0].clientX - startX.current; if (dx < 0) setOffset(Math.max(dx, -90)); };
  const onTE = () => { if (offset < -70) { setGone(true); setTimeout(() => onDelete(exp.id), 280); } else setOffset(0); startX.current = null; };
  return (
    <div style={{ position: "relative", overflow: "hidden", borderRadius: 13, marginBottom: 6 }}>
      <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 70, background: "linear-gradient(135deg,#c0392b,#ff6b6b)", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "0 13px 13px 0" }}>
        <span style={{ fontSize: 18 }}>🗑️</span>
      </div>
      <div onTouchStart={onTS} onTouchMove={onTM} onTouchEnd={onTE}
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 14px", background: T.surface, borderRadius: 13, border: "1px solid " + T.border2, transition: offset === 0 ? "all .3s" : "none", transform: "translateX(" + (gone ? -100 : offset) + "px)", opacity: gone ? 0 : 1, gap: 10 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: cat.color + "22", border: "1px solid " + cat.color + "44", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{cat.icon}</div>
          <div>
            <div style={{ fontSize: 14, color: T.text, fontWeight: 600, fontFamily: BODY }}>{exp.description}</div>
            <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2, fontFamily: BODY }}>{exp.date}{exp.recurringId ? " · 🔄" : ""}{exp.goalId ? " · 🎯" : ""}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ padding: "2px 9px", borderRadius: 20, background: cat.color + "22", color: cat.color, fontSize: 11, fontWeight: 700, fontFamily: BODY }}>{cat.label}</span>
          <span style={{ fontWeight: 700, color: T.text, minWidth: 80, textAlign: "right", fontFamily: MONO, fontSize: 14 }}>{fmtINR(exp.amount)}</span>
          <button onClick={() => onDelete(exp.id)} style={{ background: "#ff6b6b18", border: "none", color: "#ff6b6b", borderRadius: 8, width: 28, height: 28, cursor: "pointer", fontSize: 12 }}>✕</button>
        </div>
      </div>
    </div>
  );
}

const CHALL = [
  { id:"no_food", label:"No Eating Out Week", icon:"🥗", color:"#ff9f43", diff:"Medium", xp:150, days:7,
    desc:"Cut restaurants & food delivery for 7 days.",
    why:"Indians spend 25-35% of food budget eating out. One week off saves ₹2,000-₹5,000.",
    tips:["Meal prep on Sunday","Keep healthy snacks ready","Discover easy home recipes"],
    badge:"🥗 Home Chef",
    getP: cur => cur.expenses.filter(e => e.category === "food" && !e.recurringId).reduce((s,e) => s + e.amount, 0),
    isWin: p => p === 0,
    pct: p => p === 0 ? 100 : 0,
    metric: p => p === 0 ? "No dining out yet – great start!" : fmtINR(p) + " spent on dining (target: ₹0)",
  },
  { id:"rule50", label:"50% Rule Month", icon:"⚖️", color:"#54a0ff", diff:"Hard", xp:300, days:30,
    desc:"Keep total expenses under 50% of income for the month.",
    why:"The 50/30/20 rule is the gold standard. Needs < 50% = financial freedom.",
    tips:["Track every purchase","Identify top 3 non-essentials","Automate savings first"],
    badge:"⚖️ Balance Master",
    getP: (cur, inc) => inc > 0 ? Math.round(cur.expenses.reduce((s,e) => s + e.amount, 0) / inc * 100) : 0,
    isWin: (p, inc) => inc > 0 && p <= 50,
    pct: (p, inc) => inc === 0 ? 0 : Math.min(100, Math.max(0, 100 - Math.max(0, p - 30))),
    metric: (p, inc) => inc > 0 ? p + "% of income spent (target: <=50%)" : "Add income to track",
  },
  { id:"sub_cut", label:"Subscription Slayer", icon:"✂️", color:"#00d2d3", diff:"Easy", xp:100, days:30,
    desc:"Review all subscriptions and cancel at least one unused service this month.",
    why:"Average Indian pays for 4-6 subscriptions but actively uses only 2-3.",
    tips:["List every subscription with cost","Check last login date for each","Cancel anything unused in 30 days"],
    badge:"✂️ Subscription Slayer",
    getP: cur => cur.expenses.filter(e => e.category === "subscriptions").reduce((s,e) => s + e.amount, 0),
    isWin: p => p === 0,
    pct: p => p === 0 ? 100 : 50,
    metric: p => p === 0 ? "No subscriptions logged – audit complete!" : fmtINR(p) + "/month on subscriptions – review these",
  },
  { id:"save10k", label:"Save ₹10,000 Sprint", icon:"🏆", color:"#1dd1a1", diff:"Hard", xp:400, days:30,
    desc:"Contribute ₹10,000 to any savings goal this month.",
    why:"₹10,000/month x 10 years at 12% = ₹23 Lakhs. Starting today matters most.",
    tips:["Treat savings as first expense","Split across multiple goals","Cut one luxury to fund this"],
    badge:"🏆 Savings Champion",
    getP: cur => cur.expenses.filter(e => e.category === "savings").reduce((s,e) => s + e.amount, 0),
    isWin: p => p >= 10000,
    pct: p => Math.min(100, Math.round(p / 10000 * 100)),
    metric: p => fmtINR(p) + " saved (target: " + fmtINR(10000) + ")",
  },
  { id:"green_go", label:"Green Commute Week", icon:"🚲", color:"#00b894", diff:"Medium", xp:200, days:7,
    desc:"Keep transport spending under ₹500 for 7 days. Walk, cycle, or carpool.",
    why:"Cutting transport costs for one week saves ₹500-₹3,000 depending on your city.",
    tips:["Use metro/bus instead of cab","Combine errands into single trips","Try WFH days if possible"],
    badge:"🌱 Eco Commuter",
    getP: cur => cur.expenses.filter(e => e.category === "transport").reduce((s,e) => s + e.amount, 0),
    isWin: p => p <= 500,
    pct: p => p === 0 ? 100 : Math.min(100, Math.max(0, Math.round((1 - p / 2000) * 100))),
    metric: p => p <= 500 ? fmtINR(p) + " on transport – target met!" : fmtINR(p) + " on transport (target: <=₹500)",
  },
  { id:"no_impulse", label:"Zero Impulse Month", icon:"🧘", color:"#cd84f1", diff:"Hard", xp:350, days:30,
    desc:"Keep shopping expenses under ₹1,000 this month by applying the 24-hour rule.",
    why:"Impulse purchases account for 40% of unplanned shopping. The 24-hour rule eliminates most.",
    tips:["Remove saved cards from shopping apps","Unsubscribe from promotional emails","Use a wishlist – buy only after 30 days"],
    badge:"🧘 Mindful Spender",
    getP: cur => cur.expenses.filter(e => e.category === "shopping").reduce((s,e) => s + e.amount, 0),
    isWin: p => p <= 1000,
    pct: p => p === 0 ? 100 : Math.min(100, Math.max(0, Math.round((1 - p / 5000) * 100))),
    metric: p => p <= 1000 ? fmtINR(p) + " on shopping – impulse controlled!" : fmtINR(p) + " on shopping (target: <=₹1,000)",
  },
];

function xpLevel(xp) {
  const lvls = [
    { min:0,    label:"Rookie Saver",   icon:"🌱", color:"#a0c4e0" },
    { min:200,  label:"Budget Warrior", icon:"⚔️", color:"#ffd32a" },
    { min:500,  label:"Finance Pro",    icon:"💼", color:"#ff9f43" },
    { min:1000, label:"Money Master",   icon:"🏆", color:"#1dd1a1" },
    { min:2000, label:"Wealth Legend",  icon:"👑", color:"#cd84f1" },
  ];
  const cur = [...lvls].reverse().find(l => xp >= l.min) || lvls[0];
  const next = lvls[lvls.indexOf(cur) + 1];
  const pct = next ? Math.min(100, (xp - cur.min) / (next.min - cur.min) * 100) : 100;
  return { ...cur, next, pct, xp };
}

const DIFF_STYLE = {
  Easy:   { color:"#1dd1a1", bg:"#1dd1a122", stars:"★☆☆" },
  Medium: { color:"#ffd32a", bg:"#ffd32a22", stars:"★★☆" },
  Hard:   { color:"#ff6b6b", bg:"#ff6b6b22", stars:"★★★" },
};

const GCOLS = ["#1dd1a1","#54a0ff","#cd84f1","#ffd32a","#ff9f43","#00d2d3","#fd79a8","#a29bfe"];

export default function Vatsu() {
  const isMobile = useIsMobile();

  const [monthlyData,    setMonthlyData]   = useState(() => load("vatsu_monthly",   {}));
  const [recurring,      setRecurring]     = useState(() => load("vatsu_recurring", []));
  const [goals,          setGoals]         = useState(() => load("vatsu_goals",     []));
  const [loans,          setLoans]         = useState(() => load("vatsu_loans",     []));
  const [challenges,     setChallenges]    = useState(() => load("vatsu_challenges",[]));
  const [customCats,     setCustomCats]    = useState(() => load("vatsu_custom_cats",[]));
  const [theme,          setTheme]         = useState(() => load("vatsu_theme",     "dark"));

  const [activeMonth,    setActiveMonth]   = useState(THIS_MONTH);
  const [activeYear,     setActiveYear]    = useState(THIS_YEAR);
  const [tab,            setTab]           = useState("dashboard");
  const [showMore,       setShowMore]      = useState(false);
  const [toast,          setToast]         = useState(false);
  const [showIncome,     setShowIncome]    = useState(false);
  const [showBudget,     setShowBudget]    = useState(false);
  const [showLoan,       setShowLoan]      = useState(false);
  const [showCatModal,   setShowCatModal]  = useState(false);
  const [showManageCats, setShowManageCats]= useState(false);
  const [challDetail,    setChallDetail]   = useState(null);
  const [incForm,   setIncForm]  = useState({ label:"Monthly Salary", amount:"" });
  const [expForm,   setExpForm]  = useState({ description:"", amount:"", category:"food", isRecurring:false });
  const [smsText,      setSmsText    ] = useState("");
  const [smsResult,    setSmsResult  ] = useState(null);
  const [smsError,     setSmsError   ] = useState("");
  const [showSmsPanel, setShowSmsPanel] = useState(false);
  const [voiceActive,  setVoiceActive ] = useState(false);
  const [voiceText,    setVoiceText   ] = useState("");
  const [voiceResult,  setVoiceResult ] = useState(null);
  const [voiceError,   setVoiceError  ] = useState("");
  const [budgForm,  setBudgForm] = useState({});
  const [goalForm,  setGoalForm] = useState({ label:"", target:"", saved:"", deadline:"" });
  const [loanForm,  setLoanForm] = useState({ bankName:"", loanType:"Home Loan", principal:"", emi:"", interestRate:"", tenureMonths:"", startMonth:THIS_MONTH, startYear:THIS_YEAR });
  const [catForm,   setCatForm]  = useState({ label:"", icon:"📌", color:"#a29bfe" });
  const [contribs,  setContribs] = useState({});
  const [dlEdits,   set
