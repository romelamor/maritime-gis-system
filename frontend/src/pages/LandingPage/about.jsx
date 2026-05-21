// import React from "react";
// import "./about.css";
// import Navbar from "./navbar";


// export default function About() {
//   return (
//     <div className="about-page">
//         <Navbar  />
//       <header className="about-hero">
//         <div className="about-container">
//           <h1>PNP Maritime CRMS</h1>
//           <p className="lead">
//             Isang secure at offline-capable Crime Record Management System na idinisenyo
//             para sa PNP Maritime region — nagpapadali ng incident reporting, nagbibigay
//             ng interactive maps at hotspot analysis, at nagpapalakas ng situational awareness.
//           </p>
//         </div>
//       </header>

//       <main className="about-container">
//         <section className="about-section">
//           <h2>Tungkol sa Sistema</h2>
//           <p>
//             Ang <strong>PNP Maritime Crime Record Management System (CRMS)</strong> ay isang
//             web-based na solusyon na naglalayong gawing mas mabilis, mas maayos, at mas ligtas
//             ang pag-uulat at pagmamanman ng mga insidente sa pantalan at baybayin. Nilalayon
//             nitong palitan ang manual at slide-based reporting ng sentralisadong sistema na may
//             offline support at awtomatikong synchronization kapag may koneksyon.
//           </p>
//         </section>

//         <section className="about-grid">
//           <article className="card">
//             <h3>Layunin ng Sistema</h3>
//             <ul>
//               <li>Magbigay ng standard at mabilis na paraan ng pag-record ng maritime incidents.</li>
//               <li>Mag-enable ng geospatial visualization at hotspot analysis.</li>
//               <li>Magbigay ng role-based access para sa security at accountability.</li>
//               <li>Mag-automate ng report generation (Excel/PDF) at backup para sa audit.</li>
//               <li>Magbigay ng offline-first functionality na nagsi-sync kapag may Internet.</li>
//             </ul>
//           </article>

//           <article className="card">
//             <h3>Pangunahing Tampok</h3>
//             <ul>
//               <li>Offline-first incident reporting</li>
//               <li>Interactive maps at pin-drop reporting (Leaflet.js)</li>
//               <li>Geospatial hotspot analysis (PostGIS)</li>
//               <li>Role-based access & audit logs</li>
//               <li>Modal-based CRUD para sa personnel & incidents</li>
//               <li>Automated exports (Excel / PDF)</li>
//             </ul>
//           </article>
//         </section>

//         <section className="about-section">
//           <h2>Benepisyo</h2>
//           <p>
//             Nagbibigay ang CRMS ng mas mabilis at mas accurate na data collection, pinapadali
//             ang coordination sa pagitan ng stations at regional offices, at nagpapalakas ng
//             kapasidad para sa mabilis na pag-aanalisa at pag-deploy ng resources.
//           </p>
//         </section>

//         <section className="about-section contact-cta">
//           <h3>Interesado sa demo o deployment?</h3>
//           <p>Magtanong o mag-schedule ng walkthrough:</p>
//           <p className="muted"><strong>Email:</strong> admin@example.com • <strong>Phone:</strong> +63 912 345 6789</p>
//           <div className="cta-row">
//             <a className="btn primary" href="/LPContact">Request Demo</a>
//             <a className="btn ghost" href="/LPServices">Learn more</a>
//           </div>
//         </section>
//       </main>
//     </div> 
//   );
// }

import React, { useState, useEffect } from 'react';
import { Anchor, Shield, Users, FileText, Phone, Menu, X, ChevronRight } from 'lucide-react';
import './about.css';

