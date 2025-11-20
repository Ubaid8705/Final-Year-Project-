import React, { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "./contexts/AuthContext";
import Login from "./pages/login";
import Settings from "./pages/settings";
import PostView from "./pages/postview";
import Write from "./pages/write";
import LandingPage from "./pages/landingpage";
import TopicsPage from "./pages/topics";
import AboutPage from "./pages/about";
import Profile from "./pages/profile";
import ProfileStories from "./pages/profile-stories";
import { FollowersPage, FollowingPage } from "./pages/connections";
import OAuthCallback from "./pages/oauth-callback";
import Notifications from "./pages/notifications";
import ResetPassword from "./pages/reset-password";
import TermsOfService from "./pages/terms";
import PlansPage from "./pages/plans";

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
  { path: "/login", element: <Login /> },
  { path: "/reset-password", element: <ResetPassword /> },
  { path: "/oauth-callback", element: <OAuthCallback /> },
  { path: "/about", element: <AboutPage /> },
  { path: "/terms", element: <TermsOfService /> },
  { path: "/plans", element: <PlansPage /> },
  {
    path: "/",
    element: (
      <ProtectedRoute>
        <LandingPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/topics",
    element: (
      <ProtectedRoute>
        <TopicsPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/settings",
    element: (
      <ProtectedRoute>
        <Settings />
      </ProtectedRoute>
    ),
  },
  {
    path: "/profile",
    element: (
      <ProtectedRoute>
        <Profile />
      </ProtectedRoute>
    ),
  },
  {
    path: "/profile/stories",
    element: (
      <ProtectedRoute>
        <ProfileStories />
      </ProtectedRoute>
    ),
  },
  {
    path: "/profile/followers",
    element: (
      <ProtectedRoute>
        <FollowersPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/profile/following",
    element: (
      <ProtectedRoute>
        <FollowingPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/u/:username",
    element: (
      <ProtectedRoute>
        <Profile />
      </ProtectedRoute>
    ),
  },
  {
    path: "/u/:username/stories",
    element: (
      <ProtectedRoute>
        <ProfileStories />
      </ProtectedRoute>
    ),
  },
  {
    path: "/u/:username/followers",
    element: (
      <ProtectedRoute>
        <FollowersPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/u/:username/following",
    element: (
      <ProtectedRoute>
        <FollowingPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/notifications",
    element: (
      <ProtectedRoute>
        <Notifications />
      </ProtectedRoute>
    ),
  },
  {
    path: "/write",
    element: (
      <ProtectedRoute>
        <Write />
      </ProtectedRoute>
    ),
  },
  {
    path: "/post/:id",
    element: (
      <ProtectedRoute>
        <PostView />
      </ProtectedRoute>
    ),
  },
];
