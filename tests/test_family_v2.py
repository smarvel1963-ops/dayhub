"""
SAVE AS: test_family_v2.py   LOCATION: C:/MarvelApps/dayhub/tests/test_family_v2.py

FAMILY HUB v2, PHASE A (Scott 11/07: his two boards, the build spec, then "these are CORE": messaging, photo sharing, important dates,
the family tree, per-member sharing; tabs Today | Messages | Calendar | Family | More; price $25 once after a 30-day free trial).
Drives the real Family Hub page (family.js + familymsg.js + familytree.js + familyphotos.js + familylife.js + family.css) with the main
suite's helpers and a made-up family (no real people). Checks: the parts register; Today (greeting, faces, cards in order, quick
actions, the bell); Messages (check-ins, threads, per-person new counts, the adults-only Parents talk, announcements only from adults,
reactions, who may delete, Ask reads announcements only); the calendar (Month / Week / Today, tapping a day, reminders 1 week / 1 day /
same day); WHO SEES WHAT (every audience, parents always see a child's profile, a hidden birthday leaves the calendar, nobody changes
someone else's sharing); the tree (generations, partners both ways, no one is their own ancestor, removing a person leaves no links);
photos (the phone's own store, who sees each one, delete really deletes, Erase knows the store); Meals, School, Pets, Goals, Trips,
Documents; the trial clock (and none of it in the Play app); the phone's back button; narrow phones and a tablet; no page errors.

RUN:   python tests/test_family_v2.py      (from C:/MarvelApps/dayhub)   Exit 0 = all passed.
"""
import os, sys, tempfile
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import run_tests as T
from playwright.sync_api import sync_playwright

OK = FAIL = 0
def check(name, cond, extra=""):
    global OK, FAIL
    if cond: OK += 1; print(f"  PASS  {name}")
    else: FAIL += 1; print(f"  FAIL  {name}  {extra}")

AT = "2026-11-12T14:00:00"     # Thursday Nov 12 2026, 2 PM
# A made-up family. Scott (owner) is set up through the real first-run form; the rest is typed in here.
SEED = r"""(() => { const F = fh(), t = today(), me = fhMe(), add = d => addDays(t, d);
  const mk = (id, name, face, color, role, bday) => { F.members.push({ id, name, face, color, role, bday }); };
  mk("jen", "Jen", "👩", "#ff6bcb", "adult", "1985-11-19"); mk("mia", "Mia", "👧", "#feca57", "child", "2016-11-14");
  mk("ryan", "Ryan", "👦", "#1dd1a1", "child", "2018-03-02"); mk("gma", "Grandma", "👵", "#a29bfe", "guest", "1952-11-20");
  F.events.push({ id: "e1", title: "School pickup", date: t, time: "15:30", kind: "school", rep: "weekdays", until: "", where: "Elm School", note: "", vis: "", who: ["mia", "ryan"], skip: [] });
  F.events.push({ id: "e2", title: "Family dinner", date: t, time: "18:30", kind: "family", rep: "none", until: "", where: "", note: "", vis: "", who: [], skip: [] });
  F.events.push({ id: "e3", title: "Beach week", date: add(23), time: "", kind: "trip", rep: "none", until: "", where: "", note: "", vis: "", who: [], skip: [], rem: ["week"] });
  F.chores.push({ id: "c1", title: "Take out trash", who: "ryan", every: "daily", date: "", day: 0, pts: 10, amt: 0, from: add(-4), log: {} });
  F.chores.push({ id: "c2", title: "Feed the fish", who: "mia", every: "daily", date: "", day: 0, pts: 5, amt: 0, from: add(-4), log: { [add(-1)]: { st: "ok", pts: 5, amt: 0 } } });
  F.msgs.push({ id: "m1", th: "family", by: "jen", text: "Who's grabbing milk?", at: Date.now() - 3600e3, re: {} });
  F.msgs.push({ id: "m2", th: "parents", by: "jen", text: "Gift ideas for Mia", at: Date.now() - 1800e3, re: {} });
  F.relatives.push({ id: "gpa", name: "Grandpa Joe", face: "👴" });
  F.tree = { gpa: { parents: [], spouse: "gma", born: "1949", passed: true, died: "2019", place: "Hot Springs", story: "Ran the hardware store." },
    gma: { parents: [], spouse: "gpa" }, [me.id]: { parents: ["gma", "gpa"], spouse: "jen" }, jen: { parents: [], spouse: me.id, phone: "555-0134", interests: "Gardening" },
    mia: { parents: [me.id, "jen"], school: "Elm School" }, ryan: { parents: [me.id, "jen"] } };
  F.recipes.push({ id: "r1", name: "Grandma's chili", ings: ["Beef", "Beans", "Onion"], steps: "Simmer." });
  save(); render(); })()"""


def fam(b, base, width=390, height=844, path=None, seed=True):
    a = T.App(b, base, path=path or T.FAMILYP, at=AT, width=width, height=height)
    a.page.fill('form[data-fhsetup] [name=fam]', "The Marvel Family"); a.page.fill('form[data-fhsetup] [name=name]', "Scott")
    a.page.click('form[data-fhsetup] button'); a.page.wait_for_function("S.fh && S.fh.setup")
    if a.js("typeof briefOpen === 'function' && briefOpen()"): a.page.click('[data-brief="go"]')
    if seed: a.js(SEED); a.page.wait_for_timeout(150)
    return a

def use(a, mid): a.js(f"S.fh.me = '{mid}'; save(); render()")
def me(a): return a.js("fhMe().id")
def tap(a, sel): a.page.click(sel); a.page.wait_for_timeout(200)
def hscroll(a): return a.js("document.documentElement.scrollWidth > innerWidth + 1 || [...document.querySelectorAll('#fhSheet:not(.hidden) .sheet-body')].some(b => b.scrollWidth > b.clientWidth + 1)")


