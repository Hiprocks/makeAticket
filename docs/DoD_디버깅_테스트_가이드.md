# DoD Automation 디버깅 테스트 가이드

**작성일**: 2026-02-27
**목적**: 티켓 생성 에러 원인 파악 및 해결

---

## ✅ 완료된 수정사항

### 1. 번호 선택 기능 제거 ✅
- **위치**: `Step2_DoDReview.tsx`
- **제거 내용**:
  - `numberInput` state
  - `handleNumberInputChange()` 함수
  - `handleApplyNumberInput()` 함수
  - "번호로 선택" UI 섹션

### 2. 디버깅 로그 추가 ✅
- **위치**: `server/index.js`
- **추가 내용**:
  - Task 생성 시작 로그
  - Description 원본 및 ADF 변환 후 로그
  - Fields 전송 데이터 로그
  - 마크다운 표 감지 및 변환 로그
  - 에러 스택 로그

---

## 🧪 테스트 절차

### **STEP 1: 백엔드 서버 재시작**

**중요**: 수정된 코드를 적용하려면 백엔드 서버를 재시작해야 합니다!

```bash
# 터미널 1: 백엔드 서버
cd "C:\MyProject\makeAticket"
npm run dev:api
```

### **STEP 2: 프론트엔드 확인**

프론트엔드는 Hot Reload로 자동 반영됩니다. 브라우저에서 새로고침만 하면 됩니다.

```bash
# 터미널 2: 프론트엔드 (이미 실행 중이면 생략)
cd "C:\MyProject\makeAticket"
npm run dev
```

### **STEP 3: 브라우저 테스트**

1. **http://localhost:5173 접속**

2. **DoD Automation 탭 클릭**

3. **Step 1: Confluence 페이지 입력**
   - Confluence URL 입력
   - DoD 추출 시작

4. **Step 2: DoD 검토 및 Task 선택**
   - ✅ **확인**: "번호로 선택" 섹션이 제거되었는지
   - ✅ **확인**: "모두 열기/닫기" 버튼이 정상 작동하는지
   - 1-2개 Task 선택
   - "다음 단계: 티켓 생성 (N개)" 클릭

5. **Step 3: Jira 티켓 생성**
   - 자동으로 생성 시작됨

### **STEP 4: 백엔드 서버 로그 확인**

터미널 1 (백엔드)에서 다음과 같은 로그가 출력됩니다:

```
=== Task 생성 시작 ===
Prefix: [VFX]
Title: [VFX] 건물 파괴 이펙트
Description (원본): ## 참조
Confluence: https://...

## DoD
| 작업 항목 | 상세 내용 | 리소스 | 의존성 |
|----------|----------|--------|--------|
| ...

[toAdf] 입력 텍스트 길이: 250
[toAdf] 마크다운 표 감지, 라인: 5
[toAdf] 표 라인 수: 5
[toAdf] ADF table 변환 성공
[toAdf] 생성된 content 노드 수: 4

Description (ADF 변환 후): {
  "type": "doc",
  "version": 1,
  "content": [
    {
      "type": "paragraph",
      "content": [
        {
          "type": "text",
          "text": "## 참조"
        }
      ]
    },
    ...
    {
      "type": "table",
      "attrs": { ... },
      "content": [ ... ]
    }
  ]
}

Fields 전송: { ... }

✅ 생성 성공: AEGIS-XXX
```

---

## 🐛 에러 발생 시 확인사항

### **에러 유형 1: JSON parse error**

```
❌ 오류 발생: Failed to execute 'json' on 'Response': Unexpected end of JSON input
```

**원인**:
- 서버에서 빈 응답을 반환
- Jira API에서 400/500 에러 발생

**확인 방법**:
1. 백엔드 로그에서 `❌ Task 생성 실패` 확인
2. Error stack 확인
3. Jira API 응답 확인

### **에러 유형 2: 마크다운 표 변환 실패**

```
[toAdf] 마크다운 표 감지, 라인: 5
[toAdf] 표 라인 수: 5
[toAdf] ADF table 변환 실패, code block으로 fallback
```

**원인**:
- 표 형식이 잘못됨
- 헤더/구분선/데이터 구조 문제

