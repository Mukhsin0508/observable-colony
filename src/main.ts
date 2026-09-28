import './style.css';
import './journey.css';
import './expedition.css';
import './perception.css';
import { ColonySimulation } from './simulation';
import { ColonyScene } from './scene';
import { ColonyUI } from './ui';
import { ColonyLifecycle, type LifecycleSnapshot } from './lifecycle';
import { JourneyUI } from './journey-ui';
import { describeStudy, loadStudy, type MeasuredStudy } from './study';
import { CHAPTERS, Expedition } from './expedition';
import { ExpeditionUI } from './expedition-ui';
import { PerceptionUI } from './perception-ui';
import type { ColonySnapshot, UIState, ViewMode } from './types';

const simulation = new ColonySimulation(1709);
const lifecycle = new ColonyLifecycle(1709);
const expedition = new Expedition();
simulation.setPopulation(0);
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const state: UIState = { paused: reducedMotion, speed: 1, signals: true, view: 'queen', selectedAnt: null };
let mode: 'colony' | 'measured' = 'colony';
let study: MeasuredStudy | null = null;
let studyIndex = 0;
let studyError = '';
let scanClock = 0;
let focus = false;
let scene: ColonyScene | null = null;
const sceneContainer = document.querySelector<HTMLElement>('#scene')!;
const uiContainer = document.querySelector<HTMLElement>('#ui')!;
document.body.dataset.mode = mode;
document.body.dataset.journey = 'true';
document.body.dataset.expedition = 'false';
document.body.dataset.focus = 'false';

function stopExpedition(): void { expedition.stop(); document.body.dataset.expedition = 'false'; }

function setMode(next: 'colony' | 'measured'): void {
  mode = next; document.body.dataset.mode = mode; state.selectedAnt = null;
  state.view = mode === 'measured' ? 'orbit' : lifecycle.snapshot().workers ? 'cutaway' : 'queen';
  state.paused = true; scanClock = 0;
  scene?.showStudy(mode === 'measured', study, studyIndex);
}

function seekStage(id: string): void {
  perception.clearFeedback();
  lifecycle.seek(id); simulation.reset(); simulation.setPopulation(0);
  const life = lifecycle.snapshot(); alignWorkers(life);
  if (life.workers > 0) simulation.step(Math.min(1200, Math.max(6, life.day - 60) * 0.5));
  state.selectedAnt = null; state.view = life.workers > 30 ? 'cutaway' : 'queen'; state.paused = true;
}

function chooseWorker(view: ViewMode): void {
  const ants = simulation.snapshot().ants;
  const candidates = view === 'surface'
    ? ants.filter(a => a.role === 'forager' && a.position.y >= 0.2)
    : ants.filter(a => a.tunnelId !== null && a.position.y < -0.8 && a.role !== 'nurse');
  // Choose a readable real worker; selection does not change its behavior or sensor values.
  candidates.sort((a, b) => {
    const first = simulation.inspectAnt(a.id), second = simulation.inspectAnt(b.id);
    if (view === 'surface') return Math.max(second?.ahead ?? 0, second?.left ?? 0, second?.right ?? 0) - Math.max(first?.ahead ?? 0, first?.left ?? 0, first?.right ?? 0);
    return (first?.localNeighbors ?? 0) - (second?.localNeighbors ?? 0);
  });
  const ant = candidates[0] ?? ants[0];
  state.selectedAnt = ant?.id ?? null;
}

function applyChapter(): void {
  const chapter = expedition.chapter;
  setMode(chapter.mode);
  if (chapter.mode === 'colony') {
    seekStage(chapter.stage);
    state.view = chapter.view;
    if (chapter.view === 'surface' || chapter.view === 'immersive') chooseWorker(chapter.view);
  } else {
    studyIndex = expedition.auto ? 0 : (study?.frames.length ?? 1) - 1; scene?.showStudy(true, study, studyIndex);
  }
  state.signals = true; state.speed = 1; state.paused = reducedMotion && !expedition.auto;
}

function setLens(view: ViewMode): void {
  stopExpedition();
  if (mode === 'measured') return;
  state.view = view;
  if (view === 'surface' || view === 'immersive') chooseWorker(view);
}

function selectAnt(id?: number): void {
  if (mode === 'measured') return;
  stopExpedition();
  const ants = simulation.snapshot().ants;
  if (!ants.length) { state.view = 'queen'; return; }
  state.selectedAnt = id ?? ants[((state.selectedAnt ?? -1) + 7) % ants.length].id;
  state.view = 'follow';
}

function alignWorkers(life: LifecycleSnapshot): void {
  simulation.setPopulation(life.workers);
  if (state.selectedAnt !== null && !simulation.snapshot().ants.some(a => a.id === state.selectedAnt)) { state.selectedAnt = null; state.view = 'cutaway'; }
}

