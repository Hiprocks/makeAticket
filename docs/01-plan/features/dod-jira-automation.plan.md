# [Plan] DoD 추출 및 Jira 티켓 자동 생성

> **Feature**: Confluence DoD Extraction → Jira Task Automation
> **PDCA Phase**: Plan
> **Created**: 2026-02-25
> **Updated**: 2026-02-26
> **Status**: In Planning

---

## 1. 개요 (Overview)

### 1.1 배경
게임 개발 프로젝트에서 기획서를 작성한 후 **Jira 티켓을 수작업으로 생성**하는 데 많은 시간이 소요됩니다. PM/기획자는 Confluence에 기획서를 작성하고, 각 파트/직군별 작업 항목(DoD)을 정리한 후, 이를 다시 Jira에 일일이 티켓으로 생성해야 합니다.

### 1.2 문제점
- **이중 작업**: Confluence 기획서 → Jira 티켓으로 수작업 전환
- **일관성 부족**: 기획서와 티켓 내용이 불일치할 가능성
- **시간 소모**: 1개 기획서당 10-15개 티켓 생성 시 30분 이상 소요
- **누락 위험**: VFX/사운드 등 키워드 기반 파트 탐지 실패 시 티켓 누락
- **중복 생성**: 기존 티켓 확인 없이 중복 생성 가능성

### 1.3 솔루션
Confluence 기획서 링크를 입력하면 **자동으로 DoD를 추출**하고, Jira Epic을 조회하여 **필요한 Task만 생성**하는 자동화 도구 구현.

---

## 2. 목표 (Goals)

### 2.1 Primary Goal
- **생산성 향상**: 기획서 → Jira 티켓 생성 시간을 30분 → 5분으로 단축 (85% 감소)

### 2.2 Secondary Goals
- **일관성 보장**: 기획서 내용이 Jira 티켓 본문에 자동 반영
- **중복 방지**: 기존 티켓 확인 후 미존재 티켓만 생성
- **누락 방지**: 키워드 기반 파트/직군 자동 탐지 (VFX, 사운드, UI 등)
- **의존성 자동 설정**: Blocker(Blocks/Blocked by) 관계 자동 설정

### 2.3 Non-Goals (이번 구현에서 제외)
- Confluence 기획서 자동 생성 (입력만 지원)
- Jira Epic 자동 생성 (기존 Epic만 지원)
- 티켓 우선순위/라벨 자동 설정 (수동 설정 필요)
- 다국어 지원 (한글 전용)

---

## 3. 범위 (Scope)

### 3.1 In-Scope

#### 3.1.1 지원 프로세스
| 단계 | 설명 | 우선순위 |
|------|------|----------|
| **1. Confluence 조회** | 페이지 ID로 기획서 내용 조회 | 높음 (필수) |
| **2. DoD 추출** | 협업 체크 + 키워드 기반 파트 탐지 | 높음 (필수) |
| **3. DoD 검증** | 5개 항목 자동 검증 체크리스트 실행 | 높음 (필수) |
| **4. Epic 조회** | Jira Epic 및 하위 Task 목록 조회 | 높음 (필수) |
| **5. Task 생성** | 말머리 기준 중복 확인 후 생성 | 높음 (필수) |
| **6. Blocker 설정** | 의존성 관계 자동 설정 | 중간 |
| **7. Epic 본문 업데이트** | DoD 테이블 추가 | 낮음 (선택) |

#### 3.1.2 DoD 추출 규칙
- **협업 체크 분석**: 기획서 상단 "협업 필요 인원 체크" 테이블 파싱
- **키워드 탐지**: VFX, 사운드, UI, 애니메이션 등 본문 키워드 검색
- **작업 항목 통합**: 동일 시스템(테이블/로직)을 1개 행으로 통합, 파트당 3-5개 항목 목표
- **컬럼명 제거**: 언더스코어(_) 포함 변수명 출력 절대 금지, 기능 단위로만 서술
- **계산식 생략**: 수식/계산 로직은 "회복 수식 적용" 수준으로만 기술, 상세 식 노출 금지
- **서버/클라 로직 분리**: 플레이 로직은 인게임 개발(클라이언트)에 배치. 서버 파트는 DB 테이블, 프로토콜, 환경 구축만 담당