def test_today(b, base):
    print("\n[Today, the parts, the tab bar]")
    a = fam(b, base)
    check("the five parts register with family.js (sharing is the fifth)", a.js("FH_MODS.map(m => m.id).join()") == "msg,tree,photos,life,sync")
    check("the greeting over the house: 'Good afternoon, Marvel Family!' and the date", a.page.locator("#cards .fh-hello2").count() == 1
          and "Good afternoon" in a.page.inner_text("#cards .fh-hello2 h1") and "Marvel Family!" in a.page.inner_text("#cards .fh-hello2 h1"))
    check("everyone's face, then Add", a.js("[...document.querySelectorAll('#cards .fh-face b')].map(x => x.textContent).join()") == "Scott,Jen,Mia,Ryan,Grandma,Add")
    heads = a.js("[...document.querySelectorAll('#cards .fh-card h3')].map(h => h.textContent.trim())")
    order = ["Today's Events", "Quick Actions", "Messages", "Coming Up", "Recent photos", "Family Tasks & Chores", "Needs You"]
    pos = [next((i for i, h in enumerate(heads) if k in h), -1) for k in order]
    check("cards in order: events, quick actions, messages, coming up, photos, chores, needs you", -1 not in pos and pos == sorted(pos), heads)
    check("today's events listed (the pickup at 3:30, dinner at 6:30)", "School pickup" in a.page.inner_text("#cards") and "Family dinner" in a.page.inner_text("#cards"))
    check("quick actions: Calendar, Chores, Shopping, Family", a.js("[...document.querySelectorAll('#cards .fh-quick .fh-qt b')].map(x => x.textContent).join()") == "Calendar,Chores,Shopping,Family")
    check("Coming Up has the birthdays and the trip (Mia's on the 14th, Jen's, Grandma's, Beach week)", all(x in a.page.inner_text("#cards") for x in ["Mia's birthday", "Jen's birthday", "Grandma's birthday", "Beach week"]))
    check("the chore ring: this week's chores so far", a.page.locator("#cards .fh-wkstat .fh-ring").count() == 1)
    check("the bell counts what needs you", a.js("+(document.querySelector('#cards .fh-bell .fh-badge') || {}).textContent || 0") == a.js("Math.min(9, fhNeeds(today()).length)"))
    check("tab bar: Today, Messages, Calendar, Family, More + the floating Add", a.js("[...document.querySelectorAll('#fhNav button')].map(b => b.getAttribute('aria-label').replace(/, \\d+ new$/, '')).join()") == "Today,Messages,Calendar,Family,More,Add something")
    check("the classic top band and the Day Hub + are hidden", a.js("getComputedStyle(document.getElementById('hero')).display") == "none" and a.js("getComputedStyle(document.getElementById('fab')).display") == "none")
    tap(a, '#fhNav [data-fhnav="more"]')
    check("More: the board's tools (Meals, School, Memories, Documents, Emergency, Trips, Pets, Goals ... Settings, Ask)",
          all(x in a.page.inner_text("#fhSheet") for x in ["Meals", "School", "Memories", "Documents", "Emergency", "Trips", "Pets", "Goals", "Settings", "Ask"]))
    check("More shows the free trial: 30 days left, then $25 once for the whole family", "Free trial: 30 days left" in a.page.inner_text("#fhSheet") and "$25 once" in a.page.inner_text("#fhSheet"))
    a.js("S.fh.setup = addDays(today(), -20); save(); showFh('more')")
    check("...counting down from the day the family was made (20 days in = 10 left)", "10 days left" in a.page.inner_text("#fhSheet"))
    tap(a, '#fhSheet [data-fhgo="settings"]')
    check("Settings opens the Hub's own Settings (the page closes first, so it isn't hidden behind)", a.js("!document.getElementById('sheet').classList.contains('hidden') && !FH_OPEN"))
    a.ctx.close()
    p = fam(b, base, path=T.FAMILYP + "?src=play", seed=False)
    check("the Play app: no trial or price words anywhere in More", p.js("STORE_MODE") and p.js("fhTrialHtml()") == "" and "$25" not in p.js("fhMoreHtml()"))
    p.js("for (let i = 0; i < 7; i++) S.fh.members.push({ id: 'k' + i, name: 'Kid' + i, face: '🧒', color: '#feca57', role: 'child', bday: '' }); save()")
    check("...and no Pro wording on Family, even with a big family", "Pro" not in p.js("fhFamilyHtml()"))
    p.ctx.close()


