// src/pages/Dashboard.jsx
import React, { useEffect, useMemo, useState } from "react";
import api from "../lib/api";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import Swal from "sweetalert2";
import {
  faHome,
  faUser,
  faFileInvoice,
  faMapLocation,
  faRightFromBracket,
  faSearch,
  faCircleCheck,
  faCircleXmark,
  faRotate,
  faIdCard,
  faTriangleExclamation,
  faChartLine,
  faBell,
  faBoxArchive,
  faPlus,
  faKey,
  faUserSlash,
  faUserCheck,
} from "@fortawesome/free-solid-svg-icons";
import { Link } from "react-router-dom";
import "../assets/css/AdminVerifications.css"; // reuse your existing CSS

/* ================= API ENDPOINTS ================= */
const ENDPOINTS = {
  list: ({ page = 1, page_size = 20, search = "", ordering = "-date_joined" }) =>
    `/api/admin/users/?page=${page}&page_size=${page_size}&ordering=${ordering}${
      search ? `&search=${encodeURIComponent(search)}` : ""
    }`,
  create: () => `/api/admin/users/`,
  patch: (id) => `/api/admin/users/${id}/`,
  activate: (id) => `/api/admin/users/${id}/activate/`,
  deactivate: (id) => `/api/admin/users/${id}/deactivate/`,
  resetPassword: (id) => `/api/admin/users/${id}/reset-password/`,
};

/* ================= Auth helper ================= */
const authConfig = () => {
  const raw =
    localStorage.getItem("access_token") ||
    localStorage.getItem("token") ||
    "";

  if (!raw) return {};
  const value = /^(Bearer|Token)\s/i.test(raw) ? raw : `Bearer ${raw}`;
  return { headers: { Authorization: value } };
};

/* ================= Helpers ================= */
const rowsFromPayload = (data) =>
  Array.isArray(data?.results)
    ? data.results
    : Array.isArray(data)
    ? data
    : [];

const fmtDate = (iso) => (iso ? new Date(iso).toLocaleString() : "—");

