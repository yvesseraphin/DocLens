import { ShieldCheck } from "lucide-react";

export function AuthLayout({ eyebrow, title, subtitle, children }) {
  return (
    <main className="auth-page">
      <section className="auth-visual">
        <div className="brand-mark">
          <ShieldCheck size={28} />
          <span>DocLens</span>
        </div>
        <div className="scan-window">
          <div className="scan-toolbar" />
          <div className="doc-preview">
            <span className="signature-line" />
            <span className="heat heat-one" />
            <span className="heat heat-two" />
            <span className="box box-one" />
            <span className="box box-two" />
          </div>
        </div>
        <p>
          Visual proof for forged signatures, altered fields, and document
          tampering.
        </p>
      </section>
      <section className="auth-panel">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="muted">{subtitle}</p>
        {children}
      </section>
    </main>
  );
}
