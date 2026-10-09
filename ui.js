/* SAVE AS: ui.js · LOCATION: C:/MarvelApps/dayhub/ui.js
 * Day Hub, part 2 of 2 (split out of app.js in v0.38 to stay under 3,000 lines):
 * the cards, quick add, AI helper + brain dump, events, settings and START.
 * Loaded right AFTER app.js (index.html + ../cruisehub/index.html); both are classic
 * scripts sharing one global scope, so everything in app.js is visible here.
 * START must stay at the bottom of this file - it runs once both are loaded. */
"use strict";

// --------------------------------------------------------------- cards
const CARDS = {
  schedule: { icon: "🗓️", title: "Schedule",
    meta: () => { const n = dayItems(VIEW).filter(isPlan).length; return n ? `${n} planned` : ""; },
    add: ["event", "Add to schedule"],
    body: () => {
      const items = dayItems(VIEW), isToday = VIEW === today(), t = nowT();
      let html = `<div class="daynav"><button class="nav" data-day="-1" aria-label="Previous day">‹</button>
        <button class="dn" data-day="0"><b>${dayName(VIEW)}</b><span>${longDate(VIEW)}</span></button>
        <button class="nav" data-day="1" aria-label="Next day">›</button></div>`;
      if (S.gcal.connected && !gReady()) html += `<button class="sync" data-gsync="1">🔄 Tap to sync Google Calendar${S.gcal.fetched ? ` · last ${fmtTime(S.gcal.fetched)}` : ""}</button>`;
      if (!items.length) return html + `<div class="tl-empty">Nothing scheduled ${isToday ? "today" : "this day"}.<br>Tap <b>+</b> to add something.</div>`;
      let nowDone = !isToday;
      const rows = [];
      for (const i of items) {
        if (!nowDone && i.t && i.t > t) { rows.push(`<div class="now-line"><span>${hm(t)}</span></div>`); nowDone = true; }
        const past = isToday && i.t && i.t < t;
        const ctrl = i.tick ? `<input type="checkbox" class="tick" data-tickl="${i.tick}" ${i.done ? "checked" : ""} aria-label="Done">`
                   : i.del ? `<button class="x" data-del="${i.del}" aria-label="Remove">✕</button>` : "";
        rows.push(`<div class="ti k-${i.kind} ${past ? "past" : ""} ${i.done ? "done" : ""}">
          <div class="tt">${i.t ? hm(i.t) : "All day"}${i.end ? `<small>${hm(i.end)}</small>` : ""}</div>
          <div class="dot"></div>
          <div class="tc"><div class="tn">${i.icon} ${esc(i.title)}${i.kind === "g" ? ` <span class="gbadge">Google</span>` : ""}</div>
            ${i.sub ? `<div class="ts">${esc(i.sub)}</div>` : ""}</div><span class="ctl">${i.cal ? `<button class="x" data-ics="${i.cal}" aria-label="Add to phone calendar">📲</button>` : ""}${ctrl}</span></div>`);
      }
      if (!nowDone) rows.push(`<div class="now-line"><span>${hm(t)}</span></div>`);
      return html + `<div class="tl">${rows.join("")}</div>`;
    } },

  // v0.8 (Scott 10/1 "next Day Hub feature"): the evening look at tomorrow.
  // Shown from 3 PM; from 5 PM it moves to the top (see render()).
  reset: { icon: "🛏️", title: "Nightly reset",
    meta: () => S.resetDay === today() ? "done ✓" : (n => n ? `${n} to wrap up` : "all wrapped up")(resetData().open.length),
    body: () => resetHtml() },
  tomorrow: { icon: "🌙", title: "Tomorrow",
    meta: () => { const n = dayItems(addDays(today(), 1)).filter(isPlan).length; return n ? `${n} planned` : "clear"; },
    body: () => {
      const T1 = addDays(today(), 1), items = dayItems(T1), plans = items.filter(isPlan);
      const w = WXDATA && WXDATA.here && WXDATA.here.days[1];
      const L = [];
      if (w) {
        const tips = [];
        if (w.rain >= 50) tips.push("☔ rain likely — take an umbrella");
        if (w.lo <= 40) tips.push("🧥 cold start — grab a jacket");
        if (w.hi >= 92) tips.push("🥵 hot one — bring water");
        L.push(`<div class="today-line">${wmo(w.code)[0]} <b>${Math.round(w.hi)}°</b> / ${Math.round(w.lo)}° · ${wmo(w.code)[1]}${w.rain >= 20 ? ` · rain ${w.rain}%` : ""}${tips.length ? `<br><span class="sub">${tips.join(" · ")}</span>` : ""}</div>`);
        const al = wxAlerts(T1); if (al.length) L.push(`<div class="wx-alerts">${wxAlertHtml(al)}</div>`);
      }
      const first = plans.find(i => i.t);
      if (first) {
        const alarm = new Date(atMs(T1, first.t) - 60 * 60000);
        const an = alarmNote(T1);
        L.push(`<div class="today-line">⏰ First up <b>${hm(first.t)}</b> — ${esc(first.title)}<br><span class="sub">${an && alarmsOn(T1).length ? esc(an) : `Alarm idea: ${alarm.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} (an hour before)`}</span></div>`);
      }
      if (plans.length) L.push(plans.slice(0, 5).map(i => `<div class="row"><span class="time">${i.t ? hm(i.t) : "All day"}</span><span class="grow">${i.icon} ${esc(i.title)}</span></div>`).join(""));
      else L.push(`<div class="today-line">📅 Nothing planned yet — a clear day.</div>`);
      items.filter(i => i.kind === "bill").forEach(i => L.push(`<div class="today-line">💳 <b>${esc(i.title)}</b> ${esc(i.sub || "")}</div>`));
      items.filter(i => i.kind === "cd").forEach(i => L.push(`<div class="today-line">🎉 <b>${esc(i.title)}</b> is tomorrow!</div>`));
      items.filter(i => i.kind === "pkg").forEach(i => L.push(`<div class="today-line">📦 <b>${esc(i.title)}</b> (${esc(i.sub)})</div>`));
      const left = S.todos.filter(t => todoShown(t) && !todoDone(t) && !isRep(t)).length;
      if (left) L.push(`<div class="today-line">✅ ${left} to-do${left === 1 ? "" : "s"} still open today — they carry over.</div>`);
      return L.join("") + `<div class="foot-actions" style="margin-top:10px"><button class="btn sm" data-plan="tomorrow">＋ Plan tomorrow</button>
        <button class="btn sm ghost" data-day="1" data-goto="schedule">See tomorrow's schedule</button></div>`;
    } },

  work: { icon: "💼", title: "Work hours", add: ["shift", "Add a shift"],
    meta: () => { const p = periodPay(periodStart(today())); return p.hrs ? `${fmtH(p.hrs)} this ${periodWeeks() > 1 ? "period" : "week"}` : ""; },
    body: () => {
      const W = S.work, oc = onClock();
      const clock = oc !== null
        ? `<div class="clockbox on"><div><b>On the clock</b><span>since ${fmtTime(W.clockIn)} · ${fmtH(oc)}</span></div><button class="btn" data-clock="out">Clock out</button></div>`
        : `<div class="clockbox"><div><b>Off the clock</b><span>Tap when your shift starts</span></div><button class="btn" data-clock="in">Clock in</button></div>`;
      const ps = periodStart(today()), p = periodPay(ps), last = periodPay(addDays(ps, -7 * periodWeeks())), two = periodWeeks() > 1;
      const pay = W.rate
        ? `<div class="paygrid"><div class="fact">Hours<b>${fmtH(p.hrs)}</b>${p.ot ? `<small>${fmtH(p.ot)} overtime</small>` : ""}</div>
             <div class="fact">Gross<b>${money(p.gross)}</b></div>
             <div class="fact take">Take-home*<b>${money(p.net)}</b></div></div>
           <div class="fine" style="margin-top:6px">*Rough: ${money(W.rate)}/hr, overtime after ${W.otAfter}h at 1.5x, minus ${W.taxPct}% for taxes.
             Last ${two ? "period" : "week"}: ${fmtH(last.hrs)} · ~${money(last.net)}. <button class="add-link" style="padding:0" data-qa="pay">Change pay</button></div>`
        : `<button class="btn sm ghost" data-qa="pay" style="margin-top:10px">Set your hourly pay to see take-home</button>`;
      const rows = p.shifts.map(x => `<div class="row"><span class="time">${parseDay(x.day).toLocaleDateString([], two ? { weekday: "short", month: "numeric", day: "numeric" } : { weekday: "short" })}</span>
          <span class="grow">${hm(x.start)} – ${hm(x.end)}${Number(x.brk) ? `<span class="sub">${x.brk} min break</span>` : ""}</span>
          <b>${fmtH(shiftHours(x))}</b><button class="x" data-del="work.shifts:${x.id}" aria-label="Remove">✕</button></div>`).join("");
      return clock + pay + (rows ? `<div class="day-label" style="margin-top:14px">${two ? `Pay period · ${prettyDate(p.start)} – ${prettyDate(p.end)}` : "This week"}</div>${rows}` : "");
    } },

  budget: { icon: "💰", title: "Budget", add: ["spend", "Log spending"],
    meta: () => { const b = budget();
      return b.status === "over" ? `<span style="color:var(--red)">over</span>` : b.status === "tight" ? `<span style="color:var(--orange)">tight</span>`
        : b.income ? `${money(b.perDay)}/day` : ""; },
    body: () => {
      const b = budget(), M = S.money;
      if (!b.income) return `<div class="empty">${M.type === "salary" ? "Enter your yearly salary" : "Set your hourly pay and add a few shifts"} — Day Hub will tell you if spending is running ahead of what you bring home.</div>
        <button class="btn sm ghost" data-qa="pay" style="margin-top:10px">Set income</button>`;
      const line = b.status === "over" ? `<div class="bstat over">⚠ At this pace you'll spend <b>${money(-b.left)}</b> more than you bring home this month.</div>`
        : b.status === "tight" ? `<div class="bstat tight">Tight month — about <b>${money(b.left)}</b> to spare. ${money(b.perDay)}/day keeps you even.</div>`
        : `<div class="bstat ok">On track — about <b>${money(b.perDay)}/day</b> free for the rest of the month.</div>`;
      const rows = b.spends.slice().sort((x, y) => y.day.localeCompare(x.day)).slice(0, 5).map(x => `<div class="row"><span class="time">${prettyDate(x.day)}</span>
        <span class="grow">${esc(x.what || "Spending")}</span><b>${money(x.amt)}</b><button class="x" data-del="money.spends:${x.id}" aria-label="Remove">✕</button></div>`).join("");
      return line + `<div class="paygrid"><div class="fact take">Take-home<b>${money(b.income)}</b></div><div class="fact">Bills<b>${money(b.bills)}</b></div>
          <div class="fact">Spent<b>${money(b.spent)}</b>${b.projSpend > b.spent + 0.5 ? `<small>~${money(b.projSpend)} by month end</small>` : ""}</div></div>
        <div class="fine" style="margin-top:6px">${new Date().toLocaleDateString([], { month: "long" })} estimate: ${esc(b.how)}, minus ${S.work.taxPct}% for taxes.
          <button class="add-link" style="padding:0" data-qa="pay">Change income</button></div>` +
        (rows ? `<div class="day-label" style="margin-top:12px">Recent spending</div>${rows}` : "");
    } },

  weather: { icon: "🌤️", title: "Weather",
    meta: () => (WXDATA && WXDATA.here) ? esc(WXDATA.here.label) + (navigator.onLine === false && WX_AT ? ` · updated ${new Date(WX_AT).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : "") : "",
    body: () => {
      if (!S.city) return `<div class="empty">Add your city or ZIP to see the weather.</div>
        <button class="btn sm" data-open="sheet" style="margin-top:10px">Set location</button>`;
      if (!WXDATA) return `<div class="skel"></div>`;
      const w = WXDATA.here;
      if (!w) return `<div class="empty">${esc(WXDATA.error || "City or ZIP not found — check it in ⚙ settings.")}</div>`;
      const hours = w.hourly.map((x, i) => `<div class="hour ${i === 0 ? "now" : ""}"><div class="h">${i === 0 ? "Now" : new Date(x.t).toLocaleTimeString([], { hour: "numeric" })}</div>
        <div class="i">${wxIcon(x.code, x.isDay)[0]}</div><div class="tp">${Math.round(x.temp)}°</div><div class="r">${x.rain >= 20 ? x.rain + "%" : ""}</div></div>`).join("");
      const mn = Math.min(...w.days.map(d => d.lo)), mx = Math.max(...w.days.map(d => d.hi)), span = Math.max(1, mx - mn);
      const days = w.days.map((d, i) => `<div class="dayrow"><span>${i === 0 ? "Today" : parseDay(d.d).toLocaleDateString([], { weekday: "short" })}</span>
        <span>${wmo(d.code)[0]}</span><span class="lo">${Math.round(d.lo)}°</span>
        <span class="bar"><span style="left:${(d.lo - mn) / span * 100}%;width:${Math.max(6, (d.hi - d.lo) / span * 100)}%"></span></span>
        <span class="hi">${Math.round(d.hi)}°${d.rain >= 30 ? `<span class="rn"> ${d.rain}%</span>` : ""}</span></div>`).join("");
      const al = wxAlerts(today());
      return cruiseWxBlock() + `${TRAVEL ? `<div class="wx-where">📍 Where you are — ${esc(w.label)}</div>` : ""}${al.length ? `<div class="wx-alerts">${wxAlertHtml(al)}</div>` : ""}<div class="hours">${hours}</div>
        <div class="wx-facts"><div class="fact">Feels like<b>${Math.round(w.cur.apparent_temperature)}°</b></div>
          <div class="fact">Wind<b>${Math.round(w.cur.wind_speed_10m)} mph</b></div>
          <div class="fact">Sunrise<b>${fmtTime(w.day.sunrise)}</b></div><div class="fact">Sunset<b>${fmtTime(w.day.sunset)}</b></div></div>
        <div class="days">${days}</div>`;
    } },

  todos: { icon: "✅", title: "To-do", add: ["todo", "Add a to-do"],
    meta: () => { const shown = S.todos.filter(todoShown); if (!shown.length) return "";
      const d = shown.filter(todoDone).length;
      return `<span style="display:inline-flex;gap:7px;align-items:center">${d}/${shown.length}<span class="ring" style="--p:${Math.round(d / shown.length * 100)}"></span></span>`; },
    body: () => {
      const shown = S.todos.filter(todoShown).sort((a, b) => todoDone(a) - todoDone(b));
      return shown.length ? shown.map(t => `<div class="row ${todoDone(t) ? "done" : ""}"><input type="checkbox" class="tick" data-tick="${t.id}" ${todoDone(t) ? "checked" : ""} aria-label="Done">
        <span class="grow">${esc(t.title)}${isRep(t) ? `<span class="sub">${repLabel(t)}</span>` : ""}</span><button class="x" data-del="todos:${t.id}" aria-label="Remove">✕</button></div>`).join("")
        : `<div class="empty">Nothing to do. Enjoy it. 🎉</div>`;
    } },

  // v0.17 (Scott 10/1: "get day hub totally loaded"): the Notes card from his icon sheet.
  notes: { icon: "📝", title: "Notes",
    meta: () => S.notes.length ? `${S.notes.length}` : "",
    body: () => {
      const list = S.notes.slice().sort((a, b) => (b.pinned - a.pinned) || String(b.updated).localeCompare(String(a.updated)));
      return `<form class="inline-add" data-noteadd="1" style="margin-top:0"><input name="text" placeholder="Jot something down…" required autocomplete="off"><button class="btn sm">Save</button></form>` +
        (list.length ? list.map(n => `<div class="row"><button class="x" data-notepin="${n.id}" aria-label="${n.pinned ? "Unpin" : "Pin"}" style="opacity:${n.pinned ? 1 : .35}">📌</button>
            <span class="grow note-text" data-noteedit="${n.id}">${esc(n.text).replace(/\n/g, "<br>")}<span class="sub">${prettyDate(String(n.updated).slice(0, 10))}</span></span>
            <button class="x" data-del="notes:${n.id}" aria-label="Delete">✕</button></div>`).join("")
          : `<div class="empty">Ideas, gate codes, wifi passwords for guests, what the doctor said — keep it here.</div>`);
    } },

  bills: { icon: "💳", title: "Bills due", add: ["bill", "Add a bill"],
    meta: () => S.bills.length ? `${money(S.bills.reduce((s, b) => s + Number(b.amount || 0), 0))}/mo` : "",
    body: () => {
      const up = upcomingBills();
      if (!up.length) return `<div class="empty">Add your monthly bills — Day Hub reminds you before they're due.</div>`;
      return up.map(b => { const n = daysUntil(b.due);
        return `<div class="row"><div class="grow">${esc(b.name)}<span class="sub">${money(b.amount)} · ${prettyDate(b.due)}</span></div>
          <span class="pill ${n < 0 ? "late" : n <= 3 ? "soon" : ""}">${inDays(n)}</span>
          <button class="btn sm ghost" data-paid="${b.id}">Paid</button>
          <button class="x" data-ics="bill:${b.id}" aria-label="Add to phone calendar">📲</button>
          <button class="x" data-del="bills:${b.id}" aria-label="Remove">✕</button></div>`; }).join("") +
        `<div class="total"><span>Every month</span><b>${money(S.bills.reduce((s, b) => s + Number(b.amount || 0), 0))}</b></div>`;
    } },

  inbox: { icon: "📬", title: "From your email",
    meta: () => S.mail.found.length ? `${S.mail.found.length} to review` : "",
    body: () => {
      const f = S.mail.found.slice().sort((a, b) => (a.day || "9999").localeCompare(b.day || "9999"));
      const top = S.mail.on && !mReady() ? `<button class="sync" data-mail="scan">📬 Tap to check your email${S.mail.last ? ` · last ${fmtTime(S.mail.last)}` : ""}</button>` : "";
      if (!f.length) return top + `<div class="empty">${S.mail.on ? "Nothing waiting. New cruise bookings, appointments, flights and deliveries show up here." : "Connect Gmail in ⚙ — use the email you book trips with — and Day Hub finds cruises, appointments, flights, reservations and packages in it."}</div>`;
      return top + f.map(x => x.type === "cruise" ? (() => { const ad = cruiseAdds(x.cruise), c = x.cruise;
          return `<div class="row"><div class="grow">${esc(x.title)}${c.line ? ` <span class="tag">${esc(c.line)}</span>` : ""}
            <span class="sub">${[c.start && `${prettyDate(c.start)}${c.end ? " – " + prettyDate(c.end) : ""}`, c.booking && `booking ${esc(c.booking)}`, c.cabin || c.category, c.ports && `${c.ports.length} ports`, c.finalDue && `final payment ${prettyDate(c.finalDue)}`].filter(Boolean).map(String).join(" · ")}
            ${ad ? ` · adds ${[...ad.add, ad.newPorts ? `${ad.newPorts} ports` : ""].filter(Boolean).join(", ")} to your trip` : ""}</span></div>
            <button class="btn sm" data-addfound="${esc(x.key)}">${ad ? "Update trip" : "Add trip"}</button><button class="x" data-dropfound="${esc(x.key)}" aria-label="Dismiss">✕</button></div>`; })()
        : `<div class="row"><div class="grow">${x.type === "package" ? "📦" : "📅"} ${esc(x.title)}
          <span class="sub">${x.type === "package" ? `${(CARRIERS[x.carrier] || CARRIERS.other)[0]} · …${esc(x.num.slice(-6))}${x.day ? ` · arrives ${prettyDate(x.day)}` : ""}`
            : `${dayName(x.day)} ${prettyDate(x.day)}${x.time ? ` · ${hm(x.time)}` : " · time not found"}`} · from "${esc(x.src)}"</span></div>
        <button class="btn sm" data-addfound="${esc(x.key)}">Add</button><button class="x" data-dropfound="${esc(x.key)}" aria-label="Dismiss">✕</button></div>`).join("");
    } },

  trips: { icon: MODE === "trip" ? "✈️" : "🚢", title: "Trips",
    meta: () => { const tr = curTrip(); return tr ? `${readiness(tr).pct}% ready` : ""; },
    body: () => {
      const tr = curTrip();
      if (!tr) return `<div class="empty">${MODE === "trip" ? "Got a trip coming? Trip Hub counts down, lays it out day by day, keeps your payments and spending and hands you ready-made packing and document lists."
        : `Got a cruise or trip coming? ${APP_NAME} counts down, reminds you about the final payment, tracks onboard spending and hands you ready-made packing and document lists.`}</div>
        ${gmailAllowed() ? `<div class="today-line" style="margin-top:8px">✨ <b>Zero effort:</b> connect the email you booked with (⚙ → Connect Gmail) and the ship, dates, booking number, cabin and ports fill in by themselves.</div>` : ""}
        <button class="btn sm" data-qa="trip" style="margin-top:10px">🚢 Plan a trip</button>`;
      const all = upcomingTrips();
      const pick = all.length > 1 ? `<div class="tabs">${all.map(t => `<button class="tab ${t.id === tr.id ? "on" : ""}" data-tripsel="${t.id}">${esc(t.name)}</button>`).join("")}</div>` : "";
      const sd = tr.start ? daysUntil(tr.start) : null, nights = tripNights(tr);
      const big = sd === null ? "?" : sd > 0 ? sd : daysUntil(tr.end || tr.start) >= 0 ? "🎉" : "✓";
      const lab = sd === null ? "add the dates" : sd > 0 ? (sd === 1 ? "day to go" : "days to go") : daysUntil(tr.end || tr.start) >= 0 ? "you're away!" : "back home";
      const head = `<div class="trip-hero"><div class="trip-n">${big}</div><div class="grow"><b>${isCruise(tr) ? "🚢" : "✈️"} ${esc(tr.name)}</b>
          <span class="sub">${lab}${tr.start ? ` · ${prettyDate(tr.start)}${tr.end ? ` – ${prettyDate(tr.end)}` : ""}${nights ? ` · ${nights} nights` : ""}` : ""}</span>
          <span class="sub">${[tr.line, tr.ship, tr.port].filter(Boolean).map(esc).join(" · ")}</span></div>
          <button class="btn sm ghost" data-tripedit="${tr.id}">Edit</button></div>
        <button class="btn" data-forget="1" style="width:100%;margin-top:10px">${isCruise(tr) ? "🛳️" : "🧳"} What am I forgetting?</button>`;
      const tabs = ["ready", "money"].concat(isCruise(tr) ? ["ports"] : [], ["onboard"], isCruise(tr) ? ["perks"] : [], ["lists"], isCruise(tr) ? ["tips"] : []);
      const TL = { ready: "✅ Ready", money: "💳 Money", ports: "🗺️ Ports", onboard: isCruise(tr) ? "🍹 Onboard" : "💵 Spending", lists: "📋 Lists", perks: "🎁 Perks", tips: "💡 Good to know" };
      const tabsAll = tabs.slice(); tabs.splice(0, tabs.length, ...tabsAll.filter(k => typeof shellTripTabOk !== "function" || shellTripTabOk(k)));   // v0.58 shell
      const tab = tabs.includes(S.tripTab) ? S.tripTab : tabs[0];
      let body = "";
      if (tab === "ready") {
        const R = readiness(tr);
        body = `<div class="ready"><div class="ring big" style="--p:${R.pct}"><b>${R.pct}%</b></div>
            <div class="grow"><b>${R.pct >= 100 ? "Ready to go!" : "Ready"}</b><span class="sub">Stage: ${esc(R.phase)}</span>
            ${R.next ? `<div class="next">➡️ <b>Next:</b> ${esc(R.next.action)}</div>` : `<div class="next">✅ Nothing needs you right now.</div>`}</div></div>` +
          R.items.map(i => `<div class="today-line">${i.score >= 1 ? "✅" : i.now ? "⚠️" : "⏳"} ${esc(i.label)}${i.score > 0 && i.score < 1 ? ` <span class="sub" style="display:inline">${Math.round(i.score * 100)}%</span>` : ""}</div>`).join("") +
          `<div class="fine" style="margin-top:6px">⚠️ = matters now · ⏳ = later — Day Hub brings it up when it's time.</div>`;
      } else if (tab === "ports") {
        const days = []; if (tr.start) for (let d = tr.start; d <= (tr.end || tr.start); d = addDays(d, 1)) days.push(d);
        ensurePortWx(tr);
        body = days.length ? days.map(d => { const pt = portOn(tr, d);
          const label = pt ? `⚓ <b>${esc(pt.name)}</b>` : d === tr.start ? `🚢 <b>Sail day</b> — ${esc(tr.port || "")}` : d === tr.end ? `🏠 <b>Back in port</b> — getting home` : "🌊 At sea";
          const sub = pt ? [portWxText(pt), pt.arrive && `in ${hm(pt.arrive)}`, pt.allAboard ? `<b style="color:var(--orange)">all aboard ${hm(pt.allAboard)}${Number(pt.shipOffset) ? " ship time" : ""}</b>`
                              : pt.depart && `departs ${hm(pt.depart)} · <b style="color:var(--orange)">add all-aboard ✏️</b>`,
                            pt.indie && `<b style="color:var(--red)">independent tour</b>`,
                            pt.excursion && (pt.excursion.toLowerCase() === "none" ? "no excursion" : `🤿 ${esc(pt.excursion)}${pt.meet ? ` · meet ${hm(pt.meet)}` : ""}${pt.where ? ` · ${esc(pt.where)}` : ""}`)].filter(Boolean).join(" · ") : "";
          return `<div class="row"><span class="time">${parseDay(d).toLocaleDateString([], { weekday: "short", month: "numeric", day: "numeric" })}</span>
            <span class="grow">${label}${sub ? `<span class="sub">${sub}</span>` : ""}</span>
            ${pt ? `<button class="x" data-portedit="${pt.id}" aria-label="Edit">✏️</button><button class="x" data-tripdel="${tr.id}:ports:${pt.id}" aria-label="Remove">✕</button>`
                 : d !== tr.start && d !== tr.end ? `<button class="btn sm ghost" data-portadd="${d}">＋ Port</button>` : ""}</div>`; }).join("")
          : `<div class="empty">Add the sailing dates (Edit) and every day shows up here.</div>`;
        body += `<div class="fine" style="margin-top:6px">⚓ Day Hub alarms you 60 and 30 minutes before all-aboard — the ship will not wait.</div>`;
      } else if (tab === "money") {
        const paid = tripPaid(tr), left = tripLeft(tr), spm = savePerMonth(tr), fd = tr.finalDue ? daysUntil(tr.finalDue) : null;
        body = tr.total ? `<div class="paygrid"><div class="fact">Total<b>${money(tr.total)}</b></div><div class="fact">Paid<b>${money(paid)}</b></div>
            <div class="fact ${left ? "" : "take"}">Left<b>${money(left)}</b></div></div>
            <div class="bar" style="margin-top:10px"><span style="left:0;width:${Math.min(100, paid / tr.total * 100)}%"></span></div>`
          : `<div class="empty">Add the total price (Edit) to see what's left to pay.</div>`;
        if (tr.finalDue) body += `<div class="today-line" style="margin-top:8px">💳 Final payment due <b>${prettyDate(tr.finalDue)}</b>
            ${left === 0 ? `<span class="pill">paid off ✓</span>` : `<span class="pill ${fd !== null && fd <= 14 ? "late" : fd <= 45 ? "soon" : ""}">${fd < 0 ? `${-fd} days ago` : inDays(fd)}</span>`}</div>`;
        else if (isCruise(tr)) body += `<div class="today-line sub" style="margin-top:8px">Add the final-payment date (Edit) — ${APP_NAME} reminds you 14, 3 and 1 day before.</div>`;
        if (spm && left) body += `<div class="today-line">💰 Put aside about <b>${money(spm)}</b> a month to be ready.</div>`;
        body += (tr.payments || []).slice().sort((a, b) => b.day.localeCompare(a.day)).map(x => `<div class="row"><span class="time">${prettyDate(x.day)}</span>
            <span class="grow">${esc(x.note || "Payment")}</span><b>${money(x.amt)}</b><button class="x" data-tripdel="${tr.id}:payments:${x.id}" aria-label="Remove">✕</button></div>`).join("");
        body += `<button class="add-link" data-tripqa="tpay">＋ Log a payment</button>`;
        // v0.54 WALLET: the whole vacation, not just the fare.
        const W = tripWallet(tr);
        if (typeof itemizedHtml === "function") body = itemizedHtml(tr) + body;          // v0.62 itemized running cost, first
        body += `<div class="day-label" style="margin-top:14px">👛 Whole trip</div>
          <div class="paygrid"><div class="fact">Total vacation<b>${money(W.total)}</b></div><div class="fact">Paid<b>${money(W.paid)}</b></div>
            <div class="fact ${W.left ? "" : "take"}">Left<b>${money(W.left)}</b></div></div>
          ${W.total ? `<div class="bar" style="margin-top:10px"><span style="left:0;width:${Math.min(100, W.paid / W.total * 100)}%"></span></div>` : ""}
          <div class="today-line sub" style="margin-top:6px">${isCruise(tr) ? "Cruise" : "Trip"} ${W.fare ? money(W.fare) : "— (Edit to add)"}${W.extras ? ` + everything around it ${money(W.extras)}` : ""}</div>
          ${W.credit ? `<div class="today-line">💵 Onboard credit: <b>${money(W.credit)}</b></div>` : ""}
          ${W.unused ? `<button class="today-line linkish" data-triptab="perks">🎁 ${W.unused} benefit${W.unused === 1 ? "" : "s"} not used yet — see Perks</button>` : ""}` +
          W.costs.map(c => `<div class="row"><span class="grow">${costLabel(c.cat)}${c.what ? ` — ${esc(c.what)}` : ""}</span><b>${money(c.amt)}</b>
            <button class="pill ${c.paid ? "" : "soon"}" data-costpaid="${tr.id}:${c.id}" style="border:0;cursor:pointer">${c.paid ? "paid ✓" : "not paid"}</button>
            <button class="x" data-tripdel="${tr.id}:costs:${c.id}" aria-label="Remove">✕</button></div>`).join("") +
          `<form class="inline-add cost-add" data-cost="${tr.id}"><select name="cat" aria-label="What kind">${COST_CATS.map(([k, l]) => `<option value="${k}">${l}</option>`).join("")}</select>
            <input name="what" placeholder="What (e.g. Westgate, 2 nights)" autocomplete="off"><input name="amt" type="number" step="0.01" min="0" inputmode="decimal" placeholder="$" required>
            <label class="paidbox"><input type="checkbox" name="paid" value="1"> paid</label><button class="btn sm">Add</button></form>`;
      } else if (tab === "onboard") {
        const spent = tripSpent(tr), bud = Number(tr.onboardBudget || 0), gr = gratEstimate(tr);
        const cats = {}; (tr.spends || []).forEach(x => { cats[x.cat] = (cats[x.cat] || 0) + Number(x.amt || 0); });
        body = `<div class="paygrid"><div class="fact">Budget<b>${bud ? money(bud) : "--"}</b></div><div class="fact">Spent<b>${money(spent)}</b></div>
            <div class="fact ${bud && spent > bud ? "" : "take"}">Left<b>${bud ? money(bud - spent) : "--"}</b></div></div>`;
        if (bud && spent > bud) body += `<div class="bstat over" style="margin-top:8px">⚠ ${money(spent - bud)} over your onboard budget.</div>`;
        if (isCruise(tr)) { const credit = Number(tr.credit || 0), bal = spent + gr - credit;
          body += `<div class="today-line" style="margin-top:8px">🧾 Ship account: <b>${money(bal)}</b> <span class="sub" style="display:inline">(spent ${money(spent)} + gratuities ${money(gr)}${credit ? ` − credit ${money(credit)}` : ""})</span></div>`;
          if (tr.end && daysUntil(tr.end) <= 1) body += `<label class="row"><input type="checkbox" class="tick" data-tverify="${tr.id}" ${tr.accountVerified ? "checked" : ""}><span class="grow">Final ship account checked — charges match</span></label>`;
          if (tr.end && daysUntil(tr.end) <= 1) body += `<button class="add-link" data-billcheck="1">🧾 Check my final bill</button>`; }   // v1.03
        if (pkgOf(tr) && pkgOf(tr).gratsPaid) body += `<div class="today-line" style="margin-top:8px">🧾 Gratuities: <b>$0</b> — ${esc(pkgOf(tr).name)} pays crew appreciation.</div>`;
        if (gr) body += `<div class="today-line" style="margin-top:8px">🧾 Automatic gratuities: about <b>${money(gr)}</b> (${Number(tr.travelers) || 1} × ${nights} nights × ~$${GRAT_PER_DAY}) — they hit your account even if you never log them.</div>`;
        const mx = Math.max(1, ...Object.values(cats));
        body += Object.entries(cats).sort((a, b) => b[1] - a[1]).map(([c, v]) => `<div class="catrow"><span>${esc(c)}</span>
            <span class="bar"><span style="left:0;width:${v / mx * 100}%"></span></span><b>${money(v)}</b></div>`).join("");
        body += (tr.spends || []).slice().sort((a, b) => b.day.localeCompare(a.day)).slice(0, 6).map(x => `<div class="row"><span class="time">${prettyDate(x.day)}</span>
            <span class="grow">${esc(x.cat)}${x.note ? `<span class="sub">${esc(x.note)}</span>` : ""}</span><b>${money(x.amt)}</b>
            <button class="x" data-tripdel="${tr.id}:spends:${x.id}" aria-label="Remove">✕</button></div>`).join("");
        body += `<button class="add-link" data-tripqa="tspend">＋ Log ${isCruise(tr) ? "onboard " : ""}spending</button>`;
      } else if (tab === "perks") {
        const P = pkgOf(tr); seedPerks(tr);
        body = P ? `<div class="today-line"><b>${esc(P.name)}</b> — what's already included:</div>` + P.includes.map(x => `<div class="today-line">✅ ${esc(x)}</div>`).join("") +
            `<div class="fine">From <a href="${PKG_SRC}" target="_blank" rel="noopener" style="color:var(--accent)">Princess's package terms</a> (sailings from Jan 14, 2026). Your own booking's terms win if they differ.</div>
             <form class="inline-add" data-drink="${tr.id}"><input name="price" type="number" step="0.01" min="0" inputmode="decimal" placeholder="Drink price $ — is it included?" required><button class="btn sm">Check</button></form>`
          : `<div class="empty">Custom package: add what your drinks / dining / Wi-Fi package includes below${linePkgs(tr.line).length ? ` — or pick your line's package on the trip (Edit → Package) to fill it in` : ""}.</div>`;
        if (isCruise(tr)) body += `<button class="add-link" data-pkgcalc="1">🧮 Is a package worth it for us? Buy or skip</button>`;   // v1.05
        body += `<div class="day-label" style="margin-top:12px">Use it before you lose it</div>` + ((tr.perks || []).length ? tr.perks.map(x => {
            const left = x.total ? x.total - x.used : null;
            return `<div class="row"><span class="grow">${esc(x.name)}<span class="sub">${x.unit === "$" ? `${money(x.used)} used${x.total ? ` of ${money(x.total)}` : " — set the amount ✏️"}` : `${x.used} of ${x.total} used`}</span></span>
              ${left !== null && left > 0 ? `<span class="pill soon">${x.unit === "$" ? money(left) : left} left</span>` : x.total ? `<span class="pill">all used ✓</span>` : ""}
              <button class="btn sm ghost" data-perk="${tr.id}:${x.id}:1">${x.unit === "$" ? "Use $" : "＋1"}</button>
              <button class="x" data-perkedit="${tr.id}:${x.id}" aria-label="Set amount">✏️</button>
              <button class="x" data-tripdel="${tr.id}:perks:${x.id}" aria-label="Remove">✕</button></div>`; }).join("")
          : `<div class="empty">Nothing tracked yet.</div>`) + `<button class="add-link" data-tripqa="tperk">＋ Add a perk (credit, meals, photos…)</button>`;
        if (isCruise(tr)) { const tip = lineTip(tr.line);
          body += `<div class="day-label" style="margin-top:12px">🪪 Your cruise card / wearable</div>
            <div class="today-line">• It's your cabin key, your ID on and off the ship, and how you pay for everything onboard.</div>
            <div class="today-line">• Every charge goes to your onboard account — check it in the cruise line's app or at guest services.</div>
            <div class="today-line">• Lost it? Guest services replaces it — report it straight away.</div>
            <div class="today-line">⚠️ Before you leave the cabin — and before every port — it goes in your pocket or on a lanyard.</div>` +
            (tip ? `<div class="today-line">💡 <b>${esc(tip.line)}:</b> ${esc(tip.text)}</div>` : ""); }
      } else if (tab === "lists") {
        ensureLists(tr); const keys = tripListKeys(tr);
        const lk = keys.includes(S.tripList) ? S.tripList : "packing", L = (tr.lists && tr.lists[lk]) || [];
        const done = L.filter(i => i.done).length;
        const LIST_IC = { packing: "🧳", docs: "📄", before: "✅", embark: "🚢", requests: "🛎️", home: "🏠", final: "🌙", after: "📸" };
        body = tileNav(keys.map(k => { const n = ((tr.lists || {})[k] || []);
            return { icon: LIST_IC[k] || "📋", label: TRIP_LISTS[k], small: `${n.filter(i => i.done).length}/${n.length}`, attrs: `data-triplist="${k}"`, on: k === lk }; }), 4, "compact") + `
          <div class="today-line sub">${done} of ${L.length} done</div>` +
          (lk === "packing" ? packExtrasHtml(tr) : "") +
          L.filter(i => lk !== "packing" || !S.bagView || S.bagView === "all" || bagOf(i) === S.bagView).map(i => `<div class="row ${i.done ? "done" : ""}"><input type="checkbox" class="tick" data-titem="${tr.id}:${lk}:${i.id}" ${i.done ? "checked" : ""} aria-label="Done">
            <span class="grow">${esc(i.text)}</span>${lk === "packing" ? `<button class="bagchip" data-bag="${tr.id}:${i.id}" aria-label="Bag: ${bagLabel(bagOf(i))} - tap to change">${bagLabel(bagOf(i))}</button>` : ""}<button class="x" data-tripdel="${tr.id}:lists.${lk}:${i.id}" aria-label="Remove">✕</button></div>`).join("") +
          `<form class="inline-add" data-tadd="${tr.id}:${lk}"><input name="text" placeholder="Add to ${TRIP_LISTS[lk]}…" required autocomplete="off"><button class="btn sm">Add</button></form>`;
      } else {
        body = `<div class="today-line sub">For first-timers — things most people wish someone had told them.</div>` +
          CRUISE_TIPS.map(t => `<div class="today-line">💡 ${esc(t)}</div>`).join("");
      }
      return pick + head + tileNav(tabs.map(k => { const [ic, l] = splitIcon(TL[k]); return { icon: ic, label: l, attrs: `data-triptab="${k}"`, on: k === tab }; }), 4, "triptabs") +   // v0.63 icon tiles
        body + `<div class="foot-actions" style="margin-top:6px"><button class="add-link" data-qa="trip">＋ Another trip</button></div>`;
    } },

  packages: { icon: "📦", title: "Packages", add: ["package", "Add a package"],
    meta: () => { const n = S.packages.filter(p => !p.delivered).length, r = openReturns().length;
      return [n ? `${n} on the way` : "", r ? `${r} to return` : ""].filter(Boolean).join(" · "); },
    body: () => {
      const recent = addDays(today(), -3);
      const list = S.packages.filter(p => !p.delivered || (p.deliveredDay || "") >= recent)
        .sort((a, b) => (a.delivered - b.delivered) || (a.eta || "9999").localeCompare(b.eta || "9999"));
      const rets = openReturns(), retHtml = (rets.length ? `<div class="rs-h">↩️ Returns</div>` + rets.map(r => { const n = daysUntil(r.by);
          return `<div class="row ${n < 0 ? "late" : ""}"><div class="grow"><b>${esc(r.what)}</b>${r.store ? ` <span class="sub" style="display:inline">· ${esc(r.store)}</span>` : ""}
            <span class="sub">${(RETURN_HOW[r.how] || RETURN_HOW.ship)[0]} by ${prettyDate(r.by)} — ${retWhen(r)}${r.amount ? ` · ${money(r.amount)} back` : ""}</span></div>
            ${n <= 3 ? `<span class="pill ${n <= 1 ? "soon" : ""}">${n < 0 ? "late" : inDays(n)}</span>` : ""}
            <button class="btn sm ghost" data-retdone="${r.id}">✓ Returned</button><button class="x" data-del="returns:${r.id}" aria-label="Remove">✕</button></div>`; }).join("") : "")
        + `<div class="foot-actions"><button class="add-link" data-qa="return">↩️ Add a return</button></div>`;
      if (!list.length) return (rets.length ? "" : `<div class="empty">Add a tracking number — Day Hub knows UPS, USPS, FedEx, Amazon and DHL and puts the arrival day on your schedule.</div>`) + retHtml;
      return list.map(p => { const n = p.eta ? daysUntil(p.eta) : null;
        return `<div class="row ${p.delivered ? "done" : ""}"><div class="grow">${esc(p.name)}<span class="sub">${(CARRIERS[p.carrier] || CARRIERS.other)[0]} · …${esc(cleanNum(p.num).slice(-6))}${p.delivered ? " · delivered" : p.eta ? ` · arrives ${prettyDate(p.eta)}` : " · no date yet"}</span></div>
          ${!p.delivered && n !== null && n <= 1 ? `<span class="pill ${n <= 0 ? "soon" : ""}">${n < 0 ? "late?" : inDays(n)}</span>` : ""}
          <a class="btn sm ghost" href="${trackUrl(p)}" target="_blank" rel="noopener">Track</a>
          ${p.delivered ? "" : `<button class="btn sm ghost" data-pkgdone="${p.id}" aria-label="Delivered">✓</button>`}
          <button class="x" data-del="packages:${p.id}" aria-label="Remove">✕</button></div>`; }).join("") +
        `<div class="fine" style="margin-top:6px">Track opens the carrier's page. Live status updates are planned for Day Hub Pro.</div>` + retHtml;
    } },

  people: { icon: "🎂", title: "People & dates", add: ["person", "Add a birthday or date"],
    meta: () => { const u = upcomingPeople(14); return u.length ? `${u.length} coming up` : ""; },
    body: () => {
      const found = (S.gcal.dates || []);
      const foundBox = found.length ? `<div class="found-box"><b>📅 Found ${found.length} date${found.length === 1 ? "" : "s"} in your Google Calendar</b>
          ${found.slice(0, 30).map(b => `<div class="row"><span class="grow">${PKIND[b.kind]} ${esc(b.name)} <span class="sub">${prettyDate(personNext(b))}</span></span>
            <button class="btn sm ghost" data-fadd="${esc(b.key)}">＋ Add</button></div>`).join("")}
          <div class="foot-actions"><button class="btn sm" data-fadd="__all">Add all ${found.length}</button><button class="add-link" data-fno="1">Not these</button></div></div>` : "";
      if (!S.people.length) return foundBox + `<div class="empty">Birthdays, anniversaries, important dates — Day Hub reminds you in time to get a gift.${S.gcal.connected ? "" : " Connect Google Calendar in ⚙ and Day Hub finds the ones already in your calendar."}</div>`;
      const row = ({ p, day }) => { const n = daysUntil(day);
        return `<div class="row pp ${n === 0 ? "today" : ""}"><span class="grow"><b>${PKIND[p.kind] || "⭐"} ${esc(personLabel(p, day))}</b>
            <span class="sub">${n === 0 ? "🎉 TODAY — call, text or card?" : `${inDays(n)} · ${prettyDate(day)}`}</span>
            ${giftDue(p, day) && n > 0 ? `<span class="sub gift">🎁 Gift?${p.ideas ? ` Ideas: ${esc(p.ideas)}` : ""}</span>` : ""}</span>
          ${giftDue(p, day) ? `<button class="btn sm ghost" data-pgot="${p.id}">✓ Got it</button>` : ""}
          <button class="x" data-pedit="${p.id}" aria-label="Edit">✏️</button></div>`; };
      const soon = upcomingPeople(60), later = S.people.map(p => ({ p, day: personNext(p) })).filter(x => daysUntil(x.day) > 60).sort((a, b) => a.day.localeCompare(b.day));
      return foundBox + (soon.length ? soon.map(row).join("") : `<div class="empty">Nothing in the next 60 days.</div>`) +
        (later.length ? `<details class="steps"><summary>All dates (${S.people.length})</summary>${later.map(row).join("")}</details>` : "");
    } },

  payday: { icon: "💵", title: "Payday",
    meta: () => { const nx = payNext(); return nx ? (daysUntil(nx) === 0 ? "today!" : inDays(daysUntil(nx))) : ""; }, body: () => paydayCard() },
  future: { icon: "🔮", title: "Future me", add: ["future", "Note to future me"],
    meta: () => S.future.length ? `${S.future.length} saved` : "",
    body: () => S.future.length ? [...S.future].reverse().map(f => `<div class="row"><span class="grow">“${esc(f.text)}”
        <span class="sub">${prettyDate(f.created.slice(0, 10))} · comes back ${f.day ? `on ${prettyDate(f.day)}` : ""}${f.day && f.words.length ? " or " : ""}${f.words.length ? `with: ${esc(f.words.join(", "))}` : ""}${f.seen ? ` · came back ${f.seen}×` : ""}</span></span>
        <button class="x" data-futedit="${f.id}" aria-label="Edit">✏️</button></div>`).join("")
      : `<div class="empty">Save the WHY behind a decision — "Next time we travel, don't book a 6 AM flight" — and Day Hub brings it back the next time it matters.</div>` },
  errands: { icon: "🛍️", title: "Errand run",
    meta: () => { const n = errandStops().length; return n ? `${n} stop${n === 1 ? "" : "s"}` : ""; }, body: () => errandsCard() },
  top3: { icon: "🎯", title: "Top 3 today",
    meta: () => { const T = S.top3.day === today() ? S.top3.items : []; return T.length ? `${T.filter(x => x.done).length}/${T.length}` : ""; }, body: () => top3Card() },
  routines: { icon: "🔁", title: "Routines", add: ["routine", "Make your own routine"],
    meta: () => { const r = routineNow(); return r ? `${esc(r.name.replace(/^\S+\s/, ""))} now` : ""; }, body: () => routinesCard() },
  home: { icon: "🏠", title: "Home", add: ["upkeep", "Add something"],
    meta: () => { const n = upkeepDue("home", 7).length; return n ? `${n} coming up` : ""; }, body: () => upkeepCard("home") },
  auto: { icon: "🚗", title: "Car", add: ["upkeep", "Add something"],
    meta: () => { const n = upkeepDue("auto", 14).length; return n ? `${n} coming up` : ""; }, body: () => upkeepCard("auto") },

  leave: { icon: "🚪", title: "Don't forget",
    meta: () => { const n = leaveLeft(); return n ? `${n} left` : "all set ✓"; },
    body: () => {
      const d = leaveDone(), all = leaveAll(), left = all.filter(x => !d.includes(x.id)).length;
      return (left ? "" : `<div class="today-line">✅ All set — have a good day!</div>`) +
        all.map(x => `<label class="row leave ${d.includes(x.id) ? "done" : ""}"><input type="checkbox" class="tick" data-leavechk="${x.id}" ${d.includes(x.id) ? "checked" : ""}>
          <span class="grow">${esc(x.text)}${x.extra ? ` <span class="sub">today · ${esc(x.why)}</span>` : ""}</span>
          ${x.extra ? "" : `<button type="button" class="x" data-leavedel="${x.id}" aria-label="Remove">✕</button>`}</label>`).join("") +
        `<form class="inline-add" data-addleave="1"><input name="text" placeholder="Add to your list (gym bag, sunglasses…)" required autocomplete="off"><button class="btn sm">Add</button></form>
        ${d.length ? `<div class="foot-actions"><button class="add-link" data-leavereset="1">Uncheck all</button></div>` : ""}`;
    } },

  countdowns: { icon: "⏳", title: "Countdowns", add: ["countdown", "Add a countdown"],
    body: () => {
      const cs = liveCountdowns();
      return cs.length ? `<div class="tiles">${cs.map(c => { const n = daysUntil(c.date);
        return `<div class="tile"><button class="x" data-del="countdowns:${c.id}" aria-label="Remove">✕</button>
          <div class="n">${n === 0 ? "🎉" : n}</div><div class="u">${n === 0 ? "today!" : n === 1 ? "day to go" : "days to go"}</div>
          <div class="tt">${esc(c.title)}</div><div class="dd">${prettyDate(c.date)}</div></div>`; }).join("")}</div>`
        : `<div class="empty">Vacation, birthday, payday — add something to look forward to.</div>`;
    } },

  lists: { icon: "🛒", title: "Lists",
    meta: () => { const n = S.lists.reduce((s, l) => s + l.items.filter(i => !i.done).length, 0); return n ? `${n} to get` : ""; },
    body: () => {
      const L = S.lists.find(l => l.id === S.listSel) || S.lists[0];
      const tabs = S.lists.map(l => `<button class="tab ${L && l.id === L.id ? "on" : ""}" data-listsel="${l.id}">${esc(l.name)}<small>${l.items.filter(i => !i.done).length || ""}</small></button>`).join("") +
        `<button class="tab" data-qa="list">＋ New</button>`;
      if (!L) return `<div class="tabs">${tabs}</div>`;
      const items = [...L.items].sort((a, b) => a.done - b.done);
      return `<div class="tabs">${tabs}</div>` +
        (items.length ? items.map(i => `<div class="row ${i.done ? "done" : ""}"><input type="checkbox" class="tick" data-item="${L.id}:${i.id}" ${i.done ? "checked" : ""} aria-label="Got it">
          <span class="grow">${esc(i.text)}</span><button class="x" data-delitem="${L.id}:${i.id}" aria-label="Remove">✕</button></div>`).join("")
          : `<div class="empty">Empty — add the first item below.</div>`) +
        `<form class="inline-add" data-additem="${L.id}"><input name="text" placeholder="Add to ${esc(L.name)}…" required autocomplete="off">
          <button class="btn sm">Add</button></form>
        <div class="foot-actions">${items.some(i => i.done) ? `<button class="add-link" data-clear="${L.id}">Clear checked</button>` : ""}
          ${S.lists.length > 1 ? `<button class="add-link" style="color:var(--dim)" data-dellist="${L.id}">Delete this list</button>` : ""}</div>`;
    } },

  route: { icon: "🛣️", title: "Route weather",
    body: () => {
      const leg = (k, lbl) => {
        const w = WXDATA && WXDATA[k];
        if (!S.route[k]) return `<div class="leg"><span>${lbl}</span><span class="empty">not set</span></div>`;
        if (!w) return `<div class="leg"><span>${lbl}: ${esc(S.route[k])}</span><span class="empty">…</span></div>`;
        const [icon, txt] = wmo(w.day.code);
        return `<div class="leg"><span>${lbl}: ${esc(w.label)}</span><b>${icon} ${Math.round(w.day.hi)}°/${Math.round(w.day.lo)}° · rain ${w.day.rain ?? 0}%</b></div>
                <div class="empty">${txt}${(w.day.rain ?? 0) >= 50 ? " — <b style='color:var(--red)'>plan for wet roads</b>" : ""}</div>`;
      };
      return leg("from", "From") + leg("to", "To") +
        `<form class="inline-add" data-route="1"><input name="from" placeholder="From: city or ZIP" value="${esc(S.route.from)}">
         <input name="to" placeholder="To: city or ZIP" value="${esc(S.route.to)}"><button class="btn sm">Set</button></form>`;
    } },

  loads: { icon: "🚚", title: "Today's loads", add: ["loads", "Add a load"], body: () => listCard("loads", "load") },
  jobs:  { icon: "🔧", title: "Today's jobs", add: ["jobs", "Add a job"], body: () => listCard("jobs", "job") },

  nextup: { icon: "⏭️", title: "Next up",
    body: () => {
      const nx = nextPlan();
      if (!nx) return `<div class="empty">Nothing coming up this week.</div>`;
      if (nx.t && nx.when === hm(nx.t)) {
        const [h, m] = nx.t.split(":").map(Number); const at = new Date(); at.setHours(h, m, 0, 0);
        const mins = Math.max(0, Math.round((at - new Date()) / 60000));
        return `<div class="leg"><span>${nx.icon} ${esc(nx.title)}</span><b>in ${mins >= 60 ? Math.floor(mins / 60) + "h " : ""}${mins % 60}m</b></div>`;
      }
      return `<div class="leg"><span>${nx.icon} ${esc(nx.title)}</span><b>${esc(nx.when)}</b></div>`;
    } },

  games: { icon: "🏟️", title: "Today's games", body: () => `<div class="empty">Today's games and start times arrive in a later version.</div>` },
};

