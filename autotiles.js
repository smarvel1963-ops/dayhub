/* SAVE AS: autotiles.js · LOCATION: C:/MarvelApps/dayhub/autotiles.js
 * AUTO HUB NEW LOOK (Scott 11/04: his two boards, "take new design and rebuild auto hub"; "i like these ideas" = Roadside Help).
 * His boards are the spec: Home Hero, Home Garage, Car Overview, Service, Fuel & MPG, Papers, Extras, Photos, AI Mechanic, Recalls, Journal,
 * Roadside Help, First Open, Smart Scan Review, My Garage, Cost to Own, Value & Selling, For Sale Card, Road Trip Planner, Before You Go,
 * AI Mechanic History, Settings, Auto Hub Pro. Tabs (his first board): Home | Garage | Scan | Journal | More.
 * Everything is drawn over what auto.js already has: the same forms, the same handlers, the same numbers. Nothing is worked out a new way.
 * New here: Roadside Help (its numbers live in c.help), the Log screen, Update Miles with an odometer check, the MPG and monthly charts.
 * Not drawn on purpose: live car readings (the app doesn't read the car). The screens his boards didn't draw are in autotiles2.js.
 * MASTER LOOK (Scott 11/04): "dark garage atmosphere, realistic cars, glowing turquoise controls, chrome accents, and beautiful instrument panels".
 * SWITCH: AT_ON is ON for everyone since 2026-11-10 (Scott "Yes, all of them"); it was false - customers never see it. A phone gets it with ?look=tiles (kept in autohub.look), by holding Scott Hub or the owner's OK
 * (once), or with five quick taps on the app's name at the bottom of Settings. More -> Classic Look turns it back. Auto Hub only.
 * Loaded by autohub/index.html after auto.js, before ui.js (+ autotiles.css). Hooks: shell.js shellOn / shellGo / shellHtml / paintTabs, each guarded.
 */
"use strict";

const AT_ON = true;                  // THE SWITCH: ON 2026-11-10 (Scott: "Yes, all of them") - everyone on Auto Hub gets the new look; More -> Classic Look (or ?look=classic) keeps the old one on that phone
const AT_KEY = "autohub.look";
(function atFromLink() {             // ?look=tiles|classic sets this phone's look, then leaves the address as it was
  try {
    const u = new URL(location.href), v = u.searchParams.get("look");
    if (v !== "tiles" && v !== "classic") return;
    localStorage.setItem(AT_KEY, v); u.searchParams.delete("look");
    history.replaceState(null, "", u.pathname + (u.search || "") + u.hash);
  } catch (e) { /* private mode: the link just doesn't stick */ }
})();
const atPick = () => { try { return localStorage.getItem(AT_KEY); } catch (e) { return null; } };
const atOwnerish = () => { try { return !!atPick() || !!localStorage.getItem("scotthub.k") || localStorage.getItem("dayhub.ownerok") === "1" || (typeof aiPass === "function" && !!aiPass()); } catch (e) { return false; } };
let AT_OWNER_CHECKED = false;
function atOwnerOnce() {             // the owner's phone turns it on by itself, once; after that Classic Look sticks. Customers have neither key.
  if (AT_OWNER_CHECKED) return; AT_OWNER_CHECKED = true;
  try {
    if (localStorage.getItem("autohub.ownerlook") || !(localStorage.getItem("scotthub.k") || localStorage.getItem("dayhub.ownerok") === "1")) return;
    localStorage.setItem("autohub.ownerlook", "1"); localStorage.setItem(AT_KEY, "tiles");
  } catch (e) { /* private mode */ }
}
function atOn() {                    // never calls shellOn() - shellOn() calls this
  if (typeof MODE === "undefined" || MODE !== "auto" || typeof S === "undefined" || !S) return false;
  atOwnerOnce();
  return AT_ON ? atPick() !== "classic" : atPick() === "tiles";
}

// ---- drawn icons
const AT_SVG = p => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const AI = {
  home: AT_SVG('<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>'),
  car: AT_SVG('<path d="M4.500 12.500l1.800-5A2 2 0 0 1 8.200 6h7.600a2 2 0 0 1 1.900 1.500l1.800 5"/><rect x="3" y="12.500" width="18" height="5.500" rx="1.500"/><circle cx="7.500" cy="15.200" r="1"/><circle cx="16.500" cy="15.200" r="1"/><path d="M6 18v2M18 18v2"/>'),
  scan: AT_SVG('<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3"/><rect x="8" y="8" width="8" height="8" rx="1.500"/>'),
  book: AT_SVG('<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h11M9 8h6"/>'),
  dots: AT_SVG('<circle cx="5" cy="12" r="1.300"/><circle cx="12" cy="12" r="1.300"/><circle cx="19" cy="12" r="1.300"/>'),
  plus: AT_SVG('<path d="M12 5v14M5 12h14"/>'),
  person: AT_SVG('<circle cx="12" cy="8.500" r="3.500"/><path d="M5 20c.8-3.600 3.500-5.500 7-5.500s6.200 1.900 7 5.500"/>'),
  triangle: AT_SVG('<path d="M12 4l9 16H3z"/><path d="M12 10v4.500M12 17.300v.2"/>'),
  back: AT_SVG('<path d="M15 5l-7 7 7 7"/>'),
  chev: AT_SVG('<path d="M9 5l7 7-7 7"/>'),
  pencil: AT_SVG('<path d="M4 20l1-4L16.500 4.500a2 2 0 0 1 2.800 2.800L8 19z"/><path d="M14.500 6.500l3 3"/>'),
  gauge: AT_SVG('<path d="M4 17a9 9 0 1 1 16 0"/><path d="M12 14l4-4.500"/><circle cx="12" cy="14" r="1.300"/>'),
  fuel: AT_SVG('<rect x="4" y="4" width="10" height="16" rx="1.500"/><path d="M7 8h4M3 20h12M14 11h2a1.500 1.500 0 0 1 1.500 1.500V17a1.500 1.500 0 0 0 3 0V9l-3-3"/>'),
  wrench: AT_SVG('<path d="M14.500 6.500a4 4 0 0 1 5-1.200l-2.700 2.700 1.800 1.800 2.700-2.700a4 4 0 0 1-5.300 5.200L8 20.500a1.900 1.900 0 0 1-2.700-2.700l8.200-7.900a4 4 0 0 1 1-3.400z"/>'),
  doc: AT_SVG('<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>'),
  shield: AT_SVG('<path d="M12 3l8 3v5.500c0 5-3.400 8.200-8 9.500-4.600-1.300-8-4.500-8-9.500V6z"/><path d="M8.500 12l2.500 2.500 4.500-5"/>'),
  id: AT_SVG('<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.500" cy="11" r="2"/><path d="M5.500 16c.5-1.500 1.600-2 3-2s2.500.5 3 2M14.500 9.500H18M14.500 13H18"/>'),
  clip: AT_SVG('<rect x="5" y="5" width="14" height="16" rx="2"/><path d="M9 5V3.500h6V5M8.500 13l2.500 2.500 4.500-5"/>'),
  bank: AT_SVG('<path d="M3 10l9-6 9 6zM5 10v7M10 10v7M14 10v7M19 10v7M3 20h18"/>'),
  box: AT_SVG('<path d="M12 3l8 4.500v9L12 21l-8-4.500v-9z"/><path d="M4 7.500l8 4.500 8-4.500M12 12v9"/>'),
  camera: AT_SVG('<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7l1.500-3h5L16 7"/><circle cx="12" cy="13.500" r="3.500"/>'),
  chip: AT_SVG('<rect x="7" y="7" width="10" height="10" rx="1.500"/><path d="M10 3v4M14 3v4M10 17v4M14 17v4M3 10h4M3 14h4M17 10h4M17 14h4"/>'),
  coin: AT_SVG('<ellipse cx="12" cy="6.500" rx="7" ry="3"/><path d="M5 6.500v5c0 1.700 3.100 3 7 3s7-1.300 7-3v-5M5 11.500v5c0 1.700 3.100 3 7 3s7-1.300 7-3v-5"/>'),
  tag: AT_SVG('<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.500" cy="8.500" r="1.300"/>'),
  trend: AT_SVG('<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>'),
  road: AT_SVG('<path d="M9 3L4 21M15 3l5 18M12 4v3M12 11v3M12 18v3"/>'),
  pin: AT_SVG('<path d="M12 22s7-7 7-12a7 7 0 1 0-14 0c0 5 7 12 7 12z"/><circle cx="12" cy="10" r="2.500"/>'),
  phone: AT_SVG('<path d="M6 3h3l1.500 5-2 1.500a12 12 0 0 0 6 6l1.500-2 5 1.500v3a2 2 0 0 1-2 2C10.500 21 3 13.500 3 5a2 2 0 0 1 3-2z"/>'),
  tow: AT_SVG('<path d="M3 16V9h9v7M12 11h4l3 3v2h-7"/><circle cx="7" cy="17.500" r="1.800"/><circle cx="16" cy="17.500" r="1.800"/><path d="M3 9l5-5"/>'),
  send: AT_SVG('<path d="M21 3L3 10.500l7 3 3 7z"/><path d="M10 13.500L21 3"/>'),
  info: AT_SVG('<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8v.2"/>'),
  sparkle: AT_SVG('<path d="M11 4l1.800 5.200L18 11l-5.200 1.800L11 18l-1.800-5.200L4 11l5.200-1.800zM18.500 16l.8 2.200 2.200.8-2.200.8-.8 2.200-.8-2.200-2.200-.8 2.200-.8z"/>'),
  history: AT_SVG('<path d="M4 12a8 8 0 1 0 2.500-5.800L4 8.500V4"/><path d="M12 8v4.500l3 1.500"/>'),
  gear: AT_SVG('<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.600 5.600l2.100 2.100M16.300 16.300l2.100 2.100M18.400 5.600l-2.100 2.100M7.700 16.300l-2.100 2.100"/>'),
  sun: AT_SVG('<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.600 5.600L7 7M17 17l1.400 1.400M18.400 5.600L17 7M7 17l-1.400 1.400"/>'),
  bill: AT_SVG('<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10.500h18M7 15.500h4"/>'),
  check: AT_SVG('<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 12.500l2.500 2.500 5.500-6"/>'),
  list: AT_SVG('<path d="M9 6h11M9 12h11M9 18h11M4 6h.2M4 12h.2M4 18h.2"/>'),
  people: AT_SVG('<circle cx="9" cy="9" r="3"/><path d="M3.500 19c.6-3 2.700-4.500 5.500-4.500s4.900 1.500 5.500 4.500M15.500 6.500a3 3 0 0 1 0 5.500M17 14.800c1.900.5 3.100 1.900 3.500 4.200"/>'),
  crown: AT_SVG('<path d="M3 8l4.500 4L12 5l4.500 7L21 8l-2 11H5z"/>'),
  cloud: AT_SVG('<path d="M7 18a4.500 4.500 0 0 1-.6-9A6 6 0 0 1 18 10a4 4 0 0 1-1 8z"/>'),
  upload: AT_SVG('<path d="M12 16V5M7.500 9.500L12 5l4.500 4.500M4 19h16"/>'),
  trash: AT_SVG('<path d="M4 7h16M9 7V4h6v3M6.500 7l1 13h9l1-13"/>'),
  lock: AT_SVG('<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'),
  bell: AT_SVG('<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 21h4"/>'),
  palette: AT_SVG('<path d="M12 3a9 9 0 1 0 0 18c1.500 0 2-1 2-2s-.5-1.500 0-2.500 1.500-1 3-1c2.500 0 4-1.500 4-3.500 0-5-4-9-9-9z"/><circle cx="7.500" cy="11" r="1"/><circle cx="10.500" cy="7" r="1"/><circle cx="15.500" cy="8" r="1"/>'),
  x: AT_SVG('<path d="M6 6l12 12M18 6L6 18"/>'),
  oil: AT_SVG('<path d="M3 8h3l2-2h3l2 2 8-2-5 9H6a3 3 0 0 1-3-3z"/><path d="M20 15s-1.500 2-1.500 3a1.500 1.500 0 0 0 3 0c0-1-1.500-3-1.500-3z"/>'),
  rotate: AT_SVG('<path d="M4 12a8 8 0 0 1 13.700-5.700L20 8.500V4M20 12a8 8 0 0 1-13.700 5.700L4 15.500V20"/>'),
  brake: AT_SVG('<circle cx="12" cy="12" r="8.500"/><circle cx="12" cy="12" r="3"/><path d="M12 5.500v.1M18.500 12h-.1M12 18.500v-.1M5.500 12h.1"/>'),
  filter: AT_SVG('<rect x="4" y="5" width="16" height="14" rx="1.500"/><path d="M8 5v14M12 5v14M16 5v14"/>'),
  leaf: AT_SVG('<path d="M5 19c0-9 5-14 15-14 0 10-5 15-14 15zM5 19l8-8"/>'),
  battery: AT_SVG('<rect x="3" y="8" width="18" height="11" rx="1.500"/><path d="M7 8V5.500h3V8M14 8V5.500h3V8M7 13.500h3M15.500 12v3M14 13.500h3"/>'),
  wiper: AT_SVG('<path d="M3 17a13 13 0 0 1 18 0M12 21L17 8"/>'),
  drop: AT_SVG('<path d="M12 3s6.500 7 6.500 11.500a6.500 6.500 0 0 1-13 0C5.500 10 12 3 12 3z"/>'),
  plug: AT_SVG('<path d="M12 21v-5M8 3v5M16 3v5M6 8h12v3a6 6 0 0 1-12 0z"/>'),
  tire: AT_SVG('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="M12 3v5M12 16v5M3 12h5M16 12h5"/>'),
};
const AT_SVC_IC = { oil: "oil", rotate: "rotate", brakes: "brake", air: "filter", cabin: "leaf", battery: "battery", wipers: "wiper", inspect: "clip", coolant: "drop", trans: "gear", plugs: "plug", tires: "tire", other: "wrench" };
const AT_PAPER_IC = { insurance: "shield", registration: "id", inspection: "clip", warranty: "shield", loan: "bank", roadside: "tow", other: "doc" };
const AT_LOGO = `<svg viewBox="0 0 40 24" aria-hidden="true"><path d="M9 2h7L8 22H1zM19 2h7l-8 20h-7zM29 2h7l-8 20h-7z" fill="url(#atlg)"/><defs><linearGradient id="atlg" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#5eead4"/><stop offset="1" stop-color="#38bdf8"/></linearGradient></defs></svg>`;

// The five tabs (Scott's board: Home | Garage | Scan | Journal | More).
const AT_TABS = [["home", AI.home, "Home"], ["garage", AI.car, "Garage"], ["scan", AI.scan, "Scan"], ["journal", AI.book, "Journal"], ["more", AI.dots, "More"]];

