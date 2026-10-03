#!/usr/bin/env python3
"""Convert raw PNGs (tools/art/raw/<set>/<id>.png) into the web art pack.

Writes apps/web/public/art/<set>/<id>.webp (large) and <id>.sm.webp (thumbnail),
plus the manifest the art plugin reads (apps/web/src/plugins/art/manifest.json).
Only images whose PNG is newer than their WebP are re-encoded.

  python3 tools/art/build.py
"""
import hashlib, json, os
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
RAW = os.path.join(HERE, "raw")
OUT = os.path.join(ROOT, "apps/web/public/art")
MANIFEST = os.path.join(ROOT, "apps/web/src/plugins/art/manifest.json")
# long edge of the large / small renditions per set
SIZES = {"portrait": (512, 160), "default": (1280, 480)}
QUALITY = 74


def encode(src: Image.Image, edge: int, out: str):
    im = src.copy()
    im.thumbnail((edge, edge), Image.LANCZOS)
    im.save(out, "WEBP", quality=QUALITY, method=6)
    return im.size


def main():
    prompts = json.load(open(os.path.join(HERE, "prompts.json")))["sets"]
    manifest = {}
    for set_name in sorted(os.listdir(RAW)):
        big, small = SIZES.get(set_name, SIZES["default"])
        os.makedirs(os.path.join(OUT, set_name), exist_ok=True)
        prefix = next(iter(prompts.get(set_name, {}).get("items", {"x:": 0}))).split(":")[0]
        for f in sorted(os.listdir(os.path.join(RAW, set_name))):
            if not f.endswith(".png"):
                continue
            name = f[:-4]
            png = os.path.join(RAW, set_name, f)
            large = os.path.join(OUT, set_name, name + ".webp")
            thumb = os.path.join(OUT, set_name, name + ".sm.webp")
            try:
                im = Image.open(png).convert("RGB")
            except OSError:  # still being written by generate.py
                print(f"skip {png}")
                continue
            if True:
                w, h = im.size
                if not os.path.exists(large) or os.path.getmtime(large) < os.path.getmtime(png):
                    encode(im, big, large)
                    encode(im, small, thumb)
            # content hash: a re-painted image gets a new URL, so the service-worker cache can't serve the old one
            v = hashlib.md5(open(large, "rb").read()).hexdigest()[:8]
            manifest[f"{prefix}:{name}"] = {"src": f"art/{set_name}/{name}", "w": w, "h": h, "v": v}
    os.makedirs(os.path.dirname(MANIFEST), exist_ok=True)
    json.dump(manifest, open(MANIFEST, "w"), indent=1, sort_keys=True)
    total = sum(os.path.getsize(os.path.join(dp, f)) for dp, _, fs in os.walk(OUT) for f in fs)
    print(f"{len(manifest)} images, {total / 1e6:.1f} MB in public/art")


if __name__ == "__main__":
    main()
