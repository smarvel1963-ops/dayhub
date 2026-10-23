/* SAVE AS: universe.js · LOCATION: C:/MarvelApps/dayhub/universe.js
 * HUB UNIVERSE - app #7 (Scott 10/17: "we can build universe pro hub as an app", "i like circle design ... with different
 * branches of the app", "you can have more than one orbit block if needed", "that way as we add more it can easily have
 * expansions"). Runs at /hubuniverse/ with window.DH_MODE = "universe".
 *
 * One screen that sees every Hub app on this phone:
 *   - ORBITS: one orbit per group (Everyday, Travel, ... ) with "you" in the middle and each hub as a planet carrying a
 *     live badge. Tap a planet -> that hub's own orbit of branches + Open.
 *   - NEEDS YOU: a second kind of orbit - the most urgent things from every hub around a count.
 *   - TODAY ACROSS EVERYTHING: one timeline.
 * READ-ONLY: each hub's saved data (same web address = same phone storage on Android / PC) is loaded for a moment into the
 * engine and asked with THAT hub's own helpers (carDue, homeUpcoming, cashNow...), then put back. Nothing is written to any
 * other hub. iPhone home-screen apps each get their own storage, so there Universe only sees what was opened in Safari.
 *
 * ADDING A HUB = one row in UNI_HUBS (+ its summary function). Group decides which orbit it joins; a new group = a new orbit.
 * Hub Universe Pro (one membership for every hub) is the UNIVERSE_PASS switch - OFF until Scott sets a price.
 * Loaded after moneyviz.js, before ui.js. Needs app.js, auto.js, home.js, money.js, moneyviz.js.
 */
"use strict";

// [id, phone storage key, name, icon, colour, address, group, summary(t) -> {set, val, badge, items, branches}]
const UNI_HUBS = [
  ["day", "dayhub.v1", "Day Hub", "☀️", "#f59e0b", () => BASE_URL, "Everyday", uniDay],
  ["money", "moneyhub.v1", "Money Hub", "💰", "#22c55e", () => MONEYHUB_URL, "Everyday", uniMoney],
  ["home", "homehub.v1", "Home Hub", "🏡", "#14b8a6", () => HOMEHUB_URL, "Everyday", uniHome],
  ["auto", "autohub.v1", "Auto Hub", "🚗", "#ef4444", () => AUTOHUB_URL, "Everyday", uniAuto],
  ["trip", "triphub.v1", "Trip Hub", "✈️", "#a855f7", () => TRIP_URL, "Travel", uniTrips],
  ["cruise", "cruisehub.v1", "Cruise Hub", "🚢", "#06b6d4", () => CRUISE_URL, "Travel", uniTrips],
  ["health", "healthhub.v1", "Health Hub", "❤️", "#2dd4bf", () => HEALTHHUB_URL, "Wellness", uniHealth],   // v1.53 app #8
];
const UNI_SOON = ["🐾 Pet Hub", "👨‍👩‍👧 Family Hub"];    // shown faint under the orbits: more planets coming
let UNI_OPEN = null, UNI_CACHE = null;
if (typeof document !== "undefined" && typeof MODE !== "undefined" && MODE === "universe") document.body.classList.add("uniapp");   // hides the Day Hub ＋ button

// Load another hub's saved data into the engine for one question, then put this app's back. Never saves.
function uniPeek(key, fn) {
  let raw = null; try { raw = localStorage.getItem(key); } catch (e) { return null; }
  if (!raw) return null;
  const keep = S;
  try { S = normalize(JSON.parse(raw)); return fn(); } catch (e) { return null; } finally { S = keep; }
}
const uniItem = (hub, icon, text, sub, day, late, tone) => ({ hub, icon, text, sub, day: day || "", late: !!late, tone });
const uniWhen = d => { const n = daysUntil(d); return n < 0 ? `${-n} day${n === -1 ? "" : "s"} late` : n === 0 ? "today" : n === 1 ? "tomorrow" : n < 7 ? `in ${n} days` : prettyDate(d); };
// next due date of a monthly bill {day, paid "YYYY-MM"} from day t
function uniBillDue(b, t) {
  const d = Math.min(31, Math.max(1, Math.round(+b.day) || 1)), base = parseDay(t), y = base.getFullYear(), m = base.getMonth();
  const here = ymd(new Date(y, m, Math.min(d, new Date(y, m + 1, 0).getDate())));
  if (!b.paid || b.paid < ym(t)) return here;                                  // this month not paid yet (may be late)
  return ymd(new Date(y, m + 1, Math.min(d, new Date(y, m + 2, 0).getDate())));
}
const uniBills = (hub, t) => S.bills.filter(b => b && b.name && +b.amount > 0).map(b => ({ b, due: uniBillDue(b, t) }))
  .filter(x => daysUntil(x.due) <= 7).map(x => uniItem(hub, "💳", `${x.b.name} ${usd(+x.b.amount)}`, uniWhen(x.due), x.due, x.due < t, "#f472b6"));

