/* SAVE AS: familylife.js · LOCATION: C:/MarvelApps/dayhub/familylife.js
 * FAMILY HUB - THE MORE PAGES (Scott's boards 11/07: Meals, School, Documents, Pets, Goals, Trips). Loaded after familyphotos.js
 * (Documents keep their pictures in its store) and registered with family.js through fhMod.
 *   Meals & recipes: dinner for the next 7 days, the family's recipes, "add the ingredients to the grocery list".
 *   School & activities: homework (a kid adds and checks off their own), pickups and drop-offs by weekday, the activities on the
 *          calendar, the School supplies list.
 *   Documents: pictures of IDs, insurance cards, school forms, car and house papers, on this phone only. Parents only unless the
 *          person who added one says otherwise. Medical records stay in Health Hub (Family Hub keeps no health data).
 *   Pets: each pet's card (vet, food, notes), care jobs that become chores, vet visits on the calendar.
 *   Goals: family goals with a count ("Read 20 books", "12 game nights"). No money goals - Family Hub keeps no family finances.
 *   Trips: the trips on the calendar with a countdown, a packing list, and Trip Hub / Cruise Hub for the planning.
 */
"use strict";
let FHL_MV = "week", FHL_REC = "", FHL_DOC = "", FHL_DT = "id", FHL_DWHO = "", FHL_DTO = "parents";
const FHL_SUBJ = ["Math", "Reading", "Writing", "Spelling", "Science", "History", "Art", "Music", "Other"];
const FHL_DOCS = [["id", "🪪", "ID card"], ["ins", "🛡️", "Car or home insurance"], ["school", "🎒", "School form"], ["car", "🚗", "Car papers"], ["house", "🏠", "House papers"],
  ["pet", "🐾", "Pet papers"], ["travel", "🛂", "Travel papers"], ["other", "📄", "Other"]];
const FHL_PETK = [["🐶", "Dog"], ["🐱", "Cat"], ["🐟", "Fish"], ["🐦", "Bird"], ["🐰", "Rabbit"], ["🐹", "Small pet"], ["🐴", "Horse"], ["🦎", "Reptile"]];
const FHL_GOALIC = ["🎯", "📚", "🏃", "🎮", "🏕️", "🧩", "🎨", "🎵", "🌱", "🍳", "🙏", "⚽"];

const fhlKids = () => fhMembers().filter(m => m.role === "child");
const fhlDays = () => [...Array(7)].map((_, i) => addDays(today(), i));
const fhlDayName = d => d === today() ? "Today" : d === addDays(today(), 1) ? "Tomorrow" : FH_WD[parseDay(d).getDay()];
function fhlList(name, icon) {       // the family's list with this icon (or name); made if it isn't there
  const F = fh(); let L = F.lists.find(l => l.icon === icon) || F.lists.find(l => l.name.toLowerCase() === name.toLowerCase());
  if (!L) { L = { id: uid(), name, icon, items: [] }; F.lists.push(L); }
  return L;
}
function fhlAddIngs(r) {
  const L = fhlList("Grocery", "🛒"), have = new Set(L.items.filter(i => !i.done).map(i => i.text.toLowerCase())), me = fhMe();
  const add = r.ings.filter(x => x && !have.has(x.toLowerCase()));
  add.forEach(text => L.items.push({ id: uid(), text: text.slice(0, 60), by: me && me.id, done: false, at: Date.now() }));
  return add.length;
}

