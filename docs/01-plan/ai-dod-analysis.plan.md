# [Plan] AI 기반 DoD 자동 분석 및 생성

**Created**: 2026-02-27
**Status**: Planning
**Priority**: High

---

## 1. 개요

### 문제
- 현재: 협업 체크 테이블 + 키워드 매칭 (false positive 많음)
- 요구: **Confluence 기획서 내용과 맥락을 AI가 파악하여 DoD 자동 생성**

### 솔루션
Claude API를 통한 기획서 자동 분석 및 DoD 생성

---

## 2. 요구사항

### FR-1: AI 기반 기획서 분석
- Confluence 기획서 텍스트를 Claude API로 전송
- 기획서 내용 분석 및 맥락 파악
- 협업 파트 자동 판단

### FR-2: DoD 자동 생성
- 파트별 작업 항목 추출
- 작업 제목, 상세 내용, 리소스, 의존성 생성
- JSON 형식으로 반환

### FR-3: Fallback
- API 호출 실패 시 기존 키워드 탐지로 fallback
- 에러 처리 및 사용자 안내

---

## 3. 프롬프트 설계

### System Prompt
```
당신은 게임 개발 프로젝트의 DoD(Definition of Done) 자동 생성 전문가입니다.

[임무]
Confluence 기획서를 분석하여 협업 파트와 각 파트의 작업 항목(DoD)을 추출하세요.

[분석 기준]
1. 협업 파트 판단:
   - 기획: 게임플레이 설계, 밸런스, 기능 명세
   - UI: UI/HUD 제작, 메뉴, 팝업
   - 클라이언트: 플레이 로직 구현, 인게임 기능
   - 서버: Dedicated Server 로직, DB, 프로토콜
   - 아트-2D: 캐릭터/배경 원화, 컨셉 아트
   - 아트-3D: 3D 모델링, 리깅
   - 애니메이션: 캐릭터/오브젝트 애니메이션
   - VFX: 이펙트, 파티클
   - 사운드: 효과음, BGM

2. 작업 항목 추출 규칙:
   - 각 파트당 3-5개 작업 항목
   - 구체적이고 실행 가능한 단위
   - 언더스코어(_) 절대 금지
   - 기능 단위로만 서술 (변수명/계산식 노출 금지)

3. 주의사항:
   - "사운드 볼륨 조절" 언급 ≠ 사운드팀 작업 (단순 기능 설명일 수 있음)
   - 실제 리소스 제작/구현이 필요한 경우만 파트 추가
   - 맥락을 고려하여 판단

[출력 형식]
JSON 형식으로 다음 구조를 반환하세요:
{
  "parts": [
    {
      "partName": "인게임 기획",
      "prefix": "[기획]",
      "tasks": [
        {
          "title": "작업 제목",
          "description": "상세 설명",
          "resource": "리소스 (예: 기획팀 1명)",
          "dependency": "의존성 (예: -)"
        }
      ]
    }
  ]
}
```

### User Prompt Template
```
다음 Confluence 기획서를 분석하여 DoD를 생성하세요.

[기획서 제목]
{title}

[기획서 내용]
{content}

[출력 요청]
위 기획서를 분석하여 협업 파트와 각 파트의 DoD 작업 항목을 JSON 형식으로 출력하세요.
```

---

## 4. 구현 상세

### 4.1 백엔드 API

#### Endpoint: `/api/confluence/analyze-dod`
**Method**: POST
**Request**:
```json
{
  "title": "옵션 기획서",
  "content": "기획서 전체 텍스트..."
}
```

**Response**:
```json
{
  "parts": [
    {
      "partName": "인게임 기획",
      "prefix": "[기획]",
      "tasks": [...]
    }
  ]
}
```

#### 환경 변수
```env
# Claude API (Anthropic)
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022
```

### 4.2 프론트엔드 통합

#### Step1_ConfluenceInput.tsx
```tsx
// "AI 분석" 버튼 추가
<Button onClick={handleAIAnalysis}>
  🤖 AI로 DoD 자동 분석
</Button>

// API 호출
const analyzeWithAI = async (title, content) => {
  const response = await fetch('/api/confluence/analyze-dod', {
    method: 'POST',
    body: JSON.stringify({ title, content })
  });
  return await response.json();
};
```

---

## 5. Fallback 전략

### AI 분석 실패 시
1. 협업 체크 테이블 파싱 시도
2. 키워드 탐지 (엄격한 기준)
3. 사용자에게 수동 선택 안내

### 사용자 선택 옵션
- ✅ "AI 분석" (권장)
- ⚠️ "수동 분석" (협업 체크 + 키워드)

---

## 6. 성공 기준

- [ ] AI가 기획서를 읽고 협업 파트 정확히 판단
- [ ] False positive 최소화 (VFX, 사운드 오탐지 방지)
- [ ] DoD 작업 항목이 실행 가능한 수준으로 생성
- [ ] 옵션 기획서 테스트 통과 (VFX/사운드 제외됨)

---

**Next**: 구현 → 테스트 → 사용자 피드백
