import { useState, useEffect, useRef, memo } from "react";
import {
  BookOpenText,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Flag,
  ScrollText,
} from "lucide-react";
import { listCases, healthCheck } from "../../lib/api.js";

const ROWS_PER_PAGE = 5;

const CloudDonut = memo(function CloudDonut({ value = 0 }) {
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  const gap = 16;
  const fastLength = Math.max(0, circumference * (value / 100) - gap);
  const slowLength = Math.max(0, circumference * ((100 - value) / 100) - gap);

  return (
    <div className="db-donut" role="img" aria-label={`${value}% overall`}>
      <svg className="db-donut-svg" viewBox="0 0 160 160" aria-hidden="true">
        <circle className="db-donut-track" cx="80" cy="80" r={radius} />
        <circle
          className="db-donut-arc db-donut-arc-fast"
          cx="80"
          cy="80"
          r={radius}
          strokeDasharray={`${fastLength} ${circumference}`}
          strokeDashoffset={0}
        />
        <circle
          className="db-donut-arc db-donut-arc-slow"
          cx="80"
          cy="80"
          r={radius}
          strokeDasharray={`${slowLength} ${circumference}`}
          strokeDashoffset={-(fastLength + gap)}
        />
      </svg>
      <div className="db-donut-center">
        <strong>{value}%</strong>
        <span>Fraud Rate</span>
      </div>
    </div>
  );
});

export function DashboardHomePage({ navigate }) {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [apiOnline, setApiOnline] = useState(null); // null = checking
  const fetchedRef = useRef(false);

  const fetchCases = async (force = false) => {
    if (fetchedRef.current && !force) return;
    setLoading(true);
    try {
      const data = await listCases();
      setCases(Array.isArray(data) ? data : []);
      fetchedRef.current = true;
    } catch {
      setCases([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCases();
    // Real health check — drives the Cloud Health widget
    healthCheck()
      .then(() => setApiOnline(true))
      .catch(() => setApiOnline(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const apiStatus =
    apiOnline === null ? "Checking…" : apiOnline ? "Online" : "Offline";
  const healthRows = [
    { label: "AI Connection", status: apiStatus },
    {
      label: "Image Recognition",
      status:
        apiOnline === null ? "Checking…" : apiOnline ? "Active" : "Unavailable",
    },
    {
      label: "File Storage",
      status:
        apiOnline === null
          ? "Checking…"
          : apiOnline
            ? "Healthy"
            : "Unavailable",
    },
    {
      label: "Official Records",
      status:
        apiOnline === null
          ? "Checking…"
          : apiOnline
            ? "Updated"
            : "Unavailable",
    },
  ];

  const total = cases.length;
  const flagged = cases.filter((c) => c.verdict === "FORGED").length;
  const pending = cases.filter(
    (c) => c.status === "pending" || c.status === "analyzing",
  ).length;
  const fraudPct = total > 0 ? Math.round((flagged / total) * 100) : 0;

  const metrics = [
    { icon: ScrollText, label: "Total Documents", value: String(total) },
    { icon: Flag, label: "Flagged Documents", value: String(flagged) },
    { icon: BookOpenText, label: "Fraud Rate", value: `${fraudPct}%` },
    { icon: CalendarClock, label: "Pending Reviews", value: String(pending) },
  ];

  const totalPages = Math.max(1, Math.ceil(cases.length / ROWS_PER_PAGE));
  const pageRows = cases.slice(
    (page - 1) * ROWS_PER_PAGE,
    page * ROWS_PER_PAGE,
  );

  return (
    <section className="db-root" aria-labelledby="dashboard-title">
      <div className="db-hero">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <h1 className="db-title" id="dashboard-title">
            Dashboard
          </h1>
        </div>

        <div className="db-stats" aria-label="Document metrics">
          {metrics.map(({ icon: Icon, label, value }) => (
            <article className="db-stat-card" key={label}>
              <div className="db-stat-icon">
                <Icon size={24} strokeWidth={2} />
              </div>
              <div className="db-stat-text">
                <p className="db-stat-label">{label}</p>
                <p className="db-stat-value">{loading ? "…" : value}</p>
              </div>
            </article>
          ))}
        </div>
      </div>

      <div className="db-content">
        <section
          className="db-card db-recent-card"
          aria-labelledby="recent-title"
        >
          <h2 className="db-card-title" id="recent-title">
            Recent Cases
          </h2>

          {loading ? (
            <div
              style={{
                padding: "24px 0",
                display: "flex",
                justifyContent: "center",
              }}
            >
              <div
                className="add-spinner-ring"
                style={{
                  width: 36,
                  height: 36,
                  borderWidth: 3,
                  marginBottom: 0,
                }}
              />
            </div>
          ) : cases.length === 0 ? (
            <p style={{ padding: "16px 0", color: "#888", fontSize: "0.9rem" }}>
              No cases yet.
            </p>
          ) : (
            <>
              <table className="db-table">
                <thead>
                  <tr>
                    <th>Case ID</th>
                    <th>Signer</th>
                    <th>Decision</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((c) => (
                    <tr
                      key={c.id}
                      style={{ cursor: "pointer" }}
                      onClick={() => navigate && navigate("/cases")}
                    >
                      <td>{c.case_ref || c.id?.slice(0, 8)}</td>
                      <td>{c.signer_name || c.subject_names || "—"}</td>
                      <td>
                        {c.verdict ? (
                          <span
                            className={`db-badge ${c.verdict === "GENUINE" ? "db-badge-verified" : "db-badge-flagged"}`}
                          >
                            {c.verdict === "GENUINE" ? "Verified" : "Flagged"}
                          </span>
                        ) : (
                          <span
                            className="db-badge"
                            style={{ background: "#f0f0f0", color: "#666" }}
                          >
                            {c.status || "Pending"}
                          </span>
                        )}
                      </td>
                      <td className="db-td-muted">
                        {c.created_at
                          ? new Date(c.created_at).toLocaleDateString("en-GB", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })
                          : c.date_received || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {totalPages > 1 && (
                <div className="db-pagination" aria-label="Pagination">
                  <button
                    className="db-pg-btn"
                    type="button"
                    aria-label="Previous page"
                    disabled={page === 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft size={13} />
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                    (p) => (
                      <button
                        key={p}
                        className={`db-pg-btn${page === p ? " db-pg-active" : ""}`}
                        type="button"
                        onClick={() => setPage(p)}
                      >
                        {p}
                      </button>
                    ),
                  )}
                  <button
                    className="db-pg-btn"
                    type="button"
                    aria-label="Next page"
                    disabled={page === totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    <ChevronRight size={13} />
                  </button>
                </div>
              )}
            </>
          )}
        </section>

        <aside className="db-card db-health-card" aria-labelledby="cloud-title">
          <h2 className="db-card-title" id="cloud-title">
            Cloud Health
          </h2>
          <div className="db-donut-wrap">
            <CloudDonut value={fraudPct} />
            <div className="db-legend" aria-label="Legend">
              <span className="db-legend-dot db-dot-slow">Forged</span>
              <span className="db-legend-dot db-dot-fast">Genuine</span>
            </div>
          </div>
          <div className="db-health-list">
            {healthRows.map((item) => (
              <div className="db-health-row" key={item.label}>
                <span className="db-health-label">{item.label}</span>
                <span className="db-health-status">{item.status}</span>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </section>
  );
}
