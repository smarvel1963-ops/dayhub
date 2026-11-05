"""
SAVE AS: test_restore_file.py   LOCATION: C:/MarvelApps/dayhub/tests/test_restore_file.py

LOAD A BACKUP FILE, IN EVERY HUB (Scott 11/04: "Yes, fix it"). Health Hub's own file listener ran first and emptied the file box, so the restore in
ui.js found nothing and "Load a backup file" silently did nothing. Auto Hub and Money Hub had the same listener problem. Making restore reachable there
opened what restore did next, and the review held it for that. What this proves:
- Every Hub downloads a real backup with its own button, loses the thing, and gets it back with a real tap on Load a backup file.
- A wrong or damaged file says so and changes nothing, on screen and in storage. Closing Settings doesn't write the old name back. Undo works.
- Health, Money and Auto Hub: an older file never hides a newer photo, a new phone shows no empty rows, and the file's rows come back when the photo really
  is on this phone (Start fresh, older file then newer file). The message shows only for photos really elsewhere, and keeps Undo.
- Reminders and the AI's access to notes stay this phone's own choice, on file and Drive restores. Only the background sync's own restore is quiet.
- In those three Hubs, one field or keyed-record name at a time, as text, wrapped in an array, or a list swapped for a look-alike: nothing runs on the Hub's home, its listed tabs or the
  edit forms named in FUZZ. That is a set of records and screens, not every path, and it says nothing about Day, Cruise, Trip or Home Hub's own fields.
- Honest values with quotes and brackets are untouched, and form values round-trip.
Drives the real app with the main suite's helpers (fake network, frozen clock).

RUN:   python tests/test_restore_file.py      (from C:/MarvelApps/dayhub)   Exit 0 = all passed.   Add "payload" for only the payload run.
"""
import copy, json, os, sys, tempfile
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import run_tests as T
from playwright.sync_api import sync_playwright

OK = FAIL = 0
def check(name, cond, extra=""):
    global OK, FAIL
    if cond: OK += 1; print(f"  PASS  {name}")
    else: FAIL += 1; print(f"  FAIL  {name}  {extra}")

PNG1 = bytes.fromhex("89504e470d0a1a0a0000000d4948445200000001000000010806000000" "1f15c4890000000d49444154789c6360000002000001e221bc330000000049454e44ae426082")
PIC = {"name": "pic.png", "mimeType": "image/png", "buffer": PNG1}

# what each Hub keeps of its own: how to add it, how to take it away, how to see it's there, a word that shows on screen
OWN = {
    "Health Hub": ("S.hh = S.hh || {}; S.hh.setup = S.hh.setup || true; S.hh.card = S.hh.card || {}; S.hh.card.allergies = 'peanuts'; S.hh.card.contacts = S.hh.card.contacts || []",
                   "S.hh.card.allergies = ''",
                   "S.hh.card.allergies === 'peanuts'", ""),
    "Money Hub": ("S.mh = S.mh || {}; S.mh.setup = S.mh.setup || true; S.mh.accounts = S.mh.accounts || []; S.mh.accounts.push({ id: 'a1', name: 'Checking', kind: 'checking', bal: 100 })",
                  "S.mh.accounts = S.mh.accounts.filter(x => x.id !== 'a1')",
                  "S.mh.accounts.some(x => x.id === 'a1')", "Checking"),
    "Auto Hub": ("S.garage = S.garage || { cars: [] }; S.garage.cars.push({ id: 'c1', name: 'Truck', year: 2020, make: 'Ford', model: 'F-150' })",
                 "S.garage.cars = S.garage.cars.filter(x => x.id !== 'c1')",
                 "S.garage.cars.some(x => x.id === 'c1')", "F-150"),
}
HUBS = [("Day Hub", ""), ("Cruise Hub", T.CRUISE), ("Trip Hub", T.TRIP), ("Home Hub", T.HOMEP), ("Auto Hub", T.AUTOP),
        ("Money Hub", T.MONEYP), ("Health Hub", T.HEALTHP), ("Hub Universe", T.UNIP)]
THREE = (("Health Hub", T.HEALTHP), ("Money Hub", T.MONEYP), ("Auto Hub", T.AUTOP))
tmp = tempfile.mkdtemp(prefix="restore_")


def open_hub(b, base, path, at="2026-10-01T09:00:00"):
    a = T.App(b, base, path=path, at=at)
    a.page.wait_for_timeout(100)
    for form in ("form[data-setup]", "form[data-homesetup]", "form[data-mhsetup]", "form[data-hhsetup]"):
        if a.js(f"!!document.querySelector('{form}')"):
            for name, val in (("name", "Sam"), ("city", "80202")):
                if a.js(f"!!document.querySelector('{form} [name={name}]')"): a.page.fill(f"{form} [name={name}]", val)
            a.page.click(f"{form} button"); a.page.wait_for_timeout(200)
    if a.js("briefOpen()"): a.page.click('[data-brief="go"]')
    return a

def toast_text(a):
    return a.js("(document.getElementById('toast') || {}).textContent || ''")

def clear_sheets(a):
    a.js("['hhSheet', 'mhSheet', 'autoSheet'].forEach(id => { const e = document.getElementById(id); if (e) e.classList.add('hidden'); })")

def download(a, file_name):
    clear_sheets(a); a.js("openSettings()"); a.page.wait_for_timeout(100)
    with a.page.expect_download() as dl:
        a.page.click('[data-data="export"]')
    p = os.path.join(tmp, file_name); dl.value.save_as(p)
    a.page.click('[data-close="sheet"]'); a.page.wait_for_timeout(100)
    return p

def load(a, path):
    """The way a person does it: open Settings, tap the button, pick the file."""
    clear_sheets(a); a.js("openSettings()"); a.page.wait_for_timeout(100)
    with a.page.expect_file_chooser() as fc:
        a.page.click('[data-data="import"]')
    fc.value.set_files(path)
    a.page.wait_for_timeout(350)


