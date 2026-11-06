/* SAVE AS: hubconnect.js · LOCATION: C:/MarvelApps/dayhub/hubconnect.js
 * HUB CONNECTIONS (Scott's 11/04 Auto Hub list: "Hub Connections"; 11/05 "cont"). READ ONLY: Day Hub and Trip Hub read Auto Hub's
 * records from this phone (one web address = one phone storage on Android) and work them out with Auto Hub's own math (auto.js), so
 * the numbers are the same ones Auto Hub shows. Nothing is copied into another Hub and nothing is written to Auto Hub: fix a record
 * there and every Hub shows the fix, delete a car and it's gone everywhere, and nothing can count twice.
 *   - Day Hub: the Car card lists what Auto Hub says is coming due - its own "soon" (30 days or 500 miles) and papers within 30 days.
 *     Both looks: Day Hub's new look draws the same card on its Upkeep screen.
 *   - Trip Hub (any Hub with a road trip): "Your car" on the drive sheet gets Use my car, which fills MPG and the last gas price from
 *     Auto Hub's fill-ups. Nothing saves until Save car. Miles on a full tank isn't in Auto Hub's records, so it's left to the owner.
 *   - Auto Hub: a Hub Connections sheet (new look: More -> This App; classic: Settings -> Hub family) - which Hubs are on this phone
 *     and what each one picks up.
 *   - Money Hub already reads Auto Hub's costs (moneyviz.js mvFamily). It's listed on the sheet, not changed here.
 * SWITCH: ui.js HC_ON = false. While it's off only a phone holding Scott Hub or the owner mark loads this file (and auto.js where it
 * isn't loaded), so a customer downloads nothing new. Each Hub's own Settings -> Hub family switch (S.family) turns it off there.
 * Every value from Auto Hub's records is escaped where it's drawn: it may have come from a backup file.
 */
"use strict";
// id, phone storage key, icon, name, what it picks up from Auto Hub, its address
const HC_HUBS = [
  ["money", "moneyhub.v1", "💰", "Money Hub", "Gas, service and paper costs this month, shown beside your spending, never added in twice.", () => MONEYHUB_URL],
  ["day", "dayhub.v1", "☀️", "Day Hub", "Service and papers coming due, on the Car card beside your other upkeep.", () => BASE_URL],
  ["trip", "triphub.v1", "✈️", "Trip Hub", "Use my car on a road trip: your real MPG and your last gas price.", () => TRIP_URL],
  ["universe", "hubuniverse.v1", "🌌", "Hub Universe", "What needs you across every Hub, your cars included.", () => UNIVERSE_URL],
];
const HC_DAY = /^\d{4}-\d{2}-\d{2}$/;
const hcIsDay = v => typeof v === "string" && HC_DAY.test(v);   // a real "YYYY-MM-DD" string: an array holding one passes String() and broke a draw
let HC_RAW = null, HC_CARS = [], HC_SKIPPED = 0;

// Auto Hub's cars on this phone. In Auto Hub, its own garage; anywhere else, read from its saved data (parsed again only when it
// changes). Each list is made safe for auto.js's math the way garage() does it, on a copy - Auto Hub's data is never touched.
function hcCars() {
  if (MODE === "auto") return autoSet() ? garage().cars : [];
  let raw = null;
  try { raw = localStorage.getItem("autohub.v1"); } catch (e) { return []; }
  if (raw !== HC_RAW) {
    HC_RAW = raw; HC_CARS = [];
    try {
      const d = JSON.parse(raw || "null"), L = d && d.garage && Array.isArray(d.garage.cars) ? d.garage.cars : [];
      HC_CARS = L.filter(c => c && typeof c === "object" && !Array.isArray(c)).map(c => {
        const x = { ...c };
        ["services", "fuel", "odo", "papers"].forEach(k => { x[k] = Array.isArray(c[k]) ? c[k].filter(r => r && typeof r === "object" && !Array.isArray(r)) : []; });
        x.miles = typeof c.miles === "number" && isFinite(c.miles) ? c.miles : null;
        x.every = c.every && typeof c.every === "object" && !Array.isArray(c.every) ? c.every : null;
        return x;
      });
    } catch (e) { HC_CARS = []; }
  }
  return HC_CARS;
}

