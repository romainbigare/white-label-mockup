/* Smoke test: open every registered screen, in every role, and fail on any
   console error or uncaught exception. Also dumps the English string catalogue
   so the translation files can be generated from what the app actually uses.

   Usage:  node tools/smoke.mjs [--dump path.json] [--shots dir]
*/
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };

const server = createServer(async (req, res) => {
  const path = decodeURIComponent(req.url.split('?')[0]);
  const file = join(ROOT, path === '/' ? 'index.html' : path);
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
});
await new Promise((r) => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}/`;

const dumpAt = process.argv.includes('--dump') ? process.argv[process.argv.indexOf('--dump') + 1] : null;
const shotsAt = process.argv.includes('--shots') ? process.argv[process.argv.indexOf('--shots') + 1] : null;
if (shotsAt) await mkdir(shotsAt, { recursive: true });

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });

const problems = [];
page.on('console', (msg) => { if (msg.type() === 'error') problems.push(`console: ${msg.text()}`); });
page.on('pageerror', (err) => problems.push(`pageerror: ${err.message}`));

await page.goto(base, { waitUntil: 'networkidle' });

await page.waitForFunction(() => !!globalThis.wafra);

const screens = await page.evaluate(() =>
  Object.values(wafra.SCREENS).map((s) => ({ id: s.id, route: s.route ?? s.id })));

const roles = ['owner', 'supervisor', 'worker'];
let checked = 0;

for (const role of roles) {
  await page.evaluate((r) => {
    wafra.state.session.role = r;
    wafra.state.session.demo = false;
    wafra.commit('test');
  }, role);

  for (const s of screens) {
    const before = problems.length;
    await page.evaluate((route) => wafra.jump(route), s.route);
    await page.waitForTimeout(28);
    const bad = await page.evaluate(() => {
      const app = document.getElementById('app');
      // A route to a screen that no longer exists renders a readable sentence,
      // which is long enough to pass a character count. It has to be detected
      // as what it is.
      if (app?.querySelector('[data-missing-screen]')) return 'no such screen';
      if ((app?.textContent ?? '').trim().length < 12) return 'empty render';
      return null;
    });
    if (bad) problems.push(`${bad}: ${s.id} (${role})`);
    if (problems.length > before) problems.push(`  ↳ while rendering ${s.id} as ${role}`);
    checked += 1;
    if (shotsAt && role === 'owner') {
      await page.screenshot({ path: join(shotsAt, `${s.id}.png`), clip: await page.evaluate(() => {
        const el = document.getElementById('device');
        const r = el.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height };
      }) });
    }
  }
}

// Exercise the overlay layer too — the upgrade sheet, the pickers, the modals.
const overlayIds = ['UPGRADE', 'CONFIRM', 'NEEDS_CONNECTION', 'C3', 'MEASURE_PICKER', 'MEASURE_INFO',
  'FARM_PICKER', 'PLOT_PICKER', 'JOIN_PLOT_PICKER', 'ASSIGNEE_PICKER', 'CROP_PICKER',
  'LANG_PICKER', 'MAP_SEARCH', 'TREE_FINDER', 'PLOT_SHAPE_MENU', 'AREA_EDIT',
  'PLOT_MENU', 'TREE_MENU', 'TASK_MENU', 'ADVICE_MENU', 'CANNOT_DO', 'SHOW_WHERE',
  'ASSUMPTIONS', 'ADVISORY_LOG', 'DELETE_PLOT', 'DELETE_FARM', 'DELETE_ACCOUNT', 'CLOSE_CYCLE',
  'SEARCH', 'NOTIFICATIONS', 'REPORT', 'PLAN_CHOOSER', 'QR_SCAN', 'QR_SHOW', 'CONTACT_PREVIEW',
  'CONTACT', 'LEGAL'];

// Every overlay the app can open must be in that list, or a broken one is
// simply never rendered — which is how a duplicate object key that silently
// overrode E3's plot picker survived a green run.
const declaredOverlays = await page.evaluate(() => Object.keys(wafra.OVERLAYS ?? {}));
const untested = declaredOverlays.filter((id) => !overlayIds.includes(id));
if (untested.length) problems.push(`overlays never opened by this test: ${untested.join(', ')}`);

await page.evaluate(() => { wafra.state.session.role = 'owner'; wafra.commit('test'); });

// The measure explanations are content strings, registered lazily by tc() the
// first time each one is drawn. Opening the sheet for a single measure leaves
// the other six out of the catalogue and therefore out of every translation.
for (const key of await page.evaluate(() => wafra.state.db.measures.map((m) => m.key))) {
  await page.evaluate((k) => wafra.openSheet('MEASURE_INFO', { key: k }), key);
  await page.waitForTimeout(14);
}
await page.evaluate(() => wafra.state.ui.overlay = null);

const PARAMS = {
  UPGRADE: { featureKey: 'irrigation.schedule' },
  NEEDS_CONNECTION: { what: 'a connection to assign a task' },
  C3: { plotId: 'plot-04' }, MEASURE_PICKER: {}, PLOT_PICKER: { farmId: 'farm-1' },
  ASSIGNEE_PICKER: { farmId: 'farm-1' },
  PLOT_MENU: { plotId: 'plot-04' }, TREE_MENU: { treeId: 'T-2841' },
  TASK_MENU: { taskId: 'task-01' }, ADVICE_MENU: { adviceId: 'adv-01' },
  CANNOT_DO: { taskId: 'task-01' }, SHOW_WHERE: { taskId: 'task-01' },
  ASSUMPTIONS: { adviceId: 'adv-01' }, ADVISORY_LOG: { adviceId: 'adv-01' },
  DELETE_PLOT: { plotId: 'plot-04' }, DELETE_FARM: { farmId: 'farm-1' },
  CLOSE_CYCLE: { plotId: 'plot-13', cycleId: 'plot-13-cyc-1' },
  REPORT: { reportId: 'rep-01' }, QR_SHOW: { code: 'K7M2QP', workerId: 'w-1' },
  CONTACT_PREVIEW: { channel: 'whatsapp' }, LEGAL: { doc: 'terms' },
  CONFIRM: { title: 'x', body: 'y' },
  AREA_EDIT: { farmId: 'farm-6', areaId: 'farm-6-a1' },
  MEASURE_INFO: { key: 'ndvi' }, MAP_SEARCH: {}, TREE_FINDER: { farmId: 'farm-1' },
  PLOT_SHAPE_MENU: { plotId: 'plot-04' }, JOIN_PLOT_PICKER: { farmId: 'farm-1', exclude: 'plot-04' },
};

for (const id of overlayIds) {
  const before = problems.length;
  await page.evaluate(([view, params]) => {
    wafra.jump('B1');
    wafra.openSheet(view, params ?? {});
  }, [id, PARAMS[id] ?? {}]);
  await page.waitForTimeout(22);
  const drawn = await page.evaluate(() => !!document.querySelector('.overlay .sheet, .overlay .modal'));
  if (!drawn) problems.push(`overlay did not render: ${id}`);
  if (problems.length > before) problems.push(`  ↳ while rendering overlay ${id}`);
  checked += 1;
}

// Every language, on a representative screen, to catch RTL/format crashes.
for (const lang of ['en', 'ar', 'hi', 'bn', 'ps']) {
  const before = problems.length;
  await page.evaluate((l) => { wafra.setLanguage(l); wafra.jump('B4:plot-04'); }, lang);
  await page.waitForTimeout(30);
  if (problems.length > before) problems.push(`  ↳ while rendering in ${lang}`);
  checked += 1;
}
await page.evaluate(() => wafra.setLanguage('en'));

// Every farm, plot and tree — farm-4 has no imagery at all, which is the case
// most likely to break a date stepper.
const entities = await page.evaluate(() => ({
  farms: wafra.state.db.farms.map((f) => f.id),
  plots: wafra.state.db.plots.map((p) => p.id),
  trees: wafra.state.db.trees.slice(0, 8).map((t) => t.id),
  advice: wafra.state.db.advice.map((a) => ({ id: a.id, type: a.type })),
  tasks: wafra.state.db.tasks.map((t) => t.id),
  workers: wafra.state.db.workers.map((w) => w.id),
  // A survey area is addressed as `area=<farmId>|<areaId>`, and the survey has
  // to be materialised before its ids exist.
  areas: (() => {
    const farm = wafra.state.db.farms.find((f) => f.survey);
    if (!farm) return [];
    return wafra.ensureSurvey(farm).slice(0, 3).map((a) => `${farm.id}|${a.id}`);
  })(),
}));

const routes = [
  ...entities.farms.flatMap((id) => [`B2:${id}`, `B3:${id}`, `B9:${id}`, `B11:${id}`, `D6:${id}`, `F1:${id}`, `G1:${id}`, `G2:${id}`, `A11:${id}`, `A13:${id}`]),
  'B3:all',
  ...entities.workers.flatMap((id) => [`G3:${id}`, `G2:farm-1|${id}`]),
  ...entities.areas.map((a) => `C5:area=${a}`),
  ...entities.plots.flatMap((id) => [`B4:${id}`, `B5:${id}`, `B6:${id}`, `B7:${id}|ndvi`, `B8:${id}`, `C5:${id}`, `E7:${id}`]),
  ...entities.trees.map((id) => `B10:${id}`),
  ...entities.advice.map((a) => `${({ irrigation: 'D2', nutrition: 'D3', protection: 'D4', weather: 'D6' })[a.type]}:${a.id}`),
  ...entities.advice.map((a) => `D7:${a.id}`),
  ...entities.tasks.flatMap((id) => [`E2:${id}`, `E4:${id}`]),
  ...entities.advice.slice(0, 4).map((a) => `E3:advice=${a.id}`),
  'E3:plot=plot-04', 'E6:plot=plot-04', 'B8:plot-04|years',
];
for (const route of routes) {
  const before = problems.length;
  await page.evaluate((r) => wafra.jump(r), route);
  await page.waitForTimeout(12);
  const missing = await page.evaluate(() =>
    document.querySelector('#app [data-missing-screen]')?.dataset.missingScreen ?? null);
  if (missing) problems.push(`no such screen "${missing}" for route`);
  if (problems.length > before) problems.push(`  ↳ while rendering ${route}`);
  checked += 1;
}

// Plan and connectivity variations, on the screens that gate on them.
for (const plan of ['crop_basic', 'crop_pro', 'tree_basic', 'tree_pro', 'combined_basic', 'combined_pro', 'trial_expired']) {
  for (const route of ['B1', 'B2:farm-1', 'B4:plot-04', 'B9:farm-1', 'G1:farm-1', 'C1', 'C2', 'D1', 'F5', 'F6', 'F10']) {
    const before = problems.length;
    await page.evaluate(([p, r]) => { wafra.state.session.plan = p; wafra.jump(r); }, [plan, route]);
    await page.waitForTimeout(10);
    if (problems.length > before) problems.push(`  ↳ ${route} on ${plan}`);
    checked += 1;
  }
}
await page.evaluate(() => { wafra.state.session.plan = 'crop_pro'; });

for (const conn of ['offline', 'syncing', 'online']) {
  for (const route of ['B1', 'C1', 'C5:plot-04', 'D7:adv-01', 'E3:', 'E4:task-01', 'E6:', 'F10']) {
    const before = problems.length;
    await page.evaluate(([c, r]) => {
      wafra.state.session.connectivity = c;
      wafra.state.session.pendingSync = c === 'online' ? 0 : 3;
      wafra.jump(r);
    }, [conn, route]);
    await page.waitForTimeout(10);
    if (problems.length > before) problems.push(`  ↳ ${route} while ${conn}`);
    checked += 1;
  }
}

// WF5.065 / WF4.036 — refusing location must not take a screen away, only the
// parts of it that genuinely need a position.
for (const granted of [false, true]) {
  for (const route of ['C1', 'B10:T-2841', 'B10:T-2805', 'E2:task-01']) {
    const before = problems.length;
    await page.evaluate(([g, r]) => { wafra.state.session.gpsGranted = g; wafra.jump(r); }, [granted, route]);
    await page.waitForTimeout(14);
    if (problems.length > before) problems.push(`  ↳ ${route} with location ${granted ? 'granted' : 'refused'}`);
    checked += 1;
  }
  for (const params of [{ treeId: 'T-2841' }, { taskId: 'task-01' }]) {
    const before = problems.length;
    await page.evaluate((p) => { wafra.jump('B9:farm-1'); wafra.openSheet('SHOW_WHERE', p); }, params);
    await page.waitForTimeout(14);
    const drawn = await page.evaluate(() => !!document.querySelector('.overlay .sheet'));
    if (!drawn) problems.push(`SHOW_WHERE did not render for ${JSON.stringify(params)}`);
    if (problems.length > before) problems.push(`  ↳ SHOW_WHERE ${JSON.stringify(params)} location ${granted}`);
    checked += 1;
  }
}

// Demo mode unlocks everything (WF4.091) and must not break a gated screen.
await page.evaluate(() => { wafra.state.session.demo = true; wafra.commit('t'); });
for (const route of ['B1', 'G1:farm-1', 'C2', 'D1', 'F5', 'B12']) {
  const before = problems.length;
  await page.evaluate((r) => wafra.jump(r), route);
  await page.waitForTimeout(10);
  if (problems.length > before) problems.push(`  ↳ ${route} in demo mode`);
  checked += 1;
}
await page.evaluate(() => { wafra.state.session.demo = false; wafra.commit('t'); });

// --- spec audits -----------------------------------------------------------
// These are acceptance criteria, not style preferences, so they are checked
// rather than eyeballed: WF2.002 (360x640), WF2.004 (48dp targets, 8dp apart),
// WF2.006 (16sp body, 20sp actionable numbers), WF2.010 (one primary action).
await page.evaluate(() => { wafra.state.session.role = 'owner'; wafra.state.device.presetId = 'android-min'; wafra.commit('t'); });
await page.waitForTimeout(60);

const audit = [];
for (const s of screens) {
  await page.evaluate((route) => wafra.jump(route), s.route);
  await page.waitForTimeout(24);
  const found = await page.evaluate(() => {
    const app = document.getElementById('app');
    const out = { primaries: 0, small: [], tiny: [], overflowX: false, dim: [] };
    out.primaries = app.querySelectorAll('.btn--primary').length;

    // Contrast. Not a WF id — the specification does not name a ratio — but a
    // farm app is read in full sun, and a CSS cascade accident can flip a whole
    // family of buttons to near-black on dark green without anyone noticing at
    // a glance. WCAG AA: 4.5:1 for body text, 3:1 from 18.5px or bold 14px.
    const lum = (colour) => {
      const [r, g, b] = colour.match(/[\d.]+/g).map(Number);
      const f = [r, g, b].map((v) => (v /= 255, v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
      return 0.2126 * f[0] + 0.7152 * f[1] + 0.0722 * f[2];
    };
    const paintedBg = (el) => {
      for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
        const c = getComputedStyle(n).backgroundColor;
        if (c && !/rgba\(0, 0, 0, 0\)|transparent/.test(c)) return c;
      }
      return 'rgb(255, 255, 255)';
    };
    for (const el of app.querySelectorAll('*')) {
      // Only elements that paint text of their own, and only if it is visible.
      if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.opacity === '0') continue;
      if (el.closest('svg, .skeleton, .map__legend')) continue;   // decoration and imagery
      const size = parseFloat(cs.fontSize);
      const large = size >= 18.5 || (size >= 14 && Number(cs.fontWeight) >= 700);
      const a = lum(cs.color), b = lum(paintedBg(el));
      const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      if (ratio < (large ? 3 : 4.5)) {
        out.dim.push(`${ratio.toFixed(1)}:1 ${el.className || el.tagName} "${el.textContent.trim().slice(0, 24)}"`);
      }
    }
    for (const el of app.querySelectorAll('button, a, input, select, [role="switch"], [role="radio"]')) {
      if (el.closest('.otp') || el.closest('.chart')) continue; // display-only cells
      if (el.type === 'range') continue;                        // full-area drag surface
      // The target is what a finger can hit: a checkbox inside a tall label
      // inherits the label's box.
      const target = el.closest('label, button, .row, .switch') ?? el;
      const r = target.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      if (r.height < 40 || r.width < 30) out.small.push(`${el.className || el.tagName} ${Math.round(r.width)}x${Math.round(r.height)}`);
    }
    for (const el of app.querySelectorAll('.row__title, .card__pad > div, .page > p, .state__body')) {
      if (el.classList.contains('chart__axisrow')) continue;   // chart furniture
      const size = parseFloat(getComputedStyle(el).fontSize);
      const text = el.textContent.trim();
      if (text && size < 15.5) out.tiny.push(`${size}px "${text.slice(0, 40)}"`);
    }
    // WF2.002 is about what the user experiences, so test the real thing: can
    // the view be scrolled sideways, and is any *visible* control cut off?
    // SVG internals are clipped by their own viewport and do not count.
    const scroll = document.getElementById('scroll');
    if (scroll) {
      const right = scroll.getBoundingClientRect().right;
      let worst = null;
      for (const el of scroll.querySelectorAll('button, input, select, textarea, .row, .chip, .card')) {
        if (el.closest('svg') || el.closest('.chips, .pilltabs') || el.closest('[data-hscroll]')) continue;
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.right > right + 2) {
          if (!worst || r.right > worst.right) worst = { right: r.right, w: Math.round(r.width), cls: String(el.className).slice(0, 30) || el.tagName };
        }
      }
      if (worst) {
        out.overflowX = true;
        out.overflowBy = `${worst.cls} runs ${Math.round(worst.right - right)}px past the edge`;
      }
    }
    return out;
  });
  if (found.primaries > 1) audit.push(`WF2.010 ${s.id}: ${found.primaries} primary actions`);
  if (found.small.length) audit.push(`WF2.004 ${s.id}: ${found.small.length} targets under 36dp — ${found.small.slice(0, 3).join(', ')}`);
  if (found.tiny.length) audit.push(`WF2.006 ${s.id}: ${found.tiny.length} body strings under 16sp — ${found.tiny.slice(0, 2).join(', ')}`);
  if (found.overflowX) audit.push(`WF2.002 ${s.id}: content scrolls sideways at 360 dp — ${found.overflowBy ?? ''}`);
  if (found.dim.length) audit.push(`contrast ${s.id}: ${found.dim.length} below AA — ${found.dim.slice(0, 3).join(' · ')}`);
  checked += 1;
}

// WF2.007 — the same screens at 200% text must not lose the primary action or
// push content off the side.
await page.evaluate(() => { wafra.state.device.fontScale = 2; wafra.commit('t'); });
await page.waitForTimeout(60);
for (const s of screens) {
  await page.evaluate((route) => wafra.jump(route), s.route);
  await page.waitForTimeout(24);
  const bad = await page.evaluate(() => {
    const scroll = document.getElementById('scroll');
    const app = document.getElementById('app');
    const dock = app.querySelector('.actiondock .btn--primary');
    const appRect = app.getBoundingClientRect();
    const clipped = dock ? (dock.getBoundingClientRect().bottom > appRect.bottom + 2) : false;
    let wide = false;
    if (scroll) {
      const right = scroll.getBoundingClientRect().right;
      for (const el of scroll.querySelectorAll('button, input, select, textarea, .row, .chip, .card')) {
        if (el.closest('svg') || el.closest('.chips, .pilltabs') || el.closest('[data-hscroll]')) continue;
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.right > right + 2) { wide = true; break; }
      }
    }
    return { wide, clipped };
  });
  if (bad.wide) audit.push(`WF2.007 ${s.id}: sideways scroll at 200% text`);
  if (bad.clipped) audit.push(`WF2.007 ${s.id}: primary action pushed off-screen at 200% text`);
  checked += 1;
}
await page.evaluate(() => { wafra.state.device.fontScale = 1; wafra.state.device.presetId = 'iphone-14'; wafra.commit('t'); });

if (audit.length) {
  console.log(`\n${audit.length} spec-audit findings:`);
  for (const a of audit.slice(0, 40)) console.log('  ' + a);
} else {
  console.log('spec audits clean: WF2.002, WF2.004, WF2.006, WF2.007, WF2.010');
}

// A form has to answer while you are still typing in it. These check the whole
// chain: the field commits on every keystroke, the shell puts focus and the
// caret back after the re-render, and the primary action re-reads its own
// disabled state — none of it waiting for a blur.
const live = [];
// A5 is the sign-up form. Whichever identifier is typed first, the other is
// then asked for (WF4.032), and Send code has to answer all of it as it is
// typed rather than on blur.
await page.evaluate(() => { wafra.state.session.role = 'owner'; wafra.jump('A5'); });
await page.waitForTimeout(80);
await page.click('#app input[type="text"]');
await page.type('#app input[type="text"]', '512345678', { delay: 5 });
const a5 = await page.evaluate(() => ({
  focused: document.activeElement?.type === 'text',
  caretAtEnd: document.activeElement.selectionStart === document.activeElement.value.length,
  disabled: document.querySelector('#app .btn--primary')?.disabled,
  askedForEmail: !!document.querySelector('#app input[type="email"]'),
}));
if (!a5.focused) live.push('A5: typing lost focus');
if (!a5.caretAtEnd) live.push('A5: the caret jumped while typing');
if (!a5.disabled) live.push('A5: Send code enabled with no email and no terms ticked');
if (!a5.askedForEmail) live.push('A5: a phone number was entered but no email was asked for');

// …and the other way round: an email first must ask for a number.
await page.evaluate(() => { wafra.resetLocal('signup'); wafra.jump('A2'); wafra.jump('A5'); });
await page.waitForTimeout(80);
await page.click('#app input[type="text"]');
await page.type('#app input[type="text"]', 'khaled@example.com', { delay: 4 });
await page.evaluate(() => document.activeElement.blur());
await page.waitForTimeout(60);
if (!await page.evaluate(() => !!document.querySelector('#app input[type="tel"]'))) {
  live.push('A5: an email was entered but no mobile number was asked for');
}
await page.click('#app input[type="tel"]');
await page.type('#app input[type="tel"]', '512345678', { delay: 5 });
if (!await page.evaluate(() => document.querySelector('#app .btn--primary')?.disabled)) {
  live.push('A5: Send code enabled before the terms were ticked');
}
await page.click('#app .check input[type="checkbox"]');
await page.waitForTimeout(60);
if (await page.evaluate(() => document.querySelector('#app .btn--primary')?.disabled)) {
  live.push('A5: Send code still disabled with both identifiers and the terms ticked');
}
// The caret must survive a keystroke made in the MIDDLE of a value.
await page.evaluate(() => { const e = document.querySelector('#app input[type="tel"]'); e.focus(); e.setSelectionRange(3, 3); });
await page.keyboard.type('7');
const mid = await page.evaluate(() => ({ at: document.activeElement.selectionStart, value: document.activeElement.value }));
if (mid.at !== 4 || mid.value !== '5127345678') live.push(`A5: caret moved on a mid-string keystroke (${mid.at}, "${mid.value}")`);

await page.evaluate(() => wafra.jump('E3'));
await page.waitForTimeout(80);
await page.click('#app input.input');
await page.type('#app input.input', 'Irrigate P-04', { delay: 5 });
const e3 = await page.evaluate(() => ({
  focused: document.activeElement?.tagName === 'INPUT',
  title: document.activeElement?.value,
}));
if (!e3.focused || e3.title !== 'Irrigate P-04') live.push(`E3: title field lost focus or characters ("${e3.title}")`);

if (live.length) { console.log(`\n${live.length} live-validation findings:`); for (const l of live) console.log('  ' + l); }
else console.log('forms answer while you type: focus, caret and button state all live');
problems.push(...live);

// The contact sheet renders every screen at once into a live app, which is the
// one place a render-time side effect would do real damage. Check that it draws
// them all, in English, and hands the session back exactly as it found it.
await page.evaluate(() => { wafra.jump('D1'); wafra.setLanguage('ar'); });
await page.waitForTimeout(60);
const seenBefore = await page.evaluate(() => wafra.state.db.seenAdvice.size);
await page.click('#harness-main .hb__cta');
await page.evaluate(async () => {
  const el = document.getElementById('screen-grid');
  for (let y = 0; y <= el.scrollHeight; y += 400) {
    el.scrollTop = y;
    await new Promise((r) => setTimeout(r, 60));
  }
});
await page.waitForTimeout(300);
const sheet = await page.evaluate(() => {
  const cells = [...document.querySelectorAll('.sgrid__cell')];
  return {
    total: cells.length,
    empty: cells.filter((c) => c.querySelector('.app').childElementCount === 0).map((c) => c.dataset.screen),
    english: !cells.some((c) => c.querySelector('.app').dir === 'rtl'),
    lang: wafra.state.session.lang,
    preview: wafra.state.ui.preview,
    seen: wafra.state.db.seenAdvice.size,
  };
});
if (sheet.total !== screens.length) problems.push(`screen grid: ${sheet.total} tiles for ${screens.length} screens`);
if (sheet.empty.length) problems.push(`screen grid: empty tiles — ${sheet.empty.join(', ')}`);
if (!sheet.english) problems.push('screen grid: a tile rendered right-to-left; it is meant to force English');
if (sheet.lang !== 'ar') problems.push(`screen grid: left the session in "${sheet.lang}" instead of putting Arabic back`);
if (sheet.preview) problems.push('screen grid: left state.ui.preview raised');
if (sheet.seen !== seenBefore) problems.push('screen grid: drawing advice cards marked them as read');
console.log(`screen grid: ${sheet.total} tiles, no side effects`);

// The sheet is a place you can send someone, so the link has to survive a load.
const urlOnOpen = await page.evaluate(() => location.hash);
if (!/^#\/screens\/z\d+$/.test(urlOnOpen)) problems.push(`screen grid: opened without a shareable hash (${urlOnOpen})`);
await page.evaluate(() => { document.querySelector('.sgrid__close').click(); wafra.setLanguage('en'); });
await page.goto(`${base}#/screens/z70`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!globalThis.wafra);
await page.waitForTimeout(400);
const shared = await page.evaluate(() => ({
  open: !document.getElementById('screen-grid').hidden,
  hash: location.hash,
  zoom: document.querySelector('.sgrid__pct')?.textContent,
}));
if (!shared.open) problems.push('screen grid: a shared #/screens link did not open the sheet');
if (shared.zoom !== '70%') problems.push(`screen grid: shared link lost its zoom (${shared.zoom})`);
if (shared.hash !== '#/screens/z70') problems.push(`screen grid: shared link rewrote its own hash (${shared.hash})`);
console.log(`screen grid: shareable at ${shared.hash}, reopened at ${shared.zoom}`);
await page.evaluate(() => { document.querySelector('.sgrid__close').click(); });

// Walk every screen once more with the catalogue collecting, then dump it.
for (const s of screens) {
  await page.evaluate((route) => wafra.jump(route), s.route);
  await page.waitForTimeout(10);
}
const catalogue = await page.evaluate(() => Object.fromEntries(wafra.catalogue()));

if (dumpAt) {
  await writeFile(dumpAt, JSON.stringify(catalogue, null, 1));
  console.log(`catalogue: ${Object.keys(catalogue).length} keys → ${dumpAt}`);
}

await browser.close();
server.close();

console.log(`checked ${checked} renders across ${roles.length} roles`);
if (problems.length) {
  console.log(`\n${problems.length} problems:`);
  for (const p of problems.slice(0, 60)) console.log('  ' + p);
  process.exit(1);
}
console.log('no console errors, no empty renders');
