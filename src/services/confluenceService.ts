/**
 * Confluence API Service
 * Handles fetching Confluence pages and extracting page IDs from URLs
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5174';

/**
 * Confluence page data structure
 */
export interface ConfluencePage {
  id: string;
  title: string;
  type: string;
  status: string;
  body: string; // HTML content in Atlassian Storage Format
  space: {
    id?: string;
    key?: string;
    name?: string;
  };
  version: {
    number?: number;
    when?: string;
    by?: string;
  };
  _links?: Record<string, string>;
}

/**
 * Test Confluence connection
 * Returns connection status and available spaces
 */
export async function testConfluenceConnection(): Promise<{
  ok: boolean;
  status: number;
  url: string;
  email: string;
  body: any;
}> {
  const response = await fetch(`${API_BASE}/api/confluence/test`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Confluence 연결 실패');
  }
  return response.json();
}

/**
 * Fetch Confluence page by ID
 * @param pageId - Confluence page ID
 * @returns Page data including HTML body
 */
export async function fetchConfluencePage(pageId: string): Promise<ConfluencePage> {
  if (!pageId) {
    throw new Error('페이지 ID가 필요합니다');
  }

  const response = await fetch(`${API_BASE}/api/confluence/page/${encodeURIComponent(pageId)}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || `Confluence 페이지 조회 실패 (${response.status})`);
  }

  return response.json();
}

/**
 * Extract page ID from Confluence URL
 * Supports various Confluence URL formats:
 * - https://domain.atlassian.net/wiki/spaces/SPACE/pages/12345/Page+Title
 * - https://domain.atlassian.net/wiki/pages/viewpage.action?pageId=12345
 * - https://domain.atlassian.net/display/SPACE/Page+Title (with pageId in URL params)
 *
 * @param url - Confluence page URL
 * @returns Page ID or null if not found
 */
export function extractPageIdFromUrl(url: string): string | null {
  if (!url) return null;

  try {
    const urlObj = new URL(url);

    // Pattern 1: /pages/12345/... or /pages/12345
    const pagesMatch = urlObj.pathname.match(/\/pages\/(\d+)/);
    if (pagesMatch) {
      return pagesMatch[1];
    }

    // Pattern 2: ?pageId=12345
    const pageIdParam = urlObj.searchParams.get('pageId');
    if (pageIdParam) {
      return pageIdParam;
    }

    return null;
  } catch {
    // Invalid URL format
    return null;
  }
}

/**
 * Validate if input is a valid page ID (numeric string)
 * @param input - Input string to validate
 * @returns true if valid page ID format
 */
export function isValidPageId(input: string): boolean {
  return /^\d+$/.test(input.trim());
}
