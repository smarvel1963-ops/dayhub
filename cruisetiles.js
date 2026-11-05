/* SAVE AS: cruisetiles.js · LOCATION: C:/MarvelApps/dayhub/cruisetiles.js
 * CRUISE HUB NEW LOOK - Phase 1 (Scott 11/01: sent a tile-dashboard design for Cruise Hub, then his outline:
 *   "Main navigation: Home | My Cruise | Port Days | Money | More",
 *   "Crisis Mode should remain accessible from every main screen, using a distinct lifesaver icon",
 *   "make the interface adapt to the stage of the trip. Before sailing, emphasize countdown and packing. On port days,
 *    put Return Guard and all-aboard time at the top. On the final morning, surface Time to Go Home and Remember My Car").
 * Phase 1 = HOME (photo hero, the stage card, Needs you, 12 tiles), the 5 renamed tabs, the lifesaver on every tab and a
 * More tab. Every tile opens a screen that already exists; the inner screens get the new look in Phase 2.
 * The stage logic is the hero's own (ui.js cruiseCountdown / guardHtml, cruise.js goHomeHtml / phaseCardHtml) - nothing
 * new is decided here, it is only laid out.
 * SWITCH: CT_ON = false - nobody sees it. One phone can preview it with the link ?look=tiles (kept on that phone,
 * cruisehub.look); ?look=classic or More -> Classic look turns it back. Cruise Hub only; Simple mode always wins.
 * Loaded by ../cruisehub/index.html after shell.js (+ cruisetiles.css). Hooks: shell.js homeHtml / shellHtml / paintTabs.
 * #hero is hidden in this look, so ctNoticesHtml brings over the chips people must not miss (new version, Install, Pro
 * paused / ending, the car) and ctTopHtml the Offline pill.
 * Phase 3 (Scott 11/03: "finish what you can on hubs"; his 11/01 cross-check: "a beautiful home screen isn't enough. Every
 * feature needs to have a logical place") = More lists everything by when you need it (Road Trip Brain, Home Port, Fix My Trip,
 * First 10 Minutes, Free Time, Group Vote, Reminders), Money adds Spending Pulse + Export, Cruise Hub Pass gets a status screen,
 * and One Cruise Secret is back on Home. Each opens what Cruise Hub already has.
 * Phase 4 (Scott 11/04: "the cruise hub design was amaizing", "get cruise hub matched up like we discussed screens last nite and finish it")
 * = his board with its art, not just its layout: a scene behind every screen (../cruisehub/art/*.webp, CSS in cruisetiles.css), one set
 * of drawn icons, all the main tiles on the first screen, and full screens for Countdown, Packing List, Port Days, On Board, Payments &
 * Budget and Crisis Mode. Each still opens or uses what Cruise Hub already has. Art is fetched only on a phone with the new look on
 * (ctPreloadArt); the worker keeps what it fetches, so it works at sea and costs nobody else any data.
 * DEPLOY ORDER: push dayhub first and let Pages publish, then cruisehub (the art, and its worker caches these two files).
 */
"use strict";

const CT_ON = false;                 // THE SWITCH: true = everyone on Cruise Hub gets the new look (Scott's go only)
const CT_KEY = "cruisehub.look";
(function ctFromLink() {             // ?look=tiles|classic sets this phone's look, then leaves the address as it was
  try {
    const u = new URL(location.href), v = u.searchParams.get("look");
    if (v !== "tiles" && v !== "classic") return;
    localStorage.setItem(CT_KEY, v); u.searchParams.delete("look");
    history.replaceState(null, "", u.pathname + (u.search || "") + u.hash);
  } catch (e) { /* private mode: the link just doesn't stick */ }
})();
const ctPick = () => { try { return localStorage.getItem(CT_KEY); } catch (e) { return null; } };
// 11/04 (Scott: "can get it applied"): a link or a tile from outside the app can miss the copy he actually opens. The owner's phone holds Scott Hub or the
// owner's OK, so it turns the new look on by itself, once. After that Classic Look and Simple Mode still stick. Customers have neither, so nothing changes for them.
let CT_OWNER_CHECKED = false;
function ctOwnerOnce() {
  if (CT_OWNER_CHECKED) return; CT_OWNER_CHECKED = true;
  try {
    if (localStorage.getItem("cruisehub.ownerlook") || !(localStorage.getItem("scotthub.k") || localStorage.getItem("dayhub.ownerok") === "1")) return;
    localStorage.setItem("cruisehub.ownerlook", "1"); localStorage.setItem(CT_KEY, "tiles");
    if (S.simple) { S.simple = false; saveLocal(); }
  } catch (e) { /* private mode */ }
}
function ctOn() {
  if (typeof MODE === "undefined" || MODE !== "cruise") return false;
  ctOwnerOnce();
  return typeof shellOn === "function" && shellOn() && !S.simple && (CT_ON ? ctPick() !== "classic" : ctPick() === "tiles");
}

