# Research notes

Reviewed on 29 September 2026. These are primary research sources. Each supports a specific idea; none validates Observable Colony as a whole.

## 1. Building a tunnel in three dimensions

**Buarque de Macedo et al. (2021), _Unearthing real-time 3D ant tunneling mechanics_. PNAS 118, e2102267118.**

- Species: **Pogonomyrmex occidentalis**.
- Setting: groups of 15 workers excavating a moist granular substrate, imaged repeatedly with X-ray computed tomography. The analysis combines measured grain geometry and removal with a mechanical simulation.
- Finding relevant here: tunnels tended to progress in approximately straight segments; workers showed a preference for smaller grains. Granular arching reduced forces near the tunnel surface, suggesting stability need not require ants to identify the surrounding force network.
- Boundary: these results are not a general blueprint for every species, soil or mature nest. Our procedural tunnels do not reproduce the measured geometry, grain forces or excavation chronology.

[Paper and DOI](https://doi.org/10.1073/pnas.2102267118) · [Authors' full-text copy](https://mech-meta-lab.engr.tamu.edu/wp-content/uploads/sites/327/2025/04/ants_pnas.pdf) · [Deposited data and code](https://doi.org/10.22002/D1.1996)

## 2. Contacts can help regulate excavation

**Avinery et al. (2023), _Agitated ants: regulation and self-organization of incipient nest excavation via collisional cues_. Journal of the Royal Society Interface 20, 20220597.**

- Species: **Solenopsis invicta**.
- Setting: workers excavating moist glass beads in a thin, quasi-two-dimensional arena.
- Finding relevant here: excavation rates changed over time. A model with local collision history and work/rest behavior reproduced the observed progression, suggesting a possible decentralized regulatory mechanism.
- Boundary: the proposed internal “agitation” variable is a modeling explanation, not a direct readout of an ant's mental state. The paper's model excludes branch formation and tunnel-width variation. This prototype only counts nearby encounters; it does not implement the paper's collision-history regulation.

[Paper and DOI](https://doi.org/10.1098/rsif.2022.0597) · [Authors' full-text copy](https://crablab.gatech.edu/pages/publications/pdf/ram_interface_2023.pdf) · [Deposited data and code](https://doi.org/10.6084/m9.figshare.22649689.v1)

## 3. Local chemical information can form trails

**Perna et al. (2012), _Individual rules for trail pattern formation in Argentine ants (Linepithema humile)_. PLOS Computational Biology 8, e1002592.**

- Species: **Linepithema humile**.
- Setting: ants exploring an initially empty arena; the study estimated pheromone distribution from their trajectories.
- Finding relevant here: turning correlated with nearby pheromone differences. An individual response based on the difference relative to the total concentration generated collective trails in simulations.
- Boundary: the study did not directly image glowing pheromones. Our three-sensor surface steering, trail decay and food-return behavior are simplified implementation choices; we do not reproduce the paper's continuous response function or claim its measured parameters.

[Open paper](https://journals.plos.org/ploscompbiol/article?id=10.1371/journal.pcbi.1002592) · [Preprint](https://arxiv.org/abs/1201.5827)

## 4. Where an ant works shapes who it meets

**Mersch, Crespi and Keller (2013), _Tracking individuals shows spatial fidelity is a key regulator of ant social organization_. Science 340, 1090–1093.**

- Species: **Camponotus fellah**.
- Setting: tagged workers in six colonies, tracked over 41 days.
- Finding relevant here: spatial behavior and age were associated with distinct social/task groups and their interaction patterns.
- Boundary: our fixed role labels are an interface and simulation simplification. We do not simulate the paper's age-dependent transitions, reconstruct its interaction network or replay its tracked animals.

[Paper and DOI](https://doi.org/10.1126/science.1234316) · [Abstract](https://pubmed.ncbi.nlm.nih.gov/23599264/)

## What is authored in this prototype

| Element | Status |
| --- | --- |
| Ant positions and journeys | Computed model states, not tracked trajectories |
| Colony population and worker roles | 65 workers with fixed assignments: 30 excavators, 25 foragers, 10 nurses |
| Beginning of the experience | An authored starter nest with three open tunnels and two unfinished fronts; no queen-founding sequence |
| Tunnel branches, chambers and growth limits | Procedural geometry; no measured nest reconstruction |
| Surface pheromones | A decaying grid deposited by returning food carriers; searching ants sample forward, left and right |
| Underground pheromones | A visual trace deposited along food-return routes; does not steer underground movement |
| Encounters | Proximity counts with a cooldown; they do not change ant behavior |
| Food relocation | Interactive intervention within the model |
| Clock and speed controls | Simulation time with no biological calibration |
| Soil appearance | Illustration; no granular mechanics solver |
| Brood | Illustrative context; nurse movement does not simulate feeding, development or age transitions |

“No individual has the whole plan” is the question this experience explores. Procedural branching alone is not evidence that a biologically accurate nest-building algorithm has been discovered. Any global routing or authored constraints in the implementation are engineering conveniences and must not be presented as abilities of real ants.

## Implemented behavior and its limits

Surface search is an interactive model, not a prerecorded path. Foragers read a scent grid at three positions near their heading, turn toward stronger samples, and retain random exploration. They detect food only within a fixed proximity. Food relocation does not tell searching ants where it moved. Returning workers deposit scent while heading directly toward the known entrance coordinates. This homing shortcut is an implementation assumption; it is not a reproduced sensory mechanism. The field evaporates over time but does not simulate diffusion, wind or a measured chemical concentration.

Underground movement follows the authored tunnel graph. Returning workers use a shortest-path search; other workers choose among connected passages. Excavation increases a front's progress as workers dig there. Once a passage opens, seeded rules propose additional branches subject to bounds, spacing and a maximum of 40 tunnels. These rules determine the geometry; there is no soil-grain solver, mechanical stability test or discovered chamber-planning behavior. An ant marked as a nurse is assigned that role at initialization rather than acquiring it through emergent task allocation.

## Path toward a measured experiment

1. Select one species and one experimental setup instead of combining studies.
2. Inspect the corresponding deposited data, its license, units and experimental conditions.
3. Define an observable target, such as tunnel length over time, excavation participation or turning response.
4. Reproduce that target with a documented parameter set and compare multiple seeded runs with the measurements.
5. Keep measured replay, calibrated simulation and free exploration visibly separate in the interface.

For the current version, describe the work as an **interactive, research-inspired ant colony**. Reserve “validated,” “digital twin,” and “experimental replay” for later work that establishes those claims.
