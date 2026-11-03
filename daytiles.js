/* SAVE AS: daytiles.js · LOCATION: C:/MarvelApps/dayhub/daytiles.js
 * DAY HUB NEW LOOK - Phase 1 (Scott 11/01: his "Day Hub Enhanced Experience" board = Design Direction #1, with:
 *   "Less crowding on the home screen. Show today's three most important items first, while keeping other cards
 *    customizable." / "Adaptive home screen. Morning emphasizes the brief and schedule; afternoon highlights what's next;
 *    evening promotes Nightly Reset and tomorrow's preparation." / "Crisis Mode belongs to Cruise Hub ... Day Hub should
 *    link to Cruise Hub's emergency tools when relevant." / "keep Day Hub's sunrise, sky, and everyday-life identity".)
 * Phase 1 = HOME (the sky hero kept, the moment card, Top 3, today, four quick buttons, your tools) + 5 tabs:
 * Home | Today | Tasks | Money | More. Every card Day Hub has lives on one tab - nothing is lost, and the tiles follow
 * ⚙ → Arrange (order + hide).
 * Phase 2 (Scott: "Dedicated experiences for important tools. Brain Dump, Money, Tasks, and Weather should feel like polished
 * mini-apps rather than cramped dashboard widgets") = Money and Tasks get their own sections, Weather and the Pro status
 * screen (his recommendation) are full screens, Brain Dump takes over the whole phone. Each is laid over the data and
 * handlers Day Hub already has - nothing new is stored and no number is worked out a new way.
 * Phase 3 (Scott 11/03: "finish what you can on hubs") = the rest of his board: the Today timeline with Add event / Add task,
 * Trips & Cruises (Pack & Prep is its Lists tab), Upkeep, Nightly Reset and Hub Family as full screens, Top 3 in the morning
 * brief, and ✏️ on a plan (the classic app can only delete and re-add one).
 * SWITCH: DT_ON = false - nobody sees it. One phone previews it with the link ?look=tiles (kept on that phone,
 * dayhub.look); ?look=classic or More -> Classic look turns it back. Day Hub only, after set-up.
 * Loaded by index.html after shell.js (+ daytiles.css). Hooks: shell.js shellOn / shellGo / shellTabFor / shellHtml /
 * paintTabs - each guarded, so without this file Day Hub is exactly as before. sw.js keeps both files for offline.
 */
"use strict";

const DT_ON = false;                 // THE SWITCH: true = everyone on Day Hub gets the new look (Scott's go only)
const DT_KEY = "dayhub.look";
(function dtFromLink() {             // ?look=tiles|classic sets this phone's look, then leaves the address as it was
  try {
    const u = new URL(location.href), v = u.searchParams.get("look");
    if (v !== "tiles" && v !== "classic") return;
    localStorage.setItem(DT_KEY, v); u.searchParams.delete("look");
    history.replaceState(null, "", u.pathname + (u.search || "") + u.hash);
  } catch (e) { /* private mode: the link just doesn't stick */ }
})();
const dtPick = () => { try { return localStorage.getItem(DT_KEY); } catch (e) { return null; } };
function dtOn() {                    // never calls shellOn() - shellOn() calls this
  return typeof MODE !== "undefined" && MODE === "day" && typeof S !== "undefined" && !!S && !!(S.city || S.name) && !S.simple
    && (DT_ON ? dtPick() !== "classic" : dtPick() === "tiles");
}

// The five tabs (Scott's board: Home | Today | Tasks | Money | More).
const DT_SVG = p => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
const DT_TABS = [
  ["home", DT_SVG('<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>'), "Home"],
  ["today", DT_SVG('<rect x="3" y="5" width="18" height="16" rx="2.5"/><path d="M3 10h18M8 3v4M16 3v4"/>'), "Today"],
  ["tasks", DT_SVG('<rect x="3" y="3" width="18" height="18" rx="4"/><path d="M8 12.5l3 3 5-6"/>'), "Tasks"],
  ["money", DT_SVG('<rect x="3" y="6" width="18" height="13" rx="2.5"/><path d="M3 10h18"/><path d="M16 14.5h2"/>'), "Money"],
  ["more", DT_SVG('<circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/>'), "More"],
];
const DT_TAB_NAME = { home: "Home", today: "Today", tasks: "Tasks", money: "Money", more: "More" };
// Which tab each card lives on (a trucker's route = the day; loads and jobs = the work list). Anything not listed (notes,
// future me, trips, packages, home + car upkeep, email, the hub family...) is on More - so a card added later is never lost.
const DT_CARDS = {
  today: ["schedule", "tomorrow", "reset", "weather", "countdowns", "people", "route"],
  tasks: ["top3", "todos", "lists", "routines", "errands", "leave", "loads", "jobs"],
  money: ["payday", "bills", "budget", "work"],
};
const dtTabFor = k => (Object.entries(DT_CARDS).find(([, ks]) => ks.includes(k)) || ["more"])[0];

// The cards on screen right now - the same rules as render(): hidden ones out, Tomorrow from 3 PM, the Nightly reset
// from 6 PM, the errand run only with stops, email only once connected - and the same evening jumps until the user
// arranges the screen.
function dtShown(k) {
  const hr = new Date().getHours();
  return !!CARDS[k] && !S.hidden.includes(k) && !(k === "tomorrow" && hr < 15) && !(k === "reset" && hr < 18)
    && !(k === "errands" && !errandStops().length) && !(k === "inbox" && !S.mail.on && !S.mail.found.length);
}
function dtOrder() {
  const hr = new Date().getHours(); let o = cardOrder().filter(dtShown);
  const up = k => { o = [k, ...o.filter(x => x !== k)]; };
  if (!S.order && hr >= 17 && o.includes("tomorrow")) up("tomorrow");
  if (!S.order && hr >= 18 && o.includes("reset")) up("reset");
  if (!S.order && S.mail.found.length && o.includes("inbox")) up("inbox");
  return o;
}
const dtCards = (tab, cardHtml) => dtOrder().filter(k => dtTabFor(k) === tab && !DT_SCREENS[k]).map(cardHtml).join("");
// A card's own one-line summary as plain text (some come back as HTML, already escaped).
const dtText = html => { const t = document.createElement("template"); t.innerHTML = String(html || ""); return t.content.textContent.trim(); };

// The part of the day (Scott: morning = brief + schedule, afternoon = what's next, evening = reset + tomorrow).
// Evening starts at 6 PM, when the Nightly reset opens. After midnight it is night: the new day's plans, not "tomorrow".
const dtPart = () => { const h = new Date().getHours(); return h < 4 ? "night" : h < 11 ? "morning" : h < 18 ? "afternoon" : "evening"; };
const dtPlural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
const dtLeft = () => dayItems(today()).filter(i => isPlan(i) && !i.done && (!i.t || i.t >= nowT()));
const dtSame = (a, b) => !!a && !!b && a.title === b.title && (a.t || "") === (b.t || "");

