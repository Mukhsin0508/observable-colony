# Observable Colony

**An ant colony you can step inside—and its invisible communication made visible.**

How does a colony build and organize a home when no individual has the whole plan?

Observable Colony is an interactive **Three.js** experience with two distinct views:

- **Living colony:** begin with one queen and no workers. Follow eggs through larvae and pupae into the first workforce, then explore growth, winged reproductives and an optional queen-loss scenario. This is an illustrative, research-informed model.
- **Measured excavation:** inspect grain coordinates and the recorded removal sequence from Experiment 1 of a published **Pogonomyrmex occidentalis** excavation study. This view uses archived experimental data, not the lifecycle simulation.

## Run locally

Use Node.js 22.12 or newer.

```sh
npm install
npm run dev
```

Open the local address printed by Vite. The application runs in the browser; no account, API key or backend is required.

```sh
npm run build   # Type-check and build the production bundle
npm test        # Run model and data validation tests
npm run preview
```

## Explore the living colony

- Start **Take a guided journey** for an eleven-chapter introduction, from the founding queen to the recorded excavation. Use **Autoplay**, **Next chapter** and **Previous chapter**, or leave the journey to explore freely. Guided chapters jump to authored points in model time; they do not depict a continuous, observed lifetime.
- Outside the guided journey, choose a lifecycle chapter from founding to the next generation, or play through model time.
- Visit the queen and see a representative sample of developing brood.
- Switch between **Surface**, **Inside worker**, **Queen** and **Nest** views, follow a selected worker, or orbit around the colony. The worker camera explains movement; it does not reconstruct ant vision.
- In Surface and Inside worker views, inspect the selected worker's actual local scent samples, scent deposition state and nearby-worker count. Surface scent sensors are inactive underground. These are live values from the illustrative model, not measured biology or decoded messages.
- Reveal the surface pheromone field. Returning food carriers deposit scent; searching ants steer from local samples while continuing to explore.
- Move the food. Ants are not told its new location: they must discover it nearby, while the old trail fades.
- Apply **Queen loss** to stop new egg laying, then watch existing brood and worker cohorts change. **Restore queen** is a counterfactual control, not a natural replacement mechanism.
- Use **Focus** to hide the surrounding interface while keeping an exit available.
- Pause, accelerate or restart. Selecting a lifecycle chapter outside the guided journey pauses at that point. Devices requesting reduced motion start paused, with guided autoplay off.

Population counts come from a seeded cohort model. The scene draws at most **110 representative workers** and a limited brood sample, so a modeled colony with thousands of ants stays usable on a laptop or phone. These drawn ants are not a one-to-one record of every modeled adult.

## Inspect the recorded excavation

Switch to **Measured excavation**, then use the scan slider, previous/next buttons or playback. Orbit to inspect the spatial pattern. The included Experiment 1 sequence contains **52 scan-sequence frames** and **5,174 image-derived grain removals**. Every removed grain is included; retained-grain context is thinned for browser performance.

Dots show grain centroids from the initial image-derived coordinates. Their sizes, colors and display scale are illustrative; they are not reconstructed grain surfaces. The bright points identify removals assigned to the selected scan, while earlier removals remain visible. Scan playback is a presentation of discrete observations, not a recording of individual ants, their decisions, or a colony's lifetime.

The underlying CaltechDATA archive is released under **CC0**. See the [data provenance and conversion notes](docs/measured-data.md) for the source, units, chronology and processing boundaries.

## What the science means here

The lifecycle is framed around the western harvester ant, **Pogonomyrmex occidentalis**. Its stage durations, population rates, nest geometry and individual behavior remain authored simplifications. They have not been fitted to the archived excavation experiment. Some behavior concepts come from studies of other species and are identified as such in the notes.

The model has real state changes: brood cohorts mature, workers appear and age out, digging advances passages, and deposited scent affects surface steering. That makes it an interactive explanation; it does not make it a validated digital twin. Global return paths and simplified homing remain engineering conveniences. Contacts are proximity counts and do not control excavation. Queen loss is an intervention, never a predicted natural lifespan.

Read the [research overview](docs/research.md), [lifecycle evidence and parameters](docs/lifecycle.md), and [measured-data notes](docs/measured-data.md). The next scientific step is to calibrate a narrowly defined mechanism against one experimental setting and compare repeated seeded runs with its measurements.

Built with **Three.js, TypeScript and Vite**, with separate lifecycle, movement, rendering and archive-loading modules.
