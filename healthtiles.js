/* SAVE AS: healthtiles.js · LOCATION: C:/MarvelApps/dayhub/healthtiles.js
 * HEALTH HUB NEW LOOK - "Green and Gold Wellness" (Scott 11/06: his own ChatGPT board; 11/07 "cont ... all updates and everything right at
 * end of day"). Mountains at golden sunset: deep forest green and warm gold, glossy tiles with white line icons, a painted picture across the
 * top of every inner screen (../healthhub/art/, made on OpenArt for this look: no text, labels, medical symbols, faces or real places).
 *   HOME  = the leaf logo, Ask and the gear, Today's Health (the Health Score from today's routines, steps, doses, sleep, water), the top
 *           band's must-see notices, his 12 tiles in his order, then one scroll down: what needs you, quick logs, the next visit, Show my
 *           health info, and the to-do and list cards as before.
 *   TABS  = Home | Visits | Vitals | Goals | More (his board). Visits, Vitals and Goals open their pages; More lists every page, grouped.
 *   PAGES = every Health Hub page (health.js, its own panes, forms and buttons) as a full screen: a back arrow, a big title, a picture across
 *           the top, no tab bar (his board). The page sheet is dressed after it is drawn; nothing inside it changes.
 * Everything opens what Health Hub already has. Nothing new is stored; nothing is worked out a new way. Where his board draws something
 * Health Hub doesn't have, the tile opens the nearest real page: Nutrition -> Water, Challenges -> Emergency card (Challenges are switched
 * off), "How you're doing 7.8/10" -> the Health Score from routines (not a medical measure), calories -> doses taken.
 * SWITCH: HW_ON = false - customers keep the classic look and fetch none of the art. A phone gets it with ?look=tiles (kept in healthhub.look),
 * by holding Scott Hub or the owner's OK (once), or with five quick taps on the app's name at the bottom of Settings (only a phone that already
 * picked a look or holds one of those keys). More -> Classic Look turns it back. Health Hub only, and only once it is set up.
 * Loaded by ../healthhub/index.html after health.js, before ui.js (+ healthtiles.css). Wraps paintHero, hhDashHtml, hhNavHtml and showHh; each
 * runs exactly as before while the look is off. Health words: records, reminders and notes - never a diagnosis, treatment or dose.
 * DEPLOY ORDER: push dayhub first and let Pages publish, then healthhub (its page, its worker and the art).
 */
"use strict";

const HW_ON = false;                 // THE SWITCH: true = everyone on Health Hub gets the new look (Scott's go only)
const HW_KEY = "healthhub.look";
(function hwFromLink() {             // ?look=tiles|classic sets this phone's look, then leaves the address as it was
  try {
    const u = new URL(location.href), v = u.searchParams.get("look");
    if (v !== "tiles" && v !== "classic") return;
    localStorage.setItem(HW_KEY, v); u.searchParams.delete("look");
    history.replaceState(null, "", u.pathname + (u.search || "") + u.hash);
  } catch (e) { /* private mode: the link just doesn't stick */ }
})();
const hwPick = () => { try { return localStorage.getItem(HW_KEY); } catch (e) { return null; } };
// A phone that may flip the look by five taps (as the other looks): it already picked a look, or it holds Scott Hub or the owner's OK.
const hwOwnerish = () => { try { return !!hwPick() || !!localStorage.getItem("scotthub.k") || localStorage.getItem("dayhub.ownerok") === "1"; } catch (e) { return false; } };
let HW_OWNER_CHECKED = false;
function hwOwnerOnce() {             // the owner's phone turns it on by itself, once; after that Classic Look sticks. Customers have neither key.
  if (HW_OWNER_CHECKED) return; HW_OWNER_CHECKED = true;
  try {
    if (localStorage.getItem("healthhub.ownerlook") || !(localStorage.getItem("scotthub.k") || localStorage.getItem("dayhub.ownerok") === "1")) return;
    localStorage.setItem("healthhub.ownerlook", "1"); localStorage.setItem(HW_KEY, "tiles");
  } catch (e) { /* private mode */ }
}
function hwOn() {
  if (typeof MODE === "undefined" || MODE !== "health") return false;
  if (typeof hhSet !== "function" || !hhSet()) return false;              // the welcome stays the classic screen
  hwOwnerOnce();
  return HW_ON ? hwPick() !== "classic" : hwPick() === "tiles";
}
let HW_TAB = "home";                 // home | more (the tab bar's own views); Visits, Vitals and Goals open their pages

