import React, { useState } from "react";

// mode: "view" | "create" | "edit"
export default function RecordModal({ mode, fields, record, onClose, onSave }) {
  const initial = {};
  fields.forEach((f) => {
    initial[f.name] = record ? record[f.name] ?? "" : "";
  });
  const [values, setValues] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const readOnly = mode === "view";

  function handleChange(name, value) {
    setValues((v) => ({ ...v, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await onSave(values);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const title = mode === "create" ? "New Record" : mode === "edit" ? "Edit Record" : "View Record";

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {fields.map((f) => (
              <div className="form-row" key={f.name}>
                <label>
                  {f.label}
                  {f.required && !readOnly ? " *" : ""}
                </label>
                {f.type === "textarea" ? (
                  <textarea
                    value={values[f.name] || ""}
                    disabled={readOnly}
                    required={f.required}
                    onChange={(e) => handleChange(f.name, e.target.value)}
                  />
                ) : (
                  <input
                    type={inputType(f.type)}
                    value={values[f.name] || ""}
                    disabled={readOnly}
                    required={f.required}
                    onChange={(e) => handleChange(f.name, e.target.value)}
                  />
                )}
              </div>
            ))}
          </div>
          {error && <div className="error-text">{error}</div>}
          <div className="modal-footer">
            <button type="button" className="btn secondary" onClick={onClose}>
              {readOnly ? "Close" : "Cancel"}
            </button>
            {!readOnly && (
              <button type="submit" className="btn primary" disabled={saving}>
                {saving ? "Saving..." : "Save"}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

function inputType(sfType) {
  switch (sfType) {
    case "email":
      return "email";
    case "url":
      return "url";
    case "date":
      return "date";
    case "int":
    case "currency":
      return "number";
    default:
      return "text";
  }
}
