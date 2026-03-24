#!/usr/bin/env python3
"""
Generate a valid AppIcon.icns without Pillow.
- Creates a custom purple gradient icon with an H mark.
- Builds a proper .iconset and runs iconutil.
"""

import os
import struct
import subprocess
import zlib
import binascii
import shutil
import sys


def _png_chunk(tag: bytes, data: bytes) -> bytes:
    crc = binascii.crc32(tag + data) & 0xFFFFFFFF
    return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", crc)


def make_png_bytes(size: int) -> bytes:
    width = height = size
    raw = bytearray()

    radius = max(2, int(size * 0.22))

    for y in range(height):
        raw.append(0)  # filter type none
        t = y / max(1, (height - 1))
        r = int(155 + (83 - 155) * t)
        g = int(142 + (74 - 142) * t)
        b = int(249 + (183 - 249) * t)

        for x in range(width):
            # Rounded rectangle alpha mask
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

            rr, gg, bb = r, g, b

            # Draw H lettermark
            m = int(size * 0.22)
            bw = max(2, int(size * 0.11))
            bh = int(size * 0.56)
            by = int(size * 0.22)
            rx = size - m - bw
            mby = by + int(bh * 0.44)
            mbh = max(2, int(size * 0.09))

            in_left = (m <= x <= m + bw) and (by <= y <= by + bh)
            in_right = (rx <= x <= rx + bw) and (by <= y <= by + bh)
            in_mid = (m <= x <= rx + bw) and (mby <= y <= mby + mbh)
            if in_left or in_right or in_mid:
                rr, gg, bb = 38, 33, 92
                alpha = 255

            # Accent dot
            ad = max(3, int(size * 0.07))
            cx = rx + bw
            cy = int(size * 0.08) + ad
            if (x - cx) ** 2 + (y - cy) ** 2 <= ad * ad:
                rr, gg, bb = 124, 106, 247
                alpha = 255

            raw.extend((rr, gg, bb, alpha))

    ihdr = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)  # RGBA
    idat = zlib.compress(bytes(raw), level=9)
    png = b"\x89PNG\r\n\x1a\n" + _png_chunk(b"IHDR", ihdr) + _png_chunk(b"IDAT", idat) + _png_chunk(b"IEND", b"")
    return png


def build_icns(output_path: str) -> bool:
    tmpdir = "/tmp/hohoh_icons"
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
    print("🎨 HohohSolutions CRM — icon generator")
    ok = build_icns(out)
    if ok:
        print(f"✅ AppIcon.icns aangemaakt: {out}")
    else:
        print("❌ Icon generatie mislukt")
        sys.exit(1)
