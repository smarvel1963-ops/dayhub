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
});

const OWNER_KEY = "dayhub.owner";
const ownerSwitches = () => { try { return JSON.parse(localStorage.getItem(OWNER_KEY) || "{}") || {}; } catch (e) { return {}; } };
function setOwnerSwitch(name, val) {
  const o = ownerSwitches();
  if (val) o[name] = true; else delete o[name];
  try { localStorage.setItem(OWNER_KEY, JSON.stringify(o)); } catch (e) { /* private mode */ }
}
// A switch is on when the switchboard says so, or this phone's owner turned it on.
const switchOn = name => !!SWITCHES[name] || !!ownerSwitches()[name];
