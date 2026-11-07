/* SAVE AS: hometiles.js · LOCATION: C:/MarvelApps/dayhub/hometiles.js
 * HOME HUB NEW LOOK - "Lamplight" (Scott 11/06: his own ChatGPT board, then "Home Hub" = build it next). A warm house at dusk: deep forest-green
 * bars with brass edges, cream cards, glossy coloured tiles with white line icons, a painted picture at the top of each inner screen
 * (../homehub/art/, made on OpenArt for this look: no brands, text or people).
 *   HOME  = the house logo, the Your House card (spaces, the next thing due, tonight's weather warning), his 12 tiles in his order
 *           (Rooms, Outdoors, Systems, Upkeep, Coming Up, Home Value, Bills Due, To-Do, Lists, Weather, Ask Home Hub, Add a Space),
 *           then Coming up one scroll down.
 *   TABS  = Home | Rooms | Upkeep | Money | More (his board). Home Hub had no tab bar; it runs on the shell while this look is on (as Auto Hub's does).
 *   FULL SCREENS (back arrow, no tab bar, a picture across the top, as on his board): a room (Overview / Items / Tasks / Notes, home.js's own
 *           pane and forms), Coming Up, Home Value, Bills Due, To-Do, Lists, Weather.
 * Everything opens what Home Hub already has (home.js, homevalue.js, the shared cards). Nothing new is stored; nothing is worked out a new way.
 * SWITCH: HT_ON = false - customers keep the classic look and fetch none of the art. A phone gets it with ?look=tiles (kept in homehub.look),
 * by holding Scott Hub or the owner's OK (once), or with five quick taps on the app's name at the bottom of Settings. More -> Classic Look turns
 * it back. Home Hub only, and only once the home is set up (the first-run screen stays the classic one).
 * Loaded by ../homehub/index.html after home.js (+ hometiles.css). Hooks: shell.js shellOn / shellGo / shellHtml / paintTabs, each guarded;
 * home.js showSpace / hideHomeSheet are wrapped so a room opens as a full screen (the old sheet when the look is off).
 * DEPLOY ORDER: push dayhub first and let Pages publish, then homehub (its page, its worker and the art).
 */
"use strict";

const HT_ON = false;                 // THE SWITCH: true = everyone on Home Hub gets the new look (Scott's go only)
const HT_KEY = "homehub.look";
(function htFromLink() {             // ?look=tiles|classic sets this phone's look, then leaves the address as it was
  try {
    const u = new URL(location.href), v = u.searchParams.get("look");
    if (v !== "tiles" && v !== "classic") return;
    localStorage.setItem(HT_KEY, v); u.searchParams.delete("look");
    history.replaceState(null, "", u.pathname + (u.search || "") + u.hash);
  } catch (e) { /* private mode: the link just doesn't stick */ }
})();
const htPick = () => { try { return localStorage.getItem(HT_KEY); } catch (e) { return null; } };
// A phone that may flip the look by five taps (as Auto Hub's atOwnerish): it already picked a look, or it holds Scott Hub or the owner's OK.
const htOwnerish = () => { try { return !!htPick() || !!localStorage.getItem("scotthub.k") || localStorage.getItem("dayhub.ownerok") === "1"; } catch (e) { return false; } };
let HT_OWNER_CHECKED = false;
function htOwnerOnce() {             // the owner's phone turns it on by itself, once; after that Classic Look sticks. Customers have neither key.
  if (HT_OWNER_CHECKED) return; HT_OWNER_CHECKED = true;
  try {
    if (localStorage.getItem("homehub.ownerlook") || !(localStorage.getItem("scotthub.k") || localStorage.getItem("dayhub.ownerok") === "1")) return;
    localStorage.setItem("homehub.ownerlook", "1"); localStorage.setItem(HT_KEY, "tiles");
  } catch (e) { /* private mode */ }
}
function htOn() {                    // never calls shellOn() - shellOn() calls this
  if (typeof MODE === "undefined" || MODE !== "home" || typeof S === "undefined" || !S || S.simple) return false;
  if (typeof homeSet !== "function" || !homeSet()) return false;           // the first-run "Set up your home" stays the classic screen
  htOwnerOnce();
  return HT_ON ? htPick() !== "classic" : htPick() === "tiles";
}

