#!/bin/bash
# Chạy song song: phân loại trên GPU 0, sinh trên GPU 1. Log ở out/*.log
cd /workspace/mathgen
source /venv/main/bin/activate
export HF_HOME=/workspace/.hf_home PYTHONUNBUFFERED=1
mkdir -p out
CUDA_VISIBLE_DEVICES=0 setsid nohup python train/train_classifier.py --data data/splits/classify --out out/classifier > out/classifier.log 2>&1 < /dev/null &
CUDA_VISIBLE_DEVICES=1 setsid nohup python train/train_generator.py --data data/splits/generate --out out/generator > out/generator.log 2>&1 < /dev/null &
