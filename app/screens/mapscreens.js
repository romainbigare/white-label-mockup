/* ---------------------------------------------------------------------------
   mapscreens.js — C1 Map, C2 Layers, C4 Compare, C5 Boundary editor.

   WF5.075 says layer selections persist between sessions, so the layer state is
   held on the session, not on the screen — switching tabs and coming back must
   not reset it.

   NO PLOT SHEET SINCE v1.7.3. C3 was a bottom sheet raised by a tap on a
   plot, with the plot's metrics in it and a button to open the plot. The
   review after the October meeting took it out: a tap on a plot opens the
   plot, and its metrics are on that page. The code C3 is not reused.
   --------------------------------------------------------------------------- */

import { h, when } from '../core/dom.js';
import { state, commit, toast } from '../core/store.js';
import { local } from '../core/local.js';
import { t, tc } from '../core/i18n.js';
import { go, openSheet, openModal, back, canGoBack } from '../core/router.js';
import { icon } from '../ui/icons.js';
import {
  appBar, barAction, overflowAction, page, section, card, row, btn, actionDock,
  switchRow, disclaimer, req, select, divider, lockedRow,
  compareStage, compareSlider, compareLine, mapTool, deckMark,
} from '../ui/components.js';
import { num, date, area } from '../core/format.js';
import { visibleFarms, farmById, plotsOf, allVisiblePlots, measureByKey, measures, farmsForFilter, plotsForFilter, farmFilterLabel, currentFarm } from '../data/selectors.js';
import { has } from '../core/entitlements.js';
import { can } from '../core/capabilities.js';
import { mapSvg } from '../ui/map.js';
import { metricPicker, metricInfo, metricLegend } from '../ui/metric.js';
import { liveMap, liveMapAvailable, liveMapControls } from '../ui/livemap.js';
import { boundaryCanvas, undoVertex, polygonAreaHa } from '../ui/boundaryEditor.js';
import { saveBoundary } from '../data/actions.js';
import { plotById } from '../data/selectors.js';

/* WF5.075 — layer selection is session state, restored on every visit.

   WHAT THIS SCREEN NO LONGER OFFERS, and why each one went, because "we could
   add it back" is a different conversation for every line:

     land use            not a farmer feature. It answers a planning question
                         about somebody else's land.
     zoning              a reference to another platform's data model.
     irrigation map      removed twice. The second time, v1.7.2, as irrigation
                         efficiency: a fact about the equipment, read on the
                         plot's irrigation schedule (B12) rather than painted
                         on the farm.
     monitoring layers   the list of metrics, v1.7.2. The map's own picker
                         chooses the metric, and two places to choose it was
                         one too many.
     plot labels         v1.7.2: names and crops are always on the map now.
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

   What is left is what the map is for: which picture, the plot outlines, and
   where the trees are. */
