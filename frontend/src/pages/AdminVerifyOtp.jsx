import React, { useEffect, useState } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import "../assets/css/login.css";

/**
 * API CONTRACT:
 * POST http://localhost:8000/api/admin/forgot/verify-code/
 *  Body: { email, code }
 *  Resp: { message: "OK" }
 *
 * POST http://localhost:8000/api/admin/forgot/send-code/
 *  Body: { email }
 *  Resp: { message: "OTP sent" }
 */
const API_VERIFY = "http://localhost:8000/api/admin/forgot/verify-code/";
const API_RESEND = "http://localhost:8000/api/admin/forgot/send-code/";

export default function AdminVerifyOtp() {
  const navigate = useNavigate();
  const email = sessionStorage.getItem("admin_reset_email") || "";
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  // resend cooldown
  const COOLDOWN = 30;
  const [seconds, setSeconds] = useState(COOLDOWN);

  useEffect(() => {
    if (!email) {
      navigate("/admin/forgot");
      return;
    }
    const t = setInterval(() => setSeconds((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [email, navigate]);

  const handleVerify = async (e) => {
    e.preventDefault();
    if (!email) return;
    setMsg("");
    setLoading(true);
    try {
      await axios.post(API_VERIFY, { email, code });
      // store the code for reset step (simple approach)
      sessionStorage.setItem("admin_reset_code", code);
      navigate("/admin/reset");
    } catch (err) {
      setMsg("Invalid or expired code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!email || seconds > 0) return;
    setMsg("");
    setSeconds(COOLDOWN);
    try {
      await axios.post(API_RESEND, { email });
      setMsg("A new OTP was sent to your email.");
    } catch (err) {
      setMsg("Unable to resend now. Please try again later.");
    }
  };

  return (
    <div className="login">
      <form onSubmit={handleVerify}>
        <h2>Verify OTP</h2>
        <p style={{ marginTop: -6, marginBottom: 12 }}>
          We sent a 6-digit code to <b>{email}</b>.
        </p>

        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]{6}"
          maxLength={6}
          placeholder="Enter 6-digit code"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          required
        />

        <button type="submit" disabled={loading}>
          {loading ? "Verifying..." : "Verify"}
        </button>

        <div style={{ marginTop: 10 }}>
          <button
            type="button"
            onClick={handleResend}
            disabled={seconds > 0}
            style={{ opacity: seconds > 0 ? 0.6 : 1 }}
          >
            {seconds > 0 ? `Resend in ${seconds}s` : "Resend code"}
          </button>
        </div>

        {msg && <p className="info">{msg}</p>}

        <div style={{ marginTop: 12 }}>
          <Link to="/Login">Back to Login</Link>
        </div>
      </form>
    </div>
  );
}
