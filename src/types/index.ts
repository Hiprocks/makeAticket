export interface TicketRow {
    id: string;                      // UUID
    selected: boolean;               // 체크박스 상태
    type: 'Epic' | 'Task';           // 유형
    summary: string;                 // 제목
    description: string;             // 설명
    assignee: string;                // 담당자 accountId
    sprint: string;                  // Sprint ID
    startDate: string;               // YYYY-MM-DD
    dueDate: string;                 // YYYY-MM-DD
    parentKey: string;               // 상위업무 (Epic Key 또는 빈 문자열)
    parentRowId: string;             // 같은 시트 내 Epic 행 ID (연결용)
}

export interface Settings {
    // Jira 연결
    projectKey: string;              // AEGIS
    jiraUrl: string;                 // https://your-domain.atlassian.net

    // 기본값
    defaultType: 'Epic' | 'Task';
    defaultSprintId: string;

    // 캐시 데이터
    users: JiraUser[];               // 담당자 목록
    sprints: JiraSprint[];           // Sprint 목록

    // 하위 일감 모달 마지막 선택
    lastSubtaskTypes: string[];      // ['기획', '클라', ...]
}

export interface JiraUser {
    accountId: string;
    displayName: string;
    emailAddress: string;
}

export interface JiraSprint {
    id: number;
    name: string;
    state: 'active' | 'future' | 'closed';
}

export interface CreationRecord {
    id: string;                      // UUID
    createdAt: string;               // ISO 8601
    projectKey: string;
    jiraUrl: string;
    epicCount: number;
    taskCount: number;
    successCount: number;
    failCount: number;
    tickets: CreatedTicket[];
}

export interface CreatedTicket {
    rowId: string;                   // 원본 행 ID
    type: 'Epic' | 'Task';
    summary: string;
    assignee: string;
    parentKey: string;
    jiraKey: string | null;          // 성공 시 AEGIS-501, 실패 시 null
    status: 'success' | 'failed';
    errorMessage: string | null;
}

export interface EditRow {
    id: string;
    key: string;
    type: string;
    status?: string;
    sprint?: string;
    assignee?: string;
    startDate?: string;
    dueDate?: string;
    parentKey?: string;
    summary: string;
    description: string;
    originalSummary: string;
    originalDescription: string;
    selected: boolean;
}

export interface EditedTicket {
    rowId: string;
    jiraKey: string;
    summary: string;
    description: string;
    status: 'success' | 'failed';
    errorMessage: string | null;
}

export interface EditRecord {
    id: string;
    updatedAt: string;
    successCount: number;
    failCount: number;
    tickets: EditedTicket[];
}

// ============================================================================
// DoD Automation Types (Phase 1)
// ============================================================================

/**
 * Confluence 데이터
 */
export interface ConfluenceData {
    pageId: string;
    title: string;
    url: string;
    htmlContent: string;
    epicLink: string | null;
}

/**
 * HTML 파싱 결과
 */
export interface ParsedConfluence {
    title: string;
    collaborationCheck: CollaborationCheck;
    bodyText: string;
    epicKey: string | null;
}

/**
 * 협업 체크 테이블
 */
export interface CollaborationCheck {
    [partName: string]: boolean;
}

/**
 * DoD 추출 결과 (전체)
 */
export interface DoDExtraction {
    confluencePageId: string;
    confluenceUrl: string;
    title: string;
    epicKey: string;

    parts: DoDPart[];
    validation: ValidationResult;

    plannedTasks: PlannedTask[];
    existingTasks: ExistingTask[];
}

/**
 * 파트/직군 정보
 */
export interface DoDPart {
    partName: string;
    prefix: string;
    checked: boolean;
    detected: boolean;
    status: 'normal' | 'review' | 'none';
    keywords: string[];
    tasks: DoDTask[];
}

/**
 * DoD 작업 항목
 */
export interface DoDTask {
    title: string;
    description: string;
    resource: string;
    dependency: string;
}

/**
 * FR-10 검증 결과
 */
export interface ValidationResult {
    passed: boolean;
    issues: string[];
}

/**
 * 생성 예정 Task
 */
export interface PlannedTask {
    prefix: string;
    title: string;
    description: string;
    parentKey: string;
    blockers: string[];
    blockedBy: string[];
}

/**
 * 기존 Task
 */
export interface ExistingTask {
    key: string;
    prefix: string;
    title: string;
}

/**
 * Task 생성 결과
 */
export interface CreationResult {
    prefix: string;
    title: string;
    success: boolean;
    key: string | null;
    url: string | null;
    error: string | null;
}

// ============================================
// DoD Automation Types
// ============================================

export interface DoDItem {
    id: string;                  // Unique identifier
    epicName: string;            // Epic name
    epicKey?: string;            // Existing Epic key if found
    summary: string;             // Task summary
    description: string;         // Task description
    part: string;                // VFX | Sound | UI | Animation | etc.
    isBlocker: boolean;          // Whether this blocks the parent Epic
    rawHtml?: string;            // Original HTML for debugging
}

export interface DoDExtractionResult {
    items: DoDItem[];
    epicCount: number;
    totalTasks: number;
    warnings: string[];
    metadata: {
        pageTitle: string;
        extractedAt: string;
    };
}

export interface DoDAutomationState {
    // Step 1: Confluence Input
    pageUrl: string;
    pageId: string;
    pageTitle: string;
    pageHtml: string;

    // Step 2: DoD Review
    extractionResult: DoDExtractionResult | null;
    reviewedItems: DoDItem[];    // User-edited items

    // Step 3: Task Creation
    creationProgress: {
        total: number;
        current: number;
        status: 'idle' | 'creating' | 'completed' | 'failed';
    };
    createdTickets: DoDCreatedTicket[];
}

export interface DoDCreatedTicket {
    itemId: string;              // Original DoDItem ID
    epicKey: string | null;      // Created/found Epic key
    taskKey: string | null;      // Created Task key
    status: 'success' | 'failed';
    errorMessage: string | null;
}

export interface DoDAutomationRecord {
    id: string;
    createdAt: string;
    pageTitle: string;
    pageUrl: string;
    epicCount: number;
    taskCount: number;
    successCount: number;
    failCount: number;
    tickets: DoDCreatedTicket[];
}
