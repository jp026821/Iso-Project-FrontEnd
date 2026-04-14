// src/UserNotifications.js
import React, { useCallback, useEffect, useState } from "react";

const API_BASE = "http://localhost:8080";

const norm = (v) => (v == null ? "" : String(v)).trim();
const lower = (v) => norm(v).toLowerCase();

const pickFirst = (source, keys) => {
  if (!source || typeof source !== "object") return "";

  for (const key of keys) {
    const value = source[key];
    if (value != null && String(value).trim() !== "") return value;
  }

  return "";
};

const collectAuditItems = (data) => {
  if (Array.isArray(data)) return data;

  const candidates = [
    data?.audits,
    data?.auditDetails,
    data?.items,
    data?.data,
    data?.content,
    data?.results,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }

  if (data && typeof data === "object") return [data];

  return [];
};

const addYears = (dateInput, years) => {
  const date = new Date(dateInput);
  if (Number.isNaN(date.getTime())) return "";

  date.setFullYear(date.getFullYear() + years);
  return date.toISOString().slice(0, 10);
};

const chipStyle = (status) => {
  const s = lower(status);
  if (s === "approved")
    return { background: "rgba(34,197,94,.18)", border: "1px solid rgba(34,197,94,.35)" };
  if (s === "rejected")
    return { background: "rgba(239,68,68,.18)", border: "1px solid rgba(239,68,68,.35)" };
  return { background: "rgba(234,179,8,.18)", border: "1px solid rgba(234,179,8,.35)" };
};

