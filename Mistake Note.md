# Mistake Note

이 문서는 개발 과정에서 발생한 실수와 해결 방법을 기록합니다.
실수를 통해 배우고, 같은 실수를 반복하지 않기 위한 참고 자료입니다.

> **🤖 자동 기록 규칙**: Claude Code는 다음 상황에서 이 문서에 자동으로 기록합니다:
> - 🐛 버그를 발견하고 수정했을 때
> - ⚠️ 잘못된 접근으로 시간을 낭비했을 때
> - 🔄 같은 실수가 반복될 가능성이 있을 때
> - 📝 기록은 **날짜 역순**으로 정렬 (최신 항목이 위로)

---

## 작성 가이드

각 항목은 다음 형식으로 작성합니다:

```markdown
### [날짜] 실수 제목

**문제**:
- 무엇이 잘못되었는지 설명

**원인**:
- 왜 발생했는지 분석

**해결 방법**:
- 어떻게 해결했는지

**교훈**:
- 앞으로 무엇을 주의해야 하는지

**관련 파일/코드**:
- 관련된 파일이나 코드 위치
```

---

## 기록

### [2026-02-19] LocalStorage → IndexedDB 마이그레이션

**문제**:
- 초기에 LocalStorage를 사용했으나, 5-10MB 용량 제한으로 인해 대량 데이터 저장 시 문제 발생
- 기록이 많아지면서 "QuotaExceededError" 발생

**원인**:
- LocalStorage는 도메인당 5-10MB 제한이 있음
- 티켓 생성 기록이 누적되면서 용량 초과

**해결 방법**:
- IndexedDB로 마이그레이션
- `src/lib/indexedDbStorage.ts` 구현
- Zustand persist middleware에서 custom storage 사용

**교훈**:
- 대량 데이터 저장이 예상되는 경우 처음부터 IndexedDB 사용 고려
- 데이터 볼륨 예측과 저장소 선택은 초기 설계 단계에서 중요

**관련 파일/코드**:
- [src/lib/indexedDbStorage.ts](src/lib/indexedDbStorage.ts)
- [src/store/useTicketStore.ts](src/store/useTicketStore.ts)
- [src/store/useHistoryStore.ts](src/store/useHistoryStore.ts)

---

### [예시 기록 - 삭제 가능]

**문제**:
- Epic 생성 시 Epic Name 필드가 누락되어 생성 실패

**원인**:
- Jira API의 Epic Name 필드 ID가 프로젝트마다 다름 (customfield_10015, customfield_10011 등)
- 하드코딩된 필드 ID 사용

**해결 방법**:
- `/rest/api/3/issue/createmeta` API를 호출하여 동적으로 필드 ID 감지
- `findEpicNameFieldId()` 함수 구현
- 필드 이름과 schema.custom 값으로 매칭

**교훈**:
- Jira의 커스텀 필드는 인스턴스/프로젝트마다 다를 수 있음
- 동적 감지 로직이 필요하거나, 설정에서 사용자가 입력하도록 해야 함

**관련 파일/코드**:
- [server/index.js:250-258](server/index.js) - `findEpicNameFieldId()`
- [server/index.js:204-238](server/index.js) - `getCreateMeta()`

---

**작성 규칙**:
1. 실수를 발견하면 즉시 기록
2. 날짜 역순으로 정렬 (최신 항목이 위로)
3. 구체적이고 명확하게 작성
4. 관련 코드는 파일 경로와 라인 번호 포함
5. 예시 항목은 실제 기록이 생기면 삭제
