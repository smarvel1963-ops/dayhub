/* SAVE AS: auto.js · LOCATION: C:/MarvelApps/dayhub/auto.js
 * AUTO HUB (app #5 of the Hub family, Scott 2026-10-14: logo + "Auto Hub — Complete app concept", saved verbatim in
 * C:/MarvelDesktop/docs/AUTO_HUB_PLAN_FROM_OUTSIDE_CHAT_2026-10-14.md). Runs at /autohub/ with window.DH_MODE = "auto".
 * Release 1 (plan sections 1, 2, Fuel Hub, Safety Hub):
 *   - My Garage: each car its own page; VIN fills year / make / model / trim / engine from NHTSA vPIC (free, no key)
 *   - Smart Maintenance: due by miles OR months, whichever comes first, from the last time it was logged
 *   - Fuel: fill-ups -> MPG, cost per mile, fuel spend
 *   - Recalls: NHTSA recalls by year / make / model (free, no key); the owner ticks off ones already fixed
 * Release 2 (same night, Scott "work on this app for 1 hour or till completed"): Papers (insurance / registration /
 * warranty / inspection with expiry reminders), Extras Garage (installed + wishlist, plan's Extras Hub), cost to own,
 * a rough value estimate from what the owner paid, a shareable build sheet (VIN left out unless ticked), and a VIN
 * barcode scan where the phone's browser can read barcodes (BarcodeDetector; Android Chrome).
 * Pro (Scott 10/14: $2.99/month) is the AUTO_PASS switch (features.js, OFF): while off everything is free. When on,
 * free = 1 car. Everything lives in S.garage on this phone. Intervals are typical ones, labelled as such - never a
 * promise about a particular car.
 */
"use strict";
const VPIC = "https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/";
const RECALLS = "https://api.nhtsa.gov/recalls/recallsByVehicle";
// key, icon, name, every N miles (0 = by time only), every N months (0 = by miles only)
const AUTO_SERVICES = [
  ["oil", "🛢️", "Oil change", 5000, 6], ["rotate", "🔄", "Tire rotation", 6000, 6], ["brakes", "🛑", "Brake check", 12000, 12],
  ["air", "🌬️", "Engine air filter", 15000, 12], ["cabin", "🍃", "Cabin air filter", 15000, 12], ["battery", "🔋", "Battery test", 0, 12],
  ["wipers", "🧽", "Wiper blades", 0, 12], ["inspect", "📋", "Inspection", 0, 12], ["coolant", "❄️", "Coolant", 50000, 60],
  ["trans", "⚙️", "Transmission fluid", 60000, 60], ["plugs", "⚡", "Spark plugs", 100000, 0], ["tires", "🛞", "New tires", 50000, 72],
  ["other", "🔧", "Other repair", 0, 0]];
const AUTO_TABS = [["overview", "🚗", "Overview"], ["service", "🧰", "Service"], ["fuel", "⛽", "Fuel"], ["papers", "📄", "Papers"], ["extras", "🔧", "Extras"], ["recalls", "⚠️", "Recalls"]];
// key, icon, name, months a renewal usually runs (the Renewed button adds this)
const AUTO_PAPERS = [["insurance", "🛡️", "Insurance", 6], ["registration", "🪪", "Registration", 12], ["inspection", "📋", "Inspection sticker", 12],
  ["warranty", "🧾", "Warranty", 12], ["loan", "🏦", "Loan / lease", 1], ["roadside", "🚨", "Roadside plan", 12], ["other", "📁", "Other", 12]];
const AUTO_EXTRA_CATS = [["performance", "🏁", "Performance"], ["interior", "💺", "Interior"], ["exterior", "✨", "Exterior"], ["other", "🔩", "Other"]];
const paper = k => AUTO_PAPERS.find(x => x[0] === k) || AUTO_PAPERS[AUTO_PAPERS.length - 1];
const xcat = k => AUTO_EXTRA_CATS.find(x => x[0] === k) || AUTO_EXTRA_CATS[AUTO_EXTRA_CATS.length - 1];
// A date with its year when it is not this year ("Jan 1, 2025").
const aDate = d => d ? prettyDate(d) + (String(d).slice(0, 4) !== today().slice(0, 4) ? ", " + String(d).slice(0, 4) : "") : "";
let AUTO_OPEN = null, AUTO_TAB = "overview", AUTO_BUSY = false, AUTO_MSG = "";

const svc = k => AUTO_SERVICES.find(s => s[0] === k) || AUTO_SERVICES[AUTO_SERVICES.length - 1];
function garage() {
  if (!S.garage || typeof S.garage !== "object") S.garage = { cars: [] };
  if (!Array.isArray(S.garage.cars)) S.garage.cars = [];
  S.garage.cars.forEach(c => { ["services", "fuel", "odo", "papers", "extras"].forEach(k => { c[k] = Array.isArray(c[k]) ? c[k] : []; });
    c.recallDone = c.recallDone && typeof c.recallDone === "object" ? c.recallDone : {}; });
  return S.garage;
}
const autoSet = () => !!(S.garage && S.garage.cars && S.garage.cars.length);
const carById = id => garage().cars.find(c => c.id === id);
const carName = c => c.nick || [c.year, c.make, c.model].filter(Boolean).join(" ") || "My car";
const titleCase = s => String(s || "").toLowerCase().replace(/\b[a-z]/g, m => m.toUpperCase());
const autoPro = () => typeof isPro === "function" && isPro();
const autoCanAdd = () => !switchOn("AUTO_PASS") || autoPro() || garage().cars.length < 1;
const miles = n => Math.round(Number(n) || 0).toLocaleString("en-US");
const toMiles = v => { const t = String(v == null ? "" : v).replace(/[^\d.]/g, ""); if (!t) return null; const n = Number(t); return n >= 0 && n < 2000000 ? Math.round(n) : null; };   // blank = not set, never 0

