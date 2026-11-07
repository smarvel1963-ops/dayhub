/* SAVE AS: triptiles.js · LOCATION: C:/MarvelApps/dayhub/triptiles.js
 * TRIP HUB NEW LOOK - "Atlas" (Scott 11/06: his own ChatGPT board, saved as docs/hub_improvement/triphub/SCOTT_BOARD_1_2026-11-06.webp,
 * then "Build it"). An explorer's atlas: parchment cards with brass edges, painted ridgelines and pines behind every screen, one
 * orange route line, painted icons (../triphub/art/, made on OpenArt for this look, no brands or people).
 *   HOME  = the compass logo, the My Trip card for the moment (days to go + Ready, travel day + leave time, Day n of N, welcome home),
 *           his 12 tiles (My Trip, Bookings, Today, Map, Packing, Trip Money, Spending, Fix My Trip, Hotel, Road Trip, Things to Do, Help),
 *           then Needs you and the big button one scroll down.
 *   TABS  = Home | Plan | Map | Money | More (the shell's own keys home / plan / explore / wallet / ai, as Cruise Hub's new look does).
 *   FULL SCREENS (a back arrow and a big title, no tab bar, the painting to the bottom edge, as on his board): Trip Timeline, Bookings,
 *           Things to Do, Trip Money. The pop-ups (a booking, a day, the hotel, the wrap-up, Fix my trip, Help) keep their own content in the look.
 * Every tile opens what Trip Hub already has (trip.js, shell.js, ui.js); nothing new is decided or stored here, it is only laid out.
 * Where his board's words would say more than the app does, the app's own words stay (Things to Do needs the AI; the map is the real map).
 * SWITCH: TT_ON = false - customers keep the classic look. One phone previews it with ?look=tiles (kept on that phone, triphub.look);
 * the owner's phone (Scott Hub or the owner's OK on it) turns it on by itself, once. More -> Classic Look or ?look=classic turns it back.
 * Trip Hub only (MODE "trip"); Simple mode always wins. Loaded by ../triphub/index.html after shell.js (+ triptiles.css).
 * Hooks: shell.js homeHtml / shellHtml / paintTabs. #hero is hidden in this look, so ttNoticesHtml brings over the chips people must
 * not miss (new version, Install, Pro paused / ending, backup waiting).
 * DEPLOY ORDER: push dayhub first and let Pages publish, then triphub (the art, its page and its worker).
 */
"use strict";

const TT_ON = false;                 // THE SWITCH: true = everyone on Trip Hub gets the new look (Scott's go only)
const TT_KEY = "triphub.look";
(function ttFromLink() {             // ?look=tiles|classic sets this phone's look, then leaves the address as it was
  try {
    const u = new URL(location.href), v = u.searchParams.get("look");
    if (v !== "tiles" && v !== "classic") return;
    localStorage.setItem(TT_KEY, v); u.searchParams.delete("look");
    history.replaceState(null, "", u.pathname + (u.search || "") + u.hash);
  } catch (e) { /* private mode: the link just doesn't stick */ }
})();
const ttPick = () => { try { return localStorage.getItem(TT_KEY); } catch (e) { return null; } };
// The owner's phone holds Scott Hub or the owner's OK, so it turns the new look on by itself, once. After that Classic Look and Simple Mode
// still stick. Customers have neither, so nothing changes for them.
let TT_OWNER_CHECKED = false;
function ttOwnerOnce() {
  if (TT_OWNER_CHECKED) return; TT_OWNER_CHECKED = true;
  try {
    if (localStorage.getItem("triphub.ownerlook") || !(localStorage.getItem("scotthub.k") || localStorage.getItem("dayhub.ownerok") === "1")) return;
    localStorage.setItem("triphub.ownerlook", "1"); localStorage.setItem(TT_KEY, "tiles");
    if (S.simple) { S.simple = false; saveLocal(); }
  } catch (e) { /* private mode */ }
}
function ttOn() {
  if (typeof MODE === "undefined" || MODE !== "trip") return false;
  ttOwnerOnce();
  return typeof shellOn === "function" && shellOn() && !S.simple && (TT_ON ? ttPick() !== "classic" : ttPick() === "tiles");
}

