/* ---------------------------------------------------------------------------
   guides.js — F13 the crop guide, F15 the pest and disease directory.

   TWO CATALOGUES THE APP HAS BEEN CARRYING WITHOUT EVER SHOWING ANYBODY. The
   fixtures hold 38 crops with a growing guide on each and 18 named problems
   with symptoms, conditions, treatment and a pre-harvest interval, and until
   the 13/09 catalogue review kept both items there was no screen anywhere that
   let a farmer read either one. The data was being consumed — the plot screen
   works out a fortnight of disease risk from the same 18 entries — but only
   ever as a score. B2's risk strip has been sending `F16:<id>` to a screen
   that did not exist: the doors were built before the rooms, which says more
   plainly than any requirement what these two screens are for.

   THEY SHIP TOGETHER BECAUSE THEY ARE ONE LIBRARY, NOT TWO. A crop page lists
   what goes wrong with that crop and every entry opens the problem; a problem
   page lists the crops it takes and every one opens the crop. That loop is the
   whole design. A farmer does not wake up wanting to read about powdery mildew;
   he wakes up looking at his cucumbers. A directory that can only be reached
   from a menu, by somebody who already knows the name of the thing he has not
   identified yet, is a library nobody opens.

   ONE FUNCTION PER DIRECTORY, LIST AND DETAIL. The id is the only difference
   between "which crop" and "this crop", and splitting that into two exports
   would mean two copies of the lookup, the not-found case and the cross-links.
   F14 and F16 are aliases so the printed review deck can hold a page for each
   state; they are the same screen, and every cross-link below routes through
   the D form so the deck's page numbers and the app's hash agree.

   WHAT THE SCREEN SAYS AND WHAT THE CATALOGUE SAYS ARE TRANSLATED DIFFERENTLY.
   Headings, labels and the sentences this file writes go through t() under the
   f16./f17. namespaces. The catalogue's own prose — a crop's growing note, a
   pest's symptoms — is authored content and goes through tc(), which is the
   same catalogue under the `c.` namespace and is how every other piece of
   fixture text in the app is localised. Crop names in particular reuse the key
   localise.js already gives them, so a crop reads the same word here as it does
   on the plot that grows it. The two localisers sit at the top of this file
   rather than in localise.js because this is their only consumer; the day
   anything else reads these two catalogues they belong beside lPlot().

   A handful of keys below are deliberately NOT f16./f17.: the crop categories,
   the crop search box, the pre-harvest label with the days under it, and the
   spray disclaimer all exist already, already say exactly these words, and are
   already translated into nine languages. A second key carrying the same
   English is not an improvement; it is one sentence drifting into two wordings,
   which is how a label and a legal warning end up disagreeing with themselves
   across two screens.
   --------------------------------------------------------------------------- */

import { h, when } from '../core/dom.js';
import { state, commit } from '../core/store.js';
import { local } from '../core/local.js';
import { t, tc } from '../core/i18n.js';
import { go, back, canGoBack } from '../core/router.js';
import { icon } from '../ui/icons.js';
import {
  appBar, page, section, card, cardPad, row, chips, field, input, kv,
  statusChip, emptyState, disclaimer,
} from '../ui/components.js';
import { num, depth } from '../core/format.js';
import { statusLabel, bySeverity } from '../core/status.js';
import { allVisiblePlots } from '../data/selectors.js';

/* -- the catalogue, in the reader's language ------------------------------ */

/* Crop names key on the English name rather than on the record id, because
   that is the key lPlot() and lAdvice() already use: `c.crop.Wheat` is filled
   in for nine languages, and keying this screen on `crop.wheat` instead would
   ask the translators for the same word twice and let the two answers differ. */
