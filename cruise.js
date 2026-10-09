/* SAVE AS: cruise.js · LOCATION: C:/MarvelApps/dayhub/cruise.js
 * CRUISE HUB pieces that live in their own file (app.js is near the 3,000-line
 * monolith rule). Loaded after scenes.js, before ui.js, by both hubs' pages.
 *
 * v0.56 (V1 step 5, Scott's plan: FINAL NIGHT / SAFE CHECK / DISEMBARKATION /
 * REMEMBER MY CAR): the last evening the hero becomes FINAL NIGHT (ship account,
 * unused benefits, final-night bag, the cabin safe, the car) with GET ME HOME
 * READY; disembark morning it becomes TIME TO GO HOME with where the car is.
 * Rules only - nothing here guesses a time or a place; it shows what the
 * traveler saved.
 */
"use strict";
// Close a sheet if it is open (safe when it was never opened).
const hideSheet = id => { const el = document.getElementById(id); if (el) el.classList.add("hidden"); };

// "final" = the evening before the trip ends (from 2 PM); "leave" = the last morning (until 2 PM).
function goHomeState(tr, now = new Date()) {
  if (!tr || !tr.end || !isCruise(tr) || tr.homeDone === tr.end) return null;
  const h = now.getHours();
  if (daysUntil(tr.end) === 1 && h >= 14) return "final";
  if (daysUntil(tr.end) === 0 && h < 14) return "leave";
  return null;
}
const carText = c => c ? [c.where, c.level && `Level ${c.level}`, c.spot && `Row/space ${c.spot}`].filter(Boolean).join(" · ") : "";
function goHomeItems(tr) {
  ensureLists(tr);
  const F = tr.lists.final || [], fDone = F.filter(i => i.done).length, unused = perksLeft(tr).length;
  return [
    { key: "account", ok: !!tr.accountVerified, label: "Ship account checked — charges match", tap: "toggle" },
    { key: "benefits", ok: unused === 0, label: unused ? `${unused} benefit${unused === 1 ? "" : "s"} not used yet` : "Benefits used", tap: "perks" },
    { key: "bag", ok: F.length > 0 && fDone === F.length, label: `Final-night bag ${fDone}/${F.length}`, tap: "final" },
    { key: "safe", ok: !!tr.safeEmpty, label: tr.safeEmpty ? "Cabin safe is EMPTY" : "Cabin safe not checked yet", tap: "toggle" },
    { key: "car", ok: !!tr.car, label: tr.car ? `Car: ${carText(tr.car)}` : "Where you parked — not saved", tap: "car" },
  ];
}
// The hero block on the final evening / last morning.
function goHomeHtml(tr, st) {
  const items = goHomeItems(tr), left = items.filter(i => !i.ok).length;
  const head = st === "final" ? "🌙 FINAL NIGHT" : "🏠 TIME TO GO HOME";
  const line = st === "final" ? "Let's get you home without forgetting anything." : tr.car ? `🚗 ${esc(carText(tr.car))}` : "Passport, meds, phone, car keys — with you.";
  return `<button class="rg gohome ${left ? "rg-plan" : "rg-good"}" data-gohome="open" aria-label="${head}. ${left} things left.">
    <span class="rg-top">${head} · ${esc(tr.ship || tr.name)}</span>
    <span class="rg-line">${line}</span>
    <span class="gh-list">${items.map(i => `<span>${i.ok ? "✅" : "⬜"} ${esc(i.label)}</span>`).join("")}</span>
    <span class="rg-pill">${left ? `GET ME HOME READY · ${left} left` : "✅ GO HOME READY"}</span></button>`;
}
function showGoHome() {
  const tr = curTrip(); if (!tr) return;
  let el = document.getElementById("ghSheet");
  if (!el) { el = document.createElement("div"); el.id = "ghSheet"; el.className = "sheet"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "Get me home"); document.body.appendChild(el); }
  const items = goHomeItems(tr), c = tr.car || {};
  el.innerHTML = `<div class="sheet-body"><div class="grab"></div>
    <div class="sheet-head"><h2>🏠 Get me home ready</h2><button class="icon-btn" data-ghclose="1" aria-label="Close">✕</button></div>
    ${items.map(i => i.tap === "toggle"
      ? `<label class="row"><input type="checkbox" class="tick" data-ghtoggle="${i.key}" ${i.ok ? "checked" : ""}><span class="grow">${esc(i.key === "safe" ? "My cabin safe is EMPTY (passport, cash, jewelry, car keys out)" : i.label)}</span></label>`
      : i.tap === "car" ? ""
      : `<div class="row"><span class="grow">${i.ok ? "✅" : "⬜"} ${esc(i.label)}</span><button class="btn sm ghost" data-ghgo="${i.tap}">Open</button></div>`).join("")}
    <button class="add-link" data-billcheck="1">🧾 Check my final bill against Cruise Hub's count</button>
    <h3 style="margin-top:12px">🚗 Remember my car</h3>
    <form class="inline-add car-form" data-car="${tr.id}">
      <input name="where" placeholder="Garage / lot (e.g. Port garage B)" value="${esc(c.where || "")}" autocomplete="off">
      <input name="level" placeholder="Level" value="${esc(c.level || "")}" autocomplete="off">
      <input name="spot" placeholder="Row / space" value="${esc(c.spot || "")}" autocomplete="off">
      <button class="btn sm">Save</button></form>
    <p class="fine">Saved on this phone only. Tip: take a photo of the sign by your car too.</p>
    ${goHomeState(tr) === "leave" ? `<button class="btn" data-ghdone="1" style="width:100%;margin-top:8px">🏁 We're off the ship</button>` : ""}</div>`;
  el.classList.remove("hidden");
}
// Hero chip from sail day on: where the car is (or a nudge to save it).
function carChip(tr) {
  if (!tr || !isCruise(tr) || !tr.start || daysUntil(tr.start) > 0 || daysUntil(tr.end || tr.start) < 0) return "";
  return `<button class="chip" data-gohome="open">🚗 ${tr.car ? esc(carText(tr.car)) : "Remember where you parked"}</button>`;
}
// Extra reminders (called from reminderList): the safe + bag check on the final evening.
function cruiseReminders(add, inWin) {
  myTrips().filter(tr => isCruise(tr) && tr.end).forEach(tr => {
    const d = addDays(tr.end, -1);
    if (inWin(d) && !tr.safeEmpty && tr.homeDone !== tr.end)
      add(`gh:${tr.id}:safe`, atMs(d, "23:59"), atMs(d, "20:00"), "🔐 Final night — check your cabin safe",
        "Passport, cash, jewelry and car keys out of the safe. Keep them out of the bag you put outside.");
  });
}
// Click / submit handlers (called from ui.js's listeners; return true when handled).
function cruiseClick(ds) {
  if (typeof tripClick === "function" && tripClick(ds)) return true;      // v0.98 bookings (trip.js)
  if (helpClick(ds)) return true;                                          // v0.57 crisis mode
  if (onboardClick(ds)) return true;                                        // v0.60 onboarding
  if (phaseClick(ds)) return true;                                          // v0.61 on board
  if (billClick(ds)) return true;                                           // v1.03 final bill check
  if (ds.gohome) { showGoHome(); return true; }
  if (ds.ghclose) { hideSheet("ghSheet"); return true; }
  if (ds.ghgo) { const tr = curTrip(); hideSheet("ghSheet");
    if (ds.ghgo === "perks") S.tripTab = "perks"; else { S.tripTab = "lists"; S.tripList = "final"; }
    S.hidden = S.hidden.filter(x => x !== "trips"); S.collapsed = S.collapsed.filter(x => x !== "trips"); save(); render();
    const el = document.querySelector('[data-card="trips"]'); if (el && tr) el.scrollIntoView({ behavior: "smooth", block: "start" }); return true; }
  if (ds.ghdone) { const tr = curTrip(); if (tr) { snap(); tr.homeDone = tr.end; save(); }
    hideSheet("ghSheet"); render(); toast("Welcome home 🏠", true); return true; }
  return false;
}
function cruiseChange(ds, t) {
  if (phaseChange(ds, t)) return true;                                      // v0.61 first things
  if (billChange(ds, t)) return true;                                       // v1.03 final bill check
  if (!ds.ghtoggle) return false;
  const tr = curTrip(); if (!tr) return true;
  if (ds.ghtoggle === "safe") tr.safeEmpty = t.checked; else if (ds.ghtoggle === "account") tr.accountVerified = t.checked;
  save(); setTimeout(() => { render(); showGoHome(); }, 0); return true;
}
function cruiseSubmit(f, data) {
  if (typeof tripSubmit === "function" && tripSubmit(f, data)) return true;   // v0.98 bookings (trip.js)
  if (helpSubmit(f, data)) return true;                                     // v0.57 crisis mode
  if (onboardSubmit(f, data)) return true;                                  // v0.60 paste my confirmation
  if (billSubmit(f, data)) return true;                                     // v1.03 final bill check
  if (!f.dataset.car) return false;
  const tr = S.trips.find(x => x.id === f.dataset.car); if (!tr) return true;
  const c = { where: String(data.where || "").trim(), level: String(data.level || "").trim(), spot: String(data.spot || "").trim() };
  tr.car = c.where || c.level || c.spot ? { ...c, savedAt: new Date().toISOString() } : null;
  save(); render(); showGoHome(); toast(tr.car ? "🚗 Car spot saved" : "Car spot cleared"); return true;
}