// ---- the five tabs (his board: Home, Plan, Map, Money, More) - line icons on the dark pine bar
const TT_SVG = p => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
const TT_TABS = [
  ["home", TT_SVG('<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>'), "Home"],
  ["plan", TT_SVG('<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2.8h6V4"/><path d="M8.5 11l2 2 4-4M8.5 17h7"/>'), "Plan"],
  ["explore", TT_SVG('<path d="M9 4L3 6.5v13.5l6-2.5 6 2.5 6-2.5V4l-6 2.5z"/><path d="M9 4v13.5M15 6.5V20"/>'), "Map"],
  ["wallet", TT_SVG('<ellipse cx="12" cy="6.5" rx="7" ry="2.8"/><path d="M5 6.5v4c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8v-4"/><path d="M5 10.5v4c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8v-4"/>'), "Money"],
  ["ai", TT_SVG('<circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/>'), "More"],
];
const TT_TAB_NAME = { home: "Home", plan: "Plan", explore: "Map", wallet: "Money", ai: "More" };
// The compass logo (his board's brass compass with the orange needle).
const TT_LOGO = `<svg viewBox="0 0 48 48" aria-hidden="true"><defs><radialGradient id="ttcg" cx=".38" cy=".32" r=".8"><stop offset="0" stop-color="#fbf3dd"/><stop offset="1" stop-color="#e6d3a6"/></radialGradient></defs>
  <circle cx="24" cy="24" r="21" fill="#b8893b"/><circle cx="24" cy="24" r="18.2" fill="url(#ttcg)" stroke="#7a5a22" stroke-width="1"/>
  <g stroke="#7a5a22" stroke-width="1.4" stroke-linecap="round"><path d="M24 7.5v3M24 37.5v3M7.5 24h3M37.5 24h3"/></g>
  <path d="M24 9.5l4.2 14.5H19.8z" fill="#e8742a"/><path d="M24 38.5l-4.2-14.5h8.4z" fill="#3d5a6c"/><circle cx="24" cy="24" r="2.6" fill="#7a5a22"/></svg>`;
const TT_GEAR = TT_SVG('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.08a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.08a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>');
const TT_CHEV = `<span class="chev" aria-hidden="true">›</span>`;
// The painted icons: one picture each, cut from two icon sheets (../triphub/art/ic_*.webp). Decorative - every tile also has its words.
const TT_ICONS = ["backpack", "ticket", "calendar", "map", "bags", "coins", "wallet", "tools", "bed", "suv", "peak", "help",
  "journal", "weather", "folder", "clipboard", "hourglass", "ballot", "sparkle", "gear", "bell", "palette", "glasses", "tag"];
const ttIc = n => `<img class="tt-icimg" src="art/ic_${n}.webp" alt="" width="64" height="64" decoding="async">`;
// The scenes. Fetched only on a phone with the new look on; going through the worker keeps them for a trip with no signal.
const TT_ART = ["home", "screen", "card", "parchment", "booking", "road", "lodge"];
let TT_ART_ASKED = false;
function ttPreloadArt() {
  if (TT_ART_ASKED) return; TT_ART_ASKED = true;
  TT_ICONS.forEach(n => fetch(`art/ic_${n}.webp`).catch(() => {}));      // the icons are part of the screen, whatever the picture setting
  if (S.photo !== false) TT_ART.forEach(n => fetch(`art/${n}.webp`).catch(() => {}));
}
const ttMoney = n => Number.isInteger(n) ? `$${n.toLocaleString("en-US")}` : money(n);   // whole dollars as on his board; cents only when there are cents
const ttPl = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
const ttDates = tr => tr.start ? prettyDate(tr.start) + (tr.end && tr.end !== tr.start ? ` – ${prettyDate(tr.end)}` : "") : "";
const ttYmd = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ""));

function ttTopHtml(home) {
  return `<div class="tt-top"><span class="tt-logo" aria-hidden="true">${TT_LOGO}</span>
    <div class="tt-brand"><b>Trip Hub</b>${home ? "" : `<small>${esc(TT_TAB_NAME[TAB] || "")}</small>`}${navigator.onLine === false ? ` <span class="offline-pill">🟠 Offline</span>` : ""}</div>
    <button class="tt-gear" data-ttgo="settings" aria-label="Settings">${TT_GEAR}</button></div>`;
}
// The hidden hero's must-see chips (app.js heroHtml builds them; all of them for this one read, none folded behind "+N more").
function ttNoticesHtml() {
  const was = CHIPS_ALL; CHIPS_ALL = true; let html = "";
  try { html = heroHtml(); } finally { CHIPS_ALL = was; }
  const box = document.createElement("template"); box.innerHTML = html;
  const keep = [...box.content.querySelectorAll(".chips > [data-update], .chips > [data-install], .chips > [data-prolapse], .chips > [data-cloudask]")];
  return keep.length ? `<div class="tt-notices">${keep.map(c => c.outerHTML).join("")}</div>` : "";
}

// ---- the day the day-tools open on: today during the trip, else the first day
function ttFunDay(tr) {
  const end = tr.end || tr.start, during = !!tr.start && daysUntil(tr.start) <= 0 && daysUntil(end) >= 0;
  return during ? today() : tr.start;
}
// The next booking still ahead (today's not yet started, or a later day).
function ttNextBooking(tr) {
  const t = today(), now = nowT();
  return bookingsSorted(tr).find(b => ttYmd(b.day) && (b.day > t || (b.day === t && (!b.t || b.t >= now)))) || null;
}
// Travel day: the booking whose leave time is still ahead, with that time (trip.js leaveAt).
function ttLeaveNext(tr) {
  const t = today(), now = nowT();
  for (const b of bookingsSorted(tr)) {
    if (!ttYmd(b.day) || b.day < t || b.day > addDays(t, 1)) continue;
    const L = leaveAt(b); if (!L) continue;
    if (L.day > t || (L.day === t && L.t >= now)) return { b, L };
  }
  return null;
}

