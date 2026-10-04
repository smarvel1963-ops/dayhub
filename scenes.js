/* SAVE AS: scenes.js · LOCATION: C:/MarvelApps/dayhub/scenes.js
 * HUB SCENES (Scott 10/4: "all our apps need little lite background behind
 * clock like the weather for day hub, ocean scenery for cruise hub and beachs
 * make that normal for all our apps").
 *
 * EVERY hub app gets a faint scene behind the clock. It is a small SVG painted
 * as the hero's background image (--scene), on top of the time-of-day colour
 * (--hero), so the clock, weather and chips stay readable. No image files, no
 * network. Gentle motion lives inside the SVG and stops for phones set to
 * reduce motion. The SVG only changes when the scene's key changes (weather
 * code, day/night, phase), so the minute redraw never restarts the motion.
 *
 *   Day Hub    -> "weather": sun / moon + stars / clouds / rain / snow / storm / fog
 *   Cruise Hub -> "ocean":   sea + waves, a ship on the horizon, beach + palm,
 *                            with the same weather on top
 * A NEW hub adds its own scene to SCENES and picks it in SCENE_FOR (below).
 *
 * Loaded after app.js, before ui.js (needs MODE, WXDATA, PHASES).
 */
"use strict";

const SCENE_FOR = { day: "weather", cruise: "ocean" };
let SCENE_KEY = null;

// What the sky is doing: clear | cloudy | rain | snow | storm | fog (WMO codes, Open-Meteo).
function skyKind(code) {
  if (code == null) return "clear";
  if (code >= 95) return "storm";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return "rain";
  if (code === 45 || code === 48) return "fog";
  if (code >= 2) return "cloudy";
  return "clear";
}

const SC_STYLE = `<style>
.drift{animation:drift 60s ease-in-out infinite alternate}
.drift2{animation:drift 85s ease-in-out infinite alternate-reverse}
@keyframes drift{from{transform:translateX(-14px)}to{transform:translateX(14px)}}
.spin{transform-origin:215px 62px;animation:spin 120s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.tw{animation:tw 4s ease-in-out infinite alternate}.tw2{animation:tw 6s ease-in-out infinite alternate-reverse}
@keyframes tw{from{opacity:.25}to{opacity:.9}}
.fall{animation:fall 1.1s linear infinite}.fall2{animation:fall 1.1s linear -.55s infinite}
@keyframes fall{from{transform:translate(0,-30px)}to{transform:translate(-8px,30px)}}
.flake{animation:flake 7s linear infinite}.flake2{animation:flake 9s linear -4s infinite}
@keyframes flake{from{transform:translate(0,-40px)}to{transform:translate(10px,60px)}}
.flash{animation:flash 9s steps(1) infinite}
@keyframes flash{0%,93%,97%{opacity:0}94%,98%{opacity:.8}}
.wave{animation:wave 9s ease-in-out infinite alternate}.wave2{animation:wave 13s ease-in-out infinite alternate-reverse}
@keyframes wave{from{transform:translateX(-18px)}to{transform:translateX(18px)}}
.bob{animation:bob 5s ease-in-out infinite alternate;transform-box:fill-box;transform-origin:center}
@keyframes bob{from{transform:translateY(0)}to{transform:translateY(2px)}}
.sway{animation:sway 7s ease-in-out infinite alternate;transform-origin:380px 240px}
@keyframes sway{from{transform:rotate(-1.5deg)}to{transform:rotate(1.5deg)}}
@media (prefers-reduced-motion:reduce){*{animation:none!important}}
</style>`;

const cloud = (x, y, s, o) => `<g transform="translate(${x} ${y}) scale(${s})" opacity="${o}"><path fill="#fff" d="M10 40a18 18 0 0 1 6-35 24 24 0 0 1 44 4 16 16 0 0 1 24 15 13 13 0 0 1-4 26H14a10 10 0 0 1-4-10z"/></g>`;

