/* SAVE AS: money.js · LOCATION: C:/MarvelApps/dayhub/money.js
 * MONEY HUB (app #6 built, #8 on the HUB LIFE list; Scott 2026-10-15: "Money Hub — Your Complete Personal Financial
 * Command Center", saved verbatim in C:/MarvelDesktop/docs/MONEY_HUB_PLAN_FROM_OUTSIDE_CHAT_2026-10-15.md).
 * Runs at /moneyhub/ with window.DH_MODE = "money". Scott 10/15: Pro $2.99/mo, manual + scan + CSV (no bank sync at
 * launch), Phase 1 now.
 * Phase 1: dashboard (cash available, this month in / out, bills before payday, available to save, spending by
 * category), Accounts (typed balances - Money Hub never logs in to a bank), Spending (manual + a bank's CSV download,
 * duplicates skipped, auto-categorised), Bills (Day Hub's S.bills, + autopay; Paid logs the expense once), Budget
 * (a limit per category), Debt (payoff plan: avalanche or snowball, + extra a month), Subscriptions, Payday planner
 * (Day Hub's S.payday), Reports (last 4 months by category).
 * Balances are what the owner types; spending does not move them (a CSV and a typed balance would count it twice).
 * Pro is the MONEY_PASS switch (features.js, OFF until the Whop product exists). When on: free = 3 accounts, Pro =
 * unlimited accounts, CSV import and Reports. Everything lives in S.mh on this phone.
 */
"use strict";
const MH_CATS = [["housing", "🏠", "Housing"], ["utilities", "💡", "Utilities"], ["groceries", "🛒", "Groceries"], ["dining", "🍔", "Eating out"],
  ["transport", "🚗", "Transportation"], ["health", "🩺", "Health"], ["insurance", "🛡️", "Insurance"], ["debt", "💳", "Debt payments"],
  ["subs", "🔁", "Subscriptions"], ["shopping", "🛍️", "Shopping"], ["fun", "🎉", "Fun"], ["family", "🧸", "Kids & family"], ["pets", "🐾", "Pets"],
  ["giving", "🎁", "Gifts & giving"], ["bills", "🧾", "Bills"], ["other", "📦", "Other"]];
const MH_INCATS = [["pay", "💵", "Paycheck"], ["side", "💼", "Side income"], ["benefits", "🏛️", "Benefits / Social Security"], ["income", "➕", "Other income"]];
const MH_ACCTS = [["checking", "🏦", "Checking", true], ["savings", "🐷", "Savings", true], ["cash", "💵", "Cash", true], ["credit", "💳", "Credit card", false],
  ["loan", "🧾", "Loan", false], ["invest", "📈", "Investment / retirement", false]];   // 4th = counts as cash available
const MH_TABS = [["spend", "🧾", "Transactions"], ["accounts", "🏦", "Accounts"], ["bills", "💳", "Payments"], ["budget", "🎯", "Budget"],
  ["debt", "⛓️", "Debt"], ["subs", "📅", "Subscriptions"], ["payday", "💵", "Payday"], ["goals", "🏝️", "Goals"], ["reports", "📊", "Reports"],
  // v1.45 control-room pages (moneyviz.js) - reached from the bottom bar, the home tiles and More
  ["add", "＋", "Add"], ["more", "☰", "Everything"], ["forecast", "📈", "Cash Forecast"], ["insights", "💡", "Smart Insights"], ["vault", "🔐", "Document Vault"]];
