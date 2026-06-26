
import { BrowserRouter, Routes, Route } from "react-router-dom";
import HomePage from "./pages/HomePage";
import AdminPage from "./pages/AdminPage";
import ArticlePage from "./pages/ArticlePage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/article/:id" element={<ArticlePage />} />
        <Route path={process.env.REACT_APP_ADMIN_PATH || '/manage-news-2024'} element={<AdminPage />} />
      </Routes>
    </BrowserRouter>
  );
}