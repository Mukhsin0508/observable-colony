export type Vec3 = { x: number; y: number; z: number };
export type Role = 'excavator' | 'forager' | 'nurse';
export type AntState = 'exploring' | 'digging' | 'carrying soil' | 'seeking food' | 'carrying food' | 'tending brood';
export interface NestNode { id: number; position: Vec3; radius: number; kind: 'entrance' | 'chamber' | 'junction'; }
export interface Tunnel { id: number; from: number; to: number; progress: number; pheromone: number; traffic: number; }
export interface Ant { id: number; role: Role; state: AntState; position: Vec3; heading: Vec3; carrying: boolean; tunnelId: number | null; }
export interface ColonyStats { elapsed: number; excavated: number; foodCollected: number; contacts: number; activeDiggers: number; }
export interface SurfaceTrail { position: Vec3; intensity: number; }
export interface ColonySnapshot { nodes: NestNode[]; tunnels: Tunnel[]; ants: Ant[]; food: Vec3; surfaceTrails: SurfaceTrail[]; stats: ColonyStats; events: string[]; seed: number; }
export type ViewMode = 'cutaway' | 'orbit' | 'follow' | 'queen' | 'surface' | 'immersive';
export interface UIState { paused: boolean; speed: number; signals: boolean; view: ViewMode; selectedAnt: number | null; guided?: boolean; }
export interface UIActions { togglePause(): void; setSpeed(speed: number): void; toggleSignals(): void; setView(view: ViewMode): void; reset(): void; moveFood(): void; selectAnt(): void; }
