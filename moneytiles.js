/* SAVE AS: moneytiles.js · LOCATION: C:/MarvelApps/dayhub/moneytiles.js
 * MONEY HUB NEW LOOK - "Emerald Vault" (Scott 11/06: his own ChatGPT boards, three of them, 25 screens; 11/07 "cont" = build it next). A private
 * vault at night: emerald green and polished gold, a round brass vault door, green marble, glossy tiles with white line icons, a painted picture
 * across the top of every inner screen (../moneyhub/art/, made on OpenArt for this look: no text, banknotes, faces or real places).
 *   HOME  = the shield logo, the eye and the gear, his Cash card (cash available, owed, net this month, next payday), "Up to date?", his 12 tiles
 *           in his order (Accounts, Transactions, Bills, Budget, Subscriptions, Debt, Payday, Goals, Forecast, Can I Afford It?, Vault, Reports),
 *           then one scroll down: what needs you, due soon, the quick log, and the to-do and list cards as before.
 *   TABS  = Home | Accounts | Bills | Plan | More, with his gold + (Add) floating above the middle. Accounts and Bills open their pages;
 *           Plan and More are lists of every page, grouped.
 *   PAGES = every Money Hub page (money.js / moneyviz.js, their own panes, forms and buttons) as a full screen: a back arrow, a big title, a
 *           picture across the top, no tab bar (his boards). The page sheet is dressed after it is drawn; nothing inside it changes.
 * Everything opens what Money Hub already has. Nothing new is stored; nothing is worked out a new way. His boards' new-feature screens (debt
 * payoff comparison, what-if, bill details, account details) are not built: they wait for his call.
 * SWITCH: MT_ON = false - customers keep the classic look and fetch none of the art. A phone gets it with ?look=tiles (kept in moneyhub.look),
 * by holding Scott Hub or the owner's OK (once), or with five quick taps on the app's name at the bottom of Settings (only a phone that already
 * picked a look or holds one of those keys). More -> Classic Look turns it back. Money Hub only, and only once it is set up.
 * Loaded by ../moneyhub/index.html after moneyviz.js, before ui.js (+ moneytiles.css). Wraps paintHero, mvHomeHtml, mvNavHtml and showMh; each
 * runs exactly as before while the look is off.
 * DEPLOY ORDER: push dayhub first and let Pages publish, then moneyhub (its page, its worker and the art).
 */
"use strict";

const MT_ON = false;                 // THE SWITCH: true = everyone on Money Hub gets the new look (Scott's go only)
const MT_KEY = "moneyhub.look";
(function mtFromLink() {             // ?look=tiles|classic sets this phone's look, then leaves the address as it was
  try {
    const u = new URL(location.href), v = u.searchParams.get("look");
    if (v !== "tiles" && v !== "classic") return;
    localStorage.setItem(MT_KEY, v); u.searchParams.delete("look");
    history.replaceState(null, "", u.pathname + (u.search || "") + u.hash);
  } catch (e) { /* private mode: the link just doesn't stick */ }
})();
const mtPick = () => { try { return localStorage.getItem(MT_KEY); } catch (e) { return null; } };
// A phone that may flip the look by five taps (as Auto, Trip and Home Hub's): it already picked a look, or it holds Scott Hub or the owner's OK.
const mtOwnerish = () => { try { return !!mtPick() || !!localStorage.getItem("scotthub.k") || localStorage.getItem("dayhub.ownerok") === "1"; } catch (e) { return false; } };
let MT_OWNER_CHECKED = false;
function mtOwnerOnce() {             // the owner's phone turns it on by itself, once; after that Classic Look sticks. Customers have neither key.
  if (MT_OWNER_CHECKED) return; MT_OWNER_CHECKED = true;
  try {
    if (localStorage.getItem("moneyhub.ownerlook") || !(localStorage.getItem("scotthub.k") || localStorage.getItem("dayhub.ownerok") === "1")) return;
    localStorage.setItem("moneyhub.ownerlook", "1"); localStorage.setItem(MT_KEY, "tiles");
  } catch (e) { /* private mode */ }
}
function mtOn() {
  if (typeof MODE === "undefined" || MODE !== "money") return false;
  if (typeof mhSet !== "function" || !mhSet()) return false;              // the welcome stays the classic screen
  mtOwnerOnce();
  return MT_ON ? mtPick() !== "classic" : mtPick() === "tiles";
}
const mtLive = () => mtOn() && (typeof MV_VIEW === "undefined" || MV_VIEW !== "orbit");   // the Orbit view (More) stays the old screen
let MT_TAB = "home";                 // home | plan | more (the tab bar's own views); Accounts and Bills open their pages