// ------------------------------------------------------------ crisis mode
// v0.57 (V1 step 6, Scott's plan: "CRISIS MODE - only five big choices: GET TO SHIP, BACK TO SHIP,
// MEDICAL/SAFETY, TRAVEL PROBLEM, MY DOCUMENTS. No ads, no recommendations, no clutter."). Everything
// shown comes from what the traveler saved on the trip (tr.help + the port's agent phone) - Cruise Hub
// never invents a phone number. Phone numbers are tap-to-call.
const HELP_FIELDS = [["line", "Cruise line / airline phone"], ["agent", "Travel agent (name + phone)"], ["ins", "Travel insurance (company + phone)"],
  ["policy", "Insurance policy #"], ["contact", "Emergency contact at home (name + phone)"]];
const telLinks = s => esc(s || "").replace(/(\+?\d[\d\s().-]{6,}\d)/g, m => `<a href="tel:${m.replace(/[^\d+]/g, "")}">${m}</a>`);
const helpVal = (tr, k) => ((tr.help || {})[k] || "").trim();
const mapsLink = q => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
let HELP_VIEW = null;
function showHelp(view) {
  const tr = curTrip(); HELP_VIEW = view || null;
  const cr = !tr || isCruise(tr), carrier = cr ? "Cruise line" : "Airline / hotel";   // v0.97: a regular trip has no ship
  let el = document.getElementById("helpSheet");
  if (!el) { el = document.createElement("div"); el.id = "helpSheet"; el.className = "sheet help"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "Need help"); document.body.appendChild(el); }
  const pt = tr && portOn(tr, today()), line = (k, label) => helpVal(tr || {}, k) ? `<div class="row"><span class="grow"><b>${label}</b><span class="sub">${telLinks(helpVal(tr, k))}</span></span></div>` : "";
  const missing = tr ? HELP_FIELDS.filter(([k]) => !helpVal(tr, k) && k !== "policy").length : 0;
  let body;
  if (!view) body = `<div class="help-grid">
      ${cr ? `<button class="help-btn" data-help="back">🚢<b>BACK TO SHIP</b></button>
      <button class="help-btn" data-help="get">🚗<b>GET TO THE SHIP</b></button>` : ""}
      <button class="help-btn red" data-help="medical">🩺<b>MEDICAL / SAFETY</b></button>
      <button class="help-btn" data-help="travel">✈️<b>TRAVEL PROBLEM</b></button>
      <button class="help-btn" data-help="docs">📄<b>MY DOCUMENTS</b></button>
      <button class="help-btn ghost" data-help="contacts">📇<b>MY TRIP CONTACTS</b>${missing ? `<span class="sub">${missing} not saved</span>` : ""}</button></div>`;
  else if (view === "back") { const g = tr && guardFor(tr);
    body = (pt ? `<div class="today-line">⚓ <b>${esc(pt.name)}</b>${pt.allAboard ? ` · all aboard <b>${hm(aaLocal(pt))}</b>${Number(pt.shipOffset) ? ` (${hm(pt.allAboard)} ship time)` : ""}` : ""}</div>
        ${g ? `<div class="rg-pill big rg-${g.level}">${GUARD_LABEL[g.level]}</div>` : ""}
        <a class="btn" style="width:100%" href="${mapsLink(`${placeName(pt.name)} cruise port`)}" target="_blank" rel="noopener">🗺️ Directions to the cruise port</a>
        ${pt.agent ? `<div class="row"><span class="grow"><b>Port agent</b><span class="sub">${telLinks(pt.agent)}</span></span></div>` : `<p class="fine">No port agent number saved for ${esc(pt.name)} — it's in the ship's daily planner. Add it in 🗺️ Ports ✏️.</p>`}`
      : `<p class="fine">No port day today.</p>`) + line("line", "Cruise line") + `<p class="fine">If you won't make all aboard: call the port agent / cruise line NOW. The ship will not wait.</p>`; }
  else if (view === "get") body = tr ? `<div class="today-line">🚢 <b>${esc(tr.ship || tr.name)}</b>${tr.start ? ` · sails ${prettyDate(tr.start)}` : ""}</div>
      ${tr.port ? `<a class="btn" style="width:100%" href="${mapsLink(`${placeName(tr.port)} cruise terminal`)}" target="_blank" rel="noopener">🗺️ Directions to ${esc(placeName(tr.port))} cruise terminal</a>` : `<p class="fine">Add the departure port (Edit trip) to get directions.</p>`}
      ${tr.booking ? `<div class="row"><span class="grow"><b>Booking #</b><span class="sub">${esc(tr.booking)}</span></span></div>` : ""}
      ${line("line", "Cruise line")}${line("agent", "Travel agent")}
      <p class="fine">Running late? Call the cruise line first. Don't book anything else until they tell you what's possible.</p>
      ${tr.start && daysUntil(tr.start) === 0 && !tr.aboard ? `<button class="btn" data-aboard="1" style="width:100%;margin-top:8px">✅ We're on board</button>` : ""}` : `<p class="fine">Plan a cruise first.</p>`;
  else if (view === "medical") body = `${cr ? `<div class="today-line"><b>On the ship:</b> use your cabin phone to call the ship's medical center or emergency number (it's printed on or by the phone).</div>` : ""}
      ${!cr ? `<div class="today-line"><b>Where you are:</b> call the local emergency number, or ask your hotel front desk for help.</div>` : ""}${cr ? `<div class="today-line"><b>Ashore:</b> ${pt && pt.emergency ? `local emergency number ${telLinks(pt.emergency)}` : "ask port staff or the ship's port agent for local emergency help"}${pt && pt.agent ? ` · port agent ${telLinks(pt.agent)}` : ""}.</div>` : ""}
      <div class="today-line"><b>In the US:</b> <a href="tel:911">911</a></div>` + (tr ? line("ins", "Travel insurance") + line("policy", "Policy #") + line("contact", "Emergency contact") : "");
  else if (view === "travel") body = (tr ? line("line", carrier) + line("agent", "Travel agent") + line("ins", "Travel insurance") + line("policy", "Policy #") +
      (tr.booking ? `<div class="row"><span class="grow"><b>Booking #</b><span class="sub">${esc(tr.booking)}</span></span></div>` : "") : "") +
      `<ol class="steps"><li>Call ${cr ? "the cruise line" : "the airline, hotel or rental company"} (or your travel agent) first.</li><li>Don't cancel or book anything until they tell you what's possible.</li>
       <li>Keep every receipt and screenshot — insurance claims need them.</li><li>Write down times: when it happened, who you spoke to.</li></ol>`;
  else if (view === "docs") { ensureLists(tr || { lists: {} }); const D = tr ? (tr.lists.docs || []) : [];
    body = (tr && tr.booking ? `<div class="row"><span class="grow"><b>Booking #</b><span class="sub">${esc(tr.booking)}</span></span></div>` : "") +
      (D.length ? D.map(i => `<div class="today-line">${i.done ? "✅" : "⬜"} ${esc(i.text)}</div>`).join("") : `<p class="fine">No documents list yet.</p>`) +
      `<p class="fine">Keep a photo of your passport / ID in your phone's photos and a paper copy apart from it.</p>`; }
  else body = tr ? `<form class="help-form" data-helpform="${tr.id}">${HELP_FIELDS.map(([k, l]) => `<label class="field">${l}<input name="${k}" value="${esc(helpVal(tr, k))}" autocomplete="off"></label>`).join("")}
      <button class="btn" style="width:100%;margin-top:8px">Save contacts</button></form><p class="fine">Saved on this phone only (and in your backup if it's on).</p>` : `<p class="fine">Plan a cruise first.</p>`;
  const titles = { back: "🚢 Back to ship", get: "🚗 Get to the ship", medical: "🩺 Medical / safety", travel: "✈️ Travel problem", docs: "📄 My documents", contacts: "📇 My trip contacts" };
  el.innerHTML = `<div class="sheet-body"><div class="grab"></div>
    <div class="sheet-head"><h2>${view ? titles[view] : "🛟 Need help?"}</h2><button class="icon-btn" data-helpclose="1" aria-label="Close">✕</button></div>
    ${view ? `<button class="btn sm ghost" data-help="home" style="margin-bottom:8px">‹ All help</button>` : ""}${body}</div>`;
  el.classList.remove("hidden");
}
function helpClick(ds) {
  if (ds.help) { showHelp(ds.help === "home" ? null : ds.help); return true; }
  if (ds.helpclose) { hideSheet("helpSheet"); return true; }
  if (ds.aboard) { const tr = curTrip(); if (tr) { tr.aboard = true; save(); } const hs = document.getElementById("helpSheet"); if (hs) hs.classList.add("hidden");
    render(); toast("Welcome aboard! 🚢🥂", true); return true; }
  return false;
}
function helpSubmit(f, data) {
  if (!f.dataset.helpform) return false;
  const tr = S.trips.find(x => x.id === f.dataset.helpform); if (!tr) return true;
  tr.help = {}; HELP_FIELDS.forEach(([k]) => { const v = String(data[k] || "").trim(); if (v) tr.help[k] = v; });
  save(); showHelp(null); toast("📇 Trip contacts saved"); return true;
}

