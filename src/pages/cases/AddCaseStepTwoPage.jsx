import { useState, useRef } from "react";
import { ChevronRight, Upload } from "lucide-react";
import { useCase } from "../../context/CaseContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";

const DOCUMENT_ACCEPT =
  "image/jpeg,image/png,image/webp,image/bmp,application/pdf";
const DOCUMENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/bmp",
  "application/pdf",
]);

export function AddCaseStepTwoPage({ navigate }) {
  const toast = useToast();
  const {
    setQuestionedFile: saveQuestioned,
    setReferenceFiles: saveReferences,
    setUploadInfo,
  } = useCase();
  const [questionedFile, setQuestionedFile] = useState(null);
  const [referenceFiles, setReferenceFiles] = useState([]);
  const [uploadReason, setUploadReason] = useState("");
  const [sampleDescription, setSampleDescription] = useState("");

  const questionedInputRef = useRef(null);
  const referenceInputRef = useRef(null);

  const isDocumentFile = (file) => file && DOCUMENT_TYPES.has(file.type);

  const chooseQuestionedFile = (file) => {
    if (!file) {
      setQuestionedFile(null);
      return;
    }
    if (!isDocumentFile(file)) {
      toast.error("Please upload an image or PDF file.");
      return;
    }
    setQuestionedFile(file);
    saveQuestioned(file);
  };

  const chooseReferenceFiles = (files) => {
    const documents = files.filter(isDocumentFile);
    if (documents.length !== files.length) {
      toast.error("Only image or PDF files are supported.");
    }
    setReferenceFiles(documents);
    if (documents.length > 0) saveReferences(documents);
  };

  return (
    <section className="add-case-root" aria-labelledby="add-case-title">
      <nav className="add-breadcrumb" aria-label="Breadcrumb">
        <button type="button" onClick={() => navigate("/cases")}>
          Cases
        </button>
        <ChevronRight size={20} strokeWidth={2.5} />
        <span>Add Case</span>
      </nav>

      <h1 className="add-title" id="add-case-title">
        Add New Case
      </h1>

      <div className="add-steps-bar">
        <div className="add-step-item">
          <span className="add-step-num add-step-num-done">1</span>
          <span className="add-step-label">Basic Information</span>
        </div>
        <div className="add-step-divider" />
        <div className="add-step-item active">
          <span className="add-step-num">2</span>
          <span className="add-step-label">Document upload</span>
        </div>
      </div>

      <form
        className="add-form add-form-step2"
        onSubmit={(e) => e.preventDefault()}
      >
        <div className="add-step2-grid">
          <div className="add-step2-col">
            <h2 className="add-col-title">1. Questioned Document</h2>

            <div
              className={`add-upload-box ${questionedFile ? "has-file" : ""}`}
              onClick={() => questionedInputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  questionedInputRef.current?.click();
                }
              }}
              tabIndex={0}
              role="button"
              aria-label="Upload Questioned Document"
            >
              <Upload size={30} strokeWidth={2} className="add-upload-icon" />
              <strong className="add-upload-title">
                {questionedFile
                  ? questionedFile.name
                  : "Click to Upload your file"}
              </strong>
              <span className="add-upload-subtitle">Max 100mb filesize</span>
              <input
                ref={questionedInputRef}
                type="file"
                accept={DOCUMENT_ACCEPT}
                className="add-file-hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  chooseQuestionedFile(file);
                }}
              />
            </div>

            <label className="add-field" htmlFor="upload-reason">
              <span>Upload Reason</span>
              <input
                id="upload-reason"
                type="text"
                value={uploadReason}
                onChange={(e) => setUploadReason(e.target.value)}
              />
            </label>
          </div>

          <div className="add-step2-col">
            <h2 className="add-col-title">2. Reference Document</h2>

            <div
              className={`add-upload-box ${referenceFiles.length > 0 ? "has-file" : ""}`}
              onClick={() => referenceInputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  referenceInputRef.current?.click();
                }
              }}
              tabIndex={0}
              role="button"
              aria-label="Upload Reference Document"
            >
              <Upload size={30} strokeWidth={2} className="add-upload-icon" />
              <strong className="add-upload-title">
                {referenceFiles.length > 0
                  ? `${referenceFiles.length} file${referenceFiles.length > 1 ? "s" : ""} selected`
                  : "Click to Upload your file"}
              </strong>
              <span className="add-upload-subtitle">
                Multiple files supported (Max 100mb each)
              </span>
              <input
                ref={referenceInputRef}
                type="file"
                accept={DOCUMENT_ACCEPT}
                multiple
                className="add-file-hidden"
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  chooseReferenceFiles(files);
                }}
              />
            </div>

            <label className="add-field" htmlFor="sample-description">
              <span>Reference Sample Description</span>
              <input
                id="sample-description"
                type="text"
                value={sampleDescription}
                onChange={(e) => setSampleDescription(e.target.value)}
              />
            </label>
          </div>
        </div>

        <button
          className="add-create-btn"
          type="button"
          onClick={() => {
            if (!questionedFile) {
              toast.error("Please upload a questioned document.");
              return;
            }
            if (referenceFiles.length === 0) {
              toast.error("Please upload at least one reference document.");
              return;
            }
            setUploadInfo({ uploadReason, sampleDescription });
            navigate("/cases/analysis");
          }}
        >
          Create
        </button>
      </form>
    </section>
  );
}
