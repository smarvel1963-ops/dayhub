/* SAVE AS: home.js · LOCATION: C:/MarvelApps/dayhub/home.js
 * HOME HUB (app #4 of the Hub family, Scott 2026-10-11: logo + "Home Hub — Complete App Structure"
 * plan, saved verbatim in C:/MarvelDesktop/docs/HOME_HUB_PLAN_FROM_OUTSIDE_CHAT_2026-10-11.md).
 * Runs at /homehub/ with window.DH_MODE = "home". Release 1 = HOME STRUCTURE (plan section 10, step 1):
 *   - "Set up your home": property type + tick the rooms and outdoor spaces (plan section 7)
 *   - dashboard: Indoors / Outdoors / Whole-home systems, a card per space (plan sections 1-3, 5)
 *   - every space opens its own page: Overview · Items · Tasks · Notes (the first 4 of the 12 things, section 4)
 *   - add / rename / move / remove spaces, custom names and floors
 * Everything lives in S.house on this phone (S.home is Day Hub's upkeep CARD key - never reuse it).
 * Nothing here is guessed about the user's home: every number on screen is counted from what they typed.
 */
"use strict";
const HOME_TYPES = [["house", "🏡 House"], ["apartment", "🏢 Apartment"], ["condo", "🏙️ Condo"]];
const HOME_AREAS = [["indoor", "🛋️ Indoors"], ["outdoor", "🌳 Outdoors"], ["systems", "⚙️ Whole-home systems"]];
// key, icon, name, what it covers (words from the plan, sections 2, 3 and 5)
const HOME_SPACES = {
  indoor: [
    ["living", "🛋️", "Living Room", "Furniture, electronics, flooring, lighting, décor, cleaning"],
    ["kitchen", "🍳", "Kitchen", "Appliances, cabinets, pantry, countertops, plumbing, warranties"],
    ["dining", "🍽️", "Dining Room", "Table, chairs, lighting, flooring"],
    ["main_bed", "🛏️", "Main Bedroom", "Furniture, mattress, closet, linens"],
    ["guest_bed", "🛏️", "Guest Bedroom", "Furniture, mattress, closet, linens"],
    ["kids_bed", "🧸", "Kids' Bedroom", "Furniture, closet, toys, storage"],
    ["bath", "🛁", "Bathroom", "Fixtures, toilet, faucets, drains, ventilation, supplies"],
    ["half_bath", "🚽", "Half Bath", "Toilet, sink, fixtures, supplies"],
    ["laundry", "🧺", "Laundry Room", "Washer, dryer, lint vent, detergents"],
    ["office", "💻", "Home Office", "Computers, networking, furniture, equipment"],
    ["pantry", "🥫", "Pantry", "Food storage, shelving, supplies"],
    ["entry", "🚪", "Entryway", "Doors, locks, coat storage, lighting"],
    ["nursery", "🍼", "Nursery", "Crib, furniture, supplies"],
    ["game", "🎮", "Game Room", "Electronics, furniture, games"],
    ["attic", "📦", "Attic", "Storage, insulation, ventilation"],
    ["basement", "🏚️", "Basement", "Storage, sump pump, foundation, moisture"],
  ],
  outdoor: [
    ["front_yard", "🌷", "Front Yard", "Grass, mowing, irrigation, trees, shrubs, flowers"],
    ["backyard", "🌳", "Backyard", "Fences, lawn, gardens, playground, outdoor lighting"],
    ["patio", "🪑", "Patio, Deck & Porch", "Furniture, grill, staining, pressure washing"],
    ["garage", "🚗", "Garage", "Tools, storage, garage door, workbench"],
    ["workshop", "🛠️", "Workshop", "Tools, equipment, workbench, safety"],
    ["pool", "🏊", "Pool & Spa", "Water chemistry, filters, pumps, cleaning"],
    ["driveway", "🛣️", "Driveway & Walkways", "Pavement, cracks, sealing, snow and ice"],
    ["garden", "🥕", "Garden", "Beds, plants, watering, seasonal care"],
    ["roof", "🏠", "Roof & Gutters", "Shingles, gutters, downspouts, leaks"],
    ["shed", "🛖", "Shed", "Storage, equipment, door, roof"],
  ],
  systems: [
    ["hvac", "🌡️", "HVAC & Climate", "Heating, cooling, filters, thermostats, service history"],
    ["electrical", "⚡", "Electrical", "Breakers, panel, outlets, wiring, inspections"],
    ["plumbing", "🚰", "Plumbing", "Water heater, pipes, drains, shutoff valves, leaks"],
    ["security", "🔒", "Home Security", "Locks, cameras, alarms, smoke and CO detectors"],
  ],
};
const HOME_DEFAULT = ["living", "kitchen", "main_bed", "bath", "laundry", "garage", "front_yard", "backyard"];   // the plan's 8 ticked
const HOME_REPEAT = [["", "Once"], ["1", "Every month"], ["3", "Every 3 months"], ["6", "Every 6 months"], ["12", "Every year"]];
const HOME_TABS = [["overview", "🏠", "Overview"], ["items", "📦", "Items"], ["tasks", "🧰", "Tasks"], ["notes", "📝", "Notes"]];
let HOME_OPEN = null, HOME_TAB = "overview";

