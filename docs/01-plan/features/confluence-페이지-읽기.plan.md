# [Plan] Confluence 페이지 읽기 기능

> **Feature**: Confluence Page Reader
> **PDCA Phase**: Plan
> **Created**: 2026-02-25
> **Status**: In Planning
> **Type**: Frontend Enhancement (Backend API 이미 구현됨)

---

## 1. 개요 (Overview)

### 1.1 배경 및 비전

**전체 비전**: Confluence-Jira 동기화 기반 프로젝트 관리 시스템

```
[Phase 1: Foundation] ← 현재 Plan
Confluence 페이지 읽기
    ↓
[Phase 2: Core Sync] ← 다음 Plan
Confluence ↔ Jira 동기화
    ↓
[Phase 3: Advanced] ← 미래
DoD 추출, Sprint Report, Milestone 계획
```

**현재 문제점**:
- Jira만으로는 정책, Feature List, DoD 등을 관리하기 어려움
- Confluence에 정리된 정보를 수동으로 Jira에 복사해야 함
- Sprint report, DoD 체크, 계획 수립이 수동 작업

**Phase 1 목표**:
- Confluence 페이지를 읽어올 수 있는 Foundation 구축
- 이후 Phase 2 (동기화), Phase 3 (고급 기능)의 기반 마련

---

## 2. 목표 (Goals)

### 2.1 Primary Goal
- **Confluence URL/페이지 ID 입력 → 페이지 정보 표시**
- Backend API 활용하여 Frontend UI 완성

### 2.2 Secondary Goals
- 페이지 제목, 본문(HTML), 버전, Space 정보 표시
- 연결 테스트 기능 (설정 검증)
- 에러 처리 (잘못된 페이지 ID, 인증 실패 등)

### 2.3 Non-Goals (이번 구현에서 제외)
- ❌ Confluence-Jira 동기화 (Phase 2)
- ❌ DoD 추출 (Phase 3)
- ❌ Sprint report 생성 (Phase 3)
- ❌ HTML 파싱/변환 (Phase 2에서 구현)

---

## 3. 범위 (Scope)

### 3.1 In-Scope

#### 3.1.1 Backend API (이미 구현됨 - 70%)
**`server/index.js`**:
```javascript
// ✅ 이미 구현됨
GET /api/confluence/page/:pageId
  → Response: {id, title, type, status, body, space, version, _links}

GET /api/confluence/test
  → Response: {ok, status, url, email, body}
```

**환경 변수** (`.env`):
- `CONFLUENCE_URL` - Confluence 인스턴스 URL
- `CONFLUENCE_EMAIL` - 인증 이메일
- `CONFLUENCE_API_TOKEN` - API 토큰

#### 3.1.2 Frontend UI (신규 구현 필요)

**Option A: Settings Modal에 추가** (추천)
```
Settings Modal
├── Jira 설정 (기존)
└── Confluence 설정 (신규) ← 새 탭
    ├── URL 입력
    ├── Email 입력
    ├── API Token 입력
    ├── [연결 테스트] 버튼
    └── 페이지 ID 입력 → [읽기] 버튼
```

**Option B: 새 탭 추가**
```
Layout
├── Create (기존)
├── Edit (기존)
├── History (기존)
└── Confluence (신규) ← 새 탭
    └── Confluence Reader UI
```

#### 3.1.3 기능 명세

| 기능 | 설명 | 우선순위 |
|------|------|----------|
| **FR-1**: URL/ID 입력 | Confluence 페이지 URL 또는 페이지 ID 입력 | High |
| **FR-2**: 페이지 가져오기 | Backend API 호출하여 페이지 데이터 가져오기 | High |
| **FR-3**: 정보 표시 | 제목, 본문, Space, 버전 정보 표시 | High |
| **FR-4**: 연결 테스트 | Confluence 자격증명 검증 | Medium |
| **FR-5**: 에러 처리 | 잘못된 ID, 인증 실패 등 에러 메시지 | Medium |

### 3.2 Out-of-Scope
- HTML → Markdown 변환
- 표(table) 추출
- Jira 티켓 생성
- 자동 동기화

---

## 4. 요구사항 (Requirements)

### 4.1 Functional Requirements