// "in 400 mi or by Dec 1", or Auto Hub's own "due now" / "300 mi over" once it's late.
const hcWords = d => d.late ? dueWords(d) : [d.leftMi != null && isFinite(d.leftMi) ? `in ${miles(d.leftMi)} mi` : "", hcIsDay(d.dueDate) ? `by ${aDate(d.dueDate)}` : ""].filter(Boolean).join(" or ") || "soon";
// What's coming due, soonest first: [{ icon, text, sub, day, late }]. Auto Hub's own rules: a service is "soon" inside 30 days or
// 500 miles, papers inside 30 days. A car's services and each of its papers are read on their own, so one odd record never hides
// the rest; HC_SKIPPED counts what couldn't be read, so the card never says "nothing due" over a record it didn't read.
function hcDue(onDay) {
  const out = []; HC_SKIPPED = 0;
  hcCars().forEach(c => {
    let nm = "My car";
    try { nm = carName(c); } catch (e) { /* the name stays plain */ }
    try {
      carDue(c, onDay).filter(d => d.late || d.soon).forEach(d => {
        const day = d.late ? onDay : addDays(onDay, Math.max(0, Math.min(400, Math.round(d.days))));
        out.push({ icon: svc(d.key)[1], text: `${svc(d.key)[2]} · ${nm}`, sub: hcWords(d), day, late: !!d.late });
      });
    } catch (e) { HC_SKIPPED++; }
    c.papers.filter(p => hcIsDay(p.expires) && p.expires <= addDays(onDay, 30)).forEach(p => {
      try {
        const n = daysUntil(p.expires);
        out.push({ icon: paper(p.kind)[1], text: `${String(p.name || "").trim() || paper(p.kind)[2]} · ${nm}`, day: p.expires, late: n < 0,
          sub: n < 0 ? `ran out ${aDate(p.expires)}` : n === 0 ? "runs out today" : `runs out ${n === 1 ? "tomorrow" : `in ${n} days`} · ${aDate(p.expires)}` });
      } catch (e) { HC_SKIPPED++; }
    });
  });
  return out.sort((a, b) => a.day.localeCompare(b.day));
}

// Day Hub: the rows under the Car card, and how many are inside 14 days for the card's "coming up".
function hcAutoRows() {
  if (MODE === "auto" || !hcOn()) return "";
  const cars = hcCars(); if (!cars.length) return "";
  const L = hcDue(today()), missed = HC_SKIPPED;
  return `<div class="hc-from" data-hc="auto"><div class="day-label" style="margin-top:10px">🔗 From Auto Hub</div>
    ${L.slice(0, 8).map(x => `<div class="row ${x.late ? "late" : ""}"><span class="grow"><b>${x.icon} ${esc(x.text)}</b><span class="sub">${esc(x.sub)}</span></span></div>`).join("")}
    ${missed ? `<div class="sub" data-hcmissed="${missed}">⚠️ Couldn't read all of Auto Hub's records here. Open Auto Hub to see everything that's due.</div>`
      : !L.length ? `<div class="sub">✅ Nothing due on your ${cars.length === 1 ? "car" : "cars"} in the next 30 days.</div>` : ""}
    <p class="fine">Read from Auto Hub on this phone, not copied. Log it in Auto Hub and it shows here.</p>
    <a class="btn sm ghost" href="${esc(hubHref(AUTOHUB_URL))}" data-famopen="1" style="margin-top:6px">🚗 Open Auto Hub</a></div>`;
}
function hcAutoSoon() {
  if (MODE === "auto" || !hcOn()) return 0;
  try { return hcDue(today()).filter(x => daysUntil(x.day) <= 14).length; } catch (e) { return 0; }
}

// Trip Hub: MPG from Auto Hub's fill-ups (its fuelStats) and the last fill-up's price a gallon. null until there's an MPG.
function hcCarFill(c) {
  const f = fuelStats(c);
  if (!(f.mpg > 0) || !isFinite(f.mpg) || f.mpg > 150) return null;
  const last = c.fuel.filter(x => +x.gal > 0 && +x.cost > 0 && hcIsDay(x.date)).sort((a, b) => a.date.localeCompare(b.date)).pop();
  const gas = last ? +last.cost / +last.gal : 0;
  return { mpg: Math.round(f.mpg * 10) / 10, gas: gas > 0 && gas < 20 ? Math.round(gas * 100) / 100 : 0, gasDay: gas > 0 && gas < 20 ? last.date : "" };
}
function hcCarButtons() {
  if (!hcOn()) return "";
  try {                               // the drive sheet must always open, whatever Auto Hub's records hold
    const L = hcCars().map(c => { try { return { f: hcCarFill(c), n: carName(c) }; } catch (e) { return { f: null }; } }).filter(x => x.f).slice(0, 3);
    if (!L.length) return "";
    return `<div class="hc-use" style="display:flex;flex-wrap:wrap;gap:6px;margin:4px 0 8px">${L.map(({ f, n }) =>
        `<button type="button" class="btn sm ghost" data-hcuse="${f.mpg}|${f.gas}">🚗 Use my ${esc(n)} · ${f.mpg} mpg${f.gas ? ` · $${f.gas.toFixed(2)} gas` : ""}</button>`).join("")}
      <p class="fine" style="margin:0;width:100%">From your fill-ups in Auto Hub: the MPG and the last price you paid for gas. Miles on a full tank isn't in Auto Hub, so fill that in yourself.</p></div>`;
  } catch (e) { return ""; }
}