// ------------------------------------------------------------ onboarding
// v0.60 (V1 step 9, Scott's blueprint: "ADD MY CRUISE - scan confirmation / enter manually", "THE MAGIC
// MOMENT - YOU'RE GOING! ... Cruise Hub is building your trip ... YOUR CRUISE IS READY - we found 4 things
// we still need from you", "QUICK PREFERENCES - big visual tiles, your top 3", "Who's traveling with you?").
const LOVES = [["beaches", "🏖️ Beaches"], ["food", "🍽️ Food"], ["comedy", "😂 Comedy"], ["shows", "🎭 Shows"], ["casino", "🎰 Casino"],
  ["spa", "💆 Spa"], ["shopping", "🛍️ Shopping"], ["nightlife", "🍹 Nightlife"], ["excursions", "🏝️ Excursions"], ["relaxing", "😌 Relaxing"],
  ["photos", "📸 Photography"], ["romance", "❤️ Romance"]];
const WITH = [["solo", "Just me"], ["partner", "Partner"], ["family", "Family"], ["friends", "Friends"], ["group", "Group"]];
let PREF_DRAFT = null;
// HOME with no cruise yet: the three ways in.
function addCruiseHtml() {
  return `<section class="card add-cruise"><h3>🚢 Add my cruise</h3><div class="body">
      <button class="rn-row" data-qa="trip"><span>✍️</span><span class="grow">Enter my cruise<span class="sub">Ship, dates, port — 30 seconds</span></span><span class="chev">›</span></button>
      <button class="rn-row" data-pasteopen="1"><span>📋</span><span class="grow">Paste my confirmation email<span class="sub">Cruise Hub reads the ship, dates, booking, cabin and ports</span></span><span class="chev">›</span></button>
      ${gmailAllowed() ? `<button class="rn-row" data-mail="scan"><span>📬</span><span class="grow">Find it in my email<span class="sub">Read-only, on this phone</span></span><span class="chev">›</span></button>` : ""}
    </div></section>`;
}
function showPaste() {
  let el = document.getElementById("pasteSheet");
  if (!el) { el = document.createElement("div"); el.id = "pasteSheet"; el.className = "sheet"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "Paste confirmation"); document.body.appendChild(el); }
  el.innerHTML = `<div class="sheet-body"><div class="grab"></div>
    <div class="sheet-head"><h2>📋 Paste my confirmation</h2><button class="icon-btn" data-pasteclose="1" aria-label="Close">✕</button></div>
    <ol class="steps"><li>Open your cruise confirmation email.</li><li>Press and hold → <b>Select all</b> → <b>Copy</b>.</li><li>Paste it below and tap <b>Read it</b>.</li></ol>
    <form class="qa-form" data-pastecruise="1"><textarea name="text" rows="7" placeholder="Paste the whole email here…" required></textarea><button class="btn">Read it</button></form>
    <p class="fine">Stays on this phone. Cruise Hub fills in only what's blank — it never overwrites what you typed.</p></div>`;
  el.classList.remove("hidden");
}
function pasteCruise(text) {
  const r = extractCruise({ subject: String(text).slice(0, 4000), from: "" }, String(text));
  if (!r) { toast("Couldn't find a cruise in that — check it's the confirmation email"); return false; }
  r.key = "paste-" + uid(); S.mail.found.push(r);
  const before = S.trips.length; addFound(r.key);
  if (S.trips.length > before) cruiseAdded(S.trips[S.trips.length - 1]);
  return true;
}
// Called when a NEW cruise is added (by hand or from an email): the magic moment, once per phone.
function cruiseAdded(tr) {
  if (!TRAVEL || !tr || !isCruise(tr) || S.magicSeen || typeof TAB === "undefined" || TAB !== "home") return;
  S.magicSeen = true; save(); showMagic(tr);
}
function showMagic(tr) {
  let el = document.getElementById("magicSheet");
  if (!el) { el = document.createElement("div"); el.id = "magicSheet"; el.className = "magic"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "You're going"); document.body.appendChild(el); }
  const sd = tr.start ? daysUntil(tr.start) : null, open = readiness(tr).items.filter(i => i.score < 1).length;
  const steps = ["Countdown", "Packing list", "Documents", "Port weather", "Return Guard", "Final-night bag"];
  el.innerHTML = `<div class="magic-in">
    <div class="magic-k">YOU'RE GOING!</div>
    <div class="magic-ship">🚢 ${esc(tr.ship || tr.name)}</div>
    <div class="magic-sub">${[tr.line, tr.start && `${prettyDate(tr.start)}${tr.end ? ` – ${prettyDate(tr.end)}` : ""}`, tripNights(tr) && `${tripNights(tr)} nights`, tr.port && placeName(tr.port)].filter(Boolean).map(esc).join(" · ")}</div>
    ${sd !== null && sd > 0 ? `<div class="magic-n">${sd}</div><div class="magic-sub">DAYS TO GO</div>` : ""}
    <div class="magic-build">Cruise Hub is building your trip…${steps.map((s, i) => `<span style="animation-delay:${0.35 + i * 0.3}s">✓ ${s}</span>`).join("")}</div>
    <div class="magic-done" style="animation-delay:${0.45 + steps.length * 0.3}s"><b>YOUR CRUISE IS READY</b>${open ? `<span>We found ${open} thing${open === 1 ? "" : "s"} we still need from you.</span>` : ""}
      <button class="big-btn" data-magicclose="1">Let's see</button></div></div>`;
  el.classList.remove("hidden");
}
// "Make it yours" on HOME after the first cruise, until saved or skipped (Scott: don't demand 30 preferences up front).
function prefsCardHtml() {
  if (!TRAVEL || S.prefs || !curTrip() || !isCruise(curTrip())) return "";   // v0.97: the cruise loves list - cruises only
  const D = PREF_DRAFT || (PREF_DRAFT = { with: "", loves: [] });
  return `<section class="card prefs-card"><h3>❤️ Make it yours <span class="meta">optional</span></h3><div class="body">
      <div class="day-label">Who's going?</div><div class="chips">${WITH.map(([k, l]) => `<button class="chip ${D.with === k ? "good" : ""}" data-prefwith="${k}">${l}</button>`).join("")}</div>
      <div class="day-label" style="margin-top:10px">What makes a great cruise for you? <span class="sub" style="display:inline">pick your top 3</span></div>
      <div class="love-grid">${LOVES.map(([k, l]) => `<button class="love ${D.loves.includes(k) ? "on" : ""}" data-preflove="${k}">${l}${D.loves.indexOf(k) >= 0 && D.loves.indexOf(k) < 3 ? `<i>${D.loves.indexOf(k) + 1}</i>` : ""}</button>`).join("")}</div>
      <div class="foot-actions" style="margin-top:10px"><button class="btn sm" data-prefsave="1">Save</button><button class="btn sm ghost" data-prefskip="1">Not now</button></div>
      <p class="fine">Ask ${APP_NAME} uses this to suggest what fits you. Change it any time in ⚙.</p></div></section>`;
}
function onboardClick(ds) {
  if (ds.pasteopen) { showPaste(); return true; }
  if (ds.pasteclose) { hideSheet("pasteSheet"); return true; }
  if (ds.magicclose) { hideSheet("magicSheet"); render(); return true; }
  if (ds.prefwith) { PREF_DRAFT = PREF_DRAFT || { with: "", loves: [] }; PREF_DRAFT.with = PREF_DRAFT.with === ds.prefwith ? "" : ds.prefwith; render(); return true; }
  if (ds.preflove) { PREF_DRAFT = PREF_DRAFT || { with: "", loves: [] }; const L = PREF_DRAFT.loves, i = L.indexOf(ds.preflove);
    if (i >= 0) L.splice(i, 1); else L.push(ds.preflove); render(); return true; }
  if (ds.prefsave) { const D = PREF_DRAFT || { with: "", loves: [] }; S.prefs = { with: D.with || null, loves: D.loves.slice(), top3: D.loves.slice(0, 3) }; PREF_DRAFT = null;
    save(); render(); toast("❤️ Saved — Cruise Hub will suggest what fits you"); return true; }
  if (ds.prefskip) { S.prefs = { skipped: true, loves: [] }; PREF_DRAFT = null; save(); render(); return true; }
  return false;
}
function onboardSubmit(f, data) {
  if (!f.dataset.pastecruise) return false;
  if (pasteCruise(data.text || "")) { const el = document.getElementById("pasteSheet"); if (el) el.classList.add("hidden"); }
  return true;
}

