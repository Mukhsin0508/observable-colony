/**
 * An illustrative P. occidentalis life-history scenario, not a calibrated demographic model.
 * All clock values and demographic rates below are authored parameters; see docs/lifecycle.md.
 */
export type LifecycleStageId = 'founding' | 'eggs' | 'larvae' | 'pupae' | 'first-workers' | 'growth' | 'maturity' | 'reproduction' | 'decline';
export interface LifecycleStage {
  id: LifecycleStageId;
  title: string;
  description: string;
  /** Authored scenario day, not a measured species-wide developmental date. */
  day: number;
  evidence: 'modeled';
}
export interface LifecycleSnapshot {
  day: number;
  phase: LifecycleStageId;
  queenAlive: boolean;
  eggs: number;
  larvae: number;
  pupae: number;
  workers: number;
  alates: number;
  events: string[];
  totalBorn: number;
  totalDied: number;
  departedAlates: number;
  seed: number;
  timeLabel: string;
  calibration: 'illustrative';
}

export const LIFECYCLE_STAGES: readonly LifecycleStage[] = [
  { id: 'founding', title: 'One queen', day: 0, evidence: 'modeled', description: 'A mated queen starts a new nest. There are no workers yet.' },
  { id: 'eggs', title: 'First eggs', day: 3, evidence: 'modeled', description: 'The first brood begins as eggs, cared for by the founding queen.' },
  { id: 'larvae', title: 'Larvae', day: 17, evidence: 'modeled', description: 'Larvae grow through feeding and care. They cannot perform worker tasks.' },
  { id: 'pupae', title: 'Transformation', day: 37, evidence: 'modeled', description: 'Inside the pupal stage, the larval body develops into the adult form.' },
  { id: 'first-workers', title: 'First workers', day: 60, evidence: 'modeled', description: 'The first adult workers begin sharing the work of the nest.' },
  { id: 'growth', title: 'A growing colony', day: 365, evidence: 'modeled', description: 'Overlapping generations forage, tend brood and expand the nest.' },
  { id: 'maturity', title: 'Maturity', day: 3650, evidence: 'modeled', description: 'In this illustrative scenario, an established colony begins investing in winged reproductives. Real maturity varies.' },
  { id: 'reproduction', title: 'The next generation', day: 3710, evidence: 'modeled', description: 'Winged reproductives emerge. Mating and successful founding are not guaranteed.' },
  { id: 'decline', title: 'After queen loss', day: 4075, evidence: 'modeled', description: 'An optional intervention removes the queen. Existing brood may mature, but new worker brood is no longer laid in this model.' },
];

export const LIFECYCLE_PARAMETERS = Object.freeze({
  firstEggDay: 3,
  foundingClutch: 12,
  eggDays: 14,
  larvaDays: 20,
  pupaDays: 23,
  modeledMaturityDay: 3650,
  reproductiveWorkerThreshold: 1200,
  carryingCapacity: 12000,
  maximumDay: 365 * 60,
  evidence: 'illustrative' as const,
});

type BroodStage = 'egg' | 'larva' | 'pupa';
type Fate = 'worker' | 'alate';
interface BroodCohort { stage: BroodStage; count: number; transitionDay: number; fate: Fate; }
interface AdultCohort { count: number; exitDay: number; fate: Fate; }

/** Pure deterministic cohort model. No timers, browser objects, rendering or network access. */
export class ColonyLifecycle {
  private readonly seed: number;
  private randomState: number;
  private day = 0;
  private fraction = 0;
  private queenAlive = true;
  private brood: BroodCohort[] = [];
  private adults: AdultCohort[] = [];
  private layingCredit = 0;
  private totalBorn = 0;
  private totalDied = 0;
  private departedAlates = 0;
  private events: string[] = [];
  private seen = new Set<string>();

  constructor(seed = 1709) {
    this.seed = seed >>> 0;
    this.randomState = this.seed;
    this.reset();
  }

  reset(): void {
    this.randomState = this.seed;
    this.day = 0;
    this.fraction = 0;
    this.queenAlive = true;
    this.brood = [];
    this.adults = [];
    this.layingCredit = 0;
    this.totalBorn = 0;
    this.totalDied = 0;
    this.departedAlates = 0;
    this.events = ['A single mated queen begins the illustrative journey.'];
    this.seen = new Set(['founding']);
  }

