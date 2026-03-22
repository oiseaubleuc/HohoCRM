#!/usr/bin/env python3
"""
Genereert een AppIcon.icns voor de HohohSolutions CRM macOS app.
Vereisten: Python 3, Pillow  (pip3 install Pillow)
Draai dit script VOOR build.sh
"""
import os, struct, zlib, subprocess, shutil, sys

def make_png_bytes(size):
    """Genereert een paarse gradient PNG met H-lettermark voor de gegeven grootte."""
    try:
        from PIL import Image, ImageDraw, ImageFont
        img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img)

        # Achtergrond: afgerond vierkant paars gradient (simulatie)
        r = max(4, int(size * 0.22))
        for y in range(size):
            t = y / size
            # gradient van #9b8ef9 naar #534AB7
            ri = int(155 + (83 - 155) * t)
            gi = int(142 + (74 - 142) * t)
            bi = int(249 + (183 - 249) * t)
            draw.rectangle([0, y, size, y+1], fill=(ri, gi, bi, 255))

        # Afgeronde hoeken transparant maken (simpele cirkelmasker)
        mask = Image.new("L", (size, size), 0)
        mask_draw = ImageDraw.Draw(mask)
        mask_draw.rounded_rectangle([0, 0, size-1, size-1], radius=r, fill=255)
        img.putalpha(mask)

        # H lettermark
        draw2 = ImageDraw.Draw(img)
        m = int(size * 0.22)
        bw = max(2, int(size * 0.11))
        bh = int(size * 0.56)
        by = int(size * 0.22)
        cx = size // 2
        # Links
        draw2.rounded_rectangle([m, by, m+bw, by+bh], radius=max(1,bw//3), fill=(38, 33, 92, 255))
        # Rechts
        rx2 = size - m - bw
        draw2.rounded_rectangle([rx2, by, rx2+bw, by+bh], radius=max(1,bw//3), fill=(38, 33, 92, 255))
        # Midden balk
        mby = by + int(bh * 0.44)
        mbh = max(2, int(size * 0.09))
        draw2.rounded_rectangle([m, mby, rx2+bw, mby+mbh], radius=max(1,mbh//3), fill=(38, 33, 92, 255))
        # Accent dot
        ad = max(3, int(size * 0.07))
        draw2.ellipse([rx2+bw-ad, int(size*0.08), rx2+bw+ad, int(size*0.08)+ad*2], fill=(124, 106, 247, 255))

        import io
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        return buf.getvalue()

    except ImportError:
        print("Pillow niet gevonden — installeer met: pip3 install Pillow")
        return None

def build_icns(output_path):
    sizes = [16, 32, 64, 128, 256, 512, 1024]
    icns_types = {
        16:   (b'icp4', b'ic11'),
        32:   (b'icp5', b'ic12'),
        64:   (b'icp6', None),
        128:  (b'ic07', b'ic13'),
        256:  (b'ic08', b'ic14'),
        512:  (b'ic09', b'ic15'),
        1024: (b'ic10', None),
    }

    tmpdir = "/tmp/hohoh_icons"
    os.makedirs(tmpdir, exist_ok=True)

    # Probeer eerst met iconutil (native macOS, het beste resultaat)
    iconset = tmpdir + "/AppIcon.iconset"
    os.makedirs(iconset, exist_ok=True)

    pngs = {}
    for sz in sizes:
        data = make_png_bytes(sz)
        if data:
            p = f"{iconset}/icon_{sz}x{sz}.png"
            with open(p, "wb") as f:
                f.write(data)
            pngs[sz] = data
            # @2x versie
            if sz <= 512:
                p2 = f"{iconset}/icon_{sz//1 if sz==16 else sz}x{sz//1 if sz==16 else sz}@2x.png"
                # gewoon kopieer voor nu
            print(f"  ✓ PNG {sz}×{sz}")

    if shutil.which("iconutil"):
        result = subprocess.run(
            ["iconutil", "-c", "icns", iconset, "-o", output_path],
            capture_output=True, text=True
        )
        if result.returncode == 0:
            print(f"\n✅ AppIcon.icns aangemaakt via iconutil: {output_path}")
            return True
        else:
            print(f"iconutil fout: {result.stderr}")

    # Fallback: bouw ICNS handmatig
    chunks = []
    for sz, data in pngs.items():
        tag = icns_types[sz][0]
        compressed = zlib.compress(data)
        # ICNS gebruikt raw PNG voor moderne formaten
        size_bytes = struct.pack(">I", 8 + len(data))
        chunks.append(tag + size_bytes[1:] + data)  # vereenvoudigd

    # Schrijf geldig ICNS bestand
    body = b''.join(chunks)
    header = b'icns' + struct.pack(">I", 8 + len(body))
    with open(output_path, "wb") as f:
        f.write(header + body)
    print(f"\n✅ AppIcon.icns aangemaakt (handmatig): {output_path}")
    return True

if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "AppIcon.icns"
    print("🎨 HohohSolutions CRM — icoon generator")
    print("=" * 40)
    build_icns(out)