# ------------------------------------------------------------ a full set of records for the one-field-at-a-time test
HEALTH = {"name": "Sam", "city": "80202", "hh": {"setup": "2026-01-01",
  "meds": [{"id": "m1", "name": "Med", "strength": "10mg", "times": ["08:00", "20:00"], "instr": "with food", "left": 30, "per": 1, "refills": 2, "pharmacy": "Pharm", "prescriber": "Dr", "rx": "123", "doctor": "Dr", "purpose": "p", "color": "#ff0000", "start": "2026-01-01", "added": "2026-01-01", "addedT": "08:00"}],
  "workouts": [{"id": "w1", "date": "2026-09-30", "type": "walk", "min": 30, "sets": 3, "reps": 10, "wt": 20, "note": "n"}, {"id": "w2", "date": "2026-10-01", "type": "walk", "min": 20, "sets": 2, "reps": 8, "wt": 15, "note": "n"}],
  "sleep": [{"id": "s1", "date": "2026-09-30", "bed": "22:00", "wake": "06:00", "hrs": 8, "q": 4, "note": "n"}, {"id": "s2", "date": "2026-10-01", "bed": "22:30", "wake": "06:30", "hrs": 8, "q": 3, "note": "n"}],
  "vitals": [{"id": "v1", "date": "2026-09-30", "time": "08:00", "kind": "bp", "sys": 120, "dia": 80, "note": "n"}, {"id": "v2", "date": "2026-09-29", "time": "08:00", "kind": "glucose", "v": 100, "note": "n"}, {"id": "v3", "date": "2026-10-01", "time": "08:00", "kind": "weight", "v": 180}],
  "appts": [{"id": "ap1", "date": "2026-10-05", "time": "09:00", "doctor": "Dr", "specialty": "sp", "reason": "r", "where": "Clinic", "bring": "b", "q": [{"id": "q1", "text": "q"}], "notes": "n"}],
  "vault": [{"id": "vv1", "type": "insurance", "title": "t", "date": "2026-09-30"}], "chal": {"code": "ABC", "nick": "Sam"},
  "medlog": [{"date": "2026-09-30", "text": "t"}], "doses": {"2026-10-01": {"m1|08:00": {"s": "taken", "at": "08:05"}}}, "water": {"2026-10-01": 3}, "steps": {"2026-10-01": 5000},
  "checkins": {"2026-10-01": {"mood": 3, "energy": 3, "note": "n", "sym": ["headache"]}}, "goals": {"water": 8, "steps": 6000, "sleep": 8},
  "card": {"allergies": "a", "conditions": "c", "blood": "O+", "hospital": "h", "doctor": "d", "notes": "n", "contacts": [{"name": "n", "rel": "r", "phone": "5551212"}]}}}
MONEY = {"name": "Sam", "city": "80202", "bills": [{"id": "b1", "name": "Rent", "amount": 900, "day": 15, "paid": "2026-09", "auto": False, "cat": "bills", "url": ""}],
  "goals": [{"id": "g1", "name": "Trip", "target": 1000, "saved": 100, "icon": "💰", "by": "2027-01-01", "pic": ""}],
  "payday": {"freq": "biweekly", "next": "2026-10-09", "amount": 1500, "d1": 1, "d2": 15},
  "mh": {"setup": "2026-01-01", "accounts": [{"id": "a1", "kind": "checking", "name": "Checking", "bal": 100, "apr": 0, "min": 0, "at": "2026-10-01", "web": "bank.com", "src": "manual"}, {"id": "a2", "kind": "credit", "name": "Card", "bal": 500, "apr": 20, "min": 25, "at": "2026-09-01"}],
  "tx": [{"id": "t1", "date": "2026-09-30", "amt": -20, "what": "Food", "cat": "food", "acct": "a1", "src": "scan"}, {"id": "t2", "date": "2026-09-25", "amt": 1500, "what": "Pay", "cat": "pay", "acct": "a1"}],
  "subs": [{"id": "s1", "name": "Stream", "amt": 10, "every": "month", "next": "2026-10-10", "cat": "fun"}],
  "budgets": {"food": 200, "fun": 100}, "plan": {"start": 100, "check": 1000, "bills": 500, "other": 100, "save": 200}, "debt": {"extra": 25, "method": "avalanche"}, "payCash": 300, "payCheck": 1500,
  "vault": [{"id": "dv1", "type": "tax", "title": "t", "date": "2026-09-30"}]}}
AUTO = {"name": "Sam", "city": "80202", "garage": {"gas": 3.5, "cars": [{"id": "c1", "nick": "T", "year": 2020, "make": "Ford", "model": "F-150", "trim": "XL", "engine": "V8", "vin": "1FA6P8CF0L5100001", "miles": 30000, "paid": 30000, "price": 25000, "boughtOn": "2020-01-01", "body": "Pickup", "thumb": "data:image/jpeg;base64,AAAA", "cover": "p1", "every": {"oil": [5000, 6]},
    "services": [{"id": "sv1", "kind": "oil", "date": "2026-09-01", "miles": 29000, "cost": 50, "note": "n"}], "fuel": [{"id": "f1", "date": "2026-09-20", "miles": 29800, "gal": 10, "cost": 30}, {"id": "f2", "date": "2026-09-27", "miles": 30000, "gal": 11, "cost": 33}],
    "odo": [{"id": "o1", "date": "2026-09-27", "miles": 30000}], "papers": [{"id": "pp1", "kind": "insurance", "name": "Ins", "expires": "2026-12-01", "cost": 100, "paid": "2026-01-01", "ref": "r", "note": "n"}],
    "extras": [{"id": "e1", "name": "Mod", "cat": "other", "cost": 10, "status": "installed", "date": "2026-09-01", "note": "n"}], "notes": [{"id": "n1", "date": "2026-09-01", "text": "n"}], "photos": [{"id": "p1", "tag": "car", "date": "2026-09-01", "cap": "c"}],
    "mech": [{"id": "me1", "date": "2026-09-01", "q": "q", "code": "P0300", "a": {"urgency": "soon", "summary": "s", "causes": [{"cause": "c", "why": "w", "likely": "high", "diy": "easy", "cost": "$50"}], "check": "c", "shop": "s"}}, {"id": "me2", "date": "2026-08-01", "q": "q2", "a": {"urgency": "watch", "summary": "s", "causes": [{"cause": "c", "why": "w", "likely": "low", "diy": "shop", "cost": "$9"}], "check": "c", "shop": "s"}}],
    "recalls": {"list": [{"id": "r1", "part": "part", "summary": "sum", "remedy": "fix", "park": True}], "at": "2026-10-01"}, "recallDone": {"r1": True}, "tripCheck": {"tires": True}}]}}