// ---- MY TRIP: the card for the moment (his board: name, dates, the big number, the Ready bar)
function ttStageHtml(tr) {
  const head = sub => `<span class="tt-k">My Trip</span><span class="tt-name">${esc(tr.name || "My trip")}</span>${sub ? `<span class="tt-sub">${sub}</span>` : ""}`;
  const where = tr.port ? esc(placeName(tr.port)) : "";
  if (!tr.start) return `<button class="tt-stage tt-card" data-tripedit="${esc(tr.id)}"><span class="tt-cardtext">${head(where)}</span>
      <span class="tt-big"><b>📅</b><small>Add your dates</small></span></button>`;
  const R = readiness(tr), sd = daysUntil(tr.start), end = tr.end || tr.start, ed = daysUntil(end), dates = esc(ttDates(tr));
  if (ed < 0) return `<button class="tt-stage tt-card" data-wrapopen="1"><span class="tt-cardtext">${head(dates)}</span>
      <span class="tt-big tt-home"><b>🏠</b><small>Welcome home · see your wrap-up</small></span></button>`;
  const all = tripLen(tr), n = -sd + 1;
  let big, lab, extra = "";
  if (sd > 0) { big = sd; lab = sd === 1 ? "Day to go" : "Days to go"; }
  else if (sd === 0) { const lv = ttLeaveNext(tr), nb = lv ? lv.b : ttNextBooking(tr); big = "✈️"; lab = "Travel day";   // no leave time typed (or already past): still the next booking
    if (lv) extra = `<span class="tt-leave">Leave at ${esc(hm(lv.L.t))}${lv.L.day !== today() ? ` ${esc(dayName(lv.L.day))}` : ""}</span>`;
    if (nb && nb.day <= addDays(today(), 1)) extra += `<span class="tt-next">${esc(bookKind(nb).icon)} ${esc(bookTitle(nb))}${nb.day !== today() ? " · tomorrow" : ""}${nb.t ? ` · ${esc(hm(nb.t))}` : ""}</span>`; }
  else { big = n; lab = `Day ${n} of ${all}`; const nb = ttNextBooking(tr);   // the next booking today or tomorrow (the day itself is already the big number)
    if (nb && nb.day <= addDays(today(), 1)) extra = `<span class="tt-next">Next: ${esc(bookKind(nb).icon)} ${esc(bookTitle(nb))} · ${nb.day === today() ? "today" : "tomorrow"}${nb.t ? ` ${esc(hm(nb.t))}` : ""}</span>`; }
  const ready = sd > 0 ? `<button class="tt-ready" data-cd="open" aria-label="${R.pct}% ready to go - open the checklist"><span class="tt-readyt"><b>${R.pct}%</b> Ready to Go</span><span class="tt-bar"><i style="width:${R.pct}%"></i></span></button>` : "";
  return `<div class="tt-stage"><button class="tt-card" data-ttgo="timeline"><span class="tt-cardtext">${head(dates)}${extra}</span>
      <span class="tt-big"><b>${esc(String(big))}</b><small>${esc(lab)}</small></span></button>${ready}</div>`;
}

// ---- the 12 tiles (his board, in his order). Each opens what Trip Hub already has; a tile that needs something first says so.
function ttTiles(tr) {
  const W = tripWallet(tr), [pd, pn] = typeof listFrac === "function" ? listFrac(tr, "packing") : [0, 0], nights = tr.start ? tripNights(tr) : 0;
  const books = tripBookings(tr), timed = books.some(b => b.day && b.t), hotels = bookingsSorted(tr).filter(b => b.kind === "hotel");
  const hotel = (typeof hotelNow === "function" && hotelNow(tr)) || hotels.find(b => !ttYmd(b.day) || (b.endDay || b.day) >= today()) || hotels[hotels.length - 1];   // tonight's, else the next stay, else the last
  const during = !!tr.start && daysUntil(tr.start) <= 0 && daysUntil(tr.end || tr.start) >= 0, spent = tripSpent(tr);
  const fix = typeof fixClashes === "function" ? fixClashes(tr).length : 0;
  return [
    ["backpack", "My Trip", 'data-ttgo="timeline"', nights ? ttPl(nights, "night") : ""],
    ["ticket", "Bookings", 'data-ttgo="bookings"', books.length ? `${books.length} booked` : ""],
    ["calendar", "Today", during ? `data-tlday="${esc(today())}"` : 'data-shellgo="plan" data-planview="today"', ""],
    ["map", "Map", 'data-shellgo="explore"', ""],
    ["bags", "Packing", 'data-shellgo="plan" data-planview="packing" data-triplistgo="packing"', pn ? `packed ${pd}/${pn}` : ""],
    ["coins", "Trip Money", 'data-shellgo="wallet"', W.total > 0 ? (W.left > 0 ? `${ttMoney(W.left)} left` : "paid ✓") : ""],
    ["wallet", "Spending", 'data-shellgo="wallet" data-triptabgo="onboard"', spent > 0 ? `${ttMoney(spent)} so far` : ""],
    ["tools", "Fix My Trip", timed ? 'data-fixopen="pick"' : 'data-ttgo="bookings"', fix ? `${ttPl(fix, "clash")}` : timed ? "" : "add a booking first", timed ? "" : "need"],
    ["bed", "Hotel", hotel ? `data-hotelopen="${esc(hotel.id)}"` : 'data-ttgo="bookings"', hotel ? "" : "add a hotel first", hotel ? "" : "need"],
    ["suv", "Road Trip", tr.start ? `data-ttgo="day:${esc(ttFunDay(tr))}:drive"` : 'data-tripedit="' + esc(tr.id) + '"', "breaks, food, fuel"],
    ["peak", "Things to Do", 'data-ttgo="things"', ""],
    ["help", "Help", 'data-help="home"', ""],
  ];
}
const ttTileHtml = t => `<button class="tt-tile${t[4] ? " " + t[4] : ""}" ${t[2]}><span class="tt-ic" aria-hidden="true">${ttIc(t[0])}</span><b>${esc(t[1])}</b>${t[3] ? `<small>${esc(t[3])}</small>` : ""}</button>`;

