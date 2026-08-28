import { useState } from "react";
import { gql } from "graphql-request";
import { graphqlClient, setAuthToken } from "../api/graphql";

type User = { id: string; name: string; email: string; role: "USER" | "AGENT" | "ADMIN" };
type Props = { onLogin: (user: User) => void };
type Response = { login: { token: string; user: User } };

const LOGIN = gql`mutation Login($email: String!, $password: String!) { login(email: $email, password: $password) { token user { id name email role } } }`;

export default function Login({ onLogin }: Props) {
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [error, setError] = useState(""); const [loading, setLoading] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError(""); setLoading(true);
    try { const data = await graphqlClient.request<Response>(LOGIN, { email: email.trim(), password }); localStorage.setItem("token", data.login.token); localStorage.setItem("user", JSON.stringify(data.login.user)); setAuthToken(data.login.token); onLogin(data.login.user); }
    catch (err) { setError(err instanceof Error ? err.message : "Unable to sign in."); }
    finally { setLoading(false); }
  }
  return <form className="form" onSubmit={submit}>
    <div className="form-heading"><p className="eyebrow">Welcome back</p><h2>Sign in</h2><p>Access your support workspace.</p></div>
    {error && <div className="alert error">{error}</div>}
    <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" required /></label>
    <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" autoComplete="current-password" required /></label>
    <button className="primary-button full" type="submit" disabled={loading}>{loading ? "Signing in…" : "Sign in"}</button>
  </form>;
}
