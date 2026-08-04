/* ---------------------------------------------------------------------------
   components.js — the shared kit.

   Two rules are enforced structurally here rather than by convention:
     * statusChip() always renders icon + word + colour (WF-008/WF-009). There is
       no way to render a bare coloured dot.
     * lockedRow()/lockBox() always route to the SAME upgrade sheet (WF-713), so
       a screen cannot invent its own upsell.
   --------------------------------------------------------------------------- */

import { h, when } from '../core/dom.js';
import { icon } from './icons.js';
import { STATUS, statusLabel } from '../core/status.js';
import { t } from '../core/i18n.js';
import { state, commit } from '../core/store.js';
import { back, canGoBack, openModal, openSheet, switchTab } from '../core/router.js';
import { tabsFor } from '../core/capabilities.js';
import { lock } from '../core/entitlements.js';

/* -- status -------------------------------------------------------------- */

export function statusIcon(key, size = 16) {
  const s = STATUS[key] ?? STATUS.nodata;
  return h('span', { class: `dot dot--${key}` }, icon(s.icon, size));
}

export function statusChip(key, opts = {}) {
  const s = STATUS[key] ?? STATUS.nodata;
  return h(`span.status.status--${key}${opts.large ? '.status--lg' : ''}${opts.plain ? '.status--plain' : ''}`,
    icon(s.icon, opts.large ? 18 : 15),
    h('span', opts.label ?? statusLabel(key)));
}

/* -- app bar ------------------------------------------------------------- */

export function appBar({ title, subtitle, back: showBack = true, brand = false, large = false, actions = [], flush = false, onBack }) {
  return h(`div.app__top${brand ? '.app__top--brand' : ''}${flush ? '.app__top--flush' : ''}`,
    h(`div.appbar${large ? '.appbar--large' : ''}`,
      when(showBack && (canGoBack() || onBack), () => h('button.iconbtn', {
        onclick: onBack || back,
        'aria-label': t('a11y.back', 'Back'),
      }, icon('back', 24, 'flip'))),
      h('div.appbar__title', h('span', title), subtitle ? h('small', subtitle) : null),
      ...actions));
}

export function barAction(iconName, label, onclick, opts = {}) {
  return h('button.iconbtn', {
    onclick, 'aria-label': label, title: label, disabled: opts.disabled,
  }, icon(iconName, 22), h('span.iconbtn__label', label));
}

/**
 * The overflow menu. Deliberately unlabelled: ⋮ is a platform convention that
 * both stores' own apps use bare, and a "More" caption under it competed with
 * the screen title beside it. This is a considered exception to WF-014, not an
 * oversight — the accessible name is still on the button.
 */
export function overflowAction(onclick, label = t('action.more', 'More')) {
  return h('button.iconbtn.iconbtn--bare', {
    onclick, 'aria-label': label, title: label,
  }, icon('dots', 22));
}

/* -- tab bar, WF-030 / WF-031 / WF-032 / WF-033 / WF-034 ----------------- */

export function tabBar({ activeTab, badges }) {
  const tabs = tabsFor(state.session.role);
  const labels = {
    'nav.home': 'Home', 'nav.map': 'Map', 'nav.advice': 'Advice',
    'nav.tasks': 'Tasks', 'nav.mywork': 'My Work', 'nav.more': 'More',
  };
  return h('nav.tabbar', { role: 'tablist' },
    tabs.map((tab) => {
      const badge = badges?.[tab.id];
      return h('button.tab', {
        role: 'tab', 'aria-selected': String(tab.id === activeTab),
        onclick: () => switchTab(tab.id),
      },
      icon(tab.icon, 23),
      h('span.tab__label', t(tab.labelKey, labels[tab.labelKey])),   // WF-034 — labels always visible
      when(badge > 0, () => h('span.tab__badge', String(badge))));
    }));
}

/* -- layout helpers ------------------------------------------------------ */

export function page(...children) {
  return h('div.page', ...children);
}

export function section(title, opts = {}, ...children) {
  return h('section.section',
    when(title, () => h('h2.section__head',
      h('span', title),
      when(opts.action, () => h('button.section__action', { onclick: opts.action.onclick }, opts.action.label)))),
    ...children);
}