function uniDay(t) {
  const open = S.todos.filter(x => todoShown(x) && !todoDone(x)), plans = dayItems(t).filter(isPlan);
  const next = plans.find(i => !i.t || i.t >= nowT());
  const items = plans.slice(0, 4).map(i => uniItem("day", "🗓️", i.title, i.t ? hm(i.t) : "today", t, false, "#f59e0b")).concat(uniBills("day", t));
  return { set: !!(S.name || S.city || S.todos.length || plans.length), val: next ? (next.t ? hm(next.t) : "today") : open.length ? `${open.length} to do` : "clear", badge: open.length || "",
    items, branches: [["🗓️", "Today", `${plans.length} planned`], ["✅", "To-dos", `${open.length} open`], ["💳", "Bills", `${S.bills.length}`], ["🎂", "People", `${S.people.length}`]] };
}
function uniMoney(t) {
  if (!(S.mh && S.mh.setup)) return { set: false };
  const cash = cashNow(), un = payRows(t).filter(r => !r.paid), F = typeof mvForecast === "function" ? mvForecast(t, 30) : null;
  const items = un.filter(r => daysUntil(r.due) <= 7).map(r => uniItem("money", "💳", `${r.b.name} ${usd(+r.b.amount || 0)}`, uniWhen(r.due), r.due, r.due < t, "#22c55e"));
  if (F && F.firstShort) items.push(uniItem("money", "⚠️", "Cash may run short", uniWhen(F.firstShort), F.firstShort, false, "#ff7a7a"));
  return { set: true, val: usd(Math.round(cash)), badge: items.length || "", items,
    branches: [["🏦", "Cash", usd(Math.round(cash))], ["💳", "Due soon", `${items.length}`], ["📈", "Low point", F ? usd(Math.round(F.low.bal)) : "–"], ["🧾", "This month", usd(Math.round(monthTotals(ym(t)).out))]] };
}
function uniHome(t) {
  if (!homeSet()) return { set: false };
  const up = homeUpcoming(12), soon = up.filter(x => daysUntil(x.t.due) <= 7);
  return { set: true, val: soon.length ? `${soon.length} due` : "all set", badge: soon.length || "",
    items: soon.slice(0, 5).map(x => uniItem("home", x.sp.icon, x.t.title, `${x.sp.name} · ${uniWhen(x.t.due)}`, x.t.due, x.t.due < t, "#14b8a6")),
    branches: house().spaces.slice(0, 6).map(sp => [sp.icon, sp.name.length > 11 ? sp.name.slice(0, 10) + "…" : sp.name, `${openTasks(sp).length} open`]) };
}
function uniAuto(t) {
  if (!autoSet()) return { set: false };
  const cars = garage().cars, items = [];
  cars.forEach(c => carDue(c, t).filter(d => d.late || d.days <= 14).slice(0, 2).forEach(d =>
    items.push(uniItem("auto", "🔧", `${svc(d.key)[2]} · ${carName(c)}`, d.late ? "overdue" : `due ${uniWhen(addDays(t, Math.max(0, Math.round(d.days))))}`, d.late ? t : addDays(t, Math.max(0, Math.round(d.days))), d.late, "#ef4444"))));
  const late = items.filter(x => x.late).length;
  return { set: true, val: late ? `${late} overdue` : items.length ? `${items.length} soon` : "on track", badge: items.length || "", items,
    branches: (() => { const f = cars.map(c => fuelStats(c)), mpg = f.filter(x => x.mpg); const rec = cars.reduce((n, c) => n + openRecalls(c).length, 0);
      const pap = cars.reduce((n, c) => n + c.papers.filter(x => x.expires && daysUntil(x.expires) <= 30).length, 0);
      return [["🔧", "Service", late ? `${late} overdue` : `${items.length} soon`], ["⛽", "Fuel", mpg.length ? `${(mpg.reduce((n, x) => n + x.mpg, 0) / mpg.length).toFixed(1)} mpg` : "log a fill"],
        ["⚠️", "Recalls", rec ? `${rec} open` : "clear"], ["📄", "Papers", pap ? `${pap} expiring` : "ok"], ["🚗", cars.length === 1 ? carName(cars[0]).split(" ").slice(-1)[0] : "Cars", cars.length === 1 ? `${miles(cars[0].miles)} mi` : `${cars.length} cars`]]; })() };
}
function uniTrips(t) {
  const hub = MODE_PEEK, trips = (S.trips || []).filter(x => x && x.start && (x.end || x.start) >= t).sort((a, b) => a.start.localeCompare(b.start));
  if (!trips.length) return { set: (S.trips || []).length > 0, val: "none planned" };
  const nx = trips[0], n = daysUntil(nx.start), items = [];
  if (n <= 7) items.push(uniItem(hub, hub === "cruise" ? "🚢" : "✈️", `${nx.name || "Trip"} ${n <= 0 ? "is on" : "starts"}`, n <= 0 ? "now" : uniWhen(nx.start), nx.start < t ? t : nx.start, false, "#a855f7"));
  if (nx.finalDue && daysUntil(nx.finalDue) <= 14 && daysUntil(nx.finalDue) >= -3) items.push(uniItem(hub, "💵", `Final payment · ${nx.name || "trip"}`, uniWhen(nx.finalDue), nx.finalDue, nx.finalDue < t, "#fbbf24"));
  return { set: true, val: n <= 0 ? "on now" : `${n} day${n === 1 ? "" : "s"}`, badge: items.length || "", items,
    branches: [[hub === "cruise" ? "🚢" : "🧳", hub === "cruise" ? "Cruises" : "Trips", `${trips.length} ahead`]].concat(trips.slice(0, 5).map(x => [hub === "cruise" ? "⚓" : "📍", (x.name || "Trip").slice(0, 11), daysUntil(x.start) <= 0 ? "now" : `${daysUntil(x.start)} days`])) };
}
let MODE_PEEK = "";
// v1.53 HEALTH HUB: doses due, today's appointment, refills running low - asked with health.js's own helpers.
function uniHealth(t) {
  if (typeof hhSet !== "function" || !hhSet()) return { set: false };
  const D = hhDoses(t), due = D.filter(d => d.st === "due" || d.st === "missed"), taken = D.filter(d => d.st === "taken").length;
  const ap = hhAppts().filter(a => a.date >= t).sort(hhApSort), apToday = ap.filter(a => a.date === t), low = hhMeds().filter(m => hhRefill(m).soon);
  const items = due.map(d => uniItem("health", "💊", `${d.m.name}${d.m.strength ? " " + d.m.strength : ""}`, d.st === "missed" ? `missed ${hm(d.time)}` : `due ${hm(d.time)}`, t, d.st === "missed", "#2dd4bf"))
    .concat(apToday.map(a => uniItem("health", "🩺", `${a.doctor || "Appointment"}${a.time ? " " + hm(a.time) : ""}`, "appointment today", t, false, "#a78bfa")))
    .concat(low.map(m => { const r = hhRefill(m); return uniItem("health", "🧴", `Refill ${m.name}`, r.days <= 0 ? "out of pills" : `${r.days} day${r.days === 1 ? "" : "s"} left`, t, r.days <= 0, "#fb7185"); }));
  const w = hhWater(t), st = hhSteps(t), sl = hhSleepOn(t), V = hhLatestAll(), g = hhGoals();
  const nx = D.find(d => d.st === "later");
  return { set: true, val: due.length ? `${due.length} dose${due.length === 1 ? "" : "s"} due` : nx ? `next ${hm(nx.time)}` : D.length ? "all taken" : `score ${hhScore(t).score}`, badge: items.length || "", items,
    branches: [["💊", "Meds", D.length ? `${taken}/${D.length} taken` : "none"], ["💧", "Water", `${w}/${g.water}`], ["👟", "Steps", st ? st.toLocaleString("en-US") : "log"],
      ["🌙", "Sleep", sl ? `${hhFmtH(sl.hrs)}` : "log"], ["❤️", "Vitals", V.bp ? `${V.bp.sys}/${V.bp.dia}` : "log"], ["🩺", "Visits", ap.length ? prettyDate(ap[0].date) : "none"]] };
}                                                // which hub uniTrips is reading (trip / cruise share it)

