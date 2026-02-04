export function parseDelimited(text: string, delimiter: string): string[][] {
    const rows: string[][] = [];
    let row: string[] = [];
    let cell = '';
    let inQuotes = false;
    const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    for (let i = 0; i < normalized.length; i++) {
        const ch = normalized[i];
        const next = normalized[i + 1];

        if (ch === '"') {
            if (inQuotes && next === '"') {
                cell += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
            continue;
        }

        if (!inQuotes && ch === delimiter) {
            row.push(cell);
            cell = '';
            continue;
        }

        if (!inQuotes && ch === '\n') {
            row.push(cell);
            if (row.length > 1 || row[0] !== '') {
                rows.push(row);
            }
            row = [];
            cell = '';
            continue;
        }

        cell += ch;
    }

    row.push(cell);
    if (row.length > 1 || row[0] !== '') {
        rows.push(row);
    }

    return rows;
}

export function parseCsvWithHeaders(text: string): { headers: string[]; rows: string[][] } {
    const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const firstLine = lines.split('\n')[0] || '';
    const commaCount = (firstLine.match(/,/g) || []).length;
    const tabCount = (firstLine.match(/\t/g) || []).length;
    const delimiter = tabCount > commaCount ? '\t' : ',';

    const parsed = parseDelimited(lines, delimiter);
    if (parsed.length === 0) return { headers: [], rows: [] };
    const [headers, ...rows] = parsed;
    return { headers: headers.map(h => h.trim()), rows };
}

export function normalizeHeader(value: string): string {
    return value.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
}
