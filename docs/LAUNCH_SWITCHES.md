# Day Hub launch switches
Save path: C:\MarvelApps\dayhub\docs\LAUNCH_SWITCHES.md · written for v0.40, unlock reworked to email in v0.41 (2026-10-03)

Scott 10/3: *"make it a workable and saleable project and then have things to turn on once approved."*
Every new piece is built and tested, and sits behind a switch in **`features.js`** that is **OFF**.
While a switch is off, Day Hub works the way v0.39 did. The one visible difference is that new phones
don't see "Connect Gmail" (see GMAIL below).

## Where Day Hub Pro is sold (Scott 10/3), in this order
1. **WHOP FIRST.** Whop sells Pro. There is nothing to download: buyers open the web app, install it to their
   home screen, and unlock with the email they bought with. This is steps 3-4 below.
2. **GOOGLE PLAY SECOND, after about 20-30 paying customers.** A **free** listing, with Pro unlocked by the **same
   Whop purchase** (the buyer's email). Re-check Google Play's billing / external-link policy **at submission time**, because it changes
   (`docs/PLAY_STORE.md`, step 5 below).
3. **APPLE LAST. Parked** (needs a Mac or cloud build + $99/yr). iPhone buyers use the web app from Safari, which works today.

| Switch | Turns on | Waits for |
|---|---|---|
| — | Privacy + Terms pages | Nothing. They are live with v0.40 (step 1). |
| `GMAIL` | "Connect Gmail" for everyone | Google's verification of the Gmail scope (step 2) |
| `PRO_GATE` | Free vs Pro: the ⭐ Day Hub Pro section, and locks Pro features for non-Pro phones | Whop product (DONE 10/3, step 3) + the Whop API key and relay v4 pasted (step 4) |
| `AI_PUBLIC` | The AI helper for Pro phones | Relay v4 pasted with `AI_PUBLIC=true` (step 4), and Scott's OK on the AI cost |
| `STORE` | "▶ Get it on Google Play" in ⚙ → On your home screen | The Play listing being live (step 5) |
| `CRUISE_PASS` | Cruise Hub sells its own **Cruise Hub Pass, $9.99/year** (every cruise that year). Day Hub Pro still unlocks Cruise Hub | The Whop product + relay v5 + `CRUISE_PRODUCT_ID` (step 3b) |

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

## Step 3: Whop product. DONE 10/3 (channel #1)
Scott created it 10/3: **Day Hub Pro**, `prod_xD6LAe50BRN9C`, in **Marvel Corp** (`biz_loYMoMQKy5XhM0`), hidden,
$4.99/month + $29.99/year. Checkout: https://whop.com/commander-marvel-por-picks/day-hub-pro. This is already in
`features.js` (`PLAN.WHOP_CHECKOUT_URL`), so **Get Day Hub Pro** in ⚙ → ⭐ Day Hub Pro opens it.

**No license key.** Whop's app store for Marvel Corp has no software-licensing app (searched 10/3). So (v0.41) the
buyer unlocks with the **email they bought with** on Whop, or, as a fallback, their Whop **membership id**
(`mem_...`, shown on their Whop purchase page). One purchase works on **3 phones** (see step 4 for the limits).

What's left on Whop:
1. **Paste the delivery text** below where Whop shows it after purchase (the product's welcome / post-purchase
   message).
2. When ready to sell: switch the product from **hidden** to visible (after PRO_GATE is on, step 4).
3. **Verify:** buy it yourself with a 100% promo code. On a phone **without** the relay passphrase (your
   phone counts as Pro anyway): owner switch PRO_GATE on → ⚙ → ⭐ Day Hub Pro → type the email you bought with →
   **Unlock** → "Day Hub Pro is on · you@…".

**Delivery text (paste as-is into Whop):**

> **Thanks for getting Day Hub Pro! ⭐**
>
> **1. Open Day Hub on your phone:** https://smarvel1963-ops.github.io/dayhub/
>
> **2. Put it on your home screen (no download, no app store):**
> - **Android (Chrome):** tap the **⋮** menu → **Install app** (or **Add to Home screen**).
> - **iPhone (Safari):** tap **Share** (the square with the arrow) → **Add to Home Screen** → **Add**.
>
> **3. Unlock Pro:** open Day Hub from the new icon → tap **⚙** (top right) → **⭐ Day Hub Pro** → enter the
> **email you bought with** on Whop → **Unlock**. It says *"Day Hub Pro is on"*.
> (Bought with a different sign-in? Your Whop membership id, which starts with **mem_** and is on your Whop purchase page, works too.)
>
> Works on up to 3 phones. Your plans stay on your phone. Turn on **backup** in ⚙ to keep a copy in your
> own Google Drive. Questions: smarvel1963@gmail.com · Privacy: https://smarvel1963-ops.github.io/dayhub/privacy.html

## Step 3b: Cruise Hub Pass (Scott 10/4: "cruise app 9.99 per year as many cruises as you want that year")
Built in v0.48 behind `CRUISE_PASS` (OFF). Who it unlocks: **Cruise Hub only**. Day Hub Pro unlocks **both** apps;
a Cruise Hub Pass never opens Day Hub or the AI helper (the relay checks which app is asking).

1. **Whop → Marvel Corp → Create product:** name **Cruise Hub Pass**, **$9.99 / year** (renewing yearly),
   hidden for now. Copy its **product id** (`prod_...`) and its **checkout link**.
2. **Relay v5:** https://script.google.com/ → **Day Hub AI relay** → Code.gs → select all, delete, paste the whole
   of `C:\MarvelApps\dayhub\relay\Code.gs` → 💾 Save. **Project Settings → Script Properties → Add**:
   `CRUISE_PRODUCT_ID` = the `prod_...` from step 1 → Save. Then **Deploy → Manage deployments → ✏️ → Version: New
   version → Deploy** (NOT "New deployment"). v5 changes nothing for Day Hub Pro.
3. **Tell Claude the checkout link** → it goes in `PLAN.CRUISE_CHECKOUT_URL` (features.js).
4. **Verify** (100% promo code purchase): on a phone **without** the relay passphrase, Cruise Hub → ⚙ → 7 taps on the
   version line → owner switch **Cruise Hub Pass** on → ⭐ Cruise Hub Pass → the email you bought with → **Unlock** →
   "Cruise Hub Pass is on". Then open Day Hub on that phone: it must still say **Day Hub Pro**, not Pro.
5. Flip `CRUISE_PASS` in `features.js` (Claude), un-hide the Whop product.

**Delivery text for the Cruise Hub Pass (paste into Whop):**

> **Thanks for getting the Cruise Hub Pass! 🚢** Plan as many cruises as you like this year.
>
> **1. Open Cruise Hub on your phone:** https://smarvel1963-ops.github.io/cruisehub/
>
> **2. Put it on your home screen:** Android (Chrome): **⋮** → **Install app**. iPhone (Safari): **Share** →
> **Add to Home Screen** → **Add**.
>
> **3. Unlock:** open Cruise Hub from the new icon → **⚙** → **⭐ Cruise Hub Pass** → the **email you bought with**
> on Whop → **Unlock**.
>
> Works on up to 3 phones. Not affiliated with any cruise line. Questions: smarvel1963@gmail.com

## Step 4: Whop API key + relay v4 (Scott; about 10 minutes)
**4a. Make the Whop API key** (whop.com → the **Marvel Corp** business dashboard → **Developer** → **API keys** →
**Create**). Tick exactly these scopes, because they are what the docs list for the two lookups the relay makes:
- `member:basic:read`
- `member:email:read`
- `member:phone:read` (Whop's docs list it as required for *List members*, the email search, even though Day Hub never reads phones)

Copy the key. Paste it only into Script Properties (4b). Claude never types keys into web pages.

**4b. Paste the relay.** The source is `relay/Code.gs`. v4 keeps your passphrase working **exactly** as now.
The new parts do nothing until the Script Properties below exist.
1. Open https://script.google.com/ → project **Day Hub AI relay**.
2. Click **Code.gs**, select all, and delete. Paste the whole of `C:\MarvelApps\dayhub\relay\Code.gs`. Then **💾 Save**.
3. ⚙ **Project Settings** → **Script Properties** → **Add script property**:
   - `WHOP_API_KEY` = the key from 4a
   - `WHOP_PRODUCT_ID` = `prod_xD6LAe50BRN9C`
   - (`WHOP_COMPANY_ID` is not needed. Marvel Corp `biz_loYMoMQKy5XhM0` is built in.)
   - `AI_PUBLIC` = `true` **only when you approve AI for paying customers** (leave it out until then)
4. **Deploy → Manage deployments → ✏️ (edit) → Version: New version → Deploy.** Do NOT click "New
   deployment", because that would change the URL that every phone uses.
5. **Verify:** on your phone ⚙ → 🤖 AI helper → **Test it** → "working · N left today" (the passphrase path
   still works). Then the step 3 test (Unlock with your email) proves the Whop lookup.

**How the check works** (Whop API docs, read 10/3): *List memberships* has **no email filter**, so the relay
calls `GET /members?query=<email>` ("search members by name, username, or email"), keeps only an **exact** email
match, then `GET /memberships?user_ids=…&product_ids=prod_xD6LAe50BRN9C` and requires status active, trialing,
past_due or canceling. The `mem_` fallback is `GET /memberships/{mem_id}`. Product and status are re-checked in the
relay, so a filter Whop ignores can't unlock anything. **This has not been run against the live Whop API yet.**
The first real Unlock (step 3) is the test. If it says "Whop refused the relay's key", the scopes are wrong.

**Limits, honestly:**
- **3 phones per purchase.** Each phone makes a random id. The relay keeps, per buyer, a scrambled (one-way) form of
  their Whop user id with up to 3 phone ids and the day each was last seen (Script Properties, never the email). A 4th
  phone is refused with "already on 3 phones". **Remove from this phone** frees a spot, and a phone unseen for 60
  days frees its spot by itself.
- It stops casual sharing, not a determined person: someone who knows a buyer's email can use one of the 3 spots,
  and clearing a phone's browser data makes a new phone id (spot freed after 60 days). Raising security means a
  sign-in (a Whop login or an emailed code), which is a later step if sharing shows up in the numbers.
- Anyone can ask the relay "is this email a Day Hub Pro buyer?" (it answers yes or no, nothing else). Fine at this size.
- A good answer is cached 6 hours, so a refund or cancel takes up to 6 hours, plus the phone's weekly re-check,
  to lock. Grace when the check can't be reached: 14 days.

Caps: 200 AI requests a day shared by everyone (unchanged) + **30 a day per Pro buyer**. Change `DAILY_CAP` /
`BUYER_CAP` / `MAX_PHONES` at the top of Code.gs (and `PLAN.MAX_PHONES` in features.js to match the text).
Cost check before `AI_PUBLIC`: Haiku 4.5 at these caps is pennies per user per month, but 200/day is the
hard ceiling for everyone together, so raise it when there are paying users.

**Then flip `PRO_GATE` + `AI_PUBLIC`** (owner switch first, then `features.js`), and un-hide the Whop product.
**Verify:** on a fresh phone, ⚙ shows ⭐ Day Hub Pro with the price and the **Get Day Hub Pro** button (it opens
Whop). Google Calendar connect says "part of Day Hub Pro". After Unlock, everything works.

## Step 5: Google Play (no account yet). Channel #2, after about 20-30 paying on Whop
A **free** listing; Pro is unlocked by the **same Whop purchase** (nothing sold inside the Play app).
**Re-check Google Play's payments / external-link policy at submission time** (`docs/PLAY_STORE.md`, step 4).
In short: a $25 Google Play developer account → PWABuilder makes the Android
package from the live site → `assetlinks.json` goes in the `smarvel1963-ops.github.io` repo → closed test
→ production. When the listing is live, put its URL in `PLAN.PLAY_STORE_URL` and flip `STORE`.
**Verify:** on an Android phone in Chrome, ⚙ → On your home screen shows **▶ Get it on Google Play**.

## Apple App Store: parked (channel #3, last)
It needs a Mac or a cloud build service plus $99 a year. iPhone users install from Safari (Share → Add to Home Screen) today.