#### 3.1.3 Jira 티켓 생성
- **생성 단위**: 직군 단위 (1직군 1티켓) - 동일 직군 내 여러 DoD 항목은 1개 Task에 통합
- **명명 규칙**: `[말머리] 기능명` (예: `[기획] 추가 시간 시스템`)
- **말머리 목록**: 기획, 클라, 서버, UI, 아트-2D, 아트-3D, 애니, VFX, 사운드
- **중복 확인**: Epic 하위 Task 목록에서 말머리 기준 중복 확인
- **Blocker 설정**:
  - 기획 → UI, 서버
  - 서버 → 클라
  - 아트-2D → 아트-3D → 애니
  - VFX, 사운드는 Blocker 없음

### 3.2 Out-of-Scope
- Confluence 기획서 템플릿 자동 생성
- Jira Epic 자동 생성 (수동 생성 전제)
- Sub-task, Story 유형 지원 (Task만 지원)
- 티켓 상태(Status) 자동 변경
- 알림(Slack/이메일) 연동

---

## 4. 요구사항 (Requirements)

### 4.1 Functional Requirements

#### FR-1: Confluence 페이지 조회
**우선순위**: 높음
**설명**: Confluence REST API v2를 통해 기획서 내용 조회

**입력**:
- Confluence 페이지 링크 (예: `https://company.atlassian.net/wiki/spaces/GAME/pages/123456`)
- 또는 페이지 ID (예: `123456`)

**출력**:
- 기획서 제목, 본문(HTML), 협업 체크 테이블, Epic 링크

**제약사항**:
- Confluence Cloud API v2 사용 (Server 버전 미지원)
- 페이지 조회 권한 필요

---

#### FR-2: 협업 체크 분석
**우선순위**: 높음
**설명**: 기획서 상단 "협업 필요 인원 체크" 테이블 파싱

**입력**:
```html
<table>
  <tr><th>파트</th><th>체크</th></tr>
  <tr><td>인게임 기획</td><td>✅</td></tr>
  <tr><td>인게임 개발</td><td>✅</td></tr>
  <tr><td>서버</td><td>✅</td></tr>
  <tr><td>UI</td><td>❌</td></tr>
</table>
```

**출력**:
```javascript
{
  "인게임 기획": true,
  "인게임 개발": true,
  "서버": true,
  "UI": false
}
```

---

#### FR-3: 키워드 기반 파트 탐지
**우선순위**: 높음
**설명**: 기획서 본문에서 키워드 검색하여 누락된 파트 탐지

**탐지 규칙**:
| 파트 | 키워드 |
|------|--------|
| VFX | "이펙트", "FX", "파티클", "연출", "비주얼", "화면 효과" |
| 사운드 | "효과음", "사운드", "음향", "배경음", "BGM", "SE" |
| 애니메이션 | "모션", "애니메이션", "움직임" |
| UI | "UI", "HUD", "메뉴", "팝업", "버튼", "아이콘", "스트링" |
| 레벨디자인 | "맵", "거점", "배치", "레벨" |

**출력**:
```javascript
{
  "VFX": {
    "checked": false,
    "detected": true,
    "keywords": ["이펙트", "파티클"],
    "status": "추가 검토"
  }
}
```

---

#### FR-4: DoD 작업 항목 추출
**우선순위**: 높음
**설명**: 기획서 내용 분석하여 파트별 작업 항목 추출

**추출 원칙**:
1. 동일 시스템 통합 (테이블 여러 컬럼 → 1개 행, 파트당 3-5개 항목 목표)
2. 컬럼명 제거 - 언더스코어(_) 포함 텍스트는 출력에 절대 포함하지 않음
   (예: 추가 시간 체크 및 시간값 컬럼 2개, 패시브 ID 컬럼 2개)
