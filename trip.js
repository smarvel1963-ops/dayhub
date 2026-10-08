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
