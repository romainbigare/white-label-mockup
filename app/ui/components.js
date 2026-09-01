/* ---------------------------------------------------------------------------
   components.js — the shared kit.

   Two rules are enforced structurally here rather than by convention:
     * statusChip() always renders icon + word + colour (WF2.008/WF2.009). There is
       no way to render a bare coloured dot.
     * lockedRow()/lockBox() always route to the SAME upgrade sheet (WF9.014), so
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

export function appBar({ title, subtitle, back: showBack = true, brand = false, large = false, wrap = false, actions = [], flush = false, onBack, onTitleTap, titleHint, help, deckNote }) {
  // A tappable title is the farm picker on B2: an account with several farms
  // moves between them from inside one, rather than by going back out to a
  // list. It is a button only when there is somewhere to go, so a title that
  // does nothing never looks like a control.
  const titleBlock = h(`div.appbar__title${wrap ? '.appbar__title--wrap' : ''}`,
    h('span', title, onTitleTap ? icon('chevronDown', 17) : null),
    subtitle ? h('small', subtitle) : null);
  return h(`div.app__top${brand ? '.app__top--brand' : ''}${flush ? '.app__top--flush' : ''}`,
    h(`div.appbar${large ? '.appbar--large' : ''}`,
      when(showBack && (canGoBack() || onBack), () => h('button.iconbtn', {
        onclick: onBack || back,
        'aria-label': t('a11y.back', 'Back'),
      }, icon('back', 24, 'flip'))),
      onTitleTap
        // titleHint names the ACTION rather than the farm. A button whose only
        // accessible name is "Al Kharj South" does not say it is a picker.
        ? h('button.appbar__titlebtn', {
          onclick: onTitleTap, type: 'button', title: titleHint, ...deckMark({ deckNote }),
        }, titleBlock)
        : titleBlock,
      // GUIDANCE BELONGS BESIDE THE SUBTITLE, NOT IN THE PAGE. The drawing
      // screens carried their instruction as a full-width chip in the panel
      // under the map, competing with the fields around it for something most
      // farmers read once. It is an ⓘ at the end of the bar now, level with the
      // line it explains, and it opens the same sheet it always did.
      when(help, () => helpButton(help.body, {
        title: help.title ?? subtitle ?? title,
        // The accessible name says what it is about, because on a bar the ⓘ has
        // a whole screen behind it rather than one control beside it.
        label: t('help.about', 'About: {what}', { what: help.title ?? subtitle ?? title }),
        deckNote: 'Opens the guidance for this screen',
      })),
      ...actions));
}

/**
 * A control on the app bar: an icon with a word under it.
 *
 * `opts.title` is the fuller name, for the tooltip and the accessible name,
 * where the word on the bar has to be short enough to sit under a 22 px icon.
 * A11's boundary control is "Boundary" on screen and "Adjust the farm boundary"
 * to a screen reader; they are the same control and not the same length.
 */
export function barAction(iconName, label, onclick, opts = {}) {
  const name = opts.title ?? label;
  return h('button.iconbtn', {
    onclick, 'aria-label': name, title: name, disabled: opts.disabled,
    ...deckMark(opts),
  }, icon(iconName, 22), h('span.iconbtn__label', label));
}

/* -- telling the DECK about a control -------------------------------------

   The mockup is reviewed on paper as much as on a phone, and a printout cannot
   be tapped: a small icon button that opens a whole screen and a small icon
   button that does nothing much look identical in a photograph. So a control
   can declare itself, and tools/screendeck.mjs draws a numbered marker beside
   the phone with a key underneath — outside the picture, covering nothing.

   Two facts, either or both:
     to    the screen code this control leads to; the deck adds the page number
     note  what it opens, for something that stays on this screen

   THIS IS NOT AN ANNOTATION IN THE APP. The review was explicit that a farmer
   must never read "(D1)" on a button, and nothing here renders: they are data
   attributes, invisible on screen and read only by the deck builder. The app
   declares the truth once, where the control is; the paper draws it. */