// ---- drawn icons (white line icons on his glossy coloured tiles)
const HT_SVG = p => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const HI = {
  home: HT_SVG('<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>'),
  sofa: HT_SVG('<path d="M5 11V8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v3"/><path d="M3 12a2 2 0 0 1 4 0v2h10v-2a2 2 0 0 1 4 0v5H3z"/><path d="M5 17v2M19 17v2"/>'),
  trees: HT_SVG('<path d="M8 3l4 6H9.5l3 4.5H3.5l3-4.5H4z"/><path d="M8 13.500V17"/><path d="M16 6l3.500 5H17.500l2.500 4h-7l2.500-4H14z"/><path d="M16.500 15v2"/><path d="M2 17h20M3 17v3M21 17v3M7 17v3M11 17v3M15 17v3"/>'),
  gear: HT_SVG('<circle cx="12" cy="12" r="3"/><path d="M12 2.500v2.200M12 19.300v2.200M4.200 4.200l1.600 1.600M18.200 18.200l1.600 1.600M2.500 12h2.200M19.300 12h2.200M4.200 19.800l1.600-1.600M18.200 5.800l1.600-1.600"/><circle cx="12" cy="12" r="6.500"/>'),
  tools: HT_SVG('<path d="M14.500 6.500a4 4 0 0 1 5-1.200l-2.700 2.700 1.800 1.800 2.700-2.700a4 4 0 0 1-5.300 5.200L8 20.500a1.900 1.900 0 0 1-2.700-2.700l8.200-7.900a4 4 0 0 1 1-3.400z"/><path d="M4 4l5 5M3 7l3-3"/>'),
  cal: HT_SVG('<rect x="3.500" y="5" width="17" height="15.500" rx="2"/><path d="M3.500 10h17M8 3v4M16 3v4"/><path d="M7.500 13.500h2M11 13.500h2M14.500 13.500h2M7.500 17h2M11 17h2"/>'),
  chart: HT_SVG('<path d="M4 20h16"/><path d="M6 16l4-4 3 3 5-6"/><path d="M15 9h3v3"/><rect x="5" y="16" width="2" height="4"/><rect x="9.500" y="13" width="2" height="7"/><rect x="14" y="14" width="2" height="6"/>'),
  bill: HT_SVG('<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4"/><path d="M12.500 9.500c-.6-.6-1.400-.8-2.200-.6-.9.2-1.400 1-1.100 1.800.3.700 1.200.9 2 1.100.900.200 1.700.6 1.700 1.500 0 .900-.900 1.500-2 1.500-.8 0-1.500-.3-2-.8M10.500 8v1M10.500 15v1"/>'),
  check: HT_SVG('<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 12.500l3 3 5.500-6"/>'),
  list: HT_SVG('<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.500" cy="6" r="1.200"/><circle cx="4.500" cy="12" r="1.200"/><circle cx="4.500" cy="18" r="1.200"/>'),
  weather: HT_SVG('<path d="M7 18h10a4 4 0 0 0 .4-8 5.500 5.500 0 0 0-10.600 1.500A3.300 3.300 0 0 0 7 18z"/><path d="M15 4.500V3M19.500 6.500l1-1M21 11h1.500"/>'),
  ask: HT_SVG('<path d="M4 5h16v11H9l-5 4z"/><path d="M12 8v5M9.500 10.500h5"/>'),
  plus: HT_SVG('<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>'),
  bed: HT_SVG('<path d="M3 18V7M3 13h18v5M21 18v-3a3 3 0 0 0-3-3h-7v1"/><circle cx="7" cy="10.500" r="1.800"/>'),
  coins: HT_SVG('<ellipse cx="12" cy="6.500" rx="7" ry="2.800"/><path d="M5 6.500v4c0 1.500 3.100 2.800 7 2.800s7-1.300 7-2.800v-4"/><path d="M5 10.500v4c0 1.500 3.100 2.800 7 2.800s7-1.300 7-2.800v-4"/>'),
  grid: HT_SVG('<rect x="4" y="4" width="6.500" height="6.500" rx="1.500"/><rect x="13.500" y="4" width="6.500" height="6.500" rx="1.500"/><rect x="4" y="13.500" width="6.500" height="6.500" rx="1.500"/><rect x="13.500" y="13.500" width="6.500" height="6.500" rx="1.500"/>'),
  bell: HT_SVG('<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 20a2 2 0 0 0 4 0"/>'),
  palette: HT_SVG('<path d="M12 3a9 9 0 1 0 0 18c1.200 0 1.800-.8 1.800-1.700 0-.6-.3-1-.6-1.400-.3-.4-.5-.8-.5-1.300 0-1 .8-1.800 1.800-1.800H17a4 4 0 0 0 4-4C21 6.500 17 3 12 3z"/><circle cx="7.500" cy="11" r="1"/><circle cx="10" cy="7.500" r="1"/><circle cx="14.500" cy="7.500" r="1"/>'),
  star: HT_SVG('<path d="M12 3.500l2.600 5.300 5.800.8-4.200 4.100 1 5.800L12 16.800l-5.200 2.700 1-5.800-4.200-4.100 5.800-.8z"/>'),
  people: HT_SVG('<circle cx="9" cy="8.500" r="3"/><path d="M3.500 19c.6-3 2.800-4.800 5.500-4.800s4.900 1.800 5.500 4.800"/><circle cx="17" cy="9.500" r="2.300"/><path d="M15.500 14.500c2.300 0 4.300 1.500 5 4"/>'),
  back: HT_SVG('<path d="M15 5l-7 7 7 7"/>'),
};
const HT_LOGO = `<svg viewBox="0 0 48 44" aria-hidden="true"><path d="M4 22L24 5l20 17" fill="none" stroke="#f0a43a" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M10 20v19a2 2 0 0 0 2 2h24a2 2 0 0 0 2-2V20L24 8z" fill="#fff7e6"/><rect x="20" y="27" width="8" height="14" rx="1" fill="#7a4a1e"/><rect x="13" y="24" width="5" height="5" rx=".8" fill="#f6c560"/><rect x="30" y="24" width="5" height="5" rx=".8" fill="#f6c560"/>
  <rect x="31" y="9" width="4" height="7" fill="#fff7e6"/></svg>`;