// The five tabs (keys stay the shell's own: plan / explore / wallet / ai) - Scott: Home | My Cruise | Port Days | Money | More.
const CT_SVG = p => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
const CT_TABS = [
  ["home", CT_SVG('<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>'), "Home"],
  ["plan", CT_SVG('<path d="M2 16l2.5 5h15l2.5-5-10-3.5z"/><path d="M6 14.6V9h12v5.6"/><path d="M9.5 9V5.5h5V9"/>'), "My Cruise"],
  ["explore", CT_SVG('<path d="M12 21s-7-6.3-7-11a7 7 0 0 1 14 0c0 4.7-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>'), "Port Days"],
  ["wallet", CT_SVG('<rect x="3" y="6" width="18" height="13" rx="2.5"/><path d="M3 10h18"/><path d="M16 14.5h2"/>'), "Money"],
  ["ai", CT_SVG('<circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/>'), "More"],
];
const CT_TAB_NAME = { home: "Home", plan: "My Cruise", explore: "Port Days", wallet: "Money", ai: "More" };
// The lifesaver - Crisis Mode, the same red-and-white ring on every tab.
/* Cruise Hub tile icons (Scott's board: solid navy with white detail, a few colour ones). 48x48, inline, no network. */
const CT_I = (body, fill = "#0b2f63") => `<svg viewBox="0 0 48 48" aria-hidden="true" fill="${fill}">${body}</svg>`;
const CT_W = 'stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" fill="none"';
const CT_ICONS = {
  calendar: CT_I(`<rect x="6" y="9" width="36" height="33" rx="6"/><rect x="13" y="4" width="4.5" height="10" rx="2.2"/><rect x="30.5" y="4" width="4.5" height="10" rx="2.2"/><rect x="10" y="19" width="28" height="19" rx="2.5" fill="#fff"/>
    <g fill="#0b2f63"><rect x="14" y="22.5" width="5" height="4.5" rx="1"/><rect x="21.5" y="22.5" width="5" height="4.5" rx="1"/><rect x="29" y="22.5" width="5" height="4.5" rx="1"/><rect x="14" y="30" width="5" height="4.5" rx="1"/><rect x="21.5" y="30" width="5" height="4.5" rx="1"/><rect x="29" y="30" width="5" height="4.5" rx="1"/></g>`),
  checklist: CT_I(`<rect x="8" y="6" width="32" height="38" rx="6"/><rect x="17" y="2.5" width="14" height="8" rx="3" stroke="#e8f2fc" stroke-width="2"/>
    <path ${CT_W} d="M14 20l2.6 2.6 4.4-5M14 32l2.6 2.6 4.4-5M26 20h8M26 32h8"/>`),
  wallet: CT_I(`<path d="M9 13L33 5.5c2.2-.7 4 .7 4 2.8V13z" opacity=".78"/><rect x="5" y="12" width="38" height="29" rx="6"/><path d="M43 22h-9.5a5.5 5.5 0 0 0 0 11H43z" fill="#3b82d6"/><circle cx="33.5" cy="27.5" r="2.4" fill="#fff"/>`),
  plane: CT_I(`<path d="M43.2 5.2c-1.9-1.9-5-1.7-6.9.3L28.6 13 9.8 8.1 6.7 11.2l15.2 8.7-7.4 7.9-6-1.1-2.4 2.4 8.3 4.3 4.3 8.3 2.4-2.4-1.1-6 7.9-7.4 8.7 15.2 3.1-3.1-4.9-18.8 7.5-7.7c2-1.9 2.2-5 .3-6.9z"/>`),
  anchor: CT_I(`<circle cx="24" cy="9.5" r="5" fill="none" stroke="#0b2f63" stroke-width="3.6"/><rect x="22" y="14" width="4" height="27"/><rect x="14.5" y="19" width="19" height="4" rx="2"/>
    <path d="M6.5 25l5 .5-1.6 2.2c1.2 6.2 6.3 10.4 12.1 11.2V43C14 42.200 7 36.200 5.900 29.400L3.800 30.800zM41.500 25l-5 .5 1.600 2.200C36.900 33.900 31.800 38.100 26 38.900V43c8-.8 15-6.800 16.100-13.600l2.100 1.400z"/>`),
  wheel: CT_I(`<circle cx="24" cy="24" r="13" fill="none" stroke="#0b2f63" stroke-width="4"/><circle cx="24" cy="24" r="3.8"/>
    <g stroke="#0b2f63" stroke-width="3.2" stroke-linecap="round"><path d="M24 4v10M24 34v10M4 24h10M34 24h10M9.900 9.900l7 7M31.100 31.100l7 7M38.100 9.900l-7 7M16.900 31.100l-7 7"/></g>`),
  palm: `<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M23.500 19c-1.600 8-2.600 15.500-3.300 23h5.700c-.1-7.500.2-15 1.100-23z" fill="#a0642b"/><ellipse cx="23" cy="43" rx="15" ry="3.400" fill="#f4c76b"/>
    <g fill="#16a34a"><path d="M25 19C21 11 13 8.500 5.500 12c6.500 0 13 2.500 19.500 7z"/><path d="M25 19c-6-3-14-1.500-18.500 6.500C12 20.500 18.500 19 25 19z"/><path d="M25 19c3.500-8 11.500-11 19-7.500-6.500.2-13 2.500-19 7.500z"/><path d="M25 19c6-3.500 14-2 18.500 6-5.500-5-12-6.500-18.500-6z"/><path d="M25 19c-1.500-6.500 1-12.500 7-15.500-3 4.500-5.500 9.500-7 15.500z" fill="#22c55e"/><path d="M25 19c-3-6-1-12.500 3-15-1.500 5-2.500 10-3 15z" fill="#15803d"/></g></svg>`,
  masks: CT_I(`<path d="M5 10c6 3 14 3 20 0v13c0 7-4.500 12-10 12S5 30 5 23z"/><path ${CT_W} d="M9.500 18.500c1-1.300 3-1.300 4 0M16.500 18.500c1-1.300 3-1.300 4 0M10 25.500c2.500 3.500 7.500 3.500 10 0"/>
    <path d="M28.500 17.500c4 1.500 9.500 1.500 14.500-.5v12c0 6.500-4 11-9 11-3.500 0-6.500-2-8-5.500 2.200-2.900 2.500-6.800 2.500-11z" fill="#1d5fb8"/><path ${CT_W} d="M31 25c.8 1 2.700 1 3.500 0M37.500 25c.8 1 2.700 1 3.500 0M32 34c2-2.500 6-2.500 8 0"/>`),
  house: CT_I(`<path d="M24 5L3.500 22.500c-1.200 1 0 3 1.500 2.500l2.500-1V40c0 1.700 1.300 3 3 3H20V30.500h8V43h9.500c1.700 0 3-1.300 3-3V24l2.500 1c1.500.5 2.700-1.500 1.500-2.500L39 17.300V8h-5v5z"/>`),
  grid: CT_I(`<rect x="7" y="7" width="15" height="15" rx="3.500"/><rect x="26" y="7" width="15" height="15" rx="3.500"/><rect x="7" y="26" width="15" height="15" rx="3.500"/><rect x="26" y="26" width="15" height="15" rx="3.500"/>`),
  life: `<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="16" fill="none" stroke="#fff" stroke-width="11"/><circle cx="24" cy="24" r="16" fill="none" stroke="#dc2626" stroke-width="11" stroke-dasharray="12.570 12.570" transform="rotate(-22.500 24 24)"/><circle cx="24" cy="24" r="21.800" fill="none" stroke="#7f1d1d" stroke-opacity=".35"/><circle cx="24" cy="24" r="10.200" fill="none" stroke="#7f1d1d" stroke-opacity=".35"/></svg>`,
  sparkle: `<svg viewBox="0 0 48 48" aria-hidden="true"><defs><linearGradient id="ctsp" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2563eb"/><stop offset="1" stop-color="#9333ea"/></linearGradient></defs><path fill="url(#ctsp)" d="M24 3c1.800 11.600 5.400 15.200 17 17-11.600 1.800-15.200 5.400-17 17-1.800-11.600-5.400-15.200-17-17 11.600-1.800 15.200-5.400 17-17z"/><path fill="#60a5fa" d="M38 31c.7 4.300 2 5.600 6.300 6.300-4.300.7-5.600 2-6.300 6.300-.7-4.300-2-5.600-6.300-6.300 4.300-.7 5.600-2 6.300-6.300z"/><path fill="#c084fc" d="M9.500 5.500c.5 3 1.500 4 4.500 4.500-3 .5-4 1.500-4.500 4.500-.5-3-1.500-4-4.500-4.500 3-.5 4-1.500 4.500-4.500z"/></svg>`,
  stopwatch: CT_I(`<rect x="19" y="3" width="10" height="5" rx="2"/><path d="M36 9.500l4 4-2.500 2.500-4-4z"/><circle cx="24" cy="27" r="17"/><circle cx="24" cy="27" r="12.500" fill="#fff"/><path d="M24 18v9.500l6 3.500" stroke="#0b2f63" stroke-width="3.200" stroke-linecap="round" fill="none"/>`),
  ship: CT_I(`<path d="M3.500 29h41l-5.500 11.500c-.6 1.200-1.800 2-3.100 2H12.100c-1.300 0-2.500-.8-3.100-2z"/><path d="M9.500 27V19.500c0-1.100.9-2 2-2H36c1.100 0 2 .9 2 2V27z" fill="#1d5fb8"/><rect x="15" y="10" width="17" height="7.500" rx="1.800"/><rect x="20.500" y="4.500" width="6" height="5.500" rx="1" fill="#1d5fb8"/><g fill="#fff"><rect x="13" y="21" width="3.400" height="3" rx=".7"/><rect x="19" y="21" width="3.400" height="3" rx=".7"/><rect x="25" y="21" width="3.400" height="3" rx=".7"/><rect x="31" y="21" width="3.400" height="3" rx=".7"/></g><path d="M3 45c3.500 0 3.500-1.500 7-1.500s3.500 1.500 7 1.500 3.500-1.500 7-1.500 3.500 1.500 7 1.500 3.500-1.500 7-1.500 3.500 1.500 7 1.500" stroke="#3b82d6" stroke-width="2.200" fill="none" stroke-linecap="round"/>`),
  dining: CT_I(`<path d="M12 4v13c0 2.800 1.700 5 4 5.800V44h5V22.800c2.300-.8 4-3 4-5.800V4h-3.500v12h-2V4h-4v12h-2V4z"/><path d="M34 4c-4.400 1.800-7 7.500-7 13.500 0 5 2 8.200 5 9V44h5V4z"/>`),
  ticket: CT_I(`<path d="M34.500 4.500L3.500 21.700l3 5.300c2.300-1.300 5.200-.5 6.500 1.800s.5 5.200-1.800 6.500l3 5.300 31-17.200-3-5.300c-2.300 1.300-5.200.5-6.500-1.800s-.5-5.200 1.800-6.500z"/><path d="M24.500 14l6.500 11.500" stroke="#fff" stroke-width="2.400" stroke-dasharray="3 3"/>`),
  card: CT_I(`<rect x="4" y="9" width="40" height="30" rx="6"/><rect x="4" y="16" width="40" height="6.500" fill="#3b82d6"/><rect x="10" y="28" width="11" height="4" rx="2" fill="#fff"/><rect x="32" y="27" width="7" height="6" rx="1.500" fill="#fbbf24"/>`),
  binoculars: CT_I(`<path d="M13 8h7v8h8V8h7l9 22-.5 1c0 5.500-4.500 9.500-10 9.500S24.500 36 24 31c-.5 5-5 9.500-10.500 9.500S3.500 36.500 3.500 31L3 30z"/><circle cx="13.500" cy="31" r="5.500" fill="#fff"/><circle cx="34.500" cy="31" r="5.500" fill="#fff"/>`),
  sun: `<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="10" fill="#0b2f63"/><g stroke="#0b2f63" stroke-width="3.800" stroke-linecap="round"><path d="M24 4v6M24 38v6M4 24h6M38 24h6M9.900 9.900l4.200 4.200M33.900 33.900l4.200 4.200M38.100 9.900l-4.200 4.200M14.100 33.900l-4.200 4.200"/></g></svg>`,
  people: CT_I(`<circle cx="24" cy="15" r="7.500"/><path d="M10.500 41c0-9 6-15 13.500-15s13.500 6 13.500 15z"/><circle cx="9.500" cy="19" r="5" fill="#1d5fb8"/><path d="M1 39c0-6.500 3.700-11.500 9.500-11.500 1.300 0 2.500.3 3.500.8-3.200 2.900-5.400 6.300-6 10.700z" fill="#1d5fb8"/><circle cx="38.500" cy="19" r="5" fill="#1d5fb8"/><path d="M47 39c0-6.500-3.700-11.500-9.500-11.500-1.300 0-2.500.3-3.500.8 3.200 2.900 5.400 6.300 6 10.700z" fill="#1d5fb8"/>`),
  suitcase: CT_I(`<path d="M17 12V8c0-2.200 1.800-4 4-4h6c2.200 0 4 1.800 4 4v4h-3.500V8a.5.5 0 0 0-.5-.5h-6a.5.5 0 0 0-.5.5v4z"/><rect x="7" y="12" width="34" height="29" rx="6"/><path ${CT_W} d="M16 19v15M32 19v15"/><rect x="12" y="41" width="5" height="4" rx="1"/><rect x="31" y="41" width="5" height="4" rx="1"/>`),
  doc: CT_I(`<path d="M11 3h18l10 10v28c0 2.200-1.800 4-4 4H11c-2.200 0-4-1.800-4-4V7c0-2.200 1.800-4 4-4z"/><path d="M29 3v10h10z" fill="#3b82d6"/><path ${CT_W} d="M14 24h19M14 31h19M14 38h12"/>`),
  swap: CT_I(`<path d="M8 15h25l-5-5 3-3 11 10-11 10-3-3 5-5H8z"/><path d="M40 33H15l5 5-3 3L6 31l11-10 3 3-5 5h25z" fill="#1d5fb8"/>`),
  car: CT_I(`<path d="M9.500 13.500C10.400 10.800 13 9 15.800 9h16.400c2.800 0 5.400 1.800 6.300 4.500l3 9c2.300.7 4 2.900 4 5.500v9c0 1.100-.9 2-2 2H5c-1.100 0-2-.9-2-2v-9c0-2.600 1.700-4.800 4-5.500z"/><path d="M13 22l2-6.500c.3-.9 1.100-1.500 2-1.500h14c.9 0 1.700.6 2 1.500l2 6.500z" fill="#fff"/><circle cx="12" cy="30" r="3" fill="#fbbf24"/><circle cx="36" cy="30" r="3" fill="#fbbf24"/><rect x="7" y="39" width="7" height="5" rx="1.500"/><rect x="34" y="39" width="7" height="5" rx="1.500"/>`),
  hourglass: CT_I(`<rect x="9" y="3" width="30" height="6" rx="2.500"/><rect x="9" y="39" width="30" height="6" rx="2.500"/><path d="M13 9h22v5c0 4.400-3.200 8-7 10 3.800 2 7 5.600 7 10v5H13v-5c0-4.400 3.200-8 7-10-3.800-2-7-5.600-7-10z"/><path d="M18 14h12c0 2.500-2.800 5-6 6.500-3.200-1.500-6-4-6-6.500zM18 36c1.200-3 3.500-5 6-6 2.500 1 4.800 3 6 6z" fill="#fff"/>`),
  book: CT_I(`<path d="M10 4h27c1.700 0 3 1.300 3 3v34c0 1.700-1.300 3-3 3H10c-2.200 0-4-1.800-4-4V8c0-2.200 1.800-4 4-4z"/><path ${CT_W} d="M15 4v40M21 14h12M21 21h12"/>`),
  pin: CT_I(`<path d="M24 3C15.200 3 8 10 8 18.800 8 30.500 24 45 24 45s16-14.500 16-26.200C40 10 32.800 3 24 3z"/><circle cx="24" cy="18.500" r="6.500" fill="#fff"/>`),
  moon: CT_I(`<path d="M31 4.500A20 20 0 1 0 43.500 31 16.500 16.500 0 0 1 31 4.500z"/><path d="M37 8l1.300 3.700L42 13l-3.700 1.300L37 18l-1.300-3.700L32 13l3.700-1.300z" fill="#fbbf24"/>`),
  receipt: CT_I(`<path d="M8 3l4 3 4-3 4 3 4-3 4 3 4-3 4 3 4-3v42l-4-3-4 3-4-3-4 3-4-3-4 3-4-3-4 3z"/><path ${CT_W} d="M15 15h18M15 23h18M15 31h11"/>`),
  camera: CT_I(`<path d="M17 8h14l3 6h7c2.200 0 4 1.800 4 4v21c0 2.200-1.800 4-4 4H7c-2.200 0-4-1.800-4-4V18c0-2.200 1.800-4 4-4h7z"/><circle cx="24" cy="27" r="9.500" fill="#fff"/><circle cx="24" cy="27" r="5.500"/>`),
  bell: CT_I(`<path d="M24 4c-2 0-3.500 1.500-3.500 3.500v1.200C14 10.300 10 16 10 22.500V32l-4 5v2h36v-2l-4-5v-9.500c0-6.500-4-12.200-10.500-13.800V7.500C27.500 5.500 26 4 24 4z"/><path d="M18.500 41.500c.8 2.300 3 3.500 5.500 3.500s4.700-1.200 5.500-3.500z" fill="#1d5fb8"/>`),
  star: `<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#f59e0b" stroke="#b45309" stroke-width="1.500" d="M24 4l6.200 12.700 14 2-10.100 9.900 2.400 14L24 36l-12.500 6.600 2.400-14L3.800 18.700l14-2z"/></svg>`,
  gear: CT_I(`<path d="M20.500 3h7l1.200 5.600c1.300.4 2.500.9 3.600 1.600l4.800-3.100 5 5-3.100 4.800c.7 1.100 1.200 2.300 1.600 3.600L46 21.500v7l-5.400 1.200c-.4 1.300-.9 2.500-1.600 3.600l3.100 4.800-5 5-4.800-3.100c-1.100.7-2.300 1.200-3.600 1.600L27.500 47h-7l-1.200-5.400c-1.300-.4-2.500-.9-3.600-1.600l-4.800 3.100-5-5 3.100-4.800c-.7-1.100-1.200-2.300-1.600-3.600L2 28.500v-7l5.400-1.200c.4-1.300.9-2.500 1.600-3.600L5.900 11.900l5-5 4.800 3.100c1.100-.7 2.300-1.200 3.600-1.600z"/><circle cx="24" cy="25" r="7.500" fill="#fff"/>`),
  glasses: CT_I(`<path d="M4 20c0-1.700 1.300-3 3-3h11c1.700 0 3 1.300 3 3v.5h6V20c0-1.700 1.300-3 3-3h11c1.700 0 3 1.300 3 3v5c0 5-4 9-9 9h-1.500c-4.400 0-8.200-3-8.800-7h-3.400c-.6 4-4.400 7-8.800 7H13c-5 0-9-4-9-9z"/>`),
  palette: `<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#0b2f63" d="M24 4C12.400 4 3 12.700 3 23.500S12.400 44 23.500 44c3 0 4.500-2 4.500-4 0-1-.4-1.900-1-2.700-.6-.8-1-1.700-1-2.800 0-2.200 1.800-4 4-4h4.500C40.300 30.500 45 26 45 20.500 45 11.400 35.600 4 24 4z"/><circle cx="14" cy="18" r="3.400" fill="#f87171"/><circle cx="24" cy="12" r="3.400" fill="#fbbf24"/><circle cx="34" cy="17" r="3.400" fill="#34d399"/><circle cx="12.500" cy="29" r="3.400" fill="#60a5fa"/></svg>`,
  calc: CT_I(`<rect x="8" y="3" width="32" height="42" rx="6"/><rect x="13" y="8" width="22" height="9" rx="2" fill="#a7f3d0"/><g fill="#fff"><circle cx="16" cy="24" r="2.700"/><circle cx="24" cy="24" r="2.700"/><circle cx="32" cy="24" r="2.700"/><circle cx="16" cy="32" r="2.700"/><circle cx="24" cy="32" r="2.700"/><circle cx="32" cy="32" r="2.700"/><circle cx="16" cy="39.500" r="2.700"/><circle cx="24" cy="39.500" r="2.700"/><circle cx="32" cy="39.500" r="2.700"/></g>`),
  up: CT_I(`<circle cx="24" cy="24" r="21"/><path ${CT_W} stroke-width="4" d="M14 25l10-10 10 10M24 15v19"/>`),
  split: CT_I(`<circle cx="24" cy="24" r="21"/><rect x="12" y="22" width="24" height="4" rx="2" fill="#fff"/><circle cx="24" cy="14.500" r="3.400" fill="#fff"/><circle cx="24" cy="33.500" r="3.400" fill="#fff"/>`),
  chart: `<svg viewBox="0 0 48 48" aria-hidden="true"><g fill="#16a34a"><rect x="5" y="28" width="8" height="15" rx="2"/><rect x="16" y="20" width="8" height="23" rx="2"/><rect x="27" y="24" width="8" height="19" rx="2"/><rect x="38" y="12" width="7" height="31" rx="2"/></g><path d="M5 19l11-8 11 5L42 4" stroke="#0b2f63" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  share: CT_I(`<path d="M24 3l11 11-3 3-6-6v20h-4V11l-6 6-3-3z"/><path d="M7 25h8v4H11v12h26V29h-4v-4h8v20H7z" fill="#1d5fb8"/>`),
};
const CT_LOGO = `<svg viewBox="0 0 64 40" aria-hidden="true"><path fill="#fff" d="M4 24h52l-6.500 9c-.7 1-1.900 1.500-3 1.500H13.500c-1.500 0-2.800-.8-3.500-2zM11 22v-5c0-1.100.9-2 2-2h26c1.100 0 2.100.6 2.500 1.500L46 22zM18 13v-3c0-1.100.9-2 2-2h14c.9 0 1.700.5 2.100 1.300L38 13zM25 6V2.500h6.500L33 6z"/><path d="M2 38c4 0 4-1.500 8-1.500s4 1.500 8 1.500 4-1.500 8-1.500 4 1.500 8 1.500 4-1.500 8-1.500 4 1.500 8 1.500 4-1.500 8-1.500" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round"/></svg>`;
const CT_GEAR = CT_SVG('<circle cx="12" cy="12" r="3"/><path d="M19.400 15a1.650 1.650 0 0 0 .33 1.820l.06.06a2 2 0 1 1-2.830 2.830l-.06-.06a1.650 1.650 0 0 0-1.820-.33 1.650 1.650 0 0 0-1 1.510V21a2 2 0 1 1-4 0v-.09a1.650 1.650 0 0 0-1-1.510 1.650 1.650 0 0 0-1.820.33l-.06.06a2 2 0 1 1-2.830-2.830l.06-.06a1.650 1.650 0 0 0 .33-1.820 1.650 1.650 0 0 0-1.510-1H3a2 2 0 1 1 0-4h.09a1.650 1.650 0 0 0 1.510-1 1.650 1.650 0 0 0-.33-1.820l-.06-.06a2 2 0 1 1 2.830-2.830l.06.06a1.650 1.650 0 0 0 1.820.33h.08a1.650 1.650 0 0 0 1-1.510V3a2 2 0 1 1 4 0v.09a1.650 1.650 0 0 0 1 1.510 1.650 1.650 0 0 0 1.820-.33l.06-.06a2 2 0 1 1 2.830 2.830l-.06.06a1.650 1.650 0 0 0-.33 1.820v.08a1.650 1.650 0 0 0 1.510 1H21a2 2 0 1 1 0 4h-.09a1.650 1.650 0 0 0-1.510 1z"/>');
const CT_CHEV = `<span class="chev" aria-hidden="true">›</span>`;
const CT_CAL_W = CT_ICONS.calendar.replace(/#0b2f63/g, "@").replace(/#fff/g, "#0b3a7a").replace(/@/g, "#fff");
const ctMoney = n => Number.isInteger(n) ? `$${n.toLocaleString("en-US")}` : money(n);   // the board's whole dollars; cents only when there are cents
// The art lives with Cruise Hub. Fetched only on a phone with the new look on; going through the worker keeps it for the ship.
const CT_ART = ["home", "countdown", "crisis", "sky", "packing", "onboard", "money", "port_beach", "port_ruins", "port_pier", "port_island", "port_alaska", "port_europe"];
let CT_ART_ASKED = false;
function ctPreloadArt() {
  if (CT_ART_ASKED || S.photo === false) return; CT_ART_ASKED = true;
  CT_ART.forEach(n => fetch(`art/${n}.webp`).catch(() => {}));
}
const CT_LIFE = `<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="14" fill="none" stroke="#fff" stroke-width="8"/>
  <circle cx="20" cy="20" r="14" fill="none" stroke="#e11d48" stroke-width="8" stroke-dasharray="11 11" transform="rotate(-20 20 20)"/>
  <circle cx="20" cy="20" r="18.2" fill="none" stroke="rgba(0,0,0,.18)" stroke-width="1"/><circle cx="20" cy="20" r="9.8" fill="none" stroke="rgba(0,0,0,.18)" stroke-width="1"/></svg>`;

function ctTopHtml(home) {
  return `<div class="ct-top"><button class="ct-life" data-help="home" aria-label="Crisis Mode - help now">${CT_LIFE}</button>
    <div class="ct-brand"><b><span class="ct-logo">${CT_LOGO}</span>Cruise Hub</b><small>${home ? "Plan · Prepare · Sail · Explore · Enjoy" : esc(CT_TAB_NAME[TAB] || "")}${navigator.onLine === false ? ` <span class="offline-pill">🟠 Offline</span>` : ""}</small></div>
    <button class="ct-gear" data-ctgo="settings" aria-label="Settings">${CT_GEAR}</button></div>`;
}
// The hidden hero's must-see chips (app.js heroHtml builds them; all of them for this one read, none folded behind "+N more").
// The car chip stays out when the stage card already shows it (final night / last morning - unless Return Guard holds the card).
function ctNoticesHtml(tr) {
  const was = CHIPS_ALL; CHIPS_ALL = true; let html = "";
  try { html = heroHtml(); } finally { CHIPS_ALL = was; }
  const box = document.createElement("template"); box.innerHTML = html;
  const staged = !!tr && !guardFor(tr) && typeof goHomeState === "function" && !!goHomeState(tr);
  const keep = [...box.content.querySelectorAll(".chips > [data-update], .chips > [data-install], .chips > [data-prolapse], .chips > [data-gohome], .chips > [data-cloudask]")]
    .filter(c => !(c.dataset.gohome && staged));
  return keep.length ? `<div class="ct-notices">${keep.map(c => c.outerHTML).join("")}</div>` : "";
}
const ctDates = tr => tr.start ? prettyDate(tr.start) + (tr.end && tr.end !== tr.start ? ` – ${prettyDate(tr.end)}` : "") : "";
const ctWho = tr => [tr.line, tr.ship].filter(Boolean).map(esc).join(" · ");

// The card for the moment (Scott: "adapt to the stage of the trip") - port day = Return Guard, final night / last morning
// = Get me home + the car, otherwise the countdown (days, readiness, the next thing) or "day n of N" on the trip.
// A cruise pasted from an email can have no dates yet: then the card asks for them (the old hero's guard, kept).
// An "Other trip" on Cruise Hub gets trip words - no sail day, ship or sea (same rule as shell.js trCruise).
function ctStageHtml(tr) {
  const g = guardFor(tr);
  if (g) return `<div class="ct-stage ct-alert">${guardHtml(g)}</div>`;
  const st = typeof goHomeState === "function" && goHomeState(tr);
  if (st) return `<div class="ct-stage ct-alert">${goHomeHtml(tr, st)}${typeof carChip === "function" ? carChip(tr) : ""}</div>`;
  const cr = trCruise(tr);
  const head = `<span class="ct-head"><span class="ct-headic" aria-hidden="true">${CT_ICONS[cr ? "palm" : "suitcase"]}</span><span class="ct-headt"><span class="ct-k">${cr ? "My Cruise" : "My Trip"}</span><span class="ct-name">${esc(tr.name || tr.ship || (cr ? "My cruise" : "My trip"))}</span>
    <span class="ct-sub">${[ctWho(tr), esc(ctDates(tr))].filter(Boolean).join(" · ")}</span></span>${CT_CHEV}</span>`;
  if (!tr.start) return `<button class="ct-stage ct-card" data-tripedit="${esc(tr.id)}">${head}
      <span class="ct-row"><span class="ct-bigic" aria-hidden="true">${CT_CAL_W}</span><span class="ct-say"><b>Add your dates</b><small>Then the countdown, ports and reminders start</small></span></span></button>`;
  const R = readiness(tr), sd = daysUntil(tr.start), end = tr.end || tr.start, ed = daysUntil(end);
  if (ed < 0) return `<button class="ct-stage ct-card" data-shellgo="plan" ${cr ? 'data-triplistgo="after"' : 'data-planview="diary"'}>${head}
      <span class="ct-row"><span class="ct-bigic" aria-hidden="true">${CT_ICONS.house}</span><span class="ct-say"><b>Welcome home</b><small>The after-the-trip list is ready</small></span></span></button>`;
  const ready = `<span class="ct-ready"><b>${R.pct}%</b><small>${R.pct >= 50 ? "Ready to Go!" : "Ready"}</small><span class="ct-bar"><i style="width:${R.pct}%"></i></span></span>`;
  let big, lab;
  if (sd > 0) { big = sd; lab = cr ? (sd === 1 ? "Day to Sail" : "Days to Sail") : (sd === 1 ? "Day to go" : "Days to go"); }
  else if (sd === 0) { big = cr ? "⚓" : "✈️"; lab = cr ? "Sail day" : "Travel day"; }
  else { const n = -sd + 1, all = Math.round((parseDay(end) - parseDay(tr.start)) / 86400000) + 1, pt = cr ? portOn(tr, today()) : null;
    big = n; lab = `Day ${n} of ${all}` + (pt ? ` · ⚓ ${pt.name}` : today() === end ? " · going home" : cr ? " · 🌊 at sea" : ""); }
  return `<button class="ct-stage ct-card" data-ctgo="countdown">${head}
      <span class="ct-row"><span class="ct-days"><span class="ct-cal" aria-hidden="true">${CT_CAL_W}</span><span><b>${esc(String(big))}</b><small>${esc(lab)}</small></span></span>${ready}</span></button>`;
}

// The 12 tiles (Scott's design). Each opens what Cruise Hub already has. An "Other trip" drops the ship-only ones.
const ctPl = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
// The day the fun tools open on: today during the trip, else the first port day, else sail day.
function ctFunDay(tr) {
  const end = tr.end || tr.start, during = !!tr.start && daysUntil(tr.start) <= 0 && daysUntil(end) >= 0;
  return during ? today() : (tr.ports || []).map(p => p.day).filter(Boolean).sort()[0] || tr.start;
}
function ctTiles(tr) {
  const cr = trCruise(tr), ports = (tr.ports || []).length, W = tripWallet(tr), [pd, pn] = typeof listFrac === "function" ? listFrac(tr, "packing") : [0, 0];
  const nights = tr.start ? tripNights(tr) : 0, funDay = ctFunDay(tr);
  return [
    ["calendar", cr ? "My Cruise" : "My Trip", 'data-shellgo="plan" data-planview="trip"', [nights && ctPl(nights, "night"), ports && ctPl(ports, "port")].filter(Boolean).join(" · ")],
    ["checklist", "Lists & Prep", 'data-shellgo="plan" data-planview="packing" data-triplistgo="packing"', pn ? `packed ${pd}/${pn}` : ""],
    ["wallet", "Payments & Budget", 'data-shellgo="wallet"', W.total > 0 ? (W.left > 0 ? `${ctMoney(W.left)} left` : "paid ✓") : ""],
    ["plane", "Travel & Stay", 'data-shellgo="plan" data-planview="reservations"', ""],
    cr && ["anchor", "Sail Day", 'data-help="get"', ""],
    cr && ["wheel", "On Board", 'data-ctgo="onboard"', ""],
    ["palm", cr ? "Port Days" : "Things to Do", 'data-shellgo="explore"', ports ? ctPl(ports, "port") : ""],
    ["masks", "Activities & Fun", funDay ? `data-tlday="${esc(funDay)}"` : 'data-shellgo="explore"', ""],     // the day screen holds the Fun Finder
    ["house", "Coming Home", cr ? 'data-gohome="open"' : 'data-shellgo="plan" data-planview="diary"', ""],   // the final-night checklist is cruise-only
    ["life", "Crisis Mode", 'data-help="home"', "", "red"],
    ["sparkle", "AI Helper", 'data-ask="open"', ""],
    ["grid", "More", 'data-shellgo="ai"', ""],
  ].filter(Boolean);
}
const ctTileHtml = t => `<button class="ct-tile${t[4] ? " " + t[4] : ""}" ${t[2]}><span class="ct-ic" aria-hidden="true">${CT_ICONS[t[0]] || t[0]}</span><b>${esc(t[1])}</b>${t[3] ? `<small>${esc(t[3])}</small>` : ""}</button>`;

function ctHomeHtml() {
  const tr = curTrip();
  const hero = body => `<section class="ct-hero">${ctTopHtml(true)}${body}</section>`;
  if (!tr) return hero("") + ctNoticesHtml(null) + `<div class="ct-ways">${addCruiseHtml()}</div>`;   // no cruise yet: the ways in
  // Needs you = the hero's RIGHT NOW rows (with their second line); on the trip, NEXT (the next port / all aboard / plan) closes the list, as on the old home.
  const bb = bigButton(tr), items = rightNow(tr), urgent = !!guardFor(tr) || (typeof goHomeState === "function" && !!goHomeState(tr));
  const onTrip = !!tr.start && daysUntil(tr.start) <= 0, nxRaw = onTrip ? nextUp() : "";
  const nxWhat = (nxRaw.split(" — ")[1] || "").toLowerCase();               // NEXT that only repeats a row above = left out (old home's rule)
  const nx = nxWhat && items.some(r => String(r.text).toLowerCase().includes(nxWhat)) ? "" : nxRaw;
  const needs = items.length || nx ? `<section class="ct-needs">${items.length ? "<h4>Needs you</h4>" : ""}${items.map(x => `<button class="ct-need" ${x.act || ""}>${x.icon ? `<span aria-hidden="true">${x.icon}</span>` : ""}<span class="grow">${esc(x.text)}${x.sub ? `<small>${esc(x.sub)}</small>` : ""}</span><span class="chev" aria-hidden="true">›</span></button>`).join("")}
      ${nx ? `<div class="ct-nextup"><span>NEXT</span>${nx}</div>` : ""}</section>` : "";
  const phase = typeof phaseCardHtml === "function" ? phaseCardHtml(tr) : "";   // travel day / sail day / first 10 minutes
  const big = `<button class="ct-big" ${bb.act}>${esc(bb.label)}</button>`;     // port day / last morning: the way back stays above the tiles
  return hero(ctStageHtml(tr)) + ctNoticesHtml(tr)
    + (urgent ? big : "") + (phase ? `<div class="ct-phase">${phase}</div>` : "")
    + `<nav class="ct-grid ct-main" aria-label="${esc(APP_NAME)}">${ctTiles(tr).map(ctTileHtml).join("")}</nav>`
    + `<div class="ct-below">${urgent ? "" : big}${needs}${typeof secretHtml === "function" && secretHtml(tr) ? `<div class="ct-phase">${secretHtml(tr)}</div>` : ""}</div>`;   // one cruise secret for right now, as on the old home
}

// MORE: everything that isn't one of the four, by when you need it. The trip-only tiles show only once there is a trip (no dead
// taps); a tool that needs something (a booking with a time, two ideas to vote on, a known home port) waits for it.
function ctMoreHtml() {
  const tr = curTrip(), cr = !!tr && trCruise(tr), when = !!tr && !!tr.start, on = when && daysUntil(tr.end || tr.start) >= 0, fun = when ? ctFunDay(tr) : "";
  const wishes = tr && typeof tripWish === "function" ? tripWish(tr).length : 0;
  const groups = [
    ["Before you go", [tr && ["suitcase", "Packing", 'data-shellgo="plan" data-planview="packing" data-triplistgo="packing"', ""], tr && ["doc", "Documents", 'data-shellgo="plan" data-planview="packing" data-triplistgo="docs"', ""],
      tr && ["ticket", "Bookings", 'data-shellgo="plan" data-planview="reservations"', ""],
      tr && typeof fixClashes === "function" && (tr.bookings || []).some(b => b.day && b.t) && ["swap", "Fix My Trip", 'data-fixopen="pick"', ""],
      on && ["car", "Road Trip", `data-ctgo="day:${esc(tr.start)}:drive"`, "breaks, food, fuel"],
      cr && when && typeof homePort === "function" && !!tr.port && !!homePort(tr.port) && ["anchor", "Home Port", `data-tlday="${esc(tr.start)}"`, "parking + terminal"]]],
    [cr ? "On board" : "On the trip", [tr && ["calendar", "My Day", 'data-shellgo="plan" data-planview="today"', ""], cr && ["ship", "Ship Guide", 'data-ctgo="ship"', ""], cr && ["stopwatch", "First 10 Minutes", 'data-ctgo="first10"', ""],
      on && ["hourglass", "Free Time", `data-ctgo="day:${esc(fun)}:free"`, ""], on && ["masks", "Activities & Fun", `data-tlday="${esc(fun)}"`, ""],
      on && ["people", "Group Vote", wishes >= 2 ? `data-voteopen="${esc(tr.id)}"` : `data-ctgo="day:${esc(fun)}:free"`, wishes >= 2 ? "" : "add 2 ideas first"],
      tr && ["book", "Trip Diary", 'data-shellgo="plan" data-planview="diary"', ""], tr && ["pin", "Map", 'data-shellgo="plan" data-planview="map"', ""]]],
    ["Coming home", [cr && ["moon", "Final Night", 'data-gohome="open"', ""], cr && ["receipt", "Final Bill Check", 'data-billcheck="1"', ""], tr && ["camera", "After the Trip", cr ? 'data-shellgo="plan" data-planview="packing" data-triplistgo="after"' : 'data-shellgo="plan" data-planview="diary"', ""]]],
    ["This app", [["sparkle", "AI Helper", 'data-ask="open"', ""], ["bell", "Reminders", 'data-ctgo="reminders"', ""], ctPassOffered() && ["star", proName(), 'data-ctgo="pass"', hubProState().word], ["gear", "Settings", 'data-ctgo="settings"', ""],
      ["glasses", "Simple Mode", 'data-ctgo="settings"', "big buttons"], ["palette", "Classic Look", 'data-ctgo="classic"', "the old screen"]]]];
  return groups.map(([h, T]) => { const t = T.filter(Boolean);
      return t.length ? `<h4 class="ct-more-h">${esc(h)}</h4><nav class="ct-grid ct-more" aria-label="${esc(h)}">${t.map(ctTileHtml).join("")}</nav>` : ""; }).join("")
    + (tr && typeof prefsCardHtml === "function" ? prefsCardHtml() : "")
    + (typeof aiTabHtml === "function" ? aiTabHtml() : "");
}

// Phase 2 - MONEY opens with the final-payment tracker (Scott's "Payments & Budget" screen): trip total / paid / left,
// then the final payment due date with days to go (amber inside 14 days). Only when a fare total is saved.
const ctYmd = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ""));
function ctMoneyTopHtml(tr) {
  if (!tr) return "";
  const W = tripWallet(tr); if (!(W.total > 0)) return ctPulseHtml(tr) ? `<section class="ct-money" aria-label="Payments">${ctPulseHtml(tr)}</section>` : "";
  const left = tripLeft(tr) || 0, fd = ctYmd(tr.finalDue) ? daysUntil(tr.finalDue) : null;
  const fareWord = trCruise(tr) ? "fare" : "trip cost";
  const due = W.fare <= 0 ? "" : left <= 0 ? `<div class="ct-due done"><span aria-hidden="true">✅</span><span><b>${W.left > 0 ? `${trCruise(tr) ? "Cruise fare" : "Trip cost"} paid` : "Paid in full"}</b>${W.left > 0 ? `<small>${esc(ctMoney(W.left))} left on the rest</small>` : ""}</span></div>`
    : fd !== null ? `<div class="ct-due${fd < 0 ? " late" : fd <= 14 ? " soon" : ""}"><span class="ct-duebell" aria-hidden="true">🔔</span><span><b>Final Payment ${fd < 0 ? "Was Due" : "Due"}</b>
        <span class="ct-duedate">${esc(prettyDate(tr.finalDue))}, ${esc(tr.finalDue.slice(0, 4))} (${fd >= 0 ? esc(inDays(fd)) : `${-fd} day${fd === -1 ? "" : "s"} ago`})</span>
        <small>${esc(ctMoney(left))} left${W.left > left ? ` on the ${fareWord}` : ""}</small></span></div>` : "";
  // What it adds up to: the cruise, then each kind of cost around it. Spent on board is on top of that total, so it sits apart.
  const cats = {}; W.costs.forEach(c => { const k = COST_CATS.some(x => x[0] === c.cat) ? c.cat : "other"; cats[k] = (cats[k] || 0) + Number(c.amt); });
  const row = (ic, l, n) => `<div class="ct-mrow"><span class="ct-mic" aria-hidden="true">${CT_ICONS[ic]}</span><span class="grow">${esc(l)}</span><b>${esc(ctMoney(n))}</b></div>`;
  const spent = tripSpent(tr), rows = [W.fare > 0 && row("ship", trCruise(tr) ? "Cruise Fare" : "Trip Cost", W.fare),
    ...CT_COSTS.filter(([k]) => cats[k] > 0).map(([k, ic, l]) => row(ic, l, cats[k])),
    spent > 0 && `<div class="ct-mrow ct-monb"><span class="ct-mic" aria-hidden="true">${CT_ICONS.card}</span><span class="grow">${trCruise(tr) ? "Onboard Spending" : "Trip Spending"}<small>On top of the trip total</small></span><b>${esc(ctMoney(spent))}</b></div>`].filter(Boolean);
  const longest = Math.max(...[W.total, W.paid, W.left].map(n => ctMoney(n).length));   // a big number with cents stays in its box
  return `<section class="ct-money" aria-label="Payments"><div class="ct-stats${longest > 8 ? " tiny" : longest > 6 ? " mid" : ""}"><div><small>Trip Total</small><b>${esc(ctMoney(W.total))}</b></div>
      <div class="paid"><small>Paid</small><b>${esc(ctMoney(W.paid))}</b></div><div class="left"><small>Left to Pay</small><b>${esc(ctMoney(W.left))}</b></div></div>${due}
      ${rows.length ? `<div class="ct-mlist">${rows.join("")}</div>` : ""}${ctPulseHtml(tr)}</section>`;
}
const CT_COSTS = [["travel", "plane", "Flights & Travel"], ["hotel", "house", "Hotel"], ["parking", "car", "Parking"], ["excursion", "palm", "Excursions"], ["package", "ticket", "Packages"], ["insurance", "doc", "Insurance"], ["other", "receipt", "Other"]];
// The board's Spending Pulse line: what the tab's own pulse says, in one line, and it opens that tab.
function ctPulseHtml(tr) {
  if (typeof spendPulse !== "function") return "";
  const P = spendPulse(tr), ok = !!P && ["ok", "before"].includes(P.status);
  const say = !P ? "Set a budget and see your daily pace" : P.status === "over" ? "You're over your budget" : P.status === "fast" ? "Running ahead of your plan" : P.status === "before" ? `About ${ctMoney(Math.round(P.perDay))} a day` : "You're on track with your plan!";
  return `<button class="ct-pulse" data-spendgo="1"><span class="ct-mic big" aria-hidden="true">${CT_ICONS.chart}</span><span class="grow"><b>Spending Pulse</b><small>${esc(say)}</small></span>${P ? `<span class="ct-dot ${ok ? "ok" : "warn"}" aria-hidden="true">${ok ? "✓" : "!"}</span>` : CT_CHEV}</button>`;
}
// The money tools Scott's outline puts on Money (they live inside the money cards today): package / upgrade / split / bill.
function ctMoneyToolsHtml(tr) {
  if (!tr) return "";
  const cr = trCruise(tr), T = [
    cr && ["calc", "Package worth it?", 'data-pkgcalc="1"', "drinks, Wi-Fi, dining"],
    cr && ["up", "Upgrade worth it?", 'data-upopen="1"', "cabin bid or upgrade"],
    ["split", "Split the cost", `data-splitopen="${esc(tr.id)}"`, "who owes what"],
    cr && ["receipt", "Final bill check", 'data-billcheck="1"', "match the ship's bill"],
    typeof exportMoney === "function" && ["share", "Export the money", `data-moneyexport="${esc(tr.id)}"`, "CSV for a spreadsheet"]].filter(Boolean);
  return `<nav class="ct-grid ct-tools" aria-label="Money tools">${T.map(ctTileHtml).join("")}</nav>`;
}

