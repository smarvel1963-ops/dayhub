/* SAVE AS: cooking.js · LOCATION: C:/MarvelApps/dayhub/cooking.js
 * COOKING HUB (app #11; Scott 2026-11-15: his Recipe Hub boards -> "Yes, build it" -> "maybe should be clalled cooking hub").
 * Runs at /cookinghub/ with window.DH_MODE = "cooking". Boards + notes: C:/MarvelApps/docs/recipehub_design_2026-11-15/ (README.md).
 * TWO LOOKS the cook picks (Scott's paste: "Let users choose between the magical kitchen and classic cookbook themes"):
 *   kitchen = the storybook kitchen board (chef fox, warm cream / tomato / basil): Good Morning Chef!, Magic Meal Finder, recipe page,
 *             Cook Along, My Pantry, This Week's Table.
 *   vintage = Grandma's Recipe Box (red gingham, aged paper, binder rings, side tabs Cakes / Dinners / Pies / Cookies / Breads), the
 *             Write My Recipe page and the Blue Ribbon page.
 * RULES:
 *  - The built-in recipes are CK_BOOK (cookbook.js, made by docs/recipehub_design_2026-11-15/make_cookbook.py): our own wording, and
 *    Marvel Desktop's versions of dishes from creators' videos with a Watch-the-video link + credit (the video is never copied).
 *  - Dinner Finder is a plain match of what you have against the recipes - no AI and no cost, so it never says "AI".
 *  - Ratings and the Blue Ribbon list are this cook's own (on this phone). They never show made-up counts; ranking across people
 *    needs a shared server first (Scott's call). The score already weighs how many times a recipe was rated (Bayesian average).
 *  - Scan an Old Recipe keeps a PHOTO of the card (Grandma's handwriting is the keepsake); the words are typed. No handwriting reader.
 *  - Data stays on this phone (S.ck); photos in this phone's IndexedDB (cookinghub.photos - never in S, never in the backup, emptied by
 *    Erase). A Private Family Recipe never leaves the phone: not in Share my cookbook, not in Ask.
 *  - Food safety: steps carry USDA's safe inside temperatures; nothing here is nutrition or health advice.
 * Loaded after ships.js and cookbook.js, before ui.js (cooking mode). Every top-level name is ck / CK.
 */
"use strict";
const CK_NAV = [["home", "🏠", "Home"], ["finder", "✨", "Finder"], ["pantry", "🫙", "Pantry"], ["week", "📅", "Week"], ["book", "📖", "My Book"]];
const CK_TABS = { list: "Recipes", rec: "Recipe", cook: "Cook Along", finder: "Magic Meal Finder", pantry: "My Pantry", week: "This Week's Table", groc: "Grocery List",
  book: "My Cookbook", write: "Write My Recipe", ribbon: "The Blue Ribbon Recipes", rate: "Rate a Recipe", more: "More" };
const CK_CATS = { dinner: ["🍽️", "Dinners"], quick: ["⏱️", "Quick Meals"], healthy: ["🥗", "Healthy"], fav: ["❤️", "Favorites"], soups: ["🥣", "Soups"],
  breakfast: ["🍳", "Breakfast"], breads: ["🍞", "Breads"], cakes: ["🍰", "Cakes"], pies: ["🥧", "Pies"], cookies: ["🍪", "Cookies"], desserts: ["🧁", "Desserts"], mine: ["📖", "My Family's Recipes"], community: ["🌎", "From Our Cooks"], all: ["📚", "All Recipes"] };
const CK_HOME_TILES = ["dinner", "quick", "healthy", "fav"];
const CK_SHELF = ["cakes", "dinner", "pies", "cookies", "breads"];                 // Grandma's Recipe Box side tabs
const CK_WRITE_CATS = ["dinner", "soups", "breakfast", "breads", "cakes", "pies", "cookies"];
const CK_PCATS = [["all", "All"], ["ing", "Ingredients"], ["spice", "Spices"], ["basic", "Basics"]];
const CK_QUICK = ["Eggs", "Milk", "Butter", "Chicken", "Ground beef", "Rice", "Pasta", "Tomatoes", "Onions", "Garlic", "Potatoes", "Cheese", "Flour", "Sugar", "Lemons", "Bread"];
const CK_FOOD = [[/tomato/, "🍅"], [/basil|herb|parsley|cilantro|thyme|rosemary/, "🌿"], [/parmesan|cheese|cheddar|mozzarella/, "🧀"], [/cream|milk|buttermilk/, "🥛"], [/egg/, "🥚"],
  [/chicken|turkey/, "🍗"], [/beef|steak|roast|pork|ham|sausage|bacon/, "🥩"], [/salmon|fish|tuna|shrimp|crab/, "🐟"], [/onion/, "🧅"], [/garlic/, "🧄"], [/potato|hash brown/, "🥔"],
  [/rice/, "🍚"], [/pasta|spaghetti|noodle|penne|macaroni/, "🍝"], [/lemon|lime/, "🍋"], [/butter/, "🧈"], [/bread|tortilla|dough|biscuit/, "🍞"], [/corn/, "🌽"], [/carrot/, "🥕"],
  [/mushroom/, "🍄"], [/apple/, "🍎"], [/banana/, "🍌"], [/pepper/, "🫑"], [/spinach|greens|lettuce|kale|broccoli/, "🥬"], [/bean|lentil/, "🫘"], [/flour|sugar|salt|baking/, "🧂"],
  [/oil/, "🫒"], [/honey|syrup/, "🍯"], [/chocolate|cocoa/, "🍫"], [/pineapple/, "🍍"], [/strawberr|berr/, "🍓"], [/peanut|pecan|nut/, "🥜"], [/cinnamon|spice|cumin|chili|ginger|clove/, "🌶️"]];
const CK_SYN = { cheese: ["parmesan", "cheddar", "mozzarella"], greens: ["spinach", "kale", "lettuce", "green bean", "broccoli"],
  vegetables: ["broccoli", "pepper", "carrot", "pea", "zucchini", "spinach", "onion", "mushroom", "green bean", "corn", "celery"], broth: ["stock", "bouillon"],
  pasta: ["spaghetti", "penne", "noodle", "macaroni", "tagliatelle"], noodles: ["pasta", "noodle"], beef: ["ground beef", "steak", "chuck", "hamburger"],
  tomato: ["marinara", "pizza sauce"], potato: ["hash brown"], egg: ["eggs"], chicken: ["chicken breast", "chicken thigh"] };
const CK_ASKS = ["What can I make with chicken and rice?", "What's for dinner this week?", "What in my pantry expires soon?", "Which recipes have I rated best?"];
const CK_KEYS = [["noodle", "noodles"], ["broth", "broth"], ["stock", "broth"], ["cream of", "cream soup"], ["baking powder", "baking powder"], ["baking soda", "baking soda"], ["brown sugar", "brown sugar"],
  ["cream cheese", "cream cheese"], ["sour cream", "sour cream"], ["ground beef", "beef"], ["hash brown", "potato"], ["pizza sauce", "tomato"], ["chicken", "chicken"],
  ["beef", "beef"], ["pork", "pork"], ["sausage", "sausage"], ["bacon", "bacon"], ["shrimp", "shrimp"], ["salmon", "salmon"], ["potato", "potato"], ["tomato", "tomato"],
  ["onion", "onion"], ["garlic", "garlic"], ["cheese", "cheese"], ["parmesan", "parmesan"], ["egg", "egg"], ["milk", "milk"], ["cream", "cream"], ["butter", "butter"],
  ["flour", "flour"], ["sugar", "sugar"], ["rice", "rice"], ["pasta", "pasta"], ["lemon", "lemon"], ["apple", "apple"], ["banana", "banana"]];
const CK_BASIC = /^(salt and pepper|salt|black pepper|pepper|water|olive oil|vegetable oil|oil|cooking spray)\s*(,|\(|to taste|$)/i;   // the WHOLE item ("pepper jack cheese", "oil-packed tomatoes", "salt pork" are not basics)
let CK_OPEN = false, CK_TAB = "list", CK_STACK = [], CK_MSG = "", CK_CUR = "", CK_CAT = "all", CK_Q = "", CK_PICK = "", CK_RTAB = "ing", CK_SERV = 0, CK_STEP = 0,
  CK_PCAT = "all", CK_PEDIT = null, CK_PFORM = false, CK_EDIT = null, CK_ARM = "", CK_WKOFF = 0, CK_VTAB = "cakes", CK_RB = "all", CK_RESULTS = null, CK_BUSY = false,
  CK_DONE = false, CK_WAKE = null, CK_TIMER = null, CK_TIMEID = 0, CK_ADDWK = "";
const CK_IMG = {};                 // photo id -> data URL already read this visit
const CK_TICK = new Set();         // ingredients ticked on the recipe page this visit (not saved)
if (typeof document !== "undefined" && typeof MODE !== "undefined" && MODE === "cooking") document.body.classList.add("ckapp");

// ------------------------------------------------------------ the data (S.ck) and small helpers
function ck() {
  if (!S.ck || typeof S.ck !== "object" || Array.isArray(S.ck)) S.ck = {};
  const C = S.ck, o = v => v && typeof v === "object" && !Array.isArray(v);
  ["mine", "pantry", "groc", "favs", "have", "hidden"].forEach(k => { C[k] = Array.isArray(C[k]) ? C[k].filter(x => k === "favs" || k === "have" || k === "hidden" ? typeof x === "string" : o(x)) : []; });
  ["week", "rate", "cooked"].forEach(k => { C[k] = o(C[k]) ? C[k] : {}; });
  C.groc = C.groc.map(g => ({ id: String(g.id || uid()), t: ckTxt(g.t, 120), from: ckTxt(g.from, 80), done: !!g.done })).filter(g => g.t);
  if (!["kitchen", "vintage"].includes(C.look)) C.look = "kitchen";
  if (C.setup && !ckIsD(C.setupDay)) C.setupDay = today();
  // A backup file or Drive copy is outside data: shapes and numbers are checked before they reach the page.
  C.mine.forEach(r => { if (!r.id) r.id = "m-" + uid(); r.id = String(r.id); if (!/^m-/.test(r.id)) r.id = "m-" + r.id; r.t = ckTxt(r.t, 80) || "My recipe";
    r.ing = Array.isArray(r.ing) ? r.ing.filter(Array.isArray).map(x => [ckTxt(x[0], 30), ckTxt(x[1], 90), ckTxt(x[2], 24)]) : [];
    r.steps = Array.isArray(r.steps) ? r.steps.map(x => ckTxt(x, 600)).filter(Boolean) : []; r.cat = Array.isArray(r.cat) ? r.cat.filter(c => CK_CATS[c]) : ["dinner"];
    r.serves = ckInt(r.serves, 1, 99, 4); r.prep = ckInt(r.prep, 0, 2000, 0); r.cook = ckInt(r.cook, 0, 2000, 0); delete r.src; });   // a family recipe never carries a video link (a backup file could put anything there)
  C.pantry.forEach(p => { p.id = String(p.id || uid()); p.name = ckTxt(p.name, 40) || "Item"; if (!["ing", "spice", "basic"].includes(p.cat)) p.cat = "ing"; if (!ckIsD(p.exp)) p.exp = ""; });
  Object.keys(C.week).forEach(d => { if (!ckIsD(d) || !o(C.week[d])) delete C.week[d]; });
  Object.keys(C.rate).forEach(k => { if (!Array.isArray(C.rate[k])) delete C.rate[k]; else C.rate[k] = C.rate[k].filter(o); });
  return C;
}
const ckSet = () => !!(S.ck && S.ck.setup);
// THE PRICE (Scott 11/15: "pricing free for 2 weeks then 2.99 month"): 14 days free from setup, then $2.99/month (Whop; unlocked with the
// email bought with, like every Hub). v1.65 (Scott 11/15: "All paid apps"): after the free weeks the whole app locks - only the lock screen
// (ckLockHtml: subscribe, I already subscribed, save a copy). Nothing is deleted. Never in the Play app (Google's billing rule), and never
// before the Whop link exists (COOKING_CHECKOUT_URL).
const ckSells = () => typeof cookingPass === "function" && cookingPass() && !(typeof STORE_MODE !== "undefined" && STORE_MODE) && !!(typeof PLAN !== "undefined" && PLAN.COOKING_CHECKOUT_URL);
function ckTrial() { const C = ck(), days = (typeof PLAN !== "undefined" && PLAN.COOKING_TRIAL_DAYS) || 14, used = ckIsD(C.setupDay) ? Math.max(0, -daysUntil(C.setupDay)) : 0;
  return { paid: typeof isPro === "function" && isPro(), left: Math.max(0, days - used) }; }
const ckPaused = () => ckSells() && ckSet() && (t => !t.paid && !t.left)(ckTrial());
function ckLockHtml() {
  return `<section class="hub-lock ck-lock" aria-label="Cooking Hub is locked"><div class="hl-art" aria-hidden="true">🍳</div>
    <h2>Your 2 free weeks are up</h2>
    <p>Keep cooking for <b>${esc(PLAN.COOKING_MONTHLY)}</b> or <b>${esc(PLAN.COOKING_YEARLY)}</b> - every recipe, Cook Along, your pantry, the week's dinners and your family's cookbook. Cancel any time.</p>
    <a class="hl-buy" href="${esc(PLAN.COOKING_CHECKOUT_URL)}" target="_blank" rel="noopener">Keep cooking - ${esc(PLAN.COOKING_MONTHLY)} or ${esc(PLAN.COOKING_YEARLY)}</a>
    ${hubLockFoot()}</section>`;
}
function ckWaits() { if (!ckPaused()) return false; toast(`Your 2 free weeks are up - subscribe (${PLAN.COOKING_MONTHLY} or ${PLAN.COOKING_YEARLY}) to add new things. Everything you saved is still here.`); return true; }
function ckTrialHtml() {
  if (!ckSells() || !ckSet()) return "";
  const T = ckTrial(); if (T.paid) return "";
  const buy = `<a class="ck-cta sm" href="${esc(PLAN.COOKING_CHECKOUT_URL)}" target="_blank" rel="noopener">Keep cooking - ${esc(PLAN.COOKING_MONTHLY)} or ${esc(PLAN.COOKING_YEARLY)}</a>`, have = `<button class="ck-link" data-open="sheet">Already subscribed? Enter your email</button>`;
  return T.left ? `<div class="ck-box ck-trial"><span class="ck-ic">🎁</span><span class="grow"><b>Free for ${ckPl(T.left, "more day")}</b><em>Then ${esc(PLAN.COOKING_MONTHLY)} or ${esc(PLAN.COOKING_YEARLY)}, cancel any time.</em></span></div>`
    : `<div class="ck-box ck-trial over"><span class="grow"><b>Your 2 free weeks are up</b><em>Everything you saved is still here - reading and cooking still work. Adding new recipes, pantry items and plans waits until you subscribe.</em>${buy}${have}</span></div>`;
}
const ckIsD = v => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const ckTxt = (v, n = 80) => String(v == null ? "" : v).trim().slice(0, n);
const ckInt = (v, lo, hi, d) => { const n = Math.floor(Number(v)); return isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d; };
const ckPl = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
const ckLook = () => ck().look;
let CK_SAID = "";                  // the Cook Along step last read aloud
function ckUse(id, fresh) { if (fresh || id !== CK_CUR) CK_SERV = 0; CK_CUR = id; }   // servings start fresh whenever the recipe changes
const ckWord = s => String(s || "").toLowerCase().replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim().replace(/(tomato|potato)es\b/g, "$1").replace(/ies\b/g, "y").replace(/([^s])s\b/g, "$1");
function ckKeyOf(item) {
  const s = String(item || "").toLowerCase(); if (CK_BASIC.test(s.trim())) return "";
  for (const [w, k] of CK_KEYS) if (new RegExp("\\b" + w + "(e?s)?\\b").test(s)) return k;   // whole words: "butternut" isn't butter, "pineapple" isn't apple
  const w = ckWord(s.split(",")[0]).split(" ").pop().slice(0, 24);
  return ["salt", "pepper", "water", "oil"].includes(w) ? "" : w;      // "a pinch of salt", "black pepper to taste" are basics too
}
const ckEmoji = s => { const t = String(s || "").toLowerCase(); const m = CK_FOOD.find(([re]) => re.test(t)); return m ? m[1] : "🥫"; };
const ckMin = r => (Number(r.prep) || 0) + (Number(r.cook) || 0) || Number(r.min) || 0;
const ckTime = n => !n ? "" : n < 60 ? `${n} min` : `${Math.floor(n / 60)} hr${n % 60 ? ` ${n % 60} min` : ""}`;
// Every recipe the cook can open: the built-in book + their own saved ones (drafts only in My Cookbook).
function ckMine() { return ck().mine.map(r => ({ ...r, mine: true, e: r.e || (CK_CATS[(r.cat || [])[0]] || ["📖"])[0], min: ckMin(r),
  cat: [...(r.cat || []), ...(ckMin(r) && ckMin(r) <= 30 ? ["quick"] : [])] })); }
const ckBook = () => (typeof CK_BOOK !== "undefined" ? CK_BOOK : []);
const ckAll = () => [...ckBook(), ...ckMine().filter(r => !r.draft), ...ckShared()];
const ckRec = id => ckBook().find(r => r.id === id) || ckMine().find(r => r.id === id) || ckShared().find(r => r.id === id) || null;
const ckFav = id => ck().favs.includes(id);
const ckIsDessert = r => r.cat.some(c => ["cakes", "pies", "cookies"].includes(c));
function ckInCat(r, c) { return c === "all" ? true : c === "fav" ? ckFav(r.id) : c === "mine" ? !!r.mine : c === "desserts" ? ckIsDessert(r) : r.cat.includes(c); }
const ckCatList = c => ckAll().filter(r => ckInCat(r, c));

// Servings: scale the amount's numbers ("1 1/2 cups" x 2 = "3 cups"). Text without numbers stays as written.
const CK_FR = { "½": .5, "⅓": 1 / 3, "⅔": 2 / 3, "¼": .25, "¾": .75, "⅛": .125 };
function ckNum(s) { s = String(s).trim(); if (CK_FR[s] != null) return CK_FR[s]; let m = s.match(/^(\d+)\s+(\d+)\/(\d+)$/); if (m) return +m[1] + m[2] / m[3];
  m = s.match(/^(\d+)\/(\d+)$/); if (m) return m[1] / m[2]; m = s.match(/^(\d+)([½⅓⅔¼¾⅛])$/); if (m) return +m[1] + CK_FR[m[2]]; return isFinite(+s) ? +s : null; }
function ckFmt(n) {
  if (n >= 10) return String(Math.round(n));
  const w = Math.floor(n), f = n - w, opts = [[0, ""], [.125, "1/8"], [.25, "1/4"], [1 / 3, "1/3"], [.5, "1/2"], [2 / 3, "2/3"], [.75, "3/4"], [1, ""]];
  let best = opts[0]; for (const o of opts) if (Math.abs(o[0] - f) < Math.abs(best[0] - f)) best = o;
  const ww = best[0] === 1 ? w + 1 : w; return [ww || "", best[1]].filter(Boolean).join(" ") || (n > 0 ? "1/8" : "0");   // a tiny amount never shows as 0
}
function ckScale(amt, k) {
  if (!amt || k === 1) return amt || "";
  const parts = String(amt).split(/(\([^)]*\))/);   // a can / bag / jar size stays ("2 cans (28 oz each)" x2 = "4 cans (28 oz each)"); a conversion scales ("400 g (14 oz)" x2 = "800 g (28 oz)")
  return parts.map((part, i) => /^\(/.test(part) && (/\beach\b/i.test(part) || /\b(cans?|bags?|jars?|box(es)?|cartons?|packages?|pkgs?|sticks?|bottles?|containers?)\s*$/i.test(parts[i - 1] || "")) ? part : ckScale1(part, k)).join("");
}
function ckScale1(amt, k) {
  return String(amt).replace(/(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?[½⅓⅔¼¾⅛]?|[½⅓⅔¼¾⅛])/g, m => { const n = ckNum(m); return n == null ? m : ckFmt(n * k); });
}

// ------------------------------------------------------------ pantry, the finder's match, the week
const ckPantryOk = () => ck().pantry.filter(p => !p.exp || daysUntil(p.exp) >= 0);
const ckExpSoon = () => ck().pantry.filter(p => p.exp && daysUntil(p.exp) <= 3).sort((a, b) => a.exp.localeCompare(b.exp));
const ckExpTxt = p => { const n = daysUntil(p.exp); return n < 0 ? "Expired" : n === 0 ? "Expires today" : n === 1 ? "Expires tomorrow" : `Expires in ${n} days`; };
function ckHaveWords() { const C = ck(); return [...new Set([...ckPantryOk().map(p => p.name), ...C.have].map(ckWord).filter(Boolean))]; }
// Whole words both ways ("unsalted butter" counts as butter); a compound whose first word changes the food only counts as itself.
const CK_COMPOUND = ["peanut butter", "apple butter", "cocoa butter", "coconut milk", "almond milk", "cream cheese", "cream soup", "egg noodle", "sweet potato"];
function ckHas(key, have) {
  const k = ckWord(key); if (!k) return true;
  const alts = [k, ...(CK_SYN[k] || []).map(ckWord)];
  return have.some(h => { if (CK_COMPOUND.some(c => h.includes(c)) && !alts.some(a => CK_COMPOUND.some(c => a.includes(c) && h.includes(c)))) return false;
    const hw = h.split(" "); return alts.some(a => { const aw = a.split(" "); return aw.every(w => hw.includes(w)) || hw.every(w => aw.includes(w)); }); });
}
function ckMatch(r, have) {
  const need = [...new Set(r.ing.map(x => x[2]).filter(Boolean))];
  const got = need.filter(k => ckHas(k, have)), miss = need.filter(k => !got.includes(k));
  return { r, need: need.length, got: got.length, miss, pct: need.length ? got.length / need.length : 0 };
}
function ckFind() {
  const have = ckHaveWords(); if (!have.length) return [];
  return ckAll().map(r => ckMatch(r, have)).filter(m => m.got > 0).sort((a, b) => b.pct - a.pct || a.miss.length - b.miss.length || ckMin(a.r) - ckMin(b.r)).slice(0, 8);
}
function ckWeekStart(off) { const d = parseDay(today()); d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + (off || 0) * 7); return ymd(d); }
const ckWeekDays = off => Array.from({ length: 7 }, (_, i) => addDays(ckWeekStart(off), i));
const ckTonight = () => { const w = ck().week[today()]; return w && ckRec(w.r) ? ckRec(w.r) : null; };
function ckGrocFill() {
  const C = ck(), have = ckHaveWords(), on = new Set(C.groc.map(g => g.t.toLowerCase())); let n = 0;
  Array.from({ length: 7 }, (_, i) => addDays(today(), i)).forEach(d => { const w = C.week[d], r = w && !w.done && ckRec(w.r); if (!r) return;
    r.ing.forEach(([amt, item, key]) => { if (!key || ckHas(key, have)) return; const t = ckTxt(`${amt ? amt + " " : ""}${item}`, 120);
      if (on.has(t.toLowerCase())) return; on.add(t.toLowerCase()); C.groc.push({ id: uid(), t, from: r.t, done: false }); n++; }); });
  return n;
}