3. 핵심 기능만 나열 (쉼표 구분, 개수 표기 N개/N종 활용)
4. 계산식/수식 생략 - "회복 수식 적용" 수준으로만 기술, 상세 식 출력 금지
5. 서버/클라 로직 분리 - 플레이 로직은 인게임 개발에 배치, 서버는 DB 테이블·프로토콜만

**입력 (기획서 본문)**:
```
## 테이블 추가
- BattleModeInfo 테이블:
  - 추가 시간 체크 여부 컬럼 (bool)
  - 추가 시간 값 컬럼 (int)
  - 패시브 ID 컬럼 2개 (string)

## 로직
- 추가 시간 발생 조건 검증
- 리스폰 차단
- 체력/보호막 회복 계산
```

**출력**:
```markdown
### 서버 파트
| 작업 항목 | 상세 내용 | 리소스 | 의존성 |
|------|------|------|------|
| 데이터 테이블 확장 | BattleModeInfo 4개 컬럼 추가 (추가 시간 체크, 시간값, 패시브 2개) | 테이블 스키마 | - |

### 인게임 개발
| 작업 항목 | 상세 내용 | 리소스 | 의존성 |
|------|------|------|------|
| 추가 시간 룰 로직 구현 | 발생조건 검증, 리스폰 차단, 회복 수식 적용 | - | [서버 파트 완료 후] |
```

---

#### FR-5: Jira Epic 조회
**우선순위**: 높음
**설명**: 기획서에 명시된 Epic을 Jira에서 조회하여 하위 Task 목록 확인

**입력**:
- 기획서 상단에 기재된 Jira Epic 링크
- 또는 Epic 키 직접 입력 (예: `AEGIS-100`)

**조회 절차**:
1. 기획서 상단에서 Jira 링크(Epic) 추출
2. 링크에서 티켓 키 식별 (예: AEGIS-100)
3. Jira API로 Epic 기본 정보 조회 (summary 확인)
4. JQL로 Epic 하위 Task 전체 별도 조회

**조회 불가 시 처리**:
- 기획서 상단에 Epic 링크 없음 → 사용자에게 Epic 키 직접 요청
- 조회된 티켓이 Epic 유형이 아님 → 사용자에게 확인 요청

**출력**:
```javascript
{
  "key": "AEGIS-100",
  "summary": "추가 시간 시스템",
  "childTasks": [
    { "key": "AEGIS-101", "summary": "[기획] 추가 시간 시스템" },
    { "key": "AEGIS-102", "summary": "[서버] 추가 시간 시스템" }
  ]
}
```

---

#### FR-6: Task 중복 확인
**우선순위**: 높음
**설명**: Epic 하위 Task 목록에서 말머리 기준 중복 확인

**비교 기준**: 말머리만 확인 (제목 전체는 무시)
- 기존: `[기획] 추가 시간 시스템` → 말머리 `[기획]` 추출
- 생성 예정: `[기획] 추가 시간 시스템` → 중복 → 생성 안 함

**출력**:
```javascript
[
  { prefix: "[기획]", exists: true, existingKey: "AEGIS-101" },
  { prefix: "[서버]", exists: true, existingKey: "AEGIS-102" },
  { prefix: "[클라]", exists: false },
  { prefix: "[UI]", exists: false }
]
```

---

#### FR-7: Task 자동 생성
**우선순위**: 높음
**설명**: 중복되지 않은 Task만 Jira API로 생성

**생성 단위**: 직군 단위 (1직군 1티켓). 동일 직군 내 여러 DoD 항목은 1개 Task 본문에 통합하여 작성

**생성 내용**:
- **제목**: `[말머리] 기능명`
- **Parent**: Epic 키
- **본문**:
  - Confluence 링크
  - 해당 직군 DoD 테이블 전체 (동일 직군 항목 모두 포함)

**선택 방식**: UI 체크박스 선택 및 번호 직접 입력 모두 지원
- 체크박스: UI에서 생성할 티켓 개별 선택
- 번호 입력: "1, 3번 생성" 형식으로 텍스트 지정 가능

