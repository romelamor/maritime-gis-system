import React, { useState } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import "../assets/css/login.css";

/**
 * API CONTRACT (adjust if your backend differs):
 * POST http://localhost:8000/api/admin/forgot/send-code/
 *  Body: { email }
 *  Resp: { message: "OTP sent" } or 404 if not found (or generic message)
 */
const API_SEND = "http://localhost:8000/api/admin/forgot/send-code/";

export default function AdminForgotPassword() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSend = async (e) => {
    e.preventDefault();
    setMsg("");
    setLoading(true);
    try {
      await axios.post(API_SEND, { email });
      // Store email for the next steps
      sessionStorage.setItem("admin_reset_email", email);
      setMsg("If your email exists, an OTP has been sent to your inbox.");
      // proceed to verify page
      navigate("/admin/verify");
    } catch (err) {
      // Generic message to avoid revealing if email exists or not
      setMsg("If your email exists, an OTP has been sent to your inbox.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login">
      <form onSubmit={handleSend}>
        <h2>Forgot Password</h2>
        <p style={{ marginTop: -6, marginBottom: 12 }}>
          Enter your registered email. We’ll send a 6-digit OTP.
        </p>

        <input
          type="email"
          placeholder="your_email@gmail.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <button type="submit" disabled={loading}>
          {loading ? "Sending..." : "Send OTP"}
        </button>

        {msg && <p className="info">{msg}</p>}

        <div style={{ marginTop: 12 }}>
          <Link to="/Login">Back to Login</Link>
        </div>
      </form>
    </div>
  );
}
