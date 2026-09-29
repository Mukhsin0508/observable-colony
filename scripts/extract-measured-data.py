"""Rebuild the CC0 excavation subset from two range-extracted archive members.

Usage: python3 scripts/extract-measured-data.py /path/to/Expt1Data/simFiles
Or:    python3 scripts/extract-measured-data.py --download
The optional download uses curl and HTTP ranges for two small ZIP members.
This script does not execute author code.
"""
from __future__ import annotations
import hashlib
import json
from pathlib import Path
import struct
import subprocess
import sys
import tempfile
import zlib

EXPECTED = {
    'removeList.dat': 'c89b77f96418eb7df209c653cf272be656ae99521ed657adeb8679ffb950c7c9',
    'position_files/positions_image.dat': 'e924f6dcec49b2cd035b7be7a165cbb9d1d4772a52fd91d42500563413291caa',
}

MEMBERS = [
    ('removeList.dat', 44612666255, 33596, 5970888, 2476403146),
    ('position_files/positions_image.dat', 45099545176, 575668, 1329551, 250756282),
]


def download(destination: Path) -> None:
    url = 'https://data.caltech.edu/api/records/10svm-aq733/files/Expt1Data.zip/content'
    for name, offset, compressed_size, size, crc in MEMBERS:
        # Local headers precede compressed member contents. Extra 4096 bytes cover
        # variable filename/ZIP64 fields; the archive's data never runs as code.
        end = offset + compressed_size + 4096
        body = subprocess.check_output([
            'curl', '--fail', '-L', '-sS', '--range', f'{offset}-{end}',
            '--max-filesize', str(compressed_size + 8192), '--max-time', '120', url,
        ])
        header = struct.unpack_from('<4s5H3I2H', body, 0)
        if header[0] != b'PK\x03\x04' or header[3] != 8:
            raise ValueError('Unexpected ZIP local header or compression method')
        start = 30 + header[-2] + header[-1]
        content = zlib.decompress(body[start:start + compressed_size], -15)
        if len(content) != size or zlib.crc32(content) != crc:
            raise ValueError(f'Archive member verification failed: {name}')
        target = destination / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(content)


