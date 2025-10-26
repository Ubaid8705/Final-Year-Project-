import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Login from './pages/login';
import Settings from './pages/settings';
import PostView from './pages/postview';
import WriteBlog from './pages/writeblog';
import LandingPage from './pages/landingpage';
import Profile from './pages/profile';

// Protected Route wrapper component (uses auth context)
export function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div>Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

// Export routes as array for App.js mapping
export const routes = [
  { path: '/login', element: <Login /> },
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
  { path: '/write', element: (
      <ProtectedRoute>
        <WriteBlog />
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