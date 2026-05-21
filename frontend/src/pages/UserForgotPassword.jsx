import React, { useState } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import "../assets/css/login.css";

const API_SEND = "http://localhost:8000/api/user/forgot/send-code/";

export default function UserForgotPassword() {

  const [identifier, setIdentifier] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const handleSend = async (e) => {
    e.preventDefault();

    setMsg("");
    setLoading(true);

    try {

      const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier);

      await axios.post(API_SEND, isEmail ? { email: identifier } : { username: identifier });

      sessionStorage.setItem("user_reset_identifier", identifier);

      setMsg("If the account exists, an OTP has been sent.");

      navigate("/user/verify");

    } catch (err) {

      setMsg("If the account exists, an OTP has been sent.");

    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login">

      <form onSubmit={handleSend}>

        <h2>User Forgot Password</h2>

        <p style={{ marginTop: -6, marginBottom: 12 }}>
          Enter your email or username to receive OTP.
        </p>

        <input
          type="text"
          placeholder="Email or Username"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          required
        />

        <button type="submit" disabled={loading}>
          {loading ? "Sending..." : "Send OTP"}
        </button>

        {msg && <p className="info">{msg}</p>}

        <div style={{ marginTop: 12 }}>
          <Link to="/Userlogin">Back to Login</Link>
        </div>

      </form>

    </div>
  );
}