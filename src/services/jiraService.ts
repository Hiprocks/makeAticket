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
        await delay(1000);
        if (!ticket.summary) throw new Error('Summary is required');
        const key = `AEGIS-${Math.floor(Math.random() * 1000) + 500}`;
        console.log(`[Mock] Created Epic: ${key} - ${ticket.summary}`);
        return key;
    },

    async createTask(ticket: TicketRow): Promise<string> {
        await delay(800);
        if (!ticket.summary) throw new Error('Summary is required');
        const key = `AEGIS-${Math.floor(Math.random() * 1000) + 500}`;
        console.log(`[Mock] Created Task: ${key} - ${ticket.summary} (Parent: ${ticket.parentKey})`);
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
