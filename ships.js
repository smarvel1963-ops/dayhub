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
  "emerald princess": {
    name: "Emerald Princess", line: "Princess", verified: "2026-10-05",
    sources: {
      ship: "https://www.princess.com/ships-and-experience/ships/ep-emerald-princess",
      decks: "https://gb-www.princess.com/html/global/book/ships/deck-plans/ep-accessible-route-text.html",
    },
    facts: { guests: 3080, crew: 1200, tonnage: 113561, lengthFt: 951, decks: 19, built: 2007 },
    venues: [
      // ---- eat (princess.com "Included" / specialty)
      { cat: "eat", name: "Michelangelo Dining Room", deck: "5", cost: "included", note: "Main dining room" },
      { cat: "eat", name: "Da Vinci Dining Room", deck: "6", cost: "included", note: "Main dining room" },
      { cat: "eat", name: "Botticelli Dining Room", deck: "6", cost: "included", note: "Main dining room" },
      { cat: "eat", name: "International Café", deck: "5", cost: "included", note: "Open 24 hours a day" },
      { cat: "eat", name: "World Fresh Marketplace", deck: "15", cost: "included", note: "Buffet" },
      { cat: "eat", name: "Slice Pizzeria", deck: "15", cost: "included" },
      { cat: "eat", name: "Salty Dog Grill", deck: "15", cost: "included", note: "Gourmet burgers" },
      { cat: "eat", name: "Coffee & Cones", deck: "15", cost: "included", note: "Complimentary ice cream + espresso drinks" },
      { cat: "eat", name: "Afternoon Tea", deck: null, cost: "included" },
      { cat: "eat", name: "Crown Grill", deck: "7", cost: "extra", note: "Premium steakhouse" },
      { cat: "eat", name: "Sabatini's Italian Trattoria", deck: "16", cost: "extra" },
      { cat: "eat", name: "O'Malley's Irish Pub", deck: null, cost: "extra", note: "Irish fare" },
      { cat: "eat", name: "Steamers Seafood", deck: "15", cost: "extra", note: "Pop-up venue" },
      { cat: "eat", name: "Planks BBQ", deck: "15", cost: "extra", note: "Pop-up venue" },
      { cat: "eat", name: "Chef's Table Experience", deck: null, cost: "extra", note: "Multi-course dinner hosted by the executive chef" },
      { cat: "eat", name: "Ultimate Balcony Dining", deck: null, cost: "extra", note: "On your balcony" },
      { cat: "eat", name: "Reserve Collection Dining", deck: null, cost: "extra", note: "Its own area, dedicated service" },
      { cat: "eat", name: "OceanNow® delivery", deck: null, cost: null, note: "Order to your cabin or the pool from your phone" },
      // ---- drink
      { cat: "drink", name: "Vines Wine Bar", deck: "5", cost: null, note: "Wine flights" },
      { cat: "drink", name: "Good Spirits® At Sea", deck: null, cost: null, note: "Cocktail experiences" },
      { cat: "drink", name: "Speakeasy Cigar Lounge", deck: "6", cost: null },
      { cat: "drink", name: "Casino Bar", deck: "6", cost: null },
      { cat: "drink", name: "Crooners", deck: "7", cost: null, note: "Sinatra-era piano bar" },
      { cat: "drink", name: "Wheelhouse Bar", deck: "7", cost: null },
      { cat: "drink", name: "Explorers Lounge", deck: "7", cost: null },
      { cat: "drink", name: "Club Fusion", deck: "7", cost: null, note: "Nightclub — karaoke, theme parties" },
      { cat: "drink", name: "Calypso Bar · Outrigger Bar", deck: "15", cost: null, note: "Pool bars" },
      { cat: "drink", name: "Tradewinds", deck: "16", cost: null },
      { cat: "drink", name: "Skywalkers Nightclub", deck: "18", cost: null, note: "15 decks above the sea" },
      // ---- shows & fun
      { cat: "fun", name: "Princess Theater", deck: "6 · 7", cost: null, note: "Original musicals and stage shows" },
      { cat: "fun", name: "Gatsby's Casino", deck: "6", cost: null },
      { cat: "fun", name: "The Piazza", deck: "5", cost: null, note: "Street performers, shops" },
      { cat: "fun", name: "Movies Under the Stars®", deck: "16", cost: null, note: "Poolside outdoor movies" },
      { cat: "fun", name: "Fine Arts Gallery", deck: "5", cost: null, note: "Art exhibits + auctions" },
      { cat: "fun", name: "Library", deck: "7", cost: null },
      { cat: "fun", name: "Princess Links", deck: "19", cost: null, note: "Putting course" },
      // ---- pools
      { cat: "pool", name: "Terrace Pool", deck: "14", cost: null },
      { cat: "pool", name: "Neptune's Reef & Pool", deck: "15", cost: null },
      { cat: "pool", name: "Calypso Reef & Pool", deck: "15", cost: null },
      // ---- spa & fitness
      { cat: "spa", name: "Lotus Spa®", deck: "15 · 16", cost: null },
      { cat: "spa", name: "Fitness Center", deck: "16", cost: null },
      { cat: "spa", name: "Beauty Salon", deck: "16", cost: null },
      { cat: "spa", name: "The Sanctuary", deck: "17", cost: null, note: "Adults-only retreat" },
      // ---- kids
      { cat: "kids", name: "Youth Centre · Teen Centre", deck: "17", cost: null, note: "Kids 3-7, 8-12 and teens 13-17" },
      // ---- services
      { cat: "service", name: "Guest Services", deck: "6", cost: null },
      { cat: "service", name: "Captain's Circle desk", deck: "6", cost: null },
      { cat: "service", name: "Shore Excursions", deck: "7", cost: null },
      { cat: "service", name: "Medical Center", deck: "4", cost: null },
      { cat: "service", name: "Future Cruise Sales", deck: "5", cost: null },
      { cat: "service", name: "The Shops of Princess", deck: "7", cost: null, note: "Promenade Galleria, Facets by Effy, Essence" },
      { cat: "service", name: "Photo Gallery", deck: "7", cost: null },
      { cat: "service", name: "Wedding Chapel", deck: "16", cost: null },
    ],
  },
  "royal princess": {
    name: "Royal Princess", line: "Princess", verified: "2026-10-06",
    sources: {
      ship: "https://www.princess.com/ships-and-experience/ships/rp-royal-princess",
      decks: "https://gb-www.princess.com/html/global/book/ships/deck-plans/rp-accessible-route-text.html",
    },
    facts: { guests: 3560, crew: 1346, tonnage: 142229, lengthFt: 1083, decks: 19, built: 2013 },
    venues: [
      // ---- eat (princess.com "Included" / specialty)
      { cat: "eat", name: "Symphony Dining Room", deck: "5", cost: "included", note: "Main dining room" },
      { cat: "eat", name: "Concerto Dining Room", deck: "6", cost: "included", note: "Main dining room" },
      { cat: "eat", name: "Allegro Dining Room", deck: "6", cost: "included", note: "Main dining room" },
      { cat: "eat", name: "International Café", deck: "5", cost: "included", note: "Open 24 hours — pastries, sandwiches, specialty coffee" },
      { cat: "eat", name: "World Fresh Marketplace", deck: "16", cost: "included", note: "Buffet (the deck plan still calls it Horizon Court)" },
      { cat: "eat", name: "Prego Pizzeria", deck: "16", cost: "included", note: "Pizza by the slice or whole pie" },
      { cat: "eat", name: "Trident Grill", deck: "16", cost: "included", note: "Poolside burgers + hot dogs" },
      { cat: "eat", name: "Swirls Ice Cream Bar", deck: "16", cost: "included" },
      { cat: "eat", name: "Afternoon Tea", deck: null, cost: "included" },
      { cat: "eat", name: "Crown Grill", deck: "7", cost: "extra", note: "Premium steakhouse" },
      { cat: "eat", name: "Sabatini's Italian Trattoria", deck: "5", cost: "extra" },
      { cat: "eat", name: "Alfredo's Pizzeria", deck: "6", cost: "extra", note: "Individual pizzas" },
      { cat: "eat", name: "Ocean Terrace Seafood Bar", deck: "7", cost: "extra", note: "Sushi, sashimi, sake" },
      { cat: "eat", name: "Gelato", deck: "5", cost: "extra" },
      { cat: "eat", name: "Chef's Table Lumiere", deck: "6", cost: "extra", note: "Multi-course dinner hosted by the executive chef" },
      { cat: "eat", name: "Crab Shack", deck: null, cost: "extra", note: "Pop-up seafood" },
      { cat: "eat", name: "Caymus Winemaker's Dinner", deck: null, cost: "extra", note: "Napa Valley wine pairing" },
      { cat: "eat", name: "Ultimate Balcony Dining", deck: null, cost: "extra", note: "Breakfast on your balcony" },
      { cat: "eat", name: "Reserve Collection Dining", deck: null, cost: "extra", note: "Its own dining area, faster seating" },
      { cat: "eat", name: "OceanNow® delivery", deck: null, cost: null, note: "Order to your cabin or the pool from your phone" },
      // ---- drink
      { cat: "drink", name: "Vines Wine Bar", deck: "5", cost: null },
      { cat: "drink", name: "Piazza Bar", deck: "5", cost: null },
      { cat: "drink", name: "Good Spirits® At Sea", deck: null, cost: null, note: "Cocktail experiences" },
      { cat: "drink", name: "Churchill's", deck: "6", cost: null, note: "Cigar lounge" },
      { cat: "drink", name: "Bellini's", deck: "6", cost: null },
      { cat: "drink", name: "Club 6", deck: "6", cost: null },
      { cat: "drink", name: "Crooners", deck: "7", cost: null, note: "Piano bar" },
      { cat: "drink", name: "Wheelhouse Bar", deck: "7", cost: null },
      { cat: "drink", name: "Vista Lounge", deck: "7", cost: null },
      { cat: "drink", name: "SeaView Bar · Outrigger", deck: "16", cost: null, note: "Pool bars" },
      // ---- shows & fun
      { cat: "fun", name: "Princess Theater", deck: "6 · 7", cost: null, note: "Original musicals, magic shows" },
      { cat: "fun", name: "Princess Live!", deck: "7", cost: null, note: "Cabaret, comedians, game shows" },
      { cat: "fun", name: "Princess Casino", deck: "6", cost: null },
      { cat: "fun", name: "The Piazza", deck: "5", cost: null },
      { cat: "fun", name: "Movies Under the Stars®", deck: "18", cost: null },
      { cat: "fun", name: "Princess Art Gallery", deck: "7", cost: null, note: "Art auctions" },
      { cat: "fun", name: "The Library", deck: "7", cost: null },
      { cat: "fun", name: "SeaWalk", deck: "16 · 17", cost: null },
      { cat: "fun", name: "Princess Sports Central · Laser Range · Driving Range", deck: "18", cost: null },
      { cat: "fun", name: "The Game Lounge", deck: "18", cost: null },
      // ---- pools
      { cat: "pool", name: "Fountain Pool", deck: "16", cost: null },
      { cat: "pool", name: "Retreat Pool & Bar", deck: "17", cost: null },
      // ---- spa & fitness
      { cat: "spa", name: "Lotus Spa®", deck: "5", cost: null },
      { cat: "spa", name: "The Enclave®", deck: "5", cost: null, note: "Thermal suite — hammam, caldarium, laconium" },
      { cat: "spa", name: "Beauty Salon", deck: "5", cost: null },
      { cat: "spa", name: "Fitness Center", deck: "17", cost: null, note: "Cycling, Pilates, yoga, TRX" },
      { cat: "spa", name: "The Sanctuary", deck: "17", cost: null, note: "Adults-only retreat" },
      // ---- kids
      { cat: "kids", name: "Youth Centre · Teen Lounge", deck: "17", cost: null, note: "Kids 3-7, 8-12 and teens 13-17" },
      // ---- services
      { cat: "service", name: "Guest Services", deck: "5", cost: null },
      { cat: "service", name: "Shore Excursions", deck: "5", cost: null },
      { cat: "service", name: "Medical Center", deck: "4", cost: null, note: "Tender boats also board on deck 4" },
      { cat: "service", name: "Captain's Circle · Future Cruise Centre", deck: "7", cost: null },
      { cat: "service", name: "The Shops of Princess", deck: "7", cost: null },
      { cat: "service", name: "Photo & Video Gallery", deck: "6", cost: null },
      { cat: "service", name: "Wedding Chapel", deck: "14", cost: null },
    ],
  },
  "ruby princess": {
    name: "Ruby Princess", line: "Princess", verified: "2026-10-06",
    sources: {
      ship: "https://www.princess.com/ships-and-experience/ships/ru-ruby-princess",
      decks: "https://gb-www.princess.com/html/global/book/ships/deck-plans/ru-accessible-route-text.html",
    },
    facts: { guests: 3080, crew: 1200, tonnage: 113561, lengthFt: 951, decks: 19, built: 2008 },
    venues: [
      // ---- eat (princess.com "Included" / specialty)
      { cat: "eat", name: "Michelangelo Dining Room", deck: "5", cost: "included", note: "Main dining room" },
      { cat: "eat", name: "Da Vinci Dining Room", deck: "6", cost: "included", note: "Main dining room" },
      { cat: "eat", name: "Botticelli Dining Room", deck: "6", cost: "included", note: "Main dining room" },
      { cat: "eat", name: "International Café", deck: "5", cost: "included", note: "Open 24 hours a day" },
      { cat: "eat", name: "World Fresh Marketplace", deck: "15", cost: "included", note: "Buffet (the deck plan still calls it Horizon Court)" },
      { cat: "eat", name: "Slice Pizzeria", deck: "15", cost: "included" },
      { cat: "eat", name: "The Salty Dog Grill", deck: "15", cost: "included", note: "Gourmet burgers" },
      { cat: "eat", name: "Coffee & Cones", deck: "15", cost: "included", note: "Ice cream + espresso drinks" },
      { cat: "eat", name: "Afternoon Tea", deck: null, cost: "included" },
      { cat: "eat", name: "Crown Grill", deck: "7", cost: "extra", note: "Premium steakhouse" },
      { cat: "eat", name: "Sabatini's Italian Trattoria", deck: "16", cost: "extra" },
      { cat: "eat", name: "The Salty Dog Gastropub", deck: "7", cost: "extra", note: "Pub fare + craft drinks" },
      { cat: "eat", name: "Chef's Table", deck: null, cost: "extra", note: "Multi-course dinner hosted by the executive chef" },
      { cat: "eat", name: "Crab Shack", deck: null, cost: "extra", note: "Pop-up seafood" },
      { cat: "eat", name: "Ultimate Balcony Dining", deck: null, cost: "extra", note: "On your balcony" },
      { cat: "eat", name: "OceanNow® delivery", deck: null, cost: "extra", note: "Food + drinks brought to you" },
      // ---- drink
      { cat: "drink", name: "Vines Wine Bar", deck: "5", cost: null, note: "Wine flights" },
      { cat: "drink", name: "Good Spirits® At Sea", deck: null, cost: null, note: "Cocktail experiences" },
      { cat: "drink", name: "Crooners", deck: "7", cost: null, note: "Piano bar" },
      { cat: "drink", name: "Wheelhouse Bar", deck: "7", cost: null },
      { cat: "drink", name: "Explorers Lounge", deck: "7", cost: null },
      { cat: "drink", name: "Club Fusion", deck: "7", cost: null, note: "Nightclub — karaoke, themed parties" },
      { cat: "drink", name: "Calypso Bar · Outriggers", deck: "15", cost: null, note: "Pool bars" },
      { cat: "drink", name: "Tradewinds Bar", deck: "16", cost: null },
      { cat: "drink", name: "Skywalkers Nightclub", deck: "18", cost: null, note: "15 decks above the sea" },
      // ---- shows & fun
      { cat: "fun", name: "Princess Theater", deck: "6 · 7", cost: null, note: "Original productions" },
      { cat: "fun", name: "Gatsby's Casino", deck: "6", cost: null },
      { cat: "fun", name: "The Piazza", deck: "5", cost: null, note: "Street performers" },
      { cat: "fun", name: "Movies Under the Stars®", deck: "16", cost: null, note: "Poolside movies" },
      { cat: "fun", name: "Fine Arts Gallery", deck: "5", cost: null, note: "Art exhibits + auctions" },
      { cat: "fun", name: "Princess Links", deck: "19", cost: null, note: "Putting course" },
      // ---- pools
      { cat: "pool", name: "Neptune's Reef & Pool", deck: "15", cost: null },
      { cat: "pool", name: "Calypso Reef & Pool", deck: "15", cost: null },
      // ---- spa & fitness
      { cat: "spa", name: "Lotus Spa®", deck: "16", cost: null, note: "Thermal suite on deck 15" },
      { cat: "spa", name: "Fitness Center", deck: "16", cost: null, note: "Pilates, yoga, TRX, boot camp" },
      { cat: "spa", name: "Beauty Salon", deck: "16", cost: null },
      { cat: "spa", name: "The Sanctuary", deck: "17", cost: null, note: "Adults-only retreat" },
      // ---- kids
      { cat: "kids", name: "The Treehouse · The Lodge", deck: "17", cost: null, note: "Kids 3-7 and 8-12" },
      { cat: "kids", name: "The Beach House Teen Lounge", deck: "17", cost: null, note: "Teens 13-17" },
      // ---- services
      { cat: "service", name: "Guest Services", deck: "6", cost: null },
      { cat: "service", name: "Shore Excursions", deck: "7", cost: null },
      { cat: "service", name: "Medical Center", deck: "4", cost: null },
      { cat: "service", name: "Future Cruise & Loyalty", deck: "5 · 6", cost: null },
      { cat: "service", name: "The Shops of Princess", deck: "6 · 7", cost: null },
      { cat: "service", name: "Photo Gallery", deck: "7", cost: null },
      { cat: "service", name: "Wedding Chapel", deck: "16", cost: null },
    ],
  },
  "regal princess": {
    name: "Regal Princess", line: "Princess", verified: "2026-10-06",
    sources: {
      ship: "https://www.princess.com/ships-and-experience/ships/gp-regal-princess",
      decks: "https://gb-www.princess.com/html/global/book/ships/deck-plans/gp-accessible-route-text.html",
    },
    facts: { guests: 3560, crew: 1346, tonnage: 142229, lengthFt: 1083, decks: 19, built: 2014 },
    venues: [
      // ---- eat (princess.com "Included" / specialty); deck null = the deck page doesn't name it
      { cat: "eat", name: "Symphony Dining Room", deck: "5", cost: "included", note: "Main dining room" },
      { cat: "eat", name: "Concerto Dining Room", deck: "6", cost: "included", note: "Main dining room" },
      { cat: "eat", name: "Allegro Dining Room", deck: "6", cost: "included", note: "Main dining room" },
      { cat: "eat", name: "International Café", deck: "5", cost: "included", note: "Open 24 hours a day" },
      { cat: "eat", name: "World Fresh Marketplace", deck: "16", cost: "included", note: "Buffet" },
      { cat: "eat", name: "Prego Pizzeria", deck: null, cost: "included", note: "Pizza made to order" },
      { cat: "eat", name: "Trident Grill", deck: null, cost: "included", note: "Poolside burgers, hot dogs, evening BBQ" },
      { cat: "eat", name: "Swirls Ice Cream Bar", deck: null, cost: "included" },
      { cat: "eat", name: "Afternoon Tea", deck: null, cost: "included" },
      { cat: "eat", name: "Crown Grill", deck: "7", cost: "extra", note: "Premium steakhouse" },
      { cat: "eat", name: "Sabatini's Italian Trattoria", deck: "5", cost: "extra" },
      { cat: "eat", name: "Alfredo's Pizzeria", deck: "6", cost: "extra", note: "Individual pizzas, sit-down" },
      { cat: "eat", name: "Ocean Terrace Seafood Bar", deck: "7", cost: "extra", note: "Sushi, sashimi, chilled seafood" },
      { cat: "eat", name: "Gelato", deck: "5", cost: "extra" },
      { cat: "eat", name: "Chef's Table Lumiere", deck: "6", cost: "extra", note: "Tasting menu hosted by the executive chef" },
      { cat: "eat", name: "Crab Shack", deck: null, cost: "extra", note: "Pop-up seafood" },
      { cat: "eat", name: "Caymus Winemaker's Dinner", deck: null, cost: "extra", note: "Wine-pairing dinner" },
      { cat: "eat", name: "Ultimate Balcony Dining", deck: null, cost: "extra", note: "Breakfast on your balcony" },
      { cat: "eat", name: "Reserve Collection Dining", deck: null, cost: "extra", note: "Its own area, dedicated service" },
      { cat: "eat", name: "OceanNow® delivery", deck: null, cost: "extra", note: "Order in the app, brought to you" },
      // ---- drink
      { cat: "drink", name: "Vines Wine Bar", deck: "5", cost: null },
      { cat: "drink", name: "Piazza Bar", deck: "5", cost: null },
      { cat: "drink", name: "Good Spirits® At Sea", deck: null, cost: null, note: "Cocktail experiences" },
      { cat: "drink", name: "Churchill's", deck: "6", cost: null, note: "Cigar lounge" },
      { cat: "drink", name: "Bellini's", deck: "6", cost: null, note: "Specialty cocktails" },
      { cat: "drink", name: "Club 6", deck: "6", cost: null },
      { cat: "drink", name: "Crooners", deck: "7", cost: null, note: "Sinatra-era piano bar" },
      { cat: "drink", name: "Wheelhouse Bar", deck: "7", cost: null },
      { cat: "drink", name: "Vista Lounge", deck: "7", cost: null },
      { cat: "drink", name: "Fountain Pool Bar · SeaView Bar · Wake View Bar", deck: "16", cost: null },
      // ---- shows & fun
      { cat: "fun", name: "Princess Theater", deck: "6 · 7", cost: null, note: "Original productions" },
      { cat: "fun", name: "Princess Live!", deck: "7", cost: null, note: "Cabaret, comedy, concerts, game shows" },
      { cat: "fun", name: "Princess Casino", deck: "6", cost: null },
      { cat: "fun", name: "The Piazza", deck: "5", cost: null, note: "Street performers, spiral staircase" },
      { cat: "fun", name: "Movies Under the Stars®", deck: "18", cost: null },
      { cat: "fun", name: "Princess Art Gallery", deck: "7", cost: null, note: "Art + champagne auctions" },
      { cat: "fun", name: "The Library", deck: "7", cost: null },
      { cat: "fun", name: "SeaWalk", deck: "16", cost: null },
      { cat: "fun", name: "Princess Sports Central · Laser Range · Driving Range", deck: "18", cost: null },
      { cat: "fun", name: "The Game Lounge", deck: "18", cost: null },
      // ---- pools
      { cat: "pool", name: "Fountain Pool", deck: "16", cost: null },
      { cat: "pool", name: "Terrace Pool", deck: "17", cost: null },
      { cat: "pool", name: "Retreat Pool & Bar", deck: "17", cost: null },
      // ---- spa & fitness
      { cat: "spa", name: "Lotus Spa®", deck: "5", cost: null },
      { cat: "spa", name: "The Enclave®", deck: "5", cost: null, note: "Thermal suite — hammam, caldarium, hydro-therapy pool" },
      { cat: "spa", name: "Beauty Salon", deck: "5", cost: null },
      { cat: "spa", name: "Fitness Center", deck: "17", cost: null, note: "Cycling, Pilates, yoga, TRX" },
      { cat: "spa", name: "The Sanctuary", deck: "17", cost: null, note: "Adults-only retreat" },
      // ---- kids
      { cat: "kids", name: "Youth Center", deck: "17", cost: null, note: "Kids 3-7 and 8-12" },
      { cat: "kids", name: "Beach House Teen Lounge", deck: "17", cost: null, note: "Teens 13-17" },
      // ---- services
      { cat: "service", name: "Guest Services", deck: "5", cost: null },
      { cat: "service", name: "Shore Excursions", deck: "5", cost: null },
      { cat: "service", name: "Medical Center", deck: "4", cost: null, note: "Tender boats also board on deck 4" },
      { cat: "service", name: "Captain's Circle · Future Cruise Center", deck: "7", cost: null },
      { cat: "service", name: "The Shops of Princess", deck: "7", cost: null, note: "Essence, Facets, Meridian Bay, Calypso Cove" },
      { cat: "service", name: "Photo & Video Gallery", deck: "6", cost: null },
      { cat: "service", name: "Wedding Chapel", deck: "14", cost: null },
    ],
  },
  "majestic princess": {
    name: "Majestic Princess", line: "Princess", verified: "2026-10-06",
    sources: {
      ship: "https://www.princess.com/ships-and-experience/ships/mj-majestic-princess",
      decks: "https://gb-www.princess.com/html/global/book/ships/deck-plans/mj-accessible-route-text.html",
    },
    facts: { guests: 3560, crew: 1346, tonnage: 143700, lengthFt: 1083, decks: 19, built: 2017 },
    // The deck page still lists the ship's China-market venues (Harmony, Bistro Sur La Mer, Gong Cha) that the
    // ship page no longer names - so a deck is shown ONLY when both pages name the venue; the rest stay null.
    venues: [
      // ---- eat (princess.com "Included" / specialty); deck null = the deck page doesn't name it
      { cat: "eat", name: "Symphony Dining Room", deck: "5", cost: "included", note: "Main dining room" },
      { cat: "eat", name: "Concerto Dining Room", deck: "6", cost: "included", note: "Main dining room" },
      { cat: "eat", name: "Allegro Dining Room", deck: "6", cost: "included", note: "Main dining room" },
      { cat: "eat", name: "International Café", deck: "5", cost: "included" },
      { cat: "eat", name: "World Fresh Marketplace", deck: "16", cost: "included", note: "Buffet" },
      { cat: "eat", name: "Alfredo's Slice", deck: null, cost: "included" },
      { cat: "eat", name: "Salty Dog Cafe", deck: null, cost: "included" },
      { cat: "eat", name: "Swirls Ice Cream Bar", deck: null, cost: "included" },
      { cat: "eat", name: "Afternoon Tea", deck: null, cost: "included" },
      { cat: "eat", name: "Reserve Collection Dining", deck: null, cost: "included" },
      { cat: "eat", name: "OceanNow® delivery", deck: null, cost: "included", note: "Order in the app, brought to you" },
      { cat: "eat", name: "Crown Grill", deck: "7", cost: "extra", note: "Premium steakhouse" },
      { cat: "eat", name: "Sabatini's Italian Trattoria", deck: null, cost: "extra" },
      { cat: "eat", name: "Alfredo's Pizzeria", deck: "6", cost: "extra", note: "Individual pizzas, sit-down" },
      { cat: "eat", name: "Chef's Table Lumiere", deck: "6", cost: "extra", note: "Tasting menu hosted by the executive chef" },
      { cat: "eat", name: "O'Malley's Irish Pub", deck: null, cost: "extra" },
      { cat: "eat", name: "Crab Shack", deck: null, cost: "extra", note: "Pop-up seafood" },
      { cat: "eat", name: "Caymus Winemaker's Dinner", deck: null, cost: "extra", note: "Wine-pairing dinner" },
      { cat: "eat", name: "Ultimate Balcony Dining", deck: null, cost: "extra", note: "On your balcony" },
      // ---- drink
      { cat: "drink", name: "Vines Wine Bar", deck: "5", cost: null },
      { cat: "drink", name: "Crooners", deck: null, cost: null, note: "At The Piazza" },
      { cat: "drink", name: "Bellini's", deck: "6", cost: null, note: "Specialty cocktails" },
      { cat: "drink", name: "Crown Grill Bar", deck: "7", cost: null },
      { cat: "drink", name: "Good Spirits® At Sea", deck: null, cost: null, note: "Cocktail experiences" },
      { cat: "drink", name: "Fountain Pool Bar · SeaView Bar · Wake View Bar", deck: "16", cost: null },
      // ---- shows & fun
      { cat: "fun", name: "Princess Theater", deck: "6 · 7", cost: null, note: "Original productions" },
      { cat: "fun", name: "Princess Live!", deck: "7", cost: null },
      { cat: "fun", name: "Casino", deck: "6", cost: null, note: "Vegas-style" },
      { cat: "fun", name: "The Piazza", deck: "5", cost: null },
      { cat: "fun", name: "Movies Under the Stars®", deck: "18", cost: null },
      { cat: "fun", name: "Fine Arts Gallery", deck: "6", cost: null },
      { cat: "fun", name: "Library", deck: "7", cost: null },
      { cat: "fun", name: "SeaWalk", deck: "16", cost: null },
      { cat: "fun", name: "Princess Sports Central · Laser Range", deck: "18", cost: null },
      { cat: "fun", name: "Driving Range", deck: "17", cost: null },
      // ---- pools
      { cat: "pool", name: "Fountain Pool", deck: "16", cost: null },
      { cat: "pool", name: "Hollywood Pool Club", deck: "17", cost: null, note: "Covered pool" },
      // ---- spa & fitness
      { cat: "spa", name: "Lotus Spa®", deck: "5", cost: null },
      { cat: "spa", name: "The Enclave®", deck: "5", cost: null, note: "Thermal suite at Lotus Spa" },
      { cat: "spa", name: "Beauty Salon", deck: "5", cost: null },
      { cat: "spa", name: "Fitness Center", deck: "17", cost: null },
      // ---- kids
      { cat: "kids", name: "Youth Center", deck: "17", cost: null, note: "Kids 3-7 and 8-12" },
      { cat: "kids", name: "Beach House Teen Lounge", deck: "17", cost: null, note: "Teens 13-17" },
      // ---- services
      { cat: "service", name: "Guest Services", deck: "5", cost: null },
      { cat: "service", name: "Shore Excursions", deck: "5", cost: null },
      { cat: "service", name: "Medical Center", deck: "4", cost: null },
      { cat: "service", name: "The Shops of Princess", deck: "5 · 7", cost: null },
      { cat: "service", name: "Photo & Video Gallery", deck: "6", cost: null },
    ],
  },
  "sky princess": {
    name: "Sky Princess", line: "Princess", verified: "2026-10-06",
    sources: {
      ship: "https://www.princess.com/ships-and-experience/ships/yp-sky-princess",
      decks: "https://gb-www.princess.com/html/global/book/ships/deck-plans/yp-accessible-route-text.html",
    },
    facts: { guests: 3660, crew: 1346, tonnage: 141000, lengthFt: 1083, decks: 19, built: 2019 },
    // Same rule as Majestic: a deck shows only when both pages name the venue (the deck page's Bistro Sur La Mer
    // is not on the ship page, so it is left out; the deck page names the dining rooms only as "Dining Room").
    venues: [
      // ---- eat (princess.com "Included" / specialty); deck null = the deck page doesn't name it
      { cat: "eat", name: "Main Dining Room", deck: "5 · 6", cost: "included" },
      { cat: "eat", name: "International Café", deck: "5", cost: "included", note: "Open 24 hours a day" },
      { cat: "eat", name: "World Fresh Marketplace", deck: "16", cost: "included", note: "Buffet" },
      { cat: "eat", name: "Slice Pizzeria", deck: null, cost: "included" },
      { cat: "eat", name: "The Salty Dog Grill", deck: null, cost: "included" },
      { cat: "eat", name: "Swirls Ice Cream Bar", deck: "16", cost: "included" },
      { cat: "eat", name: "Afternoon Tea", deck: null, cost: "included" },
      { cat: "eat", name: "Crown Grill", deck: "7", cost: "extra", note: "Premium steakhouse" },
      { cat: "eat", name: "Sabatini's Italian Trattoria", deck: "5", cost: "extra" },
      { cat: "eat", name: "The Catch by Rudi", deck: null, cost: "extra", note: "Seafood" },
      { cat: "eat", name: "Alfredo's Pizzeria", deck: "7", cost: "extra", note: "Individual pizzas, sit-down" },
      { cat: "eat", name: "Ocean Terrace Seafood Bar", deck: "7", cost: "extra" },
      { cat: "eat", name: "Gelato", deck: "5", cost: "extra" },
      { cat: "eat", name: "Chef's Table Lumiere", deck: "6", cost: "extra", note: "Tasting menu hosted by the executive chef" },
      { cat: "eat", name: "Crab Shack", deck: null, cost: "extra", note: "Pop-up seafood" },
      { cat: "eat", name: "Caymus Winemaker's Dinner", deck: null, cost: "extra", note: "Wine-pairing dinner" },
      { cat: "eat", name: "Ultimate Balcony Dining", deck: null, cost: "extra", note: "On your balcony" },
      // ---- drink
      { cat: "drink", name: "Vines Wine Bar", deck: "5", cost: null },
      { cat: "drink", name: "Bellini's", deck: "6", cost: null },
      { cat: "drink", name: "Crown Grill Bar", deck: "7", cost: null },
      { cat: "drink", name: "Good Spirits® At Sea", deck: null, cost: null, note: "Cocktail experiences" },
      { cat: "drink", name: "SeaView Pool Bar · Wake View Bar", deck: "16", cost: null },
      // ---- shows & fun
      { cat: "fun", name: "Princess Theater", deck: "6 · 7", cost: null, note: "Musicals and shows" },
      { cat: "fun", name: "Princess Live!", deck: "7", cost: null },
      { cat: "fun", name: "Casino", deck: "6", cost: null, note: "Vegas-style" },
      { cat: "fun", name: "The Piazza", deck: "5", cost: null },
      { cat: "fun", name: "Movies Under the Stars®", deck: "18", cost: null },
      { cat: "fun", name: "Fine Arts Gallery", deck: "6", cost: null },
      { cat: "fun", name: "Princess Sports Central", deck: "18", cost: null },
      // ---- pools
      { cat: "pool", name: "Pool", deck: "16", cost: null },
      { cat: "pool", name: "The Retreat Pool", deck: "17", cost: null },
      // ---- spa & fitness
      { cat: "spa", name: "Lotus Spa®", deck: "5", cost: null },
      { cat: "spa", name: "The Enclave®", deck: "5", cost: null, note: "Thermal suite" },
      { cat: "spa", name: "Beauty Salon", deck: "5", cost: null },
      { cat: "spa", name: "Fitness Center", deck: "17", cost: null },
      { cat: "spa", name: "The Sanctuary", deck: null, cost: null, note: "Adults-only retreat" },
      // ---- kids
      { cat: "kids", name: "Youth Center", deck: "17", cost: null, note: "Kids 3-7 and 8-12" },
      { cat: "kids", name: "Teen Center", deck: "17", cost: null, note: "Teens 13-17" },
      // ---- services
      { cat: "service", name: "Guest Services", deck: "5", cost: null },
      { cat: "service", name: "Shore Excursions", deck: "5", cost: null },
      { cat: "service", name: "Medical Center", deck: "4", cost: null },
      { cat: "service", name: "Captain's Circle", deck: "6", cost: null },
      { cat: "service", name: "The Shops of Princess", deck: "5 · 6 · 7", cost: null },
      { cat: "service", name: "Photo & Video Gallery", deck: "6", cost: null },
    ],
  },
  "enchanted princess": {
    name: "Enchanted Princess", line: "Princess", verified: "2026-10-06",
    sources: {
      ship: "https://www.princess.com/ships-and-experience/ships/ex-enchanted-princess",
      decks: "https://gb-www.princess.com/html/global/book/ships/deck-plans/ex-accessible-route-text.html",
    },
    facts: { guests: 3660, crew: 1346, tonnage: 145000, lengthFt: 1083, decks: 19, built: 2021 },
    // built = inaugural cruise (Nov 10, 2021) - the ship page gives no build year. Same deck rule as Majestic:
    // a deck shows only when both pages name the venue. Gigi's Pizzeria by Alfredo has no deck: the deck page
    // still says "Alfredo's Pizzeria", and Bistro Sur La Mer / French Bistro / Salty Dog Gastropub are left out.
    venues: [
      // ---- eat (princess.com "Included" / specialty); deck null = the deck page doesn't name it
      { cat: "eat", name: "Soleil Dining Room", deck: "5", cost: "included", note: "Main dining room" },
      { cat: "eat", name: "Estrella Dining Room", deck: "6", cost: "included", note: "Main dining room" },
      { cat: "eat", name: "Cielo Dining Room", deck: "6", cost: "included", note: "Main dining room" },
      { cat: "eat", name: "International Café", deck: "5", cost: "included", note: "Open 24 hours a day" },
      { cat: "eat", name: "World Fresh Marketplace", deck: "16", cost: "included", note: "Buffet" },
      { cat: "eat", name: "Slice Pizzeria", deck: null, cost: "included", note: "Neapolitan-style pizza" },
      { cat: "eat", name: "The Salty Dog Grill", deck: null, cost: "included", note: "Handmade burgers" },
      { cat: "eat", name: "Swirls Ice Cream Bar", deck: "16", cost: "included" },
      { cat: "eat", name: "Afternoon Tea", deck: null, cost: "included" },
      { cat: "eat", name: "Crown Grill", deck: "7", cost: "extra", note: "Steakhouse" },
      { cat: "eat", name: "Sabatini's Italian Trattoria", deck: "5", cost: "extra" },
      { cat: "eat", name: "The Catch by Rudi", deck: null, cost: "extra", note: "Seafood with raw bar" },
      { cat: "eat", name: "360: An Extraordinary Experience", deck: "5", cost: "extra", note: "Seven-course Mediterranean dinner" },
      { cat: "eat", name: "Gigi's Pizzeria by Alfredo", deck: null, cost: "extra", note: "Neapolitan pizza" },
      { cat: "eat", name: "O'Malley's Irish Pub", deck: null, cost: "extra" },
      { cat: "eat", name: "Gelateria", deck: "5", cost: "extra" },
      { cat: "eat", name: "Chef's Table Lumiere", deck: "6", cost: "extra", note: "Hosted by the executive chef" },
      { cat: "eat", name: "Crab Shack", deck: null, cost: "extra", note: "Pop-up: chowder, shrimp, steamer pots" },
      { cat: "eat", name: "Caymus Winemaker's Dinner", deck: null, cost: "extra", note: "Wine-pairing dinner" },
      { cat: "eat", name: "Ultimate Balcony Dining", deck: null, cost: "extra", note: "Breakfast on your balcony" },
      // ---- drink
      { cat: "drink", name: "Piazza Bar", deck: "5", cost: null },
      { cat: "drink", name: "Crooners", deck: "6", cost: null, note: "Sinatra-era piano bar" },
      { cat: "drink", name: "Bellini's", deck: null, cost: null, note: "Italian-themed, Piazza views" },
      { cat: "drink", name: "Crown Grill Bar", deck: "7", cost: null },
      { cat: "drink", name: "Good Spirits® At Sea", deck: null, cost: null, note: "Cocktail experiences" },
      { cat: "drink", name: "SeaView Pool Bar · Wake View Bar", deck: "16", cost: null },
      // ---- shows & fun
      { cat: "fun", name: "Princess Theater", deck: "6 · 7", cost: null, note: "Original productions" },
      { cat: "fun", name: "Princess Live!", deck: "7", cost: null, note: "Cabaret, comedy, concerts" },
      { cat: "fun", name: "Casino", deck: "6", cost: null, note: "Vegas-style" },
      { cat: "fun", name: "The Piazza", deck: "5", cost: null, note: "Street performers, shops" },
      { cat: "fun", name: "Movies Under the Stars®", deck: "18", cost: null },
      { cat: "fun", name: "Fine Art Gallery", deck: "6", cost: null, note: "Champagne art auctions" },
      { cat: "fun", name: "Princess Sports Central", deck: "18", cost: null },
      // ---- pools
      { cat: "pool", name: "Pool", deck: "16", cost: null },
      { cat: "pool", name: "The Retreat Pool & Bar", deck: "17", cost: null },
      // ---- spa & fitness
      { cat: "spa", name: "Lotus Spa®", deck: "5", cost: null },
      { cat: "spa", name: "The Enclave®", deck: "5", cost: null, note: "Thermal suite — hydro-therapy pool, hammam" },
      { cat: "spa", name: "Beauty Salon", deck: "5", cost: null },
      { cat: "spa", name: "Fitness Center", deck: "17", cost: null, note: "Cycling, Pilates, yoga, TRX" },
      { cat: "spa", name: "The Sanctuary", deck: null, cost: null, note: "Adults-only retreat" },
      // ---- kids
      { cat: "kids", name: "Youth Center", deck: "17", cost: null, note: "Kids 3-7 and 8-12" },
      { cat: "kids", name: "Teen Center", deck: "17", cost: null, note: "Teens 13-17" },
      // ---- services
      { cat: "service", name: "Guest Services", deck: "5", cost: null },
      { cat: "service", name: "Shore Excursions", deck: "5", cost: null },
      { cat: "service", name: "Medical Center", deck: "4", cost: null },
      { cat: "service", name: "Captain's Circle", deck: "6", cost: null },
      { cat: "service", name: "The Shops of Princess", deck: "5 · 7", cost: null },
      { cat: "service", name: "Photo & Video Gallery", deck: "6", cost: null },
    ],
  },
  "discovery princess": {
    name: "Discovery Princess", line: "Princess", verified: "2026-10-06",
    sources: {
      ship: "https://www.princess.com/ships-and-experience/ships/xp-discovery-princess",
      decks: "https://gb-www.princess.com/html/global/book/ships/deck-plans/xp-accessible-route-text.html",
    },
    facts: { guests: 3660, crew: 1346, tonnage: 145000, lengthFt: 1083, decks: 19, built: 2022 },
    // built = inaugural cruise (Mar 27, 2022) - the ship page gives no build year. Same deck rule as Majestic:
    // a deck shows only when both pages name the venue. Gigi's Pizzeria by Alfredo has no deck (the deck page
    // still says "Alfredo's Pizzeria"); the deck page's Salty Dog Gastropub / Take Five are not on the ship page.
    venues: [
      // ---- eat (princess.com "Included" / specialty); deck null = the deck page doesn't name it
      { cat: "eat", name: "Main Dining Room", deck: "5", cost: "included", note: "Traditional, flexible or walk-in" },
      { cat: "eat", name: "International Café", deck: "5", cost: "included", note: "Open 24 hours a day" },
      { cat: "eat", name: "World Fresh Marketplace", deck: "16", cost: "included", note: "Buffet" },
      { cat: "eat", name: "Slice Pizzeria", deck: null, cost: "included", note: "Neapolitan-style pizza" },
      { cat: "eat", name: "The Salty Dog Grill", deck: null, cost: "included", note: "Gourmet burgers" },
      { cat: "eat", name: "Swirls Ice Cream Bar", deck: "16", cost: "included" },
      { cat: "eat", name: "Afternoon Tea", deck: null, cost: "included" },
      { cat: "eat", name: "Crown Grill", deck: "7", cost: "extra", note: "Premium steakhouse" },
      { cat: "eat", name: "Sabatini's Italian Trattoria", deck: "5", cost: "extra" },
      { cat: "eat", name: "The Catch by Rudi", deck: null, cost: "extra", note: "Seafood" },
      { cat: "eat", name: "360: An Extraordinary Experience", deck: "5", cost: "extra", note: "Seven-course Mediterranean dinner" },
      { cat: "eat", name: "Gigi's Pizzeria by Alfredo", deck: null, cost: "extra", note: "Neapolitan pizza" },
      { cat: "eat", name: "O'Malley's Irish Pub", deck: null, cost: "extra" },
      { cat: "eat", name: "Gelato", deck: "5", cost: "extra" },
      { cat: "eat", name: "Chef's Table Lumiere", deck: "6", cost: "extra" },
      { cat: "eat", name: "Crab Shack", deck: null, cost: "extra", note: "Pop-up seafood" },
      { cat: "eat", name: "Caymus Winemaker's Dinner", deck: null, cost: "extra", note: "Wine-pairing dinner" },
      { cat: "eat", name: "Ultimate Balcony Dining", deck: null, cost: "extra", note: "On your balcony" },
      // ---- drink
      { cat: "drink", name: "Piazza Bar", deck: "5", cost: null },
      { cat: "drink", name: "Crooners", deck: "6", cost: null, note: "Sinatra-era martini bar" },
      { cat: "drink", name: "Churchill's", deck: "6", cost: null },
      { cat: "drink", name: "Bellini's", deck: "7", cost: null, note: "Italian-themed specialty cocktails" },
      { cat: "drink", name: "Vista Lounge", deck: "7", cost: null },
      { cat: "drink", name: "Good Spirits® At Sea", deck: null, cost: null, note: "Cocktail experiences" },
      { cat: "drink", name: "SeaView Pool Bar · Wake View Bar", deck: "16", cost: null },
      // ---- shows & fun
      { cat: "fun", name: "Princess Theater", deck: "6 · 7", cost: null },
      { cat: "fun", name: "Princess Live!", deck: "7", cost: null, note: "Daytime events, nighttime entertainment" },
      { cat: "fun", name: "Casino", deck: "6", cost: null, note: "Vegas-style" },
      { cat: "fun", name: "The Piazza", deck: "5", cost: null, note: "Performers, shops" },
      { cat: "fun", name: "Movies Under the Stars®", deck: "18", cost: null, note: "Outdoor amphitheater" },
      { cat: "fun", name: "Fine Art Gallery", deck: "6", cost: null, note: "Champagne art auctions" },
      { cat: "fun", name: "Princess Sports Central · Centre Court", deck: "18", cost: null },
      // ---- pools
      { cat: "pool", name: "Pool", deck: "16", cost: null },
      { cat: "pool", name: "The Retreat Pool & Bar", deck: "17", cost: null },
      // ---- spa & fitness
      { cat: "spa", name: "Lotus Spa®", deck: "5", cost: null },
      { cat: "spa", name: "The Enclave®", deck: "5", cost: null, note: "Thermal suite with hydro-therapy pool" },
      { cat: "spa", name: "Beauty Salon", deck: "5", cost: null },
      { cat: "spa", name: "Fitness Center", deck: "17", cost: null },
      { cat: "spa", name: "The Sanctuary", deck: null, cost: null, note: "Adults-only retreat" },
      // ---- kids
      { cat: "kids", name: "Children's Activity Center", deck: "17", cost: null, note: "Kids 3-7" },
      { cat: "kids", name: "Youth Activity Center", deck: "17", cost: null, note: "Kids 8-12" },
      { cat: "kids", name: "Teen Activity Center", deck: "17", cost: null, note: "Teens 13-17" },
      // ---- services
      { cat: "service", name: "Guest Services", deck: "5", cost: null },
      { cat: "service", name: "Shore Excursions", deck: "5", cost: null },
      { cat: "service", name: "Medical Center", deck: "4", cost: null },
      { cat: "service", name: "Captain's Circle", deck: "6", cost: null },
      { cat: "service", name: "The Shops of Princess", deck: "5 · 7", cost: null },
      { cat: "service", name: "Photo & Video Gallery", deck: "6", cost: null },
    ],
  },
  "sun princess": {
    name: "Sun Princess", line: "Princess", verified: "2026-10-06",
    sources: {
      ship: "https://www.princess.com/ships-and-experience/ships/su-sun-princess",
      decks: "https://www.princess.com/news/backgrounders-and-fact-sheets/sun-princess-fact-sheet",
    },
    // Sun Princess has no accessible-route deck page yet ("coming soon"), so the facts and the few deck numbers
    // come from princess.com's own fact sheet. built: null - neither page states a build or inaugural year
    // (the sheet's Oct. 14, 2024 is the Sanctuary Collection debut), so the guide shows no year.
    // Names follow the ship page where the two differ (Butcher's Block, not the sheet's Butcher's Table).
    facts: { guests: 4300, crew: 1600, tonnage: 177882, lengthFt: 1133, decks: 21, built: null },
    venues: [
      // ---- eat (ship page "Complimentary" / specialty); deck null = neither page names it
      { cat: "eat", name: "Soleil Dining Room", deck: "6", cost: "included", note: "Main dining room — traditional dining" },
      { cat: "eat", name: "Eclipse Dining Room", deck: "7", cost: "included", note: "Main dining room — anytime dining" },
      { cat: "eat", name: "Horizons Dining Room", deck: null, cost: "included", note: "Main dining room" },
      { cat: "eat", name: "The Eatery", deck: null, cost: "included" },
      { cat: "eat", name: "Americana Diner", deck: null, cost: "included" },
      { cat: "eat", name: "The Lido", deck: null, cost: "included", note: "Grill, ice cream, pizza, tacos, coffee bar" },
      { cat: "eat", name: "The Promenade", deck: null, cost: "included", note: "Grill, ice cream, pizza" },
      { cat: "eat", name: "Coffee & Cones", deck: null, cost: "included", note: "Top deck" },
      { cat: "eat", name: "International Café", deck: null, cost: "included" },
      { cat: "eat", name: "Crown Grill", deck: null, cost: "extra" },
      { cat: "eat", name: "Sabatini's Italian Trattoria", deck: null, cost: "extra" },
      { cat: "eat", name: "The Catch by Rudi", deck: null, cost: "extra" },
      { cat: "eat", name: "The Butcher's Block by Dario", deck: null, cost: "extra" },
      { cat: "eat", name: "Umai Teppanyaki", deck: null, cost: "extra", note: "Interactive, cooked in front of you" },
      { cat: "eat", name: "Umai Hot Pot", deck: null, cost: "extra" },
      { cat: "eat", name: "Makoto Ocean", deck: null, cost: "extra", note: "Edomae-style sushi" },
      { cat: "eat", name: "Love by Britto", deck: null, cost: "extra", note: "Dining with Romero Britto's art" },
      { cat: "eat", name: "Alfredo's Pizzeria", deck: null, cost: "extra" },
      { cat: "eat", name: "O'Malley's Irish Pub", deck: null, cost: "extra" },
      { cat: "eat", name: "Room service", deck: null, cost: null, note: "24 hours — delivery fee, or included with the Premier package" },
      // ---- drink
      { cat: "drink", name: "Spellbound by Magic Castle", deck: null, cost: null, note: "Magic + mixology" },
      { cat: "drink", name: "Crooners", deck: null, cost: null },
      { cat: "drink", name: "Bellini's Cocktail Bar", deck: null, cost: null },
      { cat: "drink", name: "Wheelhouse Bar", deck: null, cost: null },
      { cat: "drink", name: "Good Spirits® At Sea", deck: null, cost: null, note: "Rob Floyd mixology bar" },
      { cat: "drink", name: "The MIX · Sun Bar · Lido Bar · Sea View Bar · Cascade Bar", deck: null, cost: null },
      { cat: "drink", name: "Coffee Currents", deck: null, cost: null },
      // ---- shows & fun
      { cat: "fun", name: "Princess Arena", deck: null, cost: null, note: "Theater that changes shape for each production" },
      { cat: "fun", name: "The Dome", deck: null, cost: null, note: "Glass-enclosed, indoor/outdoor acrobatic shows" },
      { cat: "fun", name: "The Piazza", deck: null, cost: null, note: "Central hub" },
      { cat: "fun", name: "Princess Live!", deck: null, cost: null },
      { cat: "fun", name: "Princess Casino", deck: null, cost: null },
      { cat: "fun", name: "Movies Under the Stars®", deck: null, cost: null },
      // ---- pools
      { cat: "pool", name: "Lido Deck Pools (2)", deck: null, cost: null },
      { cat: "pool", name: "Dome Pool", deck: null, cost: null, note: "Indoor/outdoor" },
      { cat: "pool", name: "Wake View Pool", deck: null, cost: null, note: "Infinity pool on the Wake View Terrace" },
      { cat: "pool", name: "Sanctuary Pool", deck: null, cost: null, note: "Sanctuary Collection guests" },
      // ---- spa & fitness
      { cat: "spa", name: "Lotus Spa®", deck: null, cost: null, note: "Two stories" },
      { cat: "spa", name: "Lotus Salon", deck: null, cost: null },
      { cat: "spa", name: "Fitness Center · Fitness Studio · Wellness Studio", deck: null, cost: null },
      { cat: "spa", name: "The Sanctuary", deck: null, cost: null, note: "Top-deck retreat for Sanctuary Collection guests" },
      // ---- kids
      { cat: "kids", name: "Firefly Park Kids Club", deck: null, cost: null, note: "Kids 3-7" },
      { cat: "kids", name: "Neon Grove Tweens Club", deck: null, cost: null, note: "Kids 8-12" },
      { cat: "kids", name: "The Underground Teen Lounge", deck: null, cost: null, note: "Teens 13-17" },
      // ---- services
      { cat: "service", name: "The Shops of Princess", deck: "8", cost: null, note: "Breitling, Fine Timepieces, Beauty & Wellness boutiques" },
    ],
  },
  "star princess": {
    name: "Star Princess", line: "Princess", verified: "2026-10-06",
    sources: {
      ship: "https://www.princess.com/ships-and-experience/ships/st-star-princess",
      decks: "https://www.princess.com/news/backgrounders-and-fact-sheets/star-princess-fact-sheet",
    },
    // Sun Princess's sister - same source plan: no accessible-route page, so facts + the few decks come from
    // princess.com's fact sheet. built = inaugural voyage (the sheet: "October 4, 2025 ... from Barcelona").
    facts: { guests: 4300, crew: 1600, tonnage: 177800, lengthFt: 1133, decks: 21, built: 2025 },
    venues: [
      // ---- eat (ship page "Complimentary" / specialty); deck null = neither page names it
      { cat: "eat", name: "Aurora Dining Room", deck: "6", cost: "included", note: "Main dining room — traditional dining" },
      { cat: "eat", name: "Celestial Dining Room", deck: "7", cost: "included", note: "Main dining room — anytime dining" },
      { cat: "eat", name: "Americana Diner", deck: "9", cost: "included", note: "Classic American favorites" },
      { cat: "eat", name: "The Eatery", deck: null, cost: "included", note: "Regional specialties, comfort food" },
      { cat: "eat", name: "Lido Greens · Grill · Slice · Tacos", deck: null, cost: "included" },
      { cat: "eat", name: "The Promenade", deck: null, cost: "included", note: "Grill, ice cream, pizza slices" },
      { cat: "eat", name: "Coffee & Cones", deck: null, cost: "included", note: "Ice cream + specialty coffee" },
      { cat: "eat", name: "International Café", deck: null, cost: "included", note: "Open 24 hours" },
      { cat: "eat", name: "Crown Grill", deck: null, cost: "extra", note: "Steakhouse, aged hand-cut steaks" },
      { cat: "eat", name: "Sabatini's Italian Trattoria", deck: null, cost: "extra", note: "Handmade pasta" },
      { cat: "eat", name: "The Catch by Rudi", deck: null, cost: "extra", note: "Seafood" },
      { cat: "eat", name: "The Butcher's Block by Dario", deck: null, cost: "extra", note: "Premium beef" },
      { cat: "eat", name: "Umai Teppanyaki", deck: null, cost: "extra" },
      { cat: "eat", name: "Umai Hot Pot", deck: null, cost: "extra", note: "Japanese hot pot" },
      { cat: "eat", name: "Makoto Ocean", deck: null, cost: "extra", note: "Chef Makoto Okuwa's Japanese dishes" },
      { cat: "eat", name: "Love by Britto", deck: null, cost: "extra", note: "Romero Britto's art, Rudi Sodamin's menu" },
      { cat: "eat", name: "Alfredo's Pizzeria", deck: null, cost: "extra" },
      { cat: "eat", name: "O'Malley's Irish Pub", deck: null, cost: "extra" },
      { cat: "eat", name: "Room service", deck: null, cost: null, note: "24 hours" },
      // ---- drink
      { cat: "drink", name: "Spellbound by Magic Castle™", deck: null, cost: null, note: "Magic + mixology" },
      { cat: "drink", name: "Crooners", deck: null, cost: null },
      { cat: "drink", name: "Bellini's Cocktail Bar", deck: null, cost: null },
      { cat: "drink", name: "Wheelhouse Bar", deck: null, cost: null },
      { cat: "drink", name: "Good Spirits® At Sea", deck: null, cost: null },
      { cat: "drink", name: "The MIX · Star Bar · Lido Bar · Sea View Bar · Cascade Bar", deck: null, cost: null },
      { cat: "drink", name: "Coffee Currents", deck: null, cost: null },
      // ---- shows & fun
      { cat: "fun", name: "Princess Arena", deck: null, cost: null, note: "Theater that changes shape for each production" },
      { cat: "fun", name: "The Dome", deck: null, cost: null, note: "Glass-enclosed indoor/outdoor venue" },
      { cat: "fun", name: "The Piazza", deck: null, cost: null, note: "Inside the glass sphere" },
      { cat: "fun", name: "Princess Live!", deck: null, cost: null },
      { cat: "fun", name: "Princess Casino", deck: null, cost: null, note: "Princess's largest casino, expanded non-smoking area" },
      { cat: "fun", name: "Movies Under the Stars®", deck: null, cost: null },
      { cat: "fun", name: "SkyDeck Sports Court & Track", deck: null, cost: null },
      // ---- pools
      { cat: "pool", name: "Lido Deck Pools (2)", deck: null, cost: null },
      { cat: "pool", name: "Dome Pool", deck: null, cost: null, note: "Indoor/outdoor" },
      { cat: "pool", name: "Wake View Pool", deck: null, cost: null },
      { cat: "pool", name: "Sanctuary Pool", deck: null, cost: null, note: "Sanctuary Collection guests" },
      { cat: "pool", name: "Splash Pad", deck: null, cost: null },
      // ---- spa & fitness
      { cat: "spa", name: "Lotus Spa®", deck: null, cost: null },
      { cat: "spa", name: "Lotus Salon", deck: null, cost: null },
      { cat: "spa", name: "Fitness Center · Fitness Studio · Wellness Studio", deck: null, cost: null },
      { cat: "spa", name: "The Sanctuary Club", deck: null, cost: null, note: "Sanctuary Collection guests" },
      // ---- kids
      { cat: "kids", name: "Firefly Park Kids Club", deck: null, cost: null, note: "Kids 3-7" },
      { cat: "kids", name: "Neon Grove Tweens Club", deck: null, cost: null, note: "Kids 8-12" },
      { cat: "kids", name: "The Underground Teen Lounge", deck: null, cost: null, note: "Teens 13-17" },
      // ---- services
      { cat: "service", name: "The Shops of Princess", deck: "8", cost: null, note: "Breitling, Fine Timepieces, Beauty & Wellness boutiques" },
      { cat: "service", name: "Effy Boutique", deck: null, cost: null },
    ],
  },
  "grand princess": {
    name: "Grand Princess", line: "Princess", verified: "2026-10-06",
    sources: {
      ship: "https://www.princess.com/ships-and-experience/ships/ap-grand-princess",
      decks: "https://gb-www.princess.com/html/global/book/ships/deck-plans/ap-accessible-route-text.html",
    },
    facts: { guests: 2600, crew: 1150, tonnage: 107517, lengthFt: 949, decks: 17, built: 1998 },
    // Same deck rule as Majestic: a deck shows only when both pages name the venue. The deck page still calls
    // the buffet "Horizon Court", so World Fresh Marketplace gets no deck; it lists no Salty Dog Gastropub.
    venues: [
      // ---- eat (princess.com "Included" / specialty); deck null = the deck page doesn't name it
      { cat: "eat", name: "Michelangelo Dining Room", deck: "5", cost: "included", note: "Main dining room" },
      { cat: "eat", name: "Da Vinci Dining Room", deck: "6", cost: "included", note: "Main dining room" },
      { cat: "eat", name: "Botticelli Dining Room", deck: "6", cost: "included", note: "Main dining room" },
      { cat: "eat", name: "International Café", deck: "5", cost: "included", note: "Open 24 hours a day" },
      { cat: "eat", name: "World Fresh Marketplace", deck: null, cost: "included", note: "Buffet" },
      { cat: "eat", name: "Slice Pizzeria", deck: "14", cost: "included", note: "Neapolitan-style pizza" },
      { cat: "eat", name: "The Salty Dog Grill", deck: "14", cost: "included", note: "Gourmet burgers" },
      { cat: "eat", name: "Coffee & Cones", deck: "14", cost: "included", note: "Ice cream + espresso" },
      { cat: "eat", name: "Afternoon Tea", deck: null, cost: "included" },
      { cat: "eat", name: "Crown Grill", deck: "7", cost: "extra", note: "Premium steakhouse" },
      { cat: "eat", name: "Sabatini's Italian Trattoria", deck: "7", cost: "extra" },
      { cat: "eat", name: "Alfredo's Pizzeria", deck: "5", cost: "extra", note: "Individual woodfire-style pizzas" },
      { cat: "eat", name: "The Salty Dog Gastropub", deck: null, cost: "extra", note: "Burgers + craft drinks" },
      { cat: "eat", name: "Chef's Table", deck: null, cost: "extra", note: "Hosted by the executive chef" },
      { cat: "eat", name: "Crab Shack", deck: null, cost: "extra", note: "Pop-up seafood" },
      { cat: "eat", name: "Ultimate Balcony Dining", deck: null, cost: "extra", note: "On your balcony" },
      // ---- drink
      { cat: "drink", name: "Vines Wine Bar", deck: "5", cost: null, note: "Wine flights" },
      { cat: "drink", name: "Crooners", deck: "7", cost: null, note: "Martinis + a pianist" },
      { cat: "drink", name: "Wheelhouse Bar", deck: "7", cost: null },
      { cat: "drink", name: "Explorers Lounge · Vista Lounge", deck: "7", cost: null },
      { cat: "drink", name: "The One5", deck: "15", cost: null, note: "Late-night dance club" },
      { cat: "drink", name: "Calypso Bar", deck: "14", cost: null, note: "Pool bar" },
      { cat: "drink", name: "Good Spirits® At Sea", deck: null, cost: null, note: "Bartender-led cocktails" },
      // ---- shows & fun
      { cat: "fun", name: "Princess Theater", deck: "6 · 7", cost: null, note: "Original musical productions" },
      { cat: "fun", name: "Casino", deck: "6", cost: null, note: "Vegas-style" },
      { cat: "fun", name: "The Piazza", deck: "5", cost: null, note: "Street performers" },
      { cat: "fun", name: "Movies Under the Stars®", deck: "15", cost: null, note: "Poolside" },
      { cat: "fun", name: "Fine Arts Gallery", deck: "5", cost: null, note: "Art auctions + lectures" },
      { cat: "fun", name: "Library", deck: "7", cost: null },
      // ---- pools
      { cat: "pool", name: "Neptune's Reef & Pool", deck: "14", cost: null },
      { cat: "pool", name: "Calypso Reef & Pool", deck: "14", cost: null },
      { cat: "pool", name: "The Conservatory", deck: "15", cost: null, note: "Covered pool, hot tubs, ping pong" },
      // ---- spa & fitness
      { cat: "spa", name: "Lotus Spa®", deck: "15", cost: null },
      { cat: "spa", name: "Beauty Salon", deck: "15", cost: null },
      { cat: "spa", name: "Fitness Center", deck: "15", cost: null, note: "Cycling, Pilates, yoga" },
      { cat: "spa", name: "The Sanctuary", deck: null, cost: null, note: "Adults-only retreat" },
      // ---- kids
      { cat: "kids", name: "Youth Center", deck: "15", cost: null, note: "Kids 3-7 and 8-12" },
      { cat: "kids", name: "Teen Lounge", deck: "15", cost: null, note: "Teens 13-17" },
      // ---- services
      { cat: "service", name: "Guest Services", deck: "6", cost: null },
      { cat: "service", name: "Shore Excursions", deck: "7", cost: null },
      { cat: "service", name: "Medical Center", deck: "4", cost: null },
      { cat: "service", name: "Captain's Circle · Future Cruise Sales", deck: "7", cost: null },
      { cat: "service", name: "The Shops of Princess", deck: "7", cost: null },
      { cat: "service", name: "Photo & Video Gallery", deck: "7", cost: null },
      { cat: "service", name: "Wedding Chapel", deck: "15", cost: null },
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
    <div class="today-line sub">The ship guide for ${esc(tr.ship)} isn't in Cruise Hub yet — so far: ${Object.values(SHIP_GUIDES).map(g => g.name).join(", ")}; more ships are coming. Until then your cruise line's app has the venues.</div>`;
  const f = G.facts, list = SHIP_CAT === "free" ? G.venues.filter(v => v.cost === "included") : G.venues.filter(v => v.cat === SHIP_CAT);
  const pill = v => v.cost === "included" ? `<span class="pill">Included</span>` : v.cost === "extra" ? `<span class="pill soon">Extra cost</span>` : "";
  return `<div class="today-line"><b>${esc(G.name)}</b> · ${G.line}${tr.cabin ? ` · cabin ${esc(tr.cabin)}` : ""}</div>
    <div class="today-line sub">${f.guests.toLocaleString()} guests · ${f.decks} decks · ${f.lengthFt} ft${f.built ? ` · built ${f.built}` : ""}</div>
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

// ------------------------------------------------------------ home (departure) port guides
// v0.72 (Scott's "GET ME TO MY SHIP" / travel-day plan: parking, terminal, when to arrive). Same rule: a fact
// shows only when the PORT'S OWN site states it. Parking prices are dated by `verified` - ports change them.
const HOME_PORTS = {
  canaveral: { name: "Port Canaveral", place: "Cape Canaveral, FL", verified: "2026-10-05", keys: ["canaveral", "cape canaveral"],
    sources: { "Port Canaveral": "https://www.portcanaveral.com/cruise/directions-parking/cruise-terminal-guide" },
    facts: [
      { icon: "🅿️", text: "Parking is $20 a day plus tax — the day you arrive and the day you leave both count. Oversize vehicles $40 a day.", src: "https://www.portcanaveral.com/cruise/passenger-faqs" },
      { icon: "💳", text: "Pay when you drive in — cards only (cashless), no reservations needed. You park next to your terminal and walk, no shuttle.", src: "https://www.portcanaveral.com/cruise/directions-parking" },
      { icon: "🕙", text: "Terminal garages and lots don't open before 10 AM for boarding passengers — arrive at your cruise line's boarding time.", src: "https://www.portcanaveral.com/cruise/directions-parking/cruise-terminal-guide" },
      { icon: "🧳", text: "The cruise lines have porters to take your checked bags.", src: "https://www.portcanaveral.com/cruise/passenger-faqs" },
      { icon: "🔢", text: "7 terminals (1, 2, 3, 5, 6, 8, 10) — check which one is on your boarding pass before you drive.", src: "https://www.portcanaveral.com/cruise/directions-parking/cruise-terminal-guide" },
    ] },
  everglades: { name: "Port Everglades", place: "Fort Lauderdale, FL", verified: "2026-10-05", keys: ["everglades", "fort lauderdale", "ft. lauderdale", "ft lauderdale"],
    sources: { "Port Everglades": "https://www.porteverglades.net/cruise/parking/" },
    facts: [
      { icon: "🅿️", text: "Port garages (Heron and Palm) are $25 a day max; oversize vehicles $35 per 24 hours. The day starts when you pull the ticket.", src: "https://www.porteverglades.net/cruise/parking/" },
      { icon: "🚫", text: "The port takes no parking reservations or prepayment — just drive in.", src: "https://www.porteverglades.net/cruise/parking/" },
      { icon: "🚌", text: "The only shuttle runs between Cruise Terminal 29 and the Palm garage.", src: "https://www.porteverglades.net/cruise/parking/" },
      { icon: "📞", text: "Parking questions: 954-468-3680.", src: "https://www.porteverglades.net/cruise/parking/" },
    ] },
  miami: { name: "PortMiami", place: "Miami, FL", verified: "2026-10-05", keys: ["miami"],
    sources: { "PortMiami parking": "https://www.miamidade.gov/portmiami/parking-information.page" },
    facts: [
      { icon: "🅿️", text: "County garages C, D, F, G and Lot E: $25 a day for overnight (cruise) parking. Royal Caribbean (Garage A) and Norwegian (Garage B) price their own garages.", src: "https://www.miamidade.gov/portmiami/parking-information.page" },
      { icon: "💳", text: "Cash, Visa, MasterCard, Amex, Discover — DEBIT CARDS ARE NOT ACCEPTED.", src: "https://www.miamidade.gov/portmiami/parking-information.page" },
      { icon: "🚐", text: "RVs, oversize vans and trailers: Surface Lot E, $25 per space per day.", src: "https://www.miamidade.gov/portmiami/parking-information.page" },
    ] },
  galveston: { name: "Port of Galveston", place: "Galveston, TX", verified: "2026-10-05", keys: ["galveston"],
    sources: { "Port of Galveston parking FAQ": "https://www.portofgalveston.com/cruise-parking/faq/" },
    facts: [
      { icon: "📅", text: "Reserve parking ahead — strongly suggested; drive-ups only if there's space. Prices depend on the lot.", src: "https://www.portofgalveston.com/cruise-parking/faq/" },
      { icon: "💳", text: "Credit cards only.", src: "https://www.portofgalveston.com/cruise-parking/faq/" },
      { icon: "🕘", text: "Lots open at 9 AM on most sailing days.", src: "https://www.portofgalveston.com/cruise-parking/faq/" },
      { icon: "🧳", text: "Drop your bags at the terminal first, then go park. Economy-lot shuttles are free, about every 5–7 minutes.", src: "https://www.portofgalveston.com/cruise-parking/faq/" },
      { icon: "📞", text: "Parking help: 409-766-6163 (8 AM–5 PM daily).", src: "https://www.portofgalveston.com/cruise-parking/faq/" },
    ] },
  seattle: { name: "Port of Seattle", place: "Seattle, WA", verified: "2026-10-05", keys: ["seattle", "smith cove", "pier 91", "bell street", "pier 66"],
    sources: { "Port of Seattle cruise FAQ": "https://www.portseattle.org/node/17501" },
    facts: [
      { icon: "🔢", text: "Two terminals: Smith Cove (Pier 91) and Bell Street (Pier 66) — the port's 'Find My Ship and Terminal' page tells you which.", src: "https://www.portseattle.org/node/17501" },
      { icon: "🅿️", text: "Smith Cove (Pier 91): from $27 a day, taxes, fees and the shuttle to the ship included — reserve on the Pier 91 parking site.", src: "https://www.portseattle.org/node/17501" },
      { icon: "🅿️", text: "Bell Street (Pier 66): Republic Parking garage across the street, $30 a day plus tax — book online or call 206-443-1793.", src: "https://www.portseattle.org/node/17501" },
      { icon: "✈️", text: "From SEA airport: rideshare/taxi (3rd floor of the parking garage), cruise-line bus, or Link light rail to Westlake then a ride.", src: "https://www.portseattle.org/node/17501" },
      { icon: "🧳", text: "Port Valet (free): flying home after noon on Alaska, American, Delta, JetBlue, Southwest or United? Check bags to your flight right from the ship.", src: "https://www.portseattle.org/node/17501" },
    ] },
  "new orleans": { name: "Port of New Orleans", place: "New Orleans, LA", verified: "2026-10-05", keys: ["new orleans", "nola", "erato", "julia street"],
    sources: { "Port NOLA parking": "https://portnola.com/cruise/parking-directions" },
    facts: [
      { icon: "🔢", text: "Carnival sails from Erato Street; Norwegian and Royal Caribbean from Julia Street.", src: "https://portnola.com/cruise/parking-directions" },
      { icon: "🅿️", text: "Both garages: 7 days is $180; booking ahead adds $1 a day. Garages open at 9 AM.", src: "https://portnola.com/cruise/parking-directions" },
      { icon: "📏", text: "LOW ceilings — Erato 7'6\" (a few 3rd-floor spots take 8'4\"), Julia Street's 100 Poydras garage 6'6\". Tall vans/roof boxes check first.", src: "https://portnola.com/cruise/parking-directions" },
      { icon: "💳", text: "Credit or debit cards.", src: "https://portnola.com/cruise/parking-directions" },
      { icon: "🧳", text: "Erato: SeaCaps take your checked bags straight to the ship. Julia Street: a shuttle runs from the garage to the terminal.", src: "https://portnola.com/cruise/parking-directions" },
    ] },
  tampa: { name: "Port Tampa Bay", place: "Tampa, FL", verified: "2026-10-05", keys: ["tampa"],
    sources: { "Port Tampa Bay parking": "https://www.porttb.com/cruise/cruise-parking/" },
    facts: [
      { icon: "🅿️", text: "The port garage (810 Channelside Dr) is across the street from the central cruise terminal; overflow at 1331 McKay St when space allows.", src: "https://www.porttb.com/cruise/cruise-parking/" },
      { icon: "📅", text: "Prepay online — pick your cruise line on the port's parking page. Valet is a $20 upgrade.", src: "https://www.porttb.com/cruise/cruise-parking/" },
      { icon: "📞", text: "Parking questions: 813-905-7678.", src: "https://www.porttb.com/cruise/cruise-parking/" },
    ] },
  baltimore: { name: "Cruise Maryland (Baltimore)", place: "Baltimore, MD", verified: "2026-10-05", keys: ["baltimore", "cruise maryland"],
    sources: { "Cruise Maryland": "https://cruise.maryland.gov/pages/default.aspx" },
    facts: [
      { icon: "🅿️", text: "Terminal parking is $25 a day per vehicle (since April 1, 2026).", src: "https://cruise.maryland.gov/pages/default.aspx" },
      { icon: "📍", text: "The terminal: 2001 East McComas Street, Baltimore, MD 21230.", src: "https://cruise.maryland.gov/pages/default.aspx" },
    ] },
  "los angeles": { name: "Port of Los Angeles (San Pedro)", place: "San Pedro, CA", verified: "2026-10-05", keys: ["los angeles", "san pedro", "world cruise center"],
    sources: { "Port of Los Angeles": "https://portoflosangeles.org/business/terminals/passenger/cruise", "LA Waterfront cruise FAQ": "https://www.lawaterfront.org/cruise/cruise-faqs" },
    facts: [
      { icon: "🅿️", text: "Parking at the terminal: first hour free, then $2 an hour up to a daily max of about $22–24 (the port's own pages differ). Oversize vehicles $40 max a day.", src: "https://portoflosangeles.org/business/terminals/passenger/cruise" },
      { icon: "✅", text: "No reservations needed; lots are open 24/7.", src: "https://www.lawaterfront.org/cruise/cruise-faqs" },
      { icon: "💳", text: "Cash, debit or credit cards.", src: "https://www.lawaterfront.org/cruise/cruise-faqs" },
      { icon: "📍", text: "Berth 93, 100 Swinford Street, San Pedro. Parking help: (949) 978-0665.", src: "https://www.lawaterfront.org/cruise/cruise-faqs" },
    ] },
  boston: { name: "Flynn Cruiseport Boston", place: "Boston, MA", verified: "2026-10-05", keys: ["boston", "flynn"],
    sources: { "Massport parking": "https://www.massport.com/flynn-cruiseport/to-from-flynn-cruiseport/parking-directions" },
    facts: [
      { icon: "📅", text: "Cruise parking is at 93 Fargo Street and MUST be booked online before you arrive.", src: "https://www.massport.com/flynn-cruiseport/to-from-flynn-cruiseport/parking-directions" },
      { icon: "🚌", text: "A free shuttle runs to the terminal every 10–15 minutes (wheelchair + scooter friendly) — or it's about a 10-minute walk.", src: "https://www.massport.com/flynn-cruiseport/to-from-flynn-cruiseport/parking-directions" },
    ] },
  "san diego": { name: "Port of San Diego", place: "San Diego, CA", verified: "2026-10-05", keys: ["san diego"],
    sources: { "Port of San Diego": "https://www.portofsandiego.org/coming-and-going/parking/long-term-cruise-parking" },
    facts: [
      { icon: "🚫", text: "NO long-term parking at the cruise terminals — the port doesn't run cruise parking. Book an off-site lot (the port lists Ace, ABM, Park Shuttle & Fly, the airport and Aladdin).", src: "https://www.portofsandiego.org/coming-and-going/parking/long-term-cruise-parking" },
      { icon: "🚗", text: "Drop-off and pick-up areas are right at the terminals.", src: "https://www.portofsandiego.org/coming-and-going/parking/long-term-cruise-parking" },
      { icon: "📞", text: "Port parking questions: 619-686-6464 (weekdays 8–5).", src: "https://www.portofsandiego.org/coming-and-going/parking/long-term-cruise-parking" },
    ] },
  mobile: { name: "Alabama Cruise Terminal (Mobile)", place: "Mobile, AL", verified: "2026-10-05", keys: ["mobile, al", "mobile, alabama", "mobile al", "alabama cruise terminal", "port of mobile"],
    sources: { "Alabama Cruise Terminal": "https://www.shipmobile.com/parking/" },
    facts: [
      { icon: "🅿️", text: "The parking deck is attached to the terminal: $23 a day; RVs/campers $46, buses $69.", src: "https://www.shipmobile.com/parking/" },
      { icon: "📏", text: "A regular spot fits 8'6\" tall × 8'6\" wide × 16' long — bigger than that pays the RV rate.", src: "https://www.shipmobile.com/parking/" },
      { icon: "📱", text: "Pay by text (P2603 to 504-504), at the kiosk by the elevators, or in the Premium Parking app.", src: "https://www.shipmobile.com/parking/" },
      { icon: "🎖️", text: "Disabled veterans park free — no DV plate? Check in with parking staff after you park.", src: "https://www.shipmobile.com/parking/" },
      { icon: "➡️", text: "When the deck fills, overflow is the 5th floor of 100 Canal St.", src: "https://www.shipmobile.com/parking/" },
    ] },
  charleston: { name: "Charleston (Union Pier)", place: "Charleston, SC", verified: "2026-10-05", keys: ["charleston", "union pier"],
    sources: { "SC Ports cruise FAQ (PDF)": "https://scspa.com/wp-content/uploads/cruise-faqs.pdf" },
    facts: [
      { icon: "🅿️", text: "On-site parking on port property, about $17–21 a day (SC Ports' own documents differ); oversize/RVs $50. Pay when you arrive.", src: "https://scspa.com/wp-content/uploads/cruise-faqs.pdf" },
      { icon: "💳", text: "Debit or credit card, traveler's check, personal check or money order — NO CASH.", src: "https://scspa.com/wp-content/uploads/cruise-faqs.pdf" },
      { icon: "♿", text: "Vehicles with a handicap permit park free.", src: "https://scspa.com/wp-content/uploads/cruise-faqs.pdf" },
      { icon: "🧳", text: "Big bags go to the luggage tent first — only small carry-ons ride the shuttle from the lot.", src: "https://scspa.com/wp-content/uploads/cruise-faqs.pdf" },
    ] },
  jacksonville: { name: "JAXPORT Cruise Terminal", place: "Jacksonville, FL", verified: "2026-10-05", keys: ["jacksonville", "jaxport"],
    sources: { "JAXPORT parking": "https://www.jaxport.com/cruise/parking-directions/" },
    facts: [
      { icon: "🅿️", text: "$17 a day, tax included ($85 for a 5-day cruise); oversize RVs $34 a day.", src: "https://www.jaxport.com/cruise/parking-directions/" },
      { icon: "💳", text: "Credit cards only — no cash. No reservations: just pay when you drive in.", src: "https://www.jaxport.com/cruise/parking-directions/" },
      { icon: "📍", text: "9810 August Drive, Jacksonville, FL 32226.", src: "https://www.jaxport.com/cruise/parking-directions/" },
    ] },
  norfolk: { name: "Norfolk (Half Moone Cruise Center)", place: "Norfolk, VA", verified: "2026-10-05", keys: ["norfolk", "half moone"],
    sources: { "Cruise Norfolk FAQ (VisitNorfolk)": "https://www.visitnorfolk.com/cruisenorfolk-frequently-asked-questions/" },
    facts: [
      { icon: "🅿️", text: "Cruise parking is the Cedar Grove lot (1000 Monticello Ave, 1.5 miles away): $15 a day, cash or card, paid on entry.", src: "https://www.visitnorfolk.com/cruisenorfolk-frequently-asked-questions/" },
      { icon: "🧳", text: "Check your bags AT the lot — they go straight to the ship — then ride the free shuttle to the terminal curb.", src: "https://www.visitnorfolk.com/cruisenorfolk-frequently-asked-questions/" },
      { icon: "🕤", text: "The lot opens 9:30 AM, shuttles start about 9:45 — the LAST shuttle is 2:30 PM.", src: "https://www.visitnorfolk.com/cruisenorfolk-frequently-asked-questions/" },
      { icon: "📍", text: "The terminal: 1 Waterside Drive, downtown Norfolk.", src: "https://www.visitnorfolk.com/cruisenorfolk-frequently-asked-questions/" },
    ] },
};
const homePort = name => { const n = String(name || "").toLowerCase(); return Object.values(HOME_PORTS).find(g => g.keys.some(k => n.includes(k))) || null; };
function homePortHtml(tr, open) {
  const G = tr && tr.port && homePort(tr.port); if (!G) return "";
  const body = `${G.facts.map(f => `<div class="today-line">${f.icon} ${esc(f.text)}</div>`).join("")}
    <p class="fine" style="margin-top:6px">From ${Object.entries(G.sources).map(([n, u]) => `<a href="${u}" target="_blank" rel="noopener">${esc(n)}</a>`).join(" · ")} — checked ${prettyDate(G.verified)}, ${G.verified.slice(0, 4)}. Prices change — your cruise line's boarding pass wins.</p>`;
  return open ? `<div class="day-label" style="margin-top:10px">⚓ Good to know at ${esc(G.name)}</div>${body}`
    : `<details class="home-port" style="margin-top:8px"><summary>⚓ <b>${esc(G.name)}</b> — parking + terminal tips</summary>${body}</details>`;
}