export function card(opts = {}, ...children) {
  const accent = opts.accent ? `.card--accent-${opts.accent}` : '';
  const tap = opts.onclick ? '.card--tap' : '';
  const flat = opts.flat ? '.card--flat' : '';
  const props = opts.onclick ? { onclick: opts.onclick, type: 'button' } : {};
  const tag = opts.onclick ? `button.card${tap}${accent}${flat}` : `div.card${accent}${flat}`;
  return h(tag, props, ...children);
}

export function cardPad(...children) {
  return h('div.card__pad', ...children);
}

export function row({ title, sub, value, iconName, onclick, chevron = true, locked = false, statusKey, badge }) {
  const tag = onclick ? 'button.row' : 'div.row.row--static';
  return h(`${tag}${locked ? '.row--locked' : ''}`, onclick ? { onclick, type: 'button' } : {},
    when(statusKey, () => statusIcon(statusKey, 18)),
    when(iconName, () => h('span', { style: { color: 'var(--ink-500)', display: 'flex' } }, icon(iconName, 21))),
    h('div.row__main',
      h('div.row__title', title),
      when(sub, () => h('div.row__sub', sub))),
    when(badge != null, () => h('span.chip__count', String(badge))),
    when(value != null, () => h('span.row__value', value)),
    when(locked, () => h('span.locked', icon('lock', 15), t('locked.short', 'Locked'))),
    when(onclick && chevron && !locked, () => h('span.row__chev', icon('forward', 20, 'flip'))));
}

/* -- buttons ------------------------------------------------------------- */

export function btn(label, opts = {}) {
  const cls = ['btn'];
  if (opts.variant) cls.push(`btn--${opts.variant}`);
  if (opts.block !== false) cls.push('btn--block');
  if (opts.size) cls.push(`btn--${opts.size}`);
  return h(`button.${cls.join('.')}`, {
    onclick: opts.onclick, disabled: opts.disabled, type: 'button',
  }, when(opts.icon, () => icon(opts.icon, opts.size === 'big' || opts.size === 'huge' ? 26 : 20)),
     h('span', label),
     when(opts.sub, () => h('small', { style: { fontWeight: 500, opacity: .85 } }, opts.sub)));
}

/** WF-005 — the dock that keeps the primary action in the bottom third. */
export function actionDock(...children) {
  return h('div.actiondock', ...children);
}

/** Two actions of equal weight, side by side — the D2–D5 wireframe shape. */
export function actionDockPair(...children) {
  return h('div.actiondock.actiondock--pair', ...children);
}

export function fab(label, onclick, iconName = 'plus') {
  return h('button.fab', { onclick, 'aria-label': label, title: label },
    icon(iconName, 24), h('span.fab__label', label));
}

/* -- filters ------------------------------------------------------------- */

export function chips(items, activeId, onSelect, opts = {}) {
  return h(`div.chips${opts.wrap ? '.chips--wrap' : ''}`,
    items.map((item) => h('button.chip', {
      'aria-pressed': String(item.id === activeId),
      onclick: () => onSelect(item.id),
    }, when(item.icon, () => icon(item.icon, 16)),
       h('span', item.label),
       when(item.count != null, () => h('span.chip__count', String(item.count))))));
}

export function pillTabs(items, activeId, onSelect) {
  return h('div.pilltabs', { role: 'tablist' },
    items.map((item) => h('button.pilltab', {
      role: 'tab', 'aria-selected': String(item.id === activeId),
      onclick: () => onSelect(item.id),
    }, h('span', item.label),
       when(item.count != null, () => h('span.pilltab__count', String(item.count))))));
}

/* -- forms --------------------------------------------------------------- */

export function field(label, control, opts = {}) {
  return h('div.field',
    when(label, () => h('label.field__label',
      h('span', label),
      when(opts.required, () => h('span.req', ' *')))),
    control,
    when(opts.hint, () => h('div.field__hint', opts.hint)),
    when(opts.error, () => h('div.field__error', opts.error)));
}

/* -- text fields ----------------------------------------------------------

   A text field re-renders the screen on EVERY keystroke, not on blur. A
   "Continue" button that only wakes up once you tap somewhere else is the most
   common way a form feels broken, and waiting for `change` was the wrong cure
   for the real problem: a re-render throws the DOM away, taking focus and the
   caret with it. That is the shell's job now — composeApp() puts both back —
   so the field is free to report the truth as it is typed.

   Two things follow from that.

   The shell finds the field again by `data-field`. The key is the field's
   position in the render by default, which is stable while someone is typing;
   pass `name` where a screen can add or remove a field above another one.

   And the re-render stands down while an input method editor is composing.
   Hindi, Bengali, Arabic and Pashto are typed by composing several keystrokes
   into one character, and rebuilding the field mid-composition would throw the
   half-formed character away. The commit waits for compositionend instead. */

