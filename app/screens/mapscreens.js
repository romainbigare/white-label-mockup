/* ---------------------------------------------------------------------------
   mapscreens.js — C1 Map, C2 Layers, C3 Plot sheet, C4 Compare, C5 Boundary editor.

   WF5.075 says layer selections persist between sessions, so the layer state is
   held on the session, not on the screen — switching tabs and coming back must
   not reset it.

   The plot sheet is a bottom sheet on the map rather than a screen of its own,
   but §3.2 gives it a code, so `plotSheetBody()` below is shared: overlays.js
   opens it as a real sheet on a tap, and C3 draws the map with it already up so
   the contact sheet has something to show.
   --------------------------------------------------------------------------- */

import { h, when } from '../core/dom.js';
import { state, commit, toast } from '../core/store.js';
import { local } from '../core/local.js';
import { t, tc } from '../core/i18n.js';
import { go, openSheet, openModal, back } from '../core/router.js';
import { icon } from '../ui/icons.js';
import {
  appBar, barAction, overflowAction, page, section, card, cardPad, row, btn, actionDock, statusChip,
  switchRow, disclaimer, req, select, divider, lockedRow,
  compareStage, compareSlider, compareLine, mapTool, deckMark,
} from '../ui/components.js';
import { num, date, area } from '../core/format.js';
import { visibleFarms, farmById, plotsOf, allVisiblePlots, measureByKey, measures, farmsForFilter, plotsForFilter, farmFilterLabel } from '../data/selectors.js';
import { has } from '../core/entitlements.js';
import { can } from '../core/capabilities.js';
import { mapSvg, legend, efficiencyLegend, rampCss } from '../ui/map.js';
import { boundaryCanvas, undoVertex, polygonAreaHa } from '../ui/boundaryEditor.js';
import { saveBoundary } from '../data/actions.js';
import { plotById, rawFarm } from '../data/selectors.js';
import { decidedAreas, setAreaGeometry, areaLabel } from '../data/survey.js';
import { measureScore, HEALTH_MEASURES } from '../core/health.js';

/* WF5.075 — layer selection is session state, restored on every visit.

   WHAT THIS SCREEN NO LONGER OFFERS, and why each one went, because "we could
   add it back" is a different conversation for every line:

     land use            not a farmer feature. It answers a planning question
                         about somebody else's land.
     zoning              a reference to another platform's data model.
     irrigation map      the description could not be made clear, and the thing
                         it was trying to show — which parts of a plot are wet
                         and which are dry — is the water stress map, which is
                         already a measure layer.
     terrain             see the basemap comment below.
     ADVANCED MAP LAYERS soil type and testing labs. Neither is something the
                         farmer draws on his own field to make a decision this
                         morning: a soil polygon is a regional survey at a scale
                         his plot disappears into, and a laboratory is a place to
                         drive to, not a layer on a map.
     VARIABLE RATE MAPS  sowing, nitrogen, phosphorus and potassium. A
                         prescription map is not read on a phone — it is a file
                         loaded into a spreader — so drawing it here was showing
                         the farmer a picture of something he cannot use from
                         this screen.

   What is left is what the map is for: which plots, what they are called, where
   the trees are, and one measure painted across them. */
function layers() {
  if (!state.session.layers) {
    state.session.layers = {
      basemap: 'satellite',
      boundaries: true, labels: true, trees: false,
      // 603 — off by default: it answers a question about the equipment, and
      // the map opens on the question about the crop.
      efficiency: false,
    };
  }
  return state.session.layers;
}

/* Two views, not three. A terrain map is a third answer to a question with two
   real ones — do I want the picture, or do I want the roads — and the farmer
   asking it is standing in a field, not choosing a cartographic style.

   Each carries a description, because "Satellite" and "Google Maps" do not on
   their own say which is sharper or which is newer, and that is the whole of
   the difference the farmer cares about.

   Review 06/09 rewrote both, and both rewrites do the same thing: they lead
   with the clarity and then concede the freshness, one clause each, so the two
   rows read as a trade rather than as a list of properties. "This is what we
   measure from" went with them — see the section heading in C2. */
