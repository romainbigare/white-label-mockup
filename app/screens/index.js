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
  S('A1', 'Language picker', 'The first thing anyone sees. Choose Arabic or Pashto and the whole app turns round to read right to left.', ['WF4.010', 'WF4.011', 'WF4.012', 'WF4.013'], onboarding.A1),
  S('A2', 'Welcome', 'Three cards on what the app is for. You can step out of them at any point.', ['WF4.014'], onboarding.A2),
  S('A3', 'Sign up — mobile number', 'A phone number is the account here; there is no email to remember. The code waits until the terms are agreed.', ['WF4.015', 'WF4.016', 'WF4.017', 'WF4.018'], onboarding.A3),
  S('A4', 'Verify code', 'Six digits by text. It sends itself on the last one, and five wrong tries rest the account for a quarter of an hour.', ['WF4.019', 'WF4.020', 'WF4.021'], onboarding.A4),
  S('A5', 'Your details', 'A name to be called by and a password. An email address helps with reports, but nobody is made to give one.', ['WF4.022', 'WF4.023', 'WF4.024'], onboarding.A5),
  S('A6', 'How will you use the app?', 'A question about where to begin. Whether you end up an owner, a supervisor or a worker is settled later, by the farm you make or the invitation you accept.', ['WF4.025', 'WF4.026', 'WF4.027'], onboarding.A6),
  S('A7', 'What do you grow?', 'Field crops, trees, or both. The answer shapes the rest of setting up, and which plans are offered at the end.', ['WF4.031'], onboarding.A7),
  S('A8', 'Add your first farm', 'The moment an account becomes a farm, and a fork. Draw the fields you want watched, or let us survey the whole place. Only owners and supervisors get here.', ['WF4.032', 'WF4.033', 'WF4.034', 'WF4.035'], onboarding.A8),
  S('A8D', 'Draw your boundary', 'Tracing the edge of the land on satellite imagery, corner by corner. The area keeps up as you drag.', ['WF4.036', 'WF4.037', 'WF4.038', 'WF4.039', 'WF4.040', 'WF4.041', 'WF4.042'], onboarding.A8D),
  S('A9', 'Survey my whole farm', 'One line around everything you own, buildings included. We work out what is inside it, which takes hours, so the farm is created straight away and you go back to work.', ['WF4.043', 'WF4.044', 'WF4.045', 'WF4.046', 'WF4.047', 'WF4.048'], onboarding.A9),
  S('A10', 'What we found', 'The survey read your land as open field, orchard and buildings. Keep what we should watch, leave out what we should not, and correct anything we misread.', ['WF4.049', 'WF4.050', 'WF4.051', 'WF4.052', 'WF4.053', 'WF4.054', 'WF4.055', 'WF4.056', 'WF4.057'], onboarding.A10),
  S('A11', 'Farm details', 'What the farm is called and what grows on it. Irrigation and soil can wait, and “not sure” is a real answer.', ['WF4.062', 'WF4.063', 'WF4.064', 'WF4.071'], onboarding.A11),
  S('A12', 'Choose your plan', 'Prices in the local currency with dollars beside them, and only the plans that suit the farm just drawn.', ['WF4.059', 'WF4.060', 'WF4.061', 'WF4.065', 'WF4.066', 'WF4.067', 'WF4.068', 'WF4.069', 'WF4.070'], onboarding.A12),
  S('A13', 'You’re ready', 'The pause between setting up and starting. It says when the first satellite pass arrives, so the empty farm makes sense.', ['WF4.075', 'WF4.002'], onboarding.A13),
  S('A14', 'Join a farm', 'For someone invited to a farm they do not own. The invitation decides whether they arrive as a supervisor or a worker.', ['WF4.076', 'WF4.077', 'WF4.078', 'WF4.079', 'WF4.080'], onboarding.A14),
  S('A15', 'Demo mode', 'A whole working farm to walk around before committing to anything. Nothing is kept, and every screen says so.', ['WF4.085', 'WF4.086', 'WF4.087', 'WF4.088', 'WF4.089', 'WF4.090', 'WF4.091'], onboarding.A15),
  S('LOGIN', 'Log in', 'Coming back. A code by text is the easy road; a password is there for anyone who prefers one. The language can be changed here too.', ['WF4.081', 'WF4.082', 'WF4.083'], onboarding.LOGIN),
  S('FORGOT', 'Reset your password', 'A code by text, then a new password.', ['WF4.081'], onboarding.FORGOT),

  /* -- Home --------------------------------------------------------------- */
  S('B1', 'Home / My farms', 'How many farms need attention this morning. A farm is judged by its worst plot, so one failing corner stays visible.', ['WF5.001', 'WF5.002', 'WF5.003', 'WF5.004', 'WF5.005', 'WF5.006', 'WF5.007', 'WF5.008', 'WF5.009'], home.B1),
  S('B2', 'Farm detail', 'One farm at a glance: how it is today, what moved this week, what wants doing. Readings outside the plan stay in view under a lock.', ['WF5.010', 'WF5.011', 'WF5.012', 'WF5.013', 'WF5.014'], home.B2),
  S('B3', 'Fields and plots', 'Every plot on the farm, gathered into blocks where the farm works that way and listed plainly where it does not.', ['WF5.015', 'WF5.016', 'WF5.017'], home.B3),
  S('B4', 'Plot detail', 'The heart of the app: what the satellite saw over one plot, and a sentence saying where the trouble is and how long it has been there.', ['WF5.018', 'WF5.019', 'WF5.020', 'WF5.021', 'WF5.022', 'WF5.101'], plot.B4),
  S('B5', 'Crop cycles', 'What has been planted here, season by season. Closing a season keeps it, which is what makes one year comparable with the last.', ['WF5.028', 'WF5.029', 'WF5.030'], plot.B5),
  S('B6', 'Add / edit crop cycle', 'Starting a new planting, or closing the one that is running. A season closes with a harvest date, and a yield if anyone weighed it.', ['WF5.028', 'WF5.030', 'WF5.031'], plot.B6),
  S('B7', 'Measure viewer', 'The plot filling the whole screen. The colours mean the same thing every week, so two dates can be trusted against each other.', ['WF5.023', 'WF5.024', 'WF5.025'], plot.B7),
  S('B8', 'Compare', 'The same plot at two dates, with a divider to drag between them. The difference is written out underneath as well.', ['WF5.026', 'WF5.027'], plot.B8),
  S('B9', 'Tree list', 'Where an orchard is counted. It opens with how the trees are spread across the four states of health, keeping the missing and the dead apart.', ['WF5.041', 'WF5.042', 'WF5.043', 'WF5.045'], trees.B9),
  S('B10', 'Tree detail', 'One tree. It begins with a map of where it stands and how far away you are, because finding tree 2841 among eight thousand is the hard part.', ['WF5.044', 'WF5.046', 'WF5.070'], trees.B10),
  S('B11', 'Farm settings', 'Names, boundaries, and the two things nobody should do by accident: handing the farm on, or getting rid of it.', ['WF5.039', 'WF5.040'], home.B11),
  S('B12', 'Add farm', 'Taking on more land. Trees alongside crops leads to one combined plan on one bill.', ['WF4.032', 'WF4.072'], home.B12),
  S('B13', 'Harvest planning and yield', 'How much fruit is coming, how confident that figure is, how ripe it is, and which plots to pick first.', ['WF5.047', 'WF5.048', 'WF5.049', 'WF5.050', 'WF5.051', 'WF5.052'], trees.B13),

  /* -- Map ---------------------------------------------------------------- */
  // No app bar: the map runs to the top edge and every control floats on it.
  // That drops WF5.069's entry point — see "Deviations from the specification".
  S('C1', 'Map', 'The farm from above, filling the screen. Plots are coloured by whichever reading is chosen, and labels step aside when they would collide.', ['WF5.059', 'WF5.060', 'WF5.061', 'WF5.065', 'WF5.066', 'WF5.068'], maps.C1),
  S('C2', 'Layers', 'What to draw on the map. Layers outside the plan stay on the list behind a lock, so the map is honest about what it could show.', ['WF5.062', 'WF5.063', 'WF5.064'], maps.C2),
  S('C4', 'Compare dates', 'The whole farm at two dates at once, split by a line you drag across it.', ['WF5.067'], maps.C4),
  S('C5', 'Boundary editor', 'Correcting the shape of a plot after the fact. The old outline is kept, with who changed it and when, so earlier readings still mean something.', ['WF5.073', 'WF5.074', 'WF5.075'], maps.C5),

  /* -- Advice ------------------------------------------------------------- */
  S('D1', 'Advice inbox', 'What the farm needs, in the order it needs it. Each one says what to do, how much, and why, and can become a job without being opened.', ['WF5.076', 'WF5.077', 'WF5.078', 'WF5.079', 'WF5.080', 'WF5.081', 'WF5.082'], advice.D1),
  S('D2', 'Irrigation advice', 'How much water, said as depth, as volume, and as hours at the pump, because everyone who acts on it thinks in a different unit.', ['WF5.083', 'WF5.084', 'WF5.085', 'WF5.086', 'WF5.087'], advice.D2),
  S('D3', 'Nutrition advice', 'How much nitrogen, phosphate or potash the crop is short of, per hectare. The choice of product is left to whoever buys it.', ['WF5.088', 'WF5.089', 'WF5.090'], advice.D3),
  S('D4', 'Crop protection advice', 'The active ingredient, and the date after which the crop is safe to pick. The reminder to read the label stays on the screen.', ['WF5.091', 'WF5.092', 'WF5.093', 'WF5.094', 'WF5.095', 'WF5.096'], advice.D4),
  S('D5', 'Harvest advice', 'When to start picking and how long the window stays open. Orchards only.', ['WF5.051', 'WF5.057', 'WF5.058'], advice.D5),
  S('D6', 'Weather alert', 'What is coming, when it arrives, and what it means for this farm in particular.', ['WF5.097', 'WF5.098'], advice.D6),
  S('D7', 'Record what you did', 'Writing down a job already done. Three taps for the ordinary case, and it works in the field with no signal.', ['WF5.099', 'WF5.100', 'WF5.101', 'WF5.102'], advice.D7),

  /* -- Tasks -------------------------------------------------------------- */
  S('E1', 'Tasks / My Work', 'The day’s work. Anything overdue sits at the top and looks different, so it is hard to scroll past. A worker sees only their own.', ['WF5.103', 'WF5.104', 'WF5.105', 'WF5.106', 'WF5.107', 'WF5.108'], tasks.E1),
  S('E2', 'Task detail', 'What one job involves. A worker’s version is pared back to what, how much, where, when, and one large button.', ['WF5.114', 'WF5.070'], tasks.E2),
  S('E3', 'New task', 'Turning a recommendation into work for a particular person. Most of it is already written down; what is left is who, and by when.', ['WF5.111', 'WF5.112', 'WF5.113'], tasks.E3),
  S('E4', 'Complete task', 'Marking a job finished, with a photo and a note if there is time for them. It confirms on the spot, signal or no signal.', ['WF5.115', 'WF5.116', 'WF5.117', 'WF5.118'], tasks.E4),
  S('E6', 'Field observation', 'Something noticed while walking the field: a photograph, what it was, how bad it looked, and where it was standing.', ['WF5.122', 'WF5.123', 'WF5.125'], tasks.E6),
  S('E7', 'Photo disease check', 'A photograph of a leaf and a guess at what is wrong with it, said with how sure the guess is and an easy way to disagree.', ['WF5.124', 'WF6.025'], tasks.E7),

  /* -- More --------------------------------------------------------------- */
  S('F0', 'More', 'Everything outside the day’s work. What appears depends on who is looking.', ['WF5.126', 'WF5.127'], more.F0),
  S('F1', 'Reports', 'The farm written up for a week, a season, or a bank. It comes back as a document in whichever language was asked for.', ['WF5.128', 'WF5.129', 'WF5.130', 'WF5.131', 'WF5.132', 'WF5.130'], more.F1),
  S('F2', 'Team and access', 'Who can see this farm and what they can do on it. Each person shows the language they read the app in, which matters when you send them work.', ['WF5.133', 'WF5.134', 'WF5.138'], more.F2),
  S('F3', 'Invite someone', 'Getting a person onto the farm: by message, by a code read aloud, or by holding two phones together. What they may do is decided here.', ['WF4.006', 'WF4.007', 'WF4.008', 'WF4.009', 'WF5.135', 'WF5.136', 'WF5.137'], more.F3),
  S('F4', 'Member detail', 'One person’s access, and how to end it. Work they have already finished stays credited to them.', ['WF5.138'], more.F4),
  S('F5', 'Subscription', 'What is being paid for and when it renews. Buying itself happens in the phone’s own store.', ['WF5.139', 'WF5.140', 'WF5.141', 'WF5.142', 'WF5.143', 'WF9.012'], more.F5),
  S('F6', 'Compare plans', 'Everything each plan includes, for crops and for trees, side by side.', ['WF4.068', 'WF9.002'], more.F6),
  S('F7', 'Settings', 'Shared phones, fingerprint locks, the legal documents, and closing the account for good.', ['WF5.147', 'WF5.148'], more.F7),
  S('F8', 'Language and region', 'Language, land area, water, numerals and calendar. Each one takes hold the moment it is changed.', ['WF5.144', 'WF10.004', 'WF10.007', 'WF10.016', 'WF10.017'], more.F8),
  S('F9', 'Notifications', 'Which messages arrive, by what means, and when to keep quiet. Anything about safety keeps coming through.', ['WF5.145', 'WF7.005', 'WF7.006', 'WF7.008'], more.F9),
  S('F10', 'Data and storage', 'How much of the phone the app has taken up, whether to wait for Wi-Fi, and what is still waiting to be sent.', ['WF5.146', 'WF11.002', 'WF11.003', 'WF11.008', 'WF11.011'], more.F10),
  S('F11', 'Activity log', 'Who did what, when, and on which farm. Entries are added and never edited afterwards, which is the point of it.', ['WF5.149', 'WF5.150'], more.F11),
  S('F12', 'Help and user guide', 'Answers to the questions that come up most, and a glossary for the agronomy words the app uses.', ['WF5.151', 'WF10.010'], more.F12),
  S('F13', 'Contact Wafra', 'Two large buttons, call or message, and a slower route for anything that needs a written record.', ['WF5.152', 'WF5.153', 'WF5.154', 'WF5.155', 'WF5.156'], more.F13),
  S('F14', 'My profile', 'Name and email can be changed here. The phone number stays: it is the account.', ['WF4.022', 'WF12.013'], more.F14),
]);

/* Grouping for the harness "All screens" index — mirrors §3.2. */
export const SCREEN_GROUPS = [
  { name: 'First run', ids: ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'A8D', 'A9', 'A10', 'A11', 'A12', 'A13', 'A14', 'A15', 'LOGIN', 'FORGOT'] },
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
  A10: 'farm-6', A12: 'farm-6',
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
