import { useState, useEffect, useRef, useCallback } from "react";

const CATEGORIES = ["Food","Transport","Shopping","Health","Entertainment","Bills","Education","Others"];
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const COLORS = ["#6366f1","#8b5cf6","#ec4899","#f43f5e","#f97316","#eab308","#22c55e","#14b8a6","#3b82f6","#06b6d4","#a855f7","#84cc16"];

function useLocalStorage(key, def) {
  const [val, setVal] = useState(() => {
    try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : def; }
    catch { return def; }
  });
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} }, [key, val]);
  return [val, setVal];
}

function fmtINR(n) {
  if (isNaN(n) || n === null || n === undefined) return "₹0";
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}

function Donut({ segments, size = 120, thick = 18 }) {
  const cx = size / 2, cy = size / 2, rr = (size - thick) / 2;
  let cum = 0;
  const total = segments.reduce((a, s) => a + s.value, 0);
  if (total === 0) return <svg width={size} height={size}><circle cx={cx} cy={cy} r={rr} fill="none" stroke="#e5e7eb" strokeWidth={thick}/></svg>;
  const arcs = segments.map((s, i) => {
    const pct = s.value / total;
    const a1 = cum * 2 * Math.PI - Math.PI / 2;
    const a2 = (cum + pct) * 2 * Math.PI - Math.PI / 2;
    cum += pct;
    const x1 = cx + rr * Math.cos(a1), y1 = cy + rr * Math.sin(a1);
    const x2 = cx + rr * Math.cos(a2), y2 = cy + rr * Math.sin(a2);
    const lg = pct > 0.5 ? 1 : 0;
    return <path key={i} d={`M ${x1} ${y1} A ${rr} ${rr} 0 ${lg} 1 ${x2} ${y2}`} fill="none" stroke={s.color} strokeWidth={thick} strokeLinecap="round"/>;
  });
  return <svg width={size} height={size}>{arcs}</svg>;
}

function ProgressBar({ pct, color = "#6366f1", height = 8 }) {
  return (
    <div style={{ background: "#e5e7eb", borderRadius: 99, height, overflow: "hidden", width: "100%" }}>
      <div style={{ width: `${Math.min(pct, 100)}%`, background: color, height: "100%", borderRadius: 99, transition: "width 0.4s" }}/>
    </div>
  );
}