**예시**:
```markdown
## 참조
Confluence: https://company.atlassian.net/wiki/spaces/GAME/pages/123456

## DoD
| 작업 항목 | 상세 내용 | 리소스 | 의존성 |
|------|------|------|------|
| 데이터 테이블 확장 | BattleModeInfo 4개 컬럼 추가 | 테이블 스키마 | - |
| 추가 시간 룰 로직 구현 | 발생조건 검증, 리스폰 차단, 회복 수식 적용 | - | [서버 파트 완료 후] |
```

---

#### FR-8: Blocker 자동 설정
**우선순위**: 중간
**설명**: 생성된 Task 간 의존성(Blocks/Blocked by) 자동 설정

**의존성 규칙**:
| 선행 (Blocks) | 후행 (Blocked by) |
|------|------|
| 기획 | UI, 서버 |
| 서버 | 클라 |
| 아트-2D | 아트-3D |
| 아트-3D | 애니 |
| VFX | (없음) |
| 사운드 | (없음) |

**제약사항**: 해당 Task가 실제로 존재할 때만 설정. DoD 본문이나 티켓 설명에는 별도 기재하지 않음

---

#### FR-9: Epic 본문 업데이트
**우선순위**: 낮음 (선택)
**설명**: Epic 본문에 전체 DoD 테이블 추가

**중복 방지**: 이미 동일 기능명의 DoD 섹션이 있으면 생략. 사용자에게 안내 후 별도 지시 없으면 수정하지 않음

**형식**:
```markdown
## DoD - 추가 시간 시스템 (2026-02-26)

### 인게임 기획
| 작업 항목 | 상세 내용 | 리소스 | 의존성 |
...
```

---

#### FR-10: DoD 검증 체크리스트 자동 실행
**우선순위**: 높음
**설명**: DoD 추출 완료 후 5개 항목을 자동 검증하고 결과를 출력

**검증 항목**:
1. 협업 체크 전체 반영 여부 (체크된 파트 누락 없음)
2. VFX/사운드/UI 키워드 탐지 누락 없음
3. 언더스코어(_) 포함 텍스트 출력 없음
4. Dedicated Server 로직 배치 정확 (플레이 로직 → 클라, DB/프로토콜 → 서버)
5. [추가 검토] 표시 정확 (협업 체크 ❌ + 키워드 탐지 ✅ 파트)

**출력 규칙**:
- 이상 없음 → "검증 완료"만 표시
- 위반 발견 → 위반 항목과 수정 내역만 간단히 표기 후 자동 수정

---

### 4.2 Non-Functional Requirements

#### NFR-1: 성능
- **Confluence 조회**: 5초 이내
- **DoD 추출 + 검증**: 10초 이내
- **Jira Task 생성**: 1개당 2초 이내

#### NFR-2: 사용성
- Confluence 링크 입력 후 2클릭 이내 Task 생성 완료
- 생성 예정 티켓 목록 사전 확인 기능
- 체크박스 선택 및 번호 직접 입력 모두 지원

#### NFR-3: 신뢰성
- API 호출 실패 시 재시도 (최대 3회)
- 부분 성공 허용 (일부 Task 생성 실패 시 나머지는 계속 진행)
- 생성 완료 후 성공/실패 티켓 목록 및 사유 별도 출력

#### NFR-4: 보안
- Confluence/Jira 자격증명은 환경 변수 또는 설정 파일에 저장 (하드코딩 금지)

---

## 5. 기술 스택 (Tech Stack)

| 구분 | 기술 | 용도 |
|------|------|------|
| **프론트엔드** | React 19 + TypeScript | DoD 추출 UI |
| **백엔드** | Express.js (기존 서버 확장) | Confluence/Jira API Proxy |
| **API** | Confluence REST API v2 | 기획서 조회 |
| **API** | Jira REST API v3 | Epic 조회, Task 생성 |
| **파싱** | Cheerio (HTML 파싱) | Confluence HTML → 구조화 데이터 |
| **상태관리** | Zustand | DoD 데이터 저장 |

---

## 6. UI/UX 설계 (Wireframe)

### 6.1 새 탭 추가: "DoD Automation"