let fieldSeq = 0;

/** Called by composeApp() at the top of every render. */
export function resetFieldKeys() { fieldSeq = 0; }

function textField(spec, { oninput, name, dataset, ...props }) {
  const key = name ?? `f${fieldSeq++}`;
  return h(spec, {
    ...props,
    name,
    dataset: { ...dataset, field: key },
    oninput: (e) => {
      oninput?.(e);
      if (!e.isComposing) commit('field');
    },
    oncompositionend: () => commit('field'),
  });
}

export function input(props = {}) {
  return textField('input.input', { type: 'text', ...props });
}

export function textarea(props = {}) {
  return textField('textarea.textarea', props);
}

export function select(options, value, onchange, props = {}) {
  return h('select.select', {
    onchange: (e) => onchange(e.target.value), ...props,
  }, options.map((o) => h('option', {
    value: o.value ?? o, selected: (o.value ?? o) === value,
  }, o.label ?? o)));
}

export function checkbox(label, checked, onchange) {
  return h('label.check',
    h('input', { type: 'checkbox', checked, onchange: (e) => onchange(e.target.checked) }),
    h('span.check__text', label));
}

/* -- the compare divider — WF-223 (plot) and WF-261 (map) ------------------

   Both places are the same thing: a full-area, invisible range input laid over
   an image, with a white line where the two dates meet.

   It is the one control here that does NOT re-render as it moves, for a
   concrete reason. A render replaces the DOM wholesale, and replacing the very
   node the pointer is dragging releases the browser's implicit pointer capture
   — so a divider that committed on every input event stopped following the
   mouse after the first pixel. Instead the handler writes the position to a
   --split custom property on the stage, and everything that moves is expressed
   in terms of it: the line, the clip over the plot raster, and the clip rect
   inside the map SVG. The state commits once, on release.

   --split is a PHYSICAL offset from the left, not an inline-start one. An image
   comparison is spatial, so it does not mirror for Arabic; the imagery
   underneath it does not either. */

export function compareStage(pct, props = {}, ...children) {
  const { style = {}, ...rest } = props;
  return h('div.compare', { ...rest, style: { ...style, '--split': `${pct}%` } }, ...children);
}

export function compareSlider({ value, min = 0, max = 100, onRelease, label }) {
  const paint = (e) => e.target.closest('.compare')?.style.setProperty('--split', `${e.target.value}%`);
  return h('input.compare__slider', {
    type: 'range', min, max, value, 'aria-label': label,
    oninput: paint,
    onchange: (e) => { paint(e); onRelease(Number(e.target.value)); },
  });
}

export function compareLine(size = 38) {
  return h('div.compare__line', h('span.compare__grip', { style: { width: `${size}px`, height: `${size}px` } },
    icon('compare', Math.round(size * 0.53))));
}

/**
 * A map control: one glyph, no caption. See .maptool in components.css for why
 * this is allowed to break WF-014 when nothing else is. The label is required
 * — it becomes the accessible name and the tooltip — it just is not painted.
 */
export function mapTool(iconName, label, onclick, opts = {}) {
  return h(`button.maptool${opts.locked ? '.maptool--locked' : ''}`, {
    onclick, 'aria-label': label, title: label, type: 'button',
  }, icon(opts.locked ? 'lock' : iconName, 21));
}

export function radioList(items, value, onSelect) {
  return h('div.radio-list',
    items.map((item) => h('button.radio', {
      role: 'radio', 'aria-checked': String(item.id === value),
      onclick: () => onSelect(item.id), type: 'button',
    },
    h('span.radio__mark'),
    h('div.radio__body',
      h('div.radio__title', item.label),
      when(item.sub, () => h('div.radio__sub', item.sub))),
    when(item.trailing, () => item.trailing))));
}

export function switchRow(title, checked, onchange, opts = {}) {
  return h('button.switch', {
    role: 'switch', 'aria-checked': String(checked), type: 'button',
    disabled: opts.disabled,
    onclick: () => !opts.disabled && onchange(!checked),
  },
  h('div.switch__body',
    h('div.switch__title', title),
    when(opts.sub, () => h('div.switch__sub', opts.sub))),
  h('span.switch__track'));
}