function layers() {
  if (!state.session.layers) {
    state.session.layers = { basemap: 'satellite', boundaries: true, trees: true };
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

/* -- C1 · Map, WF5.071 … WF5.084 ------------------------------------------

   TWO WAYS IN, SINCE v1.7.2. The Map tab is the root of its own stack and has
   no way back. The other way in is a map opened FROM a screen — B1's, B2's and
   B5's expand buttons — and that one is pushed onto the stack the farmer is
   already on, so it carries a back button and returns him where he was: "when
   navigating to this page from another screen, add a back button".

   The route names what it was opened for: `C1:plot-22` is the map fitted to
   that plot and with that plot picked out; `C1:farm-3` is the farm. It used to
   hand the plot over by switching tab and raising the plot sheet over it —
   which the review asked to stop: "avoid showing this by default when we're
   clicking on 'expand map' in screen B2". The farmer came for the map, and the
   sheet is one tap on the plot away. */

export function C1(param) {
  const L = layers();
  const pushed = canGoBack();
  const focus = param ? state.db.plots.find((p) => p.id === param) ?? null : null;
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
  const measureLocked = !has(measure.featureKey, farm);
  // One live map for the tab and one for a pushed map: each remembers where it
  // was looking, and the tab's view should not jump because a plot was opened.
  const mapKey = pushed ? 'C1-pushed' : 'C1';

  /* THE PANEL, floating over the bottom of the map: the metric, its legend and
     the imagery date. Built first because the live map measures it.

     "MAKE THE DROPDOWN MORE OBVIOUS" — v1.7.2. It was a bordered row under the
     word "Showing", and it still read as a caption. It is the shared picker now
     (ui/metric.js): a title that says what it is for, "Pick a metric", over a
     button that names the metric — and the legend under it names every colour,
     in the metric's own words. */
  const panel = h('div.c1panel',
    h('div.c1panel__row',
      metricPicker(measureKey, { onPick: () => commit('measure') }),
      when(measureLocked, () => h('span.locked', icon('lock', 14), t('locked.short', 'Locked'))),
      metricInfo(measureKey)),
    metricLegend(measureKey),
    // WF5.078 — the stepper moves through available imagery dates.
    h('div.c1panel__dates',
      h('span', t('c1.imagedate', 'Image date')),
      h('div.c1panel__stepper',
        h('button.iconbtn', {
          onclick: () => { state.ui.dateIndex = Math.min(dates.length - 1, state.ui.dateIndex + 1); commit('c1'); },
          'aria-label': t('b4.prevdate', 'Previous image'),
        }, icon('back', 20, 'flip')),
        h('b', date(current?.date ?? '', { short: true })),
        h('button.iconbtn', {
          onclick: () => { state.ui.dateIndex = Math.max(0, state.ui.dateIndex - 1); commit('c1'); },
          'aria-label': t('b4.nextdate', 'Next image'),
        }, icon('forward', 20, 'flip')))));

  /* LIVE ON A DEVICE, A PICTURE IN A PREVIEW. The live map (ui/livemap.js) is
     real Esri tiles that pan, pinch and stream, with this screen's plots drawn
     over them; the picture is the same plots on the vendored photograph. Same
     drawing either way: both are mapSvg. */
  const live = liveMapAvailable();
  const mapOpts = {
    plots, measure: measureKey, basemap: L.basemap, layers: L,
    dateKey: current?.date ?? '', gps: state.session.gpsGranted ? state.session.gps : null,
    selectedId: focus?.id ?? null,
    // WF5.073 — a tap on a plot opens it, on this stack, with a way back.
    // A tree field still being counted has nothing to open yet, and says so.
    onPlotTap: (plot) => (plot.counting
      ? toast(t('count.notyet', 'We are still counting the trees in {plot}', { plot: plot.shortName }))
      : go(`${plot.kind === 'trees' ? 'B5' : 'B2'}:${plot.id}`)),
  };

  // No app bar. The map is the screen: it starts directly under the device's
  // own status bar, and every control floats on it.
  //
  // SEARCH IS A TOOL, NOT A BAR — the top of the map is where the farmer's own
  // farm is. The top-left corner holds the way back, when there is one, and
  // the farm picker.
  return {
    body: h('div', { style: { position: 'relative', height: '100%' } },
      h('div.mapbox', { style: { position: 'absolute', inset: 0 } },
        live
          ? liveMap(mapKey, {
            ...mapOpts,
            // A new farm choice fits the map to the farms; a map opened for one
            // plot fits that plot, with the fields round it.
            fitKey: focus ? `plot:${focus.id}` : farmFilter,
            focus,
            insets: () => ({ top: 64, bottom: panel.offsetHeight + 10 }),
          })
          : mapSvg(mapOpts)),

      h('div.c1corner',
        when(pushed, () => h('button.mapchip.mapchip--square', {
          type: 'button', onclick: back,
          'aria-label': t('a11y.back', 'Back'), title: t('a11y.back', 'Back'),
          ...deckMark({ deckNote: 'Back to the screen the map was opened from' }),
        }, icon('back', 22, 'flip'))),
        h('div.c1corner__stack',
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
             h('span', t('c1.cached', 'Saved map from {date}', { date: date(current?.date ?? '', { short: true }) })))))),

      /* FOUR TOOLS. v1.7.2 took three off the column: the zoom buttons, which a
         phone map is pinched rather than pressed, and "find a tree", which the
         tree group's own screen does better — it opens on the trees. */
      h('div.maptools', { style: { insetInlineEnd: '10px', top: '14px' } },
        mapTool('search', t('c1.search', 'Search a place, farm, plot or tree'),
          () => openSheet('MAP_SEARCH'),
          { deckNote: 'Finds a place, a farm, a plot or a tree' }),
        mapTool('layers', t('c2.title', 'Layers'), () => go('C2'), { deckTo: 'C2' }),
        has('maps.compare', farm)
          ? mapTool('compare', t('b4.compare', 'Compare'), () => go('C4'), { deckTo: 'C4' })
          : mapTool('compare', t('b4.compare', 'Compare'), () => openModal('UPGRADE', { featureKey: 'maps.compare' }), { locked: true, deckNote: 'Locked below the plan that compares dates' }),
        // WF5.077 — the user's own position, with a Locate me control.
        mapTool('locate', t('map.locate', 'Locate'), () => {
          if (!state.session.gpsGranted) { state.session.gpsGranted = true; commit('c1'); return; }
          if (live) liveMapControls(mapKey).locate();
          toast(t('c1.centred', 'Centred on your position'));
        })),

      panel),
  };
}