function restart(): void {
  stopExpedition();
  if (mode === 'measured') { studyIndex = 0; scene?.showStudy(true, study, studyIndex); return; }
  lifecycle.reset(); simulation.reset(); simulation.setPopulation(0);
  state.selectedAnt = null; state.view = 'queen';
}

function togglePause(): void {
  if (mode === 'measured' && state.paused && study && studyIndex === study.frames.length - 1) {
    studyIndex = 0; scanClock = 0;
    if (expedition.active) { expedition.seek(expedition.index); expedition.auto = true; }
    scene?.showStudy(true, study, studyIndex);
  }
  state.paused = !state.paused;
}

const ui = new ColonyUI(uiContainer, {
  togglePause,
  setSpeed: speed => { state.speed = speed; },
  toggleSignals: () => { state.signals = !state.signals; },
  setView: view => {
    stopExpedition();
    if (mode === 'measured' && view === 'follow') return;
    state.view = view;
    if (view === 'follow' && state.selectedAnt === null) selectAnt();
  },
  reset: restart,
  moveFood: () => { simulation.moveFood(); },
  selectAnt: () => selectAnt(),
});

const journeyContainer = document.createElement('div');
journeyContainer.id = 'journey'; document.querySelector('#experience')!.append(journeyContainer);
const measuredCaption = document.createElement('div');
measuredCaption.className = 'measured-caption';
measuredCaption.innerHTML = '<p>FROM THE EXPERIMENT</p><h1>A nest, grain<br>by grain.</h1><p>Recorded removals. Original positions.</p><div><span class="legend-current"></span>This scan <span class="legend-past"></span>Earlier scans</div><small>Dots mark grain centroids.<br>Dot sizes and colors are illustrative.</small>';
journeyContainer.append(measuredCaption);
const journeyControls = document.createElement('div'); journeyContainer.append(journeyControls);
const journey = new JourneyUI(journeyControls, {
  setMode: next => { stopExpedition(); setMode(next); },
  seekStage: id => { stopExpedition(); seekStage(id); },
  seekStudy: index => { studyIndex = Math.max(0, Math.min(index, (study?.frames.length ?? 1) - 1)); state.paused = true; scene?.showStudy(true, study, studyIndex); },
  toggleQueen: () => { lifecycle.setQueenAlive(!lifecycle.snapshot().queenAlive); state.paused = false; state.speed = 12; },
  focusQueen: () => { state.selectedAnt = null; state.view = 'queen'; },
});

const expeditionContainer = document.createElement('div'); document.querySelector('#experience')!.append(expeditionContainer);
const expeditionUI = new ExpeditionUI(expeditionContainer, {
  start: () => { expedition.start(!reducedMotion); document.body.dataset.expedition = 'true'; applyChapter(); },
  stop: stopExpedition,
  next: () => { if (expedition.seek(expedition.index + 1)) applyChapter(); },
  previous: () => { if (expedition.seek(expedition.index - 1)) applyChapter(); },
  toggleAuto: () => {
    expedition.auto = !expedition.auto;
    if (expedition.auto) {
      if (expedition.progress >= 1) { expedition.seek(expedition.index); applyChapter(); }
      state.paused = false;
    }
  },
  setLens,
  toggleFocus: () => { focus = !focus; document.body.dataset.focus = String(focus); },
});
const perception = new PerceptionUI(document.querySelector('#experience')!, () => {
  simulation.moveFood(); state.paused = false; expedition.auto = false;
});

function keyboard(event: KeyboardEvent): void {
  if (event.code === 'Escape' && !document.querySelector('dialog[open]')) {
    stopExpedition(); focus = false; document.body.dataset.focus = 'false'; return;
  }
  if (event.target instanceof Element && event.target.closest('button, input, a, textarea, select, dialog, [contenteditable]')) return;
  if (event.code === 'Space') { event.preventDefault(); togglePause(); }
  if (expedition.active && ['ArrowRight', 'ArrowLeft'].includes(event.code)) {
    event.preventDefault(); if (expedition.seek(expedition.index + (event.code === 'ArrowRight' ? 1 : -1))) applyChapter();
  }
}
document.addEventListener('keydown', keyboard);

function displaySnapshot(life: LifecycleSnapshot): ColonySnapshot {
  const snapshot = simulation.snapshot();
  // The founding chamber is an authored illustration, not archived nest geometry.
  if (life.totalBorn === 0) {
    snapshot.nodes = snapshot.nodes.slice(0, 2); snapshot.tunnels = snapshot.tunnels.slice(0, 1);
  }
  snapshot.nodes[1].radius = 1.05;
  return snapshot;
}

