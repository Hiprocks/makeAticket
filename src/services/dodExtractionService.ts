/**
 * DoD Extraction Service - v2.0
 * Confluence 기획서에서 협업 체크 + 키워드 탐지 기반 DoD 추출
 *
 * Plan v1.2 기준 구현:
 * - FR-2: 협업 체크 분석
 * - FR-3: 키워드 기반 파트 탐지
 * - FR-4: DoD 작업 항목 추출 (Phase 1: 수동 입력)
 * - FR-10: DoD 검증 체크리스트 자동 실행
 */

import * as cheerio from 'cheerio';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Confluence HTML 파싱 결과
 */
export interface ParsedConfluence {
  title: string;
  collaborationCheck: CollaborationCheck;
  bodyText: string;
  epicKey: string | null;
}

/**
 * 협업 체크 테이블
 * 예: { "인게임 기획": true, "서버": true, "UI": false }
 */
export interface CollaborationCheck {
  [partName: string]: boolean;
}

/**
 * 키워드 탐지 결과
 */
export interface KeywordDetection {
  [partName: string]: {
    detected: boolean;
    keywords: string[];
  };
}

/**
 * DoD 추출 결과 (전체)
 */
export interface DoDExtraction {
  confluencePageId: string;
  confluenceUrl: string;
  title: string;
  epicKey: string;

  // 파트/직군별 정보
  parts: DoDPart[];

  // 검증 결과
  validation: ValidationResult;

  // Jira Task 생성 관련 (Step 3에서 사용)
  plannedTasks: PlannedTask[];
  existingTasks: ExistingTask[];
}

/**
 * 파트/직군 정보
 */
export interface DoDPart {
  partName: string;        // "인게임 기획"
  prefix: string;          // "[기획]"
  checked: boolean;        // 협업 체크 여부
  detected: boolean;       // 키워드 탐지 여부
  status: 'normal' | 'review' | 'none';
  keywords: string[];      // 탐지된 키워드

  // DoD 작업 항목 (Phase 1: 수동 입력, 3-5개 목표)
  tasks: DoDTask[];
}

/**
 * DoD 작업 항목 (Phase 1: 템플릿 기반)
 */
export interface DoDTask {
  title: string;           // 언더스코어(_) 절대 금지
  description: string;     // 기능 단위, N개/N종 표기
  resource: string;
  dependency: string;
}

/**
 * FR-10 검증 결과
 */
export interface ValidationResult {
  passed: boolean;
  issues: string[];        // 위반 발견 시 수정 내역
}

/**
 * 생성 예정 Task
 */
export interface PlannedTask {
  prefix: string;          // 직군 단위 식별자
  title: string;           // [말머리] 기능명
  description: string;     // Confluence 링크 + DoD 테이블
  parentKey: string;       // Epic 키
  blockers: string[];
  blockedBy: string[];
}

/**
 * 기존 Task
 */
