/* SAVE AS: cruisetiles.js · LOCATION: C:/MarvelApps/dayhub/cruisetiles.js
 * CRUISE HUB NEW LOOK - Phase 1 (Scott 11/01: sent a tile-dashboard design for Cruise Hub, then his outline:
 *   "Main navigation: Home | My Cruise | Port Days | Money | More",
 *   "Crisis Mode should remain accessible from every main screen, using a distinct lifesaver icon",
 *   "make the interface adapt to the stage of the trip. Before sailing, emphasize countdown and packing. On port days,
 *    put Return Guard and all-aboard time at the top. On the final morning, surface Time to Go Home and Remember My Car").
 * Phase 1 = HOME (photo hero, the stage card, Needs you, 12 tiles), the 5 renamed tabs, the lifesaver on every tab and a
 * More tab. Every tile opens a screen that already exists; the inner screens get the new look in Phase 2.
 * The stage logic is the hero's own (ui.js cruiseCountdown / guardHtml, cruise.js goHomeHtml / phaseCardHtml) - nothing
 * new is decided here, it is only laid out.
 * SWITCH: CT_ON = false - nobody sees it. One phone can preview it with the link ?look=tiles (kept on that phone,
 * cruisehub.look); ?look=classic or More -> Classic look turns it back. Cruise Hub only; Simple mode always wins.
 * Loaded by ../cruisehub/index.html after shell.js (+ cruisetiles.css). Hooks: shell.js homeHtml / shellHtml / paintTabs.
 * #hero is hidden in this look, so ctNoticesHtml brings over the chips people must not miss (new version, Install, Pro
 * paused / ending, the car) and ctTopHtml the Offline pill.
 * Phase 3 (Scott 11/03: "finish what you can on hubs"; his 11/01 cross-check: "a beautiful home screen isn't enough. Every
 * feature needs to have a logical place") = More lists everything by when you need it (Road Trip Brain, Home Port, Fix My Trip,
 * First 10 Minutes, Free Time, Group Vote, Reminders), Money adds Spending Pulse + Export, Cruise Hub Pass gets a status screen,
 * and One Cruise Secret is back on Home. Each opens what Cruise Hub already has.
 * DEPLOY ORDER: push dayhub first and let Pages publish, then cruisehub (its v7 worker caches these two files).
 */
"use strict";

const CT_ON = false;                 // THE SWITCH: true = everyone on Cruise Hub gets the new look (Scott's go only)
const CT_KEY = "cruisehub.look";
(function ctFromLink() {             // ?look=tiles|classic sets this phone's look, then leaves the address as it was
  try {
    const u = new URL(location.href), v = u.searchParams.get("look");
    if (v !== "tiles" && v !== "classic") return;
    localStorage.setItem(CT_KEY, v); u.searchParams.delete("look");
    history.replaceState(null, "", u.pathname + (u.search || "") + u.hash);
  } catch (e) { /* private mode: the link just doesn't stick */ }
})();
const ctPick = () => { try { return localStorage.getItem(CT_KEY); } catch (e) { return null; } };
function ctOn() {
  return typeof MODE !== "undefined" && MODE === "cruise" && typeof shellOn === "function" && shellOn() && !S.simple
    && (CT_ON ? ctPick() !== "classic" : ctPick() === "tiles");
}

// The five tabs (keys stay the shell's own: plan / explore / wallet / ai) - Scott: Home | My Cruise | Port Days | Money | More.
const CT_SVG = p => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
const CT_TABS = [
  ["home", CT_SVG('<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>'), "Home"],
  ["plan", CT_SVG('<path d="M2 16l2.5 5h15l2.5-5-10-3.5z"/><path d="M6 14.6V9h12v5.6"/><path d="M9.5 9V5.5h5V9"/>'), "My Cruise"],
  ["explore", CT_SVG('<path d="M12 21s-7-6.3-7-11a7 7 0 0 1 14 0c0 4.7-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>'), "Port Days"],
  ["wallet", CT_SVG('<rect x="3" y="6" width="18" height="13" rx="2.5"/><path d="M3 10h18"/><path d="M16 14.5h2"/>'), "Money"],
  ["ai", CT_SVG('<circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/>'), "More"],
];
const CT_TAB_NAME = { home: "Home", plan: "My Cruise", explore: "Port Days", wallet: "Money", ai: "More" };
// The lifesaver - Crisis Mode, the same red-and-white ring on every tab.
const CT_LIFE = `<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="14" fill="none" stroke="#fff" stroke-width="8"/>
  <circle cx="20" cy="20" r="14" fill="none" stroke="#e11d48" stroke-width="8" stroke-dasharray="11 11" transform="rotate(-20 20 20)"/>
  <circle cx="20" cy="20" r="18.2" fill="none" stroke="rgba(0,0,0,.18)" stroke-width="1"/><circle cx="20" cy="20" r="9.8" fill="none" stroke="rgba(0,0,0,.18)" stroke-width="1"/></svg>`;

