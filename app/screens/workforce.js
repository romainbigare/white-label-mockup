/* ---------------------------------------------------------------------------
   workforce.js — §5.6, G1 … G3.

   The people who do the work and never open the app.

   This is the part of the product most easily got wrong, because the obvious
   design is to invite everyone and let them install it. WF5.064 says otherwise:
   creating a worker record makes no account, sends no invitation, and installs
   nothing. A worker with a five-year-old handset and no data plan is still
   reachable by SMS, and the whole feature exists so that the person holding the
   hose is not the one person the software cannot talk to.

   That is why a record carries exactly four things (WF5.063) — name, number,
   language, and how to reach them. Anything more is a form nobody fills in.

   WF5.062 puts this on the FARM screen, beside Plots and Trees, not in Settings
   and not in the More tab. Workforce is part of the holding, in the same way
   the plots are; filing it under preferences would say it was a configuration
   detail. The only other way in is the assignee picker, which is where you
   discover you need it.
   --------------------------------------------------------------------------- */

import { h, when } from '../core/dom.js';
import { commit } from '../core/store.js';
import { local } from '../core/local.js';
import { t, LANGUAGES, langMeta } from '../core/i18n.js';
import { go, back, openModal, openSheet } from '../core/router.js';
import { icon } from '../ui/icons.js';
import {
  appBar, barAction, page, section, card, cardPad, btn, actionDock, field,
  input, select, switchRow, disclaimer, emptyState, req, avatar, kv,
} from '../ui/components.js';
import { num, date } from '../core/format.js';
import { farmById, workersOf, workerById, tasksForAssignee, invitationFor } from '../data/selectors.js';
import { saveWorker, setWorkerActive, inviteWorkerToApp, revokeInvitation } from '../data/actions.js';
import { state } from '../core/store.js';

/* WF5.066 — the language on the record is the language the instruction goes out
   in, so it is shown wherever the person is, not hidden in their detail. */
function langName(code) {
  return langMeta(code).english;
}

function reach(w) {
  const parts = [];
  if (w.whatsapp) parts.push(t('worker.whatsapp', 'WhatsApp'));
  if (w.sms) parts.push(t('worker.sms', 'SMS'));
  return parts.join(' + ');
}

/* -- G1 · Workforce -------------------------------------------------------- */

export function G1(farmId) {
  const farm = farmById(farmId);
  const ui = local(`g1-${farmId}`, { showInactive: false });
  const people = workersOf(farm.id, { includeInactive: ui.showInactive });

  return {
    tabs: false,
    top: appBar({
      title: t('g1.title', 'Workforce'),
      subtitle: farm.name,
      actions: [barAction('plus', t('action.add', 'Add'), () => go(`G2:${farm.id}`))],
    }),
    body: page(
      h('p', { style: { margin: 0, color: 'var(--ink-600)' } },
        t('g1.lead', 'People you send work to. They do not need the app — instructions reach them by message, in their own language.'),
        req('WF5.064')),

      people.length
        ? card({}, people.map((w) => workerRow(w)))
        : emptyState({
          iconName: 'users',
          title: t('g1.empty', 'Nobody on this farm yet'),
          body: t('g1.empty.body', 'Add the people who do the work, and you can send them jobs straight from the advice screen.'),
          action: { label: t('g2.title', 'Add a worker'), onclick: () => go(`G2:${farm.id}`) },
        }),

      // WF5.070 — deactivated people are not deleted, so they need somewhere to be.
      h('button.textlink', {
        style: { alignSelf: 'flex-start', fontSize: 'var(--t-meta)' },
        onclick: () => { ui.showInactive = !ui.showInactive; commit('g1'); },
      }, ui.showInactive
        ? t('g1.hideinactive', 'Hide people who have left')
        : t('g1.showinactive', 'Show people who have left')),

      disclaimer(t('g1.note', 'These are not app accounts. To give someone the app instead, invite them from Team and access.'))),
  };
}

function workerRow(w) {
  // Everything about a worker record is short except the phone number, so the
  // count goes on the sub line rather than into a right-hand column — a column
  // wide enough for "nothing open" leaves the number wrapping mid-digit.
  const facts = [langName(w.lang), reach(w),
    w.openTasks ? t('worker.opentasks', '{n} open', { n: num(w.openTasks) }) : t('worker.notasks', 'nothing open'),
    w.active ? null : t('worker.inactive', 'no longer working here')].filter(Boolean);
  return h('button.row', { onclick: () => go(`G3:${w.id}`) },
    avatar(initials(w.name)),
    h('div.row__main', { style: { minWidth: 0 } },
      h('div.row__title', w.name),
      // The title stays on the record. A worker rarely opens the app, so this
      // line is for the OWNER: "who do I send the spraying to" is answered by a
      // job far faster than by a list of names.
      h('div.row__sub', `${t(`worker.title.${slugTitle(w.title)}`, w.title)} · ${w.dial} ${w.phone}`),
      h('div.row__sub', { style: { color: 'var(--ink-500)' } }, facts.join(' · '))),
    h('span.row__chev', icon('forward', 20, 'flip')));
}

