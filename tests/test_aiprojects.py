"""
SAVE AS: test_aiprojects.py   LOCATION: C:/MarvelApps/dayhub/tests/test_aiprojects.py

DAY HUB AI PROJECTS (Scott 11/22: "todo day hub list from me filter to AI projects as we build this monster set of app and AI responds to
app as daily projects and tick list are completed" -> "Yes, build it"). Runs the REAL AI Projects service on this PC (hubai dev_server:
wrangler dev --local, an empty throwaway list, a test sign-in key and a TEST Claude key - the live list is never touched) and proves:
- Only Day Hub on an owner phone gets it: a customer phone has no AI tab, no "For Claude" box, and never fetches aiprojects.js.
- Tasks -> AI asks for Google sign-in once; then shows the list.
- A task added with "For Claude" goes on the list (linked to the task); Claude's tool sees it.
- Claude ticks it off with a note (tools/ai_projects.py done) -> Day Hub ticks the task and shows the note under it.
- A project Claude adds from chat shows as "added by Claude"; one typed in the AI tab goes up with its details.
- "Send one of your tasks" sends an existing task; sending it again does not add it twice.
- Scott ticking a linked task himself marks the project done in the list too.
- ✕ takes a waiting project off the list.
- The service: no key / wrong key / someone else's sign-in are refused; Claude cannot delete; nobody else sees the list.
- No page errors.
RUN:   python tests/test_aiprojects.py      (from C:/MarvelApps/dayhub)   Exit 0 = all passed.
"""
import json, os, subprocess, sys, urllib.error, urllib.request
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import run_tests as T
from playwright.sync_api import sync_playwright

OK = FAIL = 0
def check(name, cond, extra=""):
    global OK, FAIL
    if cond: OK += 1; print(f"  PASS  {name}", flush=True)
    else: FAIL += 1; print(f"  FAIL  {name}  {extra}", flush=True)