// ---- full screens opened from More: ‹ comes back to it, a tab leaves them
let CT_SCREEN = null, CT_FROM = null, CT_LIST_FROM = null, CT_DOCS_BACK = false, CT_TAB_FROM = null;
const ctBackHtml = (t, right, attrs, ic) => `<h2 class="ct-title"><button class="ct-back" ${attrs || 'data-ctgo="back"'} aria-label="Back">‹</button><span class="grow">${ic ? `<span class="ct-titleic" aria-hidden="true">${ic}</span>` : ""}${esc(t)}${navigator.onLine === false ? `<span class="offline-pill">🟠 Offline</span>` : ""}</span>${right || ""}<button class="ct-life small" data-help="home" aria-label="Crisis Mode - help now">${CT_LIFE}</button></h2>`;

// COUNTDOWN (his board): the ship, the days as big tiles, Trip Readiness and Next Up. The checklist behind it is the old one.
function ctCountdownHtml(tr) {
  const cr = trCruise(tr), R = readiness(tr), sd = daysUntil(tr.start), end = tr.end || tr.start, ed = daysUntil(end);
  const num = sd > 0 ? sd : sd < 0 && ed >= 0 ? -sd + 1 : null;
  const lab = sd > 0 ? (cr ? (sd === 1 ? "Day to Sail" : "Days to Sail") : (sd === 1 ? "Day to Go" : "Days to Go"))
    : sd === 0 ? (cr ? "Sail Day" : "Travel Day") : ed < 0 ? "Welcome Home" : `Day ${-sd + 1} of ${Math.round((parseDay(end) - parseDay(tr.start)) / 86400000) + 1}`;
  const next = R.next && R.pct < 100 && sd >= 0 ? R.next.action.replace(/\s*\([^)]*\)/g, "") : "";
  return `<div class="ct-screen">${ctBackHtml("Countdown")}
    <section class="ct-cdhero">${cr ? `<span class="ct-cdship" aria-hidden="true">${CT_LOGO}</span>` : ""}<b class="ct-cdname">${esc(tr.name || tr.ship || (cr ? "My cruise" : "My trip"))}</b>
      <span class="ct-cdsub">${[ctWho(tr), esc(ctDates(tr))].filter(Boolean).join(" · ")}</span>
      ${num !== null ? `<span class="ct-digits">${String(num).split("").map(d => `<span class="ct-digit">${esc(d)}</span>`).join("")}</span>` : ""}<span class="ct-cdlab">${esc(lab)}</span></section>
    <button class="ct-cdcard" data-cd="open"><span class="ct-cdrow"><b>Trip Readiness</b><b class="ct-cdpct">${R.pct}%</b></span><span class="ct-bar"><i style="width:${R.pct}%"></i></span></button>
    ${next ? `<button class="ct-cdcard ct-cdnext" data-cd="open"><span class="ct-mic big" aria-hidden="true">${CT_ICONS.checklist}</span><span class="grow"><b>Next Up</b><small>${esc(next)}</small></span>${CT_CHEV}</button>` : ""}</div>`;
}

