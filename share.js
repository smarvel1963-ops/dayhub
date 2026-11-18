/* SAVE AS: share.js · LOCATION: C:/MarvelApps/dayhub/share.js
 * SHARE THE MAGIC (Scott 11/06 "Share this app" button -> 11/18 his Share the Magic design + "Yes, build part 1").
 * One page in every Hub (Day, Cruise, Trip, Home, Auto, Money, Health, Family, Pet, Cooking, Job Hub, Hub Universe) behind a ✨ button:
 *   pick a picture to share (the app itself + one picture per best feature), a ready message they can edit, the app's own link
 *   (copied in) with an optional QR code, and where to share it: Text, Messenger, Facebook, Facebook Groups, Instagram, TikTok, X,
 *   Telegram - or the phone's own share menu. Preview & Share shows exactly what goes out first.
 * Loaded only when someone taps ✨ (app.js openShareMagic), so no Hub gets heavier. Its look is here too (injected once).
 * HONEST ABOUT THE APPS: Instagram and TikTok take no posts from other apps - the picture is saved and the message copied, then
 *   the app opens and they post it there. Facebook / Groups / Messenger open with the link; the message is copied to paste.
 * Costs nothing: no AI, no server. Part 2 (Scott's yes first): AI pitch styles (credits), referral counts (a counter on a server).
 * The QR code is drawn on the phone (qrcodejs, cdnjs) - offline, the picture just goes out without it.
 */
"use strict";
if (typeof CanvasRenderingContext2D !== "undefined" && !CanvasRenderingContext2D.prototype.roundRect) {   // older iPhones (Safari 15) draw a plain box
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) { r = Math.min(r || 0, w / 2, h / 2); this.moveTo(x + r, y); this.arcTo(x + w, y, x + w, y + h, r);
    this.arcTo(x + w, y + h, x, y + h, r); this.arcTo(x, y + h, x, y, r); this.arcTo(x, y, x + w, y, r); this.closePath(); };
}
// [name, colour, second colour, emoji, tagline, [feature, emoji] x3]
const STM_APPS = {
  dayhub: ["Day Hub", "#f59e0b", "#7c3aed", "☀️", "Your whole day on one screen.", [["Schedule, weather, to-dos and bills together", "🗓️"], ["Brain dump: say it once, it sorts itself", "🧠"], ["A morning brief and reminders", "⏰"]]],
  cruisehub: ["Cruise Hub", "#06b6d4", "#1e3a8a", "🚢", "Every cruise, planned on your phone.", [["Countdown, payments and due dates", "⏳"], ["Port days with all-aboard alarms", "⚓"], ["Ship and port guides, packing by bag", "🧳"]]],
  triphub: ["Trip Hub", "#a855f7", "#1e1b4b", "✈️", "Flights, hotels and road trips - sorted.", [["Paste a confirmation, get your bookings", "📋"], ["Leave-by times and Fix My Trip when plans change", "🛫"], ["Split the cost with your group", "🤝"]]],
  homehub: ["Home Hub", "#14b8a6", "#134e4a", "🏡", "Know your home. Fix it. Improve it. Protect it.", [["Every room, yard and system in one place", "🛋️"], ["Repeating reminders so nothing gets missed", "🔧"], ["What your home is worth, from sales near you", "📈"]]],
  autohub: ["Auto Hub", "#ef4444", "#3f1012", "🚗", "Every car you own, looked after.", [["Type the VIN and your car fills itself in", "🔎"], ["Oil, tires and brakes due by miles or months", "🛞"], ["Free safety recall checks and reminders", "🛡️"]]],
  moneyhub: ["Money Hub", "#22c55e", "#064e3b", "💰", "What you have, what's coming, what you can afford.", [["All your accounts in one picture", "🏦"], ["Can I afford it? Yes, tight or not yet - with the math", "✅"], ["Bills before payday and a 60-day forecast", "📅"]]],
  healthhub: ["Health Hub", "#2dd4bf", "#0f3d3a", "❤️", "Meds, readings, steps, sleep and appointments in one place.", [["Meds with reminders and refill countdowns", "💊"], ["Blood pressure, glucose and weight as easy charts", "📊"], ["Steps, sleep and water as daily rings", "🏃"]]],
  familyhub: ["Family Hub", "#2e86de", "#3b1d6e", "👨‍👩‍👧", "Your whole family in one place.", [["One family calendar and shared lists", "📅"], ["Chores kids check off, with rewards", "⭐"], ["Family messages, photos and a family tree", "💬"]]],
  pethub: ["Pet Hub", "#f97316", "#4a1d0f", "🐾", "Every pet's care and life story.", [["Birthday countdowns for every pet", "🎂"], ["Daily care, meds and shot reminders", "🦮"], ["Vet visits, weight and a pet passport", "🩺"]]],
  cookinghub: ["Cooking Hub", "#d9442e", "#5a1a0e", "🍳", "Tell it what you have and it finds dinner.", [["Dinner Finder: what you can make with what you have", "🥘"], ["Cook Along: one step at a time, with timers", "👩‍🍳"], ["Your family's own cookbook", "📕"]]],
  jobhub: ["Job Hub", "#e2b04a", "#0c1a3e", "💼", "Your next job, found.", [["Today's openings matched to you, with the reasons", "🔭"], ["Career Fit and Resume Studio", "🎯"], ["Your pipeline, with interview reminders", "📊"]]],
  hubuniverse: ["Hub Universe", "#6366f1", "#1e1b4b", "🌌", "Every Hub app on your phone, in one place.", [["Your hubs orbit you, each with what's going on now", "🪐"], ["What needs you, across all of them", "🔔"], ["Today across everything, in one timeline", "🕒"]]],
};
const STM_TARGETS = [["text", "Text", "#22c55e"], ["messenger", "Messenger", "#7c4dff"], ["facebook", "Facebook", "#1877f2"], ["groups", "FB Groups", "#1d5fd1"],
  ["instagram", "Instagram", "#e1306c"], ["tiktok", "TikTok", "#111111"], ["x", "X", "#111111"], ["telegram", "Telegram", "#229ed9"]];
