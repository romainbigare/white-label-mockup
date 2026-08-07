/* ---------------------------------------------------------------------------
   more.js — F0 More, F1 Reports, F2–F4 Team, F5/F6 Subscription,
   F7–F10 Settings, F11 Activity log, F12 Help, F13 Contact, F14 Profile.

   WF5.126 filters the menu by role, and it does so through can() rather than a
   role name, so the Worker's short list is a consequence of the capability
   matrix rather than a second hard-coded menu.
   --------------------------------------------------------------------------- */

import { h, when } from '../core/dom.js';
import { state, commit, toast, resetData } from '../core/store.js';
import { local } from '../core/local.js';
import { t, LANGUAGES, setLanguage, langMeta, missingReport } from '../core/i18n.js';
import { go, openSheet, openModal, back, enterOnboarding } from '../core/router.js';
import { icon } from '../ui/icons.js';
import {
  appBar, barAction, page, section, card, cardPad, row, btn, actionDock, statusChip,
  statusIcon, kv, emptyState, disclaimer, lockedRow, req, chips, select, field, input,
  switchRow, avatar, divider, radioList, pillTabs,
} from '../ui/components.js';
import { num, date, dateTime, ago, price, priceBare, bytes, area } from '../core/format.js';
import { visibleFarms, farmById, membersOf, memberById, me, activityFor, plotsOf } from '../data/selectors.js';
import { can, ROLE_LABEL, MATRIX, grantFor } from '../core/capabilities.js';
import { has, planLabel, PLANS, offeredFamily } from '../core/entitlements.js';
import { revokeInvitation, createInvitation, removeMember, syncNow, clearCache } from '../data/actions.js';
import { RATES } from './onboarding.js';

const APP_VERSION = '1.0.0';
const BUILD = '214';

/* -- F0 · More ------------------------------------------------------------ */