const BASEMAPS = [
  {
    id: 'satellite',
    label: ['c2.basemap.satellite', 'Satellite view'],
    sub: ['c2.basemap.satellite.sub2', 'Lower image clarity, but satellite view is updated frequently.'],
  },
  {
    id: 'street',
    label: ['c2.basemap.street', 'Google Maps'],
    sub: ['c2.basemap.street.sub2', 'Greater image clarity with roads and place names, but land view is updated every few months.'],
  },
];

/* -- C1 · Map, WF5.071 … WF5.084 ------------------------------------------ */

export function C1() {
  const L = layers();
  const ui = local('c1', { zoom: 1 });
  const farmFilter = state.ui.farmFilter;
  const farms = visibleFarms();
  const scoped = farmsForFilter(farmFilter);
  const plots = farmFilter === 'all' ? allVisiblePlots() : plotsForFilter(farmFilter);
  const measureKey = state.ui.measure;
  const measure = measureByKey(measureKey);
  const farm = farmFilter === 'all' ? farms[0] : scoped[0];
  const dates = farm?.imageryDates ?? [];
  const dateIndex = Math.max(0, Math.min(dates.length - 1, dates.length - 1 - state.ui.dateIndex));
  const current = dates[dateIndex];
  const measureLocked = !has(measure.featureKey);

  /* THE HANDOVER FROM B2. The plot screen's third map button hands a plot to
     this tab rather than drawing a full-screen copy of it, which is what B7 and
     B8 used to be. Consumed once, on the way in: leaving it set would reopen
     the sheet every time the farmer came back to the map. */
  if (state.ui.mapPlot && !state.ui.preview) {
    const handover = state.ui.mapPlot;
    state.ui.mapPlot = null;
    const opening = state.ui.mapCompare;
    state.ui.mapCompare = false;
    setTimeout(() => (opening ? go('C4') : openSheet('C3', { plotId: handover })), 0);
  }

  // No app bar. The map is the screen: it starts directly under the device's
  // own status bar, and every control floats on it. The status strip keeps the
  // ordinary light chrome rather than going dark for this one screen — the
  // clock, the signal and the battery should look the same everywhere.
  //
  // SEARCH IS A TOOL, NOT A BAR. It was a full-width pill across the top for
  // several rounds, on the argument that finding something is the reason this
  // screen exists — and the top of the map is where the farmer's own farm is,
  // so the bar was covering the thing it helps him find. It is the first glyph
  // in the tool column now, at the top where a search control belongs, and the
  // top-left corner it vacated goes to the farm picker: which farm you are
  // looking at, in the corner, over the map it names.
  return {
    body: h('div', { style: { position: 'relative', height: '100%' } },
      h('div.mapbox', { style: { position: 'absolute', inset: 0 } },
        mapSvg({
          plots, measure: measureKey, basemap: L.basemap, layers: L, zoom: ui.zoom,
          dateKey: current?.date ?? '', gps: state.session.gpsGranted ? state.session.gps : null,
          onPlotTap: (plot) => openSheet('C3', { plotId: plot.id }),      // WF5.073
        })),

      // The left-hand column, at the top of the map now that the search bar has
      // gone: the farm picker in the corner, and the offline banner under it.
      h('div', {
        style: {
          position: 'absolute', insetInlineStart: '10px', top: '14px', maxWidth: '54%',
          display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '8px',
          zIndex: 3,
        },
      },
      // WF5.084 — All farms, plus each farm on its own.
      when(farms.length > 1, () => h('button.mapchip', {
        onclick: () => openSheet('FARM_PICKER', { onPick: (id) => { state.ui.farmFilter = id; commit('c1'); } }),
        ...deckMark({ deckNote: 'Switches which farm the map is showing' }),
      }, icon('home', 17),
         h('span', farmFilterLabel(farmFilter) ?? t('filter.allfarms', 'All farms')),
         icon('chevronDown', 15))),
      // WF5.080 — when offline the map shows cached tiles with a clear banner
      // naming the date of the imagery, which the shell's banner does not.
      when(state.session.connectivity === 'offline', () => h('div.banner.banner--cached', {
        style: { borderRadius: 'var(--radius-sm)' },
      }, icon('offline', 16),
         h('span', t('c1.cached', 'Saved map from {date}', { date: date(current?.date ?? '', { short: true }) }))))),

      // Bare glyphs — see mapTool(). Captioned, these pills took a third of the
      // width of the map they sit on.
      h('div.maptools', { style: { insetInlineEnd: '10px', top: '14px' } },
        // First in the column, because it is the one control that is not about
        // what the map is drawing but about where it is looking.
        mapTool('search', t('c1.search', 'Search a place, farm, plot or tree'),
          () => openSheet('MAP_SEARCH'),
          { deckNote: 'Finds a place, a farm, a plot or a tree' }),
        mapTool('layers', t('c2.title', 'Layers'), () => go('C2'), { deckTo: 'C2' }),
        has('maps.compare')
          ? mapTool('compare', t('b4.compare', 'Compare'), () => go('C4'), { deckTo: 'C4' })
          : mapTool('compare', t('b4.compare', 'Compare'), () => openModal('UPGRADE', { featureKey: 'maps.compare' }), { locked: true, deckNote: 'Locked below the plan that compares dates' }),
        // WF5.083 — finding a tree sits on the MAP, because that is where the
        // farmer is standing when he needs it.
        when(farm?.treeCount > 0, () => mapTool('tree', t('c1.findtree', 'Find a tree'),
          () => openSheet('TREE_FINDER', { farmId: farm.id }),
          { deckNote: 'Finds one tree and walks you to it' })),
        // WF5.077 — the user's own position, with a Locate me control.
        mapTool('locate', t('map.locate', 'Locate'), () => {
          if (!state.session.gpsGranted) { state.session.gpsGranted = true; commit('c1'); return; }
          toast(t('c1.centred', 'Centred on your position'));
        }),
        mapTool('plus', t('c1.zoomin', 'Zoom in'), () => { ui.zoom = Math.min(2, ui.zoom + 0.35); commit('c1'); }),
        mapTool('minus', t('c1.zoomout', 'Zoom out'), () => { ui.zoom = Math.max(0.5, ui.zoom - 0.35); commit('c1'); })),

      h('div', {
        style: {
          position: 'absolute', insetInline: '10px', bottom: '10px',
          background: 'var(--paper)', borderRadius: 'var(--radius)', padding: '10px 12px',
          display: 'flex', flexDirection: 'column', gap: '8px', boxShadow: 'var(--shadow-2)',
        },
      },
      // C263 — this is a MENU, and it did not look like one. It was a plain row
      // with a small chevron at the end, sitting on a white panel with no
      // border, so it read as a caption for the map above it and reviewers did
      // not discover that the whole measure list was behind it. It is now a
      // bordered control with the word "Showing" over it, which is the pattern
      // every other picker in the app uses.
      h('div', { style: { display: 'flex', alignItems: 'flex-end', gap: '4px' } },
        h('div', { style: { flex: 1, minWidth: 0 } },
          h('div', {
            style: { fontSize: 'var(--t-micro)', color: 'var(--ink-500)', fontWeight: 650, padding: '0 0 3px 2px' },
          }, t('c1.showing', 'Showing')),
          h('button.row', {
            onclick: () => openSheet('MEASURE_PICKER', { onPick: (key) => { state.ui.measure = key; commit('measure'); } }),
            style: {
              padding: '2px 10px', minHeight: 'var(--touch)', width: '100%',
              border: '1px solid var(--ink-300)', borderRadius: 'var(--radius-sm)',
              background: 'var(--paper)',
            },
          },
          h('div.row__main',
            h('div.row__title', t(`measure.${measure.key}`, measure.plain)),
            h('div.row__sub', tc(`measure.${measure.key}.unitnote`, measure.unitNote))),
          when(measureLocked, () => h('span.locked', icon('lock', 14), t('locked.short', 'Locked'))),
          h('span.row__chev', icon('chevronDown', 20)))),
        // WF5.082 / WF5.083 — what the measure means sits behind this button,
        // never as a paragraph laid over the map.
        h('button.iconbtn.iconbtn--bare', {
          onclick: () => openSheet('MEASURE_INFO', { key: measure.key }),
          'aria-label': t('c1.whatis', 'What does this mean?'),
          title: t('c1.whatis', 'What does this mean?'),
        }, icon('info', 20))),
      // Wraps rather than clips: at 360 dp the stepper's two 48 dp targets and
      // its date leave the legend about 140 dp, which cut "high" to "h".
      h('div', { style: { display: 'flex', alignItems: 'center', gap: '2px 6px', minWidth: 0, flexWrap: 'wrap' } },
        // The key follows the layer: with the irrigation map on, the gradient
        // under the map would be describing colours that are not on it.
        h('div', { style: { minWidth: 0 } }, L.efficiency ? efficiencyLegend() : legend(measureKey, null)),
        // WF5.078 — the stepper moves through available imagery dates.
        h('div', { style: { marginInlineStart: 'auto', display: 'flex', alignItems: 'center', gap: '2px' } },
          h('button.iconbtn', {
            onclick: () => { state.ui.dateIndex = Math.min(dates.length - 1, state.ui.dateIndex + 1); commit('c1'); },
            'aria-label': t('b4.prevdate', 'Previous image'),
          }, icon('back', 20, 'flip')),
          h('span', { style: { fontSize: 'var(--t-meta)', fontWeight: 650, minWidth: '74px', textAlign: 'center', whiteSpace: 'nowrap' } },
            date(current?.date ?? '', { short: true })),
          h('button.iconbtn', {
            onclick: () => { state.ui.dateIndex = Math.max(0, state.ui.dateIndex - 1); commit('c1'); },
            'aria-label': t('b4.nextdate', 'Next image'),
          }, icon('forward', 20, 'flip')))))),
  };
}

