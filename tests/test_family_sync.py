"""
SAVE AS: test_family_sync.py   LOCATION: C:/MarvelApps/dayhub/tests/test_family_sync.py

FAMILY HUB PHASE B - SHARING BETWEEN PHONES (familysync.js; Scott 11/07 "Phase B: all phones"). Several real Family Hub pages ("phones",
each its own browser profile) share ONE fake Firebase run by this test (no network, nothing reaches the real project). The fake follows
the same rules as docs/hub_improvement/familyhub/firestore.rules: only a family's phones read or write it; the adults part never reaches
a guest's phone; a phone joins only with a live invite, as exactly the person and role on it; only the owner changes phones and roles;
a phone can leave; nobody touches owner / created / paid. (The real rules file still needs Firebase's own rules test - not run here.)
Checks: turning sharing on uploads the family as records in a few documents ("Only me" stays home, parents-only goes to the adults part);
an invite code; joining on a new phone brings everything over; edits travel both ways (events, list items, chore check-offs, messages,
reactions, deletions); two phones adding at once both survive; a guest's phone gets no parents-only things; photos travel at a smaller
size and are fetched once; the owner's role change reaches the phone's access; removing a phone and leaving; used / expired codes fail;
offline edits send when back online; no page errors.

RUN:   python tests/test_family_sync.py      (from C:/MarvelApps/dayhub)   Exit 0 = all passed.
"""
import os, sys, json, time, random, string, tempfile, copy
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import run_tests as T
from playwright.sync_api import sync_playwright

OK = FAIL = 0
def check(name, cond, extra=""):
    global OK, FAIL
    if cond: OK += 1; print(f"  PASS  {name}")
    else: FAIL += 1; print(f"  FAIL  {name}  {extra}")

AT = "2026-11-12T14:00:00"

