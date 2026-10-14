"""ViShield academic dashboard. Run with: streamlit run src/vishield/dashboard/app.py"""

from __future__ import annotations

import html
import json
from pathlib import Path

import pandas as pd
import plotly.graph_objects as go
import streamlit as st

from vishield import MODEL_VERSION, __version__
from vishield.config import get_settings
from vishield.dashboard.client import ClientError, build_client
from vishield.domain.models import AnalysisResult, BatchItem, RiskLevel
from vishield.domain.safety import ETHICS_BANNER

st.set_page_config(page_title="ViShield", page_icon="🛡️", layout="wide")

LEVEL_COLOR = {RiskLevel.LOW: "#2e7d32", RiskLevel.MEDIUM: "#ef6c00", RiskLevel.HIGH: "#c62828"}
CONSENT_TEXT = (
    "I confirm this recording/transcript is synthetic, public-domain, or every speaker has "
    "given explicit consent, and that I will use the result only for defensive awareness."
)


@st.cache_resource(show_spinner=False)
def _client():  # type: ignore[no-untyped-def]
    return build_client(get_settings())


def banner() -> None:
    st.warning(ETHICS_BANNER, icon="⚠️")


# --------------------------------------------------------------------------- result rendering
def gauge(result: AnalysisResult) -> go.Figure:
    color = LEVEL_COLOR[result.risk_level]
    fig = go.Figure(
        go.Indicator(
            mode="gauge+number",
            value=result.risk_score,
            number={"suffix": " / 100"},
            title={"text": f"Risk: {result.risk_level.value.upper()}"},
            gauge={
                "axis": {"range": [0, 100]},
                "bar": {"color": color},
                "steps": [
                    {"range": [0, 35], "color": "#e8f5e9"},
                    {"range": [35, 65], "color": "#fff3e0"},
                    {"range": [65, 100], "color": "#ffebee"},
                ],
            },
        )
    )
    fig.update_layout(height=280, margin={"l": 30, "r": 30, "t": 60, "b": 20})
    return fig


def highlighted_transcript(result: AnalysisResult) -> str:
    text = result.redacted_transcript
    spans = sorted(
        ((e.start, e.end) for i in result.indicators for e in i.evidence), key=lambda s: s[0]
    )
    out: list[str] = []
    cursor = 0
    for start, end in spans:
        if start < cursor:
            continue
        out.append(html.escape(text[cursor:start]))
        out.append(f"<mark>{html.escape(text[start:end])}</mark>")
        cursor = end
    out.append(html.escape(text[cursor:]))
    return "<div style='line-height:1.7;font-size:1.02rem'>" + "".join(out) + "</div>"


def render_result(result: AnalysisResult) -> None:
    left, right = st.columns([1, 2])
    with left:
        st.plotly_chart(gauge(result), use_container_width=True)
        st.metric("Reviewer confidence aid", f"{result.confidence:.2f}")
        st.caption(
            f"Model {result.model_version} · {result.processing_ms} ms · {result.input_kind}"
        )
    with right:
        st.subheader("Transcript (automatically redacted)")
        st.markdown(highlighted_transcript(result), unsafe_allow_html=True)
        if result.redaction_counts:
            st.caption(f"Redacted sensitive items: {result.redaction_counts}")
        with st.expander("📋 Copy / view plain transcript", expanded=False):
            st.text_area(
                "Full transcribed text",
                value=result.redacted_transcript,
                height=100,
                disabled=True,
                label_visibility="collapsed",
            )

    st.subheader("Detected indicators")
    if not result.indicators:
        st.success("No rule-based indicators fired. Stay alert: rules cannot catch every tactic.")
    cols = st.columns(min(4, max(1, len(result.indicators))))
    for idx, ind in enumerate(result.indicators):
        with cols[idx % len(cols)], st.container(border=True):
            st.markdown(f"**{ind.title}**")
            st.progress(ind.severity, text=f"severity {ind.severity:.2f} · {ind.hits} hit(s)")
            st.caption(ind.description)
            for e in ind.evidence[:3]:
                st.markdown(f"› `{e.text}`")

    st.subheader("Evidence and explanation")
    st.write(result.explanation)
    c1, c2 = st.columns(2)
    with c1:
        comp = result.components.model_dump()
        st.markdown("**Component scores**")
        st.json({k: v for k, v in comp.items() if v is not None})
    with c2:
        if result.top_features:
            df = pd.DataFrame([f.model_dump() for f in result.top_features])
            fig = go.Figure(
                go.Bar(
                    x=df["weight"],
                    y=df["feature"],
                    orientation="h",
                    marker_color=["#c62828" if w > 0 else "#2e7d32" for w in df["weight"]],
                )
            )
            fig.update_layout(
                title="Influential text features (tf-idf × coefficient)",
                height=300,
                margin={"l": 10, "r": 10, "t": 40, "b": 10},
                yaxis={"autorange": "reversed"},
            )
            st.plotly_chart(fig, use_container_width=True)
        else:
            st.info("No ML model loaded; run `make train` to enable feature attributions.")
    if result.acoustic:
        with st.expander("Acoustic summary (aggregate statistics only)"):
            st.json(result.acoustic.model_dump())
            if result.components.synthetic_voice_score is not None:
                st.warning(
                    "Synthetic-voice score is experimental and may be inaccurate.", icon="🧪"
                )

    st.subheader("Safety recommendations")
    for tip in result.recommendations:
        st.markdown(f"- {tip}")
    st.info(result.disclaimer, icon="ℹ️")