// ---- the moment card, one per part of the day (each returns { html, shows } - shows = the plan it names, so the
// "What's going on" list below doesn't repeat it)
function dtMorning() {
  const left = dtLeft(), first = left[0], open = S.todos.filter(t => todoShown(t) && !todoDone(t)).length;
  return { shows: first, html: `<section class="dt-moment am"><span class="dt-k">☀️ This morning</span>
    <b>${first ? `${first.t ? esc(hm(first.t)) + " · " : ""}${esc(first.title)}` : "A clear morning — nothing planned yet"}</b>
    <small>${[dtPlural(left.length, "plan") + " today", open && dtPlural(open, "to-do")].filter(Boolean).join(" · ")}</small>
    <span class="dt-acts"><button class="btn sm" data-brief="open">☀️ Read my brief</button><button class="btn sm ghost" data-dtgo="today" data-dtcard="schedule">📅 My day</button></span></section>` };
}
function dtNext() {
  const n = dtLeft().find(i => i.t);
  if (!n) { const nx = nextPlan();
    return { html: `<section class="dt-moment pm"><span class="dt-k">⏭ What's next</span><b>Nothing else on today's schedule</b>
      ${nx ? `<small>Next: ${esc(nx.when)} · ${esc(nx.title)}</small>` : ""}
      <span class="dt-acts"><button class="btn sm ghost" data-dtadd="1">＋ Add a plan</button></span></section>` }; }
  const mins = toMin(n.t) - toMin(nowT());
  return { shows: n, html: `<button class="dt-moment pm" data-dtgo="today" data-dtcard="schedule"><span class="dt-k">⏭ What's next</span>
    <b>${esc(n.title)}</b><small>${esc(hm(n.t))}${mins > 0 ? ` · in ${esc(minsText(mins))}` : " · now"}${n.sub ? ` · ${esc(n.sub)}` : ""}</small></button>` };
}
function dtReset() {
  const done = S.resetDay === today(), open = resetData().open.length;
  return { html: `<button class="dt-moment pm-eve" data-dtgo="today" data-dtcard="reset"><span class="dt-k">🛏️ Nightly reset</span>
    <b>${done ? "Day closed ✓" : open ? `${dtPlural(open, "thing")} to wrap up` : "All wrapped up — close your day"}</b>
    <small>${done ? "Rest up. Tomorrow is ready." : "What got done, what moves to tomorrow, anything to remember"}</small></button>` };
}
// Evening: tomorrow. Night (midnight - 4 AM): the day that just began - "later today", and the tap opens its schedule.
function dtComing(night) {
  const plans = night ? dtLeft() : dayItems(addDays(today(), 1)).filter(isPlan), f = plans[0];   // night: still to come, not done
  return { shows: night ? f : null, html: `<button class="dt-moment eve" data-dtgo="today" data-dtcard="${night ? "schedule" : "tomorrow"}"><span class="dt-k">🌙 ${night ? "Later today" : "Tomorrow"}</span>
    <b>${f ? `${f.t ? esc(hm(f.t)) + " · " : ""}${esc(f.title)}` : night ? "Nothing planned today yet" : "Nothing planned yet"}</b>
    <small>${plans.length ? dtPlural(plans.length, "plan") : night ? "Get some rest" : "A good night to plan it"} · ${night ? "tap for the day" : "tap to get ready"}</small></button>` };
}
// Top 3 (Scott: "Show today's three most important items first") - the card's own ticks, ▲, ✕ and Pick again.
const dtTop3Html = () => `<section class="card dt-top3" data-card="top3"><h3><span class="ci">🎯</span>Top 3 today<span class="meta">${CARDS.top3.meta()}</span></h3>
  <div class="body">${top3Card()}</div></section>`;
// The rest of today (shell.js goingOnHtml - the same band the classic home has), less the plan the card above names.
function dtTodayHtml(skip) {
  const rows = dayItems(today()).filter(i => i.kind !== "sun" && !i.done && (!i.t || i.t >= nowT()) && !dtSame(i, skip)).slice(0, 3)
    .map(i => ({ icon: i.icon, text: i.title, sub: i.t ? hm(i.t) + (i.end ? ` – ${hm(i.end)}` : "") : "All day", act: 'data-dtgo="today" data-dtcard="schedule"' }));
  return goingOnHtml(rows, "", "Nothing else on today's schedule.");
}
// Crisis Mode is Cruise Hub's (Scott 11/01) - while a cruise is on (or 2 days out) Day Hub points there. Cruises can
// live in Cruise Hub (it takes Day Hub's over), so both hubs' trips count. The Play app keeps its store flag.
function dtCruiseHtml() {
  const tr = allTrips().find(t => isCruise(t) && t.start && daysUntil(t.start) <= 2 && daysUntil(t.end || t.start) >= 0);
  return tr ? `<a class="dt-cruise" href="${esc(hubHref(CRUISE_URL))}"><span aria-hidden="true">🛟</span><span class="grow"><b>Cruise help</b>
    <small>Back to the ship, medical, travel problems — in Cruise Hub</small></span><span class="chev" aria-hidden="true">›</span></a>` : "";
}
const dtQuickHtml = () => `<nav class="dt-quick" aria-label="Quick actions">
  <button class="dt-q add" data-dtadd="1"><span aria-hidden="true">＋</span>Add</button>
  <button class="dt-q ai" data-ask="open"><span aria-hidden="true">💡</span>Ask AI</button>
  <button class="dt-q dump" data-dump="1"><span aria-hidden="true">🧠</span>Brain Dump</button>
  <button class="dt-q leave" data-dtgo="tasks" data-dtcard="leave" data-dtshow="1"><span aria-hidden="true">🚪</span>Don't Forget</button></nav>`;
