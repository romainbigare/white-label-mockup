/* ---------------------------------------------------------------------------
   capabilities.js — WF8.001/WF8.002.

   Permissions are a capability matrix. Three role templates ship, each being a
   named set of capabilities; adding a fourth must not require re-architecting.
   Screen code asks `can('task.assign', farm)` and never `role === 'supervisor'`.

   In the product every one of these is ALSO enforced server-side on the specific
   object being acted on (WF8.006). Here there is no server, so this module is the
   single client-side mirror of that matrix — one place to read, one place to fix.
   --------------------------------------------------------------------------- */

import { state } from './store.js';

const ALL = '*';        // unconditional
const OWN = 'own';      // only objects owned by / assigned to this user
const SCOPED = 'scoped'; // only farms the user has been granted

export const MATRIX = {
  //                        owner   supervisor      worker
  'farm.view':            [ALL,    SCOPED,         SCOPED],
  'farm.create':          [ALL,    null,           null],
  'farm.edit':            [ALL,    SCOPED,         null],
  'farm.delete':          [ALL,    null,           null],
  'farm.transfer':        [ALL,    null,           null],
  'farm.boundary.edit':   [ALL,    SCOPED,         null],
  'plot.create':          [ALL,    SCOPED,         null],
  'plot.delete':          [ALL,    null,           null],
  'cropcycle.manage':     [ALL,    SCOPED,         null],
  'analytics.view':       [ALL,    SCOPED,         null],
  'advice.view':          [ALL,    SCOPED,         null],
  'advice.acknowledge':   [ALL,    SCOPED,         null],
  'input.log':            [ALL,    SCOPED,         OWN],
  'task.view.all':        [ALL,    SCOPED,         null],
  'task.view.own':        [ALL,    SCOPED,         OWN],
  'task.create':          [ALL,    SCOPED,         null],
  'task.assign':          [ALL,    SCOPED,         null],
  'task.complete':        [ALL,    SCOPED,         OWN],
  'observation.create':   [ALL,    SCOPED,         ALL],
  'tree.view':            [ALL,    SCOPED,         SCOPED],
  'tree.override':        [ALL,    SCOPED,         null],
  'report.view':          [ALL,    SCOPED,         null],
  'report.export':        [ALL,    SCOPED,         null],
  'member.invite':        [ALL,    'worker-only',  null],   // WF8.003
  'member.remove':        [ALL,    null,           null],
  'member.role.change':   [ALL,    null,           null],
  'subscription.view':    [ALL,    null,           null],
  'subscription.manage':  [ALL,    null,           null],
  'auditlog.view':        [ALL,    null,           null],
};

const ROLE_INDEX = { owner: 0, supervisor: 1, worker: 2 };

export const ROLE_LABEL = {
  owner: 'Farm Owner',
  supervisor: 'Farm Supervisor',
  worker: 'Farm Worker',
};

/** The one question application code is allowed to ask. */
export function can(capability, farm = null, role = state.session.role) {
  const row = MATRIX[capability];
  if (!row) return false;
  const grant = row[ROLE_INDEX[role]];
  if (!grant) return false;
  if (grant === SCOPED && farm) return farmsFor(role).some((f) => f.id === farm.id);
  return true;
}

/** How a grant is qualified, for the capability-matrix screen in the harness. */
export function grantFor(capability, role) {
  return MATRIX[capability]?.[ROLE_INDEX[role]] ?? null;
}

/** WF8.004 — access is granted per farm, not per account. */
export function farmsFor(role = state.session.role) {
  const all = state.db.farms;
  if (role === 'owner') return all;
  if (role === 'supervisor') return all.filter((f) => ['farm-1', 'farm-3'].includes(f.id));
  return all.filter((f) => f.id === 'farm-1');
}

/* -- tab bar composition, WF3.001 / WF3.002 / WF3.005 ----------------------- */

const TAB_HOME    = { id: 'home',   labelKey: 'nav.home',   icon: 'home' };
const TAB_MAP     = { id: 'map',    labelKey: 'nav.map',    icon: 'map' };
const TAB_ADVICE  = { id: 'advice', labelKey: 'nav.advice', icon: 'advice' };
const TAB_TASKS   = { id: 'tasks',  labelKey: 'nav.tasks',  icon: 'tasks' };
const TAB_WORK    = { id: 'tasks',  labelKey: 'nav.mywork', icon: 'tasks' };
const TAB_MORE    = { id: 'more',   labelKey: 'nav.more',   icon: 'more' };

export function tabsFor(role = state.session.role) {
  if (role === 'worker') return [TAB_WORK, TAB_MAP, TAB_MORE];
  return [TAB_HOME, TAB_MAP, TAB_ADVICE, TAB_TASKS, TAB_MORE];
}