/* -- C2 · Layers, WF5.074 … WF5.076 --------------------------------------- */

export function C2() {
  const L = layers();
  const set = (key, value) => { L[key] = value; commit('layers'); };
  // The layers are the map's, and the map shows the farm the filter names.
  const farm = currentFarm();

  const layerRow = (key, label, featureKey) => {
    // WF5.076 — locked layers appear in the list with a lock and open the upgrade sheet.
    if (featureKey && !has(featureKey, farm)) return lockedRow(featureKey, label);
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

      /* TWO LAYERS LEFT. v1.7.2 removed the list of monitoring layers — the
         map's own "Pick a metric" chooses what is painted, and a second place
         to choose it was one too many — and irrigation efficiency, which is
         the farm's and is on My Farm (B1). Plot names and crops are always on
         the map, so they are not a switch either.

         THE TREE LAYER IS DOTS ONLY (v1.7.3): one dot per tree, in one
         neutral colour, no crowns and no land-use shapes. There is no forest or
         windbreak layer: the data is kept and nothing of it is drawn. */
      section(t('c2.farmlayers', 'Farm layers'), {},
        card({}, h('div', { style: { padding: '4px 16px' } },
          layerRow('boundaries', t('c2.boundaries', 'Farm and plot boundaries')),
          layerRow('trees', t('c2.trees2', 'Trees, one dot each'), 'tree.mapping')))),

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
      // The same picker and legend as C1: one metric, compared across two dates.
      h('div.c1panel__row',
        metricPicker(measureKey, { onPick: () => commit('measure') }),
        metricInfo(measureKey)),
      metricLegend(measureKey))),
  };
}

/* -- C5 · Boundary editor, WF5.090 … WF5.093 ------------------------------ */

export function C5(plotId) {
  const plot = plotById(plotId);
  const farm = farmById(plot.farmId);
  const label = plot.name;
  const ui = local(`c5-${plot.id}`, {
    points: plot.geometry.map((p) => [...p]),
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
        overflowAction(() => openSheet('PLOT_SHAPE_MENU', { plotId: plot.id })),
      ],
    }),
    body: h('div', { style: { display: 'flex', flexDirection: 'column', height: '100%' } },
      h('div.mapbox', { style: { flex: '1 1 auto', position: 'relative', minHeight: '240px' } },
        // The farm's own photograph, named rather than inferred: this map
        // deliberately leaves OUT the plot being edited, and on a farm with one
        // plot that left it with nothing to read a farm from — which is how the
        // last screen in the app kept its invented ground.
        mapSvg({
          plots: plotsOf(farm.id).filter((p) => p.id !== plot.id),
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
        h('p', { style: { margin: 0, fontSize: 'var(--t-meta)', color: 'var(--ink-500)' } },
          t('c5.more', 'Split, join, remove or add a plot from the ⋯ menu.')),
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
        saveBoundary(plot, ui.points.map((p) => [...p]));
        back();
      },
    })),
  };
}
