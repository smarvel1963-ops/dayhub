/* SAVE AS: aiprojects.js · LOCATION: C:/MarvelApps/dayhub/aiprojects.js
 * DAY HUB AI PROJECTS (Scott 11/22: "todo day hub list from me filter to AI projects as we build this monster set of app and AI responds
 * to app as daily projects and tick list are completed" -> "Yes, build it"). OWNER PHONE ONLY, Day Hub only (ui.js aipHere).
 *   - A task added with "For Claude" ticked (or sent later from Tasks -> AI) goes on Scott's private AI Projects list in the cloud
 *     (Cloudflare Worker hub-ai-projects, C:\MarvelApps\hubai\cloud - only Scott's Google sign-in and Claude's PC key reach it).
 *   - Claude reads the list on the PC (C:\MarvelApps\hubai\tools\ai_projects.py), works it, and ticks each project off with a one-line
 *     note. Day Hub picks that up: the task is ticked here too, and the note shows under it. Projects Claude adds from chat show as well,
 *     so the AI tab is each day's build log.
 *   - Scott ticking a linked task himself marks the project done too. Everything else in Day Hub stays on this phone, as before.
 * Fetched on first use like tipster.js, so no Hub's index.html or sw.js lists it. Sign-in = Firebase Google (project day-hub-510322,
 * the same one Family Hub and Photo Hub use). Tests: window.__AIP_FAKE = { user, token } skips Google, window.AIP_URL points elsewhere.
 * Every value from the cloud is escaped where it's drawn.
 */
"use strict";
const AIP_URL = () => window.AIP_URL || "https://hub-ai-projects.photohub-cloud.workers.dev";
const AIP_SDK = "https://www.gstatic.com/firebasejs/10.12.2/";
const AIP_FB = { apiKey: "AIzaSyCnLXutctuOrDHc2fKuy6c0rdOmUR62e7Y", authDomain: "day-hub-510322.firebaseapp.com", projectId: "day-hub-510322",
  appId: "1:750311262064:web:d3119089f8c4249f77f1b5" };   // public IDs (the same ones familysync.js uses)
const AIP = { items: [], loaded: false, err: "", user: null, ready: false, busy: false, open: "" };
let AIP_AUTH = null;

// ---------------------------------------------------------------- sign-in
async function aipAuth() {
  if (window.__AIP_FAKE) return null;
  if (AIP_AUTH) return AIP_AUTH;
  const load = src => new Promise((ok, no) => { const s = document.createElement("script"); s.src = AIP_SDK + src; s.onload = ok; s.onerror = no; document.head.appendChild(s); });
  if (!window.firebase || !firebase.auth) { await load("firebase-app-compat.js"); await load("firebase-auth-compat.js"); }
  const app = firebase.apps.find(a => a.name === "aiprojects") || firebase.initializeApp(AIP_FB, "aiprojects");
  const auth = app.auth();
  await new Promise(ok => { const u = auth.onAuthStateChanged(() => { u(); ok(); }); });
  AIP_AUTH = auth;
  return auth;
}
async function aipUser() {
  if (window.__AIP_FAKE) return window.__AIP_FAKE.user || null;
  const a = await aipAuth();
  const u = a.currentUser;
  return u && !u.isAnonymous ? { email: u.email, name: u.displayName || "" } : null;
}
async function aipToken() {
  if (window.__AIP_FAKE) return window.__AIP_FAKE.user ? window.__AIP_FAKE.token : "";
  const a = await aipAuth();
  return a.currentUser ? a.currentUser.getIdToken() : "";
}
async function aipSignIn() {
  try {
    if (window.__AIP_FAKE) window.__AIP_FAKE.user = window.__AIP_FAKE.signInAs || { email: "owner@example.com" };
    else { const a = await aipAuth(); await a.signInWithPopup(new firebase.auth.GoogleAuthProvider()); }
    await aipPull();
  } catch (e) { toast("Sign-in didn't finish - try again"); }
}