function listCard(key, word) {
  const rows = S[key].filter(x => x.day === today()).sort((a, b) => a.time.localeCompare(b.time));
  return rows.length ? rows.map(x => `<div class="row ${x.done ? "done" : ""}"><input type="checkbox" class="tick" data-tickl="${key}:${x.id}" ${x.done ? "checked" : ""} aria-label="Done">
    <span class="time">${hm(x.time)}</span><span class="grow">${esc(x.title)}</span>
    <button class="x" data-del="${key}:${x.id}" aria-label="Remove">✕</button></div>`).join("")
    : `<div class="empty">No ${word}s today.</div>`;
}

function welcomeHtml() {
  // v0.45: Cruise Hub greets as itself and has no profession packs.
  return `<section class="card welcome"><h2>${TRAVEL ? `Welcome to ${APP_NAME} ${MODE === "cruise" ? "🚢" : "✈️"}` : "Welcome to Day Hub 👋"}</h2>
    <p>${TRAVEL ? `Two quick things, then plan your ${TW}.` : "Two quick things and your day is set."}</p>
    <form class="qa-form" data-setup="1"><input name="name" placeholder="Your first name" autocomplete="given-name">
      <input name="city" placeholder="${TRAVEL ? "Your home city or ZIP (e.g. 72032)" : "City or ZIP for weather (e.g. 72032)"}" required>
      ${TRAVEL ? `<input type="hidden" name="pack" value="general">`
        : `<select name="pack">${Object.entries(PACKS).map(([k, p]) => `<option value="${k}">${p.label}</option>`).join("")}</select>`}
      <button class="btn">Let's go</button></form></section>`;
}