// ------------------------------------------------------------ white line icons (his board's tiles), drawn here: no image files
const WI = {
  heart: '<path d="M12 20s-7.5-4.6-7.5-10.2A4.2 4.2 0 0 1 12 7.2a4.2 4.2 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z"/><path d="M5 12.5h3.2l1.6-3 2.4 5.5 1.6-2.5H19"/>',
  cal: '<rect x="4" y="5" width="16" height="15" rx="2.5"/><path d="M8 3v4M16 3v4M4 10h16"/><path d="M8 14h2M12 14h2M8 17h2"/>',
  pill: '<rect x="2.8" y="8.6" width="18.4" height="6.8" rx="3.4" transform="rotate(-35 12 12)"/><path d="M9.3 8.3l5.4 7.4"/>',
  bottle: '<rect x="6.5" y="8" width="11" height="12.5" rx="2.2"/><path d="M8 4h8v4H8z"/><path d="M9.5 12.5h5M9.5 15.5h5"/>',
  pulse: '<path d="M3 12h4l2.2-5.5 3.3 11 2.2-5.5H21"/>',
  drop: '<path d="M12 3.5s6 6.6 6 11a6 6 0 0 1-12 0c0-4.4 6-11 6-11z"/><path d="M9.5 15a2.5 2.5 0 0 0 2.5 2.5"/>',
  shoe: '<path d="M3 15.5h14.5a3.5 3.5 0 0 0 3.5-3.5v-.5l-5.5-1.2L12.5 7H8.8l-.8 3-5 1.2z"/><path d="M3 19h18"/><path d="M11 9.5l1.6 1.2M9.7 11.3l1.6 1.2"/>',
  moon: '<path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z"/><path d="M16 4.5l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6z"/>',
  scale: '<rect x="4" y="4" width="16" height="16" rx="3.5"/><path d="M8 10a5.6 5.6 0 0 1 8 0"/><path d="M12 10l1.6 2.2"/>',
  target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
  shield: '<path d="M12 3l7 3v5.2c0 4.7-3.2 8.3-7 9.8-3.8-1.5-7-5.1-7-9.8V6z"/><path d="M12 8.5v4.5M12 16v.4"/>',
  lotus: '<path d="M12 19.5c-4.2 0-7.5-2.6-8.5-6.5 3.2-.4 6.3 1 8.5 3.6 2.2-2.6 5.3-4 8.5-3.6-1 3.9-4.3 6.5-8.5 6.5z"/><path d="M12 16.5c-2-2.4-2.4-5.6 0-10 2.4 4.4 2 7.6 0 10z"/>',
  home: '<path d="M4 11 12 4l8 7"/><path d="M6 10v10h12V10"/><path d="M10 20v-5h4v5"/>',
  apple: '<path d="M12 7.5c-1.6-1.2-5.5-1.3-6.6 2.4-1 3.5 1.3 9.6 4.2 9.6 1 0 1.5-.6 2.4-.6s1.4.6 2.4.6c2.9 0 5.2-6.1 4.2-9.6C17.5 6.2 13.6 6.3 12 7.5z"/><path d="M12 7.5c0-2 1-3.4 2.8-4"/>',
  more: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.6"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.6"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.6"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.6"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
  spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 15.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>',
  folder: '<path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2.5h7a2 2 0 0 1 2 2v7.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/>',
  clip: '<rect x="5" y="4.5" width="14" height="16.5" rx="2.5"/><path d="M9 4.5h6v3H9z"/><path d="M8.5 12h7M8.5 15.5h5"/>',
  smile: '<circle cx="12" cy="12" r="8.5"/><path d="M8.5 14a4.5 4.5 0 0 0 7 0"/><path d="M9 9.8v.4M15 9.8v.4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', palette: '<path d="M12 3a9 9 0 0 0 0 18c1.3 0 2-.8 2-1.8 0-1.4-1.2-1.6-1.2-2.8 0-1 .8-1.6 1.8-1.6H17a4 4 0 0 0 4-4C21 6.6 17 3 12 3z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7" r="1"/><circle cx="14.5" cy="7" r="1"/>',
  trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4"/><path d="M12 13v4M8.5 20h7M10 17h4v3h-4z"/>',
  sos: '<rect x="3.5" y="5" width="17" height="14" rx="3"/><path d="M8 12h8M12 8v8"/>',
};
const wi = (k, cls = "hw-ic") => `<span class="${cls}" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${WI[k] || WI.more}</svg></span>`;
// his logo: two green leaves with a gold edge
const HW_LOGO = `<svg viewBox="0 0 52 44" aria-hidden="true"><defs><linearGradient id="hwg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9be36a"/><stop offset=".6" stop-color="#3f9a3c"/><stop offset="1" stop-color="#1f5e2a"/></linearGradient></defs>
  <path d="M25 40C10 39 3 27 6 8c13 1 22 9 19 32z" fill="url(#hwg)" stroke="#d9b45a" stroke-width="1.6"/><path d="M27 40c15-1 22-13 19-32-13 1-22 9-19 32z" fill="url(#hwg)" stroke="#d9b45a" stroke-width="1.6"/>
  <path d="M24 37C19 27 14 19 9 12M28 37c5-10 10-18 15-25" stroke="#e9f7c8" stroke-width="1.4" fill="none" stroke-linecap="round"/></svg>`;

