/* SAVE AS: moneyviz.js · LOCATION: C:/MarvelApps/dayhub/moneyviz.js
 * MONEY HUB - THE CONTROL ROOM (v1.45, Scott 10/16: "work on newest app ... new graphics and robust visual concepts i gave
 * you - build money app"). Built to the Hub OS artwork bundle (C:/MarvelDesktop/docs/HUB_OS_LIVING_PAGES_FROM_OUTSIDE_CHAT_
 * 2026-10-16_ART.md - "Money Hub detailed screens": Home hero, Upcoming Payments, Transactions, Add by Photo, Goals & Savings,
 * + the feature strip Smart Insights / Subscription Tracker / Cash Forecast / Document Vault / Shared Accounts / Reports).
 * Visual layer only - the money math stays in money.js; this file reads it.
 *   Home: Total balance card over a night-island scene (drawn here, no image files), eye to hide amounts, 4 action bubbles,
 *         account cards, Due soon, the month's rings, feature tiles. The v1.44 Money Orbit stays one tap away.
 *   Bottom bar (Home · Payments · ＋ · Goals · More) - the ＋ is Add: by photo, by hand, or by voice.
 *   Add by Photo: receipt / bill / pay stub / document -> the AI reads it (relay "mscan", falls back to "scan") -> the
 *         owner checks every field -> filed (Transactions, Payments, income, Vault). Never saved from the AI alone.
 *         No AI credits: the photo still comes up and the owner types what it says.
 *   Transactions: search, filter chips, This week / Last week / by month, with totals.
 *   Cash Forecast: day by day for 60 days - paydays in, bills and renewals out, optional everyday spending. Estimates.
 *   Smart Insights: computed from the owner's own log, each with its math; dismiss for 30 days.
 *   Document Vault: photos of receipts, bills, tax and insurance papers - IndexedDB on this phone, not in the backup.
 * Loaded after money.js, before ui.js (money mode only).
 */
"use strict";
let MV_VIEW = "room", MV_ADD = "photo", MV_KIND = "receipt", MV_SCAN = null, MV_TF = "all", MV_TC = "", MV_Q = "", MV_MORE = 60;
let MV_PDAY = "", MV_PVIEW = "list", MV_FCI = -1, MV_VT = "receipt", MV_BIG = null;

// ------------------------------------------------------------ small helpers
const mvHidden = () => !!mh().hide;
const mv$ = n => mvHidden() ? "$•••••" : usd(n);
const mvSign = n => (n < 0 ? "−" : "+") + usd(Math.abs(n));
const MV_ACCT_TONE = { checking: "#3b82f6", savings: "#22c55e", cash: "#10b981", wallet: "#00d54b", credit: "#a855f7", loan: "#ef4444", invest: "#f59e0b" };
// Well-known payees get their own tint (a colour, never a logo).
const MV_BRANDS = [[/netflix/i, "#e50914"], [/spotify/i, "#1db954"], [/amazon|prime video/i, "#ff9900"], [/starbucks/i, "#00704a"], [/uber(?! ?eats)|lyft/i, "#111827"],
  [/mcdonald/i, "#da291c"], [/youtube/i, "#ff0000"], [/walmart/i, "#0071ce"], [/target/i, "#cc0000"], [/kroger/i, "#2563eb"], [/whole foods/i, "#00674b"], [/apple|icloud/i, "#6b7280"],
  [/shell|exxon|chevron/i, "#f2c200"], [/costco/i, "#e31837"], [/hulu/i, "#1ce783"], [/disney/i, "#113ccf"]];
const mvTone = (what, cat) => (MV_BRANDS.find(([re]) => re.test(what || "")) || [0, MH_TONES[cat] || "#64748b"])[1];
const mvIc = (icon, tone, cls = "") => `<span class="mv-ic ${cls}" style="--tone:${tone}" aria-hidden="true">${icon}</span>`;
const mvWeekStart = d => { const x = parseDay(d), k = (x.getDay() + 6) % 7; x.setDate(x.getDate() - k); return ymd(x); };   // Monday
const mvRel = d => { const n = daysUntil(d); return n === 0 ? "Today" : n === -1 ? "Yesterday" : n === 1 ? "Tomorrow" : mDate(d); };
const MV_SPEECH = () => typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);

// ------------------------------------------------------------ the scene behind the balance (Scott's art: a glowing house on a
// floating island at night, a waterfall, stars). SVG, no image files; motion stops under "reduce motion" (styles.css).
function mvScene(kind) {
  const goals = kind === "goals";
  return `<svg class="mv-scene" viewBox="0 0 400 220" preserveAspectRatio="xMaxYMid slice" aria-hidden="true" focusable="false">
    <defs><linearGradient id="mvSky${kind}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0a1440"/><stop offset=".6" stop-color="#1b2a6b"/><stop offset="1" stop-color="#14306a"/></linearGradient>
      <radialGradient id="mvGlow${kind}" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffd27a" stop-opacity=".9"/><stop offset="1" stop-color="#ffd27a" stop-opacity="0"/></radialGradient>
      <linearGradient id="mvFall${kind}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9be7ff"/><stop offset="1" stop-color="#2fb6ff" stop-opacity=".2"/></linearGradient>
      <linearGradient id="mvRock${kind}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b3f78"/><stop offset="1" stop-color="#151a3f"/></linearGradient></defs>
    <rect width="400" height="220" fill="url(#mvSky${kind})"/>
    ${[[30, 20], [80, 44], [140, 16], [205, 36], [262, 14], [318, 30], [372, 18], [352, 62], [118, 70], [236, 66]].map(([x, y], i) => `<circle class="mv-star" style="--d:${(i * .4).toFixed(1)}s" cx="${x}" cy="${y}" r="${i % 3 ? 1.2 : 1.8}" fill="#fff"/>`).join("")}
    <circle cx="292" cy="40" r="13" fill="#fff6d6" opacity=".9"/><circle cx="298" cy="36" r="11" fill="url(#mvSky${kind})" opacity=".85"/>
    <path d="M0 170 L60 128 L110 160 L170 118 L230 162 L290 126 L350 158 L400 134 L400 220 L0 220Z" fill="#101a4a" opacity=".85"/>
    <g class="mv-isle"><g transform="translate(18 6)">
      <ellipse cx="292" cy="196" rx="70" ry="10" fill="#2fb6ff" opacity=".18"/>
      <path d="M210 150 Q292 136 372 150 L350 170 Q318 206 292 210 Q262 204 236 172Z" fill="url(#mvRock${kind})"/>
      <path d="M206 150 Q292 132 376 150 Q372 158 360 156 Q292 146 220 158 Q208 158 206 150Z" fill="#27c46b"/>
      <rect class="mv-fall" x="352" y="152" width="9" height="56" rx="4" fill="url(#mvFall${kind})"/>
      <circle cx="285" cy="122" r="44" fill="url(#mvGlow${kind})" opacity=".55"/>
      ${goals ? `<g transform="translate(250 92)"><rect x="0" y="22" width="70" height="34" rx="3" fill="#e9eef8"/><path d="M-6 24 L35 0 L76 24Z" fill="#5468c9"/>
          <rect x="10" y="32" width="14" height="12" rx="1.5" fill="#ffcf6b"/><rect x="46" y="32" width="14" height="12" rx="1.5" fill="#ffcf6b"/><rect x="30" y="38" width="10" height="18" rx="1.5" fill="#7a4e2d"/></g>`
      : `<g transform="translate(244 86)"><rect x="0" y="26" width="84" height="38" rx="3" fill="#dfe6f5"/><rect x="40" y="10" width="44" height="18" rx="2" fill="#cfd8ec"/>
          <path d="M-6 28 L84 28 L84 22 L-2 22Z" fill="#3c4a8f"/><path d="M36 12 L88 12 L88 7 L38 7Z" fill="#3c4a8f"/>
          <rect class="mv-win" x="8" y="34" width="22" height="16" rx="1.5" fill="#ffd27a"/><rect class="mv-win" style="--d:1.3s" x="36" y="34" width="22" height="16" rx="1.5" fill="#ffcf6b"/>
          <rect class="mv-win" style="--d:2.1s" x="48" y="14" width="30" height="10" rx="1.5" fill="#ffe2a0"/><rect x="64" y="40" width="12" height="24" rx="1.5" fill="#6b4226"/></g>`}
      <g fill="#1f9d57"><path d="M222 150 l8 -26 l8 26Z"/><path d="M232 152 l6 -18 l6 18Z" fill="#167a45"/><path d="M344 148 l7 -24 l7 24Z"/><path d="M356 150 l5 -15 l5 15Z" fill="#167a45"/></g>
    </g></g>
    <g class="mv-coin"><circle cx="372" cy="104" r="8" fill="#ffc83d"/><circle cx="372" cy="104" r="5" fill="none" stroke="#c98a00" stroke-width="1.5"/></g>
  </svg>`;
}

// ------------------------------------------------------------ HOME: the control room (the art's first phone)
const MV_FEATURES = [["advisor", "🧭", "Money Advisor", "Can I afford it? Ask anything"], ["flow", "🌊", "Cash Flow", "In, out, and what's spare"], ["connect", "🔗", "Connect", "Bank, Cash App, Venmo, PayPal"], ["insights", "💡", "Smart Insights", "What changed and why"], ["subs", "📅", "Subscriptions", "Never miss a renewal"],
  ["forecast", "📈", "Cash Forecast", "Your next 60 days"], ["vault", "🔐", "Document Vault", "Receipts & papers, safe"],
  ["reports", "📊", "Reports", "The bigger picture"], ["budget", "🎯", "Budget", "Limits that warn you"], ["debt", "⛓️", "Debt payoff", "The fastest way out"],
  ["shared", "👥", "Shared Accounts", "Coming soon"]];
// $2,043.67 -> "$2.0k" so it fits inside a ring; under $1,000 stays exact
const mvK = v => Math.abs(v) >= 1000 ? `${v < 0 ? "−" : ""}$${(Math.abs(v) / 1000).toFixed(Math.abs(v) >= 10000 ? 0 : 1)}k` : usd(v);
function mvHomeHtml() {
  if (MV_VIEW === "orbit") return null;                       // money.js draws the v1.44 orbit
  const t = today(), M = mh(), T = monthTotals(ym(t)), P = payRows(t), un = P.filter(r => !r.paid), nx = payNext(t), next = mhNext(t);
  const owed = M.accounts.filter(a => ["credit", "loan"].includes(a.kind)).reduce((n, a) => n + (+a.bal || 0), 0), net = T.inc - T.out;
  const soon = un.filter(r => daysUntil(r.due) <= 7).slice(0, 3), paidPct = P.length ? (P.length - un.length) / P.length * 100 : 0;
  const free = T.inc - T.out - billsLeft(t), cats = Object.entries(T.byCat).sort((a, b) => b[1] - a[1]).slice(0, 5), top = cats.length ? cats[0][1] : 0;
  const ins = mvInsights(t).length;
  const acct = a => `<button class="mv-acct" data-mhtab="accounts" style="--tone:${MV_ACCT_TONE[a.kind] || "#3b82f6"}">${mvIc(macct(a.kind)[1], MV_ACCT_TONE[a.kind] || "#3b82f6")}
      <span><small>${esc(a.name)}</small><b>${["credit", "loan"].includes(a.kind) && !mvHidden() ? "−" : ""}${mv$(+a.bal || 0)}</b></span></button>`;
  return `<section class="card mv-home" aria-label="Money Hub">
    <div class="mv-bal">${mvScene("home")}
      <div class="mv-bal-in"><div class="mv-bal-top"><span class="mv-brand">💰 Money <b>Hub</b></span>
          <button class="mv-eye" data-mveye="1" aria-pressed="${mvHidden()}" aria-label="${mvHidden() ? "Show amounts" : "Hide amounts"}">${mvHidden() ? "🙈" : "👁️"}</button></div>
        <small>Total balance</small><b class="mv-big">${mv$(netWorth())}</b>
        <span class="mv-delta ${net < 0 ? "down" : "up"}">${net < 0 ? "▼" : "▲"} ${mvHidden() ? "•••" : usd(Math.round(Math.abs(net)))} ${net < 0 ? "more out than in" : "net"} this month</span>
        <div class="mv-mini"><span>Cash available <b>${mv$(cashNow())}</b></span>${owed ? `<span>Owed <b>${mv$(owed)}</b></span>` : ""}</div>
        <span class="mv-pay">${nx ? `💵 Next payday ${mDate(nx)} (${inDays(daysUntil(nx))})` : "💵 Set your payday to see the forecast"}</span></div></div>
    <div class="mv-acts">${[["mvadd", "manual", "＋", "Spent", "#3b82f6"], ["mvadd", "photo", "📷", "Scan", "#22c55e"], ["mvadd", "income", "💵", "Money in", "#14b8a6"], ["mhtab", "insights", "✨", "Insights", "#a855f7"]]
      .map(([k, v, i, l, c]) => `<button data-${k === "mvadd" ? "mvadd" : "mhtab"}="${v}" style="--tone:${c}"><span aria-hidden="true">${i}</span>${l}${v === "insights" && ins ? `<i class="mv-dot">${ins}</i>` : ""}</button>`).join("")}</div>
    <button class="hos-next" data-mhtab="${next.tab}"><span class="hos-next-ic" aria-hidden="true">${next.icon}</span><span class="grow"><small>Your next smart action</small><b>${esc(next.text)}</b><em>Why: ${esc(next.why)}</em></span><span class="hos-go" aria-hidden="true">›</span></button>
    <div class="mv-sec"><h3>Accounts</h3><button data-mhtab="accounts">${M.accounts.length > 4 ? `See all ${M.accounts.length}` : M.accounts.length ? "See all" : "Add"}</button></div>
    <div class="mv-accts">${M.accounts.slice(0, 4).map(acct).join("")}${M.accounts.length < 4 ? `<button class="mv-acct mv-acct-add" data-mhtab="accounts">${mvIc("＋", "#64748b")}<span><small>Add an account</small><b>Checking, card…</b></span></button>` : ""}</div>
    ${mvFreshStrip()}
    <div class="mv-sec"><h3>Due soon</h3><button data-mhtab="bills">${un.length ? `${un.length} unpaid` : "Payments"}</button></div>
    ${soon.length ? `<div class="mv-due">${soon.map(r => { const d = daysUntil(r.due), tone = mvTone(r.b.name, r.b.cat);
        return `<button class="mv-due-row" data-mhtab="bills">${mvIc(PAY_ICONS[r.b.cat] || mcat(r.b.cat || "bills")[1], tone)}<span class="grow"><b>${esc(r.b.name)}</b><small>${usd(+r.b.amount || 0)}${r.b.auto ? " · autopay" : ""}</small></span>
          <em class="${d < 0 ? "late" : d <= 1 ? "warn" : ""}">${d < 0 ? "Late" : d === 0 ? "Today" : d === 1 ? "Tomorrow" : `In ${d} days`}</em></button>`; }).join("")}</div>`
      : `<p class="hos-hint">${S.bills.length ? "✅ Nothing due in the next 7 days." : "Add your bills and they show up here before they're due."}</p>`}
    <div class="hos-rings mv-rings-tap"><button data-mhtab="bills" aria-label="Payments">${hosRing(paidPct, P.length ? `${Math.round(paidPct)}%` : "–", "bills paid", "#70e9b6")}</button>
      <button data-mhtab="spend" aria-label="Transactions">${hosRing(T.inc ? T.out / T.inc * 100 : 0, mvHidden() ? "•••" : mvK(T.out), "spent this month", T.inc && T.out > T.inc ? "#ff978f" : "#27d7ff")}</button>
      <button data-mhtab="flow" aria-label="Cash Flow">${hosRing(T.inc ? Math.max(0, free) / T.inc * 100 : 0, mvHidden() ? "•••" : mvK(Math.max(0, free)), free < 0 ? `${mvHidden() ? "" : usd(-free) + " "}short` : "safe to spend", free < 0 ? "#ff978f" : "#facc15")}</button></div>
    <div class="mv-sec"><h3>Spending this month</h3><button data-mhtab="spend">Transactions</button></div>
    ${cats.length ? `<div class="hos-cats">${cats.map(([k, v]) => `<div class="hos-cat" style="--tone:${MH_TONES[k] || "#94a3b8"}"><span class="hos-ic" aria-hidden="true">${mcat(k)[1]}</span><div class="grow"><b>${esc(mcat(k)[2])}</b><i style="width:${Math.max(6, Math.round(v / top * 100))}%"></i></div><strong>${usd(v)}</strong></div>`).join("")}</div>`
      : `<p class="hos-hint">Log what you spend - or snap a receipt - and your categories light up here.</p>`}
    <form class="hos-quick" data-mhquick="1"><input name="amt" inputmode="decimal" placeholder="$ spent" aria-label="Amount spent" required>
      <input name="what" placeholder="What for" aria-label="What for"><select name="cat" aria-label="Category"><option value="">Guess it</option>${catOpts("")}</select><button class="hos-btn" aria-label="Log spending">＋</button></form>
    <div class="mv-sec"><h3>More powerful together</h3></div>
    <div class="mv-feats">${MV_FEATURES.map(([k, i, l, s]) => `<button class="mv-feat" ${k === "shared" ? 'data-mvsoon="Shared accounts"' : `data-mhtab="${k}"`}><span class="mv-feat-ic" aria-hidden="true">${i}</span><b>${l}</b><small>${s}</small>${k === "shared" ? `<i class="mv-soon">SOON</i>` : ""}</button>`).join("")}</div>
    <button class="mv-switch" data-mvview="orbit">🪐 Orbit view</button>
  </section>`;
}

