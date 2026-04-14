import React, { useEffect, useState } from "react";

const API_BASE = "http://localhost:8080";

const collectAuditItems = (data) => {
  if (Array.isArray(data)) return data;

  const candidates = [
    data?.documents,
    data?.documentUploads,
    data?.uploadedDocuments,
    data?.docs,
    data?.auditDocuments,
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

export default function NotificationsSection() {
  const loginEmail =
    localStorage.getItem("loginEmail") ||
    localStorage.getItem("email") ||
    localStorage.getItem("username");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        if (!loginEmail) {
          setItems([]);
          setLoading(false);
          return;
        }

        // ✅ Example endpoint (change to your real endpoint)
        // Suggested: GET /api/audit/audit-details/user?loginEmail=...
        const res = await fetch(
          `${API_BASE}/api/audit/audit-details/user?loginEmail=${encodeURIComponent(loginEmail)}`
        );

        if (!res.ok) throw new Error("Failed to fetch notifications");

        const data = await res.json();
        setItems(collectAuditItems(data));
      } catch (e) {
        console.error(e);
        setItems([]);
      } finally {
        setLoading(false);
      }
    };

    fetchNotifications();
  }, [loginEmail]);

  if (loading) return <p>Loading notifications...</p>;

  return (
    <div style={{ padding: 16 }}>
      <h3 style={{ marginTop: 0 }}>🔔 Notifications</h3>

      {items.length === 0 ? (
        <p>No notifications yet.</p>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {items.map((n) => (
            <div
              key={n.auditId || n.id}
              style={{
                border: "1px solid rgba(255,255,255,.12)",
                borderRadius: 12,
                padding: 12,
                background: "rgba(255,255,255,.06)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <strong>{n.auditType || "Audit Request"}</strong>
                <span
                  style={{
                    padding: "4px 10px",
                    borderRadius: 999,
                    background: "rgba(124,58,237,.25)",
                    border: "1px solid rgba(124,58,237,.4)",
                    fontSize: 12,
                  }}
                >
                  {n.status || "Pending"}
                </span>
              </div>

              <div style={{ marginTop: 8, opacity: 0.85, fontSize: 14 }}>
                <div>Preferred Date: {n.preferredDate || "-"}</div>
                <div>Location: {n.auditLocation || "-"}</div>
                <div>Scope: {n.scope || "-"}</div>
                {n.adminComment ? <div>Admin Comment: {n.adminComment}</div> : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}