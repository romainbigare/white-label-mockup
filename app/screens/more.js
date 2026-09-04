/* ---------------------------------------------------------------------------
   more.js — F0 More, F1 Reports, F5/F6 Subscription, F7–F10 Settings,
   F11 Activity log, F12 Help, F13 Contact, F14 Profile.

   WF5.160 filters the menu by role, and it does so through can() rather than a
   role name, so the Worker's short list is a consequence of the capability
   matrix rather than a second hard-coded menu.

   There is no Team and access screen. Access to a farm is granted by inviting a
   person from their WORKER RECORD (§5.6), which is the one place the owner has
   already described them — a separate team screen made two lists of the same
   people and gave the invitation code nothing to attach to.
   --------------------------------------------------------------------------- */

import { h, when } from '../core/dom.js';
import { state, commit, toast, resetData } from '../core/store.js';
import { local } from '../core/local.js';
import { t, LANGUAGES, langMeta, missingReport } from '../core/i18n.js';
import { go, openSheet, openModal, back, enterOnboarding } from '../core/router.js';
import { icon } from '../ui/icons.js';
import {
  appBar, barAction, page, section, card, cardPad, row, btn, actionDock, statusChip,
  statusIcon, kv, emptyState, disclaimer, lockedRow, req, chips, select, field, input,
  switchRow, avatar, divider, radioList, pillTabs, languageChoice,
} from '../ui/components.js';
import { num, date, dateTime, ago, price, priceBare, bytes, area, clock, tempC, speed } from '../core/format.js';
import { visibleFarms, farmById, membersOf, memberById, me, activityFor, plotsOf } from '../data/selectors.js';
import { can, ROLE_LABEL, MATRIX, grantFor } from '../core/capabilities.js';
import { has, planLabel, PLANS, offeredFamily } from '../core/entitlements.js';
import { syncNow, clearCache } from '../data/actions.js';
import { RATES, ANNUAL_DISCOUNT, openTour } from './onboarding.js';

const APP_VERSION = '1.0.0';
const BUILD = '214';

/* -- F0 · More ------------------------------------------------------------ */

export function F0() {
  const person = me();
  const farms = visibleFarms();

  return {
    top: h('div.app__top', h('div.appbar.appbar--large', h('div.appbar__title', t('nav.more', 'More')))),
    body: page(
      card({ onclick: () => go('F14') }, cardPad(
        h('div', { style: { display: 'flex', alignItems: 'center', gap: '12px' } },
          avatar(person.initials, { large: true }),
          h('div', { style: { flex: 1 } },
            h('div', { style: { fontWeight: 650, fontSize: 'var(--t-lead)' } }, person.name),
            h('div', { style: { color: 'var(--ink-600)' } }, t(`role.${state.session.role}`, ROLE_LABEL[state.session.role])),
            h('div', { style: { color: 'var(--ink-500)', fontSize: 'var(--t-meta)' } }, person.phone)),
          h('span', { style: { color: 'var(--ink-400)', display: 'flex' } }, icon('forward', 20, 'flip'))))),

      // WF5.126 — contents filtered by role.
      card({},
        // Everything the app has sent, in one list. It lives here rather than
        // behind a bell on Home: WF7.007's promise is that a message opens the
        // exact thing it is about, and that is a place to go back to, not a
        // count to clear off the busiest screen in the app.
        // An envelope, not a second bell: the bell four rows below is the
        // setting that decides what buzzes the phone, and this is the list of
        // what was already sent.
        row({
          iconName: 'mail', title: t('nav.alerts', 'Alerts'),
          sub: t('f0.alerts.sub', 'Everything we have sent you'),
          onclick: () => openSheet('NOTIFICATIONS'),
        }),
        when(can('report.view'), () => row({ iconName: 'document', title: t('f1.title', 'Reports'), onclick: () => go(`F1:${farms[0]?.id ?? ''}`) })),
        // WEATHER LIVES HERE NOW. It used to be a block on the farm screen,
        // shown every time the app opened whether or not anyone had come to
        // read it; the review moved it to the menu of extra things, which is
        // where a fourteen-day forecast belongs.
        when(farms.length, () => row({
          iconName: 'sun', title: t('f15.title', 'Weather'),
          sub: t('f15.sub', 'Forecast and warnings for your land'),
          onclick: () => go(`F15:${farms[0].id}`),
        })),
        when(can('subscription.view'), () => row({
          iconName: 'card', title: t('f5.title', 'Subscription'), value: planLabel(), onclick: () => go('F5'),
        })),
        when(can('auditlog.view'), () => row({ iconName: 'list', title: t('f11.title', 'Activity log'), onclick: () => go('F11:all') }))),

      card({},
        row({ iconName: 'settings', title: t('f7.title', 'Settings'), onclick: () => go('F7') }),
        row({ iconName: 'language', title: t('f8.title', 'Language and region'), value: langMeta().english, onclick: () => go('F8') }),
        row({ iconName: 'bell', title: t('f9.title', 'Notifications'), onclick: () => go('F9') }),
        row({ iconName: 'storage', title: t('f10.title', 'Data and storage'), onclick: () => go('F10') })),

      card({},
        row({ iconName: 'help', title: t('f12.title', 'Help and user guide'), onclick: () => go('F12') }),
        row({ iconName: 'phone', title: t('f13.title', 'Contact Wafra'), onclick: () => go('F13') })),

      // WF5.161 — version and build are always visible on this screen.
      h('div', { style: { textAlign: 'center', color: 'var(--ink-500)', fontSize: 'var(--t-meta)' } },
        `Wafra Farm App v${APP_VERSION} (build ${BUILD})`, req('WF5.161')),
      btn(t('more.logout', 'Log out'), {
        variant: 'ghost',
        onclick: () => openModal('CONFIRM', {
          title: t('more.logout', 'Log out'),
          // WF4.084 — warn if anything is unsynced before clearing the cache.
          body: state.session.pendingSync > 0
            ? t('more.logout.unsynced', 'You have {n} items that have not been sent yet. Logging out clears them along with your saved imagery.', { n: state.session.pendingSync })
            : t('more.logout.body', 'Logging out clears the imagery and photos saved on this phone.'),
          confirmLabel: t('more.logout', 'Log out'),
          destructive: true,
          onConfirm: () => enterOnboarding('A3'),
        }),
      })),
  };
}