const HT_TABS = [["home", HI.home, "Home"], ["rooms", HI.bed, "Rooms"], ["upkeep", HI.tools, "Upkeep"], ["money", HI.coins, "Money"], ["more", HI.grid, "More"]];
const HT_TAB_NAME = { home: "Home", rooms: "Rooms", upkeep: "Upkeep", money: "Money", more: "More" };
const HT_CHEV = `<span class="chev" aria-hidden="true">›</span>`;

// ---- the pictures (one per kind of space; a space with no picture keeps its own icon)
const HT_ART = ["home", "kitchen", "living", "bedroom", "bathroom", "laundry", "backyard", "garage", "garden", "systems", "toolbox", "value", "weather", "bills"];
const HT_SPACE_ART = { kitchen: "kitchen", living: "living", dining: "living", office: "living", entry: "living", nursery: "bedroom", game: "living",
  main_bed: "bedroom", guest_bed: "bedroom", kids_bed: "bedroom", bath: "bathroom", half_bath: "bathroom", laundry: "laundry", pantry: "laundry", attic: "laundry", basement: "laundry",
  front_yard: "backyard", backyard: "backyard", patio: "backyard", pool: "backyard", driveway: "backyard", roof: "backyard", shed: "garage", garage: "garage", workshop: "garage",
  garden: "garden", hvac: "systems", electrical: "systems", plumbing: "systems", security: "systems" };
const htSpaceArt = sp => HT_SPACE_ART[sp.key] || (sp.area === "outdoor" ? "backyard" : sp.area === "systems" ? "systems" : "living");
let HT_ART_ASKED = false;
function htPreloadArt() {            // only on a phone with the new look on, and only with pictures on; the worker keeps them
  if (HT_ART_ASKED || S.photo === false) return; HT_ART_ASKED = true;
  HT_ART.forEach(n => fetch(`art/${n}.webp`).catch(() => {}));
}
const htBand = (art, alt) => S.photo === false ? "" : `<div class="ht-band" style="background-image:url('art/${art}.webp')" role="img" aria-label="${esc(alt || "")}"></div>`;
const htYmd = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ""));

function htTopHtml(home) {
  return `<div class="ht-top"><span class="ht-logo" aria-hidden="true">${HT_LOGO}</span>
    <div class="ht-brand"><b>Home Hub</b>${home ? "" : `<small>${esc(HT_TAB_NAME[TAB] || "")}</small>`}${navigator.onLine === false ? ` <span class="offline-pill">🟠 Offline</span>` : ""}</div>
    <button class="ht-gear" data-htgo="settings" aria-label="Settings">${HI.gear}</button></div>`;
}
// The hidden hero's must-see chips (new version, Install, Pro paused / ending, backup waiting), all of them for this one read.
function htNoticesHtml() {
  const was = CHIPS_ALL; CHIPS_ALL = true; let html = "";
  try { html = heroHtml(); } finally { CHIPS_ALL = was; }
  const box = document.createElement("template"); box.innerHTML = html;
  const keep = [...box.content.querySelectorAll(".chips > [data-update], .chips > [data-install], .chips > [data-prolapse], .chips > [data-cloudask]")];
  return keep.length ? `<div class="ht-notices">${keep.map(c => c.outerHTML).join("")}</div>` : "";
}