// Your tools: the cards as tiles, in the user's order (⚙ → Arrange hides or moves them). Home shows 8 (less crowding);
// "All tools" opens More, which lists every one.
const dtTileHtml = (ic, label, attrs, small, cls) => `<button class="dt-tile${cls ? " " + cls : ""}" ${attrs}><span class="dt-ic" aria-hidden="true">${ic}</span><b>${esc(label)}</b>${small ? `<small>${esc(small)}</small>` : ""}</button>`;
const dtMeta = k => { try { return CARDS[k].meta ? dtText(CARDS[k].meta()) : ""; } catch (e) { return ""; } };
const dtCardTile = k => dtTileHtml(CARDS[k].icon, CARDS[k].title, `data-dtgo="${dtTabFor(k)}" data-dtcard="${k}"`, dtMeta(k));
function dtToolsHtml(skip, max, title, arrange = true) {
  const ks = dtOrder().filter(k => !skip.includes(k)), tiles = ks.slice(0, max).map(dtCardTile);
  if (ks.length > max) tiles.push(dtTileHtml("▦", "All tools", 'data-dtgo="more"', `${ks.length - max} more`));
  return `<section class="dt-tools"><h4>${esc(title)}${arrange ? ` <button class="dt-arrange" data-arrange="1">↕ Arrange</button>` : ""}</h4><nav class="dt-grid" aria-label="${esc(title)}">${tiles.join("")}</nav></section>`;
}

function dtHomeHtml() {
  const part = dtPart(), o = dtOrder(), t3 = o.includes("top3") && dtTop3Html();
  // the moment first, then Top 3 (Scott's two asks together), then the rest
  const m = part === "morning" ? dtMorning() : part === "afternoon" ? dtNext() : part === "night" ? dtComing(true) : null;
  const seq = part === "evening"
    ? [o.includes("reset") && dtReset().html, o.includes("tomorrow") && dtComing(false).html, t3]
    : [m.html, t3, dtTodayHtml(m.shows)];
  return dtCruiseHtml() + `<div class="dt-home ${part}">${seq.filter(Boolean).join("")}</div>` + dtQuickHtml()
    + dtToolsHtml(part === "evening" ? ["top3", "reset", "tomorrow"] : ["top3"], 8, "Your tools");   // no tile for what the cards above show
}

// ---------------------------------------------------------------- Phase 2: the big tools as their own screens
let DT_MONEY = "overview", DT_TASKS = "todo", DT_UPKEEP = "home", DT_SCREEN = null, DT_FROM = null;
// A card that opens as a full screen of its own (with a ‹ back to where it was opened from). Its tile stays in the tools.
const DT_SCREENS = { weather: "weather", trips: "trips", home: "upkeep", auto: "upkeep", reset: "reset", family: "family" };
// The section each card opens in, so a tile or a chip always lands on it.
const DT_VIEW = { bills: ["money", "bills"], budget: ["money", "budget"], payday: ["money", "pay"], work: ["money", "pay"],
  top3: ["tasks", "todo"], todos: ["tasks", "todo"], errands: ["tasks", "todo"], loads: ["tasks", "todo"], jobs: ["tasks", "todo"],
  lists: ["tasks", "lists"], routines: ["tasks", "routines"], leave: ["tasks", "leave"] };
const dtSegHtml = (name, segs, cur) => `<nav class="dt-seg" aria-label="${esc(DT_TAB_NAME[name] || "Upkeep")}">${segs.map(([k, l]) =>
  `<button class="${k === cur ? "on" : ""}" data-dtseg="${name}:${k}" aria-current="${k === cur ? "page" : "false"}">${esc(l)}</button>`).join("")}</nav>`;
const dtBackHtml = title => `<h2 class="dt-title dt-backrow"><button class="dt-back" data-dtback="1" aria-label="Back">‹</button>${esc(title)}</h2>`;
// A card that IS the section: always the full card, never folded or the one-line ＋ (render() reads MINI_OPEN for both), so its
// header doesn't fold it here either (the click listener + daytiles.css). To-Do's cards are several on a page and fold as usual.
const DT_ALONE = ["bills", "budget", "payday", "work", "lists", "routines", "leave", "trips", "home", "auto"];
const dtForceOpen = k => MINI_OPEN.add(k);