function ctTopHtml(home) {
  return `<div class="ct-top"><button class="ct-life" data-help="home" aria-label="Crisis Mode - help now">${CT_LIFE}</button>
    <div class="ct-brand"><b>🛳️ Cruise Hub</b><small>${home ? "Plan · Prepare · Sail · Explore · Enjoy" : esc(CT_TAB_NAME[TAB] || "")}${navigator.onLine === false ? ` <span class="offline-pill">🟠 Offline</span>` : ""}</small></div>
    <button class="ct-gear" data-ctgo="settings" aria-label="Settings">⚙️</button></div>`;
}
// The hidden hero's must-see chips (app.js heroHtml builds them; all of them for this one read, none folded behind "+N more").
// The car chip stays out when the stage card already shows it (final night / last morning - unless Return Guard holds the card).
function ctNoticesHtml(tr) {
  const was = CHIPS_ALL; CHIPS_ALL = true; let html = "";
  try { html = heroHtml(); } finally { CHIPS_ALL = was; }
  const box = document.createElement("template"); box.innerHTML = html;
  const staged = !!tr && !guardFor(tr) && typeof goHomeState === "function" && !!goHomeState(tr);
  const keep = [...box.content.querySelectorAll(".chips > [data-update], .chips > [data-install], .chips > [data-prolapse], .chips > [data-gohome]")]
    .filter(c => !(c.dataset.gohome && staged));
  return keep.length ? `<div class="ct-notices">${keep.map(c => c.outerHTML).join("")}</div>` : "";
}
const ctDates = tr => tr.start ? prettyDate(tr.start) + (tr.end && tr.end !== tr.start ? ` – ${prettyDate(tr.end)}` : "") : "";
const ctWho = tr => [tr.line, tr.ship].filter(Boolean).map(esc).join(" · ");

// The card for the moment (Scott: "adapt to the stage of the trip") - port day = Return Guard, final night / last morning
// = Get me home + the car, otherwise the countdown (days, readiness, the next thing) or "day n of N" on the trip.
// A cruise pasted from an email can have no dates yet: then the card asks for them (the old hero's guard, kept).
// An "Other trip" on Cruise Hub gets trip words - no sail day, ship or sea (same rule as shell.js trCruise).
function ctStageHtml(tr) {
  const g = guardFor(tr);
  if (g) return `<div class="ct-stage ct-alert">${guardHtml(g)}</div>`;
  const st = typeof goHomeState === "function" && goHomeState(tr);
  if (st) return `<div class="ct-stage ct-alert">${goHomeHtml(tr, st)}${typeof carChip === "function" ? carChip(tr) : ""}</div>`;
  const cr = trCruise(tr);
  const head = `<span class="ct-k">${cr ? "My Cruise" : "My Trip"}</span><span class="ct-name">${cr ? "🌴" : "🧳"} ${esc(tr.name || tr.ship || (cr ? "My cruise" : "My trip"))}</span>
    <span class="ct-sub">${[ctWho(tr), esc(ctDates(tr))].filter(Boolean).join(" · ")}</span>`;
  if (!tr.start) return `<button class="ct-stage ct-card" data-tripedit="${esc(tr.id)}">${head}
      <span class="ct-row"><span class="ct-bigic" aria-hidden="true">🗓️</span><span class="ct-say"><b>Add your dates</b><small>Then the countdown, ports and reminders start</small></span></span></button>`;
  const R = readiness(tr), sd = daysUntil(tr.start), end = tr.end || tr.start, ed = daysUntil(end);
  if (ed < 0) return `<button class="ct-stage ct-card" data-shellgo="plan" ${cr ? 'data-triplistgo="after"' : 'data-planview="diary"'}>${head}
      <span class="ct-row"><span class="ct-bigic" aria-hidden="true">🏠</span><span class="ct-say"><b>Welcome home</b><small>The after-the-trip list is ready</small></span></span></button>`;
  const ready = `<span class="ct-ready"><b>${R.pct}%</b><small>${R.pct >= 100 ? "Ready to go! 🎉" : "Ready"}</small><span class="ct-bar"><i style="width:${R.pct}%"></i></span></span>`;
  let big, lab;
  if (sd > 0) { big = sd; lab = cr ? (sd === 1 ? "Day to Sail" : "Days to Sail") : (sd === 1 ? "Day to go" : "Days to go"); }
  else if (sd === 0) { big = cr ? "⚓" : "✈️"; lab = cr ? "Sail day" : "Travel day"; }
  else { const n = -sd + 1, all = Math.round((parseDay(end) - parseDay(tr.start)) / 86400000) + 1, pt = cr ? portOn(tr, today()) : null;
    big = n; lab = `Day ${n} of ${all}` + (pt ? ` · ⚓ ${pt.name}` : today() === end ? " · going home" : cr ? " · 🌊 at sea" : ""); }
  const nx = R.next && R.pct < 100 && sd >= 0 ? `<span class="ct-next">📋 <b>Next up:</b> ${esc(R.next.action.replace(/\s*\([^)]*\)/g, ""))}</span>` : "";
  return `<button class="ct-stage ct-card" data-cd="open">${head}
      <span class="ct-row"><span class="ct-days"><span class="ct-cal" aria-hidden="true">📅</span><span><b>${esc(String(big))}</b><small>${esc(lab)}</small></span></span>${ready}</span>${nx}</button>`;
}