// ------------------------------------------------------------ white line icons (his board's tiles), drawn here: no image files
const MI = {
  bank: '<path d="M3 9.5 12 4l9 5.5"/><path d="M5 10.5v7M9.5 10.5v7M14.5 10.5v7M19 10.5v7"/><path d="M3 20h18"/>',
  swap: '<path d="M4 8h15l-3.5-3.5"/><path d="M20 16H5l3.5 3.5"/>',
  bills: '<rect x="4" y="5" width="16" height="15" rx="2.5"/><path d="M8 3v4M16 3v4M4 10h16M8 14h3M8 17h6"/>',
  pie: '<path d="M11 4a8 8 0 1 0 9 9h-9z"/><path d="M14 3.2A8 8 0 0 1 20.8 10H14z"/>',
  repeat: '<path d="M17 3l3 3-3 3"/><path d="M4 12v-1.5A4.5 4.5 0 0 1 8.5 6H20"/><path d="M7 21l-3-3 3-3"/><path d="M20 12v1.5a4.5 4.5 0 0 1-4.5 4.5H4"/>',
  card: '<rect x="3" y="6" width="18" height="12" rx="2.5"/><path d="M3 10.5h18M7 15h4"/>',
  cash: '<rect x="3" y="7" width="18" height="10" rx="2"/><circle cx="12" cy="12" r="2.6"/><path d="M6.5 10v4M17.5 10v4"/>',
  target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
  trend: '<path d="M4 19.5h16"/><path d="M5 15.5l4.5-4.5 3 3 6.5-6.5"/><path d="M15 7.5h4v4"/>',
  tag: '<path d="M3.5 12.5V4.5h8l9 9-8 8z"/><circle cx="8" cy="9" r="1.6"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/><path d="M12 15v2.5"/>',
  bars: '<path d="M4 20h16"/><path d="M7 16.5v-4M12 16.5V7M17 16.5v-6.5"/>',
  home: '<path d="M4 11 12 4l8 7"/><path d="M6 10v10h12V10"/><path d="M10 20v-5h4v5"/>',
  plan: '<rect x="5" y="4" width="14" height="17" rx="2.5"/><path d="M9 4.5h6v3H9z"/><path d="M8.5 12.5l2 2 4-4M8.5 17.5h7"/>',
  more: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.6"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.6"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.6"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.6"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeoff: '<path d="M3 3l18 18"/><path d="M10.6 6.1A9.6 9.6 0 0 1 12 6c6 0 9.5 6 9.5 6a17 17 0 0 1-3 3.6M6.4 7.6A16.6 16.6 0 0 0 2.5 12S6 18 12 18a9 9 0 0 0 4.4-1.1"/><path d="M9.9 10a3 3 0 0 0 4.1 4.1"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
  spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 15.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>',
  wave: '<path d="M3 9c3-3 6 3 9 0s6 3 9 0"/><path d="M3 15c3-3 6 3 9 0s6 3 9 0"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-14.3-4.9L4 8"/><path d="M4 3.5V8h4.5"/><path d="M4 13a8 8 0 0 0 14.3 4.9L20 16"/><path d="M20 20.5V16h-4.5"/>',
  chat: '<path d="M4 5.5h16v10H9l-5 4z"/><path d="M8 9.5h8M8 12.5h5"/>',
  orbit: '<circle cx="12" cy="12" r="2.5"/><ellipse cx="12" cy="12" rx="9.5" ry="4.5"/>',
  palette: '<path d="M12 3a9 9 0 0 0 0 18c1.3 0 2-.8 2-1.8 0-1.4-1.2-1.6-1.2-2.8 0-1 .8-1.6 1.8-1.6H17a4 4 0 0 0 4-4C21 6.6 17 3 12 3z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7" r="1"/><circle cx="14.5" cy="7" r="1"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  coin: '<ellipse cx="12" cy="7" rx="7" ry="3"/><path d="M5 7v5c0 1.7 3.1 3 7 3s7-1.3 7-3V7"/><path d="M5 12v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5"/>',
  check: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.7 2.7L16 9.8"/>',
  cal: '<rect x="4" y="5" width="16" height="15" rx="2.5"/><path d="M8 3v4M16 3v4M4 10h16"/><path d="M9 15h2M13 15h2"/>',
};
const mi = (k, cls = "mt-ic") => `<span class="${cls}" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${MI[k] || MI.more}</svg></span>`;
// his shield: gold, with three green bars rising
const MT_LOGO = `<svg viewBox="0 0 48 52" aria-hidden="true"><defs><linearGradient id="mtg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6dc8a"/><stop offset=".55" stop-color="#d4a23c"/><stop offset="1" stop-color="#9c6d1c"/></linearGradient></defs>
  <path d="M24 2 44 9v15c0 13-9 22-20 26C13 46 4 37 4 24V9z" fill="url(#mtg)" stroke="#5c3d0c" stroke-width="1.5"/><path d="M24 7 39 12.5v11.7c0 10-6.8 17-15 20.3C15.8 41.2 9 34.2 9 24.2V12.5z" fill="#0f3b26"/>
  <path d="M16 33V27M24 33V21M32 33V16" stroke="#f6dc8a" stroke-width="4" stroke-linecap="round"/></svg>`;

