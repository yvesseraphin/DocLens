import { useRef } from 'react';

export function EmailVerificationPage({ navigate }) {
  const inputs = useRef([]);

  function handleInput(e, index) {
    const val = e.target.value.replace(/\D/g, '');
    e.target.value = val.slice(-1);
    if (val && index < 5) {
      inputs.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(e, index) {
    if (e.key === 'Backspace' && !e.target.value && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  }

  function handlePaste(e) {
    e.preventDefault();
    const digits = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6).split('');
    digits.forEach((d, i) => {
      if (inputs.current[i]) inputs.current[i].value = d;
    });
    inputs.current[Math.min(digits.length, 5)]?.focus();
  }

  return (
    <main className="login-page">
      <section className="login-image-panel" aria-label="DocLens email verification illustration" />
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
          <h1 className="verify-heading">Check your inbox!</h1>
          <p className="verify-sub">
            We sent a verification email to confirm your account. Please check your inbox.
          </p>

          <div className="otp-grid" onPaste={handlePaste}>
            {Array.from({ length: 6 }).map((_, i) => (
              <input
                key={i}
                ref={el => { inputs.current[i] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                aria-label={`Code digit ${i + 1}`}
                onInput={e => handleInput(e, i)}
                onKeyDown={e => handleKeyDown(e, i)}
              />
            ))}
          </div>

          <button type="button" className="login-submit" onClick={() => navigate('/login')}>
            Back to Sign in
          </button>
        </form>
      </section>
    </main>
  );
}
