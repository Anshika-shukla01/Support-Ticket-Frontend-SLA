# Support Ticket & SLA Tracker — Frontend

React + TypeScript frontend for the Support Ticket & SLA Tracker take-home assignment.

## Features

- JWT authentication with login/register
- Responsive ticket dashboard
- Ticket creation with priority selection
- Server-backed filtering by status, priority and SLA state
- Pagination
- Ticket detail view with SLA information and timestamps
- Comments / first-response workflow
- Agent/Admin ticket status management
- Clear loading, empty and error states
- Responsive layout for desktop and mobile

## Run locally

```bash
npm install
npm run dev
```

The frontend expects GraphQL at `http://localhost:4000/graphql` by default. Override it with:

```bash
VITE_API_URL=http://localhost:4000/graphql
```

For a local Windows PowerShell session:

```powershell
$env:VITE_API_URL="http://localhost:4000/graphql"
npm run dev
```

## Validation

```bash
npm run lint
npm run build
```

The source was checked with TypeScript and ESLint. If the supplied `node_modules` archive has a platform-specific Vite/Rolldown native-binding issue, delete `node_modules` and `package-lock.json`, run `npm install`, and then run the build again.