# name, address, records, how to open a screen, the car to open, the edit forms (name, js) on top of the home screen and every listed tab
FUZZ = [("Health Hub", T.HEALTHP, HEALTH, "showHh", None, [("medicine form", "HH_EDIT = 'm1'; showHh('meds'); HH_EDIT = null"), ("appointment form", "HH_APEDIT = 'ap1'; showHh('appts'); HH_APEDIT = null"),
                                                           ("open appointment", "HH_AP = 'ap1'; showHh('appts'); HH_AP = null"), ("visit summary", "HH_VISIT = 'ap1'; showHh('visit'); HH_VISIT = null")]),
        ("Money Hub", T.MONEYP, MONEY, "showMh", None, [("bill form", "MH_PEDIT = 'b1'; showMh('bills'); MH_PEDIT = null"), ("sign-in link form", "MV_WEB = 'a1'; showMh('update'); MV_WEB = ''"), ("transaction form", "MH_EDIT = 't1'; showMh('spend'); MH_EDIT = null"), ("calendar", "MV_PVIEW = 'cal'; showMh('bills'); MV_PVIEW = 'list'")]),
        ("Auto Hub", T.AUTOP, AUTO, "showCar", "c1", [("road trip box", "AUTO_TRIPOPEN = true; showCar('c1', 'fuel'); AUTO_TRIPOPEN = false"), ("one photo", "AUTO_VIEW = 'p1'; showCar('c1', 'photos'); AUTO_VIEW = null")])]
STEP = """([data, fn, arg, extras]) => { const errs = [];
  const tabs = fn === 'showHh' ? HH_TABS.map(x => x[0]) : fn === 'showMh' ? MH_TABS.map(x => x[0]) : AUTO_TABS.map(x => x[0]);
  try { S = normalize(JSON.parse(data)); } catch (e) { return ['normalize: ' + e]; }
  try { render(); } catch (e) { errs.push('home: ' + e); }
  for (const t of tabs) { try { arg ? showCar(arg, t) : window[fn](t); } catch (e) { errs.push(t + ': ' + e); } }
  for (const [name, js] of extras) { try { (0, eval)(js); } catch (e) { errs.push(name + ': ' + e); } }
  return errs; }"""

def leaves(o, path=()):
    if isinstance(o, dict):
        for k, v in o.items(): yield from leaves(v, path + (k,))
    elif isinstance(o, list):
        for i, v in enumerate(o): yield from leaves(v, path + (i,))
    else:
        yield path

def lists(o, path=()):
    """Every field that holds a list: a file can hand back something that only looks like one."""
    if isinstance(o, dict):
        for k, v in o.items(): yield from lists(v, path + (k,))
    elif isinstance(o, list):
        if path: yield path
        for i, v in enumerate(o): yield from lists(v, path + (i,))

def key_maps(o, path=()):
    """Records keyed by a word or a date: the key itself comes from the file too."""
    if isinstance(o, dict):
        if path and (path[-1] in ("budgets", "doses", "water", "steps", "checkins", "recallDone", "tripCheck", "every") or (len(path) >= 2 and path[-2] == "doses")):
            for k in o: yield path, k
        for k, v in o.items(): yield from key_maps(v, path + (k,))
    elif isinstance(o, list):
        for i, v in enumerate(o): yield from key_maps(v, path + (i,))


def payload_run(b, base):
    print("\n[8. a file built to run script: one field at a time, as text and in an array, on the home screen, every listed tab and the named forms]")
    PAY = "'\"><img src=data:,x onerror=__p(%d)>"
    for name, path, fixture, fn, arg, extras in FUZZ:
        a = T.App(b, base, path=path)
        a.page.wait_for_timeout(200)
        a.js("window.__pwn = []; window.__p = i => window.__pwn.push(i); window.showHh = typeof showHh === 'function' ? showHh : null; window.showMh = typeof showMh === 'function' ? showMh : null; setOwnerSwitch('OWNER', true); 0")
        clean = a.page.evaluate(STEP, [json.dumps(fixture), fn, arg, extras])
        check(f"{name}: the records draw every listed screen with nothing thrown, so the run below really reaches them", not clean, clean[:6])
        paths, seen = list(leaves(fixture)), {}
        keys = list(key_maps(fixture))
        for form, wrap in (("text", lambda v: v), ("array", lambda v: [v])):
            for i, lp in enumerate(paths):
                n = len(seen); seen[n] = f"{'.'.join(map(str, lp))} ({form})"
                d = copy.deepcopy(fixture); o = d
                for k in lp[:-1]: o = o[k]
                o[lp[-1]] = wrap(PAY % n)
                a.page.evaluate(STEP, [json.dumps(d), fn, arg, extras])
                if i % 8 == 7: a.page.wait_for_timeout(30)
        like_lists = list(lists(fixture))
        for j, lp in enumerate(like_lists):
            n = len(seen); seen[n] = f"{'.'.join(map(str, lp))} (not a real list)"
            d = copy.deepcopy(fixture); o = d
            for k in lp[:-1]: o = o[k]
            o[lp[-1]] = {"length": PAY % n}
            a.page.evaluate(STEP, [json.dumps(d), fn, arg, extras])
            if j % 8 == 7: a.page.wait_for_timeout(30)
        for j, (mp, k) in enumerate(keys):
            n = len(seen); seen[n] = f"key of {'.'.join(map(str, mp))}"
            d = copy.deepcopy(fixture); o = d
            for x in mp: o = o[x]
            o[PAY % n] = o.pop(k)
            a.page.evaluate(STEP, [json.dumps(d), fn, arg, extras])
            if j % 8 == 7: a.page.wait_for_timeout(30)
        a.page.wait_for_timeout(700)
        ran = sorted(set(a.js("window.__pwn")))
        check(f"{name}: nothing ran, {len(paths)} fields twice + {len(like_lists)} lists + {len(keys)} keys", not ran, [seen.get(i, i) for i in ran][:30])
        a.close()