// ------------------------------------------------------------ HOME: his Cash card, Up to date?, the 12 tiles
const MT_TILES = [["accounts", "bank", "Accounts", "t-acc"], ["spend", "swap", "Transactions", "t-tx"], ["bills", "bills", "Bills", "t-bills"],
  ["budget", "pie", "Budget", "t-bud"], ["subs", "repeat", "Subscriptions", "t-subs"], ["debt", "card", "Debt", "t-debt"],
  ["payday", "cash", "Payday", "t-pay"], ["goals", "target", "Goals", "t-goals"], ["forecast", "trend", "Forecast", "t-fc"],
  ["advisor", "tag", "Can I Afford It?", "t-aff"], ["vault", "lock", "Vault", "t-vault"], ["reports", "bars", "Reports", "t-rep"]];
const mtTile = ([k, ic, label, cls]) => `<button class="mt-tile ${cls}" data-mhtab="${k}">${mi(ic)}<b>${esc(label)}</b></button>`;
// The hidden top band's must-see notices (new version, Install, Pro paused / ending, backup waiting, tap to sync), all of them for this one
// read, as Home and Auto Hub's looks do (hometiles.js htNoticesHtml, autotiles.js).
function mtNoticesHtml() {
  if (typeof heroHtml !== "function") return "";
  const was = CHIPS_ALL; CHIPS_ALL = true; let html = "";
  try { html = heroHtml(); } finally { CHIPS_ALL = was; }
  const box = document.createElement("template"); box.innerHTML = html;
  const keep = [...box.content.querySelectorAll(".chips > [data-update], .chips > [data-install], .chips > [data-prolapse], .chips > [data-cloudask], .chips > [data-sync], .chips > [data-syncall], .chips > [data-brief]")];
  return keep.length ? `<div class="mt-notices">${keep.map(c => c.outerHTML).join("")}</div>` : "";
}
function mtTop() {
  return `<div class="mt-top"><span class="mt-logo">${MT_LOGO}</span><b class="mt-brand">Money Hub</b>${navigator.onLine === false ? `<span class="offline-pill mt-off">🟠 Offline</span>` : ""}
    <button class="mt-round" data-mveye="1" aria-pressed="${mvHidden()}" aria-label="${mvHidden() ? "Show amounts" : "Hide amounts"}">${mi(mvHidden() ? "eyeoff" : "eye")}</button>
    <button class="mt-round" data-mtgo="settings" aria-label="Settings">${mi("gear")}</button></div>`;
}
// Scott's board (11/09 pass): a stack of three gold coins beside the Cash number, drawn here (no picture file), so it stays sharp on any phone.
function mtCoinStack() {
  const coin = (cx, cy) => `<path d="M${cx - 21} ${cy}v7a21 7.6 0 0 0 42 0v-7" fill="url(#mtcs-side)" stroke="#5c3a08" stroke-opacity=".55" stroke-width=".9"/>
    <ellipse cx="${cx}" cy="${cy}" rx="21" ry="7.6" fill="url(#mtcs-top)" stroke="#7a5310" stroke-opacity=".6" stroke-width=".9"/>
    <ellipse cx="${cx}" cy="${cy}" rx="14.5" ry="5" fill="none" stroke="#a87418" stroke-opacity=".55" stroke-width="1.2"/>
    <path d="M${cx - 12} ${cy - 3.2}q6-2.6 13-1.8" fill="none" stroke="#fff6cf" stroke-opacity=".85" stroke-width="1.4" stroke-linecap="round"/>`;
  return `<span class="mt-coin mt-coinstack" aria-hidden="true"><svg viewBox="0 0 60 56">
    <defs><linearGradient id="mtcs-side" x1="0" x2="1"><stop offset="0" stop-color="#7a4d0e"/><stop offset=".38" stop-color="#f0c75e"/><stop offset=".62" stop-color="#c48d26"/><stop offset="1" stop-color="#6b430c"/></linearGradient>
      <radialGradient id="mtcs-top" cx=".36" cy=".3" r=".8"><stop offset="0" stop-color="#fff3c2"/><stop offset=".45" stop-color="#f1c650"/><stop offset="1" stop-color="#b98219"/></radialGradient></defs>
    ${coin(30, 41)}${coin(28, 31)}${coin(31, 21)}</svg></span>`;
}
function mtCashHtml() {
  const t = today(), T = monthTotals(ym(t)), nx = payNext(t), net = T.inc - T.out;
  const owed = mh().accounts.filter(a => ["credit", "loan"].includes(a.kind)).reduce((n, a) => n + (+a.bal || 0), 0);
  const old = mh().accounts.filter(a => (mvAgeN(a) ?? 99) > 7).length;
  return `<section class="mt-cash" aria-label="Cash">
      <button class="mt-cash-main" data-mhtab="accounts">${mtCoinStack()}<span><small>Cash</small><b class="mt-big">${mv$(cashNow())}</b><em>Cash available</em></span></button>
      <div class="mt-cash-row"><button data-mhtab="debt"><small>Owed</small><b>${mv$(owed)}</b></button>
        <button data-mhtab="flow"><small>Net this month</small><b class="${net < 0 ? "neg" : "pos"}">${mvHidden() ? "•••" : (net < 0 ? "−" : "+") + usd(Math.abs(Math.round(net)))}</b></button></div>
      <button class="mt-payday" data-mhtab="payday">${mi("cal")}${nx ? `Next payday ${esc(mDate(nx))}` : "Set your payday"}</button>
    </section>
    <button class="mt-fresh" data-mhtab="update">${mi("check")}${!mh().accounts.length ? "Add an account to start" : old ? `Up to date? ${old} need${old === 1 ? "s" : ""} updating` : "Up to date? Tap to check"}</button>`;
}
const mtMask = txt => mvHidden() ? String(txt).replace(/\$[\d,]+(\.\d\d)?/g, "$•••••") : String(txt);   // the eye: amounts inside words
function mtBelowHtml() {                // one scroll down: what needs you, due soon, the quick log
  const t = today(), next = mhNext(t), un = payRows(t).filter(r => !r.paid), soon = un.filter(r => daysUntil(r.due) <= 7).slice(0, 3);
  return `<section class="mt-card mt-below">
      <button class="mt-next" data-mhtab="${esc(next.tab)}"><span class="mt-next-ic" aria-hidden="true">${next.icon}</span><span class="grow"><small>Needs you</small><b>${esc(mtMask(next.text))}</b><em>${esc(mtMask(next.why))}</em></span><span aria-hidden="true">›</span></button>
      <h3 class="mt-h">Due soon</h3>
      ${soon.length ? soon.map(r => { const d = daysUntil(r.due);
        return `<button class="mt-row" data-mhtab="bills"><span class="grow"><b>${esc(r.b.name)}</b><small>${mv$(+r.b.amount || 0)}${r.b.auto ? " · autopay" : ""}</small></span>
          <em class="${d < 0 ? "late" : d <= 1 ? "warn" : ""}">${d < 0 ? "Late" : d === 0 ? "Today" : d === 1 ? "Tomorrow" : `In ${d} days`}</em></button>`; }).join("")
        : `<p class="mt-hint">${S.bills.length ? "Nothing due in the next 7 days." : "Add your bills and they show up here before they're due."}</p>`}
      <h3 class="mt-h">Quick log</h3>
      <form class="hos-quick mt-quick" data-mhquick="1"><input name="amt" inputmode="decimal" placeholder="$ spent" aria-label="Amount spent" required>
        <input name="what" placeholder="What for" aria-label="What for"><select name="cat" aria-label="Category"><option value="">Guess it</option>${catOpts("")}</select><button class="mt-qbtn" aria-label="Log spending">＋</button></form>
    </section>`;
}
function mtHomeHtml() {
  return `<section class="mt-hero">${mtTop()}${mtCashHtml()}${mtNoticesHtml()}</section>
    <nav class="mt-grid" aria-label="Money Hub">${MT_TILES.map(mtTile).join("")}</nav>${mtBelowHtml()}`;
}
// ------------------------------------------------------------ PLAN and MORE: every page, grouped
const MT_PLAN = [["advisor", "tag", "Can I Afford It?", "t-aff"], ["forecast", "trend", "Cash Forecast", "t-fc"], ["flow", "wave", "Cash Flow", "t-tx"],
  ["payday", "cash", "Payday", "t-pay"], ["budget", "pie", "Budget", "t-bud"], ["goals", "target", "Goals", "t-goals"],
  ["debt", "card", "Debt", "t-debt"], ["subs", "repeat", "Subscriptions", "t-subs"], ["insights", "spark", "Insights", "t-rep"]];
