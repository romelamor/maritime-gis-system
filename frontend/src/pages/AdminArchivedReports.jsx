// src/pages/ArchivedReports.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import "../assets/css/dashboard.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faHome,
  faUser,
  faFileInvoice,
  faMapLocation,
  faChartLine,
  faBell,
  faRightFromBracket,
  faBoxArchive,
} from "@fortawesome/free-solid-svg-icons";
import { Link, useNavigate } from "react-router-dom";
import api from "../lib/api"; // ✅ shared Axios client (with JWT, interceptors, etc.)

/* ================= CONFIG ================= */
// ✅ same pattern as Dashboard / AdminVerifications
const API_BASE = (import.meta.env.VITE_API_BASE || "http://localhost:8000").replace(
  /\/$/,
  ""
);

// endpoints are relative; baseURL handled by api client
const ENDPOINTS = {
  crimes: "/api/crimes/",
  officers: "/api/personnel/",
};

// quick local "am I logged in?" check (optional helper)
const ACCESS_KEYS = ["token", "access", "access_token", "jwt", "authToken"];
const hasToken = () =>
  ACCESS_KEYS.some((k) => {
    const v = localStorage.getItem(k);
    return v && String(v).trim();
  });

/* ================= Helpers ================= */
const rowsFromPayload = (data) =>
  Array.isArray(data) ? data : Array.isArray(data?.results) ? data.results : [];

const fullName = (a, b, c) => [a, b, c].filter(Boolean).join(" ");
const joinAddress = (parts) => parts.filter(Boolean).join(", ");

const crimeAddrBlock = (o) =>
  [
    o?.loc_address,
    joinAddress([o?.loc_region, o?.loc_province, o?.loc_city_municipality, o?.loc_barangay]),
  ]
    .filter(Boolean)
    .join("\n");

const victimAddrBlock = (o) =>
  [
    o?.v_address,
    joinAddress([o?.v_region, o?.v_province, o?.v_city_municipality, o?.v_barangay]),
  ]
    .filter(Boolean)
    .join("\n");