```
┌─────────────────────────────────────────────────────────────┐
│ [Jira Bulk Creator]                              [⚙ 설정]  │
├─────────────────────────────────────────────────────────────┤
│  [Create]  [Edit]  [History]  [DoD Automation]   ← 새 탭  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ ■ 1단계: Confluence 기획서 입력                              │
│                                                             │
│ Confluence URL:                                             │
│ [https://company.atlassian.net/wiki/spaces/...  ] [조회]   │
│                                                             │
│ ─────────────────────────────────────────────────────────── │
│                                                             │
│ ■ 2단계: DoD 추출 결과 확인                                  │
│                                                             │
│ 기획서: 추가 시간 시스템                                     │
│ Epic: AEGIS-100                                             │
│ 검증: 검증 완료                                              │
│                                                             │
│ 추출된 파트/직군:                                            │
│ ☑ 인게임 기획 (협업 체크 ✅)                                 │
│ ☑ 서버 파트 (협업 체크 ✅)                                   │
│ ☑ 인게임 개발 (협업 체크 ✅)                                 │
│ ☑ UI 파트 [추가 검토] (키워드 탐지: "HUD 표시")              │
│ ☑ VFX 파트 [추가 검토] (키워드 탐지: "이펙트 필요")          │
│                                                             │
│ [DoD 테이블 보기]  [재추출]                                  │
│                                                             │
│ ─────────────────────────────────────────────────────────── │
│                                                             │
│ ■ 3단계: Jira Task 생성                                     │
│                                                             │
│ 생성 예정 티켓 (3개):                                        │
│ ☑ [클라] 추가 시간 시스템   → 생성 필요                      │
│ ☑ [UI] 추가 시간 시스템     → 생성 필요                      │
│ ☑ [VFX] 추가 시간 시스템    → 생성 필요                      │
│                                                             │
│ 기존 존재 (2개):                                             │
│ □ [기획] 추가 시간 시스템   → 기존 존재 (AEGIS-101)          │
│ □ [서버] 추가 시간 시스템   → 기존 존재 (AEGIS-102)          │
│                                                             │
│ 번호 직접 입력: [1, 3번 생성          ]                      │
│                              [취소]  [선택 항목 생성]        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 6.2 생성 진행 모달
```
┌─────────────────────────────────────────────────┐
│ Jira Task 생성 중...                            │
├─────────────────────────────────────────────────┤
│ ████████░░░░░░░░  2/3 (67%)                    │
│                                                 │
│ ✓ [클라] 추가 시간 시스템 생성 완료 (AEGIS-103) │
│ ✓ [UI] 추가 시간 시스템 생성 완료 (AEGIS-104)   │
│ ⏳ [VFX] 추가 시간 시스템 생성 중...            │
│                                                 │
└─────────────────────────────────────────────────┘
```

### 6.3 생성 결과 모달
```
┌─────────────────────────────────────────────────┐
│ 생성 완료                                       │
├─────────────────────────────────────────────────┤
│ 성공 (2개)                                      │
│ ✓ [클라] 추가 시간 시스템 (AEGIS-103)           │
│ ✓ [UI] 추가 시간 시스템 (AEGIS-104)             │
│                                                 │
│ 실패 (1개)                                      │
│ ✗ [VFX] 추가 시간 시스템 → API Rate Limit 초과  │
│                                                 │
│                                    [닫기]        │
└─────────────────────────────────────────────────┘
```

---

## 7. 데이터 구조 (Data Structure)

### 7.1 DoD 추출 결과

```typescript
interface DoDExtraction {
  // Confluence 정보
  confluencePageId: string;
  confluenceUrl: string;
  title: string;        // 기획서 제목
  epicKey: string;      // Jira Epic 키 (예: AEGIS-100)

  // 파트/직군별 DoD
  parts: DoDPart[];

  // 검증 결과
  validation: ValidationResult;

  // 생성 예정 티켓
  plannedTasks: PlannedTask[];

  // 기존 티켓
  existingTasks: ExistingTask[];
}