// The weather layer, shared by every scene. `night` swaps the sun for moon + stars.
function weatherLayer(kind, night) {
  let s = "";
  if (kind === "clear" || kind === "cloudy") s += night
    ? `<g fill="#fff"><circle class="tw" cx="40" cy="30" r="1.4"/><circle class="tw2" cx="120" cy="18" r="1.1"/><circle class="tw" cx="300" cy="40" r="1.2"/>
       <circle class="tw2" cx="250" cy="14" r="1"/><circle class="tw" cx="80" cy="70" r="1"/><circle class="tw2" cx="150" cy="96" r="1.3"/><circle class="tw" cx="360" cy="90" r="1.1"/></g>
       <path d="M227 38a26 26 0 1 0 22 40 21 21 0 1 1-22-40z" fill="#fff6d8" opacity=".5"/>`
    : `<g class="spin" opacity=".28" stroke="#fff3c4" stroke-width="3" stroke-linecap="round">${[0, 45, 90, 135, 180, 225, 270, 315].map(a =>
        `<line x1="215" y1="22" x2="215" y2="10" transform="rotate(${a} 215 62)"/>`).join("")}</g>
       <circle cx="215" cy="62" r="28" fill="#fff3c4" opacity=".3"/>`;
  if (kind === "cloudy") s += `<g class="drift">${cloud(40, 20, 1, .22)}${cloud(230, 50, .8, .18)}</g><g class="drift2">${cloud(140, 70, .7, .14)}</g>`;
  if (kind === "rain" || kind === "storm" || kind === "snow")
    s += `<g class="drift">${cloud(20, 10, 1.3, kind === "storm" ? .3 : .24)}${cloud(200, 20, 1.2, .22)}</g>`;
  if (kind === "rain" || kind === "storm") {
    const drops = c => Array.from({ length: 16 }, (_, i) => `<line x1="${20 + i * 24}" y1="${100 + (i % 3) * 22}" x2="${14 + i * 24}" y2="${114 + (i % 3) * 22}"/>`).join("");
    s += `<g stroke="#cfe6ff" stroke-width="1.6" stroke-linecap="round" opacity=".38"><g class="fall">${drops()}</g><g class="fall2" transform="translate(12 30)">${drops()}</g></g>`;
  }
  if (kind === "storm") s += `<path class="flash" d="M250 70l-14 30h12l-10 28 26-38h-13l11-20z" fill="#fff8c0"/>`;
  if (kind === "snow") {
    const flakes = Array.from({ length: 18 }, (_, i) => `<circle cx="${12 + i * 22}" cy="${90 + (i % 4) * 30}" r="${1.4 + (i % 3) * .6}"/>`).join("");
    s += `<g fill="#fff" opacity=".55"><g class="flake">${flakes}</g><g class="flake2" transform="translate(10 -20)">${flakes}</g></g>`;
  }
  if (kind === "fog") s += `<g fill="#fff" opacity=".12"><rect class="drift" x="-20" y="80" width="440" height="16" rx="8"/>
    <rect class="drift2" x="-20" y="118" width="440" height="20" rx="10"/><rect class="drift" x="-20" y="160" width="440" height="16" rx="8"/></g>`;
  return s;
}

const SCENES = {
  // Day Hub: the sky as it is right now, over soft hills.
  weather: (kind, night) => weatherLayer(kind, night) +
    `<path d="M0 214c60-26 110-30 170-14s110 10 160-8 60-4 70 2V240H0z" fill="#fff" opacity=".07"/>
     <path d="M0 226c80-18 140-14 200-2s130 8 200-10V240H0z" fill="#fff" opacity=".06"/>`,
  // Cruise Hub: sea to the horizon, a ship, a beach and a palm, weather on top.
  ocean: (kind, night) => weatherLayer(kind, night) +
    `<rect x="0" y="178" width="400" height="62" fill="#5eead4" opacity=".10"/>
     <g class="bob" opacity=".4" fill="#fff"><path d="M318 176h30l-4 5h-22z"/><rect x="324" y="171" width="17" height="5" rx="1"/><rect x="328" y="167" width="8" height="4" rx="1"/>
       <rect x="333" y="163" width="2.5" height="4" fill="#fb923c"/></g>
     <g fill="none" stroke="#fff" stroke-linecap="round">
       <path class="wave" d="M-30 192q20-5 40 0t40 0 40 0 40 0 40 0 40 0 40 0 40 0 40 0 40 0 40 0" stroke-width="1.8" opacity=".2"/>
       <path class="wave2" d="M-30 210q25-6 50 0t50 0 50 0 50 0 50 0 50 0 50 0 50 0 50 0" stroke-width="2.2" opacity=".16"/>
       <path class="wave" d="M-30 228q30-7 60 0t60 0 60 0 60 0 60 0 60 0 60 0" stroke-width="2.4" opacity=".13"/></g>
     <path d="M262 240c26-20 76-30 138-28V240z" fill="#fcd9a0" opacity=".22"/>
     <g class="sway" opacity=".34" fill="#fff" transform="translate(196 92) scale(.5)">
       <path d="M372 240c-2-30 2-58 12-84l4 1c-9 26-12 53-10 83z"/>
       <path d="M386 156c-20-10-40-6-52 6 16-4 30-4 44 2zm0 0c-8-16-24-24-42-22 14 6 26 14 34 26zm0 0c14-14 30-16 44-10-14 0-28 4-38 14zm0 0c4-18 18-28 32-30-10 8-18 18-24 32z"/></g>`,
};

// Called from paintHero(): sets --scene on the hero only when the scene changes.
function paintScene(hero) {
  const name = SCENE_FOR[MODE] || "weather", h = new Date().getHours();
  const w = WXDATA && WXDATA.here && WXDATA.here.cur;
  const night = w && w.is_day != null ? !w.is_day : (h < 6 || h >= 19);
  const kind = skyKind(w ? w.weather_code : null);
  const key = `${name}|${kind}|${night ? "n" : "d"}`;
  if (key === SCENE_KEY && hero.style.getPropertyValue("--scene")) return;
  SCENE_KEY = key;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 240" preserveAspectRatio="xMidYMax slice">${SC_STYLE}${SCENES[name](kind, night)}</svg>`;
  hero.style.setProperty("--scene", `url("data:image/svg+xml,${encodeURIComponent(svg)}")`);
  hero.dataset.scene = key;
}
