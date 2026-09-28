import { LIFECYCLE_STAGES, type LifecycleSnapshot } from './lifecycle';

export interface JourneyActions {
  setMode(mode: 'colony' | 'measured'): void;
  seekStage(id: string): void;
  seekStudy(index: number): void;
  toggleQueen(): void;
  focusQueen(): void;
}

/** Labels and values must come from the loaded dataset, never simulated counts. */
export interface StudyViewState {
  loaded: boolean;
  index: number;
  frameCount: number;
  label: string;
  timeLabel: string;
  metricLabel: string;
  metricValue: string;
  note: string;
  sourceUrl: string;
  volumeHistory?: number[];
}

const arrow = (direction: 'left' | 'right'): string => `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${direction === 'left' ? 'M19 12H5m5-5-5 5 5 5' : 'M5 12h14m-5-5 5 5-5 5'}"/></svg>`;

/** A small field guide beside the world, plus navigation through model or data. */
export class JourneyUI {
  private readonly elements = new Map<string, HTMLElement>();
  private readonly modeButtons: HTMLButtonElement[];
  private readonly stageButtons: HTMLButtonElement[] = [];
  private readonly studyRange: HTMLInputElement;
  private readonly sourceLink: HTMLAnchorElement;
  private currentStudy: StudyViewState | null = null;
  private lastChartKey = '';

  constructor(private readonly container: HTMLElement, private readonly actions: JourneyActions) {
    container.classList.add('journey-interface');
    container.innerHTML = `
      <nav class="journey-mode-switch" aria-label="Explore the model or measured data">
        <button type="button" data-journey-mode="colony" aria-pressed="true"><span class="journey-mode-dot" aria-hidden="true"></span>Living colony</button>
        <button type="button" data-journey-mode="measured" aria-pressed="false"><svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" aria-hidden="true"><path d="M1 4h14M1 8h14M1 12h14M4 1v14M8 1v14M12 1v14"/></svg>Measured excavation</button>
      </nav>

      <aside class="journey-fieldguide" id="journey-life-panel" aria-label="Colony lifecycle field guide">
        <div class="journey-panel-heading"><p class="journey-eyebrow">ILLUSTRATIVE LIFECYCLE</p><span class="journey-panel-cross" aria-hidden="true">+</span></div>
        <div class="journey-day"><span>MODEL DAY</span><strong id="journey-day">—</strong></div>
        <h2 id="journey-phase-title">A colony begins</h2>
        <p class="journey-phase-copy" id="journey-phase-description"></p>
        <dl class="journey-population">
          <div><dt>Eggs</dt><dd id="journey-eggs">—</dd></div><div><dt>Larvae</dt><dd id="journey-larvae">—</dd></div><div><dt>Pupae</dt><dd id="journey-pupae">—</dd></div><div><dt>Workers</dt><dd id="journey-workers">—</dd></div>
        </dl>
        <div class="journey-queen-line"><span class="journey-queen-dot" id="journey-queen-dot" aria-hidden="true"></span><span id="journey-queen-status">Queen status</span><span id="journey-alates" class="journey-alates" title="Alates are winged reproductive ants"></span></div>
        <div class="journey-queen-actions"><button type="button" id="journey-visit-queen">Visit queen ${arrow('right')}</button><button type="button" id="journey-queen-loss" aria-pressed="false" title="Explore an illustrative queen-loss intervention">Queen loss</button></div>
        <p class="journey-model-note">Brood and visible workers are representative samples; days and population are illustrative.</p>
      </aside>

      <nav class="journey-stages" id="journey-stages" aria-label="Explore the colony lifecycle">
        <div class="journey-stage-caption"><span>THE COLONY’S STORY</span><span>Choose a chapter</span></div>
        <div class="journey-stage-track" id="journey-stage-track"></div>
      </nav>

      <aside class="journey-fieldguide journey-study-panel" id="journey-study-panel" aria-label="Measured excavation study" hidden>
        <div class="journey-panel-heading"><p class="journey-eyebrow">MEASURED / EXPERIMENT</p><span class="journey-panel-cross" aria-hidden="true">+</span></div>
        <h2 id="journey-study-label">Archived excavation</h2>
        <p class="journey-study-status" id="journey-study-status" role="status">Loading archived scans…</p>
        <div class="journey-study-metric"><span id="journey-metric-label">Measured value</span><strong id="journey-metric-value">—</strong></div>
        <figure id="journey-study-chart" class="journey-study-chart" hidden><svg viewBox="0 0 240 55" preserveAspectRatio="none" role="img" aria-label="Measured value across the archived scans"><path id="journey-chart-line" d=""/><circle id="journey-chart-marker" cx="0" cy="0" r="3"/></svg><figcaption>Across the archived scans</figcaption></figure>
        <p class="journey-study-note" id="journey-study-note"></p>
        <a class="journey-source-link" id="journey-study-source" target="_blank" rel="noopener noreferrer" hidden>Source dataset <span aria-hidden="true">↗</span></a>
        <p class="journey-model-note">A measured excavation sequence. This archive does not show the full colony lifecycle.</p>
      </aside>

      <section class="journey-scan-strip" id="journey-scan-strip" aria-label="Browse archived excavation scans" hidden>
        <div class="journey-scan-strip-top"><label for="journey-scan-range">ARCHIVED SCANS <span id="journey-scan-number">—</span></label><span id="journey-scan-time">Waiting for data</span></div>
        <div class="journey-scan-controls"><button type="button" id="journey-previous-scan" aria-label="Previous archived scan" disabled>${arrow('left')}</button><input id="journey-scan-range" type="range" min="0" max="0" value="0" step="1" disabled aria-label="Archived scan"/><button type="button" id="journey-next-scan" aria-label="Next archived scan" disabled>${arrow('right')}</button></div>
      </section>`;

    container.querySelectorAll<HTMLElement>('[id]').forEach(element => this.elements.set(element.id, element));
    this.modeButtons = Array.from(container.querySelectorAll<HTMLButtonElement>('[data-journey-mode]'));
    this.modeButtons.forEach(button => button.addEventListener('click', () => actions.setMode(button.dataset.journeyMode as 'colony' | 'measured')));
    const track = this.element('journey-stage-track');
    // Queen loss is a deliberate intervention, not a fixed age in a natural lifespan.
    LIFECYCLE_STAGES.filter(stage => stage.id !== 'decline').forEach((stage, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.stage = stage.id;
      button.setAttribute('aria-pressed', 'false');
      button.title = `Explore ${stage.title.toLowerCase()} at illustrative model day ${stage.day}`;
      const marker = document.createElement('span');
      marker.className = 'journey-stage-marker';
      marker.setAttribute('aria-hidden', 'true');
      marker.textContent = String(index + 1).padStart(2, '0');
      const label = document.createElement('span');
      label.textContent = stage.title;
      button.append(marker, label);
      button.addEventListener('click', () => actions.seekStage(stage.id));
      this.stageButtons.push(button);
      track.append(button);
    });
    this.element('journey-visit-queen').addEventListener('click', () => actions.focusQueen());
    this.element('journey-queen-loss').addEventListener('click', () => actions.toggleQueen());
    this.studyRange = this.element('journey-scan-range') as HTMLInputElement;
    this.sourceLink = this.element('journey-study-source') as HTMLAnchorElement;
    this.studyRange.addEventListener('input', () => actions.seekStudy(Number(this.studyRange.value)));
    this.element('journey-previous-scan').addEventListener('click', () => this.advanceStudy(-1));
    this.element('journey-next-scan').addEventListener('click', () => this.advanceStudy(1));
  }