// ------------------------------------------------------------ the math (pure, the tests call these)
// Miles a day this car is driven, from its own odometer readings; 33/day (about 12,000 a year) until 2+ weeks of data.
function milesPerDay(c) {
  const o = c.odo.slice().sort((a, b) => a.date.localeCompare(b.date));
  if (o.length < 2) return 33;
  const days = (parseDay(o[o.length - 1].date) - parseDay(o[0].date)) / 86400000, d = o[o.length - 1].miles - o[0].miles;
  return days >= 14 && d > 0 ? d / days : 33;
}
// Next due for one service on one car: from the last logged one, at +miles or +months, whichever comes first.
function serviceDue(c, key, onDay) {
  const [, , , everyMi, everyMo] = svc(key);
  const last = c.services.filter(s => s.kind === key).sort((a, b) => (b.date + String(b.miles).padStart(8, "0")).localeCompare(a.date + String(a.miles).padStart(8, "0")))[0];
  if (!last || (!everyMi && !everyMo)) return { key, last: last || null, logged: !!last };
  const dueMiles = everyMi && last.miles != null ? last.miles + everyMi : null;
  const dueDate = everyMo ? addMonthsDay(last.date, everyMo) : null;
  const leftMi = dueMiles != null ? dueMiles - (c.miles || 0) : null;
  const daysByMi = leftMi != null ? Math.round(leftMi / milesPerDay(c)) : null;
  const daysByDate = dueDate ? Math.round((parseDay(dueDate) - parseDay(onDay)) / 86400000) : null;
  const days = [daysByMi, daysByDate].filter(x => x != null).reduce((a, b) => Math.min(a, b), Infinity);
  return { key, last, logged: true, dueMiles, dueDate, leftMi, days, late: days < 0 || (leftMi != null && leftMi <= 0), soon: days <= 30 || (leftMi != null && leftMi <= 500) };
}
function carDue(c, onDay) {
  return AUTO_SERVICES.filter(s => s[3] || s[4]).map(s => serviceDue(c, s[0], onDay)).filter(d => d.logged && isFinite(d.days)).sort((a, b) => a.days - b.days);
}
// Fuel: every fill-up is treated as a full tank. MPG = miles since the last fill / gallons put in now.
function fuelStats(c) {
  const f = c.fuel.slice().sort((a, b) => a.miles - b.miles), rows = [];
  let dist = 0, gal = 0, cost = 0;
  for (let i = 1; i < f.length; i++) { const d = f[i].miles - f[i - 1].miles; if (d > 0 && f[i].gal > 0) { rows.push({ ...f[i], mpg: d / f[i].gal }); dist += d; gal += f[i].gal; cost += f[i].cost || 0; } }
  const month = c.fuel.filter(x => x.date >= addDays(today(), -30)).reduce((n, x) => n + (x.cost || 0), 0);
  return { rows, mpg: gal ? dist / gal : null, perMile: dist ? cost / dist : null, month, fills: c.fuel.length };
}
// Cost to own over the last 12 months: service + fuel + papers (insurance, registration...) that were paid in that window.
function ownCost(c, onDay) {
  const from = addDays(onDay, -365), inYr = d => d && d > from && d <= onDay;
  const service = c.services.filter(s => inYr(s.date)).reduce((n, s) => n + (s.cost || 0), 0);
  const fuel = c.fuel.filter(x => inYr(x.date)).reduce((n, x) => n + (x.cost || 0), 0);
  const papers = c.papers.filter(x => inYr(x.paid)).reduce((n, x) => n + (x.cost || 0), 0);
  const o = c.odo.filter(x => x.date > from).sort((a, b) => a.date.localeCompare(b.date)), driven = o.length > 1 ? o[o.length - 1].miles - o[0].miles : 0;
  const total = service + fuel + papers;
  return { service, fuel, papers, total, month: total / 12, perMile: driven > 0 ? total / driven : null, driven };
}
// Rough value: what the owner paid, less typical depreciation (15% a year for the first 5 years of the car's life,
// 10% after), moved 3% for every 12,000 miles above or below an average 12,000 a year (capped +/-15%). Range +/-12%.
// It is labelled an estimate from the owner's own price - never a market quote.
function carValue(c, onDay) {
  if (!(c.paid > 0) || !/^\d{4}-\d{2}-\d{2}$/.test(c.boughtOn || "")) return null;
  const yr = Number(c.year) || Number(c.boughtOn.slice(0, 4)), ageAt = d => Math.max(0, (parseDay(d) - new Date(yr - 1, 9, 1)) / (365.25 * 86400000));
  const keep = a => a <= 5 ? Math.pow(0.85, a) : Math.pow(0.85, 5) * Math.pow(0.90, a - 5);
  const a0 = ageAt(c.boughtOn), a1 = ageAt(onDay), base = c.paid * keep(a1) / keep(a0);
  const expected = 12000 * a1, off = c.miles != null && a1 > 0.25 ? (c.miles - expected) / 12000 : 0;
  const adj = Math.min(1.15, Math.max(0.85, 1 - 0.03 * off)), est = Math.round(base * adj / 100) * 100;
  return { est, low: Math.round(est * 0.88 / 100) * 100, high: Math.round(est * 1.12 / 100) * 100, age: a1, adj };
}
function buildSheet(c, withVin) {
  const L = [`🚗 ${carName(c)}`, [c.trim, c.engine, c.body].filter(Boolean).join(" · ")];
  if (c.miles != null) L.push(`Miles: ${miles(c.miles)}`);
  if (withVin && c.vin) L.push(`VIN: ${c.vin}`);
  const done = c.services.slice().sort((a, b) => b.date.localeCompare(a.date));
  if (done.length) { L.push("", "Service history:"); done.slice(0, 12).forEach(s => L.push(`- ${svc(s.kind)[2]}: ${aDate(s.date)}${s.miles != null ? ` at ${miles(s.miles)} mi` : ""}`)); }
  const inst = c.extras.filter(x => x.status === "installed");
  if (inst.length) { L.push("", "Extras & upgrades:"); inst.forEach(x => L.push(`- ${x.name}${x.date ? ` (${aDate(x.date)})` : ""}`)); }
  if (c.recalls && c.recalls.list.length) L.push("", `Safety recalls: ${c.recalls.list.length} for this model, ${c.recalls.list.filter(r => c.recallDone[r.id]).length} marked fixed.`);
  const f = fuelStats(c); if (f.mpg) L.push(`Average MPG (owner's log): ${f.mpg.toFixed(1)}`);
  L.push("", "Kept with Auto Hub by Marvel Corp");
  return L.filter((x, i, a) => !(x === "" && a[i - 1] === "")).join("\n").trim();
}
function addMonthsDay(day, n) {
  const d = parseDay(day), x = new Date(d.getFullYear(), d.getMonth() + Number(n), 1), last = new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate();
  x.setDate(Math.min(d.getDate(), last)); return ymd(x);
}
function setMiles(c, m, day) {
  if (m == null) return;
  c.miles = m; c.odo = c.odo.filter(o => o.date !== day); c.odo.push({ date: day, miles: m }); c.odo.sort((a, b) => a.date.localeCompare(b.date));
}