const mtTitleBar = title => `<div class="mt-bar">${mtTop().replace('<b class="mt-brand">Money Hub</b>', `<b class="mt-brand">${esc(title)}</b>`)}</div>`;
function mtPlanHtml() {
  return mtTitleBar("Plan") + `<p class="mt-lead">Look ahead: what's coming, what fits, and what's left.</p>
    <nav class="mt-grid" aria-label="Plan">${MT_PLAN.map(mtTile).join("")}</nav>`;
}
function mtMoreHtml() {
  const row = ([ic, label, attrs, sub]) => `<button class="mt-mrow" ${attrs}>${mi(ic)}<span class="grow"><b>${esc(label)}</b>${sub ? `<small>${esc(sub)}</small>` : ""}</span><span aria-hidden="true">›</span></button>`;
  const grp = (title, rows) => `<section class="mt-card mt-more"><h3 class="mt-h">${title}</h3>${rows.map(row).join("")}</section>`;
  return mtTitleBar("More") +
    grp("Money", [["bank", "Accounts", 'data-mhtab="accounts"', "what you have and owe"], ["swap", "Transactions", 'data-mhtab="spend"', "search, filters, bring in a file"],
      ["bills", "Bills", 'data-mhtab="bills"', "list, calendar, mark paid"], ["repeat", "Subscriptions", 'data-mhtab="subs"', ""], ["bars", "Reports", 'data-mhtab="reports"', ""]]) +
    grp("Plan", [["tag", "Can I Afford It?", 'data-mhtab="advisor"', ""], ["trend", "Cash Forecast", 'data-mhtab="forecast"', "60 days ahead"], ["wave", "Cash Flow", 'data-mhtab="flow"', ""],
      ["cash", "Payday & your pay", 'data-mhtab="payday"', ""], ["pie", "Budget", 'data-mhtab="budget"', ""], ["target", "Goals", 'data-mhtab="goals"', ""], ["card", "Debt", 'data-mhtab="debt"', ""],
      ["spark", "Smart Insights", 'data-mhtab="insights"', "made from your own numbers"]]) +
    grp("Up to date", [["refresh", "Update my accounts", 'data-mhtab="update"', "days since each was brought up to date"], ["link", "Bring in a bank file", 'data-mhtab="connect"', "never a password"]]) +
    grp("Records & help", [["lock", "Document Vault", 'data-mhtab="vault"', "on this phone only"], ["chat", `Ask ${APP_NAME}`, 'data-ask="open"', "answers from your own numbers"],
      ["plan", "Brain dump", 'data-dump="1"', "get it out of your head"]]) +
    grp("App", [["gear", "Settings", 'data-mtgo="settings"', "reminders, backup, your data"], ["orbit", "Orbit view", 'data-mvview="orbit"', "the older home"],
      ["palette", "Classic Look", 'data-mtgo="classic"', "the old screen"]]) +
    `<p class="mt-fine">An estimate from what you've typed. Your bank is the real number. Money Hub never asks for a bank password and never moves money.</p>`;
}
function mtPageHtml() { return MT_TAB === "plan" ? mtPlanHtml() : MT_TAB === "more" ? mtMoreHtml() : mtHomeHtml(); }

