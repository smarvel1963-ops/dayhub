/* SAVE AS: shell.js · LOCATION: C:/MarvelApps/dayhub/shell.js
 * THE HUB SHELL (V1 step 7, Scott's navigation map 10/4: "Only 5 permanent tabs:
 * HOME | PLAN | EXPLORE | WALLET | AI. Those five never move." + "One giant button
 * ... its position never changes. Only its job changes.").
 *
 * On for Cruise Hub (SHELL_MODES). Day Hub keeps its cards for now.
 *   HOME    - what matters right now: the hero, at most 3 RIGHT NOW items, NEXT UP,
 *             and the big contextual button.
 *   PLAN    - the trip (Ready / Ports / Lists / Tips...), schedule, to-dos, lists.
 *   EXPLORE - my ports, my ship, weather, the hub family.
 *   WALLET  - money, onboard spending, perks / benefits.
 *   AI      - Ask Cruise Hub with questions that fit the moment.
 * Rule from the map: a new feature goes INSIDE one of the five - never a new tab.
 * Loaded after cruise.js, before ui.js.
 */
"use strict";

const SHELL_MODES = ["cruise"];
const SHELL_TABS = [["home", "🏠", "Home"], ["plan", "📅", "Plan"], ["explore", "🌎", "Explore"], ["wallet", "👛", "Wallet"], ["ai", "✨", "AI"]];
const SHELL_CARDS = { plan: ["trips", "inbox", "schedule", "todos", "lists"], explore: ["weather", "family"], wallet: ["trips"] };
// Trips-card tabs per shell tab (null = all of them).
const SHELL_TRIP_TABS = { plan: null, wallet: ["money", "onboard", "perks"] };
// Opens on HOME. "cruisehub.startTab" (phone storage) overrides it - used by the test suite.
let TAB = (() => { try { return localStorage.getItem(APP_ID + ".startTab") || "home"; } catch (e) { return "home"; } })();
const shellOn = () => SHELL_MODES.includes(MODE) && !!(S.city || S.name);
const shellTripTabOk = k => !shellOn() || !SHELL_TRIP_TABS[TAB] || SHELL_TRIP_TABS[TAB].includes(k);
const shellTabFor = key => key === "trips" ? "plan" : (Object.entries(SHELL_CARDS).find(([, ks]) => ks.includes(key)) || ["plan"])[0];
function shellGo(tab) {
  if (!SHELL_TABS.some(t => t[0] === tab)) return;
  TAB = tab; render(); window.scrollTo({ top: 0 });
}

