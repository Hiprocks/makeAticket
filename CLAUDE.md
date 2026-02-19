# CLAUDE.md - 개발 컨텍스트 문서

이 문서는 Claude Code가 프로젝트 개발 시 항상 참조해야 할 컨텍스트와 가이드라인을 정의합니다.

---

## 🚀 새 세션 시작 프로토콜

**사용자가 다음 키워드로 요청 시 자동 실행:**
- "시작" / "start" / "프로젝트 상태 파악" / "현황 파악"

**자동 수행 절차:**
1. ✅ 이 문서(CLAUDE.md) 전체 읽기
2. ✅ [Todo.md](./Todo.md) 읽고 진행 중/우선순위 높은 항목 확인
3. ✅ `git log --oneline -5` 실행하여 최근 커밋 확인
4. ✅ 현재 프로젝트 상태 요약 제공
   - 마지막 작업 내용
   - 다음 할 일 제안
   - 주의사항 (있는 경우)

**출력 형식:**
```markdown
## 📊 프로젝트 현황 (YYYY-MM-DD)

### 최근 작업 (git log)
- [커밋 메시지들...]

### 진행 중인 작업
- [Todo.md의 우선순위 높은 항목들...]

### 다음 작업 제안
- [추천 작업 순서]

### ⚠️ 주의사항
- [있는 경우만]
```

---

## 📚 주요 참조 문서

### 필수 문서
- **[Overview.md](./Over%20view.md)**: 프로젝트 전체 기획서 및 구현 상태
- **[Todo.md](./Todo.md)**: 구현 예정 기능 및 개선 사항
- **[Mistake Note.md](./Mistake%20Note.md)**: 과거 실수 및 해결 방법

### 문서 역할
| 문서 | 용도 | 업데이트 시점 |
|------|------|---------------|
| Overview.md | 프로젝트 전체 설계 및 현재 상태 | 주요 기능 완성 시 |
| Todo.md | 구현 예정 기능 목록 | 새로운 요구사항 발생 시 |
| Mistake Note.md | 실수 기록 및 학습 | 버그 수정 또는 문제 해결 시 |
| CLAUDE.md (본 문서) | 개발 가이드라인 및 컨텍스트 | 프로젝트 방향 변경 시 |

---

## 🏗️ 프로젝트 구조

### 디렉토리 구조
```
c:\MyProject\makeAticket\
├── src/
│   ├── components/          # React 컴포넌트
│   │   ├── ui/             # Shadcn/ui 기본 컴포넌트
│   │   ├── Layout.tsx      # 메인 레이아웃 (3개 탭)
│   │   ├── SpreadsheetTable.tsx   # Create 탭
│   │   ├── EditTable.tsx          # Edit 탭
│   │   └── HistoryTable.tsx       # History 탭
│   ├── store/              # Zustand 상태 관리
│   │   ├── useTicketStore.ts      # Create 탭 상태
│   │   ├── useEditStore.ts        # Edit 탭 상태
│   │   ├── useHistoryStore.ts     # History 탭 상태
│   │   └── useSettingsStore.ts    # 설정 상태
│   ├── hooks/              # 커스텀 훅
│   │   ├── useTicketCreation.ts   # 티켓 생성 로직
│   │   └── useTicketEdit.ts       # 티켓 편집 로직
│   ├── services/           # API 서비스
│   │   ├── jiraService.ts         # Jira API 호출
│   │   └── storageService.ts      # 저장소 관리
│   ├── lib/                # 유틸리티
│   │   ├── indexedDbStorage.ts    # IndexedDB 저장소
│   │   ├── fileStorage.ts         # 파일 가져오기/내보내기
│   │   ├── csv.ts                 # CSV 파싱
│   │   └── utils.ts               # 공통 유틸
│   └── types/              # TypeScript 타입 정의
│       └── index.ts
├── server/                 # Express.js 백엔드
│   └── index.js            # Jira API Proxy Server
├── Over view.md            # 프로젝트 기획서
├── Todo.md                 # 할 일 목록
├── Mistake Note.md         # 실수 노트
└── CLAUDE.md (본 문서)     # 개발 컨텍스트
```