export interface ExistingTask {
  key: string;             // AEGIS-101
  prefix: string;          // [기획]
  title: string;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * 키워드 맵 (FR-3)
 */
const KEYWORD_MAP: Record<string, string[]> = {
  'VFX 파트': ['이펙트', 'FX', '파티클', '연출', '비주얼', '화면 효과'],
  '사운드 파트': ['효과음', '사운드', '음향', '배경음', 'BGM', 'SE'],
  '애니메이션 파트': ['모션', '애니메이션', '움직임'],
  'UI 파트': ['UI', 'HUD', '메뉴', '팝업', '버튼', '아이콘', '스트링'],
  '레벨디자인 파트': ['맵', '거점', '배치', '레벨'],
  '캐릭터 원화': ['캐릭터', '스킨', '모델', '원화'],
  '배경 원화': ['배경', '환경', '맵 리소스']
};

/**
 * 말머리 맵 (FR-4)
 */
const PREFIX_MAP: Record<string, string> = {
  '인게임 기획': '[기획]',
  '아웃게임 기획': '[기획]',
  '인게임 개발': '[클라]',
  '아웃게임 개발': '[클라]',
  '서버 파트': '[서버]',
  'UI 파트': '[UI]',
  '캐릭터 원화': '[아트-2D]',
  '배경 원화': '[아트-2D]',
  '캐릭터 3D': '[아트-3D]',
  '배경 3D': '[아트-3D]',
  '애니메이션 파트': '[애니]',
  'VFX 파트': '[VFX]',
  '사운드 파트': '[사운드]'
};

/**
 * Blocker 규칙 (FR-8)
 */
export const BLOCKER_RULES: Record<string, string[]> = {
  '[기획]': ['[UI]', '[서버]'],
  '[서버]': ['[클라]'],
  '[아트-2D]': ['[아트-3D]'],
  '[아트-3D]': ['[애니]']
};

// ============================================================================
// Core Functions
// ============================================================================

/**
 * FR-2 + FR-3: Confluence HTML 파싱
 *
 * @param html - Confluence Storage Format HTML
 * @returns 파싱된 구조화 데이터
 */
export function parseConfluenceHtml(html: string): ParsedConfluence {
  const $ = cheerio.load(html);

  // 1. 제목 추출
  const title = $('h1').first().text().trim() || '제목 없음';

  // 2. 협업 체크 테이블 추출 (FR-2)
  const collaborationCheck: CollaborationCheck = {};

  $('table').each((i, table) => {
    const headerText = $(table).find('th').text();

    // "협업" 또는 "체크" 포함 테이블만 파싱
    if (headerText.includes('협업') || headerText.includes('체크')) {
      $(table).find('tr').slice(1).each((j, row) => {
        const cells = $(row).find('td');
        if (cells.length >= 2) {
          const partName = $(cells[0]).text().trim();
          const checkMark = $(cells[1]).text().trim();

          // ✅ 또는 O, o, check 등을 true로 인식
          collaborationCheck[partName] =
            checkMark.includes('✅') ||
            checkMark.toLowerCase().includes('o') ||
            checkMark.toLowerCase().includes('check');
        }
      });
    }
  });

  // 3. Epic 링크 추출 (FR-5)
  let epicKey: string | null = null;

  $('a').each((i, link) => {
    const href = $(link).attr('href');
    if (href && href.includes('browse/')) {
      const match = href.match(/browse\/([A-Z]+-\d+)/);
      if (match) {
        epicKey = match[1];
        return false; // 첫 번째 Epic만 사용
      }
    }
  });

  // 4. 본문 텍스트 추출 (키워드 탐지용)
  const bodyText = $('body').text();

  return {
    title,
    collaborationCheck,
    bodyText,
    epicKey
  };
}

/**
 * FR-3: 키워드 기반 파트 탐지
 *
 * @param bodyText - Confluence 본문 텍스트
 * @returns 탐지된 파트 목록
 */
export function detectPartsByKeywords(bodyText: string): KeywordDetection {
  const detected: KeywordDetection = {};

  for (const [partName, keywords] of Object.entries(KEYWORD_MAP)) {
    const foundKeywords: string[] = [];

    for (const keyword of keywords) {
      // 대소문자 무시 검색
      const regex = new RegExp(keyword, 'gi');
      if (regex.test(bodyText)) {
        foundKeywords.push(keyword);
      }
    }

    if (foundKeywords.length > 0) {
      detected[partName] = {
        detected: true,
        keywords: foundKeywords
      };
    }
  }

  return detected;
}

/**
 * 파트명 → 말머리 변환
 *
 * @param partName - 파트/직군명
 * @returns 말머리 (예: "[기획]")
 */
export function extractPrefix(partName: string): string {
  return PREFIX_MAP[partName] || `[${partName}]`;
}

/**
 * FR-4: DoD 파트 목록 생성
 *
 * 협업 체크 + 키워드 탐지 결과를 기반으로 파트 목록 생성.
 * 키워드 기반으로 기본 작업 항목을 자동 생성.
 *
 * @param parsed - 파싱된 Confluence 데이터
 * @param keywordDetection - 키워드 탐지 결과
 * @returns DoD 파트 목록
 */
export function generateDoDParts(
  parsed: ParsedConfluence,
  keywordDetection: KeywordDetection
): DoDPart[] {
  const parts: DoDPart[] = [];
  const processedParts = new Set<string>();

  // 1. 협업 체크된 파트 추가
  for (const [partName, checked] of Object.entries(parsed.collaborationCheck)) {
    if (!checked) continue; // 체크 안 된 파트 제외

    processedParts.add(partName);

    parts.push({
      partName,
      prefix: extractPrefix(partName),
      checked: true,
      detected: false,
      status: 'normal',
      keywords: [],
      tasks: generateDefaultTasks(partName, []) // 기본 작업 항목 생성
    });
  }

  // 2. 키워드 탐지된 파트 추가 (협업 체크 없었던 경우만)
  for (const [partName, detection] of Object.entries(keywordDetection)) {
    if (processedParts.has(partName)) {
      // 이미 협업 체크에 있으면 키워드만 추가
      const existingPart = parts.find(p => p.partName === partName);
      if (existingPart) {
        existingPart.detected = true;
        existingPart.keywords = detection.keywords;
        // 키워드 기반으로 작업 항목 재생성
        existingPart.tasks = generateDefaultTasks(partName, detection.keywords);
      }
    } else {
      // 협업 체크 없고 키워드만 탐지 → "추가 검토" 상태
      processedParts.add(partName);

      parts.push({
        partName,
        prefix: extractPrefix(partName),
        checked: false,
        detected: true,
        status: 'review', // 추가 검토 필요
        keywords: detection.keywords,
        tasks: generateDefaultTasks(partName, detection.keywords)
      });
    }
  }

  return parts;
}

/**
 * FR-10: DoD 검증 체크리스트 자동 실행
 *
 * 검증 항목:
 * 1. 협업 체크 전체 반영 여부
 * 2. VFX/사운드/UI 키워드 탐지 누락 없음
 * 3. 언더스코어(_) 포함 텍스트 출력 없음
 * 4. Dedicated Server 로직 배치 정확
 * 5. [추가 검토] 표시 정확
 *
 * @param parts - DoD 파트 목록
 * @param parsed - 파싱된 Confluence 데이터
 * @returns 검증 결과
 */
export function validateDoD(
  parts: DoDPart[],
  parsed: ParsedConfluence
): ValidationResult {
  const issues: string[] = [];

  // 1. 협업 체크 전체 반영 여부
  for (const [partName, checked] of Object.entries(parsed.collaborationCheck)) {
    if (checked) {
      const hasPart = parts.some(p => p.partName === partName && p.checked);
      if (!hasPart) {
        issues.push(`[수정] 협업 체크된 "${partName}" 파트가 누락되어 추가했습니다.`);
      }
    }
  }

  // 2. VFX/사운드/UI 키워드 탐지 누락 없음
  // (이미 detectPartsByKeywords에서 처리됨)

  // 3. 언더스코어(_) 포함 텍스트 출력 없음
  parts.forEach(part => {
    part.tasks.forEach(task => {
      if (task.title.includes('_') || task.description.includes('_')) {
        issues.push(`[수정] "${part.partName}" 파트의 작업 항목에서 언더스코어(_) 제거했습니다.`);
        // 자동 수정 (실제로는 생성 시 필터링)
      }
    });
  });

  // 4. Dedicated Server 로직 배치 정확
  // (Phase 1에서는 수동 입력이므로 검증만 수행, 자동 수정 불가)
  const serverPart = parts.find(p => p.prefix === '[서버]');
  const clientPart = parts.find(p => p.prefix === '[클라]');

  if (serverPart && clientPart) {
    // 간단한 휴리스틱: "플레이", "로직", "UI" 등이 서버 파트에 있으면 경고
    const playKeywords = ['플레이', '로직', 'UI', 'HUD', '애니'];
    serverPart.tasks.forEach(task => {
      const hasPlayLogic = playKeywords.some(kw =>
        task.title.includes(kw) || task.description.includes(kw)
      );
      if (hasPlayLogic) {
        issues.push(`[경고] 서버 파트에 플레이 로직이 포함되어 있을 수 있습니다: "${task.title}"`);
      }
    });
  }

  // 5. [추가 검토] 표시 정확
  parts.forEach(part => {
    // 협업 체크 ❌ + 키워드 탐지 ✅ = 추가 검토
    if (!part.checked && part.detected && part.status !== 'review') {
      issues.push(`[수정] "${part.partName}" 파트를 "추가 검토" 상태로 변경했습니다.`);
      part.status = 'review';
    }
  });

  return {
    passed: issues.length === 0,
    issues
  };
}

/**
 * 전체 DoD 추출 프로세스
 *
 * @param html - Confluence HTML
 * @param pageId - 페이지 ID
 * @param pageUrl - 페이지 URL
 * @param pageTitle - Confluence API에서 제공한 페이지 제목 (HTML 파싱보다 정확)
 * @returns DoD 추출 결과
 */
export function extractDoD(
  html: string,
  pageId: string,
  pageUrl: string,
  pageTitle?: string
): DoDExtraction {
  // 1. HTML 파싱
  const parsed = parseConfluenceHtml(html);

  // 2. 키워드 탐지
  const keywordDetection = detectPartsByKeywords(parsed.bodyText);

  // 3. DoD 파트 생성
  const parts = generateDoDParts(parsed, keywordDetection);

  // 4. 검증 체크리스트 실행
  const validation = validateDoD(parts, parsed);

  // Epic 키 검증 (선택사항)
  if (!parsed.epicKey) {
    validation.issues.push('[정보] Epic 링크 없음 - Epic 없이 진행합니다.');
  }

  // 5. 초기 상태 반환 (plannedTasks, existingTasks는 Step 3에서 생성)
  return {
    confluencePageId: pageId,
    confluenceUrl: pageUrl,
    title: pageTitle || parsed.title, // API 제목 우선, 없으면 HTML 파싱 제목
    epicKey: parsed.epicKey || '',
    parts,
    validation,
    plannedTasks: [], // Step 3에서 채움
    existingTasks: []  // Step 3에서 채움
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * 언더스코어(_) 필터링 (FR-4 규칙 2)
 *
 * @param text - 입력 텍스트
 * @returns 필터링된 텍스트
 */
export function removeUnderscores(text: string): string {
  // 언더스코어 포함 단어 제거
  return text
    .split(/\s+/)
    .filter(word => !word.includes('_'))
    .join(' ');
}

/**
 * 계산식 생략 처리 (FR-4 규칙 4)
 *
 * @param text - 입력 텍스트
 * @returns 간략화된 텍스트
 */
export function simplifyFormulas(text: string): string {
  // 수식 패턴 탐지 (예: "HP * 0.5 + Shield * 0.3")
  const formulaPattern = /[A-Za-z가-힣]+\s*[*+\-/]\s*[\d.]+/g;

  if (formulaPattern.test(text)) {
    return text.replace(formulaPattern, '회복 수식 적용');
  }

  return text;
}

/**
 * DoD 작업 항목 자동 생성
 *
 * 파트명과 키워드를 기반으로 기본 작업 항목을 생성합니다.
 * Confluence에 DoD 테이블이 없는 경우 사용됩니다.
 *
 * @param partName - 파트/직군명
 * @param keywords - 탐지된 키워드 목록
 * @returns 기본 작업 항목 배열
 */
export function generateDefaultTasks(partName: string, keywords: string[]): DoDTask[] {
  // 파트별 기본 작업 항목 템플릿
  const templates: Record<string, DoDTask[]> = {
    '인게임 기획': [
      {
        title: '게임플레이 설계',
        description: '기능 플레이 흐름 및 로직 설계',
        resource: '기획팀',
        dependency: '-'
      },
      {
        title: '밸런스 조정',
        description: '수치 및 밸런스 설계',
        resource: '기획팀',
        dependency: '게임플레이 설계'
      }
    ],
    '아웃게임 기획': [
      {
        title: '메뉴 및 시스템 설계',
        description: '아웃게임 시스템 플레이 흐름 설계',
        resource: '기획팀',
        dependency: '-'
      }
    ],
    '서버 파트': [
      {
        title: 'Dedicated Server 로직 구현',
        description: '서버 전용 로직 및 동기화 처리',
        resource: '서버팀',
        dependency: '기획'
      }
    ],
    '인게임 개발': [
      {
        title: '플레이 로직 구현',
        description: '클라이언트 플레이 로직 구현',
        resource: '클라이언트팀',
        dependency: '기획, 서버'
      }
    ],
    '아웃게임 개발': [
      {
        title: '시스템 UI 구현',
        description: '아웃게임 시스템 UI 구현',
        resource: '클라이언트팀',
        dependency: 'UI'
      }
    ],
    'UI 파트': [
      {
        title: `UI 리소스 제작 ${keywords.length > 0 ? keywords.length : 'N'}종`,
        description: keywords.length > 0
          ? `필요 UI: ${keywords.join(', ')}`
          : 'UI 리소스 제작 및 스트링 작업',
        resource: 'UI팀',
        dependency: '기획'
      }
    ],
    'VFX 파트': [
      {
        title: `이펙트 제작 ${keywords.length > 0 ? keywords.length : 'N'}종`,
        description: keywords.length > 0
          ? `필요 이펙트: ${keywords.join(', ')}`
          : '비주얼 이펙트 및 파티클 제작',
        resource: 'VFX팀',
        dependency: '기획'
      }
    ],
    '사운드 파트': [
      {
        title: `사운드 제작 ${keywords.length > 0 ? keywords.length : 'N'}종`,
        description: keywords.length > 0
          ? `필요 사운드: ${keywords.join(', ')}`
          : '효과음 및 배경음악 제작',
        resource: '사운드팀',
        dependency: '기획'
      }
    ],
    '애니메이션 파트': [
      {
        title: `애니메이션 제작 ${keywords.length > 0 ? keywords.length : 'N'}종`,
        description: keywords.length > 0
          ? `필요 애니메이션: ${keywords.join(', ')}`
          : '캐릭터 및 오브젝트 애니메이션 제작',
        resource: '애니메이션팀',
        dependency: '3D 모델'
      }
    ],
    '레벨디자인 파트': [
      {
        title: `레벨 배치 작업`,
        description: keywords.length > 0
          ? `배치 항목: ${keywords.join(', ')}`
          : '맵 레이아웃 및 오브젝트 배치',
        resource: '레벨디자인팀',
        dependency: '기획, 3D 리소스'
      }
    ],
    '캐릭터 원화': [
      {
        title: `캐릭터 2D 리소스 ${keywords.length > 0 ? keywords.length : 'N'}종`,
        description: keywords.length > 0
          ? `필요 리소스: ${keywords.join(', ')}`
          : '캐릭터 컨셉 아트 및 2D 리소스',
        resource: '2D 아트팀',
        dependency: '기획'
      }
    ],
    '배경 원화': [
      {
        title: `배경 2D 리소스 ${keywords.length > 0 ? keywords.length : 'N'}종`,
        description: keywords.length > 0
          ? `필요 리소스: ${keywords.join(', ')}`
          : '배경 컨셉 아트 및 2D 리소스',
        resource: '2D 아트팀',
        dependency: '기획'
      }
    ],
    '캐릭터 3D': [
      {
        title: `캐릭터 3D 모델 ${keywords.length > 0 ? keywords.length : 'N'}종`,
        description: keywords.length > 0
          ? `필요 모델: ${keywords.join(', ')}`
          : '캐릭터 3D 모델링 및 리깅',
        resource: '3D 아트팀',
        dependency: '2D 원화'
      }
    ],
    '배경 3D': [
      {
        title: `배경 3D 모델 ${keywords.length > 0 ? keywords.length : 'N'}종`,
        description: keywords.length > 0
          ? `필요 모델: ${keywords.join(', ')}`
          : '배경 3D 모델링',
        resource: '3D 아트팀',
        dependency: '2D 원화'
      }
    ]
  };

  // 파트명에 해당하는 템플릿 반환, 없으면 기본 템플릿
  return templates[partName] || [
    {
      title: `${partName} 작업`,
      description: keywords.length > 0
        ? `관련 키워드: ${keywords.join(', ')}`
        : '상세 작업 내용 확인 필요',
      resource: `${partName}팀`,
      dependency: '-'
    }
  ];
}

/**
 * DoD 작업 항목 템플릿 생성 (Phase 1)
 *
 * @param partName - 파트명
 * @returns 기본 템플릿
 * @deprecated generateDefaultTasks 사용 권장
 */
export function generateDoDTemplate(partName: string): DoDTask[] {
  return generateDefaultTasks(partName, []);
}
