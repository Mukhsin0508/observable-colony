import './style.css';
import { ColonySimulation } from './simulation';
import { ColonyScene } from './scene';
import { ColonyUI } from './ui';
import type { UIState } from './types';

const simulation = new ColonySimulation(1709);
// Open on an established, genuinely simulated nest; Restart returns to the starter nest.
simulation.step(360);
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const state: UIState = { paused: reducedMotion, speed: 1, signals: true, view: 'cutaway', selectedAnt: null };
const sceneContainer = document.querySelector<HTMLElement>('#scene')!;
const uiContainer = document.querySelector<HTMLElement>('#ui')!;

function selectAnt(id?: number): void {
  const ants = simulation.snapshot().ants;
  state.selectedAnt = id ?? ants[((state.selectedAnt ?? -1) + 7) % ants.length].id;
  state.view = 'follow';
}

const ui = new ColonyUI(uiContainer, {
  togglePause: () => { state.paused = !state.paused; },
  setSpeed: speed => { state.speed = speed; },
  toggleSignals: () => { state.signals = !state.signals; },
  setView: view => { state.view = view; if (view === 'follow' && state.selectedAnt === null) selectAnt(6); },
  reset: () => { simulation.reset(); state.selectedAnt = null; state.view = 'cutaway'; },
  moveFood: () => { simulation.moveFood(); },
  selectAnt: () => selectAnt(),
});

function showError(message: string): void {
  let alert = document.querySelector<HTMLElement>('#scene-error');
  if (!alert) { alert = document.createElement('div'); alert.id = 'scene-error'; alert.setAttribute('role', 'alert'); uiContainer.append(alert); }
  alert.textContent = message;
}

try {
  const scene = new ColonyScene(sceneContainer, selectAnt);
  let previous = performance.now();
  let uiClock = 0;
  document.addEventListener('visibilitychange', () => { previous = performance.now(); });
  sceneContainer.addEventListener('scene-error', event => { state.paused = true; showError((event as CustomEvent<string>).detail); });
  scene.renderer.setAnimationLoop(now => {
    const delta = Math.min(0.08, Math.max(0, (now - previous) / 1000));
    previous = now;
    if (document.hidden) return;
    if (!state.paused) simulation.step(delta * state.speed);
    const snapshot = simulation.snapshot();
    scene.update(snapshot, state, delta);
    uiClock += delta;
    if (uiClock >= 0.1) { ui.update(snapshot, state); uiClock = 0; }
  });
  ui.update(simulation.snapshot(), state);
  if (import.meta.hot) import.meta.hot.dispose(() => { scene.renderer.setAnimationLoop(null); scene.dispose(); });
} catch (error) {
  console.error(error);
  showError('This experience needs WebGL 2. Try a recent Chrome, Safari, or Firefox browser with hardware acceleration enabled.');
}