interface DoDPart {
  partName: string;     // 파트/직군명 (예: "인게임 기획")
  prefix: string;       // 말머리 (예: "[기획]")
  checked: boolean;     // 협업 체크 여부
  detected: boolean;    // 키워드 탐지 여부
  status: 'normal' | 'review' | 'none';  // 상태 ("추가 검토" 여부)
  keywords: string[];   // 탐지된 키워드 목록

  // 작업 항목 (동일 직군 내 항목 통합, 3-5개 목표)
  // 언더스코어(_) 포함 텍스트 절대 금지
  // 계산식/수식 상세 노출 금지
  tasks: DoDTask[];
}

interface DoDTask {
  title: string;        // 작업 항목 (언더스코어 포함 텍스트 절대 금지)
  description: string;  // 상세 내용 (기능 단위 서술, N개/N종 표기, 수식 생략)
  resource: string;     // 리소스
  dependency: string;   // 의존성
}

interface ValidationResult {
  passed: boolean;
  issues: string[];     // 위반 발견 시 항목별 수정 내역
}

interface PlannedTask {
  prefix: string;       // 말머리 = 직군 단위 식별자 (1직군 1티켓)
  title: string;        // [말머리] 기능명
  description: string;  // Confluence 링크 + 해당 직군 DoD 테이블 전체 통합
  parentKey: string;    // Epic 키
  blockers: string[];   // Blocks 관계 (선행 Task 말머리)
  blockedBy: string[];  // Blocked by 관계 (후행 Task 말머리)
}

interface ExistingTask {
  key: string;          // Jira 키 (예: AEGIS-101)
  prefix: string;       // 말머리 (중복 확인 기준)
  title: string;        // 티켓 제목 (참고용, 비교 기준 아님)
}

interface TaskCreationResult {
  succeeded: { key: string; prefix: string; title: string }[];
  failed: { prefix: string; title: string; reason: string }[];
}
```

### 7.2 설정 (Zustand Store)

```typescript
interface DoDSettings {
  // Confluence 연결
  confluenceUrl: string;        // https://company.atlassian.net/wiki
  confluenceEmail: string;
  confluenceApiToken: string;

