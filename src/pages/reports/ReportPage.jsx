import { useState } from "react";
import {
  ChevronRight,
  ChevronDown,
  Download,
  Search,
  Maximize2,
  Info,
  ShieldAlert,
  Target,
  Layers,
  Clock,
  Cpu,
  Activity,
  CheckCircle2,
  Eye,
  AlertCircle,
  Brain,
  ArrowLeft,
} from "lucide-react";
import { generateReport } from "../../lib/generateReport.js";
import { useCase } from "../../context/CaseContext.jsx";
import { SignatureCanvas } from "../../components/SignatureCanvas.jsx";

export function ReportPage({ navigate, initialTab = "Overview" }) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [viewingDetail, setViewingDetail] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const { caseData } = useCase();
  const qURL =
    caseData?.questionedFileURL || caseData?.questionedStorageURL || null;
  const refURLs = caseData?.referenceFileURLs?.length
    ? caseData.referenceFileURLs
    : caseData?.referenceStorageURLs || [];
  const r = caseData?.analysisResult || {};

  const verdict = r.verdict || null;
  const confidence = r.confidence ?? null;
  const caseId = r.caseRef || r.caseId || caseData?.caseRef || "—";
  const signerName = r.signerName || caseData?.signerName || "—";
  const detectionMode = r.detectionMode || "—";
  const selfConsistencyScore = r.selfConsistencyScore ?? null;
  const analysisTime = r.analysisTime || "—";
  const modelName = r.model || "—";
  const sigRegion = r.signatureRegion || null;
  const overlayData = r.forensicOverlay || null;
  const keyDifferences = r.keyDifferences || [];
  const refMatches = r.referenceMatches || [];
  const refCount = refMatches.length || refURLs.length || 0;
  const verdictIsForged = verdict === "FORGED";

  const matchBadgeClass = (level) =>
    level === "Genuine Match"
      ? "genuine"
      : level === "Weak Match"
        ? "weak"
        : "poor";

  const qCropURL = r.questionedCropUrl || qURL || null;
  const qDisplayURL = r.questionedCropUrl || qURL || null;
  const refCropURLs = r.referenceCropUrls || refURLs || [];

  const gaugeOffset =
    confidence != null ? Math.round(204 - (confidence / 100) * 204) : 204;
  const confidenceLabel =
    confidence == null
      ? "—"
      : confidence >= 85
        ? "High Confidence"
        : confidence >= 60
          ? "Medium Confidence"
          : "Low Confidence";

  return (
    <section className="rpt-root" aria-labelledby="rpt-page-title">
      <div className="rpt-header-row">
        <div>
          <nav className="add-breadcrumb" aria-label="Breadcrumb">
            <button type="button" onClick={() => navigate("/cases")}>
              Cases
            </button>
            <ChevronRight size={18} strokeWidth={2.5} />
            {activeTab === "Overview" ? (
              <>
                <button
                  type="button"
                  onClick={() => navigate("/cases/add/step-1")}
                >
                  Add Case
                </button>
                <ChevronRight size={18} strokeWidth={2.5} />
                <span>Case #{caseId}</span>
              </>
            ) : viewingDetail ? (
              <>
                <span>Case #{caseId}</span>
                <ChevronRight size={18} strokeWidth={2.5} />
                <button type="button" onClick={() => setViewingDetail(null)}>
                  Reference Matches
                </button>
                <ChevronRight size={18} strokeWidth={2.5} />
                <span>View Details</span>
              </>
            ) : (
              <>
                <span>Case #{caseId}</span>
                <ChevronRight size={18} strokeWidth={2.5} />
                <span>{activeTab}</span>
              </>
            )}
          </nav>

          <div className="rpt-title-wrap">
            <h1 className="rpt-title" id="rpt-page-title">
              {viewingDetail
                ? "Reference Match Details"
                : activeTab === "Overview"
                  ? "Case Results"
                  : `Case #${caseId}`}
            </h1>
            <span
              className={`rpt-forged-tag${!verdictIsForged ? " rpt-genuine-tag" : ""}`}
            >
              <ShieldAlert size={15} strokeWidth={2} />
              {verdict}
            </span>
          </div>
        </div>

        <div className="rpt-actions">
          {viewingDetail ? (
            <button
              className="rpt-back-btn"
              type="button"
              onClick={() => setViewingDetail(null)}
            >
              <ArrowLeft size={16} strokeWidth={2.2} />
              <span>Back to Reference Matches</span>
            </button>
          ) : (
            <>
              <button
                className="rpt-download-btn"
                type="button"
                disabled={downloading}
                onClick={async () => {
                  setDownloading(true);
                  try {
                    await generateReport(caseData);
                  } catch (err) {
                    console.error("Failed to generate PDF report:", err);
                    alert(
                      `Unable to download report: ${err?.message || "Please check your connection and try again."}`,
                    );
                  } finally {
                    setDownloading(false);
                  }
                }}
              >
                <Download size={18} strokeWidth={2.2} />
                <span>{downloading ? "Generating…" : "Download Report"}</span>
              </button>
              <button
                className="rpt-newcase-btn"
                type="button"
                onClick={() => navigate("/cases/add/step-1")}
              >
                New Case
              </button>
            </>
          )}
        </div>
      </div>

      {!viewingDetail && (
        <div className="rpt-tabs" role="tablist">
          {["Overview", "Forensic Details", "Reference Matches", "Report"].map(
            (tab) => (
              <button
                key={tab}
                role="tab"
                aria-selected={activeTab === tab}
                className={`rpt-tab ${activeTab === tab ? "active" : ""}`}
                onClick={() => {
                  setActiveTab(tab);
                  setViewingDetail(null);
                }}
              >
                {tab}
              </button>
            ),
          )}
        </div>
      )}

      {activeTab === "Overview" && (
        <div className="rpt-grid">
          <div className="rpt-left-col">
            <div className="rpt-card">
              <div className="rpt-card-header">
                <h2 className="rpt-card-title">
                  Document with Forensic Overlay
                </h2>
                <div className="rpt-zoom-controls">
                  <button className="rpt-zoom-btn" type="button">
                    <Search size={15} strokeWidth={2.2} />
                    <span>Zoom</span>
                    <ChevronDown size={14} strokeWidth={2.5} />
                  </button>
                  <button
                    className="rpt-icon-btn"
                    type="button"
                    aria-label="Expand document"
                  >
                    <Maximize2 size={16} strokeWidth={2.2} />
                  </button>
                </div>
              </div>
              <div className="rpt-doc-stage">
                <SignatureCanvas
                  imageURL={qDisplayURL}
                  overlay={!!overlayData}
                  overlayData={overlayData}
                  className="rpt-canvas"
                  fallback={
                    <div className="rpt-no-doc-placeholder">
                      <p>No document uploaded</p>
                    </div>
                  }
                />
              </div>
              <div className="rpt-legend-bar">
                <div className="rpt-legend-item">
                  <span>Forensic Overlay (Impact)</span>
                  <Info size={15} className="rpt-info-icon" />
                </div>
                <div className="rpt-gradient-wrap">
                  <span className="rpt-grad-label">Low</span>
                  <div className="rpt-grad-bar" />
                  <span className="rpt-grad-label">High</span>
                </div>
                <div className="rpt-legend-markers">
                  <div className="rpt-marker-tag">
                    <span className="rpt-circle-dashed" />
                    <span>Pen Lifts</span>
                  </div>
                  <div className="rpt-marker-tag">
                    <span className="rpt-line-dashed" />
                    <span>Baseline</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="rpt-right-col">
            <div className="rpt-card rpt-verdict-card">
              <h3 className="rpt-sidebar-title">Verdict</h3>
              <div className="rpt-verdict-content">
                <div className="rpt-verdict-shield">
                  <ShieldAlert size={36} strokeWidth={1.8} />
                </div>
                <div className="rpt-verdict-text">
                  <strong className="rpt-verdict-status">{verdict}</strong>
                  <span className="rpt-verdict-sub">{confidenceLabel}</span>
                </div>
              </div>
            </div>

            <div className="rpt-card rpt-confidence-card">
              <div className="rpt-card-header-sm">
                <h3 className="rpt-sidebar-title">Confidence Score</h3>
                <Info size={15} className="rpt-info-icon" />
              </div>
              <div className="rpt-gauge-wrap">
                <svg className="rpt-gauge-svg" viewBox="0 0 160 90">
                  <path
                    d="M 15 80 A 65 65 0 0 1 145 80"
                    fill="none"
                    stroke="#f0e8e6"
                    strokeWidth="16"
                    strokeLinecap="round"
                  />
                  <path
                    d="M 15 80 A 65 65 0 0 1 145 80"
                    fill="none"
                    stroke="#6B2E20"
                    strokeWidth="16"
                    strokeLinecap="round"
                    strokeDasharray="204"
                    strokeDashoffset={gaugeOffset}
                  />
                </svg>
                <div className="rpt-gauge-center">
                  <strong className="rpt-gauge-score">{confidence}%</strong>
                  <span className="rpt-gauge-label">Confidence</span>
                </div>
                <div className="rpt-gauge-labels">
                  <span>0%</span>
                  <span>100%</span>
                </div>
              </div>
            </div>

            <div className="rpt-card rpt-summary-card">
              <h3 className="rpt-sidebar-title">Analysis Summary</h3>
              <div className="rpt-info-list">
                <div className="rpt-info-row">
                  <div className="rpt-info-label">
                    <Target size={16} className="rpt-row-icon" />
                    <span>Detection Mode</span>
                  </div>
                  <span className="rpt-mode-badge">{detectionMode}</span>
                </div>
                {selfConsistencyScore != null && (
                  <div className="rpt-info-row">
                    <div className="rpt-info-label">
                      <Brain size={16} className="rpt-row-icon" />
                      <span>Self-Consistency</span>
                    </div>
                    <span className="rpt-info-val">
                      {selfConsistencyScore}%
                      <span className="rpt-sc-hint">
                        {selfConsistencyScore >= 70
                          ? " (consistent)"
                          : selfConsistencyScore >= 60
                            ? " (borderline)"
                            : " (inconsistent)"}
                      </span>
                    </span>
                  </div>
                )}
                <div className="rpt-info-row">
                  <div className="rpt-info-label">
                    <Maximize2 size={16} className="rpt-row-icon" />
                    <span>Signature Region</span>
                  </div>
                  <span className="rpt-info-val">Auto-detected</span>
                </div>
                <div className="rpt-info-row">
                  <div className="rpt-info-label">
                    <Layers size={16} className="rpt-row-icon" />
                    <span>Reference Samples</span>
                  </div>
                  <span className="rpt-info-val">
                    {refCount} sample{refCount !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="rpt-info-row">
                  <div className="rpt-info-label">
                    <Clock size={16} className="rpt-row-icon" />
                    <span>Analysis Time</span>
                  </div>
                  <span className="rpt-info-val">{analysisTime}</span>
                </div>
                <div className="rpt-info-row">
                  <div className="rpt-info-label">
                    <Cpu size={16} className="rpt-row-icon" />
                    <span>Model</span>
                  </div>
                  <span className="rpt-info-val">{modelName}</span>
                </div>
              </div>
            </div>

            <div className="rpt-card rpt-caseinfo-card">
              <h3 className="rpt-sidebar-title">Case Information</h3>
              <div className="rpt-info-list plain">
                <div className="rpt-info-row">
                  <span className="rpt-plain-label">Case ID</span>
                  <span className="rpt-plain-val">{caseId}</span>
                </div>
                <div className="rpt-info-row">
                  <span className="rpt-plain-label">Signer</span>
                  <span className="rpt-plain-val">{signerName}</span>
                </div>
                <div className="rpt-info-row">
                  <span className="rpt-plain-label">Document</span>
                  <span className="rpt-plain-val">
                    {caseData?.questionedFile?.name || "—"}
                  </span>
                </div>
                <div className="rpt-info-row">
                  <span className="rpt-plain-label">Date Received</span>
                  <span className="rpt-plain-val">
                    {caseData?.dateReceived || "—"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "Forensic Details" && (
        <div className="rpt-forensic-layout">
          <div className="rpt-forensic-grid-3">
            <div className="rpt-forensic-left">
              <div className="rpt-card">
                <div className="rpt-card-header">
                  <h2 className="rpt-card-title">
                    Document with Forensic Overlay
                  </h2>
                  <div className="rpt-zoom-controls">
                    <button className="rpt-zoom-btn" type="button">
                      <Search size={15} strokeWidth={2.2} />
                      <span>Zoom</span>
                      <ChevronDown size={14} strokeWidth={2.5} />
                    </button>
                    <button
                      className="rpt-icon-btn"
                      type="button"
                      aria-label="Expand document"
                    >
                      <Maximize2 size={16} strokeWidth={2.2} />
                    </button>
                  </div>
                </div>
                <div className="rpt-doc-stage">
                  <SignatureCanvas
                    imageURL={qDisplayURL}
                    overlay={!!overlayData}
                    overlayData={overlayData}
                    className="rpt-canvas"
                    fallback={
                      <div className="rpt-no-doc-placeholder">
                        <p>No document uploaded</p>
                      </div>
                    }
                  />
                </div>
                <div className="rpt-legend-bar">
                  <div className="rpt-legend-item">
                    <span>Forensic Overlay (Impact)</span>
                    <Info size={15} className="rpt-info-icon" />
                  </div>
                  <div className="rpt-gradient-wrap">
                    <span className="rpt-grad-label">Low</span>
                    <div className="rpt-grad-bar" />
                    <span className="rpt-grad-label">High</span>
                  </div>
                  <div className="rpt-legend-markers">
                    <div className="rpt-marker-tag">
                      <span className="rpt-circle-dashed" />
                      <span>Pen Lifts</span>
                    </div>
                    <div className="rpt-marker-tag">
                      <span className="rpt-line-dashed" />
                      <span>Baseline</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rpt-card rpt-forensic-diff-card">
                <div className="rpt-card-header-sm">
                  <h2 className="rpt-card-title">Key Differences Detected</h2>
                  <Info size={15} className="rpt-info-icon" />
                </div>
                <div className="rpt-forensic-diff-grid">
                  {keyDifferences.map((kd) => {
                    const l = kd.label.toLowerCase();
                    const illus =
                      l.includes("stroke width") ||
                      l.includes("stroke shape") ? (
                        <svg
                          viewBox="0 0 120 50"
                          width="100%"
                          height="46"
                          fill="none"
                        >
                          <path
                            d="M 10 18 Q 35 8, 60 18 T 110 18"
                            stroke="#111111"
                            strokeWidth="2.2"
                            strokeLinecap="round"
                          />
                          <path
                            d="M 10 32 Q 35 22, 60 32 T 110 32"
                            stroke="#111111"
                            strokeWidth="1.8"
                            strokeDasharray="4 3"
                            strokeLinecap="round"
                          />
                        </svg>
                      ) : l.includes("proportion") || l.includes("letter") ? (
                        <div className="rpt-prop-illus-box">
                          <svg
                            viewBox="0 0 120 40"
                            width="100%"
                            height="40"
                            fill="none"
                          >
                            <text
                              x="5"
                              y="28"
                              fontSize="18"
                              fontFamily="'Dancing Script', cursive"
                              fill="#111111"
                            >
                              Signature
                            </text>
                            <rect
                              x="5"
                              y="8"
                              width="50"
                              height="22"
                              rx="3"
                              stroke="#4a2318"
                              strokeWidth="1.2"
                              strokeDasharray="3 2"
                              fill="none"
                            />
                            <text
                              x="68"
                              y="24"
                              fontSize="12"
                              fontFamily="'Dancing Script', cursive"
                              fill="#111111"
                            >
                              Signature
                            </text>
                            <rect
                              x="68"
                              y="10"
                              width="46"
                              height="16"
                              rx="3"
                              stroke="#4a2318"
                              strokeWidth="1.2"
                              strokeDasharray="3 2"
                              fill="none"
                            />
                          </svg>
                        </div>
                      ) : l.includes("baseline") ? (
                        <div className="rpt-base-illus-box">
                          {qCropURL || qURL ? (
                            <img
                              src={qCropURL || qURL}
                              alt="questioned signature"
                              className="rpt-illus-sig-img"
                            />
                          ) : (
                            <span className="rpt-sig-script-illus">~ ~ ~</span>
                          )}
                          <svg
                            className="rpt-base-svg-overlay"
                            viewBox="0 0 140 40"
                          >
                            <path
                              d="M 5 28 L 135 28"
                              stroke="#4a2318"
                              strokeWidth="1.5"
                              strokeDasharray="3 3"
                            />
                            <circle
                              cx="30"
                              cy="14"
                              r="3.5"
                              stroke="#4a2318"
                              strokeWidth="1.2"
                              fill="none"
                            />
                            <circle
                              cx="50"
                              cy="14"
                              r="3.5"
                              stroke="#4a2318"
                              strokeWidth="1.2"
                              fill="none"
                            />
                          </svg>
                        </div>
                      ) : l.includes("pen lift") || l.includes("pen-lift") ? (
                        <div className="rpt-pen-illus-box">
                          {qCropURL || qURL ? (
                            <img
                              src={qCropURL || qURL}
                              alt="questioned signature"
                              className="rpt-illus-sig-img"
                            />
                          ) : (
                            <span className="rpt-sig-script-illus">~ ~ ~</span>
                          )}
                          <svg
                            className="rpt-pen-svg-overlay"
                            viewBox="0 0 140 40"
                          >
                            <path
                              d="M 5 28 L 135 28"
                              stroke="#4a2318"
                              strokeWidth="1.5"
                              strokeDasharray="3 3"
                            />
                            <circle
                              cx="34"
                              cy="14"
                              r="3.5"
                              stroke="#4a2318"
                              strokeWidth="1.2"
                              fill="none"
                              strokeDasharray="2 1.5"
                            />
                            <circle
                              cx="94"
                              cy="14"
                              r="3.5"
                              stroke="#4a2318"
                              strokeWidth="1.2"
                              fill="none"
                              strokeDasharray="2 1.5"
                            />
                          </svg>
                        </div>
                      ) : l.includes("slant") || l.includes("direction") ? (
                        <svg
                          viewBox="0 0 120 50"
                          width="100%"
                          height="46"
                          fill="none"
                        >
                          <line
                            x1="15"
                            y1="38"
                            x2="38"
                            y2="12"
                            stroke="#111111"
                            strokeWidth="2"
                            strokeLinecap="round"
                          />
                          <line
                            x1="34"
                            y1="38"
                            x2="57"
                            y2="12"
                            stroke="#111111"
                            strokeWidth="2"
                            strokeDasharray="4 3"
                            strokeLinecap="round"
                          />
                          <path
                            d="M 72 38 C 76 22, 82 12, 86 12"
                            stroke="#111111"
                            strokeWidth="2"
                            strokeLinecap="round"
                          />
                          <circle cx="86" cy="12" r="1.5" fill="#111111" />
                          <path
                            d="M 96 38 C 100 22, 106 12, 110 12"
                            stroke="#111111"
                            strokeWidth="2"
                            strokeDasharray="3 2"
                            strokeLinecap="round"
                          />
                          <circle cx="110" cy="12" r="1.5" fill="#111111" />
                        </svg>
                      ) : (
                        <svg
                          viewBox="0 0 120 50"
                          width="100%"
                          height="46"
                          fill="none"
                        >
                          <path
                            d="M 10 25 Q 35 10, 60 25 T 110 25"
                            stroke="#111111"
                            strokeWidth="2"
                            strokeLinecap="round"
                          />
                          <path
                            d="M 10 35 Q 35 20, 60 35 T 110 35"
                            stroke="#111111"
                            strokeWidth="1.5"
                            strokeDasharray="4 3"
                            strokeLinecap="round"
                          />
                        </svg>
                      );
                    const impactClass =
                      kd.impact === "High"
                        ? "impact-high"
                        : kd.impact === "Medium"
                          ? "impact-med"
                          : "impact-low";
                    const dotClass =
                      kd.impact === "High"
                        ? "dot-high"
                        : kd.impact === "Medium"
                          ? "dot-med"
                          : "dot-low";
                    const desc = l.includes("stroke width")
                      ? "Inconsistent pressure throughout signature."
                      : l.includes("proportion") || l.includes("letter")
                        ? "Disproportionate letter height detected."
                        : l.includes("baseline")
                          ? "Baseline is uneven with notable dips."
                          : l.includes("pen lift")
                            ? "Unexpected pen lifts within continuous strokes."
                            : l.includes("slant")
                              ? "Overall slant deviates from natural pattern."
                              : "Inconsistency detected in this feature region.";
                    return (
                      <div key={kd.id} className="rpt-fdiff-card">
                        <div className="rpt-fdiff-head">
                          <span className="rpt-fdiff-num">{kd.id}</span>
                          <h3 className="rpt-fdiff-title">{kd.label}</h3>
                        </div>
                        <div className="rpt-fdiff-illus">{illus}</div>
                        <p className="rpt-fdiff-desc">{desc}</p>
                        <span className={`rpt-diff-badge ${impactClass}`}>
                          <span className={`rpt-dot ${dotClass}`} /> Impact:{" "}
                          {kd.impact}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <p className="rpt-diff-note">
                  <Info size={14} className="rpt-info-icon" /> Impact indicates
                  how strongly each feature influenced the final verdict.
                </p>
              </div>
            </div>

            <div className="rpt-forensic-mid">
              <div className="rpt-card">
                <div className="rpt-card-header-sm">
                  <h3 className="rpt-sidebar-title">
                    Detected Signature Region
                  </h3>
                  <Info size={15} className="rpt-info-icon" />
                </div>
                <div className="rpt-region-box">
                  <div className="rpt-region-crop">
                    {qCropURL ? (
                      <img
                        src={qCropURL}
                        alt="Detected signature crop"
                        style={{
                          width: "100%",
                          height: "auto",
                          borderRadius: 4,
                        }}
                      />
                    ) : (
                      <span className="rpt-sig-script-sm">{signerName}</span>
                    )}
                    <div className="rpt-crop-border" />
                  </div>
                </div>
                <div className="rpt-info-list compact">
                  <div className="rpt-info-row">
                    <span className="rpt-plain-label">Position (X, Y)</span>
                    <span className="rpt-plain-val">
                      {sigRegion ? `${sigRegion.x}, ${sigRegion.y}` : "—"}
                    </span>
                  </div>
                  <div className="rpt-info-row">
                    <span className="rpt-plain-label">
                      Width &times; Height
                    </span>
                    <span className="rpt-plain-val">
                      {sigRegion ? `${sigRegion.w} × ${sigRegion.h}` : "—"}
                    </span>
                  </div>
                  <div className="rpt-info-row">
                    <span className="rpt-plain-label">Area</span>
                    <span className="rpt-plain-val">
                      {sigRegion
                        ? `${(sigRegion.w * sigRegion.h).toLocaleString()} px²`
                        : "—"}
                    </span>
                  </div>
                  <div className="rpt-info-row">
                    <span className="rpt-plain-label">Rotation</span>
                    <span className="rpt-plain-val">Auto-detected</span>
                  </div>
                  <div className="rpt-info-row">
                    <span className="rpt-plain-label">Confidence</span>
                    <div className="rpt-conf-val-wrap">
                      <span className="rpt-plain-val">{confidence}%</span>
                      <span className="rpt-high-badge">
                        {confidenceLabel.split(" ")[0]}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rpt-card">
                <h3 className="rpt-sidebar-title">Detection Timeline</h3>
                <div className="rpt-timeline">
                  <div className="rpt-tl-item">
                    <CheckCircle2 size={16} className="rpt-tl-icon" />
                    <span className="rpt-tl-label">Document uploaded</span>
                    <span className="rpt-tl-time">Step 1</span>
                  </div>
                  <div className="rpt-tl-item">
                    <CheckCircle2 size={16} className="rpt-tl-icon" />
                    <span className="rpt-tl-label">
                      Preprocessing &amp; region detection
                    </span>
                    <span className="rpt-tl-time">Step 2–3</span>
                  </div>
                  <div className="rpt-tl-item">
                    <CheckCircle2 size={16} className="rpt-tl-icon" />
                    <span className="rpt-tl-label">
                      {modelName} embedding extracted
                    </span>
                    <span className="rpt-tl-time">Step 4</span>
                  </div>
                  <div className="rpt-tl-item">
                    <CheckCircle2 size={16} className="rpt-tl-icon" />
                    <span className="rpt-tl-label">
                      Cosine similarity &amp; verdict
                    </span>
                    <span className="rpt-tl-time">Step 5–7</span>
                  </div>
                  <div className="rpt-tl-item">
                    <CheckCircle2 size={16} className="rpt-tl-icon" />
                    <span className="rpt-tl-label">
                      Grad-CAM overlay + report generated
                    </span>
                    <span className="rpt-tl-time">{analysisTime}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="rpt-forensic-right">
              <div className="rpt-card rpt-verdict-card">
                <h3 className="rpt-sidebar-title">Verdict</h3>
                <div className="rpt-verdict-content">
                  <div className="rpt-verdict-shield">
                    <ShieldAlert size={36} strokeWidth={1.8} />
                  </div>
                  <div className="rpt-verdict-text">
                    <strong className="rpt-verdict-status">{verdict}</strong>
                    <span className="rpt-verdict-sub">{confidenceLabel}</span>
                  </div>
                </div>
              </div>

              <div className="rpt-card rpt-confidence-card">
                <div className="rpt-card-header-sm">
                  <h3 className="rpt-sidebar-title">Confidence Score</h3>
                  <Info size={15} className="rpt-info-icon" />
                </div>
                <div className="rpt-gauge-wrap">
                  <svg className="rpt-gauge-svg" viewBox="0 0 160 90">
                    <path
                      d="M 15 80 A 65 65 0 0 1 145 80"
                      fill="none"
                      stroke="#f0e8e6"
                      strokeWidth="16"
                      strokeLinecap="round"
                    />
                    <path
                      d="M 15 80 A 65 65 0 0 1 145 80"
                      fill="none"
                      stroke="#6B2E20"
                      strokeWidth="16"
                      strokeLinecap="round"
                      strokeDasharray="204"
                      strokeDashoffset={gaugeOffset}
                    />
                  </svg>
                  <div className="rpt-gauge-center">
                    <strong className="rpt-gauge-score">{confidence}%</strong>
                    <span className="rpt-gauge-label">Confidence</span>
                  </div>
                  <div className="rpt-gauge-labels">
                    <span>0%</span>
                    <span>100%</span>
                  </div>
                </div>
              </div>

              <div className="rpt-card rpt-summary-card">
                <h3 className="rpt-sidebar-title">Analysis Summary</h3>
                <div className="rpt-info-list">
                  <div className="rpt-info-row">
                    <div className="rpt-info-label">
                      <Target size={16} className="rpt-row-icon" />
                      <span>Detection Mode</span>
                    </div>
                    <span className="rpt-mode-badge">{detectionMode}</span>
                  </div>
                  {selfConsistencyScore != null && (
                    <div className="rpt-info-row">
                      <div className="rpt-info-label">
                        <Brain size={16} className="rpt-row-icon" />
                        <span>Self-Consistency</span>
                      </div>
                      <span className="rpt-info-val">
                        {selfConsistencyScore}%
                        <span className="rpt-sc-hint">
                          {selfConsistencyScore >= 70
                            ? " (consistent)"
                            : selfConsistencyScore >= 60
                              ? " (borderline)"
                              : " (inconsistent)"}
                        </span>
                      </span>
                    </div>
                  )}
                  <div className="rpt-info-row">
                    <div className="rpt-info-label">
                      <Maximize2 size={16} className="rpt-row-icon" />
                      <span>Signature Region</span>
                    </div>
                    <span className="rpt-info-val">Auto-detected</span>
                  </div>
                  <div className="rpt-info-row">
                    <div className="rpt-info-label">
                      <Layers size={16} className="rpt-row-icon" />
                      <span>Reference Samples</span>
                    </div>
                    <span className="rpt-info-val">
                      {refCount} sample{refCount !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="rpt-info-row">
                    <div className="rpt-info-label">
                      <Clock size={16} className="rpt-row-icon" />
                      <span>Analysis Time</span>
                    </div>
                    <span className="rpt-info-val">{analysisTime}</span>
                  </div>
                  <div className="rpt-info-row">
                    <div className="rpt-info-label">
                      <Cpu size={16} className="rpt-row-icon" />
                      <span>Model</span>
                    </div>
                    <span className="rpt-info-val">{modelName}</span>
                  </div>
                </div>
              </div>

              <div className="rpt-card rpt-contrib-card">
                <div className="rpt-card-header-sm">
                  <h3 className="rpt-sidebar-title">
                    Feature Impact (Top Contributors)
                  </h3>
                  <Info size={15} className="rpt-info-icon" />
                </div>
                <div className="rpt-contrib-list">
                  {(() => {
                    const impactWeight = { High: 3, Medium: 2, Low: 1 };
                    const totalWeight =
                      keyDifferences.reduce(
                        (s, d) => s + (impactWeight[d.impact] || 1),
                        0,
                      ) || 1;
                    const barMax =
                      keyDifferences.length > 0
                        ? Math.max(
                            ...keyDifferences.map(
                              (d) => impactWeight[d.impact] || 1,
                            ),
                          )
                        : 1;
                    return keyDifferences.map((d) => {
                      const w = impactWeight[d.impact] || 1;
                      const pct = Math.round((w / totalWeight) * 100);
                      const barW = Math.round((w / (barMax * 1.1)) * 100);
                      return (
                        <div key={d.id} className="rpt-contrib-row">
                          <span className="rpt-contrib-label">{d.label}</span>
                          <div className="rpt-contrib-bar-wrap">
                            <div
                              className="rpt-contrib-bar"
                              style={{ width: `${barW}%` }}
                            />
                          </div>
                          <span className="rpt-contrib-pct">{pct}%</span>
                        </div>
                      );
                    });
                  })()}
                  <div className="rpt-contrib-total-row">
                    <strong>Total</strong>
                    <strong>100%</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "Reference Matches" && !viewingDetail && (
        <div className="rpt-ref-layout">
          <div className="rpt-ref-top-grid">
            <div className="rpt-card rpt-ref-card-query">
              <h3 className="rpt-sidebar-title">
                Query Signature (From Uploaded Document)
              </h3>
              <div className="rpt-ref-query-box">
                {qCropURL ? (
                  <img
                    src={qCropURL}
                    alt="Query signature crop"
                    style={{ width: "100%", height: "auto", borderRadius: 6 }}
                  />
                ) : (
                  <span className="rpt-sig-script-query">{signerName}</span>
                )}
              </div>
            </div>

            <div className="rpt-card rpt-ref-card-summary">
              <div className="rpt-card-header-sm">
                <h3 className="rpt-sidebar-title">Match Summary</h3>
                <Info size={15} className="rpt-info-icon" />
              </div>
              <div className="rpt-ref-summary-content">
                <div className="rpt-gauge-wrap-sm">
                  <svg className="rpt-gauge-svg-sm" viewBox="0 0 160 90">
                    <path
                      d="M 15 80 A 65 65 0 0 1 145 80"
                      fill="none"
                      stroke="#f2ece9"
                      strokeWidth="16"
                      strokeLinecap="round"
                    />
                    <path
                      d="M 15 80 A 65 65 0 0 1 145 80"
                      fill="none"
                      stroke="#4a2318"
                      strokeWidth="16"
                      strokeLinecap="round"
                      strokeDasharray="204"
                      strokeDashoffset={gaugeOffset}
                    />
                  </svg>
                  <div className="rpt-gauge-center-sm">
                    <strong className="rpt-gauge-score-sm">
                      {confidence}%
                    </strong>
                    <span className="rpt-gauge-sub-sm">Best Match</span>
                  </div>
                  <span className="rpt-gauge-subtext">
                    Highest similarity found
                  </span>
                </div>
                <div className="rpt-ref-summary-divider" />
                <div className="rpt-ref-stats-list">
                  <div className="rpt-ref-stat-row">
                    <span>Total Reference Samples</span>
                    <strong>{refMatches.length}</strong>
                  </div>
                  <div className="rpt-ref-stat-row">
                    <span>Genuine Matches (&ge; 75%)</span>
                    <strong>
                      {refMatches.filter((m) => m.score >= 75).length}
                    </strong>
                  </div>
                  <div className="rpt-ref-stat-row">
                    <span>Weak/Uncertain (50%&ndash;75%)</span>
                    <strong>
                      {
                        refMatches.filter((m) => m.score >= 50 && m.score < 75)
                          .length
                      }
                    </strong>
                  </div>
                  <div className="rpt-ref-stat-row">
                    <span>Poor Matches (&lt; 50%)</span>
                    <strong>
                      {refMatches.filter((m) => m.score < 50).length}
                    </strong>
                  </div>
                </div>
              </div>
            </div>

            <div className="rpt-card rpt-ref-card-assessment">
              <h3 className="rpt-sidebar-title">Overall Assessment</h3>
              <div className="rpt-ref-verdict-box">
                <div className="rpt-ref-shield-icon">
                  <svg
                    width="44"
                    height="44"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#4a2318"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    <line x1="9.5" y1="9.5" x2="14.5" y2="14.5" />
                    <line x1="14.5" y1="9.5" x2="9.5" y2="14.5" />
                  </svg>
                </div>
                <div className="rpt-verdict-text">
                  <strong className="rpt-verdict-status">{verdict}</strong>
                  <span className="rpt-verdict-sub">
                    {verdictIsForged
                      ? "No sufficiently similar genuine matches found."
                      : "Signature matches known reference samples."}
                  </span>
                </div>
              </div>
              <div className="rpt-ref-thresh-row">
                <div className="rpt-thresh-label">
                  <span>Matching Threshold (Genuine)</span>
                  <Info size={14} className="rpt-info-icon" />
                </div>
                <strong className="rpt-thresh-val">&ge; 75%</strong>
              </div>
            </div>
          </div>

          <div className="rpt-card rpt-ref-table-card">
            <h2 className="rpt-card-title">Reference Comparison Results</h2>
            <div className="rpt-ref-table-wrap">
              <table className="rpt-ref-table">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Reference Sample</th>
                    <th>Source</th>
                    <th>
                      Similarity Score{" "}
                      <Info size={14} className="inline-info" />
                    </th>
                    <th>Match Level</th>
                    <th>Key Differences (Top 2)</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {refMatches.map((row) => (
                    <tr key={row.rank}>
                      <td>
                        {row.rank <= 3 ? (
                          <div className="rpt-medal-wrap">
                            <svg
                              width="24"
                              height="28"
                              viewBox="0 0 24 28"
                              fill="none"
                            >
                              <path
                                d="M5 2 L12 10 L5 18"
                                stroke={
                                  row.rank === 1
                                    ? "#4a2318"
                                    : row.rank === 2
                                      ? "#8a7b75"
                                      : "#9e6b55"
                                }
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                              <path
                                d="M19 2 L12 10 L19 18"
                                stroke={
                                  row.rank === 1
                                    ? "#4a2318"
                                    : row.rank === 2
                                      ? "#8a7b75"
                                      : "#9e6b55"
                                }
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                              <circle
                                cx="12"
                                cy="18"
                                r="8"
                                fill={
                                  row.rank === 1
                                    ? "#4a2318"
                                    : row.rank === 2
                                      ? "#8a7b75"
                                      : "#9e6b55"
                                }
                              />
                              <text
                                x="12"
                                y="21.5"
                                textAnchor="middle"
                                fill="#ffffff"
                                fontSize="11"
                                fontWeight="700"
                                fontFamily="sans-serif"
                              >
                                {row.rank}
                              </text>
                            </svg>
                          </div>
                        ) : (
                          <span className="rpt-rank-num">{row.rank}</span>
                        )}
                      </td>
                      <td>
                        <div className="rpt-ref-sample-box">
                          {row.cropUrl ? (
                            <img
                              src={row.cropUrl}
                              alt={`Reference sample ${row.rank}`}
                              style={{
                                width: "100%",
                                height: "auto",
                                borderRadius: 4,
                                maxHeight: 48,
                                objectFit: "contain",
                              }}
                            />
                          ) : (
                            <svg
                              viewBox="0 0 120 40"
                              width="100%"
                              height="40"
                              fill="none"
                            >
                              <path
                                d="M 8 28 C 14 10, 24 10, 30 22 C 36 34, 44 34, 50 22 C 56 10, 66 10, 72 22 C 78 34, 88 30, 96 20 C 104 10, 112 14, 116 20"
                                stroke="#4a2318"
                                strokeWidth="2"
                                strokeLinecap="round"
                                fill="none"
                              />
                            </svg>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="rpt-source-cell">
                          <strong>{row.source}</strong>
                          <span>Uploaded on {row.uploadedDate}</span>
                        </div>
                      </td>
                      <td>
                        <div className="rpt-sim-score-cell">
                          <strong>{row.score}%</strong>
                          <div className="rpt-sim-bar-wrap">
                            <div
                              className="rpt-sim-bar"
                              style={{
                                width: `${row.score}%`,
                                backgroundColor:
                                  row.score >= 50 && row.score < 75
                                    ? "#9e6b55"
                                    : "#4a2318",
                              }}
                            />
                          </div>
                        </div>
                      </td>
                      <td>
                        <span
                          className={`rpt-match-badge ${matchBadgeClass(row.matchLevel)}`}
                        >
                          {row.matchLevel}
                        </span>
                      </td>
                      <td>
                        <ul className="rpt-diff-list">
                          {(row.keyDifferences || []).map((diff) => (
                            <li key={diff}>&bull; {diff}</li>
                          ))}
                        </ul>
                      </td>
                      <td>
                        <button
                          className="rpt-view-btn"
                          type="button"
                          onClick={() => setViewingDetail(row)}
                        >
                          <Eye size={15} />
                          <span>View Details</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="rpt-ref-footer">
              <p className="rpt-ref-footer-note">
                <Info size={14} className="rpt-info-icon" /> Similarity score is
                calculated using cosine similarity on CNN embedding vectors.
              </p>
              <div className="rpt-ref-legend">
                <div className="rpt-ref-leg-item">
                  <span className="rpt-dot dot-high" /> Genuine (&ge;75%)
                </div>
                <div className="rpt-ref-leg-item">
                  <span className="rpt-dot dot-med" /> Weak (50%&ndash;75%)
                </div>
                <div className="rpt-ref-leg-item">
                  <span className="rpt-dot dot-low" /> Poor (&lt;50%)
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {viewingDetail && (
        <div className="vd-layout">
          <div className="vd-summary-bar">
            <div className="vd-summary-item vd-summary-medal">
              <svg width="28" height="34" viewBox="0 0 26 34" fill="none">
                <path
                  d="M5 2 L13 15 L7 32"
                  stroke="#4a2318"
                  strokeWidth="2.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M21 2 L13 15 L19 32"
                  stroke="#4a2318"
                  strokeWidth="2.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx="13" cy="22" r="8" fill="#4a2318" />
                <text
                  x="13"
                  y="25.5"
                  textAnchor="middle"
                  fill="#ffffff"
                  fontSize="11"
                  fontWeight="700"
                  fontFamily="sans-serif"
                >
                  {viewingDetail.rank || 1}
                </text>
              </svg>
              <div>
                <span className="vd-sum-label">Reference Sample</span>
                <strong className="vd-sum-val vd-sum-val--medal">
                  #{viewingDetail.rank || 1}
                  {viewingDetail.rank === 1 ? " (Best Match)" : ""}
                </strong>
              </div>
            </div>
            <div className="vd-sum-divider" />
            <div className="vd-summary-item">
              <span className="vd-sum-label">Similarity Score</span>
              <strong className="vd-score-big">{viewingDetail.score}%</strong>
              <span className="vd-sum-sub">
                Rank #{viewingDetail.rank || 1}
              </span>
            </div>
            <div className="vd-sum-divider" />
            <div className="vd-summary-item">
              <span className="vd-sum-label">Match Level</span>
              <span
                className={`rpt-match-badge ${matchBadgeClass(viewingDetail.matchLevel)}`}
              >
                {viewingDetail.matchLevel}
              </span>
            </div>
            <div className="vd-sum-divider" />
            <div className="vd-summary-item">
              <span className="vd-sum-label">Source</span>
              <strong className="vd-sum-val">{viewingDetail.source}</strong>
              <span className="vd-sum-sub">
                Uploaded on {viewingDetail.uploadedDate}
              </span>
            </div>
            <div className="vd-sum-divider" />
            <div className="vd-summary-item">
              <span className="vd-sum-label">Comparison Type</span>
              <strong className="vd-sum-val">{detectionMode}</strong>
              <span className="vd-sum-sub">(Against Reference)</span>
            </div>
            <div className="vd-sum-divider" />
            <div className="vd-summary-item">
              <span className="vd-sum-label">Model</span>
              <strong className="vd-sum-val">{modelName}</strong>
            </div>
          </div>

          <div className="vd-top-cards-row">
            <div className="rpt-card vd-sig-card">
              <div className="vd-sig-card-header">
                <span className="vd-sig-card-title">
                  Query Signature (From Uploaded Document)
                </span>
                <button
                  className="rpt-icon-btn"
                  type="button"
                  aria-label="Zoom Query Signature"
                >
                  <Search size={14} strokeWidth={2.2} />
                </button>
              </div>
              <div className="vd-sig-canvas vd-sig-canvas--query">
                <SignatureCanvas
                  imageURL={qCropURL}
                  overlay={false}
                  className="vd-sig-real-canvas"
                  fallback={
                    <svg
                      viewBox="0 0 320 130"
                      width="100%"
                      height="100%"
                      fill="none"
                    >
                      <rect width="320" height="130" fill="#ffffff" rx="6" />
                      <path
                        d="M 32 80 C 32 45, 44 28, 54 40 C 62 50, 54 75, 58 68 C 64 56, 70 40, 78 56 C 82 64, 80 76, 82 72 C 88 60, 94 46, 100 58 C 104 66, 102 78, 106 72 C 112 60, 120 46, 128 60 C 132 68, 130 80, 134 76 C 140 66, 148 56, 156 66 C 162 72, 162 82, 164 78 C 168 66, 174 52, 182 62 C 188 72, 186 84, 190 80 C 196 68, 204 58, 212 66 C 218 72, 216 84, 220 80 C 226 68, 234 62, 242 70 C 248 76, 248 86, 252 84 C 258 78, 262 70, 268 74"
                        stroke="#111111"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  }
                />
              </div>
            </div>

            <div className="rpt-card vd-sig-card">
              <div className="vd-sig-card-header">
                <span className="vd-sig-card-title">
                  Reference Signature ({viewingDetail.source})
                </span>
                <button
                  className="rpt-icon-btn"
                  type="button"
                  aria-label="Zoom Reference Signature"
                >
                  <Search size={14} strokeWidth={2.2} />
                </button>
              </div>
              <div className="vd-sig-canvas vd-sig-canvas--ref">
                <SignatureCanvas
                  imageURL={refCropURLs[(viewingDetail.rank || 1) - 1] || null}
                  overlay={false}
                  className="vd-sig-real-canvas"
                  fallback={
                    <svg
                      viewBox="0 0 320 130"
                      width="100%"
                      height="100%"
                      fill="none"
                    >
                      <rect width="320" height="130" fill="#ffffff" rx="6" />
                      <path
                        d="M 28 78 C 34 46, 46 30, 58 46 C 66 56, 60 75, 64 68 C 70 56, 78 42, 88 56 C 94 66, 92 78, 96 74 C 102 62, 110 48, 120 60 C 126 68, 124 80, 128 76 C 136 62, 146 50, 156 62 C 162 70, 162 84, 164 80 C 170 66, 178 52, 188 62 C 196 70, 194 84, 198 80 C 206 66, 214 58, 224 66 C 230 72, 230 84, 234 82 C 242 70, 250 62, 258 70 C 264 76, 266 84, 270 82"
                        stroke="#111111"
                        strokeWidth="2.7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  }
                />
              </div>
            </div>

            <div className="rpt-card vd-breakdown-card">
              <h3 className="rpt-card-title">Similarity Score Breakdown</h3>
              <div className="vd-breakdown-list">
                {(() => {
                  const overall = viewingDetail.score ?? 50;
                  const feats =
                    viewingDetail.featureScores &&
                    viewingDetail.featureScores.length > 0
                      ? viewingDetail.featureScores.map((f) => ({
                          label: f.label,
                          value: f.score,
                        }))
                      : (() => {
                          const impactPenalty = {
                            High: 18,
                            Medium: 10,
                            Low: 4,
                          };
                          return keyDifferences.slice(0, 5).map((kd, i) => ({
                            label: kd.label,
                            value: Math.max(
                              10,
                              Math.min(
                                99,
                                overall + impactPenalty[kd.impact] - 4 + i * 2,
                              ),
                            ),
                          }));
                        })();
                  return [
                    { label: "Overall Similarity", value: overall },
                    ...feats,
                  ].map(({ label, value }) => (
                    <div key={label} className="vd-breakdown-row">
                      <span className="vd-breakdown-label">{label}</span>
                      <div className="vd-breakdown-bar-wrap">
                        <div
                          className="vd-breakdown-bar"
                          style={{ width: `${value}%` }}
                        />
                      </div>
                      <span className="vd-breakdown-pct">{value}%</span>
                    </div>
                  ));
                })()}
              </div>
            </div>
          </div>

          <div className="vd-bottom-grid">
            <div className="vd-bottom-left">
              <div className="rpt-card vd-feat-card">
                <div className="vd-feat-header">
                  <h3 className="rpt-card-title">Feature Comparison</h3>
                  <Info size={15} className="rpt-info-icon" />
                </div>
                <div className="vd-feat-table-wrap">
                  <table className="vd-feat-table">
                    <thead>
                      <tr>
                        <th>Feature</th>
                        <th>Query (Uploaded)</th>
                        <th>Reference ({viewingDetail.source})</th>
                        <th>Similarity</th>
                        <th>Match</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const feats =
                          viewingDetail.featureScores &&
                          viewingDetail.featureScores.length > 0
                            ? viewingDetail.featureScores
                            : keyDifferences
                                .slice(0, 5)
                                .map((kd) => ({
                                  label: kd.label,
                                  score: viewingDetail.score,
                                }));
                        const refCropUrl =
                          refCropURLs[(viewingDetail.rank ?? 1) - 1] ||
                          viewingDetail.cropUrl ||
                          null;
                        const sigThumb = (cropUrl, isQuery) =>
                          cropUrl ? (
                            <img
                              src={cropUrl}
                              alt={isQuery ? "questioned" : "reference"}
                              style={{
                                width: "100%",
                                maxWidth: 110,
                                height: 32,
                                objectFit: "cover",
                                borderRadius: 3,
                              }}
                            />
                          ) : isQuery ? (
                            <svg
                              viewBox="0 0 110 32"
                              width="110"
                              height="32"
                              fill="none"
                            >
                              <path
                                d="M 5 22 Q 18 6 32 20 T 60 14 T 88 24 T 105 18"
                                stroke="#4a2318"
                                strokeWidth="2.2"
                                strokeLinecap="round"
                              />
                              <circle cx="22" cy="11" r="2.5" fill="#8a2c1b" />
                              <circle cx="60" cy="14" r="2.5" fill="#8a2c1b" />
                            </svg>
                          ) : (
                            <svg
                              viewBox="0 0 110 32"
                              width="110"
                              height="32"
                              fill="none"
                            >
                              <path
                                d="M 5 20 Q 20 10 35 18 T 65 16 T 90 20 T 105 16"
                                stroke="#4a2318"
                                strokeWidth="2.2"
                                strokeLinecap="round"
                              />
                              <circle cx="26" cy="14" r="2" fill="#4a2318" />
                              <circle cx="65" cy="16" r="2" fill="#4a2318" />
                            </svg>
                          );
                        const featureDesc = (label) => {
                          const l = label.toLowerCase();
                          if (l.includes("stroke width"))
                            return "Pressure variation across strokes";
                          if (l.includes("proportion") || l.includes("letter"))
                            return "Letter height ratio inconsistency";
                          if (l.includes("baseline"))
                            return "Deviation from writing baseline";
                          if (l.includes("pen lift"))
                            return "Unexpected pen-lift positions";
                          if (l.includes("slant"))
                            return "Angle deviation from natural slant";
                          return "Structural inconsistency detected";
                        };
                        return feats.map((feat) => {
                          const score =
                            feat.score ?? feat.value ?? viewingDetail.score;
                          const matchBadge =
                            score >= 75
                              ? "genuine"
                              : score >= 50
                                ? "weak"
                                : "poor";
                          const matchLabel =
                            score >= 75
                              ? "Genuine"
                              : score >= 50
                                ? "Weak"
                                : "Poor";
                          return (
                            <tr key={feat.label}>
                              <td>
                                <strong>{feat.label}</strong>
                                <span className="vd-feat-desc">
                                  {featureDesc(feat.label)}
                                </span>
                              </td>
                              <td>
                                <div className="vd-feat-vis">
                                  {sigThumb(qCropURL, true)}
                                </div>
                              </td>
                              <td>
                                <div className="vd-feat-vis">
                                  {sigThumb(refCropUrl, false)}
                                </div>
                              </td>
                              <td>
                                <strong>{score}%</strong>
                              </td>
                              <td>
                                <span
                                  className={`rpt-match-badge ${matchBadge}`}
                                >
                                  {matchLabel}
                                </span>
                              </td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>
                <p
                  className="rpt-ref-footer-note"
                  style={{ marginTop: "14px" }}
                >
                  <Info size={13} className="rpt-info-icon" /> Similarity scores
                  are calculated using cosine similarity on CNN embedding
                  vectors.
                </p>
              </div>

              <div className="rpt-card vd-tech-card">
                <h3 className="rpt-card-title">Technical Details</h3>
                <div className="vd-tech-table-wrap">
                  <table className="vd-tech-table">
                    <thead>
                      <tr>
                        <th>Embedding Model</th>
                        <th>Embedding Dimension</th>
                        <th>Distance Metric</th>
                        <th>Decision Threshold (Genuine)</th>
                        <th>Computed Similarity</th>
                        <th>Match Decision</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>{modelName}</td>
                        <td>512-d</td>
                        <td>Cosine Similarity</td>
                        <td>&ge; 75%</td>
                        <td>{viewingDetail.score}%</td>
                        <td>
                          <span
                            className={`rpt-match-badge ${matchBadgeClass(viewingDetail.matchLevel)}`}
                          >
                            {viewingDetail.matchLevel}
                          </span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="vd-bottom-right">
              <div className="rpt-card vd-keydiff-card">
                <div className="rpt-card-header-sm">
                  <h3 className="rpt-card-title">Key Differences (Top 2)</h3>
                  <Info size={15} className="rpt-info-icon" />
                </div>
                <div className="vd-keydiff-list">
                  {(
                    viewingDetail.keyDifferences ||
                    keyDifferences.slice(0, 2).map((k) => k.label)
                  ).map((label, i) => (
                    <div key={i} className="vd-keydiff-item">
                      <div className="vd-keydiff-icon">
                        <svg
                          width="22"
                          height="22"
                          viewBox="0 0 24 24"
                          fill="none"
                        >
                          <rect
                            x="4"
                            y="4"
                            width="16"
                            height="16"
                            rx="3.5"
                            stroke="#4a2318"
                            strokeWidth="1.8"
                            fill="none"
                          />
                          <polygon
                            points="12,8 14.5,12 12,16 9.5,12"
                            fill="#4a2318"
                          />
                        </svg>
                      </div>
                      <div className="vd-keydiff-content">
                        <div className="vd-keydiff-row">
                          <strong>{label}</strong>
                          <span className="rpt-impact-badge high">
                            {keyDifferences.find((k) => k.label === label)
                              ?.impact || "High"}{" "}
                            Impact
                          </span>
                        </div>
                        <p>
                          Inconsistency detected in this region compared to the
                          reference sample.
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rpt-card vd-interp-card">
                <div className="rpt-card-header-sm">
                  <h3 className="rpt-card-title">Match Interpretation</h3>
                  <Info size={15} className="rpt-info-icon" />
                </div>
                <p className="vd-interp-text">
                  {viewingDetail.score >= 75
                    ? `The questioned signature is consistent with ${viewingDetail.source}. The structural characteristics fall within the expected range of natural variation with a ${viewingDetail.score}% similarity score.`
                    : viewingDetail.score >= 50
                      ? `The questioned signature shows some similarity to ${viewingDetail.source} (${viewingDetail.score}%), but key differences indicate it falls below the genuine match threshold.`
                      : `The questioned signature does not sufficiently match ${viewingDetail.source} (${viewingDetail.score}%). Significant inconsistencies indicate this is not a genuine match.`}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "Report" && !viewingDetail && (
        <div className="rpt-rep-layout">
          <div className="rpt-rep-grid">
            <div className="rpt-rep-left">
              <div className="rpt-card rpt-rep-card-exec">
                <h2 className="rpt-card-title">Executive Summary</h2>
                <div className="rpt-exec-top-row">
                  <div className="rpt-exec-stat-box">
                    <div className="rpt-verdict-shield-lg">
                      <ShieldAlert size={48} strokeWidth={1.8} />
                    </div>
                    <div className="rpt-exec-verdict-text">
                      <strong className="rpt-verdict-status-lg">
                        {verdict}
                      </strong>
                      <span className="rpt-verdict-sub-lg">
                        {confidenceLabel}
                      </span>
                    </div>
                  </div>
                  <div className="rpt-exec-divider" />
                  <div className="rpt-exec-stat-box col">
                    <span className="rpt-exec-label">Confidence Score</span>
                    <strong className="rpt-exec-val">{confidence}%</strong>
                    <span className="rpt-exec-sub">{confidenceLabel}</span>
                  </div>
                  <div className="rpt-exec-divider" />
                  <div className="rpt-exec-stat-box col">
                    <span className="rpt-exec-label">Detection Mode</span>
                    <strong className="rpt-exec-mode">{detectionMode}</strong>
                  </div>
                </div>
                <p className="rpt-exec-text">
                  {verdictIsForged
                    ? `Our analysis indicates the signature in the questioned document is inconsistent with the claimed signer\u2019s genuine signature patterns. Multiple high-impact differences were detected across key handwriting characteristics.`
                    : `Our analysis indicates the signature in the questioned document is consistent with the claimed signer\u2019s genuine signature patterns. The structural characteristics fall within the expected range of natural variation.`}
                </p>
                {r.writtenReport && (
                  <>
                    <div className="rpt-exec-narrative-divider" />
                    <p className="rpt-exec-narrative-text">{r.writtenReport}</p>
                    <p className="rpt-narrative-note">
                      <Info size={13} className="rpt-info-icon" />
                      This narrative was generated by an AI language model based
                      solely on the structured detection output. The verdict was
                      determined by mathematical similarity scoring.
                    </p>
                  </>
                )}
              </div>

              <div className="rpt-card rpt-rep-card-evidence">
                <h2 className="rpt-card-title">Evidence Overview</h2>
                <div className="rpt-ev-container">
                  <div className="rpt-ev-col">
                    <div className="rpt-sig-box">
                      <svg
                        width="28"
                        height="28"
                        viewBox="0 0 36 36"
                        fill="none"
                        stroke="#2d2623"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M 6 22 C 6 12, 14 8, 14 16 C 14 24, 8 26, 10 21 C 12 16, 17 13, 19 17 C 21 21, 20 27, 23 23 C 26 18, 28 17, 31 15" />
                      </svg>
                    </div>
                    <div className="rpt-ev-text-group">
                      <span className="rpt-ev-heading">Signature Region</span>
                      <span className="rpt-ev-main">Auto-detected</span>
                      <span className="rpt-ev-sub">
                        {sigRegion ? `${sigRegion.w} × ${sigRegion.h} px` : "—"}
                      </span>
                    </div>
                  </div>
                  <div className="rpt-ev-divider" />
                  <div className="rpt-ev-col">
                    <div className="rpt-ev-icon">
                      <svg
                        width="36"
                        height="36"
                        viewBox="0 0 36 36"
                        fill="none"
                        stroke="currentColor"
                      >
                        <circle
                          cx="26"
                          cy="10"
                          r="6"
                          strokeWidth="1.6"
                          strokeDasharray="3 3"
                        />
                        <path
                          d="M 6 28 C 6 19, 26 19, 26 16"
                          strokeWidth="1.6"
                          strokeDasharray="3 3"
                          strokeLinecap="round"
                        />
                        <circle cx="6" cy="28" r="1.5" fill="currentColor" />
                      </svg>
                    </div>
                    <div className="rpt-ev-text-group">
                      <span className="rpt-ev-heading">Analysis Time</span>
                      <span className="rpt-ev-main">{analysisTime}</span>
                    </div>
                  </div>
                  <div className="rpt-ev-divider" />
                  <div className="rpt-ev-col">
                    <div className="rpt-ev-icon">
                      <Layers
                        size={36}
                        strokeWidth={1.5}
                        color="currentColor"
                      />
                    </div>
                    <div className="rpt-ev-text-group">
                      <span className="rpt-ev-heading">Reference Samples</span>
                      <span className="rpt-ev-main">
                        {refCount} sample{refCount !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>
                  <div className="rpt-ev-divider" />
                  <div className="rpt-ev-col">
                    <div className="rpt-ev-icon">
                      <Brain size={36} strokeWidth={1.5} color="currentColor" />
                    </div>
                    <div className="rpt-ev-text-group">
                      <span className="rpt-ev-heading">Model</span>
                      <span className="rpt-ev-main">{modelName}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rpt-card rpt-rep-card-findings">
                <div className="rpt-card-header-sm">
                  <h2 className="rpt-card-title">Key Findings</h2>
                  <span className="rpt-header-sub">Impact Level</span>
                </div>
                <div className="rpt-findings-list">
                  {keyDifferences.map((kd) => (
                    <div key={kd.id} className="rpt-finding-row">
                      <div className="rpt-finding-left">
                        <AlertCircle size={16} className="rpt-alert-icon" />
                        <span>
                          {kd.label} inconsistency detected in the questioned
                          signature.
                        </span>
                      </div>
                      <span
                        className={`rpt-impact-badge ${kd.impact === "High" ? "high" : kd.impact === "Medium" ? "med" : "low"}`}
                      >
                        {kd.impact}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rpt-about-box">
                <strong>About this Report</strong>
                <p>
                  This report is generated by DocLens using advanced AI-powered
                  forensic analysis. It is intended to assist human reviewers
                  and should be used as part of a comprehensive review process.
                </p>
              </div>
            </div>

            <div className="rpt-rep-right">
              <div className="rpt-card">
                <h3 className="rpt-sidebar-title">Document Information</h3>
                <div className="rpt-info-list plain">
                  <div className="rpt-info-row">
                    <span className="rpt-plain-label">Case ID</span>
                    <span className="rpt-plain-val">{caseId}</span>
                  </div>
                  <div className="rpt-info-row">
                    <span className="rpt-plain-label">Document Name</span>
                    <span className="rpt-plain-val">
                      {caseData?.questionedFile?.name || "—"}
                    </span>
                  </div>
                  <div className="rpt-info-row">
                    <span className="rpt-plain-label">Date Received</span>
                    <span className="rpt-plain-val">
                      {caseData?.dateReceived || "—"}
                    </span>
                  </div>
                  <div className="rpt-info-row">
                    <span className="rpt-plain-label">Signer</span>
                    <span className="rpt-plain-val">{signerName}</span>
                  </div>
                  <div className="rpt-info-row">
                    <span className="rpt-plain-label">File Type</span>
                    <span className="rpt-plain-val">
                      {caseData?.questionedFile?.type
                        ?.split("/")[1]
                        ?.toUpperCase() || "—"}
                    </span>
                  </div>
                  <div className="rpt-info-row">
                    <span className="rpt-plain-label">File Size</span>
                    <span className="rpt-plain-val">
                      {caseData?.questionedFile?.size
                        ? `${(caseData.questionedFile.size / 1024 / 1024).toFixed(2)} MB`
                        : "—"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="rpt-card">
                <h3 className="rpt-sidebar-title">Analysis Summary</h3>
                <div className="rpt-info-list">
                  <div className="rpt-info-row">
                    <div className="rpt-info-label">
                      <Target size={16} className="rpt-row-icon" />
                      <span>Detection Mode</span>
                    </div>
                    <span className="rpt-mode-badge">{detectionMode}</span>
                  </div>
                  {selfConsistencyScore != null && (
                    <div className="rpt-info-row">
                      <div className="rpt-info-label">
                        <Brain size={16} className="rpt-row-icon" />
                        <span>Self-Consistency</span>
                      </div>
                      <span className="rpt-info-val">
                        {selfConsistencyScore}%
                        <span className="rpt-sc-hint">
                          {selfConsistencyScore >= 70
                            ? " (consistent)"
                            : selfConsistencyScore >= 60
                              ? " (borderline)"
                              : " (inconsistent)"}
                        </span>
                      </span>
                    </div>
                  )}
                  <div className="rpt-info-row">
                    <div className="rpt-info-label">
                      <Maximize2 size={16} className="rpt-row-icon" />
                      <span>Signature Region</span>
                    </div>
                    <span className="rpt-info-val">Auto-detected</span>
                  </div>
                  <div className="rpt-info-row">
                    <div className="rpt-info-label">
                      <Layers size={16} className="rpt-row-icon" />
                      <span>Reference Samples</span>
                    </div>
                    <span className="rpt-info-val">
                      {refCount} sample{refCount !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="rpt-info-row">
                    <div className="rpt-info-label">
                      <Activity size={16} className="rpt-row-icon" />
                      <span>Confidence Score</span>
                    </div>
                    <span className="rpt-info-val">{confidence}%</span>
                  </div>
                  <div className="rpt-info-row">
                    <div className="rpt-info-label">
                      <Clock size={16} className="rpt-row-icon" />
                      <span>Analysis Time</span>
                    </div>
                    <span className="rpt-info-val">{analysisTime}</span>
                  </div>
                  <div className="rpt-info-row">
                    <div className="rpt-info-label">
                      <Cpu size={16} className="rpt-row-icon" />
                      <span>Model</span>
                    </div>
                    <span className="rpt-info-val">{modelName}</span>
                  </div>
                </div>
              </div>

              <div className="rpt-card rpt-conclusion-card">
                <h3 className="rpt-sidebar-title">Conclusion</h3>
                <p className="rpt-conclusion-text">
                  {verdictIsForged
                    ? `Based on the forensic analysis, the questioned signature attributed to ${signerName} shows ${keyDifferences.filter((k) => k.impact === "High").length} high-impact inconsistencies compared to ${refCount} reference sample${refCount !== 1 ? "s" : ""}. The evidence supports a conclusion of forgery with ${confidenceLabel.toLowerCase()}.`
                    : `Based on the forensic analysis, the questioned signature attributed to ${signerName} is consistent with the provided reference samples. The evidence supports a conclusion of authenticity with ${confidenceLabel.toLowerCase()}.`}
                </p>
                <div className="rpt-prepared-by">
                  <span className="rpt-prepared-label">PREPARED BY</span>
                  <span className="rpt-prepared-name">
                    DocLens AI Forensic Engine
                  </span>
                  <span className="rpt-prepared-sub">
                    Automated Signature Verification System | Version 1.0
                  </span>
                  <span className="rpt-prepared-date">
                    Report Generated:{" "}
                    {caseData?.dateReceived ||
                      new Date().toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "long",
                        year: "numeric",
                      })}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
