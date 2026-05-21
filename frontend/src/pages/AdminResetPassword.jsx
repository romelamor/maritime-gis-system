import React, { useEffect, useState } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import "../assets/css/login.css";

/**
 * API CONTRACT:
 * POST http://localhost:8000/api/admin/forgot/reset-password/
 *  Body: { email, code, new_password }
 *  Resp: { message: "Password updated" }
 */
const API_RESET = "http://localhost:8000/api/admin/forgot/reset-password/";

export default function AdminResetPassword() {
  const navigate = useNavigate();
  const email = sessionStorage.getItem("admin_reset_email") || "";
  const code = sessionStorage.getItem("admin_reset_code") || "";

  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // require email & verified code
    if (!email || !code) navigate("/admin/forgot");
  }, [email, code, navigate]);

  const handleReset = async (e) => {
    e.preventDefault();
    setMsg("");

    if (pw1.length < 8) {
      setMsg("Password must be at least 8 characters.");
      return;
    }
    if (pw1 !== pw2) {
      setMsg("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await axios.post(API_RESET, { email, code, new_password: pw1 });

      // cleanup flow state
      sessionStorage.removeItem("admin_reset_email");
      sessionStorage.removeItem("admin_reset_code");

      setMsg("Password updated! You can now login.");
      // small delay then go back to login
      setTimeout(() => navigate("/Login"), 900);
    } catch (err) {
      setMsg("Reset failed. Invalid/expired code or server error.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login">
      <form onSubmit={handleReset}>
        <h2>Set New Password</h2>

        <input
          type="password"
          placeholder="New password (min 8 chars)"
          value={pw1}
          onChange={(e) => setPw1(e.target.value)}
          required
        />

        <input
          type="password"
          placeholder="Confirm new password"
          value={pw2}
          onChange={(e) => setPw2(e.target.value)}
          required
        />

        <button type="submit" disabled={loading}>
          {loading ? "Updating..." : "Update Password"}
        </button>

        {msg && <p className="info">{msg}</p>}

        <div style={{ marginTop: 12 }}>
          <Link to="/Login">Back to Login</Link>
        </div>
      </form>
    </div>
  );
}
