import { useEffect, useState } from "react";
import { gql } from "graphql-request";
import { graphqlClient } from "../api/graphql";

type UserRole = "USER" | "AGENT" | "ADMIN";

type User = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt?: string;
};

type UsersResponse = {
  users: User[];
};

type UpdateUserRoleResponse = {
  updateUserRole: User;
};

const GET_USERS = gql`
  query GetUsers {
    users {
      id
      name
      email
      role
      createdAt
    }
  }
`;

const UPDATE_USER_ROLE = gql`
  mutation UpdateUserRole(
    $userId: ID!
    $role: UserRole!
  ) {
    updateUserRole(
      userId: $userId
      role: $role
    ) {
      id
      name
      email
      role
      createdAt
    }
  }
`;

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  async function fetchUsers() {
    setLoading(true);
    setError("");

    try {
      const data =
        await graphqlClient.request<UsersResponse>(
          GET_USERS
        );

      setUsers(data.users);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load users."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchUsers();
  }, []);

  async function changeRole(
    userId: string,
    role: UserRole
  ) {
    setUpdatingUserId(userId);
    setError("");

    try {
      const data =
        await graphqlClient.request<UpdateUserRoleResponse>(
          UPDATE_USER_ROLE,
          {
            userId,
            role,
          }
        );

      setUsers((currentUsers) =>
        currentUsers.map((user) =>
          user.id === userId
            ? data.updateUserRole
            : user
        )
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to update user role."
      );
    } finally {
      setUpdatingUserId(null);
    }
  }

  if (loading) {
    return (
      <section className="form">
        <div className="form-heading">
          <p className="eyebrow">Administration</p>
          <h2>User management</h2>
          <p>Loading users...</p>
        </div>
      </section>
    );
  }

  return (
    <section className="form">
      <div className="form-heading">
        <p className="eyebrow">Administration</p>
        <h2>User management</h2>
        <p>
          View users and change their support role.
        </p>
      </div>

      {error && (
        <div className="alert error">
          {error}
        </div>
      )}

      {users.length === 0 ? (
        <div className="alert">
          No users found.
        </div>
      ) : (
        <div className="user-list">
          {users.map((user) => (
            <div
              key={user.id}
              className="user-row"
            >
              <div className="user-info">
                <strong>{user.name}</strong>
                <span>{user.email}</span>
              </div>

              <div className="user-role">
                <select
                  value={user.role}
                  disabled={
                    updatingUserId === user.id
                  }
                  onChange={(e) =>
                    changeRole(
                      user.id,
                      e.target.value as UserRole
                    )
                  }
                  aria-label={`Change role for ${user.name}`}
                >
                  <option value="USER">
                    User
                  </option>

                  <option value="AGENT">
                    Agent
                  </option>

                  <option value="ADMIN">
                    Admin
                  </option>
                </select>

                {updatingUserId === user.id && (
                  <span>Saving...</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}