import { useState, useMemo, useEffect, useRef } from "react";

/* ─── Responsive hook ───────────────────────────────────────────────── */
function useIsMobile() {
  const [m, setM] = useState(() => typeof window !== "undefined" && window.innerWidth < 768);
  useEffect(() => {
    const h = () => setM(window.innerWidth < 768);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return m;
}

/* ─── Constants ─────────────────────────────────────────────────────── */
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
const TODAY      = NOW.getDate();

/* Font stack constants */
const TF   = "'Playfair Display', Georgia, serif";
const BODY = "'DM Sans', 'Helvetica Neue', sans-serif";
const MONO = "'DM Mono', 'Noto Sans Mono', 'Courier New', monospace";

/* ─── Theme ─────────────────────────────────────────────────────────── */
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

/* ─── INR formatter (lakh grouping, proper Unicode rupee sign) ──────── */
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

/* ─── Animated number counter ───────────────────────────────────────── */
function AnimNum({ value }) {
  const [disp, setDisp] = useState(0);
  const raf = useRef(null);
  useEffect(() => {
    const start = disp, end = value, t0 = performance.now();
    const step = t => {
      const p = Math.min((t - t0) / 700, 1);
      const e = 1 - Math.pow(1 - p, 3);
      setDisp(Math.round(start + (end - start) * e));
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

/* ─── Health score ───────────────────────────────────────────────────── */
function calcHealth({ income, outflow, goals, savePct, budgets, expenses, history, allCats }) {
  if (!income) return { score: 0, grade: "—", color: "#4e7090", breakdown: [] };
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

/* ─── Donut chart ────────────────────────────────────────────────────── */
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
    const sweep = (s.value / total) * 356;
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

/* ─── Trend bar (history chart) ─────────────────────────────────────── */
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

/* ─── Stat card ──────────────────────────────────────────────────────── */
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

/* ─── Modal ──────────────────────────────────────────────────────────── */
function Modal({ show, onClose, title, sub, children, wide }) {
  if (!show) return null;
  return (
    <div className="vmodal-wrap" onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(3,8,15,0.82)", backdropFilter: "blur(8px)" }} />
      <div className="vmodal-box" onClick={e => e.stopPropagation()} style={{ position: "relative", width: "100%", maxWidth: wide ? 560 : 480, maxHeight: "90vh", overflowY: "auto", background: "linear-gradient(145deg,#0b1421,#060d18)", border: "1px solid #162234", borderRadius: 24, padding: "28px 30px", boxShadow: "0 24px 80px #00000088", animation: "vModalIn .28s cubic-bezier(.34,1.56,.64,1)" }}>
        <div style={{ position: "absolute", top: 0, left: 30, right: 30, height: 2, background: "linear-gradient(90deg,transparent,#1dd1a1,transparent)", borderRadius: 99 }} />
        <div style={{ width: 36, height: 4, borderRadius: 99, background: "#1e3a5a", margin: "0 auto 18px" }} />
        <div style={{ fontSize: 20, fontWeight: 800, color: "#f0f8ff", marginBottom: sub ? 4 : 20, fontFamily: TF }}>{title}</div>
        {sub && <div style={{ fontSize: 12, color: "#4e7090", marginBottom: 20, fontFamily: BODY }}>{sub}</div>}
        {children}
      </div>
    </div>
  );
}

/* ─── Toast ──────────────────────────────────────────────────────────── */
function Toast({ show }) {
  return (
    <div style={{ position: "fixed", bottom: 26, right: 26, zIndex: 9999, background: "linear-gradient(135deg,#071510,#0a2018)", border: "1px solid #1dd1a144", borderRadius: 14, padding: "10px 18px", display: "flex", alignItems: "center", gap: 10, opacity: show ? 1 : 0, transform: show ? "translateY(0)" : "translateY(10px)", transition: "all .35s cubic-bezier(.34,1.56,.64,1)", pointerEvents: "none", boxShadow: "0 6px 24px #00000066" }}>
      <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#1dd1a1", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11 }}>✓</div>
      <span style={{ color: "#1dd1a1", fontSize: 13, fontWeight: 600, fontFamily: BODY }}>Vatsu saved your data</span>
    </div>
  );
}

/* ─── Shared input style factory ─────────────────────────────────────── */
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

function Btn({ v = "ghost", onClick, children, full, style: sx = {} }) {
  const base = { padding: "10px 18px", borderRadius: 12, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700, fontFamily: BODY, transition: "all .2s", width: full ? "100%" : undefined };
  const themes = {
    primary: { background: "linear-gradient(135deg,#1dd1a1,#0abf8a)", color: "#02080f", boxShadow: "0 4px 18px #1dd1a144" },
    danger:  { background: "#ff6b6b18", color: "#ff6b6b", border: "1px solid #ff6b6b33" },
    ghost:   { background: "#1a2e4a", color: "#7ab0d0" },
    orange:  { background: "linear-gradient(135deg,#ffba5e,#e67e22)", color: "#07040a", boxShadow: "0 4px 18px #ffa94d44" },
  };
  return <button style={{ ...base, ...(themes[v] || themes.ghost), ...sx }} onClick={onClick}>{children}</button>;
}

/* ─── Swipe-to-delete expense row ────────────────────────────────────── */
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

/* ─── Challenge templates ─────────────────────────────────────────────── */
const CHALL = [
  { id:"no_food", label:"No Eating Out Week", icon:"🥗", color:"#ff9f43", diff:"Medium", xp:150, days:7,
    desc:"Cut restaurants & food delivery for 7 days.",
    why:"Indians spend 25-35% of food budget eating out. One week off saves ₹2,000-₹5,000.",
    tips:["Meal prep on Sunday","Keep healthy snacks ready","Discover easy home recipes"],
    badge:"🥗 Home Chef",
    getP: cur => cur.expenses.filter(e => e.category === "food" && !e.recurringId).reduce((s,e) => s + e.amount, 0),
    isWin: p => p === 0,
    pct: p => p === 0 ? 100 : 0,
    metric: p => p === 0 ? "No dining out yet — great start!" : fmtINR(p) + " spent on dining (target: ₹0)",
  },
  { id:"rule50", label:"50% Rule Month", icon:"⚖️", color:"#54a0ff", diff:"Hard", xp:300, days:30,
    desc:"Keep total expenses under 50% of income for the month.",
    why:"The 50/30/20 rule is the gold standard. Needs < 50% = financial freedom.",
    tips:["Track every purchase","Identify top 3 non-essentials","Automate savings first"],
    badge:"⚖️ Balance Master",
    getP: (cur, inc) => inc > 0 ? Math.round(cur.expenses.reduce((s,e) => s + e.amount, 0) / inc * 100) : 0,
    isWin: (p, inc) => inc > 0 && p <= 50,
    pct: (p, inc) => inc === 0 ? 0 : Math.min(100, Math.max(0, 100 - Math.max(0, p - 30))),
    metric: (p, inc) => inc > 0 ? p + "% of income spent (target: ≤50%)" : "Add income to track",
  },
  { id:"sub_cut", label:"Subscription Slayer", icon:"✂️", color:"#00d2d3", diff:"Easy", xp:100, days:30,
    desc:"Review all subscriptions and cancel at least one unused service this month.",
    why:"Average Indian pays for 4-6 subscriptions but actively uses only 2-3.",
    tips:["List every subscription with cost","Check last login date for each","Cancel anything unused in 30 days"],
    badge:"✂️ Subscription Slayer",
    getP: cur => cur.expenses.filter(e => e.category === "subscriptions").reduce((s,e) => s + e.amount, 0),
    isWin: (p, inc, joined) => {
      // Win = user has manually marked it done via a challenge-specific flag
      // For now: win if subscriptions reduced vs last month or zero subs recorded
      return p === 0;
    },
    pct: p => p === 0 ? 100 : 50,
    metric: p => p === 0 ? "No subscriptions logged — audit complete!" : fmtINR(p) + "/month on subscriptions — review these",
  },
  { id:"save10k", label:"Save ₹10,000 Sprint", icon:"🏆", color:"#1dd1a1", diff:"Hard", xp:400, days:30,
    desc:"Contribute ₹10,000 to any savings goal this month.",
    why:"₹10,000/month × 10 years at 12% = ₹23 Lakhs. Starting today matters most.",
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
    metric: p => p <= 500 ? fmtINR(p) + " on transport — target met!" : fmtINR(p) + " on transport (target: ≤₹500)",
  },
  { id:"no_impulse", label:"Zero Impulse Month", icon:"🧘", color:"#cd84f1", diff:"Hard", xp:350, days:30,
    desc:"Keep shopping expenses under ₹1,000 this month by applying the 24-hour rule.",
    why:"Impulse purchases account for 40% of unplanned shopping. The 24-hour rule eliminates most.",
    tips:["Remove saved cards from shopping apps","Unsubscribe from promotional emails","Use a wishlist — buy only after 30 days"],
    badge:"🧘 Mindful Spender",
    getP: cur => cur.expenses.filter(e => e.category === "shopping").reduce((s,e) => s + e.amount, 0),
    isWin: p => p <= 1000,
    pct: p => p === 0 ? 100 : Math.min(100, Math.max(0, Math.round((1 - p / 5000) * 100))),
    metric: p => p <= 1000 ? fmtINR(p) + " on shopping — impulse controlled!" : fmtINR(p) + " on shopping (target: ≤₹1,000)",
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

/* ─── Goal colours ───────────────────────────────────────────────────── */
const GCOLS = ["#1dd1a1","#54a0ff","#cd84f1","#ffd32a","#ff9f43","#00d2d3","#fd79a8","#a29bfe"];
/* ─── MAIN APP ───────────────────────────────────────────────────────── */
export default function Vatsu() {
  const isMobile = useIsMobile();

  /* ── Persisted state — all loaded from localStorage on first render ── */
  const [monthlyData,   setMonthlyData]   = useState(() => load("vatsu_monthly",   {}));
  const [recurring,     setRecurring]     = useState(() => load("vatsu_recurring", []));
  const [goals,         setGoals]         = useState(() => load("vatsu_goals",     []));
  const [loans,         setLoans]         = useState(() => load("vatsu_loans",     []));
  const [challenges,    setChallenges]    = useState(() => load("vatsu_challenges",[]));
  const [customCats,    setCustomCats]    = useState(() => load("vatsu_custom_cats",[]));
  const [theme,         setTheme]         = useState(() => load("vatsu_theme",     "dark"));

  /* ── UI state ── */
  const [activeMonth,   setActiveMonth]   = useState(THIS_MONTH);
  const [activeYear]                      = useState(THIS_YEAR);
  const [tab,           setTab]           = useState("dashboard");
  const [toast,         setToast]         = useState(false);

  const [showIncome,    setShowIncome]    = useState(false);
  const [showBudget,    setShowBudget]    = useState(false);
  const [showLoan,      setShowLoan]      = useState(false);
  const [showCatModal,  setShowCatModal]  = useState(false);
  const [showManageCats,setShowManageCats]= useState(false);
  const [challDetail,   setChallDetail]   = useState(null);

  const [incForm,  setIncForm]  = useState({ label:"Monthly Salary", amount:"" });
  const [expForm,  setExpForm]  = useState({ description:"", amount:"", category:"food", isRecurring:false });
  const [budgForm, setBudgForm] = useState({});
  const [goalForm, setGoalForm] = useState({ label:"", target:"", saved:"", deadline:"" });
  const [loanForm, setLoanForm] = useState({ bankName:"", loanType:"Home Loan", principal:"", emi:"", interestRate:"", tenureMonths:"", startMonth:THIS_MONTH, startYear:THIS_YEAR });
  const [catForm,  setCatForm]  = useState({ label:"", icon:"📌", color:"#a29bfe" });
  const [contribs, setContribs] = useState({});   /* { [goalId]: inputValue } */
  const [dlEdits,  setDlEdits]  = useState({});   /* { [goalId]: "YYYY-MM-DD" } */

  const T  = THEMES[theme];
  const IS = iStyle(T);
  const mk = `${activeYear}-${activeMonth}`;

  /* ── Auto-save: every persisted slice writes back on change ── */
  function flash() { setToast(true); setTimeout(() => setToast(false), 2200); }
  useEffect(() => { save("vatsu_monthly",    monthlyData);  flash(); }, [monthlyData]);
  useEffect(() => { save("vatsu_recurring",  recurring);    flash(); }, [recurring]);
  useEffect(() => { save("vatsu_goals",      goals);        flash(); }, [goals]);
  useEffect(() => { save("vatsu_loans",      loans);        flash(); }, [loans]);
  useEffect(() => { save("vatsu_challenges", challenges);   flash(); }, [challenges]);
  useEffect(() => { save("vatsu_custom_cats",customCats);   flash(); }, [customCats]);
  useEffect(() => { save("vatsu_theme",      theme); },              [theme]);

  /* ── All categories = built-in + user's custom ones ── */
  const allCats = useMemo(() => [
    ...CATS,
    ...customCats.map(c => ({ ...c, glow: c.color + "55" })),
  ], [customCats]);

  /* ── Current month data with recurring expenses injected ── */
  const curMonth = useMemo(() => {
    const base = monthlyData[mk] || { incomeSources:[], expenses:[], budgets:{} };
    const existIds = new Set(base.expenses.filter(e => e.recurringId).map(e => e.recurringId));
    const injected = recurring
      .filter(r => !existIds.has(r.id))
      .map(r => ({ id: uid(), description: r.description, amount: r.amount, category: r.category, date: "Recurring", recurringId: r.id }));
    return { ...base, expenses: [...base.expenses, ...injected] };
  }, [monthlyData, mk, recurring]);

  /* ── Active loans this month ── */
  const activeLoans = useMemo(() => loans.filter(l => {
    const s = l.startYear * 12 + l.startMonth;
    const c = activeYear  * 12 + activeMonth;
    return c >= s && c < s + (l.tenureMonths || 9999);
  }), [loans, activeMonth, activeYear]);

  const totalEMI  = useMemo(() => activeLoans.reduce((s,l) => s + l.emi, 0), [activeLoans]);
  const totalInc  = useMemo(() => curMonth.incomeSources.reduce((s,x) => s + x.amount, 0), [curMonth]);
  const totalExp  = useMemo(() => curMonth.expenses.reduce((s,e) => s + e.amount, 0), [curMonth]);
  const totalOut  = totalExp + totalEMI;
  const remaining = totalInc - totalOut;
  const spentPct  = totalInc > 0 ? Math.min(100, totalOut / totalInc * 100) : 0;
  const savePct   = totalInc > 0 ? Math.max(0, (totalInc - totalOut) / totalInc * 100) : 0;

  /* ── Category breakdown for donut ── */
  const catBreak = useMemo(() => {
    const map = {};
    curMonth.expenses.forEach(e => { map[e.category] = (map[e.category] || 0) + e.amount; });
    return allCats.filter(c => map[c.id] > 0).map(c => ({ ...c, value: map[c.id] }));
  }, [curMonth, allCats]);

  /* ── Budget warnings ── */
  const warnings = useMemo(() => {
    const b = curMonth.budgets || {};
    return allCats.filter(c => {
      if (!b[c.id]) return false;
      const spent = curMonth.expenses.filter(e => e.category === c.id).reduce((s,e) => s + e.amount, 0);
      return spent / b[c.id] >= 0.9;
    }).map(c => {
      const spent = curMonth.expenses.filter(e => e.category === c.id).reduce((s,e) => s + e.amount, 0);
      return { ...c, spent, bgt: b[c.id], pct: Math.round(spent / b[c.id] * 100) };
    });
  }, [curMonth, allCats]);

  /* ── History months ── */
  const histMonths = useMemo(() => Object.keys(monthlyData).map(key => {
    const [y, m] = key.split("-").map(Number);
    const d = monthlyData[key];
    const inc = d.incomeSources.reduce((s,x) => s + x.amount, 0);
    const existIds = new Set(d.expenses.filter(e => e.recurringId).map(e => e.recurringId));
    const recAmt   = recurring.filter(r => !existIds.has(r.id)).reduce((s,r) => s + r.amount, 0);
    const emiAmt   = loans.filter(l => { const ls = l.startYear*12+l.startMonth, ca = y*12+m; return ca >= ls && ca < ls+(l.tenureMonths||9999); }).reduce((s,l) => s + l.emi, 0);
    const exp = d.expenses.reduce((s,x) => s + x.amount, 0) + recAmt + emiAmt;
    return { key, year: y, month: m, income: inc, expenses: exp, savings: inc - exp };
  }).sort((a,b) => a.year !== b.year ? a.year - b.year : a.month - b.month), [monthlyData, recurring, loans]);

  const maxHist = useMemo(() => Math.max(...histMonths.map(h => Math.max(h.income, h.expenses)), 1), [histMonths]);

  /* ── Overall Net Position (all-time, across every recorded month) ── */
  const netPosition = useMemo(() => {
    // Sum all-time income and expenses across every recorded month
    const allTimeInc  = histMonths.reduce((s,h) => s + h.income,   0);
    const allTimeExp  = histMonths.reduce((s,h) => s + h.expenses,  0);
    // Outstanding loan principal still to be paid
    const outstandingDebt = loans.reduce((s,l) => {
      // Estimate remaining principal: simple approximation = principal - (months elapsed × EMI)
      const monthsElapsed = Math.max(0, (THIS_YEAR*12+THIS_MONTH) - (l.startYear*12+l.startMonth));
      const paidSoFar     = Math.min(l.principal, monthsElapsed * l.emi);
      return s + Math.max(0, l.principal - paidSoFar);
    }, 0);
    // Money already saved inside goals
    const savedInGoals = goals.reduce((s,g) => s + (g.saved||0), 0);
    // Free cash = all income earned - all expenses paid
    const freeCash = allTimeInc - allTimeExp;
    // Net position = free cash - outstanding debt
    const net = freeCash - outstandingDebt;
    return { allTimeInc, allTimeExp, freeCash, outstandingDebt, savedInGoals, net, months: histMonths.length };
  }, [histMonths, loans, goals]);

  /* ── Health score ── */
  const health = useMemo(() => calcHealth({ income: totalInc, outflow: totalOut, goals, savePct, budgets: curMonth.budgets || {}, expenses: curMonth.expenses, history: histMonths, allCats }), [totalInc, totalOut, goals, savePct, curMonth, histMonths, allCats]);

  /* ── Challenges: active this month ── */
  const activeChalls = challenges.filter(c => c.month === activeMonth && c.year === activeYear);

  const allCompletedChalls = challenges.filter(c => {
    const tpl = CHALL.find(t => t.id === c.id);
    if (!tpl) return false;
    const mData = monthlyData[c.year + "-" + c.month] || { incomeSources:[], expenses:[] };
    // Only count as completed if the month has actual data (income or expenses)
    const hasMonthData = mData.incomeSources.length > 0 || mData.expenses.length > 0;
    if (!hasMonthData) return false;
    const mInc  = mData.incomeSources.reduce((s,x) => s + x.amount, 0);
    return tpl.isWin(tpl.getP(mData, mInc), mInc);
  });
  const totalXP     = allCompletedChalls.reduce((s,c) => { const t = CHALL.find(x => x.id === c.id); return s + (t ? t.xp : 0); }, 0);
  const lvl         = xpLevel(totalXP);
  const earnedBadges = [...new Set(allCompletedChalls.map(c => c.id))].map(id => CHALL.find(t => t.id === id)).filter(Boolean);

  const hc = remaining < 0 ? "#ff6b6b" : spentPct > 90 ? "#ffa94d" : spentPct > 70 ? "#ffd32a" : "#1dd1a1";

  /* ═══════════════════════════ MUTATIONS ═══════════════════════════ */

  function addIncome() {
    const amt = parseFloat(incForm.amount);
    if (!incForm.label.trim() || !amt || amt <= 0) return;
    setMonthlyData(p => {
      const m = p[mk] || { incomeSources:[], expenses:[], budgets:{} };
      return { ...p, [mk]: { ...m, incomeSources: [...m.incomeSources, { id: uid(), label: incForm.label.trim(), amount: amt }] } };
    });
    setIncForm({ label:"Monthly Salary", amount:"" });
    setShowIncome(false);
  }

  function removeIncome(id) {
    setMonthlyData(p => {
      const m = p[mk] || { incomeSources:[], expenses:[], budgets:{} };
      return { ...p, [mk]: { ...m, incomeSources: m.incomeSources.filter(x => x.id !== id) } };
    });
  }

  function addExpense() {
    const amt = parseFloat(expForm.amount);
    if (!expForm.description.trim() || !amt || amt <= 0) return;
    const ne = { id: uid(), description: expForm.description.trim(), amount: amt, category: expForm.category, date: new Date().toLocaleDateString("en-IN") };
    if (expForm.isRecurring) setRecurring(p => [...p, { id: uid(), description: ne.description, amount: amt, category: expForm.category }]);
    setMonthlyData(p => {
      const m = p[mk] || { incomeSources:[], expenses:[], budgets:{} };
      return { ...p, [mk]: { ...m, expenses: [...m.expenses, ne] } };
    });
    setExpForm(f => ({ description:"", amount:"", category: f.category, isRecurring: false }));
  }

  function deleteExpense(id) {
    setMonthlyData(p => {
      const m = p[mk] || { incomeSources:[], expenses:[], budgets:{} };
      return { ...p, [mk]: { ...m, expenses: m.expenses.filter(e => e.id !== id) } };
    });
  }

  function saveBudgets() {
    const parsed = {};
    Object.entries(budgForm).forEach(([k,v]) => { if (v) parsed[k] = parseFloat(v) || 0; });
    setMonthlyData(p => {
      const m = p[mk] || { incomeSources:[], expenses:[], budgets:{} };
      return { ...p, [mk]: { ...m, budgets: { ...m.budgets, ...parsed } } };
    });
    setShowBudget(false);
  }

  function addGoal() {
    const target = parseFloat(goalForm.target), saved = parseFloat(goalForm.saved) || 0;
    if (!goalForm.label.trim() || !target || target <= 0) return;
    setGoals(p => [...p, { id: uid(), label: goalForm.label.trim(), target, saved, deadline: goalForm.deadline || "", createdAt: new Date().toISOString() }]);
    setGoalForm({ label:"", target:"", saved:"", deadline:"" });
  }

  function contributeToGoal(goalId, amtStr) {
    const amt = parseFloat(amtStr);
    if (!amt || amt <= 0) return;
    const gLabel = goals.find(g => g.id === goalId)?.label || "Goal";
    setGoals(prev => prev.map(g => g.id !== goalId ? g : { ...g, saved: Math.min(g.target, g.saved + amt) }));
    const ne = { id: uid(), description: "\uD83C\uDFAF Goal: " + gLabel, amount: amt, category: "savings", date: new Date().toLocaleDateString("en-IN"), goalId };
    setMonthlyData(prev => {
      const m = prev[mk] || { incomeSources:[], expenses:[], budgets:{} };
      return { ...prev, [mk]: { ...m, expenses: [...m.expenses, ne] } };
    });
    setContribs(p => ({ ...p, [goalId]: "" }));
  }

  function deleteGoal(id) { setGoals(p => p.filter(g => g.id !== id)); }

  function saveDeadline(goalId, dateStr) {
    if (!dateStr) return;
    setGoals(prev => prev.map(g => g.id === goalId ? { ...g, deadline: dateStr } : g));
    setDlEdits(p => { const n = { ...p }; delete n[goalId]; return n; });
  }

  function addLoan() {
    const principal = parseFloat(loanForm.principal), emi = parseFloat(loanForm.emi);
    if (!loanForm.bankName.trim() || !principal || !emi) return;
    setLoans(p => [...p, { id: uid(), bankName: loanForm.bankName.trim(), loanType: loanForm.loanType, principal, emi, interestRate: parseFloat(loanForm.interestRate) || 0, tenureMonths: parseInt(loanForm.tenureMonths) || 0, startMonth: parseInt(loanForm.startMonth), startYear: parseInt(loanForm.startYear) }]);
    setLoanForm({ bankName:"", loanType:"Home Loan", principal:"", emi:"", interestRate:"", tenureMonths:"", startMonth:THIS_MONTH, startYear:THIS_YEAR });
    setShowLoan(false);
  }

  function deleteLoan(id) { setLoans(p => p.filter(l => l.id !== id)); }

  function addCustomCat() {
    if (!catForm.label.trim()) return;
    const id = "custom_" + uid();
    setCustomCats(p => [...p, { id, label: catForm.label.trim(), icon: catForm.icon || "📌", color: catForm.color || "#a29bfe", isCustom: true }]);
    setExpForm(f => ({ ...f, category: id }));
    setCatForm({ label:"", icon:"📌", color:"#a29bfe" });
    setShowCatModal(false);
  }

  function deleteCustomCat(id) {
    setCustomCats(p => p.filter(c => c.id !== id));
    setExpForm(f => f.category === id ? { ...f, category: "food" } : f);
  }

  function joinChallenge(tpl) {
    if (challenges.find(c => c.id === tpl.id && c.month === activeMonth && c.year === activeYear)) return;
    setChallenges(p => [...p, {
      id: tpl.id,
      label: tpl.label,
      icon: tpl.icon,
      month: activeMonth,
      year: activeYear,
      joined: new Date().toLocaleDateString("en-IN"),
    }]);
    setChallDetail(null);
  }

  function abandonChallenge(id) {
    setChallenges(p => p.filter(c => !(c.id === id && c.month === activeMonth && c.year === activeYear)));
  }

  /* ═══════════════════════════ RENDER ═══════════════════════════════ */
  return (
    <div style={{ minHeight:"100vh", background:T.bg, color:T.text, fontFamily:BODY, transition:"background .3s,color .3s" }}>
      <style>{[
        "@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700;800&family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&family=Noto+Sans+Mono:wght@400;500&display=swap');",
        "@keyframes vModalIn{from{opacity:0;transform:scale(.93) translateY(18px)}to{opacity:1;transform:scale(1) translateY(0)}}",
        "@keyframes vFadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}",
        "@keyframes vPulse{0%,100%{opacity:.5}50%{opacity:1}}",
        "@keyframes vFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}",
        "@keyframes vSlide{from{opacity:0;transform:translateX(-10px)}to{opacity:1;transform:translateX(0)}}",
        "*, *::before, *::after{box-sizing:border-box;margin:0;padding:0}",
        "::-webkit-scrollbar{width:4px;height:4px}",
        "::-webkit-scrollbar-track{background:" + T.bg + "}",
        "::-webkit-scrollbar-thumb{background:" + T.scrollThumb + ";border-radius:3px}",
        "html,body{font-family:'DM Sans','Helvetica Neue',sans-serif;font-size:16px;-webkit-text-size-adjust:100%}",
        "body{overscroll-behavior:none}",
        "input::placeholder,textarea::placeholder{color:" + T.textMuted + "}",
        "select option{background:" + T.surface + ";color:" + T.text + "}",
        "input[type=checkbox]{accent-color:#1dd1a1;width:16px;height:16px;cursor:pointer;flex-shrink:0}",
        "input:focus{border-color:#1dd1a1!important;box-shadow:0 0 0 3px #1dd1a115!important;outline:none}",
        "select:focus{border-color:#1dd1a1!important;outline:none}",
        "input[type=date]{color-scheme:dark}",
        "::selection{background:#1dd1a133;color:#ddeeff}",
        ".vrow:hover{background:" + T.surface3 + "!important;border-color:" + T.borderAccent + "!important}",
        ".vcard{background:" + T.cardGrad + ";border:1px solid " + T.border + ";border-radius:20px;padding:20px 22px;animation:vFadeUp .35s ease both}",
        ".vmodal-box{animation:vModalIn .28s cubic-bezier(.34,1.56,.64,1)}",
        ".vtab:hover{color:#7ecfb8!important}",
        "button:active{opacity:.8;transform:scale(.97)}",
        ".vbnav{display:none;position:fixed;bottom:0;left:0;right:0;background:" + T.surface + ";border-top:1px solid " + T.border + ";padding:8px 4px;padding-bottom:max(8px,env(safe-area-inset-bottom));z-index:200;backdrop-filter:blur(20px)}",
        ".vbnav-inner{display:flex;justify-content:space-around;align-items:center;max-width:600px;margin:0 auto}",
        ".vbnav-btn{display:flex;flex-direction:column;align-items:center;gap:3px;padding:6px 10px;border:none;background:none;cursor:pointer;border-radius:14px;transition:all .2s;min-width:52px;-webkit-tap-highlight-color:transparent}",
        ".vbnav-btn.active{background:#1dd1a120}",
        ".vdesktop-tabs{display:flex}",
        ".vmain{padding:24px 28px 90px;max-width:1180px;margin:0 auto}",
        "@media(max-width:767px){",
        "  .vbnav{display:block}",
        "  .vdesktop-tabs{display:none!important}",
        "  .vmain{padding:16px 12px 96px!important}",
        "  .vheader{padding:0 14px!important;flex-wrap:nowrap!important}",
        "  .vlogo-text{font-size:20px!important}",
        "  .vmonth-label{min-width:130px!important;font-size:13px!important}",
        "  .vscore-badge{display:none!important}",
        "  .vlogo-sub{display:none!important}",
        "  .vcard{padding:15px!important;border-radius:16px!important}",
        "  .vgrid{grid-template-columns:1fr!important;gap:12px!important}",
        "  .vstat-grid{grid-template-columns:1fr 1fr!important;gap:10px!important}",
        "  .vbudget-wheel{display:none!important}",
        "  .vmodal-box{position:fixed!important;bottom:0!important;left:0!important;right:0!important;top:auto!important;max-width:100%!important;border-radius:24px 24px 0 0!important;max-height:90vh!important;animation:none!important;padding-bottom:max(24px,env(safe-area-inset-bottom))!important}",
        "  .vmodal-wrap{align-items:flex-end!important}",
        "}",
        "@media(min-width:768px) and (max-width:1023px){.vmain{padding:20px!important}.vstat-grid{grid-template-columns:repeat(2,1fr)!important}.vgrid{grid-template-columns:repeat(2,1fr)!important}}",
      ].join("\n")}</style>

      <Toast show={toast} />

      {/* ── HEADER ── */}
      <header className="vheader" style={{ background:T.headerBg, borderBottom:"1px solid " + T.border, padding:"0 28px", display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:10, position:"sticky", top:0, zIndex:100, backdropFilter:"blur(14px)", boxShadow:"0 4px 24px #00000055" }}>
        <div style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 0" }}>
          <div style={{ animation:"vFloat 4s ease-in-out infinite" }}>
            <svg width="46" height="46" viewBox="0 0 50 50" fill="none">
              <defs>
                <radialGradient id="cg" cx="35%" cy="30%" r="70%">
                  <stop offset="0%" stopColor="#ffe066" />
                  <stop offset="55%" stopColor="#f4c542" />
                  <stop offset="100%" stopColor="#b8860b" />
                </radialGradient>
              </defs>
              <circle cx="25" cy="25" r="23" stroke="#1dd1a1" strokeWidth="1" strokeDasharray="5 3" opacity="0.5" style={{ animation:"vPulse 3s ease-in-out infinite" }} />
              <circle cx="25" cy="25" r="20" fill="url(#cg)" />
              <ellipse cx="19" cy="18" rx="5" ry="3" fill="white" opacity="0.18" transform="rotate(-25 19 18)" />
              <text x="25" y="31" textAnchor="middle" fontSize="17" fontWeight="900" fill="#7a5c00" fontFamily={BODY}>{"\u20B9"}</text>
              <rect x="32" y="36" width="2.5" height="5" rx="1" fill="#1dd1a1" />
              <rect x="35.5" y="33" width="2.5" height="8" rx="1" fill="#1dd1a1" />
              <rect x="39" y="29" width="2.5" height="12" rx="1" fill="#1dd1a1" />
              <polyline points="32,32 35.5,28 39,29" stroke="#1dd1a1" strokeWidth="1.2" fill="none" strokeLinecap="round" />
            </svg>
          </div>
          <div>
            <div className="vlogo-text" style={{ fontSize:24, fontWeight:800, color:T.textBright, fontFamily:TF, lineHeight:1 }}>Vatsu<span style={{ color:"#1dd1a1" }}>.</span></div>
            <div className="vlogo-sub" style={{ fontSize:9, color:T.textSub, letterSpacing:"0.2em", textTransform:"uppercase", marginTop:2, fontFamily:BODY }}>Personal Finance</div>
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:10, padding:"12px 0" }}>
          <div className="vscore-badge" style={{ padding:"5px 12px", borderRadius:20, background:health.color + "22", border:"1px solid " + health.color + "44", display:"flex", alignItems:"center", gap:6 }}>
            <span style={{ fontSize:11, color:health.color, fontWeight:700, fontFamily:BODY }}>Score {health.score}</span>
            <span style={{ fontSize:13, fontWeight:800, color:health.color, fontFamily:MONO }}>{health.grade}</span>
          </div>
          <button onClick={() => setTheme(t => t === "dark" ? "light" : "dark")} style={{ width:36, height:36, borderRadius:10, background:T.border, border:"none", cursor:"pointer", fontSize:17, display:"flex", alignItems:"center", justifyContent:"center" }}>
            {theme === "dark" ? "☀️" : "🌙"}
          </button>
          <button onClick={() => setActiveMonth(m => m === 0 ? 11 : m - 1)} style={{ background:T.border, border:"none", color:T.textSub, width:32, height:32, borderRadius:10, cursor:"pointer", fontSize:18, display:"flex", alignItems:"center", justifyContent:"center" }}>‹</button>
          <div className="vmonth-label" style={{ textAlign:"center", minWidth:160 }}>
            <div style={{ fontSize:15, fontWeight:700, color:T.textBright, fontFamily:TF }}>{MONTHS[activeMonth]} {activeYear}</div>
            {totalInc > 0 && <div style={{ fontSize:10, color:"#1dd1a1", fontFamily:MONO }}>{fmtINR(totalInc)}</div>}
          </div>
          <button onClick={() => setActiveMonth(m => m === 11 ? 0 : m + 1)} style={{ background:T.border, border:"none", color:T.textSub, width:32, height:32, borderRadius:10, cursor:"pointer", fontSize:18, display:"flex", alignItems:"center", justifyContent:"center" }}>›</button>
        </div>
      </header>

      {/* ── DESKTOP TABS ── */}
      <div className="vdesktop-tabs" style={{ background:T.tabBg, borderBottom:"1px solid " + T.border, padding:"0 28px", gap:2, overflowX:"auto" }}>
        {[["dashboard","📊 Dashboard"],["insights","🔍 Insights"],["history","📈 History"],["goals","🎯 Goals"],["loans","🏦 Loans"],["challenges","🏆 Challenges"],["advisor","🤖 AI Advisor"]].map(([id,lbl]) => (
          <button key={id} className="vtab" onClick={() => setTab(id)} style={{ padding:"12px 18px", fontSize:12, fontWeight:600, cursor:"pointer", border:"none", background:"none", color: tab === id ? "#2ee8a8" : T.textSub, borderBottom: tab === id ? "2px solid #2ee8a8" : "2px solid transparent", transition:"all .2s", fontFamily:BODY, whiteSpace:"nowrap", position:"relative" }}>
            {lbl}
            {id === "dashboard" && warnings.length > 0 && <span style={{ position:"absolute", top:8, right:6, width:7, height:7, borderRadius:"50%", background:"#ffa94d", animation:"vPulse 1.5s infinite" }} />}
          </button>
        ))}
      </div>

      {/* ── MOBILE BOTTOM NAV ── */}
      <nav className="vbnav">
        <div className="vbnav-inner">
          {[["dashboard","📊","Home"],["insights","🔍","Insights"],["goals","🎯","Goals"],["challenges","🏆","Challenges"],["advisor","🤖","Advisor"]].map(([id,icon,lbl]) => (
            <button key={id} className={"vbnav-btn" + (tab === id ? " active" : "")} onClick={() => setTab(id)}>
              <span style={{ fontSize:22 }}>{icon}</span>
              <span style={{ fontSize:9, fontWeight:600, fontFamily:BODY, color: tab === id ? "#2ee8a8" : T.textSub }}>{lbl}</span>
            </button>
          ))}
          <button className={"vbnav-btn" + (["history","loans"].includes(tab) ? " active" : "")} onClick={() => setTab(t => ["history","loans"].includes(t) ? "history" : t === "history" ? "loans" : "history")}>
            <span style={{ fontSize:22 }}>⋯</span>
            <span style={{ fontSize:9, fontWeight:600, fontFamily:BODY, color:["history","loans"].includes(tab) ? "#2ee8a8" : T.textSub }}>More</span>
          </button>
        </div>
      </nav>

      {/* ── WARNINGS BANNER ── */}
      {warnings.length > 0 && tab === "dashboard" && (
        <div style={{ background: theme === "dark" ? "linear-gradient(90deg,#1a0800,#1a0e00)" : "#fff8f0", borderBottom:"1px solid #ffa94d33", padding:"10px 28px", display:"flex", flexWrap:"wrap", gap:10 }}>
          {warnings.map(w => (
            <div key={w.id} style={{ display:"flex", alignItems:"center", gap:8, background:"#ffa94d15", border:"1px solid #ffa94d44", borderRadius:10, padding:"7px 14px" }}>
              <span style={{ animation:"vPulse 1.5s infinite", display:"inline-block" }}>⚠️</span>
              <span style={{ fontSize:12, color:"#ffba5e", fontFamily:BODY, fontWeight:500 }}><b>{w.label}</b> at {w.pct}% — {fmtINR(w.spent)} of {fmtINR(w.bgt)}</span>
            </div>
          ))}
        </div>
      )}

      {/* ═══════════════════ MAIN CONTENT ═══════════════════ */}
      <main className="vmain">

        {/* ── DASHBOARD ── */}
        {tab === "dashboard" && (
          <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
            {/* Stat cards */}
            <div className="vstat-grid" style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(210px,1fr))", gap:14 }}>
              <StatCard title="Total Income" value={totalInc} sub={curMonth.incomeSources.length + " source(s)"} accent="#1dd1a1" icon="💵" theme={theme}
                extra={<Btn v="primary" full onClick={() => setShowIncome(true)} sx={{ marginTop:12, fontSize:12, padding:"8px 12px" }}>+ Add Income</Btn>} />
              <StatCard title="Expenses" value={totalExp} sub={curMonth.expenses.length + " items"} accent="#ff6b6b" icon="💸" theme={theme} />
              <StatCard title="EMI This Month" value={totalEMI} sub={activeLoans.length + " active loan(s)"} accent="#ffa94d" icon="🏦" theme={theme} />
              <StatCard title="Remaining" value={Math.abs(remaining)} sub={remaining < 0 ? "⚠️ Over budget!" : spentPct > 90 ? "🔴 Critical" : spentPct > 70 ? "🟡 Caution" : "🟢 On track"} accent={hc} icon={remaining < 0 ? "🚨" : "✅"} theme={theme} />
            </div>


            {/* ── NET FINANCIAL POSITION (all-time) ── */}
            {netPosition.months > 0 && (() => {
              const { allTimeInc, allTimeExp, freeCash, outstandingDebt, savedInGoals, net } = netPosition;
              const isPositive = net >= 0;
              const netColor   = net > 0 ? "#1dd1a1" : net === 0 ? "#ffd32a" : "#ff6b6b";
              const statusLabel= net > 0 ? "Net Positive" : net === 0 ? "Break Even" : "Net Negative";
              const statusIcon = net > 0 ? "✅" : net === 0 ? "⚖️" : "⚠️";
              const overallSavePct = allTimeInc > 0 ? Math.round((freeCash / allTimeInc) * 100) : 0;
              return (
                <div style={{ background:"linear-gradient(135deg,#060f1c,#0a1628)", border:"1.5px solid "+netColor+"44", borderRadius:20, padding:"22px 24px", position:"relative", overflow:"hidden", boxShadow:"0 8px 32px "+netColor+"18" }}>
                  <div style={{ position:"absolute", top:-50, right:-50, width:220, height:220, borderRadius:"50%", background:netColor+"08", filter:"blur(60px)", pointerEvents:"none" }} />
                  {/* Header */}
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:16, flexWrap:"wrap", gap:10, position:"relative" }}>
                    <div>
                      <div style={{ fontSize:11, fontWeight:700, color:T.textSub, letterSpacing:"0.12em", textTransform:"uppercase", marginBottom:3, fontFamily:BODY }}>💼 Overall Net Position</div>
                      <div style={{ fontSize:11, color:T.textMuted, fontFamily:BODY }}>All-time across {netPosition.months} recorded month{netPosition.months !== 1 ? "s" : ""}</div>
                    </div>
                    <span style={{ padding:"5px 14px", borderRadius:20, background:netColor+"22", border:"1px solid "+netColor+"44", fontSize:11, fontWeight:700, color:netColor, fontFamily:BODY, whiteSpace:"nowrap" }}>
                      {statusIcon} {statusLabel}
                    </span>
                  </div>
                  {/* Big number */}
                  <div style={{ marginBottom:18, position:"relative" }}>
                    <div style={{ fontSize:11, color:T.textSub, fontFamily:BODY, marginBottom:4 }}>
                      {isPositive ? "Net Surplus — Free Cash after all outstanding debt" : "Net Deficit — Outstanding debt exceeds your free cash"}
                    </div>
                    <div style={{ display:"flex", alignItems:"baseline", gap:8, flexWrap:"wrap" }}>
                      <span style={{ fontSize:34, fontWeight:800, color:netColor, fontFamily:MONO, lineHeight:1, letterSpacing:"-1px" }}>
                        {net < 0 ? "-" : ""}{fmtINR(Math.abs(net))}
                      </span>
                      {allTimeInc > 0 && (
                        <span style={{ fontSize:13, color:netColor+"bb", fontFamily:BODY, fontWeight:600 }}>
                          ({overallSavePct >= 0 ? "+" : ""}{overallSavePct}% of lifetime income)
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Breakdown tiles */}
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))", gap:10, marginBottom:16 }}>
                    {[
                      { label:"Total Earned",    value:allTimeInc,     color:"#1dd1a1", icon:"💵", tip:"All income across every recorded month" },
                      { label:"Total Spent",     value:allTimeExp,     color:"#ff6b6b", icon:"💸", tip:"All expenses across every recorded month" },
                      { label:"Free Cash",       value:freeCash,       color:freeCash>=0?"#54a0ff":"#ff6b6b", icon:"💼", tip:"Total earned minus total spent" },
                      { label:"Debt Remaining",  value:outstandingDebt,color:"#ffa94d", icon:"🏦", tip:"Estimated remaining loan principal" },
                      { label:"Saved in Goals",  value:savedInGoals,   color:"#cd84f1", icon:"🎯", tip:"Total contributed to all savings goals" },
                    ].map(item => (
                      <div key={item.label} title={item.tip} style={{ padding:"11px 13px", background:T.surface2+"cc", borderRadius:12, border:"1px solid "+item.color+"22" }}>
                        <div style={{ fontSize:15, marginBottom:4 }}>{item.icon}</div>
                        <div style={{ fontSize:14, fontWeight:800, color:item.color, fontFamily:MONO, lineHeight:1 }}>{fmtINR(item.value)}</div>
                        <div style={{ fontSize:10, color:T.textSub, marginTop:4, fontFamily:BODY, lineHeight:1.4 }}>{item.label}</div>
                      </div>
                    ))}
                  </div>
                  {/* Visual bar */}
                  {allTimeInc > 0 && (
                    <div style={{ marginBottom:14 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                        <span style={{ fontSize:11, color:T.textSub, fontFamily:BODY }}>Lifetime Earnings Allocation</span>
                        <span style={{ fontSize:11, fontWeight:700, color:netColor, fontFamily:MONO }}>{Math.round(Math.min(100,(allTimeExp/allTimeInc)*100))}% spent</span>
                      </div>
                      <div style={{ height:10, background:T.border, borderRadius:99, overflow:"hidden", position:"relative" }}>
                        <div style={{ position:"absolute", left:0, height:"100%", width:Math.min(100,(allTimeExp/allTimeInc)*100)+"%", background:"linear-gradient(90deg,#c0392b,#ff6b6b)", borderRadius:99, transition:"width .9s ease" }} />
                        {outstandingDebt > 0 && <div style={{ position:"absolute", left:Math.min(100,(allTimeExp/allTimeInc)*100)+"%", height:"100%", width:Math.min(100,(outstandingDebt/allTimeInc)*100)+"%", background:"linear-gradient(90deg,#e67e22,#ffa94d)", transition:"width .9s ease" }} />}
                      </div>
                      <div style={{ display:"flex", gap:12, marginTop:6, flexWrap:"wrap" }}>
                        <span style={{ fontSize:10, color:"#ff6b6b", fontFamily:BODY }}>■ Spent {fmtINR(allTimeExp)}</span>
                        {outstandingDebt > 0 && <span style={{ fontSize:10, color:"#ffa94d", fontFamily:BODY }}>■ Debt {fmtINR(outstandingDebt)}</span>}
                        <span style={{ fontSize:10, color:"#1dd1a1", fontFamily:BODY }}>■ Free {fmtINR(Math.max(0,freeCash))}</span>
                      </div>
                    </div>
                  )}
                  {/* Insight tip */}
                  <div style={{ padding:"10px 14px", background:netColor+"0e", border:"1px solid "+netColor+"22", borderRadius:10 }}>
                    <span style={{ fontSize:12, color:netColor, fontFamily:BODY, lineHeight:1.6 }}>
                      {net > 0
                        ? "Your free cash of " + fmtINR(freeCash) + " minus outstanding debt (" + fmtINR(outstandingDebt) + ") leaves you with a net surplus of " + fmtINR(net) + ". Consider investing this surplus!"
                        : net < 0
                        ? "Your debt of " + fmtINR(outstandingDebt) + " exceeds your free cash by " + fmtINR(Math.abs(net)) + ". Focus on prepaying your highest-interest loan first."
                        : "You are exactly at break-even. Grow your surplus by reducing monthly expenses or boosting income."
                      }
                    </span>
                  </div>
                </div>
              );
            })()}

            {/* Progress bar */}
            {totalInc > 0 && (
              <div className="vcard" style={{ background:T.cardGrad }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:12, flexWrap:"wrap", gap:8 }}>
                  <span style={{ fontSize:11, fontWeight:700, color:T.textSub, letterSpacing:"0.1em", textTransform:"uppercase", fontFamily:BODY }}>Monthly Budget Health</span>
                  <div style={{ display:"flex", gap:14, flexWrap:"wrap" }}>
                    <span style={{ fontSize:11, color:"#ff6b6b", fontFamily:BODY }}>▮ Expenses {fmtINR(totalExp)}</span>
                    {totalEMI > 0 && <span style={{ fontSize:11, color:"#ffa94d", fontFamily:BODY }}>▮ EMI {fmtINR(totalEMI)}</span>}
                    <span style={{ fontSize:11, color:"#1dd1a1", fontFamily:BODY }}>▮ Left {fmtINR(Math.max(0,remaining))}</span>
                  </div>
                </div>
                <div style={{ height:14, background:T.border2, borderRadius:99, overflow:"hidden", position:"relative" }}>
                  <div style={{ position:"absolute", left:0, height:"100%", width:(totalExp/totalInc*100) + "%", background:"linear-gradient(90deg,#c0392b,#ff6b6b)", borderRadius:99, transition:"width .8s ease" }} />
                  {totalEMI > 0 && <div style={{ position:"absolute", left:(totalExp/totalInc*100) + "%", height:"100%", width:(totalEMI/totalInc*100) + "%", background:"linear-gradient(90deg,#e67e22,#ffa94d)", transition:"width .8s ease" }} />}
                </div>
                <div style={{ display:"flex", justifyContent:"space-between", marginTop:7 }}>
                  <span style={{ fontSize:11, color:T.textMuted, fontFamily:BODY }}>0%</span>
                  <span style={{ fontSize:12, color:hc, fontWeight:700, fontFamily:MONO }}>{Math.round(spentPct)}% used</span>
                  <span style={{ fontSize:11, color:T.textMuted, fontFamily:BODY }}>100%</span>
                </div>
              </div>
            )}

            {/* Income sources */}
            {curMonth.incomeSources.length > 0 && (
              <div className="vcard" style={{ background:T.cardGrad, borderColor:"#1a3a28" }}>
                <div style={{ fontSize:11, fontWeight:700, color:T.textSub, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:14, fontFamily:BODY }}>Income Sources — {MONTHS[activeMonth]}</div>
                {curMonth.incomeSources.map(s => (
                  <div key={s.id} className="vrow" style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"9px 14px", background:T.surface2, borderRadius:12, border:"1px solid " + T.border2, marginBottom:6, transition:"all .2s" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                      <div style={{ width:30, height:30, borderRadius:8, background:"#1dd1a122", display:"flex", alignItems:"center", justifyContent:"center", fontSize:15 }}>💼</div>
                      <span style={{ color:T.text, fontSize:14, fontFamily:BODY }}>{s.label}</span>
                    </div>
                    <div style={{ display:"flex", gap:10, alignItems:"center" }}>
                      <span style={{ color:"#1dd1a1", fontWeight:700, fontSize:15, fontFamily:MONO }}>{fmtINR(s.amount)}</span>
                      <button onClick={() => removeIncome(s.id)} style={{ background:"#ff6b6b18", border:"none", color:"#ff6b6b", borderRadius:8, width:28, height:28, cursor:"pointer", fontSize:12 }}>✕</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Expense form + Donut */}
            <div className="vgrid" style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(300px,1fr))", gap:18 }}>
              <div className="vcard" style={{ background:T.cardGrad }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
                  <div style={{ fontSize:11, fontWeight:700, color:T.textSub, letterSpacing:"0.1em", textTransform:"uppercase", fontFamily:BODY }}>Add Expense</div>
                  <div style={{ display:"flex", gap:8 }}>
                    {customCats.length > 0 && <button onClick={() => setShowManageCats(true)} style={{ fontSize:11, padding:"5px 10px", borderRadius:9, background:T.border, border:"none", color:T.textSub, cursor:"pointer", fontFamily:BODY }}>🏷️ My Cats</button>}
                    <Btn onClick={() => { setBudgForm(curMonth.budgets || {}); setShowBudget(true); }} sx={{ fontSize:11, padding:"6px 12px" }}>⚙ Budgets</Btn>
                  </div>
                </div>
                <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                  <Field label="Description" T={T}>
                    <input style={IS} placeholder="e.g. Swiggy, Petrol, Movie…" value={expForm.description} onChange={e => setExpForm(p => ({ ...p, description: e.target.value }))} />
                  </Field>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                    <Field label={"Amount (\u20B9)"} T={T}>
                      <input style={IS} type="number" placeholder="0" value={expForm.amount} onChange={e => setExpForm(p => ({ ...p, amount: e.target.value }))} />
                    </Field>
                    <Field label="Category" T={T}>
                      <div style={{ display:"flex", gap:6 }}>
                        <select style={{ ...IS, flex:1 }} value={expForm.category} onChange={e => setExpForm(p => ({ ...p, category: e.target.value }))}>
                          <optgroup label="Built-in">
                            {CATS.map(c => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
                          </optgroup>
                          {customCats.length > 0 && (
                            <optgroup label="My Categories">
                              {customCats.map(c => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
                            </optgroup>
                          )}
                        </select>
                        <button title="Create category" onClick={() => setShowCatModal(true)} style={{ flexShrink:0, width:40, height:40, borderRadius:10, background:"linear-gradient(135deg,#1dd1a1,#0abf8a)", border:"none", cursor:"pointer", fontSize:19, display:"flex", alignItems:"center", justifyContent:"center" }}>＋</button>
                      </div>
                    </Field>
                  </div>
                  <label style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer", color:T.textSub, fontSize:13, userSelect:"none", fontFamily:BODY }}>
                    <input type="checkbox" checked={expForm.isRecurring} onChange={e => setExpForm(p => ({ ...p, isRecurring: e.target.checked }))} />
                    Recurring — auto-add every month
                  </label>
                  <Btn v="primary" full onClick={addExpense}>+ Add Expense</Btn>
                </div>
              </div>

              <div className="vcard" style={{ background:T.cardGrad }}>
                <div style={{ fontSize:11, fontWeight:700, color:T.textSub, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:14, fontFamily:BODY }}>Spending Breakdown <span style={{ color:T.textMuted, fontSize:10, fontWeight:400 }}>(hover)</span></div>
                <div style={{ display:"flex", gap:14, alignItems:"center", flexWrap:"wrap" }}>
                  <div style={{ flex:"0 0 170px" }}>
                    <Donut segs={catBreak} label={fmtINR(totalExp)} sub="total spent" theme={theme} />
                  </div>
                  <div style={{ flex:1, display:"flex", flexDirection:"column", gap:9, minWidth:130 }}>
                    {catBreak.map(c => {
                      const bgt = (curMonth.budgets||{})[c.id];
                      const p   = bgt ? Math.min(100, c.value / bgt * 100) : null;
                      return (
                        <div key={c.id}>
                          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                            <span style={{ fontSize:12, color:T.textSub, fontFamily:BODY }}>{c.icon} {c.label}</span>
                            <span style={{ fontSize:12, fontWeight:700, color:c.color, fontFamily:MONO }}>{fmtINR(c.value)}</span>
                          </div>
                          {p !== null && (
                            <>
                              <div style={{ height:5, background:T.border2, borderRadius:99 }}>
                                <div style={{ height:5, width:p + "%", background: p >= 90 ? "#ff6b6b" : c.color, borderRadius:99, transition:"width .5s" }} />
                              </div>
                              <div style={{ fontSize:10, color:T.textMuted, marginTop:2, fontFamily:BODY }}>Budget: {fmtINR(bgt)}</div>
                            </>
                          )}
                        </div>
                      );
                    })}
                    {catBreak.length === 0 && <span style={{ color:T.textMuted, fontSize:13, fontFamily:BODY }}>No expenses yet</span>}
                  </div>
                </div>
              </div>
            </div>

            {/* Expense list */}
            <div className="vcard" style={{ background:T.cardGrad }}>
              <div style={{ fontSize:11, fontWeight:700, color:T.textSub, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:14, fontFamily:BODY }}>
                All Expenses — {MONTHS[activeMonth]}
                <span style={{ color:T.textMuted, fontSize:10, fontWeight:400, marginLeft:8 }}>Swipe left on mobile to delete</span>
              </div>
              {curMonth.expenses.length === 0
                ? <div style={{ textAlign:"center", padding:"28px 0", color:T.textMuted }}><div style={{ fontSize:34, marginBottom:8 }}>📋</div><div style={{ fontFamily:BODY }}>No expenses yet</div></div>
                : [...curMonth.expenses].reverse().map(e => <SwipeRow key={e.id} exp={e} onDelete={deleteExpense} theme={theme} allCats={allCats} />)
              }
            </div>
          </div>
        )}

        {/* ── INSIGHTS ── */}
        {tab === "insights" && (
          <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
            {/* Snapshot strip */}
            <div className="vcard" style={{ background:"linear-gradient(135deg,#0a1628,#0d1f38)" }}>
              <div style={{ fontSize:11, fontWeight:700, color:T.textSub, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:16, fontFamily:BODY }}>📊 Snapshot — {MONTHS[activeMonth]}</div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(100px,1fr))", gap:12 }}>
                {[
                  { lbl:"Income",       val:totalInc,         color:"#1dd1a1", icon:"💵" },
                  { lbl:"Spent",        val:totalExp,         color:"#ff6b6b", icon:"💸" },
                  { lbl:"Remaining",    val:totalInc-totalOut, color:remaining>=0?"#1dd1a1":"#ff6b6b", icon:"💼" },
                  { lbl:"Saved",        val:curMonth.expenses.filter(e=>e.category==="savings").reduce((s,e)=>s+e.amount,0), color:"#ffd32a", icon:"🏦" },
                  { lbl:"Txns",         val:curMonth.expenses.length, color:"#54a0ff", icon:"🔢", noRupee:true },
                ].map(s => (
                  <div key={s.lbl} style={{ textAlign:"center", padding:"12px 8px", background:T.surface2, borderRadius:13, border:"1px solid " + s.color + "22" }}>
                    <div style={{ fontSize:17, marginBottom:4 }}>{s.icon}</div>
                    <div style={{ fontSize:14, fontWeight:800, color:s.color, fontFamily:MONO, lineHeight:1 }}>
                      {s.noRupee ? s.val : fmtINR(s.val)}
                    </div>
                    <div style={{ fontSize:10, color:T.textSub, marginTop:4, fontFamily:BODY }}>{s.lbl}</div>
                  </div>
                ))}
              </div>
            </div>
            {/* Health score */}
            <div className="vcard" style={{ background:T.cardGrad }}>
              <div style={{ fontSize:11, fontWeight:700, color:T.textSub, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:16, fontFamily:BODY }}>Monthly Health Score</div>
              <div style={{ display:"flex", gap:22, alignItems:"center", flexWrap:"wrap" }}>
                <div style={{ position:"relative", width:100, height:100, flexShrink:0 }}>
                  <svg viewBox="0 0 100 100" style={{ width:"100%", height:"100%", transform:"rotate(-90deg)" }}>
                    <circle cx="50" cy="50" r="44" fill="none" stroke={T.border} strokeWidth="8" />
                    <circle cx="50" cy="50" r="44" fill="none" stroke={health.color} strokeWidth="8"
                      strokeDasharray={2 * Math.PI * 44} strokeDashoffset={2 * Math.PI * 44 * (1 - health.score / 100)}
                      strokeLinecap="round" style={{ transition:"stroke-dashoffset 1s ease", filter:"drop-shadow(0 0 6px " + health.color + "66)" }} />
                  </svg>
                  <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" }}>
                    <span style={{ fontSize:24, fontWeight:800, color:health.color, fontFamily:MONO, lineHeight:1 }}>{health.score}</span>
                    <span style={{ fontSize:14, fontWeight:800, color:health.color, fontFamily:MONO }}>{health.grade}</span>
                  </div>
                </div>
                <div style={{ flex:1, display:"flex", flexDirection:"column", gap:10, minWidth:170 }}>
                  {health.breakdown.map(b => {
                    const bc = b.pts/b.max > 0.7 ? "#1dd1a1" : b.pts/b.max > 0.4 ? "#ffd32a" : "#ff6b6b";
                    return (
                      <div key={b.label}>
                        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                          <span style={{ fontSize:12, color:T.textSub, fontFamily:BODY }}>{b.label}</span>
                          <span style={{ fontSize:12, fontWeight:700, color:bc, fontFamily:MONO }}>{b.pts}/{b.max}</span>
                        </div>
                        <div style={{ height:5, background:T.border, borderRadius:99 }}>
                          <div style={{ height:5, width:(b.pts/b.max*100) + "%", background:bc, borderRadius:99, transition:"width .8s ease" }} />
                        </div>
                        <div style={{ fontSize:10, color:T.textMuted, marginTop:2, fontFamily:BODY }}>{b.detail}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            {/* Smart insights */}
            {(() => {
              const prevKey = activeMonth === 0 ? (activeYear-1) + "-11" : activeYear + "-" + (activeMonth-1);
              const prev = monthlyData[prevKey] || { incomeSources:[], expenses:[] };
              const prevExp = prev.expenses.reduce((s,e) => s + e.amount, 0);
              const savAmt = curMonth.expenses.filter(e => e.category === "savings").reduce((s,e) => s + e.amount, 0);
              const savRate = totalInc > 0 ? savAmt / totalInc * 100 : 0;
              const ins = [];
              const catTotals = allCats.map(c => ({ ...c, amt: curMonth.expenses.filter(e => e.category === c.id).reduce((s,e) => s + e.amount, 0) })).sort((a,b) => b.amt - a.amt);
              if (catTotals[0]?.amt > 0) ins.push({ icon:catTotals[0].icon, color:catTotals[0].color, title:"Top Spend Category", headline:catTotals[0].label + " is your biggest expense", detail:fmtINR(catTotals[0].amt) + " spent — " + (totalInc > 0 ? Math.round(catTotals[0].amt/totalInc*100) + "% of income" : ""), sev:"low" });
              if (prevExp > 0) { const d = totalExp - prevExp; const p = Math.round(Math.abs(d)/prevExp*100); if (Math.abs(p) > 5) ins.push({ icon: d>0?"📈":"📉", color:d>0?"#ff6b6b":"#1dd1a1", title:"vs Last Month", headline: d>0 ? "Spending up " + p + "% vs last month" : "Spending down " + p + "% — great work!", detail:"This month: " + fmtINR(totalExp) + " · Last month: " + fmtINR(prevExp), sev: d>0 && p>20 ? "high" : d>0 ? "medium" : "low" }); }
              if (totalInc > 0) ins.push({ icon:"💰", color: savRate>=20?"#1dd1a1":savRate>=10?"#ffd32a":"#ff6b6b", title:"Savings Rate", headline: savRate>=20 ? "Excellent! Saving " + Math.round(savRate) + "% of income" : "Saving " + Math.round(savRate) + "% — target is 20%", detail: savRate < 20 && totalInc > 0 ? "Need " + fmtINR(Math.round(totalInc*0.2-savAmt)) + " more to hit 20% target" : "Well above the 20% benchmark!", sev: savRate<10?"high":savRate<20?"medium":"low" });
              const largeExp = curMonth.expenses.filter(e => totalInc>0 && e.amount>totalInc*0.15 && e.category!=="savings");
              if (largeExp.length > 0) ins.push({ icon:"⚡", color:"#cd84f1", title:"Large Expense", headline:"\"" + largeExp[0].description + "\" is " + Math.round(largeExp[0].amount/totalInc*100) + "% of income", detail:fmtINR(largeExp[0].amount) + " — consider if this was planned", sev:"medium" });
              const SEV = { high:"#ff6b6b", medium:"#ffa94d", low:"#1dd1a1" };
              const SEVL = { high:"🔴 Action Needed", medium:"🟡 Watch This", low:"🟢 Good" };
              return (
                <div>
                  <div style={{ fontSize:11, fontWeight:700, color:T.textSub, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:14, fontFamily:BODY }}>🧠 Smart Insights</div>
                  <div className="vgrid" style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))", gap:14 }}>
                    {ins.map((ins2, i) => (
                      <div key={i} style={{ padding:"16px 18px", background:T.cardGrad, border:"1px solid " + T.border, borderRadius:16, borderTop:"3px solid " + SEV[ins2.sev], animation:"vSlide .3s " + (i*0.07) + "s both" }}>
                        <div style={{ display:"flex", gap:12, alignItems:"flex-start" }}>
                          <div style={{ width:40, height:40, borderRadius:11, background:ins2.color+"22", border:"1px solid " + ins2.color+"44", display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, flexShrink:0 }}>{ins2.icon}</div>
                          <div>
                            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4, gap:6 }}>
                              <span style={{ fontSize:11, color:T.textSub, textTransform:"uppercase", letterSpacing:"0.08em", fontFamily:BODY }}>{ins2.title}</span>
                              <span style={{ fontSize:9, color:SEV[ins2.sev], fontWeight:700, background:SEV[ins2.sev]+"18", padding:"2px 7px", borderRadius:20, whiteSpace:"nowrap", fontFamily:BODY }}>{SEVL[ins2.sev]}</span>
                            </div>
                            <div style={{ fontSize:14, fontWeight:700, color:ins2.color, marginBottom:5, fontFamily:TF, lineHeight:1.3 }}>{ins2.headline}</div>
                            <div style={{ fontSize:12, color:T.textSub, lineHeight:1.6, fontFamily:BODY }}>{ins2.detail}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* ── HISTORY ── */}
        {tab === "history" && (
          <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
            <div className="vcard" style={{ background:T.cardGrad }}>
              <div style={{ fontSize:11, fontWeight:700, color:T.textSub, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:16, fontFamily:BODY }}>Month-by-Month Comparison</div>
              {histMonths.length === 0
                ? <div style={{ textAlign:"center", padding:"36px 0", color:T.textMuted }}><div style={{ fontSize:38, marginBottom:10 }}>📊</div><div style={{ fontFamily:BODY }}>No history yet</div></div>
                : <>
                  <div style={{ display:"flex", alignItems:"flex-end", gap:4, height:120 }}>
                    {histMonths.map(h => <TrendBar key={h.key} label={SHORT[h.month]} income={h.income} expenses={h.expenses} maxVal={maxHist} isActive={h.month===activeMonth&&h.year===activeYear} onClick={() => { setActiveMonth(h.month); setTab("dashboard"); }} />)}
                  </div>
                  <div style={{ display:"flex", gap:14, marginTop:10, justifyContent:"flex-end" }}>
                    <span style={{ fontSize:11, color:"#1dd1a1", fontFamily:BODY }}>▮ Income</span>
                    <span style={{ fontSize:11, color:"#ff6b6b", fontFamily:BODY }}>▮ Outflow</span>
                  </div>
                  <div style={{ marginTop:18, display:"flex", flexDirection:"column", gap:6 }}>
                    {histMonths.map(h => (
                      <div key={h.key} className="vrow" style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"12px 16px", background: h.month===activeMonth ? T.surface3 : T.surface2, borderRadius:12, border:"1px solid " + (h.month===activeMonth ? T.borderAccent : T.border2), cursor:"pointer", flexWrap:"wrap", gap:8, transition:"all .2s" }} onClick={() => { setActiveMonth(h.month); setTab("dashboard"); }}>
                        <span style={{ fontWeight:700, color:T.textSub, minWidth:120, fontFamily:TF }}>{MONTHS[h.month]} {h.year}</span>
                        <span style={{ color:"#1dd1a1", minWidth:100, textAlign:"right", fontFamily:MONO }}>↑ {fmtINR(h.income)}</span>
                        <span style={{ color:"#ff6b6b", minWidth:100, textAlign:"right", fontFamily:MONO }}>↓ {fmtINR(h.expenses)}</span>
                        <span style={{ color: h.savings>=0?"#1dd1a1":"#ff6b6b", fontWeight:800, minWidth:100, textAlign:"right", fontFamily:MONO }}>{h.savings>=0?"+":""}{fmtINR(h.savings)}</span>
                      </div>
                    ))}
                  </div>
                </>
              }
            </div>
            {histMonths.length > 1 && (() => {
              const tot = histMonths.reduce((a,h) => ({ i:a.i+h.income, e:a.e+h.expenses }), { i:0, e:0 });
              return (
                <div className="vcard" style={{ background:"linear-gradient(135deg,#071a0f,#05120a)", borderColor:"#1a3a28" }}>
                  <div style={{ fontSize:11, fontWeight:700, color:T.textSub, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:16, fontFamily:BODY }}>Year-to-Date ({histMonths.length} months)</div>
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:16 }}>
                    {[["Earned",fmtINR(tot.i),"#1dd1a1"],["Spent",fmtINR(tot.e),"#ff6b6b"],["Saved",fmtINR(tot.i-tot.e),tot.i-tot.e>=0?"#1dd1a1":"#ff6b6b"]].map(([l,v,c]) => (
                      <div key={l}><div style={{ fontSize:12, color:T.textSub, fontFamily:BODY }}>{l}</div><div style={{ fontSize:24, fontWeight:800, color:c, fontFamily:MONO, marginTop:4 }}>{v}</div></div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* ── GOALS ── */}
        {tab === "goals" && (
          <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
            <div style={{ background:"linear-gradient(135deg,#071a14,#050f0e)", border:"1px solid #1dd1a133", borderRadius:16, padding:"13px 18px", display:"flex", alignItems:"flex-start", gap:10 }}>
              <span style={{ fontSize:18 }}>🔗</span>
              <div>
                <div style={{ fontSize:13, fontWeight:700, color:"#1dd1a1", fontFamily:TF }}>Goals are linked to your Dashboard</div>
                <div style={{ fontSize:12, color:T.textSub, marginTop:3, lineHeight:1.6, fontFamily:BODY }}>Contributing to a goal automatically records a <b style={{ color:T.text }}>Savings & Investments</b> expense for {MONTHS[activeMonth]}, reducing your remaining balance.</div>
              </div>
            </div>
            {/* Add goal form */}
            <div className="vcard" style={{ background:T.cardGrad }}>
              <div style={{ fontSize:11, fontWeight:700, color:T.textSub, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:16, fontFamily:BODY }}>Create a New Goal</div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))", gap:10, alignItems:"flex-end" }}>
                <Field label="Goal Name" T={T}><input style={IS} placeholder="Emergency Fund, MacBook…" value={goalForm.label} onChange={e => setGoalForm(p => ({ ...p, label:e.target.value }))} /></Field>
                <Field label={"Target (\u20B9)"} T={T}><input style={IS} type="number" placeholder="500000" value={goalForm.target} onChange={e => setGoalForm(p => ({ ...p, target:e.target.value }))} /></Field>
                <Field label={"Opening (\u20B9)"} T={T}><input style={IS} type="number" placeholder="0" value={goalForm.saved} onChange={e => setGoalForm(p => ({ ...p, saved:e.target.value }))} /></Field>
                <Field label="Deadline (optional)" T={T}><input style={{ ...IS, colorScheme: theme === "dark" ? "dark" : "light" }} type="date" min={new Date().toISOString().split("T")[0]} value={goalForm.deadline} onChange={e => setGoalForm(p => ({ ...p, deadline:e.target.value }))} /></Field>
                <div style={{ display:"flex", alignItems:"flex-end" }}>
                  <Btn v="primary" full onClick={addGoal}>+ Add Goal</Btn>
                </div>
              </div>
            </div>
            {goals.length === 0
              ? <div className="vcard" style={{ textAlign:"center", padding:"50px", color:T.textMuted, background:T.cardGrad }}><div style={{ fontSize:46, marginBottom:12 }}>🎯</div><div style={{ fontFamily:BODY }}>No goals yet — create one above</div></div>
              : <div style={{ display:"flex", flexDirection:"column", gap:18 }}>
                {goals.map((g, gi) => {
                  const gc   = GCOLS[gi % GCOLS.length];
                  const pct  = Math.min(100, g.saved / g.target * 100);
                  const done = g.saved >= g.target;
                  const cv   = contribs[g.id] || "";
                  const thisMonthContribs = (monthlyData[mk]?.expenses || []).filter(e => e.goalId === g.id).reduce((s,e) => s + e.amount, 0);
                  const allTimeContribs   = Object.values(monthlyData).flatMap(d => d.expenses || []).filter(e => e.goalId === g.id).reduce((s,e) => s + e.amount, 0);

                  // Deadline calculations
                  const today = new Date(); today.setHours(0,0,0,0);
                  const created = g.createdAt ? new Date(g.createdAt) : today;
                  created.setHours(0,0,0,0);
                  const hasDeadline = !!g.deadline;
                  const dlDate = hasDeadline ? new Date(g.deadline) : null;
                  if (dlDate) dlDate.setHours(0,0,0,0);
                  const daysLeft = dlDate ? Math.ceil((dlDate - today) / 86400000) : null;
                  const isOverdue = daysLeft !== null && daysLeft < 0;
                  const mthsLeft  = daysLeft !== null ? Math.max(0, Math.ceil(daysLeft / 30.44)) : null;
                  const needed    = Math.max(0, g.target - g.saved);
                  const reqPerMo  = mthsLeft > 0 ? Math.ceil(needed / mthsLeft) : needed;
                  const tenurePct = dlDate && dlDate > created ? Math.min(100, Math.max(0, Math.round((today - created) / (dlDate - created) * 100))) : 0;
                  const dlFmt     = dlDate ? dlDate.toLocaleDateString("en-IN", { day:"numeric", month:"short", year:"numeric" }) : "";
                  const dlColor   = isOverdue ? "#ff6b6b" : daysLeft<=7 ? "#ff6b6b" : daysLeft<=30 ? "#ffa94d" : "#1dd1a1";
                  const dlLabel   = isOverdue ? "⏰ Overdue" : daysLeft<=7 ? "🚨 Very Soon" : daysLeft<=30 ? "⚠️ Due Soon" : "✅ On Track";

                  return (
                    <div key={g.id} style={{ background:T.cardGrad, border:"1px solid " + (done ? gc+"66" : T.border), borderRadius:20, overflow:"hidden", boxShadow: done ? "0 6px 28px " + gc + "18" : "none" }}>
                      <div style={{ height:3, background:"linear-gradient(90deg," + gc + "," + gc + "44,transparent)" }} />
                      <div style={{ padding:"20px 22px" }}>
                        {/* Header */}
                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:16, flexWrap:"wrap", gap:10 }}>
                          <div style={{ display:"flex", gap:12, alignItems:"center" }}>
                            <div style={{ width:46, height:46, borderRadius:13, background:gc+"22", border:"1.5px solid " + gc+"55", display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, flexShrink:0 }}>{done?"🏆":"🎯"}</div>
                            <div>
                              <div style={{ fontWeight:800, color:T.text, fontSize:17, fontFamily:TF }}>{g.label}</div>
                              <div style={{ fontSize:12, color:T.textSub, marginTop:3, fontFamily:BODY }}>Target: <b style={{ color:gc, fontFamily:MONO }}>{fmtINR(g.target)}</b></div>
                            </div>
                          </div>
                          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                            {done && <span style={{ padding:"4px 12px", borderRadius:20, background:gc+"22", color:gc, fontSize:11, fontWeight:700, border:"1px solid " + gc+"44", animation:"vPulse 2s infinite" }}>🎉 Achieved!</span>}
                            <button onClick={() => deleteGoal(g.id)} style={{ background:"#ff6b6b18", border:"1px solid #ff6b6b22", color:"#ff6b6b", borderRadius:9, width:30, height:30, cursor:"pointer", fontSize:13 }}>✕</button>
                          </div>
                        </div>
                        {/* Stats */}
                        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(90px,1fr))", gap:9, marginBottom:16 }}>
                          {[
                            { lbl:"Saved",       val:fmtINR(g.saved),              color:gc },
                            { lbl:"Remaining",   val:fmtINR(Math.max(0,g.target-g.saved)), color: done?"#1dd1a1":"#ffa94d" },
                            { lbl:"This Month",  val:fmtINR(thisMonthContribs),    color:"#54a0ff" },
                            { lbl:"All Time",    val:fmtINR(allTimeContribs),      color:"#cd84f1" },
                          ].map(s => (
                            <div key={s.lbl} style={{ padding:"9px 10px", background:T.surface2, borderRadius:11, border:"1px solid " + s.color+"22", textAlign:"center" }}>
                              <div style={{ fontSize:13, fontWeight:800, color:s.color, fontFamily:MONO, lineHeight:1 }}>{s.val}</div>
                              <div style={{ fontSize:9, color:T.textSub, marginTop:4, fontFamily:BODY }}>{s.lbl}</div>
                            </div>
                          ))}
                        </div>
                        {/* Progress bar */}
                        <div style={{ marginBottom:16 }}>
                          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:7 }}>
                            <span style={{ fontSize:12, color:T.textSub, fontFamily:BODY }}>Progress</span>
                            <span style={{ fontSize:15, fontWeight:800, color:gc, fontFamily:MONO }}>{Math.round(pct)}%</span>
                          </div>
                          <div style={{ position:"relative", height:14, background:T.border2, borderRadius:99 }}>
                            <div style={{ position:"absolute", left:0, top:0, height:"100%", width:pct+"%", background: done ? "linear-gradient(90deg,"+gc+"aa,"+gc+")" : "linear-gradient(90deg,"+gc+"88,"+gc+")", borderRadius:99, transition:"width 1s cubic-bezier(.34,1.56,.64,1)", boxShadow:"0 0 10px " + gc+"66" }} />
                            {[25,50,75,100].map(m => (
                              <div key={m} style={{ position:"absolute", top:"-3px", left:m+"%", transform:"translateX(-50%)" }}>
                                <div style={{ width:2, height:20, background: pct>=m ? gc+"88" : T.border, borderRadius:1 }} />
                                <div style={{ fontSize:7, color: pct>=m ? gc : T.textMuted, textAlign:"center", marginTop:2, fontFamily:MONO }}>{m}%</div>
                              </div>
                            ))}
                          </div>
                        </div>
                        {/* Deadline block */}
                        {!hasDeadline ? (
                          <div style={{ marginBottom:16, padding:"12px 16px", background:T.surface2, border:"1px solid " + T.border, borderRadius:12 }}>
                            <div style={{ fontSize:13, fontWeight:700, color:T.text, marginBottom:4, fontFamily:TF }}>📅 No deadline set</div>
                            <div style={{ fontSize:11, color:T.textSub, marginBottom:10, fontFamily:BODY }}>Set a date — Vatsu auto-calculates your required monthly savings.</div>
                            <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
                              <input type="date" min={new Date().toISOString().split("T")[0]} value={dlEdits[g.id] || ""} onChange={e => setDlEdits(p => ({ ...p, [g.id]:e.target.value }))} style={{ ...IS, flex:1, minWidth:150, colorScheme: theme==="dark" ? "dark" : "light" }} />
                              <Btn v="primary" onClick={() => { if(dlEdits[g.id]) saveDeadline(g.id, dlEdits[g.id]); }} sx={{ opacity: dlEdits[g.id] ? 1 : 0.4, whiteSpace:"nowrap" }}>✓ Set Deadline</Btn>
                            </div>
                          </div>
                        ) : (
                          <div style={{ marginBottom:16, borderRadius:16, overflow:"hidden", border:"1.5px solid " + dlColor + "44" }}>
                            <div style={{ height:3, background:"linear-gradient(90deg," + dlColor + "," + dlColor + "44,transparent)" }} />
                            <div style={{ padding:"14px 16px", background: dlColor + "08" }}>
                              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12, flexWrap:"wrap", gap:8 }}>
                                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                                  <div style={{ width:32, height:32, borderRadius:9, background:dlColor+"22", display:"flex", alignItems:"center", justifyContent:"center", fontSize:16 }}>📅</div>
                                  <div>
                                    <div style={{ fontSize:13, fontWeight:700, color:dlColor, fontFamily:TF }}>Deadline: {dlFmt}</div>
                                    <div style={{ fontSize:10, color:T.textSub, fontFamily:BODY }}>Tenure: {Math.round((dlDate - created) / (1000*60*60*24*30.44))} months</div>
                                  </div>
                                </div>
                                <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                                  <span style={{ padding:"3px 10px", borderRadius:20, background:dlColor+"22", color:dlColor, fontSize:11, fontWeight:700, fontFamily:BODY }}>{dlLabel}</span>
                                  <button onClick={() => setDlEdits(p => g.id in p ? (({ [g.id]: _, ...rest }) => rest)(p) : { ...p, [g.id]: g.deadline||"" })} style={{ padding:"4px 10px", borderRadius:8, border:"1px solid " + T.border, background:T.surface2, color:T.textSub, fontSize:11, cursor:"pointer", fontFamily:BODY }}>
                                    {g.id in dlEdits ? "✕ Cancel" : "✏️ Edit"}
                                  </button>
                                </div>
                              </div>
                              {g.id in dlEdits && (
                                <div style={{ display:"flex", gap:8, marginBottom:12, flexWrap:"wrap", animation:"vFadeUp .2s ease both" }}>
                                  <input type="date" min={new Date().toISOString().split("T")[0]} value={dlEdits[g.id] || ""} onChange={e => setDlEdits(p => ({ ...p, [g.id]:e.target.value }))} style={{ ...IS, flex:1, minWidth:150, colorScheme: theme==="dark" ? "dark" : "light" }} />
                                  <Btn v="primary" onClick={() => { if(dlEdits[g.id]) saveDeadline(g.id, dlEdits[g.id]); }} sx={{ opacity: dlEdits[g.id] ? 1 : 0.4, whiteSpace:"nowrap" }}>✓ Save</Btn>
                                </div>
                              )}
                              <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, marginBottom:10 }}>
                                {[
                                  { lbl:"Days Left", val: isOverdue ? "Overdue" : Math.abs(daysLeft)+"d", color:dlColor },
                                  { lbl:"Months Left", val: isOverdue ? "—" : mthsLeft+"mo", color:dlColor },
                                  { lbl:"Need/Month", val: done ? "Done!" : fmtINR(reqPerMo), color:"#1dd1a1" },
                                ].map(t => (
                                  <div key={t.lbl} style={{ textAlign:"center", padding:"8px 6px", background:T.surface2, borderRadius:10, border:"1px solid " + T.border2 }}>
                                    <div style={{ fontSize:13, fontWeight:800, color:t.color, fontFamily:MONO }}>{t.val}</div>
                                    <div style={{ fontSize:9, color:T.textSub, marginTop:3, fontFamily:BODY }}>{t.lbl}</div>
                                  </div>
                                ))}
                              </div>
                              {/* Savings race */}
                              <div style={{ padding:"10px 12px", background:T.surface2, borderRadius:10, border:"1px solid " + T.border2 }}>
                                <div style={{ fontSize:10, fontWeight:700, color:T.textSub, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:8, fontFamily:BODY }}>⚡ Savings Race: Money vs Time</div>
                                {[["💰 Savings",pct,gc],["⏳ Time",tenurePct,dlColor]].map(([lbl,p,col]) => (
                                  <div key={lbl} style={{ marginBottom:7 }}>
                                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                                      <span style={{ fontSize:11, color:col, fontWeight:700, fontFamily:BODY }}>{lbl}</span>
                                      <span style={{ fontSize:11, color:col, fontWeight:700, fontFamily:MONO }}>{Math.round(p)}%</span>
                                    </div>
                                    <div style={{ height:8, background:T.border2, borderRadius:99 }}>
                                      <div style={{ height:8, width:p+"%", background:"linear-gradient(90deg,"+col+"88,"+col+")", borderRadius:99, boxShadow:"0 0 6px " + col+"66", transition:"width .8s ease" }} />
                                    </div>
                                  </div>
                                ))}
                                <div style={{ fontSize:11, color:T.textSub, marginTop:6, padding:"7px 10px", background: pct>=tenurePct?"#1dd1a108":"#ffa94d08", borderRadius:8, fontFamily:BODY }}>
                                  {done ? "🏆 Goal achieved!" : isOverdue ? "⏰ Deadline passed. Update date or keep contributing." : pct >= tenurePct ? "🚀 Savings ahead of time — you're winning!" : "⚡ Need " + fmtINR(reqPerMo) + "/month to catch up."}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                        {/* Contribute */}
                        {!done && (
                          <div style={{ paddingTop:14, borderTop:"1px solid " + T.border2 }}>
                            <div style={{ fontSize:11, fontWeight:700, color:T.textSub, letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:10, fontFamily:BODY }}>Contribute This Month</div>
                            <div style={{ display:"flex", gap:8 }}>
                              <input style={{ ...IS, flex:1 }} type="number" placeholder={"Enter amount (\u20B9)"} value={cv} onChange={e => setContribs(p => ({ ...p, [g.id]:e.target.value }))} onKeyDown={e => { if(e.key==="Enter" && cv) contributeToGoal(g.id, cv); }} />
                              <Btn v="primary" onClick={() => { if(cv) contributeToGoal(g.id, cv); }} sx={{ whiteSpace:"nowrap", opacity: cv ? 1 : 0.4 }}>💸 Contribute</Btn>
                            </div>
                            <div style={{ fontSize:11, color:T.textMuted, marginTop:6, fontFamily:BODY }}>Recorded as expense in {MONTHS[activeMonth]}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            }
          </div>
        )}

        {/* ── LOANS ── */}
        {tab === "loans" && (
          <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
            <div className="vcard" style={{ background:"linear-gradient(135deg,#1a0e00,#120900)", borderColor:"#ffa94d33" }}>
              <div style={{ fontSize:11, fontWeight:700, color:T.textSub, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:14, fontFamily:BODY }}>EMI Impact — {MONTHS[activeMonth]}</div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:14 }}>
                {[["Total EMI",fmtINR(totalEMI),"#ffa94d"],["Active Loans",String(activeLoans.length),T.text],["Remaining",fmtINR(remaining),remaining<0?"#ff6b6b":"#1dd1a1"]].map(([l,v,c]) => (
                  <div key={l}><div style={{ fontSize:12, color:T.textSub, fontFamily:BODY }}>{l}</div><div style={{ fontSize:26, fontWeight:800, color:c, fontFamily:MONO, marginTop:4 }}>{v}</div></div>
                ))}
              </div>
            </div>
            <div style={{ display:"flex", justifyContent:"flex-end" }}>
              <Btn v="orange" onClick={() => setShowLoan(true)} sx={{ fontSize:14 }}>🏦 + Add Bank Loan</Btn>
            </div>
            {loans.length === 0
              ? <div className="vcard" style={{ textAlign:"center", padding:"46px", color:T.textMuted, background:T.cardGrad }}><div style={{ fontSize:44, marginBottom:12 }}>🏦</div><div style={{ fontFamily:BODY }}>No loans yet</div></div>
              : loans.map(loan => {
                const sa = loan.startYear*12+loan.startMonth, ca = activeYear*12+activeMonth, el = Math.max(0, ca-sa);
                const isAct = el >= 0 && el < (loan.tenureMonths||9999);
                const lPct  = loan.tenureMonths ? Math.min(100, el/loan.tenureMonths*100) : 0;
                return (
                  <div key={loan.id} className="vcard" style={{ background:T.cardGrad, borderColor: isAct?"#ffa94d33":T.border, opacity: isAct?1:0.6 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:10, marginBottom:14 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                        <div style={{ width:42, height:42, borderRadius:12, background:"#ffa94d22", border:"1px solid #ffa94d44", display:"flex", alignItems:"center", justifyContent:"center", fontSize:20 }}>🏦</div>
                        <div>
                          <div style={{ fontWeight:700, color:T.text, fontSize:17, fontFamily:TF }}>{loan.bankName}</div>
                          <div style={{ fontSize:12, color:T.textSub, marginTop:2, fontFamily:BODY }}>{loan.loanType} · Started {MONTHS[loan.startMonth]} {loan.startYear}</div>
                        </div>
                      </div>
                      <div style={{ display:"flex", gap:8 }}>
                        <span style={{ padding:"4px 12px", borderRadius:20, background: isAct?"#ffa94d22":"#1a2e4a", color: isAct?"#ffa94d":T.textSub, fontSize:11, fontWeight:700, fontFamily:BODY }}>{isAct?"● Active":"● Closed"}</span>
                        <button onClick={() => deleteLoan(loan.id)} style={{ background:"#ff6b6b18", border:"none", color:"#ff6b6b", borderRadius:8, width:30, height:30, cursor:"pointer" }}>✕</button>
                      </div>
                    </div>
                    <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))", gap:10, marginBottom:14 }}>
                      {[["Principal",fmtINR(loan.principal),T.text],["Monthly EMI",fmtINR(loan.emi),"#ffa94d"],["Interest",loan.interestRate?loan.interestRate+"% p.a.":"—",T.text]].map(([l,v,c]) => (
                        <div key={l} style={{ background:T.surface2, borderRadius:11, padding:"10px 12px", border:"1px solid " + T.border2 }}>
                          <div style={{ fontSize:10, color:T.textSub, fontFamily:BODY, marginBottom:3 }}>{l}</div>
                          <div style={{ fontWeight:700, color:c, fontSize:14, fontFamily:MONO }}>{v}</div>
                        </div>
                      ))}
                    </div>
                    {loan.tenureMonths > 0 && (
                      <>
                        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
                          <span style={{ fontSize:12, color:T.textSub, fontFamily:BODY }}>{el} of {loan.tenureMonths} months</span>
                          <span style={{ fontSize:12, color:"#ffa94d", fontWeight:700, fontFamily:MONO }}>{Math.round(lPct)}% repaid</span>
                        </div>
                        <div style={{ height:8, background:T.border, borderRadius:99 }}>
                          <div style={{ height:8, width:lPct+"%", background:"linear-gradient(90deg,#e67e22,#ffa94d)", borderRadius:99, transition:"width .8s" }} />
                        </div>
                        <div style={{ fontSize:11, color:T.textSub, marginTop:5, fontFamily:BODY }}>Paid so far (EMI): {fmtINR(el*loan.emi)}</div>
                      </>
                    )}
                  </div>
                );
              })
            }
          </div>
        )}

        {/* ── CHALLENGES ── */}
        {tab === "challenges" && (
          <div style={{ display:"flex", flexDirection:"column", gap:20 }}>

            {/* ── PLAYER CARD ── */}
            <div style={{ background:"linear-gradient(135deg,#060f1c,#0a1628)", border:"1px solid "+lvl.color+"44", borderRadius:20, padding:"22px 24px", position:"relative", overflow:"hidden", boxShadow:"0 8px 32px "+lvl.color+"18" }}>
              <div style={{ position:"absolute", top:-40, right:-40, width:180, height:180, borderRadius:"50%", background:lvl.color+"0e", filter:"blur(50px)", pointerEvents:"none" }} />
              <div style={{ position:"relative", display:"flex", gap:18, alignItems:"center", flexWrap:"wrap" }}>
                {/* Avatar */}
                <div style={{ width:68, height:68, borderRadius:"50%", background:"linear-gradient(135deg,"+lvl.color+"33,"+lvl.color+"11)", border:"3px solid "+lvl.color, display:"flex", alignItems:"center", justifyContent:"center", fontSize:30, flexShrink:0, boxShadow:"0 0 24px "+lvl.color+"55" }}>{lvl.icon}</div>
                {/* Level info */}
                <div style={{ flex:1, minWidth:160 }}>
                  <div style={{ fontSize:10, color:T.textSub, textTransform:"uppercase", letterSpacing:"0.14em", marginBottom:3, fontFamily:BODY }}>Challenger Profile</div>
                  <div style={{ fontSize:20, fontWeight:800, color:lvl.color, fontFamily:TF, lineHeight:1.1 }}>{lvl.label}</div>
                  <div style={{ fontSize:13, color:T.textSub, margin:"4px 0 9px", fontFamily:BODY }}>
                    <span style={{ color:"#ffd32a", fontWeight:700, fontFamily:MONO }}>{totalXP} XP</span>
                    {lvl.next ? " · "+Math.max(0,lvl.next.min-totalXP)+" XP to "+lvl.next.label : " · Max Level!"}
                  </div>
                  <div style={{ height:7, background:T.border, borderRadius:99 }}>
                    <div style={{ height:7, width:lvl.pct+"%", background:"linear-gradient(90deg,"+lvl.color+"88,"+lvl.color+")", borderRadius:99, transition:"width .9s ease", boxShadow:"0 0 8px "+lvl.color+"55" }} />
                  </div>
                </div>
                {/* Stats */}
                <div style={{ display:"flex", gap:20, flexWrap:"wrap" }}>
                  {[
                    ["Completed", allCompletedChalls.length, "#1dd1a1"],
                    ["Active",    activeChalls.filter(c=>{ const t=CHALL.find(x=>x.id===c.id); if(!t)return false; const p=t.getP(curMonth,totalInc); return !t.isWin(p,totalInc); }).length, "#ffd32a"],
                    ["Badges",    earnedBadges.length, "#cd84f1"],
                  ].map(([l,v,c]) => (
                    <div key={l} style={{ textAlign:"center" }}>
                      <div style={{ fontSize:26, fontWeight:800, color:c, fontFamily:MONO, lineHeight:1, textShadow:"0 0 12px "+c+"66" }}>{v}</div>
                      <div style={{ fontSize:11, color:T.textSub, marginTop:3, fontFamily:BODY }}>{l}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── BADGES ── */}
            {earnedBadges.length > 0 && (
              <div className="vcard" style={{ background:T.cardGrad }}>
                <div style={{ fontSize:11, fontWeight:700, color:T.textSub, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:12, fontFamily:BODY }}>🏅 Earned Badges</div>
                <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                  {earnedBadges.map(t => (
                    <div key={t.id} style={{ display:"flex", alignItems:"center", gap:7, padding:"7px 14px", borderRadius:30, background:t.color+"22", border:"1px solid "+t.color+"44", transition:"all .2s", cursor:"default" }}
                      onMouseEnter={e=>{e.currentTarget.style.transform="scale(1.06)";}} onMouseLeave={e=>{e.currentTarget.style.transform="scale(1)";}}>
                      <span style={{ fontSize:16 }}>{t.icon}</span>
                      <span style={{ fontSize:12, fontWeight:700, color:t.color, fontFamily:BODY }}>{t.badge.split(" ").slice(1).join(" ")}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── ACTIVE CHALLENGES ── */}
            {activeChalls.length > 0 ? (
              <div>
                <div style={{ fontSize:11, fontWeight:700, color:T.textSub, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:12, fontFamily:BODY }}>⚔️ Active This Month — {MONTHS[activeMonth]}</div>
                <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                  {activeChalls.map(c => {
                    const tpl = CHALL.find(t => t.id === c.id);
                    if (!tpl) return null;
                    const prog = tpl.getP(curMonth, totalInc);
                    const won  = tpl.isWin(prog, totalInc);
                    const pct  = tpl.pct(prog, totalInc);
                    const ds   = DIFF_STYLE[tpl.diff] || DIFF_STYLE.Easy;
                    return (
                      <div key={c.id} style={{ padding:"16px 20px", background:won?"linear-gradient(135deg,#071a10,#050e09)":T.cardGrad, border:"1px solid "+(won?tpl.color+"88":T.border), borderRadius:16, transition:"all .25s", boxShadow:won?"0 4px 20px "+tpl.color+"22":"none" }}>
                        {/* Header row */}
                        <div style={{ display:"flex", gap:12, alignItems:"center", marginBottom:12 }}>
                          <div style={{ width:46, height:46, borderRadius:12, background:tpl.color+"22", border:"1px solid "+tpl.color+"44", display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, flexShrink:0 }}>{tpl.icon}</div>
                          <div style={{ flex:1 }}>
                            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:6 }}>
                              <span style={{ fontWeight:700, color:T.text, fontSize:15, fontFamily:TF }}>{tpl.label}</span>
                              <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                                <span style={{ padding:"2px 8px", borderRadius:20, background:ds.bg, color:ds.color, fontSize:10, fontWeight:700, fontFamily:BODY }}>{ds.stars} {tpl.diff}</span>
                                {won
                                  ? <span style={{ padding:"3px 10px", borderRadius:20, background:"#1dd1a122", color:"#1dd1a1", fontSize:11, fontWeight:700, animation:"vPulse 2s infinite" }}>🎉 Completed!</span>
                                  : <span style={{ padding:"3px 10px", borderRadius:20, background:"#ffa94d22", color:"#ffa94d", fontSize:11, fontWeight:700 }}>⚡ In Progress</span>
                                }
                              </div>
                            </div>
                            <div style={{ fontSize:11, color:T.textMuted, marginTop:2, fontFamily:BODY }}>Joined {c.joined} · ⏱ {tpl.days} day challenge</div>
                          </div>
                        </div>
                        {/* Progress bar */}
                        <div style={{ height:8, background:T.border, borderRadius:99, overflow:"hidden", marginBottom:6 }}>
                          <div style={{ height:8, width:pct+"%", background:"linear-gradient(90deg,"+tpl.color+"88,"+tpl.color+")", borderRadius:99, transition:"width .7s cubic-bezier(.34,1.56,.64,1)", boxShadow:"0 0 8px "+tpl.color+"55" }} />
                        </div>
                        {/* Metric + XP + abandon */}
                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:8 }}>
                          <span style={{ fontSize:12, color:T.textSub, fontFamily:BODY, flex:1 }}>{tpl.metric(prog, totalInc)}</span>
                          <div style={{ display:"flex", gap:10, alignItems:"center" }}>
                            <span style={{ fontSize:11, fontWeight:700, color:"#ffd32a", fontFamily:MONO }}>+{tpl.xp} XP</span>
                            {!won && (
                              <button onClick={() => abandonChallenge(c.id)}
                                style={{ padding:"3px 9px", borderRadius:8, border:"1px solid #ff6b6b33", background:"#ff6b6b12", color:"#ff6b6b", fontSize:10, cursor:"pointer", fontFamily:BODY }}
                                title="Abandon this challenge">
                                Abandon
                              </button>
                            )}
                          </div>
                        </div>
                        {/* Win tip */}
                        {!won && (
                          <div style={{ marginTop:10, padding:"8px 12px", background:tpl.color+"0e", borderRadius:8, fontSize:11, color:tpl.color, fontFamily:BODY }}>
                            💡 {tpl.tips[0]}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* Empty active state */
              <div style={{ padding:"28px 24px", background:T.cardGrad, border:"1px solid "+T.border, borderRadius:18, textAlign:"center" }}>
                <div style={{ fontSize:40, marginBottom:12 }}>🎯</div>
                <div style={{ fontSize:16, fontWeight:700, color:T.text, fontFamily:TF, marginBottom:6 }}>No active challenges yet</div>
                <div style={{ fontSize:13, color:T.textSub, fontFamily:BODY, lineHeight:1.7, maxWidth:320, margin:"0 auto 16px" }}>
                  Pick a challenge below and tap Accept. Each one you complete earns XP and a badge!
                </div>
                <div style={{ display:"flex", gap:8, justifyContent:"center", flexWrap:"wrap" }}>
                  {["🌱 Start small","⚡ Earn XP","🏅 Win badges","📈 Build habits"].map(t => (
                    <span key={t} style={{ padding:"4px 12px", borderRadius:20, background:"#1dd1a118", color:"#1dd1a1", fontSize:11, fontFamily:BODY, fontWeight:600 }}>{t}</span>
                  ))}
                </div>
              </div>
            )}

            {/* ── AVAILABLE CHALLENGES ── */}
            <div>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
                <div style={{ fontSize:11, fontWeight:700, color:T.textSub, letterSpacing:"0.1em", textTransform:"uppercase", fontFamily:BODY }}>🎯 All Challenges ({CHALL.length})</div>
                <div style={{ fontSize:11, color:T.textSub, fontFamily:BODY }}>Tap to see details</div>
              </div>
              <div className="vgrid" style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(270px,1fr))", gap:13 }}>
                {CHALL.map((tpl, i) => {
                  const already = !!activeChalls.find(c => c.id === tpl.id);
                  const ds = DIFF_STYLE[tpl.diff] || DIFF_STYLE.Easy;
                  const everWon = !!allCompletedChalls.find(c => c.id === tpl.id);
                  return (
                    <div key={tpl.id} onClick={() => setChallDetail(tpl.id)}
                      style={{ cursor:"pointer", padding:"18px 20px", background:T.cardGrad, border:"1px solid "+(already?tpl.color+"55":T.border), borderRadius:16, position:"relative", overflow:"hidden", transition:"all .22s", animation:"vFadeUp .4s "+(i*0.05)+"s both" }}
                      onMouseEnter={e=>{e.currentTarget.style.borderColor=tpl.color+"88";e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow="0 8px 24px "+tpl.color+"18";}}
                      onMouseLeave={e=>{e.currentTarget.style.borderColor=already?tpl.color+"55":T.border;e.currentTarget.style.transform="translateY(0)";e.currentTarget.style.boxShadow="none";}}>
                      {/* Glow orb */}
                      <div style={{ position:"absolute", top:-15, right:-15, width:90, height:90, borderRadius:"50%", background:tpl.color+"12", filter:"blur(22px)", pointerEvents:"none" }} />
                      {/* Ever completed badge */}
                      {everWon && <div style={{ position:"absolute", top:12, right:12, width:24, height:24, borderRadius:"50%", background:tpl.color, display:"flex", alignItems:"center", justifyContent:"center", fontSize:12 }}>✓</div>}
                      <div style={{ display:"flex", alignItems:"center", gap:11, marginBottom:10 }}>
                        <div style={{ width:46, height:46, borderRadius:12, background:tpl.color+"22", border:"1px solid "+tpl.color+"44", display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, flexShrink:0 }}>{tpl.icon}</div>
                        <div>
                          <div style={{ fontWeight:800, color:T.text, fontSize:14, fontFamily:TF }}>{tpl.label}</div>
                          <div style={{ display:"flex", gap:5, marginTop:4, flexWrap:"wrap" }}>
                            <span style={{ padding:"2px 7px", borderRadius:20, background:ds.bg, color:ds.color, fontSize:9, fontWeight:700, fontFamily:BODY }}>{ds.stars} {tpl.diff}</span>
                            <span style={{ padding:"2px 7px", borderRadius:20, background:"#ffd32a22", color:"#ffd32a", fontSize:9, fontWeight:700, fontFamily:MONO }}>+{tpl.xp} XP</span>
                            <span style={{ padding:"2px 7px", borderRadius:20, background:T.border, color:T.textSub, fontSize:9, fontFamily:BODY }}>⏱ {tpl.days}d</span>
                          </div>
                        </div>
                      </div>
                      <div style={{ fontSize:12, color:T.textSub, lineHeight:1.6, marginBottom:9, fontFamily:BODY }}>{tpl.desc}</div>
                      <div style={{ fontSize:11, color:tpl.color, padding:"6px 10px", background:tpl.color+"10", borderRadius:8, marginBottom:10, fontFamily:BODY, lineHeight:1.5 }}>
                        💡 {tpl.why.length > 85 ? tpl.why.substring(0,85)+"…" : tpl.why}
                      </div>
                      <div style={{ padding:"7px 12px", borderRadius:9, textAlign:"center", fontSize:12, fontWeight:600, fontFamily:BODY,
                        background: already ? "#1dd1a118" : tpl.color+"18",
                        color:      already ? "#1dd1a1"   : tpl.color,
                        border:     "1px solid "+(already ? "#1dd1a133" : tpl.color+"33"),
                      }}>
                        {already ? "✓ Active — tap for details" : "Tap to learn more & accept →"}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        )}

        {/* ── AI ADVISOR ── */}
        {tab === "advisor" && <AIAdvisor monthlyData={monthlyData} goals={goals} loans={loans} activeMonth={activeMonth} activeYear={activeYear} theme={theme} allCats={allCats} totalInc={totalInc} totalExp={totalExp} curMonth={curMonth} />}

      </main>

      {/* ═══════════════════════ MODALS ═══════════════════════════════ */}

      {/* Income modal */}
      <Modal show={showIncome} onClose={() => setShowIncome(false)} title="Add Income Source" sub="Counted for the selected month only.">
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <Field label="Source Label" T={T}><input style={IS} placeholder="Salary, Freelance, Rental…" autoFocus value={incForm.label} onChange={e => setIncForm(p => ({ ...p, label:e.target.value }))} /></Field>
          <Field label={"Amount (\u20B9)"} T={T}><input style={IS} type="number" placeholder="0" value={incForm.amount} onChange={e => setIncForm(p => ({ ...p, amount:e.target.value }))} /></Field>
          <div style={{ display:"flex", gap:10, marginTop:4 }}>
            <Btn full onClick={() => setShowIncome(false)}>Cancel</Btn>
            <Btn v="primary" full onClick={addIncome}>Add Income</Btn>
          </div>
        </div>
      </Modal>

      {/* Budget modal */}
      <Modal show={showBudget} onClose={() => setShowBudget(false)} title="Set Monthly Budgets" sub="Alerts fire when you hit 90% of any limit.">
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {allCats.map(c => (
            <div key={c.id} style={{ display:"flex", alignItems:"center", gap:12, padding:"9px 14px", background:T.surface2, borderRadius:11, border:"1px solid " + T.border2 }}>
              <span style={{ fontSize:19 }}>{c.icon}</span>
              <span style={{ flex:1, fontSize:13, color:T.text, fontFamily:BODY }}>{c.label}</span>
              <input style={{ ...IS, width:130 }} type="number" placeholder="No limit" value={budgForm[c.id] || ""} onChange={e => setBudgForm(p => ({ ...p, [c.id]:e.target.value }))} />
            </div>
          ))}
          <div style={{ display:"flex", gap:10, marginTop:8 }}>
            <Btn full onClick={() => setShowBudget(false)}>Cancel</Btn>
            <Btn v="primary" full onClick={saveBudgets}>Save Budgets</Btn>
          </div>
        </div>
      </Modal>

      {/* Loan modal */}
      <Modal show={showLoan} onClose={() => setShowLoan(false)} title="Add Bank Loan" sub="EMI auto-deducted from remaining balance each active month." wide>
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            <Field label="Bank Name" T={T}><input style={IS} placeholder="SBI, HDFC, ICICI…" value={loanForm.bankName} onChange={e => setLoanForm(p => ({ ...p, bankName:e.target.value }))} /></Field>
            <Field label="Loan Type" T={T}><select style={IS} value={loanForm.loanType} onChange={e => setLoanForm(p => ({ ...p, loanType:e.target.value }))}>{LOAN_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select></Field>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            <Field label={"Principal (\u20B9)"} T={T}><input style={IS} type="number" placeholder="2000000" value={loanForm.principal} onChange={e => setLoanForm(p => ({ ...p, principal:e.target.value }))} /></Field>
            <Field label={"Monthly EMI (\u20B9)"} T={T}><input style={IS} type="number" placeholder="18000" value={loanForm.emi} onChange={e => setLoanForm(p => ({ ...p, emi:e.target.value }))} /></Field>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            <Field label="Interest Rate (% p.a.)" T={T}><input style={IS} type="number" placeholder="8.5" value={loanForm.interestRate} onChange={e => setLoanForm(p => ({ ...p, interestRate:e.target.value }))} /></Field>
            <Field label="Tenure (months)" T={T}><input style={IS} type="number" placeholder="240" value={loanForm.tenureMonths} onChange={e => setLoanForm(p => ({ ...p, tenureMonths:e.target.value }))} /></Field>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            <Field label="Start Month" T={T}><select style={IS} value={loanForm.startMonth} onChange={e => setLoanForm(p => ({ ...p, startMonth:e.target.value }))}>{MONTHS.map((m,i) => <option key={i} value={i}>{m}</option>)}</select></Field>
            <Field label="Start Year" T={T}><input style={IS} type="number" placeholder={String(THIS_YEAR)} value={loanForm.startYear} onChange={e => setLoanForm(p => ({ ...p, startYear:e.target.value }))} /></Field>
          </div>
          <div style={{ display:"flex", gap:10, marginTop:4 }}>
            <Btn full onClick={() => setShowLoan(false)}>Cancel</Btn>
            <Btn v="orange" full onClick={addLoan}>Add Loan</Btn>
          </div>
        </div>
      </Modal>

      {/* Create category modal */}
      <Modal show={showCatModal} onClose={() => setShowCatModal(false)} title="Create Custom Category" sub="Add your own spending category with a unique icon and colour.">
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <Field label="Category Name" T={T}><input style={IS} placeholder="Pet Care, Gym, Rent…" autoFocus value={catForm.label} onChange={e => setCatForm(p => ({ ...p, label:e.target.value }))} onKeyDown={e => e.key === "Enter" && addCustomCat()} /></Field>
          <div>
            <label style={{ fontSize:12, color:T.textSub, fontWeight:600, marginBottom:8, display:"block", fontFamily:BODY }}>Pick an Icon</label>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(8,1fr)", gap:6 }}>
              {["🐾","🏋️","🏠","💊","✈️","🎓","🎁","🧴","🪴","🍺","🎮","🎸","📚","🧹","💇","🔧"].map(em => (
                <button key={em} onClick={() => setCatForm(p => ({ ...p, icon:em }))} style={{ fontSize:20, padding:6, borderRadius:9, border:"2px solid " + (catForm.icon===em?"#1dd1a1":T.border), background: catForm.icon===em ? "#1dd1a122" : T.surface2, cursor:"pointer", lineHeight:1 }}>{em}</button>
              ))}
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginTop:9 }}>
              <span style={{ fontSize:12, color:T.textSub, fontFamily:BODY }}>Or any emoji:</span>
              <input style={{ ...IS, width:68, textAlign:"center", fontSize:20, padding:"6px 10px" }} maxLength={2} value={catForm.icon} onChange={e => setCatForm(p => ({ ...p, icon:e.target.value||"📌" }))} />
            </div>
          </div>
          <div>
            <label style={{ fontSize:12, color:T.textSub, fontWeight:600, marginBottom:8, display:"block", fontFamily:BODY }}>Pick a Colour</label>
            <div style={{ display:"flex", gap:7, flexWrap:"wrap" }}>
              {["#a29bfe","#fd79a8","#e17055","#fdcb6e","#00cec9","#6c5ce7","#00b894","#74b9ff","#55efc4","#fab1a0","#ff7675","#dfe6e9"].map(col => (
                <button key={col} onClick={() => setCatForm(p => ({ ...p, color:col }))} style={{ width:30, height:30, borderRadius:"50%", background:col, border:"3px solid " + (catForm.color===col?"#e8f4ff":"transparent"), cursor:"pointer", boxShadow: catForm.color===col?"0 0 8px " + col:"none" }} />
              ))}
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginTop:9 }}>
              <span style={{ fontSize:12, color:T.textSub, fontFamily:BODY }}>Custom hex:</span>
              <input style={{ ...IS, width:110, fontFamily:MONO }} placeholder="#a29bfe" value={catForm.color} onChange={e => setCatForm(p => ({ ...p, color:e.target.value }))} />
              <div style={{ width:30, height:30, borderRadius:8, background:catForm.color, border:"1px solid " + T.border, flexShrink:0 }} />
            </div>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 14px", background:T.surface2, borderRadius:12 }}>
            <div style={{ width:38, height:38, borderRadius:10, background:catForm.color+"22", border:"1px solid " + catForm.color+"44", display:"flex", alignItems:"center", justifyContent:"center", fontSize:20 }}>{catForm.icon}</div>
            <div>
              <div style={{ fontWeight:700, color:catForm.color, fontFamily:TF }}>{catForm.label || "Category Name"}</div>
              <div style={{ fontSize:11, color:T.textMuted, fontFamily:BODY }}>Preview</div>
            </div>
          </div>
          <div style={{ display:"flex", gap:10 }}>
            <Btn full onClick={() => setShowCatModal(false)}>Cancel</Btn>
            <Btn v="primary" full onClick={addCustomCat} sx={{ opacity: catForm.label.trim() ? 1 : 0.4 }}>✓ Create Category</Btn>
          </div>
        </div>
      </Modal>

      {/* Manage custom categories modal */}
      <Modal show={showManageCats} onClose={() => setShowManageCats(false)} title="My Custom Categories" sub="Categories you've created.">
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {customCats.length === 0 ? <div style={{ textAlign:"center", padding:"20px 0", color:T.textSub, fontFamily:BODY }}>No custom categories yet.</div>
            : customCats.map(c => (
              <div key={c.id} style={{ display:"flex", alignItems:"center", gap:11, padding:"11px 14px", background:T.surface2, borderRadius:12, border:"1px solid " + c.color+"33" }}>
                <div style={{ width:38, height:38, borderRadius:10, background:c.color+"22", border:"1px solid " + c.color+"44", display:"flex", alignItems:"center", justifyContent:"center", fontSize:19, flexShrink:0 }}>{c.icon}</div>
                <span style={{ flex:1, fontWeight:700, color:c.color, fontFamily:TF }}>{c.label}</span>
                <button onClick={() => deleteCustomCat(c.id)} style={{ background:"#ff6b6b18", border:"1px solid #ff6b6b33", color:"#ff6b6b", borderRadius:8, width:30, height:30, cursor:"pointer", fontSize:13 }}>✕</button>
              </div>
            ))
          }
          <div style={{ display:"flex", gap:10, marginTop:6 }}>
            <Btn full onClick={() => setShowManageCats(false)}>Close</Btn>
            <Btn v="primary" full onClick={() => { setShowManageCats(false); setShowCatModal(true); }}>+ Create New</Btn>
          </div>
        </div>
      </Modal>

      {/* Challenge detail modal */}
      {(() => {
        const sel = challDetail ? CHALL.find(t => t.id === challDetail) : null;
        if (!sel) return null;
        const already = !!activeChalls.find(c => c.id === sel.id);
        const ds = DIFF_STYLE[sel.diff];
        return (
          <Modal show={true} onClose={() => setChallDetail(null)} title={sel.label} wide>
            <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
              <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                <div style={{ width:56, height:56, borderRadius:15, background:sel.color+"22", border:"2px solid " + sel.color+"55", display:"flex", alignItems:"center", justifyContent:"center", fontSize:28, boxShadow:"0 0 18px " + sel.color+"44" }}>{sel.icon}</div>
                <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                  <span style={{ padding:"3px 10px", borderRadius:20, background:ds.bg, color:ds.color, fontSize:11, fontWeight:700, fontFamily:BODY }}>{ds.stars} {sel.diff}</span>
                  <span style={{ padding:"3px 10px", borderRadius:20, background:"#ffd32a22", color:"#ffd32a", fontSize:11, fontWeight:700, fontFamily:MONO }}>+{sel.xp} XP</span>
                  <span style={{ padding:"3px 10px", borderRadius:20, background:T.border, color:T.textSub, fontSize:11, fontFamily:BODY }}>⏱ {sel.days} days</span>
                </div>
              </div>
              <div style={{ fontSize:14, color:T.textSub, lineHeight:1.7, fontFamily:BODY }}>{sel.desc}</div>
              <div style={{ padding:"13px 15px", background:sel.color+"12", border:"1px solid " + sel.color+"33", borderRadius:12 }}>
                <div style={{ fontSize:12, fontWeight:700, color:sel.color, marginBottom:5, fontFamily:TF }}>💡 Why This Matters</div>
                <div style={{ fontSize:13, color:T.textSub, lineHeight:1.7, fontFamily:BODY }}>{sel.why}</div>
              </div>
              <div>
                <div style={{ fontSize:12, fontWeight:700, color:T.text, marginBottom:9, fontFamily:TF }}>🎯 Tips to Win</div>
                {sel.tips.map((tip, i) => (
                  <div key={i} style={{ display:"flex", gap:10, padding:"9px 13px", background:T.surface2, borderRadius:9, border:"1px solid " + T.border2, marginBottom:6 }}>
                    <div style={{ width:20, height:20, borderRadius:"50%", background:sel.color+"22", border:"1px solid " + sel.color+"44", display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:700, color:sel.color, flexShrink:0 }}>{i+1}</div>
                    <span style={{ fontSize:13, color:T.textSub, lineHeight:1.6, fontFamily:BODY }}>{tip}</span>
                  </div>
                ))}
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:12, padding:"11px 15px", background:"#ffd32a12", border:"1px solid #ffd32a33", borderRadius:11 }}>
                <span style={{ fontSize:22 }}>{sel.icon}</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:10, color:"#ffd32a", fontWeight:700, fontFamily:BODY }}>BADGE REWARD</div>
                  <div style={{ fontSize:14, color:T.text, fontWeight:700, fontFamily:TF }}>{sel.badge}</div>
                </div>
                <div style={{ fontSize:22, fontWeight:800, color:"#ffd32a", fontFamily:MONO }}>+{sel.xp}</div>
              </div>
              <div style={{ display:"flex", gap:10 }}>
                <Btn full onClick={() => setChallDetail(null)}>Maybe Later</Btn>
                {already
                  ? <div style={{ flex:2, padding:11, borderRadius:12, background:"#1dd1a122", color:"#1dd1a1", fontWeight:700, fontSize:13, textAlign:"center", fontFamily:BODY, border:"1px solid #1dd1a133" }}>✓ Active this month!</div>
                  : <button onClick={() => joinChallenge(sel)} style={{ flex:2, padding:11, borderRadius:12, border:"none", background:"linear-gradient(135deg," + sel.color + "," + sel.color + "cc)", color:"#060d18", fontWeight:800, fontSize:14, cursor:"pointer", fontFamily:BODY, boxShadow:"0 4px 18px " + sel.color+"44" }}>
                    🚀 Accept — +{sel.xp} XP
                  </button>
                }
              </div>
            </div>
          </Modal>
        );
      })()}
    </div>
  );
}

/* ─── AI ADVISOR ─────────────────────────────────────────────────────── */
function AIAdvisor({ monthlyData, goals, loans, activeMonth, activeYear, theme, allCats, totalInc, totalExp, curMonth }) {
  const T   = THEMES[theme];
  const IS2 = iStyle(T);
  const [msgs,    setMsgs   ] = useState([]);
  const [input,   setInput  ] = useState("");
  const [loading, setLoading] = useState(false);
  const bottom = useRef(null);
  useEffect(() => { bottom.current?.scrollIntoView({ behavior:"smooth" }); }, [msgs]);

  const catBreak = allCats
    .map(c => ({ ...c, spent: curMonth.expenses.filter(e=>e.category===c.id).reduce((s,e)=>s+e.amount,0) }))
    .filter(c => c.spent>0).sort((a,b)=>b.spent-a.spent);

  const totalEMI   = loans.reduce((s,l)=>{ const st=l.startYear*12+l.startMonth,cu=activeYear*12+activeMonth; return cu>=st&&cu<st+(l.tenureMonths||9999)?s+l.emi:s; },0);
  const remaining  = totalInc-totalExp-totalEMI;
  const savePct    = totalInc>0?Math.round(Math.max(0,remaining/totalInc*100)):0;
  const spentPct   = totalInc>0?Math.round((totalExp/totalInc)*100):0;
  const topCat     = catBreak[0];
  const foodAmt    = catBreak.find(c=>c.id==="food")?.spent||0;
  const subAmt     = catBreak.find(c=>c.id==="subscriptions")?.spent||0;
  const shopAmt    = catBreak.find(c=>c.id==="shopping")?.spent||0;
  const transAmt   = catBreak.find(c=>c.id==="transport")?.spent||0;
  const entAmt     = catBreak.find(c=>c.id==="entertainment")?.spent||0;
  const savingsAmt = catBreak.find(c=>c.id==="savings")?.spent||0;
  const hasData    = totalInc>0||totalExp>0;
  const month      = MONTHS[activeMonth];
  const prevKey    = activeMonth===0?(activeYear-1)+"-11":activeYear+"-"+(activeMonth-1);
  const prevData   = monthlyData[prevKey];
  const prevExp    = prevData?prevData.expenses.reduce((s,e)=>s+e.amount,0):0;
  const momDelta   = prevExp>0?Math.round(((totalExp-prevExp)/prevExp)*100):null;
  const pendingGoals   = goals.filter(g=>g.saved<g.target);
  const completedGoals = goals.filter(g=>g.saved>=g.target);
  const nearDeadline   = goals.filter(g=>{ if(!g.deadline)return false; const d=Math.ceil((new Date(g.deadline)-new Date())/864e5); return d>0&&d<=90; });
  const emergencyGoal  = goals.find(g=>g.label.toLowerCase().includes("emergency"));
  const emiPct         = totalInc>0?Math.round((totalEMI/totalInc)*100):0;

  /* ─── nl: joins array of strings with newline ─── */
  function nl(arr) { return arr.join("\n"); }

  /* ─── INTENT DETECTION ─── */
  function detectIntent(q) {
    const t = q.toLowerCase().replace(/[?!.,]/g,"").trim();
    const map = {
      savings:      [/sav(e|ing|ings)/,/save more/,/saving habit/,/paisa bachao/,/set aside/,/corpus/,/accumulate/],
      spending:     [/overspend/,/where.*money/,/where.*go/,/where.*spend/,/money.*going/,/biggest.*expense/,/top.*spend/,/kahan.*paisa/,/expense.*break/],
      budget:       [/budget/,/allocat/,/50.30.20/,/limit.*spend/,/spend.*limit/,/financial plan/,/monthly plan/],
      emergency:    [/emergency/,/safety net/,/rainy day/,/cushion/,/crisis fund/,/contingency/],
      food:         [/food/,/dining/,/eating/,/restaurant/,/swiggy/,/zomato/,/cooking/,/grocery/,/groceries/,/meal/],
      loans:        [/loan/,/emi/,/debt/,/borrow/,/repay/,/credit/,/home loan/,/car loan/,/personal loan/,/karz/],
      goals:        [/goal/,/target/,/dream/,/achieve/,/milestone/,/saving for/,/vacation/,/holiday/,/trip/],
      health:       [/health/,/score/,/performance/,/how.*doing/,/overall/,/summary/,/report/,/on track/],
      invest:       [/invest/,/sip/,/mutual fund/,/stock/,/equity/,/nifty/,/sensex/,/portfolio/,/grow.*money/,/wealth/,/ppf/,/elss/,/nps/,/where.*put/,/where.*invest/,/best investment/],
      tax:          [/tax/,/80c/,/80d/,/hra/,/income tax/,/itr/,/deduction/,/tds/,/tax slab/,/new regime/,/old regime/,/section 80/],
      subscriptions:[/subscription/,/netflix/,/ott/,/spotify/,/amazon prime/,/hotstar/,/streaming/,/cancel.*sub/],
      income:       [/income/,/salary/,/earning/,/revenue/,/source.*income/,/hike/,/passive income/,/side income/],
      transport:    [/transport/,/travel/,/commut/,/cab/,/ola/,/uber/,/petrol/,/fuel/,/metro/],
      shopping:     [/shopping/,/clothes/,/fashion/,/buy.*online/,/amazon/,/flipkart/,/impulse/],
      terms:        [/what is/,/what.*mean/,/explain/,/define/,/tell me about/,/\bsip\b/,/\bcagr\b/,/\belss\b/,/\bppf\b/,/\bnps\b/,/\bfd\b/,/cibil/,/credit score/,/inflation/,/compound/,/nav\b/,/xirr/,/net worth/,/liquid fund/,/ulip/],
      motivation:   [/motivat/,/inspire/,/encourage/,/feel.*bad/,/stressed/,/worried/,/anxious/,/depress/,/overwhelm/,/broke/,/struggling/],
      tips:         [/tip/,/trick/,/advice/,/suggest/,/best.*practice/,/habit/,/discipline/,/improve.*financ/],
      greeting:     [/^hi$/, /^hello$/, /^hey$/, /^namaste/, /good morning/, /good evening/, /how are you/],
      networth:     [/net worth/,/total.*asset/,/how.*rich/,/total.*wealth/],
      insurance:    [/insurance/,/term.*plan/,/life.*cover/,/health.*insurance/,/premium/,/policy/],
      realestate:   [/real estate/,/property/,/buy.*house/,/flat/,/apartment/,/rent.*buy/],
      creditScore:  [/credit score/,/cibil score/,/improve.*credit/,/credit.*report/],
    };
    const scores = {};
    for (const [intent, patterns] of Object.entries(map)) {
      scores[intent] = patterns.filter(p => p.test(t)).length;
    }
    const best = Object.entries(scores).sort((a,b)=>b[1]-a[1])[0];
    return best[1]>0 ? best[0] : "unknown";
  }

  /* ─── RESPONSE GENERATORS ─── */
  function respond(intent, question) {
    const noData = "No data yet for " + month + ". Add your income and expenses in the Dashboard first — then I will give you advice specific to your numbers!";

    if (intent === "greeting") {
      if (!hasData) return noData;
      const status = savePct>=20 ? "You are doing great this month!" : savePct>=10 ? "You are on the right track, some room to improve." : "A few things we should work on together.";
      return nl([
        "Namaste! Here is your " + month + " snapshot:",
        "Income: " + fmtINR(totalInc) + "  |  Spent: " + fmtINR(totalExp) + " (" + spentPct + "%)" + "  |  Remaining: " + fmtINR(remaining),
        "Savings Rate: " + savePct + "%",
        "",
        status,
        "",
        "What would you like to discuss? I can help with savings, investments, tax planning, goals, loans, or anything else."
      ]);
    }

    if (intent === "savings") {
      if (!hasData) return noData;
      const needed = Math.max(0, totalInc*0.20 - savingsAmt);
      const ideal  = Math.round(totalInc*0.20);
      const parts  = [];
      parts.push("Savings Analysis — " + month);
      parts.push("");
      if (savePct>=20) {
        parts.push("Excellent! You are saving " + savePct + "% — above the 20% target.");
      } else if (savePct>=10) {
        parts.push("You are saving " + savePct + "%. Target is 20%. You need " + fmtINR(Math.round(needed)) + " more this month.");
      } else {
        parts.push("You are saving only " + savePct + "%. The target is 20% (" + fmtINR(ideal) + "/month). This is the single most important thing to fix.");
      }
      parts.push("");
      parts.push("How to save more:");
      parts.push("1. Pay yourself first — transfer " + fmtINR(ideal) + " to savings on salary day before spending");
      parts.push("2. Automate it — standing instruction so it happens without effort");
      if (foodAmt > totalInc*0.20) parts.push("3. Cut food spending 20% — saves " + fmtINR(Math.round(foodAmt*0.2)) + "/month");
      if (subAmt > 0) parts.push("4. Cancel unused subscriptions — " + fmtINR(subAmt) + "/month freed up");
      if (shopAmt > totalInc*0.15) parts.push("5. Apply the 24-hour rule before purchases above Rs 500");
      parts.push("");
      parts.push("Once you save 20% consistently, the next step is investing. Ask me 'Where should I invest?' for the full guide!");
      return nl(parts);
    }

    if (intent === "spending") {
      if (!hasData) return noData;
      const parts = [];
      parts.push("Spending Breakdown — " + month);
      parts.push("");
      parts.push("Income:   " + fmtINR(totalInc));
      parts.push("Spent:    " + fmtINR(totalExp) + " (" + spentPct + "% of income)");
      parts.push("Left:     " + fmtINR(remaining));
      parts.push("");
      catBreak.slice(0,6).forEach((c,idx) => {
        const pct = totalInc>0 ? Math.round((c.spent/totalInc)*100) : 0;
        const bar = "=".repeat(Math.min(10,Math.round(pct/3))) + "-".repeat(Math.max(0,10-Math.round(pct/3)));
        parts.push(c.icon + " " + c.label + ": " + fmtINR(c.spent) + " (" + pct + "%)");
        parts.push("  [" + bar + "]");
      });
      if (topCat) {
        const pct = totalInc>0 ? Math.round((topCat.spent/totalInc)*100) : 0;
        parts.push("");
        parts.push((pct>30?"Warning: ":"") + topCat.label + " is your biggest expense at " + fmtINR(topCat.spent) + " (" + pct + "%). " + (pct>30?"Consider setting a budget limit.":"Looks manageable."));
      }
      if (momDelta!==null) {
        parts.push("");
        parts.push("vs Last Month: " + (momDelta>0 ? "Spent " + momDelta + "% MORE (+" + fmtINR(totalExp-prevExp) + ")" : "Spent " + Math.abs(momDelta) + "% LESS (-" + fmtINR(prevExp-totalExp) + ")"));
      }
      return nl(parts);
    }

    if (intent === "budget") {
      if (!hasData) return noData;
      const parts = [];
      parts.push("Budget Plan — " + fmtINR(totalInc) + " income (" + month + ")");
      parts.push("");
      parts.push("50/30/20 Rule:");
      parts.push("Needs  (50%) = " + fmtINR(Math.round(totalInc*0.50)) + "  (rent, food, transport)");
      parts.push("Wants  (30%) = " + fmtINR(Math.round(totalInc*0.30)) + "  (shopping, dining, fun)");
      parts.push("Saving (20%) = " + fmtINR(Math.round(totalInc*0.20)) + "  (goals, investments)");
      parts.push("");
      parts.push("Category limits I recommend:");
      parts.push("Food & Dining:  " + fmtINR(Math.round(totalInc*0.15)) + " (15%)" + (foodAmt>0 ? "  — you spent " + fmtINR(foodAmt) + (foodAmt>totalInc*0.15?" — over!" :" — ok!") : ""));
      parts.push("Transport:      " + fmtINR(Math.round(totalInc*0.10)) + " (10%)" + (transAmt>0 ? "  — you spent " + fmtINR(transAmt) + (transAmt>totalInc*0.10?" — over!" :" — ok!") : ""));
      parts.push("Shopping:       " + fmtINR(Math.round(totalInc*0.10)) + " (10%)" + (shopAmt>0 ? "  — you spent " + fmtINR(shopAmt) + (shopAmt>totalInc*0.10?" — over!" :" — ok!") : ""));
      parts.push("Entertainment:  " + fmtINR(Math.round(totalInc*0.05)) + " (5%)" + (entAmt>0 ? "  — you spent " + fmtINR(entAmt) + (entAmt>totalInc*0.05?" — over!" :" — ok!") : ""));
      parts.push("Subscriptions:  " + fmtINR(Math.round(totalInc*0.05)) + " (5%)" + (subAmt>0 ? "  — you spent " + fmtINR(subAmt) + (subAmt>totalInc*0.05?" — over!" :" — ok!") : ""));
      parts.push("");
      parts.push("Tip: Click the Budgets button in the Dashboard to set these limits. I will warn you at 90%.");
      return nl(parts);
    }

    if (intent === "emergency") {
      const target  = totalExp>0 ? totalExp*6 : 300000;
      const current = emergencyGoal ? emergencyGoal.saved : 0;
      const pct     = target>0 ? Math.round((current/target)*100) : 0;
      const monthly = totalExp>0 ? Math.round(totalExp*0.10) : 5000;
      const months  = current<target ? Math.ceil((target-current)/Math.max(monthly,1)) : 0;
      const parts   = [];
      parts.push("Emergency Fund Guide");
      parts.push("");
      parts.push("This is the most important financial safety net. Without it, one emergency can destroy years of progress.");
      parts.push("");
      parts.push("Your ideal target: " + fmtINR(Math.round(target)) + " (6x your monthly expenses)");
      if (emergencyGoal) {
        const bar = "#".repeat(Math.round(pct/10)) + ".".repeat(10-Math.round(pct/10));
        parts.push("Your progress:  " + fmtINR(current) + " [" + bar + "] " + pct + "%");
        if (current>=target) {
          parts.push("You are fully covered! Major milestone achieved.");
        } else {
          parts.push("Still needed: " + fmtINR(Math.round(target-current)));
          parts.push("At " + fmtINR(monthly) + "/month you will be done in " + months + " months.");
        }
      } else {
        parts.push("No emergency fund goal found. Create one in the Goals tab with target " + fmtINR(Math.round(target)) + ".");
      }
      parts.push("");
      parts.push("Where to keep it:");
      parts.push("- Liquid mutual fund (best: 6-7% return, withdraw in 1 day)");
      parts.push("- High-yield savings account (4-6% return)");
      parts.push("- NOT in stocks or long-term FDs — you need instant access");
      return nl(parts);
    }

    if (intent === "food") {
      if (foodAmt===0) return "No food expenses in " + month + " yet. Add them in the Dashboard to get analysis. Tip: Tracking alone reduces spending by 10-15% because awareness changes behaviour.";
      const ideal = Math.round(totalInc*0.15);
      const over  = foodAmt-ideal;
      const parts = [];
      parts.push("Food Spending — " + month);
      parts.push("");
      parts.push("You spent:    " + fmtINR(foodAmt));
      parts.push("Ideal (15%):  " + fmtINR(ideal));
      parts.push(over>0 ? "Over by:      " + fmtINR(over) + "  — action needed!" : "Status:       Within target — good job!");
      parts.push("");
      parts.push("Tips to cut food costs:");
      parts.push("- Meal prep on Sunday: saves Rs 2,000-4,000/month");
      parts.push("- Swiggy/Zomato maximum 2x per week");
      parts.push("- Carry lunch to work 4 days a week");
      parts.push("- Buy groceries weekly in bulk, not daily");
      parts.push("- Cook breakfast at home: saves Rs 1,500-2,500/month");
      if (over>0) {
        parts.push("");
        parts.push("If you cut food by 20%, you save " + fmtINR(Math.round(foodAmt*0.2)) + "/month = " + fmtINR(Math.round(foodAmt*0.2*12)) + "/year!");
      }
      parts.push("");
      parts.push("Try the No Eating Out Week challenge in the Challenges tab!");
      return nl(parts);
    }

    if (intent === "loans") {
      if (loans.length===0) return "No loans recorded. Add them in the Loans tab to track EMIs. Rule: Total EMIs should be below 30-35% of income. Above that you are financially stressed.";
      const parts = [];
      parts.push("Loan Analysis");
      parts.push("");
      parts.push("Active loans: " + loans.length);
      parts.push("Total EMI:    " + fmtINR(totalEMI) + " (" + emiPct + "% of income)");
      parts.push("EMI health:   " + (emiPct<=30 ? "Healthy — under 30%" : emiPct<=40 ? "High — 30-40%, watch this" : "Very High — above 40%, action needed!"));
      parts.push("");
      parts.push("Your loans:");
      loans.forEach(l => parts.push("- " + l.bankName + " " + l.loanType + ": " + fmtINR(l.emi) + "/month" + (l.interestRate ? " at " + l.interestRate + "%" : "")));
      parts.push("");
      parts.push("Smart repayment (Avalanche Method):");
      parts.push("Prepay highest-interest loan first:");
      parts.push("Personal Loan (12-24%) > Gold Loan (10-15%) > Car Loan (8-12%) > Home Loan (8-10%)");
      if (emiPct>35) {
        parts.push("");
        parts.push("Since your EMI burden is high:");
        parts.push("1. No new loans until one is fully closed");
        parts.push("2. Any surplus goes to prepay highest-interest loan");
        parts.push("3. Avoid credit card debt — it charges 36-42% annual interest!");
      }
      return nl(parts);
    }

    if (intent === "goals") {
      if (goals.length===0) return "No savings goals set. Go to the Goals tab and create goals like Emergency Fund, Vacation, Gadget, Car, or House Down Payment. Every contribution is tracked and deducted from your monthly balance automatically.";
      const parts = [];
      parts.push("Goals Summary");
      parts.push("");
      parts.push("Total: " + goals.length + "  |  Done: " + completedGoals.length + "  |  In Progress: " + pendingGoals.length);
      parts.push("");
      goals.forEach(g => {
        const pct  = Math.min(100,Math.round((g.saved/g.target)*100));
        const bar  = "#".repeat(Math.round(pct/10)) + ".".repeat(10-Math.round(pct/10));
        const done = g.saved>=g.target;
        parts.push((done?"DONE: ":"Goal: ") + g.label);
        parts.push("  " + fmtINR(g.saved) + " / " + fmtINR(g.target) + "  [" + bar + "]  " + pct + "%");
        if (g.deadline && !done) {
          const days = Math.ceil((new Date(g.deadline)-new Date())/864e5);
          const req  = days>0 ? Math.ceil((g.target-g.saved)/(days/30)) : 0;
          parts.push("  " + (days<0 ? "Deadline passed!" : days<=30 ? "Due in " + days + " days — need " + fmtINR(req) + "/month" : Math.ceil(days/30) + " months left — need " + fmtINR(req) + "/month"));
        }
      });
      if (nearDeadline.length>0) {
        parts.push("");
        parts.push("Urgent: " + nearDeadline.map(g=>g.label).join(", ") + " due within 90 days!");
      }
      parts.push("");
      parts.push("Use the Contribute button on each goal — it records the amount as a savings expense automatically.");
      return nl(parts);
    }

    if (intent === "health") {
      if (!hasData) return noData;
      const score = Math.max(0,Math.min(100,(savePct>=20?35:savePct>=10?20:5)+(emiPct<=30?25:emiPct<=40?15:5)+(goals.length>0?completedGoals.length>0?20:12:0)+(topCat&&topCat.spent<totalInc*0.35?20:10)));
      const grade = score>=80?"A+":score>=70?"A":score>=60?"B+":score>=50?"B":score>=40?"C":"D";
      const parts = [];
      parts.push("Financial Health Report — " + month);
      parts.push("");
      parts.push("Grade: " + grade + "  (" + score + "/100)");
      parts.push("Income: " + fmtINR(totalInc) + "  |  Expenses: " + fmtINR(totalExp) + "  |  Remaining: " + fmtINR(remaining));
      parts.push("Savings Rate: " + savePct + "% " + (savePct>=20 ? "— Excellent!" : savePct>=10 ? "— Can improve" : "— Needs attention"));
      parts.push("EMI Burden:   " + emiPct + "% " + (emiPct<=30 ? "— Healthy" : emiPct<=40 ? "— High" : "— Very High!"));
      if (momDelta!==null) parts.push("vs Last Month: " + (momDelta>0 ? "Spent " + momDelta + "% more" : "Spent " + Math.abs(momDelta) + "% less — well done!"));
      const actions = [];
      if (savePct<20) actions.push("Increase savings to " + fmtINR(Math.round(totalInc*0.20)) + "/month (now: " + fmtINR(savingsAmt) + ")");
      if (emiPct>35) actions.push("EMI burden is high — prepay highest-interest loan first");
      if (!emergencyGoal) actions.push("Create Emergency Fund goal (target: " + fmtINR(Math.round(totalExp*6)) + ")");
      if (topCat && topCat.spent>totalInc*0.35) actions.push("Set a budget for " + topCat.label + " in the Dashboard");
      if (actions.length>0) {
        parts.push("");
        parts.push("Top improvements:");
        actions.forEach((a,i) => parts.push((i+1) + ". " + a));
      } else {
        parts.push("");
        parts.push("You are in great shape! Focus on growing your investments now.");
      }
      return nl(parts);
    }

    if (intent === "invest") {
      const surplus = Math.max(0,remaining);
      const parts = [];
      parts.push("Investment Guide for Indians");
      parts.push("");
      if (hasData && surplus>0) {
        parts.push("You have " + fmtINR(surplus) + " available to invest this month.");
        parts.push("");
      }
      parts.push("The investment ladder — follow in order:");
      parts.push("");
      parts.push("Step 1: Emergency Fund (before investing anything!)");
      parts.push("  Target: " + fmtINR(hasData?Math.round(totalExp*6):300000) + " in a liquid mutual fund");
      parts.push("");
      parts.push("Step 2: Tax-saving under 80C (limit Rs 1.5L/year)");
      parts.push("  Best option: ELSS Mutual Fund (3-year lock-in + equity returns)");
      parts.push("  Also: PPF (safe, 7.1% tax-free), EPF (if salaried)");
      parts.push("");
      parts.push("Step 3: Long-term equity SIPs");
      parts.push("  Best for beginners: Nifty 50 Index Fund");
      parts.push("  Start with Rs 500/month — increase 10% every year");
      parts.push("");
      parts.push("Step 4: NPS for extra tax saving (Rs 50,000 under 80CCD)");
      parts.push("");
      parts.push("SIP returns at 12% CAGR:");
      parts.push("  Rs 3,000/month x 15 years = approx Rs 30 Lakhs");
      parts.push("  Rs 5,000/month x 15 years = approx Rs 50 Lakhs");
      parts.push("  Rs 10,000/month x 15 years = approx Rs 1 Crore");
      parts.push("");
      parts.push("Key principle: Start small, start NOW. Time in market beats timing the market.");
      parts.push("");
      parts.push("Note: This is educational guidance. For personalised plans, consult a SEBI-registered advisor.");
      return nl(parts);
    }

    if (intent === "tax") {
      const parts = [];
      parts.push("Tax Saving Guide — India");
      parts.push("");
      parts.push("Section 80C (limit: Rs 1,50,000/year)");
      parts.push("  - ELSS Mutual Funds (best — 3yr lock-in + equity returns)");
      parts.push("  - PPF (safe — 7.1%, 15yr, tax-free returns)");
      parts.push("  - EPF contributions (automatic if salaried)");
      parts.push("  - Life insurance premium");
      parts.push("  - Home loan principal repayment");
      parts.push("  - Children tuition fees");
      parts.push("");
      parts.push("Section 80D — Health Insurance");
      parts.push("  - Self + family: up to Rs 25,000");
      parts.push("  - Senior citizen parents: additional Rs 50,000");
      parts.push("");
      parts.push("HRA — House Rent Allowance");
      parts.push("  - Salaried employees can claim HRA exemption");
      parts.push("  - Keep rent receipts if monthly rent > Rs 8,333");
      parts.push("");
      parts.push("NPS — Additional Rs 50,000 under 80CCD(1B) over and above 80C");
      parts.push("");
      parts.push("New vs Old Tax Regime:");
      parts.push("  - Old regime: Better if total deductions > Rs 3.75 Lakhs");
      parts.push("  - New regime: Better for lower deductions, simpler calculation");
      parts.push("");
      parts.push("File ITR before July 31 to avoid penalties!");
      return nl(parts);
    }

    if (intent === "subscriptions") {
      const parts = [];
      parts.push("Subscription Audit Guide");
      parts.push("");
      if (subAmt>0) {
        parts.push("You spend " + fmtINR(subAmt) + "/month = " + fmtINR(subAmt*12) + "/year on subscriptions.");
        parts.push("");
      }
      parts.push("How to audit (takes 10 minutes):");
      parts.push("1. List every subscription — check bank/UPI statements");
      parts.push("2. Ask: Did I use this in the last 30 days?");
      parts.push("3. Cancel every No answer immediately");
      parts.push("4. Switch to annual plans for services you keep (saves 20-40%)");
      parts.push("5. Share family plans — Netflix/Spotify allow multiple profiles");
      parts.push("");
      parts.push("Common ones to review: Netflix, Amazon Prime, Hotstar, Spotify,");
      parts.push("YouTube Premium, gym membership, cloud storage plans");
      parts.push("");
      parts.push("Try the Subscription Slayer challenge in the Challenges tab!");
      return nl(parts);
    }

    if (intent === "income") {
      const srcs = curMonth.incomeSources;
      if (srcs.length===0) return "No income recorded for " + month + ". Go to Dashboard and click Add Income to add your salary and other sources.";
      const parts = [];
      parts.push("Income Analysis — " + month);
      parts.push("");
      parts.push("Total: " + fmtINR(totalInc) + " from " + srcs.length + " source(s)");
      srcs.forEach(s => parts.push("  - " + s.label + ": " + fmtINR(s.amount)));
      parts.push("");
      parts.push("Allocation:");
      parts.push("  Expenses:  " + fmtINR(totalExp) + " (" + spentPct + "%)");
      if (totalEMI>0) parts.push("  EMIs:      " + fmtINR(totalEMI) + " (" + emiPct + "%)");
      parts.push("  Remaining: " + fmtINR(remaining) + " (" + savePct + "%)");
      parts.push("");
      parts.push("Ways to grow your income:");
      parts.push("- Ask for appraisal — most companies expect it annually");
      parts.push("- Freelance or consult in your field on weekends");
      parts.push("- Monetise a skill: tutoring, music, coding, writing");
      parts.push("- Invest consistently — your money earns money while you sleep");
      return nl(parts);
    }

    if (intent === "transport") {
      const parts = [];
      parts.push("Transport Spending — " + month);
      parts.push("");
      if (transAmt>0) {
        const ideal = Math.round(totalInc*0.10);
        parts.push("You spent: " + fmtINR(transAmt) + "  |  Ideal (10%): " + fmtINR(ideal));
        parts.push(transAmt>ideal ? "Over by " + fmtINR(transAmt-ideal) + " — let us fix this." : "Within target — good!");
        parts.push("");
      }
      parts.push("Tips to reduce transport costs:");
      parts.push("- Metro + auto is 40-60% cheaper than Ola/Uber daily");
      parts.push("- Carpool with colleagues to split fuel and toll");
      parts.push("- Work from home 2 days a week if possible");
      parts.push("- Monthly metro/bus pass is cheaper than per-trip cost");
      parts.push("- Keep tyres inflated — bad pressure reduces mileage 10%");
      parts.push("");
      parts.push("Try the Green Commute Week challenge in the Challenges tab!");
      return nl(parts);
    }

    if (intent === "shopping") {
      const parts = [];
      parts.push("Shopping Spending — " + month);
      parts.push("");
      if (shopAmt>0) {
        const ideal = Math.round(totalInc*0.10);
        parts.push("You spent: " + fmtINR(shopAmt) + "  |  Ideal (10%): " + fmtINR(ideal));
        parts.push(shopAmt>ideal ? "Over by " + fmtINR(shopAmt-ideal) : "Within target — well done!");
        parts.push("");
      }
      parts.push("Tips to control shopping:");
      parts.push("- 24-hour rule: Wait a day before any purchase above Rs 500");
      parts.push("- Uninstall shopping apps from home screen");
      parts.push("- Unsubscribe from all promotional emails");
      parts.push("- Keep a wishlist — if still wanted in 30 days, then buy");
      parts.push("- Ask: Am I buying because I need it or because it is on sale?");
      parts.push("");
      parts.push("Try the Zero Impulse Month challenge in the Challenges tab!");
      return nl(parts);
    }

    if (intent === "terms") {
      const t = question.toLowerCase();
      if (t.includes("sip")) return nl(["SIP — Systematic Investment Plan","","A way to invest a fixed amount in mutual funds every month — like an EMI but for building wealth instead of repaying debt.","","Even Rs 500/month in a Nifty 50 index fund, started at age 25, grows to Rs 1.7 Crore by age 60 at 12% CAGR.","","Benefits: Rupee cost averaging, no need to time the market, disciplined saving, starts from Rs 100/month."]);
      if (t.includes("cagr")) return nl(["CAGR — Compound Annual Growth Rate","","The average annual return rate of an investment. If Rs 1 lakh grew to Rs 2 lakh in 6 years, CAGR = 12.25%.","","It is the most honest way to compare investments. FD gives 7% CAGR. Good equity fund gives 12-15% CAGR over 10+ years."]);
      if (t.includes("elss")) return nl(["ELSS — Equity Linked Savings Scheme","","A mutual fund that saves tax under Section 80C (up to Rs 1.5L/year) with only 3-year lock-in.","","Usually the BEST 80C option because you get equity market returns (12-15% historically) alongside tax saving.","","How to start: Any mutual fund app (Zerodha, Groww, Kuvera) — search ELSS and start SIP."]);
      if (t.includes("ppf")) return nl(["PPF — Public Provident Fund","","Government-backed savings with 7.1% guaranteed, completely tax-free returns. 15-year lock-in but very safe.","","Contributions up to Rs 1.5L/year qualify for 80C deduction. Interest and maturity are both tax-free.","","Best for: Conservative investors, long-term safety, guaranteed returns without market risk."]);
      if (t.includes("nps")) return nl(["NPS — National Pension System","","A government pension scheme with extra Rs 50,000 tax deduction under 80CCD(1B) — beyond the Rs 1.5L 80C limit.","","Your money is invested in equity, government bonds, and corporate bonds. Returns are market-linked.","","Drawback: Locked till age 60. At retirement, 40% must be used for annuity (pension)."]);
      if (t.includes("cibil") || t.includes("credit score")) return nl(["Credit Score / CIBIL Score","","Ranges from 300 to 900. Above 750 = excellent. Below 650 = loan rejections likely.","","What affects it:","- Payment history (35%) — pay EMIs on time, always","- Credit utilisation (30%) — keep below 30% of card limit","- Credit history length (15%) — keep old cards active","- New credit inquiries (10%) — do not apply for too many loans","","Check free once a year on CIBIL website or apps like CRED/Paytm."]);
      if (t.includes("inflation")) return nl(["Inflation — The Silent Wealth Destroyer","","At 6% inflation: Rs 1 lakh today = Rs 74,000 in 5 years = Rs 42,000 in 15 years in real value.","","What this means for your money:","- Savings account (4%) LOSES value vs 6% inflation","- FD (7%) barely keeps up after paying tax on interest","- Equity mutual funds (12-15% historically) actually BEAT inflation","","Solution: Never keep long-term savings in just a savings account. Invest in equity SIPs."]);
      if (t.includes("compound")) return nl(["Compound Interest — The 8th Wonder of the World","","Earning interest on your interest. The longer you wait, the more powerful it gets.","","Example: Rs 1 lakh at 12% per year","- After 5 years:  Rs 1.76 lakh","- After 10 years: Rs 3.11 lakh","- After 20 years: Rs 9.65 lakh","- After 30 years: Rs 29.96 lakh","","The lesson: Start investing as early as possible, even small amounts."]);
      if (t.includes("nav")) return nl(["NAV — Net Asset Value","","The price of one unit of a mutual fund, calculated daily.","","A lower NAV does NOT mean the fund is cheaper or better. What matters is the fund's quality and future returns, not the current NAV.","","Think of it like a stock price — the history and growth rate matter, not the absolute number."]);
      if (t.includes("liquid fund")) return nl(["Liquid Mutual Fund","","A mutual fund that invests in very short-term instruments. Can be redeemed within 1 business day.","","Returns: 6-7% — much better than savings account (4%)","Ideal for: Emergency fund, money you need in 1-12 months","","Popular ones: Nippon India Liquid Fund, HDFC Liquid Fund, SBI Liquid Fund"]);
      if (t.includes("net worth")) return nl(["Net Worth — Your Real Financial Score","","Net Worth = Total Assets - Total Liabilities","","Assets: Cash, FDs, investments, property value, gold, EPF/PPF balance","Liabilities: All outstanding loan balances","","Why it matters: Salary shows how much you earn. Net worth shows how much you have built. Focus on growing net worth, not just income.","",(hasData&&loans.length>0?"Your current loan liabilities: " + fmtINR(loans.reduce((s,l)=>s+l.principal,0)):"")]);
      return nl(["I can explain many Indian finance terms.","","Ask about any of these:","- SIP, ELSS, PPF, NPS (investing and tax saving)","- CAGR, XIRR, NAV (understanding returns)","- CIBIL / Credit Score (loan eligibility)","- Inflation, Compound Interest (money concepts)","- Liquid Fund, FD, RD (where to keep savings)","- Net Worth (measuring financial progress)"]);
    }

    if (intent === "motivation") {
      const options = [
        nl(["Financial stress is completely normal — and the fact that you are tracking your finances already puts you ahead of most people.","","Small steps beat perfect plans. Even saving Rs 500 more this month than last month is real progress.","","One thing to remember: You are not broke. You are pre-wealthy. Every rupee you invest today is working silently for you 24/7.","","What one small action can you take today? Even setting up a Rs 500 SIP counts."] ),
        nl(["Every person who built wealth started somewhere — often from a worse position than you are in now.","","The formula is simple: Earn more than you spend. Save consistently. Invest patiently. Repeat.","","The hardest part is not the math — it is the discipline. And you are already showing that discipline by being here.","","Focus on what you can control: your spending choices, your savings habit, your financial knowledge. The results will follow."]),
        nl(["Money anxiety is one of the most common forms of stress. You are not alone.","","The most powerful thing you can do right now: Do not run away from the numbers. Face them. The awareness itself starts to change things.","","Your income is not the problem. The gap between income and savings is what we need to close — and I am here to help you do that step by step.","","What is worrying you most right now? Tell me and we will work through it together."])
      ];
      return options[Math.floor(Math.random()*options.length)];
    }

    if (intent === "tips") {
      const parts = [];
      parts.push("10 Habits of Financially Healthy Indians");
      parts.push("");
      parts.push("1.  Pay yourself first — save before you spend, not after");
      parts.push("2.  Follow 50/30/20 — needs, wants, savings every month");
      parts.push("3.  Emergency fund first — 6 months expenses before investing");
      parts.push("4.  Invest early — Rs 3,000/month from 25 beats Rs 6,000 from 35");
      parts.push("5.  Avoid lifestyle inflation — raises should increase savings not spending");
      parts.push("6.  24-hour rule — wait before any purchase above Rs 500");
      parts.push("7.  Track everything — what gets measured gets managed");
      parts.push("8.  Keep EMIs below 30% of income");
      parts.push("9.  Review finances every Sunday — 10 minutes is enough");
      parts.push("10. Increase SIP by 10% automatically every year");
      if (hasData) {
        parts.push("");
        parts.push("For you right now, the most impactful habit is:");
        if (savePct<20) parts.push("Automate saving " + fmtINR(Math.round(totalInc*0.20)) + " on salary day");
        else if (!emergencyGoal) parts.push("Build your emergency fund — target " + fmtINR(Math.round(totalExp*6)));
        else parts.push("Start or increase your SIP investment this month");
      }
      return nl(parts);
    }

    if (intent === "networth") {
      const parts = [];
      parts.push("Net Worth Calculator");
      parts.push("");
      parts.push("Net Worth = Total Assets - Total Liabilities");
      parts.push("");
      parts.push("Your liabilities in Vatsu:");
      if (loans.length>0) {
        loans.forEach(l => parts.push("  - " + l.bankName + " " + l.loanType + ": " + fmtINR(l.principal)));
        parts.push("  Total loans: " + fmtINR(loans.reduce((s,l)=>s+l.principal,0)));
      } else {
        parts.push("  No loans — great position to start building net worth!");
      }
      parts.push("");
      parts.push("Track your assets in the Goals tab:");
      parts.push("  - Emergency fund, FDs, savings");
      parts.push("  - Mutual fund / stock portfolio");
      parts.push("  - EPF and PPF balance");
      parts.push("  - Gold value");
      parts.push("  - Property value");
      parts.push("");
      parts.push("How to grow net worth:");
      parts.push("1. Reduce liabilities — prepay high-interest loans");
      parts.push("2. Grow assets — invest in equity SIPs consistently");
      parts.push("3. Avoid depreciating purchases — cars lose 15-20% per year");
      parts.push("4. Target: Net worth = 10-15x annual income at retirement");
      return nl(parts);
    }

    if (intent === "insurance") {
      const parts = [];
      parts.push("Insurance Guide");
      parts.push("");
      parts.push("The 2 most important insurances:");
      parts.push("");
      parts.push("1. Term Life Insurance (if you have dependents)");
      parts.push("   Cover: 10-15x your annual income");
      parts.push("   Cost: Rs 8,000-15,000/year for Rs 1 Crore cover");
      parts.push("   Buy as early as possible — premium is lower when young");
      parts.push("   AVOID: ULIPs, endowment plans — high fees, poor returns");
      parts.push("");
      parts.push("2. Health Insurance (everyone needs this)");
      parts.push("   Minimum cover: Rs 5-10 Lakhs for self, Rs 10-15L for family");
      parts.push("   Cost: Rs 8,000-20,000/year for decent family cover");
      parts.push("   Tax benefit: Up to Rs 25,000 under Section 80D");
      parts.push("   Even if employer gives cover — buy personal policy too");
      parts.push("   (You lose employer cover if you change jobs)");
      parts.push("");
      parts.push("Rule: Insurance is NOT an investment.");
      parts.push("Buy term + health. Invest the rest in mutual funds.");
      return nl(parts);
    }

    if (intent === "realestate") {
      const parts = [];
      parts.push("Rent vs Buy — Indian Real Estate Guide");
      parts.push("");
      parts.push("Buy a home if:");
      parts.push("- You plan to stay 7+ years in the same city");
      parts.push("- EMI is not more than 40% of income");
      parts.push("- You have 20% down payment ready (no loan for down payment)");
      parts.push("- Property price is below 300x monthly rent");
      parts.push("");
      parts.push("Keep renting if:");
      parts.push("- You may relocate within 5 years");
      parts.push("- EMI would exceed 40% of your income");
      parts.push("- Investing the down payment in equity gives better returns");
      parts.push("");
      parts.push("Home loan tax benefits:");
      parts.push("- Principal repayment: Rs 1.5L under 80C");
      parts.push("- Interest paid: Up to Rs 2L under Section 24B");
      parts.push("");
      parts.push("My honest advice: Do not buy because of family pressure or FOMO.");
      parts.push("Buy when the financial numbers genuinely make sense for you.");
      return nl(parts);
    }

    if (intent === "creditScore") {
      const parts = [];
      parts.push("CIBIL / Credit Score Guide");
      parts.push("");
      parts.push("Score ranges:");
      parts.push("750-900: Excellent — best loan rates, easy approvals");
      parts.push("700-750: Good — most loans at fair rates");
      parts.push("650-700: Average — some rejections, higher interest");
      parts.push("Below 650: Poor — most loans rejected");
      parts.push("");
      parts.push("How to build a great score:");
      parts.push("1. Pay ALL EMIs and credit card bills on time — most important!");
      parts.push("2. Keep credit card usage below 30% of limit");
      parts.push("3. Do not apply for many loans or cards in short period");
      parts.push("4. Keep old credit cards active — history length matters");
      parts.push("");
      parts.push("How to check: CIBIL website (free once/year) or CRED, Paytm, BankBazaar apps.");
      parts.push("");
      parts.push("A low score takes 6-12 months of consistent repayments to improve.");
      return nl(parts);
    }

    /* ─── DEFAULT: friendly catch-all with real data ─── */
    if (!hasData) return noData;
    const parts2 = [];
    parts2.push("I understood your question! Here is your current " + month + " status:");
    parts2.push("");
    parts2.push("Income: " + fmtINR(totalInc) + "  |  Spent: " + fmtINR(totalExp) + " (" + spentPct + "%)  |  Remaining: " + fmtINR(remaining));
    parts2.push("Savings Rate: " + savePct + "% " + (savePct>=20?"— Great!":savePct>=10?"— Can improve":"— Needs work"));
    if (topCat) parts2.push("Top expense: " + topCat.icon + " " + topCat.label + " (" + fmtINR(topCat.spent) + ")");
    parts2.push("");
    parts2.push("Topics I can help you with:");
    parts2.push("- Savings plan and where to save");
    parts2.push("- Spending breakdown and budget");
    parts2.push("- Investment guide (SIP, ELSS, PPF, NPS)");
    parts2.push("- Tax saving under 80C, HRA, NPS");
    parts2.push("- Emergency fund setup");
    parts2.push("- Loan and EMI strategy");
    parts2.push("- Goal planning and tracking");
    parts2.push("- Financial terms explained");
    parts2.push("- Motivation and financial habits");
    parts2.push("");
    parts2.push("Just ask me anything — in plain English or Hinglish!");
    return nl(parts2);
  }

  function analyse(question) {
    const intent = detectIntent(question);
    return respond(intent, question);
  }

  function send() {
    const q = input.trim();
    if (!q || loading) return;
    setMsgs(p => [...p, { role:"user", content:q }]);
    setInput("");
    setLoading(true);
    setTimeout(() => {
      setMsgs(p => [...p, { role:"assistant", content:analyse(q) }]);
      setLoading(false);
    }, 400);
  }

  const quickQ = ["How can I save more?","Where is my money going?","Best investments for me","Tax saving tips","Emergency fund guide","My financial health","Explain SIP","Reduce food costs","Loan strategy","Motivate me!"];

  function MsgText({ text, isUser }) {
    if (isUser) return <span style={{ fontSize:13, fontFamily:BODY, fontWeight:600 }}>{text}</span>;
    return (
      <div style={{ fontSize:13, fontFamily:BODY, lineHeight:1.8 }}>
        {text.split("\n").map((line, i) => {
          if (!line.trim()) return <div key={i} style={{ height:5 }} />;
          return <div key={i} style={{ marginBottom:2 }}>{line}</div>;
        })}
      </div>
    );
  }

  const showWelcome = msgs.length === 0;

  return (
    <div style={{ display:"flex", flexDirection:"column", height:580, background:T.cardGrad, border:"1px solid "+T.border, borderRadius:20, overflow:"hidden" }}>
      <div style={{ padding:"14px 18px", background:theme==="dark"?"linear-gradient(135deg,#060f1c,#04090f)":"linear-gradient(135deg,#0d2340,#1a3a62)", borderBottom:"1px solid "+T.border, flexShrink:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ width:42, height:42, borderRadius:"50%", background:"linear-gradient(135deg,#1dd1a1,#0abf8a)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, boxShadow:"0 0 18px #1dd1a155", flexShrink:0 }}>🤖</div>
          <div style={{ flex:1 }}>
            <div style={{ fontWeight:700, color:"#f0f8ff", fontFamily:TF, fontSize:15 }}>Vatsu CA Advisor</div>
            <div style={{ fontSize:11, color:"#1dd1a1", fontFamily:BODY, marginTop:1 }}>Smart Finance Engine — Works Everywhere — 100% Free — No Setup Needed</div>
          </div>
          <div style={{ padding:"4px 12px", borderRadius:20, background:"#1dd1a122", border:"1px solid #1dd1a155", fontSize:10, color:"#1dd1a1", fontFamily:BODY, fontWeight:700 }}>LIVE</div>
        </div>
      </div>

      {showWelcome && (
        <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"20px", gap:14, overflowY:"auto" }}>
          <div style={{ fontSize:44 }}>🤖</div>
          <div style={{ textAlign:"center", maxWidth:340 }}>
            <div style={{ fontSize:17, fontWeight:800, color:T.textBright, fontFamily:TF, marginBottom:6 }}>Namaste! I am your CA Advisor</div>
            <div style={{ fontSize:13, color:T.textSub, fontFamily:BODY, lineHeight:1.7 }}>I know your real numbers and give personalised advice on savings, investments, tax, loans, goals and more. Works like talking to a friendly CA!</div>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, width:"100%", maxWidth:360 }}>
            {[["Save more money","💰"],["Spending analysis","📊"],["Investment guide","📈"],["Tax saving tips","🏛️"],["Goal planning","🎯"],["Loan strategy","🏦"],["Financial terms","💡"],["Emergency fund","🛡️"]].map(([label, icon]) => (
              <div key={label} onClick={() => setInput(label)} style={{ padding:"10px 12px", background:T.surface3, border:"1px solid "+T.border, borderRadius:12, fontSize:12, color:T.textSub, fontFamily:BODY, display:"flex", alignItems:"center", gap:8, cursor:"pointer" }}>
                <span style={{ fontSize:18 }}>{icon}</span>{label}
              </div>
            ))}
          </div>
          <div style={{ fontSize:11, color:T.textMuted, fontFamily:BODY, textAlign:"center" }}>Or type any finance question below</div>
        </div>
      )}

      {!showWelcome && (
        <div style={{ flex:1, overflowY:"auto", padding:"14px 16px", display:"flex", flexDirection:"column", gap:12 }}>
          {msgs.map((m, i) => (
            <div key={i} style={{ display:"flex", justifyContent:m.role==="user"?"flex-end":"flex-start", gap:8 }}>
              {m.role==="assistant" && <div style={{ width:28, height:28, borderRadius:"50%", background:"linear-gradient(135deg,#1dd1a1,#0abf8a)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, flexShrink:0, marginTop:2 }}>🤖</div>}
              <div style={{ maxWidth:"84%", padding:"12px 15px", borderRadius:m.role==="user"?"18px 18px 4px 18px":"18px 18px 18px 4px", background:m.role==="user"?"linear-gradient(135deg,#1dd1a1,#0abf8a)":theme==="dark"?"linear-gradient(135deg,#0b1825,#071018)":"#f0f6ff", color:m.role==="user"?"#02080f":T.text, border:m.role==="assistant"?"1px solid "+T.border2:"none", boxShadow:m.role==="user"?"0 4px 14px #1dd1a133":"0 2px 8px #00000018" }}>
                <MsgText text={m.content} isUser={m.role==="user"} />
              </div>
            </div>
          ))}
          {loading && (
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <div style={{ width:28, height:28, borderRadius:"50%", background:"linear-gradient(135deg,#1dd1a1,#0abf8a)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, flexShrink:0 }}>🤖</div>
              <div style={{ display:"flex", gap:5, padding:"12px 16px", background:theme==="dark"?"#0b1825":"#f0f6ff", borderRadius:"18px 18px 18px 4px", border:"1px solid "+T.border2 }}>
                {[0,1,2].map(ii => <div key={ii} style={{ width:8, height:8, borderRadius:"50%", background:"#1dd1a1", animation:"vPulse 1.2s "+(ii*0.2)+"s infinite" }} />)}
              </div>
            </div>
          )}
          <div ref={bottom} />
        </div>
      )}

      <div style={{ padding:"8px 14px 4px", display:"flex", gap:6, overflowX:"auto", borderTop:"1px solid "+T.border, flexShrink:0 }}>
        {quickQ.map(q => (
          <button key={q} onClick={() => setInput(q)} style={{ whiteSpace:"nowrap", padding:"5px 12px", borderRadius:18, border:"1px solid "+T.border, background:"transparent", color:T.textSub, fontSize:11, cursor:"pointer", fontFamily:BODY }}>
            {q}
          </button>
        ))}
      </div>

      <div style={{ padding:"10px 14px", borderTop:"1px solid "+T.border, display:"flex", gap:8, flexShrink:0 }}>
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key==="Enter" && send()} placeholder="Ask anything about your finances..." style={{ ...IS2, flex:1, padding:"10px 14px" }} />
        <Btn v="primary" onClick={send} sx={{ padding:"10px 20px", whiteSpace:"nowrap", opacity:loading?0.6:1 }}>Ask</Btn>
      </div>
    </div>
  );
}
