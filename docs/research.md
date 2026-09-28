# Research overview

Reviewed on 29 September 2026. Observable Colony separates an **illustrative living-colony model** from a **measured excavation view**. The archived excavation does not validate the lifecycle or procedural colony, and the procedural colony is not a replay of tracked ants.

## The measured excavation

**Buarque de Macedo et al. (2021), _Unearthing real-time 3D ant tunneling mechanics_. PNAS 118, e2102267118.**

- Species: **Pogonomyrmex occidentalis**.
- Setting: groups of 15 workers excavating a moist granular substrate, imaged repeatedly with X-ray computed tomography. The study combined measured grain geometry and removal with a mechanical simulation.
- Relevant findings: approximately straight tunnel segments, a preference for smaller grains, and granular arching that reduced forces near the tunnel surface.
- Implemented data view: Experiment 1 initial image-derived grain centroids and scan-assigned removal flags from the authors' CC0 CaltechDATA archive. The processed sequence contains 52 source-sequence frames and 5,174 removals; all removed grains are retained and unchanged context is thinned.
- Boundary: displayed spheres mark centroids; their size and color are illustrative. Scan order resolves a sequence of observations, not a continuous record of each removal action. The view does not contain observed ant trajectories, pheromone measurements, brood histories or the full colony lifecycle. Procedural tunnel growth in the other view does not reproduce the experiment's mechanical solver.