export function F0() {
  const person = me();
  const farms = visibleFarms();
  const isWorker = state.session.role === 'worker';

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
        when(can('report.view'), () => row({ iconName: 'document', title: t('f1.title', 'Reports'), onclick: () => go(`F1:${farms[0]?.id ?? ''}`) })),
        when(can('member.invite'), () => row({
          iconName: 'users', title: t('f2.title', 'Team and access'),
          value: num(state.db.team.length), onclick: () => go(`F2:${farms[0]?.id ?? ''}`),
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
          onConfirm: () => enterOnboarding('A2'),
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
    { id: 'work', label: 'Work completed', feature: null },
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

/* -- F2 · Team and access, WF5.133 … WF5.138 ------------------------------ */

export function F2(farmId) {
  const farm = farmById(farmId);
  const members = membersOf(farm.id);
  const invitations = state.db.invitations.filter((i) => i.farmIds.includes(farm.id));

  return {
    top: appBar({
      title: t('f2.title', 'Team and access'), subtitle: farm.name,
      actions: [can('member.invite', farm) ? barAction('plus', t('f3.title', 'Invite'), () => go(`F3:${farm.id}`)) : null].filter(Boolean),
    }),
    body: page(
      h('button.chip', { onclick: () => openSheet('FARM_PICKER', { onPick: (id) => go(`F2:${id}`, { replace: true }) }), style: { alignSelf: 'flex-start' } },
        icon('home', 16), h('span', farm.name), icon('chevronDown', 15)),

      card({}, members.map((m) => h('button.row', { onclick: () => go(`F4:${m.id}`) },
        avatar(m.initials),
        h('div.row__main',
          h('div.row__title', `${m.name}${m.isYou ? ` · ${t('f2.you', 'you')}` : ''}`),
          // WF5.134 — role AND app language, so the assigner knows which language
          // a task will be delivered in.
          h('div.row__sub', `${t(`role.${m.role}`, ROLE_LABEL[m.role])} · ${m.language}`),
          h('div.row__sub', t('f2.lastactive', 'Last active {when}', { when: m.lastActive }))),
        h('span.row__chev', icon('forward', 20, 'flip'))))),

      // WF5.133 — pending invitations with expiry and a one-tap cancel.
      when(invitations.length > 0, () => section(t('f2.pending', 'Pending invitations'), {},
        card({}, invitations.map((inv) => h('div.row.row--static',
          h('div.row__main',
            h('div.row__title', inv.phone),
            h('div.row__sub', `${t(`role.${inv.role}`, ROLE_LABEL[inv.role])} · ${t('f2.sent', 'sent {when}', { when: inv.sentAgo })}`),
            h('div.row__sub', t('f2.expires', 'Expires in {when}', { when: inv.expiresIn }))),
          when(can('member.remove'), () => btn(t('action.cancel', 'Cancel'), {
            variant: 'ghost', size: 'sm', block: false, onclick: () => revokeInvitation(inv.id),
          }))))))),

      when(state.session.role === 'supervisor', () => disclaimer(
        t('f2.supervisor', 'As a supervisor you can invite workers, and only to farms you already have access to.'))),
      h('p', { style: { fontSize: 'var(--t-meta)', color: 'var(--ink-500)', margin: 0 } },
        t('f2.scoped', 'Access is granted per farm. Someone can be a supervisor here and have no access to another farm.'), req('WF8.004'))),
  };
}

/* -- F3 · Invite someone, WF5.135 … WF5.137 ------------------------------- */

export function F3(farmId) {
  const farm = farmById(farmId);
  const d = local(`f3-${farmId}`, { method: 'whatsapp', phone: '', role: 'worker', farmIds: [farmId], created: null });
  // WF8.003 — a Supervisor may invite Workers only.
  const roles = state.session.role === 'owner'
    ? [{ id: 'supervisor', label: ROLE_LABEL.supervisor }, { id: 'worker', label: ROLE_LABEL.worker }]
    : [{ id: 'worker', label: ROLE_LABEL.worker }];

  if (d.created) {
    return {
      top: appBar({ title: t('f3.sent.title', 'Invitation ready') }),
      body: page(
        h('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px', paddingTop: '10px' } },
          h('div.qr', qrBlock(d.created.code)),
          h('div', { style: { fontSize: 'var(--t-hero)', fontWeight: 750, letterSpacing: '.14em' } }, d.created.code),
          h('div', { style: { color: 'var(--ink-600)', textAlign: 'center', maxWidth: '30ch' } },
            t('f3.single', 'Single use, expires in 7 days, and carries the {role} role for {farm}.', {
              role: t(`role.${d.created.role}`, ROLE_LABEL[d.created.role]), farm: farm.name,
            }))),
        // WF4.007 — four delivery methods, all producing the same single-use token.
        card({},
          row({ iconName: 'whatsapp', title: t('f3.whatsapp', 'Send by WhatsApp'), sub: t('f3.primary', 'Primary'), onclick: () => toast(t('f3.opened', 'Opening WhatsApp…')) }),
          row({ iconName: 'phone', title: t('f3.sms', 'Send by SMS'), sub: t('f3.fallback', 'Fallback'), onclick: () => toast(t('f3.smssent', 'SMS sent')) }),
          row({ iconName: 'share', title: t('f3.link', 'Share a link'), onclick: () => toast(t('share.opened', 'Opening the share sheet…')) }),
          row({ iconName: 'qr', title: t('f3.showqr', 'Show the QR code'), sub: t('f3.qrsub', 'They scan it from your screen'), onclick: () => openModal('QR_SHOW', { code: d.created.code }) })),
        // WF4.009 — a supervisor can complete the invitation on the worker's device.
        disclaimer(t('f3.nophone', 'If they have no phone of their own, type this 6-character code into their device yourself.'))),
      dock: actionDock(btn(t('action.done', 'Done'), { variant: 'primary', onclick: back })),
    };
  }

  return {
    top: appBar({ title: t('f3.title', 'Invite someone') }),
    body: page(
      field(t('a3.mobile', 'Mobile number'),
        h('div.inputgroup',
          select(state.db.countries.map((c) => ({ value: c.code, label: `${c.flag} ${c.dial}` })), 'SA', () => {}, { style: { width: '112px' } }),
          input({ type: 'tel', placeholder: '5X XXX XXXX', value: d.phone, oninput: (e) => { d.phone = e.target.value; } })),
        { required: true }),
      // WF5.135 — the role is selected during the invite and cannot be left blank.
      field(t('f3.role', 'Their role'),
        radioList(roles.map((r) => ({ id: r.id, label: t(`role.${r.id}`, r.label), sub: roleBlurb(r.id) })),
          d.role, (id) => { d.role = id; commit('f3'); }), { required: true }),
      // WF5.136 — invitations may be scoped to specific farms.
      field(t('f3.scope', 'Which farms?'),
        card({}, visibleFarms().map((f) => switchRow(f.name, d.farmIds.includes(f.id), (on) => {
          d.farmIds = on ? [...d.farmIds, f.id] : d.farmIds.filter((x) => x !== f.id);
          commit('f3');
        }))), { hint: t('f3.scope.hint', 'They will see only the farms you tick.') })),
    dock: actionDock(btn(t('f3.create', 'Create invitation'), {
      variant: 'primary',
      disabled: !d.phone.trim() || !d.farmIds.length,
      onclick: () => {
        const created = createInvitation({ phone: `+966 ${d.phone}`, role: d.role, farmIds: d.farmIds });
        if (created) { d.created = created; commit('f3'); }
      },
    })),
  };
}

function roleBlurb(role) {
  const note = state.db.capabilityNotes?.find((n) => n.role === role);
  return note?.summary ?? '';
}

function qrBlock(seed) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 33 + seed.charCodeAt(i)) >>> 0;
  const cells = [];
  for (let y = 0; y < 21; y += 1) {
    for (let x = 0; x < 21; x += 1) {
      const corner = (x < 7 && y < 7) || (x > 13 && y < 7) || (x < 7 && y > 13);
      const ring = corner && (x % 6 === 0 || y % 6 === 0 || (x > 1 && x < 5 && y > 1 && y < 5) || (x > 15 && x < 19 && y > 1 && y < 5) || (x > 1 && x < 5 && y > 15 && y < 19));
      const on = corner ? ring : ((hash >> ((x * 5 + y * 11) % 30)) & 1) === 1 && (x * y) % 4 !== 0;
      if (on) cells.push(h('rect', { x, y, width: 1, height: 1, fill: 'var(--ink-900)' }));
    }
  }
  return h('svg', { viewBox: '0 0 21 21', 'aria-hidden': 'true' }, cells);
}