// ---- what's coming up: the rooms' dated tasks (home.js) and the Upkeep list (the Home card), in date order. Read only.
function htComing(within) {
  const t = today(), end = within != null ? addDays(t, within) : "9999-12-31";
  const rooms = house().spaces.flatMap(sp => openTasks(sp).filter(x => htYmd(x.due) && x.due <= end).map(x => ({ day: x.due, title: x.title, where: sp.name, icon: sp.icon, act: `data-hspace="${esc(sp.id)}" data-htabgo="tasks"` })));
  const up = typeof upkeepDue === "function" ? (S.upkeep || []).filter(x => x.area === "home").map(x => ({ x, day: upkeepNext(x) })).filter(o => htYmd(o.day) && o.day <= end)
    .map(({ x, day }) => ({ day, title: x.name, where: "Upkeep", icon: "🧰", act: 'data-shellgo="upkeep"' })) : [];
  return [...rooms, ...up].sort((a, b) => a.day.localeCompare(b.day));
}
const htWhen = d => { const n = daysUntil(d); return n < 0 ? `${-n} day${n === -1 ? "" : "s"} late` : n === 0 ? "today" : n === 1 ? "tomorrow" : `in ${n} days`; };
const htRow = x => `<button class="ht-row" ${x.act}><span class="ht-rowic" aria-hidden="true">${esc(x.icon)}</span><span class="grow"><b>${esc(x.title)}</b><small>${esc(x.where)} · ${esc(prettyDate(x.day))}</small></span>
    <span class="ht-pill ${daysUntil(x.day) < 0 ? "late" : daysUntil(x.day) <= 14 ? "soon" : ""}">${esc(htWhen(x.day))}</span></button>`;

// ---- YOUR HOUSE (his board): the home, its spaces, the next thing due, and tonight's weather warning when there is one
function htHouseCardHtml() {
  const h = house(), sp = h.spaces, typeName = (HOME_TYPES.find(x => x[0] === h.type) || [, "🏡 My home"])[1].replace(/^\S+\s/, "My ");
  const nx = htComing()[0];
  // the house's warning: tonight's freeze first; the day's own warnings only until 6 PM (the board's "Freeze tonight" strip)
  const al = typeof wxAlerts === "function" ? wxAlerts(today()) : [], late = new Date().getHours() >= 18;
  const wx = ["freeze", "ice", "snow", "storm", "heat", "wind"].filter(k => !late || k === "freeze").map(k => al.find(a => a.key === k)).find(Boolean) || null;
  return `<section class="ht-house"><h3><span class="ht-hic" aria-hidden="true">${HI.home}</span>Your House</h3>
    <button class="ht-housebody" data-shellgo="rooms"><b class="ht-hname">${esc(typeName)}</b>
      <span class="ht-hline"><span aria-hidden="true">🏠</span>${sp.length} space${sp.length === 1 ? "" : "s"}</span>
      <span class="ht-hline"><span aria-hidden="true">📅</span>${nx ? `Next due: ${esc(nx.title)} - ${esc(htWhen(nx.day))}` : "Nothing due yet. Add a task in any room"}</span></button>
    ${wx ? `<button class="ht-alert" data-htgo="weather"><span aria-hidden="true">${esc(wx.icon)}</span><span>${esc(wx.text)}</span></button>` : ""}</section>`;
}

// ---- the 12 tiles (his board, his order). Each opens what Home Hub already has.
function htTiles() {
  const sp = house().spaces, n = a => sp.filter(x => x.area === a).length, coming = htComing(14).length;
  return [
    ["sofa", "Rooms", 'data-shellgo="rooms" data-htarea="indoor"', `${n("indoor")}`, "t-rooms"],
    ["trees", "Outdoors", 'data-shellgo="rooms" data-htarea="outdoor"', `${n("outdoor")}`, "t-out"],
    ["gear", "Systems", 'data-shellgo="rooms" data-htarea="systems"', `${n("systems")}`, "t-sys"],
    ["tools", "Upkeep", 'data-shellgo="upkeep"', "", "t-up"],
    ["cal", "Coming Up", 'data-htgo="coming"', coming ? `${coming} soon` : "", "t-coming"],
    ["chart", "Home Value", 'data-htgo="value"', "", "t-value"],
    ["bill", "Bills Due", 'data-htgo="bills"', "", "t-bills"],
    ["check", "To-Do", 'data-htgo="todos"', "", "t-todo"],
    ["list", "Lists", 'data-htgo="lists"', "", "t-lists"],
    ["weather", "Weather", 'data-htgo="weather"', "", "t-wx"],
    ["ask", "Ask Home Hub", 'data-ask="open"', "", "t-ask"],
    ["plus", "Add a Space", 'data-haddspace="indoor"', "", "t-add"],
  ];
}
const htTileHtml = t => `<button class="ht-tile ${t[4] || ""}" ${t[2]}><span class="ht-ic" aria-hidden="true">${HI[t[0]] || ""}</span><b>${esc(t[1])}</b>${t[3] ? `<small>${esc(t[3])}</small>` : ""}</button>`;

