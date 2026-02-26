/**
 * DoD Extraction Service
 * Parses Confluence HTML and extracts Definition of Done items
 */

import * as cheerio from 'cheerio';

/**
 * DoD Item structure
 */
export interface DoDItem {
  id: string; // Unique identifier (generated)
  epicName: string; // Epic name (e.g., "LoL 건물파괴 개선")
  epicKey?: string; // Existing Epic key if found in Jira
  summary: string; // Task summary
  description: string; // Task description
  part: string; // VFX | Sound | UI | Animation | etc.
  isBlocker: boolean; // Whether this blocks the parent Epic
  rawHtml?: string; // Original HTML for debugging
}

/**
 * Extraction result with metadata
 */
export interface ExtractionResult {
  items: DoDItem[];
  epicCount: number;
  totalTasks: number;
  warnings: string[]; // Non-critical issues
  metadata: {
    pageTitle: string;
    extractedAt: string;
  };
}

/**
 * Keywords for detecting different parts
 */
const PART_KEYWORDS = {
  VFX: ['vfx', '이펙트', '파티클', 'effect', 'particle'],
  Sound: ['사운드', 'sound', 'audio', '오디오', 'bgm', 'sfx'],
  UI: ['ui', 'ux', '인터페이스', 'interface', 'hud'],
  Animation: ['애니메이션', 'animation', 'anim', '애님'],
};

/**
 * Extract DoD items from Confluence HTML
 * @param html - Confluence page HTML (Atlassian Storage Format)
 * @param pageTitle - Page title for metadata
 * @returns Extraction result with DoD items and metadata
 */
export function extractDoDFromHtml(html: string, pageTitle: string): ExtractionResult {
  const $ = cheerio.load(html);
  const items: DoDItem[] = [];
  const warnings: string[] = [];
  let currentEpic: string | null = null;
  let epicCounter = 0;

  // Strategy: Look for headings (h1-h3) as Epic names
  // and lists (ul/ol) under each heading as DoD items
  $('h1, h2, h3, ul, ol').each((_, element) => {
    const tagName = element.tagName.toLowerCase();

    if (tagName === 'h1' || tagName === 'h2' || tagName === 'h3') {
      // This is a potential Epic name
      const epicName = $(element).text().trim();

      // Skip empty headings or meta headings
      if (!epicName || epicName.length < 3) return;
      if (/^(목차|toc|table of contents|definition|정의)$/i.test(epicName)) return;

      currentEpic = epicName;
      epicCounter++;
    } else if ((tagName === 'ul' || tagName === 'ol') && currentEpic) {
      // This is a list under current Epic
      $(element).find('li').each((_, li) => {
        const text = $(li).text().trim();

        // Skip empty items
        if (!text || text.length < 5) return;

        // Detect part from text
        const part = detectPart(text);

        // Generate unique ID
        const id = `dod-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // Extract summary and description
        const { summary, description } = parseDoDText(text);

        items.push({
          id,
          epicName: currentEpic,
          summary,
          description,
          part,
          isBlocker: false, // Default: not a blocker (user can toggle in Step 2)
          rawHtml: $(li).html() || undefined,
        });
      });
    }
  });

  // Validation warnings
  if (items.length === 0) {
    warnings.push('DoD 항목을 찾을 수 없습니다. 페이지에 목록(ul/ol)이 있는지 확인하세요.');
  }
  if (epicCounter === 0) {
    warnings.push('Epic 제목(h1-h3)을 찾을 수 없습니다. 모든 항목이 "기타 Epic"으로 분류됩니다.');
    // Fallback: create a default Epic
    items.forEach(item => {
      if (!item.epicName) {
        item.epicName = '기타 DoD';
      }
    });
  }

  // Group by Epic for statistics
  const uniqueEpics = new Set(items.map(item => item.epicName));

  return {
    items,
    epicCount: uniqueEpics.size,
    totalTasks: items.length,
    warnings,
    metadata: {
      pageTitle,
      extractedAt: new Date().toISOString(),
    },
  };
}

/**
 * Detect part type from text using keywords
 */
function detectPart(text: string): string {
  const lowerText = text.toLowerCase();

  for (const [part, keywords] of Object.entries(PART_KEYWORDS)) {
    if (keywords.some(keyword => lowerText.includes(keyword.toLowerCase()))) {
      return part;
    }
  }

  return '기타'; // Default fallback
}

/**
 * Parse DoD text into summary and description
 * Strategy:
 * - If text contains ": " or " - ", split into summary + description
 * - Otherwise, use first 50 chars as summary, rest as description
 */
function parseDoDText(text: string): { summary: string; description: string } {
  // Pattern 1: "VFX: 건물 파괴 이펙트 추가"
  if (text.includes(': ')) {
    const [prefix, ...rest] = text.split(': ');
    return {
      summary: prefix.trim(),
      description: rest.join(': ').trim(),
    };
  }

  // Pattern 2: "건물 파괴 이펙트 추가 - 파티클 시스템 사용"
  if (text.includes(' - ')) {
    const [summary, ...rest] = text.split(' - ');
    return {
      summary: summary.trim(),
      description: rest.join(' - ').trim(),
    };
  }

  // Pattern 3: Single line text
  // Use first 50 chars as summary, full text as description
  if (text.length <= 50) {
    return {
      summary: text,
      description: text,
    };
  }

  return {
    summary: text.substring(0, 47) + '...',
    description: text,
  };
}

/**
 * Validate extraction result
 * @returns Array of validation errors (empty if valid)
 */
export function validateExtractionResult(result: ExtractionResult): string[] {
  const errors: string[] = [];

  if (result.items.length === 0) {
    errors.push('추출된 DoD 항목이 없습니다.');
  }

  if (result.epicCount === 0) {
    errors.push('Epic이 감지되지 않았습니다.');
  }

  // Check for duplicate Epic names
  const epicNames = result.items.map(item => item.epicName);
  const duplicates = epicNames.filter((name, index) => epicNames.indexOf(name) !== index);
  if (duplicates.length > 0) {
    errors.push(`중복된 Epic 이름: ${[...new Set(duplicates)].join(', ')}`);
  }

  return errors;
}