// ---------------------------------------------------------------- the cloud list
async function aipCall(method, path, body) {
  const tok = await aipToken();
  if (!tok) throw new Error("Sign in first");
  const r = await fetch(AIP_URL() + path, { method, headers: { Authorization: "Bearer " + tok, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `The AI Projects list answered ${r.status}`);
  return j;
}

/** Reads the list, ticks the Day Hub tasks Claude finished (and tells the list about tasks Scott ticked here), then redraws. */
async function aipPull() {
  if (AIP.busy) return;
  AIP.busy = true;
  let changed = false;
  try {
    AIP.user = await aipUser();
    AIP.ready = true;
    if (!AIP.user) { AIP.loaded = false; return; }
    const j = await aipCall("GET", "/v1/projects");
    AIP.items = Array.isArray(j.items) ? j.items : [];
    AIP.loaded = true; AIP.err = "";
    for (const it of AIP.items) {
      if (!it.todoId) continue;
      const t = S.todos.find(x => x.id === it.todoId);
      if (!t) continue;
      if (t.aiId !== it.id) { t.aiId = it.id; changed = true; }
      if ((it.reply || "") !== (t.aiReply || "")) { t.aiReply = it.reply || ""; changed = true; }
      if (it.status === "done" && !todoDone(t)) { t.done = true; t.doneDay = today(); changed = true; }   // Claude finished it
      else if (todoDone(t) && (it.status === "waiting" || it.status === "working")) {                // Scott ticked it here
        try { const r = await aipCall("PATCH", `/v1/projects/${it.id}`, { status: "done" }); Object.assign(it, r.item); } catch (e) { /* next time */ }
      }
    }
    if (changed) save();
  } catch (e) {
    AIP.err = (e && e.message) || String(e);
  } finally {
    AIP.busy = false;
    if (changed && typeof render === "function") render(); else aipRedraw();   // a ticked task shows ticked wherever Scott is
  }
}

/** A Day Hub task goes on the list (one task = one project: sending it twice does nothing). */
async function aipSendTodo(t) {
  try {
    if (!(await aipUser())) { toast("Sign in on Tasks -> AI first, then send it again"); return; }
    const r = await aipCall("POST", "/v1/projects", { title: t.title, todoId: t.id });
    t.aiId = r.item.id; save();
    toast(r.duplicate ? "Already on Claude's list ✓" : "🤖 On Claude's list ✓");
    await aipPull();
  } catch (e) { toast("Couldn't reach the AI Projects list - try again"); }
}
async function aipAddNew(title, notes) {
  const r = await aipCall("POST", "/v1/projects", { title, notes });
  toast("🤖 On Claude's list ✓");
  AIP.items.push(r.item);
  await aipPull();
}

// ---------------------------------------------------------------- drawing (Tasks -> AI)
const aipWhen = ms => { if (!ms) return ""; const d = new Date(ms); return d.toLocaleDateString([], { month: "short", day: "numeric" }) + " " + d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }); };
const aipDay = ms => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
function aipRow(x) {
  const mark = x.status === "done" ? "✅" : x.status === "working" ? "🛠️" : x.status === "dropped" ? "✖️" : "⬜";
  const from = x.todoId ? "your task" : x.by === "claude" ? "added by Claude" : "from you";
  return `<li class="aip-row ${esc(x.status)}"><span class="aip-mark" aria-hidden="true">${mark}</span><span class="grow"><b>${esc(x.title)}</b>
    <small>${esc(from)} · ${esc(aipWhen(x.created))}${x.status === "done" && x.doneAt ? ` · done ${esc(aipWhen(x.doneAt))}` : ""}</small>
    ${x.notes ? `<small class="aip-notes">${esc(x.notes)}</small>` : ""}
    ${x.reply ? `<span class="aip-reply">🤖 ${esc(x.reply)}</span>` : ""}</span>
    ${x.status === "waiting" ? `<button class="aip-x" data-aipdrop="${esc(x.id)}" aria-label="Take it off the list">✕</button>` : ""}</li>`;
}
function aipHtml() {
  if (!AIP.ready) { aipPull(); return `<section class="card aip"><h3><span class="ci">🤖</span>AI Projects</h3><div class="body"><p class="hint">Opening your AI Projects…</p></div></section>`; }
  if (!AIP.user) return `<section class="card aip"><h3><span class="ci">🤖</span>AI Projects</h3><div class="body">
    <p>Tasks you mark <b>For Claude</b> go on Claude's build list. Claude ticks them off with a note when they're done, and the tick shows up here.</p>
    <p class="hint">Sign in with Google once so the list knows it's you. Only you and Claude can see it; your other tasks stay on this phone.</p>
    <button class="btn" data-aip="signin">Sign in with Google</button></div></section>`;
  const it = AIP.items, td = today();
  const working = it.filter(x => x.status === "working"), waiting = it.filter(x => x.status === "waiting");
  const doneToday = it.filter(x => x.status === "done" && aipDay(x.doneAt) === td);
  const done = it.filter(x => x.status === "done").sort((a, b) => b.doneAt - a.doneAt).slice(0, 30);
  const sendable = S.todos.filter(t => todoShown(t) && !todoDone(t) && !t.aiId);
  return `<section class="card aip"><h3><span class="ci">🤖</span>AI Projects</h3><div class="body">
    <p class="aip-sum"><b>${waiting.length}</b> waiting · <b>${working.length}</b> being built · <b>${doneToday.length}</b> done today</p>
    ${AIP.err ? `<p class="hint warn">${esc(AIP.err)}</p>` : ""}
    <form class="aip-new" data-aipform="1"><input name="t" placeholder="New project for Claude" maxlength="200" autocomplete="off" required>
      <textarea name="n" rows="2" maxlength="2000" placeholder="Details (optional)"></textarea><button class="btn sm" type="submit">＋ Add for Claude</button></form>
    ${sendable.length ? `<details class="aip-send"${AIP.open === "send" ? " open" : ""}><summary>Send one of your tasks (${sendable.length})</summary><ul class="card-list">
      ${sendable.slice(0, 40).map(t => `<li><span class="grow">${esc(t.title)}</span><button class="btn sm ghost" data-aipsend="${esc(t.id)}">🤖 Send</button></li>`).join("")}</ul></details>` : ""}
    ${working.length ? `<h4>Being built</h4><ul class="aip-list">${working.map(aipRow).join("")}</ul>` : ""}
    ${waiting.length ? `<h4>Waiting for Claude</h4><ul class="aip-list">${waiting.map(aipRow).join("")}</ul>` : ""}
    ${done.length ? `<h4>Done</h4><ul class="aip-list">${done.map(aipRow).join("")}</ul>` : ""}
    ${!it.length ? `<p class="hint">Nothing on the list yet. Add one above, or tick <b>For Claude</b> when you add a task.</p>` : ""}
    <p class="hint">Updated ${esc(aipWhen(Date.now()))} · <button class="dt-link" data-aip="refresh">Refresh</button></p></div></section>`;
}
function aipRedraw() {
  const el = document.querySelector("#cards .aip");
  if (el && typeof render === "function") render();
}