function lCrop(crop) {
  if (!crop) return crop;
  return {
    ...crop,
    name: tc(`crop.${crop.name}`, crop.name),
    guide: {
      ...crop.guide,
      note: tc(`crop.${crop.id}.note`, crop.guide.note),
      sow: cropWindow(crop, 'sow'),
      harvest: cropWindow(crop, 'harvest'),
      // "40 × 60 cm" is not prose, but its unit is written differently in most
      // of the app's languages — and "Broadcast or 20 cm rows" is prose.
      spacing: tc(`crop.${crop.id}.spacing`, crop.guide.spacing),
    },
  };
}

/* A sowing or harvest window is mostly two months — "Nov – Dec" — and those
   are dates rather than prose, so they are rebuilt from the month keys
   format.js uses: "Aug" is then the same word here as on every date in the
   app, translated once. Anything else — "Planted, not sown", "Cut every 28–35
   days" — is the agronomists' own sentence and goes through tc() by crop id. */
const MONTH_RANGE = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) – (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)$/;

function cropWindow(crop, field) {
  const text = crop.guide[field];
  const range = MONTH_RANGE.exec(text ?? '');
  if (!range) return tc(`crop.${crop.id}.${field}`, text);
  // The key monthName() in format.js reads; the record gives a name, not an index.
  const month = (m) => t(`month.${m.toLowerCase()}`, m);
  return `${month(range[1])} – ${month(range[2])}`;
}

function lDisease(entry) {
  if (!entry) return entry;
  return {
    ...entry,
    name: tc(`disease.${entry.id}.name`, entry.name),
    // The Latin binomial is NOT translated. It is Latin in every language, and
    // running it through the catalogue would invite somebody to transliterate
    // the one string on the page that exists precisely so that an agronomist in
    // Riyadh and a supplier in Amman can be sure they mean the same insect.
    symptoms: tc(`disease.${entry.id}.symptoms`, entry.symptoms),
    conditions: tc(`disease.${entry.id}.conditions`, entry.conditions),
    action: tc(`disease.${entry.id}.action`, entry.action),
    prevention: tc(`disease.${entry.id}.prevention`, entry.prevention),
  };
}

function cropById(id) {
  return lCrop(state.db.crops.find((c) => c.id === id));
}

function diseaseById(id) {
  return lDisease(state.db.diseases.find((d) => d.id === id));
}

/* The category names are the ones the crop picker already registered, and the
   English default has to match its call character for character: two English
   strings under one key is a collision the build reports, and the picker's
   wording — lower case, because the section rule upper-cases it — is fine. */
function categoryLabel(category) {
  return t(`crop.cat.${category}`, category.replace('-', ' '));
}

function kindLabel(kind) {
  return kind === 'pest'
    ? t('f17.kind.pest', 'Insect pest')
    : t('f17.kind.disease', 'Disease');
}

/* WHAT THE FARMER ACTUALLY GROWS, MARKED WHERE MARKING IT MEANS SOMETHING.

   Thirty-eight crops are a reference work and eleven of them are on this
   account's land, so the crop list says which — one pass over the plots turns a
   page of general agronomy into a shortlist. It is scoped through
   allVisiblePlots() rather than db.plots, so a supervisor is told about the
   farms he supervises and no others.

   THE PROBLEM LIST IS NOT MARKED THE SAME WAY, AND THE ARITHMETIC IS THE WHOLE
   ARGUMENT. Every one of the eighteen entries names at least one crop this
   account grows — mixed holdings of dates, cereals, forage and vegetables reach
   nearly the whole catalogue between them — so a "your crops" badge would be
   printed on eighteen rows out of eighteen. A signal that fires on everything
   distinguishes nothing; it just makes the list louder. The marker earns its
   place on a problem's OWN page instead, where it picks two crops out of nine
   and puts them at the top, and on the crop list, where it fires on eleven rows
   in thirty-eight. */
function plantedCropIds() {
  const ids = new Set();
  for (const plot of allVisiblePlots()) {
    if (plot.cropId) ids.add(plot.cropId);
    if (plot.secondaryCropId) ids.add(plot.secondaryCropId);
  }
  return ids;
}

