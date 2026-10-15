/* SAVE AS: homevalue.js · LOCATION: C:/MarvelApps/dayhub/homevalue.js
 * HUB PREDICTED VALUE (Home Hub, Scott 2026-10-14: "maybe home estimator for value with data and ai research",
 * "yes build home value first", name: "hub predicted value"). Behind the HOME_VALUE switch (features.js, OFF).
 *
 * The number comes from PUBLIC SALES DATA, never from a guess:
 *   - hpv/<zip3>.json = Redfin Data Center, latest rolling-90-day median $/sq ft + sale price per ZIP and property
 *     type (built by tools/build_hpv_data.py; hpv/meta.json says the month it runs through).
 *   - estimate = local $/sq ft x the home's sq ft, then three plain adjustments, each shown on screen:
 *       size   - bigger-than-typical homes sell for less per sq ft (elasticity -0.2, capped at +/-15%)
 *       trend  - the ZIP's year-over-year $/sq ft change, pro-rated for the months since the data (capped +/-5%)
 *       shape  - the condition the owner picks (needs work -12% ... like new +10%)
 *   - range = +/-8%, wider when the ZIP had few sales (+/-15%) or only the wider area has data (+/-20%).
 * The AI (optional, the relay's "ask" job) only EXPLAINS that number from the facts sent; it never sets it.
 * Stored in S.house.value on this phone.
 */
