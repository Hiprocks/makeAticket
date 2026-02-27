# [Design] DoD 추출 및 Jira 티켓 자동 생성

> **Feature**: Confluence DoD Extraction → Jira Task Automation
> **PDCA Phase**: Design
> **Created**: 2026-02-25
> **Status**: In Design
> **Reference**: [Plan 문서](../../01-plan/features/dod-jira-automation.plan.md)

---

## 1. 아키텍처 개요 (Architecture Overview)

### 1.1 전체 구조

```
┌─────────────────────────────────────────────────────────────┐
│                    React Frontend                           │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  DoD Automation Tab                                   │  │
│  │  ┌─────────────┐  ┌──────────────┐  ┌─────────────┐  │  │
│  │  │ Step1       │  │ Step2        │  │ Step3       │  │  │
│  │  │ Confluence  │→ │ DoD          │→ │ Jira Task   │  │  │
│  │  │ Input       │  │ Extraction   │  │ Creation    │  │  │
│  │  └─────────────┘  └──────────────┘  └─────────────┘  │  │
│  └───────────────────────────────────────────────────────┘  │
│                          ↓ API Calls                        │
└──────────────────────────┼──────────────────────────────────┘
                           ↓
┌──────────────────────────┼──────────────────────────────────┐
│                    Express.js Backend                       │
│  ┌────────────────────┐  ┌────────────────────┐            │
│  │ Confluence Proxy   │  │ Jira Proxy         │            │
│  │ /api/confluence/*  │  │ /api/jira/*        │            │
│  └────────────────────┘  └────────────────────┘            │
└──────────────────────────┼──────────────────────────────────┘
                           ↓
┌──────────────────────────┼──────────────────────────────────┐
│                   External APIs                             │
│  ┌────────────────────┐  ┌────────────────────┐            │
│  │ Confluence API v2  │  │ Jira API v3        │            │
│  └────────────────────┘  └────────────────────┘            │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 데이터 흐름

```
[사용자 입력]
    ↓ Confluence URL
[Step 1: Confluence 조회]
    ↓ HTML Content
[HTML 파싱 엔진]
    ↓ 구조화 데이터 (협업 체크, 본문)
[DoD 추출 엔진]
    ↓ DoD 추출 결과
[Step 2: DoD 확인/수정]
    ↓ 사용자 승인
[Epic 조회]
    ↓ 기존 Task 목록
[중복 확인]
    ↓ 생성 필요 Task 목록
[Step 3: Task 생성 확인]
    ↓ 사용자 선택
[Jira Task 생성]
    ↓ 생성 결과
[완료 모달]
```

---

## 2. UI 설계 (UI Design)

### 2.1 컴포넌트 구조

```
DoDAutomationTab/
├── index.tsx                          # 메인 탭 컴포넌트
├── Step1_ConfluenceInput.tsx          # Step 1: Confluence 입력
├── Step2_DoDReview.tsx                # Step 2: DoD 검토
├── Step3_TaskCreation.tsx             # Step 3: Task 생성
├── components/
│   ├── PartCheckTable.tsx             # 파트/직군 체크 테이블
│   ├── DoDTableView.tsx               # DoD 테이블 뷰어
│   ├── TaskList.tsx                   # 생성 예정/기존 Task 목록
│   ├── CreationProgressModal.tsx      # 생성 진행 모달
│   └── CreationResultModal.tsx        # 생성 결과 모달
├── hooks/
│   ├── useConfluenceQuery.ts          # Confluence 조회 훅
│   ├── useDoDExtraction.ts            # DoD 추출 훅
│   ├── useJiraTaskCreation.ts         # Task 생성 훅
│   └── useEpicQuery.ts                # Epic 조회 훅
└── services/
    ├── confluenceService.ts           # Confluence API
    ├── dodExtractionService.ts        # DoD 추출 로직
    └── jiraAutomationService.ts       # Jira 자동화 API
```

### 2.2 컴포넌트 상세 설계

#### 2.2.1 DoDAutomationTab

**Props**: 없음
**State**:
```typescript
interface DoDAutomationState {
  currentStep: 1 | 2 | 3;  // 현재 단계
  confluenceData: ConfluenceData | null;
  dodExtraction: DoDExtraction | null;
  selectedTasks: string[];  // 생성할 Task의 prefix 목록
}
```

**책임**:
- 3단계 네비게이션 관리
- 전역 상태 관리 (Zustand)
- 에러 처리 및 토스트 알림

---

#### 2.2.2 Step1_ConfluenceInput

**Props**: 없음
**State**:
```typescript
interface Step1State {
  confluenceUrl: string;  // 사용자 입력 URL
  isLoading: boolean;
  error: string | null;
}
```

**UI**:
```tsx
<div className="space-y-4">
  <h2>1단계: Confluence 기획서 입력</h2>

  <div className="flex gap-2">
    <Input
      value={confluenceUrl}
      onChange={(e) => setConfluenceUrl(e.target.value)}
      placeholder="https://company.atlassian.net/wiki/spaces/.../pages/123456"
      className="flex-1"
    />
    <Button
      onClick={handleFetchConfluence}
      disabled={isLoading}
    >
      {isLoading ? '조회 중...' : '조회'}
    </Button>
  </div>

  {error && <Alert variant="error">{error}</Alert>}

  {/* 최근 조회 기록 */}
  <RecentPagesDropdown onSelect={handleSelectRecent} />
