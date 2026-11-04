"""
SAVE AS: test_update_ready.py   LOCATION: C:/MarvelApps/dayhub/tests/test_update_ready.py

Scott 11/03: "scott hub never got the down load for amazing new look we built" + "same for the others ... show on front screen
update ready". A phone resumes an app left open on its old code, and version.json is how it finds out. The RELEASE RULE in app.js
says every push bumps the version; the 12 commits from 10/22 to 11/03 didn't, so no phone was told about any of them.
Covers every Hub on the web and on Play, plus both new looks: Update ready is on the front screen with no scrolling, tapping it
reloads, it stays away when nothing is new, What's New shows after updating, and this release's notes keep to the Play wording rule.

RUN:   python tests/test_update_ready.py      (from C:/MarvelApps/dayhub)   Exit 0 = all passed.
"""
import json, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import run_tests as T
from playwright.sync_api import sync_playwright

OK = FAIL = 0
def check(name, cond, extra=""):
    global OK, FAIL
    if cond: OK += 1; print(f"  PASS  {name}")
    else: FAIL += 1; print(f"  FAIL  {name}  {extra}")

HUBS = (("/", "Day Hub"), (T.CRUISE, "Cruise Hub"), (T.TRIP, "Trip Hub"), (T.HOMEP, "Home Hub"), (T.AUTOP, "Auto Hub"), (T.MONEYP, "Money Hub"), (T.HEALTHP, "Health Hub"), (T.UNIP, "Hub Universe"))
FORMS = ("setup", "homesetup", "autosetup", "mhsetup", "hhsetup")
WHERE = """(() => { const c = [...document.querySelectorAll('[data-update]')].find(x => x.offsetWidth); if (!c) return null; window.scrollTo(0, 0); const r = c.getBoundingClientRect();
  return { text: c.innerText, top: Math.round(r.top), bottom: Math.round(r.bottom), h: innerHeight, shown: !!c.offsetWidth }; })()"""


def welcome(a):
    """Past the welcome form, the way a person would."""
    for k in FORMS:
        f = f"form[data-{k}]"
        if a.js(f"!!document.querySelector('{f}')"):
            for name, v in (("name", "Pat"), ("city", "83702"), ("year", "2020"), ("make", "Ford"), ("model", "Mustang")):
                if a.js(f"!!document.querySelector('{f} [name={name}]')"): a.page.fill(f"{f} [name={name}]", v)
            a.page.click(f"{f} button"); a.page.wait_for_timeout(400)
    if a.js("typeof briefOpen === 'function' && briefOpen()"): a.page.click('[data-brief="go"]')
    return not a.js("!!document.querySelector('form[data-setup], form[data-homesetup], form[data-autosetup], form[data-mhsetup], form[data-hhsetup]')")


def front_screen(b, base, path, label):
    a = T.App(b, base, path=path)
    check(f"{label}: past the welcome", welcome(a))
    if a.js("typeof shellGo === 'function' && !!document.getElementById('tabbar')"): a.js("shellGo('home')")   # a new look's front screen is its Home tab
    a.js("checkUpdate()"); a.page.wait_for_timeout(200)
    check(f"{label}: nothing new, nothing shown", a.js(WHERE) is None, a.js(WHERE))
    a.ctx._version = {"version": "0.1", "notes": {"0.1": ["Old"]}}
    a.js("checkUpdate()"); a.page.wait_for_timeout(200)
    check(f"{label}: an older copy (a phone can be handed one offline) shows nothing", a.js(WHERE) is None, a.js(WHERE))
    a.ctx._version = {"version": "9.9", "notes": {"9.9": ["Test"]}}
    a.js("checkUpdate()"); a.page.wait_for_timeout(300)
    w = a.js(WHERE)
    check(f"{label}: Update ready is on the front screen, no scrolling", bool(w) and w["shown"] and "Update ready" in w["text"] and w["top"] >= 0 and w["bottom"] <= w["h"], w)
    if w and w["shown"]:
        a.js("""(() => { window.__old = 1; const f = window.fetch; window.fetch = (u, o) => { if (o && o.cache === 'reload') sessionStorage.setItem('fresh', (sessionStorage.getItem('fresh') || '') + ' ' + String(u)); return f(u, o); }; })()""")
        a.page.click("[data-update]:visible", force=True); a.page.wait_for_timeout(1000)   # it pulses on purpose, so never "stable"
        check(f"{label}: tapping it reloads the app", a.js("window.__old === undefined"))
        check(f"{label}: ...after fetching its own files fresh, past the browser's cache", "/dayhub/app.js" in a.js("sessionStorage.getItem('fresh') || ''"), a.js("sessionStorage.getItem('fresh')"))
    a.close()


