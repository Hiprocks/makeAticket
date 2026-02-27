import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'node:fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import Anthropic from '@anthropic-ai/sdk';

// ESM에서 __dirname 사용을 위한 설정
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// server/.env 파일 명시적 로드
dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();
const port = Number(process.env.API_PORT || 5174);
const allowedOrigin = process.env.APP_ORIGIN || 'http://localhost:5173';

app.use(cors({ origin: allowedOrigin, credentials: true }));
app.use(express.json({ limit: '5mb' }));

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

app.get('/api/confluence/page/:pageId', async (req, res) => {
  try {
    const { pageId } = req.params;
    if (!pageId) {
      return res.status(400).json({ error: 'pageId is required' });
    }

    // Confluence 자격증명 (없으면 Jira 자격증명 fallback)
    const confluenceUrl = process.env.CONFLUENCE_URL || (process.env.JIRA_URL ? process.env.JIRA_URL + '/wiki' : null);
    const email = process.env.CONFLUENCE_EMAIL || process.env.JIRA_EMAIL;
    const apiToken = process.env.CONFLUENCE_API_TOKEN || process.env.JIRA_API_TOKEN;

    if (!confluenceUrl) {
      return res.status(500).json({
        error: 'Confluence URL not configured. Set CONFLUENCE_URL or JIRA_URL in .env file.'
      });
    }
    if (!email) {
      return res.status(500).json({
        error: 'Confluence email not configured. Set CONFLUENCE_EMAIL or JIRA_EMAIL in .env file.'
      });
    }
    if (!apiToken) {
      return res.status(500).json({
        error: 'Confluence API token not configured. Set CONFLUENCE_API_TOKEN or JIRA_API_TOKEN in .env file.'
      });
    }

    const pageData = await getConfluencePage({ confluenceUrl, email, apiToken, pageId });
    res.json(pageData);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

app.get('/api/confluence/test', async (req, res) => {
  try {
    // Confluence 자격증명 (없으면 Jira 자격증명 fallback)
    const confluenceUrl = process.env.CONFLUENCE_URL || (process.env.JIRA_URL ? process.env.JIRA_URL + '/wiki' : null);
    const email = process.env.CONFLUENCE_EMAIL || process.env.JIRA_EMAIL;
    const apiToken = process.env.CONFLUENCE_API_TOKEN || process.env.JIRA_API_TOKEN;

    if (!confluenceUrl || !email || !apiToken) {
      return res.status(500).json({
        error: 'Confluence credentials not configured. Check .env file.',
        details: {
          confluenceUrl: !!confluenceUrl,
          email: !!email,
          apiToken: !!apiToken,
        }
      });
    }

    const baseUrl = confluenceUrl.replace(/\/+$/, '');

    // Test if we can access Confluence at all
    const testUrl = `${baseUrl}/rest/api/space`;
    const testRes = await fetch(testUrl, {
      headers: {
        'Authorization': `Basic ${encodeBasic(email, apiToken)}`,
        'Accept': 'application/json',
      },
    });

    res.json({
      ok: testRes.ok,
      status: testRes.status,
      url: testUrl,
      email: email,
      body: testRes.ok ? await testRes.json() : await testRes.text(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

// ============================================================================
// DoD Automation Endpoints
// ============================================================================

/**
 * FR-5: Epic 조회 + JQL 기반 하위 Task 전체 조회
 * GET /api/jira/epic/:epicKey
 */
app.get('/api/jira/epic/:epicKey', async (req, res) => {
  try {
    const { epicKey } = req.params;
    if (!epicKey) {
      return res.status(400).json({ error: 'epicKey is required' });
    }

    const jiraUrl = requiredEnv('JIRA_URL');
    const email = requiredEnv('JIRA_EMAIL');
    const apiToken = requiredEnv('JIRA_API_TOKEN');
    const baseUrl = jiraUrl.replace(/\/+$/, '');

    // 1. Epic 기본 정보 조회
    const epicResponse = await fetch(
      `${baseUrl}/rest/api/3/issue/${encodeURIComponent(epicKey)}?fields=summary,issuetype`,
      {
        headers: {
          'Authorization': `Basic ${encodeBasic(email, apiToken)}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!epicResponse.ok) {
      const text = await epicResponse.text();
      return res.status(epicResponse.status).json({
        error: `Epic 조회 실패: ${text}`
      });
    }

    const epicData = await epicResponse.json();

    // Epic 유형 확인
    const isEpic = epicData.fields?.issuetype?.name === 'Epic';
    if (!isEpic) {
      return res.status(400).json({
        error: `${epicKey}는 Epic 유형이 아닙니다. 실제 유형: ${epicData.fields?.issuetype?.name}`
      });
    }

    // 2. JQL로 Epic 하위 Task 전체 조회
    const jql = `parent=${encodeURIComponent(epicKey)}`;
    const searchUrl = `${baseUrl}/rest/api/3/search?jql=${jql}&fields=summary,issuetype,status`;

    const searchResponse = await fetch(searchUrl, {
      headers: {
        'Authorization': `Basic ${encodeBasic(email, apiToken)}`,
        'Content-Type': 'application/json'
      }
    });

    if (!searchResponse.ok) {
      const text = await searchResponse.text();
      return res.status(searchResponse.status).json({
        error: `하위 Task 조회 실패: ${text}`
      });
    }

    const searchData = await searchResponse.json();

    // 3. 응답 반환
    res.json({
      key: epicData.key,
      summary: epicData.fields.summary,
      childTasks: searchData.issues.map(issue => ({
        key: issue.key,
        summary: issue.fields.summary,
        type: issue.fields.issuetype?.name,
        status: issue.fields.status?.name
      }))
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

/**
 * FR-7: DoD Task 일괄 생성 (성공/실패 분리)
 * POST /api/jira/dod/tasks/create
 */
app.post('/api/jira/dod/tasks/create', async (req, res) => {
  try {
    const { tasks } = req.body || {};
    if (!Array.isArray(tasks) || tasks.length === 0) {
      return res.status(400).json({ error: 'tasks array is required' });
    }

    const jiraUrl = requiredEnv('JIRA_URL');
    const email = requiredEnv('JIRA_EMAIL');
    const apiToken = requiredEnv('JIRA_API_TOKEN');
    const projectKey = process.env.JIRA_PROJECT_KEY;

    const results = [];

    // 순차 생성 (Rate Limit 방지)
    for (const task of tasks) {
      try {
        console.log('\n=== Task 생성 시작 ===');
        console.log('Prefix:', task.prefix);
        console.log('Title:', task.title);
        console.log('Description (원본):', task.description.substring(0, 200) + '...');

        const adfDescription = toAdf(task.description);
        console.log('Description (ADF 변환 후):', JSON.stringify(adfDescription, null, 2).substring(0, 500) + '...');

        const fields = {
          project: { key: projectKey },
          issuetype: { name: 'Task' },
          summary: task.title,
          description: adfDescription
        };

        // Epic이 있을 때만 parent 추가
        if (task.parentKey) {
          fields.parent = { key: task.parentKey };
          console.log('Parent Key:', task.parentKey);
        }

        console.log('Fields 전송:', JSON.stringify(fields, null, 2).substring(0, 500) + '...');

        const key = await createIssue({ jiraUrl, email, apiToken, fields });
        console.log('✅ 생성 성공:', key);

        results.push({
          prefix: task.prefix,
          title: task.title,
          success: true,
          key: key,
          url: `${jiraUrl}/browse/${key}`,
          error: null
        });

        // Rate Limit 방지 (2초 대기)
        await new Promise(resolve => setTimeout(resolve, 2000));

      } catch (error) {
        console.error('❌ Task 생성 실패:', error);
        console.error('Error stack:', error.stack);
        results.push({
          prefix: task.prefix,
          title: task.title,
          success: false,
          key: null,
          url: null,
          error: error.message
        });
      }
    }

    // 성공/실패 카운트
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    res.json({
      results,
      summary: {
        total: results.length,
        success: successCount,
        failed: failCount
      }
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

/**
 * FR-8: Blocker 링크 일괄 생성
 * POST /api/jira/blocker/create
 */
app.post('/api/jira/blocker/create', async (req, res) => {
  try {
    const { links } = req.body || {};
    if (!Array.isArray(links) || links.length === 0) {
      return res.status(400).json({ error: 'links array is required' });
    }

    const jiraUrl = requiredEnv('JIRA_URL');
    const email = requiredEnv('JIRA_EMAIL');
    const apiToken = requiredEnv('JIRA_API_TOKEN');
    const baseUrl = jiraUrl.replace(/\/+$/, '');

    const results = [];

    for (const link of links) {
      try {
        const response = await fetch(
          `${baseUrl}/rest/api/3/issueLink`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Basic ${encodeBasic(email, apiToken)}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              type: { name: 'Blocks' },
              inwardIssue: { key: link.inwardKey },
              outwardIssue: { key: link.outwardKey }
            })
          }
        );

        results.push({
          success: response.ok,
          inwardKey: link.inwardKey,
          outwardKey: link.outwardKey,
          error: response.ok ? null : await response.text()
        });

      } catch (error) {
        results.push({
          success: false,
          inwardKey: link.inwardKey,
          outwardKey: link.outwardKey,
          error: error.message
        });
      }
    }

    res.json({ results });

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

// ============================================================================
// Storage Endpoint
// ============================================================================

app.post('/api/storage/snapshot', async (req, res) => {
  try {
    const { projectKey, kind, payload } = req.body || {};
    const safeProjectKey = sanitizeName(projectKey || 'default') || 'default';
    const safeKind = sanitizeName(kind || 'snapshot') || 'snapshot';

    const storageRoot = getStorageRoot();
    await fs.mkdir(storageRoot, { recursive: true });

    const projectDir = path.join(storageRoot, safeProjectKey);
    await fs.mkdir(projectDir, { recursive: true });

    const fileName = `${formatTimestamp(new Date())}_${safeKind}.json`;
    const filePath = path.join(projectDir, fileName);

    const data = {
      savedAt: new Date().toISOString(),
      projectKey: projectKey || 'default',
      kind: kind || 'snapshot',
      payload: payload ?? null,
    };

    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
    res.json({ ok: true, path: filePath });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

// ============================================================================
// AI 기반 DoD 분석 (Claude API)
// ============================================================================
app.post('/api/confluence/analyze-dod', async (req, res) => {
  try {
    const { title, content } = req.body;
    if (!title || !content) {
      return res.status(400).json({ error: 'title and content are required' });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey || apiKey === 'your-api-key-here') {
      console.warn('⚠️ ANTHROPIC_API_KEY not configured, falling back to keyword detection');
      return res.status(503).json({
        error: 'AI analysis not configured',
        fallback: true
      });
    }

    const anthropic = new Anthropic({ apiKey });

    const systemPrompt = `당신은 게임 개발 프로젝트의 DoD(Definition of Done) 자동 생성 전문가입니다.

[임무]
Confluence 기획서를 분석하여 협업 파트와 각 파트의 작업 항목(DoD)을 추출하세요.

[분석 기준]
1. 협업 파트 판단:
   - 인게임 기획: 게임플레이 설계, 밸런스, 기능 명세
   - 아웃게임 기획: 메뉴, 시스템, 로비 설계
   - UI 파트: UI/HUD 제작, 메뉴, 팝업, 스트링
   - 인게임 개발: 플레이 로직 구현, 인게임 기능 (클라이언트)
   - 아웃게임 개발: 아웃게임 시스템 구현 (클라이언트)
   - 서버 파트: Dedicated Server 로직, DB, 프로토콜
   - 아트-2D: 캐릭터/배경 원화, 컨셉 아트
   - 아트-3D: 3D 모델링, 리깅
   - 애니메이션 파트: 캐릭터/오브젝트 애니메이션
   - VFX 파트: 이펙트, 파티클 제작 (실제 리소스 제작이 필요한 경우만)
   - 사운드 파트: 효과음, BGM 제작 (실제 사운드 리소스 제작이 필요한 경우만)

2. 작업 항목 추출 규칙:
   - 각 파트당 3-5개 작업 항목
   - 구체적이고 실행 가능한 단위
   - 언더스코어(_) 절대 금지
   - 기능 단위로만 서술 (변수명/계산식 노출 금지)
   - "N개", "N종" 형식 사용 권장

3. 주의사항 (매우 중요):
   - "사운드 볼륨 조절", "UI 메뉴" 같은 단순 기능 설명 ≠ 실제 작업
   - 실제 리소스 제작/구현이 명확히 필요한 경우만 파트 추가
   - 맥락을 고려: "옵션 메뉴"만 있고 실제 리소스 제작 언급 없으면 제외
   - 의심스러우면 파트 제외 (false positive 방지)

[출력 형식]
JSON 형식으로만 반환하세요. 다른 텍스트는 절대 포함하지 마세요.
{
  "parts": [
    {
      "partName": "인게임 기획",
      "prefix": "[기획]",
      "tasks": [
        {
          "title": "작업 제목",
          "description": "상세 설명 (기능 단위, N개/N종 표기)",
          "resource": "리소스 (예: 기획팀 1명)",
          "dependency": "의존성 (예: - 또는 파트명)"
        }
      ]
    }
  ]
}`;

    const userPrompt = `다음 Confluence 기획서를 분석하여 DoD를 생성하세요.

[기획서 제목]
${title}

[기획서 내용]
${content.substring(0, 15000)} ${content.length > 15000 ? '...(내용 생략)' : ''}

[출력 요청]
위 기획서를 분석하여 협업 파트와 각 파트의 DoD 작업 항목을 JSON 형식으로만 출력하세요.`;

    console.log('🤖 [AI DoD Analysis] Starting Claude API call...');
    console.log(`   Title: ${title}`);
    console.log(`   Content length: ${content.length} chars`);

    const message = await anthropic.messages.create({
      model: process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022',
      max_tokens: 4096,
      temperature: 0.3,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
    });

    const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
    console.log('✅ [AI DoD Analysis] Claude response received');

    // JSON 파싱
    let parsedResult;
    try {
      // Markdown 코드 블록 제거 (```json ... ```)
      const cleanedText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsedResult = JSON.parse(cleanedText);
    } catch (parseError) {
      console.error('❌ [AI DoD Analysis] JSON parse error:', parseError);
      console.error('   Raw response:', responseText.substring(0, 500));
      return res.status(500).json({ error: 'Failed to parse AI response', fallback: true });
    }

    console.log(`✅ [AI DoD Analysis] Parsed ${parsedResult.parts?.length || 0} parts`);
    parsedResult.parts?.forEach((part) => {
      console.log(`   - ${part.partName}: ${part.tasks?.length || 0} tasks`);
    });

    res.json(parsedResult);
  } catch (err) {
    console.error('❌ [AI DoD Analysis] Error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message, fallback: true });
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

  console.log('[toAdf] 입력 텍스트 길이:', String(text).length);

  const lines = String(text).replace(/\r\n/g, '\n').split('\n');
  const content = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // 마크다운 표 감지 (|로 시작하는 라인)
    if (line.trim().startsWith('|')) {
      console.log('[toAdf] 마크다운 표 감지, 라인:', i);
      const tableLines = [];

      // 연속된 표 라인 수집
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        tableLines.push(lines[i]);
        i++;
      }

      console.log('[toAdf] 표 라인 수:', tableLines.length);

      // 표를 ADF table 노드로 변환
      if (tableLines.length >= 2) {
        const tableNode = convertMarkdownTableToAdf(tableLines);
        if (tableNode) {
          console.log('[toAdf] ADF table 변환 성공');
          content.push(tableNode);
          continue;
        } else {
          console.log('[toAdf] ADF table 변환 실패, code block으로 fallback');
        }
      }

      // 변환 실패 시 code block으로 fallback
      content.push({
        type: 'codeBlock',
        attrs: { language: null },
        content: [{ type: 'text', text: tableLines.join('\n') }]
      });
      continue;
    }

    // 일반 텍스트 라인
    if (!line.trim()) {
      content.push({ type: 'paragraph', content: [] });
    } else {
      content.push({ type: 'paragraph', content: [{ type: 'text', text: line }] });
    }
    i++;
  }

  console.log('[toAdf] 생성된 content 노드 수:', content.length);
  return { type: 'doc', version: 1, content };
}

/**
 * 마크다운 표를 ADF table로 변환
 */
function convertMarkdownTableToAdf(lines) {
  try {
    // 헤더와 구분선 제거
    const headerLine = lines[0];
    const separatorLine = lines[1];
    const dataLines = lines.slice(2);

    // 헤더 파싱
    const headers = headerLine.split('|').slice(1, -1).map(h => h.trim());

    // 구분선 확인 (최소한 하나의 '-'가 있어야 함)
    if (!separatorLine.includes('-')) {
      return null;
    }

    // 테이블 행 생성
    const rows = [];

    // 헤더 행
    rows.push({
      type: 'tableRow',
      content: headers.map(header => ({
        type: 'tableHeader',
        attrs: {},
        content: [{ type: 'paragraph', content: [{ type: 'text', text: header }] }]
      }))
    });

    // 데이터 행들
    for (const dataLine of dataLines) {
      if (!dataLine.trim()) continue;

      const cells = dataLine.split('|').slice(1, -1).map(c => c.trim());

      rows.push({
        type: 'tableRow',
        content: cells.map(cell => ({
          type: 'tableCell',
          attrs: {},
          content: [{ type: 'paragraph', content: [{ type: 'text', text: cell }] }]
        }))
      });
    }

    return {
      type: 'table',
      attrs: { isNumberColumnEnabled: false, layout: 'default' },
      content: rows
    };
  } catch (error) {
    console.error('Table conversion error:', error);
    return null;
  }
}

function getStorageRoot() {
  return process.env.STORAGE_DIR || path.resolve(process.cwd(), 'storage');
}

function sanitizeName(value) {
  return String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function formatTimestamp(date) {
  const pad = (n, size = 2) => String(n).padStart(size, '0');
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join('') + '_' + [
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
    pad(date.getMilliseconds(), 3),
  ].join('');
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

async function getConfluencePage({ confluenceUrl, email, apiToken, pageId }) {
  const baseUrl = confluenceUrl.replace(/\/+$/, '');

  // Confluence REST API v1 (more widely supported)
  const url = new URL(`${baseUrl}/rest/api/content/${encodeURIComponent(pageId)}`);
  url.searchParams.set('expand', 'body.storage,version,space');

  const res = await fetch(url, {
    headers: {
      'Authorization': `Basic ${encodeBasic(email, apiToken)}`,
      'Accept': 'application/json',
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Confluence fetch failed (${res.status}): ${text}`);
  }

  const data = await res.json();

  return {
    id: data.id,
    title: data.title,
    type: data.type,
    status: data.status,
    body: data.body?.storage?.value || '',
    space: {
      id: data.space?.id,
      key: data.space?.key,
      name: data.space?.name,
    },
    version: {
      number: data.version?.number,
      when: data.version?.when,
      by: data.version?.by?.displayName,
    },
    _links: data._links,
  };
}

function cleanFields(fields) {
  return Object.fromEntries(
    Object.entries(fields).filter(([, value]) => value !== undefined && value !== '')
  );
}

function encodeBasic(email, token) {
  return Buffer.from(`${email}:${token}`).toString('base64');
}