/* -- C2 · Layers, WF5.074 … WF5.076 --------------------------------------- */

export function C2() {
  const L = layers();
  const set = (key, value) => { L[key] = value; commit('layers'); };

  const layerRow = (key, label, featureKey) => {
    // WF5.076 — locked layers appear in the list with a lock and open the upgrade sheet.
    if (featureKey && !has(featureKey)) return lockedRow(featureKey, label);
    return switchRow(label, L[key], (v) => set(key, v));
  };

  return {
    top: appBar({ title: t('c2.title', 'Layers') }),
    body: page(
      /* Review 06/09 — "Change to: MAP OPTIONS. Daily farm monitoring results
         are displayed with both options." Two things at once. "Basemap" is a
         cartographer's word for the picture under the data, and a farmer
         choosing between two pictures does not need the trade name for the
         category. And the sentence under it settles the fear the old satellite
         description created: "this is what we measure from" reads as a warning
         that choosing the other one costs you the measurements. It does not. */
      section(t('c2.basemap', 'Map options'), {},
        card({}, BASEMAPS.map((b) => row({
          title: t(...b.label),
          sub: t(...b.sub),
          onclick: () => set('basemap', b.id),
          value: L.basemap === b.id ? icon('check', 20) : null,
          chevron: false,
        }))),
        h('p', { style: { margin: '6px 2px 0', fontSize: 'var(--t-meta)', color: 'var(--ink-500)' } },
          t('c2.basemap.both', 'Daily farm monitoring results are displayed with both options.'))),

      /* Review 06/09 — "MONITORING LAYER", and the index names out of the list
         with it: "each monitoring layer is generated from multiple indices /
         combinations of indices. We should remove 'NDVI', 'NDRE', etc."

         The acronyms were not shorthand, they were WRONG. A row reading "Plant
         health · NDVI" says the layer is that index; it is a model reading
         several bands at once, and the index it was named after is the one a
         farmer might go and look up, to find a definition that does not match
         what he is looking at. Singular in the heading, because he is choosing
         one of them. */
      section(t('c2.measures', 'Monitoring layer'), {},
        card({}, measures().map((m) => (has(m.featureKey)
          ? row({
              title: t(`measure.${m.key}`, m.plain),
              onclick: () => { state.ui.measure = m.key; commit('measure'); },
              value: state.ui.measure === m.key ? icon('check', 20) : null, chevron: false,
            })
          : lockedRow(m.featureKey, t(`measure.${m.key}`, m.plain)))))),

      section(t('c2.farmlayers', 'Farm layers'), {},
        card({}, h('div', { style: { padding: '4px 16px' } },
          layerRow('boundaries', t('c2.boundaries', 'Farm and plot boundaries')),
          layerRow('labels', t('c2.labels', 'Plot labels')),
          layerRow('trees', t('c2.trees', 'Tree points'), 'tree.mapping'),
          /* 603 — THE IRRIGATION MAP, AND IT IS A FARM LAYER RATHER THAN A
             MONITORING LAYER. The list above it is what the satellite read off
             the ground; efficiency is what the farmer's own system is doing
             with the water, which is a fact about the equipment rather than
             about the crop. Putting it among the measures would have implied
             the satellite measures it. */
          layerRow('efficiency', t('c2.efficiency', 'Irrigation efficiency'), 'irrigation.efficiency')))),

      /* THE TWO WATER LAYERS ARE NOT THE SAME LAYER, and a farmer who switches
         between them deserves to be told which question each answers. Water
         stress is the crop: where the plant is short. Irrigation efficiency is
         the system: how much of what you applied actually reached the roots.
         A plot can be poor on one and good on the other, which is exactly the
         case worth finding — a well-watered field losing half of it. */
      h('p', { style: { fontSize: 'var(--t-meta)', color: 'var(--ink-500)', margin: 0 } },
        t('c2.wateris2', 'Water stress shows where the crop is short of water. Irrigation efficiency shows how much of what you applied reached the roots — one is the plant, the other is the system.')),

      h('p', { style: { fontSize: 'var(--t-meta)', color: 'var(--ink-500)', margin: 0 } },
        t('c2.persist', 'Your layer choices are remembered between sessions.'), req('WF5.075'))),
  };
}

