"""
SAVE AS: test_family_buy.py   LOCATION: C:/MarvelApps/dayhub/tests/test_family_buy.py

FAMILY HUB: THE $25 PURCHASE (Scott 11/08 "Yes, build it"; 11/07 "1 time price of 25 ... invite all his family to it for free", "Free trial first").
Real Family Hub pages, a fake relay (the purchase check) and the fake Firebase from test_family_sync.py. Nothing reaches Whop, the relay or the real project.
Checks: the Buy button and "I already bought it" (owner only, no price for kids or guests); the unlock box sells Family Hub, not Day Hub Pro; a wrong email,
a Day Hub Pro answer; after 30 days nothing is lost, everything reads, adding waits, checking off and fixing what's there still work; unlocking opens it;
sharing: every phone counts from the day the family was made, sharing pauses and catches up, the owner's phone marks the family paid and every phone follows,
a member can't, a refused write hurts nothing, an offline phone remembers; the Play app never pauses or sells.

RUN:   python tests/test_family_buy.py      (from C:/MarvelApps/dayhub)   Exit 0 = all passed.
"""
import os, sys, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import run_tests as T
import test_family_sync as FS
from playwright.sync_api import sync_playwright

OK = FAIL = 0
def check(name, cond, extra=""):
    global OK, FAIL
    if cond: OK += 1; print(f"  PASS  {name}")
    else: FAIL += 1; print(f"  FAIL  {name}  {extra}")

GOOD, DAYPRO, CODE = "buyer@example.com", "daypro@example.com", "newphone@example.com"
def relay(route):
    try: q = json.loads(route.request.post_data or "{}")
    except Exception: q = {}
    b, a = q.get("buyer", ""), {"valid": False, "status": "not found"}
    if q.get("task") == "verify":
        if b == GOOD: a = {"valid": True, "status": "completed", "until": None, "who": "h1", "product": "familyhub"}
        elif b == DAYPRO: a = {"valid": True, "status": "active", "until": None, "who": "h2", "product": "dayhub"}
        elif b == CODE: a = {"valid": False, "status": "needs code"}
    route.fulfill(status=200, content_type="application/json", body=json.dumps(a))

def wire(a): a.ctx.route("**/macros/s/**", relay); return a
def back_days(a, n): a.js(f"(() => {{ const d = new Date(); d.setDate(d.getDate() - {n}); fh().setup = ymd(d); save(); render(); }})()")
def bought(a, who=GOOD, product="familyhub"): a.js(f"setProState({{ buyer: {json.dumps(who)}, ok: true, checked: Date.now(), status: 'completed', product: {json.dumps(product)} }})")
def box(a): a.js("openSettings()"); return a.page.inner_text("#proBox")
def unlock(a, email):
    a.js(f"unlockPro({json.dumps(email)})")
    a.page.wait_for_function("!/Checking/.test(document.getElementById('proBox').textContent)", timeout=5000)
def close_settings(a): a.js("document.getElementById('sheet').classList.add('hidden')")
def toast_of(a): return a.js("(document.getElementById('toast') || {}).textContent || ''")
def open_more(a): a.js("showFh('more')")
def add_form(a, attr, val="new"):
    """Hands fhSubmit a form the way the page does: what it does with one, without needing the screen open."""
    return a.js(f"(() => {{ const f = document.createElement('form'); f.dataset[{json.dumps(attr)}] = {json.dumps(val)}; return JSON.stringify([fhSubmit(f, {{ name: 'X', text: 'hi', title: 'X', date: today() }}), S.fh.msgs ? S.fh.msgs.length : -1, S.fh.events.length, S.fh.lists.length]); }})()")