// v0.39 (Scott 10/3 "do 1 2"): a card with nothing in it is ONE line on home -
// "＋ Add a bill" - not a box of explainer text. The row does what the card's own
// add button does ("open" = show the full card, for cards whose add IS the card:
// a form or tap-to-start chips); ⓘ shows the full card, explainer included.
// MINI_OPEN lives for this visit only (never saved). A card with content, or one
// opened, draws exactly as before.
// v0.46 HUB FAMILY: the other hub's upcoming trips sit under this hub's own in
// the Trips card - read only, with a button that opens the other app.
const famUpcoming = () => famTrips().filter(tr => tr.end ? tr.end >= addDays(today(), -7) : true)
  .sort((a, b) => (a.start || "9999").localeCompare(b.start || "9999"));
function famTripRows() {
  const f = famUpcoming(); if (!f.length) return "";
  return `<div class="fam-trips" style="margin-top:12px"><span class="sub"><b>${SIB.icon} From ${SIB.name}</b></span>` + f.map(tr => {
    const n = tr.start ? daysUntil(tr.start) : null;
    const when = n === null ? "no dates yet" : n > 0 ? `in ${n} day${n === 1 ? "" : "s"}` : daysUntil(tr.end || tr.start) >= 0 ? "happening now" : "just back";
    return `<div class="row"><div class="grow">${isCruise(tr) ? "🚢" : "✈️"} <b>${esc(tr.name || "Trip")}</b>
      <span class="sub">${when}${tr.start ? ` · ${prettyDate(tr.start)}` : ""} · planned in ${SIB.name}</span></div>
      <a class="btn sm ghost" href="${esc(SIB.url)}" data-famopen="1">Open ${SIB.name}</a></div>`; }).join("") + `</div>`;
}
{ const ownBody = CARDS.trips.body, ownMeta = CARDS.trips.meta;
  CARDS.trips.body = () => { const fam = famTripRows();
    return !curTrip() && fam ? fam + `<button class="btn sm" data-qa="trip" style="margin-top:10px">🚢 Plan a trip</button>` : ownBody() + fam; };
  CARDS.trips.meta = () => ownMeta() || (famUpcoming().length ? `in ${SIB.name}` : ""); }

// ------------------------------------------------------------ cruise countdown
// v0.50 (Scott 10/4 "build the countdown next", from the Hub Experience plan:
// "42 DAYS until Caribbean Princess · 87% READY", tap = the checklist, a
// celebration at 100%). Cruise Hub's hero, over the ocean scene. Before sailing:
// days to go; sail day: SAIL DAY; on board: DAY n of N (+ today's port and
// all-aboard); after the trip it steps aside for the normal line.
const CD_RM = () => !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
let CD_COUNTED = false;
function cruiseCountdown(tr) {
  if (!tr || !tr.start) return "";
  { const g = guardFor(tr); if (g) return guardHtml(g); }                 // v0.52 port day: Return Guard takes the hero
  { const st = typeof goHomeState === "function" && goHomeState(tr); if (st) return goHomeHtml(tr, st); }   // v0.56 final night / last morning
  const sd = daysUntil(tr.start), end = tr.end || tr.start;
  if (daysUntil(end) < 0) return "";
  const R = readiness(tr), who = esc(tr.ship || tr.name);
  let big, lab, line;
  if (sd > 0) { big = sd; lab = sd === 1 ? "DAY" : "DAYS"; line = `until ${who}`; }
  else if (sd === 0) { const c = isCruise(tr); big = c ? "⚓" : "✈️"; lab = c ? "SAIL DAY" : "TRAVEL DAY"; line = c ? `Welcome aboard ${who}` : `${who} starts today`; }
  else { const n = -sd + 1, all = Math.round((parseDay(end) - parseDay(tr.start)) / 86400000) + 1, pt = portOn(tr, today());
    big = n; lab = `DAY ${n} OF ${all}`; line = pt ? `⚓ ${esc(pt.name)}${pt.allAboard ? ` · all aboard ${hm(pt.allAboard)}` : ""}` : today() === end ? "Getting home today" : isCruise(tr) ? `🌊 At sea on ${who}` : `📍 Enjoy ${who}`; }
  const pctTxt = R.pct >= 100 ? "100% READY 🎉" : `${R.pct}% READY`;
  return `<button class="cd" data-cd="open" aria-label="${esc(String(big))} ${esc(lab)} ${esc(line.replace(/<[^>]+>/g, ""))}. ${R.pct}% ready. Tap for the checklist.">
    <span class="cd-n" ${typeof big === "number" && sd > 0 ? `data-count="${big}"` : ""}>${big}</span>
    <span class="cd-txt"><span class="cd-l">${lab}</span><span class="cd-ship">${line}</span>
      <span class="cd-bar"><i style="width:${R.pct}%"></i></span><span class="cd-pct ${R.pct >= 100 ? "done" : ""}">${pctTxt}${R.next && R.pct < 100 ? ` · next: ${esc(R.next.action.replace(/\s*\([^)]*\)/g, "").replace(/^\w/, c => c.toLowerCase()))}` : ""}</span></span></button>`;
}
// v0.52 Return Guard - the hero on a port day (rules in app.js guardFor).
function guardHtml(g) {
  const pt = g.pt, ship = Number(pt.shipOffset) ? ` <span class="rg-ship">(${hm(pt.allAboard)} ship time)</span>` : "";
  const line = g.level === "missed" ? "If you're not on the ship, call the port agent / cruise line now"
    : g.level === "critical" ? `Head back NOW — all aboard in ${minsText(g.toAA)}`
    : `Head back by <b>${hm(guardBy(pt))}</b> · ${minsText(g.toBy)} to go`;
  return `<button class="rg rg-${g.level}" data-rg="open" aria-label="Return Guard. All aboard ${hm(aaLocal(pt))}. ${GUARD_LABEL[g.level]}">
    <span class="rg-top">🚢 RETURN GUARD · ${esc(pt.name)}</span>
    <span class="rg-main"><span class="rg-l">ALL ABOARD</span><span class="rg-t">${hm(aaLocal(pt))}</span>${ship}</span>
    <span class="rg-line">${line}</span><span class="rg-pill">${GUARD_LABEL[g.level]}</span></button>`;
}
// The always-there BACK TO SHIP bar while a guard is running (Cruise Hub).
function paintGuardBar() {
  const tr = TRAVEL ? curTrip() : null, g = tr && guardFor(tr);
  let el = document.getElementById("rgBar");
  if (!g) { if (el) el.remove(); return; }
  if (!el) { el = document.createElement("button"); el.id = "rgBar"; el.dataset.rg = "open"; document.body.appendChild(el); }
  el.className = `rg-bar rg-${g.level}`;
  el.innerHTML = g.level === "missed" || g.level === "critical" ? `🚢 BACK TO SHIP — NOW` : `🚢 BACK TO SHIP · by ${hm(guardBy(g.pt))} · ${minsText(g.toBy)}`;
}
function showGuard() {
  const tr = curTrip(), g = tr && guardFor(tr); if (!g) return;
  const pt = g.pt;
  let el = document.getElementById("rgSheet");
  if (!el) { el = document.createElement("div"); el.id = "rgSheet"; el.className = "sheet"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "Return Guard"); document.body.appendChild(el); }
  el.innerHTML = `<div class="sheet-body"><div class="grab"></div>
    <div class="sheet-head"><h2>🚢 Return Guard · ${esc(pt.name)}</h2><button class="icon-btn" data-rgclose="1" aria-label="Close">✕</button></div>
    <div class="rg-pill big rg-${g.level}">${GUARD_LABEL[g.level]}</div>
    <div class="row"><span class="grow">All aboard</span><b>${hm(aaLocal(pt))}${Number(pt.shipOffset) ? ` <span class="sub" style="display:inline">phone time · ${hm(pt.allAboard)} ship time</span>` : ""}</b></div>
    <div class="row"><span class="grow">Safety margin</span><span class="seg">${GUARD_MARGINS.map(m => `<button class="tab ${m === g.margin ? "on" : ""}" data-rgmargin="${m}">${m} min</button>`).join("")}</span></div>
    ${isTenderPort(pt) ? `<div class="wx-alert">🚤 Tender port — small boats take you back to the ship and the lines get long late in the day, so the trip back starts at 45 minutes.</div>` : ""}
    <label class="row"><span class="grow">Your trip back to the ship (minutes)</span><input type="number" min="0" max="240" inputmode="numeric" data-rgback="${pt.id}" value="${g.back}" style="width:84px"></label>
    <div class="row"><span class="grow"><b>Head back by</b></span><b style="font-size:20px">${hm(guardBy(pt))}</b></div>
    <p class="fine">${hm(aaLocal(pt))} all aboard − ${g.margin} min safety margin − ${g.back} min trip back = <b>${hm(guardBy(pt))}</b>. You'll get a heads-up 30 minutes before, and again when it's time to leave.</p>
    ${Number(pt.shipOffset) ? `<p class="fine">⚠️ The ship's clock and the local clock are different today. Your phone shows local time, and every time here is converted to it. The ship's announcements always win.</p>` : ""}
    <p class="fine">These are estimates. The ship's all-aboard time and announcements always win, and the ship will not wait.</p>
    <button class="btn" data-rgboard="${pt.id}" style="width:100%;margin-top:8px">✅ I'm back on board</button></div>`;
  el.classList.remove("hidden");
}

// After each hero paint: count the number up the first time this visit, and
// celebrate the first time a trip reaches 100% (once per trip, remembered).
function afterHero(hero) {
  paintGuardBar();
  const n = hero.querySelector(".cd-n[data-count]");
  if (n && !CD_COUNTED) { CD_COUNTED = true;
    const to = Number(n.dataset.count);
    if (!CD_RM() && to > 1) { const t0 = performance.now(), dur = 900;
      const step = t => { const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
        if (n.isConnected) n.textContent = Math.round(to * e); if (k < 1) requestAnimationFrame(step); };
      n.textContent = "0"; requestAnimationFrame(step); } }
  const tr = TRAVEL ? curTrip() : null;
  if (tr && hero.querySelector(".cd") && !tr.ready100 && readiness(tr).pct >= 100) {
    tr.ready100 = true; save(); celebrate(`${tr.ship || tr.name}: 100% ready — you're all set! 🎉`); }
}
function celebrate(msg) {
  buzz(); toast(msg);
  if (CD_RM()) return;
  const box = document.createElement("div"); box.className = "confetti"; box.setAttribute("aria-hidden", "true");
  const C = ["#5eead4", "#fcd34d", "#fb7185", "#818cf8", "#4ade80", "#fb923c"];
  box.innerHTML = Array.from({ length: 48 }, (_, i) => `<i style="left:${Math.random() * 100}%;background:${C[i % C.length]};animation-delay:${(Math.random() * .5).toFixed(2)}s;animation-duration:${(1.8 + Math.random() * 1.2).toFixed(2)}s;transform:rotate(${Math.round(Math.random() * 360)}deg)"></i>`).join("");
  document.body.appendChild(box); setTimeout(() => box.remove(), 3500);
}
// Tap the countdown: the readiness checklist in a sheet.
function showReady() {
  const tr = curTrip(); if (!tr) return;
  let el = document.getElementById("readySheet");
  if (!el) { el = document.createElement("div"); el.id = "readySheet"; el.className = "sheet"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "Cruise checklist"); document.body.appendChild(el); }
  const R = readiness(tr), sd = tr.start ? daysUntil(tr.start) : null;
  el.innerHTML = `<div class="sheet-body"><div class="grab"></div>
    <div class="sheet-head"><h2>${esc(tr.ship || tr.name)} · ${R.pct}% ready</h2><button class="icon-btn" data-readyclose="1" aria-label="Close">✕</button></div>
    <div class="cd-bar big"><i style="width:${R.pct}%"></i></div>
    <p class="fine" style="margin-top:6px">${sd > 0 ? `${sd} day${sd === 1 ? "" : "s"} to go · ` : ""}Stage: ${esc(R.phase)}</p>
    ${R.next ? `<div class="today-line">➡️ <b>Next:</b> ${esc(R.next.action)}</div>` : `<div class="today-line">✅ Nothing needs you right now.</div>`}
    ${R.items.map(i => `<div class="row ready-row"><span class="grow">${i.score >= 1 ? "✅" : i.now ? "⚠️" : "⏳"} ${esc(i.label)}</span>
      <span class="sub">${i.score >= 1 ? "done" : i.score > 0 ? Math.round(i.score * 100) + "%" : i.now ? "now" : "later"}</span></div>`).join("")}
    <p class="fine" style="margin-top:6px">⚠️ = matters now · ⏳ = later — Cruise Hub brings it up when it's time.</p>
    <button class="btn" data-readygo="1" style="width:100%;margin-top:10px">Open my trip</button></div>`;
  el.classList.remove("hidden");
}

// ------------------------------------------------------------ hub family card
// v0.50 (Scott 10/4: "we can also advertise the hub family" / "in app"). OUR
// apps only, quiet: one card at the END of the home screen (hide or move it
// like any card) + the same list in ⚙ → Hub family. No pop-ups, nothing from
// anyone else - "No ads. Ever." stays true. A new hub = one line in HUBS.
const HUBS = [
  { id: "dayhub", name: "Day Hub", icon: "☀️", what: "Your whole day on one screen — schedule, weather, to-dos, bills.", url: BASE_URL },
  { id: "cruisehub", name: "Cruise Hub", icon: "🚢", what: "Countdown, payments, port days and all-aboard alarms.", url: CRUISE_URL },
  { id: "triphub", name: "Trip Hub", icon: "✈️", what: "Flights, hotels and road trips.", url: TRIP_URL, soon: true },   // soon: until Trip Hub V1 is ready to show
];
function hubRows() {
  const sd = sibData();
  return HUBS.filter(h => h.id !== APP_ID).map(h => `<div class="row"><span class="ci">${h.icon}</span><div class="grow"><b>${h.name}</b>${h.soon ? ` <span class="tag">COMING SOON</span>` : ""}
      ${h.id === SIB.id && sd && sd.src === "phone" ? ` <span class="tag">ON THIS PHONE ✓</span>` : ""}<span class="sub">${h.what}</span></div>
      ${h.soon ? "" : `<a class="btn sm ghost" href="${esc(h.url)}" data-famopen="1">Open</a>`}</div>`).join("");
}
CARDS.family = { icon: "🌐", title: "Hub family",
  body: () => hubRows() + `<p class="fine" style="margin-top:6px">Made by Marvel Corp. They work together — one Pro unlocks the family. No ads, ever.</p>` };

