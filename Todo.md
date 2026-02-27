# Todo List

> **🤖 자동 업데이트**: 이 문서는 Claude Code가 다음 상황에서 자동으로 업데이트합니다:
> - ✅ 기능 구현 완료 시 → 해당 항목 체크 `[x]`
> - 🆕 새 요구사항 발생 시 → 새 항목 추가
> - 🗑️ 불필요한 항목 → 삭제
> - 📅 매 업데이트 시 → 하단 "마지막 업데이트" 날짜 갱신

---

## 우선순위: 높음

### DoD Automation (신규 탭)
- [x] Phase 1: Confluence 연동 (2일, 2026-02-25 완료)
  - [x] Confluence API 서비스 (`confluenceService.ts`)
  - [x] DoD 추출 엔진 (`dodExtractionService.ts`)
  - [x] UI 컴포넌트 (Step1~3, DoDAutomationTab)
  - [x] Zustand store (`useDoDStore.ts`)
  - [x] Badge/Alert UI 컴포넌트 추가
  - [x] Layout에 "DoD Automation" 탭 추가
- [x] Phase 1.5: AI 기반 DoD 분석 (1일, 2026-02-27 완료)
  - [x] Claude API 통합 (Sonnet 4.6)
  - [x] AI 자동 분석 버튼 추가
  - [x] False positive 방지 (VFX/사운드 오탐지 제거)
  - [x] `jiraAutomationService.ts` 생성
  - [x] Epic 조회 및 기존 Task 필터링
- [ ] **Phase 1.6: DoD 추출 규칙 및 UI 개선** (2-3일, 우선순위: 높음)
  - [ ] 티켓 제목 생성 규칙 검토 및 개선
    - 현재: `[prefix] featureName` 형식
    - 개선 필요: Epic 제목 기반, 파트별 커스터마이징
  - [ ] DoD 추출 규칙 검토 및 정교화
    - AI 프롬프트 튜닝
    - 협업 테이블 감지 정확도 향상
    - 키워드 맵 업데이트
  - [ ] DoD 검토 화면 (Step2) UI 개선
    - 체크박스 그룹화 및 가독성 향상
    - Task 미리보기 개선
    - 수정/삭제 기능 추가
  - [ ] Task 생성 화면 (Step3) UI 개선
    - 진행률 표시 개선
    - 생성 결과 시각화
    - 실패 항목 재시도 버튼
- [ ] Phase 2: Jira 연동 강화 (2-3일)
  - [ ] 중복 Epic 검색 기능
  - [ ] Blocker 링크 API 구현
  - [ ] 재시도 메커니즘
- [ ] Phase 3: 고급 기능 (2일)
  - [ ] DoD History 탭 추가
  - [ ] Epic-Task 관계 시각화
  - [ ] 배치 처리 최적화

### Create 탭 개선
- [x] 복사-붙여넣기 기능 구현 (Excel/Google Sheet/Confluence 표) - **85% 완료** (기본 기능 동작, 개선사항 하단 참조)
- [x] 복사-붙여넣기 Toast 알림 추가 (Gap 1 - 완료, 2026-02-25)
- [ ] 복사-붙여넣기 담당자/Sprint 자동 매핑 (Gap 2 - 우선순위 중간, 4-5시간)
- [ ] 행 추가 시 Tab/Enter 키 지원
- [ ] 단축키 구현 (Ctrl+D, Delete, Ctrl+Enter 등)
- [ ] 담당자 자동완성 기능
- [ ] Sprint 자동 로드 및 동기화
- [ ] 미리보기 모달 개선 (상위업무 연결 관계 시각화)

### Edit 탭 개선
- [ ] 모든 필드 편집 가능하도록 확장 (담당자, Sprint, 날짜 등)
- [ ] 일괄 편집 기능 (선택된 여러 티켓 동시 수정)
- [ ] 변경 사항 미리보기 개선

### 설정
- [ ] Claude MCP 연동 방식 구현 (API 직접 연동 외 대안)
- [ ] 기본값 설정 (기본 유형, 기본 Sprint)
- [ ] 담당자/Sprint 목록 새로고침 기능

## 우선순위: 중간

### AI 인프라 개선
- [x] System Prompt 외부 파일 관리 (2026-02-27 완료)
  - [x] promptLoader.js 서비스 구현
  - [x] prompts/system/ 디렉토리 구조
  - [x] server/index.js 통합
  - [x] 캐싱 메커니즘 및 Fallback

