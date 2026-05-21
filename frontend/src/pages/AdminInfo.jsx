// src/pages/AdminInfo.jsx
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import Swal from "sweetalert2";
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
import "../assets/css/AdminInfo.css";

/* =========================================
  CONFIG
========================================= */
const API_BASE = (import.meta.env.VITE_API_BASE || "http://localhost:8000").replace(
  /\/$/,
  ""
);

/** Auth header – reuse pattern sa ibang pages */
function authHeader() {
  const raw =
    localStorage.getItem("token") ||
    localStorage.getItem("access_token") ||
    localStorage.getItem("access") ||
    "";

  if (!raw) return {};

  if (/^(Bearer|Token)\s/i.test(raw)) {
    return { Authorization: raw };
  }

  if (/^[\w-]+\.[\w-]+\.[\w-]+$/.test(raw)) {
    return { Authorization: `Bearer ${raw}` };
  }

  return { Authorization: raw };
}

const toAbsoluteUrl = (urlOrPath) => {
  if (!urlOrPath) return "";
  try {
    return new URL(urlOrPath).href;
  } catch (_) {}
  const path = urlOrPath.startsWith("/") ? urlOrPath : `/${urlOrPath}`;
  return `${API_BASE}${path}`;
};

const getProfileImageUrl = (p) => {
  const anyField =
    p?.profile_image || p?.id_image || p?.image || p?.photo || p?.avatar || "";
  return anyField ? toAbsoluteUrl(anyField) : "";
};

/* =========================================
  Helpers
========================================= */
const toTitleCase = (s = "") =>
  s
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (ch) => ch.toUpperCase());

const onlyDigits = (s = "") => s.replace(/\D/g, "");