// ------------------------------------------------------------ outside data (NHTSA, free, no key)
async function decodeVin(vin) {
  const r = await fetch(VPIC + encodeURIComponent(vin) + "?format=json"); const j = await r.json(), x = (j.Results || [])[0] || {};
  if (!x.Make || !x.ModelYear) return null;
  const eng = [x.DisplacementL ? `${Number(x.DisplacementL).toFixed(1)}L` : "", x.EngineCylinders ? `${x.EngineCylinders}-cyl` : "", x.FuelTypePrimary || ""].filter(Boolean).join(" · ");
  return { year: x.ModelYear, make: titleCase(x.Make), model: x.Model || "", trim: x.Trim || "", body: x.BodyClass || "", engine: eng };
}
async function loadRecalls(c) {
  if (!c.make || !c.model || !c.year) { AUTO_MSG = "Add the year, make and model to check recalls."; return; }
  AUTO_BUSY = true; AUTO_MSG = ""; if (AUTO_OPEN === c.id) showCar(c.id);
  try {
    const r = await fetch(`${RECALLS}?make=${encodeURIComponent(c.make)}&model=${encodeURIComponent(c.model)}&modelYear=${encodeURIComponent(c.year)}`);
    const j = await r.json();
    c.recalls = { at: today(), list: (j.results || []).map(x => ({ id: x.NHTSACampaignNumber, part: titleCase(x.Component), summary: String(x.Summary || "").slice(0, 600),
      remedy: String(x.Remedy || "").slice(0, 400), park: x.parkIt === true || x.parkIt === "True" })) };
    save();
  } catch (e) { AUTO_MSG = "Couldn't reach the recall check. Try again in a minute."; }
  AUTO_BUSY = false; if (AUTO_OPEN === c.id) showCar(c.id); render();
}
const openRecalls = c => c.recalls ? c.recalls.list.filter(r => !c.recallDone[r.id]) : [];

// ------------------------------------------------------------ first run: add your first car
function carFormFields(c) {
  c = c || {};
  const scan = typeof window !== "undefined" && "BarcodeDetector" in window
    ? `<label class="btn sm ghost" style="align-self:flex-start">📷 Scan VIN barcode<input type="file" accept="image/*" capture="environment" data-avinscan="1" hidden></label>` : "";
  return `${scan}<input name="vin" placeholder="VIN (17 characters, optional - fills in the rest)" maxlength="17" autocapitalize="characters" spellcheck="false" value="${esc(c.vin || "")}" aria-label="VIN">
    <div class="hpv-row"><input name="year" inputmode="numeric" maxlength="4" placeholder="Year" value="${esc(c.year || "")}" aria-label="Year">
      <input name="make" placeholder="Make" value="${esc(c.make || "")}" aria-label="Make"><input name="model" placeholder="Model" value="${esc(c.model || "")}" aria-label="Model"></div>
    <input name="nick" placeholder="Nickname (optional), e.g. Dad's truck" value="${esc(c.nick || "")}" aria-label="Nickname">
    <input name="miles" inputmode="numeric" placeholder="Miles on it now" value="${c.miles != null ? c.miles : ""}" aria-label="Current miles">`;
}
function autoSetupHtml() {
  return `<section class="card welcome"><h2>Welcome to Auto Hub 🚗</h2>
    <p>Your cars, looked after. Add your first one: type the VIN and we'll fill in the year, make and model for you, or type them yourself.</p>
    <form class="qa-form" data-autosetup="1">
      <input name="name" placeholder="Your first name" autocomplete="given-name">
      <input name="city" placeholder="City or ZIP for weather (e.g. 72032)" required>
      ${carFormFields()}
      <button class="btn">Add my car</button></form><p class="fine" id="autoMsg">${AUTO_MSG ? "⚠️ " + esc(AUTO_MSG) : ""}</p></section>`;
}

