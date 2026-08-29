import { useEffect, useMemo, useState } from "react";
import { gql } from "graphql-request";
import { graphqlClient } from "../api/graphql";

type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
type Status = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
type SLAState = "ON_TRACK" | "AT_RISK" | "BREACHED";
type Role = "USER" | "AGENT" | "ADMIN";

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

type Agent = {
  id: string;
  name: string;
  email: string;
  role: Role;
};

type TicketConnection = {
  nodes: Ticket[];
  pageInfo: {
    hasNextPage: boolean;
    endCursor: string | null;
  };
  totalCount: number;
};

type Dashboard = {
  openTickets: number;
  inProgressTickets: number;
  atRiskTickets: number;
  breachedTickets: number;
};



type Response = {
  tickets: TicketConnection;
  dashboard: Dashboard;
};

type AgentsResponse = {
  agents: Agent[];
};

type Props = {
  onSelectTicket: (id: string) => void;
};

const QUERY = gql`
  query Tickets($filter: TicketFilter, $take: Int, $cursor: String) {
    tickets(
      filter: $filter
      take: $take
      cursor: $cursor
    ) {
      nodes {
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

      pageInfo {
        hasNextPage
        endCursor
      }

      totalCount
    }

    dashboard {
      openTickets
      inProgressTickets
      atRiskTickets
      breachedTickets
    }
  }
`;

const AGENTS_QUERY = gql`
  query Agents {
    agents {
      id
      name
      email
      role
    }
  }
`;

function getCurrentUser(): {
  id?: string;
  role?: Role;
} | null {
  try {
    return JSON.parse(
      localStorage.getItem("user") ?? "null"
    ) as {
      id?: string;
      role?: Role;
    } | null;
  } catch {
    return null;
  }
}

function date(value: string) {
  const d = new Date(value);

  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString([], {
        dateStyle: "medium",
        timeStyle: "short",
      });
}

