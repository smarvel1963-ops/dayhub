/* SAVE AS: familytree.js · LOCATION: C:/MarvelApps/dayhub/familytree.js
 * FAMILY HUB - FAMILY TREE, PROFILES AND SHARING (Scott 11/07, the list he called CORE: ancestry / family tree with parent, child and
 * grandparent links, birthplaces, life facts, stories, photos, living or passed, heritage notes; and "What each member wants to
 * share": every profile field set to Whole family / Parents only / Picked people / Only me). Loaded after family.js (fhMod).
 * People = the family's members plus relatives who don't use the app (grandparents, relatives who have passed).
 * Tree links and life facts live in S.fh.tree[personId]; who sees each field lives in S.fh.share[memberId] and is decided by
 * fhAudOk / fhSees in family.js, the same rule every screen uses. Parents always see a child's profile (kids are profiles a parent
 * manages). Members fill in their own profile; parents fill in a child's; any adult keeps relatives and the tree's links.
 */
"use strict";
let FHT_PROF = "", FHT_SHARE = "";
const FHT_TEXT = [["interests", "⭐", "Interests", 200, "e.g. Soccer, drawing, dinosaurs"], ["bio", "📝", "About me", 300, ""], ["school", "🎒", "School or work", 80, "e.g. Lincoln Elementary, 3rd grade"],
  ["phone", "📞", "Phone", 30, ""], ["place", "📍", "Born in", 80, "e.g. Little Rock, Arkansas"], ["heritage", "🌍", "Heritage", 200, "e.g. Irish and Mexican; Grandpa's family came over in 1952"]];
const FHT_LONG = [["facts", "📜", "Life facts", 600, "Jobs, places lived, the war they served in, their hobbies"], ["story", "📖", "Stories", 1500, "The stories the family tells about them"]];
const FHT_PETS_OK = ["🐶", "🐱"];

const fhtP = id => { const T = fh().tree; if (!T[id] || typeof T[id] !== "object") T[id] = {}; if (!Array.isArray(T[id].parents)) T[id].parents = []; return T[id]; };
const fhtRel = id => fh().relatives.find(r => r.id === id) || null;
const fhtPerson = id => { const m = fhMem(id); if (m) return { ...m, kind: "member" }; const r = fhtRel(id); return r ? { ...r, kind: "rel" } : null; };
const fhtPeople = () => fhMembers().map(m => ({ ...m, kind: "member" })).concat(fh().relatives.map(r => ({ ...r, kind: "rel" })));
const fhtName = id => (fhtPerson(id) || {}).name || "";
// A member's field shows when their sharing allows the person using the phone; a relative's facts are the family's to see.
const fhtVis = (p, f) => p.kind !== "member" || fhSees(p, f);
const fhtCanEdit = p => p.kind === "rel" ? fhAdult() : (fhMe() && fhMe().id === p.id) || (fhAdult() && p.role === "child");
const fhtCanShare = m => !!m && ((fhMe() && fhMe().id === m.id) || (fhAdult() && m.role === "child"));
function fhtKids(id) { return fhtPeople().filter(p => fhtP(p.id).parents.includes(id)); }
function fhtDesc(id) { const out = new Set(), walk = x => fhtKids(x).forEach(k => { if (!out.has(k.id)) { out.add(k.id); walk(k.id); } }); walk(id); return out; }
const fhtYears = p => { const T = fhtP(p.id), by = p.kind === "member" ? (fhtVis(p, "bday") && fhIsD(p.bday) ? p.bday.slice(0, 4) : "") : String(T.born || "").slice(0, 4);
  const dy = T.passed ? String(T.died || "").slice(0, 4) : ""; return T.passed ? `${by || "?"} - ${dy || "?"}` : by ? `born ${by}` : ""; };

