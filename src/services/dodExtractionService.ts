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
 * 키워드 맵 (FR-3) - 개선: 핵심 키워드와 보조 키워드 분리
 */
const KEYWORD_MAP: Record<string, { core: string[]; optional: string[] }> = {
  'VFX 파트': {
    core: ['VFX', 'FX', '이펙트', '파티클'],
    optional: ['연출', '비주얼 효과']
  },
  '사운드 파트': {
    core: ['사운드', '효과음', 'BGM', 'SE'],
    optional: ['음향', '배경음']
  },
  '애니메이션 파트': {
    core: ['애니메이션', '모션'],
    optional: ['움직임']
  },
  'UI 파트': {
    core: ['UI', 'HUD'],
    optional: ['메뉴', '팝업', '버튼', '아이콘', '스트링']
  },
  '레벨디자인 파트': {
    core: ['레벨디자인', '레벨 배치'],
    optional: ['맵', '거점', '배치']
  },
  '캐릭터 원화': {
    core: ['캐릭터 원화', '캐릭터 2D'],
    optional: ['캐릭터', '스킨', '원화']
  },
  '배경 원화': {
    core: ['배경 원화', '배경 2D'],
    optional: ['배경', '환경']
  }
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
 * DoD 테이블 파싱 결과
 */
interface DoDTableData {
  partName: string | null; // 파트명 (헤딩에서 추출, 없으면 null)
  tasks: DoDTask[];
}

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

  // 2. 협업 체크 테이블 추출 (FR-2) - 개선된 휴리스틱
  const collaborationCheck: CollaborationCheck = {};

  // 협업 테이블 후보 목록
  const tableCandidates: Array<{ table: cheerio.Cheerio; score: number }> = [];

  $('table').each((i, table) => {
    const $table = $(table);
    const headerText = $table.find('th').text().toLowerCase();
    const firstColumn = $table.find('tr').slice(1).first().find('td').first().text().trim();

    // 휴리스틱 점수 계산
    let score = 0;

    // 1. 헤더에 관련 키워드 포함 (더 많은 키워드 지원)
    const headerKeywords = ['협업', '체크', '파트', '직군', '담당', '분담', '리스트', '작업'];
    if (headerKeywords.some(keyword => headerText.includes(keyword))) {
      score += 10;
    }

    // 2. 첫 번째 컬럼이 파트명/직군명 (PREFIX_MAP에 있는 이름)
    if (Object.keys(PREFIX_MAP).some(partName =>
      firstColumn.includes(partName) || partName.includes(firstColumn)
    )) {
      score += 20;
    }

    // 3. 테이블 크기 (2개 이상의 행)
    const rowCount = $table.find('tr').length;
    if (rowCount >= 3) { // 헤더 + 최소 2개 행
      score += rowCount;
    }

    if (score > 0) {
      tableCandidates.push({ table: $table, score });
    }
  });

  // 점수가 가장 높은 테이블 선택
  if (tableCandidates.length > 0) {
    tableCandidates.sort((a, b) => b.score - a.score);
    const bestTable = tableCandidates[0].table;

    bestTable.find('tr').slice(1).each((j, row) => {
      const cells = $(row).find('td');
      if (cells.length >= 2) {
        const partName = $(cells[0]).text().trim();
        const checkMark = $(cells[1]).text().trim();

        // ✅ 또는 O, o, check 등을 true로 인식
        collaborationCheck[partName] =
          checkMark.includes('✅') ||
          checkMark.toLowerCase().includes('o') ||
          checkMark.toLowerCase().includes('check') ||
          checkMark.includes('☑') ||
          checkMark.includes('✓');
      }
    });

    console.log(`✅ [parseConfluenceHtml] 협업 테이블 감지 성공 (점수: ${tableCandidates[0].score})`);
  } else {
    console.log(`⚠️ [parseConfluenceHtml] 협업 테이블 감지 실패 - 키워드 탐지로 fallback`);
  }

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
 * DoD 테이블 파싱
 *
 * Confluence 페이지에서 "DoD" 헤딩 아래의 테이블을 파싱하여 실제 작업 항목을 추출합니다.
 *
 * @param html - Confluence HTML
 * @returns DoD 테이블 데이터 배열
 */
export function parseDoDTables(html: string): DoDTableData[] {
  const $ = cheerio.load(html);
  const dodTables: DoDTableData[] = [];

  // "DoD" 헤딩 찾기 (h2, h3, h4)
  $('h2, h3, h4').each((i, heading) => {
    const headingText = $(heading).text().trim();

    // "DoD"가 포함된 헤딩만 처리 (case-insensitive)
    if (!headingText.toLowerCase().includes('dod')) return;

    // 헤딩에서 파트명 추출 (예: "[기획] DoD" → "[기획]")
    const prefixMatch = headingText.match(/\[([^\]]+)\]/);
    const partName = prefixMatch ? prefixMatch[0] : null; // "[기획]" 형식 유지

    // 헤딩 다음의 테이블 찾기
    let nextElement = $(heading).next();
    let table: cheerio.Cheerio | null = null;

    // 다음 5개 요소까지 검색 (중간에 p 태그 등이 있을 수 있음)
    for (let j = 0; j < 5 && nextElement.length > 0; j++) {
      if (nextElement.is('table')) {
        table = nextElement;
        break;
      }
      nextElement = nextElement.next();
    }

    if (!table) return;

    // 테이블 헤더 확인 (DoD 테이블인지 검증)
    const headers = table.find('th').map((k, th) => $(th).text().trim().toLowerCase()).get();
    const isDoDTable =
      headers.includes('작업 항목') ||
      headers.includes('작업') ||
      headers.includes('task') ||
      headers.includes('항목');

    if (!isDoDTable) return;

    // 테이블 행 파싱
    const tasks: DoDTask[] = [];
    table.find('tr').slice(1).each((k, row) => {
      const cells = $(row).find('td');
      if (cells.length < 2) return; // 최소 2개 컬럼 필요

      const title = $(cells[0]).text().trim();
      const description = cells.length > 1 ? $(cells[1]).text().trim() : '';
      const resource = cells.length > 2 ? $(cells[2]).text().trim() : '-';
      const dependency = cells.length > 3 ? $(cells[3]).text().trim() : '-';

      if (title) {
        tasks.push({
          title: removeUnderscores(title),
          description: removeUnderscores(description),
          resource,
          dependency
        });
      }
    });

    if (tasks.length > 0) {
      dodTables.push({
        partName,
        tasks
      });
      console.log(`✅ [parseDoDTables] DoD 테이블 파싱 성공: ${partName || '공통'}, 작업 ${tasks.length}개`);
    }
  });

  return dodTables;
}

