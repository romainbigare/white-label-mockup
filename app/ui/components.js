/* ---------------------------------------------------------------------------
   components.js — the shared kit, "soft cards" (v1.8).

   A screen is COMPOSED from these; it does not style. Each builder here has a
   class of the same name in styles/components.css, and README.md → "Design
   system" says which to reach for:

     page()        the scrolling column        appBar()    title, back, round buttons
     card()        a white soft card           titledCard() a card with a head band
     section()     an uppercase label + group  row()       one line of a list, in a card
     tile()        a tinted icon square        pill()      a tinted static label
     heroCard()    the one big number          minis()     small figures in a row
     dayStrip()    a week as sliding cards     callout()   a tinted note (disclaimer())
     btn()         56 dp buttons               actionDock() the action, pinned at the foot
     field()       a 56 dp box, label inside   segmented() / chips() / switchRow()
     sheetShell()  a bottom sheet with a close button
     emptyState() / errorState() / lockBox()

   Tones (brand, good, monitor, urgent, info, lock, tree, neutral) are passed
   as `tone` and become a .tone-* class; nothing here takes a colour.

   Two rules are enforced structurally here rather than by convention:
     * statusChip() always renders icon + word + colour (WF2.008/WF2.009). There is
       no way to render a bare coloured dot.
     * lockedRow()/lockBox() always route to the SAME upgrade sheet (WF9.014), so
       a screen cannot invent its own upsell.
   --------------------------------------------------------------------------- */

import { h, when } from '../core/dom.js';
import { icon } from './icons.js';
import { STATUS, statusLabel } from '../core/status.js';
import {
  t, tc, LANGUAGES, setLanguage,
} from '../core/i18n.js';
import { state, commit } from '../core/store.js';
import { back, canGoBack, openModal, openSheet, switchTab, closeOverlay } from '../core/router.js';
import { tabsFor } from '../core/capabilities.js';
import { lock, has, PLANS } from '../core/entitlements.js';
import { healthStatus } from '../core/health.js';

/* -- status -------------------------------------------------------------- */

export function statusIcon(key, size = 16) {
  const s = STATUS[key] ?? STATUS.nodata;
  return h('span', { class: `dot dot--${key}` }, icon(s.icon, size));
}

/** The state as a chip. `large` for a hero, `small` for a card in a grid
    (B1's plot cards), `plain` for the word and icon with no wash. */
export function statusChip(key, opts = {}) {
  const s = STATUS[key] ?? STATUS.nodata;
  return h(`span.status.status--${key}${opts.large ? '.status--lg' : ''}${opts.small ? '.status--sm' : ''}${opts.plain ? '.status--plain' : ''}`,
    icon(s.icon, opts.large ? 18 : opts.small ? 13 : 15),
    h('span', opts.label ?? statusLabel(key)));
}

export function healthScore(score, opts = {}) {
  const key = healthStatus(score);
  const label = score == null ? t('status.nodata', 'No data') : `${Math.round(score)}%`;
  return h('span.health-score', { class: `health-score health-score--${key}` },
    when(opts.icon, () => statusIcon(key, opts.size ?? 14)),
    h('span.health-score__value', label),
    h('span.health-score__label', statusLabel(key)));
}

/* -- app bar ------------------------------------------------------------- */

export function appBar({ title, subtitle, back: showBack = true, wrap = false, actions = [], onBack, onTitleTap, titleHint, help, deckNote, closeIcon = false }) {
  // A tappable title is the farm picker on B1: an account with several farms
  // moves between them from inside one, rather than by going back out to a
  // list. It is a button only when there is somewhere to go, so a title that
  // does nothing never looks like a control.
  // A screen whose headline is on the page itself (A9, A19) passes no title:
  // the bar is then only its round buttons.
  const titleBlock = title
    ? h(`div.appbar__title${wrap ? '.appbar__title--wrap' : ''}`,
      h('span', title, onTitleTap ? icon('chevronDown', 17) : null),
      subtitle ? h('small', subtitle) : null)
    : h('div.appbar__spacer');
  // The way back is a round white button. `closeIcon` draws an ✕ instead of
  // the arrow, for a screen that is a form laid over another (B4).
  return h('div.app__top',
    h('div.appbar',
      when(showBack && (canGoBack() || onBack), () => h('button.iconbtn.appbar__back', {
        onclick: onBack || back,
        'aria-label': closeIcon ? t('action.close', 'Close') : t('a11y.back', 'Back'),
      }, closeIcon ? icon('close', 22) : icon('back', 22, 'flip'))),
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
 * A control on the app bar: a round white button. The word is kept on it for
 * a screen reader (base.css hides it visually inside .appbar).
 *
 * `opts.title` is the fuller name, for the tooltip and the accessible name,
 * where the word on the bar has to be short enough to sit under a 22 px icon.
 * A16's boundary control is "Boundary" on screen and "Adjust the farm boundary"
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
      // Only the open tab spells its name; the others keep it for a screen
      // reader, and the floating bar stays one calm row of glyphs.
      h(`span.tab__label${tab.id === activeTab ? '' : '.vh'}`, t(tab.labelKey, labels[tab.labelKey])),
      when(badge > 0, () => h('span.tab__badge', String(badge))));
    }));
}

