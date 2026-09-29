import type { ColonySnapshot, UIActions, UIState, ViewMode } from './types';

const icon = (name: string): string => {
  const paths: Record<string, string> = {
    play: '<path d="m8 5 10 7-10 7z" fill="currentColor" stroke="none"/>',
    pause: '<path d="M8 5v14M16 5v14" stroke-width="3"/>',
    reset: '<path d="M4 10a8 8 0 1 1 1 8M4 4v6h6"/>',
    arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
    close: '<path d="m6 6 12 12M6 18 18 6"/>',
    signal: '<circle cx="12" cy="12" r="2" fill="currentColor" stroke="none"/><path d="M7 7a7 7 0 0 0 0 10M17 7a7 7 0 0 1 0 10M3 3a13 13 0 0 0 0 18M21 3a13 13 0 0 1 0 18"/>',
    food: '<path d="M12 20v-8M12 14C3 15 3 7 3 7s9-2 9 7Zm0-3c0-8 9-8 9-8s1 9-9 8Z"/>',
    book: '<path d="M12 6v15M12 6C8 3 3 4 3 4v15s5-1 9 2c4-3 9-2 9-2V4s-5-1-9 2Z"/>',
  };
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] ?? ''}</svg>`;
};

/** The interface reads simulation state; it never invents measurements. */
export class ColonyUI {
  private readonly elements = new Map<string, HTMLElement>();
  private readonly dialog: HTMLDialogElement;
  private readonly researchButton: HTMLButtonElement;
  private lastPaused: boolean | null = null;

  constructor(private readonly container: HTMLElement, actions: UIActions) {
    container.innerHTML = `
      <header class="observatory-header">
        <a class="wordmark" href="#" aria-label="Observable Colony home"><span class="brand-symbol" aria-hidden="true"><i></i><i></i><i></i></span><span>OBSERVABLE<span class="brand-second">COLONY</span></span></a>
        <div class="header-right"><span class="live-badge"><span></span>LIVE SIMULATION</span><button id="research-open" class="text-button research-button" type="button">${icon('book')}<span>The research</span></button></div>
      </header>

      <aside class="intro-panel" aria-label="About the colony">
        <p class="eyebrow">AN ANT COLONY</p>
        <h1>A city without<br>an <em>architect.</em></h1>
        <p class="intro-copy">No ant sees the whole plan.<br>A home emerges from thousands<br>of small, local decisions.</p>
        <div class="colony-stats" aria-label="Live colony statistics">
          <div><strong id="stat-ants">—</strong><span>ants at work</span></div>
          <div><strong id="stat-diggers">—</strong><span>digging now</span></div>
          <div><strong id="stat-food">—</strong><span>food returns</span></div>
        </div>
        <div class="experiment-tools">
          <button type="button" id="signals-toggle" class="signal-button" aria-pressed="true">${icon('signal')}<span>Reveal communication</span><span class="switch" aria-hidden="true"><i></i></span></button>
          <p class="signal-note" id="signal-note">Mint traces reveal the scent trails.</p>
          <button type="button" id="move-food" class="food-button">${icon('food')}<span>Move the food</span>${icon('arrow')}</button>
          <p class="experiment-note">Change the world. Watch them adapt.</p>
        </div>
      </aside>

      <div class="world-caption" aria-hidden="true"><span class="crosshair">+</span><span>A WORLD BENEATH OUR FEET</span><span class="caption-line"></span></div>

      <aside class="ant-panel" aria-label="Individual ant inspector">
        <div class="ant-panel-heading"><span class="eyebrow">A LOCAL WORLD</span><span class="tiny-cross">+</span></div>
        <div class="ant-identity"><span class="ant-mini" aria-hidden="true">${this.antIcon()}</span><div><h2 id="ant-name">Meet a worker</h2><span class="ant-role" id="ant-role">One life in the colony</span></div></div>
        <p class="ant-action" id="ant-action">Follow an ant to see the colony from its point of view.</p>
        <button id="select-ant" class="inspect-button" type="button"><span id="select-ant-label">Find an ant</span>${icon('arrow')}</button>
      </aside>

      <div class="scene-instructions" id="scene-instructions">Choose Orbit to look around <span>·</span> Select a worker to follow</div>
      <footer class="bottom-dock">
        <div class="playback-controls" role="group" aria-label="Simulation playback">
          <button id="pause-toggle" class="play-button" type="button" aria-label="Pause simulation" title="Pause simulation">${icon('pause')}</button>
          <div class="model-clock"><span id="model-time">00:00</span><span>MODEL TIME</span></div>
          <div class="speed-controls" role="group" aria-label="Simulation speed"><button type="button" data-speed="1" aria-pressed="true">1×</button><button type="button" data-speed="4" aria-pressed="false">4×</button><button type="button" data-speed="12" aria-pressed="false">12×</button></div>
          <button id="reset-simulation" class="icon-button reset-button" type="button" aria-label="Restart colony" title="Restart colony">${icon('reset')}</button>
        </div>
        <div class="view-controls" role="group" aria-label="Camera view"><button type="button" data-view="cutaway" aria-pressed="true">Cutaway</button><button type="button" data-view="orbit" aria-pressed="false">Orbit</button><button type="button" data-view="follow" aria-pressed="false">Follow ant</button></div>
        <span class="model-disclaimer">Inspired by research.<br>Built to explore.</span>
      </footer>

      <dialog class="research-dialog" id="research-dialog" aria-labelledby="research-title">
        <div class="dialog-top"><p class="eyebrow">FIELD NOTES / 001</p><button id="research-close" class="icon-button" type="button" aria-label="Close research">${icon('close')}</button></div>
        <h2 id="research-title">Small rules.<br><em>Collective intelligence.</em></h2>
        <p class="research-lead">How does a colony build and organize a home when no individual has the whole plan?</p>
        <p>This is an interactive model of that question. Foragers sample nearby scent. Excavators work at reachable tunnel fronts. Returning workers bring food home and reinforce trails. No worker directs the colony. Underground routing and homing are simplified navigation rules.</p>
        <div class="research-distinction"><span class="eyebrow">TWO DIFFERENT KINDS OF EVIDENCE</span><p><strong>Measured excavation</strong> replays the authors’ image-derived grain positions and removal sequence from Experiment 1. It does not show tracked ant paths. Lengths use the supplement’s 0.14 mm scan voxel; exact acquisition times have not been assigned.</p><p><strong>Living colony</strong> is an illustrative lifecycle model. The queen, brood, population, geometry, clock and signals are modeled, not observations of that recorded experiment. Days and demographic rates are authored assumptions.</p><p><a href="https://doi.org/10.22002/D1.1996" target="_blank" rel="noopener noreferrer">Open the CC0 excavation archive ↗</a></p></div>
        <div class="source-list">
          <article><span class="source-number">01</span><div><h3>Building underground</h3><p><cite>Unearthing real-time 3D ant tunneling mechanics</cite> (2021). Time-resolved imaging of western harvester ants (<i>Pogonomyrmex occidentalis</i>) connects individual excavation with the shape of a nest.</p><a href="https://doi.org/10.1073/pnas.2102267118" target="_blank" rel="noopener noreferrer">Read the PNAS paper <span aria-hidden="true">↗</span></a></div></article>
          <article><span class="source-number">02</span><div><h3>Following a chemical trail</h3><p><cite>Individual rules for trail pattern formation in Argentine ants</cite> (2012). Local responses to pheromone help explain collective trail patterns in <i>Linepithema humile</i>.</p><a href="https://doi.org/10.1371/journal.pcbi.1002592" target="_blank" rel="noopener noreferrer">Read the PLOS paper <span aria-hidden="true">↗</span></a></div></article>
          <article><span class="source-number">03</span><div><h3>Coordinating through encounters</h3><p><cite>Agitated ants: regulation and self-organization of incipient nest excavation via collisional cues</cite> (2023). Experiments with fire ants (<i>Solenopsis invicta</i>) explore how encounters help regulate excavation. This mechanism is a direction for future development; encounters do not control digging in this prototype.</p><a href="https://doi.org/10.1098/rsif.2022.0597" target="_blank" rel="noopener noreferrer">Read the Royal Society paper <span aria-hidden="true">↗</span></a></div></article>
          <article><span class="source-number">04</span><div><h3>A division of labor</h3><p><cite>Tracking individuals shows spatial fidelity is a key regulator of ant social organization</cite> (2013). Tagged <i>Camponotus fellah</i> workers reveal how social interactions relate to where ants spend their time.</p><a href="https://doi.org/10.1126/science.1234316" target="_blank" rel="noopener noreferrer">Read the Science paper <span aria-hidden="true">↗</span></a></div></article>
        </div>
        <p class="research-footnote">These studies investigate different species and experimental settings. This first prototype combines their broad ideas for teaching; it does not claim to reproduce a single species or its measured behavior.</p>
      </dialog>`;

    container.querySelectorAll<HTMLElement>('[id]').forEach(element => this.elements.set(element.id, element));
    this.dialog = this.element('research-dialog') as HTMLDialogElement;
    this.researchButton = this.element('research-open') as HTMLButtonElement;
    this.researchButton.addEventListener('click', () => this.dialog.showModal());
    this.element('research-close').addEventListener('click', () => this.dialog.close());
    this.dialog.addEventListener('click', event => {
      if (event.target !== this.dialog) return;
      const bounds = this.dialog.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) this.dialog.close();
    });
    this.dialog.addEventListener('close', () => this.researchButton.focus());
    this.element('pause-toggle').addEventListener('click', actions.togglePause);
    this.element('signals-toggle').addEventListener('click', actions.toggleSignals);
    this.element('move-food').addEventListener('click', actions.moveFood);
    this.element('reset-simulation').addEventListener('click', actions.reset);
    this.element('select-ant').addEventListener('click', actions.selectAnt);
    container.querySelectorAll<HTMLButtonElement>('[data-speed]').forEach(button => button.addEventListener('click', () => actions.setSpeed(Number(button.dataset.speed))));
    container.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(button => button.addEventListener('click', () => actions.setView(button.dataset.view as ViewMode)));
    this.speedButtons = Array.from(container.querySelectorAll<HTMLButtonElement>('[data-speed]'));
    this.viewButtons = Array.from(container.querySelectorAll<HTMLButtonElement>('[data-view]'));
  }

  private readonly speedButtons: HTMLButtonElement[];
  private readonly viewButtons: HTMLButtonElement[];

  update(snapshot: ColonySnapshot, state: UIState): void {
    if (this.container.dataset.view !== state.view) this.container.dataset.view = state.view;
    this.setText('stat-ants', String(snapshot.ants.length));
    this.setText('stat-diggers', String(snapshot.stats.activeDiggers));
    this.setText('stat-food', String(snapshot.stats.foodCollected));
    const seconds = Math.floor(snapshot.stats.elapsed);
    this.setText('model-time', `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`);
    if (this.lastPaused !== state.paused) {
      this.lastPaused = state.paused;
      const button = this.element('pause-toggle');
      button.innerHTML = icon(state.paused ? 'play' : 'pause');
      button.setAttribute('aria-label', state.paused ? 'Resume simulation' : 'Pause simulation');
      button.setAttribute('title', state.paused ? 'Resume simulation' : 'Pause simulation');
    }
    this.setPressed(this.element('signals-toggle'), state.signals);
    this.setText('signal-note', state.signals ? 'Mint traces reveal the scent trails.' : 'Signals are still there. You just can’t see them.');
    for (const button of this.speedButtons) this.setPressed(button, Number(button.dataset.speed) === state.speed);
    for (const button of this.viewButtons) this.setPressed(button, button.dataset.view === state.view);
    const ant = snapshot.ants.find(candidate => candidate.id === state.selectedAnt);
    this.setText('ant-name', ant ? `Worker ${String(ant.id).padStart(3, '0')}` : 'Meet a worker');
    this.setText('ant-role', ant ? ant.role : 'One life in the colony');
    this.setText('ant-action', ant ? this.describeAction(ant.state) : 'Follow an ant to see the colony from its point of view.');
    this.setText('select-ant-label', ant ? 'Meet another ant' : 'Find an ant');
    this.setText('scene-instructions', state.view === 'follow' ? 'You’re traveling with one worker. Its world is local.' : state.view === 'orbit' ? 'Drag to look around · Scroll to get closer' : 'Choose Orbit to look around · Select a worker to follow');
  }

  private describeAction(state: string): string {
    const descriptions: Record<string, string> = {
      'exploring': 'Exploring the neighborhood. Looking for the next local cue.',
      'digging': 'Excavating at the tunnel front. One small piece at a time.',
      'carrying soil': 'Taking excavated soil back toward the entrance.',
      'seeking food': 'Searching for food and sensing the trail nearby.',
      'carrying food': 'Bringing food home, leaving a chemical trail behind.',
      'tending brood': 'Moving within the nest.',
    };
    return descriptions[state] ?? state;
  }

  private element(id: string): HTMLElement {
    const element = this.elements.get(id);
    if (!element) throw new Error(`Missing interface element: ${id}`);
    return element;
  }

  private setText(id: string, text: string): void {
    const element = this.element(id);
    if (element.textContent !== text) element.textContent = text;
  }

  private setPressed(button: HTMLElement, pressed: boolean): void {
    const next = String(pressed);
    if (button.getAttribute('aria-pressed') !== next) button.setAttribute('aria-pressed', next);
  }

  private antIcon(): string {
    return '<svg viewBox="0 0 44 64" fill="none" aria-hidden="true"><path d="m18 21-8-7-4 2m20 5 8-7 4 2M18 30 8 29 3 34m23-4 10-1 5 5M18 38l-8 8-4 9m20-17 8 8 4 9M19 12l-4-8m10 8 4-8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><ellipse cx="22" cy="43" rx="7" ry="12" fill="currentColor"/><ellipse cx="22" cy="27" rx="4" ry="7" fill="currentColor"/><ellipse cx="22" cy="15" rx="5" ry="6" fill="currentColor"/></svg>';
  }
}
