"""
SAVE AS: test_tour.py   LOCATION: C:/MarvelApps/dayhub/tests/test_tour.py

HOW IT WORKS - THE FIRST-OPEN TOUR, IN EVERY HUB (Scott 11/18: "do we want tutorial in all apps" -> "Yes, build it"). What this proves:
- All 12 Hubs, on a brand-new phone (new look, 390 px): the tour opens on its own over the Hub's first screen, 4 cards, card 1 is the
  Hub's own icon and welcome, no price or Pro words on any card, nothing sideways, Let's go closes it, it's marked seen, and a reload
  doesn't bring it back. The Hub's own first screen is under it. No page errors.
- Day Hub: Back is hidden on card 1, Next / Back / the dots / the arrow keys / a swipe move it, Skip, Esc, a tap outside and the phone's
  back button close it, the keyboard starts on Next and comes back to where it was.
- Someone who already uses a Hub (saved data, no tour mark) never gets it on their own. A family invite link doesn't get it either.
- Settings -> How it works, right under Share the Magic: opens it at card 1 (Settings closes); offline it says so and nothing breaks.
- A small phone (320 x 568): the card and its buttons fit on screen.
Drives the real app with the main suite's helpers (fake network, frozen clock).

RUN:   python tests/test_tour.py      (from C:/MarvelApps/dayhub)   Exit 0 = all passed.
"""
import os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import run_tests as T
from playwright.sync_api import sync_playwright

OK = FAIL = 0
def check(name, cond, extra=""):
    global OK, FAIL
    if cond: OK += 1; print(f"  PASS  {name}", flush=True)
    else: FAIL += 1; print(f"  FAIL  {name}  {extra}", flush=True)

HUBS = [("Day Hub", "/", "dayhub"), ("Cruise Hub", T.CRUISE, "cruisehub"), ("Trip Hub", T.TRIP, "triphub"), ("Home Hub", T.HOMEP, "homehub"),
        ("Auto Hub", T.AUTOP, "autohub"), ("Money Hub", T.MONEYP, "moneyhub"), ("Hub Universe", T.UNIP, "hubuniverse"), ("Health Hub", T.HEALTHP, "healthhub"),
        ("Family Hub", T.FAMILYP, "familyhub"), ("Pet Hub", "/../pethub/", "pethub"), ("Cooking Hub", "/../cookinghub/", "cookinghub"), ("Job Hub", "/../jobhub/", "jobhub")]
PRICE = re.compile(r"\$|\bPro\b|whop|trial|subscri|upgrade|/month|per month|a month", re.I)   # the Play apps' rule (app.js playOk), and a few more


class Phone:
    """A brand-new phone that has NOT seen the tour (the main suite's phones have; see run_tests.NO_TOUR)."""
    def __init__(self, b, base, path, width=390, height=844, pre=None):
        self.ctx = b.new_context(viewport={"width": width, "height": height}, timezone_id="America/Chicago", permissions=["notifications"])
        self.ctx.add_init_script("try { sessionStorage.setItem('tour.test', '1'); } catch (e) {}")   # before run_tests.NO_TOUR, so it stands aside
        if pre: self.ctx.add_init_script(pre)
        T.route(self.ctx)
        self.errors = []
        self.page = self.ctx.new_page()
        self.page.on("pageerror", lambda e: self.errors.append(f"pageerror: {e}"))
        self.page.on("console", lambda m: self.errors.append(f"console: {m.text}") if m.type == "error" and "favicon" not in m.text and "Failed to load resource" not in m.text else None)
        self.page.clock.install(time="2026-10-01T08:00:00-05:00")
        self.page.goto(base + path)
        self.page.wait_for_function("typeof render === 'function' && typeof openTour === 'function'")

    def js(self, expr): return self.page.evaluate(expr)
    def shown(self): return self.js("(() => { const t = document.getElementById('tourSheet'); return !!t && !t.classList.contains('hidden') && !!t.querySelector('.tour-slide'); })()")
    def wait_tour(self, ms=4000):
        try: self.page.wait_for_function("(() => { const t = document.getElementById('tourSheet'); return !!t && !t.classList.contains('hidden') && !!t.querySelector('.tour-slide'); })()", timeout=ms); return True
        except Exception: return False
    def title(self): return self.js("(document.querySelector('#tourSheet h2') || {}).innerText || ''")
    def step(self): return self.js("(document.querySelector('#tourSheet .tour-step') || {}).innerText || ''")
    def tap(self, sel): self.page.click(f"#tourSheet {sel}"); self.page.wait_for_timeout(60)
    def close(self): self.ctx.close()