def extract(source_dir: Path, destination: Path) -> dict[str, int]:
    for name, expected in EXPECTED.items():
        actual = hashlib.sha256((source_dir / name).read_bytes()).hexdigest()
        if actual != expected:
            raise ValueError(f'SHA-256 mismatch: {name}')
    positions = [[float(value) for value in line.split()] for line in (source_dir / 'position_files/positions_image.dat').read_text().splitlines()]
    statuses = [[int(value) for value in line.split(',')] for line in (source_dir / 'removeList.dat').read_text().splitlines()]
    assert len(positions) == 56000 and len(statuses) == 55286
    assert all(len(row) == 54 for row in statuses)
    assert all(len(row) == 3 for row in positions)
    # Author code maps grain i to position row i-1, and removal row i.
    baseline_ids = [grain_id for grain_id in range(1, len(statuses)) if statuses[grain_id][1] == 0]
    assert all(any(positions[grain_id - 1]) for grain_id in baseline_ids)
    assert all(row[scan] <= row[scan + 1] for row in statuses for scan in range(52))
    points: list[list[int | float]] = []
    removed_ids = [grain_id for grain_id in baseline_ids if statuses[grain_id][52]]
    retained_ids = [grain_id for grain_id in baseline_ids if not statuses[grain_id][52]]
    # All observed removals are kept. Retained context is uniformly thinned by ID.
    display_ids = sorted(set(removed_ids) | set(retained_ids[::7]))
    for grain_id in display_ids:
        removed_at = next((scan for scan in range(1, 53) if statuses[grain_id][scan]), -1)
        points.append([grain_id, *positions[grain_id - 1], removed_at])
    frames = [{'scan': scan, 'minutes': None, 'removedCount': sum(statuses[grain_id][scan] for grain_id in baseline_ids)} for scan in range(1, 53)]
    result = {
        'title': 'Observed excavation · Experiment 1',
        'species': 'Pogonomyrmex occidentalis',
        'license': 'CC0 1.0 (repository metadata: cc-zero)',
        'sourceUrl': 'https://doi.org/10.22002/D1.1996',
        'paperUrl': 'https://doi.org/10.1073/pnas.2102267118',
        'coordinateUnit': 'source voxel units',
        'note': 'Image-derived grain centroids and removal flags from the authors’ deposited Experiment 1. Frames preserve source column order; elapsed minutes are unverified. Points are centroids, not measured grain shapes or ant positions.',
        'points': points,
        'frames': frames,
        'provenance': {
            'authors': ['Robert Buarque de Macedo', 'Edward Ando', 'Shilpa Joy', 'Gioacchino Viggiani', 'Raj Kumar Pal', 'Joseph Parker', 'Jose Andrade'],
            'retrievedDate': '2026-09-29',
            'metadataUrl': 'https://data.caltech.edu/api/records/10svm-aq733',
            'archive': 'Expt1Data.zip',
            'archiveBytes': 46065080055,
            'archiveMd5AsPublished': '3a27c694b992fcca8bc0d017434f5bf9',
            'wholeArchiveDownloaded': False,
            'members': [
                {'name': 'Expt1Data/simFiles/position_files/positions_image.dat', 'sha256': EXPECTED['position_files/positions_image.dat'], 'crc32': 250756282, 'zipLocalHeaderOffset': 45099545176, 'compressedBytes': 575668, 'uncompressedBytes': 1329551},
                {'name': 'Expt1Data/simFiles/removeList.dat', 'sha256': EXPECTED['removeList.dat'], 'crc32': 2476403146, 'zipLocalHeaderOffset': 44612666255, 'compressedBytes': 33596, 'uncompressedBytes': 5970888},
            ],
            'mapping': 'Original grain id i uses positions row i-1 and removal row i. Coordinates copied unchanged from the image input, not equilibrated simulation frames.',
            'sourceCoordinateAxes': 'Original X,Y,Z; author analyses treat Z as height. Display rotation/translation is separate from stored data.',
            'coordinateScale': 'Stored values are source voxels. 0.14 mm per voxel: SI Appendix p.2 gives 140 um voxels for the half-resolution time-series scans; the ~656-voxel centroid span equals ~92 mm, matching the 500 mL soil fill of the 7-9.8 cm frustum.',
            'timeInterpretation': 'scan is the 0-based source removal-table column. Sequence only: minutes intentionally null because exact acquisition timestamp mapping is not established.',
            'excludedRows': 'Removal row 0 is the background label. Grain IDs 1–29 are already absent at baseline. Position rows beyond mapped grain ID 55285 are not used.',
            'excludedColumns': 'Source columns 0 and 1 duplicate baseline. Use 1–52. Column53 resets all observed removals and is excluded as an inconsistent trailing column.',
            'baselineGrainCount': len(baseline_ids),
            'measuredRemovedGrainCount': len(removed_ids),
            'displayPointCount': len(points),
            'displayRetainedGrainCount': len(display_ids) - len(removed_ids),
            'decimation': 'Keep every baseline grain removed by column52, plus every seventh never-removed grain in ascending ID order. No removed grain decimation.',
            'measurementLimit': 'Removal flags are author-derived CT segmentation observations. Removal is localized to acquisition intervals; individual ant movement, communication, exact extraction instants and grain shapes are not provided by this subset.',
            'validation': 'Selected ZIP member CRC32 and file sizes verified. SHA256 hashes computed. Baseline-to-column52 flags are binary and monotone. Full archive MD5 was not recomputed.',
        },
    }
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(result, separators=(',', ':'), ensure_ascii=False) + '\n')
    return {'points': len(points), 'frames': len(frames), 'removed': len(removed_ids), 'baseline': len(baseline_ids), 'bytes': destination.stat().st_size}


if __name__ == '__main__':
    target = Path(__file__).resolve().parents[1] / 'public/data/excavation.json'
    if sys.argv[1:] == ['--download']:
        with tempfile.TemporaryDirectory(prefix='observable-colony-data-') as directory:
            source = Path(directory)
            download(source)
            print(json.dumps(extract(source, target)))
    else:
        print(json.dumps(extract(Path(sys.argv[1]), target)))
