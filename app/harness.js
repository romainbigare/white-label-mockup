/* ---------------------------------------------------------------------------
   harness.js — reviewer tooling. None of this is the product.

   The whole point of the mockup is that the same build can be checked at any
   screen size, in any language, in any role, on any plan, online or offline —
   so those five things are controls here rather than assumptions baked into the
   screens. The 360 × 640 preset is first in the list because WF-002 makes it the
   acceptance size: "every screen is tested at that size before it is done".
   --------------------------------------------------------------------------- */

import { h, mount } from './core/dom.js';
import { state, commit, resetData } from './core/store.js';
import { LANGUAGES, setLanguage, missingReport } from './core/i18n.js';
import { PLANS } from './core/entitlements.js';
import { SCREENS } from './screens/index.js';
import { current, nav } from './core/router.js';
import { openScreenGrid, closeScreenGrid } from './screengrid.js';
import { BUILD, BUILT_AT } from './version.js';

export const DEVICES = [
  { id: 'android-min',  label: 'Android baseline — 360 × 640',   w: 360, h: 640, platform: 'android', notch: 'none',  safeTop: 26, safeBottom: 10, note: 'The WF-002 acceptance size. Every screen must work here.' },
  { id: 'galaxy-s8',    label: 'Galaxy S8 / S10e — 360 × 740',   w: 360, h: 740, platform: 'android', notch: 'punch', safeTop: 30, safeBottom: 16 },
  { id: 'pixel-5',      label: 'Pixel 5 — 393 × 851',            w: 393, h: 851, platform: 'android', notch: 'punch', safeTop: 32, safeBottom: 18 },
  { id: 'galaxy-s23u',  label: 'Galaxy S23 Ultra — 412 × 915',   w: 412, h: 915, platform: 'android', notch: 'punch', safeTop: 34, safeBottom: 18 },
  { id: 'iphone-se',    label: 'iPhone SE — 375 × 667',          w: 375, h: 667, platform: 'ios',     notch: 'none',  safeTop: 20, safeBottom: 8 },
  { id: 'iphone-13-mini', label: 'iPhone 13 mini — 375 × 812',   w: 375, h: 812, platform: 'ios',     notch: 'notch', safeTop: 44, safeBottom: 26 },
  { id: 'iphone-14',    label: 'iPhone 14 / 15 / 16 — 390 × 844', w: 390, h: 844, platform: 'ios',    notch: 'island', safeTop: 50, safeBottom: 26 },
  { id: 'iphone-16-pro',label: 'iPhone 16 Pro — 402 × 874',      w: 402, h: 874, platform: 'ios',     notch: 'island', safeTop: 52, safeBottom: 26 },
  { id: 'iphone-pro-max', label: 'iPhone 15/16 Pro Max — 430 × 932', w: 430, h: 932, platform: 'ios', notch: 'island', safeTop: 54, safeBottom: 26 },
];

const ZOOMS = [
  { id: 'fit', label: 'Fit' }, { id: '1', label: '100%' },
  { id: '0.85', label: '85%' }, { id: '0.7', label: '70%' }, { id: '1.25', label: '125%' },
];

const FONT_SCALES = [
  { id: '1', label: '100%' }, { id: '1.3', label: '130%' },
  { id: '1.6', label: '160%' }, { id: '2', label: '200%' },
];

export function device() {
  return DEVICES.find((d) => d.id === state.device.presetId) ?? DEVICES[6];
}

/* Set inline in <head> before first paint — see index.html. */
export function viewMode() {
  return document.documentElement.dataset.mode === 'phone' ? 'phone' : 'harness';
}

export function isPhone() {
  return viewMode() === 'phone';
}

/* -- controls ------------------------------------------------------------- */

function ctl(label, node, opts = {}) {
  // Emulating a screen size, a zoom level or an OS text scale is meaningless on
  // the real thing — the phone already has all three.
  return h('div.ctl', opts.harnessOnly ? { 'data-only': 'harness' } : {},
    h('label', label), node);
}

