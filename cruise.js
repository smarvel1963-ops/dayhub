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
  if (ds.gohome) { showGoHome(); return true; }
  if (ds.ghclose) { document.getElementById("ghSheet").classList.add("hidden"); return true; }
  if (ds.ghgo) { const tr = curTrip(); document.getElementById("ghSheet").classList.add("hidden");
    if (ds.ghgo === "perks") S.tripTab = "perks"; else { S.tripTab = "lists"; S.tripList = "final"; }
    S.hidden = S.hidden.filter(x => x !== "trips"); S.collapsed = S.collapsed.filter(x => x !== "trips"); save(); render();
    const el = document.querySelector('[data-card="trips"]'); if (el && tr) el.scrollIntoView({ behavior: "smooth", block: "start" }); return true; }
  if (ds.ghdone) { const tr = curTrip(); if (tr) { snap(); tr.homeDone = tr.end; save(); }
    document.getElementById("ghSheet").classList.add("hidden"); render(); toast("Welcome home 🏠", true); return true; }
  return false;
}
function cruiseChange(ds, t) {
  if (!ds.ghtoggle) return false;
  const tr = curTrip(); if (!tr) return true;
  if (ds.ghtoggle === "safe") tr.safeEmpty = t.checked; else if (ds.ghtoggle === "account") tr.accountVerified = t.checked;
  save(); setTimeout(() => { render(); showGoHome(); }, 0); return true;
}
function cruiseSubmit(f, data) {
  if (!f.dataset.car) return false;
  const tr = S.trips.find(x => x.id === f.dataset.car); if (!tr) return true;
  const c = { where: String(data.where || "").trim(), level: String(data.level || "").trim(), spot: String(data.spot || "").trim() };
  tr.car = c.where || c.level || c.spot ? { ...c, savedAt: new Date().toISOString() } : null;
  save(); render(); showGoHome(); toast(tr.car ? "🚗 Car spot saved" : "Car spot cleared"); return true;
}
