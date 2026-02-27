# Gap Analysis: 복사-붙여넣기 기능 (Copy-Paste Feature)

> **Analysis Date**: 2026-02-25
> **Analyzer**: CTO Lead
> **Phase**: Design Phase Discovery
> **Status**: 🚨 **CRITICAL FINDING - Feature Already Implemented**

---

## 🎯 Executive Summary

During the Design phase preparation, a critical discovery was made: **The copy-paste functionality described in the Plan document is already 80% implemented** in the current codebase.

**Match Rate**: **80%** (Basic functionality complete, missing user feedback layer)

**Recommendation**: **Pivot to Enhancement & Validation** instead of full implementation.

---

## ✅ Already Implemented Features

### 1. Clipboard Data Parsing (FR-1)
**Location**: `src/components/TicketRow.tsx:246-291`

**Function**: `parseClipboard(text: string): string[][]`

**Features**:
- ✅ Tab-delimited parsing (`\t` for columns)
- ✅ Newline parsing (`\n` for rows)
- ✅ Quote handling (CSV-style `"quoted cells"`)
- ✅ Escape sequences (`""` → `"`)
- ✅ Cross-platform line ending normalization (`\r\n` → `\n`)

**Code**:
```typescript
function parseClipboard(text: string): string[][] {
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

        if (!inQuotes && ch === '\t') {
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

    // Handle last cell/row
    if (cell !== '' || row.length > 0) {
        row.push(cell);
        if (row.length > 1 || row[0] !== '') {
            rows.push(row);
        }
    }

    return rows;
}
```

**Verdict**: ✅ **COMPLETE** - Meets FR-1 requirements

---

### 2. Paste Event Handling (FR-2)
**Location**: `src/components/TicketRow.tsx:42-85`

**Function**: `handlePaste(field: keyof TicketRow)`

**Features**:
- ✅ `ClipboardEvent` listener on input fields
- ✅ `event.preventDefault()` to override default paste
- ✅ Multi-row, multi-column paste support
- ✅ Dynamic column mapping starting from focused field
- ✅ Automatic row creation via `ensureRowCount()`
- ✅ Integration with Zustand store (`updateRow()`)

**Code**:
```typescript
const handlePaste = (field: keyof TicketRowType) => (e: ClipboardEvent) => {
    const text = e.clipboardData?.getData('text/plain');
    if (!text) return;

    const startCol = COLUMN_FIELDS.indexOf(field);
    if (startCol === -1) return;

    e.preventDefault();

    const grid = parseClipboard(text);
    if (grid.length === 0) return;

    ensureRowCount(index + grid.length);
    const updatedRows = useTicketStore.getState().rows;

    grid.forEach((rowCells, rowOffset) => {
        const targetRow = updatedRows[index + rowOffset];
        if (!targetRow) return;

        rowCells.forEach((cell, colOffset) => {
            const fieldKey = COLUMN_FIELDS[startCol + colOffset];
            if (!fieldKey) return;

            const value = cell;
            if (fieldKey === 'type') {
                const lower = value.toLowerCase();
                if (lower.startsWith('e')) {
                    updateRow(targetRow.id, { type: 'Epic' });
                } else if (lower.startsWith('t')) {
                    updateRow(targetRow.id, { type: 'Task' });
                }
                return;
            }

            if (fieldKey === 'startDate' || fieldKey === 'dueDate') {
                updateRow(targetRow.id, { [fieldKey]: normalizeDateInput(value) });
                return;
            }

            updateRow(targetRow.id, { [fieldKey]: value });
        });
    });
};
```

**Integration Points**:
- Attached to Summary field: `<Input onPaste={handlePaste('summary')} />`
- Attached to Description field: `<Textarea onPaste={handlePaste('description')} />`

**Verdict**: ✅ **COMPLETE** - Meets FR-2 requirements

---

### 3. Data Type Conversion (FR-3)
**Location**: `src/components/TicketRow.tsx:66-82, 233-244`

**Features**:
- ✅ **Type field**: Auto-detect "Epic" vs "Task" (case-insensitive, prefix matching)
  - `"epic"` / `"e"` → `'Epic'`
  - `"task"` / `"t"` → `'Task'`
- ✅ **Date fields**: `normalizeDateInput()` function
  - `20260301` → `2026-03-01`
  - Already valid `YYYY-MM-DD` → unchanged
- ✅ **Generic fields**: Direct string assignment for summary, description, assignee, sprint, parentKey