/* -- C4 · Compare dates on the map, WF5.079 ------------------------------ */

/* Review 06/09 — "the default should be 1 week", written against the pair of
   dates at the top of C4.

   It used to open six passes back, which is a count rather than an interval:
   the satellite comes over every two to thirteen days depending on the orbit
   and the cloud, so six passes was anywhere between a fortnight and two months.
   The screen opened on 9 July against 2 August — three and a half weeks — and
   nothing about a crop looks the same across three and a half weeks, so the
   comparison the farmer met first was always the least readable one.

   A WEEK IS AN INTERVAL, so it is measured in days and then resolved to the
   nearest pass at or before it: there may be no image exactly seven days ago,
   and the honest answer is the last one taken before that mark rather than a
   date with nothing behind it. */
const COMPARE_DAYS = 7;

function defaultLeft(dates) {
  if (dates.length < 2) return dates.length - 1;
  const newest = new Date(`${dates[dates.length - 1].date}T00:00:00Z`).getTime();
  const wanted = newest - COMPARE_DAYS * 86400000;
  for (let back = 1; back < dates.length; back += 1) {
    const at = new Date(`${dates[dates.length - 1 - back].date}T00:00:00Z`).getTime();
    if (at <= wanted) return back;
  }
  return dates.length - 1;               // never more than a week of imagery
}

