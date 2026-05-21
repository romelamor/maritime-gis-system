import React, { useEffect, useState } from "react";
import {
  Anchor,
  ChevronRight,
  FileText,
  Menu,
  Phone,
  Shield,
  Users,
  Waves,
  X,
} from "lucide-react";
import "./about.css";

/* 🔥 SWIPER */
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation, Pagination, Autoplay } from "swiper/modules";

import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";

/* ================= HERO IMAGES ================= */
const heroImages = [
  "/assets/highlights1.jpg",
  "/assets/highlights2.jpg",
  "/assets/highlights7.jpg",
  "/assets/highlights4.jpg",
];

const navLinks = [
  { href: "#home", label: "Home" },
  { href: "#about", label: "About" },
  { href: "#services", label: "Services" },
  { href: "#contact", label: "Contact" },
];

const features = [
  {
    icon: <Anchor className="feature-icon" />,
    title: "Maritime Patrol",
    description:
      "24/7 coastal monitoring, interdiction, and visible patrol presence.",
    tag: "Sea Operations",
  },
  {
    icon: <Shield className="feature-icon" />,
    title: "Security Coverage",
    description:
      "Law-enforcement support across ports, shorelines, and maritime routes.",
    tag: "Public Safety",
  },
  {
    icon: <FileText className="feature-icon" />,
    title: "Digital Reporting",
    description:
      "Faster incident submission and coordinated records for response teams.",
    tag: "Incident Intake",
  },
  {
    icon: <Users className="feature-icon" />,
    title: "Community Support",
    description:
      "Partnership with coastal communities and inter-agency responders.",
    tag: "Citizen Service",
  },
];

const heroCards = [
  {
    icon: <Anchor className="card-icon" />,
    title: "Coastal Patrol",
    text: "Active monitoring for high-risk waters and shoreline zones.",
  },
  {
    icon: <Shield className="card-icon" />,
    title: "Joint Security",
    text: "Coordinated protection with maritime and law enforcement partners.",
  },
  {
    icon: <FileText className="card-icon" />,
    title: "Rapid Reporting",
    text: "Structured documentation to speed up response and investigation.",
  },
  {
    icon: <Users className="card-icon" />,
    title: "Public Assistance",
    text: "Visible, reliable service for fisherfolk, travelers, and communities.",
  },
];

const stats = [
  { value: "24/7", label: "Operations Readiness" },
  { value: "120+", label: "Personnel Support" },
  { value: "15+", label: "Station Coverage" },
  { value: "100%", label: "Service Commitment" },
];

const contactCards = [
  {
    icon: <Phone className="contact-icon-img" />,
    title: "Emergency Hotline",
    subtitle: "Available around the clock for maritime emergencies",
    value: "117",
    valueClass: "contact-number",
  },
  {
    icon: <Phone className="contact-icon-img" />,
    title: "Main Office",
    subtitle: "Office hours: 8:00 AM to 5:00 PM",
    value: "(02) 8723-0401",
    valueClass: "contact-number-alt",
  },
  {
    icon: <FileText className="contact-icon-img" />,
    title: "Online Report",
    subtitle:
      "Submit incidents and concerns through the digital reporting desk",
    action: "File Report",
  },
];