// ------------------------------------------------------------ HOME: Today's Health, the notices, the 12 tiles
const HW_TILES = [["score", "heart", "My Health", "t-my", ""], ["appts", "cal", "Visits", "t-vis", ""], ["meds", "pill", "Medications", "t-med", ""],
  ["meds", "bottle", "Refills", "t-ref", ""], ["vitals", "pulse", "Vitals", "t-vit", ' data-hhvk="bp"'], ["water", "drop", "Water", "t-wat", ""],
  ["move", "shoe", "Activity", "t-act", ""], ["sleep", "moon", "Sleep", "t-slp", ""], ["vitals", "scale", "Weight", "t-wt", ' data-hhvk="weight"'],
  ["goals", "target", "Daily Goals", "t-goal", ""], ["card", "shield", "Emergency", "t-sos", ""], ["checkin", "lotus", "Wellness", "t-well", ""]];
// His board's icons: bold solid shapes in white with one accent colour, drawn here so they stay sharp and cost nothing to load (Scott 11/08: painted ones were "cheap and not appealing").
const WF_LINE = 'fill="none" stroke-linecap="round" stroke-linejoin="round"';
const WF = {
  heart: `<path fill="#fff" d="M12 21.2s-8-4.9-10.2-9.7C.2 8 2.3 4 6.3 3.7c2.4-.2 4.3 1 5.7 3 1.4-2 3.3-3.2 5.7-3 4 .3 6.1 4.3 4.5 7.8C20 16.3 12 21.2 12 21.2z"/><path ${WF_LINE} stroke="#c0392b" stroke-width="1.9" d="M5.2 11.6h3.2l1.7-3 3 5.6 1.7-2.6h4"/>`,
  cal: `<path fill="#fff" d="M9.2 2h5.6A1.2 1.2 0 0 1 16 3.2V4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2v-.8A1.2 1.2 0 0 1 9.2 2z"/><path ${WF_LINE} stroke="#1e8a43" stroke-width="1.9" d="M7.5 10.2l1.3 1.3 2.2-2.5M13.4 10.4h3.4M7.5 16l1.3 1.3 2.2-2.5M13.4 16.2h3.4"/>`,
  pill: `<g transform="rotate(-42 12 12)"><rect x="1.5" y="7.2" width="21" height="9.6" rx="4.8" fill="#fff"/><path fill="#ffd166" d="M12 7.2h5.7a4.8 4.8 0 0 1 0 9.6H12z"/></g>`,
  bottle: `<rect x="7" y="2" width="10" height="4.2" rx="1.2" fill="#ffd98a"/><path fill="#fff" d="M7.6 7.4h8.8A2.6 2.6 0 0 1 19 10v9.4a2.6 2.6 0 0 1-2.6 2.6H7.6A2.6 2.6 0 0 1 5 19.4V10a2.6 2.6 0 0 1 2.6-2.6z"/><path ${WF_LINE} stroke="#1e8a43" stroke-width="2.2" d="M12 11.4v6.4M8.8 14.6h6.4"/>`,
  pulse: `<rect x="3.5" y="13" width="4.6" height="8" rx="1.3" fill="#fff"/><rect x="9.7" y="8.5" width="4.6" height="12.5" rx="1.3" fill="#fff"/><rect x="15.9" y="3.5" width="4.6" height="17.5" rx="1.3" fill="#ffd98a"/>`,
  drop: `<path fill="#fff" d="M12 2.2s7.2 7.4 7.2 12.4a7.2 7.2 0 0 1-14.4 0C4.8 9.6 12 2.2 12 2.2z"/><path ${WF_LINE} stroke="#5fb4dc" stroke-width="2" d="M8.4 15a3.7 3.7 0 0 0 3.3 3.5"/>`,
  shoe: `<circle cx="14.6" cy="4.1" r="2.5" fill="#fff"/><path ${WF_LINE} stroke="#fff" stroke-width="3" d="M12.8 8.4 9.4 12l3.8 2.6-1.6 6M12.8 8.4l3 3.4 3.6.6M9.4 12l-3.8.6L4 15.6"/>`,
  moon: `<path ${WF_LINE} stroke="#fff" stroke-width="2.8" d="M3 6.5v13M3 16h18v3.5M21 16v-2.4a3.4 3.4 0 0 0-3.4-3.4h-7.2V16"/><circle cx="6.6" cy="12" r="2.2" fill="#fff"/><path fill="#ffd98a" d="M17.8 2.3a3.7 3.7 0 1 0 3.9 5.2 3.2 3.2 0 0 1-3.9-5.2z"/>`,
  scale: `<rect x="2.8" y="2.8" width="18.4" height="18.4" rx="5" fill="#fff"/><path fill="#cf9017" d="M12 5.4a6.6 6.6 0 0 1 5.6 3.1l-3.6 2.2a2.4 2.4 0 0 0-4 0L6.4 8.5A6.6 6.6 0 0 1 12 5.4z"/>`,
  target: `<circle cx="11.5" cy="12.5" r="9" fill="#fff"/><circle cx="11.5" cy="12.5" r="5.9" fill="#6d8c1c"/><circle cx="11.5" cy="12.5" r="3" fill="#fff"/><path ${WF_LINE} stroke="#ffd98a" stroke-width="2.2" d="M11.5 12.5 21 3"/>`,
  shield: `<path fill="#fff" d="M12 1.8 3.8 5v6.4c0 5.3 3.5 9.2 8.2 10.8 4.7-1.6 8.2-5.5 8.2-10.8V5z"/><path fill="#c0392b" d="M12 16.6s-4.6-2.9-4.6-6a2.5 2.5 0 0 1 4.6-1.3 2.5 2.5 0 0 1 4.6 1.3c0 3.1-4.6 6-4.6 6z"/>`,
  lotus: `<g fill="#fff"><path d="M12 3.2c2.7 2.5 3.9 5.4 3.9 8.1 0 3-1.6 5.7-3.9 7.5-2.3-1.8-3.9-4.5-3.9-7.5 0-2.7 1.2-5.6 3.9-8.1z"/><path opacity=".9" d="M4.6 7.4c2 .2 3.4 1 4.4 1.9-.5 1.2-.8 2.5-.8 3.8 0 1.9.6 3.7 1.5 5.2-3.5-.9-6-4-6-8.2 0-1 .3-1.9.9-2.7z"/><path opacity=".9" d="M19.4 7.4c-2 .2-3.4 1-4.4 1.9.5 1.2.8 2.5.8 3.8 0 1.9-.6 3.7-1.5 5.2 3.5-.9 6-4 6-8.2 0-1-.3-1.9-.9-2.7z"/></g><path fill="#ffd98a" d="M6 20.2h12a1 1 0 0 1 0 2H6a1 1 0 0 1 0-2z"/>`,
};
const hwTile = ([k, ic, label, cls, extra]) => `<button class="hw-tile ${cls}" data-hhtab="${k}"${extra}><span class="hw-ic" aria-hidden="true"><svg viewBox="0 0 24 24">${WF[ic] || ""}</svg></span><b>${esc(label)}</b></button>`;
function hwTop(title) {
  return `<div class="hw-top"><span class="hw-logo">${HW_LOGO}</span><b class="hw-brand">${esc(title || "Health Hub")}</b>${navigator.onLine === false ? `<span class="offline-pill hw-off">🟠 Offline</span>` : ""}
    <button class="hw-round" data-hhask="1" aria-label="Ask ${esc(APP_NAME)}">${wi("spark")}</button>
    <button class="hw-round" data-hwgo="settings" aria-label="Settings">${wi("gear")}</button></div>`;
}
// The hidden top band's must-see notices (new version, Install, Pro paused / ending, backup waiting, tap to sync), as the other looks do.
function hwNoticesHtml() {
  if (typeof heroHtml !== "function") return "";
  const was = CHIPS_ALL; CHIPS_ALL = true; let html = "";
  try { html = heroHtml(); } finally { CHIPS_ALL = was; }
  const box = document.createElement("template"); box.innerHTML = html;
  const keep = [...box.content.querySelectorAll(".chips > [data-update], .chips > [data-install], .chips > [data-prolapse], .chips > [data-cloudask], .chips > [data-sync], .chips > [data-syncall], .chips > [data-brief]")];
  return keep.length ? `<div class="hw-notices">${keep.map(c => c.outerHTML).join("")}</div>` : "";
}
function hwTodayHtml() {
  const t = today(), g = hhGoals(), D = hhDoses(t), S1 = hhScore(t), w = hhWater(t), st = hhSteps(t), sl = hhSleepOn(t);
  const tk = D.filter(d => d.st === "taken").length, prn = hhMeds().filter(m => !m.times.length).length;
  const row = (ic, big, small, tab) => `<button class="hw-trow" data-hhtab="${tab}">${wi(ic)}<span><b>${esc(big)}</b> <small>${esc(small)}</small></span></button>`;
  return `<section class="hw-today" aria-label="Today's Health"><h3>Today's Health</h3>
    <div class="hw-today-in"><button class="hw-score" data-hhtab="score">${wi("heart", "hw-heart")}<small>Today's routines</small>
        <b>${S1.score}<em>/100</em></b><i class="hw-bar"><i style="width:${Math.max(0, Math.min(100, S1.score))}%"></i></i><small>Health Score</small></button>
      <div class="hw-rows">${row("shoe", st ? st.toLocaleString("en-US") : "0", "steps", "move")}
        ${row("pill", D.length ? `${tk}/${D.length}` : prn ? "as needed" : "none", D.length ? "doses taken" : "medicines", "meds")}
        ${row("moon", sl ? hhFmtH(sl.hrs) : "–", "sleep", "sleep")}
        ${row("drop", `${w} of ${g.water}`, "glasses", "water")}</div></div>
  </section>`;
}
function hwBelowHtml() {                // one scroll down: what needs you, quick logs, the next visit, Show my health info
  const t = today(), N = hhNeeds(t), nx = hhNextAppt();
  return `<section class="hw-card hw-below">
      <h3 class="hw-h">Needs you</h3>
      ${N.length ? N.slice(0, 4).map(x => `<button class="hw-row${x.late ? " late" : ""}" data-hhtab="${esc(x.tab)}"${x.ap ? ` data-hhap="${esc(x.ap)}"` : ""}${x.vk ? ` data-hhvk="${esc(x.vk)}"` : ""}>
          <span class="hw-row-ic" aria-hidden="true">${x.icon}</span><span class="grow"><b>${esc(x.text)}</b><small>${esc(x.sub)}</small></span><span aria-hidden="true">›</span></button>`).join("")
        : `<p class="hw-hint">All caught up for now${S.name ? ", " + esc(S.name) : ""}.</p>`}
      <h3 class="hw-h">Quick log</h3>
      <div class="hw-acts">${[["hhwater", "1", "drop", "+1 glass"], ["hhtab", "meds", "pill", "Meds"], ["hhvk", "bp", "pulse", "Log BP"], ["hhtab", "add", "plus", "More"]]
        .map(([k, v, ic, l]) => `<button data-${k}="${v}"${k === "hhvk" ? ' data-hhtab="vitals"' : ""}>${wi(ic)}<span>${l}</span></button>`).join("")}</div>
      <h3 class="hw-h">Next visit</h3>
      ${nx ? `<button class="hw-row" data-hhtab="appts" data-hhap="${esc(nx.id)}"><span class="hw-row-ic" aria-hidden="true">🩺</span><span class="grow"><b>${esc(nx.doctor || "Appointment")}${nx.specialty ? ` · ${esc(nx.specialty)}` : ""}</b>
          <small>${esc(prettyDate(nx.date))}${nx.time ? " · " + esc(hm(nx.time)) : ""}</small></span><span aria-hidden="true">›</span></button>`
        : `<p class="hw-hint">No visits coming up. Add one and keep your questions ready.</p>`}
      <button class="hw-sos" data-hhsos="1">Show my health info</button>
      <p class="hw-fine">${esc(HH_ADV)} Everything here stays on this phone.</p>
    </section>`;
}
function hwHomeHtml() {
  return `<section class="hw-hero">${hwTop()}${hwTodayHtml()}${hwNoticesHtml()}</section>
    <nav class="hw-grid" aria-label="Health Hub">${HW_TILES.map(hwTile).join("")}</nav>${hwBelowHtml()}`;
}
function hwMoreHtml() {
  const row = ([ic, label, attrs, sub]) => `<button class="hw-mrow" ${attrs}>${wi(ic)}<span class="grow"><b>${esc(label)}</b>${sub ? `<small>${esc(sub)}</small>` : ""}</span><span aria-hidden="true">›</span></button>`;
  const grp = (title, rows) => `<section class="hw-card hw-more"><h3 class="hw-h">${title}</h3>${rows.map(row).join("")}</section>`;
  return `<div class="hw-bar-top">${hwTop("More")}</div>` +
    grp("Every day", [["pill", "Medications", 'data-hhtab="meds"', "doses, refills, scan a label"], ["drop", "Water", 'data-hhtab="water"', ""], ["shoe", "Activity", 'data-hhtab="move"', "steps and workouts"],
      ["moon", "Sleep", 'data-hhtab="sleep"', ""], ["smile", "Wellness check-in", 'data-hhtab="checkin"', "mood, energy, how you feel"], ["plus", "Log something", 'data-hhtab="add"', ""]]) +
    grp("Your health log", [["pulse", "Vitals", 'data-hhtab="vitals"', "blood pressure, glucose, weight, heart rate, oxygen"], ["cal", "Visits", 'data-hhtab="appts"', "appointments and questions"],
      ["clip", "Visit summary", 'data-hhtab="visit"', "for your doctor"], ["folder", "Records vault", 'data-hhtab="vault"', "on this phone only"]]) +
    grp("If you need help", [["shield", "Emergency card", 'data-hhtab="card"', ""], ["sos", "Show my health info", 'data-hhsos="1"', "one big screen, works offline"]]) +
    grp("Goals", [["target", "Daily goals", 'data-hhtab="goals"', ""], ["heart", "Health Score", 'data-hhtab="score"', "made from your routines"], ["trophy", "Step challenges", 'data-hhtab="challenge"', ""]]) +
    grp("App", [["spark", `Ask ${APP_NAME}`, 'data-hhask="1"', "answers from your own log"], ["clip", "Brain dump", 'data-dump="1"', "get it out of your head"], ["gear", "Settings", 'data-hwgo="settings"', "reminders, backup, your data"],
      ["palette", "Classic Look", 'data-hwgo="classic"', "the old screen"]]) +
    `<p class="hw-fine">${esc(HH_ADV)}</p>`;
}
function hwPageHtml() { return HW_TAB === "more" ? hwMoreHtml() : hwHomeHtml(); }

