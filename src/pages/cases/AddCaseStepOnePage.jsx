import { useState } from "react";
import { CalendarDays, ChevronDown, ChevronRight } from "lucide-react";
import { useCase } from "../../context/CaseContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";

const CASE_TYPES = ["Forgery", "Identity Review", "Document Fraud"];

export function AddCaseStepOnePage({ navigate }) {
  const toast = useToast();
  const { setCaseInfo } = useCase();

  const [caseRef, setCaseRef] = useState("");
  const [selectedType, setSelectedType] = useState("Forgery");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [subjectNames, setSubjectNames] = useState("");
  const [signerName, setSignerName] = useState("");
  const [dateReceived, setDateReceived] = useState("");

  function handleNext() {
    if (!caseRef.trim()) {
      toast.error("Please enter a Case ID.");
      return;
    }
    if (!signerName.trim()) {
      toast.error("Please enter the signer name.");
      return;
    }
    setCaseInfo({
      caseRef,
      caseType: selectedType,
      subjectNames,
      signerName,
      dateReceived,
    });
    navigate("/cases/add/step-2");
  }

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
        <div className="add-step-item active">
          <span className="add-step-num">1</span>
          <span className="add-step-label">Basic Information</span>
        </div>
        <div className="add-step-divider" />
        <div className="add-step-item">
          <span className="add-step-num">2</span>
          <span className="add-step-label">Document upload</span>
        </div>
      </div>

      <form className="add-form" onSubmit={(e) => e.preventDefault()}>
        <div className="add-form-row">
          <label className="add-field" htmlFor="case-id">
            <span>Case ID</span>
            <input
              id="case-id"
              type="text"
              placeholder="FDE-202464"
              value={caseRef}
              onChange={(e) => setCaseRef(e.target.value)}
            />
          </label>

          <div className="add-field">
            <span id="case-type-label">Case Type</span>
            <div
              className="add-select-wrap"
              tabIndex={0}
              role="button"
              aria-haspopup="listbox"
              aria-expanded={isDropdownOpen}
              aria-labelledby="case-type-label"
              onClick={() => setIsDropdownOpen((prev) => !prev)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setIsDropdownOpen((prev) => !prev);
                }
              }}
            >
              <div className="add-select-trigger">
                <span>{selectedType}</span>
                <ChevronDown
                  size={20}
                  strokeWidth={2.5}
                  className={`add-select-arrow ${isDropdownOpen ? "open" : ""}`}
                />
              </div>

              {isDropdownOpen && (
                <div className="add-select-dropdown" role="listbox">
                  {CASE_TYPES.map((type) => (
                    <div
                      key={type}
                      role="option"
                      aria-selected={selectedType === type}
                      className={`add-select-option ${selectedType === type ? "selected" : ""}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedType(type);
                        setIsDropdownOpen(false);
                      }}
                    >
                      {type}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <label className="add-field add-field-wide" htmlFor="subject-names">
          <span>Subject Names</span>
          <input
            id="subject-names"
            type="text"
            value={subjectNames}
            onChange={(e) => setSubjectNames(e.target.value)}
          />
        </label>

        <label className="add-field add-field-wide" htmlFor="signer-name">
          <span>Signer Name</span>
          <input
            id="signer-name"
            type="text"
            value={signerName}
            onChange={(e) => setSignerName(e.target.value)}
          />
        </label>

        <label className="add-field add-date-field" htmlFor="date-received">
          <span>Date Received</span>
          <div className="add-date-wrap">
            <CalendarDays size={22} strokeWidth={2.2} />
            <input
              id="date-received"
              type="text"
              placeholder="DD-MM-YYYY"
              value={dateReceived}
              onChange={(e) => setDateReceived(e.target.value)}
            />
          </div>
        </label>

        <button className="add-next-btn" type="button" onClick={handleNext}>
          Next <ChevronRight size={22} strokeWidth={3} />
        </button>
      </form>
    </section>
  );
}