/* ================= Account Manager (Main Content) ================= */
function AccountManager() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [count, setCount] = useState(0);
  const [error, setError] = useState("");

  const [selected, setSelected] = useState(new Set());

  // modals
  const [showCreate, setShowCreate] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [activeRow, setActiveRow] = useState(null);

  // form states
  const [form, setForm] = useState({
    username: "",
    email: "",
    badge_number: "",
    password: "",
    is_active: true,
  });

  const [resetPassword, setResetPassword] = useState("");

  const loadList = async () => {
    setLoading(true);
    setError("");

    try {
      const url = ENDPOINTS.list({
        page: page,
        page_size: pageSize,
        search: search,
      });

      const { data } = await api.get(url, authConfig());

      const items = rowsFromPayload(data);

      setRows(items);
      setCount(data?.count ?? items.length);
      setSelected(new Set());

    } catch (e) {
      console.error(e);

      if (e?.response?.status === 401) {
        setError("Session expired or unauthorized. Please log in again.");
      } else {
        setError(e?.response?.data?.detail || "Failed to load users.");
      }

    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, search]);

  const toggleSelect = (id) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const openCreate = () => {
    setForm({
      username: "",
      email: "",
      badge_number: "",
      password: "",
      is_active: true,
    });
    setShowCreate(true);
  };

  const submitCreate = async (e) => {
    e.preventDefault();

    const confirm = await Swal.fire({
      title: "Create Account?",
      text: "This will create a new user account.",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Yes, Create",
      cancelButtonText: "Cancel",
    });

    if (!confirm.isConfirmed) return;

    setLoading(true);
    setError("");

    try {
      await api.post(ENDPOINTS.create(), form, authConfig());

      setShowCreate(false);
      await loadList();

      Swal.fire({
        icon: "success",
        title: "Account Created",
        text: "User account has been successfully created.",
        timer: 2000,
        showConfirmButton: false,
      });

    } catch (e2) {
      Swal.fire({
        icon: "error",
        title: "Error",
        text:
          e2?.response?.data?.detail ||
          "Failed to create user account.",
      });
    } finally {
      setLoading(false);
    }
  };

  const activateUser = async (id) => {

    const confirm = await Swal.fire({
      title: "Activate Account?",
      text: "This user will be allowed to log in.",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Yes, Activate",
    });

    if (!confirm.isConfirmed) return;

    setLoading(true);

    try {
      await api.post(ENDPOINTS.activate(id), null, authConfig());
      await loadList();

      Swal.fire({
        icon: "success",
        title: "Activated",
        text: "User account has been activated.",
        timer: 2000,
        showConfirmButton: false,
      });

    } catch (e) {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: e?.response?.data?.detail || "Activate failed.",
      });
    } finally {
      setLoading(false);
    }
  };

  const deactivateUser = async (id) => {

    const confirm = await Swal.fire({
      title: "Deactivate Account?",
      text: "This user will not be able to log in.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, Deactivate",
    });

    if (!confirm.isConfirmed) return;

    setLoading(true);

    try {
      await api.post(ENDPOINTS.deactivate(id), null, authConfig());
      await loadList();

      Swal.fire({
        icon: "success",
        title: "Deactivated",
        text: "User account has been deactivated.",
        timer: 2000,
        showConfirmButton: false,
      });

    } catch (e) {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: e?.response?.data?.detail || "Deactivate failed.",
      });
    } finally {
      setLoading(false);
    }
  };

  const openReset = (row) => {
    setActiveRow(row);
    setResetPassword("");
    setShowReset(true);
  };

  const submitReset = async (e) => {
    e.preventDefault();
    if (!activeRow) return;

    const confirm = await Swal.fire({
      title: "Reset Password?",
      text: `Change password for ${activeRow.username}?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, Reset",
    });

    if (!confirm.isConfirmed) return;

    setLoading(true);

    try {
      await api.post(
        ENDPOINTS.resetPassword(activeRow.id),
        { new_password: resetPassword },
        authConfig()
      );

      setShowReset(false);
      setActiveRow(null);
      setResetPassword("");

      Swal.fire({
        icon: "success",
        title: "Password Updated",
        text: "User password has been reset successfully.",
      });

    } catch (e) {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: e?.response?.data?.detail || "Reset password failed.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="av-shell">
      <div className="av-header">
        <div>
          <h2>Account Manager</h2>
          <p className="av-text-muted">
            Admin creates and manages user accounts (activate/deactivate/reset password).
          </p>
        </div>

        <div className="av-search">
          <FontAwesomeIcon icon={faSearch} className="av-search__icon" />
          <input
            className="av-search__input"
            placeholder="Search username, email, badge number…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
      </div>

      <div className="av-bulk-actions">
        <button className="av-btn av-btn--approve" onClick={openCreate} disabled={loading}>
          <FontAwesomeIcon icon={faPlus} /> Create Account
        </button>

        <button
          className="av-btn av-btn--secondary"
          disabled={selected.size !== 1 || loading}
          onClick={() => {
            const id = Array.from(selected)[0];
            const row = rows.find((r) => r.id === id);
            if (row) openReset(row);
          }}
          title="Select exactly 1 user"
        >
          <FontAwesomeIcon icon={faKey} /> Reset Password
        </button>

        <button
          className="av-btn av-btn--secondary"
          disabled={selected.size === 0 || loading}
          onClick={async () => {
            const ids = Array.from(selected);
            for (const id of ids) await deactivateUser(id);
          }}
          title="Deactivate selected"
        >
          <FontAwesomeIcon icon={faUserSlash} /> Deactivate
        </button>

        <button
          className="av-btn av-btn--secondary"
          disabled={selected.size === 0 || loading}
          onClick={async () => {
            const ids = Array.from(selected);
            for (const id of ids) await activateUser(id);
          }}
          title="Activate selected"
        >
          <FontAwesomeIcon icon={faUserCheck} /> Activate
        </button>
      </div>

      <div className="av-card">
        {error && (
          <div className="av-alert av-alert--error">
            <FontAwesomeIcon icon={faTriangleExclamation} /> {error}
          </div>
        )}

        <div className="av-table-wrap">
          <table className="av-table">
            <thead>
              <tr>
                <th style={{ width: 36 }}>
                  <input
                    type="checkbox"
                    onChange={(e) => {
                      if (e.target.checked) setSelected(new Set(rows.map((r) => r.id)));
                      else setSelected(new Set());
                    }}
                    checked={rows.length > 0 && selected.size === rows.length}
                    aria-label="Select all"
                  />
                </th>
                <th>Username</th>
                <th>Email</th>
                <th>Badge No.</th>
                <th>Active</th>

                <th style={{ width: 240 }}>Actions</th>
              </tr>
            </thead>

            <tbody>
              {loading && (
                <tr>
                  <td colSpan={7} className="av-text-center">
                    Loading…
                  </td>
                </tr>
              )}

              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="av-text-center av-text-muted">
                    No users found.
                  </td>
                </tr>
              )}

              {!loading &&
                rows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selected.has(r.id)}
                        onChange={() => toggleSelect(r.id)}
                      />
                    </td>
                    <td>
                      <strong>{r.username || "—"}</strong>
                    </td>
                    <td>{r.email || "—"}</td>
                    <td>{r.badge_number || "—"}</td>
                    <td>{r.is_active ? "Yes" : "No"}</td>

                    <td>
                      <div className="av-row-actions">
                        <button
                          className="av-btn av-btn--ghost"
                          onClick={() => openReset(r)}
                        >
                          <FontAwesomeIcon icon={faKey} /> Reset
                        </button>

                        {r.is_active ? (
                          <button
                            className="av-btn av-btn--reject"
                            onClick={() => deactivateUser(r.id)}
                          >
                            <FontAwesomeIcon icon={faUserSlash} /> Deactivate
                          </button>
                        ) : (
                          <button
                            className="av-btn av-btn--approve"
                            onClick={() => activateUser(r.id)}
                          >
                            <FontAwesomeIcon icon={faUserCheck} /> Activate
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
       <div className="av-pagination">

          <button
            className="av-btn av-btn--secondary"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            ◀ Prev
          </button>

          <span>
            Page {page} of {Math.ceil(count / pageSize)}
          </span>

          <button
            className="av-btn av-btn--secondary"
            disabled={page >= Math.ceil(count / pageSize) || loading}
            onClick={() => setPage((p) => p + 1)}
          >
            Next ▶
          </button>

        </div>
      </div>

      {/* CREATE MODAL */}
      {showCreate && (
        <div className="av-modal">
          <div className="av-modal__card">
            <h3 className="av-modal__title">
              <FontAwesomeIcon icon={faPlus} /> Create User Account
            </h3>

            <form onSubmit={submitCreate}>
              <div className="av-modal__field">
                <label>Username</label>
                <input
                  value={form.username}
                  onChange={(e) => setForm((s) => ({ ...s, username: e.target.value }))}
                  required
                />
              </div>

              <div className="av-modal__field">
                <label>Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))}
                  required
                />
              </div>

              <div className="av-modal__field">
                <label>Badge Number (6 digits)</label>
                <input
                  value={form.badge_number}
                  onChange={(e) =>
                    setForm((s) => ({ ...s, badge_number: e.target.value }))
                  }
                  placeholder="e.g. 123456"
                />
              </div>

              <div className="av-modal__field">
                <label>Password (min 8 chars)</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((s) => ({ ...s, password: e.target.value }))}
                  required
                />
              </div>

              <div className="av-modal__actions">
                <button
                  type="button"
                  className="av-btn av-btn--secondary"
                  onClick={() => setShowCreate(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="av-btn av-btn--approve" disabled={loading}>
                  <FontAwesomeIcon icon={faCircleCheck} /> Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RESET PASSWORD MODAL */}
      {showReset && activeRow && (
        <div className="av-modal">
          <div className="av-modal__card">
            <h3 className="av-modal__title">
              <FontAwesomeIcon icon={faKey} /> Reset Password for {activeRow.username}
            </h3>

            <form onSubmit={submitReset}>
              <div className="av-modal__field">
                <label>New Password (min 8 chars)</label>
                <input
                  type="password"
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  required
                />
              </div>

              <div className="av-modal__actions">
                <button
                  type="button"
                  className="av-btn av-btn--secondary"
                  onClick={() => {
                    setShowReset(false);
                    setActiveRow(null);
                  }}
                >
                  Cancel
                </button>
                <button type="submit" className="av-btn av-btn--approve" disabled={loading}>
                  <FontAwesomeIcon icon={faCircleCheck} /> Update
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/* ================= Dashboard Shell + Sidebar ================= */
function Dashboard() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [submenuOpen, setSubmenuOpen] = useState(true);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  const toggleSidebar = () => setSidebarOpen((s) => !s);
  const toggleSubmenu = () => setSubmenuOpen((s) => !s);

  return (
    <div>
      {/* Top Navigation */}
      <div className="topnav">
        <div className="menu-icon" onClick={toggleSidebar}>
          ☰
        </div>
          <div className="nav-title">
              <FontAwesomeIcon icon={faBell} style={{ fontSize: 18 }} />
          </div>
      </div>

      {/* Overlay (mobile) */}
      {!sidebarOpen && <div className="overlay" onClick={() => setSidebarOpen(true)} />}

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
                  <Link to="/adminInfo">
                    <FontAwesomeIcon /> Police Officers
                  </Link>
                </li>
                <li>
                  <Link to="/AdminVerifications">
                    <FontAwesomeIcon  /> Account Manager
                  </Link>
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
                    <Link to="/AdminCrime">Victim Reports</Link>
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

            {/* Archive section */}
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

        {/* Main Content */}
        <main className="main-content">
          <h1 style={{ marginBottom: 16 }}>Account Manager</h1>
          <AccountManager />
        </main>
      </div>
    </div>
  );
}

export default Dashboard;