function ttHomeHtml() {
  const tr = curTrip();
  const hero = body => `<section class="tt-hero">${ttTopHtml(true)}${body}</section>`;
  if (!tr) return hero("") + ttNoticesHtml() + `<div class="tt-ways">${addTripHtml()}</div>`;   // no trip yet: the ways in
  // Needs you = the old Home's RIGHT NOW rows; on the trip, NEXT closes the list (the old Home's rule: never a repeat of a row above).
  const bb = bigButton(tr), items = rightNow(tr), onTrip = daysUntil(tr.start || today()) <= 0 && !!tr.start, nxRaw = onTrip ? nextUp() : "";
  const nxWhat = (nxRaw.split(" — ")[1] || "").toLowerCase();
  const nx = nxWhat && items.some(r => String(r.text).toLowerCase().includes(nxWhat)) ? "" : nxRaw;
  const needs = items.length || nx ? `<section class="tt-needs">${items.length ? "<h4>Needs you</h4>" : ""}${items.map(x => `<button class="tt-need" ${x.act || ""}>${x.icon ? `<span aria-hidden="true">${x.icon}</span>` : ""}<span class="grow">${esc(x.text)}${x.sub ? `<small>${esc(x.sub)}</small>` : ""}</span><span class="chev" aria-hidden="true">›</span></button>`).join("")}
      ${nx ? `<div class="tt-nextup"><span>NEXT</span>${nx}</div>` : ""}</section>` : "";
  const phase = typeof phaseCardHtml === "function" ? phaseCardHtml(tr) : "";
  return hero(ttStageHtml(tr)) + ttNoticesHtml()
    + `<nav class="tt-grid tt-main" aria-label="Trip Hub">${ttTiles(tr).map(ttTileHtml).join("")}</nav>`
    + `<div class="tt-below"><button class="tt-big-btn" ${bb.act}>${esc(bb.label)}</button>${phase ? `<div class="tt-phase">${phase}</div>` : ""}${needs}</div>`;
}

// ---- MORE: everything that isn't one of the tiles, by when you need it. A trip-only tile shows only once there is a trip (no dead taps).
const ttPassOffered = () => switchOn("PRO_GATE") && !STORE_MODE;          // never in the Play app (no Pass wording outside ⚙ there)
function ttMoreHtml() {
  const tr = curTrip(), when = !!tr && !!tr.start, on = when && daysUntil(tr.end || tr.start) >= 0, started = when && daysUntil(tr.start) <= 0, fun = when ? ttFunDay(tr) : "";
  const wishes = tr && typeof tripWish === "function" ? tripWish(tr).length : 0, timed = !!tr && tripBookings(tr).some(b => b.day && b.t);
  const groups = [
    ["Before you go", [tr && ["bags", "Packing", 'data-shellgo="plan" data-planview="packing" data-triplistgo="packing"', ""],
      tr && ["folder", "Documents", 'data-shellgo="plan" data-triplistgo="docs"', ""],   // no planview: Packing would reset the list (shell.js planHtml)
      tr && when && ["clipboard", "Before You Go", 'data-cd="open"', "the ready checklist"],
      tr && when && daysUntil(tr.start) >= 0 && ["tag", "What Am I Forgetting?", 'data-forget="1"', ""],
      tr && ["ticket", "Bookings", 'data-ttgo="bookings"', ""], timed && ["tools", "Fix My Trip", 'data-fixopen="pick"', ""]]],
    ["On the trip", [tr && ["calendar", "My Day", 'data-shellgo="plan" data-planview="today"', ""], tr && ["backpack", "Trip Timeline", 'data-ttgo="timeline"', ""],
      ["peak", "Things to Do", 'data-ttgo="things"', ""], ["weather", "Weather", 'data-ttgo="things:weather"', ""],
      on && ["hourglass", "Free Time", `data-ttgo="day:${esc(fun)}:free"`, ""],
      on && ["ballot", "Group Vote", wishes >= 2 ? `data-voteopen="${esc(tr.id)}"` : `data-ttgo="day:${esc(fun)}:free"`, wishes >= 2 ? "" : "add 2 ideas first"],
      tr && when && ["suv", "Road Trip", `data-ttgo="day:${esc(fun)}:drive"`, ""], tr && ["map", "Map", 'data-shellgo="explore"', ""],
      tr && ["journal", "Trip Diary", 'data-shellgo="plan" data-planview="diary"', ""]]],
    ["Money", [tr && ["coins", "Trip Money", 'data-shellgo="wallet"', ""], tr && ["wallet", "Spending", 'data-shellgo="wallet" data-triptabgo="onboard"', ""],
      tr && ["coins", "Split the Cost", `data-splitopen="${esc(tr.id)}"`, "who owes what"],
      tr && typeof exportMoney === "function" && ["clipboard", "Export the Money", `data-moneyexport="${esc(tr.id)}"`, "for a spreadsheet"]]],
    ["Coming home", [started && ["journal", "Trip Wrap-up", 'data-wrapopen="1"', "share or save it"]]],
    ["This app", [["sparkle", "Ask Trip Hub", 'data-ask="open"', ""], ["bell", "Reminders", 'data-ttgo="reminders"', ""],
      ttPassOffered() && ["tag", proName(), 'data-ttgo="passsettings"', hubProState().word], ["gear", "Settings", 'data-ttgo="settings"', ""],
      ["glasses", "Simple Mode", 'data-ttgo="simple"', "big buttons"], ["palette", "Classic Look", 'data-ttgo="classic"', "the old screen"]]]];
  return groups.map(([h, T]) => { const t = T.filter(Boolean);
      return t.length ? `<h4 class="tt-more-h">${esc(h)}</h4><nav class="tt-grid tt-more" aria-label="${esc(h)}">${t.map(ttTileHtml).join("")}</nav>` : ""; }).join("")
    + (tr && typeof prefsCardHtml === "function" ? prefsCardHtml() : "")
    + (typeof aiTabHtml === "function" ? aiTabHtml() : "");
}

