// src/pages/UserProfile.jsx
import React, { useEffect, useMemo, useState, useRef } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faHome,
  faUser,
  faFileInvoice,
  faMapLocation,
  faChartLine,
  faBoxArchive,
  faBell,
  faRightFromBracket,
  faKey,
} from "@fortawesome/free-solid-svg-icons";
import "../assets/css/userinfo.css";

/** API base */
const API_BASE = (import.meta.env.VITE_API_BASE || "https://maritime-backend-0gib.onrender.com/api").replace(/\/$/, "");

/** Auth header */
function authHeader() {
  const raw = localStorage.getItem("token") || localStorage.getItem("access_token") || "";
  if (!raw) return {};
  if (/^(Bearer|Token)\s/i.test(raw)) return { Authorization: raw };
  if (/^[\w-]+\.[\w-]+\.[\w-]+$/.test(raw)) return { Authorization: `Bearer ${raw}` };
  return { Authorization: `Bearer ${raw}` };
}

/** Suggestions */
const STATIONS_SUGGEST = [
  "PRO4A Regional HQ (Camp Vicente Lim, Calamba)",
  "Cavite PPO", "Laguna PPO", "Batangas PPO", "Rizal PPO", "Quezon PPO",
  "Calamba CPS", "San Pablo CPS", "Lucena CPS", "Batangas City CPS",
];
const POLICE_RANKS = [
  "Patrolman/Patrolwoman","Police Corporal","Police Staff Sergeant","Police Master Sergeant",
  "Police Senior Master Sergeant","Police Chief Master Sergeant","Police Executive Master Sergeant",
  "Police Lieutenant","Police Captain","Police Major","Police Lieutenant Colonel","Police Colonel",
  "Police Brigadier General","Police Major General","Police Lieutenant General","Police General",
];
const CIVIL_STATUS = ["Single","Married","Divorced","Widowed"];
const NATIONALITIES = ["Filipino","American","Chinese","Japanese","Korean","Others"];
const MOTHER_OCC = ["Housewife","Employed","Self-Employed","OFW"];
const FATHER_OCC = ["Employed","Self-Employed","OFW"];

/** Helpers */
const toTitle = (s = "") =>
  s.replace(/\b\w/g, ch => ch.toUpperCase());
const onlyDigits = (s="") => s.replace(/\D/g,"");
const isPhone = (v="") => /^09\d{9}$/.test(v);
const isBadge = (v="") => /^\d{6}$/.test(v);

const imageUrl = (p) => {
  const any = p?.profile_image || p?.id_image || p?.image || p?.photo || p?.avatar || "";
  if (!any) return "";
  try { return new URL(any).href; } catch { return any; }
};

const addrToString = (a={}) =>
  [a.address, a.barangay, a.municipality, a.province, a.region].filter(Boolean).join(", ");

/**
 * PhAddressPicker (in-file) — cascading selects for Region → Province → Municipality/City → Barangay
 *
 * Behavior:
 * - Attempts to fetch lists from a public PSGC-like API.
 * - If fetch fails or API unreachable, falls back to text inputs so the user can still type values.
 * - Calls onChange with shape: { address, region, province, municipality, barangay }
 *
 * Note: API base used here is a common public PSGC project; adjust `API_BASE_PSGC` if you have an internal endpoint.
 */