/* -- F1 · Reports, WF5.128 … WF5.130 --------------------------------------- */

export function F1(farmId) {
  const farm = farmById(farmId);
  const reports = state.db.reports;
  const automatic = reports.filter((r) => r.kind === 'weekly' || r.kind === 'monthly').slice(0, 2);
  const previous = reports.slice(2);

  const CREATE = [
    { id: 'health', label: 'Farm health summary', feature: null },
    { id: 'irrigation', label: 'Irrigation: advised vs applied', feature: null },
    { id: 'work', label: 'Advice acted on', feature: null },
    { id: 'cycles', label: 'Crop cycle summary', feature: null },
    { id: 'trees', label: 'Tree health summary', feature: 'tree.list' },
  ];

  return {
    top: appBar({ title: t('f1.title', 'Reports'), subtitle: farm.name }),
    body: page(
      h('button.chip', { onclick: () => openSheet('FARM_PICKER', { onPick: (id) => go(`F1:${id}`, { replace: true }) }), style: { alignSelf: 'flex-start' } },
        icon('home', 16), h('span', farm.name), icon('chevronDown', 15)),

      section(t('f1.automatic', 'Automatic'), {},
        card({}, automatic.map((r) => (r.state === 'locked'
          // WF5.132 — reports outside the plan appear locked, not hidden.
          ? lockedRow('report.monthly', r.title, t('f1.requires', 'Requires the {p} plan', { p: r.requiredPlan }))
          : row({
              iconName: 'document', title: r.title, sub: r.period,
              value: t('f1.ready', 'Ready'), onclick: () => openSheet('REPORT', { reportId: r.id }),
            }))))),

      section(t('f1.create', 'Create'), {},
        card({}, CREATE.map((c) => row({
          iconName: 'chart', title: t(`f1.create.${c.id}`, c.label),
          onclick: () => openSheet('REPORT', { reportId: c.id, custom: true }),
        })))),

      section(t('f1.previous', 'Previous'), {},
        card({}, previous.map((r) => row({
          title: r.title, sub: r.period, value: bytes(r.sizeKb / 1024),
          onclick: () => openSheet('REPORT', { reportId: r.id }),
        })))),

      disclaimer(t('f1.note', 'Reports are produced on our servers as PDF, in the language you ask for, with Wafra branding only. Tabular reports also export to Excel.'))),
  };
}

/* -- F5 · Subscription, WF5.174 … WF5.179 --------------------------------
   §9.1.3 replaced the purchase methodology outright, and the part that changes
   this screen is WF5.178: where the subscription was bought on the WEB, this
   screen states that billing is managed outside the app, offers no purchase or
   upgrade control, and does not link to the web page.

   That is not a styling preference. Apple's Guideline 3.1.1 forbids an app from
   steering a user to an outside purchase, and the external-purchase-link
   entitlements that would allow it do not exist in Saudi Arabia or the UAE
   (WF9.023). So the app cannot advertise, describe, link to or hint at the web
   route — which is why there is no "buy on the web" branch below, not even a
   disabled one. There are no codes to redeem either: WF9.021 writes the
   entitlement straight against the account, and the user simply signs in and
   finds the subscription active.

   The price is shown the same way A13 shows it — the quantities, the rate and
   the total — because the farmer's holding changes and a bill he cannot check
   is a bill he will ring up about. */


