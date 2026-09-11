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
import { t, LANGUAGES, setLanguage } from '../core/i18n.js';
import { go, openSheet, openModal, back, canGoBack, enterOnboarding } from '../core/router.js';
import { icon } from '../ui/icons.js';
import {
  appBar, barAction, page, section, card, cardPad, row, btn, actionDock, statusChip,
  statusIcon, kv, emptyState, disclaimer, lockedRow, req, chips, select, field, input,
  switchRow, avatar, divider, radioList, helpBlock,
} from '../ui/components.js';
import { num, date, dateTime, ago, price, priceBare, bytes, area, clock, tempC, speed } from '../core/format.js';
import { visibleFarms, farmById, membersOf, memberById, me, activityFor, plotsOf, personName } from '../data/selectors.js';
import { can, ROLE_LABEL, MATRIX, grantFor } from '../core/capabilities.js';
import { has, planLabel, PLANS, offeredFamily, additionalUserLimit } from '../core/entitlements.js';
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

      /* Units and formats came off this menu at the Monday review: it was
         reachable here AND from Settings, and a setting with two front doors is
         a setting the farmer has to check twice. Settings is where it belongs,
         and F7 already names it. */
      card({},
        row({ iconName: 'settings', title: t('f7.title', 'Settings'), onclick: () => go('F7') }),
        row({ iconName: 'bell', title: t('f9.title', 'Advice distribution'), onclick: () => go('F9') }),
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

      /* REVIEW 06/09 — WHERE THE REPORTS GO, AND THERE CAN BE SEVERAL.

         The note came off A5, where a line under the email field said "farm
         reports are sent to this email address": "Delete. In settings, the
         farmer should be able to send farm report to multiple email addresses,
         including this one by default." So the fact was true and homeless — it
         described a rule about reports on the screen where an account is made,
         and it quietly promised one address when a farm has an owner, an
         agronomist and an accountant who all want the weekly.

         The account's own address is the first row and cannot be removed; it is
         the address the farmer signs in with, and a report list with nobody on
         it is a subscription silently doing nothing. */
      section(t('f1.recipients', 'Sent to'), {},
        card({},
          row({
            iconName: 'mail', title: me().email, sub: t('f1.recipients.you', 'Your account address'), chevron: false,
          }),
          ...(state.session.reportRecipients ?? []).map((address, i) => row({
            iconName: 'mail',
            title: address,
            value: h('button.iconbtn.iconbtn--bare', {
              'aria-label': t('f1.recipients.remove', 'Remove {address}', { address }),
              onclick: () => { state.session.reportRecipients.splice(i, 1); commit('f1'); },
            }, icon('close', 20)),
            chevron: false,
          })),
          row({
            iconName: 'plus', title: t('f1.recipients.add', 'Add an email address'),
            onclick: () => openSheet('REPORT_RECIPIENT'),
          }))),

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
      when(state.session.trialDaysLeft > 0 && state.session.plan !== 'trial_expired', () => card({ accent: 'monitor' }, cardPad(
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
        /* Review 06/09 rewrote this, and the rewrite is a correction rather
           than a polish. "At any time" is what the button feels like and not
           what the billing does: cancelling stops the RENEWAL, and the
           subscription runs to the end of the cycle already paid for. A farmer
           who reads "at any time" and cancels on day two of a month expects his
           money back. */
        h('div', { style: { color: 'var(--ink-700)', fontSize: 'var(--t-meta)' } },
          t('a13.cancel2', 'You can cancel the renewal of your subscription at the end of your billing cycle in the App Store or Google Play.')),
        h('div', { style: { display: 'flex', gap: '8px', marginTop: '4px' } },
          btn(t('f6.title', 'Compare plans'), { variant: 'secondary', size: 'sm', block: false, onclick: () => go('F6') }),
          // WF5.178 — no purchase or upgrade control where it was bought on the web.
          when(!boughtOnWeb, () => btn(t('f5.change', 'Change'), {
            variant: 'primary', size: 'sm', block: false, onclick: () => openSheet('PLAN_CHOOSER'),
          }))))),

      /* Review 06/09 — "Delete. Why is the purpose of this information? The
         service is at the farm level." WF4.107's one-price-one-renewal rule is
         what the card above already shows: one figure, one date. Saying it
         again in prose was the app explaining its own pricing model to somebody
         who was looking at it. */

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
        /* REVIEW 06/09 TURNED ONE CONTACT-US ROW INTO THREE THINGS THE APP DOES.

           "Can't the app automatically generate an invoice? The user should be
           able to switch between monthly/annual and basic/pro in the app. The
           user should be able to add seats (better to call it 'team members')
           in the app."

           The row was a phone number standing in for three ordinary jobs, and
           WF5.179 — informational only, never a price, never a payment — is
           satisfied by all three: an invoice is a document about a payment
           already taken, switching cycle or level is the store's own purchase
           flow, and adding a team member is an entitlement question the server
           answers. None of them needs a card typed into this app.

           And "seats" is gone. It is a licensing word for a person, and the
           farmer adding one is adding his brother-in-law. */
        row({
          iconName: 'document',
          title: t('f5.invoice2', 'Download an invoice'),
          sub: t('f5.invoice2.sub', 'Every payment taken so far, as a PDF'),
          onclick: () => toast(t('f5.invoice.sent', 'Invoice sent to your email address')),
        }),
        when(!boughtOnWeb, () => row({
          iconName: 'card',
          title: t('f5.switchplan', 'Switch monthly or annual, Basic or Pro'),
          onclick: () => openSheet('PLAN_CHOOSER'),
        })),
        row({
          iconName: 'users',
          title: t('f5.members', 'Team members'),
          sub: t('f5.members.sub', `Primary owner + ${additionalUserLimit()} additional user${additionalUserLimit() === 1 ? '' : 's'}`),
          onclick: () => go('F6'),
          deckTo: 'F6',
        })),

      // WF4.110 — a downgrade names the farms that block it.
      when(family === 'combined', () => disclaimer(
        t('f5.downgrade', 'To switch to a crops-only or trees-only plan, you’d first need to archive the farms of the other type. We’ll show you which ones.'))),

      /* Review 06/09 — "Delete (too confusing)". WF5.177's rule is that the app
         never checks a local receipt and never cares which route paid; that is
         a rule about how WE build it, and it was printed at the bottom of the
         farmer's billing screen in the language of the rule. It still holds and
         it is still tested; it is not something to tell him about. */
      h('span', req('WF5.177'))),
  };
}

