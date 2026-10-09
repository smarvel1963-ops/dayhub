/* SAVE AS: trip.js · LOCATION: C:/MarvelApps/dayhub/trip.js
 * TRIP BOOKINGS (Trip Hub V1, v0.98 - Scott 10/7 blueprint: "PLAN ... flights, hotels, rental cars,
 * tickets and shared schedules. Every item opens one reusable event-detail screen." + "one unified
 * Trip Timeline and one source of truth").
 *
 * A trip's bookings live on the trip (tr.bookings). Each one:
 *   - shows on its day(s) in the schedule, the day-by-day timeline, NEXT and the day screen
 *     (a hotel: check-in day + check-out day; a flight: departs + lands; a car: pick up + drop off);
 *   - opens ONE detail screen (tap anywhere it shows) with Edit / Delete, a map link and tap-to-call;
 *   - carries its cost into the trip's money (a linked row in tr.costs - the Wallet adds it up).
 * Works in every travel hub (Trip Hub and Cruise Hub - a hotel the night before, the flights).
 * Nothing is looked up online: what's shown is what the traveler typed. Loaded after shell.js.
 */
"use strict";

// kind: icon, label, the two "where" boxes, start / end words, number box, cost category
const BOOK_KINDS = {
  flight: { icon: "✈️", label: "Flight", a: "From (airport)", b: "To (airport)", start: "Departs", end: "Lands", num: "Flight number (e.g. AA 1234)", cat: "travel" },
  hotel: { icon: "🏨", label: "Hotel", a: "Hotel name", b: "Address", start: "Check-in", end: "Check-out", num: "Confirmation #", cat: "hotel" },
  car: { icon: "🚗", label: "Rental car", a: "Rental company", b: "Pick-up location", start: "Pick up", end: "Drop off", num: "Confirmation #", cat: "travel" },
  train: { icon: "🚆", label: "Train / bus", a: "From", b: "To", start: "Departs", end: "Arrives", num: "Ticket / booking #", cat: "travel" },
  ticket: { icon: "🎟️", label: "Tickets / tour", a: "What (e.g. theme park, show)", b: "Where", start: "Starts", end: "Ends", num: "Confirmation #", cat: "other" },
  dinner: { icon: "🍽️", label: "Dinner", a: "Restaurant", b: "Address", start: "Time", end: "", num: "Confirmation #", cat: "other" },
};
const bookKind = b => BOOK_KINDS[b.kind] || BOOK_KINDS.ticket;
const tripBookings = tr => (tr && Array.isArray(tr.bookings) ? tr.bookings : []);
function bookTitle(b) {
  const K = bookKind(b);
  if (b.kind === "flight") return `${b.num ? b.num + " · " : ""}${b.a || "?"} → ${b.b || "?"}`;
  if (b.kind === "train") return `${b.a || "?"} → ${b.b || "?"}`;
  return b.a || K.label;
}
// Sorted by when they start (undated last).
const bookingsSorted = tr => tripBookings(tr).slice().sort((x, y) => `${x.day || "9"}${x.t || "99"}`.localeCompare(`${y.day || "9"}${y.t || "99"}`));   // untimed after timed, same day

// ---- the day list (called from app.js dayItems for every trip)
function bookingItems(tr, day) {
  const out = [];
  tripBookings(tr).forEach(b => {
    const K = bookKind(b), title = bookTitle(b);
    if (b.day === day) out.push({ t: b.t || null, title: `${K.start === "Time" ? "" : K.start + " — "}${title}`, sub: [K.label, b.num && b.kind !== "flight" ? b.num : ""].filter(Boolean).join(" · "), kind: "book", icon: K.icon, bk: b.id, trip: tr.id });
    const ed = b.endDay || (b.endT ? b.day : "");                          // a flight that lands the same day
    if (K.end && ed === day && (ed !== b.day || b.endT))
      out.push({ t: b.endT || null, title: `${K.end} — ${title}`, sub: K.label, kind: "book", icon: K.icon, bk: b.id, trip: tr.id });
  });
  return out;
}
// Short words for the timeline row of one day ("🏨 check-in", "✈️ 7:05 AM").
function bookingBits(tr, d) {
  return bookingItems(tr, d).map(x => `${x.icon} ${x.t ? hm(x.t) : x.title.split(" — ")[0].toLowerCase()}`);
}

// ---- readiness (called from app.js readiness for a regular trip, in place of "Booking number saved")
function tripReady(tr, add) {
  const B = tripBookings(tr), nights = tr.start && tr.end ? Math.round((parseDay(tr.end) - parseDay(tr.start)) / 86400000) : 0;
  if (nights > 0) add("Where you're staying", B.some(b => b.kind === "hotel") || tr.booking ? 1 : 0, 120, "Add where you're staying (Plan → Reservations → 🏨 Hotel)");
  else add("Booking number saved", tr.booking ? 1 : 0, 9999, "Add your booking number (Edit)");
}
const tripGettingThere = tr => tripBookings(tr).some(b => ["flight", "car", "train"].includes(b.kind));

// ---- money: one linked cost row per booking with a price
function syncBookingCost(tr, b) {
  tr.costs = tr.costs || [];
  const i = tr.costs.findIndex(c => c.bk === b.id), row = { bk: b.id, cat: bookKind(b).cat, what: `${bookKind(b).icon} ${bookTitle(b)}`.slice(0, 80), amt: Number(b.cost), paid: !!b.paid };
  if (!(Number(b.cost) > 0)) { if (i >= 0) tr.costs.splice(i, 1); return; }
  if (i >= 0) Object.assign(tr.costs[i], row); else tr.costs.push({ id: uid(), ...row });   // an edit keeps its place in the list
}

// ---- PLAN → Reservations: the bookings + one tap to add each kind
function bookingsHtml(tr) {
  const rows = bookingsSorted(tr).map(b => { const K = bookKind(b);
    const ed = b.endDay || (b.endT ? b.day : "");
    const when = b.day ? `${dayName(b.day)} ${prettyDate(b.day)}${b.t ? ` · ${hm(b.t)}` : ""}${K.end && ed ? ` → ${ed !== b.day ? prettyDate(ed) + " " : ""}${b.endT ? hm(b.endT) : ""}` : ""}` : "No date yet";
    return `<button class="rn-row" data-bkopen="${b.id}"><span>${K.icon}</span><span class="grow">${esc(bookTitle(b))}<span class="sub">${esc(K.label)} · ${esc(when)}${Number(b.cost) > 0 ? ` · ${money(Number(b.cost))}${b.paid ? " paid ✓" : ""}` : ""}</span></span><span class="chev">›</span></button>`; }).join("");
  return `<div class="day-label">Your bookings</div>${rows || `<div class="today-line sub">Flights, hotels, cars, tickets — add them below and they land on the right day.</div>`}
    ${rows ? `<button class="rn-row" data-fixopen="pick"><span>🔄</span><span class="grow">Fix my trip<span class="sub">${(n => n ? `⚠️ ${n} clash${n === 1 ? "" : "es"} — ` : "")(fixClashes(tr).length)}Late, moved or canceled? See what it knocks out</span></span><span class="chev">›</span></button>` : ""}
    <button class="rn-row" data-bkpasteopen="1"><span>📋</span><span class="grow">Paste a confirmation email<span class="sub">Flights, hotels, rental cars — filled in for you to check</span></span><span class="chev">›</span></button>
    ${tileNav(Object.entries(BOOK_KINDS).map(([k, K]) => ({ icon: K.icon, label: `＋ ${K.label}`, attrs: `data-bkadd="${k}"` })), 3, "bk-add")}`;
}

