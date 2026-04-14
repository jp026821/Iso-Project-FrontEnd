// UserDashboard.js
import React, { useCallback, useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { useNavigate } from "react-router-dom";
import "./UserDashboard.css";
import UserNotifications from "./UserNotificationsPage";

const API_BASE = "http://localhost:8080";

const UserDashboard = () => {
  const navigate = useNavigate();
  const username = localStorage.getItem("username") || "User";

  const handleLogout = () => {
    localStorage.clear();
    navigate("/");
  };

  const [activeTab, setActiveTab] = useState("profile");

  useEffect(() => {
    const openTab = localStorage.getItem("openTab");
    if (openTab) {
      setActiveTab(openTab);
      localStorage.removeItem("openTab");
      return;
    }

    const profileCompleted = localStorage.getItem("profileCompleted") === "true";
    if (profileCompleted) setActiveTab("products");
  }, []);

  const renderContent = () => {
    switch (activeTab) {
      case "profile":
        return (
          <ProfileSection
            onProfileSaved={() => {
              localStorage.setItem("profileCompleted", "true");
              localStorage.setItem("openTab", "products");
              setActiveTab("products");
            }}
          />
        );

      case "products":
        return (
          <ProductsSection
            onAfterSave={() => {
              localStorage.setItem("openTab", "audit");
              setActiveTab("audit");
            }}
          />
        );

      case "audit":
        return (
          <AuditRequestSection
            onSubmitted={() => {
              localStorage.setItem("openTab", "documents");
              setActiveTab("documents");
            }}
          />
        );

      case "documents":
        return (
          <DocumentUploadSection
            onAfterUpload={() => {
              localStorage.setItem("openTab", "notifications");
              setActiveTab("notifications");
            }}
          />
        );

      case "notifications":
        return <UserNotifications />;

      default:
        return null;
    }
  };

  return (
    <div className="dashboard">
      <header className="topbar">
        <div className="topbar-left" />
        <div className="topbar-right">
          <div className="user-pill">
            <span className="dot" />
            <span className="user-text">Welcome, {username}</span>
          </div>
          <button className="logout-btn" type="button" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      <div className="tabs-wrap">
        <div className="tabs">
          {["profile", "products", "audit", "documents", "notifications"].map((tab) => (
            <button
              key={tab}
              className={`tab ${activeTab === tab ? "active" : ""}`}
              onClick={() => setActiveTab(tab)}
              type="button"
            >
              {tab === "audit"
                ? "Audit Request"
                : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <main className="content">{renderContent()}</main>
    </div>
  );
};

/* ================= PROFILE SECTION ================= */

const ProfileSection = ({ onProfileSaved }) => {
  const [openAddress, setOpenAddress] = useState(true);
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(true);

  const countries = useMemo(() => ["Select", "India", "USA", "UK", "Canada"], []);
  const industries = useMemo(
    () => ["Select", "IT", "Manufacturing", "Healthcare", "Education", "Other"],
    []
  );

  const loginEmail = localStorage.getItem("username") || "";

  const [profile, setProfile] = useState({
    loginEmail,
    notificationEmail: "",
    firstName: "",
    lastName: "",
    displayName: "",
    organizationSize: "Select",
    mobile: "",
    phone: "",
    fax: "",
    industry: "Select",
    jobTitle: "",
    language: "English",
  });

  const [organization, setOrganization] = useState({
    company: "",
    address: "",
    city: "",
    state: "",
    country: "Select",
    postalCode: "",
  });

  const [backup, setBackup] = useState(null);

  const onProfileChange = (e) => {
    const { name, value } = e.target;
    setProfile((p) => {
      const next = { ...p, [name]: value };

      if (name === "firstName" || name === "lastName") {
        next.displayName = `${next.firstName || ""} ${next.lastName || ""}`.trim();
      }

      return next;
    });
  };

  const onOrgChange = (e) => {
    const { name, value } = e.target;
    setOrganization((p) => ({ ...p, [name]: value }));
  };

  const fetchProfile = useCallback(async () => {
    if (!loginEmail) return;
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/profile/getall?loginEmail=${encodeURIComponent(loginEmail)}`);
      if (!res.ok) return;

      const data = await res.json();
      const p = data.profile ? data.profile : data;
      const o = data.organization ? data.organization : {};

      setProfile((prev) => ({ ...prev, ...p, loginEmail }));
      setOrganization((prev) => ({ ...prev, ...o }));

      localStorage.setItem("profileData", JSON.stringify({ ...p, loginEmail }));
      localStorage.setItem("orgData", JSON.stringify(o));
    } catch (err) {
      console.error("Fetch profile error:", err);
    } finally {
      setLoading(false);
    }
  }, [loginEmail]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleSaveOrUpdate = async (e) => {
    e.preventDefault();

    const payload = {
      profile: { ...profile, loginEmail },
      organization:
        organization.company?.trim() ||
        organization.address?.trim() ||
        organization.city?.trim() ||
        organization.state?.trim() ||
        organization.postalCode?.trim() ||
        (organization.country && organization.country !== "Select")
          ? organization
          : null,
    };

    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/profile/saveorupdate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const msg = await res.text();
      if (!res.ok) {
        alert(msg || "Profile update failed");
        return;
      }

      alert(msg || "Profile updated successfully ✅");
      setBackup(null);

      localStorage.setItem("profileData", JSON.stringify(profile));
      localStorage.setItem("orgData", JSON.stringify(organization));

      await fetchProfile();
      if (typeof onProfileSaved === "function") onProfileSaved();
    } catch (err) {
      console.error(err);
      alert("Server not reachable. Check Spring Boot is running on port 8080.");
    } finally {
      setLoading(false);
    }
  };

  const disabled = loading;

  return (
    <div className="profile-page">
      <div className="page-head">
        <div>
          <h2 className="page-title">Profile</h2>
          <div className="page-hint">{loading ? "Loading profile..." : "View your profile details"}</div>
        </div>
        <div className="profile-actions">
          <button
            type="submit"
            form="profileForm"
            className="update-profile-btn"
            disabled={loading}
          >
            {loading ? "Updating..." : "Update Profile"}
          </button>
        </div>
      </div>

      <form id="profileForm" onSubmit={handleSaveOrUpdate}>
        <section className="panel">
          <div className="panel-body">
            <div className="two-col">
              <div className="col">
                <Row label="Login Email">
                  <input name="loginEmail" value={loginEmail} disabled />
                </Row>
                <Row label="First name" required>
                  <input
                    name="firstName"
                    value={profile.firstName}
                    onChange={onProfileChange}
                    required
                    disabled={disabled}
                  />
                </Row>
                <Row label="Last name" required>
                  <input
                    name="lastName"
                    value={profile.lastName}
                    onChange={onProfileChange}
                    required
                    disabled={disabled}
                  />
                </Row>
                <Row label="Display name">
                  <input
                    name="displayName"
                    value={profile.displayName}
                    onChange={onProfileChange}
                    disabled={disabled}
                  />
                </Row>
                <Row label="Notification email">
                  <input
                    name="notificationEmail"
                    value={profile.notificationEmail}
                    onChange={onProfileChange}
                    placeholder="Enter email"
                    disabled={disabled}
                  />
                </Row>
                <Row label="Language">
                  <select
                    name="language"
                    value={profile.language}
                    onChange={onProfileChange}
                    disabled={disabled}
                  >
                    <option>English</option>
                    <option>Hindi</option>
                    <option>Marathi</option>
                  </select>
                </Row>
              </div>

              <div className="col">
                <Row label="Phone">
                  <input
                    name="phone"
                    value={profile.phone}
                    onChange={onProfileChange}
                    disabled={disabled}
                  />
                </Row>
                <Row label="Mobile">
                  <input
                    name="mobile"
                    value={profile.mobile}
                    onChange={onProfileChange}
                    disabled={disabled}
                  />
                </Row>
                <Row label="Fax">
                  <input
                    name="fax"
                    value={profile.fax}
                    onChange={onProfileChange}
                    disabled={disabled}
                  />
                </Row>
                <Row label="Organization size">
                  <select
                    name="organizationSize"
                    value={profile.organizationSize}
                    onChange={onProfileChange}
                    disabled={disabled}
                  >
                    <option>Select</option>
                    <option>1–10</option>
                    <option>11–50</option>
                    <option>51–200</option>
                    <option>201–500</option>
                    <option>500+</option>
                  </select>
                </Row>
                <Row label="Industry">
                  <select
                    name="industry"
                    value={profile.industry}
                    onChange={onProfileChange}
                    disabled={disabled}
                  >
                    {industries.map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </Row>
                <Row label="Job title">
                  <input
                    name="jobTitle"
                    value={profile.jobTitle}
                    onChange={onProfileChange}
                    disabled={disabled}
                  />
                </Row>
              </div>
            </div>
          </div>
        </section>

        <section className="panel">
          <button
            className="panel-head"
            type="button"
            onClick={() => setOpenAddress((s) => !s)}
            aria-expanded={openAddress}
          >
            <span className={`chev ${openAddress ? "open" : ""}`}>▸</span>
            <span className="panel-title">Organization information</span>
          </button>

          {openAddress && (
            <div className="panel-body">
              <div className="two-col">
                <div className="col">
                  <Row label="Company">
                    <input
                      name="company"
                      value={organization.company}
                      onChange={onOrgChange}
                      disabled={disabled}
                    />
                  </Row>
                  <Row label="Address">
                    <textarea
                      name="address"
                      value={organization.address}
                      onChange={onOrgChange}
                      rows={4}
                      disabled={disabled}
                    />
                  </Row>
                  <Row label="Postal code">
                    <input
                      name="postalCode"
                      value={organization.postalCode}
                      onChange={onOrgChange}
                      disabled={disabled}
                    />
                  </Row>
                </div>
                <div className="col">
                  <Row label="City">
                    <input
                      name="city"
                      value={organization.city}
                      onChange={onOrgChange}
                      disabled={disabled}
                    />
                  </Row>
                  <Row label="Country">
                    <select
                      name="country"
                      value={organization.country}
                      onChange={onOrgChange}
                      disabled={disabled}
                    >
                      {countries.map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  </Row>
                  <Row label="State">
                    <input
                      name="state"
                      value={organization.state}
                      onChange={onOrgChange}
                      disabled={disabled}
                    />
                  </Row>
                </div>
              </div>
            </div>
          )}
        </section>

        <div className="actions">
          <button className="save" type="submit" disabled={loading}>
            {loading ? "Updating..." : "Update Profile"}
          </button>
          <div className="req-note">
            <span className="req">*</span> required field
          </div>
        </div>
      </form>
    </div>
  );
};

/* ================= PRODUCTS SECTION ================= */

const ProductsSection = ({ onAfterSave }) => {
  const loginEmail = localStorage.getItem("username") || "";

  const isoProducts = useMemo(
    () => [
      { id: "ISO9001", title: "ISO 9001", desc: "Quality Management System (QMS)" },
      { id: "ISO14001", title: "ISO 14001", desc: "Environmental Management System (EMS)" },
      { id: "ISO45001", title: "ISO 45001", desc: "Occupational Health & Safety (OH&S)" },
      { id: "ISO27001", title: "ISO 27001", desc: "Information Security (ISMS)" },
      { id: "ISO22000", title: "ISO 22000", desc: "Food Safety (FSMS)" },
    ],
    []
  );

  const [selected, setSelected] = useState(() => {
    const saved = localStorage.getItem("selectedIsoProducts");
    return saved ? JSON.parse(saved) : [];
  });

  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return isoProducts;
    return isoProducts.filter((p) =>
      `${p.id} ${p.title} ${p.desc}`.toLowerCase().includes(q)
    );
  }, [query, isoProducts]);

  const toggle = (id) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleSave = async () => {
    localStorage.setItem("selectedIsoProducts", JSON.stringify(selected));
    try {
      await fetch(`${API_BASE}/api/users/user/products`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loginEmail, products: selected }),
      });
    } catch (e) {
      console.error("Products save error:", e);
    }
    alert("Products saved ✅");
    if (typeof onAfterSave === "function") onAfterSave();
  };

  return (
    <div className="products-wrap">
      <div className="products-header">
        <div>
          <h2 className="page-title">ISO Products</h2>
          <div className="page-hint">Search and select ISO standards.</div>
        </div>
        <div className="product-search">
          <input
            className="product-search-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search ISO products... (ex: 9001, security)"
          />
          {query && (
            <button
              className="product-search-clear"
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="no-results">
          No products found for <b>{query}</b>
        </div>
      ) : (
        <div className="products-grid">
          {filtered.map((p) => {
            const active = selected.includes(p.id);
            return (
              <div
                key={p.id}
                className={`product-card ${active ? "selected" : ""}`}
                onClick={() => toggle(p.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") toggle(p.id);
                }}
              >
                <div className="product-top">
                  <h3 className="product-title">{p.title}</h3>
                  <span className={`chip ${active ? "chip-on" : ""}`}>
                    {active ? "Selected" : "Select"}
                  </span>
                </div>
                <p className="muted">{p.desc}</p>
                <div className="check-row" onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" checked={active} onChange={() => toggle(p.id)} />
                  <span>Include</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="products-actions">
        <button
          className="update-profile-btn"
          onClick={handleSave}
          disabled={selected.length === 0}
        >
          Save & Continue →
        </button>
      </div>
    </div>
  );
};

/* ================= AUDIT REQUEST FORM ================= */

const AuditRequestSection = ({ onSubmitted }) => {
  const loginEmail = localStorage.getItem("username") || "";

  const [isoStandardOptions, setIsoStandardOptions] = useState([
    { id: "ISO9001", label: "ISO 9001 (QMS)" },
    { id: "ISO14001", label: "ISO 14001 (EMS)" },
    { id: "ISO45001", label: "ISO 45001 (OH&S)" },
    { id: "ISO27001", label: "ISO 27001 (ISMS)" },
    { id: "ISO22000", label: "ISO 22000 (FSMS)" },
  ]);
  const [isoLoading, setIsoLoading] = useState(false);

  useEffect(() => {
    const loadIso = async () => {
      try {
        setIsoLoading(true);
        const res = await fetch(`${API_BASE}/api/iso-standards/`);
        if (!res.ok) return;
        const data = await res.json();
        const normalized = Array.isArray(data)
          ? data
              .map((x) => ({
                id: x.id || x.isoCode || x.code,
                label: x.label || x.isoName || x.title || x.id || x.isoCode,
              }))
              .filter((x) => x.id)
          : [];
        if (normalized.length) setIsoStandardOptions(normalized);
      } catch (e) {
        console.error("ISO load error:", e);
      } finally {
        setIsoLoading(false);
      }
    };
    loadIso();
  }, []);

  const selectedFromProducts = JSON.parse(localStorage.getItem("selectedIsoProducts") || "[]") || [];
  const storedProfile = JSON.parse(localStorage.getItem("profileData") || "{}");
  const storedOrg = JSON.parse(localStorage.getItem("orgData") || "{}");

  const contactPerson =
    storedProfile.displayName ||
    `${storedProfile.firstName || ""} ${storedProfile.lastName || ""}`.trim();

  const [form, setForm] = useState({
    loginEmail,
    companyName: storedOrg.company || "",
    contactPerson: contactPerson || "",
    designation: storedProfile.jobTitle || "",
    phone: storedProfile.mobile || storedProfile.phone || "",
    address: storedOrg.address || "",
    city: storedOrg.city || "",
    state: storedOrg.state || "",
    country: storedOrg.country && storedOrg.country !== "Select" ? storedOrg.country : "India",
    postalCode: storedOrg.postalCode || "",
    isoStandards: selectedFromProducts,
    auditType: "Internal Audit",
    preferredDate: "",
    duration: "1 Day",
    auditLocation: "",
    scope: "",
    notes: "",
  });

  const [submitting, setSubmitting] = useState(false);

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const toggleIsoStandard = (id) => {
    setForm((f) => {
      const exists = (f.isoStandards || []).includes(id);
      const next = exists
        ? f.isoStandards.filter((x) => x !== id)
        : [...(f.isoStandards || []), id];
      localStorage.setItem("selectedIsoProducts", JSON.stringify(next));
      return { ...f, isoStandards: next };
    });
  };

  const submitAuditRequest = async (e) => {
    e.preventDefault();

    if (!form.isoStandards || form.isoStandards.length === 0) {
      alert("Please select at least one ISO standard.");
      return;
    }

    try {
      setSubmitting(true);

      const res = await fetch(`${API_BASE}/api/audit/audit-details`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        alert((data && (data.message || data.error)) || "Audit request failed");
        return;
      }

      const createdAuditId = data?.auditId || data?.id;
      if (createdAuditId) {
        localStorage.setItem("currentAuditId", String(createdAuditId));
      }

      alert(data?.message || "Audit request submitted ✅");

      if (typeof onSubmitted === "function") onSubmitted();
    } catch (err) {
      console.error(err);
      alert("Server not reachable. Check Spring Boot is running on port 8080.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="audit-wrap">
      <div className="products-header">
        <div>
          <h2 className="page-title">Audit Request Form</h2>
          <div className="page-hint">
            Selected ISO:{" "}
            <b>{form.isoStandards?.length ? form.isoStandards.join(", ") : "None"}</b>
            {isoLoading ? " (Loading ISO list...)" : ""}
          </div>
        </div>
      </div>

      <form className="panel audit-form" onSubmit={submitAuditRequest}>
        <div className="panel-body">
          <section className="panel" style={{ marginBottom: 14 }}>
            <div className="panel-body">
              <h3 style={{ margin: 0, marginBottom: 10 }}>ISO Standard Selection</h3>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: 10,
                }}
              >
                {isoStandardOptions.map((opt) => {
                  const checked = (form.isoStandards || []).includes(opt.id);
                  return (
                    <label
                      key={opt.id}
                      style={{
                        display: "flex",
                        gap: 10,
                        alignItems: "center",
                        padding: "10px 12px",
                        borderRadius: 14,
                        border: "1px solid rgba(255,255,255,0.14)",
                        background: checked
                          ? "rgba(255,255,255,0.08)"
                          : "rgba(255,255,255,0.05)",
                        cursor: "pointer",
                        userSelect: "none",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleIsoStandard(opt.id)}
                      />
                      <span style={{ fontWeight: 800 }}>{opt.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </section>

          <section className="panel" style={{ marginBottom: 14 }}>
            <div className="panel-body">
              <h3 style={{ margin: 0, marginBottom: 10 }}>Audit Details</h3>
              <div className="two-col">
                <div className="col">
                  <Row label="Preferred Date" required>
                    <input
                      type="date"
                      name="preferredDate"
                      value={form.preferredDate}
                      onChange={onChange}
                      required
                    />
                  </Row>
                  <Row label="Audit Type" required>
                    <select name="auditType" value={form.auditType} onChange={onChange}>
                      <option>Internal Audit</option>
                      <option>External Audit</option>
                      <option>Surveillance Audit</option>
                      <option>Certification Audit</option>
                    </select>
                  </Row>
                  <Row label="Duration">
                    <select name="duration" value={form.duration} onChange={onChange}>
                      <option>1 Day</option>
                      <option>2 Days</option>
                      <option>3 Days</option>
                      <option>1 Week</option>
                    </select>
                  </Row>
                </div>
                <div className="col">
                  <Row label="Audit Location" required>
                    <input
                      name="auditLocation"
                      value={form.auditLocation}
                      onChange={onChange}
                      placeholder="Office / Plant / City"
                      required
                    />
                  </Row>
                  <Row label="Scope of Certification">
                    <textarea
                      name="scope"
                      value={form.scope}
                      onChange={onChange}
                      rows={3}
                    />
                  </Row>
                  <Row label="Notes">
                    <textarea
                      name="notes"
                      value={form.notes}
                      onChange={onChange}
                      rows={3}
                    />
                  </Row>
                </div>
              </div>
            </div>
          </section>

          <div className="products-actions">
            <button className="update-profile-btn" type="submit" disabled={submitting}>
              {submitting ? "Submitting..." : "Submit Audit Request"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

/* ================= DOCUMENT UPLOAD SECTION ================= */

const DocumentUploadSection = ({ onAfterUpload }) => {
  const auditId = localStorage.getItem("currentAuditId") || "";
  const selectedIso = useMemo(() => {
    try {
      const stored = localStorage.getItem("selectedIsoProducts") || "[]";
      return JSON.parse(stored) || [];
    } catch {
      return [];
    }
  }, []);

  const allowedExt = useMemo(
    () => ["pdf", "doc", "docx", "xls", "xlsx", "jpg", "jpeg", "png"],
    []
  );
  const maxBytes = 10 * 1024 * 1024;

  const docTemplates = useMemo(() => {
    const common = [
      { docType: "Company Registration / GST / PAN", required: true, isoCode: "ALL" },
      { docType: "Organization Chart", required: true, isoCode: "ALL" },
      { docType: "Scope Statement", required: true, isoCode: "ALL" },
      { docType: "Process Map / Flow", required: true, isoCode: "ALL" },
    ];
    const iso9001 = [{ docType: "Quality Policy & Objectives", required: true, isoCode: "ISO9001" }];
    const iso27001 = [{ docType: "Statement of Applicability (SoA)", required: true, isoCode: "ISO27001" }];

    const selectedSet = new Set(selectedIso);
    const isoSpecific = [...iso9001, ...iso27001].filter((d) => selectedSet.has(d.isoCode));

    return [...common, ...isoSpecific];
  }, [selectedIso]);

  const [pickedFiles, setPickedFiles] = useState({});
  const [statusMap, setStatusMap] = useState({});
  const [uploading, setUploading] = useState(false);

  const validateFile = (file) => {
    if (!file) return "No file selected";
    if (file.size > maxBytes) return "File too large (max 10MB)";
    const ext = (file.name.split(".").pop() || "").toLowerCase();
    if (!allowedExt.includes(ext)) return `Invalid file type .${ext}`;
    return null;
  };

  const onPickFile = (template, file) => {
    const err = validateFile(file);
    if (err) {
      alert(err);
      return;
    }

    setPickedFiles((prev) => ({ ...prev, [template.docType]: file }));
    setStatusMap((prev) => ({ ...prev, [template.docType]: "Ready" }));
  };

  const uploadOne = async (template, file) => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("auditId", auditId);
    fd.append("docType", template.docType);
    fd.append("isoCode", template.isoCode);

    const res = await fetch(`${API_BASE}/api/${auditId}/documents/upload`, {
      method: "POST",
      body: fd,
    });

    const text = await res.text();
    if (!res.ok) {
      throw new Error(text || "Upload failed");
    }
    return text;
  };

  const handleSaveAndContinue = async () => {
    if (!auditId) {
      alert("Audit ID not found. Please submit Audit Request first.");
      return;
    }

    const missingRequired = docTemplates
      .filter((d) => d.required)
      .filter((d) => !pickedFiles[d.docType]);

    if (missingRequired.length > 0) {
      alert(
        `Please upload required documents first:\n\n${missingRequired
          .map((x) => `• ${x.docType}`)
          .join("\n")}`
      );
      return;
    }

    try {
      setUploading(true);

      for (const t of docTemplates) {
        const f = pickedFiles[t.docType];
        if (!f) continue;

        setStatusMap((prev) => ({ ...prev, [t.docType]: "Uploading..." }));
        await uploadOne(t, f);
        setStatusMap((prev) => ({ ...prev, [t.docType]: "Uploaded" }));
      }

      alert("All documents uploaded ✅");
      setPickedFiles({});

      if (typeof onAfterUpload === "function") onAfterUpload();
    } catch (e) {
      console.error(e);
      alert(e.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="products-wrap">
      <div className="products-header">
        <div>
          <h2 className="page-title">Upload Documents</h2>
          <div className="page-hint">
            Audit ID: <b>{auditId || "Not selected"}</b>
          </div>
        </div>
      </div>

      {selectedIso.length === 0 ? (
        <div className="no-results">
          Please select ISO standards in <b>Products</b> first.
        </div>
      ) : !auditId ? (
        <div className="no-results">
          Please submit an <b>Audit Request</b> first to generate an Audit ID.
        </div>
      ) : (
        <>
          <div className="panel" style={{ marginTop: 12 }}>
            <div className="panel-body">
              <h3 style={{ margin: 0, marginBottom: 10 }}>Document Checklist</h3>

              <div style={{ display: "grid", gap: 10 }}>
                {docTemplates.map((t) => {
                  const file = pickedFiles[t.docType];
                  const status = statusMap[t.docType] || "Pending";

                  return (
                    <div
                      key={`${t.isoCode}:${t.docType}`}
                      style={{
                        border: "1px solid rgba(255,255,255,0.12)",
                        borderRadius: 14,
                        padding: 12,
                        background: "rgba(255,255,255,0.05)",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 10,
                          alignItems: "center",
                          flexWrap: "wrap",
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 900 }}>
                            {t.docType} {t.required && <span className="req">*</span>}
                          </div>
                          <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>
                            For: <b>{t.isoCode === "ALL" ? "All Standards" : t.isoCode}</b> •
                            Allowed: {allowedExt.join(", ")} • Max 10MB
                          </div>

                          {file && (
                            <div style={{ marginTop: 6, fontSize: 12, opacity: 0.85 }}>
                              Selected: <b>{file.name}</b>
                            </div>
                          )}
                        </div>

                        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                          <span className={`chip ${status === "Uploaded" ? "chip-on" : ""}`}>
                            {status}
                          </span>

                          <label
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 10,
                              cursor: uploading ? "not-allowed" : "pointer",
                              padding: "8px 12px",
                              borderRadius: 12,
                              border: "1px solid rgba(255,255,255,0.14)",
                              background: "rgba(255,255,255,0.06)",
                              fontWeight: 800,
                              opacity: uploading ? 0.6 : 1,
                            }}
                          >
                            Choose File
                            <input
                              type="file"
                              style={{ display: "none" }}
                              disabled={uploading}
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) onPickFile(t, f);
                                e.target.value = "";
                              }}
                            />
                          </label>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ marginTop: 12, fontSize: 12, opacity: 0.8 }}>
                <span className="req">*</span> Required documents.
              </div>
            </div>
          </div>

          <div className="products-actions" style={{ marginTop: 12 }}>
            <button
              className="update-profile-btn"
              type="button"
              onClick={handleSaveAndContinue}
              disabled={uploading}
            >
              {uploading ? "Uploading..." : "Save & Continue →"}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

/* ================= SHARED ROW ================= */

const Row = ({ label, required, children }) => (
  <div className="row">
    <div className="row-label">
      {label} {required && <span className="req">*</span>}
    </div>
    <div className="row-control">{children}</div>
  </div>
);

Row.propTypes = {
  label: PropTypes.node.isRequired,
  required: PropTypes.bool,
  children: PropTypes.node.isRequired,
};

ProfileSection.propTypes = {
  onProfileSaved: PropTypes.func,
};

ProductsSection.propTypes = {
  onAfterSave: PropTypes.func,
};

AuditRequestSection.propTypes = {
  onSubmitted: PropTypes.func,
};

DocumentUploadSection.propTypes = {
  onAfterUpload: PropTypes.func,
};

export default UserDashboard;