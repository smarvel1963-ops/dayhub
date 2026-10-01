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
