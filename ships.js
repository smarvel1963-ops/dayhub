/* SAVE AS: ships.js · LOCATION: C:/MarvelApps/dayhub/ships.js
 * SHIP GUIDES - Cruise Hub's ship knowledge, ONE verified ship at a time (Scott's plan: "Golden Ship -
 * Caribbean Princess first ... build depth before breadth" and "facts come from data; every fact gets a
 * source + verified date"). Nothing here is guessed: a deck, cost or note appears only when the cited
 * Princess page states it; otherwise it is left out. Loaded before ui.js by both hubs' pages.
 *
 * cost: "included" / "extra" exactly as princess.com groups them; null = the page doesn't say.
 * src:  which source line below the fact came from.
 */
"use strict";

const SHIP_GUIDES = {
  "caribbean princess": {
    name: "Caribbean Princess", line: "Princess", verified: "2026-10-05",
    sources: {
      ship: "https://www.princess.com/ships-and-experience/ships/cb-caribbean-princess",
      facts: "https://www.princess.com/news/backgrounders-and-fact-sheets/caribbean-princess-fact-fheet",
      decks: "https://gb-www.princess.com/html/global/book/ships/deck-plans/cb-accessible-route-text.html",
    },
    facts: { guests: 3140, crew: 1200, tonnage: 112894, lengthFt: 952, decks: 19, built: 2004 },
    venues: [
      // ---- eat (princess.com "Included" / "Extra Cost (Specialty Restaurants)")
      { cat: "eat", name: "Island Dining Room", deck: "5", cost: "included", note: "Main dining room — flexible or walk-in dining" },
      { cat: "eat", name: "Coral Dining Room", deck: "6", cost: "included", note: "Main dining room" },
      { cat: "eat", name: "Palm Dining Room", deck: "6", cost: "included", note: "Main dining room" },
      { cat: "eat", name: "International Café", deck: "5", cost: "included", note: "Open 24 hours a day" },
      { cat: "eat", name: "World Fresh Marketplace", deck: "15", cost: "included", note: "Buffet" },
      { cat: "eat", name: "Slice Pizzeria", deck: "15", cost: "included" },
      { cat: "eat", name: "The Salty Dog Grill", deck: "15", cost: "included" },
      { cat: "eat", name: "Coffee & Cones", deck: "15", cost: "included", note: "Complimentary ice cream cones" },
      { cat: "eat", name: "Afternoon Tea", deck: null, cost: "included" },
      { cat: "eat", name: "Crown Grill", deck: "6", cost: "extra", note: "Premium steakhouse" },
      { cat: "eat", name: "Sabatini's Italian Trattoria", deck: "7", cost: "extra" },
      { cat: "eat", name: "Steamers Seafood", deck: "15", cost: "extra", note: "Pop-up dining venue" },
      { cat: "eat", name: "Planks BBQ", deck: "15", cost: "extra", note: "Pop-up experience" },
      { cat: "eat", name: "Chef's Table Experience", deck: null, cost: "extra", note: "Limited capacity, reservations required" },
      { cat: "eat", name: "Ultimate Balcony Dining", deck: null, cost: "extra", note: "On your balcony" },
      { cat: "eat", name: "Room service", deck: null, cost: null, note: "24 hours — fees for guests without a package" },
      { cat: "eat", name: "OceanNow® delivery", deck: null, cost: null, note: "Food and drinks brought to you — additional charge may apply" },
      // ---- drink
      { cat: "drink", name: "Vines Wine Bar", deck: "5", cost: null, note: "Voted one of the Best Wine Bars at Sea" },
      { cat: "drink", name: "Good Spirits® At Sea", deck: "5", cost: null, note: "Immersive cocktail experience" },
      { cat: "drink", name: "Churchill's Cigar Lounge", deck: "6", cost: null },
      { cat: "drink", name: "Crooners", deck: "7", cost: null, note: "Sinatra-era piano bar" },
      { cat: "drink", name: "Wheelhouse Bar", deck: "7", cost: null },
      { cat: "drink", name: "Explorers Lounge", deck: "7", cost: null },
      { cat: "drink", name: "Club Fusion", deck: "7", cost: null, note: "Dance floor + big sound system" },
      { cat: "drink", name: "Calypso Bar · Outriggers Bar", deck: "15", cost: null, note: "Pool bars" },
      { cat: "drink", name: "Tradewinds Bar", deck: "16", cost: null },
      { cat: "drink", name: "The Reef Bar", deck: "17", cost: null },
      { cat: "drink", name: "Skywalkers Nightclub", deck: "18–19", cost: null, note: "Panoramic views, 15 decks above the sea" },
      // ---- shows & fun
      { cat: "fun", name: "Princess Theater", deck: "7 (upper level)", cost: null, note: "Original productions" },
      { cat: "fun", name: "Grand Casino", deck: "7", cost: null, note: "Slots, table games, gaming lessons" },
      { cat: "fun", name: "The Piazza", deck: "5", cost: null, note: "The hub — street performers, shops" },
      { cat: "fun", name: "Movies Under the Stars®", deck: "16", cost: null, note: "Poolside movies, complimentary fresh popcorn" },
      { cat: "fun", name: "Fine Arts Gallery", deck: "5", cost: null, note: "Art auctions — no charge to attend" },
      { cat: "fun", name: "Princess Links", deck: "18", cost: null, note: "Putting course" },
      // ---- pools
      { cat: "pool", name: "Neptune's Reef & Pool", deck: "15", cost: null },
      { cat: "pool", name: "Calypso Reef & Pool", deck: "15", cost: null },
      { cat: "pool", name: "Lotus Pool", deck: "16", cost: null },
      { cat: "pool", name: "The Splash Pool", deck: "17", cost: null },
      // ---- spa & fitness
      { cat: "spa", name: "Lotus Spa®", deck: "16", cost: null },
      { cat: "spa", name: "Fitness Center", deck: "16", cost: null, note: "Classes include Pilates and yoga" },
      { cat: "spa", name: "The Sanctuary", deck: "17", cost: null, note: "Adults-only retreat" },
      { cat: "spa", name: "Beauty Salon", deck: "16", cost: null },
      // ---- kids
      { cat: "kids", name: "Treehouse · The Lodge", deck: "16", cost: null, note: "Kids' areas" },
      { cat: "kids", name: "The Beach House Teen Lounge", deck: "16", cost: null },
      // ---- services
      { cat: "service", name: "Guest Services", deck: "6", cost: null },
      { cat: "service", name: "Shore Excursions Desk", deck: "6", cost: null },
      { cat: "service", name: "Medical Center", deck: "4", cost: null, note: "Midship elevators" },
      { cat: "service", name: "The Shops of Princess", deck: "5 · 6 · 7", cost: null },
      { cat: "service", name: "Photo Gallery", deck: "7", cost: null },
      { cat: "service", name: "Wedding Chapel", deck: "16", cost: null },
    ],
  },
};
const SHIP_CATS = [["eat", "🍽️", "Eat"], ["drink", "🍹", "Drink"], ["fun", "🎭", "Shows & fun"], ["pool", "🏊", "Pools"], ["spa", "💆", "Spa & fitness"],
  ["kids", "🧒", "Kids"], ["service", "🛎️", "Services"], ["free", "✅", "What's included"]];