// v0.51 Cruise Hub's second weather: where the cruise is (app.js cruiseWxDays).
function cruiseWxBlock() {
  if (!TRAVEL) return "";
  const tr = curTrip(); if (!tr || !tr.start || daysUntil(tr.end || tr.start) < 0) return "";
  ensurePortWx(tr);
  const sd = daysUntil(tr.start), hn = hurricaneNote(tr);
  const days = cruiseWxDays(tr);
  const cr = isCruise(tr);                                                    // v0.97: a regular trip = where you're going
  const head = cr ? `<div class="wx-where">🚢 Where your cruise is${tr.ship ? ` — ${esc(tr.ship)}` : ""}</div>` : `<div class="wx-where">✈️ Where you're going${tr.port ? ` — ${esc(placeName(tr.port))}` : ""}</div>`;
  if (sd > 15) return `<div class="cruise-wx">${head}<div class="today-line">${cr ? (tr.port ? `⚓ ${esc(tr.port)} on sail day` : "⚓ Sail day") : (tr.port ? `📍 ${esc(tr.port)}` : "📍 Your trip")}: the forecast shows up 16 days before you ${cr ? "sail" : "go"} — ${sd - 15} day${sd - 15 === 1 ? "" : "s"} from now.</div>
    ${!tr.port ? `<div class="fine">${cr ? "Add your departure port (Edit trip) and your port days (🗺️ Ports) to see their weather." : "Add where you're going (Edit trip) to see its weather."}</div>` : ""}${hn ? `<div class="wx-alert">${hn}</div>` : ""}</div>`;
  const rows = days.map(x => { const w = PORTWX[`${x.name}|${x.day}`], when = x.day === today() ? "Today" : x.day === addDays(today(), 1) ? "Tomorrow" : `${dayName(x.day)} ${prettyDate(x.day)}`;
    const tag = x.kind === "sail" ? (cr ? "boarding" : "arrive") : "port day";
    const wx = !w || w.loading ? `<span class="sub">loading…</span>` : w.none ? `<span class="sub">no forecast for this place</span>`
      : `<span class="sub">${wmo(w.code)[0]} ${Math.round(w.hi)}°/${Math.round(w.lo)}°${w.rain >= 20 ? ` · rain ${w.rain}%` : ""}${w.uv != null ? ` · UV ${Math.round(w.uv)}` : ""}${w.gust != null ? ` · gusts ${Math.round(w.gust)} mph` : ""}</span>`;
    const al = cruiseWxAlerts(w, x.kind);
    return `<div class="cwx-day"><div><b>${when} · ${esc(x.name)}</b> <span class="tag">${tag}</span>${x.pt && x.pt.allAboard ? ` <span class="tag">all aboard ${hm(x.pt.allAboard)}</span>` : ""}</div>${wx}
      ${al.length ? `<div class="wx-alerts">${al.map(a => `<div class="wx-alert">${a.icon} ${esc(a.text)}</div>`).join("")}</div>` : x.kind && w && !w.loading && !w.none ? `<div class="sub">✅ Nothing to watch for.</div>` : ""}</div>`; }).join("");
  const none = !days.length ? `<div class="today-line">${!cr ? `📍 ${sd > 0 ? "Add where you're going (Edit trip) to see its weather." : "Enjoy the trip!"}` : `🌊 ${sd > 0 ? "Add your departure port and port days to see their weather." : "At sea — the next port day shows here once it's within 16 days."}`}</div>` : "";
  return `<div class="cruise-wx">${head}${rows}${none}${hn ? `<div class="wx-alert">${hn}</div>` : ""}</div>`;
}
// The first cruise-area alert for today or tomorrow, for a hero chip.
function cruiseWxChip() {
  const tr = TRAVEL ? curTrip() : null; if (!tr) return "";
  for (const x of cruiseWxDays(tr)) {
    if (x.day > addDays(today(), 1)) break;
    const a = cruiseWxAlerts(PORTWX[`${x.name}|${x.day}`], x.kind)[0];
    if (a) return `<button class="chip warn" data-cwx="1">${a.icon} ${esc(placeName(x.name))} ${x.day === today() ? "today" : "tomorrow"}: ${esc(a.text.split(" — ")[0])}</button>`;
  }
  return "";
}

// v0.55 packing extras: suggestions from the trip's forecast + excursions, and a bag filter.
function packExtrasHtml(tr) {
  const sug = packSuggest(tr), L = (tr.lists && tr.lists.packing) || [], view = S.bagView || "all";
  const count = k => L.filter(i => bagOf(i) === k).length;
  return (sug.length ? `<div class="sugbox"><div class="day-label">✨ Suggested for your trip</div>` + sug.map(x => `<div class="row"><span class="grow">${esc(x.text)}<span class="sub">${esc(x.why)} · ${bagLabel(x.bag)}</span></span>
      <button class="btn sm" data-sugadd="${tr.id}:${esc(x.key)}">＋ Add</button><button class="x" data-sugno="${tr.id}:${esc(x.key)}" aria-label="Not needed">✕</button></div>`).join("") + `</div>` : "") +
    `<div class="tabs bagtabs">${[["all", "All"], ...BAGS].map(([k, l]) => `<button class="tab ${k === view ? "on" : ""}" data-bagview="${k}">${l}${k !== "all" ? `<small>${count(k)}</small>` : ""}</button>`).join("")}</div>`;
}

const MINI = {
  trips:      [() => !TRAVEL && !curTrip() && !famUpcoming().length, 'data-qa="trip"', "Plan a trip"],
  top3:       [() => !TOP3_BUSY && !(S.top3.day === today() && S.top3.items.length), 'data-top3="pick"', "Pick my top 3"],
  payday:     [() => !S.payday.freq, "open", "Set up payday"],
  budget:     [() => !budget().income, 'data-qa="pay"', "Set income"],
  todos:      [() => !S.todos.some(todoShown), 'data-qa="todo"', "Add a to-do"],
  notes:      [() => !S.notes.length, "open", "Jot down a note"],
  future:     [() => !S.future.length, 'data-qa="future"', "Note to future me"],
  packages:   [() => !openReturns().length && !S.packages.some(p => !p.delivered || (p.deliveredDay || "") >= addDays(today(), -3)), 'data-qa="package"', "Add a package"],
  bills:      [() => !upcomingBills().length, 'data-qa="bill"', "Add a bill"],
  people:     [() => !S.people.length && !(S.gcal.dates || []).length, 'data-qa="person"', "Add a birthday or date"],
  countdowns: [() => !liveCountdowns().length, 'data-qa="countdown"', "Add a countdown"],
  lists:      [() => !S.lists.some(l => l.items.length), "open", "Add to a list"],
  routines:   [() => !S.routines.length, "open", "Add a routine"],
  home:       [() => !S.upkeep.some(x => x.area === "home"), "open", "Add home upkeep"],
  auto:       [() => !S.upkeep.some(x => x.area === "auto"), "open", "Add car upkeep"],
  loads:      [() => !S.loads.some(x => x.day === today()), 'data-qa="loads"', "Add a load"],
  jobs:       [() => !S.jobs.some(x => x.day === today()), 'data-qa="jobs"', "Add a job"],
};
const MINI_OPEN = new Set();
const isMini = k => MINI[k] && !MINI_OPEN.has(k) && MINI[k][0]();
function miniHtml(k) {
  const c = CARDS[k], [, act, label] = MINI[k];
  return `<section class="card mini" data-card="${k}"><button class="mini-add" ${act === "open" ? `data-miniopen="${k}"` : act}>
    <span class="ci">${c.icon}</span><span class="grow">＋ ${label}</span></button>
    <button class="mini-info" data-miniopen="${k}" aria-label="About ${esc(c.title)}">ⓘ</button></section>`;
}

function render() {
  const t = today();
  if (!VIEW || (VIEW < addDays(t, -60))) VIEW = t;
  // Left open past midnight: a schedule that was on "today" moves to the new
  // today instead of reading "Yesterday" until the app is reopened.
  if (LAST_DAY && LAST_DAY !== t && VIEW === LAST_DAY) VIEW = t;
  LAST_DAY = t;
  paintHero();
  const hr = new Date().getHours();
  let order = cardOrder().filter(k => !S.hidden.includes(k) && !(k === "tomorrow" && hr < 15) && !(k === "reset" && hr < 18) && !(k === "errands" && !errandStops().length) && !(k === "inbox" && !S.mail.on && !S.mail.found.length));
  // Smart jumps only until the user arranges the screen (Scott 10/2: "order the
  // sections how anyone would like") - after that their order always wins.
  if (!S.order && hr >= 17 && order.includes("tomorrow")) order = ["tomorrow", ...order.filter(k => k !== "tomorrow")];
  if (!S.order && hr >= 18 && order.includes("reset")) order = ["reset", ...order.filter(k => k !== "reset")];
  if (!S.order && S.mail.found.length && order.includes("inbox")) order = ["inbox", ...order.filter(k => k !== "inbox")];   // waiting on you = on top
  const cardHtml = k => {
    const c = CARDS[k]; const col = S.collapsed.includes(k) && !MINI_OPEN.has(k);
    const tag = PACKS[S.pack].cards.includes(k) ? ` <span class="tag">${PACKS[S.pack].label}</span>` : "";
    if (!can(k)) return `<section class="card" data-card="${k}"><h3><span class="ci">${c.icon}</span>${c.title} <span class="tag">PRO</span></h3>
      <div class="body"><div class="empty">Part of ${proName()}. No ads, ever — Pro just does more.</div></div></section>`;
    if (isMini(k)) return miniHtml(k);
    return `<section class="card ${col ? "collapsed" : ""}" data-card="${k}">
      <h3 data-collapse="${k}"><span class="ci">${c.icon}</span>${c.title}${tag}<span class="meta">${c.meta ? c.meta() : ""}</span><span class="chev">⌄</span></h3>
      <div class="body">${c.body()}${c.add ? `<button class="add-link" data-qa="${c.add[0]}">＋ ${c.add[1]}</button>` : ""}</div></section>`;
  };
  const cards = order.map(cardHtml).join("");
  futureDue();
  if (typeof paintTabs === "function") paintTabs();
  if (typeof shellOn === "function" && shellOn()) {                         // v0.58 the 5-tab shell (shell.js)
    document.getElementById("cards").innerHTML = (TAB === "home" ? futureBanner() + whatsNewHtml() : "") + shellHtml(cardHtml);
    tick(); return;
  }
  document.getElementById("cards").innerHTML = futureBanner() + whatsNewHtml() + (!S.city && !S.name ? welcomeHtml() : dayHubHomeHtml(order)) + cards +
    `<button class="add-link arrange-link" data-arrange="1">↕ Arrange my screen</button>`;
  tick();
}

function tick() {
  const c = document.getElementById("clockNow");
  if (!c) return;
  const s = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const m = s.match(/^(.*?)\s*([AaPp]\.?\s?[Mm]\.?)$/);
  c.innerHTML = m ? `${m[1]}<small>${m[2].toUpperCase()}</small>` : s;
}

// v0.45: "What am I forgetting?" opens its own sheet (it used to borrow the + Add sheet).
function showForget() {
  let el = document.getElementById("forgetSheet");
  if (!el) { el = document.createElement("div"); el.id = "forgetSheet"; el.className = "sheet"; el.setAttribute("role", "dialog");
    el.setAttribute("aria-label", "What am I forgetting?"); document.body.appendChild(el); }
  el.innerHTML = `<div class="sheet-body"><div class="grab"></div>
    <div class="sheet-head"><h2>🛳️ What am I forgetting?</h2><button class="icon-btn" data-forgetclose="1" aria-label="Close">✕</button></div>
    <div class="qa-form">${forgetHtml()}<button class="btn" data-forgetclose="1">Got it</button></div></div>`;
  el.classList.remove("hidden");
}

// ---------------------------------------------------------- toast + undo
let TOAST_ACT = null;
function toast(msg, undoable, extra) {
  const el = document.getElementById("toast");
  TOAST_ACT = extra ? extra.act : null;
  el.innerHTML = `<span>${esc(msg)}</span>${extra ? `<button data-tact="1">${esc(extra.label)}</button>` : ""}${undoable ? `<button data-undo="1">Undo</button>` : ""}`;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.classList.remove("show"); UNDO = null; }, undoable ? 5000 : 2200);
}
// Snapshot the whole state before anything destructive; Undo puts it back.
const snap = () => { UNDO = JSON.stringify(S); };

// ------------------------------------------------------------ quick add
// ------------------------------------------------------------- AI helper
// Scott 10/2 ("go with A"): Claude through a tiny relay in Scott's own Google
// account (relay/Code.gs, a Google Apps Script web app). The relay holds the
// API key + a passphrase; this phone only knows the passphrase, typed once in
// ⚙ and kept on THIS phone (never in the backup, never in the code). The relay
// runs only three fixed jobs - dump / ask / top3 - on the cheapest model with a
// daily cap. If it is off or down, everything falls back to the free on-phone way.
const AI_URL = "https://script.google.com/macros/s/AKfycbyVbxOCPR7v8UNTVufOWKOKBpI19-NcWEXMVzjP86iKraxenseHpWL95W9sB_Rr6DXo/exec";
const AI_KEY = "dayhub.aipass";
const aiPass = () => { try { return localStorage.getItem(AI_KEY) || ""; } catch (e) { return ""; } };
// v0.40: the owner's passphrase works exactly as before; with AI_PUBLIC on, a
// Pro phone sends its Whop email (+ phone id) instead and the relay gives each
// buyer their own cap.
// v0.53: in Cruise Hub a Day Hub Pro unlock on the same phone counts (proViaDayHub) - send that buyer.
const aiBuyer = () => (proGood(proState()) ? proState() : readPro(DAY_PRO_KEY)).buyer || proState().buyer || "";
const aiByKey = () => !aiPass() && switchOn("AI_PUBLIC") && isPro() && !!aiBuyer();
const aiOn = () => !!aiPass() || aiByKey();
async function aiCall(task, input, pass = aiPass()) {
  const t = today(), body = { task, input, today: t, weekday: parseDay(t).toLocaleDateString("en-US", { weekday: "long" }) };
  if (pass) body.pass = pass; else { body.buyer = aiBuyer(); body.device = deviceId(); }
  const r = await fetch(AI_URL, { method: "POST", body: JSON.stringify(body) });
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  return j;
}
const aiJSON = text => { const m = String(text || "").match(/\{[\s\S]*\}/); return m ? JSON.parse(m[0]) : null; };
function drawAiBox(msg) {
  const g = document.getElementById("aiBox"); if (!g) return;
  g.innerHTML = `<h3>🤖 AI helper</h3>` + (aiByKey()
    ? `<div class="leg"><span>✅ Included with ${PLAN.NAME} — Brain dump, 💡 Ask and 🎯 Top 3 use AI${msg ? ` · ${esc(msg)}` : ""}</span></div>
       <div class="foot-actions"><button class="btn sm" data-ai="test">Test it</button></div>`
    : aiOn()
    ? `<div class="leg"><span>✅ On — Brain dump, 💡 Ask and 🎯 Top 3 use AI${msg ? ` · ${esc(msg)}` : ""}</span></div>
       <div class="foot-actions"><button class="btn sm" data-ai="test">Test it</button><button class="btn sm ghost" data-ai="off">Turn off</button></div>`
    : (switchOn("PRO_GATE") && switchOn("AI_PUBLIC") ? `<p class="fine" style="margin-top:0"><b>Included with ${PLAN.NAME}</b> — unlock it in ${PLAN.NAME} above. Have your own relay passphrase? Use it here instead.</p>` : "") +
      `<p class="fine" style="margin-top:0">Smarter sorting for 🧠 Brain dump (more coming). Uses your own Claude helper — set up once:</p>
       <ol class="steps"><li>Type the passphrase you saved as <b>PASS</b> in your Day Hub AI relay.</li><li>Tap <b>Turn on</b>.</li></ol>
       <form class="inline-add" data-aipass="1"><input name="pass" type="password" placeholder="Passphrase" autocomplete="off" required><button class="btn sm">Turn on</button></form>
       ${msg ? `<p class="fine" style="margin-top:6px">⚠️ ${esc(msg)}</p>` : ""}`);
}

// ------------------------------------------------------------- brain dump
// Scott 10/2 ("cont" -> Brain Dump, the free version): say or type everything
// on your mind in one go - "need tires next month, call Dan Tuesday, buy
// toothpaste, vacation idea for December" - and Day Hub splits it, sorts each
// piece into a to-do, a reminder (with its day/time), a shopping item or an
// idea, and SHOWS the result to approve. Nothing is added until "Add all".
// Rules on the phone, no AI and no cost; an AI sorter can replace dumpParse later.
const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const SHOP_WORDS = /\b(milk|eggs?|bread|butter|cheese|coffee|tea|toothpaste|toothbrush|paper towels?|toilet paper|tp|soap|shampoo|conditioner|deodorant|detergent|dish soap|dog food|cat food|bananas?|apples?|chicken|beef|steak|rice|pasta|sugar|flour|batteries|trash bags|foil|cereal|juice|water|creamer|lettuce|tomatoes|onions|potatoes|bacon|sausage|yogurt|chips|razors?)\b/i;
const DUMP_KINDS = { todo: "✅ To-do", event: "⏰ Reminder", item: "🛒 Shopping", note: "💡 Idea / note", future: "🔮 Future me" };
let DUMP = [], RECOG = null;