/* -- layout helpers ------------------------------------------------------ */

export function page(...children) {
  return h('div.page', ...children);
}

/* -- the small parts of the language -------------------------------------- */

/** A tinted icon square. size: 'sm' 36, default 44, 'lg' 72. `paper` puts the
    glyph on a raised white square instead of the wash. */
export function tile(iconName, { tone = 'brand', size, round = false, paper = false, dashed = false, iconSize } = {}) {
  const cls = ['tile', `tone-${tone}`];
  if (size) cls.push(`tile--${size}`);
  if (round) cls.push('tile--round');
  if (paper) cls.push('tile--paper');
  if (dashed) cls.push('tile--dashed');
  const px = iconSize ?? (size === 'sm' ? 19 : size === 'lg' ? 32 : 22);
  return h(`span.${cls.join('.')}`, icon(iconName, px));
}

/** A tinted label that is not a control: "3 fields · 9.9 ha", "Owner".
    `size: 'lg'` is the bolder, taller verdict chip — a measure's word in its
    state's tone (B1's farm health). */
export function pill(label, { tone = 'brand', iconName, size } = {}) {
  return h(`span.pill.tone-${tone}${size ? `.pill--${size}` : ''}`, when(iconName, () => icon(iconName, 16)), h('span', label));
}

/** A title written on the page rather than in the bar — the head of a sheet
    rising over a map (A16), with an optional pill or button at its end. */
export function pageHead({ title, subtitle, aside } = {}) {
  return h('div.pagehead',
    h('div.pagehead__titles',
      h('h1.pagehead__title', title),
      when(subtitle, () => h('small.pagehead__sub', subtitle))),
    aside ?? null);
}

/** A small uppercase label inside a card. */
export function eyebrow(text) {
  return h('p.eyebrow', text);
}

/** A round white 48 dp button with a glyph and no caption; the name is its
    accessible label. `glass` is the dark version, for over a photograph. */
export function roundButton(iconName, label, onclick, opts = {}) {
  return h(`button.roundbtn${opts.glass ? '.roundbtn--glass' : ''}`, {
    type: 'button', onclick, 'aria-label': label, title: label, disabled: opts.disabled, ...deckMark(opts),
  }, icon(iconName, opts.size ?? 22, opts.flip ? 'flip' : ''));
}

/* THE HERO CARD: the one fact a screen exists to say. An eyebrow in the tone's
   colour (with its glyph), the figure as large as the screen allows with its
   unit, then the line that says what to do and the line that explains it.
   `wash` fades the tone into white from the top — an urgent advice.
   `value` may be a word rather than a number (`textValue`), e.g. a pest's
   active ingredient. Anything else goes in `children`, after the body. */
export function heroCard({ tone = 'brand', wash = false, eyebrow: eb, iconName, heading, label, value, unit, aside, title, body, textValue = false } = {}, ...children) {
  return h(`div.hero.tone-${tone}${wash ? '.hero--wash' : ''}`,
    when(eb, () => h('div.hero__eyebrow', when(iconName, () => icon(iconName, 20)), h('span', eb))),
    when(heading, () => h('h2.hero__heading', heading)),
    when(label, () => h('div.hero__label', label)),
    when(value != null, () => h('div.hero__figure',
      h(`span.hero__value${textValue ? '.hero__value--text' : ''}`, value),
      when(unit, () => h('span.hero__unit', unit)),
      when(aside, () => h('span.hero__aside', aside)))),
    when(title, () => h('div.hero__title', title)),
    when(body, () => h('div.hero__body', body)),
    ...children);
}

/** A card that is one action: a tile, a title and a line under it — two of
    them side by side in a .choicegrid (B10's two ways to invite). */
