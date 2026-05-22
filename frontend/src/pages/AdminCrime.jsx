// src/pages/AdminCrime.jsx
import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faHome,
  faUser,
  faFileInvoice,
  faMapLocation,
  faChartLine,
  faBell,
  faRightFromBracket,
  faSave,
  faBoxArchive,
} from "@fortawesome/free-solid-svg-icons";
import "../assets/css/AdminCrime.css";

/* Leaflet (mini-picker map) */
import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { color } from "chart.js/helpers";

/* Default Leaflet marker fix using CDN icons so bundlers won't need require() */
const DefaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

/* ================= CONFIG ================= */
const API_BASE = (import.meta.env.VITE_API_BASE || "https://maritime-backend-0gib.onrender.com").replace(/\/$/, "");

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

const NOMINATIM_BASE = "https://nominatim.openstreetmap.org";

/**
 * Region IV-A (CALABARZON) bounding box only
 */
const REGION4A_BOUNDS = L.latLngBounds(
  L.latLng(13.0, 120.2), // SW
  L.latLng(15.5, 122.5) // NE
);
const REGION4A_CENTER = REGION4A_BOUNDS.getCenter();

/* Nominatim needs: minLon,minLat,maxLon,maxLat */
const toViewbox = (bounds) => {
  const sw = bounds.getSouthWest();
  const ne = bounds.getNorthEast();
  return `${sw.lng},${sw.lat},${ne.lng},${ne.lat}`;
};

/* MARITIME-FOCUSED crimes, values must MATCH backend CRIME_TYPE_CHOICES */
const crimeTypes = [
  // PIRACY
  { value: "Piracy", label: "Piracy (RPC Art. 122 / PD 532)" },
  { value: "Qualified Piracy", label: "Qualified Piracy (RPC Art. 123 / RA 7659)" },

  // SMUGGLING
  { value: "Smuggling", label: "Smuggling (RA 10863)" },

  // ILLEGAL FISHING
  { value: "Illegal Fishing", label: "Illegal Fishing (RA 8550 / RA 10654)" },
  { value: "Dynamite Fishing", label: "Dynamite Fishing (RA 8550)" },
  { value: "Cyanide Fishing", label: "Cyanide Fishing (RA 8550)" },
  { value: "Foreign Poaching", label: "Foreign Poaching (RA 8550)" },

  // ENVIRONMENTAL
  { value: "Marine Pollution", label: "Marine Pollution / Oil Spill (PD 979 / RA 9275)" },
  { value: "Illegal Dumping", label: "Illegal Waste Dumping (RA 9003)" },
  { value: "Wildlife Trafficking", label: "Marine Wildlife Trafficking (RA 9147)" },

  // DRUGS
  { value: "Drug Trafficking", label: "Drug Trafficking via Sea (RA 9165)" },

  // HUMAN TRAFFICKING
  { value: "Human Trafficking", label: "Human Trafficking (RA 9208 / RA 10364)" },

  // FIREARMS
  { value: "Illegal Firearms", label: "Illegal Possession of Firearms (RA 10591)" },

  // TERRITORIAL
  { value: "Unauthorized Entry", label: "Unauthorized Foreign Vessel Entry (RA 12064)" },

  // SAFETY
  { value: "Overloading", label: "Overloading Vessel (RA 9993)" },
  { value: "No Safety Equipment", label: "No Safety Equipment (RA 9993)" },
  { value: "Unregistered Vessel", label: "Unregistered Vessel (MARINA Laws)" },

  // VESSEL CRIMES
  { value: "Ship Hijacking", label: "Ship Hijacking / Vessel Seizure" },
  { value: "Vessel Theft", label: "Vessel Theft" },

  // VIOLENCE
  { value: "Kidnapping", label: "Kidnapping at Sea (RPC)" },
  { value: "Murder", label: "Murder / Homicide at Sea (RPC)" },

  // OTHER INCIDENTS
  { value: "Missing Fisherman", label: "Missing Fisherman / SAR Incident" },
  { value: "Maritime Accident", label: "Maritime Accident / Collision" },

  // FALLBACK
  { value: "Others", label: "Others (Specify)" },
];

/* ------------ Error Boundary ------------ */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, err: null };
  }
  static getDerivedStateFromError(err) {
    return { hasError: true, err };
  }
  componentDidCatch(err, info) {
    console.error("ErrorBoundary caught:", err, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 16 }}>
          <h3>Something went wrong.</h3>
          <p style={{ color: "#6b7280" }}>Please check the address pickers or reload the page.</p>
        </div>
      );
    }
    return this.props.children;
  }
}