const shipGuide = name => SHIP_GUIDES[String(name || "").toLowerCase().replace(/\s+/g, " ").trim()] || null;
let SHIP_CAT = "eat";
function shipGuideHtml(tr) {
  const G = tr && shipGuide(tr.ship);
  if (!tr || !tr.ship) return `<div class="today-line sub">Add your ship (Plan → your cruise → Edit) to see its guide.</div>`;
  if (!G) return `<div class="today-line"><b>${esc(tr.ship)}</b>${tr.line ? ` · ${esc(tr.line)}` : ""}</div>
    <div class="today-line sub">The ship guide for ${esc(tr.ship)} isn't in Cruise Hub yet — Caribbean Princess is the first, more ships are coming. Until then your cruise line's app has the venues.</div>`;
  const f = G.facts, list = SHIP_CAT === "free" ? G.venues.filter(v => v.cost === "included") : G.venues.filter(v => v.cat === SHIP_CAT);
  const pill = v => v.cost === "included" ? `<span class="pill">Included</span>` : v.cost === "extra" ? `<span class="pill soon">Extra cost</span>` : "";
  return `<div class="today-line"><b>${esc(G.name)}</b> · ${G.line}${tr.cabin ? ` · cabin ${esc(tr.cabin)}` : ""}</div>
    <div class="today-line sub">${f.guests.toLocaleString()} guests · ${f.decks} decks · ${f.lengthFt} ft · built ${f.built}</div>
    ${tileNav(SHIP_CATS.map(([k, ic, l]) => ({ icon: ic, label: l, attrs: `data-shipcat="${k}"`, on: k === SHIP_CAT })), 4, "compact")}
    ${list.map(v => `<div class="row"><span class="grow"><b>${esc(v.name)}</b>${v.note ? `<span class="sub">${esc(v.note)}</span>` : ""}</span>
      ${v.deck ? `<span class="pill deck">Deck ${esc(v.deck)}</span>` : ""}${pill(v)}</div>`).join("")}
    <p class="fine" style="margin-top:8px">From <a href="${G.sources.ship}" target="_blank" rel="noopener">princess.com</a> (venues, included vs extra) and Princess's
      <a href="${G.sources.decks}" target="_blank" rel="noopener">deck-by-deck page</a> — checked ${prettyDate(G.verified)}, ${G.verified.slice(0, 4)}. Your ship's daily planner wins if it differs.</p>`;
}
function shipClick(ds) {
  if (!ds.shipcat) return false;
  SHIP_CAT = ds.shipcat; render(); return true;
}