function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div style={{ position:"fixed",inset:0,zIndex:1000,background:"rgba(0,0,0,0.45)",display:"flex",alignItems:"center",justifyContent:"center",padding:16 }} onClick={onClose}>
      <div style={{ background:"var(--card)",borderRadius:16,padding:24,minWidth:320,maxWidth:480,width:"100%",boxShadow:"0 8px 32px rgba(0,0,0,0.18)",maxHeight:"90vh",overflowY:"auto" }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16 }}>
          <b style={{ fontSize:18 }}>{title}</b>
          <button onClick={onClose} style={{ background:"none",border:"none",fontSize:22,cursor:"pointer",color:"var(--text2)" }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Badge({ label, color }) {
  return <span style={{ background: color + "22", color, borderRadius: 99, padding: "2px 10px", fontSize: 12, fontWeight: 600 }}>{label}</span>;
}

function sipProjection(monthlyAmt, annualRate, years) {
  const r = annualRate / 12 / 100;
  const n = years * 12;
  if (r === 0) return monthlyAmt * n;
  return monthlyAmt * ((Math.pow(1 + r, n) - 1) / r) * (1 + r);
}

export default function Vatsu() {
  const [theme, setTheme] = useLocalStorage("vatsu_theme", "light");
  const [tab, setTab] = useState("dashboard");
  const [expenses, setExpenses] = useLocalStorage("vatsu_expenses", []);
  const [income, setIncome] = useLocalStorage("vatsu_income", 50000);
  const [goals, setGoals] = useLocalStorage("vatsu_goals", []);
  const [loans, setLoans] = useLocalStorage("vatsu_loans", []);
  const [challenges, setChallenges] = useLocalStorage("vatsu_challenges", []);
  const [recurringList, setRecurringList] = useLocalStorage("vatsu_recurring", []);
  const [customCats, setCustomCats] = useLocalStorage("vatsu_customcats", []);
  const [activeMonth, setActiveMonth] = useLocalStorage("vatsu_month", new Date().getMonth());
  const [activeYear, setActiveYear] = useLocalStorage("vatsu_year", new Date().getFullYear());

  const [showAdd, setShowAdd] = useState(false);
  const [showIncome, setShowIncome] = useState(false);
  const [showGoal, setShowGoal] = useState(false);
  const [showLoan, setShowLoan] = useState(false);
  const [showChallenge, setShowChallenge] = useState(false);
  const [showRecurring, setShowRecurring] = useState(false);
  const [showCustomCat, setShowCustomCat] = useState(false);
  const [editExpense, setEditExpense] = useState(null);
  const [notification, setNotification] = useState(null);
  const [aiQuery, setAiQuery] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  const allCats = [...CATEGORIES, ...customCats];

  const notify = useCallback((msg, type = "success") => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const mk = `${activeYear}-${String(Number(activeMonth) + 1).padStart(2, "0")}`;

  const monthExpenses = expenses.filter(e => e.date && e.date.startsWith(mk));
  const totalSpent = monthExpenses.reduce((a, e) => a + Number(e.amount), 0);
  const balance = income - totalSpent;
  const savingsRate = income > 0 ? ((balance / income) * 100).toFixed(1) : 0;

  function addExpense(data) {
    if (editExpense) {
      setExpenses(expenses.map(e => e.id === editExpense.id ? { ...e, ...data } : e));
      notify("Expense updated!");
    } else {
      setExpenses([{ id: Date.now(), ...data }, ...expenses]);
      notify("Expense added!");
    }
    setEditExpense(null);
    setShowAdd(false);
  }

  function deleteExpense(id) {
    setExpenses(expenses.filter(e => e.id !== id));
    notify("Expense deleted!", "error");
  }

  function applyRecurring() {
    const toAdd = recurringList.map(r => ({
      id: Date.now() + Math.random(),
      desc: r.desc, amount: r.amount, category: r.category,
      date: `${activeYear}-${String(Number(activeMonth) + 1).padStart(2, "0")}-01`,
      note: "Recurring"
    }));
    setExpenses([...toAdd, ...expenses]);
    notify(`Added ${toAdd.length} recurring expenses!`);
  }

  const catTotals = allCats.map((cat, i) => ({
    cat, color: COLORS[i % COLORS.length],
    total: monthExpenses.filter(e => e.category === cat).reduce((a, e) => a + Number(e.amount), 0)
  })).filter(c => c.total > 0);

  return (
    <div className="vatsu-app" data-theme={theme}>
      <style>{`
        :root { --bg:#f1f5f9; --card:#fff; --text:#1e293b; --text2:#64748b; --border:#e2e8f0; --accent:#6366f1; --accent2:#8b5cf6; }
        [data-theme="dark"] { --bg:#0f172a; --card:#1e293b; --text:#f1f5f9; --text2:#94a3b8; --border:#334155; --accent:#818cf8; --accent2:#a78bfa; }
        * { box-sizing:border-box; margin:0; padding:0; }
        body { background:var(--bg); color:var(--text); font-family:'Inter',sans-serif; }
        .vatsu-app { min-height:100vh; background:var(--bg); color:var(--text); }
        .vcard { background:var(--card); border-radius:16px; padding:20px; box-shadow:0 2px 12px rgba(0,0,0,0.06); border:1px solid var(--border); }
        .vbtn { padding:10px 20px; border-radius:10px; border:none; cursor:pointer; font-weight:600; font-size:14px; transition:all 0.2s; }
        .vbtn-primary { background:var(--accent); color:#fff; }
        .vbtn-primary:hover { opacity:0.88; }
        .vbtn-ghost { background:transparent; color:var(--text2); border:1px solid var(--border); }
        .vbtn-ghost:hover { background:var(--border); }
        .vinput { width:100%; padding:10px 14px; border-radius:10px; border:1px solid var(--border); background:var(--bg); color:var(--text); font-size:14px; outline:none; transition:border 0.2s; }
        .vinput:focus { border-color:var(--accent); }
        .vlabel { font-size:13px; color:var(--text2); margin-bottom:4px; display:block; }
        .tab-bar { display:flex; gap:4px; padding:8px 16px; background:var(--card); border-bottom:1px solid var(--border); overflow-x:auto; position:sticky; top:0; z-index:100; }
        .tab-btn { padding:8px 16px; border-radius:8px; border:none; cursor:pointer; font-size:13px; font-weight:500; background:transparent; color:var(--text2); white-space:nowrap; transition:all 0.2s; }
        .tab-btn.active { background:var(--accent); color:#fff; }
        .tab-btn:hover:not(.active) { background:var(--border); }
        .header { display:flex; align-items:center; justify-content:space-between; padding:16px 20px; background:var(--card); border-bottom:1px solid var(--border); position:sticky; top:0; z-index:200; }
        .notification { position:fixed; top:20px; right:20px; z-index:2000; padding:12px 20px; border-radius:12px; font-weight:600; font-size:14px; box-shadow:0 4px 20px rgba(0,0,0,0.15); animation:fadeIn 0.3s; }
        @keyframes fadeIn { from{opacity:0;transform:translateY(-10px)} to{opacity:1;transform:translateY(0)} }
        .grid2 { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
        .grid3 { display:grid; grid-template-columns:1fr 1fr 1fr; gap:16px; }
        @media(max-width:600px) { .grid2,.grid3 { grid-template-columns:1fr; } }
        .stat-num { font-size:28px; font-weight:700; margin:4px 0; }
        .section-title { font-size:16px; font-weight:700; margin-bottom:12px; }
        .expense-row { display:flex; align-items:center; gap:12px; padding:10px 0; border-bottom:1px solid var(--border); }
        .expense-row:last-child { border-bottom:none; }
      `}</style>

      {notification && (
        <div className="notification" style={{ background: notification.type === "error" ? "#ef4444" : "#22c55e", color: "#fff" }}>
          {notification.msg}
        </div>
      )}

      <div className="header">
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:36, height:36, borderRadius:10, background:"linear-gradient(135deg,#6366f1,#8b5cf6)", display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontWeight:800, fontSize:18 }}>V</div>
          <div>
            <div style={{ fontWeight:800, fontSize:18, letterSpacing:-0.5 }}>Vatsu</div>
            <div style={{ fontSize:11, color:"var(--text2)" }}>Personal Finance</div>
          </div>
        </div>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          <select className="vinput" style={{ width:"auto", padding:"6px 10px" }} value={activeMonth} onChange={e => setActiveMonth(Number(e.target.value))}>
            {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
          </select>
          <select className="vinput" style={{ width:"auto", padding:"6px 10px" }} value={activeYear} onChange={e => setActiveYear(Number(e.target.value))}>
            {[2023,2024,2025,2026].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button className="vbtn vbtn-ghost" style={{ padding:"6px 12px", fontSize:18 }} onClick={() => setTheme(t => t === "light" ? "dark" : "light")}>
            {theme === "light" ? "🌙" : "☀️"}
          </button>
        </div>
      </div>

      <div className="tab-bar">
        {[["dashboard","📊 Dashboard"],["insights","💡 Insights"],["history","📋 History"],["goals","🎯 Goals"],["loans","🏦 Loans"],["challenges","🏆 Challenges"],["invest","📈 Invest"],["ai","🤖 AI Advisor"]].map(([k,l]) => (
          <button key={k} className={`tab-btn ${tab===k?"active":""}`} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      <div style={{ padding:20, maxWidth:900, margin:"0 auto" }}>
        {tab === "dashboard" && (
          <DashTab
            income={income} totalSpent={totalSpent} balance={balance} savingsRate={savingsRate}
            monthExpenses={monthExpenses} catTotals={catTotals} allCats={allCats}
            onAddExpense={() => setShowAdd(true)}
            onEditExpense={e => { setEditExpense(e); setShowAdd(true); }}
            onDeleteExpense={deleteExpense}
            onSetIncome={() => setShowIncome(true)}
            onApplyRecurring={applyRecurring}
            onAddRecurring={() => setShowRecurring(true)}
            onCustomCat={() => setShowCustomCat(true)}
            activeMonth={activeMonth} activeYear={activeYear}
          />
        )}
        {tab === "insights" && <InsightsTab expenses={expenses} income={income} activeMonth={activeMonth} activeYear={activeYear} allCats={allCats} />}
        {tab === "history" && <HistoryTab expenses={expenses} allCats={allCats} onDelete={deleteExpense} onEdit={e => { setEditExpense(e); setShowAdd(true); }} />}
        {tab === "goals" && <GoalsTab goals={goals} setGoals={setGoals} notify={notify} />}
        {tab === "loans" && <LoansTab loans={loans} setLoans={setLoans} notify={notify} />}
        {tab === "challenges" && <ChallengesTab challenges={challenges} setChallenges={setChallenges} notify={notify} />}
        {tab === "invest" && <InvestTab income={income} totalSpent={totalSpent} expenses={expenses} />}
        {tab === "ai" && <AITab income={income} expenses={expenses} goals={goals} loans={loans} activeMonth={activeMonth} activeYear={activeYear} />}
      </div>

      <Modal open={showAdd} onClose={() => { setShowAdd(false); setEditExpense(null); }} title={editExpense ? "Edit Expense" : "Add Expense"}>
        <AddExpenseForm allCats={allCats} onSubmit={addExpense} initial={editExpense} activeMonth={activeMonth} activeYear={activeYear} />
      </Modal>
      <Modal open={showIncome} onClose={() => setShowIncome(false)} title="Set Monthly Income">
        <IncomeForm income={income} onSubmit={v => { setIncome(v); setShowIncome(false); notify("Income updated!"); }} />
      </Modal>
      <Modal open={showGoal} onClose={() => setShowGoal(false)} title="Add Goal">
        <GoalForm onSubmit={g => { setGoals([...goals, { id: Date.now(), ...g, saved: 0 }]); setShowGoal(false); notify("Goal added!"); }} />
      </Modal>
      <Modal open={showLoan} onClose={() => setShowLoan(false)} title="Add Loan">
        <LoanForm onSubmit={l => { setLoans([...loans, { id: Date.now(), ...l, paid: 0 }]); setShowLoan(false); notify("Loan added!"); }} />
      </Modal>
      <Modal open={showChallenge} onClose={() => setShowChallenge(false)} title="Add Challenge">
        <ChallengeForm onSubmit={c => { setChallenges([...challenges, { id: Date.now(), ...c, progress: 0 }]); setShowChallenge(false); notify("Challenge added!"); }} />
      </Modal>
      <Modal open={showRecurring} onClose={() => setShowRecurring(false)} title="Manage Recurring">
        <RecurringForm recurringList={recurringList} setRecurringList={setRecurringList} allCats={allCats} />
      </Modal>
      <Modal open={showCustomCat} onClose={() => setShowCustomCat(false)} title="Custom Categories">
        <CustomCatForm customCats={customCats} setCustomCats={setCustomCats} />
      </Modal>
    </div>
  );
}

function DashTab({ income, totalSpent, balance, savingsRate, monthExpenses, catTotals, allCats, onAddExpense, onEditExpense, onDeleteExpense, onSetIncome, onApplyRecurring, onAddRecurring, onCustomCat, activeMonth, activeYear }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
      <div style={{ display:"flex", gap:12, flexWrap:"wrap", justifyContent:"space-between", alignItems:"center" }}>
        <div>
          <div style={{ fontWeight:700, fontSize:22 }}>Dashboard</div>
          <div style={{ color:"var(--text2)", fontSize:14 }}>{MONTHS[activeMonth]} {activeYear}</div>
        </div>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          <button className="vbtn vbtn-ghost" style={{ fontSize:13, padding:"8px 12px" }} onClick={onCustomCat}>⚙️ Categories</button>
          <button className="vbtn vbtn-ghost" style={{ fontSize:13, padding:"8px 12px" }} onClick={onAddRecurring}>🔁 Recurring</button>
          <button className="vbtn vbtn-ghost" style={{ fontSize:13, padding:"8px 12px" }} onClick={onApplyRecurring}>⚡ Apply Recurring</button>
          <button className="vbtn vbtn-ghost" style={{ fontSize:13, padding:"8px 12px" }} onClick={onSetIncome}>💰 Set Income</button>
          <button className="vbtn vbtn-primary" onClick={onAddExpense}>+ Add Expense</button>
        </div>
      </div>

      <div className="grid3">
        <div className="vcard" style={{ borderLeft:"4px solid #6366f1" }}>
          <div style={{ color:"var(--text2)", fontSize:13 }}>Monthly Income</div>
          <div className="stat-num" style={{ color:"#6366f1" }}>{fmtINR(income)}</div>
        </div>
        <div className="vcard" style={{ borderLeft:"4px solid #f43f5e" }}>
          <div style={{ color:"var(--text2)", fontSize:13 }}>Total Spent</div>
          <div className="stat-num" style={{ color:"#f43f5e" }}>{fmtINR(totalSpent)}</div>
        </div>
        <div className="vcard" style={{ borderLeft:`4px solid ${balance >= 0 ? "#22c55e" : "#f43f5e"}`}}>
          <div style={{ color:"var(--text2)", fontSize:13 }}>Balance</div>
          <div className="stat-num" style={{ color: balance >= 0 ? "#22c55e" : "#f43f5e" }}>{fmtINR(balance)}</div>
          <div style={{ fontSize:12, color:"var(--text2)" }}>Savings: {savingsRate}%</div>
        </div>
      </div>

      <div className="grid2">
        <div className="vcard">
          <div className="section-title">Budget Usage</div>
          <ProgressBar pct={income > 0 ? (totalSpent / income) * 100 : 0} color={totalSpent > income ? "#ef4444" : "#6366f1"} height={12} />
          <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:"var(--text2)", marginTop:6 }}>
            <span>Spent: {fmtINR(totalSpent)}</span>
            <span>Budget: {fmtINR(income)}</span>
          </div>
        </div>
        <div className="vcard">
          <div className="section-title">Spending Breakdown</div>
          <div style={{ display:"flex", alignItems:"center", gap:16 }}>
            <Donut segments={catTotals.map(c => ({ value: c.total, color: c.color }))} />
            <div style={{ flex:1, display:"flex", flexDirection:"column", gap:6 }}>
              {catTotals.slice(0,5).map((c,i) => (
                <div key={i} style={{ display:"flex", alignItems:"center", gap:6, fontSize:12 }}>
                  <div style={{ width:10, height:10, borderRadius:99, background:c.color, flexShrink:0 }}/>
                  <span style={{ flex:1, color:"var(--text2)" }}>{c.cat}</span>
                  <span style={{ fontWeight:600 }}>{fmtINR(c.total)}</span>
                </div>
              ))}
              {catTotals.length === 0 && <div style={{ color:"var(--text2)", fontSize:13 }}>No expenses yet</div>}
            </div>
          </div>
        </div>
      </div>

      <div className="vcard">
        <div className="section-title">Recent Expenses</div>
        {monthExpenses.length === 0 && <div style={{ color:"var(--text2)", textAlign:"center", padding:"20px 0" }}>No expenses this month</div>}
        {monthExpenses.slice(0,10).map(e => (
          <div key={e.id} className="expense-row">
            <div style={{ width:36, height:36, borderRadius:10, background: COLORS[allCats.indexOf(e.category) % COLORS.length] + "22", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 }}>
              {getCatIcon(e.category)}
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontWeight:600, fontSize:14 }}>{e.desc}</div>
              <div style={{ fontSize:12, color:"var(--text2)" }}>{e.category} • {e.date}</div>
            </div>
            <div style={{ fontWeight:700, color:"#f43f5e" }}>{fmtINR(e.amount)}</div>
            <button onClick={() => onEditExpense(e)} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--text2)", fontSize:16, padding:"4px 6px" }}>✏️</button>
            <button onClick={() => onDeleteExpense(e.id)} style={{ background:"none", border:"none", cursor:"pointer", color:"#ef4444", fontSize:16, padding:"4px 6px" }}>🗑️</button>
          </div>
        ))}
      </div>

      <div className="vcard">
        <div className="section-title">Category Breakdown</div>
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {catTotals.map((c, i) => (
            <div key={i}>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, marginBottom:4 }}>
                <span>{c.cat}</span>
                <span style={{ fontWeight:600 }}>{fmtINR(c.total)}</span>
              </div>
              <ProgressBar pct={income > 0 ? (c.total / income) * 100 : 0} color={c.color} />
            </div>
          ))}
          {catTotals.length === 0 && <div style={{ color:"var(--text2)" }}>No data yet.</div>}
        </div>
      </div>
    </div>
  );
}