/* Detail screens are reached from the list, from the sibling directory and from
   B2's risk strip, and in the review deck they are opened cold with no stack
   under them. So the arrow falls back to the directory rather than being drawn
   as a control that does nothing — the same shape F6 uses for its way out. */
function backTo(route) {
  return () => (canGoBack() ? back() : go(route));
}

/* -- F13 · Crop guide ------------------------------------------------------

   THE LIST IS GROUPED BY CATEGORY AND NOT ALSO FILTERED BY IT. The crop picker
   in the sheet carries category chips because a sheet is short and a farmer
   there is answering one question; this is a reference screen, and a heading
   and a chip row are two controls answering the same question, one of which
   also happens to be a map of what the catalogue holds. The order of the groups
   is the catalogue's own — field crops first, "other" last — rather than
   alphabetical, which would reshuffle itself in every language.

   SEARCH MATCHES THE CROP AND ITS VARIETIES, AND DELIBERATELY NOT THE PROBLEMS
   FILED UNDER IT. Typing "mildew" here could reasonably return nine crops, and
   every one of those rows would then be a row the farmer cannot explain: the
   word he typed appears nowhere on it. The problem directory is one tap below
   the list and has its own box, which is where a search for a symptom belongs.

   The query survives a trip into a crop and back, because the list it was
   narrowing is the list he is returning to. */

export function F13(cropId) {
  if (cropId) return cropPage(cropId);

  const ui = local('f16', { query: '' });
  const query = ui.query.trim().toLowerCase();
  const planted = plantedCropIds();

  const crops = state.db.crops.map(lCrop).filter((c) => !query
    || c.name.toLowerCase().includes(query)
    || c.varieties.some((v) => v.toLowerCase().includes(query)));
  const categories = [...new Set(state.db.crops.map((c) => c.category))]
    .filter((cat) => crops.some((c) => c.category === cat));

  return {
    top: appBar({
      title: t('f16.title', 'Crop guide'),
      subtitle: t('f16.sub', 'How we grow {n} crops in the Gulf', { n: num(state.db.crops.length) }),
    }),
    body: page(
      input({
        type: 'search', name: 'f16-search',
        placeholder: t('crop.search', 'Search crops and varieties'),
        value: ui.query,
        oninput: (e) => { ui.query = e.target.value; },
      }),

      crops.length
        ? categories.map((cat) => section(categoryLabel(cat), {},
          card({}, crops.filter((c) => c.category === cat).map((c) => row({
            iconName: c.isTree ? 'tree' : 'sprout',
            title: c.name,
            sub: c.varieties.slice(0, 3).join(', '),
            value: planted.has(c.id) ? t('f16.mine', 'You grow this') : null,
            onclick: () => go(`F14:${c.id}`),
          })))))
        : emptyState({
          iconName: 'search',
          title: t('f16.noresults', 'No crop matched “{q}”', { q: ui.query }),
          body: t('f16.noresults.body', 'Try the crop’s name on its own, or a variety.'),
        }),

      // The way across to the other half of the library sits at the END of this
      // screen rather than at the top of it. The designed route to a problem is
      // through the crop that has it, and a second search box above the first
      // one would compete with it for the farmer who came here to find his crop.
      card({}, row({
        iconName: 'warning',
        title: t('f17.title', 'Pests and diseases'),
        sub: t('f16.toproblems', 'Look one up by name, symptom or crop'),
        onclick: () => go('F15'),
      }))),
  };
}

/* THE CROP PAGE.

   It opens with the sentence the agronomists wrote about the crop and the two
   numbers that decide whether it can be grown on a given farm at all — how long
   the ground is committed, and how much water the season takes. Everything else
   is a date or a distance and belongs in the table under it.

   SEASON LENGTH MEANS TWO DIFFERENT THINGS AND IS THEREFORE LABELLED TWICE. For
   wheat, 150 days is the sowing-to-harvest commitment. For a date palm, 300 is
   the yearly cycle of a tree that will still be there in twenty years, and
   printing "season length" against it would tell a farmer something false about
   a perennial. Same field, same number, two honest labels. */
