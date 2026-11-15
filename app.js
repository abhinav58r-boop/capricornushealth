'use strict';
/* VitalOrbit: astronaut health monitor. Vanilla JS + Chart.js. Data stays in localStorage. */
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const KEY = 'vitalorbit.v1', LV = ['ok', 'warn', 'crit'], LN = ['Normal', 'Caution', 'Critical'];
const iso = (d = new Date()) => new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } };
const save = h => { try { localStorage.setItem(KEY, JSON.stringify(h.sort((a, b) => (a.date < b.date ? -1 : 1)))); } catch {} };
const avg = (a, k) => a.reduce((t, x) => t + x[k], 0) / a.length;
const hi = (v, w, c) => (v >= c ? 2 : v >= w ? 1 : 0), lo = (v, w, c) => (v <= c ? 2 : v <= w ? 1 : 0);

/* Metrics: key, label, unit, input limits, normal band (used for charts and display) */
const F = [
  { k: 'hr', l: 'Resting heart rate', u: 'bpm', min: 30, max: 200, step: 1, b: [50, 100] },
  { k: 'sys', l: 'Systolic BP', u: 'mmHg', min: 70, max: 220, step: 1, b: [100, 130] },
  { k: 'dia', l: 'Diastolic BP', u: 'mmHg', min: 40, max: 140, step: 1, b: [60, 85] },
  { k: 'glu', l: 'Blood glucose', u: 'mg/dL', min: 40, max: 400, step: 1, b: [80, 140] },
  { k: 'temp', l: 'Body temperature', u: '°C', min: 34, max: 41, step: 0.1, b: [36.1, 37.5] },
  { k: 'sleep', l: 'Sleep', u: 'h', min: 0, max: 14, step: 0.5, b: [7, 9] },
  { k: 'mood', l: 'Mood (1 low to 5 high)', u: '/5', min: 1, max: 5, step: 1, b: [3, 5] },
  { k: 'fat', l: 'Fatigue (1 low to 10 high)', u: '/10', min: 1, max: 10, step: 1, b: [1, 5] },
  { k: 'ex', l: 'Exercise countermeasures', u: 'min', min: 0, max: 300, step: 1, b: [90, 180] },
  { k: 'h2o', l: 'Water intake', u: 'L', min: 0, max: 6, step: 0.1, b: [2, 3.5] },
  { k: 'rad', l: 'Radiation dose (dosimeter)', u: 'mSv', min: 0, max: 20, step: 0.01, b: [0.3, 0.8] },
];
const SYS = {
  cardio: { n: 'Cardiovascular', m: ['hr', 'sys', 'dia'], tip: 'Alternate treadmill intervals with resistive work, do lower-body negative pressure sessions per protocol, and take 0.5 to 1 L of fluid with salt as prescribed.' },
  msk: { n: 'Musculoskeletal', m: ['ex'], tip: 'Complete a resistive session (squats, deadlifts, heel raises) plus 30 min aerobic work. Confirm calcium and vitamin D intake with your flight surgeon.' },
  neuro: { n: 'Neurological and sleep', m: ['sleep', 'mood', 'fat'], tip: 'Keep a fixed 8 h sleep window, dim blue light for an hour before bed, do 10 min of paced breathing, and call a crewmate or family.' },
  meta: { n: 'Metabolic', m: ['glu', 'temp', 'h2o'], tip: 'Eat a balanced meal with protein, drink 250 mL of water every hour, and recheck glucose and temperature in 30 min.' },
};
SYS.rad = { n: 'Radiation exposure', m: ['rad'], tip: 'Check your dosimeter daily, watch for solar activity alerts, and rest in the best-shielded area during storms. Review cumulative dose with your flight surgeon.' };
/* Rule table: [system, metric, level function, alert title, recommended action] */
const RULES = [
  ['cardio', 'hr', e => Math.max(hi(e.hr, 101, 120), lo(e.hr, 54, 44)), 'Resting heart rate out of range', 'Sit and rest 15 min, drink 500 mL water, then re-measure. Skip max-effort exercise until it normalizes.'],
  ['cardio', 'sys', e => Math.max(hi(e.sys, 130, 160), hi(e.dia, 85, 100), lo(e.sys, 100, 89)), 'Blood pressure out of range', 'Re-measure after 5 min of rest. If high, cut sodium and do light aerobic work. If low, fluid-load 0.5 to 1 L and stand up slowly.'],
  ['meta', 'glu', e => Math.max(hi(e.glu, 141, 181), lo(e.glu, 79, 69)), 'Blood glucose out of range', 'If low, take 15 g fast carbohydrate and recheck in 15 min. If high, drink water, take a light walk or treadmill session, and recheck.'],
  ['meta', 'temp', e => Math.max(hi(e.temp, 37.6, 38), lo(e.temp, 36, 35)), 'Body temperature out of range', 'Hydrate, check cabin temperature and clothing, and re-measure in 30 min. Report any fever with other symptoms.'],
  ['meta', 'h2o', e => lo(e.h2o, 1.9, 1.2), 'Low hydration', 'Drink 500 mL now, then 250 mL every hour until you reach 2.5 L. Low fluid worsens fluid-shift symptoms.'],
  ['neuro', 'sleep', e => lo(e.sleep, 6.4, 4.9), 'Short sleep', 'Protect an 8 h window tonight: dim lights, no screens for an hour, cool cabin, earplugs and eye mask. Defer non-critical tasks.'],
  ['neuro', 'mood', e => lo(e.mood, 2, 1), 'Low mood', 'Schedule a private family or psychological conference and join a crew meal. Reaching out early is a mission skill.'],
  ['neuro', 'fat', e => hi(e.fat, 7, 9), 'High fatigue', 'Take a 20 min rest break, eat and drink, and reduce workload. Persistent fatigue can signal sleep debt or overtraining.'],
  ['msk', 'ex', e => lo(e.ex, 59, 19), 'Exercise below target', 'Add a resistive session today (squats, deadlifts, heel raises). Skipped load speeds up bone and muscle loss.'],
  ['rad', 'rad', e => hi(e.rad, 0.8, 2), 'Elevated radiation dose', 'Move to the shielded area or storm shelter, check solar-activity alerts, postpone EVA, and tell the ground team. Log any nausea or unusual fatigue.'],
];