// PACKING LIST and the other trip lists. Packing groups itself for reading (nothing about the item changes); a tick or an add is the old one.
const CT_CATS = [["cruise", /lanyard|pouch|luggage tag|magnetic hook/i], ["tech", /charger|phone|cable|power bank|adapter|camera|headphone|batter|tablet|kindle|usb|\bfan\b/i],
  ["health", /toilet|sunscreen|medic|seasick|aloe|bug spray|sanitiz|razor|tooth|deodor|shampoo|lotion|bandage|first.aid|pain/i], ["clothes", /swim|cover-up|formal|outfit|shoe|sandal|flip-flop|cloth|jacket|sweater|dress|shirt|pants|shorts|socks|underwear|\bhat\b|pajama|belt/i]];
const ctCatOf = text => (CT_CATS.find(c => c[1].test(text)) || ["cruise"])[0];
const CT_OPEN = new Set();
function ctListsHtml(tr) {
  ensureLists(tr);
  const keys = tripListKeys(tr), lk = keys.includes(S.tripList) ? S.tripList : "packing", L = (tr.lists && tr.lists[lk]) || [], done = L.filter(i => i.done).length, pack = lk === "packing";
  const filt = pack && S.bagView && S.bagView !== "all" ? S.bagView : "", shown = L.filter(i => !filt || bagOf(i) === filt);
  const docs = pack && keys.includes("docs") ? tr.lists.docs || [] : [], allN = L.length + docs.length, allD = done + docs.filter(i => i.done).length;
  const row = i => `<div class="row ${i.done ? "done" : ""}"><input type="checkbox" class="tick" data-titem="${tr.id}:${lk}:${i.id}" ${i.done ? "checked" : ""} aria-label="Done"><span class="grow">${esc(i.text)}</span>${pack ? `<button class="bagchip" data-bag="${tr.id}:${i.id}" aria-label="Bag: ${bagLabel(bagOf(i))} - tap to change">${bagLabel(bagOf(i))}</button>` : ""}<button class="x" data-tripdel="${tr.id}:lists.${lk}:${i.id}" aria-label="Remove">✕</button></div>`;
  const group = (k, name, all, items, opened) => { const d = all.filter(i => i.done).length, full = all.length > 0 && d === all.length;   // the count is the whole group, whatever the bag filter shows
    return `<details class="ct-cat" data-ctcat="${k}" ${opened ? "open" : ""}><summary><span class="ct-box ${full ? "on" : ""}" aria-hidden="true">${full ? "✓" : ""}</span><b>${esc(name)}</b><span class="ct-count">${d} / ${all.length}</span>${CT_CHEV}</summary><div class="ct-catbody">${items.map(row).join("")}</div></details>`; };
  const NAMES = [["clothes", "Clothing & Shoes"], ["health", "Toiletries & Health"], ["docs", "Documents & ID"], ["tech", "Tech & Extras"], ["cruise", trCruise(tr) ? "Cruise Essentials" : "Everything Else"]];
  const docsRow = () => { if (!keys.includes("docs")) return ""; const D = tr.lists.docs || [], d = D.filter(i => i.done).length, full = D.length > 0 && d === D.length;   // the board's row: its items are the Documents list
    return `<button class="ct-cat ct-catlink" data-triplist="docs"><span class="ct-box ${full ? "on" : ""}" aria-hidden="true">${full ? "✓" : ""}</span><b>Documents & ID</b><span class="ct-count">${d} / ${D.length}</span>${CT_CHEV}</button>`; };
  const filterRow = filt ? `<button class="ct-filter" data-bagview="all"><span class="grow">Showing: <b>${bagLabel(filt)}</b></span><span class="ct-count">Show all</span></button>${shown.length ? "" : `<section class="ct-listcard"><div class="empty">Nothing in this bag yet.</div></section>`}` : "";
  const body = pack ? filterRow + NAMES.map(([k, n]) => { if (k === "docs") return docsRow(); const items = shown.filter(i => ctCatOf(i.text) === k); return items.length ? group(k, n, L.filter(i => ctCatOf(i.text) === k), items, !!filt || CT_OPEN.has(k)) : ""; }).join("")
    : `<section class="ct-listcard">${shown.map(row).join("") || `<div class="empty">Nothing on this list yet.</div>`}</section>`;
  const add = `<button class="ct-plus" data-ctgo="addfocus" aria-label="Add to this list">＋</button>`;
  const sugN = pack && typeof packSuggest === "function" ? packSuggest(tr).length : 0;
  const tabs = `<nav class="ct-listtabs" aria-label="Lists">${keys.map(k => `<button class="${k === lk ? "on" : ""}" data-triplist="${k}">${esc(TRIP_LISTS[k])}</button>`).join("")}</nav>`;   // on Packing they wait below the picture, as on his board
  return `<div class="ct-screen">${ctBackHtml(pack ? "Packing List" : TRIP_LISTS[lk], add, 'data-ctgo="listback"')}
    <section class="ct-progress"><span class="ct-cdrow"><b>${pack ? "Packing Progress" : "Progress"}</b><span>${pack ? allD : done} of ${pack ? allN : L.length}</span></span><span class="ct-bar"><i style="width:${(pack ? allN : L.length) ? Math.round((pack ? allD / allN : done / L.length) * 100) : 0}%"></i></span></section>
    ${pack ? "" : tabs}
    ${body}
    ${pack ? `<div class="ct-artgap" aria-hidden="true"></div>${tabs}` : ""}
    <form class="inline-add ct-add" data-tadd="${tr.id}:${lk}"><input name="text" placeholder="Add to ${esc(TRIP_LISTS[lk])}…" required autocomplete="off"><button class="btn sm">Add</button></form>
    ${pack ? `<details class="ct-cat ct-extras" data-ctcat="extras" ${CT_OPEN.has("extras") ? "open" : ""}><summary><span class="ct-mic" aria-hidden="true">${CT_ICONS.suitcase}</span><b>Bags + suggestions</b>${sugN ? `<span class="ct-count">${sugN} idea${sugN === 1 ? "" : "s"}</span>` : ""}${CT_CHEV}</summary><div class="ct-catbody">${packExtrasHtml(tr)}</div></details>` : ""}
    <div class="ct-artgap" aria-hidden="true"></div></div>`;
}

