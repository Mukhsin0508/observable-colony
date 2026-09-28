# Observable Colony

**An ant colony you can step inside—and its invisible communication made visible.**

How does a colony build and organize a home when no individual has the whole plan?

Observable Colony is an interactive **Three.js** experience. Travel from a founding queen to a growing colony, follow one worker, reveal its local scent information, and then inspect excavation measurements from a real experiment.

The experience keeps two things separate:

- **Living colony:** an illustrative, research-informed model of brood development, workers, nest growth, foraging, reproduction and an optional queen-loss scenario.
- **Measured excavation:** archived grain coordinates and removal records from Experiment 1 of a published **Pogonomyrmex occidentalis** study. This is experimental substrate data, not a replay of tracked ants or a colony's full life.

## Start exploring

Select **Take a guided journey** for an eleven-chapter introduction lasting about two minutes with autoplay. Chapters visit authored points in model time and end with the recorded excavation. Leave the journey at any time to explore freely.

- **Watch the colony develop.** Eggs become larvae, pupae and adults. Later stages introduce winged reproductives and an optional queen-loss scenario.
- **Travel with a worker.** Surface and Inside worker views show its local scent samples, deposition state and nearby-worker count, taken directly from the running model.
- **Reveal communication.** Mint-colored points show the modeled scent field. Returning food carriers deposit scent; searching workers respond to local samples and continue exploring.
- **Move the food.** Workers must discover the new source nearby while the old scent trail fades. Moving food during the tour holds the chapter so you can watch the response.
- **Inspect the nest.** Visit the queen, orbit the cutaway, select a worker, or switch to Focus mode for an unobstructed scene.
- **Browse the evidence.** The measured view contains 52 archived scan-sequence frames and 5,174 image-derived grain removals.

The scene draws at most **110 representative workers** and a limited brood sample. Population counts come from a separate seeded cohort model; the rendered ants are not a one-to-one census of every modeled adult.

## Run locally

Use **Node.js 22.12 or newer**, npm, and a browser with WebGL support.

```sh
git clone https://github.com/Mukhsin0508/observable-colony.git
cd observable-colony
npm ci
npm run dev
```

Open the local address printed by Vite. To use the development preview address shown in the project demos:

```sh
npm run dev -- --port 5180 --strictPort
```

The local application runs in the browser with no account, API key or backend. The hosted Higgsfield URL currently requires platform sign-in; see Deployment below.

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the local Vite development server |
| `npm test` | Run the lifecycle, movement, tour and dataset validation tests |
| `npm run build` | Type-check the project and create the production bundle in `dist/` |
| `npm run preview` | Preview an existing production build locally |

GitHub Actions runs `npm ci`, `npm test` and `npm run build` on pushes and pull requests.

## Controls

| Control | What it does |
| --- | --- |
| **Take a guided journey** | Start the eleven-chapter tour |
| **Autoplay**, **Previous chapter**, **Next chapter** | Play or browse the guided story |
| **Surface**, **Inside worker**, **Queen**, **Nest** | Change the camera and subject |
| **Cutaway**, **Orbit**, **Follow ant** | Explore the colony with the main camera controls |
| Click or tap an ant | Select that worker for inspection |
| **Reveal communication** | Show or hide the model's scent field |
| **Move food** | Relocate the model food source |
| **Queen loss** / **Restore queen** | Stop or resume egg laying in a counterfactual scenario |
| **Focus** / **Exit focus** | Hide or restore the surrounding interface |
| Playback controls | Pause, change speed or restart |
| **Space** | Pause or resume when a form control is not focused |
| **← / →** | Browse guided chapters when a form control is not focused |
| **Escape** | Leave the journey and Focus mode; close the research dialog when open |
| Measured-view scan slider and arrows | Browse the archived excavation sequence |

Selecting a lifecycle stage outside the guided journey pauses at that point. Devices requesting reduced motion start paused, with guided autoplay off. The Inside worker camera is an explanatory view, not a reconstruction of ant vision. Surface scent sensors are inactive underground.

## Measured excavation and attribution

The measured view uses Experiment 1 from **Buarque de Macedo et al. (2021), _Unearthing real-time 3D ant tunneling mechanics_**. The study used western harvester ants, **Pogonomyrmex occidentalis**, and repeated X-ray computed tomography of their excavation.