// ------------------------------------------------------------ the tab bar (his board): Home | Visits | Vitals | Goals | More
const HW_NAV = [["home", "home", "Home", 'data-hwgo="home"'], ["appts", "cal", "Visits", 'data-hhtab="appts"'], ["vitals", "pulse", "Vitals", 'data-hhtab="vitals"'],
  ["goals", "apple", "Goals", 'data-hhtab="goals"'], ["more", "more", "More", 'data-hwgo="more"']];
function hwNavHtml() {
  return HW_NAV.map(([k, ic, label, attrs]) => `<button class="${HW_TAB === k ? "on" : ""}" ${attrs} aria-current="${HW_TAB === k ? "page" : "false"}" aria-label="${label}">${wi(ic, "hw-nic")}<span>${label}</span></button>`).join("");
}

// ------------------------------------------------------------ PAGES: the page sheet as a full screen (back arrow, big title, a picture)
const HW_PAGES = { meds: ["Medications", "meds"], add: ["Log Something", ""], vitals: ["Vitals", "vitals"], more: ["Everything", ""], appts: ["Visits", "visits"],
  move: ["Activity", "move"], sleep: ["Sleep", "sleep"], water: ["Water", "water"], checkin: ["Wellness Check-In", "wellness"], vault: ["Records", "records"],
  card: ["Emergency Card", ""], visit: ["Visit Summary", "summary"], challenge: ["Challenges", "move"], score: ["My Health", "goals"], goals: ["Daily Goals", "goals"] };