  update(life: LifecycleSnapshot, study: StudyViewState, mode: 'colony' | 'measured'): void {
    this.currentStudy = study;
    if (this.container.dataset.mode !== mode) this.container.dataset.mode = mode;
    this.modeButtons.forEach(button => this.setPressed(button, button.dataset.journeyMode === mode));
    this.element('journey-life-panel').hidden = mode !== 'colony';
    this.element('journey-stages').hidden = mode !== 'colony';
    this.element('journey-study-panel').hidden = mode !== 'measured';
    this.element('journey-scan-strip').hidden = mode !== 'measured';

    const stage = LIFECYCLE_STAGES.find(candidate => candidate.id === life.phase);
    this.setText('journey-day', Number.isFinite(life.day) ? life.day.toFixed(life.day < 10 ? 1 : 0) : '—');
    this.setText('journey-phase-title', stage?.title ?? 'Colony development');
    this.setText('journey-phase-description', stage?.description ?? '');
    this.setText('journey-eggs', this.population(life.eggs));
    this.setText('journey-larvae', this.population(life.larvae));
    this.setText('journey-pupae', this.population(life.pupae));
    this.setText('journey-workers', this.population(life.workers));
    this.setText('journey-queen-status', life.queenAlive ? 'Queen present' : 'Queen removed');
    this.setText('journey-alates', life.alates > 0 ? `${this.population(life.alates)} winged ants` : life.departedAlates > 0 ? `${this.population(life.departedAlates)} dispersed` : '');
    this.element('journey-queen-dot').dataset.alive = String(life.queenAlive);
    this.setText('journey-queen-loss', life.queenAlive ? 'Queen loss' : 'Restore queen');
    this.setPressed(this.element('journey-queen-loss'), !life.queenAlive);
    this.element('journey-queen-loss').title = life.queenAlive ? 'Explore an illustrative queen-loss intervention' : 'Restore the queen in this model';
    (this.element('journey-visit-queen') as HTMLButtonElement).disabled = !life.queenAlive;
    this.stageButtons.forEach(button => this.setPressed(button, button.dataset.stage === life.phase));

    const frameCount = Math.max(0, Math.floor(study.frameCount));
    const index = Math.max(0, Math.min(Math.max(0, frameCount - 1), Math.floor(study.index)));
    const hasData = study.loaded && frameCount > 0;
    this.setText('journey-study-label', study.label || 'Archived excavation');
    this.setText('journey-study-status', hasData ? `${frameCount} archived scans · select a scan below` : study.label === 'Archive unavailable' ? 'Archive unavailable' : 'Loading archived scans…');
    this.setText('journey-metric-label', study.metricLabel || 'Measured value');
    this.setText('journey-metric-value', hasData ? study.metricValue || '—' : '—');
    this.setText('journey-study-note', study.note);
    this.setText('journey-scan-number', hasData ? `${index + 1} / ${frameCount}` : '—');
    this.setText('journey-scan-time', hasData ? study.timeLabel : study.label === 'Archive unavailable' ? 'Archive unavailable' : 'Waiting for data');
    this.studyRange.max = String(Math.max(0, frameCount - 1));
    this.studyRange.value = String(index);
    this.studyRange.disabled = !hasData || frameCount < 2;
    this.studyRange.setAttribute('aria-valuetext', hasData ? `Scan ${index + 1} of ${frameCount}, ${study.timeLabel}` : 'Scans not loaded');
    (this.element('journey-previous-scan') as HTMLButtonElement).disabled = !hasData || index <= 0;
    (this.element('journey-next-scan') as HTMLButtonElement).disabled = !hasData || index >= frameCount - 1;
    const safeSource = /^https?:\/\//i.test(study.sourceUrl);
    this.sourceLink.hidden = !safeSource;
    if (safeSource && this.sourceLink.getAttribute('href') !== study.sourceUrl) this.sourceLink.href = study.sourceUrl;
    this.updateChart(hasData ? study.volumeHistory : undefined, index);
  }