// ---- full screens: ‹ comes back, a tab leaves them
let TT_SCREEN = null, TT_FROM = null, TT_TAB_FROM = null;
const ttBackHtml = (t, ic, right, attrs) => `<h2 class="tt-title"><button class="tt-back" ${attrs || 'data-ttgo="back"'} aria-label="Back">‹</button><span class="grow">${ic ? `<span class="tt-titleic" aria-hidden="true">${ttIc(ic)}</span>` : ""}${esc(t)}${navigator.onLine === false ? `<span class="offline-pill">🟠 Offline</span>` : ""}</span>${right || `<span class="tt-titlepad" aria-hidden="true"></span>`}</h2>`;
const TT_ADD = `<button class="tt-plus" data-ttgo="fab" aria-label="Add something">＋</button>`;

// TRIP TIMELINE (his board: a vertical route, a card per day). The rows are the old Plan → Trip ones; the trip card waits below the picture.
function ttTimelineHtml(tr, cardHtml) {
  return `<div class="tt-screen">${ttBackHtml("Trip Timeline", "backpack", TT_ADD)}${typeof timelineHtml === "function" ? timelineHtml() : ""}
    <div class="tt-artgap" aria-hidden="true"></div>${cardHtml("trips")}</div>`;
}
// BOOKINGS: the old Reservations, which holds the bookings, Fix my trip, paste an email and one tap to add each kind.
function ttBookingsHtml(tr) {
  return `<div class="tt-screen">${ttBackHtml("Bookings", "ticket", TT_ADD)}${reservationsHtml()}<div class="tt-artgap" aria-hidden="true"></div></div>`;
}
// THINGS TO DO: the AI's idea buttons for where you're going (they need Trip Hub AI, and say so), then the weather and the Hub family.
function ttThingsHtml(tr, cardHtml) {
  return `<div class="tt-screen">${ttBackHtml("Things to Do", "peak")}${typeof tripExploreHtml === "function" ? tripExploreHtml() : ""}
    ${SHELL_CARDS.explore.map(k => cardHtml(k)).join("")}<div class="tt-artgap" aria-hidden="true"></div></div>`;
}
// TRIP MONEY (his board): Trip Total / Paid / Left to Pay, what it adds up to, who owes whom, then the spending pace.
const TT_KIND = { flight: ["ticket", "Flights"], hotel: ["bed", "Hotel"], car: ["suv", "Car"], train: ["ticket", "Trains & buses"], ticket: ["peak", "Tickets & tours"], dinner: ["calendar", "Dining"],
  travel: ["ticket", "Travel"], parking: ["suv", "Parking"], excursion: ["peak", "Activities"], package: ["bags", "Packages"], insurance: ["folder", "Insurance"], other: ["coins", "Other"] };