export function deckMark({ deckTo, deckNote } = {}) {
  const out = {};
  if (deckTo) out['data-deck-to'] = deckTo;
  if (deckNote) out['data-deck-note'] = deckNote;
  return out;
}

/**
 * The overflow menu. Deliberately unlabelled: ⋮ is a platform convention that
 * both stores' own apps use bare, and a "More" caption under it competed with
 * the screen title beside it. This is a considered exception to WF2.014, not an
 * oversight — the accessible name is still on the button.
 */
export function overflowAction(onclick, label = t('action.more', 'More'), opts = {}) {
  return h('button.iconbtn.iconbtn--bare', {
    onclick, 'aria-label': label, title: label, ...deckMark(opts),
  }, icon('dots', 22));
}

/* -- tab bar, WF3.001 / WF3.003 / WF3.005 ------------------------------------ */

export function tabBar({ activeTab, badges }) {
  const tabs = tabsFor(state.session.role);
  const labels = {
    // "My Farm", not "Home". The tab opens on a farm rather than on a list of
    // them, and the review asked for the label to say so.
    'nav.myfarm': 'My Farm', 'nav.map': 'Map', 'nav.advice': 'Advice', 'nav.more': 'More',
  };
  return h('nav.tabbar', { role: 'tablist' },
    tabs.map((tab) => {
      const badge = badges?.[tab.id];
      return h('button.tab', {
        role: 'tab', 'aria-selected': String(tab.id === activeTab),
        onclick: () => switchTab(tab.id),
      },
      icon(tab.icon, 23),
      h('span.tab__label', t(tab.labelKey, labels[tab.labelKey])),   // WF3.005 — labels always visible
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
  const extra = opts.class ? `.${opts.class}` : '';
  const props = opts.onclick ? { onclick: opts.onclick, type: 'button', disabled: opts.disabled } : {};
  const tag = opts.onclick ? `button.card${tap}${accent}${extra}` : `div.card${accent}${extra}`;
  return h(tag, props, ...children);
}

export function cardPad(...children) {
  return h('div.card__pad', ...children);
}

export function row({ title, sub, value, iconName, onclick, chevron = true, locked = false, statusKey, badge, deckTo, deckNote }) {
  const tag = onclick ? 'button.row' : 'div.row.row--static';
  return h(`${tag}${locked ? '.row--locked' : ''}`, onclick ? { onclick, type: 'button', ...deckMark({ deckTo, deckNote }) } : {},
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

/* -- guidance behind a button --------------------------------------------
   THE INSTRUCTION IS NOT THE SCREEN. Two rounds of review said the same thing
   about different screens: the drawing screens opened with a paragraph telling
   the farmer how to trace a boundary, and the plot screen with a paragraph
   explaining satellite phenology. Both are true, both are worth having, and
   neither is what the person came for — a farmer who has drawn one boundary
   never needs the first again, and fourteen out of fifteen never want the
   second.

   So guidance lives behind an ⓘ, and behind ONE ⓘ. There was a labelled chip
   too — "How to draw this", for guidance about a whole screen — and the review
   after it pointed out that a screen-wide instruction has something to point at
   after all: the subtitle in the app bar that names what the screen is for.
   appBar({ help }) puts the button there; the chip has gone with the duplication.

   The sheet is the only place the words live. */

export function helpButton(body, { title, label, deckNote } = {}) {
  const name = label ?? t('help.what', 'What does this mean?');
  return h('button.iconbtn.iconbtn--bare', {
    type: 'button',
    onclick: (e) => { e.stopPropagation(); openSheet('HELP_NOTE', { title, body }); },
    'aria-label': name,
    title: name,
    style: { flex: '0 0 auto' },
    ...deckMark({ deckNote: deckNote ?? 'Opens the explanation behind this' }),
  }, icon('info', 20));
}

/* -- buttons ------------------------------------------------------------- */

export function btn(label, opts = {}) {
  const cls = ['btn'];
  if (opts.variant) cls.push(`btn--${opts.variant}`);
  if (opts.block !== false) cls.push('btn--block');
  if (opts.size) cls.push(`btn--${opts.size}`);
  return h(`button.${cls.join('.')}`, {
    onclick: opts.onclick, disabled: opts.disabled, type: 'button', ...deckMark(opts),
  }, when(opts.icon, () => icon(opts.icon, opts.size === 'big' || opts.size === 'huge' ? 26 : 20)),
     h('span', label),
     when(opts.sub, () => h('small', { style: { fontWeight: 500, opacity: .85 } }, opts.sub)));
}

/* -- the map band, A10 / A10D / A11 ---------------------------------------

   Review 01/09 (second pass) — "for A10, A10D and A11 let's make the map the
   same size, 65% of the screen, no margins left, right or top. Scroll up/down
   to show the rest."

   ONE SIZE ACROSS THE SCREENS THAT HAVE SOMETHING UNDER THE MAP — A10D, which
   carries a panel of fields, and A11, which carries the list of plots to
   approve. A10 uses the whole screen and always did: the third pass of the same
   review put it back, because nothing sits under A10's map but a warning that
   rarely appears, and 65% left a band of empty paper above the button.

   The band is a DIRECT CHILD of the scroll area — that is what makes `65%`
   mean 65% of the phone rather than 65% of nothing. A percentage height
   resolves against the nearest ancestor with a definite one, and `.page` has
   an auto height; `.app__scroll` is a flex item of a fixed-height column and
   does not. So a screen using this returns an ARRAY as its body, the band
   first, and puts everything else in the page after it.

   It bleeds to three edges. The fourth is the fold: what is under the map
   scrolls up over nothing, which is the second half of the note. */
export function mapBand(...children) {
  return h('div.mapband.mapbox', ...children);
}

/* -- "we are here to help" ------------------------------------------------

   Review 01/09 — F13's opening block, asked for at the bottom of the log in
   screen as well: "add 'we are here to help' and WhatsApp and email buttons at
   the bottom". Two screens carrying the same offer is exactly the case for one
   component — the labels, the channels and the order have to be the same in
   both places, and a farmer who cannot get past the front door is the person
   who needs it most.

   THE OPENING HOURS ARE NOT HERE. They were, under the heading, and the review
   struck them out: "remove as they are not calling us". Nobody is waiting for a
   switchboard to open to send a WhatsApp message.

   And the buttons are ordinary buttons. They were 92 dp tall against the 52 dp
   of the support-ticket button below them, which the review read as oversized —
   correctly: three ways to reach the same people should not be three sizes. */
export function helpBlock({ prominent = true } = {}) {
  return h('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px' } },
    h('p', { style: { margin: 0, fontSize: 'var(--t-lead)', fontWeight: 600 } },
      t('f13.here', 'We are here to help.')),
    // Review 01/09 — "remove 'us'". The button is the channel; who it reaches
    // is the heading above it.
    //
    // WF2.010 IS WHY `prominent` EXISTS. One primary action per SCREEN, and on
    // F13 that action is getting hold of somebody, so WhatsApp is filled. On A3
    // the screen's action is logging in; the same two buttons at the foot of it
    // are the way out for the farmer who cannot, and a second green button
    // under the form would be the app arguing with itself about what to press.
    btn(t('f13.whatsapp2', 'WhatsApp'), {
      variant: prominent ? 'primary' : 'secondary', icon: 'whatsapp',
      onclick: () => openModal('CONTACT_PREVIEW', { channel: 'whatsapp' }),
    }),
    btn(t('f13.email2', 'Email'), {
      variant: 'secondary', icon: 'mail',
      onclick: () => openModal('CONTACT_PREVIEW', { channel: 'email' }),
    }));
}

/** WF2.005 — the dock that keeps the primary action in the bottom third. */
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

/* THE CREDENTIAL SWITCH, ON A3 AND A5.

   Two equal halves in a track, the chosen one filled. It is not pillTabs: those
   are a FILTER over a list that stays on screen, and this is a fork — what is
   under it is replaced rather than narrowed, so the two halves are equal width
   and the selected one is solid rather than tinted.

   Why it replaced a text link: logging in by code and logging in by password
   were the same screen with a "Log in with email and password" link at the
   bottom, which made one route the screen and the other a footnote. A farmer
   who registered with an email had to read to the end to find out that his way
   in existed. Both are offered at the top now, before either form is read.

   Deliberately two options only. A segmented control is a fork; a third arm
   makes it a menu, and a menu belongs in a select. */
export function segmented(items, activeId, onSelect) {
  return h('div.segmented', { role: 'tablist' },
    items.map((item) => h('button.segmented__opt', {
      type: 'button', role: 'tab',
      'aria-selected': String(item.id === activeId),
      onclick: () => onSelect(item.id),
    }, when(item.icon, () => icon(item.icon, 17)), h('span', item.label))));
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

/* -- the compare divider — WF5.026 (plot) and WF5.067 (map) ------------------

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

/* THE WAY OFF A THUMBNAIL AND ONTO THE MAP TAB.

   B2 and B13 both draw a small map at the top of the screen and both need one
   way through to the real one. It was a flat translucent label in the corner —
   grey text on a blurred rectangle, which on a satellite photograph read as a
   caption somebody had forgotten to finish rather than as a control.

   It is a proper floating button now: white, its own shadow so it sits ON the
   image rather than in it, the glyph in a brand-tinted square, and the arrow
   that says it leads somewhere. Same target size, a quarter of the apology. */
export function openMapChip(onclick, label) {
  return h('button.mapopen', {
    onclick, type: 'button', ...deckMark({ deckTo: 'C1' }),
  },
  h('span.mapopen__glyph', icon('scan', 15)),
  h('span', label ?? t('b2.openmap', 'Open map')),
  h('span.mapopen__go', icon('forward', 13, 'flip')));
}

/**
 * A map control: one glyph, no caption. See .maptool in components.css for why
 * this is allowed to break WF2.014 when nothing else is. The label is required
 * — it becomes the accessible name and the tooltip — it just is not painted.
 */
export function mapTool(iconName, label, onclick, opts = {}) {
  return h(`button.maptool${opts.locked ? '.maptool--locked' : ''}`, {
    onclick, 'aria-label': label, title: label, type: 'button', ...deckMark(opts),
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

/* -- states, WF2.011 / WF2.012 --------------------------------------------- */

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

/* -- locked features, WF9.013 / WF9.014 ------------------------------------ */

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
  // WF5.087 / WF5.094 / WF6.022 — present, in the user's language, not dismissible.
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

/**
 * A single bar split by status, with the legend that makes it legible.
 *
 * The two are one component on purpose. WF2.008 forbids communicating status by
 * colour alone, and a proportion bar is nothing but colour — so the legend is
 * not optional decoration underneath it, it is the half that carries the icon,
 * the word and the number. Splitting them into two calls would let a screen
 * render the bar on its own, which is exactly the thing that must not happen.
 *
 * Zero counts are dropped rather than drawn as an empty sliver, so "no farms
 * are urgent" reads as an absence instead of a hairline nobody can measure.
 */
export function proportionBar(items) {
  const shown = items.filter((item) => item.count > 0);
  if (!shown.length) return null;
  return h('div.prop',
    h('div.prop__bar', shown.map((item) => h('span.prop__seg', {
      style: { flexGrow: String(item.count), background: `var(--st-${item.status})` },
    }))),
    h('div.prop__legend', shown.map((item) => h('span.prop__key',
      statusIcon(item.status, 15),
      h('b', String(item.count)),
      h('span', item.label)))));
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
