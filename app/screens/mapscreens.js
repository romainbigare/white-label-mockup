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
import { t } from '../core/i18n.js';
import { go, openSheet, openModal, back } from '../core/router.js';
import { icon } from '../ui/icons.js';
import {
  appBar, barAction, overflowAction, page, section, card, cardPad, row, btn, actionDock, statusChip,
  statusIcon, switchRow, disclaimer, req, select, divider, lockedRow,
  compareStage, compareSlider, compareLine, mapTool,
} from '../ui/components.js';
import { num, date, area } from '../core/format.js';
import { visibleFarms, farmById, plotsOf, allVisiblePlots, measureByKey, measures } from '../data/selectors.js';
import { has } from '../core/entitlements.js';
import { can } from '../core/capabilities.js';
import { mapSvg, legend, rampCss } from '../ui/map.js';
import { boundaryCanvas, undoVertex, polygonAreaHa } from '../ui/boundaryEditor.js';
import { saveBoundary } from '../data/actions.js';
import { plotById, rawFarm } from '../data/selectors.js';
import { decidedAreas, setAreaGeometry } from '../data/survey.js';

/* WF5.075 — layer selection is session state, restored on every visit. */
function layers() {
  if (!state.session.layers) {
    state.session.layers = {
      basemap: 'satellite',
      boundaries: true, labels: true, trees: false,
      soil: false, landuse: false, labs: false,
      vraSowing: false, vraNitrogen: false, vraPK: false, zoning: false,
      irrigation: false,
    };
  }
  return state.session.layers;
}

/* -- C1 · Map, WF5.071 … WF5.084 ------------------------------------------ */

