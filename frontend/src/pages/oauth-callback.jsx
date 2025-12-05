import React, { useCallback, useEffect, useRef, useState } from "react";
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
  const { completeOAuthLogin, user, token, loading } = useAuth();
  const [status, setStatus] = useState("processing");
  const processedSearchRef = useRef(null);
  const redirectRef = useRef(false);

  const triggerRedirect = useCallback(() => {
    if (redirectRef.current) {
      return;
    }

    redirectRef.current = true;

    const fallbackNavigate = () => {
      try {
        navigate("/", { replace: true });
      } catch (error) {
        console.warn("SPA navigate fallback failed, forcing hard redirect", error);
      }
    };

    if (typeof window !== "undefined") {
      const targetUrl = `${window.location.origin}/`;
      // Ensure SPA navigation happens first so React Router updates immediately
      fallbackNavigate();
      // Then force a hard redirect to guarantee we land on the home feed
      window.location.replace(targetUrl);
    } else {
      fallbackNavigate();
    }
  }, [navigate]);

  //eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    let isMounted = true;

    if (processedSearchRef.current === location.search) {
      return () => {
        isMounted = false;
        processedSearchRef.current = null;
      };
    }

    processedSearchRef.current = location.search || "";

    const processOAuth = async () => {
      const params = new URLSearchParams(location.search);
      const tokenParam = params.get("token");
      const rawUser = params.get("user");

      if (!tokenParam || !rawUser) {
        if (isMounted) setStatus("error");
        return;
      }

      const parsedUser = parseUserParam(rawUser);
      if (!parsedUser) {
        if (isMounted) setStatus("error");
        return;
      }


      const result = await completeOAuthLogin({
        token: tokenParam,
        user: parsedUser,
      });

      if (result?.error) {
        if (isMounted) setStatus("error");
        return;
      }

      if (isMounted) {
        setStatus("success");
        triggerRedirect();
      }
    };

    processOAuth();

    return () => {
      isMounted = false;
      processedSearchRef.current = null;
    };
  }, [location.search, completeOAuthLogin, triggerRedirect]);

  useEffect(() => {
    if (redirectRef.current) {
      return;
    }

    if (loading) {
      return;
    }

    if (status === "error") {
      return;
    }

    if (user && token) {
      if (status !== "success") {
        setStatus("success");
      }
      triggerRedirect();
    }
  }, [status, loading, user, token, triggerRedirect]);

  return (
    <div
      className="page-container"
      style={{ textAlign: "center", padding: "80px 20px" }}
    >
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