/* ================= PSGC Address Picker ================= */
function PhAddressPicker({
  label,
  value,
  onChange,
  withAddressLine,
  requiredFields = true,
  restrictToRegion4A = false,
}) {
  const [regions, setRegions] = useState([]);
  const [provinces, setProvinces] = useState([]);
  const [cityMuns, setCityMuns] = useState([]);
  const [barangays, setBarangays] = useState([]);
  const [errNote, setErrNote] = useState("");
  const [psgcError, setPsgcError] = useState("");
  const [fallback, setFallback] = useState(false); // manual mode kapag rate-limited / error

  const buildPsgc = (loc) => {
    const parts = [];
    if (loc.barangayName) parts.push(loc.barangayName);
    if (loc.cityMunName) parts.push(loc.cityMunName);
    if (loc.provinceName) parts.push(loc.provinceName);
    if (loc.regionName) parts.push(loc.regionName);
    return parts.join(", ");
  };

  const composeWhenBarangay = (next) => {
    const psgc = buildPsgc(next);
    const user = (next.addressLineUser || "")
    let full = "";

    if (user && psgc) full = `${user}, ${psgc}`;
    else if (user) full = user;
    else full = psgc;

    return { addressLine: full, addressLineUser: user, psgc };
  };

  const updateAndMaybeCompose = (next) => {
    const composed = composeWhenBarangay(next);
    const out = {
      ...next,
      addressLine: composed.addressLine,
      addressLineUser: composed.addressLineUser,
      psgc: composed.psgc,
    };
    onChange(out);
  };

  const onUserAddressLineChange = (txt) => {
    const next = { ...value, addressLineUser: txt };
    updateAndMaybeCompose(next);
  };

  const setRegion = (code) => {
    const r = regions.find((x) => x.code === code);
    const next = {
      ...value,
      regionCode: code,
      regionName: r?.name || "",
      provinceCode: "",
      provinceName: "",
      cityMunCode: "",
      cityMunName: "",
      cityMunKind: "",
      barangayCode: "",
      barangayName: "",
    };
    updateAndMaybeCompose(next);
  };

  const setProvince = (code) => {
    const p = provinces.find((x) => x.code === code);
    const next = {
      ...value,
      provinceCode: code,
      provinceName: p?.name || "",
      cityMunCode: "",
      cityMunName: "",
      cityMunKind: "",
      barangayCode: "",
      barangayName: "",
    };
    updateAndMaybeCompose(next);
  };

  const setCityMun = (code) => {
    const cm = cityMuns.find((x) => x.code === code);
    const kind = (cm?.type || "").toLowerCase().includes("city") ? "city" : "municipality";
    const next = {
      ...value,
      cityMunCode: code,
      cityMunName: cm?.name || "",
      cityMunKind: kind,
      barangayCode: "",
      barangayName: "",
    };
    updateAndMaybeCompose(next);
  };

  const setBarangay = (code) => {
    const b = barangays.find((x) => x.code === code);
    const next = { ...value, barangayCode: code, barangayName: b?.name || "" };
    updateAndMaybeCompose(next);
  };

  /* Load regions from PSGC – may mag-429 dito */
  useEffect(() => {
    if (fallback) return; // huwag nang mag-fetch kapag naka-manual mode

    (async () => {
      try {
        const res = await fetch("https://psgc.cloud/api/regions");
        if (res.status === 429) {
          console.warn("PSGC rate-limited (429): /regions");
          setFallback(true);
          setPsgcError(
            "PSGC API limit reached (429). You can type Region, Province, City/Mun, Barangay manually."
          );
          return;
        }
        if (!res.ok) {
          console.warn("PSGC non-OK:", res.status, "https://psgc.cloud/api/regions");
          setFallback(true);
          setPsgcError(
            "Unable to contact PSGC (status " +
              res.status +
              "). You can type Region, Province, City/Mun, Barangay manually."
          );
          return;
        }
        const d = await res.json();
        let list = Array.isArray(d) ? d : [];

        if (restrictToRegion4A) {
          list = list.filter((r) => {
            const n = (r.name || "").toUpperCase();
            return n.includes("IV-A") || n.includes("CALABARZON");
          });
        }

        setRegions(list);

        // auto-select Region IV-A kung single lang
        if (restrictToRegion4A && !value.regionCode && list.length === 1) {
          const r = list[0];
          const next = {
            ...value,
            regionCode: r.code,
            regionName: r.name || "",
            provinceCode: "",
            provinceName: "",
            cityMunCode: "",
            cityMunName: "",
            cityMunKind: "",
            barangayCode: "",
            barangayName: "",
          };
          updateAndMaybeCompose(next);
        }
      } catch (e) {
        console.error("PSGC fetch error /regions", e);
        setFallback(true);
        setPsgcError(
          "Unable to contact PSGC (network error). You can type Region, Province, City/Mun, Barangay manually."
        );
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restrictToRegion4A, fallback]);

  /* Load provinces */
  useEffect(() => {
    if (fallback) return;
    (async () => {
      if (!value.regionCode) {
        setProvinces([]);
        setCityMuns([]);
        setBarangays([]);
        return;
      }
      try {
        const url = `https://psgc.cloud/api/regions/${value.regionCode}/provinces`;
        const res = await fetch(url);
        if (!res.ok) {
          console.warn("PSGC non-OK provinces:", res.status, url);
          return;
        }
        const d = await res.json();
        setProvinces(Array.isArray(d) ? d : []);
        setCityMuns([]);
        setBarangays([]);
      } catch (e) {
        console.error("PSGC provinces error", e);
      }
    })();
  }, [value.regionCode, fallback]);

  /* Load cities/municipalities */
  useEffect(() => {
    if (fallback) return;
    (async () => {
      if (!value.provinceCode) {
        setCityMuns([]);
        setBarangays([]);
        return;
      }
      try {
        const url = `https://psgc.cloud/api/provinces/${value.provinceCode}/cities-municipalities`;
        const res = await fetch(url);
        if (!res.ok) {
          console.warn("PSGC non-OK cityMuns:", res.status, url);
          return;
        }
        const d = await res.json();
        setCityMuns(Array.isArray(d) ? d : []);
        setBarangays([]);
      } catch (e) {
        console.error("PSGC cityMuns error", e);
      }
    })();
  }, [value.provinceCode, fallback]);

  /* Load barangays */
  useEffect(() => {
    if (fallback) return;
    (async () => {
      if (!value.cityMunCode) {
        setBarangays([]);
        return;
      }
      try {
        const cm = cityMuns.find((x) => x.code === value.cityMunCode);
        const isCity = (cm?.type || "").toLowerCase().includes("city");
        const url = isCity
          ? `https://psgc.cloud/api/cities/${value.cityMunCode}/barangays`
          : `https://psgc.cloud/api/municipalities/${value.cityMunCode}/barangays`;
        const res = await fetch(url);
        if (!res.ok) {
          console.warn("PSGC non-OK brgys:", res.status, url);
          return;
        }
        const d = await res.json();
        setBarangays(Array.isArray(d) ? d : []);
        setErrNote(
          d.length === 0 ? "No barangays fetched (API error or empty). You can proceed without it." : ""
        );
      } catch (e) {
        console.error("PSGC barangays error", e);
      }
    })();
  }, [value.cityMunCode, cityMuns, fallback]);

  /* ---- JSX ---- */
  if (fallback) {
    // MANUAL MODE (walang PSGC / na-429)
    return (
      <div className="section">
        <h3>{label}</h3>

        {withAddressLine && (
          <div className="input-group full">
            <label>
              Lot / Street {requiredFields && <span className="required">*</span>}
            </label>
            <input
              value={value.addressLineUser ?? ""}
              onChange={(e) => onUserAddressLineChange(e.target.value)}
              placeholder="House/Block/Lot, Building, Street"
              required={requiredFields}
            />
          </div>
        )}

        <div className="grid">
          <div className="input-group">
            <label>
              Region {requiredFields && <span className="required">*</span>}
            </label>
            <input
              value={value.regionName || ""}
              onChange={(e) =>
                updateAndMaybeCompose({
                  ...value,
                  regionName: e.target.value,
                  regionCode: "",
                })
              }
              placeholder="e.g., Region IV-A (CALABARZON)"
              required={requiredFields}
            />
          </div>
          <div className="input-group">
            <label>
              Province {requiredFields && <span className="required">*</span>}
            </label>
            <input
              value={value.provinceName || ""}
              onChange={(e) =>
                updateAndMaybeCompose({
                  ...value,
                  provinceName: e.target.value,
                  provinceCode: "",
                })
              }
              placeholder="e.g., Quezon"
              required={requiredFields}
            />
          </div>
          <div className="input-group">
            <label>
              City / Municipality {requiredFields && <span className="required">*</span>}
            </label>
            <input
              value={value.cityMunName || ""}
              onChange={(e) =>
                updateAndMaybeCompose({
                  ...value,
                  cityMunName: e.target.value,
                  cityMunCode: "",
                  cityMunKind: "",
                })
              }
              placeholder="e.g., Lucena City"
              required={requiredFields}
            />
          </div>
          <div className="input-group">
            <label>
              Barangay {requiredFields && <span className="required">*</span>}
            </label>
            <input
              value={value.barangayName || ""}
              onChange={(e) =>
                updateAndMaybeCompose({
                  ...value,
                  barangayName: e.target.value,
                  barangayCode: "",
                })
              }
              placeholder="e.g., Brgy. Dalahican"
              required={requiredFields}
            />
          </div>
        </div>

        {psgcError && (
          <small style={{ color: "#b91c1c" }}>
            {psgcError}
          </small>
        )}
      </div>
    );
  }

  // NORMAL PSGC MODE
  return (
    <div className="section">
      <h3>{label}</h3>

      {withAddressLine && (
        <div className="input-group full" >
          <label>
            Lot / Street {requiredFields && <span className="required">*</span>}
          </label>
          <input
            value={value.addressLineUser ?? ""}
            onChange={(e) => onUserAddressLineChange(e.target.value)}
            placeholder="House/Block/Lot, Building, Street"
            required={requiredFields}
   
          />
          
        </div>
      )}

      <div className="grid">
        <div className="input-group">
          <label>
            Region {requiredFields && <span className="required">*</span>}
          </label>
          <select
            className="address-select"
            value={value.regionCode || ""}
            onChange={(e) => setRegion(e.target.value)}
            required={requiredFields}
            disabled={restrictToRegion4A}
          >
            <option value="">Select Region</option>
            {Array.isArray(regions) &&
              regions.map((r) => (
                <option key={r.code} value={r.code}>
                  {r.name}
                </option>
              ))}
          </select>
        </div>
        <div className="input-group">
          <label>
            Province {requiredFields && <span className="required">*</span>}
          </label>
          <select
            className="address-select"
            value={value.provinceCode || ""}
            onChange={(e) => setProvince(e.target.value)}
            disabled={!value.regionCode}
            required={requiredFields}
          >
            <option value="">Select Province</option>
            {Array.isArray(provinces) &&
              provinces.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.name}
                </option>
              ))}
          </select>
        </div>
        <div className="input-group">
          <label>
            City / Municipality {requiredFields && <span className="required">*</span>}
          </label>
          <select
            className="address-select"
            value={value.cityMunCode || ""}
            onChange={(e) => setCityMun(e.target.value)}
            disabled={!value.provinceCode}
            required={requiredFields}
          >
            <option value="">Select City/Municipality</option>
            {Array.isArray(cityMuns) &&
              cityMuns.map((cm) => {
                const kind = (cm.type || "").toLowerCase().includes("city") ? "City" : "Municipality";
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
            Barangay {requiredFields && <span className="required">*</span>}
          </label>
          <select
            className="address-select"
            value={value.barangayCode || ""}
            onChange={(e) => setBarangay(e.target.value)}
            disabled={!value.cityMunCode}
            required={requiredFields}
          >
            <option value="">Select Barangay</option>
            {Array.isArray(barangays) &&
              barangays.map((b) => (
                <option key={b.code} value={b.code}>
                  {b.name}
                </option>
              ))}
          </select>
          {errNote ? <small style={{ color: "#6b7280" }}>{errNote}</small> : null}
        </div>
      </div>
    </div>
  );
}

/* ============ Leaflet Helpers ============ */
function KeepMapInRegion4A() {
  const map = useMap();
  useEffect(() => {
    map.setMaxBounds(REGION4A_BOUNDS);
    map.fitBounds(REGION4A_BOUNDS, { padding: [20, 20] });
  }, [map]);
  return null;
}

function MiniPickerMap({ lat, lng, onChange, onReverse }) {
  const initial =
    Number.isFinite(lat) && Number.isFinite(lng)
      ? [lat, lng]
      : [REGION4A_CENTER.lat, REGION4A_CENTER.lng];
  const [pos, setPos] = useState(initial);

  useEffect(() => {
    if (Number.isFinite(lat) && Number.isFinite(lng)) setPos([lat, lng]);
  }, [lat, lng]);

  function DraggableMarker() {
    const markerRef = React.useRef(null);
    useMapEvents({
      click(e) {
        const { lat, lng } = e.latlng;
        if (!REGION4A_BOUNDS.contains([lat, lng])) return;
        setPos([lat, lng]);
        if (typeof onChange === "function") onChange({ lat, lng });
        if (typeof onReverse === "function") onReverse(lat, lng);
      },
    });
    return (
      <Marker
        draggable
        eventHandlers={{
          dragend() {
            const m = markerRef.current;
            if (!m) return;
            const ll = m.getLatLng();
            if (!REGION4A_BOUNDS.contains(ll)) return;
            setPos([ll.lat, ll.lng]);
            if (typeof onChange === "function") onChange({ lat: ll.lat, lng: ll.lng });
            if (typeof onReverse === "function") onReverse(ll.lat, ll.lng);
          },
        }}
        position={pos}
        ref={markerRef}
      />
    );
  }

  return (
    <div style={{ border: "1px solid #eee", borderRadius: 8, overflow: "hidden" }}>
      <MapContainer
        style={{ height: 300, width: "100%" }}
        center={pos}
        zoom={Number.isFinite(lat) && Number.isFinite(lng) ? 13 : 9}
        scrollWheelZoom
        worldCopyJump={false}
        maxBounds={REGION4A_BOUNDS}
        maxBoundsViscosity={1.0}
      >
        <KeepMapInRegion4A />
        <TileLayer
          noWrap
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <DraggableMarker />
      </MapContainer>
    </div>
  );
}

/* ===== helpers ===== */
const composeFullAddress = (a) => a?.addressLine || a?.addressLineUser || "";

function generateLocalBlotter(regionCode = "", stationCode = "") {
  const now = new Date();
  const y = String(now.getFullYear());
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  const rand = Math.floor(Math.random() * 100000)
    .toString()
    .padStart(5, "0");
  const tag = ["R4A", regionCode || null, stationCode || null].filter(Boolean).join("-");
  return `${tag}-${y}${m}${d}-${hh}${mm}${ss}-${rand}`;
}

function computeAgeFromBirthdate(birthdateStr) {
  if (!birthdateStr) return "";
  const b = new Date(birthdateStr);
  if (Number.isNaN(b.getTime())) return "";
  const today = new Date();
  let age = today.getFullYear() - b.getFullYear();
  const m = today.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < b.getDate())) {
    age--;
  }
  return age >= 0 ? String(age) : "";
}

/* ================= Main ================= */
const AdminCrime = () => {

    const capitalizeWords = (str) => {
    return str.replace(/\b\w/g, (char) => char.toUpperCase());
  };

  

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [submenuOpen, setSubmenuOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const crimeId = searchParams.get("id");

  const [authChecked, setAuthChecked] = useState(false);

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("access_token");
    localStorage.removeItem("access");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("refresh");
    navigate("/login", { replace: true });
  };

  useEffect(() => {
    const hasToken =
      localStorage.getItem("token") ||
      localStorage.getItem("access_token") ||
      localStorage.getItem("access");
    if (!hasToken) {
      navigate("/login", { replace: true });
    } else {
      setAuthChecked(true);
    }
  }, [navigate]);

  const blank = {
    // ==== Reporting Person ====
    rp_birthdate: "",
    rp_first_name: "",
    rp_middle_name: "",
    rp_last_name: "",
    rp_citizenship: "",
    rp_sex: "",
    rp_age: "",
    rp_place_of_birth: "",
    rp_occupation: "",
    rp_email: "",
    rp_addr: {
      addressLineUser: "",
      addressLine: "",
      psgc: "",
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

    // ==== Case/Victim core ====
    blotter_number: "",
    crime_type: "",
    description: "",
    happened_at: "",

    v_first_name: "",
    v_middle_name: "",
    v_last_name: "",
    v_age: "",
    v_sex: "",
    v_citizenship: "",
    v_birthdate: "",
    v_place_of_birth: "",
    v_occupation: "",
    v_addr: {
      addressLineUser: "",
      addressLine: "",
      psgc: "",
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

    // ==== Crime location ====
    loc_addr: {
      addressLineUser: "",
      addressLine: "",
      psgc: "",
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

    latitude: "",
    longitude: "",
    loc_kind: "",
    loc_waterbody: "",

    v_photo_file: null,
    v_photo_preview: "",
    v_photo_existing: "",

    // ==== SUSPECT ====
    s_first_name: "",
    s_middle_name: "",
    s_last_name: "",
    s_age: "",
    s_crime_type: "",
    s_addr: {
      addressLineUser: "",
      addressLine: "",
      psgc: "",
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
    s_photo_file: null,
    s_photo_preview: "",
    s_photo_existing: "",
  };

  const [form, setForm] = useState(blank);
  const [loading, setLoading] = useState(!!crimeId);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [geoMsg, setGeoMsg] = useState("");
  const [sameReporterVictim, setSameReporterVictim] = useState(false);
  const [hasSuspect, setHasSuspect] = useState(false);

  const geoTimer = useRef(null);
  const latestGeoRun = useRef(0);
  const lastGeoAction = useRef(null);

  const setReportAddr = (next) => setForm((p) => ({ ...p, rp_addr: next }));
  const setVictimAddr = (next) => setForm((p) => ({ ...p, v_addr: next }));
  const setLocAddr = (next) => setForm((p) => ({ ...p, loc_addr: next }));
  const setSuspectAddr = (next) => setForm((p) => ({ ...p, s_addr: next }));

  const onPickVictimPhoto = (e) => {
    const file = e.target.files?.[0] || null;
    if (!file) {
      setForm((p) => ({ ...p, v_photo_file: null, v_photo_preview: "" }));
      return;
    }
    const url = URL.createObjectURL(file);
    setForm((p) => ({ ...p, v_photo_file: file, v_photo_preview: url }));
  };

  const onPickSuspectPhoto = (e) => {
    const file = e.target.files?.[0] || null;
    if (!file) {
      setForm((p) => ({ ...p, s_photo_file: null, s_photo_preview: "" }));
      return;
    }
    const url = URL.createObjectURL(file);
    setForm((p) => ({ ...p, s_photo_file: file, s_photo_preview: url }));
  };

  const appendAddr = (fd, prefix, a) => {
    fd.append(`${prefix}_address`, a.addressLine || "");
    fd.append(`${prefix}_region`, a.regionName || "");
    fd.append(`${prefix}_province`, a.provinceName || "");
    fd.append(`${prefix}_city_municipality`, a.cityMunName || "");
    fd.append(`${prefix}_city_mun_kind`, a.cityMunKind || "");
    fd.append(`${prefix}_barangay`, a.barangayName || "");
    fd.append(`${prefix}_region_code`, a.regionCode || "");
    fd.append(`${prefix}_province_code`, a.provinceCode || "");
    fd.append(`${prefix}_city_mun_code`, a.cityMunCode || "");
    fd.append(`${prefix}_barangay_code`, a.barangayCode || "");
  };

  const queryNominatim = async (paramsObj) => {
    const params = new URLSearchParams({
      format: "jsonv2",
      addressdetails: "1",
      limit: "1",
      countrycodes: "ph",
      bounded: "1",
      viewbox: toViewbox(REGION4A_BOUNDS),
      ...paramsObj,
    });
    const url = `${NOMINATIM_BASE}/search?${params.toString()}`;
    try {
      const res = await fetch(url, { headers: { "Accept-Language": "en" } });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch (e) {
      console.error("nominatim fetch error", e);
      return [];
    }
  };

  // ====== MAS BARANGAY-FOCUSED GEOCODING (no longer reacts to street-only change) ======
  const geocodeLocation = async () => {
    if (lastGeoAction.current === "marker") {
      lastGeoAction.current = null;
      setGeoMsg("Using marker coordinates — skipping address-based override.");
      return;
    }

    const run = ++latestGeoRun.current;
    const { barangayName, cityMunName, provinceName, regionName } = form.loc_addr;
    const hasSome = barangayName || cityMunName || provinceName || regionName;
    if (!hasSome) return;

    setGeoMsg("Finding coordinates based on Barangay…");

    try {
      let hit = null;

      const brgyBase = (barangayName || "").trim();
      const brgyVariants = brgyBase
        ? [brgyBase, `Barangay ${brgyBase}`, `Brgy. ${brgyBase}`]
        : [];

      // 1) Barangay variants + city/province/region
      for (const variant of brgyVariants) {
        if (hit) break;
        const q = [variant, cityMunName, provinceName, regionName, "Philippines"]
          .filter(Boolean)
          .join(", ");
        if (!q) continue;
        const data = await queryNominatim({ q });
        if (data && data[0]) hit = data[0];
      }

      // 2) City + province + region
      if (!hit) {
        const q = [cityMunName, provinceName, regionName, "Philippines"]
          .filter(Boolean)
          .join(", ");
        if (q) {
          const data = await queryNominatim({ q });
          hit = data[0];
        }
      }

      // 3) Province + region fallback
      if (!hit) {
        const q = [provinceName, regionName, "Philippines"].filter(Boolean).join(", ");
        if (q) {
          const data = await queryNominatim({ q });
          hit = data[0];
        }
      }

      if (run !== latestGeoRun.current) return;

      if (hit && hit.lat && hit.lon) {
        const lat = parseFloat(hit.lat);
        const lon = parseFloat(hit.lon);
        if (Number.isFinite(lat) && Number.isFinite(lon) && REGION4A_BOUNDS.contains([lat, lon])) {
          setForm((p) => ({ ...p, latitude: lat, longitude: lon }));
          setGeoMsg(
            "Coordinates set using Barangay + City/Mun + Province. You can fine-tune by dragging the marker."
          );
        } else {
          setGeoMsg(
            "Found coords outside Region IV-A—ignored. Please drag the marker or adjust the PSGC selection."
          );
        }
      } else {
        setGeoMsg(
          "No exact match for this Barangay in Nominatim. Please drag the marker near the correct barangay."
        );
      }
    } catch (e) {
      console.error("geocode error", e);
      setGeoMsg("Geocoding failed (network). Please adjust manually or drag the marker.");
    }
  };

  const reverseNominatim = async (lat, lon) => {
    try {
      const params = new URLSearchParams({
        format: "jsonv2",
        lat: String(lat),
        lon: String(lon),
        addressdetails: "1",
        zoom: "18",
      });
      const url = `${NOMINATIM_BASE}/reverse?${params.toString()}`;
      const res = await fetch(url, { headers: { "Accept-Language": "en" } });
      if (!res.ok) {
        console.warn("reverse nominatim non-ok", res.status);
        return null;
      }
      const data = await res.json();
      return data || null;
    } catch (e) {
      console.error("reverse nominatim error", e);
      return null;
    }
  };

  const handleMarkerSet = async (lat, lng) => {
    lastGeoAction.current = "marker";

    setForm((p) => ({ ...p, latitude: lat, longitude: lng }));
    setGeoMsg("Reverse-looking up street for display…");

    const hit = await reverseNominatim(lat, lng);
    if (!hit) {
      setGeoMsg("Reverse geocode failed. Coordinates only. You can fill address manually.");
      return;
    }
    const addr = hit.address || {};
    const house = addr.house_number || "";
    const road = addr.road || addr.pedestrian || addr.cycleway || addr.footway || "";
    const neighbourhood = addr.neighbourhood || addr.suburb || addr.village || addr.hamlet || "";

    const streetOnly = [house, road].filter(Boolean).join(" ").trim();
    const localSpot = neighbourhood || "";

    const lotStreet = [streetOnly, localSpot].filter(Boolean).join(", ").trim();

    setForm((p) => ({
      ...p,
      loc_addr: {
        ...p.loc_addr,
        addressLineUser: lotStreet || p.loc_addr.addressLineUser,
        addressLine: lotStreet || p.loc_addr.addressLine || p.loc_addr.addressLineUser,
      },
    }));

    setGeoMsg(
      "Lot/Street updated from marker location. Barangay, city, province stay based on PSGC selection."
    );
  };

  // ==== IMPORTANT CHANGE: hindi na kasama ang addressLineUser sa trigger ====
  useEffect(() => {
    if (geoTimer.current) clearTimeout(geoTimer.current);
    const { barangayName, cityMunName, provinceName, regionName } = form.loc_addr;
    const hasSome = barangayName || cityMunName || provinceName || regionName;
    if (!hasSome) return;
    geoTimer.current = setTimeout(() => {
      geocodeLocation();
    }, 700);
    return () => {
      if (geoTimer.current) clearTimeout(geoTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    form.loc_addr.barangayName,
    form.loc_addr.cityMunName,
    form.loc_addr.provinceName,
    form.loc_addr.regionName,
  ]);

  /* Load existing crime when editing */
  useEffect(() => {
    if (!crimeId || !authChecked) return;

    (async () => {
      try {
        const res = await axios.get(`${API_BASE}/api/crimes/${crimeId}/`, {
          headers: {
            ...authHeader(),
          },
        });
        const c = res.data || {};
        setForm((prev) => ({
          ...prev,
          rp_birthdate: (c.rp_birthdate || "").slice(0, 10),

          rp_first_name: c.rp_first_name || "",
          rp_middle_name: c.rp_middle_name || "",
          rp_last_name: c.rp_last_name || "",
          rp_citizenship: c.rp_citizenship || "",
          rp_sex: c.rp_sex || "",
          rp_age: c.rp_age || "",
          rp_place_of_birth: c.rp_place_of_birth || "",
          rp_occupation: c.rp_occupation || "",
          rp_email: c.rp_email || "",
          rp_addr: {
            addressLineUser: c.rp_address || "",
            addressLine: c.rp_address || "",
            psgc: "",
            regionCode: c.rp_region_code || "",
            regionName: c.rp_region || "",
            provinceCode: c.rp_province_code || "",
            provinceName: c.rp_province || "",
            cityMunCode: c.rp_city_mun_code || "",
            cityMunName: c.rp_city_municipality || "",
            cityMunKind: c.rp_city_mun_kind || "",
            barangayCode: c.rp_barangay_code || "",
            barangayName: c.rp_barangay || "",
          },

          blotter_number: c.blotter_number || "",
          crime_type: c.crime_type || "",
          description: c.description || "",
          happened_at: (c.happened_at || "").slice(0, 10),

          v_first_name: c.v_first_name || "",
          v_middle_name: c.v_middle_name || "",
          v_last_name: c.v_last_name || "",
          v_age: c.v_age || "",
          v_sex: c.v_sex || "",
          v_citizenship: c.v_citizenship || "",
          v_birthdate: (c.v_birthdate || "").slice(0, 10),
          v_place_of_birth: c.v_place_of_birth || "",
          v_occupation: c.v_occupation || "",

          v_addr: {
            addressLineUser: c.v_address || "",
            addressLine: c.v_address || "",
            psgc: "",
            regionCode: c.v_region_code || "",
            regionName: c.v_region || "",
            provinceCode: c.v_province_code || "",
            provinceName: c.v_province || "",
            cityMunCode: c.v_city_mun_code || "",
            cityMunName: c.v_city_municipality || "",
            cityMunKind: c.v_city_mun_kind || "",
            barangayCode: c.v_barangay_code || "",
            barangayName: c.v_barangay || "",
          },

          loc_addr: {
            addressLineUser: c.loc_address || "",
            addressLine: c.loc_address || "",
            psgc: "",
            regionCode: c.loc_region_code || "",
            regionName: c.loc_region || "",
            provinceCode: c.loc_province_code || "",
            provinceName: c.loc_province || "",
            cityMunCode: c.loc_city_mun_code || "",
            cityMunName: c.loc_city_municipality || "",
            cityMunKind: c.loc_city_mun_kind || "",
            barangayCode: c.loc_barangay_code || "",
            barangayName: c.loc_barangay || "",
          },

          latitude: c.latitude || "",
          longitude: c.longitude || "",
          loc_kind: c.loc_kind || "",
          loc_waterbody: c.loc_waterbody || "",
          v_photo_file: null,
          v_photo_preview: "",
          v_photo_existing: c.v_photo_url || c.v_photo || "",
        }));
      } catch (e) {
        console.error("load crime error", e?.response?.data || e.message);
        if (e?.response?.status === 401) {
          logout();
          return;
        }
        setMessage("Failed to load report.");
      } finally {
        setLoading(false);
      }
    })();
  }, [crimeId, authChecked]);

  const SexRadio = ({ name, value, onChange, required = false }) => (
    <div className="radio-group">
      <label className="radio">
        <input
          type="radio"
          name={name}
          value="Male"
          checked={value === "Male"}
          onChange={(e) => onChange(e.target.value)}
          required={required}
        />
        <span>Male</span>
      </label>
      <label className="radio">
        <input
          type="radio"
          name={name}
          value="Female"
          checked={value === "Female"}
          onChange={(e) => onChange(e.target.value)}
          required={required}
        />
        <span>Female</span>
      </label>
      <label className="radio">
        <input
          type="radio"
          name={name}
          value="Other"
          checked={value === "Other"}
          onChange={(e) => onChange(e.target.value)}
          required={required}
        />
        <span>Other</span>
      </label>
    </div>
  );

  // Now purely local generator: no more /api/utils/new-blotter/ 404
  const fetchServerBlotter = async () => {
    const local = generateLocalBlotter(form?.loc_addr?.regionCode || "", "");
    return local.toUpperCase();
  };

  const hasSuspectData = () => {
    const s = form;
    return (
      (s.s_first_name && s.s_first_name.trim() !== "") ||
      (s.s_last_name && s.s_last_name.trim() !== "") ||
      (s.s_crime_type && s.s_crime_type.trim() !== "") ||
      (s.s_age && String(s.s_age).trim() !== "") ||
      (s.s_addr && (s.s_addr.addressLineUser || s.s_addr.addressLine))
    );
  };

  useEffect(() => {
    if (!sameReporterVictim) return;

    setForm((prev) => ({
      ...prev,
      v_birthdate: prev.rp_birthdate,
      v_age: prev.rp_age,
      v_first_name: prev.rp_first_name,
      v_middle_name: prev.rp_middle_name,
      v_last_name: prev.rp_last_name,
      v_citizenship: prev.rp_citizenship,
      v_sex: prev.rp_sex,
      v_place_of_birth: prev.rp_place_of_birth,
      v_occupation: prev.rp_occupation,
      v_addr: { ...prev.v_addr, ...prev.rp_addr },
    }));
  }, [
    sameReporterVictim,
    form.rp_first_name,
    form.rp_middle_name,
    form.rp_last_name,
    form.rp_citizenship,
    form.rp_sex,
    form.rp_place_of_birth,
    form.rp_occupation,
    form.rp_addr,
  ]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage("");

    try {
      const fd = new FormData();
      fd.append("rp_birthdate", form.rp_birthdate || "");
      fd.append("rp_first_name", form.rp_first_name || "");
      fd.append("rp_middle_name", form.rp_middle_name || "");
      fd.append("rp_last_name", form.rp_last_name || "");
      fd.append("rp_citizenship", form.rp_citizenship || "");
      fd.append("rp_sex", form.rp_sex || "");
      fd.append("rp_age", form.rp_age || "");
      fd.append("rp_place_of_birth", form.rp_place_of_birth || "");
      fd.append("rp_occupation", form.rp_occupation || "");
      fd.append("rp_email", form.rp_email || "");
      fd.append("rp_address", composeFullAddress(form.rp_addr));

      // Optional – backend can auto-generate if blank
      fd.append("blotter_number", form.blotter_number || "");
      fd.append("crime_type", form.crime_type || "");
      fd.append("description", form.description || "");
      fd.append("happened_at", form.happened_at || "");

      const ageFromBirthdate = computeAgeFromBirthdate(form.v_birthdate);
      fd.append("v_first_name", form.v_first_name || "");
      fd.append("v_middle_name", form.v_middle_name || "");
      fd.append("v_last_name", form.v_last_name || "");
      fd.append("v_age", ageFromBirthdate || form.v_age || "");
      fd.append("v_sex", form.v_sex || "");
      fd.append("v_citizenship", form.v_citizenship || "");
      fd.append("v_birthdate", form.v_birthdate || "");
      fd.append("v_place_of_birth", form.v_place_of_birth || "");
      fd.append("v_occupation", form.v_occupation || "");

      if (form.v_photo_file) fd.append("v_photo", form.v_photo_file);

      appendAddr(fd, "v", form.v_addr);
      appendAddr(fd, "loc", form.loc_addr);

      fd.append("latitude", form.latitude || "");
      fd.append("longitude", form.longitude || "");
      fd.append("loc_kind", form.loc_kind || "");
      fd.append("loc_waterbody", form.loc_waterbody || "");

      let createdCrimeId = crimeId;

      if (crimeId) {
        await axios.patch(`${API_BASE}/api/crimes/${crimeId}/`, fd, {
          headers: {
            ...authHeader(),
            "Content-Type": "multipart/form-data",
          },
        });
        createdCrimeId = crimeId;
        setMessage("Report updated.");
      } else {
        const res = await axios.post(`${API_BASE}/api/crimes/`, fd, {
          headers: {
            ...authHeader(),
            "Content-Type": "multipart/form-data",
          },
        });
        const c = res.data || {};
        createdCrimeId = c.id;
        setMessage("Report saved.");
      }

      // SUSPECT SAVE – only when creating, and if may laman
      if (!crimeId && createdCrimeId && hasSuspectData()) {
        try {
          const fdSus = new FormData();
          fdSus.append("crime_report", createdCrimeId);

          fdSus.append("s_first_name", form.s_first_name || "");
          fdSus.append("s_middle_name", form.s_middle_name || "");
          fdSus.append("s_last_name", form.s_last_name || "");
          fdSus.append("s_age", form.s_age || "");
          fdSus.append("s_crime_type", form.s_crime_type || "");

          appendAddr(fdSus, "s", form.s_addr);
          appendAddr(fdSus, "loc", form.loc_addr);

          fdSus.append("latitude", form.latitude || "");
          fdSus.append("longitude", form.longitude || "");
          fdSus.append("loc_kind", form.loc_kind || "");
          fdSus.append("loc_waterbody", form.loc_waterbody || "");

          if (form.s_photo_file) fdSus.append("s_photo", form.s_photo_file);

          await axios.post(`${API_BASE}/api/suspects/`, fdSus, {
            headers: {
              ...authHeader(),
              "Content-Type": "multipart/form-data",
            },
          });
        } catch (susErr) {
          console.error("save suspect error (combined form)", susErr?.response?.data || susErr.message);
          setMessage(
            "Crime report saved, pero nagka-error sa suspect save. Pakicheck ang console log para sa details."
          );
        }
      }

      if (crimeId) {
        navigate("/VictimeSupectTable");
      } else {
        setForm(blank);
        setSameReporterVictim(false);
        navigate("/VictimeSupectTable");
      }
    } catch (e2) {
      console.error("save crime error", e2?.response?.data || e2.message);
      if (e2?.response?.status === 401) {
        logout();
        return;
      }
      setMessage("Save failed. Check console.");
    } finally {
      setSaving(false);
    }
  };

  if (!authChecked) return null;

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


            <li className="active">
              <div className="submenu-toggle" onClick={() => setSubmenuOpen((s) => !s)}>
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
              <button type="button" className="logout" onClick={logout}>
                <FontAwesomeIcon icon={faRightFromBracket} /> Logout
              </button>
            </li>
          </ul>
        </aside>

        {/* Main Content */}
        <main className="main-content">
          <ErrorBoundary>
            <form onSubmit={handleSubmit} className="crime-form single">
              <h1 style={{ marginBottom: 12 }}>
                {crimeId ? "Edit Victim & Suspect Report" : "Create Victim & Suspect Report"}
              </h1>

              {loading ? <p>Loading…</p> : null}
              {message && (
                <div className="alert" style={{ marginBottom: 12 }}>
                  {message}
                </div>
              )}

              {/* ================== REPORTING PERSON ================== */}
              <div className="form-section show">
                <h2>Reporting Person</h2>
                <div className="grid">

                 <div className="input-group">
                    <label>Blotter Number (optional)</label>

                    <div className="input-with-btn">
                      <input
                        value={form.blotter_number}
                        onChange={(e) =>
                          setForm({ ...form, blotter_number: e.target.value.toUpperCase() })
                        }
                        placeholder="Leave blank to auto-generate (R4A-...-#####)"
                      />

                      <button
                        type="button"
                        className="inside-btn"
                        onClick={async () => {
                          const auto = await fetchServerBlotter();
                          setForm((p) => ({ ...p, blotter_number: auto }));
                        }}
                        title="Auto-generate local blotter number"
                      >
                        Auto
                      </button>
                    </div>
                  </div>

                  <div className="input-group">
                    <label>Type of Crime/Incident</label>
                    <select  className="full-width-select"
                      value={form.crime_type}
                      onChange={(e) => setForm({ ...form, crime_type: e.target.value })}
                      required
                    >
                      <option value="">Select</option>
                      {crimeTypes.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  
                  <div className="input-group">
                    <label>First Name</label>
                    <input
                      placeholder="e.g., Juan"
                      value={form.rp_first_name}
                     onChange={(e) => {
                    const value = e.target.value;
                    setForm((prev) => ({
                      ...prev,
                      rp_first_name: capitalizeWords(value),
                    }));
                  }}
                    />
                  </div>
                  <div className="input-group">
                    <label>Middle Name</label>
                    <input
                      placeholder="e.g., Santos"
                      value={form.rp_middle_name}
                      onChange={(e) => {
                        const value = e.target.value;
                        setForm((prev) => ({
                          ...prev,
                          rp_middle_name: capitalizeWords(value),
                        }));
                      }}
                    />
                  </div>
                  <div className="input-group">
                    <label>Last Name</label>
                    <input
                      placeholder="e.g., Dela Cruz"
                      value={form.rp_last_name}
                     onChange={(e) => {
                      const value = e.target.value;
                      setForm((prev) => ({
                        ...prev,
                        rp_last_name: capitalizeWords(value),
                      }));
                    }}
                    />
                  </div>

                    <div className="input-group">
                    <label>Email Address</label>
                    <input
                      type="email"
                      placeholder="e.g., juan.dc@example.com"
                      value={form.rp_email}
                      onChange={(e) => setForm({ ...form, rp_email: e.target.value })}
                    />
                  </div>
                  
                  <div className="input-group">
                    <label>Birthdate</label>
                    <input
                      type="date"
                      value={form.rp_birthdate}
                      onChange={(e) => {
                        const bd = e.target.value;
                        setForm((prev) => ({
                          ...prev,
                          rp_birthdate: bd,
                          rp_age: computeAgeFromBirthdate(bd),
                        }));
                      }}
                    />
                  </div>

                  <div className="input-group">
                    <label>Age (Auto)</label>
                    <input
                      type="number"
                      placeholder="Auto"
                      value={form.rp_age}
                      readOnly
                    />
                    <small style={{ color: "#6b7280" }}>
                      Automatically computed from Birthdate.
                    </small>
                  </div>
                   <div className="input-group">
                    <label>Sex</label>
                    <SexRadio
                      name="rp_sex"
                      value={form.rp_sex}
                      onChange={(v) => setForm({ ...form, rp_sex: v })}
                      required={false}
                    />
                  </div>
                  
                  <div className="input-group">
                    <label>Citizenship</label>
                    <select
                      className="full-width-select"
                      value={form.rp_citizenship}
                      onChange={(e) => setForm({ ...form, rp_citizenship: e.target.value })}
                    >
                      <option value="">Select Citizenship</option>
                      <option value="Filipino">Filipino</option>
                      <option value="American">American</option>
                      <option value="Japanese">Japanese</option>
                      <option value="Chinese">Chinese</option>
                      <option value="Korean">Korean</option>
                      <option value="British">British</option>
                      <option value="Australian">Australian</option>
                      <option value="Canadian">Canadian</option>
                      <option value="Indian">Indian</option>
                      <option value="Others">Others</option>
                    </select>
              
                  </div>

                 

                

                  <div className="input-group">
                    <label>Place of Birth</label>
                    <input
                      placeholder="e.g., Lucena City, Quezon"
                      value={form.rp_place_of_birth}
                     onChange={(e) => {
                      const value = e.target.value;
                      setForm((prev) => ({
                        ...prev,
                        rp_place_of_birth: capitalizeWords(value),
                      }));
                    }}
                    />
                  </div>

                  <div className="input-group">
                    <label>Occupation</label>
                    <input
                      placeholder="e.g., Fisherman"
                      value={form.rp_occupation}
                     onChange={(e) => {
                      const value = e.target.value;
                      setForm((prev) => ({
                        ...prev,
                        rp_occupation: capitalizeWords(value),
                      }));
                    }}
                    />
                  </div>

                
                </div>

                <PhAddressPicker
                  label="Reporting Person Address"
                  value={form.rp_addr}
                  onChange={setReportAddr}
                  withAddressLine
                  requiredFields={true}
                />
              </div>

              {/* ================== VICTIM ================== */}
              <div className="form-section show">
                <h2>Victim Information</h2>

                {/* Same-person toggle */}
                <div className="input-groups full">
                  <label className="checkbox-inline">
                    <input
                      type="checkbox"
                      checked={sameReporterVictim}
                      onChange={(e) => setSameReporterVictim(e.target.checked)}
                    />
                    <span >Same person as Reporting Person</span>
                  </label>
                </div>

                <div className="grid">
                  

                  

                   <div className="input-group">
                    <label>Victim Photo</label>
                    <input type="file" accept="image/*" onChange={onPickVictimPhoto} />
                    {(form.v_photo_preview || form.v_photo_existing) && (
                      <div className="img-preview">
                        
                      </div>
                    )}
                  </div>

                  <div className="input-group">
                    <label>Date of Incident</label>
                    <input
                      type="date"
                      value={form.happened_at}
                      onChange={(e) => setForm({ ...form, happened_at: e.target.value })}
                      
                    />
                  </div>

                  <div className="input-group">
                    <label>First Name</label>
                    <input
                      placeholder="e.g., Maria"
                      value={form.v_first_name}
                      onChange={(e) => {
                        const value = e.target.value;
                        setForm((prev) => ({
                          ...prev,
                          v_first_name: capitalizeWords(value),
                        }));
                    }}
                      disabled={sameReporterVictim}
                    />
                  </div>
                  <div className="input-group">
                    <label>Middle Name</label>
                    <input
                      placeholder="e.g., Reyes"
                      value={form.v_middle_name}
                      onChange={(e) => {
                        const value = e.target.value;
                        setForm((prev) => ({
                          ...prev,
                          v: capitalizeWords(value),
                        }));
                      }}
                      disabled={sameReporterVictim}
                    />
                  </div>
                  <div className="input-group">
                    <label>Last Name</label>
                    <input
                      placeholder="e.g., Santos"
                      value={form.v_last_name}
                      onChange={(e) => {
                        const value = e.target.value;
                        setForm((prev) => ({
                          ...prev,
                          v_last_name: capitalizeWords(value),
                        }));
                      }}
                      disabled={sameReporterVictim}
                    />
                  </div>

                  <div className="input-group">
                    <label>Age (Auto from Birthdate)</label>
                    <input type="number" placeholder="Auto" value={form.v_age} readOnly />
                    <small style={{ color: "#6b7280" }}>
                      Age is automatically computed based on the Birthdate field.
                    </small>
                  </div>

                  <div className="input-group">
                    <label>Sex</label>
                    <SexRadio
                      name="v_sex"
                      value={form.v_sex}
                      onChange={(v) => setForm({ ...form, v_sex: v })}
                      required={false}
                    />
                  </div>

                  <div className="input-group">
                    <label>Citizenship</label>
                    <input
                      placeholder="e.g., Filipino"
                      value={form.v_citizenship}
                      onChange={(e) => {
                        const value = e.target.value;
                        setForm((prev) => ({
                          ...prev,
                          v_citizenship: capitalizeWords(value),
                        }));
                      }}
                      disabled={sameReporterVictim}
                    />
                  </div>

                  <div className="input-group">
                    <label>Birthdate</label>
                    <input
                      type="date"
                      value={form.v_birthdate}
                      onChange={(e) => {
                        const bd = e.target.value;
                        setForm((prev) => ({
                          ...prev,
                          v_birthdate: bd,
                          v_age: computeAgeFromBirthdate(bd),
                        }));
                      }}
                    />
                  </div>
                  <div className="input-group">
                    <label>Place of Birth</label>
                    <input
                      placeholder="e.g., Tayabas City, Quezon"
                      value={form.v_place_of_birth}
                      onChange={(e) => {
                        const value = e.target.value;
                        setForm((prev) => ({
                          ...prev,
                          v_place_of_birth: capitalizeWords(value),
                        }));
                      }}
                      disabled={sameReporterVictim}
                    />
                  </div>
                  <div className="input-group">
                    <label>Occupation</label>
                    <input
                      placeholder="e.g., Vendor"
                      value={form.v_occupation}
                      onChange={(e) => {
                        const value = e.target.value;
                        setForm((prev) => ({
                          ...prev,
                          v_occupation: capitalizeWords(value),
                        }));
                      }}
                      disabled={sameReporterVictim}
                    />
                  </div>

                 

                  <div className="input-group full">
                    <label>Description / Narrative</label>
                    <textarea
                      rows={3}
                      placeholder="Brief description of the incident…"
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                    />
                  </div>
                </div>

                <PhAddressPicker
                  label="Victim Address"
                  value={form.v_addr}
                  onChange={setVictimAddr}
                  withAddressLine
                  requiredFields={false}
                />
              </div>

              {/* ================== SUSPECT ================== */}

              <div className="form-section show">
                  <div className="input-groups full">
                    <label className="checkbox-inline">
                      <input
                        type="checkbox"
                        checked={hasSuspect}
                        onChange={(e) => setHasSuspect(e.target.checked)}
                      />
                      <span style={{ marginLeft: 8 }}>Have a  Suspect</span>
                    </label>
                </div>
              </div>
              {hasSuspect && (
                <div className="form-section show">
                  <h2>Suspect Information</h2>

                  <div className="input-group">
                      <label>Suspect Photo</label>
                      <input type="file" accept="image/*" onChange={onPickSuspectPhoto} />
                    </div>

                  <div className="grid">
                    <div className="input-group">
                      <label>First Name</label>
                      <input
                        value={form.s_first_name}
                        onChange={(e) => {
                          const value = e.target.value;
                          setForm((prev) => ({
                            ...prev,
                            s_first_name: capitalizeWords(value),
                          }));
                        }}
                        placeholder="Enter suspect's first name"
                      />
                    </div>

                    <div className="input-group">
                      <label>Middle Name</label>
                      <input
                        value={form.s_middle_name}
                        onChange={(e) => {
                          const value = e.target.value;
                          setForm((prev) => ({
                            ...prev,
                            s_middle_name: capitalizeWords(value),
                          }));
                        }}
                        placeholder="Optional"
                      />
                    </div>

                    <div className="input-group">
                      <label>Last Name</label>
                      <input
                        value={form.s_last_name}
                        onChange={(e) => {
                          const value = e.target.value;
                          setForm((prev) => ({
                            ...prev,
                            s_last_name: capitalizeWords(value),
                          }));
                        }}
                        placeholder="Enter suspect's last name"
                      />
                    </div>

                    <div className="input-group">
                      <label>Age</label>
                      <input
                        type="number"
                        value={form.s_age}
                        onChange={(e) =>
                          setForm({ ...form, s_age: e.target.value })
                        }
                        placeholder="Optional"
                      />
                    </div>

                    
                  </div>

                  <PhAddressPicker
                    label="Suspect Address"
                    value={form.s_addr}
                    onChange={setSuspectAddr}
                    withAddressLine
                    requiredFields={false}
                  />
                </div>
              )}

              {/* ================== CRIME LOCATION ================== */}
              <div className="form-section show">
                <h2>Crime Location (Region IV-A only)</h2>
                <PhAddressPicker
                  label="Address (Region IV-A)"
                  value={form.loc_addr}
                  onChange={setLocAddr}
                  withAddressLine
                  requiredFields={false}
                  restrictToRegion4A={true}
                />

                <div className="grid">
                  <div className="input-group">
                    <label>Latitude</label>
                    <input
                      type="number"
                      step="any"
                      placeholder="Auto-filled or set via map"
                      value={form.latitude}
                      onChange={(e) => setForm({ ...form, latitude: e.target.value })}
                    />
                  </div>
                  <div className="input-group">
                    <label>Longitude</label>
                    <input
                      type="number"
                      step="any"
                      placeholder="Auto-filled or set via map"
                      value={form.longitude}
                      onChange={(e) => setForm({ ...form, longitude: e.target.value })}
                    />
                  </div>
                  <div className="input-group full">
                    <small style={{ color: "#6b7280" }}>
                      {geoMsg ||
                        "Tip: Piliin muna ang Region/Province/City/Barangay sa PSGC, tapos hayaan ang system na mag-set ng coordinates based on barangay. Pwede pang i-fine-tune sa map."}
                    </small>
                  </div>
                </div>

                <MiniPickerMap
                  lat={Number(form.latitude)}
                  lng={Number(form.longitude)}
                  onChange={({ lat, lng }) =>
                    setForm((p) => ({ ...p, latitude: lat, longitude: lng }))
                  }
                  onReverse={(lat, lng) => handleMarkerSet(lat, lng)}
                />
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  className="reset-button"
                  onClick={() => (crimeId ? navigate("/VictimeSupectTable") : setForm(blank))}
                >
                  {crimeId ? "Back to Table" : "Reset"}
                </button>
                <button type="submit" className="submit-button" disabled={saving}>
                  <FontAwesomeIcon icon={faSave} />{" "}
                  {saving ? "Saving…" : crimeId ? "Update Report" : "Save Report"}
                </button>
              </div>
            </form>
          </ErrorBoundary>
        </main>
      </div>

      <style>{`
        .radio-group { display:flex; gap:14px; align-items:center; padding-top:6px; }
        .radio { display:inline-flex; align-items:center; gap:8px; cursor:pointer; }
        .radio input[type="radio"] { transform: scale(1.1); }
        .checkbox-inline { display:flex; align-items:center; cursor:pointer; }
      `}</style>
    </div>
  );
};

export default AdminCrime;