function getCatIcon(cat) {
  const icons = { Food:"🍔", Transport:"🚗", Shopping:"🛍️", Health:"💊", Entertainment:"🎮", Bills:"📄", Education:"📚", Others:"📦" };
  return icons[cat] || "💸";
}

function AddExpenseForm({ allCats, onSubmit, initial, activeMonth, activeYear }) {
  const today = `${activeYear}-${String(Number(activeMonth)+1).padStart(2,"0")}-${String(new Date().getDate()).padStart(2,"0")}`;
  const [form, setForm] = useState({ desc: initial?.desc||"", amount: initial?.amount||"", category: initial?.category||allCats[0], date: initial?.date||today, note: initial?.note||"" });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  function handleSubmit(e) {
    e.preventDefault();
    if (!form.desc || !form.amount || !form.date) return;
    onSubmit({ ...form, amount: Number(form.amount) });
  }
  return (
    <form onSubmit={handleSubmit} style={{ display:"flex", flexDirection:"column", gap:12 }}>
      <div><label className="vlabel">Description *</label><input className="vinput" value={form.desc} onChange={e=>set("desc",e.target.value)} placeholder="e.g. Groceries" required/></div>
      <div><label className="vlabel">Amount (₹) *</label><input className="vinput" type="number" value={form.amount} onChange={e=>set("amount",e.target.value)} placeholder="0" required min="1"/></div>
      <div><label className="vlabel">Category</label>
        <select className="vinput" value={form.category} onChange={e=>set("category",e.target.value)}>
          {allCats.map(c=><option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div><label className="vlabel">Date *</label><input className="vinput" type="date" value={form.date} onChange={e=>set("date",e.target.value)} required/></div>
      <div><label className="vlabel">Note</label><input className="vinput" value={form.note} onChange={e=>set("note",e.target.value)} placeholder="Optional"/></div>
      <button type="submit" className="vbtn vbtn-primary" style={{ marginTop:4 }}>{initial ? "Update" : "Add Expense"}</button>
    </form>
  );
}

function IncomeForm({ income, onSubmit }) {
  const [val, setVal] = useState(income);
  return (
    <form onSubmit={e=>{e.preventDefault();onSubmit(Number(val));}} style={{ display:"flex", flexDirection:"column", gap:12 }}>
      <div><label className="vlabel">Monthly Income (₹)</label><input className="vinput" type="number" value={val} onChange={e=>setVal(e.target.value)} min="0"/></div>
      <button type="submit" className="vbtn vbtn-primary">Save</button>
    </form>
  );
}

function GoalForm({ onSubmit }) {
  const [form, setForm] = useState({ name:"", target:"", deadline:"", category:"Savings" });
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  return (
    <form onSubmit={e=>{e.preventDefault();if(!form.name||!form.target)return;onSubmit({...form,target:Number(form.target)});}} style={{display:"flex",flexDirection:"column",gap:12}}>
      <div><label className="vlabel">Goal Name *</label><input className="vinput" value={form.name} onChange={e=>set("name",e.target.value)} placeholder="e.g. Emergency Fund" required/></div>
      <div><label className="vlabel">Target Amount (₹) *</label><input className="vinput" type="number" value={form.target} onChange={e=>set("target",e.target.value)} min="1" required/></div>
      <div><label className="vlabel">Deadline</label><input className="vinput" type="date" value={form.deadline} onChange={e=>set("deadline",e.target.value)}/></div>
      <button type="submit" className="vbtn vbtn-primary">Add Goal</button>
    </form>
  );
}

function LoanForm({ onSubmit }) {
  const [form, setForm] = useState({ name:"", principal:"", rate:"", tenureMonths:"", emi:"" });
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  function calcEMI() {
    const p=Number(form.principal), r=Number(form.rate)/12/100, n=Number(form.tenureMonths);
    if(!p||!r||!n) return;
    const emi = (p*r*Math.pow(1+r,n))/(Math.pow(1+r,n)-1);
    set("emi", Math.round(emi));
  }
  return (
    <form onSubmit={e=>{e.preventDefault();if(!form.name||!form.principal)return;onSubmit({...form,principal:Number(form.principal),rate:Number(form.rate),tenureMonths:Number(form.tenureMonths),emi:Number(form.emi)});}} style={{display:"flex",flexDirection:"column",gap:12}}>
      <div><label className="vlabel">Loan Name *</label><input className="vinput" value={form.name} onChange={e=>set("name",e.target.value)} placeholder="e.g. Home Loan" required/></div>
      <div><label className="vlabel">Principal (₹) *</label><input className="vinput" type="number" value={form.principal} onChange={e=>set("principal",e.target.value)} min="1" required/></div>
      <div><label className="vlabel">Interest Rate (%/year)</label><input className="vinput" type="number" value={form.rate} onChange={e=>set("rate",e.target.value)} step="0.01"/></div>
      <div><label className="vlabel">Tenure (months)</label><input className="vinput" type="number" value={form.tenureMonths} onChange={e=>set("tenureMonths",e.target.value)} min="1"/></div>
      <div style={{display:"flex",gap:8,alignItems:"flex-end"}}>
        <div style={{flex:1}}><label className="vlabel">EMI (₹)</label><input className="vinput" type="number" value={form.emi} onChange={e=>set("emi",e.target.value)}/></div>
        <button type="button" className="vbtn vbtn-ghost" onClick={calcEMI}>Calc EMI</button>
      </div>
      <button type="submit" className="vbtn vbtn-primary">Add Loan</button>
    </form>
  );
}

function ChallengeForm({ onSubmit }) {
  const [form, setForm] = useState({ name:"", target:"", type:"savings", duration:"30" });
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  return (
    <form onSubmit={e=>{e.preventDefault();if(!form.name||!form.target)return;onSubmit({...form,target:Number(form.target),duration:Number(form.duration)});}} style={{display:"flex",flexDirection:"column",gap:12}}>
      <div><label className="vlabel">Challenge Name *</label><input className="vinput" value={form.name} onChange={e=>set("name",e.target.value)} placeholder="e.g. No eating out for 30 days" required/></div>
      <div><label className="vlabel">Target (₹ or days) *</label><input className="vinput" type="number" value={form.target} onChange={e=>set("target",e.target.value)} min="1" required/></div>
      <div><label className="vlabel">Type</label>
        <select className="vinput" value={form.type} onChange={e=>set("type",e.target.value)}>
          <option value="savings">Savings Challenge</option>
          <option value="spending">Spending Limit</option>
          <option value="streak">Streak Challenge</option>
        </select>
      </div>
      <div><label className="vlabel">Duration (days)</label><input className="vinput" type="number" value={form.duration} onChange={e=>set("duration",e.target.value)} min="1"/></div>
      <button type="submit" className="vbtn vbtn-primary">Add Challenge</button>
    </form>
  );
}

function RecurringForm({ recurringList, setRecurringList, allCats }) {
  const [form, setForm] = useState({ desc:"", amount:"", category: allCats[0] });
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  function add(e) {
    e.preventDefault();
    if (!form.desc||!form.amount) return;
    setRecurringList([...recurringList, { id:Date.now(), ...form, amount:Number(form.amount) }]);
    setForm({ desc:"", amount:"", category: allCats[0] });
  }
  return (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <form onSubmit={add} style={{display:"flex",flexDirection:"column",gap:10}}>
        <div><label className="vlabel">Description *</label><input className="vinput" value={form.desc} onChange={e=>set("desc",e.target.value)} placeholder="e.g. Netflix"/></div>
        <div><label className="vlabel">Amount (₹) *</label><input className="vinput" type="number" value={form.amount} onChange={e=>set("amount",e.target.value)} min="1"/></div>
        <div><label className="vlabel">Category</label>
          <select className="vinput" value={form.category} onChange={e=>set("category",e.target.value)}>
            {allCats.map(c=><option key={c}>{c}</option>)}
          </select>
        </div>
        <button type="submit" className="vbtn vbtn-primary">Add Recurring</button>
      </form>
      <div>
        {recurringList.map(r=>(
          <div key={r.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:"1px solid var(--border)"}}>
            <span>{r.desc} — {fmtINR(r.amount)} ({r.category})</span>
            <button onClick={()=>setRecurringList(recurringList.filter(x=>x.id!==r.id))} style={{background:"none",border:"none",color:"#ef4444",cursor:"pointer",fontSize:16}}>🗑️</button>
          </div>
        ))}
        {recurringList.length===0 && <div style={{color:"var(--text2)"}}>No recurring expenses added.</div>}
      </div>
    </div>
  );
}

function CustomCatForm({ customCats, setCustomCats }) {
  const [val, setVal] = useState("");
  return (
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <form onSubmit={e=>{e.preventDefault();if(!val.trim())return;setCustomCats([...customCats,val.trim()]);setVal("");}} style={{display:"flex",gap:8}}>
        <input className="vinput" value={val} onChange={e=>setVal(e.target.value)} placeholder="New category name"/>
        <button type="submit" className="vbtn vbtn-primary">Add</button>
      </form>
      <div>
        {customCats.map((c,i)=>(
          <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 0",borderBottom:"1px solid var(--border)"}}>
            <span>{c}</span>
            <button onClick={()=>setCustomCats(customCats.filter((_,j)=>j!==i))} style={{background:"none",border:"none",color:"#ef4444",cursor:"pointer",fontSize:16}}>🗑️</button>
          </div>
        ))}
        {customCats.length===0 && <div style={{color:"var(--text2)"}}>No custom categories.</div>}
      </div>
    </div>
  );
}

function InsightsTab({ expenses, income, activeMonth, activeYear, allCats }) {
  const months = Array.from({length:6}, (_,i)=>{
    const d = new Date(activeYear, activeMonth - i, 1);
    return { label: MONTHS[d.getMonth()] + " " + d.getFullYear(), mk: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}` };
  }).reverse();

  const monthData = months.map(m => ({
    label: m.label,
    spent: expenses.filter(e=>e.date&&e.date.startsWith(m.mk)).reduce((a,e)=>a+Number(e.amount),0)
  }));

  const maxSpent = Math.max(...monthData.map(m=>m.spent), 1);
  const currMonthMk = `${activeYear}-${String(Number(activeMonth)+1).padStart(2,"0")}`;
  const currMonthExp = expenses.filter(e=>e.date&&e.date.startsWith(currMonthMk));
  const totalSpent = currMonthExp.reduce((a,e)=>a+Number(e.amount),0);

  const catBreakdown = allCats.map((cat,i)=>({
    cat, color:COLORS[i%COLORS.length],
    total: currMonthExp.filter(e=>e.category===cat).reduce((a,e)=>a+Number(e.amount),0)
  })).filter(c=>c.total>0).sort((a,b)=>b.total-a.total);

  const savingsRate = income > 0 ? Math.max(0, ((income - totalSpent) / income) * 100) : 0;
  const healthScore = Math.min(100, Math.round(savingsRate * 1.2 + (totalSpent < income ? 20 : 0)));

  const circumference = 2 * Math.PI * 44;
  const strokeDash = (healthScore / 100) * circumference;

  return (
    <div style={{display:"flex",flexDirection:"column",gap:20}}>
      <div style={{fontWeight:700,fontSize:22}}>Insights</div>

      <div className="grid2">
        <div className="vcard">
          <div className="section-title">Financial Health Score</div>
          <div style={{display:"flex",alignItems:"center",gap:20}}>
            <svg width={100} height={100} style={{transform:"rotate(-90deg)"}}>
              <circle cx={50} cy={50} r={44} fill="none" stroke="#e5e7eb" strokeWidth={10}/>
              <circle cx={50} cy={50} r={44} fill="none" stroke={healthScore>70?"#22c55e":healthScore>40?"#eab308":"#ef4444"} strokeWidth={10}
                strokeDasharray={`${strokeDash} ${circumference}`} strokeLinecap="round"/>
            </svg>
            <div>
              <div style={{fontSize:36,fontWeight:800}}>{healthScore}</div>
              <div style={{color:"var(--text2)",fontSize:13}}>{healthScore>70?"Excellent":healthScore>40?"Good":"Needs Attention"}</div>
            </div>
          </div>
        </div>
        <div className="vcard">
          <div className="section-title">Key Metrics</div>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            <div style={{display:"flex",justifyContent:"space-between"}}><span style={{color:"var(--text2)"}}>Savings Rate</span><b>{savingsRate.toFixed(1)}%</b></div>
            <div style={{display:"flex",justifyContent:"space-between"}}><span style={{color:"var(--text2)"}}>Total Spent</span><b>{fmtINR(totalSpent)}</b></div>
            <div style={{display:"flex",justifyContent:"space-between"}}><span style={{color:"var(--text2)"}}>Monthly Income</span><b>{fmtINR(income)}</b></div>
            <div style={{display:"flex",justifyContent:"space-between"}}><span style={{color:"var(--text2)"}}>Remaining</span><b style={{color:income-totalSpent>=0?"#22c55e":"#ef4444"}}>{fmtINR(income-totalSpent)}</b></div>
          </div>
        </div>
      </div>

      <div className="vcard">
        <div className="section-title">6-Month Spending Trend</div>
        <div style={{display:"flex",alignItems:"flex-end",gap:8,height:120,paddingBottom:4}}>
          {monthData.map((m,i)=>(
            <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
              <div style={{fontSize:11,color:"var(--text2)",fontWeight:600}}>{fmtINR(m.spent)}</div>
              <div style={{width:"100%",borderRadius:"6px 6px 0 0",background:"#6366f1",height:`${(m.spent/maxSpent)*80}px`,minHeight:4,transition:"height 0.4s"}}/>
              <div style={{fontSize:10,color:"var(--text2)",textAlign:"center",lineHeight:1.2}}>{m.label.split(" ")[0]}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="vcard">
        <div className="section-title">Category Analysis</div>
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {catBreakdown.map((c,i)=>(
            <div key={i}>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:4}}>
                <span>{getCatIcon(c.cat)} {c.cat}</span>
                <span style={{fontWeight:600}}>{fmtINR(c.total)} ({income>0?((c.total/income)*100).toFixed(1):0}%)</span>
              </div>
              <ProgressBar pct={income>0?(c.total/income)*100:0} color={c.color}/>
            </div>
          ))}
          {catBreakdown.length===0 && <div style={{color:"var(--text2)"}}>No expense data for this month.</div>}
        </div>
      </div>

      <div className="vcard">
        <div className="section-title">Smart Tips</div>
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {totalSpent > income && <div style={{padding:"10px 14px",background:"#ef444422",borderRadius:10,color:"#ef4444",fontSize:13}}>⚠️ You've exceeded your monthly budget! Review your spending.</div>}
          {savingsRate < 20 && totalSpent <= income && <div style={{padding:"10px 14px",background:"#eab30822",borderRadius:10,color:"#d97706",fontSize:13}}>💡 Savings rate is below 20%. Try to reduce discretionary spending.</div>}
          {savingsRate >= 20 && <div style={{padding:"10px 14px",background:"#22c55e22",borderRadius:10,color:"#16a34a",fontSize:13}}>✅ Great job! You're saving {savingsRate.toFixed(1)}% of your income.</div>}
          {catBreakdown[0] && catBreakdown[0].total > income * 0.3 && <div style={{padding:"10px 14px",background:"#6366f122",borderRadius:10,color:"#4f46e5",fontSize:13}}>📊 {catBreakdown[0].cat} accounts for over 30% of your income. Consider if this is sustainable.</div>}
        </div>
      </div>
    </div>
  );
}

function HistoryTab({ expenses, allCats, onDelete, onEdit }) {
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("All");
  const [sortBy, setSortBy] = useState("date");

  const filtered = expenses
    .filter(e => filterCat === "All" || e.category === filterCat)
    .filter(e => !search || e.desc?.toLowerCase().includes(search.toLowerCase()) || e.category?.toLowerCase().includes(search.toLowerCase()))
    .sort((a,b) => {
      if (sortBy === "date") return new Date(b.date) - new Date(a.date);
      if (sortBy === "amount") return Number(b.amount) - Number(a.amount);
      return 0;
    });

  const total = filtered.reduce((a,e) => a + Number(e.amount), 0);

  return (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <div style={{fontWeight:700,fontSize:22}}>Transaction History</div>
      <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
        <input className="vinput" style={{flex:1,minWidth:180}} value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Search expenses..."/>
        <select className="vinput" style={{width:"auto"}} value={filterCat} onChange={e=>setFilterCat(e.target.value)}>
          <option value="All">All Categories</option>
          {allCats.map(c=><option key={c} value={c}>{c}</option>)}
        </select>
        <select className="vinput" style={{width:"auto"}} value={sortBy} onChange={e=>setSortBy(e.target.value)}>
          <option value="date">Sort: Date</option>
          <option value="amount">Sort: Amount</option>
        </select>
      </div>
      <div style={{display:"flex",justifyContent:"space-between",color:"var(--text2)",fontSize:13}}>
        <span>{filtered.length} transactions</span>
        <span>Total: <b style={{color:"var(--text)"}}>{fmtINR(total)}</b></span>
      </div>
      <div className="vcard">
        {filtered.length === 0 && <div style={{color:"var(--text2)",textAlign:"center",padding:"20px 0"}}>No transactions found.</div>}
        {filtered.map(e=>(
          <div key={e.id} className="expense-row">
            <div style={{width:36,height:36,borderRadius:10,background:COLORS[allCats.indexOf(e.category)%COLORS.length]+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>
              {getCatIcon(e.category)}
            </div>
            <div style={{flex:1}}>
              <div style={{fontWeight:600,fontSize:14}}>{e.desc}</div>
              <div style={{fontSize:12,color:"var(--text2)"}}>{e.category} • {e.date} {e.note && <span>• {e.note}</span>}</div>
            </div>
            <div style={{fontWeight:700,color:"#f43f5e"}}>{fmtINR(e.amount)}</div>
            <button onClick={()=>onEdit(e)} style={{background:"none",border:"none",cursor:"pointer",color:"var(--text2)",fontSize:16,padding:"4px 6px"}}>✏️</button>
            <button onClick={()=>onDelete(e.id)} style={{background:"none",border:"none",cursor:"pointer",color:"#ef4444",fontSize:16,padding:"4px 6px"}}>🗑️</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function GoalsTab({ goals, setGoals, notify }) {
  const [showForm, setShowForm] = useState(false);
  function addGoal(g) { setGoals([...goals, { id:Date.now(), ...g, saved:0 }]); setShowForm(false); notify("Goal added!"); }
  function deleteGoal(id) { setGoals(goals.filter(g=>g.id!==id)); notify("Goal deleted!", "error"); }
  function addSaving(id, amt) {
    setGoals(goals.map(g => g.id===id ? { ...g, saved: Math.min(g.target, (g.saved||0) + Number(amt)) } : g));
    notify("Savings added!");
  }

  return (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{fontWeight:700,fontSize:22}}>Financial Goals</div>
        <button className="vbtn vbtn-primary" onClick={()=>setShowForm(true)}>+ Add Goal</button>
      </div>
      {goals.length === 0 && <div className="vcard" style={{textAlign:"center",color:"var(--text2)",padding:40}}>No goals yet. Start by adding a financial goal!</div>}
      {goals.map(g=>{
        const pct = g.target > 0 ? (g.saved/g.target)*100 : 0;
        return (
          <div key={g.id} className="vcard">
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
              <div>
                <div style={{fontWeight:700,fontSize:16}}>🎯 {g.name}</div>
                {g.deadline && <div style={{fontSize:12,color:"var(--text2)"}}>Target: {g.deadline}</div>}
              </div>
              <button onClick={()=>deleteGoal(g.id)} style={{background:"none",border:"none",cursor:"pointer",color:"#ef4444",fontSize:16}}>🗑️</button>
            </div>
            <div style={{marginBottom:8}}>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:4}}>
                <span>{fmtINR(g.saved)} saved</span>
                <span>{fmtINR(g.target)} goal ({pct.toFixed(1)}%)</span>
              </div>
              <ProgressBar pct={pct} color={pct>=100?"#22c55e":"#6366f1"}/>
            </div>
            {pct < 100 && (
              <AddToGoal onAdd={amt => addSaving(g.id, amt)} />
            )}
            {pct >= 100 && <div style={{color:"#22c55e",fontWeight:600,fontSize:14}}>🎉 Goal Achieved!</div>}
          </div>
        );
      })}
      <Modal open={showForm} onClose={()=>setShowForm(false)} title="Add Goal">
        <GoalForm onSubmit={addGoal}/>
      </Modal>
    </div>
  );
}

function AddToGoal({ onAdd }) {
  const [val, setVal] = useState("");
  return (
    <form onSubmit={e=>{e.preventDefault();if(!val)return;onAdd(val);setVal("");}} style={{display:"flex",gap:8,marginTop:8}}>
      <input className="vinput" type="number" value={val} onChange={e=>setVal(e.target.value)} placeholder="Add savings (₹)" min="1" style={{flex:1}}/>
      <button type="submit" className="vbtn vbtn-primary" style={{padding:"8px 14px"}}>Add</button>
    </form>
  );
}

function LoansTab({ loans, setLoans, notify }) {
  const [showForm, setShowForm] = useState(false);
  function addLoan(l) { setLoans([...loans, { id:Date.now(), ...l, paid:0 }]); setShowForm(false); notify("Loan added!"); }
  function deleteLoan(id) { setLoans(loans.filter(l=>l.id!==id)); notify("Loan deleted!", "error"); }
  function payEMI(id) {
    setLoans(loans.map(l => {
      if (l.id !== id) return l;
      const newPaid = Math.min(l.principal, (l.paid||0) + (l.emi||0));
      return { ...l, paid: newPaid };
    }));
    notify("EMI recorded!");
  }

  return (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{fontWeight:700,fontSize:22}}>Loan Tracker</div>
        <button className="vbtn vbtn-primary" onClick={()=>setShowForm(true)}>+ Add Loan</button>
      </div>
      {loans.length === 0 && <div className="vcard" style={{textAlign:"center",color:"var(--text2)",padding:40}}>No loans added yet.</div>}
      {loans.map(l=>{
        const pct = l.principal > 0 ? ((l.paid||0)/l.principal)*100 : 0;
        const remaining = l.principal - (l.paid||0);
        return (
          <div key={l.id} className="vcard">
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
              <div>
                <div style={{fontWeight:700,fontSize:16}}>🏦 {l.name}</div>
                <div style={{fontSize:12,color:"var(--text2)"}}>Rate: {l.rate}% | Tenure: {l.tenureMonths} months | EMI: {fmtINR(l.emi)}</div>
              </div>
              <button onClick={()=>deleteLoan(l.id)} style={{background:"none",border:"none",cursor:"pointer",color:"#ef4444",fontSize:16}}>🗑️</button>
            </div>
            <div style={{marginBottom:10}}>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:4}}>
                <span>Paid: {fmtINR(l.paid||0)}</span>
                <span>Remaining: {fmtINR(remaining)}</span>
              </div>
              <ProgressBar pct={pct} color={pct>=100?"#22c55e":"#f43f5e"}/>
            </div>
            {pct < 100 && (
              <button className="vbtn vbtn-primary" style={{fontSize:13,padding:"8px 14px"}} onClick={()=>payEMI(l.id)}>
                ✓ Record EMI Payment ({fmtINR(l.emi)})
              </button>
            )}
            {pct >= 100 && <div style={{color:"#22c55e",fontWeight:600,fontSize:14}}>🎉 Loan Fully Paid!</div>}
          </div>
        );
      })}
      <Modal open={showForm} onClose={()=>setShowForm(false)} title="Add Loan">
        <LoanForm onSubmit={addLoan}/>
      </Modal>
    </div>
  );
}

function ChallengesTab({ challenges, setChallenges, notify }) {
  const [showForm, setShowForm] = useState(false);
  function addChallenge(c) { setChallenges([...challenges, { id:Date.now(), ...c, progress:0 }]); setShowForm(false); notify("Challenge added!"); }
  function deleteChallenge(id) { setChallenges(challenges.filter(c=>c.id!==id)); notify("Challenge deleted!", "error"); }
  function updateProgress(id, val) {
    setChallenges(challenges.map(c => c.id===id ? { ...c, progress: Math.min(c.target, (c.progress||0) + Number(val)) } : c));
    notify("Progress updated!");
  }

  return (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{fontWeight:700,fontSize:22}}>Challenges</div>
        <button className="vbtn vbtn-primary" onClick={()=>setShowForm(true)}>+ Add Challenge</button>
      </div>
      {challenges.length === 0 && <div className="vcard" style={{textAlign:"center",color:"var(--text2)",padding:40}}>No challenges yet. Set a savings or spending challenge!</div>}
      {challenges.map(c=>{
        const pct = c.target > 0 ? ((c.progress||0)/c.target)*100 : 0;
        return (
          <div key={c.id} className="vcard">
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
              <div>
                <div style={{fontWeight:700,fontSize:16}}>🏆 {c.name}</div>
                <div style={{fontSize:12,color:"var(--text2)"}}>{c.type} • {c.duration} days</div>
              </div>
              <button onClick={()=>deleteChallenge(c.id)} style={{background:"none",border:"none",cursor:"pointer",color:"#ef4444",fontSize:16}}>🗑️</button>
            </div>
            <div style={{marginBottom:10}}>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:4}}>
                <span>Progress: {c.progress||0} / {c.target}</span>
                <span>{pct.toFixed(1)}%</span>
              </div>
              <ProgressBar pct={pct} color={pct>=100?"#22c55e":"#8b5cf6"}/>
            </div>
            {pct < 100 && (
              <UpdateProgress onUpdate={val => updateProgress(c.id, val)} label={c.type === "savings" ? "Add Savings (₹)" : "Update Progress"} />
            )}
            {pct >= 100 && <div style={{color:"#22c55e",fontWeight:600,fontSize:14}}>🎉 Challenge Complete!</div>}
          </div>
        );
      })}
      <Modal open={showForm} onClose={()=>setShowForm(false)} title="Add Challenge">
        <ChallengeForm onSubmit={addChallenge}/>
      </Modal>
    </div>
  );
}

function UpdateProgress({ onUpdate, label }) {
  const [val, setVal] = useState("");
  return (
    <form onSubmit={e=>{e.preventDefault();if(!val)return;onUpdate(val);setVal("");}} style={{display:"flex",gap:8,marginTop:8}}>
      <input className="vinput" type="number" value={val} onChange={e=>setVal(e.target.value)} placeholder={label} min="1" style={{flex:1}}/>
      <button type="submit" className="vbtn vbtn-primary" style={{padding:"8px 14px"}}>Update</button>
    </form>
  );
}

function InvestTab({ income, totalSpent, expenses }) {
  const [sugAmt, setSugAmt] = useState(Math.max(0, Math.round((income - totalSpent) * 0.5)));
  const [yr, setYr] = useState(10);
  const [rate, setRate] = useState(12);
  const sipVal = sipProjection(sugAmt, rate, yr);
  const invested = sugAmt * yr * 12;

  const instruments = [
    { name:"SIP (Mutual Fund)", color:"#6366f1", returns:12, risk:"Medium", description:"Systematic Investment Plan in diversified equity funds." },
    { name:"PPF", color:"#22c55e", returns:7.1, risk:"Low", description:"Public Provident Fund - Government backed, 15-year lock-in." },
    { name:"FD (Fixed Deposit)", color:"#3b82f6", returns:7, risk:"Very Low", description:"Bank Fixed Deposit - Safe, guaranteed returns." },
    { name:"NPS", color:"#8b5cf6", returns:10, risk:"Low-Medium", description:"National Pension System - Tax benefits + retirement corpus." },
    { name:"Gold ETF", color:"#eab308", returns:8, risk:"Medium", description:"Digital Gold - Hedge against inflation." },
    { name:"Direct Stocks", color:"#f43f5e", returns:15, risk:"High", description:"High risk, high reward. Requires research." }
  ];

  return (
    <div style={{display:"flex",flexDirection:"column",gap:20}}>
      <div style={{fontWeight:700,fontSize:22}}>Investment Planner</div>

      <div className="vcard">
        <div className="section-title">SIP Calculator</div>
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div><label className="vlabel">Monthly Investment (₹)</label><input className="vinput" type="number" value={sugAmt} onChange={e=>setSugAmt(Number(e.target.value))} min="500"/></div>
          <div><label className="vlabel">Duration (Years): {yr}</label><input type="range" min="1" max="30" value={yr} onChange={e=>setYr(Number(e.target.value))} style={{width:"100%"}}/></div>
          <div><label className="vlabel">Expected Annual Return: {rate}%</label><input type="range" min="4" max="20" value={rate} onChange={e=>setRate(Number(e.target.value))} style={{width:"100%"}}/></div>
          <div className="grid3">
            <div style={{textAlign:"center",padding:"12px 0",background:"var(--bg)",borderRadius:12}}>
              <div style={{color:"var(--text2)",fontSize:12}}>Invested</div>
              <div style={{fontWeight:700,fontSize:18,color:"#6366f1"}}>{fmtINR(invested)}</div>
            </div>
            <div style={{textAlign:"center",padding:"12px 0",background:"var(--bg)",borderRadius:12}}>
              <div style={{color:"var(--text2)",fontSize:12}}>Estimated Returns</div>
              <div style={{fontWeight:700,fontSize:18,color:"#22c55e"}}>{fmtINR(sipVal - invested)}</div>
            </div>
            <div style={{textAlign:"center",padding:"12px 0",background:"var(--bg)",borderRadius:12}}>
              <div style={{color:"var(--text2)",fontSize:12}}>Total Value</div>
              <div style={{fontWeight:700,fontSize:18,color:"#f97316"}}>{fmtINR(sipVal)}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="vcard">
        <div className="section-title">Investment Options</div>
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          {instruments.map((inst,i)=>{
            const proj = sipProjection(sugAmt, inst.returns, yr);
            return (
              <div key={i} style={{padding:"12px 16px",background:"var(--bg)",borderRadius:12,borderLeft:`4px solid ${inst.color}`}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                  <div style={{fontWeight:700}}>{inst.name}</div>
                  <div style={{display:"flex",gap:8}}>
                    <Badge label={inst.risk + " Risk"} color={inst.color}/>
                    <Badge label={inst.returns + "% p.a."} color="#22c55e"/>
                  </div>
                </div>
                <div style={{fontSize:13,color:"var(--text2)",marginBottom:6}}>{inst.description}</div>
                <div style={{fontSize:13,fontWeight:600}}>Projected in {yr}yr: <span style={{color:inst.color}}>{fmtINR(proj)}</span></div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="vcard">
        <div className="section-title">Readiness Score</div>
        <ReadinessScore income={income} totalSpent={totalSpent} />
      </div>
    </div>
  );
}

function ReadinessScore({ income, totalSpent }) {
  const monthlyFree = income - totalSpent;
  const canInvest = monthlyFree > 0;
  const rate = income > 0 ? Math.max(0, (monthlyFree / income) * 100) : 0;
  const score = Math.min(100, Math.round(rate * 1.5));
  const circumference = 2 * Math.PI * 42;
  const strokeDash = (score / 100) * circumference;

  return (
    <div style={{display:"flex",alignItems:"center",gap:20}}>
      <svg width={90} height={90} style={{transform:"rotate(-90deg)"}}>
        <circle cx={45} cy={45} r={42} fill="none" stroke="#e5e7eb" strokeWidth={8}/>
        <circle cx={45} cy={45} r={42} fill="none" stroke={score>60?"#22c55e":score>30?"#eab308":"#ef4444"} strokeWidth={8}
          strokeDasharray={`${strokeDash} ${circumference}`} strokeLinecap="round"/>
      </svg>
      <div>
        <div style={{fontSize:32,fontWeight:800}}>{score}%</div>
        <div style={{fontSize:13,color:"var(--text2)"}}>Investment Readiness</div>
        <div style={{fontSize:13,marginTop:4}}>{canInvest ? `You can invest up to ${fmtINR(monthlyFree)} monthly` : "No free cash this month"}</div>
      </div>
    </div>
  );
}

function AITab({ income, expenses, goals, loans, activeMonth, activeYear }) {
  const [query, setQuery] = useState("");
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);

  const mk = `${activeYear}-${String(Number(activeMonth)+1).padStart(2,"0")}`;
  const monthExpenses = expenses.filter(e=>e.date&&e.date.startsWith(mk));
  const totalSpent = monthExpenses.reduce((a,e)=>a+Number(e.amount),0);
  const balance = income - totalSpent;
  const savingsRate = income > 0 ? ((balance/income)*100).toFixed(1) : 0;

  const catTotals = CATEGORIES.map(cat => ({
    cat, total: monthExpenses.filter(e=>e.category===cat).reduce((a,e)=>a+Number(e.amount),0)
  })).filter(c=>c.total>0).sort((a,b)=>b.total-a.total);

  function generateResponse(q) {
    const ql = q.toLowerCase();
    const context = {
      income, totalSpent, balance, savingsRate,
      topCat: catTotals[0]?.cat || "N/A",
      topAmt: catTotals[0]?.total || 0,
      goalsCount: goals.length,
      loansCount: loans.length
    };

    if (ql.includes("save") || ql.includes("saving")) {
      if (context.savingsRate < 20) {
        return `Your savings rate is ${context.savingsRate}%. To improve it:\n\n1. Track your top spending category (${context.topCat}: ${fmtINR(context.topAmt)}) and set a budget cap.\n2. Apply the 50-30-20 rule: 50% needs, 30% wants, 20% savings.\n3. Automate savings by setting a standing instruction to transfer ${fmtINR(Math.round(income*0.2))} on payday.\n4. Cut subscriptions and eating-out costs — these add up quickly.`;
      }
      return `Great job! Your savings rate is ${context.savingsRate}%. You're saving ${fmtINR(balance)} this month. Consider investing the surplus in SIP mutual funds for long-term wealth creation.`;
    }

    if (ql.includes("invest") || ql.includes("sip") || ql.includes("mutual fund")) {
      return `Based on your financials (income: ${fmtINR(income)}, balance: ${fmtINR(balance)}):\n\n• **SIP in ELSS/Flexicap funds**: Start with ${fmtINR(Math.round(balance*0.5))} monthly — gives tax benefits + growth.\n• **PPF**: Invest ${fmtINR(Math.min(500, balance*0.2))} monthly for safe, tax-free returns at 7.1%.\n• **Emergency Fund**: Keep 3-6 months of expenses (${fmtINR(income*4)}) in a liquid fund first.\n• Consider NPS for retirement planning — extra ₹50k deduction under 80CCD(1B).`;
    }

    if (ql.includes("budget") || ql.includes("plan")) {
      return `Here's a budget plan for your ${fmtINR(income)} income:\n\n• **Needs (50%)**: ${fmtINR(income*0.5)} — rent, groceries, bills, transport\n• **Wants (30%)**: ${fmtINR(income*0.3)} — dining, entertainment, shopping\n• **Savings (20%)**: ${fmtINR(income*0.2)} — investments, emergency fund\n\nYou're currently spending ${fmtINR(totalSpent)} (${income>0?((totalSpent/income)*100).toFixed(0):0}% of income). ${totalSpent > income*0.8 ? "⚠️ Consider cutting spending to stay within budget." : "✅ You're within a healthy range!"}`;
    }

    if (ql.includes("loan") || ql.includes("debt") || ql.includes("emi")) {
      return `Loan management tips for your situation:\n\n1. **Avalanche method**: Pay extra EMI on the highest-interest loan first to save on interest.\n2. **Snowball method**: Clear the smallest loan first for psychological wins.\n3. Keep EMI-to-income ratio below 40% (ideal: 30%). Your current balance is ${fmtINR(balance)}.\n4. Avoid taking new loans when existing ones are active.\n5. Consider prepayment during bonus months — even small amounts reduce tenure significantly.`;
    }

    if (ql.includes("spend") || ql.includes("expense") || ql.includes("reduce")) {
      return `Your top spending this month is ${context.topCat} at ${fmtINR(context.topAmt)}. Tips to reduce spending:\n\n1. Set a weekly cash allowance for discretionary spending.\n2. Use the 24-hour rule: wait 24 hours before non-essential purchases.\n3. Meal-prep to reduce food expenses — cooking at home saves 60-70% vs eating out.\n4. Review all subscriptions — cancel unused ones.\n5. Use UPI cashback offers for regular purchases.`;
    }

    if (ql.includes("goal") || ql.includes("target")) {
      return `You have ${context.goalsCount} active goals. To achieve them faster:\n\n1. Automate monthly contributions to each goal.\n2. Use separate savings accounts or goal-based funds.\n3. Break big goals into milestones and celebrate small wins.\n4. Review goal progress monthly — adjust contributions if income changes.\n5. Invest goal funds in liquid or short-term mutual funds for better returns than FDs.`;
    }

    if (ql.includes("tax") || ql.includes("80c") || ql.includes("deduction")) {
      return `Tax saving opportunities (FY 2025-26):\n\n• **80C** (₹1.5L limit): ELSS, PPF, NSC, LIC, PF, tuition fees\n• **80D**: Medical insurance — up to ₹25k self, ₹50k parents\n• **80CCD(1B)**: Extra ₹50k via NPS — above 80C limit\n• **HRA**: If renting, claim HRA exemption (provide rent receipts)\n• **Home Loan**: Section 24 — up to ₹2L interest deduction\n\nWith income of ${fmtINR(income)}/month, maximize 80C first — it can save ₹15,000-45,000 in taxes.`;
    }

    return `Hi! I'm your AI Financial Advisor. Based on your data:\n\n• Income: ${fmtINR(income)}/month\n• Spent this month: ${fmtINR(totalSpent)}\n• Savings rate: ${savingsRate}%\n• Active goals: ${context.goalsCount}\n\nYou can ask me about:\n- How to save more money\n- Investment advice (SIP, mutual funds)\n- Budget planning\n- Loan & debt management\n- Tax saving tips\n- Reducing expenses`;
  }

  async function handleAsk() {
    if (!query.trim()) return;
    setLoading(true);
    await new Promise(r => setTimeout(r, 600));
    setResponse(generateResponse(query));
    setLoading(false);
  }

  const suggestions = ["How can I save more?", "Where should I invest?", "Create a budget plan", "How to reduce spending?", "Tax saving tips", "Loan management advice"];

  return (
    <div style={{display:"flex",flexDirection:"column",gap:20}}>
      <div style={{fontWeight:700,fontSize:22}}>🤖 AI Financial Advisor</div>

      <div className="vcard">
        <div className="section-title">Quick Financial Summary</div>
        <div className="grid2">
          {[
            {label:"Income",value:fmtINR(income),color:"#6366f1"},
            {label:"Spent",value:fmtINR(totalSpent),color:"#f43f5e"},
            {label:"Balance",value:fmtINR(balance),color:balance>=0?"#22c55e":"#ef4444"},
            {label:"Savings Rate",value:savingsRate+"%",color:"#8b5cf6"},
          ].map((s,i)=>(
            <div key={i} style={{padding:"10px 14px",background:"var(--bg)",borderRadius:12}}>
              <div style={{color:"var(--text2)",fontSize:12}}>{s.label}</div>
              <div style={{fontWeight:700,fontSize:20,color:s.color}}>{s.value}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="vcard">
        <div className="section-title">Ask AI Advisor</div>
        <div style={{display:"flex",gap:8,marginBottom:12}}>
          <input className="vinput" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Ask anything about your finances..." onKeyDown={e=>e.key==="Enter"&&handleAsk()} style={{flex:1}}/>
          <button className="vbtn vbtn-primary" onClick={handleAsk} disabled={loading} style={{padding:"10px 20px"}}>{loading?"..." :"Ask"}</button>
        </div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:12}}>
          {suggestions.map((s,i)=>(
            <button key={i} className="vbtn vbtn-ghost" style={{fontSize:12,padding:"6px 12px"}} onClick={()=>{setQuery(s);}}>{s}</button>
          ))}
        </div>
        {response && (
          <div style={{padding:"16px",background:"var(--bg)",borderRadius:12,fontSize:14,lineHeight:1.7,whiteSpace:"pre-line",borderLeft:"4px solid var(--accent)"}}>
            {response}
          </div>
        )}
      </div>
    </div>
  );
}