# ------------------------------------------------------------ the fake Firebase (one per test run), with the rules
class Fake:
    def __init__(self): self.docs = {}; self.ver = {}; self.offline = set(); self.writes = 0; self.reads = 0
    def _fam(self, fid): return self.docs.get(f"families/{fid}")
    def _member(self, uid, fid): f = self._fam(fid); return bool(f) and uid in f.get("members", {})
    def _adult(self, uid, fid): f = self._fam(fid); return self._member(uid, fid) and f["members"][uid].get("role") in ("owner", "adult")
    def _can(self, uid, path, write=False):
        p = path.split("/")
        if p[0] == "families" and len(p) == 4:
            return self._adult(uid, p[1]) if p[2] == "adults" else self._member(uid, p[1]) if p[2] == "all" else False
        if p[0] == "invites": return True
        return False
    def _bump(self, path): self.ver[path] = self.ver.get(path, 0) + 1
    def op(self, uid, op, path, payload, batch_dels=()):
        if uid in self.offline: return {"err": "unavailable"}
        a = json.loads(payload) if payload else None
        p = path.split("/") if path else []
        if op == "newId": return {"d": "fam" + "".join(random.choice(string.ascii_lowercase) for _ in range(12))}
        if op == "ownerOf":
            for k, v in self.docs.items():
                if k.count("/") == 1 and k.startswith("families/") and v.get("owner") == a: return {"d": k.split("/")[1]}
            return {"d": None}
        if op == "get":
            self.reads += 1
            d = self.docs.get(path)
            if p[0] == "families" and len(p) == 2:
                if d is None: return {"err": "permission-denied"}
                if uid not in d.get("members", {}) and d.get("owner") != uid: return {"err": "permission-denied"}
                return {"d": d, "v": self.ver.get(path, 0)}
            if not self._can(uid, path): return {"err": "permission-denied"}
            return {"d": d, "v": self.ver.get(path, 0)}
        if op == "set":
            self.writes += 1
            if p[0] == "families" and len(p) == 2:
                if path in self.docs: return {"err": "permission-denied"}
                if a.get("owner") != uid or set(a.get("members", {}).keys()) != {uid} or a["members"][uid].get("role") != "owner" or a.get("paid") is not False:
                    return {"err": "permission-denied"}
                self.docs[path] = a; self._bump(path); return {"d": True}
            if p[0] == "invites":
                f = self._fam(a.get("fid"))
                if not f or f.get("owner") != uid or a.get("role") not in ("adult", "guest") or a.get("by") != uid or len(p[1]) != 10: return {"err": "permission-denied"}
                if a.get("exp", 0) > time.time() * 1000 + 8 * 864e5: return {"err": "permission-denied"}
            elif not self._can(uid, path, True): return {"err": "permission-denied"}
            self.docs[path] = a; self._bump(path); return {"d": True}
        if op == "patch":
            self.writes += 1
            if not self._can(uid, path, True): return {"err": "permission-denied"}
            d = self.docs.setdefault(path, {}); r = d.setdefault("r", {})
            for k, v in a.items():
                if v is None: r.pop(k, None)
                else: r[k] = v
            if len(json.dumps(d)) > 1048576: return {"err": "too-big"}
            self._bump(path); return {"d": True}
        if op == "batch":
            ops = a; dels = {o["p"] for o in ops if o["op"] == "del"}
            for o in ops:
                if o["op"] == "update":
                    r = self.op(uid, "update", o["p"], json.dumps(o["d"]), dels)
                    if "err" in r: return r
            for o in ops:
                if o["op"] == "del":
                    r = self.op(uid, "del", o["p"], "")
                    if "err" in r: return r
            return {"d": True}
        if op == "update":
            self.writes += 1
            if not (p[0] == "families" and len(p) == 2) or path not in self.docs: return {"err": "permission-denied"}
            old = self.docs[path]; new = copy.deepcopy(old)
            for k, v in a.items():
                if k.startswith("members."):
                    u = k.split(".", 1)[1]
                    if v is None: new["members"].pop(u, None)
                    else: new["members"][u] = v
                else: new[k] = v
            if any(new.get(x) != old.get(x) for x in ("owner", "created", "paid")): return {"err": "permission-denied"}
            added = set(new["members"]) - set(old["members"]); removed = set(old["members"]) - set(new["members"])
            changed = {u for u in set(new["members"]) & set(old["members"]) if new["members"][u] != old["members"][u]}
            owner_edit = old["owner"] == uid and new["members"].get(uid, {}).get("role") == "owner"
            inv = self.docs.get(f"invites/{new.get('join')}") if new.get("join") else None
            joining = (uid not in old["members"] and added == {uid} and not removed and not changed and inv is not None
                       and inv["fid"] == p[1] and inv["exp"] > time.time() * 1000 and new["members"][uid].get("role") == inv["role"]
                       and inv.get("by") == old["owner"] and f"invites/{new.get('join')}" in batch_dels
                       and new["members"][uid].get("m") == inv["m"] and set(k for k in a if not k.startswith("members.")) <= {"join"})
            leaving = uid in old["members"] and old["owner"] != uid and removed == {uid} and not added and not changed and all(k.startswith("members.") for k in a)
            if not (owner_edit or joining or leaving): return {"err": "permission-denied"}
            self.docs[path] = new; self._bump(path); return {"d": True}
        if op == "del":
            self.writes += 1
            d = self.docs.get(path)
            if p[0] == "invites":
                if d and not (d.get("by") == uid or self._member(uid, d.get("fid"))): return {"err": "permission-denied"}
            elif p[0] == "families" and len(p) == 2:
                if d and d.get("owner") != uid: return {"err": "permission-denied"}
            elif not self._can(uid, path, True) or not p[-1].startswith("img-"): return {"err": "permission-denied"}
            self.docs.pop(path, None); self._bump(path); return {"d": True}
        return {"err": "unknown op " + op}