export function C4() {
  const L = layers();
  const farms = visibleFarms();
  const farmFilter = state.ui.farmFilter;
  const farm = farmFilter === 'all' ? farms[0] : farmsForFilter(farmFilter)[0];
  const plots = farmFilter === 'all' ? allVisiblePlots() : plotsForFilter(farmFilter);
  const dates = farm.imageryDates;
  const ui = local('c4', { split: 50, left: defaultLeft(dates), right: 0 });
  const leftDate = dates[Math.max(0, dates.length - 1 - ui.left)];
  const rightDate = dates[dates.length - 1 - ui.right];
  const measureKey = state.ui.measure;

  return {
    top: appBar({ title: t('c4.title', 'Compare dates'), subtitle: farm.name }),
    // WF5.079 — a draggable divider with a different date either side.
    body: compareStage(ui.split, {},
      h('div.mapbox', { style: { position: 'absolute', inset: 0 } },
        mapSvg({
          plots, measure: measureKey, basemap: L.basemap, layers: L,
          dateKey: rightDate.date, compareMeasure: measureKey, comparePct: ui.split,
        })),
      compareLine(40),
      compareSlider({
        value: ui.split, min: 5, max: 95, label: t('b8.slider', 'Move the divider'),
        onRelease: (pct) => { ui.split = pct; commit('c4'); },
      }),
      h('span.mapchip', { style: { position: 'absolute', insetInlineStart: '12px', top: '12px' } }, date(leftDate.date, { short: true })),
      h('span.mapchip', { style: { position: 'absolute', insetInlineEnd: '12px', top: '12px' } }, date(rightDate.date, { short: true })),
      h('div', {
        style: {
          position: 'absolute', insetInline: '10px', bottom: '10px', background: 'var(--paper)',
          borderRadius: 'var(--radius)', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '8px',
          boxShadow: 'var(--shadow-2)',
        },
      },
      h('div', { style: { display: 'flex', gap: '8px', minWidth: 0 } },
        select(dates.map((dt, i) => ({ value: String(dates.length - 1 - i), label: date(dt.date, { short: true }) })).reverse(),
          String(ui.left), (v) => { ui.left = Number(v); commit('c4'); }, { style: { flex: '1 1 0', minWidth: 0 } }),
        select(dates.map((dt, i) => ({ value: String(dates.length - 1 - i), label: date(dt.date, { short: true }) })).reverse(),
          String(ui.right), (v) => { ui.right = Number(v); commit('c4'); }, { style: { flex: '1 1 0', minWidth: 0 } })),
      legend(measureKey))),
  };
}

