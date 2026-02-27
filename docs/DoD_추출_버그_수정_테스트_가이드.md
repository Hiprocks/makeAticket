# DoD 추출 버그 수정 테스트 가이드

**작성일**: 2026-02-27
**버전**: 1.0
**목적**: DoD 추출 기능의 4가지 버그 수정 검증

---

## 🔧 수정된 버그 요약

### Bug #1: 협업 테이블 감지 실패 ✅
- **문제**: "협업" 또는 "체크"가 헤더에 없으면 테이블 감지 실패
- **수정**: 휴리스틱 점수 시스템 도입, 더 많은 키워드 지원

### Bug #2: 무관한 데이터 표시 (VFX 등) ✅
- **문제**: 키워드 1개만으로 파트 생성 (false positive)
- **수정**: 핵심 키워드 필수, 협업 체크 없으면 작업 항목 미생성

### Bug #3: 기존 Task 체크 실패 ✅
- **문제**: 이미 생성된 Task가 "생성 예정"으로 표시
- **수정**: Epic 조회 후 기존 Task prefix와 비교하여 필터링

### Bug #4: 제목 생성 오류 ✅
- **문제**: Confluence 페이지 제목으로 티켓 제목 생성
- **수정**: Epic 제목 기반으로 티켓 제목 생성

---

## 🧪 Test Case 1: 협업 테이블 감지

### **Scenario A: 표준 협업 테이블**

**Given**: Confluence 페이지에 다음 테이블 존재
```
| 협업 파트 | 체크 |
|----------|------|
| 인게임 기획 | ✅ |
| 서버 파트 | ✅ |
| UI 파트 | O |
```

**When**: DoD 추출 실행

**Then**:
- ✅ 협업 테이블 감지 성공 로그 출력: `✅ [parseConfluenceHtml] 협업 테이블 감지 성공`
- ✅ "인게임 기획", "서버 파트", "UI 파트"가 checked: true로 표시
- ✅ 생성 예정 티켓에 3개 포함

---

### **Scenario B: 다양한 헤더 형식**

**Given**: Confluence 페이지에 다음 중 하나의 테이블 존재
- "파트별 작업 체크"
- "직군 담당 리스트"
- "분담 파트 확인"

**When**: DoD 추출 실행

**Then**:
- ✅ 협업 테이블 감지 성공
- ✅ 휴리스틱 점수 로그 확인
- ✅ 파트명이 정확히 파싱됨

---

### **Scenario C: 협업 테이블 없음 (Fallback)**

**Given**: Confluence 페이지에 협업 테이블 없음

**When**: DoD 추출 실행

**Then**:
- ⚠️ 로그 출력: `⚠️ [parseConfluenceHtml] 협업 테이블 감지 실패 - 키워드 탐지로 fallback`
- ✅ 키워드 탐지로 전환
- ✅ 키워드 탐지된 파트만 "추가 검토" 상태로 표시

---

## 🧪 Test Case 2: 키워드 탐지 False Positive 방지

### **Scenario A: 일반적인 단어만 포함 (VFX 작업 없음)**

**Given**: Confluence 페이지 본문
```
이 기능은 비주얼적으로 매력적이어야 합니다.
화면 효과가 자연스러워야 합니다.
```

**When**: DoD 추출 실행

**Then**:
- ❌ "VFX 파트"가 **생성 예정에 표시되지 않음**
- ✅ 핵심 키워드 (VFX, FX, 이펙트, 파티클) 없음 → 탐지 실패
- ✅ 보조 키워드 2개 미만 → 탐지 실패

---

### **Scenario B: 핵심 키워드 포함 (VFX 작업 있음)**

**Given**: Confluence 페이지 본문
```
플레이어 공격 시 이펙트 제작 필요
파티클 효과 3종 제작
```

**When**: DoD 추출 실행

**Then**:
- ✅ "VFX 파트" 키워드 탐지 성공
- ✅ 로그 출력: `✅ [detectPartsByKeywords] VFX 파트 감지: 이펙트, 파티클`
- **협업 체크 없으면**: `status: 'review'`, `tasks: []` (작업 항목 미생성)
- **협업 체크 있으면**: 작업 항목 자동 생성

---

### **Scenario C: 보조 키워드 2개 이상**

**Given**: Confluence 페이지 본문
```
비주얼 연출이 중요합니다.
화면 효과와 연출이 필요합니다.
```

**When**: DoD 추출 실행

**Then**:
- ✅ "VFX 파트" 탐지 (보조 키워드 2개: "비주얼 효과", "연출")
- ✅ 협업 체크 없으면 작업 항목 미생성

---

## 🧪 Test Case 3: 기존 Task 중복 체크

### **Scenario A: Epic에 기존 Task 있음**

**Given**:
- Epic: AEGIS-100 "신규 무기 시스템"
- 기존 Task:
  - AEGIS-101: `[기획] 신규 무기 시스템`
  - AEGIS-102: `[서버] 신규 무기 시스템`

**When**:
1. Confluence 페이지에서 "인게임 기획", "서버 파트", "UI 파트" 협업 체크
2. DoD 추출 실행

**Then**:
- ✅ Epic 조회 로그: `✅ Epic 조회 완료: "신규 무기 시스템"`
- ✅ 기존 Task 2개 감지
- ✅ `[기획]`, `[서버]` prefix는 **생성 예정에서 제외**
- ✅ 로그 출력: `⏭️ [generatePlannedTasks] Skipping existing task: [기획]`
- ✅ 로그 출력: `⏭️ [generatePlannedTasks] Skipping existing task: [서버]`
- ✅ `[UI]` prefix만 생성 예정에 표시
- ✅ "생성 예정 티켓 (1개)" 표시