const TT_KIND_ORDER = ["flight", "hotel", "car", "train", "ticket", "dinner", "travel", "parking", "excursion", "package", "insurance", "other"];
function ttMoneyTopHtml(tr) {
  const W = tripWallet(tr), books = tripBookings(tr);
  const row = (ic, l, n, sub) => `<div class="tt-mrow"><span class="tt-mic" aria-hidden="true">${ttIc(ic)}</span><span class="grow">${esc(l)}${sub ? `<small>${esc(sub)}</small>` : ""}</span><b>${esc(ttMoney(n))}</b></div>`;
  if (!(W.total > 0)) return `<section class="tt-money"><div class="tt-mlist"><div class="tt-mempty">Add what the trip costs (Edit the trip) or a booking with a price, and Trip Total, Paid and Left to Pay show here.</div></div>${ttSplitHtml(tr)}${ttPulseHtml(tr)}</section>`;
  const by = {};                                                             // a booking's cost by its kind (Flights, Hotel, Car...), the rest by its own kind
  W.costs.forEach(c => { const b = c.bk && books.find(x => x.id === c.bk), k = b && TT_KIND[b.kind] ? b.kind : TT_KIND[c.cat] ? c.cat : "other"; by[k] = (by[k] || 0) + Number(c.amt); });
  const left = tripLeft(tr) || 0, fd = ttYmd(tr.finalDue) ? daysUntil(tr.finalDue) : null;
  const due = W.fare > 0 && left > 0 && fd !== null ? `<div class="tt-due${fd < 0 ? " late" : fd <= 14 ? " soon" : ""}"><span aria-hidden="true">🔔</span><span><b>Final payment ${fd < 0 ? "was due" : "due"} ${esc(prettyDate(tr.finalDue))}</b><small>${fd >= 0 ? esc(inDays(fd)) : `${-fd} day${fd === -1 ? "" : "s"} ago`} · ${esc(ttMoney(left))} left on the trip cost</small></span></div>` : "";
  const rows = [W.fare > 0 && row("backpack", "Trip Cost", W.fare), ...TT_KIND_ORDER.filter(k => by[k] > 0).map(k => row(TT_KIND[k][0], TT_KIND[k][1], by[k]))].filter(Boolean);
  const longest = Math.max(...[W.total, W.paid, W.left].map(n => ttMoney(n).length));
  return `<section class="tt-money"><div class="tt-stats${longest > 8 ? " tiny" : longest > 6 ? " mid" : ""}"><div><small>Trip Total</small><b>${esc(ttMoney(W.total))}</b></div>
      <div class="paid"><small>Paid</small><b>${esc(ttMoney(W.paid))}</b></div><div class="left"><small>Left to Pay</small><b>${esc(ttMoney(W.left))}</b></div></div>${due}
      ${rows.length ? `<div class="tt-mlist">${rows.join("")}</div>` : ""}${ttSplitHtml(tr)}${ttPulseHtml(tr)}</section>`;
}
// Split the cost (his board's row of initials): the split sheet's own math (trip.js splitMath). Nobody added yet = one row that opens it.
function ttSplitHtml(tr) {
  if (typeof splitMath !== "function") return "";
  let M = null; try { M = splitMath(tr); } catch (e) { M = null; }
  if (!M || M.people.length < 2 || !(M.total > 0)) return `<button class="tt-mrow tt-splitrow" data-splitopen="${esc(tr.id)}"><span class="tt-mic" aria-hidden="true">${ttIc("coins")}</span><span class="grow">Split the Cost<small>Who owes what</small></span>${TT_CHEV}</button>`;
  const ini = n => esc((String(n).trim()[0] || "?").toUpperCase());
  const say = r => r.net < -0.004 ? `owes ${ttMoney(Math.abs(r.net))}` : r.net > 0.004 ? `is owed ${ttMoney(r.net)}` : "is even";
  return `<button class="tt-split" data-splitopen="${esc(tr.id)}"><span class="tt-splith"><b>Split the Cost</b>${TT_CHEV}</span>
      ${M.rows.slice(0, 6).map((r, i) => `<span class="tt-person"><i class="tt-ini c${i % 4}" aria-hidden="true">${ini(r.name)}</i><span class="grow">${esc(r.name)}</span><small>${esc(say(r))}</small></span>`).join("")}
      ${M.rows.length > 6 ? `<small class="tt-splitopen">+${M.rows.length - 6} more: tap to see everyone</small>` : ""}
      ${M.open.length ? `<small class="tt-splitopen">${ttPl(M.open.length, "cost")} not split yet</small>` : ""}</button>`;
}
// The spending pace in one line (the Spending tab's own pulse); it opens that tab.
function ttPulseHtml(tr) {
  if (typeof spendPulse !== "function") return "";
  const P = spendPulse(tr), ok = !!P && ["ok", "before"].includes(P.status);
  const say = !P ? "Set a budget and see your daily pace" : P.status === "over" ? "You're over your budget" : P.status === "fast" ? "Running ahead of your plan" : P.status === "before" ? `About ${ttMoney(Math.round(P.perDay))} a day` : "You're on track with your plan!";
  return `<button class="tt-pulse" data-shellgo="wallet" data-triptabgo="onboard" data-ttspend="1"><span class="tt-mic big" aria-hidden="true">${ttIc("wallet")}</span><span class="grow"><b>Spending</b><small>${esc(say)}</small></span>${P ? `<span class="tt-dot ${ok ? "ok" : "warn"}" aria-hidden="true">${ok ? "✓" : "!"}</span>` : TT_CHEV}</button>`;
}
// TRIP MAP: the real map (OpenStreetMap, trip.js) - the painting is only around it - and the next stop under it.
function ttMapHtml(tr) {
  if (!tr) return typeof tripMapHtml === "function" ? tripMapHtml() : "";
  const b = ttNextBooking(tr), K = b ? bookKind(b) : null;
  const next = b ? `<button class="tt-nextstop" data-bkopen="${esc(b.id)}"><span class="tt-mic big" aria-hidden="true">${ttIc("map")}</span><span class="grow"><small>Next stop</small><b>${esc(K.icon)} ${esc(bookTitle(b))}</b>
      <small>${esc(dayName(b.day))} ${esc(prettyDate(b.day))}${b.t ? ` · ${esc(hm(b.t))}` : ""}</small></span>${TT_CHEV}</button>` : "";
  return next + (typeof tripMapHtml === "function" ? tripMapHtml() : "");
}