function dumpSplit(text) {
  const parts = String(text || "").replace(/\b(and then|oh and|also|plus)\b/gi, ",")
    .split(/[\n,;]+|\.(?=\s|$)/).map(x => x.trim()).filter(x => /[a-z]/i.test(x));
  // A piece that is only a when ("Tuesday", "at 3") belongs to the one before it.
  const out = [];
  parts.forEach(x => { const w = dumpWhen(x);
    if (out.length && !w.rest.replace(/\b(on|at|by|for|this|next|the)\b/gi, "").trim() && (w.day || w.time)) out[out.length - 1] += " " + x;
    else out.push(x); });
  return out;
}
// Finds the day / time / repeat in a piece; returns them plus the text left over.
function dumpWhen(text, now = new Date()) {
  let r = " " + String(text) + " ", day = null, time = null, rep = null;
  const t0 = ymd(now), cut = re => { const m = r.match(re); if (m) r = r.replace(m[0], " "); return m; };
  const nextDow = (dow, skipToday) => { const d = new Date(now); let n = (dow - d.getDay() + 7) % 7; if (n === 0 && skipToday) n = 7; d.setDate(d.getDate() + n); return ymd(d); };
  let m;
  if ((m = cut(/\bevery\s*(day|morning|night|evening)\b|\b(daily|nightly)\b/i))) rep = "daily";
  else if ((m = cut(/\bevery\s*weekday\b|\bweekdays\b/i))) rep = "weekdays";
  else if ((m = cut(/\bevery\s*(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i))) { rep = "weekly"; day = nextDow(WEEKDAYS.indexOf(m[1].toLowerCase()), false); }
  else if ((m = cut(/\b(every\s*week|weekly)\b/i))) rep = "weekly";
  else if ((m = cut(/\b(every\s*month|monthly)\b/i))) rep = "monthly";
  else if ((m = cut(/\b(every\s*year|yearly|annually)\b/i))) rep = "yearly";
  if (!day) {
    if ((m = cut(/\bday after tomorrow\b/i))) day = addDays(t0, 2);
    else if ((m = cut(/\b(today|this morning|this afternoon)\b/i))) day = t0;
    else if ((m = cut(/\btonight\b/i))) { day = t0; time = "19:00"; }
    else if ((m = cut(/\btomorrow( morning| afternoon| night| evening)?\b/i))) { day = addDays(t0, 1); if (m[1]) time = { morning: "09:00", afternoon: "14:00", evening: "18:00", night: "19:00" }[m[1].trim().toLowerCase()]; }
    else if ((m = cut(/\bin\s+(a|an|one|two|three|four|five|six|\d+)\s+(day|days|week|weeks|month|months)\b/i))) {
      const n = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 }[m[1].toLowerCase()] || Number(m[1]);
      const u = m[2].toLowerCase(); const d = parseDay(t0);
      if (u.startsWith("day")) d.setDate(d.getDate() + n); else if (u.startsWith("week")) d.setDate(d.getDate() + 7 * n); else d.setMonth(d.getMonth() + n);
      day = ymd(d);
    }
    else if ((m = cut(/\bnext\s+week\b/i))) day = nextDow(1, true);
    else if ((m = cut(/\bnext\s+month\b/i))) day = ymd(new Date(now.getFullYear(), now.getMonth() + 1, 1));
    else if ((m = cut(/\b(this\s+)?weekend\b/i))) day = nextDow(6, false);
    else if ((m = cut(/\b(next\s+|this\s+|on\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tues?|wed|thu|thurs|fri|sat)\b/i))) {
      const k = m[2].toLowerCase().slice(0, 3), dow = WEEKDAYS.findIndex(w => w.startsWith(k));
      day = nextDow(dow, true); if (m[1] && /next/i.test(m[1]) && daysUntil(day) < 7) day = addDays(day, 7);
    }
    else if ((m = cut(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?\b/i))) {
      let d = new Date(now.getFullYear(), MONTHS.indexOf(m[1].slice(0, 3).toLowerCase()), Number(m[2]));
      if (ymd(d) < t0) d = new Date(now.getFullYear() + 1, d.getMonth(), d.getDate()); day = ymd(d);
    }
    else if ((m = cut(/\b(\d{1,2})\/(\d{1,2})\b/))) {
      if (Number(m[1]) <= 12) { let d = new Date(now.getFullYear(), m[1] - 1, Number(m[2])); if (ymd(d) < t0) d.setFullYear(d.getFullYear() + 1); day = ymd(d); }
    }
    else if ((m = cut(/\b(?:on\s+)?the\s+(\d{1,2})(?:st|nd|rd|th)\b/i))) {
      let d = new Date(now.getFullYear(), now.getMonth(), Number(m[1])); if (ymd(d) < t0) d = new Date(now.getFullYear(), now.getMonth() + 1, Number(m[1])); day = ymd(d);
    }
  }
  if ((m = cut(/\b(?:at|@|by)?\s*(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)(?=\W)/i))) {
    let h = Number(m[1]) % 12; if (/p/i.test(m[3])) h += 12; time = `${pad(h)}:${m[2] || "00"}`;
  } else if ((m = cut(/\b(?:at|@)\s*(\d{1,2})(?::(\d{2}))?\b/i))) {
    let h = Number(m[1]); if (h >= 1 && h <= 7) h += 12; if (h < 24) time = `${pad(h)}:${m[2] || "00"}`;
  } else if ((m = cut(/\b(?:at\s+)?noon\b/i))) time = "12:00";
  // "morning / afternoon / evening" are times only next to a day or after "in the / this";
  // "night" only after "in the / at" ("trash night" is a name, not 7 PM).
  else if (!time && (m = cut(day ? /\b(?:in the\s+|this\s+)?(morning|afternoon|evening)\b|\b(?:in the|at)\s+(night)\b/i
                                 : /\b(?:in the|this)\s+(morning|afternoon|evening)\b|\b(?:in the|at)\s+(night)\b/i)))
    time = { morning: "09:00", afternoon: "14:00", evening: "18:00", night: "19:00" }[(m[1] || m[2]).toLowerCase()];
  return { day, time, rep, rest: r.replace(/\s+/g, " ").trim() };
}
const dumpClean = s => {
  let x = String(s).replace(/^(please\s+)?(remind me to|remind me|remember to|don'?t forget to|dont forget|i need to|i have to|need to|have to|gotta|got to|i should|i want to|i gotta)\s+/i, "")
    .replace(/\s+\b(on|at|by|for|this|next|the|in)\s*$/i, "").replace(/^\b(to)\s+/i, "").replace(/\s+/g, " ").trim();
  return x ? x[0].toUpperCase() + x.slice(1) : x;
};
// One piece -> { kind, title, day, time, rep }.
function dumpClassify(piece, now = new Date()) {
  const raw = piece.trim(), w = dumpWhen(raw, now), low = w.rest.toLowerCase();
  if (/\b(future me|note to self|remind future|next time\b.*\b(don'?t|do not|never|remember)|never again)\b/i.test(raw))
    return { kind: "future", title: raw.replace(/^(remind\s+)?(future me|note to self)[:,\s-]*/i, "").replace(/^\w/, c => c.toUpperCase()) };
  if (/\b(idea|ideas|someday|maybe|what if|think about|look into)\b/i.test(raw)) return { kind: "note", title: dumpClean(raw) };
  const shopVerb = /^(please\s+)?(i need to buy|need to buy|buy|get|grab|pick up|pickup|order|we need|need more|out of|restock)\s+/i;
  if (!w.time && !w.rep && (shopVerb.test(w.rest) && (SHOP_WORDS.test(low) || !w.day)) || (!w.day && !w.time && SHOP_WORDS.test(low) && low.split(" ").length <= 3)) {
    const item = w.rest.replace(shopVerb, "").replace(/^(some|more|a|an)\s+/i, "").trim();
    return { kind: "item", title: dumpClean(item || w.rest) };
  }
  if (w.day || w.time || w.rep) {
    let day = w.day, time = w.time;
    if (!day) day = time && time <= hhmm(now) && !w.rep ? addDays(ymd(now), 1) : ymd(now);   // a repeat starts today
    return { kind: "event", title: dumpClean(w.rest) || dumpClean(raw), day, time: time || "09:00", rep: w.rep || "none" };
  }
  return { kind: "todo", title: dumpClean(raw) };
}
const dumpParse = (text, now = new Date()) => dumpSplit(text).map(p => dumpClassify(p, now)).filter(x => x.title);
function drawDump() {
  const out = document.getElementById("dumpOut"); if (!out) return;
  if (!DUMP.length) { out.innerHTML = ""; return; }
  const opt = (v, cur) => `<option value="${v}" ${v === cur ? "selected" : ""}>${DUMP_KINDS[v]}</option>`;
  out.innerHTML = `<div class="dump-h">Here's how I sorted it — change anything, then Add all</div>` + DUMP.map((x, i) => `<div class="dump-row">
      <div class="dump-line"><select data-dkind="${i}">${Object.keys(DUMP_KINDS).map(k => opt(k, x.kind)).join("")}</select>
        <button type="button" class="x" data-ddel="${i}" aria-label="Remove">✕</button></div>
      <input data-dtext="${i}" value="${esc(x.title)}" autocomplete="off">
      ${x.kind === "event" ? `<div class="two"><input type="date" data-dday="${i}" value="${x.day || today()}"><input type="time" data-dtime="${i}" value="${x.time || "09:00"}"></div>
        ${x.rep && x.rep !== "none" ? `<div class="sub">🔁 ${REPEATS[x.rep] || x.rep}</div>` : ""}` : ""}</div>`).join("");
  const b = document.querySelector("#qaForm > .btn:last-child"); if (b) b.textContent = `Add all (${DUMP.length})`;
}
async function dumpSort() {
  const ta = document.querySelector("#qaForm [name=dump]"); if (!ta) return;
  if (!ta.value.trim()) { toast("Say or type something first"); return; }
  let items = null;
  if (aiOn()) {
    const b = document.querySelector("[data-dumpsort]"); if (b) { b.disabled = true; b.textContent = "🤖 Sorting…"; }
    try {
      const j = aiJSON((await aiCall("dump", ta.value)).text), K = ["todo", "event", "item", "note"];
      items = (j && Array.isArray(j.items) ? j.items : []).filter(x => x && K.includes(x.kind) && String(x.title || "").trim()).map(x => ({
        kind: x.kind, title: String(x.title).trim().slice(0, 120),
        day: x.kind === "event" ? (/^\d{4}-\d{2}-\d{2}$/.test(x.day || "") ? x.day : today()) : null,
        time: x.kind === "event" ? (/^\d{1,2}:\d{2}$/.test(x.time || "") ? x.time.padStart(5, "0") : "09:00") : null,
        rep: x.kind === "event" && REPEATS[x.rep] ? x.rep : "none" }));
      if (!items.length) items = null;
    } catch (e) { toast("AI helper didn't answer — used the quick sorter"); }
    if (b) { b.disabled = false; b.textContent = "🧠 Sort it"; }
  }
  DUMP = items || dumpParse(ta.value).map(x => x.kind === "event" ? x : { ...x, day: null, time: null });
  if (!DUMP.length) { toast("Say or type something first"); return; }
  drawDump();
}
function dumpAdd() {
  const n = { todo: 0, event: 0, item: 0, note: 0, future: 0 }, L = S.lists.find(l => /grocer|shop/i.test(l.name)) || S.lists[0];
  DUMP.filter(x => (x.title || "").trim()).forEach(x => {
    const title = x.title.trim(); n[x.kind]++;
    if (x.kind === "todo") S.todos.push({ id: uid(), title, done: false, rep: "none", day: today() });
    else if (x.kind === "event") S.events.push({ id: uid(), day: x.day || today(), time: x.time || "09:00", title, where: "", rep: x.rep || "none" });
    else if (x.kind === "item") L.items.push({ id: uid(), text: title, done: false });
    else if (x.kind === "future") S.future.push({ id: uid(), created: new Date().toISOString(), seen: 0, text: title, words: futureWords(title), day: null });
    else S.notes.push({ id: uid(), text: title, pinned: false, updated: new Date().toISOString() });
  });
  DUMP = [];
  const said = [[n.todo, "to-do"], [n.event, "reminder"], [n.item, "shopping item"], [n.note, "idea"], [n.future, "future-me note"]].filter(([k]) => k).map(([k, w]) => `${k} ${w}${k === 1 ? "" : "s"}`).join(", ");
  return said;
}
function micToggle(btn) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { toast("Tap the 🎤 on your keyboard and talk"); return; }
  if (RECOG) { RECOG.stop(); return; }
  const ta = document.querySelector("#qaForm [name=dump]"), base = ta.value ? ta.value.replace(/\s*$/, ", ") : "";
  RECOG = new SR(); RECOG.lang = navigator.language || "en-US"; RECOG.interimResults = true; RECOG.continuous = true;
  let finals = "";
  RECOG.onresult = e => { let interim = "";
    for (let i = e.resultIndex; i < e.results.length; i++) { const tx = e.results[i][0].transcript;
      if (e.results[i].isFinal) finals += (finals ? ", " : "") + tx.trim(); else interim += tx; }
    ta.value = base + finals + (interim ? (finals ? ", " : "") + interim : ""); };
  RECOG.onend = () => { RECOG = null; btn.textContent = "🎤 Talk"; btn.classList.remove("on"); if (ta.value.trim()) dumpSort(); };
  RECOG.onerror = e => { if (e.error === "not-allowed") toast("Allow the microphone for Day Hub, or use the 🎤 on your keyboard"); };
  RECOG.start(); btn.textContent = "⏹ Stop"; btn.classList.add("on");
}

function qaTypes() {
  const t = [["dump", "🧠 Brain dump"], ["event", "📅 Event"], ["person", "🎂 Birthday / date"], ["upkeep", "🏠 Home / car"], ["routine", "🔁 Routine"], ["alarm", "⏰ Alarm"], ["return", "↩️ Return"], ["future", "🔮 Future me"], ["shift", "💼 Work shift"], ["todo", "✅ To-do"], ["spend", "💵 Spending"], ["item", "🛒 List item"], ["bill", "💳 Bill"], ["package", "📦 Package"], ["trip", "🚢 Trip"], ["countdown", "⏳ Countdown"], ["list", "📝 New list"]];
  if (S.pack === "trucker") t.splice(1, 0, ["loads", "🚚 Load"]);
  if (S.pack === "trades") t.splice(1, 0, ["jobs", "🔧 Job"]);
  return t;
}
function qaFields(type) {
  const d = VIEW || today();
  const F = {
    dump: `<textarea name="dump" rows="4" placeholder="Say or type everything on your mind — e.g. need tires next month, call Dan Tuesday at 2, buy toothpaste, vacation idea for December"></textarea>
      <div class="foot-actions dump-acts"><button type="button" class="btn sm ghost" data-mic="1">🎤 Talk</button><button type="button" class="btn sm" data-dumpsort="1">🧠 Sort it</button></div>
      <div class="hint">Separate things with a comma or a pause. Nothing is added until you tap Add all.</div>
      <div id="dumpOut"></div>`,
    event: `<input name="title" placeholder="What's happening?" required autocomplete="off">
      <div class="two"><input name="date" type="date" value="${d}" required><input name="time" type="time" required></div>
      <input name="where" placeholder="Where (optional)" autocomplete="off">${repSelect(true)}`,
    todo: `<input name="title" placeholder="What needs doing?" required autocomplete="off">${repSelect(false)}
      <div class="hint">Repeating to-dos come back unchecked on their days — meds, trash night, workouts.</div>`,
    loads: `<input name="title" placeholder="Pickup / delivery (e.g. PU Little Rock)" required autocomplete="off">
      <div class="two"><input name="date" type="date" value="${d}" required><input name="time" type="time" required></div>`,
    jobs: `<input name="title" placeholder="Job + address" required autocomplete="off">
      <div class="two"><input name="date" type="date" value="${d}" required><input name="time" type="time" required></div>`,
    item: `<select name="list">${S.lists.map(l => `<option value="${l.id}" ${l.id === S.listSel ? "selected" : ""}>${esc(l.name)}</option>`).join("")}</select>
      <input name="text" placeholder="Add an item" required autocomplete="off"><div class="hint">Stays open so you can add a few in a row.</div>`,
    bill: `<input name="title" placeholder="Bill name (e.g. Electric)" required autocomplete="off">
      <div class="two"><input name="amount" type="number" step="0.01" min="0" inputmode="decimal" placeholder="Amount $" required>
      <input name="day" type="number" min="1" max="31" inputmode="numeric" placeholder="Due day (1-31)" required></div>
      <div class="hint">Repeats every month. Tap Paid and it moves to next month.</div>`,
    trip: (() => { const tr = S.trips.find(x => x.id === TRIP_EDIT) || {}; const v = k => esc(tr[k] ?? "");
      // v0.97 Trip Hub: a new trip there is a regular trip; cruise-only boxes are hidden (still sent, so nothing is lost).
      const tt = tr.type || (MODE === "trip" ? "trip" : "cruise"), co = `data-cruiseonly ${tt === "cruise" ? "" : "hidden"}`;
      return `<div class="two"><select name="ttype" onchange="this.form.querySelectorAll('[data-cruiseonly]').forEach(e => e.hidden = this.value !== 'cruise')"><option value="cruise" ${tt !== "trip" ? "selected" : ""}>🚢 Cruise</option><option value="trip" ${tt === "trip" ? "selected" : ""}>✈️ ${MODE === "trip" ? "Trip" : "Other trip"}</option></select>
        <input name="tname" placeholder="${MODE === "trip" ? "Name (e.g. Florida road trip)" : "Name (e.g. Caribbean cruise)"}" value="${v("name")}" required autocomplete="off"></div>
      <div class="two"><label class="field" style="margin:0">Leave<input name="start" type="date" value="${v("start")}" required></label>
        <label class="field" style="margin:0">Back<input name="end" type="date" value="${v("end")}"></label></div>
      <div class="two"><input name="line" list="lineList" placeholder="Cruise line / airline" value="${v("line")}" autocomplete="off"><input name="ship" placeholder="Ship (optional)" value="${v("ship")}" ${co}></div>
      <datalist id="lineList">${CRUISE_LINE_LIST.map(n => `<option value="${esc(n)}">`).join("")}</datalist>
      <div class="two"><input name="port" placeholder="${tt === "cruise" ? "Leaving from (port / city)" : "Going to (city)"}" value="${v("port")}"><input name="travelers" type="number" min="1" inputmode="numeric" placeholder="People" value="${v("travelers")}"></div>
      <div class="two"><input name="total" type="number" step="0.01" min="0" inputmode="decimal" placeholder="Total price $" value="${v("total")}">
        <label class="field" style="margin:0">Final payment due<input name="finalDue" type="date" value="${v("finalDue")}"></label></div>
      <div class="two" ${co}><input name="onboardBudget" type="number" step="0.01" min="0" inputmode="decimal" placeholder="Onboard budget $" value="${v("onboardBudget")}">
        <input name="credit" type="number" step="0.01" min="0" inputmode="decimal" placeholder="Onboard credit $" value="${v("credit")}"></div>
      <div class="two"><input name="booking" placeholder="Booking number" value="${v("booking")}" autocomplete="off"><input name="cabin" placeholder="Cabin (e.g. D-512)" value="${v("cabin")}" autocomplete="off" ${co}></div>
      <label class="field" style="margin:0">Travel insurance<select name="insurance">${["undecided", "bought", "declined"].map(o => `<option value="${o}" ${(tr.insurance || "undecided") === o ? "selected" : ""}>${{ undecided: "Not decided yet", bought: "Bought", declined: "Decided not to" }[o]}</option>`).join("")}</select></label>
      <input name="travel" placeholder="Getting there (drive / flight + hotel night before…)" value="${v("travel")}" autocomplete="off">
      <label class="field" style="margin:0" ${co}>Package<select name="pkg"><option value="">Custom package (add your own perks)</option>${linePkgs(tr.line).concat(tr.pkg && PACKAGES[tr.pkg] && !linePkgs(tr.line).includes(tr.pkg) ? [tr.pkg] : []).map(k => `<option value="${k}" ${tr.pkg === k ? "selected" : ""}>${esc(PACKAGES[k].name)}</option>`).join("")}</select></label>
      <div class="hint">Day Hub never asks for passport or ID numbers — only whether they're ready.</div>
      <div class="hint">${TRIP_EDIT ? "Changing a trip keeps its payments, spending and lists." : "Packing, documents and before-you-go lists are filled in for you."}</div>
      ${TRIP_EDIT ? `<button type="button" class="btn sm ghost" data-tripremove="${TRIP_EDIT}">Delete this trip</button>` : ""}`; })(),
    tpay: `<input name="amt" type="number" step="0.01" min="0" inputmode="decimal" placeholder="Amount paid $" required>
      <div class="two"><input name="date" type="date" value="${today()}" required><input name="note" placeholder="Note (deposit, final…)" autocomplete="off"></div>`,
    tport: (() => { const tr = curTrip() || {}; const pt = (tr.ports || []).find(x => x.id === PORT_EDIT) || { day: PORT_DAY || tr.start };
      const v = k => esc(pt[k] ?? "");
      return `<input name="pname" placeholder="Port (e.g. Cozumel)" value="${v("name")}" required autocomplete="off">
      <input name="pday" type="date" value="${v("day")}" min="${tr.start || ""}" max="${tr.end || ""}" required>
      <div class="two"><label class="field" style="margin:0">Arrive<input name="arrive" type="time" value="${v("arrive")}"></label>
        <label class="field" style="margin:0"><b style="color:var(--orange)">All aboard</b><input name="allAboard" type="time" value="${v("allAboard")}"></label></div>
      <input name="excursion" placeholder="Excursion (or type none)" value="${v("excursion")}" autocomplete="off">
      <div class="two"><label class="field" style="margin:0">Meet at<input name="meet" type="time" value="${v("meet")}"></label>
        <input name="where" placeholder="Meeting point" value="${v("where")}" autocomplete="off"></div>
      <div class="two"><label class="field" style="margin:0">Walk to meeting point (min)<input name="walk" type="number" min="0" inputmode="numeric" value="${v("walk") || 15}"></label>
        <label class="field" style="margin:0">Ship clock<select name="shipOffset">${[[0, "Same as local"], [60, "Ship 1 hr AHEAD"], [-60, "Ship 1 hr BEHIND"]].map(([o, l]) => `<option value="${o}" ${Number(pt.shipOffset || 0) === o ? "selected" : ""}>${l}</option>`).join("")}</select></label></div>
      <label class="row" style="border:none"><input type="checkbox" name="indie" value="1" ${pt.indie ? "checked" : ""} style="width:20px;height:20px"> <span class="grow">Independent tour (not booked through the ship) — extra alarm 90 min before all aboard</span></label>
      <div class="two"><input name="agent" placeholder="Port agent phone (daily planner)" value="${v("agent")}" autocomplete="off" inputmode="tel"><input name="emergency" placeholder="Local emergency number" value="${v("emergency")}" autocomplete="off" inputmode="tel"></div>
      <div class="two"><input name="cash" placeholder="Cash to bring (e.g. $40)" value="${v("cash")}" autocomplete="off"><input name="currency" placeholder="Currency (e.g. USD ok)" value="${v("currency")}" autocomplete="off"></div>
      <div class="two"><input name="cards" placeholder="Cards (yes / cash better)" value="${v("cards")}" autocomplete="off"><input name="tipping" placeholder="Tipping custom" value="${v("tipping")}" autocomplete="off"></div>
      <div class="hint">All aboard is printed in your cruise app / daily planner — usually 30-60 min before the ship leaves. It's SHIP time, which can differ from your phone's local time.</div>`; })(),
    forget: forgetHtml(),
    tperk: `<input name="pname" placeholder="Perk (e.g. Onboard credit, Specialty dinners)" required autocomplete="off">
      <div class="two"><input name="ptotal" type="number" step="0.01" min="0" inputmode="decimal" placeholder="How many / how much" required>
      <select name="punit"><option value="times">times</option><option value="$">dollars</option></select></div>`,
    tperkset: (() => { const tr = curTrip() || {}; const x = (tr.perks || []).find(y => y.id === PERK_EDIT) || {};
      return `<div class="today-line"><b>${esc(x.name || "")}</b></div>
      <div class="two"><label class="field" style="margin:0">${x.unit === "$" ? "Credit $" : "Total"}<input name="ptotal" type="number" step="0.01" min="0" value="${x.total || ""}" required></label>
      <label class="field" style="margin:0">${x.unit === "$" ? "Used $" : "Used"}<input name="pused" type="number" step="0.01" min="0" value="${x.used || 0}" required></label></div>`; })(),
    tspend: `<div class="two"><input name="amt" type="number" step="0.01" min="0" inputmode="decimal" placeholder="Amount $" required>
      <select name="cat">${ONBOARD_CATS.map(c => `<option>${c}</option>`).join("")}</select></div>
      <div class="two"><input name="date" type="date" value="${today()}" required><input name="note" placeholder="What (optional)" autocomplete="off"></div>`,
    package: `<input name="name" placeholder="What is it (e.g. New boots)" required autocomplete="off">
      <input name="num" placeholder="Tracking number" required autocomplete="off" autocapitalize="characters">
      <div class="two"><select name="carrier"><option value="auto">Carrier: figure it out</option>${Object.entries(CARRIERS).map(([k, v]) => `<option value="${k}">${v[0]}</option>`).join("")}</select>
      <input name="eta" type="date" min="${today()}" title="Expected delivery (optional)"></div>
      <div class="hint">Expected date is optional — add it and the delivery shows on your schedule.</div>`,
    person: (() => { const p = S.people.find(x => x.id === PERSON_EDIT) || { kind: "birthday", lead: 14 };
      const o = (v, l, cur) => `<option value="${v}" ${String(v) === String(cur) ? "selected" : ""}>${l}</option>`;
      const dv = p.md ? `${p.year || today().slice(0, 4)}-${p.md}` : "";
      return `<input name="name" placeholder="Whose? (e.g. Roxanne) or what date" value="${esc(p.name || "")}" required autocomplete="off">
      <div class="two"><select name="kind">${o("birthday", "🎂 Birthday", p.kind)}${o("anniversary", "💍 Anniversary", p.kind)}${o("other", "⭐ Other date", p.kind)}</select>
        <input name="date" type="date" value="${dv}" required></div>
      <label class="check"><input type="checkbox" name="noyear" ${p.md && !p.year ? "checked" : ""}> I don't know the year</label>
      <label class="field">Gift reminder<select name="lead">${o(0, "Off", p.lead)}${o(7, "1 week before", p.lead)}${o(14, "2 weeks before", p.lead)}${o(21, "3 weeks before", p.lead)}${o(28, "4 weeks before", p.lead)}</select></label>
      <input name="ideas" placeholder="Gift ideas, sizes, favorites (optional)" value="${esc(p.ideas || "")}" autocomplete="off">
      ${PERSON_EDIT ? `<button type="button" class="btn sm ghost" data-pdel="${PERSON_EDIT}">Delete this date</button>` : ""}`; })(),
    future: (() => { const f = S.future.find(x => x.id === FUTURE_EDIT) || { text: "", words: [], day: "" };
      return `<textarea name="text" rows="3" required placeholder="What should future you remember — and why? e.g. Next time we travel, don't book a 6 AM flight. We were wrecked all day.">${esc(f.text)}</textarea>
        <label class="field">Bring it back when I add something about… (words, comma between)<input name="words" value="${esc(f.words.join(", "))}" placeholder="leave blank — Day Hub picks the words" autocomplete="off"></label>
        <label class="field">…or on this day (optional)<input name="day" type="date" value="${f.day || ""}"></label>
        ${FUTURE_EDIT ? `<button type="button" class="btn sm ghost" data-futdel="${FUTURE_EDIT}">Delete this note</button>` : ""}`; })(),
    return: `<input name="what" placeholder="What are you returning? (e.g. Boots — too small)" required autocomplete="off">
      <input name="store" placeholder="Store / site (Amazon, Target…)" autocomplete="off">
      <div class="two"><label class="field">Return by<input name="by" type="date" value="${addDays(today(), 30)}" required></label>
        <label class="field">Money back (optional)<input name="amount" type="number" min="0" step="0.01" placeholder="$"></label></div>
      <label class="field">How<select name="how">${Object.entries(RETURN_HOW).map(([k, v]) => `<option value="${k}">${v[0]} ${v[1]}</option>`).join("")}</select></label>
      <div class="hint">Most stores give 30 days from delivery — check the receipt or order page. Day Hub reminds you 3 days and 1 day before.</div>`,
    alarm: (() => { const a = S.alarms.find(x => x.id === ALARM_EDIT) || { time: "06:00", days: [1, 2, 3, 4, 5], label: "" };
      return `<label class="field">Alarm time<input name="time" type="time" value="${a.time}" required></label>
        <div class="field">Which days?<div class="dow">${DOW.map((n, i) => `<label><input type="checkbox" name="d${i}" ${a.days.includes(i) ? "checked" : ""}>${n}</label>`).join("")}</div></div>
        <input name="label" placeholder="Label (optional — Work, Gym…)" value="${esc(a.label || "")}" autocomplete="off">
        <div class="hint">Set the same alarm in your phone's Clock app — Day Hub shows it on your schedule and in the Nightly reset. No days ticked = just tomorrow.</div>
        ${ALARM_EDIT ? `<button type="button" class="btn sm ghost" data-aldel="${ALARM_EDIT}">Delete this alarm</button>` : ""}`; })(),
    routine: (() => { const r = S.routines.find(x => x.id === ROUTINE_EDIT) || { name: "", steps: [], days: [], time: "" };
      return `<input name="name" placeholder="Name (e.g. 🏋️ Gym day)" value="${esc(r.name)}" required autocomplete="off">
        <label class="field">Steps — one per line<textarea name="steps" rows="6" required placeholder="Fill water bottle&#10;Pack gym bag&#10;Protein shake">${esc(r.steps.map(x => x.text).join("\n"))}</textarea></label>
        <div class="field">Which days? (for a reminder)<div class="dow">${DOW.map((n, i) => `<label><input type="checkbox" name="d${i}" ${r.days.includes(i) ? "checked" : ""}>${n}</label>`).join("")}</div></div>
        <label class="field">At<input name="time" type="time" value="${r.time || ""}"></label>
        ${ROUTINE_EDIT ? `<button type="button" class="btn sm ghost" data-rdel="${ROUTINE_EDIT}">Delete this routine</button>` : ""}`; })(),
    upkeep: (() => { const x = S.upkeep.find(y => y.id === UPKEEP_EDIT) || (UPKEEP_PRESET ? { area: UPKEEP_PRESET[0], name: UPKEEP_PRESET[1][0], every: UPKEEP_PRESET[1][1], unit: UPKEEP_PRESET[1][2], auto: !!UPKEEP_PRESET[1][3] } : { area: "home", every: 3, unit: "months" });
      const o = (v, l, cur) => `<option value="${v}" ${String(v) === String(cur) ? "selected" : ""}>${l}</option>`;
      return `<div class="two"><select name="area">${o("home", "🏠 Home", x.area)}${o("auto", "🚗 Car", x.area)}</select>
          <input name="name" list="upList" placeholder="What? (e.g. HVAC filter)" value="${esc(x.name || "")}" required autocomplete="off"></div>
        <datalist id="upList">${[...UPKEEP_PRESETS.home, ...UPKEEP_PRESETS.auto].map(([n]) => `<option value="${esc(n)}">`).join("")}</datalist>
        <div class="two"><label class="field">Every<input name="every" type="number" min="1" max="99" value="${x.every || 1}" required></label>
          <label class="field">&nbsp;<select name="unit">${["days", "weeks", "months", "years"].map(u => o(u, u, x.unit)).join("")}</select></label></div>
        <label class="field">${x.auto ? "Next pickup day" : "Next due (or leave blank and set Last done)"}<input name="next" type="date" value="${x.next || (x.auto || !x.last ? (x.id ? upkeepNext(x) : "") : "")}"></label>
        ${x.auto ? "" : `<label class="field">Last done<input name="last" type="date" value="${x.last || ""}"></label>`}
        <label class="check"><input type="checkbox" name="auto" ${x.auto ? "checked" : ""}> Repeats on its own (like trash day) — no ✓ Done needed</label>
        ${UPKEEP_EDIT ? `<button type="button" class="btn sm ghost" data-updel="${UPKEEP_EDIT}">Delete</button>` : ""}`; })(),
    countdown: `<input name="title" placeholder="What are you counting down to?" required autocomplete="off">
      <input name="date" type="date" min="${today()}" required>`,
    list: `<input name="name" placeholder="List name (e.g. Hardware store)" required autocomplete="off">`,
    note: (() => { const n = S.notes.find(x => x.id === NOTE_EDIT) || {};
      return `<textarea name="text" rows="6" placeholder="Your note" required>${esc(n.text || "")}</textarea>`; })(),
    spend: `<input name="amt" type="number" step="0.01" min="0" inputmode="decimal" placeholder="Amount $" required>
      <input name="what" placeholder="What for (gas, groceries, eating out…)" autocomplete="off">
      <input name="date" type="date" value="${today()}" required>
      <div class="hint">Bills are already counted — log the day-to-day spending.</div>`,
    shift: `<input name="date" type="date" value="${d}" required>
      <div class="two"><label class="field" style="margin:0">Start<input name="start" type="time" required></label>
      <label class="field" style="margin:0">End<input name="end" type="time" required></label></div>
      <input name="brk" type="number" min="0" inputmode="numeric" placeholder="Unpaid break (minutes, optional)">`,
    pay: `<label class="field" style="margin:0">Paid by
        <select name="itype"><option value="hourly" ${S.money.type !== "salary" ? "selected" : ""}>The hour</option>
        <option value="salary" ${S.money.type === "salary" ? "selected" : ""}>Salary</option></select></label>
      <label class="field" style="margin:0">Hourly pay ($) — hourly only<input name="rate" type="number" step="0.01" min="0" inputmode="decimal" value="${S.work.rate || ""}"></label>
      <label class="field" style="margin:0">Yearly salary ($) — salary only<input name="salary" type="number" step="1" min="0" inputmode="decimal" value="${S.money.salary || ""}"></label>
      <label class="field" style="margin:0">Taken out for taxes (%)<input name="tax" type="number" step="0.5" min="0" max="60" inputmode="decimal" value="${S.work.taxPct}" required></label>
      <label class="field" style="margin:0">Overtime after (hours/week)<input name="ot" type="number" min="1" max="80" inputmode="numeric" value="${S.work.otAfter}" required></label>
      <label class="field" style="margin:0">Paid
        <select name="period"><option value="weekly" ${S.work.period !== "biweekly" ? "selected" : ""}>Every week</option>
        <option value="biweekly" ${S.work.period === "biweekly" ? "selected" : ""}>Every 2 weeks</option></select></label>
      <label class="field" style="margin:0">A pay period started on (for every 2 weeks)<input name="pstart" type="date" value="${S.work.periodStart || weekStart(today())}"></label>
      <div class="hint">Not sure of your tax %? 15–25% covers most people. Check one real paycheck: take-home ÷ gross.</div>`,
  };
  return (F[type] || F.todo) + `<button class="btn">${type === "forget" ? "Got it" : type === "pay" || (type === "trip" && TRIP_EDIT) ? "Save" : type === "dump" ? (DUMP.length ? `Add all (${DUMP.length})` : "Sort it") : "Add"}</button>`;
}
let NOTE_EDIT = null, ERASE_ARMED = 0;
let TRIP_EDIT = null, PORT_EDIT = null, PORT_DAY = null, PERK_EDIT = null;
function openQA(type, keepEdit) {
  if (!keepEdit) { TRIP_EDIT = null; PERSON_EDIT = null; UPKEEP_EDIT = null; UPKEEP_PRESET = null; ROUTINE_EDIT = null; ALARM_EDIT = null; FUTURE_EDIT = null; }
  // Opened from ⚙ (✏️ an alarm, ＋ Add an alarm): close Settings first - it sat on top and hid the form.
  if (!document.getElementById("sheet").classList.contains("hidden")) closeSettings();
  QA_TYPE = type || QA_TYPE;
  if (QA_TYPE !== "dump") DUMP = [];
  if (RECOG) RECOG.stop();
  document.getElementById("qaTypes").innerHTML = qaTypes().map(([k, l]) => `<button class="${k === QA_TYPE ? "on" : ""}" data-qtype="${k}">${l}</button>`).join("");
  const f = document.getElementById("qaForm");
  f.innerHTML = qaFields(QA_TYPE);
  document.getElementById("qa").classList.remove("hidden");
  setTimeout(() => { const i = f.querySelector("input"); if (i) i.focus(); }, 60);
}
const closeQA = () => document.getElementById("qa").classList.add("hidden");

function submitQA(f) {
  const d = Object.fromEntries(new FormData(f));
  const ty = QA_TYPE;
  if (ty === "dump") {
    if (!DUMP.length) { dumpSort(); return; }                   // first tap sorts; nothing added yet
    const dumpText = DUMP.map(x => x.title).join(" "); snap(); const said = dumpAdd(); const hit = futureCheck(dumpText);
    save(); closeQA(); render(); buzz(); toast(`Added ${said} ✓${hit ? " — 🔮 see the note at the top" : ""}`, true); return;
  }
  if (ty === "event") { S.events.push({ id: uid(), day: d.date, time: d.time, title: d.title.trim(), where: (d.where || "").trim(), rep: d.rep || "none" }); VIEW = d.date; }
  else if (ty === "shift") { S.work.shifts.push({ id: uid(), day: d.date, start: d.start, end: d.end, brk: Number(d.brk || 0) }); VIEW = d.date; }
  else if (ty === "pay") { S.work.rate = Number(d.rate || 0); S.work.taxPct = Number(d.tax); S.work.otAfter = Number(d.ot);
    S.money.type = d.itype || "hourly"; S.money.salary = Number(d.salary || 0);
    S.work.period = d.period || "weekly"; S.work.periodStart = d.pstart || null;
    save(); closeQA(); render(); toast("Pay saved ✓"); return; }
  else if (ty === "note") { const n = S.notes.find(x => x.id === NOTE_EDIT);
    if (n) { n.text = d.text.trim(); n.updated = new Date().toISOString(); } else S.notes.push({ id: uid(), text: d.text.trim(), pinned: false, updated: new Date().toISOString() });
    NOTE_EDIT = null; }
  else if (ty === "spend") S.money.spends.push({ id: uid(), day: d.date, amt: Number(d.amt), what: (d.what || "").trim() });
  else if (ty === "todo") S.todos.push({ id: uid(), title: d.title.trim(), done: false, rep: d.rep || "none", day: today() });
  else if (ty === "loads" || ty === "jobs") { S[ty].push({ id: uid(), day: d.date, time: d.time, title: d.title.trim(), done: false }); VIEW = d.date; }
  else if (ty === "bill") {
    const day = Math.min(31, Math.max(1, Number(d.day))), now = new Date();
    // Added after this month's due day = treat this month as handled; before it = due this month.
    const paid = day < now.getDate() ? today().slice(0, 7) : prevMonthKey();
    S.bills.push({ id: uid(), name: d.title.trim(), amount: Number(d.amount), day, paid });
  }
  else if (ty === "future") {
    const words = (d.words || "").split(",").map(w => w.trim().toLowerCase()).filter(w => w.length >= 3);
    const rec = { text: d.text.trim(), words: words.length ? words : futureWords(d.text), day: d.day || null };
    const old = S.future.find(x => x.id === FUTURE_EDIT);
    if (old) Object.assign(old, rec, { dayShown: rec.day !== old.day ? false : old.dayShown }); else S.future.push({ id: uid(), created: new Date().toISOString(), seen: 0, ...rec });
    FUTURE_EDIT = null;
    save(); closeQA(); render(); buzz(); toast(`🔮 Saved — comes back with: ${rec.words.join(", ") || "its date"}`); return;
  }
  else if (ty === "return") S.returns.push({ id: uid(), what: d.what.trim(), store: (d.store || "").trim(), by: d.by, how: d.how || "ship",
    amount: Number(d.amount) > 0 ? Number(d.amount) : null, done: false });
  else if (ty === "alarm") {
    const days = DOW.map((_, i) => d["d" + i] ? i : -1).filter(i => i >= 0);
    const rec = { time: d.time, days, label: (d.label || "").trim(), on: true, once: days.length ? null : addDays(today(), 1) };
    const old = S.alarms.find(x => x.id === ALARM_EDIT);
    if (old) Object.assign(old, rec); else S.alarms.push({ id: uid(), ...rec });
    ALARM_EDIT = null; if (!document.getElementById("sheet").classList.contains("hidden")) drawAlarmBox();
  }
  else if (ty === "routine") {
    const texts = (d.steps || "").split(/\n+/).map(x => x.trim()).filter(Boolean), days = DOW.map((_, i) => d["d" + i] ? i : -1).filter(i => i >= 0);
    const old = S.routines.find(x => x.id === ROUTINE_EDIT);
    if (old) { old.name = d.name.trim(); old.days = days; old.time = d.time || null;
      old.steps = texts.map(t => old.steps.find(x => x.text === t) || { id: uid(), text: t }); }   // keep ticks on unchanged steps
    else ROUTINE_OPEN = addRoutine(d.name.trim(), texts, days, d.time).id;
    ROUTINE_EDIT = null;
  }
  else if (ty === "upkeep") {
    const auto = !!d.auto, rec = { area: d.area, name: d.name.trim(), every: Math.max(1, Number(d.every) || 1), unit: d.unit, auto,
      next: d.next || null, last: auto ? null : (d.last || (d.next ? null : today())) };
    if (auto && !rec.next) rec.next = today();
    const old = S.upkeep.find(x => x.id === UPKEEP_EDIT);
    if (old) Object.assign(old, rec); else S.upkeep.push({ id: uid(), ...rec });
    UPKEEP_EDIT = UPKEEP_PRESET = null;
  }
  else if (ty === "person") {
    const rec = { name: d.name.trim(), kind: d.kind || "birthday", md: d.date.slice(5), year: d.noyear ? null : Number(d.date.slice(0, 4)),
                  lead: Number(d.lead || 0), ideas: (d.ideas || "").trim() };
    const old = S.people.find(x => x.id === PERSON_EDIT);
    if (old) Object.assign(old, rec); else S.people.push({ id: uid(), got: {}, ...rec });
    PERSON_EDIT = null;
  }
  else if (ty === "countdown") S.countdowns.push({ id: uid(), title: d.title.trim(), date: d.date });
  else if (ty === "trip") {
    const fields = { type: d.ttype, name: d.tname.trim(), start: d.start || null, end: d.end || null, line: (d.line || "").trim(),
      ship: (d.ship || "").trim(), port: (d.port || "").trim(), travelers: Number(d.travelers || 0) || null,
      total: Number(d.total || 0) || null, finalDue: d.finalDue || null, onboardBudget: Number(d.onboardBudget || 0) || null,
      credit: Number(d.credit || 0) || null, booking: (d.booking || "").trim(), cabin: (d.cabin || "").trim(),
      insurance: d.insurance || "undecided", travel: (d.travel || "").trim(), pkg: d.pkg || "" };
    const old = S.trips.find(x => x.id === TRIP_EDIT);
    if (old) { Object.assign(old, fields); seedPerks(old); }
    else { const id = uid(); const nt = ensureLists({ id, ...fields, payments: [], spends: [], ports: [], perks: [], lists: newLists(fields.type) }); seedPerks(nt); S.trips.push(nt); S.tripSel = id; S.tripTab = "ready";
      if (typeof cruiseAdded === "function") setTimeout(() => cruiseAdded(nt), 0); }                  // v0.60 the magic moment
    TRIP_EDIT = null;
  }
  else if (ty === "forget") { closeQA(); return; }
  else if (ty === "tperk" || ty === "tperkset") {
    const tr = curTrip(); if (!tr) { closeQA(); return; } tr.perks = tr.perks || [];
    if (ty === "tperk") tr.perks.push({ id: uid(), name: d.pname.trim(), total: Number(d.ptotal || 0), used: 0, unit: d.punit === "$" ? "$" : "times" });
    else { const x = tr.perks.find(y => y.id === PERK_EDIT); if (x) { x.total = Number(d.ptotal || 0); x.used = Math.min(Number(d.pused || 0), x.total || Infinity); } PERK_EDIT = null; }
  }
  else if (ty === "tport") {
    const tr = curTrip(); if (!tr) { closeQA(); return; } ensureLists(tr);
    const f2 = { day: d.pday, name: d.pname.trim(), arrive: d.arrive || "", allAboard: d.allAboard || "", excursion: (d.excursion || "").trim(), meet: d.meet || "", where: (d.where || "").trim(),
      walk: Number(d.walk || 15), shipOffset: Number(d.shipOffset || 0), indie: d.indie === "1",
      agent: (d.agent || "").trim(), emergency: (d.emergency || "").trim(),                // v0.57 crisis mode
      cash: (d.cash || "").trim(), currency: (d.currency || "").trim(), cards: (d.cards || "").trim(), tipping: (d.tipping || "").trim() };
    const old = tr.ports.find(x => x.id === PORT_EDIT);
    if (old) Object.assign(old, f2); else tr.ports.push({ id: uid(), ...f2 });
    tr.ports.sort((a, b) => a.day.localeCompare(b.day)); PORT_EDIT = PORT_DAY = null;
  }
  else if (ty === "tpay" || ty === "tspend") {
    const tr = curTrip(); if (!tr) { closeQA(); return; }
    if (ty === "tpay") tr.payments.push({ id: uid(), day: d.date, amt: Number(d.amt), note: (d.note || "").trim() });
    else tr.spends.push({ id: uid(), day: d.date, amt: Number(d.amt), cat: d.cat, note: (d.note || "").trim() });
  }
  else if (ty === "package") S.packages.push({ id: uid(), name: d.name.trim(), num: cleanNum(d.num),
    carrier: d.carrier === "auto" ? detectCarrier(d.num) : d.carrier, eta: d.eta || null, delivered: false });
  else if (ty === "list") { const id = uid(); S.lists.push({ id, name: d.name.trim(), items: [] }); S.listSel = id; }
  else if (ty === "item") {
    const L = S.lists.find(l => l.id === d.list);
    if (L) { L.items.push({ id: uid(), text: d.text.trim(), done: false }); S.listSel = L.id; }
    save(); render(); toast(`Added to ${L ? L.name : "list"} ✓`);
    f.querySelector("[name=text]").value = ""; f.querySelector("[name=text]").focus();
    return;
  }
  const hit = futureCheck(Object.values(d).filter(v => typeof v === "string").join(" "));
  save(); closeQA(); render(); buzz(); toast(hit ? "Added ✓ — 🔮 future you left a note (top of the screen)" : "Added ✓");
}

// ------------------------------------------------------------- events
document.addEventListener("submit", e => {
  const f = e.target; e.preventDefault();
  const data = Object.fromEntries(new FormData(f));
  if (f.id === "qaForm") { submitQA(f); return; }
  if (f.dataset.setup) {
    S.name = (data.name || "").trim(); S.city = (data.city || "").trim(); S.pack = data.pack || "general";
    save(); WXDATA = null; render(); loadWeather(); toast("You're all set ✓"); return;
  }
  if (f.dataset.remember !== undefined) { const x = (data.text || "").trim(); if (!x) return;
    S.remember.push({ id: uid(), day: addDays(today(), 1), text: x }); save(); render(); toast("📌 Saved for the morning"); return; }
  if (f.dataset.route) { S.route = { from: data.from.trim(), to: data.to.trim() }; save(); loadWeather(); return; }
  if (typeof cruiseSubmit === "function" && cruiseSubmit(f, data)) return;   // v0.56 cruise.js
  if (f.dataset.cost) { const tr = S.trips.find(x => x.id === f.dataset.cost), amt = Number(data.amt);
    if (tr && amt > 0) { tr.costs = tr.costs || []; tr.costs.push({ id: uid(), cat: data.cat || "other", what: String(data.what || "").trim(), amt, paid: data.paid === "1" }); save(); render(); buzz(); }
    return; }
  if (f.dataset.drink) { const tr = S.trips.find(x => x.id === f.dataset.drink); const P = tr && pkgOf(tr); const pr = Number(data.price);
    if (P) toast(pr <= P.drinkCap ? `✅ $${pr.toFixed(2)} — included in ${P.name} (up to $${P.drinkCap})` : `⚠️ $${pr.toFixed(2)} is over ${P.name}'s $${P.drinkCap} limit — ask the bartender before you order`);
    f.reset(); return; }
  if (f.dataset.noteadd) { S.notes.push({ id: uid(), text: data.text.trim(), pinned: false, updated: new Date().toISOString() }); save(); render(); buzz(); return; }
  if (f.dataset.tadd) { const [tid, k] = f.dataset.tadd.split(":"); const tr = S.trips.find(x => x.id === tid);
    if (tr) tr.lists[k].push({ id: uid(), text: data.text.trim(), done: false });
    save(); render(); const again = document.querySelector(`form[data-tadd="${f.dataset.tadd}"] input`); if (again) again.focus(); return; }
  if (f.dataset.ask) { askDayHub(data.q); return; }
  if (f.dataset.proform) { const k = (data.key || "").trim(); if (k) unlockPro(/@/.test(k) ? k.toLowerCase() : k); return; }
  if (f.dataset.aipass) { const pw = (data.pass || "").trim(); if (!pw) return;
    drawAiBox("checking…");
    aiCall("ping", "", pw).then(() => { try { localStorage.setItem(AI_KEY, pw); } catch (e) { /* private mode */ } drawAiBox("connected ✓"); toast("🤖 AI helper on"); })
      .catch(e => { drawAiBox(/passphrase/.test(e.message) ? "That passphrase doesn't match the relay's PASS" : "Couldn't reach the relay: " + e.message); });
    return; }
  if (f.dataset.paysetup) { S.payday = { ...S.payday, freq: data.freq, next: data.next, amount: Number(data.amount) > 0 ? Number(data.amount) : null };
    if (data.freq === "semimonthly") { S.payday.d1 = Number(data.next.slice(8)); S.payday.d2 = Math.min(31, Math.max(1, Number(data.d2) || 15)); }
    save(); render(); buzz(); toast("💵 Payday set ✓"); return; }
  if (f.dataset.goalnew) { S.goals.push({ id: uid(), name: data.name.trim(), target: Number(data.target) || 0, saved: 0 }); save(); render(); buzz(); return; }
  if (f.dataset.goaladd) { const g = S.goals.find(x => x.id === f.dataset.goaladd); if (g) { snap(); g.saved = Math.round((g.saved + Number(data.amt || 0)) * 100) / 100; save(); render(); buzz();
    toast(g.saved >= g.target ? `🎉 ${g.name} — goal reached!` : `${money(Number(data.amt))} toward ${g.name} ✓`, true); } return; }
  if (f.dataset.addleave) { const x = (data.text || "").trim(); if (!x) return;
    S.leave.items.push({ id: uid(), text: x }); save(); render(); buzz();
    const again = document.querySelector('form[data-addleave] input'); if (again) again.focus(); return; }
  if (f.dataset.additem) {
    const L = S.lists.find(l => l.id === f.dataset.additem);
    if (L) L.items.push({ id: uid(), text: data.text.trim(), done: false });
    save(); render(); buzz();
    const again = document.querySelector(`form[data-additem="${f.dataset.additem}"] input`); if (again) again.focus();
  }
});

document.addEventListener("click", e => {
  const ne = e.target.closest && e.target.closest("[data-noteedit]");
  if (ne) { NOTE_EDIT = ne.dataset.noteedit; openQA("note"); return; }
  if (e.target.classList && e.target.classList.contains("sheet")) {         // tap on the dim backdrop
    if (e.target.id === "sheet") closeSettings(); else if (e.target.id === "pulseSheet" || e.target.id === "askSheet" || e.target.id === "forgetSheet") e.target.classList.add("hidden"); else closeQA(); return;
  }
  const t = e.target.closest("button, h3[data-collapse]");
  if (!t) return;
  const ds = t.dataset;
  if (t.id === "fab") { openQA(VIEW === today() ? "event" : "event"); return; }
  if (t.id === "settingsBtn" || ds.open === "sheet") { openSettings(); return; }
  if (ds.close === "qa") { closeQA(); return; }
  if (ds.close === "sheet") { closeSettings(); return; }
  if (ds.qa) { openQA(ds.qa); return; }
  if (ds.qtype) { openQA(ds.qtype); return; }
  if (ds.undo) { if (UNDO) { S = JSON.parse(UNDO); UNDO = null; save(); render(); toast("Restored ✓"); } return; }
  if (ds.pro === "check") { const p = proState(); if (p.buyer) unlockPro(p.buyer); return; }
  if (ds.pro === "remove") { const p = proState();
    if (p.buyer) fetch(AI_URL, { method: "POST", body: JSON.stringify({ task: "release", buyer: p.buyer, device: deviceId(), app: APP_ID }) }).catch(() => {});
    setProState({}); PRO_MSG = ""; drawProBox(); drawAiBox(); render(); toast(`${proName()} removed from this phone`); return; }
  if (ds.chipsmore) { CHIPS_ALL = ds.chipsmore === "1"; paintHero(); return; }
  if (ds.collapse) { const k = ds.collapse;
    MINI_OPEN.delete(k);
    S.collapsed = S.collapsed.includes(k) ? S.collapsed.filter(x => x !== k) : [...S.collapsed, k]; save(); render(); return; }
  if (ds.plan === "tomorrow") { VIEW = addDays(today(), 1); openQA("event"); return; }
  if (ds.miniopen) { const k = ds.miniopen; MINI_OPEN.add(k); render();
    const el = document.querySelector(`[data-card="${k}"]`);
    if (el) { const i = el.querySelector("input:not([type=checkbox]), select"); if (i && t.classList.contains("mini-add")) i.focus(); } return; }
  if (ds.goto) { VIEW = addDays(today(), Number(ds.day)); render();
    const c = document.querySelector(`[data-card="${ds.goto}"]`); if (c) c.scrollIntoView({ behavior: "smooth", block: "start" }); return; }
  if (ds.day !== undefined) { const n = Number(ds.day); VIEW = n === 0 ? today() : addDays(VIEW, n); render(); return; }
  if (ds.update) { applyUpdate(); return; }
  if (ds.seen) { S.seenVersion = VERSION; saveLocal(); render(); return; }
  if (ds.tact) { const f = TOAST_ACT; TOAST_ACT = null; if (f) f(); return; }
  if (ds.install && INSTALL_EVT) { INSTALL_EVT.prompt(); INSTALL_EVT.userChoice.finally(() => { INSTALL_EVT = null; drawInstallBox(); render(); }); return; }
  if (ds.del && ds.del.startsWith("occ:")) {            // one day of a repeating event
    snap(); const [, id, day] = ds.del.split(":"); const e = S.events.find(x => x.id === id);
    if (e) { e.skip = [...(e.skip || []), day]; save(); render(); }
    toast("Removed this day", true, { label: "Delete all", act: () => { S.events = S.events.filter(x => x.id !== id); save(); render(); toast("Deleted every repeat", true); } });
    return;
  }
  if (ds.del) { snap(); const [k, id] = ds.del.split(":");
    if (k === "work.shifts") S.work.shifts = S.work.shifts.filter(x => x.id !== id);
    else if (k === "money.spends") S.money.spends = S.money.spends.filter(x => x.id !== id);
    else S[k] = S[k].filter(x => x.id !== id);
    save(); render(); toast("Removed", true); return; }
  if (ds.clock === "in") { S.work.clockIn = new Date().toISOString(); save(); render(); buzz(); toast("Clocked in ✓"); return; }
  if (ds.clock === "out") { const st = new Date(S.work.clockIn), en = new Date();
    snap();
    if (en - st >= 60000) S.work.shifts.push({ id: uid(), day: ymd(st), start: hhmm(st), end: hhmm(en), brk: 0, mins: Math.round((en - st) / 60000) });
    S.work.clockIn = null; save(); render(); buzz(); toast(`Clocked out · ${fmtH((en - st) / 3600000)}`, true); return; }
  if (ds.addfound) { addFound(ds.addfound); return; }
  if (ds.dropfound) { snap(); S.mail.found = S.mail.found.filter(x => x.key !== ds.dropfound); save(); render(); toast("Dismissed", true); return; }
  if (ds.mail === "scan") { scanMail(); return; }
  if (ds.mail === "off") { try { if (MTOKEN && window.google) google.accounts.oauth2.revoke(MTOKEN, () => {}); } catch (e) { /* gone */ }
    MTOKEN = null; S.mail = { on: false, last: null, seen: {}, found: [] }; save(); drawMailBox(); render(); toast("Gmail disconnected"); return; }
  if (ds.tripremove) { snap(); S.trips = S.trips.filter(x => x.id !== ds.tripremove); S.tripSel = null; TRIP_EDIT = null; closeQA(); save(); render(); toast("Trip deleted", true); return; }
  if (ds.notepin) { const n = S.notes.find(x => x.id === ds.notepin); if (n) { n.pinned = !n.pinned; save(); render(); } return; }
  if (ds.data === "export") { exportData(); return; }
  if (ds.data === "import") { document.getElementById("importFile").click(); return; }
  if (ds.data === "erase") { eraseAll(); return; }
  if (ds.forget) { showForget(); return; }
  if (ds.forgetclose) { document.getElementById("forgetSheet").classList.add("hidden"); return; }
  if (ds.perk) { const [tid, pid] = ds.perk.split(":"); const tr = S.trips.find(x => x.id === tid); const x = tr && tr.perks.find(y => y.id === pid);
    if (x) { if (x.unit === "$") { PERK_EDIT = pid; openQA("tperkset"); return; } x.used = Math.min(x.used + 1, x.total || x.used + 1); save(); render(); buzz(); } return; }
  if (ds.perkedit) { PERK_EDIT = ds.perkedit.split(":")[1]; openQA("tperkset"); return; }
  if (ds.portadd) { PORT_EDIT = null; PORT_DAY = ds.portadd; openQA("tport"); return; }
  if (ds.portedit) { PORT_EDIT = ds.portedit; PORT_DAY = null; openQA("tport"); return; }
  if (ds.tripsel) { S.tripSel = ds.tripsel; save(); render(); return; }
  if (ds.triptab) { S.tripTab = ds.triptab; save(); render(); return; }
  if (ds.bagview) { S.bagView = ds.bagview; save(); render(); return; }
  if (ds.bag) { const [tid, iid] = ds.bag.split(":"), tr = S.trips.find(x => x.id === tid), it = tr && ((tr.lists || {}).packing || []).find(x => x.id === iid);
    if (it) { const ks = BAGS.map(b => b[0]); it.bag = ks[(ks.indexOf(bagOf(it)) + 1) % ks.length]; save(); render(); } return; }
  if (ds.sugadd) { const [tid, key] = ds.sugadd.split(":"), tr = S.trips.find(x => x.id === tid), sg = tr && packSuggest(tr).find(x => x.key === key);
    if (sg) { ensureLists(tr); tr.lists.packing.push({ id: uid(), text: sg.text, done: false, bag: sg.bag, why: sg.why }); save(); render(); toast(`Added: ${sg.text}`); } return; }
  if (ds.sugno) { const [tid, key] = ds.sugno.split(":"), tr = S.trips.find(x => x.id === tid);
    if (tr) { tr.sugNo = [...(tr.sugNo || []), key]; save(); render(); } return; }
  if (ds.triplist) { S.tripList = ds.triplist; save(); render(); return; }
  if (ds.tripedit) { TRIP_EDIT = ds.tripedit; openQA("trip", true); return; }
  if (ds.tripqa) { openQA(ds.tripqa); return; }
  if (ds.costpaid) { const [tid, cid] = ds.costpaid.split(":"), tr = S.trips.find(x => x.id === tid), c = tr && (tr.costs || []).find(x => x.id === cid);
    if (c) { c.paid = !c.paid; save(); render(); } return; }
  if (ds.tripdel) { snap(); const [tid, where, id] = ds.tripdel.split(":"); const tr = S.trips.find(x => x.id === tid);
    if (tr) { if (where.startsWith("lists.")) { const k = where.slice(6); tr.lists[k] = tr.lists[k].filter(i => i.id !== id); }
              else tr[where] = tr[where].filter(i => i.id !== id); }
    save(); render(); toast("Removed", true); return; }
  if (ds.pkgdone) { const pk = S.packages.find(x => x.id === ds.pkgdone);
    if (pk) { snap(); pk.delivered = true; pk.deliveredDay = today(); save(); render(); buzz(); toast(`${pk.name} delivered ✓`, true); } return; }
  if (ds.paid) { const b = S.bills.find(x => x.id === ds.paid); const due = b && nextDue(b);
    if (due) { snap(); b.paid = due.slice(0, 7); save(); render(); buzz(); toast(`${b.name} paid ✓`, true); } return; }
  if (ds.delitem) { snap(); const [l, id] = ds.delitem.split(":"); const L = S.lists.find(x => x.id === l);
    if (L) L.items = L.items.filter(i => i.id !== id); save(); render(); toast("Removed", true); return; }
  if (ds.clear) { snap(); const L = S.lists.find(x => x.id === ds.clear); if (L) L.items = L.items.filter(i => !i.done);
    save(); render(); toast("Cleared", true); return; }
  if (ds.dellist) { snap(); S.lists = S.lists.filter(l => l.id !== ds.dellist); S.listSel = (S.lists[0] || {}).id; save(); render(); toast("List deleted", true); return; }
  if (ds.listsel) { S.listSel = ds.listsel; save(); render(); return; }
  if (ds.move) { moveCard(ds.move, ds.dir === "top" ? "top" : Number(ds.dir)); return; }
  if (ds.reset) { S.resetDay = ds.reset === "close" ? today() : null; S.resetAt = ds.reset === "close" ? new Date().toISOString() : null;
    save(); render(); if (ds.reset === "close") { buzz(); toast("Day closed ✓ Sleep well"); } return; }
  if (ds.rdone) { const [k, id] = ds.rdone.split(":"); const x = S[k].find(y => y.id === id); if (x) { snap();
    if (k === "todos") { x.done = true; x.doneDay = today(); } else x.done = true; save(); render(); buzz(); } return; }
  if (ds.rdrop) { snap(); S.todos = S.todos.filter(y => y.id !== ds.rdrop); save(); render(); toast("Dropped", true); return; }
  if (ds.rmove) { snap(); const T1 = addDays(today(), 1);
    const pick = ds.rmove === "all" ? ["loads", "jobs"].flatMap(k => S[k].filter(x => x.day === today() && !x.done)) : [S[ds.rmove.split(":")[0]].find(y => y.id === ds.rmove.split(":")[1])];
    pick.filter(Boolean).forEach(x => { x.day = T1; }); save(); render(); toast(`Moved to tomorrow (${pick.length})`, true); return; }
  if (ds.rmdel) { S.remember = S.remember.filter(r => r.id !== ds.rmdel); save(); render(); return; }
  if (ds.syncall) { syncTap(); return; }
  if (ds.ai === "off") { try { localStorage.removeItem(AI_KEY); } catch (e) { /* ok */ } drawAiBox(); toast("AI helper off — the quick sorter takes over"); return; }
  if (ds.ai === "test") { drawAiBox("testing…"); aiCall("ping", "").then(j => drawAiBox(`working · ${j.left} left today`)).catch(e => drawAiBox("problem: " + e.message)); return; }
  if (ds.fadd) { snap(); const keys = ds.fadd === "__all" ? (S.gcal.dates || []).map(b => b.key) : [ds.fadd];
    const n = addFoundDates(keys); save(); render(); buzz(); toast(`🎂 Added ${n} date${n === 1 ? "" : "s"} — ✏️ to add gift ideas`, true); return; }
  if (ds.fno) { S.gcal.datesNo = [...new Set([...(S.gcal.datesNo || []), ...(S.gcal.dates || []).map(b => b.key)])]; S.gcal.dates = []; saveLocal(); render(); return; }
  if (ds.futok) { S.futureShow = []; saveLocal(); render(); return; }
  if (ds.futedit) { FUTURE_EDIT = ds.futedit; openQA("future", true); return; }
  if (ds.futdel) { snap(); S.future = S.future.filter(f => f.id !== ds.futdel); S.futureShow = S.futureShow.filter(id => id !== ds.futdel); FUTURE_EDIT = null; closeQA(); save(); render(); toast("Note deleted", true); return; }
  if (ds.retdone) { const r = S.returns.find(x => x.id === ds.retdone); if (r) { snap(); r.done = true; r.doneDay = today(); save(); render(); buzz();
    toast(`↩️ Returned ✓${r.amount ? ` — watch for ${money(r.amount)} back` : ""}`, true); } return; }
  if (ds.errands) { if (S.collapsed.includes("errands")) { S.collapsed = S.collapsed.filter(k => k !== "errands"); save(); render(); }
    const el = document.querySelector('[data-card="errands"]'); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); return; }
  if (ds.aledit) { ALARM_EDIT = ds.aledit; openQA("alarm", true); return; }
  if (ds.aldel) { snap(); S.alarms = S.alarms.filter(a => a.id !== ds.aldel); ALARM_EDIT = null; closeQA(); save(); render(); drawAlarmBox(); toast("Alarm removed", true); return; }
  if (ds.ask === "open") { showAsk(); return; }
  if (ds.askclose) { document.getElementById("askSheet").classList.add("hidden"); if (ds.open === "sheet") openSettings(); return; }
  if (ds.askq) { hideSheet("daySheet"); askDayHub(ds.askq); return; }   // v1.02 Port reality asks from the day screen
  if (ds.askmic) { const SR = window.SpeechRecognition || window.webkitSpeechRecognition; const i = document.querySelector("#askSheet input[name=q]");
    if (!SR || !i) { toast("Tap the 🎤 on your keyboard and talk"); return; }
    const r = new SR(); r.lang = navigator.language || "en-US"; r.onresult = e => { i.value = e.results[0][0].transcript; askDayHub(i.value); }; r.start(); t.textContent = "…"; return; }
  if (ds.top3 === "pick") { top3Pick(true); render(); return; }
  if (ds.t3up) { const T = S.top3.items, i = T.findIndex(x => x.id === ds.t3up); if (i > 0) [T[i - 1], T[i]] = [T[i], T[i - 1]]; saveLocal(); render(); return; }
  if (ds.t3del) { S.top3.items = S.top3.items.filter(x => x.id !== ds.t3del); saveLocal(); render(); return; }
  if (ds.setjump) { const el = document.getElementById(ds.setjump); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); return; }   // v0.63
  if (typeof shellClick === "function" && shellClick(ds)) return;           // v0.58 shell.js tabs
  if (typeof cruiseClick === "function" && cruiseClick(ds)) return;          // v0.56 cruise.js
  if (ds.cd) { showReady(); return; }
  if (ds.rg) { showGuard(); return; }
  if (ds.rgclose) { document.getElementById("rgSheet").classList.add("hidden"); return; }
  if (ds.rgmargin) { S.guardMargin = Number(ds.rgmargin); save(); render(); showGuard(); return; }
  if (ds.rgboard) { const tr = curTrip(), pt = tr && (tr.ports || []).find(x => x.id === ds.rgboard);
    if (pt) { snap(); pt.boarded = pt.day; save(); } document.getElementById("rgSheet").classList.add("hidden"); render(); toast("Welcome back on board 🚢", true); return; }
  if (ds.cwx) { S.hidden = S.hidden.filter(x => x !== "weather"); S.collapsed = S.collapsed.filter(x => x !== "weather"); save(); render();
    const el = document.querySelector('[data-card="weather"]'); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); return; }
  if (ds.readyclose) { document.getElementById("readySheet").classList.add("hidden"); return; }
  if (ds.readygo) { document.getElementById("readySheet").classList.add("hidden"); S.tripTab = "ready";
    S.hidden = S.hidden.filter(x => x !== "trips"); S.collapsed = S.collapsed.filter(x => x !== "trips"); save(); render();
    const el = document.querySelector('[data-card="trips"]'); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); return; }
  if (ds.pulse) { showPulse(); return; }
  if (ds.pulseclose) { document.getElementById("pulseSheet").classList.add("hidden"); return; }
  if (ds.pulsego) { document.getElementById("pulseSheet").classList.add("hidden"); const k = ds.pulsego;
    if (S.hidden.includes(k)) S.hidden = S.hidden.filter(x => x !== k); if (S.collapsed.includes(k)) S.collapsed = S.collapsed.filter(x => x !== k);
    save(); render(); const el = document.querySelector(`[data-card="${k}"]`); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); return; }
  if (ds.payedit) { S.payday.freq = null; render(); return; }
  if (ds.goaldel) { snap(); S.goals = S.goals.filter(g => g.id !== ds.goaldel); save(); render(); toast("Goal removed", true); return; }
  if (ds.radd !== undefined) { const p = ROUTINE_PRESETS[Number(ds.radd)]; ROUTINE_OPEN = addRoutine(p[0], p[1], p[2], p[3]).id; save(); render(); buzz();
    toast(`${p[0]} added — ✏️ to change the steps`); return; }
  if (ds.ropen) { const cur = ROUTINE_OPEN || (routineNow() || {}).id;
    ROUTINE_OPEN = t.closest("#hero") ? ds.ropen : cur === ds.ropen ? "none" : ds.ropen;
    if (S.collapsed.includes("routines")) { S.collapsed = S.collapsed.filter(k => k !== "routines"); save(); }
    render(); const el = document.querySelector('[data-card="routines"]'); if (el && t.closest("#hero")) el.scrollIntoView({ behavior: "smooth", block: "start" }); return; }
  if (ds.redit) { ROUTINE_EDIT = ds.redit; openQA("routine", true); return; }
  if (ds.rreset) { delete S.rdone[ds.rreset]; save(); render(); return; }
  if (ds.rdel) { snap(); S.routines = S.routines.filter(r => r.id !== ds.rdel); ROUTINE_EDIT = null; closeQA(); save(); render(); toast("Routine deleted", true); return; }
  if (ds.upreset) { const [a, i] = ds.upreset.split(":"); UPKEEP_EDIT = null; UPKEEP_PRESET = [a, UPKEEP_PRESETS[a][Number(i)]]; openQA("upkeep", true); return; }
  if (ds.upedit) { UPKEEP_EDIT = ds.upedit; UPKEEP_PRESET = null; openQA("upkeep", true); return; }
  if (ds.updone) { const x = S.upkeep.find(y => y.id === ds.updone); if (x) { snap(); x.last = today(); x.next = null; save(); render(); buzz();
    toast(`✓ ${x.name.replace(/^\S+\s/, "")} — next ${prettyDate(upkeepNext(x))}`, true); } return; }
  if (ds.updel) { snap(); S.upkeep = S.upkeep.filter(x => x.id !== ds.updel); UPKEEP_EDIT = null; closeQA(); save(); render(); toast("Deleted", true); return; }
  if (ds.pedit) { PERSON_EDIT = ds.pedit; openQA("person", true); return; }
  if (ds.pgot) { const p = S.people.find(x => x.id === ds.pgot); if (p) { p.got[personNext(p).slice(0, 4)] = true; save(); render(); buzz(); toast("🎁 Got it ✓"); } return; }
  if (ds.pdel) { snap(); S.people = S.people.filter(x => x.id !== ds.pdel); PERSON_EDIT = null; closeQA(); save(); render(); toast("Date deleted", true); return; }
  if (ds.leave) { const c = document.querySelector('[data-card="leave"]');
    if (S.hidden.includes("leave")) { S.hidden = S.hidden.filter(k => k !== "leave"); save(); render(); }
    if (S.collapsed.includes("leave")) { S.collapsed = S.collapsed.filter(k => k !== "leave"); save(); render(); }
    const el = document.querySelector('[data-card="leave"]') || c; if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); return; }
  if (ds.leavedel) { snap(); S.leave.items = S.leave.items.filter(x => x.id !== ds.leavedel); save(); render(); toast("Removed", true); return; }
  if (ds.leavereset) { S.leave.done = []; S.leave.day = today(); save(); render(); return; }
  if (ds.dump) { DUMP = []; openQA("dump"); return; }
  if (ds.dumpsort) { dumpSort(); return; }
  if (ds.mic) { micToggle(t); return; }
  if (ds.ddel !== undefined) { DUMP.splice(Number(ds.ddel), 1); drawDump(); if (!DUMP.length) { const b = document.querySelector("#qaForm > .btn:last-child"); if (b) b.textContent = "Sort it"; } return; }
  if (ds.brief) { if (ds.brief === "go") { S.briefDay = today(); saveLocal(); closeBrief(); render(); }
    else if (ds.brief === "speak") speakBrief(); else showBrief(); return; }
  if (ds.orderreset) { S.order = null; save(); drawCardList(); render(); toast("Standard order back"); return; }
  if (ds.arrange) { openSettings(); setTimeout(() => { const h = document.getElementById("arrangeHead"); if (h) h.scrollIntoView({ behavior: "smooth", block: "start" }); }, 50); return; }
  if (ds.gconnect) { gcalConnect(); return; }
  if (ds.gsync) { gReady() ? gcalFetch().then(gcalPush) : gcalConnect(); return; }
  if (ds.gdisc) { gcalDisconnect(); return; }
  if (ds.ics) { addToPhoneCalendar(ds.ics); return; }
  if (ds.remind) {
    if (ds.remind === "on") remindOn();
    else if (ds.remind === "off") { S.remind.on = false; saveLocal(); drawRemindBox(); toast("Reminders off"); }
    else if (ds.remind === "test") notify("🔔 Day Hub test", "This is what a reminder looks like.", "dh-test");
    return;
  }
  if (ds.sync) {
    const a = ds.sync;
    if (a === "on") syncOn(); else if (a === "now") backupNow(); else if (a === "restore") restoreNow(); else if (a === "off") syncOff();
    else if (a === "use" && CLOUD_PENDING) restoreFrom(CLOUD_PENDING);
    else if (a === "keep") { CLOUD_PENDING = null; backupNow(); }
    return;
  }
});