FAKE_JS = r"""
(() => {
  const call = async (op, path, payload) => { const r = JSON.parse(await window.fhsFake(op, path || "", payload === undefined ? "" : JSON.stringify(payload)));
    if (r.err) { const e = new Error(r.err); e.code = r.err; throw e; } return r; };
  const clean = v => JSON.parse(JSON.stringify(v, (k, x) => x === undefined ? undefined : x));
  window.FHS_FAKE = {
    start: async () => ({ uid: window.__FHS_UID, google: false }),
    listen(path, cb, bad) { let v = -1, stop = false;
      const tick = async () => { if (stop) return; try { const r = await call("get", path); if (stop) return; if (r.v !== v) { v = r.v; cb(r.d ? clean(r.d) : null); } } catch (e) { if (stop) return; if (bad) bad(e); v = -2; } if (!stop) setTimeout(tick, 150); };
      tick(); return () => { stop = true; }; },
    get: async path => (await call("get", path)).d || null,
    set: (path, d) => call("set", path, clean(d)),
    patch: (path, ch) => call("patch", path, ch),
    update: (path, d) => call("update", path, d),
    batch: ops => call("batch", "", ops),
    del: path => call("del", path),
    now: () => Date.now(), ts: ms => ms, ms: t => +t || 0,
    newId: () => "fam" + Math.random().toString(36).slice(2, 12),
    ownerOf: async uid => (await call("ownerOf", "", uid)).d,
    stop: async () => {}
  };
})();
"""

def phone(b, base, fake, uid, setup=True, name="Scott"):
    # the main suite's App, plus the fake Firebase and this phone's own signed-in id
    a = T.App.__new__(T.App)
    wk = False
    a.ctx = b.new_context(viewport={"width": 390, "height": 844}, timezone_id="America/Chicago", permissions=["notifications"])
    T.route(a.ctx)
    a.ctx.expose_binding("fhsFake", lambda src, op, path, payload: json.dumps(fake.op(uid, op, path, payload)))
    a.ctx.add_init_script(f"window.__FHS_UID = {json.dumps(uid)};" + FAKE_JS)
    a.page = a.ctx.new_page()
    a.page.on("pageerror", lambda e: T.ERRORS.append(f"pageerror[{uid}]: {e}"))
    a.page.on("console", lambda m: T.ERRORS.append(f"console[{uid}]: {m.text}") if m.type == "error" and "favicon" not in m.text else None)
    a.page.clock.install(time=AT + "-05:00")
    a.page.goto(base + T.FAMILYP)
    a.page.wait_for_function("typeof render === 'function' && typeof fhsJoin === 'function'")
    if setup:
        a.page.fill('form[data-fhsetup] [name=fam]', "The Marvel Family"); a.page.fill('form[data-fhsetup] [name=name]', name)
        a.page.click('form[data-fhsetup] button'); a.page.wait_for_function("S.fh && S.fh.setup")
    if a.js("typeof briefOpen === 'function' && briefOpen()"): a.page.click('[data-brief="go"]')
    return a

def until(a, expr, ms=8000):
    try: a.page.wait_for_function(expr, timeout=ms); return True
    except Exception: return False

SEED = r"""(() => { const F = fh(), t = today(), me = fhMe();
  F.members.push({ id: "jen", name: "Jen", face: "👩", color: "#ff6bcb", role: "adult", bday: "1985-11-19" }, { id: "mia", name: "Mia", face: "👧", color: "#feca57", role: "child", bday: "2016-11-14" },
    { id: "gma", name: "Grandma", face: "👵", color: "#a29bfe", role: "guest", bday: "" });
  F.events.push({ id: "e1", title: "Soccer", date: t, time: "17:00", kind: "sports", rep: "none", until: "", where: "", note: "", vis: "", who: ["mia"], skip: [], at: 1 });
  F.events.push({ id: "e2", title: "Date night", date: t, time: "19:00", kind: "family", rep: "none", until: "", where: "", note: "", vis: "adults", who: [], skip: [], at: 1 });
  F.chores.push({ id: "c1", title: "Feed the fish", who: "mia", every: "daily", date: "", day: 0, pts: 5, amt: 1, from: t, log: {}, at: 1 });
  F.payouts.push({ id: "p1", who: "mia", amt: 3, date: t });
  F.msgs.push({ id: "m1", th: "family", by: me.id, text: "Hello family", at: Date.now() - 5000, re: {} }, { id: "m2", th: "parents", by: me.id, text: "Gift ideas", at: Date.now() - 4000, re: {} });
  F.photos.push({ id: "phall", al: "", cap: "Beach", date: t, by: me.id, to: "all", ids: [], at: Date.now() }, { id: "phme", al: "", cap: "Secret", date: t, by: me.id, to: "me", ids: [], at: Date.now() });
  F.tree = { [me.id]: { parents: [], interests: "Hoops", phone: "555-0001", story: "Mine" } };
  F.share[me.id] = { story: { to: "me", ids: [] } };
  F.card.contacts.push({ name: "Aunt May", rel: "Aunt", phone: "555-0100" });
  save(); render(); })()"""