const homeCatalog = () => Object.entries(HOME_SPACES).flatMap(([area, list]) => list.map(([key, icon, name, what]) => ({ key, icon, name, what, area })));
const homeCat = key => homeCatalog().find(c => c.key === key);
function house() {
  if (!S.house || typeof S.house !== "object") S.house = { type: "", spaces: [] };
  if (!Array.isArray(S.house.spaces)) S.house.spaces = [];
  S.house.spaces.forEach(sp => { sp.items = Array.isArray(sp.items) ? sp.items : []; sp.tasks = Array.isArray(sp.tasks) ? sp.tasks : []; sp.notes = sp.notes || ""; });
  return S.house;
}
const homeSet = () => !!(S.house && S.house.spaces && S.house.spaces.length);
const newSpace = (cat, name, floor) => ({ id: uid(), key: cat ? cat.key : "custom", icon: cat ? cat.icon : "🚪", name: (name || (cat && cat.name) || "My space").trim().slice(0, 60),
  area: cat ? cat.area : "indoor", floor: (floor || "").trim().slice(0, 30), items: [], tasks: [], notes: "" });
const spaceById = id => house().spaces.find(s => s.id === id);
const openTasks = sp => sp.tasks.filter(t => !t.done);
const dueSoon = t => t.due && t.due <= addDays(today(), 14);
function homeUpcoming(n) {
  return house().spaces.flatMap(sp => openTasks(sp).filter(t => t.due).map(t => ({ sp, t })))
    .sort((a, b) => a.t.due.localeCompare(b.t.due)).slice(0, n);
}
const dueText = d => { const n = daysUntil(d); return n < 0 ? `${-n} day${n === -1 ? "" : "s"} late` : n === 0 ? "today" : n === 1 ? "tomorrow" : `${prettyDate(d)}`; };

// ------------------------------------------------------------ first run: set up your home
function homeSetupHtml() {
  const box = (c, on) => `<label class="home-pick"><input type="checkbox" name="sp_${c.key}" ${on ? "checked" : ""}> ${c.icon} ${esc(c.name)}</label>`;
  const group = area => `<p class="sub" style="margin:10px 0 4px"><b>${HOME_AREAS.find(a => a[0] === area)[1]}</b></p><div class="home-picks">`
    + homeCatalog().filter(c => c.area === area).map(c => box(c, HOME_DEFAULT.includes(c.key))).join("") + `</div>`;
  return `<section class="card welcome"><h2>Welcome to Home Hub 🏡</h2>
    <p>Know your home. Fix it. Improve it. Protect it. Pick your rooms and outdoor spaces — you can add, rename or remove any of them later.</p>
    <form class="qa-form" data-homesetup="1">
      <input name="name" placeholder="Your first name" autocomplete="given-name">
      <input name="city" placeholder="City or ZIP for weather (e.g. 72032)" required>
      <label class="field">Property type <select name="type">${HOME_TYPES.map(([k, l]) => `<option value="${k}">${l}</option>`).join("")}</select></label>
      ${group("indoor")}${group("outdoor")}
      <p class="fine" style="margin-top:6px">Whole-home systems (HVAC, electrical, plumbing, security) are added for you.</p>
      <button class="btn">Build my home</button></form></section>`;
}