// ------------------------------------------------- travel day / sail day / on board
// v0.61 (V1 step 10, Scott's blueprint 26-28: "TRAVEL DAY - TOMORROW YOU SAIL ... GET ME TO MY SHIP",
// "EMBARKATION - TODAY YOU SAIL", "FIRST 10 MINUTES ONBOARD - YOU'RE ONBOARD! muster, dining, shows,
// package, Wi-Fi, explore"). HOME shows the card for the moment; nothing is stored but ticks.
const FIRST_THINGS = [["muster", "Safety drill / muster check-in done"], ["dining", "Dinner time + first-night reservation checked"],
  ["shows", "Show / specialty dining reservations checked"], ["cabin", "Found the cabin — safe works, bags arriving"],
  ["wifi", "Wi-Fi / package set up on your phone"], ["explore", "Walked the ship — dining room, theater, guest services"]];
function listFrac(tr, k) { ensureLists(tr); const L = tr.lists[k] || []; return [L.filter(i => i.done).length, L.length]; }
function phaseCardHtml(tr) {
  if (!tr || !tr.start || !isCruise(tr)) return "";
  const sd = daysUntil(tr.start);
  const tick = (ok, label, act) => `<button class="rn-row" ${act || ""}><span>${ok ? "✅" : "⬜"}</span><span class="grow">${label}</span><span class="chev">›</span></button>`;
  if (sd === 1 || (sd === 0 && !tr.aboard)) {
    const [dd, dn] = listFrac(tr, "docs"), [pd, pn] = listFrac(tr, "packing"), [ed, en] = listFrac(tr, "embark");
    const w = tr.port ? PORTWX[`${tr.port}|${tr.start}`] : null, wx = w && !w.loading && !w.none ? ` · ${wmo(w.code)[0]} ${Math.round(w.hi)}° at ${esc(placeName(tr.port))}` : "";
    return `<section class="card phase"><h3>${sd === 1 ? "🚗 Tomorrow you sail" : "🚢 Today you sail"}</h3><div class="body">
      <div class="today-line"><b>${esc(tr.ship || tr.name)}</b>${tr.port ? ` · ${esc(placeName(tr.port))}` : ""}${wx}</div>
      ${tick(dn > 0 && dd === dn, `Documents ${dd}/${dn}`, 'data-shellgo="plan" data-triplistgo="docs"')}
      ${tick(pn > 0 && pd === pn, `Bags packed ${pd}/${pn}`, 'data-shellgo="plan" data-planview="packing"')}
      ${tick(!!tr.travel || (tr.costs || []).some(c => c.cat === "parking"), tr.travel ? `Getting there: ${esc(tr.travel)}` : "Getting there + parking planned", 'data-shellgo="wallet"')}
      ${tick(en > 0 && ed === en, `Sail-day plan ${ed}/${en}`, 'data-shellgo="plan" data-triplistgo="embark"')}
      ${typeof homePortHtml === "function" ? homePortHtml(tr, false) : ""}
      ${tr.port ? `<a class="btn sm ghost" style="margin-top:8px" href="${mapsLink(`${placeName(tr.port)} cruise terminal`)}" target="_blank" rel="noopener">🗺️ Directions to the terminal</a>` : ""}
      ${sd === 0 ? `<button class="btn sm" data-aboard="1" style="margin:8px 0 0 6px">✅ We're on board</button>` : ""}</div></section>`;
  }
  if (sd === 0 && tr.aboard && !tr.firstDone) {
    const F = tr.firstThings || {}, n = FIRST_THINGS.filter(([k]) => F[k]).length;
    return `<section class="card phase"><h3>🎉 You're on board! <span class="meta">${n}/${FIRST_THINGS.length}</span></h3><div class="body">
      <div class="today-line sub">First things — before the crowds:</div>
      ${FIRST_THINGS.map(([k, l]) => `<label class="row"><input type="checkbox" class="tick" data-first="${k}" ${F[k] ? "checked" : ""}><span class="grow">${l}</span></label>`).join("")}
      <button class="btn sm ghost" data-firstdone="1" style="margin-top:6px">${n === FIRST_THINGS.length ? "🥂 All done — start my cruise" : "Hide this"}</button></div></section>`;
  }
  return "";
}
function phaseClick(ds) {
  if (ds.firstdone) { const tr = curTrip(); if (tr) { tr.firstDone = true; save(); render(); } return true; }
  return false;
}
function phaseChange(ds, t) {
  if (!ds.first) return false;
  const tr = curTrip(); if (!tr) return true;
  tr.firstThings = Object.assign({}, tr.firstThings, { [ds.first]: t.checked }); save(); setTimeout(render, 0); return true;
}

