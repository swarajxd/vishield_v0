/**
 * Voice Phishing Evaluator - Project Data & Reference Specifications
 * Sourced directly from Project Technical Description & Architecture:
 * - Azure AI Speech + Azure AI Foundry (GPT-4o)
 * - AASIST (Spectro-Temporal Graph Attention Network) Voice Anti-Spoofing
 * - Caller Reputation Service (TRAI / DoT / Community)
 * - 3-Signal Risk Fusion Engine: w1*Conversation + w2*AASIST + w3*CallerRep
 */

export const RISK_THRESHOLDS = {
  safe: { min: 0.0, max: 0.39, label: 'SAFE', color: 'text-tertiary', bg: 'bg-tertiary/10', border: 'border-tertiary/20' },
  suspicious: { min: 0.40, max: 0.69, label: 'SUSPICIOUS', color: 'text-amber-600', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
  highRisk: { min: 0.70, max: 1.0, label: 'HIGH RISK', color: 'text-error', bg: 'bg-error/10', border: 'border-error/20' }
};

export const DEFAULT_WEIGHTS = {
  w1_conversation: 0.50,
  w2_aasist: 0.30,
  w3_reputation: 0.20
};

export const PHISHING_INDICATORS_SCHEMA = [
  {
    id: 'authority_impersonation',
    name: 'Authority Impersonation',
    desc: 'Bank, Government, Police, CBI, or Regulatory official impersonation',
    icon: 'badge',
    badge: 'Critical'
  },
  {
    id: 'urgency_fear',
    name: 'Urgency & Fear Tactics',
    desc: 'Immediate threats of account blockage, penalty, or imminent arrest',
    icon: 'bolt',
    badge: 'Severe'
  },
  {
    id: 'payment_requests',
    name: 'Payment / Money Requests',
    desc: 'Demands for instant fund transfer to "safe accounts" or UPI payments',
    icon: 'payments',
    badge: 'Critical'
  },
  {
    id: 'information_requests',
    name: 'Sensitive Info Requests',
    desc: 'Soliciting OTP, PIN, CVV, Netbanking password, or Aadhaar credentials',
    icon: 'lock_reset',
    badge: 'High Risk'
  },
  {
    id: 'isolation_secrecy',
    name: 'Isolation & Secrecy Instructions',
    desc: 'Instructing victim not to hang up, talk to family members, or seek advice',
    icon: 'visibility_off',
    badge: 'Suspicious'
  },
  {
    id: 'trust_manipulation',
    name: 'Trust Building & Manipulation',
    desc: 'False sympathy, verification badge claims, or manufactured credibility',
    icon: 'psychology',
    badge: 'Social Eng.'
  }
];

export const CALL_SCENARIOS = [
  {
    id: 'scenario-bank-kyc',
    title: 'Bank KYC Suspension & OTP Extortion',
    inputSource: 'Simulated VoIP Call',
    callerNumber: '+91 98402 11982',
    callerLabel: 'Spoofed SBI Helpdesk Route',
    countryCode: '+91 (India)',
    language: 'Hinglish (hi-IN / en-IN)',
    duration: '02:45',
    audioFile: 'sbi_kyc_deepfake_call.wav',
    simulatedAudioChunks: [
      {
        timestamp: '00:06',
        text: 'Namaste sir, this is Senior Verification Officer Sharma from SBI Central Card Division Mumbai.',
        language: 'Hinglish',
        aasist: { bonafide: 0.18, spoof: 0.82, verdict: 'SPOOF (Synthetic)' },
        azureLlm: {
          scamScore: 0.74,
          indicators: ['authority_impersonation'],
          explanation: 'Claiming senior verification officer status from SBI card division.'
        }
      },
      {
        timestamp: '00:14',
        text: 'Your debit card and UPI access will be permanently blocked within 10 minutes due to expired KYC compliance.',
        language: 'Hindi / English',
        aasist: { bonafide: 0.11, spoof: 0.89, verdict: 'SPOOF (Synthetic)' },
        azureLlm: {
          scamScore: 0.88,
          indicators: ['authority_impersonation', 'urgency_fear'],
          explanation: 'Severe time-pressure urgency tactic (10 minutes block threat).'
        }
      },
      {
        timestamp: '00:24',
        text: 'Sir, do not disconnect or inform third parties. An automated verification OTP has been sent to your registered mobile number.',
        language: 'Hinglish',
        aasist: { bonafide: 0.08, spoof: 0.92, verdict: 'SPOOF (Neural Voice Clone)' },
        azureLlm: {
          scamScore: 0.96,
          indicators: ['authority_impersonation', 'urgency_fear', 'information_requests', 'isolation_secrecy'],
          explanation: 'Explicit request for confidential one-time password with secrecy instruction.'
        }
      },
      {
        timestamp: '00:36',
        text: 'Please verify the 6-digit OTP right now to complete biometric re-validation and stop the penalty of Rs 25,000.',
        language: 'Hinglish',
        aasist: { bonafide: 0.06, spoof: 0.94, verdict: 'SPOOF (Neural Voice Clone)' },
        azureLlm: {
          scamScore: 0.98,
          indicators: ['authority_impersonation', 'urgency_fear', 'payment_requests', 'information_requests'],
          explanation: 'OTP extortion coupled with financial penalty coercion.'
        }
      }
    ],
    initialScores: {
      conversationScore: 0.95,
      aasistSpoofScore: 0.90,
      callerReputationScore: 0.85
    },
    reputationDetails: {
      countryCodeStatus: 'Matched domestic code (+91)',
      traiStatus: 'Flagged on TRAI / DoT Telemarketer Blacklist (Category: Financial Fraud)',
      communityReports: 42,
      scamCategory: 'Bank KYC Impersonation'
    },
    guardianNotification: {
      recipient: 'Rohan Sharma (Pre-registered Guardian)',
      phone: '+91 98110 55432',
      status: 'DISPATCHED',
      channel: 'Firebase Cloud Messaging (FCM Push)',
      snippet: 'Sir, your account will be blocked, please verify your OTP.'
    }
  },
  {
    id: 'scenario-cbi-arrest',
    title: 'CBI "Digital Arrest" & Money Transfer Coercion',
    inputSource: 'Uploaded Recording',
    callerNumber: '+91 70291 44019',
    callerLabel: 'VoIP Gateway / Virtual SIM',
    countryCode: '+91 (India)',
    language: 'Hindi (hi-IN)',
    duration: '03:15',
    audioFile: 'cbi_digital_arrest_sample.mp3',
    simulatedAudioChunks: [
      {
        timestamp: '00:08',
        text: 'Main Central Bureau of Investigation Headquarter New Delhi se Special Officer Verma baat kar raha hoon.',
        language: 'Hindi',
        aasist: { bonafide: 0.22, spoof: 0.78, verdict: 'SPOOF (Voice Converted)' },
        azureLlm: {
          scamScore: 0.82,
          indicators: ['authority_impersonation'],
          explanation: 'Impersonating CBI federal investigation officer.'
        }
      },
      {
        timestamp: '00:18',
        text: 'Aapke Aadhaar card par 16 fake bank accounts khule hain jisme international money laundering transactions hui hain.',
        language: 'Hindi',
        aasist: { bonafide: 0.15, spoof: 0.85, verdict: 'SPOOF (Voice Converted)' },
        azureLlm: {
          scamScore: 0.90,
          indicators: ['authority_impersonation', 'urgency_fear'],
          explanation: 'Fabricated criminal allegations to create extreme anxiety and compliance.'
        }
      },
      {
        timestamp: '00:30',
        text: 'Supreme Court ka digital arrest warrant issue ho chuka hai. Kamre ka darwaza band karein aur kisi se baat na karein.',
        language: 'Hindi',
        aasist: { bonafide: 0.12, spoof: 0.88, verdict: 'SPOOF (Voice Converted)' },
        azureLlm: {
          scamScore: 0.96,
          indicators: ['authority_impersonation', 'urgency_fear', 'isolation_secrecy'],
          explanation: 'Digital arrest coercion with strict physical isolation instruction.'
        }
      },
      {
        timestamp: '00:45',
        text: 'Verification ke liye apne saare savings account ka balance hamare RBI verification safe escrow account mein transfer karein.',
        language: 'Hindi',
        aasist: { bonafide: 0.10, spoof: 0.90, verdict: 'SPOOF (Voice Converted)' },
        azureLlm: {
          scamScore: 0.99,
          indicators: ['authority_impersonation', 'urgency_fear', 'payment_requests', 'trust_manipulation'],
          explanation: 'Direct money transfer request under guise of government escrow audit.'
        }
      }
    ],
    initialScores: {
      conversationScore: 0.94,
      aasistSpoofScore: 0.86,
      callerReputationScore: 0.78
    },
    reputationDetails: {
      countryCodeStatus: 'Matched domestic code (+91)',
      traiStatus: 'DoT Sanchar Saathi Flag: Reported 28 times as impersonation racket',
      communityReports: 36,
      scamCategory: 'Digital Arrest Extortion'
    },
    guardianNotification: {
      recipient: 'Pooja Verma (Pre-registered Guardian)',
      phone: '+91 97180 22391',
      status: 'DISPATCHED',
      channel: 'Firebase Cloud Messaging (FCM Push)',
      snippet: 'Supreme Court warrant issue hua hai, funds verification escrow mein transfer karein.'
    }
  },
  {
    id: 'scenario-customs-courier',
    title: 'FedEx / Customs Seizure Narcotics Trap',
    inputSource: 'Voice Note',
    callerNumber: '+91 91234 56789',
    callerLabel: 'Automated IVR + Operator',
    countryCode: '+91 (India)',
    language: 'English (en-IN)',
    duration: '01:50',
    audioFile: 'customs_courier_robocall.wav',
    simulatedAudioChunks: [
      {
        timestamp: '00:05',
        text: 'This is an urgent broadcast from International Customs and Courier Parcel Inspection Center Mumbai.',
        language: 'English',
        aasist: { bonafide: 0.35, spoof: 0.65, verdict: 'SPOOF (Synthetic IVR)' },
        azureLlm: {
          scamScore: 0.70,
          indicators: ['authority_impersonation'],
          explanation: 'Automated robocall claiming courier parcel intercept.'
        }
      },
      {
        timestamp: '00:15',
        text: 'A package addressed to your name containing illegal passports and contraband has been seized at airport customs.',
        language: 'English',
        aasist: { bonafide: 0.30, spoof: 0.70, verdict: 'SPOOF (Synthetic IVR)' },
        azureLlm: {
          scamScore: 0.85,
          indicators: ['authority_impersonation', 'urgency_fear'],
          explanation: 'Threatening contraband seizure allegation.'
        }
      },
      {
        timestamp: '00:28',
        text: 'Press 9 to talk to Customs Narcotic Cell officer immediately or your passport will be cancelled.',
        language: 'English',
        aasist: { bonafide: 0.28, spoof: 0.72, verdict: 'SPOOF (Synthetic IVR)' },
        azureLlm: {
          scamScore: 0.92,
          indicators: ['authority_impersonation', 'urgency_fear', 'trust_manipulation'],
          explanation: 'IVR redirect to scammer operator under duress.'
        }
      }
    ],
    initialScores: {
      conversationScore: 0.82,
      aasistSpoofScore: 0.69,
      callerReputationScore: 0.75
    },
    reputationDetails: {
      countryCodeStatus: 'Matched domestic code (+91)',
      traiStatus: 'Flagged on Chakshu Portal (Category: Courier Scam)',
      communityReports: 19,
      scamCategory: 'Courier / Customs Trap'
    },
    guardianNotification: {
      recipient: 'Ananya Rao (Pre-registered Guardian)',
      phone: '+91 94480 33100',
      status: 'DISPATCHED',
      channel: 'Firebase Cloud Messaging (FCM Push)',
      snippet: 'Illegal contraband package seized in your name, customs penalty pending.'
    }
  },
  {
    id: 'scenario-safe-branch',
    title: 'Legitimate Branch Relationship Manager Call',
    inputSource: 'Live Call (Speakerphone)',
    callerNumber: '+91 80 4719 3300',
    callerLabel: 'Registered HDFC Corporate Trunk',
    countryCode: '+91 (India)',
    language: 'English / Hindi',
    duration: '01:20',
    audioFile: 'legit_branch_verification.wav',
    simulatedAudioChunks: [
      {
        timestamp: '00:08',
        text: 'Good morning Mr. Shetty, this is Priya calling from your local HDFC Bank Indiranagar branch.',
        language: 'English',
        aasist: { bonafide: 0.94, spoof: 0.06, verdict: 'BONAFIDE (Human)' },
        azureLlm: {
          scamScore: 0.05,
          indicators: [],
          explanation: 'Standard professional greeting, no pressure or credential asks.'
        }
      },
      {
        timestamp: '00:20',
        text: 'We noticed your FD is maturing next Friday. Would you like to review renewal interest options at your convenience?',
        language: 'English',
        aasist: { bonafide: 0.96, spoof: 0.04, verdict: 'BONAFIDE (Human)' },
        azureLlm: {
          scamScore: 0.04,
          indicators: [],
          explanation: 'Standard advisory inquiry. Explicitly asks customer to review at leisure.'
        }
      },
      {
        timestamp: '00:32',
        text: 'Please never share your PIN or OTP with anyone, including bank staff. Have a wonderful day!',
        language: 'English',
        aasist: { bonafide: 0.97, spoof: 0.03, verdict: 'BONAFIDE (Human)' },
        azureLlm: {
          scamScore: 0.01,
          indicators: [],
          explanation: 'Proactive anti-phishing consumer security reminder.'
        }
      }
    ],
    initialScores: {
      conversationScore: 0.04,
      aasistSpoofScore: 0.05,
      callerReputationScore: 0.08
    },
    reputationDetails: {
      countryCodeStatus: 'Matched registered landline (+91 80)',
      traiStatus: 'Whitelisted Commercial Carrier (DoT Registered Bank Trunk)',
      communityReports: 0,
      scamCategory: 'Legitimate Banking'
    },
    guardianNotification: {
      recipient: 'None',
      phone: '—',
      status: 'NOT_TRIGGERED',
      channel: '—',
      snippet: 'Safe call. Risk threshold not exceeded.'
    }
  }
];

export const POSTGRESQL_CALL_RECORDS = [
  {
    callId: 'CALL-2026-9102',
    timestamp: '2026-10-14 14:32:18 IST',
    callerNumber: '+91 98*** **982',
    fullCaller: '+91 98402 11982',
    duration: '02:45',
    durationSeconds: 165,
    language: 'Hinglish (hi-IN / en-IN)',
    conversationScore: 0.95,
    aasistScore: 0.90,
    reputationScore: 0.85,
    finalRisk: 0.915,
    riskLevel: 'HIGH RISK',
    detectedIndicators: [
      'Authority Impersonation (SBI Card Division)',
      'Urgency & Fear Tactics (10-min blockage)',
      'Payment / Money Requests (Rs 25,000 penalty threat)',
      'Information Requests (6-digit OTP extortion)',
      'Isolation / Secrecy Instructions'
    ],
    guardianStatus: 'DELIVERED (Firebase Push to Rohan Sharma)',
    transcriptPreview: 'Sir, your account will be blocked, please verify your OTP immediately...',
    inputSource: 'Live Call (Speakerphone)',
    aasistDetails: {
      bonafideProb: 0.10,
      spoofProb: 0.90,
      graphAttentionPeaks: 'Temporal node cluster @ 1.8kHz and 3.4kHz shows synthetic vocoder artifacts',
      trainingDatasetRole: 'Matched IndicSynth synthetic acoustic patterns vs IndicVoices-R natural variance'
    }
  },
  {
    callId: 'CALL-2026-9098',
    timestamp: '2026-10-14 13:58:05 IST',
    callerNumber: '+91 70*** **019',
    fullCaller: '+91 70291 44019',
    duration: '03:15',
    durationSeconds: 195,
    language: 'Hindi (hi-IN)',
    conversationScore: 0.94,
    aasistScore: 0.86,
    reputationScore: 0.78,
    finalRisk: 0.884,
    riskLevel: 'HIGH RISK',
    detectedIndicators: [
      'Authority Impersonation (CBI Special Officer)',
      'Urgency & Fear Tactics (Digital arrest threat)',
      'Payment / Money Requests (RBI Escrow transfer)',
      'Isolation & Secrecy Instructions (Close room door)'
    ],
    guardianStatus: 'DELIVERED (Firebase Push to Pooja Verma)',
    transcriptPreview: 'Main CBI headquarters se bol raha hoon, aapke naam par warrant issue hua hai...',
    inputSource: 'Simulated VoIP Call',
    aasistDetails: {
      bonafideProb: 0.14,
      spoofProb: 0.86,
      graphAttentionPeaks: 'Phase discontinuity and robotic spectral envelope @ 2.4kHz',
      trainingDatasetRole: 'Classified SPOOF under IndicSynth voice conversion model'
    }
  },
  {
    callId: 'CALL-2026-9081',
    timestamp: '2026-10-14 12:44:20 IST',
    callerNumber: '+91 91*** **789',
    fullCaller: '+91 91234 56789',
    duration: '01:50',
    durationSeconds: 110,
    language: 'English (en-IN)',
    conversationScore: 0.82,
    aasistScore: 0.69,
    reputationScore: 0.75,
    finalRisk: 0.767,
    riskLevel: 'HIGH RISK',
    detectedIndicators: [
      'Authority Impersonation (FedEx Customs)',
      'Urgency & Fear Tactics (Contraband seizure)',
      'Trust Building & Manipulation'
    ],
    guardianStatus: 'DELIVERED (Firebase Push to Ananya Rao)',
    transcriptPreview: 'Urgent broadcast from International Customs Parcel Center Mumbai...',
    inputSource: 'Voice Note',
    aasistDetails: {
      bonafideProb: 0.31,
      spoofProb: 0.69,
      graphAttentionPeaks: 'Synthesizer concatenated phonetic boundaries',
      trainingDatasetRole: 'Cross-validated with IndicSynth & English Deepfake benchmarks'
    }
  },
  {
    callId: 'CALL-2026-9074',
    timestamp: '2026-10-14 11:20:10 IST',
    callerNumber: '+91 94*** **299',
    fullCaller: '+91 94140 18299',
    duration: '02:10',
    durationSeconds: 130,
    language: 'Hindi / English',
    conversationScore: 0.58,
    aasistScore: 0.48,
    reputationScore: 0.62,
    finalRisk: 0.558,
    riskLevel: 'SUSPICIOUS',
    detectedIndicators: [
      'Urgency & Fear Tactics (Limited pre-approval window)',
      'Trust Building & Manipulation (Unregistered Instant Loan)'
    ],
    guardianStatus: 'HELD (Risk score below 0.70 threshold; on-screen warning active)',
    transcriptPreview: 'Sir aapko instant pre-approved personal loan mil raha hai without collateral...',
    inputSource: 'Uploaded Recording',
    aasistDetails: {
      bonafideProb: 0.52,
      spoofProb: 0.48,
      graphAttentionPeaks: 'High acoustic background noise with possible recorded loop playback',
      trainingDatasetRole: 'Borderline anomaly score against IndicVoices-R baseline'
    }
  },
  {
    callId: 'CALL-2026-9060',
    timestamp: '2026-10-14 10:05:44 IST',
    callerNumber: '+91 80*** **300',
    fullCaller: '+91 80 4719 3300',
    duration: '01:20',
    durationSeconds: 80,
    language: 'English / Hindi',
    conversationScore: 0.04,
    aasistScore: 0.05,
    reputationScore: 0.08,
    finalRisk: 0.051,
    riskLevel: 'SAFE',
    detectedIndicators: [],
    guardianStatus: 'NOT_TRIGGERED',
    transcriptPreview: 'Good morning Mr. Shetty, this is Priya calling from HDFC Bank regarding FD maturity...',
    inputSource: 'Live Call (Speakerphone)',
    aasistDetails: {
      bonafideProb: 0.95,
      spoofProb: 0.05,
      graphAttentionPeaks: 'Natural vocal cord micro-tremors and authentic spectral harmonics',
      trainingDatasetRole: 'Identified as BONAFIDE matching natural IndicVoices-R human distribution'
    }
  }
];

export const SYSTEM_ARCHITECTURE_STEPS = [
  {
    step: 1,
    title: 'Audio Capture Module',
    category: 'Input Sources',
    desc: 'Captures live-call or recorded audio from 4 input sources (Speakerphone, Upload, Voice Note, Simulated VoIP). Divides audio into 5–10 second streaming chunks.',
    signals: ['5-10s Audio Chunking', 'Real-time Buffer'],
    status: 'ACTIVE'
  },
  {
    step: 2,
    title: 'Azure AI Speech Service',
    category: 'Parallel Pipeline 1',
    desc: 'Converts streaming audio chunks into text transcripts in real-time. Identifies language (Hindi, English, Hinglish). Feeds Redis running transcript buffer.',
    signals: ['Speech-to-Text', 'Language ID', 'Redis Transcript Cache'],
    status: 'OPTIMAL'
  },
  {
    step: 3,
    title: 'Scam Detection Engine (Azure AI Foundry / GPT-4o)',
    category: 'Parallel Pipeline 1',
    desc: 'Performs semantic analysis across context and evaluates the 6 Phishing Indicators (Authority, Urgency, Payment, OTP/Info, Isolation, Manipulation).',
    signals: ['Semantic Context', '6 Indicator Scores', 'Explanation'],
    status: 'OPTIMAL'
  },
  {
    step: 4,
    title: 'AASIST Voice Authenticity Model',
    category: 'Parallel Pipeline 2',
    desc: 'Integrated Spectro-Temporal Graph Attention Network trained on IndicVoices-R (Bonafide) and IndicSynth (Spoof). Distinguishes real human voice from synthetic clones.',
    signals: ['Spectro-Temporal Features', 'Graph Attention', 'Bona-fide vs Spoof Probability'],
    status: 'TRAINED & READY'
  },
  {
    step: 5,
    title: 'Caller Reputation Service',
    category: 'Verification Signal',
    desc: 'Queried once at call start. Validates Country Code (+91), TRAI / DoT Scam Registry, and community reported complaints.',
    signals: ['Country Code Check', 'TRAI / DoT Database', 'Community Scam History'],
    status: 'SYNCHRONIZED'
  },
  {
    step: 6,
    title: 'Risk Fusion Engine',
    category: 'Decision Core',
    desc: 'Combines the three signals using weighted formula: Final Risk = 0.50×Conv + 0.30×AASIST + 0.20×Rep. Classifies as Safe, Suspicious, or High Risk.',
    signals: ['Weighted Summation', 'Safe (0-0.39)', 'Suspicious (0.4-0.69)', 'High Risk (0.7-1.0)'],
    status: 'REAL-TIME'
  },
  {
    step: 7,
    title: 'Real-Time Warning & Guardian Notification',
    category: 'Action & Safeguard',
    desc: 'Displays on-screen HUD alert with risk percentage and detected indicators. Automatically dispatches Firebase Cloud Messaging (FCM) push to pre-registered guardian.',
    signals: ['On-screen HUD Warning', 'Firebase Cloud Messaging (FCM)', 'Guardian SMS / Link'],
    status: 'ARMED'
  },
  {
    step: 8,
    title: 'PostgreSQL Storage & Post-Call Analytics',
    category: 'Data & Dashboard',
    desc: 'Stores structured call records (Call ID, Timestamp, Number, Duration, Language, 3-Signal Scores, Final Risk, Indicators, Guardian Status) for auditing.',
    signals: ['PostgreSQL DB', 'Structured Analysis Report', 'Incident History'],
    status: 'CONNECTED'
  }
];
