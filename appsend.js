/* SAVE AS: appsend.js · LOCATION: C:/MarvelApps/dayhub/appsend.js
 * SEND AN APP - the last row of every app list: pick any Marvel Corp app and send it to anyone (Scott 11/24: "all apps at bottom of app
 * list need to be able to forward app install to anyone but sending them to app on whop").
 *
 * ONE file and ONE list of apps for every app list:
 *   - every Hub (Hub family card + Settings -> Hub family): ui.js puts <div data-appsend="<this app>"></div> at the end of the list and
 *     loads this file;
 *   - any other page: put <div data-appsend="<this app id>"></div> where the row goes and <script src="/dayhub/appsend.js" defer></script>.
 * The row fills itself in (also when the page draws a new list later). Tap Send: the phone's share menu (text, email, Messenger...) with
 * the app's name, one line about it and its link; a phone with no share menu copies the link instead.
 * THE LINK: the app's Whop page. An app with no Whop page yet goes to its own page. Inside a Google Play app (data-store="1", or the
 * page was opened by the Play app) it is ALWAYS the app's own page - Google's payments rule: no Whop link in a Play app.
 * Nothing is stored or sent by this file.
 * A new app = one line in APPS (keep it the same as UseMart's api/src/apps.ts and Scott Hub's SH_APPS).
 */