// ------------------------------------------------------- itemized running cost
// v0.62 (Scott 10/5: "it needs itemized running cost of trip/cruise"): every cost of the trip on ONE list,
// each line with a running total - the fare, everything booked around it (hotel, gas/flights, parking,
// excursions, packages, insurance), every onboard charge as it happens, and the gratuity estimate.
function tripItems(tr) {
  const out = [];
  if (Number(tr.total) > 0) out.push({ day: null, what: `${isCruise(tr) ? "🚢 Cruise fare" : "✈️ Trip price"}`, amt: Number(tr.total), status: tripLeft(tr) ? `${money(tripPaid(tr))} paid` : "paid ✓" });
  (tr.costs || []).filter(c => Number(c.amt) > 0).forEach(c => out.push({ day: null, what: `${costLabel(c.cat)}${c.what ? ` — ${c.what}` : ""}`, amt: Number(c.amt), status: c.paid ? "paid ✓" : "not paid" }));
  (tr.spends || []).slice().sort((a, b) => String(a.day || "").localeCompare(String(b.day || ""))).forEach(x =>
    out.push({ day: x.day || null, what: `${isCruise(tr) ? "🍹" : "💵"} ${x.note || x.cat || "Spending"}`, amt: Number(x.amt) || 0, status: isCruise(tr) ? "ship account" : "spent" }));
  const g = gratEstimate(tr); if (g) out.push({ day: null, what: "🧾 Gratuities (estimate)", amt: g, status: "estimate" });
  let run = 0; out.forEach(i => { run += i.amt; i.run = run; });
  return out;
}
function itemizedHtml(tr) {
  const L = tripItems(tr); if (!L.length) return "";
  const total = L[L.length - 1].run;
  return `<div class="day-label" style="margin-top:4px">🧾 Itemized — running total</div>
    <div class="itemized">${L.map(i => `<div class="it-row"><span class="grow">${esc(i.what)}<span class="sub">${i.day ? `${prettyDate(i.day)} · ` : ""}${esc(i.status)}</span></span>
      <span class="it-amt">${money(i.amt)}</span><span class="it-run">${money(i.run)}</span></div>`).join("")}
      <div class="it-row it-total"><span class="grow"><b>Trip so far</b></span><span class="it-amt"></span><span class="it-run"><b>${money(total)}</b></span></div></div>`;
}

