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
    connectionType: 'jira-api' | 'claude-mcp';
    jiraUrl: string;                 // https://xxx.atlassian.net
    email: string;
    apiToken: string;
    projectKey: string;              // AEGIS

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