// ---- the ONE detail screen (and its edit form)
let BK_TRIP = null;
function bkSheet() {
  let el = document.getElementById("bookSheet");
  if (!el) { el = document.createElement("div"); el.id = "bookSheet"; el.className = "sheet"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "Booking"); document.body.appendChild(el); }
  return el;
}
const bkFind = id => { for (const tr of myTrips()) { const b = tripBookings(tr).find(x => x.id === id); if (b) return [tr, b]; } return [null, null]; };
function showBooking(id) {
  const [tr, b] = bkFind(id); if (!b) return;
  const K = bookKind(b), el = bkSheet(), row = (l, v) => v ? `<div class="row"><span class="grow"><b>${l}</b><span class="sub">${v}</span></span></div>` : "";
  const place = b.kind === "flight" ? `${b.a} airport` : b.kind === "car" ? [b.a, b.b].filter(Boolean).join(" ") : b.kind === "train" ? b.a : [b.a, b.b].filter(Boolean).join(", ");
  el.innerHTML = `<div class="sheet-body"><div class="grab"></div>
    <div class="sheet-head"><h2>${K.icon} ${esc(bookTitle(b))}</h2><button class="icon-btn" data-bkclose="1" aria-label="Close">✕</button></div>
    <p class="fine" style="margin-top:0">${esc(K.label)} · ${esc(tr.name)}</p>
    ${row(K.start, b.day ? `${dayName(b.day)} ${prettyDate(b.day)}${b.t ? " · " + hm(b.t) : ""}` : "")}
    ${K.end ? row(K.end, b.endDay || b.endT ? [b.endDay && `${dayName(b.endDay)} ${prettyDate(b.endDay)}`, b.endT && hm(b.endT)].filter(Boolean).join(" · ") : "") : ""}
    ${row(K.a.replace(/ \(.*\)/, ""), esc(b.a || ""))}${row(K.b.replace(/ \(.*\)/, ""), esc(b.b || ""))}
    ${row(K.num.replace(/ \(.*\)/, ""), esc(b.num || ""))}${row("Phone", telLinks(b.phone || ""))}
    ${Number(b.cost) > 0 ? row("Cost", `${money(Number(b.cost))} · ${b.paid ? "paid ✓" : "not paid yet"}`) : ""}
    ${b.note ? `<div class="today-line">📝 ${esc(b.note)}</div>` : ""}
    <div class="foot-actions" style="flex-wrap:wrap;margin-top:10px">
      ${place.trim() ? `<a class="btn sm ghost" href="${mapsLink(place)}" target="_blank" rel="noopener">🗺️ Map</a>` : ""}
      ${b.day && b.t ? `<button class="btn sm ghost" data-fixopen="${b.id}">🔄 This changed</button>` : ""}
      <button class="btn sm ghost" data-bkedit="${b.id}">✏️ Edit</button>
      <button class="btn sm ghost" data-bkdel="${b.id}">Delete</button></div></div>`;
  el.classList.remove("hidden");
}
let BK_DRAFT = null;                                                       // the pasted find being checked (v1.00)
function showBookingForm(kind, id, draft) {
  const [tr0, b0] = id ? bkFind(id) : [curTrip(), null], tr = tr0 || curTrip();
  if (!tr) { toast(`Add your ${TW} first`); return; }
  BK_TRIP = tr.id; BK_DRAFT = draft || null;
  const b = b0 || (draft ? { ...draft } : { kind, day: tr.start || "", endDay: kind === "hotel" ? (tr.end || "") : "" }), K = bookKind(b), v = k => esc(b[k] ?? "");
  const el = bkSheet();
  el.innerHTML = `<div class="sheet-body"><div class="grab"></div>
    <div class="sheet-head"><h2>${K.icon} ${b0 ? "Edit" : "Add"} ${esc(K.label.toLowerCase())}</h2><button class="icon-btn" data-bkclose="1" aria-label="Close">✕</button></div>
    <form class="qa-form" data-bkform="${esc(b.kind)}" data-bkid="${b0 ? esc(b0.id) : ""}">
      <div class="two"><input name="a" placeholder="${esc(K.a)}" value="${v("a")}" required autocomplete="off"><input name="b" placeholder="${esc(K.b)}" value="${v("b")}" autocomplete="off"></div>
      <div class="two"><label class="field" style="margin:0">${K.start}<input name="day" type="date" value="${v("day")}"></label><label class="field" style="margin:0">&nbsp;<input name="t" type="time" value="${v("t")}"></label></div>
      ${K.end ? `<div class="two"><label class="field" style="margin:0">${K.end}<input name="endDay" type="date" value="${v("endDay")}"></label><label class="field" style="margin:0">&nbsp;<input name="endT" type="time" value="${v("endT")}"></label></div>` : ""}
      <div class="two"><input name="num" placeholder="${esc(K.num)}" value="${v("num")}" autocomplete="off"><input name="phone" type="tel" placeholder="Phone (optional)" value="${v("phone")}" autocomplete="off"></div>
      <div class="two"><input name="cost" type="number" step="0.01" min="0" inputmode="decimal" placeholder="Cost $ (optional)" value="${v("cost")}">
        <label class="field" style="margin:0;flex-direction:row;align-items:center;gap:8px"><input name="paid" type="checkbox" value="1" ${b.paid ? "checked" : ""} style="width:auto"> Paid</label></div>
      <input name="note" placeholder="Note (seat, room type, what to bring…)" value="${v("note")}" autocomplete="off">
      <button class="btn">${b0 ? "Save" : "Add"}</button>
      <div class="hint">${esc(APP_NAME)} never asks for card numbers. A cost here is added to the trip's money.</div></form></div>`;
  el.classList.remove("hidden");
  setTimeout(() => { const i = el.querySelector("input"); if (i) i.focus(); }, 60);
}
function saveBooking(f, d) {
  const tr = S.trips.find(x => x.id === BK_TRIP); if (!tr) return;
  snap(); tr.bookings = tripBookings(tr).slice();
  const fields = { kind: f.dataset.bkform, a: (d.a || "").trim(), b: (d.b || "").trim(), day: d.day || "", t: d.t || "", endDay: d.endDay || "", endT: d.endT || "",
    num: (d.num || "").trim(), phone: (d.phone || "").trim(), cost: Number(d.cost || 0) || null, paid: d.paid === "1", note: (d.note || "").trim() };
  let b = tr.bookings.find(x => x.id === f.dataset.bkid);
  if (b) Object.assign(b, fields); else { b = { id: uid(), ...fields }; tr.bookings.push(b); }
  syncBookingCost(tr, b); save(); hideSheet("bookSheet"); render(); buzz(); toast(`${bookKind(b).icon} Saved ✓`, true);
  if (BK_DRAFT) { PASTE_FOUND = PASTE_FOUND.filter(x => x !== BK_DRAFT); BK_DRAFT = null; if (PASTE_FOUND.length) showPasteFound(); }   // next pasted find
}
function deleteBooking(id) {
  const [tr, b] = bkFind(id); if (!b) return;
  snap(); tr.bookings = tripBookings(tr).filter(x => x.id !== id); tr.costs = (tr.costs || []).filter(c => c.bk !== id);
  save(); hideSheet("bookSheet"); render(); toast("Booking deleted", true);
}

// ---- clicks / submits (called from cruise.js cruiseClick / cruiseSubmit)
function tripClick(ds) {
  if (diaryClick(ds)) return true;                                         // v1.01 trip diary
  if (funClick(ds)) return true;                                           // v1.04 Fun Finder
  if (fixClick(ds)) return true;                                           // v1.11 Fix my trip
  if (ds.bkadd) { showBookingForm(ds.bkadd); return true; }
  if (ds.bkopen) { hideSheet("daySheet"); showBooking(ds.bkopen); return true; }
  if (ds.bkedit) { showBookingForm(null, ds.bkedit); return true; }
  if (ds.bkdel) { deleteBooking(ds.bkdel); return true; }
  if (ds.bkclose) { hideSheet("bookSheet"); return true; }
  if (ds.bkpasteopen) { showPasteBooking(); return true; }                   // v1.00 paste a confirmation
  if (ds.bkdraft) { const d = PASTE_FOUND[Number(ds.bkdraft)]; if (d) showBookingForm(null, null, d); return true; }
  return false;
}
function tripSubmit(f, data) {
  if (diarySubmit(f, data)) return true;                                   // v1.01 trip diary
  if (funSubmit(f, data)) return true;                                     // v1.04 Fun Finder
  if (fixSubmit(f, data)) return true;                                     // v1.11 Fix my trip
  if (f.dataset.bkpaste) { pasteBookings(data.text || ""); return true; }
  if (!f.dataset.bkform) return false;
  saveBooking(f, data); return true;
}

