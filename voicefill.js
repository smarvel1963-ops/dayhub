/* SAVE AS: voicefill.js · LOCATION: C:/MarvelApps/dayhub/voicefill.js
 * VOICE FILL - a microphone at the right end of every typing box, in every Marvel Corp app (Scott 11/24: "all aps must have microphone
 * to right on any box for use to voice fill any input box all apps old and new all input interactive pill boxes").
 *
 * ONE file for every app on smarvel1963-ops.github.io:
 *   - every Hub (shared engine): ui.js loads it (switch VOICE_FILL in features.js) - no Hub index.html / sw.js change needed;
 *   - every other app / page: <script src="/dayhub/voicefill.js" defer></script> (absolute path, same site), or a copy of this file
 *     for an app on another site or inside a phone build.
 * Boxes that get a mic: <input> (text, search, email, url, tel, number, or no type), <textarea>, and contenteditable boxes - when they
 * are at least MIN_W wide, not read-only, not disabled. Never passwords, codes, dates, files, checkboxes. A box (or a whole section)
 * can opt out with data-novoice.
 * Tap the mic: it turns red and listens; what you say goes into the box (added after anything already typed); tap again to stop.
 * Uses the browser's own speech recognition (Chrome, the Google Play apps - they run in Chrome -, Edge, Safari). Where the browser has
 * none, tapping the mic opens the keyboard and says to use the keyboard's mic. A phone build with the Capacitor speech plugin
 * (@capacitor-community/speech-recognition) uses that instead.
 * This file stores nothing and sends nothing itself; the browser's speech service hears the words (Google's, in Chrome).
 */
