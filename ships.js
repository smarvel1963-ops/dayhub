/* SAVE AS: ships.js · LOCATION: C:/MarvelApps/dayhub/ships.js
 * SHIP + PORT GUIDES (port guides v0.65, below) - Cruise Hub's ship knowledge, ONE verified ship at a time (Scott's plan: "Golden Ship -
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

// ------------------------------------------------------------ port guides
// v0.65 (Scott's "Port Brain": "WELCOME TO NASSAU ... USD accepted, taxi, Wi-Fi ... Safety - current official
// information ... that updated date matters"). Same rule as the ship guide: a fact appears only when the cited
// OFFICIAL source states it (the port's own site or a cruise line's port guide). The U.S. travel advisory is a
// LINK to the live State Department page - never a copied level that could go stale.
const SG_DOS = "https://travel.state.gov/content/travel/en/traveladvisories/traveladvisories/";
const PORT_GUIDES = {
  nassau: { name: "Nassau", country: "The Bahamas", flag: "🇧🇸", verified: "2026-10-05", keys: ["nassau"],
    advisory: SG_DOS + "bahamas-travel-advisory.html",
    sources: { "Nassau Cruise Port": "https://nassaucruiseport.com/frequently-asked-questions/" },
    facts: [
      { icon: "💵", text: "The Bahamian dollar is on par with the U.S. dollar — both are accepted.", src: "https://nassaucruiseport.com/frequently-asked-questions/" },
      { icon: "📶", text: "Free Wi-Fi at the cruise port.", src: "https://nassaucruiseport.com/frequently-asked-questions/" },
      { icon: "🚕", text: "Only take rides from licensed operators — taxis and watercraft.", src: "https://nassaucruiseport.com/destination/special-tips/" },
      { icon: "💊", text: "At the port: a pharmacy, a First-Aid Center and a Guest Information Center.", src: "https://nassaucruiseport.com/services-home/guest-services/" },
      { icon: "🚌", text: "Downtown Nassau is the main hub for public transportation.", src: "https://nassaucruiseport.com/transportation/" },
    ] },
  "grand turk": { name: "Grand Turk", country: "Turks and Caicos", flag: "🇹🇨", verified: "2026-10-05", keys: ["grand turk"],
    advisory: "https://travel.state.gov/content/travel/en/international-travel/International-Travel-Country-Information-Pages/TurksandCaicosIslands.html",
    sources: { "Celebrity Cruises port guide": "https://www.celebritycruises.com/ports/grand-turk-turks-and-caicos" },
    facts: [
      { icon: "💵", text: "The currency is the U.S. dollar.", src: "https://www.celebritycruises.com/ports/grand-turk-turks-and-caicos" },
      { icon: "🏖️", text: "A beach and one of the region's largest free-form swimming pools right at the cruise center.", src: "https://www.celebritycruises.com/ports/grand-turk-turks-and-caicos" },
      { icon: "🚕", text: "Taxis wait at the terminal but have no meters — agree the fare first.", src: "https://www.celebritycruises.com/ports/grand-turk-turks-and-caicos" },
      { icon: "📍", text: "The cruise center is at the southern tip of the island.", src: "https://www.celebritycruises.com/ports/grand-turk-turks-and-caicos" },
    ] },
  cozumel: { name: "Cozumel", country: "Mexico", flag: "🇲🇽", verified: "2026-10-05", keys: ["cozumel"],
    advisory: SG_DOS + "mexico-travel-advisory.html",
    sources: { "Celebrity Cruises port guide": "https://www.celebritycruises.com/au/ports/cozumel-mexico" },
    facts: [
      { icon: "🛳️", text: "Three piers — Puerta Maya, Punta Langosta and the International Pier. Check which one your ship uses.", src: "https://www.celebritycruises.com/au/ports/cozumel-mexico" },
      { icon: "📍", text: "About 3 miles to San Miguel — a long walk or about a 10-minute taxi.", src: "https://www.celebritycruises.com/au/ports/cozumel-mexico" },
      { icon: "💵", text: "The local currency is the peso; many stores accept U.S. dollars.", src: "https://www.celebritycruises.com/au/ports/cozumel-mexico" },
      { icon: "🚕", text: "Agree on the taxi fare before you get in.", src: "https://www.celebritycruises.com/au/ports/cozumel-mexico" },
      { icon: "📶", text: "Free Wi-Fi past the terminal, plus food, shops and souvenir stalls.", src: "https://www.celebritycruises.com/au/ports/cozumel-mexico" },
    ] },
  "st. thomas": { name: "St. Thomas", country: "U.S. Virgin Islands", flag: "🇻🇮", verified: "2026-10-05", keys: ["st. thomas", "st thomas", "saint thomas", "charlotte amalie"],
    advisory: null,
    sources: { "Celebrity Cruises": "https://www.celebritycruises.com/popular-cruises/cruises-to-st-thomas-and-st-maarten" },
    facts: [
      { icon: "🇺🇸", text: "St. Thomas is a U.S. territory, and the U.S. dollar is the currency.", src: "https://www.celebritycruises.com/popular-cruises/cruises-to-st-thomas-and-st-maarten" },
      { icon: "🛳️", text: "Two docks — Havensight and Crown Bay — either side of Charlotte Amalie; neither is an easy walk to downtown.", src: "https://www.celebritycruises.com/popular-cruises/cruises-to-st-thomas-and-st-maarten" },
      { icon: "🚕", text: "Taxis are open-air 'safari' trucks with set per-person rates.", src: "https://www.celebritycruises.com/popular-cruises/cruises-to-st-thomas-and-st-maarten" },
      { icon: "🛍️", text: "Both piers have duty-free shopping, car rental, ATMs, tour desks and places to eat.", src: "https://www.celebritycruises.com/popular-cruises/cruises-to-st-thomas-and-st-maarten" },
    ] },
  "st. maarten": { name: "St. Maarten", country: "Sint Maarten", flag: "🇸🇽", verified: "2026-10-05", keys: ["st. maarten", "st maarten", "sint maarten", "philipsburg", "st. martin"],
    advisory: SG_DOS + "traveladvisories.html",
    sources: { "Celebrity Cruises port guide": "https://www.celebritycruises.com/ports/st-maarten" },
    facts: [
      { icon: "🚶", text: "Ships dock at Cruise Pier St. Maarten — about 15 minutes' walk to Philipsburg, 25 to Front Street.", src: "https://www.celebritycruises.com/ports/st-maarten" },
      { icon: "💵", text: "Guilder on the Dutch side, euro on the French side — U.S. dollars are widely accepted.", src: "https://www.celebritycruises.com/ports/st-maarten" },
      { icon: "⛴️", text: "Water taxis and shuttles run to the beaches.", src: "https://www.celebritycruises.com/ports/st-maarten" },
      { icon: "🚕", text: "Taxis wait at the port; many drivers will act as a guide (a tip is welcome).", src: "https://www.celebritycruises.com/ports/st-maarten" },
      { icon: "🏧", text: "At the port: ATMs, shops, tourist information, rental cars.", src: "https://www.celebritycruises.com/ports/st-maarten" },
    ] },
  "costa maya": { name: "Costa Maya", country: "Mexico", flag: "🇲🇽", verified: "2026-10-05", keys: ["costa maya", "mahahual"],
    advisory: SG_DOS + "mexico-travel-advisory.html",
    sources: { "Celebrity Cruises port guide": "https://www.celebritycruises.com/ports/costa-maya-mexico" },
    facts: [
      { icon: "🚋", text: "The pier is long — a free trolley runs from the ship to the port village.", src: "https://www.celebritycruises.com/ports/costa-maya-mexico" },
      { icon: "🏊", text: "The port complex has shops, food, ATMs, restrooms, Wi-Fi, a spa and a big pool with a swim-up bar.", src: "https://www.celebritycruises.com/ports/costa-maya-mexico" },
      { icon: "📍", text: "Mahahual is a short cab ride or about a 45-minute walk.", src: "https://www.celebritycruises.com/ports/costa-maya-mexico" },
      { icon: "💵", text: "The peso is the currency; U.S. dollars are widely accepted.", src: "https://www.celebritycruises.com/ports/costa-maya-mexico" },
      { icon: "🚕", text: "Taxis wait outside the port; golf carts can be rented.", src: "https://www.celebritycruises.com/ports/costa-maya-mexico" },
    ] },
  roatan: { name: "Roatán", country: "Honduras", flag: "🇭🇳", verified: "2026-10-05", keys: ["roatan", "roatán", "coxen hole", "mahogany bay"],
    advisory: SG_DOS + "traveladvisories.html",
    sources: { "Celebrity Cruises port guide": "https://www.celebritycruises.com/ports/roatan" },
    facts: [
      { icon: "🛳️", text: "Ships dock at Coxen Hole or Mahogany Bay — check which one is yours.", src: "https://www.celebritycruises.com/ports/roatan" },
      { icon: "💵", text: "The lempira is the currency; U.S. dollars are commonly accepted.", src: "https://www.celebritycruises.com/ports/roatan" },
      { icon: "🚕", text: "Taxis and rental cars are the usual way around.", src: "https://www.celebritycruises.com/ports/roatan" },
      { icon: "🛍️", text: "At Coxen Hole: a shopping mall, restaurants, an ATM and internet access.", src: "https://www.celebritycruises.com/ports/roatan" },
    ] },
  "grand cayman": { name: "Grand Cayman", country: "Cayman Islands", flag: "🇰🇾", verified: "2026-10-05", keys: ["grand cayman", "george town", "cayman"], tender: true,
    advisory: SG_DOS + "traveladvisories.html",
    sources: { "Celebrity Cruises port guide": "https://www.celebritycruises.com/ports/grand-cayman" },
    facts: [
      { icon: "🚤", text: "A TENDER port — small boats take you to one of three tender terminals on Harbour Drive, George Town. Allow extra time getting back.", src: "https://www.celebritycruises.com/ports/grand-cayman" },
      { icon: "💵", text: "Cayman dollar (US$1.20 = CI$1); most places show both prices and U.S. dollars are widely accepted.", src: "https://www.celebritycruises.com/ports/grand-cayman" },
      { icon: "🚕", text: "Taxis wait at the port; there's an efficient minibus network too.", src: "https://www.celebritycruises.com/ports/grand-cayman" },
      { icon: "🚗", text: "They drive on the LEFT.", src: "https://www.celebritycruises.com/ports/grand-cayman" },
      { icon: "💲", text: "Tipping: 10–15% at restaurants, $5–10 for a tour guide.", src: "https://www.celebritycruises.com/ports/grand-cayman" },
    ] },
  "princess cays": { name: "Princess Cays", country: "The Bahamas", flag: "🇧🇸", verified: "2026-10-05", keys: ["princess cays", "eleuthera"], tender: true,
    advisory: SG_DOS + "bahamas-travel-advisory.html",
    sources: { "Princess: Princess Cays": "https://www.princess.com/cruise-destinations/caribbean-cruises/princess-cays",
               "Princess blog": "https://www.princess.com/blog/things-to-do-in-princess-cays",
               "Princess fact sheet": "https://www.princess.com/news/backgrounders-and-fact-sheets/private-beach-paradise-awaits-princess-passengers" },
    facts: [
      { icon: "🚤", text: "A TENDER port — the ship anchors offshore and small boats take you in. Go early for the best spots and shorter tender waits.", src: "https://www.princess.com/cruise-destinations/caribbean-cruises/princess-cays" },
      { icon: "🍔", text: "A complimentary beachside BBQ lunch is included with most cruises.", src: "https://www.princess.com/cruise-destinations/caribbean-cruises/princess-cays" },
      { icon: "🏖️", text: "Beach chairs are first-come.", src: "https://www.princess.com/blog/things-to-do-in-princess-cays" },
      { icon: "🛖", text: "Rent a clamshell (small fee) or a bungalow — $199, or $249 in the adults-only Sanctuary — bungalows include priority tenders.", src: "https://www.princess.com/news/backgrounders-and-fact-sheets/private-beach-paradise-awaits-princess-passengers" },
      { icon: "🤿", text: "Snorkel gear, kayaks, paddleboards and Hobie Waves to rent from the shore.", src: "https://www.princess.com/blog/things-to-do-in-princess-cays" },
      { icon: "👟", text: "Bring water shoes — some of the shoreline is rocky.", src: "https://www.princess.com/cruise-destinations/caribbean-cruises/princess-cays" },
      { icon: "⏱️", text: "Calls here average about 7–8 hours.", src: "https://www.princess.com/news/backgrounders-and-fact-sheets/private-beach-paradise-awaits-princess-passengers" },
    ] },
  "san juan": { name: "San Juan", country: "Puerto Rico", flag: "🇵🇷", verified: "2026-10-05", keys: ["san juan", "puerto rico"], advisory: null,
    sources: { "Celebrity Cruises port guide": "https://www.celebritycruises.com/ports/san-juan" },
    facts: [
      { icon: "🇺🇸", text: "Puerto Rico is a U.S. territory, and the U.S. dollar is the currency.", src: "https://www.celebritycruises.com/ports/san-juan" },
      { icon: "🚶", text: "The main Old San Juan Cruise Pier is in the heart of the city — walk straight into Old San Juan.", src: "https://www.celebritycruises.com/ports/san-juan" },
      { icon: "🚋", text: "Old San Juan has a free trolley; there's a stop at the pier.", src: "https://www.celebritycruises.com/ports/san-juan" },
      { icon: "🚕", text: "Taxis line up outside the cruise terminal.", src: "https://www.celebritycruises.com/ports/san-juan" },
    ] },
  "key west": { name: "Key West", country: "Florida, USA", flag: "🇺🇸", verified: "2026-10-05", keys: ["key west"], advisory: null,
    sources: { "Celebrity Cruises port guide": "https://www.celebritycruises.com/ports/key-west" },
    facts: [
      { icon: "🛳️", text: "Three docks: Pier B, Mallory Square and the Navy (Outer) Mole. From the Navy Mole a shuttle trolley takes you into town.", src: "https://www.celebritycruises.com/ports/key-west" },
      { icon: "🚶", text: "Pier B and Mallory Square are a short walk from the shops — Duval Street is the main strip.", src: "https://www.celebritycruises.com/ports/key-west" },
      { icon: "🛺", text: "Golf carts, Jeeps and scooters rent near each dock; there's also the Old Town Trolley and the Conch Tour Train.", src: "https://www.celebritycruises.com/ports/key-west" },
      { icon: "💲", text: "U.S. dollar, ATMs everywhere; tip 15–20% at restaurants and bars.", src: "https://www.celebritycruises.com/ports/key-west" },
    ] },
  "ocho rios": { name: "Ocho Rios", country: "Jamaica", flag: "🇯🇲", verified: "2026-10-05", keys: ["ocho rios"],
    advisory: SG_DOS + "traveladvisories.html",
    sources: { "Celebrity Cruises port guide": "https://www.celebritycruises.com/ports/ocho-rios" },
    facts: [
      { icon: "🛳️", text: "Two piers: Turtle Bay (right by town) and James Bond Pier (about a 15-minute walk to the center).", src: "https://www.celebritycruises.com/ports/ocho-rios" },
      { icon: "💵", text: "Jamaican dollar (J$); U.S. dollars are often accepted.", src: "https://www.celebritycruises.com/ports/ocho-rios" },
      { icon: "🚕", text: "Use an OFFICIAL taxi — red license plate and fixed tariffs.", src: "https://www.celebritycruises.com/ports/ocho-rios" },
    ] },
  aruba: { name: "Aruba", country: "Aruba", flag: "🇦🇼", verified: "2026-10-05", keys: ["aruba", "oranjestad"],
    advisory: SG_DOS + "traveladvisories.html",
    sources: { "Celebrity Cruises port guide": "https://www.celebritycruises.com/ports/aruba" },
    facts: [
      { icon: "🚶", text: "Ships dock in Oranjestad, close to the center — shops, restaurants and beaches are within walking distance.", src: "https://www.celebritycruises.com/ports/aruba" },
      { icon: "💵", text: "Aruban florin; U.S. dollars are commonly accepted.", src: "https://www.celebritycruises.com/ports/aruba" },
      { icon: "🏧", text: "At the port: ATMs, tourist information and a taxi rank; good buses around the island.", src: "https://www.celebritycruises.com/ports/aruba" },
      { icon: "👕", text: "'Happy Information Officers' in blue T-shirts greet passengers — ask them anything.", src: "https://www.celebritycruises.com/ports/aruba" },
    ] },
  juneau: { name: "Juneau", country: "Alaska, USA", flag: "🇺🇸", verified: "2026-10-05", keys: ["juneau"], advisory: null,
    sources: { "Celebrity Cruises port guide": "https://www.celebritycruises.com/ports/juneau" },
    facts: [
      { icon: "🚶", text: "Three cruise terminals run along downtown — you can walk into town from any of them.", src: "https://www.celebritycruises.com/ports/juneau" },
      { icon: "🚡", text: "The Goldbelt Mount Roberts Tramway is right across from the South Cruise Ship Berth.", src: "https://www.celebritycruises.com/ports/juneau" },
      { icon: "🧊", text: "Mendenhall Glacier is a short drive from downtown.", src: "https://www.celebritycruises.com/ports/juneau" },
      { icon: "💲", text: "U.S. dollar, ATMs widely available; tip 15–20% in restaurants, 10–15% in bars and taxis.", src: "https://www.celebritycruises.com/ports/juneau" },
    ] },
  ketchikan: { name: "Ketchikan", country: "Alaska, USA", flag: "🇺🇸", verified: "2026-10-05", keys: ["ketchikan"], advisory: null,
    sources: { "Celebrity Cruises port guide": "https://www.celebritycruises.com/ports/ketchikan" },
    facts: [
      { icon: "🚶", text: "Ships dock downtown along Front Street — an easy walk to shops, restaurants and Creek Street.", src: "https://www.celebritycruises.com/ports/ketchikan" },
      { icon: "🚌", text: "Free shuttles May–September between the cruise terminals and downtown; buses, taxis and rideshare too.", src: "https://www.celebritycruises.com/ports/ketchikan" },
      { icon: "ℹ️", text: "Visitor information center on the quayside, with restrooms.", src: "https://www.celebritycruises.com/ports/ketchikan" },
      { icon: "💲", text: "U.S. dollar.", src: "https://www.celebritycruises.com/ports/ketchikan" },
    ] },
  skagway: { name: "Skagway", country: "Alaska, USA", flag: "🇺🇸", verified: "2026-10-05", keys: ["skagway"], advisory: null,
    sources: { "Celebrity Cruises port guide": "https://www.celebritycruises.com/ports/skagway" },
    facts: [
      { icon: "🛳️", text: "Two docks: the Railroad Dock just south of town, and the Broadway Dock about a 5-minute walk from Main Street.", src: "https://www.celebritycruises.com/ports/skagway" },
      { icon: "🚂", text: "The White Pass & Yukon Route Railroad (built 1898) leaves from town.", src: "https://www.celebritycruises.com/ports/skagway" },
      { icon: "🚌", text: "The SMART bus runs shuttles when ships are in; NO rideshare and only a couple of taxi companies — plan your way back.", src: "https://www.celebritycruises.com/ports/skagway" },
      { icon: "💲", text: "U.S. dollar; ATM at Wells Fargo, 6th and Broadway; tips around 10%.", src: "https://www.celebritycruises.com/ports/skagway" },
    ] },
  sitka: { name: "Sitka", country: "Alaska, USA", flag: "🇺🇸", verified: "2026-10-05", keys: ["sitka"], advisory: null,
    sources: { "Celebrity Cruises port guide": "https://www.celebritycruises.com/ports/sitka" },
    facts: [
      { icon: "📍", text: "Ships dock at Sitka Sound Cruise Terminal (Halibut Point), about 5 miles north of town.", src: "https://www.celebritycruises.com/ports/sitka" },
      { icon: "🚌", text: "A free shuttle runs to downtown (Harrigan Centennial Hall, with visitor information).", src: "https://www.celebritycruises.com/ports/sitka" },
      { icon: "🚤", text: "On busy days ships may anchor off Crescent Harbor and TENDER guests ashore — check your ship's plan.", src: "https://www.celebritycruises.com/ports/sitka" },
      { icon: "💲", text: "U.S. dollar.", src: "https://www.celebritycruises.com/ports/sitka" },
    ] },
  victoria: { name: "Victoria", country: "Canada", flag: "🇨🇦", verified: "2026-10-05", keys: ["victoria"],
    advisory: SG_DOS + "traveladvisories.html",
    sources: { "Celebrity Cruises port guide": "https://www.celebritycruises.com/ports/victoria-british-columbia" },
    facts: [
      { icon: "🛳️", text: "Ships dock at Ogden Point; a shuttle runs to downtown.", src: "https://www.celebritycruises.com/ports/victoria-british-columbia" },
      { icon: "💳", text: "Canadian dollar; credit and debit cards are accepted almost everywhere.", src: "https://www.celebritycruises.com/ports/victoria-british-columbia" },
      { icon: "🚲", text: "Taxis are available, and lots of people rent bikes — there are plenty of bike trails.", src: "https://www.celebritycruises.com/ports/victoria-british-columbia" },
    ] },
  cococay: { name: "Perfect Day at CocoCay", country: "The Bahamas", flag: "🇧🇸", verified: "2026-10-05", keys: ["cococay", "coco cay", "perfect day"],
    advisory: SG_DOS + "bahamas-travel-advisory.html",
    sources: { "Royal Caribbean: walking times": "https://www.royalcaribbean.com/faq/questions/how-long-does-it-take-to-walk-to-each-part-of-perfect-day-at-cococay", "Royal Caribbean: free things to do": "https://www.royalcaribbean.com/guides/free-things-to-do-at-perfect-day-at-cococay" },
    facts: [
      { icon: "🛳️", text: "Ships dock at a pier — about a 6-minute walk to Arrivals Plaza, or ride the free Pier Tram.", src: "https://www.royalcaribbean.com/faq/questions/how-long-does-it-take-to-walk-to-each-part-of-perfect-day-at-cococay" },
      { icon: "🏖️", text: "FREE: Chill Island, South Beach, Harbor Beach, Breezy Bay and the Oasis Lagoon pool; chairs, umbrellas, hammocks and lockers.", src: "https://www.royalcaribbean.com/guides/free-things-to-do-at-perfect-day-at-cococay" },
      { icon: "🍔", text: "FREE food at Snack Shack, Chill Grill and Skipper's Grill; water and basic juices.", src: "https://www.royalcaribbean.com/guides/free-things-to-do-at-perfect-day-at-cococay" },
      { icon: "💲", text: "EXTRA: Thrill Waterpark, Coco Beach Club, cabanas, the Up, Up & Away balloon, zip line, jet skis — book early, they sell out.", src: "https://www.royalcaribbean.com/guides/free-things-to-do-at-perfect-day-at-cococay" },
      { icon: "👟", text: "Bring reef-safe sunscreen, water shoes and a waterproof phone pouch; towels come from the ship.", src: "https://www.royalcaribbean.com/guides/free-things-to-do-at-perfect-day-at-cococay" },
    ] },
  "amber cove": { name: "Amber Cove", country: "Dominican Republic", flag: "🇩🇴", verified: "2026-10-05", keys: ["amber cove", "puerto plata"],
    advisory: SG_DOS + "traveladvisories.html",
    sources: { "Carnival: 10 things to know about Amber Cove": "https://www.carnival.com/awaywego/cruising-fun/what-to-expect/the-top-10-things-you-need-to-know-about-amber-cove" },
    facts: [
      { icon: "🏊", text: "FREE: the Aqua Zone pool — swim-up bar, waterslides and a lazy river.", src: "https://www.carnival.com/awaywego/cruising-fun/what-to-expect/the-top-10-things-you-need-to-know-about-amber-cove" },
      { icon: "💲", text: "EXTRA: cabanas (up to 20 people), dolphin swims, zip lines, ATVs and helicopter tours.", src: "https://www.carnival.com/awaywego/cruising-fun/what-to-expect/the-top-10-things-you-need-to-know-about-amber-cove" },
      { icon: "🚕", text: "The port's transportation hub has taxis and rental cars; Puerto Plata is a short distance away.", src: "https://www.carnival.com/awaywego/cruising-fun/what-to-expect/the-top-10-things-you-need-to-know-about-amber-cove" },
      { icon: "🛍️", text: "Shops and market stalls in port — Dominican rum, coffee, chocolate and amber.", src: "https://www.carnival.com/awaywego/cruising-fun/what-to-expect/the-top-10-things-you-need-to-know-about-amber-cove" },
    ] },
  bermuda: { name: "Bermuda (Royal Naval Dockyard)", country: "Bermuda", flag: "🇧🇲", verified: "2026-10-05", keys: ["bermuda", "kings wharf", "king's wharf", "royal naval dockyard", "heritage wharf"],
    advisory: SG_DOS + "traveladvisories.html",
    sources: { "Celebrity Cruises port guide": "https://www.celebritycruises.com/ports/royal-naval-dockyard" },
    facts: [
      { icon: "🛳️", text: "Ships dock at the Royal Naval Dockyard, at the west end of the island.", src: "https://www.celebritycruises.com/ports/royal-naval-dockyard" },
      { icon: "⛴️", text: "Right off the ship: taxis, scooter and bike rental, a free shuttle 'train', ferry docks, visitor information, shops and restaurants.", src: "https://www.celebritycruises.com/ports/royal-naval-dockyard" },
      { icon: "🚌", text: "Shared minibuses, taxis, local buses and ferries run to Hamilton (the capital) and St. George's — all clearly signposted.", src: "https://www.celebritycruises.com/ports/royal-naval-dockyard" },
      { icon: "💵", text: "The Bermuda dollar equals the U.S. dollar, and U.S. dollars are accepted almost everywhere.", src: "https://www.celebritycruises.com/ports/royal-naval-dockyard" },
      { icon: "💲", text: "Restaurants often add 15–17% to the bill already — check before you tip. Taxis up to 15%, guides 10%.", src: "https://www.celebritycruises.com/ports/royal-naval-dockyard" },
    ] },
  "half moon cay": { name: "RelaxAway, Half Moon Cay", country: "The Bahamas", flag: "🇧🇸", verified: "2026-10-05", keys: ["half moon cay", "relaxaway", "little san salvador"],
    advisory: SG_DOS + "bahamas-travel-advisory.html",
    sources: { "Carnival: RelaxAway, Half Moon Cay": "https://www.carnival.com/cruise-to/bahamas-cruises/relaxaway-half-moon-cay-cruises" },
    facts: [
      { icon: "🚤", text: "You arrive by pier or water shuttle — if your ship uses the water shuttle, allow extra time getting back.", src: "https://www.carnival.com/cruise-to/bahamas-cruises/relaxaway-half-moon-cay-cruises" },
      { icon: "🍔", text: "Complimentary lunch spots, plus island bars.", src: "https://www.carnival.com/cruise-to/bahamas-cruises/relaxaway-half-moon-cay-cruises" },
      { icon: "💲", text: "EXTRA: daybeds, cabanas and villas, horseback riding, stingrays, Aqua Trax and boat snorkeling.", src: "https://www.carnival.com/cruise-to/bahamas-cruises/relaxaway-half-moon-cay-cruises" },
    ] },
};
const portGuide = name => { const n = String(name || "").toLowerCase(); return Object.values(PORT_GUIDES).find(g => g.keys.some(k => n.includes(k))) || null; };
function portGuideHtml(pt) {
  const G = pt && portGuide(pt.name); if (!G) return "";
  return `<div class="day-label" style="margin-top:10px">${G.flag} Good to know in ${esc(G.name)}</div>
    ${G.facts.map(f => `<div class="today-line">${f.icon} ${esc(f.text)}</div>`).join("")}
    ${G.advisory ? `<a class="btn sm ghost" style="margin-top:6px" href="${G.advisory}" target="_blank" rel="noopener">🛡️ Current U.S. travel advisory${G.advisory.endsWith("traveladvisories.html") ? ` — find ${esc(G.country)}` : ` — ${esc(G.country)}`}</a>` : `<div class="today-line sub">🇺🇸 U.S. territory — no foreign travel advisory.</div>`}
    <p class="fine" style="margin-top:6px">From ${Object.entries(G.sources).map(([n, u]) => `<a href="${u}" target="_blank" rel="noopener">${esc(n)}</a>`).join(" · ")} — checked ${prettyDate(G.verified)}, ${G.verified.slice(0, 4)}. The ship's port information wins if it differs.</p>`;
}