function cropPage(cropId) {
  const crop = cropById(cropId);
  if (!crop) return notFound(t('f16.title', 'Crop guide'), 'F13');

  const guide = crop.guide;
  const planted = plantedCropIds().has(crop.id);
  const problems = (guide.problems ?? [])
    .map(diseaseById)
    .filter(Boolean)
    .sort((a, b) => bySeverity(a, b, (x) => x.severity) || a.name.localeCompare(b.name));

  return {
    top: appBar({
      title: crop.name,
      subtitle: categoryLabel(crop.category),
      onBack: backTo('F13'),
    }),
    body: page(
      card({}, cardPad(
        when(planted, () => h('div', {
          style: {
            display: 'flex', alignItems: 'center', gap: '6px',
            color: 'var(--brand-700)', fontWeight: 650, fontSize: 'var(--t-meta)',
          },
        }, icon('check', 17), h('span', t('f16.mine', 'You grow this')))),
        when(guide.note, () => h('p', { style: { margin: 0, lineHeight: 1.55 } }, guide.note)),
        h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-4)' } },
          figure('calendar',
            crop.isTree ? t('f16.cycle', 'Yearly cycle') : t('f16.season', 'Season length'),
            t('f16.days', '{n} days', { n: num(guide.seasonDays) })),
          figure('droplet', t('f16.water', 'Water for the season'), depth(guide.waterMm))))),

      section(t('f16.howgrown', 'How it is grown'), {},
        card({}, cardPad(kv([
          [t('f16.sow', 'Sowing'), guide.sow],
          [t('f16.harvest', 'Harvest'), guide.harvest],
          [t('f16.spacing', 'Spacing'), guide.spacing],
          [t('f16.varieties', 'Varieties grown here'), crop.varieties.join(', ')],
        ])))),

      /* THE HALF OF THE PAGE THAT MAKES THIS A LIBRARY RATHER THAN A LEAFLET.
         Worst first, because that is the order every other list in this app puts
         trouble in, and each row carries the severity word beside its icon: a
         coloured dot on its own is never allowed to be the whole signal. */
      section(t('f16.problems', 'What goes wrong'), {},
        problems.length
          ? card({}, problems.map((d) => row({
            statusKey: d.severity,
            title: d.name,
            sub: `${statusLabel(d.severity)} · ${kindLabel(d.kind)}`,
            onclick: () => go(`F16:${d.id}`),
          })))
          // Eleven of the thirty-eight crops have nothing filed against them,
          // and the honest reading of that is that the catalogue has not got to
          // them — not that the crop is clean. Saying so, and leaving the door
          // to the full directory open, beats a section that quietly disappears
          // and leaves the farmer wondering whether he missed it.
          : [
            card({}, cardPad(h('p', { style: { margin: 0, color: 'var(--ink-600)' } },
              t('f16.noproblems', 'Nothing is filed against this crop yet. That is a gap in our catalogue, not a promise that the crop is trouble-free.')))),
            card({}, row({
              iconName: 'warning',
              title: t('f17.title', 'Pests and diseases'),
              sub: t('f16.toproblems', 'Look one up by name, symptom or crop'),
              onclick: () => go('F15'),
            })),
          ]),

      disclaimer(t('f16.regional', 'These figures are regional averages for the Gulf. What your own plot needs this week is on the plot itself, where the satellite and the weather have been taken into account.'))),
  };
}

/* One figure: a glyph, what it measures, and the number. Two of them sit side
   by side on a 360 dp screen and wrap to one column when the font scale is
   turned up, which is the only thing on either page wide enough to need it. */
function figure(iconName, label, value) {
  return h('div', {
    style: { flex: '1 1 140px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' },
  },
  h('div', {
    style: {
      display: 'flex', alignItems: 'center', gap: '6px',
      color: 'var(--ink-500)', fontSize: 'var(--t-meta)',
    },
  }, icon(iconName, 18), h('span', label)),
  h('div', { style: { fontSize: 'var(--t-num)', fontWeight: 700 } }, value));
}

