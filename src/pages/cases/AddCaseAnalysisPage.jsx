import { useState, useEffect, useRef } from 'react';
import { ChevronRight } from 'lucide-react';
import { useCase } from '../../context/CaseContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { createCase, uploadCaseFiles, analyzeCase } from '../../lib/api.js';

const THINKING_STEPS = [
  { label: 'Decoding document and detecting signature region...' },
  { label: 'Cropping and preprocessing signature samples...' },
  { label: 'Extracting neural embeddings...' },
  { label: 'Computing cosine similarity against reference samples...' },
  { label: 'Running Grad-CAM explainability analysis...' },
  { label: 'Detecting pen lifts and baseline deviation...' },
  { label: 'Determining verdict and confidence score...' },
  { label: 'Generating forensic narrative...' },
];

export function AddCaseAnalysisPage({ navigate }) {
  const { caseData, completeAnalysis, setStorageURLs } = useCase();
  const toast = useToast();
  const [showThinking, setShowThinking] = useState(true);
  const [step, setStep] = useState(1);
  const doneRef = useRef(false);

  useEffect(() => {
    if (doneRef.current) return;
    doneRef.current = true;

    const delays = [1200, 2400, 3600, 4800, 6000, 7200, 8600];
    const timers = delays.map((ms, i) => setTimeout(() => setStep(i + 2), ms));

    runPipeline().catch(() => {});

    return () => timers.forEach(clearTimeout);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function runPipeline() {
    try {
      const caseRecord = await createCase({
        case_id:            caseData.caseRef || `CASE-${Date.now()}`,
        case_type:          caseData.caseType || 'Forgery',
        subject_names:      caseData.subjectNames || '',
        signer_name:        caseData.signerName || '',
        date_received:      caseData.dateReceived || '',
        upload_reason:      caseData.uploadReason || '',
        sample_description: caseData.sampleDescription || '',
      });

      const caseId = caseRecord.id;

      if (caseData.questionedFile) {
        const uploadResp = await uploadCaseFiles(
          caseId,
          caseData.questionedFile,
          caseData.referenceFiles || [],
        );
        setStorageURLs({
          questionedStorageURL: uploadResp.questioned_url || null,
          referenceStorageURLs: uploadResp.reference_urls || [],
        });
      }

      let result = null;
      if (caseData.questionedFile) {
        result = await analyzeCase(caseId, caseData.questionedFile, caseData.referenceFiles || []);
      }

      completeAnalysis(result);
      navigate('/cases/report');
    } catch (err) {
      toast.error(err.message || 'Analysis failed. Please try again.');
      setTimeout(() => {
        completeAnalysis(null);
        navigate('/cases/report');
      }, 2000);
    }
  }

  return (
    <section className="add-case-root add-analysis-page" aria-labelledby="add-case-title">
      <nav className="add-breadcrumb" aria-label="Breadcrumb">
        <button type="button" onClick={() => navigate('/cases')}>Cases</button>
        <ChevronRight size={20} strokeWidth={2.5} />
        <span>Add Case</span>
      </nav>

      <h1 className="add-title" id="add-case-title">Add New Case</h1>

      <div className="add-analysis-body">
        <div className="add-analysis-center">
          <div className="add-spinner-ring" aria-hidden="true" />

          <h2 className="add-analysis-heading">Analysis in progress</h2>

          <p className="add-analysis-subtext">AI Analyzing your document</p>

          <div className="add-thinking-wrap">
            <button
              type="button"
              className={`add-thinking-btn ${showThinking ? 'expanded' : ''}`}
              onClick={() => setShowThinking((prev) => !prev)}
            >
              <ChevronRight size={16} strokeWidth={2.2} className="add-thinking-chevron" />
              <span>{step >= THINKING_STEPS.length ? `Thought for ${THINKING_STEPS.length} steps` : 'Thinking...'}</span>
            </button>

            {showThinking && (
              <div className="add-thinking-log">
                <ul className="add-thinking-list">
                  {THINKING_STEPS.map((s, i) =>
                    step > i ? (
                      <li key={i} className="add-thinking-item">
                        <span className={`add-thinking-bullet ${
                          step === i + 1 && step < THINKING_STEPS.length ? 'active' : step > i + 1 ? 'done' : ''
                        }`} />
                        <span className="add-thinking-label">{s.label}</span>
                      </li>
                    ) : null
                  )}
                </ul>
              </div>
            )}
          </div>
        </div>

        <div className="add-analysis-footer">
          <button
            type="button"
            className="add-wait-btn"
            onClick={() => navigate('/cases')}
          >
            Wait
          </button>
        </div>
      </div>
    </section>
  );
}
