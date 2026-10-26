"""Mô hình phân loại đa nhiệm: chủ đề (14 lớp), cấp lớp (5), lớp cụ thể 6–12, độ khó (0–1).

Một bộ mã hóa (mặc định XLM-R base, đa ngữ) + 4 đầu ra. Mất mát từng đầu chỉ tính trên dòng có nhãn đó.
Khi train dùng mọi nhãn (cả nhãn yếu); khi chấm chỉ dùng nhãn exact/source (xem ml/README.md).
So sánh với mốc: bộ đoán chủ đề bằng từ khóa (cách pipeline đang làm).

    python train/train_classifier.py --data data/splits/classify --out out/classifier
"""

import argparse
import json
import math
import random
import sys
import time
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
from scipy.stats import spearmanr
from sklearn.metrics import accuracy_score, f1_score
from torch.utils.data import DataLoader
from transformers import AutoModel, AutoTokenizer, get_linear_schedule_with_warmup

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from normalize import TOPICS, weak_topic  # noqa: E402  (mốc so sánh: đoán bằng từ khóa)

BANDS = ["primary", "lower_secondary", "upper_secondary", "school", "competition"]
GRADES = list(range(6, 13))
RELIABLE = {"exact", "source"}


def load(path: Path) -> list[dict]:
    with path.open(encoding="utf-8") as fh:
        return [json.loads(line) for line in fh]


def targets(r: dict, for_eval: bool) -> tuple[int, int, int, float]:
    """Nhãn dạng số; -100 / nan = không có nhãn (hoặc nhãn không đủ tin cậy để chấm)."""
    lab, src = r["labels"], r["label_src"]
    ok = (lambda f: src.get(f) in RELIABLE) if for_eval else (lambda f: True)
    topic = TOPICS.index(lab["topic"]) if lab.get("topic") in TOPICS and ok("topic") else -100
    band = BANDS.index(lab["grade_band"]) if lab.get("grade_band") in BANDS and ok("grade_band") else -100
    grade = GRADES.index(lab["grade"]) if lab.get("grade") in GRADES else -100  # lớp cụ thể luôn là nhãn exact/source
    diff = lab.get("difficulty")
    diff = float(diff) if diff is not None and (not for_eval or src.get("difficulty") in RELIABLE) else float("nan")
    return topic, band, grade, diff


class MultiHead(nn.Module):
    def __init__(self, name: str):
        super().__init__()
        self.enc = AutoModel.from_pretrained(name)
        h = self.enc.config.hidden_size
        self.drop = nn.Dropout(0.1)
        self.topic, self.band, self.grade, self.diff = nn.Linear(h, len(TOPICS)), nn.Linear(h, len(BANDS)), nn.Linear(h, len(GRADES)), nn.Linear(h, 1)

    def forward(self, input_ids, attention_mask):
        x = self.drop(self.enc(input_ids=input_ids, attention_mask=attention_mask).last_hidden_state[:, 0])
        return self.topic(x), self.band(x), self.grade(x), torch.sigmoid(self.diff(x)).squeeze(-1)


def make_loader(rows, tok, for_eval, bs, max_len, shuffle):
    def collate(batch):
        enc = tok([r["text"] for r in batch], truncation=True, max_length=max_len, padding=True, return_tensors="pt")
        t = [targets(r, for_eval) for r in batch]
        return enc, torch.tensor([x[0] for x in t]), torch.tensor([x[1] for x in t]), torch.tensor([x[2] for x in t]), torch.tensor([x[3] for x in t])
    return DataLoader(rows, batch_size=bs, shuffle=shuffle, collate_fn=collate, num_workers=2)


ce = nn.CrossEntropyLoss(ignore_index=-100)


def loss_fn(out, yt, yb, yg, yd):
    lt, lb, lg, ld = out
    loss = torch.zeros((), device=lt.device)
    for logits, y, w in ((lt, yt, 1.0), (lb, yb, 0.5), (lg, yg, 0.5)):
        if (y != -100).any():
            loss = loss + w * ce(logits.float(), y)
    m = ~torch.isnan(yd)
    if m.any():
        loss = loss + 0.5 * nn.functional.mse_loss(ld.float()[m], yd[m])
    return loss


