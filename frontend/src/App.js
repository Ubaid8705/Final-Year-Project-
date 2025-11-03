import React from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import Header from "./Components/header";
import { routes } from "./Routes.Configuration";

function AppRouter() {
  const location = useLocation();
  const hideHeader = ["/login", "/auth/callback"].includes(location.pathname);

  return (
    <>
      {!hideHeader && <Header />}
      <Routes>
        {routes.map((r) => (
          <Route key={r.path} path={r.path} element={r.element} />
        ))}
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRouter />
    </BrowserRouter>
  );
}