function hwDress() {
  const el = document.getElementById("hhSheet"); if (!el) return;
  const on = hwOn(); el.classList.toggle("hw-full", on);
  if (!on) return;
  const body = el.querySelector(".sheet-body"), head = body && body.querySelector(".sheet-head");
  if (!head || head.classList.contains("hw-head")) return;
  const [title, art] = HW_PAGES[HH_TAB] || [((HH_TABS.find(x => x[0] === HH_TAB) || [])[2]) || "Health Hub", ""];
  head.className = "sheet-head hw-head";
  head.innerHTML = `<button class="hw-back" data-hhclose="1" aria-label="Back">‹</button><h2>${esc(title)}</h2>`;
  if (art) head.insertAdjacentHTML("afterend", `<div class="hw-band hw-band-${art}" aria-hidden="true"></div>`);
}

// ------------------------------------------------------------ the wraps: each runs exactly as before while the look is off
const HW_OLD = { hero: typeof paintHero === "function" ? paintHero : null, dash: hhDashHtml, nav: hhNavHtml, show: showHh };
if (HW_OLD.hero) paintHero = function () {          // every render starts here: the look's class on the page, before anything is drawn
  const on = hwOn();
  document.body.classList.toggle("hw", on);
  if (on) document.body.dataset.hwtab = HW_TAB; else delete document.body.dataset.hwtab;
  return HW_OLD.hero.apply(this, arguments);
};
hhDashHtml = function () {
  if (!hwOn()) return HW_OLD.dash.apply(this, arguments);
  hhNavEnsure(); return hwPageHtml();
};
hhNavHtml = function (on) { return hwOn() ? hwNavHtml() : HW_OLD.nav(on); };
showHh = function (tab) {           // a redraw keeps the page where it was: health.js restores the scroll on the plain page, and the picture
  const o = document.querySelector("#hhSheet .sheet-body"), keep = HH_OPEN && o && (!tab || tab === HH_TAB) ? o.scrollTop : 0;   // band added after it would
  HW_OLD.show(tab); hwDress();                                                                                                    // move every button ~160px
  if (keep && hwOn()) { const b = document.querySelector("#hhSheet .sheet-body"); if (b) b.scrollTop = keep; }
};