/* Pattern detection across the last few days */
function trends(h) {
  const T = [], l = h.slice(-3), m = h.slice(-5);
  const P = (s, lv, t, v, act) => T.push({ s, lv, t, v, act, trend: 1 });
  const up = k => (l.length === 3 && l[0][k] < l[1][k] && l[1][k] < l[2][k] ? l[2][k] - l[0][k] : 0);
  if (l.length === 3 && avg(l, 'sleep') < 6.5) P('neuro', 1, 'Sleep debt building', `3-day average ${avg(l, 'sleep').toFixed(1)} h`, 'Move bedtime earlier, avoid caffeine late in the shift, and ask the flight surgeon about a sleep-aid plan.');
  if (up('hr') >= 8) P('cardio', 1, 'Resting heart rate rising 3 days', `+${up('hr')} bpm`, 'Check hydration and exercise load. A steady rise can mean dehydration, deconditioning or early infection. Report if it continues.');
  if (up('sys') >= 10) P('cardio', 1, 'Systolic pressure rising 3 days', `+${up('sys')} mmHg`, 'Review sodium intake and stress, and add aerobic work. Share the trend with the ground team.');
  if (l.length === 3 && l.every(x => x.mood <= 2)) P('neuro', 2, 'Behavioral health: low mood for 3 days', 'Mood 2/5 or lower', 'Request a private psychological conference with ground support today.');
  if (m.length === 5 && avg(m, 'ex') < 60) P('msk', 1, 'Bone and muscle risk: low exercise', `5-day average ${Math.round(avg(m, 'ex'))} min`, 'Re-commit to daily resistive and aerobic sessions. Target 90 min or more per day.');
  return T;
}
function evaluate(h) {
  const e = h[h.length - 1], A = [], S = { cardio: 0, msk: 0, neuro: 0, meta: 0, rad: 0 };
  if (!e) return { e, A, S };
  RULES.forEach(([s, k, fn, t, act]) => {
    const lv = fn(e);
    if (lv) A.push({ s, lv, t, v: k === 'sys' ? `${e.sys}/${e.dia} mmHg` : `${e[k]} ${F.find(f => f.k === k).u}`, act });
  });
  trends(h).forEach(a => A.push(a));
  A.forEach(a => (S[a.s] = Math.max(S[a.s], a.lv)));
  return { e, A: A.sort((a, b) => b.lv - a.lv), S };
}