function htHomeHtml() {
  const up = htComing(30).slice(0, 4);
  return `<section class="ht-hero">${htTopHtml(true)}${htHouseCardHtml()}</section>` + htNoticesHtml()
    + `<nav class="ht-grid ht-main" aria-label="Home Hub">${htTiles().map(htTileHtml).join("")}</nav>`
    + `<section class="ht-card ht-below"><h4>Coming up</h4>${up.length ? up.map(htRow).join("") : `<p class="ht-note">Nothing in the next 30 days. Open a room and add a task, like "Change HVAC filter".</p>`}
      <button class="ht-more-link" data-htgo="coming">See everything coming up ${HT_CHEV}</button></section>`;
}

// ---- ROOMS: Indoors / Outdoors / Systems, a picture tile per space (his board), the same counts as the old dashboard, Add on each
function htRoomsHtml() {
  const h = house(), all = h.spaces, items = all.reduce((n, s) => n + s.items.length, 0), open = all.reduce((n, s) => n + openTasks(s).length, 0);
  const tile = s => { const o = openTasks(s), late = o.some(t => t.due && t.due < today());
    return `<button class="ht-space" data-hspace="${esc(s.id)}">${S.photo === false ? `<span class="ht-spic" aria-hidden="true">${esc(s.icon)}</span>` : `<span class="ht-spimg" style="background-image:url('art/${htSpaceArt(s)}.webp')" aria-hidden="true"></span>`}
      <b>${esc(s.name)}</b><small>${s.items.length} item${s.items.length === 1 ? "" : "s"} · ${o.length} task${o.length === 1 ? "" : "s"}${late ? " · late" : ""}</small></button>`; };
  const group = ([area, label]) => { const list = all.filter(s => s.area === area);
    return `<h4 class="ht-group" id="ht-${area}"><span aria-hidden="true">${label.split(" ")[0]}</span> ${esc(label.replace(/^\S+\s/, ""))}<small>${list.length}</small></h4>
      <div class="ht-spaces">${list.map(tile).join("")}<button class="ht-space add" data-haddspace="${area}"><span class="ht-spic" aria-hidden="true">＋</span><b>Add</b><small>${area === "systems" ? "a system" : area === "outdoor" ? "an outdoor space" : "a room"}</small></button></div>`; };
  return `<section class="ht-stats"><div><b>${all.length}</b><small>Rooms & spaces</small></div><div><b>${items}</b><small>Items tracked</small></div><div><b>${open}</b><small>Open tasks</small></div></section>`
    + HOME_AREAS.map(group).join("");
}
// ---- UPKEEP: the Upkeep list (the Home card, with its Done buttons) and every room's open tasks in one list
function htUpkeepHtml(cardHtml) {
  const tasks = house().spaces.flatMap(sp => openTasks(sp).map(t => ({ sp, t }))).sort((a, b) => (a.t.due || "9999").localeCompare(b.t.due || "9999"));
  const card = cardHtml("home").replace('<span class="ci">🏠</span>Home<', '<span class="ci">🧰</span>Upkeep<');   // his board calls it Upkeep; the same card, its title only
  return htBand("toolbox", "A workbench with tools") + card
    + `<section class="ht-card"><h4>Room tasks</h4>${tasks.length ? tasks.map(({ sp, t }) => `<button class="ht-row" data-hspace="${esc(sp.id)}" data-htabgo="tasks"><span class="ht-rowic" aria-hidden="true">${esc(sp.icon)}</span>
        <span class="grow"><b>${esc(t.title)}</b><small>${esc(sp.name)}${t.every ? ` · every ${t.every === 1 ? "month" : `${esc(String(t.every))} months`}` : ""}</small></span>
        ${t.due ? `<span class="ht-pill ${t.due < today() ? "late" : dueSoon(t) ? "soon" : ""}">${esc(htWhen(t.due))}</span>` : `<span class="ht-pill">no date</span>`}</button>`).join("")
      : `<p class="ht-note">No open room tasks. Open a room to add one.</p>`}</section>`;
}
// ---- MONEY: Bills Due and Home Value, the cards Home Hub already has
function htMoneyHtml(cardHtml) {
  return cardHtml("bills") + (typeof hpvCardHtml === "function" ? hpvCardHtml() : "");
}
// ---- MORE: everything, by what it's for
const htPassOffered = () => switchOn("PRO_GATE") && !STORE_MODE;          // never in the Play app (no Pro wording outside ⚙ there)
function htMoreHtml(cardHtml) {
  const groups = [
    ["Your home", [["sofa", "Rooms", 'data-shellgo="rooms" data-htarea="indoor"', ""], ["trees", "Outdoors", 'data-shellgo="rooms" data-htarea="outdoor"', ""],
      ["gear", "Systems", 'data-shellgo="rooms" data-htarea="systems"', ""], ["plus", "Add a Space", 'data-haddspace="indoor"', ""], ["cal", "Coming Up", 'data-htgo="coming"', ""], ["tools", "Upkeep", 'data-shellgo="upkeep"', ""]]],
    ["Money", [["bill", "Bills Due", 'data-htgo="bills"', ""], typeof hpvOn === "function" && hpvOn() && ["chart", "Home Value", 'data-htgo="value"', ""]]],
    ["Every day", [["check", "To-Do", 'data-htgo="todos"', ""], ["list", "Lists", 'data-htgo="lists"', ""], ["weather", "Weather", 'data-htgo="weather"', ""]]],
    ["This app", [["ask", "Ask Home Hub", 'data-ask="open"', ""], ["bell", "Reminders", 'data-htgo="reminders"', ""],
      htPassOffered() && ["star", proName(), 'data-htgo="passsettings"', ""], ["gear", "Settings", 'data-htgo="settings"', ""], ["palette", "Classic Look", 'data-htgo="classic"', "the old screen"]]]];
  return groups.map(([h, T]) => { const t = T.filter(Boolean);
      return `<h4 class="ht-group">${esc(h)}</h4><nav class="ht-grid ht-more" aria-label="${esc(h)}">${t.map(x => htTileHtml([...x, "t-plain"])).join("")}</nav>`; }).join("")
    + cardHtml("family");
}