const fmtDate = (iso) => {
  if (!iso) return "-";
  try {
    const d = new Date(iso);
    if (isNaN(d)) return iso;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${y}-${m}-${day} ${hh}:${mm}`;
  } catch {
    return iso;
  }
};

const safe = (v, fb = "-") =>
  v === null || v === undefined || String(v).trim() === "" ? fb : v;

// pick("a.b.c") → obj.a.b.c
const pick = (obj, paths) => {
  for (const p of paths) {
    const val = p.split(".").reduce((o, k) => (o ? o[k] : undefined), obj);
    if (val !== undefined && val !== null && String(val).trim() !== "") return val;
  }
  return "";
};

/* Field getters with fallbacks */
const getVictimFirst = (r) =>
  pick(r, ["v_first_name", "victim_first_name", "victim.first_name"]);
const getVictimMiddle = (r) =>
  pick(r, ["v_middle_name", "victim_middle_name", "victim.middle_name"]);
const getVictimLast = (r) =>
  pick(r, ["v_last_name", "victim_last_name", "victim.last_name"]);

const getVictimAge = (r) => pick(r, ["v_age", "victim_age", "age", "victim.age"]);
const getCrimeType = (r) => pick(r, ["crime_type", "type", "incident_type"]);
const getStatus = (r) => pick(r, ["status", "case_status", "report_status"]);
const getHappenedAt = (r) => pick(r, ["happened_at", "incident_date", "date", "occurred_at"]);

const getCrimeDescription = (r) =>
  pick(r, ["description", "descriptions", "details", "narrative", "report", "incident_description"]);

// Victim photo helpers
const getVictimPhotoField = (r) =>
  pick(r, [
    "v_photo",
    "victim_photo",
    "victim.photo",
    "v_image",
    "victim_image",
    "photo",
    "image",
  ]);

const getImageUrl = (val) => {
  if (!val) return "";
  if (typeof val !== "string") return "";
  if (val.startsWith("http://") || val.startsWith("https://")) return val;
  if (val.startsWith("/")) return `${API_BASE}${val}`;
  // common: "uploads/xxx.jpg" or "media/xxx.jpg"
  return `${API_BASE}/media/${val}`;
};

/* ================= Modal Styles ================= */
const modalStyles = {
  backdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  },
  modal: {
    background: "#fff",
    borderRadius: 12,
    width: "min(860px, 94vw)",
    maxHeight: "90vh",
    overflow: "hidden",
    boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
    display: "flex",
    flexDirection: "column",
  },
  header: {
    padding: "14px 18px",
    borderBottom: "1px solid #e2e8f0",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  body: {
    padding: 18,
    overflowY: "auto",
  },
  footer: {
    padding: 14,
    borderTop: "1px solid #e2e8f0",
    display: "flex",
    justifyContent: "flex-end",
    gap: 10,
  },
  label: { color: "#64748b", fontSize: 12, marginBottom: 4 },
  value: { fontSize: 14, fontWeight: 600, whiteSpace: "pre-line" },
  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 16,
  },
};

/* ================= PAGE ================= */
const AdminArchivedReports = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [submenuOpen, setSubmenuOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [archived, setArchived] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const [search, setSearch] = useState("");

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [selected, setSelected] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);

  const abortRef = useRef(null);
  const detailAbortRef = useRef(null);
  const navigate = useNavigate();

  const toggleSidebar = () => setSidebarOpen((s) => !s);
  const toggleSubmenu = () => setSubmenuOpen((s) => !s);

  // ✅ helper for auth error → message + redirect
  const handleAuthError = (msg = "Your session has expired or you’re not logged in. Please sign in again.") => {
    setErr(msg);
    // optional: clear local token if gusto mo
    // localStorage.removeItem("access");
    // localStorage.removeItem("refresh");
    navigate("/login");
  };

  /* ---------- Fetch archived reports (list) ---------- */
  async function fetchArchivedReports() {
    try {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      setErr("");

      const url = `${ENDPOINTS.crimes}?is_archived=true&ordering=-happened_at&page_size=1000`;

      const { data } = await api.get(url, {
        signal: controller.signal,
      });

      setArchived(rowsFromPayload(data));
    } catch (e) {
      if (e.name === "CanceledError" || e.name === "AbortError") return;
      console.error("archived fetch error", e);

      if (e.response?.status === 401) {
        handleAuthError();
      } else {
        setErr("Di makuha ang archived reports. Pakisubukan ulit.");
      }
    } finally {
      setLoading(false);
    }
  }

  /* ---------- Fetch single detail (for modal completeness) ---------- */
  async function fetchCrimeDetail(id) {
    try {
      detailAbortRef.current?.abort();
      const controller = new AbortController();
      detailAbortRef.current = controller;

      setModalLoading(true);
      const { data } = await api.get(`${ENDPOINTS.crimes}${id}/`, {
        signal: controller.signal,
      });

      setSelected((prev) => ({ ...(prev || {}), ...data }));
    } catch (e) {
      if (e.name === "CanceledError" || e.name === "AbortError") return;
      console.error("detail fetch error", e);
      if (e.response?.status === 401) {
        handleAuthError("Session expired. Please login again.");
      }
    } finally {
      setModalLoading(false);
    }
  }

  /* ---------- Actions ---------- */
  const openView = (row) => {
    setSelected(row);
    setShowModal(true);
    fetchCrimeDetail(row.id);
  };

  const closeView = () => {
    setShowModal(false);
    setSelected(null);
  };

  async function unarchiveCrime(id) {
    if (!window.confirm("Ibalik (unarchive) ang report na ito?")) return;
    try {
      // Try ViewSet action first
      try {
        await api.post(`${ENDPOINTS.crimes}${id}/unarchive/`);
      } catch (err) {
        if (err.response?.status === 401) {
          handleAuthError("Session expired. Please login again.");
          return;
        }
        // If not supported, fallback to PATCH is_archived:false
        await api.patch(`${ENDPOINTS.crimes}${id}/`, { is_archived: false });
      }

      setArchived((prev) => prev.filter((x) => x.id !== id));
      closeView();
    } catch (e) {
      console.error("unarchive error", e);
      alert("Unarchive failed. Tingnan ang console para sa detalye.");
    }
  }

  async function deleteCrime(id) {
    if (!window.confirm("Permanenteng i-delete ang report na ito? (Hindi na mababawi)")) return;
    try {
      await api.delete(`${ENDPOINTS.crimes}${id}/`);
      setArchived((prev) => prev.filter((x) => x.id !== id));
      if (selected?.id === id) closeView();
    } catch (e) {
      console.error("delete error", e);
      if (e.response?.status === 401) {
        handleAuthError("Session expired. Please login again.");
      } else {
        alert("Delete failed. Tingnan ang console para sa detalye.");
      }
    }
  }

  useEffect(() => {
    // ✅ Quick guard: kung walang token, huwag na mag-fetch, diretso login
    if (!hasToken()) {
      handleAuthError("You are not logged in. Please sign in to view archived reports.");
      return;
    }

    fetchArchivedReports();
    return () => {
      abortRef.current?.abort();
      detailAbortRef.current?.abort();
    };
  }, [navigate]); // include navigate dahil ginagamit sa handleAuthError

  /* ---------- Search filter ---------- */
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return archived;
    const hit = (...vals) =>
      vals.some((v) => (v || "").toString().toLowerCase().includes(q));
    return archived.filter((r) =>
      hit(
        getCrimeType(r),
        getStatus(r),
        getVictimFirst(r),
        getVictimMiddle(r),
        getVictimLast(r),
        r.loc_city_municipality,
        r.loc_province,
        r.loc_region,
        getHappenedAt(r)
      )
    );
  }, [archived, search]);

  return (
    <div>
      {/* Top Navigation */}
      <div className="topnav">
        <div className="menu-icon" onClick={toggleSidebar}>
          ☰
        </div>
        {/* <div className="nav-title">
            <FontAwesomeIcon icon={faBell} style={{ fontSize: 18 }} />
        </div> */}
                <div style={{ marginLeft: "auto" }}>
          {err && err.toLowerCase().includes("login") && (
            <button
              className="button"
              onClick={() => navigate("/login")}
              style={{ marginRight: 8 }}
            >
              Go to Login
            </button>
          )}
        </div>
      </div>

      {/* Overlay (mobile) */}
      {!sidebarOpen && <div className="overlay" onClick={() => setSidebarOpen(true)}></div>}

      <div className="container">
        {/* Sidebar */}
        <aside className={`sidebar ${!sidebarOpen ? "collapsed" : ""}`}>
          <div className="logo-section">
            <img src="/assets/logo.png" alt="Logo" />
            <p>
              <strong>Admin</strong>
              <br />
              Dashboard
            </p>
          </div>

          <ul className="nav-links">
            <li>
              <Link to="/dashboard">
                <FontAwesomeIcon icon={faHome} /> Home
              </Link>
            </li>
           
           <li>
              <div
                className="submenu-toggle"
                onClick={() => setUserMenuOpen((s) => !s)}
              >
                <FontAwesomeIcon icon={faUser} /> User Management
              </div>

              {userMenuOpen && (
                <ul className="submenu">
                  <li>
                    <Link to="/adminInfo">Police Officers</Link>
                  </li>
                  <li>
                    <Link to="/AdminVerifications">Account Manager</Link>
                  </li>
                </ul>
              )}
            </li>


            <li>
              <div className="submenu-toggle" onClick={toggleSubmenu}>
                <FontAwesomeIcon icon={faFileInvoice} /> Crime Reports
              </div>
              {submenuOpen && (
                <ul className="submenu">
                  <li>
                    <Link to="/VictimeSupectTable">View Reports</Link>
                  </li>
                  <li>
                    <Link to="/AdminCrime">Add Reports</Link>
                  </li>
                 
                </ul>
              )}
            </li>

            <li>
              <Link to="/AdminMaps">
                <FontAwesomeIcon icon={faMapLocation} /> Maps
              </Link>
            </li>
            <li>
              <Link to="/AdminAnalytics">
                <FontAwesomeIcon icon={faChartLine} /> Analytics
              </Link>
            </li>

            {/* Dedicated Archive menu */}
            <li>
              <div className="submenu-toggle" onClick={() => setArchiveOpen((s) => !s)}>
                <FontAwesomeIcon icon={faBoxArchive} /> Archive
              </div>
              {archiveOpen && (
                <ul className="submenu">
                  <li>
                    <Link to="/AdminArchivedReports">Archived Reports</Link>
                  </li>
                  <li>
                    <Link to="/AdminArchivedInfo">Archived User</Link>
                  </li>
                </ul>
              )}
            </li>

           
            <li>
              <Link to="/logout" className="logout">
                <FontAwesomeIcon icon={faRightFromBracket} /> Logout
              </Link>
            </li>
          </ul>
        </aside>

        {/* ==================== Main Content (ARCHIVED TABLE) ==================== */}
        <main className="main-content">
          <div
            className="card"
            style={{ display: "flex", gap: 12, alignItems: "center" }}
          >
            <h1 style={{ margin: 0, fontSize: 22 }}>Archived Reports</h1>
            <div style={{ flex: 1 }} />
            <input
              className="table-search"
              placeholder="Search type, name, location, status, date..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ maxWidth: 320 }}
            />
          </div>

          {err && (
            <div className="alert" style={{ marginTop: 10 }}>
              {err}{" "}
              {err.toLowerCase().includes("login") && (
                <button
                  className="btn"
                  onClick={() => navigate("/login")}
                  style={{ marginLeft: 8 }}
                >
                  Login
                </button>
              )}
            </div>
          )}

          <div className="card" style={{ marginTop: 12 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 8,
              }}
            >
              <small style={{ color: "#64748b" }}>
                Showing {filtered.length} of {archived.length}
              </small>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="button" onClick={fetchArchivedReports}>
                  Refresh
                </button>
              </div>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table
                className="profile-table"
                style={{ width: "100%", borderCollapse: "collapse" }}
              >
                <thead>
                  <tr>
                    <th style={{ whiteSpace: "nowrap" }}>ID</th>
                    <th>Victim Photo</th>
                    <th>Type of Crime / Incident</th>
                    <th>Victim Name</th>
                    <th>Date</th>
                    <th>Location</th>
                    <th>Status</th>
                    <th style={{ width: 220 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="8" style={{ textAlign: "center", opacity: 0.7 }}>
                        Loading…
                      </td>
                    </tr>
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan="8" style={{ textAlign: "center", opacity: 0.7 }}>
                        No archived reports found.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((r) => {
                      const img = getImageUrl(getVictimPhotoField(r));
                      return (
                        <tr key={r.id}>
                          <td>{r.id}</td>
                          <td>
                            {img ? (
                              <img
                                src={img}
                                alt={
                                  fullName(
                                    getVictimFirst(r),
                                    getVictimMiddle(r),
                                    getVictimLast(r)
                                  ) || "Victim"
                                }
                                style={{
                                  width: 40,
                                  height: 40,
                                  borderRadius: "8px",
                                  objectFit: "cover",
                                }}
                                onError={(e) => {
                                  e.currentTarget.style.display = "none";
                                }}
                              />
                            ) : (
                              <span style={{ opacity: 0.6 }}>No photo</span>
                            )}
                          </td>
                          <td>{getCrimeType(r) || "-"}</td>
                          <td>
                            {fullName(
                              getVictimFirst(r),
                              getVictimMiddle(r),
                              getVictimLast(r)
                            ) || "-"}
                          </td>
                          <td title={getHappenedAt(r) || ""}>
                            {fmtDate(getHappenedAt(r))}
                          </td>
                          <td style={{ whiteSpace: "pre-line" }}>
                            {crimeAddrBlock(r) || "-"}
                          </td>
                          <td>{getStatus(r) || "-"}</td>
                          <td>
                            <div
                              style={{
                                display: "flex",
                                gap: 8,
                                flexWrap: "wrap",
                                alignItems: "center",
                              }}
                            >
                              <button
                                className="button"
                                onClick={() => openView(r)}
                                title="View full details"
                              >
                                 View
                              </button>
                              <button
                                className="archive-btn"
                                onClick={() => deleteCrime(r.id)}
                                title="Permanent delete"
                                style={{ background: "#dc2626", color: "#fff" }}
                              >
                             Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>

      {/* ==================== VIEW MODAL ==================== */}
      {showModal && selected && (
        <div style={modalStyles.backdrop} onClick={closeView}>
          <div style={modalStyles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={modalStyles.header}>
              <strong>Incident Details</strong>
              <button className="btn" onClick={closeView}>
                ✕ Close
              </button>
            </div>

            <div style={modalStyles.body}>
              {modalLoading && (
                <div style={{ marginBottom: 10, color: "#64748b" }}>
                  Loading full details…
                </div>
              )}

              {/* Victim Photo + Name block (modal) */}
              <div
                style={{
                  display: "flex",
                  gap: 16,
                  alignItems: "center",
                  marginBottom: 16,
                }}
              >
                <div>
                  {(() => {
                    const img = getImageUrl(getVictimPhotoField(selected));
                    return img ? (
                      <img
                        src={img}
                        alt={
                          fullName(
                            getVictimFirst(selected),
                            getVictimMiddle(selected),
                            getVictimLast(selected)
                          ) || "Victim"
                        }
                        style={{
                          width: 84,
                          height: 84,
                          borderRadius: "50%",
                          objectFit: "cover",
                        }}
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 84,
                          height: 84,
                          borderRadius: "50%",
                          background: "#e2e8f0",
                          display: "grid",
                          placeItems: "center",
                          color: "#64748b",
                          fontSize: 12,
                        }}
                      >
                        No photo
                      </div>
                    );
                  })()}
                </div>
                <div>
                  <div style={modalStyles.label}>Victim</div>
                  <div style={modalStyles.value}>
                    {fullName(
                      getVictimFirst(selected),
                      getVictimMiddle(selected),
                      getVictimLast(selected)
                    ) || "-"}
                  </div>
                </div>
              </div>

              <div style={modalStyles.grid}>
                <div>
                  <div style={modalStyles.label}>Name</div>
                  <div style={modalStyles.value}>
                    {fullName(
                      getVictimFirst(selected),
                      getVictimMiddle(selected),
                      getVictimLast(selected)
                    ) || "-"}
                  </div>
                </div>

                <div>
                  <div style={modalStyles.label}>Age</div>
                  <div style={modalStyles.value}>{safe(getVictimAge(selected))}</div>
                </div>

                <div>
                  <div style={modalStyles.label}>Type of Crime / Incident</div>
                  <div style={modalStyles.value}>{safe(getCrimeType(selected))}</div>
                </div>

                <div>
                  <div style={modalStyles.label}>Address</div>
                  <div style={modalStyles.value}>{safe(victimAddrBlock(selected))}</div>
                </div>

                <div>
                  <div style={modalStyles.label}>Crime Location</div>
                  <div style={modalStyles.value}>{safe(crimeAddrBlock(selected))}</div>
                </div>

                <div>
                  <div style={modalStyles.label}>Date</div>
                  <div style={modalStyles.value}>
                    {fmtDate(getHappenedAt(selected))}
                  </div>
                </div>

                <div style={{ gridColumn: "1 / -1" }}>
                  <div style={modalStyles.label}>Descriptions</div>
                  <div style={modalStyles.value}>
                    {safe(getCrimeDescription(selected))}
                  </div>
                </div>

                <div>
                  <div style={modalStyles.label}>Status</div>
                  <div style={modalStyles.value}>{safe(getStatus(selected))}</div>
                </div>
              </div>
            </div>

            <div style={modalStyles.footer}>
              <button
                className="button"
                onClick={() => unarchiveCrime(selected.id)}
                title="Ibalik sa active reports"
              >
              Unarchive
              </button>
              <button className="button" onClick={closeView}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminArchivedReports;
