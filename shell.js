/* SAVE AS: shell.js · LOCATION: C:/MarvelApps/dayhub/shell.js
 * THE HUB SHELL (V1 step 7, Scott's navigation map 10/4: "Only 5 permanent tabs:
 * HOME | PLAN | EXPLORE | WALLET | AI. Those five never move." + "One giant button
 * ... its position never changes. Only its job changes.").
 *
 * On for Cruise Hub and Trip Hub (SHELL_MODES, Trip Hub v0.97). Day Hub keeps its cards - except on a phone with its
 * new look on (daytiles.js, Day Hub's own 5 tabs; switch OFF, 11/01). Trip Hub's new look (triptiles.js, switch OFF, 11/06) keeps
 * the five keys and gives them its own names: Home | Plan | Map | Money | More.
 * A regular (non-cruise) trip gets trip words - no ship, ports or all aboard.
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

const SHELL_MODES = ["cruise", "trip"];
const trCruise = tr => !!tr && isCruise(tr);                              // ship / port wording only for a cruise

// THE HUB NAVIGATION (Scott 10/5: "the little drop down logos you did on cruise hub like on the life
// preserver needs to be how our navigation in our app functions on almost every thing"). Big icon tiles -
// icon + short label, the chosen one lit - wherever the user picks a section, view or menu. Every hub.
// items: [{ icon, label, attrs, on, small }]
function tileNav(items, cols = 4, cls = "") {
  return `<div class="tilenav cols${cols} ${cls}">${items.map(i => `<button class="tile ${i.on ? "on" : ""}" ${i.attrs}><span class="tile-ic">${i.icon}</span><b>${i.label}</b>${i.small ? `<small>${i.small}</small>` : ""}</button>`).join("")}</div>`;
}
const splitIcon = s => { const m = String(s).match(/^(\S+)\s+(.*)$/); return m ? [m[1], m[2]] : ["•", String(s)]; };
const SHELL_TABS = [["home", "🏠", "Home"], ["plan", "📅", "Plan"], ["explore", "🌎", "Explore"], ["wallet", "👛", "Wallet"], ["ai", "✨", "AI"]];
const SHELL_CARDS = { plan: ["trips", "inbox", "schedule", "todos", "lists"], explore: ["weather", "family"], wallet: ["trips"] };
// Trips-card tabs per shell tab (null = all of them).
const SHELL_TRIP_TABS = { plan: null, wallet: ["money", "onboard", "perks"] };
// Opens on HOME. "cruisehub.startTab" (phone storage) overrides it - used by the test suite.
let TAB = (() => { try { return localStorage.getItem(APP_ID + ".startTab") || "home"; } catch (e) { return "home"; } })();
// What the phone knows about Pro, in plain words, for a new look's status screen (Day Hub, Cruise Hub). Nothing here decides access.
// buy = the button to offer ("Get" / "Renew"), or none: someone already paying is never told to pay.
function hubProState() {
  if (ownerPhone()) return { tone: "on", word: "On", say: "This is the owner's phone" };
  const p = proEndsRec();
  if (p) { const end = proUntil(p), on = end > Date.now() ? prettyDate(ymd(new Date(end))) : "", d = proEndsIn(), checked = p.checked ? ` · checked ${prettyDate(ymd(new Date(p.checked)))}` : "";   // a date already past is never printed
    if (d >= 0) return { tone: "soon", word: `Ends ${proEndsWhen(d)}`, say: `Set not to renew${on ? ` · access until ${on}` : ""}`, buy: "Renew" };
    if (p.status === "friend") return { tone: "on", word: "On", say: "Included for you, free" };
    if (p.status === "completed") return { tone: "on", word: "On", say: `Paid in full${checked}` };
    if (p.status === "past_due") return { tone: "soon", word: "Payment problem", say: "Your card didn't go through. Update it in your Whop account to keep Pro on." };
    if (proViaDayHub()) return { tone: "on", word: "On", say: `Included with your ${PLAN.NAME}` };
    if (p.status === "trialing") return { tone: "on", word: "Free trial", say: `${on ? `Trial runs until ${on}` : "Trial is on"}${checked}` };
    if (p.status === "canceling") return { tone: "on", word: "On", say: `Set not to renew${on ? ` · access until ${on}` : ""}` };
    return { tone: "on", word: "On", say: `${on ? `Renews ${on}` : "Active"}${checked}` }; }
  const r = lapsedRec(), s = r.status || "";
  if (!r.buyer) return { tone: "off", word: "Free", say: "Everything except the extras below is free forever", buy: "Get" };
  if (r.ok) return { tone: "soon", word: "Needs a check", say: "Couldn't reach the check for a while. Tap below and check again. Your info is safe." };
  if (/phones/.test(s)) return { tone: "soon", word: "Too many phones", say: `It's already on ${PLAN.MAX_PHONES} phones. Remove it from one, then check again here.` };
  if (s === "needs code") return { tone: "soon", word: "One step left", say: "Confirm this phone with a code sent to your email. Tap below to start." };
  if (/not found|no .*purchase/i.test(s)) return r.product
    ? { tone: "off", word: "Ended", say: `${lapsedName(r)} has ended. Your info is safe.`, buy: "Renew" }
    : { tone: "off", word: "No active plan", say: "No active plan found for that email. Your info is safe.", buy: "Get" };
  return { tone: "off", word: "Not active", say: "It isn't on for this phone. Your info is safe." };
}
// Day Hub's new look (daytiles.js, switch OFF) runs Day Hub on the shell too, with its own five tabs.
const dtLook = () => typeof dtOn === "function" && dtOn();
// Auto Hub's new look (autotiles.js, switch OFF) runs Auto Hub on the shell with its own five tabs; a car owner may have no name or city.
const atLook = () => typeof atOn === "function" && atOn();
// Home Hub's new look (hometiles.js, switch OFF) runs Home Hub on the shell with its own five tabs (Home Hub has no tab bar otherwise).
const htLook = () => typeof htOn === "function" && htOn();
const shellOn = () => ((SHELL_MODES.includes(MODE) || dtLook()) && !!(S.city || S.name)) || atLook() || htLook();
const shellTripTabOk = k => !shellOn() || !SHELL_TRIP_TABS[TAB] || SHELL_TRIP_TABS[TAB].includes(k);
const shellTabFor = key => dtLook() ? dtTabFor(key) : key === "trips" ? "plan" : (Object.entries(SHELL_CARDS).find(([, ks]) => ks.includes(key)) || ["plan"])[0];
function shellGo(tab) {
  if (!(atLook() ? AT_TABS : htLook() ? HT_TABS : dtLook() ? DT_TABS : SHELL_TABS).some(t => t[0] === tab)) return;
  TAB = tab; render(); window.scrollTo({ top: 0 });
}

// ---- the big button: one place, its job changes with the moment
function bigButton(tr) {
  const h = new Date().getHours();
  if (!tr || !tr.start) return MODE === "trip" ? { label: "✈️ BUILD MY TRIP", act: 'data-qa="trip"' } : { label: "🚢 PLAN MY CRUISE", act: 'data-qa="trip"' };
  const sd = daysUntil(tr.start), end = tr.end || tr.start;
  const gh = typeof goHomeState === "function" && goHomeState(tr);
  if (gh === "final") return { label: "🌙 GET ME HOME READY", act: 'data-gohome="open"' };
  if (gh === "leave") return { label: "🏠 GET ME HOME", act: 'data-gohome="open"' };
  if (guardFor(tr)) return { label: "🚢 BACK TO SHIP", act: 'data-rg="open"' };
  if (daysUntil(end) < 0) return { label: "🏠 AFTER THE TRIP", act: trCruise(tr) ? 'data-shellgo="plan" data-triplistgo="after"' : 'data-shellgo="plan" data-planview="diary"' };
  if (trCruise(tr) && (sd === 1 || (sd === 0 && !tr.aboard))) return { label: "🚗 GET ME TO MY SHIP", act: 'data-help="get"' };
  if (sd >= 1) return { label: `${trCruise(tr) ? "🛳️" : "🧳"} WHAT AM I FORGETTING?`, act: 'data-forget="1"' };
  return h >= 16 && h < 23 ? { label: "🌙 PLAN TONIGHT", act: `data-askq="${trCruise(tr) ? "Plan tonight for us on the ship." : "Plan tonight for us."}"` }
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
  const hn = typeof hotelNudge === "function" ? hotelNudge(tr) : null;   // v1.14 hotel mode: check-out day goes first
  if (hn) { if (hn.first) out.unshift(hn); else out.push(hn); }
  const dn = typeof diaryNudge === "function" ? diaryNudge(tr) : null; if (dn) out.push(dn);   // v1.01 trip diary
  const pn = typeof spendPulseNudge === "function" ? spendPulseNudge(tr) : null; if (pn) out.push(pn);   // v1.21 spending running ahead
  const fr = typeof freeNudge === "function" ? freeNudge(tr) : null; if (fr) out.push(fr);       // v1.17 free time now (after the diary)
  return out.slice(0, 3);
}
// ---- NEXT UP: the next thing with a day (port, all aboard, excursion, final payment, events)
function nextUp() {
  const now = nowT();
  for (let i = 0; i <= 60; i++) { const d = addDays(today(), i);
    // plans + the cruise's own days (sail day, ports, all aboard, excursions) + bills / final payment
    const it = dayItems(d).filter(x => (isPlan(x) || ["trip", "aboard", "exc", "bill", "book", "fun"].includes(x.kind)) && (i > 0 || !x.t || x.t >= now));
    if (it.length) { const x = it[0]; return `${x.icon || "📅"} ${i === 0 ? "Today" : i === 1 ? "Tomorrow" : `${dayName(d)} ${prettyDate(d)}`}${x.t ? ` · ${hm(x.t)}` : ""} — ${esc(x.title)}`; } }
  return "";
}
// ---- THE HOME LAYOUT - every hub, same three bands (Scott 10/6: "i want all apps to be built close to same
// layout i want top third as it is middle 3rd whats going on and bottom rows be mini bubbles of actions").
//   top    - the hero (clock, weather, scene) - untouched
//   middle - goingOnHtml(): what's going on now + the next thing coming
//   bottom - bubblesHtml(): rows of small round one-tap actions; `hot` = the moment's action, two bubbles wide
// rows: [{ icon, text, sub, act }]
function goingOnHtml(rows, next, empty = "Nothing needs you right now.") {
  return `<section class="card going-on"><h3>📍 What's going on</h3><div class="body">
    ${rows.length ? rows.map(x => `<button class="rn-row" ${x.act || ""}>${x.icon ? `<span>${x.icon}</span>` : ""}<span class="grow">${esc(x.text)}${x.sub ? `<span class="sub">${esc(x.sub)}</span>` : ""}</span>${x.act ? `<span class="chev">›</span>` : ""}</button>`).join("")
      : `<div class="today-line">✅ ${esc(empty)}</div>`}
    ${next ? `<div class="next-up"><span>NEXT</span>${next}</div>` : ""}</div></section>`;
}
// items: [{ icon, label, attrs, hot }]
function bubblesHtml(items) {
  return `<nav class="bubbles" aria-label="Actions">${items.map(i => `<button class="bubble ${i.hot ? "hot" : ""}" ${i.attrs}><span class="b-ic">${i.icon}</span><b>${esc(i.label)}</b></button>`).join("")}</nav>`;
}
function homeHtml() {
  if (S.simple) return simpleHomeHtml();                                    // v0.62 simple mode
  if (typeof ctOn === "function" && ctOn()) return ctHomeHtml();           // Cruise Hub new look (cruisetiles.js, switch OFF)
  if (typeof ttOn === "function" && ttOn()) return ttHomeHtml();           // Trip Hub new look (triptiles.js, switch OFF)
  const tr = curTrip(), items = rightNow(tr), nx = nextUp(), bb = bigButton(tr);
  if (!tr) return MODE === "trip" ? addTripHtml() : addCruiseHtml();       // v0.60 no cruise / trip yet: the ways in
  const [bi, bl] = splitIcon(bb.label);                                     // the big button's job = the hot bubble
  const nxWhat = (nx.split(" — ")[1] || "").toLowerCase();                 // NEXT that only repeats a row above = left out
  return prefsCardHtml() + phaseCardHtml(tr) + goingOnHtml(items, nxWhat && items.some(r => r.text.toLowerCase().includes(nxWhat)) ? "" : nx)
    + (typeof secretHtml === "function" ? secretHtml(tr) : "") + bubblesHtml([   // v1.06 one cruise secret for right now
    { icon: bi, label: bl, attrs: bb.act, hot: true },
    { icon: "📅", label: "My day", attrs: 'data-shellgo="plan" data-planview="today"' },
    { icon: "🗺️", label: trCruise(tr) ? "My cruise" : "My trip", attrs: 'data-shellgo="plan" data-planview="trip"' },
    { icon: "🧳", label: "Packing", attrs: 'data-shellgo="plan" data-planview="packing"' },
    trCruise(tr) ? { icon: "🏝️", label: "Ports & ship", attrs: 'data-shellgo="explore"' } : { icon: "🌎", label: "Things to do", attrs: 'data-shellgo="explore"' },
    { icon: "👛", label: "Money", attrs: 'data-shellgo="wallet"' },
    { icon: "🛟", label: "Help", attrs: 'data-help="home"' }]);
}
// Day Hub (no tab bar): the same bands above its cards. Middle = the rest of today's schedule; bubbles = one per
// card on the screen, in the user's order - a tap opens that card and scrolls to it.
function dayHubHomeHtml(order) {
  const t = today(), now = nowT();
  const rows = dayItems(t).filter(i => i.kind !== "sun" && !i.done && (!i.t || i.t >= now)).slice(0, 3)
    .map(i => ({ icon: i.icon, text: i.title, sub: i.t ? hm(i.t) + (i.end ? ` – ${hm(i.end)}` : "") : "All day", act: 'data-bubble="schedule"' }));
  let nx = "";
  for (let n = 1; n <= 30 && !nx; n++) { const d = addDays(t, n), x = dayItems(d).filter(isPlan)[0];
    if (x) nx = `${x.icon || "📅"} ${n === 1 ? "Tomorrow" : `${dayName(d)} ${prettyDate(d)}`}${x.t ? ` · ${hm(x.t)}` : ""} — ${esc(x.title)}`; }
  return goingOnHtml(rows, nx, "Nothing else on today's schedule.")
    + bubblesHtml(order.filter(k => CARDS[k]).slice(0, 12).map(k => ({ icon: CARDS[k].icon, label: CARDS[k].title, attrs: `data-bubble="${k}"` })));
}
function exploreHtml(cardHtml) {
  if (!trCruise(curTrip())) return tripExploreHtml() + SHELL_CARDS.explore.map(k => cardHtml(k)).join("");   // v0.97 Trip Hub
  const tr = curTrip(), ports = tr ? (tr.ports || []).slice().sort((a, b) => a.day.localeCompare(b.day)) : [];
  if (tr) ensurePortWx(tr);
  const portCards = ports.map(pt => `<button class="port-card" data-tlday="${esc(pt.day)}"><b>${typeof portGuide === "function" && portGuide(pt.name) ? portGuide(pt.name).flag : "⚓"} ${esc(pt.name)}</b>
      <span class="sub">${dayName(pt.day)} ${prettyDate(pt.day)}${pt.allAboard ? ` · all aboard ${hm(aaLocal(pt))}` : ""}</span>
      ${portWxText(pt) ? `<span class="sub">${portWxText(pt)}</span>` : ""}${pt.excursion && pt.excursion.toLowerCase() !== "none" ? `<span class="sub">🤿 ${esc(pt.excursion)}</span>` : ""}</button>`).join("");
  return `<section class="card"><h3>🏝️ My ports</h3><div class="body">${portCards || `<div class="empty">Add your port days (Plan → your cruise → 🗺️ Ports) and they show up here with weather and all-aboard times.</div>`}</div></section>
    <section class="card my-ship"><h3>🚢 My ship</h3><div class="body">${typeof shipGuideHtml === "function" ? shipGuideHtml(tr) : ""}
      <button class="btn sm ghost" data-shellgo="plan" data-triptabgo="tips">💡 Good to know</button></div></section>
    ${SHELL_CARDS.explore.map(k => cardHtml(k)).join("")}`;
}
function aiTabHtml() {
  const tr = curTrip(), away = tr && tr.start && daysUntil(tr.start) <= 0;
  const qs = !trCruise(tr) ? (away ? ["What should we do now?", "Plan tonight for us.", "We have 2 hours free — what's worth it nearby?", "What's on tomorrow?", "How much have we spent so far?"]
      : ["What am I forgetting?", "How much do I still owe, and when?", "What's left to pack?", "What should I do this week for my trip?"])
    : away ? ["What should we do now?", "Plan tonight for us on the ship.", "When do we need to be back on the ship?", "What should I bring ashore tomorrow?", "Which perks haven't we used?"]
    : ["What am I forgetting?", "How much do I still owe, and when?", "What's left to pack?", "What should I do this week for my cruise?"];
  return `<section class="card ai-home"><h3>✨ ${esc(APP_NAME)} AI</h3><div class="body">
      <div class="today-line">${esc(greet())}.${tr && tr.start && daysUntil(tr.start) > 0 ? ` ${daysUntil(tr.start)} days to ${esc(tr.ship || tr.name)}.` : ""} What do you need?</div>
      <div class="chips up-chips">${qs.map(q => `<button class="chip" data-askq="${esc(q)}">${esc(q)}</button>`).join("")}</div>
      <button class="big-btn" data-ask="open">💬 Ask anything…</button></div></section>`;
}
// Called by render(): the content for the current tab.
function shellHtml(cardHtml) {
  if (atLook()) return atShellHtml(cardHtml);                              // Auto Hub new look (autotiles.js, switch OFF)
  if (htLook()) return htShellHtml(cardHtml);                              // Home Hub new look (hometiles.js, switch OFF)
  if (dtLook()) return dtShellHtml(cardHtml);                              // Day Hub new look (daytiles.js, switch OFF)
  if (typeof ctOn === "function" && ctOn()) return ctShellHtml(cardHtml);  // Cruise Hub new look (cruisetiles.js, switch OFF)
  if (typeof ttOn === "function" && ttOn()) return ttShellHtml(cardHtml);  // Trip Hub new look (triptiles.js, switch OFF)
  if (TAB === "home") return homeHtml();
  if (TAB === "explore") return exploreHtml(cardHtml);
  if (TAB === "ai") return aiTabHtml();
  if (TAB === "plan") return planHtml(cardHtml);                          // v0.59 Today | Trip | Packing | Reservations
  return SHELL_CARDS[TAB].filter(k => k !== "inbox" || S.mail.on || S.mail.found.length).map(k => cardHtml(k)).join("");
}
function paintTabs() {
  let nav = document.getElementById("tabbar");
  if (!shellOn()) { if (nav) nav.remove(); document.body.classList.remove("shell", "ct", "dt", "at", "tt", "ht"); return; }
  if (!nav) { nav = document.createElement("nav"); nav.id = "tabbar"; nav.setAttribute("aria-label", "Main"); document.body.appendChild(nav); }
  const ct = typeof ctOn === "function" && ctOn(), dt = dtLook(), at = atLook(), tt = typeof ttOn === "function" && ttOn(), ht = htLook();   // the new looks: their own labels + icons
  if (dt && !DT_TABS.some(t => t[0] === TAB)) TAB = "home";               // Day Hub's tabs aren't Cruise Hub's
  if (at && !AT_TABS.some(t => t[0] === TAB)) TAB = "home";               // Auto Hub's tabs are its own
  if (ht && !HT_TABS.some(t => t[0] === TAB)) TAB = "home";               // so are Home Hub's
  document.body.classList.add("shell"); document.body.dataset.tab = TAB; document.body.classList.toggle("simple", !!S.simple);
  document.body.classList.toggle("ct", ct); document.body.classList.toggle("dt", dt); document.body.classList.toggle("at", at); document.body.classList.toggle("tt", tt); document.body.classList.toggle("ht", ht);
  nav.innerHTML = (at ? AT_TABS : ht ? HT_TABS : ct ? CT_TABS : tt ? TT_TABS : dt ? DT_TABS : SHELL_TABS).map(([k, ic, l]) => `<button class="${k === TAB ? "on" : ""}" data-shellgo="${k}" aria-current="${k === TAB ? "page" : "false"}"><span>${ic}</span>${l}</button>`).join("");
}
// Clicks that move between tabs (data-shellgo), optionally landing on a trips-card tab or list.
function shellClick(ds) {
  if (typeof shipClick === "function" && shipClick(ds)) return true;       // v0.64 ship guide tiles
  if (ds.bubble) { const k = ds.bubble;                                    // v0.85 Day Hub bubble: open that card + go to it
    if (S.collapsed.includes(k)) { S.collapsed = S.collapsed.filter(x => x !== k); save(); }
    if (MINI[k]) MINI_OPEN.add(k);
    render(); const el = document.querySelector(`#cards [data-card="${k}"]`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); return true; }
  if (ds.planview && !ds.shellgo) { PLAN_VIEW = ds.planview; render(); return true; }
  if (ds.planview) PLAN_VIEW = ds.planview;                               // a jump into PLAN that lands on a view
  if (ds.tlday) { showDay(ds.tlday); return true; }
  if (ds.dayclose) { hideSheet("daySheet"); return true; }
  if (ds.dayplan) { hideSheet("daySheet"); VIEW = ds.dayplan; openQA("event"); return true; }
  if ((ds.portedit || ds.portadd) && document.getElementById("daySheet")) hideSheet("daySheet");
  if (!ds.shellgo) return false;
  if (ds.triptabgo) S.tripTab = ds.triptabgo;
  if (ds.triplistgo) { S.tripTab = "lists"; S.tripList = ds.triplistgo; if (!ds.planview) PLAN_VIEW = ds.triplistgo === "packing" ? "packing" : "trip";
    setTimeout(() => { const c = document.querySelector('#cards [data-card="trips"]'); if (c) c.scrollIntoView({ behavior: "smooth", block: "start" }); }, 60); }
  shellGo(ds.shellgo); return true;
}

// ------------------------------------------------------------ PLAN tab
// v0.59 (V1 step 8, Scott's map: "PLAN - TODAY | TRIP | PACKING | RESERVATIONS ... chronological, that's how
// humans think about vacations" + "Tap any day -> Day screen"). TRIP = the whole cruise day by day, then the
// full trip card, schedule, to-dos and lists underneath. Nothing new is stored - it's a view of the trip.
const PLAN_VIEWS = [["today", "Today"], ["trip", "Trip"], ["map", "Map"], ["packing", "Packing"], ["reservations", "Bookings"], ["diary", "Diary"]];   // v0.99 Map, v1.01 Diary (trip.js)
let PLAN_VIEW = "trip";
function dayKind(tr, d) {
  const pt = portOn(tr, d), end = tr.end || tr.start;
  if (!trCruise(tr)) return d === tr.start ? { icon: "✈️", title: `Travel day${tr.port ? ` — ${placeName(tr.port)}` : ""}` }
    : d === end ? { icon: "🏠", title: "Going home" } : { icon: "📍", title: tr.port ? placeName(tr.port) : "On the trip" };
  if (pt) return { icon: "⚓", title: pt.name, pt };
  if (d === tr.start) return { icon: "🚢", title: `Sail day${tr.port ? ` — ${placeName(tr.port)}` : ""}` };
  if (d === end) return { icon: "🏠", title: `Back in port${tr.port ? ` — ${placeName(tr.port)}` : ""}` };
  return { icon: "🌊", title: "At sea" };
}
function timelineHtml() {
  const tr = curTrip(); if (!tr || !tr.start) return "";
  ensurePortWx(tr);
  const sd = daysUntil(tr.start), R = readiness(tr), end = tr.end || tr.start, rows = [];
  if (sd > 0) rows.push(`<button class="tl-row before" data-cd="open"><span class="tl-ic">🧳</span><span class="grow"><b>Before you ${trCruise(tr) ? "sail" : "go"}</b>
      <span class="sub">${sd} day${sd === 1 ? "" : "s"} to go · ${R.pct}% ready${R.next ? ` · next: ${esc(R.next.action.replace(/\s*\([^)]*\)/g, ""))}` : ""}</span></span><span class="chev">›</span></button>`);
  for (let d = tr.start, n = 1; d <= end && n <= 400; d = addDays(d, 1), n++) {
    const k = dayKind(tr, d), pt = k.pt, past = d < today(), now = d === today();
    const bits = pt ? [pt.arrive && `in ${hm(pt.arrive)}`, pt.allAboard && `all aboard ${hm(aaLocal(pt))}`, pt.excursion && pt.excursion.toLowerCase() !== "none" && `🤿 ${esc(pt.excursion)}`, typeof portRealityBit === "function" && portRealityBit(pt), portWxText(pt)].filter(Boolean)
      : d === tr.start ? [trCruise(tr) && tr.ship && `board ${esc(tr.ship)}`].filter(Boolean) : d === end ? ["getting home"] : [];
    if (typeof bookingBits === "function") bits.push(...bookingBits(tr, d).map(esc));   // v0.98 ✈️ 7:05 AM · 🏨 check-in
    if (typeof funBits === "function") bits.push(...funBits(tr, d));   // v1.04
    if (typeof tripDiary === "function" && diaryHas(tripDiary(tr)[d])) bits.push(`📔 ${esc(tripDiary(tr)[d].mood || "written")}`);   // v1.01
    rows.push(`<button class="tl-row ${past ? "past" : ""} ${now ? "now" : ""}" data-tlday="${esc(d)}"><span class="tl-ic">${k.icon}</span><span class="grow">
        <b>${esc(k.title)}</b>${now ? ` <span class="pill">TODAY</span>` : ""}<span class="sub">Day ${n} · ${dayName(d)} ${prettyDate(d)}${bits.length ? " · " + bits.join(" · ") : ""}</span></span><span class="chev">›</span></button>`);
  }
  return `<section class="card timeline"><h3>🗺️ Your ${trCruise(tr) ? "cruise" : "trip"}, day by day</h3><div class="body">${rows.join("")}</div></section>`;
}
function reservationsHtml() {
  const tr = curTrip(); if (!tr) return `<div class="empty">Plan a ${TW} first.</div>`;
  const ex = (tr.ports || []).filter(p => p.excursion && p.excursion.toLowerCase() !== "none").sort((a, b) => a.day.localeCompare(b.day));
  const plans = []; if (tr.start) for (let d = addDays(tr.start, -3), i = 0; d <= addDays(tr.end || tr.start, 1) && i < 400; d = addDays(d, 1), i++)
    dayItems(d).filter(x => ["event", "g"].includes(x.kind)).forEach(x => plans.push({ d, x }));
  const books = (tr.costs || []).filter(c => !c.bk && ["hotel", "parking", "travel", "excursion", "package"].includes(c.cat));   // v0.98 a booking's own cost is listed with it above
  const row = (ic, title, sub) => `<div class="row"><span class="grow">${ic} <b>${esc(title)}</b><span class="sub">${sub}</span></span></div>`;
  return `<section class="card"><h3>🎟️ Reservations</h3><div class="body">
      ${typeof bookingsHtml === "function" ? bookingsHtml(tr) + `<div style="margin-top:10px"></div>` : ""}
      ${trCruise(tr) ? `<div class="day-label">Excursions</div>${ex.length ? ex.map(p => row("🤿", p.excursion, `${dayName(p.day)} ${prettyDate(p.day)} · ${esc(p.name)}${p.meet ? ` · meet ${hm(p.meet)}` : ""}${p.where ? ` at ${esc(p.where)}` : ""}`)).join("") : `<div class="today-line sub">None yet — add one on a port day (tap the day in Trip).</div>`}` : ""}
      <div class="day-label" style="margin-top:10px">Plans around the trip</div>${plans.length ? plans.map(({ d, x }) => row("📅", x.title, `${dayName(d)} ${prettyDate(d)}${x.t ? ` · ${hm(x.t)}` : ""}${x.sub ? ` · ${esc(x.sub)}` : ""}`)).join("") : `<div class="today-line sub">Dinner, shows, spa — add them with ＋ and they show here.</div>`}
      <div class="day-label" style="margin-top:10px">Booked around the ${trCruise(tr) ? "cruise" : "trip"}</div>${books.length ? books.map(c => row(costLabel(c.cat).split(" ")[0], c.what || costLabel(c.cat).replace(/^\S+\s/, ""), `${money(c.amt)} · ${c.paid ? "paid ✓" : "not paid yet"}`)).join("") : `<div class="today-line sub">Hotel, parking, flights — add them in Wallet → Money.</div>`}
      <button class="add-link" data-qa="event">＋ Add a plan (dinner, show, spa…)</button></div></section>`;
}
function planHtml(cardHtml) {
  const PV_IC = { today: "📅", trip: "🗺️", map: "📍", packing: "🧳", reservations: "🎟️", diary: "📔" };
  const nav = tileNav(PLAN_VIEWS.map(([k, l]) => ({ icon: PV_IC[k], label: l, attrs: `data-planview="${k}"`, on: k === PLAN_VIEW })), 6, "planview compact");
  const cards = ks => ks.filter(k => k !== "inbox" || S.mail.on || S.mail.found.length).map(k => cardHtml(k)).join("");
  if (PLAN_VIEW === "today") return nav + cards(["schedule", "todos"]);
  if (PLAN_VIEW === "packing") { S.tripTab = "lists"; if (!["packing", "final"].includes(S.tripList)) S.tripList = "packing"; return nav + cards(["trips"]); }
  if (PLAN_VIEW === "reservations") return nav + reservationsHtml();
  if (PLAN_VIEW === "map") return nav + (typeof tripMapHtml === "function" ? tripMapHtml() : "");
  if (PLAN_VIEW === "diary") return nav + (typeof tripDiaryHtml === "function" ? tripDiaryHtml() : "");   // v1.01
  return nav + timelineHtml() + cards(SHELL_CARDS.plan);
}
// Day screen: everything about one day, then what to do next (Scott: "There should almost never be a dead end").
function showDay(d) {
  const tr = curTrip(); if (!tr) return;
  const k = dayKind(tr, d), pt = k.pt, items = dayItems(d).filter(x => !["sun"].includes(x.kind));
  let el = document.getElementById("daySheet");
  if (!el) { el = document.createElement("div"); el.id = "daySheet"; el.className = "sheet"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "Day"); document.body.appendChild(el); }
  const w = pt ? portWxText(pt) : "", al = pt ? cruiseWxAlerts(PORTWX[`${pt.name}|${pt.day}`], "port") : [];
  el.innerHTML = `<div class="sheet-body"><div class="grab"></div>
    <div class="sheet-head"><h2>${k.icon} ${esc(k.title)}</h2><button class="icon-btn" data-dayclose="1" aria-label="Close">✕</button></div>
    <p class="fine" style="margin-top:0">${dayName(d)} ${prettyDate(d)}${w ? ` · ${w}` : ""}</p>
    ${al.map(a => `<div class="wx-alert">${a.icon} ${esc(a.text)}</div>`).join("")}
    ${pt && typeof portRealityHtml === "function" ? portRealityHtml(pt) : ""}
    ${pt && pt.allAboard && !(typeof portReality === "function" && portReality(pt)) ? `<div class="row"><span class="grow"><b>All aboard</b>${Number(pt.shipOffset) ? `<span class="sub">${hm(pt.allAboard)} ship time</span>` : ""}</span><b>${hm(aaLocal(pt))}</b></div>
      <div class="row"><span class="grow"><b>Head back by</b><span class="sub">${guardMargin()} min margin + ${guardBack(pt)} min trip back</span></span><b>${hm(guardBy(pt))}</b></div>` : ""}
    ${pt && pt.excursion && pt.excursion.toLowerCase() !== "none" ? `<div class="row"><span class="grow">🤿 <b>${esc(pt.excursion)}</b><span class="sub">${[pt.meet && `meet ${hm(pt.meet)}`, pt.where, pt.walk && `${pt.walk} min walk from the cabin`].filter(Boolean).map(esc).join(" · ")}</span></span></div>` : ""}
    ${pt && (pt.cash || pt.currency) ? `<div class="today-line">💵 ${esc([pt.cash && `bring ${pt.cash}`, pt.currency].filter(Boolean).join(" · "))}</div>` : ""}
    ${pt && typeof portGuideHtml === "function" ? portGuideHtml(pt) : ""}
    ${!pt && (d === tr.start || d === (tr.end || tr.start)) && typeof homePortHtml === "function" ? homePortHtml(tr, true) : ""}
    <div class="day-label" style="margin-top:10px">The day</div>
    ${items.length ? items.map(x => `<${x.bk ? `button class="row rn-row" data-bkopen="${x.bk}"` : `div class="row"`}><span class="time">${x.t ? hm(x.t) : ""}</span><span class="grow">${x.icon || ""} ${esc(x.title)}${x.sub ? `<span class="sub">${esc(x.sub)}</span>` : ""}</span>${x.bk ? `<span class="chev">›</span></button>` : "</div>"}`).join("") : `<div class="today-line sub">${trCruise(tr) ? "🌊" : "😎"} Nothing planned yet — a good day to relax.</div>`}
    ${typeof driveDayHtml === "function" ? driveDayHtml(tr, d) : ""}
    ${typeof freeDayHtml === "function" ? freeDayHtml(tr, d) : ""}
    ${typeof funDayHtml === "function" ? funDayHtml(tr, d) : ""}
    ${typeof diaryDayHtml === "function" ? diaryDayHtml(tr, d) : ""}
    <div class="foot-actions" style="flex-wrap:wrap;margin-top:10px">
      ${!trCruise(tr) ? "" : pt ? `<button class="btn sm ghost" data-portedit="${pt.id}">✏️ Edit this port</button>` : d !== tr.start && d !== (tr.end || tr.start) ? `<button class="btn sm ghost" data-portadd="${esc(d)}">⚓ It's a port day</button>` : ""}
      <button class="btn sm ghost" data-dayplan="${esc(d)}">＋ Add a plan this day</button>
      ${d === today() && guardFor(tr) ? `<button class="btn sm" data-rg="open">🚢 Return Guard</button>` : ""}</div></div>`;
  el.classList.remove("hidden");
}

// ------------------------------------------------------------ simple mode
// v0.62 (Scott's ease-of-use plan: "SIMPLE MODE - Settings -> Display -> Simple Mode ... GOOD MORNING, SCOTT /
// SEA DAY / NEXT Dinner 6:00 / [WHAT SHOULD I DO NOW?] [MY DAY] [...] [HELP] - Huge buttons. Large text.
// Minimal choices. Same intelligence underneath."). A per-phone display choice (S.simple).
function simpleHomeHtml() {
  const tr = curTrip(), bb = bigButton(tr), nx = nextUp();
  let today = `🗓️ No ${TW} yet`;
  if (tr && tr.start && !trCruise(tr)) { const sd = daysUntil(tr.start), end = tr.end || tr.start;
    today = sd > 0 ? `✈️ ${sd} day${sd === 1 ? "" : "s"} to your trip` : sd === 0 ? "✈️ Today you go" : daysUntil(end) < 0 ? "🏠 Welcome home" : today_() === end ? "🏠 Going home today" : `📍 Enjoy ${esc(tr.name)}`; }
  else if (tr && tr.start) { const sd = daysUntil(tr.start), pt = portOn(tr, today_()), end = tr.end || tr.start;
    today = sd > 0 ? `🚢 ${sd} day${sd === 1 ? "" : "s"} to your cruise` : sd === 0 ? "🚢 Today you sail" : daysUntil(end) < 0 ? "🏠 Welcome home"
      : pt ? `⚓ ${esc(pt.name)}${pt.allAboard ? ` — back by ${hm(guardBy(pt))}` : ""}` : today_() === end ? "🏠 Going home today" : "🌊 Sea day"; }
  return `${CLOUD_PENDING ? `<button class="chip warn" data-cloudask="1">☁️ Backup is waiting: tap to choose</button>` : ""}<section class="card simple-home"><div class="simple-big">${esc(greet())}</div><div class="simple-now">${today}</div>
      ${nx ? `<div class="simple-next"><span>NEXT</span>${nx}</div>` : ""}</section>
    <button class="big-btn simple" ${bb.act}>${bb.label}</button>
    <div class="simple-grid">
      <button class="simple-btn" data-shellgo="plan" data-planview="today">📅<b>MY DAY</b></button>
      <button class="simple-btn" data-shellgo="plan" data-planview="trip">${trCruise(tr) || (!tr && MODE === "cruise") ? "🚢<b>MY CRUISE</b>" : "✈️<b>MY TRIP</b>"}</button>
      <button class="simple-btn" data-ask="open">💡<b>ASK</b></button>
      <button class="simple-btn red" data-help="home">🛟<b>HELP</b></button></div>`;
}
const today_ = () => today();
function drawSimpleBox() {
  const g = document.getElementById("simpleBox"); if (!g) return;
  g.hidden = !SHELL_MODES.includes(MODE); if (g.hidden) { g.innerHTML = ""; return; }
  g.innerHTML = `<h3>👓 Display</h3><ul class="card-list"><li><span>Simple mode — big text, a few big buttons</span>
    <input type="checkbox" data-simple="1" ${S.simple ? "checked" : ""} aria-label="Simple mode"></li></ul>
    <p class="fine" style="margin-top:6px">Home shows only today, what's next and four big buttons. Everything else is still one tap away.</p>`;
}
function simpleChange(ds, t) {
  if (!ds.simple) return false;
  S.simple = t.checked; save(); render(); drawSimpleBox(); toast(t.checked ? "👓 Simple mode on" : "Simple mode off"); return true;
}

// ---------------------------------------------------------------- v1.44 HUB OS KIT (Scott 10/15: visual-first apps)
// Shared by every hub (styles.css .hos-*): a hero with bubbles orbiting it, and glow progress rings.
// An SVG progress ring. pct 0-100; tone = the ring colour.
const hosRing = (pct, big, label, tone) => { const p = Math.max(0, Math.min(100, Math.round(pct))), C = 2 * Math.PI * 34;
  return `<div class="hos-ring" role="img" aria-label="${esc(label)}: ${esc(big)}"><div class="hos-ring-c"><svg viewBox="0 0 80 80" aria-hidden="true"><circle cx="40" cy="40" r="34" class="hos-ring-bg"/>
    <circle cx="40" cy="40" r="34" class="hos-ring-fg" style="stroke:${tone};stroke-dasharray:${(C * p / 100).toFixed(1)} ${C.toFixed(1)}"/></svg><b>${esc(big)}</b></div><span>${esc(label)}</span></div>`; };
// Bubbles around a hero. items: [{key attr, icon, label, val, tone, badge}]. Placed on a circle (left/top %), so it scales with the box.
function hosOrbit(center, items) {
  const n = items.length;
  return `<div class="hos-orbit">${center}${items.map((it, i) => { const a = (-90 + i * 360 / n) * Math.PI / 180;
    return `<button class="hos-bub" ${it.attr} style="left:${(50 + 38 * Math.cos(a)).toFixed(1)}%;top:${(50 + 38 * Math.sin(a)).toFixed(1)}%;--tone:${it.tone};--d:${(i * 0.37).toFixed(2)}s" aria-label="${esc(it.label)}${it.val ? ": " + esc(it.val) : ""}">
      <span class="hos-ic" aria-hidden="true">${esc(it.icon)}</span><b>${esc(it.label)}</b>${it.val ? `<small>${esc(it.val)}</small>` : ""}${it.badge ? `<i class="hos-badge">${esc(it.badge)}</i>` : ""}</button>`; }).join("")}</div>`;
}

// ------------------------------------------------------------ THE OPENING (v1.59.2, every Hub and every look; Scott 11/08: "we need the pretty parts of opening
// screen to show then pan to bottom half of screen you use", "that first page look makes or breaks the app", "all our apps"). The Hub opens at the top on its art,
// holds, then glides down to the part you use. Never under someone's fingers: any touch, scroll or key stops it, and it waits while something is open on top.
const HUB_PAN_HOLD = 1800, HUB_PAN_GLIDE = 1100, HUB_PAN_AWAY = 10 * 60000;
const HUB_PAN_TO = [".fh-faces2", ".ct-main", ".tt-main", ".ht-main", ".mt-grid", ".hw-grid", ".at-next", ".dt-home"];   // where the useful part starts in each new look; the classic look = the first card
let HP_T = 0, HP_RAF = 0, HP_LIVE = false, HP_AWAY = 0;
function hubPanY() {                                                          // 0 = stay put (a setup screen, an update note to read, a page too short to move)
  const cards = document.getElementById("cards"), hero = document.getElementById("hero"); if (!cards || (typeof TAB !== "undefined" && TAB !== "home")) return 0;
  if (cards.querySelector(".welcome, .hh-hello, .whatsnew, form[data-setup], form[data-fhsetup]")) return 0;
  const el = HUB_PAN_TO.map(s => cards.querySelector(s)).find(Boolean) || (hero && hero.offsetHeight > 40 ? cards : null); if (!el) return 0;
  const bar = cards.querySelector(".fh-topbar"), probe = document.createElement("div");
  probe.style.cssText = "position:fixed;top:0;height:env(safe-area-inset-top,0px);visibility:hidden"; document.body.appendChild(probe); const safe = probe.offsetHeight; probe.remove();
  const y = el.getBoundingClientRect().top + window.scrollY - (bar ? bar.offsetHeight : safe) - 12, y2 = Math.min(y, document.documentElement.scrollHeight - window.innerHeight);
  return y2 >= 24 ? Math.round(y2) : 0;
}
function hubPanClear() {                                                      // nothing on top of the Home screen, nobody typing
  const el = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2), a = document.activeElement;
  return !!el && !!el.closest("#cards, #hero") && !(a && /INPUT|SELECT|TEXTAREA/.test(a.tagName));
}
function hubPanStop() {
  clearTimeout(HP_T); cancelAnimationFrame(HP_RAF); HP_RAF = 0; if (!HP_LIVE) return; HP_LIVE = false;
  ["touchstart", "pointerdown", "wheel", "keydown"].forEach(e => window.removeEventListener(e, hubPanHands, true));
}
function hubPanHands() { if (hubPanClear() || HP_RAF) hubPanStop(); }          // a tap on something open on top (the morning brief) isn't a tap on Home: the glide still comes after it closes
function hubPanGlide(y) {
  const t0 = performance.now(), from = window.scrollY;
  const step = now => { const k = Math.min(1, Math.max(0, (now - t0) / HUB_PAN_GLIDE)), e = k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
    window.scrollTo(0, from + (y - from) * e); if (k < 1) HP_RAF = requestAnimationFrame(step); else { HP_RAF = 0; hubPanStop(); } };
  HP_RAF = requestAnimationFrame(step);
}
function hubPanStart(hold) {
  hubPanStop();
  if (!switchOn("HUB_PAN") || (navigator.webdriver && !window.__HUB_PAN) || (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches)) return;
  HP_LIVE = true; ["touchstart", "pointerdown", "wheel", "keydown"].forEach(e => window.addEventListener(e, hubPanHands, { capture: true, passive: true }));
  let waits = 0, waited = false;
  const fire = () => {
    if (window.scrollY > 30) { hubPanStop(); return; }                        // they've already moved
    if (!hubPanClear()) { waited = true; if (++waits > 120) hubPanStop(); else HP_T = setTimeout(fire, 700); return; }
    if (waited) { waited = false; HP_T = setTimeout(fire, 700); return; }    // it just closed: a moment to see the art
    const y = hubPanY(); if (y) hubPanGlide(y); else hubPanStop();
  };
  HP_T = setTimeout(fire, hold);
}
function hubPanOpen() {
  const go = () => hubPanStart(HUB_PAN_HOLD);
  if (document.readyState === "complete") go(); else window.addEventListener("load", go, { once: true });   // after the art has loaded
  document.addEventListener("visibilitychange", () => {                       // coming back to the app after a while counts as opening it
    if (document.hidden) { HP_AWAY = Date.now(); hubPanStop(); return; }
    if (HP_AWAY && Date.now() - HP_AWAY >= HUB_PAN_AWAY && hubPanClear() && hubPanY()) { window.scrollTo(0, 0); hubPanStart(HUB_PAN_HOLD); }
    HP_AWAY = 0;
  });
}