// ---- full screens
let HT_SCREEN = null, HT_FROM = null;
const htBackHtml = (t, right, attrs) => `<h2 class="ht-title"><button class="ht-back" ${attrs || 'data-htgo="back"'} aria-label="Back">${HI.back}</button><span class="grow">${esc(t)}${navigator.onLine === false ? `<span class="offline-pill">🟠 Offline</span>` : ""}</span>${right || `<span class="ht-titlepad" aria-hidden="true"></span>`}</h2>`;
const htAdd = (qa, what) => `<button class="ht-plus" data-qa="${qa}" aria-label="Add ${esc(what)}">＋</button>`;   // the + opens that screen's own add form
// A ROOM (his Kitchen screen): its picture, the four tabs, home.js's own pane with its forms and buttons.
function htSpaceHtml() {
  const sp = HOME_OPEN && spaceById(HOME_OPEN);
  if (!sp) { HT_SCREEN = null; return null; }
  const tabs = `<nav class="ht-tabs" aria-label="${esc(sp.name)}">${HOME_TABS.map(([k, , l]) => `<button class="${HOME_TAB === k ? "on" : ""}" data-htab="${k}" aria-pressed="${HOME_TAB === k}">${esc(l)}</button>`).join("")}</nav>`;
  return htBackHtml(sp.name) + htBand(htSpaceArt(sp), sp.name)
    + `<p class="ht-where">${esc((HOME_AREAS.find(a => a[0] === sp.area) || [, ""])[1])}${sp.floor ? ` · ${esc(sp.floor)}` : ""}</p>${tabs}<section class="ht-card ht-pane">${spacePane(sp)}</section>`;
}
function htComingHtml() {
  const all = htComing(180);
  return htBackHtml("Coming Up") + `<section class="ht-card">${all.length ? all.map(htRow).join("") : `<p class="ht-note">Nothing with a date in the next 6 months. Add a task in any room, or a job on the Upkeep list.</p>`}</section>`;
}
function htScreenHtml(sc, cardHtml) {
  if (sc === "space") return htSpaceHtml();
  if (sc === "coming") return htComingHtml();
  if (sc === "value") return htBackHtml("Home Value") + htBand("value", "A house at sunset") + (typeof hpvCardHtml === "function" && hpvCardHtml() ? hpvCardHtml() : `<section class="ht-card"><p class="ht-note">Home Value isn't on in this version.</p></section>`);
  if (sc === "bills") return htBackHtml("Bills Due", htAdd("bill", "a bill")) + htBand("bills", "A notebook and a calculator on a desk") + cardHtml("bills");
  if (sc === "todos") return htBackHtml("To-Do", htAdd("todo", "a to-do")) + cardHtml("todos");
  if (sc === "lists") return htBackHtml("Lists", htAdd("item", "a list item")) + cardHtml("lists");
  if (sc === "weather") return htBackHtml("Weather") + htBand("weather", "Frosty hills at sunrise") + cardHtml("weather");
  return null;
}

