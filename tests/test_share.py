"""
SAVE AS: test_share.py   LOCATION: C:/MarvelApps/dayhub/tests/test_share.py

SHARE THE MAGIC (Scott 11/06 "Share this app" -> 11/18 his design + "Yes, build part 1"). In every Hub: the ✨ / Settings / More entry
opens the page (share.js loads on the first tap), with that app's name, its own link, 4 pictures to pick (the app + 3 features),
the picture really drawn (with and without the QR code), an editable message, Preview & Share, and each place it can go: the phone's
share menu (picture + message), Text, Messenger, Facebook, Facebook Groups, Instagram / TikTok (picture saved, message copied), X,
Telegram. Back closes it. No sideways scroll at 360 px. The 1.67 note reaches every Hub.

RUN:   python tests/test_share.py      (from C:/MarvelApps/dayhub)   Exit 0 = all passed.
"""
import os, re, sys, urllib.parse
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import run_tests as T
import test_job as TJ
from playwright.sync_api import sync_playwright

OK = FAIL = 0
def check(name, cond, extra=""):
    global OK, FAIL
    if cond: OK += 1; print(f"  PASS  {name}")
    else: FAIL += 1; print(f"  FAIL  {name}  {extra}")

AT = "2026-10-01T08:00:00"
def opened(a): return a.js("!!document.getElementById('stmSheet') && !document.getElementById('stmSheet').classList.contains('hidden')")
def wait_pic(a):
    a.page.wait_for_function("(() => { const i = document.querySelector('#stmSheet .stm-phone img'); return i && i.src.startsWith('data:image/png') && i.src.length > 20000; })()", timeout=15000)
    return a.js("document.querySelector('#stmSheet .stm-phone img').src")
def spy(a):
    a.js("""(() => { window.__open = []; window.open = u => { window.__open.push(String(u)); return null; }; window.__nav = []; window.stmNav = u => window.__nav.push(String(u));
        window.__clip = []; try { Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: t => { window.__clip.push(t); return Promise.resolve(); } } }); } catch (e) {}
        window.__share = null; navigator.share = d => { window.__share = { text: d.text, files: (d.files || []).map(f => [f.name, f.type, f.size]) }; return Promise.resolve(); }; navigator.canShare = () => true; })()""")
def send(a, target):
    if target: a.js(f"(() => {{ const b = document.querySelector('#stmSheet [data-stmto=\"{target}\"]'); if (!b.classList.contains('on')) b.click(); }})()")
    else: a.js("(() => { const b = document.querySelector('#stmSheet .stm-tgt.on'); if (b) b.click(); })()")
    a.page.click("#stmSheet [data-stmgo]"); a.page.wait_for_timeout(150)
    pv = a.js("document.getElementById('stmPrev').innerText")
    a.page.click("#stmPrev [data-stmsend]"); a.page.wait_for_timeout(400)
    return pv