// ------------------------------------------------------------ the bottom bar (art: Home · Payments · ＋ · Goals · More)
const MV_NAV = [["home", "🏠", "Home"], ["bills", "💳", "Payments"], ["add", "＋", "Add"], ["goals", "🏝️", "Goals"], ["more", "☰", "More"]];
const mvNavFor = tab => tab === "bills" || tab === "goals" || tab === "add" ? tab : tab === "home" ? "home" : "more";
function mvNavHtml(on) {
  return MV_NAV.map(([k, i, l]) => `<button class="${mvNavFor(on) === k ? "on" : ""} ${k === "add" ? "mv-plus" : ""}" ${k === "home" ? (on === "home" ? 'data-mvtop="1"' : 'data-mhclose="1"') : `data-mhtab="${k}"`}
    aria-current="${mvNavFor(on) === k ? "page" : "false"}" aria-label="${l}"><span aria-hidden="true">${i}</span>${k === "add" ? "" : l}</button>`).join("");
}
function mvNavEnsure() {
  if (typeof document === "undefined") return;
  document.body.classList.toggle("mv", mhSet()); document.body.classList.add("mvapp");
  let n = document.getElementById("mvNav");
  if (!mhSet()) { if (n) n.remove(); return; }
  if (!n) { n = document.createElement("nav"); n.id = "mvNav"; n.className = "mv-nav"; n.setAttribute("aria-label", "Money Hub"); document.body.appendChild(n); }
  n.innerHTML = mvNavHtml("home");
}

// ------------------------------------------------------------ MORE: every section as big tiles (Scott 10/5 tile nav)
const MV_MORE_TILES = [["advisor", "🧭", "Advisor"], ["update", "🔄", "Data Update"], ["spend", "🧾", "Transactions"], ["connect", "🔗", "Connect"], ["flow", "🌊", "Cash Flow"], ["accounts", "🏦", "Accounts"], ["budget", "🎯", "Budget"], ["debt", "⛓️", "Debt"], ["subs", "📅", "Subscriptions"],
  ["payday", "💵", "Payday"], ["forecast", "📈", "Cash Forecast"], ["insights", "💡", "Insights"], ["vault", "🔐", "Vault"], ["reports", "📊", "Reports"], ["goals", "🏝️", "Goals"], ["bills", "💳", "Payments"]];
const mvMoreHtml = () => tileNav(MV_MORE_TILES.map(([k, i, l]) => ({ icon: i, label: l, attrs: `data-mhtab="${k}"` })), 3, "mv-tiles") +
  `<p class="fine">Connect pulls in your bank, cards, Cash App, Venmo and PayPal from their downloaded files - on this phone, never a password. Shared accounts (two people, one money picture) are on the way.</p>`;

// ------------------------------------------------------------ ADD: by photo, by hand, by voice (the art's "Add by Photo")
const MV_KINDS = [["receipt", "🧾", "Receipt"], ["bill", "💳", "Bill"], ["paystub", "💵", "Pay stub"], ["document", "📄", "Document"]];
const MV_DOCS = [["receipt", "🧾", "Receipt"], ["bill", "💳", "Bill / statement"], ["tax", "🏛️", "Tax"], ["insurance", "🛡️", "Insurance"], ["warranty", "🧰", "Warranty"], ["paystub", "💵", "Pay stub"], ["other", "📄", "Other"]];
function mvAddHtml() {
  if (MV_SCAN) return mvReviewHtml();
  const seg = [["photo", "📷", "Photo"], ["manual", "✍️", "Manual"], ...(MV_SPEECH() ? [["voice", "🎤", "Voice"]] : [])];
  const head = `<div class="mv-seg" role="group" aria-label="How">${seg.map(([k, i, l]) => `<button class="${MV_ADD === k ? "on" : ""}" data-mvadd="${k}" aria-pressed="${MV_ADD === k}">${i} ${l}</button>`).join("")}</div>`;
  if (MV_ADD === "photo") return head + `<div class="mv-kinds" role="group" aria-label="What is it">${MV_KINDS.map(([k, i, l]) => `<button class="${MV_KIND === k ? "on" : ""}" data-mvkind="${k}" aria-pressed="${MV_KIND === k}"><span aria-hidden="true">${i}</span>${l}</button>`).join("")}</div>
    <div class="mv-finder"><i></i><i></i><i></i><i></i><div class="mv-paper" aria-hidden="true">${MV_KIND === "paystub" ? "💵" : MV_KIND === "bill" ? "💡" : MV_KIND === "document" ? "📄" : "🧾"}<span></span><span></span><span></span><b></b></div>
      <p>${{ receipt: "Snap the whole receipt - we read the store, total and date.", bill: "Snap the bill - we read who, how much and when it's due.", paystub: "Snap your pay stub - we read the take-home pay and the date.", document: "Snap any money paper - it goes in your Document Vault." }[MV_KIND]}</p></div>
    <div class="mv-shoot"><label class="btn">📷 Take a photo<input type="file" accept="image/*" capture="environment" data-mvphoto="1" hidden></label>
      <label class="btn ghost">🖼️ Choose a photo<input type="file" accept="image/*" data-mvphoto="1" hidden></label></div>
    <p class="fine">${aiOn() ? "✨ The AI reads it (1 AI credit), then you check every number before anything is saved." : "Reading the photo uses Hub AI Credits (⚙ Settings). Without them you still get the photo and type what it says."}</p>`;
  if (MV_ADD === "voice") return head + `<div class="mv-voice"><button class="mv-mic" data-mvmic="1" aria-label="Start talking">🎤</button>
      <p>Tap and say it like you'd tell a friend:<br><b>“45 dollars at Kroger”</b> · <b>“got paid 1,200”</b> · <b>“12.50 for lunch”</b></p><p class="fine" id="mvHeard"></p></div>` + mvManualForm();
  return head + mvManualForm();
}
const mvManualForm = (v = {}) => `<form class="qa-form mv-form" data-mhtx="1" data-mvfrom="add"><div class="mv-seg sm" role="group" aria-label="Money in or out">
      <label><input type="radio" name="dir" value="out" ${v.dir !== "in" ? "checked" : ""}><span>− Spent</span></label><label><input type="radio" name="dir" value="in" ${v.dir === "in" ? "checked" : ""}><span>+ Money in</span></label></div>
    <input name="amt" class="mv-amt" inputmode="decimal" placeholder="$0.00" required aria-label="Amount" value="${v.amt || ""}">
    <div class="two"><input name="what" placeholder="What for, e.g. Kroger" aria-label="What for" value="${esc(v.what || "")}"><input type="date" name="date" value="${today()}" aria-label="Date"></div>
    <select name="cat" aria-label="Category"><option value="">Category: guess it</option>${catOpts(v.cat || "", true)}</select>
    <button class="btn">Add to Transactions</button></form>
  <div class="mv-links"><button class="btn sm ghost" data-mvgo="bill">💳 Add a bill</button><button class="btn sm ghost" data-mhtab="goals">🏝️ New goal</button><button class="btn sm ghost" data-mhtab="subs">📅 Subscription</button></div>`;
// "45 dollars at Kroger" -> {amt: 45, what: "Kroger", dir: "out"}. Pure (the tests call it).
function parseSpoken(s) {
  s = String(s || "").trim(); const m = s.replace(/,(?=\d{3})/g, "").match(/\$?\s*(\d+(?:\.\d{1,2})?)/);
  if (!m) return null;
  const dir = /\b(got paid|paid me|paycheck|deposit|income|refund|earned|received|got back)\b/i.test(s) ? "in" : "out";
  const w = s.match(/\b(?:at|for|on|from)\s+(.+)$/i), what = w ? w[1].replace(/\s*\$?\d+(?:\.\d+)?\s*(dollars?|bucks)?\s*$/i, "").trim() : "";
  return { amt: +m[1], what: what.replace(/^(the|a)\s+/i, "").replace(/^./, c => c.toUpperCase()).slice(0, 60), dir };
}
function mvListen() {
  const R = MV_SPEECH(); if (!R) return;
  const r = new R(), out = document.getElementById("mvHeard"); r.lang = "en-US"; r.interimResults = false;
  if (out) out.textContent = "Listening…";
  r.onresult = e => { const said = e.results[0][0].transcript, p = parseSpoken(said);
    if (!p) { if (out) out.textContent = `Heard “${said}” - no amount in it. Try again.`; return; }
    const f = document.querySelector('#mhSheet form[data-mhtx]'); if (!f) return;
    f.amt.value = p.amt; f.what.value = p.what; f.querySelector(`[name=dir][value=${p.dir}]`).checked = true;
    if (out) out.textContent = `Heard “${said}”. Check it, then tap Add.`; };
  r.onerror = () => { if (out) out.textContent = "Couldn't hear that - check the microphone permission."; };
  r.start();
}
async function mvShrink(file, max) {
  const url = URL.createObjectURL(file);
  try { const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error("not a photo")); i.src = url; });
    const k = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement("canvas");
    c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", .82);
  } finally { URL.revokeObjectURL(url); }
}
// The AI's reading, cleaned to fields for the review card. j = mscan's JSON (or Auto Hub's scan JSON as the fallback).
function mvFields(j, kind) {
  j = j && typeof j === "object" ? j : {};
  const num = v => { const n = Number(String(v == null ? "" : v).replace(/[$,\s]/g, "")); return n > 0 ? Math.round(n * 100) / 100 : ""; };
  const day = v => /^\d{4}-\d{2}-\d{2}$/.test(v || "") ? v : "";
  const k = MV_KINDS.some(x => x[0] === j.kind) ? j.kind : kind, who = String(j.merchant || j.company || j.shop || j.employer || "").trim().slice(0, 60);
  const cat = MH_CATS.some(c => c[0] === j.category) ? j.category : catGuess(who) !== "other" ? catGuess(who) : k === "bill" ? "bills" : "other";
  return { kind: k, who, amt: num(k === "paystub" ? (j.net || j.amount) : j.amount), gross: num(j.gross), date: day(j.date) || today(), due: day(j.due) || day(j.date),
    cat, auto: !!j.autopay, doc: MV_DOCS.some(d => d[0] === j.docType) ? j.docType : k === "document" ? "other" : k, title: String(j.title || who || "").slice(0, 60), note: String(j.note || "").slice(0, 120) };
}
async function mvRead(file) {
  let img; try { img = await mvShrink(file, 1024); } catch (e) { MH_MSG = "That doesn't look like a photo."; mhMsgShow(); return; }
  MV_SCAN = { img, read: false, f: mvFields({}, MV_KIND) };
  if (aiOn()) {
    showMh("add"); toast("📷 Reading the photo…");
    const words = `Money Hub - this photo is a ${MV_KIND}. Read the money details.`, b64 = img.split(",")[1];
    try { let j; try { j = await aiCall("mscan", words, undefined, { image: b64 }); }
      catch (e) { if (!/unknown task/i.test(e.message)) throw e; j = await aiCall("scan", words, undefined, { image: b64 }); }   // relay before v16
      MV_SCAN.f = mvFields(aiJSON(j.text), MV_KIND); MV_SCAN.read = true;
    } catch (e) { MH_MSG = "Couldn't read it (" + e.message + ") - type what it says."; }
  }
  showMh("add");
}
function mvReviewHtml() {
  const f = MV_SCAN.f, k = f.kind;
  const row = (icon, label, html) => `<label class="mv-xrow">${mvIc(icon, "#27d7ff", "sm")}<span>${label}</span>${html}</label>`;
  return `<div class="mv-shot"><img src="${MV_SCAN.img}" alt="Your photo"><i></i><i></i><i></i><i></i></div>
    <form class="mv-xcard" data-mvsave="1"><div class="mv-sec" style="margin:0 0 6px"><h3>${MV_SCAN.read ? "✨ What we read" : "✍️ Type what it says"}</h3>
        <select name="kind" data-mvkindsel="1" aria-label="What it is">${MV_KINDS.map(([x, i, l]) => `<option value="${x}" ${k === x ? "selected" : ""}>${i} ${l}</option>`).join("")}</select></div>
      ${k === "document" ? row("📄", "Title", `<input name="title" value="${esc(f.title)}" placeholder="e.g. 2025 W-2" required>`)
        + row("🗂️", "Type", `<select name="doc">${MV_DOCS.map(([x, i, l]) => `<option value="${x}" ${f.doc === x ? "selected" : ""}>${i} ${l}</option>`).join("")}</select>`)
        : row(k === "paystub" ? "🏢" : "🏪", k === "paystub" ? "Employer" : k === "bill" ? "Company" : "Merchant", `<input name="who" value="${esc(f.who)}" placeholder="${k === "bill" ? "e.g. Entergy" : "e.g. Whole Foods"}">`)
        + row("💲", k === "paystub" ? "Take-home" : "Amount", `<input name="amt" inputmode="decimal" value="${f.amt}" placeholder="0.00" required>`)}
      ${row("📅", k === "bill" ? "Due" : "Date", `<input type="date" name="date" value="${esc(k === "bill" ? f.due || f.date : f.date)}">`)}
      ${k === "receipt" || k === "bill" ? row("🏷️", "Category", `<select name="cat">${catOpts(f.cat)}</select>`) : ""}
      ${k === "bill" ? `<label class="fine mv-check"><input type="checkbox" name="auto" ${f.auto ? "checked" : ""}><span>On autopay · repeats every month on this day</span></label>` : ""}
      ${k === "paystub" ? `<label class="fine mv-check"><input type="checkbox" name="setpay" checked><span>Use this as my usual paycheck (the forecast uses it)</span></label>` : ""}
      ${k !== "document" ? `<label class="fine mv-check"><input type="checkbox" name="keep" checked><span>Keep the photo in my Document Vault</span></label>` : ""}
      <button class="btn mv-go">${{ receipt: "Add to Transactions", bill: "Add to Payments", paystub: "Add as money in", document: "Save to Vault" }[k]}</button>
      <button class="btn ghost" type="button" data-mvscanno="1">Start over</button></form>
    <p class="fine">Check every number - nothing is saved until you tap the button.</p>`;
}
async function mvSaveScan(data) {
  const M = mh(), k = MV_KIND = MV_KINDS.some(x => x[0] === data.kind) ? data.kind : "receipt", img = MV_SCAN && MV_SCAN.img;
  const a = Math.abs(amt(data.amt)), d = /^\d{4}-\d{2}-\d{2}$/.test(data.date || "") ? data.date : today(), who = String(data.who || "").trim().slice(0, 60);
  if (k !== "document" && !a) { MH_MSG = "Type the amount."; mhMsgShow(); return; }
  if (k === "document" && !String(data.title || "").trim()) { MH_MSG = "Give it a title."; mhMsgShow(); return; }
  let said, tab;
  if (k === "receipt") { const cat = MH_CATS.some(c => c[0] === data.cat) && data.cat !== "other" ? data.cat : catGuess(who);   // left on Other = our guess from the name
    M.tx.push({ id: uid(), date: d, amt: -a, what: who, cat, acct: "", src: "scan" }); said = `${mcat(cat)[1]} ${usd(a)} at ${who || "the store"} added`; tab = "spend"; }
  else if (k === "bill") { const day = +d.slice(8);
    if (!who) { MH_MSG = "Who is the bill from?"; mhMsgShow(); return; }
    S.bills.push({ id: uid(), name: who, amount: a, day, paid: d < today() && ym(d) === ym(today()) ? ym(today()) : prevMonthKey(), auto: !!data.auto, cat: MH_CATS.some(c => c[0] === data.cat) ? data.cat : "bills", url: "" });
    said = `💳 ${who} ${usd(a)} due the ${day}${["th", "st", "nd", "rd"][day % 10 > 3 || [11, 12, 13].includes(day) ? 0 : day % 10]} of each month`; tab = "bills"; }
  else if (k === "paystub") { M.tx.push({ id: uid(), date: d, amt: a, what: who || "Paycheck", cat: "pay", acct: "", src: "scan" });
    if (data.setpay) S.payday.amount = a; said = `💵 ${usd(a)} paycheck added`; tab = "spend"; }
  if (img && (k === "document" || data.keep)) {
    const doc = k === "document" ? (MV_DOCS.some(x => x[0] === data.doc) ? data.doc : "other") : k;
    try { await mvVaultPut({ type: doc, title: k === "document" ? String(data.title).trim().slice(0, 60) : `${who || MV_KINDS.find(x => x[0] === k)[2]}${a ? " · " + usd(a) : ""}`, date: d, img }); }
    catch (e) { said = (said || "Saved") + " (the photo couldn't be kept)"; }
    if (k === "document") { said = "🔐 Saved to your Document Vault"; tab = "vault"; }
  }
  MV_SCAN = null; MH_MSG = ""; save(); render(); showMh(tab); toast(said);
}