def test_messages(b, base):
    print("\n[Messages]")
    a = fam(b, base)
    tap(a, '#fhNav [data-fhnav="msg"]')
    check("the Messages tab: quick check-ins and the conversations (Family, Kids, School, Trips, Events, Parents)",
          a.js("[...document.querySelectorAll('#fhSheet .fhm-thread b')].map(x => x.childNodes[0].textContent.trim()).join()") == "Family,Kids,School,Trips,Events,Parents")
    n0 = a.js("fhUnread()")
    check("what's new for Scott: Jen's two messages", n0 == 2, n0)
    tap(a, '#fhSheet [data-fhmchk="omw"]')
    m = a.js("S.fh.msgs[S.fh.msgs.length - 1]")
    check("a check-in goes to the Family conversation from the person using the phone", m["chk"] == "omw" and m["th"] == "family" and m["by"] == me(a))
    check("...words only: no location anywhere in it", not any(k in m for k in ("lat", "lng", "loc", "geo")))
    tap(a, '#fhSheet [data-fhmth="family"]')
    check("opening Family marks it read for Scott (Parents still new)", a.js("fhmUnreadIn('family')") == 0 and a.js("fhmUnreadIn('parents')") == 1)
    a.page.fill('#fhSheet form[data-fhmsend] [name=text]', "Picture day Thursday!"); a.page.check('#fhSheet form[data-fhmsend] [name=ann]')
    a.page.click('#fhSheet form[data-fhmsend] button'); a.page.wait_for_timeout(200)
    ann = a.js("S.fh.msgs[S.fh.msgs.length - 1]")
    check("an adult can post an announcement, pinned for a week", ann.get("ann") is True and ann.get("until") == "2026-11-19")
    use(a, "mia"); a.js("FHM_TH = ''; showFh('msg')")
    check("Mia (a kid) never sees the Parents conversation", "Parents" not in a.js("fhmThreads().map(x => x[2]).join()") and a.page.locator('#fhSheet [data-fhmth="parents"]').count() == 0)
    a.js("fhClick({ fhmth: 'parents' })")
    check("...not even by asking for it directly", a.js("FHM_TH") == "")
    check("what's new is per person: Mia has Scott's and Jen's Family messages new", a.js("fhmUnreadIn('family')") == 3)
    tap(a, '#fhSheet [data-fhmth="family"]')
    check("a kid's send box has no announcement box", a.page.locator('#fhSheet form[data-fhmsend] [name=ann]').count() == 0)
    a.page.fill('#fhSheet form[data-fhmsend] [name=text]', "Can I have a friend over?"); a.page.click('#fhSheet form[data-fhmsend] button'); a.page.wait_for_timeout(150)
    a.js("(() => { const f = document.querySelector('#fhSheet form[data-fhmsend]'); fhSubmit(f, { text: 'sneaky', ann: '1' }); })()")
    check("a kid's message posts, and a kid can't sneak in an announcement", a.js("S.fh.msgs.some(m => m.text === 'Can I have a friend over?' && m.by === 'mia')") and a.js("!S.fh.msgs.find(m => m.text === 'sneaky').ann"))
    tap(a, '#fhSheet [data-fhmre="m1|❤️"]')
    check("a reaction is added...", a.js("S.fh.msgs.find(m => m.id === 'm1').re.mia") == "❤️")
    tap(a, '#fhSheet [data-fhmre="m1|❤️"]')
    check("...and taken back with a second tap", "mia" not in a.js("S.fh.msgs.find(m => m.id === 'm1').re"))
    check("Mia can't delete Jen's message (no button, and the tap is ignored)", a.page.locator('#fhSheet [data-fhmdel="m1"]').count() == 0
          and (a.js("fhClick({ fhmdel: 'm1' })") or True) and a.js("S.fh.msgs.some(m => m.id === 'm1')"))
    mine = a.js("S.fh.msgs.find(m => m.by === 'mia').id")
    tap(a, f'#fhSheet [data-fhmdel="{mine}"]')
    check("...but can delete her own", not a.js(f"S.fh.msgs.some(m => m.id === '{mine}')"))
    use(a, a.js("S.fh.members[0].id")); a.js("hideFh(); render()")
    check("the announcement is pinned on Today", "Picture day Thursday!" in a.page.inner_text("#cards .fhm-ann"))
    ctx = a.js("fhContext()")
    check("Ask Family Hub reads announcements, never the conversations", any(x.get("text") == "Picture day Thursday!" for x in ctx.get("announcements", []))
          and "Who's grabbing milk?" not in str(ctx) and "Gift ideas" not in str(ctx))
    a.ctx.close()


def test_calendar(b, base):
    print("\n[Calendar: Month / Week / Today, important-date reminders]")
    a = fam(b, base)
    tap(a, '#fhNav [data-fhnav="cal"]')
    check("opens on Week with the 7-day strip", a.js("FH_CALV") == "week" and a.page.locator("#fhSheet .fh-wkstrip button").count() == 7)
    tap(a, '#fhSheet [data-fhcalv="month"]')
    check("Month: November 2026, 30 days, today marked", "November 2026" in a.page.inner_text("#fhSheet") and a.page.locator("#fhSheet .fh-mc:not(.empty)").count() == 30
          and a.page.locator('#fhSheet .fh-mc.now[data-fhday="2026-11-12"]').count() == 1)
    check("days with something on them have dots (the 20th: Grandma's birthday)", a.page.locator('#fhSheet [data-fhday="2026-11-20"] .fh-mdots i').count() >= 1)
    tap(a, '#fhSheet [data-fhday="2026-11-20"]')
    check("tapping a day opens it in the Today view", a.js("[FH_CALV, FH_DAYV]") == ["day", "2026-11-20"] and "Grandma's birthday" in a.page.inner_text("#fhSheet .fh-dayl"))
    tap(a, '#fhSheet [data-fhcalv="day"]')
    check("Today view: today's events", "School pickup" in a.page.inner_text("#fhSheet .fh-dayl"))
    a.js("FH_EDIT = 'ev:new@2026-11-19'; showFh('cal')")
    check("a new event remembers 'same day' by default", a.js("[...document.querySelectorAll('#fhSheet [name^=r_]:checked')].map(x => x.name).join()") == "r_same")
    a.page.fill('#fhSheet form[data-fhevent] [name=title]', "Dentist"); a.page.fill('#fhSheet form[data-fhevent] [name=time]', "09:00")
    a.page.check('#fhSheet [name=r_week]', force=True); a.page.check('#fhSheet [name=r_day]', force=True); a.page.uncheck('#fhSheet [name=r_same]', force=True)
    a.page.click('#fhSheet form[data-fhevent] button.fh-go'); a.page.wait_for_timeout(150)
    check("the event keeps its reminder choices (1 week, 1 day - not the same day)", a.js("S.fh.events.find(e => e.title === 'Dentist').rem.join()") == "week,day")
    R = a.js("(() => { const out = []; fhReminders((key, start, at, title, body) => out.push({ key, at, title }), () => true); return out; })()")
    keys = [r["key"] for r in R]
    did = a.js("S.fh.events.find(e => e.title === 'Dentist').id")
    check("a week before: the Dentist reminder fires today, in the morning", f"fhrweek:{did}:2026-11-19" in keys)
    a.js("S.fh.events.push({ id: 'e9', title: 'Recital', date: '2026-11-13', time: '19:00', kind: 'party', rep: 'none', until: '', where: '', note: '', vis: '', who: [], skip: [], rem: ['day'] }); save()")
    R = a.js("(() => { const out = []; fhReminders((key, start, at, title, body) => out.push({ key, at, title }), () => true); return out; })()")
    keys = [r["key"] for r in R]
    check("a day before: tomorrow's Recital reminds today", "fhrday:e9:2026-11-13" in keys)
    check("...and with 'same day' unticked there is no reminder on the day itself", not any(k.startswith("fhev:e9:") for k in keys))
    check("old events (no choices saved) still remind on the day", any(k.startswith("fhev:e2:") for k in keys))
    check("a birthday a week away reminds today (Jen's on the 19th)", any(k.startswith("fhbd7:jen:") for k in keys))
    a.ctx.close()


