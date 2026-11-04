"""
SAVE AS: test_remove_erase.py   LOCATION: C:/MarvelApps/dayhub/tests/test_remove_erase.py

Scott 11/03 "Yes, fix them". REMOVE: a Hub riding on Day Hub Pro keeps a copy of the unlock, and Remove there freed the WHOLE phone for
that buyer at the relay, so Day Hub dropped off Pro while they were still paying. Remove now lives in one place (Day Hub) for that
unlock and takes the email off every Hub here. ERASE: the button and the privacy pages say it forgets purchase emails for every Hub
app on the phone, and it only cleared the Hub it was tapped in.
Drives the real app with the main suite's helpers (run_tests.py: fake network, frozen clock 2026-10-01 08:00 CT).

RUN:   python tests/test_remove_erase.py      (from C:/MarvelApps/dayhub)   Exit 0 = all passed.
"""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import run_tests as T
from playwright.sync_api import sync_playwright

OK = FAIL = 0
def check(name, cond, extra=""):
    global OK, FAIL
    if cond: OK += 1; print(f"  PASS  {name}")
    else: FAIL += 1; print(f"  FAIL  {name}  {extra}")

B = "buyer@example.com"
DAY = 86400000
RIDERS = ((T.CRUISE, "Cruise Hub", "cruisehub"), (T.TRIP, "Trip Hub", "triphub"), (T.HOMEP, "Home Hub", "homehub"), (T.AUTOP, "Auto Hub", "autohub"), (T.MONEYP, "Money Hub", "moneyhub"), (T.HEALTHP, "Health Hub", "healthhub"))


def put(key, buyer=B, ok=True, days_ago=0, product="dayhub", status="active", until="null"):
    return (f"localStorage.setItem('{key}', JSON.stringify({{ buyer: '{buyer}', ok: {str(ok).lower()}, checked: Date.now() - {days_ago} * {DAY}, "
            f"status: '{status}', until: {until}, product: '{product}' }}))")
def rec(a, key): return a.js(f"JSON.parse(localStorage.getItem('{key}') || 'null')")
def released(a, n0=0): return [x for x in getattr(a.ctx, "_relay", [])[n0:] if x.get("task") == "release"]
def settings(a): a.js("openSettings()"); a.page.wait_for_timeout(200); return a.page.inner_text("#proBox")