**해결**:
- code block으로 fallback되므로 티켓 생성은 성공
- Jira에서는 표 대신 코드 블록으로 표시됨

### **에러 유형 3: Jira API 400 Bad Request**

```
❌ Task 생성 실패: Jira update failed (400): ...
```

**원인**:
- 필수 필드 누락 (project, issuetype, summary)
- parentKey가 유효하지 않음
- description ADF 형식 오류

**확인 방법**:
1. `Fields 전송` 로그 확인
2. parentKey 존재 여부 확인
3. description ADF 구조 확인

### **에러 유형 4: Jira API 403 Forbidden**

```
❌ Task 생성 실패: Jira update failed (403): ...
```

**원인**:
- API Token 권한 부족
- Epic에 Task 추가 권한 없음

**해결**:
- Jira에서 권한 확인
- API Token 재발급

---

## 📊 예상 결과

### **성공 시**

**브라우저**:
```
✅ Task 생성 성공: 6개
```

**백엔드 로그**:
```
✅ 생성 성공: AEGIS-501
✅ 생성 성공: AEGIS-502
...
```

**Jira**:
- 티켓이 정상 생성됨
- DoD 표가 표 형식으로 렌더링됨

### **실패 시**

**브라우저**:
```
⚠️ Task 생성 실패: 2개
```

**백엔드 로그**:
```
❌ Task 생성 실패: Error: ...
Error stack: ...
```

---

## 🔧 추가 디버깅 팁

### 1. ADF 변환 테스트

백엔드 터미널에서 다음 코드를 실행하여 toAdf 함수를 테스트할 수 있습니다:

```javascript
// Node.js REPL에서 테스트
const testText = `## 참조
Confluence: https://example.com

## DoD
| 작업 항목 | 상세 내용 | 리소스 | 의존성 |
|----------|----------|--------|--------|
| 테스트 | 설명 | 리소스 | 의존성 |`;

// toAdf 함수 복사하여 실행
const result = toAdf(testText);
console.log(JSON.stringify(result, null, 2));
```

### 2. Jira API 직접 테스트

Postman이나 curl로 Jira API를 직접 호출하여 테스트:

```bash
curl -X POST "https://your-domain.atlassian.net/rest/api/3/issue" \
  -H "Authorization: Basic <base64-encoded-email:token>" \
  -H "Content-Type: application/json" \
  -d '{
    "fields": {
      "project": { "key": "PROJECT_KEY" },
      "issuetype": { "name": "Task" },
      "summary": "테스트 티켓",
      "description": {
        "type": "doc",
        "version": 1,
        "content": [
          {
            "type": "paragraph",
            "content": [
              { "type": "text", "text": "테스트 내용" }
            ]
          }
        ]
      }
    }
  }'
```

### 3. 로그 레벨 조정

더 자세한 로그가 필요하면 `server/index.js`에서 로그를 추가:

```javascript
// createIssue 함수 내부
console.log('Jira API Request:', {
  url: `${baseUrl}/rest/api/3/issue`,
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ fields }, null, 2)
});
```

---

## 📋 체크리스트

테스트 전 확인사항:

- [ ] 백엔드 서버 재시작 (`npm run dev:api`)
- [ ] 브라우저 새로고침
- [ ] 백엔드 터미널 로그 확인 준비
- [ ] Jira 자격증명 확인 (`.env` 파일)
- [ ] Epic Key가 유효한지 확인

테스트 중 확인사항:

- [ ] "번호로 선택" 섹션이 제거되었는지
- [ ] Task 선택 후 티켓 수가 정확한지
- [ ] 백엔드 로그에 `=== Task 생성 시작 ===` 출력되는지
- [ ] `[toAdf]` 로그가 출력되는지
- [ ] 마크다운 표가 감지되는지
- [ ] ADF table 변환이 성공하는지

---

## 🎯 다음 단계

1. **테스트 실행**: 위 절차대로 테스트
2. **로그 수집**: 백엔드 터미널 로그 전체 복사
3. **결과 보고**:
   - 성공 시: 어떤 로그가 출력되었는지
   - 실패 시: 에러 메시지 및 스택 트레이스
4. **추가 디버깅**: 필요시 로그를 분석하여 원인 파악

---

**작성자**: Claude Code
**최종 수정**: 2026-02-27
