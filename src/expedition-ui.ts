export type ExpeditionLens = 'surface' | 'immersive' | 'queen' | 'cutaway';

export interface ExpeditionActions {
  start(): void;
  stop(): void;
  next(): void;
  previous(): void;
  toggleAuto(): void;
  setLens(view: ExpeditionLens): void;
  toggleFocus(): void;
}

export interface ExpeditionState {
  active: boolean;
  index: number;
  total: number;
  title: string;
  copy: string;
  eyebrow: string;
  auto: boolean;
  /** Progress through the current chapter, normalized from zero to one. */
  progress: number;
  canFollow: boolean;
  focus: boolean;
  mode: 'colony' | 'measured';
}

const svg = (name: string): string => {
  const paths: Record<string, string> = {
    right: '<path d="M4 12h15m-6-6 6 6-6 6"/>',
    left: '<path d="M20 12H5m6-6-6 6 6 6"/>',
    close: '<path d="m6 6 12 12M6 18 18 6"/>',
    play: '<path d="m9 5 10 7-10 7Z" fill="currentColor" stroke="none"/>',
    pause: '<path d="M8 6v12M16 6v12" stroke-width="2.5"/>',
    focus: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
    exit: '<path d="M3 8h5V3m8 0v5h5M8 21v-5H3m13 5v-5h5"/>',
    compass: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5Z"/>',
  };
  return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] ?? ''}</svg>`;
};

/** The story follows application state; this class owns only its controls and text. */
export class ExpeditionUI {
  private readonly elements = new Map<string, HTMLElement>();
  private readonly lensButtons: HTMLButtonElement[];
  private state: ExpeditionState | null = null;
  private lastAuto: boolean | null = null;
  private lastFocus: boolean | null = null;

  constructor(private readonly container: HTMLElement, private readonly actions: ExpeditionActions) {
    container.classList.add('expedition-interface');
    container.innerHTML = `
      <div class="expedition-toolbar" aria-label="Explore the colony">
        <button id="expedition-start" class="expedition-launch" type="button">${svg('compass')}<span>Take a guided journey</span>${svg('right')}</button>
        <nav class="expedition-lenses" aria-label="Look through a different lens">
          <button type="button" data-expedition-lens="surface" title="Explore the world above ground">Surface</button>
          <button type="button" data-expedition-lens="immersive" id="expedition-worker-lens" title="Travel at a worker’s height">Inside worker</button>
          <button type="button" data-expedition-lens="queen" title="Visit the founding chamber">Queen</button>
          <button type="button" data-expedition-lens="cutaway" title="See the nest in cutaway">Nest</button>
        </nav>
        <button id="expedition-focus" class="expedition-focus" type="button" aria-pressed="false" title="Hide the interface and focus on the colony"><span id="expedition-focus-icon">${svg('focus')}</span><span id="expedition-focus-label">Focus</span></button>
      </div>

      <section id="expedition-story" class="expedition-story" aria-labelledby="expedition-title" hidden>
        <div class="expedition-story-top"><span id="expedition-evidence">ILLUSTRATIVE MODEL</span><button id="expedition-close" class="expedition-icon-button" type="button" aria-label="Leave guided journey" title="Leave guided journey">${svg('close')}</button></div>
        <div class="expedition-narration" aria-live="polite" aria-atomic="true">
          <p class="expedition-eyebrow" id="expedition-eyebrow"></p>
          <h2 id="expedition-title"></h2>
          <p class="expedition-copy" id="expedition-copy"></p>
        </div>
        <div class="expedition-story-bottom">
          <div class="expedition-chapter"><span id="expedition-count">01 / 01</span><button id="expedition-auto" class="expedition-auto" type="button" aria-pressed="false" title="Advance through the journey automatically"><span id="expedition-auto-icon">${svg('play')}</span><span id="expedition-auto-label">Autoplay</span></button></div>
          <div class="expedition-step-controls"><button id="expedition-previous" class="expedition-icon-button" type="button" aria-label="Previous chapter" title="Previous chapter">${svg('left')}</button><button id="expedition-next" class="expedition-next" type="button"><span id="expedition-next-label">Next chapter</span>${svg('right')}</button></div>
        </div>
        <div id="expedition-progress" class="expedition-progress" role="progressbar" aria-label="Progress through this chapter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span id="expedition-progress-fill"></span></div>
      </section>`;
    container.querySelectorAll<HTMLElement>('[id]').forEach(element => this.elements.set(element.id, element));
    this.lensButtons = Array.from(container.querySelectorAll<HTMLButtonElement>('[data-expedition-lens]'));
    this.lensButtons.forEach(button => button.addEventListener('click', () => actions.setLens(button.dataset.expeditionLens as ExpeditionLens)));
    this.element('expedition-start').addEventListener('click', () => actions.start());
    this.element('expedition-close').addEventListener('click', () => actions.stop());
    this.element('expedition-previous').addEventListener('click', () => actions.previous());
    this.element('expedition-next').addEventListener('click', () => {
      if (this.state && this.state.index >= this.state.total - 1) actions.stop();
      else actions.next();
    });
    this.element('expedition-auto').addEventListener('click', () => actions.toggleAuto());
    this.element('expedition-focus').addEventListener('click', () => actions.toggleFocus());
  }

  update(state: ExpeditionState): void {
    this.state = state;
    this.container.dataset.active = String(state.active);
    this.container.dataset.mode = state.mode;
    this.container.dataset.focus = String(state.focus);
    this.element('expedition-start').hidden = state.active || state.mode !== 'colony';
    this.element('expedition-story').hidden = !state.active;
    const workerButton = this.element('expedition-worker-lens') as HTMLButtonElement;
    workerButton.disabled = !state.canFollow;
    workerButton.title = state.canFollow ? 'Travel at a worker’s height' : 'Available once the colony has workers';
    this.setText('expedition-evidence', state.mode === 'measured' ? 'RECORDED EXPERIMENT' : 'ILLUSTRATIVE MODEL');
    this.setText('expedition-eyebrow', state.eyebrow);
    this.element('expedition-eyebrow').hidden = !state.eyebrow;
    this.setText('expedition-title', state.title);
    this.setText('expedition-copy', state.copy);
    const total = Math.max(1, Math.floor(state.total));
    const index = Math.max(0, Math.min(total - 1, Math.floor(state.index)));
    this.setText('expedition-count', `${String(index + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}`);
    (this.element('expedition-previous') as HTMLButtonElement).disabled = index === 0;
    this.setText('expedition-next-label', index >= total - 1 ? 'Explore freely' : 'Next chapter');
    const progress = Math.max(0, Math.min(1, Number.isFinite(state.progress) ? state.progress : 0));
    this.element('expedition-progress-fill').style.transform = `scaleX(${progress.toFixed(4)})`;
    const percent = String(Math.round(progress * 100));
    if (this.element('expedition-progress').getAttribute('aria-valuenow') !== percent) this.element('expedition-progress').setAttribute('aria-valuenow', percent);
    this.element('expedition-progress').setAttribute('aria-valuetext', `${percent}% through chapter ${index + 1}`);
    if (this.lastAuto !== state.auto) {
      this.lastAuto = state.auto;
      this.element('expedition-auto-icon').innerHTML = svg(state.auto ? 'pause' : 'play');
      this.setText('expedition-auto-label', state.auto ? 'Autoplay on' : 'Autoplay');
      this.element('expedition-auto').setAttribute('aria-pressed', String(state.auto));
      this.element('expedition-auto').title = state.auto ? 'Pause automatic chapter changes' : 'Advance through the journey automatically';
    }
    if (this.lastFocus !== state.focus) {
      this.lastFocus = state.focus;
      this.element('expedition-focus-icon').innerHTML = svg(state.focus ? 'exit' : 'focus');
      this.setText('expedition-focus-label', state.focus ? 'Exit focus' : 'Focus');
      this.element('expedition-focus').setAttribute('aria-pressed', String(state.focus));
      this.element('expedition-focus').title = state.focus ? 'Show the interface again' : 'Hide the interface and focus on the colony';
    }
  }

  private element(id: string): HTMLElement {
    const element = this.elements.get(id);
    if (!element) throw new Error(`Missing expedition interface element: ${id}`);
    return element;
  }

  private setText(id: string, text: string): void {
    const element = this.element(id);
    if (element.textContent !== text) element.textContent = text;
  }
}