export function F5() {
  const farms = visibleFarms();
  const plan = PLANS[state.session.plan];
  const family = offeredFamily(farms);
  const cropHa = farms.filter((f) => f.type !== 'trees').reduce((sum, f) => sum + f.areaHa, 0);
  const treeCount = farms.filter((f) => f.type !== 'crops').reduce((sum, f) => sum + f.treeCount, 0);
  // One rate table, shared with A13 (WF4.102 puts it on the server in the
  // product). Two copies is how the signup price and the bill start disagreeing.
  const tier = plan.tier === 'Pro' ? 'pro' : 'basic';

  const lines = [];
  let usd = 0;
  if (family !== 'tree' && cropHa > 0) {
    usd += cropHa * RATES.crop[tier];
    lines.push([`${area(cropHa)} ${t('f5.crops', 'crops')}`, priceBare(cropHa * RATES.crop[tier], 'SA')]);
  }
  if (family !== 'crop' && treeCount > 0) {
    usd += treeCount * RATES.tree[tier];
    lines.push([t('farm.treecount', '{n} trees', { n: num(treeCount) }), priceBare(treeCount * RATES.tree[tier], 'SA')]);
  }

  // In the product this comes back with the entitlement (WF5.177). Here it is
  // the harness's way of showing both halves of WF5.176 / WF5.178.
  const boughtOnWeb = state.session.purchasePath === 'web';

  return {
    top: appBar({ title: t('f5.title', 'Subscription') }),
    body: page(
      // WF5.175 — trial status shows days remaining, prominently, from day one.
      when(state.session.trialDaysLeft > 0 && state.session.plan !== 'trial_expired', () => card({ accent: 'watch' }, cardPad(
        h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
          icon('clock', 20),
          h('span', { style: { fontWeight: 700 } }, t('f5.trial', 'Free trial — {n} days left', { n: num(state.session.trialDaysLeft) }))),
        h('div', { style: { color: 'var(--ink-600)' } },
          t('f5.trial.body', 'After that, your farms, boundaries and history stay put, but new analytics and advice are paused until you subscribe.')),
        req('WF5.175')))),

      when(state.session.plan === 'trial_expired', () => card({ accent: 'urgent' }, cardPad(
        h('div', { style: { fontWeight: 700 } }, t('f5.expired', 'Your trial has ended')),
        h('div', { style: { color: 'var(--ink-600)' } },
          t('f5.expired.body', 'Your farms, boundaries, history and past reports are still here. New analytics, advice and task creation are paused until you subscribe. We keep your data for 12 months.')),
        req('WF9.032')))),

      // WF4.107 — one product, one price, one renewal date.
      card({}, cardPad(
        h('div', { style: { fontWeight: 750, letterSpacing: '.06em', fontSize: 'var(--t-meta)', color: 'var(--brand-700)' } },
          plan.label.toUpperCase()),
        h('div', { style: { color: 'var(--ink-600)' } },
          t('f5.farmcount', '{n} farms', { n: num(farms.length) })),
        kv(lines),
        h('div.num', `${priceBare(usd, 'SA')} / ${t('unit.month', 'month')}`),
        // The same VAT position A13 takes, in the same words, on the screen
        // where the farmer checks what he is being charged.
        h('div', { style: { fontSize: 'var(--t-meta)', color: 'var(--ink-600)', fontWeight: 600 } },
          t('a13.plusvat', '+ VAT')),
        // The annual rate as a FIGURE, in the same shape A13 states it, rather
        // than as a sentence about a discount. "15% off" leaves the farmer to
        // do the arithmetic on his own bill; the number is what he compares.
        h('div', { style: { fontSize: 'var(--t-meta)', color: 'var(--brand-700)', fontWeight: 650 } },
          t('a13.annualrate', '{price} / month paid annually — save {pct}', {
            price: priceBare(usd * (1 - ANNUAL_DISCOUNT), 'SA'),
            pct: `${num(Math.round(ANNUAL_DISCOUNT * 100))}%`,
          })),
        h('div', { style: { color: 'var(--ink-600)', fontSize: 'var(--t-meta)' } },
          t('f5.renews', 'Renews {date}', { date: date('2026-09-01') })),
        h('div', { style: { color: 'var(--ink-700)', fontSize: 'var(--t-meta)' } },
          t('a13.cancel', 'You can cancel the renewal of your monthly or annual subscription at any time in the App Store or Google Play.')),
        h('div', { style: { display: 'flex', gap: '8px', marginTop: '4px' } },
          btn(t('f6.title', 'Compare plans'), { variant: 'secondary', size: 'sm', block: false, onclick: () => go('F6') }),
          // WF5.178 — no purchase or upgrade control where it was bought on the web.
          when(!boughtOnWeb, () => btn(t('f5.change', 'Change'), {
            variant: 'primary', size: 'sm', block: false, onclick: () => openSheet('PLAN_CHOOSER'),
          }))))),

      when(family === 'combined', () => disclaimer(
        t('f5.combined', 'Your combined plan covers both crops and trees under one price and one renewal date.'))),

      card({},
        boughtOnWeb
          // WF5.178 — say where billing lives, and do not link to it.
          ? row({
            iconName: 'card',
            title: t('f5.web', 'Billing is managed outside the app'),
            sub: t('f5.web.sub', 'This subscription was not bought here, so it cannot be changed here.'),
            chevron: false,
          })
          // WF5.176 — bought in the app, so it is the store's to manage.
          : row({
            iconName: 'card',
            title: t('f5.manage', 'Manage billing in the App Store'),
            onclick: () => toast(t('f5.store', 'Opening the App Store…')),
          }),
        // WF5.179 — informational only. It opens F13 and never quotes a price
        // or takes payment.
        row({
          iconName: 'phone',
          title: t('f5.invoice', 'Need an invoice, an annual contract or seats for a team?'),
          sub: t('f5.invoice.sub', 'Contact Wafra'),
          onclick: () => go('F13'),
        })),

      // WF4.110 — a downgrade names the farms that block it.
      when(family === 'combined', () => disclaimer(
        t('f5.downgrade', 'To switch to a crops-only or trees-only plan, you’d first need to archive the farms of the other type. We’ll show you which ones.'))),

      h('div', { style: { fontSize: 'var(--t-micro)', color: 'var(--ink-500)' } },
        // WF5.177 — never the local receipt, and never which path paid for it.
        t('f5.serverside', 'Access is checked by our servers on every request — it doesn’t depend on this phone or on how the subscription was bought.'),
        req('WF5.177'))),
  };
}

/* -- F6 · Compare plans, WF9.001 … WF9.003 --------------------------------
   Rebuilt around what the old table actually said. It was two columns, Basic
   and Pro, with a tick or a cross in each — and the great majority of its rows
   read "yes | yes". Sixty rows of two identical ticks is not a comparison; it
   is a feature list wearing a comparison's clothes, and it made the page long
   enough that nobody reached the differences at the bottom of each group.

   So the PLAN is the row now. Each group says what Basic includes, then what
   Pro adds — which is the shape of the product (WF9.003: everything in Basic is
   in Pro) and which prints each feature exactly once.

   And the page is filtered to what the account holds. A farmer growing wheat
   was reading tree features to decide about crops; he chose crops-or-trees
   before the survey ran, and this page believes him. Where an account holds
   both, the two are still a tab apart. */