// ---- where you are. A page (Roadside, Settings...) or a car's screen sits over the tab; ‹ goes back through what you opened.
const AT = { page: null, car: null, sub: null, form: null, seg: {}, stack: [], tag: "all", jtag: "all", add: "vin", from: "", to: "", milesOk: null, ticks: {}, papersOpen: null };
const atReset = () => { AT.page = null; AT.car = null; AT.sub = null; AT.form = null; AT.stack = []; AT.milesOk = null; AUTO_OPEN = null; AUTO_MSG = ""; AUTO_VIEW = null; };
const atPush = () => { const t = AT.stack[AT.stack.length - 1]; if (t && t.page === AT.page && t.car === AT.car && t.sub === AT.sub && t.tab === AUTO_TAB) return; AT.stack.push({ page: AT.page, car: AT.car, sub: AT.sub, tab: AUTO_TAB }); };
function atBack() {
  const f = AT.stack.pop(); AT.form = null; AUTO_MSG = ""; AUTO_VIEW = null; AT.milesOk = null;
  if (!f) { atReset(); return; }
  AT.page = f.page; AT.car = f.car; AT.sub = f.sub; AUTO_TAB = f.tab; AUTO_OPEN = f.car;
}
const m0 = n => money(n || 0).replace(/\.00$/, "");
const atHero = () => { const cars = garage().cars; return carById(AUTO_HERO) || cars[0] || null; };
const atFullName = c => [c.year, c.make, c.model].filter(Boolean).join(" ") || c.nick || "My car";
const atShort = c => c.nick || c.model || atFullName(c);
const atBodyArt = c => /truck|pickup/i.test(c.body || c.model || "") ? "pickup" : /suv|sport utility|crossover|wagon|van|mpv|multipurpose/i.test(c.body || "") ? "suv" : "sedan";
const AT_ART = ["sedan", "suv", "pickup", "garage", "road", "roadside"];
let AT_ART_ASKED = false;
function atPreloadArt() {            // one fetch each under the new look, so the worker keeps them for a phone with no signal; customers download nothing
  if (AT_ART_ASKED || S.photo === false) return; AT_ART_ASKED = true;
  AT_ART.forEach(n => fetch(`art/${n}.webp`).catch(() => {}));
}
// The car's picture: its own cover photo where there's room, its small copy in a row, otherwise a generic shape for its body type.
function atCarImg(c, cls, big) {
  const art = `art/${atBodyArt(c)}.webp`, thumb = carPic(c);
  if (big && c.cover) return `<img class="${cls}" data-aphoto="${esc(c.cover)}" src="${esc(thumb || art)}" alt="">`;
  if (thumb) return `<img class="${cls}" src="${esc(thumb)}" alt="">`;
  return S.photo === false ? `<span class="${cls} at-nopic">${AI.car}</span>` : `<img class="${cls}" src="${art}" alt="">`;
}
const atPill = (txt, tone) => `<span class="at-pill ${tone || ""}">${esc(txt)}</span>`;
const atMsg = () => `<p class="at-msg" id="autoMsg" role="status">${AUTO_MSG ? "⚠️ " + esc(AUTO_MSG) : ""}</p>`;
const atHead = (title, ic, right) => `<h2 class="at-head"><button class="at-backb" data-atgo="back" aria-label="Back">${AI.back}</button>${ic ? `<span class="at-headic">${AI[ic]}</span>` : ""}<span class="grow">${esc(title)}</span>${navigator.onLine === false ? `<small class="at-off">Offline</small>` : ""}${right || ""}</h2>`;
const atBandHead = (art, title, label) => `${S.photo === false ? "" : `<img class="at-band" src="art/${art}.webp" alt="">`}<button class="at-backb at-bandback" data-atgo="back" aria-label="Back">${AI.back}</button>${label ? `<small class="at-bandlabel">${esc(label)}</small>` : ""}<h2 class="at-bandh">${esc(title)}</h2>`;
const atSeg = (tab, opts) => { const on = AT.seg[tab] || opts[0][0]; return `<div class="at-seg" role="tablist">${opts.map(([k, l]) => `<button class="${k === on ? "on" : ""}" data-atseg="${tab}:${k}" role="tab" aria-selected="${k === on}">${esc(l)}</button>`).join("")}</div>`; };
const atSegOn = (tab, first) => AT.seg[tab] || first;
const atRow = (ic, title, sub, attrs, right) => `<button class="at-row" ${attrs || ""}><span class="at-ric">${AI[ic] || ""}</span><span class="grow"><b>${esc(title)}</b>${sub ? `<small>${esc(sub)}</small>` : ""}</span>${right || AI.chev}</button>`;
const atBig = (label, attrs, ic) => `<button class="at-big" ${attrs || ""}>${ic ? AI[ic] : ""}${esc(label)}</button>`;
const atCarGo = (c, tab) => `data-acar="${esc(c.id)}" data-atabgo="${tab}"`;
function atCarPick(c) {              // two or more cars: chips to choose whose screen this is
  const cars = garage().cars; if (cars.length < 2) return "";
  return `<div class="at-chips">${cars.map(x => `<button class="${x.id === c.id ? "on" : ""}" data-aherocar="${esc(x.id)}">${esc(atShort(x))}</button>`).join("")}</div>`;
}

// ---- the must-see chips from the hidden top band: a new version, install, Pro paused, backup
function atNotices() {
  const was = CHIPS_ALL; CHIPS_ALL = true; let html = "";
  try { html = heroHtml(); } finally { CHIPS_ALL = was; }
  const box = document.createElement("template"); box.innerHTML = html;
  const keep = [...box.content.querySelectorAll(".chips > [data-update], .chips > [data-install], .chips > [data-prolapse], .chips > [data-sync], .chips > [data-syncall], .chips > [data-cloudask]")];
  return keep.length ? `<div class="at-notices">${keep.map(c => c.outerHTML).join("")}</div>` : "";
}

// ---- FIRST OPEN (his board): add the first car. Same form and handler as the old welcome.
function atAddFields(c) {
  const by = AT.add, canScan = "BarcodeDetector" in window;
  const vin = `<label class="at-field at-byvin">Vehicle Identification Number (VIN)<input name="vin" maxlength="17" autocapitalize="characters" spellcheck="false" placeholder="17 characters" value="${c ? esc(c.vin || "") : ""}"></label>`;
  const ymm = `<div class="at-three at-byymm"><input name="year" inputmode="numeric" maxlength="4" placeholder="Year" aria-label="Year"><input name="make" placeholder="Make" aria-label="Make"><input name="model" placeholder="Model" aria-label="Model"></div>`;
  const rest = `<div class="at-two"><input name="nick" placeholder="Nickname" aria-label="Nickname, optional"><input name="miles" inputmode="numeric" placeholder="Miles on it now" aria-label="Current miles"></div>`;
  const tabs = [["vin", "Add by VIN"], ...(canScan ? [["scan", "Scan VIN"]] : []), ["ymm", "Year/Make"]];
  return `<div class="at-seg">${tabs.map(([k, l]) => `<button type="button" class="${by === k ? "on" : ""}" data-atadd="${k}">${l}</button>`).join("")}</div>
    ${vin}${canScan ? `<label class="at-ghost at-byscan">${AI.scan}Scan the VIN barcode<input type="file" accept="image/*" capture="environment" data-avinscan="1" hidden></label>` : ""}${ymm}${rest}`;
}
function atFirstOpen() {
  return `<div class="at-first"><div class="at-firstart">${S.photo === false ? "" : `<img src="art/garage.webp" alt="">`}<span class="at-logo big">${AT_LOGO}<b>AUTO HUB<small>BY MARVEL CORP</small></b></span></div>
    <h1>Welcome to Auto Hub</h1><p>Add your car to track service, costs, recalls, papers and more, all in one place.</p>
    <form class="at-card at-form" data-by="${esc(AT.add)}" data-autosetup="1"><input type="hidden" name="name" value="${esc(S.name || "")}"><input type="hidden" name="city" value="${esc(S.city || "")}">${atAddFields()}<button class="at-big">Add This Car</button>${atMsg()}</form>${atSoldCars().length ? atRow("archive", "Sold Cars", `${atSoldCars().length} kept`, 'data-atgo="archive"') : ""}
    <p class="at-seclabel">Had Auto Hub Before?</p>${atRow("cloud", "Restore From My Google Drive", "Brings back your cars and records", 'data-atset="syncBox"')}${atRow("upload", "Load a Backup File", "From a file you saved", 'data-atset="dataBox"')}</div>`;
}
function atAddCar() {
  if (!autoCanAdd()) return atHead("Add a Car", "car") + `<section class="at-card">${STORE_MODE ? `<p>${esc(storeLock(`More than ${AUTO_FREE_CARS} cars`))}</p>` : `<p>Auto Hub free keeps <b>${AUTO_FREE_CARS} cars</b>. ${esc(PLAN.AUTO_NAME)} (${esc(PLAN.AUTO_MONTHLY)}, 30 days free) keeps every car you own.</p>${PLAN.AUTO_CHECKOUT_URL ? `<a class="at-big" href="${esc(PLAN.AUTO_CHECKOUT_URL)}" target="_blank" rel="noopener">Start 30 days free</a>` : ""}`}</section>`;
  return atHead("Add a Car", "car") + `<form class="at-card at-form" data-by="${esc(AT.add)}" data-anewcar="1">${atAddFields()}<button class="at-big">Add This Car</button>${atMsg()}</form>`;
}

// ---- HOME (his board): the car, the next thing, three rings, the quick buttons.
function atNext(c) {
  const t = today(), due = carDue(c, t), late = due.filter(d => d.late), rc = openRecalls(c), ps = papersSoon(c, t), park = rc.find(r => r.park);
  if (park) return { red: true, ic: "triangle", k: "PARK IT", t: "Safety recall: don't drive it yet", w: `${park.part}. The dealer fixes it free.`, go: "recalls" };
  if (late[0]) return { ic: AT_SVC_IC[late[0].key], k: "Next Smart Action", t: `${svc(late[0].key)[2]} due`, w: `Last done ${aDate(late[0].last.date)}${late[0].last.miles != null ? ` · ${miles(late[0].last.miles)} mi` : ""}`, go: "service" };
  if (ps[0]) return { ic: AT_PAPER_IC[ps[0].kind], k: "Next Smart Action", t: `${ps[0].name || paper(ps[0].kind)[2]} ${daysUntil(ps[0].expires) < 0 ? "has expired" : "expires soon"}`, w: `Good to ${aDate(ps[0].expires)}`, go: "papers" };
  if (!c.recalls) return { ic: "triangle", k: "Next Smart Action", t: "Check for recalls", w: "Free from NHTSA. Takes a second.", go: "recalls" };
  if (!due.length) return { ic: "oil", k: "Next Smart Action", t: "Log your last oil change", w: "Then Auto Hub tells you when the next one is due.", go: "service" };
  return { ic: AT_SVC_IC[due[0].key], k: "Next Smart Action", t: `Next: ${svc(due[0].key)[2]}`, w: dueWords(due[0]), go: "service" };
}
function atRing(c, pct, val, a, b, tone, tab) {
  return `<button class="at-ring" ${atCarGo(c, tab)} style="--p:${Math.max(0, Math.min(100, Math.round(pct)))};--c:${tone}"><span><b>${esc(val)}</b><small>${esc(a)}${b ? `<br>${esc(b)}` : ""}</small></span></button>`;
}
function atHome() {
  const c = atHero(), t = today(), due = carDue(c, t), late = due.filter(d => d.late), f = fuelStats(c), rc = openRecalls(c), n = atNext(c);
  const tracked = AUTO_SERVICES.filter(x => intervalOf(c, x[0])[0] || intervalOf(c, x[0])[1]).length, ok = due.length - late.length;
  return `<section class="at-home"><div class="at-hero">${atCarImg(c, "at-heroimg", true)}<div class="at-top"><span class="at-logo">${AT_LOGO}<b>AUTO HUB</b></span><span class="grow"></span>
      <button class="at-ic" data-atgo="log" aria-label="Log something">${AI.plus}</button><button class="at-ic warn" data-atgo="roadside" aria-label="Roadside Help">${AI.triangle}</button><button class="at-ic" data-atgo="settings" aria-label="Settings">${AI.person}</button></div>
      <div class="at-herotxt"><small>${esc(atFullName(c))}</small><div class="at-heroname"><b>${esc(atShort(c))}</b><button class="at-pen" data-atgo="details" aria-label="Edit this car">${AI.pencil}</button></div>
      <span class="at-miles">${AI.gauge}${c.miles != null ? `${miles(c.miles)} mi` : "Miles not set"}</span></div></div>
    ${atCarPick(c)}${atNotices()}
    <button class="at-next ${n.red ? "red" : ""}" ${atCarGo(c, n.go)}><span class="at-nextic">${AI[n.ic]}</span><span class="grow"><small>${esc(n.k)}</small><b>${esc(n.t)}</b><em>${esc(n.w)}</em></span>${AI.chev}</button>
    <div class="at-rings">${atRing(c, tracked ? ok / tracked * 100 : 0, `${ok}/${tracked}`, "Service", "On Track", late.length ? "#fbbf24" : "#34d399", "service")}
      ${atRing(c, f.mpg ? f.mpg / 40 * 100 : 0, f.mpg ? f.mpg.toFixed(1) : "–", "Avg MPG", "", "#38bdf8", "fuel")}
      ${atRing(c, c.recalls ? (rc.length ? 30 : 100) : 0, c.recalls ? String(rc.length) : "–", "Open", "Recalls", rc.length ? "#f87171" : "#34d399", "recalls")}</div>
    <div class="at-quick"><button data-shellgo="scan">${AI.scan}<span>Smart Scan</span></button><button data-atlog="service">${AI.wrench}<span>Add Service</span></button><button data-atlog="fuel">${AI.fuel}<span>Add Fill-Up</span></button></div>
    <div class="at-quick two"><button ${atCarGo(c, "papers")}>${AI.doc}<span>Papers</span></button><button data-atsell="${esc(c.id)}">${AI.tag}<span>Sell</span></button></div></section>`;
}

