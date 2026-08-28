import { GraphQLClient } from "graphql-request";

export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000/graphql";
export const graphqlClient = new GraphQLClient(API_URL);

export function setAuthToken(token: string | null) {
  if (token) {
    graphqlClient.setHeader("Authorization", `Bearer ${token}`);
  } else {
    graphqlClient.setHeaders({});
  }
}

const savedToken = localStorage.getItem("token");
if (savedToken) setAuthToken(savedToken);
