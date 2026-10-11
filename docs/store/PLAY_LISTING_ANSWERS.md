<!-- SAVE AS: PLAY_LISTING_ANSWERS.md · LOCATION: C:/MarvelApps/dayhub/docs/store/ -->
# Google Play — listing + form answers, ready to paste (Day Hub first)
Written 2026-10-11 from the store-readiness audit (`C:/MarvelApps/audit-reports/03_GOOGLE_PLAY_READINESS.md`).

- **What this is:** answers only. Scott creates the account and submits. Claude never types account credentials.
- **Build plan:** `../PLAY_STORE.md` (TWA via PWABuilder).
- **Re-check before submitting:** Google's payments/link-out policy (it changed in 2025-26) and the target API
  level (36 for new apps since 2026-08-31).

## Graphics (in this folder)
| Asset | File | Size |
|---|---|---|
| Feature graphic | `feature_day_1024x500.png` (also `feature_cruise_…`, `feature_trip_…` for later listings) | 1024×500 |
| App icon | `../../icon-512.png` | 512×512 |
| Phone screenshots | `../../screenshots/phone-1-home.png` … `phone-4-brain-dump.png` | 1080×1920 |
| Tablet screenshot | `../../screenshots/wide-1-home.png` | 1280×800 |

Regenerate the screenshots after visible changes: `python tests/make_screenshots.py`.

## Store listing — Day Hub
- **App name (30):** `Day Hub — Daily Planner`
- **Short description (80):** `Your whole day on one screen: schedule, weather, to-dos, bills. No ads, ever.`
- **Full description:**

```
Day Hub puts your whole day on one screen — and tells you what to do next.

• Schedule with a NOW line, plus your Google Calendar if you connect it
• Weather that tells you when the rain starts
• To-dos, shopping lists and notes
• Bills with due dates, payday and a simple budget
• Brain dump: type everything on your mind, Day Hub sorts it into to-dos, reminders, shopping and ideas
• Morning brief, nightly reset and reminders before events and bills
• Trips: Day Hub works with Cruise Hub and Trip Hub, the other apps in the Hub family

Your data stays on your phone. There's no Day Hub account and no ads, ever.
Back up to your own Google Drive if you want.

Day Hub Pro (optional) adds the AI helper, two-way Google Calendar sync and Drive backup.

Made by Marvel Corp.
```

- **Category:** Productivity. **Tags:** planner, to-do, calendar, budget.
- **Contact email:** smarvel1963@gmail.com.
- **Privacy policy:** https://smarvel1963-ops.github.io/dayhub/privacy.html
- **Website:** https://smarvel1963-ops.github.io/hubs/

## App content forms
| Form | Answer |
|---|---|
| Privacy policy | URL above |
| Ads | **No ads** |
| App access | **Some features are restricted.** Core app: no login. Pro features need a purchase. Give the reviewer a **free 100%-coupon Day Hub Pro membership** on Whop and its email (⚠️ TO DO before submitting: make the coupon; because of the email-code step the reviewer needs a mailbox we can read). |
| Content rating (IARC) | Reference app / productivity. No violence, sex, profanity, drugs or gambling; no user-to-user chat or sharing; no location sharing; can buy digital goods (Pro on an outside site). Expected: **Everyone**. |
| Target audience | **13+** (privacy.html says 13 and older). Not designed for children. |
| News app | No |
| COVID-19 / health | No |
| Data safety | See below |
| Government app | No |
| Financial features | None (a budget tracker only; no transactions or loans) |
| Account deletion | **No account is created in the app.** Erase everything (⚙ → Your data) deletes on-device data; "Delete my Drive backup" deletes the Drive copy; the relay's hashed records can be removed by emailing smarvel1963@gmail.com. |

## Data safety form — mirrors privacy.html (change both together)
**Does the app collect or share user data?** Yes. Only for features the user turns on, and never for ads.

| Data type | Collected? | Shared? | Purpose | Optional? | Notes |
|---|---|---|---|---|---|
| Email address | Yes | No | App functionality (checking a purchase; emailing the unlock code) | Yes (only when unlocking Pro / credits) | The relay keeps a one-way hash, not the email |
| Other in-app content (text the user sends to the AI) | Yes | **Yes, with Anthropic** as a service provider that processes it | App functionality | Yes (AI helper is optional) | Not stored by us; notes only if the user allows it |
| Approximate location (city / ZIP typed by the user) | Yes | **Yes, with Open-Meteo** for the weather | App functionality | Required for weather | Typed by the user, not GPS |
| Calendar events | Yes (read on the phone) | No | App functionality | Yes | Google Calendar sync, phone ↔ Google directly |
| Files and docs (backup) | Stored in the user's own Google Drive | No | Backup | Yes | appDataFolder, hidden |
| Device or other IDs | Yes (a random phone id the app makes) | No | Fraud prevention (limit a purchase to 3 phones) | Only with a purchase | Hashed on the relay |

- **Encrypted in transit:** Yes (HTTPS everywhere).
- **Can users request deletion:** Yes (Erase in the app + email).
- **Committed to the Families policy:** No (13+).

## Payments (decide before submitting — Scott)
**Recommended:** the Play build shows **no buy buttons and no Whop links**. A person who already bought on Whop
types their email (plus the emailed code) and Pro unlocks. This is the "consumption-only" pattern.
- **Engineering:** a platform switch that hides the Buy buttons when the app runs as the Play TWA (~2 h, on
  ACTIVE_TODO).
- **Later options:** enroll in Google's US alternative-billing / external-links program, or add Play Billing.
