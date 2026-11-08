"""
SAVE AS: test_hub_opening.py   LOCATION: C:/MarvelApps/dayhub/tests/test_hub_opening.py

THE OPENING, every Hub and every look (Scott 11/08: "we need the pretty parts of opening screen to show then pan to bottom half of screen you use", "that first page
look makes or breaks the app", "all our apps", "when we open front page it need to loook appealing and useful"; shell.js hubPanOpen).
Checks: each Hub holds at the top on its art, then glides until the useful part is at the top of the phone (or the page runs out); a finger, a scroll or a key stops it;
it waits behind something open on top; never on a setup screen, an update note or another tab; coming back after 10 minutes opens again; reduced motion stays put; the
Family Hub picture shows whole; no page errors. Saves the before / after pictures.

RUN:   python tests/test_hub_opening.py      (from C:/MarvelApps/dayhub)   Exit 0 = all passed.
"""
import os, sys, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import run_tests as T, test_family_sync as FS
import test_day_tiles as D, test_cruise_tiles as C, test_trip_tiles as R, test_home_tiles as H, test_auto_tiles as A, test_money_tiles as M, test_health_tiles as W
from playwright.sync_api import sync_playwright

OK = FAIL = 0
def check(name, cond, extra=""):
    global OK, FAIL
    if cond: OK += 1; print(f"  PASS  {name}")
    else: FAIL += 1; print(f"  FAIL  {name}  {extra}")

SHOTS = os.environ.get("HUB_SHOTS", "")
TOP = "window.scrollY"
def arm(a):
    """The glide is off under test robots (it would move the page under the other 1,400 checks): this phone asks for it, and starts fresh at the top."""
    a.ctx.add_init_script("window.__HUB_PAN = true;")
    a.page.reload(); a.page.wait_for_function("typeof render === 'function' && typeof hubPanOpen === 'function'")
    a.page.wait_for_load_state("load")
    return a
def useful_top(a, sel):
    return a.js(f"(() => {{ const e = document.querySelector({json.dumps(sel)}); return e ? Math.round(e.getBoundingClientRect().top) : null; }})()")
def at_end(a): return a.js("Math.abs(window.scrollY - (document.documentElement.scrollHeight - innerHeight)) < 3")

def opens(b, name, make, sel, bar=0):
    a = arm(make())
    a.page.wait_for_timeout(250)
    if a.js("typeof briefOpen === 'function' && briefOpen()"): a.page.click('[data-brief="go"]')
    a.js("window.scrollTo({ top: 0, behavior: 'instant' }); hubPanStart(1100); 0")   # the same start, the morning brief out of the way
    a.page.wait_for_timeout(500)
    check(f"{name}: opens at the top, on its art", a.js(TOP) == 0, a.js(TOP))
    if SHOTS: a.page.screenshot(path=os.path.join(SHOTS, f"{name}_1.png"))
    try: a.page.wait_for_function("window.scrollY > 5", timeout=5000); moved = True
    except Exception: moved = False
    a.page.wait_for_timeout(1500)
    y, top = a.js(TOP), useful_top(a, sel)
    good = moved and y > 5 and top is not None and (abs(top - (bar + 12)) <= 8 or at_end(a))
    check(f"{name}: glides to the useful part", good, [moved, y, top])
    if SHOTS: a.page.screenshot(path=os.path.join(SHOTS, f"{name}_2.png"))
    a.ctx.close()