  /** Fractional days accumulate; demography advances in reproducible one-day steps. */
  step(days: number): void {
    if (!Number.isFinite(days) || days < 0) throw new RangeError('Lifecycle time must be a finite, non-negative number of model days.');
    this.fraction = Math.min(this.fraction + days, LIFECYCLE_PARAMETERS.maximumDay - this.day);
    while (this.fraction + 1e-9 >= 1) {
      this.fraction -= 1;
      this.advanceDay();
    }
    this.fraction = Math.max(0, this.fraction);
  }

  /** Rebuild the same seeded scenario at a waypoint. Seeking does not preserve interventions. */
  seek(stageId: string): void {
    const stage = LIFECYCLE_STAGES.find(item => item.id === stageId);
    if (!stage) throw new RangeError(`Unknown lifecycle stage: ${stageId}`);
    this.reset();
    if (stage.id === 'decline') {
      const interventionDay = LIFECYCLE_STAGES.find(item => item.id === 'reproduction')!.day;
      this.step(interventionDay);
      this.setQueenAlive(false);
      this.step(stage.day - interventionDay);
    } else this.step(stage.day);
  }

  /** An intervention, never a prediction of the species' natural queen lifespan. */
  setQueenAlive(alive: boolean): void {
    if (this.queenAlive === alive) return;
    this.queenAlive = alive;
    this.layingCredit = 0;
    this.record(alive
      ? 'Queen restored as a counterfactual control; natural queen replacement is not simulated.'
      : 'Queen-loss intervention: no new eggs will be laid. Existing brood can still mature while workers remain.');
    if (alive && this.day >= LIFECYCLE_PARAMETERS.firstEggDay && this.counts().workers === 0 && this.brood.length === 0) {
      this.lay(LIFECYCLE_PARAMETERS.foundingClutch, 'worker');
      this.record('A new illustrative founding clutch begins after queen restoration.');
    }
  }

  snapshot(): LifecycleSnapshot {
    const count = this.counts();
    const day = this.day + this.fraction;
    return {
      day, phase: this.phase(count), queenAlive: this.queenAlive, ...count,
      events: [...this.events], totalBorn: this.totalBorn, totalDied: this.totalDied,
      departedAlates: this.departedAlates, seed: this.seed, calibration: 'illustrative',
      timeLabel: day < 365 ? `Model day ${Math.floor(day)}` : `Model year ${(day / 365).toFixed(1)}`,
    };
  }

  private counts(): Pick<LifecycleSnapshot, 'eggs' | 'larvae' | 'pupae' | 'workers' | 'alates'> {
    const count = { eggs: 0, larvae: 0, pupae: 0, workers: 0, alates: 0 };
    for (const cohort of this.brood) {
      if (cohort.stage === 'egg') count.eggs += cohort.count;
      else if (cohort.stage === 'larva') count.larvae += cohort.count;
      else count.pupae += cohort.count;
    }
    for (const cohort of this.adults) {
      if (cohort.fate === 'worker') count.workers += cohort.count;
      else count.alates += cohort.count;
    }
    return count;
  }

  private phase(count: ReturnType<ColonyLifecycle['counts']>): LifecycleStageId {
    if (!this.queenAlive) return 'decline';
    if (this.day >= LIFECYCLE_PARAMETERS.modeledMaturityDay && count.alates > 0) return 'reproduction';
    if (this.day >= LIFECYCLE_PARAMETERS.modeledMaturityDay) return 'maturity';
    if (this.day >= 365 && count.workers > 0) return 'growth';
    if (count.workers > 0) return 'first-workers';
    if (count.pupae > 0) return 'pupae';
    if (count.larvae > 0) return 'larvae';
    if (count.eggs > 0) return 'eggs';
    return 'founding';
  }