// The 12 tiles (Scott's design). Each opens what Cruise Hub already has. An "Other trip" drops the ship-only ones.
const ctPl = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
// The day the fun tools open on: today during the trip, else the first port day, else sail day.
function ctFunDay(tr) {
  const end = tr.end || tr.start, during = !!tr.start && daysUntil(tr.start) <= 0 && daysUntil(end) >= 0;
  return during ? today() : (tr.ports || []).map(p => p.day).filter(Boolean).sort()[0] || tr.start;
}
function ctTiles(tr) {
  const cr = trCruise(tr), ports = (tr.ports || []).length, left = tripLeft(tr), [pd, pn] = typeof listFrac === "function" ? listFrac(tr, "packing") : [0, 0];
  const nights = tr.start ? tripNights(tr) : 0, funDay = ctFunDay(tr);
  return [
    ["🗓️", cr ? "My Cruise" : "My Trip", 'data-shellgo="plan" data-planview="trip"', [nights && ctPl(nights, "night"), ports && ctPl(ports, "port")].filter(Boolean).join(" · ")],
    ["📋", "Lists & Prep", 'data-shellgo="plan" data-planview="packing"', pn ? `packed ${pd}/${pn}` : ""],
    ["💳", "Payments & Budget", 'data-shellgo="wallet"', tr.total ? (left > 0 ? `${money(left)} left` : "paid ✓") : ""],
    ["✈️", "Travel & Stay", 'data-shellgo="plan" data-planview="reservations"', ""],
    cr && ["⚓", "Sail Day", 'data-help="get"', ""],
    cr && ["🛳️", "On Board", 'data-ctgo="ship"', ""],
    ["🌴", cr ? "Port Days" : "Things to Do", 'data-shellgo="explore"', ports ? ctPl(ports, "port") : ""],
    ["🎭", "Activities & Fun", funDay ? `data-tlday="${esc(funDay)}"` : 'data-shellgo="explore"', ""],     // the day screen holds the Fun Finder
    ["🏠", "Coming Home", cr ? 'data-gohome="open"' : 'data-shellgo="plan" data-planview="diary"', ""],   // the final-night checklist is cruise-only
    ["🛟", "Crisis Mode", 'data-help="home"', "", "red"],
    ["✨", "AI Helper", 'data-ask="open"', ""],
    ["▦", "More", 'data-shellgo="ai"', ""],
  ].filter(Boolean);
}
const ctTileHtml = t => `<button class="ct-tile${t[4] ? " " + t[4] : ""}" ${t[2]}><span class="ct-ic" aria-hidden="true">${t[0]}</span><b>${esc(t[1])}</b>${t[3] ? `<small>${esc(t[3])}</small>` : ""}</button>`;