// Called by shell.js shellHtml() while the new look is on.
// A redraw from outside (coming back to the app, the weather landing, the phone going offline) rewrites #cards, and a room's form boxes with it.
// What's been typed goes back in the new boxes (Auto Hub's atSnapshotFields / atRefill). A form that just saved is left alone, so it shows what's stored.
let HT_SAVED_FORM = "";
const htFormSig = f => f ? Object.entries(f.dataset).map(([k, v]) => `${k}=${v}`).sort().join("&") : "";
function htFieldKey(el) { const n = el.name || el.id || (el.dataset.hnotes ? "notes" : ""); return n ? `${el.form ? htFormSig(el.form) : (el.dataset.hnotes ? `hnotes=${el.dataset.hnotes}` : "")}|${n}` : ""; }
function htSnapshotFields() {
  const out = [], root = document.getElementById("cards"), active = document.activeElement, saved = HT_SAVED_FORM; HT_SAVED_FORM = "";
  if (!root) return out;
  root.querySelectorAll("input, select, textarea").forEach(el => {
    if (el.type === "file" || el.type === "hidden") return;
    const key = htFieldKey(el); if (!key || (saved && el.form && htFormSig(el.form) === saved)) return;
    const box = el.type === "checkbox" || el.type === "radio";
    const changed = box ? el.checked !== el.defaultChecked : el.tagName === "SELECT" ? el.value !== ([...el.options].find(o => o.defaultSelected) || el.options[0] || {}).value : el.value !== el.defaultValue;
    if (changed || el === active) out.push({ key, box, val: box ? el.checked : el.value, focus: el === active });
  });
  return out;
}
function htRefill(snap) {
  document.querySelectorAll("#cards input, #cards select, #cards textarea").forEach(el => {
    if (el.type === "file" || el.type === "hidden") return;
    const s = snap.find(x => x.key === htFieldKey(el)); if (!s) return;
    if (s.box) el.checked = s.val; else el.value = s.val;
    if (s.focus) { try { el.focus({ preventScroll: true }); } catch (e) { /* the value is what matters */ } }
  });
}
document.addEventListener("submit", e => { if (typeof MODE !== "undefined" && MODE === "home" && e.target && e.target.closest && e.target.closest("#cards")) HT_SAVED_FORM = htFormSig(e.target); }, true);
function htShellHtml(cardHtml) {
  const snap = htSnapshotFields(); if (snap.length) queueMicrotask(() => htRefill(snap));
  htPreloadArt();
  document.body.classList.toggle("ht-noart", S.photo === false);
  let body = null;
  if (HT_SCREEN) { body = htScreenHtml(HT_SCREEN, cardHtml); if (body == null) HT_SCREEN = null; }
  document.body.dataset.htscreen = HT_SCREEN || "";
  HT_LEVELS = htLevels(); htSyncSoon();
  if (body != null) return `<div class="ht-screen">${body}</div>`;
  if (TAB === "home") return htHomeHtml();
  const top = `<section class="ht-bar">${htTopHtml(false)}</section>`;
  if (TAB === "rooms") return top + htRoomsHtml();
  if (TAB === "upkeep") return top + htUpkeepHtml(cardHtml);
  if (TAB === "money") return top + htMoneyHtml(cardHtml);
  if (TAB === "more") return top + htMoreHtml(cardHtml);
  return htHomeHtml();
}

// ---- a room opens as a full screen while the look is on (home.js's own handlers call these by name)
const HT_OLD = { showSpace, hideHomeSheet };
showSpace = function (id, tab) {
  if (!htOn()) return HT_OLD.showSpace(id, tab);
  if (!spaceById(id)) return;
  const sh = document.getElementById("homeSheet"); if (sh) sh.classList.add("hidden");   // "Add a space" just added it: the sheet gives way to the room
  HOME_OPEN = id; if (tab) HOME_TAB = tab;
  if (HT_SCREEN !== "space") { HT_FROM = HT_SCREEN; HT_SCREEN = "space"; window.scrollTo({ top: 0 }); }
  render();
};
hideHomeSheet = function () {
  if (!htOn()) return HT_OLD.hideHomeSheet();
  const sh = document.getElementById("homeSheet"); if (sh) sh.classList.add("hidden");
  if (HT_SCREEN === "space") { HT_SCREEN = HT_FROM; HT_FROM = null; }
  HOME_OPEN = null;
};