function selectCtl(label, options, value, onchange, opts) {
  return ctl(label, h('select', {
    onchange: (e) => onchange(e.target.value),
  }, options.map((o) => h('option', { value: o.id, selected: o.id === value }, o.label))), opts);
}

function segCtl(label, options, value, onchange, opts) {
  return ctl(label, h('div.seg', options.map((o) => h('button', {
    'aria-pressed': String(o.id === value),
    onclick: () => onchange(o.id),
    title: o.title ?? o.label,
  }, o.label))), opts);
}

/* The bar carries exactly two controls. Which device, because every judgement
   about a screen depends on it; and the way into every screen, because that is
   what a reviewer opens the mockup to do. The other ten are set once and left
   alone, so they go behind the gear rather than competing for the same row. */
export function renderControls() {
  mount(document.getElementById('harness-main'),
    selectCtl('Device', DEVICES, state.device.presetId, (id) => {
      state.device.presetId = id; commit('device');
    }, { harnessOnly: true }),
    h('button.hb__cta', {
      onclick: () => { closeControls(); openScreenGrid(); },
      title: 'Every screen laid out as a zoomable contact sheet, in English',
    },
    h('svg', { viewBox: '0 0 24 24', width: 17, height: 17, fill: 'none', 'aria-hidden': 'true' },
      h('path', {
        d: 'M4 4h6v7H4V4Zm10 0h6v7h-6V4ZM4 13h6v7H4v-7Zm10 0h6v7h-6v-7Z',
        stroke: 'currentColor', 'stroke-width': 1.8, 'stroke-linejoin': 'round',
      })),
    h('span', 'All screens')));

  const host = document.getElementById('harness-controls');
  mount(host,
    segCtl('Zoom', ZOOMS, state.device.zoom, (id) => { state.device.zoom = id; commit('device'); },
      { harnessOnly: true }),
    segCtl('Text size', FONT_SCALES, String(state.device.fontScale), (id) => {
      state.device.fontScale = Number(id); commit('device');
    }, { harnessOnly: true }),
    selectCtl('Language', LANGUAGES.map((l) => ({ id: l.code, label: `${l.native} · ${l.english}${l.dir === 'rtl' ? ' (RTL)' : ''}` })),
      state.session.lang, setLanguage),
    selectCtl('Role', [
      { id: 'owner', label: 'Farm Owner' },
      { id: 'supervisor', label: 'Farm Supervisor' },
      { id: 'worker', label: 'Farm Worker' },
    ], state.session.role, (id) => {
      state.session.role = id;
      // A worker has no Home/Advice tab, so land them somewhere they can reach.
      if (id === 'worker' && ['home', 'advice'].includes(nav.tab)) nav.tab = 'tasks';
      commit('role');
    }),
    selectCtl('Plan', Object.entries(PLANS).map(([id, p]) => ({ id, label: p.label })),
      state.session.plan, (id) => { state.session.plan = id; commit('plan'); }),
    segCtl('Connection', [
      { id: 'online', label: 'Online' }, { id: 'offline', label: 'Offline' }, { id: 'syncing', label: 'Syncing' },
    ], state.session.connectivity, (id) => {
      state.session.connectivity = id;
      state.session.pendingSync = id === 'online' ? 0 : Math.max(state.session.pendingSync, id === 'syncing' ? 3 : 2);
      commit('conn');
    }),
    // WF-259 / WF-132 / WF-812 — every screen that shows the operator's own
    // position has to degrade when they refuse it.
    segCtl('Location', [{ id: 'on', label: 'Granted' }, { id: 'off', label: 'Refused' }],
      state.session.gpsGranted ? 'on' : 'off', (id) => {
        state.session.gpsGranted = id === 'on';
        commit('gps');
      }),
    segCtl('Demo mode', [{ id: 'off', label: 'Off' }, { id: 'on', label: 'On' }],
      state.session.demo ? 'on' : 'off', (id) => {
        state.session.demo = id === 'on';
        commit('demo');
      }),
    ctl('Spec', h('div.seg',
      h('button', {
        'aria-pressed': String(state.ui.showReqIds),
        onclick: () => { state.ui.showReqIds = !state.ui.showReqIds; commit('reqs'); },
        title: 'Overlay the WF- requirement identifiers each screen implements',
      }, 'WF ids'),
      h('button', { onclick: () => { resetData(); }, title: 'Restore the fixture data' }, 'Reset'))),
    // The visitor can always overrule the detection — a phone can show the
    // harness, and a laptop can go full-bleed for presenting.
    ctl('View', h('div.seg',
      h('button', {
        'aria-pressed': String(!view().isAuto()),
        onclick: () => view().set(isPhone() ? 'harness' : 'phone'),
        title: 'Switch between the reviewer harness and the app on its own',
      }, isPhone() ? 'Show harness' : 'Full screen'),
      h('button', {
        'aria-pressed': String(view().isAuto()),
        onclick: () => view().auto(),
        title: 'Choose automatically from the screen and pointer',
      }, 'Auto'))));
}

