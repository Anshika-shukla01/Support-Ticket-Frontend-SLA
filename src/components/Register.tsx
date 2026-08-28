import { useState } from "react";
import { gql } from "graphql-request";
import { graphqlClient, setAuthToken } from "../api/graphql";

type User = { id: string; name: string; email: string; role: "USER" | "AGENT" | "ADMIN" };
type Props = { onRegister: (user: User) => void };
type Response = { register: { token: string; user: User } };

const REGISTER = gql`
  mutation Register(
    $name: String!
    $email: String!
    $password: String!
    $role: UserRole!
  ) {
    register(
      name: $name
      email: $email
      password: $password
      role: $role
    ) {
      token
      user {
        id
        name
        email
        role
      }
    }
  }
`;

export default function Register({ onRegister }: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"USER" | "AGENT">("USER");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (password.length < 6)
      return setError("Password must be at least 6 characters.");
    setError("");
    setLoading(true);
    try {
      const data = await graphqlClient.request<Response>(REGISTER,
        {
          name: name.trim(),
          email: email.trim(),
          password,
          role
        });
      localStorage.setItem("token", data.register.token);
      localStorage.setItem("user", JSON.stringify(data.register.user));
      setAuthToken(data.register.token);
      onRegister(data.register.user);
    }
    catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create account.");
    }
    finally {
      setLoading(false);
    }
  }
  return <form className="form" onSubmit={submit}>
    <div className="form-heading">
      <p className="eyebrow">Get started</p>
      <h2>Create account</h2>
      <p>Set up your support workspace in seconds.</p>
    </div>
    {error &&
      <div className="alert error">
        {error}
      </div>}
    <label>Name
      <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" autoComplete="name" required />
    </label>
    <label>Email
      <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" required />
    </label>
    <label>Password
      <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" minLength={6} autoComplete="new-password" required />
    </label>
    <label>
  Role

  <select
    value={role}
    onChange={(e) =>
      setRole(e.target.value as "USER" | "AGENT")
    }
    required
  >
    <option value="USER">User</option>
    <option value="AGENT">Agent</option>
  </select>
</label>
    <button className="primary-button full" type="submit" disabled={loading}>{loading ? "Creating…" : "Create account"}</button>
  </form>;
}
