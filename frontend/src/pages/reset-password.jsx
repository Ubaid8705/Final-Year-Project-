import React, { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { API_BASE_URL } from "../config";
import "./login.css";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  const token = searchParams.get("token") || "";

  useEffect(() => {
    if (!token) {
      setError("Reset link is missing or invalid");
    }
  }, [token]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setNotice("");

    if (!token) {
      setError("Reset link is missing or invalid");
      return;
    }

    if (!password.trim() || !confirmPassword.trim()) {
      setError("Enter and confirm your new password");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: password }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.error || "Unable to reset password");
      }

      setNotice(payload?.message || "Password reset successfully. Redirecting to sign in...");
      setPassword("");
      setConfirmPassword("");

      setTimeout(() => navigate("/login"), 2200);
    } catch (resetError) {
      setError(resetError.message || "Unable to reset password");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-container">
      <div className="auth-container">
        <div className="auth-header">
          <div className="auth-icon">🔑</div>
          <h1>Create a new password</h1>
          <p className="auth-subheading">
            Choose a strong password to protect your account.
          </p>
        </div>
        <form onSubmit={handleSubmit}>
          <label>New password</label>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter new password"
            autoComplete="new-password"
            required
            disabled={!token}
          />
          <label>Confirm password</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="Re-enter new password"
            autoComplete="new-password"
            required
            disabled={!token}
          />
          {error && <div className="status-message error">{error}</div>}
          {notice && <div className="status-message success">{notice}</div>}
          <button type="submit" className="submit-btn" disabled={submitting || !token}>
            {submitting ? "Updating..." : "Update password"}
          </button>
        </form>
        <div className="auth-footer">
          <p>
            Remembered your password? <Link to="/login">Return to sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