// ---- MONEY: Overview · Bills · Budget · Pay · Goals. The numbers are budget()'s, the same ones the Budget card shows.
function dtMoneyTopHtml() {
  const b = budget(), mon = new Date().toLocaleDateString([], { month: "long" });
  if (!b.income) return `<section class="dt-mtop none"><span class="dt-k">${esc(mon)}</span><b>See if spending is ahead of what you bring home</b>
    <small>${S.money.type === "salary" ? "Enter your yearly salary" : "Set your hourly pay and add a few shifts"}, and this fills in.</small>
    <span class="dt-acts"><button class="btn sm" data-qa="pay">Set income</button></span></section>`;
  const out = b.bills + b.spent, pct = Math.round(out / b.income * 100), used = Math.min(100, pct);   // the ring fills to 100; the words say the real figure
  const word = b.status === "over" ? "Over pace" : b.status === "tight" ? "Tight" : "On track";
  const say = b.status === "over" ? `At this pace, ${money(-b.left)} more than you bring home` : b.status === "tight" ? `About ${money(b.left)} to spare` : `About ${money(b.perDay)}/day free`;
  return `<section class="dt-mtop ${esc(b.status)}"><div class="dt-mnums"><span class="dt-k">${esc(mon)}</span>
      <small>Take-home</small><b>${esc(money(b.income))}</b><small>Bills + spent</small><b class="out">${esc(money(out))}</b></div>
    <div class="dt-ring" style="--p:${used}" role="img" aria-label="${pct}% of take-home used, ${esc(word)}"><span><b>${pct > 999 ? "999%+" : pct + "%"}</b><small>${esc(word)}</small></span></div>
    <p class="dt-msay">${esc(say)}</p></section>`;
}
function dtBillsNextHtml() {
  if (!dtShown("bills")) return "";
  const up = upcomingBills().slice(0, 3);
  return `<section class="card dt-nextbills"><h3><span class="ci">💳</span>Next bills due${up.length ? `<button class="dt-link" data-dtseg="money:bills">All ›</button>` : ""}</h3><div class="body">
    ${up.length ? up.map(b => { const n = daysUntil(b.due);
      return `<div class="row"><div class="grow">${esc(b.name)}<span class="sub">${esc(prettyDate(b.due))} · ${esc(money(b.amount))}</span></div>
        <span class="pill ${n < 0 ? "late" : n <= 3 ? "soon" : ""}">${esc(inDays(n))}</span><button class="btn sm ghost" data-paid="${esc(b.id)}">Paid</button></div>`; }).join("")
      : `<button class="add-link" data-qa="bill">＋ Add a bill</button>`}</div></section>`;
}
function dtPaydayLineHtml() {
  if (!dtShown("payday")) return "";
  const nx = S.payday.freq ? payNext() : null, n = nx ? daysUntil(nx) : null;
  return `<button class="dt-line" data-dtseg="money:pay"><span aria-hidden="true">💵</span><span class="grow">${nx ? (n === 0 ? "<b>Payday today!</b>" : `Next payday <b>${esc(prettyDate(nx))}</b> · ${esc(inDays(n))}`) : "Set up payday"}</span><span class="chev" aria-hidden="true">›</span></button>`;
}
// Goals: the same list and forms as the Payday card's, with a section of their own (and open before payday is set).
const dtGoalsHtml = () => `<section class="card dt-goals"><h3><span class="ci">🎯</span>Savings goals</h3><div class="body">
  ${S.goals.length ? S.goals.map(g => `<div class="goal"><div class="row"><span class="grow"><b>${esc(g.name)}</b> <span class="sub">${esc(money(g.saved))} of ${esc(money(g.target))} · ${goalPct(g)}%</span></span>
      <button class="x" data-goaldel="${esc(g.id)}" aria-label="Remove">✕</button></div><div class="gbar"><span style="width:${goalPct(g)}%"></span></div>
      <form class="inline-add" data-goaladd="${esc(g.id)}"><input name="amt" type="number" min="0" step="0.01" placeholder="Put $ toward it" required><button class="btn sm">＋ Add</button></form></div>`).join("")
    : `<div class="empty">Name something you're saving for, and watch it fill up.</div>`}
  <form class="inline-add" data-goalnew="1"><input name="name" placeholder="New goal (e.g. Christmas)" required autocomplete="off"><input name="target" type="number" min="1" step="1" placeholder="$ target" required style="max-width:96px"><button class="btn sm">＋</button></form></div></section>`;
function dtMoneyHtml(cardHtml) {
  const pay = ["payday", "work"].filter(dtShown);
  const segs = [["overview", "Overview"], dtShown("bills") && ["bills", "Bills"], dtShown("budget") && ["budget", "Budget"], pay.length && ["pay", "Pay"], dtShown("payday") && ["goals", "Goals"]].filter(Boolean);
  if (!segs.some(s => s[0] === DT_MONEY)) DT_MONEY = "overview";
  const v = DT_MONEY; ["bills", "budget", "payday", "work"].forEach(dtForceOpen);
  const body = v === "bills" ? cardHtml("bills") : v === "budget" ? cardHtml("budget") : v === "pay" ? pay.map(cardHtml).join("") : v === "goals" ? dtGoalsHtml()
    : (dtShown("budget") ? dtMoneyTopHtml() : "") + dtBillsNextHtml() + dtPaydayLineHtml()
      + `<div class="dt-bigs"><button class="dt-big green" data-qa="spend">＋ Add Expense</button>${dtShown("budget") ? `<button class="dt-big blue" data-dtseg="money:budget">View Budget</button>` : ""}</div>`;
  return dtSegHtml("money", segs, v) + body;
}

// ---- TASKS: To-Do · Lists · Routines · Don't Forget
const DT_LIST_IC = [[/groc|food|shop|store/i, "🛒"], [/home|house/i, "🏠"], [/trav|trip|pack/i, "✈️"], [/work|job/i, "💼"], [/gift|christmas|birthday/i, "🎁"]];
const dtListIcon = n => (DT_LIST_IC.find(([re]) => re.test(n)) || [0, "📝"])[1];
function dtListTiles(onSel) {
  const cur = S.lists.find(l => l.id === S.listSel) || S.lists[0];
  return `<nav class="dt-grid dt-lists" aria-label="Your lists">${S.lists.map(l => { const n = l.items.filter(i => !i.done).length;
      return dtTileHtml(dtListIcon(l.name), l.name, `data-dtseg="tasks:lists" data-listsel="${esc(l.id)}"`, n ? `${n} to get` : "", onSel && cur && cur.id === l.id ? "on" : ""); }).join("")}
    ${dtTileHtml("＋", "New list", 'data-qa="list"', "", "add")}</nav>`;
}
function dtTasksHtml(cardHtml) {
  const segs = [["todo", "To-Do"], dtShown("lists") && ["lists", "Lists"], dtShown("routines") && ["routines", "Routines"], dtShown("leave") && ["leave", "Don't Forget"]].filter(Boolean);
  if (!segs.some(s => s[0] === DT_TASKS)) DT_TASKS = "todo";
  const v = DT_TASKS;
  if (v === "lists") { dtForceOpen("lists"); return dtSegHtml("tasks", segs, v) + dtListTiles(true) + cardHtml("lists"); }
  if (v === "routines") { dtForceOpen("routines"); return dtSegHtml("tasks", segs, v) + cardHtml("routines"); }
  if (v === "leave") { dtForceOpen("leave"); return dtSegHtml("tasks", segs, v) + cardHtml("leave"); }
  const others = dtOrder().filter(k => dtTabFor(k) === "tasks" && !["top3", "todos", "lists", "routines", "leave"].includes(k)).map(cardHtml).join("");
  return dtSegHtml("tasks", segs, v) + (dtShown("top3") ? cardHtml("top3") : "") + (dtShown("todos") ? `<div class="dt-todos">${cardHtml("todos")}</div>` : "")
    + `<div class="dt-bigs"><button class="dt-big blue" data-qa="todo">＋ Add Task</button></div>` + others
    + (dtShown("lists") && S.lists.length ? `<section class="dt-tools dt-quicklists"><h4>Quick lists</h4>${dtListTiles(false)}</section>` : "");
}

// ---- TODAY: four points of today's weather over the schedule; the strip opens the Weather screen
function dtHourStripHtml() {
  const w = typeof WXDATA !== "undefined" && WXDATA && WXDATA.here;
  if (!dtShown("weather") || !w || !w.hourly || !w.hourly.length) return "";
  const pts = [0, 3, 6, 9].map(i => w.hourly[i]).filter(Boolean);
  return `<button class="dt-hours" data-dtgo="today" data-dtcard="weather" aria-label="Open the full forecast">${pts.map((x, i) => `<span class="dt-h"><small>${i === 0 ? "Now" : esc(new Date(x.t).toLocaleTimeString([], { hour: "numeric" }))}</small>
      <i aria-hidden="true">${wxIcon(x.code, x.isDay)[0]}</i><b>${Math.round(x.temp)}°</b></span>`).join("")}<span class="chev" aria-hidden="true">›</span></button>`;
}

// ---- WEATHER & ALERTS: today large, then rain / freeze / what to bring, then the whole forecast the card already draws
function dtWeatherHtml() {
  const card = `<section class="card dt-wxcard" data-card="weather"><div class="body">${CARDS.weather.body()}</div></section>`;
  const w = typeof WXDATA !== "undefined" && WXDATA && WXDATA.here;
  if (!w) return dtBackHtml("Weather & Alerts") + card;                    // no city / still loading / not found: the card says what to do
  const [ic, word] = wxIcon(w.cur.weather_code, w.cur.is_day);
  // A day's low comes in its early hours, so tonight's low is tomorrow's (the same reading as the freeze alert, wxAlerts).
  // Before about 7 AM today's own low is still ahead too.
  const ahead = w.days.slice(1), early = new Date().getHours() < 7 ? w.days[0] : null, fz = early && early.lo <= 32 ? early : ahead.find(d => d.lo <= 32), bring = leaveExtras().map(x => x.text);
  const when = d => d === early ? "this morning" : d === ahead[0] ? "tonight" : `${parseDay(d.d).toLocaleDateString([], { weekday: "long" })} morning`;
  const info = (ic2, t, s) => `<div class="dt-info"><span aria-hidden="true">${ic2}</span><span class="grow"><b>${esc(t)}</b><small>${esc(s)}</small></span></div>`;
  return dtBackHtml("Weather & Alerts") + `<section class="dt-wxhero ${w.cur.is_day ? "" : "night"} ${w.cur.weather_code >= 45 ? "gloomy" : ""}"><span class="dt-k">${esc(w.label)}</span>
      <span class="dt-wxrow"><i aria-hidden="true">${ic}</i><b>${Math.round(w.cur.temperature_2m)}°</b></span><span class="dt-wxword">${esc(word)}</span>
      <small>Feels like ${Math.round(w.cur.apparent_temperature)}° · H ${Math.round(w.day.hi)}° · L ${Math.round(w.day.lo)}°</small></section>
    <section class="dt-infos">${info("☔", "Rain", w.day.rainFrom ? `Likely from ${fmtTime(w.day.rainFrom)}` : w.day.rain >= 20 ? `${w.day.rain}% chance today` : "None expected today")}
      ${info("❄️", "Freeze", fz ? `Down to ${Math.round(fz.lo)}° ${when(fz)}` : `None in the next ${ahead.length} days`)}
      ${info("🎒", "What to bring", bring.length ? bring.join(", ") : "Nothing extra today")}</section>` + card;
}

// ---- PRO STATUS (Scott: "a clearly visible Pro status screen showing subscription status, remaining access, benefits, and
// sync status"). Reads what the phone already knows. Never in the Play app (no Pro wording outside ⚙ there).
const dtProOffered = () => switchOn("PRO_GATE") && !STORE_MODE;
const dtProState = () => hubProState();                               // shell.js: Cruise Hub's Pass screen says the same
function dtProHtml() {
  const st = dtProState(), pro = isPro(), when = iso => { try { return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" }); } catch (e) { return ""; } };
  const row = (ic, name, state, tone) => `<div class="dt-prorow"><span aria-hidden="true">${ic}</span><span class="grow">${esc(name)}</span><b class="${tone}">${esc(state)}</b></div>`;
  const cal = !S.gcal.connected ? ["Not connected", ""] : syncOk("gcal") ? [S.gcal.pushed ? `On · sent ${when(S.gcal.pushed)}` : "On", "on"] : ["Paused", "soon"];
  const bak = !S.sync.on ? ["Off", ""] : syncOk("sync") ? [S.sync.last ? `On · saved ${when(S.sync.last)}` : "On", "on"] : ["Paused", "soon"];
  const ben = ["🤖 AI helper — Brain dump, Ask Day Hub, Top 3", "🗓️ Two-way Google Calendar sync", switchOn("GMAIL") && "📬 Plans found in your email", "☁️ Backup to your own Google Drive", `📱 Works on up to ${PLAN.MAX_PHONES} phones`, "🧭 One purchase covers the other Hub apps too"].filter(Boolean);
  return dtBackHtml(PLAN.NAME) + `<section class="dt-prohero ${st.tone}"><span class="dt-k">Status</span><b>${esc(st.word)}</b><small>${esc(st.say)}</small></section>
    <section class="card dt-prosync"><h3><span class="ci">🔄</span>Your sync</h3><div class="body">${row("🗓️", "Google Calendar", cal[0], cal[1])}${row("☁️", "Drive backup", bak[0], bak[1])}${row("🤖", "AI helper", aiOn() ? "On" : "Off", aiOn() ? "on" : "")}</div></section>
    <section class="card dt-proben"><h3><span class="ci">⭐</span>What it includes</h3><div class="body"><ul class="dt-prolist">${ben.map(x => `<li>${esc(x)}</li>`).join("")}</ul>
      <p class="fine" style="margin:8px 0 0">Everything else in Day Hub is free forever. No ads, ever.</p></div></section>
    <div class="dt-bigs">${st.buy ? `<a class="btn dt-probuy" href="${esc(PLAN.WHOP_CHECKOUT_URL)}" target="_blank" rel="noopener">${st.buy} ${esc(PLAN.NAME)}</a><p class="dt-price">${esc(PLAN.MONTHLY)} or ${esc(PLAN.YEARLY)}</p>` : ""}
      <button class="dt-big blue" data-dtgo="prosettings">${pro ? "Manage on this phone" : st.buy ? "Already bought? Enter your email" : "Check on this phone"}</button></div>`;
}

// ---------------------------------------------------------------- Phase 3: the rest of the board
// ---- TODAY: the Schedule card (its day arrows, NOW line and rows), a ✏️ on every plan you made, and the two Add buttons
const dtScheduleHtml = cardHtml => cardHtml("schedule").replace(/<button class="x" data-del="(?:events:|occ:)([^":]+)[^"]*"/g,
  (m, id) => `<button class="x" data-dtevedit="${esc(id)}" aria-label="Edit">✏️</button>${m}`);
const dtResetLine = () => `<button class="dt-line" data-dtgo="today" data-dtcard="reset"><span aria-hidden="true">${CARDS.reset.icon}</span><span class="grow"><b>Nightly reset</b> · ${esc(dtMeta("reset"))}</span><span class="chev" aria-hidden="true">›</span></button>`;
function dtTodayTabHtml(cardHtml) {
  const body = dtOrder().filter(k => dtTabFor(k) === "today" && k !== "weather").map(k => k === "reset" ? dtResetLine() : k !== "schedule" ? cardHtml(k)
    : dtScheduleHtml(cardHtml) + `<div class="dt-bigs two"><button class="dt-big blue" data-qa="event">＋ Add event</button><button class="dt-big green" data-qa="todo">＋ Add task</button></div>`).join("");
  return dtHourStripHtml() + (body || `<div class="dt-empty">Nothing here right now — ⚙ → Arrange shows hidden cards again.</div>`);
}
// Change a plan you made, in the same form that added it. It is edited in place, so its id, its skipped days and the Google copy
// (matched by id, sent again when it changes) all stay right. A repeating plan changes every repeat, and says so.
function dtEditEvent(id) {
  const ev = S.events.find(x => x.id === id); if (!ev) return;
  openQA("event");
  const f = document.getElementById("qaForm"), set = (n, v) => { const el = f.querySelector(`[name="${n}"]`); if (el) el.value = v == null ? "" : v; };
  set("title", ev.title); set("date", ev.day); set("time", ev.time); set("where", ev.where); set("rep", ev.rep || "none");
  if (!ev.time) { const t = f.querySelector('[name="time"]'); if (t) t.required = false; }             // an imported all-day plan stays all-day
  f.insertAdjacentHTML("afterbegin", `<input type="hidden" name="dtevedit" value="${esc(id)}"><div class="dt-editing"><b>Change this plan</b>${isRep(ev) ? "<small>This changes every repeat.</small>" : ""}</div>`);
  const b = f.querySelector("button.btn:last-of-type"); if (b) b.textContent = "Save";
}
document.addEventListener("submit", e => {                             // before ui.js, which would add a new plan
  const f = e.target, h = f.id === "qaForm" && f.querySelector('[name="dtevedit"]');
  if (!h) return;
  e.preventDefault(); e.stopImmediatePropagation();
  const ev = S.events.find(x => x.id === h.value), d = Object.fromEntries(new FormData(f));
  if (!ev) { closeQA(); return; }
  snap(); const moved = ev.day !== d.date || ev.time !== d.time;
  Object.assign(ev, { title: d.title.trim(), day: d.date, time: d.time, where: (d.where || "").trim(), rep: d.rep || "none" });
  if (moved) Object.keys(S.remind.fired).forEach(k => { if (k.startsWith(`ev:${ev.id}:`)) delete S.remind.fired[k]; });   // a new time rings again; a new title doesn't
  if (!occursOn(ev, VIEW)) VIEW = d.date;                              // stay on the day you were looking at, if the plan is still on it
  save(); closeQA(); render(); buzz(); toast("Saved ✓", true);
}, true);

// ---- TRIPS & CRUISES (board: next trip, Trip ready %, final payment / packing / documents / excursions, View trip, Add trip).
// The head reads readiness() and the trip's own lists; below it is the Trips card with every tab it has. Pack & Prep = its Lists.
const dtHubLink = (url, cls, label) => `<a class="${cls}" href="${esc(hubHref(url))}" data-famopen="1">${label}</a>`;
function dtTripHeadHtml(tr) {
  const R = readiness(tr), sd = tr.start ? daysUntil(tr.start) : null, nights = tripNights(tr), cr = isCruise(tr), L = tr.lists || {};
  const away = sd !== null && sd <= 0 && daysUntil(tr.end || tr.start) >= 0, back = sd !== null && sd <= 0 && !away;
  const count = k => { const a = L[k] || []; return `${a.filter(i => i.done).length} of ${a.length}`; };
  const row = (ic, name, state, go) => `<button class="dt-line" data-dttrip="${go}"><span aria-hidden="true">${ic}</span><span class="grow">${esc(name)} <b>${esc(state)}</b></span><span class="chev" aria-hidden="true">›</span></button>`;
  const left = tr.total ? tripLeft(tr) : null, ports = tr.ports || [];
  const pay = tr.total ? (left === 0 ? "paid in full ✓" : `${money(left)} left${tr.finalDue ? ` · by ${prettyDate(tr.finalDue)}` : ""}`) : "add the price";
  return `<section class="dt-triphero"><div class="dt-tripnums"><span class="dt-k">${away ? "Right now" : back ? "Just back" : "Next trip"}</span><b class="nm">${cr ? "🚢" : "✈️"} ${esc(tr.name)}</b>
      <small>${tr.start ? `${esc(prettyDate(tr.start))}${tr.end ? ` – ${esc(prettyDate(tr.end))}` : ""}${nights ? ` · ${nights} nights` : ""}` : "Add the dates"}</small>
      ${sd !== null && sd > 0 ? `<span class="dt-tripn"><b>${sd}</b> ${sd === 1 ? "day" : "days"} to go</span>` : away ? `<span class="dt-tripn">🎉 You're away!</span>` : ""}</div>
    <div class="dt-ring" style="--p:${R.pct}" role="img" aria-label="Trip ${R.pct}% ready"><span><b>${R.pct}%</b><small>ready</small></span></div>
    <p class="dt-tripnext">${R.next ? `➡️ ${esc(R.next.action)}` : "✅ Nothing needs you right now."}</p></section>
    <nav class="dt-triprows" aria-label="Trip ready">${row("💳", "Final payment", pay, "money")}${row("🧳", "Packing", `${count("packing")} packed`, "lists:packing")}${row("📄", "Documents", `${count("docs")} done`, "lists:docs")}
      ${cr ? row("🤿", "Excursions", ports.length ? `${ports.filter(p => p.excursion).length} of ${ports.length} ports planned` : "add your port days", "ports") : ""}</nav>`;
}
function dtTripsHtml(cardHtml) {
  const tr = curTrip(); dtForceOpen("trips");
  return dtBackHtml("Trips & Cruises") + (tr ? dtTripHeadHtml(tr) : "") + cardHtml("trips")
    + `<div class="dt-bigs two"><button class="dt-big green" data-qa="trip">＋ Add a trip</button>${dtHubLink(tr && !isCruise(tr) ? TRIP_URL : CRUISE_URL, "dt-big blue", tr && !isCruise(tr) ? "✈️ More in Trip Hub" : "🛳️ More in Cruise Hub")}</div>`;
}

// ---- UPKEEP (board: Home / Auto, soonest first). The Home and Car cards with what's next on top. Miles are Auto Hub's job.
function dtUpkeepHtml(cardHtml) {
  const areas = ["home", "auto"].filter(dtShown), a = areas.includes(DT_UPKEEP) ? DT_UPKEEP : areas[0] || "home"; DT_UPKEEP = a; dtForceOpen(a);
  const first = S.upkeep.filter(x => x.area === a).map(x => ({ x, day: upkeepNext(x) })).sort((p, q) => p.day.localeCompare(q.day))[0], n = first ? daysUntil(first.day) : 0;
  const hub = HUBS.find(h => h.id === (a === "home" ? "homehub" : "autohub"));
  return dtBackHtml("Upkeep") + (areas.length > 1 ? dtSegHtml("upkeep", [["home", "🏠 Home"], ["auto", "🚗 Car"]], a) : "")
    + (first ? `<section class="dt-uphero ${n < 0 ? "late" : ""}"><span class="dt-k">${n < 0 ? "Overdue" : "Next up"}</span><b>${esc(first.x.name)}</b><small>${esc(dtText(upkeepWhen(first.x, first.day)))} · ${esc(prettyDate(first.day))}</small></section>` : "")
    + cardHtml(a) + `<div class="dt-bigs"><button class="dt-big blue" data-dtupadd="1">＋ Add something</button></div>`
    + (hub ? dtHubLink(hub.url, "dt-line", `<span aria-hidden="true">${hub.icon}</span><span class="grow"><b>${esc(hub.name)}</b><small>${esc(hub.what)}</small></span><span class="chev" aria-hidden="true">›</span>`) : "");
}

// ---- NIGHTLY RESET (board: brain dump, completed today, still open, move to tomorrow, remember for tomorrow). resetHtml() is all of it.
function dtResetHtml() {
  const { done, open } = resetData(), closed = S.resetDay === today();
  return dtBackHtml("Nightly Reset") + `<section class="dt-resethero"><span class="dt-k">${esc(longDate(today()))}</span>
      <b>${closed ? "Day closed ✓" : open.length ? `${dtPlural(open.length, "thing")} to wrap up` : "All wrapped up"}</b><small>${dtPlural(done.length, "thing")} done${open.length ? ` · ${open.length} still open` : ""}</small></section>`
    + (closed ? "" : `<button class="dt-line" data-dump="1"><span aria-hidden="true">🧠</span><span class="grow"><b>Brain dump</b><small>Get it out of your head before bed</small></span><span class="chev" aria-hidden="true">›</span></button>`)
    + `<section class="card dt-resetcard" data-card="reset"><div class="body">${resetHtml()}</div></section>`;
}

// ---- HUB FAMILY (board: every Hub as a tile, Hub Universe last). The same list as the card, with the same links.
function dtFamilyHtml() {
  const sd = sibData(), list = HUBS.filter(h => h.id !== APP_ID), rows = list.filter(h => h.id !== "hubuniverse").concat(list.filter(h => h.id === "hubuniverse"));
  const inner = h => `<span class="dt-ic" aria-hidden="true">${h.icon}</span><b>${esc(h.name)}</b>${h.soon ? `<span class="tag">COMING SOON</span>` : ""}${h.id === SIB.id && sd && sd.src === "phone" ? `<span class="tag">ON THIS PHONE ✓</span>` : ""}<small>${esc(h.what)}</small>`;
  return dtBackHtml("Hub Family") + `<section class="dt-famwrap" data-card="family"><nav class="dt-fam" aria-label="Hub family">${rows.map(h => h.soon ? `<div class="dt-famtile">${inner(h)}</div>` : dtHubLink(h.url, `dt-famtile${h.id === "hubuniverse" ? " wide" : ""}`, inner(h))).join("")}</nav>
    <p class="dt-famfine">Made by Marvel Corp. They work together${STORE_MODE ? "" : " — one Pro unlocks the family"}. No ads, ever.</p></section>`;
}

// ---- MORNING BRIEF (board: Top 3 for today). The same brief; a Top 3 you picked takes the place of the to-do list. Called from
// app.js showBrief, which also opens it by itself in the morning.
function dtBriefDress(el) {
  if (!dtOn()) return;
  const T = S.top3.day === today() ? S.top3.items.filter(x => !x.done) : [];
  if (!T.length) return;
  const html = `<section class="brief-sec"><h3>Top 3 today</h3>${T.map(x => `<div class="row"><span class="grow">🎯 ${esc(x.title)}</span></div>`).join("")}</section>`;
  const old = [...el.querySelectorAll(".brief-sec")].find(s => /^Top to-dos/.test(s.querySelector("h3").textContent));
  if (old) old.outerHTML = html; else { const go = el.querySelector(".brief-go"); if (go) go.insertAdjacentHTML("beforebegin", html); }
}

// MORE: the tools that are not a card, the look, every tool as a tile, then the cards that live here.
function dtMoreHtml(cardHtml) {
  const T = [["💡", "Ask AI", 'data-ask="open"', ""], ["🧠", "Brain Dump", 'data-dump="1"', ""], ["☀️", "Morning brief", 'data-brief="open"', ""],
    dtProOffered() && ["⭐", PLAN.NAME, 'data-dtgo="pro"', dtProState().word],
    ["🔔", "Reminders", 'data-dtgo="reminders"', ""], ["⚙️", "Settings", 'data-dtgo="settings"', ""], ["↕", "Arrange", 'data-arrange="1"', "order + hide"], ["🎨", "Classic Look", 'data-dtgo="classic"', "the old screen"]].filter(Boolean);
  return `<nav class="dt-grid dt-more" aria-label="More">${T.map(t => dtTileHtml(...t)).join("")}</nav>`
    + dtToolsHtml([], 99, "All your tools", false) + dtCards("more", cardHtml);   // Arrange is a tile just above
}

// Called by shell.js shellHtml() while the new look is on.
function dtShellHtml(cardHtml) {
  if (DT_SCREEN === "pro" && !dtProOffered()) DT_SCREEN = null;
  document.body.classList.toggle("dt-screen", !!DT_SCREEN);
  if (DT_SCREEN === "weather") return dtWeatherHtml();
  if (DT_SCREEN === "pro") return dtProHtml();
  if (DT_SCREEN === "trips") return dtTripsHtml(cardHtml);
  if (DT_SCREEN === "upkeep") return dtUpkeepHtml(cardHtml);
  if (DT_SCREEN === "reset") return dtResetHtml();
  if (DT_SCREEN === "family") return dtFamilyHtml();
  if (TAB === "home") return dtHomeHtml();
  const head = `<h2 class="dt-title">${esc(DT_TAB_NAME[TAB] || "")}</h2>`;
  if (TAB === "more") return head + dtMoreHtml(cardHtml);
  if (TAB === "money") return head + dtMoneyHtml(cardHtml);
  if (TAB === "tasks") return head + dtTasksHtml(cardHtml);
  return head + dtTodayTabHtml(cardHtml);
}

// Fewer, better chips up top (Scott: "Less crowding on the home screen"; the inventory found bills buried behind "+N more").
// The cards below already show the next plan, the brief and the to-dos count, so those chips step aside; what's left goes in
// order of what can cost you. Called from app.js heroHtml; off the look, the list passes through untouched.
function dtChips(list) {
  if (!dtOn()) return list;
  // Each test reads only the chip's own tag or its first words, never a name someone typed further along. The brief chip goes only
  // while the morning card offers the brief (the chip runs to noon, the card to 11).
  const tag = c => (c.match(/^<[^>]*>/) || [""])[0], text = c => c.replace(/^<[^>]*>\s*/, "");
  const hide = c => /^(⏭|☀ No rain|✅ \d+ to-do)/.test(text(c)) || (/data-brief=/.test(tag(c)) && dtPart() === "morning");
  const rank = c => { const t = tag(c); return /data-update/.test(t) ? 0 : /data-prolapse/.test(t) ? 1 : /data-rmdel/.test(t) ? 2 : /^💳/.test(text(c)) || /chip warn/.test(t) ? 3 : /^💵 Payday/.test(text(c)) ? 4 : /chip good/.test(t) ? 5 : 6; };
  return list.filter(c => !hide(c)).map((c, i) => [rank(c), i, c]).sort((a, b) => a[0] - b[0] || a[1] - b[1]).map(x => x[2]);
}

// Brain Dump takes the whole phone (Scott's board: "Get it out of your head. I'll sort it for you." + Tap to Talk). It is the
// same form and sorter - this only dresses it (daytiles.css makes the sheet full height while it holds the brain dump).
function dtDumpDress() {
  const f = document.getElementById("qaForm"), ta = f && f.querySelector('textarea[name="dump"]');
  if (!ta || f.querySelector(".dt-dumphero")) return;
  const hero = document.createElement("div"); hero.className = "dt-dumphero";
  hero.innerHTML = `<div class="dt-brain" aria-hidden="true">🧠</div><h2>Brain Dump</h2><p>Get it out of your head. I'll sort it for you.</p>`;
  const mic = f.querySelector("[data-mic]");
  if (mic) { mic.classList.remove("sm", "ghost"); mic.classList.add("dt-mic"); hero.appendChild(mic); }
  f.prepend(hero);
  const hint = f.querySelector(".hint");
  if (hint) hint.insertAdjacentHTML("afterend", `<div class="dt-dumpinto"><b>I'll turn it into</b><span>✅ To-dos</span><span>🔔 Reminders</span><span>🛒 Shopping</span><span>💡 Ideas</span></div>`);
}

