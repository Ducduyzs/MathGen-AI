#!/bin/bash
# GPU 0: XLM-R base có đề thật · GPU 1: cùng cấu hình nhưng không dùng đề thật (mốc so sánh)
cd /workspace/mathgen
source /venv/main/bin/activate
export HF_HUB_OFFLINE=1 TRANSFORMERS_OFFLINE=1 PYTHONUNBUFFERED=1
mkdir -p out
M=/workspace/models/xlm-roberta-base
D=data/splits/classify
CUDA_VISIBLE_DEVICES=0 python train/train_classifier.py --model $M --data $D --out out/base_real --real-upsample 20 --epochs 4 > out/base_real.log 2>&1 &
CUDA_VISIBLE_DEVICES=1 python train/train_classifier.py --model $M --data $D --out out/base_noreal --real-upsample 0 --epochs 3 > out/base_noreal.log 2>&1 &
wait

# GPU 0: XLM-R large có đề thật · GPU 1: XLM-R base, nhân đề thật 40 lần
cd /workspace/mathgen
source /venv/main/bin/activate
export HF_HUB_OFFLINE=1 TRANSFORMERS_OFFLINE=1 PYTHONUNBUFFERED=1
D=data/splits/classify
CUDA_VISIBLE_DEVICES=0 python train/train_classifier.py --model /workspace/models/xlm-roberta-large --data $D --out out/large_real --real-upsample 20 --epochs 3 --bs 32 --lr 1.5e-5 > out/large_real.log 2>&1 &
CUDA_VISIBLE_DEVICES=1 python train/train_classifier.py --model /workspace/models/xlm-roberta-base --data $D --out out/base_real40 --real-upsample 40 --epochs 4 > out/base_real40.log 2>&1 &
wait
