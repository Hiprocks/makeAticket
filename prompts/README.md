# AI Prompts Directory

이 디렉토리는 AI 기능에 사용되는 System Prompt와 User Prompt 템플릿을 관리합니다.

---

## 📁 디렉토리 구조

```
prompts/
├── system/                    # System Prompts (AI 역할 정의)
│   └── dod-analysis.txt      # DoD 자동 분석용 System Prompt
└── README.md                 # 이 문서
```

---

## 📝 System Prompt 작성 가이드

### 1️⃣ **파일 명명 규칙**
- 소문자 + 하이픈 사용 (예: `dod-analysis.txt`)
- 확장자: `.txt` (순수 텍스트)

### 2️⃣ **구조**
```
[역할 정의]
당신은 ... 전문가입니다.

[임무]
...을 수행하세요.

[규칙]
1. ...
2. ...

[출력 형식]
...
```

### 3️⃣ **주의사항**
- ✅ 명확하고 구체적으로 작성
- ✅ 예시 포함 (AI 이해도 향상)
- ✅ JSON 출력 시 형식 명시
- ❌ 동적 데이터 포함 금지 (User Prompt에서 처리)

---

## 🔧 Prompt 수정 방법

### **개발 환경**
1. `prompts/system/*.txt` 파일 수정
2. 서버 재시작 (자동 리로드)
3. 테스트

### **프로덕션 환경**
1. Git으로 변경 사항 커밋
2. 배포
3. 서버 재시작

---

## 📊 버전 관리

- **Git으로 관리**: 모든 프롬프트 파일은 Git에 커밋
- **변경 이력 추적**: `git log prompts/system/dod-analysis.txt`
- **롤백 가능**: 이전 버전으로 쉽게 복구

---

## 🧪 테스트

```bash
# Prompt 로드 테스트
node server/test-prompt-loader.js
```

---

**마지막 업데이트**: 2026-02-27