**Code**:
```typescript
function normalizeDateInput(value: string) {
    const trimmed = value.trim();
    const digitsOnly = trimmed.replace(/[^0-9]/g, '');
    if (digitsOnly.length === 8) {
        const yyyy = digitsOnly.slice(0, 4);
        const mm = digitsOnly.slice(4, 6);
        const dd = digitsOnly.slice(6, 8);
        return `${yyyy}-${mm}-${dd}`;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    return trimmed;
}
```

**Limitations**:
- ⚠️ No validation for invalid type values (e.g., "Bug" → silently ignored)
- ⚠️ No assignee displayName → accountId mapping (requires cache lookup)
- ⚠️ No sprint name → sprint ID mapping (requires cache lookup)

**Verdict**: ✅ **PARTIALLY COMPLETE** - Basic conversion works, advanced mapping missing

---

### 4. Store Integration
**Location**: `src/store/useTicketStore.ts:114-119`

**Function**: `ensureRowCount(count: number)`

**Features**:
- ✅ Automatically adds rows if paste data exceeds current row count
- ✅ Uses `createEmptyRow()` to maintain consistent structure
- ✅ Preserves existing rows

**Code**:
```typescript
ensureRowCount: (count) => set((state) => {
    const needed = count - state.rows.length;
    if (needed <= 0) return state;
    const newRows = Array.from({ length: needed }, createEmptyRow);
    return { rows: [...state.rows, ...newRows] };
}),
```

**Verdict**: ✅ **COMPLETE**

---

## ❌ Missing Features (Gaps)

### Gap 1: User Feedback (FR-4) - **High Priority**

**Status**: ❌ **NOT IMPLEMENTED**

**Requirements from Plan**:
```markdown
Toast 알림:
- 성공: "✅ 5행 붙여넣기 완료"
- 경고: "⚠️ 3행 붙여넣기 완료 (2개 필드 누락)"
- 실패: "❌ 붙여넣기 실패: 데이터 형식 오류"
```

**Current State**:
- No toast library installed (`sonner` not found in codebase)
- No success notification after paste
- No validation warnings
- Silent failure if clipboard data is empty

**Impact**: Users don't know if paste succeeded or how many rows were affected.

**Effort**: Low (1-2 hours)
- Install `sonner` (or use existing toast library if present)
- Add success toast in `handlePaste()`
- Add validation and warning messages

---

### Gap 2: Validation (FR-4) - **Medium Priority**

**Status**: ❌ **NOT IMPLEMENTED** (except basic summary check at creation time)

**Requirements from Plan**:
- [ ] Warn if required field (summary) is empty
- [ ] Warn if type value is invalid (not "Epic" or "Task")
- [ ] Warn if assignee not in user cache
- [ ] Warn if sprint not in sprint cache
- [ ] Warn if date format is invalid

**Current State**:
- Validation only happens at ticket creation time (`validateBeforeCreate()` in SpreadsheetTable.tsx:32-41)
- No real-time validation during paste
- Invalid data silently accepted

**Impact**: Users paste invalid data and only discover issues when trying to create tickets.

**Effort**: Medium (3-4 hours)
- Add validation logic to `handlePaste()`
- Collect warnings (non-blocking) and errors (blocking)
- Display toast with warning count

---

### Gap 3: Advanced Field Mapping - **Low Priority**

**Status**: ❌ **NOT IMPLEMENTED**

**Requirements**:
- [ ] Assignee: displayName → accountId lookup
  - Example: "홍길동" → `"6123abc..."`
  - Requires `useSettingsStore.users` cache
- [ ] Sprint: Sprint name → Sprint ID lookup
  - Example: "Sprint 1" → `12345`
  - Requires `useSettingsStore.sprints` cache

**Current State**:
- Paste stores raw string values
- Works if user pastes accountId/sprintId directly (unlikely)
- Dropdown selection still required after paste

**Impact**: Moderate - Users can paste names, but need to re-select from dropdowns.

**Effort**: Medium (3-4 hours)
- Add cache lookup logic
- Handle "not found" cases (warn or fall back to empty)

---

### Gap 4: Performance Metrics (NFR-1) - **Low Priority**

**Status**: ❌ **NOT TESTED**

**Requirements from Plan**:
- 100 rows paste in < 1 second
- 1000+ rows show warning

**Current State**:
- No performance measurement
- No row count limit
- Unknown performance at scale (likely fine, but unverified)

**Impact**: Potential browser freeze with very large pastes.

