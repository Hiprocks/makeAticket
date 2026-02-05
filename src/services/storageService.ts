import { useSettingsStore } from '@/store/useSettingsStore';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5174';

export async function saveSnapshot(kind: string, payload: unknown) {
    const { projectKey } = useSettingsStore.getState();
    const body = {
        projectKey: projectKey || 'default',
        kind,
        payload,
    };
    try {
        const res = await fetch(`${API_BASE}/api/storage/snapshot`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });
        if (!res.ok) {
            const text = await res.text();
            console.warn(`Snapshot save failed (${res.status}): ${text}`);
        }
    } catch (err) {
        console.warn('Snapshot save failed:', err);
    }
}