(function () {
  "use strict";
  if (window.__voiceFill) return;
  window.__voiceFill = true;

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const capSpeech = () => { const c = window.Capacitor; return c && c.Plugins && c.Plugins.SpeechRecognition; };
  const TYPES = new Set(["", "text", "search", "email", "url", "tel", "number"]);
  const MIN_W = 90;                          // narrower boxes (a quantity, a code) get no mic
  const ZONE = 40;                           // the tap area at the right end of the box, in px
  const svg = c => "url(\"data:image/svg+xml," + encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='${c}' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'>` +
    "<rect x='9' y='2.5' width='6' height='12' rx='3'/><path d='M5 11a7 7 0 0 0 14 0'/><path d='M12 18v3.5'/><path d='M8.5 21.5h7'/></svg>") + "\")";

  const css = document.createElement("style");
  css.id = "vfStyle";
  css.textContent =
    ".vf-mic{background-image:" + svg("#8a90ad") + "!important;background-repeat:no-repeat!important;background-size:18px 18px!important;" +
    "background-position:right 10px center!important;padding-right:36px!important}" +
    "textarea.vf-mic,.vf-mic[contenteditable]{background-position:right 10px top 10px!important}" +
    ".vf-mic.vf-hot{cursor:pointer}" +
    ".vf-mic.vf-on{background-image:" + svg("#ff3b4e") + "!important;animation:vfPulse 1.1s ease-in-out infinite}" +
    "@keyframes vfPulse{50%{box-shadow:0 0 0 3px rgba(255,59,78,.28)}}" +
    "#vfToast{position:fixed;left:50%;bottom:calc(18px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);z-index:2147483647;" +
    "max-width:calc(100vw - 32px);padding:9px 14px;border-radius:12px;background:rgba(20,22,34,.92);color:#fff;" +
    "font:500 14px/1.35 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;box-shadow:0 6px 20px rgba(0,0,0,.3);pointer-events:none;" +
    "opacity:0;transition:opacity .2s}#vfToast.show{opacity:1}" +
    "@media (prefers-reduced-motion:reduce){.vf-mic.vf-on{animation:none}}";
  (document.head || document.documentElement).appendChild(css);

  // ---- which boxes get a mic
  function eligible(el) {
    if (!el || el.nodeType !== 1 || el.closest("[data-novoice]")) return false;
    if (el.tagName === "TEXTAREA") return !el.readOnly && !el.disabled;
    if (el.tagName === "INPUT") {
      const t = (el.getAttribute("type") || "").toLowerCase();
      return TYPES.has(t) && !el.readOnly && !el.disabled && el.autocomplete !== "one-time-code";
    }
    const ce = el.getAttribute("contenteditable");
    return ce !== null && ce !== "false" && !(el.parentElement && el.parentElement.closest("[contenteditable]:not([contenteditable=false])"));
  }
  const ro = window.ResizeObserver ? new ResizeObserver(es => es.forEach(e => size(e.target))) : null;
  function size(el) { el.classList.toggle("vf-mic", eligible(el) && el.offsetWidth >= MIN_W); }
  function tag(el) {
    if (el.__vf || !eligible(el)) return;
    el.__vf = true;
    size(el);                                                          // now (a page that never fires ResizeObserver still gets its mics)
    if (ro) ro.observe(el);                                            // and again whenever it changes size (a sheet opening)
  }
  document.addEventListener("focusin", e => { const t = e.target; if (t && t.__vf) size(t); }, true);   // and when a box is used
  function scan(root) {
    if (!root || root.nodeType !== 1) return;
    if (root.matches("input,textarea,[contenteditable]")) tag(root);
    root.querySelectorAll("input,textarea,[contenteditable]").forEach(tag);
  }
  function boot() {
    scan(document.body);
    new MutationObserver(ms => ms.forEach(m => {
      if (m.type === "childList") m.addedNodes.forEach(scan);
      else if (m.target.__vf) size(m.target); else tag(m.target);      // type / readonly / disabled changed
    })).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["type", "readonly", "disabled", "contenteditable", "data-novoice"] });
  }

  // ---- the tap
  function micAt(el, x, y) {
    const r = el.getBoundingClientRect();
    if (x < r.right - ZONE || x > r.right + 2 || y < r.top - 2 || y > r.bottom + 2) return false;
    return !(el.tagName === "TEXTAREA" || el.hasAttribute("contenteditable")) || y <= r.top + ZONE;
  }
  const boxOf = t => t && t.closest ? t.closest(".vf-mic") : null;
  let lastTap = null;
  document.addEventListener("pointerdown", e => {
    const el = boxOf(e.target);
    if (!el || e.button > 0 || !micAt(el, e.clientX, e.clientY)) return;
    e.preventDefault(); e.stopPropagation();                           // the mic, not the keyboard
    lastTap = { el, at: Date.now() };
    toggle(el);
  }, true);
  document.addEventListener("click", e => {                            // swallow the click that follows a mic tap
    if (lastTap && boxOf(e.target) === lastTap.el && Date.now() - lastTap.at < 800) { e.preventDefault(); e.stopPropagation(); }
  }, true);
  document.addEventListener("pointermove", e => {                      // a pointer hand over the mic (mouse)
    if (e.pointerType !== "mouse") return;
    const el = boxOf(e.target);
    if (el) el.classList.toggle("vf-hot", micAt(el, e.clientX, e.clientY));
  }, true);

  // ---- talking
  let rec = null, cur = null, keep = null;
  function toggle(el) {
    if (cur) { stop(); return; }                                         // any mic tap while listening = stop (one box at a time)
    if (SR) return listenWeb(el);
    if (capSpeech()) return listenCap(el);
    try { el.focus(); } catch (e) { /* fine */ }
    say("Tap the mic on your keyboard to talk");
  }
  function hold(el) {                                                   // keep the box "in use" (apps don't redraw a focused box) without the keyboard
    keep = { el, im: el.getAttribute("inputmode") };
    el.setAttribute("inputmode", "none");
    try { el.focus({ preventScroll: true }); } catch (e) { /* fine */ }
    el.classList.add("vf-on");
  }
  function release() {
    if (!keep) return;
    const { el, im } = keep; keep = null;
    el.classList.remove("vf-on");
    if (im === null) el.removeAttribute("inputmode"); else el.setAttribute("inputmode", im);
    if (document.activeElement === el) el.blur();                       // the next tap on the box opens the keyboard as usual
  }
  function lang() { return navigator.language || document.documentElement.lang || "en-US"; }
  function listenWeb(el) {
    const base = getVal(el);
    let heard = false, r;
    try {
      r = new SR();
      r.lang = lang(); r.interimResults = true; r.continuous = false; r.maxAlternatives = 1;
    } catch (e) { return say("The microphone isn't available here"); }
    rec = r; cur = el; hold(el);
    r.onresult = ev => {
      let txt = "";
      for (let i = 0; i < ev.results.length; i++) txt += ev.results[i][0].transcript;
      heard = heard || !!txt.trim();
      put(el, base, txt, false);
    };
    let told = false;
    r.onerror = ev => {
      const m = { "not-allowed": "Allow the microphone for this app to talk into boxes", "service-not-allowed": "Allow the microphone for this app to talk into boxes",
        "audio-capture": "No microphone found", network: "Talking into boxes needs an internet connection" }[ev.error];
      if (m) { told = true; say(m); }
    };
    r.onend = () => {
      if (!heard && !told) say("Didn't catch that - tap the mic and talk");
      fire(el, "change");
      if (rec === r) { release(); rec = null; cur = null; }
    };
    try { r.start(); say("Listening… tap the mic again to stop", 1800); }
    catch (e) { release(); rec = null; cur = null; say("The microphone is busy - try again"); }
  }
  async function listenCap(el) {
    const p = capSpeech(), base = getVal(el);
    cur = el; hold(el);
    try {
      const a = await p.available();
      if (a && a.available === false) throw new Error("none");
      const perm = await p.requestPermissions().catch(() => null);
      if (perm && perm.speechRecognition === "denied") { say("Allow the microphone for this app to talk into boxes"); return; }
      const r = await p.start({ language: lang(), maxResults: 1, partialResults: false, popup: true });
      const txt = r && r.matches && r.matches[0];
      if (txt) put(el, base, txt, true); else say("Didn't catch that - tap the mic and talk");
    } catch (e) { say("Tap the mic on your keyboard to talk"); }
    finally { fire(el, "change"); release(); cur = null; }
  }
  function stop() {
    if (rec) { try { rec.stop(); } catch (e) { /* already stopped */ } }
    else { const p = capSpeech(); if (p && p.stop) p.stop().catch(() => {}); release(); cur = null; }
  }

  // ---- putting the words in the box
  function shape(el, txt) {
    const t = (el.getAttribute("type") || "").toLowerCase();
    if (t === "number") return txt.replace(/[^\d.\-]/g, "");
    if (t === "tel") return txt.replace(/[^\d+()\- ]/g, "").trim();
    if (t === "email") return txt.toLowerCase().replace(/\s+at\s+/g, "@").replace(/\s+dot\s+/g, ".").replace(/\s+/g, "");
    if (t === "url") return txt.toLowerCase().replace(/\s+dot\s+/g, ".").replace(/\s+slash\s+/g, "/").replace(/\s+/g, "");
    return txt;
  }
  function put(el, base, txt, done) {
    const t = (el.getAttribute("type") || "").toLowerCase();
    const add = shape(el, txt.trim());
    const glue = base && add && !/\s$/.test(base) && !["number", "email", "url", "tel"].includes(t) ? " " : "";
    let v = base + glue + add;
    if (el.maxLength > 0 && v.length > el.maxLength) v = v.slice(0, el.maxLength);
    setVal(el, v);
    if (done) fire(el, "change");
  }
  function getVal(el) { return el.tagName === "INPUT" || el.tagName === "TEXTAREA" ? el.value : el.textContent; }
  function setVal(el, v) {
    if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
      const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const d = Object.getOwnPropertyDescriptor(proto, "value");
      if (d && d.set) d.set.call(el, v); else el.value = v;             // the native setter, so React-style pages see it too
    } else el.textContent = v;
    fire(el, "input");
  }
  function fire(el, type) { el.dispatchEvent(new Event(type, { bubbles: true })); }

  // ---- a small note at the bottom
  let toastT = 0;
  function say(msg, ms) {
    let t = document.getElementById("vfToast");
    if (!t) { t = document.createElement("div"); t.id = "vfToast"; t.setAttribute("role", "status"); t.setAttribute("aria-live", "polite"); document.body.appendChild(t); }
    t.textContent = msg; t.classList.add("show");
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("show"), ms || 2600);
  }

  window.voiceFill = { scan, eligible, version: "1.0" };                // for tests and pages that build boxes in odd ways
  if (document.body) boot(); else document.addEventListener("DOMContentLoaded", boot, { once: true });
})();
