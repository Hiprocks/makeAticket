# [Plan] System Prompt 외부 파일 관리

**Created**: 2026-02-27
**Status**: Planning → Design → Do
**Priority**: Medium

---

## 1. 개요

### 문제
- System Prompt가 server/index.js에 하드코딩되어 유지보수 어려움
- 프롬프트 수정 시 코드 수정 및 재배포 필요
- 향후 다양한 AI 기능 추가 시 관리 복잡도 증가

### 솔루션
System Prompt를 외부 파일로 분리하여 독립적으로 관리

---

## 2. 요구사항

### FR-1: Prompt 파일 구조
```
prompts/
├── system/
│   ├── dod-analysis.txt         # DoD 분석용 System Prompt
│   └── [future-features].txt
├── templates/
│   └── user-prompts.ts          # User Prompt 템플릿
└── README.md                    # Prompt 작성 가이드
```

### FR-2: Prompt 로딩 서비스
- 파일 시스템에서 프롬프트 로드
- 캐싱 메커니즘 (성능 최적화)
- Hot reload 지원 (개발 모드)

### FR-3: 버전 관리
- 프롬프트 파일은 Git으로 관리
- 변경 이력 추적 가능

### FR-4: 에러 처리
- 파일 없을 시 fallback
- 로드 실패 시 명확한 에러 메시지

---

## 3. 설계

### 3.1 파일 구조
```
prompts/
└── system/
    └── dod-analysis.txt
```

### 3.2 Prompt 로더 서비스
```javascript
// server/promptLoader.js
class PromptLoader {
  constructor(cacheEnabled = true) {}

  async loadSystemPrompt(name) {
    // 1. 캐시 확인
    // 2. 파일 읽기
    // 3. 캐시 저장
    // 4. 반환
  }

  clearCache() {}
}
```

### 3.3 API 통합
```javascript
// server/index.js
const promptLoader = new PromptLoader();
const systemPrompt = await promptLoader.loadSystemPrompt('dod-analysis');
```

---

## 4. 구현 우선순위

1. **Phase 1**: DoD 분석 프롬프트 분리 (1시간)
   - prompts/system/dod-analysis.txt 생성
   - promptLoader.js 구현
   - server/index.js 통합

2. **Phase 2**: 개발 편의성 개선 (선택, 30분)
   - Hot reload (개발 모드)
   - Prompt 검증 도구

---

## 5. 성공 기준

- [ ] System Prompt가 외부 파일로 분리됨
- [ ] AI 분석 기능 정상 작동
- [ ] 프롬프트 수정 시 코드 변경 불필요
- [ ] 서버 재시작 없이 프롬프트 업데이트 가능 (개발 모드)

---

**Next**: Design → Implementation → Test