/* -- F6 · Compare plans, WF9.001 … WF9.003 --------------------------------
   REBUILT AT THE 01/09 REVIEW AROUND WHAT THE FARMER GETS RATHER THAN WHAT WE
   BUY — the satellite group went, four topics replaced six, and the two level
   columns replaced "Basic includes / Pro adds".

   THE MONDAY REVIEW CUT IT AGAIN, ON A SHARPER ARGUMENT: "It's not too much
   detail, it's the wrong detail. 'Correct a plot boundary after the fact' is
   not a critical difference between Basic and Pro."

   THE LIST BELOW IS THE REVIEWER'S OWN, sent after the call and drawn from the
   supplier's document. Nineteen rows, fifteen of which differ; the four that do
   not are there deliberately. An earlier pass ran the stricter rule — every row
   must differ — and it was half right: what buries a comparison is twenty
   identical ticks, not four. Four shared rows read as anchors. They tell a
   farmer looking at the Basic column that the thing he came for is in it, which
   is the question a page of dashes leaves him unable to answer.

   AND THE TWO TABLES BECAME ONE. "Can we do a Basic and Pro without doing crops
   and trees — just the way we present it?" There is no crop/tree tab any more:
   a tree feature is a row like any other, and a farmer growing wheat reads
   "tree variety identification" the way he reads any line about a thing he does
   not have. The account still decides what he is offered — that is F5's job and
   the entitlement matrix's — but this page is a price list of differences, and
   a price list does not need to know who is holding it.

   IT IS ALSO ONE LIST, with no group headings. The reviewer's list came flat,
   and at nineteen rows it does not need dividing — four topics over nineteen
   rows is a heading every five lines, which is furniture rather than structure.
   What the headings were doing, though, was repeating the column labels every
   few rows, and that job still has to be done: the header row is sticky now, so
   BASIC and PRO stay at the top of the card while the rows go past.

   THE LINE ABOVE THE TABLE WENT TOO. "Two levels: Basic, then Pro. Everything
   in Basic is in Pro as well. — I would remove that. People can see there are
   two levels." Two column headings say it. */

