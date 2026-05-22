import React, { useEffect, useState } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import "../assets/css/login.css";

const API_VERIFY = "https://maritime-backend-0gib.onrender.com/api/user/forgot/verify-code/";
const API_RESEND = "https://maritime-backend-0gib.onrender.com/api/user/forgot/send-code/";

export default function UserVerifyOtp() {

  const navigate = useNavigate();

  const identifier = sessionStorage.getItem("user_reset_identifier") || "";

  const [code, setCode] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const COOLDOWN = 30;
  const [seconds, setSeconds] = useState(COOLDOWN);

  useEffect(() => {

    if (!identifier) {
      navigate("/user/forgot");
      return;
    }

    const timer = setInterval(() => {
      setSeconds((s) => (s > 0 ? s - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);

  }, [identifier, navigate]);

  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier);

  const handleVerify = async (e) => {

    e.preventDefault();

    setMsg("");
    setLoading(true);

    try {

      await axios.post(API_VERIFY, isEmail ? { email: identifier, code } : { username: identifier, code });

      sessionStorage.setItem("user_reset_code", code);

      navigate("/user/reset");

    } catch (err) {

      setMsg("Invalid or expired code.");

    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {

    if (seconds > 0) return;

    setSeconds(COOLDOWN);

    try {

      await axios.post(API_RESEND, isEmail ? { email: identifier } : { username: identifier });

      setMsg("New OTP sent.");

    } catch {

      setMsg("Unable to resend OTP.");

    }
  };

  return (
    <div className="login">

      <form onSubmit={handleVerify}>

        <h2>Verify OTP</h2>

        <p style={{ marginTop: -6, marginBottom: 12 }}>
          Enter the 6-digit OTP sent to <b>{identifier}</b>
        </p>

        <input
          type="text"
          placeholder="Enter OTP"
          maxLength={6}
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
            {seconds > 0 ? `Resend in ${seconds}s` : "Resend OTP"}
          </button>
        </div>

        {msg && <p className="info">{msg}</p>}

        <div style={{ marginTop: 12 }}>
          <Link to="/Userlogin">Back to Login</Link>
        </div>

      </form>

    </div>
  );
}