/* -- F15 · Pests and diseases ---------------------------------------------

   IT IS NOT CALLED THE DISEASE DIRECTORY, because eight of the eighteen entries
   are insects. A farmer holding a leaf covered in whitefly should not have to
   decide what taxonomic bucket his problem is in before he can find the screen
   that names it.

   SEARCH READS THE SYMPTOMS AND THE CROP LIST, NOT JUST THE NAME. Somebody who
   knows the name has the least need of this screen; the farmer who needs it is
   the one who can describe what he is looking at — sticky leaves, white powder,
   a frond that went white from the tip — or who knows only which crop it is on.
   All three find the entry. The hint under the box says so, because a search
   box that quietly does more than it looks like it does helps nobody.

   SORTED WORST FIRST, BUT NOT GROUPED UNDER SEVERITY HEADINGS. Severity here is
   how bad it is IF YOU HAVE IT — a standing property of red palm weevil, true
   in a year when there is not a weevil within fifty kilometres. Two headings
   reading URGENT and MONITOR over a reference list would read as a report on
   this farm this morning, which is the advice inbox's job and not this one's. */

/* The chips are keyed under f17.filter rather than under f17.kind, which names
   one entry's kind a few lines above. They are plural here and singular there —
   "Insect pests" over a list of them, "Insect pest" on the one you are reading
   — and one key cannot carry two English strings without the build reporting it
   and one of the two screens silently showing the other's wording. */
const KINDS = [
  { id: 'all', label: 'All' },
  { id: 'disease', label: 'Diseases' },
  { id: 'pest', label: 'Insect pests' },
];

export function F15(diseaseId) {
  if (diseaseId) return diseasePage(diseaseId);

  const ui = local('f17', { query: '', kind: 'all' });
  const query = ui.query.trim().toLowerCase();
  const cropNameOf = (id) => cropById(id)?.name ?? id;

  const matches = (d) => !query
    || d.name.toLowerCase().includes(query)
    || (d.alsoKnown ?? '').toLowerCase().includes(query)
    || d.symptoms.toLowerCase().includes(query)
    || d.crops.some((id) => cropNameOf(id).toLowerCase().includes(query));

  const all = state.db.diseases.map(lDisease);
  // The chips count what they would show if pressed, which means counting
  // inside the search rather than over the whole catalogue: a chip reading
  // "Insect pests 8" above a search that has found two of them is telling the
  // farmer what the screen will do and then doing something else.
  const found = all.filter(matches);
  const list = found
    .filter((d) => ui.kind === 'all' || d.kind === ui.kind)
    .sort((a, b) => bySeverity(a, b, (x) => x.severity) || a.name.localeCompare(b.name));

  return {
    top: appBar({
      title: t('f17.title', 'Pests and diseases'),
      subtitle: t('f17.sub', '{n} problems we watch for', { n: num(all.length) }),
    }),
    body: page(
      field(null, input({
        type: 'search', name: 'f17-search',
        placeholder: t('f17.search', 'Search by name, symptom or crop'),
        value: ui.query,
        oninput: (e) => { ui.query = e.target.value; },
      }), { hint: t('f17.search.hint', 'Symptoms are searched too — try “honeydew” or “white powder”.') }),

      chips(KINDS.map((k) => ({
        id: k.id,
        label: t(`f17.filter.${k.id}`, k.label),
        count: k.id === 'all' ? found.length : found.filter((d) => d.kind === k.id).length,
      })), ui.kind, (id) => { ui.kind = id; commit('f17'); }),

      list.length
        ? card({}, list.map((d) => row({
          statusKey: d.severity,
          title: d.name,
          sub: `${statusLabel(d.severity)} · ${kindLabel(d.kind)}`,
          // The crops it takes are on its own page. Naming one or two of them
          // here would be the same guess the row cannot make: a problem with
          // nine crops under it has no "main" one, and the three that would fit
          // in a sub-line are the three that happen to be first in the record.
          onclick: () => go(`F16:${d.id}`),
        })))
        // A dead end says which of the two controls emptied the list. Searching
        // for a mildew with the insect chip pressed finds nothing and is not a
        // failed search, and "nothing matched" on its own would send the farmer
        // away to rephrase a query that was right the first time.
        : emptyState({
          iconName: 'search',
          title: t('f17.noresults', 'Nothing matched “{q}”', { q: ui.query }),
          body: ui.kind === 'all'
            ? t('f17.noresults.body', 'Try one word of what you can see — the colour, the marking, the part of the plant.')
            : t('f17.noresults.kind', 'Nothing of this kind matched. There may be one filed under the other.'),
          action: ui.kind === 'all' ? null : {
            label: t('f17.showall', 'Search every kind'),
            onclick: () => { ui.kind = 'all'; commit('f17'); },
          },
        }),

      card({}, row({
        iconName: 'leaf',
        title: t('f16.title', 'Crop guide'),
        sub: t('f17.tocrops', 'Sowing, harvest, spacing and water, crop by crop'),
        onclick: () => go('F13'),
      }))),
  };
}

