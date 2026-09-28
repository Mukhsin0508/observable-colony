# Observed excavation dataset

`public/data/excavation.json` contains **image-derived grain centroids and removal flags from Experiment 1** of Buarque de Macedo et al., *Unearthing real-time 3D ant tunneling mechanics* (PNAS, 2021). The experiment used **Pogonomyrmex occidentalis**, imaged with repeated X-ray computed tomography. The view follows changes in the substrate; it does not contain tracked ant positions.

[Paper](https://doi.org/10.1073/pnas.2102267118) · [Official dataset](https://doi.org/10.22002/D1.1996) · [Working record](https://data.caltech.edu/records/10svm-aq733) · [Official metadata](https://data.caltech.edu/api/records/10svm-aq733)

## Attribution and license

Dataset authors: Robert Buarque de Macedo, Edward Ando, Shilpa Joy, Gioacchino Viggiani, Raj Kumar Pal, Joseph Parker and Jose Andrade. CaltechDATA, version 1.0, published 10 June 2021. DOI: **10.22002/D1.1996**.

The official repository and DataCite metadata label this dataset **`cc-zero`**. This subset is distributed under that dataset dedication; it does not change the separate license of the paper or its figures. No paper figures or CT movies are bundled here. Metadata and selected members were retrieved on 29 September 2026.

## What was actually retrieved

The repository contains roughly 236 GB in five ZIP files. The selected experiment archive is **46,065,080,055 bytes**. It was not downloaded in full. HTTP range requests read portions of its ZIP64 directory and the following two small members:

| Original member | Compressed bytes | Uncompressed bytes | CRC32 |
| --- | ---: | ---: | ---: |
| `Expt1Data/simFiles/position_files/positions_image.dat` | 575,668 | 1,329,551 | 250756282 |
| `Expt1Data/simFiles/removeList.dat` | 33,596 | 5,970,888 | 2476403146 |

Member sizes and CRC32 checks matched the ZIP directory. The JSON also records file SHA-256 hashes, exact local-header offsets and the archive's published MD5. The whole-archive MD5 was not recomputed.

The deposited author code explains the mapping: `Preprocess/XRCT2LSDEM/LevelSetCharacterization/Main.cpp` writes `positions[i - 1] = grainInfo2._cmGlobal`, and the analysis scripts access removal status at row `i + 1` for position row `i`. Thus grain ID *i* maps to coordinate row *i − 1* and removal row *i*. The coordinates are copied from `positions_image.dat`, **not from later equilibrated mechanical-simulation frames**. Author preprocessing generates removal flags from CT image comparison. Those derived observations still have segmentation limitations; they are not a manual ground-truth annotation of every ant action.

## Exact subset and checks

- The position file has 56,000 rows. The removal table has 55,286 rows and 54 columns.
- Removal row 0 is the background label. Grain IDs 1–29 are already marked absent in the baseline. Those are excluded from the displayed excavation count.
- The remaining **55,256 baseline grains** are mapped to nonzero coordinate rows.
- Source columns **1–52** are included. Column 0 duplicates the baseline. Column 53 resets the removals to baseline and fails monotonicity, so it is excluded as an inconsistent trailing column.
- All included flags are binary and monotone: once a grain is marked removed, it remains removed.
- By the final included column, **5,174 baseline grains** have been marked removed. Every one is included in the visualization.
- To keep the browser lightweight, retained context uses every seventh never-removed grain in ascending ID order: **7,155 context points**. The result contains **12,329 points**, with all removal counts computed before thinning.
- Stored coordinates retain the source values. Dots indicate centroid locations. Dot size and any display transformation are presentation choices, not measured grain radius or shape.

## Time and length units

`scan` is the **original zero-based removal-table column**, not an inferred frame number or elapsed minute. `minutes` is deliberately `null` for every frame. The paper describes repeated acquisition, but the archived image inventory contains gaps and we have not established the exact timestamp mapping for each table column. The interface must say **scan sequence** and must not turn the slider into hours, days or a colony lifespan.

Coordinates remain in **source voxel units**. Related author plotting code uses 0.14 mm per voxel, but its mapping to these exact input files has not been independently established. No unverified conversion to millimeters is applied. Source Z is treated as height by the author's analysis; a renderer may rotate or translate the view without changing stored coordinates.

## JSON contract

```text
points: [grainId, x, y, z, removedAtScan][]
frames: { scan, minutes: null, removedCount }[]
```

`removedAtScan = -1` means retained through the final included scan. For a frame with scan *s*, a point belongs to the observed excavated set when `removedAtScan >= 0 && removedAtScan <= s`. `removedCount` counts all mapped baseline grains removed by *s*, not just displayed points. `provenance` carries the source member hashes, filtering rules and population counts.

## Reproduce

From the repository root, use Python 3 and curl:

```sh
python3 scripts/extract-measured-data.py --download
```

The script range-downloads only the two selected members (about 610 KB compressed plus small header allowances), checks ZIP CRC32 and SHA-256, applies the documented filtering, and rebuilds the JSON. It never executes the deposited author code. If the two source members are already extracted, pass the path to their `simFiles` directory instead of `--download`.

## Keep observed data separate from simulated behavior

This mode can accurately be described as a **replay of image-derived excavation measurements**. It shows where grains that were present initially were later marked absent. It is not a live simulation, ant tracking, a full colony life cycle, or a complete reconstructed solid tunnel surface. Individual grain-removal instants within scan intervals, force networks, chemical signaling and worker decisions are outside this subset.

Use the simulation mode for exploring behavioral hypotheses, and label any future founding or life-cycle sequence as an authored model unless it has its own measured source. Do not attach simulated ants or invented pheromone trajectories to this experimental replay as though they were observations.