  private advanceDay(): void {
    this.day++;
    const before = this.counts();
    const survivingAdults: AdultCohort[] = [];
    for (const cohort of this.adults) {
      if (cohort.exitDay > this.day) survivingAdults.push(cohort);
      else if (cohort.fate === 'worker') this.totalDied += cohort.count;
      else this.departedAlates += cohort.count;
    }
    this.adults = survivingAdults;
    const survivingBrood: BroodCohort[] = [];
    for (const cohort of this.brood) {
      if (!this.queenAlive && before.workers === 0) { this.totalDied += cohort.count; continue; }
      if (cohort.transitionDay > this.day) { survivingBrood.push(cohort); continue; }
      // Transition survival is authored; it illustrates attrition without fitted field rates.
      const lost = this.rounded(cohort.count * (cohort.stage === 'larva' ? 0.08 : 0.04));
      cohort.count = Math.max(0, cohort.count - lost);
      this.totalDied += lost;
      if (!cohort.count) continue;
      if (cohort.stage === 'egg') {
        survivingBrood.push({ ...cohort, stage: 'larva', transitionDay: this.day + LIFECYCLE_PARAMETERS.larvaDays });
        this.once('larvae', 'The first larvae hatch. They depend on care and feeding.');
      } else if (cohort.stage === 'larva') {
        survivingBrood.push({ ...cohort, stage: 'pupa', transitionDay: this.day + LIFECYCLE_PARAMETERS.pupaDays });
        this.once('pupae', 'The first brood enters the pupal stage.');
      } else {
        const residence = cohort.fate === 'worker' ? 300 + Math.floor(this.random() * 361) : 30;
        this.adults.push({ count: cohort.count, fate: cohort.fate, exitDay: this.day + residence });
        this.totalBorn += cohort.count;
        if (cohort.fate === 'worker') this.once('workers', 'The first workers emerge. Nest work is no longer carried by the queen alone.');
        else this.once('alates', 'Winged reproductives emerge: a possible next generation, not a guaranteed new colony.');
      }
    }
    this.brood = survivingBrood;
    if (this.queenAlive) {
      if (this.day === LIFECYCLE_PARAMETERS.firstEggDay) {
        this.lay(LIFECYCLE_PARAMETERS.foundingClutch, 'worker');
        this.once('eggs', 'The founding queen lays the first clutch of eggs.');
      } else {
        const workers = this.counts().workers;
        if (workers > 0) {
          const availableCapacity = Math.max(0, 1 - workers / LIFECYCLE_PARAMETERS.carryingCapacity);
          this.layingCredit += Math.min(120, (0.22 + workers * 0.015) * availableCapacity);
          const clutch = Math.floor(this.layingCredit);
          this.layingCredit -= clutch;
          if (clutch > 0) {
            const canReproduce = this.day >= LIFECYCLE_PARAMETERS.modeledMaturityDay && workers >= LIFECYCLE_PARAMETERS.reproductiveWorkerThreshold;
            const alates = canReproduce ? Math.min(clutch, this.rounded(clutch * 0.18)) : 0;
            this.lay(clutch - alates, 'worker');
            this.lay(alates, 'alate');
          }
        }
      }
    }
    if (this.day === 365) this.once('growth', 'Generations now overlap. Colony size reflects births and losses.');
    if (this.day === LIFECYCLE_PARAMETERS.modeledMaturityDay) this.once('maturity', 'The scenario reaches its authored reproductive waypoint. Real colonies mature at variable ages and sizes.');
    if (!this.queenAlive && this.counts().workers === 0 && this.brood.length === 0) this.once('end', 'No workers or developing brood remain in this queen-loss scenario.');
  }

  private lay(count: number, fate: Fate): void {
    if (count <= 0) return;
    this.brood.push({ stage: 'egg', count, fate, transitionDay: this.day + LIFECYCLE_PARAMETERS.eggDays });
  }
  private record(event: string): void { this.events = [event, ...this.events].slice(0, 6); }
  private once(key: string, event: string): void { if (!this.seen.has(key)) { this.seen.add(key); this.record(event); } }
  private rounded(value: number): number { const floor = Math.floor(value); return floor + (this.random() < value - floor ? 1 : 0); }
  private random(): number {
    this.randomState += 0x6d2b79f5;
    let value = this.randomState;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  }
}