// ------------------------------------------------------------ TRANSACTIONS (the art's third phone)
function mvTxRows() {
  const q = MV_Q.trim().toLowerCase();
  return mh().tx.filter(x => (MV_TF === "all" || (MV_TF === "in" ? x.amt > 0 : MV_TF === "out" ? x.amt < 0 : !!x.bill || /^bill /.test(x.src || "")))
    && (!MV_TC || x.cat === MV_TC) && (!q || `${x.what} ${mcat(x.cat)[2]} ${Math.abs(x.amt)}`.toLowerCase().includes(q)))
    .sort((a, b) => b.date.localeCompare(a.date) || (b.id > a.id ? 1 : -1));
}
function mvTxList() {
  const all = mvTxRows(), L = all.slice(0, MV_MORE), t = today(), wk = mvWeekStart(t), lwk = addDays(wk, -7);
  const grp = d => d >= wk ? "This week" : d >= lwk ? "Last week" : monthName(ym(d));
  const groups = []; L.forEach(x => { const g = grp(x.date); if (!groups.length || groups[groups.length - 1].g !== g) groups.push({ g, L: [] }); groups[groups.length - 1].L.push(x); });
  if (!L.length) return `<p class="hos-hint">${mh().tx.length ? "Nothing matches." : "Nothing logged yet - tap ＋ to add one, snap a receipt, or import your bank's CSV."}</p>`;
  return groups.map(({ g, L }) => `<div class="mv-grp"><h4>${g}</h4><b>${mvSign(L.reduce((n, x) => n + x.amt, 0))}</b></div>` + L.map(x => MH_EDIT === x.id
    ? `<form class="mv-tx" data-mhtxcat="${x.id}"><div class="grow"><b>${esc(x.what || "-")}</b></div><select name="cat" aria-label="Category">${catOpts(x.cat, x.amt > 0)}</select><button class="btn sm ghost">Save</button></form>`
    : `<div class="mv-tx"><button class="mh-cat mv-ic" style="--tone:${mvTone(x.what, x.cat)}" data-mhedit="${x.id}" aria-label="Change category for ${esc(x.what || "this")}">${mcat(x.cat)[1]}</button>
        <div class="grow"><b>${esc(x.what || mcat(x.cat)[2])}</b><small>${esc(mcat(x.cat)[2])} · ${mvRel(x.date)}${x.src === "scan" ? " · 📷" : x.src === "CSV" ? " · 📥" : ""}</small></div>
        <strong class="${x.amt > 0 ? "in" : ""}">${x.amt < 0 ? "−" : "+"}${usd(Math.abs(x.amt))}</strong><button class="mv-x" data-mhdel="tx:${x.id}" aria-label="Remove">✕</button></div>`).join("")).join("")
    + (all.length > L.length ? `<button class="btn sm ghost mv-more" data-mvmore="1">Show ${Math.min(60, all.length - L.length)} more</button>` : "");
}
function mvTxHtml() {
  const M = mh(), t = today(), Tm = monthTotals(ym(t)), used = [...new Set(M.tx.map(x => x.cat))];
  return `<div class="mv-tstats"><div><small>In · ${parseDay(t).toLocaleDateString("en-US", { month: "short" })}</small><b class="in">${usd(Tm.inc)}</b></div><div><small>Out</small><b>${usd(Tm.out)}</b></div><div><small>Net</small><b class="${Tm.inc - Tm.out < 0 ? "neg" : "in"}">${mvSign(Tm.inc - Tm.out)}</b></div></div>
    <div class="mv-search"><span aria-hidden="true">🔎</span><input type="search" data-mvq="1" value="${esc(MV_Q)}" placeholder="Search transactions…" aria-label="Search transactions"></div>
    <div class="hos-chips mv-chips" role="group" aria-label="Show">${[["all", "All"], ["in", "💵 Income"], ["out", "🧾 Expenses"], ["bills", "💳 Bills"]].map(([k, l]) => `<button class="${MV_TF === k && !MV_TC ? "on" : ""}" data-mvtf="${k}">${l}</button>`).join("")}
      ${used.filter(c => MH_CATS.some(x => x[0] === c)).map(c => `<button class="${MV_TC === c ? "on" : ""}" data-mvtc="${c}">${mcat(c)[1]} ${esc(mcat(c)[2])}</button>`).join("")}</div>
    <div id="mvTxList">${mvTxList()}</div>
    ${MV_TF === "all" && !MV_TC && !MV_Q ? mvFamilyHtml("costs") : ""}
    <h3 class="mv-h">Add one by hand</h3>
    <form class="qa-form" data-mhtx="1"><div class="hpv-row"><select name="dir" aria-label="Money in or out"><option value="out">− Spent</option><option value="in">+ Money in</option></select>
        <input name="amt" inputmode="decimal" placeholder="Amount $" required aria-label="Amount"><input type="date" name="date" value="${t}" aria-label="Date"></div>
      <div class="two"><input name="what" placeholder="What for, e.g. Kroger" aria-label="What for"><select name="cat" aria-label="Category"><option value="">Category: guess it</option>${catOpts("", true)}</select></div>
      <button class="btn sm">Add</button></form>
    ${mhGate() ? `<p class="fine">📥 ${STORE_MODE ? esc(storeLock("Importing your bank's CSV")) : `Import your bank's CSV: ${esc(PLAN.MONEY_NAME)}.`}</p>`
      : `<div class="mv-links">${mvFileBtn("📥 Import a file", "", "btn sm ghost")}<button class="btn sm ghost" data-mhtab="connect">🔗 Bank, Cash App, Venmo…</button></div>
         <p class="fine" style="margin:4px 0 8px">The CSV / QFX download from your bank, card, Cash App, Venmo or PayPal. Read on this phone; duplicates are skipped.</p>`}`;
}
// Search as you type: only the list redraws, so the cursor stays put.
if (typeof document !== "undefined") document.addEventListener("input", e => {
  const t = e.target; if (MODE !== "money" || !t || !t.dataset || !t.dataset.mvq) return;
  MV_Q = t.value; MV_MORE = 60; const el = document.getElementById("mvTxList"); if (el) el.innerHTML = mvTxList();
});

// ------------------------------------------------------------ PAYMENTS extras: the 7-day date chips + a calendar (art's second phone)
function mvPayTop(F) {
  const t = today(), days = [0, 1, 2, 3, 4, 5, 6].map(k => addDays(t, k)), due = d => F.rows.filter(r => !r.paid && r.due === d);
  return `<div class="mv-days" role="group" aria-label="Next 7 days">${days.map(d => { const x = parseDay(d), B = due(d), sum = B.reduce((n, r) => n + (+r.b.amount || 0), 0);
      return `<button class="${MV_PDAY === d ? "on" : ""} ${d === t ? "today" : ""}" data-mvpday="${d}" aria-pressed="${MV_PDAY === d}" aria-label="${x.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}${B.length ? `: ${B.length} due, ${usd(sum)}` : ""}">
        <small>${x.toLocaleDateString("en-US", { weekday: "short" })}</small><b>${x.getDate()}</b>${B.length ? `<i>${usd(sum)}</i>` : "<i></i>"}</button>`; }).join("")}</div>
    <div class="mv-seg sm" role="group" aria-label="View">${[["list", "☰ List"], ["cal", "📅 Calendar"]].map(([k, l]) => `<button class="${MV_PVIEW === k ? "on" : ""}" data-mvpview="${k}" aria-pressed="${MV_PVIEW === k}">${l}</button>`).join("")}</div>
    ${MV_PVIEW === "list" && !MV_PDAY ? mvFamilyHtml("bills") : ""}
    ${MV_PDAY ? `<p class="fine mv-dayline">Showing ${mDate(MV_PDAY)} <button class="btn sm ghost" data-mvpday="">Show all</button></p>` : ""}`;
}
function mvCalendar(F) {
  const t = today(), m = ym(t), first = parseDay(m + "-01"), dim = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate(), lead = (first.getDay() + 6) % 7;
  const cells = [...Array(lead).fill(""), ...Array.from({ length: dim }, (_, i) => `${m}-${pad(i + 1)}`)];
  return `<div class="mv-cal" role="grid" aria-label="${monthName(m)}">${["M", "T", "W", "T", "F", "S", "S"].map(w => `<span class="mv-cal-h">${w}</span>`).join("")}${cells.map(d => { if (!d) return `<span></span>`;
      const R = F.rows.filter(r => r.due === d), un = R.filter(r => !r.paid), cls = [d === t ? "today" : "", MV_PDAY === d ? "on" : "", un.some(r => r.late) ? "late" : un.length ? "due" : R.length ? "paid" : ""].join(" ");
      return `<button class="${cls}" data-mvpday="${d}" aria-label="${mDate(d)}${R.length ? `: ${R.map(r => r.b.name).join(", ")}` : ""}"><b>${+d.slice(8)}</b>${R.length ? `<i>${R.slice(0, 3).map(r => PAY_ICONS[r.b.cat] || "🧾").join("")}</i><small>${usd(R.reduce((n, r) => n + (+r.b.amount || 0), 0))}</small>` : ""}</button>`; }).join("")}</div>
    <p class="fine">🟦 due · 🟥 late · 🟩 paid. Tap a day to see its bills.</p>`;
}

// ------------------------------------------------------------ CASH FORECAST (feature strip: "See your future with confidence")
// Day by day from today: start = cash available; + each payday; − each bill (unpaid this month, every month after),
// − subscription renewals (not ones already listed as a bill), − everyday spending (last 30 days' average) if on. Estimates.
function mvEveryday(onDay) {
  const from = addDays(onDay, -30), names = new Set(S.bills.map(b => b.name.toLowerCase()).concat(mh().subs.map(s => s.name.toLowerCase())));
  const out = mhFlow().filter(x => x.amt < 0 && x.date >= from && x.date < onDay && !x.bill && !/^bill |subscription/.test(x.src || "") && !["housing", "debt"].includes(x.cat) && !names.has(String(x.what || "").toLowerCase()))
    .reduce((n, x) => n - x.amt, 0);
  return Math.round(out / 30 * 100) / 100;
}
function mvForecast(onDay, days = 60, opt = {}) {
  const M = mh(), start = opt.start != null ? opt.start : cashNow(), pay = payAmount().amt || 0, daily = opt.spend === false ? 0 : mvEveryday(onDay);
  const end = addDays(onDay, days - 1), ev = {}, put = (d, label, a, icon) => { (ev[d] = ev[d] || []).push({ label, amt: a, icon }); };
  if (pay) { let d = payNext(onDay), g = 0; while (d && d <= end && g++ < 80) { put(d, "Payday", pay, "💵"); d = payAfter(d); } }
  S.bills.forEach(b => { for (let k = 0; k < Math.ceil(days / 28) + 1; k++) { const base = parseDay(onDay), y = base.getFullYear(), mo = base.getMonth() + k;
    const d = ymd(new Date(y, mo, Math.min(Number(b.day) || 1, new Date(y, mo + 1, 0).getDate())));
    if (k === 0 && b.paid && b.paid >= ym(onDay)) continue;               // this month already paid
    if (d > end) continue;
    put(d < onDay ? onDay : d, b.name + (d < onDay ? " (late)" : ""), -(Number(b.amount) || 0), PAY_ICONS[b.cat] || "🧾"); } });
  mvFamily(ym(onDay)).bills.forEach(b => { for (let k = 0; k < Math.ceil(days / 28) + 1; k++) { const base = parseDay(onDay), y = base.getFullYear(), mo = base.getMonth() + k;
    const d = ymd(new Date(y, mo, Math.min(b.day, new Date(y, mo + 1, 0).getDate()))); if (d >= onDay && d <= end) put(d, `${b.name} (${b.hub})`, -b.amount, b.hub === "Auto Hub" ? "🚗" : "🏡"); } });   // future dues only - paid state lives in that hub
  const billNames = new Set(S.bills.map(b => b.name.toLowerCase()));
  M.subs.filter(s => !s.off && s.next && !billNames.has(s.name.toLowerCase())).forEach(s => { let d = s.next, g = 0;
    while (d < onDay && g++ < 200) d = s.every === "year" ? addMonthsDayM(d, 12) : s.every === "week" ? addDays(d, 7) : addMonthsDayM(d, 1);
    while (d <= end && g++ < 400) { put(d, s.name, -s.amt, "🔁"); d = s.every === "year" ? addMonthsDayM(d, 12) : s.every === "week" ? addDays(d, 7) : addMonthsDayM(d, 1); } });
  let bal = start; const pts = [];
  for (let i = 0; i < days; i++) { const d = addDays(onDay, i), E = ev[d] || [];
    bal += E.reduce((n, e) => n + e.amt, 0) - (i ? daily : 0); pts.push({ d, bal: Math.round(bal * 100) / 100, ev: E }); }
  const low = pts.reduce((a, p) => p.bal < a.bal ? p : a, pts[0]);
  return { pts, low, end: pts[pts.length - 1].bal, start, daily, pay, firstShort: (pts.find(p => p.bal < 0) || {}).d || null };
}
function mvChart(F) {
  const W = 340, H = 170, L = 44, R = 8, Tp = 12, B = 24, P = F.pts, n = P.length;
  const mn = Math.min(...P.map(p => p.bal)), hi = Math.max(1, ...P.map(p => p.bal));
  // above $0 all the way: the axis hugs the data (the shape matters); dips below: $0 is on the chart, dashed red
  const lo = mn < 0 ? mn : Math.max(0, mn - (hi - mn) * .25 - 1), pad = (hi - lo) * .08 || 1;
  const y = v => Tp + (hi + pad - v) / (hi + pad - (lo - (lo < 0 ? pad : 0))) * (H - Tp - B), x = i => L + i / Math.max(1, n - 1) * (W - L - R);
  const line = P.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(p.bal).toFixed(1)}`).join(" ");
  const ticks = [hi, (hi + lo) / 2, lo].map(v => Math.round(v));
  const li = P.indexOf(F.low);
  return `<div class="mv-chart" data-mvchart="1"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Projected cash for the next ${n} days, lowest ${usd(F.low.bal)} on ${mDate(F.low.d)}">
      <defs><linearGradient id="mvArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#27d7ff" stop-opacity=".28"/><stop offset="1" stop-color="#27d7ff" stop-opacity="0"/></linearGradient></defs>
      ${ticks.map(v => `<line x1="${L}" x2="${W - R}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" class="mv-grid"/><text x="${L - 6}" y="${(y(v) + 3).toFixed(1)}" class="mv-ax" text-anchor="end">${v >= 1000 || v <= -1000 ? `${v < 0 ? "−" : ""}$${(Math.abs(v) / 1000).toFixed(1)}k` : usd(v)}</text>`).join("")}
      ${lo < 0 ? `<line x1="${L}" x2="${W - R}" y1="${y(0).toFixed(1)}" y2="${y(0).toFixed(1)}" class="mv-zero"/>` : ""}
      <path d="${line} L${x(n - 1).toFixed(1)} ${(H - B).toFixed(1)} L${L} ${(H - B).toFixed(1)}Z" fill="url(#mvArea)"/>
      <path d="${line}" class="mv-line"/>
      ${P.map((p, i) => p.ev.some(e => e.amt > 0) ? `<circle cx="${x(i).toFixed(1)}" cy="${y(p.bal).toFixed(1)}" r="4" class="mv-pin in"/>` : "").join("")}
      <circle cx="${x(li).toFixed(1)}" cy="${y(F.low.bal).toFixed(1)}" r="5" class="mv-pin ${F.low.bal < 0 ? "neg" : "low"}"/>
      <text x="${Math.min(W - R - 2, Math.max(L + 30, x(li))).toFixed(1)}" y="${Math.min(H - B - 6, y(F.low.bal) + 16).toFixed(1)}" class="mv-lbl" text-anchor="middle">Low ${usd(F.low.bal)}</text>
      ${[0, Math.floor((n - 1) / 2), n - 1].map(i => `<text x="${x(i).toFixed(1)}" y="${H - 6}" class="mv-ax" text-anchor="${i ? i === n - 1 ? "end" : "middle" : "start"}">${parseDay(P[i].d).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</text>`).join("")}
      <line class="mv-cross" x1="0" x2="0" y1="${Tp}" y2="${H - B}" style="display:none"/>
      <rect x="${L}" y="${Tp}" width="${W - L - R}" height="${H - Tp - B}" fill="transparent" class="mv-hit"/></svg>
    <div class="mv-tip" hidden></div></div>`;
}
function mvForecastHtml() {
  const M = mh(), t = today(), F = mvForecast(t, 60, { spend: M.fcSpend !== false }), up = F.pts.filter(p => p.ev.length).slice(0, 14);
  if (!M.accounts.length && !F.pay) return `<p class="hos-hint">Add your accounts and your payday - the forecast starts from your cash and adds every payday and bill ahead.</p>
    <div class="mv-links"><button class="btn sm" data-mhtab="accounts">🏦 Accounts</button><button class="btn sm ghost" data-mhtab="payday">💵 Payday</button></div>`;
  return `<div class="mv-tiles3"><div><small>Today</small><b>${usd(F.start)}</b></div><div class="${F.low.bal < 0 ? "neg" : ""}"><small>Lowest</small><b>${usd(F.low.bal)}</b><em>${mDate(F.low.d)}</em></div><div><small>In 60 days</small><b>${usd(F.end)}</b></div></div>
    ${F.firstShort ? `<p class="mv-alert">⚠️ Projected to go below $0 on <b>${mDate(F.firstShort)}</b>. Moving a bill after payday or trimming spending fixes it.</p>` : ""}
    ${mvChart(F)}
    <label class="fine mv-check"><input type="checkbox" data-mvfcspend="1" ${M.fcSpend !== false ? "checked" : ""}><span>Include everyday spending (${usd(F.daily)} a day - your last 30 days, bills left out)</span></label>
    <h3 class="mv-h">Coming up</h3>
    <div class="mv-evs">${up.map(p => p.ev.map(e => `<div class="mv-ev">${mvIc(e.icon, e.amt > 0 ? "#22c55e" : mvTone(e.label, "bills"), "sm")}<span class="grow"><b>${esc(e.label)}</b><small>${mvRel(p.d)}</small></span><strong class="${e.amt > 0 ? "in" : ""}">${mvSign(e.amt)}</strong><em>${usd(p.bal)}</em></div>`).join("")).join("") || `<p class="hos-hint">No paydays or bills in the next 60 days.</p>`}</div>
    <p class="fine">Math: ${usd(F.start)} cash available${F.pay ? ` + ${usd(F.pay)} each payday` : ""} − every unpaid bill on its due day − renewals${F.daily ? ` − ${usd(F.daily)} a day everyday spending` : ""}. An estimate from what you've typed - your bank is the real number.</p>`;
}
// Tap / drag on the chart: a crosshair and the day's balance.
function mvChartPoint(e) {
  const box = e.target.closest && e.target.closest("[data-mvchart]"); if (!box || MODE !== "money") return;
  const svg = box.querySelector("svg"), r = svg.getBoundingClientRect(), vx = (e.clientX - r.left) / r.width * 340;
  const F = mvForecast(today(), 60, { spend: mh().fcSpend !== false }), n = F.pts.length, i = Math.max(0, Math.min(n - 1, Math.round((vx - 44) / (340 - 52) * (n - 1)))), p = F.pts[i];
  const cx = 44 + i / (n - 1) * (340 - 52), c = svg.querySelector(".mv-cross"), tip = box.querySelector(".mv-tip");
  c.setAttribute("x1", cx); c.setAttribute("x2", cx); c.style.display = "";
  tip.hidden = false; tip.style.left = Math.min(70, Math.max(0, cx / 340 * 100 - 15)) + "%";
  tip.innerHTML = `<b>${mDate(p.d)}</b> ${usd(p.bal)}${p.ev.map(e => `<br>${e.icon} ${esc(e.label)} ${mvSign(e.amt)}`).join("")}`;
}
if (typeof document !== "undefined") { document.addEventListener("pointermove", mvChartPoint); document.addEventListener("pointerdown", mvChartPoint); }

