import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { resetPassword } from "../../lib/api.js";
import { useToast } from "../../context/ToastContext.jsx";

function getResetTokens() {
  const raw = window.location.hash.replace(/^#/, "");
  const params = new URLSearchParams(raw);
  return {
    accessToken: params.get("access_token") || "",
    refreshToken: params.get("refresh_token") || "",
  };
}

export function ChangePasswordPage({ navigate }) {
  const toast = useToast();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords do not match.");
      return;
    }
    const { accessToken, refreshToken } = getResetTokens();
    if (!accessToken) {
      toast.error(
        "Reset token not found. Please request a new password reset link.",
      );
      return;
    }
    setLoading(true);
    try {
      await resetPassword({
        access_token: accessToken,
        refresh_token: refreshToken,
        new_password: password,
      });
      toast.success("Password changed successfully.");
      navigate("/login");
    } catch (err) {
      toast.error(err.message || "Failed to reset password. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <section
        className="login-image-panel"
        aria-label="DocLens change password illustration"
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
          <h1 className="forgot-heading">Change Password</h1>

          <label className="login-field">
            <span>New Password</span>
            <div className="password-input">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                aria-label={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword((v) => !v)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </label>

          <label className="login-field">
            <span>Confirm Password</span>
            <div className="password-input">
              <input
                type={showConfirm ? "text" : "password"}
                placeholder="Repeat your new password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
              <button
                type="button"
                aria-label={showConfirm ? "Hide password" : "Show password"}
                onClick={() => setShowConfirm((v) => !v)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </label>

          <button
            type="button"
            className="login-submit"
            disabled={loading}
            onClick={handleSubmit}
          >
            {loading ? "Saving…" : "Change Password"}
          </button>
        </form>
      </section>
    </main>
  );
}
