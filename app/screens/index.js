/* ---------------------------------------------------------------------------
   index.js — the screen registry.

   Every screen in the App Map of §3.2, keyed by its specification identifier.
   The registry carries the title, a one-line note and the requirement IDs each
   screen implements, which is what feeds the reviewer caption panel and the
   "All screens" index in the harness. Keeping the mapping here means the App Map
   and the build cannot drift apart unnoticed.
   --------------------------------------------------------------------------- */

import * as onboarding from './onboarding.js';
import * as home from './home.js';
import * as plot from './plot.js';
import * as trees from './trees.js';
import * as maps from './mapscreens.js';
import * as advice from './advice.js';
import * as tasks from './tasks.js';
import * as more from './more.js';

const S = (id, title, note, reqs, render, route) => [id, { id, title, note, reqs, render, route }];

export const SCREENS = Object.fromEntries([
  /* -- First run ---------------------------------------------------------- */
  S('A1', 'Language picker', 'First launch only. Choosing a right-to-left language mirrors the layout before Continue is pressed.', ['WF-109', 'WF-110', 'WF-111', 'WF-112'], onboarding.A1),
  S('A2', 'Welcome', 'Three cards, skippable from any of them.', ['WF-113'], onboarding.A2),
  S('A3', 'Sign up — mobile number', 'Mobile number is the account. Send code stays disabled until the terms are ticked.', ['WF-114', 'WF-115', 'WF-116', 'WF-117'], onboarding.A3),
  S('A4', 'Verify code', 'Six digits, auto-submitting. Five wrong entries locks the account for 15 minutes.', ['WF-118', 'WF-119', 'WF-120'], onboarding.A4),
  S('A5', 'Your details', 'Name required, email optional, password at least 8 characters and not a common one.', ['WF-121', 'WF-122', 'WF-123'], onboarding.A5),
  S('A6', 'How will you use the app?', 'This routes; it does not assign privileges. The role comes later, from a farm.', ['WF-124', 'WF-125', 'WF-126'], onboarding.A6),
  S('A7', 'What do you grow?', 'Sets the default farm type and decides which plan family is offered at A12.', ['WF-130'], onboarding.A7),
  S('A8', 'Add your first farm', 'Owners and supervisors only — never reachable by a worker.', ['WF-131'], onboarding.A8),
  S('A8D', 'Draw your boundary', 'Tap to place corners, drag to move. Live area in dunum with hectares in brackets.', ['WF-132', 'WF-133', 'WF-134', 'WF-135', 'WF-136', 'WF-137', 'WF-138'], onboarding.A8D),
  S('A11', 'Farm details', 'Only name and type are mandatory. “Not sure” is a valid answer to irrigation.', ['WF-139', 'WF-140', 'WF-141', 'WF-148'], onboarding.A11),
  S('A12', 'Choose your plan', 'Shows only the family matching the farm just created. Local currency, USD alongside.', ['WF-142', 'WF-143', 'WF-144', 'WF-145', 'WF-146', 'WF-147'], onboarding.A12),
  S('A13', 'You’re ready', 'States when the first imagery will arrive, and one button to Home.', ['WF-152', 'WF-101'], onboarding.A13),
  S('A14', 'Join a farm', 'The role comes from the invitation. Used or expired codes say so and offer the owner.', ['WF-153', 'WF-154', 'WF-155', 'WF-156', 'WF-157'], onboarding.A14),
  S('A15', 'Demo mode', 'Opens the whole app against a fixture, everything unlocked, nothing saved.', ['WF-163', 'WF-164', 'WF-165', 'WF-166', 'WF-167', 'WF-168', 'WF-169'], onboarding.A15),
  S('LOGIN', 'Log in', 'SMS code is the prominent option; password is the alternative. Language control present.', ['WF-158', 'WF-159', 'WF-160'], onboarding.LOGIN),
  S('FORGOT', 'Reset your password', 'Recovery by SMS code.', ['WF-158'], onboarding.FORGOT),

  /* -- Home --------------------------------------------------------------- */
  S('B1', 'Home / My farms', 'The summary counts farms by their WORST plot, never by an average.', ['WF-200', 'WF-201', 'WF-202', 'WF-203', 'WF-204', 'WF-205', 'WF-206'], home.B1),
  S('B2', 'Farm detail', 'Health rows outside the plan are greyed and locked, never hidden.', ['WF-207', 'WF-208', 'WF-209', 'WF-210', 'WF-211'], home.B2),
  S('B3', 'Fields and plots', 'Grouped by block where blocks exist; the level disappears entirely where they do not.', ['WF-212', 'WF-213', 'WF-214'], home.B3),
  S('B4', 'Plot detail', 'The interpretation line names where and how long, not only what.', ['WF-215', 'WF-216', 'WF-217', 'WF-218', 'WF-219', 'WF-292'], plot.B4),
  S('B5', 'Crop cycles', 'A first-class record with its own history. Closing a cycle never deletes it.', ['WF-225', 'WF-226', 'WF-227'], plot.B5),
  S('B6', 'Add / edit crop cycle', 'An open cycle must be closed first, with a harvest date and optionally a yield.', ['WF-225', 'WF-227', 'WF-228'], plot.B6),
  S('B7', 'Measure viewer', 'Full screen, with a legend whose scale is fixed per measure so week-to-week comparison holds.', ['WF-220', 'WF-221', 'WF-222'], plot.B7),
  S('B8', 'Compare', 'Swipe divider between two dates, with the difference stated numerically.', ['WF-223', 'WF-224'], plot.B8),
  S('B9', 'Tree list', 'Leads with the distribution. Missing and dead trees keep their own count.', ['WF-238', 'WF-239', 'WF-240', 'WF-243'], trees.B9),
  S('B10', 'Tree detail', 'Where the tree stands, then its record: species, age, position, health, 12-month trend and history.', ['WF-241', 'WF-244', 'WF-304'], trees.B10),
  S('B11', 'Farm settings', 'Owner and supervisor only. Transfer and delete are owner-only and guarded.', ['WF-236', 'WF-237'], home.B11),
  S('B12', 'Add farm', 'Adding a farm of the other type offers an upgrade, never a second subscription.', ['WF-131', 'WF-149'], home.B12),
  S('B13', 'Harvest planning and yield', 'Yield with a confidence range, ripeness split, pick order, and one task per plot.', ['WF-245', 'WF-246', 'WF-247', 'WF-248', 'WF-249', 'WF-250'], trees.B13),

  /* -- Map ---------------------------------------------------------------- */
  S('C1', 'Map', 'Polygons filled by the selected measure, labels that hide rather than overlap.', ['WF-253', 'WF-254', 'WF-255', 'WF-259', 'WF-260', 'WF-262', 'WF-263'], maps.C1),
  S('C2', 'Layers', 'Locked layers stay in the list with a lock and open the upgrade sheet.', ['WF-256', 'WF-257', 'WF-258'], maps.C2),
  S('C4', 'Compare dates', 'A draggable divider with a different date either side.', ['WF-261'], maps.C4),
  S('C5', 'Boundary editor', 'Same interaction as A8. A change is a versioned event, and not available offline.', ['WF-264', 'WF-265', 'WF-266'], maps.C5),

  /* -- Advice ------------------------------------------------------------- */
  S('D1', 'Advice inbox', 'Grouped Today / This week / Later. Every card: what, how much, why — and two inline actions.', ['WF-267', 'WF-268', 'WF-269', 'WF-270', 'WF-271', 'WF-272', 'WF-273'], advice.D1),
  S('D2', 'Irrigation advice', 'The headline in three units at once, the split, and every input used.', ['WF-274', 'WF-275', 'WF-276', 'WF-277', 'WF-278'], advice.D2),
  S('D3', 'Nutrition advice', 'Elemental nutrient per hectare. Never leads with a product, never implies a fertigation schedule.', ['WF-279', 'WF-280', 'WF-281'], advice.D3),
  S('D4', 'Crop protection advice', 'Active ingredient first. Pre-harvest interval as a date, and a permanent label warning.', ['WF-282', 'WF-283', 'WF-284', 'WF-285', 'WF-286', 'WF-287'], advice.D4),
  S('D5', 'Harvest advice', 'Tree farms. The same card shape as every other recommendation.', ['WF-249', 'WF-251', 'WF-252'], advice.D5),
  S('D6', 'Weather alert', 'The threshold crossed, the window, and one line on what it means for the farm.', ['WF-288', 'WF-289'], advice.D6),
  S('D7', 'Record what you did', 'Three taps for the common case, and it works offline.', ['WF-290', 'WF-291', 'WF-292', 'WF-293'], advice.D7),

  /* -- Tasks -------------------------------------------------------------- */
  S('E1', 'Tasks / My Work', 'Overdue always first and always visually distinct.', ['WF-294', 'WF-295', 'WF-296', 'WF-297', 'WF-298', 'WF-299'], tasks.E1),
  S('E2', 'Task detail', 'The worker view is stripped to what, how much, where, when and one big button.', ['WF-303', 'WF-304'], tasks.E2),
  S('E3', 'New task', 'From a recommendation it arrives pre-filled; the supervisor adds an assignee and saves.', ['WF-300', 'WF-301', 'WF-302'], tasks.E3),
  S('E4', 'Complete task', 'Everything optional except the confirm tap. Works offline, confirms immediately.', ['WF-305', 'WF-306', 'WF-307', 'WF-308'], tasks.E4),
  S('E6', 'Field observation', 'Standalone scouting: photos, category, severity, note, automatic location.', ['WF-310', 'WF-311', 'WF-313'], tasks.E6),
  S('E7', 'Photo disease check', 'An identification with a confidence level that the user can reject.', ['WF-312', 'WF-624'], tasks.E7),

  /* -- More --------------------------------------------------------------- */
  S('F0', 'More', 'Menu contents filtered by role. Version and build always visible.', ['WF-314', 'WF-315'], more.F0),
  S('F1', 'Reports', 'Server-generated PDF, in the language asked for, with Wafra branding only.', ['WF-316', 'WF-317', 'WF-318', 'WF-319', 'WF-320', 'WF-321'], more.F1),
  S('F2', 'Team and access', 'Each member shows their role and their app language. Pending invites can be revoked.', ['WF-322', 'WF-323', 'WF-327'], more.F2),
  S('F3', 'Invite someone', 'One token, four delivery methods. Role chosen at creation and never blank.', ['WF-105', 'WF-106', 'WF-107', 'WF-108', 'WF-324', 'WF-325', 'WF-326'], more.F3),
  S('F4', 'Member detail', 'Removing someone is immediate; their completed work stays attributed to them.', ['WF-327'], more.F4),
  S('F5', 'Subscription', 'Crop and tree shown separately — except a Complete plan, which is never two line items.', ['WF-328', 'WF-329', 'WF-330', 'WF-331', 'WF-332', 'WF-711'], more.F5),
  S('F6', 'Compare plans', 'The full feature table for both families.', ['WF-145', 'WF-701'], more.F6),
  S('F7', 'Settings', 'Shared-device mode, biometrics, legal documents and account deletion.', ['WF-336', 'WF-337'], more.F7),
  S('F8', 'Language and region', 'Language, area, water, numerals and calendar — each taking effect immediately.', ['WF-333', 'WF-753', 'WF-756', 'WF-765', 'WF-766'], more.F8),
  S('F9', 'Notifications', 'Per-category channels and quiet hours. Safety-critical categories cannot be switched off.', ['WF-334', 'WF-654', 'WF-655', 'WF-657'], more.F9),
  S('F10', 'Data and storage', 'Cache size and cap, Wi-Fi preference, and exactly what has not uploaded.', ['WF-335', 'WF-781', 'WF-782', 'WF-787', 'WF-790'], more.F10),
  S('F11', 'Activity log', 'Owner only, append-only, filterable. Who, what, when and which farm.', ['WF-338', 'WF-339'], more.F11),
  S('F12', 'Help and user guide', 'Searchable articles plus the agronomic glossary, served from the backend.', ['WF-340', 'WF-759'], more.F12),
  S('F13', 'Contact Wafra', 'Exactly two large buttons plus a ticket route. Destinations are configuration.', ['WF-341', 'WF-342', 'WF-343', 'WF-344', 'WF-345'], more.F13),
  S('F14', 'My profile', 'Name and email editable; the mobile number is the account.', ['WF-121', 'WF-904'], more.F14),
]);