def main():
    srv, base = T.serve()
    fake = FS.Fake()
    with sync_playwright() as p:
        b = p.chromium.launch()
        before = len(T.ERRORS)
        print("\n[Buying: the button]")
        A = wire(FS.phone(b, base, fake, "uidA")); A.js(FS.SEED); open_more(A)
        more = A.page.inner_text("#fhSheet")
        check("the owner's More: 30 days left, $25 once, a Get Family Hub button", "Free trial: 30 days left" in more and "$25 once" in more and "Get Family Hub" in more, more[:200])
        check("the button goes to the Whop checkout, in a new tab", A.js("(() => { const x = document.querySelector('#fhSheet a.btn.fh-go'); return x.href === PLAN.FAMILY_CHECKOUT_URL && x.target === '_blank' && /noopener/.test(x.rel); })()"))
        A.page.click('#fhSheet [data-fhgo="unlock"]')
        check("'I already bought it' opens Settings at the unlock box", A.js("!document.getElementById('sheet').classList.contains('hidden') && !FH_OPEN && !!document.getElementById('proBox').querySelector('form[data-proform]')"))
        t = A.page.inner_text("#proBox")
        check("the unlock box sells Family Hub at $25 once, not Day Hub Pro", "Family Hub" in t and "$25 once" in t and "Day Hub Pro" not in t and "Get Family Hub" in t, t[:300])
        close_settings(A)
        A.js("fh().me = 'mia'; save(); render()");
        check("a child on the phone: no button, no price, no trial pitch", "$25" not in A.js("fhMoreHtml()") and "Get Family Hub" not in A.js("fhMoreHtml()"))
        check("...and Settings says it's the owner's to make", "You don't need to buy anything" in box(A) and "Get Family Hub" not in A.page.inner_text("#proBox")); close_settings(A)
        A.js("fh().me = 'gma'; save(); render()")
        check("a guest: no price either", "$25" not in A.js("fhMoreHtml()"))
        A.js("fh().me = fhMembers().find(m => m.role === 'owner').id; save(); render()")

        print("\n[Unlocking: the answers the check can give]")
        box(A); unlock(A, "wrong@example.com")
        check("a wrong email: plainly not found, and not unlocked", "No active Family Hub purchase" in A.page.inner_text("#proBox") and not A.js("fhBought()"), A.page.inner_text("#proBox")[:300])
        A.js("setProState({})"); unlock(A, DAYPRO)
        check("a Day Hub Pro answer doesn't count as Family Hub", not A.js("fhBought()") and not A.js("fhTrial().paid"))
        check("...and the box doesn't claim Family Hub is on", "Family Hub is on" not in A.page.inner_text("#proBox"))
        check("...and it says why (that email has Day Hub Pro)", "doesn't include Family Hub" in A.page.inner_text("#proBox"), A.page.inner_text("#proBox")[:300])
        A.js("setProState({})"); A.js(f"unlockPro({json.dumps(CODE)})")
        check("a new phone gets the 6-digit code step, like every Hub", FS.until(A, "/code/i.test(document.getElementById('proBox').textContent)") and not A.js("fhBought()"))
        A.js("setProState({})"); close_settings(A)

        print("\n[After the trial]")
        back_days(A, 29)
        check("day 29: still everything", not A.js("fhPaused()") and A.js("fhTrial().left") == 1)
        back_days(A, 30)
        check("day 30: paused", A.js("fhPaused()") and A.js("fhTrial().left") == 0)
        n0 = json.loads(A.js("JSON.stringify([S.fh.events.length, S.fh.members.length, S.fh.lists.length, S.fh.msgs.length, S.fh.chores.length])"))
        A.js("hideFh(); render()"); home = A.page.inner_text("#cards")
        check("Today says so, and says nothing is lost", "free trial has ended" in home and "Nothing is lost" in home, home[:300])
        check("Today still shows the family's day", "Soccer" in home)
        open_more(A); more = A.page.inner_text("#fhSheet")
        check("More: the trial ended, $25 once, still a Buy button", "free trial has ended" in more and "$25 once" in more and "Get Family Hub" in more)
        A.js("showFh('cal')"); check("the calendar still opens and reads", "Soccer" in A.page.inner_text("#fhSheet"))
        A.js("fhClick({ fhevnew: today() })")
        check("tapping Add Event: refused with the reason, no empty form", A.js("FH_EDIT === null") and "free trial has ended" in toast_of(A), toast_of(A))
        A.js("fhClick({ fhmemnew: '1' })"); check("adding a family member waits", A.js("FH_EDIT === null"))
        for attr in ("fhevent", "fhchore", "fhmember", "fhlistnew", "fhmsend"): add_form(A, attr)
        check("sending a message or adding an event / chore / member / list is refused at the form too", json.loads(A.js("JSON.stringify([S.fh.events.length, S.fh.members.length, S.fh.lists.length, S.fh.msgs.length, S.fh.chores.length])")) == n0)
        A.js("(async () => { const c = document.createElement('input'); c.type = 'file'; c.dataset.fhpadd = '1'; document.body.appendChild(c); c.dispatchEvent(new Event('change', { bubbles: true })); })()")
        check("adding photos is refused", "free trial has ended" in toast_of(A))
        for tap in ("fhmchk", "fhlpack", "fhson"):
            A.js("document.getElementById('toast') && (document.getElementById('toast').textContent = '')"); A.js(f"fhClick({{ {tap}: 'home' }})")
            check(f"a tap that adds or sends waits ({tap})", "free trial has ended" in toast_of(A), toast_of(A))
        check("no list was made by those taps, and sharing didn't turn on", len(json.loads(A.js("JSON.stringify(S.fh.lists)"))) == n0[2] and not A.js("!!FHS"))
        r = A.js("""(() => { const days = fhlDays(), F = fh(); F.meals = F.meals || {}; F.meals[days[0]] = { d: 'Tacos', rid: '' }; const f = document.createElement('form'); f.dataset.fhlmeals = '1';
          const d = { ['m_' + days[0]]: 'Chili', ['m_' + days[1]]: 'Soup' }; fhSubmit(f, d); return JSON.stringify([F.meals[days[0]] && F.meals[days[0]].d, !!F.meals[days[1]]]); })()""")
        check("the week's meals: a day already planned can change, a new day waits", json.loads(r) == ["Chili", False], r)
        A.js("(() => { const c = S.fh.chores[0]; fhClick({ fhdone: c.id + '|' + today() }); })()")
        check("checking off a chore still works", A.js("!!S.fh.chores[0].log[today()]"))
        A.js("showFh('tasks')")
        check("the chores page still opens", "Feed the fish" in A.page.inner_text("#fhSheet"))
        r = A.js("(() => { const f = document.createElement('form'); f.dataset.fhevent = 'e1'; FH_EDIT = 'ev:e1@' + today(); fhSubmit(f, { title: 'Soccer moved', date: today(), time: '18:00', kind: 'sports', rep: 'none' }); return S.fh.events.find(e => e.id === 'e1').title; })()")
        check("fixing what's already there still works (an event's time)", r == "Soccer moved", r)
        r = A.js("(() => { const f = document.createElement('form'); f.dataset.fhcard = '1'; fhSubmit(f, { meet: 'Oak tree', plan: '', sitter: '', doctor: '' }); return S.fh.card.meet; })()")
        check("the emergency card can always be changed", r == "Oak tree", r)
        A.js("hideFh(); render()")
        box(A); unlock(A, GOOD)
        check("the right email unlocks it", A.js("fhBought() && fhTrial().paid && !fhPaused()"), A.page.inner_text("#proBox")[:300])
        t = A.page.inner_text("#proBox")
        check("the box: Family Hub is on, the whole family is covered", "Family Hub is on" in t and "whole family" in t, t[:300])
        close_settings(A); open_more(A)
        check("More: Family Hub is yours, no more Buy button", "Family Hub is yours" in A.page.inner_text("#fhSheet") and "Get Family Hub" not in A.page.inner_text("#fhSheet"))
        A.js("hideFh(); render()"); check("Today: the note is gone", "free trial has ended" not in A.page.inner_text("#cards"))
        r = A.js("(() => { const f = document.createElement('form'); f.dataset.fhlistnew = '1'; fhSubmit(f, { name: 'Party', icon: '🎉' }); return S.fh.lists.some(l => l.name === 'Party'); })()")
        check("adding works again", r, r)
        A.page.reload(); A.page.wait_for_function("typeof render === 'function' && typeof fhsJoin === 'function'")
        check("still unlocked after opening the app again, with no signal needed", A.js("fhBought() && !fhPaused()"))
        A.ctx.close()

        print("\n[A paid unlock doesn't go away by accident]")
        C = wire(FS.phone(b, base, FS.Fake(), "uidC")); C.js(FS.SEED); back_days(C, 40); box(C); unlock(C, GOOD)
        check("unlocked", C.js("fhBought()"))
        def answer(a, status): a.ctx.unroute("**/macros/s/**"); a.ctx.route("**/macros/s/**", lambda r: r.fulfill(status=200, content_type="application/json", body=json.dumps({"valid": False, "status": status})))
        answer(C, "needs code"); C.js(f"verifyPro({json.dumps(GOOD)})"); C.page.wait_for_timeout(200)
        check("a 'confirm this phone' answer on the weekly check doesn't pause a paid family", C.js("fhBought() && !fhPaused()"))
        answer(C, "already on 3 phones"); C.js(f"verifyPro({json.dumps(GOOD)})"); C.page.wait_for_timeout(200)
        check("nor does 'already on 3 phones'", C.js("fhBought() && !fhPaused()"))
        answer(C, "not found"); C.js(f"verifyPro({json.dumps(GOOD)})"); C.page.wait_for_timeout(200)
        check("one 'not found' (Whop's search having a bad day) doesn't either", C.js("fhBought() && !fhPaused()"))
        C.page.clock.fast_forward(8 * 86400000); C.js(f"verifyPro({json.dumps(GOOD)})"); C.page.wait_for_timeout(200)
        check("'not found' again a week later does (a refund)", not C.js("fhBought()") and C.js("fhPaused()"))
        C.ctx.close()
        H = T.App(b, base, path=T.AUTOP); H.page.wait_for_function("typeof forgetBuyerHere === 'function'")
        H.js(f"localStorage.setItem('familyhub.pro', JSON.stringify({{ buyer: {json.dumps(GOOD)}, ok: true, checked: Date.now(), status: 'completed', product: 'familyhub' }})); localStorage.setItem('autohub.pro', JSON.stringify({{ buyer: {json.dumps(GOOD)}, ok: true, checked: Date.now(), status: 'active', product: 'autohub' }})); forgetBuyerHere({json.dumps(GOOD)})")
        check("Remove in another Hub leaves Family Hub's one-time purchase alone", H.js("!!localStorage.getItem('familyhub.pro') && !localStorage.getItem('autohub.pro')"))
        H.ctx.close()

        print("\n[Everyone's phone]")
        fake2 = FS.Fake()
        O = wire(FS.phone(b, base, fake2, "uidO")); O.js(FS.SEED); back_days(O, 10)
        O.js("showFh('share')"); O.page.click('#fhSheet [data-fhson]')
        check("sharing on", FS.until(O, "FHS && FHS_STATE === 'ok'"))
        fid = O.js("FHS.fid")
        check("the family starts not paid", fake2.docs[f"families/{fid}"]["paid"] is False)
        O.page.select_option('#fhSheet form[data-fhsinv] [name=m]', "jen"); O.page.click('#fhSheet form[data-fhsinv] button'); FS.until(O, "FHS_INV && FHS_INV.code.length === 10")
        code = O.js("FHS_INV.code")
        J = wire(FS.phone(b, base, fake2, "uidJ", setup=False)); J.page.fill('form[data-fhsjoin] [name=code]', code); J.page.click('form[data-fhsjoin] button')
        check("Jen joins", FS.until(J, "FHS && FHS_STATE === 'ok' && S.fh.members.length === 4"))
        check("Jen's phone counts from the day the family was made, not the day she joined", FS.until(J, f"fhTrial().left === {O.js('fhTrial().left')}") and J.js("fhTrial().left") == 20, J.js("[fhTrial().left, S.fh.setup]"))
        check("Jen's More has no price and no Buy button during the trial", "$25" not in J.js("fhMoreHtml()"))
        check("Jen's Settings: the purchase is the owner's", "You don't need to buy anything" in box(J)); close_settings(J)
        check("Jen can't mark the family paid", "err" in fake2.op("uidJ", "update", f"families/{fid}", json.dumps({"paid": True})))
        J.js("fhsMarkPaid()"); J.page.wait_for_timeout(200)
        check("...and her phone doesn't try", fake2.docs[f"families/{fid}"]["paid"] is False)
        for x in (O, J): x.page.clock.fast_forward(21 * 86400000)
        FS.until(O, "fhPaused()");
        check("day 31: both phones paused", O.js("fhPaused()") and J.js("fhPaused()"), [O.js("fhTrial()"), J.js("fhTrial()")])
        O.js("showFh('share')"); t = O.page.inner_text("#fhSheet")
        check("the owner's Share page: paused, nothing lost, no invite form", "Sharing is paused" in t and "Nothing is lost" in t and "Make an invite code" not in t, t[:300])
        O.js("hideFh(); render()")
        check("a new invite is refused", O.js("(async () => await fhsInvite('gma'))()") is None)
        w0 = fake2.writes
        J.js("(() => { const L = S.fh.lists.find(l => l.icon === '🛒'); L.items.push({ id: 'i9', text: 'Made while paused', by: 'jen', done: false, at: Date.now() }); save(); })()")
        J.page.clock.run_for(3000); J.page.wait_for_timeout(300)
        check("while paused nothing is sent", fake2.writes == w0, [w0, fake2.writes])
        check("...and what's on Jen's phone stays there", J.js("S.fh.lists.find(l => l.icon === '🛒').items.some(i => i.text === 'Made while paused')"))
        box(O); unlock(O, GOOD); close_settings(O)
        check("the owner unlocks: the family is marked paid", FS.until(O, "FHS_FAM && FHS_FAM.paid === true") and fake2.docs[f"families/{fid}"]["paid"] is True, fake2.docs[f"families/{fid}"].get("paid"))
        check("Jen's phone is covered, with no purchase of her own", FS.until(J, "fhsPaid() && !fhPaused()") and not J.js("fhBought()"))
        check("Jen's Settings: unlocked for the whole family", "Unlocked for your whole family" in box(J)); close_settings(J)
        check("Jen's More: Family Hub is yours", "Family Hub is yours" in J.js("fhMoreHtml()"))
        J.page.clock.run_for(3000)
        check("what waited on Jen's phone catches up to the owner's", FS.until(O, "S.fh.lists.find(l => l.icon === '🛒').items.some(i => i.text === 'Made while paused')"), O.js("[FHS_STATE, FHS_ERR]"))
        fake2.offline.add("uidJ"); J.page.reload(); J.page.wait_for_function("typeof render === 'function' && typeof fhsJoin === 'function'")
        check("Jen's phone opens offline and still knows the family is paid", J.js("fhsPaid() && !fhPaused()"))
        fake2.offline.discard("uidJ")
        check("the owner can't take paid back from a phone", "err" in fake2.op("uidO", "update", f"families/{fid}", json.dumps({"paid": False})))
        O.ctx.close(); J.ctx.close()

        print("\n[Buying on the owner's second phone]")
        fake5 = FS.Fake()
        M1 = wire(FS.phone(b, base, fake5, "uidM")); M1.js(FS.SEED); M1.js("showFh('share')"); M1.page.click('#fhSheet [data-fhson]'); FS.until(M1, "FHS && FHS_STATE === 'ok'")
        mid = M1.js("fhMe().id"); fid5 = M1.js("FHS.fid")
        M1.page.select_option('#fhSheet form[data-fhsinv] [name=m]', mid); M1.page.click('#fhSheet form[data-fhsinv] button'); FS.until(M1, "FHS_INV && FHS_INV.code.length === 10"); c5 = M1.js("FHS_INV.code")
        M2 = wire(FS.phone(b, base, fake5, "uidM2", setup=False)); M2.page.fill('form[data-fhsjoin] [name=code]', c5); M2.page.click('form[data-fhsjoin] button')
        check("the owner's tablet joins", FS.until(M2, "FHS && FHS_STATE === 'ok' && S.fh.members.length === 4"))
        check("it's the owner's person, but an adult to the server", M2.js("fhRole()") == "owner" and fake5.docs[f"families/{fid5}"]["members"]["uidM2"]["role"] == "adult", M2.js("fhRole()"))
        box(M2); unlock(M2, GOOD)
        check("buying on the second phone marks the family paid", FS.until(M2, "FHS_FAM && FHS_FAM.paid === true") and fake5.docs[f"families/{fid5}"]["paid"] is True, fake5.docs[f"families/{fid5}"].get("paid"))
        check("...and the first phone is covered", FS.until(M1, "fhsPaid()"))
        M1.ctx.close(); M2.ctx.close()

        print("\n[Bought first, shared later]")
        fake3 = FS.Fake()
        B1 = wire(FS.phone(b, base, fake3, "uidB")); B1.js(FS.SEED); bought(B1); B1.js("showFh('share')"); B1.page.click('#fhSheet [data-fhson]')
        FS.until(B1, "FHS && FHS_STATE === 'ok'"); fid3 = B1.js("FHS.fid")
        check("turning sharing on after buying marks the family paid", FS.until(B1, "FHS_FAM && FHS_FAM.paid === true") and fake3.docs[f"families/{fid3}"]["paid"] is True)
        B1.ctx.close()

        print("\n[The server says no, for any reason]")
        class Refuse(FS.Fake):
            def op(self, uid, op, path, payload, batch_dels=()):
                if op == "update" and payload and '"paid"' in payload: return {"err": "permission-denied"}
                return super().op(uid, op, path, payload, batch_dels)
        fake4 = Refuse()
        R1 = wire(FS.phone(b, base, fake4, "uidR")); R1.js(FS.SEED); bought(R1); R1.js("showFh('share')"); R1.page.click('#fhSheet [data-fhson]')
        check("a refused mark doesn't turn the phone away or stop sharing", FS.until(R1, "FHS && FHS_STATE === 'ok'") and R1.js("FHS_STATE") == "ok" and R1.js("!!FHS"), R1.js("[FHS_STATE, FHS_ERR]"))
        check("...and the buyer stays unlocked", R1.js("fhBought() && !fhPaused()"))
        R1.js("showFh('share')")
        check("...and the Share page says the family hasn't heard yet", FS.until(R1, "/haven't heard yet/.test(document.getElementById('fhSheet').textContent)"), R1.page.inner_text("#fhSheet")[:200])
        R1.ctx.close()

        print("\n[The owner's own phone, and the Play app]")
        Z = wire(FS.phone(b, base, FS.Fake(), "uidZ")); Z.js(FS.SEED); back_days(Z, 40); Z.js("localStorage.setItem(OWNER_KEY, JSON.stringify({ OWNER: true }))")
        check("the phone with the owner switch is never paused", not Z.js("fhPaused()") and Z.js("fhBought()"))
        Z.ctx.close()
        P = T.App(b, base, path=T.FAMILYP + "?src=play")
        P.page.wait_for_function("typeof fhSetupHtml === 'function'")
        P.page.fill('form[data-fhsetup] [name=fam]', "Fam"); P.page.fill('form[data-fhsetup] [name=name]', "Pat"); P.page.click('form[data-fhsetup] button'); P.page.wait_for_function("S.fh && S.fh.setup")
        back_days(P, 40)
        check("the Play app: never paused, no Buy button, no price", P.js("STORE_MODE") and not P.js("fhPaused()") and "$25" not in P.js("fhMoreHtml()") and "Get Family Hub" not in P.js("fhMoreHtml()"))
        t = box(P)
        check("the Play app's Settings: no price, no Whop link", "$25" not in t and "Whop" not in t and "Get Family Hub" not in t, t[:300])
        check("the 1.59.1 What's New line has no price or purchase words (it can show in a Play app)", P.js("(async () => { const j = await (await fetch('../dayhub/version.json?x=1', { cache: 'no-store' })).json(); return j.notes['1.59.1'].every(n => playOk(n) && !/purchase|buy|\\$/i.test(n)); })()"))
        P.ctx.close()

        errs = [e for e in T.ERRORS[before:] if "the server responded" not in e]
        check("no page errors", not errs, errs[:4])
        b.close()
    srv.shutdown()
    print(f"\n{OK} passed, {FAIL} failed")
    sys.exit(1 if FAIL else 0)

if __name__ == "__main__":
    main()