#### FR-1: Confluence 페이지 URL/ID 입력
**우선순위**: High

**Input 형식 지원**:
1. **페이지 ID** (숫자): `123456789`
2. **페이지 URL** (전체): `https://your-domain.atlassian.net/wiki/spaces/DEV/pages/123456789/Title`
3. **페이지 URL** (짧은 형식): `/wiki/spaces/DEV/pages/123456789`

**ID 추출 로직**:
```typescript
function extractPageId(input: string): string | null {
  // 숫자만 있으면 바로 반환
  if (/^\d+$/.test(input.trim())) return input.trim();

  // URL에서 페이지 ID 추출
  const match = input.match(/\/pages\/(\d+)/);
  return match ? match[1] : null;
}
```

#### FR-2: 페이지 데이터 가져오기
**우선순위**: High

**API 호출**:
```typescript
async function fetchConfluencePage(pageId: string) {
  const response = await fetch(`/api/confluence/page/${pageId}`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return await response.json();
}
```

**Response 구조**:
```typescript
interface ConfluencePageData {
  id: string;
  title: string;
  type: string; // "page" | "blogpost"
  status: string; // "current"
  body: string; // HTML 본문
  space: {
    id: string;
    key: string;
    name: string;
  };
  version: {
    number: number;
    when: string; // ISO 날짜
    by: string; // 작성자 이름
  };
  _links: {
    webui: string; // 페이지 웹 링크
  };
}
```

#### FR-3: 페이지 정보 표시
**우선순위**: High

**표시 항목**:
- **제목** (title) - 굵게, 큰 글씨
- **Space** (space.name) - 배지 형태
- **Type** (type) - "Page" 또는 "Blog"
- **Status** (status) - "Current" 등
- **마지막 수정** (version.when, version.by)
- **본문** (body) - HTML 렌더링 또는 미리보기

**UI 디자인** (Option A - Settings Modal):
```
┌─────────────────────────────────────────┐
│ [Confluence 설정]                       │
├─────────────────────────────────────────┤
│ 페이지 ID 또는 URL:                     │
│ [__________________________________] [읽기] │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ 📄 Title: Project Planning Guide   │ │
│ │ 🏠 Space: Development (DEV)        │ │
│ │ 📅 Updated: 2026-02-20 by 홍길동   │ │
│ │ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │ │
│ │ [본문 미리보기]                     │ │
│ │ ...HTML 렌더링...                   │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ [전체 보기] [Jira로 가져오기] [닫기]   │
└─────────────────────────────────────────┘
```

#### FR-4: 연결 테스트
**우선순위**: Medium

**Test API 호출**:
```typescript
async function testConfluenceConnection() {
  const response = await fetch('/api/confluence/test');
  const data = await response.json();
  return data; // {ok, status, url, email, body}
}
```

**Toast 알림**:
- ✅ 성공: "Confluence 연결 성공!"
- ❌ 실패: "Confluence 연결 실패: [에러 메시지]"

#### FR-5: 에러 처리
**우선순위**: Medium

**에러 케이스**:
| 에러 | 원인 | 사용자 메시지 |
|------|------|---------------|
| 400 | 잘못된 페이지 ID | "잘못된 페이지 ID입니다" |
| 401 | 인증 실패 | "Confluence 인증 실패 - 설정을 확인하세요" |
| 404 | 페이지 없음 | "페이지를 찾을 수 없습니다 (ID: {id})" |
| 500 | 서버 에러 | "서버 오류가 발생했습니다" |
| Network | 네트워크 에러 | "네트워크 오류 - 연결을 확인하세요" |

### 4.2 Non-Functional Requirements

#### NFR-1: 성능
- 페이지 가져오기: 3초 이내
- UI 응답성: 즉각적 (로딩 스피너 표시)

#### NFR-2: 보안
- ✅ API Token은 Backend에서만 관리 (Frontend에 노출 안 함)
- ✅ 환경 변수로 자격증명 저장 (`.env`)
- ❌ Frontend에 Token 노출 금지

#### NFR-3: 호환성
- Chrome, Edge, Firefox 최신 버전 지원
- React 19 + TypeScript

---

## 5. 제약사항 (Constraints)