export function actionCard(iconName, tone, title, sub, onclick, deckNote) {
  return card({ onclick, class: 'actioncard', deckNote },
    tile(iconName, { tone }),
    h('span.actioncard__title', title),
    when(sub, () => h('span.actioncard__sub', sub)));
}

/** Small figures side by side: [{ value, label }]. */
export function minis(items) {
  return h('div.minis', items.filter(Boolean).map((m) => h('div.mini', h('b', m.value), h('span', m.label))));
}

/* THE DAY STRIP: a week as small cards that slide sideways. Each day is
   { day, date, tone: 'good' | 'monitor' | 'urgent', iconName, text, value,
   valueSub }. A bad day is tinted and ringed; its glyph and words still say
   why. The strip scrolls on its own, so it is marked for the overflow audit. */
export function dayStrip(days, { label } = {}) {
  return h('div.daystrip', { 'data-hscroll': '', role: 'list', 'aria-label': label ?? null },
    days.map((d) => h(`div.daycard${d.tone && d.tone !== 'good' ? `.daycard--${d.tone}` : ''}`, { role: 'listitem' },
      h('div.daycard__head', h('b', d.day), when(d.date, () => h('span', d.date))),
      h('span.daycard__mark', icon(d.iconName ?? (d.tone === 'urgent' ? 'warning' : d.tone === 'monitor' ? 'eye' : 'check'), 20)),
      when(d.text, () => h('div.daycard__text', d.text)),
      when(d.value != null, () => h('div.daycard__value', d.value, when(d.valueSub, () => h('small', d.valueSub)))))));
}

/* `action` is a text button in the brand colour — "See all", "Edit". `aside` is
   anything else that belongs at the end of the rule and is not the section's own
   verb: D1 hangs the list's sort order there, because it governs the headings
   rather than the section it sits on. Both land after the rule, which is what
   `.section__head::after` grows to push them right. */
/* A SECTION WHOSE TITLE IS INSIDE ITS CARD.

   Review 21/09 made the same note three times on B2 — on the trend chart, on
   growth stage, and on disease and pest risk: "That box should probably be
   merged with the 'health score' label rather than sitting in its own separate
   category — visually they read as unrelated right now."

   He is describing what section() does. A section head is a rule ABOVE a card,
   which works where the title governs several cards and stops working where it
   governs exactly one — there the title and the card are one object drawn as
   two, with a gap between them the eye reads as a separation. So a block with a
   single card of its own uses this instead: one card, the title in it, the
   content under it. */
/* Review 22/09 sharpened it into a rule for the whole of B2 and B6: "all titles
   need to be included INSIDE the card container, top left, with a horizontal
   separator for content and an info button top right when useful. Right now
   when the title is in the card container, it's too low."

   BOTH HALVES OF THAT ARE ONE CAUSE. The title used to be the first child of
   the card's padding, sharing a row with the ⓘ — and an icon button is a 44 dp
   touch target, so the row it is in is 44 dp tall and a 17 px title centred in
   it sits nine pixels below the top of its own card. So the head is its own
   band now, with its own padding, the aside pulled tight to it, and the rule is
   the band's bottom border rather than a divider somebody remembered to add.
   `bleed` runs the content to the card's edges — a chart or a map has its own
   margins and does not want a second set. */
export function titledCard(title, opts = {}, ...children) {
  const body = opts.bleed ? h('div', {}, ...children) : cardPad(...children);
  return h('section.section',
    card(opts.card ?? {},
      h('div.cardhead',
        h('h3.cardhead__title', title),
        when(opts.aside, () => h('span.cardhead__aside', opts.aside))),
      body));
}

export function section(title, opts = {}, ...children) {
  return h('section.section',
    when(title, () => h('h2.section__head',
      h('span', title),
      when(opts.action, () => h('button.section__action', { onclick: opts.action.onclick }, opts.action.label)),
      when(opts.aside, () => opts.aside))),
    // A subtitle: one quiet line that belongs to the heading, set tight under it.
    when(opts.sub, () => h('p.section__sub', opts.sub)),
    ...children);
}

/* `accent` puts a status bar down the start edge (urgent, monitor, good).
   `tint` + `tone` make a wash with no shadow — a note that belongs to the page.
   `selected` rings the chosen one of several cards. */
