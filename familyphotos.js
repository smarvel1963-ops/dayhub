/* SAVE AS: familyphotos.js · LOCATION: C:/MarvelApps/dayhub/familyphotos.js
 * FAMILY HUB - PHOTOS & MEMORIES (Scott 11/07, the list he called CORE: a family photo feed, albums by event, each member adds
 * pictures, shared with everyone or picked people, a Memories timeline). Loaded after family.js (fhMod), before familylife.js.
 * Phase A: the pictures live in this phone's own IndexedDB (familyhub.photos - never in S, never in the backup, emptied by Erase),
 * the list of them in S.fh.photos. Each picture keeps who added it and who may see it (fhAudOk in family.js: the same rule as
 * profiles). Phase B (Firebase Storage, needs the Blaze plan - Scott's call) shares them between phones.
 * The same database also keeps profile photos (familytree.js) and Documents (familylife.js): fhpPutFile / fhpGet / fhpDrop.
 * Photos are never sent to Ask Family Hub.
 */
"use strict";
let FHP_AL = "", FHP_VIEW = "feed", FHP_BIG = "", FHP_TO = "all", FHP_BUSY = false;
const FHP_ALBUM_ICONS = ["📸", "🎂", "🎄", "🏖️", "🎓", "⚽", "🐾", "🏡", "💛"];

// ------------------------------------------------------------ the picture store (IndexedDB on this phone)
let FHP_DB = null;        // one open connection, reused (closed for Erase)
const fhpDb = () => FHP_DB || (FHP_DB = new Promise((ok, no) => { const r = indexedDB.open("familyhub.photos", 1);
  r.onupgradeneeded = () => r.result.createObjectStore("img");
  r.onsuccess = () => { const db = r.result; db.onversionchange = () => { db.close(); FHP_DB = null; }; db.onclose = () => { FHP_DB = null; }; ok(db); };
  r.onerror = () => { FHP_DB = null; no(r.error); }; }));
const fhpIdb = async (mode, fn) => { const db = await fhpDb(); return new Promise((ok, no) => { const t = db.transaction("img", mode), s = t.objectStore("img"), r = fn(s);
  t.oncomplete = () => ok(r && r.result); t.onerror = () => no(t.error); t.onabort = () => no(t.error || new Error("not saved")); }); };   // a full phone aborts without an error event
const fhpGet = id => fhpIdb("readonly", s => s.get(id));
async function fhpShrink(file, max) {
  const url = URL.createObjectURL(file);
  try { const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error("not a photo")); i.src = url; });
    const k = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k)); c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", .82);
  } finally { URL.revokeObjectURL(url); }
}
// Keeps the picture (longest side 1600) and a small copy for grids (360). Returns the new id.
async function fhpPutFile(file) {
  const big = await fhpShrink(file, 1600), small = await fhpShrink(file, 360), id = uid();
  await fhpIdb("readwrite", s => { s.put(big, id); return s.put(small, id + "_t"); });
  return id;
}
function fhpDrop(id) { try { fhpIdb("readwrite", s => { s.delete(id); return s.delete(id + "_t"); }).catch(() => {}); } catch (e) { /* private mode */ } }
// Fills every <img data-fhpimg> in el; small copies unless the image asks for the big one (data-fhpbig="1").
async function fhpFill(el) {
  for (const im of (el || document).querySelectorAll("img[data-fhpimg]:not([data-fhpdone])")) {
    im.setAttribute("data-fhpdone", "1");
    try { const id = im.dataset.fhpimg, d = (im.dataset.fhpfull ? null : await fhpGet(id + "_t")) || await fhpGet(id) || (typeof fhsFetchImg === "function" ? await fhsFetchImg(id) : null); if (d) im.src = d; else im.closest(".fhp-ph, .fht-pic") && im.classList.add("gone"); } catch (e) { /* private mode */ }
  }
}

// ------------------------------------------------------------ who may see a photo
const fhpSees = p => fhAudOk({ to: p.to, ids: p.ids }, p.by);
const fhpCanEdit = p => { const me = fhMe(), o = fhMem(p.by); return !!me && fhpSees(p) && (me.id === p.by || (fhAdult() && (!o || o.role === "child"))); };
const fhpList = () => fh().photos.filter(fhpSees);
const fhpAlbum = id => fh().albums.find(a => a.id === id) || null;
const fhpAud = p => (FH_AUD.find(a => a[0] === (p.to || "all")) || FH_AUD[0]);