/* -- C3 · Plot sheet, WF5.073 --------------------------------------------
   A bottom sheet on the map, so this screen entry draws the map with it up.
   The shared body below is what overlays.js opens on a tap.

   WF5.073 ends with "there is no create-task action here", which the review
   settled for good by deleting tasks: the only way work reaches anybody is by
   sending an advice, and that happens on D1. A button here would have put the
   farmer in front of an empty form having
   already forgotten what he tapped the plot to check. */

/* REBUILT AT REVIEW 21/09'S THIRD PASS. "It's a lot of numbers and details,
   restructure that so that it looks a little lighter, and a little more
   structured, and make things look a little better aligned."

   Three complaints, and the sheet had earned all three.

   LIGHTER. The status was stated THREE times — a triangle beside the name, a
   chip at the end of the same row, and a second chip on an "Overall health"
   line below — and the figure 27% appeared three times as well, because
   overallHealthScore() is the MINIMUM of the three indices and the selected
   measure was one of them. So a farmer read one fact written six ways and had
   to work out that it was one fact.

   Worse than repetition, the two statuses could DISAGREE. plot.status is the
   plot's authored state, which is what the map pin, the plot list and Home all
   show; healthStatus(overallHealthScore(plot)) is a derived one computed
   nowhere else in the app. On sixteen of the eighteen plots in the fixtures
   they differ — good against monitor, monitor against urgent — so the sheet was
   capable of labelling the same plot two ways in fifteen millimetres. One
   status now, and it is the app's: the chip in the header.

   STRUCTURED. Three zones instead of a pile: who this is (name, crop, status),
   what the map is currently showing about it (the selected measure, its trend,
   and the sentence that reads it), and the three health indices underneath.

   ALIGNED. The indices were chips in a wrapping flex row, so three of them at
   two different widths broke to two lines with a ragged edge. They are a
   three-column grid now: equal columns, labels on one baseline, numbers on
   another. Nothing is lost by dropping the composite line — it is the lowest of
   the three numbers in that grid, and the grid shows all three.

   AND THE INDICES ARE NAMED IN WORDS. They were "NDVI 27%", which is a term
   from a remote-sensing paper; content.json has carried a plain name for each
   one all along — plant health, water stress, nutrition status — and those are
   what a farmer can act on. */