def main():
    srv, base = T.serve()
    with sync_playwright() as p:
        b = p.chromium.launch()

        print("\n[1. A Hub riding on Day Hub Pro, with its own copy of the unlock: no Remove here, Check now stays]")
        for path, nm, key in RIDERS:
            a = T.App(b, base, path=path)
            a.js(put("dayhub.pro")); a.js(put(f"{key}.pro"))
            pb = settings(a)
            check(f"{nm}: says it's included and where to remove it", "Included with your Day Hub Pro" in pb and "Remove in Day Hub" in pb, pb[:200])
            check(f"{nm}: no Remove button that would free the whole phone", not a.js("!!document.querySelector('[data-pro=\"remove\"]')"))
            check(f"{nm}: Check now is there", a.js("!!document.querySelector('[data-pro=\"check\"]')"))
            a.close()
        a = T.App(b, base, path=T.HOMEP)
        a.js(put("dayhub.pro", "Buyer@Example.com")); a.js(put("homehub.pro", B))
        check("same email typed in different capitals is still the same buyer", "Remove in Day Hub" in settings(a))
        a.close()

        print("\n[1b. Renewed after 'set not to renew': Check now clears the notice right away]")
        a = T.App(b, base, path=T.HOMEP)
        soon = "Date.now() + 5 * 86400000"
        a.js(put("dayhub.pro")); a.js(put("homehub.pro", status="canceling", until=soon))
        settings(a)
        check("before: the notice says it's ending", a.js("proEndsIn()") >= 0, a.js("proEndsIn()"))
        n0 = len(getattr(a.ctx, "_relay", []))
        a.page.click('[data-pro="check"]'); a.page.wait_for_timeout(300)
        sent = [x for x in getattr(a.ctx, "_relay", [])[n0:] if x.get("task") == "verify"]
        check("Check now asks about the Day Hub buyer", len(sent) == 1 and sent[0].get("buyer") == B and sent[0].get("app") == "homehub", sent)
        check("after: no more 'ends' notice", a.js("proEndsIn()") < 0 and rec(a, "homehub.pro")["status"] == "active", rec(a, "homehub.pro"))
        a.close()
        a = T.App(b, base, path=T.HOMEP)
        a.js(put("dayhub.pro")); a.js(put("homehub.pro", "typo@example.com", ok=False, status="not found"))
        settings(a)
        check("an old wrong email in this Hub, Day Hub Pro good: still included", "Included with your Day Hub Pro" in a.page.inner_text("#proBox"))
        a.page.click('[data-pro="check"]'); a.page.wait_for_timeout(300)
        check("Check now replaces it with the Day Hub buyer", rec(a, "homehub.pro")["buyer"] == B and rec(a, "homehub.pro")["ok"] is True, rec(a, "homehub.pro"))
        a.close()

        print("\n[1c. Check now, the other ways it can go]")
        a = T.App(b, base, path=T.CRUISE)
        a.js(put("dayhub.pro")); settings(a)
        a.page.click('[data-pro="check"]'); a.page.wait_for_timeout(300)
        t = a.page.inner_text("#toast")
        check("no copy here yet: it checks the Day Hub buyer and the toast names the plan they bought", rec(a, "cruisehub.pro")["buyer"] == B and "Day Hub Pro unlocked" in t and "Cruise Hub Pass" not in t, t)
        a.close()
        a = T.App(b, base, path=T.CRUISE)
        a.js(put("dayhub.pro")); a.js(put("cruisehub.pro", "cruiser@example.com", ok=False, status="not found", product="cruisehub")); settings(a)
        a.page.click('[data-pro="check"]'); a.page.wait_for_timeout(300)
        check("a Hub-only plan under its own email is checked as itself, never swapped for the Day Hub email", rec(a, "cruisehub.pro")["buyer"] == "cruiser@example.com" and rec(a, "cruisehub.pro")["ok"] is True, rec(a, "cruisehub.pro"))
        a.close()
        a = T.App(b, base, path=T.HOMEP)
        a.js(put("dayhub.pro", "gone@example.com")); settings(a)
        a.page.click('[data-pro="check"]'); a.page.wait_for_timeout(300)
        pb = a.page.inner_text("#proBox")
        check("the relay says no: it says so and points to Day Hub, where the email can change", "Open Day Hub and tap Check now" in pb, pb[:260])
        check("...still on through Day Hub's record, with nothing lost", a.js("isPro()") and rec(a, "dayhub.pro")["buyer"] == "gone@example.com")
        a.close()
        a = T.App(b, base, path=T.HOMEP)
        a.ctx._codes = True
        a.js(put("dayhub.pro")); settings(a)
        a.page.click('[data-pro="check"]'); a.page.wait_for_timeout(400)
        pb = a.page.inner_text("#proBox")
        check("the relay wants a code: the code box shows here", "6-digit code" in pb and a.js("!!document.querySelector('#proBox form[data-codeform]')"), pb[:260])
        check("...and Pro stays on meanwhile", a.js("isPro()"))
        a.close()

        print("\n[2. Its own unlock under ANOTHER email: Remove stays, and touches only that email]")
        a = T.App(b, base, path=T.HOMEP)
        a.js(put("dayhub.pro")); a.js(put("homehub.pro", "mine@example.com"))
        pb = settings(a)
        check("Remove is offered for the other email", a.js("!!document.querySelector('[data-pro=\"remove\"]')"), pb[:200])
        n0 = len(getattr(a.ctx, "_relay", []))
        a.page.click('[data-pro="remove"]'); a.page.wait_for_timeout(300)
        rel = released(a, n0)
        check("the relay frees that email only", len(rel) == 1 and rel[0].get("buyer") == "mine@example.com", rel)
        check("Home Hub's copy is gone, Day Hub's unlock stays", rec(a, "homehub.pro") in (None, {}) and rec(a, "dayhub.pro")["buyer"] == B)
        check("still Pro, now through Day Hub", a.js("isPro() && proViaDayHub()") and "Included with your Day Hub Pro" in a.page.inner_text("#proBox"))
        a.close()
        a = T.App(b, base, path=T.CRUISE)
        a.js(put("cruisehub.pro", "pass@example.com", product="cruisehub")); a.js(put("dayhub.pro"))
        settings(a); a.page.click('[data-pro="remove"]'); a.page.wait_for_timeout(300)
        check("a Cruise Hub Pass under its own email: the toast names the Pass", "Cruise Hub Pass removed" in a.page.inner_text("#toast"), a.page.inner_text("#toast"))
        a.close()

        print("\n[3. Remove in Day Hub: one tap, every Hub on this phone]")
        a = T.App(b, base); T.setup(a)
        a.js(f"verifyPro('{B}')"); a.page.wait_for_timeout(200)
        dev = a.js("deviceId()")
        check("(this phone holds a spot at the relay)", dev in getattr(a.ctx, "_devices", set()))
        for k, who, prod in (("homehub.pro", B, "dayhub"), ("cruisehub.pro", "Buyer@Example.COM", "dayhub"), ("moneyhub.pro", B, "moneyhub"), ("autohub.pro", "other@example.com", "autohub")):
            a.js(put(k, who, product=prod))
        a.js("localStorage.setItem('scotthub.look', 'tiles'); localStorage.setItem('hub.geo', '{}')")
        settings(a)
        check("Day Hub says what Remove does", "takes it off every Hub on this phone" in a.page.inner_text("#proBox"), a.page.inner_text("#proBox")[:220])
        n0 = len(getattr(a.ctx, "_relay", []))
        a.page.click('[data-pro="remove"]'); a.page.wait_for_timeout(300)
        rel = released(a, n0)
        check("the relay is told once, for this buyer and this phone", len(rel) == 1 and rel[0].get("buyer") == B and rel[0].get("device") == dev, rel)
        check("the spot is free", dev not in getattr(a.ctx, "_devices", set()))
        check("Day Hub is back to free", not a.js("isPro()") and not rec(a, "dayhub.pro"))
        t = a.page.inner_text("#toast")
        check("the toast says every Hub", "every Hub on this phone that used it" in t, t)
        check("the box keeps the warning about the other paid plan on screen", "Another plan on that email" in a.page.inner_text("#proBox"), a.page.inner_text("#proBox")[:260])
        check("every copy of that email is gone, whatever its capitals or plan", all(not rec(a, k) for k in ("homehub.pro", "cruisehub.pro", "moneyhub.pro")), [rec(a, k) for k in ("homehub.pro", "cruisehub.pro", "moneyhub.pro")])
        check("another email's unlock stays", rec(a, "autohub.pro")["buyer"] == "other@example.com")
        check("nothing else on the phone is touched", a.js("localStorage.getItem('scotthub.look')") == "tiles" and a.js("localStorage.getItem('hub.geo')") == "{}" and a.js("deviceId()") == dev)
        pg = a.ctx.new_page(); pg.goto(base + T.HOMEP, wait_until="load"); pg.wait_for_function("typeof render === 'function'")
        check("Home Hub on the same phone is free again, with no email left behind", pg.evaluate("!isPro() && !proState().buyer && !readPro(DAY_PRO_KEY).buyer"))
        pg.close(); a.close()

        print("\n[4. Day Hub's own record long unopened, the Hub's copy still fresh: Remove is back, and still takes both]")
        a = T.App(b, base, path=T.HOMEP)
        a.js(put("dayhub.pro", days_ago=22)); a.js(put("homehub.pro"))
        settings(a)
        check("Remove is offered (Day Hub's record has aged out)", a.js("!!document.querySelector('[data-pro=\"remove\"]')"), a.page.inner_text("#proBox")[:200])
        n0 = len(getattr(a.ctx, "_relay", []))
        a.page.click('[data-pro="remove"]'); a.page.wait_for_timeout(300)
        check("both records are gone, the relay told once", not rec(a, "homehub.pro") and not rec(a, "dayhub.pro") and len(released(a, n0)) == 1, released(a, n0))
        check("the toast names the plan they bought", "Day Hub Pro removed" in a.page.inner_text("#toast"), a.page.inner_text("#toast"))
        a.close()

        a = T.App(b, base, path=T.CRUISE)
        a.js(put("cruisehub.pro", product="cruisehub")); a.js(put("dayhub.pro", days_ago=22))
        settings(a); a.page.click('[data-pro="remove"]'); a.page.wait_for_timeout(300)
        check("a Hub-only plan removed, an aged Day Hub Pro on the same email goes too: the warning shows", "Another plan on that email" in a.page.inner_text("#proBox") and not rec(a, "dayhub.pro"), a.page.inner_text("#proBox")[:260])
        a.close()

        print("\n[5. The Play app: no Pro word in the toasts]")
        a = T.App(b, base, path="/?src=play"); T.setup(a)
        a.page.click("#settingsBtn"); a.page.wait_for_timeout(200)
        a.page.fill('form[data-proform] [name=key]', B); a.page.click('form[data-proform] button'); a.page.wait_for_timeout(300)
        t = a.page.inner_text("#toast")
        check("unlocking", a.js("isPro()") and "Unlocked on this phone" in t and "Pro" not in t, t)
        a.page.click('[data-pro="remove"]'); a.page.wait_for_timeout(300)
        t = a.page.inner_text("#toast")
        check("removing", not a.js("isPro()") and "Removed from this phone" in t and "Pro" not in t, t)
        a.js(f"verifyPro('{B}')"); a.page.wait_for_timeout(200); a.js(put("homehub.pro")); a.js("drawProBox()"); a.page.wait_for_timeout(100)
        a.page.click('[data-pro="remove"]'); a.page.wait_for_timeout(300)
        t = a.page.inner_text("#toast")
        check("removing from several Hubs", "Removed from every Hub on this phone that used it" in t and "Pro" not in t, t)
        a.close()

        print("\n[5b. An iPhone home-screen app keeps its own storage: nothing claims 'every Hub' there]")
        IPHONE = "Object.defineProperty(navigator, 'standalone', { value: true, configurable: true })"
        a = T.App(b, base); T.setup(a)
        a.js(f"verifyPro('{B}')"); a.page.wait_for_timeout(200)
        a.js(IPHONE + "; openSettings()"); a.page.wait_for_timeout(200)
        t = a.js("document.body.textContent")
        check("Remove doesn't promise every Hub", "takes it off every Hub" not in t and "frees this phone's spot." in t)
        check("Erase says this app", "forgets saved purchase emails for this app" in t and "for every Hub app" not in t)
        a.close()

        print("\n[6. Erase everything: forgets the purchase email in every Hub, as the button and the privacy pages say]")
        for path, nm, label in ((T.HOMEP, "Home Hub", "homehub"), ("/", "Day Hub", "dayhub")):
            a = T.App(b, base, path=path)
            for k, who in (("dayhub.pro", B), ("homehub.pro", B), ("cruisehub.pro", "pass@example.com"), ("autohub.pro", B), ("familyhub.pro", B)):
                a.js(put(k, who, days_ago=8))            # old enough that a surviving record would be re-checked
            a.js("localStorage.setItem('cruisehub.v1', '{\"keep\":1}'); localStorage.setItem('scotthub.k', 'keep'); localStorage.setItem('scotthub.look', 'tiles'); localStorage.setItem('some.prox', 'keep')")
            dev = a.js("deviceId()")
            shown = "Erase also signs this phone out of Google and forgets saved purchase emails for every Hub app"
            a.js("openSettings()"); a.page.wait_for_timeout(200)
            check(f"{nm}: the promise is there", shown in a.js("document.body.textContent"))
            n0 = len(getattr(a.ctx, "_relay", []))
            a.js("eraseAll(); eraseAll()"); a.page.wait_for_timeout(300)
            left = a.js("Object.keys(localStorage).filter(k => /\\.pro$/.test(k))")
            check(f"{nm}: every Hub's purchase email is gone", left == [], left)
            check(f"{nm}: no longer Pro", not a.js("isPro()"))
            a.js("recheckPro()"); a.page.wait_for_timeout(300)
            check(f"{nm}: no check can write the email back", a.js("!proState().buyer") and not [x for x in getattr(a.ctx, "_relay", [])[n0:] if x.get("task") == "verify"])
            check(f"{nm}: other Hubs' data, Scott Hub and the phone's id stay", a.js("localStorage.getItem('cruisehub.v1')") == '{"keep":1}' and a.js("localStorage.getItem('scotthub.k')") == "keep" and a.js("localStorage.getItem('some.prox')") == "keep" and a.js("deviceId()") == dev)
            a.close()

        print("\n[7. Erase, then Undo; Erase with no signal]")
        a = T.App(b, base); T.setup(a, name="Pat")
        a.js(put("dayhub.pro")); a.js(put("homehub.pro"))
        dev = a.js("deviceId()")
        a.js("eraseAll(); eraseAll()"); a.page.wait_for_timeout(200)
        a.page.click("[data-undo]"); a.page.wait_for_timeout(200)
        check("Undo brings the planner back", a.js("S.name") == "Pat")
        check("...and the emails stay forgotten, as the box says", a.js("Object.keys(localStorage).filter(k => /\\.pro$/.test(k))") == [] and not a.js("isPro()"))
        a.page.click("#settingsBtn"); a.page.wait_for_timeout(200)
        a.page.fill('form[data-proform] [name=key]', B); a.page.click('form[data-proform] button'); a.page.wait_for_timeout(300)
        check("typing it again works, on the same phone id", a.js("isPro()") and a.js("deviceId()") == dev)
        a.close()
        a = T.App(b, base, path=T.HOMEP)
        a.js(put("dayhub.pro")); a.js(put("homehub.pro"))
        a.ctx.set_offline(True)
        a.js("eraseAll(); eraseAll()"); a.page.wait_for_timeout(300)
        check("with no signal Erase still forgets them", a.js("Object.keys(localStorage).filter(k => /\\.pro$/.test(k))") == [])
        a.ctx.set_offline(False); a.close()
        b.close()
    srv.shutdown()
    errs = [e for e in T.ERRORS if "favicon" not in e and "Failed to fetch" not in e and "ERR_INTERNET_DISCONNECTED" not in e]
    check("no page / console errors anywhere", not errs, errs[:5])
    print(f"\n{OK} passed, {FAIL} failed")
    sys.exit(1 if FAIL else 0)


if __name__ == "__main__":
    main()
