/* SAVE AS: features.js · LOCATION: C:/MarvelApps/dayhub/features.js
 * DAY HUB SWITCHBOARD (Scott 10/3: "make it a workable and saleable project and
 * then have things to turn on once approved"). Loaded FIRST (before app.js) by
 * index.html and ../cruisehub/index.html.
 *
 * Every switch defaults OFF. OFF = Day Hub behaves like v0.39 for everyone,
 * except GMAIL off hides the Gmail connect from phones that never connected it.
 * Each switch waits for an approval - see docs/LAUNCH_SWITCHES.md for what,
 * the steps, how to flip it, and how to check it worked.
 *
 * To turn one on for EVERYONE: change false -> true here, bump the version
 * (app.js VERSION, version.json, sw.js CACHE), run the tests, push.
 * To try one on ONE phone first: Settings -> tap the version line 7 times ->
 * Owner switches. That is stored on that phone only (localStorage
 * "dayhub.owner") and never leaves it.
 */
"use strict";
const SWITCHES = Object.freeze({
  PRO_GATE: true,     // ON 2026-10-03 (Scott "go": Whop product live). OFF = everything free, no Pro section anywhere.
  AI_PUBLIC: true,    // ON 2026-10-03 (Scott: "turn it on"). Relay also needs Script Property AI_PUBLIC=true. OFF = only the owner passphrase works.
  GMAIL: false,       // Gmail -> plans. Waits on Google's restricted-scope verification.
  STORE: false,       // "Get it on Google Play" link. Waits on the Play listing going live.
  CRUISE_PASS: true,  // ON 2026-10-07 (Scott: "go"). Whop prod_D1Rb57NYoYxR5 + relay v5 (deploy v10) live; unlock tested OK with the 10/7 test buy.
  TRIP_PASS: true,    // ON 2026-10-11 (Scott: "get it completed and listed today"). Whop prod_xFJeMtq6FYVgk + relay v6 (deploy v11) + TRIP_PRODUCT_ID live.
  AI_CREDITS: true,   // ON 2026-10-11 (Scott "ok"). Whop packs visible, relay v8 (deploy 13) counts PAYMENTS; marvelcalls test buy = 200 questions.
  AUTO_PASS: true,    // ON 2026-10-14 (Scott "yes do 1-5"). Whop "Auto Hub Pro" prod_JZvlJLr71aVz4 $2.99/mo, 30-day trial; relay v14 (deploy 19). Free = 1 car.
  UNIVERSE_PASS: false, // Hub Universe Pro - one membership, Pro in every hub (Scott 10/17 "yes to hub universe pro"). OFF until Scott sets the price + Whop product.
  CHALLENGES: false,  // Health Hub friend step challenges (Scott 10/17: "step competitions against friends"). OFF until the relay has a "challenge" task.
  MONEY_PASS: false,  // Money Hub Pro $2.99/mo (Scott 10/15). OFF until the Whop product + relay PASSES moneyhub. Free = 3 accounts, no CSV / Reports.
  HOME_VALUE: true,   // ON 2026-10-14 (Scott: "get it done"). Home Hub "Hub Predicted Value" card (homevalue.js), Redfin ZIP data in hpv/.
});

