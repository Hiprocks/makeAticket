# makeAticket

Jira issue bulk creator (Epic/Task) with a small local proxy server.

## Quick Start
1) Install
```
npm install
```

2) Create `.env` in the project root
```
JIRA_URL=https://gamejang2.atlassian.net
JIRA_EMAIL=you@company.com
JIRA_API_TOKEN=your_api_token
JIRA_PROJECT_KEY=GAMJANG

API_PORT=5174
APP_ORIGIN=http://localhost:5173

VITE_API_BASE=http://localhost:5174
VITE_JIRA_URL=https://gamejang2.atlassian.net
```

3) Run backend + frontend
```
node server/index.js
npm run dev
```

4) Open
- Frontend: http://localhost:5173
- Backend health: http://localhost:5174/api/health

## Project Settings (Important)
In the app, open Settings and set **Project key**.
- This key is required for creating tickets.
- You can also set a default in `.env` using `JIRA_PROJECT_KEY`.

## Notes / Troubleshooting
- If you change `.env`, restart the backend.
- `JIRA_URL` must be the base Jira URL only (no `/rest` path).
- Jira Cloud uses `/rest/api/3` automatically (already supported).