// ON BOARD (his board): eight tiles, each opening what Cruise Hub already has.
function ctOnBoardHtml(tr) {
  const when = !!tr.start, fun = when ? ctFunDay(tr) : "", wishes = typeof tripWish === "function" ? tripWish(tr).length : 0, ports = 'data-shellgo="explore"', live = !when || daysUntil(tr.end || tr.start) >= 0;
  const T = [["stopwatch", "First 10 Minutes", 'data-ctgo="first10"', ""], ["ship", "Ship Guide", 'data-ctgo="ship"', ""],
    ["dining", "Dining & Drinks", 'data-pkgcalc="1"', ""], ["ticket", "Shows & Activities", fun ? `data-tlday="${esc(fun)}"` : ports, ""],
    ["card", "Spending & Perks", 'data-shellgo="wallet" data-triptabgo="onboard"', ""], ["binoculars", "Fun Finder", fun ? `data-tlday="${esc(fun)}"` : ports, ""],
    live && ["sun", "Free Time Finder", fun ? `data-ctgo="day:${esc(fun)}:free"` : ports, ""], live && ["people", "Group Vote", wishes >= 2 ? `data-voteopen="${esc(tr.id)}"` : fun ? `data-ctgo="day:${esc(fun)}:free"` : ports, wishes >= 2 ? "" : "add 2 ideas first"]].filter(Boolean);
  return `<div class="ct-screen">${ctBackHtml("On Board", "", "", CT_ICONS.wheel)}<nav class="ct-grid ct-two" aria-label="On Board">${T.map(ctTileHtml).join("")}</nav><div class="ct-artgap" aria-hidden="true"></div></div>`;
}

