/* SAVE AS: daytiles.js · LOCATION: C:/MarvelApps/dayhub/daytiles.js
 * DAY HUB NEW LOOK - Phase 1 (Scott 11/01: his "Day Hub Enhanced Experience" board = Design Direction #1, with:
 *   "Less crowding on the home screen. Show today's three most important items first, while keeping other cards
 *    customizable." / "Adaptive home screen. Morning emphasizes the brief and schedule; afternoon highlights what's next;
 *    evening promotes Nightly Reset and tomorrow's preparation." / "Crisis Mode belongs to Cruise Hub ... Day Hub should
 *    link to Cruise Hub's emergency tools when relevant." / "keep Day Hub's sunrise, sky, and everyday-life identity".)
 * Phase 1 = HOME (the sky hero kept, the moment card, Top 3, today, four quick buttons, your tools) + 5 tabs:
 * Home | Today | Tasks | Money | More. Every card Day Hub has lives on one tab - nothing is lost, and the tiles follow
 * ⚙ → Arrange (order + hide). Phase 2 = Brain Dump, Money, Tasks and Weather as full screens.
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
const dtCards = (tab, cardHtml) => dtOrder().filter(k => dtTabFor(k) === tab).map(cardHtml).join("");
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

// MORE: the tools that are not a card, the look, every tool as a tile, then the cards that live here.
function dtMoreHtml(cardHtml) {
  const T = [["💡", "Ask AI", 'data-ask="open"', ""], ["🧠", "Brain Dump", 'data-dump="1"', ""], ["☀️", "Morning brief", 'data-brief="open"', ""],
    ["⚙️", "Settings", 'data-dtgo="settings"', ""], ["↕", "Arrange", 'data-arrange="1"', "order + hide"], ["🎨", "Classic Look", 'data-dtgo="classic"', "the old screen"]];
  return `<nav class="dt-grid dt-more" aria-label="More">${T.map(t => dtTileHtml(...t)).join("")}</nav>`
    + dtToolsHtml([], 99, "All your tools", false) + dtCards("more", cardHtml);   // Arrange is a tile just above
}

// Called by shell.js shellHtml() while the new look is on.
function dtShellHtml(cardHtml) {
  if (TAB === "home") return dtHomeHtml();
  const head = `<h2 class="dt-title">${esc(DT_TAB_NAME[TAB] || "")}</h2>`;
  if (TAB === "more") return head + dtMoreHtml(cardHtml);
  const body = dtCards(TAB, cardHtml);
  return head + (body || `<div class="dt-empty">Nothing here right now — ⚙ → Arrange shows hidden cards again.</div>`);
}

// Open a card from anywhere: its tab, then scroll to it (the schedule back on today). Saves - and so marks backup and
// calendar as changed - only when the card really was folded, or hidden on a tap that means "show me" (Don't Forget,
// as the classic 🚪 does).
function dtReveal(k, unhide) {
  let ch = false;
  if (unhide && S.hidden.includes(k)) { S.hidden = S.hidden.filter(x => x !== k); ch = true; }
  if (S.collapsed.includes(k)) { S.collapsed = S.collapsed.filter(x => x !== k); ch = true; }
  if (typeof MINI !== "undefined" && MINI[k]) MINI_OPEN.add(k);
  if (k === "schedule") VIEW = today();
  if (ch) save();
  const tab = dtTabFor(k);
  if (tab !== TAB) shellGo(tab); else render();
  setTimeout(() => { const el = document.querySelector(`#cards [data-card="${k}"]`); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); }, 60);
}

// Taps that belong to the new look. Taps ui.js already handles by scrolling to a card on THIS page (the hero's 🚪 Don't
// forget / 🔁 routine / 🛍️ errand chips, Life pulse "Go") run first as usual; then, if that card lives on another tab, we go there.
document.addEventListener("click", e => {
  if (!dtOn()) return;
  const b = e.target.closest && e.target.closest("button, a");
  if (!b) return;
  const ds = b.dataset;
  const after = ds.pulsego || (ds.leave && "leave") || (ds.errands && "errands") || (ds.ropen && b.closest("#hero") && "routines");
  if (after) { setTimeout(() => { if (dtTabFor(after) !== TAB) dtReveal(after); }, 0); return; }
  if (ds.dtadd) { openQA("event"); return; }
  const go = ds.dtgo;
  if (!go) return;
  if (go === "settings") { if (typeof openSettings === "function") openSettings(); return; }
  if (go === "classic") { try { localStorage.setItem(DT_KEY, "classic"); } catch (e2) { /* private mode */ } render(); window.scrollTo({ top: 0 }); toast("Classic look on this phone"); return; }
  if (ds.dtcard) dtReveal(ds.dtcard, !!ds.dtshow); else shellGo(go);
});