// ------------------------------------------------------------ the tab bar (his board): Home | Accounts | Bills | Plan | More + the gold +
const MT_NAV = [["home", "home", "Home", 'data-mtgo="home"'], ["accounts", "bank", "Accounts", 'data-mhtab="accounts"'], ["bills", "bills", "Bills", 'data-mhtab="bills"'],
  ["plan", "plan", "Plan", 'data-mtgo="plan"'], ["more", "more", "More", 'data-mtgo="more"']];
function mtNavHtml() {
  return MT_NAV.map(([k, ic, label, attrs]) => `<button class="${MT_TAB === k ? "on" : ""}" ${attrs} aria-current="${MT_TAB === k ? "page" : "false"}" aria-label="${label}">${mi(ic, "mt-nic")}<span>${label}</span></button>`).join("")
    + `<button class="mt-plus" data-mhtab="add" aria-label="Add">${mi("plus", "mt-pic")}</button>`;
}

// ------------------------------------------------------------ PAGES: the page sheet as a full screen (back arrow, big title, a picture)
const MT_PAGES = { spend: ["Transactions", "spend"], accounts: ["Accounts", "accounts"], bills: ["Bills", "bills"], budget: ["Budget", "budget"], debt: ["Debt Planner", "debt"],
  subs: ["Subscriptions", "subs"], payday: ["Payday", "payday"], goals: ["Savings Goals", "goals"], reports: ["Reports", "reports"], add: ["Add", "spend"],
  more: ["Everything", ""], forecast: ["Cash Forecast", "forecast"], insights: ["Smart Insights", "reports"], vault: ["Financial Vault", "vault"],
  connect: ["Bring In a File", "accounts"], flow: ["Cash Flow", "forecast"], advisor: ["Can I Afford It?", "afford"], update: ["Up to Date", "accounts"] };