/* THE PROBLEM PAGE, IN THE ORDER A FARMER ASKS THE QUESTIONS.

   Is this what I have? — the symptoms, first, with the severity and the Latin
   name that lets him check the answer against anybody else's. How long before I
   can harvest? — second, and above the treatment rather than below it, because
   the interval is the constraint on everything the treatment says: a farmer
   three days from picking needs to know that before he reads which product to
   buy, not after he has bought it. Then why it came, what to do, and how to
   keep it out. Last, the crops it takes, which is the way back into the guide.

   THE PHOTOGRAPHS ARE THE ONE THING A MOCKUP CANNOT SUPPLY. Identification is
   half of what a directory like this is for and it is done by eye, so the plate
   holds its place on the page as three empty frames rather than being quietly
   left out of the design and discovered missing later. They are inert: a
   photograph that cannot be opened is a placeholder, and a placeholder that can
   be tapped is a broken control. */
function diseasePage(diseaseId) {
  const entry = diseaseById(diseaseId);
  if (!entry) return notFound(t('f17.title', 'Pests and diseases'), 'F15');

  const planted = plantedCropIds();
  const crops = entry.crops
    .map(cropById)
    .filter(Boolean)
    // His own crops first: on root rot that is two rows out of nine, and they
    // are the two the page was opened for.
    .sort((a, b) => (planted.has(b.id) ? 1 : 0) - (planted.has(a.id) ? 1 : 0));

  return {
    top: appBar({
      title: entry.name,
      subtitle: entry.alsoKnown ?? kindLabel(entry.kind),
      onBack: backTo('F15'),
    }),
    body: page(
      card({ accent: entry.severity }, cardPad(
        h('div', { style: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--sp-3)' } },
          statusChip(entry.severity, { large: true }),
          h('span', { style: { color: 'var(--ink-600)' } }, kindLabel(entry.kind))),
        h('div', { style: { display: 'flex', gap: '8px', overflowX: 'auto' } },
          [0, 1, 2].map((i) => h('div', {
            style: {
              flex: '0 0 auto', width: '104px', height: '82px', borderRadius: 'var(--radius-sm)',
              background: `linear-gradient(${140 + i * 40}deg, var(--brand-200), var(--st-monitor-bg))`,
              display: 'grid', placeItems: 'center', color: 'var(--ink-600)',
            },
          }, icon('camera', 22)))),
        h('div', { style: { color: 'var(--ink-500)', fontSize: 'var(--t-meta)', fontWeight: 650 } },
          t('f17.symptoms', 'What it looks like')),
        h('p', { style: { margin: 0, lineHeight: 1.55 } }, entry.symptoms))),

      phiCard(entry),

      prose(t('f17.conditions', 'When it shows up'), entry.conditions),
      prose(t('f17.action', 'What to do'), entry.action, entry.severity),
      prose(t('f17.prevention', 'Keeping it out'), entry.prevention),

      section(t('f17.crops', 'Crops it takes'), {},
        card({}, crops.map((c) => row({
          iconName: c.isTree ? 'tree' : 'sprout',
          title: c.name,
          sub: categoryLabel(c.category),
          value: planted.has(c.id) ? t('f16.mine', 'You grow this') : null,
          onclick: () => go(`F14:${c.id}`),
        })))),

      // The same warning D4 carries under the same key. A spray instruction and
      // a spray instruction in a reference book are the same liability, and two
      // wordings of one legal sentence is how the two of them drift apart.
      disclaimer(t('d4.label', 'Check the product label and your local regulations before applying. This is advice, not a prescription.'), true)),
  };
}