def put_image(a, pid, color):
    a.js(f"""(async () => {{ const c = document.createElement('canvas'); c.width = 600; c.height = 400; const g = c.getContext('2d'); g.fillStyle = '{color}'; g.fillRect(0, 0, 600, 400);
      const d = c.toDataURL('image/jpeg', .8); await fhpIdb('readwrite', s => {{ s.put(d, '{pid}'); return s.put(d, '{pid}_t'); }}); }})()""")


def main():
    srv, base = T.serve()
    fake = Fake()
    with sync_playwright() as p:
        b = p.chromium.launch()
        before = len(T.ERRORS)
        print("\n[Turning sharing on]")
        A = phone(b, base, fake, "uidA")
        A.js(SEED); put_image(A, "phall", "#3a8dde"); put_image(A, "phme", "#ff0000"); A.page.wait_for_timeout(200)
        A.js("showFh('share')")
        check("the Share page offers sharing, with the promises (Only me stays home, kids never sign in)", "Turn on sharing" in A.page.inner_text("#fhSheet") and "Only me" in A.page.inner_text("#fhSheet"))
        A.page.click('#fhSheet [data-fhson]')
        check("sharing turns on and syncs", until(A, "FHS && FHS_STATE === 'ok'"), A.js("[FHS_STATE, FHS_ERR]"))
        fid = A.js("FHS.fid"); pre = f"families/{fid}/"
        fam = fake.docs.get(f"families/{fid}", {})
        check("the family on the server: this phone as owner, not paid", fam.get("owner") == "uidA" and fam["members"]["uidA"]["role"] == "owner" and fam.get("paid") is False)
        allp = fake.docs.get(pre + "all/plan", {}).get("r", {}); adp = fake.docs.get(pre + "adults/plan", {}).get("r", {})
        check("everyday things go to the shared part (Soccer, the chore)", "ev~e1" in allp and "ch~c1" in allp)
        check("parents-only things go to the adults part (Date night, allowance paid)", "ev~e2" in adp and "ev~e2" not in allp and "pay~p1" in adp)
        month = A.js("fhsMonth(Date.now())")
        check("the Parents talk goes to the adults part, the family talk to everyone's", "m~m2" in fake.docs.get(pre + "adults/" + month, {}).get("r", {}) and "m~m1" in fake.docs.get(pre + "all/" + month, {}).get("r", {}))
        blob = json.dumps(fake.docs)
        check("'Only me' never leaves the phone (the private photo, the private story)", "phme" not in blob and "Mine" not in blob and "Secret" not in blob)
        check("the emergency card stays in the adults part (guests not allowed)", "card~1" in fake.docs.get(pre + "adults/people", {}).get("r", {}) and "Aunt May" not in json.dumps(fake.docs.get(pre + "all/people", {})))
        check("the shared photo travels at a smaller size, in its own document", (fake.docs.get(pre + "all/img-phall") or {}).get("d", "").startswith("data:image/jpeg"))
        check("the PIN, who's using the phone and Grandparent Mode don't travel", '"pin"' not in blob and '"big"' not in blob and '"me":' not in json.dumps(fake.docs.get(pre + "all/people", {})))
        docs_n = sum(1 for k in fake.docs if k.startswith(pre))
        check("a handful of documents for the whole family (cheap on the free plan)", docs_n <= 10, docs_n)

        print("\n[Inviting and joining]")
        A.page.select_option('#fhSheet form[data-fhsinv] [name=m]', "jen"); A.page.click('#fhSheet form[data-fhsinv] button')
        check("an invite code for Jen (10 characters, shown as XXXXX-XXXXX)", until(A, "FHS_INV && FHS_INV.code.length === 10") and A.page.locator("#fhSheet .fhs-code b").count() == 1)
        code = A.js("FHS_INV.code")
        inv = fake.docs.get(f"invites/{code}", {})
        check("...good once, for 2 days, as an adult for Jen", inv.get("m") == "jen" and inv.get("role") == "adult" and 1.9 * 864e5 < inv.get("exp", 0) - A.js("Date.now()") < 2.1 * 864e5, (inv, A.js("Date.now()")))
        B = phone(b, base, fake, "uidB", setup=False)
        check("a new phone's welcome screen offers 'Join your family'", B.page.locator("form[data-fhsjoin]").count() == 1)
        B.page.fill('form[data-fhsjoin] [name=code]', code[:5] + "-" + code[5:].lower()); B.page.click('form[data-fhsjoin] button')
        check("Jen's phone joins and everything comes over", until(B, "FHS && FHS_STATE === 'ok' && S.fh.members.length === 4 && S.fh.events.length === 2", 10000), B.js("[FHS && FHS_STATE, FHS_ERR, S.fh && S.fh.members.length]"))
        check("it knows it's Jen's phone", B.js("fhMe() && fhMe().id") == "jen", B.js("[S.fh.me, S.fh.members.map(m => m.id).join()]"))
        check("as an adult it gets the Parents talk and Date night", B.js("S.fh.msgs.some(m => m.id === 'm2') && S.fh.events.some(e => e.id === 'e2')"))
        check("the code was used up (in the same step as joining)", f"invites/{code}" not in fake.docs)
        check("Scott's open Share page shows Jen's phone by itself", until(A, "document.querySelectorAll('#fhSheet [data-fhsrm]').length === 1"))
        snap = B.js("JSON.stringify(S.fh)")
        check("Today on Jen's phone shows the family", "Soccer" in B.page.inner_text("#cards") and "Marvel Family" in B.page.inner_text("#cards"))
        C2 = phone(b, base, fake, "uidX", setup=False)
        C2.page.fill('form[data-fhsjoin] [name=code]', code); C2.page.click('form[data-fhsjoin] button')
        check("the same code can't be used again", until(C2, "/didn't work/.test(document.getElementById('fhsJoinMsg').textContent)") and not C2.js("!!FHS"))
        C2.ctx.close()

        print("\n[Edits travel both ways]")
        B.js("(() => { const L = S.fh.lists.find(l => l.icon === '🛒'); L.items.push({ id: 'i1', text: 'Milk', by: 'jen', done: false, at: Date.now() }); save(); })()")
        check("Jen adds milk; it shows on Scott's phone", until(A, "S.fh.lists.find(l => l.icon === '🛒').items.some(i => i.text === 'Milk')"))
        A.js("(() => { const L = S.fh.lists.find(l => l.icon === '🛒'); L.items.push({ id: 'i2', text: 'Eggs', by: S.fh.members[0].id, done: false, at: Date.now() }); save(); })()")
        B.js("(() => { const L = S.fh.lists.find(l => l.icon === '🛒'); L.items.push({ id: 'i3', text: 'Bread', by: 'jen', done: false, at: Date.now() }); save(); })()")
        both = "(() => { const t = S.fh.lists.find(l => l.icon === '🛒').items.map(i => i.text).sort().join(); return t === 'Bread,Eggs,Milk'; })()"
        check("both phones adding at the same moment: nothing is lost", until(A, both) and until(B, both))
        A.js("fhClick({ fhdone: 'c1|' + today() })")
        check("a chore checked off on Scott's phone shows on Jen's", until(B, "!!(S.fh.chores[0].log[today()] && S.fh.chores[0].log[today()].st === 'ok')"))
        B.js("FH_TAB = 'msg'; FHM_TH = ''; showFh('msg'); fhClick({ fhmth: 'family' })"); B.page.fill('#fhSheet form[data-fhmsend] [name=text]', "On it!"); B.page.click('#fhSheet form[data-fhmsend] button')
        check("Jen's message reaches Scott (and counts as new for him)", until(A, "S.fh.msgs.some(m => m.text === 'On it!')") and A.js("fhmUnreadIn('family')") >= 1)
        A.js("fhClick({ fhmre: 'm1|❤️' })")
        check("Scott's reaction reaches Jen", until(B, "S.fh.msgs.find(m => m.id === 'm1').re[S.fh.members[0].id] === '❤️'"))
        B.js("fhClick({ fhevdel: 'e1' })")
        check("Jen deletes Soccer; it's gone from Scott's phone too", until(A, "!S.fh.events.some(e => e.id === 'e1')"))
        A.js("S.fh.events.push({ id: 'e3', title: 'Dentist', date: today(), time: '09:00', kind: 'appt', rep: 'none', until: '', where: '', note: '', vis: '', who: [], skip: [], at: Date.now() }); save()")
        check("Scott adds Dentist; it's on Jen's phone", until(B, "S.fh.events.some(e => e.title === 'Dentist')"))
        A.js("S.fh.events.find(e => e.id === 'e3').title = 'Dentist 9am'; S.fh.events.find(e => e.id === 'e3').at = Date.now(); save()")
        check("an edit travels too", until(B, "S.fh.events.some(e => e.title === 'Dentist 9am')"))
        A.js("S.fh.share.jen = { bday: { to: 'parents', ids: [] } }; save()")
        check("a birthday made 'Parents only' really leaves the shared part (only the parents' part has it)", until(A, "true") and
              until(B, "true") and (lambda: (A.page.wait_for_timeout(1500) or True))() and "bday" not in fake.docs[pre + "all/people"]["r"].get("mem~jen", {}) and
              fake.docs.get(pre + "adults/people", {}).get("r", {}).get("memx~jen", {}).get("bday") == "1985-11-19")
        B.js(f"S.fh = JSON.parse({json.dumps(snap)}); save()")
        check("Jen's phone restores an old backup: nothing newer is deleted anywhere", (B.page.wait_for_timeout(2500) or True) and A.js("S.fh.events.some(e => e.title === 'Dentist 9am')")
              and until(B, "S.fh.events.some(e => e.title === 'Dentist 9am')"))
        B.js("S.fh = { setup: today(), name: 'Other family', sid: 'someoneelse', me: 'q', members: [{ id: 'q', name: 'Q', face: '🙂', color: '#2e86de', role: 'owner', bday: '' }], events: [{ id: 'oth1', title: 'Other family event', date: today(), time: '', kind: 'family', rep: 'none', until: '', where: '', note: '', vis: '', who: [], skip: [] }], lists: [] }; save()")
        check("a backup of another family is never uploaded into this one", (B.page.wait_for_timeout(2500) or True) and "Other family event" not in json.dumps(fake.docs)
              and until(B, "S.fh.events.some(e => e.title === 'Dentist 9am') && S.fh.name === 'The Marvel Family' && fhMe() && fhMe().id === 'jen'", 10000))
        B.js("FHP_BIG = ''; showFh('photos')"); B.page.wait_for_timeout(1500)
        check("the shared photo arrives on Jen's phone, once, and is kept there", until(B, "fhpIdb('readonly', s => s.get('phall')).then(d => !!d)") and B.js("FHS.img.phall") == "all")
        check("the private photo never does", not B.js("S.fh.photos.some(p => p.id === 'phme')"))
        check("Scott's private story doesn't reach Jen; his shared interests do", B.js("(S.fh.tree[S.fh.members[0].id] || {}).story") is None and B.js("(S.fh.tree[S.fh.members[0].id] || {}).interests") == "Hoops")
        check("...and Scott's phone still has his story", A.js("S.fh.tree[S.fh.members[0].id].story") == "Mine")

        print("\n[A guest's phone]")
        A.js("showFh('share')"); A.page.select_option('#fhSheet form[data-fhsinv] [name=m]', "gma"); A.page.click('#fhSheet form[data-fhsinv] button')
        until(A, "FHS_INV && FHS_INV.mid === 'gma'"); gcode = A.js("FHS_INV.code")
        G = phone(b, base, fake, "uidG", setup=False)
        G.page.fill('form[data-fhsjoin] [name=code]', gcode); G.page.click('form[data-fhsjoin] button')
        check("Grandma's phone joins as a guest", until(G, "FHS && FHS_STATE === 'ok' && S.fh.members.length === 4", 10000) and fake.docs[f"families/{fid}"]["members"]["uidG"]["role"] == "guest")
        check("it gets the everyday calendar but not Date night", G.js("S.fh.events.some(e => e.title === 'Dentist 9am')") and not G.js("S.fh.events.some(e => e.id === 'e2')"))
        check("no Parents talk, no allowance payments, no emergency card (not allowed for guests)", not G.js("S.fh.msgs.some(m => m.th === 'parents')") and G.js("S.fh.payouts.length") == 0 and "Aunt May" not in G.js("JSON.stringify(S.fh.card)"))
        check("the server itself refuses a guest the adults part", "err" in fake.op("uidG", "get", pre + "adults/plan", ""))
        G.js("showFh('photos')")
        check("a guest isn't offered 'Parents only' or 'Picked people' for photos (it couldn't be sent)", "Parents only" not in G.js("document.querySelector('#fhSheet [data-fhpto]').innerHTML"))
        g_mem = dict(fake.docs[pre + "all/people"]["r"]["mem~gma"]); g_mem["role"] = "adult"
        fake.op("uidG", "patch", pre + "all/people", json.dumps({"mem~gma": g_mem})); A.page.wait_for_timeout(2500)
        check("a guest can't make themself an adult (the phone's access stays guest)", fake.docs[f"families/{fid}"]["members"]["uidG"]["role"] == "guest")
        A.js("fhMem('gma').role = 'guest'; save()"); A.page.wait_for_timeout(800)
        bad = 'x"><img src=x onerror=window.__x=1>'
        lid = A.js("S.fh.lists.find(l => l.icon === '🛒').id")
        fake.op("uidG", "patch", pre + "all/plan", json.dumps({f"it~{lid}|{bad}": {"text": "boo", "done": False}, "ev~bad1": {"title": "Bad", "date": bad, "who": [], "skip": []}}))
        A.page.wait_for_timeout(2000); A.js("showFh('lists'); fhClick({ fhlist: '%s' })" % lid); A.js("FH_CALV = 'week'; showFh('cal')")
        check("ids and dates that aren't ids or dates are dropped before they reach the page", A.js("window.__x") is None and not A.js("S.fh.events.some(e => e.id === 'bad1')")
              and not A.js("S.fh.lists.some(l => l.items.some(i => i.text === 'boo'))"))
        before_n = len(fake.docs[pre + "all/plan"]["r"])
        fake.docs[pre + "all/plan"] = {"r": {}}; fake._bump(pre + "all/plan")
        check("someone wiping the shared plan deletes nothing; Scott's phone puts it back", until(A, "S.fh.events.some(e => e.title === 'Dentist 9am')") and
              (A.page.wait_for_timeout(2500) or True) and len(fake.docs[pre + "all/plan"]["r"]) >= before_n - 3, (before_n, len(fake.docs[pre + "all/plan"]["r"])))
        A.js("S.fh.card.guests = true; save()")
        check("when Scott lets guests see the emergency card, it reaches Grandma", until(G, "JSON.stringify(S.fh.card).includes('Aunt May')"))
        A.js("S.fh.card.guests = false; save()")
        check("...and when he turns that off, it leaves her phone (and stays off)", until(G, "!JSON.stringify(S.fh.card).includes('Aunt May')") and (G.page.wait_for_timeout(2500) or True)
              and "cardg~1" not in fake.docs[pre + "all/people"]["r"])

        print("\n[The owner keeps each phone's access in step]")
        A.js("fhMem('jen').role = 'guest'; save()")
        check("Scott makes Jen a guest: her phone's access follows", until(A, f"FHS_FAM && FHS_FAM.members.uidB.role === 'guest'") and fake.docs[f"families/{fid}"]["members"]["uidB"]["role"] == "guest")
        check("...and her phone drops the parents-only things it had", until(B, "!S.fh.events.some(e => e.id === 'e2') && !S.fh.msgs.some(m => m.th === 'parents')", 10000))
        A.js("fhMem('jen').role = 'adult'; save()")
        check("made an adult again, Date night comes back", until(B, "S.fh.events.some(e => e.id === 'e2')", 10000))

        print("\n[Offline, then back]")
        fake.offline.add("uidB")
        B.js("S.fh.events.push({ id: 'e4', title: 'Bake sale', date: today(), time: '', kind: 'school', rep: 'none', until: '', where: '', note: '', vis: '', who: [], skip: [], at: Date.now() }); save()")
        B.page.wait_for_timeout(1500)
        check("offline: the edit waits on Jen's phone", not A.js("S.fh.events.some(e => e.title === 'Bake sale')") and B.js("S.fh.events.some(e => e.title === 'Bake sale')"))
        fake.offline.discard("uidB"); B.js("fhsSoon(10)")
        check("back online: it reaches Scott", until(A, "S.fh.events.some(e => e.title === 'Bake sale')", 12000))

        print("\n[Leaving, removing, codes that don't work]")
        A.js("showFh('share')")
        check("the owner sees every phone in the family", A.page.locator("#fhSheet [data-fhsrm]").count() == 2)
        A.js("fhClick({ fhsrm: 'uidG' })")
        check("the owner takes Grandma's phone off; it stops, keeping its copy", until(G, "!FHS && FHS_STATE === 'removed'", 10000) and G.js("S.fh.events.length") > 0, G.js("[!!FHS, FHS_STATE, FHS_ERR, S.fh.events.length]"))
        B.js("showFh('share'); fhClick({ fhsleave: '1' })"); B.js("fhClick({ fhsleave: '1' })")
        check("Jen's phone leaves (two taps); the family no longer lists it", until(B, "!FHS") and "uidB" not in fake.docs[f"families/{fid}"]["members"])
        check("the owner can't leave their own family (no Stop button for Scott)", A.page.locator("#fhSheet [data-fhsleave]").count() == 0)
        fake.docs["invites/ZZZZZZZZZZ"] = {"fid": fid, "m": "jen", "role": "adult", "by": "uidA", "exp": time.time() * 1000 - 1000, "name": "x", "who": "Jen"}
        E = phone(b, base, fake, "uidE", setup=False)
        E.page.fill('form[data-fhsjoin] [name=code]', "ZZZZZZZZZZ"); E.page.click('form[data-fhsjoin] button')
        check("an expired code doesn't work", until(E, "/didn't work/.test(document.getElementById('fhsJoinMsg').textContent)") and not E.js("!!FHS"))
        check("a crafted join as an adult with a guest's code is refused by the server", "err" in fake.op("uidE", "update", f"families/{fid}", json.dumps({"members.uidE": {"m": "gma", "role": "adult"}, "join": "ZZZZZZZZZZ"})))
        check("nobody can mark the family paid", "err" in fake.op("uidA", "update", f"families/{fid}", json.dumps({"paid": True})))
        E.ctx.close()
        A.js("showFh('share')"); A.page.select_option('#fhSheet form[data-fhsinv] [name=m]', "gma"); A.page.click('#fhSheet form[data-fhsinv] button')
        until(A, "FHS_INV && FHS_INV.mid === 'gma' && FHS_INV.code !== '%s'" % gcode); g2 = A.js("FHS_INV.code")
        G.js("hideFh(); showFh('share')"); G.page.fill('#fhSheet form[data-fhsjoin] [name=code]', g2); G.page.click('#fhSheet form[data-fhsjoin] button'); G.page.wait_for_timeout(400)
        check("joining on a phone that already has a family asks twice first", not G.js("!!FHS") and "again" in G.page.inner_text("#fhSheet"))
        G.page.click('#fhSheet form[data-fhsjoin] button')
        check("...and the second tap joins", until(G, "FHS && FHS_STATE === 'ok'", 10000))
        errs = [e for e in T.ERRORS[before:] if "favicon" not in e and "Failed to fetch" not in e]
        check("no page errors on any phone", not errs, errs[:4])
        print(f"\n  (fake Firebase: {fake.writes} writes)")
        for x in (A, B, G):
            try: x.js("fhsStopListening()"); x.ctx.close()
            except Exception: pass
        b.close()
    print(f"\n{OK} passed, {FAIL} failed")
    sys.exit(1 if FAIL else 0)


if __name__ == "__main__":
    main()