// Words in a bank's description -> category (CSV import, and the hint when a spend is typed with no category).
const MH_WORDS = [["groceries", /kroger|whole foods|trader joe|sprouts|wegmans|meijer|walmart|aldi|publix|safeway|heb\b|food lion|costco|sam'?s club|grocery|market/i], ["dining", /mcdonald|burger|wendy|taco|chick-?fil|starbucks|pizza|subway|sonic|doordash|uber ?eats|grubhub|restaurant|cafe|coffee/i],
  ["transport", /shell|exxon|chevron|valero|circle k|murphy|bp\b|gas|fuel|uber(?! ?eats)|lyft|parking|toll|auto|tire|jiffy/i], ["utilities", /electric|energy|water|sewer|gas co|entergy|at&t|verizon|t-?mobile|comcast|xfinity|spectrum|internet|phone/i],
  ["subs", /netflix|hulu|spotify|disney|apple\.com|google \*|youtube|prime video|amazon prime|paramount|max\b|patreon|whop/i], ["health", /pharmacy|cvs|walgreens|doctor|dental|clinic|hospital|teladoc/i],
  ["insurance", /insurance|geico|state farm|progressive|allstate/i], ["housing", /rent|mortgage|hoa\b|apartment/i], ["shopping", /amazon|target|best buy|ebay|etsy|kohl|home depot|lowe'?s/i],
  ["pets", /petco|petsmart|chewy|vet\b/i], ["debt", /payment.*(card|loan)|capital one|discover|synchrony|affirm|klarna|afterpay/i]];
const mcat = k => MH_CATS.find(x => x[0] === k) || MH_INCATS.find(x => x[0] === k) || MH_CATS[MH_CATS.length - 1];
const macct = k => MH_ACCTS.find(x => x[0] === k) || MH_ACCTS[0];
let MH_OPEN = false, MH_TAB = "spend", MH_MSG = "", MH_IMPORT = null, MH_EDIT = null;

function mh() {
  if (!S.mh || typeof S.mh !== "object") S.mh = {};
  const M = S.mh;
  ["accounts", "tx", "subs"].forEach(k => { M[k] = Array.isArray(M[k]) ? M[k] : []; });
  M.budgets = M.budgets && typeof M.budgets === "object" ? M.budgets : {};
  M.plan = M.plan && typeof M.plan === "object" ? M.plan : {};
  M.debt = M.debt && typeof M.debt === "object" ? M.debt : { extra: 0, method: "avalanche" };
  return M;
}
const mhSet = () => !!(S.mh && S.mh.setup);
const mhPro = () => typeof isPro === "function" && isPro();
const mhGate = () => switchOn("MONEY_PASS") && !mhPro();            // true = this is the free version
const mhCanAddAcct = () => !mhGate() || mh().accounts.length < 3;
const usd = n => money(n).replace(/\.00$/, "");
const amt = v => { const n = Number(String(v == null ? "" : v).replace(/[$,\s]/g, "")); return isFinite(n) ? Math.round(n * 100) / 100 : 0; };
const ym = d => String(d || "").slice(0, 7);
// A date with its year when it is not this year (auto.js has the same helper; Money Hub doesn't load auto.js).
const mDate = d => d ? prettyDate(d) + (String(d).slice(0, 4) !== today().slice(0, 4) ? ", " + String(d).slice(0, 4) : "") : "";
const monthName = m => parseDay(m + "-01").toLocaleDateString("en-US", { month: "long", year: "numeric" });

// ------------------------------------------------------------ the math (pure, the tests call these)
// Cash you could spend today: checking + savings + cash balances.
const cashNow = () => mh().accounts.filter(a => macct(a.kind)[3]).reduce((n, a) => n + (Number(a.bal) || 0), 0);
// What you own minus what you owe (credit cards / loans entered as what's owed).
const netWorth = () => mh().accounts.reduce((n, a) => n + (["credit", "loan"].includes(a.kind) ? -1 : 1) * (Number(a.bal) || 0), 0);
// One month's money in / out from the log. -> {inc, out, byCat: {cat: spent}}
function monthTotals(m) {
  const byCat = {}; let inc = 0, out = 0;
  mh().tx.filter(t => ym(t.date) === m).forEach(t => { if (t.amt > 0) inc += t.amt; else { out += -t.amt; byCat[t.cat] = (byCat[t.cat] || 0) - t.amt; } });
  return { inc, out, byCat };
}
// Bills still to pay this month (not marked paid through this month).
function billsLeft(onDay) {
  const m = ym(onDay);
  return S.bills.filter(b => !(b.paid && b.paid >= m)).reduce((n, b) => n + (Number(b.amount) || 0), 0);
}
// Per category this month: limit, spent, left, status (ok / near at 80% / over).
function budgetRows(m) {
  const t = monthTotals(m), B = mh().budgets;
  return Object.keys(B).filter(k => B[k] > 0).map(k => { const spent = t.byCat[k] || 0, lim = B[k];
    return { cat: k, lim, spent, left: lim - spent, status: spent > lim ? "over" : spent >= lim * 0.8 ? "near" : "ok" }; })
    .sort((a, b) => b.spent / b.lim - a.spent / a.lim);
}
// Pay off debts month by month: everyone gets their minimum, the extra (and every minimum freed by a paid-off debt)
// goes to the highest rate (avalanche) or the smallest balance (snowball). -> {months, interest, order:[{name, month}], stuck}
function payoffPlan(debts, extra, method) {
  let D = debts.filter(d => d.bal > 0).map(d => ({ name: d.name, bal: +d.bal, apr: +d.apr || 0, min: Math.max(+d.min || 0, 0) }));
  const budget = D.reduce((n, d) => n + d.min, 0) + Math.max(0, +extra || 0);
  const order = [], pick = () => D.filter(d => d.bal > 0.005).sort((a, b) => method === "snowball" ? a.bal - b.bal : b.apr - a.apr || a.bal - b.bal)[0];
  let month = 0, interest = 0;
  while (D.some(d => d.bal > 0.005) && month < 600) {
    month++;
    D.forEach(d => { if (d.bal > 0.005) { const i = d.bal * d.apr / 1200; d.bal += i; interest += i; } });
    let left = budget;
    D.forEach(d => { if (d.bal > 0.005) { const p = Math.min(d.min, d.bal, left); d.bal -= p; left -= p; } });
    let tgt; while (left > 0.005 && (tgt = pick())) { const p = Math.min(left, tgt.bal); tgt.bal -= p; left -= p; }
    D.forEach(d => { if (d.bal <= 0.005 && !order.some(o => o.name === d.name)) order.push({ name: d.name, month }); });
  }
  return { months: month, interest: Math.round(interest * 100) / 100, order, stuck: month >= 600 };
}
// The payday planner: start + paycheck - bills - other - savings.
const paydayLeft = (start, check, bills, other, save) => (+start || 0) + (+check || 0) - (+bills || 0) - (+other || 0) - (+save || 0);
// A subscription's cost per month.
const subMonthly = s => s.every === "year" ? s.amt / 12 : s.every === "week" ? s.amt * 52 / 12 : s.amt;
const catGuess = what => (MH_WORDS.find(([, re]) => re.test(what || "")) || ["other"])[0];

// A bank's CSV download -> rows {date, amt, what, cat}. Finds the date / amount (or debit + credit) / description
// columns from the header; reads MM/DD/YYYY, M/D/YY and YYYY-MM-DD; money spent is negative.
function parseCsv(text) {
  const lines = [], s = String(text || "").replace(/^\uFEFF/, "");
  let row = [], cell = "", q = false;
  for (let i = 0; i < s.length; i++) { const ch = s[i];
    if (q) { if (ch === '"' && s[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') q = false; else cell += ch; }
    else if (ch === '"') q = true; else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && s[i + 1] === "\n") i++; row.push(cell); lines.push(row); row = []; cell = ""; }
    else cell += ch; }
  if (cell || row.length) { row.push(cell); lines.push(row); }
  const rows = lines.filter(r => r.some(c => c.trim()));
  if (rows.length < 2) return { rows: [], error: "No rows found in that file." };
  const H = rows[0].map(h => h.trim().toLowerCase()), col = re => H.findIndex(h => re.test(h));
  const cD = col(/date/), cA = col(/^amount|amount$|^amt/), cDr = col(/debit|withdraw|money out/), cCr = col(/credit|deposit|money in/), cW = col(/desc|memo|payee|merchant|name|details|transaction/);
  if (cD < 0 || (cA < 0 && cDr < 0 && cCr < 0)) return { rows: [], error: "Couldn't find the Date and Amount columns. Download the CSV from your bank's website and try again." };
  const day = v => { v = String(v || "").trim(); let m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/); if (m) return `${m[1]}-${pad(+m[2])}-${pad(+m[3])}`;
    m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/); if (m) return `${m[3].length === 2 ? "20" + m[3] : m[3]}-${pad(+m[1])}-${pad(+m[2])}`; return ""; };
  const num = v => { const t = String(v || "").trim(), neg = /^\(.*\)$/.test(t) || /^-/.test(t); const n = amt(t.replace(/[()\-]/g, "")); return neg ? -n : n; };
  const out = rows.slice(1).map(r => { const date = day(r[cD]); let a = cA >= 0 ? num(r[cA]) : 0;
      if (cA < 0) a = (cCr >= 0 ? Math.abs(num(r[cCr])) : 0) - (cDr >= 0 ? Math.abs(num(r[cDr])) : 0);
      const what = String(cW >= 0 ? r[cW] : "").trim().replace(/\s+/g, " ").slice(0, 80);
      return { date, amt: a, what, cat: a > 0 ? "income" : catGuess(what) }; })
    .filter(x => x.date && x.amt);
  return { rows: out, error: out.length ? "" : "No transactions with a date and amount in that file." };
}
const txKey = t => `${t.date}|${(+t.amt).toFixed(2)}|${String(t.what || "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 24)}`;
// Adds rows to the log, skipping any already there. -> how many were added
function addTx(rows, acct) {
  const M = mh(), have = new Set(M.tx.map(txKey)); let n = 0;
  rows.forEach(r => { const t = { id: uid(), date: r.date, amt: r.amt, what: r.what, cat: r.cat, acct: acct || "", src: r.src || "", ...(r.bill ? { bill: r.bill } : {}) };
    if (!have.has(txKey(t))) { M.tx.push(t); have.add(txKey(t)); n++; } });
  return n;
}

// ------------------------------------------------------------ first run
function mhSetupHtml() {
  return `${typeof mvWelcomeTop === "function" ? mvWelcomeTop() : ""}<section class="card welcome mv-welcome"><h2>Welcome to Money Hub 💰</h2>
    <p>See what you have, what's coming, and what you can afford. Start with one account - you can add the rest later.</p>
    <form class="qa-form" data-mhsetup="1">
      <input name="name" placeholder="Your first name" autocomplete="given-name">
      <input name="bal" inputmode="decimal" placeholder="Checking balance today $ (optional)" aria-label="Checking balance">
      <label class="field">How often do you get paid? <select name="freq"><option value="">Skip for now</option>${Object.entries(PAY_FREQ).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select></label>
      <div class="two"><label class="field">Next payday <input type="date" name="next"></label><input name="check" inputmode="decimal" placeholder="Take-home per check $" aria-label="Take-home per check"></div>
      <button class="btn">Start Money Hub</button></form>
    <p class="fine">Everything you type stays on this phone. Money Hub never asks for a bank password.</p></section>`;
}

// ------------------------------------------------------------ the dashboard = MONEY ORBIT (v1.44 Hub OS, Scott 10/15: "get away
// from text based apps"). The wallet (Scott's logo) is the hero; the tabs orbit it as bubbles with a live number each; rings
// show the month at a glance; one "next smart action" card says what needs you first and why.
function mhNext(t) {
  const R = payRows(t).filter(r => !r.paid), late = R.filter(r => r.late), soon = R.filter(r => !r.late && daysUntil(r.due) <= 3);
  const over = budgetRows(ym(t)).filter(r => r.status === "over"), nx = payNext(t), due = nx ? dueBetween(t, nx).reduce((n, o) => n + o.amt, 0) : 0;
  if (late.length) return { icon: "⏰", text: `${late[0].b.name} is late (${usd(late[0].b.amount)})`, why: `It was due ${mDate(late[0].due)} and isn't marked paid.`, tab: "bills" };
  if (nx && cashNow() > 0 && due > cashNow()) return { icon: "⚠️", text: `Bills before payday are more than your cash`, why: `${usd(due)} due before ${mDate(nx)}, ${usd(cashNow())} in your accounts.`, tab: "bills" };
  if (soon.length) return { icon: "💳", text: `${soon[0].b.name} due ${inDays(daysUntil(soon[0].due))}`, why: `${usd(soon[0].b.amount)}${soon[0].b.auto ? " on autopay - check it went through" : " - not on autopay"}.`, tab: "bills" };
  if (over.length) return { icon: mcat(over[0].cat)[1], text: `${mcat(over[0].cat)[2]} is over budget`, why: `${usd(over[0].spent)} spent of a ${usd(over[0].lim)} limit this month.`, tab: "budget" };
  if (!mh().accounts.length) return { icon: "🏦", text: "Add your accounts", why: "Cash available and the payday forecast start from your balances.", tab: "accounts" };
  if (!S.bills.length) return { icon: "💳", text: "Add your monthly bills", why: "Then Money Hub shows what's left after payday.", tab: "bills" };
  return { icon: "✅", text: "You're all caught up", why: nx ? `Next payday ${mDate(nx)}. Nothing late or over budget.` : "Nothing late or over budget.", tab: "payday" };
}
const MH_TONES = { housing: "#4da8da", utilities: "#ffd166", groceries: "#34d399", dining: "#fb923c", transport: "#60a5fa", health: "#f472b6", insurance: "#a78bfa", debt: "#f87171",
  subs: "#22d3ee", shopping: "#e879f9", fun: "#facc15", family: "#fda4af", pets: "#a3e635", giving: "#f9a8d4", bills: "#93c5fd", other: "#94a3b8",
  pay: "#22c55e", side: "#14b8a6", benefits: "#10b981", income: "#16a34a" };   // v1.45 money in = greens
function mhDashHtml() {
  if (typeof mvHomeHtml === "function") { mvNavEnsure(); const h = mvHomeHtml(); if (h) return h; }   // v1.45 the control room (moneyviz.js)
  const t = today(), m = ym(t), T = monthTotals(m), M = mh(), P = payRows(t), un = P.filter(r => !r.paid), nx = payNext(t);
  const paidPct = P.length ? (P.length - un.length) / P.length * 100 : 0, B = budgetRows(m), bLim = B.reduce((n, r) => n + r.lim, 0), bSpent = B.reduce((n, r) => n + r.spent, 0);
  const free = T.inc - T.out - billsLeft(t), next = mhNext(t), subsMo = M.subs.filter(s => !s.off).reduce((n, s) => n + subMonthly(s), 0);
  const debt = M.accounts.filter(a => ["credit", "loan"].includes(a.kind)).reduce((n, a) => n + (+a.bal || 0), 0);
  const cats = Object.entries(T.byCat).sort((a, b) => b[1] - a[1]).slice(0, 6), top = cats.length ? cats[0][1] : 0;
  const center = `<div class="hos-core"><img src="icon-192.png" alt="" onerror="this.replaceWith(Object.assign(document.createElement('span'),{textContent:'💰'}))"></div>`;
  const items = [
    { attr: 'data-mhtab="bills"', icon: "💳", label: "Payments", val: un.length ? usd(un.reduce((n, r) => n + (+r.b.amount || 0), 0)) : "all paid", tone: "#27d7ff", badge: un.filter(r => r.late).length ? "late" : "" },
    { attr: 'data-mhtab="accounts"', icon: "🏦", label: "Accounts", val: M.accounts.length ? usd(cashNow()) : "add", tone: "#4ade80" },
    { attr: 'data-mhtab="spend"', icon: "🧾", label: "Spending", val: usd(T.out), tone: "#fb923c" },
    { attr: 'data-mhtab="budget"', icon: "🎯", label: "Budget", val: B.length ? `${Math.round(bLim ? bSpent / bLim * 100 : 0)}%` : "set", tone: "#f472b6", badge: B.some(r => r.status === "over") ? "over" : "" },
    { attr: 'data-mhtab="debt"', icon: "⛓️", label: "Debt", val: debt ? usd(debt) : "none", tone: "#f87171" },
    { attr: 'data-mhtab="subs"', icon: "🔁", label: "Subs", val: subsMo ? `${usd(subsMo)}/mo` : "add", tone: "#22d3ee" },
    { attr: 'data-mhtab="payday"', icon: "💵", label: "Payday", val: nx ? mDate(nx) : "set", tone: "#facc15" },
    { attr: 'data-mhtab="goals"', icon: "🏝️", label: "Goals", val: S.goals.length ? `${Math.round(S.goals.reduce((n, g) => n + goalPct(g), 0) / S.goals.length)}%` : "add", tone: "#a78bfa" }];
  return `<section class="card hos hos-money"><div class="hos-head"><span>MONEY HUB</span><small>${monthName(m)}</small></div>
    ${typeof mvHomeHtml === "function" ? `<button class="mv-switch top" data-mvview="room">▦ Control room</button>` : ""}
    ${hosOrbit(center, items)}
    <div class="hos-cash"><small>Cash available</small><b>${usd(cashNow())}</b><span>${nx ? `Next payday ${mDate(nx)} (${inDays(daysUntil(nx))})` : "Set your payday to see the forecast"}</span></div>
    <button class="hos-next" data-mhtab="${next.tab}"><span class="hos-next-ic" aria-hidden="true">${next.icon}</span><span class="grow"><small>Your next smart action</small><b>${esc(next.text)}</b><em>Why: ${esc(next.why)}</em></span><span class="hos-go" aria-hidden="true">›</span></button>
    <div class="hos-rings">${hosRing(paidPct, P.length ? `${Math.round(paidPct)}%` : "–", "bills paid", "#70e9b6")}
      ${hosRing(T.inc ? T.out / T.inc * 100 : 0, usd(T.out), "spent this month", T.inc && T.out > T.inc ? "#ff978f" : "#27d7ff")}
      ${hosRing(T.inc ? Math.max(0, free) / T.inc * 100 : 0, usd(free), "left to save", free < 0 ? "#ff978f" : "#facc15")}</div>
    ${cats.length ? `<div class="hos-cats">${cats.map(([k, v]) => `<div class="hos-cat" style="--tone:${MH_TONES[k] || "#94a3b8"}"><span class="hos-ic" aria-hidden="true">${mcat(k)[1]}</span><div class="grow"><b>${esc(mcat(k)[2])}</b><i style="width:${Math.max(6, Math.round(v / top * 100))}%"></i></div><strong>${usd(v)}</strong></div>`).join("")}</div>`
      : `<p class="hos-hint">Log what you spend - or import your bank's CSV - and your categories light up here.</p>`}
    <form class="hos-quick" data-mhquick="1"><input name="amt" inputmode="decimal" placeholder="$ spent" aria-label="Amount spent" required>
      <input name="what" placeholder="What for" aria-label="What for"><select name="cat" aria-label="Category"><option value="">Guess it</option>${catOpts("")}</select><button class="hos-btn" aria-label="Log spending">＋</button></form>
  </section>`;
}

// ------------------------------------------------------------ the sheet: one page per tab, tabs in a bottom bar
function mhSheet() {
  let el = document.getElementById("mhSheet");
  if (!el) { el = document.createElement("div"); el.id = "mhSheet"; el.className = "sheet"; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); document.body.appendChild(el); }
  return el;
}
function hideMh() { const el = document.getElementById("mhSheet"); if (el) el.classList.add("hidden"); MH_OPEN = false; MH_MSG = ""; MH_IMPORT = null; MH_EDIT = null; MH_PADD = false; MH_PEDIT = null; if (typeof MV_SCAN !== "undefined") { MV_SCAN = null; MV_BIG = null; } }
function showMh(tab) {
  if (tab) MH_TAB = tab; MH_OPEN = true;
  const el = mhSheet(), T = MH_TABS.find(x => x[0] === MH_TAB) || MH_TABS[0]; el.setAttribute("aria-label", T[2]);
  const viz = typeof mvNavHtml === "function";                          // v1.45: every page in the control-room look + the Home · Payments · ＋ · Goals · More bar
  el.innerHTML = `<div class="sheet-body${MH_TAB === "bills" || MH_TAB === "goals" || viz ? " mhp-sheet" : ""}${viz ? " mv-sheet" : ""}"><div class="grab"></div>
    <div class="sheet-head"><h2>${T[1]} ${T[2]}</h2><button class="icon-btn" data-mhclose="1" aria-label="Close">✕</button></div>
    <div class="home-pane">${mhPane()}</div><p class="fine" id="mhMsg">${MH_MSG ? "⚠️ " + esc(MH_MSG) : ""}</p>
    <nav class="auto-tabs${viz ? " mv-tabs" : ""}" aria-label="Money Hub">${viz ? mvNavHtml(MH_TAB) : MH_TABS.map(([k, i, l]) => `<button class="${MH_TAB === k ? "on" : ""}" data-mhtab="${k}" aria-current="${MH_TAB === k ? "page" : "false"}"><span>${i}</span>${l}</button>`).join("")}</nav></div>`;
  el.classList.remove("hidden");
  const on = el.querySelector(".auto-tabs .on"); if (on && on.scrollIntoView) on.scrollIntoView({ block: "nearest", inline: "nearest" });
}
const mhMsgShow = () => { const el = document.getElementById("mhMsg"); if (el) el.textContent = MH_MSG ? "⚠️ " + MH_MSG : ""; };
const catOpts = (sel, inc) => [...MH_CATS, ...(inc ? MH_INCATS : [])].map(([k, i, l]) => `<option value="${k}" ${sel === k ? "selected" : ""}>${i} ${l}</option>`).join("");
const proLock = what => `<p>${what} come with ${esc(PLAN.MONEY_NAME)} (${esc(PLAN.MONEY_MONTHLY)}, 30 days free).</p>
  ${PLAN.MONEY_CHECKOUT_URL ? `<a class="btn" href="${esc(PLAN.MONEY_CHECKOUT_URL)}" target="_blank" rel="noopener">Start 30 days free</a>` : `<p class="fine">Coming soon.</p>`}`;

function mhPane() {
  const M = mh(), t = today(), m = ym(t);
  if (typeof mvPane === "function") { const h = mvPane(MH_TAB); if (h != null) return h; }   // v1.45 moneyviz.js pages
  if (MH_TAB === "accounts") {
    const L = M.accounts;
    return `<div class="home-stats"><div class="home-stat"><b>${usd(cashNow())}</b><span>cash available</span></div><div class="home-stat"><b>${usd(netWorth())}</b><span>net worth</span></div>
        <div class="home-stat"><b>${L.length}</b><span>account${L.length === 1 ? "" : "s"}</span></div></div>
      ${L.map(a => `<div class="row"><span class="ci">${macct(a.kind)[1]}</span><div class="grow"><b>${esc(a.name)}</b>
          <span class="sub">${esc(macct(a.kind)[2])}${["credit", "loan"].includes(a.kind) ? " · owed" : ""}${a.apr ? ` · ${a.apr}% APR` : ""}${a.min ? ` · min ${usd(a.min)}` : ""}${a.at ? ` · updated ${mDate(a.at)}` : ""}</span></div>
          <form class="mh-bal" data-mhbal="${a.id}"><input name="bal" inputmode="decimal" value="${a.bal}" aria-label="Balance for ${esc(a.name)}"><button class="btn sm ghost">Save</button></form>
          <button class="icon-btn" data-mhdel="acct:${a.id}" aria-label="Remove">✕</button></div>`).join("")}
      ${mhCanAddAcct() ? `<form class="qa-form" data-mhacct="1"><div class="two"><select name="kind" aria-label="Kind">${MH_ACCTS.map(([k, i, l]) => `<option value="${k}">${i} ${l}</option>`).join("")}</select>
          <input name="name" placeholder="Name, e.g. Chase checking" required aria-label="Account name"></div>
        <div class="hpv-row"><input name="bal" inputmode="decimal" placeholder="Balance $ (owed, for cards)" aria-label="Balance"><input name="apr" inputmode="decimal" placeholder="APR % (cards, loans)" aria-label="Interest rate">
          <input name="min" inputmode="decimal" placeholder="Min payment $" aria-label="Minimum payment"></div><button class="btn sm">Add account</button></form>`
        : proLock("More than 3 accounts")}
      <p class="fine">Type each balance from your bank's app. Money Hub never logs in to your bank.</p>`;
  }
  if (MH_TAB === "bills") return mhPayments();
  if (MH_TAB === "goals") return mhGoals();                  // v1.44 Goals & Savings (Savings Islands)             // v1.43 Upcoming Payments (Hub OS)
  if (MH_TAB === "budget") {
    const R = budgetRows(m), set = new Set(R.map(r => r.cat));
    return `${R.length ? R.map(r => `<div class="mh-bar ${r.status}"><span>${mcat(r.cat)[1]} ${esc(mcat(r.cat)[2])}</span><b>${usd(r.spent)} / ${usd(r.lim)}</b><i style="width:${Math.min(100, Math.round(r.spent / r.lim * 100))}%"></i>
        <button class="x" data-mhbudgetoff="${r.cat}" aria-label="Remove limit">✕</button></div>`).join("")
      : `<p class="fine" style="margin-top:0">Set a monthly limit for the categories that get away from you - we warn you at 80% and when you go over.</p>`}
      <form class="qa-form" data-mhbudget="1"><div class="two"><select name="cat" aria-label="Category">${MH_CATS.map(([k, i, l]) => `<option value="${k}">${i} ${l}${set.has(k) ? " (change)" : ""}</option>`).join("")}</select>
        <input name="lim" inputmode="decimal" placeholder="Limit a month $" required aria-label="Monthly limit"></div><button class="btn sm">Set limit</button></form>`;
  }
  if (MH_TAB === "debt") {
    const D = M.accounts.filter(a => ["credit", "loan"].includes(a.kind) && a.bal > 0).map(a => ({ name: a.name, bal: +a.bal, apr: +a.apr || 0, min: +a.min || 0 }));
    if (!D.length) return `<p class="fine" style="margin-top:0">Add your credit cards and loans in Accounts (what you owe, the APR and the minimum) and we'll work out the fastest way out.</p>
      <button class="btn sm" data-mhtab="accounts">Go to Accounts</button>`;
    const ex = M.debt.extra || 0, meth = M.debt.method === "snowball" ? "snowball" : "avalanche", P = payoffPlan(D, ex, meth), base = payoffPlan(D, 0, meth), noMin = D.filter(d => !d.min);
    const yrs = n => n >= 12 ? `${Math.floor(n / 12)} yr${n >= 24 ? "s" : ""}${n % 12 ? ` ${n % 12} mo` : ""}` : `${n} month${n === 1 ? "" : "s"}`;
    return `<div class="home-stats"><div class="home-stat"><b>${usd(D.reduce((n, d) => n + d.bal, 0))}</b><span>owed</span></div><div class="home-stat"><b>${P.stuck ? "never" : yrs(P.months)}</b><span>to debt-free</span></div>
        <div class="home-stat"><b>${usd(P.interest)}</b><span>interest on the way</span></div></div>
      ${P.stuck ? `<p class="fine">⚠️ At these payments the interest outruns you. Add an extra amount below${noMin.length ? ` (and minimums for ${noMin.map(d => esc(d.name)).join(", ")})` : ""}.</p>` : ""}
      <form class="qa-form" data-mhdebt="1"><div class="two"><input name="extra" inputmode="decimal" placeholder="Extra a month $" value="${ex || ""}" aria-label="Extra payment a month">
        <select name="method" aria-label="Method"><option value="avalanche" ${meth === "avalanche" ? "selected" : ""}>Highest rate first (saves the most)</option><option value="snowball" ${meth === "snowball" ? "selected" : ""}>Smallest balance first (quick wins)</option></select></div>
        <button class="btn sm">Work it out</button></form>
      ${ex && !P.stuck && !base.stuck ? `<p class="fine">${usd(ex)} extra a month: debt-free ${yrs(base.months - P.months)} sooner and ${usd(base.interest - P.interest)} less interest.</p>` : ""}
      ${typeof mvDebtViz === "function" ? mvDebtViz(D, P) : ""}
      ${P.order.length && typeof mvDebtViz !== "function" ? `<p class="sub" style="margin:10px 0 4px"><b>Order</b></p>${P.order.map((o, i) => `<div class="row"><span class="ci">${i + 1}</span><div class="grow">${esc(o.name)}<span class="sub">paid off in ${yrs(o.month)}</span></div></div>`).join("")}` : ""}
      <p class="fine">Estimates: interest monthly at today's APR, payments every month. Your statement is the real number.</p>`;
  }
  if (MH_TAB === "subs") {
    const L = M.subs.slice().sort((a, b) => (a.off ? 1 : 0) - (b.off ? 1 : 0) || (a.next || "9").localeCompare(b.next || "9")), on = L.filter(s => !s.off);
    const mo = on.reduce((n, s) => n + subMonthly(s), 0), saved = L.filter(s => s.off).reduce((n, s) => n + subMonthly(s) * 12, 0);
    return `<div class="home-stats"><div class="home-stat"><b>${usd(mo)}</b><span>a month</span></div><div class="home-stat"><b>${usd(mo * 12)}</b><span>a year</span></div>
        <div class="home-stat"><b>${usd(saved)}</b><span>saved a year by cancelling</span></div></div>
      ${L.map(s => `<div class="row" style="${s.off ? "opacity:.55" : ""}"><span class="ci">🔁</span><div class="grow"><b>${esc(s.name)}</b><span class="sub">${usd(s.amt)} a ${s.every || "month"}${s.off ? ` · cancelled ${mDate(s.off)}` : s.next ? ` · renews ${mDate(s.next)}` : ""}</span></div>
          ${s.off ? "" : `<button class="btn sm ghost" data-mhsubren="${s.id}">Renewed</button><button class="btn sm ghost" data-mhsuboff="${s.id}">Cancelled</button>`}<button class="icon-btn" data-mhdel="sub:${s.id}" aria-label="Remove">✕</button></div>`).join("")}
      ${!L.length ? `<p class="fine" style="margin-top:0">Streaming, apps, memberships, the gym. See what they add up to, and what you save by cancelling.</p>` : ""}
      <form class="qa-form" data-mhsub="1"><input name="name" placeholder="e.g. Netflix" required aria-label="Subscription">
        <div class="hpv-row"><input name="amt" inputmode="decimal" placeholder="Cost $" required aria-label="Cost"><select name="every" aria-label="How often"><option value="month">Monthly</option><option value="year">Yearly</option><option value="week">Weekly</option></select>
          <input type="date" name="next" aria-label="Next renewal"></div><button class="btn sm">Add</button></form>`;
  }
  if (MH_TAB === "payday") {
    const P = M.plan, nx = payNext(t), after = nx ? payAfter(nx) : null, pa = payAmount();
    const billsDue = nx ? dueBetween(t, after).reduce((n, o) => n + o.amt, 0) : billsLeft(t);
    const v = { start: P.start != null ? P.start : Math.round(cashNow() * 100) / 100, check: P.check != null ? P.check : Math.round((pa.amt || 0) * 100) / 100, bills: P.bills != null ? P.bills : Math.round(billsDue * 100) / 100, other: P.other || 0, save: P.save || 0 };
    const left = paydayLeft(v.start, v.check, v.bills, v.other, v.save);
    return `${nx ? `<p class="fine" style="margin-top:0">Next payday <b>${mDate(nx)}</b> (${inDays(daysUntil(nx))}). Bills below = everything due from today until the payday after that${after ? ` (${mDate(after)})` : ""}.</p>`
        : `<p class="fine" style="margin-top:0">Set your payday in Day Hub's Payday card or the start screen to fill this in. You can type it all yourself too.</p>`}
      ${typeof mvWaterfall === "function" ? mvWaterfall(v, left) : ""}
      <div class="hpv-ai"><p class="sub" style="margin:0">Left after all that</p><p class="hpv-big" style="${left < 0 ? "color:var(--red)" : ""}">${usd(left)}</p>
        <p class="fine" style="margin:4px 0 0">${usd(v.start)} + ${usd(v.check)} − ${usd(v.bills)} bills − ${usd(v.other)} other − ${usd(v.save)} savings${left < 0 ? " · ⚠️ short - move a bill or trim spending" : ""}</p></div>
      <form class="qa-form" data-mhplan="1">
        <label class="field">Starting cash $ <input name="start" inputmode="decimal" value="${v.start}"></label>
        <label class="field">Next paycheck $ <input name="check" inputmode="decimal" value="${v.check}"></label>
        <label class="field">Bills $ <input name="bills" inputmode="decimal" value="${v.bills}"></label>
        <label class="field">Other spending $ <input name="other" inputmode="decimal" value="${v.other}"></label>
        <label class="field">Put in savings $ <input name="save" inputmode="decimal" value="${v.save}"></label>
        <div class="foot-actions"><button class="btn sm">Work it out</button><button class="btn sm ghost" type="button" data-mhplanreset="1">Reset</button></div></form>`;
  }
  if (MH_TAB === "reports") {
    if (mhGate()) return proLock("Reports");
    const months = [0, 1, 2, 3].map(k => { const d = parseDay(m + "-01"); d.setMonth(d.getMonth() - k); return ymd(d).slice(0, 7); });
    const T = months.map(monthTotals), cats = [...new Set(T.flatMap(x => Object.keys(x.byCat)))].sort((a, b) => (T[0].byCat[b] || 0) - (T[0].byCat[a] || 0));
    const avg = k => ((T[1].byCat[k] || 0) + (T[2].byCat[k] || 0) + (T[3].byCat[k] || 0)) / 3;
    const short = mm => parseDay(mm + "-01").toLocaleDateString("en-US", { month: "short" });
    if (!cats.length && !T.some(x => x.inc)) return `<p class="fine" style="margin-top:0">Reports fill in as you log spending and income (or import your bank's CSV).</p>`;
    return `<div class="mh-table"><table><tr><th></th>${months.map(mm => `<th>${short(mm)}</th>`).join("")}<th>vs 3-mo avg</th></tr>
      <tr><td>💵 In</td>${T.map(x => `<td>${usd(x.inc)}</td>`).join("")}<td></td></tr>
      <tr><td>🧾 Out</td>${T.map(x => `<td>${usd(x.out)}</td>`).join("")}<td>${(a => a ? `${T[0].out > a ? "▲" : "▼"} ${usd(Math.abs(T[0].out - a))}` : "")((T[1].out + T[2].out + T[3].out) / 3)}</td></tr>
      ${cats.map(k => { const a = avg(k), d = (T[0].byCat[k] || 0) - a; return `<tr><td>${mcat(k)[1]} ${esc(mcat(k)[2])}</td>${T.map(x => `<td>${x.byCat[k] ? usd(x.byCat[k]) : "–"}</td>`).join("")}<td>${a ? `${d > 0 ? "▲" : "▼"} ${usd(Math.abs(d))}` : "new"}</td></tr>`; }).join("")}
      <tr><td><b>Net</b></td>${T.map(x => `<td><b>${usd(x.inc - x.out)}</b></td>`).join("")}<td></td></tr></table></div>
      <p class="fine">This month so far vs the average of the 3 months before it.</p>`;
  }
  // spending (default tab)
  if (MH_IMPORT) {
    const I = MH_IMPORT, have = new Set(M.tx.map(txKey)), fresh = I.rows.filter(r => !have.has(txKey({ ...r })));
    return `<p class="fine" style="margin-top:0"><b>${esc(I.name)}</b>: ${I.rows.length} transactions, <b>${fresh.length} new</b>${I.rows.length - fresh.length ? ` (${I.rows.length - fresh.length} already in Money Hub - skipped)` : ""}.</p>
      ${fresh.slice(0, 8).map(r => `<div class="row"><span class="ci">${mcat(r.cat)[1]}</span><div class="grow">${esc(r.what || "-")}<span class="sub">${mDate(r.date)} · ${esc(mcat(r.cat)[2])}</span></div><b>${r.amt < 0 ? "−" : "+"}${usd(Math.abs(r.amt))}</b></div>`).join("")}
      ${fresh.length > 8 ? `<p class="fine">…and ${fresh.length - 8} more.</p>` : ""}
      <form class="qa-form" data-mhimport="1"><label class="field">Which account <select name="acct"><option value="">None</option>${M.accounts.map(a => `<option value="${a.id}">${esc(a.name)}</option>`).join("")}</select></label>
        <div class="foot-actions"><button class="btn sm" ${fresh.length ? "" : "disabled"}>Add ${fresh.length}</button><button class="btn sm ghost" type="button" data-mhimportno="1">Cancel</button></div></form>
      <p class="fine">Categories are a guess from the description - change any one after.</p>`;
  }
  const L = M.tx.slice().sort((a, b) => b.date.localeCompare(a.date) || (b.id > a.id ? 1 : -1)).slice(0, 40), Tm = monthTotals(m);
  let mon = "";
  return `<div class="home-stats"><div class="home-stat"><b>${usd(Tm.inc)}</b><span>in</span></div><div class="home-stat"><b>${usd(Tm.out)}</b><span>out</span></div><div class="home-stat"><b>${usd(Tm.inc - Tm.out)}</b><span>${parseDay(t).toLocaleDateString("en-US", { month: "long" })}</span></div></div>
    <form class="qa-form" data-mhtx="1"><div class="hpv-row"><select name="dir" aria-label="Money in or out"><option value="out">− Spent</option><option value="in">+ Money in</option></select>
        <input name="amt" inputmode="decimal" placeholder="Amount $" required aria-label="Amount"><input type="date" name="date" value="${t}" aria-label="Date"></div>
      <div class="two"><input name="what" placeholder="What for, e.g. Kroger" aria-label="What for"><select name="cat" aria-label="Category"><option value="">Category: guess it</option>${catOpts("", true)}</select></div>
      <button class="btn sm">Add</button></form>
    ${mhGate() ? `<p class="fine">📥 Import your bank's CSV: ${esc(PLAN.MONEY_NAME)}.</p>`
      : `<label class="btn sm ghost" style="align-self:flex-start">📥 Import bank CSV<input type="file" accept=".csv,text/csv" data-mhcsv="1" hidden></label>
         <p class="fine" style="margin:4px 0 8px">On your bank's website: Activity → Download → CSV. Duplicates are skipped.</p>`}
    ${L.map(x => { const h = ym(x.date) !== mon ? `<p class="sub" style="margin:10px 0 4px"><b>${monthName(ym(x.date))}</b></p>` : ""; mon = ym(x.date);
      return h + (MH_EDIT === x.id
        ? `<form class="row" data-mhtxcat="${x.id}"><div class="grow">${esc(x.what || "-")}</div><select name="cat" aria-label="Category">${catOpts(x.cat, x.amt > 0)}</select><button class="btn sm ghost">Save</button></form>`
        : `<div class="row"><button class="ci mh-cat" data-mhedit="${x.id}" aria-label="Change category">${mcat(x.cat)[1]}</button><div class="grow">${esc(x.what || mcat(x.cat)[2])}<span class="sub">${mDate(x.date)} · ${esc(mcat(x.cat)[2])}${x.src ? ` · ${esc(x.src)}` : ""}</span></div>
          <b style="${x.amt > 0 ? "color:var(--green, #34d399)" : ""}">${x.amt < 0 ? "−" : "+"}${usd(Math.abs(x.amt))}</b><button class="icon-btn" data-mhdel="tx:${x.id}" aria-label="Remove">✕</button></div>`); }).join("")}
    ${!L.length ? `<p class="fine">Nothing logged yet.</p>` : ""}`;
}

// ------------------------------------------------------------ v1.43 Upcoming Payments (Scott 10/15: "Money Hub design package" -
// Hub OS Living Payments). One screen: this month's bills as a timeline, paid / unpaid, payday and projected cash.
// Bills are Day Hub's S.bills (recurring monthly: day of month; paid = the month it's paid THROUGH). Mark paid never moves money.
let MH_PF = "all", MH_PADD = false, MH_PEDIT = null;
const PAY_ICONS = { housing: "🏠", utilities: "⚡", insurance: "🛡️", transport: "🚗", debt: "💳", subs: "🔁", health: "🩺", family: "🧸", pets: "🐾", bills: "🧾" };
// This month's view of every bill: due date this month, paid or not, late. -> rows sorted by due date
function payRows(onDay) {
  const m = ym(onDay), y = +m.slice(0, 4), mo = +m.slice(5, 7) - 1, dim = new Date(y, mo + 1, 0).getDate();
  return S.bills.map(b => { const due = `${m}-${pad(Math.min(Number(b.day) || 1, dim))}`, paid = !!(b.paid && b.paid >= m);
    return { b, due, paid, late: !paid && due < onDay, today: !paid && due === onDay }; }).sort((a, b) => a.due.localeCompare(b.due) || a.b.name.localeCompare(b.b.name));
}
// The forecast: cash + next paycheck - every unpaid bill this month (paid ones are assumed already out of the cash).
function payForecast(onDay, cash, check) {
  const R = payRows(onDay), un = R.filter(r => !r.paid), nx = payNext(onDay);
  const total = un.reduce((n, r) => n + (Number(r.b.amount) || 0), 0), before = un.filter(r => !nx || r.due < nx).reduce((n, r) => n + (Number(r.b.amount) || 0), 0);
  return { rows: R, unpaid: un.length, paid: R.length - un.length, total, before, nx, remaining: (+cash || 0) + (+check || 0) - total,
    shortBefore: nx ? (+cash || 0) - before : null };
}
const payInsight = F => F.remaining < 0 ? `⚠️ Your unpaid bills (${usd(F.total)}) are more than your cash plus your next paycheck. Look at moving a due date or trimming spending.`
  : F.shortBefore != null && F.shortBefore < 0 ? `⚠️ Bills due before payday (${usd(F.before)}) are more than your cash today. Everything is covered once your paycheck lands - ${usd(F.remaining)} left after that.`
  : !F.rows.length ? "Add your monthly bills and this works out what's left after payday."
  : `After your ${F.unpaid} unpaid bill${F.unpaid === 1 ? "" : "s"} and your next paycheck, you should have about ${usd(F.remaining)}. Other spending isn't included.`;
const safeUrl = u => { u = String(u || "").trim(); return /^https:\/\/[^\s"'<>]+\.[^\s"'<>]+$/i.test(u) ? u.slice(0, 300) : ""; };
function mhPayments() {
  const M = mh(), t = today(), cash = M.payCash != null ? M.payCash : Math.round(cashNow() * 100) / 100, check = M.payCheck != null ? M.payCheck : Math.round((payAmount().amt || 0) * 100) / 100;
  const F = payForecast(t, cash, check), pct = F.rows.length ? Math.round(F.paid / F.rows.length * 100) : 0, mon = parseDay(t).toLocaleDateString("en-US", { month: "long" });
  const viz = typeof mvPayTop === "function", pday = viz && MV_PDAY;
  const shown = F.rows.filter(r => (MH_PF === "all" || (MH_PF === "paid" ? r.paid : !r.paid)) && (!pday || r.due === pday));
  // v1.45 the art's list: Due soon (7 days, late included) / Later this month / Paid
  const grouped = () => !viz ? shown.map(r => card(r)).join("") : [["Due soon", r => !r.paid && daysUntil(r.due) <= 7], ["Later this month", r => !r.paid && daysUntil(r.due) > 7], ["Paid", r => r.paid]]
    .map(([h, f]) => { const L = shown.filter(f); return L.length ? `<div class="mv-grp"><h4>${h}</h4><span>${L.length} · ${money(L.reduce((n, r) => n + (+r.b.amount || 0), 0))}</span></div>` + L.map(r => card(r)).join("") : ""; }).join("");
  const card = r => { const b = r.b, ic = PAY_ICONS[b.cat] || mcat(b.cat || "bills")[1];
    if (MH_PEDIT === b.id) return `<form class="mhp-bill mhp-edit" data-mhbillsave="${b.id}"><div class="mhp-sym" aria-hidden="true">${ic}</div><div class="mhp-fields">
        <input name="name" value="${esc(b.name)}" required aria-label="Bill name"><div class="hpv-row"><input name="amount" inputmode="decimal" value="${b.amount}" required aria-label="Amount">
        <input name="day" inputmode="numeric" value="${b.day}" required aria-label="Due day of the month"><select name="cat" aria-label="Category">${catOpts(b.cat || "bills")}</select></div>
        <input name="url" inputmode="url" value="${esc(b.url || "")}" placeholder="Pay page link (https://…), optional" aria-label="Pay page link">
        <label class="fine" style="display:flex;gap:8px;align-items:center;margin:2px 0"><input type="checkbox" name="auto" style="width:auto;flex:none;margin:0" ${b.auto ? "checked" : ""}><span>On autopay</span></label>
        <div class="foot-actions"><button class="btn sm">Save</button><button class="btn sm ghost" type="button" data-mhbilledit="">Cancel</button><button class="btn sm ghost" type="button" data-mhdel="bill:${b.id}">Delete</button></div></div></form>`;
    const tone = typeof mvTone === "function" ? mvTone(b.name, b.cat) : "";   // v1.45 brand / category colour
    return `<article class="mhp-bill ${r.paid ? "paid" : ""}"><div class="mhp-sym" aria-hidden="true"${tone ? ` style="background:linear-gradient(145deg, ${tone}, color-mix(in srgb, ${tone} 50%, #000))"` : ""}>${ic}</div>
      <div class="mhp-det"><strong>${esc(b.name)}</strong><small>${mDate(r.due)} · ${b.auto ? "Autopay expected" : "Manual payment"}</small>
        <div class="mhp-acts">${r.paid ? `<button data-mhunpaid="${b.id}" aria-label="Undo paid for ${esc(b.name)}">Undo paid</button>` : `<button data-mhpaid="${b.id}" aria-label="Mark ${esc(b.name)} paid">Mark paid</button>`}
          <button data-mhbilledit="${b.id}" aria-label="Edit ${esc(b.name)}">✏️ Edit</button>${safeUrl(b.url) ? `<a href="${esc(safeUrl(b.url))}" target="_blank" rel="noopener noreferrer">Pay ↗</a>` : ""}</div></div>
      <div class="mhp-amt"><b>${money(Number(b.amount) || 0)}</b><span class="mhp-st ${r.paid ? "paid" : r.late ? "late" : ""}">${r.paid ? "✓ Paid" : r.late ? "Late" : r.today ? "Due today" : "Scheduled"}</span></div></article>`; };
  return `<div class="mhp">
    <section class="mhp-hero"><div><div class="mhp-label">UPCOMING PAYMENTS</div><div class="mhp-big">${money(F.total)}</div>
        <div class="mhp-pills"><div class="mhp-pill">Bills remaining <b>${F.unpaid}</b></div><div class="mhp-pill">Paid <b>${F.paid}</b></div>
          <div class="mhp-pill">Next payday <b class="sm">${F.nx ? mDate(F.nx) : "not set"}</b></div></div>
        <div class="mhp-prog"><p>${mon} payment progress <span>${pct}%</span></p><div class="mhp-bar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-label="${mon} bills paid"><div style="width:${pct}%"></div></div></div></div>
      <div class="mhp-orb" aria-hidden="true"><img src="icon-192.png" alt="" onerror="this.replaceWith(document.createTextNode('👛'))"></div></section>
    ${viz ? mvPayTop(F) : ""}
    <div class="mhp-sec"><div><h3>Payment Timeline</h3><small>${mon} ${t.slice(0, 4)}</small></div><button class="mhp-action" data-mhpadd="1">${MH_PADD ? "Close" : "+ Add bill"}</button></div>
    ${MH_PADD ? `<form class="qa-form mhp-panel" data-mhbill="1"><input name="name" placeholder="Bill, e.g. Electric" required aria-label="Bill name">
        <div class="hpv-row"><input name="amount" inputmode="decimal" placeholder="Amount $" required aria-label="Amount"><input name="day" inputmode="numeric" placeholder="Due day (1-31)" required aria-label="Due day of the month">
          <select name="cat" aria-label="Category">${catOpts("bills")}</select></div>
        <input name="url" inputmode="url" placeholder="Pay page link (https://…), optional" aria-label="Pay page link">
        <label class="fine" style="display:flex;gap:8px;align-items:center;margin:4px 0"><input type="checkbox" name="auto" style="width:auto;flex:none;margin:0"><span>On autopay</span></label>
        <button class="btn sm">Add bill</button></form>` : ""}
    <div class="mhp-filters" role="group" aria-label="Show">${[["all", "All"], ["unpaid", "Unpaid"], ["paid", "Paid"]].map(([k, l]) => `<button class="${MH_PF === k ? "on" : ""}" data-mhfilter="${k}" aria-pressed="${MH_PF === k}">${l}</button>`).join("")}</div>
    <div class="mhp-cols"><div class="mhp-list">${viz && MV_PVIEW === "cal" ? mvCalendar(F) + (pday ? grouped() : "") : grouped() || `<p class="fine">${F.rows.length ? "Nothing here." : "No bills yet - tap + Add bill."}</p>`}</div>
      <aside><section class="mhp-panel"><h3>✦ Cash Flow Preview</h3>
          <div class="mhp-row"><span>Current cash balance</span><strong data-mhpv="cash">${money(cash)}</strong></div>
          <div class="mhp-row"><span>Next paycheck</span><strong data-mhpv="check">${money(check)}</strong></div>
          <div class="mhp-row"><span>Bills before payday</span><strong>${money(F.before)}</strong></div><hr>
          <div class="mhp-label">PROJECTED REMAINING CASH</div><div class="mhp-remain ${F.remaining < 0 ? "neg" : ""}" data-mhpv="remain">${money(F.remaining)}</div>
          <form class="mhp-in" data-mhpaycash="1"><label>Current balance ($)<input name="cash" inputmode="decimal" value="${cash}" data-mhpin="cash"></label><label>Next paycheck ($)<input name="check" inputmode="decimal" value="${check}" data-mhpin="check"></label></form>
          <p class="mhp-mini">Cash + paycheck − every unpaid bill this month. Paid bills are assumed already out of your cash. Starts from your Accounts and Payday; type over them to try numbers.</p></section>
        <section class="mhp-panel"><h3>✨ Money Hub Insight</h3><div class="mhp-insight" data-mhpv="insight">${esc(payInsight(F))}</div></section>
        <section class="mhp-panel"><h3>📸 Snap a bill</h3><p class="mhp-mini" style="font-size:.85rem">Photograph a bill, check what we read, and it lands on this timeline.</p>
          <button class="mhp-action" data-mvkind="bill" data-mvadd="photo">📷 Snap a bill</button></section></aside></div>
    <p class="mhp-mini">Mark paid only records it - Money Hub never moves money. Pay ↗ opens the link you saved.</p></div>`;
}
// Typing in the two forecast boxes updates the numbers straight away (no redraw, so the cursor stays put); kept on change.
document.addEventListener("input", e => {
  const t = e.target; if (MODE !== "money" || !t || !t.dataset || !t.dataset.mhpin) return;
  const f = t.form, cash = amt(f.cash.value), check = amt(f.check.value), F = payForecast(today(), cash, check), set = (k, v) => { const el = document.querySelector(`#mhSheet [data-mhpv="${k}"]`); if (el) el.textContent = v; };
  set("cash", money(cash)); set("check", money(check)); set("remain", money(F.remaining)); set("insight", payInsight(F));
  const r = document.querySelector('#mhSheet [data-mhpv="remain"]'); if (r) r.classList.toggle("neg", F.remaining < 0);
});
document.addEventListener("change", e => {
  const t = e.target; if (MODE !== "money" || !t || !t.dataset || !t.dataset.mhpin) return;
  const M = mh(); M[t.dataset.mhpin === "cash" ? "payCash" : "payCheck"] = amt(t.value); save();
});

// ------------------------------------------------------------ v1.44 Goals & Savings (Scott's Money Hub board: goal cards with rings;
// the "Savings Islands" idea). Day Hub's S.goals ({name, target, saved}) + an icon and an optional by-date.
const GOAL_ICONS = ["🏝️", "🚢", "🏠", "🚗", "🛻", "✈️", "🎓", "💍", "🛡️", "🎁", "🏖️", "💰"];
// What to put away each month to hit a goal by its date. -> number or null
function goalMonthly(g, onDay) {
  if (!g.by || !(g.target > g.saved)) return null;
  const a = parseDay(onDay), b = parseDay(g.by), months = (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth() + (b.getDate() >= a.getDate() ? 0 : -1);
  return (g.target - g.saved) / Math.max(1, months);
}
function mhGoals() {
  const G = S.goals, saved = G.reduce((n, g) => n + (+g.saved || 0), 0), target = G.reduce((n, g) => n + (+g.target || 0), 0), t = today();
  return `<div class="mhp"><section class="mhp-hero"><div><div class="mhp-label">TOTAL SAVED</div><div class="mhp-big">${money(saved)}</div>
        <div class="mhp-pills"><div class="mhp-pill">Goals <b>${G.length}</b></div><div class="mhp-pill">Target <b class="sm">${usd(target)}</b></div>
          <div class="mhp-pill">Done <b>${G.filter(g => goalPct(g) >= 100).length}</b></div></div></div>
      ${typeof mvScene === "function" ? `<div class="mv-goalscene">${mvScene("goals")}<b>${target ? Math.round(saved / target * 100) : 0}%</b><small>of every goal</small></div>`
        : `<div class="mhp-orb" aria-hidden="true"><span style="font-size:5rem;position:relative;z-index:1">🏝️</span></div>`}</section>
    <div class="mhp-list" style="margin-top:14px">${G.map(g => { const pc = goalPct(g), mo = goalMonthly(g, t);
      const tone = ["#14b8a6", "#0ea5e9", "#f59e0b", "#3b82f6", "#ef4444", "#8b5cf6", "#6366f1", "#ec4899", "#22c55e", "#f43f5e", "#06b6d4", "#eab308"][Math.max(0, GOAL_ICONS.indexOf(g.icon))];   // v1.45 a colour per picture
      const pic = /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(g.pic || "") ? g.pic : "";   // v1.45 the goal's own photo (made on this phone)
      return `<article class="mhp-bill goal-card"><label class="mhp-sym mv-gpic" title="Add a photo" style="background:linear-gradient(145deg, ${tone}, color-mix(in srgb, ${tone} 45%, #000));box-shadow:0 0 14px color-mix(in srgb, ${tone} 50%, transparent)">${pic ? `<img src="${pic}" alt="">` : `<span aria-hidden="true">${esc(g.icon || "💰")}</span>`}
        <input type="file" accept="image/*" data-mvgoalpic="${g.id}" hidden aria-label="Photo for ${esc(g.name)}"><i aria-hidden="true">📷</i></label>
        <div class="mhp-det"><strong>${esc(g.name)}</strong><small>${money(g.saved)} of ${money(g.target)}${g.by ? ` · by ${mDate(g.by)}` : ""}</small>
          <div class="mv-gbar" aria-hidden="true"><i style="width:${pc}%"></i></div>
          ${mo ? `<small>${usd(mo)} a month gets you there</small>` : pc >= 100 ? `<small>🎉 You did it</small>` : ""}
          <form class="mhp-acts" data-mhgoaladd="${g.id}"><input name="amt" inputmode="decimal" placeholder="+ $" aria-label="Add to ${esc(g.name)}" style="width:80px;padding:6px 8px;border-radius:9px;background:#081c2e;border:1px solid #41617a;color:#fff">
            <button>Add</button><button type="button" data-mhgoaldel="${g.id}" aria-label="Remove ${esc(g.name)}">✕</button></form></div>
        ${hosRing(pc, `${pc}%`, "saved", pc >= 100 ? "#70e9b6" : "#27d7ff")}</article>`; }).join("")
      || `<p class="fine">A cruise, a truck, a rainy-day fund - give each goal a picture and watch it fill up.</p>`}</div>
    <form class="qa-form mhp-panel" data-mhgoal="1" style="margin-top:14px"><h3 style="margin:0">＋ New goal</h3>
      <div class="mhp-icons" role="radiogroup" aria-label="Picture">${GOAL_ICONS.map((ic, i) => `<label><input type="radio" name="icon" value="${ic}" ${i ? "" : "checked"}><span>${ic}</span></label>`).join("")}</div>
      <input name="name" placeholder="e.g. Caribbean cruise" required aria-label="Goal name">
      <div class="two"><input name="target" inputmode="decimal" placeholder="Target $" required aria-label="Target"><input name="saved" inputmode="decimal" placeholder="Saved so far $" aria-label="Saved so far"></div>
      <label class="field" style="margin:0">Reach it by (optional) <input type="date" name="by" aria-label="By date"></label>
      <button class="btn sm">Add goal</button></form></div>`;
}

// ------------------------------------------------------------ events (ui.js calls these first)
function mhClick(ds) {
  if (MODE !== "money") return false;
  if (typeof mvClick === "function" && mvClick(ds)) return true;      // v1.45 moneyviz.js
  if (ds.mhtab) { MH_MSG = ""; MH_IMPORT = null; MH_EDIT = null; showMh(ds.mhtab); return true; }
  if (ds.mhclose) { hideMh(); render(); return true; }
  const M = mh();
  if (ds.mhdel) { const [k, id] = ds.mhdel.split(":");
    if (k === "acct") M.accounts = M.accounts.filter(x => x.id !== id); else if (k === "tx") M.tx = M.tx.filter(x => x.id !== id);
    else if (k === "sub") M.subs = M.subs.filter(x => x.id !== id); else if (k === "bill") { S.bills = S.bills.filter(x => x.id !== id); MH_PEDIT = null; }
    save(); showMh(); render(); return true; }
  if (ds.mhpaid) { const b = S.bills.find(x => x.id === ds.mhpaid); if (!b) return true;   // v1.43: paid for THIS month; records only
    const m = ym(today()); b.paid = m;
    const n = addTx([{ date: today(), amt: -(Number(b.amount) || 0), what: b.name, cat: b.cat || "bills", src: `bill ${m}`, bill: b.id }]);
    save(); showMh("bills"); render(); toast(`💳 ${b.name} paid${n ? " - logged in Spending" : ""}`); return true; }
  if (ds.mhunpaid) { const b = S.bills.find(x => x.id === ds.mhunpaid); if (!b) return true;
    const m = ym(today()), d = parseDay(m + "-01"); d.setMonth(d.getMonth() - 1); b.paid = ymd(d).slice(0, 7);
    M.tx = M.tx.filter(x => !(x.bill === b.id && x.src === `bill ${m}`));
    save(); showMh("bills"); render(); toast(`↩️ ${b.name} back to unpaid`); return true; }
  if (ds.mhgoaldel) { S.goals = S.goals.filter(g => g.id !== ds.mhgoaldel); save(); showMh("goals"); render(); return true; }
  if (ds.mhfilter) { MH_PF = ds.mhfilter; showMh("bills"); return true; }
  if (ds.mhpadd) { MH_PADD = !MH_PADD; MH_PEDIT = null; showMh("bills"); return true; }
  if (ds.mhbilledit !== undefined) { MH_PEDIT = ds.mhbilledit || null; MH_PADD = false; showMh("bills"); return true; }
  if (ds.mhsubren) { const s = M.subs.find(x => x.id === ds.mhsubren); if (!s) return true;
    const from = s.next && s.next > today() ? s.next : today(); s.next = s.every === "year" ? addMonthsDayM(from, 12) : s.every === "week" ? addDays(from, 7) : addMonthsDayM(from, 1);
    addTx([{ date: today(), amt: -s.amt, what: s.name, cat: "subs", src: "subscription" }]); save(); showMh("subs"); render(); toast(`🔁 ${s.name} renewed to ${mDate(s.next)}`); return true; }
  if (ds.mhsuboff) { const s = M.subs.find(x => x.id === ds.mhsuboff); if (!s) return true; s.off = today(); save(); showMh("subs"); render();
    toast(`✂️ ${s.name} cancelled - ${usd(subMonthly(s) * 12)} a year back`); return true; }
  if (ds.mhbudgetoff) { delete M.budgets[ds.mhbudgetoff]; save(); showMh("budget"); render(); return true; }
  if (ds.mhplanreset) { M.plan = {}; save(); showMh("payday"); return true; }
  if (ds.mhimportno) { MH_IMPORT = null; showMh("spend"); return true; }
  if (ds.mhedit) { MH_EDIT = ds.mhedit; showMh("spend"); return true; }
  return false;
}
// Same day-of-month n months on (no Auto Hub dependency).
function addMonthsDayM(day, n) {
  const d = parseDay(day), x = new Date(d.getFullYear(), d.getMonth() + Number(n), 1), last = new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate();
  x.setDate(Math.min(d.getDate(), last)); return ymd(x);
}
function mhSubmit(f, data) {
  if (MODE !== "money") return false;
  if (typeof mvSubmit === "function" && mvSubmit(f, data)) return true;   // v1.45 moneyviz.js
  const M = mh(), day = v => /^\d{4}-\d{2}-\d{2}$/.test(v || "") ? v : today(), pos = v => Math.abs(amt(v));
  if (f.dataset.mhsetup) {
    S.name = String(data.name || "").trim().slice(0, 30); M.setup = today();
    if (String(data.bal || "").trim()) M.accounts.push({ id: uid(), kind: "checking", name: "Checking", bal: amt(data.bal), at: today() });
    if (data.freq && PAY_FREQ[data.freq] && /^\d{4}-\d{2}-\d{2}$/.test(data.next || "")) { S.payday.freq = data.freq; S.payday.next = data.next; if (pos(data.check)) S.payday.amount = pos(data.check); }
    save(); render(); toast("💰 Money Hub is ready"); return true; }
  if (f.dataset.mhquick || f.dataset.mhtx) { const a = pos(data.amt); if (!a) { MH_MSG = "Type an amount."; mhMsgShow(); return true; }
    const inn = data.dir === "in", what = String(data.what || "").trim().slice(0, 80), cat = data.cat || (inn ? "income" : catGuess(what));
    M.tx.push({ id: uid(), date: day(data.date), amt: inn ? a : -a, what, cat, acct: "" }); MH_MSG = ""; save(); render();
    if (f.dataset.mhtx) showMh("spend"); toast(`${inn ? "💵" : mcat(cat)[1]} ${usd(a)} ${inn ? "in" : "logged"}`); return true; }
  if (f.dataset.mhacct) { if (!mhCanAddAcct()) return true; const name = String(data.name || "").trim(); if (!name) return true;
    const kind = MH_ACCTS.some(x => x[0] === data.kind) ? data.kind : "checking";
    M.accounts.push({ id: uid(), kind, name: name.slice(0, 40), bal: ["credit", "loan"].includes(kind) ? pos(data.bal) : amt(data.bal), apr: pos(data.apr) || 0, min: pos(data.min) || 0, at: today() });
    save(); showMh("accounts"); render(); toast(`${macct(kind)[1]} ${name} added`); return true; }
  if (f.dataset.mhbal) { const a = M.accounts.find(x => x.id === f.dataset.mhbal); if (!a) return true;
    a.bal = ["credit", "loan"].includes(a.kind) ? pos(data.bal) : amt(data.bal); a.at = today(); save(); showMh("accounts"); render(); toast(`${a.name}: ${usd(a.bal)}`); return true; }
  // paid = the "paid through" month, as Day Hub: added after this month's due day = this month handled
  if (f.dataset.mhbill) { const name = String(data.name || "").trim(), d = Math.round(Number(data.day)), a = pos(data.amount);
    if (!name || !a || !(d >= 1 && d <= 31)) { MH_MSG = "Add the name, amount and the day of the month it's due."; mhMsgShow(); return true; }
    S.bills.push({ id: uid(), name: name.slice(0, 60), amount: a, day: d, paid: d < new Date().getDate() ? ym(today()) : prevMonthKey(), auto: !!data.auto, cat: MH_CATS.some(x => x[0] === data.cat) ? data.cat : "bills", url: safeUrl(data.url) });
    MH_MSG = ""; MH_PADD = false; save(); showMh("bills"); render(); toast(`💳 ${name} added`); return true; }
  if (f.dataset.mhbillsave) { const b = S.bills.find(x => x.id === f.dataset.mhbillsave); if (!b) return true;
    const name = String(data.name || "").trim(), d = Math.round(Number(data.day)), a = Math.abs(amt(data.amount));
    if (!name || !a || !(d >= 1 && d <= 31)) { MH_MSG = "Add the name, amount and the day of the month it's due."; mhMsgShow(); return true; }
    if (String(data.url || "").trim() && !safeUrl(data.url)) { MH_MSG = "The pay page link must start with https://"; mhMsgShow(); return true; }
    Object.assign(b, { name: name.slice(0, 60), amount: a, day: d, auto: !!data.auto, cat: MH_CATS.some(x => x[0] === data.cat) ? data.cat : "bills", url: safeUrl(data.url) });
    MH_PEDIT = null; MH_MSG = ""; save(); showMh("bills"); render(); toast(`💳 ${b.name} saved`); return true; }
  if (f.dataset.mhgoal) { const name = String(data.name || "").trim(), tgt = Math.abs(amt(data.target)); if (!name || !tgt) { MH_MSG = "Add a name and a target."; mhMsgShow(); return true; }
    S.goals.push({ id: uid(), name: name.slice(0, 50), target: tgt, saved: Math.abs(amt(data.saved)), icon: GOAL_ICONS.includes(data.icon) ? data.icon : "💰", by: /^\d{4}-\d{2}-\d{2}$/.test(data.by || "") ? data.by : "" });
    MH_MSG = ""; save(); showMh("goals"); render(); toast(`🏝️ ${name} - let's go`); return true; }
  if (f.dataset.mhgoaladd) { const g = S.goals.find(x => x.id === f.dataset.mhgoaladd), a = amt(data.amt); if (!g || !a) return true;
    g.saved = Math.max(0, Math.round((g.saved + a) * 100) / 100); save(); showMh("goals"); render(); toast(goalPct(g) >= 100 ? `🎉 ${g.name} reached!` : `${g.icon || "💰"} ${usd(g.saved)} saved toward ${g.name}`); return true; }
  if (f.dataset.mhpaycash) { const M2 = mh(); M2.payCash = amt(data.cash); M2.payCheck = amt(data.check); save(); showMh("bills"); return true; }
  if (f.dataset.mhbudget) { const k = MH_CATS.some(x => x[0] === data.cat) ? data.cat : null, lim = pos(data.lim); if (!k || !lim) return true;
    M.budgets[k] = lim; save(); showMh("budget"); render(); toast(`🎯 ${mcat(k)[2]}: ${usd(lim)} a month`); return true; }
  if (f.dataset.mhdebt) { M.debt = { extra: pos(data.extra), method: data.method === "snowball" ? "snowball" : "avalanche" }; save(); showMh("debt"); return true; }
  if (f.dataset.mhsub) { const name = String(data.name || "").trim(), a = pos(data.amt); if (!name || !a) return true;
    M.subs.push({ id: uid(), name: name.slice(0, 50), amt: a, every: ["month", "year", "week"].includes(data.every) ? data.every : "month", next: /^\d{4}-\d{2}-\d{2}$/.test(data.next || "") ? data.next : "" });
    save(); showMh("subs"); render(); toast(`🔁 ${name} added`); return true; }
  if (f.dataset.mhplan) { M.plan = { start: amt(data.start), check: amt(data.check), bills: amt(data.bills), other: amt(data.other), save: amt(data.save) }; save(); showMh("payday"); return true; }
  if (f.dataset.mhimport) { if (!MH_IMPORT) return true; const n = addTx(MH_IMPORT.rows.map(r => ({ ...r, src: "CSV" })), data.acct || ""); MH_IMPORT = null;
    save(); showMh("spend"); render(); toast(`📥 ${n} transaction${n === 1 ? "" : "s"} added`); return true; }
  if (f.dataset.mhtxcat) { const x = M.tx.find(y => y.id === f.dataset.mhtxcat); if (x && data.cat) x.cat = data.cat; MH_EDIT = null; save(); showMh("spend"); render(); return true; }
  return false;
}
document.addEventListener("change", async e => {
  const t = e.target; if (MODE !== "money" || !t || !t.dataset || !t.dataset.mhcsv || !t.files || !t.files[0]) return;
  const file = t.files[0]; t.value = "";
  if (file.size > 5e6) { MH_MSG = "That file is too big (over 5 MB)."; mhMsgShow(); return; }
  const r = parseCsv(await file.text());
  if (r.error) { MH_MSG = r.error; mhMsgShow(); return; }
  MH_IMPORT = { name: file.name, rows: r.rows }; MH_MSG = ""; showMh("spend");
});

// ------------------------------------------------------------ Life pulse + what the AI reads
function mhPulse(add) {
  if (MODE !== "money" || !mhSet()) return;
  const t = today();
  budgetRows(ym(t)).filter(r => r.status === "over").forEach(r => add(7, mcat(r.cat)[1], `${mcat(r.cat)[2]} is ${usd(-r.left)} over its ${usd(r.lim)} budget this month`, null));
  mh().subs.filter(s => !s.off && s.next && daysUntil(s.next) >= 0 && daysUntil(s.next) <= 3).forEach(s => add(5, "🔁", `${s.name} renews ${inDays(daysUntil(s.next))} (${usd(s.amt)})`, null));
  const nx = payNext(t); if (nx && cashNow() > 0) { const due = dueBetween(t, nx).reduce((n, o) => n + o.amt, 0);
    if (due > cashNow()) add(11, "⚠️", `Bills before payday (${usd(due)}) are more than your cash (${usd(cashNow())})`, null); }
}
function mhContext() {
  if (!mhSet()) return {};
  const t = today(), M = mh(), months = [0, 1, 2, 3].map(k => { const d = parseDay(ym(t) + "-01"); d.setMonth(d.getMonth() - k); return ymd(d).slice(0, 7); });
  return { cashAvailable: +cashNow().toFixed(2), netWorth: +netWorth().toFixed(2),
    accounts: M.accounts.map(a => ({ name: a.name, kind: macct(a.kind)[2], balance: a.bal, apr: a.apr || undefined, minPayment: a.min || undefined, updated: a.at })),
    months: months.map(mm => { const x = monthTotals(mm); return { month: mm, moneyIn: +x.inc.toFixed(2), moneyOut: +x.out.toFixed(2), byCategory: Object.fromEntries(Object.entries(x.byCat).map(([k, v]) => [mcat(k)[2], +v.toFixed(2)])) }; }),
    budgets: budgetRows(ym(t)).map(r => ({ category: mcat(r.cat)[2], limit: r.lim, spent: +r.spent.toFixed(2) })),
    subscriptions: M.subs.map(s => ({ name: s.name, cost: s.amt, every: s.every, renews: s.next || undefined, cancelled: s.off || undefined })),
    recent: M.tx.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30).map(x => ({ date: x.date, amount: x.amt, what: x.what || undefined, category: mcat(x.cat)[2] })) };
}