def run_analysis(fn, *args):  # type: ignore[no-untyped-def]
    progress = st.progress(0, text="Validating input…")
    try:
        progress.progress(30, text="Transcribing / redacting…")
        result = fn(*args)
        progress.progress(100, text="Done")
        st.session_state["last_result"] = result
    except ClientError as exc:
        progress.empty()
        st.error(f"{exc.message} (code: {exc.code})")
        return
    progress.empty()
    render_result(result)


# --------------------------------------------------------------------------- pages
def page_analyze() -> None:
    client = _client()
    tab_upload, tab_record, tab_text = st.tabs(
        ["Upload audio", "Record (consent)", "Typed transcript"]
    )
    settings = get_settings()

    with tab_upload:
        st.caption(
            f"WAV, MP3 or M4A · max {settings.max_file_mb:g} MB · max "
            f"{settings.max_duration_seconds:g} s. Audio is processed in memory and not stored."
        )
        up = st.file_uploader("Choose a file", type=["wav", "mp3", "m4a"], key="upload")
        consent_up = st.checkbox(CONSENT_TEXT, key="consent_upload")
        if st.button("Analyse upload", disabled=not (up and consent_up), type="primary"):
            run_analysis(client.analyze_audio, up.getvalue(), up.name, up.type)

    with tab_record:
        st.caption(
            "Record a short synthetic demo in your browser. Nothing is uploaded until you press Analyse."
        )
        consent_rec = st.checkbox(CONSENT_TEXT, key="consent_record")
        rec = st.audio_input("Record", disabled=not consent_rec, key="recording")
        if st.button("Analyse recording", disabled=not (rec and consent_rec), type="primary"):
            run_analysis(client.analyze_audio, rec.getvalue(), "recording.wav", "audio/wav")

    with tab_text:
        st.caption(
            "Low-resource mode: paste a fictional transcript. Useful when no STT model is installed."
        )
        examples = _example_transcripts()
        chosen = st.selectbox("Load an example", ["(none)", *examples])
        default = examples.get(chosen, "")
        text = st.text_area("Transcript", value=default, height=180, max_chars=20_000)
        consent_txt = st.checkbox(CONSENT_TEXT, key="consent_text", value=chosen != "(none)")
        if st.button(
            "Analyse transcript", disabled=not (text.strip() and consent_txt), type="primary"
        ):
            run_analysis(client.analyze_transcript, text)


@st.cache_data(show_spinner=False)
def _example_transcripts() -> dict[str, str]:
    path = get_settings().dataset_path
    if not Path(path).exists():
        return {}
    out: dict[str, str] = {}
    with open(path, encoding="utf-8") as fh:
        for line in fh:
            rec = json.loads(line)
            key = f"{rec['id']} · {rec['category']}"
            out[key] = rec["text"]
    return out


