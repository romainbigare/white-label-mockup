/* ---------------------------------------------------------------------------
   capabilities.js — WF8.001/WF8.002.

   Permissions are a capability matrix. Each role is a column of named
   capabilities; adding a role is adding a column, not re-architecting.
   Screen code asks `can('advice.send', farm)` and never `role === 'supervisor'`.

   THREE ROLES, WAFRA'S FINAL ANSWER TO MMC (Oct 2026):

     owner        the farm is his and he pays for it. Everything.
     co-owner     sees and edits the farms shared with him, invites people and
                  sends advice on — and does not pay: no subscription, no new
                  farm (a farm is bought), no deleting or handing one over.
     supervisor   sees everything on the farms shared with him, and the one
                  thing he changes in the app is the shape of a field (C5).

   THERE IS NO WORKER ROLE. The men in a farm's workforce (B10) receive advice
   as a message with a link and hold no account; ROLE_LABEL names them, the
   matrix does not know them.

   READ-ONLY TAKES THE WRITES AWAY, FOR EVERYONE. A farm that is read-only —
   the trial ended unpaid, or a tree count raised the price and nobody
   confirmed it within 14 days (core/entitlements.js) — keeps every read below
   for every role and loses every write, which is how co-owners and
   supervisors keep their read-only access. Paying is the exception: it is
   how a farm stops being read-only.

   In the product every one of these is ALSO enforced server-side on the specific
   object being acted on (WF8.006). Here there is no server, so this module is the
   single client-side mirror of that matrix — one place to read, one place to fix.
   --------------------------------------------------------------------------- */

import { state } from './store.js';
import { farmReadOnly } from './entitlements.js';

const ALL = '*';        // unconditional
const SCOPED = 'scoped'; // only farms the user has been granted

/** The account roles, in the matrix's column order. */
export const ROLES = ['owner', 'co-owner', 'supervisor'];

export const MATRIX = {
  //                        owner   co-owner supervisor
  'farm.view':            [ALL,    SCOPED,  SCOPED],
  // Buying, deleting and handing over a farm are the payer's.
  'farm.create':          [ALL,    null,    null],
  'farm.edit':            [ALL,    SCOPED,  null],
  'farm.delete':          [ALL,    null,    null],
  'farm.transfer':        [ALL,    null,    null],
  // Redrawing a field (C5): the one thing a supervisor changes.
  'farm.boundary.edit':   [ALL,    SCOPED,  SCOPED],
  // Adding a field (B9) or removing one changes what is paid for.
  'plot.create':          [ALL,    SCOPED,  null],
  'plot.delete':          [ALL,    SCOPED,  null],
  'field.rename':         [ALL,    SCOPED,  null],
  'cropcycle.manage':     [ALL,    SCOPED,  null],
  'analytics.view':       [ALL,    SCOPED,  SCOPED],
  'advice.view':          [ALL,    SCOPED,  SCOPED],
  // Closing, ignoring or putting off an advice.
  'advice.acknowledge':   [ALL,    SCOPED,  null],
  // Sending an advice on to somebody on the team. It replaces task.assign.
  'advice.send':          [ALL,    SCOPED,  null],
  'tree.view':            [ALL,    SCOPED,  SCOPED],
  // B6's ⋯ menu: a tree's species and cultivar, and a correction for MMC.
  'tree.edit':            [ALL,    SCOPED,  null],
  'tree.report':          [ALL,    SCOPED,  null],
  'report.view':          [ALL,    SCOPED,  SCOPED],
  'report.export':        [ALL,    SCOPED,  SCOPED],
  'member.invite':        [ALL,    SCOPED,  null],   // WF8.003
  'member.remove':        [ALL,    SCOPED,  null],
  'subscription.view':    [ALL,    null,    null],
  'subscription.manage':  [ALL,    null,    null],
  'auditlog.view':        [ALL,    SCOPED,  SCOPED],
};

/* What a read-only farm still allows: looking, and paying. */
const STILL_OPEN = new Set([
  'farm.view', 'analytics.view', 'advice.view', 'tree.view', 'report.view', 'report.export',
  'auditlog.view', 'subscription.view', 'subscription.manage',
]);

export const ROLE_LABEL = {
  owner: 'Farm Owner',
  'co-owner': 'Co-owner',
  supervisor: 'Farm Supervisor',
  /* NOT A ROLE THE MATRIX KNOWS, and that is the point. The Monday review gave
     a farm an address book again (B10) — the men work is sent to — and none of
     them holds an account, so none of them is in ROLES above. The label exists
     because the workforce screen has to call them something. */
  worker: 'Farm worker',
};

/** The one question application code is allowed to ask. */
export function can(capability, farm = null, role = state.session.role) {
  const grant = MATRIX[capability]?.[ROLES.indexOf(role)];
  if (!grant) return false;
  if (!STILL_OPEN.has(capability) && farmReadOnly(farm)) return false;
  if (grant === SCOPED && farm) return farmsFor(role).some((f) => f.id === farm.id);
  return true;
}

/** How a grant is qualified, for the capability-matrix screen in the harness. */
export function grantFor(capability, role) {
  return MATRIX[capability]?.[ROLES.indexOf(role)] ?? null;
}

/** WF8.004 — access is granted per farm, not per account. */
export function farmsFor(role = state.session.role) {
  const all = state.db.farms;
  if (role === 'owner') return all;
  const ids = new Set((state.db.farmAccess ?? [])
    .filter((a) => a.accountId === state.session.userId && a.status === 'active')
    .map((a) => a.farmId));
  return all.filter((f) => ids.has(f.id));
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