def main():
    srv, base = T.serve()
    with sync_playwright() as p:
        b = p.chromium.launch()

        print("\n[1. every Hub, brand-new phone: the tour opens on its own, 4 cards, its own welcome and icon, no price words, Let's go, seen]")
        for name, path, hid in HUBS:
            a = Phone(b, base, path)
            check(f"{name}: the tour opens on its own", a.wait_tour())
            app = a.js("APP_NAME")
            want = "Welcome, Chef!" if hid == "cookinghub" else f"Welcome to {app}"
            check(f"{name}: card 1 is its own welcome ({want})", a.title() == want and a.step().upper() == "1 OF 4", f"{a.title()!r} {a.step()!r}")
            a.page.wait_for_timeout(300)
            check(f"{name}: card 1 shows the Hub's own icon", a.js("(() => { const i = document.querySelector('#tourSheet .tour-art img'); return !!i && i.complete && i.naturalWidth > 0 && /icon-192\\.png$/.test(i.src); })()"))
            check(f"{name}: its own colour", a.js("getComputedStyle(document.getElementById('tourSheet')).getPropertyValue('--ta').trim()") not in ("", "#f59e0b") or hid == "dayhub")
            texts, fits = [], True
            for k in range(4):
                texts.append(a.js("document.querySelector('#tourSheet .tour-card').innerText"))
                fits = fits and a.js("(() => { const t = document.getElementById('tourSheet'), c = t.querySelector('.tour-card').getBoundingClientRect(); return c.left >= -1 && c.right <= innerWidth + 1 && t.scrollWidth <= t.clientWidth + 1; })()")
                if k < 3: a.tap(".tour-next")
            bad = [t for t in texts if PRICE.search(t)]
            check(f"{name}: no price or Pro words on any card", not bad, bad[:1])
            check(f"{name}: every card fits, nothing in the tour sideways", fits)
            check(f"{name}: card 4 says where to find it again, and Let's go", "Find this tour again" in texts[3] and a.js("document.querySelector('#tourSheet .tour-next').innerText.trim()") == "Let's go")
            a.tap(".tour-next")
            check(f"{name}: Let's go closes it", not a.shown() and not a.js("document.body.classList.contains('tour-on')"))
            check(f"{name}: marked seen on this phone", bool(a.js(f"localStorage.getItem('{hid}.tour')")))
            check(f"{name}: its own first screen is there", a.js("document.getElementById('cards').innerText.trim().length > 20"))
            a.page.reload(); a.page.wait_for_function("typeof render === 'function'"); a.page.wait_for_timeout(1200)
            check(f"{name}: a reload doesn't bring it back", not a.shown())
            check(f"{name}: no page errors", not a.errors, a.errors[:2])
            a.close()

        print("\n[2. Day Hub: every way to move and close it]")
        a = Phone(b, base, "/"); a.wait_tour()
        check("Back is hidden on card 1", a.js("document.querySelector('#tourSheet .tour-back').hidden"))
        check("the keyboard starts on Next", a.js("document.activeElement && document.activeElement.classList.contains('tour-next')"))
        a.tap(".tour-next"); check("Next -> card 2", a.step().upper() == "2 OF 4")
        a.tap(".tour-back"); check("Back -> card 1", a.step().upper() == "1 OF 4")
        a.tap('[data-tourgo="3"]'); check("the 4th dot -> card 4", a.step().upper() == "4 OF 4" and a.js("document.querySelector('#tourSheet .tour-skip').innerText.trim()") == "Close")
        a.page.keyboard.press("ArrowLeft"); check("the left arrow -> card 3", a.step().upper() == "3 OF 4")
        a.page.keyboard.press("ArrowRight"); check("the right arrow -> card 4", a.step().upper() == "4 OF 4")
        a.tap('[data-tourgo="0"]')
        box = a.page.query_selector("#tourSheet .tour-card").bounding_box(); cx, cy = box["x"] + box["width"] / 2, box["y"] + box["height"] / 2
        a.page.mouse.move(cx + 80, cy); a.page.mouse.down(); a.page.mouse.move(cx - 80, cy, steps=6); a.page.mouse.up(); a.page.wait_for_timeout(60)
        check("a swipe left -> card 2", a.step().upper() == "2 OF 4")
        a.page.mouse.move(cx - 80, cy); a.page.mouse.down(); a.page.mouse.move(cx + 80, cy, steps=6); a.page.mouse.up(); a.page.wait_for_timeout(60)
        check("a swipe right -> card 1", a.step().upper() == "1 OF 4")
        a.tap(".tour-skip"); check("Skip closes it", not a.shown())
        check("...and the Hub's own handler didn't reopen it", (a.page.wait_for_timeout(400) or True) and not a.shown())
        a.js("openTour()"); a.wait_tour(); check("it opens again at card 1", a.step().upper() == "1 OF 4")
        a.page.keyboard.press("Escape"); a.page.wait_for_timeout(60); check("Esc closes it", not a.shown())
        a.js("openTour()"); a.wait_tour(); a.page.mouse.click(5, 5); a.page.wait_for_timeout(60); check("a tap outside the card closes it", not a.shown())
        a.js("openTour()"); a.wait_tour(); a.js("history.back()"); a.page.wait_for_timeout(300); check("the phone's back button closes it", not a.shown())
        check("...and the Hub is still open (not sent back a page)", a.js("typeof render === 'function' && !!document.getElementById('cards')"))
        a.js("openTour()"); a.wait_tour(); a.page.keyboard.press("Tab"); a.page.keyboard.press("Tab"); a.page.keyboard.press("Tab"); a.page.keyboard.press("Tab"); a.page.keyboard.press("Tab"); a.page.keyboard.press("Tab")
        check("Tab stays inside the tour", a.js("!!document.activeElement.closest('#tourSheet')"))
        a.tap(".tour-skip")
        check("no page errors", not a.errors, a.errors[:2])
        a.close()

        print("\n[3. not on its own for people who already use a Hub, or on a family invite link]")
        a = Phone(b, base, "/", pre="try { if (!localStorage.getItem('dayhub.v1')) localStorage.setItem('dayhub.v1', JSON.stringify({ name: 'Scott', city: '83702' })); } catch (e) {}")
        a.page.wait_for_timeout(1500)
        check("Day Hub with saved data: no tour on its own", not a.shown() and not a.js("localStorage.getItem('dayhub.tour')"))
        a.close()
        a = Phone(b, base, T.FAMILYP + "?join=ABCD-EFGH")
        a.page.wait_for_timeout(1500)
        check("Family Hub opened from an invite link: no tour on its own", not a.shown())
        a.close()

        print("\n[4. Settings -> How it works]")
        a = T.App(b, base, look=None); T.setup(a)
        a.js("openSettings()"); a.page.wait_for_timeout(200)
        check("How it works sits right under Share the Magic", a.js("(() => { const s = document.getElementById('stmSetBtn'), t = document.getElementById('tourSetBtn'); return !!s && !!t && s.nextElementSibling === t && /How it works/.test(t.innerText) && /Day Hub/.test(t.innerText); })()"))
        a.page.click("#tourSetBtn"); a.page.wait_for_selector("#tourSheet:not(.hidden) .tour-slide")
        check("it opens the tour at card 1", a.js("document.querySelector('#tourSheet h2').innerText") == "Welcome to Day Hub")
        check("...and Settings closed under it", a.js("document.getElementById('sheet').classList.contains('hidden')"))
        a.page.click("#tourSheet .tour-skip"); a.page.wait_for_timeout(60)
        check("Skip closes it", a.js("document.getElementById('tourSheet').classList.contains('hidden')"))
        a.close()
        for name, path in (("Family Hub", T.FAMILYP), ("Job Hub", "/../jobhub/")):
            a = T.App(b, base, path=path, look=None)
            a.js("openSettings()"); a.page.wait_for_timeout(200)
            check(f"{name}: How it works is in its Settings", a.js(f"/A quick tour of {name}/.test((document.getElementById('tourSetBtn') || {{}}).innerText || '')"))
            a.close()
        a = T.App(b, base, look=None); T.setup(a)
        a.ctx.route("**/tour.js*", lambda r: r.abort())
        a.js("openSettings()"); a.page.wait_for_timeout(200); a.page.click("#tourSetBtn"); a.page.wait_for_timeout(600)
        check("offline: it says so, and nothing opens", "Couldn't open the tour" in a.js("document.getElementById('toast').innerText") and not a.js("!!document.querySelector('#tourSheet:not(.hidden)')"))
        a.close()

        print("\n[5. a small phone: 320 x 568]")
        for name, path, hid in (HUBS[0], HUBS[7], HUBS[8]):
            a = Phone(b, base, path, width=320, height=568); a.wait_tour()
            for k in range(4):
                ok = a.js("(() => { const c = document.querySelector('#tourSheet .tour-card').getBoundingClientRect(), n = document.querySelector('#tourSheet .tour-next').getBoundingClientRect(); return c.left >= -1 && c.right <= innerWidth + 1 && n.bottom <= innerHeight + 1 && n.top >= 0; })()")
                if not ok: break
                if k < 3: a.tap(".tour-next")
            check(f"{name}: every card and its buttons fit at 320 x 568", ok)
            a.close()
        b.close()
    srv.shutdown()
    print(f"\n{OK} passed, {FAIL} failed")
    sys.exit(1 if FAIL else 0)


if __name__ == "__main__":
    main()