function updateUI(snapshot: ColonySnapshot, life: LifecycleSnapshot): void {
  ui.update(snapshot, state);
  journey.update(life, describeStudy(study, studyIndex, studyError), mode);
  const chapter = expedition.chapter;
  expeditionUI.update({ active: expedition.active, index: expedition.index, total: CHAPTERS.length, title: chapter.title, copy: chapter.copy,
    eyebrow: mode === 'measured' ? 'ORIGINAL GRAIN POSITIONS · EXPERIMENT 1' : 'THE COLONY’S STORY · MODEL TIME JUMPS BETWEEN CHAPTERS',
    auto: expedition.auto, progress: expedition.progress, canFollow: life.workers > 0, focus, mode });
  const ant = snapshot.ants.find(a => a.id === state.selectedAnt);
  perception.update(ant, ant ? simulation.inspectAnt(ant.id) : null, mode === 'colony' && ['surface', 'immersive'].includes(state.view));
  document.querySelector('#model-time')!.textContent = mode === 'colony' ? `D ${Math.floor(life.day).toLocaleString()}` : `${studyIndex + 1} / ${study?.frames.length ?? '—'}`;
  document.querySelector('.model-clock > span:last-child')!.textContent = mode === 'colony' ? expedition.active ? 'CHAPTER DAY' : 'MODEL DAYS' : 'ARCHIVED SCAN';
  document.querySelector('.colony-stats > div:first-child > span')!.textContent = 'workers shown';
  const badge = document.querySelector('.live-badge')!;
  const badgeText = badge.lastChild;
  if (badgeText?.nodeType === Node.TEXT_NODE) badgeText.textContent = mode === 'measured' ? 'ARCHIVED DATA' : state.paused ? 'MODEL PAUSED' : 'LIVE MODEL';
  const follow = document.querySelector<HTMLButtonElement>('button[data-view="follow"]')!;
  follow.disabled = mode === 'measured' || life.workers === 0;
  document.querySelector('#scene-instructions')!.textContent = mode === 'measured' ? 'Archived grain positions · drag in Orbit to inspect' : state.view === 'queen' ? 'The founding chamber · brood is a representative sample' : `${snapshot.ants.length} visible workers represent ${life.workers.toLocaleString()} modeled adults`;
}

function showError(message: string): void {
  let alert = document.querySelector<HTMLElement>('#scene-error');
  if (!alert) { alert = document.createElement('div'); alert.id = 'scene-error'; alert.setAttribute('role', 'alert'); uiContainer.append(alert); }
  alert.textContent = message;
}

void loadStudy().then(data => { study = data; studyIndex = expedition.active ? 0 : data.frames.length - 1; if (mode === 'measured') scene?.showStudy(true, study, studyIndex); }).catch(error => { studyError = error instanceof Error ? error.message : 'The archive could not load.'; });

try {
  scene = new ColonyScene(sceneContainer, selectAnt);
  let previous = performance.now(), uiClock = 0;
  document.addEventListener('visibilitychange', () => { previous = performance.now(); });
  sceneContainer.addEventListener('scene-error', event => { state.paused = true; showError((event as CustomEvent<string>).detail); });
  scene.renderer.setAnimationLoop(now => {
    const delta = Math.min(0.08, Math.max(0, (now - previous) / 1000)); previous = now;
    if (document.hidden) return;
    const wasAuto = expedition.auto;
    if (expedition.step(delta, state.paused)) applyChapter();
    if (wasAuto && !expedition.auto && expedition.index === CHAPTERS.length - 1) {
      state.paused = true;
      if (study) { studyIndex = study.frames.length - 1; scene!.showStudy(true, study, studyIndex); }
    }
    if (!state.paused && mode === 'colony') {
      if (!expedition.active) { lifecycle.step(delta * state.speed); alignWorkers(lifecycle.snapshot()); }
      simulation.step(delta * state.speed);
    } else if (!state.paused && study && mode === 'measured') {
      if (expedition.active && expedition.auto) {
        const index = Math.min(study.frames.length - 1, Math.floor(expedition.progress * (study.frames.length - 1)));
        if (index !== studyIndex) { studyIndex = index; scene!.showStudy(true, study, studyIndex); }
      } else {
        scanClock += delta * state.speed;
        if (scanClock >= 1.5) { scanClock = 0; if (studyIndex < study.frames.length - 1) studyIndex++; else state.paused = true; scene!.showStudy(true, study, studyIndex); }
      }
    }
    const life = lifecycle.snapshot(); const snapshot = displaySnapshot(life);
    state.guided = expedition.active;
    scene!.update(snapshot, state, delta, life);
    uiClock += delta;
    if (uiClock >= 0.1) { updateUI(snapshot, life); uiClock = 0; }
  });
  updateUI(displaySnapshot(lifecycle.snapshot()), lifecycle.snapshot());
  if (import.meta.hot) import.meta.hot.dispose(() => { document.removeEventListener('keydown', keyboard); scene?.renderer.setAnimationLoop(null); scene?.dispose(); });
} catch (error) {
  console.error(error);
  showError('The 3D view could not start. Try reloading in a recent browser with hardware acceleration enabled.');
}
