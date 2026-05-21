import React, { useEffect, useState } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import "../assets/css/login.css";

const API_RESET = "http://localhost:8000/api/user/forgot/reset-password/";

export default function UserResetPassword() {

  const navigate = useNavigate();

  const identifier = sessionStorage.getItem("user_reset_identifier") || "";
  const code = sessionStorage.getItem("user_reset_code") || "";

  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {

    if (!identifier || !code) {
      navigate("/user/forgot");
    }

  }, [identifier, code, navigate]);

  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier);

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

      await axios.post(API_RESET,
        isEmail
          ? { email: identifier, code, new_password: pw1 }
          : { username: identifier, code, new_password: pw1 }
      );

      sessionStorage.removeItem("user_reset_identifier");
      sessionStorage.removeItem("user_reset_code");

      setMsg("Password updated successfully.");

      setTimeout(() => navigate("/Userlogin"), 1000);

    } catch {

      setMsg("Reset failed. Invalid or expired code.");

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
          placeholder="New password"
          value={pw1}
          onChange={(e) => setPw1(e.target.value)}
          required
        />

        <input
          type="password"
          placeholder="Confirm password"
          value={pw2}
          onChange={(e) => setPw2(e.target.value)}
          required
        />

        <button type="submit" disabled={loading}>
          {loading ? "Updating..." : "Update Password"}
        </button>

        {msg && <p className="info">{msg}</p>}

        <div style={{ marginTop: 12 }}>
          <Link to="/Userlogin">Back to Login</Link>
        </div>

      </form>

    </div>
  );
}