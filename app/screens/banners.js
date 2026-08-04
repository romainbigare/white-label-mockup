/* ---------------------------------------------------------------------------
   banners.js — the strip above every screen.

   Rendered by the shell, not by screens, because three requirements say "on
   every screen":
     WF-165  the demo banner, not dismissible, with an Exit control
     WF-791  the connectivity indicator, three states, with a pending count
     WF-015  never block the user with a full-screen "no connection" message
             when cached data exists — so offline is a strip, never a takeover
   --------------------------------------------------------------------------- */

import { h, when } from '../core/dom.js';
import { state, toast, commit } from '../core/store.js';
import { t } from '../core/i18n.js';
import { icon } from '../ui/icons.js';
import { openModal } from '../core/router.js';

export function banners() {
  const { demo, connectivity, pendingSync } = state.session;
  return h('div', { style: { flex: '0 0 auto' } },
    when(demo, demoBanner),
    when(connectivity === 'offline', offlineBanner),
    when(connectivity === 'syncing', () => syncBanner(pendingSync)));
}

function demoBanner() {
  return h('div.banner.banner--demo',
    icon('warning', 17),
    h('span', t('demo.banner', 'Demo — nothing here is saved')),
    h('button.banner__action', {
      onclick: () => openModal('DEMO_EXIT'),
    }, t('demo.exit', 'Exit')));
}

function offlineBanner() {
  return h('div.banner.banner--offline',
    icon('offline', 17),
    h('span', t('conn.offline.line', 'Offline — showing saved data')),
    when(state.session.pendingSync > 0, () => h('button.banner__action', {
      onclick: () => toast(t('sync.queued', '{n} items will send when you have signal', { n: state.session.pendingSync }), 'warn'),
    }, t('sync.pending', '{n} waiting', { n: state.session.pendingSync }))));
}

function syncBanner(count) {
  return h('div.banner.banner--sync',
    icon('sync', 17),
    h('span', t('conn.syncing.line', 'Sending {n} items…', { n: count })),
    h('button.banner__action', {
      onclick: () => {
        state.session.connectivity = 'online';
        state.session.pendingSync = 0;
        commit('sync');
        toast(t('sync.done', 'Everything is up to date'));
      },
    }, t('sync.now', 'Sync now')));
}

/** WF-792 — cached content older than 24 hours carries a visible age label. */
export function cachedAgeBanner(label) {
  return h('div.banner.banner--cached',
    icon('clock', 17),
    h('span', label));
}

/** The inline connectivity chip used in app bars. */
export function connChip() {
  const c = state.session.connectivity;
  const label = c === 'online' ? t('conn.online', 'online')
    : c === 'offline' ? t('conn.offline', 'offline')
    : t('conn.syncing', 'syncing');
  return h(`span.conn.conn--${c}`,
    icon(c === 'offline' ? 'offline' : c === 'syncing' ? 'sync' : 'online', 14),
    h('span', label),
    when(c !== 'online' && state.session.pendingSync > 0, () => h('span', `· ${state.session.pendingSync}`)));
}
