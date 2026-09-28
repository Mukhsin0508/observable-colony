# Observable Colony

**An ant colony you can step inside—and its invisible communication made visible.**

How does a colony build and organize a home when no individual has the whole plan?

Observable Colony is an interactive Three.js observatory built around that question. Explore a growing nest, follow an individual worker, and reveal the scent trails that guide foragers.

## Run locally

Use Node.js 22.12 or newer.

```sh
npm install
npm run dev
```

Open the local address printed by Vite. The application runs in the browser; no account, API key or backend is required.

```sh
npm run build   # Type-check and build the production bundle
npm test        # Run simulation tests
npm run preview
```

## Explore

- Watch workers excavate and carry material through the nest.
- Switch between a cutaway, an orbiting view and a camera following an ant.
- Reveal the model's surface and underground pheromone trails.
- Relocate food and watch old trails fade as foragers search.
- Pause, accelerate or restart the experiment.

The opening view has already run for six minutes of model time so there is a nest to explore. **Restart colony** returns to the small starter nest. Devices requesting reduced motion start paused; press Play to begin.

Built with **Three.js, TypeScript and Vite**. A seeded simulation runs separately from the renderer. Surface foragers steer using three nearby scent samples and detect food by proximity; returning workers reinforce a decaying trail.

## What the science means here

This first version is a **research-inspired educational model**, combining ideas from studies of different ant species. It is not a quantitative digital twin, a recorded colony, or a reconstruction of an observed nest.

It starts with **65 workers in an existing starter nest**, then extends its passages. It does not yet model a queen founding a colony. Geometry, worker roles and speeds are authored choices. Return navigation uses simplified homing and paths through the known tunnel graph. Encounters are counted, but do not regulate behavior. Glowing pheromones and the clock are visual model values, not biological measurements.

Read the [research notes](docs/research.md) for the papers, the species they studied, and the boundary between their findings and this implementation.

Next: select one species and monitored experiment, calibrate its behavior, and compare repeated simulations with the published measurements.