/* -- states, WF-011 / WF-012 --------------------------------------------- */

export function emptyState({ iconName = 'leaf', title, body, action }) {
  return h('div.state',
    h('div.state__icon', icon(iconName, 30)),
    h('div.state__title', title),
    when(body, () => h('div.state__body', body)),
    when(action, () => btn(action.label, { variant: 'primary', onclick: action.onclick, block: false })));
}

export function loadingState(label = t('state.loading', 'Loading…')) {
  return h('div.state',
    h('div.spinner'),
    h('div.state__body', label));
}

export function errorState({ title, body, code, onRetry }) {
  return h('div.state.state--error',
    h('div.state__icon', icon('warning', 30)),
    h('div.state__title', title ?? t('state.error.title', 'Something went wrong')),
    h('div.state__body', body ?? t('state.error.body', 'We could not load this. Check your connection and try again.')),
    when(onRetry, () => btn(t('action.retry', 'Try again'), { variant: 'primary', onclick: onRetry, block: false })),
    when(code, () => h('div', { style: { fontSize: 'var(--t-micro)', color: 'var(--ink-500)' } }, `Ref ${code}`)));
}

export function skeletonList(count = 3) {
  return h('div', { style: { display: 'flex', flexDirection: 'column', gap: '12px' } },
    Array.from({ length: count }, () => h('div.skeleton', { style: { height: '84px' } })));
}

/* -- locked features, WF-712 / WF-713 ------------------------------------ */

export function upgradeSheet(featureKey) {
  openModal('UPGRADE', { featureKey });
}

export function lockedRow(featureKey, title, sub) {
  const info = lock(featureKey);
  return row({ title, sub, locked: true, onclick: () => upgradeSheet(featureKey), chevron: false });
}

export function lockBox(featureKey, opts = {}) {
  const info = lock(featureKey);
  return h('button.lockbox', { onclick: () => upgradeSheet(featureKey), type: 'button' },
    icon('lock', 26),
    h('span.lockbox__title', opts.title ?? info.name),
    h('span.lockbox__body', opts.body ?? info.benefit),
    h('span.locked', t('locked.cta', 'See {plan} plan', { plan: info.plan })));
}

/** Render `content` only when entitled; otherwise the lock affordance. */
export function gate(featureKey, content, opts = {}) {
  const info = lock(featureKey);
  return info.locked ? lockBox(featureKey, opts) : content();
}

/* -- misc ---------------------------------------------------------------- */

export function disclaimer(text, strong = false) {
  // WF-278 / WF-285 / WF-621 — present, in the user's language, not dismissible.
  return h(`div.disclaimer${strong ? '.disclaimer--strong' : ''}`,
    icon(strong ? 'warning' : 'info', 18),
    h('span', text));
}

export function meter(label, value, opts = {}) {
  return h('div.meter',
    when(label, () => h('span.meter__label', label)),
    h('span.meter__track', h('span.meter__fill', {
      style: { width: `${Math.max(0, Math.min(100, value))}%`, background: opts.colour ?? 'var(--brand-600)' },
    })),
    h('span.meter__val', opts.text ?? `${Math.round(value)}%`));
}

export function avatar(initials, opts = {}) {
  return h(`span.avatar${opts.large ? '.avatar--lg' : ''}`, initials);
}

export function kv(pairs) {
  return h('dl.kv', pairs.filter(Boolean).flatMap(([k, v]) => [h('dt', k), h('dd', v)]));
}

export function statGrid(items) {
  return h('div.statgrid',
    items.map((item) => h('div.stat',
      statusIcon(item.status, 17),
      h('span', item.label),
      h('span.stat__num', String(item.count)))));
}

/** A one-off "requirement id" tag, shown only when the harness toggle is on. */
export function req(...ids) {
  return h('span.reqtag', ids.join(' '));
}

export function sheetShell(title, ...body) {
  return h('div.sheet',
    h('div.sheet__grip'),
    h('div.sheet__body',
      when(title, () => h('h2.sheet__title', title)),
      ...body));
}

export function divider() {
  return h('div', { style: { height: '1px', background: 'var(--ink-200)' } });
}

export { openSheet, openModal };
