"""Tải dữ liệu thô (parquet) từ Hugging Face về ml/data/raw/<tên nguồn>/.

Dùng API parquet của datasets-server nên không cần thư viện `datasets` (và không chạy script lạ của bộ dữ liệu).

    python scripts/collect.py                       # mọi nguồn tier=open
    python scripts/collect.py --sources gsm8k svamp
    python scripts/collect.py --include-flagged     # thêm nguồn flagged (thí nghiệm nội bộ)
"""

import argparse
import json
import sys
import time
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).parent))
from sources import BY_NAME, SOURCES, Source  # noqa: E402

RAW = Path(__file__).resolve().parents[1] / "data" / "raw"
API = "https://datasets-server.huggingface.co/parquet"


def list_files(src: Source) -> list[dict]:
    files = requests.get(API, params={"dataset": src.repo}, timeout=60).json().get("parquet_files", [])
    files = [f for f in files if (not src.configs or f["config"] in src.configs) and f["split"] in src.splits]
    files.sort(key=lambda f: (f["config"], f["split"], f["filename"]))
    if src.max_files is not None:
        files = files[: src.max_files]
    return files


def download(url: str, dest: Path, attempts: int = 4) -> None:
    """Tải vào file .part rồi mới đổi tên, để lần chạy sau không nhầm file dở là đã xong. Lỗi mạng thì thử lại."""
    tmp = dest.with_suffix(".part")
    for i in range(attempts):
        try:
            with requests.get(url, stream=True, timeout=300) as r:
                r.raise_for_status()
                with tmp.open("wb") as fh:
                    for chunk in r.iter_content(1 << 20):
                        fh.write(chunk)
            tmp.replace(dest)
            return
        except requests.RequestException as e:
            if i == attempts - 1:
                raise
            wait = 5 * 2**i
            print(f"  ! lỗi mạng ({type(e).__name__}), thử lại sau {wait}s")
            time.sleep(wait)


def collect(src: Source) -> dict:
    out = RAW / src.name
    out.mkdir(parents=True, exist_ok=True)
    files = list_files(src)
    got = []
    for f in files:
        dest = out / f"{f['config']}__{f['split']}__{f['filename']}"
        if not dest.exists():
            t = time.time()
            download(f["url"], dest)
            print(f"  ↓ {dest.name} ({f['size'] / 1e6:.1f} MB, {time.time() - t:.0f}s)")
        got.append(dest.name)
    manifest = {
        "name": src.name, "repo": src.repo, "license": src.license, "tier": src.tier, "lang": src.lang,
        "country": src.country, "note": src.note, "files": got, "downloaded_at": time.strftime("%Y-%m-%d"),
    }
    (out / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    return manifest


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--sources", nargs="*", help="tên nguồn (mặc định: mọi nguồn open)")
    ap.add_argument("--include-flagged", action="store_true")
    args = ap.parse_args()

    chosen = [BY_NAME[n] for n in args.sources] if args.sources else [
        s for s in SOURCES if s.tier == "open" or args.include_flagged
    ]
    for s in chosen:
        if s.tier == "flagged" and not args.include_flagged:
            print(f"- bỏ qua {s.name} (flagged, cần --include-flagged)")
            continue
        print(f"- {s.name} [{s.tier}, {s.license}] {s.repo}")
        m = collect(s)
        print(f"  {len(m['files'])} file")


if __name__ == "__main__":
    main()