export function F6() {
  const table = state.db.planCompare;

  return {
    tabs: false,
    top: h('div.app__top',
      h('div.appbar',
        h('button.iconbtn', { onclick: back, 'aria-label': t('a11y.back', 'Back') }, icon('back', 24, 'flip')),
        h('div.appbar__title', t('f6.title', 'Compare plans')))),
    body: page(
      /* REVIEW 06/09 TOOK THE PRICES OFF THIS PAGE. "Delete. No pricing
         information should be displayed here. This is just to show the
         features." A13 and F5 are the screens with a price on them, they both
         link here, and this page's own button hands the farmer back to
         whichever he came from. */
      table.groups.map((group) => section(group.name, {},
        card({}, featureTable(group.rows))))),

    /* Review 06/09 — "this button gets the user back to A13 (new user) or F5
       (existing user)". Which is what `back()` does when there is a stack, and
       this screen is also reachable from the upgrade sheet and from a deep
       link, where there is not. */
    dock: actionDock(btn(t('f6.back', 'Back to my plan'), {
      variant: 'primary',
      deckTo: state.nav.mode === 'onboarding' ? 'A13' : 'F5',
      onclick: () => (canGoBack() ? back() : go(state.nav.mode === 'onboarding' ? 'A13' : 'F5')),
    })),
  };
}

const LEVEL_KEYS = ['basic', 'pro'];

/* accountPrice() lived here until review 06/09 took the prices off F6. It is
   not kept "in case": A13 and F5 each work the figure out from RATES, which is
   the one table, and a third copy sitting unused is the copy that goes stale
   without anybody noticing. */

/* THE THREE COLUMNS.

   A table on a 360 dp phone is a real constraint, and the two level columns are
   what gives: they are as narrow as a tick and a short phrase can be, and the
   feature takes everything left. The header row repeats at the top of every
   group rather than once at the top of the page, because a farmer six groups
   down should not have to scroll back to find out which column is which.

   WF2.009 — a tick is never the only signal. Each cell says in words what it
   means to anything reading the page aloud, and a level that does not have a
   feature gets a dash rather than an empty box, so a row that failed to render
   is distinguishable from a feature that is not offered. */
function featureTable(rows) {
  const head = (label) => h('div', {
    style: {
      fontWeight: 750, fontSize: 'var(--t-micro)', letterSpacing: '.07em',
      textTransform: 'uppercase', color: 'var(--ink-500)', textAlign: 'center',
    },
  }, label);

  const cell = (value, levelLabel) => {
    if (value === true) {
      return h('span', {
        style: { color: 'var(--st-good)', display: 'flex', justifyContent: 'center' },
        title: `${levelLabel}: ${t('f6.included', 'included')}`,
        'aria-label': `${levelLabel}: ${t('f6.included', 'included')}`,
      }, icon('check', 18));
    }
    if (!value) {
      // --ink-400 is the colour a disabled control takes, and it does not carry
      // AA against the card. This dash is content — it is the answer to "is this
      // in Basic" — so it is set at reading contrast.
      return h('span', {
        style: { color: 'var(--ink-600)', textAlign: 'center', display: 'block' },
        'aria-label': `${levelLabel}: ${t('f6.notincluded', 'not included')}`,
      }, '—');
    }
    return h('span', {
      style: { color: 'var(--brand-700)', fontWeight: 600, fontSize: 'var(--t-meta)', textAlign: 'center', display: 'block' },
    }, value);
  };

  const basicLabel = t('plan.basic', 'Basic');
  const proLabel = t('plan.pro', 'Pro');

  return h('div.plantable',
    h('div.plantable__row.plantable__row--head',
      h('span'), head(basicLabel), head(proLabel)),
    rows.map((r) => h('div.plantable__row',
      h('span.plantable__feature', r.feature),
      cell(r.basic, basicLabel),
      cell(r.pro, proLabel))));
}

/* -- F7 · Settings -------------------------------------------------------- */