</div>
```

**기능**:
1. Confluence URL 입력 및 검증
2. 페이지 ID 추출 (정규식)
3. Confluence API 호출
4. 에러 처리 (권한 없음, 404 등)
5. 최근 조회 기록 저장 (LocalStorage)

**URL 파싱 로직**:
```typescript
function extractPageId(url: string): string | null {
  // https://company.atlassian.net/wiki/spaces/GAME/pages/123456
  const match = url.match(/\/pages\/(\d+)/);
  return match ? match[1] : null;
}
```

---

#### 2.2.3 Step2_DoDReview

**Props**:
```typescript
interface Step2Props {
  extraction: DoDExtraction;
  onConfirm: () => void;
  onReExtract: () => void;
}
```

**UI**:
```tsx
<div className="space-y-6">
  <h2>2단계: DoD 추출 결과 확인</h2>

  {/* 기획서 정보 */}
  <Card>
    <CardHeader>
      <h3>{extraction.title}</h3>
      <p className="text-sm text-muted-foreground">
        Epic: {extraction.epicKey}
      </p>
    </CardHeader>
  </Card>

  {/* 파트/직군 체크 테이블 */}
  <PartCheckTable parts={extraction.parts} />

  {/* DoD 테이블 뷰어 (접이식) */}
  <Collapsible>
    <CollapsibleTrigger>
      <Button variant="outline">DoD 테이블 보기</Button>
    </CollapsibleTrigger>
    <CollapsibleContent>
      <DoDTableView extraction={extraction} />
    </CollapsibleContent>
  </Collapsible>

  {/* 액션 버튼 */}
  <div className="flex gap-2 justify-end">
    <Button variant="outline" onClick={onReExtract}>
      재추출
    </Button>
    <Button onClick={onConfirm}>
      다음 단계 →
    </Button>
  </div>
</div>
```

**기능**:
1. DoD 추출 결과 시각화
2. 파트별 추가 검토 표시 (`[추가 검토]` 뱃지)
3. DoD 테이블 Markdown 렌더링
4. 재추출 기능 (파라미터 조정 후)

---

#### 2.2.4 Step3_TaskCreation

**Props**:
```typescript
interface Step3Props {
  extraction: DoDExtraction;
  onCreateTasks: (selectedPrefixes: string[]) => Promise<void>;
}
```

**State**:
```typescript
interface Step3State {
  selectedTasks: Set<string>;  // 선택된 Task prefix
  isCreating: boolean;
  creationResults: CreationResult[];
}
```

**UI**:
```tsx
<div className="space-y-6">
  <h2>3단계: Jira Task 생성</h2>

  {/* 생성 예정 티켓 */}
  <Card>
    <CardHeader>
      <h3>생성 예정 티켓 ({plannedTasks.length}개)</h3>
    </CardHeader>
    <CardContent>
      {plannedTasks.map((task) => (
        <div key={task.prefix} className="flex items-center gap-2">
          <Checkbox
            checked={selectedTasks.has(task.prefix)}
            onCheckedChange={() => toggleTask(task.prefix)}
          />
          <span>{task.title}</span>
          <Badge variant="outline">생성 필요</Badge>
        </div>
      ))}
    </CardContent>
  </Card>

  {/* 기존 존재 티켓 */}
  <Card>
    <CardHeader>
      <h3>기존 존재 티켓 ({existingTasks.length}개)</h3>
    </CardHeader>
    <CardContent>
      {existingTasks.map((task) => (
        <div key={task.key} className="flex items-center gap-2">
          <Checkbox checked={false} disabled />
          <span>{task.title}</span>
          <Badge variant="secondary">기존 존재 ({task.key})</Badge>
        </div>
      ))}
    </CardContent>
  </Card>

  {/* 액션 버튼 */}
  <div className="flex gap-2 justify-end">
    <Button variant="outline">취소</Button>
    <Button
      onClick={() => onCreateTasks(Array.from(selectedTasks))}
      disabled={selectedTasks.size === 0 || isCreating}
    >
      선택 항목 생성 ({selectedTasks.size}개)
    </Button>
  </div>