// Auto Hub: the Hub Connections sheet.
function hcShow() {
  let el = document.getElementById("hcSheet");
  if (!el) { el = document.createElement("div"); el.id = "hcSheet"; el.className = "sheet"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "Hub Connections"); document.body.appendChild(el); }
  const peek = k => { try { const r = localStorage.getItem(k); if (!r) return null; const d = JSON.parse(r); return d && typeof d === "object" ? d : {}; } catch (e) { return null; } };
  const cars = hcCars().length;
  el.innerHTML = `<div class="sheet-body"><div class="grab"></div>
    <div class="sheet-head"><h2>🔗 Hub Connections</h2><button class="icon-btn" data-hcclose="1" aria-label="Close">✕</button></div>
    <p class="fine" style="margin-top:0">Your other Hubs read your car records from here. They never copy or change them, so a fix here shows everywhere and nothing counts twice.</p>
    ${HC_HUBS.map(([id, key, ic, name, what, url]) => { const d = peek(key), tag = !d ? "" : d.family === false ? "TURNED OFF THERE" : "ON THIS PHONE ✓";
      return `<div class="row" data-hchub="${id}"><span class="ci">${ic}</span><div class="grow"><b>${name}</b>${tag ? ` <span class="tag">${tag}</span>` : ""}<span class="sub">${what}</span></div>
        <a class="btn sm ghost" href="${esc(hubHref(url()))}" data-famopen="1">Open</a></div>`; }).join("")}
    <p class="fine">${cars ? `${cars} car${cars === 1 ? "" : "s"} shared.` : "Add a car and your other Hubs pick it up."} This works when your Hubs share this phone's browser, as on Android. iPhone home-screen apps keep their own storage, so they can't see each other. To stop one Hub reading, turn off Settings → Hub family in that Hub.</p></div>`;
  el.classList.remove("hidden");
}
const hcHide = () => { const el = document.getElementById("hcSheet"); if (el) el.classList.add("hidden"); };

document.addEventListener("click", e => {
  const b = e.target && e.target.closest && e.target.closest("[data-hcuse],[data-hcopen],[data-hcclose]"); if (!b) return;
  if (b.dataset.hcuse !== undefined) {
    const body = b.closest(".sheet-body"), f = body && body.querySelector("form[data-vehicle]"); if (!f) return;
    const [mpg, gas] = b.dataset.hcuse.split("|").map(Number);
    if (mpg > 0 && f.mpg) f.mpg.value = mpg;
    if (gas > 0 && f.gas) f.gas.value = gas;
    toast("🚗 Filled in from Auto Hub. Tap Save car to keep it."); return;
  }
  if (b.dataset.hcopen) { const st = document.getElementById("sheet"); if (st && !st.classList.contains("hidden") && typeof closeSettings === "function") closeSettings(); hcShow(); return; }
  if (b.dataset.hcclose) hcHide();
});