const STM_GLYPH = {
  text: '<path d="M12 4C7 4 3 7.4 3 11.6c0 2.3 1.2 4.4 3.2 5.8L5.5 21l4.1-2.1c.8.2 1.6.3 2.4.3 5 0 9-3.4 9-7.6S17 4 12 4z" fill="#fff"/>',
  messenger: '<path d="M12 3C7 3 3 6.7 3 11.4c0 2.6 1.3 4.9 3.3 6.4V21l3-1.7c.9.2 1.8.4 2.7.4 5 0 9-3.7 9-8.3S17 3 12 3z" fill="#fff"/><path d="M6.5 14l3.6-3.8 2 2 3.7-2.2-3.6 3.8-2-2z" fill="#7c4dff"/>',
  facebook: '<path d="M14 8h3V4.5h-3c-2.5 0-4 1.6-4 4V11H7.5v3.5H10V21h3.6v-6.5H16l.6-3.5h-3V9c0-.6.4-1 1-1z" fill="#fff"/>',
  groups: '<circle cx="12" cy="8.5" r="3" fill="#fff"/><circle cx="6" cy="10" r="2.2" fill="#fff"/><circle cx="18" cy="10" r="2.2" fill="#fff"/><path d="M6.5 19c.5-3.5 2.8-5.5 5.5-5.5s5 2 5.5 5.5zM2 18c.3-2.3 1.7-3.6 3.6-3.6 1 0 1.8.3 2.4.9-.9 1-1.5 2.1-1.7 3.4zM22 18c-.3-2.3-1.7-3.6-3.6-3.6-1 0-1.8.3-2.4.9.9 1 1.5 2.1 1.7 3.4z" fill="#fff"/>',
  instagram: '<rect x="4" y="4" width="16" height="16" rx="5" fill="none" stroke="#fff" stroke-width="2"/><circle cx="12" cy="12" r="3.8" fill="none" stroke="#fff" stroke-width="2"/><circle cx="17" cy="7" r="1.2" fill="#fff"/>',
  tiktok: '<path d="M14 3h3c.2 2 1.6 3.6 3.6 3.8v3c-1.4 0-2.6-.4-3.6-1.1V15a5.5 5.5 0 11-5.5-5.5c.3 0 .6 0 .9.1v3.1a2.5 2.5 0 102 2.4z" fill="#25f4ee" transform="translate(-.6 .5)"/><path d="M14 3h3c.2 2 1.6 3.6 3.6 3.8v3c-1.4 0-2.6-.4-3.6-1.1V15a5.5 5.5 0 11-5.5-5.5c.3 0 .6 0 .9.1v3.1a2.5 2.5 0 102 2.4z" fill="#fe2c55" transform="translate(.6 -.5)"/><path d="M14 3h3c.2 2 1.6 3.6 3.6 3.8v3c-1.4 0-2.6-.4-3.6-1.1V15a5.5 5.5 0 11-5.5-5.5c.3 0 .6 0 .9.1v3.1a2.5 2.5 0 102 2.4z" fill="#fff"/>',
  x: '<path d="M4 4h4.5l4 5.6L17.2 4H20l-6.2 7.2L20.5 20H16l-4.3-6-5.1 6H3.8l6.6-7.6z" fill="#fff"/>',
  telegram: '<path d="M20.5 4.5 3.6 11c-1 .4-1 1.1-.2 1.3l4.3 1.4 1.6 5c.2.6.4.8.9.8.4 0 .6-.2.9-.5l2.1-2 4.4 3.2c.8.5 1.4.2 1.6-.8l2.9-13.6c.3-1.2-.4-1.7-1.5-1.3zM9 13.4l8.6-5.4-6.8 6.3-.3 3z" fill="#fff"/>',
  share: '<path d="M12 3.5v11M7.5 8 12 3.5 16.5 8M5 12.5v6A1.5 1.5 0 006.5 20h11a1.5 1.5 0 001.5-1.5v-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  link: '<path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M16 8V5.5A1.5 1.5 0 0014.5 4h-9A1.5 1.5 0 004 5.5v9A1.5 1.5 0 005.5 16H8" fill="none" stroke="currentColor" stroke-width="2"/>',
  plane: '<path d="M21 3 3 10.5l7 2.5 2.5 7z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M21 3 10 13" stroke="currentColor" stroke-width="2"/>',
  back: '<path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>',
  info: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 11v6M12 7.5h.01" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>' };
const stmSvg = (k, cls = "") => `<svg class="stm-g ${cls}" viewBox="0 0 24 24" aria-hidden="true">${STM_GLYPH[k] || ""}</svg>`;
let STM = { pick: 0, target: "", qr: true, msg: "", img: "", qrCanvas: null, qrBusy: false, preview: false };

function stmApp() {
  const a = STM_APPS[typeof APP_ID !== "undefined" ? APP_ID : "dayhub"] || STM_APPS.dayhub;
  const link = typeof HOME_URL !== "undefined" ? HOME_URL : location.href.split(/[?#]/)[0];
  return { name: a[0], c1: a[1], c2: a[2], emoji: a[3], tag: a[4], feats: a[5], link, icon: new URL("icon-512.png", link).href };
}
const stmScreens = A => [{ k: "home", title: A.name, sub: A.tag, emoji: A.emoji }, ...A.feats.map(([f, e]) => ({ k: "feat", title: f, sub: A.name, emoji: e }))];
const stmPitch = A => `Check out ${A.name} by Marvel Corp - ${A.tag.replace(/\.$/, "")}. ${A.feats[0][0]}. Free to try:`;
const stmMessage = A => `${(STM.msg || stmPitch(A)).trim()} ${A.link}`;

// ---------------------------------------------------------------- the share picture (1080 x 1350, drawn on the phone)
function stmLoadImg(src) { return new Promise(res => { const i = new Image(); i.crossOrigin = "anonymous"; i.onload = () => res(i); i.onerror = () => res(null); i.src = src; }); }
let STM_ICON = null;
function stmQrLib() {
  if (typeof QRCode !== "undefined") return Promise.resolve(true);
  return new Promise(res => { const s = document.createElement("script"); s.src = "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"; s.onload = () => res(true); s.onerror = () => res(false); document.head.appendChild(s); });
}
async function stmQr(link) {
  if (STM.qrCanvas && STM.qrCanvas.link === link) return STM.qrCanvas.c;
  if (!(await stmQrLib()) || typeof QRCode === "undefined") return null;
  const d = document.createElement("div"); d.style.cssText = "position:fixed;left:-9999px;top:0"; document.body.appendChild(d);
  try { new QRCode(d, { text: link, width: 300, height: 300, colorDark: "#111133", colorLight: "#ffffff", correctLevel: QRCode.CorrectLevel.M }); } catch (e) { d.remove(); return null; }
  const c = d.querySelector("canvas"); d.remove(); if (!c) return null;
  STM.qrCanvas = { link, c }; return c;
}
function stmWrap(ctx, text, maxW) {
  const words = String(text).split(/\s+/), lines = []; let line = "";
  words.forEach(w => { const t = line ? line + " " + w : w; if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t; });
  if (line) lines.push(line); return lines;
}
async function stmDraw(A, s) {
  const W = 1080, H = 1350, c = document.createElement("canvas"); c.width = W; c.height = H; const x = c.getContext("2d");
  const g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, A.c2); g.addColorStop(.55, "#1a1046"); g.addColorStop(1, "#0b0726"); x.fillStyle = g; x.fillRect(0, 0, W, H);
  const glow = x.createRadialGradient(W * .75, H * .22, 20, W * .75, H * .22, 620); glow.addColorStop(0, A.c1 + "cc"); glow.addColorStop(1, A.c1 + "00"); x.fillStyle = glow; x.fillRect(0, 0, W, H);
  const glow2 = x.createRadialGradient(W * .1, H * .9, 10, W * .1, H * .9, 520); glow2.addColorStop(0, "#f2c14e55"); glow2.addColorStop(1, "#f2c14e00"); x.fillStyle = glow2; x.fillRect(0, 0, W, H);
  for (let i = 0; i < 60; i++) { x.fillStyle = `rgba(255,236,170,${(Math.sin(i * 12.9) + 1) * .18})`; x.beginPath(); x.arc((i * 137) % W, (i * 251) % (H * .6), (i % 3) + 1.5, 0, 7); x.fill(); }
  x.textAlign = "center"; x.fillStyle = "#f6d88e"; x.font = "800 34px Inter, Arial, sans-serif"; x.fillText("M A R V E L   C O R P", W / 2, 84);
  if (!STM_ICON) STM_ICON = await stmLoadImg(A.icon);
  const iy = 130, is = s.k === "home" ? 300 : 200;
  x.save(); x.shadowColor = A.c1; x.shadowBlur = 60; x.fillStyle = "#ffffff22"; x.beginPath(); x.roundRect((W - is) / 2 - 10, iy - 10, is + 20, is + 20, 64); x.fill(); x.restore();
  if (STM_ICON) { x.save(); x.beginPath(); x.roundRect((W - is) / 2, iy, is, is, 56); x.clip(); x.drawImage(STM_ICON, (W - is) / 2, iy, is, is); x.restore(); }
  x.strokeStyle = "#f2c14e"; x.lineWidth = 6; x.beginPath(); x.roundRect((W - is) / 2, iy, is, is, 56); x.stroke();
  let y = iy + is + 110;
  x.fillStyle = "#ffffff"; x.font = "900 96px Inter, Arial, sans-serif"; x.fillText(A.name.toUpperCase(), W / 2, y);
  x.fillStyle = "#dbe3f7"; x.font = "500 38px Inter, Arial, sans-serif"; x.fillText("by Marvel Corp", W / 2, y + 56); y += 150;
  if (s.k === "home") {
    const gg = x.createLinearGradient(0, y - 60, 0, y); gg.addColorStop(0, "#fff3c4"); gg.addColorStop(1, "#f2c14e"); x.fillStyle = gg; x.font = "italic 800 60px Inter, Arial, sans-serif";
    stmWrap(x, A.tag, W - 160).forEach(l => { x.fillText(l, W / 2, y); y += 72; }); y += 20;
    x.textAlign = "left"; x.font = "600 42px Inter, Arial, sans-serif";
    A.feats.forEach(([f, e]) => { const L = stmWrap(x, f, W - 300); x.fillStyle = "#2fe0c0"; x.fillText("✓", 130, y); x.fillStyle = "#ffffff"; L.forEach(l => { x.fillText(l, 190, y); y += 54; }); y += 14; });
    x.textAlign = "center";
  } else {
    x.font = "170px 'Segoe UI Emoji', 'Apple Color Emoji', 'Noto Color Emoji', sans-serif"; x.fillText(s.emoji, W / 2, y + 120); y += 230;
    const gg = x.createLinearGradient(0, y - 60, 0, y + 120); gg.addColorStop(0, "#fff3c4"); gg.addColorStop(1, "#f2c14e"); x.fillStyle = gg; x.font = "900 66px Inter, Arial, sans-serif";
    stmWrap(x, s.title, W - 140).forEach(l => { x.fillText(l, W / 2, y); y += 80; });
  }
  const qr = STM.qr ? await stmQr(A.link) : null, by = H - 300;
  x.fillStyle = "rgba(255,255,255,.08)"; x.beginPath(); x.roundRect(70, by, W - 140, 240, 40); x.fill(); x.strokeStyle = "rgba(242,193,78,.6)"; x.lineWidth = 3; x.stroke();
  if (qr) { x.fillStyle = "#fff"; x.beginPath(); x.roundRect(100, by + 25, 190, 190, 18); x.fill(); x.drawImage(qr, 110, by + 35, 170, 170); }
  x.textAlign = qr ? "left" : "center"; const tx = qr ? 330 : W / 2;
  x.fillStyle = "#ffffff"; x.font = "800 50px Inter, Arial, sans-serif"; x.fillText(qr ? "Scan to try it free" : "Try it free", tx, by + 100);
  x.fillStyle = "#f6d88e"; x.font = "600 32px Inter, Arial, sans-serif"; stmWrap(x, A.link.replace(/^https?:\/\//, ""), qr ? W - 420 : W - 200).slice(0, 2).forEach((l, i) => x.fillText(l, tx, by + 150 + i * 40));
  return c;
}
async function stmRender() {
  const A = stmApp(), s = stmScreens(A)[STM.pick] || stmScreens(A)[0];
  const c = await stmDraw(A, s); STM.img = c.toDataURL("image/png"); STM.canvas = c;
  const im = document.querySelector("#stmSheet .stm-phone img"); if (im) im.src = STM.img;
  const pv = document.querySelector("#stmPrev img"); if (pv) pv.src = STM.img;
}
const stmBlob = () => new Promise(res => { if (!STM.canvas) return res(null); STM.canvas.toBlob(b => res(b), "image/png"); });

// ---------------------------------------------------------------- the page
function stmCss() {
  if (document.getElementById("stmCss")) return;
  const st = document.createElement("style"); st.id = "stmCss"; st.textContent = `
#stmSheet { position: fixed; inset: 0; z-index: 9000; overflow-y: auto; overflow-x: hidden; color: #fff; font-family: "Inter", system-ui, sans-serif;
  background: radial-gradient(120% 60% at 50% 0%, #4c2aa8 0%, #241263 40%, #120a3a 75%, #0a0624 100%); -webkit-overflow-scrolling: touch; }
#stmSheet.hidden { display: none; }
.stm-in { max-width: 560px; margin: 0 auto; padding: calc(10px + env(safe-area-inset-top)) 14px calc(28px + env(safe-area-inset-bottom)); position: relative; }
.stm-in::before { content: ""; position: absolute; inset: 0; pointer-events: none; background: radial-gradient(60% 30% at 80% 18%, rgba(242,193,78,.18), transparent 70%), radial-gradient(50% 30% at 10% 70%, rgba(124,77,255,.25), transparent 70%); }
.stm-top { position: relative; display: flex; align-items: center; justify-content: space-between; }
.stm-round { width: 44px; height: 44px; border-radius: 14px; border: 1.5px solid rgba(242,193,78,.7); background: rgba(20,12,60,.6); color: #f6d88e; display: grid; place-items: center; cursor: pointer; }
.stm-round .stm-g { width: 22px; height: 22px; }
.stm-mc { font: 800 15px "Inter", sans-serif; letter-spacing: 3px; color: #f6d88e; }
.stm-title { position: relative; text-align: center; margin: 8px 0 0; font: italic 900 38px/1.05 "Inter", sans-serif; letter-spacing: -.5px;
  background: linear-gradient(180deg, #fff6d0, #f6d88e 45%, #e0a93a); -webkit-background-clip: text; background-clip: text; color: transparent; filter: drop-shadow(0 0 14px rgba(242,193,78,.45)); }
.stm-title .stm-g { width: 34px; height: 34px; color: #f2c14e; vertical-align: -5px; margin-right: 6px; }
.stm-h2 { position: relative; text-align: center; font: 800 26px "Inter", sans-serif; margin: 6px 0 0; display: flex; align-items: center; gap: 12px; justify-content: center; }
.stm-h2::before, .stm-h2::after { content: ""; flex: 1; max-width: 70px; height: 1.5px; background: linear-gradient(90deg, transparent, #f6d88e); }
.stm-h2::after { transform: scaleX(-1); }
.stm-sub { position: relative; text-align: center; font: italic 500 16px "Inter", sans-serif; color: #e8e2ff; margin: 4px 0 14px; }
.stm-card { position: relative; display: grid; grid-template-columns: minmax(0, 1fr) 118px; gap: 10px; padding: 16px 14px; border-radius: 26px; border: 2px solid rgba(242,193,78,.75);
  background: linear-gradient(135deg, rgba(76,42,168,.85), rgba(24,14,70,.92)); box-shadow: 0 0 30px rgba(242,193,78,.25), inset 0 1px 0 rgba(255,255,255,.15); overflow: hidden; }
.stm-app { display: flex; align-items: center; gap: 10px; }
.stm-app img { width: 62px; height: 62px; border-radius: 16px; border: 2px solid #f2c14e; box-shadow: 0 0 16px var(--stm-c1); flex: none; }
.stm-app b { display: block; font: 900 22px/1.05 "Inter", sans-serif; letter-spacing: .5px; } .stm-app small { color: #dcd4ff; font-size: 13.5px; }
.stm-tag { margin: 12px 0 10px; font: italic 800 19px/1.25 "Inter", sans-serif; color: #fff; text-shadow: 0 2px 10px rgba(0,0,0,.5); }
.stm-get { display: flex; align-items: center; gap: 10px; min-width: 0; }
.stm-get .stm-qrbox { width: 74px; height: 74px; border-radius: 10px; background: #fff; padding: 5px; box-sizing: border-box; border: 2px solid #f2c14e; display: grid; place-items: center; color: #111; font: 700 10px Inter; }
.stm-get .stm-qrbox img, .stm-get .stm-qrbox canvas { width: 100%; height: 100%; }
.stm-get span { display: grid; gap: 1px; min-width: 0; padding: 8px 10px; border-radius: 12px; background: #000; border: 1px solid #444; } .stm-get span small { font-size: 10px; color: #ccc; } .stm-get span b { font-size: 12.5px; line-height: 1.25; overflow-wrap: anywhere; }
.stm-phone { position: relative; align-self: center; border-radius: 22px; padding: 6px; background: linear-gradient(160deg, #2b2b44, #0d0d1e); border: 2px solid rgba(242,193,78,.8); box-shadow: 0 10px 26px rgba(0,0,0,.55), 0 0 20px rgba(242,193,78,.25); transform: rotate(4deg); }
.stm-phone img { display: block; width: 100%; aspect-ratio: 1080 / 1350; border-radius: 16px; background: #1a1046; object-fit: cover; }
.stm-pickh { margin-top: 18px; }
.stm-picks { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-top: 10px; }
.stm-pick { border: 0; background: none; color: #fff; cursor: pointer; padding: 0; text-align: center; font: 700 12.5px "Inter", sans-serif; }
.stm-mini { position: relative; display: grid; place-content: center; justify-items: center; gap: 4px; aspect-ratio: 9 / 16; border-radius: 16px; padding: 6px; margin-bottom: 6px;
  background: linear-gradient(170deg, var(--stm-c2), #120a3a 70%); border: 2px solid rgba(255,255,255,.18); box-shadow: 0 6px 14px rgba(0,0,0,.4); }
.stm-mini i { font-style: normal; font-size: 26px; } .stm-mini em { font-style: normal; font: 800 9.5px/1.2 "Inter", sans-serif; color: #f6d88e; display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; overflow-wrap: break-word; text-align: center; }
.stm-pick.on .stm-mini { border-color: #f2c14e; box-shadow: 0 0 0 2px #f2c14e, 0 0 18px rgba(242,193,78,.55); }
.stm-pick.on .stm-mini::after { content: "✓"; position: absolute; top: -8px; right: -8px; width: 22px; height: 22px; border-radius: 50%; background: #f2c14e; color: #1a1408; font: 900 13px/22px Inter; }
.stm-pick.on { color: #f6d88e; }
.stm-link { display: flex; align-items: center; gap: 8px; margin-top: 16px; padding: 10px 12px; border-radius: 18px; border: 1.5px solid rgba(160,140,255,.45); background: rgba(30,18,80,.75); }
.stm-link > .stm-g { width: 22px; height: 22px; color: #f6d88e; flex: none; }
.stm-link input { flex: 1; min-width: 0; border: 0; border-radius: 12px; padding: 10px; background: #e6e0ff; color: #2b1a6e; font: 600 13.5px "Inter", sans-serif; }
.stm-copy { width: 40px; height: 40px; border-radius: 12px; border: 0; background: linear-gradient(180deg, #ffe08a, #f2c14e); color: #1a1408; display: grid; place-items: center; cursor: pointer; flex: none; }
.stm-copy .stm-g { width: 20px; height: 20px; }
.stm-qrt { display: flex; align-items: center; gap: 6px; font: 700 12.5px/1.15 "Inter", sans-serif; flex: none; cursor: pointer; }
.stm-qrt input { appearance: none; -webkit-appearance: none; width: 44px; height: 26px; border-radius: 13px; background: #3b3170; position: relative; cursor: pointer; }
.stm-qrt input::after { content: ""; position: absolute; top: 3px; left: 3px; width: 20px; height: 20px; border-radius: 50%; background: #fff; transition: transform .2s; }
.stm-qrt input:checked { background: linear-gradient(90deg, #f2c14e, #ffe08a); } .stm-qrt input:checked::after { transform: translateX(18px); }
.stm-msg { margin-top: 12px; }
.stm-msg label { display: block; font: 800 14px "Inter", sans-serif; color: #f6d88e; margin-bottom: 6px; }
.stm-msg textarea { width: 100%; box-sizing: border-box; border-radius: 16px; border: 1.5px solid rgba(160,140,255,.45); background: rgba(30,18,80,.75); color: #fff; font: 500 15px/1.4 "Inter", sans-serif; padding: 12px; resize: vertical; }
.stm-where { margin-top: 16px; padding: 14px 10px 12px; border-radius: 24px; border: 1.5px solid rgba(160,140,255,.45); background: rgba(30,18,80,.6); }
.stm-where h3 { margin: 0 0 12px; text-align: center; font: 800 22px "Inter", sans-serif; display: flex; align-items: center; justify-content: center; gap: 10px; }
.stm-where h3 .stm-g { width: 26px; height: 26px; color: #f6d88e; }
.stm-tgts { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px 6px; }
.stm-tgt { border: 0; background: none; color: #fff; display: grid; justify-items: center; gap: 6px; cursor: pointer; font: 600 12.5px "Inter", sans-serif; padding: 0; }
.stm-tgt span { width: 58px; height: 58px; border-radius: 16px; display: grid; place-items: center; box-shadow: 0 6px 14px rgba(0,0,0,.4), inset 0 1px 0 rgba(255,255,255,.25); }
.stm-tgt span .stm-g { width: 32px; height: 32px; }
.stm-tgt.ig span { background: radial-gradient(circle at 30% 107%, #fdf497 0%, #fd5949 45%, #d6249f 60%, #285aeb 90%) !important; }
.stm-tgt.on span { box-shadow: 0 0 0 3px #f2c14e, 0 0 16px rgba(242,193,78,.6); }
.stm-tgt.on { color: #f6d88e; }
.stm-cta { display: flex; align-items: center; justify-content: center; gap: 12px; width: 100%; margin-top: 18px; padding: 18px; border: 0; border-radius: 999px; cursor: pointer;
  background: linear-gradient(180deg, #fff0b8, #f2c14e 50%, #c48d22); color: #1a1408; font: 900 24px "Inter", sans-serif; box-shadow: 0 10px 26px rgba(242,193,78,.4), inset 0 2px 0 rgba(255,255,255,.6); }
.stm-cta .stm-g { width: 28px; height: 28px; }
.stm-note { display: flex; align-items: center; justify-content: center; gap: 8px; margin: 12px 0 0; font: italic 500 14px "Inter", sans-serif; color: #e8e2ff; }
.stm-note .stm-g { width: 18px; height: 18px; color: #dcd4ff; }
#stmPrev { position: fixed; inset: 0; z-index: 9100; background: rgba(6,3,20,.86); display: grid; place-items: center; padding: 16px; }
#stmPrev.hidden { display: none; }
.stm-pv { width: min(420px, 100%); max-height: 100%; overflow-y: auto; border-radius: 26px; padding: 16px; background: linear-gradient(180deg, #2a1870, #120a3a); border: 2px solid rgba(242,193,78,.7); }
.stm-pv h3 { margin: 0 0 10px; text-align: center; font: 800 20px "Inter", sans-serif; color: #f6d88e; }
.stm-pv img { display: block; width: 72%; margin: 0 auto; border-radius: 16px; box-shadow: 0 10px 26px rgba(0,0,0,.5); }
.stm-pv p { white-space: pre-wrap; margin: 12px 0 0; padding: 12px; border-radius: 14px; background: rgba(255,255,255,.08); font: 500 14.5px/1.4 "Inter", sans-serif; }
.stm-pv .stm-to { text-align: center; color: #dcd4ff; font-size: 13.5px; background: none; padding: 0; }
.stm-pvb { display: grid; grid-template-columns: 1fr 1.6fr; gap: 10px; margin-top: 12px; }
.stm-pvb button { border: 0; border-radius: 999px; padding: 14px; font: 800 16px "Inter", sans-serif; cursor: pointer; }
.stm-pvb .go { background: linear-gradient(180deg, #fff0b8, #f2c14e 50%, #c48d22); color: #1a1408; }
.stm-pvb .no { background: rgba(255,255,255,.12); color: #fff; }
@media (max-width: 380px) { .stm-title { font-size: 32px; } .stm-card { grid-template-columns: minmax(0, 1fr) 96px; } .stm-tgt span { width: 50px; height: 50px; } .stm-cta { font-size: 21px; } }
`;
  document.head.appendChild(st);
}
function stmHtml() {
  const A = stmApp(), S = stmScreens(A);
  return `<div class="stm-in" style="--stm-c1:${A.c1};--stm-c2:${A.c2}">
    <div class="stm-top"><button class="stm-round" data-stmclose="1" aria-label="Back">${stmSvg("back")}</button><span class="stm-mc">MARVEL CORP</span><button class="stm-round" data-stminfo="1" aria-label="How sharing works">${stmSvg("info")}</button></div>
    <h1 class="stm-title">${stmSvg("share")}SHARE THE MAGIC</h1>
    <h2 class="stm-h2">Share This App</h2><p class="stm-sub">Show friends what makes it special.</p>
    <section class="stm-card"><div><div class="stm-app"><img src="${esc(A.icon)}" alt=""><span><b>${esc(A.name.toUpperCase())}</b><small>by Marvel Corp</small></span></div>
        <p class="stm-tag">${esc(A.tag)}</p><div class="stm-get"><div class="stm-qrbox" id="stmQrBox">QR</div><span><small>Try it free at</small><b>${esc(A.link.replace(/^https?:\/\/|\/$/g, ""))}</b></span></div></div>
      <div class="stm-phone"><img src="${STM.img || ""}" alt="The picture you'll share"></div></section>
    <h2 class="stm-h2 stm-pickh">Pick a screen to share</h2>
    <div class="stm-picks">${S.map((s, i) => `<button class="stm-pick ${STM.pick === i ? "on" : ""}" data-stmpick="${i}" aria-pressed="${STM.pick === i}"><span class="stm-mini"><i>${s.emoji}</i><em>${esc(i ? s.title.split(/[:,-]/)[0] : A.name)}</em></span>${i ? esc(s.title.split(/[:,-]/)[0].split(" ").slice(0, 2).join(" ")) : "Home"}</button>`).join("")}</div>
    <div class="stm-link">${stmSvg("link")}<input id="stmLink" value="${esc(A.link)}" readonly aria-label="Your app link"><button class="stm-copy" data-stmcopy="1" aria-label="Copy the link">${stmSvg("copy")}</button>
      <label class="stm-qrt">Include<br>QR code<input type="checkbox" id="stmQr" ${STM.qr ? "checked" : ""} aria-label="Include the QR code"></label></div>
    <div class="stm-msg"><label for="stmMsg">Your message</label><textarea id="stmMsg" rows="3" maxlength="400">${esc(STM.msg || stmPitch(A))}</textarea></div>
    <section class="stm-where"><h3>${stmSvg("plane")}Share it anywhere</h3>
      <div class="stm-tgts">${STM_TARGETS.map(([k, l, c]) => `<button class="stm-tgt ${k === "instagram" ? "ig" : ""} ${STM.target === k ? "on" : ""}" data-stmto="${k}" aria-pressed="${STM.target === k}"><span style="background:${c}">${stmSvg(k)}</span>${l}</button>`).join("")}</div></section>
    <button class="stm-cta" data-stmgo="1">${stmSvg("share")}Preview &amp; Share</button>
    <p class="stm-note">${stmSvg("info")}Some apps may require you to finish posting there.</p></div>
    <div id="stmPrev" class="hidden" role="dialog" aria-modal="true" aria-label="Preview"></div>`;
}
function stmOpen() {
  stmCss();
  let el = document.getElementById("stmSheet");
  if (!el) { el = document.createElement("div"); el.id = "stmSheet"; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-label", "Share the Magic"); document.body.appendChild(el); stmWire(el); }
  el.innerHTML = stmHtml(); el.classList.remove("hidden"); el.scrollTop = 0;
  try { history.pushState({ stm: 1 }, ""); STM.hist = 1; } catch (e) { /* the back arrow still works */ }
  stmRender(); stmQrBox();
}
async function stmQrBox() { const b = document.getElementById("stmQrBox"); if (!b) return; const c = await stmQr(stmApp().link); if (c && b.isConnected) { b.innerHTML = ""; const i = new Image(); i.src = c.toDataURL(); i.alt = "QR code"; b.appendChild(i); } }
function stmClose(fromPop) {
  const el = document.getElementById("stmSheet"); if (el) el.classList.add("hidden");
  if (!fromPop && STM.hist) { STM.hist = 0; STM.skip = 1; try { history.back(); } catch (e) { STM.skip = 0; } }
}
if (typeof window !== "undefined") window.addEventListener("popstate", () => {
  if (STM.skip) { STM.skip = 0; return; }
  const p = document.getElementById("stmPrev"); if (p && !p.classList.contains("hidden")) { p.classList.add("hidden"); try { history.pushState({ stm: 1 }, ""); } catch (e) {} return; }
  const el = document.getElementById("stmSheet"); if (el && !el.classList.contains("hidden")) { STM.hist = 0; stmClose(true); }
});
const STM_NAME = { "": "your phone's share menu", text: "a text message", messenger: "Messenger", facebook: "Facebook", groups: "a Facebook group", instagram: "Instagram", tiktok: "TikTok", x: "X", telegram: "Telegram" };
function stmPreview() {
  const A = stmApp(), p = document.getElementById("stmPrev"); if (!p) return;
  STM.msg = (document.getElementById("stmMsg") || {}).value || STM.msg;
  const how = { instagram: "The picture saves to your phone and your message is copied. Instagram opens - add the picture and paste.", tiktok: "The picture saves to your phone and your message is copied. TikTok opens - add the picture and paste.",
    facebook: "Facebook opens with your link. Your message is copied - paste it in.", groups: "Facebook opens with your link - choose \"Share to a group\" and pick the group. Your message is copied - paste it in.",
    messenger: "Messenger opens with your link. Your message is copied - paste it in." }[STM.target] || "";
  p.innerHTML = `<div class="stm-pv"><h3>Here's what you'll share</h3><img src="${STM.img}" alt="Your picture"><p>${esc(stmMessage(A))}</p>
    <p class="stm-to">To ${esc(STM_NAME[STM.target] || STM_NAME[""])}.${how ? " " + esc(how) : ""}</p>
    <div class="stm-pvb"><button class="no" data-stmback="1">Back</button><button class="go" data-stmsend="1">Share now</button></div></div>`;
  p.classList.remove("hidden");
}
function stmCopyText(t) { return (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => true).catch(() => false); }
function stmDownload() { const a = document.createElement("a"); a.href = STM.img; a.download = `${stmApp().name.replace(/\s+/g, "-")}-share.png`; document.body.appendChild(a); a.click(); a.remove(); }
const stmMobile = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || "");
function stmNav(u) { location.href = u; }   // sms: / fb-messenger: open the phone's own app (one place, so a test can watch it)
async function stmSend() {
  const A = stmApp(), msg = stmMessage(A), link = A.link, t = STM.target, enc = encodeURIComponent, open = u => window.open(u, "_blank", "noopener");
  const done = s => { toast(s); const p = document.getElementById("stmPrev"); if (p) p.classList.add("hidden"); };
  if (!t) {   // the phone's own share menu: the picture + the message in one go
    const blob = await stmBlob(), file = blob && typeof File !== "undefined" ? new File([blob], `${A.name.replace(/\s+/g, "-")}.png`, { type: "image/png" }) : null;
    if (navigator.share) {
      try { if (file && navigator.canShare && navigator.canShare({ files: [file] })) await navigator.share({ files: [file], text: msg, title: A.name }); else await navigator.share({ text: msg, title: A.name }); return done("✨ Shared - thank you!"); }
      catch (e) { if (e && e.name === "AbortError") return; }
    }
    const ok = await stmCopyText(msg); stmDownload(); return done(ok ? "📋 Message copied and the picture saved - paste it anywhere" : "The picture is saved - add it to your post");
  }
  if (t === "text") { stmNav(`sms:?&body=${enc(msg)}`); return done("✨ Opening your messages"); }
  if (t === "x") { open(`https://x.com/intent/post?text=${enc(msg)}`); return done("✨ X opens with your post"); }
  if (t === "telegram") { open(`https://t.me/share/url?url=${enc(link)}&text=${enc(msg.replace(link, "").trim())}`); return done("✨ Telegram opens with your message"); }
  const copied = await stmCopyText(msg);
  if (t === "facebook" || t === "groups") { open(`https://www.facebook.com/sharer/sharer.php?u=${enc(link)}`); return done(copied ? "📋 Message copied - paste it in Facebook" : "✨ Facebook opens with your link"); }
  if (t === "messenger") { if (stmMobile()) stmNav(`fb-messenger://share/?link=${enc(link)}`); else open("https://www.messenger.com/"); return done(copied ? "📋 Message copied - paste it in Messenger" : "✨ Messenger opens"); }
  if (t === "instagram" || t === "tiktok") { stmDownload(); open(t === "instagram" ? "https://www.instagram.com/" : "https://www.tiktok.com/upload"); return done(`📸 Picture saved${copied ? " and message copied" : ""} - post it in ${STM_NAME[t]}`); }
}
function stmWire(el) {
  el.addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b || !el.contains(b)) return; const d = b.dataset;
    e.stopPropagation();
    if (d.stmclose) return stmClose();
    if (d.stminfo) return toast("Pick a picture, check your message, choose where - then Preview & Share. Some apps need you to finish posting there.");
    if (d.stmpick !== undefined) { STM.pick = Number(d.stmpick); STM.msg = (document.getElementById("stmMsg") || {}).value || STM.msg; el.querySelectorAll(".stm-pick").forEach((x, i) => { x.classList.toggle("on", i === STM.pick); x.setAttribute("aria-pressed", String(i === STM.pick)); }); return stmRender(); }
    if (d.stmto) { STM.target = STM.target === d.stmto ? "" : d.stmto; el.querySelectorAll(".stm-tgt").forEach(x => { const on = x.dataset.stmto === STM.target; x.classList.toggle("on", on); x.setAttribute("aria-pressed", String(on)); }); return; }
    if (d.stmcopy) return stmCopyText(stmApp().link).then(ok => toast(ok ? "🔗 Link copied" : "Couldn't copy on this phone - hold the link to copy it"));
    if (d.stmgo) return stmPreview();
    if (d.stmback) return document.getElementById("stmPrev").classList.add("hidden");
    if (d.stmsend) return stmSend();
  });
  el.addEventListener("change", e => { if (e.target && e.target.id === "stmQr") { STM.qr = e.target.checked; stmRender(); } });
  el.addEventListener("input", e => { if (e.target && e.target.id === "stmMsg") STM.msg = e.target.value; });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && !el.classList.contains("hidden")) { const p = document.getElementById("stmPrev"); if (p && !p.classList.contains("hidden")) p.classList.add("hidden"); else stmClose(); } });
}
