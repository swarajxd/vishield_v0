import { jsPDF } from 'jspdf';

/**
 * Generates an official, beautifully formatted forensic PDF report
 * for Voice Phishing Evaluator (Azure AI + AASIST Engine).
 */
export function generateForensicPdf(record) {
  if (!record) return;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  let y = 14;

  const checkPageBreak = (neededHeight = 20) => {
    if (y + neededHeight > pageHeight - margin) {
      doc.addPage();
      y = margin + 5;
    }
  };

  // Helper colors
  const primaryDark = [15, 23, 42];     // slate 900
  const primaryBlue = [2, 132, 199];    // sky 600
  const grayText = [100, 116, 139];     // slate 500
  const borderGray = [226, 232, 240];   // slate 200

  // 1. HEADER SECTION
  doc.setFillColor(15, 23, 42);
  doc.rect(margin, y, pageWidth - (margin * 2), 22, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('VOICE PHISHING EVALUATOR', margin + 6, y + 8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(148, 163, 184);
  doc.text('Azure AI Integration & AASIST-Based Anti-Spoofing Engine', margin + 6, y + 14);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text('FORENSIC AUDIT DOSSIER', pageWidth - margin - 6, y + 8, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text(`Ref: ${record.callId}`, pageWidth - margin - 6, y + 14, { align: 'right' });

  y += 28;

  // 2. MASTER RISK VERDICT BANNER
  const isHighRisk = (record.finalRisk >= 0.70) || (record.riskLevel && record.riskLevel.includes('HIGH'));
  const isSuspicious = !isHighRisk && ((record.finalRisk >= 0.40) || (record.riskLevel && record.riskLevel.includes('SUSPICIOUS')));

  if (isHighRisk) {
    doc.setFillColor(254, 242, 242); // red 50
    doc.setDrawColor(239, 68, 68);   // red 500
  } else if (isSuspicious) {
    doc.setFillColor(255, 251, 235); // amber 50
    doc.setDrawColor(245, 158, 11);  // amber 500
  } else {
    doc.setFillColor(240, 253, 244); // green 50
    doc.setDrawColor(34, 197, 94);   // green 500
  }

  doc.setLineWidth(0.6);
  doc.roundedRect(margin, y, pageWidth - (margin * 2), 24, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...(isHighRisk ? [185, 28, 28] : isSuspicious ? [180, 83, 9] : [21, 128, 61]));
  doc.text('SECTION 7 RISK FUSION VERDICT', margin + 6, y + 6);

  const riskScoreText = `${(record.finalRisk * 100).toFixed(1)}% Fused Risk`;
  const classificationText = record.riskLevel || (isHighRisk ? 'HIGH RISK' : isSuspicious ? 'SUSPICIOUS' : 'SAFE');

  doc.setFontSize(15);
  doc.text(`${riskScoreText} — ${classificationText}`, margin + 6, y + 14);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text(
    'Formula: 0.50 × Conversation Scam + 0.30 × AASIST Voice Anti-Spoofing + 0.20 × Caller Reputation',
    margin + 6,
    y + 20
  );

  y += 30;

  // 3. CALL IDENTIFICATION & METADATA TABLE
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(...borderGray);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, y, pageWidth - (margin * 2), 26, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...primaryDark);
  doc.text('Call Identification & Capture Attributes (Section 9 Schema)', margin + 5, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...grayText);

  const col1 = margin + 5;
  const col2 = margin + 50;
  const col3 = margin + 105;
  const col4 = margin + 145;

  // Row 1
  doc.text('Incident Call ID:', col1, y + 13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primaryDark);
  doc.text(record.callId, col1 + 22, y + 13);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...grayText);
  doc.text('Timestamp:', col2, y + 13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primaryDark);
  doc.text(record.timestamp || 'N/A', col2 + 16, y + 13);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...grayText);
  doc.text('Duration:', col4, y + 13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primaryDark);
  doc.text(`${record.duration || record.durationSeconds + 's'}`, col4 + 13, y + 13);

  // Row 2
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...grayText);
  doc.text('Caller Number:', col1, y + 20);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primaryDark);
  doc.text(`${record.callerNumber || record.fullCaller || 'Unknown'}`, col1 + 22, y + 20);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...grayText);
  doc.text('Language Detected:', col2, y + 20);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primaryDark);
  doc.text(`${record.language || 'English'}`, col2 + 27, y + 20);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...grayText);
  doc.text('Input Source:', col4, y + 20);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primaryDark);
  const src = (record.inputSource || 'Audio Upload').slice(0, 16);
  doc.text(src, col4 + 18, y + 20);

  y += 32;

  // 4. TRI-SIGNAL FORENSIC BREAKDOWN (3 Columns)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...primaryDark);
  doc.text('Tri-Signal Forensic Weights & Model Deconstruction (Section 7)', margin, y + 2);
  y += 6;

  const cardWidth = (pageWidth - (margin * 2) - 8) / 3;

  // Card 1: Conversation
  doc.setFillColor(250, 245, 255); // purple 50
  doc.setDrawColor(216, 180, 254);  // purple 300
  doc.roundedRect(margin, y, cardWidth, 24, 1.5, 1.5, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(126, 34, 206);
  doc.text('SIGNAL 1: SCAM MODEL', margin + 4, y + 5);
  doc.setFontSize(6.5);
  doc.setTextColor(147, 51, 234);
  doc.text('50% Risk Weight', margin + cardWidth - 4, y + 5, { align: 'right' });
  doc.setFontSize(13);
  doc.setTextColor(88, 28, 135);
  doc.text(`${((record.conversationScore || 0) * 100).toFixed(1)}%`, margin + 4, y + 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(107, 114, 128);
  doc.text('Scam_model_final (6 Criteria)', margin + 4, y + 20);

  // Card 2: AASIST
  const card2X = margin + cardWidth + 4;
  doc.setFillColor(254, 243, 199); // amber 100
  doc.setDrawColor(252, 211, 77);   // amber 300
  doc.roundedRect(card2X, y, cardWidth, 24, 1.5, 1.5, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(180, 83, 9);
  doc.text('SIGNAL 2: AASIST SPOOF', card2X + 4, y + 5);
  doc.setFontSize(6.5);
  doc.setTextColor(217, 119, 6);
  doc.text('30% Risk Weight', card2X + cardWidth - 4, y + 5, { align: 'right' });
  doc.setFontSize(13);
  doc.setTextColor(120, 53, 15);
  doc.text(`${((record.aasistScore || 0) * 100).toFixed(1)}%`, card2X + 4, y + 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(107, 114, 128);
  const bonafide = ((1.0 - (record.aasistScore || 0)) * 100).toFixed(0);
  doc.text(`Graph Attention (Bona-fide: ${bonafide}%)`, card2X + 4, y + 20);

  // Card 3: Caller Rep
  const card3X = margin + (cardWidth * 2) + 8;
  doc.setFillColor(239, 246, 255); // blue 50
  doc.setDrawColor(191, 219, 254);  // blue 200
  doc.roundedRect(card3X, y, cardWidth, 24, 1.5, 1.5, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(29, 78, 216);
  doc.text('SIGNAL 3: CALLER REP', card3X + 4, y + 5);
  doc.setFontSize(6.5);
  doc.setTextColor(37, 99, 235);
  doc.text('20% Risk Weight', card3X + cardWidth - 4, y + 5, { align: 'right' });
  doc.setFontSize(13);
  doc.setTextColor(30, 58, 138);
  doc.text(`${((record.reputationScore || 0) * 100).toFixed(1)}%`, card3X + 4, y + 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(107, 114, 128);
  doc.text('TRAI / DoT Database', card3X + 4, y + 20);

  y += 30;

  // 5. THE 6 PHISHING CRITERIA EVALUATION (SECTION 3.2)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...primaryDark);
  doc.text('Evaluation Across the 6 Phishing Criteria (Section 3.2)', margin, y + 2);
  y += 6;

  const criteriaList = [
    { name: '1. Authority Impersonation', key: 'authority_impersonation' },
    { name: '2. Urgency & Fear Tactics', key: 'urgency_fear' },
    { name: '3. Payment / Money Requests', key: 'payment_requests' },
    { name: '4. Credential / OTP Requests', key: 'information_requests' },
    { name: '5. Isolation & Secrecy', key: 'isolation_secrecy' },
    { name: '6. Trust Manipulation', key: 'trust_manipulation' }
  ];

  const critScores = record.criteriaScores || {};

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(...borderGray);
  doc.roundedRect(margin, y, pageWidth - (margin * 2), 34, 1.5, 1.5, 'FD');

  const halfWidth = (pageWidth - (margin * 2)) / 2;

  criteriaList.forEach((c, idx) => {
    const isCol2 = idx >= 3;
    const rowIdx = idx % 3;
    const itemX = margin + (isCol2 ? halfWidth + 4 : 5);
    const itemY = y + 8 + (rowIdx * 9);

    const val = critScores[c.key] ?? (
      c.key === 'information_requests' ? critScores['credential_otp_requests'] : undefined
    ) ?? 0;
    const pct = (val * 100).toFixed(1);
    const isHigh = val >= 0.50;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(51, 65, 85);
    doc.text(c.name, itemX, itemY);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...(isHigh ? [220, 38, 38] : [30, 41, 59]));
    doc.text(`${pct}%`, itemX + halfWidth - 14, itemY, { align: 'right' });
  });

  y += 40;

  // 6. DETECTED PHISHING INDICATORS TAGS
  if (record.detectedIndicators && record.detectedIndicators.length > 0) {
    checkPageBreak(25);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...primaryDark);
    doc.text('Specific Indicators Triggered in Context:', margin, y + 2);
    y += 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(220, 38, 38);

    record.detectedIndicators.forEach(ind => {
      checkPageBreak(7);
      doc.text(`[!] ${ind}`, margin + 4, y);
      y += 5;
    });
    y += 2;
  }

  // 7. GUARDIAN ALERT DISPATCH
  checkPageBreak(20);
  doc.setFillColor(254, 242, 242);
  doc.setDrawColor(254, 202, 202);
  doc.roundedRect(margin, y, pageWidth - (margin * 2), 16, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(185, 28, 28);
  doc.text('REAL-TIME ACTION: GUARDIAN ALERT (FCM PUSH)', margin + 5, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(69, 10, 10);
  doc.text(
    `Status: ${record.guardianStatus || 'NOT_TRIGGERED'} • Protocol: Firebase Cloud Messaging Push`,
    margin + 5,
    y + 12
  );

  y += 22;

  // 8. TRANSCRIBED SPEECH CONTEXT (Whisper Speech-to-Text)
  checkPageBreak(35);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...primaryDark);
  doc.text('Transcribed Speech Context (Whisper STT Audio Recognition)', margin, y + 2);
  y += 6;

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(...borderGray);

  const transcript = record.transcriptPreview || record.transcript || '(No speech transcript recorded)';
  const splitTranscript = doc.splitTextToSize(`"${transcript}"`, pageWidth - (margin * 2) - 10);
  const transcriptBoxHeight = Math.max(16, (splitTranscript.length * 4.2) + 8);

  // If the transcript box is taller than the remaining page, break page first
  checkPageBreak(Math.min(transcriptBoxHeight, 70));

  doc.roundedRect(margin, y, pageWidth - (margin * 2), transcriptBoxHeight, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(51, 65, 85);
  doc.text(splitTranscript, margin + 5, y + 6);

  y += transcriptBoxHeight + 8;

  // 9. FOOTER AUDIT STAMP
  checkPageBreak(15);
  doc.setDrawColor(...borderGray);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageWidth - margin, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(...grayText);
  doc.text(
    `Generated by Voice Phishing Evaluator • Anti-Spoofing & Scam Intelligence System • Timestamp: ${new Date().toISOString()}`,
    margin,
    y + 5
  );

  doc.text(
    `Page ${doc.internal.getNumberOfPages()}`,
    pageWidth - margin,
    y + 5,
    { align: 'right' }
  );

  // Save PDF file
  const filename = `Forensic_Report_${record.callId || 'Call'}.pdf`;
  doc.save(filename);
}

/**
 * Generates structured JSON download for PostgreSQL ingestion.
 */
export function exportReportAsJson(record) {
  if (!record) return;

  const exportPayload = {
    report_type: 'VOICE_PHISHING_FORENSIC_ANALYSIS',
    schema_version: '1.0.0',
    generated_at: new Date().toISOString(),
    postgresql_call_record: {
      call_id: record.callId,
      timestamp: record.timestamp,
      caller_number_protected: record.callerNumber,
      caller_number_raw: record.fullCaller || record.callerNumber,
      duration_seconds: record.durationSeconds || 120,
      detected_language: record.language,
      conversation_scam_score: record.conversationScore,
      aasist_spoof_score: record.aasistScore,
      caller_reputation_score: record.reputationScore,
      final_risk_score: record.finalRisk,
      risk_classification: record.riskLevel,
      criteria_scores_breakdown: record.criteriaScores || {},
      detected_phishing_indicators: record.detectedIndicators || [],
      guardian_notification_status: record.guardianStatus,
      whisper_transcript: record.transcriptPreview || record.transcript || '',
      aasist_spectro_temporal_details: record.aasistDetails || {},
      raw_backend_pipeline_data: record.rawBackendData || null
    }
  };

  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(exportPayload, null, 2));
  const anchor = document.createElement('a');
  anchor.setAttribute('href', dataStr);
  anchor.setAttribute('download', `Call_Analysis_Report_${record.callId}.json`);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}
