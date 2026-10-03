#!/usr/bin/env python3
"""Generate the art pack from prompts.json through an OpenAI-compatible images API.

The key is never stored in the repo: pass it via FORGE_IMAGE_KEY or a key file
(FORGE_IMAGE_KEY_FILE). Raw PNGs land in tools/art/raw/ (gitignored).

  python3 tools/art/generate.py class            # all missing images of a set
  python3 tools/art/generate.py class class:bard # specific ids (re-generates)
"""
import base64, json, os, sys, time, urllib.request
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
API = os.environ.get("FORGE_IMAGE_API", "http://192.168.31.201:3000/v1")
MODELS = os.environ.get("FORGE_IMAGE_MODELS", "gpt-image-2,codex-gpt-image-2").split(",")
KEY = os.environ.get("FORGE_IMAGE_KEY") or open(os.environ["FORGE_IMAGE_KEY_FILE"]).read().strip()


def call(model: str, prompt: str, size: str) -> bytes:
    body = json.dumps({"model": model, "prompt": prompt, "size": size, "n": 1}).encode()
    req = urllib.request.Request(f"{API}/images/generations", data=body, headers={"Authorization": f"Bearer {KEY}", "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=600) as r:
        item = json.load(r)["data"][0]
    if item.get("b64_json"):
        return base64.b64decode(item["b64_json"])
    with urllib.request.urlopen(item["url"], timeout=120) as r:
        return r.read()


def one(set_name: str, size: str, ent_id: str, prompt: str):
    out = os.path.join(HERE, "raw", set_name, ent_id.split(":", 1)[1] + ".png")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    for attempt in range(4):
        model = MODELS[attempt % len(MODELS)]
        t = time.time()
        try:
            open(out, "wb").write(call(model, prompt, size))
            print(f"ok   {ent_id} ({model}, {time.time() - t:.0f}s)", flush=True)
            return
        except Exception as e:  # 524s from the gateway happen; retry with the next model
            print(f"fail {ent_id} ({model}): {e}", flush=True)
    print(f"GAVE UP {ent_id}", flush=True)


def main():
    cfg = json.load(open(os.path.join(HERE, "prompts.json")))
    set_name, only = sys.argv[1], set(sys.argv[2:])
    s = cfg["sets"][set_name]
    jobs = []
    for ent_id, subject in s["items"].items():
        out = os.path.join(HERE, "raw", set_name, ent_id.split(":", 1)[1] + ".png")
        if only and ent_id not in only:
            continue
        if not only and os.path.exists(out):
            continue
        jobs.append((ent_id, f"{cfg['style']}\nSubject: {subject}. {s['framing']}"))
    with ThreadPoolExecutor(3) as ex:
        for ent_id, prompt in jobs:
            ex.submit(one, set_name, s["size"], ent_id, prompt)


if __name__ == "__main__":
    main()
