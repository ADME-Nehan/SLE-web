import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import HomePage from "./pages/HomePage";
import AdminPage from "./pages/AdminPage";
import ArticlePage from "./pages/ArticlePage";

const ADMIN_PATH = process.env.REACT_APP_ADMIN_PATH || "/admin";

export default function App() {
  return (
    <BrowserRouter>

      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/article/:id" element={<ArticlePage />} />
        <Route path={ADMIN_PATH} element={<AdminPage />} />

        {/* Optional: old /admin redirects to new hidden admin path */}
        <Route path="/admin" element={<Navigate to={ADMIN_PATH} replace />} />
      </Routes>
    </BrowserRouter>
  );
}