/*
 * SAVE AS: magicfeed.js   LOCATION: C:/MarvelApps/dayhub/magicfeed.js
 *
 * v1.62 NEW ON TV - FROM MARVEL MAGIC (Scott 11/14: "so we have hot new marvel magic movie and tv ap so any of our app the an plug about
 * new shows or anything like that should be coming from this app to those" -> "Yes, build it" for Day, Family and Money Hub).
 * THE RULE: a show / movie / "new on TV" mention in any Hub comes from Marvel Magic and every tap opens Marvel Magic. No Hub has a TV
 * source of its own. The list is Marvel Magic's "Coming Soon - HOT" (premieres + new seasons, next 3 weeks), published as
 * marvelmagic/new_on_tv.json by marvelmagic/tools/build_new_on_tv.py (a GitHub job, twice a day). Listings: TVmaze (credit shown).
 * Where:
 *   - Day Hub: Home in the evening and at night (classic look: the Tomorrow card) - what's new this week
 *   - Family Hub: Home - "Family Night", kid-safe shows only (Marvel Magic's own kids rule, set in the file)
 *   - Money Hub: Subscriptions - what's new on the services you pay for (shown only when one of them matches)
 * Never in the Google Play apps (store mode): Marvel Magic has its own membership, and the Play apps point to no outside purchase.
 * Reads only, on this phone: the file (kept 6 hours, shared by every Hub on this site), and - when Marvel Magic was opened in this
 * same browser - the services ticked there (mm_mine) and its Kids Lock (mm_kids). Nothing is ever written to Marvel Magic.
 * ui.js mfLoad() fetches this file for Day, Family and Money only.
 */
const MF_URL = new URL("../marvelmagic/new_on_tv.json", BASE_URL).href;
const MF_APP = new URL("../marvelmagic/", BASE_URL).href;
const MF_KEY = "hubs.newontv", MF_TTL = 6 * 3600000;
let MF = null, MF_BUSY = false, MF_TRIED = 0;

// Someone is typing: a field has focus, or a box on the page holds words that weren't there when it was drawn.
function mfTyping(root) {
  const a = document.activeElement;
  if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) return true;
  return !!root && [...root.querySelectorAll("input, textarea")].some(el => !/^(checkbox|radio|hidden|submit|button|file)$/.test(el.type) && el.value !== el.defaultValue);
}
function mfSaved() {
  try { const c = JSON.parse(localStorage.getItem(MF_KEY) || "null"); return c && c.feed && Array.isArray(c.feed.shows) ? c : null; } catch (e) { return null; }
}
function mfFetch() {
  if (MF_BUSY || Date.now() - MF_TRIED < 10 * 60000) return;     // offline: try again in 10 minutes, not on every draw
  MF_BUSY = true; MF_TRIED = Date.now();
  fetch(MF_URL, { cache: "no-cache" }).then(r => r.ok ? r.json() : null).then(j => {
    if (!j || !Array.isArray(j.shows)) return;
    MF = j;
    try { localStorage.setItem(MF_KEY, JSON.stringify({ at: Date.now(), feed: j })); } catch (e) { /* full: still shows this time */ }
    // Redraw only when nobody is typing: a redraw empties a half-filled form (the next draw shows the card anyway).
    try { if (!mfTyping(document.getElementById("cards"))) render(); } catch (e) { /* the next draw shows it */ }
    try { if (MODE === "money" && typeof MH_OPEN !== "undefined" && MH_OPEN && MH_TAB === "subs" && !mfTyping(document.getElementById("mhSheet"))) showMh(); } catch (e) { /* reopened later */ }   // an open Subscriptions page
  }).catch(() => {}).then(() => { MF_BUSY = false; });
}
function mfFeed() {
  if (!MF) { const c = mfSaved(); if (c) { MF = c.feed; if (Date.now() - c.at >= MF_TTL) mfFetch(); } else mfFetch(); }
  else { const c = mfSaved(); if (!c || Date.now() - c.at >= MF_TTL) mfFetch(); }
  return MF;
}
const mfMM = k => { try { return JSON.parse(localStorage.getItem("mm_" + k) || "null"); } catch (e) { return null; } };   // Marvel Magic's own (same site)
const mfAt = x => x.prem ? x.prem.at : x.next;
const mfImg = u => typeof u === "string" && /^https:\/\/static\.tvmaze\.com\//.test(u) ? u : "";