def main():
    srv, base = T.serve()
    with sync_playwright() as p:
        b = p.chromium.launch()
        ctxs = []

        print("\n[1. Day Hub: the ✨ in the top bar opens the page]")
        a = T.App(b, base, look=None); T.setup(a)
        check("the ✨ sits next to ⚙ in the top bar", a.js("!!document.querySelector('#hero .stm-hero[data-stm]')"))
        check("share.js isn't loaded until someone taps it", a.js("typeof stmOpen") == "undefined")
        a.page.click("#hero .stm-hero"); a.page.wait_for_function("typeof stmOpen === 'function' && !!document.getElementById('stmSheet')")
        t = a.js("document.getElementById('stmSheet').innerText")
        check("Share the Magic opens: the title, Share This App, Day Hub's card, its own link", opened(a) and "SHARE THE MAGIC" in t and "Share This App" in t and "DAY HUB" in t
              and a.js("document.getElementById('stmLink').value") == a.js("HOME_URL"), t[:300])
        check("4 pictures to pick: the app and 3 of its features", a.js("document.querySelectorAll('#stmSheet .stm-pick').length") == 4 and "Home" in t)
        check("8 places to share it", a.js("[...document.querySelectorAll('#stmSheet .stm-tgt')].map(x => x.innerText.trim()).join('|')") == "Text|Messenger|Facebook|FB Groups|Instagram|TikTok|X|Telegram")
        pic1 = wait_pic(a)
        check("the share picture is really drawn (a 1080 x 1350 PNG)", a.js("STM.canvas.width + 'x' + STM.canvas.height") == "1080x1350", a.js("STM.canvas && STM.canvas.width"))
        a.page.click("#stmSheet .stm-round[data-stmclose]"); a.page.wait_for_timeout(150)
        check("the back arrow closes it", not opened(a))
        a.page.click("#hero .stm-hero"); a.page.wait_for_timeout(300); a.page.go_back(); a.page.wait_for_timeout(200)
        check("the phone's back button closes it too", not opened(a))
        a.js("openSettings()"); a.page.wait_for_timeout(150)
        check("Settings starts with a big Share the Magic button", a.js("document.querySelector('#sheet .stm-setbtn') && document.querySelector('#sheet .sheet-head').nextElementSibling.id") == "stmSetBtn"
              and "Show friends what makes Day Hub special" in a.js("document.getElementById('stmSetBtn').innerText"))
        a.page.click("#stmSetBtn"); a.page.wait_for_timeout(300)
        check("...which closes Settings and opens Share the Magic", opened(a) and a.js("document.getElementById('sheet').classList.contains('hidden')"))
        a.close()

        print("\n[2. Job Hub: everything a share can do]")
        a = TJ.phone(b, base)
        a.js("jhClick({ jhtab: 'more', jhroot: '1' })"); a.page.wait_for_timeout(150)
        check("Job Hub's More starts with Share the Magic", a.js("(document.querySelector('#jhSheet .jh-mrow') || {}).innerText || ''").startswith("Share the Magic"))
        a.page.click("#jhSheet .jh-mrow[data-stm]"); a.page.wait_for_function("typeof stmOpen === 'function' && !!document.getElementById('stmSheet')")
        t = a.js("document.getElementById('stmSheet').innerText")
        check("it's Job Hub's: name, tagline, link", "JOB HUB" in t and "Your next job, found." in t and a.js("document.getElementById('stmLink').value").endswith("/jobhub/"), t[:300])
        check("it sits over Job Hub's own page (nothing behind it closes)", a.js("JH_OPEN") and a.js("getComputedStyle(document.getElementById('stmSheet')).zIndex") == "9000")
        p0 = wait_pic(a)
        a.page.click("#stmSheet [data-stmpick='2']"); a.page.wait_for_timeout(200)
        p2 = wait_pic(a)
        check("picking a feature picture draws that one", p2 != p0 and a.js("STM.pick") == 2 and a.js("document.querySelectorAll('#stmSheet .stm-pick.on').length") == 1)
        a.page.click("#stmSheet .stm-qrt"); a.page.wait_for_timeout(300)
        p3 = wait_pic(a)
        check("the QR switch redraws the picture without the code", a.js("STM.qr") is False and p3 != p2)
        a.page.fill("#stmMsg", "Found my last job with this - try it")
        spy(a)
        pv = send(a, "")
        check("Preview shows the picture, your message and the link", "Found my last job with this - try it" in pv and "/jobhub/" in pv and "your phone's share menu" in pv, pv)
        sh = a.js("window.__share")
        check("no place picked: the phone's share menu gets the picture AND the message", sh and sh["files"] and sh["files"][0][1] == "image/png" and sh["files"][0][2] > 10000 and "Found my last job" in sh["text"] and "/jobhub/" in sh["text"], sh)
        link = a.js("HOME_URL")
        send(a, "text")
        check("Text opens the phone's messages with the message", a.js("window.__nav.slice(-1)[0] || ''").startswith("sms:?&body=") and "Found%20my%20last%20job" in a.js("window.__nav.slice(-1)[0]"))
        send(a, "x")
        u = a.js("window.__open.slice(-1)[0]")
        check("X opens a post with the message and link", u.startswith("https://x.com/intent/post?text=") and urllib.parse.quote(link, safe="") in u, u)
        send(a, "telegram")
        u = a.js("window.__open.slice(-1)[0]")
        check("Telegram opens its share page with the link and message", u.startswith("https://t.me/share/url?url=" + urllib.parse.quote(link, safe="")) and "&text=Found" in u, u)
        pv = send(a, "facebook")
        u = a.js("window.__open.slice(-1)[0]")
        check("Facebook opens its share box with the link; the message is copied to paste", u == "https://www.facebook.com/sharer/sharer.php?u=" + urllib.parse.quote(link, safe="") and "Found my last job" in a.js("window.__clip.slice(-1)[0] || ''"), u)
        pv = send(a, "groups")
        check("FB Groups says to choose 'Share to a group' in Facebook's box", "Share to a group" in pv)
        a.js("STM.target = ''; document.querySelectorAll('#stmSheet .stm-tgt').forEach(x => x.classList.remove('on'))")
        a.js("(() => { const b = document.querySelector('#stmSheet [data-stmto=\"instagram\"]'); b.click(); })()")
        a.page.click("#stmSheet [data-stmgo]"); a.page.wait_for_timeout(150)
        pv = a.js("document.getElementById('stmPrev').innerText")
        with a.page.expect_download() as dl: a.page.click("#stmPrev [data-stmsend]")
        a.page.wait_for_timeout(300)
        check("Instagram: says how, saves the picture, copies the message, opens Instagram", "add the picture and paste" in pv and dl.value.suggested_filename == "Job-Hub-share.png"
              and a.js("window.__open.slice(-1)[0]") == "https://www.instagram.com/", pv)
        a.js("window.navigator.__defineGetter__('userAgent', () => 'Mozilla/5.0 (Linux; Android 14) Mobile')")
        send(a, "messenger")
        check("Messenger on a phone opens the Messenger app with the link", a.js("window.__nav.slice(-1)[0] || ''") == "fb-messenger://share/?link=" + urllib.parse.quote(link, safe=""))
        a.close()

        print("\n[3. every other Hub reaches it, with its own name and link]")
        hubs = [("/../cruisehub/", "CRUISE HUB", "hero"), ("/../triphub/", "TRIP HUB", "hero"), ("/../homehub/", "HOME HUB", "hero"), ("/../autohub/", "AUTO HUB", "hero"),
                ("/../moneyhub/", "MONEY HUB", "hero"), ("/../healthhub/", "HEALTH HUB", "hero"), ("/../familyhub/", "FAMILY HUB", "settings"), ("/../pethub/", "PET HUB", "settings"),
                ("/../cookinghub/", "COOKING HUB", "settings"), ("/../hubuniverse/", "HUB UNIVERSE", "universe")]
        for path, name, how in hubs:
            a = T.App(b, base, path=path, look=None)
            a.page.wait_for_timeout(300)
            if path == "/../autohub/":   # Auto Hub's header (with the ✨) comes once a car is in; its first screen is the add-a-car welcome
                a.page.click('[data-atadd="ymm"]'); a.page.wait_for_timeout(120)
                for k, v in (("year", "2019"), ("make", "Honda"), ("model", "Civic")): a.page.fill(f'form[data-autosetup] [name="{k}"]', v)
                a.page.click("form[data-autosetup] .at-big"); a.page.wait_for_function("S.garage && S.garage.cars.length === 1"); a.page.wait_for_timeout(200)
            if how == "hero":   # the ✨ the customer sees: in the new look's own header (or the top bar where that look keeps it)
                sel = a.js("(() => { const v = [...document.querySelectorAll('.stm-hd, #hero .stm-hero')].find(x => x.offsetParent !== null && x.getBoundingClientRect().width > 0); if (!v) return ''; v.setAttribute('data-stmtest', '1'); return v.className; })()")
                check(f"{name.title()}: a ✨ shows in its header", bool(sel), sel)
                if sel: a.page.click("[data-stmtest]")
                else: a.js("openSettings()"); a.page.wait_for_timeout(150); a.page.click("#stmSetBtn")
            elif how == "universe": a.page.wait_for_selector(".uni-share"); a.page.click(".uni-share")
            else: a.js("openSettings()"); a.page.wait_for_timeout(150); a.page.click("#stmSetBtn")
            try: a.page.wait_for_function("!!document.getElementById('stmSheet') && !document.getElementById('stmSheet').classList.contains('hidden')", timeout=8000)
            except Exception: pass
            t = a.js("(document.getElementById('stmSheet') || {}).innerText || ''")
            ok = opened(a) and name in t and a.js("document.getElementById('stmLink').value") == a.js("HOME_URL")
            pic = ""
            if ok:
                try: pic = wait_pic(a)
                except Exception: pic = ""
            check(f"{name.title()}: opens with its own name, link and a drawn picture", ok and len(pic) > 20000, t[:120])
            a.close()

        print("\n[3b. after setup: Trip / Home / Auto keep the ✨ beside ⚙; Cruise / Money / Health (full headers) have it first in More]")
        import test_cruise_tiles as TC, test_trip_tiles as TT, test_home_tiles as TH, test_money_tiles as TM, test_health_tiles as THW
        def sheet_open(a):
            try: a.page.wait_for_function("!!document.getElementById('stmSheet') && !document.getElementById('stmSheet').classList.contains('hidden')", timeout=8000)
            except Exception: pass
            return opened(a)
        for nm, mk in (("Trip Hub", TT.trip), ("Home Hub", TH.home)):
            a = mk(b, base); a.page.wait_for_timeout(300)
            vis = a.js("(() => { const v = [...document.querySelectorAll('.stm-hd')].find(x => x.offsetParent !== null && x.getBoundingClientRect().width > 0); if (!v) return ''; v.setAttribute('data-stmtest', '1'); const r = v.parentElement.getBoundingClientRect(), g = v.nextElementSibling.getBoundingClientRect(); return v.nextElementSibling.getAttribute('aria-label') + (g.right <= innerWidth && g.right <= r.right + 1 ? ' fits' : ' OFF THE EDGE'); })()")
            ok = vis == "Settings fits"
            if ok: a.page.click("[data-stmtest]")
            check(f"{nm}: the ✨ sits right before ⚙ on its home (⚙ still fully on screen) and opens Share the Magic", ok and sheet_open(a) and nm.upper() in a.js("document.getElementById('stmSheet').innerText"), vis)
            a.close()
        for nm, mk, more, row in (("Cruise Hub", TC.cruise, "#tabbar button:has-text('More')", ".ct-more [data-stm]"), ("Money Hub", TM.money, "#mvNav [data-mtgo=more]", ".mt-mrow[data-stm]"),
                                  ("Health Hub", THW.health, "#hhNav [data-hwgo=more]", ".hw-mrow[data-stm]")):
            a = mk(b, base); a.page.wait_for_timeout(300)
            check(f"{nm}: no ✨ squeezed into its full header", a.js("![...document.querySelectorAll('.stm-hd')].some(x => x.offsetParent !== null)"))
            a.page.click(more); a.page.wait_for_timeout(250)
            first = a.js(f"(() => {{ const r = document.querySelector({row!r}); return r ? r.innerText.trim().split('\\n')[0] : ''; }})()")
            if first: a.page.click(row)
            check(f"{nm}: More has Share the Magic, and it opens with {nm}'s name", "Share the Magic" in first and sheet_open(a) and nm.upper() in a.js("document.getElementById('stmSheet').innerText"), first)
            a.close()
        a = T.App(b, base, path="/../autohub/", look=None); a.page.wait_for_timeout(300)
        a.page.click('[data-atadd="ymm"]'); a.page.wait_for_timeout(120)
        for k, v in (("year", "2019"), ("make", "Honda"), ("model", "Civic")): a.page.fill(f'form[data-autosetup] [name="{k}"]', v)
        a.page.click("form[data-autosetup] .at-big"); a.page.wait_for_function("S.garage && S.garage.cars.length === 1"); a.page.wait_for_timeout(250)
        fit = a.js("(() => { const v = document.querySelector('.at-top .stm-hd'), g = v && v.nextElementSibling; if (!v) return 'none'; const r = g.getBoundingClientRect(), L = document.querySelector('.at-logo').getBoundingClientRect(); return (r.right <= innerWidth ? 'gear on screen' : 'gear OFF') + (L.right <= v.getBoundingClientRect().left ? ', logo clear' : ', logo OVERLAPS'); })()")
        check("Auto Hub: the ✨ sits in its car header, ⚙ on screen, logo not covered", fit == "gear on screen, logo clear", fit)
        a.close()

        print("\n[4. More pages, a phone, the note]")
        a = T.App(b, base, path="/../cookinghub/", at=AT, look=None)
        a.page.wait_for_selector("form[data-cksetup]"); a.page.fill('form[data-cksetup] [name="name"]', "Sam"); a.page.click("form[data-cksetup] .ck-cta"); a.page.wait_for_timeout(200)
        a.js("ckClick({ cktab: 'more', ckroot: '1' })"); a.page.wait_for_timeout(150)
        check("Cooking Hub's More starts with Share the Magic", "Share the Magic" in a.js("(document.querySelector('.ck-morelist .ck-row') || {}).innerText || ''"))
        a.close()
        a = T.App(b, base, width=360, look=None); T.setup(a)
        a.page.click("#hero .stm-hero"); a.page.wait_for_function("!!document.getElementById('stmSheet')"); wait_pic(a)
        check("no sideways scroll at 360 px", a.js("document.getElementById('stmSheet').scrollWidth <= innerWidth + 1"))
        notes = a.js("fetch('version.json').then(r => r.json())")
        check("engine 1.67, and its note reaches every Hub (no Hub name in front)", a.js("VERSION") == "1.67" and notes["version"] == "1.67" and notes["notes"]["1.67"][0].startswith("✨ Share the Magic:") and a.js("noteForMe('" + notes["notes"]["1.67"][0].replace("'", "\\'") + "')"))
        a.close()
        b.close()
    srv.shutdown()
    real = [e for e in T.ERRORS if "Failed to load resource" not in e and "vibrate" not in e]
    check("no page errors", not real, real[:5])
    print(f"\n{OK} passed, {FAIL} failed")
    sys.exit(1 if FAIL else 0)


if __name__ == "__main__":
    main()