/* Grouping for the harness "All screens" index — mirrors §3.2. */
export const SCREEN_GROUPS = [
  { name: 'First run', ids: ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'A8D', 'A11', 'A12', 'A13', 'A14', 'A15', 'LOGIN', 'FORGOT'] },
  { name: 'Home', ids: ['B1', 'B2', 'B3', 'B11', 'B12'] },
  { name: 'Plots', ids: ['B4', 'B5', 'B6', 'B7', 'B8'] },
  { name: 'Trees', ids: ['B9', 'B10', 'B13'] },
  { name: 'Map', ids: ['C1', 'C2', 'C4', 'C5'] },
  { name: 'Advice', ids: ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7'] },
  { name: 'Tasks', ids: ['E1', 'E2', 'E3', 'E4', 'E6', 'E7'] },
  { name: 'More', ids: ['F0', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12', 'F13', 'F14'] },
];

/* Screens that need a parameter get a sensible default when jumped to directly
   from the index, so no entry in the list ever opens a broken screen. */
const DEFAULT_PARAMS = {
  B2: 'farm-1', B3: 'farm-1', B11: 'farm-1', B4: 'plot-04', B5: 'plot-04', B6: 'plot-04',
  B7: 'plot-04|ndwi', B8: 'plot-04', B9: 'farm-1', B10: 'T-2841', B13: 'farm-1',
  C5: 'plot-04', D2: 'adv-01', D3: null, D4: null, D5: null, D6: 'farm-1', D7: 'adv-01',
  E2: 'task-01', E3: '', E4: 'task-01', E6: '', E7: 'plot-04',
  F1: 'farm-1', F2: 'farm-1', F3: 'farm-1', F4: 'user-2', F11: 'all', F12: '',
};

for (const [id, param] of Object.entries(DEFAULT_PARAMS)) {
  if (SCREENS[id] && param != null) SCREENS[id].route = `${id}:${param}`;
}

/* D3/D4/D5 need an advice item of the right type; resolve them from the data. */
export function resolveDefaultRoutes(db) {
  const pick = (type) => db.advice.find((a) => a.type === type && a.status !== 'superseded');
  const map = { D3: 'nutrition', D4: 'protection', D5: 'harvest' };
  for (const [id, type] of Object.entries(map)) {
    const item = pick(type);
    if (item && SCREENS[id]) SCREENS[id].route = `${id}:${item.id}`;
  }
  const irrigation = pick('irrigation');
  if (irrigation) {
    SCREENS.D2.route = `D2:${irrigation.id}`;
    SCREENS.D7.route = `D7:${irrigation.id}`;
  }
}
