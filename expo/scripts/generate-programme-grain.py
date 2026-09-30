"""Build the original, static grain tile used by ProgrammeGrain.

Deterministic independent pixels avoid directional streaks or a visible edge seam.
RGB is neutral black/white; per-pixel alpha is capped at 32/255. Component opacity
then bounds the final tonal variation. No runtime random numbers or image filter.
Run from any directory with Python 3; no external packages are required.
"""
from pathlib import Path
import struct
import zlib

SEED = 0x4652414D
MAX_ALPHA = 32
ROOT = Path(__file__).resolve().parents[1] / "assets" / "textures"


def sample(index):
    value = (index + SEED) & 0xFFFFFFFF
    value = ((value ^ (value >> 16)) * 0x7FEB352D) & 0xFFFFFFFF
    value = ((value ^ (value >> 15)) * 0x846CA68B) & 0xFFFFFFFF
    return (value ^ (value >> 16)) & 0xFFFFFFFF


def chunk(kind, data):
    return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)


def make_tile(scale):
    size = 128 * scale
    rows = bytearray()
    for y in range(size):
        rows.append(0)  # PNG filter: none; pixels are independent.
        for x in range(size):
            value = sample(y * size + x)
            # Squared distribution keeps most grains softer than the alpha cap.
            alpha = round(MAX_ALPHA * ((value & 0xFFFF) / 65535) ** 2)
            level = 255 if value & 0x10000 else 0
            rows.extend((level, level, level, alpha))
    provenance = b"Origin\0Frame original procedural grain; seed=0x4652414D; alpha<=32/255; generator=scripts/generate-programme-grain.py"
    result = b"\x89PNG\r\n\x1a\n"
    result += chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0))
    result += chunk(b"tEXt", provenance)
    result += chunk(b"IDAT", zlib.compress(bytes(rows), 9))
    result += chunk(b"IEND", b"")
    suffix = "" if scale == 1 else f"@{scale}x"
    target = ROOT / f"programme-grain{suffix}.png"
    target.write_bytes(result)
    print(f"{target.name}: {size}×{size}, {len(result):,} bytes")


if __name__ == "__main__":
    ROOT.mkdir(parents=True, exist_ok=True)
    for scale in (1, 2, 3):
        make_tile(scale)