export function C1() {
  const L = layers();
  const ui = local('c1', { zoom: 1 });
  const farmFilter = state.ui.farmFilter;
  const farms = visibleFarms();
  const plots = farmFilter === 'all' ? allVisiblePlots() : plotsOf(farmFilter);
  const measureKey = state.ui.measure;
  const measure = measureByKey(measureKey);
  const farm = farmFilter === 'all' ? farms[0] : farmById(farmFilter);
  const dates = farm?.imageryDates ?? [];
  const dateIndex = Math.max(0, Math.min(dates.length - 1, dates.length - 1 - state.ui.dateIndex));
  const current = dates[dateIndex];
  const measureLocked = !has(measure.featureKey);

  // No app bar. The map is the screen: it starts directly under the device's
  // own status bar, and every control floats on it. The status strip keeps the
  // ordinary light chrome rather than going dark for this one screen — the
  // clock, the signal and the battery should look the same everywhere.
  //
  // WF5.081 brings the search bar back, and it has to be VISIBLE AT ALL TIMES
  // rather than behind an icon: finding a place, a plot or a tree is the reason
  // this screen exists, and a farmer standing in a field cannot go hunting for
  // the control that finds the tree in front of him.
  return {
    body: h('div', { style: { position: 'relative', height: '100%' } },
      h('div.mapbox', { style: { position: 'absolute', inset: 0 } },
        mapSvg({
          plots, measure: measureKey, basemap: L.basemap, layers: L, zoom: ui.zoom,
          dateKey: current?.date ?? '', gps: state.session.gpsGranted ? state.session.gps : null,
          onPlotTap: (plot) => openSheet('C3', { plotId: plot.id }),      // WF5.073
        })),

      // WF5.081 — the search bar, across the top, always there.
      h('button.mapsearch', {
        onclick: () => openSheet('MAP_SEARCH'),
        style: { position: 'absolute', insetInline: '10px', top: '14px', zIndex: 3 },
      }, icon('search', 19),
         h('span', t('c1.search', 'Search a place, farm, plot or tree'))),

      // The left-hand column, dropped below the search bar it now shares the
      // top edge with.
      h('div', {
        style: {
          position: 'absolute', insetInlineStart: '10px', top: '66px', maxWidth: '54%',
          display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '8px',
        },
      },
      // WF5.084 — All farms, plus each farm on its own.
      when(farms.length > 1, () => h('button.mapchip', {
        onclick: () => openSheet('FARM_PICKER', { onPick: (id) => { state.ui.farmFilter = id; commit('c1'); } }),
      }, icon('home', 17),
         h('span', farmFilter === 'all' ? t('filter.allfarms', 'All farms') : farmById(farmFilter).name),
         icon('chevronDown', 15))),
      // WF5.080 — when offline the map shows cached tiles with a clear banner
      // naming the date of the imagery, which the shell's banner does not.
      when(state.session.connectivity === 'offline', () => h('div.banner.banner--cached', {
        style: { borderRadius: 'var(--radius-sm)' },
      }, icon('offline', 16),
         h('span', t('c1.cached', 'Saved map from {date}', { date: date(current?.date ?? '', { short: true }) }))))),

      // Bare glyphs — see mapTool(). Captioned, these pills took a third of the
      // width of the map they sit on.
      h('div.maptools', { style: { insetInlineEnd: '10px', top: '66px' } },
        mapTool('layers', t('c2.title', 'Layers'), () => go('C2')),
        has('maps.compare')
          ? mapTool('compare', t('b4.compare', 'Compare'), () => go('C4'))
          : mapTool('compare', t('b4.compare', 'Compare'), () => openModal('UPGRADE', { featureKey: 'maps.compare' }), { locked: true }),
        // WF5.083 — finding a tree sits on the MAP, because that is where the
        // farmer is standing when he needs it.
        when(farm?.treeCount > 0, () => mapTool('tree', t('c1.findtree', 'Find a tree'),
          () => openSheet('TREE_FINDER', { farmId: farm.id }))),
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
      h('div', { style: { display: 'flex', alignItems: 'center', gap: '4px' } },
        h('button.row', {
          onclick: () => openSheet('MEASURE_PICKER', { onPick: (key) => { state.ui.measure = key; commit('measure'); } }),
          style: { padding: '2px 0', borderBottom: 0, minHeight: '38px', flex: 1 },
        },
        h('div.row__main',
          h('div.row__title', t(`measure.${measure.key}`, measure.plain)),
          h('div.row__sub', measure.technical)),
        when(measureLocked, () => h('span.locked', icon('lock', 14), t('locked.short', 'Locked'))),
        h('span.row__chev', icon('chevronDown', 20))),
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
        h('div', { style: { minWidth: 0 } }, legend(measureKey, null)),
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
      section(t('c2.basemap', 'Basemap'), {},
        card({}, ['satellite', 'terrain', 'street'].map((b) => row({
          title: t(`c2.basemap.${b}`, b[0].toUpperCase() + b.slice(1)),
          onclick: () => set('basemap', b),
          value: L.basemap === b ? icon('check', 20) : null,
          chevron: false,
        })))),

      section(t('c2.measures', 'Measure layers'), {},
        card({}, measures().map((m) => (has(m.featureKey)
          ? row({
              title: t(`measure.${m.key}`, m.plain), sub: m.technical,
              onclick: () => { state.ui.measure = m.key; commit('measure'); },
              value: state.ui.measure === m.key ? icon('check', 20) : null, chevron: false,
            })
          : lockedRow(m.featureKey, t(`measure.${m.key}`, m.plain), m.technical))))),

      section(t('c2.farmlayers', 'Farm layers'), {},
        card({}, h('div', { style: { padding: '4px 16px' } },
          layerRow('boundaries', t('c2.boundaries', 'Farm and plot boundaries')),
          layerRow('labels', t('c2.labels', 'Plot labels')),
          layerRow('trees', t('c2.trees', 'Tree points'), 'tree.mapping')))),

      section(t('c2.gis', 'Advanced map layers'), {},
        card({}, h('div', { style: { padding: '4px 16px' } },
          layerRow('soil', t('c2.soil', 'Soil type'), 'gis.advanced'),
          layerRow('landuse', t('c2.landuse', 'Land use'), 'gis.advanced'),
          layerRow('labs', t('c2.labs', 'Testing labs'), 'gis.advanced')))),

      section(t('c2.vra', 'Variable rate maps'), {},
        card({}, h('div', { style: { padding: '4px 16px' } },
          layerRow('vraSowing', t('c2.vra.sowing', 'Sowing'), 'vra.maps'),
          layerRow('vraNitrogen', t('c2.vra.n', 'Nitrogen'), 'vra.maps'),
          layerRow('vraPK', t('c2.vra.pk', 'Phosphorus and potassium'), 'vra.maps'),
          layerRow('zoning', t('c2.vra.zoning', 'Zoning'), 'vra.maps')))),

      section(t('c2.irrigation', 'Irrigation'), {},
        card({}, h('div', { style: { padding: '4px 16px' } },
          layerRow('irrigation', t('c2.irrigationmap', 'Irrigation map'), 'irrigation.map')))),

      h('p', { style: { fontSize: 'var(--t-meta)', color: 'var(--ink-500)', margin: 0 } },
        t('c2.persist', 'Your layer choices are remembered between sessions.'), req('WF5.075'))),
  };
}

/* -- C4 · Compare dates on the map, WF5.079 ------------------------------ */

export function C4() {
  const L = layers();
  const ui = local('c4', { split: 50, left: 6, right: 0 });
  const farms = visibleFarms();
  const farmFilter = state.ui.farmFilter;
  const farm = farmFilter === 'all' ? farms[0] : farmById(farmFilter);
  const plots = farmFilter === 'all' ? allVisiblePlots() : plotsOf(farm.id);
  const dates = farm.imageryDates;
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
      legend(measureKey, measureByKey(measureKey).technical))),
  };
}

