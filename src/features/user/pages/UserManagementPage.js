import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "./UserManagementPage.css";

const API = "http://localhost:8080/api/users";

export default function UserManagementPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const [users, setUsers] = useState([]);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(false);

  /* ================= FETCH USERS ================= */
  const fetchUsers = async () => {
    try {
      setLoading(true);

      const res = await fetch(`${API}/users`);

      if (!res.ok) {
        throw new Error("Failed to fetch users");
      }

      const data = await res.json();
      setUsers(data);
    } catch (e) {
      console.error("Fetch error:", e);
      alert("Failed to fetch users. Is backend running?");
    } finally {
      setLoading(false);
    }
  };

  /* First load */
  useEffect(() => {
    fetchUsers();
  }, []);

  /* ✅ Auto refresh when coming back from AddEmployee */
  useEffect(() => {
    if (location.state?.refresh) {
      fetchUsers();

      // ✅ Clear navigation state to avoid refreshing again on next visit
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, navigate, location.pathname]);

  /* ================= SEARCH FILTER ================= */
  const filtered = useMemo(() => {
    const q = query.toLowerCase();

    return users.filter((u) =>
      `${u.id} ${u.firstName} ${u.lastName} ${u.email} ${u.roleName}`
        .toLowerCase()
        .includes(q)
    );
  }, [users, query]);

  /* ================= DELETE USER ================= */
  const deleteUser = async (id) => {
    if (!window.confirm("Delete this user?")) return;

    try {
      const res = await fetch(`${API}/users/${id}`, {
        method: "DELETE",
      });

      const msg = await res.text();

      if (!res.ok) {
        alert(msg || "Delete failed");
        return;
      }

      // Remove user from UI instantly
      setUsers((prev) => prev.filter((u) => u.id !== id));

      alert("Deleted ✅");
    } catch (e) {
      console.error("Delete error:", e);
      alert("Server not reachable");
    }
  };

  /* ================= UPDATE USER ================= */
  const saveEdit = async () => {
  try {
    const payload = {
      firstName: editing.firstName,
      lastName: editing.lastName,
      email: editing.email,
      password: editing.password || "",
      confirmPassword: editing.confirmPassword || "",
      roleid: Number(editing.roleid),
    };

    const url = `${API}/update/${editing.id}`;

    console.log("PUT URL:", url);
    console.log("Payload:", payload);

    const res = await fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const text = await res.text();

    console.log("Status:", res.status);
    console.log("Response:", text);

    if (!res.ok) {
      throw new Error(text || `HTTP ${res.status}`);
    }

    alert(text || "Employee updated successfully");
    setEditing(null);
    fetchUsers();
  } catch (err) {
    console.error("Update error:", err);
    alert(err.message);
  }
};

  /* ================= UI ================= */
  return (
    <section className="um-section">
      {/* Header */}
      <div className="um-head">
        <h3>User Management</h3>

        {/* ✅ Right Side Controls */}
        <div className="um-head-actions">
          <input
            className="um-search"
            placeholder="Search user..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />

          {/* ✅ Add Employee Button */}
          <button
            className="um-btn add"
            onClick={() => navigate("/admin/add-employee")}
            type="button"
          >
            ➕ Add Employee
          </button>

          {/* ✅ Refresh */}
          <button className="um-btn refresh" onClick={fetchUsers} type="button">
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Loading */}
      {loading ? (
        <p className="um-empty">Loading...</p>
      ) : (
        <div className="um-table-wrap">
          <table className="um-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>First Name</th>
                <th>Last Name</th>
                <th>Email</th>
                <th>Role ID</th>
                <th>Role Name</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan="7" className="um-empty">
                    No users found
                  </td>
                </tr>
              ) : (
                filtered.map((u) => (
                  <tr key={u.id}>
                    <td>{u.id}</td>
                    <td>{u.firstName}</td>
                    <td>{u.lastName}</td>
                    <td>{u.email}</td>
                    <td>{u.roleid ?? "-"}</td>
                    <td>{u.roleName ?? "Not Assigned"}</td>

                    <td>
                      <div className="um-actions">
                        <button
                          className="um-btn edit"
                          onClick={() => setEditing({ ...u })}
                          type="button"
                        >
                          Edit
                        </button>

                        <button
                          className="um-btn delete"
                          onClick={() => deleteUser(u.id)}
                          type="button"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ================= EDIT MODAL ================= */}
      {editing && (
        <div className="um-modal-bg">
          <div className="um-modal">
            <h3>Edit User</h3>

            <input
              value={editing.firstName || ""}
              onChange={(e) =>
                setEditing({ ...editing, firstName: e.target.value })
              }
              placeholder="First Name"
            />

            <input
              value={editing.lastName || ""}
              onChange={(e) =>
                setEditing({ ...editing, lastName: e.target.value })
              }
              placeholder="Last Name"
            />

            <input
              value={editing.email || ""}
              onChange={(e) => setEditing({ ...editing, email: e.target.value })}
              placeholder="Email"
            />

            {/* Role Dropdown */}
            <select
              value={editing.roleid ?? ""}
              onChange={(e) =>
                setEditing({
                  ...editing,
                  roleid: e.target.value ? Number(e.target.value) : null,
                })
              }
            >
              <option value="">Select role</option>
              <option value="1">Admin</option>
              <option value="2">User</option>
              <option value="3">Coordinator</option>
              <option value="4">Auditor</option>
            </select>

            {/* Modal Actions */}
            <div className="um-modal-actions">
              <button
                className="um-btn delete"
                onClick={() => setEditing(null)}
                type="button"
              >
                Cancel
              </button>

              <button className="um-btn edit" onClick={saveEdit} type="button">
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
