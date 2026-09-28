# Life-history journey: evidence and model boundaries

Reviewed 29 September 2026. The journey is framed around the western harvester ant, **Pogonomyrmex occidentalis**. Its population counts are computed by an illustrative cohort model. They are not a measured nest, a replay, a demographic forecast, or a calibrated species simulation.

## What the sources support

### Founding and the first workers

Wiernasz and Cole's *The ontogeny of selection on genetic diversity in harvester ants* (2022) describes colonies founded by one multiply mated queen. It reports very high mortality during the incipient period. Their experiment deliberately bypassed that period by rearing colonies in a laboratory for about ten months before field transplantation. Transplanted colonies contained 140–360 workers. Those results do not give universal egg, larval or pupal durations, and do not make this journey's successful founding inevitable.

[Primary paper, authors' full text](https://harvester-ants.com/wp-content/uploads/2023/10/wiernasz-cole-2022-proof.pdf) · [DOI](https://doi.org/10.1098/rspb.2022.0496)

### Metamorphosis and worker care

The University of Nevada, Reno Extension's harvester-ant account describes the sequence egg → larva → pupa → adult. After workers emerge, they forage for seeds and care for brood. Winged males and potential queens participate in mating flights; mated females may attempt new nests. This is guidance for **Pogonomyrmex species collectively**, not a source of measured P. occidentalis stage timings. The interface does not assume that every ant species uses a cocoon.

[Andrews, Hanson Mazet and Kratsch (2023), University of Nevada, Reno Extension](https://extension.unr.edu/publication.aspx?PubID=5496)

### Reproduction depends on more than age

Cole and Wiernasz's four-year field study (2000) found that larger colonies were more likely to reproduce, while the size threshold varied between years. Mature colonies did not reproduce every year. Rainfall was involved in the release of reproductives. A single hardcoded birthday therefore cannot stand for experimentally established reproductive maturity.

[Primary paper: *Colony size and reproduction in the western harvester ant, Pogonomyrmex occidentalis*](https://link.springer.com/article/10.1007/PL00001711)

The authors' demographic research overview emphasizes this variation: reproduction is uncommon before five years, yet some colonies remain non-reproductive at twenty. Colony size predicts survival and reproduction more closely than age alone. These observations motivate an illustrative size condition in the model; they do not supply our numerical threshold. The 2022 experiment also reports that its surviving colonies remained pre-reproductive at the last census, despite several years in the field.

[Cole–Wiernasz Lab: long-term demography](https://harvester-ants.com/long-term-demography-of-ants/)

### Longevity is not a timer for queen death

Keeler's longitudinal P. occidentalis study recorded a mean colony lifespan of 15.65 years among 112 colonies, with the longest observed colony lasting 42 years. These are findings from one observed population, not a universal lifespan or an instruction to kill every queen at a particular age. The model never schedules natural queen death. “Queen loss” is a user-selected intervention.

[Keeler (2021), primary paper in the University of Nebraska–Lincoln repository](https://digitalcommons.unl.edu/bioscifacpub/954/)

## Authored scenario parameters

No verified, directly inspected, stage-specific P. occidentalis development data were used to fit these rates. An older comparative paper references a total development estimate, but that indirect citation was not treated as a calibrated source. All values below are deliberately labeled **illustrative**.

| Parameter | Current authored value | Meaning |
| --- | --- | --- |
| First clutch | 12 eggs on model day 3 | Starting scenario, not a species average |
| Egg stage | 14 model days | Visual teaching interval |
| Larval stage | 20 model days | Visual teaching interval |
| Pupal stage | 23 model days | Visual teaching interval |
| First workers | Earliest at model day 60 | Consequence of the three intervals |
| Transition loss | 4% egg, 8% larva, 4% pupa, stochastically rounded | Illustrative attrition, not measured survival rates |
| Worker adult residence | 300–660 model days, seeded per cohort | Simplified mortality; not measured worker longevity |
| Reproductive waypoint | Model day 3,650 and at least 1,200 workers | A scenario choice, not an observed age or size threshold |
| Sexual brood allocation | 18% after the scenario conditions are met | Authored; sex ratio and caste mechanisms are not modeled |
| Alate departure | 30 model days after emergence | Visual turnover; no weather or mating-flight prediction |
| Capacity | 12,000 workers in the egg-laying feedback | Authored population bound |
| Numerical horizon | 60 model years | Calculation limit, not a biological lifespan |

Daily laying after the first workers appear depends on worker population and remaining modeled capacity. A daily clutch is capped at 120. Fractional laying credit carries over. Cohorts are retained through egg, larval, pupal and adult stages; the interface is displaying their actual summed counts rather than simply replacing numbers at timeline milestones.

The model does **not** simulate temperature, food reserves, rain, diapause, seasonality, a queen's physiological condition, genetic caste determination, pathogens, competition, or the high probability of failed founding in nature. No food or storage indicator should be presented as causing these demographic outcomes. Successful growth is the illustrated scenario, not a prediction of a typical foundress's fate.

## Queen-loss intervention

Removing the queen stops further egg laying immediately. Brood already present continues through its modeled stages while worker carers remain; adult workers then age out without replacement. If there are no workers and no living queen, remaining brood is removed from the simulation because it has no carers. Brood already committed to the modeled alate fate can still emerge. This is a simplified counterfactual, not a measured post-loss trajectory.

`setQueenAlive(true)` is an explicit counterfactual control, not a claim that a dead queen revives or a P. occidentalis colony naturally installs a replacement. When the queen is restored after model day 3 and no workers or brood remain, this control starts a fresh illustrative founding clutch. Restoring before day 3 leaves the original clutch schedule intact. This prevents the counterfactual control from leaving the model permanently empty; it is not an experimentally supported re-founding mechanism. Worker-laid eggs and any queenless male production are omitted. Advancing time with a living queen never causes an automatic queen-loss event.

## Interface and API contract

`ColonyLifecycle` is pure TypeScript with no rendering, timers or network access. `step(days)` advances fixed one-day demographic ticks and retains fractional time. `seek(stageId)` rebuilds the same seeded scenario at an authored waypoint. The decline waypoint first advances to the reproduction waypoint, applies queen loss, then advances another 365 model days. Seeking intentionally clears previous interventions.

Snapshots contain independent event arrays and integer, nonnegative counts. `totalBorn` counts emerged adults; `totalDied` includes brood losses and worker deaths; `departedAlates` is separate. Therefore `totalBorn - totalDied` is not a census identity. The modeled population can exceed the number of individuals drawn for performance; a representative rendering must be labeled as such.

Keep the journey clock labeled **model day/year** and the journey labeled **illustrative**. Observed-data views must remain separate and carry their own species, experiment, units and citations.