def test_sharing(b, base):
    print("\n[WHO SEES WHAT: each member controls what they share]")
    a = fam(b, base)
    S = lambda owner, f, viewer: a.js(f"fhAudOk(fhShareOf('{owner}', '{f}'), '{owner}', '{viewer}')")
    scott = a.js("S.fh.members[0].id")
    check("a phone number starts as Parents only: Scott sees Jen's, Mia and Grandma don't", S("jen", "phone", scott) and not S("jen", "phone", "mia") and not S("jen", "phone", "gma"))
    check("everything else starts as Whole family (guests included)", S("jen", "interests", "gma") and S("jen", "bday", "mia"))
    use(a, "jen"); a.js("showFh('sharing')")
    check("Jen manages her own sharing (and her kids'), not Scott's", a.js("[...document.querySelectorAll('#fhSheet [data-fhtsharefor]')].map(x => x.dataset.fhtsharefor).join()") == "jen,mia,ryan"
          and not a.js(f"fhtCanShare(fhMem('{scott}'))"))
    a.page.select_option('#fhSheet form[data-fhtshare] [name=to_bday]', "me"); a.page.select_option('#fhSheet form[data-fhtshare] [name=to_interests]', "some")
    check("'Picked people' shows its names only when it's chosen", a.js("(() => { const r = [...document.querySelectorAll('#fhSheet .fht-srow')]; const s = n => getComputedStyle(r.find(x => x.querySelector(`[name=to_${n}]`)).querySelector('.fht-some')).display; return [s('interests'), s('phone')]; })()") == ["flex", "none"])
    a.page.check('#fhSheet [name=s_interests_ryan]', force=True)
    a.page.click('#fhSheet form[data-fhtshare] button'); a.page.wait_for_timeout(150)
    check("saved: birthday Only me, interests just Ryan", a.js("[S.fh.share.jen.bday.to, S.fh.share.jen.interests.to, S.fh.share.jen.interests.ids.join()]") == ["me", "some", "ryan"])
    check("Only me: nobody else sees it, not even Scott", not S("jen", "bday", scott) and S("jen", "bday", "jen"))
    check("Picked people: Ryan sees it, Mia and Grandma don't", S("jen", "interests", "ryan") and not S("jen", "interests", "mia") and not S("jen", "interests", "gma"))
    use(a, scott)
    check("a hidden birthday leaves Scott's calendar, birthdays page and Today", not a.js("fhDay('2026-11-19').some(x => x.bday && x.bday.id === 'jen')") and "Jen" not in a.js("fhBdays().map(b => b.m.name).join()")
          and "Jen's birthday" not in a.page.inner_text("#cards"))
    check("...and Ask Family Hub doesn't get it", a.js("fhContext().members.find(m => m.name === 'Jen').birthday") is None)
    use(a, "jen")
    check("Jen still sees her own birthday", a.js("fhDay('2026-11-19').some(x => x.bday && x.bday.id === 'jen')"))
    a.js("FHT_SHARE = 'mia'; showFh('sharing')"); a.page.select_option('#fhSheet form[data-fhtshare] [name=to_school]', "me")
    a.page.click('#fhSheet form[data-fhtshare] button'); a.page.wait_for_timeout(150)
    check("a parent sets a child's sharing; parents always still see a child's profile", S("mia", "school", scott) and S("mia", "school", "jen") and not S("mia", "school", "ryan"))
    use(a, "mia"); a.js("showFh('sharing')")
    check("Mia only gets her own sharing", a.js("fhMembers().filter(fhtCanShare).map(m => m.id).join()") == "mia")
    a.js("(() => { const f = document.createElement('form'); f.dataset.fhtshare = 'jen'; fhSubmit(f, { to_bday: 'all' }); })()")
    check("...and can't change Jen's, even by sending the form", a.js("S.fh.share.jen.bday.to") == "me")
    use(a, "ryan"); a.js("FHT_PROF = 'jen'; showFh('profile')")
    check("on Jen's profile Ryan sees what she picked him for, and a note that the rest is private", "Interests" in a.page.inner_text("#fhSheet") and "private" in a.page.inner_text("#fhSheet") and "555-0134" not in a.page.inner_text("#fhSheet"))
    a.ctx.close()