// ------------------------------------------------------------ ratings + the Blue Ribbon score
const ckRates = id => ck().rate[id] || [];
const ckAvg = id => { const L = ckRates(id); return L.length ? L.reduce((s, x) => s + (Number(x.s) || 0), 0) / L.length : 0; };
const ckCooked = id => (Number(ck().cooked[id]) || 0);
// Bayesian average: a recipe rated once can't beat one rated many times. m = ratings needed before its own average dominates,
// C = the average of every rated recipe. Out of 10 for the ribbon card.
function ckRibbon(cat) {
  const C = ck(), rated = ckAll().filter(r => ckRates(r.id).length && (cat === "all" || ckInCat(r, cat)));
  if (!rated.length) return [];
  const m = 3, all = rated.map(r => ckAvg(r.id)), Cm = all.reduce((a, b) => a + b, 0) / all.length;
  return rated.map(r => { const v = ckRates(r.id).length, R = ckAvg(r.id), sc = (v / (v + m)) * R + (m / (v + m)) * Cm;
    return { r, v, R, sc10: Math.round(sc * 20) / 10, cooked: ckCooked(r.id) }; }).sort((a, b) => b.sc10 - a.sc10 || b.v - a.v).slice(0, 25);
}

// ------------------------------------------------------------ photos (this phone's own IndexedDB: cookinghub.photos)
let CK_DB = null;
const ckDb = () => CK_DB || (CK_DB = new Promise((ok, no) => { const r = indexedDB.open("cookinghub.photos", 1);
  r.onupgradeneeded = () => r.result.createObjectStore("pics"); r.onsuccess = () => { r.result.onversionchange = () => { r.result.close(); CK_DB = null; }; ok(r.result); }; r.onerror = () => { CK_DB = null; no(r.error); }; }));
const ckIdb = async (mode, fn) => { const db = await ckDb(); return new Promise((ok, no) => { const t = db.transaction("pics", mode), s = t.objectStore("pics"), r = fn(s);
  t.oncomplete = () => ok(r && r.result); t.onerror = () => no(t.error); t.onabort = () => no(t.error || new Error("not saved")); }); };   // abort = a full phone
async function ckShrink(file, max) {
  const url = URL.createObjectURL(file);
  try { const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error("not a photo")); i.src = url; });
    const k = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement("canvas");
    c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", .85);
  } finally { URL.revokeObjectURL(url); }
}
async function ckPhotoPut(data) { const id = uid() + uid(); await ckIdb("readwrite", s => s.put(data, id)); CK_IMG[id] = data; return id; }
const ckPhotoDel = id => { if (!id) return; delete CK_IMG[id]; try { ckIdb("readwrite", s => s.delete(id)).catch(() => {}); } catch (e) { /* private mode */ } };
async function ckPaint(root) {
  if (typeof document === "undefined") return;
  for (const im of (root || document).querySelectorAll("img[data-ckimg]")) {
    const id = im.dataset.ckimg; if (!id || im.dataset.ckdone === id) continue;
    try { const d = CK_IMG[id] || (CK_IMG[id] = await ckIdb("readonly", s => s.get(id))); if (d) { im.src = d; im.dataset.ckdone = id; const p = im.closest(".ck-plate, .ck-cardpic"); if (p) p.classList.add("has"); } } catch (e) { /* the drawn plate stays */ }
  }
}
const ckPaintSoon = () => setTimeout(() => ckPaint(), 0);
if (typeof window !== "undefined" && typeof MODE !== "undefined" && MODE === "cooking" && /[?&]review=1\b/.test(location.search)) setTimeout(() => { if (typeof ckSet === "function" && ckSet()) showCk("review"); }, 900);

// ------------------------------------------------------------ drawn in code: the chef fox, plates, the mixing bowl, pantry jars
function ckFox(cls = "") {
  return `<svg class="ck-fox ${cls}" viewBox="0 0 200 232" aria-hidden="true"><defs><linearGradient id="ckfo" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffa149"/><stop offset="1" stop-color="#e8641e"/></linearGradient></defs>
    <path d="M146 196 C204 186 210 118 176 96 C188 136 166 164 136 170 Z" fill="url(#ckfo)"/><path d="M176 96 C193 109 196 128 189 142 C180 126 173 112 176 96 Z" fill="#fff6ea"/>
    <ellipse cx="100" cy="182" rx="48" ry="44" fill="url(#ckfo)"/>
    <path d="M70 152 Q100 142 130 152 L135 216 Q100 228 65 216 Z" fill="#fff8ec" stroke="#e9d6bd" stroke-width="2"/>
    <path d="M100 196 c-10 -11 -3 -23 10 -25 c2 12 -3 21 -10 25 z" fill="#5c9a3b"/><path d="M100 196 l6 -14" stroke="#3f7a26" stroke-width="2"/>
    <ellipse cx="80" cy="224" rx="14" ry="7" fill="#5a2d14"/><ellipse cx="120" cy="224" rx="14" ry="7" fill="#5a2d14"/>
    <path d="M138 164 Q160 154 166 132" stroke="#ef7a2c" stroke-width="15" stroke-linecap="round" fill="none"/>
    <g transform="rotate(14 165 100)"><rect x="161" y="62" width="7" height="74" rx="3.5" fill="#b07a45"/><ellipse cx="164.5" cy="58" rx="11" ry="15" fill="#c48a52"/></g>
    <circle cx="166" cy="132" r="9.5" fill="#e8641e"/>
    <path d="M60 72 L48 22 L90 54 Z" fill="url(#ckfo)"/><path d="M62 66 L55 36 L81 56 Z" fill="#5a2d14"/>
    <path d="M140 72 L152 22 L110 54 Z" fill="url(#ckfo)"/><path d="M138 66 L145 36 L119 56 Z" fill="#5a2d14"/>
    <path d="M50 80 Q52 44 100 42 Q148 44 150 80 Q150 114 100 130 Q50 114 50 80 Z" fill="url(#ckfo)"/>
    <path d="M60 94 Q80 88 100 106 Q120 88 140 94 Q133 121 100 130 Q67 121 60 94 Z" fill="#fff6ea"/>
    <path d="M73 82 q8 -8 16 0" stroke="#3b1d0e" stroke-width="4.5" fill="none" stroke-linecap="round"/><path d="M111 82 q8 -8 16 0" stroke="#3b1d0e" stroke-width="4.5" fill="none" stroke-linecap="round"/>
    <circle cx="70" cy="100" r="7" fill="#ff8a80" opacity=".55"/><circle cx="130" cy="100" r="7" fill="#ff8a80" opacity=".55"/>
    <ellipse cx="100" cy="106" rx="7.5" ry="5.5" fill="#2b1508"/><path d="M91 114 q9 9 18 0" stroke="#3b1d0e" stroke-width="3.5" fill="none" stroke-linecap="round"/>
    <path d="M78 128 L122 128 L100 146 Z" fill="#4f9a3a"/>
    <rect x="72" y="34" width="56" height="14" rx="5" fill="#fff" stroke="#e7dccd" stroke-width="2"/>
    <circle cx="80" cy="25" r="13" fill="#fff" stroke="#e7dccd" stroke-width="2"/><circle cx="120" cy="25" r="13" fill="#fff" stroke="#e7dccd" stroke-width="2"/>
    <circle cx="100" cy="17" r="17" fill="#fff" stroke="#e7dccd" stroke-width="2"/><rect x="74" y="24" width="52" height="16" fill="#fff"/></svg>`;
}
const ckBowl = (cls = "") => `<svg class="ck-bowl ${cls}" viewBox="0 0 120 90" aria-hidden="true"><path d="M70 6 L96 44" stroke="#b9854d" stroke-width="6" stroke-linecap="round"/><ellipse cx="66" cy="4" rx="6" ry="9" fill="#c99359" transform="rotate(-34 66 4)"/>
  <path d="M8 40 Q60 30 112 40 Q108 84 60 86 Q12 84 8 40 Z" fill="#fbf2df" stroke="#d9c6a3" stroke-width="2"/><ellipse cx="60" cy="40" rx="52" ry="9" fill="#f3e4c4" stroke="#d9c6a3" stroke-width="2"/>
  <path d="M12 54 Q60 62 108 54" stroke="#c8202f" stroke-width="5" fill="none"/><path d="M15 64 Q60 72 105 64" stroke="#c8202f" stroke-width="3" fill="none"/><ellipse cx="60" cy="38" rx="40" ry="5" fill="#f7ecd5"/></svg>`;
const ckJars = () => `<svg class="ck-jars" viewBox="0 0 340 120" aria-hidden="true">${[[18, "#f5e6c8", "#e8d29f", 46], [74, "#ffd166", "#f4b942", 60], [140, "#e85d3f", "#c9442a", 52], [200, "#f3efe6", "#ddd5c4", 40], [250, "#f6c64f", "#e2a92a", 54], [300, "#9fcf6b", "#76ad44", 36]]
  .map(([x, c, d, h]) => `<g><rect x="${x}" y="${100 - h}" width="34" height="${h}" rx="7" fill="rgba(255,255,255,.55)" stroke="#d8c3a2" stroke-width="2"/><rect x="${x + 4}" y="${108 - h}" width="26" height="${h - 12}" rx="5" fill="${c}"/>
    <rect x="${x + 2}" y="${94 - h}" width="30" height="8" rx="3" fill="#b88a5a"/><path d="M${x + 8} ${104 - h + 14} h18" stroke="${d}" stroke-width="3" stroke-dasharray="3 4"/></g>`).join("")}<rect x="0" y="100" width="340" height="12" rx="3" fill="#a8743f"/><rect x="0" y="110" width="340" height="6" fill="#7d5126"/></svg>`;
