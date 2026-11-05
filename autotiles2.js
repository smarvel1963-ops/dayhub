/* SAVE AS: autotiles2.js · LOCATION: C:/MarvelApps/dayhub/autotiles2.js
 * AUTO HUB NEW LOOK, PART 2 (Scott 11/05: "build that auto hub we were working on till its done"). The screens his boards didn't draw but his list asks for,
 * in the same master look: Maintenance Calendar, Reminders Center, Records Package, Sell My Car, Sold Car + Archive, Tires & Battery, Car Facts, Fuel Analytics,
 * Compare Cars, Import & Export, Warranty Tracker, Health History, What Is My Car Costing Me?, Expenses, My Glovebox, All Cars, Data & Backup.
 * Loaded by autohub/index.html right after autotiles.js. Reached only through the new look (atOn()), so customers see none of it while AT_ON is false.
 * New stored data, all on the car or the garage and all in the backup: c.facts, c.sellCheck, c.sold + garage().sold, garage().alerts, paper.limitMiles + paper.start.
 * Estimates are always called estimates, and nothing here claims to read the car. Hub Connections is NOT here: it means changing the other Hubs, a separate go.
 */
"use strict";

Object.assign(AI, {
  cal: AT_SVG('<rect x="4" y="5" width="16" height="16" rx="2"/><path d="M4 10h16M8 3v4M16 3v4M8 14h2M14 14h2M8 18h2"/>'),
  compare: AT_SVG('<path d="M5 20V10M12 20V4M19 20v-7"/>'),
  archive: AT_SVG('<rect x="3" y="4" width="18" height="5" rx="1"/><path d="M5 9v11h14V9M10 13h4"/>'),
  search: AT_SVG('<circle cx="11" cy="11" r="6.500"/><path d="M16 16l5 5"/>'),
  download: AT_SVG('<path d="M12 4v11M7.500 10.500L12 15l4.500-4.500M4 19h16"/>'),
  glove: AT_SVG('<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 11h18M10 11v2.500h4V11"/>'),
  heart: AT_SVG('<path d="M3 12h4l2-4 3 8 2-5 1 1h6"/>'),
});
const atNum = v => { const n = Number(String(v == null ? "" : v).replace(/[^\d.]/g, "")); return n > 0 ? Math.round(n * 100) / 100 : 0; };
const atIsDay = d => /^\d{4}-\d{2}-\d{2}$/.test(d || "");
const atPlain = (v, n) => String(v == null ? "" : v).trim().slice(0, n);
const atMonthsBack = t => { const out = []; for (let i = 11; i >= 0; i--) { const d = parseDay(t); d.setDate(1); d.setMonth(d.getMonth() - i); out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`); } return out; };
const atMonthsAhead = t => { const out = []; for (let i = 0; i < 12; i++) { const d = parseDay(t); d.setDate(1); d.setMonth(d.getMonth() + i); out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`); } return out; };
const atMonShort = m => parseDay(m + "-01").toLocaleDateString("en-US", { month: "short" }).slice(0, 3);
const atMonLong = m => parseDay(m + "-01").toLocaleDateString("en-US", { month: "long", year: "numeric" });
function atBars(vals, months, what) {
  const top = Math.max(1, ...vals);
  return `<div class="at-barwrap"><div class="at-baraxis" aria-hidden="true"><small>${m0(top)}</small><small>${m0(top / 2)}</small><small>$0</small></div><div class="at-bars" role="img" aria-label="${esc(what)}, highest ${m0(top)}">${vals.map((v, i) => `<span><i style="height:${Math.round(v / top * 100)}%"></i><small>${atMonShort(months[i])}</small></span>`).join("")}</div></div>`;
}
// The "which car" chips for the screens that can also show every car at once.
const atPickCars = () => { const cars = garage().cars, one = cars.find(c => c.id === AT.pick); return one ? [one] : cars; };
function atPicker() {
  const cars = garage().cars; if (cars.length < 2) return "";
  const on = cars.some(c => c.id === AT.pick) ? AT.pick : "all";
  return `<div class="at-chips"><button class="${on === "all" ? "on" : ""}" data-atpick="all">All Cars</button>${cars.map(c => `<button class="${on === c.id ? "on" : ""}" data-atpick="${esc(c.id)}">${esc(atShort(c))}</button>`).join("")}</div>`;
}
function atDownload(name, text, type) {
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
}

// ---- MAINTENANCE CALENDAR: the next 12 months, worked out from the car's own log and its own driving. Costs are what you paid last time.
function atLastCost(c, key) { const s = c.services.filter(x => x.kind === key && x.cost > 0).sort((a, b) => b.date.localeCompare(a.date))[0]; return s ? s.cost : 0; }
function atForecast(cars, t) {
  const end = addDays(t, 365), out = [];
  cars.forEach(c => {
    const perDay = Math.max(1, milesPerDay(c));
    AUTO_SERVICES.forEach(s => { const [mi, mo] = intervalOf(c, s[0]); if (!mi && !mo) return;
      const d = serviceDue(c, s[0], t); if (!d.logged || !isFinite(d.days)) return;
      const cost = atLastCost(c, s[0]), step = Math.max(14, Math.min(mi ? Math.round(mi / perDay) : 1e6, mo ? Math.round(mo * 30.44) : 1e6));
      let day = d.days < 0 ? t : addDays(t, d.days), n = 0;
      while (day <= end && n < 24) { out.push({ c, day, ic: AT_SVC_IC[s[0]] || "wrench", text: s[2], cost, late: n === 0 && !!d.late, tab: "service" }); day = addDays(day, step); n++; } });
    c.papers.filter(x => x.kind !== "warranty" && atIsDay(x.expires) && x.expires <= end).forEach(x => out.push({ c, day: x.expires < t ? t : x.expires, ic: AT_PAPER_IC[x.kind] || "doc", text: `${x.name || paper(x.kind)[2]} renewal`, cost: x.cost || 0, late: x.expires < t, tab: "papers" }));
  });
  return out.sort((a, b) => a.day.localeCompare(b.day) || a.text.localeCompare(b.text));
}
function atCalendar() {
  const t = today(), cars = atPickCars(), rows = atForecast(cars, t), months = atMonthsAhead(t), inM = m => rows.filter(r => r.day.startsWith(m));
  const vals = months.map(m => inM(m).reduce((n, r) => n + r.cost, 0)), total = vals.reduce((a, b) => a + b, 0), noPrice = rows.filter(r => !r.cost).length, many = garage().cars.length > 1 && cars.length > 1;
  return atHead("Maintenance Calendar", "cal") + atPicker() + `<section class="at-card"><small class="at-k">Projected, Next 12 Months</small><b class="at-total">${m0(total)}</b>${atBars(vals, months, "Projected cost each of the next 12 months")}
      <p class="at-note">An estimate from what you paid last time and how much you drive.${noPrice ? ` ${noPrice} item${noPrice === 1 ? " has" : "s have"} no price yet.` : ""}</p></section>
    ${months.map(m => { const L = inM(m); return L.length ? `<p class="at-seclabel">${esc(atMonLong(m))}</p><section class="at-list">${L.map(r => `<button class="at-up at-calrow" ${atCarGo(r.c, r.tab)}><span class="at-ric">${AI[r.ic]}</span><span class="grow"><b>${esc(r.text)}</b><small>${aDate(r.day)}${many ? ` · ${esc(atShort(r.c))}` : ""}</small></span>${r.late ? atPill("Overdue", "late") : r.cost ? `<b class="at-amt">≈ ${m0(r.cost)}</b>` : ""}</button>`).join("")}</section>` : ""; }).join("") || `<p class="at-note">Nothing on the calendar yet. Log your last service, and the next 12 months fill in by themselves.</p>`}
    <p class="at-note">Not on here until you log it once: ${esc(AUTO_SERVICES.filter(s => s[0] !== "other" && cars.every(c => !c.services.some(x => x.kind === s[0]))).map(s => s[2]).join(", ")) || "nothing, every service has a record"}.</p>`;
}

