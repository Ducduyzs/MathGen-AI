"""Mô hình sinh biến thể (bản thí nghiệm): LoRA trên mô hình chat nhỏ, học từ cặp đề gốc → biến thể.

Đầu vào/ra lấy sẵn từ trường `messages` (system / user / assistant = JSON {statement, answer, …}).
Chỉ tính mất mát trên phần trả lời. Sau khi train, sinh thử trên đề gốc của tập test → samples.jsonl
để chạy bộ kiểm chứng (apps/web: npm run ml:verify).

    python train/train_generator.py --data data/splits/generate --out out/generator
    python train/train_generator.py --sample-only --out out/generator     # chỉ sinh lại mẫu từ adapter đã lưu
"""

import argparse
import json
import math
import random
import time
from pathlib import Path

import torch
from peft import LoraConfig, PeftModel, get_peft_model
from transformers import AutoModelForCausalLM, AutoTokenizer, get_cosine_schedule_with_warmup


def load(path: Path) -> list[dict]:
    with path.open(encoding="utf-8") as fh:
        return [json.loads(line) for line in fh]


def build_examples(rows, tok, max_len):
    out, skipped = [], 0
    for r in rows:
        msgs = r["messages"]
        prompt = tok.apply_chat_template(msgs[:-1], tokenize=False, add_generation_prompt=True)
        full = tok.apply_chat_template(msgs, tokenize=False)
        p_ids = tok(prompt, add_special_tokens=False)["input_ids"]
        f_ids = tok(full, add_special_tokens=False)["input_ids"]
        if len(f_ids) > max_len or f_ids[: len(p_ids)] != p_ids:
            skipped += 1
            continue
        out.append({"input_ids": f_ids, "labels": [-100] * len(p_ids) + f_ids[len(p_ids):]})
    return out, skipped


def batches(examples, bs, pad_id, shuffle=True):
    """Gom theo độ dài để giảm phần đệm, rồi xáo thứ tự các lô."""
    order = sorted(range(len(examples)), key=lambda i: len(examples[i]["input_ids"]))
    chunks = [order[i : i + bs] for i in range(0, len(order), bs)]
    if shuffle:
        random.shuffle(chunks)
    for idx in chunks:
        L = max(len(examples[i]["input_ids"]) for i in idx)
        ids = torch.full((len(idx), L), pad_id)
        lab = torch.full((len(idx), L), -100)
        att = torch.zeros((len(idx), L), dtype=torch.long)
        for j, i in enumerate(idx):
            e = examples[i]
            n = len(e["input_ids"])
            ids[j, :n], lab[j, :n], att[j, :n] = torch.tensor(e["input_ids"]), torch.tensor(e["labels"]), 1
        yield ids, att, lab


@torch.no_grad()
def eval_loss(model, examples, bs, pad_id):
    model.eval()
    tot, n = 0.0, 0
    for ids, att, lab in batches(examples, bs, pad_id, shuffle=False):
        out = model(input_ids=ids.cuda(), attention_mask=att.cuda(), labels=lab.cuda())
        tot += out.loss.item() * ids.size(0)
        n += ids.size(0)
    model.train()
    return tot / max(1, n)


