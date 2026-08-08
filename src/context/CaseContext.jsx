import { createContext, useContext, useState, useCallback, useEffect } from 'react';

const CaseContext = createContext(null);

const SESSION_KEY = 'dl_case_data';

function loadFromSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

const DEFAULT_STATE = {
  questionedFile: null,
  questionedFileURL: null,
  questionedStorageURL: null,
  referenceFiles: [],
  referenceFileURLs: [],
  referenceStorageURLs: [],
  caseRef: '',
  caseType: 'Forgery',
  subjectNames: '',
  signerName: '',
  dateReceived: '',
  uploadReason: '',
  sampleDescription: '',
  analysisResult: null,
};

export function CaseProvider({ children }) {
  const [caseData, setCaseData] = useState(() => {
    const saved = loadFromSession();
    return saved ? { ...DEFAULT_STATE, ...saved } : DEFAULT_STATE;
  });

  // Persist to sessionStorage on every change (excludes File objects — not serialisable)
  useEffect(() => {
    try {
      const { questionedFile, referenceFiles, ...serialisable } = caseData;
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(serialisable));
    } catch {
      // storage full or unavailable — fail silently
    }
  }, [caseData]);

  const setQuestionedFile = useCallback((file) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setCaseData(prev => ({ ...prev, questionedFile: file, questionedFileURL: url }));
  }, []);

  const setReferenceFiles = useCallback((files) => {
    const arr = Array.isArray(files) ? files : [files];
    const urls = arr.map(f => URL.createObjectURL(f));
    setCaseData(prev => ({ ...prev, referenceFiles: arr, referenceFileURLs: urls }));
  }, []);

  const setCaseInfo = useCallback(({ caseRef, caseType, subjectNames, signerName, dateReceived }) => {
    setCaseData(prev => ({ ...prev, caseRef, caseType, subjectNames, signerName, dateReceived }));
  }, []);

  const setUploadInfo = useCallback(({ uploadReason, sampleDescription }) => {
    setCaseData(prev => ({ ...prev, uploadReason, sampleDescription }));
  }, []);

  const setStorageURLs = useCallback(({ questionedStorageURL, referenceStorageURLs }) => {
    setCaseData(prev => ({ ...prev, questionedStorageURL, referenceStorageURLs }));
  }, []);

  const completeAnalysis = useCallback((apiResult) => {
    setCaseData(prev => ({ ...prev, analysisResult: apiResult ?? null }));
  }, []);

  return (
    <CaseContext.Provider value={{
      caseData,
      setQuestionedFile,
      setReferenceFiles,
      setCaseInfo,
      setUploadInfo,
      setStorageURLs,
      completeAnalysis,
    }}>
      {children}
    </CaseContext.Provider>
  );
}

export const useCase = () => {
  const ctx = useContext(CaseContext);
  if (!ctx) throw new Error('useCase must be used within CaseProvider');
  return ctx;
};