// Called by shell.js shellHtml() while the new look is on.
function ttShellHtml(cardHtml) {
  ttPreloadArt();
  const tr = curTrip();
  const sc = TT_SCREEN === "things" ? "things" : tr ? TT_SCREEN : null;
  const moneyScreen = !sc && TAB === "wallet" && !!tr;
  document.body.dataset.ttscreen = sc || (moneyScreen ? "money" : "");
  TT_LEVELS = ttLevels(sc, moneyScreen); ttSyncSoon();
  document.body.classList.toggle("tt-noart", S.photo === false);           // ⚙ Real photo off: no pictures behind the screens
  if (sc === "timeline") return ttTimelineHtml(tr, cardHtml);
  if (sc === "bookings") return ttBookingsHtml(tr);
  if (sc === "things") return ttThingsHtml(tr, cardHtml);
  if (TAB === "home") return homeHtml();                                   // homeHtml() hands over to ttHomeHtml()
  const top = `<section class="tt-band">${ttTopHtml(false)}</section>`;
  const cards = () => SHELL_CARDS[TAB].filter(k => k !== "inbox" || S.mail.on || S.mail.found.length).map(k => cardHtml(k)).join("");
  if (TAB === "ai") return top + ttMoreHtml();
  if (moneyScreen) return `<div class="tt-screen">${ttBackHtml("Trip Money", "coins", TT_ADD, 'data-ttgo="tabback"')}</div>` + ttMoneyTopHtml(tr) + `<div class="tt-artgap" aria-hidden="true"></div>` + cards();
  if (TAB === "explore") return top + ttMapHtml(tr);
  if (TAB === "plan") return top + planHtml(cardHtml);
  return top + cards();
}

