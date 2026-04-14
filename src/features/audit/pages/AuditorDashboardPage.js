import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./AuditorDashboard.css";

const API_BASE = "http://localhost:8080/api";

const normalizeStatus = (value) => {
  const raw = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[-\s]+/g, "_");

  if (raw === "all") return "ALL";
  if (raw === "assigned") return "ASSIGNED";
  if (raw === "in_progress") return "IN_PROGRESS";
  if (raw === "correction_required" || raw === "need_correction") return "NEED_CORRECTION";
  if (raw === "completed") return "COMPLETED";

  return raw.toUpperCase();
};

export default function AuditorDashboard() {
  const navigate = useNavigate();
  const auditorEmail = localStorage.getItem("email") || "";

  const [audits, setAudits] = useState([]);
  const [selectedAudit, setSelectedAudit] = useState(null);
  const [updates, setUpdates] = useState([]);
  const [documents, setDocuments] = useState([]);

  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const [remark, setRemark] = useState("");
  const [status, setStatus] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  const [loadingList, setLoadingList] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [savingRemark, setSavingRemark] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);

  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  const clearMessages = () => {
    setMsg("");
    setError("");
  };

  const handleLogout = () => {
    localStorage.clear();
    navigate("/login");
  };

  const fetchAssignedAudits = useCallback(async () => {
    if (!auditorEmail) {
      setError("Auditor email not found. Please login again.");
      return;
    }

    try {
      clearMessages();
      setLoadingList(true);

      const res = await fetch(
        `${API_BASE}/auditor/my-audits?auditorEmail=${encodeURIComponent(auditorEmail)}`
      );

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to load assigned audits");
      }

      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      setAudits(list);

      if (selectedAudit) {
        const stillExists = list.find((a) => a.auditId === selectedAudit.auditId);
        if (!stillExists) {
          setSelectedAudit(null);
          setUpdates([]);
          setDocuments([]);
        }
      }
    } catch (err) {
      setError(err.message || "Failed to load assigned audits");
      setAudits([]);
    } finally {
      setLoadingList(false);
    }
  }, [auditorEmail, selectedAudit]);

  const fetchAuditUpdates = async (auditId) => {
    try {
      const res = await fetch(
        `${API_BASE}/auditor/audit/${auditId}/updates?auditorEmail=${encodeURIComponent(auditorEmail)}`
      );

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to load audit history");
      }

      const data = await res.json();
      setUpdates(Array.isArray(data) ? data : []);
    } catch (err) {
      setUpdates([]);
    }
  };

  const fetchAuditDetails = async (auditId) => {
    try {
      clearMessages();
      setLoadingDetails(true);

      const res = await fetch(
        `${API_BASE}/auditor/audit/${auditId}?auditorEmail=${encodeURIComponent(auditorEmail)}`
      );

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to load audit details");
      }

      const data = await res.json();

      setSelectedAudit(data);
      setRemark(data.auditorComment || "");
      setStatus(data.status || "");
      setStatusMessage("");
      setDocuments(Array.isArray(data.documents) ? data.documents : []);

      await fetchAuditUpdates(auditId);

      // Smooth scroll to details after clicking view
      setTimeout(() => {
        const detailsSection = document.getElementById("audit-details-section");
        if (detailsSection) {
          detailsSection.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 200);
    } catch (err) {
      setError(err.message || "Failed to load audit details");
      setSelectedAudit(null);
      setDocuments([]);
      setUpdates([]);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleSaveRemark = async () => {
    if (!selectedAudit) {
      setError("Please select an audit first.");
      return;
    }

    if (!remark.trim()) {
      setError("Please enter a remark.");
      return;
    }

    try {
      clearMessages();
      setSavingRemark(true);

      const res = await fetch(`${API_BASE}/auditor/audit/${selectedAudit.auditId}/remark`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          auditorEmail,
          remark,
        }),
      });

      const text = await res.text();

      if (!res.ok) {
        throw new Error(text || "Failed to save remark");
      }

      setMsg(text || "Remark saved successfully");
      await fetchAssignedAudits();
      await fetchAuditDetails(selectedAudit.auditId);
    } catch (err) {
      setError(err.message || "Failed to save remark");
    } finally {
      setSavingRemark(false);
    }
  };

  const handleUpdateStatus = async (forcedStatus = null) => {
    if (!selectedAudit) {
      setError("Please select an audit first.");
      return;
    }

    const finalStatus = forcedStatus || status;

    if (!finalStatus.trim()) {
      setError("Please select a status.");
      return;
    }

    try {
      clearMessages();
      setSavingStatus(true);

      const res = await fetch(`${API_BASE}/auditor/audit/${selectedAudit.auditId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          auditorEmail,
          status: finalStatus,
          message: statusMessage,
        }),
      });

      const text = await res.text();

      if (!res.ok) {
        throw new Error(text || "Failed to update status");
      }

      setMsg(text || "Status updated successfully");
      setStatusMessage("");
      await fetchAssignedAudits();
      await fetchAuditDetails(selectedAudit.auditId);
    } catch (err) {
      setError(err.message || "Failed to update status");
    } finally {
      setSavingStatus(false);
    }
  };

  const handleNotifyAdmin = async () => {
    if (!selectedAudit) {
      setError("Please select an audit first.");
      return;
    }

    if (!statusMessage.trim()) {
      setError("Please write a message for admin.");
      return;
    }

    try {
      clearMessages();
      setSavingStatus(true);

      const res = await fetch(`${API_BASE}/audit/${selectedAudit.auditId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          auditorEmail,
          status: selectedAudit.status || status || "In_Progress",
          message: `ADMIN NOTICE: ${statusMessage}`,
        }),
      });

      const text = await res.text();

      if (!res.ok) {
        throw new Error(text || "Failed to notify admin");
      }

      setMsg(text || "Admin notified successfully");
      setStatusMessage("");
      await fetchAssignedAudits();
      await fetchAuditDetails(selectedAudit.auditId);
    } catch (err) {
      setError(err.message || "Failed to notify admin");
    } finally {
      setSavingStatus(false);
    }
  };

  const handleViewDocument = (auditId, docId) => {
    window.open(`${API_BASE}/${auditId}/documents/${docId}`, "_blank");
  };

  const handleDownloadDocument = async (auditId, docId, fileName) => {
    try {
      const res = await fetch(`${API_BASE}/${auditId}/documents/${docId}`);

      if (!res.ok) {
        throw new Error("Failed to download document");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = fileName || "document";
      document.body.appendChild(a);
      a.click();
      a.remove();

      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message || "Failed to download document");
    }
  };

  const filteredAudits = useMemo(() => {
    let list = Array.isArray(audits) ? [...audits] : [];

    if (statusFilter !== "ALL") {
      list = list.filter((item) => normalizeStatus(item.status) === statusFilter);
    }

    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      list = list.filter((item) => {
        return (
          String(item.auditId || "").toLowerCase().includes(q) ||
          String(item.loginEmail || "").toLowerCase().includes(q) ||
          String(item.auditType || "").toLowerCase().includes(q) ||
          String(item.auditLocation || "").toLowerCase().includes(q) ||
          String(item.status || "").toLowerCase().includes(q)
        );
      });
    }

    return list;
  }, [audits, searchText, statusFilter]);

  const stats = useMemo(() => {
    const byStatus = (key) => audits.filter((a) => normalizeStatus(a.status) === key).length;

    return {
      total: audits.length,
      assigned: byStatus("ASSIGNED"),
      inProgress: byStatus("IN_PROGRESS"),
      correctionRequired: byStatus("NEED_CORRECTION"),
      completed: byStatus("COMPLETED"),
    };
  }, [audits]);

  const statusButtons = useMemo(
    () => [
      { key: "ALL", label: "Total Audits", count: stats.total },
      { key: "ASSIGNED", label: "Assigned", count: stats.assigned },
      { key: "IN_PROGRESS", label: "In_Progress", count: stats.inProgress },
      { key: "NEED_CORRECTION", label: "Need Correction", count: stats.correctionRequired },
      { key: "COMPLETED", label: "Completed", count: stats.completed },
    ],
    [stats]
  );

  useEffect(() => {
    fetchAssignedAudits();
  }, [fetchAssignedAudits]);

  return (
    <div className="auditor-dashboard">
      <aside className="auditor-sidebar">
        <div className="brand-box">
          <h2>Auditor Panel</h2>
          <p>{auditorEmail || "No email found"}</p>
        </div>

        <button className="sidebar-btn" onClick={fetchAssignedAudits}>
          Refresh Audits
        </button>

        <div className="sidebar-stats">
          <div className="mini-stat">
            <span>Total</span>
            <strong>{stats.total}</strong>
          </div>
          <div className="mini-stat">
            <span>Assigned</span>
            <strong>{stats.assigned}</strong>
          </div>
          <div className="mini-stat">
            <span>In_Progress</span>
            <strong>{stats.inProgress}</strong>
          </div>
          <div className="mini-stat">
            <span>Need Correction</span>
            <strong>{stats.correctionRequired}</strong>
          </div>
          <div className="mini-stat">
            <span>Completed</span>
            <strong>{stats.completed}</strong>
          </div>
        </div>

        <button className="sidebar-btn logout-btn" onClick={handleLogout}>
          Logout
        </button>
      </aside>

      <main className="auditor-main">
        <div className="page-head">
          <h1>Assigned Audits</h1>
          <p>Review client audits, check documents, update remarks, and manage audit flow.</p>
        </div>

        {msg && <div className="alert success">{msg}</div>}
        {error && <div className="alert error">{error}</div>}

        <div className="top-cards">
          {statusButtons.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`top-card stat-filter-btn ${statusFilter === item.key ? "active" : ""}`}
              onClick={() => setStatusFilter(item.key)}
            >
              <h4>{item.label}</h4>
              <p>{item.count}</p>
            </button>
          ))}
        </div>

        <div className="filters">
          <input
            type="text"
            placeholder="Search by audit ID, client email, audit type, location..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
        </div>

        <div className="content-grid">
          {/* FULL WIDTH AUDIT LIST */}
          <section className="panel full-width-panel">
            <div className="panel-head">
              <h3>Audit List</h3>
            </div>

            {loadingList ? (
              <p className="muted">Loading audits...</p>
            ) : filteredAudits.length === 0 ? (
              <p className="muted">No assigned audits found.</p>
            ) : (
              <div className="table-wrap">
                <table className="audit-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Client Email</th>
                      <th>Audit Type</th>
                      <th>Location</th>
                      <th>Status</th>
                      <th>Date</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAudits.map((audit) => (
                      <tr key={audit.auditId}>
                        <td>{audit.auditId}</td>
                        <td>{audit.loginEmail || "-"}</td>
                        <td>{audit.auditType || "-"}</td>
                        <td>{audit.auditLocation || "-"}</td>
                        <td>
                          <span className="status-pill">{audit.status || "-"}</span>
                        </td>
                        <td>{audit.preferredDate || "-"}</td>
                        <td>
                          <button
                            className="btn primary"
                            onClick={() => fetchAuditDetails(audit.auditId)}
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* AUDIT DETAILS BELOW */}
          <section
            className="panel full-width-panel audit-details-panel"
            id="audit-details-section"
          >
            <div className="panel-head">
              <h3>Audit Details</h3>
            </div>

            {loadingDetails ? (
              <p className="muted">Loading audit details...</p>
            ) : !selectedAudit ? (
              <p className="muted">Select an audit from the audit list above.</p>
            ) : (
              <>
                <div className="details-box">
                  <div className="details-grid">
                    <div>
                      <label>Audit ID</label>
                      <p>{selectedAudit.auditId}</p>
                    </div>
                    <div>
                      <label>Status</label>
                      <p>{selectedAudit.status || "-"}</p>
                    </div>
                    <div>
                      <label>Client Email</label>
                      <p>{selectedAudit.loginEmail || "-"}</p>
                    </div>
                    <div>
                      <label>Assigned Auditor</label>
                      <p>{selectedAudit.assignedAuditor || auditorEmail}</p>
                    </div>
                    <div>
                      <label>Audit Type</label>
                      <p>{selectedAudit.auditType || "-"}</p>
                    </div>
                    <div>
                      <label>Preferred Date</label>
                      <p>{selectedAudit.preferredDate || "-"}</p>
                    </div>
                    <div>
                      <label>Duration</label>
                      <p>{selectedAudit.duration || "-"}</p>
                    </div>
                    <div>
                      <label>Audit Location</label>
                      <p>{selectedAudit.auditLocation || "-"}</p>
                    </div>
                  </div>

                  <div className="detail-row">
                    <label>Scope</label>
                    <p>{selectedAudit.scope || "-"}</p>
                  </div>

                  <div className="detail-row">
                    <label>Notes</label>
                    <p>{selectedAudit.notes || "-"}</p>
                  </div>

                  <div className="detail-row">
                    <label>Admin Comment</label>
                    <p>{selectedAudit.adminComment || "-"}</p>
                  </div>

                  <div className="detail-row">
                    <label>Auditor Comment</label>
                    <p>{selectedAudit.auditorComment || "-"}</p>
                  </div>

                  <div className="detail-row">
                    <label>ISO Standards</label>
                    {Array.isArray(selectedAudit.isoStandards) &&
                    selectedAudit.isoStandards.length > 0 ? (
                      <ul className="iso-list">
                        {selectedAudit.isoStandards.map((iso, index) => (
                          <li key={index}>{iso}</li>
                        ))}
                      </ul>
                    ) : (
                      <p>-</p>
                    )}
                  </div>
                </div>

                <div className="form-box">
                  <h4>Uploaded Documents</h4>

                  {documents.length === 0 ? (
                    <p className="muted">No uploaded documents found.</p>
                  ) : (
                    <div className="doc-list">
                      {documents.map((doc) => (
                        <div className="doc-item" key={doc.id}>
                          <div className="doc-info">
                            <strong>{doc.fileName || "Document"}</strong>
                            <p><b>Type:</b> {doc.docType || doc.fileType || "-"}</p>
                            <p><b>Status:</b> {doc.status || "-"}</p>
                            <p><b>Comment:</b> {doc.adminComment || "-"}</p>
                          </div>

                          <div className="doc-actions">
                            <button
                              className="btn secondary"
                              type="button"
                              onClick={() => handleViewDocument(selectedAudit.auditId, doc.id)}
                            >
                              View
                            </button>
                            <button
                              className="btn secondary"
                              type="button"
                              onClick={() =>
                                handleDownloadDocument(
                                  selectedAudit.auditId,
                                  doc.id,
                                  doc.fileName
                                )
                              }
                            >
                              Download
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="form-box">
                  <h4>Add / Update Auditor Remark</h4>
                  <textarea
                    rows="5"
                    value={remark}
                    onChange={(e) => setRemark(e.target.value)}
                    placeholder="Write your audit remark here..."
                  />
                  <button
                    className="btn primary"
                    onClick={handleSaveRemark}
                    disabled={savingRemark}
                  >
                    {savingRemark ? "Saving..." : "Save Remark"}
                  </button>
                </div>

                <div className="form-box">
                  <h4>Update Audit Status</h4>

                  <select value={status} onChange={(e) => setStatus(e.target.value)}>
                    <option value="">Select Status</option>
                    <option value="Assigned">Assigned</option>
                    <option value="In_Progress">In_Progress</option>
                    <option value="Correction Required">Correction Required</option>
                    <option value="Resubmitted">Resubmitted</option>
                    <option value="Final Audit">Final Audit</option>
                    <option value="Completed">Completed</option>
                    <option value="Rejected">Rejected</option>
                  </select>

                  <textarea
                    rows="4"
                    value={statusMessage}
                    onChange={(e) => setStatusMessage(e.target.value)}
                    placeholder="Write status update message..."
                  />

                  <div className="button-row">
                    <button
                      className="btn primary"
                      onClick={() => handleUpdateStatus()}
                      disabled={savingStatus}
                    >
                      {savingStatus ? "Updating..." : "Update Status"}
                    </button>

                    <button
                      className="btn warning"
                      onClick={() => handleUpdateStatus("Correction Required")}
                      disabled={savingStatus}
                    >
                      Request Correction
                    </button>

                    <button
                      className="btn dark"
                      onClick={() => handleUpdateStatus("Final Audit")}
                      disabled={savingStatus}
                    >
                      Mark Final Audit
                    </button>

                    <button
                      className="btn success"
                      onClick={() => handleUpdateStatus("Completed")}
                      disabled={savingStatus}
                    >
                      Mark Completed
                    </button>
                  </div>
                </div>

                <div className="form-box">
                  <h4>Notify Admin</h4>
                  <textarea
                    rows="4"
                    value={statusMessage}
                    onChange={(e) => setStatusMessage(e.target.value)}
                    placeholder="Write a message to admin..."
                  />
                  <button
                    className="btn primary"
                    onClick={handleNotifyAdmin}
                    disabled={savingStatus}
                  >
                    Notify Admin
                  </button>
                </div>

                <div className="form-box">
                  <h4>Audit History / Timeline</h4>

                  {updates.length === 0 ? (
                    <p className="muted">No history found.</p>
                  ) : (
                    <div className="history-list">
                      {updates.map((item) => (
                        <div key={item.id} className="history-item">
                          <div className="history-top">
                            <strong>{item.role}</strong>
                            <span>{item.createdAt}</span>
                          </div>
                          <p><b>Updated By:</b> {item.updatedBy}</p>
                          <p><b>Status:</b> {item.statusAfterUpdate || "-"}</p>
                          <p><b>Message:</b> {item.message || "-"}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}