// ------------------------------------------------------------ SMART INSIGHTS (feature strip: "Personalized insights that actually help")
// Every insight is from the owner's own log and says its math. -> [{id, icon, tone, title, why, tab, act}]
function mvInsights(onDay) {
  const M = { ...mh(), tx: mhFlow() }, out = [], add = (id, pri, icon, tone, title, why, tab, act) => { const d = (M.dis || {})[id]; if (!d || addDays(d, 30) <= onDay) out.push({ id, pri, icon, tone, title, why, tab, act }); };
  const a30 = addDays(onDay, -30), a60 = addDays(onDay, -60), norm = s => String(s || "").toLowerCase().replace(/[^a-z]/g, "").slice(0, 14);
  const win = (f, t) => M.tx.filter(x => x.date >= f && x.date < t), cur = win(a30, addDays(onDay, 1)), prev = win(a60, a30);
  // everyday categories only: rent, loans, insurance and bills land on one day a month, so a 30-day window "moves" with the calendar
  const FIXED = ["housing", "debt", "insurance", "bills", "utilities", "subs"];
  const byCat = L => L.filter(x => x.amt < 0 && !x.bill && !FIXED.includes(x.cat)).reduce((o, x) => (o[x.cat] = (o[x.cat] || 0) - x.amt, o), {});
  const C = byCat(cur), Pv = byCat(prev);
  if (prev.length) Object.keys({ ...C, ...Pv }).forEach(k => { const c = C[k] || 0, p = Pv[k] || 0, d = c - p;
    if (p >= 20 && d >= 25 && d / p >= .25) add("up-" + k, 6, mcat(k)[1], "#fb923c", `${mcat(k)[2]} is up ${Math.round(d / p * 100)}%`, `${usd(c)} in the last 30 days vs ${usd(p)} the 30 before - ${usd(d)} more.`, "spend");
    else if (p >= 40 && c > 0 && -d >= 25 && -d / p >= .25) add("down-" + k, 3, "🎉", "#22c55e", `${mcat(k)[2]} is down ${Math.round(-d / p * 100)}%`, `${usd(c)} in the last 30 days vs ${usd(p)} the 30 before - ${usd(-d)} kept.`, "spend"); });
  // the same charge twice within 3 days
  const outs = M.tx.filter(x => x.amt < 0 && x.date >= a30).sort((a, b) => a.date.localeCompare(b.date));
  outs.forEach((x, i) => { const y = outs.slice(i + 1).find(z => norm(z.what) && norm(z.what) === norm(x.what) && z.amt === x.amt && z.date <= addDays(x.date, 3));
    if (y) add("dup-" + x.id, 9, "👯", "#f87171", `Charged twice? ${x.what} ${usd(-x.amt)}`, `Same amount on ${mDate(x.date)} and ${mDate(y.date)}. If you only bought once, call them or your bank.`, "spend"); });
  // a bill that went up 20%+ (its logged payments)
  S.bills.forEach(b => { const P = M.tx.filter(x => x.amt < 0 && norm(x.what) === norm(b.name)).sort((a, c) => a.date.localeCompare(c.date)); if (P.length < 3) return;
    const last = -P[P.length - 1].amt, before = P.slice(0, -1).map(x => -x.amt).sort((a, c) => a - c), med = before[Math.floor(before.length / 2)];
    if (med && last >= med * 1.2) add("hike-" + b.id + P[P.length - 1].date, 8, "📈", "#f59e0b", `${b.name} went up ${Math.round((last / med - 1) * 100)}%`, `Last payment ${usd(last)}, usually ${usd(med)} (the middle of your last ${before.length}).`, "bills"); });
  // something that repeats monthly but isn't a bill or subscription yet
  const known = new Set([...S.bills.map(b => norm(b.name)), ...M.subs.map(s => norm(s.name))]), seen = {};
  M.tx.filter(x => x.amt < 0 && x.date >= addDays(onDay, -100) && norm(x.what)).forEach(x => { const k = norm(x.what); (seen[k] = seen[k] || []).push(x); });
  Object.entries(seen).forEach(([k, L]) => { if (known.has(k)) return; const months = new Set(L.map(x => ym(x.date))), a = -L[L.length - 1].amt;
    if (months.size >= 2 && L.every(x => Math.abs(-x.amt - a) <= a * .1) && L.length <= months.size + 1)
      add("rec-" + k, 5, "🔁", "#22d3ee", `${L[0].what} looks monthly`, `${usd(a)} in ${months.size} different months. Track it as a subscription so it's in your forecast.`, "subs", `${L[0].what}|${a}`); });
  // money kept over the last 30 days (a whole window, so payday timing early in a month doesn't fool it)
  const inc = cur.filter(x => x.amt > 0).reduce((n, x) => n + x.amt, 0), spent = cur.filter(x => x.amt < 0).reduce((n, x) => n - x.amt, 0);
  if (inc > 0 && M.tx.some(x => x.date < a30)) { const k = (inc - spent) / inc;
    add("keep-" + ym(onDay), 2, k >= .1 ? "🐷" : "⚠️", k >= .1 ? "#22c55e" : "#f87171", k >= 0 ? `You kept ${Math.round(k * 100)}% of what came in` : `${usd(spent - inc)} more went out than came in`, `Last 30 days: ${usd(inc)} in, ${usd(spent)} out (everything you logged).`, "reports"); }
  // subscriptions, all together
  const subs = M.subs.filter(s => !s.off), mo = subs.reduce((n, s) => n + subMonthly(s), 0);
  if (subs.length >= 2) add("subs-" + ym(onDay), 4, "📅", "#a855f7", `Subscriptions: ${usd(mo * 12)} a year`, `${subs.length} running, ${usd(mo)} a month. Cancel one you don't use and it's back in your pocket.`, "subs");
  // the forecast dips below zero
  const F = (M.accounts.length || payAmount().amt) ? mvForecast(onDay, 30, { spend: M.fcSpend !== false }) : null;
  if (F && F.firstShort) add("short-" + F.firstShort, 10, "⚠️", "#f87171", `Cash may run short on ${mDate(F.firstShort)}`, `Forecast low ${usd(F.low.bal)} on ${mDate(F.low.d)} (paydays, bills, renewals and everyday spending).`, "forecast");
  // budgets close to the line
  budgetRows(ym(onDay)).filter(r => r.status !== "ok").forEach(r => add("bud-" + r.cat + ym(onDay), r.status === "over" ? 7 : 5, mcat(r.cat)[1], r.status === "over" ? "#f87171" : "#f59e0b",
    `${mcat(r.cat)[2]}: ${r.status === "over" ? `${usd(r.spent - r.lim)} over` : `${Math.round(r.spent / r.lim * 100)}% used`}`, `${usd(r.spent)} of a ${usd(r.lim)} limit this month.`, "budget"));
  return out.sort((a, b) => b.pri - a.pri);
}
function mvInsightsHtml() {
  const L = mvInsights(today());
  return `<div class="mv-banner">${mvIc("💡", "#a855f7")}<div><b>Made from your own numbers</b><small>Each one shows its math  - dismiss any for 30 days.</small></div></div>
    ${L.map(i => `<article class="mv-ins" style="--tone:${i.tone}">${mvIc(i.icon, i.tone)}<div class="grow"><b>${esc(i.title)}</b><small>${esc(i.why)}</small>
        <div class="mv-ins-acts">${i.act ? `<button data-mvaddsub="${esc(i.act)}">＋ Track it</button>` : ""}<button data-mhtab="${i.tab}">Open ›</button><button data-mvdis="${esc(i.id)}" aria-label="Dismiss">Dismiss</button></div></div></article>`).join("")
      || `<p class="hos-hint">✅ Nothing needs you. Insights appear as you log spending - a jump in a category, a bill that went up, a charge twice, a cash crunch ahead.</p>`}`;
}

// ------------------------------------------------------------ DOCUMENT VAULT (IndexedDB on this phone; the list in S.mh.vault)
const mvDb = () => new Promise((ok, no) => { const r = indexedDB.open("moneyhub.vault", 1);
  r.onupgradeneeded = () => r.result.createObjectStore("docs"); r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); });
const mvTx = async (mode, fn) => { const db = await mvDb(); return new Promise((ok, no) => { const t = db.transaction("docs", mode), s = t.objectStore("docs"), r = fn(s);
  t.oncomplete = () => ok(r && r.result); t.onerror = () => no(t.error); }); };
async function mvVaultPut(d) {
  const id = uid(); await mvTx("readwrite", s => s.put(d.img, id));
  const M = mh(); M.vault = Array.isArray(M.vault) ? M.vault : [];
  M.vault.unshift({ id, type: d.type, title: d.title, date: d.date }); return id;
}
const mvVaultGet = id => mvTx("readonly", s => s.get(id));
function mvVaultHtml() {
  const V = Array.isArray(mh().vault) ? mh().vault : [], by = MV_DOCS.map(([k, i, l]) => [k, i, l, V.filter(v => v.type === k).length]);
  return `<div class="mv-banner">${mvIc("🔐", "#3b82f6")}<div><b>Document Vault</b><small>Receipts, bills, tax and insurance papers. Kept on this phone only - not in the backup.</small></div></div>
    <div class="hos-chips mv-chips">${by.filter(x => x[3]).map(([k, i, l, n]) => `<span class="mv-count">${i} ${l} <b>${n}</b></span>`).join("")}</div>
    <form class="mv-vadd" onsubmit="return false"><select data-mvvt="1" aria-label="Kind of paper">${MV_DOCS.map(([k, i, l]) => `<option value="${k}" ${MV_VT === k ? "selected" : ""}>${i} ${l}</option>`).join("")}</select>
      <label class="btn sm">📷 Add a photo<input type="file" accept="image/*" data-mvvault="1" hidden></label></form>
    <div class="mv-vault">${V.map(v => `<figure class="mv-doc"><button data-mvbig="${v.id}" aria-label="Open ${esc(v.title)}"><img data-mvthumb="${v.id}" alt=""><span aria-hidden="true">${(MV_DOCS.find(d => d[0] === v.type) || MV_DOCS[6])[1]}</span></button>
        <figcaption><b>${esc(v.title)}</b><small>${mDate(v.date)}</small></figcaption><button class="mv-x" data-mvvdel="${v.id}" aria-label="Delete ${esc(v.title)}">✕</button></figure>`).join("")
      || `<p class="hos-hint">Nothing here yet. Snap a paper above, or keep the photo when you scan a receipt.</p>`}</div>
    ${MV_BIG ? `<div class="mv-big-img"><img data-mvthumb="${MV_BIG}" alt="Saved document"><button class="btn sm ghost" data-mvbig="">Close</button></div>` : ""}`;
}
async function mvThumbs() {
  const imgs = document.querySelectorAll("#mhSheet img[data-mvthumb]");
  for (const im of imgs) { try { const d = await mvVaultGet(im.dataset.mvthumb); if (d) im.src = d; } catch (e) { /* private mode */ } }
}