// ---- GARAGE (his board): the cars, what's coming, weather, the other Hubs.
function atUpcoming(cars, cap) {
  const t = today(), rows = [];
  cars.forEach(c => { carDue(c, t).forEach(d => { if (d.late || d.soon) rows.push({ c, days: d.days, ic: AT_SVC_IC[d.key], text: `${svc(d.key)[2]} due`, tab: "service", pill: d.late ? atPill("Overdue", "late") : atPill(dueWords(d).split(" or ")[0], "soon") }); });
    papersSoon(c, t).forEach(x => { const n = daysUntil(x.expires); rows.push({ c, days: n, ic: AT_PAPER_IC[x.kind], text: `${paper(x.kind)[2]} renewal`, tab: "papers", pill: n < 0 ? atPill("Expired", "late") : atPill(aDate(x.expires)) }); });
    openRecalls(c).forEach(r => rows.push({ c, days: -1e6, ic: "triangle", text: r.park ? `PARK IT: ${r.part}` : `Recall: ${r.part}`, tab: "recalls", pill: atPill(r.park ? "Stop" : "Open", "late") })); });
  rows.sort((a, b) => a.days - b.days);
  return (cap ? rows.slice(0, cap) : rows).map(x => `<button class="at-up" ${atCarGo(x.c, x.tab)}><span class="at-ric">${AI[x.ic]}</span><span class="grow"><b>${esc(x.text)}</b>${cars.length > 1 ? `<small>${esc(atShort(x.c))}</small>` : ""}</span>${x.pill}</button>`).join("") || (cap ? `<p class="at-note">Nothing due. Log your last oil change and Auto Hub works out the next one.</p>` : `<p class="at-note">Nothing due right now.</p>`);
}
function atWxRow() {
  const w = typeof WXDATA !== "undefined" && WXDATA && WXDATA.here, k = w && w.cur ? wmo(w.cur.weather_code) : null;
  if (!k) return atRow("sun", "Weather", S.city ? "Getting the forecast" : "Add your city or ZIP in Settings", 'data-atgo="card:weather"');
  return `<button class="at-wx" data-atgo="card:weather"><span class="at-wxic">${k[0]}</span><b>${Math.round(w.cur.temperature_2m)}°F</b><span class="grow"><b>${esc(k[1])}</b>${w.day ? `<small>H: ${Math.round(w.day.hi)}° L: ${Math.round(w.day.lo)}°</small>` : ""}</span>${AI.chev}</button>`;
}
function atGarage() {
  const cars = garage().cars;
  return `<div class="at-top flat"><span class="at-logo">${AT_LOGO}<b>AUTO HUB</b></span></div>
    <div class="at-titlerow"><h2>My Garage</h2><button class="at-linky" data-atgo="cars">${cars.length} Vehicle${cars.length === 1 ? "" : "s"}</button></div>
    <div class="at-cars">${cars.map(c => `<button class="at-carrow" ${atCarGo(c, "overview")}>${atCarImg(c, "at-carpic")}<span class="grow"><small>${esc(atFullName(c))}</small><b>${esc(atShort(c))}</b><em>${AI.gauge}${c.miles != null ? `${miles(c.miles)} mi` : "Miles not set"}</em></span>${AI.chev}</button>`).join("")}</div>
    <section class="at-card"><div class="at-cardhead">${AI.clip}<b>Upcoming</b><button class="at-linky" data-atgo="upcoming">View All</button></div>${atUpcoming(cars, 3)}</section>
    ${atWxRow()}
    ${atRow("people", "Your Other Hub Apps", "Day, Cruise, Trip, Home, Money and Health Hub", 'data-atgo="card:family"')}
    ${atRow("car", "All Cars", "What's due and what each one costs", 'data-atgo="allcars"')}${atBig("Add Car by VIN", 'data-aaddcar="1"', "plus")}`;
}
function atCars() {                  // My Garage's big cards (his second board)
  const t = today(), cars = garage().cars;
  return atHead("My Garage", null, `<button class="at-addmini" data-aaddcar="1">${AI.plus}Add Car</button>`) + `<p class="at-note">${cars.length} Vehicle${cars.length === 1 ? "" : "s"}</p>${cars.map(c => { const due = carDue(c, t).filter(d => d.late).length, rc = openRecalls(c).length, ps = papersSoon(c, t).length;
    return `<article class="at-bigcar"><button class="at-bigcartop" ${atCarGo(c, "overview")}>${atCarImg(c, "at-bigcarimg", true)}<span><b>${esc(atFullName(c))}</b><small>${esc([c.trim, c.miles != null ? miles(c.miles) + " mi" : ""].filter(Boolean).join(" · "))}</small></span></button>
      <div class="at-minis"><button ${atCarGo(c, "service")}>${AI.wrench}<small>Service</small><b class="${due ? "bad" : ""}">${due ? `${due} Due` : "OK"}</b></button><button ${atCarGo(c, "recalls")}>${AI.rotate}<small>Recalls</small><b class="${rc ? "bad" : ""}">${c.recalls ? rc : "–"}</b></button><button ${atCarGo(c, "papers")}>${AI.doc}<small>Renew</small><b class="${ps ? "warn" : ""}">${ps ? `${ps} Soon` : "OK"}</b></button></div></article>`; }).join("")}`;
}