document.addEventListener("input", e => {
  const t = e.target; if (t.dataset && t.dataset.dtext !== undefined && DUMP[Number(t.dataset.dtext)]) DUMP[Number(t.dataset.dtext)].title = t.value;
  // v0.45: the trip's package list follows the cruise line as it's typed (presets only for their own line).
  if (t.name === "line" && t.form && t.form.id === "qaForm") { const sel = t.form.querySelector("[name=pkg]"); if (!sel) return;
    const keep = sel.value, ks = linePkgs(t.value);
    sel.innerHTML = `<option value="">Custom package (add your own perks)</option>` + ks.map(k => `<option value="${k}">${esc(PACKAGES[k].name)}</option>`).join("");
    sel.value = ks.includes(keep) ? keep : ""; }
});
document.addEventListener("change", e => {
  const t = e.target, ds = t.dataset;
  if (t.id === "importFile" && t.files && t.files[0]) { importData(t.files[0]); t.value = ""; return; }
  if (typeof simpleChange === "function" && simpleChange(ds, t)) return;    // v0.62 shell.js
  if (typeof cruiseChange === "function" && cruiseChange(ds, t)) return;    // v0.56 cruise.js
  if (ds.rgback) { const tr = curTrip(), pt = tr && (tr.ports || []).find(x => x.id === ds.rgback);
    // redraw after this event finishes: redrawing the sheet while its input is still blurring throws
    if (pt) { pt.backMin = Math.max(0, Math.min(240, Number(t.value) || 0)); save(); setTimeout(() => { render(); showGuard(); }, 0); } return; }
  if (ds.fam) { S.family = t.checked; FAM_RAW = null; save(); drawSettings(); render();
    toast(t.checked ? `Linked with ${SIB.name} ✓` : `${APP_NAME} on its own — ${SIB.name} trips hidden`); if (t.checked) famDriveRefresh(); return; }
  if (ds.owner) { setOwnerSwitch(ds.owner, t.checked); drawSettings(); render(); toast(`${ds.owner} ${t.checked ? "on" : "off"} — this phone only`); return; }
  if (ds.dkind !== undefined) { const x = DUMP[Number(ds.dkind)]; x.kind = t.value;
    if (x.kind === "event" && !x.day) { x.day = today(); x.time = "09:00"; x.rep = "none"; } drawDump(); return; }
  if (ds.dday !== undefined) { DUMP[Number(ds.dday)].day = t.value; return; }
  if (ds.dtime !== undefined) { DUMP[Number(ds.dtime)].time = t.value; return; }
  if (t.dataset.briefauto !== undefined) { S.briefAuto = t.checked; saveLocal(); toast(t.checked ? "Morning brief on" : "Morning brief off — ☀️ chip still opens it"); return; }
  if (ds.retchk) { const r = S.returns.find(x => x.id === ds.retchk); if (r) { r.done = t.checked; r.doneDay = today(); save(); render(); buzz(); } return; }
  if (ds.alon) { const a = S.alarms.find(x => x.id === ds.alon); if (a) { a.on = t.checked; save(); render(); } return; }
  if (ds.t3chk) { const x = S.top3.items.find(y => y.id === ds.t3chk); if (x) { x.done = t.checked; saveLocal(); render(); buzz();
    if (S.top3.items.every(y => y.done)) toast("🎯 All three done!"); } return; }
  if (ds.rstep) { const [rid, sid] = ds.rstep.split(":"), r = S.routines.find(x => x.id === rid); if (!r) return;
    const cur = rDone(r), ids = t.checked ? [...new Set([...cur, sid])] : cur.filter(x => x !== sid);
    S.rdone[rid] = { day: today(), ids }; save(); render(); buzz();
    if (!rLeft(r)) toast(`✅ ${r.name.replace(/^\S+\s/, "")} done!`); return; }
  if (ds.leavechk) { if (S.leave.day !== today()) { S.leave.day = today(); S.leave.done = []; }
    S.leave.done = t.checked ? [...new Set([...S.leave.done, ds.leavechk])] : S.leave.done.filter(x => x !== ds.leavechk);
    save(); render(); buzz(); if (!leaveLeft()) toast("✅ All set — have a good day!"); return; }
  if (ds.tick) { const x = S.todos.find(y => y.id === ds.tick); if (x) { x.done = t.checked; x.doneDay = t.checked ? today() : null; } }
  else if (ds.tickl) { const [k, id] = ds.tickl.split(":"); const x = S[k].find(y => y.id === id); if (x) x.done = t.checked; }
  else if (ds.item) { const [l, id] = ds.item.split(":"); const L = S.lists.find(x => x.id === l); const i = L && L.items.find(y => y.id === id); if (i) i.done = t.checked; }
  else if (ds.tverify) { const tr = S.trips.find(x => x.id === ds.tverify); if (tr) tr.accountVerified = t.checked; }
  else if (ds.titem) { const [tid, k, id] = ds.titem.split(":"); const tr = S.trips.find(x => x.id === tid);
    const i = tr && tr.lists[k].find(y => y.id === id); if (i) i.done = t.checked; }
  else if (ds.rset) { S.remind[ds.rset] = Number(t.value); saveLocal(); return; }
  else if (ds.show) { S.hidden = t.checked ? S.hidden.filter(k => k !== ds.show) : [...S.hidden, ds.show]; save(); drawCardList(); render(); return; }
  else return;
  if (t.checked) buzz();
  save(); setTimeout(render, 220);                     // let the check animation play
});