// ------------------------------------------------------------ the dashboard
function homeDashHtml() {
  const h = house(), sp = h.spaces, items = sp.reduce((n, s) => n + s.items.length, 0), tasks = sp.reduce((n, s) => n + openTasks(s).length, 0);
  const soon = sp.reduce((n, s) => n + openTasks(s).filter(dueSoon).length, 0);
  const tile = (v, l, sub) => `<div class="home-stat"><b>${v}</b><span>${l}</span>${sub ? `<small>${sub}</small>` : ""}</div>`;
  const up = homeUpcoming(3);
  const upHtml = up.length ? up.map(({ sp: s, t }) => `<button class="row home-up" data-hspace="${s.id}" data-htabgo="tasks"><span class="ci">${s.icon}</span><div class="grow"><b>${esc(t.title)}</b><span class="sub">${esc(s.name)}</span></div>
      <span class="pill ${t.due < today() ? "late" : dueSoon(t) ? "soon" : ""}">${dueText(t.due)}</span></button>`).join("")
    : `<p class="fine" style="margin:0">No tasks with a date yet. Open any room and add one — like “Change HVAC air filter”.</p>`;
  const typeName = (HOME_TYPES.find(t => t[0] === h.type) || [, "🏡 My home"])[1];
  return `<section class="card home-dash"><h3><span class="ci">🏡</span>${esc(typeName.replace(/^\S+\s/, "My "))}<span class="meta">Property overview</span></h3>
    <div class="body"><div class="home-stats">${tile(sp.length, "Rooms & spaces")}${tile(items, "Items tracked")}${tile(tasks, "Open tasks", soon ? `${soon} due soon` : "")}</div>
    <p class="sub" style="margin:12px 0 6px"><b>⏰ Coming up</b></p>${upHtml}</div></section>`
    + (typeof hpvCardHtml === "function" ? hpvCardHtml() : "")
    + HOME_AREAS.map(([area, label]) => homeAreaHtml(area, label)).join("");
}
function homeAreaHtml(area, label) {
  const list = house().spaces.filter(s => s.area === area);
  return `<section class="card home-area" data-harea="${area}"><h3><span class="ci">${label.split(" ")[0]}</span>${label.replace(/^\S+\s/, "")}<span class="meta">${list.length}</span></h3>
    <div class="body"><div class="home-grid">${list.map(s => {
      const o = openTasks(s), late = o.some(t => t.due && t.due < today());
      return `<button class="home-space" data-hspace="${s.id}"><span class="hs-ic">${s.icon}</span><b>${esc(s.name)}</b>
        <small>${s.items.length} item${s.items.length === 1 ? "" : "s"} · ${o.length} task${o.length === 1 ? "" : "s"}${late ? " · ⚠️" : ""}</small>${s.floor ? `<small>${esc(s.floor)}</small>` : ""}</button>`;
    }).join("")}<button class="home-space add" data-haddspace="${area}"><span class="hs-ic">＋</span><b>Add</b><small>${area === "systems" ? "a system" : area === "outdoor" ? "an outdoor space" : "a room"}</small></button></div></div></section>`;
}