// ------------------------------------------------------------ the Photos tab
function fhpThumb(p) {
  const a = fhpAud(p);
  return `<figure class="fhp-ph"><button data-fhpbig="${p.id}" aria-label="Open ${esc(p.cap || "photo")} from ${esc(fhName(p.by))}"><img data-fhpimg="${p.id}" alt=""></button>
    <figcaption>${p.cap ? `<b>${esc(p.cap)}</b>` : ""}<small>${fhFace(p.by)} ${esc(fhName(p.by))}${p.to && p.to !== "all" ? ` · ${a[1]}` : ""}</small></figcaption></figure>`;
}
function fhpHtml() {
  if (FHP_BIG) { const p = fh().photos.find(x => x.id === FHP_BIG); if (p && fhpSees(p)) return fhpBigHtml(p); FHP_BIG = ""; }
  const L = fhpList(), A = fh().albums, me = fhMe(), inAl = FHP_AL ? L.filter(p => p.al === FHP_AL) : L, t = today();
  const add = me ? `<div class="fhp-add"><label class="btn fh-go fhp-addbtn">📸 Add photos<input type="file" accept="image/*" multiple data-fhpadd="1" hidden></label>
      <label class="field fhp-to">Who sees them<select data-fhpto="1">${FH_AUD.filter(a => a[0] !== "some" && (fhAdult() || a[0] !== "parents")).map(([k, i, l]) => `<option value="${k}"${FHP_TO === k ? " selected" : ""}>${i} ${l}</option>`).join("")}</select></label></div>` : "";
  const chips = `<div class="fh-chips" role="group" aria-label="Albums"><button class="fh-chip${!FHP_AL ? " on" : ""}" data-fhpal="" style="--tone:#2e86de">📷 All ${L.length}</button>
    ${A.map(a => `<button class="fh-chip${FHP_AL === a.id ? " on" : ""}" data-fhpal="${a.id}" style="--tone:#ff9f43">${a.icon} ${esc(a.name)} ${L.filter(p => p.al === a.id).length}</button>`).join("")}</div>`;
  const seg = `<div class="fh-seg" role="tablist" aria-label="Photos view">${[["feed", "Photos"], ["mem", "Memories"]].map(([k, l]) => `<button role="tab" aria-selected="${FHP_VIEW === k}" class="${FHP_VIEW === k ? "on" : ""}" data-fhpview="${k}">${l}</button>`).join("")}</div>`;
  let body;
  if (FHP_VIEW === "mem") {
    const otd = L.filter(p => fhIsD(p.date) && p.date.slice(5) === t.slice(5) && p.date.slice(0, 4) < t.slice(0, 4));
    const months = [...new Set(inAl.map(p => (p.date || t).slice(0, 7)))].sort().reverse();
    body = `${otd.length ? `<div class="fhp-otd"><h4>✨ On this day</h4><div class="fhp-grid">${otd.slice(0, 6).map(fhpThumb).join("")}</div></div>` : ""}
      ${months.length ? months.map(mo => `<div class="fhp-month"><h4>${esc(new Date(+mo.slice(0, 4), +mo.slice(5) - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" }))}</h4>
        <div class="fhp-grid">${inAl.filter(p => (p.date || t).slice(0, 7) === mo).map(fhpThumb).join("")}</div></div>`).join("") : `<p class="hos-hint">Your family's memories show here, month by month.</p>`}`;
  } else body = inAl.length ? `<div class="fhp-grid">${inAl.slice(0, 120).map(fhpThumb).join("")}</div>` : `<p class="hos-hint">${L.length ? "No photos in this album yet." : "No photos yet. Add the first one - birthdays, ballgames, Sunday dinner."}</p>`;
  return `${add}${seg}${chips}${body}
    ${fhAdult() ? `<form class="qa-form fh-form fhp-newal" data-fhpalnew="1"><div class="fh-two"><label class="field">New album<input name="name" maxlength="30" placeholder="e.g. Beach week 2026" required></label>
      <label class="field">Icon<select name="icon">${FHP_ALBUM_ICONS.map(i => `<option>${i}</option>`).join("")}</select></label></div><button class="btn sm ghost">Make the album</button></form>` : ""}
    <p class="fine">Photos stay on this phone - they aren't in the backup. Each photo shows only to the people its "Who sees them" allows.</p>`;
}
function fhpBigHtml(p) {
  const can = fhpCanEdit(p), others = fhMembers().filter(m => m.id !== p.by);
  return `<button class="mv-linkb fh-link" data-fhpbig="">‹ All photos</button>
    <figure class="fhp-big"><img data-fhpimg="${p.id}" data-fhpfull="1" alt="${esc(p.cap || "Family photo")}"><figcaption>${p.cap ? `<b>${esc(p.cap)}</b>` : ""}
      <small>${fhFace(p.by)} ${esc(fhName(p.by))} · ${esc(prettyDate(p.date || today()))}${p.al && fhpAlbum(p.al) ? ` · ${fhpAlbum(p.al).icon} ${esc(fhpAlbum(p.al).name)}` : ""} · ${fhpAud(p)[1]} ${esc(fhpAud(p)[2])}</small></figcaption></figure>
    ${can ? `<form class="qa-form fh-form" data-fhpedit="${p.id}"><label class="field">Caption<input name="cap" value="${esc(p.cap || "")}" maxlength="120" placeholder="e.g. Mia's first goal"></label>
      <div class="fh-two"><label class="field">Album<select name="al"><option value="">No album</option>${fh().albums.map(a => `<option value="${a.id}"${p.al === a.id ? " selected" : ""}>${a.icon} ${esc(a.name)}</option>`).join("")}</select></label>
        <label class="field">Day<input type="date" name="date" value="${esc(p.date || today())}"></label></div>
      <label class="field">Who sees it<select name="to">${FH_AUD.filter(a => fhAdult() || !["parents", "some"].includes(a[0])).map(([k, i, l]) => `<option value="${k}"${(p.to || "all") === k ? " selected" : ""}>${i} ${l}</option>`).join("")}</select></label>
      ${others.length ? `<fieldset class="fh-pick"><legend>Picked people</legend>${others.map(o => `<label class="fh-chip" style="--tone:${o.color}"><input type="checkbox" name="s_${o.id}" value="1"${(p.ids || []).includes(o.id) ? " checked" : ""}><span>${o.face} ${esc(o.name)}</span></label>`).join("")}<small>Only when "Picked people" is chosen.</small></fieldset>` : ""}
      <div class="fh-btns"><button class="btn fh-go">Save</button></div>
      <div class="fh-btns fh-danger"><button type="button" class="btn sm ghost" data-fhpdel="${p.id}">🗑️ Delete this photo</button></div></form>` : ""}`;
}
async function fhpAdd(files) {
  const me = fhMe(); if (!me || FHP_BUSY || !files || !files.length) return;
  FHP_BUSY = true; let n = 0;
  try { for (const f of [...files].slice(0, 20)) { try { const id = await fhpPutFile(f);
      fh().photos.unshift({ id, al: FHP_AL || "", cap: "", date: today(), by: me.id, to: FHP_TO, ids: [], at: Date.now() }); n++; } catch (e) { /* not a photo */ } }
  } finally { FHP_BUSY = false; }
  save(); render(); if (FH_OPEN) showFh(); toast(n ? `📸 ${n} photo${n === 1 ? "" : "s"} added` : "That didn't look like a photo");
}

// Pictures picked with a file button: Photos, a profile photo (familytree.js) - one listener for this phone's picture store.
if (typeof document !== "undefined") document.addEventListener("change", async e => {
  const t = e.target; if (typeof MODE === "undefined" || MODE !== "family" || !t || !t.dataset) return;
  if (t.dataset.fhpadd) { await fhpAdd(t.files); t.value = ""; return; }
  if (t.dataset.fhpto) { FHP_TO = FH_AUD.some(a => a[0] === t.value) ? t.value : "all"; return; }
  if (t.dataset.fhtpic && t.files && t.files[0]) { const p = typeof fhtPerson === "function" && fhtPerson(t.dataset.fhtpic);
    if (!p || typeof fhtCanEdit !== "function" || !fhtCanEdit(p)) return;
    try { const id = await fhpPutFile(t.files[0]), T = fhtP(p.id), old = T.pic; T.pic = id; save(); if (old) fhpDrop(old); showFh(); toast("🖼️ Photo saved"); }
    catch (err) { toast("That didn't look like a photo"); } t.value = ""; }
});

// ------------------------------------------------------------ taps and forms
function fhpClick(ds) {
  const F = fh();
  if (ds.fhpbig !== undefined) { FHP_BIG = ds.fhpbig; showFh("photos"); return true; }
  if (ds.fhpal !== undefined) { FHP_AL = ds.fhpal && fhpAlbum(ds.fhpal) ? ds.fhpal : ""; showFh("photos"); return true; }
  if (ds.fhpview) { FHP_VIEW = ds.fhpview === "mem" ? "mem" : "feed"; showFh("photos"); return true; }
  if (ds.fhpdel) { const p = F.photos.find(x => x.id === ds.fhpdel); if (!p || !fhpCanEdit(p)) return true;
    F.photos = F.photos.filter(x => x.id !== p.id); fhpDrop(p.id); FHP_BIG = ""; save(); render(); showFh("photos"); toast("🗑️ Photo deleted"); return true; }
  return false;
}
function fhpSubmit(f, data) {
  const D = f.dataset, F = fh();
  if (D.fhpedit) { const p = F.photos.find(x => x.id === D.fhpedit); if (!p || !fhpCanEdit(p)) return true;
    const to = FH_AUD.some(a => a[0] === data.to) ? data.to : "all";
    Object.assign(p, { cap: fhTxt(data.cap, 120), al: fhpAlbum(data.al) ? data.al : "", date: fhIsD(data.date) ? data.date : p.date, to,
      ids: to === "some" ? fhMembers().filter(m => m.id !== p.by && data["s_" + m.id]).map(m => m.id) : [] });
    save(); render(); showFh("photos"); toast("📸 Saved"); return true; }
  if (D.fhpalnew) { if (!fhAdult()) return true; const name = fhTxt(data.name, 30); if (!name) return true;
    const a = { id: uid(), name, icon: FHP_ALBUM_ICONS.includes(data.icon) ? data.icon : "📸" }; F.albums.push(a); FHP_AL = a.id; save(); showFh("photos"); toast(`${a.icon} ${name} made`); return true; }
  return false;
}
function fhpTodayHtml() {
  const L = fhpList().slice(0, 6);
  if (!L.length && !fhMe()) return "";
  setTimeout(() => fhpFill(document.getElementById("cards")), 0);
  return `<section class="fh-card" aria-label="Recent photos"><div class="fh-cardh"><h3>📸 Recent photos</h3><button data-fhtab="photos">See all ›</button></div>
    ${L.length ? `<div class="fhp-strip">${L.map(p => `<button class="fhp-ph" data-fhpbig="${p.id}" aria-label="Open photo from ${esc(fhName(p.by))}"><img data-fhpimg="${p.id}" alt=""></button>`).join("")}</div>`
      : `<p class="hos-hint">No family photos yet. <button class="mv-linkb fh-link" data-fhtab="photos">Add the first one</button></p>`}</section>`;
}

fhMod({
  id: "photos",
  tabs: [["photos", "📸", "Photos & memories"]],
  panes: { photos: fhpHtml },
  click: fhpClick,
  submit: fhpSubmit,
  repair: (F, o) => { ["photos", "albums"].forEach(k => { if (!Array.isArray(F[k])) F[k] = []; else if (!F[k].every(o)) F[k] = F[k].filter(o); }); F.albums.forEach(a => { a.icon = fhOkIc(a.icon, "📸"); }); },
  back: () => { if (FH_TAB === "photos" && FHP_BIG) { FHP_BIG = ""; return true; } return false; },
  depth: () => FH_TAB === "photos" && FHP_BIG ? 1 : 0,
  reset: () => { FHP_BIG = ""; },
  after: el => { fhpFill(el); },
  today: () => [40, fhpTodayHtml()],
  adds: () => fhMe() ? [{ icon: "📸", label: "Photo", attrs: 'data-fhtab="photos"', tone: "#ff6bcb" }] : [],
  forget: (id, gone) => { if (gone) fh().photos = fhHandOver(fh().photos, gone, fhpDrop); }
});