// ------------------------------------------------------------ the classic pages, made visual (same forms and buttons as v1.42)
// ACCOUNTS: what you have vs what you owe as one bar, then a glowing card per account.
function mvAccountsHtml() {
  const M = mh(), L = M.accounts, own = L.filter(a => !["credit", "loan"].includes(a.kind)).reduce((n, a) => n + Math.max(0, +a.bal || 0), 0);
  const owe = L.filter(a => ["credit", "loan"].includes(a.kind)).reduce((n, a) => n + (+a.bal || 0), 0), tot = own + owe || 1;
  return `<div class="mv-tiles3"><div><small>Cash available</small><b>${usd(cashNow())}</b></div><div><small>Net worth</small><b class="${netWorth() < 0 ? "neg" : ""}">${usd(netWorth())}</b></div><div><small>Accounts</small><b>${L.length}</b></div></div>
    ${L.length ? `<div class="mv-split" role="img" aria-label="You have ${usd(own)}, you owe ${usd(owe)}"><i style="width:${(own / tot * 100).toFixed(1)}%"></i><i class="owe" style="width:${(owe / tot * 100).toFixed(1)}%"></i></div>
      <div class="mv-split-k"><span>🟩 Have ${usd(own)}</span><span>🟥 Owe ${usd(owe)}</span></div>` : ""}
    <div class="mv-acard-list">${L.map(a => { const tone = MV_ACCT_TONE[a.kind] || "#3b82f6", debt = ["credit", "loan"].includes(a.kind);
      return `<article class="mv-acard" style="--tone:${tone}">${mvIc(macct(a.kind)[1], tone)}<div class="grow"><b>${esc(a.name)}</b>
          <small>${esc(a.src ? mvSrcName(a.src) : macct(a.kind)[2])}${debt ? " · owed" : ""}${a.apr ? ` · ${a.apr}% APR` : ""}${a.min ? ` · min ${usd(a.min)}` : ""}${a.imp ? ` · 📥 file ${mDate(a.imp)}` : a.at ? ` · updated ${mDate(a.at)}` : ""}</small>
          <form class="mv-balf" data-mhbal="${a.id}"><span>$</span><input name="bal" inputmode="decimal" value="${a.bal}" aria-label="Balance for ${esc(a.name)}"><button class="btn sm ghost">Save</button>${mhGate() ? "" : mvFileBtn("📥", a.id, "btn sm ghost")}</form></div>
        <strong class="${debt ? "neg" : ""}">${debt ? "−" : ""}${usd(+a.bal || 0)}</strong><button class="mv-x" data-mhdel="acct:${a.id}" aria-label="Remove ${esc(a.name)}">✕</button></article>`; }).join("")}</div>
    ${mhCanAddAcct() ? `<h3 class="mv-h">＋ Add an account</h3><form class="qa-form" data-mhacct="1"><div class="two"><select name="kind" aria-label="Kind">${MH_ACCTS.map(([k, i, l]) => `<option value="${k}">${i} ${l}</option>`).join("")}</select>
          <input name="name" placeholder="Name, e.g. Chase" required aria-label="Account name"></div>
        <div class="hpv-row"><input name="bal" inputmode="decimal" placeholder="Balance $" aria-label="Balance"><input name="apr" inputmode="decimal" placeholder="APR %" aria-label="Interest rate">
          <input name="min" inputmode="decimal" placeholder="Min pay $" aria-label="Minimum payment"></div><button class="btn sm">Add account</button></form>`
      : proLock("More than 3 accounts")}
    <p class="fine">Type each balance from your bank's app, or 📥 import its file (Connect). Money Hub never logs in to your bank.</p>`;
}
// BUDGET: a ring per category (green under 80%, amber near, red over) + the whole month's ring.
function mvBudgetHtml() {
  const R = budgetRows(ym(today())), set = new Set(R.map(r => r.cat)), lim = R.reduce((n, r) => n + r.lim, 0), sp = R.reduce((n, r) => n + r.spent, 0);
  const col = st => st === "over" ? "#ff7a7a" : st === "near" ? "#ffb648" : "#4ade80";
  const day = +today().slice(8), dim = new Date(+today().slice(0, 4), +today().slice(5, 7), 0).getDate();
  return `${R.length ? `<div class="mv-budget-top">${hosRing(lim ? sp / lim * 100 : 0, `${Math.round(lim ? sp / lim * 100 : 0)}%`, "of all limits", sp > lim ? "#ff7a7a" : "#38b6ff")}
        <div><b>${usd(sp)} <small>of ${usd(lim)}</small></b><span>${usd(Math.max(0, lim - sp))} left · day ${day} of ${dim} (${Math.round(day / dim * 100)}% of the month gone)</span></div></div>
      <div class="mv-rings">${R.map(r => `<div class="mv-bring ${r.status}">${hosRing(r.spent / r.lim * 100, mcat(r.cat)[1], mcat(r.cat)[2], col(r.status))}
          <b>${usd(r.spent)} <small>/ ${usd(r.lim)}</small></b><em>${r.status === "over" ? `${usd(r.spent - r.lim)} over` : `${usd(r.lim - r.spent)} left`}</em>
          <button class="mv-x" data-mhbudgetoff="${r.cat}" aria-label="Remove the ${esc(mcat(r.cat)[2])} limit">✕</button></div>`).join("")}</div>`
      : `<p class="hos-hint">Set a monthly limit for the categories that get away from you - we warn you at 80% and when you go over.</p>`}
    <h3 class="mv-h">🎯 Set a limit</h3>
    <form class="qa-form" data-mhbudget="1"><div class="two"><select name="cat" aria-label="Category">${MH_CATS.map(([k, i, l]) => `<option value="${k}">${i} ${l}${set.has(k) ? " (change)" : ""}</option>`).join("")}</select>
      <input name="lim" inputmode="decimal" placeholder="Limit a month $" required aria-label="Monthly limit"></div><button class="btn sm">Set limit</button></form>`;
}
// SUBSCRIPTIONS: the year's cost up top, then one card per service with its renewal countdown.
function mvSubsHtml() {
  const M = mh(), L = M.subs.slice().sort((a, b) => (a.off ? 1 : 0) - (b.off ? 1 : 0) || (a.next || "9").localeCompare(b.next || "9")), on = L.filter(s => !s.off);
  const mo = on.reduce((n, s) => n + subMonthly(s), 0), saved = L.filter(s => s.off).reduce((n, s) => n + subMonthly(s) * 12, 0), top = Math.max(1, ...on.map(subMonthly));
  return `<div class="mv-tiles3"><div><small>A month</small><b>${usd(mo)}</b></div><div><small>A year</small><b>${usd(mo * 12)}</b></div><div><small>Saved a year by cancelling</small><b class="in">${usd(saved)}</b></div></div>
    ${L.map(s => { const tone = mvTone(s.name, "subs"), d = s.next ? daysUntil(s.next) : null;
      return `<article class="mv-sub ${s.off ? "off" : ""}" style="--tone:${tone}">${mvIc(esc(s.name.trim().charAt(0).toUpperCase() || "🔁"), tone, "mv-mono")}
        <div class="grow"><b>${esc(s.name)}</b><small>${usd(s.amt)} a ${s.every || "month"}${s.off ? ` · cancelled ${mDate(s.off)}` : s.next ? ` · renews ${mDate(s.next)}` : ""}</small>
          ${s.off ? "" : `<i class="mv-subbar" style="width:${Math.round(subMonthly(s) / top * 100)}%"></i>`}
          <div class="mv-ins-acts">${s.off ? "" : `<button data-mhsubren="${s.id}">Renewed</button><button data-mhsuboff="${s.id}">Cancelled</button>`}<button data-mhdel="sub:${s.id}" aria-label="Remove">✕</button></div></div>
        ${!s.off && d != null ? `<em class="mv-when ${d <= 3 ? "soon" : ""}">${d < 0 ? "due" : d === 0 ? "today" : `${d}d`}</em>` : ""}</article>`; }).join("")}
    ${!L.length ? `<p class="hos-hint">Streaming, apps, memberships, the gym. See what they add up to, and what you save by cancelling.</p>` : ""}
    <h3 class="mv-h">＋ Add a subscription</h3>
    <form class="qa-form" data-mhsub="1"><input name="name" placeholder="e.g. Netflix" required aria-label="Subscription">
      <div class="hpv-row"><input name="amt" inputmode="decimal" placeholder="Cost $" required aria-label="Cost"><select name="every" aria-label="How often"><option value="month">Monthly</option><option value="year">Yearly</option><option value="week">Weekly</option></select>
        <input type="date" name="next" aria-label="Next renewal"></div><button class="btn sm">Add</button></form>`;
}
// REPORTS: money in vs out for 4 months as bars (2 series: legend + direct labels), this month's categories vs their usual, the table.
function mvReportsHtml() {
  const m = ym(today()), months = [3, 2, 1, 0].map(k => { const d = parseDay(m + "-01"); d.setMonth(d.getMonth() - k); return ymd(d).slice(0, 7); });
  const T = months.map(monthTotals), short = mm => parseDay(mm + "-01").toLocaleDateString("en-US", { month: "short" });
  if (!T.some(x => x.inc || x.out)) return `<p class="hos-hint">Reports fill in as you log spending and income (or import your bank's CSV).</p>`;
  const top = Math.max(1, ...T.flatMap(x => [x.inc, x.out])), cur = T[3], cats = Object.keys(Object.assign({}, ...T.map(x => x.byCat)));
  const avg = k => (T[0].byCat[k] || 0) / 3 + (T[1].byCat[k] || 0) / 3 + (T[2].byCat[k] || 0) / 3;
  const rows = cats.map(k => ({ k, v: cur.byCat[k] || 0, a: avg(k) })).sort((a, b) => b.v - a.v || b.a - a.a), ctop = Math.max(1, ...rows.flatMap(r => [r.v, r.a]));
  const H = 120;
  return `<div class="mv-legend"><span><i style="background:#4ade80"></i>Money in</span><span><i style="background:#38b6ff"></i>Money out</span></div>
    <div class="mv-bars" role="img" aria-label="Money in and out by month">${T.map((x, i) => `<div class="mv-bcol" title="${short(months[i])}: in ${usd(x.inc)}, out ${usd(x.out)}">
        <div class="mv-bpair"><i class="in" style="height:${Math.max(2, Math.round(x.inc / top * H))}px"><span>${x.inc ? usd(Math.round(x.inc)) : ""}</span></i><i class="out" style="height:${Math.max(2, Math.round(x.out / top * H))}px"><span>${x.out ? usd(Math.round(x.out)) : ""}</span></i></div>
        <b>${short(months[i])}</b><small class="${x.inc - x.out < 0 ? "neg" : "in"}">Net ${mvSign(Math.round(x.inc - x.out))}</small></div>`).join("")}</div>
    <h3 class="mv-h">${short(m)} by category <small class="mv-sub-h">│ = your usual (3-month average)</small></h3>
    ${rows.map(r => `<div class="mv-crow" style="--tone:${MH_TONES[r.k] || "#94a3b8"}"><span>${mcat(r.k)[1]} ${esc(mcat(r.k)[2])}</span>
        <div class="mv-ctrack"><i style="width:${(r.v / ctop * 100).toFixed(1)}%"></i>${r.a ? `<em style="left:${(r.a / ctop * 100).toFixed(1)}%"></em>` : ""}</div><b>${r.v ? usd(r.v) : "–"}</b></div>`).join("")}
    <details class="mv-table"><summary>📋 The numbers as a table</summary>
      <div class="mh-table"><table><tr><th></th>${months.slice().reverse().map(mm => `<th>${short(mm)}</th>`).join("")}</tr>
        <tr><td>💵 In</td>${T.slice().reverse().map(x => `<td>${usd(x.inc)}</td>`).join("")}</tr><tr><td>🧾 Out</td>${T.slice().reverse().map(x => `<td>${usd(x.out)}</td>`).join("")}</tr>
        ${rows.map(r => `<tr><td>${mcat(r.k)[1]} ${esc(mcat(r.k)[2])}</td>${T.slice().reverse().map(x => `<td>${x.byCat[r.k] ? usd(x.byCat[r.k]) : "–"}</td>`).join("")}</tr>`).join("")}
        <tr><td><b>Net</b></td>${T.slice().reverse().map(x => `<td><b>${usd(x.inc - x.out)}</b></td>`).join("")}</tr></table></div></details>
    <p class="fine">This month so far against the average of the 3 months before it.</p>`;
}
// DEBT: each debt as a bar along the road to debt-free, cleared in order.
function mvDebtViz(D, P) {
  if (!P.order.length || P.stuck) return "";
  const yrs = n => n >= 12 ? `${Math.floor(n / 12)}y ${n % 12}m` : `${n} mo`, tot = D.reduce((n, d) => n + d.bal, 0);
  return `<h3 class="mv-h">🛣️ Your road to debt-free</h3><div class="mv-road">${P.order.map((o, i) => { const d = D.find(x => x.name === o.name) || { bal: 0, apr: 0 };
      return `<div class="mv-rrow"><span class="mv-rn">${i + 1}</span><div class="grow"><b>${esc(o.name)}</b><small>${usd(d.bal)}${d.apr ? ` · ${d.apr}%` : ""}</small>
        <div class="mv-rtrack"><i style="width:${Math.max(4, o.month / P.months * 100).toFixed(1)}%"></i></div></div><em>🎉 ${yrs(o.month)}</em></div>`; }).join("")}
    <div class="mv-rend">🏁 Debt-free in ${yrs(P.months)} · ${usd(tot)} today</div></div>`;
}
// DEBT PAYOFF CHART (v1.46): what you owe, month by month, down to $0. With an extra payment set, a second line shows
// minimums only, so the gap between them is what the extra buys. Two lines -> legend + a label at each line's end.
let MV_DCH = null;
const mvMonth = k => { const d = parseDay(today()); d.setDate(1); d.setMonth(d.getMonth() + k); return d; };
const mvMonthTxt = (k, yr) => mvMonth(k).toLocaleDateString("en-US", yr ? { month: "short", year: "numeric" } : { month: "short" });
function mvDebtChart(P, base, ex) {
  if (P.stuck || !P.track || P.track.length < 2) { MV_DCH = null; return ""; }
  const B = base && !base.stuck && base.months > P.months ? base.track : null, A = P.track;
  const W = 340, H = 170, L = 44, R = 10, Tp = 14, Bt = 24, n = Math.max(A.length, B ? B.length : 0) - 1, hi = Math.max(1, A[0]);
  const x = i => L + i / Math.max(1, n) * (W - L - R), y = v => Tp + (hi - v) / hi * (H - Tp - Bt);
  const path = T => T.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const k$ = v => v >= 1000 ? `$${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : usd(v);
  MV_DCH = { A, B, n };
  const endLbl = (T, cls, dy) => { const i = T.length - 1; return `<circle cx="${x(i).toFixed(1)}" cy="${y(0).toFixed(1)}" r="4.5" class="mv-pin ${cls}"/>
    <text x="${Math.min(W - R, Math.max(L + 40, x(i))).toFixed(1)}" y="${(y(0) - dy).toFixed(1)}" class="mv-lbl" text-anchor="${x(i) > W - 60 ? "end" : "middle"}">🏁 ${mvMonthTxt(i, true)}</text>`; };
  return `<h3 class="mv-h">📉 Watch it shrink</h3>
    ${B ? `<div class="mv-legend"><span><i style="background:#27d7ff"></i>With ${usd(ex)} extra</span><span><i style="background:#a78bfa"></i>Minimums only</span></div>` : ""}
    <div class="mv-chart" data-mvdchart="1"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Debt ${usd(hi)} today, paid off ${mvMonthTxt(A.length - 1, true)}${B ? `; minimums only, ${mvMonthTxt(B.length - 1, true)}` : ""}">
      <defs><linearGradient id="mvDArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#27d7ff" stop-opacity=".25"/><stop offset="1" stop-color="#27d7ff" stop-opacity="0"/></linearGradient></defs>
      ${[hi, hi / 2, 0].map(v => `<line x1="${L}" x2="${W - R}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" class="mv-grid"/><text x="${L - 6}" y="${(y(v) + 3).toFixed(1)}" class="mv-ax" text-anchor="end">${k$(v)}</text>`).join("")}
      ${B ? `<path d="${path(B)}" class="mv-line mv-line2"/>` : ""}
      <path d="${path(A)} L${x(A.length - 1).toFixed(1)} ${y(0).toFixed(1)} L${L} ${y(0).toFixed(1)}Z" fill="url(#mvDArea)"/>
      <path d="${path(A)}" class="mv-line"/>
      ${B ? endLbl(B, "purple", 10) : ""}${endLbl(A, "in", B && Math.abs(x(A.length - 1) - x(B.length - 1)) < 70 ? 24 : 10)}
      ${[0, Math.round(n / 2), n].map(i => `<text x="${x(i).toFixed(1)}" y="${H - 6}" class="mv-ax" text-anchor="${i ? i === n ? "end" : "middle" : "start"}">${i ? mvMonthTxt(i, true) : "Now"}</text>`).join("")}
      <line class="mv-cross" x1="0" x2="0" y1="${Tp}" y2="${H - Bt}" style="display:none"/>
      <rect x="${L}" y="${Tp}" width="${W - L - R}" height="${H - Tp - Bt}" fill="transparent" class="mv-hit"/></svg>
    <div class="mv-tip" hidden></div></div>`;
}
function mvDebtPoint(e) {
  const box = e.target.closest && e.target.closest("[data-mvdchart]"); if (!box || !MV_DCH) return;
  const { A, B, n } = MV_DCH, svg = box.querySelector("svg"), r = svg.getBoundingClientRect(), vx = (e.clientX - r.left) / r.width * 340;
  const i = Math.max(0, Math.min(n, Math.round((vx - 44) / (340 - 54) * n))), cx = 44 + i / Math.max(1, n) * (340 - 54);
  const c = svg.querySelector(".mv-cross"), tip = box.querySelector(".mv-tip"), at = T => usd(T[Math.min(i, T.length - 1)]);
  c.setAttribute("x1", cx); c.setAttribute("x2", cx); c.style.display = "";
  tip.hidden = false; tip.style.left = Math.min(62, Math.max(0, cx / 340 * 100 - 15)) + "%";
  tip.innerHTML = `<b>${i ? mvMonthTxt(i, true) : "Now"}</b><br>${B ? "With extra " : "Owed "}${at(A)}${B ? `<br>Minimums only ${at(B)}` : ""}`;
}
if (typeof document !== "undefined") { document.addEventListener("pointermove", mvDebtPoint); document.addEventListener("pointerdown", mvDebtPoint); }
// PAYDAY: start + paycheck − bills − other − savings, as a waterfall.
function mvWaterfall(v, left) {
  const steps = [["Cash", v.start, "#38b6ff"], ["Paycheck", v.check, "#4ade80"], ["Bills", -v.bills, "#ff7a7a"], ["Other", -v.other, "#ffb648"], ["Savings", -v.save, "#a78bfa"]];
  let run = 0; const pts = steps.map(([l, a, c]) => { const from = run; run += +a || 0; return { l, a: +a || 0, c, from, to: run }; });
  const hi = Math.max(1, ...pts.map(p => Math.max(p.from, p.to)), left), lo = Math.min(0, ...pts.map(p => Math.min(p.from, p.to)), left), H = 130, y = x => (hi - x) / (hi - lo) * H;
  return `<div class="mv-fall-chart" role="img" aria-label="Cash ${usd(v.start)} plus paycheck ${usd(v.check)} minus bills ${usd(v.bills)}, other ${usd(v.other)}, savings ${usd(v.save)} leaves ${usd(left)}">
    ${pts.map(p => `<div class="mv-wcol"><div class="mv-wbox"><i style="top:${y(Math.max(p.from, p.to)).toFixed(0)}px;height:${Math.max(2, Math.abs(y(p.from) - y(p.to))).toFixed(0)}px;background:${p.c}"></i></div><b>${p.a < 0 ? "−" : p.l === "Cash" || !p.a ? "" : "+"}${usd(Math.abs(p.a))}</b><small>${p.l}</small></div>`).join("")}
    <div class="mv-wcol"><div class="mv-wbox"><i style="top:${y(Math.max(0, left)).toFixed(0)}px;height:${Math.max(2, Math.abs(y(0) - y(left))).toFixed(0)}px;background:${left < 0 ? "#ff7a7a" : "linear-gradient(#22d3ee,#2f8bff)"}"></i></div><b>${usd(left)}</b><small>Left</small></div></div>`;
}