"use strict";
const HPV_NAME = "Hub Predicted Value";
const HPV_COND = [["work", "Needs work", 0.88], ["avg", "Average", 1.0], ["updated", "Updated", 1.06], ["new", "Like new", 1.10]];
const HPV_TYPE = { house: "sfr", apartment: "condo", condo: "condo" };
let HPV_BUSY = false, HPV_MSG = "", HPV_AI = "";
const hpvOn = () => MODE === "home" && switchOn("HOME_VALUE");
const hpvState = () => (house().value && typeof house().value === "object" ? house().value : null);
const hpvMoney = n => "$" + Math.round(n).toLocaleString("en-US");
const hpvRound = n => Math.round(n / 1000) * 1000;
const hpvMonths = (from, to) => { const a = parseDay(from), b = parseDay(to); return (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth(); };

// Pure: data row(s) + the home -> the estimate. Kept separate so the tests can check the math.
// row = [ppsf, medianPrice, homesSold, ppsfYoY, periodEnd]; area = true when only the ZIP3 blend was found.
function hpvEstimate(row, home, area, onDay) {
  const [ppsf, price, sold, yoy, end] = row;
  const medSqft = price / ppsf;
  const size = Math.min(1.15, Math.max(0.85, Math.pow(home.sqft / medSqft, -0.2)));
  const months = Math.max(0, hpvMonths(end, onDay));
  const trend = Math.min(1.05, Math.max(0.95, 1 + (yoy || 0) * months / 12));
  const shape = (HPV_COND.find(c => c[0] === home.cond) || HPV_COND[1])[2];
  const est = ppsf * home.sqft * size * trend * shape;
  const spread = area ? 0.20 : sold < 10 ? 0.15 : 0.08;
  return { est: hpvRound(est), low: hpvRound(est * (1 - spread)), high: hpvRound(est * (1 + spread)),
    ppsf, sold, end, yoy: yoy || 0, size, trend, shape, spread, area: !!area, medSqft: Math.round(medSqft) };
}
// The ZIP's row for this property type when it is solid (5+ sales, as recent as the all-homes row), else all homes
// in the ZIP, else a sales-weighted blend of the area (ZIP3). A type row from 1 old sale never sets the price.
function hpvPick(shard, zip, type) {
  const z = shard[zip], t = z && z[type], all = z && z.all;
  const solid = t && t[2] >= 5 && (!all || t[4] >= all[4]);
  if (z && (solid || all || t)) return { row: solid ? t : all || t, area: false };
  const rows = Object.values(shard).map(r => r[type] || r.all).filter(Boolean);
  if (!rows.length) return null;
  const w = rows.reduce((n, r) => n + Math.max(1, r[2]), 0);
  const avg = i => rows.reduce((n, r) => n + r[i] * Math.max(1, r[2]), 0) / w;
  const end = rows.map(r => r[4]).sort().pop();
  return { row: [avg(0), avg(1), rows.reduce((n, r) => n + r[2], 0), avg(3), end], area: true };
}
async function hpvRun(home) {
  HPV_BUSY = true; HPV_MSG = ""; HPV_AI = ""; hpvDraw();
  try {
    const r = await fetch(`../dayhub/hpv/${home.zip.slice(0, 3)}.json`);
    if (!r.ok) throw new Error("nodata");
    const pick = hpvPick(await r.json(), home.zip, HPV_TYPE[house().type] || "sfr");
    if (!pick) throw new Error("nodata");
    house().value = { ...home, ...hpvEstimate(pick.row, home, pick.area, today()), at: today() };
    save(); toast(`🏡 ${HPV_NAME}: ${hpvMoney(house().value.est)}`);
  } catch (e) {
    HPV_MSG = e.message === "nodata" ? `No recent home sales data for ${home.zip} yet. Check the ZIP code.` : "Couldn't load the sales data. Check your connection and try again.";
  }
  HPV_BUSY = false; hpvDraw();
}
async function hpvExplain() {
  const v = hpvState(); if (!v || HPV_BUSY) return;
  if (!aiOn()) { HPV_AI = "The AI explanation uses Hub AI Credits. Add them in ⚙ → AI helper."; hpvDraw(); return; }
  HPV_BUSY = true; HPV_AI = "…thinking"; hpvDraw();
  const facts = { home: { zip: v.zip, type: house().type, sqft: v.sqft, beds: v.beds, baths: v.baths, yearBuilt: v.year || null, condition: (HPV_COND.find(c => c[0] === v.cond) || [])[1] },
    estimate: { value: v.est, low: v.low, high: v.high }, localData: { source: "Redfin Data Center", medianPricePerSqft: Math.round(v.ppsf),
      typicalHomeSqft: v.medSqft, homesSoldIn90Days: v.sold, periodEnd: v.end, pricePerSqftChangeVsYearAgo: `${(v.yoy * 100).toFixed(1)}%`, onlyWiderAreaData: v.area },
    adjustments: { sizeVsTypical: `${((v.size - 1) * 100).toFixed(0)}%`, marketTrendSinceData: `${((v.trend - 1) * 100).toFixed(1)}%`, condition: `${((v.shape - 1) * 100).toFixed(0)}%` } };
  const q = `In plain words for a homeowner, in 5 short bullet points: explain how this home's predicted value was worked out, what in the data pushes it up or down, how sure it is, and 2 things that would raise it most. It is an estimate from public sales data, not an appraisal - say so once.`;
  try { HPV_AI = String((await aiCall("ask", `QUESTION: ${q}\n\nMY HOME VALUE (JSON):\n${JSON.stringify(facts)}`)).text || "").trim() || "No answer came back. Try again."; }
  catch (e) { HPV_AI = "Couldn't reach the AI helper right now. Try again in a minute."; }
  HPV_BUSY = false; hpvDraw();
}

// ------------------------------------------------------------ the card (home.js dashboard calls hpvCardHtml)
function hpvCardHtml() {
  if (!hpvOn()) return "";
  return `<section class="card hpv" id="hpvCard">${hpvInner()}</section>`;
}
function hpvDraw() { const el = document.getElementById("hpvCard"); if (el) el.innerHTML = hpvInner(); }
function hpvInner() {
  const v = hpvState(), head = `<h3><span class="ci">💲</span>${HPV_NAME}<span class="meta">${v ? `as of ${prettyDate(v.at)}` : "Free"}</span></h3>`;
  if (HPV_BUSY && !v) return head + `<div class="body"><p class="fine">Working it out from local sales…</p></div>`;
  if (!v || hpvEditing) return head + `<div class="body">${hpvFormHtml(v)}${HPV_MSG ? `<p class="fine">⚠️ ${esc(HPV_MSG)}</p>` : ""}</div>`;
  const pct = n => `${n >= 1 ? "+" : ""}${((n - 1) * 100).toFixed(Math.abs(n - 1) < 0.1 ? 1 : 0)}%`;
  const dataEnd = new Date(parseDay(v.end)).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  return head + `<div class="body">
    <p class="hpv-big">${hpvMoney(v.est)}</p>
    <p class="sub" style="margin:2px 0 10px">Likely range ${hpvMoney(v.low)} – ${hpvMoney(v.high)}</p>
    <div class="home-stats">
      <div class="home-stat"><b>$${Math.round(v.ppsf)}</b><span>per sq ft in ${esc(v.area ? v.zip.slice(0, 3) + "xx" : v.zip)}</span></div>
      <div class="home-stat"><b>${v.sold}</b><span>homes sold</span><small>90 days to ${esc(dataEnd)}</small></div>
      <div class="home-stat"><b>${v.yoy >= 0 ? "▲" : "▼"} ${Math.abs(v.yoy * 100).toFixed(1)}%</b><span>vs a year ago</span></div>
    </div>
    <p class="fine" style="margin-top:10px">${v.sqft.toLocaleString("en-US")} sq ft × local price, then size ${pct(v.size)}, market since ${esc(dataEnd)} ${pct(v.trend)}, condition ${pct(v.shape)}.${v.area ? " Few sales in your ZIP, so this uses the wider area and the range is wider." : ""}</p>
    ${HPV_AI ? `<div class="hpv-ai">${esc(HPV_AI).replace(/\n/g, "<br>")}</div>` : ""}
    <div class="foot-actions"><button class="btn sm" data-hpv="explain" ${HPV_BUSY ? "disabled" : ""}>🤖 Explain my value</button>
      <button class="btn sm ghost" data-hpv="edit">Edit home details</button><button class="btn sm ghost" data-hpv="refresh">Refresh</button></div>
    <p class="fine">An estimate from public home sales (Redfin Data Center), not an appraisal. A real sale price depends on the house itself, the buyer and the day.</p></div>`;
}
let hpvEditing = false;
function hpvFormHtml(v) {
  v = v || {};
  const zipGuess = v.zip || ((S.city || "").match(/\b\d{5}\b/) || [""])[0];
  return `<p class="fine" style="margin-top:0">What's your home worth? Tell us about it and we'll price it from recent sales near you.</p>
    <form class="qa-form" data-hpvform="1">
      <input name="zip" inputmode="numeric" pattern="[0-9]{5}" maxlength="5" placeholder="ZIP code" value="${esc(zipGuess)}" aria-label="ZIP code" required>
      <input name="sqft" inputmode="numeric" placeholder="Living area, sq ft (e.g. 1850)" value="${v.sqft || ""}" aria-label="Square feet" required>
      <div class="hpv-row"><input name="beds" inputmode="numeric" placeholder="Beds" value="${v.beds || ""}" aria-label="Bedrooms">
        <input name="baths" inputmode="decimal" placeholder="Baths" value="${v.baths || ""}" aria-label="Bathrooms">
        <input name="year" inputmode="numeric" placeholder="Year built" value="${v.year || ""}" aria-label="Year built"></div>
      <label class="field">Condition <select name="cond">${HPV_COND.map(([k, l]) => `<option value="${k}" ${(v.cond || "avg") === k ? "selected" : ""}>${l}</option>`).join("")}</select></label>
      <button class="btn">Get my ${HPV_NAME}</button>${v.zip ? `<button type="button" class="btn ghost" data-hpv="cancel">Cancel</button>` : ""}</form>`;
}

// ------------------------------------------------------------ events (ui.js routes here before home.js)
function hpvClick(ds) {
  if (!hpvOn() || !ds.hpv) return false;
  if (ds.hpv === "explain") hpvExplain();
  else if (ds.hpv === "edit") { hpvEditing = true; HPV_AI = ""; hpvDraw(); }
  else if (ds.hpv === "cancel") { hpvEditing = false; hpvDraw(); }
  else if (ds.hpv === "refresh") { const v = hpvState(); if (v) hpvRun({ zip: v.zip, sqft: v.sqft, beds: v.beds, baths: v.baths, year: v.year, cond: v.cond }); }
  return true;
}
function hpvSubmit(f, data) {
  if (!hpvOn() || !f.dataset.hpvform) return false;
  const zip = String(data.zip || "").trim(), sqft = Number(String(data.sqft || "").replace(/[^\d.]/g, ""));
  if (!/^\d{5}$/.test(zip)) { HPV_MSG = "Enter a 5-digit ZIP code."; hpvDraw(); return true; }
  if (!(sqft >= 300 && sqft <= 20000)) { HPV_MSG = "Enter the living area in square feet, between 300 and 20,000."; hpvDraw(); return true; }
  const n = (x, lo, hi) => { const v = Number(x); return v >= lo && v <= hi ? v : null; };
  hpvEditing = false;
  hpvRun({ zip, sqft: Math.round(sqft), beds: n(data.beds, 0, 20), baths: n(data.baths, 0, 20), year: n(data.year, 1700, new Date().getFullYear() + 1),
    cond: HPV_COND.some(c => c[0] === data.cond) ? data.cond : "avg" });
  return true;
}