[Paper and DOI](https://doi.org/10.1073/pnas.2102267118) · [Authors' full-text copy](https://mech-meta-lab.engr.tamu.edu/wp-content/uploads/sites/327/2025/04/ants_pnas.pdf) · [Data archive](https://doi.org/10.22002/D1.1996)

The [measured-data notes](measured-data.md) document the selected files, processing, coordinates and chronology. Display playback speed must not be interpreted as an inferred biological rate.

## The living-colony journey

The journey starts with one mated queen and no workers. Cohorts pass through egg, larval and pupal stages before adults emerge. Later chapters show population growth and winged reproductives. Queen loss is a deliberate user intervention; the model does not schedule a natural death age.

The species framing is **P. occidentalis**, but all stage dates and demographic rates are illustrative. Primary field work supports single-queen founding, substantial founding mortality, long-lived colonies and variable reproductive maturity. It does not provide a single universal clock for the interface. For example, Cole and Wiernasz's reproductive study found a size threshold that varied between years, and the authors' longer-term work shows why age alone is insufficient.

[Colony size and reproduction, primary paper](https://link.springer.com/article/10.1007/PL00001711) · [Ontogeny study, authors' full text](https://harvester-ants.com/wp-content/uploads/2023/10/wiernasz-cole-2022-proof.pdf)

The [lifecycle notes](lifecycle.md) provide the complete source assessment, numerical parameters, cohort rules and omissions. They also distinguish a modeled successful founding from the much less certain outcome facing a wild queen.

## Behavior concepts drawn from other species

These studies motivate questions and visual explanations. Their findings must not be relabeled as measurements of the P. occidentalis journey.

### Contacts and excavation

**Avinery et al. (2023), _Agitated ants: regulation and self-organization of incipient nest excavation via collisional cues_. Journal of the Royal Society Interface 20, 20220597.**

- Species: **Solenopsis invicta**.
- Setting: excavation of moist glass beads in a thin, quasi-two-dimensional arena.
- Relevant finding: a model using collision history and work/rest behavior reproduced the observed progression of excavation, suggesting a decentralized regulatory mechanism.
- Boundary: the proposed internal agitation variable is a model explanation, not a direct mental-state readout. The paper excludes branch formation and tunnel-width variation. Our model only counts nearby encounters; it does not implement that collision-history mechanism.

[Paper and DOI](https://doi.org/10.1098/rsif.2022.0597) · [Authors' full-text copy](https://crablab.gatech.edu/pages/publications/pdf/ram_interface_2023.pdf) · [Deposited data and code](https://doi.org/10.6084/m9.figshare.22649689.v1)

### Local chemical information and trails

**Perna et al. (2012), _Individual rules for trail pattern formation in Argentine ants (Linepithema humile)_. PLOS Computational Biology 8, e1002592.**

- Species: **Linepithema humile**.
- Setting: exploration of an initially empty arena, with pheromone distribution estimated from trajectories.
- Relevant finding: turns correlated with nearby pheromone differences. A response using relative concentration differences generated collective trails in simulations.
- Boundary: the study did not photograph glowing pheromones. Our three-sensor steering, grid, evaporation rate and food-return deposition are authored approximations. We do not reproduce its fitted response function or measured parameters.

[Open paper](https://journals.plos.org/ploscompbiol/article?id=10.1371/journal.pcbi.1002592) · [Preprint](https://arxiv.org/abs/1201.5827)

### Spatial organization and encounters

**Mersch, Crespi and Keller (2013), _Tracking individuals shows spatial fidelity is a key regulator of ant social organization_. Science 340, 1090–1093.**

- Species: **Camponotus fellah**.
- Setting: tagged workers in six colonies tracked over 41 days.
- Relevant finding: spatial behavior and age were associated with social/task groups and their interaction patterns.
- Boundary: the current role assignments are authored. Brood development and adult cohort turnover in the lifecycle do not implement this paper's age-dependent task transitions. We do not load its tracked animals or reconstruct its social network.

[Paper and DOI](https://doi.org/10.1126/science.1234316) · [Abstract](https://pubmed.ncbi.nlm.nih.gov/23599264/)

## What is observed and what is authored

| Element | Status |
| --- | --- |
| Measured-view grain coordinates and removal assignment | Derived from the Experiment 1 archive; see data provenance |
| Measured-view colors, point sizes and camera | Illustrative display choices |
| Individual ant positions and journeys | Computed movement-model states, not experimental trajectories |
| Beginning of the living journey | An authored founding chamber containing one queen and no workers |
| Brood and adult population counts | Seeded cohort model with illustrative timing and losses |
| Visible workers | Up to 110 representative agents; not a one-to-one adult census |
| Visible queen, eggs, larvae, pupae and alates | Illustrative anatomy and representative samples, not scans |
| Worker roles | Authored assignments, not emergent division of labor |
| Nest branches and chambers in the living view | Procedural geometry subject to space and size constraints |
| Surface pheromones | Deposited grid with evaporation that affects local steering |
| Underground pheromones | Deposited route trace; does not steer underground movement |
| Encounters | Nearby-agent counts with a cooldown; no behavioral regulation |
| Food relocation | Changes a model food source; not a demographic food-supply model |
| Queen loss and restoration | Explicit counterfactual controls, not lifespan or replacement predictions |
| Colony clock | Model days and years without biological calibration |
| Measured-view chronology | Archived scan sequence; no invented timestamps |
| Soil in the living view | Illustration, without grain mechanics or stability calculations |

## Implemented behavior and its limits

Surface search is computed during interaction. Foragers sample scent at three nearby positions, turn toward stronger samples and retain exploratory movement. They detect food by proximity; moving food does not send them a new destination. Food carriers deposit scent while heading toward the known entrance position. This homing shortcut is an assumption, not a reproduced sensory mechanism. The grid evaporates, but does not simulate diffusion, wind or absolute chemical concentrations.

Underground movement uses the procedural tunnel graph. Return paths use shortest-path navigation; exploration chooses connected passages. Digging workers increase a frontier's progress. Newly completed passages can create local branch proposals, subject to bounds, spacing and a maximum of 40 tunnels. That produces changing geometry without a complete prescribed nest blueprint, but it is not a grain-removal mechanics model or a validated account of chamber construction.

The lifecycle operates separately from those movement rules. Its cohorts genuinely mature and age out, while the renderer changes the representative workforce and brood. Food collection, proximity counts and excavation do not currently determine the demographic rates. Jumping chapters regenerates a seeded illustrative state rather than retrieving an observed colony at that age.

“No individual has the whole plan” is the question the experience explores. Neither procedural branching nor the use of a real archive proves a biologically accurate colony-building algorithm. Global navigation shortcuts, worker assignments and authored limits must remain explicit.

## Next scientific step

Choose one experimentally observable mechanism and setting, fit documented parameters, then compare repeated seeded runs with measurements. Keep the existing grain-data view, any future calibrated model and the exploratory lifecycle visibly separate. Reserve “validated digital twin” and “full-life experimental replay” for work that establishes those claims.
