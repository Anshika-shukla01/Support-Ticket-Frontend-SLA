import { useState } from "react";
import "./App.css";
import Login from "./components/Login";
import Register from "./components/Register";
import TicketList from "./components/TicketList";
import CreateTicket from "./components/CreateTicket";
import TicketDetails from "./components/TicketDetails";
import { setAuthToken } from "./api/graphql";
import UserManagement from "./components/UserManagement";

type User = {
  id: string;
  name: string;
  email: string;
  role: "USER" | "AGENT" | "ADMIN";
};

function App() {
  const [user, setUser] = useState<User | null>(() => {
    const raw = localStorage.getItem("user");
    const token = localStorage.getItem("token");

    if (!raw || !token) {
      localStorage.removeItem("user");
      localStorage.removeItem("token");
      return null;
    }
    try {
      return JSON.parse(raw) as User;
    } catch {
      localStorage.removeItem("user");
      localStorage.removeItem("token");
      return null;
    }
  });
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [showCreate, setShowCreate] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showUsers, setShowUsers] = useState(false);

  function handleAuth(nextUser: User) {
    setUser(nextUser);
  }

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setAuthToken(null);
    setUser(null);
    setSelectedTicket(null);
    setShowCreate(false);
  }

  if (!user) {
    return (
      <main className="auth-shell">
        <section className="auth-hero">
          <div className="brand-mark">ST</div>
          <p className="eyebrow">Support operations</p>
          <h1>Resolve faster.<br /><span>Stay ahead of SLA.</span></h1>
          <p className="hero-copy">
            A focused workspace for support teams to create, track and resolve customer tickets.
          </p>
          <div className="hero-points">
            <span>✓ Business-hour SLA tracking</span>
            <span>✓ Clear ticket lifecycle</span>
            <span>✓ Role-based access</span>
          </div>
        </section>

        <section className="auth-panel">
          <div className="auth-card">
            <div className="auth-tabs">
              <button className={authMode === "login" ? "tab active" : "tab"} onClick={() => setAuthMode("login")}>Sign in</button>
              <button className={authMode === "register" ? "tab active" : "tab"} onClick={() => setAuthMode("register")}>Create account</button>
            </div>
            {authMode === "login" ? <Login onLogin={handleAuth} /> : <Register onRegister={handleAuth} />}
          </div>
        </section>
      </main>
    );
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark small">ST</div>
          <div><strong>Support Desk</strong><span>SLA Tracker</span></div>
        </div>
        <div className="topbar-user">
          <div className="avatar">{user.name.slice(0, 1).toUpperCase()}</div>
          <div className="user-copy"><strong>{user.name}</strong><span>{user.role}</span></div>
          <button className="ghost-button" onClick={logout}>Sign out</button>
        </div>
      </header>

      <main className="dashboard">
        {!selectedTicket ? (
          <>
            <section className="page-heading">
              <div>
                <p className="eyebrow">Workspace</p>
                <h1>Tickets</h1>
                <p>Monitor your queue and keep every response within SLA.</p>
              </div>
              <div className="heading-actions">
                {user.role === "USER" && (
                  <button
                    className="primary-button"
                    onClick={() => setShowCreate(true)}
                  >
                    ＋ New ticket
                  </button>
                )}

                {user.role === "ADMIN" && (
                  <button
                    className="primary-button"
                    onClick={() => setShowUsers(true)}
                  >
                    Manage Users
                  </button>
                )}
              </div>
            </section>

            {showCreate && (
              <div className="modal-backdrop" role="presentation">
                <div className="modal-card">
                  <button className="modal-close" onClick={() => setShowCreate(false)} aria-label="Close">×</button>
                  <CreateTicket onCreated={() => { setShowCreate(false); setRefreshKey((v) => v + 1); }} />
                </div>
              </div>
            )}

            {showUsers && (
              <div className="modal-backdrop" role="presentation">
                <div className="modal-card">
                  <button
                    className="modal-close"
                    onClick={() => setShowUsers(false)}
                    aria-label="Close"
                  >
                    ×
                  </button>

                  <UserManagement />
                </div>
              </div>
            )}

            <TicketList key={refreshKey} onSelectTicket={setSelectedTicket} />
          </>
        ) : (
          <TicketDetails ticketId={selectedTicket} onBack={() => { setSelectedTicket(null); setRefreshKey((v) => v + 1); }} />
        )}
      </main>
    </div>
  );
}

export default App;