</div>
```

**기능**:
1. 생성 예정/기존 Task 목록 표시
2. 다중 선택 (Checkbox)
3. Task 생성 진행 모달 표시
4. 생성 결과 모달 표시

---

### 2.3 모달 컴포넌트

#### 2.3.1 CreationProgressModal

**Props**:
```typescript
interface ProgressModalProps {
  isOpen: boolean;
  tasks: PlannedTask[];
  currentIndex: number;
  results: CreationResult[];
}
```

**UI**:
```tsx
<Dialog open={isOpen}>
  <DialogContent className="sm:max-w-md">
    <DialogHeader>
      <DialogTitle>Jira Task 생성 중...</DialogTitle>
    </DialogHeader>

    {/* 진행률 */}
    <Progress value={(currentIndex / tasks.length) * 100} />
    <p className="text-sm text-center">
      {currentIndex}/{tasks.length} ({Math.round((currentIndex / tasks.length) * 100)}%)
    </p>

    {/* 로그 */}
    <div className="space-y-1 max-h-60 overflow-y-auto">
      {results.map((result, i) => (
        <div key={i} className="flex items-center gap-2 text-sm">
          {result.success ? (
            <CheckCircle className="h-4 w-4 text-green-600" />
          ) : (
            <XCircle className="h-4 w-4 text-red-600" />
          )}
          <span>{result.title}</span>
          {result.success && <span className="text-muted-foreground">({result.key})</span>}
        </div>
      ))}
      {currentIndex < tasks.length && (
        <div className="flex items-center gap-2 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>{tasks[currentIndex].title} 생성 중...</span>
        </div>
      )}
    </div>
  </DialogContent>