// ------------------------------------------------------------ one space = its own mini-hub
function homeSheet() {
  let el = document.getElementById("homeSheet");
  if (!el) { el = document.createElement("div"); el.id = "homeSheet"; el.className = "sheet"; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); document.body.appendChild(el); }
  return el;
}
function hideHomeSheet() { const el = document.getElementById("homeSheet"); if (el) el.classList.add("hidden"); HOME_OPEN = null; }
function showSpace(id, tab) {
  const sp = spaceById(id); if (!sp) return;
  HOME_OPEN = id; if (tab) HOME_TAB = tab;
  const el = homeSheet(); el.setAttribute("aria-label", sp.name);
  const tabs = `<nav class="seg home-tabs">${HOME_TABS.map(([k, i, l]) => `<button class="${HOME_TAB === k ? "on" : ""}" data-htab="${k}">${i} ${l}</button>`).join("")}</nav>`;
  el.innerHTML = `<div class="sheet-body"><div class="grab"></div>
    <div class="sheet-head"><h2>${sp.icon} ${esc(sp.name)}</h2><button class="icon-btn" data-hclose="1" aria-label="Close">✕</button></div>
    <p class="sub" style="margin-top:-6px">${(HOME_AREAS.find(a => a[0] === sp.area) || [, ""])[1]}${sp.floor ? ` · ${esc(sp.floor)}` : ""}</p>
    ${tabs}<div class="home-pane">${spacePane(sp)}</div></div>`;
  el.classList.remove("hidden");
}
function spacePane(sp) {
  if (HOME_TAB === "items") return `${sp.items.length ? sp.items.map(it => `<div class="row"><span class="ci">📦</span><div class="grow"><b>${esc(it.name)}</b>
      ${it.model || it.note ? `<span class="sub">${esc([it.model, it.note].filter(Boolean).join(" · "))}</span>` : ""}</div><button class="icon-btn" data-hdel="item:${it.id}" aria-label="Remove">✕</button></div>`).join("")
      : `<p class="fine">Nothing listed yet. Add what's in this ${sp.area === "indoor" ? "room" : "space"} — appliances, fixtures, furniture, equipment.</p>`}
    <form class="qa-form" data-hitem="${sp.id}"><input name="name" placeholder="Item, e.g. Refrigerator" required>
      <input name="model" placeholder="Brand / model (optional)"><input name="note" placeholder="Note — size, color, where (optional)"><button class="btn sm">Add item</button></form>`;
  if (HOME_TAB === "tasks") {
    const o = openTasks(sp).slice().sort((a, b) => (a.due || "9999").localeCompare(b.due || "9999")), done = sp.tasks.filter(t => t.done).slice(-5).reverse();
    return `${o.length ? o.map(t => `<div class="row"><button class="check" data-hdone="${t.id}" aria-label="Done">○</button><div class="grow"><b>${esc(t.title)}</b>
        <span class="sub">${t.due ? `Due ${dueText(t.due)}` : "No date"}${t.every ? ` · every ${t.every === 1 ? "month" : `${t.every} months`}` : ""}</span></div>
        <button class="icon-btn" data-hdel="task:${t.id}" aria-label="Remove">✕</button></div>`).join("")
      : `<p class="fine">No open tasks. Add maintenance, cleaning or a repair to remember.</p>`}
      <form class="qa-form" data-htask="${sp.id}"><input name="title" placeholder="Task, e.g. Clean dishwasher filter" required>
        <label class="field">Due <input type="date" name="due"></label>
        <label class="field">Repeat <select name="every">${HOME_REPEAT.map(([v, l]) => `<option value="${v}">${l}</option>`).join("")}</select></label>
        <button class="btn sm">Add task</button></form>
      ${done.length ? `<p class="sub" style="margin-top:10px"><b>Done lately</b></p>${done.map(t => `<div class="row"><span class="ci">✅</span><div class="grow">${esc(t.title)}<span class="sub">${t.doneOn ? prettyDate(t.doneOn) : ""}</span></div></div>`).join("")}` : ""}`;
  }
  if (HOME_TAB === "notes") return `<p class="fine" style="margin-top:0">Ideas, paint colors, measurements, who to call, history — anything about this ${sp.area === "indoor" ? "room" : "space"}.</p>
    <textarea class="home-notes" data-hnotes="${sp.id}" rows="8" placeholder="Notes…">${esc(sp.notes)}</textarea>`;
  const o = openTasks(sp), next = o.filter(t => t.due).sort((a, b) => a.due.localeCompare(b.due))[0], cat = homeCat(sp.key);
  return `<div class="home-stats">${[[sp.items.length, "Items"], [o.length, "Open tasks"], [sp.tasks.filter(t => t.done).length, "Done"]].map(([v, l]) => `<div class="home-stat"><b>${v}</b><span>${l}</span></div>`).join("")}</div>
    ${next ? `<p style="margin:10px 0 0"><b>Next:</b> ${esc(next.title)} · ${dueText(next.due)}</p>` : ""}
    ${cat ? `<p class="fine" style="margin-top:8px">Covers: ${esc(cat.what)}.</p>` : ""}
    <form class="qa-form" data-hrename="${sp.id}" style="margin-top:10px"><input name="name" value="${esc(sp.name)}" required aria-label="Name">
      <input name="floor" value="${esc(sp.floor)}" placeholder="Floor or location, e.g. Upstairs" aria-label="Floor">
      <button class="btn sm ghost">Save name</button></form>
    <button class="btn sm ghost" data-hrmspace="${sp.id}" style="margin-top:10px">Remove this space</button>`;
}

// ------------------------------------------------------------ add a space
function showAddSpace(area) {
  const el = homeSheet(); HOME_OPEN = null;
  const have = new Set(house().spaces.map(s => s.key));
  const picks = homeCatalog().filter(c => c.area === area && (!have.has(c.key) || ["guest_bed", "kids_bed", "bath", "half_bath"].includes(c.key)));
  el.setAttribute("aria-label", "Add a space");
  el.innerHTML = `<div class="sheet-body"><div class="grab"></div>
    <div class="sheet-head"><h2>＋ Add ${area === "systems" ? "a system" : area === "outdoor" ? "an outdoor space" : "a room"}</h2><button class="icon-btn" data-hclose="1" aria-label="Close">✕</button></div>
    <div class="home-picks">${picks.map(c => `<button class="home-pick btn sm ghost" data-hpick="${c.key}">${c.icon} ${esc(c.name)}</button>`).join("") || `<p class="fine">All the usual ones are added.</p>`}</div>
    <p class="sub" style="margin:12px 0 4px"><b>Or name your own</b></p>
    <form class="qa-form" data-hcustom="${area}"><input name="name" placeholder="e.g. Upstairs Guest Bedroom" required>
      <input name="floor" placeholder="Floor or location (optional)"><button class="btn sm">Add</button></form></div>`;
  el.classList.remove("hidden");
}

// ------------------------------------------------------------ events (ui.js calls these first)
function homeClick(ds) {
  if (MODE !== "home") return false;
  if (ds.hspace) { showSpace(ds.hspace, ds.htabgo || "overview"); return true; }
  if (ds.hclose) { hideHomeSheet(); render(); return true; }
  if (ds.htab) { HOME_TAB = ds.htab; if (HOME_OPEN) showSpace(HOME_OPEN); return true; }
  if (ds.haddspace) { showAddSpace(ds.haddspace); return true; }
  if (ds.hpick) { const c = homeCat(ds.hpick); if (!c) return true;
    const n = house().spaces.filter(s => s.key === c.key).length;
    const sp = newSpace(c, n ? `${c.name} ${n + 1}` : c.name); house().spaces.push(sp); save(); render(); showSpace(sp.id, "overview"); toast(`${c.icon} ${sp.name} added`); return true; }
  if (ds.hdone && HOME_OPEN) { const sp = spaceById(HOME_OPEN), t = sp && sp.tasks.find(x => x.id === ds.hdone); if (!t) return true;
    if (t.every && t.due) { t.last = today(); t.due = addMonths(t.due < today() ? today() : t.due, t.every); toast(`✓ Done — next ${prettyDate(t.due)}`); }
    else { t.done = true; t.doneOn = today(); toast("✓ Done"); }
    save(); showSpace(HOME_OPEN); render(); return true; }
  if (ds.hdel && HOME_OPEN) { const sp = spaceById(HOME_OPEN); if (!sp) return true; const [kind, id] = ds.hdel.split(":");
    if (kind === "item") sp.items = sp.items.filter(x => x.id !== id); else sp.tasks = sp.tasks.filter(x => x.id !== id);
    save(); showSpace(HOME_OPEN); render(); return true; }
  if (ds.hrmspace) { const sp = spaceById(ds.hrmspace); if (!sp) return true;
    if (!confirmRemove(sp)) return true;
    house().spaces = house().spaces.filter(s => s.id !== sp.id); hideHomeSheet(); save(); render(); toast(`${sp.name} removed`); return true; }
  return false;
}
// Removing a space with things in it asks once (a tap on the same button within 5 s confirms).
let HOME_RM = null;
function confirmRemove(sp) {
  if (!sp.items.length && !sp.tasks.length && !sp.notes) return true;
  if (HOME_RM === sp.id) { HOME_RM = null; return true; }
  HOME_RM = sp.id; setTimeout(() => { if (HOME_RM === sp.id) HOME_RM = null; }, 5000);
  toast(`${sp.name} has ${sp.items.length} items and ${sp.tasks.length} tasks — tap Remove again to delete it`); return false;
}
function homeSubmit(f, data) {
  if (MODE !== "home") return false;
  if (f.dataset.homesetup) {
    S.name = (data.name || "").trim(); S.city = (data.city || "").trim(); S.pack = "general";
    const h = house(); h.type = HOME_TYPES.some(t => t[0] === data.type) ? data.type : "house";
    const picked = homeCatalog().filter(c => c.area !== "systems" && data["sp_" + c.key]);
    h.spaces = [...picked, ...homeCatalog().filter(c => c.area === "systems")].map(c => newSpace(c));
    save(); WXDATA = null; render(); loadWeather(); toast(`🏡 Your home is set — ${picked.length} spaces`); return true;
  }
  if (f.dataset.hitem) { const sp = spaceById(f.dataset.hitem), name = (data.name || "").trim(); if (!sp || !name) return true;
    sp.items.push({ id: uid(), name: name.slice(0, 80), model: (data.model || "").trim().slice(0, 80), note: (data.note || "").trim().slice(0, 160), added: today() });
    save(); showSpace(sp.id, "items"); render(); toast(`📦 ${name} added`); return true; }
  if (f.dataset.htask) { const sp = spaceById(f.dataset.htask), title = (data.title || "").trim(); if (!sp || !title) return true;
    const every = Number(data.every) || 0, due = /^\d{4}-\d{2}-\d{2}$/.test(data.due || "") ? data.due : (every ? today() : "");
    sp.tasks.push({ id: uid(), title: title.slice(0, 100), due, every, done: false });
    save(); showSpace(sp.id, "tasks"); render(); toast(`🧰 ${title} added`); return true; }
  if (f.dataset.hrename) { const sp = spaceById(f.dataset.hrename), name = (data.name || "").trim(); if (!sp || !name) return true;
    sp.name = name.slice(0, 60); sp.floor = (data.floor || "").trim().slice(0, 30); save(); showSpace(sp.id); render(); toast("Saved ✓"); return true; }
  if (f.dataset.hcustom) { const name = (data.name || "").trim(); if (!name) return true;
    const area = HOME_AREAS.some(a => a[0] === f.dataset.hcustom) ? f.dataset.hcustom : "indoor";
    const sp = newSpace(null, name, data.floor); sp.area = area; sp.icon = area === "outdoor" ? "🌿" : area === "systems" ? "⚙️" : "🚪";
    house().spaces.push(sp); save(); render(); showSpace(sp.id, "overview"); toast(`${sp.icon} ${sp.name} added`); return true; }
  return false;
}
// Notes save as you type (input events), no button.
function homeInput(t) {
  if (MODE !== "home" || !t.dataset || !t.dataset.hnotes) return false;
  const sp = spaceById(t.dataset.hnotes); if (!sp) return true;
  sp.notes = String(t.value || "").slice(0, 5000); save(); return true;
}
function addMonths(day, n) {
  const d = parseDay(day), want = d.getMonth() + Number(n);
  const x = new Date(d.getFullYear(), want, 1), last = new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate();
  x.setDate(Math.min(d.getDate(), last));
  return ymd(x);
}