### 5.1 기술적 제약사항
- **Backend API 고정**: 기존 `/api/confluence/page/:pageId` 사용, 수정 불가
- **Confluence REST API v1**: Backend에서 v1 사용 중, v2로 업그레이드 불가 (호환성)
- **HTML 본문**: Confluence Storage Format (HTML), 변환 없이 그대로 표시

### 5.2 설계 제약사항
- **기존 UI 패턴 유지**: Shadcn/ui 컴포넌트 사용
- **Settings 통합**: 가능하면 Settings Modal에 통합 (새 탭 지양)

### 5.3 시간 제약사항
- **개발 기간**: 2-3일
  - Plan: 0.5일
  - Design: 0.5일
  - Do: 1-1.5일
  - Check: 0.5일

---

## 6. 성공 기준 (Success Criteria)

### 6.1 정량적 지표
- [ ] Confluence 페이지 ID 입력 → 3초 이내 데이터 표시
- [ ] 연결 테스트 성공률 100% (올바른 자격증명 시)
- [ ] 에러 케이스 100% 처리 (404, 401, 500, Network)

### 6.2 정성적 지표
- [ ] Settings Modal에 Confluence 설정 탭 추가
- [ ] 페이지 정보 (제목, Space, 본문 미리보기) 정확히 표시
- [ ] 사용자 친화적 에러 메시지

### 6.3 테스트 체크리스트
- [ ] **정상 케이스**: 올바른 페이지 ID → 페이지 정보 표시
- [ ] **URL 입력**: 전체 URL → ID 추출 → 페이지 표시
- [ ] **에러 케이스**:
  - [ ] 잘못된 ID → 404 에러 메시지
  - [ ] 인증 실패 → 401 에러 메시지
  - [ ] 네트워크 오류 → 네트워크 에러 메시지
- [ ] **연결 테스트**: [테스트] 버튼 → 성공/실패 Toast

---

## 7. 설계 방향 (Design Direction)

### 7.1 아키텍처 개요