export function plotSheetBody(plot, { onOpen }) {
  const measure = measureByKey(state.ui.measure);
  const m = plot.measures[measure.key] ?? { value: 0, delta: 0 };
  const delta = m.delta ?? 0;
  const pct = (score) => (score == null ? t('status.nodata', 'No data') : `${score}%`);

  return [
    h('div', { style: { display: 'flex', alignItems: 'flex-start', gap: '10px' } },
      h('div', { style: { flex: 1, minWidth: 0 } },
        h('div', { style: { fontWeight: 700, fontSize: 'var(--t-lead)' } }, plot.name),
        h('div', { style: { color: 'var(--ink-600)', fontSize: 'var(--t-meta)' } },
          `${plot.cropName}${plot.variety ? ` — ${plot.variety}` : ''} · ${area(plot.areaHa)}`)),
      // The one status on the sheet. The leading triangle came off with it: the
      // chip carries the same glyph and the word beside it, and the two of them
      // sat at opposite ends of a row saying the same thing.
      statusChip(plot.status)),

    card({}, cardPad(
      /* WHAT THE MAP IS PAINTED WITH, and how it has moved. The delta rides on
         the same line as the number rather than in a column of its own — it is
         a property of that number, and two columns made it look like a second
         reading. */
      h('div.metric',
        h('span.metric__label', t(`measure.${measure.key}`, measure.plain)),
        h('div', { style: { display: 'flex', alignItems: 'baseline', gap: '10px', flexWrap: 'wrap' } },
          h('span.num', pct(m.score ?? measureScore({ key: measure.key, ...m }))),
          h('span', {
            style: {
              fontSize: 'var(--t-meta)', fontWeight: 700,
              color: delta > 0 ? 'var(--st-good)' : delta < 0 ? 'var(--st-urgent)' : 'var(--ink-600)',
            },
          }, delta === 0
            ? t('delta.nochange', 'no change')
            : `${delta > 0 ? '↑' : '↓'} ${num(Math.abs(delta) * 100, 1)}%`),
          h('span', { style: { fontSize: 'var(--t-meta)', color: 'var(--ink-500)' } },
            t('b3.vs7', 'vs 7 days ago')))),

      h('div', { style: { color: 'var(--ink-700)' } }, plot.interpretation),

      /* THE THREE INDICES, IN ONE ALIGNED GRID. The rule above it is what makes
         them read as a second zone rather than as more of the sentence. */
      h('div', { style: { height: '1px', background: 'var(--ink-100)' } }),
      h('div.statgrid', HEALTH_MEASURES.map((key) => {
        const meta = measureByKey(key);
        const score = plot.measures?.[key]?.score ?? measureScore({ key, ...(plot.measures?.[key] ?? {}) });
        return h(`div.statgrid__cell${key === measure.key ? '.statgrid__cell--on' : ''}`,
          h('span.statgrid__label', t(`measure.${key}`, meta.plain)),
          h('span.num', pct(score)));
      })))),

    btn(t('c3.open', 'Open plot'), { variant: 'primary', onclick: onOpen }),
    req('WF5.073'),
  ];
}

export function C3(plotId) {
  const plot = plotById(plotId);
  const L = layers();
  return {
    body: h('div', { style: { position: 'relative', height: '100%' } },
      h('div.mapbox', { style: { position: 'absolute', inset: 0 } },
        mapSvg({ plots: plotsOf(plot.farmId), measure: state.ui.measure, basemap: L.basemap, layers: L, selectedId: plot.id })),
      h('div', {
        style: {
          position: 'absolute', insetInline: 0, bottom: 0,
          background: 'var(--paper)', borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0',
          padding: '10px 16px 18px', display: 'flex', flexDirection: 'column', gap: '12px',
          boxShadow: 'var(--shadow-2)',
        },
      },
      h('span', {
        style: {
          width: '36px', height: '4px', borderRadius: '2px', background: 'var(--ink-200)',
          alignSelf: 'center', marginBottom: '2px',
        },
      }),
      ...plotSheetBody(plot, { onOpen: () => go(`B2:${plot.id}`) }))),
  };
}

/* -- C5 · Boundary editor, WF5.090 … WF5.093 ------------------------------ */

