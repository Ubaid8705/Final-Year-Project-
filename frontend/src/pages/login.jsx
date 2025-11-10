import React, { useEffect, useState } from 'react';
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { API_BASE_URL } from "../config";
import './login.css';

const INITIAL_FORM = {
  name: "",
  username: "",
  email: "",
  password: "",
  confirmPassword: "",
};

const createEmptyForm = () => ({ ...INITIAL_FORM });

const Login = () => {
  const [view, setView] = useState("welcome"); // welcome, signup, email-signin, email-signup, verify-email, forgot-password
  const [formData, setFormData] = useState(createEmptyForm);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const navigate = useNavigate();
  const { user, loading, login, signup } = useAuth();

  useEffect(() => {
    if (!loading && user) {
      navigate('/', { replace: true });
    }
  }, [user, loading, navigate]);

  const redirectToOAuth = (provider) => {
    window.location.href = `${API_BASE_URL}/auth/${provider}`;
  };

  const updateView = (nextView) => {
    setView(nextView);
    setError("");
    setNotice("");
    setSubmitting(false);
    setOtpCode("");

    setFormData((current) => {
      if (nextView === "email-signin") {
        return {
          ...createEmptyForm(),
          email: current.email,
        };
      }

      if (nextView === "email-signup") {
        return {
          ...createEmptyForm(),
          email: current.email,
        };
      }

      if (nextView === "verify-email" || nextView === "forgot-password") {
        return {
          ...createEmptyForm(),
          email: current.email,
        };
      }

      return createEmptyForm();
    });
  };

  const handleChange = (field) => (event) => {
    const { value } = event.target;
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleEmailSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setNotice("");

    if (submitting) {
      return;
    }

    setSubmitting(true);

    try {
      if (view === "email-signin") {
        const result = await login({
          email: formData.email.trim(),
          password: formData.password,
        });

        if (result?.error) {
          setError(result.error);
          return;
        }

        navigate("/");
        return;
      }

      if (view === "email-signup") {
        if (formData.password !== formData.confirmPassword) {
          setError("Passwords do not match");
          return;
        }

        const result = await signup({
          name: formData.name.trim(),
          username: formData.username.trim(),
          email: formData.email.trim(),
          password: formData.password,
        });

        if (result?.error) {
          setError(result.error);
          return;
        }

        const message = result?.message || "Check your email for the verification code.";
        setNotice(message);
        updateView("verify-email");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifySubmit = async (event) => {
    event.preventDefault();
    setError("");
    setNotice("");

    if (submitting) {
      return;
    }

    if (!formData.email.trim() || !otpCode.trim()) {
      setError("Enter the email and verification code");
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/verify-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: formData.email.trim(), otp: otpCode.trim() }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.error || "Unable to verify email");
      }

      setNotice(payload?.message || "Email verified successfully. You can sign in now.");
      updateView("email-signin");
    } catch (verifyError) {
      setError(verifyError.message || "Unable to verify email");
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setNotice("");

    if (submitting) {
      return;
    }

    if (!formData.email.trim()) {
      setError("Enter the email associated with your account");
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: formData.email.trim() }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.error || "Unable to send reset email");
      }

      setNotice(payload?.message || "Check your email for the reset link.");
    } catch (forgotError) {
      setError(forgotError.message || "Unable to send reset email");
    } finally {
      setSubmitting(false);
    }
  };

  const renderEmailForm = (title) => (
    <div className="auth-container">
      <div className="auth-header">
        <div className="auth-icon">✉️</div>
        <h1>{title}</h1>
      </div>
      <form onSubmit={handleEmailSubmit}>
        {view === "email-signup" && (
          <>
            <label>Your name</label>
            <input
              type="text"
              value={formData.name}
              onChange={handleChange("name")}
              placeholder="How should we address you?"
              required
            />
            <label>Username</label>
            <input
              type="text"
              value={formData.username}
              onChange={handleChange("username")}
              placeholder="Pick a unique username"
              required
            />
          </>
        )}
        <label>Your email</label>
        <input
          type="email"
          value={formData.email}
          onChange={handleChange("email")}
          placeholder="Enter your email address"
          autoComplete="email"
          required
        />
        <label>Password</label>
        <input
          type="password"
          value={formData.password}
          onChange={handleChange("password")}
          placeholder="Enter your password"
          autoComplete={view === "email-signup" ? "new-password" : "current-password"}
          required
        />
        {view === "email-signup" && (
          <>
            <label>Confirm password</label>
            <input
              type="password"
              value={formData.confirmPassword}
              onChange={handleChange("confirmPassword")}
              placeholder="Re-enter your password"
              autoComplete="new-password"
              required
            />
          </>
        )}
        {error && (
          <div className="status-message error">{error}</div>
        )}
        {notice && (
          <div className="status-message success">{notice}</div>
        )}
        <button type="submit" className="submit-btn" disabled={submitting}>
          {submitting
            ? (view === "email-signup" ? "Creating..." : "Signing in...")
            : view === "email-signup" ? "Create account" : "Continue"}
        </button>
      </form>
      {view === "email-signin" && (
        <button
          type="button"
          className="link"
          onClick={() => updateView("forgot-password")}
        >
          Forgot your password?
        </button>
      )}
      <button
        className="back-button"
        onClick={() => updateView(view.includes("signup") ? "signup" : "welcome")}
      >
        Back to sign {view.includes("signup") ? "up" : "in"} options
      </button>
      {view === "email-signup" && (
        <div className="auth-footer">
          <p>Already have an account? <button onClick={() => updateView("welcome")}>Sign in</button></p>
          <p className="terms">
            By clicking "Create Account", you agree to Medium's Terms of Service and acknowledge our Privacy Policy
          </p>
        </div>
      )}
    </div>
  );

  const renderWelcomeScreen = () => (
    <div className="auth-container">
      <h1>Welcome back.</h1>
      <div className="auth-buttons">
        <button className="social-btn google" onClick={() => redirectToOAuth("google")}>
          <img src="/google-icon.png" alt="" /> Sign in with Google
        </button>
        <button className="social-btn facebook" onClick={() => redirectToOAuth("facebook")}>
          <img src="/facebook-icon.png" alt="" /> Sign in with Facebook
        </button>
        <button
          className="email-btn"
          onClick={() => updateView("email-signin")}
        >
          <span>✉️</span> Sign in with email
        </button>
      </div>
      <p className="auth-footer">
        No account? <button onClick={() => updateView("signup")}>Create one</button>
      </p>
      <p className="auth-help">
        Forgot email or trouble signing in?{" "}
        <button type="button" className="link" onClick={() => alert("Help (mock)")}>
          Get help
        </button>.
      </p>
    </div>
  );

  const renderSignupScreen = () => (
    <div className="auth-container">
      <h1>Join Medium.</h1>
      <div className="auth-buttons">
        <button className="social-btn google" onClick={() => redirectToOAuth("google")}>
          <img src="/google-icon.png" alt="" /> Sign up with Google
        </button>
        <button className="social-btn facebook" onClick={() => redirectToOAuth("facebook")}>
          <img src="/facebook-icon.png" alt="" /> Sign up with Facebook
        </button>
        <button 
          className="email-btn"
          onClick={() => updateView('email-signup')}
        >
          <span>✉️</span> Sign up with email
        </button>
      </div>
      <p className="auth-footer">
        Already have an account? <button onClick={() => updateView('welcome')}>Sign in</button>
      </p>
    </div>
  );

  const renderVerifyForm = () => (
    <div className="auth-container">
      <div className="auth-header">
        <div className="auth-icon">✅</div>
        <h1>Verify your email</h1>
        <p className="auth-subheading">
          Enter the six-digit code we sent to <strong>{formData.email || "your email"}</strong>.
        </p>
      </div>
      <form onSubmit={handleVerifySubmit}>
        <label>Email</label>
        <input
          type="email"
          value={formData.email}
          onChange={handleChange("email")}
          placeholder="Enter your email"
          autoComplete="email"
          required
        />
        <label>Verification code</label>
        <input
          type="text"
          value={otpCode}
          onChange={(event) => setOtpCode(event.target.value)}
          placeholder="123456"
          maxLength={6}
          inputMode="numeric"
          required
        />
        {error && <div className="status-message error">{error}</div>}
        {notice && <div className="status-message success">{notice}</div>}
        <button type="submit" className="submit-btn" disabled={submitting}>
          {submitting ? "Verifying..." : "Verify email"}
        </button>
      </form>
      <button className="back-button" onClick={() => updateView("email-signin")}>Back to sign in</button>
      <p className="auth-help">
        Didn’t receive the email? Check your spam folder or&nbsp;
        <button
          type="button"
          className="link"
          onClick={() => updateView("email-signup")}
        >
          restart sign up
        </button>.
      </p>
    </div>
  );

  const renderForgotForm = () => (
    <div className="auth-container">
      <div className="auth-header">
        <div className="auth-icon">🔐</div>
        <h1>Reset your password</h1>
        <p className="auth-subheading">
          Enter the email associated with your account and we’ll send a reset link.
        </p>
      </div>
      <form onSubmit={handleForgotSubmit}>
        <label>Email</label>
        <input
          type="email"
          value={formData.email}
          onChange={handleChange("email")}
          placeholder="you@example.com"
          autoComplete="email"
          required
        />
        {error && <div className="status-message error">{error}</div>}
        {notice && <div className="status-message success">{notice}</div>}
        <button type="submit" className="submit-btn" disabled={submitting}>
          {submitting ? "Sending..." : "Email reset link"}
        </button>
      </form>
      <button className="back-button" onClick={() => updateView("email-signin")}>Back to sign in</button>
    </div>
  );

  return (
    <div className="page-container">
      {view === "welcome" && renderWelcomeScreen()}
      {view === "signup" && renderSignupScreen()}
        {(view === "email-signin" || view === "email-signup") &&
        renderEmailForm(view === "email-signin" ? "Sign in with email" : "Sign up with email")}
      {view === "verify-email" && renderVerifyForm()}
      {view === "forgot-password" && renderForgotForm()}
    </div>
  );
};

export default Login;