// ------------------------------------------------------------ Trip Hub (v0.97)
// Scott 10/7 (Trip Hub blueprint, docs/TRIP_HUB_PLANS paste 4): app #3 runs this
// same engine at /triphub/ (DH_MODE "trip"). A regular trip has no ship or ports,
// so HOME's "no trip yet" and EXPLORE are trip-shaped. EXPLORE has no places data
// yet (a paid source waits on Scott's OK), so it asks the AI from the traveler's
// own trip - and says to check hours and prices.
function addTripHtml() {
  return `<section class="card add-cruise"><h3>✈️ Add my trip</h3><div class="body">
      <button class="rn-row" data-qa="trip"><span>✍️</span><span class="grow">Enter my trip<span class="sub">Where, when, who's going — 30 seconds</span></span><span class="chev">›</span></button>
      ${gmailAllowed() ? `<button class="rn-row" data-mail="scan"><span>📬</span><span class="grow">Find it in my email<span class="sub">Read-only, on this phone</span></span><span class="chev">›</span></button>` : ""}
      <div class="today-line sub" style="margin-top:6px">Then add flights, hotels and plans day by day — Trip Hub builds the countdown, packing list and documents list for you.</div>
    </div></section>`;
}
function tripExploreHtml() {
  const tr = curTrip(), where = tr && tr.port ? placeName(tr.port) : "", at = where ? ` in ${where}` : " where we're going";
  const qs = [["🌟", "Top things to do", `What are the top things to do${at}?`], ["🆓", "Free things", `What's free to do${at}?`],
    ["🍽️", "Where to eat", `Where should we eat${at}?`], ["💕", "Something romantic", `Something romantic to do${at}?`],
    ["☔", "Rainy-day ideas", `Rainy-day ideas${at}?`], ["⏱️", "I have 2 hours", `We have 2 hours free${at} — what's worth it?`]];
  return `<section class="card"><h3>🌎 Things to do${where ? ` — ${esc(where)}` : ""}</h3><div class="body">
      ${tr ? "" : `<div class="today-line sub">Add your trip first, then ideas fit where you're going.</div>`}
      ${tileNav(qs.map(([ic, l, q]) => ({ icon: ic, label: l, attrs: `data-askq="${esc(q)}"` })), 3)}
      <p class="fine" style="margin-top:8px">Ideas come from ${esc(APP_NAME)} AI using your own trip. Check opening hours and prices before you go.</p></div></section>`;
}

// ------------------------------------------------------------ PORT REALITY (v1.02)
// Cruise Hub plan (10/4): '"Port Reality" usable time'. The ship is in port 8 AM - 5 PM, but the time you really
// have ashore is shorter: getting off takes a while, and Return Guard wants you heading back well before all
// aboard. RULES ONLY, from the port's own times:
//   off the ship ~ arrival + 30 min (60 at a tender port - the boats run in turns)
//   back by      = Return Guard's head-back time (all aboard on the phone's clock - margin - trip back)
//   real time ashore = back by - off the ship
// Estimates, said so on screen - the ship's announcements always win.
const PORT_OFF_MIN = 30, PORT_OFF_TENDER = 60;
function portReality(pt) {
  if (!pt || !pt.arrive || !pt.allAboard) return null;
  const tender = isTenderPort(pt), off = addMinT(pt.arrive, tender ? PORT_OFF_TENDER : PORT_OFF_MIN), by = guardBy(pt);
  if (toMin(aaLocal(pt)) <= toMin(pt.arrive)) return null;                 // overnight / next-day all aboard: not this sum
  return { tender, off, by, mins: toMin(by) - toMin(off) };
}
const ashoreText = m => m <= 0 ? "no time" : minsText(m);
// timeline bit: "⏱️ 5h 40m ashore"
const portRealityBit = pt => { const R = portReality(pt); return R ? `⏱️ ${R.mins > 0 ? ashoreText(R.mins) + " ashore" : "check times"}` : ""; };
// the day screen block
function portRealityHtml(pt) {
  const R = portReality(pt);
  if (!R) return pt && !pt.arrive && pt.allAboard ? `<div class="today-line sub">⏱️ Add the time the ship arrives (✏️ Edit this port) to see your real time ashore.</div>` : "";
  const row = (l, s, v) => `<div class="row"><span class="grow">${l}${s ? `<span class="sub">${s}</span>` : ""}</span><b>${v}</b></div>`;
  const tone = R.mins <= 0 ? "⚠️ Not enough time ashore once you allow for getting off and back — check the times with the ship."
    : R.mins < 180 ? "⚠️ A short port day — pick ONE thing and stay close to the ship." : R.mins < 300 ? "👍 Time for one excursion or a good look around." : "🌴 Plenty of time — an excursion and some free time.";
  const where = pt.name ? ` in ${pt.name}` : "";
  return `<div class="day-label" style="margin-top:10px">⏱️ Port reality</div>
    <div class="port-reality"><div class="pr-big">${R.mins > 0 ? ashoreText(R.mins) : "0m"}</div><div class="pr-sub">real time ashore</div></div>
    ${row("Ship arrives", "", hm(pt.arrive))}
    ${row("Off the ship", `about ${R.tender ? PORT_OFF_TENDER : PORT_OFF_MIN} min${R.tender ? " — a tender port, the boats run in turns" : " for the gangway crowd"}`, `~${hm(R.off)}`)}
    ${row("Head back by", `${guardMargin()} min margin + ${guardBack(pt)} min trip back`, hm(R.by))}
    ${row("All aboard", Number(pt.shipOffset) ? `${hm(pt.allAboard)} ship time` : "", hm(aaLocal(pt)))}
    <div class="today-line">${tone}</div>
    ${R.mins > 60 ? `<button class="add-link" data-askq="${esc(`We have about ${ashoreText(R.mins)} ashore${where} — what's worth it?`)}">💡 What fits in ${ashoreText(R.mins)}${esc(where)}?</button>` : ""}
    <p class="fine">Estimates from your port times. Getting off can be faster with an early excursion, slower on a busy day — the ship's announcements always win.</p>`;
}

// ------------------------------------------------------------ FINAL BILL CHECK (v1.03)
// Cruise Hub plan (10/4): "Final Bill Check". The last night, put the ship's bill next to Cruise Hub's own count
// (logged spending + estimated gratuities - onboard credit) and say what to look for. RULES ONLY, from the trip:
// a package that pays gratuities, onboard credit, excursions already paid before the cruise, the same amount
// logged twice on one day. Nothing is looked up - the traveler types the bill's total (tr.billSeen).
const BILL_CLOSE = 5;                                                        // within $5 = it matches
function billCount(tr) {
  const spent = tripSpent(tr), gr = gratEstimate(tr), credit = Number(tr.credit || 0);
  return { spent, n: (tr.spends || []).length, gr, credit, total: Math.round((spent + gr - credit) * 100) / 100 };
}
// what to look for on the bill, from this trip's own data
function billLooks(tr) {
  const out = [], P = pkgOf(tr), n = Number(tr.travelers) || 1, nights = tripNights(tr);
  if (P && P.gratsPaid) out.push(`${P.name} pays crew gratuities — there should be NO daily gratuity charge.`);
  else if (nights) out.push(`Gratuities: Cruise Hub counts about ${money(GRAT_PER_DAY)} a person a night (${n} × ${nights} nights). Your line's real rate is on the bill — compare that line first.`);
  if (Number(tr.credit) > 0) out.push(`Your ${money(tr.credit)} onboard credit should show as a credit.`);
  (tr.costs || []).filter(c => c.cat === "excursion" && c.paid).forEach(c => out.push(`You paid for ${c.what || "an excursion"} (${money(c.amt)}) before the cruise — it should NOT be on the ship bill.`));
  const seen = {};
  (tr.spends || []).forEach(x => { const k = `${x.day}|${Number(x.amt).toFixed(2)}`; seen[k] = (seen[k] || 0) + 1; });
  Object.entries(seen).filter(([, c]) => c > 1).forEach(([k, c]) => { const [d, a] = k.split("|");
    out.push(`Your log has ${money(a)} ${c} times on ${dayName(d)} ${prettyDate(d)} — if the bill does too, make sure you really bought it ${c} times.`); });
  out.push("Bar, spa and salon charges often add a service charge on top of the price — your log may not include it.");
  out.push("A charge you don't recognize? Guest Services can show you the receipt you signed.");
  return out;
}
function showBill() {
  const tr = curTrip(); if (!tr) return;
  let el = document.getElementById("billSheet");
  if (!el) { el = document.createElement("div"); el.id = "billSheet"; el.className = "sheet"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "Final bill check"); document.body.appendChild(el); }
  const C = billCount(tr), seen = Number(tr.billSeen), has = tr.billSeen !== undefined && tr.billSeen !== null && tr.billSeen !== "" && isFinite(seen);
  const diff = has ? Math.round((seen - C.total) * 100) / 100 : 0, close = has && Math.abs(diff) <= BILL_CLOSE;
  const row = (l, v, s) => `<div class="row"><span class="grow">${l}${s ? `<span class="sub">${s}</span>` : ""}</span><b>${v}</b></div>`;
  const verdict = !has ? "" : close ? `<div class="bstat ok">✅ Within ${money(BILL_CLOSE)} of your count — looks right.</div>`
    : diff > 0 ? `<div class="bstat over">⚠️ The bill is <b>${money(diff)} MORE</b> than your count — go through it with the list below.</div>`
    : `<div class="bstat">The bill is <b>${money(-diff)} less</b> than your count — good for you, but check the list below (a charge may still be coming).</div>`;
  el.innerHTML = `<div class="sheet-body"><div class="grab"></div>
    <div class="sheet-head"><h2>🧾 Final bill check</h2><button class="icon-btn" data-billclose="1" aria-label="Close">✕</button></div>
    <div class="day-label">Cruise Hub's count</div>
    ${row("Your logged spending", money(C.spent), `${C.n} charge${C.n === 1 ? "" : "s"} logged`)}
    ${row("Gratuities", C.gr ? `~${money(C.gr)}` : "$0.00", C.gr ? "estimate" : pkgOf(tr) && pkgOf(tr).gratsPaid ? `paid by ${esc(pkgOf(tr).name)}` : "")}
    ${C.credit ? row("Onboard credit", `−${money(C.credit)}`) : ""}
    ${row("<b>About</b>", money(C.total))}
    <form class="qa-form" data-bill="${tr.id}" style="margin-top:10px">
      <label class="field" style="margin:0">What does the ship's bill say?<input name="amt" type="number" step="0.01" inputmode="decimal" placeholder="Total $" value="${has ? esc(String(seen)) : ""}" required></label>
      <button class="btn sm">Compare</button></form>
    ${verdict}
    ${has ? `<label class="row"><input type="checkbox" class="tick" data-billok="${tr.id}" ${tr.accountVerified ? "checked" : ""}><span class="grow">Charges match — I've checked my bill</span></label>` : ""}
    <div class="day-label" style="margin-top:10px">Look for</div>
    ${billLooks(tr).map(x => `<div class="today-line">☐ ${esc(x)}</div>`).join("")}
    <p class="fine">See your bill in the cruise line's app or at Guest Services. It's easiest to fix before you get off the ship. Log charges as you go (Wallet → Onboard) and this count gets closer.</p></div>`;
  el.classList.remove("hidden");
}
function billClick(ds) {
  if (ds.billcheck) { hideSheet("ghSheet"); showBill(); return true; }
  if (ds.billclose) { hideSheet("billSheet"); return true; }
  return false;
}
function billChange(ds, t) {
  if (!ds.billok) return false;
  const tr = S.trips.find(x => x.id === ds.billok); if (!tr) return true;
  tr.accountVerified = t.checked; save(); render(); showBill(); return true;
}
function billSubmit(f, data) {
  if (!f.dataset.bill) return false;
  const tr = S.trips.find(x => x.id === f.dataset.bill); if (!tr) return true;
  const v = Number(data.amt); if (!isFinite(v) || data.amt === "") return true;
  snap(); tr.billSeen = Math.round(v * 100) / 100;
  save(); render(); showBill(); return true;
}