// A recipe's picture: the cook's own photo when there is one, else a plate drawn in code with the dish's emoji (the boards' food
// photos would need photos we may use in an app we sell - the plate stands in until then).
const ckPlate = (r, cls = "") => r && r.photoUrl ? `<span class="ck-plate has ${cls}"><i aria-hidden="true">${esc(r.e || "🍽️")}</i><img src="${esc(r.photoUrl)}" alt=""></span>` : `<span class="ck-plate ${cls}"><i aria-hidden="true">${esc(r && r.e || "🍽️")}</i>${r && r.photo ? `<img data-ckimg="${esc(r.photo)}" alt="">` : ""}</span>`;

// ------------------------------------------------------------ the sheet (one page per tab) + the bottom bar + the phone's back button
function ckSheet() {
  let el = document.getElementById("ckSheet");
  if (!el) { el = document.createElement("div"); el.id = "ckSheet"; el.className = "sheet hidden"; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); document.body.appendChild(el); }
  return el;
}
function ckReset() { CK_MSG = ""; CK_PEDIT = null; CK_PFORM = false; CK_EDIT = null; CK_ARM = ""; CK_ADDWK = ""; CK_SHAREBOX = ""; CK_REPORTBOX = ""; }
let CK_SHAREBOX = "", CK_REPORTBOX = "";
function hideCk(fromPop) {
  const el = document.getElementById("ckSheet"); if (el) el.classList.add("hidden"); CK_OPEN = false; CK_STACK = []; CK_PICK = ""; ckReset(); ckWakeOff(); ckNavEnsure();
  if (!fromPop && CK_HPUSH) { CK_HPUSH = 0; CK_HSKIP++; try { history.back(); } catch (e) { CK_HSKIP = 0; } }
}
function showCk(tab, push) {
  if (ckPaused() && (tab || CK_TAB) !== "review") { hideCk(true); if (typeof render === "function") render(); return ckSheet(); }   // v1.65 locked (Scott's review page stays open)
  const el = ckSheet(), old = el.querySelector(".sheet-body"), same = CK_OPEN && (!tab || tab === CK_TAB), keep = same && old ? old.scrollTop : 0;
  if (tab && tab !== CK_TAB && push !== false && CK_OPEN) CK_STACK.push(CK_TAB);
  if (tab) CK_TAB = tab; if (!CK_OPEN) ckHist(); CK_OPEN = true;
  if (CK_TAB !== "cook") ckWakeOff();
  const r = ckRec(CK_CUR), title = CK_TAB === "rec" && r ? r.t : CK_TAB === "list" ? ckListTitle() : CK_TAB === "write" && CK_EDIT ? "Edit My Recipe" : CK_TABS[CK_TAB] || "Cooking Hub";
  el.setAttribute("aria-label", title);
  el.innerHTML = `<div class="sheet-body ck-sheet ck-t-${CK_TAB}">
    <div class="ck-head"><button class="ck-round" ${CK_STACK.length ? 'data-ckback="1"' : 'data-ckclose="1"'} aria-label="Back">‹</button>${ckBrand()}<button class="ck-round" data-ckclose="1" aria-label="Close">✕</button></div>
    <div class="ck-pane">${ckPane()}</div><p class="fine ck-msg" id="ckMsg">${CK_MSG ? "⚠️ " + esc(CK_MSG) : ""}</p>
    <nav class="ck-tabs" aria-label="Cooking Hub">${ckNavHtml(CK_TAB)}</nav></div>`;
  el.classList.remove("hidden");
  if (keep) { const b = el.querySelector(".sheet-body"); b.style.animation = "none"; b.scrollTop = keep; }
  if (CK_TAB === "rec") ckStarsFill(CK_CUR);
  ckPaint(el); if (CK_TAB === "cook" && !CK_DONE) { ckWakeOn(); const said = CK_CUR + ":" + CK_STEP; if (said !== CK_SAID) { CK_SAID = said; ckSay(); } }   // read a step once, when it changes
}
const ckBrand = () => ckLook() === "vintage" ? `<span class="ck-brand v"><small>Marvel Corp's</small>Cooking Hub</span>` : `<span class="ck-brand"><b>Cooking Hub</b><small>by Marvel Corp</small></span>`;
const ckMsgShow = () => { const el = document.getElementById("ckMsg"); if (el) el.textContent = CK_MSG ? "⚠️ " + CK_MSG : ""; };
const ckNavFor = tab => ["finder", "pantry", "week", "book"].includes(tab) ? tab : tab === "groc" ? "week" : ["write", "ribbon", "rate", "weekly", "vote", "fame"].includes(tab) ? "book" : "home";
function ckNavHtml(on) {
  return CK_NAV.map(([k, i, l]) => `<button class="${ckNavFor(on) === k ? "on" : ""}" ${k === "home" ? 'data-ckclose="1"' : `data-cktab="${k}" data-ckroot="1"`}
    aria-current="${ckNavFor(on) === k ? "page" : "false"}"><span aria-hidden="true">${i}</span>${l}</button>`).join("");
}
function ckNavEnsure() {
  if (typeof document === "undefined") return;
  document.body.classList.toggle("ck", ckSet());
  document.body.classList.toggle("ck-vintage", ckSet() && ckLook() === "vintage");
  document.body.classList.toggle("ck-kitchen", !ckSet() || ckLook() !== "vintage");
  let n = document.getElementById("ckNav");
  if (!ckSet()) { if (n) n.remove(); return; }
  if (!n) { n = document.createElement("nav"); n.id = "ckNav"; n.className = "ck-nav"; n.setAttribute("aria-label", "Cooking Hub"); document.body.appendChild(n); }
  n.innerHTML = ckNavHtml(CK_OPEN ? CK_TAB : "home");
}
function ckPane() {
  const P = { list: ckListHtml, rec: ckRecHtml, cook: ckCookHtml, finder: ckFinderHtml, pantry: ckPantryHtml, week: ckWeekHtml, groc: ckGrocHtml, book: ckBookHtml,
    write: ckWriteHtml, ribbon: ckRibbonHtml, rate: ckRateHtml, more: ckMoreHtml, weekly: ckWeeklyHtml, vote: ckVoteHtml, fame: ckFameHtml, review: ckReviewHtml };
  return (P[CK_TAB] || ckListHtml)();
}
function ckBack() { if (CK_STACK.length) { ckReset(); showCk(CK_STACK.pop(), false); } else hideCk(); }
let CK_HSKIP = 0, CK_HPUSH = 0;
function ckHist() { try { history.pushState({ ck: 1 }, ""); CK_HPUSH = 1; } catch (e) { /* the ✕ still works */ } }
if (typeof window !== "undefined") window.addEventListener("popstate", () => {
  if (typeof MODE === "undefined" || MODE !== "cooking") return;
  if (CK_HSKIP) { CK_HSKIP--; return; }
  if (!CK_OPEN) return;
  CK_HPUSH = 0;
  if (CK_STACK.length) { ckBack(); ckHist(); } else hideCk(true);
});

// ------------------------------------------------------------ first run: pick your kitchen
function ckSetupHtml() {
  ckNavEnsure(); if (CK_OPEN) hideCk();
  if (typeof document !== "undefined") document.body.classList.add("ckapp");
  return `<section class="card ck-home ck-hello" aria-label="Welcome to Cooking Hub">
    <div class="ck-top"><span></span>${ckBrand()}<span></span></div>
    <div class="ck-hero">${ckFox()}<div><h1 class="ck-title">Welcome, Chef!</h1><p class="ck-sub">Recipes, what's for dinner, your pantry and your family's own cookbook - all in one kitchen.</p></div></div>
    <form class="ck-form" data-cksetup="1">
      <h3 class="ck-h3">Pick your kitchen</h3>
      <div class="ck-lookpick">
        <label class="ck-lookcard k"><input type="radio" name="look" value="kitchen" checked><span>${ckFox("sm")}<b>✨ Magical Kitchen</b><small>A storybook kitchen with a chef fox</small></span></label>
        <label class="ck-lookcard v"><input type="radio" name="look" value="vintage"><span>${ckBowl("sm")}<b>📖 Grandma's Recipe Box</b><small>A classic family cookbook</small></span></label></div>
      <label class="field">Your first name (optional)<input name="name" maxlength="30" autocomplete="given-name" placeholder="e.g. Sam" value="${esc(S.name || "")}"></label>
      <button class="ck-cta">Start cooking →</button>
      <p class="fine">You can switch looks any time under My Book → More. Everything stays on this phone.</p></form></section>`;
}

// ------------------------------------------------------------ HOME
function ckDashHtml() {
  ckNavEnsure(); if (typeof document !== "undefined") document.body.classList.add("ckapp");
  ckPaintSoon();
  return ckLook() === "vintage" ? ckVintageHome() : ckKitchenHome();
}
const ckPart = () => { const h = new Date().getHours(); return h < 12 ? "Morning" : h < 17 ? "Afternoon" : "Evening"; };
function ckDaily(n) { const L = ckAll(), seed = Number(today().replace(/-/g, "")); if (!L.length) return []; const out = []; for (let i = 0; out.length < Math.min(n, L.length) && i < 50; i++) { const r = L[(seed * 7 + i * 13) % L.length]; if (!out.includes(r)) out.push(r); } return out; }
const ckSearchForm = () => `<form class="ck-search" data-cksearch="1" role="search"><span aria-hidden="true">🔍</span><input name="q" placeholder="Find recipes, ingredients, or meals…" autocomplete="off" aria-label="Find recipes" value="${esc(CK_Q)}"></form>`;
function ckKitchenHome() {
  const t = ckTonight(), soon = ckExpSoon(), best = ckFind()[0], fresh = ckDaily(4), mine = ckMine().filter(r => !r.draft);
  return `<section class="card ck-home ck-k" aria-label="Cooking Hub home">
    <div class="ck-top"><button class="ck-round" data-cktab="more" aria-label="More">☰</button>${ckBrand()}<button class="ck-round ck-bell" data-cktab="pantry" aria-label="Use it soon${soon.length ? ": " + soon.length : ""}">🔔${soon.length ? `<em>${soon.length}</em>` : ""}</button></div>
    <div class="ck-hero">${ckFox()}<div><h1 class="ck-title">Good ${ckPart()},<br>${esc(S.name || "Chef")}!</h1><p class="ck-sub">What are we cooking today?</p></div></div>
    ${ckTrialHtml()}${ckSearchForm()}
    <div class="ck-tiles">${CK_HOME_TILES.map(c => `<button class="ck-tile ${c === "dinner" ? "on" : ""}" data-ckcat="${c}"><span aria-hidden="true">${CK_CATS[c][0]}</span>${c === "quick" ? "Quick Meals" : c === "fav" ? "Favorites" : CK_CATS[c][1].replace(/s$/, "")}</button>`).join("")}</div>
    ${t ? `<button class="ck-box ck-tonight" data-ckrec="${esc(t.id)}">${ckPlate(t, "md")}<span class="grow"><small>Tonight's dinner</small><b>${esc(t.t)}</b><em>${ckTime(ckMin(t))}${ck().week[today()].done ? " · done ✓" : ""}</em></span><span class="chev">›</span></button>`
      : `<button class="ck-box ck-tonight empty" data-cktab="week"><span class="ck-plate md"><i>📅</i></span><span class="grow"><small>Tonight's dinner</small><b>Plan this week's table</b><em>Pick a dinner for each day</em></span><span class="chev">›</span></button>`}
    <button class="ck-box ck-magic" data-cktab="finder"><span class="ck-sparkle" aria-hidden="true">✨</span><span class="grow"><small>Magic Meal Finder</small><b>${best ? `${esc(best.r.t)}` : "Turn what you have into dinner"}</b><em>${best ? `You have ${best.got} of ${best.need}${best.miss.length ? " · need " + esc(best.miss.slice(0, 2).join(", ")) : " - everything!"}` : "Tap what's in your kitchen"}</em></span>${best ? ckPlate(best.r, "sm") : `<span class="chev">›</span>`}</button>
    ${soon.length ? `<div class="ck-box ck-soon"><h3>⏰ Use it soon</h3>${soon.slice(0, 3).map(p => `<button class="ck-row" data-ckpantry="${esc(p.id)}"><span class="ck-ic">${ckEmoji(p.name)}</span><span class="grow"><b>${esc(p.name)}</b></span><span class="ck-chip red">${ckExpTxt(p)}</span></button>`).join("")}</div>` : ""}
    ${ckWeekBox()}
    <div class="ck-sec"><h3>Fresh ideas today</h3><button class="ck-link" data-ckcat="all">See all ${ckAll().length} ›</button></div>
    <div class="ck-grid">${fresh.map(r => ckCard(r)).join("")}</div>
    ${ckShared().length ? `<div class="ck-sec"><h3>From our cooks</h3><button class="ck-link" data-ckcat="community">See all ${ckShared().length} ›</button></div><div class="ck-grid">${ckShared().slice(0, 4).map(ckCard).join("")}</div>` : ""}
    <button class="ck-box ck-bookrow" data-cktab="book"><span class="ck-ic big">📖</span><span class="grow"><small>My Family Cookbook</small><b>${mine.length ? ckPl(mine.length, "family recipe") : "Save Grandma's recipes"}</b><em>Write your own or scan an old card</em></span><span class="chev">›</span></button>
    <p class="fine ck-foot">Everything stays on this phone. Recipes from videos are our own versions - tap Watch the video for the creator's.</p></section>`;
}
function ckVintageHome() {
  const tab = CK_SHELF.includes(CK_VTAB) ? CK_VTAB : "cakes", L = ckCatList(tab), mine = ckMine().filter(r => !r.draft);
  return `<section class="card ck-home ck-v" aria-label="Cooking Hub - Grandma's Recipe Box">
    <div class="ck-vtop"><button class="ck-round" data-cktab="more" aria-label="More">☰</button><div class="ck-plaque"><small>Marvel Corp's</small><b>Cooking Hub</b><em>✶ The Heirloom Collection ✶</em></div><button class="ck-round" data-cktab="ribbon" aria-label="Blue Ribbon recipes">🎀</button></div>
    <div class="ck-banner">❧ Grandma's Recipe Box ❧</div>${ckTrialHtml()}
    <div class="ck-binder">
      <div class="ck-page">${ckSearchForm()}
        <h2 class="ck-vh2">${esc(CK_CATS[tab][1])}</h2>
        <div class="ck-vlist">${L.length ? L.map(r => `<button class="ck-vrow" data-ckrec="${esc(r.id)}">${ckPlate(r, "sm")}<span class="grow"><b>${esc(r.t)}</b><small>Serves ${r.serves}${ckMin(r) ? " · " + ckTime(ckMin(r)) : ""}${ckFav(r.id) ? " · ♥" : ""}</small></span><span class="chev">›</span></button>`).join("")
          : `<p class="ck-hint">No ${esc(CK_CATS[tab][1].toLowerCase())} yet - add Grandma's below.</p>`}</div>
        <div class="ck-vfam"><h3 class="ck-script">From Grandma's Kitchen</h3>
          ${mine.length ? mine.slice(0, 4).map(r => `<button class="ck-vrow" data-ckrec="${esc(r.id)}">${ckPlate(r, "sm")}<span class="grow"><b>${esc(r.t)}</b><small>${r.by ? "From " + esc(r.by) : "My family's recipe"}${r.private ? " · 🔒" : ""}</small></span><span class="chev">›</span></button>`).join("") + (mine.length > 4 ? `<button class="ck-link" data-cktab="book">All ${mine.length} family recipes ›</button>` : "")
            : `<p class="ck-hand">Every family has a recipe worth keeping.</p>`}
          <button class="ck-cta red" data-ckwrite="1">✎ Write My Recipe</button>
          <button class="ck-ghost" data-ckwrite="scan">📷 Scan an Old Recipe</button>${ckShared().length ? `<button class="ck-ghost" data-ckcat="community">🌎 From Our Cooks (${ckShared().length})</button>` : ""}</div>
        ${ckWeekBox()}
      </div>
      <div class="ck-sidetabs" role="tablist" aria-label="Recipe box tabs">${CK_SHELF.map(c => `<button class="${c === tab ? "on" : ""}" data-ckvtab="${c}" role="tab" aria-selected="${c === tab}"><b>${esc(CK_CATS[c][1])}</b><span aria-hidden="true">${CK_CATS[c][0]}</span></button>`).join("")}</div>
    </div>
    <p class="fine ck-foot">Everything stays on this phone. Recipes from videos are our own versions - tap Watch the video for the creator's.</p></section>`;
}
const ckCard = r => `<button class="ck-card" data-ckrec="${esc(r.id)}">${ckPlate(r)}<b>${esc(r.t)}</b><small>${ckTime(ckMin(r)) || "&nbsp;"}${ckFav(r.id) ? " · ♥" : ""}</small></button>`;