  private advanceStudy(delta: number): void {
    if (!this.currentStudy?.loaded) return;
    const next = Math.max(0, Math.min(this.currentStudy.frameCount - 1, this.currentStudy.index + delta));
    if (next !== this.currentStudy.index) this.actions.seekStudy(next);
  }

  private updateChart(values: number[] | undefined, index: number): void {
    const valid = values && values.length > 1 && values.every(Number.isFinite);
    const chart = this.element('journey-study-chart');
    chart.hidden = !valid;
    if (!valid || !values) return;
    const key = `${index}:${values.join(',')}`;
    if (this.lastChartKey === key) return;
    this.lastChartKey = key;
    const low = Math.min(...values);
    const high = Math.max(...values);
    const span = high - low || 1;
    const coordinates = values.map((value, i) => ({ x: 4 + i / (values.length - 1) * 232, y: 49 - (value - low) / span * 43 }));
    const path = this.element('journey-chart-line');
    path.setAttribute('d', coordinates.map((point, i) => `${i === 0 ? 'M' : 'L'}${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' '));
    const point = coordinates[Math.min(index, coordinates.length - 1)];
    const marker = this.element('journey-chart-marker');
    marker.setAttribute('cx', String(point.x));
    marker.setAttribute('cy', String(point.y));
  }

  private population(value: number): string {
    return Number.isFinite(value) ? Math.max(0, Math.floor(value)).toLocaleString('en-US') : '—';
  }

  private setText(id: string, text: string): void {
    const element = this.element(id);
    if (element.textContent !== text) element.textContent = text;
  }

  private setPressed(button: HTMLElement, pressed: boolean): void {
    const value = String(pressed);
    if (button.getAttribute('aria-pressed') !== value) button.setAttribute('aria-pressed', value);
  }

  private element(id: string): HTMLElement {
    const element = this.elements.get(id);
    if (!element) throw new Error(`Missing journey interface element: ${id}`);
    return element;
  }
}