def page_batch() -> None:
    client = _client()
    st.subheader("Batch evaluation")
    st.caption(
        "Upload a JSONL/CSV with columns `id, transcript, label` (label optional: phishing|legitimate), "
        "or evaluate the held-out test split. Metrics are computed from the data you supply."
    )
    source = st.radio("Source", ["Held-out test split", "Upload file"], horizontal=True)
    items: list[BatchItem] = []
    if source == "Held-out test split":
        path = get_settings().splits_dir / "test.jsonl"
        if not path.exists():
            st.error("data/splits/test.jsonl missing. Run `make data` first.")
            return
        with open(path, encoding="utf-8") as fh:
            for line in fh:
                rec = json.loads(line)
                items.append(BatchItem(id=rec["id"], transcript=rec["text"], label=rec["label"]))
    else:
        f = st.file_uploader("JSONL or CSV", type=["jsonl", "csv"])
        if f is None:
            return
        if f.name.endswith(".csv"):
            df = pd.read_csv(f)
        else:
            df = pd.read_json(f, lines=True)
            if "text" in df.columns and "transcript" not in df.columns:
                df = df.rename(columns={"text": "transcript"})
        for _, row in df.iterrows():
            label = row.get("label") if "label" in df.columns else None
            items.append(
                BatchItem(
                    id=str(row["id"]),
                    transcript=str(row["transcript"]),
                    label=None if pd.isna(label) else str(label),
                )
            )
    st.write(f"{len(items)} item(s) loaded.")
    if st.button("Run batch evaluation", type="primary"):
        with st.spinner("Scoring…"):
            try:
                resp = client.evaluate_batch(items)
            except ClientError as exc:
                st.error(exc.message)
                return
        m = resp.metrics
        if m.labels_present:
            c = st.columns(5)
            c[0].metric("Accuracy", f"{m.accuracy:.2f}")
            c[1].metric("Precision", f"{m.precision:.2f}")
            c[2].metric("Recall", f"{m.recall:.2f}")
            c[3].metric("F1", f"{m.f1:.2f}")
            c[4].metric("ROC-AUC", "n/a" if m.roc_auc is None else f"{m.roc_auc:.2f}")
            cm = m.confusion_matrix or [[0, 0], [0, 0]]
            fig = go.Figure(
                go.Heatmap(
                    z=cm,
                    x=["pred legitimate", "pred phishing"],
                    y=["true legitimate", "true phishing"],
                    text=cm,
                    texttemplate="%{text}",
                    colorscale="Blues",
                    showscale=False,
                )
            )
            fig.update_layout(
                title=f"Confusion matrix (n={m.n})", height=320, yaxis={"autorange": "reversed"}
            )
            st.plotly_chart(fig, use_container_width=False)
            st.caption(
                "Numbers come from a tiny fictional dataset and do not indicate real-world performance."
            )
        else:
            st.info("No labels supplied; showing predictions only.")
        df_out = pd.DataFrame([r.model_dump() for r in resp.results])
        st.dataframe(df_out, use_container_width=True)
        st.download_button("Download results CSV", df_out.to_csv(index=False), "vishield_batch.csv")


def page_model() -> None:
    client = _client()
    st.subheader("Model information")
    try:
        info = client.model_info()
    except ClientError as exc:
        st.error(exc.message)
        return
    st.json(info.model_dump())
    st.markdown(
        """
**Pipeline.** Redaction → rule engine (8 indicator families) → TF-IDF(1-2gram) + logistic regression
→ optional acoustic pressure heuristic → weighted fusion → thresholds → recommendations.

**Explainability.** Every rule hit carries a character span; every ML prediction reports
tf-idf × coefficient contributions; fusion weights actually used are returned with each result.
"""
    )
    report = Path("reports/metrics.json")
    if report.exists():
        st.markdown("**Latest offline evaluation (`make evaluate`)**")
        st.json(json.loads(report.read_text(encoding="utf-8")))
    else:
        st.info("Run `make evaluate` to produce reports/metrics.json.")


def page_limitations() -> None:
    client = _client()
    st.subheader("Limitations, ethics and safety")
    policy = client.safety_policy()
    st.markdown(f"**Purpose.** {policy.purpose}")
    c1, c2 = st.columns(2)
    with c1:
        st.markdown("**Permitted uses**")
        for p in policy.permitted_uses:
            st.markdown(f"- {p}")
        st.markdown("**Data handling**")
        for p in policy.data_handling:
            st.markdown(f"- {p}")
    with c2:
        st.markdown("**Prohibited uses**")
        for p in policy.prohibited_uses:
            st.markdown(f"- {p}")
    st.markdown("**Known limitations**")
    st.markdown(
        """
- Trained on 80 fictional English transcripts: results do not generalise to real calls, other
  languages, code-switching or new scam scripts.
- Rules are keyword-based; negations such as "we will never ask for your OTP" can trigger them.
- Transcription errors propagate; the mock backend returns fixed text.
- The acoustic and synthetic-voice signals are hand-written heuristics, not trained detectors.
- Confidence is a transparency heuristic, not a calibrated probability.
- The tool is an awareness aid. It requires human review and is not evidence of wrongdoing.
"""
    )
    st.info(policy.disclaimer)


def main() -> None:
    banner()
    st.title("🛡️ ViShield")
    st.caption(
        f"Explainable Voice Phishing Detection and Awareness Platform · v{__version__} · "
        f"model {MODEL_VERSION} · backend: {_client().mode}"
    )
    page = st.sidebar.radio(
        "Navigate", ["Analyze", "Batch evaluation", "Model information", "Limitations & ethics"]
    )
    st.sidebar.markdown("---")
    st.sidebar.markdown(
        "**Academic, defensive prototype**\n\n"
        "No calls are placed. No audio is stored. No phishing content is generated."
    )
    {
        "Analyze": page_analyze,
        "Batch evaluation": page_batch,
        "Model information": page_model,
        "Limitations & ethics": page_limitations,
    }[page]()


main()