// ------------------------------------------------------------ LIST (a category, a search, or picking a dinner for a day)
function ckListTitle() { return CK_PICK ? `Dinner for ${parseDay(CK_PICK).toLocaleDateString("en-US", { weekday: "long" })}` : CK_Q ? `"${CK_Q}"` : (CK_CATS[CK_CAT] || CK_CATS.all)[1]; }
function ckListHtml() {
  let L = CK_Q ? ckAll().filter(r => { const q = CK_Q.toLowerCase(); return r.t.toLowerCase().includes(q) || r.ing.some(x => String(x[1]).toLowerCase().includes(q)) || r.cat.some(c => (CK_CATS[c] || [""])[1].toLowerCase().includes(q)); }) : ckCatList(CK_CAT);
  if (CK_PICK) L = ckAll();
  const chips = ["all", "dinner", "quick", "healthy", "soups", "breakfast", "breads", "desserts", ...(ckShared().length ? ["community"] : []), "fav", "mine"];
  return `<h2 class="ck-ptitle">${esc(ckListTitle())}</h2>
    ${CK_PICK ? `<p class="ck-sub">Tap a recipe to put it on ${esc(prettyDate(CK_PICK))}.</p>` : `<div class="ck-chips">${chips.map(c => `<button class="${!CK_Q && CK_CAT === c ? "on" : ""}" data-ckcat="${c}" data-cklist="1">${CK_CATS[c][0]} ${esc(CK_CATS[c][1])}</button>`).join("")}</div>`}
    ${L.length ? `<div class="ck-grid">${L.map(r => CK_PICK ? ckCard(r).replace('data-ckrec="', 'data-ckpick="') : ckCard(r)).join("")}</div>`
      : `<p class="ck-hint">${CK_CAT === "fav" ? "Tap ♡ on a recipe to keep it here." : CK_CAT === "mine" ? "Your family's recipes show here. " : "Nothing here yet."}${CK_CAT === "mine" ? `<button class="ck-link" data-ckwrite="1">Write one</button>` : ""}</p>`}`;
}