/* -- F4 · Member detail --------------------------------------------------- */

export function F4(memberId) {
  const m = memberById(memberId);
  if (!m) return { top: appBar({ title: '' }), body: emptyState({ title: t('f4.gone', 'This person is no longer on the team') }) };

  return {
    top: appBar({ title: m.name }),
    body: page(
      h('div', { style: { display: 'flex', alignItems: 'center', gap: '14px' } },
        avatar(m.initials, { large: true }),
        h('div',
          h('div', { style: { fontWeight: 650, fontSize: 'var(--t-lead)' } }, m.name),
          h('div', { style: { color: 'var(--ink-600)' } }, t(`role.${m.role}`, ROLE_LABEL[m.role])))),

      card({}, cardPad(kv([
        [t('f4.phone', 'Mobile'), m.phone],
        [t('f4.language', 'App language'), m.language],
        [t('f4.lastactive', 'Last active'), m.lastActive],
        [t('f4.opentasks', 'Open tasks'), num(m.openTasks)],
        [t('f4.farms', 'Farms'), m.farmIds.map((id) => farmById(id).name).join(', ')],
      ]))),

      section(t('f4.cancan', 'What they can do'), {},
        card({}, cardPad(h('p', { style: { margin: 0 } }, roleBlurb(m.role))))),

      when(can('member.role.change') && !m.isYou, () => section(t('f4.access', 'Access'), {},
        card({},
          row({ iconName: 'shield', title: t('f4.changerole', 'Change their role'), onclick: () => openSheet('ROLE_PICKER', { memberId: m.id }) }),
          row({
            iconName: 'trash', title: t('f4.remove', 'Remove from the farm'),
            sub: t('f4.remove.sub', 'Takes effect at once. Their completed work stays on the record.'),
            onclick: () => openModal('CONFIRM', {
              title: t('f4.remove', 'Remove from the farm'),
              body: t('f4.remove.body', 'They lose access immediately and are signed out of this farm. Their task completions and observations are kept and stay attributed to them.'),
              confirmLabel: t('f4.remove.confirm', 'Remove'),
              destructive: true,
              onConfirm: () => { removeMember(m.id); back(); },
            }),
          }))))),
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
    lines.push([`${area(cropHa, { bare: true })} ${t('f5.crops', 'crops')}`, priceBare(cropHa * RATES.crop[tier], 'SA')]);
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
          t('f5.trial.body', 'After that you keep your farms, boundaries and history, but new analytics and advice stop until you subscribe.')),
        req('WF5.175')))),

      when(state.session.plan === 'trial_expired', () => card({ accent: 'urgent' }, cardPad(
        h('div', { style: { fontWeight: 700 } }, t('f5.expired', 'Your trial has ended')),
        h('div', { style: { color: 'var(--ink-600)' } },
          t('f5.expired.body', 'You can still see your farms, boundaries, history and past reports. New analytics, advice and task creation are paused. We keep your data for 12 months.')),
        req('WF9.032')))),

      // WF4.107 — one product, one price, one renewal date.
      card({}, cardPad(
        h('div', { style: { fontWeight: 750, letterSpacing: '.06em', fontSize: 'var(--t-meta)', color: 'var(--brand-700)' } },
          plan.label.toUpperCase()),
        h('div', { style: { color: 'var(--ink-600)' } },
          t('f5.farmcount', '{n} farms', { n: num(farms.length) })),
        kv(lines),
        h('div.num', `${priceBare(usd, 'SA')} / ${t('unit.month', 'month')}`),
        h('div', { style: { color: 'var(--ink-600)', fontSize: 'var(--t-meta)' } },
          t('f5.renews', 'Renews {date}', { date: date('2026-09-01') })),
        h('div', { style: { display: 'flex', gap: '8px', marginTop: '4px' } },
          btn(t('f6.title', 'Compare plans'), { variant: 'secondary', size: 'sm', block: false, onclick: () => go('F6') }),
          // WF5.178 — no purchase or upgrade control where it was bought on the web.
          when(!boughtOnWeb, () => btn(t('f5.change', 'Change'), {
            variant: 'primary', size: 'sm', block: false, onclick: () => openSheet('PLAN_CHOOSER'),
          }))))),

      when(family === 'combined', () => disclaimer(
        t('f5.combined', 'You hold one combined subscription covering crops and trees. It has a single price and a single renewal date — never two subscriptions.'))),

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
        t('f5.downgrade', 'To move to crops or trees alone you would first need to archive the farms of the other type. We will show you which ones when you try.'))),

      h('div', { style: { fontSize: 'var(--t-micro)', color: 'var(--ink-500)' } },
        // WF5.177 — never the local receipt, and never which path paid for it.
        t('f5.serverside', 'What you can see and do is decided by our servers on every request, never by this phone and never by how the subscription was bought.'),
        req('WF5.177'))),
  };
}

