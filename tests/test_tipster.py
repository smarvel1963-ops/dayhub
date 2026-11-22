"""
SAVE AS: test_tipster.py   LOCATION: C:/MarvelApps/dayhub/tests/test_tipster.py

TINY TIPSTER, engine 1.74 (Scott 11/21: "what do you think about tiny tipsters to help with apps same way as usemart does" -> "Yes, build it").
tipster.js in all 12 Hubs. What this proves:
- Every Hub (new look, 390 px): on a day after its first, he comes out on Home with that Hub's own emoji and colour, sitting above the
  bottom bar; nothing you can tap is under him (or he is tucked into the edge and lets taps through); one tap opens the tip, which is a
  reminder built from that Hub's OWN saved data; the card fits the screen; ✕ closes it; a reload the same day brings nothing back.
  Settings has the Tiny Tipster row. No page errors.
- Not on the first open: a brand-new phone never loads him, not even after the tour and not later that same day; the next day he comes.
- Once a day, and the "Did you know?" tips rotate day by day through that Hub's own list (and remember what was said).
- The priority order: the update (What's new card on Home, Show me scrolls to it) -> a reminder -> a tip; a reminder comes back once
  on the day before / the day itself.
- Hush: off for that app (nothing loads), Settings shows Off and turns him back on (the next day if he was already out that day).
- Reminders only from real data: nothing saved = a tip; a paid bill, a past date, a date too far off, a pet at the Rainbow Bridge and
  another Hub's data never make one. Every reminder kind (each Hub's own) read straight from its data.
- The switch: TINY_TIPSTER off = no character, no Settings row, the file is never fetched.
- No network: tipster.js has no network calls in it, and showing, opening, Show me and Hush make no requests at all.
- Only on Home: another tab, a full screen opened from Home, Settings, the morning brief or typing keeps him away; he comes back on Home.
- Never covers a button: every Hub, at many scroll spots, 390 and 360 px, both looks; the bottom bar still takes taps.
- Light and dark: his card follows the Hub's look; nothing sideways at 360 / 390 px. TIP_SHOTS=<folder> saves screenshots.
Drives the real app with the main suite's helpers (fake network, frozen clock: Thu 2026-10-01 8 AM Chicago).

RUN:   python tests/test_tipster.py      (from C:/MarvelApps/dayhub)   Exit 0 = all passed.
       TIP_SHOTS=C:/somewhere python tests/test_tipster.py   (also saves the light / dark screenshots there)
"""
import json, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import run_tests as T
from playwright.sync_api import sync_playwright

OK = FAIL = 0
def check(name, cond, extra=""):
    global OK, FAIL
    if cond: OK += 1; print(f"  PASS  {name}", flush=True)
    else: FAIL += 1; print(f"  FAIL  {name}  {extra}", flush=True)

SHOTS = os.environ.get("TIP_SHOTS", "")
if SHOTS: os.makedirs(SHOTS, exist_ok=True)
PATH = {"dayhub": "/", "cruisehub": T.CRUISE, "triphub": T.TRIP, "homehub": T.HOMEP, "autohub": T.AUTOP, "moneyhub": T.MONEYP, "hubuniverse": T.UNIP,
        "healthhub": T.HEALTHP, "familyhub": T.FAMILYP, "pethub": "/../pethub/", "cookinghub": "/../cookinghub/", "jobhub": "/../jobhub/"}
NAME = {"dayhub": "Day Hub", "cruisehub": "Cruise Hub", "triphub": "Trip Hub", "homehub": "Home Hub", "autohub": "Auto Hub", "moneyhub": "Money Hub",
        "hubuniverse": "Hub Universe", "healthhub": "Health Hub", "familyhub": "Family Hub", "pethub": "Pet Hub", "cookinghub": "Cooking Hub", "jobhub": "Job Hub"}
LOOK = {"dayhub": ("☀️", "#f59e0b"), "cruisehub": ("🚢", "#06b6d4"), "triphub": ("✈️", "#a855f7"), "homehub": ("🏡", "#14b8a6"), "autohub": ("🚗", "#ef4444"),
        "moneyhub": ("💰", "#22c55e"), "healthhub": ("❤️", "#2dd4bf"), "familyhub": ("👨‍👩‍👧", "#2e86de"), "pethub": ("🐾", "#f97316"),
        "cookinghub": ("🍳", "#d9442e"), "jobhub": ("💼", "#e2b04a"), "hubuniverse": ("🌌", "#6366f1")}