// Every hub's summary, once per render.
function uniScan() {
  const t = today();
  UNI_CACHE = UNI_HUBS.map(([id, key, name, icon, tone, url, group, fn]) => {
    MODE_PEEK = id;
    const r = uniPeek(key, () => fn(t)) || { set: false };
    return { id, key, name, icon, tone, url: url(), group, ...r, items: r.items || [], branches: r.branches || [] };
  });
  return UNI_CACHE;
}
const uniNeeds = H => H.flatMap(h => h.items).sort((a, b) => (b.late - a.late) || a.day.localeCompare(b.day));

const UNI_GROUP_IC = { Everyday: "🏠", Travel: "🧳", Wellness: "💚" };                // a new group without an icon gets a star
function uniOrbitHtml(group, H, first) {
  const me = first ? `<div class="hos-core uni-me"><span class="uni-sun" aria-hidden="true"></span><b>${esc(S.name || "You")}</b></div>`
    : `<div class="hos-core uni-gcore"><span>${UNI_GROUP_IC[group] || "⭐"}</span><b>${esc(group)}</b></div>`;
  const items = H.map(h => ({ attr: `data-uniplanet="${h.id}"`, icon: h.icon, label: h.name.replace(" Hub", ""), val: h.set ? String(h.val || "") : "＋ start",
    tone: h.set ? h.tone : "#475569", badge: h.set && h.badge ? String(h.badge) : "" }));
  return `<div class="uni-group"><div class="uni-gh"><span>${esc(group.toUpperCase())}</span><small>${H.filter(h => h.set).length} of ${H.length} in use</small></div>
    <div class="uni-orbit${H.some(h => !h.set) ? " has-off" : ""}${first ? "" : " uni-small"}">${hosOrbit(me, items)}</div></div>`;
}
function uniNeedsHtml(N) {
  if (!N.length) return `<p class="hos-hint">✨ Nothing needs you right now across your hubs.</p>`;
  const top = N.slice(0, 6), core = `<div class="hos-core uni-count"><b>${N.length}</b><small>need${N.length === 1 ? "s" : ""} you</small></div>`;
  const hub = id => UNI_HUBS.find(x => x[0] === id);
  return `<div class="uni-orbit uni-needs">${hosOrbit(core, top.map(x => ({ attr: `data-uniplanet="${x.hub}"`, icon: x.icon, label: x.text.length > 14 ? x.text.slice(0, 13) + "…" : x.text,
      val: x.sub, tone: x.late ? "#ff6b6b" : hub(x.hub)[4], badge: x.late ? "!" : "" })))}</div>
    <div class="uni-list">${N.slice(0, 10).map(x => `<button class="uni-row${x.late ? " late" : ""}" data-uniplanet="${x.hub}" style="--tone:${x.tone}"><span class="uni-ic">${x.icon}</span>
      <span class="grow"><b>${esc(x.text)}</b><small>${esc(hub(x.hub)[2])} · ${esc(x.sub)}</small></span><em>${x.late ? "Late" : esc(uniWhen(x.day))}</em></button>`).join("")}</div>`;
}
function uniHomeHtml() {
  const H = uniScan(), N = uniNeeds(H), t = today(), groups = [...new Set(UNI_HUBS.map(x => x[6]))];
  const used = H.filter(h => h.set).length, todayL = N.filter(x => x.day === t || x.late);
  return `<section class="card uni-home" aria-label="Hub Universe">
    <div class="uni-top"><span class="uni-brand">🌌 HUB <b>UNIVERSE</b></span><small>${used} of ${H.length} hubs in use</small></div>
    ${groups.map((g, i) => uniOrbitHtml(g, H.filter(h => h.group === g), i === 0)).join("")}
    <div class="uni-soon">${UNI_SOON.map(x => `<span>${esc(x)}</span>`).join("")}<em>more planets coming</em></div>
    <div class="mv-sec"><h3>Needs you</h3><small class="uni-sm">across every hub</small></div>
    ${uniNeedsHtml(N)}
    <div class="mv-sec"><h3>Today across everything</h3></div>
    ${todayL.length ? `<div class="uni-list">${todayL.map(x => `<div class="uni-row" style="--tone:${x.tone}"><span class="uni-ic">${x.icon}</span><span class="grow"><b>${esc(x.text)}</b><small>${esc(UNI_HUBS.find(h => h[0] === x.hub)[2])}</small></span><em>${esc(x.sub)}</em></div>`).join("")}</div>`
      : `<p class="hos-hint">Nothing dated today in any hub.</p>`}
    ${uniProHtml()}
    <p class="fine">Hub Universe reads your other Hub apps on this phone and never changes them. ${used ? "" : "Open any Hub app on this phone and it lights up here. "}On iPhone, open the hubs in Safari for Universe to see them.</p>
  </section>`;
}
function uniProHtml() {
  if (!switchOn("UNIVERSE_PASS") || STORE_MODE) return "";   // v1.57 Play app: no Pro section
  return `<section class="uni-pro"><h3>🌌 Hub Universe Pro</h3><p>One membership for every hub - Pro in all of them, today and every new hub we add.</p>
    ${PLAN.UNIVERSE_CHECKOUT_URL && !STORE_MODE ? `<a class="btn" href="${esc(PLAN.UNIVERSE_CHECKOUT_URL)}" target="_blank" rel="noopener">Get Hub Universe Pro</a>` : `<p class="fine">Coming soon.</p>`}</section>`;
}