/* -- F6 · Compare plans, WF9.001 … WF9.003 -------------------------------- */

export function F6() {
  const ui = local('f6', { family: offeredFamily(visibleFarms()) === 'tree' ? 'tree' : 'crop' });
  const table = state.db.planCompare[ui.family];

  return {
    tabs: false,
    top: h('div.app__top',
      h('div.appbar',
        h('button.iconbtn', { onclick: back, 'aria-label': t('a11y.back', 'Back') }, icon('back', 24, 'flip')),
        h('div.appbar__title', t('f6.title', 'Compare plans'))),
      pillTabs([
        { id: 'crop', label: t('f6.crop', 'Crops') },
        { id: 'tree', label: t('f6.tree', 'Trees') },
      ], ui.family, (id) => { ui.family = id; commit('f6'); })),
    body: page(
      h('div', { 'data-hscroll': '', style: { overflowX: 'auto' } },
        h('table', { style: { width: '100%', borderCollapse: 'collapse', fontSize: 'var(--t-meta)' } },
          h('thead',
            h('tr',
              h('th', { style: thStyle('start') }, ''),
              table.plans.map((p) => h('th', { style: thStyle('center') }, p)))),
          h('tbody',
            table.groups.flatMap((group) => [
              h('tr', h('td', {
                colspan: table.plans.length + 1,
                style: {
                  padding: '12px 6px 5px', fontWeight: 700, fontSize: 'var(--t-micro)',
                  textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--ink-500)',
                },
              }, group.name)),
              ...group.rows.map((r) => h('tr',
                h('td', { style: tdStyle('start') }, r.label),
                r.values.map((v) => h('td', { style: tdStyle('center') }, cellValue(v))))),
            ])))),
      // WF9.002 — nothing the farmer can see is called Advanced, Professional
      // or Enterprise, and WF9.005 keeps the supplier's own tier names out of
      // the app entirely: they are server configuration and would be one
      // release out of date the day they changed.
      disclaimer(t('f6.note', 'Two levels for each service: Basic, then Pro. Everything in Basic is in Pro.'), false)),
    dock: actionDock(btn(t('f5.upgrade', 'Upgrade'), { variant: 'primary', onclick: () => openSheet('PLAN_CHOOSER') })),
  };
}