/* Gamification */
function streak(h) {
  const d = new Set(h.map(e => e.date)), c = new Date();
  if (!d.has(iso(c))) c.setDate(c.getDate() - 1);
  let n = 0;
  while (d.has(iso(c))) { n++; c.setDate(c.getDate() - 1); }
  return n;
}
const BADGES = [
  ['🚀', 'First log', 'Save your first entry', h => h.length >= 1],
  ['🔥', '3-day streak', 'Log 3 days in a row', (h, s) => s >= 3],
  ['🌟', '7-day streak', 'Log 7 days in a row', (h, s) => s >= 7],
  ['🏆', '14-day streak', 'Log 14 days in a row', (h, s) => s >= 14],
  ['😴', 'Sleep master', '5 nights of 7 h or more', h => h.filter(e => e.sleep >= 7).length >= 5],
  ['🦴', 'Iron bones', '5 days of 90 min or more exercise', h => h.filter(e => e.ex >= 90).length >= 5],
  ['💧', 'Hydration hero', '5 days of 2 L or more water', h => h.filter(e => e.h2o >= 2).length >= 5],
  ['🟢', 'All green', 'Latest log: every system normal', (h, s, R) => !!R.e && Object.values(R.S).every(v => !v)],
];

/* Rendering */
let sel = 'cardio', tab = 'dash', metric = 'hr', link = 'leo', vc, wc, R;
const BD = ['', 'border-yellow-500', 'border-red-500'];

