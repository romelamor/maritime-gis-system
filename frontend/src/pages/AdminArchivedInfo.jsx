// src/pages/AdminArchivedInfo.jsx
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
import api from "../lib/api"; // ✅ shared Axios client (with JWT + refresh)

/* ================= CONFIG ================= */
const API_BASE = import.meta?.env?.VITE_API_BASE || "http://localhost:8000";
const ENDPOINTS = {
  officers: "/api/personnel/",
};

/* ================= Token helpers (for quick checks / logout) ================= */
const ACCESS_KEYS = ["token", "access", "access_token", "accessToken", "jwt", "authToken"];

const hasToken = () =>
  ACCESS_KEYS.some((k) => {
    try {
      const v = localStorage.getItem(k);
      return v && String(v).trim();
    } catch {
      return false;
    }
  });

function clearTokens() {
  const keys = [
    "token",
    "access",
    "access_token",
    "accessToken",
    "refresh",
    "refresh_token",
    "refreshToken",
    "jwt",
    "jwtRefresh",
    "authToken",
    "authTokens",
    "tokens",
  ];
  for (const key of keys) {
    try {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    } catch {
      // ignore
    }
  }
}

/* ================= Helpers (data) ================= */
const rowsFromPayload = (data) =>
  Array.isArray(data) ? data : Array.isArray(data?.results) ? data.results : [];

const pick = (obj, paths) => {
  for (const p of paths) {
    const val = p.split(".").reduce((o, k) => (o ? o[k] : undefined), obj);
    if (val !== undefined && val !== null && String(val).trim() !== "") return val;
  }
  return "";
};

const getFirst = (r) =>
  pick(r, ["first_name", "firstName", "given_name", "fname", "profile.first_name"]);
const getMiddle = (r) =>
  pick(r, ["middle_name", "middleName", "middlename", "mi", "m_i", "profile.middle_name"]);
const getLast = (r) =>
  pick(r, ["last_name", "lastName", "surname", "family_name", "profile.last_name"]);

const getBadge = (r) =>
  pick(r, [
    "officer_id",
    "badge_number",
    "badgeNumber",
    "badge_no",
    "badgeNo",
    "badge_id",
    "badgeId",
    "police_id",
    "id_number",
    "profile.badge_number",
    "profile.badge_no",
  ]);

const getDesignation = (r) =>
  pick(r, [
    "department",
    "officer_type",
    "regular_officer",
    "section",
    "designation",
    "designation_name",
    "position",
    "position_title",
    "title",
    "role",
    "rank",
    "rank_name",
    "position_rank",
    "profile.designation",
  ]);

const getEmail = (r) =>
  pick(r, ["email", "user_email", "contact_email", "profile.email"]);

const getCivilStatus = (r) =>
  pick(r, ["civil_status", "civilStatus", "marital_status", "profile.civil_status"]);
const getNationality = (r) =>
  pick(r, ["nationality", "citizenship", "country", "profile.nationality"]);
const getReligion = (r) =>
  pick(r, ["religion", "faith", "religion_name", "profile.religion"]);

// Image helpers
const getImageField = (r) =>
  pick(r, ["profile_image", "photo", "image", "avatar", "id_image", "profile.image"]);
const getImageUrl = (val) => {
  if (!val) return "";
  if (typeof val !== "string") return "";
  if (val.startsWith("http://") || val.startsWith("https://")) return val;
  if (val.startsWith("/")) return `${API_BASE}${val}`;
  return `${API_BASE}/media/${val}`;
};

const safe = (v, fb = "-") =>
  v === null || v === undefined || String(v) === "" ? fb : v;

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
    width: "min(760px, 92vw)",
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
  value: { fontSize: 14, fontWeight: 600 },
  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 16,
  },
};

