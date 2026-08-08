import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import logoSrc from '../public/Logo.png';
import { outfitRegularB64, outfitBoldB64 } from './outfitFont.js';

function registerOutfit(doc) {
  doc.addFileToVFS('Outfit-Regular.ttf', outfitRegularB64);
  doc.addFont('Outfit-Regular.ttf', 'Outfit', 'normal');
  doc.addFileToVFS('Outfit-Bold.ttf', outfitBoldB64);
  doc.addFont('Outfit-Bold.ttf', 'Outfit', 'bold');
}

const BR  = [107, 68,  35];
const BR2 = [160, 110, 70];
const BRL = [245, 236, 225];
const BLK = [20,  15,  10];
const GRY = [130, 115, 100];

const PW = 210;
const PH = 297;
const ML = 20;
const MR = 190;
const CW = MR - ML;

const tBrown  = (doc) => { doc.setTextColor(...BR);  doc.setDrawColor(...BR); };
const tBlack  = (doc) => { doc.setTextColor(...BLK); doc.setDrawColor(...BR2); };
const tGrey   = (doc) => doc.setTextColor(...GRY);
const dBrown  = (doc) => doc.setDrawColor(...BR);
const dBrown2 = (doc) => doc.setDrawColor(...BR2);

function hline(doc, x1, x2, y, lw = 0.3, useBrown = true) {
  if (useBrown) dBrown2(doc); else doc.setDrawColor(...BLK);
  doc.setLineWidth(lw);
  doc.line(x1, y, x2, y);
}

function vline(doc, x, y1, y2, lw = 0.2) {
  dBrown2(doc);
  doc.setLineWidth(lw);
  doc.line(x, y1, x, y2);
}

function strokeRect(doc, x, y, w, h, lw = 0.3) {
  dBrown2(doc);
  doc.setLineWidth(lw);
  doc.rect(x, y, w, h, 'S');
}

function fillRect(doc, x, y, w, h, color) {
  doc.setFillColor(...color);
  doc.rect(x, y, w, h, 'F');
}