function render() {
  const h = load(); R = evaluate(h);
  const top = R.e ? Math.max(...Object.values(R.S)) : -1;
  $('#overall').className = 'pill ' + (R.e ? LV[top] : 'none');
  $('#overall').textContent = R.e ? 'Overall: ' + LN[top] : 'No data yet';
  $$('#body [data-sys]').forEach(el => el.setAttribute('class', 'zone ' + (R.e ? LV[R.S[el.dataset.sys]] : 'none') + (el.dataset.sys === sel ? ' sel' : '')));
  renderBanner(h); renderHero(h); renderGround(h); renderDetail(); renderAlerts(); renderRewards(h);
  if (tab === 'log') charts(h);
}
const TIPS = [
  'Drink a full glass of water with each meal. Thirst can be a weak signal in microgravity.',
  'Finish every resistive session. Even a short one loads your bones.',
  'Keep a fixed sleep window. Your body clock sees 16 sunrises a day.',
  'Talk to someone outside your work today. Connection protects mood.',
  'Check your dosimeter and solar alerts before planning EVA or long tasks.',
  'Stretch your back and hips. The spine lengthens in microgravity and can ache.',
  'Eat enough. Appetite can drop in orbit, and under-eating speeds bone and muscle loss.',
];
const mlv = k => { const r = RULES.find(x => x[1] === (k === 'dia' ? 'sys' : k)); return r && R.e ? r[2](R.e) : 0; };
function renderBanner(h) {
  const today = h.some(e => e.date === iso()), top = R.A[0], s = streak(h), miss = R.e && !today;
  const c = !R.e ? 'none' : top ? LV[top.lv] : 'ok';
  const msg = !R.e ? '👋 Welcome aboard. Load the demo or save your first check-in to start monitoring.'
    : top && top.lv > 1 ? `🚨 Critical: ${top.t} (${top.v}). ${top.act}`
    : top ? `⚠️ Caution: ${R.A.length} item${R.A.length > 1 ? 's' : ''} to watch. Top: ${top.t} (${top.v}).`
    : '✅ All systems nominal. Great work, crew.';
  const btn = (go, t) => `<button class="btn2 !py-1" data-go="${go}">${t}</button>`;
  $('#banner').innerHTML = `<div class="banner ${c}"><span>${msg}${miss ? ` <b>Today's check-in is missing${s ? `: log now to protect your ${s}-day streak` : ''}.</b>` : ''}</span>
    <span class="flex gap-2">${top ? btn('adv', 'View advice') : ''}${miss ? btn('log', 'Log now') : ''}</span></div>`;
  $$('#banner [data-go]').forEach(b => (b.onclick = () => show(b.dataset.go)));
  $('[data-tab=adv]').innerHTML = 'Early warning' + (R.A.length ? ` <span class="pill ${R.A[0].lv > 1 ? 'crit' : 'warn'} !px-2 !py-0">${R.A.length}</span>` : R.e ? ' <span class="pill ok !px-2 !py-0">✓</span>' : '');
}
function renderHero(h) {
  let html;
  if (!R.e) {
    html = `<div class="flex flex-wrap items-center gap-6">
      <div class="min-w-[16rem] flex-1"><h2 class="!text-2xl">Catch health changes before they become problems</h2>
      <p>Log vitals in under a minute, watch trends build over weeks in orbit, and get clear next steps when something drifts, even when the ground is minutes away.</p></div>
      <div class="flex flex-col gap-2"><button class="btn !px-6 !py-3 !text-base" data-go="demo">Start with a 14-day demo mission</button>
      <button class="btn2" data-go="log">Log today's check-in</button></div></div>`;
  } else {
    const sc = Math.max(0, 100 - R.A.reduce((t, a) => t + (a.lv > 1 ? 22 : 8), 0)), tone = sc >= 85 ? 'ok' : sc >= 60 ? 'warn' : 'crit', top = R.A[0];
    const tc = { ok: 'text-green-400', warn: 'text-yellow-300', crit: 'text-red-400' }[tone], today = h.some(e => e.date === iso());
    const good = F.filter(f => R.e[f.k] != null && mlv(f.k) === 0).length;
    const strip = [...Array(7)].map((_, i) => { const d = new Date(); d.setDate(d.getDate() - 6 + i); const k = iso(d), on = h.some(e => e.date === k); return `<span class="dot ${on ? 'ok' : i === 6 ? 'warn' : 'crit'}" title="${k}">${on ? '✓' : i === 6 ? '!' : '✕'}</span>`; }).join('');
    html = `<div class="flex flex-wrap items-center gap-6">
      <div class="ring ${tone}" style="--p:${sc * 3.6}deg" role="img" aria-label="Readiness score ${sc} out of 100"><b>${sc}</b><span>readiness</span></div>
      <div class="min-w-[16rem] flex-1"><h2 class="!text-xl ${tc}">${sc >= 85 ? 'Mission ready: all systems stable' : sc >= 60 ? 'Monitor closely: some readings need attention' : 'Action needed: follow the advisor now'}</h2>
      <p>${top ? `<b>Next best action (${SYS[top.s].n}):</b> ${top.act}` : 'Nothing needs fixing today. Keep your routine and log again tomorrow.'}</p>
      <p class="mt-2 !text-xs !text-sky-300">💡 Mission tip: ${TIPS[new Date().getDate() % TIPS.length]}</p>
      <div class="mt-3 flex flex-wrap items-center gap-1"><span class="mr-1 text-xs text-slate-400">Last 7 check-ins</span>${strip}</div></div>
      <div class="flex gap-2 text-center"><div class="stat"><b class="text-green-400">${good}/${F.length}</b>in range</div>
      <div class="stat"><b class="${R.A.length ? 'text-red-400' : 'text-green-400'}">${R.A.length}</b>active alerts</div>
      <div class="stat"><b class="text-orange-400">${streak(h)}</b>day streak</div></div></div>
      <div class="mt-4 flex flex-wrap gap-2">${today ? '' : `<button class="btn" data-go="log">Log today's check-in</button>`}<button class="btn2" data-go="demo">Reload demo</button><button class="btn-danger" data-go="clear">⚠ Clear data</button></div>`;
  }
  $('#hero').innerHTML = html;
  $$('#hero [data-go]').forEach(b => (b.onclick = () => ({ demo: seed, clear: () => $('#clr').click() }[b.dataset.go] || (() => show('log')))()));
}
const LINKS = { leo: ['Low Earth orbit (ISS)', 0.05], moon: ['Moon', 1.3], mars: ['Mars (average distance)', 780] };
const fmt = s => (s < 1 ? s.toFixed(2) + ' s' : s < 60 ? s.toFixed(1) + ' s' : Math.round(s / 60) + ' min');
function renderGround(h) {
  const d = LINKS[link][1], el = $('#tab-ground');
  const out = (k, v) => { const b = F.find(f => f.k === k).b; return v != null && (v < b[0] || v > b[1]); };
  el.innerHTML = `<div class="card"><div class="flex flex-wrap items-center gap-3"><h2 class="!mb-0">Ground station: flight surgeon view</h2>
    <label class="ml-auto !mb-0 flex items-center gap-2">Crew location <select id="link">${Object.entries(LINKS).map(([k, [n]]) => `<option value="${k}" ${k === link ? 'selected' : ''}>${n}</option>`).join('')}</select></label></div>
    <p class="mt-2">Round-trip signal delay: <b>${fmt(d * 2)}</b>. ${d > 60 ? 'The ground cannot answer in real time here, so the on-board advisor has to guide the first steps.' : 'The ground can respond quickly, and these early warnings help prioritize calls.'}</p></div>` +
    (!R.e ? '<div class="card"><p>No telemetry yet. Save a log or load the demo to see the downlink packet.</p></div>' : `
    <div class="card"><h3>Downlink packet (simulated)</h3>
    <div class="mb-3 flex flex-wrap gap-2">${Object.keys(SYS).map(k => `<span class="pill ${LV[R.S[k]]}">${SYS[k].n}: ${LN[R.S[k]]}</span>`).join('')}</div>
    ${R.A.length ? R.A.slice(0, 4).map(a => `<p class="mb-1"><b class="${a.lv > 1 ? 'text-red-300' : 'text-yellow-300'}">${a.t}</b> (${a.v})</p>`).join('') : '<p>No active alerts.</p>'}
    <div class="mt-3 flex flex-wrap items-center gap-3"><button id="tx" class="btn">Transmit health packet</button><span id="txs" class="text-sm text-slate-300"></span></div></div>
    <div class="card overflow-x-auto"><h3>Last 7 days (highlighted = outside normal range)</h3><table class="w-full text-sm"><tr><th class="!text-left">Date</th>${F.map(f => `<th title="${f.l} (${f.u})">${f.k}</th>`).join('')}</tr>
    ${h.slice(-7).map(e => `<tr><td class="!text-left">${e.date.slice(5)}</td>${F.map(f => `<td class="${out(f.k, e[f.k]) ? 'cell' : ''}">${e[f.k] ?? '–'}</td>`).join('')}</tr>`).join('')}</table></div>`);
  $('#link').onchange = ev => { link = ev.target.value; renderGround(h); };
  const tx = $('#tx');
  if (tx) tx.onclick = () => {
    $('#txs').textContent = `Transmitting. One-way delay ${fmt(d)} (the demo replays this in 2 s).`;
    setTimeout(() => {
      const t = R.A[0];
      $('#txs').innerHTML = `✅ Received by ground at ${new Date().toLocaleTimeString()}. <b>Flight surgeon note (simulated):</b> ${t ? `Reviewed "${t.t}". Follow the on-board advice, re-check within 24 h, and call if it persists.` : 'No concerns. Continue the routine and keep logging.'}`;
      toast('Health packet acknowledged by ground');
    }, 2000);
  };
}
function renderDetail() {
  const c = SYS[sel], lv = R.S[sel], al = R.A.filter(a => a.s === sel);
  $('#detail').innerHTML = `
    <div class="flex items-center justify-between"><h2>${c.n}</h2><span class="pill ${R.e ? LV[lv] : 'none'}">${R.e ? LN[lv] : 'No data'}</span></div>
    <div class="mb-4 grid grid-cols-3 gap-2">${c.m.map(k => { const f = F.find(x => x.k === k); return `
      <div class="tile ${R.e ? LV[mlv(k)] : 'none'}"><div class="text-xs text-slate-400">${f.l} ${R.e ? ['✓', '⚠️', '🚨'][mlv(k)] : ''}</div>
      <div class="text-lg font-semibold">${R.e ? R.e[k] : '–'} <span class="text-xs text-slate-500">${f.u}</span></div>
      <div class="text-xs text-slate-500">normal ${f.b[0]} to ${f.b[1]}</div></div>`; }).join('')}</div>
    ${!R.e ? '<p>Save a daily log (or load the demo data) to color the body map.</p>' : al.length
      ? al.map(a => `<p class="mb-2"><b class="${a.lv > 1 ? 'text-red-300' : 'text-yellow-300'}">${a.t}</b> (${a.v}). ${a.act}</p>`).join('')
      : '<p class="mb-2">Everything in this system is within range today.</p>'}
    ${sel === 'rad' && R.e ? `<p class="mb-2">Cumulative logged dose: <b>${load().reduce((t, e) => t + (e.rad || 0), 0).toFixed(1)} mSv</b>. A solar particle event can spike the daily dose.</p>` : ''}
    <h3 class="mt-4">Standing countermeasures</h3><p>${c.tip}</p>`;
}
function renderAlerts() {
  const good = R.e ? F.filter(f => R.e[f.k] != null && mlv(f.k) === 0) : [];
  $('#alerts').innerHTML = !R.e ? '<div class="card"><p>Save your first daily log to activate the advisor.</p></div>'
    : (R.A.length ? R.A.map(a => `<div class="card al ${LV[a.lv]}">
        <div class="flex flex-wrap items-center gap-2"><span class="pill ${LV[a.lv]}">${a.lv > 1 ? '🚨' : '⚠️'} ${LN[a.lv]}</span><b>${SYS[a.s].n}: ${a.t}</b><span class="text-sm opacity-80">${a.v}</span></div>
        <p class="mt-2">💡 ${a.act}</p>
        ${a.lv > 1 ? '<p class="mt-2 !text-xs !text-red-300">📡 Auto-queued for flight surgeon downlink (simulated)</p>' : ''}</div>`).join('')
      : '<div class="card al ok"><p>✅ All systems nominal. Keep up your exercise, hydration and sleep routine.</p></div>')
    + (good.length ? `<div class="card al ok"><h3 class="text-green-400">✓ Going well (${good.length})</h3><div class="flex flex-wrap gap-2">${good.map(f => `<span class="pill ok">✓ ${f.l}: ${R.e[f.k]} ${f.u}</span>`).join('')}</div></div>` : '');
}
function renderRewards(h) {
  const s = streak(h), got = BADGES.filter(b => b[3](h, s, R)), xp = h.length * 10 + got.length * 25;
  $('#hStreak').textContent = `🔥 ${s}-day streak`;
  $('#hXp').textContent = `Level ${Math.floor(xp / 100) + 1}, ${xp} XP`;
  $('#rewards').innerHTML = `<h2>Mission health rewards</h2>
    <p class="mb-2">Log every day to keep your streak. Each entry earns 10 XP and each badge 25 XP.</p>
    <div class="bar mb-1"><i style="width:${xp % 100}%"></i></div>
    <p class="mb-4 !text-xs">${100 - (xp % 100)} XP to level ${Math.floor(xp / 100) + 2}</p>
    <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">${BADGES.map(b => `
      <div class="badge ${got.includes(b) ? '' : 'off'}"><div class="text-2xl">${b[0]}</div>
      <div class="text-sm font-semibold">${b[1]}</div><div class="text-xs text-slate-400">${b[2]}</div></div>`).join('')}</div>`;
}