export default function About() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const features = [
    {
      icon: <Anchor className="feature-icon" />,
      title: "MARITIME PATROL",
      description: "24/7 coastal and sea surveillance operations"
    },
    {
      icon: <Shield className="feature-icon" />,
      title: "COMPREHENSIVE SECURITY",
      description: "Full maritime law enforcement coverage"
    },
    {
      icon: <FileText className="feature-icon" />,
      title: "CONVENIENT REPORTING",
      description: "Easy online incident reporting system"
    },
    {
      icon: <Users className="feature-icon" />,
      title: "RELIABLE SERVICE",
      description: "Dedicated and professional maritime officers"
    }
  ];

  return (
    <div className="maritime-page">
      {/* Navigation */}
      <nav className={`navigation ${scrolled ? 'scrolled' : ''}`}>
        <div className="nav-container">
          <div className="nav-content">
            <div className="logo-section">
              <div className="logo-circle">
                <Shield className="logo-icon" />
              </div>
              <div className="logo-text">
                <div className="logo-title">PNP</div>
                <div className="logo-subtitle">MARITIME POLICE</div>
              </div>
            </div>

            {/* Desktop Menu */}
            <div className="nav-menu-desktop">
              <a href="#home" className="nav-link">Home</a>
              <a href="#about" className="nav-link">About</a>
              <a href="#crime-maps" className="nav-link">Crime Maps</a>
              <a href="#services" className="nav-link">Services</a>
              <a href="#contact" className="nav-link">Contact</a>
            </div>

            {/* Mobile Menu Button */}
            <button 
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="mobile-menu-btn"
            >
              {isMenuOpen ? <X className="menu-icon" /> : <Menu className="menu-icon" />}
            </button>
          </div>

          {/* Mobile Menu */}
          {isMenuOpen && (
            <div className="nav-menu-mobile">
              <a href="#home" className="nav-link-mobile">Home</a>
              <a href="#about" className="nav-link-mobile">About</a>
              <a href="#crime-maps" className="nav-link-mobile">Crime Maps</a>
              <a href="#services" className="nav-link-mobile">Services</a>
              <a href="#contact" className="nav-link-mobile">Contact</a>
            </div>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <section id="home" className="hero-section">
        <div className="hero-overlay"></div>
        <div className="hero-pattern"></div>
        
        <div className="hero-container">
          <div className="hero-grid">
            <div className="hero-content">
              <h1 className="hero-title">
                PHILIPPINE NATIONAL POLICE<br />
                <span className="hero-title-highlight">MARITIME GROUP</span>
              </h1>
              <p className="hero-subtitle">
                "Pagong PNP para sa Segundo Pilipinas<br />
                Serbisyong Mabilist, Tapat at Nararamdaman"
              </p>
              <div className="hero-buttons">
                <button className="btn-primary">
                  <span>Learn More</span>
                  <ChevronRight className="btn-icon" />
                </button>
                <button className="btn-secondary">
                  Contact Us
                </button>
              </div>
            </div>

            <div className="hero-cards">
              <div className="hero-card">
                <div className="hero-card-icon">
                  <Anchor className="card-icon" />
                </div>
                <h3 className="hero-card-title">Coast Guard Coordination</h3>
                <p className="hero-card-text">Joint operations with PCG</p>
              </div>
              <div className="hero-card">
                <div className="hero-card-icon">
                  <Shield className="card-icon" />
                </div>
                <h3 className="hero-card-title">Navy Partnership</h3>
                <p className="hero-card-text">Collaborative maritime security</p>
              </div>
              <div className="hero-card">
                <div className="hero-card-icon">
                  <FileText className="card-icon" />
                </div>
                <h3 className="hero-card-title">Comprehensive Security</h3>
                <p className="hero-card-text">Complete maritime coverage</p>
              </div>
              <div className="hero-card">
                <div className="hero-card-icon">
                  <Users className="card-icon" />
                </div>
                <h3 className="hero-card-title">Reliable Service</h3>
                <p className="hero-card-text">24/7 maritime protection</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="services" className="services-section">
        <div className="section-container">
          <div className="section-header">
            <h2 className="section-title">Our Core Services</h2>
            <p className="section-subtitle">Protecting Philippine waters with excellence</p>
          </div>

          <div className="features-grid">
            {features.map((feature, index) => (
              <div key={index} className="feature-card">
                <div className="feature-icon-wrapper">{feature.icon}</div>
                <h3 className="feature-title">{feature.title}</h3>
                <p className="feature-description">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="about-section">
        <div className="section-container">
          <div className="about-grid">
            <div className="about-content">
              <h2 className="about-title">About PNP Maritime Group</h2>
              <p className="about-text">
                The Philippine National Police Maritime Group is dedicated to maintaining peace, order, and safety in Philippine territorial waters. We work tirelessly to protect our maritime communities and ensure the security of our coastal areas.
              </p>
              <p className="about-text">
                Through coordinated efforts with other maritime agencies, we provide comprehensive law enforcement services across all Philippine waters, ensuring the safety and security of our nation's maritime domain.
              </p>
              <ul className="about-list">
                <li className="about-list-item">
                  <ChevronRight className="list-icon" />
                  <span>24/7 Maritime Surveillance Operations</span>
                </li>
                <li className="about-list-item">
                  <ChevronRight className="list-icon" />
                  <span>Anti-Illegal Fishing Enforcement</span>
                </li>
                <li className="about-list-item">
                  <ChevronRight className="list-icon" />
                  <span>Maritime Search and Rescue</span>
                </li>
                <li className="about-list-item">
                  <ChevronRight className="list-icon" />
                  <span>Coastal Community Support</span>
                </li>
              </ul>
            </div>
            <div className="stats-card">
              <h3 className="stats-title">Quick Statistics</h3>
              <div className="stats-grid">
                <div className="stat-item">
                  <div className="stat-number">24/7</div>
                  <div className="stat-label">Operations</div>
                </div>
                <div className="stat-item">
                  <div className="stat-number">100%</div>
                  <div className="stat-label">Commitment</div>
                </div>
                <div className="stat-item">
                  <div className="stat-number">1000+</div>
                  <div className="stat-label">Personnel</div>
                </div>
                <div className="stat-item">
                  <div className="stat-number">50+</div>
                  <div className="stat-label">Stations</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="contact-section">
        <div className="section-container">
          <div className="section-header">
            <h2 className="section-title">Contact Us</h2>
            <p className="section-subtitle">We're here to serve and protect</p>
          </div>

          <div className="contact-grid">
            <div className="contact-card">
              <div className="contact-icon">
                <Phone className="contact-icon-img" />
              </div>
              <h3 className="contact-title">Emergency Hotline</h3>
              <p className="contact-subtitle">Available 24/7</p>
              <p className="contact-number">117</p>
            </div>

            <div className="contact-card">
              <div className="contact-icon">
                <Phone className="contact-icon-img" />
              </div>
              <h3 className="contact-title">Main Office</h3>
              <p className="contact-subtitle">Business Hours: 8AM - 5PM</p>
              <p className="contact-number-alt">(02) 8723-0401</p>
            </div>

            <div className="contact-card">
              <div className="contact-icon">
                <FileText className="contact-icon-img" />
              </div>
              <h3 className="contact-title">Online Report</h3>
              <p className="contact-subtitle">Submit incident reports online</p>
              <button className="btn-report">File Report</button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="footer-container">
          <div className="footer-grid">
            <div className="footer-brand">
              <div className="footer-logo">
                <div className="footer-logo-circle">
                  <Shield className="footer-logo-icon" />
                </div>
                <div className="footer-logo-text">
                  <div className="footer-logo-title">PNP</div>
                  <div className="footer-logo-subtitle">MARITIME POLICE</div>
                </div>
              </div>
              <p className="footer-description">
                Protecting Philippine waters with dedication and excellence.
              </p>
            </div>

            <div className="footer-links">
              <h4 className="footer-heading">Quick Links</h4>
              <ul className="footer-list">
                <li><a href="#home" className="footer-link">Home</a></li>
                <li><a href="#about" className="footer-link">About Us</a></li>
                <li><a href="#services" className="footer-link">Services</a></li>
                <li><a href="#contact" className="footer-link">Contact</a></li>
              </ul>
            </div>

            <div className="footer-contact">
              <h4 className="footer-heading">Emergency Contact</h4>
              <p className="footer-hotline">24/7 Hotline: <span className="footer-hotline-number">117</span></p>
              <p className="footer-contact-text">
                For maritime emergencies and incidents
              </p>
            </div>
          </div>

          <div className="footer-bottom">
            <p>&copy; 2024 PNP Maritime Group. All rights reserved. | Serving the Filipino people with honor and integrity.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}