// ------------------------------------------------------------ the dashboard
function autoDashHtml() {
  const cars = garage().cars, t = today();
  const due = cars.flatMap(c => carDue(c, t).slice(0, 3).map(d => ({ c, d }))).sort((a, b) => a.d.days - b.d.days).slice(0, 4);
  const papersDue = cars.flatMap(c => papersSoon(c, t).map(x => ({ c, x })));
  const recalls = cars.reduce((n, c) => n + openRecalls(c).length, 0);
  const dueHtml = due.length ? due.map(({ c, d }) => { const s = svc(d.key);
    return `<button class="row home-up" data-acar="${c.id}" data-atabgo="service"><span class="ci">${s[1]}</span><div class="grow"><b>${esc(s[2])}</b><span class="sub">${esc(carName(c))}</span></div>
      <span class="pill ${d.late ? "late" : d.soon ? "soon" : ""}">${dueWords(d)}</span></button>`; }).join("")
    : `<p class="fine" style="margin:0">Log your last oil change and we'll tell you when the next one is due.</p>`;
  const papersHtml = papersDue.map(({ c, x }) => { const k = paper(x.kind), n = daysUntil(x.expires);
    return `<button class="row home-up" data-acar="${c.id}" data-atabgo="papers"><span class="ci">${k[1]}</span><div class="grow"><b>${esc(x.name || k[2])}</b><span class="sub">${esc(carName(c))}</span></div>
      <span class="pill ${n < 0 ? "late" : "soon"}">${n < 0 ? "expired" : n === 0 ? "expires today" : `expires ${aDate(x.expires)}`}</span></button>`; }).join("");
  return `<section class="card home-dash"><h3><span class="ci">🚗</span>My Garage<span class="meta">${cars.length} car${cars.length === 1 ? "" : "s"}</span></h3>
    <div class="body"><div class="home-grid">${cars.map(c => { const late = carDue(c, t).filter(d => d.late).length, rc = openRecalls(c).length;
      return `<button class="home-space" data-acar="${c.id}"><span class="hs-ic">🚗</span><b>${esc(carName(c))}</b><small>${c.miles != null ? miles(c.miles) + " mi" : "miles not set"}</small>
        ${late ? `<small>⏰ ${late} due</small>` : ""}${rc ? `<small>⚠️ ${rc} recall${rc === 1 ? "" : "s"}</small>` : ""}${papersSoon(c, t).length ? `<small>📄 renew soon</small>` : ""}</button>`; }).join("")}
      <button class="home-space add" data-aaddcar="1"><span class="hs-ic">＋</span><b>Add</b><small>a car</small></button></div>
    ${recalls ? `<p class="fine" style="margin-top:8px">⚠️ ${recalls} open safety recall${recalls === 1 ? "" : "s"} across your cars. Recall repairs are free at the dealer.</p>` : ""}
    <p class="sub" style="margin:12px 0 6px"><b>⏰ Coming up</b></p>${papersHtml}${dueHtml}</div></section>`;
}
// Papers that expire within 30 days (or already have), soonest first.
const papersSoon = (c, onDay) => c.papers.filter(x => x.expires && x.expires <= addDays(onDay, 30)).sort((a, b) => a.expires.localeCompare(b.expires));
function dueWords(d) {
  if (d.late) return d.leftMi != null && d.leftMi <= 0 ? `${miles(-d.leftMi)} mi over` : "due now";
  const bits = []; if (d.leftMi != null) bits.push(`${miles(d.leftMi)} mi`); if (d.dueDate) bits.push(aDate(d.dueDate));
  return bits.join(" or ");
}