/* Charts */
Chart.defaults.color = '#8b9bc4'; Chart.defaults.borderColor = '#1f2b55'; Chart.defaults.font.family = '"IBM Plex Sans", system-ui, sans-serif';
const ln = (label, data, c, x = {}) => ({ label, data, borderColor: c, backgroundColor: c, tension: 0.3, pointRadius: 3, ...x });
function charts(h) {
  const L = h.map(e => e.date.slice(5)), f = F.find(x => x.k === metric), band = i => L.map(() => f.b[i]), opt = { aspectRatio: 2.6 };
  vc && vc.destroy(); wc && wc.destroy();
  vc = new Chart($('#vc'), { type: 'line', options: opt, data: { labels: L, datasets: [
    ln(`${f.l} (${f.u})`, h.map(e => e[metric]), '#60a5fa'),
    ln('Normal min', band(0), '#10b98188', { borderDash: [5, 5], pointRadius: 0 }),
    ln('Normal max', band(1), '#10b98188', { borderDash: [5, 5], pointRadius: 0, fill: '-1', backgroundColor: '#10b98120' })] } });
  wc = new Chart($('#wc'), { type: 'line', options: opt, data: { labels: L, datasets: [
    ln('Sleep (h)', h.map(e => e.sleep), '#a78bfa'), ln('Mood (1 to 5)', h.map(e => e.mood), '#fbbf24'), ln('Fatigue (1 to 10)', h.map(e => e.fat), '#fb7185')] } });
}