async function loadImg(url) {
  if (!url) return null;
  if (typeof url === 'string' && url.startsWith('data:')) return url;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise((ok) => {
      const fr = new FileReader();
      fr.onloadend = () => ok(fr.result);
      fr.onerror   = () => ok(null);
      fr.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function imgFmt(d) {
  if (!d) return 'PNG';
  if (d.includes('image/png'))  return 'PNG';
  if (d.includes('image/webp')) return 'WEBP';
  return 'JPEG';
}

function imgBox(doc, data, bx, by, bw, bh) {
  strokeRect(doc, bx, by, bw, bh, 0.25);
  if (!data) {
    doc.setFont('Outfit', 'normal');
    doc.setFontSize(7);
    tGrey(doc);
    doc.text('No image available', bx + bw / 2, by + bh / 2 + 2, { align: 'center' });
    return;
  }
  try {
    doc.addImage(data, imgFmt(data), bx, by, bw, bh, undefined, 'NONE');
  } catch {
    doc.setFont('Outfit', 'italic');
    doc.setFontSize(7);
    tGrey(doc);
    doc.text('Image unavailable', bx + bw / 2, by + bh / 2 + 2, { align: 'center' });
  }
}

function heading(doc, text, y) {
  tBrown(doc);
  doc.setFont('Outfit', 'bold');
  doc.setFontSize(10);
  doc.text(text.toUpperCase(), ML, y);
  hline(doc, ML, MR, y + 2.8, 0.5, true);
  return y + 10;
}

function kvRow(doc, label, value, y, colEnd = 68) {
  doc.setFont('Outfit', 'bold');
  doc.setFontSize(7.8);
  tGrey(doc);
  doc.text(label.toUpperCase(), ML, y);
  tBrown(doc);
  doc.text(':', colEnd - 2, y);
  doc.setFont('Outfit', 'normal');
  doc.setFontSize(8.5);
  tBlack(doc);
  const lines = doc.splitTextToSize(String(value ?? '—'), MR - colEnd - 2);
  doc.text(lines, colEnd + 2, y);
  return y + Math.max(6.5, lines.length * 5.8);
}

function barRow(doc, label, pct, y) {
  const bx  = ML + 72;
  const bw  = 84;
  const bh  = 4.5;
  doc.setFont('Outfit', 'normal');
  doc.setFontSize(8.5);
  tBlack(doc);
  doc.text(label, ML, y);
  fillRect(doc, bx, y - bh + 0.8, bw, bh, BRL);
  strokeRect(doc, bx, y - bh + 0.8, bw, bh, 0.2);
  fillRect(doc, bx, y - bh + 0.8, Math.max(1.5, (pct / 100) * bw), bh, BR);
  doc.setFont('Outfit', 'bold');
  doc.setFontSize(8.5);
  tBrown(doc);
  doc.text(`${pct}%`, bx + bw + 4, y);
  return y + 7.5;
}

function bulletRow(doc, text, y) {
  tBrown(doc);
  doc.setFont('Outfit', 'bold');
  doc.setFontSize(8.5);
  doc.text('—', ML, y);
  tBlack(doc);
  doc.setFont('Outfit', 'normal');
  const lines = doc.splitTextToSize(text, CW - 8);
  doc.text(lines, ML + 7, y);
  return y + Math.max(7, lines.length * 5.8);
}

function guard(doc, y, needed, onNewPage) {
  if (y + needed > 276) {
    doc.addPage();
    return onNewPage(doc);
  }
  return y;
}

function drawHeader(doc, logoData, reportId, dateStr, timeStr, pageLabel) {
  const logoX = ML;
  const logoY = 5;
  const logoW = 13;
  const logoH = 13;

  if (logoData) {
    try { doc.addImage(logoData, imgFmt(logoData), logoX, logoY, logoW, logoH, undefined, 'FAST'); }
    catch {}
  }

  const tx = logoX + logoW + 3;
  doc.setFont('Outfit', 'bold');
  doc.setFontSize(14);
  tBrown(doc);
  doc.text('DocLens', tx, logoY + 7);

  doc.setFont('Outfit', 'normal');
  doc.setFontSize(7);
  tGrey(doc);
  doc.text('AI-Powered Signature & Document Examination', tx, logoY + 12);

  const meta = [
    ['REPORT ID', reportId],
    ['DATE',      dateStr],
    ['TIME',      timeStr],
    ['VERSION',   'v1.0'],
    ['PAGE',      pageLabel],
  ];
  const lx2 = MR - 78;
  const cx2 = MR - 32;
  const vx2 = MR - 28;
  let my = logoY;
  meta.forEach(([lbl, val]) => {
    doc.setFont('Outfit', 'bold');
    doc.setFontSize(6.5);
    tGrey(doc);
    doc.text(lbl, lx2, my + 4.5);
    tBrown(doc);
    doc.text(':', cx2, my + 4.5);
    doc.setFont('Outfit', 'normal');
    doc.setFontSize(7);
    tBlack(doc);
    doc.text(String(val), vx2, my + 4.5);
    my += 4.4;
  });

  hline(doc, ML, MR, logoY + logoH + 3, 0.5, true);
  return logoY + logoH + 9;
}

function drawFooter(doc, pageNum, total) {
  const fy = 288;
  hline(doc, ML, MR, fy, 0.3, true);
  doc.setFont('Outfit', 'normal');
  doc.setFontSize(7);
  tBrown(doc);
  doc.text(`DocLens v1.0`, ML, fy + 4);
  tGrey(doc);
  doc.text(`Page ${pageNum} of ${total}`, MR, fy + 4, { align: 'right' });
}

function buildCover(doc, logoData, reportId, dateStr, timeStr) {
  const cx = PW / 2;

  const logoX = ML;
  const logoY = 28;
  const logoW = 22;
  const logoH = 22;
  if (logoData) {
    try { doc.addImage(logoData, imgFmt(logoData), logoX, logoY, logoW, logoH, undefined, 'FAST'); }
    catch {}
  }
  doc.setFont('Outfit', 'bold');
  doc.setFontSize(22);
  tBrown(doc);
  doc.text('DocLens', logoX + logoW + 4, logoY + 12);
  doc.setFont('Outfit', 'normal');
  doc.setFontSize(8);
  tGrey(doc);
  doc.text('Forensic Document Examination System', logoX + logoW + 4, logoY + 18);

  let y = logoY + logoH + 22;

  doc.setFont('Outfit', 'bold');
  doc.setFontSize(28);
  tBrown(doc);
  doc.text('FORENSIC REPORT', cx, y, { align: 'center' });
  y += 10;

  doc.setFont('Outfit', 'normal');
  doc.setFontSize(10);
  tGrey(doc);
  doc.text('AI-Powered Signature & Document Examination', cx, y, { align: 'center' });
  y += 22;

  hline(doc, ML + 20, MR - 20, y, 0.4, true);
  y += 16;

  const lx   = ML + 10;
  const lce  = lx + 38;
  const rx   = cx + 10;
  const rce  = rx + 38;
  const rowH = 11;

  const leftRows  = [
    ['REPORT ID', reportId],
    ['DATE',      dateStr],
    ['TIME',      timeStr],
    ['VERSION',   'v1.0'],
  ];
  const rightRows = [
    ['ANALYST', 'DocLens AI Forensic Engine'],
    ['STATUS',  'Analysis Complete'],
  ];

  leftRows.forEach(([lbl, val]) => {
    doc.setFont('Outfit', 'bold');
    doc.setFontSize(7.5);
    tGrey(doc);
    doc.text(lbl, lx, y);
    tBrown(doc);
    doc.text(':', lce, y);
    doc.setFont('Outfit', 'normal');
    doc.setFontSize(8.5);
    tBlack(doc);
    doc.text(String(val), lce + 4, y);
    y += rowH;
  });

  let ry = y - leftRows.length * rowH;
  rightRows.forEach(([lbl, val]) => {
    doc.setFont('Outfit', 'bold');
    doc.setFontSize(7.5);
    tGrey(doc);
    doc.text(lbl, rx, ry);
    tBrown(doc);
    doc.text(':', rce, ry);
    doc.setFont('Outfit', 'normal');
    doc.setFontSize(8.5);
    tBlack(doc);
    doc.text(String(val), rce + 4, ry);
    ry += rowH;
  });

  doc.setFont('Outfit', 'normal');
  doc.setFontSize(8);
  tGrey(doc);
  doc.text('TRUSTED EVIDENCE.   CLEAR INSIGHT.', cx, PH - 26, { align: 'center' });
  doc.setFont('Outfit', 'normal');
  doc.setFontSize(7);
  tGrey(doc);
  doc.text('DocLens AI Forensic Engine  |  Version 1.0', cx, PH - 20, { align: 'center' });
}

function buildPage1(doc, D, logoData) {
  doc.addPage();
  const onNew = (d) => drawHeader(d, logoData, D.reportId, D.dateStr, D.timeStr, '— of —');
  let y = drawHeader(doc, logoData, D.reportId, D.dateStr, D.timeStr, '— of —');

  y = heading(doc, 'Executive Summary', y);

  const mw = CW / 4;
  fillRect(doc, ML, y, CW, 26, BRL);
  strokeRect(doc, ML, y, CW, 26, 0.4);
  [1, 2, 3].forEach(i => vline(doc, ML + i * mw, y, y + 26));

  const metrics = [
    { lbl: 'VERDICT',            val: D.verdictIsForged ? 'Forgery Suspected' : 'Genuine' },
    { lbl: 'CONFIDENCE',         val: `${D.confidence ?? '—'}%` },
    { lbl: 'OVERALL SIMILARITY', val: `${D.bestScore ?? D.confidence ?? '—'}%` },
    { lbl: 'RISK LEVEL',         val: D.verdictIsForged ? 'High' : 'Low' },
  ];
  metrics.forEach(({ lbl, val }, i) => {
    const ix = ML + i * mw + 4;
    doc.setFont('Outfit', 'bold');
    doc.setFontSize(6.8);
    tGrey(doc);
    doc.text(lbl, ix, y + 8);
    doc.setFont('Outfit', 'bold');
    doc.setFontSize(11);
    tBrown(doc);
    doc.text(val, ix, y + 20);
  });
  y += 32;

  y = guard(doc, y, 14, onNew);
  y = heading(doc, 'Case Information', y);

  const half   = CW / 2 - 4;
  const mid    = ML + half + 8;
  const lcEnd  = ML + 48;
  const rcEnd  = mid + 48;

  const leftCI = [
    ['Document Type',      D.caseData?.caseType || 'N/A'],
    ['File Name',          D.caseData?.questionedFile?.name || '—'],
    ['File Size',          D.caseData?.questionedFile?.size
                             ? `${(D.caseData.questionedFile.size / 1024 / 1024).toFixed(2)} MB` : '—'],
    ['Signature Detected', 'Yes — Auto-located'],
  ];
  const rightCI = [
    ['Claimed Signer',    D.signerName || '—'],
    ['Reference Samples', String(D.refCount)],
    ['Dataset Used',      'User-submitted References'],
    ['Analysis Date',     D.dateStr],
  ];

  const ciAnchor = y;
  leftCI.forEach(([lbl, val]) => {
    y = guard(doc, y, 7, onNew);
    doc.setFont('Outfit', 'bold');
    doc.setFontSize(7.8);
    tGrey(doc);
    doc.text(lbl.toUpperCase(), ML, y);
    tBrown(doc);
    doc.text(':', lcEnd - 2, y);
    doc.setFont('Outfit', 'normal');
    doc.setFontSize(8.5);
    tBlack(doc);
    doc.text(String(val), lcEnd + 2, y);
    y += 7;
  });

  let ry = ciAnchor;
  rightCI.forEach(([lbl, val]) => {
    doc.setFont('Outfit', 'bold');
    doc.setFontSize(7.8);
    tGrey(doc);
    doc.text(lbl.toUpperCase(), mid, ry);
    tBrown(doc);
    doc.text(':', rcEnd - 2, ry);
    doc.setFont('Outfit', 'normal');
    doc.setFontSize(8.5);
    tBlack(doc);
    doc.text(String(val), rcEnd + 2, ry);
    ry += 7;
  });
  y = Math.max(y, ry) + 8;

  y = guard(doc, y, 14, onNew);
  y = heading(doc, 'Signature Detection', y);

  doc.setFont('Outfit', 'normal');
  doc.setFontSize(8.5);
  tBlack(doc);
  doc.text('Signature region automatically located within the submitted document using CNN-based detection.', ML, y);
  y += 9;

  const sigR    = D.sigRegion;
  const dce     = ML + 42;
  const detRows = [
    ['Bounding Box X',      String(sigR?.x ?? '—')],
    ['Bounding Box Y',      String(sigR?.y ?? '—')],
    ['Width',               String(sigR?.w ?? '—')],
    ['Height',              String(sigR?.h ?? '—')],
  ];
  const detAnchor = y;
  detRows.forEach(([lbl, val]) => {
    y = guard(doc, y, 7, onNew);
    doc.setFont('Outfit', 'bold');
    doc.setFontSize(7.8);
    tGrey(doc);
    doc.text(lbl.toUpperCase(), ML, y);
    tBrown(doc);
    doc.text(':', dce - 2, y);
    doc.setFont('Outfit', 'normal');
    doc.setFontSize(8.5);
    tBlack(doc);
    doc.text(val, dce + 2, y);
    y += 7;
  });

  doc.setFont('Outfit', 'bold');
  doc.setFontSize(7.8);
  tGrey(doc);
  doc.text('DETECTION CONFIDENCE', mid, detAnchor);
  doc.setFont('Outfit', 'bold');
  doc.setFontSize(26);
  tBrown(doc);
  doc.text(`${D.confidence ?? '—'}%`, mid, detAnchor + 17);
  doc.setFont('Outfit', 'normal');
  doc.setFontSize(7.5);
  tGrey(doc);
  doc.text('CNN signature region detection', mid, detAnchor + 23);

  y = Math.max(y, detAnchor + 30) + 6;
}

function buildPage2(doc, D, logoData, qCropData, refCropData, heatmapData) {
  doc.addPage();
  const onNew = (d) => drawHeader(d, logoData, D.reportId, D.dateStr, D.timeStr, '— of —');
  let y = drawHeader(doc, logoData, D.reportId, D.dateStr, D.timeStr, '— of —');

  y = heading(doc, 'Compared Signatures', y);

  const imgW = (CW - 8) / 3;
  const imgH = 50;
  const sigImgs  = [refCropData, qCropData, heatmapData];
  const sigLabels = ['Reference Signature', 'Questioned Signature', 'Overlay Comparison'];

  sigLabels.forEach((lbl, i) => {
    const bx = ML + i * (imgW + 4);
    doc.setFont('Outfit', 'bold');
    doc.setFontSize(7.5);
    tGrey(doc);
    doc.text(lbl.toUpperCase(), bx, y);
  });
  y += 4;

  sigImgs.forEach((img, i) => {
    imgBox(doc, img, ML + i * (imgW + 4), y, imgW, imgH);
  });
  y += imgH + 5;

  doc.setFont('Outfit', 'normal');
  doc.setFontSize(7.5);
  tGrey(doc);
  doc.text(
    'Overlay: spatial alignment and regional divergence between the questioned and reference signature.',
    ML, y
  );
  y += 10;

  y = guard(doc, y, 16, onNew);
  y = heading(doc, 'Forensic Feature Examination', y);

  doc.setFont('Outfit', 'bold');
  doc.setFontSize(7.8);
  tBrown(doc);
  doc.text('FORENSIC FEATURE', ML, y);
  doc.text('EXAMINATION RESULT', ML + 80, y);
  y += 6;

  const kd    = D.r.keyDifferences || [];
  const match = (keys) => kd.find(k => keys.some(kw => k.label?.toLowerCase().includes(kw)));

  const featureRows = [
    ['Allograph Morphology',            match(['stroke','letter','proportion'])  ? 'Class & individual characteristics diverge from reference set'    : 'Class characteristics consistent with reference exemplars'],
    ['Axial Pen Pressure Distribution', match(['pressure'])                      ? 'Lateral force variation pattern inconsistent with reference'      : 'Lateral force distribution within expected range'],
    ['Baseline Trajectory',             match(['baseline'])                      ? 'Deviation from habitual writing line; possible feigned tilt'      : 'Baseline trajectory consistent with reference specimens'],
    ['Pen-Lift Sequencing',             match(['pen lift','pen-lift'])           ? 'Lift positions atypical; suggests interrupted execution'          : 'Pen-lift positions consistent with reference sequence'],
    ['Entry & Approach Strokes',        match(['entry'])                         ? 'Initial stroke formation inconsistent; possible hesitation'       : 'Approach strokes consistent with habitual motor pattern'],
    ['Terminal & Exit Strokes',         match(['exit'])                          ? 'Exit stroke truncated or retraced; inconsistent formation'        : 'Exit strokes consistent with reference terminal strokes'],
    ['Fluency & Line Quality',          match(['stroke','curvature'])            ? 'Line quality disrupted; tremor or retouching artifacts present'   : 'Line quality consistent with fluent, habitual execution'],
    ['Axial Slant Angle',               match(['slant'])                         ? 'Writing slant deviates beyond ±5° of reference mean'             : 'Slant angle within ±5° tolerance of reference specimens'],
    ['Spatial Proportionality',         match(['proportion','letter','spacing']) ? 'Inter-letter spacing and height ratios show significant shift'    : 'Spatial proportions consistent with habitual writing habit'],
    ['Relative Connecting Strokes',     match(['curvature'])                     ? 'Connecting arc geometry and curvature deviate from reference'     : 'Connecting strokes consistent with reference arc geometry'],
    ['Speed & Rhythm Indicators',       D.verdictIsForged                        ? 'Slow, laboured execution; speed indicators inconsistent'         : 'Writing speed and rhythm consistent with natural execution'],
    ['Retrace & Correction Artifacts',  D.verdictIsForged                        ? 'Retrace artifacts and patch-corrections detected'                : 'No retrace or correction artifacts observed'],
  ];

  const anomalyWords = ['diverge','inconsistent','deviation','atypical','truncated','retraced',
    'disrupted','tremor','retouching','deviates','significant shift','slow','laboured','artifacts'];

  featureRows.forEach(([feat, res], i) => {
    const isAnomaly = anomalyWords.some(p => res.toLowerCase().includes(p));
    const resLines  = doc.splitTextToSize(res, MR - ML - 82);
    const rowH      = Math.max(8, resLines.length * 5.5 + 2);
    y = guard(doc, y, rowH + 1, onNew);

    if (i % 2 === 0) fillRect(doc, ML - 1, y - 5.5, CW + 2, rowH, BRL);

    doc.setFont('Outfit', 'normal');
    doc.setFontSize(8);
    tBlack(doc);
    doc.text(feat, ML, y);

    doc.setFont('Outfit', isAnomaly ? 'bold' : 'normal');
    doc.setFontSize(8);
    if (isAnomaly) tBrown(doc); else tBlack(doc);
    doc.text(resLines, ML + 80, y);
    y += rowH;
  });
  y += 4;
}

function buildPage3(doc, D, logoData, heatmapData, qCropData) {
  doc.addPage();
  const onNew = (d) => drawHeader(d, logoData, D.reportId, D.dateStr, D.timeStr, '— of —');
  let y = drawHeader(doc, logoData, D.reportId, D.dateStr, D.timeStr, '— of —');

  y = heading(doc, 'Explainability Heatmap', y);

  const half = (CW - 6) / 2;
  const hmH  = 60;

  doc.setFont('Outfit', 'bold');
  doc.setFontSize(7.5);
  tGrey(doc);
  doc.text('ORIGINAL SIGNATURE', ML, y);
  doc.text('GRAD-CAM ACTIVATION OVERLAY', ML + half + 6, y);
  y += 4;

  imgBox(doc, qCropData,   ML,            y, half, hmH);
  imgBox(doc, heatmapData, ML + half + 6, y, half, hmH);
  y += hmH + 6;

  doc.setFont('Outfit', 'normal');
  doc.setFontSize(7.5);
  tGrey(doc);
  doc.text(
    'Gradient-weighted Class Activation Map (Grad-CAM): regions of highest activation gradient contributed most to the classification verdict.',
    ML, y
  );
  y += 10;

  y = guard(doc, y, 16, onNew);
  y = heading(doc, 'Examiner Opinion', y);

  const obs = D.r.writtenReport || (D.verdictIsForged
    ? `The AI analysis identified significant inconsistencies between the questioned signature and the reference specimens. The cosine-distance similarity score of ${D.bestScore ?? D.confidence ?? '—'}% falls below the 75% authenticity threshold. Manual review by a certified Forensic Document Examiner is recommended before any consequential decision is made.`
    : `The AI analysis found the questioned signature to be consistent with the reference specimens. The cosine-distance similarity score of ${D.bestScore ?? D.confidence ?? '—'}% meets or exceeds the 75% authenticity threshold. Routine verification by a qualified examiner is advised for legally significant matters.`);

  doc.setFont('Outfit', 'normal');
  doc.setFontSize(8.5);
  tBlack(doc);
  doc.splitTextToSize(obs, CW).forEach(line => {
    y = guard(doc, y, 6, onNew);
    doc.text(line, ML, y);
    y += 5.8;
  });
  y += 8;

  y = guard(doc, y, 16, onNew);
  y = heading(doc, 'Feature Similarity Metrics', y);

  const refM  = D.r.referenceMatches || [];
  const best  = refM.length > 0 ? Math.max(...refM.map(m => m.score || 0)) : (D.confidence || 0);

  const bestMatch = refM.find(m => m.score === best) || refM[0];
  const realFeatureScores = bestMatch?.featureScores || [];

  const simRows = realFeatureScores.length > 0
    ? [['Overall Cosine Similarity', best], ...realFeatureScores.map(f => [f.label, f.score])]
    : [['Overall Cosine Similarity', best]];

  simRows.forEach(([lbl, pct]) => {
    y = guard(doc, y, 9, onNew);
    y = barRow(doc, lbl, Math.max(5, Math.min(99, Math.round(pct))), y);
  });
  y += 6;
}

function buildPage4(doc, D, logoData) {
  doc.addPage();
  const onNew = (d) => drawHeader(d, logoData, D.reportId, D.dateStr, D.timeStr, '— of —');
  let y = drawHeader(doc, logoData, D.reportId, D.dateStr, D.timeStr, '— of —');

  y = heading(doc, 'Confidence Explanation', y);

  const confText =
    `The confidence score of ${D.confidence ?? '—'}% represents the posterior probability assigned by the ` +
    `CNN-based embedding model that the questioned signature and the reference specimens share the same ` +
    `authorship, given the cosine-distance similarity of the extracted 512-dimensional feature vectors. ` +
    `A score above 85% is classified as High Confidence; 60–85% as Medium; below 60% as Low. This score ` +
    `is derived solely from feature-space geometry and does not constitute an absolute determination of ` +
    `authorship. It should be interpreted in conjunction with the forensic feature examination findings ` +
    `and, where required for legal proceedings, reviewed by a certified Forensic Document Examiner (FDE) ` +
    `in accordance with SWGDOC or OSFE standards.`;

  doc.setFont('Outfit', 'normal');
  doc.setFontSize(8.5);
  tBlack(doc);
  doc.splitTextToSize(confText, CW).forEach(line => {
    y = guard(doc, y, 6, onNew);
    doc.text(line, ML, y);
    y += 5.8;
  });
  y += 8;

  y = guard(doc, y, 16, onNew);
  y = heading(doc, 'Recommendations', y);

  doc.setFont('Outfit', 'bold');
  doc.setFontSize(8.5);
  tBlack(doc);
  doc.text('Recommended Actions', ML, y);
  y += 8;

  [
    'Conduct independent blind verification by a certified Forensic Document Examiner (FDE)',
    'Obtain additional reference exemplars — minimum 15 specimens recommended per SWGDOC guidelines',
    'Verify chain of custody and provenance of all submitted documents',
    'Investigate signing circumstances, including date, location, and witnesses',
    'Cross-reference with any prior known genuine signatures on official documents',
    'If pursuing legal proceedings, commission a full OSFE-compliant handwriting examination',
  ].forEach(rec => {
    y = guard(doc, y, 9, onNew);
    y = bulletRow(doc, rec, y);
  });
  y += 8;

  y = guard(doc, y, 16, onNew);
  y = heading(doc, 'Technical Information', y);

  const techRows = [
    ['Analysis Engine',         'DocLens AI Forensic Pipeline v1.0'],
    ['Feature Extractor',       `${D.modelName} — pretrained on ImageNet, fine-tuned on signature corpus`],
    ['Embedding Dimensionality','512-dimensional L2-normalised feature vector per specimen'],
    ['Similarity Metric',       'Cosine distance (1 − cos θ);  authenticity threshold ≥ 0.75'],
    ['Region Detection',        'CNN-based bounding-box detector; morphological post-processing'],
    ['Explainability Method',   'Gradient-weighted Class Activation Mapping (Grad-CAM)'],
    ['Preprocessing Pipeline',  'Greyscale → adaptive binarisation → stroke normalisation → 224×224 resize'],
    ['Reference Set Size',      `${D.refCount} specimen${D.refCount !== 1 ? 's' : ''} submitted`],
    ['Processing Time',         D.analysisTime || '—'],
    ['Standards Reference',     'SWGDOC Standard for Examination of Handwritten Items; OSFE Guidelines'],
  ];
  techRows.forEach(([lbl, val]) => {
    y = guard(doc, y, 7, onNew);
    y = kvRow(doc, lbl, val, y, 70);
  });
  y += 10;

  y = guard(doc, y, 28, onNew);
  hline(doc, ML, MR, y, 0.4, true);
  y += 8;

  doc.setFont('Outfit', 'bold');
  doc.setFontSize(7.5);
  tGrey(doc);
  doc.text('PREPARED BY', ML, y);
  y += 6;

  doc.setFont('Outfit', 'bold');
  doc.setFontSize(11);
  tBrown(doc);
  doc.text('DocLens AI Forensic Engine', ML, y);
  y += 6;

  doc.setFont('Outfit', 'normal');
  doc.setFontSize(8.5);
  tBlack(doc);
  doc.text('Automated Signature Verification System  |  Version 1.0', ML, y);
  y += 6;
  doc.text(`Report Generated:  ${D.dateStr}`, ML, y);
}

export async function generateReport(caseData) {
  const r               = caseData?.analysisResult || {};
  const verdict         = r.verdict         || 'UNKNOWN';
  const confidence      = r.confidence      ?? null;
  const caseId          = r.caseRef || r.caseId || caseData?.caseRef || 'N/A';
  const signerName      = r.signerName      || caseData?.signerName  || '—';
  const analysisTime    = r.analysisTime    || '—';
  const modelName       = r.model           || 'ResNet18 + Grad-CAM + Gemini';
  const sigRegion       = r.signatureRegion || null;
  const refMatches      = r.referenceMatches || [];
  const refCount        = refMatches.length || (caseData?.referenceFiles?.length) || 0;
  const verdictIsForged = verdict === 'FORGED';
  const bestScore       = refMatches.length > 0
    ? Math.max(...refMatches.map(m => m.score || 0))
    : confidence;

  const now      = new Date();
  const year     = now.getFullYear();
  const reportId = `DCL-${year}-${String(caseId).replace(/[^0-9]/g, '').slice(0, 6).padStart(6, '0')}`;
  const dateStr  = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'long',  year: 'numeric' });
  const timeStr  = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' });

  const D = {
    r, caseData, verdictIsForged, verdict, confidence, caseId, signerName,
    sigRegion, refCount, analysisTime, modelName, bestScore, reportId, dateStr, timeStr,
  };

  const qURL        = caseData?.questionedFileURL || caseData?.questionedStorageURL || null;
  const qCropURL    = r.questionedCropUrl || qURL || null;
  const refURLs     = caseData?.referenceFileURLs?.length
                        ? caseData.referenceFileURLs
                        : (caseData?.referenceStorageURLs || []);
  const refCropURLs = r.referenceCropUrls || refURLs || [];
  const heatmapURL  = r.heatmapUrl || r.overlayUrl || null;

  const [logoData, qCropData, refCropData, heatmapData] = await Promise.all([
    loadImg(logoSrc),
    loadImg(qCropURL),
    loadImg(refCropURLs[0] || null),
    loadImg(heatmapURL),
  ]);

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  registerOutfit(doc);

  buildCover(doc, logoData, reportId, dateStr, timeStr);
  buildPage1(doc, D, logoData);
  buildPage2(doc, D, logoData, qCropData, refCropData, heatmapData);
  buildPage3(doc, D, logoData, heatmapData, qCropData);
  buildPage4(doc, D, logoData);

  try {
    const qrData = await QRCode.toDataURL(
      `DocLens | ID: ${reportId} | ${verdict} | Confidence: ${confidence}%`,
      { width: 80, margin: 1, color: { dark: '#6b4423', light: '#ffffff' } }
    );
    const total = doc.getNumberOfPages();
    doc.setPage(total);
    doc.addImage(qrData, 'PNG', MR - 26, 250, 26, 26);
    doc.setFont('Outfit', 'normal');
    doc.setFontSize(6.2);
    tGrey(doc);
    doc.text('Scan to verify', MR - 13, 279, { align: 'center' });
  } catch { /* QR optional */ }

  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    drawFooter(doc, i, total);
  }

  const fileName = `DocLens_Report_${reportId}_${now.toISOString().slice(0, 10)}.pdf`;
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  if (isMobile) {
    try {
      const pdfBlob = doc.output('blob');
      const blobUrl = URL.createObjectURL(pdfBlob);

      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setTimeout(() => URL.revokeObjectURL(blobUrl), 20000);
    } catch {
      doc.save(fileName);
    }
  } else {
    doc.save(fileName);
  }
}