def test_tree(b, base):
    print("\n[Family tree and profiles]")
    a = fam(b, base)
    scott = a.js("S.fh.members[0].id")
    tap(a, '#fhNav [data-fhnav="family"]'); tap(a, '#fhSheet [data-fhseg="tree"]')
    G = a.js("fhtGens()")
    check("generations: Grandma + Grandpa, then Scott + Jen, then Mia + Ryan", [G["gma"], G["gpa"], G[scott], G["jen"], G["mia"], G["ryan"]] == [0, 0, 1, 1, 2, 2], G)
    rows = a.js("[...document.querySelectorAll('#fhSheet .fht-row')].map(r => [...r.querySelectorAll('.fht-node b')].map(b => b.textContent).join('+'))")
    check("drawn as three rows, partners side by side with a heart", rows == ["Grandma+Grandpa Joe", "Scott+Jen", "Mia+Ryan"] and a.page.locator("#fhSheet .fht-love").count() == 2, rows)
    tap(a, '#fhSheet .fht-node:has(b:text-is("Grandpa Joe"))')
    t = a.page.inner_text("#fhSheet")
    check("a relative who has passed: years, born in, the story", "1949 - 2019" in a.page.inner_text("#fhSheet .fht-tree, #fhSheet") or ("1949" in t and "Hot Springs" in t and "Ran the hardware store." in t))
    a.js(f"fhClick({{ fhtedit: '{scott}' }})")
    opts = a.js("[...document.querySelectorAll('#fhSheet [name=par1] option')].map(o => o.value)")
    check("nobody can be their own ancestor: Scott's kids aren't offered as his parents", "mia" not in opts and "ryan" not in opts and "gma" in opts)
    a.js(f"(() => {{ const f = document.querySelector('#fhSheet form[data-fhtprof]'); fhSubmit(f, {{ par1: 'mia', par2: 'gma', spouse: 'jen' }}); }})()")
    check("...and sending one anyway is ignored", a.js(f"S.fh.tree['{scott}'].parents.join()") == "gma")
    a.js("fhClick({ fhtrel: 'new' })")
    a.page.fill('#fhSheet form[data-fhtprof] [name=name]', "Aunt May"); a.page.select_option('#fhSheet form[data-fhtprof] [name=spouse]', "gpa")
    a.page.click('#fhSheet form[data-fhtprof] button.fh-go'); a.page.wait_for_timeout(150)
    may = a.js("S.fh.relatives.find(r => r.name === 'Aunt May').id")
    check("a new relative; partners link both ways and the old partner is let go", a.js(f"[S.fh.tree.gpa.spouse, S.fh.tree['{may}'].spouse, S.fh.tree.gma.spouse]") == [may, "gpa", ""])
    use(a, "mia"); a.js("FHT_PROF = 'gpa'; showFh('profile')")
    check("a kid can look but not edit a relative", a.page.locator("#fhSheet [data-fhtedit]").count() == 0 and a.page.locator("#fhSheet [data-fhtreldel]").count() == 0)
    use(a, scott)
    a.js("fhClick({ fhmemdel: 'ryan' })")
    check("removing Ryan leaves no links behind (tree, sharing)", "ryan" not in a.js("Object.keys(S.fh.tree)") and not a.js("JSON.stringify(S.fh.tree).includes('ryan') || JSON.stringify(S.fh.share).includes('ryan')"))
    a.js(f"fhClick({{ fhtreldel: '{may}' }})")
    check("removing a relative clears their links", not a.js(f"JSON.stringify(S.fh.tree).includes('{may}')") and a.js("S.fh.tree.gpa.spouse") == "")
    a.ctx.close()


def test_photos(b, base):
    print("\n[Photos & memories]")
    from PIL import Image
    d = tempfile.mkdtemp(prefix="fhp_"); files = []
    for i, c in enumerate(["#3a8dde", "#ff9f43"]):
        fp = os.path.join(d, f"p{i}.png"); Image.new("RGB", (900, 600), c).save(fp); files.append(fp)
    a = fam(b, base)
    scott = a.js("S.fh.members[0].id")
    a.js("showFh('photos')"); a.page.select_option('#fhSheet [data-fhpto]', "all")
    a.page.set_input_files('#fhSheet input[data-fhpadd]', files)
    a.page.wait_for_function("S.fh.photos.length === 2", timeout=10000); a.page.wait_for_timeout(300)
    keys = a.js("fhpIdb('readonly', s => s.getAllKeys())")
    ids = a.js("S.fh.photos.map(p => p.id)")
    check("2 photos: kept in the phone's own store (picture + small copy), listed in the family data without the pictures", sorted(keys) == sorted(ids + [i + "_t" for i in ids])
          and "data:image" not in a.js("JSON.stringify(S.fh)"))
    check("the grid fills in from the store", a.js("[...document.querySelectorAll('#fhSheet .fhp-grid img')].filter(i => i.src.startsWith('data:image')).length") == 2)
    a.js(f"fhClick({{ fhpbig: '{ids[0]}' }})")
    a.page.fill('#fhSheet form[data-fhpedit] [name=cap]', "Lake day"); a.page.select_option('#fhSheet form[data-fhpedit] [name=to]', "me")
    a.page.click('#fhSheet form[data-fhpedit] button.fh-go'); a.page.wait_for_timeout(150)
    check("the person who added it picks who sees it (Only me)", a.js(f"S.fh.photos.find(p => p.id === '{ids[0]}').to") == "me")
    use(a, "jen")
    check("Jen doesn't see Scott's private photo", a.js("fhpList().length") == 1)
    use(a, "mia"); a.js("FHP_TO = 'me'; S.fh.photos.push({ id: 'kidpic', al: '', cap: '', date: today(), by: 'mia', to: 'me', ids: [], at: Date.now() }); save()")
    check("a kid's private photo: parents still see it (kids are profiles a parent manages)", a.js(f"fhAudOk({{to:'me'}}, 'mia', '{scott}')") and not a.js("fhAudOk({to:'me'}, 'mia', 'ryan')"))
    check("Mia can't delete Scott's photos", not a.js(f"fhpCanEdit(S.fh.photos.find(p => p.id === '{ids[1]}'))"))
    use(a, scott); a.js("S.fh.photos = S.fh.photos.filter(p => p.id !== 'kidpic'); save()")
    a.js("hideFh(); render()"); a.page.wait_for_timeout(300)
    check("Today shows recent photos", a.page.locator("#cards .fhp-strip img").count() == 2)
    a.js(f"FHP_BIG = '{ids[1]}'; showFh('photos')"); a.page.click(f'#fhSheet [data-fhpdel="{ids[1]}"]'); a.page.wait_for_timeout(300)
    check("delete really deletes the picture from the phone", ids[1] not in str(a.js("fhpIdb('readonly', s => s.getAllKeys())")) and len(a.js("S.fh.photos")) == 1)
    check("Erase knows Family Hub's store (it empties and deletes it)", a.js("ERASE_DBS.family") == "familyhub.photos")
    a.js("FHP_VIEW = 'mem'; showFh('photos')")
    check("Memories: the photos by month", "November 2026" in a.page.inner_text("#fhSheet"))
    a.ctx.close()