/* Navigation and form */
function show(t) {
  tab = t;
  $$('main > section').forEach(s => s.classList.toggle('hidden', s.id !== 'tab-' + t));
  $$('.tab').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
  if (t === 'log') charts(load());
}
const toast = m => { const t = $('#toast'); t.textContent = m; t.classList.remove('hidden'); setTimeout(() => t.classList.add('hidden'), 2500); };

$$('.tab').forEach(b => (b.onclick = () => show(b.dataset.tab)));
$$('#body [data-sys]').forEach(el => {
  el.setAttribute('tabindex', 0); el.setAttribute('role', 'button'); el.setAttribute('aria-label', SYS[el.dataset.sys].n);
  el.innerHTML = `<title>${SYS[el.dataset.sys].n}</title>`;
  el.onclick = () => { sel = el.dataset.sys; render(); };
  el.onkeydown = ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); el.click(); } };
});
$('#fields').innerHTML = `<div><label for="date">Date</label><input id="date" type="date" value="${iso()}" required></div>` +
  F.map(f => `<div><label for="f_${f.k}">${f.l} (${f.u})</label><input id="f_${f.k}" type="number" required min="${f.min}" max="${f.max}" step="${f.step}" placeholder="${f.b[0]} to ${f.b[1]}"></div>`).join('');