### 주요 파일 역할
| 파일 | 역할 |
|------|------|
| `src/types/index.ts` | 모든 TypeScript 인터페이스 정의 |
| `src/store/*.ts` | Zustand + persist 상태 관리 |
| `src/services/jiraService.ts` | Jira API 호출 로직 |
| `server/index.js` | Jira API Proxy (CORS 우회, 자격증명 관리) |

---

## 💻 개발 가이드라인

### 1. 코드 컨벤션

#### TypeScript
- **타입 정의**: 모든 공용 타입은 `src/types/index.ts`에 정의
- **인터페이스 네이밍**: PascalCase 사용 (예: `TicketRow`, `CreationRecord`)
- **함수 네이밍**: camelCase 사용 (예: `createEpic`, `handleSubmit`)
- **엄격한 타입 체크**: `any` 사용 최소화, 가능한 구체적 타입 사용

#### React 컴포넌트
- **파일명**: PascalCase (예: `SpreadsheetTable.tsx`)
- **함수형 컴포넌트**: 화살표 함수 대신 `function` 키워드 사용
  ```tsx
  export function MyComponent() {
    // ...
  }
  ```
- **Props 타입**: 인라인 정의 또는 별도 interface
  ```tsx
  interface MyComponentProps {
    title: string;
    onClose: () => void;
  }
  ```

#### 상태 관리 (Zustand)
- **Store 네이밍**: `use*Store` 패턴 (예: `useTicketStore`)
- **액션 네이밍**: 동사로 시작 (예: `addRow`, `deleteRows`, `updateRow`)
- **Persist 사용**: 영구 저장이 필요한 store는 `persist` 미들웨어 사용
- **IndexedDB 우선**: 대량 데이터는 IndexedDB 사용 (LocalStorage 5MB 제한)

#### 파일 및 모듈
- **상대 경로 대신 alias 사용**: `@/components/...` 형식
- **barrel export 지양**: 필요한 것만 개별 import

### 2. Jira API 연동

#### 백엔드 Proxy 사용
- **직접 호출 금지**: 브라우저에서 Jira API 직접 호출하지 않음 (CORS, 자격증명 노출 방지)
- **Proxy 사용**: `server/index.js`를 통해 모든 Jira API 호출
- **엔드포인트**:
  - `POST /api/jira/issue` - 티켓 생성
  - `POST /api/jira/issue/update` - 티켓 업데이트
  - `GET /api/confluence/page/:pageId` - Confluence 페이지 조회

#### 필드 자동 감지
- **Epic Name 필드**: 프로젝트마다 다름 (예: `customfield_10015`) → 자동 감지 필수
- **Epic Link 필드**: Team-managed vs Company-managed 차이 → `parent` 또는 `customfield_*`
- **구현**: `getCreateMeta()` 함수로 동적 감지

### 3. 데이터 저장

#### IndexedDB 사용
- **Store 이름**:
  - `jbc-draft` - Create 탭 임시 저장
  - `jbc-edit` - Edit 탭 임시 저장
  - `jbc-records` - 생성 기록
  - `jbc-settings` - 설정
- **자동 저장**: Zustand persist 미들웨어가 자동으로 변경 감지 및 저장
- **마이그레이션**: LocalStorage → IndexedDB 마이그레이션 완료

#### 저장 시점
- **Create 탭**: 행 추가/수정/삭제 시 자동 저장
- **Edit 탭**: CSV 가져오기, 셀 수정 시 자동 저장
- **History 탭**: 티켓 생성 완료 시 기록 저장
- **Settings**: 설정 변경 시 자동 저장

### 4. UI/UX 원칙

#### Shadcn/ui 컴포넌트
- **일관성**: 기존 Shadcn/ui 컴포넌트 최대한 활용
- **커스터마이징**: 필요시 `src/components/ui/` 내에서 확장
- **스타일링**: Tailwind CSS 클래스 사용