(function () {
  "use strict";
  if (window.appSend) return;
  const HUB = "https://smarvel1963-ops.github.io", WHOP = "https://whop.com/commander-marvel-por-picks";
  // [id, name, icon, one line, own page, Whop page ("" = none yet)]
  const APPS = [
    ["dayhub", "Day Hub", "☀️", "Your whole day on one screen - schedule, weather, to-dos and bills together.", HUB + "/dayhub/", WHOP + "/day-hub-pro"],
    ["cruisehub", "Cruise Hub", "🚢", "Every cruise, planned on your phone.", HUB + "/cruisehub/", WHOP + "/cruise-hub-pass"],
    ["triphub", "Trip Hub", "✈️", "Flights, hotels and road trips - sorted.", HUB + "/triphub/", WHOP + "/trip-hub-pass"],
    ["homehub", "Home Hub", "🏡", "Know your home. Fix it. Improve it. Protect it.", HUB + "/homehub/", ""],
    ["autohub", "Auto Hub", "🚗", "Every car you own, looked after - type the VIN and it fills itself in.", HUB + "/autohub/", WHOP + "/auto-hub-pro"],
    ["moneyhub", "Money Hub", "💰", "What you have, what's coming, what you can afford.", HUB + "/moneyhub/", WHOP + "/money-hub-pro"],
    ["healthhub", "Health Hub", "❤️", "Meds, readings, steps, sleep and appointments in one place.", HUB + "/healthhub/", ""],
    ["familyhub", "Family Hub", "👨‍👩‍👧", "Your whole family in one place - calendar, chores, lists, messages and photos.", HUB + "/familyhub/", WHOP + "/family-hub-a5"],
    ["pethub", "Pet Hub", "🐾", "Every pet's care and life story - birthdays, daily care, the vet, shots and memories.", HUB + "/pethub/", ""],
    ["cookinghub", "Cooking Hub", "🍳", "Tell it what you have and it finds dinner - recipes, cook along, meal plans and your family's cookbook.", HUB + "/cookinghub/", WHOP + "/cooking-hub-44"],
    ["jobhub", "Job Hub", "💼", "Your next job, found - today's openings matched to you, a resume studio and your applications in one place.", HUB + "/jobhub/", WHOP + "/job-hub-marvel"],
    ["hubuniverse", "Hub Universe", "🌌", "Every Hub app on your phone, in one place.", HUB + "/hubuniverse/", ""],
    ["marvelmagic", "Marvel Magic", "📺", "One guide for everything you watch - your streaming services, live TV, free channels and sports.", HUB + "/marvelmagic/", WHOP + "/marvel-magic"],
    ["photohub", "Photo Hub", "📷", "Your photos and videos, safe and sorted - backup, albums, places and a private vault.", HUB + "/hubs/photohub/", ""],
    ["usemart", "UseMart", "🛒", "Buy and sell near you - local listings, bargains, stores and wanted posts.", "https://usemart.net/#getapp", ""],
  ].map(([id, name, icon, line, page, whop]) => ({ id, name, icon, line, page, whop }));

  const css = document.createElement("style");
  css.id = "asStyle";
  css.textContent =
    ".as-row{display:flex;align-items:center;gap:10px;margin-top:10px;padding:10px 0 2px;border-top:1px solid rgba(127,127,127,.25)}" +
    ".as-ic{font-size:20px;line-height:1}.as-grow{flex:1;min-width:0;display:flex;flex-direction:column;gap:5px}" +
    ".as-grow small{opacity:.75;font-size:12.5px;line-height:1.3}" +
    ".as-pick{font:inherit;font-size:15px;color:inherit;background:rgba(127,127,127,.12);border:1px solid rgba(127,127,127,.35);border-radius:9px;padding:7px 8px;max-width:100%}" +
    ".as-pick option{color:#111;background:#fff}" +
    ".as-go{font:inherit;font-weight:700;font-size:14px;border:0;border-radius:10px;padding:9px 14px;background:#5b4cf0;color:#fff;cursor:pointer;flex:none}" +
    ".as-go:active{transform:scale(.97)}";
  (document.head || document.documentElement).appendChild(css);

  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  function playApp(el) {
    if (el && el.dataset.store === "1") return true;
    try { return /[?&]src=play(&|$)/.test(location.search) || sessionStorage.getItem("hub.store") === "play"; }   // the Hubs' STORE_MODE flag (features.js)
    catch (e) { return false; }
  }
  function linkFor(app, el) { return (!playApp(el) && app.whop) || app.page; }
  function fill(el) {
    if (el.__as) return;
    el.__as = true;
    const me = el.dataset.appsend || "";
    el.innerHTML = `<div class="as-row"><span class="as-ic" aria-hidden="true">📤</span><div class="as-grow"><b>Send an app to someone</b>` +
      `<small>Pick one. They get its link in a text, email or message.</small>` +
      `<select class="as-pick" aria-label="App to send">${APPS.map(a => `<option value="${a.id}"${a.id === me ? " selected" : ""}>${a.icon} ${esc(a.name)}</option>`).join("")}</select></div>` +
      `<button type="button" class="as-go" data-asgo="1">Send</button></div>`;
  }
  function scan(root) {
    if (!root || root.nodeType !== 1) return;
    if (root.matches("[data-appsend]")) fill(root);
    root.querySelectorAll("[data-appsend]").forEach(fill);
  }
  let noteT = 0;
  function note(msg) {
    let t = document.getElementById("asNote");
    if (!t) { t = document.createElement("div"); t.id = "asNote"; t.setAttribute("role", "status"); t.setAttribute("aria-live", "polite");
      t.style.cssText = "position:fixed;left:50%;bottom:calc(18px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);z-index:2147483647;max-width:calc(100vw - 32px);" +
        "padding:9px 14px;border-radius:12px;background:rgba(20,22,34,.92);color:#fff;font:500 14px/1.35 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;pointer-events:none";
      document.body.appendChild(t); }
    t.textContent = msg; t.hidden = false;
    clearTimeout(noteT); noteT = setTimeout(() => { t.hidden = true; }, 2800);
  }
  async function send(el) {
    const pick = el.querySelector(".as-pick"), app = APPS.find(a => a.id === (pick && pick.value)) || APPS[0];
    const url = linkFor(app, el), text = `${app.name} - ${app.line}`;
    try { if (navigator.share) { await navigator.share({ title: app.name, text, url }); return "shared"; } }
    catch (e) { if (e && e.name === "AbortError") return "cancel"; }
    try { await navigator.clipboard.writeText(text + "\n" + url); note("📋 Link copied - paste it in a text, email or message"); return "copied"; }
    catch (e) { note(url); return "shown"; }
  }
  document.addEventListener("click", e => {
    const b = e.target.closest && e.target.closest("[data-asgo]"); if (!b) return;
    const el = b.closest("[data-appsend]"); if (!el) return;
    e.preventDefault(); e.stopPropagation();
    send(el);
  }, true);

  window.appSend = { apps: APPS, linkFor, scan, version: "1.0" };
  function boot() {
    scan(document.body);
    new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(scan))).observe(document.body, { childList: true, subtree: true });
  }
  if (document.body) boot(); else document.addEventListener("DOMContentLoaded", boot, { once: true });
})();
