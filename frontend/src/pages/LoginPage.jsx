import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { adminLogin, getApiError } from "../utils/api";
import { saveAdminToken } from "../utils/auth";

export default function LoginPage() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    username: "",
    password: ""
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function updateForm(field, value) {
    setForm((prev) => ({
      ...prev,
      [field]: value
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();

    setError("");
    setLoading(true);

    try {
      const res = await adminLogin(form);

      saveAdminToken(res.data.token);

      navigate("/admin", {
        replace: true
      });
    } catch (err) {
      setError(getApiError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <Navbar />

      <main className="login-page">
        <section className="card login-card">
          <div className="hero-kicker">Admin Login</div>
          <h1>SLE Control Access</h1>
          <p>Login to manage RSS sources, Top News, and dashboard data.</p>

          {error ? <div className="message-box error">{error}</div> : null}

          <form className="login-form" onSubmit={handleSubmit}>
            <label>
              Username
              <input
                required
                value={form.username}
                onChange={(e) => updateForm("username", e.target.value)}
                placeholder="admin"
              />
            </label>

            <label>
              Password
              <input
                required
                type="password"
                value={form.password}
                onChange={(e) => updateForm("password", e.target.value)}
                placeholder="Enter password"
              />
            </label>

            <button className="btn btn-primary" type="submit" disabled={loading}>
              {loading ? "Logging in..." : "Login"}
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}