// ------------------------------------------------------------ RECIPE
function ckRecHtml() {
  const r = ckRec(CK_CUR); if (!r) return `<p class="ck-hint">That recipe isn't here any more.</p>`;
  const serves = CK_SERV || r.serves, k = serves / (r.serves || 1), v = ckLook() === "vintage", tab = ["ing", "steps", "tips"].includes(CK_RTAB) ? CK_RTAB : "ing";
  const ing = `<ul class="ck-ing">${r.ing.map((x, i) => `<li><button class="ck-tick ${CK_TICK.has(r.id + ":" + i) ? "on" : ""}" data-cktick="${esc(r.id)}:${i}" aria-pressed="${CK_TICK.has(r.id + ":" + i)}"><span class="box" aria-hidden="true"></span><span>${x[0] ? `<b>${esc(ckScale(x[0], k))}</b> ` : ""}${esc(x[1])}</span></button></li>`).join("")}</ul>`;
  const steps = `<ol class="ck-steps">${r.steps.map(s => `<li>${esc(s)}</li>`).join("")}</ol>`;
  const tipTxt = v ? (r.gran || r.tip) : (r.tip || r.gran);
  const tips = `${tipTxt ? `<div class="ck-tip ${v ? "hand" : ""}"><h3>${v ? "From Grandma's Kitchen" : "👨‍🍳 Chef's tip"}</h3><p>${esc(tipTxt)}</p></div>` : ""}${!v && r.gran && r.tip ? `<div class="ck-tip"><h3>👵 From Grandma's Kitchen</h3><p>${esc(r.gran)}</p></div>` : ""}
    ${!tipTxt ? `<p class="ck-hint">No tips on this one yet.</p>` : ""}`;
  const rate = ckRates(r.id), cooked = ckCooked(r.id);
  const srcLine = r.src && r.src.url ? `<div class="ck-video"><a class="ck-ghost" href="${esc(r.src.url)}" target="_blank" rel="noopener">▶ Watch the video${r.src.by ? ` - ${esc(r.src.by)}` : ""}</a>
      <small>Our own version, built from the dish in ${r.src.by ? esc(r.src.by) + "'s" : "the"} video${r.tested ? "" : " · not kitchen-tested yet"}. The video and its words belong to its creator.</small></div>` : "";
  return `<div class="ck-rhero">${ckPlate(r, "lg")}<button class="ck-heart ${ckFav(r.id) ? "on" : ""}" data-ckfav="${esc(r.id)}" aria-label="${ckFav(r.id) ? "Remove from favorites" : "Add to favorites"}" aria-pressed="${ckFav(r.id)}">${ckFav(r.id) ? "♥" : "♡"}</button></div>
    <div class="ck-rcard">
      <h2 class="ck-rtitle">${esc(r.t)}</h2>${r.blurb ? `<p class="ck-blurb">${esc(r.blurb)}</p>` : ""}
      <div class="ck-meta">${ckMin(r) ? `<span class="ck-pill">⏱ ${ckTime(ckMin(r))}</span>` : ""}<span class="ck-pill ck-serv"><button data-ckserv="-1" aria-label="Fewer servings">−</button>👥 ${serves} ${serves === 1 ? "serving" : "servings"}<button data-ckserv="1" aria-label="More servings">+</button></span>
        ${rate.length ? `<span class="ck-pill">★ ${ckAvg(r.id).toFixed(1)} (${ckPl(rate.length, "rating")})</span>` : ""}${cooked ? `<span class="ck-pill">🍳 Cooked ${ckPl(cooked, "time")}</span>` : ""}${r.private ? `<span class="ck-pill">🔒 Private</span>` : ""}</div>
      ${r.community ? `<p class="ck-by">🌎 Shared by ${esc(r.by || "one of our cooks")}</p>${r.story ? `<div class="ck-tip hand ck-story"><h3>The Cook's Story</h3><p>${esc(r.story)}</p></div>` : ""}<span class="ck-pill" id="ckCommStars" data-rid="${esc(r.id)}" hidden></span>` : ""}
      ${ckWinnerOf(r) ? `<p class="ck-by">🎖️ Blue Ribbon winner - Recipe of the Week</p>` : ""}
      ${r.mine && (r.story || r.by) ? `<div class="ck-tip hand ck-story"><h3>Family Story & Notes</h3>${r.story ? `<p>${esc(r.story)}</p>` : ""}${r.by ? `<small>From ${esc(r.by)}</small>` : ""}</div>` : ""}
      ${r.card ? `<div class="ck-cardpic"><small>The original card</small><img data-ckimg="${esc(r.card)}" alt="The original recipe card"></div>` : ""}
      ${v ? `<h3 class="ck-vsec">Ingredients</h3>${ing}<h3 class="ck-vsec">Directions</h3>${steps}${tips}`
        : `<div class="ck-rtabs" role="tablist">${[["ing", "Ingredients"], ["steps", "Steps"], ["tips", "Chef's Tips"]].map(([k2, l]) => `<button class="${tab === k2 ? "on" : ""}" data-ckrtab="${k2}" role="tab" aria-selected="${tab === k2}">${l}</button>`).join("")}</div>
          <div class="ck-rbody">${tab === "ing" ? ing : tab === "steps" ? steps : tips}</div>`}
      ${srcLine}
      <button class="ck-cta ${v ? "red" : ""}" data-ckcook="${esc(r.id)}">Start Cooking →</button>
      <div class="ck-acts">
        <button class="ck-ghost" data-ckaddwk="${esc(r.id)}">📅 Add to this week</button>
        <button class="ck-ghost" data-ckmissing="${esc(r.id)}">🛒 Missing → grocery list</button>
        <button class="ck-ghost" data-ckrate="${esc(r.id)}">★ Rate it</button>
        <button class="ck-ghost" data-ckshare="rec:${esc(r.id)}">↗ Share</button>
        ${r.mine && !r.private && !r.draft && cksOn() ? `<button class="ck-ghost" data-ckshareask="${esc(r.id)}">🌎 ${r.shared ? (r.shared.h === cksHash(r) ? "Sent for review ✓" : "Send the new version") : "Share with Cooking Hub"}</button>` : ""}
        ${r.community ? `<button class="ck-ghost" data-ckreportask="${esc(r.id)}">⚑ Report</button>` : ""}
        ${r.mine ? `<button class="ck-ghost" data-ckedit="${esc(r.id)}">✎ Edit</button><button class="ck-ghost danger" data-ckdel="${esc(r.id)}">${CK_ARM === "del:" + r.id ? "Tap again to delete" : "🗑 Delete"}</button>` : ""}</div>
      ${CK_ADDWK === r.id ? ckDayPick(r.id) : ""}${CK_SHAREBOX === r.id ? ckShareBox(r) : ""}${CK_REPORTBOX === r.id ? ckReportBox(r) : ""}
    </div>`;
}
function ckDayPick(id) {
  return `<div class="ck-daypick"><b>Which day?</b><div>${ckWeekDays(0).filter(d => d >= today()).concat(ckWeekDays(1)).slice(0, 7).map(d => `<button data-ckputday="${d}" data-ckputrec="${esc(id)}">${d === today() ? "Tonight" : parseDay(d).toLocaleDateString("en-US", { weekday: "short" })}<small>${prettyDate(d)}</small></button>`).join("")}</div></div>`;
}

// ------------------------------------------------------------ COOK ALONG (one step at a time; the phone's own voice; the screen stays awake)
function ckCookHtml() {
  const r = ckRec(CK_CUR); if (!r) return `<p class="ck-hint">Pick a recipe first.</p>`;
  if (CK_DONE) return `<div class="ck-done">${ckFox("big")}<h2 class="ck-ptitle">Dinner is served!</h2><p class="ck-sub">${esc(r.t)} - nicely done, ${esc(S.name || "Chef")}. 🎉</p>
    <button class="ck-cta" data-ckrate="${esc(r.id)}">★ Rate how it turned out</button><button class="ck-ghost" data-ckclose="1">Back to the kitchen</button></div>`;
  const n = r.steps.length, i = Math.max(0, Math.min(n - 1, CK_STEP)), s = r.steps[i] || "", mins = ckStepMins(s);
  const dots = n <= 8 ? Array.from({ length: n }, (_, j) => `<span class="${j < i ? "past" : j === i ? "on" : ""}">${j + 1}</span>`).join("<i></i>") : `<span class="on">${i + 1}</span><em>of ${n}</em>`;
  const t = CK_TIMER && CK_TIMER.rec === r.id ? CK_TIMER : null;
  return `<h2 class="ck-ptitle">Cook Along</h2><div class="ck-badge">Guided Cook · ${esc(r.t)}</div>
    <div class="ck-dots" aria-label="Step ${i + 1} of ${n}">${dots}</div>
    <div class="ck-step"><div class="ck-stepno"><small>Step</small><b>${i + 1}</b></div><p>${esc(s)}</p></div>
    ${mins ? `<button class="ck-ghost ck-timer" data-cktimer="${mins}">${t ? `⏲ <span id="ckTimeLeft">${ckLeft(t)}</span> left · tap to stop` : `⏲ Start a ${mins}-minute timer`}</button>` : t ? `<button class="ck-ghost ck-timer" data-cktimer="0">⏲ <span id="ckTimeLeft">${ckLeft(t)}</span> left · tap to stop</button>` : ""}
    <details class="ck-peek"><summary>Ingredients${(CK_SERV || r.serves) !== r.serves ? ` (for ${CK_SERV})` : ""}</summary>${r.ing.map(x => `<div>${x[0] ? `<b>${esc(ckScale(x[0], (CK_SERV || r.serves) / (r.serves || 1)))}</b> ` : ""}${esc(x[1])}</div>`).join("")}</details>
    <div class="ck-cookbar"><label class="ck-voice"><input type="checkbox" data-ckvoice="1" ${ck().voice ? "checked" : ""}><span>🎤 Voice Mode<small>${ck().voice ? "On" : "Off"}</small></span></label>
      ${i > 0 ? `<button class="ck-ghost" data-ckstep="-1">← Back</button>` : ""}<button class="ck-cta" data-ckstep="1">${i < n - 1 ? "Next Step →" : "Finish 🎉"}</button></div>
    <p class="fine">The screen stays on while you cook.</p>`;
}
function ckStepMins(s) { const m = String(s).match(/(\d+)\s*(?:to|-|–)?\s*(\d+)?\s*(?:minutes?|min)\b/i); if (!m) return 0; const n = Number(m[1]); return n > 0 && n <= 240 ? n : 0; }
const ckLeft = t => { const s = Math.max(0, Math.round((t.end - Date.now()) / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
function ckTimerTick() {
  if (!CK_TIMER) { clearInterval(CK_TIMEID); CK_TIMEID = 0; return; }
  const el = document.getElementById("ckTimeLeft"); if (el) el.textContent = ckLeft(CK_TIMER);
  if (Date.now() >= CK_TIMER.end) { const r = ckRec(CK_TIMER.rec); CK_TIMER = null; clearInterval(CK_TIMEID); CK_TIMEID = 0;
    try { navigator.vibrate && navigator.vibrate([300, 150, 300, 150, 300]); } catch (e) { /* no buzz */ }
    toast("⏲ Time's up!" + (r ? " - " + r.t : "")); ckSpeak("Time's up!"); if (typeof notify === "function" && document.hidden) notify("⏲ Time's up!", r ? r.t : "Cooking Hub timer", "ck-timer"); if (CK_OPEN && CK_TAB === "cook") showCk(); }
}
function ckSpeak(text) { try { if (!("speechSynthesis" in window)) return; speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.rate = .95; speechSynthesis.speak(u); } catch (e) { /* no voice on this phone */ } }
function ckSay() { const r = ckRec(CK_CUR); if (!ck().voice || !r || CK_DONE) return; const s = r.steps[Math.max(0, Math.min(r.steps.length - 1, CK_STEP))]; if (s) ckSpeak(`Step ${CK_STEP + 1}. ${s}`); }
async function ckWakeOn() { try { if (!CK_WAKE && navigator.wakeLock) { CK_WAKE = await navigator.wakeLock.request("screen"); CK_WAKE.addEventListener("release", () => { CK_WAKE = null; }); } } catch (e) { CK_WAKE = null; } }
function ckWakeOff() { try { if (CK_WAKE) CK_WAKE.release(); } catch (e) { /* already off */ } CK_WAKE = null; try { if ("speechSynthesis" in window) speechSynthesis.cancel(); } catch (e) { /* none */ } }
if (typeof document !== "undefined") document.addEventListener("visibilitychange", () => { if (typeof MODE !== "undefined" && MODE === "cooking" && document.visibilityState === "visible" && CK_OPEN && CK_TAB === "cook") ckWakeOn(); });

// ------------------------------------------------------------ MAGIC MEAL FINDER (a plain match - no AI, no cost)
function ckFinderHtml() {
  const C = ck(), pantry = ckPantryOk(), have = ckHaveWords(), res = CK_RESULTS;
  return `<div class="ck-magichead">${ckFox("sm")}<div><h2 class="ck-ptitle">Magic Meal Finder</h2><div class="ck-badge">Dinner Finder</div><p class="ck-sub">Turn what you have into a delicious dinner!</p></div></div>
    <h3 class="ck-h3">What do you have on hand?</h3>
    <div class="ck-have">${C.have.map(w => `<button class="ck-hchip" data-ckhave="${esc(w)}" aria-label="Remove ${esc(w)}">${ckEmoji(w)} ${esc(w)} <b aria-hidden="true">×</b></button>`).join("")}
      ${pantry.length ? `<span class="ck-hchip pan">🫙 ${ckPl(pantry.length, "pantry item")}</span>` : ""}</div>
    <form class="ck-addhave" data-ckhaveform="1"><input name="w" placeholder="Add an ingredient (e.g. chicken)" autocomplete="off" maxlength="30" aria-label="Add an ingredient"><button class="ck-mini">Add</button></form>
    <div class="ck-sugg">${["Chicken", "Rice", "Tomatoes", "Pasta", "Eggs", "Potatoes", "Cheese", "Ground beef", "Garlic", "Onions"].filter(w => !have.includes(ckWord(w))).slice(0, 8).map(w => `<button data-ckhaveadd="${esc(w)}">+ ${esc(w)}</button>`).join("")}</div>
    <button class="ck-cta" data-ckfind="1" ${have.length ? "" : "disabled"}>✨ Find My Dinner</button>
    ${res ? (res.length ? `<h3 class="ck-h3">Best matches</h3>${res.map((m, i) => `<button class="ck-match" data-ckrec="${esc(m.r.id)}">${ckPlate(m.r, "sm")}<span class="grow">${i === 0 ? `<small>✨ Best match</small>` : ""}<b>${esc(m.r.t)}</b>
        <em>You have ${m.got} of ${m.need}${m.miss.length ? ` · need ${esc(m.miss.slice(0, 3).join(", "))}${m.miss.length > 3 ? "…" : ""}` : " - you have everything!"}</em></span><span class="ck-pct" style="--p:${Math.round(m.pct * 100)}">${Math.round(m.pct * 100)}%</span></button>`).join("")}`
      : `<p class="ck-hint">No match yet - add a few more ingredients.</p>`) : ""}
    <p class="fine">Matches the ingredients you have against every recipe here (salt, pepper, oil and water are assumed). Your pantry counts too.</p>`;
}

// ------------------------------------------------------------ MY PANTRY
function ckPantryHtml() {
  const C = ck(), cat = CK_PCATS.some(c => c[0] === CK_PCAT) ? CK_PCAT : "all", L = C.pantry.filter(p => cat === "all" || p.cat === cat).sort((a, b) => (a.exp || "9") .localeCompare(b.exp || "9") || a.name.localeCompare(b.name));
  const ed = CK_PEDIT ? C.pantry.find(p => p.id === CK_PEDIT) : null;
  return `<div class="ck-shelf"><div class="ck-sign"><b>My Pantry</b><span>Kitchen</span></div>${ckJars()}</div>
    <div class="ck-chips">${CK_PCATS.map(([k, l]) => `<button class="${cat === k ? "on" : ""}" data-ckpcat="${k}">${l}</button>`).join("")}</div>
    ${CK_PFORM || ed ? ckPForm(ed) : `<button class="ck-cta" data-ckpnew="1">＋ Add to my pantry</button>`}
    <div class="ck-plist">${L.length ? L.map(p => { const soon = p.exp && daysUntil(p.exp) <= 3;
      return `<button class="ck-prow" data-ckpantry="${esc(p.id)}"><span class="ck-ic">${ckEmoji(p.name)}</span><b class="grow">${esc(p.name)}</b>${soon ? `<span class="ck-chip red">⏰ ${ckExpTxt(p)}</span>` : p.qty ? `<span class="ck-chip">${esc(p.qty)}</span>` : ""}<span class="chev">›</span></button>`; }).join("")
      : `<p class="ck-hint">${C.pantry.length ? "Nothing in this group." : "Add what's in your kitchen - the Meal Finder uses it, and Cooking Hub tells you before things expire."}</p>`}</div>
    ${!C.pantry.length ? `<div class="ck-sugg">${CK_QUICK.map(w => `<button data-ckquick="${esc(w)}">+ ${esc(w)}</button>`).join("")}</div>` : ""}`;
}
function ckPForm(p) {
  return `<form class="ck-form ck-pform" data-ckpform="${p ? esc(p.id) : "new"}"><h3 class="ck-h3">${p ? "Edit item" : "Add to my pantry"}</h3>
    <label class="field">What is it?<input name="name" required maxlength="40" value="${esc(p ? p.name : "")}" placeholder="e.g. Tomatoes" autocomplete="off"></label>
    <div class="two"><label class="field">How much<input name="qty" maxlength="24" value="${esc(p ? p.qty || "" : "")}" placeholder="e.g. 6 left"></label>
      <label class="field">Group<select name="cat">${CK_PCATS.slice(1).map(([k, l]) => `<option value="${k}" ${(p ? p.cat : "ing") === k ? "selected" : ""}>${l}</option>`).join("")}</select></label></div>
    <label class="field">Use by (optional)<input name="exp" type="date" value="${esc(p ? p.exp || "" : "")}"></label>
    <div class="ck-formbtns"><button class="ck-cta">Save</button><button type="button" class="ck-ghost" data-ckpcancel="1">Cancel</button>${p ? `<button type="button" class="ck-ghost danger" data-ckpdel="${esc(p.id)}">🗑 Remove</button>` : ""}</div></form>`;
}

// ------------------------------------------------------------ THIS WEEK'S TABLE + the grocery list
function ckWeekHtml() {
  const C = ck(), days = ckWeekDays(CK_WKOFF), n = C.groc.filter(g => !g.done).length;
  return `<div class="ck-weekhead"><span aria-hidden="true">🌻</span><h2 class="ck-ptitle">This Week's Table</h2><div class="ck-badge">Meal Planner</div></div>
    <div class="ck-wknav"><button class="ck-mini" data-ckwknav="-1" aria-label="Last week">‹</button><b>${CK_WKOFF === 0 ? "This week" : CK_WKOFF === 1 ? "Next week" : CK_WKOFF === -1 ? "Last week" : prettyDate(days[0])} · ${prettyDate(days[0])} - ${prettyDate(days[6])}</b><button class="ck-mini" data-ckwknav="1" aria-label="Next week">›</button></div>
    <div class="ck-week">${days.map(d => { const w = C.week[d], r = w && ckRec(w.r), dn = parseDay(d).toLocaleDateString("en-US", { weekday: "short" });
      return `<div class="ck-wkrow ${d === today() ? "today" : ""} ${w && w.done ? "done" : ""}"><span class="ck-day d${parseDay(d).getDay()}">${dn}</span>
        ${r ? `<button class="ck-wkrec" data-ckrec="${esc(r.id)}">${ckPlate(r, "xs")}<b>${esc(r.t)}</b></button>
          <button class="ck-wkic ${w.done ? "on" : ""}" data-ckwkdone="${d}" aria-label="${w.done ? "Not cooked yet" : "Cooked"}" aria-pressed="${!!w.done}">${w.done ? "✓" : "○"}</button>
          <button class="ck-wkic ${ckFav(r.id) ? "fav" : ""}" data-ckfav="${esc(r.id)}" aria-label="Favorite">${ckFav(r.id) ? "♥" : "♡"}</button>
          <button class="ck-wkic" data-ckwkdel="${d}" aria-label="Clear ${dn}">✕</button>`
          : `<button class="ck-wkrec empty" data-ckpickday="${d}"><span class="ck-plate xs"><i>＋</i></span><b>Pick a dinner</b></button>`}</div>`; }).join("")}</div>
    <button class="ck-cta ck-grocbtn" data-cktab="groc">🧺 Grocery List${n ? ` (${ckPl(n, "item")})` : ""}</button>`;
}
function ckGrocHtml() {
  const C = ck(), open = C.groc.filter(g => !g.done), got = C.groc.filter(g => g.done);
  return `<h2 class="ck-ptitle">Grocery List</h2>
    <button class="ck-cta" data-ckgrocfill="1">🧺 Fill from this week's dinners</button>
    <form class="ck-addhave" data-ckgrocadd="1"><input name="t" placeholder="Add an item" maxlength="120" autocomplete="off" aria-label="Add an item"><button class="ck-mini">Add</button></form>
    <div class="ck-glist">${open.map(g => `<button class="ck-tick" data-ckgroc="${esc(g.id)}"><span class="box" aria-hidden="true"></span><span>${esc(g.t)}${g.from ? `<small>${esc(g.from)}</small>` : ""}</span></button>`).join("") || `<p class="ck-hint">Nothing to buy yet. Plan dinners on This Week's Table, then tap Fill.</p>`}</div>
    ${got.length ? `<h3 class="ck-h3">In the cart</h3><div class="ck-glist">${got.map(g => `<button class="ck-tick on" data-ckgroc="${esc(g.id)}"><span class="box" aria-hidden="true"></span><span>${esc(g.t)}</span></button>`).join("")}</div><button class="ck-ghost" data-ckgrocclear="1">Clear what's in the cart</button>` : ""}
    ${C.groc.length ? `<button class="ck-ghost" data-ckshare="list">↗ Share the list</button>` : ""}
    <p class="fine">Fill skips what's already in your pantry and the basics (salt, pepper, oil, water).</p>`;
}

// ------------------------------------------------------------ MY COOKBOOK (family recipes, drafts, favorites)
function ckBookHtml() {
  const M = ckMine(), done = M.filter(r => !r.draft), drafts = M.filter(r => r.draft), favs = ckAll().filter(r => ckFav(r.id) && !r.mine);
  return `<h2 class="ck-ptitle">My Cookbook</h2><p class="ck-sub">Your family's recipes - kept here, passed down.</p>
    <div class="ck-bookbtns"><button class="ck-cta ${ckLook() === "vintage" ? "red" : ""}" data-ckwrite="1">✎ Write My Recipe</button><button class="ck-ghost" data-ckwrite="scan">📷 Scan an Old Recipe</button></div>
    <h3 class="ck-h3">My Family's Recipes</h3>${done.length ? `<div class="ck-grid">${done.map(ckCard).join("")}</div>` : `<p class="ck-hint">Every family has a recipe worth keeping. Write Grandma's down, or snap a photo of her card.</p>`}
    ${drafts.length ? `<h3 class="ck-h3">Drafts</h3>${drafts.map(r => `<button class="ck-row" data-ckedit="${esc(r.id)}"><span class="ck-ic">📝</span><span class="grow"><b>${esc(r.t)}</b><small>Draft - tap to finish</small></span><span class="chev">›</span></button>`).join("")}` : ""}
    <h3 class="ck-h3">Favorites</h3>${favs.length ? `<div class="ck-grid">${favs.map(ckCard).join("")}</div>` : `<p class="ck-hint">Tap ♡ on any recipe to keep it here.</p>`}
    <div class="ck-bookbtns"><button class="ck-ghost" data-cktab="ribbon">🎀 Blue Ribbon Recipes</button><button class="ck-ghost" data-cktab="more">☰ More</button></div>`;
}

// ------------------------------------------------------------ WRITE MY RECIPE (the board: name, photo, scan the card, category, servings,
// prep / cook, ingredients + directions you can add to, the family story, Private Family Recipe, Save to My Cookbook / Save Draft)
function ckWriteHtml() {
  const r = CK_EDIT ? ck().mine.find(x => x.id === CK_EDIT) : null, cat = r ? (r.cat || [])[0] : "dinner";
  const ing = r && r.ing.length ? r.ing : [["", ""], ["", ""]], steps = r && r.steps.length ? r.steps : [""];
  const iRow = x => `<div class="ck-wrow" data-ckwrow="ing"><span class="ck-grip" aria-hidden="true">⠿</span><input name="amt" placeholder="Amount" maxlength="30" value="${esc(x[0] || "")}" aria-label="Amount"><input name="item" placeholder="Ingredient" maxlength="90" value="${esc(x[1] || "")}" aria-label="Ingredient"><button type="button" class="ck-x" data-ckrowdel="1" aria-label="Remove">×</button></div>`;
  const sRow = (s, i) => `<div class="ck-wrow" data-ckwrow="step"><span class="ck-num">${i + 1}</span><textarea name="step" rows="2" maxlength="600" placeholder="Write step ${i + 1}…" aria-label="Step ${i + 1}">${esc(s || "")}</textarea><button type="button" class="ck-x" data-ckrowdel="1" aria-label="Remove">×</button></div>`;
  return `<form class="ck-form ck-write" data-ckwrite="${r ? esc(r.id) : "new"}" novalidate>
    <div class="ck-writehead">${ckLook() === "vintage" ? ckBowl("sm") : ckFox("sm")}<div><h2 class="ck-ptitle">${r ? "Edit My Recipe" : "Write My Recipe"}</h2><p class="ck-sub ck-script">A family favorite starts here</p></div></div>
    <label class="field">Recipe Name<input name="t" maxlength="80" required value="${esc(r ? r.t : "")}" placeholder="Grandma's Sunday Biscuits" autocomplete="off"></label>
    <div class="ck-photos">
      <label class="ck-drop" id="ckPhotoDrop"><input type="file" name="photo" accept="image/*" hidden>${r && r.photo ? `<img data-ckimg="${esc(r.photo)}" alt="">` : ""}<span>📷<b>Add a photo</b><small>of the dish</small></span></label>
      <label class="ck-scan ${CK_WSCAN ? "glow" : ""}" id="ckCardDrop"><input type="file" name="card" accept="image/*" capture="environment" hidden>${r && r.card ? `<img data-ckimg="${esc(r.card)}" alt="">` : ""}<span>🗒️<b>Scan Handwritten Card</b><small>keeps a photo of the card</small></span></label></div>
    <div class="field"><span>Category</span><div class="ck-catpick">${CK_WRITE_CATS.map(c => `<label><input type="radio" name="cat" value="${c}" ${cat === c ? "checked" : ""}><span>${esc(CK_CATS[c][1])}</span></label>`).join("")}</div></div>
    <div class="ck-nums"><div class="field"><span>Servings</span><div class="ck-stepper"><button type="button" data-ckwserv="-1" aria-label="Fewer">−</button><input name="serves" type="number" min="1" max="99" value="${r ? r.serves : 4}" aria-label="Servings"><button type="button" data-ckwserv="1" aria-label="More">+</button></div></div>
      <label class="field">Prep (min)<input name="prep" type="number" min="0" max="2000" value="${r && r.prep ? r.prep : ""}" placeholder="15"></label>
      <label class="field">Cook (min)<input name="cook" type="number" min="0" max="2000" value="${r && r.cook ? r.cook : ""}" placeholder="30"></label></div>
    <h3 class="ck-vsec">Ingredients</h3><div class="ck-wlist" id="ckIngList">${ing.map(iRow).join("")}</div>
    <button type="button" class="ck-cta red sm" data-ckrow="ing">＋ Add Ingredient</button>
    <h3 class="ck-vsec">Directions</h3><div class="ck-wlist" id="ckStepList">${steps.map(sRow).join("")}</div>
    <button type="button" class="ck-cta red sm" data-ckrow="step">＋ Add Step</button>
    <label class="field">Family Story & Notes<textarea name="story" rows="4" maxlength="2000" placeholder="Share the story behind this recipe, special memories, tips, or family notes…">${esc(r ? r.story || "" : "")}</textarea></label>
    <label class="field">From (optional)<input name="by" maxlength="40" value="${esc(r ? r.by || "" : "")}" placeholder="e.g. Grandma Rose"></label>
    <label class="ck-switch"><input type="checkbox" name="private" value="1" ${r && r.private ? "checked" : ""}><span>🔒 Private Family Recipe<small>Never leaves this phone - not shared, not sent to Ask</small></span></label>
    <input type="hidden" name="draft" value="">
    <button class="ck-cta red big">🔖 Save to My Cookbook</button>
    <button type="button" class="ck-link" data-ckdraft="1">Save Draft</button>
    ${r ? `<button type="button" class="ck-ghost danger" data-ckdel="${esc(r.id)}">${CK_ARM === "del:" + r.id ? "Tap again to delete" : "🗑 Delete this recipe"}</button>` : ""}
    <p class="fine">Scanning keeps a photo of the card - Grandma's handwriting is the keepsake. Type the words above so you can cook from them.</p></form>`;
}
let CK_WSCAN = false;
const ckWIng = () => `<div class="ck-wrow" data-ckwrow="ing"><span class="ck-grip" aria-hidden="true">⠿</span><input name="amt" placeholder="Amount" maxlength="30" aria-label="Amount"><input name="item" placeholder="Ingredient" maxlength="90" aria-label="Ingredient"><button type="button" class="ck-x" data-ckrowdel="1" aria-label="Remove">×</button></div>`;
const ckWStep = i => `<div class="ck-wrow" data-ckwrow="step"><span class="ck-num">${i}</span><textarea name="step" rows="2" maxlength="600" placeholder="Write step ${i}…" aria-label="Step ${i}"></textarea><button type="button" class="ck-x" data-ckrowdel="1" aria-label="Remove">×</button></div>`;
function ckRenumber() { document.querySelectorAll("#ckStepList .ck-wrow").forEach((row, i) => { const n = row.querySelector(".ck-num"); if (n) n.textContent = i + 1; }); }

// ------------------------------------------------------------ RATE + BLUE RIBBON
function ckRateHtml() {
  const r = ckRec(CK_CUR); if (!r) return `<p class="ck-hint">Pick a recipe first.</p>`;
  const stars = (n, def) => `<div class="ck-stars" role="radiogroup" aria-label="${n}">${[5, 4, 3, 2, 1].map(v => `<input type="radio" id="ck${n}${v}" name="${n}" value="${v}" ${def === v ? "checked" : ""}><label for="ck${n}${v}" title="${v}">★</label>`).join("")}</div>`;
  return `<h2 class="ck-ptitle">Rate a Recipe</h2><p class="ck-sub">${esc(r.t)}</p>
    <form class="ck-form" data-ckrateform="${esc(r.id)}">${stars("s", 0)}
      <div class="ck-rateby"><div><b>Taste</b>${stars("taste", 0)}</div><div><b>Easy to make</b>${stars("ease", 0)}</div><div><b>Recipe was right</b>${stars("acc", 0)}</div></div>
      <label class="ck-switch"><input type="checkbox" name="cooked" value="1" checked><span>🍳 I actually cooked it</span></label>
      <label class="field">A note for next time (optional)<input name="note" maxlength="140" placeholder="e.g. Add more garlic"></label>
      <button class="ck-cta">Save my rating</button></form>`;
}
function ckRibbonHtml() {
  const cats = [["all", "All"], ["dinner", "Dinners"], ["desserts", "Desserts"], ["breads", "Breads"], ["soups", "Soups"]], L = ckRibbon(CK_RB);
  return `<div class="ck-ribhead"><h2 class="ck-ptitle">The Blue Ribbon Recipes</h2><div class="ck-banner green">Top Rated & Family Approved</div></div>
    <div class="ck-chips">${cats.map(([k, l]) => `<button class="${CK_RB === k ? "on" : ""}" data-ckrb="${k}">${l}</button>`).join("")}</div>
    <div class="ck-rbnote">Ranked by your stars, weighed by how many times you rated each</div>
    ${L.length ? L.map((x, i) => `<div class="ck-ribrow"><span class="ck-ribbon r${Math.min(i, 3)}">#${i + 1}</span>${ckPlate(x.r, "md")}<span class="grow"><b>${esc(x.r.t)}</b>
        <small>${x.R.toFixed(1)} ★ (${ckPl(x.v, "rating")})${x.cooked ? ` · cooked ${ckPl(x.cooked, "time")}` : ""}</small><button class="ck-mini green" data-ckrec="${esc(x.r.id)}">View Recipe ›</button></span><span class="ck-score">${x.sc10.toFixed(1)}<small>/10</small></span></div>`).join("")
      : `<p class="ck-hint">No ribbons yet. Cook something and rate it - your best recipes earn their place here.</p>`}
    <div class="ck-box ck-rateit"><h3 class="ck-script">Rate a Recipe</h3>${ckLastCooked() ? `<button class="ck-cta green" data-ckrate="${esc(ckLastCooked())}">Review my last cook ›</button>` : `<p class="ck-hint">Finish a Cook Along and you can rate it here.</p>`}
      <details><summary>How ranking works</summary><p class="fine">A Blue Ribbon score weighs your average stars by how many times you've rated a recipe, so one 5-star rating can't beat a recipe you've loved again and again (a Bayesian average, out of 10). These are your own ratings on this phone - nothing here is bought or made up.</p></details></div>`;
}
const ckLastCooked = () => ck().lastCook && ckRec(ck().lastCook) ? ck().lastCook : "";

// ------------------------------------------------------------ MORE (the look, sharing, settings)
function ckMoreHtml() {
  const L = ckLook();
  return `<h2 class="ck-ptitle">More</h2>
    <h3 class="ck-h3">Your kitchen's look</h3>
    <div class="ck-lookpick"><button class="ck-lookcard k ${L === "kitchen" ? "on" : ""}" data-cklook="kitchen"><span>${ckFox("sm")}<b>✨ Magical Kitchen</b><small>Storybook kitchen + chef fox</small></span></button>
      <button class="ck-lookcard v ${L === "vintage" ? "on" : ""}" data-cklook="vintage"><span>${ckBowl("sm")}<b>📖 Grandma's Recipe Box</b><small>Classic family cookbook</small></span></button></div>
    <div class="ck-morelist">
      <button class="ck-row" data-cktab="weekly"><span class="ck-ic">🏆</span><span class="grow"><b>Recipe of the Week</b><small>Our cooks' winner + vote for next week</small></span><span class="chev">›</span></button>
      ${ckReviewer() ? `<button class="ck-row" data-cktab="review"><span class="ck-ic">🛡️</span><span class="grow"><b>Review shared recipes</b><small>Marvel Corp only</small></span><span class="chev">›</span></button>` : ""}
      <button class="ck-row" data-cktab="ribbon"><span class="ck-ic">🎀</span><span class="grow"><b>Blue Ribbon Recipes</b><small>Your top-rated</small></span><span class="chev">›</span></button>
      <button class="ck-row" data-cktab="groc"><span class="ck-ic">🧺</span><span class="grow"><b>Grocery List</b></span><span class="chev">›</span></button>
      <button class="ck-row" data-ckshare="book"><span class="ck-ic">↗</span><span class="grow"><b>Share my cookbook</b><small>Pass your family recipes down (private ones stay here)</small></span></button>
      <button class="ck-row" data-ckclose="1" data-ask="open"><span class="ck-ic">💬</span><span class="grow"><b>Ask Cooking Hub</b></span><span class="chev">›</span></button>
      <button class="ck-row" data-ckclose="1" data-open="sheet"><span class="ck-ic">⚙</span><span class="grow"><b>Settings & backup</b></span><span class="chev">›</span></button></div>
    <p class="fine">Built-in recipes: ${ckBook().filter(r => !r.src).length} classics written by Cooking Hub, and ${ckBook().filter(r => r.src).length} of our own versions of dishes from creators' videos - each links to the original video with credit. Safe cooking temperatures follow the USDA. Not nutrition or health advice.</p>`;
}

// ------------------------------------------------------------ SHARED RECIPES + RECIPE OF THE WEEK (Scott 11/15; cookshare.js does the talking)
const cksOn = () => typeof cksShared === "function";
const ckShared = () => cksOn() ? cksShared() : [];
const ckWeeksNow = () => (cksOn() && Array.isArray(CKS_WEEKS)) ? CKS_WEEKS : [];
const ckWinnerOf = r => !!(r && r.shared && r.shared.id && ckWeeksNow().some(w => w.rid === r.shared.id));
const ckWkLabel = start => { const a = parseDay(start), b = parseDay(addDays(start, 6)), m = d => d.toLocaleDateString("en-US", { month: "short" });
  return `${m(a)} ${a.getDate()}-${m(a) === m(b) ? "" : m(b) + " "}${b.getDate()}`; };
function ckWeekBox() {
  if (!cksOn()) return "";
  if (CKS_WEEKS === null) cksWeeks().then(() => { if (typeof render === "function") render(); });
  const w = ckWeeksNow()[0], r = w && ckRec("s-" + w.rid);
  return r ? `<button class="ck-box ck-weekbox" data-cktab="weekly"><span class="ck-rosette sm" aria-hidden="true">🏆</span><span class="grow"><small>Recipe of the Week</small><b>${esc(r.t)}</b><em>${w.by ? "From " + esc(w.by) + "'s kitchen" : "A favorite from our cooks"}</em></span>${ckPlate(r, "sm")}</button>`
    : `<button class="ck-box ck-weekbox" data-cktab="weekly"><span class="ck-rosette sm" aria-hidden="true">🏆</span><span class="grow"><small>Recipe of the Week</small><b>Share yours - it could be next</b><em>Our cooks vote, the best one wins the Blue Ribbon</em></span><span class="chev">›</span></button>`;
}
// A dish photo going out travels small (Firestore keeps it in the recipe itself, no paid storage).
async function ckSmall(data) {
  const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error("not a photo")); i.src = data; });
  const k = Math.min(1, 640 / Math.max(img.width, img.height)), c = document.createElement("canvas");
  c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", .72);
}
function ckShareBox(r) {
  return `<form class="ck-form ck-sharebox" data-ckshareform="${esc(r.id)}"><h3 class="ck-h3">🌎 Share with every Cooking Hub</h3>
    <p class="fine">A person at Marvel Corp reads every recipe before it shows, and may fix spelling. It's shown with the first name you give - nothing else about you.</p>
    <label class="field">First name to show (optional)<input name="by" maxlength="40" value="${esc(S.name || "")}" autocomplete="given-name"></label>
    ${r.photo ? `<label class="ck-switch"><input type="checkbox" name="photo" value="1"><span>Include the dish photo<small>The recipe card photo never leaves this phone</small></span></label>` : ""}
    <label class="ck-agree"><input type="checkbox" name="agree" value="1"><span>This is my own or my family's recipe - not copied from a book, a website or a video - and Cooking Hub may show it to everyone.</span></label>
    <div class="ck-formbtns"><button class="ck-cta">Send for review</button><button type="button" class="ck-ghost" data-ckshareask="${esc(r.id)}">Cancel</button></div></form>`;
}
function ckReportBox(r) {
  return `<form class="ck-form ck-sharebox" data-ckreportform="${esc(r.id)}"><h3 class="ck-h3">⚑ Report this recipe</h3>
    ${["It's wrong or unsafe", "It's copied from somewhere", "It isn't a recipe", "It's offensive", "Something else"].map((w, i) => `<label class="ck-radio"><input type="radio" name="why" value="${esc(w)}" ${i ? "" : "checked"}><span>${esc(w)}</span></label>`).join("")}
    <label class="field">Anything to add (optional)<input name="more" maxlength="200"></label>
    <div class="ck-formbtns"><button class="ck-cta">Send report</button><button type="button" class="ck-ghost" data-ckreportask="${esc(r.id)}">Cancel</button></div></form>`;
}
function ckStarsFill(id) {                                // the community's real stars for a shared recipe (none = nothing shown)
  if (!cksOn() || !/^s-/.test(id)) return;
  cksStars(id).then(c => { const el = document.getElementById("ckCommStars"); if (!el || el.dataset.rid !== id) return;
    if (c.n) { el.hidden = false; el.textContent = `★ ${c.avg.toFixed(1)} · ${ckPl(c.n, "home cook")}`; } }).catch(() => {});
}
function ckWeeklyHtml() {
  if (!cksOn()) return `<p class="ck-hint">Recipe of the Week isn't on this phone yet.</p>`;
  if (CKS_WEEKS === null) { cksWeeks().then(() => { if (CK_OPEN && CK_TAB === "weekly") showCk(); }); return `<p class="ck-hint">Getting this week's winner…</p>`; }
  const w = CKS_WEEKS[0], r = w && ckRec("s-" + w.rid), tab = ["ing", "steps", "story"].includes(CK_RTAB) ? CK_RTAB : "ing";
  const head = `<div class="ck-wkhead"><div class="ck-banner">Recipe of the Week</div><span class="ck-rosette" aria-label="Weekly winner"><b>WEEKLY</b><b>WINNER</b></span></div>`;
  const vote = `<div class="ck-box ck-votebox"><span class="grow"><b class="ck-script">Want next week's winner?</b><em>Nominate your favorite recipe.</em><button class="ck-cta sm blue" data-cktab="vote">Vote for Next Week ›</button></span><span class="ck-cal"><small>${esc(ckWkLabel(cksWeek(1)).split(" ")[0])}</small><b>${esc(ckWkLabel(cksWeek(1)).replace(/^\S+ /, ""))}</b></span></div>`;
  if (!r) return head + `<p class="ck-hint">The first Recipe of the Week is coming. Share one of your family's recipes - it could be the first winner.</p>
    <button class="ck-cta red" data-cktab="book">🌎 Share a recipe</button>${vote}<button class="ck-link" data-cktab="fame">🏛️ Blue Ribbon Hall of Fame</button>`;
  CK_CUR = r.id; setTimeout(() => ckStarsFill(r.id), 0);
  const ing = `<ul class="ck-ing">${r.ing.map((x, i) => `<li><button class="ck-tick ${CK_TICK.has(r.id + ":" + i) ? "on" : ""}" data-cktick="${esc(r.id)}:${i}"><span class="box" aria-hidden="true"></span><span>${x[0] ? `<b>${esc(x[0])}</b> ` : ""}${esc(x[1])}</span></button></li>`).join("")}</ul>`;
  const steps = `<ol class="ck-steps">${r.steps.map(s => `<li>${esc(s)}</li>`).join("")}</ol>`, story = r.story ? `<p class="ck-storytxt">${esc(r.story)}</p>` : `<p class="ck-hint">No story with this one.</p>`;
  return head + `<div class="ck-rhero">${ckPlate(r, "lg")}</div><h2 class="ck-rtitle">${esc(r.t)}</h2>
    <div class="ck-meta">${r.prep ? `<span class="ck-pill">🔪 Prep ${ckTime(r.prep)}</span>` : ""}${r.cook ? `<span class="ck-pill">🍲 Cook ${ckTime(r.cook)}</span>` : ""}<span class="ck-pill">👥 Serves ${r.serves}</span>
      <span class="ck-pill" id="ckCommStars" data-rid="${esc(r.id)}" hidden></span></div>
    <div class="ck-tip hand ck-meet"><h3>From ${esc(w.by || r.by || "our cook")}'s Kitchen</h3><p>${esc(w.tip || (r.story || "").split(/(?<=[.!?])\s/)[0] || "A family favorite.")}</p></div>
    <div class="ck-rtabs">${[["ing", "Ingredients"], ["steps", "Directions"], ["story", "Chef's Story"]].map(([k, l]) => `<button class="${tab === k ? "on" : ""}" data-ckrtab="${k}">${l}</button>`).join("")}</div>
    <div class="ck-rbody">${tab === "ing" ? ing : tab === "steps" ? steps : story}</div>
    <div class="ck-two"><button class="ck-cta red" data-ckcook="${esc(r.id)}">🍽️ Cook This Tonight</button><button class="ck-cta green" data-ckfav="${esc(r.id)}">${ckFav(r.id) ? "✓ Saved to My Book" : "📖 Save to My Book"}</button></div>
    ${vote}<button class="ck-link" data-cktab="fame">🏛️ Blue Ribbon Hall of Fame (${ckPl(CKS_WEEKS.length, "winner")})</button>`;
}
function ckVoteHtml() {
  const L = ckShared(), mine = (ck().votes || {})[cksOn() ? cksWeek(0) : ""] || "";
  return `<h2 class="ck-ptitle">Vote for Next Week</h2><p class="ck-sub">One vote a week. The Blue Ribbon goes to a favorite of our cooks${cksOn() ? ` - voting for ${esc(ckWkLabel(cksWeek(1)))}` : ""}.</p>
    ${L.length ? L.map(r => `<div class="ck-ribrow">${ckPlate(r, "md")}<span class="grow"><b>${esc(r.t)}</b><small>${r.by ? "From " + esc(r.by) : "From our cooks"}</small>
      <button class="ck-mini ${mine === cksSid(r.id) ? "green" : ""}" data-ckvote="${esc(r.id)}">${mine === cksSid(r.id) ? "✓ Your vote" : "Vote"}</button> <button class="ck-mini" data-ckrec="${esc(r.id)}">See it ›</button></span></div>`).join("")
      : `<p class="ck-hint">No shared recipes to vote on yet - share one of yours!</p><button class="ck-cta red" data-cktab="book">🌎 Share a recipe</button>`}`;
}
function ckFameHtml() {
  const W = ckWeeksNow();
  return `<h2 class="ck-ptitle">Blue Ribbon Hall of Fame</h2><p class="ck-sub">Every Recipe of the Week.</p>
    ${W.length ? W.map(w => { const r = ckRec("s-" + w.rid); return `<div class="ck-ribrow"><span class="ck-ribbon r3">🏆</span>${r ? ckPlate(r, "md") : `<span class="ck-plate md"><i>🍽️</i></span>`}<span class="grow"><b>${esc(w.t || (r && r.t) || "Recipe")}</b>
      <small>Week of ${esc(ckWkLabel(w.start))}${w.by ? " · " + esc(w.by) : ""}</small>${r ? `<button class="ck-mini green" data-ckrec="${esc(r.id)}">View Recipe ›</button>` : ""}</span></div>`; }).join("")
      : `<p class="ck-hint">The first winner will be here soon.</p>`}`;
}
// The review page (Scott only: the Firestore rules let no other account read or approve anything). Opens with ?review=1.
const ckReviewer = () => { try { return /[?&]review=1\b/.test(location.search) || localStorage.getItem("cookinghub.reviewer") === "1"; } catch (e) { return false; } };
const ckImgOk = v => typeof v === "string" && /^data:image\/(jpeg|png|webp);base64,[\w+/=]+$/.test(v);
function ckReviewHtml() {
  if (!cksOn()) return `<p class="ck-hint">Not available.</p>`;
  if (!CKS_RV_TOKEN) return `<h2 class="ck-ptitle">Review shared recipes</h2><p class="ck-sub">For Marvel Corp. Sign in with the Google account that runs Cooking Hub.</p>
    <button class="ck-cta" data-ckrvsign="1">Sign in with Google</button><p class="fine">${esc(CKS_RV_MSG)}</p>`;
  if (!CKS_REVIEW) { cksReviewLoad().then(() => { CK_RVTALLY = null; showCk(); }).catch(e => { CKS_RV_MSG = e.status === 403 ? "This account can't review (or the rules aren't published yet)." : "Couldn't load: " + e.message; CKS_RV_TOKEN = ""; showCk(); }); return `<p class="ck-hint">Loading…</p>`; }
  if (CK_RVTALLY === null) { CK_RVTALLY = {}; cksTally(cksWeek(0)).then(n => { CK_RVTALLY = n; if (CK_OPEN && CK_TAB === "review") showCk(); }).catch(() => {}); }
  const R = CKS_REVIEW, list = x => (Array.isArray(x) ? x : []);
  const sub = s => `<div class="ck-rv"><b>${esc(s.t)}</b><small>${esc(s.cat || "")} · serves ${esc(s.serves)} · ${s.by ? "from " + esc(s.by) : "no name"}</small>
      ${ckImgOk(s.photo) ? `<img class="ck-rvpic" src="${esc(s.photo)}" alt="">` : ""}
      <ul>${list(s.ing).map(x => `<li>${esc((x && x.a) || "")} ${esc((x && x.i) || "")}</li>`).join("")}</ul><ol>${list(s.steps).map(x => `<li>${esc(x)}</li>`).join("")}</ol>
      ${s.story ? `<p class="ck-storytxt">${esc(s.story)}</p>` : ""}
      <div class="ck-formbtns"><button class="ck-cta green" data-ckrvok="${esc(s.id)}">✓ Approve</button><button class="ck-ghost danger" data-ckrvno="${esc(s.id)}">✕ Reject</button></div></div>`;
  const rep = x => { const r = ckRec("s-" + x.rid); return `<div class="ck-rv"><b>⚑ ${esc(r ? r.t : x.rid)}</b><small>${esc(x.why || "")}</small>
      <div class="ck-formbtns">${r ? `<button class="ck-ghost danger" data-ckrvdrop="${esc(x.rid)}" data-ckrvrep="${esc(x.id)}">Remove the recipe</button>` : ""}<button class="ck-ghost" data-ckrvdis="${esc(x.id)}">Dismiss</button></div></div>`; };
  const shared = ckShared().slice().sort((a, b) => (CK_RVTALLY[cksSid(b.id)] || 0) - (CK_RVTALLY[cksSid(a.id)] || 0));
  return `<h2 class="ck-ptitle">Review shared recipes</h2>
    <h3 class="ck-h3">Waiting for you (${R.subs.length})</h3>${R.subs.length ? R.subs.map(sub).join("") : `<p class="ck-hint">Nothing waiting.</p>`}
    <h3 class="ck-h3">Reports (${R.reports.length})</h3>${R.reports.length ? R.reports.map(rep).join("") : `<p class="ck-hint">No reports.</p>`}
    <h3 class="ck-h3">Recipe of the Week - ${esc(ckWkLabel(cksWeek(0)))}</h3>
    ${shared.length ? shared.map(r => `<form class="ck-rv ck-form" data-ckcrown="${esc(r.id)}"><b>${esc(r.t)}</b><small>${CK_RVTALLY[cksSid(r.id)] || 0} votes this week${r.by ? " · " + esc(r.by) : ""}</small>
      <input name="tip" maxlength="200" placeholder="The cook's tip to show (optional)"><button class="ck-mini green">🏆 Make it this week's winner</button></form>`).join("") : `<p class="ck-hint">No shared recipes yet.</p>`}
    <button class="ck-link" data-ckrvreload="1">↻ Reload</button>`;
}
let CK_RVTALLY = null;

// ------------------------------------------------------------ taps
function ckShareText(kind) {
  const C = ck();
  if (kind === "list") return "Grocery list\n" + C.groc.filter(g => !g.done).map(g => "☐ " + g.t).join("\n");
  const one = r => `${r.t}\n${r.serves ? `Serves ${r.serves}` : ""}${ckMin(r) ? ` · ${ckTime(ckMin(r))}` : ""}\n\nIngredients\n${r.ing.map(x => `- ${x[0] ? x[0] + " " : ""}${x[1]}`).join("\n")}\n\nDirections\n${r.steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}${r.story ? `\n\n${r.story}` : ""}${r.src && r.src.url ? `\n\nVideo: ${r.src.url}` : ""}`;
  if (kind === "book") return ckMine().filter(r => !r.draft && !r.private).map(one).join("\n\n----------\n\n") || "";
  const r = ckRec(kind.slice(4)); return r && !r.private ? one(r) + "\n\n- from Cooking Hub" : "";
}
async function ckShare(kind) {
  const text = ckShareText(kind);
  if (!text) { toast(kind === "book" ? "No family recipes to share yet (private ones never leave this phone)" : "A private family recipe stays on this phone"); return; }
  try { if (navigator.share) { await navigator.share({ title: "Cooking Hub", text }); return; } } catch (e) { if (e && e.name === "AbortError") return; }
  try { await navigator.clipboard.writeText(text); toast("Copied - paste it anywhere"); } catch (e) { toast("Couldn't share on this phone"); }
}
function ckClick(ds) {
  if (typeof MODE === "undefined" || MODE !== "cooking") return false;
  const C = ck();
  if (ds.ckclose && !ds.ask && !ds.open) { hideCk(); render(); return true; }
  if (ds.ckclose) { hideCk(); return false; }           // Ask / ⚙ from More: close ours, let the engine open its own
  if (ds.ckback) { ckBack(); return true; }
  if (ds.cktab) { if (ds.ckroot) CK_STACK = []; ckReset(); if (ds.cktab === "finder") CK_RESULTS = null; showCk(ds.cktab, !ds.ckroot); ckNavEnsure(); return true; }
  if (ds.ckcat) { CK_CAT = ds.ckcat; CK_Q = ""; CK_PICK = ""; if (ds.cklist && CK_OPEN && CK_TAB === "list") showCk(); else showCk("list"); ckNavEnsure(); return true; }
  if (ds.ckvtab) { CK_VTAB = ds.ckvtab; render(); return true; }
  if (ds.ckrec) { ckUse(ds.ckrec); CK_RTAB = "ing"; ckReset(); showCk("rec"); ckNavEnsure(); return true; }
  if (ds.ckrtab) { CK_RTAB = ds.ckrtab; showCk(); return true; }
  if (ds.ckserv) { const r = ckRec(CK_CUR); if (r) { CK_SERV = Math.max(1, Math.min(99, (CK_SERV || r.serves) + Number(ds.ckserv))); showCk(); } return true; }
  if (ds.cktick) { const on = !CK_TICK.has(ds.cktick); if (on) CK_TICK.add(ds.cktick); else CK_TICK.delete(ds.cktick);
    const b = document.querySelector(`[data-cktick="${CSS.escape(ds.cktick)}"]`); if (b) { b.classList.toggle("on", on); b.setAttribute("aria-pressed", on); } return true; }
  if (ds.ckfav) { const i = C.favs.indexOf(ds.ckfav); if (i >= 0) C.favs.splice(i, 1); else C.favs.push(ds.ckfav); save(); if (CK_OPEN) showCk(); render(); buzz(); return true; }
  if (ds.ckcook) { ckUse(ds.ckcook); CK_STEP = 0; CK_DONE = false; CK_SAID = ""; showCk("cook"); return true; }
  if (ds.ckstep) { const r = ckRec(CK_CUR); if (!r) return true; const nx = CK_STEP + Number(ds.ckstep);
    if (nx >= r.steps.length) { CK_DONE = true; C.cooked[r.id] = ckCooked(r.id) + 1; C.lastCook = r.id; const w = C.week[today()]; if (w && w.r === r.id) w.done = true; save(); ckWakeOff(); showCk(); buzz(); return true; }
    CK_STEP = Math.max(0, nx); showCk(); return true; }
  if (ds.cktimer !== undefined) { const m = Number(ds.cktimer); if ((CK_TIMER && CK_TIMER.rec === CK_CUR) || !m) { CK_TIMER = null; clearInterval(CK_TIMEID); CK_TIMEID = 0; }
    else { CK_TIMER = { rec: CK_CUR, end: Date.now() + m * 60000 }; clearInterval(CK_TIMEID); CK_TIMEID = setInterval(ckTimerTick, 1000); toast(`⏲ ${m}-minute timer started`); }
    showCk(); return true; }
  if (ds.ckfind) { CK_RESULTS = ckFind(); showCk(); setTimeout(() => { const el = document.querySelector("#ckSheet .ck-match"); if (el) el.scrollIntoView({ behavior: "smooth", block: "center" }); }, 60); return true; }
  if (ds.ckhave) { C.have = C.have.filter(w => w !== ds.ckhave); CK_RESULTS = null; save(); showCk(); return true; }
  if (ds.ckhaveadd) { if (!C.have.includes(ds.ckhaveadd)) C.have.push(ds.ckhaveadd); CK_RESULTS = null; save(); showCk(); return true; }
  if (ds.ckpcat) { CK_PCAT = ds.ckpcat; showCk(); return true; }
  if ((ds.ckpnew || ds.ckquick || ds.ckpickday || ds.ckaddwk || ds.ckgrocfill || ds.ckrate || (ds.ckwrite && !ds.ckedit)) && ckWaits()) return true;
  if (ds.ckpnew) { CK_PFORM = true; CK_PEDIT = null; showCk(); return true; }
  if (ds.ckpcancel) { CK_PFORM = false; CK_PEDIT = null; showCk(); return true; }
  if (ds.ckpantry) { CK_PEDIT = ds.ckpantry; CK_PFORM = false; if (CK_OPEN && CK_TAB === "pantry") showCk(); else showCk("pantry"); ckNavEnsure(); return true; }
  if (ds.ckpdel) { C.pantry = C.pantry.filter(p => p.id !== ds.ckpdel); CK_PEDIT = null; save(); showCk(); render(); toast("Removed"); return true; }
  if (ds.ckquick) { if (!C.pantry.some(p => p.name.toLowerCase() === ds.ckquick.toLowerCase())) C.pantry.push({ id: uid(), name: ds.ckquick, qty: "", cat: /flour|sugar/i.test(ds.ckquick) ? "basic" : "ing", exp: "" }); save(); showCk(); return true; }
  if (ds.ckwknav) { CK_WKOFF = Math.max(-4, Math.min(8, CK_WKOFF + Number(ds.ckwknav))); showCk(); return true; }
  if (ds.ckpickday) { CK_PICK = ds.ckpickday; CK_Q = ""; showCk("list"); return true; }
  if (ds.ckpick) { if (CK_PICK) { C.week[CK_PICK] = { r: ds.ckpick, done: false }; save(); toast(`🍽️ ${(ckRec(ds.ckpick) || {}).t || "Dinner"} on ${prettyDate(CK_PICK)}`); CK_PICK = ""; ckBack(); render(); } return true; }
  if (ds.ckwkdone) { const w = C.week[ds.ckwkdone]; if (w) { w.done = !w.done; if (w.done) { C.cooked[w.r] = ckCooked(w.r) + 1; C.lastCook = w.r; } else C.cooked[w.r] = Math.max(0, ckCooked(w.r) - 1); save(); showCk(); render(); buzz(); } return true; }
  if (ds.ckwkdel) { delete C.week[ds.ckwkdel]; save(); showCk(); render(); return true; }
  if (ds.ckaddwk) { CK_ADDWK = CK_ADDWK === ds.ckaddwk ? "" : ds.ckaddwk; showCk(); return true; }
  if (ds.ckputday) { C.week[ds.ckputday] = { r: ds.ckputrec, done: false }; CK_ADDWK = ""; save(); showCk(); render(); toast(`📅 On ${ds.ckputday === today() ? "tonight's" : prettyDate(ds.ckputday) + "'s"} table`); return true; }
  if (ds.ckmissing) { const r = ckRec(ds.ckmissing); if (!r) return true; const have = ckHaveWords(), on = new Set(C.groc.map(g => g.t.toLowerCase())); let n = 0;
    r.ing.forEach(([amt, item, key]) => { if (!key || ckHas(key, have)) return; const t = ckTxt(`${amt ? amt + " " : ""}${item}`, 120); if (on.has(t.toLowerCase())) return; on.add(t.toLowerCase()); C.groc.push({ id: uid(), t, from: r.t, done: false }); n++; });
    save(); toast(n ? `🛒 ${ckPl(n, "item")} on your grocery list` : "You have everything for this one!"); return true; }
  if (ds.ckgrocfill) { const n = ckGrocFill(); save(); showCk(); toast(n ? `🧺 Added ${ckPl(n, "item")}` : "Nothing new to buy for this week's dinners"); return true; }
  if (ds.ckgroc) { const g = C.groc.find(x => x.id === ds.ckgroc); if (g) { g.done = !g.done; save(); showCk(); } return true; }
  if (ds.ckgrocclear) { C.groc = C.groc.filter(g => !g.done); save(); showCk(); return true; }
  if (ds.ckshare) { ckShare(ds.ckshare); return true; }
  if (ds.cklook) { C.look = ds.cklook === "vintage" ? "vintage" : "kitchen"; save(); ckNavEnsure(); showCk(); render(); toast(C.look === "vintage" ? "📖 Grandma's Recipe Box" : "✨ Magical Kitchen"); return true; }
  if (ds.ckvb) return true;
  if (ds.ckwrite) { CK_EDIT = null; CK_WSCAN = ds.ckwrite === "scan"; showCk("write"); if (CK_WSCAN) setTimeout(() => { const c = document.querySelector('#ckSheet [name="card"]'); if (c) c.click(); }, 80); return true; }
  if (ds.ckedit) { CK_EDIT = ds.ckedit; CK_WSCAN = false; showCk("write"); return true; }
  if (ds.ckdel) { const r = C.mine.find(x => x.id === ds.ckdel); if (!r) return true;
    if (CK_ARM !== "del:" + r.id) { CK_ARM = "del:" + r.id; showCk(); return true; }
    ckPhotoDel(r.photo); ckPhotoDel(r.card); C.mine = C.mine.filter(x => x.id !== r.id); C.favs = C.favs.filter(x => x !== r.id); delete C.rate[r.id];
    Object.keys(C.week).forEach(d => { if (C.week[d].r === r.id) delete C.week[d]; }); save(); CK_ARM = ""; CK_EDIT = null; CK_STACK = []; showCk("book", false); render(); toast("Recipe deleted"); return true; }
  if (ds.ckrow) { const list = document.getElementById(ds.ckrow === "ing" ? "ckIngList" : "ckStepList"); if (!list) return true;
    list.insertAdjacentHTML("beforeend", ds.ckrow === "ing" ? ckWIng() : ckWStep(list.children.length + 1)); const last = list.lastElementChild.querySelector("input, textarea"); if (last) last.focus(); return true; }
  if (ds.ckrowdel) { return true; }                       // handled with the element (needs which row) - see the listener below
  if (ds.ckwserv) { const i = document.querySelector('#ckSheet [name="serves"]'); if (i) i.value = Math.max(1, Math.min(99, (Number(i.value) || 4) + Number(ds.ckwserv))); return true; }
  if (ds.ckdraft) { const f = document.querySelector("#ckSheet form[data-ckwrite]"); if (f) { f.querySelector('[name="draft"]').value = "1"; f.requestSubmit ? f.requestSubmit() : f.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true })); } return true; }
  if (ds.ckrate) { ckUse(ds.ckrate); CK_DONE = false; showCk("rate"); return true; }
  if (ds.ckrb) { CK_RB = ds.ckrb; showCk(); return true; }
  if (ds.ckshareask) { if (CK_SHAREBOX !== ds.ckshareask && ckWaits()) return true; CK_SHAREBOX = CK_SHAREBOX === ds.ckshareask ? "" : ds.ckshareask; CK_REPORTBOX = ""; showCk(); setTimeout(() => { const f = document.querySelector("#ckSheet .ck-sharebox"); if (f) f.scrollIntoView({ block: "center" }); }, 40); return true; }
  if (ds.ckreportask) { CK_REPORTBOX = CK_REPORTBOX === ds.ckreportask ? "" : ds.ckreportask; CK_SHAREBOX = ""; showCk(); setTimeout(() => { const f = document.querySelector("#ckSheet .ck-sharebox"); if (f) f.scrollIntoView({ block: "center" }); }, 40); return true; }
  if (ds.ckvote) { if (!cksOn()) return true; const id = ds.ckvote; cksVote(id).then(() => { const C2 = ck(); C2.votes = { [cksWeek(0)]: cksSid(id) }; save(); toast("🗳️ Your vote is in for next week"); if (CK_OPEN) showCk(); })
      .catch(() => toast("Couldn't send your vote right now - try again later")); return true; }
  if (ds.ckrvsign) { cksSignInReview().then(() => { try { localStorage.setItem("cookinghub.reviewer", "1"); } catch (e) { /* fine */ } CKS_REVIEW = null; CKS_RV_MSG = ""; showCk(); })
      .catch(e => { CKS_RV_MSG = "Sign-in didn't finish: " + (e && e.message || "try again"); showCk(); }); return true; }
  if (ds.ckrvreload) { CKS_REVIEW = null; CK_RVTALLY = null; cksRefresh(true); showCk(); return true; }
  if (ds.ckrvok || ds.ckrvno) { const id = ds.ckrvok || ds.ckrvno, s = (CKS_REVIEW && CKS_REVIEW.subs || []).find(x => x.id === id); if (!s) return true;
    (ds.ckrvok ? cksApprove(s) : cksDelete("recipe_submissions", id)).then(() => { CKS_REVIEW.subs = CKS_REVIEW.subs.filter(x => x.id !== id); toast(ds.ckrvok ? "✓ Approved - it shows for everyone" : "Rejected"); if (ds.ckrvok) cksRefresh(true); showCk(); })
      .catch(e => toast("Didn't go through: " + e.message)); return true; }
  if (ds.ckrvdrop) { const rep = ds.ckrvrep; cksDelete("recipes_shared", ds.ckrvdrop).then(() => rep ? cksDelete("recipe_reports", rep) : null).then(() => { CKS_REVIEW.reports = CKS_REVIEW.reports.filter(x => x.id !== rep); toast("Removed from every Cooking Hub"); cksRefresh(true); showCk(); })
      .catch(e => toast("Didn't go through: " + e.message)); return true; }
  if (ds.ckrvdis) { cksDelete("recipe_reports", ds.ckrvdis).then(() => { CKS_REVIEW.reports = CKS_REVIEW.reports.filter(x => x.id !== ds.ckrvdis); showCk(); }).catch(e => toast("Didn't go through: " + e.message)); return true; }
  return false;
}
// Row removal needs the button's own row; Ask / ⚙ from More are the engine's own sheets: close ours first (capture phase).
if (typeof document !== "undefined") {
  document.addEventListener("click", e => {
    if (typeof MODE === "undefined" || MODE !== "cooking" || !e.target || !e.target.closest) return;
    const del = e.target.closest("[data-ckrowdel]");
    if (del) { const row = del.closest(".ck-wrow"), list = row && row.parentElement; if (row && list && list.children.length > 1) { row.remove(); ckRenumber(); }
      else if (row) row.querySelectorAll("input, textarea").forEach(x => { x.value = ""; }); return; }
    const b = e.target.closest("[data-ckclose]"); if (b && (b.dataset.ask || b.dataset.open) && CK_OPEN) hideCk();
  }, true);
  document.addEventListener("change", e => {
    if (typeof MODE === "undefined" || MODE !== "cooking" || !e.target) return;
    const t = e.target;
    if (t.dataset && t.dataset.ckvoice) { ck().voice = !!t.checked; save(); if (t.checked) ckSay(); else ckWakeOff(), ckWakeOn(); const s = t.parentElement.querySelector("small"); if (s) s.textContent = t.checked ? "On" : "Off"; return; }
    if (t.type === "file" && (t.name === "photo" || t.name === "card") && t.closest("form[data-ckwrite]") && t.files && t.files[0]) {   // show the picked photo right away
      const drop = t.closest("label"), url = URL.createObjectURL(t.files[0]); let im = drop.querySelector("img.ck-preview");
      if (!im) { im = document.createElement("img"); im.className = "ck-preview"; drop.appendChild(im); } im.src = url; drop.classList.add("has"); }
  });
}

// ------------------------------------------------------------ forms
function ckSubmit(f, data) {
  if (typeof MODE === "undefined" || MODE !== "cooking") return false;
  const D = f.dataset, C = ck();
  if (D.cksetup) { C.look = data.look === "vintage" ? "vintage" : "kitchen"; C.setup = true; C.setupDay = today(); const nm = ckTxt(data.name, 30); if (nm) S.name = nm; save(); ckNavEnsure(); render(); buzz(); window.scrollTo(0, 0); /* the welcome is tall: Home opens at the top, on the fox */ toast(C.look === "vintage" ? "📖 Welcome to Grandma's Recipe Box" : "✨ Welcome to your kitchen, Chef!"); return true; }
  if ((D.ckgrocadd || D.ckrateform || (D.ckpform === "new") || (D.ckwrite === "new")) && ckWaits()) return true;
  if (D.ckshareform) { if (CK_BUSY) return true; const r = C.mine.find(x => x.id === D.ckshareform); if (!r || r.private || r.draft) return true;
    if (data.agree !== "1") { CK_MSG = "Tick the box to say it's your own or your family's recipe."; ckMsgShow(); return true; }
    CK_BUSY = true; toast("Sending…");
    (async () => { try { let photo = ""; if (data.photo === "1" && r.photo) { const d = CK_IMG[r.photo] || await ckIdb("readonly", s => s.get(r.photo)); if (d) photo = await ckSmall(d); }
        const id = await cksSend(r, { by: data.by, photo }); r.shared = { id, at: today(), h: cksHash(r) }; save(); CK_SHAREBOX = ""; toast("🌎 Sent for review - it shows for everyone once it's approved"); }
      catch (e) { toast("Couldn't send right now - check your connection and try again"); }
      finally { CK_BUSY = false; if (CK_OPEN) showCk(); } })(); return true; }
  if (D.ckreportform) { const id = D.ckreportform, why = ckTxt(`${data.why || ""}${data.more ? " - " + data.more : ""}`, 300);
    if (cksOn()) cksReport(cksSid(id), why).catch(() => {}); C.hidden = [...new Set([...(C.hidden || []), id])]; save(); CK_REPORTBOX = ""; toast("Thanks - we'll look at it. It's hidden on this phone."); ckBack(); render(); return true; }
  if (D.ckcrown) { const r = ckRec(D.ckcrown); if (!r || !cksOn()) return true; cksCrown(r, data.tip).then(() => { toast("🏆 " + r.t + " is this week's Recipe of the Week"); showCk(); }).catch(e => toast("Didn't go through: " + e.message)); return true; }
  if (D.cksearch) { CK_Q = ckTxt(data.q, 40); CK_PICK = ""; if (!CK_Q) { CK_CAT = "all"; } showCk("list"); ckNavEnsure(); return true; }
  if (D.ckhaveform) { const w = ckTxt(data.w, 30); if (w && !C.have.some(x => x.toLowerCase() === w.toLowerCase())) C.have.push(w); CK_RESULTS = null; save(); showCk(); setTimeout(() => { const i = document.querySelector('#ckSheet [name="w"]'); if (i) i.focus(); }, 30); return true; }
  if (D.ckgrocadd) { const t = ckTxt(data.t, 120); if (t) C.groc.push({ id: uid(), t, from: "", done: false }); save(); showCk(); setTimeout(() => { const i = document.querySelector('#ckSheet [name="t"]'); if (i) i.focus(); }, 30); return true; }
  if (D.ckpform) {
    const name = ckTxt(data.name, 40); if (!name) { CK_MSG = "What is it?"; ckMsgShow(); return true; }
    const vals = { name, qty: ckTxt(data.qty, 24), cat: ["ing", "spice", "basic"].includes(data.cat) ? data.cat : "ing", exp: ckIsD(data.exp) ? data.exp : "" };
    const p = D.ckpform !== "new" && C.pantry.find(x => x.id === D.ckpform);
    if (p) Object.assign(p, vals); else C.pantry.push({ id: uid(), ...vals });
    CK_PFORM = false; CK_PEDIT = null; CK_RESULTS = null; save(); showCk(); render(); toast(p ? "Saved ✓" : `🫙 ${name} added`); return true;
  }
  if (D.ckrateform) {
    const s = ckInt(data.s, 0, 5, 0); if (!s) { CK_MSG = "Tap the stars to rate it."; ckMsgShow(); return true; }
    const id = D.ckrateform; (C.rate[id] = C.rate[id] || []).push({ d: today(), s, taste: ckInt(data.taste, 0, 5, 0), ease: ckInt(data.ease, 0, 5, 0), acc: ckInt(data.acc, 0, 5, 0), cooked: data.cooked === "1", note: ckTxt(data.note, 140) });
    if (C.rate[id].length > 50) C.rate[id] = C.rate[id].slice(-50);
    if (/^s-/.test(id) && cksOn()) cksRate(id, s, data.cooked === "1").catch(() => {});   // counts toward the community stars
    save(); CK_MSG = ""; toast("★ Thanks, Chef - rating saved"); CK_RB = "all"; CK_STACK = []; showCk("ribbon", false); return true;
  }
  if (D.ckwrite) {
    if (CK_BUSY) return true;                             // a second tap while photos are still being kept
    const draft = data.draft === "1", t = ckTxt(data.t, 80);
    if (!t) { f.querySelector('[name="draft"]').value = ""; CK_MSG = "Give your recipe a name."; ckMsgShow(); const n = f.querySelector('[name="t"]'); if (n) n.focus(); return true; }
    const amts = [...f.querySelectorAll('[name="amt"]')].map(x => x.value), items = [...f.querySelectorAll('[name="item"]')].map(x => x.value);
    const ing = items.map((it, i) => [ckTxt(amts[i], 30), ckTxt(it, 90)]).filter(x => x[1]).map(x => [x[0], x[1], ckKeyOf(x[1])]);
    const steps = [...f.querySelectorAll('[name="step"]')].map(x => ckTxt(x.value, 600)).filter(Boolean);
    const cat = CK_WRITE_CATS.includes(data.cat) ? data.cat : "dinner", old = D.ckwrite !== "new" ? C.mine.find(x => x.id === D.ckwrite) : null;
    const vals = { t, cat: [cat], serves: ckInt(data.serves, 1, 99, 4), prep: ckInt(data.prep, 0, 2000, 0), cook: ckInt(data.cook, 0, 2000, 0), ing, steps,
      story: ckTxt(data.story, 2000), by: ckTxt(data.by, 40), private: data.private === "1", draft, e: (CK_CATS[cat] || ["📖"])[0], blurb: "", tip: "", gran: "" };
    const files = { photo: f.querySelector('[name="photo"]'), card: f.querySelector('[name="card"]') };
    CK_BUSY = true;
    (async () => {
      const ids = {};
      for (const k of ["photo", "card"]) { const el = files[k]; if (el && el.files && el.files[0]) { try { ids[k] = await ckPhotoPut(await ckShrink(el.files[0], k === "card" ? 1600 : 1200)); } catch (e) { CK_MSG = "That photo couldn't be kept - try another."; } } }
      CK_BUSY = false;
      let r = old;
      if (r) { ["photo", "card"].forEach(k => { if (ids[k]) { ckPhotoDel(r[k]); r[k] = ids[k]; } }); Object.assign(r, vals); }
      else { r = { id: "m-" + uid(), added: today(), photo: ids.photo || "", card: ids.card || "", ...vals }; C.mine.push(r); }
      save(); CK_EDIT = null; CK_WSCAN = false;
      if (draft) { toast("📝 Draft saved"); CK_STACK = []; showCk("book", false); }
      else { toast(`🔖 ${t} is in your cookbook`); ckUse(r.id, true); CK_STACK = ["book"]; showCk("rec", false); }
      render(); buzz();
    })();
    return true;
  }
  return false;
}

// ------------------------------------------------------------ reminders, Life pulse, what Ask reads
// Reminders (⚙ → Reminders on): tonight's planned dinner at 3 PM (time to thaw or shop), and a pantry item the day before and the
// morning it expires.
function ckReminders(add, inWin) {
  if (!ckSet()) return;
  const C = ck(), t = today();
  [t, addDays(t, 1)].forEach(day => { const w = C.week[day], r = w && !w.done && ckRec(w.r); if (!r || !inWin(day)) return;
    add(`ckd:${day}:${r.id}`, atMs(day, "21:00"), atMs(day, "15:00"), `🍽️ Tonight: ${r.t}`, `${ckMin(r) ? "About " + ckTime(ckMin(r)) + ". " : ""}Anything to thaw or pick up?`); });
  C.pantry.filter(p => p.exp).forEach(p => [1, 0].forEach(n => { const d = addDays(p.exp, -n); if (inWin(d) && d >= t)
    add(`ckx:${p.id}:${p.exp}:${n}`, atMs(d, "23:59"), atMs(d, "09:00"), `${ckEmoji(p.name)} ${p.name} ${n ? "expires tomorrow" : "expires today"}`, "Use it up - the Meal Finder can help"); }));
}
function ckPulse(add) {
  if (typeof MODE === "undefined" || MODE !== "cooking" || !ckSet()) return;
  ckExpSoon().forEach(p => add(daysUntil(p.exp) <= 0 ? 9 : 6, ckEmoji(p.name), `${p.name} - ${ckExpTxt(p).toLowerCase()}`, null));
  const r = ckTonight(); if (r && !ck().week[today()].done) add(5, "🍽️", r.private ? "Tonight's dinner is planned" : `Tonight: ${r.t}`, null);   // a private recipe's name never leaves the phone
}
function ckContext() {
  if (!ckSet()) return {};
  const C = ck(), short = r => ({ name: r.t, minutes: ckMin(r) || undefined, serves: r.serves, kind: r.cat.join(", "), ingredients: r.ing.map(x => `${x[0] ? x[0] + " " : ""}${x[1]}`).slice(0, 20) });
  const pub = id => { const r = ckRec(id); return r && !r.private ? r : null; };   // a Private Family Recipe never reaches Ask - not even its name
  return { about: "This is the cook's own Cooking Hub on their phone. Answer from these recipes, their pantry and their week. Never give nutrition, diet or health advice; for food safety use USDA safe temperatures. Private family recipes are not included.",
    pantry: C.pantry.map(p => ({ item: p.name, amount: p.qty || undefined, useBy: p.exp || undefined })),
    thisWeek: ckWeekDays(0).map(d => ({ day: d, dinner: (pub((C.week[d] || {}).r) || {}).t, cooked: !!(C.week[d] || {}).done })).filter(x => x.dinner),
    groceryList: C.groc.filter(g => !g.done && !(ckMine().find(r => r.private && r.t === g.from))).map(g => g.t).slice(0, 40),
    favorites: C.favs.map(id => (pub(id) || {}).t).filter(Boolean),
    myRatings: Object.keys(C.rate).map(id => ({ recipe: (pub(id) || {}).t, stars: Math.round(ckAvg(id) * 10) / 10, times: ckRates(id).length })).filter(x => x.recipe),
    myFamilyRecipes: ckMine().filter(r => !r.draft && !r.private).slice(0, 10).map(short),
    builtInRecipes: ckBook().map(r => r.t) };
}