// ------------------------------------------------------------ TRIP MAP (v0.99)
// Scott's blueprint: "PLAN — TODAY / TRIP / MAP / RESERVATIONS". Free and only when opened (Scott: no paid data
// until the free path works): map pictures from OpenStreetMap, the Leaflet map code from cdnjs, place search from
// OpenStreetMap's Nominatim (1 request a second, results remembered on this phone in "hub.geo"). The places are
// the trip's own: where you're going, each hotel, the airports of each flight, the car pick-up, stations, tickets,
// dinners and (cruise) the port days - numbered in date order. A place that can't be found is listed, not guessed.
const GEO_KEY = "hub.geo", LEAFLET = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/";
let MAP = null, MAP_LOADING = null, GEO_BUSY = false;
const geoCache = () => { try { return JSON.parse(localStorage.getItem(GEO_KEY) || "{}") || {}; } catch (e) { return {}; } };
function geoPut(q, v) { const c = geoCache(); c[q] = v; try { localStorage.setItem(GEO_KEY, JSON.stringify(c)); } catch (e) { /* full / private */ } }
function mapPlaces(tr) {
  if (!tr) return [];
  const city = placeName(tr.port || "");
  // alts: what to try when the first search finds nothing (OpenStreetMap is strict - a resort's street address may
  // sit in a different town than the one typed), e.g. "Hotel name, Orlando" then the name alone.
  const P = [], put = (label, q, day, icon, bk, alts) => { q = String(q || "").trim();
    if (q) P.push({ label, q, day: day || "", icon, bk: bk || "", alts: (alts || []).map(x => String(x || "").trim()).filter(x => x && x !== q) }); };
  if (!isCruise(tr)) put(placeName(tr.port || "") || tr.name, tr.port, tr.start, "📍");
  else put(`${placeName(tr.port || "")} — sail day`, tr.port, tr.start, "🚢");
  bookingsSorted(tr).forEach(b => { const K = bookKind(b);
    if (b.kind === "flight" || b.kind === "train") { const s = b.kind === "flight" ? " airport" : " station";
      put(`${K.icon} ${b.a}`, b.a && b.a + s, b.day, K.icon, b.id); put(`${K.icon} ${b.b}`, b.b && b.b + s, b.endDay || b.day, K.icon, b.id); }
    else put(`${K.icon} ${b.a}`, b.kind === "car" ? [b.b, b.a].filter(Boolean).join(" ") : (b.b || b.a), b.day, K.icon, b.id,
      [b.a && city && `${b.a}, ${city}`, b.a]); });
  if (isCruise(tr)) (tr.ports || []).forEach(pt => put(`⚓ ${pt.name}`, pt.name, pt.day, "⚓"));
  const seen = new Set();                                                   // one pin per place
  return P.filter(p => { const k = p.q.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; })
    .sort((x, y) => (x.day || "9").localeCompare(y.day || "9")).map((p, i) => ({ ...p, n: i + 1 }));
}
async function mapGeocode(q, alts = []) {   // NOT "geocode" - app.js owns that name (weather city lookup)
  const c = geoCache(); if (q in c) return c[q];
  let v = 0;
  for (const [i, x] of [q, ...alts].entries()) {
    if (i) await new Promise(r => setTimeout(r, 1100));                     // one a second - OpenStreetMap's rule
    try { const j = await (await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(x)}`)).json();
      if (j && j[0]) { v = [Number(j[0].lat), Number(j[0].lon)]; break; } } catch (e) { return null; }   // offline: try again next time
  }
  geoPut(q, v); return v;                                                   // remembered under the first name
}
function loadLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  if (MAP_LOADING) return MAP_LOADING;
  MAP_LOADING = new Promise((ok, bad) => {
    const css = document.createElement("link"); css.rel = "stylesheet"; css.href = LEAFLET + "leaflet.min.css"; document.head.appendChild(css);
    const s = document.createElement("script"); s.src = LEAFLET + "leaflet.min.js"; s.onload = () => ok(window.L); s.onerror = () => { MAP_LOADING = null; bad(new Error("map code")); };
    document.head.appendChild(s); });
  return MAP_LOADING;
}
function tripMapHtml() {
  const tr = curTrip(); if (!tr) return `<div class="empty">Plan a ${TW} first.</div>`;
  const P = mapPlaces(tr), c = geoCache();
  setTimeout(drawTripMap, 0);
  return `<section class="card trip-map-card"><h3>📍 Your ${isCruise(tr) ? "cruise" : "trip"} on the map</h3><div class="body">
      ${P.length ? `<div id="tripMap" class="trip-map" role="img" aria-label="Map of your ${TW}"><div class="map-msg">Loading the map…</div></div>` : ""}
      ${P.map(p => `<${p.bk ? `button class="rn-row" data-bkopen="${p.bk}"` : `div class="rn-row"`}><span class="map-n">${p.n}</span><span class="grow">${esc(p.label)}<span class="sub">${p.day ? `${dayName(p.day)} ${prettyDate(p.day)}` : ""}${c[p.q] === 0 ? " · not found on the map" : ""}</span></span>${p.bk ? `<span class="chev">›</span></button>` : "</div>"}`).join("")
        || `<div class="today-line sub">Add where you're going (Edit) and your bookings (Reservations) — they show up here as pins.</div>`}
      <p class="fine" style="margin-top:8px">Map © OpenStreetMap contributors. Opening the map looks up these places on OpenStreetMap.</p></div></section>`;
}
async function drawTripMap() {
  const el = document.getElementById("tripMap"); if (!el) return;
  const tr = curTrip(), P = mapPlaces(tr);
  let L; try { L = await loadLeaflet(); } catch (e) { el.innerHTML = `<div class="map-msg">The map needs a connection — your places are listed below.</div>`; return; }
  if (!document.body.contains(el)) return;                                 // the view changed while loading
  if (MAP) { try { MAP.remove(); } catch (e) { /* old map */ } MAP = null; }
  el.innerHTML = "";
  MAP = L.map(el, { zoomControl: true, attributionControl: true });
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18, attribution: "© OpenStreetMap contributors" }).addTo(MAP);
  MAP.setView([39.5, -98.35], 3);                                           // the US until the pins arrive
  const pts = [], c = geoCache();
  const pin = (p, ll) => { pts.push(ll);
    L.marker(ll, { icon: L.divIcon({ className: "map-pin", html: `<span>${p.n}</span>`, iconSize: [26, 26] }) }).addTo(MAP)
      .bindPopup(`<b>${esc(p.label)}</b>${p.day ? `<br>${dayName(p.day)} ${prettyDate(p.day)}` : ""}${p.bk ? `<br><button class="btn sm ghost" data-bkopen="${p.bk}">Open</button>` : ""}`);
    if (pts.length > 1) { L.polyline(pts, { color: "#5eead4", weight: 2, opacity: .6, dashArray: "4 6" }).addTo(MAP); MAP.fitBounds(pts, { padding: [28, 28], maxZoom: 13 }); }
    else MAP.setView(ll, 11); };
  P.filter(p => Array.isArray(c[p.q])).forEach(p => pin(p, c[p.q]));
  const todo = P.filter(p => !(p.q in c));
  if (!todo.length || GEO_BUSY) return;
  GEO_BUSY = true;
  for (const p of todo) {                                                   // one a second - OpenStreetMap's rule
    const ll = await mapGeocode(p.q, p.alts);
    if (MAP && Array.isArray(ll) && document.body.contains(el)) pin(p, ll);
    await new Promise(r => setTimeout(r, 1100));
  }
  GEO_BUSY = false;
  if (document.body.contains(el) && todo.some(p => geoCache()[p.q] === 0)) render();   // show "not found" in the list
}

// ------------------------------------------------------------ PASTE A CONFIRMATION (v1.00)
// Scott's blueprint: "Confirmation Intelligence - Forward an email, import a PDF or scan a screenshot. AI
// extracts travel details, asks for confirmation and adds them." V1 = paste: the email is read ON THIS PHONE
// (no AI, nothing sent), each flight leg / hotel / rental car found opens the booking form filled in, and
// nothing is saved until the traveler taps Add. What can't be read stays blank - never guessed.
const CAR_COS = ["Hertz", "Avis", "Enterprise", "Budget", "National", "Alamo", "Thrifty", "Dollar", "Sixt", "Fox Rent A Car", "Payless", "Turo"];
const ADDR_RE = /\b\d{1,6}\s+[A-Za-z0-9.' ]{2,40}\b(?:St|Street|Ave|Avenue|Dr|Drive|Rd|Road|Blvd|Boulevard|Hwy|Highway|Way|Pkwy|Parkway|Ln|Lane|Ct|Court|Pl|Place|Cir|Circle|Trl|Trail)\b\.?[A-Za-z0-9 ,.'-]{0,60}/;
const PHONE_RE = /(?:\+?1[\s.-]?)?\(?\b\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b/;
const NUM_RE = /\b(?:confirmation|booking|reservation|record locator|itinerary|pnr)\s*(?:#|number|no\.?|code)?\s*:?\s*([A-Za-z0-9]{5,14})\b/gi;
const MONEY_RE = /\b(?:total|grand total|amount charged|total charged|estimated total|trip total)[^$\n]{0,30}\$\s?([\d,]+(?:\.\d{2})?)/i;
const pasteLines = text => String(text || "").replace(/\r/g, "").split(/\n+/).map(l => l.replace(/\s+/g, " ").trim()).filter(Boolean);
const timesIn = l => [...l.matchAll(TIME_RE)].map(m => t24(m[1], m[2], m[3]));
const dateIn = l => { const d = parseDateTime(l.replace(TIME_RE, "")); return d ? d.day : ""; };
// A confirmation number has a digit, or is a code in capitals (QXRMLM) - never a word like "Confirmed".
const numOk = v => /\d/.test(v) || (/^[A-Z]{5,8}$/.test(v) && !/^(CONFIRMED|NUMBER|BOOKING|DETAILS|SUMMARY)$/.test(v));
// The line index of each confirmation number, total and phone, so each booking takes the one nearest to it.
function pasteMarks(L) {
  const M = { num: [], money: [], phone: [] };
  L.forEach((l, i) => {
    for (const m of l.matchAll(NUM_RE)) if (numOk(m[1])) M.num.push([i, m[1].toUpperCase()]);
    const mm = l.match(MONEY_RE); if (mm) M.money.push([i, Number(mm[1].replace(/,/g, ""))]);
    const pp = l.match(PHONE_RE); if (pp) M.phone.push([i, pp[0]]);
  });
  return M;
}
// nearest mark at or after `from` but before `upto`; else the nearest one before `from` (within `back` lines)
function markNear(list, from, upto = 1e9, back = 12) {
  const after = list.find(([i]) => i >= from && i < upto); if (after) return after[1];
  const before = list.filter(([i]) => i < from && i >= from - back).pop(); return before ? before[1] : (list.length === 1 ? list[0][1] : "");
}
// "Check-in: Tue, Oct 20, 2026 at 3:00 PM" - or the label alone with the date on one of the next 2 lines.
function labeled(L, re, from = 0) {
  for (let i = from; i < L.length; i++) { const m = L[i].match(re); if (!m) continue;
    const look = [(m[1] || "").trim(), L[i + 1] || "", L[i + 2] || ""];
    const day = look.map(dateIn).find(Boolean) || "", t = look.flatMap(timesIn)[0] || "";
    return { i, day, t, raw: look[0] || look[1] }; }
  return null;
}
function extractBookings(text) {
  const L = pasteLines(text), all = L.join("\n"), out = [], M = pasteMarks(L);
  // FLIGHTS: each line with two airport codes is a leg - "LIT → MCO", "Little Rock (LIT) to Orlando (MCO)"
  // Three layouts: "Little Rock (LIT) to Orlando (MCO)" · "LIT → MCO" / "LIT 7:05 AM → MCO 10:40 AM" ·
  // "Depart: Little Rock (LIT)" with "Arrive: Orlando (MCO)" on one of the next 3 lines.
  const legRe = /\(?\b([A-Z]{3})\b\)?[^\n]{0,40}?(?:→|->|–|—|\s-\s|\bto\b)[^\n]{0,40}?\(\s*([A-Z]{3})\s*\)|\b([A-Z]{3})\s*(?:→|->|–|—|-|\bto\b)\s*([A-Z]{3})\b|\b([A-Z]{3})\b[^\n]{0,25}?(?:→|->)[^\n]{0,25}?\b([A-Z]{3})\b/;
  const STOP = new Set(["THE", "AND", "FOR", "YOU", "USD", "PDT", "PST", "EST", "EDT", "CST", "CDT", "MST", "MDT", "GMT", "UTC", "TSA", "ETA", "ETD", "MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]);
  const legs = [], used = new Set();
  if (/\b(flight|airline|depart|boarding|seat)/i.test(all) || /\b[A-Z]{3}\b[^\n]{0,25}(?:→|->)/.test(all)) L.forEach((l, i) => {   // a word, or "ATL … → MCO"
    if (used.has(i)) return;
    let A, B; const m = l.match(legRe);
    if (m) { A = m[1] || m[3] || m[5]; B = m[2] || m[4] || m[6]; }
    else { const d = l.match(/\b(?:depart(?:s|ing|ure)?|from|leaving)\b[^\n]*\(\s*([A-Z]{3})\s*\)/i);
      if (d) for (let k = i + 1; k <= i + 3 && k < L.length; k++) { const a = L[k].match(/\b(?:arriv(?:e|es|ing|al)|to)\b[^\n]*\(\s*([A-Z]{3})\s*\)/i);
        if (a) { A = d[1]; B = a[1]; used.add(k); break; } } }
    if (!A || !B || STOP.has(A) || STOP.has(B) || A === B) return;
    legs.push({ i, A, B });
  });
  // one record locator for the flight booking: the code above the first leg (usually the top), else just below it
  const firstOther = Math.min(...[/check[- ]?in/i, /^pick[- ]?up/i].map(re => { const i = L.findIndex(l => re.test(l)); return i < 0 ? 1e9 : i; }));
  const flightConf = legs.length ? ((M.num.filter(([i]) => i < legs[0].i).pop() || M.num.find(([i]) => i > legs[0].i && i < firstOther) || [])[1] || "") : "";
  legs.forEach((g, k) => {
    const next = legs[k + 1] ? legs[k + 1].i : L.length, win = L.slice(Math.max(k ? legs[k - 1].i + 1 : 0, g.i - 3), Math.min(next, g.i + 5)), w = win.join(" ");
    // AA 1234, B6 120 - the airline code has at least one letter
    const fn = w.match(/\bflight\b[^\n]{0,40}?\b([A-Z]{2}|[A-Z]\d|\d[A-Z])\s?(\d{1,4})\b/) || w.match(/\b([A-Z]{2}|[A-Z]\d|\d[A-Z])\s?(\d{2,4})\b/)
      || ((x => x ? [x[0], "Flight", x[1]] : null)(w.match(/\bflight\s*(?:#|number|no\.?)?\s*:?\s*(\d{1,4})\b/i))) || [];   // "Flight 1872" (no airline letters)
    const times = win.flatMap(timesIn), day = win.map(dateIn).find(Boolean) || "";
    const num = flightConf;
    out.push({ kind: "flight", a: g.A, b: g.B, day, t: times[0] || "", endT: times[1] || "", num: fn[1] ? `${fn[1] === "Flight" ? fn[1] : fn[1].toUpperCase()} ${fn[2]}` : "", note: num ? `Confirmation ${num}` : "" });
  });
  if (legs.length) { const c = markNear(M.money, legs[legs.length - 1].i); if (c) out[0].cost = c; }   // one total for the whole flight booking
  // HOTEL: a check-in date is the signal
  const ci = labeled(L, /check[- ]?in(?: date)?(?: time)?\s*:?\s*(.*)$/i), co = ci && labeled(L, /check[- ]?out(?: date)?(?: time)?\s*:?\s*(.*)$/i, ci.i);
  if (ci && ci.day) {
    const top = Math.max(0, ...legs.map(g => g.i + 1).filter(x => x <= ci.i)), sect = L.slice(top, ci.i + 12);
    const nameL = labeled(sect, /^(?:hotel|property|hotel name|resort|your stay at|staying at)\s*:?\s*(.*)$/i);
    const name = (nameL && nameL.raw && !dateIn(nameL.raw) ? nameL.raw
      : (sect.find(l => /\b(hotel|resort|inn|suites|lodge|motel|marriott|hilton|hyatt|holiday inn|hampton|sheraton|westin|disney's|embassy)\b/i.test(l) && l.length <= 60 && !/check|cancel|policy|thank|confirm/i.test(l)) || "")).replace(/^(?:hotel|property|resort)\s*:\s*/i, "");
    out.push({ kind: "hotel", a: name.slice(0, 60), b: ((sect.join("\n").match(ADDR_RE) || [])[0] || "").trim().slice(0, 90), day: ci.day, t: ci.t, endDay: co ? co.day : "", endT: co ? co.t : "",
      num: markNear(M.num, top, ci.i + 12), phone: markNear(M.phone, top, ci.i + 12), cost: markNear(M.money, ci.i) || null });
  }
  // RENTAL CAR: a pick-up date + a rental company (or the word rental)
  const coName = CAR_COS.find(c => new RegExp(`\\b${c}\\b`, "i").test(all));
  const pu = (coName || /\brental|rent a car|car hire\b/i.test(all)) && labeled(L, /^pick[- ]?up(?! location)(?: date| time| date & time| date and time)?\s*:?\s*(.*)$/i);
  if (pu && pu.day) {
    const dr = labeled(L, /^(?:drop[- ]?off|return)(?! location)(?: date| time| date & time| date and time)?\s*:?\s*(.*)$/i, pu.i + 1);
    const loc = labeled(L, /pick[- ]?up location\s*:?\s*(.*)$/i);
    const where = loc && loc.raw && !dateIn(loc.raw) ? loc.raw : (!dateIn(L[pu.i + 1] || "") ? L[pu.i + 1] || "" : "");
    out.push({ kind: "car", a: coName || "Rental car", b: where.slice(0, 80), day: pu.day, t: pu.t, endDay: dr ? dr.day : "", endT: dr ? dr.t : "",
      num: markNear(M.num, Math.max(0, pu.i - 6), pu.i + 12), phone: markNear(M.phone, pu.i, L.length, 8), cost: markNear(M.money, pu.i) || null });
  }
  return out;
}
let PASTE_FOUND = [];
function showPasteBooking() {
  const el = bkSheet();
  el.innerHTML = `<div class="sheet-body"><div class="grab"></div>
    <div class="sheet-head"><h2>📋 Paste a confirmation</h2><button class="icon-btn" data-bkclose="1" aria-label="Close">✕</button></div>
    <ol class="steps"><li>Open the flight, hotel or rental car confirmation email.</li><li>Press and hold → <b>Select all</b> → <b>Copy</b>.</li><li>Paste it below and tap <b>Read it</b>.</li></ol>
    <form class="qa-form" data-bkpaste="1"><textarea name="text" rows="7" placeholder="Paste the whole email here…" required></textarea><button class="btn">Read it</button></form>
    <p class="fine">Read on this phone — nothing is sent anywhere. You check each one before it's added.</p></div>`;
  el.classList.remove("hidden");
}
function showPasteFound() {
  const el = bkSheet();
  if (!PASTE_FOUND.length) { hideSheet("bookSheet"); return; }
  el.innerHTML = `<div class="sheet-body"><div class="grab"></div>
    <div class="sheet-head"><h2>📋 Found ${PASTE_FOUND.length}</h2><button class="icon-btn" data-bkclose="1" aria-label="Close">✕</button></div>
    ${PASTE_FOUND.map((d, i) => { const K = bookKind(d);
      return `<button class="rn-row" data-bkdraft="${i}"><span>${K.icon}</span><span class="grow">${esc(bookTitle(d))}<span class="sub">${esc(K.label)}${d.day ? ` · ${dayName(d.day)} ${prettyDate(d.day)}${d.t ? " " + hm(d.t) : ""}` : " · no date found"}</span></span><span class="chev">Check & add ›</span></button>`; }).join("")}
    <p class="fine" style="margin-top:8px">Tap each one to check it — anything left blank wasn't in the email.</p></div>`;
  el.classList.remove("hidden");
}
function pasteBookings(text) {
  PASTE_FOUND = extractBookings(text);
  if (!PASTE_FOUND.length) { toast("Couldn't find a flight, hotel or rental car in that — add it with the buttons instead"); return; }
  if (PASTE_FOUND.length === 1) showBookingForm(null, null, PASTE_FOUND[0]); else showPasteFound();
}

// ------------------------------------------------------------ TRIP DIARY (v1.01)
// HUB LIFE master list: Trip Hub = "... AI trip planning and memories"; Cruise Hub plan: "Cruise Diary". One
// diary for every travel hub. Each day of the trip keeps a mood, a few lines and the best moment
// (tr.diary["YYYY-MM-DD"] = { mood, text, best }), written from that day's screen. Plan → Diary reads the whole
// trip back and shares it as plain text. Only days that have happened can be written. Stays on this phone (and
// in the traveler's own backup, like the rest of the trip) - nothing is sent anywhere.
const DIARY_MOODS = [["😍", "Best day"], ["😀", "Great"], ["🙂", "Good"], ["😐", "Meh"], ["😩", "Rough"]];
const tripDiary = tr => (tr && tr.diary && typeof tr.diary === "object" && !Array.isArray(tr.diary) ? tr.diary : {});
const diaryHas = e => !!(e && (e.mood || e.text || e.best));
const diaryDays = tr => Object.keys(tripDiary(tr)).filter(d => diaryHas(tripDiary(tr)[d])).sort();
const tripLen = tr => { let n = 0; if (tr && tr.start) for (let d = tr.start; d <= (tr.end || tr.start) && n < 400; d = addDays(d, 1)) n++; return n; };
const diaryOwn = id => S.trips.find(t => t.id === id) || null;
// the "Our day" block on a day screen (shell.js showDay)
function diaryDayHtml(tr, d) {
  if (!tr || !tr.start || d < tr.start || d > (tr.end || tr.start)) return "";
  if (d > today()) return `<div class="day-label" style="margin-top:10px">📔 Our day</div><div class="today-line sub">Write about this day once it's happened.</div>`;
  const e = tripDiary(tr)[d] || {};
  return `<div class="day-label" style="margin-top:10px">📔 Our day</div>
    <div class="diary-moods" role="group" aria-label="How was the day?">${DIARY_MOODS.map(([m, l]) => `<button class="mood ${e.mood === m ? "on" : ""}" data-diarymood="${tr.id}|${d}|${m}" aria-label="${l}" title="${l}">${m}</button>`).join("")}</div>
    <form class="qa-form" data-diary="${tr.id}|${d}">
      <textarea name="text" rows="3" placeholder="What did we do? Who did we meet? What did we eat?">${esc(e.text || "")}</textarea>
      <input name="best" placeholder="Best moment of the day" value="${esc(e.best || "")}" autocomplete="off">
      <button class="btn sm">${diaryHas(e) ? "Save" : "Save to the diary"}</button></form>`;
}
function diarySet(id, d, patch) {
  const tr = diaryOwn(id); if (!tr) return null;
  snap(); tr.diary = { ...tripDiary(tr) };
  const e = { ...(tr.diary[d] || {}), ...patch };
  if (diaryHas(e)) tr.diary[d] = e; else delete tr.diary[d];
  save(); return tr;
}
const diaryDayNo = (tr, d) => tripLen({ start: tr.start, end: d });
// the whole trip, day by day, as text (Share / Copy)
function diaryText(tr) {
  const L = [`📔 ${tr.name}${tr.start ? ` — ${prettyDate(tr.start)}${tr.end && tr.end !== tr.start ? ` to ${prettyDate(tr.end)}` : ""}` : ""}`];
  diaryDays(tr).forEach(d => { const e = tripDiary(tr)[d];
    L.push("", `${e.mood ? e.mood + " " : ""}Day ${diaryDayNo(tr, d)} · ${dayName(d)} ${prettyDate(d)} — ${dayKind(tr, d).title}`);
    if (e.text) L.push(e.text);
    if (e.best) L.push(`⭐ Best moment: ${e.best}`); });
  return L.join("\n");
}
// Plan → Diary
function tripDiaryHtml() {
  const tr = curTrip(); if (!tr) return `<div class="empty">Plan a ${TW} first.</div>`;
  const head = `<h3>📔 ${trCruise(tr) ? "Cruise" : "Trip"} diary</h3>`;
  if (!tr.start) return `<section class="card">${head}<div class="body"><div class="today-line sub">Add your dates first — then each day gets a page.</div></div></section>`;
  const D = tripDiary(tr), days = diaryDays(tr), len = tripLen(tr), started = tr.start <= today(), fav = days.filter(d => D[d].mood === "😍").length;
  const rows = days.map(d => { const e = D[d], k = dayKind(tr, d);
    return `<button class="rn-row diary-row" data-tlday="${d}"><span class="tl-ic">${e.mood || k.icon}</span><span class="grow"><b>Day ${diaryDayNo(tr, d)} · ${esc(k.title)}</b>
      <span class="sub">${dayName(d)} ${prettyDate(d)}</span>${e.text ? `<span class="diary-text">${esc(e.text)}</span>` : ""}${e.best ? `<span class="sub">⭐ ${esc(e.best)}</span>` : ""}</span><span class="chev">›</span></button>`; });
  const todayOpen = started && today() <= (tr.end || tr.start) && !diaryHas(D[today()]);
  return `<section class="card">${head}<div class="body">
      <div class="today-line">${days.length} of ${len} day${len === 1 ? "" : "s"} written${fav ? ` · 😍 ${fav} best day${fav === 1 ? "" : "s"}` : ""}</div>
      ${todayOpen ? `<button class="add-link" data-tlday="${today()}">＋ Write about today</button>` : ""}
      ${rows.length ? rows.join("") : `<div class="today-line sub">${started ? "Tap a day in Trip and write a few lines — what you did, the best moment." : `Your diary opens ${prettyDate(tr.start)}. Each night, a few lines about the day — you'll be glad you did.`}</div>`}
      ${days.length || started ? `<div class="foot-actions" style="margin-top:10px">${days.length ? `<button class="btn sm" data-diaryshare="${tr.id}">📤 Share my diary</button>` : ""}
        ${started ? `<button class="btn sm ghost" data-wrapopen="1">🎞️ ${trCruise(tr) ? "Cruise" : "Trip"} wrap-up</button>` : ""}</div>` : ""}
      ${days.length ? `<p class="fine">Shares as text — send it to the family, or keep it in your notes.</p>` : ""}</div></section>`;
}
function diaryShare(id) {
  const tr = diaryOwn(id); if (!tr) return;
  const text = diaryText(tr);
  if (navigator.share) { navigator.share({ title: `${tr.name} diary`, text }).catch(() => {}); return; }
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(() => toast("📋 Diary copied — paste it anywhere"), () => toast("Couldn't copy on this phone"));
  else toast("Couldn't copy on this phone");
}
// Home "What's going on": the evening of a trip day with nothing written yet, and the week after with something to read
function diaryNudge(tr) {
  if (!tr || !tr.start) return null;
  const t = today(), end = tr.end || tr.start;
  if (t >= tr.start && t <= end && nowT() >= "17:00" && !diaryHas(tripDiary(tr)[t])) return { icon: "📔", text: "How was today? Add it to your diary", act: `data-tlday="${t}"` };
  const n = diaryDays(tr).length;
  if (t > end) return { icon: "🎞️", text: `Your ${trCruise(tr) ? "cruise" : "trip"} wrap-up${n ? ` — ${n} day${n === 1 ? "" : "s"} in the diary` : ""}`, act: 'data-wrapopen="1"' };   // v1.08
  return null;
}
function diaryClick(ds) {
  if (ds.diarymood) { const [id, d, m] = ds.diarymood.split("|"), e = tripDiary(diaryOwn(id))[d] || {};
    if (diarySet(id, d, { mood: e.mood === m ? "" : m })) { render(); showDay(d); }
    return true; }
  if (ds.diaryshare) { diaryShare(ds.diaryshare); return true; }
  if (wrapClick(ds)) return true;                                          // v1.08 wrap-up
  return false;
}
function diarySubmit(f, data) {
  if (!f.dataset.diary) return false;
  const [id, d] = f.dataset.diary.split("|");
  if (diarySet(id, d, { text: (data.text || "").trim(), best: (data.best || "").trim() })) { hideSheet("daySheet"); render(); buzz(); toast("📔 Saved to the diary", true); }
  else toast(`Open this ${TW} in the app it was planned in to write its diary`);
  return true;
}

// ------------------------------------------------------------ FUN FINDER (v1.04)
// Cruise Hub plan (10/4): "Cruise Hub should allow: ❤️ MUST SEE / 👍 Interested / — Skip. Then automatically
// build the day around ❤️ events" + "Have a backup for overlapping activities" + "Don't assume the same show
// repeats every night". The traveler adds what's on the ship's daily planner (or the trip's day) - title, time,
// end, where - and picks one of the three. RULES ONLY:
//   your day = every ❤️, then each 👍 that doesn't clash with anything already in it;
//   two ❤️ that overlap = a warning (pick one, or look for another showing);
//   a 👍 that clashes = kept as a backup;
//   on a port day, anything between "off the ship" and "head back by" = "you'll be ashore then".
// Your day's picks join the schedule (dayItems kind "fun"), NEXT and the timeline. tr.fun = [{ id, day, t, end, title, where, pick }].
const FUN_PICKS = [["must", "❤️", "Must see"], ["maybe", "👍", "Interested"], ["skip", "—", "Skip"]];
const FUN_LEN = 60;                                                          // no end time = about an hour
const tripFun = tr => (tr && Array.isArray(tr.fun) ? tr.fun : []);
const funEnd = f => f.end && f.end > f.t ? f.end : addMinT(f.t, FUN_LEN);
const funClash = (a, b) => a.t < funEnd(b) && b.t < funEnd(a);
function funPlan(tr, day) {
  const all = tripFun(tr).filter(f => f.day === day && f.t).sort((a, b) => a.t.localeCompare(b.t));
  const plan = [], clashes = [], backups = [];
  all.filter(f => f.pick === "must").forEach(f => { plan.filter(p => funClash(p, f)).forEach(p => clashes.push([p, f])); plan.push(f); });
  all.filter(f => f.pick === "maybe").forEach(f => { const hit = plan.find(p => funClash(p, f)); if (hit) backups.push([f, hit]); else plan.push(f); });
  plan.sort((a, b) => a.t.localeCompare(b.t));
  const pt = typeof portOn === "function" && trCruise(tr) ? portOn(tr, day) : null, R = pt && typeof portReality === "function" ? portReality(pt) : null;
  const ashore = R && R.mins > 0 ? plan.filter(f => f.t >= R.off && f.t < R.by) : [];
  return { all, plan, clashes, backups, ashore, R };
}
function funItems(tr, day) {
  return funPlan(tr, day).plan.map(f => ({ t: f.t, end: f.end || null, title: f.title, sub: [f.where, f.pick === "must" ? "❤️ must see" : "👍 interested"].filter(Boolean).join(" · "), kind: "fun", icon: f.pick === "must" ? "❤️" : "👍", trip: tr.id }));
}
const funBits = (tr, d) => { const n = funPlan(tr, d).plan.length; return n ? [`🎉 ${n} planned`] : []; };
// the "Fun Finder" block on a day screen (shell.js showDay)
function funDayHtml(tr, d) {
  if (!tr || !tr.start || d < tr.start || d > (tr.end || tr.start)) return "";
  const F = funPlan(tr, d), inPlan = new Set(F.plan.map(f => f.id)), back = new Map(F.backups.map(([f, hit]) => [f.id, hit]));
  const chip = (f, k, ic, l) => `<button class="funpick ${f.pick === k ? "on" : ""}" data-funpick="${tr.id}|${f.id}|${k}" aria-label="${l}" title="${l}">${ic}</button>`;
  const rows = F.all.concat(tripFun(tr).filter(f => f.day === d && !f.t)).map(f => {
    const note = f.pick === "skip" ? "skipped" : inPlan.has(f.id) ? "in your day" : back.has(f.id) ? `backup — clashes with ${back.get(f.id).title}` : "";
    return `<div class="row fun-row ${f.pick === "skip" ? "done" : ""}"><span class="time">${f.t ? hm(f.t) : ""}</span><span class="grow">${esc(f.title)}
      <span class="sub">${[f.end && `till ${hm(f.end)}`, f.where && esc(f.where), note].filter(Boolean).join(" · ")}</span></span>
      ${FUN_PICKS.map(([k, ic, l]) => chip(f, k, ic, l)).join("")}<button class="x" data-fundel="${tr.id}|${f.id}" aria-label="Remove">✕</button></div>`; });
  const warn = F.clashes.map(([a, b]) => `<div class="bstat tight">⚠️ ${esc(a.title)} and ${esc(b.title)} overlap — pick one, or look for a later showing (shows often run twice).</div>`)
    .concat(F.ashore.map(f => `<div class="bstat tight">🏝️ ${esc(f.title)} at ${hm(f.t)} falls while you're ashore (back by ${hm(F.R.by)}) — fine if it's in port; if it's on the ship, plan around it.</div>`));
  return `<div class="day-label" style="margin-top:10px">🎉 Fun Finder</div>
    ${warn.join("")}
    ${rows.length ? rows.join("") : `<div class="today-line sub">Add what's on ${trCruise(tr) ? "the ship's daily planner" : "the day"} — shows, trivia, dinner, the pool party — then tap ❤️ must see, 👍 interested or — skip. Your day builds itself around the ❤️.</div>`}
    <form class="qa-form fun-add" data-fun="${tr.id}|${d}">
      <input name="title" placeholder="${trCruise(tr) ? "Show, trivia, dinner…" : "Activity, tour, dinner…"}" required autocomplete="off">
      <div class="two"><label class="field" style="margin:0">Starts<input name="t" type="time" required></label><label class="field" style="margin:0">Ends (optional)<input name="end" type="time"></label></div>
      <div class="two"><input name="where" placeholder="Where (deck, venue)" autocomplete="off">
        <select name="pick" aria-label="Pick">${FUN_PICKS.map(([k, ic, l]) => `<option value="${k}">${ic} ${l}</option>`).join("")}</select></div>
      <button class="btn sm">＋ Add</button></form>`;
}
function funSave(id, fn) {
  const tr = S.trips.find(t => t.id === id); if (!tr) { toast(`Open this ${TW} in the app it was planned in to change it`); return false; }
  snap(); tr.fun = tripFun(tr).slice(); fn(tr); save(); return true;
}
function funClick(ds) {
  if (ds.funpick) { const [id, fid, k] = ds.funpick.split("|"); let day = "";
    if (funSave(id, tr => { const f = tr.fun.find(x => x.id === fid); if (f) { tr.fun = tr.fun.map(x => x.id === fid ? { ...x, pick: k } : x); day = f.day; } }) && day) { render(); showDay(day); }
    return true; }
  if (ds.fundel) { const [id, fid] = ds.fundel.split("|"); let day = "";
    if (funSave(id, tr => { const f = tr.fun.find(x => x.id === fid); if (f) day = f.day; tr.fun = tr.fun.filter(x => x.id !== fid); }) && day) { render(); showDay(day); toast("Removed", true); }
    return true; }
  return false;
}
function funSubmit(f, data) {
  if (!f.dataset.fun) return false;
  const [id, d] = f.dataset.fun.split("|"), title = (data.title || "").trim();
  if (!title || !data.t) return true;
  const pick = FUN_PICKS.some(p => p[0] === data.pick) ? data.pick : "must";
  if (funSave(id, tr => tr.fun.push({ id: uid(), day: d, t: data.t, end: data.end && data.end > data.t ? data.end : "", title, where: (data.where || "").trim(), pick }))) {
    render(); showDay(d); buzz(); toast(`${pick === "must" ? "❤️" : pick === "maybe" ? "👍" : "—"} Added`); }
  return true;
}

// ------------------------------------------------------------ WRAP-UP (v1.08)
// Scott 10/8 ("yes all 3" - #3 '"Our cruise" wrap-up: after the cruise, one page with the diary, spending, the
// bill...'; "use data once cruise purchased"). One page from what the trip already holds: the numbers (days,
// ports / sea days, diary days, best days), each day with its mood, lines, best moment and ❤️ picks, the bookings,
// and the money (trip cost, onboard / trip spending by kind, the final bill). Share as text, or Save as PDF
// (the phone's print → "Save as PDF" - only this page prints). Nothing new is stored; nothing is sent anywhere.
function wrapStats(tr) {
  const len = tripLen(tr), cruise = trCruise(tr), ports = cruise ? (tr.ports || []).filter(p => p.day >= tr.start && p.day <= (tr.end || tr.start)) : [];
  const D = tripDiary(tr), days = diaryDays(tr);
  const cats = {}; (tr.spends || []).forEach(x => { cats[x.cat] = (cats[x.cat] || 0) + Number(x.amt || 0); });
  const kinds = {}; tripBookings(tr).forEach(b => { kinds[b.kind] = (kinds[b.kind] || 0) + 1; });
  return { len, nights: tripNights(tr), cruise, ports, sea: cruise && typeof seaDays === "function" ? seaDays(tr) : 0, days, best: days.filter(d => D[d].mood === "😍").length,
    spent: tripSpent(tr), cats, total: tripWallet(tr).total, bill: tr.billSeen !== undefined && tr.billSeen !== null && tr.billSeen !== "" && isFinite(Number(tr.billSeen)) ? Number(tr.billSeen) : null, kinds };
}
const wrapMusts = (tr, d) => tripFun(tr).filter(f => f.day === d && f.pick === "must").sort((a, b) => (a.t || "").localeCompare(b.t || ""));
function wrapText(tr) {
  const W = wrapStats(tr), L = [diaryText(tr).split("\n")[0]];
  L.push([`${W.len} day${W.len === 1 ? "" : "s"}`, W.cruise && W.ports.length && `${W.ports.length} port${W.ports.length === 1 ? "" : "s"} (${W.ports.map(p => p.name).join(", ")})`, W.cruise && W.sea && `${W.sea} sea day${W.sea === 1 ? "" : "s"}`, W.best && `😍 ${W.best} best day${W.best === 1 ? "" : "s"}`].filter(Boolean).join(" · "));
  const best = W.days.map(d => tripDiary(tr)[d].best).filter(Boolean);
  if (best.length) { L.push("", "⭐ Best moments"); best.forEach(b => L.push(`• ${b}`)); }
  const body = diaryText(tr).split("\n").slice(1).join("\n").trim();
  if (body) L.push("", body);
  return L.join("\n");
}
function showWrap() {
  const tr = curTrip(); if (!tr) return;
  let el = document.getElementById("wrapSheet");
  if (!el) { el = document.createElement("div"); el.id = "wrapSheet"; el.className = "sheet"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "Wrap-up"); document.body.appendChild(el); }
  const W = wrapStats(tr), D = tripDiary(tr), word = W.cruise ? "cruise" : "trip";
  const stat = (v, l) => `<div class="wrap-stat"><b>${v}</b><span>${l}</span></div>`;
  const stats = [stat(W.len, W.len === 1 ? "day" : "days"), W.cruise ? stat(W.ports.length, W.ports.length === 1 ? "port" : "ports") : stat(tripBookings(tr).length, "bookings"),
    W.cruise ? stat(W.sea, W.sea === 1 ? "sea day" : "sea days") : stat(W.days.length, "diary days"), stat(W.best, "😍 best")];
  const dayRows = [];
  if (tr.start) for (let d = tr.start, n = 1; d <= (tr.end || tr.start) && n < 400; d = addDays(d, 1), n++) {
    const e = D[d] || {}, k = dayKind(tr, d), musts = wrapMusts(tr, d);
    if (!diaryHas(e) && !musts.length) continue;
    dayRows.push(`<div class="wrap-day"><div class="wrap-dh">${e.mood || k.icon} <b>Day ${n} · ${esc(k.title)}</b> <span class="sub" style="display:inline">${dayName(d)} ${prettyDate(d)}</span></div>
      ${e.text ? `<div class="diary-text">${esc(e.text)}</div>` : ""}${e.best ? `<div class="sub">⭐ ${esc(e.best)}</div>` : ""}
      ${musts.length ? `<div class="sub">❤️ ${musts.map(f => esc(f.title)).join(" · ")}</div>` : ""}</div>`); }
  const best = W.days.map(d => D[d].best).filter(Boolean);
  const money3 = [W.total > 0 && [`${W.cruise ? "Cruise" : "Trip"} cost (fare + extras)`, money(W.total)],
    W.spent > 0 && [W.cruise ? "Onboard spending you logged" : "Spending you logged", money(W.spent)],
    W.bill !== null && ["Final ship bill", money(W.bill)]].filter(Boolean);
  const BK = { flight: "✈️", hotel: "🏨", car: "🚗", train: "🚆", ticket: "🎟️", dinner: "🍽️" };
  el.innerHTML = `<div class="sheet-body wrap-body"><div class="grab no-print"></div>
    <div class="sheet-head"><h2>🎞️ ${esc(tr.name)}</h2><button class="icon-btn no-print" data-wrapclose="1" aria-label="Close">✕</button></div>
    <p class="fine" style="margin-top:0">${[tr.ship && esc(tr.ship), !W.cruise && tr.port && esc(placeName(tr.port)), tr.start && `${prettyDate(tr.start)}${tr.end && tr.end !== tr.start ? ` – ${prettyDate(tr.end)}` : ""}`, Number(tr.travelers) > 1 && `${tr.travelers} of you`].filter(Boolean).join(" · ")}</p>
    <div class="wrap-stats">${stats.join("")}</div>
    ${W.cruise && W.ports.length ? `<div class="today-line">⚓ ${W.ports.slice().sort((a, b) => a.day.localeCompare(b.day)).map(p => esc(p.name)).join(" → ")}</div>` : ""}
    ${Object.keys(W.kinds).length ? `<div class="today-line">${Object.entries(W.kinds).map(([k, c]) => `${BK[k] || "🎟️"} ${c}`).join(" · ")}</div>` : ""}
    ${best.length ? `<div class="day-label" style="margin-top:10px">⭐ Best moments</div>${best.map(b => `<div class="today-line">• ${esc(b)}</div>`).join("")}` : ""}
    <div class="day-label" style="margin-top:10px">Day by day</div>
    ${dayRows.length ? dayRows.join("") : `<div class="today-line sub">Nothing written yet — tap a day in Plan → Trip and add a few lines; they show up here.</div>`}
    ${money3.length || Object.keys(W.cats).length ? `<div class="day-label" style="margin-top:10px">💵 Money</div>
      ${money3.map(([l, v]) => `<div class="row"><span class="grow">${l}</span><b>${v}</b></div>`).join("")}
      ${Object.entries(W.cats).sort((a, b) => b[1] - a[1]).map(([c, v]) => `<div class="row"><span class="grow sub">${esc(c)}</span><span>${money(v)}</span></div>`).join("")}` : ""}
    <div class="foot-actions no-print" style="margin-top:12px;flex-wrap:wrap">
      <button class="btn sm" data-wrapshare="${tr.id}">📤 Share</button><button class="btn sm ghost" data-wrapprint="1">🖨️ Save as PDF</button></div>
    <p class="fine no-print">Save as PDF: in the print screen pick <b>Save as PDF</b> (iPhone: pinch out on the preview, then share). Made from your own ${word} — nothing is sent anywhere.</p></div>`;
  el.classList.remove("hidden");
}
function wrapClick(ds) {
  if (ds.wrapopen) { hideSheet("daySheet"); showWrap(); return true; }
  if (ds.wrapclose) { hideSheet("wrapSheet"); return true; }
  if (ds.wrapshare) { const tr = S.trips.find(t => t.id === ds.wrapshare); if (!tr) return true; const text = wrapText(tr);
    if (navigator.share) navigator.share({ title: `${tr.name} wrap-up`, text }).catch(() => {});
    else if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(() => toast("📋 Wrap-up copied — paste it anywhere"), () => toast("Couldn't copy on this phone"));
    else toast("Couldn't copy on this phone");
    return true; }
  if (ds.wrapprint) { document.body.classList.add("print-wrap");
    const done = () => { document.body.classList.remove("print-wrap"); window.removeEventListener("afterprint", done); };
    window.addEventListener("afterprint", done); window.print(); return true; }
  return false;
}

// ------------------------------------------------------------ FIX MY TRIP (v1.11)
// Scott's blueprint #53/#54: "Something changes: flight canceled ... Tap FIX MY TRIP. Trip Hub identifies
// everything downstream affected ... I found 3 changes ... REVIEW CHANGES. User approves." + "Trip Dependency
// Graph: FLIGHT -> RENTAL CAR -> HOTEL -> DINNER. Flight delayed 3 hours: rental pickup affected, hotel arrival
// changed, dinner impossible." + "Never silently changes bookings."
// Nothing is looked up online: the times are the ones the traveler saved. The app moves only ITS OWN plan, and
// only the rows the traveler leaves ticked; every booking that needs a call is listed with its phone number.
// Ready-after buffers: how long after a booking ENDS you can really be somewhere else.
const FIX_AFTER = { flight: 60, train: 30, car: 15, ticket: 30, dinner: 30, hotel: 0, fun: 0 };
const FIX_DELAYS = [[15, "15 min"], [30, "30 min"], [45, "45 min"], [60, "1 hour"], [90, "1½ hours"], [120, "2 hours"], [180, "3 hours"],
  [240, "4 hours"], [300, "5 hours"], [360, "6 hours"], [480, "8 hours"], [720, "12 hours"], [1440, "a whole day"]];
const fixAt = (day, t) => { const d = parseDay(day); const [h, m] = (t || "00:00").split(":").map(Number); d.setHours(h, m, 0, 0); return d.getTime(); };
const fixFrom = ms => { const d = new Date(ms); return { day: ymd(d), t: `${pad(d.getHours())}:${pad(d.getMinutes())}` }; };
const fixUp15 = ms => { const q = 15 * 60000; return Math.ceil(ms / q) * q; };
const fixWhen = ms => { const x = fixFrom(ms); return `${x.day === today() ? "" : dayName(x.day) + " "}${hm(x.t)}`; };
// The trip as timed points: each booking's start (and end), each Fun Finder pick in the day plan.
function fixPoints(tr) {
  const P = [];
  tripBookings(tr).forEach(b => {
    if (!b.day || !b.t) return;
    const ed = b.endDay || (b.endT ? b.day : ""), s = fixAt(b.day, b.t), e = ed && b.endT ? fixAt(ed, b.endT) : null;
    P.push({ src: "bk", id: b.id, kind: b.kind, title: bookTitle(b), icon: bookKind(b).icon, s, e: e && e > s ? e : null, phone: b.phone || "", num: b.num || "", ref: b });
  });
  [...new Set(tripFun(tr).map(f => f.day))].forEach(d => funPlan(tr, d).plan.forEach(f => P.push({ src: "fun", id: f.id, kind: "fun", title: f.title,
    icon: f.pick === "must" ? "❤️" : "👍", s: fixAt(f.day, f.t), e: fixAt(f.day, funEnd(f)), phone: "", num: "", ref: f })));
  return P.sort((a, b) => a.s - b.s);
}
// When you can be somewhere else after p. A car or hotel runs for days - you're free once you've picked it up / checked in.
const fixReady = p => (p.kind === "car" || p.kind === "hotel" ? p.s : p.e || p.s) + (FIX_AFTER[p.kind] ?? 0) * 60000;
// What a change does to the rest of the trip. change = { how: "late"|"time"|"cancel", mins, day, t }.
function fixImpact(tr, bkId, change) {
  const P = fixPoints(tr), me = P.find(p => p.src === "bk" && p.id === bkId); if (!me) return null;
  const rows = [], calls = [], K = bookKind(me.ref);
  const callFor = (p, why) => { if (p.src === "bk") calls.push({ id: p.id, icon: p.icon, title: p.title, phone: p.phone, num: p.num, why }); };
  if (change.how === "cancel") {
    rows.push({ act: "remove", src: "bk", id: me.id, icon: me.icon, title: me.title, say: "Take it off your trip", on: false });
    callFor(me, me.kind === "flight" ? "ask what they can rebook you on — don't buy a new ticket first" : "confirm it's canceled and ask about a refund");
    P.filter(p => p !== me && p.s >= me.s && p.s < me.s + 24 * 3600000).forEach(p => {
      rows.push({ act: "keep", src: p.src, id: p.id, icon: p.icon, title: p.title, say: `${fixWhen(p.s)} — check this still works once you know your new plan`, on: false });
      if (["car", "hotel", "flight", "train"].includes(p.kind)) callFor(p, p.kind === "hotel" ? "tell them your plans changed so they hold the room" : "tell them your plans changed");
    });
    return { me, rows, calls, change, delta: 0 };
  }
  const delta = change.how === "late" ? Number(change.mins) * 60000 : fixAt(change.day, change.t) - me.s;
  if (!delta) return { me, rows, calls, change, delta: 0 };
  rows.push({ act: "move", src: "bk", id: me.id, icon: me.icon, title: me.title, delta, whole: true,
    say: `${K.start} ${fixWhen(me.s + delta)}${me.e ? ` · ${K.end.toLowerCase()} ${fixWhen(me.e + delta)}` : ""}`, on: true });
  if (delta < 0) return { me, rows, calls, change, delta };              // earlier = nothing after it is squeezed
  // Walk forward: anything starting before you can be there is hit; each thing moved pushes the next one (a chain, not a pile-up).
  let ready = fixReady({ ...me, s: me.s + delta, e: me.e ? me.e + delta : null });
  for (const p of P) {
    if (p === me || p.s < me.s) continue;
    if (p.s >= ready) break;                                             // sorted: nothing later is squeezed
    const at = fixWhen(ready);
    if (p.kind === "hotel") {                                             // you don't move a check-in - you tell them you're late
      rows.push({ act: "keep", src: p.src, id: p.id, icon: p.icon, title: p.title, say: `You'll get there about ${at} — tell them you're arriving late so they hold the room`, on: false });
      callFor(p, `say you'll arrive about ${at}`); continue; }
    if (p.kind === "flight" || p.kind === "train") {                     // a connection: the carrier decides, not us
      rows.push({ act: "keep", src: p.src, id: p.id, icon: p.icon, title: p.title, say: `Leaves ${fixWhen(p.s)} — you can't be there till about ${at}. The ${p.kind === "flight" ? "airline" : "company"} rebooks a missed connection`, on: false });
      callFor(p, "you'll miss it — ask them to rebook you"); continue; }
    if (p.kind === "ticket") {                                            // a show or tour runs at its time
      rows.push({ act: "keep", src: p.src, id: p.id, icon: p.icon, title: p.title, say: `Starts ${fixWhen(p.s)} — you can't be there till about ${at}. Ask if there's a later time`, on: false });
      callFor(p, "ask about a later time or a refund"); continue; }
    const to = fixUp15(ready), d = to - p.s;
    rows.push({ act: "move", src: p.src, id: p.id, icon: p.icon, title: p.title, delta: d, say: `Was ${fixWhen(p.s)} — move to ${fixWhen(to)}`, on: true });
    if (p.kind === "car") callFor(p, `ask them to hold the car — you'll be there about ${fixWhen(to)}${me.kind === "flight" && me.ref.num ? ` (give them your flight, ${me.ref.num})` : ""}`);
    else if (p.kind === "dinner") callFor(p, `move your table to about ${fixWhen(to)}`);
    ready = Math.max(ready, fixReady({ ...p, s: to, e: p.e && p.kind !== "car" ? p.e + d : null }));
  }
  return { me, rows, calls, change, delta };
}
// Clashes already in the plan, no change needed: something starts before you can be there from the thing before it.
function fixClashes(tr) {
  const P = fixPoints(tr).filter(p => p.src === "bk" || p.ref.pick === "must"), out = [];
  for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) {
    const a = P[i], b = P[j];
    if (b.s >= fixReady(a) || a.kind === "hotel" || b.kind === "hotel") continue;   // a hotel stay spans days - not a clash
    if (a.src === "fun" && b.src === "fun") continue;                                // Fun Finder already warns about its own
    out.push([a, b]);
  }
  return out;
}