// ------------------------------------------------------------ CONNECT (v1.46, Scott 10/17: "tie in all your cash apps, money flows,
// banks, everything you want tracked - just on your phone, not outside of phone"). No bank login, no aggregator, no server:
// each source gives you a file (CSV / OFX / QFX), Money Hub reads it right here on the phone (parseCsv in money.js), skips what
// it already has, marks money moving between your own accounts as ↔️ (never counted twice) and can set the balance from it.
const MV_SOURCES = [
  ["cashapp", "Cash App", "💸", "#00d54b", "wallet", "On cash.app in a web browser: sign in → Statements → Export CSV."],
  ["venmo", "Venmo", "💙", "#3d95ce", "wallet", "On venmo.com: sign in → Statements → pick the months → Download CSV."],
  ["paypal", "PayPal", "🅿️", "#2790c3", "wallet", "On paypal.com: Activity → Statements → Activity download → CSV."],
  ["bank", "Bank or credit union", "🏦", "#38b6ff", "checking", "On your bank's website: Activity → Download → CSV (or \"Quicken / QFX\"). Chase, Bank of America, Wells Fargo, Capital One and credit unions all have it."],
  ["card", "Credit card", "💳", "#f472b6", "credit", "On the card's website: Activity → Download → CSV or QFX. Spending shows as money in? One tap flips it."],
  ["applecard", "Apple Card", "🍎", "#c9ccd6", "credit", "In Wallet: Apple Card → Card Balance → a monthly statement → Export Transactions → CSV."],
  ["zelle", "Zelle", "⚡", "#8b5cf6", "", "Zelle moves money through your bank - import your bank's file and your Zelle payments come with it."],
  ["chime", "Chime & others", "🟩", "#1ec677", "checking", "No download? Snap the statement (＋ → Photo → Document) to keep it in the Vault, and add the big ones by hand or voice."],
  ["cash", "Cash in your pocket", "💵", "#4ade80", "cash", "Say it or type it: ＋ → Voice (\"20 dollars at the market\") or ＋ → Manual."]];
let MV_SRC = "";
const mvSrc = k => MV_SOURCES.find(x => x[0] === k) || MV_SOURCES[3];
const mvSrcName = k => (MH_SRCS.find(x => x[0] === k) || [k, "Bank"])[1];
const MV_FILES = ".csv,.ofx,.qfx,.qbo,text/csv";
const mvFileBtn = (label, acct, cls = "btn sm") => `<label class="${cls} mv-file">${label}<input type="file" accept="${MV_FILES}" data-mhcsv="1"${acct ? ` data-mvacct="${acct}"` : ""} hidden></label>`;
function mvConnectHtml() {
  const M = mh(), A = M.accounts, fed = A.filter(a => a.imp), last = fed.map(a => a.imp).sort().pop(), moves = M.tx.filter(x => x.cat === "transfer").length;
  const S1 = MV_SRC && mvSrc(MV_SRC);
  return `<section class="mv-conn-hero"><div class="mv-conn-orbit" aria-hidden="true">${MV_SOURCES.slice(0, 6).map(([, , i, c], k) => `<span style="--tone:${c};--k:${k}">${i}</span>`).join("")}<b>📱</b></div>
      <div><h3>Everything in one place</h3><p>Banks, cards, Cash App, Venmo, PayPal, cash - read <b>on this phone</b>. Nothing is uploaded and Money Hub never asks for a password.</p>
        <div class="mv-conn-k"><span><b>${A.length}</b> account${A.length === 1 ? "" : "s"}</span><span><b>${fed.length}</b> fed by a file</span>${last ? `<span>last ${mvRel(last)}</span>` : ""}</div></div></section>
    ${mhGate() ? proLock("Importing files") : `${mvFileBtn("📥 Choose a downloaded file", "", "btn mv-file-big")}
    <p class="fine mv-center">CSV, OFX, QFX or QBO · duplicates are skipped · you check it before anything is added</p>
    ${/Android/i.test(navigator.userAgent || "") ? `<p class="mv-tipline">📲 Faster on Android: download the file in Cash App, your bank's app or Files, tap <b>Share</b> → <b>Money Hub</b>.</p>` : ""}`}
    ${A.length ? `<h3 class="mv-h">Your money</h3><div class="mv-conn-list">${A.map(a => { const s = a.src ? mvSrc(a.src === "applecard" ? "applecard" : a.src) : null, tone = s && a.src !== "bank" ? s[3] : MV_ACCT_TONE[a.kind] || "#3b82f6";
        return `<div class="mv-conn" style="--tone:${tone}">${mvIc(s && a.src !== "bank" ? s[2] : macct(a.kind)[1], tone)}<div class="grow"><b>${esc(a.name)}</b>
          <small>${a.imp ? `📥 from a file ${mvRel(a.imp)}` : "✍️ typed by you"} · ${["credit", "loan"].includes(a.kind) ? "owed " : ""}${usd(+a.bal || 0)}</small></div>
          ${mhGate() ? "" : mvFileBtn("↻ Update", a.id, "btn sm ghost")}</div>`; }).join("")}</div>` : ""}
    <h3 class="mv-h">Add a source</h3>
    <div class="mv-srcs">${MV_SOURCES.map(([k, l, i, c]) => `<button class="mv-src${MV_SRC === k ? " on" : ""}" style="--tone:${c}" data-mvsrc="${k}" aria-expanded="${MV_SRC === k}"><span>${i}</span><b>${l}</b></button>`).join("")}</div>
    ${S1 ? `<div class="mv-src-how" style="--tone:${S1[3]}"><b>${S1[2]} ${S1[1]}</b><p>${esc(S1[5])}</p>
        ${["zelle", "chime", "cash"].includes(S1[0]) ? (S1[0] === "cash" ? `<button class="btn sm" data-mvadd="voice">🎙️ Say one</button>` : S1[0] === "chime" ? `<button class="btn sm" data-mvkind="document" data-mvadd="photo">📷 Snap a statement</button>` : "") : mhGate() ? "" : mvFileBtn("📥 I have the file", "")}</div>` : ""}
    <div class="mv-conn-why">${[["🔒", "Stays here", "Files are read on this phone. Your money never leaves it."], ["↔️", "No double counting", "Cash App → bank, bank → savings: marked as moving your own money, not spending."], ["♻️", "Import any time", "Same file twice? Only the new rows are added."]]
      .map(([i, h, p]) => `<div><span>${i}</span><b>${h}</b><small>${p}</small></div>`).join("")}</div>
    ${moves ? `<p class="fine">↔️ ${moves} transfer${moves === 1 ? "" : "s"} between your own accounts are kept out of your totals.</p>` : ""}`;
}
// The check-before-adding screen for a file (money.js keeps the data in MH_IMPORT; mhSubmit adds it).
function mvImportHtml() {
  const M = mh(), I = MH_IMPORT, have = new Set(M.tx.map(txKey)), fresh = I.rows.filter(r => !have.has(txKey({ ...r })));
  const inn = fresh.filter(r => r.amt > 0 && r.cat !== "transfer").reduce((n, r) => n + r.amt, 0), out = fresh.filter(r => r.amt < 0 && r.cat !== "transfer").reduce((n, r) => n - r.amt, 0);
  const moves = fresh.filter(r => r.cat === "transfer").length, s = mvSrc(I.src === "bank" ? "bank" : I.src), name = I.src === "bank" ? "your bank" : mvSrcName(I.src);
  // which account: the one this file fed last time / named like its app; a bank file goes to your checking; else a new one
  const match = I.acct || (M.accounts.find(a => a.src === I.src && I.src !== "bank") || M.accounts.find(a => I.src !== "bank" && a.name.toLowerCase().includes(mvSrcName(I.src).toLowerCase()))
    || (I.src === "bank" ? M.accounts.find(a => a.kind === "checking") : null) || {}).id || "";
  const ups = fresh.filter(r => r.amt > 0 && r.cat !== "transfer").length, flipHint = fresh.length >= 4 && ups > fresh.length * .6;
  return `<section class="mv-imp" style="--tone:${s[3]}">${mvIc(s[2], s[3])}<div class="grow"><b>Looks like ${esc(name)}</b><small>${esc(I.name)}</small></div></section>
    <div class="mv-tiles3"><div><small>New</small><b>${fresh.length}</b>${I.rows.length - fresh.length ? `<em>${I.rows.length - fresh.length} already in</em>` : ""}</div><div><small>Money in</small><b class="in">${usd(inn)}</b></div><div><small>Money out</small><b>${usd(out)}</b>${moves ? `<em>↔️ ${moves} transfer${moves === 1 ? "" : "s"}</em>` : ""}</div></div>
    ${flipHint ? `<p class="mv-alert">Most of these show as money <b>in</b>. Some card files list spending that way. <button class="btn sm ghost" data-mvflip="1">⇅ Flip them</button></p>` : `<p class="mv-center"><button class="btn sm ghost" data-mvflip="1">⇅ Signs backwards? Flip</button></p>`}
    <div class="mv-txs">${fresh.slice(0, 10).map(r => `<div class="mv-tx${r.cat === "transfer" ? " move" : ""}">${mvIc(mcat(r.cat)[1], r.amt > 0 ? "#22c55e" : mvTone(r.what, r.cat), "sm")}<div class="grow"><b>${esc(r.what || "-")}</b><small>${mDate(r.date)} · ${esc(mcat(r.cat)[2])}</small></div>
        <strong class="${r.amt > 0 && r.cat !== "transfer" ? "in" : ""}">${r.cat === "transfer" ? "↔️ " : r.amt < 0 ? "−" : "+"}${usd(Math.abs(r.amt))}</strong></div>`).join("")}</div>
    ${fresh.length > 10 ? `<p class="fine mv-center">…and ${fresh.length - 10} more.</p>` : ""}
    <form class="qa-form" data-mhimport="1"><label class="field">Which account is this?<select name="acct">${M.accounts.map(a => `<option value="${a.id}" ${a.id === match ? "selected" : ""}>${macct(a.kind)[1]} ${esc(a.name)}</option>`).join("")}
        ${mhCanAddAcct() ? `<option value="new" ${!match ? "selected" : ""}>＋ New account: ${esc(I.src === "bank" ? "Bank account" : mvSrcName(I.src))}</option>` : ""}<option value="">None</option></select></label>
      ${I.bal != null ? `<label class="mv-check fine"><input type="checkbox" name="setbal" value="1" checked><span>Set the balance to <b>${usd(Math.abs(I.bal))}</b> (from the file${I.balDate ? `, ${mDate(I.balDate)}` : ""})</span></label>` : ""}
      <div class="foot-actions"><button class="btn sm" ${fresh.length ? "" : "disabled"}>Add ${fresh.length}</button><button class="btn sm ghost" type="button" data-mhimportno="1">Cancel</button></div></form>
    <p class="fine">Categories are a guess from the description - change any one after. ↔️ = money moving between your own accounts, kept out of your totals.</p>`;
}

// ------------------------------------------------------------ CASH FLOW (v1.46, Scott 10/17: "also monthly cash flows, discretionary spending")
// Every month: money in vs money out, and the out split three ways - FIXED (rent, utilities, insurance, debt, bills,
// subscriptions: the same every month), ESSENTIALS (groceries, gas, health, kids, pets: needed, but you steer them) and
// DISCRETIONARY (eating out, shopping, fun, gifts, everything else: your choice). Transfers between your own accounts are left out.
const MV_FIXED = ["housing", "utilities", "insurance", "debt", "subs", "bills"], MV_ESS = ["groceries", "transport", "health", "family", "pets"];
const MV_FLOW_C = { in: "#2fa35a", fix: "#8a7dff", ess: "#109fbe", disc: "#d9731c" };
const mvGroup = x => x.bill || /^bill /.test(x.src || "") || MV_FIXED.includes(x.cat) ? "fix" : MV_ESS.includes(x.cat) ? "ess" : "disc";
function mvFlowMonth(m) {
  const o = { m, inc: 0, fix: 0, ess: 0, disc: 0, cats: {} };
  mhFlow().filter(x => ym(x.date) === m).forEach(x => { if (x.amt > 0) { o.inc += x.amt; return; } const g = mvGroup(x); o[g] -= x.amt; if (g === "disc") o.cats[x.cat] = (o.cats[x.cat] || 0) - x.amt; });
  o.out = o.fix + o.ess + o.disc; o.net = o.inc - o.out; return o;
}
function mvFlowHtml() {
  const t = today(), m = ym(t), months = [5, 4, 3, 2, 1, 0].map(k => { const d = parseDay(m + "-01"); d.setMonth(d.getMonth() - k); return ymd(d).slice(0, 7); });
  const T = months.map(mvFlowMonth), C = T[5], prev = T.slice(2, 5).filter(x => x.out || x.inc), avg = k => prev.length ? prev.reduce((n, x) => n + x[k], 0) / prev.length : 0;
  const short = mm => parseDay(mm + "-01").toLocaleDateString("en-US", { month: "short" }), monthLong = parseDay(t).toLocaleDateString("en-US", { month: "long" });
  if (!mh().tx.length) return `<p class="hos-hint">Log a few transactions (or import a file from your bank or Cash App) and your monthly cash flow draws itself here.</p>
    <div class="mv-links"><button class="btn sm" data-mhtab="connect">🔗 Connect your money</button><button class="btn sm ghost" data-mvadd="manual">＋ Add one</button></div>`;
  // safe to spend: what came in this month, minus what went out, minus bills still due before the month ends
  const dim = new Date(+t.slice(0, 4), +t.slice(5, 7), 0).getDate(), daysLeft = dim - +t.slice(8) + 1, due = billsLeft(t), left = C.inc - C.out - due, perDay = left > 0 ? left / daysLeft : 0;
  const hi = Math.max(1, ...T.map(x => Math.max(x.inc, x.out))), W = 340, H = 170, L = 8, B = 30, Tp = 18, cw = (W - L * 2) / 6, bw = Math.min(18, cw * .3), y = v => (H - B) - v / hi * (H - B - Tp);
  const seg = (x, from, v, c) => v > 0 ? `<rect x="${x.toFixed(1)}" y="${y(from + v).toFixed(1)}" width="${bw}" height="${Math.max(1, y(from) - y(from + v) - (from ? 2 : 0)).toFixed(1)}" rx="3" fill="${c}"/>` : "";
  const chart = `<div class="mv-chart" data-mvtips="1"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Money in and out for the last 6 months">
      <line x1="${L}" x2="${W - L}" y1="${H - B}" y2="${H - B}" class="mv-grid"/>
      ${T.map((x, i) => { const cx = L + cw * i + cw / 2, xi = cx - bw - 1, xo = cx + 1;
        return `<g data-tip="<b>${monthName(x.m)}</b><br>In ${usd(x.inc)}<br>Fixed ${usd(x.fix)} · Essentials ${usd(x.ess)}<br>Discretionary ${usd(x.disc)}<br>Net ${mvSign(x.net)}">
          <rect x="${(cx - cw / 2).toFixed(1)}" y="${Tp - 14}" width="${cw.toFixed(1)}" height="${H - Tp + 14}" fill="transparent"/>
          ${seg(xi, 0, x.inc, MV_FLOW_C.in)}${seg(xo, 0, x.fix, MV_FLOW_C.fix)}${seg(xo, x.fix, x.ess, MV_FLOW_C.ess)}${seg(xo, x.fix + x.ess, x.disc, MV_FLOW_C.disc)}
          ${x.inc || x.out ? `<text x="${cx.toFixed(1)}" y="${(Math.min(y(x.inc), y(x.out)) - 5).toFixed(1)}" class="mv-ax mv-net${x.net < 0 ? " neg" : ""}" text-anchor="middle">${x.net < 0 ? "−" : "+"}${Math.abs(x.net) >= 1000 ? `$${(Math.abs(x.net) / 1000).toFixed(1)}k` : usd(Math.abs(x.net))}</text>` : ""}
          <text x="${cx.toFixed(1)}" y="${H - 12}" class="mv-ax${i === 5 ? " now" : ""}" text-anchor="middle">${short(x.m)}</text></g>`; }).join("")}</svg><div class="mv-tip" hidden></div></div>`;
  const parts = [["fix", "Fixed", "Rent, utilities, insurance, debt, bills, subscriptions"], ["ess", "Essentials", "Groceries, gas, health, kids, pets"], ["disc", "Discretionary", "Eating out, shopping, fun, gifts, the rest"]];
  const dcats = Object.keys({ ...C.cats, ...prev.reduce((o, x) => ({ ...o, ...x.cats }), {}) }).map(k => ({ k, now: C.cats[k] || 0, usual: prev.length ? prev.reduce((n, x) => n + (x.cats[k] || 0), 0) / prev.length : 0 }))
    .filter(r => r.now || r.usual).sort((a, b) => b.now - a.now || b.usual - a.usual), dmax = Math.max(1, ...dcats.map(r => Math.max(r.now, r.usual)));
  return `<div class="mv-tstats"><div><small>In · ${short(m)}</small><b class="in">${usd(C.inc)}</b></div><div><small>Out</small><b>${usd(C.out)}</b></div><div><small>Net</small><b class="${C.net < 0 ? "neg" : "in"}">${mvSign(C.net)}</b></div></div>
    <section class="mv-safe ${left < 0 ? "neg" : ""}"><small>Safe to spend · rest of ${monthLong}</small><b>${usd(Math.max(0, left))}</b>
      <span>${left > 0 ? `about <b>${usd(perDay)}</b> a day for ${daysLeft} day${daysLeft === 1 ? "" : "s"}` : left < 0 ? `⚠️ ${usd(-left)} short with the bills still due` : "nothing spare this month"}</span>
      <em>${usd(C.inc)} in − ${usd(C.out)} out − ${usd(due)} bills still due this month</em></section>
    <h3 class="mv-h">Where ${monthLong}'s money went</h3>
    <div class="mv-split mv-split3" role="img" aria-label="Fixed ${usd(C.fix)}, essentials ${usd(C.ess)}, discretionary ${usd(C.disc)}">${parts.map(([k]) => C[k] ? `<i style="width:${(C[k] / (C.out || 1) * 100).toFixed(1)}%;background:${MV_FLOW_C[k]}"></i>` : "").join("")}</div>
    <div class="mv-parts">${parts.map(([k, l, d]) => `<div class="mv-part"><i style="background:${MV_FLOW_C[k]}"></i><div class="grow"><b>${l}</b><small>${d}</small></div>
        <strong>${usd(C[k])}<small>${C.out ? Math.round(C[k] / C.out * 100) : 0}%${prev.length ? ` · usually ${usd(avg(k))}` : ""}</small></strong></div>`).join("")}</div>
    <h3 class="mv-h">Month by month</h3>
    <div class="mv-legend"><span><i style="background:${MV_FLOW_C.in}"></i>In</span>${parts.map(([k, l]) => `<span><i style="background:${MV_FLOW_C[k]}"></i>${l}</span>`).join("")}</div>
    ${chart}
    <p class="fine mv-center">Tap a month for its numbers. The figure on top is what you kept (or overspent).</p>
    ${dcats.length ? `<h3 class="mv-h">🛍️ Discretionary, ${monthLong}</h3><div class="mv-cats">${dcats.slice(0, 8).map(r => `<div class="mv-crow"><span>${mcat(r.k)[1]} ${esc(mcat(r.k)[2])}</span>
        <div class="mv-ctrack" style="--tone:${MV_FLOW_C.disc}"><i style="width:${(r.now / dmax * 100).toFixed(1)}%"></i>${r.usual ? `<em style="left:${(r.usual / dmax * 100).toFixed(1)}%" title="Usual ${usd(r.usual)}"></em>` : ""}</div><b>${usd(r.now)}</b></div>`).join("")}</div>
      <p class="fine">White tick = your usual month (average of the 3 before). ${(() => { const d = C.disc - avg("disc"); return prev.length && Math.abs(d) >= 1 ? `Discretionary is ${d > 0 ? "up" : "down"} ${usd(Math.abs(d))} on usual so far.` : ""; })()}</p>` : ""}
    <details class="mv-table"><summary>See it as a table</summary><table class="mh-table"><tr><th></th>${T.map(x => `<th>${short(x.m)}</th>`).join("")}</tr>
      ${[["inc", "💵 In"], ["fix", "🏠 Fixed"], ["ess", "🛒 Essentials"], ["disc", "🛍️ Discretionary"], ["net", "<b>Net</b>"]].map(([k, l]) => `<tr><td>${l}</td>${T.map(x => `<td>${k === "net" ? `<b>${mvSign(x.net)}</b>` : usd(x[k])}</td>`).join("")}</tr>`).join("")}</table></details>
    <p class="fine">From what you've logged and imported. ↔️ Transfers between your own accounts aren't counted.</p>`;
}
// Tap / drag over a chart group that carries data-tip: show its numbers.
function mvTipPoint(e) {
  const box = e.target.closest && e.target.closest("[data-mvtips]"); if (!box) return;
  const g = e.target.closest("[data-tip]"), tip = box.querySelector(".mv-tip"); if (!tip) return;
  if (!g) { tip.hidden = true; return; }
  const r = box.getBoundingClientRect(), gr = g.getBoundingClientRect();
  tip.hidden = false; tip.innerHTML = g.dataset.tip; tip.style.left = Math.min(56, Math.max(0, (gr.left + gr.width / 2 - r.left) / r.width * 100 - 20)) + "%";
}
if (typeof document !== "undefined") { document.addEventListener("pointermove", mvTipPoint); document.addEventListener("pointerdown", mvTipPoint); }

