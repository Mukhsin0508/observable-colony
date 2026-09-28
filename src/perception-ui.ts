import type { Ant } from './types';

interface LocalReading { ahead: number; left: number; right: number; depositing: boolean; localNeighbors: number; }

/** Presents the values the movement model actually samples, not biological measurements. */
export class PerceptionUI {
  private readonly panel: HTMLElement;
  private readonly worker: HTMLElement;
  private readonly action: HTMLElement;
  private readonly note: HTMLElement;
  private readonly neighbors: HTMLElement;
  private readonly meters: HTMLProgressElement[];
  private readonly foodButton: HTMLButtonElement;
  private readonly feedback: HTMLElement;
  constructor(container: HTMLElement, moveFood: () => void) {
    const panel = document.createElement('aside');
    panel.className = 'perception-panel'; panel.hidden = true;
    panel.setAttribute('aria-label', 'Selected worker local senses');
    panel.innerHTML = `<p class="perception-eyebrow">ONE WORKER’S WORLD</p><h2 data-sense-worker></h2><p data-sense-action></p>
      <div class="sense-readings" aria-label="Model scent sensor readings"><label>Left<progress max="1" value="0"></progress></label><label>Ahead<progress max="1" value="0"></progress></label><label>Right<progress max="1" value="0"></progress></label></div>
      <p class="sense-note" data-sense-note></p><div class="sense-neighbors"><strong data-sense-neighbors>0</strong><span>workers nearby</span></div>
      <button type="button" class="sense-food">Move the food <span aria-hidden="true">↗</span></button><p class="sense-feedback" aria-live="polite"></p>
      <small>Live values from the illustrative movement model. Scent strength uses a relative 0–1 scale.</small>`;
    container.append(panel); this.panel = panel;
    this.worker = panel.querySelector('[data-sense-worker]')!;
    this.action = panel.querySelector('[data-sense-action]')!;
    this.note = panel.querySelector('[data-sense-note]')!;
    this.neighbors = panel.querySelector('[data-sense-neighbors]')!;
    this.meters = Array.from(panel.querySelectorAll('progress'));
    this.foodButton = panel.querySelector('button')!;
    this.feedback = panel.querySelector('.sense-feedback')!;
    this.foodButton.addEventListener('click', () => { moveFood(); this.feedback.textContent = 'Food moved. The old scent remains until it fades.'; });
  }
  clearFeedback(): void { this.feedback.textContent = ''; }
  update(ant: Ant | undefined, reading: LocalReading | null, visible: boolean): void {
    this.panel.hidden = !visible || !ant || !reading;
    if (!ant || !reading || !visible) { this.feedback.textContent = ''; return; }
    this.worker.textContent = `Worker ${String(ant.id).padStart(3, '0')}`;
    this.action.textContent = `${ant.role} · ${ant.state}`;
    [reading.left, reading.ahead, reading.right].forEach((value, i) => {
      const meter = this.meters[i]!;
      meter.value = value; meter.setAttribute('aria-label', `${['Left', 'Ahead', 'Right'][i]} scent ${Math.round(value * 100)} percent`);
    });
    this.note.textContent = reading.depositing ? 'Laying scent on the return trip.' : ant.position.y >= 0.2 ? 'Three nearby samples guide the search.' : 'Underground. Surface scent sensors are inactive.';
    this.neighbors.textContent = String(reading.localNeighbors);
  }
}
