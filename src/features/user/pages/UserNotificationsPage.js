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
    data?.documents,
    data?.documentUploads,
    data?.uploadedDocuments,
    data?.docs,
    data?.auditDocuments,
    data?.files,
    data?.uploads,
    data?.documentList,
    data?.documentDetails,
    data?.items,
    data?.data,
    data?.content,
    data?.results,
    data?.auditDetails,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }

  if (data && typeof data === "object") return [data];

  return [];
};

const normalizeDocuments = (audit) => {
  const docsSource =
    pickFirst(audit, ["documents", "documentUploads", "uploadedDocuments", "docs", "auditDocuments", "files", "uploads", "documentList", "documentDetails"]) ||
    [];

  const docsArray = Array.isArray(docsSource) ? docsSource : Array.isArray(audit) ? audit : [];

  return docsArray
    .map((doc, index) => {
      const raw = doc && typeof doc === "object" ? doc : {};
      const id = pickFirst(raw, ["id", "documentId", "docId", "fileId", "uploadId"]) || index;
      const docType = pickFirst(raw, ["docType", "documentType", "type", "name", "title"]) || "Document";
      const fileName = pickFirst(raw, ["fileName", "originalFileName", "name", "filename", "file", "documentName"]) || "-";
      const status = pickFirst(raw, ["status", "documentStatus", "fileStatus", "approvalStatus", "reviewStatus"]) || pickFirst(audit, ["status", "documentStatus", "approvalStatus"]) || "Pending";
      const adminComment = pickFirst(raw, ["adminComment", "comment", "remarks", "reason", "rejectionReason"]);

      return {
        id,
        docType,
        fileName,
        status,
        adminComment,
      };
    })
    .filter((doc) => doc.id != null);
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
  const storedAuditId =
    localStorage.getItem("currentAuditId") ||
    localStorage.getItem("adminAuditId") ||
    localStorage.getItem("lastAuditId") ||
    "";

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [reUploading, setReUploading] = useState({});

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

      if (!auditId) {
        setItems([]);
        return;
      }

      const docsRes = await fetch(`${API_BASE}/api/${auditId}/documents`);

      if (!docsRes.ok) {
        const t = await docsRes.text().catch(() => "");
        console.error("Documents API failed:", docsRes.status, t);
        setItems([]);
        return;
      }

      const docsData = await docsRes.json().catch(() => []);
      const docs = Array.isArray(docsData) ? docsData : [];

      setItems([
        {
          auditId,
          documents: docs,
        },
      ]);
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
            const auditStatus = docs.length
              ? pickFirst(docs[0], ["status", "documentStatus", "fileStatus", "approvalStatus", "reviewStatus"]) || "Pending"
              : "Pending";

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
                    Audit Documents
                  </div>

                  <span
                    style={{
                      padding: "6px 12px",
                      borderRadius: 999,
                      fontWeight: 800,
                      fontSize: 12,
                      ...chipStyle(auditStatus),
                    }}
                  >
                    {auditStatus}
                  </span>
                </div>

                <div style={{ marginTop: 10, fontSize: 13, opacity: 0.9, display: "grid", gap: 4 }}>
                  <div><b>Audit ID:</b> {auditId}</div>
                  <div>
                    <b>Documents:</b> {docs.length}
                  </div>
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

                              {s === "rejected" && adminComment ? (
                                <div style={{ marginTop: 6, fontSize: 12, color: "#ff6b6b", fontWeight: 800 }}>
                                  Reason: {adminComment}
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