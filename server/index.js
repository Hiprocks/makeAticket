import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = Number(process.env.API_PORT || 5174);
const allowedOrigin = process.env.APP_ORIGIN || 'http://localhost:5173';

app.use(cors({ origin: allowedOrigin, credentials: true }));
app.use(express.json({ limit: '1mb' }));

const metaCache = new Map();
const META_TTL_MS = 10 * 60 * 1000;

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/api/jira/issue', async (req, res) => {
  try {
    const { type, summary, description, assignee, parentKey, projectKey } = req.body || {};
    if (!type || !summary) {
      return res.status(400).json({ error: 'type and summary are required' });
    }

    const jiraUrl = requiredEnv('JIRA_URL');
    const email = requiredEnv('JIRA_EMAIL');
    const apiToken = requiredEnv('JIRA_API_TOKEN');
    const finalProjectKey = projectKey || process.env.JIRA_PROJECT_KEY;
    if (!finalProjectKey) {
      return res.status(400).json({ error: 'projectKey is required' });
    }

    const meta = await getCreateMeta({ jiraUrl, email, apiToken, projectKey: finalProjectKey, issueType: type });

    const fields = {
      project: { key: finalProjectKey },
      issuetype: { name: type },
      summary: summary,
      description: toAdf(description),
      assignee: assignee ? { accountId: assignee } : undefined,
    };

    if (type === 'Epic' && meta.epicNameFieldId) {
      fields[meta.epicNameFieldId] = summary;
    }

    if (type === 'Task' && parentKey) {
      if (meta.epicLinkFieldId) {
        fields[meta.epicLinkFieldId] = parentKey;
      } else {
        // Team-managed projects often use "parent" instead of Epic Link.
        fields.parent = { key: parentKey };
      }
    }

    const key = await createIssue({ jiraUrl, email, apiToken, fields });
    res.json({ key });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

app.post('/api/jira/issue/update', async (req, res) => {
  try {
    const { key, summary, description } = req.body || {};
    if (!key) {
      return res.status(400).json({ error: 'key is required' });
    }
    if (summary === undefined && description === undefined) {
      return res.status(400).json({ error: 'summary or description is required' });
    }

    const jiraUrl = requiredEnv('JIRA_URL');
    const email = requiredEnv('JIRA_EMAIL');
    const apiToken = requiredEnv('JIRA_API_TOKEN');

    const fields = {};
    if (summary !== undefined) fields.summary = summary;
    if (description !== undefined) fields.description = description ? toAdf(description) : null;

    await updateIssue({ jiraUrl, email, apiToken, key, fields });
    res.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

app.listen(port, () => {
  console.log(`Jira proxy listening on http://localhost:${port}`);
});

function requiredEnv(name) {
  const val = process.env[name];
  if (!val) throw new Error(`${name} is not set`);
  return val;
}

async function createIssue({ jiraUrl, email, apiToken, fields }) {
  const baseUrl = jiraUrl.replace(/\/+$/, '');
  const res = await fetch(`${baseUrl}/rest/api/3/issue`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${encodeBasic(email, apiToken)}`,
    },
    body: JSON.stringify({ fields: cleanFields(fields) }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Jira create failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  if (!data?.key) throw new Error('Jira response missing issue key');
  return data.key;
}

async function getCreateMeta({ jiraUrl, email, apiToken, projectKey, issueType }) {
  const cacheKey = `${projectKey}:${issueType}`;
  const cached = metaCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < META_TTL_MS) {
    return cached.value;
  }

  const baseUrl = jiraUrl.replace(/\/+$/, '');
  const url = new URL(`${baseUrl}/rest/api/3/issue/createmeta`);
  url.searchParams.set('projectKeys', projectKey);
  url.searchParams.set('issuetypeNames', issueType);
  url.searchParams.set('expand', 'projects.issuetypes.fields');

  const res = await fetch(url, {
    headers: {
      Authorization: `Basic ${encodeBasic(email, apiToken)}`,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Jira createmeta failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  const fields = data?.projects?.[0]?.issuetypes?.[0]?.fields || {};
  const meta = {
    epicNameFieldId: findEpicNameFieldId(fields),
    epicLinkFieldId: findEpicLinkFieldId(fields),
  };

  metaCache.set(cacheKey, { ts: Date.now(), value: meta });
  return meta;
}

function findEpicLinkFieldId(fields) {
  for (const [fieldId, field] of Object.entries(fields)) {
    const name = String(field?.name || '').toLowerCase();
    const custom = String(field?.schema?.custom || '').toLowerCase();
    if (custom.includes('epic-link') || custom.includes('gh-epic-link')) return fieldId;
    if (name === 'epic link' || name.includes('epic link')) return fieldId;
  }
  return null;
}

function findEpicNameFieldId(fields) {
  for (const [fieldId, field] of Object.entries(fields)) {
    const name = String(field?.name || '').toLowerCase();
    const custom = String(field?.schema?.custom || '').toLowerCase();
    if (custom.includes('epic-label') || custom.includes('gh-epic-label')) return fieldId;
    if (name === 'epic name' || name.includes('epic name')) return fieldId;
  }
  return null;
}

function toAdf(text) {
  if (!text || !String(text).trim()) return undefined;
  const lines = String(text).replace(/\r\n/g, '\n').split('\n');
  const content = lines.map((line) => {
    if (!line.trim()) {
      return { type: 'paragraph', content: [] };
    }
    return { type: 'paragraph', content: [{ type: 'text', text: line }] };
  });
  return { type: 'doc', version: 1, content };
}

async function updateIssue({ jiraUrl, email, apiToken, key, fields }) {
  const baseUrl = jiraUrl.replace(/\/+$/, '');
  const res = await fetch(`${baseUrl}/rest/api/3/issue/${encodeURIComponent(key)}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${encodeBasic(email, apiToken)}`,
    },
    body: JSON.stringify({ fields }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Jira update failed (${res.status}): ${text}`);
  }
}

function cleanFields(fields) {
  return Object.fromEntries(
    Object.entries(fields).filter(([, value]) => value !== undefined && value !== '')
  );
}

function encodeBasic(email, token) {
  return Buffer.from(`${email}:${token}`).toString('base64');
}
