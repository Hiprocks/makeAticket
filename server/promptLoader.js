import fs from 'node:fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Prompt Loader Service
 *
 * System Prompt를 외부 파일에서 로드하고 캐싱하는 서비스
 */
class PromptLoader {
  constructor(options = {}) {
    this.cacheEnabled = options.cacheEnabled !== false;
    this.promptsDir = options.promptsDir || path.join(__dirname, '..', 'prompts');
    this.cache = new Map();

    console.log(`[PromptLoader] Initialized with cache: ${this.cacheEnabled}`);
    console.log(`[PromptLoader] Prompts directory: ${this.promptsDir}`);
  }

  /**
   * System Prompt 로드
   * @param {string} name - Prompt 파일명 (확장자 제외)
   * @returns {Promise<string>} - Prompt 내용
   */
  async loadSystemPrompt(name) {
    const cacheKey = `system/${name}`;

    // 캐시 확인
    if (this.cacheEnabled && this.cache.has(cacheKey)) {
      console.log(`[PromptLoader] Cache hit: ${cacheKey}`);
      return this.cache.get(cacheKey);
    }

    // 파일 경로
    const filePath = path.join(this.promptsDir, 'system', `${name}.txt`);

    try {
      console.log(`[PromptLoader] Loading: ${filePath}`);
      const content = await fs.readFile(filePath, 'utf-8');

      // 캐시 저장
      if (this.cacheEnabled) {
        this.cache.set(cacheKey, content);
        console.log(`[PromptLoader] Cached: ${cacheKey}`);
      }

      return content;
    } catch (error) {
      console.error(`[PromptLoader] Failed to load: ${filePath}`);
      console.error(`[PromptLoader] Error:`, error.message);

      // Fallback: 하드코딩된 기본 프롬프트
      if (name === 'dod-analysis') {
        console.warn(`[PromptLoader] Using fallback prompt for: ${name}`);
        return this.getFallbackDoDPrompt();
      }

      throw new Error(`Prompt file not found: ${name}`);
    }
  }

  /**
   * 캐시 초기화
   */
  clearCache() {
    this.cache.clear();
    console.log('[PromptLoader] Cache cleared');
  }

  /**
   * 캐시 상태 확인
   */
  getCacheStats() {
    return {
      enabled: this.cacheEnabled,
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }

  /**
   * Fallback DoD 분석 프롬프트
   * (파일 로드 실패 시 사용)
   */
  getFallbackDoDPrompt() {
    return `당신은 게임 개발 프로젝트의 DoD(Definition of Done) 자동 생성 전문가입니다.

[임무]
Confluence 기획서를 분석하여 협업 파트와 각 파트의 작업 항목(DoD)을 추출하세요.

[분석 기준]
1. 협업 파트 판단:
   - 인게임 기획: 게임플레이 설계, 밸런스, 기능 명세
   - UI 파트: UI/HUD 제작, 메뉴, 팝업
   - 클라이언트 파트: 플레이 로직 구현
   - 서버 파트: Dedicated Server 로직, DB
   - VFX 파트: 이펙트 제작 (실제 리소스 제작 필요 시만)
   - 사운드 파트: 효과음, BGM 제작 (실제 리소스 제작 필요 시만)

2. 작업 항목 추출 규칙:
   - 각 파트당 3-5개 작업 항목
   - 구체적이고 실행 가능한 단위

[출력 형식]
JSON 형식으로만 반환하세요.
{
  "parts": [
    {
      "partName": "인게임 기획",
      "prefix": "[기획]",
      "tasks": [
        {
          "title": "작업 제목",
          "description": "상세 설명",
          "resource": "리소스",
          "dependency": "의존성"
        }
      ]
    }
  ]
}`;
  }
}

// Singleton 인스턴스
let instance = null;

/**
 * PromptLoader 싱글톤 인스턴스 반환
 */
export function getPromptLoader(options = {}) {
  if (!instance) {
    instance = new PromptLoader(options);
  }
  return instance;
}

export default PromptLoader;