// The shows to offer: inside `days`, kids-only when asked (or Marvel Magic's Kids Lock is on here), only the given services when asked,
// otherwise the person's own Marvel Magic services when they ticked some here (all of them when none of theirs has anything).
function mfShows(o = {}) {
  const F = mfFeed(); if (!F) return [];
  const now = Date.now(), end = now + (o.days || 7) * 86400000, kidsLock = !!((mfMM("kids") || {}).on), mine = mfMM("mine");
  let L = F.shows.filter(x => x && x.name && isFinite(mfAt(x)) && mfAt(x) >= now - 12 * 3600000 && mfAt(x) < end && (!x.lang || x.lang === "English"));   // streaming lists carry other countries' shows: English only
  if (o.kids || kidsLock) L = L.filter(x => x.kids);
  if (o.svcs) L = L.filter(x => x.svc && o.svcs.includes(x.svc));
  else if (Array.isArray(mine) && mine.length) { const y = L.filter(x => x.free || (x.svc && mine.includes(x.svc))); if (y.length) L = y; }
  return L.sort((a, b) => (a.prem ? 0 : 1) - (b.prem ? 0 : 1) || mfAt(a) - mfAt(b)).slice(0, o.max || 4);
}
function mfWhen(x) {
  const d = Math.round((new Date(new Date(mfAt(x)).toDateString()) - new Date(new Date().toDateString())) / 86400000);
  const day = d <= 0 ? "Today" : d === 1 ? "Tomorrow" : d < 7 ? new Date(mfAt(x)).toLocaleDateString([], { weekday: "short" }) : new Date(mfAt(x)).toLocaleDateString([], { month: "short", day: "numeric" });
  return x.prem ? `${x.prem.season > 1 ? `Season ${x.prem.season}` : "New series"} · ${day}` : `New episode · ${day}`;
}
function mfStyle() {
  if (document.getElementById("mfStyle")) return;
  const s = document.createElement("style"); s.id = "mfStyle";
  s.textContent = `.mf-card{margin:12px 0;padding:12px}.mf-card:not(.card):not(.fh-card){border-radius:14px;border:1px solid rgba(127,127,127,.25);background:rgba(127,127,127,.07)}
.mf-head{display:flex;align-items:baseline;justify-content:space-between;gap:8px;margin-bottom:8px}.mf-head h3{margin:0;font-size:1rem}
.mf-from{font-size:.8rem;white-space:nowrap;color:inherit;opacity:.8}.mf-row{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}
.mf-show{display:flex;flex-direction:column;gap:2px;color:inherit;text-decoration:none;min-width:0}
.mf-show img,.mf-noimg{width:100%;aspect-ratio:2/3;object-fit:cover;border-radius:8px;background:rgba(127,127,127,.18);display:flex;align-items:center;justify-content:center;font-size:1.6rem}
.mf-show b{font-size:.78rem;line-height:1.15;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.mf-show small,.mf-show em{font-size:.7rem;opacity:.75;font-style:normal;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mf-credit{margin:8px 0 0;font-size:.68rem;opacity:.65}.mf-credit a{color:inherit}`;
  document.head.appendChild(s);
}
// One card, the same everywhere. `cls` lets a Hub use its own card frame (Day Hub's solid home card, Family Hub's card).
function mfCardHtml(title, L, cls = "") {
  if (!L.length) return "";
  mfStyle();
  const go = `href="${esc(MF_APP)}" target="_blank" rel="noopener"`;
  return `<section class="mf-card ${cls}" data-mf="1" aria-label="${esc(title)} - from Marvel Magic">
    <div class="mf-head"><h3>${esc(title)}</h3><a class="mf-from" ${go}>from Marvel Magic ›</a></div>
    <div class="mf-row">${L.map(x => `<a class="mf-show" ${go} aria-label="${esc(`${x.name}, ${mfWhen(x)}${x.svc || x.net ? ", on " + (x.svc || x.net) : ""}. Opens Marvel Magic`)}">
      ${mfImg(x.img) ? `<img src="${esc(mfImg(x.img))}" alt="" loading="lazy">` : `<span class="mf-noimg" aria-hidden="true">🎬</span>`}
      <b>${esc(x.name)}</b><small>${esc(mfWhen(x))}</small>${x.svc || x.net ? `<em>${esc(x.svc || x.net)}</em>` : ""}</a>`).join("")}</div>
    <p class="mf-credit"><a href="https://www.tvmaze.com/" target="_blank" rel="noopener">Listings: TVmaze</a></p></section>`;
}
const mfOn = () => typeof STORE_MODE === "undefined" || !STORE_MODE;

// Day Hub: what's new this week (Home in the evening / at night, in the same solid card as Top 3; the classic look's Tomorrow card)
function mfDayHtml(where) {
  if (MODE !== "day" || !mfOn()) return "";
  return mfCardHtml("🎬 New on TV this week", mfShows({ days: 7 }), where === "home" ? "card" : "");
}
// Family Hub: kid-safe only
function mfFamilyHtml() {
  if (MODE !== "family" || !mfOn()) return "";
  return mfCardHtml("🍿 Family Night - New on TV", mfShows({ days: 14, kids: true }), "fh-card");
}
// Money Hub: new on the services you pay for (the active subscriptions whose name matches a Marvel Magic service)
const MF_SVC = [[/netflix/i, "Netflix"], [/hulu/i, "Hulu"], [/disney/i, "Disney+"], [/peacock/i, "Peacock"], [/paramount/i, "Paramount+"],
  [/\bhbo\b|\bmax\b/i, "HBO Max"], [/prime video|amazon prime|\bprime\b/i, "Prime Video"], [/apple ?tv/i, "Apple TV"], [/\bespn/i, "ESPN"], [/fox one/i, "Fox One"]];
function mfSubsHtml(subs) {
  if (MODE !== "money" || !mfOn()) return "";
  const svcs = [...new Set((subs || []).filter(s => s && !s.off).map(s => (MF_SVC.find(([re]) => re.test(String(s.name || ""))) || [])[1]).filter(Boolean))];
  if (!svcs.length) return "";
  return mfCardHtml("🎬 New on what you pay for", mfShows({ days: 14, svcs }));
}
if (MODE === "family" && typeof fhMod === "function") fhMod({ id: "tv", today: () => [70, mfFamilyHtml()] });   // Family Hub's Home sections (family.js FH_MODS)
if (mfOn()) mfFeed();   // get the list now, so it's here before a page that shows it opens