B = "S.briefDay = today(); S.briefAuto = false; "   # no morning brief over Home on these days (section 9 tests him waiting for it)
# Each Hub's own data, dated around Thu Oct 1 2026, and the reminder it must give.
SEED = {
  "dayhub": (B + "S.name = 'Sam'; S.city = '83702'; S.bills.push({ id: 'b1', name: 'Electric', amount: 80, day: 2, paid: '2026-09' }); save(); render();", "Electric is due tomorrow"),
  "cruisehub": (B + "S.name = 'Sam'; S.trips.push({ id: 'tr1', type: 'cruise', name: 'Caribbean', start: '2026-10-10', end: '2026-10-17' }); save(); render();", "Caribbean sails on Oct 10 (in 9 days)"),
  "triphub": (B + "S.name = 'Sam'; S.trips.push({ id: 'tr1', type: 'trip', name: 'Florida', start: '2026-10-20', end: '2026-10-25' }); save(); render();", "Florida starts on Oct 20 (in 19 days)"),
  "homehub": (B + "house().spaces.push({ id: 'sp1', key: 'kitchen', icon: '🍳', name: 'Kitchen', area: 'indoor', floor: '', items: [], tasks: [{ id: 't1', title: 'Clean dishwasher filter', due: '2026-10-05', every: 3, done: false }], notes: '' }); S.house.type = 'house'; save(); render();", "Clean dishwasher filter - on Monday (in 4 days)"),
  "autohub": (B + "garage().cars.push({ id: 'c1', nick: 'Truck', miles: 31000, services: [{ id: 'sv1', kind: 'oil', date: '2026-04-10', miles: 30000 }], fuel: [], odo: [], papers: [], extras: [], notes: [], photos: [], mech: [] }); save(); render();", "Oil change due - on Oct 10 (in 9 days)"),
  "moneyhub": (B + "S.mh = { setup: true, accounts: [], tx: [], subs: [] }; S.bills.push({ id: 'b1', name: 'Rent', amount: 1200, day: 3, paid: '2026-09' }); save(); render();", "Rent is due on Saturday (in 2 days)"),
  "hubuniverse": (B + "localStorage.setItem('dayhub.v1', JSON.stringify({ name: 'Sam', events: [{ id: 'e1', day: '2026-10-02', time: '14:00', title: 'Dentist', where: '', rep: 'none' }] })); save(); render();", "Dentist - tomorrow at 2:00 PM"),
  "healthhub": (B + "S.hh = { setup: true, appts: [{ id: 'a1', date: '2026-10-03', time: '10:30', doctor: 'Dr. Lee', specialty: '', reason: 'Checkup', where: 'Main St Clinic', q: [] }], meds: [] }; save(); render();", "Checkup - on Saturday at 10:30 AM (in 2 days)"),
  "familyhub": (B + "fh(); S.fh.setup = true; S.fh.events.push({ id: 'fe1', title: 'Soccer', date: '2026-10-02', time: '09:00', kind: 'sports', rep: 'none', who: [], skip: [], where: 'Field 3' }); FH_FIXED = null; save(); render();", "Soccer - tomorrow at 9:00 AM"),
  "pethub": (B + "S.pt = { setup: true, pets: [{ id: 'pp1', name: 'Biscuit', species: 'dog', bday: '2020-11-12' }], shots: [], visits: [{ id: 'v1', pet: 'pp1', date: '2026-10-07', time: '09:00', vet: 'Happy Paws', reason: 'Yearly checkup' }], meds: [], care: [], weights: [], mems: [], papers: [] }; save(); render();", "Biscuit: vet visit - on Wednesday at 9:00 AM (in 6 days)"),
  "cookinghub": (B + "ck(); S.ck.setup = true; S.ck.pantry.push({ id: 'pa1', name: 'Milk', cat: 'ing', exp: '2026-10-03' }); save(); render();", "Milk - use by - on Saturday (in 2 days)"),
  "jobhub": (B + "jh(); S.jh.setup = true; S.jh.jobs.j1 = { id: 'j1', t: 'Fleet Manager', co: 'Acme Freight', st: 'interview', iv: '2026-10-06T14:00', fu: '', fuDone: false, add: '2026-09-20' }; save(); render();", "Interview: Fleet Manager - on Tuesday at 2:00 PM (in 5 days)"),
}
# Just set up, nothing dated: what a Hub has with no reminder to give.
PLAIN = {
  "pethub": B + "S.pt = { setup: true, pets: [{ id: 'pp1', name: 'Biscuit', species: 'dog' }], shots: [], visits: [], meds: [], care: [], weights: [], mems: [], papers: [] }; save(); render();",
  "moneyhub": B + "S.mh = { setup: true, accounts: [], tx: [], subs: [] }; save(); render();",
}
SHOWN = "(() => { const r = document.getElementById('tipRoot'); return !!r && !r.classList.contains('hidden') && !!r.querySelector('.tip-peek'); })()"
LOADED = "!!document.querySelector('script[src*=\"tipster.js\"]') || typeof tipSync === 'function'"
STATE = "JSON.parse(localStorage.getItem(APP_ID + '.tipster') || '{}')"
# Is anything you can tap under him? (the box he takes: out in full, or the 20 px sliver when tucked). Only what is really on top counts.
COVER = """(() => {
  const r = document.getElementById('tipRoot'); if (!r || r.classList.contains('hidden')) return { shown: false };
  const tucked = r.classList.contains('tucked'), nohit = r.classList.contains('nohit'), face = r.querySelector('.tip-face'), peek = r.querySelector('.tip-peek'), rr = r.getBoundingClientRect();
  const box = tucked ? { l: 0, t: rr.top, r: Math.max(1, rr.left - 42 + face.offsetWidth), b: rr.top + face.offsetHeight } : { l: rr.left, t: rr.top, r: rr.left + peek.offsetWidth, b: rr.top + peek.offsetHeight };
  const SEL = 'button, a[href], input, select, textarea, [role=button], [role=tab], [role=link], summary, label';
  const hits = [...document.querySelectorAll(SEL)].filter(e => !e.closest('#tipRoot') && e.getClientRects().length).filter(e => { const s = getComputedStyle(e); return s.visibility !== 'hidden' && s.pointerEvents !== 'none' && Number(s.opacity) > .05; })
    .map(e => [e, e.getBoundingClientRect()]).filter(([e, q]) => q.width > 2 && q.height > 2 && q.left < box.r && q.right > box.l && q.top < box.b && q.bottom > box.t)
    .filter(([e, q]) => { const x = (Math.max(q.left, box.l) + Math.min(q.right, box.r)) / 2, y = (Math.max(q.top, box.t) + Math.min(q.bottom, box.b)) / 2;
      const top = [...document.elementsFromPoint(x, y)].find(z => !z.closest('#tipRoot')); return !!top && (top === e || e.contains(top)); })
    .map(([e]) => (e.innerText || e.getAttribute('aria-label') || e.className || e.tagName).toString().trim().slice(0, 30));
  const bars = [...document.querySelectorAll('body *')].filter(e => e.getClientRects().length && getComputedStyle(e).position === 'fixed' && !e.closest('#tipRoot') && e.id !== 'toast')
    .map(e => e.getBoundingClientRect()).filter(q => q.top > innerHeight * .55 && q.height < innerHeight * .45);
  const onBar = bars.some(q => q.left < box.r && q.right > box.l && q.top < box.b && q.bottom > box.t);
  return { shown: true, tucked, nohit, hits, onBar, sideways: document.documentElement.scrollWidth > innerWidth + 1, box: [box.l, box.t, box.r, box.b].map(Math.round) };
})()"""
errors = []


