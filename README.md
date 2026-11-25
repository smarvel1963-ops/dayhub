# Day Hub — prototype v0.1
Save path: C:\MarvelApps\dayhub\README.md

The morning brief screen (Scott 2026-10-01: "everyone, start with the morning brief
screen but could customize by profession"). Tracked on Marvel Desktop -> MOBILE APPS.

## Run it on this PC
    cd C:\MarvelApps\dayhub
    python -m http.server 8765 --bind 127.0.0.1
    then open http://127.0.0.1:8765

## What works (tested 2026-10-01 in Chrome)
- Greeting + one-line summary ("93° and cloudy · 0 events · 1 to-do · first stop 7:30 AM")
- Cards: clock, live weather (Open-Meteo, free, no key), today's calendar, to-dos
- Profession packs: General (sunrise/sunset), Trucker/Dispatcher (route weather at both
  ends with a wet-roads warning, today's loads), Trades (jobs), Office (next meeting
  countdown), Sports (placeholder - games come next)
- Settings: name, city, profession, move / hide any card
- Installable (manifest + service worker, network-first so updates show at once)
- All data stays on the phone (localStorage). Nothing is sent anywhere except the city
  name to the weather service.

## Not yet
- On a PHONE: needs hosting (free: GitHub Pages / Netlify) - GitHub account first.
- Google Calendar sync (needs Google sign-in), sports games feed, accounts / payments.

## Files
`features.js` (the SWITCHBOARD - launch switches, all OFF, see `docs/LAUNCH_SWITCHES.md`), then `app.js` (state + feature logic), then `scenes.js` (the faint scene behind the clock - every hub has one), then `cruise.js` (Cruise Hub pieces kept out of app.js for the 3,000-line rule), then `shell.js` (the 5-tab HOME / PLAN / EXPLORE / WALLET / AI shell + the big button), then `ships.js` (verified ship guides - Caribbean Princess first), then `ui.js` (cards, sheets, events, start) - two classic scripts, one shared
scope, loaded in that order by `index.html` and Cruise Hub's `../cruisehub/index.html` (its own repo). Each stays under 3,000 lines. A new script
file must also go in the `SHELL` list in `sw.js`.
v1.73: `basics.js` (Calendar, Notes, Calculator, share-one-entry, each Hub's dates for Google Calendar) loads right before `ui.js` in
EVERY Hub's `index.html` and sits in EVERY Hub's `sw.js` SHELL (dayhub's and each Hub repo's). Test: `python tests/test_basics.py`.
v1.74: `tipster.js` (Tiny Tipster: one tip or reminder a day on Home, switch `TINY_TIPSTER`) is fetched by `ui.js tipMaybe` only on a day he has
something to say, like `tour.js` and `share.js` - so no Hub's `index.html` or `sw.js` needs it, and it stays out of every SHELL. Test: `python tests/test_tipster.py`.
v1.78: `voicefill.js` (a mic at the right end of every typing box, switch `VOICE_FILL`) and `appsend.js` ("Send an app to someone" as the last row
of the Hub family list, Whop links, switch `APP_SEND`) are loaded by `ui.js` on open - no Hub `index.html` / `sw.js` change. They are SHARED with
the other apps: Scott Hub, Marvel Magic, the hubs site and Photo Hub's web copy load `/dayhub/voicefill.js` (and `/dayhub/appsend.js` under an
app list, `<div data-appsend="<app id>">`). Photo Hub's phone build and UseMart keep a COPY (another address) - change the original here, then
copy it there. A NEW APP gets both: the script tags above, or, on the Hub engine, nothing to do. Tests: `python tests/test_voicefill.py`,
`python tests/test_appsend.py`.

## Releasing an update (since v0.11)
0. **Run the tests first:** `python tests/run_tests.py` - drives the real app in a headless browser (frozen clock,
   fake weather, empty phone each time) and checks every feature at phone + tablet size. Must end "0 failed".
Every push that changes the app MUST bump the version in **three** places, or users never hear about it:
1. `const VERSION` in `app.js`
2. `version.json` - `"version"` plus a new entry in `"notes"` (one plain-English line per change, newest first)
3. `const CACHE` in `sw.js`

Open copies of Day Hub check `version.json` on open, every 30 minutes and when brought back to the front:
a mismatch shows "Update ready - tap to update" (and a notification if reminders are on).
After updating, the "What's new" card lists the notes once.