// ---- the big button: one place, its job changes with the moment
function bigButton(tr) {
  const h = new Date().getHours();
  if (!tr || !tr.start) return { label: "🚢 PLAN MY CRUISE", act: 'data-qa="trip"' };
  const sd = daysUntil(tr.start), end = tr.end || tr.start;
  const gh = typeof goHomeState === "function" && goHomeState(tr);
  if (gh === "final") return { label: "🌙 GET ME HOME READY", act: 'data-gohome="open"' };
  if (gh === "leave") return { label: "🏠 GET ME HOME", act: 'data-gohome="open"' };
  if (guardFor(tr)) return { label: "🚢 BACK TO SHIP", act: 'data-rg="open"' };
  if (daysUntil(end) < 0) return { label: "🏠 AFTER THE TRIP", act: 'data-shellgo="plan" data-triplistgo="after"' };
  if (sd === 1 || (sd === 0 && !tr.aboard)) return { label: "🚗 GET ME TO MY SHIP", act: 'data-help="get"' };
  if (sd > 1) return { label: "🛳️ WHAT AM I FORGETTING?", act: 'data-forget="1"' };
  return h >= 16 && h < 23 ? { label: "🌙 PLAN TONIGHT", act: `data-askq="Plan tonight for us on the ship."` }
    : { label: "✨ WHAT SHOULD WE DO NOW?", act: `data-askq="What should we do now?"` };
}
// ---- RIGHT NOW: at most 3 things that need the traveler (Scott: "Home = maximum 3 priorities")
function rightNow(tr) {
  const out = [];
  if (!tr) return out;
  const R = readiness(tr);
  R.items.filter(i => i.now && i.score < 1 && i.action).slice(0, 2).forEach(i => out.push({ icon: "🟡", text: i.action.replace(/\s*\([^)]*\)/g, ""), act: 'data-shellgo="plan"' }));
  const cw = cruiseWxChip(); if (cw) { const m = cw.match(/>([^<]+)<\/button>/); if (m) out.push({ icon: "", text: m[1].trim(), act: 'data-cwx="1"' }); }
  const W = tripWallet(tr), fd = tr.finalDue ? daysUntil(tr.finalDue) : null;
  if (fd !== null && fd >= 0 && fd <= 30 && tripLeft(tr) && !out.some(o => /final payment/i.test(o.text))) out.push({ icon: "💳", text: `Final payment ${inDays(fd)} — ${money(tripLeft(tr))}`, act: 'data-shellgo="wallet"' });
  if (W.unused && tr.end && daysUntil(tr.end) <= 2 && daysUntil(tr.end) >= 0) out.push({ icon: "🎁", text: `${W.unused} benefit${W.unused === 1 ? "" : "s"} not used yet`, act: 'data-shellgo="wallet"' });
  return out.slice(0, 3);
}
// ---- NEXT UP: the next thing with a day (port, all aboard, excursion, final payment, events)
function nextUp() {
  const now = nowT();
  for (let i = 0; i <= 60; i++) { const d = addDays(today(), i);
    // plans + the cruise's own days (sail day, ports, all aboard, excursions) + bills / final payment
    const it = dayItems(d).filter(x => (isPlan(x) || ["trip", "aboard", "exc", "bill"].includes(x.kind)) && (i > 0 || !x.t || x.t >= now));
    if (it.length) { const x = it[0]; return `${x.icon || "📅"} ${i === 0 ? "Today" : i === 1 ? "Tomorrow" : `${dayName(d)} ${prettyDate(d)}`}${x.t ? ` · ${hm(x.t)}` : ""} — ${esc(x.title)}`; } }
  return "";
}
function homeHtml() {
  const tr = curTrip(), items = rightNow(tr), nx = nextUp(), bb = bigButton(tr);
  return `<section class="card shell-home"><h3>🔥 Right now</h3><div class="body">
      ${items.length ? items.map(x => `<button class="rn-row" ${x.act}>${x.icon ? `<span>${x.icon}</span>` : ""}<span class="grow">${esc(x.text)}</span><span class="chev">›</span></button>`).join("")
        : `<div class="today-line">✅ Nothing needs you right now.</div>`}</div></section>
    ${nx ? `<section class="card shell-home"><h3>⏭ Next up</h3><div class="body"><div class="today-line">${nx}</div></div></section>` : ""}
    <button class="big-btn" ${bb.act}>${bb.label}</button>`;
}
function exploreHtml(cardHtml) {
  const tr = curTrip(), ports = tr ? (tr.ports || []).slice().sort((a, b) => a.day.localeCompare(b.day)) : [];
  if (tr) ensurePortWx(tr);
  const portCards = ports.map(pt => `<button class="port-card" data-shellgo="plan" data-triptabgo="ports"><b>⚓ ${esc(pt.name)}</b>
      <span class="sub">${dayName(pt.day)} ${prettyDate(pt.day)}${pt.allAboard ? ` · all aboard ${hm(aaLocal(pt))}` : ""}</span>
      ${portWxText(pt) ? `<span class="sub">${portWxText(pt)}</span>` : ""}${pt.excursion && pt.excursion.toLowerCase() !== "none" ? `<span class="sub">🤿 ${esc(pt.excursion)}</span>` : ""}</button>`).join("");
  return `<section class="card"><h3>🏝️ My ports</h3><div class="body">${portCards || `<div class="empty">Add your port days (Plan → your cruise → 🗺️ Ports) and they show up here with weather and all-aboard times.</div>`}</div></section>
    <section class="card"><h3>🚢 My ship</h3><div class="body">${tr && tr.ship ? `<div class="today-line"><b>${esc(tr.ship)}</b>${tr.line ? ` · ${esc(tr.line)}` : ""}${tr.cabin ? ` · cabin ${esc(tr.cabin)}` : ""}</div>` : ""}
      <div class="today-line sub">Coming next: what's open now, what's included, shows, and a deck map for your ship.</div>
      <button class="btn sm ghost" data-shellgo="plan" data-triptabgo="tips">💡 Good to know</button></div></section>
    ${SHELL_CARDS.explore.map(k => cardHtml(k)).join("")}`;
}
function aiTabHtml() {
  const tr = curTrip(), away = tr && tr.start && daysUntil(tr.start) <= 0;
  const qs = away ? ["What should we do now?", "Plan tonight for us on the ship.", "When do we need to be back on the ship?", "What should I bring ashore tomorrow?", "Which perks haven't we used?"]
    : ["What am I forgetting?", "How much do I still owe, and when?", "What's left to pack?", "What should I do this week for my cruise?"];
  return `<section class="card ai-home"><h3>✨ ${esc(APP_NAME)} AI</h3><div class="body">
      <div class="today-line">${esc(greet())}.${tr && tr.start && daysUntil(tr.start) > 0 ? ` ${daysUntil(tr.start)} days to ${esc(tr.ship || tr.name)}.` : ""} What do you need?</div>
      <div class="chips up-chips">${qs.map(q => `<button class="chip" data-askq="${esc(q)}">${esc(q)}</button>`).join("")}</div>
      <button class="big-btn" data-ask="open">💬 Ask anything…</button></div></section>`;
}
// Called by render(): the content for the current tab.
function shellHtml(cardHtml) {
  if (TAB === "home") return homeHtml();
  if (TAB === "explore") return exploreHtml(cardHtml);
  if (TAB === "ai") return aiTabHtml();
  return SHELL_CARDS[TAB].filter(k => k !== "inbox" || S.mail.on || S.mail.found.length).map(k => cardHtml(k)).join("");
}
function paintTabs() {
  let nav = document.getElementById("tabbar");
  if (!shellOn()) { if (nav) nav.remove(); document.body.classList.remove("shell"); return; }
  if (!nav) { nav = document.createElement("nav"); nav.id = "tabbar"; nav.setAttribute("aria-label", "Main"); document.body.appendChild(nav); }
  document.body.classList.add("shell"); document.body.dataset.tab = TAB;
  nav.innerHTML = SHELL_TABS.map(([k, ic, l]) => `<button class="${k === TAB ? "on" : ""}" data-shellgo="${k}" aria-current="${k === TAB ? "page" : "false"}"><span>${ic}</span>${l}</button>`).join("");
}
// Clicks that move between tabs (data-shellgo), optionally landing on a trips-card tab or list.
function shellClick(ds) {
  if (!ds.shellgo) return false;
  if (ds.triptabgo) S.tripTab = ds.triptabgo;
  if (ds.triplistgo) { S.tripTab = "lists"; S.tripList = ds.triplistgo; }
  shellGo(ds.shellgo); return true;
}
