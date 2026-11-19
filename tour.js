/* SAVE AS: tour.js · LOCATION: C:/MarvelApps/dayhub/tour.js
 * HOW IT WORKS (Scott 11/18: "do we want tutorial in all apps" -> "Yes, build it"): a short tour, 4 cards, in every Hub
 * (Day, Cruise, Trip, Home, Auto, Money, Health, Family, Pet, Cooking, Job Hub, Hub Universe).
 *   Card 1 is the Hub's own icon and welcome, cards 2-3 its two best features, card 4 where the data lives + where to find the tour again.
 * It opens on its own ONCE: the first time a Hub opens on a phone (nothing of that Hub saved there yet - app.js tourMaybe). People who
 *   already use a Hub never get it on their own; anyone can open it from Settings -> How it works.
 * Skip, Back, Next, the dots, a swipe, the arrow keys, Esc and the phone's back button all work.
 * Loaded only when it's needed (app.js openTour), so no Hub gets heavier. Its look is here too (injected once).
 * No prices and no Pro words: the Google Play apps show the same cards. The colours and features match each Hub's Share the Magic page.
 */
"use strict";
const TOUR_AGAIN = "Find this tour again: ⚙ Settings → How it works";
const TOUR_END = ["🔒", "Yours, on this phone", "What you add stays on this phone. Save a copy any time in ⚙ Settings, under My data."];
// [colour, deep colour, welcome line, [emoji, title, text] x2, optional own last card]
const TOUR_APPS = {
  dayhub: ["#f59e0b", "#3b1a7a", "Your whole day on one screen: schedule, weather, to-dos and bills together.", [
    ["🧠", "Say it once", "Brain dump: type or say what's on your mind, and Day Hub sorts it into plans, to-dos and bills."],
    ["⏰", "Your morning brief", "Open Day Hub in the morning for today's plan, the weather and what to bring. Reminders keep you on time."]]],
  cruisehub: ["#06b6d4", "#1e3a8a", "Every cruise, planned on your phone - from booking day to the last port.", [
    ["⏳", "Count down and pay on time", "Add your cruise and watch the days count down. Cruise Hub reminds you before the final payment is due."],
    ["⚓", "Port days, handled", "Every port with its times and an all-aboard alarm, plus ship and port guides and packing by bag."]]],
  triphub: ["#a855f7", "#1e1b4b", "Flights, hotels and road trips - sorted, in one place.", [
    ["📋", "Paste a confirmation", "Paste a booking email and Trip Hub turns it into your flights and stays."],
    ["🛫", "Leave on time", "Leave-by times, Fix My Trip when plans change, and the cost split with your group."]]],
  homehub: ["#14b8a6", "#134e4a", "Know your home. Fix it. Improve it. Protect it.", [
    ["🛋️", "Room by room", "Every room, yard and system in one place. Add, rename or remove any of them later."],
    ["🔧", "Nothing gets missed", "Repeating reminders for the upkeep, and what your home is worth from sales near you."]]],
  autohub: ["#ef4444", "#3f1012", "Every car you own, looked after.", [
    ["🔎", "Start with the VIN", "Type the VIN and your car fills itself in: year, make and model."],
    ["🛞", "Due by miles or months", "Oil, tires and brakes come due on their own, with free safety recall checks and reminders."]]],
  moneyhub: ["#22c55e", "#064e3b", "What you have, what's coming, and what you can afford.", [
    ["✅", "Can I afford it?", "Ask before you buy: yes, tight or not yet - with the math shown."],
    ["📅", "Bills before payday", "Every bill before your next payday, and a 60-day look ahead."]],
    ["🔒", "Yours, on this phone", "Everything you type stays on this phone. Money Hub never asks for a bank password."]],
  healthhub: ["#2dd4bf", "#0f3d3a", "Meds, readings, steps, sleep and appointments in one place.", [
    ["💊", "Meds on time", "Add your meds for reminders and refill countdowns."],
    ["📊", "Easy to read", "Blood pressure, glucose and weight as easy charts; steps, sleep and water as daily rings."]],
    ["🔒", "Yours, on this phone", "Everything stays on this phone. Health Hub keeps your own records and general information - it is not medical advice."]],
  familyhub: ["#2e86de", "#3b1d6e", "One family. One place. Everything organized.", [
    ["📅", "One family calendar", "Everyone's plans and your shared lists, in one place."],
    ["⭐", "Chores, with rewards", "Chores kids check off, family messages, photos and a family tree."]],
    ["👨‍👩‍👧", "Bring everyone in", "Invite each person with their own code, and everyone's phone stays in step. Your family's information is shared only with the phones you invite."]],
  pethub: ["#f97316", "#4a1d0f", "Every pet's care and life story - one page for each of your animals.", [
    ["🎂", "Birthdays and daily care", "Birthday countdowns for every pet, plus daily care, meds and shot reminders."],
    ["🩺", "Vet and passport", "Vet visits, weight and a pet passport, all in one place."]]],
  cookinghub: ["#d9442e", "#5a1a0e", "Recipes, what's for dinner, your pantry and your family's own cookbook - all in one kitchen.", [
    ["🥘", "Dinner Finder", "Tell it what you have and it shows what you can make."],
    ["👩‍🍳", "Cook Along", "One step at a time, with timers. Keep the family favorites in your own cookbook."]]],
  jobhub: ["#e2b04a", "#0c1a3e", "Your next move starts here.", [
    ["🔭", "Matched to you", "Today's openings matched to what you're looking for, with the reasons."],
    ["🎯", "Resume to offer", "Career Fit and Resume Studio, then every application in your pipeline, with interview reminders."]]],
  hubuniverse: ["#6366f1", "#1e1b4b", "Every Hub app on your phone, in one place.", [
    ["🪐", "Your hubs orbit you", "Each hub shows what's going on now. Open any Hub app on this phone and it lights up here."],
    ["🔔", "What needs you", "What needs you across all your hubs, and today across everything in one timeline."]],
    ["🔒", "Read, never changed", "Hub Universe reads your other Hub apps on this phone and never changes them."]],
};
const TOUR = { i: 0, back: null, hist: 0, skip: 0, x: null };
const tourApp = () => TOUR_APPS[APP_ID] || TOUR_APPS.dayhub;
function tourCards() {
  const [, , hello, feats, end] = tourApp();
  const name = typeof APP_NAME === "string" ? APP_NAME : "Day Hub";
  return [[null, MODE === "cooking" ? "Welcome, Chef!" : `Welcome to ${name}`, hello], ...feats, end || TOUR_END];
}
function tourCss() {
  if (document.getElementById("tourCss")) return;
  const st = document.createElement("style"); st.id = "tourCss";
  st.textContent = `
#tourSheet { position: fixed; inset: 0; z-index: 9500; display: grid; place-items: center; padding: 16px; box-sizing: border-box; color: #fff;
  font-family: Inter, -apple-system, "Segoe UI", Roboto, Arial, sans-serif; background: rgba(5, 4, 16, .78); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); }
#tourSheet.hidden { display: none; }
body.tour-on { overflow: hidden; }
.tour-card { position: relative; width: 100%; max-width: 400px; min-width: 0; box-sizing: border-box; padding: 22px 22px 18px; border-radius: 28px; overflow: hidden;
  border: 1.5px solid var(--ta); touch-action: pan-y;
  background: radial-gradient(circle at 50% -10%, color-mix(in srgb, var(--ta) 45%, transparent) 0%, transparent 62%), linear-gradient(170deg, var(--td), #07060f 92%);
  box-shadow: 0 24px 60px rgba(0, 0, 0, .55), 0 0 26px color-mix(in srgb, var(--ta) 35%, transparent); }
@supports not (background: color-mix(in srgb, red 50%, blue)) { .tour-card { background: linear-gradient(170deg, var(--td), #07060f 92%); box-shadow: 0 24px 60px rgba(0, 0, 0, .55); } }
.tour-top { display: flex; align-items: center; justify-content: space-between; gap: 10px; min-height: 34px; }
.tour-step { margin: 0; font-size: 13px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: rgba(255, 255, 255, .72); }
.tour-skip { border: 0; background: rgba(255, 255, 255, .12); color: #fff; font: inherit; font-size: 15px; font-weight: 700; padding: 7px 14px; border-radius: 999px; cursor: pointer; }
.tour-slide { text-align: center; padding: 8px 2px 4px; min-height: 360px; display: flex; flex-direction: column; align-items: center; }
.tour-art { width: 128px; height: 128px; margin: 10px 0 18px; border-radius: 50%; display: grid; place-items: center; flex: none;
  background: radial-gradient(circle, rgba(255, 255, 255, .16), rgba(255, 255, 255, .03) 70%); border: 2px solid var(--ta);
  box-shadow: 0 0 0 8px rgba(255, 255, 255, .04), 0 0 34px color-mix(in srgb, var(--ta) 55%, transparent); }
.tour-art span { font-size: 64px; line-height: 1; }
.tour-art img { width: 96px; height: 96px; border-radius: 24px; display: block; }
.tour-slide h2 { margin: 0 0 10px; font-size: 26px; line-height: 1.15; font-weight: 800; letter-spacing: -.01em; overflow-wrap: break-word; max-width: 100%; }
.tour-slide p { margin: 0; font-size: 17px; line-height: 1.45; color: rgba(255, 255, 255, .9); max-width: 330px; overflow-wrap: break-word; }
.tour-slide small { display: block; margin-top: 16px; font-size: 14px; line-height: 1.35; color: var(--ta); font-weight: 700; }
.tour-dots { display: flex; justify-content: center; gap: 8px; margin: 14px 0 16px; }
.tour-dots button { width: 10px; height: 10px; padding: 0; border: 0; border-radius: 999px; background: rgba(255, 255, 255, .3); cursor: pointer; transition: width .2s, background .2s; }
.tour-dots button[aria-current="step"] { width: 28px; background: var(--ta); }
.tour-nav { display: flex; gap: 10px; }
.tour-nav button { flex: 1; min-height: 52px; border-radius: 16px; font: inherit; font-size: 18px; font-weight: 800; cursor: pointer; }
.tour-back { border: 1.5px solid rgba(255, 255, 255, .35); background: transparent; color: #fff; }
.tour-back[hidden] { display: none; }
.tour-next { flex: 2 !important; border: 0; background: var(--ta); color: #10091f; box-shadow: 0 8px 20px color-mix(in srgb, var(--ta) 40%, transparent); }
.tour-slide.in-r { animation: tourInR .28s ease-out; } .tour-slide.in-l { animation: tourInL .28s ease-out; }
@keyframes tourInR { from { opacity: 0; transform: translateX(28px); } to { opacity: 1; transform: none; } }
@keyframes tourInL { from { opacity: 0; transform: translateX(-28px); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) { .tour-slide.in-r, .tour-slide.in-l { animation: none; } .tour-dots button { transition: none; } }
@media (max-height: 640px) { .tour-art { width: 96px; height: 96px; margin: 4px 0 12px; } .tour-art span { font-size: 48px; } .tour-art img { width: 72px; height: 72px; border-radius: 18px; }
  .tour-slide { min-height: 330px; } .tour-slide h2 { font-size: 23px; } .tour-slide p { font-size: 16px; } }
@media (max-width: 360px) { .tour-card { padding: 18px 16px 14px; } .tour-slide h2 { font-size: 23px; } }`;
  document.head.appendChild(st);
}
function tourHtml(dir) {
  const C = tourCards(), n = C.length, i = TOUR.i, [ic, title, text] = C[i], last = i === n - 1;
  const art = ic === null ? `<img src="icon-192.png" alt="">` : `<span aria-hidden="true">${ic}</span>`;
  return `<div class="tour-card">
    <div class="tour-top"><p class="tour-step">${i + 1} of ${n}</p><button class="tour-skip" data-tourbtn="skip">${last ? "Close" : "Skip"}</button></div>
    <section class="tour-slide ${dir ? "in-" + dir : ""}" aria-live="polite">
      <div class="tour-art">${art}</div><h2 id="tourTitle">${esc(title)}</h2><p>${esc(text)}</p>${last ? `<small>${esc(TOUR_AGAIN)}</small>` : ""}</section>
    <div class="tour-dots">${C.map((c, k) => `<button data-tourgo="${k}" aria-label="Card ${k + 1} of ${n}"${k === i ? ` aria-current="step"` : ""}></button>`).join("")}</div>
    <div class="tour-nav"><button class="tour-back" data-tourbtn="back"${i ? "" : " hidden"}>Back</button>
      <button class="tour-next" data-tourbtn="next">${last ? "Let's go" : "Next"}</button></div></div>`;
}
function tourDraw(dir) {
  const el = document.getElementById("tourSheet"); if (!el) return;
  el.innerHTML = tourHtml(dir);
  const nx = el.querySelector(".tour-next"); if (nx) try { nx.focus({ preventScroll: true }); } catch (e) { nx.focus(); }
}
function tourGo(k) {
  const n = tourCards().length; k = Math.max(0, Math.min(n - 1, k));
  if (k === TOUR.i) return; const dir = k > TOUR.i ? "r" : "l"; TOUR.i = k; tourDraw(dir);
}
function tourOpen(auto) {
  tourCss();
  let el = document.getElementById("tourSheet");
  if (!el) { el = document.createElement("div"); el.id = "tourSheet"; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-labelledby", "tourTitle"); document.body.appendChild(el); tourWire(el); }
  if (!el.classList.contains("hidden") && el.innerHTML) return;
  const sh = document.getElementById("sheet"); if (sh && !sh.classList.contains("hidden") && typeof closeSettings === "function") closeSettings();
  try { localStorage.setItem(TOUR_KEY, new Date().toISOString().slice(0, 10)); } catch (e) { /* private mode: it just may show again */ }
  TOUR.i = 0; TOUR.back = document.activeElement; TOUR.auto = !!auto;
  el.style.setProperty("--ta", tourApp()[0]); el.style.setProperty("--td", tourApp()[1]);
  el.setAttribute("aria-label", `How ${typeof APP_NAME === "string" ? APP_NAME : "Day Hub"} works`);
  el.classList.remove("hidden"); document.body.classList.add("tour-on");
  try { history.pushState({ tour: 1 }, ""); TOUR.hist = 1; } catch (e) { /* the back arrow still works */ }
  tourDraw("");
}
function tourClose(fromPop) {
  const el = document.getElementById("tourSheet"); if (!el || el.classList.contains("hidden")) return;
  el.classList.add("hidden"); el.innerHTML = ""; document.body.classList.remove("tour-on");
  if (!fromPop && TOUR.hist) { TOUR.hist = 0; TOUR.skip = 1; try { history.back(); } catch (e) { TOUR.skip = 0; } }
  const b = TOUR.back; TOUR.back = null; if (b && b.isConnected && typeof b.focus === "function") try { b.focus({ preventScroll: true }); } catch (e) { /* gone */ }
}
function tourWire(el) {
  el.addEventListener("click", e => {
    e.stopPropagation();                                                   // the Hub's own tap handler never sees a tap on the tour
    const t = e.target.closest("[data-tourbtn], [data-tourgo]");
    if (!t) { if (e.target === el) tourClose(); return; }               // a tap outside the card closes it
    if (t.dataset.tourgo !== undefined) return tourGo(Number(t.dataset.tourgo));
    const d = t.dataset.tourbtn, n = tourCards().length;
    if (d === "skip") return tourClose();
    if (d === "back") return tourGo(TOUR.i - 1);
    if (d === "next") return TOUR.i >= n - 1 ? tourClose() : tourGo(TOUR.i + 1);
  });
  el.addEventListener("pointerdown", e => { TOUR.x = e.target.closest(".tour-card") ? [e.clientX, e.clientY] : null; });
  el.addEventListener("pointerup", e => {
    if (!TOUR.x) return; const dx = e.clientX - TOUR.x[0], dy = e.clientY - TOUR.x[1]; TOUR.x = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) tourGo(TOUR.i + (dx < 0 ? 1 : -1));
  });
  el.addEventListener("keydown", e => {
    if (["Escape", "ArrowRight", "ArrowLeft"].includes(e.key)) { e.preventDefault(); e.stopPropagation(); }   // the Hub's own keys stay out of it
    if (e.key === "Escape") return tourClose();
    if (e.key === "ArrowRight") return tourGo(TOUR.i + 1);
    if (e.key === "ArrowLeft") return tourGo(TOUR.i - 1);
    if (e.key === "Tab") {                                                 // keep the keyboard inside the tour
      const f = [...el.querySelectorAll("button:not([hidden])")]; if (!f.length) return;
      const k = f.indexOf(document.activeElement);
      if (e.shiftKey && k <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && k === f.length - 1) { e.preventDefault(); f[0].focus(); }
    }
  });
}
if (typeof window !== "undefined") window.addEventListener("popstate", () => {
  if (TOUR.skip) { TOUR.skip = 0; return; }
  const el = document.getElementById("tourSheet"); if (el && !el.classList.contains("hidden")) { TOUR.hist = 0; tourClose(true); }
});