function ctHomeHtml() {
  const tr = curTrip(), ph = S.photo === false ? "" : new URL("photos/cruise_2.jpg", BASE_URL).href;    // the ship on open water (⚙ Real photo off = none)
  const w = typeof WXDATA !== "undefined" && WXDATA && WXDATA.here, temp = w && w.cur && Number.isFinite(Number(w.cur.temperature_2m)) ? Math.round(w.cur.temperature_2m) : null;
  const hero = body => `<section class="ct-hero" ${ph ? `style="--ct-photo:url('${ph}')"` : ""}>${ctTopHtml(true)}
    ${temp !== null ? `<span class="ct-wx">${esc(String(temp))}° ${esc(w.label ? placeName(w.label) : "")}</span>` : ""}${body}</section>`;
  if (!tr) return hero("") + ctNoticesHtml(null) + `<div class="ct-ways">${addCruiseHtml()}</div>`;   // no cruise yet: the ways in
  // Needs you = the hero's RIGHT NOW rows (with their second line), minus the one the card already shows as "Next up";
  // on the trip, NEXT (the next port / all aboard / plan) closes the list, as on the old home.
  const R = tr.start ? readiness(tr) : null, nxt = R && R.next ? R.next.action.replace(/\s*\([^)]*\)/g, "").toLowerCase() : "";
  const bb = bigButton(tr), items = rightNow(tr).filter(x => !nxt || String(x.text).toLowerCase() !== nxt);
  const onTrip = !!tr.start && daysUntil(tr.start) <= 0, nxRaw = onTrip ? nextUp() : "";
  const nxWhat = (nxRaw.split(" — ")[1] || "").toLowerCase();               // NEXT that only repeats a row above = left out (old home's rule)
  const nx = nxWhat && items.some(r => String(r.text).toLowerCase().includes(nxWhat)) ? "" : nxRaw;
  const needs = items.length || nx ? `<section class="ct-needs">${items.length ? "<h4>Needs you</h4>" : ""}${items.map(x => `<button class="ct-need" ${x.act || ""}>${x.icon ? `<span aria-hidden="true">${x.icon}</span>` : ""}<span class="grow">${esc(x.text)}${x.sub ? `<small>${esc(x.sub)}</small>` : ""}</span><span class="chev" aria-hidden="true">›</span></button>`).join("")}
      ${nx ? `<div class="ct-nextup"><span>NEXT</span>${nx}</div>` : ""}</section>` : "";
  const phase = typeof phaseCardHtml === "function" ? phaseCardHtml(tr) : "";   // travel day / sail day / first 10 minutes
  return hero(ctStageHtml(tr)) + ctNoticesHtml(tr)
    + (phase ? `<div class="ct-phase">${phase}</div>` : "")
    + `<button class="ct-big" ${bb.act}>${esc(bb.label)}</button>`
    + needs
    + (typeof secretHtml === "function" && secretHtml(tr) ? `<div class="ct-phase">${secretHtml(tr)}</div>` : "")   // one cruise secret for right now, as on the old home
    + `<nav class="ct-grid" aria-label="${esc(APP_NAME)}">${ctTiles(tr).map(ctTileHtml).join("")}</nav>`;
}