---

### **Scenario B: Epic에 기존 Task 없음**

**Given**:
- Epic: AEGIS-100 "신규 무기 시스템"
- 기존 Task: 없음

**When**: DoD 추출 실행

**Then**:
- ✅ 모든 협업 체크된 파트가 생성 예정에 표시
- ✅ "생성 예정 티켓 (N개)" 정확히 표시

---

### **Scenario C: Epic 없음**

**Given**: Confluence 페이지에 Epic 링크 없음

**When**: DoD 추출 실행

**Then**:
- ℹ️ 로그 출력: `ℹ️ Epic 링크 없음 - Epic 없이 진행합니다`
- ✅ 모든 협업 체크된 파트가 생성 예정에 표시
- ✅ 중복 체크 생략 (Epic 없으므로)

---

## 🧪 Test Case 4: Epic 제목 기반 티켓 제목

### **Scenario A: Epic 있음**

**Given**:
- Epic: AEGIS-100
- Epic 제목: `신규 무기 시스템`
- Confluence 페이지 제목: `무기 시스템 상세 기획서`
- 협업 체크: "인게임 기획", "UI 파트"

**When**:
1. DoD 추출 실행
2. Task 생성

**Then**:
- ✅ Epic summary 저장: `신규 무기 시스템`
- ✅ 생성된 티켓 제목:
  - `[기획] 신규 무기 시스템` ✅
  - `[UI] 신규 무기 시스템` ✅
- ❌ **NOT**: `[기획] 무기 시스템 상세 기획서`

---

### **Scenario B: Epic 없음 (Fallback)**

**Given**:
- Epic 링크 없음
- Confluence 페이지 제목: `무기 시스템 상세 기획서`

**When**: Task 생성

**Then**:
- ✅ 생성된 티켓 제목:
  - `[기획] 무기 시스템 상세 기획서` (Fallback)

---

## 📊 통합 테스트 시나리오

### **Full Workflow Test**

**Given**: 실제 프로젝트 Confluence 페이지
- 협업 테이블: "파트별 체크"
  - 인게임 기획 ✅
  - 서버 파트 ✅
  - UI 파트 ✅
  - VFX 파트 X
- 본문 키워드: "UI 버튼", "HUD 제작", "이펙트 3종"
- Epic: AEGIS-100 "신규 스킬 시스템"
- 기존 Task: AEGIS-101 `[기획] 신규 스킬 시스템`

**When**: DoD 추출 → Task 선택 → 티켓 생성

**Then**:
1. ✅ 협업 테이블 감지 성공
2. ✅ "인게임 기획", "서버 파트", "UI 파트" checked: true
3. ✅ "VFX 파트" 키워드 탐지 (status: 'review', tasks: [])
4. ✅ `[기획]` prefix 제외 (기존 Task 있음)
5. ✅ 생성 예정: `[서버]`, `[UI]` (2개)
6. ✅ 티켓 제목: `[서버] 신규 스킬 시스템`, `[UI] 신규 스킬 시스템`

---

## 🛠️ 디버깅 로그 체크리스트

### Step 1: Confluence 조회 시

```bash
# 협업 테이블 감지
✅ [parseConfluenceHtml] 협업 테이블 감지 성공 (점수: 30)
# 또는
⚠️ [parseConfluenceHtml] 협업 테이블 감지 실패 - 키워드 탐지로 fallback

# Epic 조회 (있는 경우)
✅ Epic 조회 완료: "신규 무기 시스템"

# 키워드 탐지
✅ [detectPartsByKeywords] VFX 파트 감지: 이펙트, 파티클
✅ [detectPartsByKeywords] UI 파트 감지: UI, HUD
```

### Step 2: DoD 검토 시

```bash
# 기존 Task 필터링
⏭️ [generatePlannedTasks] Skipping existing task: [기획]
⏭️ [generatePlannedTasks] Skipping existing task: [서버]

# 키워드만 탐지된 파트
⚠️ [generateDoDParts] VFX 파트: 키워드 탐지만, 작업 항목 미생성 (협업 체크 필요)
```

---

## ✅ 검증 완료 체크리스트

- [ ] **Bug #1**: 다양한 협업 테이블 헤더 형식에서 정상 감지
- [ ] **Bug #2**: 일반적인 단어만으로 VFX 파트 생성 안 됨
- [ ] **Bug #3**: 기존 Task가 "생성 예정"에서 제외됨
- [ ] **Bug #4**: Epic 제목으로 티켓 제목 생성됨
- [ ] 통합 테스트 시나리오 통과
- [ ] 디버깅 로그 정상 출력

---

## 🚀 테스트 실행 방법

### 1. 백엔드 서버 재시작
```bash
# 터미널 1: 백엔드
cd "C:\MyProject\makeAticket"
npm run dev:api
```

### 2. 프론트엔드 재시작 (Vite config 변경 시)
```bash
# 터미널 2: 프론트엔드
cd "C:\MyProject\makeAticket"
npm run dev
```

### 3. 브라우저 개발자 도구 열기
- F12 → Console 탭
- 디버깅 로그 확인

### 4. DoD Automation 탭에서 테스트
1. Confluence URL 입력
2. DoD 추출 실행
3. Console 로그 확인
4. Step 2에서 결과 확인
5. Task 선택 후 생성
6. Jira에서 티켓 확인

---

**작성자**: Claude Code
**최종 수정**: 2026-02-27
