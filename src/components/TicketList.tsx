import { useEffect, useMemo, useState } from "react";
import { gql } from "graphql-request";
import { graphqlClient } from "../api/graphql";

type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
type Status = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
type SLAState = "ON_TRACK" | "AT_RISK" | "BREACHED";

type Ticket = {
  id: string;
  title: string;
  priority: Priority;
  status: Status;
  firstResponseAt: string | null;
  resolvedAt: string | null;
  firstResponseDueAt: string;
  resolutionDueAt: string;
  sla: {
    firstResponseState: SLAState;
    resolutionState: SLAState;
    firstResponseRemainingMinutes: number;
    resolutionRemainingMinutes: number;
  };
};

type Props = { onSelectTicket: (id: string) => void };

type Response = {
  tickets: {
    items: Ticket[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
};

const QUERY = gql`
  query Tickets($filter: TicketFilter, $page: Int, $pageSize: Int) {
    tickets(filter: $filter, page: $page, pageSize: $pageSize) {
      items {
        id
        title
        priority
        status
        firstResponseAt
        resolvedAt
        firstResponseDueAt
        resolutionDueAt
        sla {
          firstResponseState
          resolutionState
          firstResponseRemainingMinutes
          resolutionRemainingMinutes
        }
      }
      total
      page
      pageSize
      totalPages
    }
  }
`;

function date(value: string) {
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

function label(value: string) {
  return value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function activeSla(ticket: Ticket) {
  return ticket.firstResponseAt
    ? {
        state: ticket.sla.resolutionState,
        remaining: ticket.sla.resolutionRemainingMinutes,
        dueAt: ticket.resolutionDueAt,
      }
    : {
        state: ticket.sla.firstResponseState,
        remaining: ticket.sla.firstResponseRemainingMinutes,
        dueAt: ticket.firstResponseDueAt,
      };
}

function remainingText(minutes: number, state: SLAState) {
  if (state === "BREACHED") return "Breached";
  if (minutes <= 0) return "Due now";
  if (minutes < 60) return `${minutes}m remaining`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins ? `${hours}h ${mins}m remaining` : `${hours}h remaining`;
}

export default function TicketList({ onSelectTicket }: Props) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState<Status | "ALL">("ALL");
  const [priority, setPriority] = useState<Priority | "ALL">("ALL");
  const [sla, setSla] = useState<SLAState | "ALL">("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const filter = useMemo(() => ({
    ...(status !== "ALL" ? { status } : {}),
    ...(priority !== "ALL" ? { priority } : {}),
  }), [status, priority]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    graphqlClient
      .request<Response>(QUERY, { filter, page, pageSize: 8 })
      .then((data) => {
        if (!active) return;
        setTickets(data.tickets.items);
        setTotal(data.tickets.total);
        setTotalPages(data.tickets.totalPages);
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : "Failed to load tickets.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [filter, page]);

  const visibleTickets = useMemo(
    () => tickets.filter((ticket) => sla === "ALL" || activeSla(ticket).state === sla),
    [tickets, sla],
  );

  const dashboard = useMemo(() => ({
    open: tickets.filter((ticket) => ticket.status === "OPEN").length,
    inProgress: tickets.filter((ticket) => ticket.status === "IN_PROGRESS").length,
    atRisk: tickets.filter((ticket) => {
      const state = activeSla(ticket).state;
      return state === "AT_RISK";
    }).length,
    breached: tickets.filter((ticket) => activeSla(ticket).state === "BREACHED").length,
  }), [tickets]);

  return (
    <section className="ticket-section">
      <div className="stats-row">
        <div className="stat"><span>Open</span><strong>{dashboard.open}</strong></div>
        <div className="stat"><span>In progress</span><strong>{dashboard.inProgress}</strong></div>
        <div className="stat"><span>At risk / breached</span><strong>{dashboard.atRisk + dashboard.breached}</strong></div>
      </div>

      <div className="filter-bar">
        <div className="filter-title">
          <strong>Ticket queue</strong>
          <span>{total} ticket{total === 1 ? "" : "s"} · filter by status, priority or SLA</span>
        </div>

        <select value={status} onChange={(e) => {
          setStatus(e.target.value as Status | "ALL");
          setPage(1);
        }}>
          <option value="ALL">All statuses</option>
          {(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"] as Status[]).map((v) => (
            <option key={v} value={v}>{label(v)}</option>
          ))}
        </select>

        <select value={priority} onChange={(e) => {
          setPriority(e.target.value as Priority | "ALL");
          setPage(1);
        }}>
          <option value="ALL">All priorities</option>
          {(["LOW", "MEDIUM", "HIGH", "URGENT"] as Priority[]).map((v) => (
            <option key={v} value={v}>{label(v)}</option>
          ))}
        </select>

        <select value={sla} onChange={(e) => setSla(e.target.value as SLAState | "ALL")}>
          <option value="ALL">All SLA states</option>
          {(["ON_TRACK", "AT_RISK", "BREACHED"] as SLAState[]).map((v) => (
            <option key={v} value={v}>{label(v)}</option>
          ))}
        </select>

        {(status !== "ALL" || priority !== "ALL" || sla !== "ALL") && (
          <button className="text-button" onClick={() => {
            setStatus("ALL");
            setPriority("ALL");
            setSla("ALL");
            setPage(1);
          }}>
            Clear
          </button>
        )}
      </div>

      {loading ? (
        <div className="empty-state">Loading tickets…</div>
      ) : error ? (
        <div className="alert error">{error}</div>
      ) : visibleTickets.length === 0 ? (
        <div className="empty-state">
          <strong>No tickets match these filters.</strong>
          <span>Try clearing one or more filters.</span>
        </div>
      ) : (
        <div className="ticket-table">
          <div className="table-head">
            <span>Ticket</span><span>Priority</span><span>Status</span><span>SLA</span><span>Remaining</span>
          </div>

          {visibleTickets.map((ticket) => {
            const current = activeSla(ticket);
            return (
              <button className="ticket-row" key={ticket.id} onClick={() => onSelectTicket(ticket.id)}>
                <div>
                  <strong>{ticket.title}</strong>
                  <small>#{ticket.id.slice(0, 8)}</small>
                </div>
                <span className={`pill priority-${ticket.priority.toLowerCase()}`}>{label(ticket.priority)}</span>
                <span className={`pill status-${ticket.status.toLowerCase()}`}>{label(ticket.status)}</span>
                <span className={`pill sla-${current.state.toLowerCase()}`}>{label(current.state)}</span>
                <span className="deadline">
                  <strong>{remainingText(current.remaining, current.state)}</strong>
                  <small>Due {date(current.dueAt)}</small>
                </span>
              </button>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="pagination">
          <button className="secondary-button" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
            ← Previous
          </button>
          <span>Page {page} of {totalPages}</span>
          <button className="secondary-button" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>
            Next →
          </button>
        </div>
      )}
    </section>
  );
}
