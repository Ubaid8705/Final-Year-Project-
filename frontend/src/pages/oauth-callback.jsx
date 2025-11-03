import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

const parseUserParam = (rawUser) => {
  let candidate = rawUser;

  for (let i = 0; i < 3; i += 1) {
    try {
      return JSON.parse(candidate);
    } catch (parseError) {
      try {
        candidate = decodeURIComponent(candidate);
      } catch (decodeError) {
        console.warn("Failed to decode OAuth user payload", decodeError);
        return null;
      }
    }
  }

  return null;
};

const OAuthCallback = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { completeOAuthLogin } = useAuth();
  const [status, setStatus] = useState("processing");

  useEffect(() => {
    let isMounted = true;

    const params = new URLSearchParams(location.search);
    const token = params.get("token");
    const rawUser = params.get("user");

    if (!token || !rawUser) {
      if (isMounted) {
        setStatus("error");
      }
      return;
    }

    const parsedUser = parseUserParam(rawUser);

    if (!parsedUser) {
      if (isMounted) {
        setStatus("error");
      }
      return;
    }

    const result = completeOAuthLogin({ token, user: parsedUser });

    if (result?.error) {
      if (isMounted) {
        setStatus("error");
      }
      return;
    }

    if (isMounted) {
      setStatus("success");
    }

    // Delay navigation a tick to ensure React processes context updates
    setTimeout(() => {
      navigate("/", { replace: true });
    }, 0);

    return () => {
      isMounted = false;
    };
  }, [location.search, completeOAuthLogin, navigate]);

  return (
    <div className="page-container" style={{ textAlign: "center", padding: "80px 20px" }}>
      {status === "processing" ? (
        <p>Signing you in...</p>
      ) : status === "success" ? (
        <p>Welcome back! Redirecting…</p>
      ) : (
        <p>We couldn't complete your sign in. Please try again.</p>
      )}
    </div>
  );
};

export default OAuthCallback;
