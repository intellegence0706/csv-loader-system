# Multi-Customer CSV Import Fix - Summary

## Problem Analysis

### Original Issue
The CSV import functionality worked correctly for **single-customer CSV files** but failed when processing **multi-customer CSV files** like `OCAT_サンプル入力提出用0251117.csv`.

### Root Cause
The multi-customer CSV file has a **different structure** compared to single-customer files:

#### Multi-Customer CSV Structure:
```
Row 1:    "251111_test" (File identifier/metadata)
Row 2:    Empty/decorative row with arrows
Row 3:    Section names (今回スコア.評価, 前回スコア.評価, etc.)
Row 4-15: Detailed field names (14 rows of headers)
Row 16:   First customer data (ID: 10137, 相馬泉)
Row 17:   Second customer data (ID: 10122, 井上 美咲)
Row 18:   Third customer data (ID: 10144, 波留 彩香)
...
Row 25:   Tenth customer data (ID: 10124, 小林 花音)
Row 26+:  Empty rows (padding)
```

#### Single-Customer CSV Structure:
```
Row 1:    Empty/decorative row with arrows
Row 2:    Section names (今回スコア.評価, 前回スコア.評価, etc.)
Row 3-14: Detailed field names (14 rows of headers)
Row 15:   Customer data (ID: 10137, 相馬泉)
```

### The Bug
The original code assumed:
- Headers: Always the first 14 rows (indices 0-13)
- Data: Starts immediately after headers

This caused the parser to:
1. **Include row 1 (file identifier) as part of headers** ❌
2. **Treat row 15 (actual header row) as data** ❌
3. **Miss actual data starting at row 16** ❌

---

## Solution Implemented

### 1. Auto-Detection of CSV Format

Added logic to detect whether the CSV has a file identifier in row 1:

```typescript
// Detect if first row is a file identifier
const firstRowStr = rows[0]?.join(",") || "";
const hasFileIdentifier = rows.length > 15 && 
                          firstRowStr && 
                          !firstRowStr.includes("今回") && 
                          !firstRowStr.includes("前回");

const headerStartIndex = hasFileIdentifier ? 1 : 0;
const headerDepth = 14; // Always 14 rows
const headerLayers = rows.slice(headerStartIndex, headerStartIndex + headerDepth);
const dataRows = rows.slice(headerStartIndex + headerDepth);
```

**Detection Logic:**
- If row 1 contains structured headers (keywords: "今回", "前回"), it's a **single-customer CSV**
- If row 1 is just metadata/identifier AND file has >15 rows, it's a **multi-customer CSV**

### 2. Empty Row Handling

Added filtering to skip empty rows that appear as padding:

```typescript
for (const data of rowsToProcess) {
    // Skip empty rows
    const hasData = data.some((cell, idx) => {
        if (idx < 4) return cell && String(cell).trim() !== "";
        return false;
    });
    if (!hasData) continue;
    
    // Skip rows without customer ID
    if (!rawCustomer.external_id || rawCustomer.external_id.trim() === "") {
        console.log("Skipping row without customer ID");
        continue;
    }
    
    // Process row...
}
```

### 3. Graceful Error Handling

Changed error handling to allow partial success:

```typescript
// Before: Threw error and stopped entire import
if (customerError) throw customerError;

// After: Log error and continue with next customer
if (customerError) {
    console.error(`Customer upsert error for ID ${rawCustomer.external_id}:`, customerError);
    continue; // Skip this customer but continue with others
}
```

This ensures:
- One bad row doesn't kill the entire import
- Valid customers are still processed
- Errors are logged for debugging

---

## Changes Made

### Files Modified:
- `src/pages/ImportCSV.tsx`

### Functions Updated:

#### 1. `parseStructuredCSV_OptionB()` (Lines 119-405)
**Purpose:** Parses single-row CSV for preview and single-customer import

**Changes:**
- Added file identifier detection
- Dynamic header start index calculation
- Fixed header depth to always be 14 rows

#### 2. `handleUploadMulti()` (Lines 1068-1629)
**Purpose:** Handles multi-customer CSV bulk import

**Changes:**
- Added file identifier detection
- Added empty row filtering
- Added customer ID validation
- Improved error handling (continue on error instead of throw)
- Added console logging for debugging

---

## Test Cases

### Test Case 1: Single-Customer CSV ✅
**File:** `251103_最終版読み込み用 - Copy.csv`

**Structure:**
- Rows 1-14: Headers
- Row 15: Data

**Expected Result:**
- 1 customer imported successfully
- All fields correctly mapped

### Test Case 2: Multi-Customer CSV ✅
**File:** `OCAT_サンプル入力提出用0251117.csv`

**Structure:**
- Row 1: File identifier
- Rows 2-15: Headers (14 rows)
- Rows 16-25: 10 customer records
- Rows 26+: Empty padding

**Expected Result:**
- 10 customers imported successfully
- Empty rows skipped automatically
- Each customer gets separate assessment records

### Test Case 3: Mixed Data Quality ✅
**Scenario:** CSV with some invalid rows

**Expected Result:**
- Valid rows processed successfully
- Invalid rows skipped with console warnings
- Process continues to completion
- Final count shows only successful imports

---

## Backward Compatibility

✅ **Single-customer CSV import still works exactly as before**

The detection logic ensures:
- If no file identifier detected → Uses old logic (header starts at row 0)
- If file identifier detected → Uses new logic (header starts at row 1)

No breaking changes to existing functionality.

---

## Validation Checklist

Before considering this feature complete, verify:

- [x] Single-customer CSV imports correctly
- [x] Multi-customer CSV imports all valid rows
- [x] Empty rows are skipped
- [x] Missing customer IDs handled gracefully
- [x] Database errors don't crash entire import
- [x] Progress bar updates correctly
- [x] Toast notification shows correct count
- [x] Console logs help with debugging
- [x] No linter errors
- [x] Backward compatible with existing CSVs

---

## Known Limitations

1. **Max 500 customers per CSV** - This is a hardcoded limit for performance
2. **File identifier detection is heuristic-based** - Relies on absence of keywords "今回"/"前回" in row 1
3. **No partial rollback** - If 50 of 100 customers fail, the first 50 remain in database

---

## Debugging

If import still fails, check browser console for:

```javascript
// Look for these messages:
"Skipping row without customer ID"
"Customer upsert error for ID XXXXX:"
"Assessment insert error for customer ID XXXXX:"

// These indicate which specific rows/customers are failing
```

---

## Future Improvements

1. **Transaction support** - All-or-nothing import with rollback on error
2. **Validation report** - Show which rows succeeded/failed before import
3. **Custom column mapping** - Allow users to map columns if format differs
4. **File format detection** - Support Excel, multiple sheets, etc.
5. **Duplicate detection** - Warn if customer ID already exists before importing

---

## Summary

This fix enables the application to handle both single-customer and multi-customer CSV files by:
1. **Auto-detecting** the CSV format
2. **Correctly parsing** headers regardless of file identifier presence
3. **Skipping invalid data** gracefully
4. **Continuing on errors** to maximize successful imports

The solution is **backward compatible**, **robust**, and **ready for production use**.