export default function UserNotificationsPage() {
  const loginEmail =
    localStorage.getItem("loginEmail") ||
    localStorage.getItem("email") ||
    localStorage.getItem("username") ||
    "";
  const storedAuditId = localStorage.getItem("currentAuditId") ||
    localStorage.getItem("adminAuditId") ||
    localStorage.getItem("lastAuditId") || "";

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [reUploading, setReUploading] = useState({});
  const [downloadingCert, setDownloadingCert] = useState({});

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);

      let auditId = storedAuditId;

      if (!auditId && loginEmail) {
        const summaryRes = await fetch(
          `${API_BASE}/api/audit/audit-details/user?loginEmail=${encodeURIComponent(loginEmail)}`
        );

        if (summaryRes.ok) {
          const summaryData = await summaryRes.json().catch(() => null);
          const summaryItem = Array.isArray(summaryData) ? summaryData[0] || null : summaryData;
          auditId = pickFirst(summaryItem, ["auditId", "id", "requestId", "auditRequestId"]);
        }
      }

      if (!loginEmail) {
        setItems([]);
        return;
      }

      const summaryRes = await fetch(
        `${API_BASE}/api/audit/audit-details/user?loginEmail=${encodeURIComponent(loginEmail)}`
      );

      if (!summaryRes.ok) {
        const t = await summaryRes.text().catch(() => "");
        console.error("Audit summary API failed:", summaryRes.status, t);
        setItems([]);
        return;
      }

      const summaryData = await summaryRes.json().catch(() => null);
      const audits = collectAuditItems(summaryData)
        .map((audit) => ({
          ...audit,
          auditId: pickFirst(audit, ["auditId", "id", "requestId", "auditRequestId"]),
        }))
        .filter((audit) => audit.auditId);

      const auditCards = await Promise.all(
        audits.map(async (audit) => {
          try {
            const docsRes = await fetch(`${API_BASE}/api/${audit.auditId}/documents`);
            const docsData = docsRes.ok ? await docsRes.json().catch(() => []) : [];
            const documents = Array.isArray(docsData) ? docsData : [];

            return { ...audit, documents };
          } catch (error) {
            console.error(`Documents fetch failed for audit ${audit.auditId}:`, error);
            return { ...audit, documents: [] };
          }
        })
      );

      setItems(auditCards);
    } catch (e) {
      console.error("Notifications fetch error:", e);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [loginEmail]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // ✅ Re-upload rejected document
  const handleReUpload = async (auditId, docId, file) => {
    setReUploading((prev) => ({ ...prev, [docId]: true }));
    try {
      const formData = new FormData();
      formData.append("file", file);

      // ⚠️ keep this only if your backend mapping matches
      const res = await fetch(
        `${API_BASE}/api/audit/documents/${docId}/reupload`,
        { method: "PUT", body: formData }
      );

      const message = await res.text();
      if (!res.ok) throw new Error(message);

      alert("Document re-uploaded ✅ Admin will review again.");
      await fetchNotifications();
    } catch (e) {
      alert("Re-upload failed: " + (e?.message || "Unknown error"));
    } finally {
      setReUploading((prev) => ({ ...prev, [docId]: false }));
    }
  };

  const handleCreateAuditAgain = () => {
    localStorage.setItem("openTab", "audit");
    localStorage.removeItem("currentAuditId");
    localStorage.removeItem("lastAuditId");
    window.location.assign("/user");
  };

  const handleDownloadCertificate = async (auditId) => {
    if (!auditId) return;

    setDownloadingCert((prev) => ({ ...prev, [auditId]: true }));
    try {
      const audit = items.find((item) => String(pickFirst(item, ["auditId", "id", "requestId", "auditRequestId"])) === String(auditId)) || {};
      const storedOrg = JSON.parse(localStorage.getItem("orgData") || "{}");
      const companyName =
        pickFirst(audit, ["companyName", "organizationName", "clientName", "company", "name"]) ||
        storedOrg.company ||
        "";
      const isoStandard =
        pickFirst(audit, ["isoStandard", "isoStandardCode", "isoCode"]) ||
        (Array.isArray(audit.isoStandards) ? audit.isoStandards.join(", ") : "");
      const issueDate =
        pickFirst(audit, ["issueDate", "completedAt", "completedDate", "approvedAt", "updatedAt", "createdAt", "preferredDate"]) ||
        new Date().toISOString().slice(0, 10);
      const expiryDate =
        pickFirst(audit, ["expiryDate", "expiresAt", "validUntil", "validTo"]) ||
        addYears(issueDate, 3) ||
        "";
      const auditorName =
        pickFirst(audit, ["auditorName", "assignedAuditor", "auditor", "reviewerName"]) ||
        localStorage.getItem("email") ||
        localStorage.getItem("username") ||
        "";

      const params = new URLSearchParams({
        companyName,
        isoStandard,
        issueDate,
        expiryDate,
        auditorName,
      });

      const candidateUrls = [
        `${API_BASE}/api/audit/${auditId}/certificate`,
        `${API_BASE}/api/certificate/download?${params.toString()}`,
      ];

      let res = null;
      let failureMessage = "";

      for (const url of candidateUrls) {
        const attempt = await fetch(url);
        if (attempt.ok) {
          res = attempt;
          break;
        }

        const message = await attempt.text().catch(() => "");
        failureMessage = message || `Certificate endpoint failed (${attempt.status})`;
      }

      if (!res) {
        throw new Error(failureMessage || "Certificate not available yet");
      }

      const blob = await res.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      const contentDisposition = res.headers.get("content-disposition") || "";
      const filenameMatch = contentDisposition.match(/filename=\"?([^\";]+)\"?/i);
      const filename = filenameMatch?.[1] || `certificate_${auditId}.pdf`;

      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(objectUrl);
    } catch (e) {
      alert(e?.message || "Failed to download certificate");
    } finally {
      setDownloadingCert((prev) => ({ ...prev, [auditId]: false }));
    }
  };

  return (
    <div className="products-wrap">
      <div className="products-header">
        <div>
          <h2 className="page-title">Notifications</h2>
          <div className="page-hint">Audit status + document status</div>
        </div>

        <button className="update-profile-btn" type="button" onClick={fetchNotifications}>
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="no-results">Loading notifications...</div>
      ) : items.length === 0 ? (
        <div className="no-results">No document uploads found yet.</div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {items.map((n) => {
            const auditId =
              pickFirst(n, ["auditId", "id", "requestId", "auditRequestId"]) ||
              `audit-${items.indexOf(n)}`;
            const docs = Array.isArray(n.documents) ? n.documents : [];
            const auditComment = pickFirst(n, ["adminComment", "comment", "remarks", "reason", "rejectionReason"]);
            const statuses = [...new Set(
              docs
                .map((doc) => pickFirst(doc, ["status", "documentStatus", "fileStatus", "approvalStatus", "reviewStatus"]) || "Pending")
                .filter(Boolean)
            )];
            const headerStatus = pickFirst(n, ["status", "auditStatus", "documentStatus", "approvalStatus"]) ||
              (statuses.length > 1 ? "Multiple Statuses" : statuses[0] || "Pending");

            return (
              <div
                key={auditId}
                style={{
                  border: "1px solid rgba(255,255,255,.12)",
                  borderRadius: 14,
                  padding: 14,
                  background: "rgba(255,255,255,.06)",
                }}
              >
                {/* ===== Audit Header ===== */}
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ fontWeight: 900 }}>
                    {pickFirst(n, ["auditType", "auditName", "type", "title"]) || "Audit Documents"}
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span
                      style={{
                        padding: "6px 12px",
                        borderRadius: 999,
                        fontWeight: 800,
                        fontSize: 12,
                        ...chipStyle(headerStatus),
                      }}
                    >
                      {headerStatus}
                    </span>

                    {lower(headerStatus) === "rejected" ? (
                      <button
                        type="button"
                        onClick={handleCreateAuditAgain}
                        style={{
                          padding: "8px 12px",
                          borderRadius: 10,
                          border: "1px solid rgba(239,68,68,0.45)",
                          background: "rgba(239,68,68,0.12)",
                          color: "#fff",
                          fontWeight: 800,
                          cursor: "pointer",
                        }}
                      >
                        Create Audit Again
                      </button>
                    ) : null}

                    {lower(headerStatus) === "completed" ? (
                      <button
                        type="button"
                        onClick={() => handleDownloadCertificate(auditId)}
                        disabled={downloadingCert[auditId]}
                        style={{
                          padding: "8px 12px",
                          borderRadius: 10,
                          border: "1px solid rgba(34,197,94,0.45)",
                          background: "rgba(34,197,94,0.12)",
                          color: "#fff",
                          fontWeight: 800,
                          cursor: downloadingCert[auditId] ? "not-allowed" : "pointer",
                          opacity: downloadingCert[auditId] ? 0.7 : 1,
                        }}
                      >
                        {downloadingCert[auditId] ? "Downloading..." : "Download Audit Certificate"}
                      </button>
                    ) : null}
                  </div>
                </div>

                <div style={{ marginTop: 10, fontSize: 13, opacity: 0.9, display: "grid", gap: 4 }}>
                  <div><b>Audit ID:</b> {auditId}</div>
                  <div>
                    <b>Documents:</b> {docs.length}
                  </div>
                  <div>
                    <b>Audit Status:</b> {headerStatus}
                  </div>
                  {auditComment ? (
                    <div>
                      <b>Admin Comment:</b> {auditComment}
                    </div>
                  ) : null}
                  {statuses.length > 0 ? (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
                      {statuses.map((status) => (
                        <span
                          key={`${auditId}-${status}`}
                          style={{
                            padding: "4px 10px",
                            borderRadius: 999,
                            fontWeight: 800,
                            fontSize: 11,
                            ...chipStyle(status),
                          }}
                        >
                          {status}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>

                {/* ===== Documents ===== */}
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontWeight: 900, marginBottom: 8 }}>Documents</div>

                  {docs.length === 0 ? (
                    <div style={{ opacity: 0.85 }}>No document uploads found yet.</div>
                  ) : (
                    <div style={{ display: "grid", gap: 8 }}>
                      {docs.map((doc) => {
                        const docId = pickFirst(doc, ["id", "documentId", "docId", "fileId", "uploadId"]);
                        const fileName = pickFirst(doc, ["originalFileName", "fileName", "name", "filename", "documentName"]) || "-";
                        const docType = pickFirst(doc, ["fileType", "docType", "documentType", "type", "title"]) || "Document";
                        const status = pickFirst(doc, ["status", "documentStatus", "fileStatus", "approvalStatus", "reviewStatus"]) || "Pending";
                        const adminComment = pickFirst(doc, ["adminComment", "comment", "remarks", "reason", "rejectionReason"]);
                        const s = lower(status);

                        return (
                          <div
                            key={docId || `${auditId}-${fileName}-${docType}`}
                            style={{
                              padding: "10px 12px",
                              borderRadius: 12,
                              border:
                                s === "rejected"
                                  ? "1px solid rgba(239,68,68,0.35)"
                                  : s === "approved"
                                  ? "1px solid rgba(34,197,94,0.35)"
                                  : "1px solid rgba(234,179,8,0.35)",
                              background:
                                s === "rejected"
                                  ? "rgba(239,68,68,0.08)"
                                  : s === "approved"
                                  ? "rgba(34,197,94,0.08)"
                                  : "rgba(234,179,8,0.08)",
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              flexWrap: "wrap",
                              gap: 10,
                            }}
                          >
                            <div>
                              <div style={{ fontWeight: 900 }}>{docType}</div>
                              <div style={{ fontSize: 12, opacity: 0.8 }}>{fileName}</div>

                              {adminComment ? (
                                <div style={{ marginTop: 6, fontSize: 12, color: "#ff6b6b", fontWeight: 800 }}>
                                  Admin Comment: {adminComment}
                                </div>
                              ) : null}
                            </div>

                            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                              <span
                                style={{
                                  padding: "6px 12px",
                                  borderRadius: 999,
                                  fontWeight: 900,
                                  fontSize: 12,
                                  ...chipStyle(status),
                                }}
                              >
                                {status}
                              </span>

                              {s === "rejected" ? (
                                <label
                                  style={{
                                    cursor: reUploading[docId] ? "not-allowed" : "pointer",
                                    padding: "8px 12px",
                                    borderRadius: 10,
                                    border: "1px solid rgba(239,68,68,0.45)",
                                    background: "rgba(239,68,68,0.12)",
                                    fontWeight: 900,
                                    opacity: reUploading[docId] ? 0.6 : 1,
                                  }}
                                >
                                  {reUploading[docId] ? "Uploading..." : "Re-upload"}
                                  <input
                                    type="file"
                                    style={{ display: "none" }}
                                    disabled={reUploading[docId]}
                                    onChange={(e) => {
                                      const f = e.target.files?.[0];
                                      if (f && docId != null) handleReUpload(auditId, docId, f);
                                      e.target.value = "";
                                    }}
                                  />
                                </label>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}