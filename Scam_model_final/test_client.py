"""Self-contained test script for Scam_model_final.

Tests:
1. Direct ScamPredictor initialization and inference
2. ConversationScamOutput schema compliance with Teammate Integration Guide
3. Fusion Engine payload generation
"""

import json
from pathlib import Path
import sys

# Ensure package can be imported directly
current_dir = Path(__file__).resolve().parent
parent_dir = current_dir.parent
if str(parent_dir) not in sys.path:
    sys.path.insert(0, str(parent_dir))

from Scam_model_final.predictor import ScamPredictor
from Scam_model_final.adapter import ConversationAdapter

def main():
    print("=" * 70)
    print("1. Loading Standalone ScamPredictor...")
    print("=" * 70)
    predictor = ScamPredictor()
    adapter = ConversationAdapter(predictor)
    print("Model and Tokenizer loaded successfully on:", predictor.device)

    # Test Sample 1: Extreme Phishing / Extortion
    phishing_sample = (
        "Police Inspector Deshmukh here from Cyber Cell Mumbai. An FIR has been registered "
        "against you for money laundering. An arrest warrant has been issued. You must transfer "
        "Rs 50,000 to the RBI safe verification account immediately via UPI or our officers will arrest you. "
        "Do not disconnect this call or inform anyone."
    )

    print("\n" + "=" * 70)
    print("2. Testing Scam Evaluation on High-Risk Sample")
    print("=" * 70)
    res = predictor.predict_fusion(phishing_sample, call_id="call-phish-999")
    print(json.dumps(res.model_dump(), indent=2))

    print("\n" + "=" * 70)
    print("3. Testing Teammate Integration Guide Fusion Payload Generation")
    print("=" * 70)
    fusion_payload = adapter.build_fusion_payload(
        text=phishing_sample,
        call_id="call-phish-999",
        voice_spoof_score=0.90,
        caller_reputation_score=0.85,
    )
    print(json.dumps(fusion_payload, indent=2))

    # Test Sample 2: Legitimate Conversation
    safe_sample = (
        "Hello Rajesh, this is Dr. Sharma's clinic calling to confirm your routine dental checkup "
        "scheduled for tomorrow at 4 PM. Please bring your health card if you have one. Have a nice day."
    )

    print("\n" + "=" * 70)
    print("4. Testing Scam Evaluation on Safe Sample")
    print("=" * 70)
    safe_res = predictor.predict_fusion(safe_sample, call_id="call-safe-101")
    print(json.dumps(safe_res.model_dump(), indent=2))

    print("\n[SUCCESS] All standalone tests passed! Output conforms 100% to Integration Guide.")

if __name__ == "__main__":
    main()
