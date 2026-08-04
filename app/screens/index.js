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
  S('A1', 'Language picker', 'The first thing anyone sees. Choosing Arabic or Pashto turns the whole app round to read right to left, before you go any further.', ['WF-109', 'WF-110', 'WF-111', 'WF-112'], onboarding.A1),
  S('A2', 'Welcome', 'Three cards on what the app is for: seeing the farm from space, knowing what to do about it, and sending work to the people who will do it. You can step out at any point.', ['WF-113'], onboarding.A2),
  S('A3', 'Sign up — mobile number', 'Signing up begins with a phone number, and that number is the account — there is no email to remember. The code waits until the terms have been agreed to.', ['WF-114', 'WF-115', 'WF-116', 'WF-117'], onboarding.A3),
  S('A4', 'Verify code', 'Six digits arriving by text. It sends itself on the last one, and after five wrong tries the account rests for a quarter of an hour.', ['WF-118', 'WF-119', 'WF-120'], onboarding.A4),
  S('A5', 'Your details', 'A name to be called by and a password. An email address is useful for sending reports, but nobody is made to give one.', ['WF-121', 'WF-122', 'WF-123'], onboarding.A5),
  S('A6', 'How will you use the app?', 'A question about where to begin, not about what someone is allowed to do. Whether you end up an owner, a supervisor or a worker is settled later, by the farm you create or the invitation you accept.', ['WF-124', 'WF-125', 'WF-126'], onboarding.A6),
  S('A7', 'What do you grow?', 'Field crops, trees, or both. The answer shapes the rest of setting up, and which plans get offered at the end of it.', ['WF-130'], onboarding.A7),
  S('A8', 'Add your first farm', 'The moment an account becomes a farm. Only owners and supervisors arrive here — a worker joins land that already exists.', ['WF-131'], onboarding.A8),
  S('A8D', 'Draw your boundary', 'Tracing the edge of the land on satellite imagery, corner by corner. The area keeps up as you drag, in dunum with hectares alongside.', ['WF-132', 'WF-133', 'WF-134', 'WF-135', 'WF-136', 'WF-137', 'WF-138'], onboarding.A8D),
  S('A11', 'Farm details', 'What the farm is called and what grows on it. The rest — irrigation, soil — can wait, and “not sure” is a real answer rather than a way of avoiding the question.', ['WF-139', 'WF-140', 'WF-141', 'WF-148'], onboarding.A11),
  S('A12', 'Choose your plan', 'Prices in the local currency with dollars beside them, and only the plans that suit the farm that has just been drawn.', ['WF-142', 'WF-143', 'WF-144', 'WF-145', 'WF-146', 'WF-147'], onboarding.A12),
  S('A13', 'You’re ready', 'The pause between setting up and starting. It says when the first satellite pass will arrive, so nobody is left wondering why their farm looks empty.', ['WF-152', 'WF-101'], onboarding.A13),
  S('A14', 'Join a farm', 'For someone invited to a farm they do not own. The invitation itself decides whether they arrive as a supervisor or as a worker.', ['WF-153', 'WF-154', 'WF-155', 'WF-156', 'WF-157'], onboarding.A14),
  S('A15', 'Demo mode', 'A whole working farm to walk around before committing to anything. Nothing is kept, and the app says so on every screen rather than letting anyone forget.', ['WF-163', 'WF-164', 'WF-165', 'WF-166', 'WF-167', 'WF-168', 'WF-169'], onboarding.A15),
  S('LOGIN', 'Log in', 'Coming back. A code by text is the easy road; a password is there for anyone who would rather have one. The language can be changed from here too, in case the phone was handed over in the wrong one.', ['WF-158', 'WF-159', 'WF-160'], onboarding.LOGIN),
  S('FORGOT', 'Reset your password', 'A code by text, then a new password.', ['WF-158'], onboarding.FORGOT),

  /* -- Home --------------------------------------------------------------- */
  S('B1', 'Home / My farms', 'How many farms need attention this morning. A farm is judged by its worst plot rather than its average, so one failing corner is never hidden behind healthy neighbours.', ['WF-200', 'WF-201', 'WF-202', 'WF-203', 'WF-204', 'WF-205', 'WF-206'], home.B1),
  S('B2', 'Farm detail', 'One farm at a glance: how it is today, what moved this week, and what wants doing. Readings that are not part of the plan stay in view under a lock, so nobody has to guess what they are missing.', ['WF-207', 'WF-208', 'WF-209', 'WF-210', 'WF-211'], home.B2),
  S('B3', 'Fields and plots', 'Every plot on the farm, gathered into blocks on farms that are organised that way and shown as a plain list on farms that are not.', ['WF-212', 'WF-213', 'WF-214'], home.B3),
  S('B4', 'Plot detail', 'The heart of the app: what the satellite saw over one plot, and a sentence saying where the trouble is and how long it has been there — not only that something is wrong.', ['WF-215', 'WF-216', 'WF-217', 'WF-218', 'WF-219', 'WF-292'], plot.B4),
  S('B5', 'Crop cycles', 'What has been planted here, season by season. Closing a season keeps it rather than clearing it away, which is what makes one year comparable with the last.', ['WF-225', 'WF-226', 'WF-227'], plot.B5),
  S('B6', 'Add / edit crop cycle', 'Starting a new planting, or closing the one that is running. A season closes with a harvest date, and with a yield if anybody weighed it.', ['WF-225', 'WF-227', 'WF-228'], plot.B6),
  S('B7', 'Measure viewer', 'The plot filling the whole screen. The colours mean the same thing from one week to the next, so two dates can be trusted against each other.', ['WF-220', 'WF-221', 'WF-222'], plot.B7),
  S('B8', 'Compare', 'The same plot at two dates, with a divider to drag between them — and the difference written out underneath, for when the colours are too close to call.', ['WF-223', 'WF-224'], plot.B8),
  S('B9', 'Tree list', 'Where an orchard is counted rather than measured. It opens with how the trees are spread across the four states of health, keeping the missing and the dead apart from the merely struggling.', ['WF-238', 'WF-239', 'WF-240', 'WF-243'], trees.B9),
  S('B10', 'Tree detail', 'One tree. It begins with a map of where it stands and how far away you are, because finding tree 2841 among eight thousand is the hard part — then its kind, its age, its health and what has happened to it.', ['WF-241', 'WF-244', 'WF-304'], trees.B10),
  S('B11', 'Farm settings', 'Names, boundaries, and the two things nobody should do by accident: handing the farm to someone else, or getting rid of it.', ['WF-236', 'WF-237'], home.B11),
  S('B12', 'Add farm', 'Taking on more land. A farm of the other kind — trees when you already have crops — leads to one combined plan rather than a second bill.', ['WF-131', 'WF-149'], home.B12),
  S('B13', 'Harvest planning and yield', 'How much fruit is coming, how confident that figure is, how far along it is, and which plots to send the pickers to first.', ['WF-245', 'WF-246', 'WF-247', 'WF-248', 'WF-249', 'WF-250'], trees.B13),

  /* -- Map ---------------------------------------------------------------- */
  // No app bar: the map runs to the top edge and every control floats on it.
  // That drops WF-263's entry point — see "Deviations from the specification".
  S('C1', 'Map', 'The farm seen from above, filling the screen with nothing in the way. Plots are coloured by whichever reading is chosen, and labels step aside rather than pile on top of each other.', ['WF-253', 'WF-254', 'WF-255', 'WF-259', 'WF-260', 'WF-262'], maps.C1),
  S('C2', 'Layers', 'What to draw on the map. Layers outside the plan stay on the list behind a lock instead of quietly disappearing, so the map is honest about what it could show.', ['WF-256', 'WF-257', 'WF-258'], maps.C2),
  S('C4', 'Compare dates', 'The whole farm at two dates at once, split by a line you drag across it.', ['WF-261'], maps.C4),
  S('C5', 'Boundary editor', 'Correcting the shape of a plot after the fact. The old outline is kept, along with who changed it and when, so earlier readings still mean something.', ['WF-264', 'WF-265', 'WF-266'], maps.C5),

  /* -- Advice ------------------------------------------------------------- */
  S('D1', 'Advice inbox', 'What the farm needs, in the order it needs it. Each one says what to do, how much, and why — and can be turned into a job, or marked as already done, without opening it.', ['WF-267', 'WF-268', 'WF-269', 'WF-270', 'WF-271', 'WF-272', 'WF-273'], advice.D1),
  S('D2', 'Irrigation advice', 'How much water, said three ways at once — as depth, as volume, and as hours at the pump — because the farmer, the pump operator and the agronomist each think in a different one. Below that, everything the figure was worked out from.', ['WF-274', 'WF-275', 'WF-276', 'WF-277', 'WF-278'], advice.D2),
  S('D3', 'Nutrition advice', 'How much nitrogen, phosphate or potash the crop is short of, per hectare. It speaks in nutrients rather than brand names and leaves the choice of product to whoever is buying it.', ['WF-279', 'WF-280', 'WF-281'], advice.D3),
  S('D4', 'Crop protection advice', 'The active ingredient rather than a product name, and the date after which the crop is safe to pick. The reminder to read the label stays on the screen; it is not a notice you dismiss once.', ['WF-282', 'WF-283', 'WF-284', 'WF-285', 'WF-286', 'WF-287'], advice.D4),
  S('D5', 'Harvest advice', 'When to start picking and how long the window stays open. Orchards only.', ['WF-249', 'WF-251', 'WF-252'], advice.D5),
  S('D6', 'Weather alert', 'What is coming, when it arrives, and what it means for this farm in particular — rather than a forecast anyone could have looked up.', ['WF-288', 'WF-289'], advice.D6),
  S('D7', 'Record what you did', 'Writing down a job that has already been done. Three taps for the ordinary case, and it works standing in the field with no signal at all.', ['WF-290', 'WF-291', 'WF-292', 'WF-293'], advice.D7),

  /* -- Tasks -------------------------------------------------------------- */
  S('E1', 'Tasks / My Work', 'The day’s work. Anything overdue sits at the top and looks different from the rest, so it is hard to scroll past by mistake. A worker sees only what has been given to them.', ['WF-294', 'WF-295', 'WF-296', 'WF-297', 'WF-298', 'WF-299'], tasks.E1),
  S('E2', 'Task detail', 'What one job involves. A worker’s version is pared back to what, how much, where, when — and one large button.', ['WF-303', 'WF-304'], tasks.E2),
  S('E3', 'New task', 'Turning a recommendation into work for a particular person. Most of it is already written down; what is left is choosing who and by when.', ['WF-300', 'WF-301', 'WF-302'], tasks.E3),
  S('E4', 'Complete task', 'Marking a job finished — with a photo and a note if there is time for them, and without if there is not. It confirms on the spot, signal or no signal.', ['WF-305', 'WF-306', 'WF-307', 'WF-308'], tasks.E4),
  S('E6', 'Field observation', 'Something noticed while walking the field, whether or not anyone asked: a photograph, what it was, how bad it looked, and where it was standing.', ['WF-310', 'WF-311', 'WF-313'], tasks.E6),
  S('E7', 'Photo disease check', 'A photograph of a leaf and a guess at what is wrong with it — said with how sure that guess is, and with an easy way to say it is wrong.', ['WF-312', 'WF-624'], tasks.E7),

  /* -- More --------------------------------------------------------------- */
  S('F0', 'More', 'Everything that is not the day’s work. What appears depends on who is looking.', ['WF-314', 'WF-315'], more.F0),
  S('F1', 'Reports', 'The farm written up for a week, a season, or a bank. It comes back as a document, in whichever language was asked for.', ['WF-316', 'WF-317', 'WF-318', 'WF-319', 'WF-320', 'WF-321'], more.F1),
  S('F2', 'Team and access', 'Who can see this farm and what they are able to do on it. Each person shows the language they read the app in, which matters when you are about to send them work.', ['WF-322', 'WF-323', 'WF-327'], more.F2),
  S('F3', 'Invite someone', 'Getting a person onto the farm — by message, by code read aloud, or by holding two phones together. What they will be allowed to do is decided here, before they arrive.', ['WF-105', 'WF-106', 'WF-107', 'WF-108', 'WF-324', 'WF-325', 'WF-326'], more.F3),
  S('F4', 'Member detail', 'One person’s access, and how to end it. Work they have already finished stays credited to them.', ['WF-327'], more.F4),
  S('F5', 'Subscription', 'What is being paid for and when it renews. Buying happens in the phone’s own store rather than here.', ['WF-328', 'WF-329', 'WF-330', 'WF-331', 'WF-332', 'WF-711'], more.F5),
  S('F6', 'Compare plans', 'Everything each plan includes, for crops and for trees, laid out side by side.', ['WF-145', 'WF-701'], more.F6),
  S('F7', 'Settings', 'Shared phones, fingerprint locks, the legal documents, and closing the account for good.', ['WF-336', 'WF-337'], more.F7),
  S('F8', 'Language and region', 'Language, land area, water, numerals and calendar. Each one takes hold the moment it is changed, so the effect is visible rather than promised.', ['WF-333', 'WF-753', 'WF-756', 'WF-765', 'WF-766'], more.F8),
  S('F9', 'Notifications', 'Which messages arrive, by what means, and when to keep quiet. Anything to do with safety keeps coming through regardless.', ['WF-334', 'WF-654', 'WF-655', 'WF-657'], more.F9),
  S('F10', 'Data and storage', 'How much of the phone the app has taken up, whether to wait for Wi-Fi, and exactly what is still sitting there waiting to be sent.', ['WF-335', 'WF-781', 'WF-782', 'WF-787', 'WF-790'], more.F10),
  S('F11', 'Activity log', 'Who did what, when, and on which farm. Entries are added and never edited afterwards, which is the whole reason for keeping it.', ['WF-338', 'WF-339'], more.F11),
  S('F12', 'Help and user guide', 'Answers to the questions that come up most, and a glossary for the agronomy words the app uses without explaining.', ['WF-340', 'WF-759'], more.F12),
  S('F13', 'Contact Wafra', 'Two large buttons — call, or message — and a slower route for anything that needs a written record.', ['WF-341', 'WF-342', 'WF-343', 'WF-344', 'WF-345'], more.F13),
  S('F14', 'My profile', 'Name and email can be changed here. The phone number cannot: it is the account.', ['WF-121', 'WF-904'], more.F14),
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
