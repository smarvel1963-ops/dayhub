# Day Hub launch switches
Save path: C:\MarvelApps\dayhub\docs\LAUNCH_SWITCHES.md · written for v0.40 (2026-10-03)

Scott 10/3: *"make it a workable and saleable project and then have things to turn on once approved."*
Every new piece is built and tested, and sits behind a switch in **`features.js`** that is **OFF**.
While a switch is off, Day Hub works the way v0.39 did. The one visible difference is that new phones
don't see "Connect Gmail" (see GMAIL below).

## Where Day Hub Pro is sold (Scott 10/3), in this order
1. **WHOP FIRST.** Whop sells the Pro *key*. There is nothing to download: buyers open the web app, install it to
   their home screen and paste the key. This is steps 3-4 below.
2. **GOOGLE PLAY SECOND, after about 20-30 paying customers.** A **free** listing, with Pro unlocked by the **same
   Whop key**. Re-check Google Play's billing / external-link policy **at submission time**, because it changes
   (`docs/PLAY_STORE.md`, step 5 below).
3. **APPLE LAST. Parked** (needs a Mac or cloud build + $99/yr). iPhone buyers use the web app from Safari, which works today.

| Switch | Turns on | Waits for |
|---|---|---|
| — | Privacy + Terms pages | Nothing. They are live with v0.40 (step 1). |
| `GMAIL` | "Connect Gmail" for everyone | Google's verification of the Gmail scope (step 2) |
| `PRO_GATE` | Free vs Pro: the ⭐ Day Hub Pro section, and locks Pro features for non-Pro phones | The Whop product + its checkout link (step 3), relay v4 pasted (step 4) |
| `AI_PUBLIC` | The AI helper for Pro (Whop-key) phones | Relay v4 pasted with `AI_PUBLIC=true` (step 4), and Scott's OK on the AI cost |
| `STORE` | "▶ Get it on Google Play" in ⚙ → On your home screen | The Play listing being live (step 5) |