// MORE: everything that isn't one of the four, by when you need it. The trip-only tiles show only once there is a trip (no dead
// taps); a tool that needs something (a booking with a time, two ideas to vote on, a known home port) waits for it.
function ctMoreHtml() {
  const tr = curTrip(), cr = !!tr && trCruise(tr), when = !!tr && !!tr.start, on = when && daysUntil(tr.end || tr.start) >= 0, fun = when ? ctFunDay(tr) : "";
  const wishes = tr && typeof tripWish === "function" ? tripWish(tr).length : 0;
  const groups = [
    ["Before you go", [tr && ["🧳", "Packing", 'data-shellgo="plan" data-planview="packing"', ""], tr && ["📄", "Documents", 'data-shellgo="plan" data-triplistgo="docs"', ""],
      tr && ["🎟️", "Bookings", 'data-shellgo="plan" data-planview="reservations"', ""],
      tr && typeof fixClashes === "function" && (tr.bookings || []).some(b => b.day && b.t) && ["🔄", "Fix My Trip", 'data-fixopen="pick"', ""],
      on && ["🚗", "Road Trip", `data-ctgo="day:${esc(tr.start)}:drive"`, "breaks, food, fuel"],
      cr && when && typeof homePort === "function" && !!tr.port && !!homePort(tr.port) && ["⚓", "Home Port", `data-tlday="${esc(tr.start)}"`, "parking + terminal"]]],
    [cr ? "On board" : "On the trip", [tr && ["📅", "My Day", 'data-shellgo="plan" data-planview="today"', ""], cr && ["🛳️", "Ship Guide", 'data-ctgo="ship"', ""], cr && ["🎉", "First 10 Minutes", 'data-ctgo="first10"', ""],
      on && ["⏳", "Free Time", `data-ctgo="day:${esc(fun)}:free"`, ""], on && ["🎭", "Activities & Fun", `data-tlday="${esc(fun)}"`, ""],
      on && ["🗳️", "Group Vote", wishes >= 2 ? `data-voteopen="${esc(tr.id)}"` : `data-ctgo="day:${esc(fun)}:free"`, wishes >= 2 ? "" : "add 2 ideas first"],
      tr && ["📔", "Trip Diary", 'data-shellgo="plan" data-planview="diary"', ""], tr && ["📍", "Map", 'data-shellgo="plan" data-planview="map"', ""]]],
    ["Coming home", [cr && ["🌙", "Final Night", 'data-gohome="open"', ""], cr && ["🧾", "Final Bill Check", 'data-billcheck="1"', ""], tr && ["📸", "After the Trip", cr ? 'data-shellgo="plan" data-triplistgo="after"' : 'data-shellgo="plan" data-planview="diary"', ""]]],
    ["This app", [["✨", "AI Helper", 'data-ask="open"', ""], ["🔔", "Reminders", 'data-ctgo="reminders"', ""], ctPassOffered() && ["⭐", proName(), 'data-ctgo="pass"', hubProState().word], ["⚙️", "Settings", 'data-ctgo="settings"', ""],
      ["👓", "Simple Mode", 'data-ctgo="settings"', "big buttons"], ["🎨", "Classic Look", 'data-ctgo="classic"', "the old screen"]]]];
  return groups.map(([h, T]) => { const t = T.filter(Boolean);
      return t.length ? `<h4 class="ct-more-h">${esc(h)}</h4><nav class="ct-grid ct-more" aria-label="${esc(h)}">${t.map(ctTileHtml).join("")}</nav>` : ""; }).join("")
    + (tr && typeof prefsCardHtml === "function" ? prefsCardHtml() : "")
    + (typeof aiTabHtml === "function" ? aiTabHtml() : "");
}

// Phase 2 - MONEY opens with the final-payment tracker (Scott's "Payments & Budget" screen): trip total / paid / left,
// then the final payment due date with days to go (amber inside 14 days). Only when a fare total is saved.
const ctYmd = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ""));
function ctMoneyTopHtml(tr) {
  if (!tr || !(Number(tr.total) > 0)) return "";
  const paid = tripPaid(tr), left = tripLeft(tr) || 0, fd = ctYmd(tr.finalDue) ? daysUntil(tr.finalDue) : null;
  const due = left <= 0 ? `<div class="ct-due done"><span aria-hidden="true">✅</span><span><b>Paid in full</b></span></div>`
    : fd !== null ? `<div class="ct-due${fd < 0 ? " late" : fd <= 14 ? " soon" : ""}"><span aria-hidden="true">🔔</span><span><b>Final payment ${fd < 0 ? "was due" : "due"} ${esc(prettyDate(tr.finalDue))}</b>
        <small>${fd >= 0 ? esc(inDays(fd)) : `${-fd} day${fd === -1 ? "" : "s"} ago`} · ${esc(money(left))} left</small></span></div>` : "";
  return `<section class="ct-money" aria-label="Payments"><div class="ct-stats"><div><small>Trip total</small><b>${esc(money(Number(tr.total)))}</b></div>
      <div class="paid"><small>Paid</small><b>${esc(money(paid))}</b></div><div class="left"><small>Left to pay</small><b>${esc(money(left))}</b></div></div>${due}</section>`;
}
// The money tools Scott's outline puts on Money (they live inside the money cards today): package / upgrade / split / bill.
function ctMoneyToolsHtml(tr) {
  if (!tr) return "";
  const cr = trCruise(tr), T = [
    cr && ["🧮", "Package worth it?", 'data-pkgcalc="1"', "drinks, Wi-Fi, dining"],
    cr && ["⬆️", "Upgrade worth it?", 'data-upopen="1"', "cabin bid or upgrade"],
    ["➗", "Split the cost", `data-splitopen="${esc(tr.id)}"`, "who owes what"],
    cr && ["🧾", "Final bill check", 'data-billcheck="1"', "match the ship's bill"],
    ["📊", "Spending pulse", 'data-spendgo="1"', "your daily pace"],
    typeof exportMoney === "function" && ["📤", "Export the money", `data-moneyexport="${esc(tr.id)}"`, "CSV for a spreadsheet"]].filter(Boolean);
  return `<nav class="ct-grid ct-tools" aria-label="Money tools">${T.map(ctTileHtml).join("")}</nav>`;
}