**Effort**: Low (1 hour)
- Add performance.now() measurement
- Add row count check before processing
- Show warning if > 1000 rows

---

### Gap 5: `bulkUpdateRows()` Zustand Action - **Optimization**

**Status**: ⚠️ **NOT NEEDED** (Current approach works, but not optimal)

**Plan Suggestion**:
```typescript
bulkUpdateRows: (rows: Partial<TicketRow>[]) => void;
```

**Current Approach**:
- Calls `updateRow()` in a loop for each cell
- Each call triggers Zustand state update → IndexedDB persist
- 100 rows × 8 fields = 800 store updates

**Impact**: Potential performance issue, but likely acceptable for typical use (< 50 rows).

**Effort**: Low (2 hours) - Refactor to batch updates.

**Recommendation**: Implement only if performance testing reveals issues.

---

## 📊 Gap Summary Table

| Gap | Priority | Impact | Effort | Status |
|-----|----------|--------|--------|--------|
| **Gap 1**: Toast Feedback | 🔴 High | High | Low (1-2h) | Not Started |
| **Gap 2**: Validation Warnings | 🟡 Medium | Medium | Medium (3-4h) | Not Started |
| **Gap 3**: Field Mapping (displayName→accountId) | 🟢 Low | Medium | Medium (3-4h) | Not Started |
| **Gap 4**: Performance Testing | 🟢 Low | Low | Low (1h) | Not Started |
| **Gap 5**: bulkUpdateRows() Optimization | 🟢 Low | Low | Low (2h) | Not Started |

**Total Effort**: 10-13 hours (1.5-2 days)

---

## 🎯 Recommended Action Plan

### Option A: Complete Feature (Recommended)
**Goal**: Implement missing gaps to meet 100% of Plan requirements.

**Steps**:
1. **Quick Win** (3 hours): Gaps 1 + 4
   - Install sonner toast
   - Add success/warning/error notifications
   - Add performance measurement
   - Test with 100-row paste

2. **Enhancement** (7 hours): Gaps 2 + 3
   - Add validation logic
   - Implement field mapping (assignee, sprint)
   - Handle edge cases (not found, invalid format)

3. **Optimization** (2 hours): Gap 5 (if needed)
   - Benchmark current performance
   - Implement `bulkUpdateRows()` only if < 1s target not met

**Timeline**: 2 days
**Match Rate After**: **100%**

---

### Option B: Minimal Viable (Fast Track)
**Goal**: Ship functional feature ASAP, skip nice-to-haves.

**Steps**:
1. Implement Gap 1 only (toast feedback)
2. Document existing feature in Overview.md
3. Mark as "Complete" in Todo.md

**Timeline**: 0.5 days
**Match Rate After**: **85%**

---

### Option C: Test & Document Only
**Goal**: Feature is "good enough", just validate and update docs.

**Steps**:
1. Manual testing with Excel/Google Sheets/Confluence
2. Update Overview.md: "복사-붙여넣기 기능 (Basic)" → Completed
3. Update Todo.md: Check off the item
4. Add to Mistake Note.md: "Plan created without checking existing implementation"

**Timeline**: 0.25 days
**Match Rate After**: **80%** (current)

---

## 🚨 Critical Lesson: Pre-Plan Code Review

**Mistake**: The Plan document was created without reviewing existing codebase.

**Impact**:
- 2-3 days estimated for "implementation" of already-existing feature
- Potential duplicate code if proceeding blindly
- Wasted Design/Do phase effort

**Prevention**:
1. **ALWAYS run codebase analysis BEFORE Plan phase**
2. Add to CLAUDE.md: "Pre-Plan Checklist: Search for existing implementations"
3. Use Grep/Glob to search for related keywords:
   - `handlePaste`, `clipboard`, `ClipboardEvent`
   - Feature-specific terms

**Action**: Update Mistake Note.md after this analysis.

---

## 📝 Next Steps (Awaiting Decision)

**Blocker**: CTO Lead has paused Design phase pending team-lead direction.

**Question to Team Lead**:
- Which option (A/B/C) should we proceed with?
- Should we update Plan document to reflect "Enhancement" instead of "New Implementation"?
- Should we skip Design/Do and go straight to Check/Act for gap closure?

**Status**: ⏸️ **ON HOLD** - Awaiting team-lead response.

---

**Analysis Completed**: 2026-02-25
**Analyst**: CTO Lead (cto-lead)
**Next Review**: After team-lead decision
