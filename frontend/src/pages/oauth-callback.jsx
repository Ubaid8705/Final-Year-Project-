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
    if (
      typeof window !== "undefined" &&
      typeof window.requestAnimationFrame === "function"
    ) {
      window.requestAnimationFrame(() => {
        navigate("/", { replace: true });
      });
    } else {
      setTimeout(() => {
        navigate("/", { replace: true });
      }, 0);
    }

    setTimeout(() => {
      if (typeof window !== "undefined" && window.location.pathname !== "/") {
        window.location.replace("/");
      }
    }, 600);
  }, [navigate]);

  //eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    let isMounted = true;

    if (processedSearchRef.current === location.search) {
      return undefined;
    }

    processedSearchRef.current = location.search;

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

      console.log("Parsed OAuth user:", parsedUser);

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
        console.log("OAuth login completed successfully");
        triggerRedirect();
      }
    };

    processOAuth();

    return () => {
      isMounted = false;
    };
  }, [location.search, completeOAuthLogin, triggerRedirect]);

  useEffect(() => {
    if (redirectRef.current) {
      return;
    }

    if (status !== "success") {
      return;
    }

    if (loading) {
      return;
    }

    if (user && token) {
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