// ------------------------------------------------------------ settings
function openSettings() {
  drawSettings();
  { let j = document.getElementById("setJump");                             // v0.63 tile menu at the top of ⚙
    if (!j) { j = document.createElement("div"); j.id = "setJump"; const head = document.querySelector("#sheet .sheet-head"); head.after(j); }
    drawSetJump(); }
  document.getElementById("sheet").classList.remove("hidden");
}
// v0.63 settings jump tiles (the hub navigation)
function drawSetJump() {
  const g = document.getElementById("setJump"); if (!g) return;
  const want = [["proBox", "⭐", "Pro"], ["remindBox", "🔔", "Reminders"], ["syncBox", "☁️", "Backup"], ["aiBox", "🤖", "AI helper"], ["simpleBox", "👓", "Display"],
    ["famBox", "🌐", "Hub family"], ["installBox", "📲", "Install"], ["cardList", "🗂️", "Cards"], ["dataBox", "💾", "My data"]];
  const items = want.filter(([id]) => { const el = document.getElementById(id); return el && !el.hidden && el.innerHTML.trim(); })
    .map(([id, ic, l]) => ({ icon: ic, label: l, attrs: `data-setjump="${id}"` }));
  g.innerHTML = tileNav(items, 3, "compact");
}
function drawSettings() {
  document.getElementById("setName").value = S.name;
  document.getElementById("setCity").value = S.city;
  document.getElementById("setPack").closest("label").hidden = TRAVEL;   // v0.45: no profession packs in Cruise Hub
  document.getElementById("setPack").innerHTML = Object.entries(PACKS).map(([k, p]) => `<option value="${k}" ${k === S.pack ? "selected" : ""}>${p.label}</option>`).join("");
  drawCardList();
  let db = document.getElementById("dataBox");
  if (!db) { db = document.createElement("div"); db.id = "dataBox"; document.getElementById("cardList").after(db); }
  drawDataBox();
  let ib = document.getElementById("installBox");
  if (!ib) { ib = document.createElement("div"); ib.id = "installBox"; document.getElementById("cardList").before(ib); }
  drawInstallBox();
  let pb = document.getElementById("proBox");
  if (!pb) { pb = document.createElement("div"); pb.id = "proBox"; ib.before(pb); }
  drawProBox();
  let smb = document.getElementById("simpleBox");                           // v0.62 simple mode (shell.js)
  if (!smb) { smb = document.createElement("div"); smb.id = "simpleBox"; document.getElementById("cardList").before(smb); }
  if (typeof drawSimpleBox === "function") drawSimpleBox();
  let fb = document.getElementById("famBox");
  if (!fb) { fb = document.createElement("div"); fb.id = "famBox"; db.before(fb); }
  drawFamBox();
  let ob = document.getElementById("ownerBox");
  if (!ob) { ob = document.createElement("div"); ob.id = "ownerBox"; db.after(ob); }
  drawOwnerBox();
  let mb = document.getElementById("mailBox");
  if (!mb) { mb = document.createElement("div"); mb.id = "mailBox"; document.getElementById("cardList").before(mb); }
  drawMailBox();
  let rb = document.getElementById("remindBox");
  if (!rb) { rb = document.createElement("div"); rb.id = "remindBox"; document.getElementById("cardList").before(rb); }
  drawRemindBox();
  let sb = document.getElementById("syncBox");
  if (!sb) { sb = document.createElement("div"); sb.id = "syncBox"; document.getElementById("cardList").before(sb); }
  drawSyncBox();
  let alb = document.getElementById("alarmBox");
  if (!alb) { alb = document.createElement("div"); alb.id = "alarmBox"; document.getElementById("cardList").before(alb); }
  drawAlarmBox();
  let ab = document.getElementById("aiBox");
  if (!ab) { ab = document.createElement("div"); ab.id = "aiBox"; document.getElementById("cardList").before(ab); }
  drawAiBox();
  let g = document.getElementById("gcalBox");
  if (!g) { g = document.createElement("div"); g.id = "gcalBox"; document.getElementById("cardList").before(g); }
  const ok = S.gcal.connected && S.gcal.scope === GCAL_SCOPE && !S.gcal.needsWrite;
  g.innerHTML = `<h3>Your phone calendar</h3>` + (ok
    ? `<div class="leg"><span>✅ Connected — Day Hub events, bills and shifts go to your phone calendar${S.gcal.pushed ? ` · last sent ${fmtTime(S.gcal.pushed)}` : ""}</span></div>
       <div class="foot-actions"><button class="btn sm" data-gsync="1">Sync now</button><button class="btn sm ghost" data-gdisc="1">Disconnect</button></div>
       <details class="steps"><summary>Not showing on your phone? Check these</summary>${phoneCalSteps()}</details>`
    : `<p class="fine">Puts everything you add in Day Hub on your phone's own calendar, with alarms that ring even when Day Hub is closed. Your phone's events show here too.</p>
       <ol class="steps">
         <li>Tap <b>${S.gcal.connected ? "Reconnect" : "Connect"}</b> below.</li>
         <li>Pick your Google account.</li>
         <li>If you see <i>"Google hasn't verified this app"</i>, tap <b>Continue</b>.</li>
         <li>Tick the <b>calendar</b> box, then tap <b>Allow</b>.</li>
       </ol>
       <button class="btn sm" data-gconnect="1">🗓️ ${S.gcal.connected ? "Reconnect" : "Connect"} Google Calendar</button>
       <details class="steps"><summary>Then, on your phone (one time)</summary>${phoneCalSteps()}</details>`) +
    `<h3 id="arrangeHead">Arrange your screen</h3>
     <p class="fine" style="margin-top:0">▲▼ moves a card one spot · ⤒ puts it at the top · the switch shows or hides it.</p>`;
  document.querySelector("#sheet .sheet-body > h3").style.display = "none";
  document.getElementById("ver").textContent = `Version ${VERSION}.`;
  let lg = document.getElementById("legalLinks");
  if (!lg) { lg = document.createElement("span"); lg.id = "legalLinks"; document.getElementById("ver").after(lg); }
  lg.innerHTML = ` <a href="${new URL("privacy.html", BASE_URL).href}" target="_blank" rel="noopener">Privacy</a> · <a href="${new URL("terms.html", BASE_URL).href}" target="_blank" rel="noopener">Terms</a> · <a href="mailto:${PLAN.CONTACT_EMAIL}">Contact</a>`;
}