function initials(name) {
  return name.split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
}

function slugTitle(title) {
  return String(title ?? '').toLowerCase().replace(/[^a-z]+/g, '-');
}

/* A short list rather than a free-text box: an owner picking from six is faster
   than typing, and it keeps the word the same across a workforce. */
const TITLES = ['Foreman', 'Irrigation lead', 'Sprayer operator', 'Picker', 'Pruner', 'General hand'];

/* -- G2 · Add a worker, WF5.063 … WF5.065 --------------------------------- */

export function G2(param) {
  // The shell hands a screen ONE route parameter, so an edit arrives as
  // `farm-1|w-1` and has to be split — the same shape B7 and B8 use. Reading it
  // as two arguments silently gave farmId the whole string and workerId
  // undefined, so Edit opened a blank Add form and saving made a second record.
  const [farmId, workerId] = String(param ?? '').split('|');
  const existing = workerId ? workerById(workerId) : null;
  const d = local(`g2-${workerId ?? farmId}`, {
    name: existing?.name ?? '',
    dial: existing?.dial ?? '+966',
    phone: existing?.phone ?? '',
    title: existing?.title ?? TITLES[TITLES.length - 1],
    lang: existing?.lang ?? 'ar',
    sms: existing?.sms ?? false,
    whatsapp: existing?.whatsapp ?? true,
  });
  // WF5.065 — both may be on; at least one must be. A record with neither can
  // never be sent anything, so the save is held rather than the toggle blocked.
  const noChannel = !d.sms && !d.whatsapp;

  return {
    tabs: false,
    top: appBar({ title: existing ? t('g2.edit', 'Edit worker') : t('g2.title', 'Add a worker') }),
    body: page(
      field(t('g2.name', 'Name'), input({
        value: d.name, autocomplete: 'name',
        oninput: (e) => { d.name = e.target.value; },
        onchange: () => commit('g2'),
      }), { required: true }),

      field(t('g2.mobile', 'Mobile number'),
        h('div.inputgroup',
          select(state.db.countries.map((c) => ({ value: c.dial, label: `${c.flag} ${c.dial}` })),
            d.dial, (v) => { d.dial = v; commit('g2'); }, { style: { width: '112px' } }),
          input({
            type: 'tel', inputmode: 'tel', placeholder: '5X XXX XXXX', value: d.phone,
            oninput: (e) => { d.phone = e.target.value; },
            onchange: (e) => { d.phone = e.target.value.replace(/[\s-]/g, '').replace(/^0+/, ''); commit('g2'); },
          })),
        { required: true }),

      field(t('g2.job', 'Job'),
        select(TITLES.map((v) => ({ value: v, label: t(`worker.title.${slugTitle(v)}`, v) })),
          d.title, (v) => { d.title = v; commit('g2'); })),

      field(t('g2.lang', 'Language'),
        select(LANGUAGES.map((l) => ({ value: l.code, label: `${l.native} · ${l.english}` })),
          d.lang, (v) => { d.lang = v; commit('g2'); }),
        { required: true, hint: t('g2.lang.hint', 'Work will be sent in this language.') }),

      section(t('g2.reach', 'How should we reach them?'), {},
        card({},
          switchRow(t('worker.sms', 'SMS'), d.sms, (v) => { d.sms = v; commit('g2'); }),
          switchRow(t('worker.whatsapp', 'WhatsApp'), d.whatsapp, (v) => { d.whatsapp = v; commit('g2'); }))),

      when(noChannel, () => disclaimer(
        t('g2.nochannel', 'Choose at least one. Without a way to reach them, they cannot be sent work.'), true)),

      h('p', { style: { fontSize: 'var(--t-meta)', color: 'var(--ink-500)', margin: 0 } },
        t('g2.noaccount', 'This creates no account and sends no invitation. Nothing is installed on their phone.'),
        req('WF5.064'))),

    dock: actionDock(btn(t('action.save', 'Save'), {
      variant: 'primary',
      disabled: !d.name.trim() || d.phone.replace(/\D/g, '').length < 6 || noChannel,
      onclick: () => {
        saveWorker({ id: workerId, farmId, ...d });
        back();
      },
    })),
  };
}

/* -- G3 · Worker record, WF5.066 … WF5.070 -------------------------------- */