</Dialog>
```

---

#### 2.3.2 CreationResultModal

**Props**:
```typescript
interface ResultModalProps {
  isOpen: boolean;
  onClose: () => void;
  results: CreationResult[];
}
```

**UI**:
```tsx
<Dialog open={isOpen} onOpenChange={onClose}>
  <DialogContent className="sm:max-w-2xl">
    <DialogHeader>
      <DialogTitle>생성 완료</DialogTitle>
      <DialogDescription>
        총 {results.length}개 티켓 생성 완료 (성공: {successCount}, 실패: {failCount})
      </DialogDescription>
    </DialogHeader>

    {/* 결과 테이블 */}
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>말머리</TableHead>
          <TableHead>제목</TableHead>
          <TableHead>티켓 키</TableHead>
          <TableHead>상태</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {results.map((result) => (
          <TableRow key={result.prefix}>
            <TableCell>{result.prefix}</TableCell>
            <TableCell>{result.title}</TableCell>
            <TableCell>
              {result.success ? (
                <a href={result.url} target="_blank" className="text-blue-600 hover:underline">
                  {result.key}
                </a>
              ) : (
                '-'
              )}
            </TableCell>
            <TableCell>
              {result.success ? (
                <Badge variant="success">✓ 성공</Badge>
              ) : (
                <Badge variant="destructive">✗ 실패</Badge>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>

    {/* 실패 항목 재시도 */}
    {failCount > 0 && (
      <Button variant="outline" onClick={onRetryFailed}>
        실패 항목 재시도 ({failCount}개)
      </Button>
    )}

    <DialogFooter>
      <Button onClick={onClose}>확인</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

---

## 3. 데이터 모델 (Data Model)

### 3.1 TypeScript 인터페이스

```typescript
// Confluence 데이터
interface ConfluenceData {
  pageId: string;
  title: string;
  url: string;
  htmlContent: string;
  epicLink: string | null;  // 기획서에서 추출한 Epic 링크
}

// HTML 파싱 결과
interface ParsedConfluence {
  title: string;
  collaborationCheck: CollaborationCheck;  // 협업 체크 테이블
  bodyText: string;  // 본문 텍스트 (키워드 탐지용)
  epicKey: string | null;
}

interface CollaborationCheck {
  [partName: string]: boolean;  // 예: "인게임 기획": true
}

// DoD 추출 결과
interface DoDExtraction {
  confluencePageId: string;
  confluenceUrl: string;
  title: string;
  epicKey: string;
  parts: DoDPart[];
  plannedTasks: PlannedTask[];
  existingTasks: ExistingTask[];
}

interface DoDPart {
  partName: string;  // "인게임 기획"
  prefix: string;  // "[기획]"
  checked: boolean;  // 협업 체크 여부
  detected: boolean;  // 키워드 탐지 여부
  status: 'normal' | 'review' | 'none';
  keywords: string[];  // 탐지된 키워드

  tasks: DoDTask[];
}

interface DoDTask {
  title: string;  // 작업 항목
  description: string;  // 상세 내용
  resource: string;  // 리소스
  dependency: string;  // 의존성
}

interface PlannedTask {
  prefix: string;  // "[기획]"
  title: string;  // "[기획] 추가 시간 시스템"
  description: string;  // Markdown (Confluence 링크 + DoD 테이블)
  parentKey: string;  // Epic 키
  blockers: string[];  // Blocks 관계 (선행)
  blockedBy: string[];  // Blocked by 관계 (후행)
}

interface ExistingTask {
  key: string;  // "AEGIS-101"
  prefix: string;  // "[기획]"
  title: string;  // "[기획] 추가 시간 시스템"
}

// Task 생성 결과
interface CreationResult {
  prefix: string;
  title: string;
  success: boolean;
  key: string | null;  // 성공 시 Jira 키
  url: string | null;  // 성공 시 Jira URL
  error: string | null;  // 실패 시 에러 메시지
}
```

### 3.2 Zustand Store

```typescript
// store/useDoDStore.ts
interface DoDStore {
  // Confluence 데이터
  confluenceData: ConfluenceData | null;
  setConfluenceData: (data: ConfluenceData) => void;

  // DoD 추출 결과
  extraction: DoDExtraction | null;
  setExtraction: (data: DoDExtraction) => void;

  // 선택된 Task
  selectedTasks: Set<string>;  // prefix 목록
  toggleTask: (prefix: string) => void;
  selectAllTasks: () => void;
  deselectAllTasks: () => void;

  // 생성 결과
  creationResults: CreationResult[];
  setCreationResults: (results: CreationResult[]) => void;

  // 초기화
  reset: () => void;
}

// store/useDoDSettingsStore.ts
interface DoDSettingsStore {
  // Confluence 설정
  confluenceUrl: string;
  confluenceEmail: string;
  confluenceApiToken: string;

  // 최근 조회 기록
  recentPages: {
    pageId: string;
    title: string;
    url: string;
    timestamp: string;
  }[];

  addRecentPage: (page: RecentPage) => void;
  updateSettings: (settings: Partial<DoDSettingsStore>) => void;
}
```

---

## 4. 알고리즘 설계 (Algorithm Design)

### 4.1 HTML 파싱 알고리즘

**목적**: Confluence HTML → 구조화 데이터 변환

**입력**: HTML 문자열
**출력**: `ParsedConfluence` 객체

**알고리즘**:
```typescript
import * as cheerio from 'cheerio';

function parseConfluenceHtml(html: string): ParsedConfluence {
  const $ = cheerio.load(html);

  // 1. 제목 추출
  const title = $('h1').first().text().trim();

  // 2. 협업 체크 테이블 추출
  const collaborationCheck: CollaborationCheck = {};
  $('table').each((i, table) => {
    const headerText = $(table).find('th').text();
    if (headerText.includes('협업') || headerText.includes('체크')) {
      $(table).find('tr').slice(1).each((j, row) => {
        const cells = $(row).find('td');
        if (cells.length >= 2) {
          const partName = $(cells[0]).text().trim();
          const checkMark = $(cells[1]).text().trim();
          collaborationCheck[partName] = checkMark.includes('✅');
        }
      });
    }
  });

  // 3. Epic 링크 추출
  let epicKey: string | null = null;
  $('a').each((i, link) => {
    const href = $(link).attr('href');
    if (href && href.includes('browse/')) {
      const match = href.match(/browse\/([A-Z]+-\d+)/);
      if (match) {
        epicKey = match[1];
      }
    }
  });

  // 4. 본문 텍스트 추출 (키워드 탐지용)
  const bodyText = $('body').text();

  return { title, collaborationCheck, bodyText, epicKey };
}
```

---

### 4.2 키워드 탐지 알고리즘

**목적**: 본문에서 키워드 검색하여 누락된 파트 탐지

**입력**: 본문 텍스트, 키워드 맵
**출력**: 탐지된 파트 목록

**키워드 맵**:
```typescript
const KEYWORD_MAP: Record<string, string[]> = {
  'VFX 파트': ['이펙트', 'FX', '파티클', '연출', '비주얼', '화면 효과'],
  '사운드 파트': ['효과음', '사운드', '음향', '배경음', 'BGM', 'SE'],
  '애니메이션 파트': ['모션', '애니메이션', '움직임'],
  'UI 파트': ['UI', 'HUD', '메뉴', '팝업', '버튼', '아이콘', '스트링'],
  '레벨디자인 파트': ['맵', '거점', '배치', '레벨'],
  '캐릭터 원화': ['캐릭터', '스킨', '모델', '원화'],
  '배경 원화': ['배경', '환경', '맵 리소스']
};
```

**알고리즘**:
```typescript
function detectPartsByKeywords(bodyText: string): Record<string, string[]> {
  const detected: Record<string, string[]> = {};

  for (const [partName, keywords] of Object.entries(KEYWORD_MAP)) {
    const foundKeywords: string[] = [];

    for (const keyword of keywords) {
      // 대소문자 무시 검색
      const regex = new RegExp(keyword, 'gi');
      if (regex.test(bodyText)) {
        foundKeywords.push(keyword);
      }
    }

    if (foundKeywords.length > 0) {
      detected[partName] = foundKeywords;
    }
  }

  return detected;
}
```

---

### 4.3 DoD 작업 항목 추출 알고리즘

**목적**: 기획서 본문에서 작업 항목 추출

**제약사항**: 이 버전에서는 **수동 입력 또는 템플릿 기반**으로 처리
**자동 추출**은 Phase 2 이후 고려 (NLP 필요)

**현재 방안**:
1. 파트별로 기본 템플릿 제공
2. 사용자가 텍스트 에디터로 수정
3. Markdown 테이블 형식으로 저장

**템플릿 예시**:
```markdown
### 서버 파트
| 작업 항목 | 상세 내용 | 리소스 | 의존성 |
|------|------|------|------|
| 데이터 테이블 확장 | (설명 입력) | 테이블 스키마 | - |
| API 개발 | (설명 입력) | - | [테이블 완료 후] |
```

---

### 4.4 말머리 추출 알고리즘

**목적**: 파트명 → 말머리 변환

**규칙**:
```typescript
const PREFIX_MAP: Record<string, string> = {
  '인게임 기획': '[기획]',
  '아웃게임 기획': '[기획]',
  '인게임 개발': '[클라]',
  '아웃게임 개발': '[클라]',
  '서버 파트': '[서버]',
  'UI 파트': '[UI]',
  '캐릭터 원화': '[아트-2D]',
  '배경 원화': '[아트-2D]',
  '캐릭터 3D': '[아트-3D]',
  '배경 3D': '[아트-3D]',
  '애니메이션 파트': '[애니]',
  'VFX 파트': '[VFX]',
  '사운드 파트': '[사운드]'
};

function extractPrefix(partName: string): string {
  return PREFIX_MAP[partName] || `[${partName}]`;
}
```

---

### 4.5 Task 중복 확인 알고리즘

**목적**: Epic 하위 Task 목록에서 말머리 기준 중복 확인

**입력**: 기존 Task 목록, 생성 예정 prefix 목록
**출력**: 중복 여부 맵

**알고리즘**:
```typescript
function checkDuplicateTasks(
  existingTasks: JiraTask[],
  plannedPrefixes: string[]
): Record<string, { exists: boolean; key: string | null }> {
  const result: Record<string, { exists: boolean; key: string | null }> = {};

  // 기존 Task에서 말머리 추출
  const existingPrefixes = new Map<string, string>();
  for (const task of existingTasks) {
    const match = task.summary.match(/^\[([^\]]+)\]/);
    if (match) {
      const prefix = `[${match[1]}]`;
      existingPrefixes.set(prefix, task.key);
    }
  }

  // 생성 예정 prefix와 비교
  for (const prefix of plannedPrefixes) {
    if (existingPrefixes.has(prefix)) {
      result[prefix] = {
        exists: true,
        key: existingPrefixes.get(prefix)!
      };
    } else {
      result[prefix] = {
        exists: false,
        key: null
      };
    }
  }

  return result;
}
```

---

### 4.6 Blocker 자동 설정 알고리즘

**목적**: 생성된 Task 간 의존성 자동 설정

**입력**: 생성된 Task 목록
**출력**: Issue Link 생성 요청 목록

**의존성 규칙**:
```typescript
const BLOCKER_RULES: Record<string, string[]> = {
  '[기획]': ['[UI]', '[서버]'],
  '[서버]': ['[클라]'],
  '[아트-2D]': ['[아트-3D]'],
  '[아트-3D]': ['[애니]']
};
```

**알고리즘**:
```typescript
function generateBlockerLinks(
  createdTasks: CreationResult[]
): IssueLink[] {
  const links: IssueLink[] = [];
  const taskMap = new Map<string, string>();  // prefix → key

  // 생성된 Task 매핑
  for (const task of createdTasks) {
    if (task.success && task.key) {
      taskMap.set(task.prefix, task.key);
    }
  }

  // Blocker 관계 생성
  for (const [blocker, blocked] of Object.entries(BLOCKER_RULES)) {
    const blockerKey = taskMap.get(blocker);
    if (!blockerKey) continue;

    for (const blockedPrefix of blocked) {
      const blockedKey = taskMap.get(blockedPrefix);
      if (!blockedKey) continue;

      links.push({
        type: { name: 'Blocks' },
        inwardIssue: { key: blockerKey },
        outwardIssue: { key: blockedKey }
      });
    }
  }

  return links;
}
```

---

## 5. API 연동 설계 (API Integration)

### 5.1 Confluence API

#### 5.1.1 페이지 조회

**엔드포인트**: `GET /rest/api/content/{pageId}`
**쿼리**: `expand=body.storage,metadata.labels`

**Backend (Express)**:
```typescript
// server/routes/confluence.ts
router.get('/api/confluence/page/:pageId', async (req, res) => {
  const { pageId } = req.params;
  const confluenceUrl = process.env.CONFLUENCE_URL;
  const email = process.env.CONFLUENCE_EMAIL;
  const apiToken = process.env.CONFLUENCE_API_TOKEN;

  try {
    const response = await fetch(
      `${confluenceUrl}/rest/api/content/${pageId}?expand=body.storage`,
      {
        headers: {
          'Authorization': `Basic ${Buffer.from(`${email}:${apiToken}`).toString('base64')}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Confluence API error: ${response.status}`);
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Confluence API 호출 실패:', error);
    res.status(500).json({ error: error.message });
  }
});
```

**Frontend (React)**:
```typescript
// hooks/useConfluenceQuery.ts
export function useConfluenceQuery() {
  const [data, setData] = useState<ConfluenceData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPage = async (pageId: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/confluence/page/${pageId}`);
      if (!response.ok) {
        throw new Error('기획서 조회 실패');
      }

      const result = await response.json();
      setData({
        pageId: result.id,
        title: result.title,
        url: result._links.webui,
        htmlContent: result.body.storage.value
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return { data, isLoading, error, fetchPage };
}
```

---

### 5.2 Jira API

#### 5.2.1 Epic 조회

**엔드포인트**: `GET /rest/api/3/issue/{epicKey}`
**쿼리**: `fields=summary,subtasks`

**Backend**:
```typescript
router.get('/api/jira/epic/:epicKey', async (req, res) => {
  const { epicKey } = req.params;
  const jiraUrl = process.env.JIRA_URL;
  const email = process.env.JIRA_EMAIL;
  const apiToken = process.env.JIRA_API_TOKEN;

  try {
    // Epic 조회
    const epicResponse = await fetch(
      `${jiraUrl}/rest/api/3/issue/${epicKey}?fields=summary`,
      {
        headers: {
          'Authorization': `Basic ${Buffer.from(`${email}:${apiToken}`).toString('base64')}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!epicResponse.ok) {
      throw new Error(`Jira API error: ${epicResponse.status}`);
    }

    const epicData = await epicResponse.json();

    // 하위 Task 조회
    const searchResponse = await fetch(
      `${jiraUrl}/rest/api/3/search?jql=parent=${epicKey}&fields=summary`,
      {
        headers: {
          'Authorization': `Basic ${Buffer.from(`${email}:${apiToken}`).toString('base64')}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const searchData = await searchResponse.json();

    res.json({
      key: epicData.key,
      summary: epicData.fields.summary,
      subtasks: searchData.issues.map((issue: any) => ({
        key: issue.key,
        summary: issue.fields.summary
      }))
    });
  } catch (error) {
    console.error('Jira Epic 조회 실패:', error);
    res.status(500).json({ error: error.message });
  }
});
```

---

#### 5.2.2 Task 생성

**엔드포인트**: `POST /rest/api/3/issue`

**Backend**:
```typescript
router.post('/api/jira/task/create', async (req, res) => {
  const { tasks } = req.body;  // PlannedTask[]
  const jiraUrl = process.env.JIRA_URL;
  const email = process.env.JIRA_EMAIL;
  const apiToken = process.env.JIRA_API_TOKEN;
  const projectKey = process.env.JIRA_PROJECT_KEY;

  const results: CreationResult[] = [];

  for (const task of tasks) {
    try {
      const response = await fetch(
        `${jiraUrl}/rest/api/3/issue`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${Buffer.from(`${email}:${apiToken}`).toString('base64')}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            fields: {
              project: { key: projectKey },
              issuetype: { name: 'Task' },
              summary: task.title,
              description: {
                type: 'doc',
                version: 1,
                content: [
                  {
                    type: 'paragraph',
                    content: [
                      { type: 'text', text: task.description }
                    ]
                  }
                ]
              },
              parent: { key: task.parentKey }
            }
          })
        }
      );

      if (response.ok) {
        const data = await response.json();
        results.push({
          prefix: task.prefix,
          title: task.title,
          success: true,
          key: data.key,
          url: `${jiraUrl}/browse/${data.key}`,
          error: null
        });
      } else {
        const error = await response.text();
        results.push({
          prefix: task.prefix,
          title: task.title,
          success: false,
          key: null,
          url: null,
          error: error
        });
      }

      // Rate Limit 방지 (2초 대기)
      await new Promise(resolve => setTimeout(resolve, 2000));

    } catch (error) {
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

  res.json({ results });
});
```

---

#### 5.2.3 Blocker 설정

**엔드포인트**: `POST /rest/api/3/issueLink`

**Backend**:
```typescript
router.post('/api/jira/blocker/create', async (req, res) => {
  const { links } = req.body;  // IssueLink[]
  const jiraUrl = process.env.JIRA_URL;
  const email = process.env.JIRA_EMAIL;
  const apiToken = process.env.JIRA_API_TOKEN;

  const results = [];

  for (const link of links) {
    try {
      const response = await fetch(
        `${jiraUrl}/rest/api/3/issueLink`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${Buffer.from(`${email}:${apiToken}`).toString('base64')}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(link)
        }
      );

      results.push({
        success: response.ok,
        inwardKey: link.inwardIssue.key,
        outwardKey: link.outwardIssue.key
      });
    } catch (error) {
      results.push({
        success: false,
        inwardKey: link.inwardIssue.key,
        outwardKey: link.outwardIssue.key,
        error: error.message
      });
    }
  }

  res.json({ results });
});
```

---

## 6. 에러 처리 전략 (Error Handling)

### 6.1 에러 분류

| 에러 유형 | HTTP 코드 | 처리 방안 |
|-----------|-----------|-----------|
| **인증 실패** | 401 | 설정 확인 안내, 재입력 요청 |
| **권한 없음** | 403 | 페이지/프로젝트 권한 안내 |
| **리소스 없음** | 404 | 페이지 ID/Epic 키 확인 안내 |
| **Rate Limit** | 429 | 자동 재시도 (3회, Exponential Backoff) |
| **서버 오류** | 5xx | 일반 에러 메시지, 로그 기록 |
| **네트워크 오류** | - | 재시도 옵션 제공 |

### 6.2 재시도 로직

```typescript
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries: number = 3
): Promise<Response> {
  let lastError: Error;

  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, options);

      // 429 Rate Limit 시 재시도
      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('Retry-After') || '5');
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
        continue;
      }

      return response;
    } catch (error) {
      lastError = error;

      // Exponential Backoff
      const delay = Math.pow(2, i) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}
```

### 6.3 사용자 피드백

```typescript
function handleApiError(error: ApiError) {
  switch (error.status) {
    case 401:
      toast.error('인증 실패: Confluence/Jira 자격증명을 확인하세요.');
      break;
    case 403:
      toast.error('권한 없음: 페이지 또는 프로젝트에 대한 접근 권한이 없습니다.');
      break;
    case 404:
      toast.error('리소스 없음: 페이지 ID 또는 Epic 키를 확인하세요.');
      break;
    case 429:
      toast.warning('요청 제한 초과: 잠시 후 다시 시도하세요.');
      break;
    default:
      toast.error(`오류 발생: ${error.message}`);
      console.error('API Error:', error);
  }
}
```

---

## 7. 성능 최적화 (Performance Optimization)

### 7.1 최적화 전략

| 항목 | 전략 | 예상 효과 |
|------|------|-----------|
| **Confluence 조회** | 캐싱 (5분), 최근 조회 기록 | 반복 조회 시간 5초 → 0.1초 |
| **HTML 파싱** | 웹 워커 사용 (백그라운드 처리) | UI 블로킹 방지 |
| **Task 생성** | 병렬 처리 (최대 3개 동시) | 총 시간 50% 단축 |
| **UI 렌더링** | 가상 스크롤링 (100개 이상 Task) | 렌더링 시간 90% 단축 |

### 7.2 캐싱 전략

```typescript
// In-Memory Cache
const confluenceCache = new Map<string, {
  data: ConfluenceData;
  timestamp: number;
}>();

function getCachedConfluence(pageId: string): ConfluenceData | null {
  const cached = confluenceCache.get(pageId);
  if (!cached) return null;

  const age = Date.now() - cached.timestamp;
  if (age > 5 * 60 * 1000) {  // 5분 경과
    confluenceCache.delete(pageId);
    return null;
  }

  return cached.data;
}

function setCachedConfluence(pageId: string, data: ConfluenceData) {
  confluenceCache.set(pageId, {
    data,
    timestamp: Date.now()
  });
}
```

---

## 8. 테스트 시나리오 (Test Scenarios)

### 8.1 기능 테스트

#### 시나리오 1: 정상 플로우
1. Confluence URL 입력 (올바른 페이지)
2. 조회 버튼 클릭 → 기획서 조회 성공
3. DoD 추출 결과 확인 → 협업 체크 + 키워드 탐지 정상
4. 다음 단계 클릭 → Epic 조회 성공
5. 생성 예정 Task 선택 (3개)
6. 생성 버튼 클릭 → Task 생성 성공
7. 결과 모달 확인 → 3개 모두 성공

**예상 결과**: ✅ 모든 단계 정상 완료

---

#### 시나리오 2: 중복 Task 처리
1. Epic에 이미 `[기획]` Task 존재
2. 생성 예정 목록에 `[기획]` 표시 안 됨
3. `[클라]`, `[서버]`만 생성 가능
4. 생성 버튼 클릭 → 2개만 생성

**예상 결과**: ✅ 중복 방지 정상 작동

---

#### 시나리오 3: 키워드 탐지
1. 기획서 본문에 "UI 필요", "이펙트 추가" 포함
2. 협업 체크에는 VFX, UI 체크 없음
3. DoD 추출 결과에 `[추가 검토]` 표시
4. 사용자가 선택 후 생성

**예상 결과**: ✅ 누락 방지 정상 작동

---

#### 시나리오 4: API 오류 처리
1. Confluence URL 입력 (존재하지 않는 페이지)
2. 조회 버튼 클릭 → 404 에러
3. Toast 알림 표시: "리소스 없음: 페이지 ID를 확인하세요"
4. 사용자가 URL 수정 후 재시도

**예상 결과**: ✅ 에러 피드백 정상

---

### 8.2 성능 테스트

| 테스트 | 목표 | 측정 방법 |
|--------|------|-----------|
| Confluence 조회 | 5초 이내 | `performance.now()` |
| DoD 추출 | 10초 이내 | `performance.now()` |
| Task 생성 (10개) | 20초 이내 | 총 소요 시간 측정 |
| UI 렌더링 (100개 Task) | 16ms 이내 (60fps) | React DevTools Profiler |

---

### 8.3 보안 테스트

| 테스트 | 검증 항목 |
|--------|-----------|
| 자격증명 노출 | 네트워크 탭에서 API Token 확인 |
| XSS 방지 | Confluence HTML에 `<script>` 주입 테스트 |
| CORS 검증 | 외부 도메인에서 API 호출 시도 |

---

## 9. 배포 및 운영 (Deployment & Operations)

### 9.1 환경 변수

**Backend (server/.env)**:
```bash
# Confluence
CONFLUENCE_URL=https://company.atlassian.net/wiki
CONFLUENCE_EMAIL=your-email@example.com
CONFLUENCE_API_TOKEN=your-confluence-api-token

# Jira (기존 변수 활용)
JIRA_URL=https://company.atlassian.net
JIRA_EMAIL=your-email@example.com
JIRA_API_TOKEN=your-jira-api-token
JIRA_PROJECT_KEY=AEGIS
```

### 9.2 배포 체크리스트

- [ ] 환경 변수 설정 완료
- [ ] Confluence API 권한 확인 (페이지 조회)
- [ ] Jira API 권한 확인 (Epic 조회, Task 생성)
- [ ] Rate Limit 설정 확인 (1개/2초)
- [ ] 에러 로깅 설정 (Sentry 또는 콘솔)
- [ ] 최근 조회 기록 저장 확인 (LocalStorage)

---

## 10. 향후 개선 사항 (Future Enhancements)

### Phase 2 (v2.0)
- [ ] DoD 작업 항목 자동 추출 (NLP)
- [ ] 여러 Epic 동시 처리 (Batch Mode)
- [ ] Epic 본문 자동 업데이트 (중복 방지)
- [ ] Sub-task 생성 지원

### Phase 3 (v3.0)
- [ ] Confluence 기획서 템플릿 자동 생성
- [ ] Jira Epic 자동 생성
- [ ] 티켓 우선순위/라벨 자동 설정
- [ ] Slack/이메일 알림 연동

---

## 11. 다음 단계 (Next Steps)

1. ✅ **Design 문서 작성 완료** (현재 단계)
2. ⏳ **구현 시작** → `/pdca do dod-jira-automation`
   - Phase 1: Confluence 연동 (2일)
   - Phase 2: DoD 추출 엔진 (3일)
   - Phase 3: Jira 연동 (2-3일)
   - Phase 4: UI 구현 (2-3일)
3. ⏳ **Gap Analysis** → `/pdca analyze dod-jira-automation`
4. ⏳ **완료 보고서** → `/pdca report dod-jira-automation`

---

**Design 작성 완료일**: 2026-02-25
**작성자**: Claude Code (CTO Lead)
**버전**: 1.0
