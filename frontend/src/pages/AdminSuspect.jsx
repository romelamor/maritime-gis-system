// src/pages/AdminSuspectForm.jsx
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

/* Leaflet (PH-locked mini picker) */
import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";

/* Fix default marker icons */
const DefaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

/* ================= CONFIG ================= */
/**
 * NOTE:
 * - Default: https://maritime-backend-0gib.onrender.com  (no trailing /, no /api)
 * - Endpoints below use `${API_BASE}/api/...`
 * - In .env, set: VITE_API_BASE=https://maritime-backend-0gib.onrender.com
 */
const API_BASE = (import.meta.env.VITE_API_BASE || "https://maritime-backend-0gib.onrender.com").replace(/\/$/, "");

/** Build Authorization header from localStorage token */
function authHeader() {
  const raw =
    localStorage.getItem("token") ||
    localStorage.getItem("access_token") ||
    localStorage.getItem("access") ||
    "";

  if (!raw) return {};

  // already has Bearer / Token
  if (/^(Bearer|Token)\s/i.test(raw)) {
    return { Authorization: raw };
  }

  // looks like a raw JWT → wrap with Bearer
  if (/^[\w-]+\.[\w-]+\.[\w-]+$/.test(raw)) {
    return { Authorization: `Bearer ${raw}` };
  }

  // fallback
  return { Authorization: raw };
}

const NOMINATIM_BASE = "https://nominatim.openstreetmap.org";
const PSGC_BASE = "https://psgc.cloud/api";

/* Philippines bounds & helpers */
const PH_BOUNDS = L.latLngBounds(L.latLng(4.5, 116.0), L.latLng(21.5, 127.0));
const PH_CENTER = L.latLng(14.5995, 120.9842); // Manila
const toViewbox = (bounds) => {
  const sw = bounds.getSouthWest();
  const ne = bounds.getNorthEast();
  return `${sw.lng},${sw.lat},${ne.lng},${ne.lat}`; // minLon,minLat,maxLon,maxLat
};

/* ========= Error Boundary ========= */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errMsg: "" };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, errMsg: error?.message || "Unknown error" };
  }
  componentDidCatch(error, info) {
    console.error("ErrorBoundary caught:", error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 16 }}>
          <h3>Something went wrong while rendering this page.</h3>
          <pre style={{ whiteSpace: "pre-wrap", color: "#b91c1c" }}>{this.state.errMsg}</pre>
          <p>Try reloading the page or going back.</p>
        </div>
      );
    }
    return this.props.children;
  }
}

/* =============== Helpers =============== */
const fullNameVictim = (row) =>
  [row?.v_first_name, row?.v_middle_name, row?.v_last_name].filter(Boolean).join(" ");

const toDate = (iso) => (iso ? String(iso).split("T")[0] : "");