/* Calculate age from YYYY-MM-DD */
function computeAge(dateStr) {
  if (!dateStr) return null;
  const dob = new Date(dateStr);
  if (Number.isNaN(dob.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age;
}

// ✅ JS side validation for PH phones
const isPhoneValid = (v) => /^09\d{9}$/.test(v);

/* =========================================
  Lists (R4A Stations + PNP Ranks)
========================================= */
const STATIONS_R4A = [
  "PRO4A Regional HQ (Camp Vicente Lim, Calamba)",
  "Cavite PPO",
  "Laguna PPO",
  "Batangas PPO",
  "Rizal PPO",
  "Quezon PPO",
  "Cavite City CPS",
  "Bacoor CPS",
  "Imus CPS",
  "Dasmariñas CPS",
  "General Trias CPS",
  "Tagaytay CPS",
  "Trece Martires CPS",
  "Alfonso MPS",
  "Amadeo MPS",
  "Carmona CPS",
  "General Mariano Alvarez MPS",
  "Indang MPS",
  "Kawit MPS",
  "Magallanes MPS",
  "Maragondon MPS",
  "Naic MPS",
  "Noveleta MPS",
  "Rosario MPS",
  "Silang MPS",
  "Tanza MPS",
  "Ternate MPS",
  "Calamba CPS",
  "San Pablo CPS",
  "Binan CPS",
  "Santa Rosa CPS",
  "Cabuyao CPS",
  "San Pedro CPS",
  "Alaminos MPS",
  "Bay MPS",
  "Calauan MPS",
  "Cavinti MPS",
  "Famy MPS",
  "Kalayaan MPS",
  "Liliw MPS",
  "Los Baños MPS",
  "Luisiana MPS",
  "Lumban MPS",
  "Mabitac MPS",
  "Magdalena MPS",
  "Majayjay MPS",
  "Nagcarlan MPS",
  "Paete MPS",
  "Pagsanjan MPS",
  "Pakil MPS",
  "Pangil MPS",
  "Pila MPS",
  "Rizal (Laguna) MPS",
  "Santa Cruz MPS",
  "Santa Maria MPS",
  "Siniloan MPS",
  "Victoria MPS",
  "Batangas City CPS",
  "Lipa CPS",
  "Tanauan CPS",
  "Agoncillo MPS",
  "Alitagtag MPS",
  "Balayan MPS",
  "Balete MPS",
  "Bauan MPS",
  "Calaca CPS",
  "Calatagan MPS",
  "Cuenca MPS",
  "Ibaan MPS",
  "Laurel MPS",
  "Lemery MPS",
  "Lian MPS",
  "Lobo MPS",
  "Mabini MPS",
  "Malvar MPS",
  "Mataasnakahoy MPS",
  "Nasugbu MPS",
  "Padre Garcia MPS",
  "Rosario (Batangas) MPS",
  "San Jose (Batangas) MPS",
  "San Juan (Batangas) MPS",
  "San Luis (Batangas) MPS",
  "San Nicolas MPS",
  "San Pascual MPS",
  "Santa Teresita MPS",
  "Santo Tomas CPS",
  "Taal MPS",
  "Taysan MPS",
  "Tingloy MPS",
  "Tuy MPS",
  "Antipolo CPS",
  "Cainta MPS",
  "Taytay MPS",
  "Angono MPS",
  "Binangonan MPS",
  "Cardona MPS",
  "Baras MPS",
  "Jalajala MPS",
  "Morong MPS",
  "Pililla MPS",
  "Rodriguez (Montalban) MPS",
  "San Mateo MPS",
  "Tanay MPS",
  "Teresa MPS",
  "Lucena CPS",
  "Tayabas CPS",
  "Agdangan MPS",
  "Alabat MPS",
  "Atimonan MPS",
  "Buenavista (Quezon) MPS",
  "Burdeos MPS",
  "Calauag MPS",
  "Candelaria MPS",
  "Catanauan MPS",
  "Dolores (Quezon) MPS",
  "General Luna (Quezon) MPS",
  "General Nakar MPS",
  "Guinayangan MPS",
  "Gumaca MPS",
  "Infanta MPS",
  "Jomalig MPS",
  "Lopez MPS",
  "Lucban MPS",
  "Macalelon MPS",
  "Mauban MPS",
  "Mulanay MPS",
  "Padre Burgos (Quezon) MPS",
  "Pagbilao MPS",
  "Panukulan MPS",
  "Patnanungan MPS",
  "Perez MPS",
  "Pitogo (Quezon) MPS",
  "Plaridel (Quezon) MPS",
  "Polillo MPS",
  "Quezon (Quezon) MPS",
  "Real MPS",
  "Sampaloc (Quezon) MPS",
  "Sariaya MPS",
  "Tagkawayan MPS",
  "Tiaong MPS",
  "Unisan MPS",
];

const POLICE_RANKS = [
  "Patrolman/Patrolwoman",
  "Police Corporal",
  "Police Staff Sergeant",
  "Police Master Sergeant",
  "Police Senior Master Sergeant",
  "Police Chief Master Sergeant",
  "Police Executive Master Sergeant",
  "Police Lieutenant",
  "Police Captain",
  "Police Major",
  "Police Lieutenant Colonel",
  "Police Colonel",
  "Police Brigadier General",
  "Police Major General",
  "Police Lieutenant General",
  "Police General",
];

/* =========================================
  PSGC Address Picker
========================================= */
function PhAddressPicker({ labelPrefix, value, onChange, requireAddressLine }) {
  const [regions, setRegions] = useState([]);
  const [provinces, setProvinces] = useState([]);
  const [cityMuns, setCityMuns] = useState([]);
  const [barangays, setBarangays] = useState([]);

  useEffect(() => {
    axios
      .get("https://psgc.cloud/api/regions")
      .then((res) => setRegions(res.data || []))
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!value.regionCode) {
      setProvinces([]);
      return;
    }
    axios
      .get(`https://psgc.cloud/api/regions/${value.regionCode}/provinces`)
      .then((res) => setProvinces(res.data || []))
      .catch(console.error);
  }, [value.regionCode]);

  useEffect(() => {
    if (!value.provinceCode) {
      setCityMuns([]);
      return;
    }
    axios
      .get(
        `https://psgc.cloud/api/provinces/${value.provinceCode}/cities-municipalities`
      )
      .then((res) => setCityMuns(res.data || []))
      .catch(console.error);
  }, [value.provinceCode]);

  useEffect(() => {
    if (!value.cityMunCode || !value.cityMunKind) {
      setBarangays([]);
      return;
    }
    const base =
      value.cityMunKind === "city"
        ? `https://psgc.cloud/api/cities/${value.cityMunCode}/barangays`
        : `https://psgc.cloud/api/municipalities/${value.cityMunCode}/barangays`;
    axios
      .get(base)
      .then((res) => setBarangays(res.data || []))
      .catch(console.error);
  }, [value.cityMunCode, value.cityMunKind]);

  const regionNameByCode = useMemo(
    () => Object.fromEntries(regions.map((r) => [r.code, r.name])),
    [regions]
  );
  const provinceNameByCode = useMemo(
    () => Object.fromEntries(provinces.map((p) => [p.code, p.name])),
    [provinces]
  );
  const cityMunMetaByCode = useMemo(
    () =>
      Object.fromEntries(
        cityMuns.map((cm) => {
          const kind = (cm.type || "").toLowerCase().includes("city")
            ? "city"
            : "municipality";
          return [cm.code, { name: cm.name, kind }];
        })
      ),
    [cityMuns]
  );
  const barangayNameByCode = useMemo(
    () => Object.fromEntries(barangays.map((b) => [b.code, b.name])),
    [barangays]
  );

  const setRegion = (code) => {
    onChange({
      ...value,
      regionCode: code,
      regionName: regionNameByCode[code] || "",
      provinceCode: "",
      provinceName: "",
      cityMunCode: "",
      cityMunName: "",
      cityMunKind: "",
      barangayCode: "",
      barangayName: "",
    });
  };
  const setProvince = (code) => {
    onChange({
      ...value,
      provinceCode: code,
      provinceName: provinceNameByCode[code] || "",
      cityMunCode: "",
      cityMunName: "",
      cityMunKind: "",
      barangayCode: "",
      barangayName: "",
    });
  };
  const setCityMun = (code) => {
    const meta = cityMunMetaByCode[code] || { name: "", kind: "" };
    onChange({
      ...value,
      cityMunCode: code,
      cityMunName: meta.name,
      cityMunKind: meta.kind,
      barangayCode: "",
      barangayName: "",
    });
  };
  const setBarangay = (code) => {
    onChange({
      ...value,
      barangayCode: code,
      barangayName: barangayNameByCode[code] || "",
    });
  };

  const human = [
    value.barangayName,
    value.cityMunName,
    value.provinceName,
    value.regionName,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="section">
      <h3>{labelPrefix}</h3>

      {requireAddressLine && (
        <div className="input-group">
          <label>
            Lot, Block, Purok, Street, etc. <span className="required">*</span>
          </label>
          <input
            value={value.addressLine || ""}
            onChange={(e) =>
              onChange({
                ...value,
                addressLine: toTitleCase(e.target.value),
              })
            }
            placeholder="Hal. #123 Sampaguita St., Purok 2"
            required
          />
        </div>
      )}

      <div className="grid">
        <div className="input-group">
          <label>
            Region <span className="required">*</span>
          </label>
          <select
            value={value.regionCode || ""}
            onChange={(e) => setRegion(e.target.value)}
            required
          >
            <option value="">Select Region</option>
            {regions.map((r) => (
              <option key={r.code} value={r.code}>
                {r.name}
              </option>
            ))}
          </select>
        </div>

        <div className="input-group">
          <label>
            Province <span className="required">*</span>
          </label>
          <select
            value={value.provinceCode || ""}
            onChange={(e) => setProvince(e.target.value)}
            disabled={!value.regionCode}
            required
          >
            <option value="">Select Province</option>
            {provinces.map((p) => (
              <option key={p.code} value={p.code}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div className="input-group">
          <label>
            City / Municipality <span className="required">*</span>
          </label>
          <select
            value={value.cityMunCode || ""}
            onChange={(e) => setCityMun(e.target.value)}
            disabled={!value.provinceCode}
            required
          >
            <option value="">Select City/Municipality</option>
            {cityMuns.map((cm) => {
              const kind = (cm.type || "").toLowerCase().includes("city")
                ? "City"
                : "Municipality";
              return (
                <option key={cm.code} value={cm.code}>
                  {cm.name} ({kind})
                </option>
              );
            })}
          </select>
        </div>

        <div className="input-group">
          <label>
            Barangay <span className="required">*</span>
          </label>
          <select
            value={value.barangayCode || ""}
            onChange={(e) => setBarangay(e.target.value)}
            disabled={!value.cityMunCode}
            required
          >
            <option value="">Select Barangay</option>
            {barangays.map((b) => (
              <option key={b.code} value={b.code}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="selection-preview" aria-live="polite">
        {human ? (
          <>
            Selected: <span className="badge">{human}</span>
          </>
        ) : (
          <span className="muted">Wala pang napipili.</span>
        )}
      </div>
    </div>
  );
}

/* =========================================
  View helpers
========================================= */
const profileToForm = (p = {}, blank = {}) => ({
  ...blank,
  firstName: p.first_name || "",
  middleName: p.middle_name || "",
  lastName: p.last_name || "",
  suffix: p.suffix || "",
  badge_number: p.officer_id || "",
  email: p.email || "",
  phone: p.phone || "",
  section: p.section || "",
  sex: p.sex || p.gender || "",
  gender: p.gender || p.sex || "",
  height: p.height || "",
  weight: p.weight || "",
  birthDate: p.birth_date || "",
  birthPlace: p.birth_place || "",
  officerType: p.officer_type || "",
  regularofficer: p.regular_officer || "",
  civilStatus: p.civil_status || "",
  nationality: p.nationality || "",
  religion: p.religion || "",
  lifelongLearner: !!p.lifelong_learner,

  resAddr: {
    addressLine: p.residential_address_line || p.residential_address || "",
    regionCode: p.residential_region_code || "",
    regionName: p.residential_region || "",
    provinceCode: p.residential_province_code || "",
    provinceName: p.residential_province || "",
    cityMunCode: p.residential_city_mun_code || "",
    cityMunName:
      p.residential_municipality ||
      p.residential_city ||
      p.residential_city_municipality ||
      "",
    cityMunKind: p.residential_city_mun_kind || "",
    barangayCode: p.residential_barangay_code || "",
    barangayName: p.residential_barangay || "",
  },
  permAddr: {
    addressLine: p.permanent_address_line || p.permanent_address || "",
    regionCode: p.permanent_region_code || "",
    regionName: p.permanent_region || "",
    provinceCode: p.permanent_province_code || "",
    provinceName: p.permanent_province || "",
    cityMunCode: p.permanent_city_mun_code || "",
    cityMunName:
      p.permanent_municipality ||
      p.permanent_city ||
      p.permanent_city_municipality ||
      "",
    cityMunKind: p.permanent_city_mun_kind || "",
    barangayCode: p.permanent_barangay_code || "",
    barangayName: p.permanent_barangay || "",
  },

  motherFirstName: p.mother_first_name || "",
  motherMiddleName: p.mother_middle_name || "",
  motherLastName: p.mother_last_name || "",
  motherOccupation: p.mother_occupation || "",
  motherDOB: p.mother_dob || "",
  motherContact: p.mother_contact || "",
  motherAddr: {
    regionCode: p.mother_region_code || "",
    regionName: p.mother_region || "",
    provinceCode: p.mother_province_code || "",
    provinceName: p.mother_province || "",
    cityMunCode: p.mother_city_mun_code || "",
    cityMunName:
      p.mother_municipality ||
      p.mother_city ||
      p.mother_city_municipality ||
      "",
    cityMunKind: p.mother_city_mun_kind || "",
    barangayCode: p.mother_barangay_code || "",
    barangayName: p.mother_barangay || "",
  },

  fatherFirstName: p.father_first_name || "",
  fatherMiddleName: p.father_middle_name || "",
  fatherLastName: p.father_last_name || "",
  fatherOccupation: p.father_occupation || "",
  fatherDOB: p.father_dob || "",
  fatherContact: p.father_contact || "",
  fatherAddr: {
    regionCode: p.father_region_code || "",
    regionName: p.father_region || "",
    provinceCode: p.father_province_code || "",
    provinceName: p.father_province || "",
    cityMunCode: p.father_city_mun_code || "",
    cityMunName:
      p.father_municipality ||
      p.father_city ||
      p.father_city_municipality ||
      "",
    cityMunKind: p.father_city_mun_kind || "",
    barangayCode: p.father_barangay_code || "",
    barangayName: p.father_barangay || "",
  },

  id_image: null,
});

const addrToString = (a = {}) =>
  [
    a.addressLine,
    a.barangayName,
    a.cityMunName,
    a.provinceName,
    a.regionName,
  ]
    .filter(Boolean)
    .join(", ");

const KV = ({ label, value, copy }) => (
  <div className="kv" role="group">
    <div className="kv-k">{label}</div>
    <div className="kv-v">
      <span>{value || "—"}</span>
      {copy && value ? (
        <button
          type="button"
          className="kv-copy"
          onClick={() => navigator.clipboard.writeText(String(value))}
          aria-label={`Copy ${label}`}
          title={`Copy ${label}`}
        >
          Copy
        </button>
      ) : null}
    </div>
  </div>
);

/* =========================================
  Main Component
========================================= */
function AdminInfo() {
  const civilStatusOptions = ["Single", "Married", "Divorced", "Widowed"];
  const nationalityOptions = [
    "Filipino",
    "American",
    "Chinese",
    "Japanese",
    "Korean",
    "Others",
  ];

  function convertDateFormat(dateStr) {
    if (!dateStr) return "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
    const parts = dateStr.split("/");
    if (parts.length !== 3) return "";
    const [month, day, year] = parts;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(
      2,
      "0"
    )}`;
  }

  const today = new Date().toISOString().slice(0, 10);
  const minDOB = "1900-01-01";

  // Age limits
  const MIN_AGE = 21;
  const MAX_AGE = 65;

  // UI state
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [submenuOpen, setSubmenuOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("personal");

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);
  const toggleSubmenu = () => setSubmenuOpen(!submenuOpen);

  const [totalCount, setTotalCount] = useState(0);

  // Data
  const [profiles, setProfiles] = useState([]);
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState(null);

  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);

  // Checkbox: same as residential
  const [sameAsRes, setSameAsRes] = useState(false);

  // Image preview
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null);

  // Lightbox
  const [imageViewer, setImageViewer] = useState({
    open: false,
    url: "",
    alt: "",
  });

  const blankForm = {
    firstName: "",
    middleName: "",
    lastName: "",
    suffix: "",
    badge_number: "",
    email: "",
    phone: "",
    section: "",
    sex: "",
    gender: "",
    height: "",
    weight: "",
    birthDate: "",
    birthPlace: "",
    officerType: "",
    regularofficer: "",
    civilStatus: "",
    nationality: "",
    religion: "",
    lifelongLearner: false,

    resAddr: {
      addressLine: "",
      regionCode: "",
      regionName: "",
      provinceCode: "",
      provinceName: "",
      cityMunCode: "",
      cityMunName: "",
      cityMunKind: "",
      barangayCode: "",
      barangayName: "",
    },
    permAddr: {
      addressLine: "",
      regionCode: "",
      regionName: "",
      provinceCode: "",
      provinceName: "",
      cityMunCode: "",
      cityMunName: "",
      cityMunKind: "",
      barangayCode: "",
      barangayName: "",
    },

    motherFirstName: "",
    motherMiddleName: "",
    motherLastName: "",
    motherOccupation: "",
    motherDOB: "",
    motherContact: "",
    motherAddr: {
      regionCode: "",
      regionName: "",
      provinceCode: "",
      provinceName: "",
      cityMunCode: "",
      cityMunName: "",
      cityMunKind: "",
      barangayCode: "",
      barangayName: "",
    },

    fatherFirstName: "",
    fatherMiddleName: "",
    fatherLastName: "",
    fatherOccupation: "",
    fatherDOB: "",
    fatherContact: "",
    fatherAddr: {
      regionCode: "",
      regionName: "",
      provinceCode: "",
      provinceName: "",
      cityMunCode: "",
      cityMunName: "",
      cityMunKind: "",
      barangayCode: "",
      barangayName: "",
    },

    id_image: null,
  };

  const [formData, setFormData] = useState(blankForm);
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  const serverImageField = useMemo(() => {
    const keys = ["profile_image", "id_image", "image", "photo", "avatar"];
    for (const p of profiles) {
      for (const k of keys) if (p && p[k]) return k;
    }
    return "id_image";
  }, [profiles]);

  useEffect(() => {
    if (formData.id_image instanceof File) {
      const objectUrl = URL.createObjectURL(formData.id_image);
      setImagePreviewUrl(objectUrl);
      return () => URL.revokeObjectURL(objectUrl);
    } else {
      setImagePreviewUrl(null);
    }
  }, [formData.id_image]);

  useEffect(() => {
    fetchProfiles();
  }, []);

  const fetchProfiles = async (page = 1) => {
    try {

      setLoading(true);

      const res = await axios.get(`${API_BASE}/api/personnel/`, {
        params: {
          page: page,
          page_size: rowsPerPage,
          is_archived: false,
          ordering: "last_name,first_name",
        },
        headers: authHeader(),
      });

      const data = res.data;

      setProfiles(data.results || []);
      setTotalCount(data.count || 0);
      setCurrentPage(page);

    } catch (e) {
      console.error("Error fetching profiles", e);
    } finally {
      setLoading(false);
    }
  };

  const handleBadgeChange = (e) => {
    let v = onlyDigits(e.target.value).slice(0, 6);
    setFormData((prev) => ({ ...prev, badge_number: v }));
  };

  const handlePhoneChange = (field) => (e) => {
    let v = onlyDigits(e.target.value).slice(0, 11);
    setFormData((prev) => ({ ...prev, [field]: v }));
  };

  const handleChange = (e) => {
    const { name, value, type, checked, files } = e.target;

    if (name === "sex" || name === "gender") {
      setFormData((prev) => ({ ...prev, sex: value, gender: value }));
      return;
    }

    const noTitleCase = new Set(["email", "phone", "badge_number"]);

    const nextVal =
      type === "checkbox"
        ? checked
        : type === "file"
        ? files[0]
        : noTitleCase.has(name)
        ? value
        : toTitleCase(value);

    setFormData((prev) => ({
      ...prev,
      [name]: nextVal,
    }));
  };

  const setResAddr = (next) =>
    setFormData((p) => ({
      ...p,
      resAddr: next,
      permAddr: sameAsRes ? { ...next } : p.permAddr,
    }));

  const setPermAddr = (next) =>
    setFormData((p) => ({
      ...p,
      permAddr: next,
    }));

  const setMotherAddr = (next) =>
    setFormData((p) => ({ ...p, motherAddr: next }));

  const setFatherAddr = (next) =>
    setFormData((p) => ({ ...p, fatherAddr: next }));

  const handleSameAsResToggle = (e) => {
    const checked = e.target.checked;
    setSameAsRes(checked);
    if (checked) {
      setFormData((prev) => ({
        ...prev,
        permAddr: { ...prev.resAddr },
      }));
    }
  };

  const openAddModal = () => {
    setIsEditing(false);
    setEditingId(null);
    setSelectedProfile(null);
    setFormData(blankForm);
    setImagePreviewUrl(null);
    setSameAsRes(false);
    setActiveSection("personal");
    setShowAddModal(true);
  };

  const handleEditClick = (p) => {
    setSelectedProfile(p);
    setIsEditing(true);
    setEditingId(p.id);
    setImagePreviewUrl(null);
    setSameAsRes(false);
    setFormData(profileToForm(p, blankForm));
    setActiveSection("personal");
    setShowEditModal(true);
  };

  const openViewModal = (p) => {
    setSelectedProfile(p);
    setFormData(profileToForm(p, blankForm));
    setActiveSection("personal");
    setShowViewModal(true);
  };

  const handleArchive = async (id) => {
  document.activeElement.blur();
  const result = await Swal.fire({
    title: "Archive Profile?",
    text: "This profile will be moved to archive.",
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#d33",
    confirmButtonText: "Yes, Archive",
    cancelButtonText: "Cancel",
  });

  if (!result.isConfirmed) return;
    try {
      await axios.post(`${API_BASE}/api/personnel/${id}/archive/`, null, {
        headers: authHeader(),
      });
      setProfiles((prev) => prev.filter((x) => x.id !== id));
      Swal.fire({
        icon: "success",
        title: "Archived",
        text: "Profile successfully archived.",
      });
    } catch (e) {
      console.error("Archive failed:", e?.response?.data || e.message);
    }
  };

  const appendIfValue = (fd, key, val) => {
    if (val !== undefined && val !== null && val !== "") fd.append(key, val);
  };

  const appendAddr = (fd, prefix, addr) => {
    appendIfValue(fd, `${prefix}_region`, addr.regionName || "");
    appendIfValue(fd, `${prefix}_province`, addr.provinceName || "");
    appendIfValue(fd, `${prefix}_city_municipality`, addr.cityMunName || "");
    appendIfValue(fd, `${prefix}_city_mun_kind`, addr.cityMunKind || "");
    appendIfValue(fd, `${prefix}_barangay`, addr.barangayName || "");
    if (addr.addressLine !== undefined) {
      appendIfValue(fd, `${prefix}_address`, addr.addressLine || "");
    }
    appendIfValue(fd, `${prefix}_region_code`, addr.regionCode || "");
    appendIfValue(fd, `${prefix}_province_code`, addr.provinceCode || "");
    appendIfValue(fd, `${prefix}_city_mun_code`, addr.cityMunCode || "");
    appendIfValue(fd, `${prefix}_barangay_code`, addr.barangayCode || "");
  };

  const handleSubmit = async (e) => {
  e.preventDefault();

    document.activeElement.blur();

    const result = await Swal.fire({
      title: "Confirm Save",
      text: "Do you want to save this profile information?",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Yes, Save",
      cancelButtonText: "Cancel",
      returnFocus: false,
      focusConfirm: false,
    });

    if (!result.isConfirmed) return;

    // close modal immediately
    setShowAddModal(false);
    setShowEditModal(false);

    setIsLoading(true);
    setSuccessMessage(""); 

    if (!isPhoneValid(formData.phone)) {
      setIsLoading(false);
      Swal.fire({
        icon: "warning",
        title: "Invalid Phone Number",
        text: "Phone number must be 11 digits and start with 09.",
      });
      return;
    }

    if (formData.motherContact && !isPhoneValid(formData.motherContact)) {
      setIsLoading(false);
      Swal.fire({
        icon: "warning",
        title: "Invalid Mother's Contact",
        text: "Mother's contact must be 11 digits and start with 09.",
      });
      return;
    }

    if (formData.fatherContact && !isPhoneValid(formData.fatherContact)) {
      setIsLoading(false);
      Swal.fire({
        icon: "warning",
        title: "Invalid Father's Contact",
        text: "Father's contact must be 11 digits and start with 09.",
      });
      return;
    }

    const normalizedDOB = convertDateFormat(formData.birthDate);
    const age = computeAge(normalizedDOB);

    if (age === null || age < MIN_AGE || age > MAX_AGE) {
      setIsLoading(false);
      Swal.fire({
        icon: "warning",
        title: "Invalid Age",
        text: `Officer age must be between ${MIN_AGE} and ${MAX_AGE} years old.`,
      });
      return;
    }

    try {
      const fd = new FormData();

      appendIfValue(fd, "first_name", formData.firstName);
      appendIfValue(fd, "middle_name", formData.middleName);
      appendIfValue(fd, "last_name", formData.lastName);
      appendIfValue(fd, "suffix", formData.suffix);
      appendIfValue(fd, "officer_id", formData.badge_number || "");
      appendIfValue(fd, "email", formData.email);
      appendIfValue(fd, "phone", formData.phone);

      appendIfValue(fd, "section", formData.section);
      appendIfValue(fd, "sex", formData.sex);
      appendIfValue(fd, "gender", formData.gender || formData.sex);
      appendIfValue(fd, "height", formData.height);
      appendIfValue(fd, "weight", formData.weight);
      appendIfValue(fd, "birth_date", normalizedDOB);
      appendIfValue(fd, "birth_place", formData.birthPlace);
      appendIfValue(fd, "officer_type", formData.officerType);
      appendIfValue(fd, "regular_officer", formData.regularofficer);
      appendIfValue(fd, "civil_status", formData.civilStatus);
      appendIfValue(fd, "nationality", formData.nationality);
      appendIfValue(fd, "religion", formData.religion);

      fd.append("lifelong_learner", formData.lifelongLearner ? "true" : "false");

      appendAddr(fd, "residential", formData.resAddr);
      appendAddr(fd, "permanent", formData.permAddr);
      appendAddr(fd, "mother", formData.motherAddr);
      appendAddr(fd, "father", formData.fatherAddr);

      if (formData.id_image instanceof File) {
        fd.append(serverImageField, formData.id_image);
      }

      const headers = {
        ...authHeader(),
        "Content-Type": "multipart/form-data",
      };

      let resp;

      if (isEditing && editingId) {
        resp = await axios.patch(
          `${API_BASE}/api/personnel/${editingId}/`,
          fd,
          { headers }
        );
      } else {
        resp = await axios.post(`${API_BASE}/api/personnel/`, fd, {
          headers,
        });
      }

      const saved = resp.data;

      if (isEditing) {
        setProfiles((prev) =>
          prev.map((x) => (x.id === editingId ? { ...x, ...saved } : x))
        );
      } else {
        setProfiles((prev) => [saved, ...prev]);
      }

      setShowAddModal(false);
      setShowEditModal(false);
      setIsEditing(false);
      setEditingId(null);
      setSelectedProfile(null);
      setFormData(blankForm);
      setImagePreviewUrl(null);

    setTimeout(() => {
      Swal.fire({
        icon: "success",
        title: "Success",
        text: isEditing
          ? "Profile updated successfully!"
          : "Profile added successfully!",
        allowOutsideClick: false,
        returnFocus: false,
        focusConfirm: false,
      });
    }, 100);
    } catch (err) {
      const apiMsg = err?.response?.data
        ? typeof err.response.data === "string"
          ? err.response.data
          : JSON.stringify(err.response.data)
        : err?.message || "Unknown error";

      Swal.fire({
        icon: "error",
        title: "Error",
        text: `Error saving data: ${apiMsg}`,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const filteredProfiles = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return profiles;

    const inText = (...vals) =>
      vals.some((v) => (v || "").toString().toLowerCase().includes(q));

    return profiles.filter((p) =>
      inText(
        p.first_name,
        p.middle_name,
        p.last_name,
        p.officer_id,
        p.email,
        p.officer_type,
        p.section
      )
    );
  }, [profiles, searchTerm]);

  // Pagination
  const totalPages = Math.ceil(totalCount / rowsPerPage);

  const paginatedProfiles = filteredProfiles;

  const ageFromForm = formData.birthDate
    ? computeAge(convertDateFormat(formData.birthDate))
    : null;

  const openImageViewer = (url, alt = "Profile image") => {
    if (!url) return;
    setImageViewer({ open: true, url, alt });
  };
  const closeImageViewer = () =>
    setImageViewer({ open: false, url: "", alt: "" });

  useEffect(() => {
    if (!imageViewer.open) return;
    const onKey = (e) => {
      if (e.key === "Escape") closeImageViewer();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [imageViewer.open]);

  return (
    <div>
      {/* Top Navigation */}
      <div className="topnav">
        <div className="menu-icon" onClick={toggleSidebar} aria-label="Toggle sidebar">
          ☰
        </div>
        <div className="nav-title">
          <FontAwesomeIcon icon={faBell} style={{ fontSize: 18 }} />
        </div>
      </div>

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
                    <Link to="/AdminCrime">Add Report</Link>
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

        {/* Main Content */}
        <main
          className={`main-content ${!sidebarOpen ? "sidebar-collapsed" : ""}`}
        >
          <div className="admin-profile-container">
            <div className="header-section">
              <h1>Admin Profile Information</h1>

              <div className="table-actions">
                <input
                  type="text"
                  className="table-search"
                  placeholder="Search name, badge #, email, assignment, rank…"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  aria-label="Search profiles"
                />
                {searchTerm && (
                  <button
                    className="edit-btn"
                    type="button"
                    onClick={() => setSearchTerm("")}
                  >
                    Clear
                  </button>
                )}
                <button className="add-btn" onClick={openAddModal}>
                  + Add Profile
                </button>
              </div>
            </div>

            {loading ? (
              <div className="loading skeleton">Loading profiles…</div>
            ) : (
              <>
                <p className="table-hint">
                  Showing {filteredProfiles.length} of {profiles.length}
                </p>
                <div className="profile-table-container">
                  <table className="profile-table">
                    <thead>
                      <tr>
                        <th>Profile Image</th>
                        <th>Badge #</th>
                        <th>Email</th>
                        <th>First Name</th>
                        <th>Middle Name</th>
                        <th>Last Name</th>
                        <th>Assignment (Station)</th>
                        <th>Rank</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedProfiles.map((p) => {
                        const imgUrl = getProfileImageUrl(p);
                        const fullName = [p.first_name, p.middle_name, p.last_name]
                          .filter(Boolean)
                          .join(" ");
                        return (
                          <tr key={p.id}>
                            <td>
                              {imgUrl ? (
                                <img
                                  src={imgUrl}
                                  alt={`${fullName || "Profile"} photo`}
                                  className="profile-pic clickable"
                                  onClick={() =>
                                    openImageViewer(
                                      imgUrl,
                                      fullName || "Profile photo"
                                    )
                                  }
                                />
                              ) : (
                                <div className="profile-pic placeholder">
                                  No Image
                                </div>
                              )}
                            </td>
                            <td>{p.officer_id}</td>
                            <td>{p.email}</td>
                            <td>{p.first_name}</td>
                            <td>{p.middle_name || "-"}</td>
                            <td>{p.last_name}</td>
                            <td>{p.officer_type}</td>
                            <td>{p.section || "-"}</td>
                            <td className="row-actions">
                              <button
                                className="edit-btn"
                                onClick={() => openViewModal(p)}
                              >
                                View
                              </button>
                              <button
                                className="archive-btn"
                                onClick={() => handleArchive(p.id)}
                              >
                                Archive
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {filteredProfiles.length === 0 && (
                        <tr>
                          <td colSpan="9" className="table-empty">
                            No results found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="table-pagination">

                  <button
                    className="edit-btn"
                    disabled={currentPage === 1}
                    onClick={() => fetchProfiles(currentPage - 1)}
                  >
                    ◀ Previous
                  </button>

                  <span style={{ margin: "0 10px" }}>
                    Page {currentPage} of {totalPages || 1}
                  </span>

                  <button
                    className="edit-btn"
                    disabled={currentPage === totalPages}
                    onClick={() => fetchProfiles(currentPage + 1)}
                  >
                    Next ▶
                  </button>

                </div>
              </>
            )}

            {/* ADD MODAL */}
            {showAddModal && (
              <div
                className="overlay"
                role="dialog"
                aria-modal="true"
                aria-label="Add Profile"
              >
                <div className="modal">
                  <div className="modal-header">
                    <h2>New Profile</h2>
                    <button
                      className="edit-btn"
                      type="button"
                      onClick={() => setShowAddModal(false)}
                    >
                      Close
                    </button>
                  </div>
                  <form className="form" onSubmit={handleSubmit}>
                    <div className="overlay-wrapper">
                      <div className="tab-buttons">
                        <button
                          type="button"
                          className={
                            activeSection === "personal"
                              ? "tab-btn active"
                              : "tab-btn"
                          }
                          onClick={() => setActiveSection("personal")}
                        >
                          Personal Information
                        </button>
                        <button
                          type="button"
                          className={
                            activeSection === "family"
                              ? "tab-btn active"
                              : "tab-btn"
                          }
                          onClick={() => setActiveSection("family")}
                        >
                          Family Background
                        </button>
                      </div>

                      {activeSection === "personal" && (
                        <div className="form-section show">
                          <h1>Personal Information</h1>

                          <div className="image-preview-wrap">
                            <div className="input-group">
                              <label>Profile Image</label>
                              <input
                                type="file"
                                name="id_image"
                                accept="image/*"
                                onChange={handleChange}
                              />
                            </div>
                            <div className="image-preview">
                              {imagePreviewUrl ? (
                                <img
                                  src={imagePreviewUrl}
                                  alt="Preview"
                                  className="clickable"
                                  onClick={() =>
                                    openImageViewer(imagePreviewUrl, "Preview")
                                  }
                                />
                              ) : (
                                <div className="image-placeholder">
                                  Image preview will appear here
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="grid">
                            <div className="input-group">
                              <label>
                                First Name <span className="required">*</span>
                              </label>
                              <input
                                name="firstName"
                                value={formData.firstName}
                                onChange={handleChange}
                                placeholder="Juan"
                                required
                              />
                            </div>
                            <div className="input-group">
                              <label>Middle Name</label>
                              <input
                                name="middleName"
                                value={formData.middleName}
                                onChange={handleChange}
                                placeholder="Dela"
                              />
                            </div>
                            <div className="input-group">
                              <label>
                                Last Name <span className="required">*</span>
                              </label>
                              <input
                                name="lastName"
                                value={formData.lastName}
                                onChange={handleChange}
                                placeholder="Cruz"
                                required
                              />
                            </div>
                            <div className="input-group">
                              <label>Suffix</label>
                              <input
                                name="suffix"
                                value={formData.suffix}
                                onChange={handleChange}
                                placeholder="Jr., Sr., III"
                              />
                            </div>

                            <div className="input-group">
                              <label>
                                Badge Number (6 digits){" "}
                                <span className="required">*</span>
                              </label>
                              <input
                                name="badge_number"
                                value={formData.badge_number}
                                onChange={handleBadgeChange}
                                inputMode="numeric"
                                maxLength={6}
                                required
                              />
                            </div>

                            <div className="input-group">
                              <label>
                                Email Address{" "}
                                <span className="required">*</span>
                              </label>
                              <input
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                placeholder="name@agency.gov.ph"
                                required
                              />
                            </div>

                            <div className="input-group">
                              <label>
                                Phone Number (PH){" "}
                                <span className="required">*</span>
                              </label>
                              <input
                                type="tel"
                                name="phone"
                                value={formData.phone}
                                onChange={handlePhoneChange("phone")}
                                inputMode="numeric"
                                maxLength={11}
                                placeholder="09XXXXXXXXX"
                                required
                              />
                              <small className="help">
                                Must start with 09 and be 11 digits.
                              </small>
                            </div>

                            <div className="input-group">
                              <label>
                                Rank <span className="required">*</span>
                              </label>
                              <select
                                name="section"
                                value={formData.section}
                                onChange={handleChange}
                                required
                              >
                                <option value="">Select Rank</option>
                                {POLICE_RANKS.map((r) => (
                                  <option key={r} value={r}>
                                    {r}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div className="input-group">
                              <label>
                                Date of Birth{" "}
                                <span className="required">*</span>
                              </label>
                              <input
                                type="date"
                                name="birthDate"
                                value={formData.birthDate}
                                onChange={handleChange}
                                min={minDOB}
                                max={today}
                                required
                              />
                            </div>

                            <div className="input-group">
                              <label>Age</label>
                              <input
                                type="text"
                                value={ageFromForm != null ? ageFromForm : ""}
                                readOnly
                                placeholder="Auto-calculated from birthdate"
                              />
                            </div>

                            <div className="input-group">
                              <label>
                                Place of Birth{" "}
                                <span className="required">*</span>
                              </label>
                              <input
                                name="birthPlace"
                                value={formData.birthPlace}
                                onChange={handleChange}
                                placeholder="City/Municipality, Province"
                                required
                              />
                            </div>

                            <div className="input-group">
                              <label>
                                Assignment (Station){" "}
                                <span className="required">*</span>
                              </label>
                              <select
                                name="officerType"
                                value={formData.officerType}
                                onChange={handleChange}
                                required
                              >
                                <option value="">Select Station</option>
                                {STATIONS_R4A.map((s) => (
                                  <option key={s} value={s}>
                                    {s}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div className="input-group">
                              <label>
                                Sex / Gender{" "}
                                <span className="required">*</span>
                              </label>
                              <div className="radio-group">
                                {["Male", "Female", "Other"].map((g, idx) => (
                                  <label key={g}>
                                    <input
                                      type="radio"
                                      name="sex"
                                      value={g}
                                      checked={formData.sex === g}
                                      onChange={handleChange}
                                      required={idx === 0}
                                    />
                                    {g}
                                  </label>
                                ))}
                              </div>
                            </div>

                            <div className="input-group">
                              <label>Height (cm)</label>
                              <input
                                name="height"
                                value={formData.height}
                                onChange={handleChange}
                                inputMode="numeric"
                                type="number"
                                min="80"
                                max="250"
                                step="1"
                                placeholder="e.g., 170"
                              />
                            </div>
                            <div className="input-group">
                              <label>Weight (kg)</label>
                              <input
                                name="weight"
                                value={formData.weight}
                                onChange={handleChange}
                                inputMode="numeric"
                                type="number"
                                min="20"
                                max="300"
                                step="1"
                                placeholder="e.g., 65"
                              />
                            </div>
                          </div>

                          <div className="section">
                            <h3> Additional Information</h3>
                            <div className="grid">
                              <div className="input-group">
                                <label>
                                  Civil Status{" "}
                                  <span className="required">*</span>
                                </label>
                                <select
                                  name="civilStatus"
                                  value={formData.civilStatus}
                                  onChange={handleChange}
                                  required
                                >
                                  <option value="">Select Civil Status</option>
                                  {civilStatusOptions.map((s) => (
                                    <option key={s} value={s}>
                                      {s}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div className="input-group">
                                <label>
                                  Nationality{" "}
                                  <span className="required">*</span>
                                </label>
                                <select
                                  name="nationality"
                                  value={formData.nationality}
                                  onChange={handleChange}
                                  required
                                >
                                  <option value="">Select Nationality</option>
                                  {nationalityOptions.map((n) => (
                                    <option key={n} value={n}>
                                      {n}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div className="input-group">
                                <label>
                                  Religion{" "}
                                  <span className="required">*</span>
                                </label>
                                <input
                                  name="religion"
                                  value={formData.religion}
                                  onChange={handleChange}
                                  placeholder="e.g., Roman Catholic"
                                  required
                                />
                              </div>
                            </div>
                          </div>

                          <PhAddressPicker
                            labelPrefix=" Residential Address"
                            value={formData.resAddr}
                            onChange={setResAddr}
                            requireAddressLine
                          />

                          <div className="input-group">
                            <label className="checkbox-inline">
                              <input
                                type="checkbox"
                                checked={sameAsRes}
                                onChange={handleSameAsResToggle}
                              />{" "}
                              Same as Residential Address
                            </label>
                          </div>

                          {!sameAsRes ? (
                            <PhAddressPicker
                              labelPrefix=" Permanent Address"
                              value={formData.permAddr}
                              onChange={setPermAddr}
                              requireAddressLine
                            />
                          ) : (
                            <div className="section">
                              <h3> Permanent Address</h3>
                              <p className="muted">
                                Same as Residential Address.
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      {activeSection === "family" && (
                        <div className="form-section show">
                          <h1>Family Background</h1>

                          <h3>Mother Background</h3>
                          <div className="grid">
                            <div className="input-group">
                              <label>First Name</label>
                              <input
                                name="motherFirstName"
                                value={formData.motherFirstName}
                                onChange={handleChange}
                                placeholder="e.g., Maria"
                              />
                            </div>
                            <div className="input-group">
                              <label>Middle Name</label>
                              <input
                                name="motherMiddleName"
                                value={formData.motherMiddleName}
                                onChange={handleChange}
                              />
                            </div>
                            <div className="input-group">
                              <label>Last Name</label>
                              <input
                                name="motherLastName"
                                value={formData.motherLastName}
                                onChange={handleChange}
                              />
                            </div>
                            <div className="input-group">
                              <label>Occupation</label>
                              <select
                                name="motherOccupation"
                                value={formData.motherOccupation}
                                onChange={handleChange}
                              >
                                <option value="">Select occupation</option>
                                {["Housewife", "Employed", "Self-Employed", "OFW"].map(
                                  (o) => (
                                    <option key={o} value={o}>
                                      {o}
                                    </option>
                                  )
                                )}
                              </select>
                            </div>
                            <div className="input-group">
                              <label>Date of Birth</label>
                              <input
                                type="date"
                                name="motherDOB"
                                value={formData.motherDOB}
                                onChange={handleChange}
                                min={minDOB}
                                max={today}
                              />
                            </div>
                            <div className="input-group">
                              <label>Contact Number</label>
                              <input
                                type="tel"
                                name="motherContact"
                                value={formData.motherContact}
                                onChange={handlePhoneChange("motherContact")}
                                inputMode="numeric"
                                maxLength={11}
                                placeholder="09XXXXXXXXX"
                              />
                            </div>
                          </div>
                          <PhAddressPicker
                            labelPrefix="Mother Address"
                            value={formData.motherAddr}
                            onChange={setMotherAddr}
                          />

                          <h3>Father Background</h3>
                          <div className="grid">
                            <div className="input-group">
                              <label>First Name</label>
                              <input
                                name="fatherFirstName"
                                value={formData.fatherFirstName}
                                onChange={handleChange}
                                placeholder="e.g., Jose"
                              />
                            </div>
                            <div className="input-group">
                              <label>Middle Name</label>
                              <input
                                name="fatherMiddleName"
                                value={formData.fatherMiddleName}
                                onChange={handleChange}
                              />
                            </div>
                            <div className="input-group">
                              <label>Last Name</label>
                              <input
                                name="fatherLastName"
                                value={formData.fatherLastName}
                                onChange={handleChange}
                              />
                            </div>
                            <div className="input-group">
                              <label>Occupation</label>
                              <select
                                name="fatherOccupation"
                                value={formData.fatherOccupation}
                                onChange={handleChange}
                              >
                                <option value="">Select occupation</option>
                                {["Employed", "Self-Employed", "OFW"].map(
                                  (o) => (
                                    <option key={o} value={o}>
                                      {o}
                                    </option>
                                  )
                                )}
                              </select>
                            </div>
                            <div className="input-group">
                              <label>Date of Birth</label>
                              <input
                                type="date"
                                name="fatherDOB"
                                value={formData.fatherDOB}
                                onChange={handleChange}
                                min={minDOB}
                                max={today}
                              />
                            </div>
                            <div className="input-group">
                              <label>Contact Number</label>
                              <input
                                type="tel"
                                name="fatherContact"
                                value={formData.fatherContact}
                                onChange={handlePhoneChange("fatherContact")}
                                inputMode="numeric"
                                maxLength={11}
                                placeholder="09XXXXXXXXX"
                              />
                            </div>
                          </div>
                          <PhAddressPicker
                            labelPrefix="Father Address"
                            value={formData.fatherAddr}
                            onChange={setFatherAddr}
                          />
                        </div>
                      )}
                    </div>

                    
                      <div className="footer-right">
                        <button
                          type="button"
                          className="edit-btn"
                          onClick={() => setShowAddModal(false)}
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="submit-button"
                          disabled={isLoading}
                        >
                          {isLoading ? <> Saving…</> : <> Save Changes</>}
                        </button>
                      </div>
                      {successMessage && (
                        <p className="success-message">{successMessage}</p>
                      )}
                   
                  </form>
                </div>
              </div>
            )}

            {/* EDIT MODAL */}
            {showEditModal && selectedProfile && (
              <div
                className="overlay"
                role="dialog"
                aria-modal="true"
                aria-label="Edit Profile"
              >
                <div className="modal">
                  <div className="modal-header">
                    <h2>Edit Profile</h2>
                    <button
                      className="edit-btn"
                      type="button"
                      onClick={() => setShowEditModal(false)}
                    >
                      Close
                    </button>
                  </div>
                  <form className="form" onSubmit={handleSubmit}>
                    <div className="overlay-wrapper">
                      <div className="form-tabs">
                        <div className="tab-buttons">
                          <button
                            type="button"
                            className={
                              activeSection === "personal"
                                ? "tab-btn active"
                                : "tab-btn"
                            }
                            onClick={() => setActiveSection("personal")}
                          >
                            Personal Information
                          </button>
                          <button
                            type="button"
                            className={
                              activeSection === "family"
                                ? "tab-btn active"
                                : "tab-btn"
                            }
                            onClick={() => setActiveSection("family")}
                          >
                            Family Background
                          </button>
                        </div>
                      </div>

                      {activeSection === "personal" && (
                        <div className="form-section show">
                          <h1>Personal Information</h1>

                          <div className="image-preview-wrap">
                            <div className="input-group">
                              <label>Profile Image</label>
                              <input
                                type="file"
                                name="id_image"
                                accept="image/*"
                                onChange={handleChange}
                              />
                              <small className="help">
                                Optional. JPG/PNG.
                              </small>
                            </div>
                            <div className="image-preview">
                              {imagePreviewUrl ? (
                                <img
                                  src={imagePreviewUrl}
                                  alt="Preview"
                                  className="clickable"
                                  onClick={() =>
                                    openImageViewer(imagePreviewUrl, "Preview")
                                  }
                                />
                              ) : getProfileImageUrl(selectedProfile) ? (
                                <img
                                  src={getProfileImageUrl(selectedProfile)}
                                  alt="Current"
                                  className="clickable"
                                  onClick={() =>
                                    openImageViewer(
                                      getProfileImageUrl(selectedProfile),
                                      "Current photo"
                                    )
                                  }
                                />
                              ) : (
                                <div className="image-placeholder">
                                  No current image
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="grid">
                            <div className="input-group">
                              <label>
                                First Name <span className="required">*</span>
                              </label>
                              <input
                                name="firstName"
                                value={formData.firstName}
                                onChange={handleChange}
                                required
                              />
                            </div>
                            <div className="input-group">
                              <label>Middle Name</label>
                              <input
                                name="middleName"
                                value={formData.middleName}
                                onChange={handleChange}
                              />
                            </div>
                            <div className="input-group">
                              <label>
                                Last Name <span className="required">*</span>
                              </label>
                              <input
                                name="lastName"
                                value={formData.lastName}
                                onChange={handleChange}
                                required
                              />
                            </div>
                            <div className="input-group">
                              <label>Suffix</label>
                              <input
                                name="suffix"
                                value={formData.suffix}
                                onChange={handleChange}
                                placeholder="Jr., Sr., III, etc."
                              />
                            </div>

                            <div className="input-group">
                              <label>
                                Badge Number (6 digits){" "}
                                <span className="required">*</span>
                              </label>
                              <input
                                name="badge_number"
                                value={formData.badge_number}
                                onChange={handleBadgeChange}
                                inputMode="numeric"
                                maxLength={6}
                                required
                              />
                            </div>

                            <div className="input-group">
                              <label>
                                Email Address{" "}
                                <span className="required">*</span>
                              </label>
                              <input
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                required
                              />
                            </div>
                            <div className="input-group">
                              <label>
                                Phone Number (PH){" "}
                                <span className="required">*</span>
                              </label>
                              <input
                                type="tel"
                                name="phone"
                                value={formData.phone}
                                onChange={handlePhoneChange("phone")}
                                inputMode="numeric"
                                maxLength={11}
                                placeholder="09XXXXXXXXX"
                                required
                              />
                            </div>

                            <div className="input-group">
                              <label>
                                Rank <span className="required">*</span>
                              </label>
                              <select
                                name="section"
                                value={formData.section}
                                onChange={handleChange}
                                required
                              >
                                <option value="">Select Rank</option>
                                {POLICE_RANKS.map((r) => (
                                  <option key={r} value={r}>
                                    {r}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div className="input-group">
                              <label>
                                Date of Birth{" "}
                                <span className="required">*</span>
                              </label>
                              <input
                                type="date"
                                name="birthDate"
                                value={formData.birthDate}
                                onChange={handleChange}
                                min={minDOB}
                                max={today}
                                required
                              />
                            </div>

                            <div className="input-group">
                              <label>Age</label>
                              <input
                                type="text"
                                value={ageFromForm != null ? ageFromForm : ""}
                                readOnly
                                placeholder="Auto-calculated from birthdate"
                              />
                            </div>

                            <div className="input-group">
                              <label>
                                Place of Birth{" "}
                                <span className="required">*</span>
                              </label>
                              <input
                                name="birthPlace"
                                value={formData.birthPlace}
                                onChange={handleChange}
                                required
                              />
                            </div>

                            <div className="input-group">
                              <label>
                                Assignment (Station){" "}
                                <span className="required">*</span>
                              </label>
                              <select
                                name="officerType"
                                value={formData.officerType}
                                onChange={handleChange}
                                required
                              >
                                <option value="">Select Station</option>
                                {STATIONS_R4A.map((s) => (
                                  <option key={s} value={s}>
                                    {s}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div className="input-group">
                              <label>
                                Sex / Gender{" "}
                                <span className="required">*</span>
                              </label>
                              <div className="radio-group">
                                {["Male", "Female", "Other"].map((g, idx) => (
                                  <label key={g}>
                                    <input
                                      type="radio"
                                      name="sex"
                                      value={g}
                                      checked={formData.sex === g}
                                      onChange={handleChange}
                                      required={idx === 0}
                                    />
                                    {g}
                                  </label>
                                ))}
                              </div>
                            </div>

                            <div className="input-group">
                              <label>Height (cm)</label>
                              <input
                                name="height"
                                value={formData.height}
                                onChange={handleChange}
                                inputMode="numeric"
                                type="number"
                                min="80"
                                max="250"
                                step="1"
                              />
                            </div>
                            <div className="input-group">
                              <label>Weight (kg)</label>
                              <input
                                name="weight"
                                value={formData.weight}
                                onChange={handleChange}
                                inputMode="numeric"
                                type="number"
                                min="20"
                                max="300"
                                step="1"
                              />
                            </div>
                          </div>

                          <div className="section">
                            <h3>ℹ️ Additional Information</h3>
                            <div className="grid">
                              <div className="input-group">
                                <label>
                                  Civil Status{" "}
                                  <span className="required">*</span>
                                </label>
                                <select
                                  name="civilStatus"
                                  value={formData.civilStatus}
                                  onChange={handleChange}
                                  required
                                >
                                  <option value="">Select Civil Status</option>
                                  {civilStatusOptions.map((s) => (
                                    <option key={s} value={s}>
                                      {s}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div className="input-group">
                                <label>
                                  Nationality{" "}
                                  <span className="required">*</span>
                                </label>
                                <select
                                  name="nationality"
                                  value={formData.nationality}
                                  onChange={handleChange}
                                  required
                                >
                                  <option value="">Select Nationality</option>
                                  {nationalityOptions.map((n) => (
                                    <option key={n} value={n}>
                                      {n}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div className="input-group">
                                <label>
                                  Religion{" "}
                                  <span className="required">*</span>
                                </label>
                                <input
                                  name="religion"
                                  value={formData.religion}
                                  onChange={handleChange}
                                  required
                                />
                              </div>
                            </div>
                          </div>

                          <PhAddressPicker
                            labelPrefix="🏠 Residential Address"
                            value={formData.resAddr}
                            onChange={setResAddr}
                            requireAddressLine
                          />

                          <div className="input-group">
                            <label className="checkbox-inline">
                              <input
                                type="checkbox"
                                checked={sameAsRes}
                                onChange={handleSameAsResToggle}
                              />{" "}
                              Same as Residential Address
                            </label>
                          </div>

                          {!sameAsRes ? (
                            <PhAddressPicker
                              labelPrefix="🏷️ Permanent Address"
                              value={formData.permAddr}
                              onChange={setPermAddr}
                              requireAddressLine
                            />
                          ) : (
                            <div className="section">
                              <h3>🏷️ Permanent Address</h3>
                              <p className="muted">
                                Same as Residential Address.
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      {activeSection === "family" && (
                        <div className="form-section show">
                          <h1>Family Background</h1>
                          <h3>Mother&apos; Background</h3>
                          <div className="grid">
                            <div className="input-group">
                              <label>First Name</label>
                              <input
                                name="motherFirstName"
                                value={formData.motherFirstName}
                                onChange={handleChange}
                              />
                            </div>
                            <div className="input-group">
                              <label>Middle Name</label>
                              <input
                                name="motherMiddleName"
                                value={formData.motherMiddleName}
                                onChange={handleChange}
                              />
                            </div>
                            <div className="input-group">
                              <label>Last Name</label>
                              <input
                                name="motherLastName"
                                value={formData.motherLastName}
                                onChange={handleChange}
                              />
                            </div>
                            <div className="input-group">
                              <label>Occupation</label>
                              <select
                                name="motherOccupation"
                                value={formData.motherOccupation}
                                onChange={handleChange}
                              >
                                <option value="">Select occupation</option>
                                {["Housewife", "Employed", "Self-Employed", "OFW"].map(
                                  (o) => (
                                    <option key={o} value={o}>
                                      {o}
                                    </option>
                                  )
                                )}
                              </select>
                            </div>
                            <div className="input-group">
                              <label>Date of Birth</label>
                              <input
                                type="date"
                                name="motherDOB"
                                value={formData.motherDOB}
                                onChange={handleChange}
                                min={minDOB}
                                max={today}
                              />
                            </div>
                            <div className="input-group">
                              <label>Contact Number</label>
                              <input
                                type="tel"
                                name="motherContact"
                                value={formData.motherContact}
                                onChange={handlePhoneChange("motherContact")}
                                inputMode="numeric"
                                maxLength={11}
                                placeholder="09XXXXXXXXX"
                              />
                            </div>
                          </div>
                          <PhAddressPicker
                            labelPrefix="Mother Address"
                            value={formData.motherAddr}
                            onChange={setMotherAddr}
                          />

                          <h3>Father&apos; Background</h3>
                          <div className="grid">
                            <div className="input-group">
                              <label>First Name</label>
                              <input
                                name="fatherFirstName"
                                value={formData.fatherFirstName}
                                onChange={handleChange}
                              />
                            </div>
                            <div className="input-group">
                              <label>Middle Name</label>
                              <input
                                name="fatherMiddleName"
                                value={formData.fatherMiddleName}
                                onChange={handleChange}
                              />
                            </div>
                            <div className="input-group">
                              <label>Last Name</label>
                              <input
                                name="fatherLastName"
                                value={formData.fatherLastName}
                                onChange={handleChange}
                              />
                            </div>
                            <div className="input-group">
                              <label>Occupation</label>
                              <select
                                name="fatherOccupation"
                                value={formData.fatherOccupation}
                                onChange={handleChange}
                              >
                                <option value="">Select occupation</option>
                                {["Employed", "Self-Employed", "OFW"].map(
                                  (o) => (
                                    <option key={o} value={o}>
                                      {o}
                                    </option>
                                  )
                                )}
                              </select>
                            </div>
                            <div className="input-group">
                              <label>Date of Birth</label>
                              <input
                                type="date"
                                name="fatherDOB"
                                value={formData.fatherDOB}
                                onChange={handleChange}
                                min={minDOB}
                                max={today}
                              />
                            </div>
                            <div className="input-group">
                              <label>Contact Number</label>
                              <input
                                type="tel"
                                name="fatherContact"
                                value={formData.fatherContact}
                                onChange={handlePhoneChange("fatherContact")}
                                inputMode="numeric"
                                maxLength={11}
                                placeholder="09XXXXXXXXX"
                              />
                            </div>
                          </div>
                          <PhAddressPicker
                            labelPrefix="Father Address"
                            value={formData.fatherAddr}
                            onChange={setFatherAddr}
                          />
                        </div>
                      )}
                    </div>

  
                      <div className="footer-right">
                        <button
                          type="button"
                          className="edit-btn"
                          onClick={() => setShowEditModal(false)}
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="submit-button"
                          disabled={isLoading}
                        >
                          {isLoading ? " Saving…" : " Save Changes"}
                        </button>
                      </div>
                      {successMessage && (
                        <p className="success-message">{successMessage}</p>
                      )}
  
                  </form>
                </div>
              </div>
            )}

            {/* VIEW MODAL */}
            {showViewModal && selectedProfile && (
              <div
                className="overlay"
                role="dialog"
                aria-modal="true"
                aria-label="View Profile"
              >
                <div className="modal" style={{ maxWidth: 900 }}>
                  <div className="modal-header">
                    <h2>Profile</h2>
                    <div
                      className="header-actions"
                      style={{ display: "flex", gap: 8 }}
                    >
                      <button
                        className="edit-btn"
                        onClick={() => {
                          setShowViewModal(false);
                          handleEditClick(selectedProfile);
                        }}
                      >
                        Edit
                      </button>
                      <button
                        className="edit-btn"
                        onClick={() => setShowViewModal(false)}
                      >
                        Close
                      </button>
                    </div>
                  </div>

                  <div
                    className="modal-body"
                    style={{ overflow: "auto", flex: 1 }}
                  >
                    <div className="overlay-wrapper view-wrap">
                      <div className="profile-header-card">

                        <div className="profile-avatar">
                          {getProfileImageUrl(selectedProfile) ? (
                            <img
                              src={getProfileImageUrl(selectedProfile)}
                              alt="Profile"
                              onClick={() =>
                                openImageViewer(
                                  getProfileImageUrl(selectedProfile),
                                  "Profile photo"
                                )
                              }
                            />
                          ) : (
                            <div className="avatar-placeholder">No Image</div>
                          )}
                        </div>

                        <div className="profile-info">
                          <h2 className="profile-name">
                            {[
                              selectedProfile.first_name,
                              selectedProfile.middle_name,
                              selectedProfile.last_name,
                            ]
                              .filter(Boolean)
                              .join(" ") || "Unnamed"}
                          </h2>

                          <p className="profile-rank">
                            {selectedProfile.section}
                          </p>

                          <div className="profile-tags">
                            <span>Badge #{selectedProfile.officer_id}</span>
                            <span>{selectedProfile.officer_type}</span>
                            <span>{selectedProfile.email}</span>
                          </div>
                        </div>

                      </div>

                      <div className="view-card family">
                        <h3>Personal Information</h3>
                        <div className="kv-list">
                          <KV
                            label="Full Name"
                            value={[
                              selectedProfile.first_name,
                              selectedProfile.middle_name,
                              selectedProfile.last_name,
                            ]
                              .filter(Boolean)
                              .join(" ")}
                          />
                          <KV
                            label="Date of Birth"
                            value={selectedProfile.birth_date}
                          />
                          <KV
                            label="Place of Birth"
                            value={selectedProfile.birth_place}
                          />
                          <KV
                            label="Sex / Gender"
                            value={selectedProfile.sex}
                          />
                          <KV
                            label="Civil Status"
                            value={selectedProfile.civil_status}
                          />
                          <KV
                            label="Nationality"
                            value={selectedProfile.nationality}
                          />
                          <KV
                            label="Religion"
                            value={selectedProfile.religion}
                          />
                          <KV
                            label="Height (cm)"
                            value={selectedProfile.height}
                          />
                          <KV
                            label="Weight (kg)"
                            value={selectedProfile.weight}
                          />
                          <KV
                            label="Assignment (Station)"
                            value={selectedProfile.officer_type}
                          />

                          <KV
                            label="Phone Number"
                            value={selectedProfile.phone}
    />
                        </div>
                      </div>

                      <div className="view-card">
                        <h3>Addresses</h3>
                        <div className="kv-list">
                          <KV
                            label="Residential Address"
                            value={addrToString(
                              profileToForm(selectedProfile, blankForm).resAddr
                            )}
                          />
                          <KV
                            label="Permanent Address"
                            value={addrToString(
                              profileToForm(selectedProfile, blankForm).permAddr
                            )}
                          />
                        </div>
                      </div>

                      <div className="view-card">
                        <h3>Family Background</h3>
                        <div className="kv-list">
                          <KV
                            label="Mother's Name"
                            value={[
                              selectedProfile.mother_first_name,
                              selectedProfile.mother_middle_name,
                              selectedProfile.mother_last_name,
                            ]
                              .filter(Boolean)
                              .join(" ")}
                          />
                          <KV
                            label="Mother's Contact"
                            value={selectedProfile.mother_contact}
                          />
                          <KV
                            label="Father's Name"
                            value={[
                              selectedProfile.father_first_name,
                              selectedProfile.father_middle_name,
                              selectedProfile.father_last_name,
                            ]
                              .filter(Boolean)
                              .join(" ")}
                          />
                          <KV
                            label="Father's Contact"
                            value={selectedProfile.father_contact}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {imageViewer.open && (
              <div
                className="overlay image-viewer"
                onClick={closeImageViewer}
              >
                <div className="image-viewer-inner">
                  <img src={imageViewer.url} alt={imageViewer.alt} />
                  <button
                    type="button"
                    className="edit-btn close-viewer"
                    onClick={closeImageViewer}
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default AdminInfo;