// Generations from the parent links: a person sits one row below their deepest parent and level with their partner.
// Unlinked children start one row below the grown-ups, so a family that hasn't drawn its tree yet still reads right.
function fhtGens() {
  const P = fhtPeople(), ids = new Set(P.map(p => p.id)), g = {};
  P.forEach(p => { g[p.id] = p.role === "child" ? 1 : 0; });
  for (let pass = 0; pass < P.length + 2; pass++) {
    let moved = false;
    P.forEach(p => { const T = fhtP(p.id), ps = T.parents.filter(x => ids.has(x) && x !== p.id);
      let want = ps.length ? Math.max(...ps.map(x => g[x])) + 1 : g[p.id];
      if (T.spouse && ids.has(T.spouse)) want = Math.max(want, g[T.spouse]);
      if (want > g[p.id] && want < 40) { g[p.id] = want; moved = true; } });
    if (!moved) break;
  }
  return g;
}
function fhtRowOrder(row) {
  const out = [], put = new Set();
  row.forEach(p => { if (put.has(p.id)) return; out.push(p); put.add(p.id);
    const s = fhtP(p.id).spouse, sp = s && row.find(x => x.id === s); if (sp && !put.has(sp.id)) { out.push("♥"); out.push(sp); put.add(sp.id); } });
  return out;
}
const fhtFace = p => `<span class="fht-face" aria-hidden="true">${p.face || "🙂"}</span>`;
function fhtTreeHtml() {
  const P = fhtPeople(), G = fhtGens(), rows = [...new Set(P.map(p => G[p.id]))].sort((a, b) => a - b);
  return `${fhFamSeg("tree")}
    <div class="fht-tree">${rows.map(r => `<div class="fht-row">${fhtRowOrder(P.filter(p => G[p.id] === r)).map(p => p === "♥" ? `<span class="fht-love" aria-hidden="true">❤</span>`
      : `<button class="fht-node${fhtP(p.id).passed ? " passed" : ""}" data-fhprof="${p.id}" style="--tone:${p.color || "#a29bfe"}">${fhtFace(p)}<b>${esc(p.name)}</b>${fhtYears(p) ? `<small>${esc(fhtYears(p))}</small>` : ""}</button>`).join("")}</div>`).join("")}</div>
    ${fhAdult() ? `<div class="fh-btns"><button class="btn fh-go" data-fhtrel="new">＋ Add a relative</button><button class="btn sm ghost" data-fhmemnew="1">＋ Family member</button></div>` : ""}
    <p class="fine">Tap anyone to open their profile${fhAdult() ? ", set who their parents are" : ""} and keep their life facts, stories and heritage. Grandparents and relatives who have passed belong here too - they don't need the app.</p>`;
}

