import React, { useState } from 'react';
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import './login.css';

const Login = () => {
 const [view, setView] = useState("welcome"); // welcome, signin, signup, email-signin, email-signup
  const [email, setEmail] = useState("");
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    if (view === "email-signin" || view === "email-signup") {
      const ok = await login({ email });
      if (ok) {
        // redirect to protected area (adjust path as needed)
        navigate("/");
      } else {
        // show error (replace with UI)
        alert("Login failed");
      }
    }
  };

  const renderEmailForm = (title) => (
    <div className="auth-container">
      <div className="auth-header">
        <div className="auth-icon">✉️</div>
        <h1>{title}</h1>
      </div>
      <form onSubmit={handleEmailSubmit}>
        <label>Your email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Enter your email address"
        />
        <button type="submit" className="submit-btn">
          {view === 'email-signup' ? 'Create account' : 'Continue'}
        </button>
      </form>
      <button 
        className="back-button"
        onClick={() => setView(view.includes('signup') ? 'signup' : 'welcome')}
      >
        Back to sign {view.includes('signup') ? 'up' : 'in'} options
      </button>
      {view === 'email-signup' && (
        <div className="auth-footer">
          <p>Already have an account? <button onClick={() => setView('welcome')}>Sign in</button></p>
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
        <button className="social-btn google">
          <img src="/google-icon.png" alt="" /> Sign in with Google
        </button>
        <button className="social-btn facebook">
          <img src="/facebook-icon.png" alt="" /> Sign in with Facebook
        </button>
        <button
          className="email-btn"
          onClick={() => setView("email-signin")}
        >
          <span>✉️</span> Sign in with email
        </button>
      </div>
      <p className="auth-footer">
        No account? <button onClick={() => setView("signup")}>Create one</button>
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
        <button className="social-btn google">
          <img src="/google-icon.png" alt="" /> Sign up with Google
        </button>
        <button className="social-btn facebook">
          <img src="/facebook-icon.png" alt="" /> Sign up with Facebook
        </button>
        <button 
          className="email-btn"
          onClick={() => setView('email-signup')}
        >
          <span>✉️</span> Sign up with email
        </button>
      </div>
      <p className="auth-footer">
        Already have an account? <button onClick={() => setView('welcome')}>Sign in</button>
      </p>
    </div>
  );

 return (
    <div className="page-container">
      {view === "welcome" && renderWelcomeScreen()}
      {view === "signup" && renderSignupScreen()}
      {(view === "email-signin" || view === "email-signup") &&
        renderEmailForm(view === "email-signin" ? "Sign in with email" : "Sign up with email")}
    </div>
  );
};

export default Login;