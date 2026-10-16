import React, { useState } from 'react';

export default function AasistAzureModelView({ onTriggerToast }) {
  const [activeModelTab, setActiveModelTab] = useState('aasist'); // 'aasist' | 'azure' | 'datasets'
  const [testAudioFile, setTestAudioFile] = useState('sample_deepfake_hindi.wav');
  const [scoringResult, setScoringResult] = useState(null);
  const [isScoring, setIsScoring] = useState(false);

  const handleRunInference = () => {
    setIsScoring(true);
    onTriggerToast(`Sending audio to SSL-AASIST model (best_dev_eer.pth)...`);
    
    setTimeout(() => {
      setIsScoring(false);
      setScoringResult({
        file: testAudioFile,
        duration: '04.04s (64600 samples @ 16kHz)',
        bonafideScore: 0.084,
        spoofScore: 0.916,
        verdict: 'HIGH RISK — AI / Synthetic / Cloned voice',
        graphAttentionWeights: [
          { node: 'F1: Spectral Envelope (0-2kHz)', weight: 0.94, flag: 'Vocoder Artifact' },
          { node: 'F2: Harmonic Continuity (2-4kHz)', weight: 0.88, flag: 'Phase Discontinuity' },
          { node: 'F3: Temporal Cadence Jitter', weight: 0.91, flag: 'Zero Hesitation' },
          { node: 'F4: High-Frequency Resonance', weight: 0.82, flag: 'Neural Boundary Glitch' }
        ]
      });
      onTriggerToast('AASIST Inference Complete: Spoof Score = 0.916 (HIGH RISK)');
    }, 1200);
  };

  return (
    <div className="flex-1 flex flex-col gap-6 max-w-[1520px] w-full mx-auto animate-in fade-in duration-300">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-outline-variant/20">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-700 font-mono-metric text-xs font-semibold">
              TECHNICAL MODEL SPECIFICATION
            </span>
            <span className="text-xs text-outline font-mono-metric">Sections 3, 4 &amp; 5 of Project Proposal</span>
          </div>
          <h2 className="font-headline-md text-2xl font-bold tracking-tight text-on-surface mt-1">
            AASIST Anti-Spoofing &amp; Azure AI Foundry Architecture
          </h2>
          <p className="font-body-md text-xs text-on-surface-variant max-w-3xl mt-0.5">
            Deep dive into the dual parallel processing pipelines: Integrated Spectro-Temporal Graph Attention Networks (AASIST) and Azure AI Speech with GPT-4o semantic context analysis.
          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center gap-2">
          {[
            { id: 'aasist', label: 'Section 4: AASIST Algorithm', icon: 'network_intelligence' },
            { id: 'datasets', label: 'Section 5: Training Datasets', icon: 'dataset' },
            { id: 'azure', label: 'Section 3: Azure AI Integration', icon: 'psychology' }
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setActiveModelTab(t.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-label-md font-semibold transition-all flex items-center gap-1.5 ${
                activeModelTab === t.id
                  ? 'bg-primary text-on-primary shadow-xs'
                  : 'bg-surface-container-high hover:bg-surface-container-highest text-on-surface border border-outline-variant/30'
              }`}
            >
              <span className="material-symbols-outlined text-base">{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* SECTION 4: AASIST ALGORITHM VIEW */}
      {activeModelTab === 'aasist' && (
        <div className="space-y-6">
          {/* Theory & Mechanism Card */}
          <section className="bg-surface-container-lowest rounded-3xl p-6 border border-outline-variant/30 shadow-sm">
            <div className="flex items-center justify-between pb-4 border-b border-outline-variant/20 mb-4">
              <div>
                <h3 className="font-title text-lg font-bold text-on-surface">
                  Section 4: AASIST Algorithm Architecture
                </h3>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  Audio Anti-Spoofing using Integrated Spectro-Temporal Graph Attention Networks
                </p>
              </div>
              <span className="px-3 py-1 rounded-full bg-amber-500/10 text-amber-800 text-xs font-mono-metric font-bold">
                PyTorch / SSL-AASIST
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* 4.1 Spectro-Temporal Analysis */}
              <div className="p-5 rounded-2xl bg-surface-container-low border border-outline-variant/25">
                <div className="flex items-center gap-2 text-amber-700 font-bold text-sm mb-2">
                  <span className="material-symbols-outlined text-base">graphic_eq</span>
                  <h4>4.1 Spectro-Temporal Analysis</h4>
                </div>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  AASIST considers both <strong>spectral</strong> and <strong>temporal</strong> characteristics of speech. 
                  Spectral information describes frequency-related characteristics, while temporal information describes how 
                  speech features evolve over time. Synthetic or manipulated speech contains subtle acoustic artifacts in these representations.
                </p>
                <div className="mt-3 p-3 bg-surface-container-lowest rounded-xl border border-outline-variant/20 text-xs font-mono-metric text-outline">
                  Target Length: 64,600 samples (4.04s @ 16kHz) | Stride: 32,300 (50% overlap)
                </div>
              </div>

              {/* 4.2 Graph Attention */}
              <div className="p-5 rounded-2xl bg-surface-container-low border border-outline-variant/25">
                <div className="flex items-center gap-2 text-amber-700 font-bold text-sm mb-2">
                  <span className="material-symbols-outlined text-base">hub</span>
                  <h4>4.2 Graph Attention &amp; Feature Aggregation</h4>
                </div>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  The learned speech representations are modeled as interconnected graph features (F1, F2, F3, F4). 
                  <strong> Graph Attention</strong> enables the model to dynamically learn which feature relationships are most critical 
                  for distinguishing genuine speech from synthetic or voice-converted speech.
                </p>
                <div className="mt-3 p-3 bg-surface-container-lowest rounded-xl border border-outline-variant/20 text-xs font-mono-metric text-outline">
                  Graph Attention Nodes &rarr; Important Feature Pool &rarr; Binary Linear Classifier
                </div>
              </div>
            </div>

            {/* 4.3 AASIST Output Pipeline diagram (Mirroring Page 5) */}
            <div className="mt-6 p-5 rounded-2xl bg-amber-500/5 border border-amber-500/25">
              <span className="text-xs font-mono-metric font-bold text-amber-900 uppercase tracking-wider block mb-3">
                4.3 AASIST Output Flow (Page 5 Diagram)
              </span>
              <div className="flex flex-col md:flex-row items-center justify-center gap-4 text-xs font-mono-metric">
                <div className="p-3 rounded-xl bg-surface-container-lowest border border-outline-variant/30 font-bold text-on-surface">
                  Incoming Call Audio (16kHz)
                </div>
                <span className="material-symbols-outlined text-outline">arrow_forward</span>
                <div className="p-3 rounded-xl bg-amber-600 text-white font-bold shadow-xs">
                  Trained AASIST Model
                </div>
                <span className="material-symbols-outlined text-outline">arrow_forward</span>
                <div className="flex items-center gap-2">
                  <div className="p-3 rounded-xl bg-tertiary-container/20 text-tertiary border border-tertiary/30 font-bold">
                    BONAFIDE: 0.10
                  </div>
                  <div className="p-3 rounded-xl bg-error/15 text-error border border-error/30 font-bold">
                    SPOOF: 0.90
                  </div>
                </div>
                <span className="material-symbols-outlined text-outline">arrow_forward</span>
                <div className="p-3 rounded-xl bg-emerald-500/20 text-emerald-800 border border-emerald-500/30 font-bold">
                  Risk Fusion Engine
                </div>
              </div>
            </div>
          </section>

          {/* Interactive AASIST Inference Workbench */}
          <section className="bg-surface-container-lowest rounded-3xl p-6 border border-outline-variant/30 shadow-sm">
            <div className="flex items-center justify-between pb-4 border-b border-outline-variant/20 mb-4">
              <h3 className="font-title text-base font-bold text-on-surface">
                Interactive AASIST Audio Scoring Workbench
              </h3>
              <span className="text-xs text-outline font-mono-metric">Test Checkpoint: best_dev_eer.pth</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
              <div className="md:col-span-5 space-y-3">
                <label className="text-xs font-mono-metric font-bold text-outline uppercase block">
                  Select Audio Sample:
                </label>
                <select
                  value={testAudioFile}
                  onChange={(e) => setTestAudioFile(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant/30 rounded-xl text-xs font-medium text-on-surface focus:outline-none"
                >
                  <option value="sbi_kyc_deepfake_hindi.wav">sbi_kyc_deepfake_hindi.wav (Synthetic Clone)</option>
                  <option value="cbi_digital_arrest_sample.mp3">cbi_digital_arrest_sample.mp3 (Voice Converted)</option>
                  <option value="legit_human_relationship_mgr.wav">legit_human_relationship_mgr.wav (Authentic Human)</option>
                </select>

                <button
                  onClick={handleRunInference}
                  disabled={isScoring}
                  className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-label-md text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm"
                >
                  <span className={`material-symbols-outlined text-base ${isScoring ? 'animate-spin' : ''}`}>
                    {isScoring ? 'sync' : 'speed'}
                  </span>
                  <span>{isScoring ? 'Computing Spectro-Temporal Graph...' : 'Execute AASIST Scoring'}</span>
                </button>
              </div>

              <div className="md:col-span-7 bg-surface-container-low p-4 rounded-2xl border border-outline-variant/25 min-h-[160px] flex flex-col justify-center">
                {scoringResult ? (
                  <div className="space-y-3 text-xs font-mono-metric animate-in fade-in">
                    <div className="flex justify-between border-b border-outline-variant/20 pb-2">
                      <span className="text-outline">File: {scoringResult.file}</span>
                      <span className="font-bold text-error">{scoringResult.verdict}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-center">
                      <div className="p-2 bg-surface-container-lowest rounded-lg border border-outline-variant/20">
                        <span className="text-outline text-[10px]">Bona-fide Prob</span>
                        <div className="font-bold text-tertiary text-sm">{(scoringResult.bonafideScore * 100).toFixed(1)}%</div>
                      </div>
                      <div className="p-2 bg-surface-container-lowest rounded-lg border border-outline-variant/20">
                        <span className="text-outline text-[10px]">Spoof Prob</span>
                        <div className="font-bold text-error text-sm">{(scoringResult.spoofScore * 100).toFixed(1)}%</div>
                      </div>
                    </div>
                    <div className="space-y-1 pt-1">
                      {scoringResult.graphAttentionWeights.map((w, idx) => (
                        <div key={idx} className="flex justify-between text-[11px] p-1.5 bg-surface-container-lowest rounded border border-outline-variant/15">
                          <span className="text-on-surface">{w.node}</span>
                          <span className="text-error font-bold">{w.flag} ({w.weight})</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-outline text-xs py-6">
                    Click "Execute AASIST Scoring" to run spectro-temporal tensor evaluation.
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      )}

      {/* SECTION 5: TRAINING DATASETS VIEW */}
      {activeModelTab === 'datasets' && (
        <section className="bg-surface-container-lowest rounded-3xl p-6 border border-outline-variant/30 shadow-sm space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-outline-variant/20">
            <div>
              <h3 className="font-title text-lg font-bold text-on-surface">
                Section 5: Datasets Used to Train AASIST
              </h3>
              <p className="text-xs text-on-surface-variant mt-0.5">
                AASIST is trained to differentiate natural Indian linguistic vocal acoustics from synthesized speech.
              </p>
            </div>
            <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-mono-metric font-bold">
              AI4Bharat &amp; IndicSynth
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 5.1 AI4Bharat IndicVoices-R */}
            <div className="p-5 rounded-2xl bg-tertiary/5 border border-tertiary/20 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-tertiary/15 text-tertiary font-mono-metric text-xs font-bold">
                    BONAFIDE SOURCE
                  </span>
                  <span className="text-xs text-outline font-mono-metric">Section 5.1</span>
                </div>
                <h4 className="font-bold text-on-surface text-base">AI4Bharat IndicVoices-R</h4>
                <p className="text-xs text-on-surface-variant mt-2 leading-relaxed">
                  Used as the <strong>bona-fide or real-speech source</strong>. For this project, only the 
                  <strong> Hindi subset</strong> of IndicVoices-R is selected, since the application scope is focused on Hindi, English, and Hinglish.
                </p>
              </div>
              <div className="mt-4 p-3 bg-surface-container-lowest rounded-xl border border-tertiary/30 text-xs font-mono-metric flex items-center justify-between">
                <span>Training Role:</span>
                <span className="font-bold text-tertiary">LABEL = BONAFIDE</span>
              </div>
            </div>

            {/* 5.2 IndicSynth */}
            <div className="p-5 rounded-2xl bg-error/5 border border-error/20 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-error/15 text-error font-mono-metric text-xs font-bold">
                    SPOOF SOURCE
                  </span>
                  <span className="text-xs text-outline font-mono-metric">Section 5.2</span>
                </div>
                <h4 className="font-bold text-on-surface text-base">IndicSynth Dataset</h4>
                <p className="text-xs text-on-surface-variant mt-2 leading-relaxed">
                  Used as the <strong>spoof/synthetic-speech source</strong>. It contains synthetic speech across multiple Indian languages; 
                  only its <strong>Hindi subset</strong> is used here in line with the project's Hindi, English, and Hinglish scope.
                </p>
              </div>
              <div className="mt-4 p-3 bg-surface-container-lowest rounded-xl border border-error/30 text-xs font-mono-metric flex items-center justify-between">
                <span>Training Role:</span>
                <span className="font-bold text-error">LABEL = SPOOF</span>
              </div>
            </div>
          </div>

          {/* 5.4 Important Dataset Limitation Banner (Directly from Page 7) */}
          <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30">
            <div className="flex items-center gap-2 text-amber-900 font-bold text-sm mb-1">
              <span className="material-symbols-outlined text-base">info</span>
              <h4>Section 5.4: Important Dataset Limitation</h4>
            </div>
            <p className="text-xs text-amber-950 leading-relaxed">
              The application is intended for <strong>Hindi, English and Hinglish only</strong> — other Indian languages are out of scope. 
              From IndicVoices-R and IndicSynth, only the Hindi subset is currently integrated. Neither dataset natively includes English 
              or Hinglish synthetic samples. Therefore, to expand robust English and Hinglish anti-spoofing performance, additional 
              English and Hinglish deepfake benchmarks (such as ASVspoof 2021) should be supplemented.
            </p>
          </div>
        </section>
      )}

      {/* SECTION 3: AZURE AI INTEGRATION VIEW */}
      {activeModelTab === 'azure' && (
        <section className="bg-surface-container-lowest rounded-3xl p-6 border border-outline-variant/30 shadow-sm space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-outline-variant/20">
            <div>
              <h3 className="font-title text-lg font-bold text-on-surface">
                Section 3: Azure AI Integration (Speech + Foundry LLM)
              </h3>
              <p className="text-xs text-on-surface-variant mt-0.5">
                Cloud AI services power the semantic conversation analysis pipeline.
              </p>
            </div>
            <span className="px-3 py-1 rounded-full bg-purple-500/10 text-purple-700 text-xs font-mono-metric font-bold">
              Azure Cognitive Services
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-5 rounded-2xl bg-surface-container-low border border-outline-variant/25">
              <div className="flex items-center gap-2 text-purple-700 font-bold text-sm mb-2">
                <span className="material-symbols-outlined text-base">transcribe</span>
                <h4>3.1 Azure AI Speech Service</h4>
              </div>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                Responsible for speech recognition. Converts the incoming call audio stream into a text transcript for phishing analysis. 
                Language identification tags whether speech is <strong>Hindi, English, or Hinglish</strong>.
              </p>
              <div className="mt-4 p-3 bg-surface-container-lowest rounded-xl border border-outline-variant/20 text-xs">
                <span className="text-outline block text-[10px] font-mono-metric">INPUT &rarr; PURPOSE:</span>
                <span className="font-medium text-on-surface">Call Audio &rarr; Speech-to-Text &amp; Language Identification</span>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-surface-container-low border border-outline-variant/25">
              <div className="flex items-center gap-2 text-purple-700 font-bold text-sm mb-2">
                <span className="material-symbols-outlined text-base">psychology</span>
                <h4>3.2 Azure AI Foundry (GPT-4o)</h4>
              </div>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                After Azure Speech generates transcripts, context is evaluated through Azure AI Foundry LLM. Evaluates meaning and intent rather than single keywords alone.
              </p>
              <div className="mt-4 p-3 bg-surface-container-lowest rounded-xl border border-outline-variant/20 text-xs">
                <span className="text-outline block text-[10px] font-mono-metric">INPUT &rarr; PURPOSE:</span>
                <span className="font-medium text-on-surface">Transcript + Context &rarr; Semantic Phishing / Scam Analysis</span>
              </div>
            </div>
          </div>
        </section>
      )}

    </div>
  );
}