// PORT DAYS (his board): each port with a picture for its part of the world (a mood, not a photo of that port), then Return Guard.
function ctPortArt(pt) {
  const g = typeof portGuide === "function" ? portGuide(pt.name) : null, c = `${(g && g.country) || ""} ${pt.name}`;
  if (/alaska|juneau|ketchikan|skagway|sitka|norway|iceland|glacier|canada|greenland/i.test(c)) return "port_alaska";
  if (/italy|spain|greece|france|croatia|turkey|portugal|malta|montenegro|england|germany|netherlands|denmark|sweden|estonia|finland/i.test(c)) return "port_europe";
  if (/mexico|cozumel|costa maya|belize|honduras|roat|mahogany/i.test(c)) return "port_ruins";
  let h = 0; for (const ch of String(pt.name)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return ["port_beach", "port_pier", "port_island"][h % 3];
}
function ctPortsHtml(tr, cardHtml) {
  if (!trCruise(tr)) return exploreHtml(cardHtml);                         // an Other trip keeps its own Things to Do
  const ports = (tr.ports || []).slice().sort((a, b) => a.day.localeCompare(b.day)); ensurePortWx(tr);
  const card = pt => { const g = typeof portGuide === "function" && portGuide(pt.name), n = tr.start ? Math.round((parseDay(pt.day) - parseDay(tr.start)) / 86400000) + 1 : 0;
    const times = pt.arrive && pt.allAboard ? `${hm(pt.arrive)} – ${hm(aaLocal(pt))}` : pt.allAboard ? `all aboard ${hm(aaLocal(pt))}` : "";
    return `<button class="ct-port" data-tlday="${esc(pt.day)}">${S.photo === false ? "" : `<img src="art/${ctPortArt(pt)}.webp" alt="" loading="lazy" width="88" height="66">`}<span class="grow"><b>${esc(pt.name)}${g && g.country && !String(pt.name).includes(g.country) ? `, ${esc(g.country)}` : ""}</b>
      <small class="ct-portwhen">${n > 0 ? `Day ${n} • ${esc(times || prettyDate(pt.day))}` : `${esc(prettyDate(pt.day))}${times ? ` • ${esc(times)}` : ""}`}</small>${portWxText(pt) ? `<small>${portWxText(pt)}</small>` : ""}${pt.excursion && pt.excursion.toLowerCase() !== "none" ? `<small>${esc(pt.excursion)}</small>` : ""}</span>${CT_CHEV}</button>`; };
  const g = guardFor(tr), noTime = ports.find(p => !p.allAboard), remOn = !!S.remind.on && can("reminders");   // no reminders = no alert (app.js checkReminders), so never a green On
  const [guardAttr, guardSay, guardPill, guardOk] = g ? ['data-rg="open"', "Running now. Tap for your time back", "Now", true]
    : noTime ? [`data-tlday="${esc(noTime.day)}"`, "Add your all-aboard times and it can warn you", "Add times", false]
    : !remOn ? ['data-ctgo="reminders"', "Turn reminders on and it can warn you on the day", "Turn on", false]
    : ['data-ctgo="reminders"', "Heads up when it's time to head back to the ship", "On", true];
  const guardBody = `<span class="ct-mic big" aria-hidden="true">${CT_ICONS.ship}</span><span class="grow"><b>Return Guard</b><small>${guardSay}</small></span><span class="ct-pill ${guardOk ? "on" : ""}${guardPill === "On" ? " ct-switch" : ""}">${guardPill}</span>`;
  return `${ports.length ? `<section class="ct-ports">${ports.map(card).join("")}</section>` : `<section class="card"><h3>Port Days</h3><div class="body"><div class="empty">Add your port days (My Cruise → your cruise → Ports) and they show up here with weather and all-aboard times.</div></div></section>`}
    ${ports.length ? `<button class="ct-guardrow" ${guardAttr} aria-label="Return Guard: ${esc(guardPill)}. ${esc(guardSay)}">${guardBody}</button><div class="ct-artgap" aria-hidden="true"></div>` : ""}
    <details class="ct-cat my-ship" data-ctcat="ship" ${CT_OPEN.has("ship") ? "open" : ""}><summary><span class="ct-mic" aria-hidden="true">${CT_ICONS.ship}</span><b>My Ship</b>${CT_CHEV}</summary><div class="ct-catbody">${typeof shipGuideHtml === "function" ? shipGuideHtml(tr) : ""}
      <button class="btn sm ghost" data-shellgo="plan" data-triptabgo="tips">💡 Good to know</button></div></details>
    ${SHELL_CARDS.explore.map(k => cardHtml(k)).join("")}`;
}
// FIRST 10 MINUTES: the same ticks Home shows the moment you board (cruise.js), here to read ahead or come back to.
function ctFirstHtml(tr) {
  const F = tr.firstThings || {}, n = FIRST_THINGS.filter(([k]) => F[k]).length;
  return `<div class="ct-screen">` + ctBackHtml("First 10 Minutes") + `<section class="card"><h3>🎉 First things — before the crowds<span class="meta">${n}/${FIRST_THINGS.length}</span></h3><div class="body">
    ${FIRST_THINGS.map(([k, l]) => `<label class="row"><input type="checkbox" class="tick" data-first="${k}" ${F[k] ? "checked" : ""}><span class="grow">${esc(l)}</span></label>`).join("")}</div></section></div>`;
}
// CRUISE HUB PASS (Scott's batch 1, and his "clearly visible Pro status screen"): where you stand, what's syncing, what it includes.
// Never in the Play app (no Pass wording outside ⚙ there). Someone already paying is never told to pay. No price is decided here.
const ctPassOffered = () => switchOn("PRO_GATE") && !STORE_MODE;
function ctPassHtml() {
  const st = hubProState(), pro = isPro(), when = iso => { try { return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" }); } catch (e) { return ""; } };
  const row = (ic, name, state, tone) => `<div class="ct-prorow"><span aria-hidden="true">${ic}</span><span class="grow">${esc(name)}</span><b class="${tone}">${esc(state)}</b></div>`;
  const cal = !S.gcal.connected ? ["Not connected", ""] : syncOk("gcal") ? [S.gcal.pushed ? `On · sent ${when(S.gcal.pushed)}` : "On", "on"] : ["Paused", "soon"];
  const bak = !S.sync.on ? ["Off", ""] : syncOk("sync") ? [S.sync.last ? `On · saved ${when(S.sync.last)}` : "On", "on"] : ["Paused", "soon"];
  const ben = ["🗓️ Your trip, payments and port days on your phone's calendar", switchOn("GMAIL") && "📬 Your cruise booking found in your email", "☁️ Backup to your own Google Drive", `📱 Works on up to ${PLAN.MAX_PHONES} phones`].filter(Boolean);
  const rec = proEndsRec() || lapsedRec(), own = cruisePass() && rec.product !== "dayhub";   // someone on Day Hub Pro renews Day Hub Pro, never a product they didn't buy
  const url = own ? PLAN.CRUISE_CHECKOUT_URL : PLAN.WHOP_CHECKOUT_URL, price = own ? `${PLAN.CRUISE_YEARLY} — every cruise you take that year` : `${PLAN.MONTHLY} or ${PLAN.YEARLY}`, plan = own ? proName() : PLAN.NAME;
  return `<div class="ct-screen">` + ctBackHtml(proName()) + `<section class="ct-prohero ${st.tone}"><span class="ct-k">Status</span><b>${esc(st.word)}</b><small>${esc(st.say)}</small></section>
    <section class="card"><h3>🔄 Your sync</h3><div class="body">${row("🗓️", "Google Calendar", cal[0], cal[1])}${row("☁️", "Drive backup", bak[0], bak[1])}</div></section>
    <section class="card"><h3>⭐ What it includes</h3><div class="body"><ul class="ct-prolist">${ben.map(x => `<li>${esc(x)}</li>`).join("")}</ul>
      <p class="fine" style="margin:8px 0 0">Everything else — countdown, payments, ports and all-aboard alarms, onboard spending, perks, lists, tips — is free forever. No ads, ever.</p></div></section>
    <div class="ct-probtns">${st.buy ? `<a class="ct-big ct-probuy" href="${esc(url)}" target="_blank" rel="noopener">${esc(st.buy)} ${esc(plan)}</a><p class="ct-price">${esc(price)}</p>` : ""}
      <button class="ct-big ct-promanage" data-ctgo="passsettings">${pro ? "Manage on this phone" : st.buy ? "Already bought? Enter your email" : "Check on this phone"}</button></div></div>`;
}

// Called by shell.js shellHtml() while the new look is on: the lifesaver header on every tab + the tab's content.
function ctShellHtml(cardHtml) {
  ctPreloadArt();
  const tr = curTrip(), packing = TAB === "plan" && PLAN_VIEW === "packing" && !!tr && !CT_SCREEN;
  const list = packing && (tripListKeys(tr).includes(S.tripList) ? S.tripList : "packing");
  const sc = CT_SCREEN === "pass" ? (ctPassOffered() ? "pass" : null) : tr && (CT_SCREEN !== "countdown" || tr.start) ? CT_SCREEN : null;   // a cruise pasted from an email can have no dates yet
  // Port Days and Payments & Budget are full screens on his board too: their own title and picture, back to Home, no tab bar.
  const portsScreen = !sc && !packing && TAB === "explore" && !!tr && trCruise(tr), moneyScreen = !sc && !packing && TAB === "wallet" && !!tr;
  document.body.dataset.ctscreen = sc || (packing ? (list === "packing" ? "packing" : "lists") : portsScreen ? "ports" : moneyScreen ? "money" : "");
  CT_LEVELS = ctLevels(sc, packing, portsScreen, moneyScreen); ctSyncSoon();
  document.body.classList.toggle("ct-noart", S.photo === false);           // ⚙ Real photo off: no pictures behind the screens
  if (sc === "countdown") return ctCountdownHtml(tr);
  if (sc === "onboard") return ctOnBoardHtml(tr);
  if (sc === "pass") return ctPassHtml();
  if (sc === "first10") return ctFirstHtml(tr);
  if (packing) return ctListsHtml(tr);
  if (TAB === "home") return homeHtml();                                   // homeHtml() hands over to ctHomeHtml()
  const top = `<section class="ct-band">${ctTopHtml(false)}</section>`;
  const addBtn = `<button class="ct-plus" data-ctgo="fab" aria-label="Add something">＋</button>`;   // the same add sheet as the floating +, which would sit on a tile or a dollar figure here
  const homeBack = (t, ic) => `<div class="ct-screen">${ctBackHtml(t, addBtn, 'data-ctgo="tabback"', ic)}</div>`;
  const cards = () => SHELL_CARDS[TAB].filter(k => k !== "inbox" || S.mail.on || S.mail.found.length).map(k => cardHtml(k)).join("");
  if (TAB === "ai") return top + ctMoreHtml();
  if (portsScreen) return homeBack("Port Days", CT_ICONS.pin) + ctPortsHtml(tr, cardHtml);
  if (TAB === "explore") return top + (tr ? ctPortsHtml(tr, cardHtml) : exploreHtml(cardHtml));
  if (TAB === "plan") return top + planHtml(cardHtml);
  if (moneyScreen) return homeBack("Payments & Budget", CT_ICONS.wallet) + ctMoneyTopHtml(tr) + `<div class="ct-artgap" aria-hidden="true"></div>` + ctMoneyToolsHtml(tr) + cards();
  return top + (TAB === "wallet" ? ctMoneyTopHtml(tr) + ctMoneyToolsHtml(tr) : "") + cards();
}

// Taps that belong to the new look only.
// Open a Settings box and bring it up.
function ctSettingsAt(id) { openSettings(); setTimeout(() => { const el = document.getElementById(id); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); }, 60); }
// Open a day's screen at one of its tools.
function ctDayAt(d, what) {
  showDay(d);
  setTimeout(() => { const sh = document.getElementById("daySheet"); if (!sh) return;
    const el = what === "drive" ? sh.querySelector(".drive-box, .drive-add") : [...sh.querySelectorAll(".day-label")].find(x => /Free time/.test(x.textContent));
    if (el) { if (el.tagName === "DETAILS") el.open = true; el.scrollIntoView({ behavior: "smooth", block: "start" }); } }, 60);
}
document.addEventListener("click", e => {
  const sg = e.target.closest && e.target.closest("button[data-shellgo], button[data-readygo]");   // Open my trip (the checklist) goes to a tab too
  const lg = e.target.closest && e.target.closest('button[data-planview="packing"], button[data-triplistgo]');
  if (lg) { CT_LIST_FROM = TAB; CT_DOCS_BACK = false; if (ctOn() && !lg.dataset.triplistgo) S.tripList = "packing"; }   // ‹ on a list goes back where it came from; a way in called Packing opens Packing, not the list last looked at
  if (e.target.closest && e.target.closest(".ct-catlink")) CT_DOCS_BACK = true;   // Documents & ID reads as part of Packing
  if (sg) { const to = sg.dataset.shellgo;                                  // Money or Port Days opened from another screen: its ‹ goes back there
    CT_TAB_FROM = ctOn() && (to === "wallet" || to === "explore") && !sg.closest("#tabbar") && (CT_SCREEN || TAB !== "home") ? { tab: TAB, screen: CT_SCREEN } : null;
    CT_SCREEN = null; CT_FROM = null;                                       // a tab or a tile that goes to one leaves a full screen
    if (ctOn() && sg.closest("#tabbar")) { CT_LIST_FROM = null; CT_DOCS_BACK = false; if (PLAN_VIEW === "packing") PLAN_VIEW = "trip"; } }   // a tab leaves the list; My Cruise opens My Cruise, not the list you left
  if (ctOn() && e.target.closest) {
    const gh = e.target.closest("button[data-ghgo]");                       // Get me home's Open: Home has no card to open, so go to the list or the perks
    if (gh) { const k = gh.dataset.ghgo, from = CT_SCREEN || TAB !== "home" ? { tab: TAB, screen: CT_SCREEN } : null; setTimeout(() => { CT_SCREEN = null; CT_FROM = null; if (k === "perks") { CT_TAB_FROM = from; shellGo("wallet"); const c = document.querySelector('#cards [data-card="trips"]'); if (c) c.scrollIntoView({ block: "start" }); } else { CT_LIST_FROM = TAB; PLAN_VIEW = "packing"; shellGo("plan"); } }, 0); }
    if (e.target.closest("button[data-cwx]")) setTimeout(() => { if (TAB !== "explore") shellGo("explore"); const c = document.querySelector('#cards [data-card="weather"]'); if (c) c.scrollIntoView({ block: "start" }); }, 0);   // the weather card lives on Port Days here
  }
  if (ctOn() && e.target.closest && e.target.closest(".ct-screen button[data-triplist]")) setTimeout(() => window.scrollTo({ top: 0 }), 0);   // on Packing the list tabs sit past the picture; My Cruise's list tiles stay where they are
  if (ctOn() && e.target.closest && e.target.closest("button[data-spendgo], button[data-triptabgo]")) setTimeout(() => { const c = document.querySelector('#cards [data-card="trips"]'); if (c) c.scrollIntoView({ behavior: "smooth", block: "start" }); }, 60);   // the card sits below the tools
  const b = e.target.closest && e.target.closest("button[data-ctgo]");
  if (!b) return;
  const go = b.dataset.ctgo;
  if (go === "back") { CT_SCREEN = CT_FROM; CT_FROM = null; render(); window.scrollTo({ top: 0 }); return; }
  if (go === "tabback") { const f = CT_TAB_FROM; CT_TAB_FROM = null; if (!f) { shellGo("home"); return; } CT_SCREEN = f.screen; shellGo(f.tab); return; }
  if (go === "listback") { if (CT_DOCS_BACK) { CT_DOCS_BACK = false; S.tripList = "packing"; render(); window.scrollTo({ top: 0 }); return; }
    const to = CT_LIST_FROM || "home"; CT_LIST_FROM = null; PLAN_VIEW = "trip"; shellGo(to); return; }
  if (go === "pass" || go === "first10" || go === "countdown" || go === "onboard") { CT_FROM = CT_SCREEN; CT_SCREEN = go; render(); window.scrollTo({ top: 0 }); return; }
  if (go === "fab") { const f = document.getElementById("fab"); if (f) f.click(); return; }
  if (go === "addfocus") { const f = document.querySelector(".ct-add input"); if (f) { f.scrollIntoView({ behavior: "smooth", block: "center" }); f.focus(); } return; }
  if (go === "reminders") { ctSettingsAt("remindBox"); return; }
  if (go === "passsettings") { ctSettingsAt("proBox"); return; }
  if (go.startsWith("day:")) { const [, d, what] = go.split(":"); ctDayAt(d, what); return; }
  if (go === "settings") { if (typeof openSettings === "function") openSettings(); return; }
  if (go === "classic") { try { localStorage.setItem(CT_KEY, "classic"); } catch (e2) { /* private mode */ } CT_SCREEN = null; render(); window.scrollTo({ top: 0 }); toast("Classic look on this phone"); return; }
  if (go === "ship") { CT_OPEN.add("ship"); CT_TAB_FROM = { tab: TAB, screen: CT_SCREEN }; CT_SCREEN = null; CT_FROM = null; shellGo("explore"); setTimeout(() => { const el = document.querySelector("#cards .my-ship"); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); }, 60); }
});
// Any other copy on his phone: five quick taps on the app's name at the bottom of Settings flip the look, whatever browser it lives in.
let CT_NAME_TAPS = [];
document.addEventListener("click", e => {
  const b = e.target.closest && e.target.closest("#sheet p.fine > b");
  if (!b || !/Marvel Corp app/.test(b.textContent) || typeof MODE === "undefined" || MODE !== "cruise") return;
  const now = Date.now(); CT_NAME_TAPS = CT_NAME_TAPS.filter(x => now - x < 3000).concat(now);
  if (CT_NAME_TAPS.length < 5) return;
  CT_NAME_TAPS = []; const on = !ctOn();
  try { localStorage.setItem(CT_KEY, on ? "tiles" : "classic"); localStorage.setItem("cruisehub.ownerlook", "1"); } catch (e2) { /* private mode */ }
  if (on && S.simple) S.simple = false;
  CT_SCREEN = null; closeSettings(); render(); window.scrollTo({ top: 0 }); toast(on ? "New look on for this phone" : "Classic look on this phone");
});
// A folded packing group stays as you left it when a tick redraws the screen.
document.addEventListener("toggle", e => { const d = e.target; if (!d || !d.dataset || !d.dataset.ctcat || (S.bagView && S.bagView !== "all" && d.dataset.ctcat !== "extras" && d.dataset.ctcat !== "ship")) return; if (d.open) CT_OPEN.add(d.dataset.ctcat); else CT_OPEN.delete(d.dataset.ctcat); }, true);
// The phone's own back button walks the same path as the arrow on screen. An open sheet closes first, a plain tab goes to Home, and only Home leaves the app.
// One step of history per press it takes to reach Home, added at the tap that opened the screen: Chrome skips a step a page adds with no tap, so a back press never adds one.
// Never on the old look, so customers are untouched.
let CT_LEVELS = 0, CT_DEPTH = 0, CT_SKIP = 0, CT_SYNC_T = 0;
function ctLevels(sc, packing, ports, money) {
  const up = t => t && t !== "home" ? 1 : 0;
  if (sc) return 1 + (CT_FROM ? 1 : 0) + up(TAB);
  if (packing) return 1 + (CT_DOCS_BACK ? 1 : 0) + up(CT_LIST_FROM);
  if (ports || money) { const f = CT_TAB_FROM; return 1 + (f ? (f.screen ? 1 : 0) + up(f.tab) : 0); }
  return up(TAB);
}
function ctSyncHistory() {
  CT_SYNC_T = 0;
  if (CT_SKIP || typeof MODE === "undefined" || MODE !== "cruise") return;   // steps being taken away: their popstate runs this again
  const want = ctOn() ? CT_LEVELS + (document.querySelector(".sheet:not(.hidden)") ? 1 : 0) : 0;
  try {
    if (want && "scrollRestoration" in history) history.scrollRestoration = "manual";   // closing a sheet leaves the screen where it was
    while (CT_DEPTH < want) history.pushState({ ct: ++CT_DEPTH }, "");
    if (CT_DEPTH > want) { CT_SKIP++; setTimeout(() => { CT_SKIP = 0; }, 1500); history.go(want - CT_DEPTH); CT_DEPTH = want; }
  } catch (e) { CT_DEPTH = want; /* some browsers limit this; the arrow still works */ }
}
function ctSyncSoon() { if (!CT_SYNC_T) CT_SYNC_T = setTimeout(ctSyncHistory, 0); }   // after every handler and redraw of this tap has run
document.addEventListener("click", ctSyncSoon);
window.addEventListener("popstate", () => {
  if (CT_SKIP) { CT_SKIP--; ctSyncSoon(); return; }
  if (typeof MODE === "undefined" || MODE !== "cruise" || !ctOn()) return;
  CT_DEPTH = Math.max(0, CT_DEPTH - 1);
  const open = [...document.querySelectorAll(".sheet:not(.hidden)")];
  if (open.length) { open.forEach(el => { const x = el.querySelector("[data-close]"); if (x) x.click(); else el.classList.add("hidden"); }); ctSyncSoon(); return; }
  const arrow = document.querySelector("#cards .ct-back");
  if (arrow) { arrow.click(); ctSyncSoon(); return; }
  if (TAB !== "home") { shellGo("home"); ctSyncSoon(); return; }
  if (history.state && history.state.ct) history.back();                   // a step left over from before a reload: keep walking out
});
