# ViShield Scam Detection Model — Standalone Package (`Scam_model_final`)

This directory contains everything required to deploy and run the ViShield Conversation Scam Detection Model independently in any project (including React, Node.js, Next.js, or your teammate's Risk Fusion Engine).

---

## 📂 Directory Structure

```
Scam_model_final/
├── artifacts/
│   ├── best_model.pt       # Trained PyTorch neural model checkpoint (~21 MB)
│   └── tokenizer.json      # Custom 8k vocab BPE tokenizer (~600 KB)
├── model/
│   ├── __init__.py
│   ├── transformer.py      # Standalone Pre-LN Transformer Encoder (RoPE, GELU)
│   ├── evidence_head.py    # Token-level indicator extraction head
│   └── multitask_model.py  # ViShieldMultiTaskModel (Model A + Model B heads)
├── data/
│   ├── __init__.py
│   ├── mask_entities.py    # Regex normalizer (<URL>, <UPI>, <OTP>, <AMOUNT>, <PHONE>)
│   └── schema.py           # Pydantic schemas adhering to Teammate Integration Guide
├── predictor.py            # ScamPredictor class (runs model inference & outputs scores)
├── adapter.py              # Teammate Integration Adapter (bridges to Risk Fusion Engine)
├── api.py                  # Production FastAPI server with CORS enabled for React
├── requirements.txt        # Minimal Python dependencies
├── test_client.py          # Standalone verification script
└── README.md               # Integration & deployment documentation
```

---

## 🚀 Quickstart

### 1. Install Dependencies
```bash
pip install -r Scam_model_final/requirements.txt
```

### 2. Run Self-Test
Verify that the model and tokenizer run properly on your machine:
```bash
python Scam_model_final/test_client.py
```

### 3. Start the FastAPI Server (For React / Web Projects)
```bash
uvicorn Scam_model_final.api:app --host 0.0.0.0 --port 8000 --reload
```
The server starts at `http://localhost:8000`. Swagger documentation is available at `http://localhost:8000/docs`.

---

## ⚛️ React Integration Guide

Because CORS is enabled with `allow_origins=["*"]`, your React application (Vite, Next.js, Create React App) can query the API directly without CORS errors.

### Example React Component (TypeScript / JavaScript)

```tsx
import React, { useState } from 'react';

interface ScamResponse {
  call_id: string;
  conversation_scam_score: number;
  overall_scam_probability: number;
  risk_level: 'SAFE' | 'SUSPICIOUS' | 'HIGH_RISK';
  criteria: {
    authority_impersonation: number;
    credential_otp_requests: number;
    payment_requests: number;
    urgency_fear: number;
    isolation_secrecy: number;
    trust_manipulation: number;
  };
  evidence: {
    bank_impersonation: boolean;
    urgency_or_fear: boolean;
    otp_or_credential_request: boolean;
    payment_request: boolean;
    isolation_tactics: boolean;
    indicators: string[];
  };
  explanation: string;
}

export function ScamChecker() {
  const [transcript, setTranscript] = useState('');
  const [result, setResult] = useState<ScamResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const checkScam = async () => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:8000/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          call_id: 'call-web-' + Date.now(),
          text: transcript,
        }),
      });
      const data: ScamResponse = await response.json();
      setResult(data);
    } catch (err) {
      console.error('API Error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 600, margin: '20px auto', fontFamily: 'sans-serif' }}>
      <h2>ViShield Live Scam Detector</h2>
      <textarea
        rows={6}
        style={{ width: '100%', padding: '10px' }}
        placeholder="Paste transcript or type conversation here..."
        value={transcript}
        onChange={(e) => setTranscript(e.target.value)}
      />
      <button 
        onClick={checkScam} 
        disabled={loading || !transcript.trim()}
        style={{ marginTop: 10, padding: '10px 20px', cursor: 'pointer' }}
      >
        {loading ? 'Evaluating...' : 'Analyze Risk'}
      </button>

      {result && (
        <div style={{ marginTop: 20, padding: 15, border: '1px solid #ccc', borderRadius: 8 }}>
          <h3>Risk Level: <span style={{ 
            color: result.risk_level === 'HIGH_RISK' ? 'red' : result.risk_level === 'SUSPICIOUS' ? 'orange' : 'green' 
          }}>{result.risk_level}</span></h3>
          <p><strong>Score:</strong> {(result.conversation_scam_score * 100).toFixed(1)}%</p>
          <p><strong>Explanation:</strong> {result.explanation}</p>
          
          <h4>Triggered Indicators:</h4>
          <ul>
            {result.evidence.indicators.map((ind, i) => (
              <li key={i}>{ind}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
```

---

## 🤝 Teammate Integration Guide Contract Compliance

This model outputs data that adheres 100% to the **Voice Phishing Evaluator — Teammate Integration Guide**:

### 1. Interface Contract
- **Signal**: `conversation_scam_score` $\in [0.0, 1.0]$
  - `0.0` = Benign / authentic communication
  - `1.0` = Highest detected scam risk
- **Thresholds**:
  - `0.00 – 0.39`: `SAFE`
  - `0.40 – 0.69`: `SUSPICIOUS`
  - `0.70 – 1.00`: `HIGH_RISK`

### 2. 6 Criterion Weights
| Criterion Key | Weight | Source |
|---|---|---|
| `authority_impersonation` | 0.25 | Police/Bank/CBI impersonation |
| `credential_otp_requests` | 0.25 | Solicitation of OTPs, passwords, PINs |
| `payment_requests` | 0.20 | Demands for UPI, safe deposit accounts, ransoms |
| `urgency_fear` | 0.15 | Arrest threats, immediate SIM block deadlines |
| `isolation_secrecy` | 0.10 | "Do not disconnect", secrecy enforcement |
| `trust_manipulation` | 0.05 | Fake badge numbers, technical jargon |

### 3. Critical Indicator Boost
If high-severity items (e.g. OTP credential request $\ge 0.80$, or simultaneous authority impersonation and money demands) are present, the adapter applies a critical indicator boost to prevent severe threats from being masked.

### 4. Direct Python Integration (In-Process)
If your teammate's pipeline is in Python, they can import the adapter directly:

```python
from Scam_model_final.adapter import ConversationAdapter

adapter = ConversationAdapter()
conv_output = adapter.analyze("Police Inspector here. Send Rs 50,000 immediately.", call_id="call-100")

# Pass to RiskFusionEngine:
print("Scam score:", conv_output.overall_scam_probability)
print("Criteria:", conv_output.criteria)
print("Evidence:", conv_output.evidence)
```

### 5. Automated Fusion Payload Builder
You can generate the exact JSON request expected by the Risk Fusion Engine's `POST /api/v1/risk/evaluate`:

```python
fusion_payload = adapter.build_fusion_payload(
    text="Police Inspector here. Send Rs 50,000 immediately.",
    call_id="call-100",
    voice_spoof_score=0.90,       # from AASIST model
    caller_reputation_score=0.70  # from Caller Reputation service
)
```
Output:
```json
{
  "call_id": "call-100",
  "conversation_scam_score": 0.9425,
  "voice_spoof_score": 0.90,
  "caller_reputation_score": 0.70,
  "source": "live_pipeline",
  "metadata": {
    "language": "Hinglish/English",
    "caller_number": "unknown"
  },
  "evidence": {
    "bank_impersonation": true,
    "urgency_or_fear": true,
    "otp_or_credential_request": false,
    "payment_request": true,
    "isolation_tactics": false,
    "indicators": [
      "Authority/Bank impersonation",
      "Threat of account suspension or urgent coercion",
      "Demands for funds transfer or suspicious payment"
    ]
  }
}
```
