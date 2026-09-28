import type { LifecycleStageId } from './lifecycle';
import type { ViewMode } from './types';

export interface Chapter {
  title: string;
  copy: string;
  stage: LifecycleStageId;
  view: ViewMode;
  mode: 'colony' | 'measured';
}

/** Authored teaching sequence. Chapter jumps are not continuous observed time. */
export const CHAPTERS: readonly Chapter[] = [
  { title: 'A city begins with one.', copy: 'A mated queen begins a nest. No workers. No architect. This first chamber is an illustration of the start of a colony.', stage: 'founding', view: 'queen', mode: 'colony' },
  { title: 'The first generation is waiting.', copy: 'The founding queen cares for her first eggs. The pale shapes are a sample of the brood counted by our lifecycle model.', stage: 'eggs', view: 'queen', mode: 'colony' },
  { title: 'Growing before working.', copy: 'Larvae depend on care. Then comes the pupal stage: a transformation before the adult worker can join the colony.', stage: 'larvae', view: 'queen', mode: 'colony' },
  { title: 'A different body takes shape.', copy: 'During the pupal stage, the larval body develops into the adult form. In this scenario, these pupae become the colony’s first workers.', stage: 'pupae', view: 'queen', mode: 'colony' },
  { title: 'Now there are many hands.', copy: 'The first workers share the work. Each drawn ant has its own task and position; the colony is not controlled by a single worker.', stage: 'first-workers', view: 'queen', mode: 'colony' },
  { title: 'A home grows at its edges.', copy: 'In this model, excavators reach a tunnel front, remove material and carry it out. The passages expand as they work.', stage: 'growth', view: 'cutaway', mode: 'colony' },
  { title: 'Make the invisible visible.', copy: 'Mint reveals the modeled scent field. Returning foragers reinforce it; searching workers sample nearby scent. Move the food to watch a trail lose its usefulness.', stage: 'growth', view: 'surface', mode: 'colony' },
  { title: 'Travel with one worker.', copy: 'You are following one worker at ground level. Its local readings appear beside the scene. The camera is an explanatory view, not a reconstruction of ant vision.', stage: 'growth', view: 'immersive', mode: 'colony' },
  { title: 'The next generation can leave.', copy: 'An established colony produces winged reproductives in this scenario. Their appearance is a stage of the model, not a guarantee of mating or a new nest.', stage: 'reproduction', view: 'queen', mode: 'colony' },
  { title: 'What happens after queen loss?', copy: 'This optional scenario stops new eggs. Existing brood can mature and surviving workers continue. As cohorts age out, the colony declines.', stage: 'decline', view: 'cutaway', mode: 'colony' },
  { title: 'Now, the recorded experiment.', copy: 'These are archived grain positions and removal records: 52 stages and 5,174 removals. This measured excavation is separate from the illustrative colony you explored.', stage: 'growth', view: 'orbit', mode: 'measured' },
];

export class Expedition {
  active = false;
  auto = false;
  index = 0;
  elapsed = 0;
  readonly secondsPerChapter = 11;
  get chapter(): Chapter { return CHAPTERS[this.index]!; }
  get progress(): number { return Math.min(1, this.elapsed / this.secondsPerChapter); }
  start(autoplay = true): void { this.active = true; this.auto = autoplay; this.index = 0; this.elapsed = 0; }
  stop(): void { this.active = false; this.auto = false; }
  seek(index: number): boolean {
    const next = Math.max(0, Math.min(CHAPTERS.length - 1, Math.floor(index)));
    if (!Number.isFinite(next)) return false;
    const changed = this.index !== next;
    this.index = next; this.elapsed = 0;
    return changed;
  }
  /** Returns true only when the caller needs to apply a new chapter. */
  step(seconds: number, paused: boolean): boolean {
    if (!this.active || !this.auto || paused || !Number.isFinite(seconds) || seconds <= 0) return false;
    this.elapsed += seconds;
    if (this.elapsed < this.secondsPerChapter) return false;
    if (this.index === CHAPTERS.length - 1) { this.elapsed = this.secondsPerChapter; this.auto = false; return false; }
    this.seek(this.index + 1);
    return true;
  }
}