function mtDress() {
  const el = document.getElementById("mhSheet"); if (!el) return;
  const on = mtLive(); el.classList.toggle("mt-full", on);
  if (!on) return;
  const body = el.querySelector(".sheet-body"), head = body && body.querySelector(".sheet-head");
  if (!head || head.classList.contains("mt-head")) return;
  const [title, art] = MT_PAGES[MH_TAB] || [((MH_TABS.find(x => x[0] === MH_TAB) || [])[2]) || "Money Hub", ""];
  head.className = "sheet-head mt-head";
  head.innerHTML = `<button class="mt-back" data-mhclose="1" aria-label="Back">‹</button><h2>${esc(title)}</h2>`;
  if (art) head.insertAdjacentHTML("afterend", `<div class="mt-band mt-band-${art}" aria-hidden="true"></div>`);
}

// ------------------------------------------------------------ the wraps: each runs exactly as before while the look is off
const MT_OLD = { hero: typeof paintHero === "function" ? paintHero : null, home: mvHomeHtml, nav: mvNavHtml, show: showMh };
if (MT_OLD.hero) paintHero = function () {          // every render starts here: the look's class on the page, before anything is drawn
  const on = mtLive();
  document.body.classList.toggle("mt", on);
  if (on) document.body.dataset.mttab = MT_TAB; else delete document.body.dataset.mttab;
  return MT_OLD.hero.apply(this, arguments);
};
mvHomeHtml = function () {
  if (!mtLive()) return MT_OLD.home.apply(this, arguments);
  return mtPageHtml();
};
mvNavHtml = function (on) { return mtLive() ? mtNavHtml() : MT_OLD.nav(on); };
showMh = function (tab) { MT_OLD.show(tab); mtDress(); };

