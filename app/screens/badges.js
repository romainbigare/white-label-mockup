/* ---------------------------------------------------------------------------
   badges.js — WF3.003.

   WF3.003 is a rule about what NOT to badge: only Action needed and Urgent
   recommendations count. "Routine information is never badged." Keeping the
   filter here means no screen can quietly badge a Watch item.

   There is one badge now. WF3.004 badged the task tab with work due today, and
   the review deleted both the tab and the concept — an advice that has gone out
   to the supervisor is being waited on, not queued, and the place that says so
   is the line on its card.
   --------------------------------------------------------------------------- */

import { state } from '../core/store.js';
import { farmsFor } from '../core/capabilities.js';

export function unreadUrgentAdvice() {
  const scope = new Set(farmsFor().map((f) => f.id));
  return state.db.advice.filter((a) => (
    scope.has(a.farmId)
    && a.status === 'open'
    && (a.severity === 'urgent' || a.severity === 'action')   // WF3.003
    && !state.db.seenAdvice.has(a.id)
  )).length;
}

export function badges() {
  return { advice: unreadUrgentAdvice() };
}
