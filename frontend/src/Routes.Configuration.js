import React, { useEffect, lazy, Suspense } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "./contexts/AuthContext";

// Lazy-load route components for code-splitting
const Login = lazy(() => import("./pages/login"));
const Settings = lazy(() => import("./pages/settings"));
const PostView = lazy(() => import("./pages/postview"));
const Write = lazy(() => import("./pages/write"));
const LandingPage = lazy(() => import("./pages/landingpage"));
const TopicsPage = lazy(() => import("./pages/topics"));
const AboutPage = lazy(() => import("./pages/about"));
const Profile = lazy(() => import("./pages/profile"));
const ProfileStories = lazy(() => import("./pages/profile-stories"));
const FollowersPage = lazy(() => import("./pages/connections").then((m) => ({ default: m.FollowersPage })));
const FollowingPage = lazy(() => import("./pages/connections").then((m) => ({ default: m.FollowingPage })));
const OAuthCallback = lazy(() => import("./pages/oauth-callback"));
const Notifications = lazy(() => import("./pages/notifications"));
const ResetPassword = lazy(() => import("./pages/reset-password"));
const TermsOfService = lazy(() => import("./pages/terms"));
const PlansPage = lazy(() => import("./pages/plans"));

// Protected Route wrapper component (uses auth context)
export function ProtectedRoute({ children }) {
  const { user, loading, token, isTokenExpired, logout } = useAuth();
  const sessionExpired = token ? isTokenExpired(token) : false;

  useEffect(() => {
    if (sessionExpired) {
      logout();
    }
  }, [sessionExpired, logout]);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (sessionExpired) {
    return <Navigate to="/login" replace />;
  }

  if (!user && token) {
    return <div>Finishing sign in...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

// Export routes as array for App.js mapping
export const routes = [
  { path: "/login", element: <Suspense fallback={<div>Loading...</div>}><Login /></Suspense> },
  { path: "/reset-password", element: <Suspense fallback={<div>Loading...</div>}><ResetPassword /></Suspense> },
  { path: "/oauth-callback", element: <Suspense fallback={<div>Loading...</div>}><OAuthCallback /></Suspense> },
  { path: "/about", element: <Suspense fallback={<div>Loading...</div>}><AboutPage /></Suspense> },
  { path: "/terms", element: <Suspense fallback={<div>Loading...</div>}><TermsOfService /></Suspense> },
  { path: "/plans", element: <Suspense fallback={<div>Loading...</div>}><PlansPage /></Suspense> },
  {
    path: "/",
      element: (
      <ProtectedRoute>
        <Suspense fallback={<div>Loading...</div>}><LandingPage /></Suspense>
      </ProtectedRoute>
    ),
  },
  {
    path: "/topics",
      element: (
      <ProtectedRoute>
        <Suspense fallback={<div>Loading...</div>}><TopicsPage /></Suspense>
      </ProtectedRoute>
    ),
  },
  {
    path: "/settings",
      element: (
      <ProtectedRoute>
        <Suspense fallback={<div>Loading...</div>}><Settings /></Suspense>
      </ProtectedRoute>
    ),
  },
  {
    path: "/profile",
      element: (
      <ProtectedRoute>
        <Suspense fallback={<div>Loading...</div>}><Profile /></Suspense>
      </ProtectedRoute>
    ),
  },
  {
    path: "/profile/stories",
      element: (
      <ProtectedRoute>
        <Suspense fallback={<div>Loading...</div>}><ProfileStories /></Suspense>
      </ProtectedRoute>
    ),
  },
  {
    path: "/profile/followers",
    element: (
      <ProtectedRoute>
        <Suspense fallback={<div>Loading...</div>}><FollowersPage /></Suspense>
      </ProtectedRoute>
    ),
  },
  {
    path: "/profile/following",
    element: (
      <ProtectedRoute>
        <Suspense fallback={<div>Loading...</div>}><FollowingPage /></Suspense>
      </ProtectedRoute>
    ),
  },
  {
    path: "/u/:username",
    element: (
      <ProtectedRoute>
        <Suspense fallback={<div>Loading...</div>}><Profile /></Suspense>
      </ProtectedRoute>
    ),
  },
  {
    path: "/u/:username/stories",
    element: (
      <ProtectedRoute>
        <Suspense fallback={<div>Loading...</div>}><ProfileStories /></Suspense>
      </ProtectedRoute>
    ),
  },
  {
    path: "/u/:username/followers",
    element: (
      <ProtectedRoute>
        <Suspense fallback={<div>Loading...</div>}><FollowersPage /></Suspense>
      </ProtectedRoute>
    ),
  },
  {
    path: "/u/:username/following",
    element: (
      <ProtectedRoute>
        <Suspense fallback={<div>Loading...</div>}><FollowingPage /></Suspense>
      </ProtectedRoute>
    ),
  },
  {
    path: "/notifications",
    element: (
      <ProtectedRoute>
        <Suspense fallback={<div>Loading...</div>}><Notifications /></Suspense>
      </ProtectedRoute>
    ),
  },
  {
    path: "/write",
    element: (
      <ProtectedRoute>
        <Suspense fallback={<div>Loading...</div>}><Write /></Suspense>
      </ProtectedRoute>
    ),
  },
  {
    path: "/post/:id",
    element: (
      <ProtectedRoute>
        <Suspense fallback={<div>Loading...</div>}><PostView /></Suspense>
      </ProtectedRoute>
    ),
  },
];
