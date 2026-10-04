# Day Hub on Google Play (TWA via PWABuilder)
Save path: C:\MarvelApps\dayhub\docs\PLAY_STORE.md · written for v0.40 (2026-10-03). Readiness only, since **no Play account exists yet.**

**Channel #2 (Scott 10/3):** after Whop has about 20-30 paying customers. A FREE listing; Pro is unlocked by the
same Whop purchase (the buyer's email) the web app uses. Whop stays the only place Pro is sold.

Day Hub is already an installable web app. Google Play takes it as a **Trusted Web Activity (TWA)**: a small
Android wrapper that opens the live site full-screen. Updates keep coming from GitHub Pages, so there is no
re-upload for each version.

## Ready now (v0.40)
- `manifest.json`: `id` (kept as the id installed phones already have), `scope`, `start_url`, name, description,
  `categories` (productivity, lifestyle, utilities), 192/512 icons + maskable, and **screenshots** (4 phone 1080x1920
  + 1 wide 1280x800 in `screenshots/`). Regenerate them with `python tests/make_screenshots.py` after visible changes.
- Service worker (offline open), HTTPS, no ads, privacy policy + terms URLs (`privacy.html`, `terms.html`).
- Cruise Hub has its own repo + manifest (`C:/MarvelApps/cruisehub/manifest.json`, smarvel1963-ops.github.io/cruisehub/) and could be a second listing later.

## What Scott does (click by click)
1. **Play Console account:** https://play.google.com/console/signup → personal or organization (**Marvel Corp**
   as an organization needs a D-U-N-S number; personal is faster) → pay **$25 once** → verify your identity.
   New *personal* accounts must run a **closed test with at least 12 testers for 14 days** before production.
   Line up 12 people (family, CMMG Discord) early.
2. **Build the package:** https://www.pwabuilder.com → paste `https://smarvel1963-ops.github.io/dayhub/` →
   **Package for stores** → **Android** → Package ID e.g. `com.marvelcorp.dayhub` → **Generate**. Download the zip.
   It contains the `.aab` to upload, a **signing key** (keep it and its passwords somewhere safe, because losing it means
   you can never update the app), and an `assetlinks.json`.
3. **assetlinks.json:** it must be served at `https://smarvel1963-ops.github.io/.well-known/assetlinks.json`,
   which is the **`smarvel1963-ops.github.io` user-site repo, the same repo that hosts the /join link.** Add ONLY
   `.well-known/assetlinks.json` (GitHub Pages skips dot-folders unless the repo has a `.nojekyll` file or a
   `_config.yml` with `include: [".well-known"]`, so add one of those too) and change nothing else. Without it the app
   still works, but it shows a browser address bar. After Play signs the app, copy the **app signing key
   SHA-256** from Play Console → Setup → App signing and make sure it's in assetlinks.json.
4. **Create the app** in Play Console → upload the `.aab` to **Closed testing** → store listing:
   - Short description: *Your whole day on one screen. No ads, ever.*
   - Full description: from `manifest.json` description, plus the card list.
   - Screenshots: `screenshots/phone-*.png`. Icon: `icon-512.png`. Feature graphic 1024x500 (Claude can make one).
   - Privacy policy URL: `https://smarvel1963-ops.github.io/dayhub/privacy.html`
   - **Data safety form:** data stays on the device. Optional: Google sign-in (calendar/backup), AI text sent to
     process a request, not stored, not shared for ads. Mirror privacy.html exactly.
   - Content rating questionnaire → Everyone / Teen. Target audience 13+.
   - Payments: Pro is bought on Whop's website, **not inside the app**. Google's payments policy restricts
     in-app links to outside purchase pages for digital features. **Re-check the current Play payments /
     external-link policy at submission time.** It has changed several times. The safe default: the Play
     listing is free, the app shows no Buy button there, and a Whop purchase (the buyer's email) still unlocks Pro.
     **Decision for Scott at that point.**
5. After the 14-day closed test → **Production** → submit for review.
6. Put the listing URL in `features.js` → `PLAN.PLAY_STORE_URL`, flip `STORE` (see LAUNCH_SWITCHES.md).

## Verify
- Install from the Play listing on an Android phone: Day Hub opens full-screen with **no address bar**. If the
  address bar shows, assetlinks.json is wrong or missing.
- Data on that phone is separate from the browser-installed copy (Android keeps them apart). Use ⚙ → backup
  to carry data across.
