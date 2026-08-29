import { useEffect, useState } from "react";
import { gql } from "graphql-request";
import { graphqlClient } from "../api/graphql";

type Props = { ticketId: string; onBack: () => void };
type Role = "USER" | "AGENT" | "ADMIN";
type TicketStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
type SLAState = "ON_TRACK" | "AT_RISK" | "BREACHED";

const NEXT_STATUSES: Record<TicketStatus, TicketStatus[]> = {
  OPEN: ["IN_PROGRESS"],
  IN_PROGRESS: ["RESOLVED"],
  RESOLVED: ["CLOSED"],
  CLOSED: [],
};

type Agent = { id: string; name: string; email: string; role: Role };
type Ticket = {
  id: string;
  title: string;
  description: string;
  priority: string;
  status: TicketStatus;
  firstResponseAt: string | null;
  firstResponseDueAt: string;
  resolvedAt: string | null;
  resolutionDueAt: string;
  createdAt: string;
  creator: { name: string; email: string };
  agent: { name: string; email: string; role: Role } | null;
  sla: {
    firstResponseState: SLAState;
    resolutionState: SLAState;
    firstResponseRemainingMinutes: number;
    resolutionRemainingMinutes: number;
  };
  comments: {
    id: string;
    content: string;
    createdAt: string;
    author: { name: string; email: string; role: Role };
  }[];
};

type TicketResponse = { ticket: Ticket | null };



const QUERY = gql`
  query Ticket($id: ID!) {
    ticket(id: $id) {
      id title description priority status
      firstResponseAt firstResponseDueAt
      resolvedAt resolutionDueAt createdAt
      creator { name email }
      agent { name email role }
      sla {
        firstResponseState
        resolutionState
        firstResponseRemainingMinutes
        resolutionRemainingMinutes
      }
      comments {
        id content createdAt
        author { name email role }
      }
    }
  }
`;

const AGENTS_QUERY = gql`
  query Agents {
    agents { id name email role }
  }
`;

const ASSIGN_MUTATION = gql`
  mutation AssignTicket($ticketId: ID!, $agentId: ID!) {
    assignTicket(ticketId: $ticketId, agentId: $agentId) {
      id status agent { id name email role }
    }
  }
`;

const STATUS_MUTATION = gql`
  mutation ChangeTicketStatus($ticketId: ID!, $status: TicketStatus!) {
    changeTicketStatus(ticketId: $ticketId, status: $status) {
      id
      status
      firstResponseAt
      resolvedAt
      sla {
        firstResponseState
        resolutionState
        firstResponseRemainingMinutes
        resolutionRemainingMinutes
      }
    }
  }
`;

const COMMENT_MUTATION = gql`
  mutation AddComment($ticketId: ID!, $content: String!) {
    addComment(ticketId: $ticketId, content: $content) {
      id
      content
      createdAt
      author {
        name
        email
        role
      }
    }
  }
`;