// ---- taps that belong to the new look only
function ttSettingsAt(id) { openSettings(); setTimeout(() => { const el = document.getElementById(id); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); }, 60); }
function ttDayAt(d, what) {                // open a day's screen at one of its tools
  showDay(d);
  setTimeout(() => { const sh = document.getElementById("daySheet"); if (!sh) return;
    const el = what === "drive" ? sh.querySelector(".drive-box, .drive-add") : [...sh.querySelectorAll(".day-label")].find(x => /Free time/.test(x.textContent));
    if (el) { if (el.tagName === "DETAILS") el.open = true; el.scrollIntoView({ behavior: "smooth", block: "start" }); } }, 60);
}
const ttTo = (screen, from) => { TT_FROM = from; TT_SCREEN = screen; render(); window.scrollTo({ top: 0 }); };
document.addEventListener("click", e => {
  if (!e.target.closest || typeof MODE === "undefined" || MODE !== "trip") return;
  const sg = e.target.closest("button[data-shellgo], button[data-readygo]");
  if (sg && ttOn()) { const to = sg.dataset.shellgo;                        // Money opened from another screen: its ‹ goes back there
    if (!(to === TAB && !TT_SCREEN))                                        // a tap that stays on Money (Spending row) keeps where ‹ goes
      TT_TAB_FROM = to === "wallet" && !sg.closest("#tabbar") && (TT_SCREEN || TAB !== "home") ? { tab: TAB, screen: TT_SCREEN } : null;
    TT_SCREEN = null; TT_FROM = null; }                                     // a tab, or a tile that goes to one, leaves a full screen
  if (ttOn() && e.target.closest("button[data-ttspend], button[data-triptabgo]")) setTimeout(() => { const c = document.querySelector('#cards [data-card="trips"]'); if (c) c.scrollIntoView({ behavior: "smooth", block: "start" }); }, 60);
  const b = e.target.closest("button[data-ttgo]");
  if (!b) return;
  const go = b.dataset.ttgo;
  if (go === "back") { TT_SCREEN = TT_FROM; TT_FROM = null; render(); window.scrollTo({ top: 0 }); return; }
  if (go === "tabback") { const f = TT_TAB_FROM; TT_TAB_FROM = null; if (!f) { shellGo("home"); return; } TT_SCREEN = f.screen; shellGo(f.tab); return; }
  if (go === "timeline" || go === "bookings" || go === "things") { ttTo(go, TT_SCREEN && TT_SCREEN !== go ? TT_SCREEN : null); return; }
  if (go === "things:weather") { ttTo("things", TT_SCREEN); setTimeout(() => { const c = document.querySelector('#cards [data-card="weather"]'); if (c) c.scrollIntoView({ behavior: "smooth", block: "start" }); }, 60); return; }
  if (go === "fab") { const f = document.getElementById("fab"); if (f) f.click(); return; }
  if (go === "reminders") { ttSettingsAt("remindBox"); return; }
  if (go === "passsettings") { ttSettingsAt("proBox"); return; }
  if (go === "simple") { ttSettingsAt("simpleBox"); return; }
  if (go === "settings") { if (typeof openSettings === "function") openSettings(); return; }
  if (go.startsWith("day:")) { const [, d, what] = go.split(":"); if (ttYmd(d)) ttDayAt(d, what); return; }
  if (go === "classic") { try { localStorage.setItem(TT_KEY, "classic"); } catch (e2) { /* private mode */ } TT_SCREEN = null; render(); window.scrollTo({ top: 0 }); toast("Classic look on this phone"); return; }
});
// Any other copy on his phone: five quick taps on the app's name at the bottom of Settings flip the look, whatever browser it lives in.
let TT_NAME_TAPS = [];
document.addEventListener("click", e => {
  const b = e.target.closest && e.target.closest("#sheet p.fine > b");
  if (!b || !/Marvel Corp app/.test(b.textContent) || typeof MODE === "undefined" || MODE !== "trip") return;
  const now = Date.now(); TT_NAME_TAPS = TT_NAME_TAPS.filter(x => now - x < 3000).concat(now);
  if (TT_NAME_TAPS.length < 5) return;
  TT_NAME_TAPS = []; const on = !ttOn();
  try { localStorage.setItem(TT_KEY, on ? "tiles" : "classic"); localStorage.setItem("triphub.ownerlook", "1"); } catch (e2) { /* private mode */ }
  if (on && S.simple) { S.simple = false; saveLocal(); }
  TT_SCREEN = null; closeSettings(); render(); window.scrollTo({ top: 0 }); toast(on ? "New look on for this phone" : "Classic look on this phone");
});
// The phone's own back button walks the same path as the arrow on screen (as Cruise Hub's new look): an open sheet closes first, a full
// screen goes back, a plain tab goes to Home, and only Home leaves the app. One step of history per press it takes to reach Home, added
// at the tap that opened the screen (Chrome skips a step a page adds with no tap). Never on the old look, so customers are untouched.
let TT_LEVELS = 0, TT_DEPTH = 0, TT_SKIP = 0, TT_SYNC_T = 0;
// The sheets' own close buttons (each runs its sheet's tidy-up). Not Ask's: closing it can reopen Settings.
const TT_CLOSERS = ["close", "dayclose", "bkclose", "hotelclose", "wrapclose", "splitclose", "voteclose", "driveclose", "fixclose", "helpclose", "readyclose", "forgetclose", "pulseclose", "rgclose"].map(k => `[data-${k}]`).join(", ");
function ttLevels(sc, money) {
  const up = t => t && t !== "home" ? 1 : 0;
  if (sc) return 1 + (TT_FROM ? 1 : 0) + up(TAB);
  if (money) { const f = TT_TAB_FROM; return 1 + (f ? (f.screen ? 1 : 0) + up(f.tab) : 0); }
  return up(TAB);
}
function ttSyncHistory() {
  TT_SYNC_T = 0;
  if (TT_SKIP || typeof MODE === "undefined" || MODE !== "trip") return;   // steps being taken away: their popstate runs this again
  const want = ttOn() ? TT_LEVELS + (document.querySelector(".sheet:not(.hidden)") ? 1 : 0) : 0;
  try {
    if (want && "scrollRestoration" in history) history.scrollRestoration = "manual";
    while (TT_DEPTH < want) history.pushState({ tt: ++TT_DEPTH }, "");
    if (TT_DEPTH > want) { TT_SKIP++; setTimeout(() => { TT_SKIP = 0; }, 1500); history.go(want - TT_DEPTH); TT_DEPTH = want; }
  } catch (e) { TT_DEPTH = want; /* some browsers limit this; the arrow still works */ }
}
function ttSyncSoon() { if (!TT_SYNC_T) TT_SYNC_T = setTimeout(ttSyncHistory, 0); }   // after every handler and redraw of this tap has run
document.addEventListener("click", () => { if (typeof MODE !== "undefined" && MODE === "trip") ttSyncSoon(); });
window.addEventListener("popstate", () => {
  if (TT_SKIP) { TT_SKIP--; ttSyncSoon(); return; }
  if (typeof MODE === "undefined" || MODE !== "trip" || !ttOn()) return;
  TT_DEPTH = Math.max(0, TT_DEPTH - 1);
  const open = [...document.querySelectorAll(".sheet:not(.hidden)")];
  if (open.length) {                     // each sheet's own close button where it has one (some redraw the screen behind, e.g. the split's sums)
    let bare = false;
    open.forEach(el => { const x = el.querySelector(TT_CLOSERS); if (x) x.click(); else { el.classList.add("hidden"); bare = true; } });
    if (bare) render();                  // a sheet with no close button we know: hidden, then the screen redrawn so nothing stale stays on it
    ttSyncSoon(); return; }
  const arrow = document.querySelector("#cards .tt-back");
  if (arrow) { arrow.click(); ttSyncSoon(); return; }
  if (TAB !== "home") { shellGo("home"); ttSyncSoon(); return; }
  if (history.state && history.state.tt) history.back();                   // a step left over from before a reload: keep walking out
});
