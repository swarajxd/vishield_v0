"""
score_audio.py  —  Score any audio file through the SSL-AASIST model.
Usage:
    python score_audio.py <path_to_audio>  [--ckpt <checkpoint.pth>]
"""
import sys, os, argparse
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ["HF_HOME"] = "E:/hf_cache"
os.environ["HF_HUB_DISABLE_SYMLINKS_WARNING"] = "1"

import torchaudio
from app.aasist_inference import AASISTInferenceEngine

TARGET_LEN = 64600   # 4.04s @ 16kHz
STEP       = 32300   # 2.02s stride (50% overlap)
DEFAULT_CKPT = r"E:\vieshield\ssl_aasist\checkpoints\best_dev_eer.pth"

parser = argparse.ArgumentParser()
parser.add_argument("audio", help="Path to audio file (wav/flac/mp3/mp4)")
parser.add_argument("--ckpt", default=DEFAULT_CKPT)
args = parser.parse_args()

# ── Load & resample ──────────────────────────────────────────────
ext = os.path.splitext(args.audio)[1].lower()
backend = "ffmpeg" if ext in (".mp3", ".mp4", ".m4a", ".ogg", ".opus") else None
waveform, sr = torchaudio.load(args.audio, **({"backend": backend} if backend else {}))
if sr != 16000:
    waveform = torchaudio.functional.resample(waveform, sr, 16000)
waveform = waveform.mean(dim=0) if waveform.shape[0] > 1 else waveform.squeeze(0)
n = waveform.shape[0]

# ── Chunk ────────────────────────────────────────────────────────
chunks, start = [], 0
while start + TARGET_LEN <= n:
    chunks.append((start / 16000, waveform[start:start + TARGET_LEN]))
    start += STEP
if start < n:
    chunks.append(((n - TARGET_LEN) / 16000, waveform[n - TARGET_LEN:]))

# ── Inference ────────────────────────────────────────────────────
engine = AASISTInferenceEngine(ckpt_path=args.ckpt)

print()
print("=" * 62)
print(f"  FILE    : {os.path.basename(args.audio)}")
print(f"  DURATION: {n/16000:.1f}s   CHUNKS: {len(chunks)}")
print("=" * 62)
print(f"  {'#':>4}  {'Time':>7}  {'Spoof Score':>12}  {'Bar':<22}  Verdict")
print("-" * 62)

scores = []
for i, (ts, chunk) in enumerate(chunks):
    r = engine.score_tensor(chunk, call_id=f"chunk-{i}")
    s = r["voice_spoof_score"]
    scores.append(s)
    verdict = "HIGH RISK " if s >= 0.7 else ("SUSPICIOUS" if s >= 0.4 else "SAFE      ")
    bar = "[" + "#" * int(s * 20) + "-" * (20 - int(s * 20)) + "]"
    print(f"  {i+1:>4}  {ts:>6.1f}s  {s:>12.6f}  {bar}  {verdict}")

avg = sum(scores) / len(scores)
mx  = max(scores)
flagged = sum(1 for s in scores if s > 0.5)

print()
print("=" * 62)
print(f"  Mean score    : {avg:.6f}")
print(f"  Max  score    : {mx:.6f}")
print(f"  Chunks > 0.5  : {flagged} / {len(scores)}")
print()
if avg >= 0.70:
    final = "HIGH RISK  — AI / Synthetic / Cloned voice"
elif avg >= 0.40:
    final = "SUSPICIOUS — Possible synthetic voice"
else:
    final = "SAFE       — Real human voice"
print(f"  FINAL VERDICT : {final}")
print(f"  Fusion payload: voice_spoof_score = {avg:.6f}")
print("=" * 62)