function date(value: string | null) {
  if (!value) return "Not yet";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

function label(value: string) {
  return value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function remainingText(minutes: number, state: SLAState) {
  if (state === "BREACHED") return "Breached";
  if (minutes <= 0) return "Due now";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins ? `${hours}h ${mins}m remaining` : `${hours}h remaining`;
}

export default function TicketDetails({ ticketId, onBack }: Props) {
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [commenting, setCommenting] = useState(false);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [assigning, setAssigning] = useState(false);

  const currentUser = (() => {
    try {
      return JSON.parse(localStorage.getItem("user") ?? "null") as { role?: Role } | null;
    } catch {
      return null;
    }
  })();

  const canManageStatus = currentUser?.role === "AGENT" || currentUser?.role === "ADMIN";
  const canAssign = currentUser?.role === "AGENT" || currentUser?.role === "ADMIN";

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await graphqlClient.request<TicketResponse>(QUERY, { id: ticketId });
      setTicket(data.ticket);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load ticket.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [ticketId]);

  useEffect(() => {
    if (!canAssign) return;
    graphqlClient
      .request<{ agents: Agent[] }>(AGENTS_QUERY)
      .then((data) => setAgents(data.agents))
      .catch(() => setAgents([]));
  }, [canAssign]);

  async function assignAgent(agentId: string) {
  if (!agentId) return;

  setAssigning(true);
  setError("");

  try {
    await graphqlClient.request(ASSIGN_MUTATION, {
      ticketId,
      agentId,
    });

    await load();
  } catch (err) {
    setError(
      err instanceof Error
        ? err.message
        : "Could not assign ticket."
    );
  } finally {
    setAssigning(false);
  }
}

  async function updateStatus(status: TicketStatus) {
    if (!ticket || status === ticket.status) return;
    setSaving(true);
    setError("");
    try {
      await graphqlClient.request(STATUS_MUTATION, { ticketId, status });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update status.");
    } finally {
      setSaving(false);
    }
  }

  async function addComment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!comment.trim()) return;

    setCommenting(true);
    setError("");
    try {
      await graphqlClient.request(COMMENT_MUTATION, { ticketId, content: comment.trim() });
      setComment("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add comment.");
    } finally {
      setCommenting(false);
    }
  }

  if (loading) {
    return (
      <div className="detail-page">
        <button className="back-button" onClick={onBack}>← Tickets</button>
        <div className="empty-state">Loading ticket…</div>
      </div>
    );
  }

  if (error && !ticket) {
    return (
      <div className="detail-page">
        <button className="back-button" onClick={onBack}>← Tickets</button>
        <div className="alert error">{error}</div>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="detail-page">
        <button className="back-button" onClick={onBack}>← Tickets</button>
        <div className="empty-state">Ticket not found.</div>
      </div>
    );
  }

  const responseState = ticket.sla.firstResponseState;
  const responseRemaining = ticket.sla.firstResponseRemainingMinutes;
  const responseDone = ticket.firstResponseAt !== null;
  const resolutionState = ticket.sla.resolutionState;
  const resolutionRemaining = ticket.sla.resolutionRemainingMinutes;

  return (
    <section className="detail-page">
      <button className="back-button" onClick={onBack}>← Back to tickets</button>
      {error && <div className="alert error">{error}</div>}

      <div className="detail-layout">
        <div className="detail-main">
          <div className="detail-card">
            <div className="detail-top">
              <div>
                <span className="ticket-number">Ticket #{ticket.id.slice(0, 8)}</span>
                <h1>{ticket.title}</h1>
              </div>
              <span className={`pill status-${ticket.status.toLowerCase()}`}>{label(ticket.status)}</span>
            </div>

            <div className="description">
              <h3>Description</h3>
              <p>{ticket.description}</p>
            </div>

            <div className="timeline">
              <div><span>Created</span><strong>{date(ticket.createdAt)}</strong></div>
              <div><span>First response</span><strong>{date(ticket.firstResponseAt)}</strong></div>
              <div><span>Resolved</span><strong>{date(ticket.resolvedAt)}</strong></div>
            </div>
          </div>

          <div className="detail-card comments-card">
            <div className="section-title">
              <div><h2>Conversation</h2><span>{ticket.comments.length} messages</span></div>
            </div>

            {ticket.comments.length === 0 ? (
              <div className="empty-state compact">No comments yet.</div>
            ) : (
              <div className="comments">
                {ticket.comments.map((item) => (
                  <article className="comment" key={item.id}>
                    <div className="avatar">{item.author.name.slice(0, 1).toUpperCase()}</div>
                    <div>
                      <div className="comment-meta">
                        <strong>{item.author.name}</strong>
                        <span className="role-label">{item.author.role}</span>
                        <time>{date(item.createdAt)}</time>
                      </div>
                      <p>{item.content}</p>
                    </div>
                  </article>
                ))}
              </div>
            )}

            <form className="comment-form" onSubmit={addComment}>
              <textarea value={comment} onChange={(e) => setComment(e.target.value)}
                rows={3} placeholder="Write a reply or update…" />
              <button className="primary-button" disabled={commenting || !comment.trim()}>
                {commenting ? "Sending…" : "Add comment"}
              </button>
            </form>
          </div>
        </div>

        <aside className="detail-side">
          <div className="detail-card">
            <h3>SLA overview</h3>

            <div className={`sla-banner sla-${(responseDone ? resolutionState : responseState).toLowerCase()}`}>
              <strong>{label(responseDone ? resolutionState : responseState)}</strong>
              <span>{responseDone ? "Resolution SLA" : "First-response SLA"}</span>
            </div>

            <dl>
              <div><dt>Priority</dt><dd>{label(ticket.priority)}</dd></div>
              <div>
                <dt>First response</dt>
                <dd>
                  {responseDone ? "Completed" : remainingText(responseRemaining, responseState)}
                  <small>Due {date(ticket.firstResponseDueAt)}</small>
                </dd>
              </div>
              <div>
                <dt>Resolution</dt>
                <dd>
                  {ticket.resolvedAt ? "Completed" : remainingText(resolutionRemaining, resolutionState)}
                  <small>Due {date(ticket.resolutionDueAt)}</small>
                </dd>
              </div>
            </dl>
          </div>

          <div className="detail-card">
            <h3>Ticket ownership</h3>
            <dl>
              <div>
                <dt>Requester</dt>
                <dd>{ticket.creator.name}<small>{ticket.creator.email}</small></dd>
              </div>
              <div>
                <dt>Assigned agent</dt>
                <dd>
                  {ticket.agent
                    ? <>{ticket.agent.name}<small>{ticket.agent.email}</small></>
                    : <span className="muted">Unassigned</span>}
                </dd>
              </div>
            </dl>
          </div>

          {canAssign && (
            <div className="detail-card">
              <h3>Assign agent</h3>
              <label>
                Support agent
                <select
                  value={ticket.agent?.email ?? ""}
                  disabled={assigning}
                  onChange={(e) => {
                    const agent = agents.find((item) => item.email === e.target.value);
                    if (agent) void assignAgent(agent.id);
                  }}
                >
                  <option value="">Select an agent</option>
                  {agents.map((agent) => (
                    <option key={agent.id} value={agent.email}>
                      {agent.name} · {agent.email}
                    </option>
                  ))}
                </select>
              </label>
              <p className="helper">
                Assignment permissions and lifecycle transitions
                are enforced by the backend.
              </p>
            </div>
          )}

          {canManageStatus && (
            <div className="detail-card">
              <h3>Manage lifecycle</h3>

              {NEXT_STATUSES[ticket.status].length === 0 ? (
                <p className="helper">
                  This ticket has reached the end of its lifecycle.
                </p>
              ) : (
                <label>
                  Next status

                  <select
                    value=""
                    disabled={saving}
                    onChange={(e) => {
                      const nextStatus =
                        e.target.value as TicketStatus;

                      if (nextStatus) {
                        void updateStatus(nextStatus);
                      }
                    }}
                  >
                    <option value="">
                      Select next status
                    </option>

                    {NEXT_STATUSES[ticket.status].map((status) => (
                      <option
                        key={status}
                        value={status}
                      >
                        {label(status)}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <p className="helper">
                Tickets can only move through the allowed lifecycle
                transitions.
              </p>
            </div>
          )}

        </aside>
      </div>
    </section>
  );
}
