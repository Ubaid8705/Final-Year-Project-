import React, { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Login from './pages/login';
import Settings from './pages/settings';
import PostView from './pages/postview';
import Write from './pages/write';
import LandingPage from './pages/landingpage';
import Profile from './pages/profile';
import OAuthCallback from './pages/oauth-callback';
import Notifications from './pages/notifications';

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
  { path: '/login', element: <Login /> },
  { path: '/auth/callback', element: <OAuthCallback /> },
  { path: '/', element: (
      <ProtectedRoute>
        <LandingPage />
      </ProtectedRoute>
    )
  },
  { path: '/settings', element: (
      <ProtectedRoute>
        <Settings />
      </ProtectedRoute>
    )
  },
  { path: '/profile', element: (
      <ProtectedRoute>
        <Profile />
      </ProtectedRoute>
    )
  },
  { path: '/notifications', element: (
      <ProtectedRoute>
        <Notifications />
      </ProtectedRoute>
    )
  },
  { path: '/write', element: (
      <ProtectedRoute>
        <Write />
      </ProtectedRoute>
    )
  },
  { path: '/post/:id', element: (
      <ProtectedRoute>
        <PostView />
      </ProtectedRoute>
    )
  },
];