def test_life(b, base):
    print("\n[Meals, School, Pets, Goals, Trips, Documents]")
    a = fam(b, base)
    scott = a.js("S.fh.members[0].id")
    a.js("showFh('meals')")
    a.page.fill('#fhSheet [name="m_2026-11-12"]', "Grandma's chili"); a.page.fill('#fhSheet [name="m_2026-11-13"]', "Tacos")
    a.page.click('#fhSheet form[data-fhlmeals] button.fh-go'); a.page.wait_for_timeout(150)
    check("the meal plan: a recipe's name links the recipe", a.js("[S.fh.meals['2026-11-12'].rid, S.fh.meals['2026-11-13'].d]") == ["r1", "Tacos"])
    tap(a, '#fhSheet [data-fhlings="r1"]'); tap(a, '#fhSheet [data-fhlings="r1"]')
    check("🛒 adds the ingredients to the grocery list, never twice", a.js("S.fh.lists.find(l => l.icon === '🛒').items.map(i => i.text).join()") == "Beef,Beans,Onion")
    check("Today: dinner tonight", "Dinner: Grandma's chili" in (a.js("hideFh(); render(); document.querySelector('#cards').innerText")))
    use(a, "mia"); a.js("showFh('school')")
    check("a kid adds her own homework only", a.js("[...document.querySelectorAll('#fhSheet form[data-fhlhwadd] [name=who] option')].map(o => o.value).join()") == "mia")
    a.page.fill('#fhSheet form[data-fhlhwadd] [name=title]', "Spelling list"); a.page.click('#fhSheet form[data-fhlhwadd] button'); a.page.wait_for_timeout(150)
    a.js("(() => { const f = document.createElement('form'); f.dataset.fhlhwadd = '1'; fhSubmit(f, { who: 'ryan', title: 'not mine' }); })()")
    check("...for herself (one for Ryan is ignored)", a.js("S.fh.hw.map(h => h.who + ':' + h.title).join()") == "mia:Spelling list")
    hw = a.js("S.fh.hw[0].id"); tap(a, f'#fhSheet [data-fhlhw="{hw}"]')
    check("she checks it off", a.js("S.fh.hw[0].done") is True)
    use(a, "ryan"); a.js(f"fhClick({{ fhlhw: '{hw}' }})")
    check("Ryan can't check off Mia's", a.js("S.fh.hw[0].done") is True)
    a.js("(() => { const f = document.createElement('form'); f.dataset.fhlpick = '1'; fhSubmit(f, { day: '4', time: '15:15', kid: 'mia' }); })()")
    check("a kid can't set up pickups", a.js("S.fh.pickups.length") == 0)
    use(a, scott); a.js("showFh('school')")
    a.page.select_option('#fhSheet form[data-fhlpick] [name=day]', "4"); a.page.fill('#fhSheet form[data-fhlpick] [name=time]', "15:15")
    a.page.select_option('#fhSheet form[data-fhlpick] [name=by]', "jen"); a.page.click('#fhSheet form[data-fhlpick] button'); a.page.wait_for_timeout(150)
    R = a.js("(() => { const out = []; fhReminders((key, start, at, title, body) => out.push({ key, at, start, title }), () => true); return out; })()")
    pk = [r for r in R if r["key"].startswith("fhpk:") and r["key"].endswith("2026-11-12")]
    check("a pickup today reminds 20 minutes before", len(pk) == 1 and pk[0]["start"] - pk[0]["at"] == 20 * 60000 and "Pick up the kids at 3:15" in pk[0]["title"], pk)
    a.js("showFh('pets'); fhClick({ fhlpetedit: 'new' })")
    a.page.fill('#fhSheet form[data-fhlpet] [name=name]', "Biscuit"); a.page.click('#fhSheet form[data-fhlpet] button.fh-go'); a.page.wait_for_timeout(150)
    pet = a.js("S.fh.pets[0].id")
    a.page.fill(f'#fhSheet form[data-fhlcare="{pet}"] [name=title]', "Walk Biscuit"); a.page.select_option(f'#fhSheet form[data-fhlcare="{pet}"] [name=who]', "ryan")
    a.page.click(f'#fhSheet form[data-fhlcare="{pet}"] button'); a.page.wait_for_timeout(150)
    check("a pet's care job becomes a chore (kids check it off, a parent OKs it)", a.js(f"S.fh.chores.some(c => c.pet === '{pet}' && c.who === 'ryan' && c.title === 'Walk Biscuit' && c.every === 'daily')"))
    tap(a, f'#fhSheet [data-fhlvet="{pet}"]')
    check("Add a vet visit opens the event form already set to Pet, titled for Biscuit", a.js("document.querySelector('#fhSheet form[data-fhevent] [name=kind]').value") == "pet"
          and a.js("document.querySelector('#fhSheet form[data-fhevent] [name=title]').value") == "Biscuit: vet visit")
    a.page.fill('#fhSheet form[data-fhevent] [name=date]', "2026-11-20"); a.page.click('#fhSheet form[data-fhevent] button.fh-go'); a.page.wait_for_timeout(150)
    check("...saved for Biscuit and shown on his card", a.js(f"S.fh.events.some(e => e.pet === '{pet}' && e.kind === 'pet')") and (a.js("showFh('pets')") or True) and "vet visit" in a.page.inner_text("#fhSheet"))
    a.js("showFh('goals')"); a.page.fill('#fhSheet form[data-fhlgoaladd] [name=title]', "Game nights"); a.page.fill('#fhSheet form[data-fhlgoaladd] [name=target]', "2")
    a.page.click('#fhSheet form[data-fhlgoaladd] button.fh-go'); a.page.wait_for_timeout(150)
    g = a.js("S.fh.goals[0].id"); tap(a, f'#fhSheet [data-fhlgoal="{g}"]'); tap(a, f'#fhSheet [data-fhlgoal="{g}"]'); a.js(f"fhClick({{ fhlgoal: '{g}' }})")
    check("a goal counts up to its target and stops there", a.js("S.fh.goals[0].have") == 2 and a.page.locator(f'#fhSheet [data-fhlgoal="{g}"]').count() == 0)
    a.js("showFh('trips')")
    check("Trips: the trip on the calendar with its countdown", "Beach week" in a.page.inner_text("#fhSheet") and "23 days" in a.page.inner_text("#fhSheet"))
    tap(a, '#fhSheet [data-fhlpack]')
    check("Packing list: made once, opened", a.js("[FH_TAB, S.fh.lists.filter(l => l.icon === '🧳').length, S.fh.lists.find(l => l.id === FH_LIST).name]") == ["lists", 1, "Packing"])
    a.js("S.fh.docs.push({ id: 'd1', type: 'ins', title: 'Insurance card', who: '', to: 'parents', ids: [], by: S.fh.members[0].id, date: today(), at: Date.now() }); save()")
    use(a, "mia"); a.js("showFh('docs')")
    check("Documents: parents only by default - a kid doesn't see them and can't add", "Insurance card" not in a.page.inner_text("#fhSheet") and a.page.locator("#fhSheet [data-fhldocadd]").count() == 0)
    use(a, "jen"); a.js("showFh('docs')")
    check("...Jen (a parent) does", "Insurance card" in a.page.inner_text("#fhSheet"))
    check("Ask reads meals, homework, pickups, pets, goals - never documents", all(k in a.js("fhContext()") for k in ("dinnerPlan", "homework", "pickups", "pets", "goals")) and "Insurance" not in str(a.js("fhContext()")))
    a.ctx.close()