// ------------------------------------------------------------ a person's profile
function fhtProfHtml() {
  if (FH_EDIT && FH_EDIT.startsWith("prof:")) return fhtProfForm();
  const p = fhtPerson(FHT_PROF); if (!p) { FHT_PROF = ""; return fhtTreeHtml(); }
  const T = fhtP(p.id), mem = p.kind === "member", R = mem ? FH_ROLES[p.role] || FH_ROLES.child : null, me = fhMe();
  let hidden = 0;
  const show = (f, v) => { if (!v) return false; if (!fhtVis(p, f)) { hidden++; return false; } return true; };
  const link = id => fhtPerson(id) ? `<button class="mv-linkb fh-link" data-fhprof="${id}">${esc(fhtName(id))}</button>` : "";
  const rows = [];
  const b = mem ? (show("bday", p.bday) ? prettyDate(p.bday) + (fhIsD(p.bday) && p.bday.slice(0, 4) > "1900" ? `, ${p.bday.slice(0, 4)}` : "") : "") : (T.born ? String(T.born) : "");
  if (b) rows.push(["🎂", "Born", esc(b)]);
  if (show("place", T.place)) rows.push(["📍", "Born in", esc(T.place)]);
  if (T.passed) rows.push(["🕊️", "Passed", esc(T.died ? String(T.died) : "")]);
  const par = T.parents.map(link).filter(Boolean), kids = fhtKids(p.id).map(k => link(k.id));
  if (par.length) rows.push(["👪", "Parents", par.join(", ")]);
  if (T.spouse && fhtPerson(T.spouse)) rows.push(["❤️", "Partner", link(T.spouse)]);
  if (kids.length) rows.push(["🧒", "Children", kids.join(", ")]);
  FHT_TEXT.forEach(([f, i, l]) => { if (show(f, T[f])) rows.push([i, l, f === "phone" ? `<a href="tel:${esc(String(T.phone).replace(/[^\d+]/g, ""))}">${esc(T.phone)}</a>` : esc(T[f])]); });
  const longs = FHT_LONG.filter(([f]) => show(f, T[f]));
  const pic = T.pic && show("photo", T.pic);
  return `<div class="fht-prof" style="--tone:${p.color || "#a29bfe"}">
      <div class="fht-pic">${pic ? `<img data-fhpimg="${esc(T.pic)}" alt="${esc(p.name)}">` : `<span aria-hidden="true">${p.face || "🙂"}</span>`}</div>
      <h3>${esc(p.name)}${T.passed ? " 🕊️" : ""}</h3><small>${mem ? `${R[0]} ${R[1]}${me && me.id === p.id ? " · that's you" : ""}` : "Relative"}</small></div>
    ${rows.length ? `<div class="fht-facts">${rows.map(([i, l, v]) => `<p><span aria-hidden="true">${i}</span><b>${l}</b><span>${v}</span></p>`).join("")}</div>` : ""}
    ${longs.map(([f, i, l]) => `<div class="fht-long"><h4>${i} ${l}</h4><p>${esc(T[f])}</p></div>`).join("")}
    ${hidden ? `<p class="fine">🔒 ${esc(p.name)} keeps ${hidden === 1 ? "one part" : hidden + " parts"} of their profile private from you.</p>` : ""}
    ${!rows.length && !longs.length && !hidden ? `<p class="hos-hint">Nothing here yet.</p>` : ""}
    <div class="fh-btns">${fhtCanEdit(p) || fhAdult() ? `<button class="btn fh-go" data-fhtedit="${p.id}">✎ Edit ${fhtCanEdit(p) ? "profile" : "tree links"}</button>` : ""}
      ${mem && fhtCanShare(p) ? `<button class="btn sm ghost" data-fhtsharefor="${p.id}">🔐 Who sees what</button>` : ""}
      ${mem ? `<button class="btn sm ghost" data-fhmem="${p.id}">📅 ${esc(p.name)}'s calendar</button>` : ""}</div>
    ${p.kind === "rel" && fhAdult() ? `<div class="fh-btns fh-danger"><button class="btn sm ghost" data-fhtreldel="${p.id}">Remove ${esc(p.name)} from the tree</button></div>` : ""}`;
}
function fhtProfForm() {
  const id = FH_EDIT.slice(5), isNew = id === "new", p = isNew ? { id: "", name: "", face: "👵", kind: "rel" } : fhtPerson(id);
  if (!p) { FH_EDIT = null; return fhtTreeHtml(); }
  const T = isNew ? { parents: [] } : fhtP(p.id), canEdit = isNew || fhtCanEdit(p), links = fhAdult();
  const no = isNew ? new Set() : fhtDesc(p.id), pick = fhtPeople().filter(x => x.id !== p.id && !no.has(x.id));
  const opt = (sel, list) => `<option value="">-</option>${list.map(x => `<option value="${x.id}"${sel === x.id ? " selected" : ""}>${x.face || "🙂"} ${esc(x.name)}</option>`).join("")}`;
  return `<form class="qa-form fh-form" data-fhtprof="${isNew ? "new" : p.id}">
    ${p.kind === "rel" ? `<label class="field">Name<input name="name" value="${esc(p.name)}" maxlength="40" required placeholder="e.g. Grandma Rose"></label>
      <fieldset class="fh-faces"><legend>Face</legend>${FH_FACES.filter(f => !FHT_PETS_OK.includes(f)).map(f => `<label><input type="radio" name="face" value="${f}"${p.face === f ? " checked" : ""}><span>${f}</span></label>`).join("")}</fieldset>
      <div class="fh-two"><label class="field">Born (year or date)<input name="born" value="${esc(T.born || "")}" maxlength="20" placeholder="e.g. 1941"></label>
        <label class="fh-check"><input type="checkbox" name="passed" value="1"${T.passed ? " checked" : ""}> 🕊️ Has passed</label></div>
      <label class="field">Passed (year or date, optional)<input name="died" value="${esc(T.died || "")}" maxlength="20"></label>` : `<h3 class="fh-listh">${p.face} ${esc(p.name)}</h3>`}
    ${links ? `<div class="fh-two"><label class="field">Parent<select name="par1">${opt(T.parents[0], pick)}</select></label><label class="field">Parent<select name="par2">${opt(T.parents[1], pick)}</select></label></div>
      <label class="field">Partner<select name="spouse">${opt(T.spouse, pick)}</select></label>` : ""}
    ${canEdit ? FHT_TEXT.map(([f, i, l, n, ph]) => `<label class="field">${i} ${l}<input name="${f}" value="${esc(T[f] || "")}" maxlength="${n}"${ph ? ` placeholder="${esc(ph)}"` : ""}${f === "phone" ? ' type="tel"' : ""}></label>`).join("")
      + FHT_LONG.map(([f, i, l, n, ph]) => `<label class="field">${i} ${l}<textarea name="${f}" rows="3" maxlength="${n}" placeholder="${esc(ph)}">${esc(T[f] || "")}</textarea></label>`).join("")
      + (isNew ? "" : `<label class="btn sm ghost fht-picbtn">🖼️ ${T.pic ? "Change" : "Add"} a photo<input type="file" accept="image/*" data-fhtpic="${p.id}" hidden></label>${T.pic ? `<button type="button" class="btn sm ghost" data-fhtpicdel="${p.id}">Remove photo</button>` : ""}`) : ""}
    <div class="fh-btns"><button class="btn fh-go">Save</button><button type="button" class="btn sm ghost" data-fhcancel="1">Cancel</button></div>
    <p class="fine">${p.kind === "member" ? "Who sees each part is up to them - 🔐 Who sees what on the profile." : "Relatives are part of the tree only; they don't use the app."} Everything stays on this phone.</p></form>`;
}

// ------------------------------------------------------------ SHARING: who sees each part of a profile
function fhtShareHtml() {
  const me = fhMe(), mine = fhMembers().filter(fhtCanShare);
  if (!mine.some(m => m.id === FHT_SHARE)) FHT_SHARE = me && fhtCanShare(me) ? me.id : (mine[0] || {}).id || "";
  const m = fhMem(FHT_SHARE);
  if (!m) return `${fhFamSeg("sharing")}<p class="hos-hint">Pick who's using this phone first.</p>`;
  const others = fhMembers().filter(x => x.id !== m.id);
  return `${fhFamSeg("sharing")}
    <div class="fht-promise"><b>Nothing is forced public.</b><span>Each person decides who in the family sees each part of their profile. ${m.role === "child" ? "Parents always see a child's profile, because kids are profiles a parent manages." : ""}</span></div>
    ${mine.length > 1 ? `<div class="fh-chips" role="group" aria-label="Whose sharing">${mine.map(x => `<button class="fh-chip${x.id === m.id ? " on" : ""}" data-fhtsharefor="${x.id}" style="--tone:${x.color}">${x.face} ${esc(x.name)}</button>`).join("")}</div>` : ""}
    <form class="qa-form fh-form fht-share" data-fhtshare="${m.id}">${FH_FIELDS.map(([f, i, l]) => { const s = fhShareOf(m.id, f);
      return `<div class="fht-srow"><span class="fht-sl">${i} ${l}</span><select name="to_${f}" aria-label="${l}: who sees it">${FH_AUD.map(([k, ai, al]) => `<option value="${k}"${s.to === k ? " selected" : ""}>${ai} ${al}</option>`).join("")}</select>
        ${others.length ? `<div class="fht-some"><small>Picked people:</small>${others.map(o => `<label class="fh-chip" style="--tone:${o.color}"><input type="checkbox" name="s_${f}_${o.id}" value="1"${(s.ids || []).includes(o.id) ? " checked" : ""}><span>${o.face} ${esc(o.name)}</span></label>`).join("")}</div>` : ""}</div>`; }).join("")}
      <div class="fh-btns"><button class="btn fh-go">Save ${esc(m.name)}'s sharing</button></div></form>
    <p class="fine">The same rules decide every screen: the calendar's birthdays, the tree, profiles, photos and what Ask Family Hub reads. When sharing between phones turns on, they decide what leaves this phone too.</p>`;
}