// Open a card from anywhere: its tab, then scroll to it (the schedule back on today). Saves - and so marks backup and
// calendar as changed - only when the card really was folded, or hidden on a tap that means "show me" (Don't Forget,
// as the classic 🚪 does).
function dtReveal(k, unhide) {
  let ch = false;
  if (unhide && S.hidden.includes(k)) { S.hidden = S.hidden.filter(x => x !== k); ch = true; }
  if (!DT_SCREENS[k] && S.collapsed.includes(k)) { S.collapsed = S.collapsed.filter(x => x !== k); ch = true; }   // a full screen ignores folding, so nothing changes
  dtForceOpen(k);
  if (k === "schedule") VIEW = today();
  if (ch) save();
  const v = DT_VIEW[k]; if (v) { if (v[0] === "money") DT_MONEY = v[1]; else DT_TASKS = v[1]; }
  DT_SCREEN = DT_SCREENS[k] || null; DT_FROM = DT_SCREEN ? TAB : null;  // ‹ goes back to where it was opened from
  if (k === "home" || k === "auto") DT_UPKEEP = k;
  const tab = dtTabFor(k);
  if (tab !== TAB) shellGo(tab); else { render(); window.scrollTo({ top: 0 }); }
  // A screen or section that IS this card opens at its top, with its back button or section bar. A card among others is scrolled to.
  if (k === "work" || (!DT_SCREENS[k] && k !== "top3" && !DT_ALONE.includes(k))) setTimeout(() => { const el = document.querySelector(`#cards [data-card="${k}"]`); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); }, 60);
}