def test_back_and_sizes(b, base):
    print("\n[The phone's back button, narrow phones, a tablet]")
    a = fam(b, base)
    tap(a, '#fhNav [data-fhnav="family"]'); tap(a, '#fhSheet [data-fhseg="tree"]'); tap(a, '#fhSheet .fht-node >> nth=0')
    a.js("fhClick({ fhtedit: FHT_PROF })"); a.page.wait_for_timeout(250)
    steps = [a.js("[FH_TAB, !!FH_EDIT, FH_OPEN]")]
    for _ in range(3):
        a.page.go_back(); a.page.wait_for_timeout(400); steps.append(a.js("[FH_TAB, !!FH_EDIT, FH_OPEN]"))
    check("back: the form closes, then the profile, then the page, then Today", steps == [["profile", True, True], ["profile", False, True], ["tree", False, True], ["tree", False, False]], steps)
    tap(a, '#fhNav [data-fhnav="msg"]'); tap(a, '#fhSheet [data-fhmth="family"]'); a.page.go_back(); a.page.wait_for_timeout(400)
    check("back from a conversation goes to the conversation list", a.js("[FH_TAB, FHM_TH, FH_OPEN]") == ["msg", "", True])
    tap(a, '#fhSheet [data-fhnav="cal"]')
    check("a tab in the bar starts fresh (back goes to Today, not to Messages)", a.js("FH_STACK.length") == 0)
    a.ctx.close()
    for w, h in ((320, 640), (360, 760), (820, 1180)):
        a = fam(b, base, width=w, height=h)
        bad = []
        if hscroll(a): bad.append("today")
        for k in ["msg", "cal", "family", "tree", "sharing", "more", "meals", "school", "pets", "goals", "trips", "photos", "docs", "add", "tasks", "lists"]:
            a.js(f"showFh('{k}', true)"); a.page.wait_for_timeout(60)
            if hscroll(a): bad.append(k)
        a.js("FH_CALV = 'month'; showFh('cal', true)"); a.page.wait_for_timeout(60)
        if hscroll(a): bad.append("month")
        check(f"{w} px wide: nothing runs off the side (Today and every page)", not bad, bad)
        nav = a.js("(() => { const n = document.querySelector('#fhSheet .fh-tabs').getBoundingClientRect(); return [Math.round(n.bottom), innerHeight]; })()")
        check(f"{w} px: the tab bar sits at the bottom of the screen even on a short page", abs(nav[0] - nav[1]) <= 2, nav)
        a.ctx.close()


