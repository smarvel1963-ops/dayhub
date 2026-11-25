"""
SAVE AS: test_appsend.py   LOCATION: C:/MarvelApps/dayhub/tests/test_appsend.py

SEND AN APP, engine 1.78 (Scott 11/24: "all apps at bottom of app list need to be able to forward app install to anyone but sending them
to app on whop"). appsend.js: the last row of every app list. What this proves:
- Every Hub: the Hub family card and Settings -> Hub family end with "Send an app to someone": a list of all 15 Marvel Corp apps (this
  app picked first) and a Send button. No page errors, nothing sideways.
- Send: the phone's share menu gets the app's name, one line and THE LINK - the app's Whop page (Day Hub -> day-hub-pro, Marvel Magic ->
  marvel-magic, Cooking Hub -> cooking-hub-44); an app with no Whop page yet (Home Hub, Photo Hub, UseMart) -> its own page.
- Inside the Google Play app (?src=play): never a Whop link - always the app's own page.
- No share menu on the phone: the link is copied and a note says so.
- The Hubs website (hubs/) has the row under its app list; Scott Hub's Apps list ends with it (app.js) and loads appsend.js.
Drives the real app with the main suite's helpers (fake network, frozen clock).

RUN:   python tests/test_appsend.py      (from C:/MarvelApps/dayhub)   Exit 0 = all passed.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import run_tests as T
from playwright.sync_api import sync_playwright

OK = FAIL = 0
def check(name, cond, extra=""):
    global OK, FAIL
    if cond: OK += 1; print(f"  PASS  {name}", flush=True)
    else: FAIL += 1; print(f"  FAIL  {name}  {extra}", flush=True)

HUBS = {"dayhub": "/", "cruisehub": T.CRUISE, "triphub": T.TRIP, "homehub": T.HOMEP, "autohub": T.AUTOP, "moneyhub": T.MONEYP, "hubuniverse": T.UNIP,
        "healthhub": T.HEALTHP, "familyhub": T.FAMILYP, "pethub": "/../pethub/", "cookinghub": "/../cookinghub/", "jobhub": "/../jobhub/"}
WHOP = "https://whop.com/commander-marvel-por-picks/"
SHARE = "(() => { window.__shared = []; navigator.share = d => { window.__shared.push(d); return Promise.resolve(); }; })()"
NO_SHARE = "(() => { window.__copied = []; try { delete Navigator.prototype.share; } catch (e) {} navigator.share = undefined;" \
           " Object.defineProperty(navigator, 'clipboard', { value: { writeText: t => { window.__copied.push(t); return Promise.resolve(); } } }); })()"
ROWS = """(() => [...document.querySelectorAll('[data-appsend]')].filter(el => el.offsetParent).map(el => ({
  filled: !!el.querySelector('.as-pick') && !!el.querySelector('[data-asgo]'),
  n: el.querySelectorAll('.as-pick option').length, picked: (el.querySelector('.as-pick') || {}).value,
  last: !el.nextElementSibling || el.nextElementSibling.tagName === 'P' })))()"""
errors = []


def page(b, base, path, init=SHARE, width=390):
    ctx = b.new_context(viewport={"width": width, "height": 844}, timezone_id="America/Chicago")
    T.route(ctx); ctx.add_init_script(init)
    pg = ctx.new_page()
    pg.on("pageerror", lambda e: errors.append(f"{path}: {e}"))
    pg.clock.install(time="2026-10-01T08:00:00-05:00")
    pg.goto(base + path)
    return ctx, pg


def ready(pg, ms=8000):
    try: pg.wait_for_function("!!window.appSend", timeout=ms); pg.wait_for_timeout(300); return True
    except Exception: return False


def send(pg, app_id, scope="#famBox"):
    pg.evaluate(f"(() => {{ const el = document.querySelector('{scope} [data-appsend]'); const s = el.querySelector('.as-pick'); s.value = '{app_id}'; el.querySelector('[data-asgo]').click(); }})()")
    pg.wait_for_timeout(200)


def main():
    srv, base = T.serve()
    with sync_playwright() as p:
        b = p.chromium.launch()

        print("\n[1. every Hub: the last row of the Hub family list (card + Settings)]")
        for hid, path in HUBS.items():
            ctx, pg = page(b, base, path)
            if not ready(pg): check(f"{hid}: appsend.js loads", False); ctx.close(); continue
            pg.evaluate("openSettings()")
            pg.wait_for_timeout(400)
            fam = pg.evaluate("(() => { const el = document.querySelector('#famBox [data-appsend]'); return el ? { filled: !!el.querySelector('.as-pick'), n: el.querySelectorAll('.as-pick option').length, picked: el.querySelector('.as-pick') && el.querySelector('.as-pick').value, last: !el.nextElementSibling } : null; })()")
            check(f"{hid}: Settings -> Hub family ends with Send an app (15 apps, this one first)", bool(fam) and fam["filled"] and fam["n"] == 15 and fam["picked"] == hid and fam["last"], fam)
            card = pg.evaluate("(() => { const c = typeof CARDS !== 'undefined' && CARDS.family && CARDS.family.body(); return typeof c === 'string' && c.includes('data-appsend'); })()")
            check(f"{hid}: the Hub family card has the row too", card)
            check(f"{hid}: nothing sideways", not pg.evaluate("document.documentElement.scrollWidth > innerWidth + 1"))
            if hid == "hubuniverse":                                       # its home screen IS an app list (the planets)
                check("hubuniverse: the planets list on Home ends with the row (filled)", pg.evaluate("!!document.querySelector('.uni-home [data-appsend] .as-pick')"))
            ctx.close()

        print("\n[2. Send: the Whop page, or the app's own page]")
        ctx, pg = page(b, base, "/"); ready(pg)
        pg.evaluate("openSettings()"); pg.wait_for_timeout(300)
        for app_id, want in [("dayhub", WHOP + "day-hub-pro"), ("marvelmagic", WHOP + "marvel-magic"), ("cookinghub", WHOP + "cooking-hub-44"),
                             ("homehub", "https://smarvel1963-ops.github.io/homehub/"), ("photohub", "https://smarvel1963-ops.github.io/hubs/photohub/"),
                             ("usemart", "https://usemart.net/#getapp")]:
            send(pg, app_id)
            d = pg.evaluate("window.__shared[window.__shared.length - 1] || {}")
            check(f"{app_id}: the share menu gets its name, a line about it and {want}", d.get("url") == want and d.get("title") and d.get("text", "").startswith(d.get("title", "?")), d)
        ctx.close()

        print("\n[3. inside the Google Play app: never a Whop link]")
        ctx, pg = page(b, base, "/?src=play"); ready(pg)
        pg.evaluate("openSettings()"); pg.wait_for_timeout(300)
        check("the row says it is the Play app", pg.evaluate("(document.querySelector('#famBox [data-appsend]') || {}).dataset.store") == "1")
        send(pg, "dayhub")
        d = pg.evaluate("window.__shared[window.__shared.length - 1] || {}")
        check("Play app: Day Hub goes to its own page, not Whop", d.get("url") == "https://smarvel1963-ops.github.io/dayhub/", d)
        ctx.close()

        print("\n[4. no share menu: the link is copied]")
        ctx, pg = page(b, base, "/", init=NO_SHARE); ready(pg)
        pg.evaluate("openSettings()"); pg.wait_for_timeout(300)
        send(pg, "jobhub"); pg.wait_for_timeout(200)
        cp = pg.evaluate("window.__copied")
        check("copied: the line and the Whop link", bool(cp) and cp[-1].endswith(WHOP + "job-hub-marvel"), cp)
        check("a note says the link was copied", "copied" in pg.evaluate("(document.getElementById('asNote') || {}).textContent || ''"))
        ctx.close()

        print("\n[5. the Hubs website and Scott Hub]")
        ctx, pg = page(b, base, "/../hubs/")
        ok = ready(pg)
        r = pg.evaluate(ROWS) if ok else []
        check("hubs site: Send an app row under the app list (15 apps)", ok and len(r) == 1 and r[0]["filled"] and r[0]["n"] == 15, r)
        send(pg, "familyhub", scope="body")
        d = pg.evaluate("window.__shared[window.__shared.length - 1] || {}") if ok else {}
        check("hubs site: Family Hub -> its Whop page", d.get("url") == WHOP + "family-hub-a5", d)
        ctx.close()
        sh = open(os.path.join(os.path.dirname(T.ROOT), "scotthub", "app.js"), encoding="utf-8").read()
        shi = open(os.path.join(os.path.dirname(T.ROOT), "scotthub", "index.html"), encoding="utf-8").read()
        check("Scott Hub: the Apps list ends with the row and the page loads appsend.js", 'data-appsend=""' in sh and "/dayhub/appsend.js" in shi)

        b.close()
    srv.shutdown()
    real = [e for e in errors if "appsend" in e.lower() or "appSend" in e]
    check("no page errors from appsend.js", not real, real[:3])
    print(f"\n{OK} passed, {FAIL} failed")
    sys.exit(1 if FAIL else 0)


if __name__ == "__main__":
    main()
