import { useState } from "react";
import { forgotPassword } from "../../lib/api.js";
import { useToast } from "../../context/ToastContext.jsx";

export function ForgotPasswordPage({ navigate }) {
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSend() {
    if (!email) {
      toast.error("Please enter your email address.");
      return;
    }
    setLoading(true);
    try {
      await forgotPassword(email);
      setSent(true);
      toast.success("Reset link sent — check your inbox.");
    } catch (err) {
      toast.error(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <section
        className="login-image-panel"
        aria-label="DocLens forgot password illustration"
      />
      <section className="login-form-panel">
        <div className="pattern pattern-dots pattern-dots-top" />
        <div className="pattern pattern-dots pattern-dots-right" />
        <div className="pattern zigzag zigzag-one" />
        <div className="pattern zigzag zigzag-two" />
        <div className="pattern zigzag zigzag-three" />
        <div className="pattern diagonal-lines diagonal-lines-top" />
        <div className="pattern diagonal-lines diagonal-lines-bottom" />
        <div className="pattern soft-circle circle-one" />
        <div className="pattern soft-circle circle-two" />
        <div className="pattern soft-circle circle-three" />
        <div className="pattern soft-circle circle-four" />

        <form className="login-card" onSubmit={(e) => e.preventDefault()}>
          <h1 className="forgot-heading">Forgot your password?</h1>

          {sent ? (
            <p
              style={{
                fontSize: "0.92rem",
                lineHeight: 1.6,
                margin: "8px 0 16px",
              }}
            >
              If that email is registered, a reset link has been sent. Check
              your inbox and follow the link to set a new password.
            </p>
          ) : (
            <>
              <label className="login-field">
                <span>Email</span>
                <input
                  type="email"
                  placeholder="Enter your email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>

              <button
                type="button"
                className="login-submit"
                disabled={loading}
                onClick={handleSend}
              >
                {loading ? "Sending…" : "Send"}
              </button>
            </>
          )}

          <p className="login-switch" style={{ marginTop: "12px" }}>
            <button type="button" onClick={() => navigate("/login")}>
              Back to Sign in
            </button>
          </p>
        </form>
      </section>
    </main>
  );
}