```
┌─────────────────────────────────────────────────┐
│  Frontend (React)                               │
│  ┌───────────────────────────────────────────┐  │
│  │ Settings Modal                            │  │
│  │  └─ Confluence Tab (신규)                │  │
│  │     ├─ URL/ID Input                       │  │
│  │     ├─ [읽기] 버튼                        │  │
│  │     └─ Page Info Display                  │  │
│  └───────────────────────────────────────────┘  │
│         │                                        │
│         │ fetch(/api/confluence/page/:id)        │
│         ▼                                        │
│  ┌───────────────────────────────────────────┐  │
│  │ confluenceService.ts (신규)               │  │
│  │  - fetchPage(pageId)                      │  │
│  │  - testConnection()                       │  │
│  │  - extractPageId(input)                   │  │
│  └───────────────────────────────────────────┘  │
└───────────────┬─────────────────────────────────┘
                │ HTTP Request
                ▼
┌─────────────────────────────────────────────────┐
│  Backend (Express.js)                           │
│  ┌───────────────────────────────────────────┐  │
│  │ server/index.js (기존)                    │  │
│  │  GET /api/confluence/page/:pageId ✅      │  │
│  │  GET /api/confluence/test ✅              │  │
│  └───────────────────────────────────────────┘  │
│         │                                        │
│         │ Confluence REST API v1                │
│         ▼                                        │
│  ┌───────────────────────────────────────────┐  │
│  │ Confluence Cloud                          │  │
│  │  /rest/api/content/{pageId}               │  │
│  └───────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

### 7.2 주요 컴포넌트

#### 7.2.1 ConfluenceSettingsTab.tsx (신규)
```typescript
export function ConfluenceSettingsTab() {
  const [pageInput, setPageInput] = useState('');
  const [pageData, setPageData] = useState<ConfluencePageData | null>(null);
  const [loading, setLoading] = useState(false);

  const handleFetchPage = async () => {
    const pageId = extractPageId(pageInput);
    if (!pageId) {
      toast.error('올바른 페이지 ID 또는 URL을 입력하세요');
      return;
    }

    setLoading(true);
    try {
      const data = await confluenceService.fetchPage(pageId);
      setPageData(data);
      toast.success('페이지를 불러왔습니다');
    } catch (error) {
      handleError(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          placeholder="페이지 ID 또는 URL"
          value={pageInput}
          onChange={(e) => setPageInput(e.target.value)}
        />
        <Button onClick={handleFetchPage} disabled={loading}>
          {loading ? '로딩 중...' : '읽기'}
        </Button>
      </div>

      {pageData && <ConfluencePageView data={pageData} />}
    </div>
  );
}
```

#### 7.2.2 confluenceService.ts (신규)
```typescript
export const confluenceService = {
  async fetchPage(pageId: string): Promise<ConfluencePageData> {
    const res = await fetch(`/api/confluence/page/${pageId}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  },

  async testConnection(): Promise<{ok: boolean; status: number}> {
    const res = await fetch('/api/confluence/test');
    return await res.json();
  },

  extractPageId(input: string): string | null {
    if (/^\d+$/.test(input.trim())) return input.trim();
    const match = input.match(/\/pages\/(\d+)/);
    return match ? match[1] : null;
  },
};
```

---

## 8. 일정 (Timeline)

| Phase | Task | Duration | Owner | Status |
|-------|------|----------|-------|--------|
| **Plan** | Plan 문서 작성 | 0.5일 | Claude Code | 🔄 진행 중 |
| **Design** | Design 문서 작성, UI 프로토타입 | 0.5일 | Claude Code | ⏳ 대기 |
| **Do** | 구현 (Service + Component) | 1-1.5일 | Claude Code | ⏳ 대기 |
| **Check** | 테스트 및 검증 | 0.5일 | Claude Code | ⏳ 대기 |

**총 예상 기간**: 2.5-3일

---

## 9. 리스크 (Risks)

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| **Backend API 응답 느림** | 중간 | 중간 | 로딩 스피너 + Timeout (10초) 설정 |
| **Confluence 자격증명 미설정** | 높음 | 높음 | 연결 테스트 기능 + 친절한 안내 메시지 |
| **HTML 렌더링 보안 위험 (XSS)** | 낮음 | 높음 | `dangerouslySetInnerHTML` 대신 iframe 또는 sanitize |
| **Settings Modal 복잡도 증가** | 중간 | 낮음 | 탭 구조로 분리, Confluence 전용 탭 추가 |

---

## 10. 참고 자료 (References)

### 10.1 프로젝트 문서
- [Todo.md](../../../Todo.md) - 우선순위 높음 항목
- [Overview.md](../../../Over%20view.md) - Confluence 표 복사-붙여넣기 언급
- [CLAUDE.md](../../../CLAUDE.md) - Pre-Plan Code Review 프로토콜

### 10.2 기술 문서
- [Confluence REST API v1](https://developer.atlassian.com/cloud/confluence/rest/v1/intro/)
- [Confluence Content API](https://developer.atlassian.com/cloud/confluence/rest/v1/api-group-content/)
- [Shadcn/ui Tabs](https://ui.shadcn.com/docs/components/tabs)

### 10.3 기존 구현
- `server/index.js:95-112` - Confluence 페이지 가져오기 API
- `server/index.js:314-353` - getConfluencePage() 함수
- `src/components/SettingsModal.tsx` - 설정 UI (통합 대상)

---

## 11. 승인 및 다음 단계 (Approval & Next Steps)

### 11.1 승인 체크리스트
- [ ] 요구사항이 명확한가?
- [ ] 범위가 적절한가? (Phase 1 Foundation만)
- [ ] Backend API 재사용 가능 확인됨?
- [ ] 리스크가 관리 가능한가?

### 11.2 다음 단계
1. **사용자 승인 대기** → 이 Plan 문서 검토 및 피드백
2. **승인 후** → `/pdca design confluence-페이지-읽기` 실행하여 상세 설계
3. **Design 완료 후** → 구현 시작

### 11.3 향후 Phase (참고용)
- **Phase 2**: Confluence-Jira 동기화 (별도 Plan)
- **Phase 3**: DoD 추출, Sprint Report, Milestone 계획 (별도 Plan)

---

**Plan 작성 완료일**: 2026-02-25
**다음 리뷰 일정**: 사용자 승인 후
**담당자**: Claude Code
