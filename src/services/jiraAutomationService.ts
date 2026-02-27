/**
 * Jira Automation Service
 * DoD 자동화를 위한 Jira API 호출 함수들
 */

import type { ExistingTask, PlannedTask, CreationResult } from '@/types';

/**
 * Epic 조회 응답
 */
interface EpicQueryResponse {
  key: string;
  summary: string;
  childTasks: {
    key: string;
    summary: string;
    type: string;
    status: string;
  }[];
}

/**
 * Task 생성 응답
 */
interface TaskCreationResponse {
  results: CreationResult[];
  summary: {
    total: number;
    success: number;
    failed: number;
  };
}

/**
 * Blocker 생성 응답
 */
interface BlockerCreationResponse {
  results: {
    success: boolean;
    inwardKey: string;
    outwardKey: string;
    error: string | null;
  }[];
}

/**
 * FR-5: Epic 조회 + 하위 Task 목록 조회
 *
 * @param epicKey - Epic 키 (예: AEGIS-100)
 * @returns Epic 정보 + 하위 Task 목록
 */
export async function queryEpic(epicKey: string): Promise<{
  key: string;
  summary: string;
  existingTasks: ExistingTask[];
}> {
  const response = await fetch(`/api/jira/epic/${encodeURIComponent(epicKey)}`);

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || `Epic 조회 실패 (${response.status})`);
  }

  const data: EpicQueryResponse = await response.json();

  // 기존 Task 목록 변환
  const existingTasks: ExistingTask[] = data.childTasks
    .filter(task => task.type === 'Task') // Task만 추출
    .map(task => {
      // 말머리 추출 (예: "[기획] 추가 시간 시스템" → "[기획]")
      const match = task.summary.match(/^\[([^\]]+)\]/);
      const prefix = match ? `[${match[1]}]` : '';

      return {
        key: task.key,
        prefix,
        title: task.summary
      };
    });

  return {
    key: data.key,
    summary: data.summary,
    existingTasks
  };
}

/**
 * FR-7: DoD Task 일괄 생성
 *
 * @param tasks - 생성할 Task 목록
 * @returns 생성 결과 (성공/실패 분리)
 */
export async function createDoDTasks(
  tasks: PlannedTask[]
): Promise<CreationResult[]> {
  const response = await fetch('/api/jira/dod/tasks/create', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ tasks })
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || `Task 생성 실패 (${response.status})`);
  }

  const data: TaskCreationResponse = await response.json();
  return data.results;
}

/**
 * FR-8: Blocker 링크 일괄 생성
 *
 * @param createdTasks - 생성된 Task 목록
 * @param blockerRules - Blocker 규칙
 * @returns Blocker 생성 결과
 */
export async function createBlockerLinks(
  createdTasks: CreationResult[],
  blockerRules: Record<string, string[]>
): Promise<BlockerCreationResponse> {
  // 1. Task 맵 생성 (prefix → key)
  const taskMap = new Map<string, string>();
  for (const task of createdTasks) {
    if (task.success && task.key) {
      taskMap.set(task.prefix, task.key);
    }
  }

  // 2. Blocker 링크 목록 생성
  const links: { inwardKey: string; outwardKey: string }[] = [];

  for (const [blocker, blockedPrefixes] of Object.entries(blockerRules)) {
    const blockerKey = taskMap.get(blocker);
    if (!blockerKey) continue;

    for (const blockedPrefix of blockedPrefixes) {
      const blockedKey = taskMap.get(blockedPrefix);
      if (!blockedKey) continue;

      links.push({
        inwardKey: blockerKey,
        outwardKey: blockedKey
      });
    }
  }

  // 3. API 호출
  if (links.length === 0) {
    return { results: [] };
  }

  const response = await fetch('/api/jira/blocker/create', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ links })
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || `Blocker 생성 실패 (${response.status})`);
  }

  return await response.json();
}

/**
 * FR-6: Task 중복 확인
 *
 * @param existingTasks - 기존 Task 목록
 * @param plannedPrefixes - 생성 예정 prefix 목록
 * @returns 중복 확인 결과
 */
export function checkDuplicateTasks(
  existingTasks: ExistingTask[],
  plannedPrefixes: string[]
): Record<string, { exists: boolean; key: string | null }> {
  const result: Record<string, { exists: boolean; key: string | null }> = {};

  // 기존 Task에서 prefix 추출
  const existingPrefixes = new Map<string, string>();
  for (const task of existingTasks) {
    if (task.prefix) {
      existingPrefixes.set(task.prefix, task.key);
    }
  }

  // 생성 예정 prefix와 비교
  for (const prefix of plannedPrefixes) {
    if (existingPrefixes.has(prefix)) {
      result[prefix] = {
        exists: true,
        key: existingPrefixes.get(prefix)!
      };
    } else {
      result[prefix] = {
        exists: false,
        key: null
      };
    }
  }

  return result;
}

/**
 * PlannedTask 생성 헬퍼 함수
 *
 * @param extraction - DoD 추출 결과
 * @param confluenceUrl - Confluence URL
 * @param existingTasks - 기존 Task 목록 (중복 체크용)
 * @returns 생성 예정 Task 목록
 */
export function generatePlannedTasks(
  parts: Array<{
    partName: string;
    prefix: string;
    checked: boolean;
    detected: boolean;
    status: 'normal' | 'review' | 'none';
    tasks: Array<{
      title: string;
      description: string;
      resource: string;
      dependency: string;
    }>;
  }>,
  epicKey: string,
  featureName: string,
  confluenceUrl: string,
  blockerRules: Record<string, string[]>,
  existingTasks: ExistingTask[] = []
): PlannedTask[] {
  const planned: PlannedTask[] = [];

  // Create a set of existing prefixes for quick lookup
  const existingPrefixes = new Set(
    existingTasks.map(task => task.prefix).filter(Boolean)
  );

  for (const part of parts) {
    // 체크되지 않은 파트는 제외
    if (!part.checked && part.status !== 'review') continue;

    // Skip if this prefix already exists in Epic
    if (existingPrefixes.has(part.prefix)) {
      console.log(`⏭️ [generatePlannedTasks] Skipping existing task: ${part.prefix}`);
      continue;
    }

    // DoD 테이블 마크다운 생성
    const dodTable = part.tasks.length > 0
      ? `| 작업 항목 | 상세 내용 | 리소스 | 의존성 |\n` +
        `|----------|----------|--------|--------|\n` +
        part.tasks.map(task =>
          `| ${task.title} | ${task.description} | ${task.resource} | ${task.dependency} |`
        ).join('\n')
      : '(작업 항목 없음)';

    // Task 본문 생성
    const description = `## 참조\nConfluence: ${confluenceUrl}\n\n## DoD\n${dodTable}`;

    // Blocker 관계 설정
    const blockers: string[] = [];
    const blockedBy: string[] = [];

    // 이 prefix가 다른 prefix를 block하는지 확인
    if (blockerRules[part.prefix]) {
      blockers.push(...blockerRules[part.prefix]);
    }

    // 이 prefix가 다른 prefix에 의해 blocked되는지 확인
    for (const [blocker, blocked] of Object.entries(blockerRules)) {
      if (blocked.includes(part.prefix)) {
        blockedBy.push(blocker);
      }
    }

    planned.push({
      prefix: part.prefix,
      title: `${part.prefix} ${featureName}`,
      description,
      parentKey: epicKey,
      blockers,
      blockedBy
    });
  }

  return planned;
}