export function card(opts = {}, ...children) {
  const cls = ['card'];
  if (opts.accent && opts.accent !== 'nodata') cls.push(`card--accent-${opts.accent}`);
  if (opts.onclick) cls.push('card--tap');
  if (opts.tint) cls.push('card--tint');
  if (opts.selected) cls.push('card--sel');
  if (opts.tone) cls.push(`tone-${opts.tone}`);
  if (opts.class) cls.push(...opts.class.split(' '));
  const props = opts.onclick
    ? { onclick: opts.onclick, type: 'button', disabled: opts.disabled, 'aria-pressed': opts.selected == null ? null : String(!!opts.selected), ...deckMark(opts) }
    : {};
  return h(`${opts.onclick ? 'button' : 'div'}.${cls.join('.')}`, props, ...children);
}

export function cardPad(...children) {
  return h('div.card__pad', ...children);
}

/* `iconName` draws the row's glyph in a small tinted tile (`tone`, brand by
   default); `lead` replaces the tile with anything else (an avatar). */
export function row({ title, sub, value, iconName, tone, lead, onclick, chevron = true, locked = false, statusKey, badge, deckTo, deckNote }) {
  const tag = onclick ? 'button.row' : 'div.row.row--static';
  return h(`${tag}${locked ? '.row--locked' : ''}`, onclick ? { onclick, type: 'button', ...deckMark({ deckTo, deckNote }) } : {},
    when(statusKey, () => statusIcon(statusKey, 18)),
    lead ?? null,
    // Trees always wear bark, whatever list they are in.
    when(iconName && !lead, () => tile(iconName, { tone: locked ? 'lock' : (tone ?? (iconName === 'tree' ? 'tree' : 'brand')), size: 'sm' })),
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

/* `sub` is a SECOND LINE, not a second phrase on the same one.

   It used to render as a sibling of the label inside a centred row, which put
   "WhatsApp @WafraGreentech" on one line and read as one long name. Review
   21/09 (second pass) asked for the contact details on the contact buttons "as
   a second line of content", and for B10's two invitation buttons to break
   after the dash and align left. Both are the same shape: a label, and under
   it the detail that qualifies it.

   `align: 'start'` is the left-aligned form. A button whose text runs to two
   lines of different lengths reads badly centred — the ragged edge is on both
   sides — and where the two buttons sit one above the other, as they do on
   B10, a shared left edge is what makes them a pair. */
export function btn(label, opts = {}) {
  const cls = ['btn'];
  if (opts.variant) cls.push(`btn--${opts.variant}`);
  if (opts.block !== false) cls.push('btn--block');
  if (opts.size) cls.push(`btn--${opts.size}`);
  if (opts.sub) cls.push('btn--stack');
  if (opts.align === 'start') cls.push('btn--start');
  return h(`button.${cls.join('.')}`, {
    onclick: opts.onclick, disabled: opts.disabled, type: 'button', ...deckMark(opts),
  }, when(opts.icon, () => icon(opts.icon, opts.size === 'big' || opts.size === 'huge' ? 26 : 20)),
     opts.sub
       ? h('span.btn__text', h('span', label), h('small', opts.sub))
       : h('span', label));
}

/* -- the map band, A13 / B9 / A16 ---------------------------------------

   Review 01/09 (second pass) — "for A13, B9 and A16 let's make the map the
   same size, 65% of the screen, no margins left, right or top. Scroll up/down
   to show the rest."

   ONE SIZE ACROSS THE SCREENS THAT HAVE SOMETHING UNDER THE MAP — B9, which
   carries a panel of fields, and A16, which carries the list of plots to
   approve. A13 uses the whole screen and always did: the third pass of the same
   review put it back, because nothing sits under A13's map but a warning that
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

   Review 01/09 — F17's opening block, asked for at the bottom of the log in
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
  const whatsapp = state.db.contact?.whatsappUser ?? '@WafraGreentech';
  const email = state.db.contact?.email ?? 'support@wafragreen.com';
  const open = (channel) => () => openModal('CONTACT_PREVIEW', { channel });
  // On F17 reaching somebody IS the screen's action, so WhatsApp is the
  // primary button (WF2.010). Anywhere else — the foot of a sign-in screen —
  // the same two channels are rows in one card, under the same words.
  if (!prominent) {
    return card({},
      h('div.cardhead', h('h3.cardhead__title', t('f13.here', 'We are here to help.'))),
      row({ iconName: 'whatsapp', tone: 'good', title: t('f13.whatsapp2', 'WhatsApp'), sub: whatsapp, onclick: open('whatsapp') }),
      row({ iconName: 'mail', tone: 'info', title: t('f13.email2', 'Email'), sub: email, onclick: open('email') }));
  }
  return h('div.page__block',
    h('p.lead.lead--strong', t('f13.here', 'We are here to help.')),
    btn(t('f13.whatsapp2', 'WhatsApp'), { variant: 'primary', icon: 'whatsapp', align: 'start', sub: whatsapp, onclick: open('whatsapp') }),
    btn(t('f13.email2', 'Email'), { variant: 'secondary', icon: 'mail', align: 'start', sub: email, onclick: open('email') }));
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

/* A SEGMENTED CONTROL — one track, N halves, exactly one lit.

   Added at review 21/09 (second pass) for A17's billing period: "maybe also use
   something else than a checkbox to toggle between yearly and monthly." A
   checkbox was the deck's own drawing and it was the wrong instrument. A tick
   box asks a yes/no about ONE thing; monthly and annual are two values of one
   thing, and the control that says that is a switch with both words on it. It
   also answers the question a checkbox could not — which one am I looking at
   now — without reading the title again.

   It is not `chips()`. Chips are a row of independent filters that can all be
   off; this is a single value that is always set, and the shared track is what
   carries that difference to the eye. */
/* `size` names a dress, not a scale: 'sm' is a tighter switch, 'pill' is as
   wide as its words. Any name here needs a .segmented--<name> rule. */
export function segmented(items, activeId, onSelect, opts = {}) {
  return h(`div.segmented${opts.size ? `.segmented--${opts.size}` : ''}`, { role: 'tablist' },
    items.map((item) => h('button.segmented__seg', {
      type: 'button', role: 'tab',
      'aria-selected': String(item.id === activeId),
      onclick: () => onSelect(item.id),
      ...deckMark(item),
    }, h('span', item.label),
       when(item.sub, () => h('small', item.sub)))));
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

/* A FIELD IS A BOX WITH ITS LABEL INSIDE. For a text input, a select or a
   textarea the label sits small at the top of a 56 dp white box and the value
   under it; the whole box is the target and takes the focus ring. Any other
   control — a segmented switch, chips, a radio list — keeps its own shape and
   gets the label above it, in the section-label voice.

   `suffix` is a unit pill at the end of a number box ("ha", "Trees"). */
const BOXED = 'input.input, select.select, textarea.textarea';

export function field(label, control, opts = {}) {
  const labelEl = (cls) => when(label, () => h(`span.${cls}`,
    h('span', label),
    when(opts.required, () => h('span.req', ' *'))));
  const boxed = control instanceof Element && control.matches(BOXED);
  return h('div.field',
    boxed
      ? h(`label.field__box${opts.suffix ? '.field__box--suffix' : ''}${opts.error ? '.field__box--invalid' : ''}`,
        labelEl('field__label'),
        control,
        when(opts.suffix, () => h('span.field__suffix', opts.suffix)))
      : [labelEl('field__label.field__label--above'), control],
    when(opts.hint, () => h('div.field__hint', opts.hint)),
    when(opts.error, () => h('div.field__error', opts.error)));
}

/** A box with no label — the dial code beside a phone number. */
export function fieldBox(control) {
  return h('label.field__box.field__box--bare', control);
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

/** A search box: a 56 dp field with the magnifier at its start. */
export function searchInput(props = {}) {
  return h('div.searchbox', icon('search', 20), input({ type: 'search', ...props }));
}

export function textarea(props = {}) {
  return textField('textarea.textarea', props);
}

export function select(options, value, onchange, props = {}) {
  const el = h('select.select', {
    onchange: (e) => onchange(e.target.value), ...props,
  }, options.map((o) => h('option', {
    value: o.value ?? o, selected: (o.value ?? o) === value,
  }, o.label ?? o)));
  // Again, once the options are in it. Each option was marked selected
  // before it had a <select> to belong to, and Safari does not reliably carry
  // that across: the box showed its first option, English, over an Arabic app.
  el.value = value;
  return el;
}

/* -- choosing a language --------------------------------------------------

   WF4.011 … WF4.016, and the one design the app uses everywhere the question is
   asked: in the sheet A1 raises at first launch, and in the one A20 and the
   settings row open afterwards.

   ONE FLAT LIST, WHICH IS WHAT REVIEW 06/09 DREW. It was two tiles and a
   drop-down — Arabic and English on the front, the other seven filed behind a
   picker — and the only reason for the split was WF4.013: nine rows would not
   fit the first screen of the app without scrolling. The reviewer pasted in the
   pattern he wants instead, a bottom sheet of equal rows each carrying its code
   and a radio button, and a sheet is allowed to scroll. So the tier goes, and
   ten languages stand as ten peers.

   THE CODE CHIP IS THE ONE THING THE ROW SAYS IN LATIN. Each language is named
   only in its own script (WF4.011) — an English gloss helps nobody who needs
   this control — but a two-letter chip is a landmark rather than a translation,
   and it is how a farmer who cannot read the script above finds the row he was
   told to press. The accessible name is the language named in the app's
   current language — "English" in English — where a screen reader reaches it
   and nobody else does.
*/
export function languageChoice({ onchoose } = {}) {
  const current = state.session.lang;
  const choose = (code) => { setLanguage(code); onchoose?.(code); };

  return h('div.langlist', LANGUAGES.map((lang) => h('button.langrow', {
    type: 'button',
    role: 'radio',
    onclick: () => choose(lang.code),                 // WF4.015 — mirrors immediately
    'aria-checked': String(lang.code === current),
    'aria-label': t(`lang.${lang.code}`, lang.english),
    'data-on': lang.code === current ? '' : null,
  },
  h('span.langrow__code', lang.code),
  // Isolated rather than dir="rtl": the Arabic characters carry their own
  // direction, so the word renders right-to-left inside a row that still
  // begins where every other row begins.
  h('span.langrow__name', {
    lang: lang.code,
    style: { fontSize: `calc(var(--t-lead) * ${lang.scale ?? 1})`, unicodeBidi: 'isolate' },
  }, lang.native),
  h('span.langrow__mark'))));
}

export function checkbox(label, checked, onchange) {
  return h('label.check',
    h('input', { type: 'checkbox', checked, onchange: (e) => onchange(e.target.checked) }),
    h('span.check__text', label));
}

/* -- the compare divider — WF5.026 (plot) and WF5.067 (map) ------------------

   Both places are the same thing: a full-area, invisible slider laid over an
   image, with a white line where the two dates meet.

   It is the one control here that does NOT re-render as it moves, for a
   concrete reason. A render replaces the DOM wholesale, and replacing the very
   node the pointer is dragging releases the browser's pointer capture — so a
   divider that committed on every move stopped following the finger after the
   first pixel. Instead the handler writes the position to a --split custom
   property on the stage, and everything that moves is expressed in terms of
   it: the line, the clip over the plot raster, and the clip rect inside the map
   SVG. The state commits once, on release.

   --split is a PHYSICAL offset from the left, not an inline-start one. An image
   comparison is spatial, so it does not mirror for Arabic; the imagery
   underneath it does not either.

   IT IS NOT AN <input type="range"> ANY MORE, for two reasons found on a touch
   screen. A range input DOES mirror in a right-to-left page, so in Arabic the
   line went left as the finger went right. And iOS moves a range input only
   when the touch lands on its thumb, which here was invisible: a farmer had to
   find a 28-pixel spot nobody could see. This one takes the finger wherever it
   lands on the picture, reads it in physical pixels, and keeps the keyboard and
   the screen reader through role="slider". */

export function compareStage(pct, props = {}, ...children) {
  const { style = {}, ...rest } = props;
  return h('div.compare', { ...rest, style: { ...style, '--split': `${pct}%` } }, ...children);
}

export function compareSlider({ value, min = 0, max = 100, onRelease, label }) {
  let pct = value;
  const paint = (el, next) => {
    pct = Math.round(Math.max(min, Math.min(max, next)));
    el.closest('.compare')?.style.setProperty('--split', `${pct}%`);
    el.setAttribute('aria-valuenow', String(pct));
  };
  const under = (el, e) => {
    const r = el.getBoundingClientRect();
    return ((e.clientX - r.left) / r.width) * 100;
  };
  return h('div.compare__slider', {
    role: 'slider', tabindex: 0, 'aria-label': label, 'aria-orientation': 'horizontal',
    // So a key press, which commits and so re-renders, leaves the focus here
    // for the next one (captureFocus in shell.js).
    'data-field': 'compare-divider',
    'aria-valuemin': String(min), 'aria-valuemax': String(max), 'aria-valuenow': String(value),
    onpointerdown: (e) => {
      if (e.button > 0) return;
      const el = e.currentTarget;
      e.preventDefault();
      el.focus({ preventScroll: true });
      el.setPointerCapture(e.pointerId);
      paint(el, under(el, e));
      const move = (m) => { if (m.pointerId === e.pointerId) paint(el, under(el, m)); };
      const end = (u) => {
        if (u.pointerId !== e.pointerId) return;
        for (const [type, fn] of [['pointermove', move], ['pointerup', end], ['pointercancel', end]]) el.removeEventListener(type, fn);
        onRelease(pct);
      };
      el.addEventListener('pointermove', move);
      el.addEventListener('pointerup', end);
      el.addEventListener('pointercancel', end);
    },
    // Arrow keys move the line the way they point, in either direction of text.
    onkeydown: (e) => {
      const step = { ArrowLeft: -5, ArrowRight: 5, ArrowDown: -5, ArrowUp: 5, Home: -Infinity, End: Infinity }[e.key];
      if (step === undefined) return;
      e.preventDefault();
      paint(e.currentTarget, Number.isFinite(step) ? pct + step : step);
      onRelease(pct);
    },
  });
}

export function compareLine(size = 38) {
  return h('div.compare__line', h('span.compare__grip', { style: { width: `${size}px`, height: `${size}px` } },
    icon('compare', Math.round(size * 0.53))));
}

/* THE WAY OFF A THUMBNAIL AND ONTO THE MAP TAB.

   B1 and B5 both draw a small map at the top of the screen and both need one
   way through to the real one. It was a flat translucent label in the corner —
   grey text on a blurred rectangle, which on a satellite photograph read as a
   caption somebody had forgotten to finish rather than as a control.

   It is a proper floating button now: white, its own shadow so it sits ON the
   image rather than in it, the glyph in a brand-tinted square, and the arrow
   that says it leads somewhere. Same target size, a quarter of the apology. */
/* THE EXPAND BUTTON on a map in a page — B1, B2, B5 — which opens the map
   screen (C1), where the metrics are chosen. A bare glyph since v1.7.4: the
   words "View metrics" came off the picture, and stay as the button's name
   for a screen reader and a long press. */
export function openMapChip(onclick) {
  const label = t('map.viewmetrics', 'View metrics');
  return h('button.mapopen', {
    onclick, type: 'button', 'aria-label': label, title: label, ...deckMark({ deckTo: 'C1' }),
  }, icon('scan', 20));
}

/**
 * A map control: one glyph, no caption. See .maptool in components.css for why
 * this is allowed to break WF2.014 when nothing else is. The label is required
 * — it becomes the accessible name and the tooltip — it just is not painted.
 */
export function mapTool(iconName, label, onclick, opts = {}) {
  return h(`button.maptool${opts.locked ? '.maptool--locked' : ''}${opts.on ? '.maptool--on' : ''}`, {
    onclick, 'aria-label': label, title: label, type: 'button', disabled: opts.disabled,
    'aria-pressed': opts.on == null ? null : String(!!opts.on), ...deckMark(opts),
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
    when(action, () => btn(action.label, { variant: 'primary', icon: action.icon, onclick: action.onclick, block: false })));
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
    when(code, () => h('div', { style: { fontSize: 'var(--t-micro)', color: 'var(--ink-500)' } }, t('state.error.ref', 'Ref {code}', { code }))));
}

/* -- locked features, WF9.013 / WF9.014 ------------------------------------ */

export function upgradeSheet(featureKey) {
  openModal('UPGRADE', { featureKey });
}

/* A lock's copy in the reader's language. entitlements.js keeps it in English
   per feature, so the name and the benefit are keyed by the feature; the plan
   it names is keyed by its own English, as a crop is, because forty features
   share a handful of plan names. */
export function lockCopy(featureKey) {
  const info = lock(featureKey);
  return {
    ...info,
    plan: tc(`lockplan.${info.plan}`, info.plan),
    name: tc(`lock.${featureKey}.name`, info.name),
    benefit: tc(`lock.${featureKey}.benefit`, info.benefit),
  };
}

export function lockedRow(featureKey, title, sub) {
  return row({ title, sub, locked: true, onclick: () => upgradeSheet(featureKey), chevron: false });
}

export function lockBox(featureKey, opts = {}) {
  const info = lockCopy(featureKey);
  return h('button.lockbox', { onclick: () => upgradeSheet(featureKey), type: 'button' },
    tile('lock', { tone: 'lock', size: 'lg', paper: true, iconSize: 32 }),
    h('span.lockbox__title', opts.title ?? info.name),
    h('span.lockbox__body', opts.body ?? info.benefit),
    h('span.locked', icon('star', 18), t('locked.cta', 'See {plan} plan', { plan: info.plan })));
}

/* A plan's name in the reader's language — "Basic", "Premium", or the expired
   trial. entitlements.js keeps the English and the key; every screen that
   names a plan asks here, so F5, the plan chooser and A17 say the same word. */
export function planName(id = state.session.plan) {
  const plan = PLANS[id];
  return plan ? t(plan.nameKey, plan.label) : '—';
}

/* -- misc ---------------------------------------------------------------- */

export function disclaimer(text, strong = false) {
  // WF5.087 / WF5.094 / WF6.022 — present, in the user's language, not dismissible.
  return h(`div.disclaimer${strong ? '.disclaimer--strong' : ''}`,
    icon(strong ? 'warning' : 'info', 20),
    h('span', text));
}

/** A tinted note with its icon. `card: true` draws it as a white card with the
    icon in a tile instead of a wash (B8's explanation under the chart). */
export function callout(text, { tone = 'info', iconName = 'info', card: asCard = false } = {}) {
  return asCard
    ? h(`div.callout.callout--card.tone-${tone}`, tile(iconName, { tone, size: 'sm' }), h('span', text))
    : h(`div.callout.tone-${tone}`, icon(iconName, 20), h('span', text));
}

export function meter(label, value, opts = {}) {
  return h('div.meter',
    when(label, () => h('span.meter__label', label)),
    h('span.meter__track', h('span.meter__fill', {
      style: { width: `${Math.max(0, Math.min(100, value))}%`, background: opts.colour ?? 'var(--brand-600)' },
    })),
    h('span.meter__val', opts.text ?? `${Math.round(value)}%`));
}

/** Two letters for a person: give it their initials, or their name. */
export function avatar(nameOrInitials = '', opts = {}) {
  const text = String(nameOrInitials);
  return h(`span.avatar${opts.large ? '.avatar--lg' : ''}`, text.length > 3 ? initials(text) : text);
}

export function initials(name = '') {
  return String(name).split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
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

/* A bottom sheet: a grip to drag it down by, a bold title with a round close
   button at its end, and the body on the canvas — cards inside it, as on a
   page. */
export function sheetShell(title, ...body) {
  return h('div.sheet',
    h('div.sheet__grip', { onpointerdown: dragToClose }),
    h('div.sheet__body',
      when(title, () => h('div.sheet__head',
        h('h2.sheet__title', title),
        roundButton('close', t('action.close', 'Close'), closeOverlay))),
      ...body));
}

/* THE GRIP IS A HANDLE, SO IT PULLS. A sheet on a phone is closed by dragging
   it down, and a grip that only drew the promise had a touch-screen visitor
   tugging at a picture of a handle. Tapping the shade above still closes it.

   The sheet follows the finger by transform alone — no commit, so nothing is
   re-rendered under the pointer mid-drag — and is let go past a quarter of its
   height (or 120 px, whichever is less); short of that it settles back. Only a
   sheet in the overlay layer: a sheet drawn into a screen (C3) is the screen. */
function dragToClose(e) {
  const sheet = e.currentTarget.closest('.sheet');
  if (e.button > 0 || !sheet?.parentElement?.classList.contains('overlay')) return;
  const grip = e.currentTarget;
  e.preventDefault();
  grip.setPointerCapture(e.pointerId);
  const y0 = e.clientY;
  let dy = 0;
  sheet.style.transition = 'none';
  const move = (m) => {
    if (m.pointerId !== e.pointerId) return;
    dy = Math.max(0, m.clientY - y0);
    sheet.style.transform = `translateY(${dy}px)`;
  };
  const end = (u) => {
    if (u.pointerId !== e.pointerId) return;
    for (const [type, fn] of [['pointermove', move], ['pointerup', end], ['pointercancel', end]]) grip.removeEventListener(type, fn);
    if (u.type === 'pointerup' && dy > Math.min(120, sheet.offsetHeight / 4)) { closeOverlay(); return; }
    sheet.style.transition = 'transform .18s ease-out';
    sheet.style.transform = '';
  };
  grip.addEventListener('pointermove', move);
  grip.addEventListener('pointerup', end);
  grip.addEventListener('pointercancel', end);
}

export function divider() {
  return h('div', { style: { height: '1px', background: 'var(--ink-200)' } });
}

export { openSheet, openModal };
