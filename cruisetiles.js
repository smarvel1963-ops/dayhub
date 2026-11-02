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
  if (ed < 0) return `<button class="ct-stage ct-card" data-shellgo="plan" data-triplistgo="after">${head}
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
function ctTiles(tr) {
  const cr = trCruise(tr), ports = (tr.ports || []).length, left = tripLeft(tr), [pd, pn] = typeof listFrac === "function" ? listFrac(tr, "packing") : [0, 0];
  const end = tr.end || tr.start, during = !!tr.start && daysUntil(tr.start) <= 0 && daysUntil(end) >= 0, nights = tr.start ? tripNights(tr) : 0;
  const firstPort = (tr.ports || []).map(p => p.day).filter(Boolean).sort()[0];
  const funDay = during ? today() : firstPort || tr.start;
  return [
    ["🗓️", cr ? "My Cruise" : "My Trip", 'data-shellgo="plan" data-planview="trip"', [nights && ctPl(nights, "night"), ports && ctPl(ports, "port")].filter(Boolean).join(" · ")],
    ["📋", "Lists & Prep", 'data-shellgo="plan" data-planview="packing"', pn ? `packed ${pd}/${pn}` : ""],
    ["💳", "Payments & Budget", 'data-shellgo="wallet"', tr.total ? (left > 0 ? `${money(left)} left` : "paid ✓") : ""],
    ["✈️", "Travel & Stay", 'data-shellgo="plan" data-planview="reservations"', ""],
    cr && ["⚓", "Sail Day", 'data-help="get"', ""],
    cr && ["🛳️", "On Board", 'data-ctgo="ship"', ""],
    ["🌴", cr ? "Port Days" : "Things to Do", 'data-shellgo="explore"', ports ? ctPl(ports, "port") : ""],
    ["🎭", "Activities & Fun", funDay ? `data-tlday="${esc(funDay)}"` : 'data-shellgo="explore"', ""],     // the day screen holds the Fun Finder
    ["🏠", "Coming Home", cr ? 'data-gohome="open"' : 'data-shellgo="plan" data-triplistgo="after"', ""],   // the final-night checklist is cruise-only
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
    + `<nav class="ct-grid" aria-label="${esc(APP_NAME)}">${ctTiles(tr).map(ctTileHtml).join("")}</nav>`;
}

// MORE: everything that isn't one of the four - AI, diary, map, bookings, ship guide, final night, settings, the look.
// The trip-only tiles show only once there is a trip (no dead taps).
function ctMoreHtml() {
  const tr = curTrip(), cr = !!tr && trCruise(tr);
  const T = [["✨", "AI Helper", 'data-ask="open"', ""], ["📅", "My Day", 'data-shellgo="plan" data-planview="today"', ""],
    tr && ["🧳", "Packing", 'data-shellgo="plan" data-planview="packing"', ""], tr && ["📔", "Trip Diary", 'data-shellgo="plan" data-planview="diary"', ""],
    tr && ["📍", "Map", 'data-shellgo="plan" data-planview="map"', ""], tr && ["🎟️", "Bookings", 'data-shellgo="plan" data-planview="reservations"', ""],
    cr && ["🛳️", "Ship Guide", 'data-ctgo="ship"', ""], cr && ["🌙", "Final Night", 'data-gohome="open"', ""],
    cr && ["🧾", "Final Bill Check", 'data-billcheck="1"', ""], ["⚙️", STORE_MODE ? "Settings" : "Settings & Pass", 'data-ctgo="settings"', ""],
    ["👓", "Simple Mode", 'data-ctgo="settings"', "big buttons"], ["🎨", "Classic Look", 'data-ctgo="classic"', "the old screen"]].filter(Boolean);
  return `<nav class="ct-grid ct-more" aria-label="More">${T.map(ctTileHtml).join("")}</nav>`
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
    cr && ["🧾", "Final bill check", 'data-billcheck="1"', "match the ship's bill"]].filter(Boolean);
  return `<nav class="ct-grid ct-tools" aria-label="Money tools">${T.map(ctTileHtml).join("")}</nav>`;
}

// Called by shell.js shellHtml() while the new look is on: the lifesaver header on every tab + the tab's content.
function ctShellHtml(cardHtml) {
  if (TAB === "home") return homeHtml();                                   // homeHtml() hands over to ctHomeHtml()
  const top = `<section class="ct-band">${ctTopHtml(false)}</section>`;
  if (TAB === "ai") return top + ctMoreHtml();
  if (TAB === "explore") return top + exploreHtml(cardHtml);
  if (TAB === "plan") return top + planHtml(cardHtml);
  return top + (TAB === "wallet" ? ctMoneyTopHtml(curTrip()) + ctMoneyToolsHtml(curTrip()) : "")
    + SHELL_CARDS[TAB].filter(k => k !== "inbox" || S.mail.on || S.mail.found.length).map(k => cardHtml(k)).join("");
}

// Taps that belong to the new look only.
document.addEventListener("click", e => {
  const b = e.target.closest && e.target.closest("button[data-ctgo]");
  if (!b) return;
  const go = b.dataset.ctgo;
  if (go === "settings") { if (typeof openSettings === "function") openSettings(); return; }
  if (go === "classic") { try { localStorage.setItem(CT_KEY, "classic"); } catch (e2) { /* private mode */ } render(); window.scrollTo({ top: 0 }); toast("Classic look on this phone"); return; }
  if (go === "ship") { shellGo("explore"); setTimeout(() => { const el = document.querySelector("#cards .my-ship"); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); }, 60); }
});