function htSettingsAt(id) { openSettings(); setTimeout(() => { const el = document.getElementById(id); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); }, 60); }
document.addEventListener("click", e => {
  if (!e.target.closest || typeof MODE === "undefined" || MODE !== "home" || !htOn()) return;
  const sg = e.target.closest("button[data-shellgo]");
  if (sg) { HT_SCREEN = null; HT_FROM = null; HOME_OPEN = null;               // a tab, or a tile that goes to one, leaves a full screen
    const area = sg.dataset.htarea;
    setTimeout(() => { const el = area && document.getElementById(`ht-${area}`); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); }, 60); }
  const b = e.target.closest("button[data-htgo]");
  if (!b) return;
  const go = b.dataset.htgo;
  if (go === "back") { if (HT_SCREEN === "space") { hideHomeSheet(); } else { HT_SCREEN = HT_FROM; HT_FROM = null; } render(); window.scrollTo({ top: 0 }); return; }
  if (["coming", "value", "bills", "todos", "lists", "weather"].includes(go)) { HT_FROM = HT_SCREEN && HT_SCREEN !== go ? HT_SCREEN : null; HT_SCREEN = go; render(); window.scrollTo({ top: 0 }); return; }
  if (go === "fab") { const f = document.getElementById("fab"); if (f) f.click(); return; }
  if (go === "reminders") { htSettingsAt("remindBox"); return; }
  if (go === "passsettings") { htSettingsAt("proBox"); return; }
  if (go === "settings") { if (typeof openSettings === "function") openSettings(); return; }
  if (go === "classic") { try { localStorage.setItem(HT_KEY, "classic"); } catch (e2) { /* private mode */ } HT_SCREEN = null; HOME_OPEN = null; TAB = "home"; render(); window.scrollTo({ top: 0 }); toast("Classic look on this phone"); return; }
});
// Any other copy on his phone: five quick taps on the app's name at the bottom of Settings flip the look, whatever browser it lives in.
let HT_NAME_TAPS = [];
document.addEventListener("click", e => {
  const b = e.target.closest && e.target.closest("#sheet p.fine > b");
  if (!b || !/Marvel Corp app/.test(b.textContent) || typeof MODE === "undefined" || MODE !== "home" || !homeSet() || !htOwnerish()) return;   // never on a customer's phone
  const now = Date.now(); HT_NAME_TAPS = HT_NAME_TAPS.filter(x => now - x < 3000).concat(now);
  if (HT_NAME_TAPS.length < 5) return;
  HT_NAME_TAPS = []; const on = !htOn();
  try { localStorage.setItem(HT_KEY, on ? "tiles" : "classic"); localStorage.setItem("homehub.ownerlook", "1"); } catch (e2) { /* private mode */ }
  HT_SCREEN = null; HOME_OPEN = null; TAB = "home"; closeSettings(); render(); window.scrollTo({ top: 0 }); toast(on ? "New look on for this phone" : "Classic look on this phone");
});
// The phone's own back button walks the same path as the arrow on screen (as Cruise and Trip Hub's new looks do): an open sheet closes first,
// a full screen goes back, a tab goes Home, only Home leaves the app. Steps are added at the tap that opened a screen. Never on the old look.
let HT_LEVELS = 0, HT_DEPTH = 0, HT_SKIP = 0, HT_SYNC_T = 0;
const HT_CLOSERS = ["close", "hclose", "upclose", "billclose", "readyclose", "forgetclose"].map(k => `[data-${k}]`).join(", ");
function htLevels() { const up = TAB && TAB !== "home" ? 1 : 0; return HT_SCREEN ? 1 + (HT_FROM ? 1 : 0) + up : up; }
function htSyncHistory() {
  HT_SYNC_T = 0;
  if (HT_SKIP || typeof MODE === "undefined" || MODE !== "home") return;
  const want = htOn() ? HT_LEVELS + (document.querySelector(".sheet:not(.hidden)") ? 1 : 0) : 0;
  try {
    if (want && "scrollRestoration" in history) history.scrollRestoration = "manual";
    while (HT_DEPTH < want) history.pushState({ ht: ++HT_DEPTH }, "");
    if (HT_DEPTH > want) { HT_SKIP++; setTimeout(() => { HT_SKIP = 0; }, 1500); history.go(want - HT_DEPTH); HT_DEPTH = want; }
  } catch (e) { HT_DEPTH = want; /* some browsers limit this; the arrow still works */ }
}
function htSyncSoon() { if (!HT_SYNC_T) HT_SYNC_T = setTimeout(htSyncHistory, 0); }
document.addEventListener("click", () => { if (typeof MODE !== "undefined" && MODE === "home") htSyncSoon(); });
window.addEventListener("popstate", () => {
  if (HT_SKIP) { HT_SKIP--; htSyncSoon(); return; }
  if (typeof MODE === "undefined" || MODE !== "home" || !htOn()) return;
  HT_DEPTH = Math.max(0, HT_DEPTH - 1);
  const open = [...document.querySelectorAll(".sheet:not(.hidden)")];
  if (open.length) { let bare = false;
    open.forEach(el => { const x = el.querySelector(HT_CLOSERS); if (x) x.click(); else { el.classList.add("hidden"); bare = true; } });
    if (bare) render(); htSyncSoon(); return; }
  const arrow = document.querySelector("#cards .ht-back");
  if (arrow) { arrow.click(); htSyncSoon(); return; }
  if (TAB !== "home") { shellGo("home"); htSyncSoon(); return; }
  if (history.state && history.state.ht) history.back();
});