@torch.no_grad()
def sample(model, tok, rows, out_path: Path, bs=16, max_new=384):
    model.eval()
    tok.padding_side = "left"
    with out_path.open("w", encoding="utf-8") as fh:
        for i in range(0, len(rows), bs):
            chunk = rows[i : i + bs]
            prompts = [tok.apply_chat_template(r["messages"][:-1], tokenize=False, add_generation_prompt=True) for r in chunk]
            enc = tok(prompts, return_tensors="pt", padding=True, add_special_tokens=False).to("cuda")
            gen = model.generate(**enc, max_new_tokens=max_new, do_sample=True, temperature=0.7, top_p=0.9, pad_token_id=tok.pad_token_id)
            for r, g in zip(chunk, gen[:, enc["input_ids"].shape[1]:]):
                fh.write(json.dumps({
                    "id": r["id"], "source": r["source"], "lang": r["lang"], "relation": r["relation"],
                    "seed": r["seed"], "reference": r["target"], "meta": r.get("meta", {}),
                    "output": tok.decode(g, skip_special_tokens=True),
                }, ensure_ascii=False) + "\n")
            print(f"  sinh mẫu {min(i + bs, len(rows))}/{len(rows)}", flush=True)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default="data/splits/generate")
    ap.add_argument("--out", default="out/generator")
    ap.add_argument("--model", default="Qwen/Qwen2.5-1.5B-Instruct")
    ap.add_argument("--max-meta", type=int, default=20000, help="số cặp MetaMathQA (tiếng Anh) dùng để train")
    ap.add_argument("--vi-upsample", type=int, default=2, help="nhân bản cặp tiếng Việt để không bị lấn át")
    ap.add_argument("--epochs", type=int, default=1)
    ap.add_argument("--bs", type=int, default=8)
    ap.add_argument("--grad-accum", type=int, default=4)
    ap.add_argument("--lr", type=float, default=2e-4)
    ap.add_argument("--max-len", type=int, default=768)
    ap.add_argument("--rank", type=int, default=16)
    ap.add_argument("--n-sample-vi", type=int, default=300)
    ap.add_argument("--n-sample-en", type=int, default=60)
    ap.add_argument("--sample-only", action="store_true")
    ap.add_argument("--seed", type=int, default=2026)
    args = ap.parse_args()

    random.seed(args.seed)
    torch.manual_seed(args.seed)
    data, out = Path(args.data), Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    tok = AutoTokenizer.from_pretrained(args.model)
    if tok.pad_token is None:
        tok.pad_token = tok.eos_token
    base = AutoModelForCausalLM.from_pretrained(args.model, dtype=torch.bfloat16).cuda()

    test = load(data / "test.jsonl")
    vi_test = [r for r in test if r["lang"] == "vi"]
    en_test = [r for r in test if r["lang"] == "en"]
    random.shuffle(vi_test)
    random.shuffle(en_test)
    sample_rows = vi_test[: args.n_sample_vi] + en_test[: args.n_sample_en]

    if args.sample_only:
        model = PeftModel.from_pretrained(base, out / "adapter")
        sample(model, tok, sample_rows, out / "samples.jsonl")
        return

    rows = load(data / "train.jsonl")
    vi = [r for r in rows if r["lang"] == "vi"]
    en = [r for r in rows if r["lang"] == "en"]
    random.shuffle(en)
    train_rows = vi * args.vi_upsample + en[: args.max_meta]
    examples, skipped = build_examples(train_rows, tok, args.max_len)
    val_ex, _ = build_examples(load(data / "val.jsonl")[:600], tok, args.max_len)
    n_tok = sum(len(e["input_ids"]) for e in examples)
    print(f"train {len(examples)} ví dụ ({len(vi)}×{args.vi_upsample} tiếng Việt + {min(len(en), args.max_meta)} tiếng Anh), "
          f"bỏ {skipped} quá dài · {n_tok / 1e6:.1f} triệu token/epoch · val {len(val_ex)}", flush=True)

    base.gradient_checkpointing_enable()
    base.enable_input_require_grads()
    model = get_peft_model(base, LoraConfig(
        r=args.rank, lora_alpha=2 * args.rank, lora_dropout=0.05, task_type="CAUSAL_LM",
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
    ))
    model.print_trainable_parameters()

    opt = torch.optim.AdamW([p for p in model.parameters() if p.requires_grad], lr=args.lr, weight_decay=0.0)
    steps = math.ceil(len(examples) / args.bs / args.grad_accum) * args.epochs
    sched = get_cosine_schedule_with_warmup(opt, max(1, int(0.03 * steps)), steps)
    history = [{"step": 0, "val_loss": round(eval_loss(model, val_ex, args.bs, tok.pad_token_id), 4)}]
    print(f"val loss trước khi train: {history[0]['val_loss']}", flush=True)

    t0, step, micro, seen_tok = time.time(), 0, 0, 0
    model.train()
    for epoch in range(args.epochs):
        for ids, att, lab in batches(examples, args.bs, tok.pad_token_id):
            loss = model(input_ids=ids.cuda(), attention_mask=att.cuda(), labels=lab.cuda()).loss / args.grad_accum
            loss.backward()
            seen_tok += int(att.sum())
            micro += 1
            if micro % args.grad_accum:
                continue
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            opt.step()
            sched.step()
            opt.zero_grad(set_to_none=True)
            step += 1
            if step % 20 == 0:
                el = time.time() - t0
                print(f"step {step}/{steps} loss {loss.item() * args.grad_accum:.4f} · {seen_tok / el:.0f} token/s · "
                      f"{el / 60:.1f} phút · còn ~{el / step * (steps - step) / 60:.0f} phút", flush=True)
            if step % 300 == 0:
                model.save_pretrained(out / "adapter")  # checkpoint giữa chừng
        vl = eval_loss(model, val_ex, args.bs, tok.pad_token_id)
        history.append({"step": step, "epoch": epoch + 1, "val_loss": round(vl, 4)})
        print(f"== epoch {epoch + 1}: val loss {vl:.4f}", flush=True)

    model.save_pretrained(out / "adapter")
    tok.save_pretrained(out / "adapter")
    meta = {"model": args.model, "args": vars(args), "train_examples": len(examples), "tokens_per_epoch": n_tok,
            "history": history, "minutes": round((time.time() - t0) / 60, 1)}
    (out / "metrics.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
    print("Sinh mẫu trên tập test để kiểm chứng…", flush=True)
    sample(model, tok, sample_rows, out / "samples.jsonl")
    print("XONG", flush=True)


if __name__ == "__main__":
    main()