def test_review_fixes(b, base):
    print("\n[The independent review's findings, fixed]")
    from PIL import Image
    d = tempfile.mkdtemp(prefix="fhr_"); fp = os.path.join(d, "x.png"); Image.new("RGB", (400, 300), "#22b04b").save(fp)
    a = fam(b, base)
    scott = a.js("S.fh.members[0].id")
    a.js("S.fh.members.push({ id: 'ann', name: 'Ann', face: '👩‍🦰', color: '#2e86de', role: 'adult', bday: '1990-05-05' }); S.fh.share.jen = { bday: { to: 'me', ids: [] } }; save(); render()")
    use(a, "jen"); a.js("showFh('family')")
    check("an adult can't edit another adult (no Edit button for Ann)", a.page.locator('#fhSheet [data-fhmemedit="ann"]').count() == 0 and a.page.locator('#fhSheet [data-fhmemedit="mia"]').count() == 1)
    a.js("fhClick({ fhmemedit: 'ann' })")
    check("...not by asking directly", a.js("FH_EDIT") is None)
    a.js("(() => { const f = document.createElement('form'); f.dataset.fhmember = 'ann'; fhSubmit(f, { name: 'Ann', role: 'child', face: '👩‍🦰', color: '#2e86de' }); })()")
    check("...and can't turn Ann into a child to see her private things", a.js("fhMem('ann').role") == "adult")
    a.js("fhClick({ fhmemedit: 'jen' })")
    check("Jen editing herself can't change her own role", a.js("[...document.querySelectorAll('#fhSheet form[data-fhmember] [name=role] option')].map(o => o.value).join()") == "adult")
    use(a, scott); a.js("fhClick({ fhmemedit: 'jen' })")
    check("the owner editing Jen doesn't see the birthday she keeps private", a.page.locator('#fhSheet form[data-fhmember] [name=bday]').count() == 0 and "keeps their birthday private" in a.page.inner_text("#fhSheet"))
    a.page.click('#fhSheet form[data-fhmember] button.fh-go'); a.page.wait_for_timeout(150)
    check("...and saving the form keeps it", a.js("fhMem('jen').bday") == "1985-11-19")
    use(a, "ann"); a.js("showFh('photos')"); a.page.select_option('#fhSheet [data-fhpto]', "me")
    a.page.set_input_files('#fhSheet input[data-fhpadd]', [fp]); a.page.wait_for_function("S.fh.photos.length === 1", timeout=10000)
    annpic = a.js("S.fh.photos[0].id")
    a.js("S.fh.photos.push({ id: 'annall', al: '', cap: 'Park', date: today(), by: 'ann', to: 'all', ids: [], at: Date.now() }); save()")
    use(a, "jen")
    a.js(f"(() => {{ const f = document.createElement('form'); f.dataset.fhpedit = '{annpic}'; fhSubmit(f, {{ to: 'all', cap: 'x' }}); }})()"); a.js(f"fhClick({{ fhpdel: '{annpic}' }})")
    check("another adult can't open up or delete Ann's private photo", a.js(f"S.fh.photos.find(p => p.id === '{annpic}').to") == "me")
    a.js("fhClick({ fhpdel: 'annall' })")
    check("...nor delete her shared one", a.js("S.fh.photos.some(p => p.id === 'annall')"))
    use(a, scott); a.js("S.fh.read.ann = { family: Date.now() }; S.fh.msgs[0].re = { ann: '👍' }; save()")
    a.js("fhClick({ fhmemdel: 'ann' })"); a.page.wait_for_timeout(300)
    check("removing Ann: her Only-me photo leaves with her (list and the phone's store)", not a.js(f"S.fh.photos.some(p => p.id === '{annpic}')") and annpic not in str(a.js("fhpIdb('readonly', s => s.getAllKeys())")))
    check("...her shared photo stays, now kept by Scott", a.js("S.fh.photos.find(p => p.id === 'annall').by") == scott)
    check("...her read marks and reactions go", "ann" not in a.js("S.fh.read") and "ann" not in a.js("S.fh.msgs[0].re"))
    a.js("S.fh.photos.push({ id: 'ryanpic', al: '', cap: '', date: today(), by: 'ryan', to: 'me', ids: [], at: Date.now() }); save(); fhClick({ fhmemdel: 'ryan' })")
    check("removing a child: their private photo goes to the parents, not away", a.js("(p => p && [p.by, p.to])(S.fh.photos.find(p => p.id === 'ryanpic'))") == [scott, "parents"])
    a.js("S.fh.pin = '2468'; save()"); use(a, "gma"); a.js("fhClick({ fhuse: 'mia' })")
    check("a guest (a sitter) needs the parent PIN to switch to a kid's view", a.js("[FH_PIN_FOR, fhMe().id]") == ["mia", "gma"])
    use(a, scott)
    a.js("(() => { const f = document.createElement('form'); f.dataset.fhsetup = '1'; fhSubmit(f, { name: 'Hacker', fam: 'X' }); })()")
    check("setup can't be run a second time", a.js("[S.fh.name, fhMe().id]") == ["The Marvel Family", scott])
    use(a, "mia"); a.js("fhClick({ fhdone: 'c2|2026-12-25' })")
    check("a chore can't be checked off for a made-up day", "2026-12-25" not in a.js("S.fh.chores.find(c => c.id === 'c2').log"))
    a.js("S.fh.hw = [{ id: 'h1', who: 'mia', subj: '', title: 'Mia math', due: '', done: false }, { id: 'h2', who: 'gma', subj: '', title: 'other', due: '', done: false }]; save()")
    use(a, scott); a.js("S.fh.members.push({ id: 'zoe', name: 'Zoe', face: '👧', color: '#ff9f43', role: 'child', bday: '' }); S.fh.hw.push({ id: 'h3', who: 'zoe', subj: '', title: 'Zoe reading', due: '', done: false }); save()")
    use(a, "zoe")
    check("Ask reads only the homework the kid using the phone can see", "Mia math" not in str(a.js("fhContext().homework")) and "Zoe reading" in str(a.js("fhContext().homework")))
    use(a, scott); a.js("fhMem('mia').bday = '2016-02-29'; save()")
    check("a Feb 29 birthday shows on Feb 28 in other years", a.js("fhDay('2027-02-28').some(x => x.bday && x.bday.id === 'mia')") and a.js("fhBdays().find(x => x.m.id === 'mia').next") == "2027-02-28")
    a.js("S.fh.setup = addDays(today(), -40); save(); showFh('more')")
    check("after 30 days the trial says it has ended (not 'ends today' forever)", "free trial has ended" in a.page.inner_text("#fhSheet"))
    a.js("S.fh.members[1].color = '\"><img src=x onerror=window.__x=1>'; S.fh = JSON.parse(JSON.stringify(S.fh)); render()"); a.page.wait_for_timeout(150)
    check("colours and faces from storage are re-checked (no markup gets in)", a.js("window.__x") is None and a.js("S.fh.members[1].color") == "#c8d6e5")
    a.js("ERASE_ARMED = Date.now(); eraseAll()"); a.page.wait_for_timeout(300)
    check("after Erase: the setup screen, no Family tab bar, no open page", a.page.locator("form[data-fhsetup]").count() == 1 and a.page.locator("#fhNav").count() == 0 and not a.js("FH_OPEN"))
    check("...and nothing runs before setup", a.js("fhClick({ fhmemnew: '1' })") is False and a.js("S.fh && S.fh.members ? S.fh.members.length : 0") == 0)
    sw = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "familyhub", "sw.js"), encoding="utf-8").read()
    check("tapping a reminder brings Family Hub forward, not another Hub", '"/familyhub/"' in sw)
    a.ctx.close()


def main():
    srv, base = T.serve()
    with sync_playwright() as p:
        b = p.chromium.launch()
        before = len(T.ERRORS)
        for t in (test_today, test_messages, test_calendar, test_sharing, test_tree, test_photos, test_life, test_review_fixes, test_back_and_sizes):
            t(b, base)
        errs = [e for e in T.ERRORS[before:] if "favicon" not in e and "Failed to fetch" not in e]
        check("no page errors anywhere", not errs, errs[:3])
        b.close()
    print(f"\n{OK} passed, {FAIL} failed")
    sys.exit(1 if FAIL else 0)


if __name__ == "__main__":
    main()