/* The detector lives inline in index.html so it can run before first paint. */
function view() {
  return globalThis.__wafraView ?? { isAuto: () => true, set() {}, auto() {}, current: () => 'harness' };
}

/* -- opening and closing the controls -------------------------------------
   Two doors into the same set of controls, because the two modes have very
   different amounts of room. On a laptop the gear drops a popover under the
   bar; on a phone the edge handle raises the whole bar as a bottom sheet, with
   the panel already inline inside it. One scrim closes whichever is open. */

/* Which build a reviewer is actually looking at. Invisible until it matters,
   which is the moment somebody says "I pushed that an hour ago". */
export function showBuild() {
  const el = document.querySelector('.hb__sub');
  if (el && BUILD !== 'dev') el.textContent = `mockup · spec v1.1 · build ${BUILD}`;
}

/**
 * The page is running code older than what the server has. Pages caches every
 * module for ten minutes against an unversioned URL, so this is ordinary rather
 * than exotic, and it looks exactly like a deploy that never happened.
 */
export function showStaleBuild({ running, available }) {
  const host = document.getElementById('stale-build');
  if (!host) return;
  host.hidden = false;
  mount(host,
    h('span.stale__dot'),
    h('div.stale__text',
      h('b', 'You are looking at an older build.'),
      h('span', ` This page is running ${running}; the server has ${available}. `),
      h('span', 'A normal reload may not be enough — hold Shift while reloading, or press Ctrl/⌘ + Shift + R.')),
    h('button.stale__go', { onclick: () => location.reload() }, 'Reload'),
    h('button.stale__x', { onclick: () => { host.hidden = true; }, 'aria-label': 'Dismiss' }, '×'));
}

export function closeControls() {
  document.body.classList.remove('controls-open', 'settings-open');
  document.getElementById('settings-toggle')?.setAttribute('aria-expanded', 'false');
}

export function initControls() {
  const edge = document.getElementById('view-controls');
  const gear = document.getElementById('settings-toggle');
  const scrim = document.getElementById('controls-scrim');
  if (!edge || !gear || !scrim) return;

  const close = closeControls;
  edge.addEventListener('click', () => document.body.classList.toggle('controls-open'));
  gear.addEventListener('click', () => {
    const open = !document.body.classList.contains('settings-open');
    document.body.classList.toggle('settings-open', open);
    gear.setAttribute('aria-expanded', String(open));
  });
  scrim.addEventListener('click', close);
  addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
}

/* -- the phone body ------------------------------------------------------- */