/* THE PRE-HARVEST INTERVAL, WHICH IS THE COMMERCIAL FACT ON THIS PAGE.

   Spraying inside it does not hurt the crop; it puts residue in the load, and
   the load is rejected at the packhouse or, for an export consignment, at the
   border. The damage is total and it happens after the harvest, which is the
   worst possible moment to learn the number. So it is the second thing on the
   page, it is stated in days at heading size, and the sentence under it says
   what the number costs rather than what it is.

   ZERO IS NOT A SHORT INTERVAL, AND IS NOT DRAWN AS ONE. Both entries with a
   zero in this catalogue — bayoud and fusarium wilt — are soil-borne things
   with no chemical answer at all, and their treatment is to pull the plant and
   stop the water moving. "0 days" would read as permission to spray up to the
   morning of picking, which is the opposite of what the record means. */
function phiCard(entry) {
  const sprayed = entry.phiDays > 0;
  return card({ accent: sprayed ? 'monitor' : 'nodata' }, cardPad(
    h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
      icon('calendar', 20),
      h('span', { style: { fontWeight: 700 } }, t('d4.phi', 'Pre-harvest interval'))),
    h('div', { style: { fontSize: 'var(--t-head)', fontWeight: 750, lineHeight: 1.2 } },
      sprayed
        ? t('d4.phidays', '{n} days', { n: num(entry.phiDays) })
        : t('f17.phi.none', 'No interval')),
    h('p', { style: { margin: 0, lineHeight: 1.55 } },
      sprayed
        ? t('f17.phi.means', 'Leave at least {n} days between the last spray and picking. Harvest sooner and the residue is over the limit — the load is rejected at the packhouse, and the crop is lost after you have already grown it.', { n: num(entry.phiDays) })
        : t('f17.phi.none.means', 'There is no spray for this one, so there is no waiting period to keep. What to do below is cultural work, not chemistry.'))));
}

/* One block of the catalogue's prose under its own heading. Four of these make
   up most of a problem page, and they are one helper rather than four copies so
   that changing how a paragraph is set changes all of them. */
function prose(title, body, accent = null) {
  return section(title, {},
    card(accent ? { accent } : {}, cardPad(
      h('p', { style: { margin: 0, lineHeight: 1.55 } }, body))));
}

/* A bad id reaches these screens the same way it reaches the advice detail: an
   old link, a deck route typed by hand, a risk row pointing at an entry that
   has since left the catalogue. Say so, and hand over the door to the list
   rather than leaving the reader on an empty page. */
function notFound(title, route) {
  return {
    top: appBar({ title, onBack: backTo(route) }),
    body: emptyState({
      iconName: 'info',
      title: t('f16.gone', 'This entry is no longer in the guide'),
      body: t('f16.gone.body', 'It may have been renamed or merged into another one. The full list is still here.'),
      action: { label: title, onclick: () => go(route) },
    }),
  };
}

/* The deck prints a page per screen code, and a screen whose whole second half
   only appears when it is given an id would otherwise be reviewed as a list and
   nothing else. Same function, second registration. */
export const F14 = F13;
export const F16 = F15;
