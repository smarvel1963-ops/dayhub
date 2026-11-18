"""
SAVE AS: test_job.py   LOCATION: C:/MarvelApps/dayhub/tests/test_job.py

JOB HUB (app #12, Scott 11/14 "ad job hunt hub to list of aps", 11/15 his board, 11/17 "Job Hub" + his 15 page looks). Drives the real
Job Hub page (/jobhub/, job.js + jobtiles.css) on a phone-size screen with a frozen clock and a fake job list (no network). Checks:
Welcome; Career Command Center (tiles, top matches, categories, the bottom bar); Job Radar (matches, the dropdowns, search, a category,
hide); the job (Overview / Pay / Company / Requirements, Save Role, a real tap on Apply marks it Applied); Career Fit (the ring, the
breakdown with "not known", missing keywords); the Employer page (openings, insights, follow, its own board); Resume Studio (Key Impact,
plain checks, download); Edit My Resume (experience entries, skills); Tailor To a Job (adds only the words tapped as true); the Saved
Role Tracker (stages, interview, follow-up, notes); the Opportunity Pipeline; Smart Alerts + reminders; Check a Job I Found; What I'm
Looking For (work style, industries, experience, weights); what Ask reads (never current pay); damaged backup data; a feed that fails;
the engine hooks and no sideways scroll on any page.

RUN:   python tests/test_job.py      (from C:/MarvelApps/dayhub)   Exit 0 = all passed.
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

JHP = "/../jobhub/"
AT = "2026-10-01T08:00:00"          # a Thursday morning
FIELDS = ["id", "title", "company", "loc", "state", "remote", "min", "max", "period", "posted", "url", "src", "kw", "shard", "ind", "type"]
def row(id_, t, co, loc, st, rem, mn, mx, d, src, kw, sh=3, ind="", ty=""):
    return [id_, t, co, loc, st, rem, mn, mx, "year", d, f"https://jobs.example.com/{id_.replace(':', '-')}", src, kw, sh, ind, ty]
FEED = {"made": "2026-10-01T06:00Z", "credit": "Jobs from employers' own boards, Jobicy and USAJOBS.", "counts": {"Greenhouse": 3, "Lever": 1, "Ashby": 1, "Jobicy": 1, "USAJOBS": 1},
        "fields": FIELDS, "m": [
    row("gh:acme:1", "Operations Manager", "Acme Logistics", "Little Rock, AR", "AR", 0, 70000, 90000, "2026-10-01", "Greenhouse", ["excel", "logistics", "scheduling", "leadership", "years:5"], 3, "Logistics", "Full-time"),
    row("lv:fleetco:2", "Fleet Operations Manager", "FleetCo", "Remote", "", 1, 85000, 105000, "2026-09-30", "Lever", ["logistics", "dispatch", "sql"]),
    row("ab:shipit:3", "Dispatcher", "ShipIt", "Dallas, TX", "TX", 0, 45000, 52000, "2026-09-29", "Ashby", ["dispatch", "customer service"], 5, "", "Part-time"),
    row("jc:99", "Senior Software Engineer", "Webby", "Remote", "", 1, 150000, 180000, "2026-09-28", "Jobicy", ["python", "aws"], 5, "Tech"),
    row("usa:123", "Operations Manager", "Department of Transportation", "Washington, DC", "DC", 0, 0, 0, "2026-09-27", "USAJOBS", ["budgeting"], 7, "Government"),
    row("gh:acme:6", "Warehouse Operations Manager", "Acme Logistics", "Conway, AR", "AR", 0, 60000, 70000, "2026-09-25", "Greenhouse", ["forklift", "inventory"], 3, "Logistics"),
    row("gh:bigbox:7", "Regional Operations Manager", "BigBox", "Memphis, TN", "TN", 0, 80000, 100000, "2026-09-26", "Greenhouse", ["management"], 7, "Retail")]}
DETAIL3 = {"made": FEED["made"], "d": {"gh:acme:1": {"sum": "Run daily operations for our Little Rock hub.", "req": ["5+ years in operations", "Advanced Excel"], "type": "Full-time", "dept": "Operations"}}}
VOCAB = {"made": FEED["made"], "words": ["excel", "logistics", "scheduling", "leadership", "dispatch", "sql", "cdl", "forklift", "inventory", "budgeting", "management", "customer service"]}

def feed_routes(ctx, fail=False):
    ctx._jobs = []
    def jobs(r):
        ctx._jobs.append(r.request.url)
        return r.fulfill(status=500, body="down") if fail else r.fulfill(json=FEED)
    ctx.route(re.compile(r"/jobhub/jobs\.json"), jobs)
    ctx.route(re.compile(r"/jobhub/jobs/detail_03\.json"), lambda r: r.fulfill(json=DETAIL3))
    ctx.route(re.compile(r"/jobhub/jobs/detail_\d\d\.json"), lambda r: r.fulfill(json={"made": FEED["made"], "d": {}}) if "detail_03" not in r.request.url else r.fallback())
    ctx.route(re.compile(r"/jobhub/jobs/vocab\.json"), lambda r: r.fulfill(json=VOCAB))
    ctx.route(re.compile(r"jobs\.example\.com"), lambda r: r.fulfill(body="<title>posting</title>the employer's posting", content_type="text/html"))

def pane(a): return a.js("(document.querySelector('#jhSheet .jh-pane') || {}).innerText || ''")
def tap(a, sel): a.page.click(sel); a.page.wait_for_timeout(150)
def titles(a): return a.js("[...document.querySelectorAll('#jhSheet .jh-row .grow > b')].map(x => x.innerText)")
def pick(a, sel, val): a.page.select_option(sel, str(val)); a.page.wait_for_timeout(150)
def set_field(a, sel, val):
    a.js("([s, v]) => { const el = document.querySelector(s); el.value = v; el.dispatchEvent(new Event('input', {bubbles: true})); el.dispatchEvent(new Event('change', {bubbles: true})); }", [sel, val])
    a.page.wait_for_timeout(150)
def no_sideways(a): return a.js("document.documentElement.scrollWidth <= innerWidth + 1 && (!document.querySelector('#jhSheet .sheet-body') || document.querySelector('#jhSheet .sheet-body').scrollWidth <= innerWidth + 1)")
def phone(b, base, width=390, fail=False, setup=True):
    a = T.App(b, base, path=JHP, at=AT, width=width, look=None)
    feed_routes(a.ctx, fail)
    a.page.wait_for_selector("form[data-jhsetup]")
    if setup:
        f = "form[data-jhsetup] "
        a.page.fill(f + '[name="titles"]', "Operations Manager"); a.page.select_option(f + '[name="loc"]', "AR")
        a.page.click(f + ".jh-cta"); a.page.wait_for_timeout(300)
        a.js("S.jh.me.minPay = 75000; JH_SCORES = null; save(); render()"); a.page.wait_for_timeout(150)
    return a
def openjob(a, id_): a.js(f"jhClick({{ jhjob: '{id_}' }})"); a.page.wait_for_timeout(250)


def main():
    srv, base = T.serve()
    with sync_playwright() as p:
        b = p.chromium.launch()

        print("\n[1. Welcome: Your Next Move Starts Here]")
        a = phone(b, base, setup=False)
        check("Job Hub runs in its own mode with its own name", a.js("MODE === 'job' && APP_NAME === 'Job Hub' && APP_ID === 'jobhub'"))
        hello = a.js("document.querySelector('.jh-hello').innerText")
        check("the welcome: the gold logo, the sunset city, 'Your Next Move Starts Here', Find Jobs and the three promises",
              a.js("!!document.querySelector('.jh-hello .jh-logo') && !!document.querySelector('.jh-hello .jh-sky')") and "Your Next Move" in hello and "Starts Here" in hello
              and "Find Jobs" in hello and all(w in hello.replace("\n", " ") for w in ("Smarter Matches", "Faster Interviews", "Higher Earnings")), hello[:200])
        check("no Day Hub top screen or + button in Job Hub", a.js("getComputedStyle(document.getElementById('hero')).display === 'none' && getComputedStyle(document.getElementById('fab')).display === 'none'"))
        check("nothing downloads before setup", a.ctx._jobs == [], a.ctx._jobs)
        a.page.click("form[data-jhsetup] .jh-cta"); a.page.wait_for_timeout(150)
        check("setup needs a job title", not a.js("jhSet()"))
        a.page.fill('form[data-jhsetup] [name="titles"]', "Nurse"); a.page.select_option('form[data-jhsetup] [name="loc"]', "remote"); a.page.select_option('form[data-jhsetup] [name="type"]', "Part-time")
        a.page.click("form[data-jhsetup] .jh-cta"); a.page.wait_for_timeout(200)
        check("Location 'Remote' and Job type save as remote-only and Part-time", a.js("jhSet() && S.jh.me.work.join() === 'remote' && S.jh.me.where === '' && S.jh.me.type === 'Part-time'"))
        a.close()

        a = phone(b, base)
        check("Find Jobs saves what they want", a.js("jhSet() && S.jh.me.titles[0] === 'Operations Manager' && S.jh.me.where === 'AR' && S.jh.me.work.length === 0 && S.jh.me.type === ''"))
        check("the weights start at Scott's: pay 30, skills 25, location & work style 20, experience 15, industry 10",
              a.js("JSON.stringify(S.jh.me.w)") == json.dumps({"pay": 30, "match": 25, "remote": 20, "exp": 15, "ind": 10}, separators=(",", ":")))

        print("\n[2. Career Command Center]")
        home = a.js("document.getElementById('cards').innerText")
        check("Home is the Career Command Center", "Career" in home and "Command Center" in home and "Your personalized hub" in home, home[:160])
        check("today's list downloaded once", len(a.ctx._jobs) == 1 and "v=2026-10-01" in a.ctx._jobs[0], a.ctx._jobs)
        tiles = a.js("[...document.querySelectorAll('.jh-tile')].map(t => t.innerText.replace(/\\s+/g, ' ').trim()).join(' | ')")
        check("tiles: 3 Matches (+2 new), 0 Interviews this week, Top Salary $105K", tiles == "3 Matches +2 new | 0 Interviews This week | $105K Top Salary Fleet Operations Manager", tiles)
        nofloor = a.js("(() => { S.jh.me.minPay = 0; JH_SCORES = null; const s = jhScore(jhJob('gh:acme:6')); S.jh.me.minPay = 75000; JH_SCORES = null; return s; })()")
        check("no pay floor set: any posted pay counts in full (75)", nofloor == 75, nofloor)
        check("an on-site job outside their state counts halfway on location (Memphis: 65)", a.js("jhScore(jhJob('gh:bigbox:7'))") == 65, a.js("jhScore(jhJob('gh:bigbox:7'))"))
        check("Top Job Matches for You: 3 rows with Match % and a heart each", a.js("document.querySelectorAll('.jh-home .jh-row').length === 3 && document.querySelectorAll('.jh-home .jh-heart').length === 3") and "75% Match" in home)
        check("Top Jobs in the Market: category buttons", a.js("[...document.querySelectorAll('.jh-cat')].slice(0, 4).map(x => x.innerText.trim()).join('|')") == "Product|Engineering|Data|Design")
        check("the feed line counts today's openings and names the sources", "7 openings today" in home and "Greenhouse" in home and "USAJOBS" in home, home[-200:])
        check("the bottom bar: Home, Radar, Resume, Pipeline, Alerts", a.js("[...document.querySelectorAll('#jhNav button')].map(b => b.innerText.trim()).join('|')") == "Home|Radar|Resume|Pipeline|Alerts")
        check("no sideways scroll on Home (390 px)", no_sideways(a))

        print("\n[3. Job Radar]")
        tap(a, ".jh-tile")
        t = pane(a)
        check("Job Radar opens with the radar, the 85%+ badge and the title", "Job" in t and "Radar" in t and "85%+" in t and a.js("!!document.querySelector('#jhSheet .jh-radar')"), t[:200])
        check("5 results (Dispatcher and Software Engineer left out)", "5 Results" in t and "Dispatcher" not in t and "Software Engineer" not in t, t[:500])
        order = titles(a)
        check("best fit first; no posted pay ranks last", order[-1] == "Operations Manager" and order.index("Warehouse Operations Manager") == 2, order)
        pick(a, '#jhSheet [data-jhsel="work"]', "remote")
        check("Remote keeps only remote jobs", titles(a) == ["Fleet Operations Manager"], titles(a))
        pick(a, '#jhSheet [data-jhsel="work"]', "near")
        check("Near me keeps Arkansas jobs on site", sorted(titles(a)) == ["Operations Manager", "Warehouse Operations Manager"], titles(a))
        pick(a, '#jhSheet [data-jhsel="work"]', "any"); pick(a, '#jhSheet [data-jhsel="pay"]', 75000)
        check("the pay dropdown keeps jobs paying $75K+", sorted(titles(a)) == ["Fleet Operations Manager", "Operations Manager", "Regional Operations Manager"], titles(a))
        pick(a, '#jhSheet [data-jhsel="pay"]', 0)
        a.page.fill("#jhSheet form[data-jhsearch] input", "fleet"); a.page.press("#jhSheet form[data-jhsearch] input", "Enter"); a.page.wait_for_timeout(150)
        check("search finds by title or company", titles(a) == ["Fleet Operations Manager"])
        a.page.fill("#jhSheet form[data-jhsearch] input", "dispatcher"); a.page.press("#jhSheet form[data-jhsearch] input", "Enter"); a.page.wait_for_timeout(150)
        check("search reaches past the saved titles (Dispatcher)", titles(a) == ["Dispatcher"])
        a.page.fill("#jhSheet form[data-jhsearch] input", ""); a.page.press("#jhSheet form[data-jhsearch] input", "Enter"); a.page.wait_for_timeout(150)
        a.js("hideJh(); render()"); a.js("jhClick({ jhcat: 'eng' })"); a.page.wait_for_timeout(150)
        check("a Top Jobs in the Market button opens Job Radar on that kind of job (Engineering)", titles(a) == ["Senior Software Engineer"] and a.js("document.querySelector('#jhSheet [data-jhsel=\"role\"]').value") == "c:eng", titles(a))
        pick(a, '#jhSheet [data-jhsel="role"]', "")
        check("no sideways scroll on Job Radar", no_sideways(a))

        print("\n[4. The job: Overview, Pay, Company, Requirements]")
        openjob(a, "gh:acme:1")
        t = pane(a)
        check("the job card: title, company, place, type", "Operations Manager" in t and "Acme Logistics" in t and "Little Rock, AR" in t and "Full-time" in t, t[:300])
        check("Fit Score and Apply Now", "Fit Score" in t and "75%" in t and "Apply Now" in t)
        check("Pay Comparison: this role and the market average of 3 similar posted jobs", "This role" in t and "$70K – $90K" in t and "Market average" in t and "3 similar openings" in t, t[:900])
        check("no current pay yet: offers to add it (private)", "Add your current pay to compare (private)" in t)
        check("About the Employer is built only from today's postings", "Acme Logistics has 2 openings in today's list" in t and "Openings today" in t, t)
        check("About the Role loads from the job's shard", "Run daily operations" in t, t)
        ap = a.js("(() => { const x = document.querySelector('#jhSheet a[data-jhapply]'); return x ? [x.getAttribute('href'), x.target, x.rel] : null; })()")
        check("Apply opens the employer's own posting in a new tab", ap == ["https://jobs.example.com/gh-acme-1", "_blank", "noopener"], ap)
        tap(a, '#jhSheet [data-jhjtab="pay"]')
        check("Pay tab: the posted pay and the pay floor", "Posted pay" in pane(a) and "Meets your $75K floor" in pane(a), pane(a)[:600])
        tap(a, '#jhSheet [data-jhjtab="req"]')
        t = pane(a)
        check("Requirements tab: what they ask for, years, and words from the resume", "Advanced Excel" in t and "5+ years" in t and "Add my resume" in t, t)
        tap(a, '#jhSheet [data-jhjtab="comp"]')
        t = pane(a)
        check("Company tab: the other Acme opening and the employer page", "Other Openings at Acme Logistics" in t and "Warehouse Operations Manager" in t and "aren't guessed" in t, t)
        tap(a, '#jhSheet [data-jhjtab="over"]')
        tap(a, "#jhSheet .jh-pane [data-jhheart]")
        check("Save Role puts it in the pipeline as Saved", a.js("S.jh.jobs['gh:acme:1'] && S.jh.jobs['gh:acme:1'].st === 'saved' && S.jh.jobs['gh:acme:1'].add === '2026-10-01'"))
        check("the job page now says it's in the pipeline, and the top heart is gold", "In your pipeline · Saved" in pane(a) and a.js("document.querySelector('#jhSheet .jh-head [data-jhheart]').classList.contains('on')"))
        check("no sideways scroll on the job page", no_sideways(a))

        print("\n[5. Career Fit]")
        tap(a, '#jhSheet [data-jhtab="fit"]')
        t = pane(a)
        check("Career Fit: the ring with the score and its word", "Career Fit Score" in t and "75%" in t and "Good Match" in t and a.js("!!document.querySelector('#jhSheet .jh-ring')"), t[:400])
        check("Compatibility Breakdown: skills, experience, industry, career goals, location, pay", all(w in t for w in ("Skills match", "Experience level", "Industry fit", "Career goals", "Location & work style", "Pay")))
        check("what the posting or the profile doesn't say is 'not known' - never guessed", t.count("not known") >= 3 and "never a guess" in t, t)
        check("no resume yet: asks for one instead of guessing", "Add my resume" in t)
        a.page.go_back(); a.page.wait_for_timeout(200)
        check("the phone's back button goes back to the job", a.js("JH_OPEN && JH_TAB === 'job'"))
        a.page.go_back(); a.page.wait_for_timeout(200)
        check("and again to Job Radar", a.js("JH_OPEN && JH_TAB === 'radar'"))
        openjob(a, "gh:bigbox:7"); tap(a, "#jhSheet [data-jhhide]")
        check("Not for me hides a job from Job Radar", a.js("S.jh.hide.includes('gh:bigbox:7')") and "4 Results" in pane(a), pane(a)[:400])

        print("\n[6. Employer]")
        a.js("jhClick({ jhemp: 'Acme Logistics' })"); a.page.wait_for_timeout(150)
        t = pane(a)
        check("the Employer page: name, industry, openings, its own job board", "Employer" in t and "Acme Logistics" in t and "Logistics · 2 openings today" in t
              and a.js("!!document.querySelector('#jhSheet a[href=\"https://boards.greenhouse.io/acme\"]')"), t[:400])
        check("it never shows made-up size, culture or reviews", "doesn't guess size, culture or reviews" in t)
        tap(a, '#jhSheet [data-jhetab="open"]')
        check("Openings (2) lists both", "Openings (2)" in pane(a) and sorted(titles(a)) == ["Operations Manager", "Warehouse Operations Manager"], titles(a))
        tap(a, '#jhSheet [data-jhetab="ins"]')
        check("Insights: posted pay from today's openings", "From $65K to $80K, middle $80K" in pane(a), pane(a)[:500])
        tap(a, "#jhSheet [data-jhfollow]")
        check("the heart follows the employer", a.js("S.jh.follow.includes('Acme Logistics')"))

        print("\n[7. Resume Studio, Edit My Resume, Tailor]")
        a.js("jhClick({ jhtab: 'resume', jhroot: '1' })"); a.page.wait_for_timeout(150)
        t = pane(a)
        check("Resume Studio before a resume: asks for one, plain tips", "Resume" in t and "Studio" in t and "Your resume goes here" in t and "Add 3 to 6 short lines" in t)
        tap(a, '#jhSheet [data-jhtab="edit"]')
        a.page.fill('#jhcvform [name="name"]', "Sam Rivers"); a.page.fill('#jhcvform [name="head"]', "Operations & Logistics Leader")
        a.page.fill('#jhcvform [name="sum"]', "Ops leader who keeps trucks moving.")
        check("the summary counts its letters", a.js("document.querySelector('#jhcvform .jh-cnt').innerText") == "35 / 600")
        tap(a, '#jhSheet [data-jhexp="new"]')
        f = '#jhSheet form[data-jhexpf] '
        a.page.fill(f + '[name="t"]', "Dispatch Supervisor"); a.page.fill(f + '[name="co"]', "ShipCo"); a.page.fill(f + '[name="from"]', "2024-01")
        a.page.fill(f + '[name="bul"]', "Led a team of 12 dispatchers\n• Cut delivery delays 18% in one year\nresponsible for the schedule")
        a.page.click(f + ".jh-cta"); a.page.wait_for_timeout(200)
        check("a job saves with its lines (dots cleaned), and Edit My Resume keeps what was typed above", a.js("S.jh.cv.exp[0].t === 'Dispatch Supervisor' && S.jh.cv.exp[0].bul.join('|') === 'Led a team of 12 dispatchers|Cut delivery delays 18% in one year|responsible for the schedule'")
              and a.js("document.querySelector('#jhcvform [name=\"name\"]').value") == "Sam Rivers" and "Jan 2024 – Present" in pane(a), pane(a)[:600])
        for s in ("Excel", "scheduling", "logistics", "Typo"):
            a.page.fill('#jhSheet form[data-jhskill] [name="sk"]', s); a.page.press('#jhSheet form[data-jhskill] [name="sk"]', "Enter"); a.page.wait_for_timeout(120)
        a.js("jhClick({ jhskdel: String(S.jh.cv.skills.indexOf('Typo')) })"); a.page.wait_for_timeout(120)
        check("skills add as chips and come off with the ×", a.js("S.jh.cv.skills.join('|')") == "Excel|scheduling|logistics")
        a.page.click('#jhSheet button[form="jhcvform"]'); a.page.wait_for_timeout(200)
        t = pane(a)
        check("Save Changes goes back to Resume Studio with the resume on paper", a.js("JH_TAB") == "resume" and "Sam Rivers" in t and "Dispatch Supervisor" in t and a.js("S.jh.cv.head") == "Operations & Logistics Leader")
        check("Key Impact = the strongest line (a number and a strong verb)", "Key Impact" in t and "Led a team of 12 dispatchers" in t.split("Key Impact")[1][:80], t)
        check("the plain checks ask for 5+ skills and the words saved jobs ask for - nothing sent anywhere", "at least 5 skills" in t and "leadership" in t and "only if you have them" in t and "nothing is sent anywhere" in t, t)
        check("Resume Studio never says AI", re.search(r"\bAI\b", t) is None)
        with a.page.expect_download() as dl: a.page.click("#jhSheet [data-jhdl]")
        check("the download is a text file with the experience in it", dl.value.suggested_filename == "Sam Rivers resume.txt" and "Dispatch Supervisor - ShipCo (Jan 2024 – Present)" in a.js("jhResumeTxt()"), dl.value.suggested_filename)
        a.js("jhClick({ jhfitfor: 'gh:acme:1' })"); a.page.wait_for_timeout(200)
        check("Career Fit now shows the evidence: excel, logistics, scheduling on the resume; leadership not",
              a.js("[...document.querySelectorAll('#jhSheet .jh-kw .no')].map(x => x.innerText.trim()).join('|')") == "leadership"
              and a.js("[...document.querySelectorAll('#jhSheet .jh-kw .yes')].map(x => x.innerText.trim()).join('|')") == "excel|logistics|scheduling")
        check("the score moved with the evidence (75 -> 81)", a.js("jhScore(jhJob('gh:acme:1'))") == 81)
        a.js("jhClick({ jhtailorgo: 'gh:acme:1' })"); a.page.wait_for_timeout(200)
        t = pane(a)
        check("Tailor To a Job: the saved job, the fit ring and the gap analysis", "Tailor To a" in t and "Operations Manager" in t and "3 Matching Skills" in t and "1 Missing Keyword" in t, t[:700])
        check("nothing is added until a word is tapped as true", a.js("document.querySelector('#jhSheet [data-jhpickadd]').disabled"))
        tap(a, '#jhSheet [data-jhpick="leadership"]'); tap(a, "#jhSheet [data-jhpickadd]")
        check("the tapped word goes in Skills, and the score rises (81 -> 88)", a.js("S.jh.cv.skills.includes('leadership')") and a.js("jhScore(jhJob('gh:acme:1'))") == 88, a.js("jhScore(jhJob('gh:acme:1'))"))

        print("\n[8. Saved Role Tracker + the Pipeline]")
        a.js("jhClick({ jhtrack: 'gh:acme:1' })"); a.page.wait_for_timeout(150)
        check("the tracker: the five stages with counts, the job, dates, notes", all(w in pane(a) for w in ("Saved", "Applied", "Interview", "Offer", "Closed", "Interview Date & Time", "Follow-Up", "Notes", "Role Details")))
        tap(a, '#jhSheet [data-jhstage="applied"]')
        check("tapping Applied stamps the day", a.js("S.jh.jobs['gh:acme:1'].st === 'applied' && S.jh.jobs['gh:acme:1'].appl === '2026-10-01'"))
        set_field(a, '#jhSheet [data-jhtf="iv"]', "2026-10-02T14:00"); set_field(a, '#jhSheet [data-jhtf="note"]', "Talked to Dana")
        check("an interview date moves it to Interview; notes save", a.js("S.jh.jobs['gh:acme:1'].st === 'interview' && S.jh.jobs['gh:acme:1'].iv === '2026-10-02T14:00' && S.jh.jobs['gh:acme:1'].note === 'Talked to Dana'"))
        openjob(a, "lv:fleetco:2")
        with a.ctx.expect_page() as pg: a.page.click("#jhSheet a[data-jhapply]")
        pg.value.close(); a.page.wait_for_timeout(500)
        check("a real tap on Apply opens the posting and marks it Applied", a.js("S.jh.jobs['lv:fleetco:2'] && S.jh.jobs['lv:fleetco:2'].st === 'applied' && S.jh.jobs['lv:fleetco:2'].appl === '2026-10-01'"))
        a.js("jhClick({ jhtrack: 'lv:fleetco:2' })"); a.page.wait_for_timeout(150)
        set_field(a, '#jhSheet [data-jhtf="fu"]', "2026-10-01"); set_field(a, '#jhSheet [data-jhtf="fuNote"]', "Email the hiring manager")
        check("a follow-up date and what to do", a.js("S.jh.jobs['lv:fleetco:2'].fu === '2026-10-01' && S.jh.jobs['lv:fleetco:2'].fuNote === 'Email the hiring manager'"))
        a.js("jhClick({ jhtab: 'pipe', jhroot: '1' })"); a.page.wait_for_timeout(150)
        t = pane(a)
        check("Opportunity Pipeline tiles: Saved 0, Applied 1, Interview 1, Offer 0, with what's new this week",
              a.js("[...document.querySelectorAll('#jhSheet .jh-pt b')].map(x => x.innerText).join('|')") == "0|1|1|0" and "+1 new" in t, t[:400])
        tap(a, '#jhSheet [data-jhpf="applied"]')
        check("a tile shows just that stage", titles(a) == ["Fleet Operations Manager"], titles(a))
        tap(a, '#jhSheet [data-jhpf="applied"]')
        check("Pipeline Opportunities (2), interview first with its date", titles(a)[0] == "Operations Manager" and "Pipeline Opportunities (2)" in pane(a) and "Tomorrow" in pane(a), pane(a)[:700])
        check("no sideways scroll on the Pipeline", no_sideways(a))
        a.js("hideJh(); render()"); a.page.wait_for_timeout(150)
        check("Home's Interviews tile counts it, and Your Next Steps lists it", a.js("document.querySelectorAll('.jh-tile b')[1].innerText") == "1" and "Interview Reminder" in a.js("document.getElementById('cards').innerText"))

        print("\n[9. Smart Alerts]")
        a.js("jhClick({ jhtab: 'alerts', jhroot: '1' })"); a.page.wait_for_timeout(150)
        t = pane(a)
        check("Smart Alerts: monitoring, new match, interview reminder, follow-up cue", "Monitoring for Opportunities" in t and "New Match" in t and "Interview Reminder" in t and "Follow-up Cue" in t and "Email the hiring manager" in t, t)
        check("opening Alerts marks what it showed as seen", a.js("S.jh.seen") == FEED["made"] and a.js("S.jh.seenIds.includes('gh:acme:1')"))
        a.js("jhClick({ jhtab: 'alerts', jhroot: '1' })"); a.page.wait_for_timeout(100)
        check("a seen match doesn't alert again", "New Match" not in pane(a))
        a.page.click('#jhSheet [data-jhmon]'); a.page.wait_for_timeout(100)
        check("Monitoring can be turned off", a.js("S.jh.mon === false"))
        rem = a.js("(() => { const out = []; jhReminders((k, end, at, t, b) => out.push([k, new Date(at).toISOString(), t]), () => true); return out; })()")
        check("monitoring off = no reminders", rem == [], rem)
        a.page.click('#jhSheet [data-jhmon]'); a.page.wait_for_timeout(100)
        rem = a.js("(() => { const out = []; jhReminders((k, end, at, t, b) => out.push([k, new Date(at).toISOString(), t]), () => true); return out; })()")
        check("reminders: interview the evening before (6 PM) and 2 hours before; follow-up at 10 AM",
              [r[0].split(":")[0] for r in rem] == ["jhi1", "jhi2", "jhf"] and rem[0][1] == "2026-10-01T23:00:00.000Z" and rem[1][1] == "2026-10-02T17:00:00.000Z" and rem[2][1] == "2026-10-01T15:00:00.000Z", rem)
        pulse = a.js("(() => { const out = []; jhPulse((p, i, t) => out.push(t)); return out; })()")
        check("the Life pulse lists the interview and the follow-up", any("Interview:" in x for x in pulse) and any("Follow up:" in x for x in pulse), pulse)
        a.js("jhClick({ jhtrack: 'lv:fleetco:2' })"); a.page.wait_for_timeout(150); tap(a, "#jhSheet [data-jhfudone]")
        check("ticking the follow-up done takes it off the alerts and reminders", a.js("S.jh.jobs['lv:fleetco:2'].fuDone === true && !jhNextSteps().some(s => s.k === 'fu')"))

        print("\n[10. Check a Job I Found]")
        a.js("jhClick({ jhtab: 'more', jhroot: '1' })"); a.page.wait_for_timeout(100); tap(a, '#jhSheet [data-jhtab="paste"]')
        f = "#jhSheet form[data-jhpaste] "
        a.page.fill(f + '[name="t"]', "Fleet Manager"); a.page.fill(f + '[name="co"]', "RoadRunner"); a.page.fill(f + '[name="loc"]', "Remote")
        a.page.fill(f + '[name="url"]', "https://www.linkedin.com/jobs/view/123"); a.page.fill(f + '[name="pay"]', "$70k - $85k")
        desc = "We need excel skills, a cdl and 5 years running a fleet."
        a.page.fill(f + '[name="text"]', desc)
        check("the description counts its letters", a.js("document.querySelector('#jhSheet form[data-jhpaste] .jh-cnt').innerText") == f"{len(desc)} / 6,000")
        a.page.click(f + ".jh-cta"); a.page.wait_for_timeout(200)
        pid = a.js("S.jh.mine[0].id")
        check("a pasted job is checked and saved to the pipeline", pid.startswith("p-") and a.js(f"S.jh.jobs['{pid}'].st === 'saved' && S.jh.jobs['{pid}'].src === 'You'"))
        check("its pay is read ($70K - $85K) and it's marked remote", a.js("S.jh.mine[0].min === 70000 && S.jh.mine[0].max === 85000 && S.jh.mine[0].rem === 1"))
        t = pane(a)
        check("it opens on Career Fit with the words it found (excel yes, cdl missing, 5 years)", a.js("JH_TAB") == "fit" and "excel" in t and "cdl" in t and "5+ years" in t, t)
        openjob(a, pid); tap(a, "#jhSheet [data-jhpdel]"); check("Remove asks for a second tap", "Tap again to remove" in pane(a))
        tap(a, "#jhSheet [data-jhpdel]")
        check("the second tap removes it everywhere", a.js(f"!S.jh.mine.length && !S.jh.jobs['{pid}']"))

        print("\n[11. What I'm Looking For + what Ask reads]")
        a.js("jhClick({ jhtab: 'prefs', jhroot: '1' })"); a.page.wait_for_timeout(150)
        f = "#jhSheet form[data-jhprefs] "
        a.page.fill(f + '[name="curPay"]', "68000"); a.page.fill(f + '[name="yrs"]', "5")
        check("current pay is hidden as it's typed", a.js("document.querySelector('#jhSheet [name=\"curPay\"]').classList.contains('hid')"))
        a.js("(() => { const r = document.querySelector('#jhSheet [name=\"wt_pay\"]'); r.value = '0'; r.dispatchEvent(new Event('input', { bubbles: true })); })()")
        check("the slider shows its number as it moves", a.js("document.querySelector('#jhSheet [name=\"wt_pay\"]').parentElement.querySelector('b').innerText") == "0%")
        a.page.click(f + ".jh-togs.sm label:has(input[value=\"Logistics\"])"); a.page.wait_for_timeout(80)
        check("an industry button lights when picked", a.js("document.querySelector('#jhSheet .jh-togs.sm input[value=\"Logistics\"]').closest('.jh-tog').classList.contains('on')"))
        a.page.click(f + ".jh-cta"); a.page.wait_for_timeout(200)
        check("pay, experience, industries and weights save", a.js("S.jh.me.curPay === 68000 && S.jh.me.yrs === 5 && S.jh.me.inds.join() === 'Logistics' && S.jh.me.w.pay === 0 && S.jh.me.work.length === 0"))
        check("experience and industry now count (Acme: 88 -> 99 with pay weighted 0)", a.js("JH_TAB === 'radar'") and a.js("jhScore(jhJob('gh:acme:1'))") == 99, a.js("jhScore(jhJob('gh:acme:1'))"))
        a.js("jhClick({ jhtab: 'prefs', jhroot: '1' })"); a.page.wait_for_timeout(100)
        a.page.click(f + '.jh-togs:not(.sm) label:has(input[name="work_remote"])'); a.page.click(f + ".jh-cta"); a.page.wait_for_timeout(200)
        check("Remote Options save, and an on-site job counts halfway on location (99 -> 86)", a.js("S.jh.me.work.join()") == "remote" and a.js("jhScore(jhJob('gh:acme:1'))") == 86, a.js("jhScore(jhJob('gh:acme:1'))"))
        ctx = json.dumps(a.js("jhContext()"))
        check("Ask reads the search, resume and pipeline", "Operations Manager" in ctx and "Led a team of 12" in ctx and "interview" in ctx and "Dispatch Supervisor" in ctx)
        check("Ask never gets the current pay", "68000" not in ctx and "68K" not in ctx and "curPay" not in ctx, ctx[:300])
        openjob(a, "gh:acme:1")
        check("the pay comparison now shows your current pay", "Your current pay" in pane(a) and "$68K" in pane(a))
        a.close()

        print("\n[12. damaged backup data + a feed that fails]")
        a = phone(b, base, setup=False)
        a.js("S.jh = { setup: true, me: { titles: 'x', where: 'ZZ', remote: 'moon', work: 'x', type: 'Forever', minPay: -5, w: { pay: 999 }, inds: 'x', yrs: 'lots' }, cv: [], jobs: { a: 5, b: { st: 'weird', url: 'javascript:alert(1)', iv: 'soon', fuDone: 'yes', stAt: 'never' } }, mine: [{ id: 'evil', url: 'ftp://x' }], hide: 'x', follow: 'x' }; save(); render()")
        a.page.wait_for_timeout(200)
        check("damaged data is repaired, never trusted",
              a.js("(() => { const J = S.jh; return !J.jobs.a && J.jobs.b.st === 'saved' && J.jobs.b.url === '' && J.jobs.b.iv === '' && J.jobs.b.fuDone === false && J.me.where === '' && J.me.work.length === 0 && J.me.type === '' && J.me.minPay === 0 && J.me.w.pay === 100 && J.me.w.exp === 15 && Array.isArray(J.me.titles) && Array.isArray(J.me.inds) && J.me.yrs === 0 && J.mine[0].id.startsWith('p-') && J.mine[0].url === '' && Array.isArray(J.hide) && Array.isArray(J.follow) && Array.isArray(J.cv.exp); })()"))
        a.js("S.jh.cv = { head: 'Driver', bul: ['Led 3 people'] }; jh(); save()")
        check("a resume from the first build (loose lines) moves into one experience entry", a.js("S.jh.cv.exp.length === 1 && S.jh.cv.exp[0].bul[0] === 'Led 3 people' && S.jh.cv.bul.length === 0"))
        a.close()
        a = phone(b, base, fail=True)
        a.js("jhClick({ jhtab: 'radar', jhroot: '1' })"); a.page.wait_for_timeout(200)
        check("a feed that fails says so with Try again - no blank screen", "Couldn't load today's jobs" in pane(a) and a.js("!!document.querySelector('#jhSheet [data-jhreload]')"))
        a.page.wait_for_timeout(600)
        check("a failed download is asked for once - it never loops", len(a.ctx._jobs) == 1, len(a.ctx._jobs))
        tap(a, "#jhSheet [data-jhreload]"); a.page.wait_for_timeout(300)
        check("Try again asks once more", len(a.ctx._jobs) == 2, len(a.ctx._jobs))
        a.close()

        print("\n[13. the engine hooks]")
        a = T.App(b, base, look=None); T.setup(a)
        check("every Hub's family list has Job Hub", a.js("HUBS.some(h => h.id === 'jobhub' && /jobhub\\/$/.test(h.url))"))
        notes = a.js("fetch('version.json').then(r => r.json())")
        check("engine 1.66 everywhere (app, offline worker, update notes)", a.js("VERSION") == "1.66" and notes["version"] == "1.66" and
              'const CACHE = "dayhub-v1.66";' in open(os.path.join(T.ROOT, "sw.js"), encoding="utf-8").read())
        check("the update note for Job Hub goes only to Job Hub", any(x.startswith("💼 Job Hub:") for x in notes["notes"]["1.66"]) and not a.js("noteForMe('💼 Job Hub: hello')"))
        a.close()
        jhdir = os.path.join(os.path.dirname(T.ROOT), "jobhub")
        sw = open(os.path.join(jhdir, "sw.js"), encoding="utf-8").read()
        shell = re.search(r"const SHELL = \[(.*?)\];", sw, re.S).group(1)
        missing = [f for f in re.findall(r'"([^"]+)"', shell) if f != "./" and not os.path.exists(os.path.normpath(os.path.join(jhdir, f)))]
        check("every file Job Hub's offline worker keeps exists", not missing, missing)
        man = json.load(open(os.path.join(jhdir, "manifest.json"), encoding="utf-8"))
        check("its install file: own id, own icons", man["id"] == "/jobhub/" and all(os.path.exists(os.path.join(jhdir, i["src"])) for i in man["icons"]))
        a = phone(b, base, width=360)
        a.js("(() => { jhSaveJob(jhJob('gh:acme:1'), 'interview'); S.jh.cv.exp = [{ id: 'e1', t: 'Dispatch Supervisor', co: 'ShipCo', from: '2024-01', to: '', bul: ['Led a team of 12'] }]; save(); })()")
        bad = [] if no_sideways(a) else ["home"]
        for how in ("jhClick({ jhtab: 'radar', jhroot: '1' })", "jhClick({ jhjob: 'gh:acme:1' })", "jhClick({ jhjtab: 'pay' })", "jhClick({ jhjtab: 'comp' })", "jhClick({ jhjtab: 'req' })",
                    "jhClick({ jhtab: 'fit' })", "jhClick({ jhemp: 'Acme Logistics' })", "jhClick({ jhetab: 'ins' })", "jhClick({ jhtrack: 'gh:acme:1' })", "jhClick({ jhtab: 'pipe', jhroot: '1' })",
                    "jhClick({ jhtab: 'alerts', jhroot: '1' })", "jhClick({ jhtab: 'resume', jhroot: '1' })", "jhClick({ jhtab: 'edit' })", "jhClick({ jhexp: 'e1' })", "jhClick({ jhtailorgo: '' })",
                    "jhClick({ jhtab: 'prefs', jhroot: '1' })", "jhClick({ jhtab: 'paste', jhroot: '1' })", "jhClick({ jhtab: 'more', jhroot: '1' })"):
            a.js(how); a.page.wait_for_timeout(80)
            if not no_sideways(a): bad.append(how)
        check("no sideways scroll at 360 px on any Job Hub page", not bad, bad)
        a.close()
        b.close()
    srv.shutdown()
    real = [e for e in T.ERRORS if "Failed to load resource" not in e]
    check("no page errors", not real, real[:5])
    print(f"\n{OK} passed, {FAIL} failed")
    sys.exit(1 if FAIL else 0)


if __name__ == "__main__":
    main()
