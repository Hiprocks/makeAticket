# DoD Extraction Bugs Fix Plan

**작성일**: 2026-02-27
**버전**: 1.0
**상태**: Plan

---

## 1. 개요

DoD 추출 기능에서 4가지 심각한 버그가 발견되어 긴급 수정이 필요합니다.

### 발견된 문제

1. **협업 테이블 감지 실패**: 협업 체크 테이블이 있는데 "없다"고 표시됨
2. **무관한 데이터 표시**: 기획서에 없는 작업(예: VFX)이 생성 예정으로 표시됨
3. **기존 Task 체크 실패**: Epic 하위의 기존 Task를 조회하여 말머리로 체크해야 하는데, 모든 Task가 신규로 표시됨
4. **제목 생성 오류**: Epic의 제목 대신 기획서 이름으로 티켓 제목이 생성됨

---

## 2. 근본 원인 분석

### Bug #1: 협업 테이블 감지 실패

**위치**: `src/services/dodExtractionService.ts` line 188-204
**현재 로직**:
```typescript
if (headerText.includes('협업') || headerText.includes('체크')) {
  // 테이블 파싱
}
```

**문제**:
- 헤더에 "협업" 또는 "체크"가 정확히 포함되어야만 인식
- 실제 Confluence 테이블은 다양한 형태:
  - "파트별 작업", "담당 파트", "직군별 체크"
  - "업무 분담", "협력 체크", "체크 리스트"
- 테이블이 여러 개 있을 때 첫 번째만 파싱

**근본 원인**: 협업 테이블 감지 조건이 너무 엄격함

---

### Bug #2: 무관한 데이터 표시 (VFX 등)

**위치**: `src/services/dodExtractionService.ts`
- Line 127-135: 키워드 맵 정의
- Line 237-260: `detectPartsByKeywords()`
- Line 502-654: `generateDefaultTasks()`

**현재 로직**:
```typescript
const KEYWORD_MAP = {
  'VFX 파트': ['이펙트', 'FX', '파티클', '연출', '비주얼', '화면 효과'],
  // ...
};

// 키워드 1개만 일치해도 탐지
if (regex.test(bodyText)) {
  foundKeywords.push(keyword);
}
```

**문제**:
- "비주얼", "화면 효과" 같은 일반적인 단어도 VFX로 오인
- 키워드 1개만 일치해도 파트로 인식
- 키워드 탐지만으로 작업 항목 자동 생성 (false positive)

**근본 원인**:
1. 키워드가 너무 광범위함
2. 협업 체크 없이 키워드만으로 Task 생성

---

### Bug #3: 기존 Task 체크 실패

**위치**: `src/services/jiraAutomationService.ts` line 218-282
**현재 로직**:
```typescript
export function generatePlannedTasks(
  parts: Array<...>,
  epicKey: string,
  featureName: string,
  // ...
): PlannedTask[] {
  // existingTasks와 비교하는 로직 없음
  for (const part of parts) {
    planned.push({
      prefix: part.prefix,
      title: `${part.prefix} ${featureName}`,
      // ...
    });
  }
  return planned;
}
```

**문제**:
- `checkDuplicateTasks()` 함수는 존재하지만 사용되지 않음 (line 179-209)
- `generatePlannedTasks()`에서 기존 Task와 비교하지 않음
- Step1에서 `queryEpic()`으로 기존 Task를 조회하지만, Step2에서 필터링하지 않음

**근본 원인**: 기존 Task 필터링 로직 누락

---

### Bug #4: 제목 생성 오류

**위치**: `src/services/jiraAutomationService.ts` line 273
**현재 로직**:
```typescript
title: `${part.prefix} ${featureName}`,
```

**문제**:
- `featureName`은 Confluence 페이지 제목
- 사용자 요구: Epic 제목을 기반으로 티켓 제목 생성
- `queryEpic()`에서 Epic summary를 가져오지만 사용하지 않음 (line 53)

**근본 원인**: 잘못된 제목 소스 사용

---

## 3. 수정 계획

### Fix #1: 협업 테이블 감지 개선

**목표**: 다양한 형태의 협업 테이블 감지

**접근 방법**:
1. **휴리스틱 기반 테이블 감지**:
   - 헤더에 "협업", "체크", "파트", "직군", "담당", "분담", "리스트" 중 하나 포함
   - 첫 번째 컬럼이 파트명/직군명 (PREFIX_MAP에 있는 이름)
   - 두 번째 컬럼이 체크 상태 (✅, O, X, -, 등)

2. **모든 테이블 검사**:
   - 첫 번째 테이블만이 아니라 모든 테이블 검사
   - 조건에 맞는 가장 큰 테이블 선택

3. **Fallback**:
   - 협업 테이블이 없으면 키워드 탐지만 수행

**코드 변경**:
- `parseConfluenceHtml()` 함수 수정
- 테이블 감지 로직 강화

---

### Fix #2: 키워드 탐지 엄격화

**목표**: False positive 최소화

**접근 방법**:
1. **키워드 매칭 기준 강화**:
   - 단일 키워드가 아니라 최소 2개 이상 키워드 일치 필요
   - 또는 핵심 키워드 (예: "VFX", "이펙트") 필수 일치

2. **협업 체크 우선**:
   - 협업 체크가 없으면 키워드 탐지만 하고 작업 항목 생성하지 않음
   - `status: 'review'` 상태로만 표시