#### 반응형 디자인
- **최소 너비**: 1200px (데스크톱 우선)
- **최대 너비**: 1600px (컨테이너)

#### 로딩 상태
- **진행률 표시**: 긴 작업(티켓 생성/업데이트) 시 `ProgressModal` 사용
- **낙관적 업데이트**: 가능한 경우 즉시 UI 반영

---

## 🔄 자동화 규칙 (CRITICAL - 항상 준수)

Claude Code는 다음 상황에서 **반드시 자동으로** 해당 문서를 업데이트해야 합니다.

### ✅ 기능 개발 완료 시

**트리거**: 사용자가 기능 구현을 완료하고 "완료" 또는 "끝" 등으로 표시할 때

**필수 작업 순서**:
1. **[Overview.md](./Over%20view.md) 업데이트**
   ```markdown
   단계:
   1. "## 14. 현재 구현 상태" 섹션으로 이동
   2. 해당 기능 항목을 [ ]에서 [x]로 변경
   3. 필요시 새로운 하위 항목 추가

   예시:
   - [ ] 복사-붙여넣기 기능
   →
   - [x] 복사-붙여넣기 기능 (Excel/Google Sheet/Confluence 표)
   ```

2. **[Todo.md](./Todo.md) 업데이트**
   ```markdown
   단계:
   1. 완료된 항목 찾기
   2. [ ]를 [x]로 변경 또는 항목 삭제
   3. 개발 중 발견된 새로운 할 일 추가
   4. "마지막 업데이트" 날짜 갱신
   ```

3. **사용자에게 확인 메시지**
   ```markdown
   ✅ 문서 업데이트 완료:
   - Overview.md: [기능명] 완료로 표시
   - Todo.md: 완료 항목 체크
   ```

### 🐛 버그 수정 또는 실수 발생 시

**트리거**:
- 버그를 발견하고 수정했을 때
- 잘못된 접근 방법으로 시간을 낭비했을 때
- 같은 실수가 반복될 가능성이 있을 때

**필수 작업 순서**:
1. **[Mistake Note.md](./Mistake%20Note.md)에 기록**
   ```markdown
   단계:
   1. 파일 최상단 "## 기록" 섹션 아래에 새 항목 추가
   2. 템플릿 사용:
      ### [YYYY-MM-DD] 실수 제목
      **문제**: ...
      **원인**: ...
      **해결 방법**: ...
      **교훈**: ...
      **관련 파일/코드**: [파일:라인]
   3. 날짜 역순 유지 (최신이 위)
   ```

2. **[Overview.md](./Over%20view.md) 검토**
   - 기획서에 잘못된 정보가 있으면 수정
   - 아키텍처 결정이 변경되었으면 반영

3. **[CLAUDE.md](./CLAUDE.md) 가이드라인 보완**
   - 반복 가능한 실수라면 "개발 가이드라인" 섹션에 주의사항 추가

### 📝 새로운 요구사항 발생 시

**트리거**: 사용자가 새로운 기능이나 개선사항을 요청할 때

**필수 작업**:
1. **[Todo.md](./Todo.md)에 즉시 추가**
   ```markdown
   단계:
   1. 우선순위 판단 (높음/중간/낮음)
   2. 적절한 카테고리에 추가
   3. 체크박스 [ ]로 시작
   ```

2. **사용자에게 확인**
   ```markdown
   📝 Todo.md에 추가했습니다:
   - [카테고리] 항목명 (우선순위: 높음/중간/낮음)
   ```

### 🔧 리팩토링 또는 구조 변경 시

**트리거**: 코드 구조, 파일 이동, 아키텍처 변경 시

**필수 작업**:
1. **[CLAUDE.md](./CLAUDE.md) 업데이트**
   - "프로젝트 구조" 섹션 수정
   - "주요 파일 역할" 업데이트

2. **[Overview.md](./Over%20view.md) 업데이트**
   - "컴포넌트 구조" 또는 관련 섹션 수정

### ⚠️ 자동화 실패 방지 체크리스트