def main():
    srv, base = T.serve()
    files = {}
    with sync_playwright() as p:
        b = p.chromium.launch()
        if "payload" in sys.argv[1:]:
            payload_run(b, base); b.close(); srv.shutdown()
            print(f"\n{OK} passed, {FAIL} failed")
            return 1 if FAIL else 0

        print("\n[1. every Hub gets its things back from its own backup file, with a real tap]")
        for name, path in HUBS:
            a = open_hub(b, base, path)
            errs = []
            a.page.on("pageerror", lambda e: errs.append(str(e)))
            a.js("S.name = 'Sam'; S.city = '80202'; S.notes = S.notes || []; S.notes.push({ id: 'n1', text: 'Gate code 9981', pinned: false, at: Date.now() }); save()")
            own = OWN.get(name)
            if own: a.js(own[0] + "; save(); render()")
            files[name] = download(a, f"{name.replace(' ', '_')}.json")
            doc = json.load(open(files[name], encoding="utf-8"))
            check(f"{name}: Download my data gives its own backup file", doc.get("app") == a.js("APP_ID") and len(doc["data"]["notes"]) >= 1, doc.get("app"))
            a.js("S.notes = []; save()")
            if own: a.js(own[1] + "; save()")
            check(f"{name}: the things are gone first", a.js("S.notes.length") == 0 and (not own or not a.js(own[2])))
            load(a, files[name])
            check(f"{name}: it says it restored", "Restored from" in toast_text(a), toast_text(a))
            check(f"{name}: Load a backup file brings the note back", a.js("S.notes.length") == 1 and a.js("S.notes[0].text") == "Gate code 9981", a.js("S.notes.length"))
            if own: check(f"{name}: and its own things", a.js(own[2]) is True)
            a.page.click('[data-close="sheet"]'); a.page.wait_for_timeout(150)
            if own and own[3]: check(f"{name}: and they're on the screen", own[3] in a.js("document.body.innerText"), a.js("document.body.innerText")[:120])
            check(f"{name}: the screen isn't the can't-open page", "won't open" not in a.js("document.body.innerText"))
            a.js("S.notes = []; save()")
            load(a, files[name])
            check(f"{name}: the same file can be picked a second time", a.js("S.notes.length") == 1)
            a.page.reload(); a.page.wait_for_function("typeof render === 'function' && document.querySelector('#hero .greet')"); a.page.wait_for_timeout(150)
            check(f"{name}: it's still there after reopening", a.js("S.notes.length") == 1 and a.js("S.notes[0].text") == "Gate code 9981")
            check(f"{name}: no page errors", not errs, errs[:2])
            a.close()

        print("\n[2. a wrong file says so, nothing changes]")
        junk = os.path.join(tmp, "not_a_backup.json")
        with open(junk, "w", encoding="utf-8") as f: json.dump({"hello": "world"}, f)
        broken = os.path.join(tmp, "broken.json")
        with open(broken, "w", encoding="utf-8") as f: f.write("{ not json")
        for name, path in THREE:
            a = open_hub(b, base, path)
            a.js("S.notes = [{ id: 'keep', text: 'Keep me', pinned: false, at: Date.now() }]; save()")
            load(a, junk)
            check(f"{name}: a file that isn't a backup says so", "isn't a" in toast_text(a), toast_text(a))
            check(f"{name}: and nothing changed", a.js("S.notes.length") == 1 and a.js("S.notes[0].id") == "keep")
            load(a, broken)
            check(f"{name}: a broken file says so", "Couldn't read" in toast_text(a), toast_text(a))
            load(a, files["Day Hub"])
            check(f"{name}: Day Hub's file is turned away by name", "Day Hub" in toast_text(a) and a.js("S.notes[0].id") == "keep", toast_text(a))
            a.close()

        print("\n[3. the photo boxes these listeners exist for still work]")
        a = open_hub(b, base, T.HEALTHP)
        a.js("S.hh.setup = true; save(); render(); showHh('vault')"); a.page.wait_for_timeout(250)
        a.page.set_input_files('[data-hhvault]', PIC); a.page.wait_for_function("(S.hh.vault || []).length === 1", timeout=8000)
        check("Health Hub: a vault photo still saves", a.js("S.hh.vault.length") == 1)
        a.close()
        a = open_hub(b, base, T.MONEYP)
        a.js("S.mh.setup = true; save(); render(); showMh('vault')"); a.page.wait_for_timeout(250)
        a.page.set_input_files('#mhSheet [data-mvvault]', PIC); a.page.wait_for_function("(S.mh.vault || []).length === 1", timeout=8000)
        check("Money Hub: a vault photo still saves", a.js("S.mh.vault.length") == 1)
        a.close()

        print("\n[4. closing Settings after a load doesn't write the old name back; Undo works]")
        for name, path in (("Day Hub", ""),) + THREE:
            a = open_hub(b, base, path)
            a.js("S.name = 'Pat'; S.city = '10001'; S.notes = [{ id: 'mine', text: 'Mine', pinned: false, at: Date.now() }]; save()")
            load(a, files[name])
            check(f"{name}: the form shows the restored name", a.js("document.getElementById('setName').value") == "Sam", a.js("document.getElementById('setName').value"))
            a.page.click('[data-close="sheet"]'); a.page.wait_for_timeout(120)
            check(f"{name}: closing Settings keeps the restored name and city", a.js("S.name") == "Sam" and a.js("S.city") == "80202", (a.js("S.name"), a.js("S.city")))
            a.js("S.name = 'Pat'; S.city = '10001'; S.notes = [{ id: 'mine', text: 'Mine', pinned: false, at: Date.now() }]; save()")
            load(a, files[name])
            a.page.click('#toast [data-undo]'); a.page.wait_for_timeout(120)
            check(f"{name}: Undo puts it all back", a.js("S.notes[0].id") == "mine" and a.js("S.name") == "Pat")
            check(f"{name}: the form shows it too", a.js("document.getElementById('setName').value") == "Pat")
            a.page.click('[data-close="sheet"]'); a.page.wait_for_timeout(120)
            check(f"{name}: closing Settings after Undo keeps it", a.js("S.name") == "Pat" and a.js("S.city") == "10001", (a.js("S.name"), a.js("S.city")))
            a.close()

        print("\n[5. photos: this phone's rows stay, the file's come back when the photo is here, the rest stay out]")
        STAY = "photos stay on the phone they were taken on"
        for name, path, key, show, box, thumb, sheet in (("Health Hub", T.HEALTHP, "hh", "showHh", "[data-hhvault]", "img[data-hhthumb]", "#hhSheet"),
                                                         ("Money Hub", T.MONEYP, "mh", "showMh", "#mhSheet [data-mvvault]", "img[data-mvthumb]", "#mhSheet")):
            a = open_hub(b, base, path)
            a.js(f"S.{key}.setup = true; save(); render(); {show}('vault')"); a.page.wait_for_timeout(250)
            a.page.set_input_files(box, PIC); a.page.wait_for_function(f"(S.{key}.vault || []).length === 1", timeout=8000)
            older = download(a, f"{key}_older.json")
            a.js(f"{show}('vault')"); a.page.wait_for_timeout(200)
            a.page.set_input_files(box, PIC); a.page.wait_for_function(f"S.{key}.vault.length === 2", timeout=8000)
            load(a, older)
            check(f"{name}: an older file doesn't hide a newer photo", a.js(f"S.{key}.vault.length") == 2, a.js(f"S.{key}.vault.length"))
            check(f"{name}: and it says nothing about photos, they're all here", STAY not in toast_text(a), toast_text(a))
            clear_sheets(a); a.page.click('[data-close="sheet"]')
            a.js(f"{show}('vault')")
            a.page.wait_for_function(f"[...document.querySelectorAll('{sheet} {thumb}')].filter(i => (i.getAttribute('src') || '').startsWith('data:')).length === 2", timeout=8000)
            check(f"{name}: both photos show", True)
            # Start fresh, then load: the photos never left this phone
            a.js("S = blank(); saveLocal(); 0"); a.page.reload(); a.page.wait_for_function("typeof render === 'function' && document.querySelector('#hero .greet')"); a.page.wait_for_timeout(150)
            load(a, older)
            check(f"{name}: after Start fresh the file's row comes back, its photo is here", a.js(f"S.{key}.vault.length") == 1, a.js(f"S.{key}.vault.length"))
            check(f"{name}: and no message about another phone", STAY not in toast_text(a), toast_text(a))
            check(f"{name}: saved, not just on screen", len(a.js(f"JSON.parse(localStorage.getItem(STORE)).{key}.vault")) == 1)
            clear_sheets(a); a.page.click('[data-close="sheet"]')
            a.js(f"{show}('vault')")
            a.page.wait_for_function(f"[...document.querySelectorAll('{sheet} {thumb}')].filter(i => (i.getAttribute('src') || '').startsWith('data:')).length === 1", timeout=8000)
            check(f"{name}: and that photo shows", True)
            a.close()
            a = open_hub(b, base, path)
            a.js("S.notes = [{ id: 'mine', text: 'Mine', pinned: false, at: 1 }]; save()")
            load(a, older)
            check(f"{name}: new phone: the file's data came", a.js(f"!!S.{key}.setup"))
            check(f"{name}: new phone: no rows for photos that aren't here", a.js(f"S.{key}.vault.length") == 0, a.js(f"S.{key}.vault.length"))
            check(f"{name}: new phone: it says where the photos are", STAY in toast_text(a), toast_text(a))
            check(f"{name}: new phone: and Undo is still there", a.js("!!document.querySelector('#toast [data-undo]')"))
            a.page.click('#toast [data-undo]'); a.page.wait_for_timeout(120)
            check(f"{name}: new phone: Undo works from that message", a.js("S.notes[0].id") == "mine")
            a.close()
        # Auto Hub
        def auto_setup(a):
            a.page.fill('form[data-autosetup] [name=city]', "83702"); a.page.fill('form[data-autosetup] [name=vin]', "1FA6P8CF0L5100001"); a.page.fill('form[data-autosetup] [name=miles]', "30000")
            a.page.click('form[data-autosetup] button'); a.page.wait_for_function("S.garage && S.garage.cars.length === 1")
            if a.js("briefOpen()"): a.page.click('[data-brief="go"]')
        AP = {"name": "car.png", "mimeType": "image/png", "buffer": T._png()}
        a = T.App(b, base, path=T.AUTOP, at="2026-10-01T09:00:00")
        auto_setup(a)
        cid = a.js("S.garage.cars[0].id")
        a.page.click(f'[data-acar="{cid}"]'); a.page.click('#autoSheet [data-atab="photos"]')
        a.page.set_input_files('#autoSheet [data-aphotoadd]', AP); a.page.wait_for_function("S.garage.cars[0].photos.length === 1 && S.garage.cars[0].thumb", timeout=8000)
        check("Auto Hub: a car photo still saves", a.js("S.garage.cars[0].photos.length") == 1)
        check("Auto Hub: its file box is empty after", a.js("[...document.querySelectorAll('#autoSheet [data-aphotoadd]')].every(i => !i.value)"))
        cover, thumb = a.js("S.garage.cars[0].cover"), a.js("S.garage.cars[0].thumb")
        older = download(a, "auto_older.json")
        a.js(f"showCar('{cid}', 'photos')"); a.page.wait_for_timeout(200)
        a.page.set_input_files('#autoSheet [data-aphotoadd]', AP); a.page.wait_for_function("S.garage.cars[0].photos.length === 2", timeout=8000)
        a.js("S.garage.cars.push({ id: 'later', year: 2021, make: 'Kia', model: 'Soul', photos: [] }); save(); render(); showCar('later', 'photos')"); a.page.wait_for_timeout(200)
        a.page.set_input_files('#autoSheet [data-aphotoadd]', AP); a.page.wait_for_function("S.garage.cars[1].photos.length === 1 && S.garage.cars[1].thumb", timeout=8000)
        later_cover, later_thumb = a.js("S.garage.cars[1].cover"), a.js("S.garage.cars[1].thumb")
        newer = download(a, "auto_newer.json")
        load(a, older)
        check("Auto Hub: an older file doesn't hide a newer photo", a.js("S.garage.cars[0].photos.length") == 2, a.js("S.garage.cars[0].photos.length"))
        check("Auto Hub: the cover stays", a.js("S.garage.cars[0].cover") == cover and a.js("S.garage.cars[0].thumb") == thumb)
        check("Auto Hub: a car added after the file goes with the file", a.js("S.garage.cars.length") == 1)
        a.page.click('#toast [data-undo]'); a.page.wait_for_timeout(120)
        check("Auto Hub: Undo brings that car back", a.js("S.garage.cars.length") == 2)
        load(a, older)
        check("Auto Hub: older file again, the later car's gone", a.js("S.garage.cars.length") == 1)
        load(a, newer)
        check("Auto Hub: then the newer file: the car and its photo row are back", a.js("S.garage.cars.length") == 2 and a.js("S.garage.cars[1].photos.length") == 1, a.js("S.garage.cars.map(c => c.photos.length).join()"))
        check("Auto Hub: and its cover and small picture", a.js("S.garage.cars[1].cover") == later_cover and a.js("S.garage.cars[1].thumb") == later_thumb)
        check("Auto Hub: no message, those photos are here", STAY not in toast_text(a), toast_text(a))
        a.js("S = blank(); saveLocal(); 0"); a.page.reload(); a.page.wait_for_function("typeof render === 'function' && document.querySelector('#hero .greet')"); a.page.wait_for_timeout(150)
        load(a, newer)
        check("Auto Hub: after Start fresh both cars have their photos", a.js("S.garage.cars.map(c => c.photos.length).join()") == "2,1", a.js("S.garage.cars.map(c => c.photos.length).join()"))
        clear_sheets(a); a.page.click('[data-close="sheet"]')
        a.js(f"showCar('{cid}', 'photos')")
        a.page.wait_for_function("[...document.querySelectorAll('#autoSheet img[data-aphoto]')].filter(i => (i.getAttribute('src') || '').startsWith('data:')).length === 2", timeout=8000)
        check("Auto Hub: and they show", True)
        a.close()
        a = open_hub(b, base, T.AUTOP)
        load(a, older)
        check("Auto Hub: new phone: the car came", a.js("S.garage.cars.length") == 1)
        check("Auto Hub: new phone: no rows for photos that aren't here", a.js("S.garage.cars[0].photos.length") == 0 and a.js("S.garage.cars[0].cover") == "")
        check("Auto Hub: new phone: the small cover picture comes along", a.js("S.garage.cars[0].thumb") == thumb)
        check("Auto Hub: new phone: it says where the photos are", STAY in toast_text(a), toast_text(a))
        a.close()
        # a car already on this phone keeps its own small picture, whatever an older file says
        a = open_hub(b, base, T.AUTOP)
        a.js("S.garage = { cars: [{ id: 'c1', year: 2020, make: 'Ford', model: 'F-150', cover: '', thumb: '', photos: [] }] }; save(); 0")
        p_old = os.path.join(tmp, "auto_cover_old.json")
        with open(p_old, "w", encoding="utf-8") as f: json.dump({"app": "autohub", "savedAt": "2026-09-01T12:00:00Z", "data": {"name": "Sam", "garage": {"cars": [{"id": "c1", "year": 2020, "make": "Ford", "model": "F-150", "cover": "gone", "thumb": "data:image/jpeg;base64,AAAA", "photos": [{"id": "gone", "tag": "car"}]}]}}}, f)
        load(a, p_old)
        check("Auto Hub: a removed cover's small picture doesn't come back", a.js("S.garage.cars[0].thumb") == "" and a.js("S.garage.cars[0].cover") == "", a.js("S.garage.cars[0].thumb"))
        a.close()

        print("\n[6. reminders and the AI's access to notes stay this phone's own choice]")
        for name, path in THREE:
            a = open_hub(b, base, path)
            a.js("S.remind.on = true; S.aiNotes = true; S.notes = [{ id: 'n', text: 'x', pinned: false, at: 1 }]; save()")
            file_on = download(a, f"{name}_on.json")
            a.close()
            a = open_hub(b, base, path)
            a.js("S.remind.on = false; delete S.aiNotes; save()")
            load(a, file_on)
            check(f"{name}: a file doesn't turn reminders on here without this phone's OK", a.js("S.remind.on") is False)
            check(f"{name}: it says so", "Reminders are off on this phone" in toast_text(a), toast_text(a))
            check(f"{name}: a file doesn't open notes to the AI", a.js("S.aiNotes === true") is False)
            file_off = download(a, f"{name}_off.json")
            a.js("S.remind.on = true; S.aiNotes = true; save()")
            load(a, file_off)
            check(f"{name}: a file doesn't turn reminders off here", a.js("S.remind.on") is True)
            check(f"{name}: and doesn't nag about them", "Reminders are off" not in toast_text(a), toast_text(a))
            check(f"{name}: a file doesn't change the AI choice", a.js("S.aiNotes") is True)
            a.close()

        print("\n[6a. the longest message fits a phone, and Undo stays on it]")
        a = open_hub(b, base, T.HEALTHP)
        LONG = "Restored from Oct 1, 9:00 AM. Reminders are off on this phone: turn them on in ⚙. Full-size photos stay on the phone they were taken on"
        for w in (390, 320):
            a.page.set_viewport_size({"width": w, "height": 800})
            a.page.evaluate("(m) => toast(m, true)", LONG); a.page.wait_for_timeout(350)
            box = a.js("(() => { const t = document.getElementById('toast').getBoundingClientRect(), u = document.querySelector('#toast [data-undo]').getBoundingClientRect(); return [t.left, t.right, u.left, u.right, innerWidth]; })()")
            check(f"at {w} wide it's all on the phone, Undo too", box[0] >= 0 and box[1] <= box[4] and box[2] >= 0 and box[3] <= box[4], box)
        a.page.evaluate("(m) => toast(m, true)", "Saved"); a.page.wait_for_timeout(350)
        check("a short message still sits on one line", a.js("document.getElementById('toast').getBoundingClientRect().height") < 60, a.js("document.getElementById('toast').getBoundingClientRect().height"))
        a.close()

        print("\n[6b. the same rules when it comes from Google Drive]")
        DRIVE = """(cloud) => { DTOKEN = 'tok'; DTOKEN_EXP = Date.now() + 3e6; driveSignIn = async () => true; driveDownload = async () => cloud; driveUpload = async () => {}; setOwnerSwitch('OWNER', true); }"""
        CLOUD = {"savedAt": "2027-01-01T12:00:00Z", "data": {"name": "Sam", "city": "80202", "aiNotes": True, "remind": {"on": True, "fired": {}}, "notes": [{"id": "fromcloud", "text": "Cloud", "pinned": False, "at": 1}],
                 "hh": {"setup": "2026-01-01", "vault": [{"id": "elsewhere", "type": "insurance", "title": "t", "date": "2026-09-30"}]}}}
        a = open_hub(b, base, T.HEALTHP)
        a.page.evaluate(DRIVE, CLOUD)
        a.js("S.remind.on = false; delete S.aiNotes; save(); 0")
        a.page.evaluate("restoreNow()"); a.page.wait_for_timeout(300)
        check("Restore from Drive: it came", a.js("S.notes[0].id") == "fromcloud")
        check("Restore from Drive: reminders stay this phone's, and it says so", a.js("S.remind.on") is False and "Reminders are off on this phone" in toast_text(a), toast_text(a))
        check("Restore from Drive: the AI choice stays this phone's", a.js("S.aiNotes === true") is False)
        check("Restore from Drive: no rows for photos that aren't here, and it says so", a.js("S.hh.vault.length") == 0 and "photos stay on the phone" in toast_text(a), toast_text(a))
        a.close()
        a = open_hub(b, base, T.HEALTHP)
        a.page.evaluate(DRIVE, CLOUD)
        a.js("S.remind.on = false; S.sync = { on: true, last: '', dirty: false }; S.notes = [{ id: 'mine', text: 'Mine', pinned: false, at: 1 }]; saveLocal(); 0")
        a.js("openSettings()"); a.page.wait_for_timeout(100); a.page.fill("#setName", "Typing now")
        a.page.evaluate("syncDrive()"); a.page.wait_for_timeout(300)
        check("Background sync: it came", a.js("S.notes[0].id") == "fromcloud", a.js("S.notes[0].id"))
        check("Background sync: quiet about reminders and photos", "Reminders are off" not in toast_text(a) and "photos stay" not in toast_text(a), toast_text(a))
        check("Background sync: reminders stay this phone's", a.js("S.remind.on") is False)
        check("Background sync: leaves a half-typed name alone", a.js("document.getElementById('setName').value") == "Typing now")
        a.close()
        a = open_hub(b, base, T.MONEYP)
        a.page.evaluate(DRIVE, {"savedAt": "2027-01-01T12:00:00Z", "data": {"name": "Sam", "notes": [{"id": "n", "text": "x", "at": 1}], "mh": {"setup": "2026-01-01", "accounts": [None]}}})
        a.js("S.name = 'Pat'; S.notes = [{ id: 'keep', text: 'Keep me', pinned: false, at: 1 }]; save(); 0")
        a.page.evaluate("restoreNow()"); a.page.wait_for_timeout(300)
        check("A damaged Drive copy changes nothing and says so", a.js("S.notes[0].id") == "keep" and "Nothing changed" in toast_text(a), toast_text(a))
        a.close()

        print("\n[7. a damaged file can't wreck the phone]")
        for name, path, data, app in (("Money Hub", T.MONEYP, {"mh": {"setup": "2026-01-01", "accounts": [None]}}, "moneyhub"), ("Auto Hub", T.AUTOP, {"garage": {"cars": [None]}}, "autohub")):
            bad = os.path.join(tmp, f"{app}_bad.json")
            with open(bad, "w", encoding="utf-8") as f: json.dump({"app": app, "savedAt": "2026-09-01T12:00:00Z", "data": data}, f)
            a = open_hub(b, base, path)
            a.js("S.name = 'Pat'; S.notes = [{ id: 'keep', text: 'Keep me', pinned: false, at: 1 }]; save(); 0")
            load(a, bad)
            check(f"{name}: it says nothing changed", "Nothing changed" in toast_text(a), toast_text(a))
            check(f"{name}: and nothing did, on screen", a.js("S.notes[0].id") == "keep" and a.js("S.name") == "Pat")
            stored = a.js("JSON.parse(localStorage.getItem(STORE))")
            check(f"{name}: or in storage, right after the load", stored["notes"][0]["id"] == "keep" and stored["name"] == "Pat", str(stored)[:120])
            a.page.reload(); a.page.wait_for_function("typeof render === 'function' && document.querySelector('#hero .greet')"); a.page.wait_for_timeout(150)
            check(f"{name}: reopened with Settings never closed: still there, no can't-open page", a.js("S.notes[0].id") == "keep" and "won't open" not in a.js("document.body.innerText"))
            a.close()

        payload_run(b, base)
        # the same thing through a real file
        a = open_hub(b, base, T.AUTOP)
        a.js("window.__pwn = []; window.__p = i => window.__pwn.push(i); 0")   # the 0: Playwright calls a function the expression ends on
        PAY = "'\"><img src=data:,x onerror=__p(%d)>"
        evil = copy.deepcopy(AUTO); evil["garage"]["cars"][0]["thumb"] = [PAY % 1]; evil["garage"]["cars"][0]["miles"] = PAY % 2; evil["garage"]["cars"][0]["id"] = [PAY % 3]
        p_evil = os.path.join(tmp, "evil.json")
        with open(p_evil, "w", encoding="utf-8") as f: json.dump({"app": "autohub", "savedAt": "2026-09-01T12:00:00Z", "data": evil}, f)
        load(a, p_evil)
        a.page.click('[data-close="sheet"]'); a.page.wait_for_timeout(500)
        check("Auto Hub: a real file with a bad picture, miles and id ran nothing", a.js("window.__pwn.length") == 0, a.js("window.__pwn"))
        a.close()

        print("\n[9. honest values aren't touched]")
        a = open_hub(b, base, T.AUTOP)
        honest = a.js("""normalize({ name: 'Sam', notes: [{ id: 'n', text: 'He said "hi" <today>', at: 1 }],
            garage: { cars: [{ id: 'c', make: 'Ford', model: 'F-150', miles: '30,000', paid: '$12,000.50', thumb: 'data:image/jpeg;base64,AAAA/+=', notes: [{ id: 'm', text: 'Dad\\'s "good" truck' }], mech: [{ id: 'q', q: 'Why "ping" <at 60>?' }] }] },
            mh: { accounts: [{ id: 'a', name: 'Joe\\'s "Big" <Bank>', bal: '1,200.50', kind: 'checking' }] },
            hh: { setup: 'x', card: { notes: 'Takes "A" <then> B' }, meds: [{ id: 'm', name: 'A "B" <C>', times: ['08:00', '8:30'] }] } })""")
        check("a note keeps its quotes", honest["notes"][0]["text"] == 'He said "hi" <today>')
        c = honest["garage"]["cars"][0]
        check("miles and paid with commas and $ stay", c["miles"] == "30,000" and c["paid"] == "$12,000.50")
        check("a real picture stays", c["thumb"] == "data:image/jpeg;base64,AAAA/+=")
        check("a car's note and a question keep theirs", c["notes"][0]["text"] == "Dad's \"good\" truck" and c["mech"][0]["q"] == 'Why "ping" <at 60>?')
        check("an account's name keeps its quotes, its balance stays", honest["mh"]["accounts"][0]["name"] == 'Joe\'s "Big" <Bank>' and honest["mh"]["accounts"][0]["bal"] == "1,200.50")
        check("the emergency card keeps its words", honest["hh"]["card"]["notes"] == 'Takes "A" <then> B')
        a.close()
        # the AI Mechanic's own words, on the screen
        a = open_hub(b, base, T.AUTOP)
        a.js("""S.garage = { cars: [{ id: 'c', year: 2020, make: 'Ford', model: 'F-150', mech: [{ id: 'm', date: '2026-09-01', q: 'Why?', a: { urgency: 'soon', summary: 's', check: 'Is the "check engine" light flashing?', shop: 'Say "now" <today>', causes: [{ cause: 'Plug', why: 'w', likely: 'high', diy: 'easy', cost: '<$50' }] } }] }] }; save(); render(); showCar('c', 'mech'); 0""")
        a.page.wait_for_timeout(150)
        shown = a.page.inner_text("#autoSheet")
        check("the AI Mechanic's check and cost keep their quotes and brackets, stored", a.js("S.garage.cars[0].mech[0].a.check") == 'Is the "check engine" light flashing?' and a.js("S.garage.cars[0].mech[0].a.causes[0].cost") == "<$50")
        a.page.reload(); a.page.wait_for_function("typeof render === 'function' && document.querySelector('#hero .greet')"); a.page.wait_for_timeout(150)
        check("and after reopening", a.js("S.garage.cars[0].mech[0].a.check") == 'Is the "check engine" light flashing?' and a.js("S.garage.cars[0].mech[0].a.causes[0].cost") == "<$50")
        check("and on the screen, once each, not as codes", 'Is the "check engine" light flashing?' in shown and "<$50" in shown and "&quot;" not in shown and "&lt;" not in shown, shown[:200])
        a.close()
        # values in forms come back exactly as stored
        a = open_hub(b, base, T.AUTOP)
        a.js("""S.garage = { gas: '3.49 "reg"', cars: [{ id: 'c', year: 2020, make: 'Ford', model: 'F-150', miles: '30,000', paid: '$12,000.50', price: 'a "b" <c>', every: { oil: [5000, 6] }, fuel: [{ id: 'f', date: '2026-09-20', miles: 100, gal: '10.5', cost: 30 }] }] }; save(); render(); showCar('c', 'overview'); 0""")
        a.page.wait_for_timeout(120)
        check("Auto Hub: paid and asking price read back as stored", a.js("document.querySelector('#autoSheet [name=paid]').value") == "$12,000.50" and a.js("document.querySelector('#autoSheet form[data-aprice] [name=price]').value") == 'a "b" <c>')
        check("Auto Hub: miles reads back as stored", a.js("document.querySelector('#autoSheet form[data-aedit] [name=miles]').value") == "30,000")
        a.js("showCar('c', 'fuel'); 0"); a.page.wait_for_timeout(120)
        check("Auto Hub: gas price reads back as stored", a.js("document.querySelector('#autoSheet form[data-atrip] [name=price]').value") == '3.49 "reg"')
        check("Auto Hub: a fill-up shows its gallons", "10.5 gal" in a.page.inner_text("#autoSheet"))
        a.js("showCar('c', 'service'); 0"); a.page.wait_for_timeout(120)
        a.js("document.querySelector('#autoSheet details.auto-every')?.setAttribute('open', ''); document.querySelector('#autoSheet [data-aeveryreset=oil]').click(); 0"); a.page.wait_for_timeout(120)
        check("Auto Hub: resetting your own interval still works", not a.js("(S.garage.cars[0].every || {}).oil"))
        a.close()
        a = open_hub(b, base, T.MONEYP)
        a.js("""S.mh.setup = 'x'; S.mh.accounts = [{ id: 'a', kind: 'checking', name: 'Joe', bal: '1,200.50', at: today() }]; S.mh.budgets = { 'a&b': 50, food: 20 }; S.mh.payCash = 300; S.mh.payCheck = 1500; S.bills = [{ id: 'b', name: 'Rent', amount: 900, day: 15, cat: 'bills' }]; save(); render(); showMh('accounts'); 0""")
        a.page.wait_for_timeout(120)
        check("Money Hub: a balance reads back as stored", a.js("document.querySelector('#mhSheet [name=bal]').value") == "1,200.50")
        a.js("showMh('bills'); 0"); a.page.wait_for_timeout(120)
        check("Money Hub: cash and paycheck read back", a.js("document.querySelector('#mhSheet [name=cash]').value") == "300" and a.js("document.querySelector('#mhSheet [name=check]').value") == "1500")
        a.js("MH_PEDIT = 'b'; showMh('bills'); MH_PEDIT = null; 0"); a.page.wait_for_timeout(120)
        check("Money Hub: a bill's amount and day read back", a.js("document.querySelector('#mhSheet [name=amount]').value") == "900" and a.js("document.querySelector('#mhSheet [name=day]').value") == "15")
        a.js("showMh('budget'); 0"); a.page.wait_for_timeout(120)
        keys = a.js("[...document.querySelectorAll('#mhSheet [data-mhbudgetoff]')].map(x => x.dataset.mhbudgetoff)")
        check("Money Hub: a budget's remove button carries its name exactly", "a&b" in keys and "food" in keys, keys)
        a.js("document.querySelector('#mhSheet [data-mhbudgetoff=food]').click(); 0"); a.page.wait_for_timeout(120)
        check("Money Hub: and still removes it", "food" not in a.js("Object.keys(S.mh.budgets)"))
        a.close()
        a = open_hub(b, base, T.HEALTHP)
        a.js("""S.hh = { setup: 'x', goals: { water: 8, steps: 6000, sleep: 7.5 }, meds: [{ id: 'm', name: 'A', times: ['08:00', '8:30'] }], sleep: [{ id: 's', date: '2026-10-01', bed: '22:00', wake: '06:00', hrs: 8, q: 4 }], workouts: [{ id: 'w', date: '2026-10-01', type: 'walk', min: 30, sets: 3, reps: 10, wt: 20 }] }; save(); render(); showHh('meds'); 0""")
        a.page.wait_for_timeout(120)
        check("Health Hub: dose times aren't touched", a.js("hh().meds[0].times.join()") == "08:00,8:30", a.js("hh().meds[0].times.join()"))
        a.js("document.querySelector('.hh-take').click(); 0"); a.page.wait_for_timeout(120)
        check("Health Hub: Taken still works", a.js("hhDoses(today()).filter(d => d.st === 'taken').length") == 1)
        a.js("showHh('goals'); 0"); a.page.wait_for_timeout(120)
        check("Health Hub: goals read back", a.js("document.querySelector('#hhSheet [name=sleep]').value") == "7.5")
        a.js("showHh('sleep'); 0"); a.page.wait_for_timeout(120)
        check("Health Hub: a night's quality reads 4/5", "4/5" in a.page.inner_text("#hhSheet"))
        a.js("showHh('move'); 0"); a.page.wait_for_timeout(120)
        check("Health Hub: a workout reads as logged", "30 min" in a.page.inner_text("#hhSheet") and "3×10" in a.page.inner_text("#hhSheet") and "@ 20 lb" in a.page.inner_text("#hhSheet"))
        a.close()
        b.close()
    srv.shutdown()
    print(f"\n{OK} passed, {FAIL} failed")
    return 1 if FAIL else 0


if __name__ == "__main__":
    sys.exit(main())