// Scott approved 10/3: $4.99/mo or $29.99/yr, contact smarvel1963@gmail.com.
// Sold on WHOP only (never Stripe-direct). Product "Day Hub Pro" prod_xD6LAe50BRN9C
// in Marvel Corp (biz_loYMoMQKy5XhM0); the buyer unlocks with the EMAIL they
// bought with (Whop has no license-key app for this business) - v0.41.
const PLAN = Object.freeze({
  NAME: "Day Hub Pro",
  MONTHLY: "$4.99/month",
  YEARLY: "$29.99/year",
  WHOP_CHECKOUT_URL: "https://whop.com/commander-marvel-por-picks/day-hub-pro",
  PLAY_STORE_URL: "",
  CONTACT_EMAIL: "smarvel1963@gmail.com",
  // What Pro unlocks. Everything else (all the cards, reminders, budget, lists,
  // trips...) is free forever and works with no account.
  PRO_FEATURES: ["ai", "gcal", "mail", "sync"],
  RECHECK_DAYS: 7,    // the purchase is re-checked with Whop once a week
  GRACE_DAYS: 14,     // ...and stays good this long past that if the phone can't reach the check
  MAX_PHONES: 3,      // must match MAX_PHONES in relay/Code.gs (the relay enforces it)
  // CRUISE HUB PASS (Scott 10/4: "cruise app 9.99 per year as many cruises as you want that year").
  // A second Whop product; Cruise Hub only. Day Hub Pro ALSO unlocks Cruise Hub. Shown while CRUISE_PASS is on.
  CRUISE_NAME: "Cruise Hub Pass",
  CRUISE_YEARLY: "$9.99/year",
  // Whop product "Cruise Hub Pass" prod_D1Rb57NYoYxR5 (Marvel Corp), created 10/7, hidden until CRUISE_PASS is on.
  CRUISE_CHECKOUT_URL: "https://whop.com/commander-marvel-por-picks/cruise-hub-pass",
  // TRIP HUB PASS (Scott 10/11, same model as the Cruise Hub Pass): $9.99/year, every trip that year.
  // Trip Hub only; Day Hub Pro ALSO unlocks Trip Hub. The AI stays Day Hub Pro (the relay checks Day Hub Pro for AI).
  TRIP_NAME: "Trip Hub Pass",
  TRIP_YEARLY: "$9.99/year",
  // Whop product "Trip Hub Pass" prod_xFJeMtq6FYVgk (Marvel Corp), created 10/11; Discover application submitted.
  TRIP_CHECKOUT_URL: "https://whop.com/commander-marvel-por-picks/trip-hub-pass",
  // HUB AI CREDITS (Scott 10/11: 100 for $2.99 / 500 for $9.99). One-time packs, work in EVERY hub,
  // one credit per AI answer; Day Hub Pro still gets its free questions a day first. Shown while AI_CREDITS is on.
  AI_CREDITS_NAME: "Hub AI Credits",
  // Whop one-time products (Marvel Corp, visible 10/11), each access auto-expires after
  // 1 day so a buyer can top up again; the relay still counts expired packs. Relay v7 Script Property AI_CREDIT_PRODUCTS.
  // AUTO HUB PRO (Scott 10/14: "2.99 month"). Auto Hub only; free = 1 car. Shown while AUTO_PASS is on.
  AUTO_NAME: "Auto Hub Pro",
  AUTO_MONTHLY: "$2.99/month",
  AUTO_CHECKOUT_URL: "https://whop.com/commander-marvel-por-picks/auto-hub-pro",   // prod_JZvlJLr71aVz4
  // MONEY HUB PRO (Scott 10/15: "$2.99/mo"). Money Hub only. Shown while MONEY_PASS is on.
  MONEY_NAME: "Money Hub Pro",
  MONEY_MONTHLY: "$2.99/month",
  MONEY_CHECKOUT_URL: "",            // the Whop link once the product exists
  UNIVERSE_NAME: "Hub Universe Pro",
  UNIVERSE_CHECKOUT_URL: "",         // the Whop link once Scott creates "Hub Universe Pro" (price not set yet)
  AI_PACKS: [{ n: 100, price: "$2.99", url: "https://whop.com/commander-marvel-por-picks/hub-ai-credits-100-questions" },   // prod_PZs1nowbQqbau
             { n: 500, price: "$9.99", url: "https://whop.com/commander-marvel-por-picks/hub-ai-credits-500-questions" }],  // prod_8ZVor6HNWoWLP
});

// v1.50 STORE MODE (Google Play, Scott 10/17). The Play Store app (a Trusted Web Activity) opens start_url
// ".../?src=play". For that session the app shows NO price, NO buy button and NO Whop link (Google's payments rule);
// unlocking with an email someone already has (Pro, a Pass, AI credits, a friends pass) still works.
// sessionStorage, not localStorage: the Play app shares Chrome's storage, and the web app in Chrome keeps its buttons.
const STORE_MODE = (() => {
  try { if (/[?&]src=play(&|$)/.test(location.search)) sessionStorage.setItem("hub.store", "play"); return sessionStorage.getItem("hub.store") === "play"; }
  catch (e) { return typeof location !== "undefined" && /[?&]src=play(&|$)/.test(location.search); }
})();

const OWNER_KEY = "dayhub.owner";
const ownerSwitches = () => { try { return JSON.parse(localStorage.getItem(OWNER_KEY) || "{}") || {}; } catch (e) { return {}; } };
function setOwnerSwitch(name, val) {
  const o = ownerSwitches();
  if (val) o[name] = true; else delete o[name];
  try { localStorage.setItem(OWNER_KEY, JSON.stringify(o)); } catch (e) { /* private mode */ }
}
// A switch is on when the switchboard says so, or this phone's owner turned it on.
const switchOn = name => !!SWITCHES[name] || !!ownerSwitches()[name];
