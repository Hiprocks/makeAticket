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

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5174';

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
        const { projectKey } = useSettingsStore.getState();
        if (!ticket.summary) throw new Error('Summary is required');

        const key = await createIssueViaProxy({
            type: 'Epic',
            projectKey,
            summary: ticket.summary,
            description: ticket.description,
            assignee: ticket.assignee,
        });
        return key;
    },

    async createTask(ticket: TicketRow): Promise<string> {
        const { projectKey } = useSettingsStore.getState();
        if (!ticket.summary) throw new Error('Summary is required');

        const key = await createIssueViaProxy({
            type: 'Task',
            projectKey,
            summary: ticket.summary,
            description: ticket.description,
            assignee: ticket.assignee,
            parentKey: ticket.parentKey,
        });
        return key;
    },

    async checkConnection(): Promise<boolean> {
        try {
            const res = await fetch(`${API_BASE}/api/health`);
            return res.ok;
        } catch {
            return false;
        }
    },

    async updateIssue(key: string, payload: { summary?: string; description?: string }): Promise<void> {
        if (!key) throw new Error('Jira key is required');
        const res = await fetch(`${API_BASE}/api/jira/issue/update`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ key, ...payload }),
        });

        if (!res.ok) {
            const text = await res.text();
            throw new Error(`Jira update failed (${res.status}): ${text}`);
        }
    }
};

function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function createIssueViaProxy(payload: {
    type: 'Epic' | 'Task';
    projectKey?: string;
    summary: string;
    description?: string;
    assignee?: string;
    parentKey?: string;
}): Promise<string> {
    const res = await fetch(`${API_BASE}/api/jira/issue`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Jira create failed (${res.status}): ${text}`);
    }

    const data = await res.json();
    if (!data?.key) throw new Error('Jira response missing issue key');
    return data.key as string;
}