function label(value: string) {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function activeSla(ticket: Ticket) {
  return ticket.firstResponseAt
    ? {
        state: ticket.sla.resolutionState,
        remaining:
          ticket.sla.resolutionRemainingMinutes,
        dueAt: ticket.resolutionDueAt,
      }
    : {
        state: ticket.sla.firstResponseState,
        remaining:
          ticket.sla.firstResponseRemainingMinutes,
        dueAt: ticket.firstResponseDueAt,
      };
}

function remainingText(
  minutes: number,
  state: SLAState
) {
  if (state === "BREACHED") {
    return "Breached";
  }

  if (minutes <= 0) {
    return "Due now";
  }

  if (minutes < 60) {
    return `${minutes}m remaining`;
  }

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  return mins
    ? `${hours}h ${mins}m remaining`
    : `${hours}h remaining`;
}

export default function TicketList({
  onSelectTicket,
}: Props) {
  const [tickets, setTickets] = useState<Ticket[]>([]);

  const [dashboard, setDashboard] =
    useState<Dashboard>({
      openTickets: 0,
      inProgressTickets: 0,
      atRiskTickets: 0,
      breachedTickets: 0,
    });

  const [page, setPage] = useState(1);

  /*
   * Cursor history allows us to support
   * previous/next navigation with cursor pagination.
   *
   * Example:
   *
   * Page 1 -> cursor undefined
   * Page 2 -> cursor from page 1
   * Page 3 -> cursor from page 2
   */
  const [cursorHistory, setCursorHistory] =
    useState<(string | null)[]>([]);

  const [hasNextPage, setHasNextPage] =
    useState(false);

  const [endCursor, setEndCursor] =
    useState<string | null>(null);

  const [total, setTotal] = useState(0);

  const [status, setStatus] =
    useState<Status | "ALL">("ALL");

  const [priority, setPriority] =
    useState<Priority | "ALL">("ALL");

  const [sla, setSla] =
    useState<SLAState | "ALL">("ALL");

  const [assigneeId, setAssigneeId] =
    useState("ALL");

  const [agents, setAgents] =
    useState<Agent[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const currentUser = useMemo(
    () => getCurrentUser(),
    []
  );

  const canFilterByAssignee =
    currentUser?.role === "AGENT" ||
    currentUser?.role === "ADMIN";

  /*
   * The cursor required to fetch the current page.
   *
   * Page 1 has no cursor.
   * Page 2 uses the endCursor returned by page 1.
   * Page 3 uses the endCursor returned by page 2.
   */
  const currentCursor =
    page > 1
      ? cursorHistory[page - 2]
      : undefined;

  /*
   * All filtering is now sent to the backend.
   *
   * IMPORTANT:
   * SLA filtering is NOT done on the client anymore.
   */
  const filter = useMemo(
    () => ({
      ...(status !== "ALL"
        ? { status }
        : {}),

      ...(priority !== "ALL"
        ? { priority }
        : {}),

      ...(sla !== "ALL"
        ? { slaState: sla }
        : {}),

      ...(assigneeId !== "ALL"
        ? { assigneeId }
        : {}),
    }),
    [
      status,
      priority,
      sla,
      assigneeId,
    ]
  );

  /*
   * Load agents for assignee filtering.
   */
  useEffect(() => {
    if (!canFilterByAssignee) {
      return;
    }

    graphqlClient
      .request<AgentsResponse>(
        AGENTS_QUERY
      )
      .then((data) => {
        setAgents(data.agents);
      })
      .catch(() => {
        setAgents([]);
      });
  }, [canFilterByAssignee]);

  /*
   * Load tickets + dashboard.
   */
  useEffect(() => {
    let active = true;

    setLoading(true);
    setError("");

    graphqlClient
      .request<Response>(
        QUERY,
        {
          filter,
          take: 8,
          cursor:
            currentCursor ?? undefined,
        }
      )
      .then((data) => {
        if (!active) {
          return;
        }

        setTickets(
          data.tickets.nodes
        );

        setTotal(
          data.tickets.totalCount
        );

        setHasNextPage(
          data.tickets.pageInfo
            .hasNextPage
        );

        setEndCursor(
          data.tickets.pageInfo
            .endCursor
        );

        /*
         * Dashboard comes directly
         * from the backend.
         */
        setDashboard(
          data.dashboard
        );
      })
      .catch((err: unknown) => {
        if (!active) {
          return;
        }

        setError(
          err instanceof Error
            ? err.message
            : "Failed to load tickets."
        );
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [
    filter,
    currentCursor,
  ]);

  function resetPagination() {
    setPage(1);
    setCursorHistory([]);
  }

  function resetFilters() {
    setStatus("ALL");
    setPriority("ALL");
    setSla("ALL");
    setAssigneeId("ALL");

    resetPagination();
  }

  function goNext() {
    if (
      !hasNextPage ||
      !endCursor
    ) {
      return;
    }

    setCursorHistory(
      (history) => [
        ...history,
        endCursor,
      ]
    );

    setPage(
      (current) => current + 1
    );
  }

  function goPrevious() {
    if (page === 1) {
      return;
    }

    setPage(
      (current) => current - 1
    );
  }

  const activeFilterCount = [
    status !== "ALL",
    priority !== "ALL",
    sla !== "ALL",
    assigneeId !== "ALL",
  ].filter(Boolean).length;

  return (
    <section className="ticket-section">

      {/* ================= DASHBOARD ================= */}

      <div className="stats-row">

        <div className="stat">
          <span>Open</span>
          <strong>
            {dashboard.openTickets}
          </strong>
        </div>

        <div className="stat">
          <span>In progress</span>
          <strong>
            {dashboard.inProgressTickets}
          </strong>
        </div>

        <div className="stat">
          <span>At risk</span>
          <strong>
            {dashboard.atRiskTickets}
          </strong>
        </div>

        <div className="stat">
          <span>Breached</span>
          <strong>
            {dashboard.breachedTickets}
          </strong>
        </div>

      </div>

      {/* ================= FILTERS ================= */}

      <div className="filter-bar">

        <div className="filter-title">
          <strong>
            Ticket queue
          </strong>

          <span>
            {total} ticket
            {total === 1
              ? ""
              : "s"} · server-side
            filters
          </span>
        </div>

        <select
          value={status}
          onChange={(e) => {
            setStatus(
              e.target.value as
                | Status
                | "ALL"
            );

            resetPagination();
          }}
          aria-label="Filter by status"
        >
          <option value="ALL">
            All statuses
          </option>

          {(
            [
              "OPEN",
              "IN_PROGRESS",
              "RESOLVED",
              "CLOSED",
            ] as Status[]
          ).map((value) => (
            <option
              key={value}
              value={value}
            >
              {label(value)}
            </option>
          ))}
        </select>

        <select
          value={priority}
          onChange={(e) => {
            setPriority(
              e.target.value as
                | Priority
                | "ALL"
            );

            resetPagination();
          }}
          aria-label="Filter by priority"
        >
          <option value="ALL">
            All priorities
          </option>

          {(
            [
              "LOW",
              "MEDIUM",
              "HIGH",
              "URGENT",
            ] as Priority[]
          ).map((value) => (
            <option
              key={value}
              value={value}
            >
              {label(value)}
            </option>
          ))}
        </select>

        <select
          value={sla}
          onChange={(e) => {
            setSla(
              e.target.value as
                | SLAState
                | "ALL"
            );

            resetPagination();
          }}
          aria-label="Filter by SLA state"
        >
          <option value="ALL">
            All SLA states
          </option>

          {(
            [
              "ON_TRACK",
              "AT_RISK",
              "BREACHED",
            ] as SLAState[]
          ).map((value) => (
            <option
              key={value}
              value={value}
            >
              {label(value)}
            </option>
          ))}
        </select>

        {canFilterByAssignee && (
          <select
            value={assigneeId}
            onChange={(e) => {
              setAssigneeId(
                e.target.value
              );

              resetPagination();
            }}
            aria-label="Filter by assignee"
          >
            <option value="ALL">
              All assignees
            </option>

            {agents.map((agent) => (
              <option
                key={agent.id}
                value={agent.id}
              >
                {agent.name}
              </option>
            ))}
          </select>
        )}

        {activeFilterCount > 0 && (
          <button
            className="text-button"
            onClick={resetFilters}
          >
            Clear
          </button>
        )}

      </div>

      {/* ================= CONTENT ================= */}

      {loading ? (
        <div className="empty-state">
          Loading tickets…
        </div>
      ) : error ? (
        <div className="alert error">
          {error}
        </div>
      ) : tickets.length === 0 ? (
        <div className="empty-state">
          <strong>
            No tickets match these
            filters.
          </strong>

          <span>
            Try clearing one or more
            filters.
          </span>
        </div>
      ) : (
        <div className="ticket-table">

          <div className="table-head">
            <span>Ticket</span>
            <span>Priority</span>
            <span>Status</span>
            <span>SLA</span>
            <span>Remaining</span>
          </div>

          {tickets.map((ticket) => {
            const current =
              activeSla(ticket);

            return (
              <button
                className="ticket-row"
                key={ticket.id}
                onClick={() =>
                  onSelectTicket(
                    ticket.id
                  )
                }
              >
                <div>
                  <strong>
                    {ticket.title}
                  </strong>

                  <small>
                    #
                    {ticket.id.slice(
                      0,
                      8
                    )}
                  </small>
                </div>

                <span
                  className={`pill priority-${ticket.priority.toLowerCase()}`}
                >
                  {label(
                    ticket.priority
                  )}
                </span>

                <span
                  className={`pill status-${ticket.status.toLowerCase()}`}
                >
                  {label(
                    ticket.status
                  )}
                </span>

                <span
                  className={`pill sla-${current.state.toLowerCase()}`}
                >
                  {label(
                    current.state
                  )}
                </span>

                <span className="deadline">
                  <strong>
                    {remainingText(
                      current.remaining,
                      current.state
                    )}
                  </strong>

                  <small>
                    Due{" "}
                    {date(
                      current.dueAt
                    )}
                  </small>
                </span>
              </button>
            );
          })}

        </div>
      )}

      {/* ================= CURSOR PAGINATION ================= */}

      {(page > 1 || hasNextPage) && (
        <div className="pagination">

          <button
            className="secondary-button"
            disabled={
              page === 1 ||
              loading
            }
            onClick={goPrevious}
          >
            ← Previous
          </button>

          <span>
            Page {page}
          </span>

          <button
            className="secondary-button"
            disabled={
              !hasNextPage ||
              loading
            }
            onClick={goNext}
          >
            Next →
          </button>

        </div>
      )}

    </section>
  );
}