$('#metrics').innerHTML = F.map(f => `<button type="button" class="metric ${f.k === metric ? 'on' : ''}" data-k="${f.k}">${f.l}</button>`).join('');
$$('.metric').forEach(b => (b.onclick = () => { metric = b.dataset.k; $$('.metric').forEach(x => x.classList.toggle('on', x === b)); charts(load()); }));

$('#form').onsubmit = ev => {
  ev.preventDefault();
  const e = { date: $('#date').value };
  F.forEach(f => (e[f.k] = +$('#f_' + f.k).value));
  const nb = () => { const x = load(); return BADGES.filter(b => b[3](x, streak(x), R)).length; }, b0 = nb();
  const h = load().filter(x => x.date !== e.date); h.push(e); save(h);
  ev.target.reset(); $('#date').value = iso(); render();
  const nw = nb() - b0;
  toast(nw > 0 ? `🏅 ${nw} new badge${nw > 1 ? 's' : ''} unlocked! +10 XP` : 'Entry saved: +10 XP');
  show(R.A.length ? 'adv' : 'dash');
};
const seed = () => {
  const h = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const p = (13 - i) / 13, j = () => Math.random() - 0.5;
    h.push({ date: iso(d), hr: Math.round(62 + 16 * p + 4 * j()), sys: Math.round(118 + 18 * p + 4 * j()), dia: Math.round(76 + 9 * p + 3 * j()),
      glu: Math.round(94 + 14 * p + 8 * j()), temp: +(36.7 + 0.3 * j()).toFixed(1), sleep: Math.round((7.6 - 1.9 * p + j()) * 2) / 2,
      mood: Math.round(4.3 - 2.4 * p), fat: Math.max(1, Math.round(3 + 4.5 * p + 2 * j())), ex: Math.round(125 - 70 * p + 15 * j()), h2o: +(2.9 - p + 0.3 * j()).toFixed(1), rad: i === 5 ? 2.4 : +(0.45 + 0.2 * j()).toFixed(2) });
  }
  save(h); render(); toast('Demo mission data loaded');
};
$('#demo').onclick = seed;
$('#exp').onclick = () => {
  const h = load(), csv = ['date,' + F.map(f => f.k).join(',')].concat(h.map(e => [e.date, ...F.map(f => e[f.k])].join(','))).join('\n');
  Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })), download: 'vitalorbit-report.csv' }).click();
};
$('#clr').onclick = () => { if (confirm('Warning: this permanently deletes all logged health data on this device. Continue?')) { try { localStorage.removeItem(KEY); } catch {} render(); } };

render();
