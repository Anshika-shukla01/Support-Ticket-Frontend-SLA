import { useState } from "react";
import { gql } from "graphql-request";
import { graphqlClient } from "../api/graphql";

type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
type CreatedTicket = {
  id: string;
  title: string;
  priority: Priority;
  status: string;
  firstResponseDueAt: string;
  resolutionDueAt: string;
};
type Props = { onCreated: () => void };

const CREATE_TICKET = gql`
  mutation CreateTicket(
    $title: String!
    $description: String!
    $priority: TicketPriority!
  ) {
    createTicket(title: $title, description: $description, priority: $priority) {
      id
      title
      priority
      status
      firstResponseDueAt
      resolutionDueAt
    }
  }
`;

export default function CreateTicket({ onCreated }: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("MEDIUM");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!title.trim() || !description.trim()) {
      setError("Title and description are required.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      await graphqlClient.request<{ createTicket: CreatedTicket }>(CREATE_TICKET, {
        title: title.trim(),
        description: description.trim(),
        priority,
      });
      setTitle("");
      setDescription("");
      setPriority("MEDIUM");
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create ticket.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="form" onSubmit={submit}>
      <div className="form-heading">
        <p className="eyebrow">Customer request</p>
        <h2>Create a ticket</h2>
        <p>The SLA deadline is calculated by the backend using business hours.</p>
      </div>

      {error && <div className="alert error">{error}</div>}

      <label>
        Title
        <input value={title} onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Unable to access billing portal" maxLength={200} required />
      </label>

      <label>
        Description
        <textarea value={description} onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe the issue, impact and anything you have already tried..." rows={6} required />
      </label>

      <label>
        Priority
        <select value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
          <option value="URGENT">Urgent · 1h response / 4h resolution</option>
          <option value="HIGH">High · 4h response / 24h resolution</option>
          <option value="MEDIUM">Medium · 8h response / 48h resolution</option>
          <option value="LOW">Low · 24h response / 72h resolution</option>
        </select>
      </label>

      <button className="primary-button full" disabled={loading}>
        {loading ? "Creating…" : "Create ticket"}
      </button>
    </form>
  );
}