// Taps that belong to the new look. Taps ui.js already handles by scrolling to a card on THIS page (the hero's 🚪 Don't
// forget / 🔁 routine / 🛍️ errand chips, Life pulse "Go") run first as usual; then, if that card lives on another tab, we go there.
document.addEventListener("click", e => {
  if (!dtOn()) return;
  const fold = e.target.closest && e.target.closest("h3[data-collapse]");
  if (fold && DT_ALONE.includes(fold.dataset.collapse)) { e.stopImmediatePropagation(); return; }   // a section's own card doesn't fold (ui.js would save it folded, and nothing would move)
  const b = e.target.closest && e.target.closest("button, a");
  if (!b) return;
  const ds = b.dataset;
  const after = ds.pulsego || (ds.leave && "leave") || (ds.errands && "errands") || (ds.ropen && b.closest("#hero") && "routines") || (ds.readygo && "trips");
  if (after) { setTimeout(() => { if (!document.querySelector(`#cards [data-card="${after}"]`)) dtReveal(after); }, 0); return; }
  if (ds.dump || ds.qtype === "dump") { setTimeout(dtDumpDress, 0); return; }   // ui.js opens it; then it gets dressed
  if (ds.shellgo) { DT_SCREEN = null; DT_FROM = null; return; }       // a tab: leave any full screen (shell.js does the rest)
  if (ds.dtback) { const from = DT_FROM; DT_SCREEN = null; DT_FROM = null; if (from && from !== TAB) shellGo(from); else { render(); window.scrollTo({ top: 0 }); } return; }
  if (ds.dtevedit) { dtEditEvent(ds.dtevedit); return; }
  if (ds.dtupadd) { openQA("upkeep"); const a = document.querySelector('#qaForm [name="area"]'); if (a) a.value = DT_UPKEEP; return; }   // the Car tab adds to the car
  if (ds.dttrip) { const [t, l] = ds.dttrip.split(":"); S.tripTab = t; if (l) S.tripList = l; saveLocal(); render();
    const c = document.querySelector('#cards [data-card="trips"]'); if (c) c.scrollIntoView({ behavior: "smooth", block: "start" }); return; }
  if (ds.dtseg) { const [name, v] = ds.dtseg.split(":"); if (name === "money") DT_MONEY = v; else if (name === "upkeep") DT_UPKEEP = v; else DT_TASKS = v;
    if (ds.listsel) setTimeout(() => window.scrollTo({ top: 0 }), 0); else { render(); window.scrollTo({ top: 0 }); } return; }   // data-listsel: ui.js picks the list + renders
  if (ds.dtadd) { openQA("event"); return; }
  const go = ds.dtgo;
  if (!go) return;
  if (go === "settings") { if (typeof openSettings === "function") openSettings(); return; }
  if (go === "pro") { DT_SCREEN = "pro"; DT_FROM = null; render(); window.scrollTo({ top: 0 }); return; }
  if (go === "prosettings" || go === "reminders") { openSettings(); setTimeout(() => { const el = document.getElementById(go === "reminders" ? "remindBox" : "proBox"); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); }, 60); return; }
  if (go === "classic") { try { localStorage.setItem(DT_KEY, "classic"); } catch (e2) { /* private mode */ } DT_SCREEN = null; MINI_OPEN.clear(); render(); window.scrollTo({ top: 0 }); toast("Classic look on this phone"); return; }   // the classic cards fold as they were
  if (ds.dtcard) dtReveal(ds.dtcard, !!ds.dtshow); else shellGo(go);
});