// ---- CAR OVERVIEW (his board): the numbers, cost, value, then every part of this car.
function atOverview(c) {
  const seg = atSegOn("overview", "overview");
  const head = `<div class="at-carhead">${atHead("Car Overview")}<div class="at-carhead2">${atCarImg(c, "at-carheadimg", true)}<div><small>${esc(atFullName(c))}</small><b>${esc(atShort(c))}</b></div></div></div>${atSeg("overview", [["overview", "Overview"], ["value", "Value"], ["cost", "Cost to Own"]])}`;
  if (seg === "value") return head + atValue(c);
  if (seg === "cost") return head + atCost(c);
  const f = fuelStats(c), spent = c.services.reduce((n, s) => n + (s.cost || 0), 0), own = ownCost(c, today()), v = carValue(c, today());
  const tiles = [["service", "wrench", "Service"], ["fuel", "fuel", "Fuel"], ["papers", "doc", "Papers"], ["extras", "box", "Extras"], ["photos", "camera", "Photos"], ["mech", "chip", "AI Mechanic"], ["recalls", "triangle", "Recalls"], ["journal", "book", "Journal"]];
  return head + `<div class="at-stats"><div>${AI.gauge}<b>${c.miles != null ? miles(c.miles) : "–"}<i> mi</i></b><small>Mileage</small></div><div>${AI.fuel}<b>${f.mpg ? f.mpg.toFixed(1) : "–"}</b><small>Avg MPG</small></div><div>${AI.wrench}<b>${m0(spent)}</b><small>Service Spend</small></div></div>
    <button class="at-row" data-atseg="overview:cost"><span class="at-ric gold">${AI.coin}</span><span class="grow"><small>Cost to Own (Last 12 Months)</small><b class="at-bignum">${m0(own.total)}</b></span>${AI.chev}</button>
    <section class="at-card"><div class="at-cardhead">${AI.trend}<b>Value &amp; Selling</b></div>
      <button class="at-line" data-atseg="overview:value"><span class="grow"><small>Rough Value Range</small><b>${v ? `${m0(v.low)} – ${m0(v.high)}` : "Add what you paid"}</b></span>${AI.chev}</button>
      <button class="at-line" data-atseg="overview:value"><span class="grow"><small>Asking Price</small><b>${c.price ? m0(c.price) : "Not set"}</b></span>${AI.pencil}</button></section>
    ${atBig(`Update Miles${c.miles != null ? ` (${miles(c.miles)})` : ""}`, 'data-atgo="miles"')}
    <p class="at-seclabel">This Car</p><div class="at-tiles">${tiles.map(([k, ic, l]) => `<button ${atCarGo(c, k)}>${AI[ic]}<span>${l}</span></button>`).join("")}</div>
    ${atRow("info", "Car Facts", "Plate, tire size, oil type, battery, wipers", 'data-atgo="facts"')}${atRow("heart", "Health History", "Every repair, recall and inspection", 'data-atgo="health"')}${atRow("pencil", "Edit Car Details", "VIN, year, make, model, nickname, remove", 'data-atgo="details"')}${atMsg()}`;
}
function atValue(c) {               // VALUE & SELLING (his board). The range is the app's own rough estimate, and says so.
  const v = carValue(c, today());
  return `<section class="at-card glow"><small class="at-k">Rough Value</small><b class="at-range">${v ? `${m0(v.low)} – ${m0(v.high)}` : "Add what you paid"}</b><p class="at-note">${v ? "A rough estimate from what you paid, a usual yearly drop and your miles. Not a dealer quote or market data." : "Type the price and the day you bought it and Auto Hub works out a rough range."}</p></section>
    <form class="at-form" data-aprice="${esc(c.id)}"><div class="at-rowin">${AI.tag}<label>Asking Price<input name="price" inputmode="decimal" placeholder="Only if selling" value="${esc(c.price || "")}"></label><button class="at-chipb">Save</button></div></form>
    <form class="at-form at-valueform" data-avalue="${esc(c.id)}"><div class="at-rowin">${AI.coin}<label>Price Paid<input name="paid" inputmode="decimal" placeholder="e.g. 24500" value="${esc(c.paid || "")}"></label></div><div class="at-rowin">${AI.history}<label>Date Bought<input type="date" name="boughtOn" value="${esc(c.boughtOn || "")}"></label><button class="at-chipb">Save</button></div></form>
    ${atBig("Create For-Sale Card", 'data-atgo="forsale"', "tag")}
    <button class="at-ghost" data-atlist="${esc(c.id)}" ${c.price ? "" : "disabled"}>${AI.list}Generate Listing Text</button>
    <div class="at-actions"><button class="at-ghost" data-atgo="records">${AI.doc}Buyer PDF</button><button class="at-ghost" data-atsheet="${esc(c.id)}">${AI.send}Build Sheet</button></div>
    <label class="at-tick"><input type="checkbox" id="aVinShare"><span>Include the VIN</span></label>
    ${c.price ? "" : `<p class="at-note">Listing text shows once there's an asking price.</p>`}${atRow("tag", "Sell My Car", "Ready-to-sell list, ad, buyer PDF", 'data-atgo="sell"')}${atMsg()}`;
}
function atCost(c) {                // COST TO OWN (his board). Same totals as ownCost; All Time adds up everything logged.
  const on = atSegOn("cost", "year"), t = today(), own = ownCost(c, t), all = { service: c.services.reduce((n, x) => n + (x.cost || 0), 0), fuel: c.fuel.reduce((n, x) => n + (x.cost || 0), 0), papers: c.papers.reduce((n, x) => n + ((x.paid && x.cost) || 0), 0) };
  const cut = on === "year" ? own : { ...all, total: all.service + all.fuel + all.papers }, from = addDays(t, -365), inYr = d => on === "all" || (d && d > from && d <= t);
  const counts = { service: c.services.filter(x => inYr(x.date)).length, fuel: c.fuel.filter(x => inYr(x.date)).length, papers: c.papers.filter(x => x.paid && inYr(x.paid)).length };
  const pct = n => cut.total ? Math.round(n / cut.total * 100) : 0;
  const row = (ic, l, n, v) => `<div class="at-costrow"><span class="at-ric">${AI[ic]}</span><span class="grow"><span class="at-costline"><b>${esc(l)}${n ? ` (${n})` : ""}</b><b>${m0(v)}</b></span><span class="at-bar"><i style="width:${pct(v)}%"></i></span></span><small>${pct(v)}%</small></div>`;
  const months = []; for (let i = 11; i >= 0; i--) { const d = parseDay(t); d.setDate(1); d.setMonth(d.getMonth() - i); months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`); }
  const inM = (d, m) => String(d || "").startsWith(m), vals = months.map(m => c.services.filter(x => inM(x.date, m)).reduce((n, x) => n + (x.cost || 0), 0) + c.fuel.filter(x => inM(x.date, m)).reduce((n, x) => n + (x.cost || 0), 0) + c.papers.filter(x => inM(x.paid, m)).reduce((n, x) => n + (x.cost || 0), 0));
  const top = Math.max(1, ...vals), names = months.map(m => parseDay(m + "-01").toLocaleDateString("en-US", { month: "short" }).slice(0, 3));
  return `${atSeg("cost", [["year", "Last 12 Months"], ["all", "All Time"]])}
    <section class="at-card"><small class="at-k">Total Cost${on === "year" ? " (Last 12 Months)" : " (All Time)"}</small><div class="at-totalrow"><b class="at-total">${m0(cut.total)}</b>${on === "year" ? `<div class="at-mini2"><b>${m0(own.month)}</b><small>per month (avg)</small></div>${own.perMile ? `<div class="at-mini2"><b>${money(own.perMile)}</b><small>per mile</small></div>` : ""}` : ""}</div>
      ${row("wrench", "Service", counts.service, cut.service)}${row("fuel", "Fuel", counts.fuel ? `${counts.fuel} fills` : "", cut.fuel)}${row("doc", "Papers", counts.papers, cut.papers)}</section>
    <section class="at-card"><div class="at-cardhead"><b>Monthly Spending</b><small>$ (USD)</small></div><div class="at-barwrap"><div class="at-baraxis" aria-hidden="true"><small>${m0(top)}</small><small>${m0(top / 2)}</small><small>$0</small></div><div class="at-bars" role="img" aria-label="Spending each of the last 12 months, highest ${m0(top)}">${vals.map((v, i) => `<span><i style="height:${Math.round(v / top * 100)}%"></i><small>${names[i]}</small></span>`).join("")}</div></div></section>
    <p class="at-note">Service, fuel and papers paid. Extras, the purchase price and any loan interest aren't in this total.</p>${atRow("coin", "What's My Car Costing Me?", "Each month, logged costs and estimates apart", 'data-atgo="costing"')}${atRow("trend", "All Your Expenses", "Every cost, by month", 'data-atgo="expenses"')}`;
}
function atForSale(c) {             // FOR SALE CARD (his board). Only what's true: the car's own specs, what's installed, what's logged.
  const inst = c.extras.filter(x => x.status === "installed").slice(0, 4).map(x => x.name), feats = [...inst, c.services.length ? `Service records kept (${c.services.length})` : "", c.recalls && !openRecalls(c).length ? "No open recalls on our last check" : ""].filter(Boolean);
  return `<div class="at-sale">${atHead("For Sale Card")}<div class="at-saleimg">${atCarImg(c, "at-saleart", true)}<span class="at-ribbon">FOR SALE</span></div>
      <h3>${esc(atFullName(c))}${c.trim ? ` <small>${esc(c.trim)}</small>` : ""}</h3><p class="at-salemi">${AI.gauge}${c.miles != null ? `${miles(c.miles)} mi` : "Miles not set"}</p>
      ${feats.length ? `<b class="at-k2">Key Features</b><ul class="at-feats">${feats.map(x => `<li>${AI.shield}${esc(x)}</li>`).join("")}</ul>` : ""}
      <div class="at-ask"><small>Asking Price</small><b>${c.price ? m0(c.price) : "Not set"}</b></div>
      <div class="at-actions"><button class="at-ghost" data-atcard="${esc(c.id)}">${AI.send}Share Card</button><button class="at-ghost" data-atseg="overview:value" data-atback="1">${AI.pencil}Edit</button></div>${atMsg()}</div>`;
}
function atDetails(c) {
  return atHead("Car Details", "pencil") + `<form class="at-card at-form" data-aedit="${esc(c.id)}"><label class="at-field">VIN<input name="vin" maxlength="17" autocapitalize="characters" spellcheck="false" placeholder="17 characters, optional" value="${esc(c.vin || "")}"></label>${"BarcodeDetector" in window ? `<label class="at-ghost">${AI.scan}Scan the VIN barcode<input type="file" accept="image/*" capture="environment" data-avinscan="1" hidden></label>` : ""}
      <div class="at-three"><label class="at-field">Year<input name="year" inputmode="numeric" maxlength="4" value="${esc(c.year || "")}"></label><label class="at-field">Make<input name="make" value="${esc(c.make || "")}"></label><label class="at-field">Model<input name="model" value="${esc(c.model || "")}"></label></div>
      <label class="at-field">Nickname<input name="nick" maxlength="40" placeholder="Optional, e.g. Dad's truck" value="${esc(c.nick || "")}"></label><button class="at-big">Save Details</button>${atMsg()}</form>
    ${atRow("gauge", "Update Miles", c.miles != null ? `${miles(c.miles)} mi` : "Not set", 'data-atgo="miles"')}${atRow("info", "Car Facts", "Plate, tire size, oil type, battery, wipers", 'data-atgo="facts"')}
    ${c.body || c.engine ? `<p class="at-note">${esc([c.body, c.engine].filter(Boolean).join(" · "))}</p>` : ""}
    <button class="at-ghost danger" data-armcar="${esc(c.id)}">${AI.trash}Remove This Car</button>`;
}

// ---- UPDATE MILES + the check that a typed number looks right
function atMilesWarn(c, val, jumpOnly) {
  const last = c.miles; if (last == null) return "";
  if (val < last) return jumpOnly ? "" : `That's lower than your last reading (${miles(last)}). Is that right?`;
  const lastDay = c.odo.length ? c.odo[c.odo.length - 1].date : null, days = lastDay ? Math.max(1, Math.round((parseDay(today()) - parseDay(lastDay)) / 86400000)) : 30;
  if (val - last > Math.max(5000, days * 500)) return `That's ${miles(val - last)} more miles than your last reading (${miles(last)}). Is that right?`;
  return "";
}
function atMiles(c) {
  const lastDay = c.odo.length ? c.odo[c.odo.length - 1].date : null;
  return atHead("Update Miles", "gauge") + atCarPick(c) + `<form class="at-card at-form at-milesform" data-amiles="${esc(c.id)}"><label class="at-field center">Miles on it now<input class="at-odo" name="miles" inputmode="numeric" placeholder="${c.miles != null ? esc(miles(c.miles)) : "0"}" autocomplete="off"></label>
    ${c.miles != null ? `<p class="at-note center">Last reading ${miles(c.miles)}${lastDay ? ` on ${aDate(lastDay)}` : ""}</p>` : ""}<button class="at-big">Save</button>${atMsg()}</form>`;
}
// LOG SOMETHING: one place to log, so nobody hunts for the right tab.
function atLog(c) {
  const T = [["fuel", "fuel", "Fill-Up"], ["service", "wrench", "Service"], ["miles", "gauge", "Update Miles"], ["papers", "doc", "Paper"], ["photos", "camera", "Photo"], ["journal", "book", "Note"]];
  return atHead("Log Something", "plus") + atCarPick(c) + `<div class="at-tiles big">${T.map(([k, ic, l]) => `<button data-atlog="${k}">${AI[ic]}<span>${l}</span></button>`).join("")}</div>`;
}

// ---- SERVICE (his board)
function atService(c) {
  const seg = atSegOn("service", "services"), t = today();
  const head = atHead("Service", "wrench") + atSeg("service", [["services", "Services"], ["intervals", "Intervals"], ["history", "History"]]);
  const histRow = s => `<div class="at-hist"><span class="at-ric">${AI[AT_SVC_IC[s.kind] || "wrench"]}</span><span class="grow"><b>${esc(svc(s.kind)[2])}</b><small>${aDate(s.date)}${s.miles != null ? ` · ${miles(s.miles)} mi` : ""}${s.note ? ` · ${esc(s.note)}` : ""}</small></span>${s.cost ? `<b class="at-amt">${money(s.cost)}</b>` : ""}<button class="at-xb" data-adel="service:${esc(s.id)}" aria-label="Remove">${AI.x}</button></div>`;
  const all = c.services.slice().sort((a, b) => b.date.localeCompare(a.date));
  if (seg === "history") return head + (all.length ? `<section class="at-card">${all.map(histRow).join("")}</section>` : `<p class="at-note">Nothing logged yet.</p>`) + atMsg();
  if (seg === "intervals") {
    const own = c.every || {};
    return head + `<p class="at-note">Typical intervals, miles or months, whichever comes first. Your owner's manual wins: set your own here.</p><section class="at-card">${AUTO_SERVICES.filter(s => s[0] !== "other").map(([k, , l, mi, mo]) => { const v = own[k];
        const words = (a, b) => [a ? `${miles(a)} mi` : "", b ? `${esc(b)} months` : ""].filter(Boolean).join(" or ") || "Not tracked";
        return `<div class="at-hist"><span class="at-ric">${AI[AT_SVC_IC[k]]}</span><span class="grow"><b>${esc(l)}</b><small>${v ? `Yours: every ${words(v[0], v[1])}` : `Typical: every ${words(mi, mo)}`}</small></span>${v ? `<button class="at-chipb" data-aeveryreset="${esc(k)}">Typical</button>` : ""}</div>`; }).join("")}</section>
      <form class="at-card at-form" data-aevery="${esc(c.id)}"><b class="at-k2">Set Your Own</b><select name="kind" aria-label="Service">${AUTO_SERVICES.filter(s => s[0] !== "other").map(([k, , l]) => `<option value="${k}">${esc(l)}</option>`).join("")}</select>
        <div class="at-two"><input name="mi" inputmode="numeric" placeholder="Every … miles" aria-label="Every how many miles"><input name="mo" inputmode="numeric" placeholder="or … months" aria-label="Or every how many months"></div><button class="at-ghost">Save Interval</button>${atMsg()}</form>`;
  }
  const due = AUTO_SERVICES.filter(s => intervalOf(c, s[0])[0] || intervalOf(c, s[0])[1]).map(s => serviceDue(c, s[0], t));
  const logged = due.filter(d => d.logged).sort((a, b) => (isFinite(a.days) ? a.days : 1e9) - (isFinite(b.days) ? b.days : 1e9)), never = due.filter(d => !d.logged);
  const nOwn = c.every ? Object.keys(c.every).length : 0;
  const rows = logged.map(d => { const s = svc(d.key), at = d.dueMiles != null ? `Due at ${miles(d.dueMiles)} mi` : d.dueDate ? `Due ${aDate(d.dueDate)}` : "";
    return `<div class="at-svc ${d.late ? "late" : d.soon ? "soon" : ""}"><span class="at-ric">${AI[AT_SVC_IC[d.key]]}</span><span class="grow"><b>${esc(s[2])}</b><small>${esc(at)}${d.late && d.leftMi != null && d.leftMi <= 0 ? ` (${miles(-d.leftMi)} mi over)` : ""}</small></span>${d.late ? atPill("Overdue", "late") : d.soon ? atPill("Due Soon", "soon") : atPill("On Track", "ok")}</div>`; }).join("");
  return head + `<p class="at-seclabel">Tracked Services</p><section class="at-list">${rows || `<p class="at-note">Log your last oil change and Auto Hub works out the next one.</p>`}</section>
    ${never.length ? `<p class="at-note">Not logged yet: ${never.map(d => esc(svc(d.key)[2])).join(", ")}.</p>` : ""}
    ${atRow("gear", "Custom Intervals", nOwn ? `${nOwn} custom interval${nOwn === 1 ? "" : "s"}` : "Typical for now", 'data-atseg="service:intervals"')}
    ${atRow("cal", "Maintenance Calendar", "The next 12 months", 'data-atgo="cal"')}
    ${AT.form === "service" ? atServiceForm(c) : atBig("Log Service", 'data-atform="service"', "plus")}
    ${all.length ? `<div class="at-titlerow small"><h3>Recent Service History</h3><button class="at-linky" data-atseg="service:history">View All</button></div><section class="at-card">${all.slice(0, 3).map(histRow).join("")}</section>` : ""}${AT.form === "service" ? "" : atMsg()}`;
}
function atServiceForm(c) {
  return `<form class="at-card at-form" data-aservice="${esc(c.id)}"><div class="at-cardhead"><b>Log Service</b><button type="button" class="at-linky" data-atform="">Cancel</button></div>
    <label class="at-field">What was done<select name="kind">${AUTO_SERVICES.map(([k, , l]) => `<option value="${k}" ${AT.formKind === k ? "selected" : ""}>${esc(l)}</option>`).join("")}</select></label>
    <label class="at-field">Date<input type="date" name="date" value="${today()}"></label><div class="at-two"><label class="at-field">Miles<input name="miles" inputmode="numeric" value="${c.miles != null ? esc(c.miles) : ""}"></label><label class="at-field">Cost $<input name="cost" inputmode="decimal"></label></div>
    <input name="note" placeholder="Note or shop (optional)" aria-label="Note or shop"><button class="at-big">Log It</button>${atMsg()}</form>`;
}

// ---- FUEL & MPG (his board)
function atMpgChart(f) {
  const pts = f.rows.slice(-12); if (pts.length < 2) return `<p class="at-note">The trend shows from your 3rd fill-up. Fill the tank all the way each time.</p>`;
  const vals = pts.map(p => p.mpg), lo = Math.floor(Math.min(...vals) - 1), hi = Math.ceil(Math.max(...vals) + 1), W = 320, H = 132, L = 24, R = 12, T = 18, B = 18;
  const x = i => Math.round(L + i / (pts.length - 1) * (W - L - R)), y = v => Math.round(H - B - (v - lo) / Math.max(1, hi - lo) * (H - T - B));
  const line = pts.map((p, i) => `${i ? "L" : "M"}${x(i)} ${y(p.mpg)}`).join(" "), last = pts[pts.length - 1], lx = x(pts.length - 1), ly = y(last.mpg);
  const ticks = [lo, (lo + hi) / 2, hi].map(v => `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="rgba(148,180,205,.18)"/><text x="${L - 5}" y="${y(v) + 3.500}" text-anchor="end">${Math.round(v)}</text>`).join("");
  const seen = {}, months = pts.map((p, i) => { const m = parseDay(p.date).toLocaleDateString("en-US", { month: "short" }); if (seen[m]) return ""; seen[m] = 1; return `<text x="${x(i)}" y="${H - 4}" text-anchor="middle">${esc(m)}</text>`; }).join("");
  const pw = 38, px = Math.max(L, Math.min(W - pw, lx - pw + 8)), py = Math.max(0, ly - 21);
  return `<svg class="at-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Miles per gallon over your last ${pts.length} fill-ups; the latest is ${last.mpg.toFixed(1)}"><defs><linearGradient id="atmpg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#22d3ee" stop-opacity=".35"/><stop offset="1" stop-color="#22d3ee" stop-opacity="0"/></linearGradient></defs>
      ${ticks}${months}<path d="${line} L${lx} ${H - B} L${x(0)} ${H - B} Z" fill="url(#atmpg)"/><path d="${line}" fill="none" stroke="#22d3ee" stroke-width="2"/>${pts.map((p, i) => `<circle cx="${x(i)}" cy="${y(p.mpg)}" r="2.200" fill="#22d3ee"/>`).join("")}
      <rect x="${px}" y="${py}" width="${pw}" height="16" rx="4" fill="#0e7490" stroke="#22d3ee"/><text class="at-chartval" x="${px + pw / 2}" y="${py + 11.500}" text-anchor="middle">${last.mpg.toFixed(1)}</text></svg>`;
}
function atFuel(c) {
  if (AT.sub === "trip") return atTrip(c);
  if (AT.sub === "check") return atCheck(c);
  const f = fuelStats(c), hist = c.fuel.slice().sort((a, b) => b.miles - a.miles).slice(0, 10), mpgOf = id => (f.rows.find(r => r.id === id) || {}).mpg, tr = AUTO_TRIP && AUTO_TRIP.car === c.id ? AUTO_TRIP : null;
  return atHead("Fuel & MPG", "fuel") + `<div class="at-stats plain"><div><b>${f.mpg ? f.mpg.toFixed(1) : "–"}</b><small>Avg MPG</small></div><div><b>${f.perMile ? "$" + f.perMile.toFixed(2) : "–"}</b><small>Fuel Cost / Mile</small></div><div><b>${m0(f.month)}</b><small>Last 30 Days</small></div></div>
    <section class="at-card"><div class="at-cardhead"><b>MPG Trend</b><button class="at-linky" data-atgo="fuelstats">Fuel Analytics</button></div>${atMpgChart(f)}</section>
    ${AT.form === "fuel" ? `<form class="at-card at-form" data-afuel="${esc(c.id)}"><div class="at-cardhead"><b>Add Fill-Up</b><button type="button" class="at-linky" data-atform="">Cancel</button></div>
      <div class="at-three"><label class="at-field">Odometer<input name="miles" inputmode="numeric" required></label><label class="at-field">Gallons<input name="gal" inputmode="decimal" required></label><label class="at-field">Total $<input name="cost" inputmode="decimal"></label></div>
      <label class="at-field">Date<input type="date" name="date" value="${today()}"></label><button class="at-big">Add Fill-Up</button>${atMsg()}</form>` : atBig("Add Fill-Up", 'data-atform="fuel"', "plus")}
    <section class="at-card"><div class="at-cardhead">${AI.road}<b>Road Trip Estimator</b></div>
      <div class="at-kv"><span>Trip Distance</span><b>${tr && tr.res ? `${miles(tr.res.miles)} mi` : "–"}</b></div><div class="at-kv"><span>Est. Fuel Needed</span><b>${tr && tr.res ? `≈ ${tr.res.gallons.toFixed(1)} gal` : "–"}</b></div><div class="at-kv"><span>Est. Fuel Cost</span><b>${tr && tr.res ? `≈ ${m0(tr.res.cost)}` : "–"}</b></div>
      <button class="at-big small" data-atsub="trip">Estimate Trip</button><button class="at-line" data-atsub="check"><span class="grow"><b>Before You Go</b></span>${AI.chev}</button></section>
    ${hist.length ? `<p class="at-seclabel">Fill-Ups</p><section class="at-card">${hist.map(x => `<div class="at-hist"><span class="at-ric">${AI.fuel}</span><span class="grow"><b>${aDate(x.date)} · ${miles(x.miles)} mi</b><small>${esc(x.gal)} gal${x.cost ? ` · ${money(x.cost)}` : ""}${mpgOf(x.id) ? ` · ${mpgOf(x.id).toFixed(1)} MPG` : ""}</small></span><button class="at-xb" data-adel="fuel:${esc(x.id)}" aria-label="Remove">${AI.x}</button></div>`).join("")}</section>` : ""}${AT.form === "fuel" ? "" : atMsg()}`;
}
function atTrip(c) {                // ROAD TRIP PLANNER (his board). No route lookup yet: the miles are typed. From and To are just your labels.
  const f = fuelStats(c), tr = AUTO_TRIP && AUTO_TRIP.car === c.id ? AUTO_TRIP : null;
  return `<div class="at-bandpage">${atBandHead("road", "Road Trip Planner")}
    <form class="at-form at-tripform" data-atrip="${esc(c.id)}"><div class="at-rowin">${AI.pin}<label>From<input data-atlabel="from" value="${esc(AT.from)}" placeholder="Optional"></label></div><div class="at-rowin">${AI.pin}<label>To<input data-atlabel="to" value="${esc(AT.to)}" placeholder="Optional"></label></div>
      <div class="at-rowin">${AI.road}<label>Distance, one way (miles)<input name="miles" inputmode="numeric" value="${tr ? esc(tr.oneWay) : ""}" required></label></div>
      <label class="at-rowin at-switchrow">${AI.history}<span class="grow">Round Trip</span><input type="checkbox" name="round" ${!tr || tr.round ? "checked" : ""}><i class="at-switch" aria-hidden="true"></i></label>
      <div class="at-rowin">${AI.car}<span class="grow"><small>Your Vehicle</small><b>${esc(atShort(c))}${f.mpg ? ` (${f.mpg.toFixed(1)} MPG)` : ""}</b></span></div>
      ${f.mpg ? "" : `<div class="at-rowin">${AI.gauge}<label>MPG<input name="mpg" inputmode="decimal" value="${tr && tr.mpg ? esc(tr.mpg) : ""}" required></label></div>`}
      <div class="at-rowin">${AI.fuel}<label>Gas Price (per gal)<input name="price" inputmode="decimal" value="${esc(garage().gas || "")}" required></label></div>
      ${tr && tr.res ? `<div class="at-est"><div><small>Estimated Fuel</small><b>${tr.res.gallons.toFixed(1)} gal</b></div><div><small>Estimated Cost</small><b>${m0(tr.res.cost)}</b></div></div>` : ""}
      <button class="at-big">Plan Trip</button>${atMsg()}</form>
    ${tr && tr.res ? `<button class="at-ghost" data-atriplog="${esc(c.id)}">${AI.book}Save to Journal</button>` : ""}<button class="at-line" data-atsub="check"><span class="grow"><b>Before You Go</b></span>${AI.chev}</button>
    <p class="at-note">Auto Hub doesn't look up routes yet, so type the miles.</p></div>`;
}
function atCheck(c) {               // BEFORE YOU GO (his board): what the log already knows, and what only you can tick.
  const L = tripChecks(c, today()), done = L.filter(x => x.ok).length;
  const ic = { oil: "oil", recalls: "triangle", papers: "shield", tires: "tire", wipers: "wiper", lights: "sun", kit: "box", charge: "plug" };
  return `<div class="at-bandpage">${atBandHead("road", "Pre-Trip Checklist", "Before You Go")}<p class="at-note">Make sure your car is ready for the road. ${done} of ${L.length} done.</p>
    <section class="at-card">${L.map(x => `<div class="at-chk"><span class="at-ric">${AI[ic[x.key]] || AI.check}</span><span class="grow"><b>${esc(x.text)}</b>${x.auto ? `<small>From your log</small>` : ""}</span>${x.auto ? `<span class="at-box ${x.ok ? "on" : "bad"}" aria-label="${x.ok ? "OK" : "Needs a look"}">${x.ok ? "✓" : "!"}</span>` : `<button class="at-box ${x.ok ? "on" : ""}" data-atripchk="${esc(x.key)}" aria-pressed="${x.ok}" aria-label="${esc(x.text)}">${x.ok ? "✓" : ""}</button>`}</div>`).join("")}</section>
    ${atBig("Save to Journal", `data-atchecklog="${esc(c.id)}"`, "book")}<button class="at-ghost" data-atripreset="${esc(c.id)}">Start Fresh</button></div>`;
}

// ---- PAPERS (his board)
function atPapers(c) {
  const seg = atSegOn("papers", "all"), t = today(), soon = x => x.expires && x.expires <= addDays(t, 30), all = c.papers.slice().sort((a, b) => (a.expires || "9999").localeCompare(b.expires || "9999"));
  const list = seg === "active" ? all.filter(x => !soon(x)) : seg === "renew" ? all.filter(soon) : all;
  const row = x => { const k = paper(x.kind), n = x.expires ? daysUntil(x.expires) : null, open = AT.papersOpen === x.id;
    return `<article class="at-paper"><button class="at-paperhead" data-atpaper="${esc(x.id)}" aria-expanded="${open}"><span class="at-ric">${AI[AT_PAPER_IC[x.kind]]}</span><span class="grow"><b>${esc(k[2])}</b>${x.name ? `<small>${esc(x.name)}</small>` : ""}${x.expires ? `<small>${n < 0 ? "Expired" : x.kind === "insurance" ? "Renews" : "Expires"} ${aDate(x.expires)}</small>` : ""}</span>${n != null && n < 0 ? atPill("Expired", "late") : soon(x) ? atPill("Renew Soon", "soon") : atPill("Active", "ok")}</button>
      ${open ? `<div class="at-paperbody">${x.cost ? `<small>Cost ${money(x.cost)}</small>` : ""}${x.ref ? `<small>Policy #${esc(x.ref)}</small>` : ""}${x.note ? `<small>${esc(x.note)}</small>` : ""}<div class="at-actions">${x.expires ? `<button class="at-ghost" data-arenew="${esc(x.id)}">Renewed</button>` : ""}<button class="at-ghost danger" data-adel="paper:${esc(x.id)}">Remove</button></div></div>` : ""}</article>`; };
  return atHead("Papers", "doc") + atSeg("papers", [["all", "All"], ["active", "Active"], ["renew", "Renewals"]])
    + `<section class="at-list">${list.map(row).join("") || `<p class="at-note">${seg === "renew" ? "Nothing to renew in the next 30 days." : "Keep the dates that matter: insurance, registration, inspection, warranties."}</p>`}</section>
    ${AT.form === "papers" ? `<form class="at-card at-form" data-apaper="${esc(c.id)}"><div class="at-cardhead"><b>Add Paper</b><button type="button" class="at-linky" data-atform="">Cancel</button></div>
      <label class="at-field">What<select name="kind">${AUTO_PAPERS.map(([k, , l]) => `<option value="${k}">${esc(l)}</option>`).join("")}</select></label><input name="name" placeholder="Company or name (optional)" aria-label="Company or name">
      <label class="at-field">Expires<input type="date" name="expires"></label><div class="at-two"><label class="at-field">Cost $<input name="cost" inputmode="decimal"></label><label class="at-field">Policy #<input name="ref"></label></div><input name="note" placeholder="Note (optional)" aria-label="Note"><button class="at-big">Add Paper</button>${atMsg()}</form>` : atBig("Add Paper", 'data-atform="papers"', "plus") + atMsg()}
    ${atRow("shield", "Warranty Tracker", "Coverage dates and mileage limits", 'data-atgo="warranty"')}${atRow("bell", "Reminders", "Alerts as the dates get close", 'data-atgo="reminders"')}`;
}

// ---- EXTRAS (his board)
function atExtras(c) {
  const seg = atSegOn("extras", "installed"), inst = c.extras.filter(x => x.status === "installed"), wish = c.extras.filter(x => x.status !== "installed"), sum = l => l.reduce((n, x) => n + (x.cost || 0), 0);
  const list = seg === "wish" ? wish : inst;
  return atHead("Extras", "box") + `<div class="at-stats plain"><div><b>${inst.length}</b><small>Installed</small></div><div><b>${m0(sum(inst))}</b><small>Invested</small></div><div><b>${m0(sum(wish))}</b><small>Wishlist</small></div></div>`
    + atSeg("extras", [["installed", `Installed (${inst.length})`], ["wish", `Wishlist (${wish.length})`]])
    + `<section class="at-list">${list.map(x => `<div class="at-svc"><span class="at-ric">${AI.box}</span><span class="grow"><b>${esc(x.name)}</b><small>${esc(xcat(x.cat)[2])}${x.status === "installed" && x.date ? ` · Installed ${aDate(x.date)}` : ""}${x.cost ? ` · ${m0(x.cost)}` : ""}${x.note ? ` · ${esc(x.note)}` : ""}</small></span>${x.status === "installed" ? "" : `<button class="at-chipb" data-ainstall="${esc(x.id)}">Installed</button>`}<button class="at-xb" data-adel="extra:${esc(x.id)}" aria-label="Remove">${AI.x}</button></div>`).join("") || `<p class="at-note">Wheels, tint, exhaust, dash cam, seat covers: everything you add or want to add, with what it cost.</p>`}</section>
    ${AT.form === "extras" ? `<form class="at-card at-form" data-aextra="${esc(c.id)}"><div class="at-cardhead"><b>Add Upgrade</b><button type="button" class="at-linky" data-atform="">Cancel</button></div><input name="name" placeholder="Extra or upgrade, e.g. Window tint" required aria-label="Extra or upgrade">
      <div class="at-three"><select name="cat" aria-label="Kind">${AUTO_EXTRA_CATS.map(([k, , l]) => `<option value="${k}">${esc(l)}</option>`).join("")}</select><input name="cost" inputmode="decimal" placeholder="Cost $" aria-label="Cost"><select name="status" aria-label="Installed or wishlist"><option value="installed">Installed</option><option value="wish">Wishlist</option></select></div>
      <input name="note" placeholder="Brand, shop, notes (optional)" aria-label="Notes"><button class="at-big">Add Upgrade</button>${atMsg()}</form>` : atBig("Add Upgrade", 'data-atform="extras"', "plus") + atMsg()}`;
}

// ---- PHOTOS (his board)
const AT_PHOTO_CHIPS = [["all", "All"], ["car", "Car"], ["receipt", "Receipt"], ["paper", "Paper"], ["damage", "Damage"], ["ba", "Before/After"]];
function atPhotos(c) {
  if (AUTO_VIEW) { const p = c.photos.find(x => x.id === AUTO_VIEW);
    if (p) return atHead("Photo", "camera") + `<div class="at-photobig"><img data-aphoto="${esc(p.id)}" alt="${esc(p.cap || ptag(p.tag)[2])}"></div><p class="at-note">${esc(ptag(p.tag)[2])} · ${aDate(p.date)}${p.cap ? ` · ${esc(p.cap)}` : ""}${c.cover === p.id ? " · Cover" : ""}</p>
      <div class="at-actions"><button class="at-ghost" data-aview="">Back to Photos</button>${c.cover === p.id ? "" : `<button class="at-ghost" data-acover="${esc(p.id)}">Make It the Cover</button>`}<button class="at-ghost danger" data-adel="photo:${esc(p.id)}">Remove</button></div>`;
    AUTO_VIEW = null; }
  const tag = AT.tag, shown = c.photos.slice().reverse().filter(p => tag === "all" || (tag === "ba" ? ["before", "after"].includes(p.tag) : p.tag === tag));
  return atHead("Photos", "camera") + `<div class="at-cover">${atCarImg(c, "at-coverimg", true)}<span class="at-covertag">Cover Photo</span></div>
    <div class="at-chips wrap">${AT_PHOTO_CHIPS.map(([k, l]) => `<button class="${tag === k ? "on" : ""}" data-attag="${k}">${esc(l)}${k === "all" ? ` (${c.photos.length})` : ""}</button>`).join("")}</div>
    ${shown.length ? `<div class="at-grid">${shown.map(p => `<button data-aview="${esc(p.id)}" aria-label="${esc(ptag(p.tag)[2])} photo"><img data-aphoto="${esc(p.id)}" alt=""></button>`).join("")}</div>` : `<p class="at-note">The car, before and after an upgrade, receipts, damage after a bump: all in one place.</p>`}
    <form class="at-card at-form" data-aphotoform="${esc(c.id)}"><div class="at-two"><select name="tag" aria-label="What the photo is">${PHOTO_TAGS.map(([k, , l]) => `<option value="${k}">${esc(l)}</option>`).join("")}</select><input name="cap" placeholder="Caption (optional)" aria-label="Caption"></div>
      <label class="at-big">${AI.plus}Add Photos<input type="file" accept="image/*" data-aphotoadd="${esc(c.id)}" hidden></label></form>
    <p class="at-note">Tap a photo to make it the cover. Full-size photos stay on this phone; only the small cover picture is in a backup.</p>`;
}

// ---- AI MECHANIC + its history (his boards). Same question and handler as the old tab. Never a diagnosis.
const AT_LIKELY = { high: ["High", "late"], medium: ["Medium", "soon"], low: ["Low", "ok"] }, AT_URGENT = { stop: ["Stop", "late"], soon: ["Soon", "soon"], watch: ["Watch", "ok"] };
function atMech(c) {
  if (AT.sub === "history") return atHead("AI Mechanic History", "history") + `<p class="at-note">Your past questions and answers.</p><section class="at-list">${c.mech.map(m => `<article class="at-mhist"><div class="at-mhead"><span class="at-ric">${AI.chip}</span><span class="grow"><b>${esc(m.q)}${m.code ? ` · ${esc(m.code)}` : ""}</b><small>${aDate(m.date)}</small></span>${atPill((AT_URGENT[m.a.urgency] || AT_URGENT.watch)[0], (AT_URGENT[m.a.urgency] || AT_URGENT.watch)[1])}</div><p>${esc(m.a.summary || (m.a.causes[0] ? m.a.causes[0].cause : ""))}</p><button class="at-chipb" data-amechsave="${esc(m.id)}">Save to Journal</button></article>`).join("") || `<p class="at-note">Nothing asked yet.</p>`}</section><p class="at-note">Guesses from what you described, not a diagnosis.</p>${atBig("Ask the AI Mechanic Again", 'data-atsub=""', "sparkle")}${atMsg()}`;
  const AT_DIY = { easy: "easy to do yourself", medium: "doable with tools", shop: "a shop job" }, last = c.mech[0], a = last && last.a, checks = a && a.check ? a.check.split(/(?<=[.;])\s+/).filter(Boolean).slice(0, 4) : [];
  return atHead("AI Mechanic", "chip") + `${aiOn() ? "" : `<p class="at-note warn">${esc(aiMissing("The AI Mechanic"))}</p><button class="at-ghost" data-atset="aiBox">${AI.sparkle}AI Helper Settings</button>`}
    <form class="at-form" data-amech="${esc(c.id)}"><label class="at-field">What's going on with your car?<textarea name="what" rows="2" placeholder="It's making a squealing noise when I brake, especially at low speeds."></textarea></label>
      <div class="at-two"><input name="code" maxlength="8" autocapitalize="characters" placeholder="Trouble code" aria-label="Trouble code, optional"><label class="at-ghost">${AUTO_MECHPIC ? "Photo added ✓" : "Dash light photo"}<input type="file" accept="image/*" data-amechpic="1" hidden></label></div>
      <button class="at-big" ${AUTO_ASKING || !aiOn() ? "disabled" : ""}>${AI.sparkle}${AUTO_ASKING ? "Thinking…" : "Ask the AI Mechanic"}</button>${atMsg()}</form>
    ${a ? `<div class="at-titlerow small"><h3>Likely Causes</h3>${atPill((AT_URGENT[a.urgency] || AT_URGENT.watch)[0], (AT_URGENT[a.urgency] || AT_URGENT.watch)[1])}</div><p class="at-note"><b>${esc(last.q)}${last.code ? ` · ${esc(last.code)}` : ""}</b>${a.summary ? `<br>${esc(a.summary)}` : ""}</p>
      <section class="at-list">${a.causes.map((x, i) => `<div class="at-svc"><span class="at-num">${i + 1}</span><span class="grow"><b>${esc(x.cause)}</b><small>${[x.why, AT_DIY[x.diy], x.cost ? `about ${x.cost}` : ""].filter(Boolean).map(esc).join(" · ")}</small></span>${atPill((AT_LIKELY[x.likely] || AT_LIKELY.low)[0], (AT_LIKELY[x.likely] || AT_LIKELY.low)[1])}</div>`).join("")}</section>
      ${checks.length ? `<p class="at-seclabel">What to Check Now</p><section class="at-card">${checks.map(t => `<div class="at-chk"><span class="at-box on small">✓</span><span class="grow">${esc(t)}</span></div>`).join("")}</section>` : ""}
      ${a.shop ? `<p class="at-note"><b>See a mechanic:</b> ${esc(a.shop)}</p>` : ""}<p class="at-note">${aDate(last.date)}. A guess from your description, not a diagnosis.</p>
      <div class="at-actions"><button class="at-ghost" data-amechsave="${esc(last.id)}">Save to Journal</button></div>` : `<p class="at-note">It knows this car's miles and service history. Brakes, steering, smoke, overheating or a flashing check-engine light: pull over safely and get help.</p>`}
    <a class="at-ghost" href="${esc(shopLink("auto repair"))}" target="_blank" rel="noopener">${AI.wrench}Find a Shop Near Me</a>
    ${c.mech.length ? atRow("history", "AI Mechanic History", `${c.mech.length} saved`, 'data-atsub="history"') : ""}`;
}

// ---- RECALLS (his board). PARK IT only when NHTSA says so.
function atRecalls(c) {
  const head = atHead("Recalls", "triangle");
  if (AUTO_BUSY) return head + `<p class="at-note">Checking the government recall list…</p>`;
  if (!c.recalls) return head + `<p class="at-note">Check for safety recalls on every ${esc([c.year, c.make, c.model].filter(Boolean).join(" ") || "car like yours")} (NHTSA, free).</p>${atBig("Check Recalls", `data-arecall="${esc(c.id)}"`, "triangle")}${atMsg()}`;
  const open = openRecalls(c), past = c.recalls.list.filter(r => c.recallDone[r.id]), parks = open.filter(r => r.park);
  const row = (r, done) => `<article class="at-recall ${r.park && !done ? "red" : ""}"><button class="at-box ${done ? "on" : ""}" data-arfix="${esc(r.id)}" aria-pressed="${!!done}" aria-label="Mark fixed">${done ? "✓" : ""}</button><div class="grow"><b>${r.park && !done ? "PARK IT: " : ""}${esc(r.part)}</b><small>${esc(r.summary.slice(0, 200))}${r.summary.length > 200 ? "…" : ""}</small>${done ? "" : `<small>Fix: ${esc(r.remedy.slice(0, 140))}${r.remedy.length > 140 ? "…" : ""}</small>`}<small>Recall No. ${esc(r.id)}</small></div></article>`;
  return head + (parks.length ? `<section class="at-park">${AI.triangle}<b>PARK IT</b><p>${parks.length} open recall${parks.length === 1 ? "" : "s"} with a safety risk. Don't drive it until this is fixed. Recall repairs are free at the dealer.</p></section>` : !open.length ? `<section class="at-allclear">${AI.shield}<b>No Open Recalls</b><small>Checked ${aDate(c.recalls.at)}</small></section>` : "")
    + `${open.length ? `<p class="at-seclabel">Open Recalls (${open.length})</p><section class="at-list">${open.map(r => row(r, false)).join("")}</section>` : ""}${past.length ? `<p class="at-seclabel">Past Recalls (${past.length})</p><section class="at-list">${past.map(r => row(r, true)).join("")}</section>` : ""}
    <p class="at-note">${open.length ? "Recall repairs are free at the dealer. " : ""}For this year, make and model, checked ${aDate(c.recalls.at)}. Not every one applies to every car; your VIN at NHTSA or the dealer confirms yours. Tap the box when one's fixed.</p>
    <a class="at-big" href="https://www.nhtsa.gov/recalls" target="_blank" rel="noopener">Check with NHTSA</a><button class="at-ghost" data-arecall="${esc(c.id)}">Check Again</button>${atMsg()}`;
}

// ---- JOURNAL (his board): one timeline, with filters.
const AT_JOURNAL_KIND = x => /^Fill-up/.test(x.text) ? "fuel" : x.note ? "note" : / installed$/.test(x.text) ? "extras" : / paid$/.test(x.text) || x.text === "Added to Auto Hub" ? "other" : "service";
const AT_J_IC = { fuel: "fuel", note: "doc", extras: "box", service: "wrench", other: "doc" };
function atJournal(c, root) {
  const items = carJournal(c), tag = AT.jtag, shown = items.filter(x => tag === "all" || AT_JOURNAL_KIND(x) === tag); let month = "";
  return (root ? `<h2 class="at-head root"><span class="at-headic">${AI.book}</span><span class="grow">Journal</span></h2>` : atHead("Journal", "book")) + atCarPick(c)
    + `<div class="at-chips">${[["all", "All"], ["service", "Service"], ["fuel", "Fill-Up"], ["note", "Note"], ["extras", "Extras"]].map(([k, l]) => `<button class="${tag === k ? "on" : ""}" data-atjtag="${k}">${l}</button>`).join("")}</div>
    ${AT.form === "journal" ? `<form class="at-card at-form" data-anote="${esc(c.id)}"><div class="at-cardhead"><b>Add a Note</b><button type="button" class="at-linky" data-atform="">Cancel</button></div><input name="text" placeholder="Add to the journal" required aria-label="Note"><label class="at-field">Date<input type="date" name="date" value="${today()}"></label><button class="at-big">Add Note</button></form>` : ""}
    <div class="at-time">${shown.map(x => { const m = x.date.slice(0, 7), h = m !== month ? `<p class="at-month">${parseDay(x.date).toLocaleDateString("en-US", { month: "long", year: "numeric" })}</p>` : ""; month = m; const k = AT_JOURNAL_KIND(x);
      return h + `<div class="at-tl"><span class="at-tldot"></span><div class="at-tlcard"><span class="at-ric">${AI[AT_J_IC[k]]}</span><span class="grow"><b>${esc(x.text)}</b><small>${aDate(x.date)}${x.sub ? ` · ${esc(x.sub)}` : ""}</small></span>${x.note ? `<button class="at-xb" data-adel="note:${esc(x.note)}" aria-label="Remove">${AI.x}</button>` : ""}</div></div>`; }).join("") || `<p class="at-note">Everything you log shows here as one timeline: services, fill-ups, papers, extras and your own notes.</p>`}</div>
    ${AT.form === "journal" ? "" : `<button class="at-addfab" data-atform="journal" aria-label="Add a note">${AI.plus}</button>`}`;
}

// ---- SCAN: start, then the review (his board). The AI reads, you check every field, nothing saves until you tap.
function atScan(c) {
  const T = [["Service Receipt", "doc"], ["Gas Pump", "fuel"], ["Odometer", "gauge"], ["Insurance or Registration", "id"], ["VIN", "car"]];
  return `<h2 class="at-head root"><span class="at-headic">${AI.scan}</span><span class="grow">Smart Scan</span></h2>${atCarPick(c)}<p class="at-note">What are you scanning? Take a picture. We read it, and you check everything before it saves.</p>
    ${aiOn() ? "" : `<p class="at-note warn">${esc(aiMissing("Smart Scan"))}</p><button class="at-ghost" data-atset="aiBox">${AI.sparkle}AI Helper Settings</button>`}
    <div class="at-tiles big">${T.map(([l, ic]) => `<label class="at-tilelab">${AI[ic]}<span>${esc(l)}</span><input type="file" accept="image/*" data-ascan="${esc(c.id)}" hidden></label>`).join("")}<button ${atCarGo(c, "photos")}>${AI.camera}<span>Just Keep the Photo</span></button></div>`;
}
function atScanReview() {
  const f = AUTO_SCAN.f, want = { receipt: "date miles cost service company", fuel: "date miles cost gal", odometer: "date miles", paper: "date cost paperKind company expires", vin: "vin", other: "" }[f.kind].split(" "), show = (k, h) => want.includes(k) ? h : "";
  const row = (ic, label, html) => `<div class="at-rowin">${AI[ic]}<label>${esc(label)}${html}</label></div>`;
  return atHead("Smart Scan Review") + `<div class="at-scanhead"><img src="${esc(AUTO_SCAN.img)}" alt="Your photo"><div><b>${esc(SCAN_KINDS.find(k => k[0] === f.kind)[2])}</b><small>Scanned &amp; read</small><small class="at-okline">${AI.shield}Check it, then save</small></div></div>
    <p class="at-seclabel">Extracted Details <small>(Review &amp; Edit)</small></p>
    <form class="at-form at-tripform" data-ascansave="1" data-atscan="${AUTO_SCAN.sig || (AUTO_SCAN.sig = ++AT_SCAN_N)}">
      <div class="at-two"><select name="kind" data-ascankind="1" aria-label="What it is">${SCAN_KINDS.map(([k, , l]) => `<option value="${k}" ${f.kind === k ? "selected" : ""}>${esc(l)}</option>`).join("")}</select><select name="car" aria-label="Which car">${garage().cars.map(c => `<option value="${esc(c.id)}" ${f.car === c.id ? "selected" : ""}>${esc(carName(c))}</option>`).join("")}</select></div>
      ${show("service", row("wrench", "Service Type", `<select name="service">${AUTO_SERVICES.map(([k, , l]) => `<option value="${k}" ${f.service === k ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>`))}
      ${show("paperKind", row("doc", "Which Paper", `<select name="paperKind">${AUTO_PAPERS.map(([k, , l]) => `<option value="${k}" ${f.paperKind === k ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>`))}
      ${show("date", row("history", "Date", `<input type="date" name="date" value="${esc(f.date)}">`))}${show("cost", row("coin", "Total Paid", `<input name="cost" inputmode="decimal" value="${esc(f.cost)}">`))}
      ${show("miles", row("gauge", "Odometer", `<input name="miles" inputmode="numeric" value="${esc(f.miles)}">`))}${show("gal", row("fuel", "Gallons", `<input name="gal" inputmode="decimal" value="${esc(f.gal)}">`))}
      ${show("company", row("bank", "Shop or Company", `<input name="company" value="${esc(f.company)}">`))}${show("expires", row("history", "Expires", `<input type="date" name="expires" value="${esc(f.expires)}">`))}${show("vin", row("car", "VIN", `<input name="vin" maxlength="17" autocapitalize="characters" value="${esc(f.vin)}">`))}
      ${row("pencil", "Note", `<input name="note" value="${esc(f.note)}">`)}
      <label class="at-tick"><input type="checkbox" name="keep" checked><span>Keep the photo with the car</span></label>
      <button class="at-big">Save to Journal</button>${atMsg()}</form>
    <label class="at-ghost">${AI.plus}Scan Another<input type="file" accept="image/*" data-ascan="${esc(f.car)}" hidden></label>`;
}

// ---- ROADSIDE HELP (his boards, Scott: "i like these ideas"). Built from what the app already keeps, plus the numbers you save here.
const atHelp = c => { c.help = c.help && typeof c.help === "object" ? c.help : {}; return c.help; };
const atPlainNum = (v, n) => String(v == null ? "" : v).trim().slice(0, n);
const atTrimWords = s => { const t = s.replace(/^[^\d+*#]+/, ""), m = t.match(/^([\d+*#().\s-]*\d[\d().\s-]*?)\s+[A-Za-z].*$/); return m && m[1].replace(/\D/g, "").length >= 7 ? m[1] : t; };   // "AAA 800-222-4357" and "800-222-4357 AAA", but 1 800 AAA HELP stays whole
const atTel = v => atTrimWords(String(v || "").trim().replace(/\s*(?:x|ext\.?|extension)\s*\d+\s*$/i, "")).toUpperCase().replace(/[A-Z]/g, ch => "22233344455566677778889999"[ch.charCodeAt(0) - 65]).replace(/[^\d+*#]/g, "").slice(0, 20);   // 1-800-AAA-HELP, *222, and an extension left off the dial
const atCallBtn = (label, num) => atTel(num) ? `<a class="at-big" href="tel:${esc(atTel(num).replace(/#/g, "%23"))}">${AI.phone}<span>${esc(label)}<small class="at-dial">${esc(atTel(num))}</small></span></a>` : "";
const atNumForm = (c, key, label) => `<form class="at-card at-form" data-athelp="${esc(c.id)}:${key}"><label class="at-field">${esc(label)}<input name="num" inputmode="tel" autocomplete="off" value="${esc(atHelp(c)[key] || "")}" placeholder="Save the number here"></label><button class="at-ghost">Save Number</button></form>`;
function atRoadside(c) {
  const T = [["rs:plan", "tow", "Roadside Plan", "Call for a tow, jump or lockout"], ["rs:insurance", "id", "Insurance Card", "View your insurance information"], ["rs:tow", "tow", "Tow Info", "Your saved tow provider"], ["rs:accident", "triangle", "Accident Checklist", "Step by step after an accident"]];
  return `<div class="at-bandpage">${atBandHead("roadside", "Roadside Help")}<p class="at-note">Fast help and key info when you're stuck, have a breakdown, or an accident.</p>${atCarPick(c)}
    <div class="at-help">${T.map(([g, ic, l, s]) => `<button data-atgo="${g}">${AI[ic]}<b>${esc(l)}</b><small>${esc(s)}</small></button>`).join("")}
      <a href="${esc(shopLink("auto repair"))}" target="_blank" rel="noopener">${AI.wrench}<b>Call a Shop</b><small>Find a repair shop nearby</small></a>
      <button data-atlocation="1">${AI.send}<b>Share My Location</b><small>Send where you are to someone</small></button></div>
    <button class="at-row" data-atgo="rs:what"><span class="at-ric">${AI.info}</span><span class="grow"><b>What to Do Now</b><small>Breakdown, flat tire, won't start, locked out</small></span>${AI.chev}</button>
    <a class="at-call911" href="tel:911">${AI.phone}Call 911 if anyone is hurt or you're in danger</a></div>`;
}
function atHelpPage(c, key) {
  const papers = k => c.papers.filter(x => x.kind === k), H = atHelp(c), r = papers("roadside")[0], ins = papers("insurance")[0];
  if (key === "plan") return atHead("Roadside Plan", "tow") + `<section class="at-card">${r ? `<b>${esc(r.name || "Your roadside plan")}</b>${r.ref ? `<small class="at-sm">Member #${esc(r.ref)}</small>` : ""}${r.expires ? `<small class="at-sm">Good to ${aDate(r.expires)}</small>` : ""}` : `<p class="at-note">No roadside plan saved yet. Add one under Papers, then it shows here.</p>`}</section>${atCallBtn("Call Roadside", H.roadside)}${atNumForm(c, "roadside", "Roadside phone number")}${r ? "" : atRow("doc", "Add a Roadside Plan", "Goes in Papers", atCarGo(c, "papers"))}${atMsg()}`;
  if (key === "insurance") return atHead("Insurance Card", "id") + `<section class="at-card at-inscard">${ins ? `<small class="at-k">Insurance</small><b>${esc(ins.name || "Your insurance")}</b>${ins.ref ? `<small class="at-sm">Policy #${esc(ins.ref)}</small>` : ""}${ins.expires ? `<small class="at-sm">Good to ${aDate(ins.expires)}</small>` : ""}<small class="at-sm">${esc(atFullName(c))}</small>${c.vin ? `<small class="at-sm">VIN ${esc(c.vin)}</small>` : ""}` : `<p class="at-note">No insurance saved yet. Add it under Papers, then it shows here.</p>`}</section>${atCallBtn("Call Insurance", H.insurance)}${atNumForm(c, "insurance", "Insurance claims phone number")}${ins ? "" : atRow("doc", "Add Your Insurance", "Goes in Papers", atCarGo(c, "papers"))}<p class="at-note">Keep your real insurance card with you too. Some places require it.</p>${atMsg()}`;
  if (key === "tow") return atHead("Tow Info", "tow") + `${atCallBtn("Call Tow", H.tow)}${atNumForm(c, "tow", "Tow company phone number")}<section class="at-card"><p class="at-note">Good to tell them: where you are, ${esc(atFullName(c))}, and whether it rolls and steers.</p></section>${atMsg()}`;
  if (key === "accident") { const steps = ["Check everyone. If anyone is hurt, call 911.", "Get to a safe spot if you can. Hazard lights on.", "Call the police if it's needed where you are.", "Swap names, phone numbers, insurance and plate numbers.", "Stick to the facts about what happened.", "Take photos of the cars, the plates and the scene.", "Call your insurance.", "Write down what happened while it's fresh."], t = AT.ticks;
    return atHead("Accident Checklist", "triangle") + `<section class="at-card">${steps.map((x, i) => `<div class="at-chk"><span class="grow"><b>${i + 1}. ${esc(x)}</b></span><button class="at-box ${t[i] ? "on" : ""}" data-attick="${i}" aria-pressed="${!!t[i]}" aria-label="Done">${t[i] ? "✓" : ""}</button></div>`).join("")}</section>
      <a class="at-big red" href="tel:911">${AI.phone}Call 911</a>${atCallBtn("Call Insurance", H.insurance)}
      <form class="at-form" data-aphotoform="${esc(c.id)}"><input type="hidden" name="tag" value="damage"><input type="hidden" name="cap" value="Accident"><label class="at-ghost">${AI.camera}Take a Damage Photo<input type="file" accept="image/*" capture="environment" data-aphotoadd="${esc(c.id)}" hidden></label></form>
      ${atRow("book", "Write It in the Journal", "What happened, while it's fresh", 'data-atlog="journal"')}<p class="at-note">General tips only. Your insurer and local law come first.</p>`; }
  const tips = [["Breakdown", "Pull over somewhere safe, hazards on. If you can't get off the road, stay buckled, call 911 and wait for help away from traffic."], ["Flat Tire", "Get to level ground away from traffic. Use your spare if you know how, or call roadside."], ["Won't Start", "Check that it's in park, then the battery lights. A jump may do it; roadside can help."], ["Locked Out", "Don't break a window unless someone's in danger. Call roadside. If a child or pet is inside, call 911."], ["Overheating", "Pull over, turn it off, and wait before opening the hood. Don't open a hot radiator cap."]];
  return atHead("What to Do Now", "info") + `<section class="at-list">${tips.map(([h, t]) => `<div class="at-svc"><span class="grow"><b>${esc(h)}</b><small>${esc(t)}</small></span></div>`).join("")}</section><p class="at-note">General tips only. If you're in danger, call 911.</p>`;
}
function atShareLocation() {
  if (!navigator.geolocation) { toast("This phone can't share its location here"); return; }
  toast("Finding where you are…");
  navigator.geolocation.getCurrentPosition(p => { const url = `https://www.google.com/maps?q=${p.coords.latitude.toFixed(5)},${p.coords.longitude.toFixed(5)}`, text = `I need help. I'm here: ${url}`;
    if (navigator.share) navigator.share({ text }).catch(() => {});
    else if (navigator.clipboard) navigator.clipboard.writeText(text).then(() => toast("Your location is copied. Paste it into a message"), () => toast("Couldn't copy it. Try again"));
  }, () => toast("Couldn't get your location. Check that location is on for this app"), { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 });
}

// ---- MORE, SETTINGS, PRO
const atProOffered = () => !STORE_MODE && switchOn("AUTO_PASS");
function atMore(c) {
  const go = (ic, l, attrs, sub) => `<button ${attrs}>${AI[ic]}<span>${esc(l)}</span>${sub ? `<small>${esc(sub)}</small>` : ""}</button>`;
  const groups = [
    ["My Car", [go("doc", "Papers", atCarGo(c, "papers")), go("box", "Extras", atCarGo(c, "extras")), go("camera", "Photos", atCarGo(c, "photos")), go("triangle", "Recalls", atCarGo(c, "recalls")), go("info", "Car Facts", 'data-atgo="facts"'), go("tire", "Tires & Battery", 'data-atgo="tires"'), go("shield", "Warranty", 'data-atgo="warranty"'), go("car", "All Cars", 'data-atgo="allcars"')]],
    ["Maintenance", [go("cal", "Calendar", 'data-atgo="cal"'), go("bell", "Reminders", 'data-atgo="reminders"'), go("heart", "Health History", 'data-atgo="health"')]],
    ["Money", [go("coin", "What It Costs Me", 'data-atgo="costing"'), go("trend", "Expenses", 'data-atgo="expenses"'), go("bill", "Cost to Own", `data-atcar="${esc(c.id)}" data-atsegto="overview:cost"`), go("tag", "Value", `data-atcar="${esc(c.id)}" data-atsegto="overview:value"`), go("compare", "Compare Cars", 'data-atgo="compare"'), go("send", "Sell My Car", 'data-atgo="sell"'), go("archive", "Sold Cars", 'data-atgo="archive"')]],
    ["Trips", [go("road", "Road Trip", `data-atcar="${esc(c.id)}" data-atsubto="fuel:trip"`), go("check", "Before You Go", `data-atcar="${esc(c.id)}" data-atsubto="fuel:check"`), go("fuel", "Fuel Analytics", 'data-atgo="fuelstats"')]],
    ["Help", [go("chip", "AI Mechanic", atCarGo(c, "mech")), go("sparkle", "Ask Auto Hub", 'data-ask="open"'), go("triangle", "Roadside Help", 'data-atgo="roadside"')]],
    ["Records", [go("glove", "My Glovebox", 'data-atgo="glovebox"'), go("doc", "Records Package", 'data-atgo="records"'), go("upload", "Import & Export", 'data-atgo="impex"'), go("cloud", "Data & Backup", 'data-atgo="data"')]],
    ["My Day", [go("sun", "Morning Brief", 'data-brief="open"'), go("cloud", "Weather", 'data-atgo="card:weather"'), go("bill", "Bills", 'data-atgo="card:bills"'), go("check", "To-Do", 'data-atgo="card:todos"'), go("list", "Lists", 'data-atgo="card:lists"'), go("gauge", "Life Pulse", 'data-pulse="1"')]],
    ["This App", [go("gear", "Settings", 'data-atgo="settings"'), go("people", "Other Hub Apps", 'data-atgo="card:family"'), typeof hcShow === "function" && go("send", "Hub Connections", 'data-hcopen="1"'), atProOffered() && go("crown", PLAN.AUTO_NAME, 'data-atgo="pro"'), go("palette", "Classic Look", 'data-atgo="classic"', "the old screen")].filter(Boolean)]];
  return `<h2 class="at-head root"><span class="at-headic">${AI.dots}</span><span class="grow">More</span></h2>${groups.map(([h, T]) => `<p class="at-seclabel">${esc(h)}</p><div class="at-tiles">${T.join("")}</div>`).join("")}`;
}
function atSettings() {
  const R = [["person", "Profile", "Your first name", 'data-atset="setName"'], ["pin", "City or ZIP", S.city || "For the weather", 'data-atset="setCity"'], 
    ["bell", "Reminders", "Your car, bills and your day", 'data-atgo="reminders"'], ["sparkle", "AI Helper", "Smart Scan, AI Mechanic, Ask", 'data-atset="aiBox"'], ["cloud", "Backup", S.sync && S.sync.on ? (syncOk("sync") ? "On: your own Google Drive" : "Paused") : "Sync to your own Google Drive", 'data-atset="syncBox"'],
    ["download", "Data & Backup", "Download, spreadsheet, load a file, erase", 'data-atgo="data"'], ["car", "Install", "Put it on your home screen", 'data-atset="installBox"']];
  return atHead("Settings", "gear") + `<section class="at-list"><button class="at-row at-togglerow" data-atphoto="1" role="switch" aria-checked="${S.photo !== false}"><span class="at-ric">${AI.palette}</span><span class="grow"><b>Pictures</b><small>The art behind your screens</small></span><i class="at-switch ${S.photo !== false ? "on" : ""}" aria-hidden="true"></i></button>${R.map(([ic, l, s, a]) => atRow(ic, l, s, a)).join("")}
    <a class="at-row" href="${esc(new URL("privacy.html", HOME_URL).href)}" target="_blank" rel="noopener"><span class="at-ric">${AI.shield}</span><span class="grow"><b>Privacy</b><small>How your data is used</small></span>${AI.chev}</a>
    <a class="at-row" href="${esc(new URL("terms.html", BASE_URL).href)}" target="_blank" rel="noopener"><span class="at-ric">${AI.doc}</span><span class="grow"><b>Terms</b><small>Terms of use</small></span>${AI.chev}</a>
    ${atRow("people", "Other Hub Apps", "Your other Marvel Corp apps", 'data-atgo="card:family"')}${atProOffered() ? atRow("crown", PLAN.AUTO_NAME, autoPro() ? "On for this phone" : "Every car, plus backup", 'data-atgo="pro"') : ""}${atRow("gear", "More Settings", "Google Calendar, cards, everything else", 'data-atset="settingsTop"')}${atRow("palette", "Classic Look", "The old screen", 'data-atgo="classic"')}</section>`;
}
function atPro() {                  // AUTO HUB PRO (his board). Only what Pro really includes, at the price it already has. Never in the Play app.
  if (!atProOffered()) return atSettings();
  const c = atHero(), B = [["car", "Unlimited Cars", "Track every vehicle you own."], ["cloud", "Google Drive Backup & Sync", "Keep your data safe in your own Drive and sync it across your phones."], ["history", "Google Calendar Sync", "Bills and your day on your phone's calendar."]];
  return `<div class="at-bandpage">${atBandHead(atBodyArt(c), PLAN.AUTO_NAME)}<p class="at-note">${autoPro() ? "You're on Pro on this phone." : "Everything for your first two cars stays free."}</p>
    <section class="at-list">${B.map(([ic, l, s]) => `<div class="at-svc"><span class="at-ric">${AI[ic]}</span><span class="grow"><b>${esc(l)}</b><small>${esc(s)}</small></span></div>`).join("")}</section>
    <p class="at-note">Smart Scan, the AI Mechanic and Ask come with Day Hub Pro or Hub AI Credits, not with ${esc(PLAN.AUTO_NAME)}.</p>
    ${autoPro() ? "" : PLAN.AUTO_CHECKOUT_URL ? `<a class="at-big" href="${esc(PLAN.AUTO_CHECKOUT_URL)}" target="_blank" rel="noopener">${AI.crown}Start 30 Days Free</a><p class="at-note center">${esc(PLAN.AUTO_MONTHLY)} after that. Cancel any time.</p>` : ""}
    <button class="at-ghost" data-atset="proBox">${autoPro() ? "Manage on This Phone" : "Already Bought? Enter Your Email"}</button></div>`;
}

// ---- the screen for this moment. Called by shell.js shellHtml() while the new look is on.
let AT_CARD = null;
function atCarScreen(c) {
  const T = { service: atService, fuel: atFuel, papers: atPapers, extras: atExtras, photos: atPhotos, mech: atMech, recalls: atRecalls, journal: atJournal };
  return (T[AUTO_TAB] || atOverview)(c);
}
function atPage(p, c) {
  if (p === "log") return atLog(c); if (p === "miles") return atMiles(c); if (p === "roadside") return atRoadside(c); if (p === "settings") return atSettings(); if (p === "pro") return atPro();
  if (p === "cars") return atCars(); if (p === "addcar") return atAddCar(); if (p === "details") return atDetails(c); if (p === "forsale") return atForSale(c); if (p === "scanreview" && AUTO_SCAN) return atScanReview();
  if (p === "upcoming") return atHead("Upcoming", "clip") + `<section class="at-card">${atUpcoming(garage().cars, 0)}</section>`;
  if (p.startsWith("rs:")) return atHelpPage(c, p.slice(3));
  if (p.startsWith("card:") && AT_CARD) { const k = p.slice(5); let body = ""; try { body = AT_CARD(k); } catch (e) { body = ""; }
    return atHead({ weather: "Weather", bills: "Bills", todos: "To-Do", lists: "Lists", family: "Other Hub Apps" }[k] || titleCase(k), null) + (body || `<p class="at-note">Nothing here on Auto Hub yet.</p>`); }
  const h2 = typeof atPage2 === "function" ? atPage2(p, c) : null; if (h2 != null) return h2;
  AT.page = null; return null;
}
// A redraw from outside (coming back to the app, the weather landing, the phone going offline) rewrites the screen, and the boxes with it.
// What's been typed goes back in the new boxes. A form that just saved is left alone, so it shows what's stored.
let AT_SAVED_FORM = "", AT_STRICT = false;
const atFormSig = f => f ? Object.entries(f.dataset).filter(([k]) => k !== "by").map(([k, v]) => `${k}=${v}`).sort().join("&") : "";
function atFieldKey(el) { const n = el.name || el.id || (el.dataset.atsearch ? "search" : el.dataset.atlabel ? `label:${el.dataset.atlabel}` : ""); return n ? `${atFormSig(el.form)}|${n}` : ""; }
function atSnapshotFields() {
  const out = [], root = document.getElementById("cards"), active = document.activeElement, saved = AT_SAVED_FORM; AT_SAVED_FORM = "";
  if (!root) return out;
  root.querySelectorAll("input, select, textarea").forEach(el => {
    if (el.type === "file" || el.type === "hidden") return;
    const key = atFieldKey(el); if (!key || (saved && el.form && atFormSig(el.form) === saved && !AUTO_MSG)) return;
    const box = el.type === "checkbox" || el.type === "radio";
    const changed = box ? el.checked !== el.defaultChecked : el.tagName === "SELECT" ? el.value !== ([...el.options].find(o => o.defaultSelected) || el.options[0] || {}).value : el.value !== el.defaultValue;
    if (changed || el === active) out.push({ key, box, val: box ? el.checked : el.value, focus: el === active });
  });
  return out;
}
function atRefill(snap) {
  document.querySelectorAll("#cards input, #cards select, #cards textarea").forEach(el => {
    if (el.type === "file" || el.type === "hidden") return;
    const s = snap.find(x => x.key === atFieldKey(el)); if (!s) return;
    if (s.box) el.checked = s.val; else el.value = s.val;
    if (s.focus) { try { el.focus({ preventScroll: true }); } catch (e) { /* the value is what matters */ } }
  });
  const q = document.querySelector("#cards [data-atsearch]"); if (q && q.value) q.dispatchEvent(new Event("input", { bubbles: true }));
}
function atShellHtml(cardHtml) {
  const snap = atSnapshotFields(); if (snap.length) queueMicrotask(() => atRefill(snap));
  try { return atDraw(cardHtml); }
  catch (err) {                          // old or hand-edited data this screen can't read: say so, keep the tabs, never a blank app
    if (AT_STRICT) { AT_STRICT = false; throw err; }                       // except during a restore: its "draw BEFORE saving" check has to see this, or a bad file replaces good records
    console.error("Auto Hub screen", err);
    AT.stack.length && atBack();
    return `<div class="at-screen"><section class="at-card"><b>This screen couldn't read something in your records.</b><p class="at-note">Your records are safe. Try another tab, or the old screen.</p><button class="at-ghost" data-atgo="classic">Classic Look</button></section></div>`;
  }
}
function atDraw(cardHtml) {
  AT_CARD = cardHtml; atPreloadArt(); atSyncHistory();
  const cars = garage().cars;
  document.body.classList.toggle("at-noart", S.photo === false);
  document.body.dataset.atscreen = !cars.length ? "first" : AT.page || (AT.car ? AUTO_TAB : TAB);
  setTimeout(atFillPhotos, 0);
  if (AT.page && /^(archive$|soldview:|soldhist:)/.test(AT.page)) { AUTO_OPEN = null; return `<div class="at-screen">${atSoldPage(AT.page)}</div>`; }
  if (!cars.length) { if (AT.page === "addcar") AT.page = null; AT.car = null; return atFirstOpen(); }
  if (AT.car && !carById(AT.car)) atReset();
  const c = (AT.car && carById(AT.car)) || atHero();
  AUTO_OPEN = AT.car || AT.page ? c.id : null;                             // what auto.js's handlers act on; Home and the tabs have no open car
  if (AT.page) { const h = atPage(AT.page, c); if (h != null) return `<div class="at-screen">${h}</div>`; }
  if (AT.car) return `<div class="at-screen">${atCarScreen(c)}</div>`;
  if (TAB === "garage") return `<div class="at-screen">${atGarage()}</div>`;
  if (TAB === "journal") { AUTO_OPEN = c.id; AUTO_TAB = "journal"; return `<div class="at-screen">${atJournal(c, true)}</div>`; }
  if (TAB === "scan") return `<div class="at-screen">${atScan(c)}</div>`;
  if (TAB === "more") return `<div class="at-screen">${atMore(c)}</div>`;
  return atHome();
}
function atFillPhotos() { document.querySelectorAll("#cards img[data-aphoto]").forEach(img => photoGet(img.dataset.aphoto).then(d => { if (d) img.src = d; }).catch(() => {})); }

// ---- the old screens' drawing goes through here while the new look is on, so auto.js's handlers keep working unchanged
const AT_OLD = { showCar, hideAutoSheet, showAddCar, showScan, fillPhotos };
const AT_RESTORE = restoreFrom;
restoreFrom = function (...args) { if (!atOn()) return AT_RESTORE(...args); AT_STRICT = true; try { return AT_RESTORE(...args); } finally { AT_STRICT = false; } };
const AT_FORM_PAGES = ["miles", "details", "addcar", "scanreview"];   // a page that's finished with once its form saves; the back arrow never returns to it
showCar = function (id, tab) {
  if (!atOn()) return AT_OLD.showCar(id, tab);
  if (!carById(id)) return;
  AT.form = null; AT.milesOk = null; AUTO_OPEN = id;
  const formPage = AT_FORM_PAGES.includes(AT.page);
  if (!tab && formPage) { atBack(); render(); window.scrollTo({ top: 0 }); return; }   // Update Miles or Car Details saved: back where you came from
  if (!tab && AT.page) { render(); return; }                                          // a recall check finishing while you're on another page: stay there
  const inJournalTab = TAB === "journal" && !AT.page && !AT.car && (tab || AUTO_TAB) === "journal", same = AT.car === id && !AT.page && (!tab || tab === AUTO_TAB);
  if (!same && !inJournalTab && !formPage) atPush();
  if (tab && tab !== AUTO_TAB) AT.sub = null;
  if (tab) AUTO_TAB = tab;
  if (!inJournalTab) { AT.page = null; AT.car = id; }
  render(); if (!same || AUTO_VIEW) window.scrollTo({ top: 0 });
};
hideAutoSheet = function () { if (!atOn()) return AT_OLD.hideAutoSheet(); atReset(); AUTO_SCAN = null; };
showAddCar = function () { if (!atOn()) return AT_OLD.showAddCar(); atPush(); AUTO_OPEN = null; AT.page = "addcar"; AT.add = "vin"; render(); window.scrollTo({ top: 0 }); };
showScan = function () { if (!atOn()) return AT_OLD.showScan(); if (AT.page !== "scanreview") atPush(); AT.page = "scanreview"; AUTO_OPEN = null; render(); window.scrollTo({ top: 0 }); };
fillPhotos = function () { if (!atOn()) return AT_OLD.fillPhotos(); atFillPhotos(); };

// ---- taps that belong to the new look only (this runs before ui.js's listener, which handles the rest)
function atGo(go) {
  if (go === "back") { atBack(); render(); window.scrollTo({ top: 0 }); return; }
  if (go === "classic") { try { localStorage.setItem(AT_KEY, "classic"); } catch (e) { /* private mode */ } atReset(); TAB = "home"; render(); window.scrollTo({ top: 0 }); toast("Classic look on this phone"); return; }
  atPush(); AT.page = go; AT.form = null; const c = atHero(); if (c) AUTO_OPEN = c.id;
  AUTO_MSG = ""; render(); window.scrollTo({ top: 0 });
}
function atLogGo(k) {
  const c = (AT.car && carById(AT.car)) || atHero(); if (!c) return;
  if (k === "miles") { atGo("miles"); return; }
  if (k === "journal" && TAB === "journal" && !AT.page) { AT.form = "journal"; render(); return; }
  AT.formKind = null; showCar(c.id, k); if (["fuel", "service", "papers", "journal"].includes(k)) { AT.form = k; if (k === "service") AT.seg.service = "services"; AT.sub = null; render(); const f = document.querySelector("#cards form.at-form"); if (f) f.scrollIntoView({ block: "center" }); }
}
document.addEventListener("click", e => {
  if (!e.target.closest || typeof MODE === "undefined" || MODE !== "auto") return;
  // five quick taps on the app's name in Settings flip the look, whatever browser this copy lives in
  const nm = e.target.closest("#sheet p.fine > b");
  if (nm && /Marvel Corp app/.test(nm.textContent) && atOwnerish()) { const now = Date.now(); AT_NAME_TAPS = AT_NAME_TAPS.filter(x => now - x < 3000).concat(now);
    if (AT_NAME_TAPS.length >= 5) { AT_NAME_TAPS = []; const on = !atOn(); try { localStorage.setItem(AT_KEY, on ? "tiles" : "classic"); localStorage.setItem("autohub.ownerlook", "1"); } catch (e2) { /* private mode */ } atReset(); TAB = "home"; closeSettings(); render(); window.scrollTo({ top: 0 }); toast(on ? "New look on for this phone" : "Classic look on this phone"); }
    return; }
  if (!atOn()) return;
  if (e.target.closest("#tabbar button[data-shellgo], .at-quick button[data-shellgo]")) { atReset(); return; }      // ui.js then changes the tab
  const b = e.target.closest("button, a"); if (!b || !b.dataset) return; const ds = b.dataset;
  if (ds.aherocar && AT.car) { AT.car = ds.aherocar; AT.form = null; return; }    // the car chips on a car's own screen; auto.js then redraws
  if (ds.pulsego) { e.stopImmediatePropagation(); const ps = document.getElementById("pulseSheet"); if (ps) ps.classList.add("hidden"); atGo(`card:${ds.pulsego}`); return; }
  if (ds.atsheet) { const c = carById(ds.atsheet); if (!c) return; const box = document.getElementById("aVinShare"); shareText(atFullName(c), buildSheet({ ...c, nick: "" }, !!(box && box.checked)), "Build sheet copied"); return; }
  if (ds.atphoto) { S.photo = S.photo === false ? undefined : false; save(); render(); return; }
  if (ds.atgo) { atGo(ds.atgo); return; }
  if (ds.atlog) { atLogGo(ds.atlog); return; }
  if (ds.atlogkind) { atLogGo("service"); AT.formKind = ds.atlogkind; render(); const f = document.querySelector("#cards form.at-form"); if (f) f.scrollIntoView({ block: "center" }); return; }
  if (ds.atsell) { showCar(ds.atsell, "overview"); AT.seg.overview = "value"; render(); return; }
  if (ds.atseg) { const [t, v] = ds.atseg.split(":"); if (ds.atback) { atBack(); } AT.seg[t] = v; AT.form = null; AUTO_MSG = ""; render(); window.scrollTo({ top: 0 }); return; }
  if (ds.atsegto) { const [t, v] = ds.atsegto.split(":"); showCar(ds.atcar, t); AT.seg[t] = v; render(); return; }
  if (ds.atsubto) { const [t, v] = ds.atsubto.split(":"); showCar(ds.atcar, t); AT.sub = v; render(); window.scrollTo({ top: 0 }); return; }
  if (ds.atsub !== undefined) { if (ds.atsub) { atPush(); AT.sub = ds.atsub; } else atBack(); AUTO_MSG = ""; render(); window.scrollTo({ top: 0 }); return; }
  if (ds.atform !== undefined) { AT.form = ds.atform || null; AUTO_MSG = ""; render(); if (AT.form) { const f = document.querySelector("#cards form.at-form"); if (f) f.scrollIntoView({ block: "center" }); } return; }
  if (ds.atadd) { AT.add = ds.atadd; const f = b.closest("form"); if (f) { f.dataset.by = ds.atadd; f.querySelectorAll("[data-atadd]").forEach(x => x.classList.toggle("on", x === b)); } return; }
  if (ds.attag) { AT.tag = ds.attag; render(); return; }
  if (ds.atjtag) { AT.jtag = ds.atjtag; render(); return; }
  if (ds.atpaper) { AT.papersOpen = AT.papersOpen === ds.atpaper ? null : ds.atpaper; render(); return; }
  if (ds.attick) { AT.ticks[ds.attick] = !AT.ticks[ds.attick]; render(); return; }
  if (ds.atlocation) { atShareLocation(); return; }
  if (ds.atset) { const id = ds.atset; openSettings(); setTimeout(() => { const el = document.getElementById(id); if (el) { el.scrollIntoView({ behavior: "smooth", block: "center" }); if (el.focus && /^set/.test(id)) el.focus(); } }, 60); return; }
  if (ds.atcard) { const c = carById(ds.atcard); if (c) shareCard({ ...c, nick: "" }).catch(() => toast("Couldn't make the picture. Try again")); return; }
  if (ds.atlist) { const c = carById(ds.atlist); if (!c) return; const box = document.getElementById("aVinShare"); shareText(atFullName(c), listingText({ ...c, nick: "" }, !!(box && box.checked)), "Listing copied. Paste it into Marketplace, Craigslist or a car club"); return; }
  if (ds.atchecklog) { const c = carById(ds.atchecklog); if (!c) return; const L = tripChecks(c, today()); c.notes.push({ id: uid(), date: today(), text: `Before you go: ${L.filter(x => x.ok).length} of ${L.length} checked`.slice(0, 200) }); save(); toast("Saved to the journal"); }
});
let AT_NAME_TAPS = [], AT_SCAN_N = 0, AT_PICKING = null;
// A photo coming back from the camera or gallery. Coming back to the app redraws the screen, and a file box taken off the page can't tell anyone its photo arrived.
// So when one lands off the page, its old screen goes back in the document, out of sight, and says so again; the photo is never lost.
function atPickerLanded(inp) {
  if (inp.isConnected) return;
  let root = inp; while (root.parentNode) root = root.parentNode;
  let hold = document.getElementById("atHold");
  if (!hold) { hold = document.createElement("div"); hold.id = "atHold"; hold.hidden = true; document.body.appendChild(hold); }
  hold.appendChild(root); inp.dispatchEvent(new Event("change", { bubbles: true })); setTimeout(() => root.remove(), 20000);
  if (inp.dataset.amechpic) setTimeout(() => { if (atOn()) render(); }, 1500);
  if (inp.dataset.avinscan) { const old = root.querySelector("[name=vin]"); let n = 0; const iv = setInterval(() => { const live = document.querySelector("#cards form [name=vin]");
    if (old && live && old.value && old.value !== live.value) { live.value = old.value; clearInterval(iv); } if (++n > 60) clearInterval(iv); }, 250); }
}
document.addEventListener("click", e => {
  const t = e.target; if (!t || t.tagName !== "INPUT" || t.type !== "file" || !t.closest("#cards") || typeof MODE === "undefined" || MODE !== "auto" || !atOn()) return;
  AT_PICKING = t; t.addEventListener("change", () => { AT_PICKING = null; atPickerLanded(t); }, { once: true });
}, true);
document.addEventListener("change", e => { const t = e.target; if (t && t.dataset && t.dataset.aphotoadd && t.form) AT_SAVED_FORM = atFormSig(t.form); }, true);
// The phone's own back button walks the same path as the arrow on screen: each screen opened is one step of history, and only the top of a tab leaves the app.
let AT_DEPTH = 0, AT_SKIP = 0;
function atSyncHistory() {
  if (AT_SKIP) return;                    // steps being taken away: their popstate runs this again
  const want = AT.stack.length + (TAB !== "home" ? 1 : 0) + (document.querySelector(".sheet:not(.hidden)") ? 1 : 0);   // a plain tab's back goes to Home; only Home leaves the app
  try {
    while (AT_DEPTH < want) history.pushState({ at: ++AT_DEPTH }, "");
    if (AT_DEPTH > want) { AT_SKIP++; setTimeout(() => { AT_SKIP = 0; }, 1500); history.go(want - AT_DEPTH); AT_DEPTH = want; }
  } catch (e) { AT_DEPTH = want; /* some browsers limit this; the arrow still works */ }
}
document.addEventListener("click", () => { if (typeof MODE !== "undefined" && MODE === "auto" && atOn()) setTimeout(atSyncHistory, 0); });   // a sheet opened or closed by this tap
window.addEventListener("popstate", () => {
  if (AT_SKIP) { AT_SKIP--; if (typeof MODE !== "undefined" && MODE === "auto" && atOn()) atSyncHistory(); return; }
  if (typeof MODE === "undefined" || MODE !== "auto" || !atOn()) return;
  AT_DEPTH = Math.max(0, AT_DEPTH - 1);
  const open = [...document.querySelectorAll(".sheet:not(.hidden)")];
  if (open.length) {                      // a sheet over the screen closes first, and the screen's own step stays
    open.forEach(el => { if (el.id === "sheet") closeSettings(); else el.classList.add("hidden"); });
    atSyncHistory();
    return;
  }
  if (AT.stack.length) { atBack(); render(); window.scrollTo({ top: 0 }); }
  else if (TAB !== "home") { atReset(); shellGo("home"); }
  else if (history.state && history.state.at) history.back();                 // steps left over from before a reload: keep walking out
});
// Road trip's From and To are only labels for this trip, typed on this phone.
document.addEventListener("input", e => { const k = e.target && e.target.dataset && e.target.dataset.atlabel; if (k && atOn()) AT[k] = String(e.target.value).slice(0, 60); });
// The odometer check (his list: "no odometer check"), and Roadside Help's saved numbers. Before ui.js's own submit handler.
document.addEventListener("submit", e => {
  if (typeof MODE === "undefined" || MODE !== "auto" || !atOn()) return;
  const f = e.target; if (!f || !f.dataset) return;
  AT_SAVED_FORM = atFormSig(f);
  if (f.dataset.athelp) { e.preventDefault(); e.stopImmediatePropagation(); const [id, key] = f.dataset.athelp.split(":"), c = carById(id); if (!c) return;
    const raw = atPlainNum(new FormData(f).get("num"), 30), digits = atTel(raw).replace(/\D/g, "");
    if (raw && digits.length < 3) { AUTO_MSG = "That doesn't look like a phone number."; autoMsgShow(); return; }
    atHelp(c)[key] = raw; AUTO_MSG = ""; save(); render(); toast(raw ? "Number saved on this phone" : "Number removed"); return; }
  const fd = new FormData(f), scanKind = f.dataset.ascansave ? fd.get("kind") : "";
  const id = f.dataset.amiles || f.dataset.afuel || f.dataset.aservice || (["receipt", "fuel", "odometer"].includes(scanKind) ? fd.get("car") : ""); if (!id) return;
  const c = carById(id), val = toMiles(fd.get("miles")); if (!c || val == null) return;
  const warn = atMilesWarn(c, val, !!f.dataset.aservice || scanKind === "receipt");   // a past service or receipt can be lower; it never moves the miles down
  if (warn && AT.milesOk !== val) { e.preventDefault(); e.stopImmediatePropagation(); AT.milesOk = val; AUTO_MSG = `${warn} Tap again to save it anyway.`; autoMsgShow(); }
  else AUTO_MSG = "";
}, true);