export function applyDevice() {
  const el = document.getElementById('device');
  const app = document.getElementById('app');
  document.getElementById('controls-scrim').hidden = false;

  if (isPhone()) {
    // Hand every dimension back to the browser: the stylesheet sizes the screen
    // to the viewport and reads the safe areas from env(), so the inline values
    // a preset would have set must come off.
    for (const prop of ['--dw', '--dh', '--sb-h']) el.style.removeProperty(prop);
    for (const prop of ['--safe-top', '--safe-bottom']) app.style.removeProperty(prop);
    // WF-007 is the operating system's own text-size setting on a real device;
    // emulating it here would compound with it.
    app.style.setProperty('--fs', '1');
    return;
  }

  const d = device();
  el.dataset.platform = d.platform;
  el.dataset.notch = d.notch;
  el.style.setProperty('--dw', `${d.w}px`);
  el.style.setProperty('--dh', `${d.h}px`);
  el.style.setProperty('--sb-h', `${d.safeTop}px`);

  app.style.setProperty('--safe-top', `${d.safeTop}px`);
  app.style.setProperty('--safe-bottom', `${Math.max(d.safeBottom, 8)}px`);
  app.style.setProperty('--fs', String(state.device.fontScale));

  // Zoom: "fit" scales the device down until it fits the stage, never up.
  let zoom = Number(state.device.zoom);
  if (state.device.zoom === 'fit') {
    const stage = document.getElementById('stage');
    const availH = stage.clientHeight - 40;
    const availW = stage.clientWidth - 40 - (window.innerWidth > 1000 ? 328 : 0);
    zoom = Math.min(1, availH / (d.h + 28), availW / (d.w + 28));
  }
  el.style.setProperty('--zoom', String(Math.max(0.3, zoom)));
}

/**
 * The fake status bar. It has to be drawn AFTER the screen, not with the rest
 * of the device chrome, because its ink colour comes from the screen's own
 * barLight flag — drawn first, it painted the previous screen's colour and a
 * dark screen got a black clock on a black strip for one frame.
 */
export function renderStatusBar() {
  if (isPhone()) return;                 // the real device draws its own
  const d = device();
  const bar = document.getElementById('device-statusbar');
  const light = document.getElementById('app')?.dataset.barLight === 'true';
  bar.style.setProperty('--sb-fg', light ? '#ffffff' : 'var(--ink-900)');
  const battery = h('span', { style: { display: 'inline-flex', alignItems: 'center', gap: '4px' } },
    h('span', '5G'),
    h('svg', { width: 24, height: 12, viewBox: '0 0 24 12', 'aria-hidden': 'true' },
      h('rect', { x: .5, y: .5, width: 20, height: 11, rx: 3, fill: 'none', stroke: 'currentColor', opacity: .5 }),
      h('rect', { x: 2, y: 2, width: 15, height: 8, rx: 1.6, fill: 'currentColor' }),
      h('path', { d: 'M22 4v4', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', opacity: .5 })));
  mount(bar, h('span', '09:12'), d.notch === 'island' || d.notch === 'notch' ? h('span') : null, battery);
}

/* -- caption panel -------------------------------------------------------- */

export function renderCaption() {
  if (isPhone()) return;                       // the panel is not rendered at all
  const host = document.getElementById('stage-caption');
  const { view } = current();
  const meta = SCREENS[view];
  const d = device();
  const cover = missingReport();
  const langCov = cover.byLang[state.session.lang];

  mount(host,
    h('span.cap__id', meta ? meta.id : view),
    h('h2', meta?.title ?? view),
    h('p', meta?.note ?? ''),
    meta?.reqs?.length ? h('div', h('div', { style: { fontSize: '11px', textTransform: 'uppercase', letterSpacing: '.08em', color: '#6d9284', marginBottom: '4px' } }, 'Requirements'),
      h('div.cap__reqs', meta.reqs.map((r) => h('span.cap__req', r)))) : null,
    h('div.cap__size',
      h('div', `${d.label.split('—')[0].trim()} · ${d.w} × ${d.h} dp`),
      h('div', `Text size ${Math.round(state.device.fontScale * 100)}% · ${state.session.role} · ${PLANS[state.session.plan].label}`),
      langCov ? h('div', `Translation coverage ${langCov.pct}% (${langCov.have}/${langCov.total} keys)`) : null));
}

addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeScreenGrid();
});
addEventListener('resize', () => { if (isPhone() || state.device.zoom === 'fit') applyDevice(); });
