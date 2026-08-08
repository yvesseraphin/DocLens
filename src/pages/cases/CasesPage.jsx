import { useState, useEffect } from 'react';
import {
  BookOpenText,
  ChevronDown,
  Flag,
  MoreVertical,
  Plus,
  ScrollText,
} from 'lucide-react';
import { listCases, deleteCase } from '../../lib/api.js';
import { useCase } from '../../context/CaseContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import imageIconSrc from '../../public/Image Icon.png';

const STATUS_LABELS = {
  pending:   { label: 'Pending',   cls: 'badge-pending'  },
  analyzing: { label: 'Analyzing', cls: 'badge-analyzing' },
  analyzed:  { label: 'Analyzed',  cls: 'badge-analyzed'  },
  error:     { label: 'Error',     cls: 'badge-error'     },
};

function getStatusBadge(status) {
  return STATUS_LABELS[status] ?? { label: status, cls: 'badge-pending' };
}

export function CasesPage({ navigate }) {
  const toast = useToast();
  const [cases, setCases]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [openMenu, setOpenMenu] = useState(null);
  const { setCaseInfo, setStorageURLs, completeAnalysis } = useCase();

  const fetchCases = async () => {
    setLoading(true);
    try {
      const data = await listCases();
      setCases(Array.isArray(data) ? data : []);
    } catch (err) {
      toast.error(err.message || 'Failed to load cases.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCases(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    function close() { setOpenMenu(null); }
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  async function handleDelete(id) {
    setOpenMenu(null);
    try {
      await deleteCase(id);
      setCases(prev => prev.filter(c => c.id !== id));
      toast.success('Case deleted.');
    } catch (err) {
      toast.error(err.message || 'Delete failed.');
    }
  }

  function handleViewCase(c) {
    setOpenMenu(null);
    setCaseInfo({
      caseRef:      c.case_ref      || '',
      caseType:     c.case_type     || '',
      subjectNames: c.subject_names || '',
      signerName:   c.signer_name   || '',
      dateReceived: c.date_received || '',
    });
    setStorageURLs({
      questionedStorageURL: c.questioned_url || null,
      referenceStorageURLs: c.reference_urls || [],
    });
    if (c.analysis_result) {
      completeAnalysis(c.analysis_result);
    }
    navigate('/cases/report');
  }

  const total    = cases.length;
  const flagged  = cases.filter(c => c.verdict === 'FORGED').length;
  const fraudPct = total > 0 ? Math.round((flagged / total) * 100) : 0;

  const METRICS = [
    { icon: ScrollText,   label: 'Total Documents',  value: String(total)   },
    { icon: Flag,         label: 'Flagged Documents', value: String(flagged) },
    { icon: BookOpenText, label: 'Fraud rate',        value: `${fraudPct}%` },
  ];

  const filtered = cases.filter((item) => {
    const q = search.toLowerCase();
    return (
      (item.case_ref    || '').toLowerCase().includes(q) ||
      (item.signer_name || '').toLowerCase().includes(q) ||
      (item.case_type   || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="cases-root">
      <div className="cases-hero">
        <h2 className="db-title">Cases</h2>

        <div className="cases-metrics">
          {METRICS.map(({ icon: Icon, label, value }) => (
            <div key={label} className="db-stat-card">
              <div className="db-stat-icon"><Icon size={24} strokeWidth={2} /></div>
              <div>
                <p className="db-stat-label">{label}</p>
                <p className="db-stat-value">{value}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="cases-toolbar">
          <div className="cases-search-wrap">
            <input
              className="cases-search-input"
              placeholder="Search by case ID, signer, or type..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button className="cases-search-btn" type="button">Search</button>
            <button className="cases-filter-btn" type="button">
              Filters <ChevronDown size={18} strokeWidth={2.5} />
            </button>
          </div>
          <button
            className="cases-add-btn"
            type="button"
            onClick={() => navigate('/cases/add/step-1')}
          >
            <Plus size={18} strokeWidth={2.4} /> Add Case
          </button>
        </div>
      </div>

      {loading && (
        <div className="cases-loading" aria-live="polite" aria-busy="true">
          <div className="add-spinner-ring" />
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="cases-empty">
          {search ? 'No cases match your search.' : 'No cases yet. Add your first case to get started.'}
        </div>
      )}

      {!loading && (
        <div className="cases-grid">
          {filtered.map((c) => {
            const badge = getStatusBadge(c.status);

            return (
              <div key={c.id} className="case-card">
                <div className="case-card-header">
                  <span className="case-id">{c.case_ref}</span>
                  <span className={`case-type-badge ${badge.cls}`}>{badge.label}</span>
                </div>

                <div className="case-card-icon">
                  <img src={imageIconSrc} alt="" aria-hidden="true" />
                </div>

                <p className="case-card-title">
                  {c.signer_name || c.subject_names || c.case_type || 'Untitled'}
                </p>

                <div className="case-card-actions">
                  <button
                    className="case-view-btn"
                    type="button"
                    onClick={() => handleViewCase(c)}
                  >
                    View
                  </button>
                  <div className="case-menu-wrap">
                    <button
                      className="case-menu-btn"
                      type="button"
                      aria-label="More options"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenu(openMenu === c.id ? null : c.id);
                      }}
                    >
                      <MoreVertical size={22} strokeWidth={2.4} />
                    </button>
                    {openMenu === c.id && (
                      <div className="case-dropdown" onClick={(e) => e.stopPropagation()}>
                        <button type="button" onClick={() => handleViewCase(c)}>View</button>
                        <button type="button" onClick={() => handleDelete(c.id)}>Delete</button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