HUBAI = os.path.join(os.path.dirname(T.ROOT), "hubai")
dev = subprocess.Popen(["node", os.path.join(HUBAI, "cloud", "test", "dev_server.mjs"), "8791"], cwd=os.path.join(HUBAI, "cloud"),
                       stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
INFO = json.loads(dev.stdout.readline())
BASE, TOK, KEYFILE = INFO["base"], INFO["tokens"]["owner"], INFO["keyfile"]
KEY = json.load(open(KEYFILE))["key"]


def api(method, path, auth, body=None):
    req = urllib.request.Request(BASE + path, method=method, data=json.dumps(body).encode() if body is not None else None,
                                 headers={"Authorization": auth, "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return r.status, json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode() or "{}")


def tool(*args):
    r = subprocess.run([sys.executable, "-I", os.path.join(HUBAI, "tools", "ai_projects.py"), *args], capture_output=True, text=True,
                       env={**os.environ, "HUBAI_KEYFILE": KEYFILE}, encoding="utf-8", errors="replace")
    return r.stdout + r.stderr


def items():
    return api("GET", "/v1/projects", "Key " + KEY)[1]["items"]


INIT = ("window.AIP_URL = %s; window.__AIP_FAKE = { user: null, token: %s, signInAs: { email: 'owner@example.com' } };"
        "localStorage.setItem('dayhub.owner', JSON.stringify({ OWNER: true }));") % (json.dumps(BASE), json.dumps(TOK))


def main():
    srv, base = T.serve()
    with sync_playwright() as p:
        b = p.chromium.launch()
        check("the AI Projects service runs on this PC (throwaway list, test keys)", INFO["ok"], INFO.get("log", ""))

        print("\n[1. a customer phone: nothing new]")
        a = T.App(b, base, look=None); T.setup(a)
        fetched = []
        a.page.on("request", lambda r: fetched.append(r.url) if "aiprojects.js" in r.url else None)
        a.js("shellGo('tasks')"); a.page.wait_for_timeout(200)
        check("no AI tab on Tasks", a.page.query_selector('.dt-seg [data-dtseg="tasks:ai"]') is None)
        a.js("openQA('todo', true)"); a.page.wait_for_timeout(150)
        check("no 'For Claude' box on Add a to-do", a.page.query_selector('#qaForm [name=forClaude]') is None)
        a.js("closeQA()")
        check("aiprojects.js is never fetched", not fetched and a.js("typeof aipHtml") == "undefined", str(fetched))
        a.close()

        print("\n[2. Scott's phone: sign in, For Claude, Claude ticks it off]")
        a = T.App(b, base, look=None)
        a.ctx.add_init_script(INIT)
        a.page.reload(); a.page.wait_for_function("typeof render === 'function' && document.querySelector('#hero .greet')"); T.setup(a)
        errs_before = len(T.ERRORS)
        a.js("shellGo('tasks')"); a.page.wait_for_timeout(300)
        seg = a.page.query_selector('.dt-seg [data-dtseg="tasks:ai"]')
        check("Tasks has an AI tab", seg is not None)
        a.page.click('.dt-seg [data-dtseg="tasks:ai"]'); a.page.wait_for_function("typeof aipHtml === 'function'"); a.page.wait_for_timeout(500)
        check("AI asks for Google sign-in once", a.page.query_selector('#cards [data-aip="signin"]') is not None)
        a.page.click('#cards [data-aip="signin"]'); a.page.wait_for_timeout(800)
        txt = a.page.inner_text("#cards .aip")
        check("signed in: the list shows (empty)", "Nothing on the list yet" in txt and "0 waiting" in txt, txt[:160])

        a.qa("todo", {"title": "Build the Day Hub AI tab", "forClaude": 1}); a.page.wait_for_timeout(1200)
        it = items()
        tid = a.js("S.todos.find(t => t.title === 'Build the Day Hub AI tab').id")
        check("a task added with For Claude goes on the list, linked to the task", len(it) == 1 and it[0]["todoId"] == tid and it[0]["status"] == "waiting", json.dumps(it)[:200])
        check("...the task remembers its project", a.js("S.todos.find(t => t.title === 'Build the Day Hub AI tab').aiId") == it[0]["id"])
        out = tool("list")
        check("Claude's tool sees it", "Build the Day Hub AI tab" in out and "from Day Hub" in out and "1 open AI project" in out, out[:200])
        pid = it[0]["id"]
        out = tool("start", pid)
        check("Claude's tool: start -> being built", out.startswith("working"), out)
        a.js("aipPull()"); a.page.wait_for_timeout(600)
        a.js("shellGo('tasks')"); a.page.click('.dt-seg [data-dtseg="tasks:ai"]'); a.page.wait_for_timeout(300)
        dbg = a.js("(() => { const s = document.querySelector('#cards section.aip'); return s.innerHTML.slice(0, 700) + ' ## vis=' + getComputedStyle(s).visibility + ' disp=' + getComputedStyle(s).display + ' body=' + (s.querySelector('.body') ? getComputedStyle(s.querySelector('.body')).display : '-'); })()")
        check("Day Hub shows it under Being built", "being built" in a.page.inner_text("#cards section.aip").lower(), dbg)
        out = tool("done", pid, "Built: AI tab on Tasks, live in 1.76")
        check("Claude's tool: done with a note", out.startswith("done"), out)
        a.js("aipPull()"); a.page.wait_for_timeout(700)
        check("Day Hub ticks the task Claude finished", a.js("(() => { const t = S.todos.find(x => x.id === %s); return todoDone(t); })()" % json.dumps(tid)) is True)
        a.js("shellGo('tasks')"); a.page.click('.dt-seg [data-dtseg="tasks:ai"]'); a.page.wait_for_timeout(300)
        txt = a.page.inner_text("#cards .aip")
        # (the "done today" count is not checked here: this phone's clock is frozen at Oct 1 while the test service stamps real times)
        check("...and shows Claude's note under it, in Done", "Built: AI tab on Tasks, live in 1.76" in txt and "done" in [l.strip().lower() for l in txt.splitlines()], txt[:300])

        print("\n[3. more ways onto the list]")
        out = tool("add", "Places screen for Photo Hub", "asked in chat")
        a.js("aipPull()"); a.page.wait_for_timeout(600)
        a.js("shellGo('tasks')"); a.page.click('.dt-seg [data-dtseg="tasks:ai"]'); a.page.wait_for_timeout(300)
        txt = a.page.inner_text("#cards .aip")
        check("a project Claude adds from chat shows as 'added by Claude'", "Places screen for Photo Hub" in txt and "added by Claude" in txt, txt[:300])
        a.page.fill('#cards [data-aipform] [name=t]', "Trips: places + dates")
        a.page.fill('#cards [data-aipform] [name=n]', "group a trip's photos by town and day")
        a.page.click('#cards [data-aipform] button'); a.page.wait_for_timeout(900)
        new = [x for x in items() if x["title"] == "Trips: places + dates"]
        check("a project typed in the AI tab goes up with its details", len(new) == 1 and new[0]["notes"] == "group a trip's photos by town and day" and new[0]["by"] == "scott")
        a.qa("todo", {"title": "Fix the calendar color"}); a.page.wait_for_timeout(300)
        check("a plain task stays off the list", not any(x["title"] == "Fix the calendar color" for x in items()))
        a.js("shellGo('tasks')"); a.page.click('.dt-seg [data-dtseg="tasks:ai"]'); a.page.wait_for_timeout(300)
        a.page.click('#cards .aip-send summary'); a.page.wait_for_timeout(100)
        cid = a.js("S.todos.find(t => t.title === 'Fix the calendar color').id")
        a.page.click(f'#cards [data-aipsend="{cid}"]'); a.page.wait_for_timeout(900)
        sent = [x for x in items() if x.get("todoId") == cid]
        check("'Send one of your tasks' sends an existing task", len(sent) == 1)
        a.js("aipSendTodo(S.todos.find(t => t.id === %s))" % json.dumps(cid)); a.page.wait_for_timeout(700)
        check("...sending it again does not add it twice", len([x for x in items() if x.get("todoId") == cid]) == 1)

        print("\n[4. Scott ticks one himself; takes one off]")
        a.js("(() => { const t = S.todos.find(x => x.id === %s); t.done = true; t.doneDay = today(); save(); })()" % json.dumps(cid))
        a.js("aipPull()"); a.page.wait_for_timeout(900)
        x = [y for y in items() if y.get("todoId") == cid][0]
        check("Scott ticking a linked task marks the project done too", x["status"] == "done" and x.get("doneBy") == "scott", json.dumps(x))
        a.js("shellGo('tasks')"); a.page.click('.dt-seg [data-dtseg="tasks:ai"]'); a.page.wait_for_timeout(300)
        a.page.once("dialog", lambda d: d.accept())
        trip = [y for y in items() if y["title"] == "Trips: places + dates"][0]
        a.page.click(f'#cards [data-aipdrop="{trip["id"]}"]'); a.page.wait_for_timeout(900)
        check("✕ takes a waiting project off the list", [y for y in items() if y["id"] == trip["id"]][0]["status"] == "dropped")
        check("no page errors", len(T.ERRORS) == errs_before, str(T.ERRORS[errs_before:][:3]))
        a.close()

        print("\n[5. the service keeps the list private]")
        check("no key -> refused", api("GET", "/v1/projects", "")[0] == 401)
        check("a wrong key -> refused", api("GET", "/v1/projects", "Key not-the-key")[0] == 401)
        check("someone else's Google sign-in -> refused", api("GET", "/v1/projects", "Bearer " + INFO["tokens"]["stranger"])[0] == 403)
        st, _ = api("DELETE", f"/v1/projects/{pid}", "Key " + KEY)
        check("Claude cannot delete a project", st == 403)
        st, _ = api("PATCH", f"/v1/projects/{pid}", "Bearer " + TOK, {"reply": "pretending to be Claude"})
        check("only Claude writes the note", st == 403)
        st, _ = api("DELETE", f"/v1/projects/{pid}", "Bearer " + TOK)
        check("Scott can delete one", st == 200 and not any(y["id"] == pid for y in items()))
        # 11/23: the first version lost a change when two came close together (KV reads can be a minute old)
        ids = []
        for i in range(10):
            st, j = api("POST", "/v1/projects", "Key " + KEY, {"title": f"quick {i}"})
            ids.append(j["item"]["id"])
            api("PATCH", f"/v1/projects/{j['item']['id']}", "Key " + KEY, {"status": "done", "reply": f"done {i}"})
        now = {y["id"]: y for y in items()}
        check("ten quick add-then-done pairs back to back: every one sticks", all(i in now and now[i]["status"] == "done" and now[i]["reply"] for i in ids),
              str([(i, now.get(i, {}).get("status")) for i in ids]))
        b.close()
    srv.shutdown()


try:
    main()
except Exception as e:
    check("no crash", False, repr(e))
finally:
    try:
        dev.stdin.close(); dev.wait(timeout=30)
    except Exception:
        dev.kill()
print(f"\n{OK} passed, {FAIL} failed")
sys.exit(1 if FAIL else 0)