// WELCOME: the first thing a new owner sees - the logo over the night island, the four promises, what's inside.
function mvWelcomeTop() {
  if (typeof document !== "undefined") document.body.classList.add("mvapp");
  return `<section class="mv-hello"><div class="mv-bal">${mvScene("home")}<div class="mv-hello-in"><img src="icon-192.png" alt="" onerror="this.remove()">
      <h1>Money <b>Hub</b></h1><p>Your financial control room</p><div class="mv-promise">${["Track", "Plan", "Save", "Stay ahead"].map(w => `<span>${w}</span>`).join("")}</div></div></div>
    <div class="mv-feats mv-hello-feats">${[["📷", "Snap receipts & bills"], ["💳", "Never miss a payment"], ["📈", "See 60 days ahead"], ["🏝️", "Goals you can see"], ["🔐", "Stays on your phone"]]
      .map(([i, l]) => `<div class="mv-feat"><span class="mv-feat-ic" aria-hidden="true">${i}</span><b>${l}</b></div>`).join("")}</div></section>`;
}

// ------------------------------------------------------------ HUB FAMILY (the Money Hub plan, part 6: "Every Hub app should be capable of
// sharing appropriate financial entries with Money Hub ... controls to prevent double-counting"). Read-only: Auto Hub's gas, service and
// paper costs and Auto / Home Hub's bills are READ from their own saved data on this phone (same web address), tagged with their hub,
// never copied. Shown once: a cost Money Hub already has (same day + amount) or a bill with the same name is skipped.
// Off with Settings -> Hub family (S.family === false), same switch as the other hubs.
const MV_FAM = [["autohub.v1", "🚗", "Auto Hub"], ["homehub.v1", "🏡", "Home Hub"]];
function mvFamily(m) {
  const out = { costs: [], bills: [] };
  if (S.family === false || typeof localStorage === "undefined") return out;
  const mine = new Set(S.bills.map(b => String(b.name || "").toLowerCase().trim())), have = new Set(mh().tx.map(x => `${x.date}|${Math.abs(x.amt).toFixed(2)}`));
  MV_FAM.forEach(([key, ic, hub]) => {
    let d = null; try { d = JSON.parse(localStorage.getItem(key) || "null"); } catch (e) { d = null; }
    if (!d || typeof d !== "object") return;
    const cost = (date, what, a, cat) => { a = Math.round((+a || 0) * 100) / 100;
      if (a > 0 && /^\d{4}-\d{2}-\d{2}$/.test(date || "") && ym(date) === m && !have.has(`${date}|${a.toFixed(2)}`)) out.costs.push({ hub, ic, date, what: String(what).slice(0, 60), amt: a, cat }); };
    (d.garage && Array.isArray(d.garage.cars) ? d.garage.cars : []).forEach(c => { if (!c || typeof c !== "object") return;
      const cn = c.nick || [c.year, c.make, c.model].filter(Boolean).join(" ") || "Car";
      (Array.isArray(c.fuel) ? c.fuel : []).forEach(f => cost(f.date, `⛽ Gas · ${cn}`, f.cost, "transport"));
      (Array.isArray(c.services) ? c.services : []).forEach(s => cost(s.date, `🔧 Service · ${cn}`, s.cost, "transport"));
      (Array.isArray(c.papers) ? c.papers : []).forEach(p => cost(p.paid, `📄 ${p.name || p.kind || "Paper"} · ${cn}`, p.cost, p.kind === "insurance" ? "insurance" : "transport")); });
    (Array.isArray(d.bills) ? d.bills : []).forEach(b => { const n = String(b && b.name || "").trim();
      if (n && !mine.has(n.toLowerCase()) && +b.amount > 0) { mine.add(n.toLowerCase()); out.bills.push({ hub, ic, name: n.slice(0, 60), amount: +b.amount, day: Math.min(31, Math.max(1, Math.round(+b.day) || 1)) }); } });
  });
  out.costs.sort((a, b) => b.date.localeCompare(a.date));
  return out;
}
function mvFamilyHtml(kind) {
  const F = mvFamily(ym(today())), L = kind === "bills" ? F.bills : F.costs;
  if (!L.length) return "";
  const tot = L.reduce((n, x) => n + (kind === "bills" ? x.amount : x.amt), 0);
  return `<section class="mv-fam"><div class="mv-grp"><h4>🔗 From your other hubs</h4><span>${usd(tot)}${kind === "bills" ? " a month" : " this month"}</span></div>
    ${L.slice(0, 12).map(x => `<div class="mv-tx">${mvIc(x.ic, x.hub === "Auto Hub" ? "#f97316" : "#22c55e", "sm")}<div class="grow"><b>${esc(kind === "bills" ? x.name : x.what)}</b>
        <small>${x.hub} · ${kind === "bills" ? `due the ${x.day}${["th", "st", "nd", "rd"][x.day % 10 > 3 || [11, 12, 13].includes(x.day) ? 0 : x.day % 10]}` : mvRel(x.date)}</small></div>
        <strong>${usd(kind === "bills" ? x.amount : x.amt)}</strong></div>`).join("")}
    <p class="fine">Read from ${[...new Set(L.map(x => x.hub))].join(" and ")} on this phone - not copied, so nothing counts twice. ${kind === "bills" ? "They're in your Cash Forecast." : "Change them in their own hub."}</p></section>`;
}

// ------------------------------------------------------------ hooks money.js calls
// The sheet's page for a tab this file draws (null = money.js draws it).
function mvPane(tab) {
  if (tab === "more") return mvMoreHtml();
  if (tab === "add") return mvAddHtml();
  if (tab === "spend") return MH_IMPORT ? mvImportHtml() : mvTxHtml();
  if (tab === "connect") return mvConnectHtml();
  if (tab === "flow") return mvFlowHtml();
  if (tab === "advisor") return mvAdvisorHtml();
  if (tab === "update") return mvUpdateHtml();
  if (tab === "forecast") return mvForecastHtml();
  if (tab === "accounts") return mvAccountsHtml();
  if (tab === "budget") return mvBudgetHtml();
  if (tab === "subs") return mvSubsHtml();
  if (tab === "reports") return mhGate() ? null : mvReportsHtml();
  if (tab === "insights") return mvInsightsHtml();
  if (tab === "vault") { setTimeout(mvThumbs, 0); return mvVaultHtml(); }
  return null;
}
function mvClick(ds) {
  const M = mh();
  if (ds.mveye) { M.hide = !M.hide; save(); render(); return true; }
  if (ds.mvview) { MV_VIEW = ds.mvview; render(); return true; }
  if (ds.mvsrc) { MV_SRC = MV_SRC === ds.mvsrc ? "" : ds.mvsrc; showMh("connect"); return true; }
  if (ds.mvflip && MH_IMPORT) { MH_IMPORT.rows = MH_IMPORT.rows.map(r => ({ ...r, amt: -r.amt, cat: r.cat === "transfer" ? r.cat : -r.amt > 0 ? "income" : catGuess(r.what) })); showMh("spend"); return true; }
  if (ds.mvtop) { window.scrollTo({ top: 0, behavior: "smooth" }); return true; }
  if (ds.mvadd !== undefined) { if (ds.mvadd === "income") { MV_ADD = "manual"; showMh("add"); const r = document.querySelector('#mhSheet [name=dir][value="in"]'); if (r) r.checked = true; return true; }
    MV_ADD = ds.mvadd || "photo"; if (ds.mvkind) MV_KIND = ds.mvkind; MV_SCAN = null; MH_MSG = ""; showMh("add"); return true; }
  if (ds.mvkind) { MV_KIND = ds.mvkind; showMh("add"); return true; }
  if (ds.mvscanno) { MV_SCAN = null; MH_MSG = ""; showMh("add"); return true; }
  if (ds.mvmic) { mvListen(); return true; }
  if (ds.mvgo === "bill") { MH_PADD = true; showMh("bills"); return true; }
  if (ds.mvask) { mvAsk(ds.mvask); return true; }
  if (ds.mvupd) { MV_UPD = ds.mvupd; showMh("update"); const el = document.getElementById("mvupd-" + ds.mvupd); if (el && el.scrollIntoView) el.scrollIntoView({ block: "center" }); return true; }
  if (ds.mvwebopen) { MV_WEB = ds.mvwebopen; showMh("update"); const i = document.querySelector(`#mvupd-${ds.mvwebopen} [name=web]`); if (i) i.focus(); return true; }
  if (ds.mvchk) { const a = M.accounts.find(x => x.id === ds.mvchk); if (a) { a.chk = today(); save(); showMh("update"); render(); toast(`✓ ${a.name} checked`); } return true; }
  if (ds.mvsoon) { toast(`👥 ${ds.mvsoon} - coming soon`); return true; }
  if (ds.mvtf) { MV_TF = ds.mvtf; MV_TC = ""; MV_MORE = 60; showMh("spend"); return true; }
  if (ds.mvtc) { MV_TC = MV_TC === ds.mvtc ? "" : ds.mvtc; MV_TF = "all"; MV_MORE = 60; showMh("spend"); return true; }
  if (ds.mvmore) { MV_MORE += 60; const el = document.getElementById("mvTxList"); if (el) el.innerHTML = mvTxList(); return true; }
  if (ds.mvpday !== undefined) { MV_PDAY = MV_PDAY === ds.mvpday ? "" : ds.mvpday; showMh("bills"); return true; }
  if (ds.mvpview) { MV_PVIEW = ds.mvpview; showMh("bills"); return true; }
  if (ds.mvdis) { M.dis = M.dis && typeof M.dis === "object" ? M.dis : {}; M.dis[ds.mvdis] = today(); save(); showMh("insights"); render(); toast("Hidden for 30 days"); return true; }
  if (ds.mvaddsub) { const [name, a] = ds.mvaddsub.split("|"); M.subs.push({ id: uid(), name: name.slice(0, 50), amt: +a || 0, every: "month", next: "" }); save(); showMh("subs"); render(); toast(`📅 ${name} tracked`); return true; }
  if (ds.mvbig !== undefined) { MV_BIG = ds.mvbig || null; showMh("vault"); return true; }
  if (ds.mvvdel) { M.vault = (M.vault || []).filter(v => v.id !== ds.mvvdel); mvTx("readwrite", s => s.delete(ds.mvvdel)).catch(() => {}); if (MV_BIG === ds.mvvdel) MV_BIG = null;
    save(); showMh("vault"); toast("🗑️ Deleted"); return true; }
  return false;
}
function mvSubmit(f, data) {
  if (f.dataset.mvsave) { mvSaveScan(data); return true; }
  if (f.dataset.mvaff) { const a = mhNum(data.amt);
    if (!(a > 0)) { MH_MSG = "Type what it costs."; mhMsgShow(); return true; }
    MV_AFF = { what: String(data.what || "").trim().slice(0, 40), amt: a, day: data.day || today() }; MH_MSG = ""; showMh("advisor"); return true; }
  if (f.dataset.mvaskf) { mvAsk(data.q); return true; }
  if (f.dataset.mvweb) { const a = mh().accounts.find(x => x.id === f.dataset.mvweb); if (!a) return true;
    const w = mvWebOk(data.web); if (data.web && !w) { MH_MSG = "Type just the website, like chase.com"; mhMsgShow(); return true; }
    a.web = w; MH_MSG = ""; MV_WEB = ""; save(); showMh("update"); toast(w ? `🔑 Sign in link saved for ${a.name}` : "Website removed"); return true; }
  return false;
}
if (typeof document !== "undefined") document.addEventListener("change", async e => {
  const t = e.target; if (MODE !== "money" || !t || !t.dataset) return;
  if (t.dataset.mvfcspend) { mh().fcSpend = t.checked; save(); showMh("forecast"); return; }
  if (t.dataset.mvvt) { MV_VT = t.value; return; }
  if (t.dataset.mvkindsel && MV_SCAN) { Object.assign(MV_SCAN.f, Object.fromEntries(new FormData(t.form))); MV_SCAN.f.kind = MV_KIND = t.value;
    if (MV_SCAN.f.who && !MV_SCAN.f.title) MV_SCAN.f.title = MV_SCAN.f.who; showMh("add"); return; }
  if (!t.files || !t.files[0]) return;
  const file = t.files[0]; t.value = "";
  if (file.size > 25e6) { MH_MSG = "That photo is too big."; mhMsgShow(); return; }
  if (t.dataset.mvphoto) { await mvRead(file); return; }
  if (t.dataset.mvgoalpic) { const g = S.goals.find(x => x.id === t.dataset.mvgoalpic); if (!g) return;
    try { g.pic = await mvShrink(file, 320); save(); showMh("goals"); render(); toast(`📷 ${g.name} has its picture`); }
    catch (er) { MH_MSG = "That doesn't look like a photo."; mhMsgShow(); } return; }
  if (t.dataset.mvvault) { try { const img = await mvShrink(file, 1600), k = MV_DOCS.find(d => d[0] === MV_VT) || MV_DOCS[6];
      await mvVaultPut({ type: k[0], title: `${k[2]} · ${mDate(today())}`, date: today(), img }); save(); showMh("vault"); toast("🔐 Saved to your vault");
    } catch (er) { MH_MSG = "Couldn't save that photo here (private browsing?)."; mhMsgShow(); } }
});