class Phone:
    """One phone (one browser profile). open(day) = the Hub opened on that day; the phone's storage carries over between days."""
    def __init__(self, b, base, hid, width=390, height=844, look=None, tip=True, extra=None, scheme=None, tour_seen=True):
        self.base, self.hid, self.page = base, hid, None
        kw = {"viewport": {"width": width, "height": height}, "timezone_id": "America/Chicago", "permissions": ["notifications"]}
        if scheme: kw["color_scheme"] = scheme
        self.ctx = b.new_context(**kw)
        if not tour_seen: self.ctx.add_init_script("try { sessionStorage.setItem('tour.test', '1'); } catch (e) {}")   # before run_tests.NO_TOUR, so it stands aside
        T.route(self.ctx)
        self.ctx.add_init_script("try { if (!localStorage.getItem('cruisehub.startTab')) localStorage.setItem('cruisehub.startTab', 'home'); } catch (e) {}")
        if look: self.ctx.add_init_script("try { for (const h of ['dayhub', 'cruisehub', 'triphub', 'homehub', 'autohub', 'moneyhub', 'healthhub']) "
                                          "if (!localStorage.getItem(h + '.look')) localStorage.setItem(h + '.look', '" + look + "'); } catch (e) {}")
        if tip: self.ctx.add_init_script("window.__TIP = true")                # test phones leave him out unless asked (ui.js tipMaybe)
        self.ctx.add_init_script("""(() => { window.__net = []; const f = window.fetch; window.fetch = function (u) { window.__net.push('fetch ' + String(u && u.url || u)); return f.apply(this, arguments); };
          const o = XMLHttpRequest.prototype.open; XMLHttpRequest.prototype.open = function (m, u) { window.__net.push('xhr ' + u); return o.apply(this, arguments); };
          if (navigator.sendBeacon) { const s = navigator.sendBeacon.bind(navigator); navigator.sendBeacon = (u, d) => { window.__net.push('beacon ' + u); return s(u, d); }; } })()""")
        if extra: extra(self)
        self.reqs = []

    def open(self, day="2026-10-01", hour="08:00"):
        if self.page: self.page.close()
        self.page = self.ctx.new_page()
        self.page.on("pageerror", lambda e: errors.append(f"{self.hid}: {e}"))
        self.page.on("console", lambda m: errors.append(f"{self.hid} console: {m.text}") if m.type == "error" and "favicon" not in m.text and "Failed to load resource" not in m.text else None)
        self.page.on("request", lambda r: self.reqs.append(r.url))
        self.page.clock.install(time=f"{day}T{hour}:00-05:00")
        self.page.goto(self.base + PATH[self.hid])
        self.page.wait_for_function("typeof render === 'function' && typeof tipMaybe === 'function'")
        return self

    def age(self):
        """His first day here was yesterday. Written with the Hub closed: a first-open page still running would mark today again."""
        if self.page: self.page.close(); self.page = None
        pg = self.ctx.new_page(); pg.goto(self.base + "/privacy.html")
        pg.evaluate(f"localStorage.setItem('{self.hid}.tipster', JSON.stringify({{ born: '2026-09-30' }}))"); pg.close()
        return self

    def js(self, expr): return self.page.evaluate(expr)
    def wait_tip(self, ms=10000):
        try: self.page.wait_for_function(SHOWN, timeout=ms); self.page.wait_for_timeout(400); return True
        except Exception: return False
    def shown(self): return self.js(SHOWN)
    def quiet(self, ms=4200):                                                  # longer than he ever waits (2.5 s calm + the 0.7 s loop)
        self.page.wait_for_timeout(ms); return not self.shown()
    def state(self): return self.js(STATE)
    def card(self): return self.js("(document.querySelector('#tipRoot .tip-card:not([hidden])') || {}).innerText || ''")
    def open_card(self):
        if "nohit" in self.js("document.getElementById('tipRoot').className"): self.js("tipOpenCard()")   # tucked over something: as if scrolled to a clear spot
        else: self.page.click("#tipRoot .tip-face")
        self.page.wait_for_timeout(250)
    def tap(self, sel, ms=250): self.page.click(sel); self.page.wait_for_timeout(ms)
    def shot(self, name):
        if SHOTS: self.page.screenshot(path=os.path.join(SHOTS, name + ".png"))
    def close(self): self.ctx.close()