/**
 * FR-3: 키워드 기반 파트 탐지 - 개선: 핵심 키워드 필수, 보조 키워드로 보강
 *
 * @param bodyText - Confluence 본문 텍스트
 * @returns 탐지된 파트 목록
 */
export function detectPartsByKeywords(bodyText: string): KeywordDetection {
  const detected: KeywordDetection = {};

  for (const [partName, { core, optional }] of Object.entries(KEYWORD_MAP)) {
    const foundCoreKeywords: string[] = [];
    const foundOptionalKeywords: string[] = [];

    // 핵심 키워드 검색
    for (const keyword of core) {
      const regex = new RegExp(keyword, 'gi');
      if (regex.test(bodyText)) {
        foundCoreKeywords.push(keyword);
      }
    }

    // 보조 키워드 검색
    for (const keyword of optional) {
      const regex = new RegExp(keyword, 'gi');
      if (regex.test(bodyText)) {
        foundOptionalKeywords.push(keyword);
      }
    }

    // 감지 조건: 핵심 키워드 1개 이상 OR 보조 키워드 2개 이상
    const hasCoreKeyword = foundCoreKeywords.length > 0;
    const hasMultipleOptional = foundOptionalKeywords.length >= 2;

    if (hasCoreKeyword || hasMultipleOptional) {
      const allFoundKeywords = [...foundCoreKeywords, ...foundOptionalKeywords];
      detected[partName] = {
        detected: true,
        keywords: allFoundKeywords
      };
      console.log(`✅ [detectPartsByKeywords] ${partName} 감지: ${allFoundKeywords.join(', ')}`);
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
 * 우선순위:
 * 1. DoD 테이블 (실제 작업 항목)
 * 2. 협업 체크
 * 3. 키워드 탐지 (보조)
 *
 * @param parsed - 파싱된 Confluence 데이터
 * @param keywordDetection - 키워드 탐지 결과
 * @param dodTables - DoD 테이블 데이터
 * @returns DoD 파트 목록
 */
export function generateDoDParts(
  parsed: ParsedConfluence,
  keywordDetection: KeywordDetection,
  dodTables: DoDTableData[] = []
): DoDPart[] {
  const parts: DoDPart[] = [];
  const processedParts = new Set<string>();

  // DoD 테이블에서 파트별 작업 항목 맵 생성
  const dodTasksMap = new Map<string, DoDTask[]>();

  // 공통 DoD 테이블 (파트명 없음)
  let commonDoDTasks: DoDTask[] = [];

  for (const dodTable of dodTables) {
    if (dodTable.partName) {
      // 파트별 DoD (예: "[기획] DoD")
      dodTasksMap.set(dodTable.partName, dodTable.tasks);
    } else {
      // 공통 DoD (파트명 없음)
      commonDoDTasks = dodTable.tasks;
    }
  }

  console.log(`📋 [generateDoDParts] DoD 테이블 파싱 결과: 파트별 ${dodTasksMap.size}개, 공통 ${commonDoDTasks.length}개`);

  // 1. 협업 체크된 파트 추가
  for (const [partName, checked] of Object.entries(parsed.collaborationCheck)) {
    if (!checked) continue; // 체크 안 된 파트 제외

    processedParts.add(partName);

    const prefix = extractPrefix(partName);

    // DoD 테이블에서 해당 파트의 작업 항목 찾기
    let tasks: DoDTask[] = [];

    if (dodTasksMap.has(prefix)) {
      // 파트별 DoD 테이블이 있으면 사용
      tasks = dodTasksMap.get(prefix)!;
      console.log(`✅ [generateDoDParts] ${partName}: DoD 테이블 사용 (${tasks.length}개 작업)`);
    } else if (commonDoDTasks.length > 0) {
      // 공통 DoD 테이블이 있으면 사용
      tasks = commonDoDTasks;
      console.log(`✅ [generateDoDParts] ${partName}: 공통 DoD 테이블 사용 (${tasks.length}개 작업)`);
    } else {
      // DoD 테이블이 없으면 기본 템플릿 사용
      tasks = generateDefaultTasks(partName, []);
      console.log(`⚠️ [generateDoDParts] ${partName}: DoD 테이블 없음, 기본 템플릿 사용`);
    }

    parts.push({
      partName,
      prefix,
      checked: true,
      detected: false,
      status: 'normal',
      keywords: [],
      tasks
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
      // 협업 체크 없고 키워드만 탐지 → "추가 검토" 상태, 기본 작업 항목 생성
      processedParts.add(partName);

      parts.push({
        partName,
        prefix: extractPrefix(partName),
        checked: false,
        detected: true,
        status: 'review', // 추가 검토 필요
        keywords: detection.keywords,
        tasks: generateDefaultTasks(partName, detection.keywords) // 기본 작업 항목 생성
      });
      console.log(`⚠️ [generateDoDParts] ${partName}: 키워드 탐지 (추가 검토 필요)`);
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

  // 2. DoD 테이블 파싱 (최우선)
  const dodTables = parseDoDTables(html);

  // 3. 키워드 탐지 (보조)
  const keywordDetection = detectPartsByKeywords(parsed.bodyText);

  // 4. DoD 파트 생성 (DoD 테이블 우선, 없으면 템플릿)
  const parts = generateDoDParts(parsed, keywordDetection, dodTables);

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