// ------------------------------------------------------------ taps and forms
function fhtClick(ds) {
  const F = fh();
  if (ds.fhprof) { if (!fhtPerson(ds.fhprof)) return true; FHT_PROF = ds.fhprof; FH_EDIT = null; FH_MSG = ""; showFh("profile"); return true; }
  if (ds.fhtrel) { if (!fhAdult()) return true; FHT_PROF = ""; FH_EDIT = "prof:new"; FH_MSG = ""; showFh("profile"); return true; }
  if (ds.fhtedit) { const p = fhtPerson(ds.fhtedit); if (!p || !(fhtCanEdit(p) || fhAdult())) return true; FHT_PROF = p.id; FH_EDIT = "prof:" + p.id; FH_MSG = ""; showFh("profile"); return true; }
  if (ds.fhtsharefor) { const m = fhMem(ds.fhtsharefor); if (!m || !fhtCanShare(m)) return true; FHT_SHARE = m.id; showFh("sharing", FH_TAB === "sharing"); return true; }
  if (ds.fhtreldel) { const r = fhtRel(ds.fhtreldel); if (!r || !fhAdult()) return true; fhtForget(r.id); F.relatives = F.relatives.filter(x => x.id !== r.id);
    FHT_PROF = ""; save(); render(); showFh("tree", true); toast(`${r.name} removed from the tree`); return true; }
  if (ds.fhtpicdel) { const p = fhtPerson(ds.fhtpicdel); if (!p || !fhtCanEdit(p)) return true; const T = fhtP(p.id), old = T.pic; delete T.pic; save();
    if (old && typeof fhpDrop === "function") fhpDrop(old); showFh(); toast("Photo removed"); return true; }
  return false;
}
// A person leaving the family or the tree leaves no links behind.
function fhtForget(id) {
  const T = fh().tree; if (T[id] && T[id].pic && typeof fhpDrop === "function") fhpDrop(T[id].pic); delete T[id];
  Object.values(T).forEach(x => { if (!x || typeof x !== "object") return; if (Array.isArray(x.parents)) x.parents = x.parents.filter(p => p !== id); if (x.spouse === id) x.spouse = ""; });
}
function fhtSubmit(f, data) {
  const D = f.dataset, F = fh(), bad = m => { FH_MSG = m; fhMsgShow(); return true; };
  if (D.fhtprof) {
    const isNew = D.fhtprof === "new"; let p = isNew ? null : fhtPerson(D.fhtprof);
    if (isNew ? !fhAdult() : !p || !(fhtCanEdit(p) || fhAdult())) return true;
    if (isNew || p.kind === "rel") { const name = fhTxt(data.name, 40); if (!name) return bad("Type their name.");
      const face = FH_FACES.includes(data.face) && !FHT_PETS_OK.includes(data.face) ? data.face : "🙂";
      if (isNew) { const r = { id: uid(), name, face }; F.relatives.push(r); p = { ...r, kind: "rel" }; } else Object.assign(fhtRel(p.id), { name, face }); }
    const T = fhtP(p.id);
    if (p.kind === "rel") Object.assign(T, { born: fhTxt(data.born, 20), passed: !!data.passed, died: data.passed ? fhTxt(data.died, 20) : "" });
    if (fhAdult()) { const ok = new Set(fhtPeople().map(x => x.id)), no = fhtDesc(p.id), good = v => ok.has(v) && v !== p.id && !no.has(v) ? v : "";
      T.parents = [...new Set([good(data.par1), good(data.par2)].filter(Boolean))];
      const sp = good(data.spouse), old = T.spouse;
      if (old && old !== sp && fhtP(old).spouse === p.id) fhtP(old).spouse = "";
      T.spouse = sp; if (sp) { const S2 = fhtP(sp); if (S2.spouse && S2.spouse !== p.id && fhtPerson(S2.spouse)) fhtP(S2.spouse).spouse = ""; S2.spouse = p.id; } }
    if (isNew || fhtCanEdit(p)) { FHT_TEXT.forEach(([k, , , n]) => { T[k] = fhTxt(data[k], n); }); FHT_LONG.forEach(([k, , , n]) => { T[k] = String(data[k] == null ? "" : data[k]).trim().slice(0, n); }); }
    FHT_PROF = p.id; FH_EDIT = null; FH_MSG = ""; save(); render(); showFh("profile", true); toast(`${p.face || "🙂"} ${p.name} saved`); return true;
  }
  if (D.fhtshare) {
    const m = fhMem(D.fhtshare); if (!m || !fhtCanShare(m)) return true;
    const S2 = F.share[m.id] && typeof F.share[m.id] === "object" ? F.share[m.id] : (F.share[m.id] = {}), others = fhMembers().filter(x => x.id !== m.id);
    FH_FIELDS.forEach(([k]) => { const to = FH_AUD.some(a => a[0] === data["to_" + k]) ? data["to_" + k] : "all";
      S2[k] = { to, ids: to === "some" ? others.filter(o => data[`s_${k}_${o.id}`]).map(o => o.id) : [] }; });
    save(); render(); showFh("sharing", true); toast(`🔐 ${m.name}'s sharing saved`); return true;
  }
  return false;
}