export function G3(workerId) {
  const w = workerById(workerId);
  if (!w) {
    return {
      tabs: false,
      top: appBar({ title: t('g3.title', 'Worker') }),
      body: page(emptyState({
        iconName: 'users',
        title: t('g3.gone', 'That record is no longer here'),
      })),
    };
  }
  const farm = farmById(w.farmId);
  const invite = invitationFor(w.id);
  const mine = tasksForAssignee(w.id);
  const open = mine.filter((task) => ['open', 'in_progress'].includes(task.state));
  const done = mine.filter((task) => task.state === 'done');

  return {
    tabs: false,
    top: appBar({
      title: w.name,
      subtitle: farm.name,
      actions: [barAction('edit', t('action.edit', 'Edit'), () => go(`G2:${w.farmId}|${w.id}`))],
    }),
    body: page(
      card({}, cardPad(
        kv([
          [t('g2.job', 'Job'), t(`worker.title.${slugTitle(w.title)}`, w.title)],
          [t('g2.mobile', 'Mobile number'), `${w.dial} ${w.phone}`],
          [t('g2.lang', 'Language'), langName(w.lang)],
          [t('g2.reach', 'Reached by'), reach(w)],
        ]),
        // WF5.066 — what actually goes out, so the owner knows what they are sending.
        h('p', { style: { margin: 0, fontSize: 'var(--t-meta)', color: 'var(--ink-600)' } },
          t('g3.sends', 'Work goes out as a plain message in {lang}: what to do, how much, where and by when.',
            { lang: langName(w.lang) })))),

      section(t('g3.open', 'Open work'), {},
        open.length
          ? card({}, open.map((task) => h('button.row', { onclick: () => go(`E2:${task.id}`) },
            h('div.row__main',
              h('div.row__title', task.title),
              h('div.row__sub', task.dueAt ? date(task.dueAt) : t('task.nodue', 'No date'))),
            h('span.row__chev', icon('forward', 20, 'flip')))))
          : h('p', { style: { margin: 0, color: 'var(--ink-600)' } }, t('g3.noopen', 'Nothing open right now.'))),

      // WF5.070 — finished work stays theirs, which is the reason deactivating
      // is offered instead of deleting.
      section(t('g3.done', 'Finished'), {},
        h('p', { style: { margin: 0, color: 'var(--ink-600)' } },
          t('g3.donecount', '{n} jobs completed. This stays on their record.', { n: num(done.length) }))),

      section(t('g3.manage', 'This record'), {},
        card({},
          // WF5.067 — the same number can become an app account later, and the
          // history follows the PERSON rather than the record.
          //
          // This is the only place an invitation is issued now. The owner builds
          // the worker record either way; the code is simply how a worker who
          // does have a phone attaches themselves to the record that already
          // exists for them. Issuing invitations from a separate team screen
          // made two lists of the same people and left the code with nothing to
          // attach to.
          invite
            ? h('div', { style: { display: 'flex', alignItems: 'center' } },
              h('button.row', {
                style: { flex: 1, borderBottom: 0 },
                onclick: () => openSheet('QR_SHOW', { code: invite.code, workerId: w.id }),
              },
              h('div.row__main',
                h('div.row__title', t('g3.invited', 'Invitation sent')),
                h('div.row__sub', t('g3.invited.sub', 'Code {code} · expires in {when}', { code: invite.code, when: invite.expiresIn }))),
              h('span.row__chev', icon('forward', 20, 'flip'))),
              // WF4.009 — an owner can revoke a pending invitation with one tap.
              h('button.textlink', {
                style: { fontSize: 'var(--t-meta)', paddingInlineEnd: '16px' },
                onclick: () => revokeInvitation(invite.id),
              }, t('g3.revoke', 'Cancel')))
            : h('button.row', { onclick: () => { const i = inviteWorkerToApp(w.id); if (i) openSheet('QR_SHOW', { code: i.code, workerId: w.id }); } },
              h('div.row__main',
                h('div.row__title', t('g3.invite', 'Give them the app')),
                h('div.row__sub', t('g3.invite.sub', 'Send a code to this number. Their finished work follows them.'))),
              h('span.row__chev', icon('forward', 20, 'flip'))),
          h('button.row', {
            onclick: () => openModal('CONFIRM', {
              title: w.active
                ? t('g3.deactivate.title', 'Deactivate {name}?', { name: w.name })
                : t('g3.reactivate.title', 'Put {name} back on the list?', { name: w.name }),
              body: w.active
                ? t('g3.deactivate.body', 'They stop appearing when you assign work. Everything they have finished stays on record, credited to them.')
                : t('g3.reactivate.body', 'They appear again when you assign work.'),
              confirmLabel: w.active ? t('g3.deactivate', 'Deactivate') : t('g3.reactivate', 'Reactivate'),
              destructive: w.active,
              onConfirm: () => setWorkerActive(w.id, !w.active),
            }),
          },
          h('div.row__main',
            h('div.row__title', { style: { color: w.active ? 'var(--st-urgent)' : 'var(--ink-800)' } },
              w.active ? t('g3.deactivate', 'Deactivate') : t('g3.reactivate', 'Reactivate'))),
          h('span.row__chev', icon('forward', 20, 'flip'))))),

      h('p', { style: { fontSize: 'var(--t-meta)', color: 'var(--ink-500)', margin: 0 } }, req('WF5.070'))),
  };
}