def main():
    srv, base = T.serve()
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    ver = json.load(open(os.path.join(root, "version.json"), encoding="utf-8"))
    app = open(os.path.join(root, "app.js"), encoding="utf-8").read()
    sw = open(os.path.join(root, "sw.js"), encoding="utf-8").read()

    print("\n[The release itself]")
    v = ver["version"]
    check("version the same in app.js, version.json and sw.js, and it's text", isinstance(v, str) and f'const VERSION = "{v}"' in app and f'"dayhub-v{v}"' in sw, v)
    notes = ver["notes"].get(v, [])
    check("this release says what's new", len(notes) > 0)
    bad = [n for n in notes if re.search(T.PLAY_BAD[1:-2], n, re.I)]
    check("its notes keep to the Play wording rule (they show in the Play app too)", not bad, bad)

    with sync_playwright() as p:
        b = p.chromium.launch()
        print("\n[Every Hub, web + Play]")
        for path, nm in HUBS:
            front_screen(b, base, path, nm)
            front_screen(b, base, path + "?src=play", f"Play {nm}")

        print("\n[The new looks, on a phone that opened the preview]")
        front_screen(b, base, "/?look=tiles", "Day Hub new look")
        front_screen(b, base, T.CRUISE + "?look=tiles", "Cruise Hub new look")

        print("\n[Simple mode: Cruise + Trip hide the hero's chips, so it carries its own]")
        for path, nm in ((T.CRUISE, "Cruise Hub"), (T.TRIP, "Trip Hub")):
            a = T.App(b, base, path=path); welcome(a)
            a.js("S.simple = true; save(); shellGo('home')"); a.page.wait_for_timeout(150)
            a.js("checkUpdate()"); a.page.wait_for_timeout(200)
            check(f"{nm} Simple mode: nothing new, nothing shown", a.js(WHERE) is None)
            a.ctx._version = {"version": "9.9", "notes": {"9.9": ["Test"]}}
            a.js("checkUpdate()"); a.page.wait_for_timeout(300)
            w = a.js(WHERE)
            check(f"{nm} Simple mode: Update ready is on the front screen", bool(w) and w["shown"] and "Update ready" in w["text"] and w["top"] >= 0 and w["bottom"] <= w["h"], w)
            a.close()

        print("\n[What's New reaches back over old releases: the Play app keeps to its wording rule]")
        OLD_NOTE = {"version": v, "notes": {v: ["A plain note"], "1.55": ["Cruise Hub Pro is $2.99/month with 30 days free"]}}
        for suffix, shows in (("", True), ("?src=play", False)):
            a = T.App(b, base, path=T.CRUISE + suffix); welcome(a); a.js("shellGo('home')")
            a.ctx._version = OLD_NOTE
            a.js("S.seenVersion = '1.0'; saveLocal(); checkUpdate()"); a.page.wait_for_timeout(300)
            w = a.js("(document.querySelector('.whatsnew') || {}).innerText || ''")
            check(f"{'Play' if suffix else 'web'} Cruise Hub: the plain note shows, the price line {'shows' if shows else 'does not'}", "A plain note" in w and ("$2.99" in w) == shows, w[:220])
            a.close()
        a = T.App(b, base, path=T.HOMEP); welcome(a)
        a.ctx._version = {"version": "1.58", "notes": {"1.58": ["Old"]}}
        a.js("S.seenVersion = '1.58'; saveLocal(); checkUpdate()"); a.page.wait_for_timeout(300)
        check("a stale copy without this release doesn't use up What's New", a.js("S.seenVersion") == "1.58", a.js("S.seenVersion"))
        a.close()

        print("\n[The real worker on each Hub: one shared address, and every Hub's cache holds ../dayhub/ files]")
        for path, key in (("/", "dayhub"), (T.CRUISE, "cruisehub"), (T.TRIP, "triphub"), (T.HOMEP, "homehub"), (T.AUTOP, "autohub"), (T.MONEYP, "moneyhub"), (T.HEALTHP, "healthhub"), (T.UNIP, "hubuniverse")):
            srv2, base2 = T.serve()                                   # its own server, so "offline" can really mean the network is gone
            ctx = b.new_context()
            ctx.add_init_script("if (self.caches && !sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', 1); caches.open('other-v1').then(c => c.put(new URL('/dayhub/app.js', location.href), new Response('window.__WRONG = 1;', { headers: { 'Content-Type': 'text/javascript' } }))); caches.open('%s-v0'); }" % key)
            pg = ctx.new_page(); pg.goto(base2 + path, wait_until="load")
            keys = []
            for _ in range(60):
                keys = pg.evaluate("caches.keys()")
                if f"{key}-v0" not in keys and any(k.startswith(key + "-v") for k in keys): break
                pg.wait_for_timeout(250)
            check(f"{key}: a new worker clears its own old copy and leaves other Hubs' alone", f"{key}-v0" not in keys and any(k.startswith(key + "-v") for k in keys) and "other-v1" in keys, keys)
            pg.evaluate("navigator.serviceWorker.ready.then(() => new Promise(r => navigator.serviceWorker.controller ? r() : navigator.serviceWorker.addEventListener('controllerchange', r)))")
            pg.evaluate("fetch('../dayhub/version.json?x=1', { cache: 'no-store' }).then(r => r.text())"); pg.wait_for_timeout(300)
            stored = pg.evaluate("caches.keys().then(ks => Promise.all(ks.map(k => caches.open(k).then(c => c.keys())))).then(l => l.flat().map(q => q.url))")
            check(f"{key}: the update check never piles up in the cache", not any("version.json?x=" in u for u in stored))
            ctx.new_cdp_session(pg).send("Network.clearBrowserCache")   # or the browser answers from its own cache and the worker never falls back
            srv2.shutdown(); srv2.server_close()                      # the network is gone
            got = pg.evaluate("fetch('../dayhub/app.js', { cache: 'reload' }).then(r => r.ok).catch(() => 'failed')")
            check(f"{key}: a fresh fetch that fails really fails, the worker doesn't hide it behind its old copy", got == "failed", got)
            pg.reload(wait_until="load"); pg.wait_for_timeout(600)
            check(f"{key}: offline, it runs its own copy, not another Hub's", pg.evaluate("window.__WRONG === undefined && typeof render === 'function'"), pg.evaluate("[typeof window.__WRONG, typeof render]"))
            ctx.close()

        print("\n[A weak signal: half new, half old files could break the app, so it stays as it is]")
        for stub, nm in (("() => new Promise(() => {})", "a stalled network"), ("() => Promise.reject(new TypeError('no signal'))", "a failed fetch")):
            a = T.App(b, base); welcome(a)
            a.ctx._version = {"version": "9.9", "notes": {"9.9": ["Test"]}}
            a.js("checkUpdate()"); a.page.wait_for_timeout(300)
            a.js(f"(() => {{ window.__old = 1; window.__real = window.fetch; window.fetch = {stub}; }})()")
            a.page.click("[data-update]:visible", force=True); a.page.wait_for_timeout(100)
            a.page.click("[data-update]:visible", force=True); a.page.wait_for_timeout(100)
            a.page.clock.fast_forward(9000); a.page.wait_for_timeout(300)
            check(f"{nm}: no reload, it says so, and it can be tapped again", a.js("window.__old") == 1 and "Weak signal" in a.page.inner_text("#toast") and a.js("UPDATING") is False, a.page.inner_text("#toast"))
            a.js("(() => { window.fetch = window.__real; })()"); a.close()

        print("\n[After updating: What's New, each Hub's own notes]")
        for path, nm, mine, other in ((T.HOMEP, "Home Hub", "turned on in Day Hub", "change your pay"), (T.MONEYP, "Money Hub", "change your pay", "turned on in Day Hub"), (T.TRIP, "Trip Hub", "trips read like trips", "turned on in Day Hub")):
            a = T.App(b, base, path=path); welcome(a)
            a.js("S.seenVersion = '1.58'; saveLocal(); checkUpdate()"); a.page.wait_for_timeout(300)
            w = a.js("(document.querySelector('.whatsnew') || {}).innerText || ''")
            check(f"{nm}: What's New shows its own note and the shared ones, not another Hub's", mine in w and "Safer backup" in w and other not in w, w[:300])
            a.close()
        b.close()
    srv.shutdown()
    errs = [e for e in T.ERRORS if "favicon" not in e and "Failed to fetch" not in e]
    check("no page / console errors anywhere", not errs, errs[:5])
    print(f"\n{OK} passed, {FAIL} failed")
    sys.exit(1 if FAIL else 0)


if __name__ == "__main__":
    main()