// v0.40 - Day Hub Pro (shown only while PRO_GATE is on; everything is free while it's off).
let PRO_MSG = "";
function drawProBox() {
  const g = document.getElementById("proBox"); if (!g) return;
  g.hidden = !switchOn("PRO_GATE"); if (g.hidden) { g.innerHTML = ""; return; }
  const p = proState(), who = p.buyer ? esc(p.buyer) : "";
  // v0.45: Cruise Hub lists only what Cruise Hub has; it is included with Day Hub Pro (one Whop purchase).
  // v0.48: with CRUISE_PASS on, Cruise Hub sells its own Cruise Hub Pass ($9.99/year, every cruise that year).
  // v0.97: Trip Hub has no product of its own yet - Day Hub Pro unlocks it (the relay checks Day Hub Pro for any app but Cruise Hub).
  const what = MODE === "trip"
    ? `<p class="fine" style="margin-top:0">Trip Hub's extras come with ${PLAN.NAME} — one purchase unlocks Day Hub, Cruise Hub and Trip Hub.</p>
       <ul class="pro-list"><li>🤖 Trip Hub AI — things to do, plan tonight, ask about your trip</li><li>🗓️ Your trip and plans on your phone's calendar</li>
       <li>☁️ Backup to your own Google Drive</li></ul>
       <p class="fine" style="margin-top:4px">Everything else — countdown, timeline, payments, packing and documents lists, reservations — is free forever. No ads, ever.</p>`
    : TRAVEL
    ? (cruisePass() ? `<p class="fine" style="margin-top:0"><b>One price for the whole year — plan as many cruises as you like.</b> Already have ${PLAN.NAME}? It includes Cruise Hub: enter that email below.</p>`
      : `<p class="fine" style="margin-top:0">Cruise Hub's extras come with ${PLAN.NAME} — one purchase unlocks Day Hub and Cruise Hub.</p>`) + `
       <ul class="pro-list"><li>🗓️ Your trip, payments and port days on your phone's calendar</li>
       ${switchOn("GMAIL") ? "<li>📬 Your cruise booking found in your email</li>" : ""}<li>☁️ Backup to your own Google Drive</li></ul>
       <p class="fine" style="margin-top:4px">Everything else — countdown, payments, ports and all-aboard alarms, onboard spending, perks, lists, tips — is free forever. No ads, ever.</p>`
    : `<ul class="pro-list"><li>🤖 AI helper — Brain dump, Ask Day Hub, Top 3</li><li>🗓️ Two-way Google Calendar sync</li>
    ${switchOn("GMAIL") ? "<li>📬 Plans found in your email</li>" : ""}<li>☁️ Backup to your own Google Drive</li></ul>
    <p class="fine" style="margin-top:4px">Everything else — every card, reminders, budget, lists, trips — is free forever. No ads, ever.</p>`;
  const price = cruisePass() ? `<p class="fine"><b>${PLAN.CRUISE_YEARLY}</b> — every cruise you take that year.</p>` : `<p class="fine"><b>${PLAN.MONTHLY}</b> or <b>${PLAN.YEARLY}</b>.</p>`;
  const buyUrl = cruisePass() ? PLAN.CRUISE_CHECKOUT_URL : PLAN.WHOP_CHECKOUT_URL;
  g.innerHTML = `<h3>⭐ ${proName()}</h3>` + (ownerPhone()
    ? `<div class="leg"><span>✅ Pro — this is the owner's phone</span></div>`
    : proViaDayHub()
    ? `<div class="leg"><span>✅ Included with your ${PLAN.NAME} on this phone</span></div>`
    : isPro()
    ? `<div class="leg"><span>✅ ${p.product === "dayhub" && cruisePass() ? `Included with ${PLAN.NAME}` : `${proName()} is on`} · ${who} · checked ${prettyDate(ymd(new Date(p.checked)))}</span></div>
       <div class="foot-actions"><button class="btn sm ghost" data-pro="check">Check now</button><button class="btn sm ghost" data-pro="remove">Remove from this phone</button></div>
       <p class="fine" style="margin-top:6px">One purchase works on up to ${PLAN.MAX_PHONES} phones. Removing it here frees this phone's spot.</p>`
    : what + price +
      (buyUrl ? `<a class="btn sm" href="${esc(buyUrl)}" target="_blank" rel="noopener">Get ${proName()}</a>`
        : `<p class="fine">Coming soon.</p>`) +
      `<ol class="steps"><li>Buy ${proName()} on Whop.</li><li>Enter the <b>email you used on Whop</b> below and tap <b>Unlock</b>.</li></ol>
       <form class="inline-add" data-proform="1"><input name="key" type="text" inputmode="email" autocapitalize="off" spellcheck="false" placeholder="Email you used on Whop" value="${who}" autocomplete="email" required><button class="btn sm">Unlock</button></form>
       <p class="fine" style="margin-top:6px">Bought with a different sign-in? Your Whop membership id (starts with <b>mem_</b>, on your Whop purchase page) works too. Works on up to ${PLAN.MAX_PHONES} phones.</p>`) +
    (PRO_MSG ? `<p class="fine" style="margin-top:6px">${esc(PRO_MSG)}</p>` : "");
}
function unlockPro(buyer) {
  PRO_MSG = "Checking…"; drawProBox();
  verifyPro(buyer).then(ok => { const st = proState().status || "";
      PRO_MSG = ok ? "" : /phones/.test(st) ? `It's already on ${PLAN.MAX_PHONES} phones — tap Remove from this phone on one of them, then try again.`
        : `No active ${cruisePass() ? `${PLAN.CRUISE_NAME} or ${PLAN.NAME}` : PLAN.NAME} found for that — use the email you bought with on Whop (or your mem_ membership id).`;
      drawProBox(); drawAiBox(); render();
      if (ok) toast(`⭐ ${proName()} unlocked`); })
    .catch(e => { PRO_MSG = "Couldn't reach the check — try again in a minute. (" + e.message + ")"; drawProBox(); });
}

// v0.40 - Owner switches: tap the version line 7 times. Flips a switch on THIS
// phone only, to try a feature before it goes on for everyone (features.js).
let OWNER_OPEN = false, VER_TAPS = [];
const OWNER_ROWS = [["PRO_GATE", "Pro gate — free vs Pro"], ["AI_PUBLIC", "AI for Whop-key holders"], ["GMAIL", "Gmail → plans"],
  ["STORE", "Google Play link"], ["CRUISE_PASS", "Cruise Hub Pass ($9.99/yr)"], ["OWNER", "Count this phone as Pro"]];
// v0.46 HUB FAMILY (Scott 10/4): separate apps that work together. The steps
// are in the box (Scott 10/2: every setting carries its own easy setup).
function drawFamBox() {
  const g = document.getElementById("famBox"); if (!g) return;
  const sd = S.family ? sibData() : null, n = sd ? sd.trips.length : 0;
  const state = !S.family ? `Off — ${APP_NAME} keeps to itself.`
    : sd && sd.src === "phone" ? `✓ Linked — ${SIB.name} is on this phone${n ? ` (${n} trip${n === 1 ? "" : "s"})` : ""}.`
    : sd ? `✓ Linked through your Google Drive backup${n ? ` (${n} trip${n === 1 ? "" : "s"} from ${SIB.name})` : ""}.`
    : `Waiting for ${SIB.name}.`;
  g.innerHTML = `<h3>${SIB.icon} Hub family</h3>
    <ul class="card-list"><li><span>See my ${SIB.name} trips here</span><input type="checkbox" data-fam="1" ${S.family ? "checked" : ""} aria-label="Link with ${SIB.name}"></li></ul>
    <p class="fine" style="margin-top:6px"><b>${state}</b> ${APP_NAME} and ${SIB.name} are separate apps that work together: a trip planned in one shows in the other's schedule, morning brief, reminders and bills. Each app keeps its own data — ${APP_NAME} never changes ${SIB.name}'s. One Pro purchase unlocks both.</p>
    ${S.family && !(sd && sd.src === "phone") ? `<p class="fine"><b>Phone that keeps each app apart (iPhone)? Link through backup (Pro):</b></p>
      <ol class="steps"><li>Here in ${APP_NAME}: ⚙ → <b>Backup & sync</b> → <b>Back up to my Google Drive</b>.</li>
      <li>Open ${SIB.name} → ⚙ → <b>Backup & sync</b> → the same button, the <b>same Google account</b>.</li>
      <li>Done — each app shows the other's trips after its next backup.</li></ol>` : ""}
    <a class="btn sm ghost" href="${esc(SIB.url)}" data-famopen="1">Open ${SIB.name}</a>
    <h3 style="margin-top:14px">More from the Hub family</h3>${hubRows()}`;
}
function drawOwnerBox() {
  const g = document.getElementById("ownerBox"); if (!g) return;
  g.hidden = !OWNER_OPEN; if (g.hidden) { g.innerHTML = ""; return; }
  const o = ownerSwitches();
  g.innerHTML = `<h3>🔧 Owner switches</h3><p class="fine" style="margin-top:0">This phone only. Turning one on for everyone is a change in features.js.</p>
    <ul class="card-list">${OWNER_ROWS.map(([k, l]) => `<li><span>${l}${SWITCHES[k] ? " <span class=\"tag\">on for everyone</span>" : ""}</span>
      <input type="checkbox" data-owner="${k}" ${SWITCHES[k] || o[k] ? "checked" : ""} ${SWITCHES[k] ? "disabled" : ""} aria-label="${l}"></li>`).join("")}</ul>`;
}

// Setup steps for the PHONE side (Scott 10/2: settings make setup as easy as
// possible). Shows this phone's steps first; the other kind is one tap away.
function phoneCalSteps() {
  const samsung = `<b>Samsung / Android</b><ol>
    <li>Open your phone's <b>Settings</b> → <b>Accounts and backup</b> → <b>Manage accounts</b>.</li>
    <li>Tap your Google account → <b>Sync account</b> → turn <b>Calendar</b> on.</li>
    <li>Open the <b>Calendar</b> app → ☰ menu → <b>Manage calendars</b> → make sure your Google calendar is ticked.</li></ol>`;
  const iphone = `<b>iPhone</b><ol>
    <li>Open <b>Settings</b> → <b>Calendar</b> → <b>Accounts</b> → <b>Add Account</b> → <b>Google</b>.</li>
    <li>Sign in, then turn <b>Calendars</b> on → <b>Save</b>.</li></ol>`;
  return `${isIOS() ? iphone + samsung : samsung + iphone}
    <p class="fine">Test it: add any event in Day Hub — within a minute it's in your phone's calendar.
    Google lets Day Hub stay signed in for about an hour; after that, changes wait for one tap on <b>🔄 Sync Google Calendar</b>.</p>`;
}
function drawCardList() {
  document.getElementById("cardList").innerHTML = cardOrder().map(k => `<li><span>${CARDS[k].icon} ${CARDS[k].title}</span>
    <button class="x" data-move="${k}" data-dir="top" aria-label="Move to top">⤒</button>
    <button class="x" data-move="${k}" data-dir="-1" aria-label="Move up">▲</button>
    <button class="x" data-move="${k}" data-dir="1" aria-label="Move down">▼</button>
    <input type="checkbox" data-show="${k}" ${S.hidden.includes(k) ? "" : "checked"} aria-label="Show ${CARDS[k].title}"></li>`).join("") +
    (S.order ? `<li class="reset-order"><button class="btn sm ghost" data-orderreset="1">Back to the standard order</button></li>` : "");
}
function moveCard(k, dir) {
  const o = cardOrder(); const i = o.indexOf(k);
  if (dir === "top") { o.splice(i, 1); o.unshift(k); }
  else { const j = i + Number(dir); if (j < 0 || j >= o.length) return; [o[i], o[j]] = [o[j], o[i]]; }
  S.order = o; save(); drawCardList(); render();
}
function closeSettings() {
  const city = document.getElementById("setCity").value.trim();
  const pack = document.getElementById("setPack").value;
  const changed = city !== S.city || pack !== S.pack;
  S.name = document.getElementById("setName").value.trim();
  S.city = city; S.pack = pack; save();
  document.getElementById("sheet").classList.add("hidden");
  if (changed) WXDATA = null;
  render();
  if (changed) loadWeather();
}

// --------------------------------------------------------------- start
S = load();
loadTokens();
takeRedirectToken();
const RENEWING = autoRenew();                                   // hops to Google and straight back
// If saved data still breaks the first draw, never leave a blank screen with
// the Erase button out of reach: offer to save the raw data, then start fresh.
try { render(); }
catch (e) {
  console.warn("Day Hub could not draw saved data", e);
  document.getElementById("cards").innerHTML = `<section class="card"><h3>Something in your saved data won't open</h3><div class="body">
    <p>Save a copy first, then start fresh. Nothing is erased until you tap Start fresh.</p>
    <div class="foot-actions"><button class="btn sm" id="bootSave">Save a copy</button><button class="btn sm ghost" id="bootReset">Start fresh</button></div></div></section>`;
  document.getElementById("bootSave").onclick = () => { const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([localStorage.getItem(STORE) || ""], { type: "application/json" }));
    a.download = `${APP_ID}-saved-data.json`; document.body.appendChild(a); a.click(); };
  document.getElementById("bootReset").onclick = () => { S = blank(); saveLocal(); location.reload(); };
}
loadWeather();
recheckPro();
document.getElementById("ver").addEventListener("click", () => {
  const now = Date.now(); VER_TAPS = VER_TAPS.filter(x => now - x < 4000).concat(now);
  if (VER_TAPS.length >= 7) { VER_TAPS = []; OWNER_OPEN = !OWNER_OPEN; drawOwnerBox();
    if (OWNER_OPEN) document.getElementById("ownerBox").scrollIntoView({ behavior: "smooth", block: "center" }); }
});
setInterval(tick, 10000);
// v0.61: show / clear the Offline pill the moment the connection changes
window.addEventListener("online", () => { render(); loadWeather(); });
window.addEventListener("offline", () => render());
// Once a minute: move the NOW line and the chips - unless someone is typing.
setInterval(() => { const a = document.activeElement;
  if (!a || !/INPUT|SELECT|TEXTAREA/.test(a.tagName)) render(); }, 60000);
setInterval(loadWeather, 30 * 60000);
setInterval(checkReminders, 30000);
checkUpdate();
setInterval(checkUpdate, 30 * 60000);
setInterval(() => { if (S.mail.on && mReady()) scanMail(); }, 20 * 60000);
checkReminders();
if (!RENEWING) { syncOnOpen(true); maybeBrief(); }
document.addEventListener("visibilitychange", () => { if (!document.hidden) { if (autoRenew()) return; recheckPro(); VIEW = today(); render(); checkReminders(); syncOnOpen(); maybeBrief(); } });
if ("serviceWorker" in navigator) navigator.serviceWorker.register(new URL("sw.js", HOME_URL)).catch(() => {});