  // 최근 조회 기록
  recentPages: {
    pageId: string;
    title: string;
    url: string;
    timestamp: string;
  }[];
}
```

---

## 8. API 연동 (API Integration)

### 8.1 Confluence REST API

#### 8.1.1 페이지 조회
```
GET /wiki/api/v2/pages/{pageId}?body-format=storage
```

**응답**:
```json
{
  "id": "123456",
  "title": "추가 시간 시스템",
  "body": {
    "storage": {
      "value": "<html>...</html>"
    }
  }
}
```

### 8.2 Jira REST API

#### 8.2.1 Epic 기본 정보 조회
```
GET /rest/api/3/issue/{epicKey}?fields=summary
```

#### 8.2.2 Epic 하위 Task 전체 조회 (JQL)
```
GET /rest/api/3/search?jql=parent={epicKey}&fields=summary,issuetype,status
```

#### 8.2.3 Task 생성
```
POST /rest/api/3/issue
{
  "fields": {
    "project": { "key": "AEGIS" },
    "issuetype": { "name": "Task" },
    "summary": "[기획] 추가 시간 시스템",
    "description": { ... },
    "parent": { "key": "AEGIS-100" }
  }
}
```

#### 8.2.4 Blocker 설정
```
POST /rest/api/3/issueLink
{
  "type": { "name": "Blocks" },
  "inwardIssue": { "key": "AEGIS-101" },  // 기획
  "outwardIssue": { "key": "AEGIS-104" }  // UI
}
```

---

## 9. 리스크 및 제약사항 (Risks & Constraints)

### 9.1 리스크

| 리스크 | 영향도 | 완화 방안 |
|--------|--------|-----------|
| **Confluence HTML 파싱 실패** | 높음 | 다양한 테이블 형식 테스트, fallback 로직 |
| **키워드 탐지 누락** | 중간 | 키워드 목록 확장, 수동 선택 옵션 제공 |
| **Jira API Rate Limit** | 중간 | Task 생성 속도 제한 (1개/2초), 실패 시 결과 모달에 사유 표시 |
| **Epic 본문 중복 업데이트** | 낮음 | 중복 확인 로직 강화, 사용자에게 존재 여부 안내 |
| **서버/클라 로직 오배치** | 중간 | FR-10 검증 체크리스트 자동 실행으로 탐지 |

### 9.2 제약사항

- **Confluence Cloud 전용**: Server/Data Center 미지원
- **Jira Cloud 전용**: Server/Data Center 미지원
- **한글 전용**: 다국어 지원 없음
- **Task 유형만 지원**: Story, Sub-task 미지원
- **수동 Epic 생성 전제**: Epic은 사전에 존재해야 함

---

## 10. 성공 기준 (Success Criteria)

### 10.1 정량적 지표
- ✅ Confluence 기획서 → Jira Task 생성 시간 **30분 → 5분** 달성
- ✅ DoD 추출 정확도 **95% 이상** (키워드 탐지 성공률)
- ✅ Task 중복 생성 **0건** (기존 티켓 확인 100%)
- ✅ API 성공률 **99% 이상** (3회 재시도 포함)
- ✅ 서버/클라 로직 오배치 **0건** (FR-10 검증 통과율 100%)

### 10.2 정성적 지표
- ✅ PM/기획자가 "매우 만족" 평가 (설문 4.5/5 이상)
- ✅ 수작업 대비 "훨씬 편리함" 평가 (설문 4.0/5 이상)
- ✅ 협업 체크 + 키워드 탐지 결과에 "신뢰" (설문 4.0/5 이상)

---

## 11. 일정 산정 (Timeline Estimation)

### 11.1 단계별 예상 기간

| 단계 | 작업 내용 | 예상 기간 |
|------|-----------|-----------|
| **Plan** | 요구사항 정의, 기획서 작성 | 1일 (완료) |
| **Design** | UI 설계, 데이터 구조 설계, API 스펙 | 2일 |
| **Do** | 구현 (Confluence 조회, DoD 추출, Jira Task 생성) | 5-7일 |
| **Check** | Gap Analysis, 테스트 | 1일 |
| **Act** | 버그 수정, 개선 | 1-2일 |

**총 예상 기간**: **10-13일** (약 2주)

### 11.2 Phase별 세부 일정

#### Phase 1: Confluence 연동 (2일)
- Confluence API v2 연동 (페이지 조회)
- HTML 파싱 (Cheerio)
- 협업 체크 테이블 추출

#### Phase 2: DoD 추출 엔진 (3일)
- 키워드 기반 파트 탐지
- 작업 항목 통합 로직 (1직군 1티켓, 언더스코어 필터링, 계산식 생략)
- 서버/클라 로직 분리 검증
- FR-10 검증 체크리스트 자동 실행

#### Phase 3: Jira 연동 (2-3일)
- Epic 조회 (링크 추출 → 키 식별 → JQL 기반 하위 Task 목록 확인)
- Task 생성 (말머리 기준 중복 확인 포함)
- Blocker 자동 설정
- 성공/실패 결과 목록 출력

#### Phase 4: UI 구현 (2-3일)
- "DoD Automation" 탭 추가
- 3단계 UI (조회 → DoD 확인 → Task 생성)
- 체크박스 선택 + 번호 직접 입력 이중 지원
- 진행 모달, 성공/실패 결과 모달

---

## 12. 다음 단계 (Next Steps)

1. ✅ **Plan 문서 작성 완료** (현재 단계)
2. ⏳ **Design 문서 작성** → `/pdca design dod-jira-automation`
3. ⏳ **구현 시작** → `/pdca do dod-jira-automation`
4. ⏳ **Gap Analysis** → `/pdca analyze dod-jira-automation`
5. ⏳ **완료 보고서** → `/pdca report dod-jira-automation`

---

**Plan 작성 완료일**: 2026-02-25
**최종 수정일**: 2026-02-26
**작성자**: Claude Code (CTO Lead)
**버전**: 1.2