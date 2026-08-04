/* ---------------------------------------------------------------------------
   badges.js — WF-032 and WF-033.

   WF-032 is a rule about what NOT to badge: only Action needed and Urgent
   recommendations count. "Routine information is never badged." Keeping the
   filter here means no screen can quietly badge a Watch item.
   --------------------------------------------------------------------------- */

import { state } from '../core/store.js';
import { NOW } from '../core/format.js';
import { farmsFor } from '../core/capabilities.js';

export function unreadUrgentAdvice() {
  const scope = new Set(farmsFor().map((f) => f.id));
  return state.db.advice.filter((a) => (
    scope.has(a.farmId)
    && a.status === 'open'
    && (a.severity === 'urgent' || a.severity === 'action')   // WF-032
    && !state.db.seenAdvice.has(a.id)
  )).length;
}

export function myTasksDueOrOverdue() {
  const me = state.session.userId;
  const scope = new Set(farmsFor().map((f) => f.id));
  const endOfToday = Date.UTC(NOW.getUTCFullYear(), NOW.getUTCMonth(), NOW.getUTCDate(), 23, 59, 59);
  return state.db.tasks.filter((task) => (
    scope.has(task.farmId)
    && ['open', 'in_progress'].includes(task.state)
    && (state.session.role === 'worker' ? task.assigneeId === workerId() : true)
    && new Date(task.dueAt).getTime() <= endOfToday                 // WF-033
  )).length;
}

/** The harness role switch changes who "I" am; workers see a worker's queue. */
export function workerId() {
  return state.session.role === 'worker' ? 'user-3' : state.session.userId;
}

export function badges() {
  return {
    advice: unreadUrgentAdvice(),
    tasks: myTasksDueOrOverdue(),
  };
}
