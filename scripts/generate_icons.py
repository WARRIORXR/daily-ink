"""Generate the PWA icons as real PNGs using only the Python standard library.

Usage: python scripts/generate_icons.py
"""

from __future__ import annotations

import struct
import zlib
from pathlib import Path

OUT_DIR = Path(__file__).resolve().parent.parent / "public" / "icons"

BG = (24, 24, 27, 255)  # zinc-900, matches the app's ink colour
PAPER = (250, 250, 250, 255)
LINE = (212, 212, 216, 255)
MARK = (24, 24, 27, 255)


def encode_png(width: int, height: int, rgba: bytearray) -> bytes:
    def chunk(kind: bytes, data: bytes) -> bytes:
        body = kind + data
        return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body))

    stride = width * 4
    raw = b"".join(b"\x00" + bytes(rgba[y * stride:(y + 1) * stride]) for y in range(height))
    header = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)  # 8-bit RGBA
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", header)
        + chunk(b"IDAT", zlib.compress(raw, 9))
        + chunk(b"IEND", b"")
    )


class Canvas:
    def __init__(self, size: int, color: tuple[int, int, int, int]):
        self.size = size
        self.px = bytearray(bytes(color) * (size * size))

    def fill_round_rect(self, x0: float, y0: float, w: float, h: float, r: float, color) -> None:
        for y in range(int(y0), int(y0 + h) + 1):
            for x in range(int(x0), int(x0 + w) + 1):
                cx, cy = x + 0.5, y + 0.5
                if not (x0 <= cx <= x0 + w and y0 <= cy <= y0 + h):
                    continue
                nx = max(x0 + r, min(cx, x0 + w - r))
                ny = max(y0 + r, min(cy, y0 + h - r))
                if (cx - nx) ** 2 + (cy - ny) ** 2 <= r * r and 0 <= x < self.size and 0 <= y < self.size:
                    i = (y * self.size + x) * 4
                    self.px[i:i + 4] = bytes(color)


def draw_icon(size: int, maskable: bool = False) -> bytes:
    """A blank page with three ruled lines on an ink background."""
    canvas = Canvas(size, BG)
    m = 0.64 if maskable else 0.82  # maskable icons keep the motif in a safe zone
    pw, ph = size * 0.6 * m, size * 0.74 * m
    x0, y0 = (size - pw) / 2, (size - ph) / 2
    canvas.fill_round_rect(x0, y0, pw, ph, size * 0.05 * m, PAPER)

    line_h = max(2.0, size * 0.04 * m)
    y = y0 + ph * 0.2
    for width in (0.46, 0.34, 0.4):
        canvas.fill_round_rect(x0 + pw * 0.14, y, width * size * m, line_h, line_h / 2, LINE)
        y += line_h + size * 0.035 * m
    canvas.fill_round_rect(x0 + pw * 0.14, y0 + ph * 0.84, size * 0.08 * m, line_h, line_h / 2, MARK)
    return encode_png(size, size, canvas.px)


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    targets = {
        "icon-192.png": (192, False),
        "icon-512.png": (512, False),
        "maskable-192.png": (192, True),
        "maskable-512.png": (512, True),
        "apple-touch-icon.png": (180, False),
    }
    for name, (size, maskable) in targets.items():
        (OUT_DIR / name).write_bytes(draw_icon(size, maskable))
    print(f"Icons written to {OUT_DIR}")


if __name__ == "__main__":
    main()