### 미디어 자동 수집
- [ ] YouTube URL 입력 시 주요 장면 자동 스크린샷 수집/저장 (서버 사이드 처리)

### UI/UX 개선
- [ ] 다크 모드 지원
- [ ] 셀 높이 자동 조절 (내용에 따라)
- [ ] 로딩 상태 표시 개선
- [ ] 에러 메시지 개선 (사용자 친화적)

### 데이터 관리
- [ ] 템플릿 저장/불러오기 기능
- [ ] 생성 실패 항목 재시도 기능
- [ ] 기록 검색 기능
- [ ] 기록 내보내기 (CSV)

### Backend
- [ ] 환경 변수 검증 개선
- [ ] 에러 로깅 추가
- [ ] Rate limiting 구현

## 우선순위: 낮음

### 추가 기능
- [ ] 프로젝트 전환 기능 (다중 프로젝트 지원)
- [ ] Slack 알림 연동
- [ ] 티켓 일괄 삭제 기능
- [ ] 티켓 필터링 고급 옵션
- [ ] 커스텀 필드 지원

### 성능 최적화
- [ ] 대용량 데이터 처리 최적화
- [ ] 가상 스크롤링 구현 (대량 행 처리)
- [ ] API 호출 배치 처리

## 버그 및 이슈
- [ ] (현재 알려진 버그 없음)

---

---

## 📋 최근 완료 항목 (2026-02-27)
- ✅ **System Prompt 외부 파일 관리** (2026-02-27)
  - promptLoader.js 서비스 구현 (캐싱, Fallback)
  - prompts/system/dod-analysis.txt 분리
  - server/index.js 통합 (50줄 → 1줄)
  - 유지보수성 대폭 향상 (프롬프트 수정 시 코드 변경 불필요)
  - 관련 파일:
    - Service: `server/promptLoader.js` (신규)
    - Prompt: `prompts/system/dod-analysis.txt` (신규)
    - Backend: `server/index.js` (통합)
- ✅ **AI 기반 DoD 분석 기능 구현** (2026-02-27)
  - Claude Sonnet 4.6 API 통합
  - AI 자동 분석 버튼 추가 ("🤖 AI 자동 분석 (권장)")
  - 게임 개발 전문 System Prompt 구현
  - False positive 방지 (VFX/사운드 오탐지 제거)
  - Epic 조회 및 기존 Task 중복 필터링
  - 관련 파일:
    - Backend: `server/index.js` (`/api/confluence/analyze-dod`)
    - Service: `jiraAutomationService.ts` (신규)
    - Frontend: `Step1_ConfluenceInput.tsx` (AI 분석 통합)
    - Package: `@anthropic-ai/sdk` v0.78.0 설치
- ✅ **DoD Automation Phase 1 완료** (2026-02-25)
  - Confluence 페이지 연동 및 HTML 파싱 (Cheerio)
  - DoD 항목 자동 추출 (Epic + Task 분리)
  - 3단계 워크플로 UI (Confluence 입력 → DoD 검토 → 티켓 생성)
  - Keywords 기반 Part 자동 감지 (VFX, Sound, UI, Animation)
  - Blocker 설정 및 Epic-Task 연결 기능
  - 관련 파일:
    - Services: `confluenceService.ts`, `dodExtractionService.ts`
    - Components: `DoDAutomationTab.tsx`, `Step1~3*.tsx`
    - Store: `useDoDStore.ts`
    - UI: `badge.tsx`, `alert.tsx`
- ✅ 복사-붙여넣기 Toast 알림 추가 (2026-02-25)
  - Sonner 라이브러리 설치 및 통합
  - 성공 알림: "✅ N행 붙여넣기 완료"
  - 경고 알림: "⚠️ N행 붙여넣기 완료 (M개 필드 누락)"
  - 실패 알림: "❌ 붙여넣기 실패: 클립보드 데이터 없음"
  - 관련 파일: `src/App.tsx`, `src/components/TicketRow.tsx`
- ✅ 복사-붙여넣기 기능 기본 구현 확인 (이미 70% 구현됨)
  - PDCA 사이클 완료: Plan → Design (Gap Analysis) → Do (문서화) → Check (검증) → Report
  - 참고 문서: `docs/04-report/복사-붙여넣기-기능.report.md`
  - 남은 개선사항: 필드 자동 매핑, 검증 강화

---

**마지막 업데이트**: 2026-02-27