function PhAddressPicker({
  labelPrefix = "Address",
  value = {},
  onChange = ()=>{},
  requireAddressLine = false,
  variant = "card",
}) {
  const API_BASE_PSGC = "https://psgc.gitlab.io/api"; // try public PSGC API; adjust if you have your own
  const mounted = useRef(true);

  const [regions, setRegions] = useState([]);
  const [provinces, setProvinces] = useState([]);
  const [cities, setCities] = useState([]);
  const [barangays, setBarangays] = useState([]);

  const [loadingRegions, setLoadingRegions] = useState(false);
  const [loadingProvinces, setLoadingProvinces] = useState(false);
  const [loadingCities, setLoadingCities] = useState(false);
  const [loadingBarangays, setLoadingBarangays] = useState(false);

  const [apiAvailable, setApiAvailable] = useState(true);

  // local controlled copies to avoid causing parent render loops while typing
  const [local, setLocal] = useState({
    address: value.address || "",
    region: value.region || "",
    province: value.province || "",
    municipality: value.municipality || "",
    barangay: value.barangay || "",
  });

  // keep local in sync when parent value changes (but don't set continuously to avoid loops)
  useEffect(()=> {
    setLocal({
      address: value.address || "",
      region: value.region || "",
      province: value.province || "",
      municipality: value.municipality || "",
      barangay: value.barangay || "",
    });
  // only when parent value object identity or its fields change
  }, [value.address, value.region, value.province, value.municipality, value.barangay]);

  useEffect(()=> {
    mounted.current = true;
    (async () => {
      try {
        setLoadingRegions(true);
        // many PSGC instances expose /regions.json or /regions endpoint; try both patterns
        const tryUrls = [
          `${API_BASE_PSGC}/regions.json`,
          `${API_BASE_PSGC}/regions`,
          `${API_BASE_PSGC}/regions-all.json`,
        ];
        let got = null;
        for (const u of tryUrls) {
          try {
            const res = await fetch(u);
            if (!res.ok) continue;
            const data = await res.json();
            got = data;
            break;
          } catch (e) { continue; }
        }
        if (!got) throw new Error("Regions not found");
        // map to { code, name }
        const mapped = Array.isArray(got) ? got.map(r=>({ code: r.code || r.region_code || r.id || r.psgc_code || r.code_psgc || r.psgc, name: r.name || r.region })) : [];
        if (mounted.current) setRegions(mapped);
      } catch (err) {
        // mark API unavailable — fallback to text inputs
        if (mounted.current) setApiAvailable(false);
      } finally {
        if (mounted.current) setLoadingRegions(false);
      }
    })();
    return () => { mounted.current = false; };
  }, []);

  // fetch provinces when region selected (try multiple endpoint patterns)
  useEffect(()=> {
    if (!apiAvailable) return;
    if (!local.region) {
      setProvinces([]); setCities([]); setBarangays([]);
      return;
    }
    let cancelled = false;
    (async ()=> {
      try {
        setLoadingProvinces(true);
        // region might be stored as name or code; try to find code first
        const chosen = regions.find(r => r.name === local.region || r.code === local.region) || regions.find(r => String(local.region).toLowerCase().includes(String(r.name || "").toLowerCase()));
        const regionCode = chosen?.code;
        const tryUrls = regionCode ? [
          // endpoints that accept region code
          `${API_BASE_PSGC}/regions/${regionCode}/provinces.json`,
          `${API_BASE_PSGC}/regions/${regionCode}/provinces`,
          `${API_BASE_PSGC}/provinces.json?region_code=${regionCode}`,
        ] : [
          // fallback: try provinces list then filter by region name
          `${API_BASE_PSGC}/provinces.json`,
          `${API_BASE_PSGC}/provinces`,
        ];
        let got = null;
        for (const u of tryUrls) {
          try {
            const res = await fetch(u);
            if (!res.ok) continue;
            const data = await res.json();
            got = data;
            break;
          } catch (e) { continue; }
        }
        if (!got) { setApiAvailable(false); return; }
        // filter by region if necessary
        let mapped = Array.isArray(got) ? got.map(p=>({ code: p.code || p.province_code || p.id, name: p.name || p.province || p.prov })) : [];
        if (!regionCode && local.region) {
          mapped = mapped.filter(p => (p.name || "").toLowerCase().includes((local.region||"").toLowerCase()));
        }
        if (!cancelled) setProvinces(mapped);
      } catch (e) {
        if (!cancelled) setApiAvailable(false);
      } finally {
        if (!cancelled) setLoadingProvinces(false);
      }
    })();
    return ()=> { cancelled=true; };
  }, [local.region, apiAvailable, regions]);

  // fetch cities when province changes
  useEffect(()=> {
    if (!apiAvailable) return;
    if (!local.province) {
      setCities([]); setBarangays([]);
      return;
    }
    let cancelled = false;
    (async ()=> {
      try {
        setLoadingCities(true);
        const chosenProv = provinces.find(p => p.name === local.province || p.code === local.province) || provinces.find(p => String(local.province).toLowerCase().includes(String(p.name || "").toLowerCase()));
        const provCode = chosenProv?.code;
        const tryUrls = provCode ? [
          `${API_BASE_PSGC}/provinces/${provCode}/cities-municipalities.json`,
          `${API_BASE_PSGC}/provinces/${provCode}/cities.json`,
          `${API_BASE_PSGC}/cities.json?province_code=${provCode}`,
        ] : [
          `${API_BASE_PSGC}/cities.json`,
          `${API_BASE_PSGC}/cities`,
        ];
        let got = null;
        for (const u of tryUrls) {
          try {
            const res = await fetch(u);
            if (!res.ok) continue;
            const data = await res.json();
            got = data;
            break;
          } catch (e) { continue; }
        }
        if (!got) { setApiAvailable(false); return; }
        const mapped = Array.isArray(got) ? got.map(c=>({ code: c.code || c.city_code || c.id, name: c.name || c.city || c.municipality })) : [];
        // optional filter by prov name if no provCode
        let filtered = mapped;
        if (!provCode && local.province) {
          filtered = mapped.filter(c => (c.name || "").toLowerCase().includes((local.province||"").toLowerCase()));
        }
        if (!cancelled) setCities(filtered);
      } catch (e) {
        if (!cancelled) setApiAvailable(false);
      } finally {
        if (!cancelled) setLoadingCities(false);
      }
    })();
    return ()=> { cancelled = true; };
  }, [local.province, provinces, apiAvailable]);

  // fetch barangays when municipality/city changes
  useEffect(()=> {
    if (!apiAvailable) return;
    if (!local.municipality) {
      setBarangays([]);
      return;
    }
    let cancelled = false;
    (async ()=> {
      try {
        setLoadingBarangays(true);
        const chosenCity = cities.find(c => c.name === local.municipality || c.code === local.municipality) || cities.find(c => String(local.municipality).toLowerCase().includes(String(c.name || "").toLowerCase()));
        const cityCode = chosenCity?.code;
        const tryUrls = cityCode ? [
          `${API_BASE_PSGC}/cities-municipalities/${cityCode}/barangays.json`,
          `${API_BASE_PSGC}/cities/${cityCode}/barangays.json`,
          `${API_BASE_PSGC}/barangays.json?city_code=${cityCode}`,
        ] : [
          `${API_BASE_PSGC}/barangays.json`,
          `${API_BASE_PSGC}/barangays`,
        ];
        let got = null;
        for (const u of tryUrls) {
          try {
            const res = await fetch(u);
            if (!res.ok) continue;
            const data = await res.json();
            got = data;
            break;
          } catch (e) { continue; }
        }
        if (!got) { setApiAvailable(false); return; }
        const mapped = Array.isArray(got) ? got.map(b=>({ code: b.code || b.barangay_code || b.id, name: b.name || b.barangay })) : [];
        // optional filter by municipality name if no code
        let filtered = mapped;
        if (!cityCode && local.municipality) {
          filtered = mapped.filter(b => (b.name || "").toLowerCase().includes((local.municipality||"").toLowerCase()));
        }
        if (!cancelled) setBarangays(filtered);
      } catch (e) {
        if (!cancelled) setApiAvailable(false);
      } finally {
        if (!cancelled) setLoadingBarangays(false);
      }
    })();
    return ()=> { cancelled = true; };
  }, [local.municipality, cities, apiAvailable]);

  // whenever local changes, notify parent (debounced-ish by useEffect)
  useEffect(()=> {
    // send normalized values to parent
    onChange({
      address: local.address || "",
      region: local.region || "",
      province: local.province || "",
      municipality: local.municipality || "",
      barangay: local.barangay || "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [local.address, local.region, local.province, local.municipality, local.barangay]);

  // helpers for controlled selects / inputs
  const update = (patch) => setLocal(prev => ({ ...prev, ...patch }));

  // render helpers
  const renderSelectOrInput = (label, valueKey, options, loading, placeholder) => {
    if (!apiAvailable) {
      return (
        <div className="up-input">
          <label>{label}</label>
          <input
            value={local[valueKey] || ""}
            onChange={(e)=>update({ [valueKey]: toTitle(e.target.value) })}
            placeholder={placeholder}
          />
        </div>
      );
    }
    return (
      <div className="up-input">
        <label>{label}</label>
        <select
          value={local[valueKey] || ""}
          onChange={(e)=>update({ [valueKey]: e.target.value })}
        >
          <option value="">{loading ? `Loading ${label}…` : `Select ${label}`}</option>
          {Array.isArray(options) && options.map(opt => (
            <option key={opt.code || opt.name} value={opt.name || opt}>
              {opt.name || opt}
            </option>
          ))}
        </select>
      </div>
    );
  };

  const wrapperClassName = variant === "embedded" ? "up-addr-box" : "up-card";

  return (
    <div className={wrapperClassName}>
      <div className="up-cardtitle">{labelPrefix}</div>
      <div className="up-grid-3">
        {requireAddressLine && (
          <div className="up-input">
            <label>Address Line</label>
            <input
              value={local.address || ""}
              onChange={(e)=>update({ address: toTitle(e.target.value) })}
              placeholder="#123 Sampaguita St., Purok 2"
              autoComplete="address-line1"
            />
          </div>
        )}

        {/* Region */}
        {renderSelectOrInput("Region", "region", regions, loadingRegions, "Region IV-A (CALABARZON)")}

        {/* Province */}
        {renderSelectOrInput("Province", "province", provinces, loadingProvinces, "e.g., Laguna")}

        {/* Municipality / City */}
        {renderSelectOrInput("Municipality / City", "municipality", cities, loadingCities, "e.g., Calamba City")}

        {/* Barangay */}
        {renderSelectOrInput("Barangay", "barangay", barangays, loadingBarangays, "e.g., Halang")}
      </div>
      {!apiAvailable && (
        <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
          Address dropdowns are unavailable (API failed). You can still type values manually.
        </div>
      )}
    </div>
  );
}

/** Change-password endpoint candidates */
const CHANGE_PASSWORD_CANDIDATES = [
  { url: (base) => `${base}/user/change-password/`, payload: (cp) => ({ current_password: cp.current, new_password: cp.new1 }) },
  { url: (base) => `${base}/auth/users/set_password/`, payload: (cp) => ({ current_password: cp.current, new_password: cp.new1 }) },   // Djoser
  { url: (base) => `${base}/auth/password/change/`, payload: (cp) => ({ old_password: cp.current, new_password1: cp.new1, new_password2: cp.new2 }) }, // dj-rest-auth
];

/** Main page */
export default function UserProfile() {
  // Sidebar + menus
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [submenuOpen, setSubmenuOpen] = useState(false);
  const navigate = useNavigate();
  const toggleSidebar = () => setSidebarOpen((s) => !s);
  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    navigate("/Userlogin");
  };

  // Auth guard
  useEffect(() => {
    const t = localStorage.getItem("token") || localStorage.getItem("access_token");
    if (!t) navigate("/Userlogin");
  }, [navigate]);

  // Profile states
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [editing, setEditing] = useState(false);
  const today = new Date().toISOString().slice(0,10);
  const minDOB = "1900-01-01";

  // Data model
  const blank = {
    id: null,
    id_image: null,
    profile_image: "",

    first_name: "", middle_name: "", last_name: "", suffix: "",
    officer_id: "", email: "", phone: "",

    department: "", section: "", sex: "", gender: "",
    height: "", weight: "", birth_date: "", birth_place: "",
    officer_type: "", regular_officer: "", civil_status: "",
    nationality: "", religion: "",

    lifelong_learner: false, indigenous: false,

    residential_address: "", residential_region: "",
    residential_province: "", residential_municipality: "",
    residential_barangay: "",

    permanent_address: "", permanent_region: "",
    permanent_province: "", permanent_municipality: "",
    permanent_barangay: "",

    father_first_name: "", father_middle_name: "", father_last_name: "",
    father_occupation: "", father_dob: "", father_contact: "",
    father_region: "", father_province: "", father_municipality: "", father_barangay: "",

    mother_first_name: "", mother_middle_name: "", mother_last_name: "",
    mother_occupation: "", mother_dob: "", mother_contact: "",
    mother_region: "", mother_province: "", mother_municipality: "", mother_barangay: "",
  };

  const [m, setM] = useState(blank);
  const [previewIdImg, setPreviewIdImg] = useState(null); // ✅ ensure defined

  const looksEmpty = (p = {}) => {
    const keys = ["first_name","last_name","section","officer_type","sex","birth_date"];
    return !keys.some(k => (p?.[k] ?? "").toString().trim().length > 0);
  };

  // Live preview for uploaded ID image
  useEffect(() => {
    if (m.id_image instanceof File) {
      const url = URL.createObjectURL(m.id_image);
      setPreviewIdImg(url);
      return () => URL.revokeObjectURL(url);
    }
    setPreviewIdImg(null);
  }, [m.id_image]);

  // Load profile
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const res = await axios.get(`${API_BASE}/personnel/me/`, {
          headers: authHeader(),
          validateStatus: () => true,
        });

        if (res.status === 401 || res.status === 403) {
          navigate("/Userlogin");
          return;
        }
        if (res.status === 404) {
          if (!cancelled) {
            setM(blank);
            setEditing(true);
          }
          return;
        }
        if (res.status !== 200) {
          throw new Error(res.data?.detail || "Failed to load profile.");
        }

        const data = res.data || {};
        const next = {
          ...blank,
          ...data,
          lifelong_learner: !!data.lifelong_learner,
          indigenous: !!data.indigenous,
        };
        if (!cancelled) {
          setM(next);
          setEditing(looksEmpty(next)); // auto-open edit if empty
        }
      } catch (e) {
        if (!cancelled) {
          setError(e?.response?.data?.detail || e.message || "Failed to load profile.");
          setEditing(false);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [navigate]);

  const onChange = (e) => {
    const { name, value, type, files } = e.target;
    if (type === "file") {
      setM((p)=>({ ...p, [name]: files?.[0] || null }));
      return;
    }
    const plain = new Set(["email","phone","officer_id","religion","regular_officer"]);
    setM((p)=>({ ...p, [name]: plain.has(name) ? value : toTitle(value) }));
  };

  // Address setters used by PhAddressPicker
  const setResidential = (v) => setM((p)=>(({
    ...p,
    residential_address: v.address || "",
    residential_region: v.region || "",
    residential_province: v.province || "",
    residential_municipality: v.municipality || "",
    residential_barangay: v.barangay || "",
  })));
  const setPermanent = (v) => setM((p)=>(({
    ...p,
    permanent_address: v.address || "",
    permanent_region: v.region || "",
    permanent_province: v.province || "",
    permanent_municipality: v.municipality || "",
    permanent_barangay: v.barangay || "",
  })));

  const setMotherAddr = (v) => setM(p=>({
    ...p,
    mother_region: v.region || "",
    mother_province: v.province || "",
    mother_municipality: v.municipality || "",
    mother_barangay: v.barangay || "",
  }));
  const setFatherAddr = (v) => setM(p=>({
    ...p,
    father_region: v.region || "",
    father_province: v.province || "",
    father_municipality: v.municipality || "",
    father_barangay: v.barangay || "",
  }));

  const resPack = useMemo(()=>(({
    address: m.residential_address,
    region: m.residential_region,
    province: m.residential_province,
    municipality: m.residential_municipality,
    barangay: m.residential_barangay,
  })), [m.residential_address, m.residential_region, m.residential_province, m.residential_municipality, m.residential_barangay]);

  const permPack = useMemo(()=>(({
    address: m.permanent_address,
    region: m.permanent_region,
    province: m.permanent_province,
    municipality: m.permanent_municipality,
    barangay: m.permanent_barangay,
  })), [m.permanent_address, m.permanent_region, m.permanent_province, m.permanent_municipality, m.permanent_barangay]);

  const convertDate = (d) => {
    if (!d) return "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
    const [mm, dd, yy] = String(d).split("/");
    if (!mm || !dd || !yy) return "";
    return `${yy}-${mm.padStart(2,"0")}-${dd.padStart(2,"0")}`;
  };

  const save = async (e) => {
    e.preventDefault();
    setError(""); setOk("");

    if (m.officer_id && !isBadge(m.officer_id)) return setError("Badge number must be 6 digits.");
    if (m.phone && !isPhone(m.phone))        return setError("Phone must be 11 digits starting 09.");
    if (m.father_contact && !isPhone(m.father_contact)) return setError("Father's contact invalid.");
    if (m.mother_contact && !isPhone(m.mother_contact)) return setError("Mother's contact invalid.");

    const required = [
      ["first_name", m.first_name],
      ["last_name", m.last_name],
      ["section", m.section],
      ["officer_type", m.officer_type],
      ["sex", m.sex || m.gender],
      ["birth_date", m.birth_date],
      ["birth_place", m.birth_place],
      ["civil_status", m.civil_status],
      ["nationality", m.nationality],
      ["religion", m.religion],
    ];
    if (required.find(([_, v]) => !v)) return setError("Please complete required fields.");

    try {
      setSaving(true);
      const fd = new FormData();

      if (m.id_image instanceof File) fd.append("id_image", m.id_image);

      fd.append("first_name", m.first_name);
      fd.append("middle_name", m.middle_name || "");
      fd.append("last_name", m.last_name);
      fd.append("suffix", m.suffix || "");
      if (m.officer_id) fd.append("officer_id", m.officer_id);
      fd.append("email", m.email || "");
      fd.append("phone", m.phone || "");

      fd.append("department", m.department || "");
      fd.append("section", m.section);
      fd.append("sex", m.sex);
      fd.append("gender", m.gender || m.sex);
      fd.append("height", m.height || "");
      fd.append("weight", m.weight || "");
      fd.append("birth_date", convertDate(m.birth_date));
      fd.append("birth_place", m.birth_place);
      fd.append("officer_type", m.officer_type);
      fd.append("regular_officer", m.regular_officer || "");
      fd.append("civil_status", m.civil_status);
      fd.append("nationality", m.nationality);
      fd.append("religion", m.religion);

      fd.append("lifelong_learner", m.lifelong_learner ? "true" : "false");
      fd.append("indigenous", m.indigenous ? "true" : "false");

      fd.append("residential_address", m.residential_address || "");
      fd.append("residential_region", m.residential_region || "");
      fd.append("residential_province", m.residential_province || "");
      fd.append("residential_municipality", m.residential_municipality || "");
      fd.append("residential_barangay", m.residential_barangay || "");

      fd.append("permanent_address", m.permanent_address || "");
      fd.append("permanent_region", m.permanent_region || "");
      fd.append("permanent_province", m.permanent_province || "");
      fd.append("permanent_municipality", m.permanent_municipality || "");
      fd.append("permanent_barangay", m.permanent_barangay || "");

      const addParent = (who, first, mid, last, occ, dob, contact, region, province, municipality, barangay) => {
        fd.append(`${who}_first_name`, first || "");
        fd.append(`${who}_middle_name`, mid || "");
        fd.append(`${who}_last_name`, last || "");
        fd.append(`${who}_occupation`, occ || "");
        fd.append(`${who}_dob`, convertDate(dob) || "");
        fd.append(`${who}_contact`, contact || "");
        fd.append(`${who}_region`, region || "");
        fd.append(`${who}_province`, province || "");
        fd.append(`${who}_municipality`, municipality || "");
        fd.append(`${who}_barangay`, barangay || "");
      };
      addParent("father", m.father_first_name, m.father_middle_name, m.father_last_name, m.father_occupation, m.father_dob, m.father_contact, m.father_region, m.father_province, m.father_municipality, m.father_barangay);
      addParent("mother", m.mother_first_name, m.mother_middle_name, m.mother_last_name, m.mother_occupation, m.mother_dob, m.mother_contact, m.mother_region, m.mother_province, m.mother_municipality, m.mother_barangay);

      const res = await axios.patch(`${API_BASE}/personnel/me/`, fd, {
        headers: { ...authHeader() },
        validateStatus: () => true,
      });

      if (res.status === 401 || res.status === 403) {
        navigate("/Userlogin");
        return;
      }
      if (res.status >= 200 && res.status < 300) {
        const data = res.data || {};
        setM((p)=>({ ...p, ...data, lifelong_learner: !!data.lifelong_learner, indigenous: !!data.indigenous, id_image: null }));
        setOk("Saved successfully.");
        setEditing(false);
      } else {
        throw new Error(
          res.data?.detail ||
          (typeof res.data === "string" ? res.data : JSON.stringify(res.data)) ||
          "Failed to save."
        );
      }
    } catch (e) {
      setError(e?.message || "Failed to save.");
    } finally {
      setSaving(false);
      setTimeout(()=>setOk(""), 3000);
    }
  };

  /** Change Password */
  const [cpOpen, setCpOpen] = useState(false);
  const [cpLoading, setCpLoading] = useState(false);
  const [cpErr, setCpErr] = useState("");
  const [cpMsg, setCpMsg] = useState("");
  const [cp, setCp] = useState({ current: "", new1: "", new2: "" });

  const submitChangePassword = async (e) => {
    e.preventDefault();
    setCpErr(""); setCpMsg("");

    if (!cp.current || !cp.new1 || !cp.new2) return setCpErr("Please fill in all fields.");
    if (cp.new1 !== cp.new2) return setCpErr("New passwords do not match.");
    if (cp.new1.length < 8)  return setCpErr("Password must be at least 8 characters.");

    try {
      setCpLoading(true);
      let success = false;
      let lastErr = "Failed to change password.";

      for (const cand of CHANGE_PASSWORD_CANDIDATES) {
        const url = cand.url(API_BASE);
        const payload = cand.payload(cp);

        const res = await axios.post(url, payload, {
          headers: { ...authHeader() },
          validateStatus: () => true,
        });

        if (res.status === 401 || res.status === 403) {
          navigate("/Userlogin");
          return;
        }

        if (res.status >= 200 && res.status < 300) {
          success = true;
          break;
        } else if (res.status === 404) {
          continue; // try next candidate
        } else {
          lastErr =
            res.data?.detail ||
            res.data?.non_field_errors?.[0] ||
            res.data?.current_password?.[0] ||
            res.data?.new_password?.[0] ||
            res.data?.new_password1?.[0] ||
            res.data?.new_password2?.[0] ||
            (typeof res.data === "string" ? res.data : JSON.stringify(res.data)) ||
            lastErr;
          break;
        }
      }

      if (success) {
        setCpMsg("Password changed successfully.");
        setCp({ current: "", new1: "", new2: "" });
      } else {
        setCpErr(lastErr || "No working change-password endpoint.");
      }
    } catch (err) {
      setCpErr(err?.response?.data?.detail || err.message || "Network error.");
    } finally {
      setCpLoading(false);
      setTimeout(() => setCpMsg(""), 3000);
    }
  };

  const visibleImage = previewIdImg || imageUrl(m);
  const fullName = [m.first_name, m.middle_name, m.last_name].filter(Boolean).join(" ") || "Unnamed";
  const rankLabel = m.section || "—";

  return (
    <div>
      {/* Top Navigation */}
      <div className="topnav" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div className="menu-icon" onClick={toggleSidebar} aria-label="Toggle sidebar" style={{ cursor: "pointer" }}>☰</div>
        </div>

        {/* Right side: rank, name, avatar, logout */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ textAlign: "right", lineHeight: 1 }}>
            <div style={{ fontWeight: 600 }}>{rankLabel}</div>
          </div>

          <div style={{ textAlign: "right", lineHeight: 1 }}>

            <div style={{ fontWeight: 600 }}>{fullName}</div>
          </div>

          <button
            onClick={handleLogout}
            title="Logout"
            style={{
              display: "inline-flex",
              gap: 8,
              alignItems: "center",
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid #e6e9ef",
              background: "#fff",
              cursor: "pointer"
            }}
          >
            <FontAwesomeIcon icon={faRightFromBracket} /> Logout
          </button>
        </div>
      </div>

      <div className="container">
        {/* Sidebar */}
        <aside className={`sidebar ${!sidebarOpen ? "collapsed" : ""}`}>
          <div className="logo-section">
            <img src="/assets/logo.png" alt="Logo" />
            <p><strong>User</strong><br />Dashboard</p>
          </div>

          <ul className="nav-links">
            <li>
              <Link to="/UserDashboard">
                <FontAwesomeIcon icon={faHome} /> Home
              </Link>
            </li>

            <li className="active">
              <Link to="/UserProfile">
                <FontAwesomeIcon icon={faUser} /> My Profile
              </Link>
            </li>

            <li>
              <div className="submenu-toggle" onClick={() => setSubmenuOpen((s) => !s)}>
                <FontAwesomeIcon icon={faFileInvoice} /> Incident Reports
              </div>
              {submenuOpen && (
                <ul className="submenu">
                  <li><Link to="/UserViewReport">View Reports</Link></li>
                  <li><Link to="/UserVictimReport">Add Reports</Link></li>

                </ul>
              )}
            </li>

            <li>
              <Link to="/UserMaps">
                <FontAwesomeIcon icon={faMapLocation} /> Maps
              </Link>
            </li>


            <li>
              <button className="logout" onClick={handleLogout}>
                <FontAwesomeIcon icon={faRightFromBracket} /> Logout
              </button>
            </li>
          </ul>
        </aside>

        {/* MAIN CONTENT */}
        <main className={`main-content ${!sidebarOpen ? "sidebar-collapsed" : ""}`}>
          <h2 style={{ display: "flex", alignItems: "center", gap: 12 }}>
            Profile Information
          </h2>

          {!!ok && <div className="up-alert ok" style={{ marginTop: 10 }}>{ok}</div>}
          {!!error && !loading && <div className="up-alert error" style={{ marginTop: 10 }}>{error}</div>}

          {loading ? (
            <div className="card" style={{ border: "1px solid #eee", padding: 16, borderRadius: 12, background: "#fff", marginTop: 12 }}>
              <p>Loading profile…</p>
            </div>
          ) : !editing ? (
            // ===== VIEW MODE =====
            <div className="up-view">
              <div className="up-card up-flex">
                <div className="up-avatar">
                  {visibleImage ? <img src={visibleImage} alt="Profile" /> : <div className="up-avatar-ph">No Image</div>}
                </div>
                <div className="up-kvcol">
                  <div className="up-title">
                    {[m.first_name, m.middle_name, m.last_name].filter(Boolean).join(" ") || "Unnamed"}
                  </div>
                  <div className="up-kv"><span>Badge #</span><b>{m.officer_id || "—"}</b></div>
                  <div className="up-kv"><span>Email</span><b>{m.email || "—"}</b></div>
                  <div className="up-kv"><span>Phone</span><b>{m.phone || "—"}</b></div>
                  <div className="up-kv"><span>Assignment</span><b>{m.officer_type || "—"}</b></div>
                  <div className="up-kv"><span>Rank</span><b>{m.section || "—"}</b></div>
                </div>
                <div style={{ marginLeft: "auto" }}>
                  <button className="up-btn" onClick={()=>setEditing(true)}> Edit</button>
                </div>
              </div>

              <div className="up-card">
                <div className="up-cardtitle">Personal Information</div>
                <div className="up-grid-3">
                  <div className="up-kv"><span>Sex/Gender</span><b>{m.sex || m.gender || "—"}</b></div>
                  <div className="up-kv"><span>Birth Date</span><b>{m.birth_date || "—"}</b></div>
                  <div className="up-kv"><span>Birth Place</span><b>{m.birth_place || "—"}</b></div>
                  <div className="up-kv"><span>Civil Status</span><b>{m.civil_status || "—"}</b></div>
                  <div className="up-kv"><span>Nationality</span><b>{m.nationality || "—"}</b></div>
                  <div className="up-kv"><span>Religion</span><b>{m.religion || "—"}</b></div>
                  <div className="up-kv"><span>Height/Weight</span><b>{[m.height, m.weight].filter(Boolean).join(" / ") || "—"}</b></div>
                  <div className="up-kv"><span>Regular Officer</span><b>{m.regular_officer || "—"}</b></div>
                  {/* <div className="up-kv"><span>Lifelong Learner</span><b>{m.lifelong_learner ? "Yes" : "No"}</b></div>
                  <div className="up-kv"><span>Indigenous</span><b>{m.indigenous ? "Yes" : "No"}</b></div> */}
                </div>
                <div className="up-cardtitle">Addresses</div>
                <div className="up-grid-3">
                  <div className="up-text"><b>Residential:</b> {addrToString({
                    address: m.residential_address, barangay: m.residential_barangay,
                    municipality: m.residential_municipality, province: m.residential_province,
                    region: m.residential_region,
                  }) || "—"}</div>
                  <div className="up-text"><b>Permanent:</b> {addrToString({
                    address: m.permanent_address, barangay: m.permanent_barangay,
                    municipality: m.permanent_municipality, province: m.permanent_province,
                    region: m.permanent_region,
                  }) || "—"}</div>
                </div>

                <div className="up-cardtitle">Family Background</div>
                <div className="up-grid-3">
                  <div>
                    <div className="up-kv"><span>Mother</span><b>{[m.mother_first_name, m.mother_middle_name, m.mother_last_name].filter(Boolean).join(" ") || "—"}</b></div>
                    <div className="up-kv"><span>Occupation</span><b>{m.mother_occupation || "—"}</b></div>
                    <div className="up-kv"><span>DOB</span><b>{m.mother_dob || "—"}</b></div>
                    <div className="up-kv"><span>Contact</span><b>{m.mother_contact || "—"}</b></div>
                    <div className="up-text"><b>Address:</b> {addrToString({
                      barangay: m.mother_barangay, municipality: m.mother_municipality,
                      province: m.mother_province, region: m.mother_region,
                    }) || "—"}</div>
                  </div>


                   <div>
                    <div className="up-kv"><span>Father</span><b>{[m.father_first_name, m.father_middle_name, m.father_last_name].filter(Boolean).join(" ") || "—"}</b></div>
                    <div className="up-kv"><span>Occupation</span><b>{m.father_occupation || "—"}</b></div>
                    <div className="up-kv"><span>DOB</span><b>{m.father_dob || "—"}</b></div>
                    <div className="up-kv"><span>Contact</span><b>{m.father_contact || "—"}</b></div>
                    <div className="up-text"><b>Address:</b> {addrToString({
                      barangay: m.father_barangay, municipality: m.father_municipality,
                      province: m.father_province, region: m.father_region,
                    }) || "—"}</div>
                  </div>
              </div>

            

           
              </div>
            </div>
          ) : (
            // ===== EDIT MODE =====
            <form className="up-form" onSubmit={save} style={{ marginTop: 12 }}>
              <div className="up-card up-edit-shell">

                  <div className="up-panel up-photo-panel">
                    <div className="up-cardtitle">ID / Profile Image</div>
                    <div className="up-imgrow">
                      <div className="up-imgph">
                        {visibleImage ? <img src={visibleImage} alt="Preview" /> : <div className="up-avatar-ph">No Image</div>}
                      </div>
                      <div className="up-input">
                        <label>Upload ID Image</label>
                        <input
                          type="file"
                          name="id_image"
                          accept="image/*"
                          onChange={onChange}
                          aria-label="Upload ID image"
                        />
                        <small className="muted">Accepted: JPG/PNG. Max ~5MB (depends on server config).</small>
                      </div>
                    </div>
                  </div>


                <div className="up-divider">Basic Information</div>
                <div className="up-grid-3">
                  <div className="up-input">
                    <label>Badge # (6 digits)</label>
                    <input
                      name="officer_id"
                      value={m.officer_id}
                      onChange={onChange}
                      maxLength={6}
                      inputMode="numeric"
                      placeholder="e.g., 123456"
                      autoComplete="off"
                    />
                  </div>

                  <div className="up-input">
                    <label>Email</label>
                    <input
                      name="email"
                      type="email"
                      value={m.email || ""}
                      onChange={onChange}
                      placeholder="name@agency.gov.ph"
                      autoComplete="email"
                    />
                  </div>

                  <div className="up-input">
                    <label>First Name *</label>
                    <input
                      name="first_name"
                      value={m.first_name}
                      onChange={onChange}
                      required
                      placeholder="e.g., Juan"
                      autoComplete="given-name"
                    />
                  </div>

                  <div className="up-input">
                    <label>Middle Name</label>
                    <input
                      name="middle_name"
                      value={m.middle_name}
                      onChange={onChange}
                      placeholder="e.g., Santos"
                      autoComplete="additional-name"
                    />
                  </div>

                  <div className="up-input">
                    <label>Last Name *</label>
                    <input
                      name="last_name"
                      value={m.last_name}
                      onChange={onChange}
                      required
                      placeholder="e.g., Dela Cruz"
                      autoComplete="family-name"
                    />
                  </div>

                  <div className="up-input">
                    <label>Suffix</label>
                    <input
                      name="suffix"
                      value={m.suffix}
                      onChange={onChange}
                      placeholder="Jr., Sr., III"
                      autoComplete="honorific-suffix"
                    />
                  </div>

                  <div className="up-input">
                    <label>Phone</label>
                    <input
                      name="phone"
                      value={m.phone || ""}
                      onChange={(e)=>setM(p=>({...p, phone: onlyDigits(e.target.value).slice(0,11)}))}
                      inputMode="numeric"
                      maxLength={11}
                      placeholder="09XXXXXXXXX"
                      autoComplete="tel-national"
                    />
                  </div>

                  <div className="up-input">
                    <label>Rank *</label>
                    <select
                      name="section"
                      value={m.section}
                      onChange={onChange}
                      required
                      aria-label="Select police rank"
                    >
                      <option value="">Select Rank</option>
                      {POLICE_RANKS.map(r=><option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>

                  <div className="up-input ">
                    <label>Assignment (Station) *</label>
                    <input
                      name="officer_type"
                      list="station-suggest"
                      value={m.officer_type}
                      onChange={onChange}
                      placeholder="Type station… (e.g., Laguna PPO)"
                      required
                      autoComplete="organization"
                    />
                    <datalist id="station-suggest">{STATIONS_SUGGEST.map(s=><option key={s} value={s} />)}</datalist>
                  </div>

                  <div className="up-input ">
                    <label>Sex / Gender *</label>
                    <div className="up-radios">
                      {["Male","Female","Other"].map((g,i)=>(
                        <label key={g}>
                          <input
                            type="radio"
                            name="sex"
                            value={g}
                            checked={m.sex===g}
                            onChange={onChange}
                            required={i===0}
                          /> {g}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="up-input">
                    <label>Birth Date *</label>
                    <input
                      type="date"
                      name="birth_date"
                      value={m.birth_date || ""}
                      onChange={onChange}
                      min={minDOB}
                      max={today}
                      required
                      autoComplete="bday"
                    />
                  </div>

                  <div className="up-input ">
                    <label>Birth Place *</label>
                    <input
                      name="birth_place"
                      value={m.birth_place}
                      onChange={onChange}
                      placeholder="City/Municipality, Province"
                      required
                    />
                  </div>

                  <div className="up-input">
                    <label>Height (cm)</label>
                    <input
                      type="number"
                      name="height"
                      value={m.height || ""}
                      onChange={onChange}
                      min="80"
                      max="250"
                      step="1"
                      placeholder="e.g., 170"
                    />
                  </div>

                  <div className="up-input">
                    <label>Weight (kg)</label>
                    <input
                      type="number"
                      name="weight"
                      value={m.weight || ""}
                      onChange={onChange}
                      min="20"
                      max="300"
                      step="1"
                      placeholder="e.g., 65"
                    />
                  </div>

                  <div className="up-input">
                    <label>Regular Officer</label>
                    <input
                      name="regular_officer"
                      value={m.regular_officer || ""}
                      onChange={onChange}
                      placeholder="Yes / No (or value)"
                    />
                  </div>

                  <div className="up-input">
                    <label>Civil Status *</label>
                    <select
                      name="civil_status"
                      value={m.civil_status}
                      onChange={onChange}
                      required
                    >
                      <option value="">Select Civil Status</option>
                      {CIVIL_STATUS.map(s=><option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>

                  <div className="up-input">
                    <label>Nationality *</label>
                    <select
                      name="nationality"
                      value={m.nationality}
                      onChange={onChange}
                      required
                    >
                      <option value="">Select Nationality</option>
                      {NATIONALITIES.map(n=><option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>

                  <div className="up-input">
                    <label>Religion *</label>
                    <input
                      name="religion"
                      value={m.religion}
                      onChange={onChange}
                      required
                      placeholder="e.g., Roman Catholic"
                    />
                  </div>
                </div>

                <div className="up-divider">Addresses</div>
                <div className="up-edit-columns">
                  <PhAddressPicker
                    labelPrefix="Residential Address"
                    value={resPack}
                    onChange={setResidential}
                    requireAddressLine
                    variant="embedded"
                  />

                  <PhAddressPicker
                    labelPrefix="Permanent Address"
                    value={permPack}
                    onChange={setPermanent}
                    requireAddressLine
                    variant="embedded"
                  />
                </div>

                <div className="up-divider">Family Background</div>
                <div className="up-edit-columns">
                  <div className="up-panel">
                    <div className="up-cardtitle">Mother's Background</div>
                    <div className="up-grid-3">
                      <div className="up-input"><label>First Name</label><input name="mother_first_name" value={m.mother_first_name} onChange={onChange} placeholder="e.g., Maria" /></div>
                      <div className="up-input"><label>Middle Name</label><input name="mother_middle_name" value={m.mother_middle_name} onChange={onChange} placeholder="e.g., Reyes" /></div>
                      <div className="up-input"><label>Last Name</label><input name="mother_last_name" value={m.mother_last_name} onChange={onChange} placeholder="e.g., Santos" /></div>
                      <div className="up-input">
                        <label>Occupation</label>
                        <select name="mother_occupation" value={m.mother_occupation} onChange={onChange}>
                          <option value="">Select</option>{MOTHER_OCC.map(o=><option key={o} value={o}>{o}</option>)}
                        </select>
                      </div>
                      <div className="up-input"><label>Date of Birth</label><input type="date" name="mother_dob" value={m.mother_dob || ""} onChange={onChange} min={minDOB} max={today} /></div>
                      <div className="up-input">
                        <label>Contact</label>
                        <input
                          name="mother_contact"
                          value={m.mother_contact || ""}
                          onChange={(e)=>setM(p=>({...p, mother_contact: onlyDigits(e.target.value).slice(0,11)}))}
                          inputMode="numeric"
                          maxLength={11}
                          placeholder="09XXXXXXXXX"
                        />
                      </div>
                    </div>

                    <PhAddressPicker
                      labelPrefix="Mother's Address"
                      value={{
                        address: "",
                        region: m.mother_region,
                        province: m.mother_province,
                        municipality: m.mother_municipality,
                        barangay: m.mother_barangay,
                      }}
                      onChange={setMotherAddr}
                      requireAddressLine={false}
                      variant="embedded"
                    />
                  </div>

                  <div className="up-panel">
                    <div className="up-cardtitle">Father's Background</div>
                    <div className="up-grid-3">
                      <div className="up-input"><label>First Name</label><input name="father_first_name" value={m.father_first_name} onChange={onChange} placeholder="e.g., Jose" /></div>
                      <div className="up-input"><label>Middle Name</label><input name="father_middle_name" value={m.father_middle_name} onChange={onChange} placeholder="e.g., Cruz" /></div>
                      <div className="up-input"><label>Last Name</label><input name="father_last_name" value={m.father_last_name} onChange={onChange} placeholder="e.g., Dela Cruz" /></div>
                      <div className="up-input">
                        <label>Occupation</label>
                        <select name="father_occupation" value={m.father_occupation} onChange={onChange}>
                          <option value="">Select</option>{FATHER_OCC.map(o=><option key={o} value={o}>{o}</option>)}
                        </select>
                      </div>
                      <div className="up-input"><label>Date of Birth</label><input type="date" name="father_dob" value={m.father_dob || ""} onChange={onChange} min={minDOB} max={today} /></div>
                      <div className="up-input">
                        <label>Contact</label>
                        <input
                          name="father_contact"
                          value={m.father_contact || ""}
                          onChange={(e)=>setM(p=>({...p, father_contact: onlyDigits(e.target.value).slice(0,11)}))}
                          inputMode="numeric"
                          maxLength={11}
                          placeholder="09XXXXXXXXX"
                        />
                      </div>
                    </div>

                    <PhAddressPicker
                      labelPrefix="Father's Address"
                      value={{
                        address: "",
                        region: m.father_region,
                        province: m.father_province,
                        municipality: m.father_municipality,
                        barangay: m.father_barangay,
                      }}
                      onChange={setFatherAddr}
                      requireAddressLine={false}
                      variant="embedded"
                    />
                  </div>
                </div>

                <div className="up-actions">
                  <button
                    type="button"
                    className="up-btn ghost"
                    onClick={()=>{ setEditing(false); setError(""); setOk(""); setM((x)=>({...x, id_image:null})); }}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="up-btn" disabled={saving}>
                    {saving ? "Saving…" : "Save Changes"}
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* ===== CHANGE PASSWORD ===== */}
          <div className="up-card" style={{ marginTop: 16 }}>
            <div className="up-cardtitle" style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <span><FontAwesomeIcon icon={faKey} /> Change Password</span>
              <button
                type="button"
                className="up-btn ghost"
                onClick={() => setCpOpen((s)=>!s)}
                aria-expanded={cpOpen}
              >
                {cpOpen ? "Hide" : "Show"}
              </button>
            </div>

            {cpOpen && (
              <form onSubmit={submitChangePassword} className="up-grid-3" style={{ marginTop: 8 }}>
                {!!cpMsg && <div className="up-alert ok">{cpMsg}</div>}
                {!!cpErr && <div className="up-alert error">{cpErr}</div>}

                <div className="up-input">
                  <label>Current Password</label>
                  <input
                    type="password"
                    value={cp.current}
                    onChange={(e)=>setCp(p=>({ ...p, current: e.target.value }))}
                    autoComplete="current-password"
                    placeholder="Enter current password"
                  />
                </div>
                <div className="up-input">
                  <label>New Password</label>
                  <input
                    type="password"
                    value={cp.new1}
                    onChange={(e)=>setCp(p=>({ ...p, new1: e.target.value }))}
                    autoComplete="new-password"
                    placeholder="At least 8 characters"
                  />
                </div>
                <div className="up-input">
                  <label>Confirm New Password</label>
                  <input
                    type="password"
                    value={cp.new2}
                    onChange={(e)=>setCp(p=>({ ...p, new2: e.target.value }))}
                    autoComplete="new-password"
                    placeholder="Re-type new password"
                  />
                </div>

                <div className="up-actions" style={{ gridColumn: "1/-1" }}>
                  <button type="submit" className="up-btn" disabled={cpLoading}>
                    {cpLoading ? "Changing…" : "Change Password"}
                  </button>
                </div>
              </form>
            )}
          </div>
          {/* ===================================================== */}
        </main>
      </div>
    </div>
  );
}