/* ================= FULL PSGC Address Picker (for Suspect Address) ================= */
function FullPhAddressPicker({ label, value, onChange, withAddressLine }) {
  const [regions, setRegions] = useState([]);
  const [provinces, setProvinces] = useState([]);
  const [cityMuns, setCityMuns] = useState([]);
  const [barangays, setBarangays] = useState([]);
  const [note, setNote] = useState("");

  async function safeFetchJson(url) {
    try {
      const res = await fetch(url);
      if (!res.ok) {
        setNote(`PSGC ${res.status} for ${url}`);
        return [];
      }
      const text = await res.text();
      try {
        const data = JSON.parse(text);
        return Array.isArray(data) ? data : [];
      } catch {
        setNote(`PSGC returned non-JSON for ${url}`);
        return [];
      }
    } catch (e) {
      setNote(`PSGC fetch error for ${url}`);
      return [];
    }
  }

  useEffect(() => {
    (async () => {
      setRegions(await safeFetchJson(`${PSGC_BASE}/regions`));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    (async () => {
      if (!value?.regionCode) {
        setProvinces([]); setCityMuns([]); setBarangays([]); return;
      }
      setProvinces(await safeFetchJson(`${PSGC_BASE}/regions/${value.regionCode}/provinces`));
      setCityMuns([]); setBarangays([]);
    })();
  }, [value?.regionCode]);

  useEffect(() => {
    (async () => {
      if (!value?.provinceCode) {
        setCityMuns([]); setBarangays([]); return;
      }
      setCityMuns(await safeFetchJson(`${PSGC_BASE}/provinces/${value.provinceCode}/cities-municipalities`));
      setBarangays([]);
    })();
  }, [value?.provinceCode]);

  useEffect(() => {
    (async () => {
      if (!value?.cityMunCode) { setBarangays([]); return; }
      const cm = (cityMuns || []).find(x => x.code === value.cityMunCode);
      const isCity = (cm?.type || "").toLowerCase().includes("city");
      const url = isCity
        ? `${PSGC_BASE}/cities/${value.cityMunCode}/barangays`
        : `${PSGC_BASE}/municipalities/${value.cityMunCode}/barangays`;
      const list = await safeFetchJson(url);
      setBarangays(list);
      if (!list.length) setNote("No barangays fetched (API limit/error).");
    })();
  }, [value?.cityMunCode, cityMuns]);

  const setRegion = (code) => {
    const r = (regions || []).find(x => x.code === code);
    onChange({
      ...(value || {}),
      regionCode: code,
      regionName: r?.name || "",
      provinceCode: "", provinceName: "",
      cityMunCode: "", cityMunName: "", cityMunKind: "",
      barangayCode: "", barangayName: "",
    });
  };
  const setProvince = (code) => {
    const p = (provinces || []).find(x => x.code === code);
    onChange({
      ...(value || {}),
      provinceCode: code,
      provinceName: p?.name || "",
      cityMunCode: "", cityMunName: "", cityMunKind: "",
      barangayCode: "", barangayName: "",
    });
  };
  const setCityMun = (code) => {
    const cm = (cityMuns || []).find(x => x.code === code);
    const kind = (cm?.type || "").toLowerCase().includes("city") ? "city" : "municipality";
    onChange({
      ...(value || {}),
      cityMunCode: code,
      cityMunName: cm?.name || "",
      cityMunKind: kind,
      barangayCode: "", barangayName: "",
    });
  };
  const setBarangay = (code) => {
    const b = (barangays || []).find(x => x.code === code);
    onChange({ ...(value || {}), barangayCode: code, barangayName: b?.name || "" });
  };

  return (
    <div className="section">
      <h3>{label}</h3>
      {withAddressLine && (
        <div className="input-group">
          <label>Lot / Street <span className="required">*</span></label>
          <input
            value={value?.addressLine || ""}
            onChange={(e) => onChange({ ...(value || {}), addressLine: e.target.value })}
            placeholder="House no., Street, etc."
            required
          />
        </div>
      )}
      <div className="grid">
        <div className="input-group">
          <label>Region <span className="required">*</span></label>
          <select
            value={value?.regionCode || ""}
            onChange={(e) => setRegion(e.target.value)}
            required
          >
            <option value="">Select Region</option>
            {(regions || []).map(r => <option key={r.code} value={r.code}>{r.name}</option>)}
          </select>
        </div>
        <div className="input-group">
          <label>Province <span className="required">*</span></label>
          <select
            value={value?.provinceCode || ""}
            onChange={(e) => setProvince(e.target.value)}
            disabled={!value?.regionCode}
            required
          >
            <option value="">Select Province</option>
            {(provinces || []).map(p => <option key={p.code} value={p.code}>{p.name}</option>)}
          </select>
        </div>
        <div className="input-group">
          <label>City / Municipality <span className="required">*</span></label>
          <select
            value={value?.cityMunCode || ""}
            onChange={(e) => setCityMun(e.target.value)}
            disabled={!value?.provinceCode}
            required
          >
            <option value="">Select City/Municipality</option>
            {(cityMuns || []).map(cm => {
              const kind = (cm.type || "").toLowerCase().includes("city") ? "City" : "Municipality";
              return <option key={cm.code} value={cm.code}>{cm.name} ({kind})</option>;
            })}
          </select>
        </div>
        <div className="input-group">
          <label>Barangay <span className="required">*</span></label>
          <select
            value={value?.barangayCode || ""}
            onChange={(e) => setBarangay(e.target.value)}
            disabled={!value?.cityMunCode}
            required
          >
            <option value="">Select Barangay</option>
            {(barangays || []).map(b => <option key={b.code} value={b.code}>{b.name}</option>)}
          </select>
        </div>
        {!!note && (
          <div className="input-group full">
            <small style={{ color: "#b45309" }}>{note}</small>
          </div>
        )}
      </div>
    </div>
  );
}

/* ================= SIMPLE Address Picker (for Crime Location only) ================= */
function SimpleAddressPicker({ label, value, onChange, withAddressLine }) {
  return (
    <div className="section">
      <h3>{label}</h3>
      {withAddressLine && (
        <div className="input-group">
          <label>Lot / Street <span className="required">*</span></label>
          <input
            value={value?.addressLine || ""}
            onChange={(e) => onChange({ ...(value || {}), addressLine: e.target.value })}
            placeholder="House no., Street, Barangay, City (optional)"
            required
          />
          <small style={{ color: "#6b7280" }}>
            Tip: Ilagay ang kompletong address sa isang linya (hal. "123 Mabini St., Brgy. X, Tayabas City").
          </small>
        </div>
      )}
    </div>
  );
}

/* ================= Mini Map (locked to PH) ================= */
/* KeepMapInPH sets max bounds and initial fit */
function KeepMapInPH() {
  const map = useMap();
  useEffect(() => {
    map.setMaxBounds(PH_BOUNDS);
    map.fitBounds(PH_BOUNDS, { padding: [20, 20] });
  }, [map]);
  return null;
}

/* Recenter helper - will flyTo when pos changes */
function RecenterOnPos({ pos, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (!map || !pos || !Number.isFinite(pos[0]) || !Number.isFinite(pos[1])) return;
    try {
      map.flyTo(pos, zoom ?? map.getZoom(), { duration: 0.6 });
    } catch {
      map.setView(pos, zoom ?? map.getZoom());
    }
  }, [map, pos, zoom]);
  return null;
}

/* MiniPickerMap now auto-centers when lat/lng present */
function MiniPickerMap({ lat, lng, onChange, onReverse }) {
  const initial = Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : PH_CENTER;
  const [pos, setPos] = useState(initial);
  const markerRef = useRef(null);

  useEffect(() => {
    if (Number.isFinite(lat) && Number.isFinite(lng)) setPos([Number(lat), Number(lng)]);
  }, [lat, lng]);

  function DraggableMarker() {
    useMapEvents({
      click(e) {
        const { lat, lng } = e.latlng;
        if (!PH_BOUNDS.contains([lat, lng])) return;
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
            if (!PH_BOUNDS.contains(ll)) return;
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
        zoom={Number.isFinite(lat) && Number.isFinite(lng) ? 15 : 6}
        scrollWheelZoom
        worldCopyJump={false}
        maxBounds={PH_BOUNDS}
        maxBoundsViscosity={1.0}
      >
        <KeepMapInPH />
        <RecenterOnPos pos={pos} zoom={Number.isFinite(lat) && Number.isFinite(lng) ? 15 : 6} />
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

/* ================= Main ================= */
const crimeTypes = [
  // Crimes against persons
  "Murder",
  "Homicide",
  "Parricide",
  "Physical Injury",
  "Serious Physical Injury",
  "Less Serious Physical Injury",
  "Slight Physical Injury",
  "Rape",
  "Acts of Lasciviousness",
  "Threats",
  "Grave Threats",
  "Coercion",
  "Grave Coercion",
  "Kidnapping",
  "Serious Illegal Detention",
  "Abduction",

  // Crimes against property
  "Theft",
  "Robbery",
  "Robbery with Violence",
  "Robbery with Intimidation",
  "Robbery with Force upon Things",
  "Carnapping",
  "Highway Robbery / Brigandage",
  "Arson",
  "Estafa / Swindling",
  "Malicious Mischief",
  "Fencing",

  // Drugs (RA 9165)
  "Illegal Drug Use",
  "Illegal Drug Possession",
  "Illegal Drug Trading",
  "Drug Smuggling",
  "Drug Manufacturing",

  // Women & children
  "VAWC (RA 9262)",
  "Child Abuse (RA 7610)",
  "Child Exploitation",
  "Child Trafficking",
  "Online Sexual Exploitation of Children",

  // Public order / firearms
  "Illegal Possession of Firearms",
  "Illegal Possession of Explosives",
  "Alarm and Scandal",
  "Direct Assault",
  "Resistance and Disobedience",

  // Cybercrime
  "Cybercrime",
  "Cyberlibel",
  "Online Fraud / Scam",
  "Identity Theft",
  "Hacking / Unauthorized Access",

  // Maritime / environmental
  "Illegal Fishing",
  "Smuggling",
  "Smuggling via Sea",
  "Human Trafficking via Sea",
  "Piracy / Sea Robbery",
  "Illegal Logging",
  "Illegal Wildlife Trade",
  "Environmental Violation",
  "Pollution / Illegal Dumping",

  // Others
  "Vandalism",
  "Fraud",
  "Gambling / Illegal Gambling",
  "Prostitution",
  "Human Trafficking",
  "Drunk / Drug Driving",
  "Public Disturbance",
  "Others",
];
function AdminSuspectFormInner() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [submenuOpen, setSubmenuOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);

  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const suspectId = searchParams.get("id");         // EDIT MODE via ?id=
  const preselectCrime = searchParams.get("crime_report");

  const [crimes, setCrimes] = useState([]);
  const [loading, setLoading] = useState(!!suspectId);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [geoMsg, setGeoMsg] = useState("");

  // 🔐 auth flag
  const [authChecked, setAuthChecked] = useState(false);

  // 🔐 logout helper
  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("access_token");
    localStorage.removeItem("access");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("refresh");
    navigate("/login", { replace: true });
  };

  // 🔐 route guard
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
    crime_report: preselectCrime || "",
    s_first_name: "",
    s_middle_name: "",
    s_last_name: "",
    s_age: "",
    s_crime_type: "",
    s_addr: {
      addressLine: "",
      regionCode: "", regionName: "",
      provinceCode: "", provinceName: "",
      cityMunCode: "", cityMunName: "", cityMunKind: "",
      barangayCode: "", barangayName: "",
    },
    loc_addr: {
      addressLine: "",
      regionCode: "", regionName: "",
      provinceCode: "", provinceName: "",
      cityMunCode: "", cityMunName: "", cityMunKind: "",
      barangayCode: "", barangayName: "",
    },
    latitude: "",
    longitude: "",
    loc_kind: "",
    loc_waterbody: "",
    s_photo_file: null,
    s_photo_preview: "",
    s_photo_existing: "",
  };
  const [form, setForm] = useState(blank);

  // load case list (only after auth)
  useEffect(() => {
    if (!authChecked) return;

    axios
      .get(`${API_BASE}/api/crimes/`, {
        params: { is_archived: false, ordering: "-created_at" },
        headers: {
          ...authHeader(),
        },
      })
      .then(res => {
        const rows = Array.isArray(res.data) ? res.data : (res.data && res.data.results) || [];
        setCrimes(rows || []);
      })
      .catch((e) => {
        console.error("load crimes error", e?.response?.data || e.message);
        if (e?.response?.status === 401) {
          logout();
          return;
        }
        setCrimes([]);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authChecked]);

  // when selecting a crime, autofill the loc addressLine + coords/kind/waterbody if present
  useEffect(() => {
    if (!form.crime_report || !crimes || crimes.length === 0) return;
    const selected = crimes.find(c => String(c.id) === String(form.crime_report));
    if (!selected) return;

    const nextLoc = {
      addressLine: selected.loc_address || selected.location || selected.place_of_incident || selected.place || "",
      regionCode: selected.loc_region_code || "",
      regionName: selected.loc_region || selected.region || "",
      provinceCode: selected.loc_province_code || "",
      provinceName: selected.loc_province || selected.province || "",
      cityMunCode: selected.loc_city_mun_code || "",
      cityMunName: selected.loc_city_municipality || selected.city_municipality || "",
      cityMunKind: selected.loc_city_mun_kind || "",
      barangayCode: selected.loc_barangay_code || "",
      barangayName: selected.loc_barangay || "",
    };

    setForm((p) => ({
      ...p,
      loc_addr: { ...p.loc_addr, ...nextLoc },
      latitude: (selected.latitude != null && selected.latitude !== "") ? selected.latitude : p.latitude,
      longitude: (selected.longitude != null && selected.longitude !== "") ? selected.longitude : p.longitude,
      loc_kind: selected.loc_kind || p.loc_kind,
      loc_waterbody: selected.loc_waterbody || p.loc_waterbody,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.crime_report, crimes]);

  // load suspect if editing (after auth)
  useEffect(() => {
    if (!authChecked) return;
    if (!suspectId) { setLoading(false); return; }

    axios
      .get(`${API_BASE}/api/suspects/${suspectId}/`, {
        headers: {
          ...authHeader(),
        },
      })
      .then(res => {
        const s = res.data || {};
        setForm({
          crime_report: s.crime_report || preselectCrime || "",
          s_first_name: s.s_first_name || "",
          s_middle_name: s.s_middle_name || "",
          s_last_name: s.s_last_name || "",
          s_age: s.s_age || "",
          s_crime_type: s.s_crime_type || "",

          s_addr: {
            addressLine: s.s_address || "",
            regionCode: s.s_region_code || "",
            regionName: s.s_region || "",
            provinceCode: s.s_province_code || "",
            provinceName: s.s_province || "",
            cityMunCode: s.s_city_mun_code || "",
            cityMunName: s.s_city_municipality || "",
            cityMunKind: s.s_city_mun_kind || "",
            barangayCode: s.s_barangay_code || "",
            barangayName: s.s_barangay || "",
          },

          loc_addr: {
            addressLine: s.loc_address || "",
            regionCode: s.loc_region_code || "",
            regionName: s.loc_region || "",
            provinceCode: s.loc_province_code || "",
            provinceName: s.loc_province || "",
            cityMunCode: s.loc_city_mun_code || "",
            cityMunName: s.loc_city_municipality || "",
            cityMunKind: s.loc_city_mun_kind || "",
            barangayCode: s.loc_barangay_code || "",
            barangayName: s.loc_barangay || "",
          },
          latitude: s.latitude || "",
          longitude: s.longitude || "",
          loc_kind: s.loc_kind || "",
          loc_waterbody: s.loc_waterbody || "",

          s_photo_file: null,
          s_photo_preview: "",
          s_photo_existing: s.s_photo_url || s.s_photo || "",
        });
      })
      .catch((e) => {
        console.error("load suspect error", e?.response?.data || e.message);
        if (e?.response?.status === 401) {
          logout();
          return;
        }
        setMessage("Failed to load suspect.");
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suspectId, preselectCrime, authChecked]);

  const appendAddr = (fd, prefix, a = {}) => {
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

  const onPickSuspectPhoto = (e) => {
    const file = e.target.files?.[0] || null;
    if (!file) {
      setForm((p) => ({ ...p, s_photo_file: null, s_photo_preview: "" }));
      return;
    }
    const url = URL.createObjectURL(file);
    setForm((p) => ({ ...p, s_photo_file: file, s_photo_preview: url }));
  };

  /* ================= PH-focused Geocoding ================= */
  const geoTimer = useRef(null);
  const latestGeoRun = useRef(0);
  const lastGeoAction = useRef(null); // "marker" or "address" (to avoid immediate override)

  const queryNominatim = async (paramsObj) => {
    try {
      const params = new URLSearchParams({
        format: "jsonv2",
        addressdetails: "1",
        limit: "1",
        countrycodes: "ph",
        bounded: "1",
        viewbox: toViewbox(PH_BOUNDS),
        ...paramsObj,
      });
      const url = `${NOMINATIM_BASE}/search?${params.toString()}`;
      const res = await fetch(url, { headers: { "Accept-Language": "en" } });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch (e) {
      console.warn("Nominatim fetch error", e);
      return [];
    }
  };

  // reverse geocode helper (for marker -> populate loc_addr.addressLine)
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
      if (!res.ok) return null;
      const data = await res.json();
      return data || null;
    } catch (e) {
      console.error("reverse nominatim error", e);
      return null;
    }
  };

  const geocodeLocation = async () => {
    if (lastGeoAction.current === "marker") {
      lastGeoAction.current = null;
      setGeoMsg("Using marker coordinates — skipping address-based override.");
      return;
    }

    const run = ++latestGeoRun.current;
    const { addressLine } = form.loc_addr || {};
    if (!addressLine) return;

    setGeoMsg("Finding coordinates…");

    try {
      let hit = null;
      const q = [addressLine, "Philippines"].filter(Boolean).join(", ");
      const data = await queryNominatim({ q });
      hit = data[0];

      if (run !== latestGeoRun.current) return;

      if (hit && hit.lat && hit.lon) {
        const lat = parseFloat(hit.lat);
        const lon = parseFloat(hit.lon);
        if (Number.isFinite(lat) && Number.isFinite(lon) && PH_BOUNDS.contains([lat, lon])) {
          setForm((p) => ({ ...p, latitude: lat, longitude: lon }));
          setGeoMsg("Coordinates set (PH-bounded). You can fine-tune by dragging the marker.");
        } else {
          setGeoMsg("Found coords outside PH bounds—ignored. Please drag the marker or adjust address.");
        }
      } else {
        setGeoMsg("No matches found. Please adjust address or drag the marker.");
      }
    } catch (e) {
      console.error("geocode error", e);
      setGeoMsg("Geocoding failed. Please adjust manually or drag the marker.");
    }
  };

  /* Called when marker placed/moved: reverse lookup and populate loc_addr.addressLine */
  const handleMarkerSet = async (lat, lng) => {
    lastGeoAction.current = "marker";
    setForm((p) => ({ ...p, latitude: lat, longitude: lng }));
    setGeoMsg("Reverse-looking up address…");

    const hit = await reverseNominatim(lat, lng);
    if (!hit) {
      setGeoMsg("Reverse geocode failed. You can fill address manually.");
      return;
    }
    const addr = hit.address || {};
    const house = addr.house_number || "";
    const road = addr.road || addr.pedestrian || addr.cycleway || addr.footway || "";
    const neighbourhood = addr.neighbourhood || addr.suburb || addr.village || addr.hamlet || "";
    const city = addr.city || addr.town || addr.village || addr.municipality || "";
    const province = addr.county || addr.state_district || addr.county || addr.state || addr.region || "";

    const parts = [
      [house, road].filter(Boolean).join(" "),
      neighbourhood,
      city,
      province,
    ].filter(Boolean);

    const combined = parts.join(", ");

    const newLoc = {
      addressLine: combined || hit.display_name || "",
      regionCode: "", regionName: addr.state || addr.region || "",
      provinceCode: "", provinceName: province || "",
      cityMunCode: "", cityMunName: city || "",
      cityMunKind: "",
      barangayCode: "", barangayName: neighbourhood || "",
    };

    setForm((p) => ({ ...p, loc_addr: { ...p.loc_addr, ...newLoc } }));
    setGeoMsg("Address filled into Lot/Street from marker (if available). You may adjust further.");
  };

  useEffect(() => {
    if (geoTimer.current) clearTimeout(geoTimer.current);
    const { addressLine } = form.loc_addr || {};
    if (!addressLine) return;
    geoTimer.current = setTimeout(() => {
      geocodeLocation();
    }, 700);
    return () => { if (geoTimer.current) clearTimeout(geoTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.loc_addr?.addressLine]);

  /* ================= Submit ================= */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      if (!form.crime_report) {
        alert("Please select a Crime Report.");
        setSaving(false);
        return;
      }

      const fd = new FormData();
      fd.append("crime_report", form.crime_report);
      fd.append("s_first_name", form.s_first_name || "");
      fd.append("s_middle_name", form.s_middle_name || "");
      fd.append("s_last_name", form.s_last_name || "");
      fd.append("s_age", form.s_age || "");
      fd.append("s_crime_type", form.s_crime_type || "");

      appendAddr(fd, "s", form.s_addr);
      appendAddr(fd, "loc", form.loc_addr);

      fd.append("latitude", form.latitude || "");
      fd.append("longitude", form.longitude || "");
      fd.append("loc_kind", form.loc_kind || "");
      fd.append("loc_waterbody", form.loc_waterbody || "");

      if (form.s_photo_file) fd.append("s_photo", form.s_photo_file);

      if (suspectId) {
        await axios.patch(`${API_BASE}/api/suspects/${suspectId}/`, fd, {
          headers: {
            ...authHeader(),
            "Content-Type": "multipart/form-data",
          },
        });
        setMessage("Suspect updated.");
        navigate("/VictimeSupectTable");
      } else {
        await axios.post(`${API_BASE}/api/suspects/`, fd, {
          headers: {
            ...authHeader(),
            "Content-Type": "multipart/form-data",
          },
        });
        setMessage("Suspect saved.");
        setForm({ ...blank, crime_report: preselectCrime || "" });
        navigate("/VictimeSupectTable");
      }
    } catch (e2) {
      console.error("save suspect error", e2?.response?.data || e2.message);
      if (e2?.response?.status === 401) {
        logout();
        return;
      }
      setMessage("Save failed. Check console.");
    } finally {
      setSaving(false);
    }
  };

  // 🔐 Huwag i-render hangga't di pa tapos ang auth check
  if (!authChecked) {
    return null;
  }

  return (
    <div>
      {/* Top Navigation */}
      <div className="topnav">
        <div className="menu-icon" onClick={() => setSidebarOpen(s => !s)}>☰</div>
        <div className="nav-title">Suspect Form</div>
      </div>

      <div className="container">
        {/* Sidebar */}
        <aside className={`sidebar ${!sidebarOpen ? "collapsed" : ""}`}>
          <div className="logo-section">
            <img src="/assets/logo.png" alt="Logo" />
            <p><strong>Admin</strong><br />Dashboard</p>
          </div>
          <ul className="nav-links">
            <li><Link to="/dashboard"><FontAwesomeIcon icon={faHome} /> Home</Link></li>
            <li><Link to="/adminInfo"><FontAwesomeIcon icon={faUser} /> User Management</Link></li>

            <li className="active">
              <div className="submenu-toggle" onClick={() => setSubmenuOpen(s => !s)}>
                <FontAwesomeIcon icon={faFileInvoice} /> Crime Reports
              </div>
              {submenuOpen && (
                <ul className="submenu">
                  <li><Link to="/VictimeSupectTable">View Reports</Link></li>
                  <li><Link to="/AdminCrime">Victim Reports</Link></li>
                  <li><Link to="/AdminSuspect">Suspects Reports</Link></li>
                </ul>
              )}
            </li>

            <li><Link to="/AdminMaps"><FontAwesomeIcon icon={faMapLocation} /> Maps</Link></li>
            <li><Link to="/AdminAnalytics"><FontAwesomeIcon icon={faChartLine} /> Analytics</Link></li>

            {/* Archive section */}
            <li>
              <div className="submenu-toggle" onClick={() => setArchiveOpen(s => !s)}>
                <FontAwesomeIcon icon={faBoxArchive} /> Archive
              </div>
              {archiveOpen && (
                <ul className="submenu">
                  <li><Link to="/AdminArchivedReports">Archived Reports</Link></li>
                  <li><Link to="/AdminArchivedInfo">Archived User</Link></li>
                </ul>
              )}
            </li>

            <li><Link to="/AdminVerifications"><FontAwesomeIcon icon={faBell} /> AdminVerifications</Link></li>
            <li>
              {/* 🔐 Logout button same behavior */}
              <button type="button" className="logout" onClick={logout}>
                <FontAwesomeIcon icon={faRightFromBracket} /> Logout
              </button>
            </li>
          </ul>
        </aside>

        {/* Main Content (FORM ONLY) */}
        <main className="main-content">
          {loading ? (
            <p>Loading…</p>
          ) : (
            <form onSubmit={handleSubmit} className="crime-form">
              <h3 style={{ marginBottom: 12 }}>
                {suspectId ? "Edit Suspect" : "Create Suspect"}
              </h3>

              {message && <div className="alert" style={{ marginBottom: 12 }}>{message}</div>}

              <div className="input-group">
                <label>Attach to Crime Report <span className="required">*</span></label>
                <select
                  value={form.crime_report || ""}
                  onChange={(e) => setForm({ ...form, crime_report: e.target.value })}
                  required
                >
                  <option value="">Select case…</option>
                  {(crimes || []).map(cr => {
                    const name = fullNameVictim(cr) || "Unknown Victim";
                    const blot = cr?.blotter_number ? `[${cr.blotter_number}] ` : "";
                    const crimeLabel = cr?.crime_type || "Incident";
                    const label = `${blot}${name} — ${crimeLabel}`;
                    const tipParts = [cr?.blotter_number || "", name, crimeLabel, toDate(cr?.happened_at)].filter(Boolean);
                    const tip = tipParts.join(" · ");
                    return (
                      <option key={cr.id} value={cr.id} title={tip}>
                        {label}
                      </option>
                    );
                  })}
                </select>
                <small style={{ color: "#6b7280" }}>
                  Tip: Piliin ang case batay sa pangalan ng biktima at uri ng kaso.
                </small>
              </div>

              <div className="section">
                <h3>Suspect Details</h3>
                <div className="grid">
                  <div className="input-group">
                    <label>First Name</label>
                    <input
                      value={form.s_first_name || ""}
                      onChange={(e) => setForm({ ...form, s_first_name: e.target.value })}
                      placeholder="Enter suspect's first name"
                    />
                  </div>
                  <div className="input-group">
                    <label>Middle Name</label>
                    <input
                      value={form.s_middle_name || ""}
                      onChange={(e) => setForm({ ...form, s_middle_name: e.target.value })}
                      placeholder="Enter suspect's middle name (optional)"
                    />
                  </div>
                  <div className="input-group">
                    <label>Last Name</label>
                    <input
                      value={form.s_last_name || ""}
                      onChange={(e) => setForm({ ...form, s_last_name: e.target.value })}
                      placeholder="Enter suspect's last name"
                    />
                  </div>
                  <div className="input-group">
                    <label>Age</label>
                    <input
                      type="number"
                      value={form.s_age || ""}
                      onChange={(e) => setForm({ ...form, s_age: e.target.value })}
                      placeholder="Enter age (optional)"
                    />
                  </div>
                  <div className="input-group">
                    <label>Suspect Crime Type</label>
                    <select
                      value={form.s_crime_type || ""}
                      onChange={(e) => setForm({ ...form, s_crime_type: e.target.value })}
                    >
                      <option value="">Select crime type…</option>
                      {crimeTypes.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="input-group">
                    <label>Suspect Photo</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={onPickSuspectPhoto}
                    />
                    {(form.s_photo_preview || form.s_photo_existing) && (
                      <div className="img-preview">
                        <img
                          src={form.s_photo_preview || form.s_photo_existing}
                          alt="Suspect"
                          style={{ maxWidth: 160, maxHeight: 160, borderRadius: 8, objectFit: "cover" }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* SUSPECT ADDRESS: full PSGC selects */}
              <FullPhAddressPicker
                label="Suspect Address"
                value={form.s_addr}
                onChange={(next) => setForm((p) => ({ ...p, s_addr: next }))}
                withAddressLine
              />

              {/* CRIME LOCATION: simplified single-line address input */}
              <SimpleAddressPicker
                label="Crime Location Address"
                value={form.loc_addr}
                onChange={(next) => setForm((p) => ({ ...p, loc_addr: next }))}
                withAddressLine
              />

              <div className="grid">
                <div className="input-group">
                  <label>Latitude</label>
                  <input
                    type="number"
                    step="any"
                    value={form.latitude}
                    onChange={(e) => setForm({ ...form, latitude: e.target.value })}
                    placeholder="Latitude (auto or manual)"
                  />
                </div>
                <div className="input-group">
                  <label>Longitude</label>
                  <input
                    type="number"
                    step="any"
                    value={form.longitude}
                    onChange={(e) => setForm({ ...form, longitude: e.target.value })}
                    placeholder="Longitude (auto or manual)"
                  />
                </div>
                <div className="input-group full">
                  <small style={{ color: "#6b7280" }}>
                    {geoMsg || "Tip: Fill the address above; coordinates will auto-fill (PH-bounded). You can also drag the marker."}
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

              <div className="grid" style={{ marginTop: 12 }}>
                <div className="input-group">
                  <label>Location Kind</label>
                  <select
                    value={form.loc_kind || ""}
                    onChange={(e) => setForm({ ...form, loc_kind: e.target.value })}
                  >
                    <option value="">-- Select location kind --</option>
                    <option value="marine">Marine</option>
                    <option value="coastal">Coastal</option>
                    <option value="inland">Inland</option>
                    <option value="unknown">Unknown</option>
                  </select>
                </div>
                <div className="input-group">
                  <label>Waterbody (optional)</label>
                  <input
                    placeholder="e.g., Tayabas Bay"
                    value={form.loc_waterbody || ""}
                    onChange={(e) => setForm({ ...form, loc_waterbody: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  className="btn"
                  onClick={() => navigate("/VictimeSupectTable")}
                  disabled={saving}
                >
                  Back to Table
                </button>
                <button type="submit" className="submit-button" disabled={saving}>
                  <FontAwesomeIcon icon={faSave} /> {saving ? "Saving…" : (suspectId ? "Update Suspect" : "Save Suspect")}
                </button>
              </div>
            </form>
          )}
        </main>
      </div>
    </div>
  );
}

/* Wrap with ErrorBoundary */
export default function AdminSuspectForm() {
  return (
    <ErrorBoundary>
      <AdminSuspectFormInner />
    </ErrorBoundary>
  );
}