// Tap a planet: that hub's own orbit of branches, its needs, and Open.
function uniSheet() {
  let el = document.getElementById("uniSheet");
  if (!el) { el = document.createElement("div"); el.id = "uniSheet"; el.className = "sheet"; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); document.body.appendChild(el); }
  return el;
}
function showPlanet(id) {
  const h = (UNI_CACHE || uniScan()).find(x => x.id === id); if (!h) return;
  UNI_OPEN = id; const el = uniSheet(); el.setAttribute("aria-label", h.name);
  const core = `<div class="hos-core uni-planet-core" style="--tone:${h.tone}"><span>${h.icon}</span></div>`;
  el.innerHTML = `<div class="sheet-body mv-sheet"><div class="grab"></div>
    <div class="sheet-head"><h2>${h.icon} ${esc(h.name)}</h2><button class="icon-btn" data-uniclose="1" aria-label="Close">✕</button></div>
    ${h.set ? `${h.branches.length ? `<div class="uni-orbit">${hosOrbit(core, h.branches.map(([ic, l, v]) => ({ attr: `data-unigo="${h.id}"`, icon: ic, label: l, val: v, tone: h.tone })))}</div>` : ""}
      ${h.items.length ? `<h3 class="mv-h">Needs you</h3><div class="uni-list">${h.items.map(x => `<div class="uni-row${x.late ? " late" : ""}" style="--tone:${x.tone}"><span class="uni-ic">${x.icon}</span><span class="grow"><b>${esc(x.text)}</b><small>${esc(x.sub)}</small></span></div>`).join("")}</div>` : `<p class="hos-hint">✅ Nothing needs you in ${esc(h.name)}.</p>`}`
      : `<p class="hos-hint">You haven't started ${esc(h.name)} on this phone yet.</p>`}
    <a class="btn uni-open" href="${esc(hubHref(h.url))}" style="--tone:${h.tone}">${h.set ? "Open" : "Start"} ${esc(h.name)} ›</a></div>`;
  el.classList.remove("hidden");
}
function hidePlanet() { const el = document.getElementById("uniSheet"); if (el) el.classList.add("hidden"); UNI_OPEN = null; }
if (typeof document !== "undefined") document.addEventListener("click", e => {
  if (typeof MODE === "undefined" || MODE !== "universe") return;
  const b = e.target.closest && e.target.closest("[data-uniplanet],[data-uniclose],[data-unigo]"); if (!b) return;
  if (b.dataset.uniclose) { hidePlanet(); return; }
  if (b.dataset.unigo) { const h = UNI_HUBS.find(x => x[0] === b.dataset.unigo); if (h) location.href = hubHref(h[5]()); return; }
  showPlanet(b.dataset.uniplanet);
});
