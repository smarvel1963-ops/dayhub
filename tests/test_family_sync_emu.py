"""
SAVE AS: test_family_sync_emu.py   LOCATION: C:/MarvelApps/dayhub/tests/test_family_sync_emu.py

FAMILY HUB SHARING ON FIREBASE'S OWN LOCAL EMULATOR (Scott 11/07: "Test first, then publish"). Real Family Hub pages ("phones", each its
own browser profile) run the app's REAL Firebase code (the compat SDK from the firebase npm package, served in place of gstatic) against
Firebase's local Firestore + Auth emulators with the REAL rules (docs/hub_improvement/familyhub/firestore.rules). Nothing reaches the
real project: the pages use project "demo-familyhub" and 127.0.0.1 only. What this adds over test_family_sync.py (fake Firebase):
real anonymous sign-in, real record-by-record writes (mergeFields: a field taken out really leaves), the real one-step join (batch),
real rules refusing a guest, real offline behaviour on a phone that starts without internet.

RUN:   powershell C:/MarvelApps/docs/hub_improvement/familyhub/rules_test/run_sync_emu.ps1   (starts the emulators, runs this)
"""
import os, sys, json, time, urllib.request
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import run_tests as T
import test_family_sync as FS
from playwright.sync_api import sync_playwright

OK = FAIL = 0
def check(name, cond, extra=""):
    global OK, FAIL
    if cond: OK += 1; print(f"  PASS  {name}")
    else: FAIL += 1; print(f"  FAIL  {name}  {extra}")

SDK = r"D:\Tools\fbtest\node_modules\firebase"
PROJ = "demo-familyhub"
def server(path):   # read the emulator's copy directly, past the rules (the emulator's admin header)
    u = f"http://127.0.0.1:8085/v1/projects/{PROJ}/databases/(default)/documents/{path}"
    try:
        with urllib.request.urlopen(urllib.request.Request(u, headers={"Authorization": "Bearer owner"}), timeout=5) as r: return json.loads(r.read())
    except Exception: return None
def fields(doc): return (doc or {}).get("fields", {})
def rmap(doc): return fields(doc).get("r", {}).get("mapValue", {}).get("fields", {})

def phone(b, base, setup=True, name="Scott"):
    a = T.App.__new__(T.App)
    a.ctx = b.new_context(viewport={"width": 390, "height": 844}, timezone_id="America/Chicago")
    T.route(a.ctx)
    def sdk(r):
        f = os.path.join(SDK, os.path.basename(r.request.url.split("?")[0]))
        if os.path.exists(f): return r.fulfill(path=f, content_type="application/javascript")
        return r.abort()
    a.ctx.route("https://www.gstatic.com/firebasejs/**", sdk)
    a.ctx.add_init_script(f"window.FHS_EMU = {{ project: {json.dumps(PROJ)} }};")
    a.page = a.ctx.new_page()
    a.page.on("pageerror", lambda e: T.ERRORS.append(f"pageerror: {e}"))
    a.page.goto(base + T.FAMILYP)
    a.page.wait_for_function("typeof render === 'function' && typeof fhsJoin === 'function'")
    if setup:
        a.page.fill('form[data-fhsetup] [name=fam]', "The Marvel Family"); a.page.fill('form[data-fhsetup] [name=name]', name)
        a.page.click('form[data-fhsetup] button'); a.page.wait_for_function("S.fh && S.fh.setup")
    if a.js("typeof briefOpen === 'function' && briefOpen()"): a.page.click('[data-brief="go"]')
    return a

def until(a, expr, ms=15000): return FS.until(a, expr, ms)