## How to flip a switch
- **Try it on your phone only (safe):** open Day Hub → ⚙ → scroll to the bottom → tap the
  **"Version 0.40."** line **7 times** → **🔧 Owner switches** appears → tick the switch. It applies to
  that phone only (saved in that phone's storage as `dayhub.owner`). Untick it to undo. "Count this phone as
  Pro" makes the phone Pro without a key.
- **Turn it on for everyone:** in `features.js` change `false` to `true`, bump the version in the 3 places
  (README), run `python tests/run_tests.py` (it must end "0 failed"; the test
  "switchboard: all four switches OFF" will fail on purpose, so update it to the new expected state), then push.
- **Your phone is never locked out.** A phone that has the relay passphrase saved counts as Pro, and a phone
  that already connected Gmail keeps Gmail, whatever the switches say.

---

## Step 1: Privacy + Terms are live (no approval needed)
- https://smarvel1963-ops.github.io/dayhub/privacy.html
- https://smarvel1963-ops.github.io/dayhub/terms.html
- Linked from ⚙ (fine print at the bottom: Privacy · Terms · Contact). Contact = smarvel1963@gmail.com.
- **Verify:** open both links on the phone. If a data flow ever changes, change `privacy.html` first.

## Step 2: Google verification (Scott submits; Google decides)
Google Calendar sync and Drive backup work today for Scott and anyone who taps **Continue** on the "Google
hasn't verified this app" screen. For strangers that screen scares them off, and unverified apps are capped
at 100 users. Gmail is a **restricted** scope and needs the full review, usually including a paid yearly
security assessment (CASA). Decide whether Gmail is worth that before submitting it. Calendar and backup
can be verified without Gmail.

Click by click:
1. Open https://console.cloud.google.com/ → top bar → project **day-hub-510322**.
2. ☰ → **APIs & Services** → **OAuth consent screen** (newer screens call it **Google Auth Platform → Branding**).
3. **App name:** Day Hub · **Support email:** smarvel1963@gmail.com · **App logo:** `icon-192.png` from the repo is fine.
4. **App home page:** `https://smarvel1963-ops.github.io/dayhub/`
   **Privacy policy:** `https://smarvel1963-ops.github.io/dayhub/privacy.html`
   **Terms of service:** `https://smarvel1963-ops.github.io/dayhub/terms.html`
5. **Authorized domains:** `smarvel1963-ops.github.io`. Google asks you to prove you own it in Google Search
   Console. Search Console gives you a small `googleXXXX.html` file. **It goes in the
   `smarvel1963-ops.github.io` repo, which also hosts the /join link.** Add ONLY that one file, change
   nothing else, then click Verify. (Claude can do this with you, but only on your go.)
6. **Data access / Scopes:** confirm the list shows `calendar.events` and `drive.appdata` (and
   `gmail.readonly` only if you are doing Gmail). Google shows each scope's class on that page. Trust it over this doc.
7. **Audience → Publish app** (from "Testing" to "In production"), then **Prepare for verification**.
   Google asks for a short YouTube video (it can be unlisted) showing the Google sign-in and what Day Hub does with each
   scope. Record: ⚙ → Connect Google Calendar → the consent screen → an event appearing in the phone calendar.
8. Submit. Google emails smarvel1963@gmail.com with questions or the approval. Calendar and backup usually take days to a few weeks.
   Gmail takes longer and needs the assessment.

**After approval:** for Gmail, flip `GMAIL` (owner switch first on your phone, then `features.js`).
**Verify:** on a phone that never used Day Hub, ⚙ shows **Email → calendar / Connect Gmail**, and the Google
screen no longer says "hasn't verified this app".

## Step 3: Whop product (Scott creates / approves). Channel #1
1. whop.com → your company dashboard → **Products** → **Create product**.
2. Name **Day Hub Pro**. Short description: *Your whole day on one screen. Pro adds the AI helper, two-way
   Google Calendar sync and backup to your own Google Drive. No ads, ever.* Pricing: **$4.99 / month** and
   **$29.99 / year** (two plans). Approved 10/3.
3. Add the **Software licensing** experience (Whop's "license key" app) to the product. **This matters:** Whop
   only gives buyers a license key when the product has it, and the key is what the buyer pastes into Day Hub.
4. Paste the **delivery text** below where Whop shows it to the buyer after purchase (the product's
   welcome / post-purchase message, and the licensing experience's instructions if it has a box for them).
5. Copy the product's checkout link and the product id (`prod_...`).
6. Tell Claude both. Claude puts the link in `features.js` → `PLAN.WHOP_CHECKOUT_URL`, so the **Get Day Hub
   Pro** button in ⚙ → ⭐ Day Hub Pro opens Whop checkout. The id goes in the relay's Script Properties as
   `WHOP_PRODUCT_ID` (step 4).

**Delivery text (paste as-is into Whop):**

> **Thanks for getting Day Hub Pro! ⭐**
>
> **Your license key** is shown on this page (and in your Whop account under this purchase). Copy it, because you'll paste it in step 3.
>
> **1. Open Day Hub on your phone:** https://smarvel1963-ops.github.io/dayhub/
>
> **2. Put it on your home screen (no download, no app store):**
> - **Android (Chrome):** tap the **⋮** menu → **Install app** (or **Add to Home screen**).
> - **iPhone (Safari):** tap **Share** (the square with the arrow) → **Add to Home Screen** → **Add**.
>
> **3. Unlock Pro:** open Day Hub from the new icon → tap **⚙** (top right) → **⭐ Day Hub Pro** → paste your
> license key → **Unlock**. It says *"Day Hub Pro is on"*.
>
> Your plans stay on your phone. Turn on **backup** in ⚙ to keep a copy in your own Google Drive.
> Questions: smarvel1963@gmail.com · Privacy: https://smarvel1963-ops.github.io/dayhub/privacy.html
6. **Verify:** buy it yourself with a 100% promo code and copy the license key from the Whop purchase. On a
   phone **without** the relay passphrase (your phone counts as Pro anyway): owner switch PRO_GATE on → ⚙ →
   ⭐ Day Hub Pro → paste → **Unlock** → "Day Hub Pro is on · key ••1234".

## Step 4: Relay v4 (Scott pastes; about 5 minutes)
The relay source is `relay/Code.gs`. v4 keeps your passphrase working **exactly** as now. The new parts do
nothing until the Script Properties below exist.
1. Open https://script.google.com/ → project **Day Hub AI relay**.
2. Click **Code.gs**, select all, and delete. Paste the whole of `C:\MarvelApps\dayhub\relay\Code.gs`. Then **💾 Save**.
3. ⚙ **Project Settings** → **Script Properties** → **Add script property**:
   - `WHOP_API_KEY` = a Whop company API key (whop.com → dashboard → **Developer** → API keys; the **Admin**
     role is simplest, and it needs at least member read). Paste it yourself. Claude never types keys into web pages.
   - `WHOP_PRODUCT_ID` = the `prod_...` from step 3 (optional, but it stops keys from your other Whop products unlocking Day Hub)
   - `AI_PUBLIC` = `true` **only when you approve AI for paying customers** (leave it out until then)
4. **Deploy → Manage deployments → ✏️ (edit) → Version: New version → Deploy.** Do NOT click "New
   deployment", because that would change the URL that every phone uses.
5. **Verify:** on your phone ⚙ → 🤖 AI helper → **Test it** → "working · N left today" (the passphrase path
   still works). Then the step 3 test (Unlock with a real key) proves `verify`.

Caps: 200 AI requests a day shared by everyone (unchanged) + **30 a day per Pro key**. Change `DAILY_CAP` /
`KEY_CAP` at the top of Code.gs. Cost check before `AI_PUBLIC`: Haiku 4.5 at these caps is pennies per user
per month, but 200/day is the hard ceiling for everyone together, so raise it when there are paying users.

**Then flip `PRO_GATE` + `AI_PUBLIC`** (owner switch first, then `features.js`).
**Verify:** on a fresh phone, ⚙ shows ⭐ Day Hub Pro with the price and the **Get Day Hub Pro** button.
Google Calendar connect says "part of Day Hub Pro". After Unlock, everything works.

## Step 5: Google Play (no account yet). Channel #2, after about 20-30 paying on Whop
A **free** listing; Pro is unlocked by the **same Whop key** (nothing sold inside the Play app).
**Re-check Google Play's payments / external-link policy at submission time** (`docs/PLAY_STORE.md`, step 4).
In short: a $25 Google Play developer account → PWABuilder makes the Android
package from the live site → `assetlinks.json` goes in the `smarvel1963-ops.github.io` repo → closed test
→ production. When the listing is live, put its URL in `PLAN.PLAY_STORE_URL` and flip `STORE`.
**Verify:** on an Android phone in Chrome, ⚙ → On your home screen shows **▶ Get it on Google Play**.

## Apple App Store: parked (channel #3, last)
It needs a Mac or a cloud build service plus $99 a year. iPhone users install from Safari (Share → Add to Home Screen) today.