// ---------------------------------------------------------------- taps
document.addEventListener("click", async e => {
  const b = e.target.closest("[data-aip],[data-aipsend],[data-aipdrop],.aip-send summary");
  if (!b) return;
  if (b.matches(".aip-send summary")) { AIP.open = AIP.open === "send" ? "" : "send"; return; }
  if (b.dataset.aip === "signin") { aipSignIn(); return; }
  if (b.dataset.aip === "refresh") { aipPull(); return; }
  if (b.dataset.aipsend) { const t = S.todos.find(x => x.id === b.dataset.aipsend); if (t) { b.disabled = true; aipSendTodo(t); } return; }
  if (b.dataset.aipdrop) {
    if (!confirm("Take this off Claude's list?")) return;
    try { await aipCall("PATCH", `/v1/projects/${b.dataset.aipdrop}`, { status: "dropped" }); await aipPull(); } catch (er) { toast("Couldn't reach the AI Projects list"); }
  }
});
document.addEventListener("submit", async e => {
  const f = e.target.closest("[data-aipform]");
  if (!f) return;
  e.preventDefault();
  const t = f.t.value.trim(), n = f.n.value.trim();
  if (!t) return;
  const btn = f.querySelector("button"); btn.disabled = true;
  try { await aipAddNew(t, n); } catch (er) { toast(er.message || "Couldn't reach the AI Projects list"); btn.disabled = false; }
});

// ---------------------------------------------------------------- keep up
let AIP_TIMER = null;
function aipStart() {
  if (AIP_TIMER) return;
  aipPull();
  AIP_TIMER = setInterval(() => { if (document.visibilityState === "visible") aipPull(); }, 10 * 60 * 1000);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") aipPull(); });
}
aipStart();
