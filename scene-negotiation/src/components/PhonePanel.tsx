// In-game phone: open it, pick a contact, and place a REAL call. Twilio dials
// the number and bridges them to the AI agent (Rico) on Pipecat Cloud.
//
// Calls go through the local phone backend (voice-game-framework/phone-backend).

import { useEffect, useState } from "react";

const BACKEND =
  (import.meta.env.VITE_PHONE_BACKEND_URL as string | undefined) ?? "http://localhost:8090";

interface Contact {
  name: string;
  number: string; // E.164, e.g. +18313468532
}

const SEED_CONTACTS: Contact[] = [
  { name: "Soham Kayal", number: "+18313468532" },
  { name: "Utkarsh Gupta", number: "+18315297248" },
];

const STORAGE_KEY = "game_phone_contacts";

function loadContacts(): Contact[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Contact[];
  } catch {
    /* ignore */
  }
  return SEED_CONTACTS;
}

export function PhonePanel() {
  const [open, setOpen] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>(loadContacts);
  const [status, setStatus] = useState<string>("");
  const [calling, setCalling] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newNumber, setNewNumber] = useState("");

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(contacts));
  }, [contacts]);

  async function call(contact: Contact) {
    setCalling(contact.number);
    setStatus(`Calling ${contact.name}…`);
    try {
      const res = await fetch(`${BACKEND}/call`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: contact.number, name: contact.name }),
      });
      const data = await res.json();
      if (data.ok) {
        setStatus(`📞 Ringing ${contact.name}… they'll talk to Rico. (${data.call_sid?.slice(0, 10)}…)`);
      } else {
        setStatus(`Call failed: ${JSON.stringify(data.error ?? data)}`);
      }
    } catch (e) {
      setStatus(`Backend unreachable (${BACKEND}). Is call_server.py running?`);
    } finally {
      setCalling(null);
    }
  }

  function addContact() {
    const name = newName.trim();
    let number = newNumber.trim().replace(/[\s()-]/g, "");
    if (!number.startsWith("+")) number = "+1" + number.replace(/^1/, "");
    if (!name || number.length < 8) {
      setStatus("Enter a name and a valid number.");
      return;
    }
    setContacts((c) => [...c, { name, number }]);
    setNewName("");
    setNewNumber("");
    setStatus(`Added ${name}.`);
  }

  return (
    <>
      {/* Floating phone button */}
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          position: "fixed",
          right: 20,
          bottom: 20,
          width: 56,
          height: 56,
          borderRadius: "50%",
          border: "none",
          background: open ? "#b33" : "#1f9d55",
          color: "white",
          fontSize: 26,
          cursor: "pointer",
          boxShadow: "0 4px 14px rgba(0,0,0,0.5)",
          zIndex: 50,
        }}
        title="Phone"
      >
        {open ? "✕" : "📱"}
      </button>

      {open && (
        <div
          style={{
            position: "fixed",
            right: 20,
            bottom: 88,
            width: 300,
            background: "rgba(18,18,22,0.97)",
            color: "#eee",
            borderRadius: 14,
            padding: 16,
            boxShadow: "0 8px 30px rgba(0,0,0,0.6)",
            fontFamily: "system-ui, sans-serif",
            zIndex: 50,
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 10, fontSize: 16 }}>Phone</div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {contacts.map((c) => (
              <div
                key={c.number}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  background: "rgba(255,255,255,0.05)",
                  borderRadius: 8,
                  padding: "8px 10px",
                }}
              >
                <div>
                  <div style={{ fontWeight: 600 }}>{c.name}</div>
                  <div style={{ fontSize: 12, opacity: 0.6 }}>{c.number}</div>
                </div>
                <button
                  onClick={() => call(c)}
                  disabled={calling === c.number}
                  style={{
                    background: "#1f9d55",
                    border: "none",
                    color: "white",
                    borderRadius: 6,
                    padding: "6px 12px",
                    cursor: "pointer",
                  }}
                >
                  {calling === c.number ? "…" : "Call"}
                </button>
              </div>
            ))}
          </div>

          {/* Add contact */}
          <div style={{ marginTop: 12, borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: 10 }}>
            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>Add contact</div>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Name"
              style={inputStyle}
            />
            <input
              value={newNumber}
              onChange={(e) => setNewNumber(e.target.value)}
              placeholder="+1 831 555 1234"
              style={inputStyle}
            />
            <button
              onClick={addContact}
              style={{
                width: "100%",
                background: "#3355bb",
                border: "none",
                color: "white",
                borderRadius: 6,
                padding: "8px",
                cursor: "pointer",
                marginTop: 4,
              }}
            >
              Add
            </button>
          </div>

          {status && (
            <div style={{ marginTop: 10, fontSize: 12, opacity: 0.85, lineHeight: 1.4 }}>{status}</div>
          )}
        </div>
      )}
    </>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  background: "rgba(255,255,255,0.08)",
  border: "1px solid rgba(255,255,255,0.15)",
  borderRadius: 6,
  color: "white",
  padding: "7px 9px",
  marginBottom: 6,
  fontSize: 13,
};