// ------------------------------------------------------------ v1.48 MONEY ADVISOR (plan: "AI Money Advisor" + "Can I afford a $2,000 vacation in December?")
// "Can I afford it?" is arithmetic on the phone - the forecast with the purchase taken out on its day - so it works
// free and offline. The AI part answers from the same numbers (mhContext) and must show its math.
// Never investment advice: forecasts and arithmetic on the owner's own log only.
let MV_AFF = null;                                               // the last check: {what, amt, day}
const MV_ASKS = ["Can I afford a $2,000 vacation in December?", "What bills are due before my next paycheck?", "Where could I cut $200 a month?", "How fast can I pay off my cards?"];
const mvGap = (a, b) => Math.round((parseDay(b) - parseDay(a)) / 864e5);
// -> {verdict yes|tight|no, before, after, lowAfter, lowDay, cushion, fitDay, perPay, paydays, pts}
function mvAfford(amt, day, onDay) {
  onDay = onDay || today(); if (!(amt > 0)) return null;
  if (!day || day < onDay) day = onDay;
  const lead = Math.min(340, mvGap(onDay, day)), n2 = Math.min(400, lead + 240);
  const F = mvForecast(onDay, n2, { spend: mh().fcSpend !== false }), P = F.pts, cushion = Math.max(100, Math.round(F.daily * 7));
  // lowest balance from day j on (the whole horizon), and in the 60 days the chart shows
  const lowIn = (j, k) => P.slice(j, k).reduce((a, p) => p.bal < a.bal ? p : a, P[j]);
  const view = Math.min(P.length, lead + 60), low = lowIn(lead, view);
  const lowAfter = low.bal - amt;
  const verdict = lowAfter >= cushion ? "yes" : lowAfter >= 0 ? "tight" : "no";
  let fitDay = null;
  if (verdict !== "yes") for (let j = lead + 1; j + 60 <= P.length; j++) if (lowIn(j, j + 60).bal - amt >= cushion) { fitDay = P[j].d; break; }
  const paydays = P.slice(0, lead + 1).filter(p => p.ev.some(e => e.label === "Payday")).length;
  const perPay = verdict !== "yes" && paydays ? Math.ceil((cushion - lowAfter) / paydays) : 0;
  return { amt, day, lead, before: P[lead].bal, after: P[lead].bal - amt, lowAfter, lowDay: low.d, cushion, verdict, fitDay, perPay, paydays,
    daily: F.daily, pts: P.slice(0, view) };
}
// Two lines: the forecast as it is (blue) and with the purchase (gold, dashed), $0 marked when it dips.
function mvAffChart(R) {
  const W = 340, H = 150, L = 44, Rt = 8, Tp = 10, B = 22, P = R.pts, n = P.length, w = P.map((p, i) => i >= R.lead ? p.bal - R.amt : p.bal);
  const all = P.map(p => p.bal).concat(w), mn = Math.min(...all), hi = Math.max(1, ...all), lo = mn < 0 ? mn : Math.max(0, mn - (hi - mn) * .25 - 1), pad = (hi - lo) * .08 || 1;
  const y = v => Tp + (hi + pad - v) / (hi + pad - (lo - (lo < 0 ? pad : 0))) * (H - Tp - B), x = i => L + i / Math.max(1, n - 1) * (W - L - Rt);
  const path = vals => vals.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  return `<div class="mv-chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Your cash with and without ${usd(R.amt)} on ${mDate(R.day)}; lowest after it ${usd(R.lowAfter)}">
    ${[hi, lo].map(v => `<line x1="${L}" x2="${W - Rt}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" class="mv-grid"/><text x="${L - 6}" y="${(y(v) + 3).toFixed(1)}" class="mv-ax" text-anchor="end">${mvK(Math.round(v))}</text>`).join("")}
    ${lo < 0 ? `<line x1="${L}" x2="${W - Rt}" y1="${y(0).toFixed(1)}" y2="${y(0).toFixed(1)}" class="mv-zero"/>` : ""}
    <path d="${path(P.map(p => p.bal))}" class="mv-line"/><path d="${path(w)}" class="mv-line2"/>
    <circle cx="${x(R.lead).toFixed(1)}" cy="${y(w[R.lead]).toFixed(1)}" r="5" class="mv-buy"/>
    ${[0, n - 1].map(i => `<text x="${x(i).toFixed(1)}" y="${H - 6}" class="mv-ax" text-anchor="${i ? "end" : "start"}">${parseDay(P[i].d).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</text>`).join("")}</svg>
    <div class="mv-legend"><span><i class="l1"></i>As it is</span><span><i class="l2"></i>With ${esc(MV_AFF && MV_AFF.what ? MV_AFF.what : "it")}</span></div></div>`;
}
function mvAffResult(R) {
  const what = MV_AFF.what || usd(R.amt), on = R.lead ? mDate(R.day) : "today";
  const head = R.verdict === "yes" ? ["✅", `Yes - ${esc(what)} fits ${on}`, `You'd still have at least ${usd(R.lowAfter)} in the 60 days after.`]
    : R.verdict === "tight" ? ["⚠️", `Tight - ${esc(what)} fits ${on}, barely`, `Your cash would drop to ${usd(R.lowAfter)} on ${mDate(R.lowDay)} - under your cushion of ${usd(R.cushion)} (a week of everyday spending).`]
    : ["⛔", `Not ${R.lead ? `on ${on}` : "today"}`, `Your cash would go below $0 - down to ${usd(R.lowAfter)} on ${mDate(R.lowDay)}.`];
  return `<section class="mv-verdict ${R.verdict}"><span class="mv-vic" aria-hidden="true">${head[0]}</span><div><b>${head[1]}</b><small>${head[2]}</small></div></section>
    <div class="mv-tiles3"><div><small>Cash ${R.lead ? "that day" : "today"}</small><b>${usd(R.before)}</b></div><div class="${R.after < 0 ? "neg" : ""}"><small>Right after</small><b>${usd(R.after)}</b></div>
      <div class="${R.lowAfter < 0 ? "neg" : ""}"><small>Lowest after</small><b>${usd(R.lowAfter)}</b><em>${mDate(R.lowDay)}</em></div></div>
    ${mvAffChart(R)}
    ${R.fitDay ? `<p class="mv-tipline">📅 It fits comfortably from <b>${mDate(R.fitDay)}</b> (${inDays(daysUntil(R.fitDay))}).</p>` : R.verdict !== "yes" ? `<p class="mv-tipline">📅 It doesn't fit comfortably in the next 6 months at today's pace.</p>` : ""}
    ${R.perPay ? `<p class="mv-tipline">💵 Or keep it ${R.lead ? `on ${on}` : "today"}: set aside about <b>${usd(R.perPay)}</b> from each of the ${R.paydays} payday${R.paydays === 1 ? "" : "s"} before then - <button class="mv-linkb" data-mhtab="goals">make it a goal</button>.</p>` : ""}
    <p class="fine">Math: your Cash Forecast (cash now, + each payday, − every bill and renewal on its day${R.daily ? `, − ${usd(R.daily)} a day everyday spending` : ""}) with ${usd(R.amt)} taken out ${on}. Cushion = a week of everyday spending, at least $100. An estimate from what you've typed - not financial advice.</p>`;
}
function mvAdvisorHtml() {
  const M = mh(), R = MV_AFF ? mvAfford(MV_AFF.amt, MV_AFF.day) : null, ready = M.accounts.length || payAmount().amt;
  return `<section class="mv-adv-hero ${R ? R.verdict : "idle"}">${mvCompass(R ? R.verdict : "")}<div><h3>Your money advisor</h3><p>${R
      ? R.verdict === "yes" ? "The needle says <b>go</b>." : R.verdict === "tight" ? "The needle says <b>careful</b>." : "The needle says <b>not yet</b>."
      : "Answers come from <b>your own numbers</b>, and every answer shows its math."}</p></div></section>
    <h3 class="mv-h">Can I afford it?</h3>
    <form class="qa-form mv-aff" data-mvaff="1"><input name="what" placeholder="What is it? e.g. Vacation" maxlength="40" value="${esc(MV_AFF ? MV_AFF.what : "")}" aria-label="What it is">
      <div class="two"><input name="amt" inputmode="decimal" placeholder="Cost $" required value="${MV_AFF ? MV_AFF.amt : ""}" aria-label="What it costs">
        <input name="day" type="date" value="${MV_AFF ? MV_AFF.day : today()}" min="${today()}" aria-label="When"></div><button class="btn">Check</button></form>
    ${!ready ? `<p class="hos-hint">Add your accounts and your payday first - the answer starts from your cash and adds every payday and bill ahead.</p>
      <div class="mv-links"><button class="btn sm" data-mhtab="accounts">🏦 Accounts</button><button class="btn sm ghost" data-mhtab="payday">💵 Payday</button></div>` : R ? mvAffResult(R) : ""}
    <h3 class="mv-h">Ask about your money</h3>
    <form class="ask-form" data-mvaskf="1"><input name="q" placeholder="Ask anything about your money…" autocomplete="off" required aria-label="Your question"><button class="btn sm">Ask</button></form>
    <div class="chips up-chips">${MV_ASKS.map(q => `<button class="chip" data-mvask="${esc(q)}">${esc(q)}</button>`).join("")}</div>
    <p class="fine">${aiOn() ? "Uses your AI helper. " : "Asking uses AI credits (⚙ → AI helper) - Can I afford it? above is always free. "}Arithmetic on your own numbers - never advice to buy or sell any investment.</p>`;
}
// The hero's compass: red / gold / green arc, the needle points at the last answer (sways gently before the first check).
function mvCompass(v) {
  const ang = v === "yes" ? 55 : v === "tight" ? 0 : v === "no" ? -55 : null, arc = (a0, a1, c) => {
    const r = 40, p = a => [50 + r * Math.sin(a * Math.PI / 180), 54 - r * Math.cos(a * Math.PI / 180)], [x0, y0] = p(a0), [x1, y1] = p(a1);
    return `<path d="M${x0.toFixed(1)} ${y0.toFixed(1)} A${r} ${r} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}" stroke="${c}" stroke-width="9" fill="none" stroke-linecap="round"/>`; };
  return `<svg class="mv-compass" viewBox="0 0 100 70" aria-hidden="true"><circle cx="50" cy="54" r="48" fill="rgba(16,32,84,.55)"/>
    ${arc(-80, -30, "#ff7a7a")}${arc(-22, 22, "#facc15")}${arc(30, 80, "#4ade80")}
    <g class="mv-needle${ang == null ? " sway" : ""}" style="transform:rotate(${ang == null ? 0 : ang}deg)"><path d="M50 54 L47 50 L50 18 L53 50Z" fill="#fff"/></g>
    <circle cx="50" cy="54" r="5" fill="#27d7ff"/></svg>`;
}
function mvAsk(q) {
  q = String(q || "").trim(); if (!q) return;
  if (aiOn()) askDayHub(q); else showAsk();
}

// ------------------------------------------------------------ v1.48 DATA UPDATE (Scott 10/17: "where you can log in and download updated info, and on the
// front say how many days on each app since updated" -> "be its own data update page"). Per account: days since its last file or typed
// balance, a Sign in button to THAT bank / app's own site (the person signs in there - Money Hub never sees a password), the file button.
const MV_LOGIN = { cashapp: "https://cash.app/account", venmo: "https://account.venmo.com/", paypal: "https://www.paypal.com/signin" };
// a.web is typed by the person ("chase.com") -> an https link; anything that isn't a plain web address is ignored
const mvWebOk = w => { const h = String(w || "").trim().replace(/^https?:\/\//i, "").replace(/\/+$/, ""); return /^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}(\/[\w\-./?=&%#]*)?$/i.test(h) ? h : ""; };
const mvLogin = a => mvWebOk(a.web) ? "https://" + mvWebOk(a.web) : MV_LOGIN[a.src] || "";
// the newest of: last file, last typed balance, last "checked - nothing new"
const mvFreshDay = a => [a.imp, a.at, a.chk].filter(Boolean).sort().pop() || "";
const mvAgeN = a => { const d = mvFreshDay(a); return d ? Math.max(0, -daysUntil(d)) : null; };
const mvAgeTone = n => n == null ? "#ff7a7a" : n <= 7 ? "#4ade80" : n <= 14 ? "#facc15" : "#ff7a7a";
const mvAgeTxt = n => n == null ? "never" : n === 0 ? "today" : n === 1 ? "1 day" : `${n} days`;
const mvAcctIc = a => { const s = a.src && a.src !== "bank" ? mvSrc(a.src) : null; return [s ? s[2] : macct(a.kind)[1], s ? s[3] : MV_ACCT_TONE[a.kind] || "#3b82f6"]; };
let MV_UPD = "", MV_WEB = "";                                        // the account the home strip was tapped on (highlighted) / whose link box is open
// Home: one chip per account, oldest first - the number is days since it was last brought up to date.
function mvFreshStrip() {
  const A = mh().accounts.slice().sort((x, y) => (mvAgeN(y) ?? 1e9) - (mvAgeN(x) ?? 1e9));
  if (!A.length) return "";
  const old = A.filter(a => (mvAgeN(a) ?? 99) > 7).length;
  return `<div class="mv-sec"><h3>Up to date?</h3><button data-mhtab="update">${old ? `${old} need${old === 1 ? "s" : ""} updating` : "Data Update"}</button></div>
    <div class="mv-fresh">${A.map(a => { const n = mvAgeN(a), [ic, tone] = mvAcctIc(a);
      return `<button class="mv-fchip" data-mvupd="${a.id}" style="--tone:${tone};--age:${mvAgeTone(n)}" aria-label="${esc(a.name)}: updated ${mvAgeTxt(n)} ago">
        <span class="mv-fic" aria-hidden="true">${ic}</span><b>${n == null ? "–" : n}</b><small>${n == null ? "never" : n === 1 ? "day" : "days"}</small><em>${esc(a.name)}</em></button>`; }).join("")}</div>`;
}
function mvUpdateHtml() {
  const M = mh(), A = M.accounts.slice().sort((x, y) => (mvAgeN(y) ?? 1e9) - (mvAgeN(x) ?? 1e9));
  if (!A.length) return `<p class="hos-hint">Add your accounts first - then this page shows how fresh each one is, with a button to sign in and get the newest file.</p>
    <div class="mv-links"><button class="btn sm" data-mhtab="accounts">🏦 Accounts</button><button class="btn sm ghost" data-mhtab="connect">🔗 Connect</button></div>`;
  const ok = A.filter(a => (mvAgeN(a) ?? 99) <= 7).length, pct = ok / A.length * 100;
  return `<section class="mv-upd-hero">${hosRing(pct, `${ok}/${A.length}`, "fresh this week", pct === 100 ? "#4ade80" : pct >= 50 ? "#facc15" : "#ff7a7a")}
      <div><h3>${pct === 100 ? "Everything is up to date" : `${A.length - ok} to bring up to date`}</h3><p>Sign in to each one, download its activity file, then tap <b>Update</b>. Green = this week, gold = 1-2 weeks, red = older.</p></div></section>
    <div class="mv-upd-list">${A.map(a => { const n = mvAgeN(a), [ic, tone] = mvAcctIc(a), url = mvLogin(a), how = a.src ? mvSrc(a.src)[5] : mvSrc(["credit", "loan"].includes(a.kind) ? "card" : "bank")[5];
      return `<article class="mv-upd${MV_UPD === a.id ? " on" : ""}" id="mvupd-${a.id}" style="--tone:${tone};--age:${mvAgeTone(n)}">
        <div class="mv-upd-top">${mvIc(ic, tone)}<div class="grow"><b>${esc(a.name)}</b><small>${a.imp ? `📥 file ${mvRel(a.imp)}` : "no file yet"}${a.at ? ` · ✍️ balance ${mvRel(a.at)}` : ""}</small></div>
          <span class="mv-age"><b>${n == null ? "–" : n}</b><small>${n == null ? "never" : n === 1 ? "day" : "days"}</small></span></div>
        <div class="mv-upd-acts">${url ? `<a class="btn sm" href="${esc(url)}" target="_blank" rel="noopener noreferrer">🔑 Sign in</a>` : a.src === "applecard" ? `<span class="mv-upd-note">🍎 Open the Wallet app</span>` : ""}
          ${mhGate() ? "" : mvFileBtn("📥 Update", a.id, `btn sm${url ? " ghost" : ""}`)}<button class="btn sm ghost" data-mvchk="${a.id}">✓ Checked</button>
          ${!url && a.src !== "applecard" && MV_WEB !== a.id ? `<button class="mv-linkb mv-addlink" data-mvwebopen="${a.id}">🔑 Add sign-in link</button>` : ""}</div>
        ${MV_UPD === a.id ? `<p class="fine">${esc(how)}</p>` : ""}
        ${MV_WEB === a.id ? `<form class="mv-webf" data-mvweb="${a.id}"><input name="web" placeholder="Its website, e.g. chase.com" value="${esc(a.web || "")}" aria-label="Website for ${esc(a.name)}" autocomplete="off"><button class="btn sm ghost">Save</button></form>` : ""}
      </article>`; }).join("")}</div>
    <p class="fine">✓ Checked = you looked and nothing changed - it resets the days without a file. Sign in opens the bank's or app's own page in your browser; Money Hub never sees or keeps a password.</p>`;
}