def main():
    if server("x/y") is None and not _up():
        print("The Firestore emulator isn't running - use run_sync_emu.ps1"); sys.exit(2)
    srv, base = T.serve()
    with sync_playwright() as p:
        b = p.chromium.launch()
        before = len(T.ERRORS)
        print("\n[Real Firebase code on the local emulator, real rules]")
        A = phone(b, base)
        A.js(FS.SEED.replace('F.events.push({ id: "e1", title: "Soccer", date: t,', 'F.events.push({ id: "e1", title: "Soccer", date: t,')); FS.put_image(A, "phall", "#3a8dde"); A.page.wait_for_timeout(300)
        A.js("showFh('share')"); A.page.click('#fhSheet [data-fhson]')
        check("the owner's phone signs in anonymously and turns sharing on", until(A, "FHS && FHS_STATE === 'ok'", 30000), A.js("[FHS_STATE, FHS_ERR]"))
        fid = A.js("FHS.fid"); pre = f"families/{fid}/"
        fam = fields(server(f"families/{fid}"))
        check("the family document: owner, not paid, a server start date", fam.get("owner", {}).get("stringValue") == A.js("FHS.uid") and fam.get("paid", {}).get("booleanValue") is False and "timestampValue" in fam.get("created", {}))
        check("records landed in the right parts", "ev~e1" in rmap(server(pre + "all/plan")) and "ev~e2" in rmap(server(pre + "adults/plan")) and "ev~e2" not in rmap(server(pre + "all/plan")))
        check("'Only me' stayed home", "phme" not in json.dumps(server(pre + "all/photos")) and "Mine" not in json.dumps(server(pre + "all/people")))
        A.page.select_option('#fhSheet form[data-fhsinv] [name=m]', "jen"); A.page.click('#fhSheet form[data-fhsinv] button')
        check("an invite code (owner only, by the real rules)", until(A, "FHS_INV && FHS_INV.code.length === 10"), A.js("FH_MSG"))
        code = A.js("FHS_INV.code")
        B = phone(b, base, setup=False)
        B.page.fill('form[data-fhsjoin] [name=code]', code); B.page.click('form[data-fhsjoin] button')
        check("Jen's phone joins in one step (family + code used up together)", until(B, "FHS && FHS_STATE === 'ok' && S.fh.members.length === 4", 30000), B.js("[FHS && FHS_STATE, FHS_ERR]"))
        check("...and the code is gone from the server", server(f"invites/{code}") is None)
        check("Jen (adult) gets the parents' part", B.js("S.fh.events.some(e => e.id === 'e2')"))
        B.js("(() => { const L = S.fh.lists.find(l => l.icon === '🛒'); L.items.push({ id: 'i1', text: 'Milk', by: 'jen', done: false, at: Date.now() }); save(); })()")
        check("Jen adds milk; Scott's phone gets it", until(A, "S.fh.lists.find(l => l.icon === '🛒').items.some(i => i.text === 'Milk')"))
        A.js("(() => { const L = S.fh.lists.find(l => l.icon === '🛒'); L.items.push({ id: 'i2', text: 'Eggs', by: S.fh.members[0].id, done: false, at: Date.now() }); save(); })()")
        B.js("(() => { const L = S.fh.lists.find(l => l.icon === '🛒'); L.items.push({ id: 'i3', text: 'Bread', by: 'jen', done: false, at: Date.now() }); save(); })()")
        both = "S.fh.lists.find(l => l.icon === '🛒').items.map(i => i.text).sort().join() === 'Bread,Eggs,Milk'"
        check("both phones adding at once: nothing lost", until(A, both) and until(B, both))
        check("Jen's birthday is in the shared part at first", "bday" in json.dumps(rmap(server(pre + "all/people")).get("mem~jen", {})))
        A.js("S.fh.share.jen = { bday: { to: 'parents', ids: [] } }; save()"); A.page.wait_for_timeout(4000)
        mj = json.dumps(rmap(server(pre + "all/people")).get("mem~jen", {}))
        check("made 'Parents only', the birthday really leaves the shared part (real record-by-record writes)", "bday" not in mj and "1985-11-19" in json.dumps(rmap(server(pre + "adults/people")).get("memx~jen", {})), mj[:200])
        B.js("fhClick({ fhevdel: 'e1' })")
        check("a deletion on Jen's phone reaches Scott's", until(A, "!S.fh.events.some(e => e.id === 'e1')"))
        B.js("showFh('photos')")
        check("the shared photo arrives on Jen's phone", until(B, "fhpIdb('readonly', s => s.get('phall')).then(d => !!d)", 20000))
        A.js("showFh('share')"); A.page.select_option('#fhSheet form[data-fhsinv] [name=m]', "gma"); A.page.click('#fhSheet form[data-fhsinv] button')
        until(A, "FHS_INV && FHS_INV.mid === 'gma'"); gcode = A.js("FHS_INV.code")
        G = phone(b, base, setup=False)
        G.page.fill('form[data-fhsjoin] [name=code]', gcode); G.page.click('form[data-fhsjoin] button')
        check("Grandma's phone joins as a guest", until(G, "FHS && FHS_STATE === 'ok' && S.fh.members.length === 4", 30000), G.js("[FHS && FHS_STATE, FHS_ERR]"))
        check("the real rules keep the parents' part from a guest (no Date night, no Parents talk)", not G.js("S.fh.events.some(e => e.id === 'e2')") and not G.js("S.fh.msgs.some(m => m.th === 'parents')"))
        denied = G.js("(async () => { try { await fhsNet().get('families/' + FHS.fid + '/adults/plan'); return 'read'; } catch (e) { return String(e.code || e.message); } })()")
        check("asking the server directly: refused", "permission" in str(denied).lower(), denied)
        print("\n[A phone that opens without internet]")
        B.ctx.set_offline(True); B.page.reload(); B.page.wait_for_timeout(4000)
        check("opening offline, Jen's phone stays in the family (no drop-out)", B.js("!!FHS") and B.js("S.fh.members.length") == 4, B.js("[!!FHS, FHS_STATE]"))
        B.js("S.fh.events.push({ id: 'e9', title: 'Bake sale', date: today(), time: '', kind: 'school', rep: 'none', until: '', where: '', note: '', vis: '', who: [], skip: [], at: Date.now() }); save()")
        B.ctx.set_offline(False); B.js("window.dispatchEvent(new Event('online'))")
        check("back online, her offline edit reaches Scott", until(A, "S.fh.events.some(e => e.title === 'Bake sale')", 40000), B.js("[FHS && FHS_STATE, FHS_ERR]"))
        check("...and nothing she had was lost", B.js("S.fh.lists.find(l => l.icon === '🛒').items.length") == 3)
        print("\n[Taking a phone off, leaving]")
        guid = G.js("FHS.uid"); A.js(f"fhClick({{ fhsrm: '{guid}' }})")
        check("the owner takes Grandma's phone off; it stops and keeps its copy", until(G, "!FHS && FHS_STATE === 'removed'", 30000) and G.js("S.fh.events.length") > 0)
        B.js("showFh('share'); fhClick({ fhsleave: '1' })"); B.js("fhClick({ fhsleave: '1' })")
        check("Jen's phone leaves", until(B, "!FHS"))
        mem = fields(server(f"families/{fid}")).get("members", {}).get("mapValue", {}).get("fields", {})
        check("the family on the server now lists only the owner's phone", list(mem.keys()) == [A.js("FHS.uid")], list(mem.keys()))
        errs = [e for e in T.ERRORS[before:] if "favicon" not in e]
        check("no page errors", not errs, errs[:3])
        for x in (A, B, G):
            try: x.js("fhsStopListening()"); x.ctx.close()
            except Exception: pass
        b.close()
    print(f"\n{OK} passed, {FAIL} failed")
    sys.exit(1 if FAIL else 0)

def _up():
    try: urllib.request.urlopen("http://127.0.0.1:8085/", timeout=2); return True
    except urllib.error.HTTPError: return True
    except Exception: return False

if __name__ == "__main__":
    main()