**매 작업 완료 시 자가 점검**:
- [ ] 문서 업데이트를 잊지 않았는가?
- [ ] 사용자에게 업데이트 사실을 알렸는가?
- [ ] 날짜가 최신인가?
- [ ] 파일 경로가 정확한가?

---

## 🧪 테스트 가이드

### 수동 테스트 체크리스트

#### Create 탭
- [ ] 행 추가/삭제 정상 동작
- [ ] Epic 생성 후 하위 Task 생성
- [ ] 담당자 선택 정상 동작
- [ ] 미리보기 모달 정확한 정보 표시
- [ ] 생성 진행률 정확히 표시
- [ ] 결과 모달에서 성공/실패 구분

#### Edit 탭
- [ ] CSV 가져오기 정상 동작
- [ ] 필드 편집 후 저장
- [ ] Sprint 필터링 동작
- [ ] 검색 기능 정상 동작
- [ ] 업데이트 진행률 표시
- [ ] 결과 모달 정확한 정보

#### History 탭
- [ ] 기록 목록 표시
- [ ] 상세 모달 열기
- [ ] 티켓 키 클릭 시 Jira 페이지 열림

#### Settings
- [ ] Jira 연결 테스트 성공
- [ ] 프로젝트 키 저장 및 로드

### 환경 변수 검증
```bash
# server/.env 필수 항목
JIRA_URL=https://your-domain.atlassian.net
JIRA_EMAIL=your-email@example.com
JIRA_API_TOKEN=your-api-token
JIRA_PROJECT_KEY=YOUR_PROJECT
API_PORT=5174
APP_ORIGIN=http://localhost:5173
```

---

## 🚀 개발 실행 가이드

### 초기 설정
```bash
# 의존성 설치
npm install

# 환경 변수 설정
cp server/.env.example server/.env
# .env 파일 편집하여 Jira 자격증명 입력
```

### 개발 서버 실행
```bash
# 터미널 1: 프론트엔드 개발 서버
npm run dev

# 터미널 2: 백엔드 API 서버
npm run dev:api
```

### 빌드 및 배포
```bash
# 프로덕션 빌드
npm run build

# 빌드 결과 미리보기
npm run preview
```

---

## 📖 추가 참고 자료

### Jira API 문서
- [Jira REST API v3](https://developer.atlassian.com/cloud/jira/platform/rest/v3/intro/)
- [Issue Create Meta](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issues/#api-rest-api-3-issue-createmeta-get)
- [ADF (Atlassian Document Format)](https://developer.atlassian.com/cloud/jira/platform/apis/document/structure/)

### Zustand 문서
- [Zustand GitHub](https://github.com/pmndrs/zustand)
- [Persist Middleware](https://docs.pmnd.rs/zustand/integrations/persisting-store-data)

### Shadcn/ui
- [Shadcn/ui 공식 문서](https://ui.shadcn.com/)
- [Radix UI](https://www.radix-ui.com/)

---

## ⚠️ 주의사항

### 보안
- **API Token 노출 금지**: `.env` 파일은 절대 커밋하지 않음
- **CORS 설정**: 백엔드에서 `APP_ORIGIN` 환경 변수로 허용 도메인 제한
- **민감 정보 로깅 금지**: 콘솔에 API Token, 이메일 등 출력하지 않음

### 성능
- **대량 티켓 생성**: 50개 이상 티켓 생성 시 순차 처리 (병렬 처리 시 Rate Limit 위험)
- **IndexedDB 용량**: 이론적으로 무제한이지만, 수십 MB 이상 시 성능 저하 가능성
- **API 호출 최소화**: 불필요한 Jira API 호출 줄이기 (캐싱, 배치 처리 등)

### 호환성
- **Jira Cloud 전용**: Jira Server/Data Center는 API 차이로 미지원
- **브라우저 호환성**: Chrome, Edge, Firefox 최신 버전 권장 (IndexedDB 필요)

---

**마지막 업데이트**: 2026-02-19
**작성자**: Claude Code
**버전**: 1.0