export function C5(param) {
  // Two things get their outline edited with the same interaction (WF4.082):
  // a plot, and an area a survey found that is not a plot yet. They are
  // addressed differently — `plot-04` against `area=farm-6|farm-6-a1` — because
  // resolving an area id as a plot id does not fail, it silently returns the
  // first plot in the database and edits somebody else's field.
  const raw = String(param ?? '');
  const isArea = raw.startsWith('area=');
  const [areaFarmId, areaId] = isArea ? raw.slice(5).split('|') : [];
  const surveyFarm = isArea ? rawFarm(areaFarmId) : null;
  const target = isArea
    ? decidedAreas(surveyFarm).find((a) => a.id === areaId)
    : null;

  if (isArea && !target) {
    return {
      tabs: false,
      top: appBar({ title: t('c5.title', 'Edit boundary') }),
      body: page(disclaimer(t('c5.areagone', 'That area is no longer part of this survey.'), true)),
    };
  }

  const plot = isArea ? null : plotById(param);
  const farm = isArea ? farmById(areaFarmId) : farmById(plot.farmId);
  const label = isArea ? areaLabel(target) : plot.name;
  const ui = local(`c5-${isArea ? target.id : plot.id}`, {
    points: (isArea ? target.geometry : plot.geometry).map((p) => [...p]),
    selected: null,
  });

  // WF5.093 — boundary editing is not available offline.
  if (state.session.connectivity === 'offline') {
    return {
      top: appBar({ title: t('c5.title', 'Edit boundary'), subtitle: label }),
      body: page(disclaimer(t('offline.boundary', 'You need a connection to change a boundary. Everything else on this plot still works offline.'), true)),
    };
  }
  // WF5.093 — and it requires farm.boundary.edit.
  if (!can('farm.boundary.edit', farm)) {
    return {
      top: appBar({ title: t('c5.title', 'Edit boundary'), subtitle: label }),
      body: page(disclaimer(t('c5.nopermission', 'Only a farm owner or supervisor can change a boundary.'), true)),
    };
  }

  /* THE FRAME BOTH LAYERS SHARE. The farm's own square when it has one, which
     is also the square its photograph was taken of; the plain canvas otherwise.
     mapSvg takes the same box through `cover`, so the outline being dragged
     sits on the ground it belongs to rather than near it. */
  const frame = farm?.imagery?.fit ?? [0, 0, 1000, 1000];
  const editor = boundaryCanvas({
    points: ui.points, selected: ui.selected,
    frame,
    onChange: ({ selected }) => { ui.selected = selected; commit('c5'); },
  });

  return {
    tabs: false,
    top: appBar({
      title: t('c5.title', 'Edit boundary'), subtitle: label,
      actions: [
        barAction('undo', t('action.undo', 'Undo'), () => undoVertex(ui.points)),
        barAction('trash', t('c5.deletevertex', 'Delete point'), () => {
          if (ui.selected == null) return;
          ui.points.splice(ui.selected, 1); ui.selected = null; commit('c5');
        }, { disabled: ui.selected == null }),
        // The split/join/remove operations belong to plots; a survey area gets
        // the same five edits from A16 itself.
        ...(isArea ? [] : [overflowAction(() => openSheet('PLOT_SHAPE_MENU', { plotId: plot.id }))]),
      ],
    }),
    body: h('div', { style: { display: 'flex', flexDirection: 'column', height: '100%' } },
      h('div.mapbox', { style: { flex: '1 1 auto', position: 'relative', minHeight: '240px' } },
        // The farm's own photograph, named rather than inferred: this map
        // deliberately leaves OUT the plot being edited, and on a farm with one
        // plot that left it with nothing to read a farm from — which is how the
        // last screen in the app kept its invented ground.
        mapSvg({
          plots: isArea ? [] : plotsOf(farm.id).filter((p) => p.id !== plot.id),
          measure: 'ndvi', layers: { labels: false },
          imageryOf: farm?.id, cover: frame,
        }),
        editor.node),
      h('div', { style: { padding: '14px 16px', background: 'var(--paper)', display: 'flex', flexDirection: 'column', gap: '8px' } },
        // The requirement tags ride on the area line now: the paragraph that
        // carried them came off at the Monday review (below), and a tag with no
        // sentence under it still has to hang somewhere the harness can show it.
        h('div', h('span.num', area(editor.areaHa)), req('WF5.091', 'WF5.092')),
        when(editor.invalid, () => disclaimer(t('a8d.crossing', 'The boundary crosses itself. Move the highlighted corner so the edges do not overlap.'), true)),
        // WF5.091 — this screen is not only for redrawing. Splitting a plot,
        // joining two, removing one and adding one all live behind the ⋯ above,
        // and all of them are available on any farm at any time — not only at
        // the moment a survey is confirmed.
        when(!isArea, () => h('p', { style: { margin: 0, fontSize: 'var(--t-meta)', color: 'var(--ink-500)' } },
          t('c5.more', 'Split, join, remove or add a plot from the ⋯ menu.'))),
        // WF5.091 / WF5.092 are still true — a boundary change is a versioned
        // event and the old shape keeps its analytics — and the paragraph
        // saying so came off the screen at the Monday review. It explained the
        // data model to somebody in the middle of dragging a corner, which is
        // the one moment he is not asking about it. F11 is where the record of
        // the change is actually readable.
        )),
    dock: actionDock(btn(t('action.save', 'Save boundary'), {
      variant: 'primary', disabled: ui.points.length < 3 || editor.invalid,
      onclick: () => {
        if (isArea) {
          // WF4.082 / WF4.084 — the corrected outline changes the area, which
          // changes the totals A17 is about to be priced from.
          setAreaGeometry(surveyFarm, target.id, ui.points.map((p) => [...p]), editor.areaHa);
          toast(t('c5.areasaved', 'Outline saved'));
        } else {
          saveBoundary(plot, ui.points.map((p) => [...p]));
        }
        back();
      },
    })),
  };
}
