import React from "react";
import { Link } from "react-router-dom";
import "./navbar.css";

export default function Navbar() {
  return (
    <nav className="navbar-top">
      <div className="navbar-brand">My System</div>
      <ul className="navbar-menu">

        <li><Link to="/LPHome">Home</Link></li>
        <li><Link to="/LPAbout">About</Link></li>
        <li><Link to="/LPCrime">Crime Maps</Link></li>
        <li><Link to="/LPServices">Services</Link></li>
        <li><Link to="/LPContact">Contact</Link></li>

      </ul>
    </nav>
  );
}