let FIX = null;                                                            // { trip, bk, impact, calls }
function fixSheet() {
  let el = document.getElementById("fixSheet");
  if (!el) { el = document.createElement("div"); el.id = "fixSheet"; el.className = "sheet"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "Fix my trip"); document.body.appendChild(el); }
  return el;
}
const fixCallsHtml = calls => calls.map(c => `<div class="row"><span class="grow"><b>${c.icon} ${esc(c.title)}</b><span class="sub">${esc(c.why)}${c.num ? ` · # ${esc(c.num)}` : ""}${c.phone ? ` · ${telLinks(c.phone)}` : " · no phone saved — it's on your confirmation"}</span></span></div>`).join("");
function showFix(view) {
  const t = FIX && S.trips.find(x => x.id === FIX.trip); if (!t) { toast(`Add your ${TW} first`); return; }
  const el = fixSheet(); let body = "";
  if (view === "pick") {
    const B = bookingsSorted(t).filter(b => b.day && b.t), C = fixClashes(t);
    body = (C.length ? `<div class="day-label">Already clashing</div>` + C.map(([a, b]) =>
        `<div class="bstat tight">⚠️ ${a.icon} ${esc(a.title)} → ${b.icon} ${esc(b.title)} at ${fixWhen(b.s)} — not enough time. You'd be ready about ${fixWhen(fixReady(a))}.</div>`).join("") : "")
      + `<div class="day-label">What changed?</div>`
      + (B.length ? B.map(b => `<button class="rn-row" data-fixb="${b.id}"><span>${bookKind(b).icon}</span><span class="grow">${esc(bookTitle(b))}<span class="sub">${esc(bookKind(b).label)} · ${dayName(b.day)} ${prettyDate(b.day)} · ${hm(b.t)}</span></span><span class="chev">›</span></button>`).join("")
        : `<p class="fine">Add your bookings with their times (Plan → Bookings) and ${esc(APP_NAME)} can show what a delay knocks out.</p>`);
  } else if (view === "what") {
    const b = tripBookings(t).find(x => x.id === FIX.bk); if (!b) { showFix("pick"); return; }
    const radio = (v, l, on) => `<label class="field" style="flex-direction:row;align-items:center;gap:8px;margin:6px 0"><input type="radio" name="how" value="${v}" ${on ? "checked" : ""} style="width:auto"> ${l}</label>`;
    body = `<div class="today-line">${bookKind(b).icon} <b>${esc(bookTitle(b))}</b> · ${dayName(b.day)} ${prettyDate(b.day)} · ${hm(b.t)}</div>
      <form class="qa-form" data-fixform="${b.id}">
        ${radio("late", "Running late / delayed", true)}
        <select name="mins" aria-label="How late">${FIX_DELAYS.map(([m, l]) => `<option value="${m}" ${m === 60 ? "selected" : ""}>${l}</option>`).join("")}</select>
        ${radio("time", "New time", false)}
        <div class="two"><input name="day" type="date" value="${esc(b.day)}" aria-label="New date"><input name="t" type="time" value="${esc(b.t)}" aria-label="New time"></div>
        ${radio("cancel", "Canceled", false)}
        <button class="btn">Show me what it changes</button></form>
      <button class="btn sm ghost" data-fixgo="pick" style="margin-top:8px">‹ Something else</button>`;
  } else if (view === "review") {
    const I = FIX.impact;
    if (!I || !I.rows.length) body = `<div class="today-line">✅ Nothing to change.</div><button class="btn sm ghost" data-fixgo="what">‹ Back</button>`;
    else { const hits = I.rows.length - 1;
      body = `<div class="today-line"><b>${I.change.how === "cancel" ? `${esc(I.me.title)} is canceled` : hits ? `I found ${hits} thing${hits === 1 ? "" : "s"} it knocks out` : "Nothing else is affected"}</b></div>
        <p class="fine">Tick what ${esc(APP_NAME)} should change in your plan. It only changes your plan here — call the companies below to change the real bookings.</p>`
        + I.rows.map((r, i) => `<label class="row fix-row"><input type="checkbox" data-fixtick="${i}" ${r.on ? "checked" : ""} ${r.act === "keep" ? "disabled" : ""} style="width:auto;margin-right:8px">
          <span class="grow">${r.icon} ${esc(r.title)}<span class="sub">${esc(r.say)}</span></span></label>`).join("")
        + (I.calls.length ? `<div class="day-label" style="margin-top:8px">📞 Call</div>` + fixCallsHtml(I.calls) : "")
        + `<div class="foot-actions" style="margin-top:10px"><button class="btn" data-fixapply="1">Change my plan</button><button class="btn sm ghost" data-fixgo="what">‹ Back</button></div>`; }
  } else {
    body = `<div class="today-line">✅ ${FIX.made ? "Your plan is updated." : "Nothing changed in your plan."}</div>${FIX.calls && FIX.calls.length ? `<div class="day-label">📞 Now call</div>${fixCallsHtml(FIX.calls)}` : ""}
      <p class="fine">Nothing was booked or canceled for you.${FIX.made ? " Tap Undo on the note at the bottom to put your plan back." : ""}</p>
      <div class="foot-actions"><button class="btn sm ghost" data-fixgo="pick">Check again</button><button class="btn sm" data-fixclose="1">Close</button></div>`;
  }
  el.innerHTML = `<div class="sheet-body"><div class="grab"></div>
    <div class="sheet-head"><h2>🔄 Fix my trip</h2><button class="icon-btn" data-fixclose="1" aria-label="Close">✕</button></div>${body}</div>`;
  el.classList.remove("hidden");
}
function fixApply() {
  const tr = S.trips.find(t => t.id === FIX.trip), I = FIX.impact; if (!tr || !I) return;
  const ticks = [...document.querySelectorAll("#fixSheet [data-fixtick]")].map(x => x.checked);
  const todo = I.rows.filter((r, i) => ticks[i] && r.act !== "keep");
  FIX.calls = I.calls; FIX.made = todo.length;
  if (!todo.length) { showFix("done"); return; }
  snap(); tr.bookings = tripBookings(tr).map(b => ({ ...b })); tr.fun = tripFun(tr).map(f => ({ ...f }));
  todo.forEach(r => {
    if (r.src === "bk") {
      if (r.act === "remove") { tr.bookings = tr.bookings.filter(b => b.id !== r.id); tr.costs = (tr.costs || []).filter(c => c.bk !== r.id); return; }
      const b = tr.bookings.find(x => x.id === r.id); if (!b) return;
      const ed = b.endDay || (b.endT ? b.day : ""), s = fixFrom(fixAt(b.day, b.t) + r.delta);
      if (ed && b.endT && (r.whole || ed === b.day)) {                       // what changed moves whole; a pick-up moves, its drop-off stays
        const e = fixFrom(fixAt(ed, b.endT) + r.delta); b.endDay = b.endDay || e.day !== s.day ? e.day : ""; b.endT = e.t; }
      b.day = s.day; b.t = s.t;
    } else {
      const f = tr.fun.find(x => x.id === r.id); if (!f) return;
      const s = fixFrom(fixAt(f.day, f.t) + r.delta); if (f.end) f.end = fixFrom(fixAt(f.day, f.end) + r.delta).t;
      f.day = s.day; f.t = s.t; if (f.end && f.end <= f.t) f.end = "";
    }
  });
  save(); render(); buzz(); toast(`🔄 ${todo.length} change${todo.length === 1 ? "" : "s"} made`, true); showFix("done");
}
function fixClick(ds) {
  if (ds.fixopen) { const [tr] = ds.fixopen === "pick" ? [curTrip()] : bkFind(ds.fixopen);
    if (!tr) { toast(`Add your ${TW} first`); return true; }
    hideSheet("helpSheet"); hideSheet("bookSheet"); FIX = { trip: tr.id, bk: ds.fixopen === "pick" ? null : ds.fixopen };
    showFix(FIX.bk ? "what" : "pick"); return true; }
  if (!FIX) return false;
  if (ds.fixb) { FIX.bk = ds.fixb; showFix("what"); return true; }
  if (ds.fixgo) { showFix(ds.fixgo); return true; }
  if (ds.fixapply) { fixApply(); return true; }
  if (ds.fixclose) { hideSheet("fixSheet"); return true; }
  return false;
}
function fixSubmit(f, data) {
  if (!f.dataset.fixform || !FIX) return false;
  const tr = S.trips.find(t => t.id === FIX.trip); if (!tr) return true;
  const how = ["late", "time", "cancel"].includes(data.how) ? data.how : "late";
  if (how === "time" && (!data.day || !data.t)) { toast("Pick the new date and time"); return true; }
  FIX.impact = fixImpact(tr, f.dataset.fixform, { how, mins: Number(data.mins) || 60, day: data.day, t: data.t });
  showFix("review"); return true;
}