// ---- full screens opened from More: ‹ comes back to it, a tab leaves them
let CT_SCREEN = null;
const ctBackHtml = t => `<h2 class="ct-title"><button class="ct-back" data-ctgo="back" aria-label="Back">‹</button>${esc(t)}</h2>`;
// FIRST 10 MINUTES: the same ticks Home shows the moment you board (cruise.js), here to read ahead or come back to.
function ctFirstHtml(tr) {
  const F = tr.firstThings || {}, n = FIRST_THINGS.filter(([k]) => F[k]).length;
  return ctBackHtml("First 10 Minutes") + `<section class="card"><h3>🎉 First things — before the crowds<span class="meta">${n}/${FIRST_THINGS.length}</span></h3><div class="body">
    ${FIRST_THINGS.map(([k, l]) => `<label class="row"><input type="checkbox" class="tick" data-first="${k}" ${F[k] ? "checked" : ""}><span class="grow">${esc(l)}</span></label>`).join("")}</div></section>`;
}
// CRUISE HUB PASS (Scott's batch 1, and his "clearly visible Pro status screen"): where you stand, what's syncing, what it includes.
// Never in the Play app (no Pass wording outside ⚙ there). Someone already paying is never told to pay. No price is decided here.
const ctPassOffered = () => switchOn("PRO_GATE") && !STORE_MODE;
function ctPassHtml() {
  const st = hubProState(), pro = isPro(), when = iso => { try { return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" }); } catch (e) { return ""; } };
  const row = (ic, name, state, tone) => `<div class="ct-prorow"><span aria-hidden="true">${ic}</span><span class="grow">${esc(name)}</span><b class="${tone}">${esc(state)}</b></div>`;
  const cal = !S.gcal.connected ? ["Not connected", ""] : syncOk("gcal") ? [S.gcal.pushed ? `On · sent ${when(S.gcal.pushed)}` : "On", "on"] : ["Paused", "soon"];
  const bak = !S.sync.on ? ["Off", ""] : syncOk("sync") ? [S.sync.last ? `On · saved ${when(S.sync.last)}` : "On", "on"] : ["Paused", "soon"];
  const ben = ["🗓️ Your trip, payments and port days on your phone's calendar", switchOn("GMAIL") && "📬 Your cruise booking found in your email", "☁️ Backup to your own Google Drive", `📱 Works on up to ${PLAN.MAX_PHONES} phones`].filter(Boolean);
  const rec = proEndsRec() || lapsedRec(), own = cruisePass() && rec.product !== "dayhub";   // someone on Day Hub Pro renews Day Hub Pro, never a product they didn't buy
  const url = own ? PLAN.CRUISE_CHECKOUT_URL : PLAN.WHOP_CHECKOUT_URL, price = own ? `${PLAN.CRUISE_YEARLY} — every cruise you take that year` : `${PLAN.MONTHLY} or ${PLAN.YEARLY}`, plan = own ? proName() : PLAN.NAME;
  return ctBackHtml(proName()) + `<section class="ct-prohero ${st.tone}"><span class="ct-k">Status</span><b>${esc(st.word)}</b><small>${esc(st.say)}</small></section>
    <section class="card"><h3>🔄 Your sync</h3><div class="body">${row("🗓️", "Google Calendar", cal[0], cal[1])}${row("☁️", "Drive backup", bak[0], bak[1])}</div></section>
    <section class="card"><h3>⭐ What it includes</h3><div class="body"><ul class="ct-prolist">${ben.map(x => `<li>${esc(x)}</li>`).join("")}</ul>
      <p class="fine" style="margin:8px 0 0">Everything else — countdown, payments, ports and all-aboard alarms, onboard spending, perks, lists, tips — is free forever. No ads, ever.</p></div></section>
    <div class="ct-probtns">${st.buy ? `<a class="ct-big ct-probuy" href="${esc(url)}" target="_blank" rel="noopener">${esc(st.buy)} ${esc(plan)}</a><p class="ct-price">${esc(price)}</p>` : ""}
      <button class="ct-big ct-promanage" data-ctgo="passsettings">${pro ? "Manage on this phone" : st.buy ? "Already bought? Enter your email" : "Check on this phone"}</button></div>`;
}

// Called by shell.js shellHtml() while the new look is on: the lifesaver header on every tab + the tab's content.
function ctShellHtml(cardHtml) {
  if (TAB === "home") return homeHtml();                                   // homeHtml() hands over to ctHomeHtml()
  const top = `<section class="ct-band">${ctTopHtml(false)}</section>`;
  if (CT_SCREEN === "pass" && ctPassOffered()) return top + ctPassHtml();
  if (CT_SCREEN === "first10" && curTrip()) return top + ctFirstHtml(curTrip());
  if (TAB === "ai") return top + ctMoreHtml();
  if (TAB === "explore") return top + exploreHtml(cardHtml);
  if (TAB === "plan") return top + planHtml(cardHtml);
  return top + (TAB === "wallet" ? ctMoneyTopHtml(curTrip()) + ctMoneyToolsHtml(curTrip()) : "")
    + SHELL_CARDS[TAB].filter(k => k !== "inbox" || S.mail.on || S.mail.found.length).map(k => cardHtml(k)).join("");
}

// Taps that belong to the new look only.
// Open a Settings box and bring it up.
function ctSettingsAt(id) { openSettings(); setTimeout(() => { const el = document.getElementById(id); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); }, 60); }
// Open a day's screen at one of its tools.
function ctDayAt(d, what) {
  showDay(d);
  setTimeout(() => { const sh = document.getElementById("daySheet"); if (!sh) return;
    const el = what === "drive" ? sh.querySelector(".drive-box, .drive-add") : [...sh.querySelectorAll(".day-label")].find(x => /Free time/.test(x.textContent));
    if (el) { if (el.tagName === "DETAILS") el.open = true; el.scrollIntoView({ behavior: "smooth", block: "start" }); } }, 60);
}
document.addEventListener("click", e => {
  if (e.target.closest && e.target.closest("button[data-shellgo]")) CT_SCREEN = null;   // a tab or a tile that goes to one leaves a full screen
  if (ctOn() && e.target.closest && e.target.closest("button[data-spendgo]")) setTimeout(() => { const c = document.querySelector('#cards [data-card="trips"]'); if (c) c.scrollIntoView({ behavior: "smooth", block: "start" }); }, 60);   // the card sits below the tools
  const b = e.target.closest && e.target.closest("button[data-ctgo]");
  if (!b) return;
  const go = b.dataset.ctgo;
  if (go === "back") { CT_SCREEN = null; render(); window.scrollTo({ top: 0 }); return; }
  if (go === "pass" || go === "first10") { CT_SCREEN = go; render(); window.scrollTo({ top: 0 }); return; }
  if (go === "reminders") { ctSettingsAt("remindBox"); return; }
  if (go === "passsettings") { ctSettingsAt("proBox"); return; }
  if (go.startsWith("day:")) { const [, d, what] = go.split(":"); ctDayAt(d, what); return; }
  if (go === "settings") { if (typeof openSettings === "function") openSettings(); return; }
  if (go === "classic") { try { localStorage.setItem(CT_KEY, "classic"); } catch (e2) { /* private mode */ } CT_SCREEN = null; render(); window.scrollTo({ top: 0 }); toast("Classic look on this phone"); return; }
  if (go === "ship") { shellGo("explore"); setTimeout(() => { const el = document.querySelector("#cards .my-ship"); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); }, 60); }
});