3. **키워드 맵 정제**:
   - 너무 일반적인 키워드 제거 ("비주얼", "화면 효과" 등)
   - 구체적인 키워드만 유지

**코드 변경**:
- `KEYWORD_MAP` 수정
- `detectPartsByKeywords()` 함수 수정
- `generateDoDParts()` 로직 수정

---

### Fix #3: 기존 Task 필터링 추가

**목표**: 이미 생성된 Task는 "생성 예정"에서 제외

**접근 방법**:
1. **Step1에서 기존 Task 조회**:
   - `queryEpic()` 호출 (이미 구현됨)
   - `existingTasks` 배열 저장

2. **Step2에서 필터링**:
   - `generatePlannedTasks()`에 `existingTasks` 파라미터 추가
   - 기존 Task의 prefix와 비교
   - 중복되는 prefix는 제외

3. **UI 표시**:
   - 기존 Task는 "이미 생성됨" 섹션에 표시
   - 생성 예정 Task와 명확히 구분

**코드 변경**:
- `generatePlannedTasks()` 함수 시그니처 변경
- `existingTasks` 필터링 로직 추가
- `Step2_DoDReview.tsx` UI 수정

---

### Fix #4: Epic 제목 기반 티켓 제목 생성

**목표**: Epic 제목을 기반으로 티켓 제목 생성

**접근 방법**:
1. **Epic summary 활용**:
   - `queryEpic()` 결과의 `summary` 사용
   - Store에 `epicSummary` 저장

2. **티켓 제목 포맷**:
   - 현재: `[말머리] Confluence 페이지 제목`
   - 변경: `[말머리] Epic 제목`

3. **Fallback**:
   - Epic이 없으면 Confluence 페이지 제목 사용

**코드 변경**:
- `Step1_ConfluenceInput.tsx`: Epic summary 저장
- `useDoDStore.ts`: `epicSummary` state 추가
- `generatePlannedTasks()`: Epic summary 사용

---

## 4. 구현 우선순위

### Priority 1 (Critical): Bug #3, #4
- **이유**: 티켓 중복 생성 방지 및 제목 오류는 데이터 무결성에 직접 영향
- **순서**:
  1. Bug #3: 기존 Task 필터링
  2. Bug #4: Epic 제목 기반 생성

### Priority 2 (High): Bug #1
- **이유**: 협업 테이블 미감지 시 전체 워크플로우 실패
- **순서**: Bug #1 수정

### Priority 3 (Medium): Bug #2
- **이유**: False positive는 사용자가 수동으로 해제 가능
- **순서**: Bug #2 수정

---

## 5. 테스트 계획

### Test Case 1: 협업 테이블 감지
- **Given**: 다양한 형태의 협업 테이블 (헤더: "파트별 작업", "직군 체크" 등)
- **When**: DoD 추출 실행
- **Then**: 협업 체크 테이블 정상 파싱

### Test Case 2: 키워드 탐지 False Positive
- **Given**: "비주얼"이 1번만 언급된 기획서 (VFX 작업 없음)
- **When**: DoD 추출 실행
- **Then**: VFX 파트가 "생성 예정"에 표시되지 않음

### Test Case 3: 기존 Task 중복 체크
- **Given**: Epic에 이미 "[기획]" Task가 존재
- **When**: DoD 추출 실행
- **Then**: "[기획]" Task가 "이미 생성됨"으로 표시, "생성 예정"에 없음

### Test Case 4: Epic 제목 기반 티켓 제목
- **Given**: Epic 제목 "신규 무기 시스템", Confluence 제목 "무기 시스템 기획서"
- **When**: Task 생성
- **Then**: 생성된 티켓 제목 "[기획] 신규 무기 시스템"

---

## 6. 예상 소요 시간

- **분석 및 계획**: 30분 (완료)
- **구현**:
  - Bug #3: 30분
  - Bug #4: 20분
  - Bug #1: 40분
  - Bug #2: 30분
- **테스트**: 40분
- **문서화**: 20분

**총 예상**: 3시간 30분

---

## 7. 리스크 및 고려사항

### 리스크
1. **협업 테이블 형식 다양성**: 모든 케이스를 커버하기 어려울 수 있음
   - **완화**: 휴리스틱 + Fallback 전략
2. **키워드 탐지 정확도**: 너무 엄격하면 실제 파트를 놓칠 수 있음
   - **완화**: 사용자가 수동으로 추가 가능

### 고려사항
- **하위 호환성**: 기존 저장된 DoD 추출 결과에 영향 없음
- **성능**: 모든 테이블 검사로 인한 성능 저하 미미 (Confluence HTML은 일반적으로 작음)
- **사용자 피드백**: 테스트 후 추가 엣지 케이스 발견 가능

---

## 8. 완료 기준

- [ ] Bug #1 수정: 다양한 형태의 협업 테이블 감지 성공
- [ ] Bug #2 수정: False positive 최소화 (키워드 1개만으로 파트 생성 안 됨)
- [ ] Bug #3 수정: 기존 Task 필터링되어 "이미 생성됨" 표시
- [ ] Bug #4 수정: Epic 제목 기반 티켓 제목 생성
- [ ] 테스트 4개 모두 통과
- [ ] 문서 업데이트 (Overview.md, Mistake Note.md)

---

**Next**: Design 문서 작성 → 구현 → 테스트 → 보고