const AdminArchivedInfo = () => {
  const navigate = useNavigate();

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
  const enrichAbortRef = useRef(null);

  // 🔒 auth flag (same pattern as Dashboard.jsx)
  const [authChecked, setAuthChecked] = useState(false);

  function logoutAndGoToLogin() {
    clearTokens();
    navigate("/login", { replace: true });
  }

  /* ---------- Fetch archived personnel (list) ---------- */
  async function fetchArchivedProfiles() {
    try {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      setErr("");

      const url = `${ENDPOINTS.officers}?is_archived=true&ordering=-updated_at&page_size=1000`;

      const { data } = await api.get(url, {
        signal: controller.signal,
      });

      const rows = rowsFromPayload(data);
      setArchived(rows);

      // auto-enrich rows na kulang ang badge/designation
      enrichMissingFields(rows);
    } catch (e) {
      if (
        e.name === "CanceledError" ||
        e.name === "AbortError" ||
        e.code === "ERR_CANCELED"
      ) {
        return;
      }
      console.error("archived profiles fetch error", e);
      if (e.response?.status === 401) {
        setErr("Session expired or unauthorized. Please log in again.");
        logoutAndGoToLogin();
      } else {
        setErr("Di makuha ang archived profiles. Pakisubukan ulit.");
      }
    } finally {
      setLoading(false);
    }
  }

  /* ---------- Enrich list rows with missing Badge/Designation ---------- */
  async function enrichMissingFields(rows) {
    try {
      enrichAbortRef.current?.abort();
      const controller = new AbortController();
      enrichAbortRef.current = controller;

      const targets = rows.filter((r) => !getBadge(r) || !getDesignation(r));
      if (targets.length === 0) return;

      const limit = 4; // concurrency
      let i = 0;

      async function worker() {
        while (i < targets.length) {
          const idx = i++;
          const row = targets[idx];
          try {
            const { data } = await api.get(`${ENDPOINTS.officers}${row.id}/`, {
              signal: controller.signal,
            });
            setArchived((prev) =>
              prev.map((p) => (p.id === row.id ? { ...p, ...data } : p))
            );
          } catch (e) {
            if (
              e.name === "CanceledError" ||
              e.name === "AbortError" ||
              e.code === "ERR_CANCELED"
            ) {
              return;
            }
            // For enrich failures, tahimik lang
            console.warn("enrich failed for id", row.id, e);
          }
        }
      }

      await Promise.all(
        Array.from({ length: Math.min(limit, targets.length) }, worker)
      );
    } catch (e) {
      if (
        e.name === "CanceledError" ||
        e.name === "AbortError" ||
        e.code === "ERR_CANCELED"
      ) {
        return;
      }
      console.error("enrich error", e);
    }
  }

  /* ---------- Fetch single detail for full modal info ---------- */
  async function fetchOfficerDetail(id) {
    try {
      detailAbortRef.current?.abort();
      const controller = new AbortController();
      detailAbortRef.current = controller;

      setModalLoading(true);
      const { data } = await api.get(`${ENDPOINTS.officers}${id}/`, {
        signal: controller.signal,
      });
      setSelected((prev) => ({ ...(prev || {}), ...data }));
    } catch (e) {
      if (
        e.name === "CanceledError" ||
        e.name === "AbortError" ||
        e.code === "ERR_CANCELED"
      ) {
        return;
      }
      console.error("detail fetch error", e);
      if (e.response?.status === 401) logoutAndGoToLogin();
    } finally {
      setModalLoading(false);
    }
  }

  /* ---------- Actions ---------- */
  const openView = (row) => {
    setSelected(row);
    setShowModal(true);
    fetchOfficerDetail(row.id);
  };

  const closeView = () => {
    setShowModal(false);
    setSelected(null);
  };

  // PATCH-first, then fallback to POST /unarchive/ if PATCH is 404/405
  async function unarchiveProfile(id) {
    // 1) Standard DRF PATCH
    try {
      await api.patch(`${ENDPOINTS.officers}${id}/`, {
        is_archived: false,
      });
      setArchived((prev) => prev.filter((x) => x.id !== id));
      if (selected?.id === id) closeView();
      return;
    } catch (e) {
      const status = e.response?.status;
      if (status && status !== 404 && status !== 405) {
        if (status === 401) {
          logoutAndGoToLogin();
        } else {
          console.error("unarchive PATCH error", e);
          alert("Unarchive failed (PATCH). Tingnan ang console para sa detalye.");
        }
        return;
      }
    }

    // 2) Fallback: custom action /unarchive/
    try {
      await api.post(`${ENDPOINTS.officers}${id}/unarchive/`);
      setArchived((prev) => prev.filter((x) => x.id !== id));
      if (selected?.id === id) closeView();
    } catch (e2) {
      if (e2.response?.status === 401) {
        logoutAndGoToLogin();
      } else {
        console.error("unarchive POST /unarchive/ error", e2);
        alert(
          "Unarchive failed (POST). Baka wala ang /unarchive/ route sa backend."
        );
      }
    }
  }

  async function deleteProfile(id) {
    if (
      !window.confirm(
        "Permanenteng i-delete ang profile na ito? (Hindi na mababawi)"
      )
    )
      return;
    try {
      await api.delete(`${ENDPOINTS.officers}${id}/`);
      setArchived((prev) => prev.filter((x) => x.id !== id));
      if (selected?.id === id) closeView();
    } catch (e) {
      console.error("delete profile error", e);
      if (e.response?.status === 401) logoutAndGoToLogin();
      else alert("Delete failed. Tingnan ang console para sa detalye.");
    }
  }

  // 🔒 Route guard (same behavior as Dashboard)
  useEffect(() => {
    if (!hasToken()) {
      navigate("/login", { replace: true });
      return;
    }

    setAuthChecked(true);
    fetchArchivedProfiles();

    return () => {
      abortRef.current?.abort();
      detailAbortRef.current?.abort();
      enrichAbortRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  /* ---------- Search filter ---------- */
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return archived;

    const hit = (...vals) =>
      vals.some((v) => (v || "").toString().toLowerCase().includes(q));

    return archived.filter((r) =>
      hit(
        getFirst(r),
        getMiddle(r),
        getLast(r),
        getBadge(r),
        getEmail(r),
        getDesignation(r),
        getCivilStatus(r),
        getNationality(r),
        getReligion(r)
      )
    );
  }, [archived, search]);

  /* 🔒 Huwag mag-render hangga't hindi pa tapos i-check ang auth */
  if (!authChecked) {
    return null;
  }

  return (
    <div>
      {/* Top Navigation */}
      <div className="topnav">
        <div className="menu-icon" onClick={() => setSidebarOpen((s) => !s)}>
          ☰
        </div>
        <div className="nav-title">
          <FontAwesomeIcon icon={faBell} style={{ fontSize: 18 }} />
        </div>
      </div>

      {/* Overlay (mobile) */}
      {!sidebarOpen && (
        <div className="overlay" onClick={() => setSidebarOpen(true)}></div>
      )}

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
              <div
                className="submenu-toggle"
                onClick={() => setSubmenuOpen((s) => !s)}
              >
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
              <div
                className="submenu-toggle"
                onClick={() => setArchiveOpen((s) => !s)}
              >
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

        {/* ==================== Main Content (ARCHIVED PROFILES) ==================== */}
        <main className="main-content">
          <div
            className="card"
            style={{ display: "flex", gap: 12, alignItems: "center" }}
          >
            <h1 style={{ margin: 0, fontSize: 22 }}>Archived Profiles</h1>
            <div style={{ flex: 1 }} />
            <input
              className="table-search"
              placeholder="Search name, badge #, email, designation, civil status, nationality, religion…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ maxWidth: 520 }}
            />
          </div>

          {err && (
            <div className="alert" style={{ marginTop: 10 }}>
              {err}
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
            </div>

            <div style={{ overflowX: "auto" }}>
              <table
                className="profile-table"
                style={{ width: "100%", borderCollapse: "collapse" }}
              >
                <thead>
                  <tr>
                    <th style={{ whiteSpace: "nowrap" }}>Profile Image</th>
                    <th>First Name</th>
                    <th>Middle Name</th>
                    <th>Last Name</th>
                    <th>Badge #</th>
                    <th>Email</th>
                    <th>Designation</th>
                    <th style={{ width: 220 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td
                        colSpan="8"
                        style={{ textAlign: "center", opacity: 0.7 }}
                      >
                        Loading…
                      </td>
                    </tr>
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td
                        colSpan="8"
                        style={{ textAlign: "center", opacity: 0.7 }}
                      >
                        No archived profiles found.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((r) => {
                      const img = getImageUrl(getImageField(r));
                      return (
                        <tr key={r.id}>
                          <td>
                            {img ? (
                              <img
                                src={img}
                                alt={`${getFirst(r)} ${getLast(r)}`}
                                style={{
                                  width: 40,
                                  height: 40,
                                  borderRadius: "50%",
                                  objectFit: "cover",
                                }}
                                onError={(e) => {
                                  e.currentTarget.style.display = "none";
                                }}
                              />
                            ) : (
                              <span style={{ opacity: 0.6 }}>No image</span>
                            )}
                          </td>
                          <td>{safe(getFirst(r))}</td>
                          <td>{safe(getMiddle(r))}</td>
                          <td>{safe(getLast(r))}</td>
                          <td>{safe(getBadge(r))}</td>
                          <td>{safe(getEmail(r))}</td>
                          <td>{safe(getDesignation(r))}</td>
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
                                onClick={() => deleteProfile(r.id)}
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
          <div
            style={modalStyles.modal}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={modalStyles.header}>
              <strong>Profile Details</strong>
              <button className="button" onClick={closeView}>
                ✕ Close
              </button>
            </div>

            <div style={modalStyles.body}>
              {modalLoading && (
                <div style={{ marginBottom: 10, color: "#64748b" }}>
                  Loading full details…
                </div>
              )}

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
                    const img = getImageUrl(getImageField(selected));
                    return img ? (
                      <img
                        src={img}
                        alt={`${getFirst(selected)} ${getLast(selected)}`}
                        style={{
                          width: 72,
                          height: 72,
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
                          width: 72,
                          height: 72,
                          borderRadius: "50%",
                          background: "#e2e8f0",
                          display: "grid",
                          placeItems: "center",
                          color: "#64748b",
                          fontSize: 12,
                        }}
                      >
                        No image
                      </div>
                    );
                  })()}
                </div>
                <div>
                  <div style={modalStyles.label}>Full Name</div>
                  <div style={modalStyles.value}>
                    {[getFirst(selected), getMiddle(selected), getLast(selected)]
                      .filter(Boolean)
                      .join(" ") || "-"}
                  </div>
                </div>
              </div>

              <div style={modalStyles.grid}>
                <div>
                  <div style={modalStyles.label}>First Name</div>
                  <div style={modalStyles.value}>{safe(getFirst(selected))}</div>
                </div>
                <div>
                  <div style={modalStyles.label}>Middle Name</div>
                  <div style={modalStyles.value}>{safe(getMiddle(selected))}</div>
                </div>
                <div>
                  <div style={modalStyles.label}>Last Name</div>
                  <div style={modalStyles.value}>{safe(getLast(selected))}</div>
                </div>
                <div>
                  <div style={modalStyles.label}>Badge #</div>
                  <div style={modalStyles.value}>{safe(getBadge(selected))}</div>
                </div>
                <div>
                  <div style={modalStyles.label}>Email</div>
                  <div style={modalStyles.value}>{safe(getEmail(selected))}</div>
                </div>
                <div>
                  <div style={modalStyles.label}>Designation</div>
                  <div style={modalStyles.value}>
                    {safe(getDesignation(selected))}
                  </div>
                </div>
                <div>
                  <div style={modalStyles.label}>Civil Status</div>
                  <div style={modalStyles.value}>
                    {safe(getCivilStatus(selected))}
                  </div>
                </div>
                <div>
                  <div style={modalStyles.label}>Nationality</div>
                  <div style={modalStyles.value}>
                    {safe(getNationality(selected))}
                  </div>
                </div>
                <div>
                  <div style={modalStyles.label}>Religion</div>
                  <div style={modalStyles.value}>
                    {safe(getReligion(selected))}
                  </div>
                </div>
              </div>
            </div>

            <div style={modalStyles.footer}>
              <button
                className="button"
                onClick={() => unarchiveProfile(selected.id)}
                title="Ibalik sa active profiles"
              >
                ♻ Unarchive
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

export default AdminArchivedInfo;