// ------------------------------------------------------------ MEALS & RECIPES
function fhlMealsHtml() {
  if (FH_EDIT && FH_EDIT.startsWith("rec:")) return fhlRecForm();
  const seg = `<div class="fh-seg" role="tablist" aria-label="Meals">${[["week", "Meal plan"], ["recipes", "Recipes"]].map(([k, l]) => `<button role="tab" aria-selected="${FHL_MV === k}" class="${FHL_MV === k ? "on" : ""}" data-fhlmv="${k}">${l}</button>`).join("")}</div>`;
  const R = fh().recipes, adult = fhAdult();
  if (FHL_MV === "recipes") {
    const r = R.find(x => x.id === FHL_REC);
    if (r) return seg + `<button class="mv-linkb fh-link" data-fhlrec="">‹ All recipes</button><h3 class="fh-listh">🍳 ${esc(r.name)}</h3>
      ${r.ings.length ? `<div class="mv-sec"><h3>Ingredients</h3></div><ul class="fhl-ings">${r.ings.map(i => `<li>${esc(i)}</li>`).join("")}</ul>
        <button class="btn fh-go" data-fhlings="${r.id}">🛒 Add them to the grocery list</button>` : ""}
      ${r.steps ? `<div class="mv-sec"><h3>How to make it</h3></div><p class="fhl-steps">${esc(r.steps)}</p>` : ""}
      ${adult ? `<div class="fh-btns"><button class="btn sm ghost" data-fhlrecedit="${r.id}">✎ Edit</button></div>` : ""}`;
    return seg + `${R.length ? `<div class="fh-lists">${R.map(x => `<button class="fh-listbtn" data-fhlrec="${x.id}"><span class="fh-listic" aria-hidden="true">🍳</span><span class="grow"><b>${esc(x.name)}</b>
        <small>${x.ings.length} ingredient${x.ings.length === 1 ? "" : "s"}</small></span><em>›</em></button>`).join("")}</div>` : `<p class="hos-hint">No recipes yet. Keep Grandma's chili here.</p>`}
      ${adult ? `<button class="btn fh-go" data-fhlrecedit="new">＋ Add a recipe</button>` : ""}`;
  }
  const M = fh().meals, days = fhlDays();
  if (!adult) return seg + `<div class="fhl-meals">${days.map(d => { const x = M[d] || {}; return `<div class="fhl-meal ro"><span><b>${fhlDayName(d)}</b><small>${esc(prettyDate(d))}</small></span><p>${esc(x.d || "-")}</p></div>`; }).join("")}</div>`;
  return seg + `<form class="qa-form fh-form" data-fhlmeals="1"><div class="fhl-meals">${days.map(d => { const x = M[d] || {}, r = x.rid && R.find(y => y.id === x.rid);
      return `<div class="fhl-meal"><label><span><b>${fhlDayName(d)}</b><small>${esc(prettyDate(d))}</small></span><input name="m_${d}" value="${esc(x.d || "")}" list="fhlRec" maxlength="60" placeholder="What's for dinner?" aria-label="Dinner ${esc(fhlDayName(d))}"></label>
        ${r && r.ings.length ? `<button type="button" class="btn sm ghost" data-fhlings="${r.id}" aria-label="Add the ${esc(r.name)} ingredients to the grocery list">🛒</button>` : ""}</div>`; }).join("")}</div>
    <datalist id="fhlRec">${R.map(r => `<option value="${esc(r.name)}"></option>`).join("")}</datalist>
    <button class="btn fh-go">Save the week</button></form>
    <p class="fine">Type a recipe's name and its 🛒 button adds the ingredients to the grocery list.</p>`;
}
function fhlRecForm() {
  const id = FH_EDIT.slice(4), r = id !== "new" && fh().recipes.find(x => x.id === id);
  if (id !== "new" && !r) { FH_EDIT = null; return fhlMealsHtml(); }
  const v = r || { name: "", ings: [], steps: "" };
  return `<form class="qa-form fh-form" data-fhlrecipe="${r ? r.id : "new"}">
    <label class="field">Recipe<input name="name" value="${esc(v.name)}" maxlength="60" required placeholder="e.g. Grandma's chili"></label>
    <label class="field">Ingredients - one per line<textarea name="ings" rows="6" maxlength="1500" placeholder="1 lb ground beef&#10;2 cans beans&#10;1 onion">${esc(v.ings.join("\n"))}</textarea></label>
    <label class="field">How to make it<textarea name="steps" rows="6" maxlength="3000">${esc(v.steps)}</textarea></label>
    <div class="fh-btns"><button class="btn fh-go">Save</button><button type="button" class="btn sm ghost" data-fhcancel="1">Cancel</button></div>
    ${r ? `<div class="fh-btns fh-danger"><button type="button" class="btn sm ghost" data-fhlrecdel="${r.id}">🗑️ Delete recipe</button></div>` : ""}</form>`;
}

// ------------------------------------------------------------ SCHOOL & ACTIVITIES
const fhlHwCan = h => fhAdult() || (!!fhMe() && fhMe().role === "child" && h.who === fhMe().id);
function fhlSchoolHtml() {
  const t = today(), me = fhMe(), adult = fhAdult(), kid = me && me.role === "child";
  const H = fh().hw.filter(h => adult || (me && (h.who === me.id || me.role === "guest"))).sort((a, b) => (a.done - b.done) || (a.due || "9").localeCompare(b.due || "9"));
  const kids = kid ? [me] : fhlKids(), P = fh().pickups, wd = parseDay(t).getDay();
  const acts = [...Array(14)].map((_, i) => addDays(t, i)).flatMap(d => fhDay(d).filter(x => x.e && ["school", "sports", "lesson"].includes(x.e.kind)).map(x => ({ ...x, d }))).slice(0, 8);
  const sch = fh().lists.find(l => l.icon === "🎒");
  return `<div class="mv-sec"><h3>📚 Homework</h3>${H.filter(h => !h.done).length ? `<small class="fh-count">${H.filter(h => !h.done).length}</small>` : ""}</div>
    ${H.length ? H.slice(0, 30).map(h => `<div class="fh-item${h.done ? " done" : ""}" style="--tone:${fhColor(h.who)}">${fhlHwCan(h) ? `<button class="fh-tick" data-fhlhw="${h.id}" aria-pressed="${h.done ? "true" : "false"}" aria-label="${esc(h.title)} done">${h.done ? "✓" : ""}</button>` : ""}
        ${fhDot(h.who)}<span class="grow"><b>${esc(h.subj ? h.subj + ": " : "")}${esc(h.title)}</b><small>${esc(fhName(h.who))}${h.due ? ` · due ${esc(fhRel(h.due))}` : ""}${!h.done && h.due && h.due < t ? " · late" : ""}</small></span>
        ${fhlHwCan(h) ? `<button class="fh-x" data-fhlhwdel="${h.id}" aria-label="Remove ${esc(h.title)}">✕</button>` : ""}</div>`).join("") : `<p class="hos-hint">No homework on the list.</p>`}
    ${kids.length && (adult || kid) ? `<form class="qa-form fh-form" data-fhlhwadd="1"><div class="fh-two"><label class="field">Who<select name="who">${kids.map(k => `<option value="${k.id}">${k.face} ${esc(k.name)}</option>`).join("")}</select></label>
        <label class="field">Subject<select name="subj"><option value="">-</option>${FHL_SUBJ.map(s => `<option>${s}</option>`).join("")}</select></label></div>
      <div class="fh-two"><label class="field">What<input name="title" maxlength="80" required placeholder="e.g. Worksheet page 12"></label><label class="field">Due<input type="date" name="due" value="${esc(addDays(t, 1))}"></label></div>
      <button class="btn sm fh-go">Add homework</button></form>` : ""}
    <div class="mv-sec"><h3>🚗 Pickups &amp; drop-offs</h3></div>
    ${P.length ? [0, 1, 2, 3, 4, 5, 6].map(i => (wd + i) % 7).filter(d => P.some(p => +p.day === d)).map(d => `<div class="fhl-pday${d === wd ? " now" : ""}"><b>${d === wd ? "Today" : FH_WD[d]}</b>
        ${P.filter(p => +p.day === d).sort((a, b) => (a.time || "").localeCompare(b.time || "")).map(p => `<div class="fh-item"><span class="fhl-ptime">${p.time ? esc(hm(p.time)) : ""}</span><span class="grow"><b>${p.kid ? `${fhFace(p.kid)} ${esc(fhName(p.kid))}` : "The kids"}${p.where ? ` · ${esc(p.where)}` : ""}</b>
          <small>${p.drop ? "Drop-off" : "Pickup"}${p.by ? ` · ${esc(fhName(p.by))} drives` : ""}</small></span>${adult ? `<button class="fh-x" data-fhlpdel="${p.id}" aria-label="Remove">✕</button>` : ""}</div>`).join("")}</div>`).join("")
      : `<p class="hos-hint">Nothing set up. Add who picks up whom, and when.</p>`}
    ${adult ? `<form class="qa-form fh-form" data-fhlpick="1"><div class="fh-two"><label class="field">Day<select name="day">${FH_WD.map((d, i) => `<option value="${i}"${i === wd ? " selected" : ""}>${d}</option>`).join("")}</select></label>
        <label class="field">Time<input type="time" name="time" value="15:15"></label></div>
      <div class="fh-two"><label class="field">Who<select name="kid"><option value="">The kids</option>${fhlKids().map(k => `<option value="${k.id}">${k.face} ${esc(k.name)}</option>`).join("")}</select></label>
        <label class="field">Driver<select name="by"><option value="">-</option>${fhMembers().filter(m => m.role !== "child").map(m => `<option value="${m.id}">${m.face} ${esc(m.name)}</option>`).join("")}</select></label></div>
      <div class="fh-two"><label class="field">Where<input name="where" maxlength="60" placeholder="e.g. School, front loop"></label><label class="field">Kind<select name="drop"><option value="">Pickup</option><option value="1">Drop-off</option></select></label></div>
      <button class="btn sm fh-go">Add to the week</button></form>` : ""}
    <div class="mv-sec"><h3>⚽ Activities</h3><button data-fhtab="cal">Calendar</button></div>
    ${acts.length ? `<div class="fh-agenda">${acts.map(x => fhAgendaRow(x, true)).join("")}</div>` : `<p class="hos-hint">School, sports and lessons you put on the calendar show here.</p>`}
    ${sch ? `<button class="fh-listbtn" data-fhlist="${sch.id}"><span class="fh-listic" aria-hidden="true">🎒</span><span class="grow"><b>School supplies</b><small>${sch.items.filter(i => !i.done).length} to get</small></span><em>›</em></button>` : ""}`;
}

// ------------------------------------------------------------ DOCUMENTS (pictures on this phone)
const fhlDocSees = d => fhAudOk({ to: d.to, ids: d.ids }, d.by);
const fhlDocCan = d => { const me = fhMe(), o = fhMem(d.by); return !!me && fhlDocSees(d) && (me.id === d.by || (fhAdult() && (!o || o.role === "child"))); };
const fhlDocT = k => FHL_DOCS.find(x => x[0] === k) || FHL_DOCS[FHL_DOCS.length - 1];
function fhlDocsHtml() {
  const L = fh().docs.filter(fhlDocSees), big = FHL_DOC && L.find(d => d.id === FHL_DOC);
  if (big) { const T = fhlDocT(big.type);
    return `<button class="mv-linkb fh-link" data-fhldoc="">‹ All documents</button>
      <figure class="fhp-big"><img data-fhpimg="${big.id}" data-fhpfull="1" alt="${esc(big.title)}"><figcaption><b>${T[1]} ${esc(big.title)}</b><small>Added by ${esc(fhName(big.by))} · ${esc(prettyDate(big.date))}</small></figcaption></figure>
      ${fhlDocCan(big) ? `<form class="qa-form fh-form" data-fhldocedit="${big.id}"><label class="field">Name<input name="title" value="${esc(big.title)}" maxlength="60"></label>
        <label class="field">Who sees it<select name="to">${FH_AUD.filter(a => a[0] !== "some").map(([k, i, l]) => `<option value="${k}"${big.to === k ? " selected" : ""}>${i} ${l}</option>`).join("")}</select></label>
        <div class="fh-btns"><button class="btn fh-go">Save</button></div><div class="fh-btns fh-danger"><button type="button" class="btn sm ghost" data-fhldocdel="${big.id}">🗑️ Delete</button></div></form>` : ""}`; }
  FHL_DOC = "";
  return `${fhAdult() ? `<div class="fhl-docadd"><div class="fh-two"><label class="field">Kind<select data-fhldt="1">${FHL_DOCS.map(([k, i, l]) => `<option value="${k}"${FHL_DT === k ? " selected" : ""}>${i} ${l}</option>`).join("")}</select></label>
      <label class="field">Whose<select data-fhldwho="1"><option value="">The family</option>${fhMembers().map(m => `<option value="${m.id}"${FHL_DWHO === m.id ? " selected" : ""}>${m.face} ${esc(m.name)}</option>`).join("")}</select></label></div>
      <label class="field">Who sees it<select data-fhldto="1">${FH_AUD.filter(a => a[0] !== "some").map(([k, i, l]) => `<option value="${k}"${FHL_DTO === k ? " selected" : ""}>${i} ${l}</option>`).join("")}</select></label>
      <label class="btn fh-go">📷 Add a picture of it<input type="file" accept="image/*" data-fhldocadd="1" hidden></label></div>` : ""}
    <div class="fhp-grid fhl-docs">${L.map(d => { const T = fhlDocT(d.type); return `<figure class="fhp-ph"><button data-fhldoc="${d.id}" aria-label="Open ${esc(d.title)}"><img data-fhpimg="${d.id}" alt=""></button>
      <figcaption><b>${T[1]} ${esc(d.title)}</b><small>${d.to === "me" ? "🔒 only " + esc(fhName(d.by)) : d.to === "all" ? "whole family" : "parents"}</small></figcaption></figure>`; }).join("") || `<p class="hos-hint">No documents yet. Snap the car insurance card and IDs first - they're the ones you reach for.</p>`}</div>
    <p class="fine">Pictures stay on this phone only - never in the backup. Parents see them unless you choose otherwise. Medical records belong in Health Hub.</p>`;
}

// ------------------------------------------------------------ PETS
function fhlPetsHtml() {
  if (FH_EDIT && FH_EDIT.startsWith("pet:")) return fhlPetForm();
  const t = today(), adult = fhAdult(), P = fh().pets;
  return `${P.length ? P.map(p => { const care = fh().chores.filter(c => c.pet === p.id), ev = fhlPetEvents(p, t);
      const age = fhIsD(p.bday) ? Math.floor(-daysUntil(p.bday) / 365.25) : null;
      return `<div class="fhl-pet"><div class="fhl-pethead"><span class="fh-bigface" aria-hidden="true">${p.kind}</span><span class="grow"><b>${esc(p.name)}</b><small>${esc((FHL_PETK.find(k => k[0] === p.kind) || ["", "Pet"])[1])}${age !== null && age >= 0 ? ` · ${age} yr${age === 1 ? "" : "s"}` : ""}</small></span>
          ${adult ? `<button class="btn sm ghost" data-fhlpetedit="${p.id}">Edit</button>` : ""}</div>
        ${p.vet ? `<p>🩺 <b>Vet:</b> ${esc(p.vet)}${p.vetph ? ` · <a href="tel:${esc(p.vetph.replace(/[^\d+]/g, ""))}">${esc(p.vetph)}</a>` : ""}</p>` : ""}${p.food ? `<p>🥣 <b>Food:</b> ${esc(p.food)}</p>` : ""}${p.notes ? `<p>📝 ${esc(p.notes)}</p>` : ""}
        <div class="mv-sec"><h3>Care jobs</h3></div>${care.length ? care.map(c => `<button class="fh-row" ${adult ? `data-fhchedit="${c.id}"` : 'data-fhtab="tasks"'} style="--tone:${fhColor(c.who)}">${fhDot(c.who)}<span class="grow"><b>${esc(c.title)}</b>
          <small>${esc(fhName(c.who))} · ${c.every === "daily" ? "every day" : c.every === "weekly" ? "every " + FH_WD[+c.day || 0] : "once"}</small></span></button>`).join("") : `<p class="fh-free">none yet</p>`}
        ${adult ? `<form class="fh-additem" data-fhlcare="${p.id}"><input name="title" maxlength="60" placeholder="e.g. Feed ${esc(p.name)}" aria-label="Care job for ${esc(p.name)}" required>
          <select name="every" aria-label="How often"><option value="daily">Every day</option><option value="weekly">Every week</option></select>
          <select name="who" aria-label="Who">${fhMembers().filter(m => m.role !== "guest").map(m => `<option value="${m.id}">${m.face} ${esc(m.name)}</option>`).join("")}</select><button class="btn sm fh-go">Add</button></form>` : ""}
        ${ev.length ? `<div class="mv-sec"><h3>Coming up</h3></div><div class="fh-agenda">${ev.map(x => fhAgendaRow(x, true)).join("")}</div>` : ""}
        ${adult ? `<button class="btn sm ghost" data-fhlvet="${p.id}">📅 Add a vet visit</button>` : ""}</div>`; }).join("")
    : `<p class="hos-hint">No pets yet. Dogs, cats, fish, the class hamster for the weekend - add them.</p>`}
    ${adult ? `<button class="btn fh-go" data-fhlpetedit="new">＋ Add a pet</button>` : ""}
    <p class="fine">Care jobs are chores: whoever does them checks them off, a parent OKs them.</p>`;
}
function fhlPetEvents(p, t) {
  return [...Array(60)].map((_, i) => addDays(t, i)).flatMap(d => fhDay(d).filter(x => x.e && x.e.kind === "pet" && (x.e.pet === p.id || x.e.title.toLowerCase().includes(p.name.toLowerCase()))).map(x => ({ ...x, d }))).slice(0, 4);
}
function fhlPetForm() {
  const id = FH_EDIT.slice(4), p = id !== "new" && fh().pets.find(x => x.id === id);
  if (id !== "new" && !p) { FH_EDIT = null; return fhlPetsHtml(); }
  const v = p || { name: "", kind: "🐶", bday: "", vet: "", vetph: "", food: "", notes: "" };
  return `<form class="qa-form fh-form" data-fhlpet="${p ? p.id : "new"}">
    <label class="field">Name<input name="name" value="${esc(v.name)}" maxlength="30" required placeholder="e.g. Biscuit"></label>
    <fieldset class="fh-faces"><legend>Kind</legend>${FHL_PETK.map(([k, l]) => `<label><input type="radio" name="kind" value="${k}"${v.kind === k ? " checked" : ""}><span title="${l}">${k}</span></label>`).join("")}</fieldset>
    <label class="field">Birthday or gotcha day (optional)<input type="date" name="bday" value="${esc(v.bday || "")}"></label>
    <div class="fh-two"><label class="field">Vet<input name="vet" value="${esc(v.vet || "")}" maxlength="60" placeholder="e.g. Oak Street Animal Clinic"></label><label class="field">Vet phone<input name="vetph" type="tel" value="${esc(v.vetph || "")}" maxlength="30"></label></div>
    <label class="field">Food<input name="food" value="${esc(v.food || "")}" maxlength="80" placeholder="e.g. 1 cup morning and night"></label>
    <label class="field">Notes<textarea name="notes" rows="3" maxlength="400" placeholder="Walks, tricks, the gate that sticks">${esc(v.notes || "")}</textarea></label>
    <div class="fh-btns"><button class="btn fh-go">Save</button><button type="button" class="btn sm ghost" data-fhcancel="1">Cancel</button></div>
    ${p ? `<div class="fh-btns fh-danger"><button type="button" class="btn sm ghost" data-fhlpetdel="${p.id}">Remove ${esc(p.name)}</button></div>` : ""}</form>`;
}

// ------------------------------------------------------------ GOALS
const fhlGoalCan = g => fhAdult() || (!!fhMe() && fhMe().role !== "guest" && (!g.who.length || g.who.includes(fhMe().id)));
function fhlGoalsHtml() {
  const G = fh().goals, adult = fhAdult();
  return `${G.length ? G.map(g => { const pct = Math.min(100, Math.round((g.have / Math.max(1, g.target)) * 100)), done = g.have >= g.target;
      return `<div class="fhl-goal${done ? " done" : ""}"><span class="fhl-goalic" aria-hidden="true">${g.icon}</span><div class="grow"><b>${esc(g.title)}</b>
        <small>${g.have} of ${g.target} ${esc(g.unit || "")}${g.by ? ` · by ${esc(prettyDate(g.by))}` : ""}${g.who.length ? " · " + g.who.map(fhName).map(esc).join(", ") : " · the whole family"}</small>
        <i class="fhl-bar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-label="${esc(g.title)}"><i style="width:${pct}%"></i></i></div>
        ${done ? `<strong>🎉</strong>` : fhlGoalCan(g) ? `<button class="btn sm fh-go" data-fhlgoal="${g.id}" aria-label="Add one to ${esc(g.title)}">+1</button>` : ""}
        ${adult ? `<button class="fh-x" data-fhlgoaldel="${g.id}" aria-label="Delete ${esc(g.title)}">✕</button>` : ""}</div>`; }).join("") : `<p class="hos-hint">No family goals yet. Read 20 books, hike 10 trails, 12 game nights - pick one together.</p>`}
    ${adult ? `<form class="qa-form fh-form" data-fhlgoaladd="1"><div class="mv-sec"><h3>New goal</h3></div>
      <label class="field">Goal<input name="title" maxlength="60" required placeholder="e.g. Read 20 books this summer"></label>
      <div class="fh-two"><label class="field">How many<input type="number" name="target" min="1" max="1000" value="10" inputmode="numeric"></label><label class="field">Of what<input name="unit" maxlength="20" placeholder="books"></label></div>
      <div class="fh-two"><label class="field">Icon<select name="icon">${FHL_GOALIC.map(i => `<option>${i}</option>`).join("")}</select></label><label class="field">By (optional)<input type="date" name="by"></label></div>
      <fieldset class="fh-pick"><legend>Who's in it</legend>${fhMembers().filter(m => m.role !== "guest").map(m => `<label class="fh-chip" style="--tone:${m.color}"><input type="checkbox" name="w_${m.id}" value="1"><span>${m.face} ${esc(m.name)}</span></label>`).join("")}<small>None picked = the whole family.</small></fieldset>
      <button class="btn fh-go">Add the goal</button></form>` : ""}`;
}

// ------------------------------------------------------------ TRIPS
function fhlTripsHtml() {
  const t = today(), T = fh().events.filter(e => e.kind === "trip" && fhCan("see", e) && e.date >= t).sort((a, b) => a.date.localeCompare(b.date)), pk = fh().lists.find(l => l.icon === "🧳");
  const hub = id => typeof HUBS !== "undefined" ? HUBS.find(h => h.id === id) : null, th = hub("triphub"), ch = hub("cruisehub");
  return `${T.length ? T.map(e => { const n = daysUntil(e.date); return `<button class="fh-row fhl-trip" ${fhCan("event") ? `data-fhevedit="${e.id}@${e.date}"` : 'data-fhtab="cal"'} style="--tone:#00b4d8">${fhIc("🧳", "#00b4d8", "sm")}
      <span class="grow"><b>${esc(e.title)}</b><small>${esc(prettyDate(e.date))}${e.where ? " · " + esc(e.where) : ""}</small></span><strong>${n === 0 ? "Today!" : n === 1 ? "Tomorrow" : `${n} days`}</strong></button>`; }).join("")
    : `<p class="hos-hint">No trips on the calendar yet.</p>`}
    <div class="fh-btns">${fhCan("event") ? `<button class="btn fh-go" data-fhltrip="1">＋ Add a trip</button>` : ""}<button class="btn sm ghost" data-fhlpack="1">🧳 Packing list${pk ? ` (${pk.items.filter(i => !i.done).length})` : ""}</button></div>
    <div class="mv-sec"><h3>Plan it</h3></div>
    ${th ? `<a class="fh-listbtn" href="${esc(th.url)}" target="_blank" rel="noopener"><span class="fh-listic" aria-hidden="true">✈️</span><span class="grow"><b>Trip Hub</b><small>Flights, hotels and road trips</small></span><em>›</em></a>` : ""}
    ${ch ? `<a class="fh-listbtn" href="${esc(ch.url)}" target="_blank" rel="noopener"><span class="fh-listic" aria-hidden="true">🚢</span><span class="grow"><b>Cruise Hub</b><small>Countdown, port days and all-aboard alarms</small></span><em>›</em></a>` : ""}
    <p class="fine">A trip on the family calendar shows here with its countdown. Add the reminders you want on the trip itself (1 week before, 1 day before).</p>`;
}

// ------------------------------------------------------------ taps
function fhlClick(ds) {
  const F = fh(), me = fhMe(), adult = fhAdult();
  if (ds.fhlmv) { FHL_MV = ds.fhlmv === "recipes" ? "recipes" : "week"; FHL_REC = ""; showFh("meals"); return true; }
  if (ds.fhlrec !== undefined) { FHL_MV = "recipes"; FHL_REC = ds.fhlrec; showFh("meals"); return true; }
  if (ds.fhlrecedit) { if (!adult) return true; FH_EDIT = "rec:" + ds.fhlrecedit; FH_MSG = ""; showFh("meals"); return true; }
  if (ds.fhlrecdel) { if (!adult) return true; F.recipes = F.recipes.filter(r => r.id !== ds.fhlrecdel); Object.values(F.meals).forEach(x => { if (x && x.rid === ds.fhlrecdel) x.rid = ""; });
    FH_EDIT = null; FHL_REC = ""; save(); showFh("meals"); toast("🗑️ Recipe deleted"); return true; }
  if (ds.fhlings) { const r = F.recipes.find(x => x.id === ds.fhlings); if (!r || !fhCan("listAdd")) return true; const n = fhlAddIngs(r); save(); render(); showFh(); toast(n ? `🛒 ${n} added to the grocery list` : "🛒 Already on the grocery list"); return true; }
  if (ds.fhlhw) { const h = F.hw.find(x => x.id === ds.fhlhw); if (!h || !fhlHwCan(h)) return true; h.done = !h.done; h.at = Date.now(); save(); render(); showFh("school"); if (h.done) toast(`📚 Done: ${h.title}`); return true; }
  if (ds.fhlhwdel) { const h = F.hw.find(x => x.id === ds.fhlhwdel); if (!h || !fhlHwCan(h)) return true; F.hw = F.hw.filter(x => x.id !== h.id); save(); render(); showFh("school"); return true; }
  if (ds.fhlpdel) { if (!adult) return true; F.pickups = F.pickups.filter(p => p.id !== ds.fhlpdel); save(); render(); showFh("school"); return true; }
  if (ds.fhldoc !== undefined) { FHL_DOC = ds.fhldoc; showFh("docs"); return true; }
  if (ds.fhldocdel) { const d = F.docs.find(x => x.id === ds.fhldocdel); if (!d || !fhlDocCan(d)) return true; F.docs = F.docs.filter(x => x.id !== d.id); if (typeof fhpDrop === "function") fhpDrop(d.id);
    FHL_DOC = ""; save(); showFh("docs"); toast("🗑️ Document deleted"); return true; }
  if (ds.fhlpetedit) { if (!adult) return true; FH_EDIT = "pet:" + ds.fhlpetedit; FH_MSG = ""; showFh("pets"); return true; }
  if (ds.fhlpetdel) { if (!adult) return true; const p = F.pets.find(x => x.id === ds.fhlpetdel); F.pets = F.pets.filter(x => x.id !== ds.fhlpetdel); F.chores.forEach(c => { if (c.pet === ds.fhlpetdel) delete c.pet; });
    FH_EDIT = null; save(); render(); showFh("pets"); if (p) toast(`${p.name} removed`); return true; }
  if (ds.fhlvet) { if (!fhCan("event")) return true; const p = F.pets.find(x => x.id === ds.fhlvet); FH_EVKIND = "pet"; FH_EVTITLE = p ? `${p.name}: vet visit` : ""; FH_EVPET = p ? p.id : "";
    FH_EDIT = `ev:new@${today()}`; FH_MSG = ""; showFh("cal"); return true; }
  if (ds.fhlgoal) { const g = F.goals.find(x => x.id === ds.fhlgoal); if (!g || !fhlGoalCan(g) || g.have >= g.target) return true; g.have++; g.at = Date.now(); save(); render(); showFh("goals");
    toast(g.have >= g.target ? `🎉 Goal reached: ${g.title}!` : `${g.icon} ${g.have} of ${g.target}`); return true; }
  if (ds.fhlgoaldel) { if (!adult) return true; F.goals = F.goals.filter(g => g.id !== ds.fhlgoaldel); save(); showFh("goals"); return true; }
  if (ds.fhltrip) { if (!fhCan("event")) return true; FH_EVKIND = "trip"; FH_EDIT = `ev:new@${today()}`; FH_MSG = ""; showFh("cal"); return true; }
  if (ds.fhlpack) { if (!fhCan("listAdd")) return true; const L = fhlList("Packing", "🧳"); save(); FH_LIST = L.id; showFh("lists"); return true; }
  return false;
}
if (typeof document !== "undefined") document.addEventListener("change", async e => {
  const t = e.target; if (typeof MODE === "undefined" || MODE !== "family" || !t || !t.dataset) return;
  if (t.dataset.fhldt) { FHL_DT = FHL_DOCS.some(d => d[0] === t.value) ? t.value : "other"; return; }
  if (t.dataset.fhldwho !== undefined && t.matches("select[data-fhldwho]")) { FHL_DWHO = fhMem(t.value) ? t.value : ""; return; }
  if (t.dataset.fhldto) { FHL_DTO = FH_AUD.some(a => a[0] === t.value) ? t.value : "parents"; return; }
  if (t.dataset.fhldocadd && t.files && t.files[0]) { if (!fhAdult() || typeof fhpPutFile !== "function") return;
    if (fhPaused()) { toast(fhPauseWhy()); t.value = ""; return; }
    try { const id = await fhpPutFile(t.files[0]), T = fhlDocT(FHL_DT);
      fh().docs.unshift({ id, type: T[0], title: `${T[2]}${FHL_DWHO ? " - " + fhName(FHL_DWHO) : ""}`, who: FHL_DWHO, to: FHL_DTO, ids: [], by: (fhMe() || {}).id, date: today(), at: Date.now() });
      save(); showFh("docs"); toast(`${T[1]} Saved on this phone`); } catch (err) { toast("That didn't look like a picture"); }
    t.value = ""; }
});

// ------------------------------------------------------------ forms
function fhlSubmit(f, data) {
  const D = f.dataset, F = fh(), t = today(), me = fhMe(), adult = fhAdult(), bad = m => { FH_MSG = m; fhMsgShow(); return true; };
  if (D.fhlmeals) { if (!adult) return true;
    const paused = fhPaused(); let held = 0;                                       // after the trial: days already planned can change, new ones wait
    fhlDays().forEach(d => { const v = fhTxt(data["m_" + d], 60), r = v && F.recipes.find(x => x.name.toLowerCase() === v.toLowerCase());
      if (paused && v && !F.meals[d]) { held++; return; }
      if (v) F.meals[d] = { d: v, rid: r ? r.id : "" }; else delete F.meals[d]; });
    Object.keys(F.meals).forEach(k => { if (!fhIsD(k) || k < addDays(t, -30)) delete F.meals[k]; });
    save(); render(); showFh("meals"); toast(held ? fhPauseWhy() : "🍽️ Meal plan saved"); return true; }
  if (D.fhlrecipe) { if (!adult) return true; const name = fhTxt(data.name, 60); if (!name) return bad("Name the recipe.");
    const vals = { name, ings: String(data.ings || "").split(/\r?\n/).map(x => fhTxt(x, 60)).filter(Boolean).slice(0, 40), steps: String(data.steps || "").trim().slice(0, 3000), at: Date.now() };
    const r = D.fhlrecipe !== "new" && F.recipes.find(x => x.id === D.fhlrecipe);
    if (r) Object.assign(r, vals); else F.recipes.push({ id: uid(), by: me && me.id, ...vals });
    FH_EDIT = null; FHL_MV = "recipes"; FHL_REC = r ? r.id : F.recipes[F.recipes.length - 1].id; save(); showFh("meals"); toast(`🍳 ${name} saved`); return true; }
  if (D.fhlhwadd) { const who = fhMem(data.who); if (!who || who.role !== "child" || !(adult || (me && me.id === who.id))) return true;
    const title = fhTxt(data.title, 80); if (!title) return bad("What's the homework?");
    F.hw.push({ id: uid(), who: who.id, subj: FHL_SUBJ.includes(data.subj) ? data.subj : "", title, due: fhIsD(data.due) ? data.due : "", done: false, by: me && me.id, at: Date.now() });
    if (F.hw.length > 300) F.hw = F.hw.filter(h => !h.done || h.due >= addDays(t, -30));
    save(); render(); showFh("school"); toast(`📚 ${title} - ${who.name}`); return true; }
  if (D.fhlpick) { if (!adult) return true;
    F.pickups.push({ id: uid(), day: Math.min(6, Math.max(0, Math.round(fhNum(data.day)))), time: fhIsT(data.time) ? data.time : "", kid: fhMem(data.kid) ? data.kid : "",
      by: fhMem(data.by) ? data.by : "", where: fhTxt(data.where, 60), drop: !!data.drop });
    save(); render(); showFh("school"); toast("🚗 Added to the week"); return true; }
  if (D.fhldocedit) { const d = F.docs.find(x => x.id === D.fhldocedit); if (!d || !fhlDocCan(d)) return true;
    d.title = fhTxt(data.title, 60) || d.title; d.to = FH_AUD.some(a => a[0] === data.to && a[0] !== "some") ? data.to : d.to; save(); showFh("docs"); toast("Saved"); return true; }
  if (D.fhlpet) { if (!adult) return true; const name = fhTxt(data.name, 30); if (!name) return bad("Your pet's name?");
    const vals = { name, kind: FHL_PETK.some(k => k[0] === data.kind) ? data.kind : "🐶", bday: fhIsD(data.bday) && data.bday <= t ? data.bday : "", vet: fhTxt(data.vet, 60), vetph: fhTxt(data.vetph, 30),
      food: fhTxt(data.food, 80), notes: String(data.notes || "").trim().slice(0, 400) };
    const p = D.fhlpet !== "new" && F.pets.find(x => x.id === D.fhlpet);
    if (p) Object.assign(p, vals); else F.pets.push({ id: uid(), ...vals });
    FH_EDIT = null; save(); render(); showFh("pets"); toast(`${vals.kind} ${name} saved`); return true; }
  if (D.fhlcare) { if (!adult) return true; const p = F.pets.find(x => x.id === D.fhlcare), who = fhMem(data.who), title = fhTxt(data.title, 60);
    if (!p || !title || !who || who.role === "guest") return true;
    const every = data.every === "weekly" ? "weekly" : "daily";
    F.chores.push({ id: uid(), title, who: who.id, every, date: "", day: parseDay(t).getDay(), pts: 1, amt: 0, from: t, log: {}, pet: p.id, at: Date.now() });
    save(); render(); showFh("pets"); toast(`🐾 ${title} - ${who.name}`); return true; }
  if (D.fhlgoaladd) { if (!adult) return true; const title = fhTxt(data.title, 60); if (!title) return bad("Name the goal.");
    F.goals.push({ id: uid(), title, icon: FHL_GOALIC.includes(data.icon) ? data.icon : "🎯", target: Math.min(1000, Math.max(1, Math.round(fhNum(data.target)) || 1)), have: 0, unit: fhTxt(data.unit, 20),
      who: fhMembers().filter(m => m.role !== "guest" && data["w_" + m.id]).map(m => m.id), by: fhIsD(data.by) ? data.by : "", at: Date.now() });
    save(); render(); showFh("goals"); toast(`🎯 ${title}`); return true; }
  return false;
}

// ------------------------------------------------------------ Today's card, reminders, what Ask reads
function fhlTodayHtml() {
  const t = today(), me = fhMe(), adult = fhAdult(), M = fh().meals[t], wd = parseDay(t).getDay();
  const P = fh().pickups.filter(p => +p.day === wd).sort((a, b) => (a.time || "").localeCompare(b.time || ""));
  const H = fh().hw.filter(h => !h.done && h.due && h.due <= addDays(t, 1) && (adult || (me && (h.who === me.id || me.role === "guest"))));
  if (!M && !P.length && !H.length) return "";
  return `<section class="fh-card" aria-label="At home today"><div class="fh-cardh"><h3>🏡 At home today</h3></div>
    ${M ? `<button class="fh-row" data-fhtab="meals" style="--tone:#ff9f43">${fhIc("🍽️", "#ff9f43", "sm")}<span class="grow"><b>Dinner: ${esc(M.d)}</b><small>Meal plan</small></span></button>` : ""}
    ${P.map(p => `<button class="fh-row" data-fhtab="school" style="--tone:#2e86de">${fhIc("🚗", "#2e86de", "sm")}<span class="grow"><b>${p.time ? esc(hm(p.time)) + " · " : ""}${p.drop ? "Drop off" : "Pick up"} ${p.kid ? esc(fhName(p.kid)) : "the kids"}</b>
      <small>${[p.where, p.by ? fhName(p.by) + " drives" : ""].filter(Boolean).map(esc).join(" · ")}</small></span></button>`).join("")}
    ${H.map(h => `<button class="fh-row" data-fhtab="school" style="--tone:${fhColor(h.who)}">${fhDot(h.who)}<span class="grow"><b>${esc(h.subj ? h.subj + ": " : "")}${esc(h.title)}</b><small>${esc(fhName(h.who))} · due ${esc(fhRel(h.due))}</small></span></button>`).join("")}</section>`;
}
function fhlReminders(add, inWin) {
  const t = today(), R = S.remind || {};
  [t, addDays(t, 1)].forEach(d => { if (!inWin(d)) return; const wd = parseDay(d).getDay();
    fh().pickups.filter(p => +p.day === wd && p.time).forEach(p => { const st = atMs(d, p.time);
      add(`fhpk:${p.id}:${d}`, st, st - 20 * 60000, `🚗 ${p.drop ? "Drop off" : "Pick up"} ${p.kid ? fhName(p.kid) : "the kids"} at ${hm(p.time)}`, [p.where, p.by ? fhName(p.by) + " drives" : ""].filter(Boolean).join(" · ") || "Family Hub"); }); });
  if (inWin(t)) { const due = fh().hw.filter(h => !h.done && h.due === addDays(t, 1));
    if (due.length) add(`fhhw:${t}`, atMs(t, "23:59"), atMs(t, "18:00"), `📚 Homework due tomorrow`, due.slice(0, 4).map(h => `${fhName(h.who)}: ${h.title}`).join(" · "));
    const M = fh().meals[t]; if (M && M.d) add(`fhml:${t}`, atMs(t, "23:59"), atMs(t, R.dinnerHour || "16:00"), `🍽️ Dinner tonight: ${M.d}`, "Meal plan"); }
}

fhMod({
  id: "life",
  tabs: [["meals", "🍽️", "Meals & recipes"], ["school", "🎒", "School & activities"], ["docs", "📁", "Documents"], ["pets", "🐾", "Pets"], ["goals", "🎯", "Family goals"], ["trips", "🧳", "Trips"]],
  panes: { meals: fhlMealsHtml, school: fhlSchoolHtml, docs: fhlDocsHtml, pets: fhlPetsHtml, goals: fhlGoalsHtml, trips: fhlTripsHtml },
  click: fhlClick,
  submit: fhlSubmit,
  repair: (F, o) => { ["recipes", "hw", "pickups", "docs", "pets", "goals"].forEach(k => { if (!Array.isArray(F[k])) F[k] = []; else if (!F[k].every(o)) F[k] = F[k].filter(o); });
    if (!o(F.meals)) F.meals = {}; F.recipes.forEach(r => { if (!Array.isArray(r.ings)) r.ings = []; }); F.pets.forEach(p => { p.kind = fhOkIc(p.kind, "🐾"); }); F.goals.forEach(g => { if (!Array.isArray(g.who)) g.who = []; g.have = Math.max(0, +g.have || 0); g.target = Math.max(1, +g.target || 1); g.icon = fhOkIc(g.icon, "🎯"); }); },
  back: () => { if (FH_TAB === "meals" && FHL_REC) { FHL_REC = ""; return true; } if (FH_TAB === "docs" && FHL_DOC) { FHL_DOC = ""; return true; } return false; },
  depth: () => (FH_TAB === "meals" && FHL_REC) || (FH_TAB === "docs" && FHL_DOC) ? 1 : 0,
  reset: () => { FHL_REC = ""; FHL_DOC = ""; },
  today: () => [55, fhlTodayHtml()],
  reminders: fhlReminders,
  forget: (id, gone) => { const F = fh(); if (gone) F.docs = fhHandOver(F.docs, gone, x => typeof fhpDrop === "function" && fhpDrop(x)); F.hw = F.hw.filter(h => h.who !== id); F.pickups.forEach(p => { if (p.kid === id) p.kid = ""; if (p.by === id) p.by = ""; }); F.goals.forEach(g => { g.who = g.who.filter(w => w !== id); }); },
  adds: () => [fhAdult() ? { icon: "🍽️", label: "Dinner", attrs: 'data-fhtab="meals"', tone: "#ff9f43" } : null,
    fhAdult() || (fhMe() && fhMe().role === "child") ? { icon: "📚", label: "Homework", attrs: 'data-fhtab="school"', tone: "#2e86de" } : null,
    fhAdult() ? { icon: "🐾", label: "Pet", attrs: 'data-fhlpetedit="new"', tone: "#a0522d" } : null,
    fhAdult() ? { icon: "🎯", label: "Goal", attrs: 'data-fhtab="goals"', tone: "#e84393" } : null].filter(Boolean),
  context: () => { const t = today(), F = fh();
    return { dinnerPlan: fhlDays().map(d => F.meals[d] ? { day: d, dinner: F.meals[d].d } : null).filter(Boolean), recipes: F.recipes.map(r => r.name).slice(0, 40),
      homework: F.hw.filter(h => !h.done && (fhAdult() || (fhMe() && (h.who === fhMe().id || fhMe().role === "guest")))).map(h => ({ who: fhName(h.who), what: h.title, subject: h.subj || undefined, due: h.due || undefined })).slice(0, 30),
      pickups: F.pickups.map(p => ({ day: FH_WD[+p.day], time: p.time, who: p.kid ? fhName(p.kid) : "the kids", driver: p.by ? fhName(p.by) : undefined, kind: p.drop ? "drop-off" : "pickup" })),
      pets: F.pets.map(p => ({ name: p.name, kind: (FHL_PETK.find(k => k[0] === p.kind) || ["", "pet"])[1] })),
      goals: F.goals.map(g => ({ goal: g.title, have: g.have, target: g.target })), today: t }; }
});