export function F7() {
  return {
    top: appBar({ title: t('f7.title', 'Settings') }),
    body: page(
      card({},
        /* Review 06/09 — "seem repetitive with F8. Can't we just have a
           language drop down menu here? Remove region."

           Both halves are right. The row said "Language and region" and showed
           "English", which is a language; there was never a region setting
           behind it, so the word was promising a control that did not exist.
           And a farmer opening Settings to change the language had to open a
           second screen to find a list of ten — the choice is small enough to
           make where he is standing. The menu is here; F8 keeps everything the
           choice does NOT decide. */
        row({
          iconName: 'language', title: t('f7.language', 'Language'), chevron: false,
          value: select(LANGUAGES.map((l) => ({ value: l.code, label: l.native })),
            state.session.lang, (v) => setLanguage(v),
            { 'aria-label': t('f7.language', 'Language') }),
        }),
        // Review 06/09 — "Add units and point to F8". The units were reachable
        // only through a row named after the language, which is how F8's other
        // half stayed hidden from anybody not hunting for it.
        row({ iconName: 'ruler', title: t('f8.title', 'Units and formats'), onclick: () => go('F8'), deckTo: 'F8' }),
        row({ iconName: 'bell', title: t('f9.title', 'Advice distribution'), onclick: () => go('F9'), deckTo: 'F9' }),
        row({ iconName: 'storage', title: t('f10.title', 'Data and storage'), onclick: () => go('F10') })),
      card({}, h('div', { style: { padding: '4px 16px' } },
        // WF5.147 / WF5.147 — the shared device toggle.
        switchRow(t('f7.shared', 'Shared device'), state.session.sharedDevice,
          (v) => { state.session.sharedDevice = v; commit('settings'); },
          { sub: t('f7.shared.sub', 'Signs you out after 12 hours and asks again when the app opens. Use this on a phone several people share.') }),
        /* Review 06/09 — "Change to: 'Unlock with Face ID'. Are there phones
           that still use fingerprint?" There are, and fewer every year, and
           that is the point: naming both put the rarer one on the label of a
           switch most farmers meet on a phone that has no fingerprint reader.
           The setting is the same one either way — the operating system decides
           which sensor answers it — so the label names what the farmer will
           actually be asked for. It matches A3's button, which had the same
           change for the same reason. */
        switchRow(t('f7.biometric', 'Unlock with Face ID'), state.session.biometric,
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

/* -- F8 · Units and formats, WF5.144 --------------------------------------

   REVIEW 06/09 TOOK THE LANGUAGE OFF THIS SCREEN AND GAVE IT THREE SECTIONS.

     "Delete, and add language menu in F7"     the app-language block. It was
       the first thing on the screen and it was the one thing a farmer could
       have chosen one screen earlier; F7's row now holds the menu.
     "Keep here and add menu options on F7"    the units. They stay, and F7
       gained a row that opens this screen, so the half of it nobody could find
       is now named on the screen above.
     "Add two new sections after UNITS called CALENDAR … and TIME …"
       Both settings existed, filed under "Numbers and dates" with the numerals
       — which is where a farmer looking for the Hijri calendar would never have
       looked. Three questions, three headings.
     "Delete. I believe currency is set by , and add language menu in F7"
       The sentence breaks off, and what it was reaching for is the same thing
       he asked on A13: does the app show the store's currency? It does, because
       the subscription is bought through the store and the store bills in its
       own currency — so a currency SETTING here was offering a choice the app
       does not get to make. The fact moved to A13, next to the price it is
       about.

   The screen is called Units and formats now. He wrote "Units" on the title,
   which is right about the half of it he was looking at; calendar, time and
   numerals are formats rather than units, and leaving them under a heading that
   does not name them is how they got lost in the first place.

   THE MONDAY REVIEW TOOK TRANSLATION COVERAGE OFF IT. "I don't quite understand
   this 'translation coverage'. I would remove that." It was a readout of how
   far this mockup's own catalogue had got, which is a fact about the build and
   not about the farmer's phone. It belongs in the harness, and it is still
   asserted by tools/smoke.mjs. */

export function F8() {
  const s = state.session;
  return {
    top: appBar({ title: t('f8.title', 'Units and formats') }),
    body: page(
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

      /* THE THREE OPTIONS ARE ONE CALENDAR, TWO CALENDARS, OR THE OTHER ONE:
         "Gregorian; Gregorian and Hijri; or Hijri. Three options." — single,
         double, single.

         The previous set offered two ways of showing BOTH (which one leads) and
         one way of showing one, which answered a question about order that
         nobody had asked and left "Gregorian on its own" unreachable. */
      section(t('f8.calendar', 'Calendar'), {},
        card({}, radioList([
          { id: 'gregorian', label: t('f8.cal.greg2', 'Gregorian') },
          { id: 'both', label: t('f8.cal.both', 'Gregorian and Hijri') },
          { id: 'hijri', label: t('f8.cal.hijrionly', 'Hijri') },
        ], s.calendar, (v) => { s.calendar = v; commit('units'); }))),

      /* Review C430 — 24-hour or a.m./p.m. The irrigation plan prints a time
         window on every watering, and half the region reads one and half the
         other. Review 06/09 gave it a heading of its own and named the two
         options in words rather than by showing an example of each. */
      section(t('f8.timeformat', 'Time'), {},
        card({}, radioList([
          { id: '24h', label: t('f8.time.24h', '24-hour time'), sub: '18:00' },
          { id: '12h', label: t('f8.time.ampm', 'AM / PM'), sub: '6 p.m.' },
        ], s.timeFormat, (v) => { s.timeFormat = v; commit('units'); }))),

      section(t('f8.numbers', 'Numbers'), {},
        card({},
          row({
            title: t('f8.numerals', 'Numerals'), chevron: false,
            sub: t('f8.numerals.sub', 'Western numerals are the norm in commercial agriculture across the region.'),
            value: select([
              { value: 'western', label: '0–9' },
              { value: 'eastern', label: '٠–٩' },
            ], s.numerals, (v) => { s.numerals = v; commit('units'); }),
          }),
          row({ title: t('f8.sample', 'Today shows as'), value: `${date('2026-08-03')}, ${clock(18)}`, chevron: false })))),
  };
}

/* -- F9 · Advice distribution, WF5.145 / §7.2 ----------------------------

   THE MONDAY REVIEW REBUILT THIS SCREEN AROUND ONE QUESTION IT COULD NOT
   ANSWER: "if I click on WhatsApp under urgent advice, what happens? Who's
   WhatsApp?" The screen listed nine categories of message and four channels and
   never said who was on the other end of any of them — which made it a set of
   switches for a pipe with no destination.

   FOUR THINGS CHANGED, AND THE FIRST DECIDES THE REST.

     IT IS ABOUT ADVICE, AND ONLY ADVICE. "Notifications is advice specifically,
     right? … the phone gives you a lot of notifications. This is more like
     advice distribution." So it is called Advice distribution, and the weekly
     report, the trial reminder and the marketing opt-in are not on it.

     IT IS ORGANISED BY TYPE, NOT BY URGENCY. Both were on the table — urgent /
     planned / monitor against irrigation / fertilisation / crop protection —
     and the question was which a farmer is actually more likely to route as a
     standing rule. "Irrigation is the irrigation manager." A man is hired for a
     job, not for a severity.

     THE CHANNELS ARE SMS, WHATSAPP AND TELEGRAM. Email came off — "it's not
     very urgent" — and so did push, which only ever reached the phone in the
     owner's own hand and could not be pointed at anybody else.

     EACH CHANNEL NAMES PEOPLE. Pressing one opens the team and you pick one,
     two or all three. That is the whole answer to "who's WhatsApp".

   WEATHER IS NOT HERE. "The weather alert, I think, just goes to the app, it
   doesn't get sent out." A forecast is something a farmer looks up, and F15 is
   where he looks it up — D6 went with the same decision. */

const ADVICE_CHANNELS = ['sms', 'whatsapp', 'telegram'];

const DISTRIBUTION_TYPES = [
  { id: 'irrigation', label: 'Irrigation' },
  { id: 'nutrition', label: 'Fertilisation' },
  { id: 'protection', label: 'Crop protection' },
];

/* One record per advice type: channel → the ids of the people it reaches. An
   empty list is a channel that is off, which is why there is no separate on/off
   switch — turning a channel on without saying who it goes to was the state the
   old screen left the farmer in.

   The recipient sheet is reachable without passing through F9 (a deep link, the
   deck), so the record is made here rather than in the screen body. */
export function ensureDistribution() {
  const s = state.session;
  if (!s.distribution) {
    s.distribution = Object.fromEntries(DISTRIBUTION_TYPES.map((d) => [d.id, { sms: [], whatsapp: [], telegram: [] }]));
    // A standing rule already set for two of the three, so the screen is read
    // in the state a farmer will actually meet it in rather than empty.
    s.distribution.irrigation.whatsapp = ['user-2'];
    s.distribution.nutrition.whatsapp = ['user-3'];
  }
  return s.distribution;
}

export function F9() {
  const s = state.session;
  ensureDistribution();

  const names = (ids) => ids.map((id) => personName(id)?.split(' ')[0]).filter(Boolean).join(', ');

  return {
    top: appBar({ title: t('f9.title', 'Advice distribution') }),
    body: page(
      h('p', { style: { margin: 0, color: 'var(--ink-600)' } },
        t('f9.intro', 'Advice can go straight to the person who does that work, as it arrives.')),

      DISTRIBUTION_TYPES.map((d) => section(t(`advice.type.${d.id}`, d.label), {},
        card({}, ADVICE_CHANNELS.map((ch) => {
          const who = s.distribution[d.id]?.[ch] ?? [];
          return row({
            iconName: CHANNEL_ICON[ch],
            title: t(`channel.${ch}`, CHANNEL_LABEL[ch]),
            sub: who.length ? names(who) : t('f9.nobody', 'Nobody yet'),
            value: who.length ? h('span.chip__count', String(who.length)) : null,
            onclick: () => openSheet('ADVICE_RECIPIENTS', { type: d.id, channel: ch }),
          });
        })))),

      // WF7.006 — quiet hours, default 21:00–05:00, never applied to urgent
      // advice. It stays: routing is who, this is when.
      section(t('f9.quiet', 'Quiet hours'), {},
        card({},
          h('div', { style: { padding: '4px 16px' } },
            switchRow(t('f9.quiet.on', 'Hold messages overnight'), s.quietHours.on,
              (v) => { s.quietHours.on = v; commit('notify'); })),
          when(s.quietHours.on, () => h('div', { style: { display: 'flex', gap: '10px', padding: '0 16px 14px' } },
            field(t('f9.from', 'From'), input({ type: 'time', value: s.quietHours.from, onchange: (e) => { s.quietHours.from = e.target.value; commit('notify'); } })),
            field(t('f9.to', 'To'), input({ type: 'time', value: s.quietHours.to, onchange: (e) => { s.quietHours.to = e.target.value; commit('notify'); } })))),
          h('div', { style: { padding: '0 16px 14px', fontSize: 'var(--t-meta)', color: 'var(--ink-500)' } },
            t('f9.quiet.note', 'Urgent advice always comes through.'), req('WF7.006')))),

      disclaimer(t('f9.language', 'Every message reaches its reader in their own language, no matter who sent it.')),
      h('p', { style: { fontSize: 'var(--t-meta)', color: 'var(--ink-500)', margin: 0 } },
        t('f9.cap', 'We send at most 6 messages a day. Anything beyond that arrives as one summary.'), req('WF7.008'))),
  };
}

export const CHANNEL_LABEL = { sms: 'SMS', whatsapp: 'WhatsApp', telegram: 'Telegram' };
const CHANNEL_ICON = { sms: 'phone', whatsapp: 'whatsapp', telegram: 'send' };

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
      /* THREE THINGS CAME OFF THIS SCREEN AT THE 01/09 REVIEW, and the two
         buttons that were left are now the same size as the third.

           the opening hours   "remove as they are not calling us". A line about
                               when the phone is answered is about a phone, and
                               nothing on this screen is one.
           the word "us"       twice, on the two channels. The heading says who
                               it reaches; the button says how.
           the server footnote  "Contact details are loaded from our servers, so
                               they're always current" is a fact about our
                               infrastructure told to a farmer who wants help.

         The heading and the two channels are helpBlock(), because A3 carries
         the same offer at the bottom of the front door. */
      helpBlock(),

      // WF5.156 — the ticket route, where the plan includes it. It is the third
      // way to reach the same people and it is now drawn at the same weight as
      // the other two.
      has('tickets')
        ? btn(t('f13.ticket', 'Raise a support ticket'), { variant: 'secondary', icon: 'document', onclick: () => toast(t('f13.ticket.opened', 'Opening a ticket…')) })
        : h('button.lockbox', { onclick: () => openModal('UPGRADE', { featureKey: 'tickets' }) },
            icon('lock', 22), h('span.lockbox__title', t('f13.ticket', 'Raise a support ticket'))),

      h('p', { style: { fontSize: 'var(--t-meta)', color: 'var(--ink-500)', margin: 0 } },
        req('WF5.190', 'WF5.191', 'WF5.193'))),
  };
}

/* -- F14 · My profile ----------------------------------------------------- */

/* -- F14 · My profile, WF4.032 / WF4.033 ----------------------------------

   REVIEW 06/09 CUT THIS SCREEN BACK TO WHAT ITS NAME PROMISES: "this screen
   should be to update contact information only".

   It was four things at once — a name, two contact details that could not be
   edited, a read-only card of role, farms and language, and a way to delete the
   account. The card was the problem: role is decided by whoever invited you,
   the farm list is B2's, and the language moved to F7 in the same review, so
   three facts nobody could act on were sitting on the one screen a farmer opens
   to change something.

   WHAT CHANGED, AND WHY EACH ONE.

     the name       split in two, as on A5. "Split into 'First name' and 'Last
                    Name'" — and A3 greets the farmer by the first of them,
                    which a single free-text box cannot reliably produce.
     the number     editable. It carried "your mobile number is your account,
                    contact us to change it", and since the same review the
                    account is the EMAIL address: the number is a detail, and a
                    detail a farmer cannot change on an international app is a
                    support ticket waiting to happen.
     the address    editable for the same reason, with the same caveat as any
                    account identifier — changing it sends a code to the new one.
     the card       deleted.
     the avatar     "Is this needed?" It is kept, and it is the one item here
                    that is not a change: two initials at the top of a profile
                    is how a farmer knows at a glance whose account he is
                    looking at on a phone several people share (WF5.147), which
                    is a real case in this market. Raised as a question rather
                    than a change, so it is answered rather than acted on.
     the button     "Change to: 'Save code to new phone number' and user is
                    redirected to A6 (new user)". It read "Save boundary", which
                    was a straightforward defect — the wrong label from another
                    screen. What it does now depends on what was edited: change
                    the number and it sends a code there and hands to A6; change
                    nothing but the name and it simply saves. */

export function F14() {
  const person = me();
  const d = local('f14', {
    firstName: person.firstName,
    lastName: person.lastName,
    phone: person.phone,
    email: person.email,
  });
  return {
    top: appBar({ title: t('f14.title', 'My profile') }),
    body: page(
      h('div', { style: { display: 'flex', justifyContent: 'center', padding: '6px 0' } }, avatar(person.initials, { large: true })),

      h('div.fieldpair',
        field(t('a5.firstname', 'First name'), input({
          value: d.firstName, name: 'firstname', autocomplete: 'given-name',
          oninput: (e) => { d.firstName = e.target.value; },
        })),
        field(t('a5.lastname', 'Last name'), input({
          value: d.lastName, name: 'lastname', autocomplete: 'family-name',
          oninput: (e) => { d.lastName = e.target.value; },
        }))),

      field(t('a3.mobile', 'Mobile number'), input({
        type: 'tel', inputmode: 'tel', value: d.phone, name: 'phone', autocomplete: 'tel',
        oninput: (e) => { d.phone = e.target.value; },
      }), { hint: t('f14.phonecode', 'We will send a code to this number to confirm it is yours.') }),

      // No hint under it. It said "this is your account — you sign in with it,
      // and reports and codes are sent to it", which is true and is a thing a
      // farmer standing on his profile screen already knows; review 06/09
      // (second pass) took it off for the same reason it took the two lines off
      // A5.
      field(t('a5.email', 'Email address'), input({
        type: 'email', inputmode: 'email', value: d.email, name: 'email', autocomplete: 'email',
        oninput: (e) => { d.email = e.target.value; },
      })),

      // Annex A.4 / A.11 — the plain-language notice a supervisor sees, since
      // it is his photographs and his position the farm owner can look at.
      when(state.session.role === 'supervisor', () => disclaimer(
        t('f14.photonotice', 'Photos you take include your location and the time. The farm owner can see them. You can ask us to delete your personal data at any time.'))),

      card({}, row({
        iconName: 'trash', title: t('f7.delete', 'Delete my account'), onclick: () => openModal('DELETE_ACCOUNT'),
      }))),

    /* Review 06/09, and confirmed on the second pass — "change to: 'Send code
       to new phone number' and user is redirected to A6". The button read "Save
       boundary", which was simply the wrong label carried in from another
       screen.

       It is his words and it is not conditional. This screen holds contact
       details and nothing else since the same round, and the number is the one
       detail on it that has to be proved before it is worth anything — so
       committing the screen IS sending the code, and A6 does the proving. A
       button that changed its own name depending on which field had been
       touched would be a third thing to read on a screen the round has spent
       two passes making shorter. */
    dock: actionDock(btn(t('f14.savecode', 'Send code to new phone number'), {
      variant: 'primary',
      deckTo: 'A6',
      onclick: () => go('A6:reset'),
    })),
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
      /* WF5.015 / WF5.097 — an active alert outranks the forecast it is about,
         and it is READ HERE rather than on a screen of its own.

         D6 was that screen, and the Monday review deleted it. It was the advice
         detail shell wrapped round a weather warning, which made a forecast
         look like a job — and the same review had just settled that weather is
         a notification and not an advice. What it carried that mattered is the
         three lines below: the threshold that was crossed, the window it falls
         in, and what that means for this farm. They belong on the weather
         screen, and the farmer is already on it. */
      when(w.alert, () => card({ accent: w.alert.severity }, cardPad(
        h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
          statusIcon(w.alert.severity, 20),
          h('span', { style: { fontWeight: 700, flex: 1 } }, w.alert.title)),
        h('div', { style: { color: 'var(--ink-600)' } }, w.alert.detail),
        kv([
          [t('f15.threshold', 'Threshold crossed'), w.alert.threshold ?? '44 °C air temperature'],
          [t('f15.window', 'Window'), w.alert.window ?? 'Tuesday 4 August, 12:00–16:00'],
        ]),
        req('WF5.097')))),

      card({}, cardPad(
        h('div', { style: { display: 'flex', alignItems: 'center', gap: '12px' } },
          h('span', { style: { color: 'var(--st-monitor)', display: 'flex' } }, icon(w.condition === 'Clear' ? 'sun' : 'cloud', 34)),
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

      /* WF5.098 — what we watch for, and the one rule about it worth stating.
         Both came off D6 with the screen; this is the page they were always
         about, and a farmer reading a forecast is exactly the person asking
         which conditions we will wake him for. */
      section(t('f15.types', 'Alerts we watch for'), {},
        card({}, ALERT_TYPES.map((type) => row({
          iconName: type.icon, title: t(`d6.type.${type.id}`, type.label), chevron: false,
          value: h('span.status.status--good', icon('check', 14), t('d6.on', 'On')),
        })))),

      h('p', { style: { fontSize: 'var(--t-meta)', color: 'var(--ink-500)', margin: 0 } },
        t('f15.push', 'Severe weather alerts always reach you, in your own language, whatever your quiet hours say.'),
        req('WF5.015', 'WF5.098'))),
  };
}

const ALERT_TYPES = [
  { id: 'frost', label: 'Frost', icon: 'snow' },
  { id: 'heat', label: 'Heat stress', icon: 'thermometer' },
  { id: 'wind', label: 'High wind (spraying)', icon: 'wind' },
  { id: 'rain', label: 'Heavy rain', icon: 'rain' },
  { id: 'dust', label: 'Sandstorm and dust', icon: 'dust' },
  { id: 'humidity', label: 'High humidity (disease)', icon: 'droplet' },
];
