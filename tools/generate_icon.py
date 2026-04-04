#!/usr/bin/env python3
"""
Generate a valid AppIcon.icns without Pillow.
- Dark space background, nebula fog, orbit arc, planet, stars (Nebula mark).
- Builds a proper .iconset and runs iconutil.
"""

import binascii
import math
import os
import shutil
import struct
import subprocess
import sys
import zlib


def _png_chunk(tag: bytes, data: bytes) -> bytes:
    crc = binascii.crc32(tag + data) & 0xFFFFFFFF
    return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", crc)


def _clamp(v: int) -> int:
    return max(0, min(255, v))


def make_png_bytes(size: int) -> bytes:
    width = height = size
    raw = bytearray()

    radius = max(2, int(size * 0.234))  # ~15/64 rounded rect

    # Ring geometry (legacy spatial mark; prefer webapp/public/nebula-logo.png + icns_from_png.sh)
    cx_ring = width * 0.5
    cy_ring = height * (25.7 / 64.0)
    ring_r = width * (20.0 / 64.0)
    ring_th = max(1, int(size * 0.034))

    # Planet
    cx_p = width * 0.5
    cy_p = height * (40.0 / 64.0)
    pr = width * (8.0 / 64.0)

    stars = [
        (0.172, 0.188, 1.3),
        (0.344, 0.125, 0.9),
        (0.844, 0.4375, 1.0),
        (0.75, 0.6875, 0.8),
    ]

    for y in range(height):
        raw.append(0)  # filter type none
        t = y / max(1, (height - 1))
        # Deep space vertical gradient
        br = int(6 + 12 * t)
        bg = int(8 + 10 * t)
        bb = int(18 + 22 * t)

        for x in range(width):
            alpha = 255
            if x < radius and y < radius:
                dx, dy = radius - x, radius - y
                if dx * dx + dy * dy > radius * radius:
                    alpha = 0
            elif x >= width - radius and y < radius:
                dx, dy = x - (width - radius - 1), radius - y
                if dx * dx + dy * dy > radius * radius:
                    alpha = 0
            elif x < radius and y >= height - radius:
                dx, dy = radius - x, y - (height - radius - 1)
                if dx * dx + dy * dy > radius * radius:
                    alpha = 0
            elif x >= width - radius and y >= height - radius:
                dx, dy = x - (width - radius - 1), y - (height - radius - 1)
                if dx * dx + dy * dy > radius * radius:
                    alpha = 0

            rr, gg, bb = br, bg, bb

            if alpha == 0:
                raw.extend((0, 0, 0, 0))
                continue

            # Nebula fog (cyan / violet)
            fx = (x - width * 0.35) / (width * 0.55 + 1e-6)
            fy = (y - height * 0.75) / (height * 0.45 + 1e-6)
            fog1 = max(0.0, 1.0 - (fx * fx + fy * fy)) * 0.42
            rr = _clamp(rr + int(70 * fog1))
            gg = _clamp(gg + int(95 * fog1))
            bb = _clamp(bb + int(130 * fog1))

            vx = (x - width * 0.8) / (width * 0.35 + 1e-6)
            vy = (y - height * 0.2) / (height * 0.3 + 1e-6)
            fog2 = max(0.0, 1.0 - (vx * vx + vy * vy)) * 0.22
            rr = _clamp(rr + int(60 * fog2))
            gg = _clamp(gg + int(40 * fog2))
            bb = _clamp(bb + int(110 * fog2))

            # Orbit arc: lower semicircle (chord at planet row, matches SVG)
            chord_y = height * (40.0 / 64.0)
            dx, dy = x - cx_ring, y - cy_ring
            d = math.hypot(dx, dy)
            if abs(d - ring_r) <= ring_th and y >= chord_y - ring_th:
                rr, gg, bb = 155, 124, 255

            # Inner faint arc
            if abs(d - (ring_r * 0.88)) <= max(1, ring_th // 2) and y >= chord_y - ring_th:
                rr = _clamp(rr + 25)
                gg = _clamp(gg + 40)
                bb = _clamp(bb + 55)

            # Planet + simple highlight
            d_p = math.hypot(x - cx_p, y - cy_p)
            if d_p <= pr:
                u = (x - cx_p) / (pr + 1e-6)
                v = (y - cy_p) / (pr + 1e-6)
                hi = max(0.0, 0.55 - math.hypot(u + 0.35, v + 0.45))
                rr = _clamp(int(59 + hi * 80 + (x / width) * 30))
                gg = _clamp(int(130 + hi * 90))
                bb = _clamp(int(255))

            # Stars
            for sx, sy, sr in stars:
                rs = max(1, int(sr * size / 64.0))
                if (x - sx * width) ** 2 + (y - sy * height) ** 2 <= rs * rs:
                    rr, gg, bb = 232, 234, 244

            raw.extend((rr, gg, bb, alpha))

    ihdr = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)  # RGBA
    idat = zlib.compress(bytes(raw), level=9)
    png = b"\x89PNG\r\n\x1a\n" + _png_chunk(b"IHDR", ihdr) + _png_chunk(b"IDAT", idat) + _png_chunk(b"IEND", b"")
    return png


def build_icns(output_path: str) -> bool:
    root = os.path.dirname(os.path.abspath(__file__))
    tmpdir = os.path.join(root, ".iconset_build")
    iconset = os.path.join(tmpdir, "AppIcon.iconset")
    os.makedirs(iconset, exist_ok=True)

    mapping = [
        (16, "icon_16x16.png"),
        (32, "icon_16x16@2x.png"),
        (32, "icon_32x32.png"),
        (64, "icon_32x32@2x.png"),
        (128, "icon_128x128.png"),
        (256, "icon_128x128@2x.png"),
        (256, "icon_256x256.png"),
        (512, "icon_256x256@2x.png"),
        (512, "icon_512x512.png"),
        (1024, "icon_512x512@2x.png"),
    ]

    for sz, filename in mapping:
        with open(os.path.join(iconset, filename), "wb") as f:
            f.write(make_png_bytes(sz))

    if not shutil.which("iconutil"):
        print("iconutil niet gevonden op dit systeem.")
        return False

    result = subprocess.run(["iconutil", "-c", "icns", iconset, "-o", output_path], capture_output=True, text=True)
    if result.returncode != 0:
        print("iconutil fout:")
        print(result.stderr.strip())
        return False

    return True


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "AppIcon.icns"
    print("Nebula spatial icon — generator")
    ok = build_icns(out)
    if ok:
        print(f"AppIcon.icns aangemaakt: {out}")
    else:
        print("Icon generatie mislukt")
        sys.exit(1)