export function F6() {
  const family = offeredFamily(visibleFarms());
  const ui = local('f6', { family: family === 'tree' ? 'tree' : 'crop' });
  // Only an account holding both services has anything to switch between.
  const showBoth = family === 'combined';
  const shown = showBoth ? ui.family : (family === 'tree' ? 'tree' : 'crop');
  const table = state.db.planCompare[shown];

  return {
    tabs: false,
    top: h('div.app__top',
      h('div.appbar',
        h('button.iconbtn', { onclick: back, 'aria-label': t('a11y.back', 'Back') }, icon('back', 24, 'flip')),
        h('div.appbar__title', t('f6.title', 'Compare plans'))),
      when(showBoth, () => pillTabs([
        { id: 'crop', label: t('f6.crop', 'Crops') },
        { id: 'tree', label: t('f6.tree', 'Trees') },
      ], ui.family, (id) => { ui.family = id; commit('f6'); }))),
    body: page(
      // WF9.002 — nothing the farmer can see is called Advanced, Professional
      // or Enterprise, and WF9.005 keeps the supplier's own tier names out of
      // the app entirely: they are server configuration and would be one
      // release out of date the day they changed.
      h('p', { style: { margin: 0, color: 'var(--ink-600)' } },
        t('f6.note', 'Two levels: Basic, then Pro. Everything in Basic is in Pro as well.')),

      // WHAT EACH LEVEL COSTS THIS ACCOUNT, at the top of the page comparing
      // them. The comparison ran to two screens of features with no figure
      // anywhere on it — which is a page about the decision with the decision's
      // other half missing — and now that annual is 15% cheaper there are two
      // figures per level worth putting side by side.
      card({}, cardPad(
        h('div', { style: { display: 'flex', gap: '12px' } },
          LEVEL_KEYS.map((tier) => h('div', { style: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' } },
            h('div', { style: { fontWeight: 750, letterSpacing: '.06em', fontSize: 'var(--t-meta)' } },
              t(`plan.${tier}`, tier === 'pro' ? 'Pro' : 'Basic').toUpperCase()),
            h('div', { style: { fontWeight: 700, fontSize: 'var(--t-lead)' } },
              `${priceBare(accountPrice(tier), 'SA')} / ${t('unit.month', 'month')}`),
            h('div', { style: { fontSize: 'var(--t-meta)', color: 'var(--brand-700)', fontWeight: 650 } },
              t('f6.annualrate', '{price} paid annually', {
                price: priceBare(accountPrice(tier) * (1 - ANNUAL_DISCOUNT), 'SA'),
              }))))),
        h('div', { style: { fontSize: 'var(--t-meta)', color: 'var(--ink-600)' } },
          t('a13.plusvat', '+ VAT')))),

      table.groups.map((group) => section(group.name, {},
        card({}, cardPad(
          planTier(t('plan.basic', 'Basic'), group.basic, 'check'),
          when(group.pro?.length, () => planTier(t('f6.proadds', 'Pro adds'), group.pro, 'plus')))))),

      // The features that are simply part of the product. Listing them per tier
      // put two ticks beside each one and implied a difference that is not
      // there — and multi-user access appearing as a "feature" at all invited
      // the question of who does not get it.
      section(t('f6.everyplan', 'In every plan'), {},
        card({}, cardPad(
          h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '6px 14px' } },
            state.db.planCompare.everyPlan.map((label) => h('span', {
              style: { display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--ink-700)' },
            },
            h('span', { style: { color: 'var(--st-good)', display: 'flex' } }, icon('check', 16)),
            h('span', label))))))),

      // Review S32 / S34 — the same commercial facts A13 states, because this
      // page is read instead of A13 as often as after it.
      disclaimer(t('f6.commercial2', 'Prices are for the farms on this account and exclude VAT. A 15% discount is offered for all annual subscriptions.'))),
    // Review S02 — nothing here is an "upgrade". The page is a comparison, and
    // a farmer on Pro looking at it is not being asked to buy anything.
    dock: actionDock(btn(t('f6.choose', 'Choose a plan'), { variant: 'primary', onclick: () => openSheet('PLAN_CHOOSER') })),
  };
}

const LEVEL_KEYS = ['basic', 'pro'];

/* What this account would pay at a given level, from the same rate table A13
   prices the first subscription with. Two copies of these numbers is how the
   signup price and the bill start disagreeing. */
function accountPrice(tier) {
  const farms = visibleFarms();
  const family = offeredFamily(farms);
  const cropHa = farms.filter((f) => f.type !== 'trees').reduce((sum, f) => sum + f.areaHa, 0);
  const treeCount = farms.filter((f) => f.type !== 'crops').reduce((sum, f) => sum + f.treeCount, 0);
  let usd = 0;
  if (family !== 'tree' && cropHa > 0) usd += cropHa * RATES.crop[tier];
  if (family !== 'crop' && treeCount > 0) usd += treeCount * RATES.tree[tier];
  return usd;
}

/** One plan's contribution to one feature group: the tier, then its features. */
function planTier(label, items, iconName) {
  return h('div', { style: { display: 'flex', flexDirection: 'column', gap: '5px' } },
    h('div', {
      style: {
        fontWeight: 750, fontSize: 'var(--t-micro)', letterSpacing: '.07em',
        textTransform: 'uppercase', color: 'var(--ink-500)',
      },
    }, label),
    items.map((feature) => h('div', {
      style: { display: 'flex', gap: '8px', alignItems: 'flex-start', color: 'var(--ink-800)' },
    },
    h('span', {
      style: { color: iconName === 'plus' ? 'var(--brand-600)' : 'var(--st-good)', display: 'flex', flex: '0 0 auto', marginTop: '2px' },
    }, icon(iconName, 16)),
    h('span', feature))));
}

/* -- F7 · Settings -------------------------------------------------------- */

export function F7() {
  return {
    top: appBar({ title: t('f7.title', 'Settings') }),
    body: page(
      card({},
        row({ iconName: 'language', title: t('f8.title', 'Language and region'), value: langMeta().english, onclick: () => go('F8') }),
        row({ iconName: 'bell', title: t('f9.title', 'Notifications'), onclick: () => go('F9') }),
        row({ iconName: 'storage', title: t('f10.title', 'Data and storage'), onclick: () => go('F10') })),
      card({}, h('div', { style: { padding: '4px 16px' } },
        // WF5.147 / WF5.147 — the shared device toggle.
        switchRow(t('f7.shared', 'Shared device'), state.session.sharedDevice,
          (v) => { state.session.sharedDevice = v; commit('settings'); },
          { sub: t('f7.shared.sub', 'Signs you out after 12 hours and asks again when the app opens. Use this on a phone several people share.') }),
        // Turning it on here is the same opt-in the account made on A6, so it
        // marks the question answered: A3 shows its Face ID button either way.
        switchRow(t('f7.biometric', 'Unlock with fingerprint or face'), state.session.biometric,
          (v) => { state.session.biometric = v; state.session.biometricAsked = true; commit('settings'); }))),
      card({},
        row({ iconName: 'shield', title: t('f7.privacy', 'Privacy policy'), onclick: () => openModal('LEGAL', { doc: 'privacy' }) }),
        row({ iconName: 'document', title: t('f7.terms', 'Terms of use'), onclick: () => openModal('LEGAL', { doc: 'terms' }) })),
      // WF5.148 — required by both stores and by regional data protection law.
      card({},
        row({
          iconName: 'trash', title: t('f7.delete', 'Delete my account'),
          onclick: () => openModal('DELETE_ACCOUNT'),
        }))),
  };
}

/* -- F8 · Language and region, WF5.144 ----------------------------------- */

