/* ---------------------------------------------------------------------------
   workforce.js — §5.6, G1 … G3.

   The people who do the work, whether or not they ever open the app.

   ONE IDENTITY, TWO STAGES. That is the whole design, and everything else here
   is a consequence of it. A person record and an app account are the same
   thing at different moments, and the MOBILE NUMBER is what joins them:

     * Saving a record looks the number up. If an account already has it, this
       record is that person — so it attaches, and the owner is shown whose
       account it is before anything is written. If not, a standalone record is
       made, no account, no invitation, nothing installed.
     * Someone who registers later with that number attaches to the record that
       is already waiting for them. They never appear twice.
     * Redeeming an invitation attaches too. Their finished work, their
       language and their notification preferences are already on the record,
       so nothing has to be carried across.

   The delivery pipe falls straight out of it: SMS or WhatsApp while there is no
   account, a push notification once there is. Same record, same task, different
   pipe — and no screen has to ask which kind of person it is holding.

   This lives on the FARM screen, beside Plots and Trees. Workforce is part of
   the holding in the same way the plots are; filing it under settings would say
   it was a configuration detail. The only other way in is the assignee picker,
   which is where you discover you need it.
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
import {
  farmById, workersOf, workerById, tasksForAssignee, invitationFor,
  accountForNumber, deliveryFor,
} from '../data/selectors.js';
import { saveWorker, setWorkerActive, inviteWorkerToApp, revokeInvitation, attachAccount } from '../data/actions.js';
import { state } from '../core/store.js';

/* WF5.066 — the language on the record is the language the instruction goes out
   in, so it is shown wherever the person is, not hidden in their detail. */
function langName(code) {
  return langMeta(code).english;
}

/* The channels the owner chose. Only meaningful while there is no account —
   once there is, the app itself is the channel. */
function reach(w) {
  const parts = [];
  if (w.whatsapp) parts.push(t('worker.whatsapp', 'WhatsApp'));
  if (w.sms) parts.push(t('worker.sms', 'SMS'));
  return parts.join(' + ');
}

/* How work actually reaches this person, said in one phrase. This is the line
   that makes the two stages of one identity visible on every screen. */
function pipe(w) {
  return deliveryFor(w) === 'push'
    ? t('worker.pipe.app', 'In the app')
    : reach(w);
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
        t('g1.lead', 'Everyone you send work to. People without the app get a message in their own language; those with it get the same job as a notification.')),

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

      // The number is the identity, so this is a statement about matching, not
      // about a second list somewhere else.
      disclaimer(t('g1.note', 'Each person has one record, matched by their mobile number. If they already have a Wafra account — or create one later — it links up automatically instead of creating a duplicate.'))),
  };
}

function workerRow(w) {
  // Everything about a worker record is short except the phone number, so the
  // count goes on the sub line rather than into a right-hand column — a column
  // wide enough for "nothing open" leaves the number wrapping mid-digit.
  const facts = [langName(w.lang), pipe(w),
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

/* No rule defends this list any more, and the field is optional to the product.
   It stays because it is what the owner actually searches on: "who do I send
   the spraying to" is answered by a job far faster than by a list of names. */
const TITLES = ['Foreman', 'Irrigation lead', 'Sprayer operator', 'Picker', 'Pruner', 'General hand'];

/* -- G2 · Add a worker ----------------------------------------------------- */

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
  // Both channels may be on; at least one must be. A record with neither can
  // never be sent anything, so the save is held rather than the toggle blocked.
  const noChannel = !d.sms && !d.whatsapp;

  // The number is looked up as it is typed, so the owner learns that this
  // person already has an account BEFORE they reach the button — not in a
  // dialogue that interrupts them at the end. `existing?.accountId` is the case
  // where it is already attached and there is nothing to announce.
  const match = accountForNumber(d.dial, d.phone);
  const attaching = match && match.id !== existing?.accountId ? match : null;

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
        {
          required: true,
          hint: attaching
            ? t('g2.knownnumber', 'This number belongs to {name}. Saving joins the two.', { name: attaching.name })
            : null,
        }),

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
        attaching
          ? t('g2.willattach', 'Work will reach them in the app. SMS and WhatsApp are kept for if they lose it.')
          : t('g2.noaccount', 'This creates no account and sends no invitation. Nothing is installed on their phone.'))),

    dock: actionDock(btn(t('action.save', 'Save'), {
      variant: 'primary',
      disabled: !d.name.trim() || d.phone.replace(/\D/g, '').length < 6 || noChannel,
      onclick: () => {
        // Saving a number that already belongs to somebody is not a form
        // submission, it is a claim about who this person is — so it is stated
        // and confirmed rather than done quietly. The owner sees the account
        // holder's name; if it is not who they meant, the number is wrong.
        if (attaching) {
          openModal('CONFIRM', {
            title: t('g2.attach.title', 'This number is already {name}', { name: attaching.name }),
            body: t('g2.attach.body', 'This number belongs to a Wafra account. Saving links the two records, so work goes straight to their app and everything they do stays under one name.'),
            confirmLabel: t('g2.attach.ok', 'Yes, same person'),
            onConfirm: () => { saveWorker({ id: workerId, farmId, ...d }); back(); },
          });
          return;
        }
        saveWorker({ id: workerId, farmId, ...d });
        back();
      },
    })),
  };
}

/* -- G3 · Worker record ---------------------------------------------------- */

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
  const hasApp = !!w.accountId;
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
          [t('g3.reaches', 'Work reaches them'), pipe(w)],
        ]),
        // What actually goes out, so the owner knows what they are sending. The
        // sentence changes with the pipe because the two are genuinely
        // different objects at the other end — a text message someone reads
        // once, or a task they can open, photograph and close.
        h('p', { style: { margin: 0, fontSize: 'var(--t-meta)', color: 'var(--ink-600)' } },
          hasApp
            ? t('g3.sends.app', 'Work arrives as a notification in {lang}, and they mark it done in the app with a photo.', { lang: langName(w.lang) })
            : t('g3.sends', 'Work goes out as a plain message in {lang}: what to do, how much, where and by when.', { lang: langName(w.lang) })))),

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
          // The three states of one identity, in the order they happen: no
          // account, invited, attached. Only one of them is ever drawn.
          //
          // This is the only place an invitation is issued. The owner builds the
          // person record either way; the code is simply how somebody who does
          // have a phone attaches themselves to the record that already exists
          // for them, which is why it is bound to that record and not to a
          // number floating in a separate list.
          hasApp
            ? h('div.row.row--static',
              h('span', { style: { color: 'var(--brand-700)', display: 'flex' } }, icon('check', 21)),
              h('div.row__main',
                h('div.row__title', t('g3.hasapp', 'They have the app')),
                h('div.row__sub', t('g3.hasapp.sub', 'Joined by mobile number, so everything on this record is theirs.'))))
            : invite
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
                ? t('g3.deactivate.body', 'They won’t appear when you assign work. Everything they’ve done stays on record, credited to them.')
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
