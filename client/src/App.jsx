import React, { useEffect, useRef, useState, useCallback } from "react";
import { api } from "./api";
import RecordModal from "./components/RecordModal.jsx";

const PAGE_SIZE = 20;

export default function App() {
  const [loggedIn, setLoggedIn] = useState(null); // null = checking
  const [objects, setObjects] = useState([]);
  const [selectedObject, setSelectedObject] = useState("");
  const [fields, setFields] = useState([]);
  const [records, setRecords] = useState([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(null); // { mode, record }
  const [banner, setBanner] = useState(null);
  const scrollRef = useRef(null);

  // ---- initial auth check ----
  useEffect(() => {
    api
      .authStatus()
      .then((s) => setLoggedIn(s.loggedIn))
      .catch(() => setLoggedIn(false));
  }, []);

  // ---- load object list once logged in ----
  useEffect(() => {
    if (loggedIn) {
      api
        .getObjects()
        .then((objs) => {
          setObjects(objs);
          if (objs.length) selectObject(objs[0].name, objs);
        })
        .catch((e) => setBanner(e.message));
    }
  }, [loggedIn]);

  function selectObject(name, objList = objects) {
    const cfg = objList.find((o) => o.name === name);
    setSelectedObject(name);
    setFields(cfg ? cfg.fields : []);
    setRecords([]);
    setOffset(0);
    setHasMore(true);
  }

  const loadMore = useCallback(async () => {
    if (!selectedObject || loading || !hasMore) return;
    setLoading(true);
    try {
      const data = await api.getRecords(selectedObject, offset, PAGE_SIZE);
      setRecords((prev) => [...prev, ...data.records]);
      setOffset((prev) => prev + data.records.length);
      setHasMore(data.hasMore);
    } catch (e) {
      if (e.unauthenticated) setLoggedIn(false);
      else setBanner(e.message);
    } finally {
      setLoading(false);
    }
  }, [selectedObject, offset, loading, hasMore]);

  // load first page whenever a fresh object is selected
  useEffect(() => {
    if (selectedObject && records.length === 0 && offset === 0 && hasMore) {
      loadMore();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedObject]);

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollHeight - el.scrollTop <= el.clientHeight + 80) {
      loadMore();
    }
  }

  function refreshList() {
    setRecords([]);
    setOffset(0);
    setHasMore(true);
  }
  useEffect(() => {
    if (records.length === 0 && offset === 0 && selectedObject) {
      // triggered by refreshList after create/update/delete
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [records]);

  async function handleSave(values) {
    const cleanValues = {};
    fields.forEach((f) => {
      if (values[f.name] !== "" && values[f.name] !== undefined) {
        cleanValues[f.name] = f.type === "int" || f.type === "currency" ? Number(values[f.name]) : values[f.name];
      }
    });

    if (modal.mode === "create") {
      await api.createRecord(selectedObject, cleanValues);
    } else if (modal.mode === "edit") {
      await api.updateRecord(selectedObject, modal.record.Id, cleanValues);
    }
    setModal(null);
    refreshList();
    loadMore();
  }

  async function handleDelete(record) {
    if (!window.confirm(`Delete this ${selectedObject} record? This cannot be undone.`)) return;
    try {
      await api.deleteRecord(selectedObject, record.Id);
      setRecords((prev) => prev.filter((r) => r.Id !== record.Id));
    } catch (e) {
      setBanner(e.message);
    }
  }

  async function openView(record) {
    try {
      const full = await api.getRecord(selectedObject, record.Id);
      setModal({ mode: "view", record: full });
    } catch (e) {
      setBanner(e.message);
    }
  }

  if (loggedIn === null) {
    return <div className="center-screen">Loading...</div>;
  }

  if (!loggedIn) {
    return (
      <div className="center-screen">
        <div className="login-card">
          <h1>Salesforce CRUD Console</h1>
          <p>Log in with your Salesforce account to manage records.</p>
          <a className="btn primary" href="/auth/login">
            Log in to Salesforce
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <h1>Salesforce CRUD Console</h1>
        <div className="topbar-controls">
          <select value={selectedObject} onChange={(e) => selectObject(e.target.value)}>
            {objects.map((o) => (
              <option key={o.name} value={o.name}>
                {o.label}
              </option>
            ))}
          </select>
          <button className="btn primary" onClick={() => setModal({ mode: "create", record: null })}>
            + New {selectedObject}
          </button>
          <button
            className="btn secondary"
            onClick={async () => {
              await api.logout();
              setLoggedIn(false);
            }}
          >
            Log out
          </button>
        </div>
      </header>

      {banner && (
        <div className="banner" onClick={() => setBanner(null)}>
          {banner} (click to dismiss)
        </div>
      )}

      <div className="table-wrap" ref={scrollRef} onScroll={handleScroll}>
        <table>
          <thead>
            <tr>
              {fields.map((f) => (
                <th key={f.name}>{f.label}</th>
              ))}
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {records.map((r) => (
              <tr key={r.Id}>
                {fields.map((f) => (
                  <td key={f.name}>{String(r[f.name] ?? "")}</td>
                ))}
                <td className="actions-cell">
                  <button className="link-btn" onClick={() => openView(r)}>
                    View
                  </button>
                  <button className="link-btn" onClick={() => setModal({ mode: "edit", record: r })}>
                    Edit
                  </button>
                  <button className="link-btn danger" onClick={() => handleDelete(r)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {loading && <div className="loading-row">Loading more records...</div>}
        {!hasMore && records.length > 0 && <div className="loading-row">No more records.</div>}
        {!loading && records.length === 0 && <div className="loading-row">No records found.</div>}
      </div>

      {modal && (
        <RecordModal
          mode={modal.mode}
          fields={fields}
          record={modal.record}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
