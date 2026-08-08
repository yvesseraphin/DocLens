import { useState, useEffect } from "react";
import { Eye, EyeOff } from "lucide-react";
import { login, auth } from "../../lib/api.js";
import { signInWithGoogle } from "../../lib/supabase.js";
import { useToast } from "../../context/ToastContext.jsx";

const REMEMBERED_EMAIL_KEY = "dl_remembered_email";

function GoogleIcon() {
  return (
    <svg
      className="google-icon"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

export function LoginPage({ navigate }) {
  const toast = useToast();
  const [email, setEmail] = useState(
    () => localStorage.getItem(REMEMBERED_EMAIL_KEY) || "",
  );
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // Skip login page if already authenticated
  useEffect(() => {
    if (auth.isLoggedIn()) {
      navigate("/dashboard");
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSignIn() {
    if (!email || !password) {
      toast.error("Please enter your email and password.");
      return;
    }
    setLoading(true);
    try {
      await login({ email, password });
      // Persist email for next visit
      localStorage.setItem(REMEMBERED_EMAIL_KEY, email);
      navigate("/dashboard");
    } catch (err) {
      toast.error(
        err.message || "Login failed. Please check your credentials.",
      );
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter") handleSignIn();
  }

  async function handleGoogle() {
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      toast.error(err.message || "Google sign-in failed. Please try again.");
      setGoogleLoading(false);
    }
  }

  return (
    <main className="login-page">
      <section
        className="login-image-panel"
        aria-label="DocLens login illustration"
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
          <h1>Welcome Back</h1>

          <label className="login-field">
            <span>Email</span>
            <input
              type="email"
              placeholder="Email Address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={handleKeyDown}
              autoComplete="email"
            />
          </label>

          <label className="login-field">
            <span>Password</span>
            <div className="password-input">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={handleKeyDown}
                autoComplete="current-password"
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

          <button
            type="button"
            className="forgot-link"
            onClick={() => navigate("/forgot-password")}
          >
            Forgot Password
          </button>

          <button
            type="button"
            className="login-submit"
            disabled={loading}
            onClick={handleSignIn}
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>

          <div className="divider">
            <span>OR</span>
          </div>

          <button
            type="button"
            className="google-button"
            disabled={googleLoading}
            onClick={handleGoogle}
          >
            <GoogleIcon />
            {googleLoading ? "Redirecting…" : "Continue with Google"}
          </button>

          <p className="login-switch">
            Didn&apos;t have an Account!?{" "}
            <button type="button" onClick={() => navigate("/signup")}>
              Sign-up
            </button>
          </p>
        </form>
      </section>
    </main>
  );
}