fhMod({
  id: "tree",
  tabs: [["tree", "🌳", "Family tree"], ["sharing", "🔐", "Who sees what"], ["profile", "👤", "Profile"]],
  panes: { tree: fhtTreeHtml, profile: fhtProfHtml, sharing: fhtShareHtml },
  click: fhtClick,
  submit: fhtSubmit,
  repair: (F, o) => { if (!Array.isArray(F.relatives)) F.relatives = []; else if (!F.relatives.every(o)) F.relatives = F.relatives.filter(o); if (!o(F.tree)) F.tree = {};
    F.relatives.forEach(r => { r.face = fhOkIc(r.face, "🙂"); }); },
  forget: id => fhtForget(id),
  adds: () => fhAdult() ? [{ icon: "🌳", label: "Relative", attrs: 'data-fhtrel="new"', tone: "#10ac84" }] : [],
  context: () => ({ familyTree: fhtPeople().map(p => { const T = fhtP(p.id);
    return { name: p.name, relative: p.kind === "rel" || undefined, passed: T.passed || undefined, parents: T.parents.map(fhtName).filter(Boolean),
      partner: T.spouse ? fhtName(T.spouse) || undefined : undefined, bornIn: fhtVis(p, "place") && T.place ? T.place : undefined,
      heritage: fhtVis(p, "heritage") && T.heritage ? T.heritage : undefined }; }) })
});