def ready(b, base, hid, seed=None, **kw):
    """A phone that opened the Hub yesterday (seeded), opened again today: Tiny Tipster's day."""
    a = Phone(b, base, hid, **kw).open()
    a.js(seed if seed is not None else SEED[hid][0])
    return a.age().open()


def covers_ok(r): return r.get("shown") and not r["onBar"] and not r["sideways"] and (not r["hits"] or (r["tucked"] and r["nohit"]))


def sweep(a, label, steps=7):
    """Scroll the Home page top to bottom; at each stop he must cover nothing you can tap."""
    bad, seen = [], set()
    h = a.js("document.documentElement.scrollHeight - innerHeight")
    for i in range(steps + 1):
        a.js(f"window.scrollTo(0, {int(h * i / steps)})"); a.page.wait_for_timeout(450)
        r = a.js(COVER); seen.add("tucked" if r.get("tucked") else "out")
        if not covers_ok(r): bad.append((i, r))
    a.js("window.scrollTo(0, 0)"); a.page.wait_for_timeout(450)
    check(f"{label}: at {steps + 1} scroll spots nothing you can tap is under him, he stays off the bottom bar, nothing sideways ({'/'.join(sorted(seen))})", not bad, bad[:2])


def main():
    srv, base = T.serve()
    with sync_playwright() as p:
        b = p.chromium.launch()

        print("\n[1. every Hub: out on Home with its own face, a reminder from its own data, ✕, once a day, Settings row]")
        for hid in PATH:
            name, (emo, col) = NAME[hid], LOOK[hid]
            a = ready(b, base, hid)
            if not a.wait_tip(): check(f"{name}: he comes out on Home", False, a.state()); a.close(); continue
            check(f"{name}: he comes out on Home", True)
            check(f"{name}: his own face and colour ({emo})", a.js("document.querySelector('#tipRoot .tip-face').innerText.trim()") == emo
                  and a.js("document.getElementById('tipRoot').style.getPropertyValue('--tc')") == col)
            r = a.js(COVER)
            check(f"{name}: nothing you can tap under him, off the bottom bar, nothing sideways", covers_ok(r), r)
            st = a.state()
            check(f"{name}: today's pick is a reminder", (st.get("pick") or {}).get("k") == "rem", st)
            if hid in ("pethub", "moneyhub", "cookinghub", "healthhub", "familyhub", "dayhub"): a.shot(f"{hid}_390_peek")
            a.open_card()
            txt = a.card()
            check(f"{name}: one tap opens it - '{SEED[hid][1]}' (its own data)", "Heads up".upper() in txt.upper() and SEED[hid][1] in txt, txt[:200])
            check(f"{name}: the card fits the screen", a.js("(() => { const c = document.querySelector('#tipRoot .tip-card').getBoundingClientRect(); return c.left >= 0 && c.right <= innerWidth && c.top >= 0 && document.documentElement.scrollWidth <= innerWidth + 1; })()"))
            check(f"{name}: the card says Hush and has Got it", "Hush" in txt and "Got it" in txt)
            if hid in ("pethub", "moneyhub", "cookinghub", "healthhub", "familyhub", "dayhub"): a.shot(f"{hid}_390_card")
            a.tap("#tipRoot .tip-x")
            check(f"{name}: ✕ closes it, done for today", not a.js("!!document.getElementById('tipRoot')") and a.state().get("done") is True and a.state().get("day") == "2026-10-01")
            a.open()
            check(f"{name}: opened again the same day - nothing, and the file isn't even fetched", a.quiet() and not a.js(LOADED))
            a.js("openSettings()"); a.page.wait_for_timeout(200)
            check(f"{name}: Settings has Tiny Tipster (On), right under Tools", a.js("(() => { const t = document.getElementById('tipSetBox'); return !!t && /Tiny Tipster/.test(t.innerText) && /On/.test(t.innerText) && t.previousElementSibling && t.previousElementSibling.id === 'bxSetBox'; })()"))
            a.close()

        print("\n[2. not on the first open: the tour has that day]")
        a = Phone(b, base, "dayhub", tour_seen=False).open()
        a.page.wait_for_timeout(600)
        check("a brand-new phone: the tour opens", a.js("(() => { const t = document.getElementById('tourSheet'); return !!t && !t.classList.contains('hidden'); })()"))
        a.js("tourClose()"); a.page.wait_for_timeout(300)
        check("...and after the tour, no Tiny Tipster on the first open (the file isn't fetched)", a.quiet() and not a.js(LOADED))
        check("his notebook marks today as this Hub's first day here", a.state().get("born") == "2026-10-01", a.state())
        a.js(SEED["dayhub"][0]); a.open()
        check("opened again later that day (with plans saved): still nothing", a.quiet() and not a.js(LOADED))
        a.open("2026-10-02")
        check("the next day: he comes out", a.wait_tip())
        a.close()
        a = Phone(b, base, "pethub").open()
        check("Pet Hub's first open (tour already seen): nothing", a.quiet() and not a.js(LOADED))
        a.close()

        print("\n[3. once a day; the tips rotate through the Hub's own list and remember what was said]")
        a = ready(b, base, "pethub", seed=PLAIN["pethub"])
        L = a.js("tipList().map(x => x.id)") if a.wait_tip() else []
        ids = []
        for k, day in enumerate(["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04"]):
            if k: a.open(day)
            if not a.wait_tip(): ids.append(None); continue
            st = a.state(); ids.append((st.get("pick") or {}).get("key"))
            a.open_card()
            if k == 0: check("no reminder saved: a 'Did you know?' tip", "DID YOU KNOW" in a.card().upper(), a.card()[:120])
            a.tap("#tipRoot .tip-ok")
            a.open(day); check(f"{day}: once - a reload brings nothing", a.quiet(3600))
        check("4 days, 4 different tips, in the list's order", ids == L[:4] and len(set(ids)) == 4, (ids, L[:5]))
        check("Pet Hub's list: 6 of its own + 4 every Hub has, its own first", len(L) == 10 and L[:2] == ["bday", "shots"] and L[2] == "tools", L)
        check("what was said is remembered", a.state().get("tips") == ids, a.state())
        a.js("(() => { const t = JSON.parse(localStorage.getItem(APP_ID + '.tipster')); t.tips = " + json.dumps(L) + "; localStorage.setItem(APP_ID + '.tipster', JSON.stringify(t)); })()")
        a.open("2026-10-05"); a.wait_tip()
        check("every tip said once: round again from the first", (a.state().get("pick") or {}).get("key") == L[0] and a.state().get("tips") == [L[0]], a.state())
        tips = a.js("tipList().map(x => x.text).join(' | ')")
        check("Pet Hub's tips are Pet Hub's (pet words, no other Hub's features)", "pet" in tips.lower() and "Cook Along" not in tips and "VIN" not in tips)
        check("no price or plan words in any Hub's tips (the Play apps' rule, app.js playOk)", not a.js("Object.values(TIP_TIPS).flat().concat(TIP_COMMON).some(t => !playOk(t[1]) || /\\$\\d|whop|\\/month|\\/year|price/i.test(t[1]))"))
        check("every Hub has 6 tips of its own, 10 in all", a.js("Object.keys(TIP_TIPS).length === 12 && Object.values(TIP_TIPS).every(l => l.length === 6) && TIP_COMMON.length === 4"))
        a.close()

        print("\n[4. the order: the update first, then a reminder, then a tip]")
        a = Phone(b, base, "moneyhub").open()
        a.js(B + "S.mh = { setup: true, accounts: [], tx: [], subs: [] }; S.bills.push({ id: 'b1', name: 'Rent', amount: 1200, day: 5, paid: '2026-09' }); S.seenVersion = '1.73'; save(); render();")
        a.age().open()
        check("day 1, just updated: the What's new card is on Home", a.wait_tip() and a.js("!!document.querySelector('#cards .whatsnew')"))
        a.open_card(); txt = a.card()
        check("day 1: 'New in 1.74' with this version's first note", "NEW IN 1.74" in txt.upper() and "Tiny Tipster" in txt and "See what's new" in txt, txt[:200])
        a.js("window.scrollTo(0, document.documentElement.scrollHeight)"); a.page.wait_for_timeout(300)
        a.tap("#tipRoot .tip-go", 900)
        check("See what's new brings the What's new card into view", a.js("(() => { const c = document.querySelector('#cards .whatsnew').getBoundingClientRect(); return c.bottom > 0 && c.top < innerHeight; })()"))
        a.open("2026-10-02")
        check("day 2: the What's new card is still there, but the update was told: a reminder (Rent, in 3 days)", a.wait_tip() and (a.state().get("pick") or {}).get("k") == "rem")
        a.open_card(); check("...'Rent is due on Monday (in 3 days)', $1,200.00", "Rent is due on Monday (in 3 days)" in a.card() and "$1,200.00" in a.card(), a.card()[:160])
        a.tap("#tipRoot .tip-go", 500)
        check("Show on calendar opens this Hub's Calendar on that day", a.js("(() => { const s = document.getElementById('bxSheet'); return !!s && !s.classList.contains('hidden') && BX.day === '2026-10-05'; })()") and "Rent due" in a.js("document.querySelector('#bxSheet .bx-body').innerText"))
        a.js("bxClose()")
        a.open("2026-10-03")
        check("day 3: that reminder was said, nothing else due: a tip", a.wait_tip() and (a.state().get("pick") or {}).get("k") == "tip", a.state())
        a.open_card(); a.tap("#tipRoot .tip-x")
        a.open("2026-10-04")
        check("day 4, the day before: the reminder once more ('tomorrow')", a.wait_tip() and (a.state().get("pick") or {}).get("k") == "rem")
        a.open_card(); check("...'Rent is due tomorrow'", "Rent is due tomorrow" in a.card(), a.card()[:120])
        a.close()
        a = Phone(b, base, "pethub").open()
        a.js(SEED["pethub"][0]); a.js("S.seenVersion = '1.73'; save()")
        a.age().open(); a.wait_tip()
        check("Pet Hub: an update beats a reminder on the same day", (a.state().get("pick") or {}).get("k") == "new", a.state())
        a.close()

        print("\n[5. Hush - and Settings turns him back on]")
        a = ready(b, base, "pethub")
        a.wait_tip(); a.open_card(); a.tap("#tipRoot .tip-hush", 300)
        check("Hush: he's gone and says how to get him back", not a.js("!!document.getElementById('tipRoot')") and "Settings turns him back on" in a.js("document.getElementById('toast').innerText"))
        check("Hush is kept: off in Pet Hub", a.state().get("off") is True)
        a.js("openSettings()"); a.page.wait_for_timeout(200)
        check("Settings shows Tiny Tipster Off", "Off" in a.js("document.getElementById('tipSetBox').innerText") and a.js("document.getElementById('tipSetBox').getAttribute('aria-checked')") == "false")
        a.tap("#tipSetBox", 300)
        check("one tap turns him back on (Settings says On, 'back ... tomorrow')", a.state().get("off") is False and "On" in a.js("document.getElementById('tipSetBox').innerText") and "tomorrow" in a.js("document.getElementById('toast').innerText"))
        a.js("closeSettings()")
        check("...but he already had his bubble today: still one a day", a.quiet(3600))
        a.open("2026-10-02")
        check("the next day: he's back", a.wait_tip())
        a.open_card(); a.tap("#tipRoot .tip-hush", 300)
        a.open("2026-10-03")
        check("hushed again: the next day he stays off, the file isn't fetched", a.quiet() and not a.js(LOADED))
        a.js("openSettings()"); a.page.wait_for_timeout(200); a.tap("#tipSetBox", 300); a.js("closeSettings()")
        check("turned on again on a day he hasn't been out: he comes by today", a.wait_tip())
        a.close()
        a = ready(b, base, "moneyhub")
        a.js("openSettings()"); a.page.wait_for_timeout(200); a.tap("#tipSetBox", 200); a.js("closeSettings()")
        check("Settings can turn him off too: gone at once", a.quiet(1500) and a.state().get("off") is True)
        a.close()

        print("\n[6. reminders only from real data]")
        for label, hid, seed in [
            ("Pet Hub, nothing dated", "pethub", PLAIN["pethub"]),
            ("Pet Hub, a vet visit last week + a shot due in 30 days", "pethub", B + "S.pt = { setup: true, pets: [{ id: 'pp1', name: 'Biscuit', species: 'dog' }], shots: [{ id: 's1', pet: 'pp1', name: 'Rabies', due: '2026-10-31' }], visits: [{ id: 'v1', pet: 'pp1', date: '2026-09-24', vet: 'Happy Paws' }], meds: [], care: [], weights: [], mems: [], papers: [] }; save(); render();"),
            ("Pet Hub, a vet visit for a pet at the Rainbow Bridge", "pethub", B + "S.pt = { setup: true, pets: [{ id: 'pp2', name: 'Old Tom', species: 'cat', passed: '2025-01-01' }], shots: [], visits: [{ id: 'v1', pet: 'pp2', date: '2026-10-03', vet: 'Happy Paws' }], meds: [], care: [], weights: [], mems: [], papers: [] }; save(); render();"),
            ("Money Hub, a bill already paid this month", "moneyhub", B + "S.mh = { setup: true, accounts: [], tx: [], subs: [] }; S.bills.push({ id: 'b1', name: 'Rent', amount: 1200, day: 3, paid: '2026-10' }); save(); render();"),
            ("Pet Hub, a bill due tomorrow saved in Day Hub", "pethub", PLAIN["pethub"] + " localStorage.setItem('dayhub.v1', JSON.stringify({ name: 'Sam', bills: [{ id: 'b1', name: 'Electric', amount: 80, day: 2, paid: '2026-09' }] }));"),
        ]:
            a = ready(b, base, hid, seed=seed)
            got = a.wait_tip()
            check(f"{label}: no reminder - a tip", got and a.js("tipReminders().length") == 0 and (a.state().get("pick") or {}).get("k") == "tip", (a.js("tipReminders().map(r => r.text)") if got else "not shown", a.state()))
            a.close()
        # every reminder kind each Hub reads, straight from its data (no screen needed)
        kinds = [("dayhub", "S.people.push({ id: 'pp1', name: 'Mom', md: '10-04', kind: 'birthday', got: {}, lead: 0 });", "Mom's birthday - on Sunday (in 3 days)"),
                 ("pethub", "S.pt.shots.push({ id: 's1', pet: 'pp1', name: 'Rabies', due: '2026-10-09' });", "Biscuit: Rabies due - on Oct 9 (in 8 days)"),
                 ("healthhub", "S.hh.meds.push({ id: 'm1', name: 'Lisinopril', times: ['08:00'], per: 1, left: 4 });", "Refill Lisinopril - on Monday (in 4 days)"),
                 ("cruisehub", "S.trips[0].finalDue = '2026-10-06'; S.trips[0].total = 2000;", "The final payment for Caribbean is due on Tuesday (in 5 days)"),
                 ("autohub", "garage().cars[0].papers.push({ id: 'pa1', kind: 'registration', name: '', expires: '2026-10-20' });", "Registration renews - on Oct 20 (in 19 days)"),
                 ("jobhub", "S.jh.jobs.j1.fu = '2026-10-02';", "Follow up: Fleet Manager - tomorrow"),
                 ("familyhub", "S.fh.events.push({ id: 'fe2', title: 'Recital', date: '2026-10-08', time: '18:00', kind: 'school', rep: 'none', who: [], skip: [] }); FH_FIXED = null;", None)]
        for hid, more, want in kinds:
            a = Phone(b, base, hid).open(); a.js(SEED[hid][0]); a.js(more + " save(); render();")
            a.page.evaluate("() => new Promise(r => { if (typeof tipReminders === 'function') return r(); const s = document.createElement('script'); s.src = new URL('tipster.js?v=' + VERSION, BASE_URL).href; s.onload = r; document.head.appendChild(s); })")
            R = a.js("tipReminders().map(r => r.text)")
            if want: check(f"{NAME[hid]}: reads '{want}' from its own data", any(want in x for x in R), R)
            else: check("Family Hub: an event a week off is not a reminder yet (1 day ahead for events)", not any("Recital" in x for x in R) and any("Soccer" in x for x in R), R)
            a.close()

        print("\n[7. the switch: TINY_TIPSTER off = no character at all]")
        off = lambda x: x.ctx.route("**/dayhub/features.js", lambda r: r.fulfill(body=open(os.path.join(T.ROOT, "features.js"), encoding="utf-8").read()
                                    .replace("TINY_TIPSTER: true,", "TINY_TIPSTER: false,"), content_type="application/javascript"))
        a = ready(b, base, "pethub", extra=off)
        check("switch off: the switchboard says so", a.js("switchOn('TINY_TIPSTER')") is False)
        check("switch off: no character, the file is never fetched", a.quiet() and not a.js(LOADED) and not any("tipster.js" in u for u in a.reqs))
        a.js("openSettings()"); a.page.wait_for_timeout(200)
        check("switch off: no Tiny Tipster row in Settings", not a.js("!!document.getElementById('tipSetBox')"))
        a.close()
        a = Phone(b, base, "pethub").open()
        check("the switch is ON for everyone", a.js("SWITCHES.TINY_TIPSTER") is True)
        a.close()

        print("\n[8. no network, no AI, no cost]")
        src = open(os.path.join(T.ROOT, "tipster.js"), encoding="utf-8").read()
        code = "\n".join(l.split("//")[0] for l in src.split("\n") if not l.strip().startswith("*") and not l.strip().startswith("/*"))
        net = [w for w in ("fetch(", "XMLHttpRequest", "sendBeacon", "WebSocket", "EventSource", "import(", "http://", "https://", ".src =", "new Image", "navigator.share") if w in code]
        check("tipster.js holds no network call of any kind (and no outside address)", not net, net)
        a = ready(b, base, "healthhub")
        a.wait_tip(); n0, r0 = a.js("window.__net.length"), len(a.reqs)
        a.open_card(); a.tap("#tipRoot .tip-go", 600)                          # Show on calendar
        a.js("bxClose()"); a.page.wait_for_timeout(300)
        check("showing him, opening the tip and Show me made no request at all", a.js("window.__net.length") == n0 and len(a.reqs) == r0, (a.js("window.__net.slice(-3)"), a.reqs[r0:]))
        a.close()
        a = ready(b, base, "cookinghub")
        a.wait_tip(); n0, r0 = a.js("window.__net.length"), len(a.reqs)
        a.open_card(); a.tap("#tipRoot .tip-hush", 400)
        check("Hush made no request either", a.js("window.__net.length") == n0 and len(a.reqs) == r0, a.reqs[r0:])
        a.close()

        print("\n[9. only on Home, and never over what someone is doing]")
        a = ready(b, base, "triphub")
        check("Trip Hub: out on Home", a.wait_tip())
        a.js("shellGo('plan')"); a.page.wait_for_timeout(1000)
        check("another tab: he's not there", not a.shown())
        a.js("shellGo('home')")
        check("back on Home: he comes back", a.wait_tip())
        a.js("openSettings()"); a.page.wait_for_timeout(1000)
        check("Settings open on top: he steps away", not a.shown())
        a.js("closeSettings()"); check("Settings closed: back", a.wait_tip())
        a.open_card(); a.js("openSettings()"); a.page.wait_for_timeout(1000)
        check("opened, then the person went elsewhere: it counts as read", not a.js("!!document.getElementById('tipRoot')") and a.state().get("done") is True)
        a.close()
        a = Phone(b, base, "moneyhub").open(); a.js(SEED["moneyhub"][0].replace(B, "")); a.js("S.briefDay = ''; S.briefAuto = true; save()")
        a.age().open()
        check("Money Hub: the morning brief is open on top", a.js("!!document.querySelector('.brief-body')"))
        check("...he waits while it is", a.quiet(4000))
        a.js("closeBrief()")
        check("brief closed: he comes out", a.wait_tip())
        a.close()
        a = Phone(b, base, "moneyhub").open(); a.js(SEED["moneyhub"][0])
        a.age().open(); a.js("MT_TAB = 'plan'; render()")
        check("Money Hub's Plan tab: not Home, he stays away", a.quiet(3800))
        a.js("MT_TAB = 'home'; render()"); check("Money Hub back on Home: he comes", a.wait_tip())
        a.close()
        a = ready(b, base, "dayhub")
        a.page.wait_for_timeout(800)
        a.js("(() => { const i = document.createElement('input'); i.id = 'tipTypeTest'; i.style.cssText = 'position:fixed;top:10px;left:10px'; document.body.appendChild(i); i.focus(); })()")
        check("someone typing: he doesn't come out", a.quiet(4000))
        a.js("document.getElementById('tipTypeTest').remove(); document.activeElement.blur()")
        check("done typing: he comes", a.wait_tip())
        a.js("DT_SCREEN = 'weather'; render()"); a.page.wait_for_timeout(1000)
        check("Day Hub: a full screen opened from Home (Weather) is not Home: he steps away", a.js("dtOn()") and not a.shown())
        a.js("DT_SCREEN = null; render()")
        check("back to Home: he's back", a.wait_tip())
        a.close()

        print("\n[10. never covers a button: every Hub, many scroll spots, 390 and 360 px, both looks; the bottom bar still takes taps]")
        for hid in PATH:
            a = ready(b, base, hid)
            if a.wait_tip(): sweep(a, f"{NAME[hid]} 390 px")
            else: check(f"{NAME[hid]} 390 px: he came out", False)
            a.close()
        for hid in ("dayhub", "moneyhub", "pethub", "cookinghub", "healthhub", "familyhub", "jobhub", "autohub"):
            a = ready(b, base, hid, width=360, height=740)
            if a.wait_tip(): sweep(a, f"{NAME[hid]} 360 px", steps=6)
            else: check(f"{NAME[hid]} 360 px: he came out", False)
            a.close()
        for hid in ("dayhub", "moneyhub", "healthhub", "homehub", "triphub"):
            a = ready(b, base, hid, look="classic")
            if a.wait_tip(): sweep(a, f"{NAME[hid]} classic look", steps=6)
            else: check(f"{NAME[hid]} classic look: he came out", False)
            a.close()
        a = ready(b, base, "pethub"); a.wait_tip()
        nav = a.js("[...document.querySelectorAll('#ptNav button')].length")
        try: a.page.click("#ptNav button >> nth=1", timeout=3000); took = True
        except Exception as e: took = repr(e)[:160]
        check("Pet Hub: with him out, the bottom bar's buttons still take a tap", nav >= 2 and took is True, took)
        a.close()
        a = ready(b, base, "moneyhub"); a.wait_tip()
        mid = a.js("(() => { const n = document.getElementById('mvNav'); const r = n ? [...n.querySelectorAll('*')].map(e => e.getBoundingClientRect()).filter(q => q.width > 30).reduce((m, q) => Math.min(m, q.top), innerHeight) : innerHeight; const t = document.getElementById('tipRoot').getBoundingClientRect(); return [Math.round(r), Math.round(t.bottom)]; })()")
        check("Money Hub: he sits above the bar's big middle button too", mid[1] <= mid[0], mid)
        a.close()
        a = ready(b, base, "dayhub")
        a.wait_tip(); a.js("UPDATE = { version: '9.9', notes: {} }; paintUpd()"); a.js("TIP.floorAt = 0; tipPlace()"); a.page.wait_for_timeout(200)
        ub = a.js("(() => { const u = document.getElementById('updBar').getBoundingClientRect(), t = document.getElementById('tipRoot').getBoundingClientRect(); return [Math.round(u.top), Math.round(t.bottom)]; })()")
        check("with the Update bar showing he sits above it", ub[1] <= ub[0], ub)
        a.close()

        print("\n[11. light and dark; 360 and 390 px]")
        for hid, width, height, look, scheme in [("pethub", 360, 740, None, None), ("cookinghub", 390, 844, None, None), ("familyhub", 360, 740, None, None),
                                                 ("moneyhub", 360, 740, None, None), ("healthhub", 390, 844, None, None), ("dayhub", 390, 844, "classic", None),
                                                 ("jobhub", 360, 740, None, "dark"), ("pethub", 390, 844, None, "dark")]:
            a = ready(b, base, hid, width=width, height=height, look=look, scheme=scheme)
            if not a.wait_tip(): check(f"{NAME[hid]} {width} px: he came out", False); a.close(); continue
            dark = a.js("document.getElementById('tipRoot').classList.contains('tip-dark')")
            tag = f"{hid}_{width}{'_' + look if look else ''}{'_os-' + scheme if scheme else ''}"
            a.shot(tag + "_peek")
            a.open_card()
            fits = a.js("(() => { const c = document.querySelector('#tipRoot .tip-card').getBoundingClientRect(); return c.left >= 0 && c.right <= innerWidth && c.top >= 0 && document.documentElement.scrollWidth <= innerWidth + 1; })()")
            colors = a.js("(() => { const c = getComputedStyle(document.querySelector('#tipRoot .tip-card')), t = getComputedStyle(document.querySelector('#tipRoot .tip-text')); return [c.backgroundColor + ' ' + c.backgroundImage.slice(0, 30), t.color]; })()")
            want_dark = hid in ("moneyhub", "healthhub", "jobhub") or look == "classic"     # Pet, Cooking and Family Hub are light looks
            check(f"{NAME[hid]} {width} px{' classic' if look else ''}{' (phone set to dark)' if scheme else ''}: his card is {'dark' if want_dark else 'light'} like the Hub, it fits, nothing sideways",
                  fits and dark == want_dark and (("255, 255, 255" in colors[1]) == want_dark), (dark, colors))
            a.shot(tag + "_card")
            a.close()

        b.close()
    srv.shutdown()
    print("\n[page errors]")
    real = [e for e in errors if "ERR_INTERNET_DISCONNECTED" not in e]
    check("no page / console errors anywhere", not real, "\n        " + "\n        ".join(real[:10]))
    print(f"\n{OK} passed, {FAIL} failed")
    return 1 if FAIL else 0


if __name__ == "__main__":
    sys.exit(main())