// ---- REMINDERS CENTER. The alerts are real phone alerts (app.js reminderList calls atReminders), and only under the new look.
const atAlerts = () => { const g = garage(); if (!g.alerts || typeof g.alerts !== "object") g.alerts = {}; if (!g.alerts.seen || typeof g.alerts.seen !== "object") g.alerts.seen = {}; return g.alerts; };
// "at" is the bill hour, or within the last hour so a phone opened late still says it. Each alert says so once, for good: S.remind.fired forgets after 4 days, A.seen doesn't.
function atReminders(add) {
  if (!atOn() || !autoSet()) return;
  const A = atAlerts(), t = today(), end = atMs(t, "23:59"), at = Math.max(atMs(t, S.remind.billHour), Date.now() - 3600000), step = (left, marks) => marks.find(n => left <= n && left > n - 3);
  const fresh = key => { if (S.remind.fired[key]) A.seen[key] = 1; return !A.seen[key]; };
  const seen = Object.keys(A.seen); if (seen.length > 400) seen.slice(0, 100).forEach(k => delete A.seen[k]);
  garage().cars.forEach(c => {
    if (A.service !== false) carDue(c, t).forEach(d => { const hit = step(d.days, [14, 3, 0, -7, -30]); if (hit === undefined) return;
      const key = `car:svc:${c.id}:${d.key}:${d.last.date}:${hit}`; if (fresh(key)) add(key, end, at, `${svc(d.key)[1]} ${svc(d.key)[2]} ${d.late ? "is due" : "is coming up"}`, `${carName(c)}: ${dueWords(d)}`); });
    if (A.papers !== false) c.papers.filter(x => atIsDay(x.expires)).forEach(x => { const left = daysUntil(x.expires), hit = step(left, [30, 7, 1, -7]); if (hit === undefined) return;
      const key = `car:pap:${x.id}:${x.expires}:${hit}`; if (fresh(key)) add(key, end, at, `${paper(x.kind)[1]} ${x.name || paper(x.kind)[2]} ${left < 0 ? "has expired" : left === 0 ? "expires today" : `expires ${aDate(x.expires)}`}`, carName(c)); });
    if (A.recalls !== false) openRecalls(c).forEach(r => {
      const key = r.park ? `car:rec:${c.id}:${r.id}:${Math.floor(parseDay(t) / (7 * 86400000))}` : `car:rec:${c.id}:${r.id}`;        // a PARK IT recall says so once a week, any other once
      if (fresh(key)) add(key, end, at, r.park ? `🚨 Safety recall: park the ${carName(c)}` : `⚠️ Recall on the ${carName(c)}`, `${r.part}. The dealer fixes it free.`); });
  });
}
function atIcsText(rows) {
  const clean = v => String(v).replace(/[\\;,]/g, m => "\\" + m).replace(/[\r\n]+/g, " ").slice(0, 120), stamp = new Date().toISOString().replace(/[-:]|\.\d+/g, "");
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Marvel Corp//Auto Hub//EN", ...rows.flatMap((r, i) => { const d = r.day.replace(/-/g, ""), next = addDays(r.day, 1).replace(/-/g, "");
    return ["BEGIN:VEVENT", `UID:autohub-${d}-${i}@marvelcorp`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${d}`, `DTEND;VALUE=DATE:${next}`, `SUMMARY:${clean(`${r.text}: ${carName(r.c)}`)}`, "END:VEVENT"]; }), "END:VCALENDAR"].join("\r\n");
}
function atRemindersPage() {
  const A = atAlerts(), on = !!S.remind.on, cars = garage().cars, T = [["service", "wrench", "Service", "Oil, brakes, tires and everything you've logged"], ["papers", "shield", "Insurance, Registration & Papers", "As the dates get close"], ["recalls", "triangle", "Recalls", "When a check finds an open one"]];
  return atHead("Reminders", "bell") + `<section class="at-card glowline"><div class="at-cardhead">${AI.bell}<b>Phone Alerts</b>${atPill(on ? "On" : "Off", on ? "ok" : "soon")}</div>
      <p class="at-note">Auto Hub checks while it's open and each time you open it. It can't alert you while it's fully closed.</p><button class="at-ghost" data-atset="remindBox">${on ? "Alert Settings" : "Turn On Alerts"}</button></section>
    <p class="at-seclabel">Alert Me About</p><section class="at-list">${T.map(([k, ic, l, s]) => `<button class="at-row at-togglerow" data-atalert="${k}" role="switch" aria-checked="${A[k] !== false}"><span class="at-ric">${AI[ic]}</span><span class="grow"><b>${esc(l)}</b><small>${esc(s)}</small></span><i class="at-switch ${A[k] !== false ? "on" : ""}" aria-hidden="true"></i></button>`).join("")}</section>
    <p class="at-seclabel">Coming Up</p><section class="at-card">${atUpcoming(cars, 0)}</section>
    <button class="at-ghost" data-aticsall="1">${AI.cal}Add These Dates to My Calendar</button><p class="at-note">Saves the next 12 months as a calendar file your phone can open. It's a one-time copy; it won't update by itself.</p>`;
}

// ---- WHAT IS MY CAR COSTING ME? What you logged and what's only an estimate stay apart, on purpose.
function atCostingNums(c, t) {
  const o = ownCost(c, t), v = carValue(c, t); let drop = null;
  if (v) { const months = Math.max(1, (parseDay(t) - parseDay(c.boughtOn)) / (30.44 * 86400000)), was = months >= 12 ? carValue(c, addDays(t, -365)) : null;
    drop = Math.max(0, was ? (was.est - v.est) / 12 : (c.paid - v.est) / months); }
  return { service: o.service / 12, fuel: o.fuel / 12, papers: o.papers / 12, recorded: o.month, drop, perMile: o.perMile };
}
function atCosting(c) {
  const n = atCostingNums(c, today()), all = n.recorded + (n.drop || 0), pct = x => all ? Math.round(x / all * 100) : 0;
  const line = (cls, l, v, s) => `<div class="at-costline2"><i class="at-dot ${cls}"></i><span class="grow"><b>${esc(l)}</b>${s ? `<small>${esc(s)}</small>` : ""}</span><b>${m0(v)}</b></div>`;
  return atHead("What's My Car Costing Me?", "coin") + atCarPick(c) + `<section class="at-card glow"><small class="at-k">About Each Month</small><b class="at-range">${m0(all)}</b>${n.drop != null ? `<p class="at-note">${m0(n.recorded)} you logged, plus about ${m0(n.drop)} of estimated value lost.</p>` : `<p class="at-note">What you logged in the last 12 months, shared over 12 months.</p>`}
      <div class="at-stack" role="img" aria-label="Service ${pct(n.service)} percent, fuel ${pct(n.fuel)} percent, papers ${pct(n.papers)} percent, estimated value lost ${pct(n.drop || 0)} percent"><i class="s" style="width:${pct(n.service)}%"></i><i class="f" style="width:${pct(n.fuel)}%"></i><i class="p" style="width:${pct(n.papers)}%"></i><i class="d" style="width:${pct(n.drop || 0)}%"></i></div></section>
    <p class="at-seclabel">Recorded <small>(from your own log)</small></p><section class="at-card">${line("s", "Maintenance", n.service, "per month")}${line("f", "Fuel", n.fuel, "per month")}${line("p", "Papers", n.papers, "Insurance, registration and the like")}</section>
    <p class="at-seclabel">Estimated <small>(a rough guess)</small></p><section class="at-card">${n.drop != null ? line("d", "Value Lost", n.drop, "From what you paid and a usual yearly drop. Not a dealer quote.") : `<p class="at-note">Add what you paid and the day you bought it, and the estimated value lost shows here.</p><button class="at-ghost" data-atsegto="overview:value" data-atcar="${esc(c.id)}">Add What You Paid</button>`}</section>
    ${n.perMile ? `<p class="at-note">That's ${money(n.perMile)} a mile in logged costs.</p>` : ""}<p class="at-note">Extras, the purchase price and any loan interest aren't in the logged costs.</p>${atRow("trend", "All Your Expenses", "Every cost, by month", 'data-atgo="expenses"')}`;
}

// ---- EXPENSES: every logged cost, one place.
function atExpenseRows(cars) {
  const R = [];
  cars.forEach(c => {
    c.services.forEach(x => { if (x.cost > 0) R.push({ c, date: x.date, kind: "service", ic: AT_SVC_IC[x.kind] || "wrench", text: svc(x.kind)[2], amt: x.cost, sub: x.note }); });
    c.fuel.forEach(x => { if (x.cost > 0) R.push({ c, date: x.date, kind: "fuel", ic: "fuel", text: `Fill-up, ${x.gal} gal`, amt: x.cost, sub: "" }); });
    c.papers.forEach(x => { if (x.cost > 0 && atIsDay(x.paid)) R.push({ c, date: x.paid, kind: "papers", ic: AT_PAPER_IC[x.kind] || "doc", text: x.name || paper(x.kind)[2], amt: x.cost, sub: paper(x.kind)[2] }); });
    c.extras.forEach(x => { if (x.cost > 0 && x.status === "installed" && atIsDay(x.date)) R.push({ c, date: x.date, kind: "extras", ic: "box", text: x.name, amt: x.cost, sub: xcat(x.cat)[2] }); });
  });
  return R.filter(r => atIsDay(r.date)).sort((a, b) => b.date.localeCompare(a.date));
}
function atExpenses() {
  const t = today(), kind = AT.xkind || "all", cars = atPickCars(), many = cars.length > 1, from = addDays(t, -365), all = atExpenseRows(cars).filter(r => kind === "all" || r.kind === kind), yr = all.filter(r => r.date > from && r.date <= t);
  const months = atMonthsBack(t), vals = months.map(m => yr.filter(r => r.date.startsWith(m)).reduce((n, r) => n + r.amt, 0)), total = yr.reduce((n, r) => n + r.amt, 0), shown = all.slice(0, 60);
  return atHead("Expenses", "coin") + atPicker() + `<div class="at-chips">${[["all", "All"], ["service", "Service"], ["fuel", "Fuel"], ["papers", "Papers"], ["extras", "Extras"]].map(([k, l]) => `<button class="${kind === k ? "on" : ""}" data-atxkind="${k}">${l}</button>`).join("")}</div>
    <section class="at-card"><small class="at-k">Last 12 Months</small><b class="at-total">${m0(total)}</b>${atBars(vals, months, "Spending each of the last 12 months")}</section>
    ${shown.length ? `<section class="at-card">${shown.map(r => `<div class="at-hist"><span class="at-ric">${AI[r.ic]}</span><span class="grow"><b>${esc(r.text)}</b><small>${aDate(r.date)}${many ? ` · ${esc(atShort(r.c))}` : ""}${r.sub ? ` · ${esc(r.sub)}` : ""}</small></span><b class="at-amt">${money(r.amt)}</b></div>`).join("")}${all.length > shown.length ? `<p class="at-note">The latest ${shown.length} of ${all.length}. The spreadsheet has them all.</p>` : ""}</section>` : `<p class="at-note">Costs show here as you log them.</p>`}
    <button class="at-ghost" data-atcsv="1">${AI.download}Export Spreadsheet</button>`;
}

// ---- SPREADSHEET OUT and RECORDS IN. A cell that starts like a formula gets a leading ' so a note can never run as a formula in a spreadsheet.
const atCsvCell = v => { let s = String(v == null ? "" : v); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
function atCsvText(cars) {
  const R = [["Car", "Type", "Date", "Miles", "Item", "Gallons", "Cost", "Note"]];
  cars.forEach(c => { const n = carName(c);
    c.services.forEach(x => R.push([n, "Service", x.date, x.miles, svc(x.kind)[2], "", x.cost || "", x.note]));
    c.fuel.forEach(x => R.push([n, "Fill-up", x.date, x.miles, "Fuel", x.gal, x.cost || "", ""]));
    c.papers.forEach(x => R.push([n, "Paper", x.paid || "", "", x.name || paper(x.kind)[2], "", x.cost || "", x.expires ? `Good to ${x.expires}` : ""]));
    c.extras.forEach(x => R.push([n, x.status === "installed" ? "Extra" : "Wishlist", x.date || "", x.miles, x.name, "", x.cost || "", x.note]));
    c.notes.forEach(x => R.push([n, "Note", x.date, "", x.text, "", "", ""])); });
  return "\ufeff" + R.map(r => r.map(atCsvCell).join(",")).join("\r\n");
}
function atCsvRows(text) {               // quoted fields, commas and line breaks inside quotes
  const rows = []; let row = [], cell = "", q = false; const s = String(text).replace(/^\ufeff/, "");
  for (let i = 0; i < s.length; i++) { const ch = s[i];
    if (q) { if (ch === '"') { if (s[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; }
    else if (ch === '"') q = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && s[i + 1] === "\n") i++; row.push(cell); cell = ""; if (row.some(x => x.trim())) rows.push(row); row = []; if (rows.length > 3001) break; }
    else cell += ch; }
  row.push(cell); if (row.some(x => x.trim()) && rows.length <= 3001) rows.push(row);
  return rows;
}
const atCsvDay = v => { const s = String(v || "").trim(); let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/); if (m) m = [m[1], m[2], m[3]];
  else { const x = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\b/); if (!x) return ""; m = [x[3].length === 2 ? "20" + x[3] : x[3], x[1], x[2]]; }
  const [y, mo, d] = m.map(Number); if (mo < 1 || mo > 12 || d < 1 || d > 31 || y < 1950 || y > 2100) return ""; return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`; };
const AT_KIND_WORDS = [[/^oil$|\boil\s*(change|&|and|service|filter)|\blube\b/i, "oil"], [/\brotat/i, "rotate"], [/\bbrakes?\b/i, "brakes"], [/\bcabin\b/i, "cabin"], [/\bair filter|engine air/i, "air"], [/\bbatter(y|ies)\b/i, "battery"], [/\bwipers?\b/i, "wipers"], [/\binspect|\bemissions?\b|\bsmog\b/i, "inspect"], [/\bcoolant\b|\bantifreeze\b/i, "coolant"], [/\btransmission\b/i, "trans"], [/\bspark plugs?\b/i, "plugs"], [/\bnew tires?\b|\btires? replac|\breplac\w* tires?\b|\bset of tires\b|^tires?$/i, "tires"]];
// -> { fuel, services, skipped, dupes }. Nothing is saved here; the owner sees the counts and taps Add.
function atCsvRead(text, c) {
  const rows = atCsvRows(text); if (rows.length < 2) return null;
  const head = rows[0].map(h => String(h).trim().toLowerCase()), col = (...res) => { for (const re of res) { const i = head.findIndex(h => re.test(h) && !/\bper\b|unit/.test(h)); if (i >= 0) return i; } return -1; };
  const iDate = col(/date|^day$/), iMiles = col(/odometer|^odo\b|mileage|^miles?\b/), iGal = col(/gallons?|\bgal\b/, /volume|quantity|fuel amount/), iLit = col(/lit(er|re)s?/), iCost = col(/total/, /cost/, /amount/, /paid/), iPrice = col(/price/), iPerGal = head.findIndex(h => /price|cost/.test(h) && /\bper\b|unit/.test(h)), iType = col(/service|description|item|work|title|^type$|category/), iNote = col(/note|comment|memo|shop|location|station/);
  if (iDate < 0) return null;
  const out = { fuel: [], services: [], skipped: 0, dupes: 0 }, seenF = new Set(c.fuel.map(x => `${x.date}|${x.miles}`)), skey = (date, kind, note) => `${date}|${kind}${kind === "other" ? `|${note}` : ""}`, seenS = new Set(c.services.map(x => skey(x.date, x.kind, x.note)));
  rows.slice(1, 3001).forEach(r => { const at = i => i >= 0 ? String(r[i] == null ? "" : r[i]).trim() : "", date = atCsvDay(at(iDate)); if (!date) { out.skipped++; return; }
    const m = toMiles(at(iMiles)), gal = atNum(at(iGal)) || Math.round(atNum(at(iLit)) * 0.264172 * 100) / 100, what = at(iType), note = at(iNote), price = atNum(at(iPrice)), perGal = atNum(at(iPerGal)), cost = atNum(at(iCost)) || (gal > 0 && perGal ? Math.round(perGal * gal * 100) / 100 : gal > 0 && price > 0 && price < 20 ? Math.round(price * gal * 100) / 100 : price);
    if (gal > 0 && m != null) { const k = `${date}|${m}`; if (seenF.has(k)) { out.dupes++; return; } seenF.add(k); out.fuel.push({ date, miles: m, gal, cost }); return; }
    if (!what || (/\bfuel\b|\bgas\b|\bgasoline\b|\bfill[- ]?up\b|\brefuel/i.test(what) && !/pump|filter|injector|line|tank|cap/i.test(what))) { out.skipped++; return; }
    const hit = AT_KIND_WORDS.find(([re]) => re.test(what)), kind = hit ? hit[1] : "other", words = [what, note].filter(Boolean).join(" · ").slice(0, 120), k = skey(date, kind, words); if (seenS.has(k)) { out.dupes++; return; } seenS.add(k);
    out.services.push({ date, kind, miles: m, cost, note: words }); });
  return out;
}
const atCsvLatest = r => { const pts = [...r.fuel, ...r.services].filter(x => x.miles != null).sort((a, b) => a.date.localeCompare(b.date) || a.miles - b.miles); return pts[pts.length - 1] || null; };
function atCsvAdd(c, r) {
  r.fuel.forEach(x => c.fuel.push({ id: uid(), date: x.date, miles: x.miles, gal: x.gal, cost: x.cost }));
  r.services.forEach(x => c.services.push({ id: uid(), kind: x.kind, date: x.date, miles: x.miles, cost: x.cost, note: x.note }));
  const last = atCsvLatest(r);
  if (last && last.miles > (c.miles || 0)) setMiles(c, last.miles, last.date);
  return r.fuel.length + r.services.length;
}
function atImpex(c) {
  const r = AT.csv;
  return atHead("Import & Export", "upload") + `<p class="at-seclabel">Export</p><section class="at-list">${atRow("download", "Spreadsheet", "Every record for every car", 'data-atcsv="1"')}${atRow("doc", "Full Records PDF", "A clean report for this car", 'data-atgo="records"')}${atRow("cloud", "Backup File", "Everything, to keep or move to a new phone", 'data-data="export"')}</section>
    <p class="at-seclabel">Import</p>${atCarPick(c)}<section class="at-card"><b>From Another App</b><p class="at-note">Export a spreadsheet (CSV) from your old app and load it here. Auto Hub reads date, odometer, gallons, cost and the service name, and shows you what it found before anything is added.</p>
      ${r && r.car === c.id ? `<div class="at-kv"><span>Fill-ups found</span><b>${r.fuel.length}</b></div><div class="at-kv"><span>Services found</span><b>${r.services.length}</b></div><div class="at-kv"><span>Already in Auto Hub</span><b>${r.dupes}</b></div><div class="at-kv"><span>Couldn't read</span><b>${r.skipped}</b></div>${(() => { const top = atCsvLatest(r); return top && top.miles > (c.miles || 0) ? `<div class="at-kv"><span>Miles would go to</span><b>${miles(top.miles)}</b></div>${atMilesWarn(c, top.miles, true) ? `<p class="at-note warn">${esc(atMilesWarn(c, top.miles, true))}</p>` : ""}` : ""; })()}
        <ul class="at-csvlist">${[...r.fuel.slice(0, 4).map(x => `${x.date} · ${miles(x.miles)} mi · ${x.gal} gal${x.cost ? ` · ${money(x.cost)}` : ""}`), ...r.services.slice(0, 4).map(x => `${x.date} · ${svc(x.kind)[2]}${x.kind === "other" ? "" : ` · ${x.note}`}${x.kind === "other" ? ` · ${x.note}` : ""}`)].map(x => `<li>${esc(x)}</li>`).join("")}${r.fuel.length + r.services.length > 8 ? `<li>and more</li>` : ""}</ul>
        <button class="at-big" data-atcsvadd="1" ${r.fuel.length + r.services.length ? "" : "disabled"}>Add ${r.fuel.length + r.services.length} to ${esc(atShort(c))}</button><button class="at-ghost" data-atcsvcancel="1">Cancel</button>` : `<label class="at-big">${AI.upload}Choose a CSV File<input type="file" accept=".csv,text/csv" data-atcsvfile="${esc(c.id)}" hidden></label>`}
      ${atMsg()}</section>${atRow("upload", "Load a Backup File", "Replaces what's on this phone", 'data-atset="dataBox"')}`;
}

// ---- RECORDS PACKAGE: the buyer-ready report. Owner-entered, and it says so.
const atSafePic = v => /^data:image\/[a-z]+;base64,[A-Za-z0-9+/=]+$/.test(v || "") ? v : "";
function atRecordsHtml(c, opt, cover, receipts) {
  const e = esc, f = fuelStats(c), done = c.services.slice().sort((a, b) => b.date.localeCompare(a.date)), inst = c.extras.filter(x => x.status === "installed"), spent = c.services.reduce((n, x) => n + (x.cost || 0), 0), name = [c.year, c.make, c.model].filter(Boolean).join(" ") || "Vehicle";
  const tile = (v, l) => `<div class="t"><b>${e(v)}</b><span>${e(l)}</span></div>`, tr = c.recalls ? c.recalls.list : [], pic = atSafePic(cover), recs = (receipts || []).map(atSafePic).filter(Boolean);
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${e(name)} - vehicle records</title><style>
body{font:14px/1.45 -apple-system,"Segoe UI",Roboto,Arial,sans-serif;color:#10202e;margin:0;background:#fff}.head{background:#071726;color:#fff;padding:24px 26px;-webkit-print-color-adjust:exact;print-color-adjust:exact}.head small{letter-spacing:.2em;font-size:11px;color:#7fe3f2;font-weight:700}.head h1{margin:6px 0 2px;font-size:27px}.head p{margin:0;color:#c6dceb}
.pic{width:100%;max-height:300px;object-fit:cover;display:block}.main{padding:6px 26px 26px;max-width:800px;margin:0 auto}.tiles{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:16px 0}.t{border:1px solid #cfe0ea;border-radius:10px;padding:9px;text-align:center}.t b{display:block;font-size:18px;color:#0b5d73}.t span{font-size:11px;color:#556}
h2{font-size:15px;margin:22px 0 6px;color:#0b5d73;border-bottom:2px solid #16a6c4;padding-bottom:3px}table{border-collapse:collapse;width:100%}td,th{text-align:left;padding:5px 6px;border-bottom:1px solid #e1e8ee;vertical-align:top}th{font-size:12px;color:#556}td.n,th.n{text-align:right}.rec{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}.rec img{width:100%;border:1px solid #cfe0ea;border-radius:8px}.foot{margin-top:26px;color:#667;font-size:12px}@media print{.main{padding:0 8mm 8mm}h2{break-after:avoid}.rec img{break-inside:avoid}}</style></head><body>
<div class="head"><small>VEHICLE RECORDS</small><h1>${e(name)}</h1><p>${e([c.trim, c.engine, c.miles != null ? `${miles(c.miles)} miles` : ""].filter(Boolean).join(" · "))}</p>${opt.vin && c.vin ? `<p>VIN ${e(c.vin)}</p>` : ""}</div>${pic ? `<img class="pic" src="${pic}" alt="">` : ""}
<div class="main"><div class="tiles">${tile(String(done.length), "services logged")}${tile(m0(spent), "spent on service")}${tile(f.mpg ? f.mpg.toFixed(1) : "–", "average MPG")}${tile(String(inst.length), "upgrades")}</div>
${done.length ? `<h2>Service History</h2><table><tr><th>Date</th><th>Service</th><th class="n">Miles</th><th class="n">Cost</th><th>Note</th></tr>${done.map(s => `<tr><td>${e(aDate(s.date))}</td><td>${e(svc(s.kind)[2])}</td><td class="n">${s.miles != null ? miles(s.miles) : ""}</td><td class="n">${s.cost ? e(money(s.cost)) : ""}</td><td>${e(s.note || "")}</td></tr>`).join("")}</table>` : ""}
${inst.length ? `<h2>Upgrades</h2><table><tr><th>Item</th><th>Installed</th><th>Note</th></tr>${inst.map(x => `<tr><td>${e(x.name)}</td><td>${x.date ? e(aDate(x.date)) : ""}</td><td>${e(x.note || "")}</td></tr>`).join("")}</table>` : ""}
${c.recalls ? `<h2>Safety Recalls</h2><p>Checked with NHTSA on ${e(aDate(c.recalls.at))} for this year, make and model: ${tr.length ? `${tr.length} found, ${tr.filter(r => c.recallDone[r.id]).length} marked fixed by the owner.` : "none found."}</p>${tr.length ? `<table>${tr.map(r => `<tr><td>${e(r.part)}</td><td>${c.recallDone[r.id] ? "Fixed" : "Open"}</td></tr>`).join("")}</table>` : ""}` : ""}
${recs.length ? `<h2>Receipts</h2><div class="rec">${recs.map(r => `<img src="${r}" alt="Receipt">`).join("")}</div>` : ""}
<p class="foot">Owner-entered records kept with Auto Hub by Marvel Corp, ${e(aDate(today()))}. Not checked by Marvel Corp or anyone else.</p></div></body></html>`;
}
async function atOpenRecords(c) {
  const w = window.open("", "_blank"); if (!w) { toast("Allow pop-ups for this page to save the PDF"); return; }
  w.document.write("<p style='font:16px sans-serif;padding:24px'>Getting your records ready…</p>");
  let cover = "", rec = [];
  try { cover = c.cover ? await photoGet(c.cover) : ""; if (AT.recReceipts !== false) rec = await Promise.all(c.photos.filter(p => p.tag === "receipt").slice(-12).map(p => photoGet(p.id).catch(() => ""))); } catch (e) { /* the report still works without pictures */ }
  w.document.open(); w.document.write(atRecordsHtml(c, { vin: !!AT.recVin }, cover, rec)); w.document.close(); w.focus(); setTimeout(() => { try { w.print(); } catch (e) { /* the page can still be saved */ } }, 500);
}
function atRecords(c) {
  const rec = c.photos.filter(p => p.tag === "receipt").length, row = (k, l, s, on) => `<button class="at-row at-togglerow" data-atrecopt="${k}" role="switch" aria-checked="${on}"><span class="grow"><b>${esc(l)}</b><small>${esc(s)}</small></span><i class="at-switch ${on ? "on" : ""}" aria-hidden="true"></i></button>`;
  return atHead("Records Package", "doc") + atCarPick(c) + `<section class="at-card glow"><small class="at-k">Buyer-Ready Report</small><b class="at-range">${esc(atFullName(c))}</b><p class="at-note">Your service history, upgrades, recall check and receipts in one clean report.</p></section>
    <div class="at-stats plain"><div><b>${c.services.length}</b><small>Services</small></div><div><b>${c.extras.filter(x => x.status === "installed").length}</b><small>Upgrades</small></div><div><b>${rec}</b><small>Receipts</small></div></div>
    <section class="at-list">${row("vin", "Include the VIN", "Most buyers ask for it. Off until you say so.", !!AT.recVin)}${row("receipts", "Include Receipt Photos", rec ? `Your last ${Math.min(rec, 12)}` : "Add receipts under Photos", AT.recReceipts !== false)}</section>
    ${atBig("Save as PDF", `data-atrecords="${esc(c.id)}"`, "download")}<p class="at-note">Your phone's Print or Share makes the PDF. It says the records are owner-entered, because they are.</p>`;
}

// ---- SELL MY CAR: one place from "getting it ready" to "sold". Builds on the for-sale card and the listing text.
const AT_SELL_TICKS = [["papers", "Papers gathered"], ["title", "Title in hand"], ["clean", "Car cleaned"]];
function atSellPage(c) {
  const k = c.sellCheck && typeof c.sellCheck === "object" ? c.sellCheck : {}, rc = openRecalls(c);
  const L = [{ ok: c.photos.length > 0, text: "Photos added", go: atCarGo(c, "photos") }, { ok: c.services.length > 0, text: "Service history ready", go: atCarGo(c, "service") }, { ok: !!c.recalls && !rc.length, text: c.recalls && rc.length ? `${rc.length} open recall${rc.length === 1 ? "" : "s"}` : "Recalls checked", go: atCarGo(c, "recalls") }, { ok: c.price > 0, text: "Asking price set", go: `data-atsegto="overview:value" data-atcar="${esc(c.id)}"` }, ...AT_SELL_TICKS.map(([key, text]) => ({ ok: !!k[key], text, key }))];
  return atHead("Sell My Car", "tag") + atCarPick(c) + `<section class="at-card"><div class="at-cardhead">${AI.check}<b>Ready to Sell</b>${atPill(`${L.filter(x => x.ok).length} of ${L.length} ready`, L.every(x => x.ok) ? "ok" : "soon")}</div>
      ${L.map(x => x.key ? `<div class="at-chk"><span class="grow"><b>${esc(x.text)}</b></span><button class="at-box ${x.ok ? "on" : ""}" data-atsellchk="${x.key}" aria-pressed="${x.ok}" aria-label="${esc(x.text)}">${x.ok ? "✓" : ""}</button></div>` : `<button class="at-chk at-chkbtn" ${x.go}><span class="grow"><b>${esc(x.text)}</b></span><span class="at-box ${x.ok ? "on" : "bad"}" aria-hidden="true">${x.ok ? "✓" : "!"}</span></button>`).join("")}</section>
    ${atBig("Create For-Sale Card", 'data-atgo="forsale"', "tag")}<div class="at-actions"><button class="at-ghost" data-atlist="${esc(c.id)}" ${c.price ? "" : "disabled"}>${AI.list}Copy the Ad</button><button class="at-ghost" data-atgo="records">${AI.doc}Buyer PDF</button></div>
    <label class="at-tick"><input type="checkbox" id="aVinShare"><span>Put the VIN in the ad</span></label>${c.price ? `<details class="at-ad"><summary>See the Ad</summary><pre>${esc(listingText({ ...c, nick: "" }, false))}</pre></details>` : `<p class="at-note">The ad needs an asking price first.</p>`}
    ${atRow("trend", "Value & Selling", "Rough value, asking price, what you paid", `data-atsegto="overview:value" data-atcar="${esc(c.id)}"`)}${atRow("archive", "It's Sold", "Keep the records, move it out of the garage", 'data-atgo="marksold"')}${atMsg()}`;
}
function atMarkSold(c) {
  return atHead("It's Sold", "archive") + `<p class="at-note">${esc(atFullName(c))} moves to Sold Cars with every record kept. You can put it back any time.</p><form class="at-card at-form" data-atsold="${esc(c.id)}">
      <label class="at-field">Date Sold<input type="date" name="date" value="${today()}" required></label><label class="at-field">Sale Price<input name="price" inputmode="decimal" placeholder="$" value="${c.price ? esc(c.price) : ""}"></label><input name="note" maxlength="120" placeholder="Note, e.g. who bought it (optional)" aria-label="Note"><button class="at-big">Mark as Sold</button>${atMsg()}</form>`;
}
// Sold cars live in garage().sold, so everything that counts or reminds about "your cars" leaves them out without being told.
function atSoldCars() {
  const g = garage(); if (!Array.isArray(g.sold)) g.sold = [];
  g.sold = g.sold.filter(c => c && typeof c === "object" && c.id);
  g.sold.forEach(c => { ["services", "fuel", "odo", "papers", "extras", "notes", "photos", "mech"].forEach(k => { c[k] = Array.isArray(c[k]) ? c[k] : []; }); c.recallDone = c.recallDone && typeof c.recallDone === "object" ? c.recallDone : {}; c.tripCheck = c.tripCheck && typeof c.tripCheck === "object" ? c.tripCheck : {}; c.sold = c.sold && typeof c.sold === "object" ? c.sold : {}; });
  return g.sold;
}
const atSoldById = id => atSoldCars().find(c => c.id === id);
function atSoldNums(c) {
  const running = c.services.reduce((n, x) => n + (x.cost || 0), 0) + c.fuel.reduce((n, x) => n + (x.cost || 0), 0) + c.papers.reduce((n, x) => n + ((x.paid && x.cost) || 0), 0), price = Number(c.sold.price) || 0, paid = Number(c.paid) || 0, diff = paid && price ? price - paid : null;
  let owned = ""; if (atIsDay(c.boughtOn || c.added) && atIsDay(c.sold.date)) { const mo = Math.max(0, Math.round((parseDay(c.sold.date) - parseDay(c.boughtOn || c.added)) / (30.44 * 86400000))); owned = `${mo >= 12 ? `${Math.floor(mo / 12)} year${mo >= 24 ? "s" : ""} ` : ""}${mo % 12 || mo < 12 ? `${mo % 12} month${mo % 12 === 1 ? "" : "s"}` : ""}`.trim(); }
  return { running, price, paid, diff, owned, all: paid && price ? paid - price + running : null };
}
function atArchive() {
  const L = atSoldCars();
  return atHead("Sold Cars", "archive") + (L.length ? `<section class="at-list">${L.map(c => { const n = atSoldNums(c); return `<button class="at-carrow" data-atgo="soldview:${esc(c.id)}">${atCarImg(c, "at-carpic")}<span class="grow"><small>Sold ${atIsDay(c.sold.date) ? aDate(c.sold.date) : ""}</small><b>${esc(atFullName(c))}</b><em>${n.price ? m0(n.price) : "No price logged"}</em></span>${AI.chev}</button>`; }).join("")}</section>` : `<p class="at-note">When you sell a car, mark it Sold under Sell My Car. Its records stay here for good.</p>`);
}
function atSoldView(id) {
  const c = atSoldById(id); if (!c) return atArchive();
  const n = atSoldNums(c), kv = (l, v) => `<div class="at-kv"><span>${esc(l)}</span><b>${esc(v)}</b></div>`, armed = AT.delArm === c.id;
  return atHead("Sold Car", "archive") + `<div class="at-saleimg">${atCarImg(c, "at-saleart", false)}<span class="at-ribbon sold">SOLD</span></div><h3 class="at-soldh">${esc(atFullName(c))}</h3>
    <section class="at-card">${kv("Date Sold", atIsDay(c.sold.date) ? aDate(c.sold.date) : "Not logged")}${kv("Sale Price", n.price ? m0(n.price) : "Not logged")}${n.paid ? kv("You Paid", m0(n.paid)) : ""}${n.diff != null ? kv(n.diff >= 0 ? "Sold For More By" : "Sold For Less By", m0(Math.abs(n.diff))) : ""}${n.owned ? kv("Owned", n.owned) : ""}${kv("Logged Running Costs", m0(n.running))}${n.all != null ? kv("Total Cost of Owning", m0(Math.max(0, n.all))) : ""}${c.sold.note ? kv("Note", c.sold.note) : ""}</section>
    <p class="at-note">From your own log. All records kept.</p>${atBig("View History", `data-atgo="soldhist:${esc(c.id)}"`, "history")}<button class="at-ghost" data-atunsold="${esc(c.id)}">Put It Back in My Garage</button><button class="at-ghost danger" data-atsolddel="${esc(c.id)}">${AI.trash}${armed ? "Tap Again to Delete for Good" : "Delete These Records"}</button>`;
}
function atSoldHistory(id) {
  const c = atSoldById(id); if (!c) return atArchive(); let month = "";
  const L = carJournal(c);
  return atHead("History", "book") + `<p class="at-note">${esc(atFullName(c))}</p><div class="at-time">${L.map(x => { const m = x.date.slice(0, 7), h = m !== month ? `<p class="at-month">${esc(atMonLong(m))}</p>` : ""; month = m; return h + `<div class="at-tl"><span class="at-tldot"></span><div class="at-tlcard"><span class="grow"><b>${esc(x.text)}</b><small>${aDate(x.date)}${x.sub ? ` · ${esc(x.sub)}` : ""}</small></span></div></div>`; }).join("") || `<p class="at-note">Nothing was logged for this car.</p>`}</div>`;
}
function atSoldPage(p) { return p === "archive" ? atArchive() : p.startsWith("soldhist:") ? atSoldHistory(p.slice(9)) : atSoldView(p.slice(9)); }

// ---- CAR FACTS + TIRES & BATTERY
const AT_FACTS = [["plate", "Plate", "id"], ["color", "Color", "palette"], ["tire", "Tire Size", "tire"], ["oil", "Oil Type", "oil"], ["battery", "Battery", "battery"], ["wipers", "Wiper Sizes", "wiper"]];
const atFactsOf = c => (c.facts && typeof c.facts === "object" ? c.facts : {});
function atCarFacts(c) {
  const f = atFactsOf(c), ro = [["VIN", c.vin], ["Year / Make / Model", [c.year, c.make, c.model].filter(Boolean).join(" ")], ["Trim", c.trim], ["Engine", c.engine], ["Body", c.body]].filter(r => r[1]);
  return atHead("Car Facts", "info") + atCarPick(c) + `<section class="at-card">${ro.map(r => `<div class="at-kv"><span>${esc(r[0])}</span><b class="at-wrap">${esc(r[1])}</b></div>`).join("")}<button class="at-ghost" data-atgo="details">${AI.pencil}Edit Car Details</button></section>
    <form class="at-form at-tripform" data-atfacts="${esc(c.id)}">${AT_FACTS.map(([k, l, ic]) => `<div class="at-rowin">${AI[ic]}<label>${esc(l)}<input name="${k}" maxlength="40" autocomplete="off" value="${esc(f[k] || "")}" placeholder="Add it"></label></div>`).join("")}<button class="at-big">Save Facts</button></form><p class="at-note">The things you never remember at the parts counter. They stay on this phone and in your own backup, and never go to the AI helper.</p>`;
}
function atTires(c) {
  const t = today(), f = atFactsOf(c), hist = k => c.services.filter(s => k.includes(s.kind)).sort((a, b) => b.date.localeCompare(a.date)), spent = L => L.reduce((n, s) => n + (s.cost || 0), 0);
  const due = k => { const d = serviceDue(c, k, t), s = svc(k); return `<div class="at-svc ${d.late ? "late" : d.soon ? "soon" : ""}"><span class="at-ric">${AI[AT_SVC_IC[k]]}</span><span class="grow"><b>${esc(s[2])}</b><small>${d.logged && isFinite(d.days) ? esc(d.dueMiles != null ? `Due at ${miles(d.dueMiles)} mi` : `Due ${aDate(d.dueDate)}`) : "Not logged yet"}</small></span>${!d.logged || !isFinite(d.days) ? "" : d.late ? atPill("Overdue", "late") : d.soon ? atPill("Due Soon", "soon") : atPill("On Track", "ok")}</div>`; };
  const rows = L => L.length ? `<section class="at-card">${L.slice(0, 8).map(s => `<div class="at-hist"><span class="at-ric">${AI[AT_SVC_IC[s.kind]]}</span><span class="grow"><b>${esc(svc(s.kind)[2])}</b><small>${aDate(s.date)}${s.miles != null ? ` · ${miles(s.miles)} mi` : ""}${s.note ? ` · ${esc(s.note)}` : ""}</small></span>${s.cost ? `<b class="at-amt">${money(s.cost)}</b>` : ""}</div>`).join("")}</section>` : "";
  const tH = hist(["tires", "rotate"]), bH = hist(["battery"]);
  return atHead("Tires & Battery", "tire") + atCarPick(c) + `<div class="at-titlerow small"><h3>Tires</h3><button class="at-linky" data-atgo="facts">${f.tire ? esc(f.tire) : "Add Tire Size"}</button></div><section class="at-list">${due("tires")}${due("rotate")}</section>${rows(tH)}${tH.length ? `<p class="at-note">${m0(spent(tH))} logged on tires.</p>` : ""}<div class="at-actions"><button class="at-ghost" data-atlogkind="tires">${AI.plus}New Tires</button><button class="at-ghost" data-atlogkind="rotate">${AI.plus}Rotation</button></div>
    <div class="at-titlerow small"><h3>Battery</h3><button class="at-linky" data-atgo="facts">${f.battery ? esc(f.battery) : "Add Battery Type"}</button></div><section class="at-list">${due("battery")}</section>${rows(bH)}${bH.length ? `<p class="at-note">${m0(spent(bH))} logged on batteries.</p>` : ""}<div class="at-actions"><button class="at-ghost" data-atlogkind="battery">${AI.plus}Battery Test or New Battery</button></div>`;
}

// ---- FUEL ANALYTICS
function atFuelStats(c) {
  const t = today(), f = fuelStats(c), R = f.rows.filter(x => isFinite(x.mpg)), from = addDays(t, -365), F = c.fuel.filter(x => atIsDay(x.date)), n0 = v => Number(v) || 0, yr = F.filter(x => x.date > from && x.date <= t), gal = F.reduce((n, x) => n + n0(x.gal), 0), paid = F.filter(x => n0(x.cost) > 0 && n0(x.gal) > 0), perGal = paid.length ? paid.reduce((n, x) => n + n0(x.cost), 0) / paid.reduce((n, x) => n + n0(x.gal), 0) : null;
  const best = R.length ? Math.max(...R.map(x => x.mpg)) : null, worst = R.length ? Math.min(...R.map(x => x.mpg)) : null, months = atMonthsBack(t), vals = months.map(m => F.filter(x => x.date.startsWith(m)).reduce((n, x) => n + n0(x.cost), 0));
  const tile = (v, l) => `<div><b>${esc(v)}</b><small>${esc(l)}</small></div>`;
  return atHead("Fuel Analytics", "trend") + atCarPick(c) + `<div class="at-stats plain six">${tile(f.mpg ? f.mpg.toFixed(1) : "–", "Avg MPG")}${tile(best ? best.toFixed(1) : "–", "Best MPG")}${tile(worst ? worst.toFixed(1) : "–", "Worst MPG")}${tile(perGal ? "$" + perGal.toFixed(2) : "–", "Avg $ / Gallon")}${tile(f.perMile ? "$" + f.perMile.toFixed(2) : "–", "Fuel $ / Mile")}${tile(m0(yr.reduce((n, x) => n + n0(x.cost), 0)), "Last 12 Months")}</div>
    <section class="at-card"><div class="at-cardhead"><b>MPG Trend</b></div>${atMpgChart(f)}</section><section class="at-card"><div class="at-cardhead"><b>Fuel Cost by Month</b><small>$ (USD)</small></div>${atBars(vals, months, "Fuel cost each of the last 12 months")}</section>
    <p class="at-note">${c.fuel.length} fill-up${c.fuel.length === 1 ? "" : "s"}, ${gal.toFixed(1)} gallons logged. MPG counts every fill-up as a full tank.</p>${atRow("fuel", "All Fill-Ups", "Add or remove them", atCarGo(c, "fuel"))}`;
}

// ---- COMPARE CARS + ALL CARS
function atCompare() {
  const cars = garage().cars, t = today();
  if (cars.length < 2) return atHead("Compare Cars", "compare") + `<p class="at-note">Compare what each car costs once you have two in the garage.</p>${atBig("Add a Car", 'data-aaddcar="1"', "plus")}`;
  const D = cars.map(c => { const o = ownCost(c, t), f = fuelStats(c); return { c, mpg: f.mpg, svc: o.service, fuel: o.fuel, pap: o.papers, total: o.total, month: o.month, mile: o.perMile, miles: c.miles }; });
  const row = (l, get, fmt, low) => { const vals = D.map(get), real = vals.filter(v => v != null && v > 0), best = low === null || real.length < 2 ? null : low ? Math.min(...real) : Math.max(...real);
    return `<tr><th scope="row">${esc(l)}</th>${vals.map(v => `<td class="${best != null && v === best ? "best" : ""}">${v == null || v === 0 ? "–" : esc(fmt(v))}</td>`).join("")}</tr>`; };
  return atHead("Compare Cars", "compare") + `<p class="at-note">The last 12 months, from your own log. Turquoise is the better number.</p><div class="at-tablewrap"><table class="at-table"><thead><tr><th scope="col"></th>${D.map(d => `<th scope="col">${esc(atShort(d.c))}</th>`).join("")}</tr></thead><tbody>
      ${row("Miles", d => d.miles, miles, null)}${row("Avg MPG", d => d.mpg, v => v.toFixed(1))}${row("Maintenance", d => d.svc, m0, true)}${row("Fuel", d => d.fuel, m0, true)}${row("Papers", d => d.pap, m0, true)}${row("Total", d => d.total, m0, true)}${row("Per Month", d => d.month, m0, true)}${row("Per Mile", d => d.mile, v => money(v), true)}</tbody></table></div>`;
}
function atAllCars() {
  const cars = garage().cars, t = today(), own = cars.map(c => ownCost(c, t).total), total = own.reduce((a, b) => a + b, 0), due = cars.reduce((n, c) => n + carDue(c, t).filter(d => d.late).length, 0), rc = cars.reduce((n, c) => n + openRecalls(c).length, 0);
  return atHead("All Cars", "car") + `<div class="at-stats plain"><div><b>${m0(total)}</b><small>Last 12 Months</small></div><div><b class="${due ? "at-badnum" : ""}">${due}</b><small>Service Due</small></div><div><b class="${rc ? "at-badnum" : ""}">${rc}</b><small>Open Recalls</small></div></div>
    ${cars.map((c, i) => { const next = carDue(c, t)[0], ps = papersSoon(c, t).length, r = openRecalls(c).length; return `<button class="at-allcar" ${atCarGo(c, "overview")}>${atCarImg(c, "at-carpic")}<span class="grow"><b>${esc(atShort(c))}</b><small>${next ? `Next: ${esc(svc(next.key)[2])} (${esc(dueWords(next).split(" or ")[0])})` : "Nothing logged to track yet"}</small><small>${ps ? `${ps} paper${ps === 1 ? "" : "s"} to renew` : "Papers OK"} · ${r ? `${r} open recall${r === 1 ? "" : "s"}` : c.recalls ? "No open recalls" : "Recalls not checked"}</small><em>${m0(own[i])} in 12 months</em></span>${AI.chev}</button>`; }).join("")}
    ${cars.length > 1 ? atRow("compare", "Compare Cars", "Side by side", 'data-atgo="compare"') : ""}${atRow("archive", "Sold Cars", `${atSoldCars().length} kept`, 'data-atgo="archive"')}`;
}

// ---- WARRANTY TRACKER: a warranty is a paper, so it shows under Papers too; this adds the mileage limit and how much is left.
function atWarranty(c) {
  const t = today(), L = c.papers.filter(x => x.kind === "warranty").sort((a, b) => (a.expires || "9999").localeCompare(b.expires || "9999"));
  const row = x => { const left = atIsDay(x.expires) ? daysUntil(x.expires) : null, milesLeft = x.limitMiles > 0 && c.miles != null ? x.limitMiles - c.miles : null, over = (left != null && left < 0) || (milesLeft != null && milesLeft <= 0), soon = !over && ((left != null && left <= 60) || (milesLeft != null && milesLeft <= 1000));
    const start = atIsDay(x.start) ? x.start : null, span = start && atIsDay(x.expires) ? Math.max(1, (parseDay(x.expires) - parseDay(start)) / 86400000) : null, used = span ? Math.max(0, Math.min(100, Math.round((parseDay(t) - parseDay(start)) / 86400000 / span * 100))) : null;
    return `<article class="at-war"><div class="at-mhead"><span class="at-ric">${AI.shield}</span><span class="grow"><b>${esc(x.name || "Warranty")}</b><small>${x.expires ? `${over && left != null && left < 0 ? "Ended" : "Until"} ${aDate(x.expires)}` : "No end date"}${x.limitMiles > 0 ? ` or ${miles(x.limitMiles)} mi` : ""}</small></span>${over ? atPill("Ended", "late") : soon ? atPill("Ending Soon", "soon") : atPill("Covered", "ok")}</div>
      ${used != null ? `<span class="at-bar" role="img" aria-label="${used} percent of the time used"><i style="width:${used}%"></i></span>` : ""}${milesLeft != null ? `<small class="at-warline">${milesLeft > 0 ? `${miles(milesLeft)} miles left` : `${miles(-milesLeft)} miles past the limit`}</small>` : ""}${x.note ? `<small class="at-warline">${esc(x.note)}</small>` : ""}<div class="at-actions"><button class="at-chipb" data-adel="paper:${esc(x.id)}">Remove</button></div></article>`; };
  return atHead("Warranty Tracker", "shield") + atCarPick(c) + `<section class="at-list">${L.map(row).join("") || `<p class="at-note">Factory coverage, an extended plan, or a shop's guarantee on a repair. Keep the dates and the mileage limit here.</p>`}</section>
    ${AT.form === "warranty" ? `<form class="at-card at-form" data-atwarranty="${esc(c.id)}"><div class="at-cardhead"><b>Add Warranty</b><button type="button" class="at-linky" data-atform="">Cancel</button></div><input name="name" maxlength="60" placeholder="What it covers, e.g. Powertrain" required aria-label="What it covers">
      <div class="at-two"><label class="at-field">Starts<input type="date" name="start"></label><label class="at-field">Ends<input type="date" name="expires"></label></div><label class="at-field">Mileage Limit<input name="limit" inputmode="numeric" placeholder="Optional, e.g. 60,000"></label><input name="note" maxlength="120" placeholder="Note, e.g. who to call (optional)" aria-label="Note"><button class="at-big">Add Warranty</button>${atMsg()}</form>` : atBig("Add Warranty", 'data-atform="warranty"', "plus") + atMsg()}`;
}

// ---- HEALTH HISTORY: the car's life on one line. Only what's in its log and its recall checks.
function atHealthItems(c) {
  const I = [];
  c.services.forEach(s => I.push({ date: s.date, type: s.kind === "oil" ? "oil" : s.kind === "inspect" ? "inspect" : "repair", ic: AT_SVC_IC[s.kind] || "wrench", text: svc(s.kind)[2], sub: [s.miles != null ? `${miles(s.miles)} mi` : "", s.cost ? money(s.cost) : "", s.note].filter(Boolean).join(" · ") }));
  c.papers.filter(x => x.kind === "inspection" && atIsDay(x.paid)).forEach(x => I.push({ date: x.paid, type: "inspect", ic: "clip", text: x.name || "Inspection", sub: x.expires ? `Good to ${aDate(x.expires)}` : "" }));
  if (c.recalls && atIsDay(c.recalls.at)) c.recalls.list.forEach(r => I.push({ date: c.recalls.at, type: "recall", ic: "triangle", text: `Recall: ${r.part}`, sub: c.recallDone[r.id] ? "Marked fixed" : "Open", bad: !c.recallDone[r.id] }));
  return I.filter(x => atIsDay(x.date)).sort((a, b) => b.date.localeCompare(a.date));
}
function atHealth(c) {
  const on = AT.hfilter || "all", L = atHealthItems(c).filter(x => on === "all" || x.type === on); let year = "";
  return atHead("Health History", "heart") + atCarPick(c) + `<div class="at-chips">${[["all", "All"], ["repair", "Repairs"], ["oil", "Oil"], ["recall", "Recalls"], ["inspect", "Inspections"]].map(([k, l]) => `<button class="${on === k ? "on" : ""}" data-athfilter="${k}">${l}</button>`).join("")}</div>
    <div class="at-time">${L.map(x => { const y = x.date.slice(0, 4), h = y !== year ? `<p class="at-month">${esc(y)}</p>` : ""; year = y; return h + `<div class="at-tl"><span class="at-tldot ${x.bad ? "bad" : ""}"></span><div class="at-tlcard"><span class="at-ric">${AI[x.ic]}</span><span class="grow"><b>${esc(x.text)}</b><small>${aDate(x.date)}${x.sub ? ` · ${esc(x.sub)}` : ""}</small></span></div></div>`; }).join("") || `<p class="at-note">Every repair, oil change, recall and inspection you log lines up here, for the life of the car.</p>`}</div>`;
}

// ---- MY GLOVEBOX: papers, receipts and photos together, with a search.
function atGlovebox(c) {
  const on = AT.gfilter || "all", P = c.papers.map(x => ({ kind: "papers", html: `<button class="at-glove" ${atCarGo(c, "papers")}><span class="at-ric">${AI[AT_PAPER_IC[x.kind] || "doc"]}</span><span class="grow"><b>${esc(paper(x.kind)[2])}</b><small>${esc(x.name || "")}${x.expires ? `${x.name ? " · " : ""}Good to ${aDate(x.expires)}` : ""}</small></span>${AI.chev}</button>`, q: `${paper(x.kind)[2]} ${x.name || ""} ${x.ref || ""} ${x.note || ""}` }));
  const F = c.photos.slice().reverse().map(p => ({ kind: p.tag === "receipt" ? "receipts" : p.tag === "paper" ? "papers" : "photos", html: `<button class="at-glove" data-aview="${esc(p.id)}"><img class="at-glovepic" data-aphoto="${esc(p.id)}" alt=""><span class="grow"><b>${esc(p.cap || ptag(p.tag)[2])}</b><small>${esc(ptag(p.tag)[2])} · ${aDate(p.date)}</small></span>${AI.chev}</button>`, q: `${ptag(p.tag)[2]} ${p.cap || ""}` }));
  const all = [...P, ...F].filter(x => on === "all" || x.kind === on);
  return atHead("My Glovebox", "glove") + atCarPick(c) + `<div class="at-search">${AI.search}<input type="search" data-atsearch="1" placeholder="Search your records" aria-label="Search your records"></div>
    <div class="at-chips">${[["all", "All"], ["papers", "Papers"], ["receipts", "Receipts"], ["photos", "Photos"]].map(([k, l]) => `<button class="${on === k ? "on" : ""}" data-atgfilter="${k}">${l}</button>`).join("")}</div>
    <section class="at-list">${all.map(x => `<div data-atq="${esc(String(x.q).toLowerCase())}">${x.html}</div>`).join("") || `<p class="at-note">Your papers and receipt photos gather here. Add them under Papers and Photos.</p>`}</section>`;
}

// ---- DATA & BACKUP
function atDataPage(c) {
  const when = S.sync.last ? new Date(S.sync.last).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "";
  const on = S.sync.on && syncOk("sync"), paused = S.sync.on && !on;
  return atHead("Data & Backup", "cloud") + `<section class="at-card ${on ? "glow" : ""}"><div class="at-cardhead">${AI.cloud}<b>${paused ? "Backup is paused" : on ? (when ? `Backed up ${esc(when)}` : "Not backed up yet") : "Only on this phone"}</b>${atPill(paused ? "Paused" : on ? "On" : "Off", on ? "ok" : "soon")}</div><p class="at-note">${paused ? `New changes aren't saving to your Drive right now.${when ? ` Last backup ${esc(when)}.` : ""} Everything's still on this phone.` : on ? "Every change saves to your own Google Drive." : "If this phone is lost or reset, your records go with it."}</p>${paused ? `<button class="at-big small" data-atset="syncBox">Backup Settings</button>` : on ? `<button class="at-big small" data-sync="now">Back Up Now</button>` : `<button class="at-big small" data-sync="on">Back Up to My Google Drive</button>`}</section>
    <section class="at-list">${atRow("download", "Download My Data", "A backup file you can keep anywhere", 'data-data="export"')}${atRow("list", "Export Spreadsheet", "Every record, for any spreadsheet app", 'data-atcsv="1"')}${atRow("doc", "Full Records PDF", atShort(c), 'data-atgo="records"')}${atRow("upload", "Import & Load", "A backup file, or records from another app", 'data-atgo="impex"')}${atRow("trash", "Erase Everything", "Remove all data from this phone", 'data-atset="dataBox"')}</section><p class="at-note">Full-size photos stay on the phone they were taken on. Only each car's small cover picture is in a backup.</p>`;
}

// ---- the page for this name; autotiles.js atPage asks here for anything it doesn't draw itself
function atPage2(p, c) {
  const T = { cal: atCalendar, reminders: atRemindersPage, costing: atCosting, expenses: atExpenses, impex: atImpex, records: atRecords, sell: atSellPage, marksold: atMarkSold, facts: atCarFacts, tires: atTires, fuelstats: atFuelStats, compare: atCompare, allcars: atAllCars, warranty: atWarranty, health: atHealth, glovebox: atGlovebox, data: atDataPage };
  return T[p] ? T[p](c) : null;
}

// ---- taps. Runs before ui.js's listener, after autotiles.js's. Anything without one of these attributes goes straight through.
document.addEventListener("click", e => {
  if (!e.target.closest || typeof MODE === "undefined" || MODE !== "auto" || !atOn()) return;
  const b = e.target.closest("button, a"); if (!b || !b.dataset) return; const ds = b.dataset;
  const redraw = () => { render(); };
  if (ds.atpick) { AT.pick = ds.atpick; redraw(); return; }
  if (ds.atxkind) { AT.xkind = ds.atxkind; redraw(); return; }
  if (ds.athfilter) { AT.hfilter = ds.athfilter; redraw(); return; }
  if (ds.atgfilter) { AT.gfilter = ds.atgfilter; redraw(); return; }
  if (ds.atalert) { const A = atAlerts(); A[ds.atalert] = A[ds.atalert] === false; save(); redraw(); return; }
  if (ds.aticsall) { const rows = atForecast(garage().cars, today()); if (!rows.length) { toast("Nothing to add yet. Log a service first."); return; } atDownload(`auto-hub-dates-${today()}.ics`, atIcsText(rows), "text/calendar"); toast("Calendar file saved. Open it to add the dates."); return; }
  if (ds.atcsv) { atDownload(`auto-hub-records-${today()}.csv`, atCsvText(garage().cars), "text/csv"); toast("Spreadsheet saved"); return; }
  if (ds.atcsvcancel) { AT.csv = null; AUTO_MSG = ""; redraw(); return; }
  if (ds.atcsvadd && AT.csv) { const c = carById(AT.csv.car); if (!c) return; const n = atCsvAdd(c, AT.csv); AT.csv = null; AUTO_MSG = ""; save(); redraw(); toast(`${n} record${n === 1 ? "" : "s"} added to ${carName(c)}`); return; }
  if (ds.atrecopt) { if (ds.atrecopt === "vin") AT.recVin = !AT.recVin; else AT.recReceipts = AT.recReceipts === false; redraw(); return; }
  if (ds.atrecords) { const c = carById(ds.atrecords); if (c) atOpenRecords(c); return; }
  if (ds.atsellchk && AUTO_OPEN) { const c = carById(AUTO_OPEN); if (!c) return; c.sellCheck = c.sellCheck && typeof c.sellCheck === "object" ? c.sellCheck : {}; c.sellCheck[ds.atsellchk] = !c.sellCheck[ds.atsellchk]; save(); redraw(); return; }
  if (ds.atunsold) { const c = atSoldById(ds.atunsold); if (!c) return;
    if (!autoCanAdd()) { toast(STORE_MODE ? storeLock("More than 1 car") : `Auto Hub free keeps 1 car. ${PLAN.AUTO_NAME} keeps every car you own.`); return; }
    garage().sold = garage().sold.filter(x => x.id !== c.id); delete c.sold; garage().cars.push(c); save(); atReset(); TAB = "garage"; redraw(); window.scrollTo({ top: 0 }); toast(`${carName(c)} is back in your garage`);
    photoTx("readonly", st => st.getAllKeys()).then(ids => { const have = new Set(ids), keep = c.photos.filter(p => have.has(p.id)); if (keep.length === c.photos.length) return; c.photos = keep; if (c.cover && !have.has(c.cover)) c.cover = ""; save(); if (atOn()) render(); }).catch(() => { /* couldn't read the store: leave the rows alone */ });
    return; }
  if (ds.atsolddel) { const c = atSoldById(ds.atsolddel); if (!c) return;
    if (AT.delArm !== c.id) { AT.delArm = c.id; redraw(); setTimeout(() => { if (AT.delArm === c.id) { AT.delArm = null; if (atOn()) render(); } }, 5000); return; }
    AT.delArm = null; c.photos.forEach(p => photoDel(p.id).catch(() => {})); garage().sold = garage().sold.filter(x => x.id !== c.id); save(); atBack(); redraw(); toast("Those records are gone"); return; }
});
// Search filters what's on screen without redrawing, so the keyboard stays up.
document.addEventListener("input", e => {
  const t = e.target; if (!t || !t.dataset || !t.dataset.atsearch || typeof MODE === "undefined" || MODE !== "auto") return;
  const q = String(t.value).trim().toLowerCase(); document.querySelectorAll("#cards [data-atq]").forEach(el => { el.hidden = !!q && !el.dataset.atq.includes(q); });
});
// A CSV from another app. In the capture phase: auto.js's own change listener empties every file box it sees.
document.addEventListener("change", e => {
  const t = e.target; if (!t || !t.dataset || !t.dataset.atcsvfile || typeof MODE === "undefined" || MODE !== "auto" || !atOn()) return;
  const file = t.files && t.files[0], c = carById(t.dataset.atcsvfile); e.stopImmediatePropagation(); t.value = ""; if (!file || !c) return;
  if (file.size > 2000000) { AUTO_MSG = "That file is too big. Try a smaller date range."; autoMsgShow(); return; }
  const rd = new FileReader();
  rd.onload = () => { let r = null; try { r = atCsvRead(rd.result, c); } catch (err) { r = null; }
    if (!r) { AUTO_MSG = "Couldn't read that file. It needs a header row with at least a Date column."; autoMsgShow(); return; }
    AT.csv = { ...r, car: c.id }; AUTO_MSG = ""; render(); };
  rd.onerror = () => { AUTO_MSG = "Couldn't read that file."; autoMsgShow(); };
  rd.readAsText(file);
}, true);
// The forms that are new. Before ui.js's own submit handler.
document.addEventListener("submit", e => {
  if (typeof MODE === "undefined" || MODE !== "auto" || !atOn()) return;
  const f = e.target; if (!f || !f.dataset) return; const ds = f.dataset; if (!ds.atfacts && !ds.atsold && !ds.atwarranty) return;
  e.preventDefault(); e.stopImmediatePropagation();
  const d = Object.fromEntries(new FormData(f));
  if (ds.atfacts) { const c = carById(ds.atfacts); if (!c) return; c.facts = {}; AT_FACTS.forEach(([k]) => { const v = atPlain(d[k], 40); if (v) c.facts[k] = v; }); save(); render(); toast("Saved ✓"); return; }
  if (ds.atsold) { const c = carById(ds.atsold); if (!c) return; if (!atIsDay(d.date)) { AUTO_MSG = "Pick the day you sold it."; autoMsgShow(); return; }
    atSoldCars(); c.sold = { date: d.date, price: atNum(d.price), note: atPlain(d.note, 120) };
    garage().cars = garage().cars.filter(x => x.id !== c.id); garage().sold.unshift(c); if (AUTO_HERO === c.id) AUTO_HERO = null;
    AUTO_MSG = ""; save(); atReset(); AT.page = `soldview:${c.id}`; render(); window.scrollTo({ top: 0 }); toast(`${carName(c)} moved to Sold Cars`); return; }
  if (ds.atwarranty) { const c = carById(ds.atwarranty), name = atPlain(d.name, 60); if (!c) return; if (!name) { AUTO_MSG = "Say what it covers."; autoMsgShow(); return; }
    c.papers.push({ id: uid(), kind: "warranty", name, expires: atIsDay(d.expires) ? d.expires : "", start: atIsDay(d.start) ? d.start : "", limitMiles: toMiles(d.limit) || 0, cost: 0, paid: "", ref: "", note: atPlain(d.note, 120) });
    AT.form = null; AUTO_MSG = ""; save(); render(); toast("Warranty saved"); }
}, true);