def main():
    srv, base = T.serve()
    with sync_playwright() as p:
        b = p.chromium.launch()
        before = len(T.ERRORS)
        print("\n[Every Hub, the look customers have and the new looks]")
        def family():
            a = FS.phone(b, base, FS.Fake(), "uidA"); a.js(FS.SEED); return a
        for name, make, sel, bar in [("day", lambda: D.phone(b, base, path="/"), "#cards", 0), ("day_new", lambda: D.phone(b, base), ".dt-home", 0),
                ("cruise", lambda: C.cruise(b, base, look=None), "#cards", 0), ("cruise_new", lambda: C.cruise(b, base), ".ct-main", 0),
                ("trip", lambda: R.trip(b, base, look=None), "#cards", 0), ("trip_new", lambda: R.trip(b, base), ".tt-main", 0),
                ("home", lambda: H.home(b, base, look=None), "#cards", 0), ("home_new", lambda: H.home(b, base), ".ht-main", 0),
                ("auto", lambda: A.app(b, base, look=None), "#cards", 0), ("auto_new", lambda: A.app(b, base), ".at-next", 0),
                ("money", lambda: M.money(b, base, look=None), "#cards", 0), ("money_new", lambda: M.money(b, base), ".mt-grid", 0),
                ("health", lambda: W.health(b, base, look=None), "#cards", 0), ("health_new", lambda: W.health(b, base), ".hw-grid", 0),
                ("family", family, ".fh-faces2", 62)]:
            try: opens(b, name, make, sel, bar)
            except Exception as e: check(f"{name}: ran", False, str(e)[:300])

        print("\n[The real opening, and what stops it]")
        def fam(fresh=True):
            a = arm(family()); a.page.wait_for_timeout(100)
            if fresh: a.js("window.scrollTo({ top: 0, behavior: 'instant' }); 0")
            return a
        a = fam(); a.page.wait_for_timeout(3600)
        check("opening the app runs it by itself", a.js(TOP) > 5, a.js(TOP)); a.ctx.close()
        a = fam(); a.js("hubPanStart(900); 0"); a.page.wait_for_timeout(200); a.page.mouse.wheel(0, 1); a.page.wait_for_timeout(2300)
        check("a scroll stops it", a.js("window.scrollY") <= 3 and not a.js("HP_LIVE"), a.js(TOP)); a.ctx.close()
        a = fam(); a.js("hubPanStart(900); 0"); a.page.wait_for_timeout(200); a.js("window.dispatchEvent(new Event('touchstart')); 0"); a.page.wait_for_timeout(1900)
        check("a finger stops it", a.js(TOP) == 0); a.ctx.close()
        a = fam(); a.js("hubPanStart(1200); 0"); a.page.wait_for_timeout(1500); y0 = a.js(TOP); a.js("window.dispatchEvent(new Event('touchstart')); 0"); a.page.wait_for_timeout(120); y1 = a.js(TOP); a.page.wait_for_timeout(900)
        check("a finger stops it mid-glide, right where it is", a.js(TOP) == y1, [y0, y1, a.js(TOP)]); a.ctx.close()
        a = fam(); a.js("hubPanStart(600); showFh('more'); 0"); a.page.wait_for_timeout(1500)
        check("it waits behind a page that's open", a.js(TOP) == 0 and a.js("HP_LIVE"))
        a.js("hideFh(); render(); 0");
        check("...and glides once that page closes", FS.until(a, "window.scrollY > 5", 4000), a.js(TOP)); a.ctx.close()
        a = arm(FS.phone(b, base, FS.Fake(), "uidS", setup=False)); a.page.wait_for_timeout(3300)
        check("a setup screen stays put", a.js(TOP) == 0 and a.js("hubPanY()") == 0, a.js("hubPanY()")); a.ctx.close()
        a = arm(W.health(b, base, look=None, setup=False)); a.page.wait_for_timeout(3300)
        check("Health Hub's first-time welcome stays put", a.js(TOP) == 0 and a.js("hubPanY()") == 0 and a.js("!!document.querySelector('form[data-hhsetup]')"), a.js("[window.scrollY, hubPanY()]")); a.ctx.close()
        a = fam(); a.js("document.getElementById('cards').insertAdjacentHTML('afterbegin', '<section class=\"card whatsnew\">New</section>'); 0")
        check("an update note to read stays on screen", a.js("hubPanY()") == 0); a.ctx.close()
        a = arm(D.phone(b, base)); a.js("TAB = 'today'; 0")
        check("another tab isn't moved", a.js("hubPanY()") == 0); a.ctx.close()
        a = fam(); a.js("hubPanStart(600); 0"); a.page.wait_for_timeout(4000); y = a.js(TOP)
        check("it runs once, and stays where it landed", y > 5); a.js("render(); 0"); a.page.wait_for_timeout(1300); check("...a redraw doesn't move it again", a.js(TOP) == y, [y, a.js(TOP)])
        a.js("HP_AWAY = Date.now() - 11 * 60000; Object.defineProperty(document, 'hidden', { get: () => false, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); 0"); a.page.wait_for_timeout(120)
        check("back after 10 minutes: it opens on the art again", a.js(TOP) == 0, a.js(TOP))
        check("...then glides again", FS.until(a, "window.scrollY > 5", 5000), a.js(TOP))
        a.ctx.close()
        a = fam(); a.page.wait_for_timeout(3400); y = a.js(TOP)
        a.js("HP_AWAY = Date.now() - 60000; document.dispatchEvent(new Event('visibilitychange')); 0"); a.page.wait_for_timeout(200)
        check("back after one minute: left alone", a.js(TOP) == y, [y, a.js(TOP)]); a.ctx.close()

        print("\n[Updates, and the What's New note]")
        a = family(); a.js("window.__CHECKS = 0; const f0 = window.fetch; window.fetch = (u, o) => { if (String(u).includes('version.json')) window.__CHECKS++; return f0(u, o); }; UPD_ASKED = Date.now() - 120000; document.dispatchEvent(new Event('visibilitychange')); 0"); a.page.wait_for_timeout(300)
        check("an app reopened from memory asks for updates", a.js("window.__CHECKS") == 1, a.js("window.__CHECKS"))
        a.js("document.dispatchEvent(new Event('visibilitychange')); 0"); a.page.wait_for_timeout(300)
        check("...but not again within a minute", a.js("window.__CHECKS") == 1, a.js("window.__CHECKS"))
        a.ctx.close()
        a = arm(D.phone(b, base, path="/")); a.page.wait_for_timeout(200)
        if a.js("typeof briefOpen === 'function' && briefOpen()"): a.page.click('[data-brief="go"]')
        a.js("document.getElementById('cards').insertAdjacentHTML('afterbegin', '<section class=\"card whatsnew\">New</section>'); window.scrollTo(0, 0); 0")
        check("the customer look: the note is at the top of what it glides to, so it still glides", a.js("hubPanY()") > 0, a.js("hubPanY()")); a.ctx.close()
        a = fam(); a.js("document.getElementById('cards').insertAdjacentHTML('afterbegin', '<section class=\"card whatsnew\">New</section>'); 0")
        check("a new look: the note is above the art, so it waits", a.js("hubPanY()") == 0)
        a.js("window.scrollTo(0, 0); 0")
        a.js("(() => { const b = document.createElement('button'); b.dataset.seen = '1'; document.getElementById('cards').prepend(b); b.click(); })(); 0")
        check("...and tapping Got it starts the glide", FS.until(a, "window.scrollY > 5", 4000), a.js("[window.scrollY, HP_LIVE]")); a.ctx.close()

        print("\n[Reduced motion, test robots, the picture]")
        a = family(); ctx2 = a.ctx
        check("a test robot doesn't get it unless it asks (the other checks stay still)", True if a.js("navigator.webdriver") and not a.js("window.__HUB_PAN") and a.js("(hubPanStart(10), HP_LIVE)") is False else False); a.ctx.close()
        a = family(); a.page.emulate_media(reduced_motion="reduce"); a.js("window.scrollTo({ top: 0, behavior: 'instant' }); window.__HUB_PAN = true; hubPanStart(10); 0"); a.page.wait_for_timeout(500)
        check("a phone set to reduce motion stays put", a.js(TOP) == 0 and not a.js("HP_LIVE")); a.ctx.close()
        a = family(); r = a.js("(() => { const e = document.querySelector('.fh-hello2'); return Math.round(e.getBoundingClientRect().height); })()")
        check("Family Hub's picture shows whole (at least the art's own height at phone width)", r >= 275, r); a.ctx.close()
        a = T.App(b, base, path=T.UNIP); a.ctx.add_init_script("window.__HUB_PAN = true;"); a.page.reload(); a.page.wait_for_function("typeof hubPanOpen === 'function'"); a.page.wait_for_timeout(3600)
        check("Hub Universe does it too", a.js(TOP) > 5 or a.js("hubPanY()") == 0, a.js(TOP)); a.ctx.close()

        errs = [e for e in T.ERRORS[before:] if "the server responded" not in e and "ERR_" not in e]
        check("no page errors", not errs, errs[:4])
        b.close()
    srv.shutdown()
    print(f"\n{OK} passed, {FAIL} failed")
    sys.exit(1 if FAIL else 0)

if __name__ == "__main__":
    main()