// ------------------------------------------------------------ one car = its own page
function autoSheet() {
  let el = document.getElementById("autoSheet");
  if (!el) { el = document.createElement("div"); el.id = "autoSheet"; el.className = "sheet"; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); document.body.appendChild(el); }
  return el;
}
function hideAutoSheet() { const el = document.getElementById("autoSheet"); if (el) el.classList.add("hidden"); AUTO_OPEN = null; AUTO_MSG = ""; }
function showCar(id, tab) {
  const c = carById(id); if (!c) return;
  AUTO_OPEN = id; if (tab) AUTO_TAB = tab;
  const el = autoSheet(); el.setAttribute("aria-label", carName(c));
  el.innerHTML = `<div class="sheet-body"><div class="grab"></div>
    <div class="sheet-head"><h2>🚗 ${esc(carName(c))}</h2><button class="icon-btn" data-aclose="1" aria-label="Close">✕</button></div>
    <p class="sub" style="margin-top:-6px">${esc([c.trim, c.engine].filter(Boolean).join(" · ") || [c.year, c.make, c.model].filter(Boolean).join(" "))}</p>
    <nav class="seg home-tabs">${AUTO_TABS.map(([k, i, l]) => `<button class="${AUTO_TAB === k ? "on" : ""}" data-atab="${k}">${i} ${l}</button>`).join("")}</nav>
    <div class="home-pane">${carPane(c)}</div><p class="fine" id="autoMsg">${AUTO_MSG ? "⚠️ " + esc(AUTO_MSG) : ""}</p></div>`;
  el.classList.remove("hidden");
}
function carPane(c) {
  const t = today();
  if (AUTO_TAB === "service") {
    const due = AUTO_SERVICES.filter(s => s[3] || s[4]).map(s => serviceDue(c, s[0], t));
    const logged = due.filter(d => d.logged).sort((a, b) => (isFinite(a.days) ? a.days : 1e9) - (isFinite(b.days) ? b.days : 1e9)), never = due.filter(d => !d.logged);
    const hist = c.services.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12);
    return `${logged.map(d => { const s = svc(d.key); return `<div class="row"><span class="ci">${s[1]}</span><div class="grow"><b>${esc(s[2])}</b>
        <span class="sub">Last ${aDate(d.last.date)}${d.last.miles != null ? ` at ${miles(d.last.miles)} mi` : ""}</span></div><span class="pill ${d.late ? "late" : d.soon ? "soon" : ""}">${dueWords(d)}</span></div>`; }).join("")}
      ${never.length ? `<p class="fine">Not logged yet: ${never.map(d => svc(d.key)[2]).join(", ")}. Log the last one and we'll work out the next.</p>` : ""}
      <form class="qa-form" data-aservice="${c.id}"><label class="field">What was done <select name="kind">${AUTO_SERVICES.map(([k, i, l]) => `<option value="${k}">${i} ${l}</option>`).join("")}</select></label>
        <div class="hpv-row"><input type="date" name="date" value="${t}" aria-label="Date"><input name="miles" inputmode="numeric" placeholder="Miles" value="${c.miles != null ? c.miles : ""}" aria-label="Miles">
        <input name="cost" inputmode="decimal" placeholder="Cost $" aria-label="Cost"></div>
        <input name="note" placeholder="Note or shop (optional)"><button class="btn sm">Log it</button></form>
      <p class="fine">Typical intervals: miles or months, whichever comes first. Your owner's manual wins.</p>
      ${hist.length ? `<p class="sub" style="margin-top:10px"><b>History</b></p>${hist.map(s => `<div class="row"><span class="ci">${svc(s.kind)[1]}</span><div class="grow">${esc(svc(s.kind)[2])}
        <span class="sub">${aDate(s.date)}${s.miles != null ? ` · ${miles(s.miles)} mi` : ""}${s.cost ? ` · ${money(s.cost)}` : ""}${s.note ? ` · ${esc(s.note)}` : ""}</span></div>
        <button class="icon-btn" data-adel="service:${s.id}" aria-label="Remove">✕</button></div>`).join("")}` : ""}`;
  }
  if (AUTO_TAB === "fuel") {
    const f = fuelStats(c), hist = c.fuel.slice().sort((a, b) => b.miles - a.miles).slice(0, 10), mpgOf = id => (f.rows.find(r => r.id === id) || {}).mpg;
    return `<div class="home-stats"><div class="home-stat"><b>${f.mpg ? f.mpg.toFixed(1) : "–"}</b><span>avg MPG</span></div>
        <div class="home-stat"><b>${f.perMile ? "$" + f.perMile.toFixed(2) : "–"}</b><span>fuel per mile</span></div><div class="home-stat"><b>${money(f.month).replace(/\.00$/, "")}</b><span>last 30 days</span></div></div>
      ${f.fills < 2 ? `<p class="fine">MPG shows from your 2nd fill-up. Fill the tank all the way each time.</p>` : ""}
      <form class="qa-form" data-afuel="${c.id}"><div class="hpv-row"><input name="miles" inputmode="numeric" placeholder="Odometer" aria-label="Odometer" required>
        <input name="gal" inputmode="decimal" placeholder="Gallons" aria-label="Gallons" required><input name="cost" inputmode="decimal" placeholder="Total $" aria-label="Total cost"></div>
        <input type="date" name="date" value="${t}" aria-label="Date"><button class="btn sm">Add fill-up</button></form>
      ${hist.map(x => `<div class="row"><span class="ci">⛽</span><div class="grow">${aDate(x.date)} · ${miles(x.miles)} mi
        <span class="sub">${x.gal} gal${x.cost ? ` · ${money(x.cost)}` : ""}${mpgOf(x.id) ? ` · ${mpgOf(x.id).toFixed(1)} MPG` : ""}</span></div><button class="icon-btn" data-adel="fuel:${x.id}" aria-label="Remove">✕</button></div>`).join("")}`;
  }
  if (AUTO_TAB === "papers") {
    const list = c.papers.slice().sort((a, b) => (a.expires || "9999").localeCompare(b.expires || "9999"));
    return `${list.length ? list.map(x => { const k = paper(x.kind), n = x.expires ? daysUntil(x.expires) : null;
        return `<div class="row"><span class="ci">${k[1]}</span><div class="grow"><b>${esc(x.name || k[2])}</b>
          <span class="sub">${esc(k[2])}${x.expires ? ` · ${n < 0 ? "expired" : "expires"} ${aDate(x.expires)}` : ""}${x.cost ? ` · ${money(x.cost)}` : ""}${x.ref ? ` · #${esc(x.ref)}` : ""}${x.note ? ` · ${esc(x.note)}` : ""}</span></div>
          ${x.expires ? `<button class="btn sm ghost" data-arenew="${x.id}">Renewed</button>` : ""}<button class="icon-btn" data-adel="paper:${x.id}" aria-label="Remove">✕</button></div>`; }).join("")
      : `<p class="fine" style="margin-top:0">Keep the dates that matter: insurance, registration, inspection, warranties. We remind you 30 days before one runs out.</p>`}
      <form class="qa-form" data-apaper="${c.id}"><label class="field">What <select name="kind">${AUTO_PAPERS.map(([k, i, l]) => `<option value="${k}">${i} ${l}</option>`).join("")}</select></label>
        <input name="name" placeholder="Company or name (optional), e.g. State Farm">
        <div class="hpv-row"><label class="field">Expires <input type="date" name="expires"></label><input name="cost" inputmode="decimal" placeholder="Cost $" aria-label="Cost">
          <input name="ref" placeholder="Policy # (optional)" aria-label="Policy or reference number"></div>
        <input name="note" placeholder="Note (optional)"><button class="btn sm">Add</button></form>
      <p class="fine">Only the details you type are kept, on this phone. Renewed moves the date on by a usual term and counts the cost again.</p>`;
  }
  if (AUTO_TAB === "extras") {
    const inst = c.extras.filter(x => x.status === "installed"), wish = c.extras.filter(x => x.status !== "installed");
    const sum = l => l.reduce((n, x) => n + (x.cost || 0), 0);
    const row = x => `<div class="row"><span class="ci">${xcat(x.cat)[1]}</span><div class="grow"><b>${esc(x.name)}</b>
        <span class="sub">${esc(xcat(x.cat)[2])}${x.cost ? ` · ${money(x.cost)}` : ""}${x.date ? ` · ${aDate(x.date)}` : ""}${x.note ? ` · ${esc(x.note)}` : ""}</span></div>
        ${x.status === "installed" ? "" : `<button class="btn sm ghost" data-ainstall="${x.id}">Installed</button>`}<button class="icon-btn" data-adel="extra:${x.id}" aria-label="Remove">✕</button></div>`;
    return `<div class="home-stats"><div class="home-stat"><b>${inst.length}</b><span>installed</span></div><div class="home-stat"><b>${money(sum(inst)).replace(/\.00$/, "")}</b><span>invested</span></div>
        <div class="home-stat"><b>${money(sum(wish)).replace(/\.00$/, "")}</b><span>wishlist</span></div></div>
      ${inst.length ? `<p class="sub" style="margin:10px 0 4px"><b>Installed</b></p>${inst.map(row).join("")}` : ""}
      ${wish.length ? `<p class="sub" style="margin:10px 0 4px"><b>Wishlist</b></p>${wish.map(row).join("")}` : ""}
      ${!c.extras.length ? `<p class="fine">Wheels, tint, exhaust, dash cam, seat covers - everything you add or want to add, with what it cost.</p>` : ""}
      <form class="qa-form" data-aextra="${c.id}"><input name="name" placeholder="Extra or upgrade, e.g. Window tint" required>
        <div class="hpv-row"><select name="cat" aria-label="Kind">${AUTO_EXTRA_CATS.map(([k, i, l]) => `<option value="${k}">${i} ${l}</option>`).join("")}</select>
          <input name="cost" inputmode="decimal" placeholder="Cost $" aria-label="Cost"><select name="status" aria-label="Installed or wishlist"><option value="installed">Installed</option><option value="wish">Wishlist</option></select></div>
        <input name="note" placeholder="Brand, shop, notes (optional)"><button class="btn sm">Add</button></form>`;
  }
  if (AUTO_TAB === "recalls") {
    if (AUTO_BUSY) return `<p class="fine">Checking the government recall list…</p>`;
    if (!c.recalls) return `<p class="fine" style="margin-top:0">Check for safety recalls on every ${esc([c.year, c.make, c.model].filter(Boolean).join(" ") || "car like yours")} (NHTSA, free).</p>
      <button class="btn" data-arecall="${c.id}">Check recalls</button>`;
    const list = c.recalls.list;
    return `<p class="fine" style="margin-top:0">${list.length} recall${list.length === 1 ? "" : "s"} for this year, make and model · checked ${aDate(c.recalls.at)}. Not every one applies to every car; your VIN at nhtsa.gov/recalls or the dealer confirms yours. Recall repairs are free.</p>
      ${list.map(r => `<div class="row"><button class="check" data-arfix="${esc(r.id)}" aria-label="Mark fixed">${c.recallDone[r.id] ? "✓" : "○"}</button><div class="grow"><b>${r.park ? "🚨 PARK IT - " : ""}${esc(r.part)}</b>
        <span class="sub">${esc(r.summary.slice(0, 220))}${r.summary.length > 220 ? "…" : ""}</span><span class="sub">Fix: ${esc(r.remedy.slice(0, 160))}${r.remedy.length > 160 ? "…" : ""} · #${esc(r.id)}</span></div></div>`).join("")}
      <div class="foot-actions"><button class="btn sm ghost" data-arecall="${c.id}">Check again</button><a class="btn sm ghost" href="https://www.nhtsa.gov/recalls" target="_blank" rel="noopener">Check my VIN at NHTSA</a></div>`;
  }
  const f = fuelStats(c), spent = c.services.reduce((n, s) => n + (s.cost || 0), 0);
  return `<div class="home-stats"><div class="home-stat"><b>${c.miles != null ? miles(c.miles) : "–"}</b><span>miles</span></div>
      <div class="home-stat"><b>${f.mpg ? f.mpg.toFixed(1) : "–"}</b><span>avg MPG</span></div><div class="home-stat"><b>${money(spent).replace(/\.00$/, "")}</b><span>service spend</span></div></div>
    <form class="qa-form" data-amiles="${c.id}" style="margin-top:10px"><div class="two"><input name="miles" inputmode="numeric" placeholder="Miles on it now" aria-label="Miles now"><button class="btn sm">Update miles</button></div></form>
    ${(o => o.total ? `<p class="sub" style="margin:12px 0 4px"><b>💰 Cost to own, last 12 months</b></p>
      <div class="row"><div class="grow"><b>${money(o.total).replace(/\.00$/, "")}</b><span class="sub">about ${money(o.month).replace(/\.00$/, "")} a month${o.perMile ? ` · ${money(o.perMile)} a mile` : ""}</span>
      <span class="sub">Service ${money(o.service).replace(/\.00$/, "")} · Fuel ${money(o.fuel).replace(/\.00$/, "")} · Papers ${money(o.papers).replace(/\.00$/, "")}</span></div></div>` : "")(ownCost(c, today()))}
    <p class="sub" style="margin:12px 0 4px"><b>💲 What it's worth</b></p>
    ${(v => v ? `<div class="row"><div class="grow"><b>${money(v.est).replace(/\.00$/, "")}</b><span class="sub">likely ${money(v.low).replace(/\.00$/, "")} – ${money(v.high).replace(/\.00$/, "")}</span></div></div>
      <p class="fine">A rough estimate from what you paid, usual yearly drop and your miles - not a dealer quote. Condition, options and your area move the real price.</p>` : "")(carValue(c, today()))}
    <form class="qa-form" data-avalue="${c.id}"><div class="hpv-row"><label class="field">Paid $ <input name="paid" inputmode="decimal" placeholder="e.g. 30000" value="${c.paid || ""}"></label>
      <label class="field">Bought <input type="date" name="boughtOn" value="${esc(c.boughtOn || "")}"></label><button class="btn sm ghost">${c.paid ? "Update" : "Estimate"}</button></div></form>
    <p class="sub" style="margin:12px 0 4px"><b>📄 Build sheet</b></p>
    <p class="fine" style="margin-top:0">Everything about this car in one block of text - for a car club, a show, or a listing when you sell.</p>
    <label class="fine" style="display:flex;gap:8px;align-items:center;justify-content:flex-start;margin:4px 0 8px"><input type="checkbox" id="aVinShare" style="width:auto;flex:none;margin:0"><span>Include the VIN</span></label>
    <div class="foot-actions"><button class="btn sm" data-asheet="${c.id}">Share build sheet</button></div>
    <p class="sub" style="margin:12px 0 4px"><b>Details</b></p>
    <form class="qa-form" data-aedit="${c.id}">${carFormFields(c)}<button class="btn sm ghost">Save details</button></form>
    ${c.body || c.engine ? `<p class="fine">${esc([c.body, c.engine].filter(Boolean).join(" · "))}</p>` : ""}
    <button class="btn sm ghost" data-armcar="${c.id}" style="margin-top:10px">Remove this car</button>`;
}

// ------------------------------------------------------------ add / edit a car
function showAddCar() {
  const el = autoSheet(); AUTO_OPEN = null; el.setAttribute("aria-label", "Add a car");
  el.innerHTML = `<div class="sheet-body"><div class="grab"></div>
    <div class="sheet-head"><h2>＋ Add a car</h2><button class="icon-btn" data-aclose="1" aria-label="Close">✕</button></div>
    ${autoCanAdd() ? `<form class="qa-form" data-anewcar="1">${carFormFields()}<button class="btn">Add car</button></form>`
      : `<p>Auto Hub free keeps <b>1 car</b>. ${esc(PLAN.AUTO_NAME)} (${esc(PLAN.AUTO_MONTHLY)}, 30 days free) keeps every car you own.</p>
         ${PLAN.AUTO_CHECKOUT_URL ? `<a class="btn" href="${esc(PLAN.AUTO_CHECKOUT_URL)}" target="_blank" rel="noopener">Start 30 days free</a>` : `<p class="fine">Coming soon.</p>`}`}
    <p class="fine" id="autoMsg">${AUTO_MSG ? "⚠️ " + esc(AUTO_MSG) : ""}</p></div>`;
  el.classList.remove("hidden");
}
// Shows AUTO_MSG under the open form without redrawing it (what was typed stays).
function autoMsgShow() { const el = document.getElementById("autoMsg"); if (el) el.textContent = AUTO_MSG ? "⚠️ " + AUTO_MSG : ""; }
// Reads the car form; a 17-character VIN fills what the owner left blank. -> car fields or null (AUTO_MSG says why)
async function carFromForm(data) {
  const vin = String(data.vin || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  const out = { vin, year: String(data.year || "").trim(), make: titleCase(String(data.make || "").trim()), model: String(data.model || "").trim(),
    nick: String(data.nick || "").trim().slice(0, 40), miles: toMiles(data.miles) };
  if (vin && vin.length !== 17) { AUTO_MSG = "A VIN is 17 letters and numbers. Check it, or leave it blank and type the year, make and model."; return null; }
  if (vin) { try { const d = await decodeVin(vin); if (d) { ["year", "make", "model"].forEach(k => { if (!out[k]) out[k] = d[k]; }); out.trim = d.trim; out.engine = d.engine; out.body = d.body; }
      else if (!out.make) { AUTO_MSG = "That VIN didn't match a car. Check it, or type the year, make and model."; return null; } }
    catch (e) { if (!out.make) { AUTO_MSG = "Couldn't reach the VIN lookup. Type the year, make and model instead."; return null; } } }
  if (!/^(19|20)\d\d$/.test(out.year) || !out.make || !out.model) { AUTO_MSG = "Add the year, make and model (or a VIN)."; return null; }
  out.make = out.make.slice(0, 30); out.model = out.model.slice(0, 40); AUTO_MSG = ""; return out;
}
function newCar(f) {
  const c = { id: uid(), vin: f.vin, year: f.year, make: f.make, model: f.model, trim: f.trim || "", engine: f.engine || "", body: f.body || "", nick: f.nick,
    miles: null, services: [], fuel: [], odo: [], papers: [], extras: [], recallDone: {}, added: today() };
  setMiles(c, f.miles, today()); return c;
}

// ------------------------------------------------------------ events (ui.js calls these first)
function autoClick(ds) {
  if (MODE !== "auto") return false;
  if (ds.acar) { AUTO_MSG = ""; showCar(ds.acar, ds.atabgo || "overview"); return true; }
  if (ds.aclose) { hideAutoSheet(); render(); return true; }
  if (ds.atab) { AUTO_TAB = ds.atab; AUTO_MSG = ""; if (AUTO_OPEN) showCar(AUTO_OPEN); return true; }
  if (ds.aaddcar) { AUTO_MSG = ""; showAddCar(); return true; }
  if (ds.arecall) { const c = carById(ds.arecall); if (c) loadRecalls(c); return true; }
  if (ds.arfix && AUTO_OPEN) { const c = carById(AUTO_OPEN); if (!c) return true; c.recallDone[ds.arfix] = !c.recallDone[ds.arfix]; if (!c.recallDone[ds.arfix]) delete c.recallDone[ds.arfix];
    save(); showCar(c.id); render(); return true; }
  if (ds.adel && AUTO_OPEN) { const c = carById(AUTO_OPEN); if (!c) return true; const [kind, id] = ds.adel.split(":");
    if (kind === "service") c.services = c.services.filter(x => x.id !== id); else if (kind === "fuel") c.fuel = c.fuel.filter(x => x.id !== id);
    else if (kind === "paper") c.papers = c.papers.filter(x => x.id !== id); else if (kind === "extra") c.extras = c.extras.filter(x => x.id !== id);
    save(); showCar(c.id); render(); return true; }
  if (ds.arenew && AUTO_OPEN) { const c = carById(AUTO_OPEN), x = c && c.papers.find(y => y.id === ds.arenew); if (!x) return true;
    const from = x.expires && x.expires > today() ? x.expires : today(); x.expires = addMonthsDay(from, paper(x.kind)[3]); x.paid = today();
    save(); showCar(c.id, "papers"); render(); toast(`${paper(x.kind)[1]} renewed to ${aDate(x.expires)}`); return true; }
  if (ds.ainstall && AUTO_OPEN) { const c = carById(AUTO_OPEN), x = c && c.extras.find(y => y.id === ds.ainstall); if (!x) return true;
    x.status = "installed"; x.date = today(); x.miles = c.miles; save(); showCar(c.id, "extras"); render(); toast(`🔧 ${x.name} installed`); return true; }
  if (ds.asheet) { const c = carById(ds.asheet); if (!c) return true; const box = document.getElementById("aVinShare");
    const text = buildSheet(c, !!(box && box.checked));
    if (navigator.share) navigator.share({ title: carName(c), text }).catch(() => {});
    else if (navigator.clipboard) navigator.clipboard.writeText(text).then(() => toast("📋 Build sheet copied"), () => toast("Couldn't copy - try again"));
    return true; }
  if (ds.armcar) { const c = carById(ds.armcar); if (!c) return true;
    if (AUTO_RM !== c.id && (c.services.length || c.fuel.length)) { AUTO_RM = c.id; setTimeout(() => { if (AUTO_RM === c.id) AUTO_RM = null; }, 5000);
      toast(`${carName(c)} has ${c.services.length} services and ${c.fuel.length} fill-ups. Tap Remove again to delete it.`); return true; }
    AUTO_RM = null; garage().cars = garage().cars.filter(x => x.id !== c.id); hideAutoSheet(); save(); render(); toast(`${carName(c)} removed`); return true; }
  return false;
}
let AUTO_RM = null;
function autoSubmit(f, data) {
  if (MODE !== "auto") return false;
  const num = v => { const n = Number(String(v || "").replace(/[^\d.]/g, "")); return n > 0 ? Math.round(n * 100) / 100 : 0; };
  const day = v => /^\d{4}-\d{2}-\d{2}$/.test(v || "") ? v : today();
  if (f.dataset.autosetup) {
    (async () => { const car = await carFromForm(data); if (!car) { autoMsgShow(); return; }
      S.name = (data.name || "").trim(); S.city = (data.city || "").trim(); S.pack = "general";
      garage().cars.push(newCar(car)); save(); WXDATA = null; render(); loadWeather(); toast(`🚗 ${carName(car)} is in your garage`); })();
    return true;
  }
  if (f.dataset.anewcar) {
    (async () => { if (!autoCanAdd()) return; const car = await carFromForm(data); if (!car) { autoMsgShow(); return; }
      const c = newCar(car); garage().cars.push(c); save(); render(); showCar(c.id, "overview"); toast(`🚗 ${carName(c)} added`); })();
    return true;
  }
  if (f.dataset.aedit) { const c = carById(f.dataset.aedit); if (!c) return true;
    (async () => { const car = await carFromForm({ ...data, miles: c.miles }); if (!car) { autoMsgShow(); return; }
      const changed = car.make !== c.make || car.model !== c.model || car.year !== c.year;
      Object.assign(c, { vin: car.vin, year: car.year, make: car.make, model: car.model, nick: car.nick }, car.trim ? { trim: car.trim, engine: car.engine, body: car.body } : {});
      if (changed) c.recalls = null;
      save(); showCar(c.id); render(); toast("Saved ✓"); })();
    return true; }
  if (f.dataset.amiles) { const c = carById(f.dataset.amiles), m = toMiles(data.miles); if (!c || m == null) return true;
    setMiles(c, m, today()); save(); showCar(c.id); render(); toast(`📍 ${miles(m)} miles`); return true; }
  if (f.dataset.aservice) { const c = carById(f.dataset.aservice); if (!c) return true;
    const kind = AUTO_SERVICES.some(s => s[0] === data.kind) ? data.kind : "other", m = toMiles(data.miles), d = day(data.date);
    c.services.push({ id: uid(), kind, date: d, miles: m, cost: num(data.cost), note: String(data.note || "").trim().slice(0, 120) });
    if (m != null && m > (c.miles || 0)) setMiles(c, m, d);
    save(); showCar(c.id, "service"); render(); toast(`${svc(kind)[1]} ${svc(kind)[2]} logged`); return true; }
  if (f.dataset.apaper) { const c = carById(f.dataset.apaper); if (!c) return true;
    const kind = AUTO_PAPERS.some(x => x[0] === data.kind) ? data.kind : "other", exp = /^\d{4}-\d{2}-\d{2}$/.test(data.expires || "") ? data.expires : "";
    c.papers.push({ id: uid(), kind, name: String(data.name || "").trim().slice(0, 60), expires: exp, cost: num(data.cost), paid: num(data.cost) ? today() : "",
      ref: String(data.ref || "").trim().slice(0, 40), note: String(data.note || "").trim().slice(0, 120) });
    save(); showCar(c.id, "papers"); render(); toast(`${paper(kind)[1]} ${paper(kind)[2]} saved`); return true; }
  if (f.dataset.aextra) { const c = carById(f.dataset.aextra), name = String(data.name || "").trim(); if (!c || !name) return true;
    const status = data.status === "wish" ? "wish" : "installed";
    c.extras.push({ id: uid(), name: name.slice(0, 80), cat: AUTO_EXTRA_CATS.some(x => x[0] === data.cat) ? data.cat : "other", cost: num(data.cost), status,
      date: status === "installed" ? today() : "", miles: status === "installed" ? c.miles : null, note: String(data.note || "").trim().slice(0, 120) });
    save(); showCar(c.id, "extras"); render(); toast(`🔧 ${name} ${status === "wish" ? "on the wishlist" : "added"}`); return true; }
  if (f.dataset.avalue) { const c = carById(f.dataset.avalue); if (!c) return true; const paid = num(data.paid);
    if (!paid || !/^\d{4}-\d{2}-\d{2}$/.test(data.boughtOn || "")) { AUTO_MSG = "Add what you paid and the day you bought it."; autoMsgShow(); return true; }
    c.paid = paid; c.boughtOn = data.boughtOn; AUTO_MSG = ""; save(); showCar(c.id); render(); toast("💲 Value worked out"); return true; }
  if (f.dataset.afuel) { const c = carById(f.dataset.afuel), m = toMiles(data.miles), gal = num(data.gal); if (!c) return true;
    if (m == null || !gal) { AUTO_MSG = "Add the odometer and the gallons."; autoMsgShow(); return true; }
    const d = day(data.date); c.fuel.push({ id: uid(), date: d, miles: m, gal, cost: num(data.cost) });
    if (m > (c.miles || 0)) setMiles(c, m, d);
    AUTO_MSG = ""; save(); showCar(c.id, "fuel"); render(); toast("⛽ Fill-up added"); return true; }
  return false;
}

// VIN barcode on the door-jamb sticker / windshield (Code 39 or Data Matrix). Only offered where the browser has
// BarcodeDetector (Android Chrome); the photo is read on the phone and never sent anywhere.
document.addEventListener("change", async e => {
  const t = e.target; if (MODE !== "auto" || !t || !t.dataset || !t.dataset.avinscan || !t.files || !t.files[0]) return;
  const form = t.closest("form"), box = form && form.querySelector("[name=vin]");
  try {
    const bmp = await createImageBitmap(t.files[0]);
    const found = await new BarcodeDetector({ formats: ["code_39", "code_128", "data_matrix", "qr_code", "pdf417"] }).detect(bmp);
    const vin = vinFromCodes(found.map(x => x.rawValue));
    if (vin && box) { box.value = vin; AUTO_MSG = ""; toast(`📷 VIN ${vin} - tap Add to look it up`); } else { AUTO_MSG = "Couldn't find a VIN barcode in that photo. Get closer, or type it."; }
  } catch (err) { AUTO_MSG = "Couldn't read that photo. Type the VIN instead."; }
  t.value = ""; autoMsgShow();
});
// A VIN barcode often carries a leading "I" (import) or extra characters; keep the 17 VIN characters (no I, O, Q).
function vinFromCodes(codes) {
  for (const raw of codes) { const m = String(raw || "").toUpperCase().replace(/[^A-Z0-9]/g, "").match(/[A-HJ-NPR-Z0-9]{17}/); if (m) return m[0]; }
  return "";
}
