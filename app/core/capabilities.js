/* ---------------------------------------------------------------------------
   capabilities.js — WF8.001/WF8.002.

   Permissions are a capability matrix. Two role templates ship, each being a
   named set of capabilities; adding a third must not require re-architecting.
   Screen code asks `can('advice.send', farm)` and never `role === 'supervisor'`.

   THERE IS NO WORKER ROLE. The review that removed task management and the
   workforce screens removed the only thing a worker could have done in the app:
   there is no queue to hold, nothing to mark done and no record to be invited
   from. What is left is the relationship the farm actually runs on — an owner
   and one trusted supervisor — and the supervisor closes a job by tapping the
   link in the message rather than by holding an account.

   In the product every one of these is ALSO enforced server-side on the specific
   object being acted on (WF8.006). Here there is no server, so this module is the
   single client-side mirror of that matrix — one place to read, one place to fix.
   --------------------------------------------------------------------------- */

import { state } from './store.js';

const ALL = '*';        // unconditional
const SCOPED = 'scoped'; // only farms the user has been granted

export const MATRIX = {
  //                        owner   supervisor
  'farm.view':            [ALL,    SCOPED],
  'farm.create':          [ALL,    null],
  'farm.edit':            [ALL,    SCOPED],
  'farm.delete':          [ALL,    null],
  'farm.transfer':        [ALL,    null],
  'farm.boundary.edit':   [ALL,    SCOPED],
  'plot.create':          [ALL,    SCOPED],
  'plot.delete':          [ALL,    null],
  'cropcycle.manage':     [ALL,    SCOPED],
  'analytics.view':       [ALL,    SCOPED],
  'advice.view':          [ALL,    SCOPED],
  'advice.acknowledge':   [ALL,    SCOPED],
  // Sending an advice to the supervisor is the owner's decision, and the
  // supervisor cannot send work to himself. It replaces task.assign.
  'advice.send':          [ALL,    null],
  'input.log':            [ALL,    SCOPED],
  'observation.create':   [ALL,    SCOPED],
  'tree.view':            [ALL,    SCOPED],
  'tree.override':        [ALL,    SCOPED],
  'report.view':          [ALL,    SCOPED],
  'report.export':        [ALL,    SCOPED],
  'member.invite':        [ALL,    null],   // WF8.003
  'member.remove':        [ALL,    null],
  'subscription.view':    [ALL,    null],
  'subscription.manage':  [ALL,    null],
  'auditlog.view':        [ALL,    null],
};

const ROLE_INDEX = { owner: 0, supervisor: 1 };

export const ROLE_LABEL = {
  owner: 'Farm Owner',
  supervisor: 'Farm Supervisor',
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
  return all.filter((f) => ['farm-1', 'farm-3'].includes(f.id));
}

/* -- tab bar composition, WF3.001 / WF3.005 --------------------------------

   FOUR TABS, NOT FIVE. Tasks has gone with task management, and the review that
   removed it asked what the freed slot should carry — the answer turned out to
   be nothing, because the same review merged the farm screen and the plot list
   into one. Home IS the plots now, so a Plots tab would have been a second door
   onto the screen the farmer is already standing on.

   Five was also called crowded on a 360 dp bar, and four is the number that
   fixes it. Everything the fifth tab used to reach — weather, reports,
   settings — is one row down in More. */

const TAB_HOME    = { id: 'home',   labelKey: 'nav.myfarm', icon: 'home' };
const TAB_MAP     = { id: 'map',    labelKey: 'nav.map',    icon: 'map' };
const TAB_ADVICE  = { id: 'advice', labelKey: 'nav.advice', icon: 'advice' };
const TAB_MORE    = { id: 'more',   labelKey: 'nav.more',   icon: 'more' };

export function tabsFor() {
  return [TAB_HOME, TAB_MAP, TAB_ADVICE, TAB_MORE];
}