@torch.no_grad()
def evaluate(model, rows, tok, args, device) -> dict:
    model.eval()
    P = {k: [] for k in ("t", "b", "g", "d")}
    Y = {k: [] for k in ("t", "b", "g", "d")}
    for enc, yt, yb, yg, yd in make_loader(rows, tok, True, args.bs * 2, args.max_len, False):
        with torch.autocast("cuda", dtype=torch.bfloat16):
            lt, lb, lg, ld = model(enc["input_ids"].to(device), enc["attention_mask"].to(device))
        for k, logits, y in (("t", lt, yt), ("b", lb, yb), ("g", lg, yg)):
            P[k] += logits.argmax(-1).cpu().tolist()
            Y[k] += y.tolist()
        P["d"] += ld.float().cpu().tolist()
        Y["d"] += yd.tolist()

    res: dict = {"n": len(rows)}
    for k, name in (("t", "topic"), ("b", "grade_band"), ("g", "grade")):
        idx = [i for i, y in enumerate(Y[k]) if y != -100]
        if idx:
            y, p = [Y[k][i] for i in idx], [P[k][i] for i in idx]
            res[name] = {"n": len(idx), "acc": round(accuracy_score(y, p), 4), "macro_f1": round(f1_score(y, p, average="macro"), 4)}
            if k == "g":
                res[name]["within_1"] = round(float(np.mean([abs(a - b) <= 1 for a, b in zip(y, p)])), 4)
            if k == "t":  # mốc: đoán bằng từ khóa trên cùng các dòng
                base = [TOPICS.index(weak_topic(rows[i]["text"], rows[i]["lang"]) or "other") for i in idx]
                res[name]["keyword_baseline_acc"] = round(accuracy_score(y, base), 4)
                by_src: dict = {}
                for i, a, b in zip(idx, y, p):
                    s = rows[i]["source"]
                    by_src.setdefault(s, []).append(a == b)
                res[name]["acc_by_source"] = {s: round(float(np.mean(v)), 4) for s, v in by_src.items()}
    idx = [i for i, y in enumerate(Y["d"]) if not math.isnan(y)]
    if len(idx) > 2:
        y, p = np.array([Y["d"][i] for i in idx]), np.array([P["d"][i] for i in idx])
        res["difficulty"] = {"n": len(idx), "mae": round(float(np.abs(y - p).mean()), 4), "spearman": round(float(spearmanr(y, p).statistic), 4)}
    model.train()
    return res


def score(m: dict) -> float:
    parts = [m[k]["macro_f1"] for k in ("topic", "grade_band", "grade") if k in m]
    return float(np.mean(parts)) if parts else 0.0


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default="data/splits/classify")
    ap.add_argument("--out", default="out/classifier")
    ap.add_argument("--model", default="FacebookAI/xlm-roberta-base")
    ap.add_argument("--epochs", type=int, default=3)
    ap.add_argument("--bs", type=int, default=64)
    ap.add_argument("--lr", type=float, default=3e-5)
    ap.add_argument("--max-len", type=int, default=256)
    ap.add_argument("--seed", type=int, default=2026)
    args = ap.parse_args()

    random.seed(args.seed)
    torch.manual_seed(args.seed)
    data, out = Path(args.data), Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    device = "cuda"

    train = load(data / "train.jsonl")
    evals = {s: load(data / f"{s}.jsonl") for s in ("val", "test", "test_unseen_templates")}
    print(f"train {len(train)} · " + " · ".join(f"{k} {len(v)}" for k, v in evals.items()), flush=True)

    tok = AutoTokenizer.from_pretrained(args.model)
    model = MultiHead(args.model).to(device)
    loader = make_loader(train, tok, False, args.bs, args.max_len, True)
    opt = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=0.01)
    total = len(loader) * args.epochs
    sched = get_linear_schedule_with_warmup(opt, int(0.06 * total), total)

    history, best, step, t0 = [], -1.0, 0, time.time()
    for epoch in range(args.epochs):
        for enc, yt, yb, yg, yd in loader:
            with torch.autocast("cuda", dtype=torch.bfloat16):
                outs = model(enc["input_ids"].to(device), enc["attention_mask"].to(device))
            loss = loss_fn(outs, yt.to(device), yb.to(device), yg.to(device), yd.to(device))
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            opt.step()
            sched.step()
            opt.zero_grad(set_to_none=True)
            step += 1
            if step % 100 == 0:
                print(f"epoch {epoch + 1} step {step}/{total} loss {loss.item():.4f} · {(time.time() - t0) / 60:.1f} phút", flush=True)
        val = evaluate(model, evals["val"], tok, args, device)
        history.append({"epoch": epoch + 1, "val": val})
        print(f"== epoch {epoch + 1} val: {json.dumps(val, ensure_ascii=False)}", flush=True)
        if score(val) > best:
            best = score(val)
            torch.save(model.state_dict(), out / "model.pt")
            tok.save_pretrained(out / "tokenizer")
            print(f"   lưu mô hình tốt nhất (điểm {best:.4f})", flush=True)

    model.load_state_dict(torch.load(out / "model.pt", map_location=device))
    final = {s: evaluate(model, rows, tok, args, device) for s, rows in evals.items()}
    meta = {"model": args.model, "args": vars(args), "labels": {"topic": TOPICS, "grade_band": BANDS, "grade": GRADES},
            "history": history, "final": final, "minutes": round((time.time() - t0) / 60, 1)}
    (out / "metrics.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
    print("== KẾT QUẢ CUỐI\n" + json.dumps(final, ensure_ascii=False, indent=2), flush=True)


if __name__ == "__main__":
    main()