export function F8() {
  const s = state.session;
  return {
    top: appBar({ title: t('f8.title', 'Language and region') }),
    body: page(
      /* THE SAME CONTROL AS A1 AND THE LANGUAGE SHEET — see languageChoice in
         components.js. It was a row per language, which was five and would now
         be nine: a settings screen that opens on a full page of languages and
         pushes units, numbers and currency below the fold is answering a
         question nobody came here to ask. WF10.007 still holds — the choice
         takes effect where it is made, with no restart. */
      section(t('f8.language', 'App language'), {}, languageChoice()),

      section(t('f8.units', 'Units'), {},
        card({},
          // Two units. Acres left the app entirely — nowhere it launches counts
          // land in them, and the option was a way to get the answer wrong.
          row({
            title: t('f8.area', 'Area'), chevron: false,
            value: select([
              { value: 'dunum', label: t('unit.dunum', 'dunum') },
              { value: 'hectare', label: t('unit.ha', 'hectares') },
            ], s.areaUnit, (v) => { s.areaUnit = v; commit('units'); }),
          }),
          row({
            title: t('f8.water', 'Water'), chevron: false,
            value: select([
              { value: 'm3', label: t('unit.m3', 'm³') },
              { value: 'litres', label: t('unit.litre', 'litres') },
            ], s.waterUnit, (v) => { s.waterUnit = v; commit('units'); }),
          }),
          // WF10.015 — temperature is always Celsius; the row exists so the user
          // can see that, rather than hunting for a setting that is not there.
          row({ title: t('f8.temp', 'Temperature'), value: t('unit.celsius', '°C'), chevron: false }))),

      section(t('f8.numbers', 'Numbers and dates'), {},
        card({},
          row({
            title: t('f8.numerals', 'Numerals'), chevron: false,
            sub: t('f8.numerals.sub', 'Western numerals are the norm in commercial agriculture across the region.'),
            value: select([
              { value: 'western', label: '0–9' },
              { value: 'eastern', label: '٠–٩' },
            ], s.numerals, (v) => { s.numerals = v; commit('units'); }),
          }),
          row({
            title: t('f8.calendar', 'Calendar'), chevron: false,
            // Both, by default and everywhere. The setting decides the ORDER
            // and allows one calendar alone for an account that wants that; it
            // no longer decides WHETHER the Hijri date appears, because in this
            // region it is not an aside.
            value: select([
              { value: 'gregorian', label: t('f8.cal.greg', 'Gregorian first') },
              { value: 'hijriFirst', label: t('f8.cal.hijrifirst', 'Hijri first') },
              { value: 'hijri', label: t('f8.cal.hijri', 'Hijri only') },
            ], s.calendar, (v) => { s.calendar = v; commit('units'); }),
          }),
          // Review C430 — 24-hour or a.m./p.m. The irrigation plan prints a
          // time window on every watering, and half the region reads one and
          // half the other.
          row({
            title: t('f8.timeformat', 'Time'), chevron: false,
            value: select([
              { value: '12h', label: t('f8.time.12', '6 p.m.') },
              { value: '24h', label: t('f8.time.24', '18:00') },
            ], s.timeFormat, (v) => { s.timeFormat = v; commit('units'); }),
          }),
          row({ title: t('f8.sample', 'Today shows as'), value: `${date('2026-08-03')}, ${clock(18)}`, chevron: false }))),

      section(t('f8.currency', 'Currency'), {},
        card({}, row({ title: t('f8.prices', 'Prices shown in'), value: 'SAR (USD alongside)', chevron: false }))),

      // A mockup-only readout: how complete the catalogue is for this language.
      section(t('f8.translation', 'Translation coverage'), {},
        card({}, cardPad(
          h('p', { style: { margin: 0, fontSize: 'var(--t-meta)', color: 'var(--ink-600)' } },
            t('f8.translation.note', 'If a phrase hasn’t been translated yet, the app shows it in English and logs the gap. You’ll never see a raw key.')),
          h('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px' } },
            Object.entries(missingReport().byLang).map(([code, cov]) => h('div', {
              style: { display: 'flex', alignItems: 'center', gap: '10px', fontSize: 'var(--t-meta)' },
            },
            h('span', { style: { width: '72px' } }, LANGUAGES.find((l) => l.code === code)?.english),
            h('span', { style: { flex: 1, height: '8px', background: 'var(--ink-100)', borderRadius: '4px', overflow: 'hidden' } },
              h('span', { style: { display: 'block', height: '100%', width: `${cov.pct}%`, background: 'var(--brand-500)' } })),
            h('span', { style: { fontWeight: 650 } }, `${cov.pct}%`)))),
          req('WF10.014'))))),
  };
}

/* -- F9 · Notifications, WF5.145 / §7.2 ---------------------------------- */