// ------------------------------------------------------------ taps that belong to the look
document.addEventListener("click", e => {
  const b = e.target.closest && e.target.closest("button[data-hwgo]");
  if (!b || typeof MODE === "undefined" || MODE !== "health") return;
  const go = b.dataset.hwgo;
  if (go === "home" || go === "more") {
    if (go === HW_TAB && go === "home") { window.scrollTo({ top: 0, behavior: "smooth" }); return; }
    HW_TAB = go; if (typeof hideHh === "function" && HH_OPEN) hideHh(); render(); window.scrollTo({ top: 0 }); return; }
  if (go === "settings") { if (typeof openSettings === "function") openSettings(); return; }
  if (go === "classic") { try { localStorage.setItem(HW_KEY, "classic"); } catch (e2) { /* private mode */ } HW_TAB = "home"; render(); window.scrollTo({ top: 0 }); toast("Classic look on this phone"); return; }
});
// Any other copy on his phone: five quick taps on the app's name at the bottom of Settings flip the look, whatever browser it lives in.
let HW_NAME_TAPS = [];
document.addEventListener("click", e => {
  const b = e.target.closest && e.target.closest("#sheet p.fine > b");
  if (!b || !/Marvel Corp app/.test(b.textContent) || typeof MODE === "undefined" || MODE !== "health" || !hhSet() || !hwOwnerish()) return;   // never on a customer's phone
  const now = Date.now(); HW_NAME_TAPS = HW_NAME_TAPS.filter(x => now - x < 3000).concat(now);
  if (HW_NAME_TAPS.length < 5) return;
  HW_NAME_TAPS = []; const on = !hwOn();
  try { localStorage.setItem(HW_KEY, on ? "tiles" : "classic"); localStorage.setItem("healthhub.ownerlook", "1"); } catch (e2) { /* private mode */ }
  HW_TAB = "home"; closeSettings(); render(); window.scrollTo({ top: 0 }); toast(on ? "New look on for this phone" : "Classic look on this phone");
});
// The phone's own back button walks the same path as the arrow on screen: the newest open sheet (or the big health-info screen) closes
// first, More goes Home, only Home leaves the app. Never on the old look.
let HW_DEPTH = 0, HW_SKIP = 0, HW_SYNC_T = 0, HW_STACK = [];
const HW_CLOSERS = ["hhsosclose", "hhclose", "askclose", "pulseclose", "close", "upclose", "billclose", "readyclose", "forgetclose"].map(k => `[data-${k}]`).join(", ");
function hwStack() {                 // the open sheets in the order they opened
  const open = [...document.querySelectorAll(".sheet:not(.hidden), #hhSos")];
  HW_STACK = HW_STACK.filter(el => open.includes(el)); open.forEach(el => { if (!HW_STACK.includes(el)) HW_STACK.push(el); });
  return HW_STACK;
}
function hwSyncHistory() {
  HW_SYNC_T = 0;
  if (HW_SKIP || typeof MODE === "undefined" || MODE !== "health") return;
  const want = hwOn() ? (HW_TAB !== "home" ? 1 : 0) + hwStack().length : 0;
  try {
    if (want && "scrollRestoration" in history) history.scrollRestoration = "manual";
    while (HW_DEPTH < want) history.pushState({ hw: ++HW_DEPTH }, "");
    if (HW_DEPTH > want) { HW_SKIP++; setTimeout(() => { HW_SKIP = 0; }, 1500); history.go(want - HW_DEPTH); HW_DEPTH = want; }
  } catch (e) { HW_DEPTH = want; /* some browsers limit this; the arrow still works */ }
}
function hwSyncSoon() { if (!HW_SYNC_T) HW_SYNC_T = setTimeout(hwSyncHistory, 0); }
document.addEventListener("click", () => { if (typeof MODE !== "undefined" && MODE === "health") hwSyncSoon(); });
window.addEventListener("popstate", () => {
  if (HW_SKIP) { HW_SKIP--; hwSyncSoon(); return; }
  if (typeof MODE === "undefined" || MODE !== "health" || !hwOn()) return;
  HW_DEPTH = Math.max(0, HW_DEPTH - 1);
  const st = hwStack();
  if (st.length) { const el = st[st.length - 1], x = el.querySelector(HW_CLOSERS);   // only the newest one closes
    if (x) x.click(); else { if (el.id === "hhSos") el.remove(); else el.classList.add("hidden"); render(); }
    hwSyncSoon(); return; }
  if (HW_TAB !== "home") { HW_TAB = "home"; render(); window.scrollTo({ top: 0 }); hwSyncSoon(); return; }
  if (history.state && history.state.hw) history.back();
});
