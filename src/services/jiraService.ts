import type { JiraUser, JiraSprint, TicketRow } from '@/types';
import { useSettingsStore } from '@/store/useSettingsStore';

const MOCK_USERS: JiraUser[] = [
    { accountId: '1', displayName: 'Hong', emailAddress: 'hong@company.com' },
    { accountId: '2', displayName: 'Kim', emailAddress: 'kim@company.com' },
    { accountId: '3', displayName: 'Lee', emailAddress: 'lee@company.com' },
    { accountId: '4', displayName: 'Park', emailAddress: 'park@company.com' },
    { accountId: '5', displayName: 'Choi', emailAddress: 'choi@company.com' },
];

const MOCK_SPRINTS: JiraSprint[] = [
    { id: 101, name: 'Sprint 101', state: 'active' },
    { id: 102, name: 'Sprint 102', state: 'future' },
    { id: 100, name: 'Sprint 100', state: 'closed' },
];

export const jiraService = {
    async searchUsers(query: string = ''): Promise<JiraUser[]> {
        await delay(500);
        if (!query) return MOCK_USERS;
        const lowerQuery = query.toLowerCase();
        return MOCK_USERS.filter(u =>
            u.displayName.toLowerCase().includes(lowerQuery) ||
            u.emailAddress.toLowerCase().includes(lowerQuery)
        );
    },

    async getSprints(): Promise<JiraSprint[]> {
        await delay(500);
        return MOCK_SPRINTS;
    },

    async createEpic(ticket: TicketRow): Promise<string> {
        const { connectionType, jiraUrl, email, apiToken, projectKey } = useSettingsStore.getState();
        if (!ticket.summary) throw new Error('Summary is required');

        if (connectionType !== 'jira-api') {
            throw new Error('Claude MCP creation is not implemented');
        }
        if (!jiraUrl || !email || !apiToken || !projectKey) {
            throw new Error('Jira connection is not configured');
        }

        const key = await createIssue({
            jiraUrl,
            email,
            apiToken,
            fields: {
                project: { key: projectKey },
                issuetype: { name: 'Epic' },
                summary: ticket.summary,
                description: ticket.description,
                // Common default for Epic Name; if your Jira uses a different field id,
                // this request will fail and we will surface the error.
                customfield_10011: ticket.summary,
                assignee: ticket.assignee ? { accountId: ticket.assignee } : undefined,
            },
        });
        return key;
    },

    async createTask(ticket: TicketRow): Promise<string> {
        const { connectionType, jiraUrl, email, apiToken, projectKey } = useSettingsStore.getState();
        if (!ticket.summary) throw new Error('Summary is required');

        if (connectionType !== 'jira-api') {
            throw new Error('Claude MCP creation is not implemented');
        }
        if (!jiraUrl || !email || !apiToken || !projectKey) {
            throw new Error('Jira connection is not configured');
        }

        const fields: Record<string, any> = {
            project: { key: projectKey },
            issuetype: { name: 'Task' },
            summary: ticket.summary,
            description: ticket.description,
        };
        if (ticket.assignee) fields.assignee = { accountId: ticket.assignee };
        if (ticket.parentKey) fields.parent = { key: ticket.parentKey };
        if (ticket.sprint) fields.customfield_10020 = Number(ticket.sprint);

        const key = await createIssue({
            jiraUrl,
            email,
            apiToken,
            fields,
        });
        return key;
    },

    async checkConnection(): Promise<boolean> {
        await delay(1000);
        const { connectionType, apiToken, email } = useSettingsStore.getState();
        if (connectionType === 'jira-api') {
            return !!apiToken && !!email;
        }
        return true;
    }
};

function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function createIssue(params: {
    jiraUrl: string;
    email: string;
    apiToken: string;
    fields: Record<string, any>;
}): Promise<string> {
    const baseUrl = params.jiraUrl.replace(/\/+$/, '');
    const res = await fetch(`${baseUrl}/rest/api/3/issue`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Basic ${btoa(`${params.email}:${params.apiToken}`)}`,
        },
        body: JSON.stringify({ fields: cleanFields(params.fields) }),
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Jira create failed (${res.status}): ${text}`);
    }

    const data = await res.json();
    if (!data?.key) throw new Error('Jira response missing issue key');
    return data.key as string;
}

function cleanFields(fields: Record<string, any>) {
    return Object.fromEntries(
        Object.entries(fields).filter(([, value]) => value !== undefined && value !== '')
    );
}