export default function LandingPage() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="maritime-page">
      {/* ================= NAV ================= */}
      <nav className={`navigation ${scrolled ? "scrolled" : ""}`}>
        <div className="nav-container">
          <div className="nav-content">
            <a href="#home" className="logo-section">
              <div className="logo-circle">
                <img
                  src="/assets/logo.png"
                  alt="PNP Maritime Logo"
                  className="logo-image"
                />
              </div>
              <div className="logo-text">
                <div className="logo-title">PNP National Police</div>
                <div className="logo-subtitle">Maritime Group</div>
              </div>
            </a>

            <div className="nav-menu-desktop">
              {navLinks.map((link) => (
                <a key={link.href} href={link.href} className="nav-link">
                  {link.label}
                </a>
              ))}
            </div>

            <button
              onClick={() => setIsMenuOpen((open) => !open)}
              className="mobile-menu-btn"
            >
              {isMenuOpen ? <X /> : <Menu />}
            </button>
          </div>

          {isMenuOpen && (
            <div className="nav-menu-mobile">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="nav-link-mobile"
                  onClick={() => setIsMenuOpen(false)}
                >
                  {link.label}
                </a>
              ))}
            </div>
          )}
        </div>
      </nav>

      {/* ================= HERO ================= */}
      <section id="home" className="hero-section">
        {/* 🔥 SWIPER SLIDER WITH ARROWS */}
        

        <div className="hero-overlay"></div>
        <div className="hero-pattern"></div>
        <div className="hero-glow hero-glow-left"></div>
        <div className="hero-glow hero-glow-right"></div>

        {/* ⬇️ LAHAT NG ORIGINAL CONTENT MO — HINDI GINALAW */}
        <div className="hero-container">
          <div className="hero-grid">
            <div className="hero-content">
              <div className="hero-badge">
                <Waves className="hero-badge-icon" />
                Maritime safety, response, and coordination
              </div>

              <h1 className="hero-title">
                Protecting Philippine Waters With
                <span className="hero-title-highlight">
                  {" "}
                  Visible, Modern Service
                </span>
              </h1>

              <p className="hero-subtitle">
                Bagong PNP para sa Bagong Pilipinas: serbisyong mabilis, tapat,
                at nararamdaman sa bawat coastal community.
              </p>

              <div className="hero-buttons">
                <a href="#about" className="btn-primary">
                  <span>Learn More</span>
                  <ChevronRight className="btn-icon" />
                </a>
                <a href="#contact" className="btn-secondary">
                  Contact Us
                </a>
              </div>
            </div>

            <div className="hero-panel">
              <div className="hero-panel-header">
                <span className="panel-kicker">Highlights</span>
                <h2 className="hero-panel-title">
                  Maritime Operations in Action
                </h2>
              </div>

              {/* 🔥 RIGHT SIDE CAROUSEL */}
              <div className="hero-carousel">
                <Swiper
                  modules={[Navigation, Pagination, Autoplay]}
                  navigation
                  pagination={{ clickable: true }}
                  autoplay={{ delay: 3500 }}
                  loop
                  className="hero-swiper"
                >
                  {heroImages.map((img, index) => (
                    <SwiperSlide key={index}>
                      <div
                        className="hero-carousel-slide"
                        style={{ backgroundImage: `url(${img})` }}
                      ></div>
                    </SwiperSlide>
                  ))}
                </Swiper>
              </div>


              <div className="hero-cards">
                {heroCards.map((card) => (
                  <div key={card.title} className="hero-card">
                    <div className="hero-card-icon">{card.icon}</div>
                    <h3 className="hero-card-title">{card.title}</h3>
                    <p className="hero-card-text">{card.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="services" className="services-section">
        <div className="section-container">
          <div className="section-header">
            <span className="section-eyebrow">Core Services</span>
            <h2 className="section-title">Built for maritime safety and fast response</h2>
            <p className="section-subtitle">
              A cleaner service overview that highlights readiness, reporting,
              enforcement, and public assistance.
            </p>
          </div>

          <div className="features-grid">
            {features.map((feature) => (
              <div key={feature.title} className="feature-card">
                <div className="feature-card-top">
                  <span className="feature-tag">{feature.tag}</span>
                  <div className="feature-icon-wrapper">{feature.icon}</div>
                </div>
                <h3 className="feature-title">{feature.title}</h3>
                <p className="feature-description">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="about" className="about-section">
        <div className="section-container">
          <div className="about-grid">
            <div className="about-content">
              <span className="section-eyebrow section-eyebrow-light">About The Group</span>
              <h2 className="about-title">A stronger maritime presence for safer communities</h2>
              <p className="about-text">
                The Philippine National Police Maritime Group helps maintain peace,
                order, and public safety across territorial waters, ports, and
                coastal areas through coordinated and visible operations.
              </p>
              <p className="about-text">
                By working with maritime agencies and local communities, the group
                strengthens incident response, law enforcement coverage, and public
                trust across the nation&apos;s maritime domain.
              </p>
              <ul className="about-list">
                <li className="about-list-item">
                  <ChevronRight className="list-icon" />
                  <span>24/7 maritime surveillance and patrol operations</span>
                </li>
                <li className="about-list-item">
                  <ChevronRight className="list-icon" />
                  <span>Anti-illegal fishing and law enforcement support</span>
                </li>
                <li className="about-list-item">
                  <ChevronRight className="list-icon" />
                  <span>Search, rescue, and coordinated emergency response</span>
                </li>
                <li className="about-list-item">
                  <ChevronRight className="list-icon" />
                  <span>Coastal community assistance and public service</span>
                </li>
              </ul>
            </div>

            <div className="stats-card">
              <div className="stats-card-head">
                <span className="panel-kicker panel-kicker-light">Readiness Snapshot</span>
                <h3 className="stats-title">Quick Statistics</h3>
              </div>
              <div className="stats-grid">
                {stats.map((stat) => (
                  <div key={stat.label} className="stat-item">
                    <div className="stat-number">{stat.value}</div>
                    <div className="stat-label">{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="contact" className="contact-section">
        <div className="section-container">
          <div className="section-header">
            <span className="section-eyebrow">Contact Desk</span>
            <h2 className="section-title">Reach the team when help is needed</h2>
            <p className="section-subtitle">
              Emergency and public-facing contact options are clearer and easier to scan.
            </p>
          </div>

          <div className="contact-grid">
            {contactCards.map((card) => (
              <div key={card.title} className="contact-card">
                <div className="contact-icon">{card.icon}</div>
                <h3 className="contact-title">{card.title}</h3>
                <p className="contact-subtitle">{card.subtitle}</p>
                {card.value ? (
                  <p className={card.valueClass}>{card.value}</p>
                ) : (
                  <a href="#contact" className="btn-report">
                    {card.action}
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="footer">
        <div className="footer-container">
          <div className="footer-grid">
            <div className="footer-brand">
              <div className="footer-logo">
                <div className="footer-logo-circle">
                  <img
                    src="/assets/logo.png"
                    alt="PNP Maritime Logo"
                    className="footer-logo-image"
                  />
                </div>
                <div className="footer-logo-text">
                  <div className="footer-logo-title">Philippine National Police</div>
                  <div className="footer-logo-subtitle">Maritime Group</div>
                </div>
              </div>
              <p className="footer-description">
                Protecting Philippine waters with discipline, readiness, and service.
              </p>
            </div>

            <div className="footer-links">
              <h4 className="footer-heading">Quick Links</h4>
              <ul className="footer-list">
                {navLinks.map((link) => (
                  <li key={link.href}>
                    <a href={link.href} className="footer-link">
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div className="footer-contact">
              <h4 className="footer-heading">Emergency Contact</h4>
              <p className="footer-hotline">
                24/7 Hotline: <span className="footer-hotline-number">117</span>
              </p>
              <p className="footer-contact-text">
                For maritime incidents, emergency response, and public assistance.
              </p>
            </div>
          </div>

          <div className="footer-bottom">
            <p>
              &copy; 2024 PNP Maritime Group. All rights reserved. Serving the
              Filipino people with honor and integrity.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}