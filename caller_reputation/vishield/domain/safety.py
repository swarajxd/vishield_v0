"""The project's safety policy, exposed at GET /safety/policy and in the dashboard."""

from __future__ import annotations

from vishield.domain.models import SafetyPolicy

ETHICS_BANNER = (
    "ACADEMIC DEFENSIVE PROTOTYPE. ViShield analyses synthetic, public-domain or explicitly "
    "consented recordings and transcripts to teach voice-phishing awareness. It does not place "
    "calls, does not impersonate anyone, does not clone voices and does not generate phishing "
    "content. Results are indicators for human review, not proof of malicious intent."
)

POLICY = SafetyPolicy(
    purpose=(
        "Help people recognise voice-phishing (vishing) tactics through "
        "explainable, defensive analysis of consented or synthetic audio and transcripts."
    ),
    permitted_uses=[
        "Analysing synthetic or self-recorded demo conversations for awareness training.",
        "Analysing recordings for which every speaker has given explicit, documented consent.",
        "Analysing public-domain or appropriately licensed audio.",
        "Academic evaluation of detection methods on the included fictional dataset.",
    ],
    prohibited_uses=[
        "Placing, automating or recording telephone calls, or connecting to PSTN/SIP/VoIP.",
        "Impersonating any real person, company, bank, government body or police service.",
        "Cloning, imitating or synthesising a real person's voice.",
        "Collecting passwords, OTPs, PINs, banking details or any credentials.",
        "Generating phishing scripts, pretexts or personalised social-engineering content.",
        "Targeting, monitoring or profiling real individuals without consent.",
        "Bypassing consent, authentication or security controls of any system.",
        "Bulk messaging or any offensive security operation.",
    ],
    data_handling=[
        "Uploaded audio is processed in memory and discarded; it is never stored by default.",
        "Transcripts are redacted (phone numbers, emails, URLs, account numbers, OTP-like codes) "
        "before any persistence or logging.",
        "Only anonymised result metadata (scores, indicator names, model version, timings) is "
        "stored in the local SQLite database.",
        "A development-only flag can retain audio for debugging; it must never be enabled for "
        "recordings of real people without written consent.",
    ],
    disclaimer=(
        "Outputs are potential indicators produced by a small academic model trained on a tiny "
        "fictional dataset. They require human review, are not evidence of wrongdoing, and the "
        "synthetic-voice score is experimental and may be inaccurate."
    ),
)


def get_policy() -> SafetyPolicy:
    return POLICY