function thStyle(align) {
  return {
    textAlign: align, padding: '8px 6px', borderBottom: '2px solid var(--ink-200)',
    fontWeight: 700, position: 'sticky', top: 0, background: 'var(--canvas)',
  };
}
function tdStyle(align) {
  return { textAlign: align, padding: '7px 6px', borderBottom: '1px solid var(--ink-100)', verticalAlign: 'top' };
}
function cellValue(v) {
  if (v === 'yes') return h('span', { style: { color: 'var(--st-good)', display: 'inline-flex' } }, icon('check', 17));
  if (v === 'no') return h('span', { style: { color: 'var(--ink-300)', display: 'inline-flex' } }, icon('close', 15));
  return h('span', v);
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
        switchRow(t('f7.biometric', 'Unlock with fingerprint or face'), state.session.biometric,
          (v) => { state.session.biometric = v; commit('settings'); }))),
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
      section(t('f8.language', 'App language'), {},
        card({}, LANGUAGES.map((l) => row({
          title: h('span', { dir: l.dir }, l.native), sub: l.english + (l.dir === 'rtl' ? ' · RTL' : ''),
          value: l.code === s.lang ? icon('check', 20) : null, chevron: false,
          onclick: () => setLanguage(l.code),          // WF10.007 — immediate, no restart
        })))),

      section(t('f8.units', 'Units'), {},
        card({},
          row({
            title: t('f8.area', 'Area'), chevron: false,
            value: select([
              { value: 'dunum', label: t('unit.dunum', 'dunum') },
              { value: 'hectare', label: t('unit.ha', 'hectares') },
              { value: 'acre', label: t('unit.acre', 'acres') },
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
            value: select([
              { value: 'gregorian', label: t('f8.cal.greg', 'Gregorian') },
              { value: 'hijri', label: t('f8.cal.hijri', 'Hijri') },
              { value: 'both', label: t('f8.cal.both', 'Both') },
            ], s.calendar, (v) => { s.calendar = v; commit('units'); }),
          }),
          row({ title: t('f8.sample', 'Today shows as'), value: date('2026-08-03'), chevron: false }))),

      section(t('f8.currency', 'Currency'), {},
        card({}, row({ title: t('f8.prices', 'Prices shown in'), value: 'SAR (USD alongside)', chevron: false }))),

      // A mockup-only readout: how complete the catalogue is for this language.
      section(t('f8.translation', 'Translation coverage'), {},
        card({}, cardPad(
          h('p', { style: { margin: 0, fontSize: 'var(--t-meta)', color: 'var(--ink-600)' } },
            t('f8.translation.note', 'Where a phrase is not yet translated the app falls back to English and records the gap. A user never sees a raw key.')),
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

      disclaimer(t('f9.language', 'Every message reaches you in your own language, whoever sent it.')),
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
          t('f10.evict', 'When the limit is reached we remove the oldest imagery first. Your photos and completed work are never removed.'),
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
              iconName: item.kind === 'observation' ? 'camera' : item.kind === 'task.complete' ? 'check' : 'droplet',
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
        t('f10.encrypted', 'Everything saved on this phone, including imagery and queued photos, is encrypted.'), req('WF11.011'))),
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
        t('f11.appendonly', 'This log can only be added to. Nobody, including you, can edit or delete an entry.'), req('WF5.188'))),
  };
}

function logIcon(category) {
  return ({
    boundary: 'edit', cropcycle: 'sprout', task: 'check', input: 'droplet',
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
        t('f12.updated', 'The guide is kept on our servers, so it improves without you updating the app.'), req('WF5.189'))),
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
        : h('button.lockbox', { onclick: () => openModal('UPGRADE', { featureKey: 'expert.opinion' }) },
            icon('lock', 22), h('span.lockbox__title', t('f13.ticket', 'Raise a support ticket'))),

      h('p', { style: { fontSize: 'var(--t-meta)', color: 'var(--ink-500)', margin: 0 } },
        t('f13.config', 'Our contact details come from our servers, so they can change without you updating the app.'), req('WF5.193'))),
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
      // Annex A.4 / A.11 — the plain-language notice workers see at first launch.
      when(state.session.role === 'worker', () => disclaimer(
        t('f14.photonotice', 'Photographs you take record where you were and when. Your supervisor and the farm owner can see them. You can ask us to delete your personal data at any time.'))),
      card({}, row({
        iconName: 'trash', title: t('f7.delete', 'Delete my account'), onclick: () => openModal('DELETE_ACCOUNT'),
      }))),
    dock: actionDock(btn(t('action.save', 'Save'), { variant: 'primary', onclick: () => { toast(t('f14.saved', 'Profile saved')); back(); } })),
  };
}