// ------------------------------------------------------------ taps that belong to the look
document.addEventListener("click", e => {          // the Orbit view (More) and its "Control room" button come back to Home, not to More
  const v = e.target.closest && e.target.closest("button[data-mvview]");
  if (v && typeof MODE !== "undefined" && MODE === "money" && mtOn()) MT_TAB = "home";
}, true);
document.addEventListener("click", e => {
  const b = e.target.closest && e.target.closest("button[data-mtgo]");
  if (!b || typeof MODE === "undefined" || MODE !== "money") return;
  const go = b.dataset.mtgo;
  if (go === "home" || go === "plan" || go === "more") {
    if (go === MT_TAB && go === "home") { window.scrollTo({ top: 0, behavior: "smooth" }); return; }
    MT_TAB = go; if (typeof hideMh === "function" && MH_OPEN) hideMh(); render(); window.scrollTo({ top: 0 }); return; }
  if (go === "settings") { if (typeof openSettings === "function") openSettings(); return; }
  if (go === "classic") { try { localStorage.setItem(MT_KEY, "classic"); } catch (e2) { /* private mode */ } MT_TAB = "home"; render(); window.scrollTo({ top: 0 }); toast("Classic look on this phone"); return; }
});
// Any other copy on his phone: five quick taps on the app's name at the bottom of Settings flip the look, whatever browser it lives in.
let MT_NAME_TAPS = [];
document.addEventListener("click", e => {
  const b = e.target.closest && e.target.closest("#sheet p.fine > b");
  if (!b || !/Marvel Corp app/.test(b.textContent) || typeof MODE === "undefined" || MODE !== "money" || !mhSet() || !mtOwnerish()) return;   // never on a customer's phone
  const now = Date.now(); MT_NAME_TAPS = MT_NAME_TAPS.filter(x => now - x < 3000).concat(now);
  if (MT_NAME_TAPS.length < 5) return;
  MT_NAME_TAPS = []; const on = !mtOn();
  try { localStorage.setItem(MT_KEY, on ? "tiles" : "classic"); localStorage.setItem("moneyhub.ownerlook", "1"); } catch (e2) { /* private mode */ }
  MT_TAB = "home"; closeSettings(); render(); window.scrollTo({ top: 0 }); toast(on ? "New look on for this phone" : "Classic look on this phone");
});
// The phone's own back button walks the same path as the arrow on screen (as the Cruise, Trip and Home Hub looks do): an open page or sheet
// closes first, Plan or More goes Home, only Home leaves the app. Never on the old look.
let MT_DEPTH = 0, MT_SKIP = 0, MT_SYNC_T = 0, MT_STACK = [];
const MT_CLOSERS = ["mhclose", "askclose", "pulseclose", "close", "upclose", "billclose", "readyclose", "forgetclose", "hclose"].map(k => `[data-${k}]`).join(", ");
function mtStack() {                 // the open sheets in the order they opened (a sheet opened over a page is the newest)
  const open = [...document.querySelectorAll(".sheet:not(.hidden)")];
  MT_STACK = MT_STACK.filter(el => open.includes(el)); open.forEach(el => { if (!MT_STACK.includes(el)) MT_STACK.push(el); });
  return MT_STACK;
}
function mtSyncHistory() {
  MT_SYNC_T = 0;
  if (MT_SKIP || typeof MODE === "undefined" || MODE !== "money") return;
  const want = mtLive() ? (MT_TAB !== "home" ? 1 : 0) + mtStack().length : 0;
  try {
    if (want && "scrollRestoration" in history) history.scrollRestoration = "manual";
    while (MT_DEPTH < want) history.pushState({ mt: ++MT_DEPTH }, "");
    if (MT_DEPTH > want) { MT_SKIP++; setTimeout(() => { MT_SKIP = 0; }, 1500); history.go(want - MT_DEPTH); MT_DEPTH = want; }
  } catch (e) { MT_DEPTH = want; /* some browsers limit this; the arrow still works */ }
}
function mtSyncSoon() { if (!MT_SYNC_T) MT_SYNC_T = setTimeout(mtSyncHistory, 0); }
document.addEventListener("click", () => { if (typeof MODE !== "undefined" && MODE === "money") mtSyncSoon(); });
window.addEventListener("popstate", () => {
  if (MT_SKIP) { MT_SKIP--; mtSyncSoon(); return; }
  if (typeof MODE === "undefined" || MODE !== "money" || !mtLive()) return;
  MT_DEPTH = Math.max(0, MT_DEPTH - 1);
  const st = mtStack();
  if (st.length) { const el = st[st.length - 1], x = el.querySelector(MT_CLOSERS);   // only the newest sheet closes
    if (x) x.click(); else { el.classList.add("hidden"); render(); }
    mtSyncSoon(); return; }
  if (MT_TAB !== "home") { MT_TAB = "home"; render(); window.scrollTo({ top: 0 }); mtSyncSoon(); return; }
  if (history.state && history.state.mt) history.back();
});
