/* SAVE AS: auto.js · LOCATION: C:/MarvelApps/dayhub/auto.js
 * AUTO HUB (app #5 of the Hub family, Scott 2026-10-14: logo + "Auto Hub — Complete app concept", saved verbatim in
 * C:/MarvelDesktop/docs/AUTO_HUB_PLAN_FROM_OUTSIDE_CHAT_2026-10-14.md). Runs at /autohub/ with window.DH_MODE = "auto".
 * Release 1 (plan sections 1, 2, Fuel Hub, Safety Hub):
 *   - My Garage: each car its own page; VIN fills year / make / model / trim / engine from NHTSA vPIC (free, no key)
 *   - Smart Maintenance: due by miles OR months, whichever comes first, from the last time it was logged
 *   - Fuel: fill-ups -> MPG, cost per mile, fuel spend
 *   - Recalls: NHTSA recalls by year / make / model (free, no key); the owner ticks off ones already fixed
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
const AUTO_TABS = [["overview", "🚗", "Overview"], ["service", "🧰", "Service"], ["fuel", "⛽", "Fuel"], ["recalls", "⚠️", "Recalls"]];
let AUTO_OPEN = null, AUTO_TAB = "overview", AUTO_BUSY = false, AUTO_MSG = "";

const svc = k => AUTO_SERVICES.find(s => s[0] === k) || AUTO_SERVICES[AUTO_SERVICES.length - 1];
function garage() {
  if (!S.garage || typeof S.garage !== "object") S.garage = { cars: [] };
  if (!Array.isArray(S.garage.cars)) S.garage.cars = [];
  S.garage.cars.forEach(c => { ["services", "fuel", "odo"].forEach(k => { c[k] = Array.isArray(c[k]) ? c[k] : []; });
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
const toMiles = v => { const n = Number(String(v || "").replace(/[^\d.]/g, "")); return n >= 0 && n < 2000000 ? Math.round(n) : null; };

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
  return `<input name="vin" placeholder="VIN (17 characters, optional - fills in the rest)" maxlength="17" autocapitalize="characters" spellcheck="false" value="${esc(c.vin || "")}" aria-label="VIN">
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
  const recalls = cars.reduce((n, c) => n + openRecalls(c).length, 0);
  const dueHtml = due.length ? due.map(({ c, d }) => { const s = svc(d.key);
    return `<button class="row home-up" data-acar="${c.id}" data-atabgo="service"><span class="ci">${s[1]}</span><div class="grow"><b>${esc(s[2])}</b><span class="sub">${esc(carName(c))}</span></div>
      <span class="pill ${d.late ? "late" : d.soon ? "soon" : ""}">${dueWords(d)}</span></button>`; }).join("")
    : `<p class="fine" style="margin:0">Log your last oil change and we'll tell you when the next one is due.</p>`;
  return `<section class="card home-dash"><h3><span class="ci">🚗</span>My Garage<span class="meta">${cars.length} car${cars.length === 1 ? "" : "s"}</span></h3>
    <div class="body"><div class="home-grid">${cars.map(c => { const late = carDue(c, t).filter(d => d.late).length, rc = openRecalls(c).length;
      return `<button class="home-space" data-acar="${c.id}"><span class="hs-ic">🚗</span><b>${esc(carName(c))}</b><small>${c.miles != null ? miles(c.miles) + " mi" : "miles not set"}</small>
        ${late ? `<small>⏰ ${late} due</small>` : ""}${rc ? `<small>⚠️ ${rc} recall${rc === 1 ? "" : "s"}</small>` : ""}</button>`; }).join("")}
      <button class="home-space add" data-aaddcar="1"><span class="hs-ic">＋</span><b>Add</b><small>a car</small></button></div>
    ${recalls ? `<p class="fine" style="margin-top:8px">⚠️ ${recalls} open safety recall${recalls === 1 ? "" : "s"} across your cars. Recall repairs are free at the dealer.</p>` : ""}
    <p class="sub" style="margin:12px 0 6px"><b>⏰ Coming up</b></p>${dueHtml}</div></section>`;
}
function dueWords(d) {
  if (d.late) return d.leftMi != null && d.leftMi <= 0 ? `${miles(-d.leftMi)} mi over` : "due now";
  const bits = []; if (d.leftMi != null) bits.push(`${miles(d.leftMi)} mi`); if (d.dueDate) bits.push(prettyDate(d.dueDate));
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
        <span class="sub">Last ${prettyDate(d.last.date)}${d.last.miles != null ? ` at ${miles(d.last.miles)} mi` : ""}</span></div><span class="pill ${d.late ? "late" : d.soon ? "soon" : ""}">${dueWords(d)}</span></div>`; }).join("")}
      ${never.length ? `<p class="fine">Not logged yet: ${never.map(d => svc(d.key)[2]).join(", ")}. Log the last one and we'll work out the next.</p>` : ""}
      <form class="qa-form" data-aservice="${c.id}"><label class="field">What was done <select name="kind">${AUTO_SERVICES.map(([k, i, l]) => `<option value="${k}">${i} ${l}</option>`).join("")}</select></label>
        <div class="hpv-row"><input type="date" name="date" value="${t}" aria-label="Date"><input name="miles" inputmode="numeric" placeholder="Miles" value="${c.miles != null ? c.miles : ""}" aria-label="Miles">
        <input name="cost" inputmode="decimal" placeholder="Cost $" aria-label="Cost"></div>
        <input name="note" placeholder="Note or shop (optional)"><button class="btn sm">Log it</button></form>
      <p class="fine">Typical intervals: miles or months, whichever comes first. Your owner's manual wins.</p>
      ${hist.length ? `<p class="sub" style="margin-top:10px"><b>History</b></p>${hist.map(s => `<div class="row"><span class="ci">${svc(s.kind)[1]}</span><div class="grow">${esc(svc(s.kind)[2])}
        <span class="sub">${prettyDate(s.date)}${s.miles != null ? ` · ${miles(s.miles)} mi` : ""}${s.cost ? ` · ${money(s.cost)}` : ""}${s.note ? ` · ${esc(s.note)}` : ""}</span></div>
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
      ${hist.map(x => `<div class="row"><span class="ci">⛽</span><div class="grow">${prettyDate(x.date)} · ${miles(x.miles)} mi
        <span class="sub">${x.gal} gal${x.cost ? ` · ${money(x.cost)}` : ""}${mpgOf(x.id) ? ` · ${mpgOf(x.id).toFixed(1)} MPG` : ""}</span></div><button class="icon-btn" data-adel="fuel:${x.id}" aria-label="Remove">✕</button></div>`).join("")}`;
  }
  if (AUTO_TAB === "recalls") {
    if (AUTO_BUSY) return `<p class="fine">Checking the government recall list…</p>`;
    if (!c.recalls) return `<p class="fine" style="margin-top:0">Check for safety recalls on every ${esc([c.year, c.make, c.model].filter(Boolean).join(" ") || "car like yours")} (NHTSA, free).</p>
      <button class="btn" data-arecall="${c.id}">Check recalls</button>`;
    const list = c.recalls.list;
    return `<p class="fine" style="margin-top:0">${list.length} recall${list.length === 1 ? "" : "s"} for this year, make and model · checked ${prettyDate(c.recalls.at)}. Not every one applies to every car; your VIN at nhtsa.gov/recalls or the dealer confirms yours. Recall repairs are free.</p>
      ${list.map(r => `<div class="row"><button class="check" data-arfix="${esc(r.id)}" aria-label="Mark fixed">${c.recallDone[r.id] ? "✓" : "○"}</button><div class="grow"><b>${r.park ? "🚨 PARK IT - " : ""}${esc(r.part)}</b>
        <span class="sub">${esc(r.summary.slice(0, 220))}${r.summary.length > 220 ? "…" : ""}</span><span class="sub">Fix: ${esc(r.remedy.slice(0, 160))}${r.remedy.length > 160 ? "…" : ""} · #${esc(r.id)}</span></div></div>`).join("")}
      <div class="foot-actions"><button class="btn sm ghost" data-arecall="${c.id}">Check again</button><a class="btn sm ghost" href="https://www.nhtsa.gov/recalls" target="_blank" rel="noopener">Check my VIN at NHTSA</a></div>`;
  }
  const f = fuelStats(c), spent = c.services.reduce((n, s) => n + (s.cost || 0), 0);
  return `<div class="home-stats"><div class="home-stat"><b>${c.miles != null ? miles(c.miles) : "–"}</b><span>miles</span></div>
      <div class="home-stat"><b>${f.mpg ? f.mpg.toFixed(1) : "–"}</b><span>avg MPG</span></div><div class="home-stat"><b>${money(spent).replace(/\.00$/, "")}</b><span>service spend</span></div></div>
    <form class="qa-form" data-amiles="${c.id}" style="margin-top:10px"><div class="two"><input name="miles" inputmode="numeric" placeholder="Miles on it now" aria-label="Miles now"><button class="btn sm">Update miles</button></div></form>
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
    miles: null, services: [], fuel: [], odo: [], recallDone: {}, added: today() };
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
    if (kind === "service") c.services = c.services.filter(x => x.id !== id); else c.fuel = c.fuel.filter(x => x.id !== id);
    save(); showCar(c.id); render(); return true; }
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
  if (f.dataset.afuel) { const c = carById(f.dataset.afuel), m = toMiles(data.miles), gal = num(data.gal); if (!c) return true;
    if (m == null || !gal) { AUTO_MSG = "Add the odometer and the gallons."; autoMsgShow(); return true; }
    const d = day(data.date); c.fuel.push({ id: uid(), date: d, miles: m, gal, cost: num(data.cost) });
    if (m > (c.miles || 0)) setMiles(c, m, d);
    AUTO_MSG = ""; save(); showCar(c.id, "fuel"); render(); toast("⛽ Fill-up added"); return true; }
  return false;
}