export function F9() {
  const s = state.session;
  if (!s.notifications) {
    s.notifications = Object.fromEntries(state.db.notificationCategories.map((c) => [c.id, [...c.defaultChannels]]));
  }

  return {
    top: appBar({ title: t('f9.title', 'Notifications') }),
    body: page(
      section(t('f9.categories', 'What we tell you about'), {},
        card({}, state.db.notificationCategories.map((c) => {
          const channels = s.notifications[c.id] ?? [];
          const on = channels.length > 0;
          return h('div', { style: { padding: '10px 16px', borderBottom: '1px solid var(--ink-100)' } },
            h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px' } },
              h('div', { style: { flex: 1 } },
                h('div', { style: { fontWeight: 550 } }, t(`notify.${c.id}`, c.label)),
                h('div', { style: { fontSize: 'var(--t-meta)', color: 'var(--ink-500)' } },
                  // WF7.005 — safety- or contract-critical categories cannot be
                  // switched off, though the channel may change.
                  c.canDisable ? channelLabel(channels) : t('f9.cannotoff', 'Always on · you can change the channel'))),
              c.canDisable
                ? h('button.switch', {
                    role: 'switch', 'aria-checked': String(on), type: 'button',
                    style: { width: 'auto', minHeight: '36px' },
                    onclick: () => { s.notifications[c.id] = on ? [] : [...c.defaultChannels]; commit('notify'); },
                  }, h('span.switch__track'))
                : h('span.locked', icon('lock', 14), t('f9.required', 'Required'))),
            when(on || !c.canDisable, () => h('div', { style: { display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' } },
              ['push', 'whatsapp', 'sms', 'email'].map((ch) => h('button.chip', {
                'aria-pressed': String(channels.includes(ch)),
                style: { fontSize: 'var(--t-micro)' },
                onclick: () => {
                  const next = channels.includes(ch) ? channels.filter((x) => x !== ch) : [...channels, ch];
                  // A required category must keep at least one channel.
                  s.notifications[c.id] = (!c.canDisable && next.length === 0) ? channels : next;
                  commit('notify');
                },
              }, t(`channel.${ch}`, ch[0].toUpperCase() + ch.slice(1)))))));
        }))),

      // WF7.006 — quiet hours, default 21:00–05:00, never applied to severe
      // weather or urgent advice.
      section(t('f9.quiet', 'Quiet hours'), {},
        card({},
          h('div', { style: { padding: '4px 16px' } },
            switchRow(t('f9.quiet.on', 'Hold notifications overnight'), s.quietHours.on,
              (v) => { s.quietHours.on = v; commit('notify'); })),
          when(s.quietHours.on, () => h('div', { style: { display: 'flex', gap: '10px', padding: '0 16px 14px' } },
            field(t('f9.from', 'From'), input({ type: 'time', value: s.quietHours.from, onchange: (e) => { s.quietHours.from = e.target.value; commit('notify'); } })),
            field(t('f9.to', 'To'), input({ type: 'time', value: s.quietHours.to, onchange: (e) => { s.quietHours.to = e.target.value; commit('notify'); } })))),
          h('div', { style: { padding: '0 16px 14px', fontSize: 'var(--t-meta)', color: 'var(--ink-500)' } },
            t('f9.quiet.note', 'Severe weather alerts and urgent advice always come through.'), req('WF7.006')))),

      disclaimer(t('f9.language', 'Every notification reaches you in your own language, no matter who sent it.')),
      h('p', { style: { fontSize: 'var(--t-meta)', color: 'var(--ink-500)', margin: 0 } },
        t('f9.cap', 'We send at most 6 messages a day. Anything beyond that arrives as one summary.'), req('WF7.008'))),
  };
}

function channelLabel(channels) {
  if (!channels.length) return t('f9.off', 'Off');
  return channels.map((c) => t(`channel.${c}`, c[0].toUpperCase() + c.slice(1))).join(' + ');
}

/* -- F10 · Data and storage, WF5.146 / §11 ------------------------------- */

export function F10() {
  const s = state.session;
  const queue = state.db.syncQueue;
  const cacheMb = 214;

  return {
    top: appBar({ title: t('f10.title', 'Data and storage') }),
    body: page(
      card({}, cardPad(
        h('div', { style: { display: 'flex', alignItems: 'baseline', gap: '8px' } },
          h('span.bignum', bytes(cacheMb)),
          h('span', { style: { color: 'var(--ink-500)' } }, t('f10.of', 'of {cap} used', { cap: bytes(s.cacheCapMb) }))),
        h('span', { style: { height: '10px', background: 'var(--ink-100)', borderRadius: '5px', overflow: 'hidden' } },
          h('span', { style: { display: 'block', height: '100%', width: `${(cacheMb / s.cacheCapMb) * 100}%`, background: 'var(--brand-600)' } })),
        h('div', { style: { fontSize: 'var(--t-meta)', color: 'var(--ink-500)' } },
          t('f10.evict', 'When storage is full, the oldest imagery is cleared first. Your own photos and completed work are never touched.'),
          req('WF11.003')))),

      section(t('f10.limit', 'Storage limit'), {},
        card({}, row({
          title: t('f10.cap', 'Keep at most'), chevron: false,
          value: select([100, 250, 500, 1024, 2048].map((v) => ({ value: String(v), label: bytes(v) })),
            String(s.cacheCapMb), (v) => { s.cacheCapMb = Number(v); commit('storage'); }),
        }))),

      card({}, h('div', { style: { padding: '4px 16px' } },
        switchRow(t('f10.wifi', 'Download imagery on Wi-Fi only'), s.wifiOnlyImagery,
          (v) => { s.wifiOnlyImagery = v; commit('storage'); },
          { sub: t('f10.wifi.sub', 'A task you completed more than 24 hours ago uploads on any connection regardless.') }))),

      // WF5.146 / WF11.008 — exactly what has not uploaded, and a manual sync.
      section(t('f10.pending', 'Waiting to send'), {},
        card({}, queue.length
          ? [...queue.map((item) => row({
              iconName: item.kind === 'observation' ? 'camera' : item.kind === 'advice' ? 'check' : 'droplet',
              title: item.label, sub: t(`f10.kind.${item.kind}`, item.kind), value: ago(item.at), chevron: false,
            })), h('div', { style: { padding: '12px 16px' } }, btn(t('sync.now', 'Sync now'), { variant: 'primary', onclick: syncNow }))]
          : h('div', { style: { padding: '18px', textAlign: 'center', color: 'var(--ink-500)' } },
              t('f10.nothing', 'Everything on this phone has been sent.')))),

      section(t('f10.whatiskept', 'What we keep on your phone'), {},
        card({}, state.db.cacheTable.map((r) => row({
          title: r.what, chevron: false,
          value: r.cached
            ? h('span', { style: { fontSize: 'var(--t-meta)', color: 'var(--ink-600)' } }, r.retention)
            : h('span.status.status--nodata', icon('close', 13), t('f10.notkept', 'Not kept')),
        })))),

      card({},
        row({ iconName: 'trash', title: t('f10.clear', 'Clear saved imagery'), sub: t('f10.clear.sub', 'Your photos and unsent work are not touched.'), onclick: clearCache }),
        row({ iconName: 'refresh', title: t('f10.resetdemo', 'Reset the mockup data'), sub: t('f10.resetdemo.sub', 'Mockup only — puts every farm, task and advice item back as it started.'), onclick: () => { resetData(); toast(t('f10.reset.done', 'Mockup data reset')); } })),

      h('p', { style: { fontSize: 'var(--t-meta)', color: 'var(--ink-500)', margin: 0 } },
        t('f10.encrypted', 'All data on this phone — imagery, queued photos, everything — is encrypted.'), req('WF11.011'))),
  };
}

/* -- F11 · Activity log, WF5.149 / WF5.150 -------------------------------- */

const LOG_FILTERS = [
  { id: 'all', label: 'Everything' },
  { id: 'boundary', label: 'Boundaries' },
  { id: 'cropcycle', label: 'Crop cycles' },
  { id: 'task', label: 'Tasks' },
  { id: 'input', label: 'Inputs' },
  { id: 'member', label: 'People' },
  { id: 'role', label: 'Roles' },
  { id: 'subscription', label: 'Subscription' },
  { id: 'advice', label: 'Advice' },
];

export function F11(farmId = 'all') {
  const ui = local('f11', { category: 'all' });
  // WF5.149 — Owner only.
  if (!can('auditlog.view')) {
    return {
      top: appBar({ title: t('f11.title', 'Activity log') }),
      body: page(disclaimer(t('f11.owneronly', 'The activity log is available to farm owners.'), true)),
    };
  }
  let entries = activityFor(farmId);
  if (ui.category !== 'all') entries = entries.filter((e) => e.category === ui.category);

  return {
    top: h('div.app__top',
      h('div.appbar',
        h('button.iconbtn', { onclick: back, 'aria-label': t('a11y.back', 'Back') }, icon('back', 24, 'flip')),
        h('div.appbar__title', h('span', t('f11.title', 'Activity log')),
          h('small', farmId === 'all' ? t('filter.allfarms', 'All farms') : farmById(farmId).name))),
      chips(LOG_FILTERS.map((f) => ({ id: f.id, label: t(`f11.cat.${f.id}`, f.label) })), ui.category,
        (id) => { ui.category = id; commit('f11'); })),
    body: page(
      entries.length
        ? card({}, entries.map((e) => h('div.row.row--static',
            h('span', { style: { color: 'var(--ink-400)', display: 'flex' } }, icon(logIcon(e.category), 20)),
            h('div.row__main',
              h('div.row__title', e.text),
              // WF5.149 — who, what, when and from where.
              h('div.row__sub', `${e.actorName} · ${dateTime(e.at)} · ${e.farmId ? farmById(e.farmId).name : ''}`)))))
        : emptyState({ iconName: 'list', title: t('f11.empty', 'Nothing recorded under this filter yet') }),
      // WF5.188 — append-only.
      h('p', { style: { fontSize: 'var(--t-meta)', color: 'var(--ink-500)', margin: 0 } },
        t('f11.appendonly', 'This log is append-only. No one — including you — can edit or delete an entry.'), req('WF5.188'))),
  };
}

function logIcon(category) {
  return ({
    boundary: 'edit', cropcycle: 'sprout', input: 'droplet',
    member: 'users', role: 'shield', subscription: 'card', advice: 'advice',
  })[category] ?? 'list';
}

/* -- F12 · Help and user guide, WF5.151 ---------------------------------- */

export function F12(articleId) {
  const ui = local('f12', { query: '' });
  const articles = state.db.helpArticles;

  if (articleId) {
    const article = articles.find((a) => a.id === articleId);
    if (article) {
      return {
        top: appBar({ title: article.title, subtitle: article.section }),
        body: page(
          h('div', { style: { fontSize: 'var(--t-meta)', color: 'var(--ink-500)' } },
            t('f12.readtime', '{n} minute read', { n: num(article.readMins) })),
          ...article.body.map((p) => h('p', { style: { margin: 0, lineHeight: 1.55 } }, p)),
          when(article.steps, () => section(t('f12.steps', 'Step by step'), {},
            card({}, article.steps.map((s, i) => h('div.row.row--static',
              h('span', { style: { fontWeight: 750, color: 'var(--brand-700)', width: '20px' } }, String(i + 1)),
              h('div.row__main', h('div.row__title', s)))))))),
      };
    }
  }

  const query = ui.query.toLowerCase();
  const filtered = query
    ? articles.filter((a) => (`${a.title} ${a.summary} ${a.body.join(' ')}`).toLowerCase().includes(query))
    : articles;
  const sections = [...new Set(filtered.map((a) => a.section))];

  return {
    top: appBar({ title: t('f12.title', 'Help and user guide') }),
    body: page(
      input({
        type: 'search', placeholder: t('f12.search', 'Search the guide'), value: ui.query,
        oninput: (e) => { ui.query = e.target.value; },
      }),
      // WF4.030 — the tour is shown once, on the registration path, so this is
      // the only way back to it. It sits above the articles rather than among
      // them because it is not an article: it has no text to search, and buried
      // under the glossary it may as well not exist.
      when(!query, () => card({}, row({
        iconName: 'grid',
        title: t('f12.tour', 'See the tour again'),
        sub: t('f12.tour.sub', 'Five pictures of what the app does'),
        onclick: () => openTour('help'),
      }))),
      filtered.length
        ? sections.map((s) => section(s, {},
            card({}, filtered.filter((a) => a.section === s).map((a) => row({
              title: a.title, sub: a.summary, onclick: () => go(`F12:${a.id}`),
            })))))
        : emptyState({
            iconName: 'search', title: t('f12.noresults', 'Nothing matched “{q}”', { q: ui.query }),
            body: t('f12.noresults.body', 'Try a shorter phrase, or contact us and we will help.'),
            action: { label: t('f13.title', 'Contact Wafra'), onclick: () => go('F13') },
          }),
      section(t('f12.glossary', 'Words we use'), {},
        card({}, state.db.glossary.map((g) => h('div.row.row--static',
          h('div.row__main',
            h('div.row__title', g.term),
            h('div.row__sub', g.definition)),
          h('span', { dir: 'rtl', style: { color: 'var(--ink-500)', fontSize: 'var(--t-meta)' } }, g.ar))))),
      h('p', { style: { fontSize: 'var(--t-meta)', color: 'var(--ink-500)', margin: 0 } },
        t('f12.updated', 'This guide lives on our servers, so it stays up to date without an app update.'), req('WF5.189'))),
  };
}

/* -- F13 · Contact Wafra, WF5.152 … WF5.156 ------------------------------ */

export function F13() {
  return {
    top: appBar({ title: t('f13.title', 'Contact Wafra') }),
    body: page(
      h('div',
        h('p', { style: { margin: '0 0 4px', fontSize: 'var(--t-lead)', fontWeight: 600 } }, t('f13.here', 'We are here to help.')),
        h('p', { style: { margin: 0, color: 'var(--ink-600)' } }, t('f13.hours', 'Sunday to Thursday, 08:00–17:00. Arabic and English.'))),

      // WF5.152 — exactly two large buttons, plus a support ticket option.
      btn(t('f13.whatsapp', 'WhatsApp us'), {
        variant: 'primary', size: 'huge', icon: 'whatsapp',
        onclick: () => openModal('CONTACT_PREVIEW', { channel: 'whatsapp' }),
      }),
      btn(t('f13.email', 'Email us'), {
        variant: 'secondary', size: 'huge', icon: 'mail',
        onclick: () => openModal('CONTACT_PREVIEW', { channel: 'email' }),
      }),
      // WF5.156 — the ticket route, where the plan includes it.
      has('tickets')
        ? btn(t('f13.ticket', 'Raise a support ticket'), { variant: 'secondary', icon: 'document', onclick: () => toast(t('f13.ticket.opened', 'Opening a ticket…')) })
        : h('button.lockbox', { onclick: () => openModal('UPGRADE', { featureKey: 'tickets' }) },
            icon('lock', 22), h('span.lockbox__title', t('f13.ticket', 'Raise a support ticket'))),

      h('p', { style: { fontSize: 'var(--t-meta)', color: 'var(--ink-500)', margin: 0 } },
        t('f13.config', 'Contact details are loaded from our servers, so they’re always current.'), req('WF5.193'))),
  };
}

/* -- F14 · My profile ----------------------------------------------------- */

export function F14() {
  const person = me();
  const d = local('f14', { name: person.name, email: 'khaled@example.com' });

  return {
    top: appBar({ title: t('f14.title', 'My profile') }),
    body: page(
      h('div', { style: { display: 'flex', justifyContent: 'center', padding: '6px 0' } }, avatar(person.initials, { large: true })),
      field(t('a5.name', 'Your name'), input({ value: d.name, oninput: (e) => { d.name = e.target.value; } })),
      field(t('a3.mobile', 'Mobile number'), input({ value: person.phone, disabled: true }),
        { hint: t('f14.phonenote', 'Your mobile number is your account. Contact us to change it.') }),
      field(t('a5.email', 'Email address'), input({ type: 'email', value: d.email, oninput: (e) => { d.email = e.target.value; } })),
      card({}, cardPad(kv([
        [t('f14.role', 'Role'), t(`role.${state.session.role}`, ROLE_LABEL[state.session.role])],
        [t('f14.farms', 'Farms'), visibleFarms().map((f) => f.name).join(', ')],
        [t('f14.language', 'Language'), langMeta().english],
      ]))),
      // Annex A.4 / A.11 — the plain-language notice a supervisor sees, since
      // it is his photographs and his position the farm owner can look at.
      when(state.session.role === 'supervisor', () => disclaimer(
        t('f14.photonotice', 'Photos you take include your location and the time. The farm owner can see them. You can ask us to delete your personal data at any time.'))),
      card({}, row({
        iconName: 'trash', title: t('f7.delete', 'Delete my account'), onclick: () => openModal('DELETE_ACCOUNT'),
      }))),
    dock: actionDock(btn(t('action.save', 'Save'), { variant: 'primary', onclick: () => { toast(t('f14.saved', 'Profile saved')); back(); } })),
  };
}

/* -- F15 · Weather, WF5.015 -----------------------------------------------
   THE BLOCK THAT CAME OFF THE FARM SCREEN.

   It was a card at the top of B2 — today's temperature, three days of a strip
   the farmer had to open to see the rest of, and an upgrade lock underneath.
   Every farmer saw it every time he opened the app whether or not he had come
   to read it, and the review moved it to More, where the things you look up
   live.

   Given a screen of its own it can do what the card could not: print the whole
   forecast the plan pays for, rather than three columns and a "+11 days".
   Which forecast that is depends on the farm — §9.3 gives crops 14 days at
   both levels, §9.4 gives trees 7 at Basic and 15 at Pro. */

export function F15(farmId) {
  const farms = visibleFarms();
  const farm = farmById(farmId ?? farms[0]?.id);
  const w = farm.weather;
  const key = farm.type === 'trees' ? 'weather.forecast.15' : 'weather.forecast.14';
  const days = has(key) ? (key === 'weather.forecast.15' ? 15 : 14) : 7;

  return {
    top: appBar({
      title: t('f15.title', 'Weather'),
      subtitle: farm.name,
      onTitleTap: farms.length > 1
        ? () => openSheet('FARM_PICKER', { onPick: (id) => go(`F15:${id}`, { replace: true }) })
        : null,
    }),
    body: page(
      // WF5.015 — an active alert outranks the forecast it is about.
      when(w.alert, () => card({ accent: w.alert.severity, onclick: () => go(`D6:${farm.id}`) }, cardPad(
        h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
          statusIcon(w.alert.severity, 20),
          h('span', { style: { fontWeight: 700, flex: 1 } }, w.alert.title),
          h('span', { style: { color: 'var(--ink-400)', display: 'flex' } }, icon('forward', 20, 'flip'))),
        h('div', { style: { color: 'var(--ink-600)' } }, w.alert.detail)))),

      card({}, cardPad(
        h('div', { style: { display: 'flex', alignItems: 'center', gap: '12px' } },
          h('span', { style: { color: 'var(--st-action)', display: 'flex' } }, icon(w.condition === 'Clear' ? 'sun' : 'cloud', 34)),
          h('span.num', { style: { fontSize: 'var(--t-head)' } }, tempC(w.tempC)),
          h('div', { style: { flex: 1 } },
            h('div', { style: { fontWeight: 650 } }, w.condition),
            h('div', { style: { color: 'var(--ink-600)', fontSize: 'var(--t-meta)' } },
              `${t('weather.wind', 'Wind')} ${speed(w.windKph)} · ${t('weather.humidity', 'Humidity')} ${num(w.humidity)}%`))))),

      section(t('f15.forecast', '{n}-day forecast', { n: num(days) }), {},
        card({}, w.forecast.slice(0, days).map((f) => row({
          iconName: f.rainMm > 0 ? 'rain' : f.condition === 'Clear' ? 'sun' : 'cloud',
          title: f.day,
          sub: f.rainMm > 0 ? t('f15.rain', '{n} mm of rain', { n: num(f.rainMm) }) : f.condition,
          value: `${num(f.hiC)}° / ${num(f.loC)}°`,
          chevron: false,
        })))),

      // WF5.010 — a shorter forecast than the plan could give is said out loud,
      // with the way to a longer one, never quietly truncated.
      when(days === 7, () => h('button.locked', {
        onclick: () => openModal('UPGRADE', { featureKey: key }),
        style: { alignSelf: 'flex-start' },
      }, icon('lock', 15), t(`b2.forecast${key === 'weather.forecast.15' ? '15' : '14'}`,
        key === 'weather.forecast.15' ? '15-day forecast' : '14-day forecast'))),

      h('p', { style: { margin: 0, fontSize: 'var(--t-meta)', color: 'var(--ink-500)' } }, req('WF5.015'))),
  };
}