/* -- C3 · Plot sheet, WF5.073 --------------------------------------------
   A bottom sheet on the map, so this screen entry draws the map with it up.
   The shared body below is what overlays.js opens on a tap.

   WF5.073 ends with "there is no create-task action here", and that is not an
   oversight: §5.8.1 collapses task creation down to advisory and the ADD button
   on E1. A button here would put the farmer in front of an empty form having
   already forgotten what he tapped the plot to check. */

export function plotSheetBody(plot, { onOpen }) {
  const measure = measureByKey(state.ui.measure);
  const m = plot.measures[measure.key] ?? { value: 0, delta: 0 };
  return [
    h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px' } },
      statusIcon(plot.status, 22),
      h('div', { style: { flex: 1 } },
        h('div', { style: { fontWeight: 700, fontSize: 'var(--t-lead)' } }, plot.name),
        h('div', { style: { color: 'var(--ink-600)', fontSize: 'var(--t-meta)' } },
          `${plot.cropName}${plot.variety ? ` — ${plot.variety}` : ''} · ${area(plot.areaHa, { bare: true })}`)),
      statusChip(plot.status)),
    card({}, cardPad(
      h('div', { style: { display: 'flex', justifyContent: 'space-between' } },
        h('div.metric',
          h('span.metric__label', t(`measure.${measure.key}`, measure.plain)),
          h('span.num', num(m.value, 2))),
        h('div.metric',
          h('span.metric__label', t('b3.vs7', 'vs 7 days ago')),
          h('span.num', {
            style: { color: m.delta > 0 ? 'var(--st-good)' : m.delta < 0 ? 'var(--st-urgent)' : 'var(--ink-600)' },
          }, m.delta === 0 ? t('delta.nochange', 'no change') : `${m.delta > 0 ? '↑' : '↓'} ${num(Math.abs(m.delta), 2)}`))),
      h('div', { style: { color: 'var(--ink-700)' } }, plot.interpretation))),
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
      ...plotSheetBody(plot, { onOpen: () => go(`B4:${plot.id}`) }))),
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
  const label = isArea ? target.label : plot.name;
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

  const editor = boundaryCanvas({
    points: ui.points, selected: ui.selected,
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
        // the same five edits from A11 itself.
        ...(isArea ? [] : [overflowAction(() => openSheet('PLOT_SHAPE_MENU', { plotId: plot.id }))]),
      ],
    }),
    body: h('div', { style: { display: 'flex', flexDirection: 'column', height: '100%' } },
      h('div.mapbox', { style: { flex: '1 1 auto', position: 'relative', minHeight: '240px' } },
        mapSvg({ plots: isArea ? [] : plotsOf(farm.id).filter((p) => p.id !== plot.id), measure: 'ndvi', layers: { labels: false } }),
        editor.node),
      h('div', { style: { padding: '14px 16px', background: 'var(--paper)', display: 'flex', flexDirection: 'column', gap: '8px' } },
        h('div', h('span.num', area(editor.areaHa))),
        when(editor.invalid, () => disclaimer(t('a8d.crossing', 'The boundary crosses itself. Move the highlighted corner so the edges do not overlap.'), true)),
        // WF5.091 — this screen is not only for redrawing. Splitting a plot,
        // joining two, removing one and adding one all live behind the ⋯ above,
        // and all of them are available on any farm at any time — not only at
        // the moment a survey is confirmed.
        when(!isArea, () => h('p', { style: { margin: 0, fontSize: 'var(--t-meta)', color: 'var(--ink-500)' } },
          t('c5.more', 'Split, join, remove or add a plot from the ⋯ menu.'))),
        // WF5.092 — a versioned event, not an overwrite.
        h('p', { style: { margin: 0, fontSize: 'var(--t-meta)', color: 'var(--ink-500)' } },
          t('c5.versioned', 'The previous boundary is kept, with who changed it and when. Past analytics stay attached to the shape that was in force at the time.'),
          req('WF5.091', 'WF5.092')))),
    dock: actionDock(btn(t('action.save', 'Save boundary'), {
      variant: 'primary', disabled: ui.points.length < 3 || editor.invalid,
      onclick: () => {
        if (isArea) {
          // WF4.082 / WF4.084 — the corrected outline changes the area, which
          // changes the totals A13 is about to be priced from.
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