[PNAS paper](https://doi.org/10.1073/pnas.2102267118) · [CaltechDATA archive](https://doi.org/10.22002/D1.1996) · [Data provenance and conversion notes](docs/measured-data.md)

The dataset authors are Robert Buarque de Macedo, Edward Ando, Shilpa Joy, Gioacchino Viggiani, Raj Kumar Pal, Joseph Parker and Jose Andrade. CaltechDATA releases the archive under **CC0**. That dedication applies to the dataset; it does not change the separate license of the paper or its figures. No paper figures or CT movies are bundled here.

The browser subset includes **12,329 grain-centroid points** across **52 scan-sequence frames**. All **5,174 removed grains** are retained; never-removed context is thinned for performance. Bright points identify removals assigned to the selected scan, while earlier removals remain visible.

Coordinates retain the source voxel units. Scan numbers indicate observation order; exact timestamps and a physical length conversion have not been established for these input files. Point sizes, colors and display scale are illustrative. The view does not reconstruct grain surfaces, individual removal instants or ant trajectories.

To rebuild the included JSON from the archive, use Python 3 and curl:

```sh
python3 scripts/extract-measured-data.py --download
```

The extractor retrieves selected ZIP members with HTTP range requests, verifies their checksums and applies the documented filtering. See the [conversion notes](docs/measured-data.md) for the full contract and reproducibility details.

## Scientific boundaries

The living colony is framed around **P. occidentalis**, but its timing, population rates, anatomy, worker roles, nest geometry and movement rules are authored simplifications. Some behavioral concepts come from other species and are identified in the research notes. The lifecycle has not been fitted to the excavation experiment.

The model has actual state changes: brood cohorts mature, workers appear and age out, digging advances passages, and scent affects surface steering. The displayed sensor readings are live values from that model. They are not measured chemical concentrations or decoded ant messages. Underground route traces do not steer underground movement; navigation uses a simplified tunnel graph and return paths. Nearby-worker counts do not regulate excavation, and food collection does not determine demographic rates.

**Queen loss** is an optional intervention, not a predicted natural lifespan. **Restore queen** is a counterfactual control, not a natural replacement mechanism. Guided chapters jump between authored states rather than replaying one continuously observed life.

This is an interactive explanation with a separately labeled experimental data view, not a validated digital twin. The next scientific step is to calibrate one narrowly defined mechanism against an experimental setting and compare repeated seeded runs with its measurements.

- [Research overview and primary sources](docs/research.md)
- [Lifecycle evidence, parameters and omissions](docs/lifecycle.md)
- [Measured-data provenance and processing](docs/measured-data.md)

## Project map

| Path | Responsibility |
| --- | --- |
| `src/main.ts` | Connect the model, views, controls and animation loop |
| `src/lifecycle.ts` | Seeded brood and adult cohort model |
| `src/simulation.ts` | Worker movement, scent, food and procedural excavation |
| `src/scene.ts` | Three.js scene, cameras and rendering |
| `src/worker-anatomy.ts`, `src/biology.ts` | Representative ants, queen and brood geometry |
| `src/expedition.ts`, `src/expedition-ui.ts` | Guided story and chapter playback |
| `src/perception-ui.ts` | Selected worker's live local sensor readings |
| `src/study.ts`, `src/measured-view.ts` | Load, validate and render archived excavation data |
| `src/ui.ts`, `src/journey-ui.ts` | Main controls, lifecycle stages and evidence panels |
| `public/data/excavation.json` | Processed, attributed experimental subset |
| `scripts/extract-measured-data.py` | Reproducible archive extraction |
| `docs/` | Research evidence and model limitations |

Built with **Three.js, TypeScript and Vite**. Tests use **Vitest**.

## Deployment

The app is hosted on **Higgsfield Supercomputer** at [observable-colony.higgsfield.app](https://observable-colony.higgsfield.app).

**Hosted access:** Higgsfield reported a successful deployment on September 29, 2026. An unauthenticated browser is redirected to Higgsfield sign-in, and unauthenticated asset/API requests return HTTP 401. This access gate belongs to the hosting platform; the colony itself has no login flow. Authenticated live interaction checks remain unverified. The site is not listed on the community feed.

- **Source of truth:** this GitHub repository.
- **Higgsfield website ID:** `ea896f71-8737-4f21-b26d-b3fbc96b4153`.
- **Runtime:** one Higgsfield Cloudflare Worker with a TanStack Start shell. The original Three.js/Vite bundle runs directly in the page after hydration.
- **Data:** the excavation JSON ships as a static asset. Database, storage, accounts and API keys are not required.
- **Version:** [`/version.json`](https://observable-colony.higgsfield.app/version.json) reports the source commit and bundled entry files.

A GitHub push does **not** redeploy Higgsfield automatically. To ship an update:

1. Push the intended source revision to GitHub and check its CI result.
2. With the Higgsfield MCP connection, call `website_repo_access` with `operation: "checkout"` and the website ID above. Retain its returned checkout path.
3. In `sandbox_exec`, clone or update this public source repository to the intended commit. Use Node 22.12+ and Bun for the hosting scaffold. Run from the source checkout:

   ```sh
   npm ci
   npm test
   npm run build -- --base=/colony/
   python3 deploy/higgsfield/package.py --target "$HIGGSFIELD_CHECKOUT"
   ```

   Set `HIGGSFIELD_CHECKOUT` to the path returned by the checkout tool. The packager copies the production assets, dataset and favicon; installs the hosting routes; and writes the source version manifest. It preserves the platform's share-image metadata and infrastructure configuration.

4. From `"$HIGGSFIELD_CHECKOUT/app"`, run `bun install --frozen-lockfile` and `bun run typecheck`. Commit the changes in the Higgsfield checkout.
5. Call `website_repo_access` with `operation: "push"`, then `deploy_website`. Use `website_status` if deployment is pending.
6. Verify the public page, guided journey, measured excavation, and `/version.json` before reporting the new version as live.

The deployment adapters are in [`deploy/higgsfield/`](deploy/higgsfield/). Keep the website's checkout lease active while editing, and push before it expires. Repository credentials stay inside the Higgsfield service. Listing the site on the community feed is a separate publishing action.

For another static host, run `npm run build` without the Higgsfield base override and serve `dist/`.
