# Presentation: Hierarchy & Taxonomy Analyzer
## Duration: 5 minutes | Audience: VP of Services

---

## 🎯 PRESENTATION STRUCTURE

| Time | Section | Focus |
|------|---------|-------|
| 0:00-0:30 | Problem | Context and customer pain point |
| 0:30-1:30 | Solution | Automated analysis demo |
| 1:30-3:00 | Demo | Upload + Results |
| 3:00-4:00 | Value | PDF Report + Insights |
| 4:00-5:00 | Next Steps | Roadmap |

---

## 📝 DETAILED SCRIPT

### 1. THE PROBLEM (30 seconds)

**What to say:**
> "When we receive product data from a customer for Salsify import, we spend hours manually analyzing the hierarchical structure. We need to identify:
> - What is the Record ID?
> - What is the taxonomy?
> - Is it a flat or hierarchical model?
> - Is the data ready for import?
>
> This manual process is time-consuming and error-prone."

---

### 2. THE SOLUTION (1 minute)

**What to say:**
> "I built a tool that automates this analysis. In seconds, the system:
> 1. **Automatically detects** the data model type (Flat, Parent-Variant, Multi-Level)
> 2. **Identifies** Record ID, Record Name, and taxonomy properties
> 3. **Validates** data quality and flags issues
> 4. **Generates a PDF report** to support us on customers calls"

---

### 3. LIVE DEMO (1:30 minutes)

**Steps to follow:**

#### Step 1: File Upload
- Drag an Excel file into the app
- **Say:** "Just drag and drop the customer's file..."

#### Step 2: Instant Analysis
- Show the automatic results:
  - **Model Badge** (Multi-Level Hierarchy / Parent-Variant / Flat)
  - **Detected levels** with property count
  - **Record ID and Record Name** automatically suggested
- **Say:** "In less than 1 second, we have the complete structure analyzed"

#### Step 3: Taxonomy Validation
- Show the Taxonomy Properties section
- **Say:** "We automatically identify taxonomy properties and validate if they're at the correct level"

#### Step 4: Quality Warnings
- Show the Data Quality Warnings
- **Say:** "The tool detects critical issues like duplicate or empty Record IDs, showing exactly which rows are affected"

#### Step 5: Data Preview
- Show the data table
- **Say:** "We can preview the data to confirm the analysis"

---

### 4. PDF REPORT (1 minute)

**What to do:**
- Click "Export PDF Report"
- Open the generated PDF

**What to say:**
> "With one click, we generate an executive report with:
> - **Executive Summary** - key file metrics
> - **Hierarchy Visualization** - clear level structure
> - **Taxonomy** - category tree with validation
> - **Data Quality Assessment** - quality score and issues to resolve
> - **Recommendations** - concrete actions for the customer
>
> This PDF can support us on customers calls"

---

### 5. VALUE & NEXT STEPS (1 minute)

**What to say:**
> "**Impact:**
> - Reduces analysis time from **hours to seconds**
> - Eliminates human errors in structure identification
>
> **Possible next steps:**
> - Salsify integration for import pre-validation
> - Batch analysis of multiple files"

---

## ⚠️ PRESENTATION TIPS

1. **Have 2-3 files ready** with different structures:
   - A **flat** file (simple products)
   - A **parent-variant** file (e.g., clothing with sizes)
   - A **multi-level** file (e.g., hierarchical categories)

2. **Prepare a file with errors** to show:
   - Duplicate Record IDs
   - Empty values
   - Shows that the tool detects and indicates the rows

3. **Don't go into technical details** - focus on business value

4. **Have a pre-generated PDF** as backup in case something fails

---

## 💬 FREQUENTLY ASKED QUESTIONS

**"Does it work with any Excel file?"**
> Yes, as long as it has headers in the first row. Supports .xlsx and .xls.

**"Does this replace the consultant's work?"**
> No, it accelerates the work. The consultant still validates and makes decisions, but with structured information.

---

## 🔬 TECHNICAL APPENDIX (For Technical Questions)

### How Initial Analysis Works

The system analyzes each column using two key metrics:

| Metric | Formula | Purpose |
|--------|---------|---------|
| **Cardinality** | `unique_values / total_values` | Measures uniqueness (0 = all same, 1 = all unique) |
| **Completeness** | `filled_rows / total_rows` | Measures data density (0 = empty, 1 = all filled) |

**Hierarchy Score Calculation:**
```
IF completeness >= 80%:
  - cardinality <= 5%  → Score 100 (Parent Level: Brand, Category)
  - cardinality <= 30% → Score 75  (Mid Level: Subcategory)
  - cardinality <= 70% → Score 50  (Variant: Color, Size)
  - cardinality > 70%  → Score 25  (SKU: EAN, SKU code)
IF completeness 50-80%:
  → Score 40 (Variant/Attribute)
IF completeness < 50%:
  → Score 10 (Sparse - never top level)
```

**Level Classification (Initial Analysis - More Tolerant):**
- **Level 1 (Parent):** hierarchyScore ≥ 50, completeness ≥ 60%, cardinality ≤ 30%
- **Level 2 (Mid):** hierarchyScore 25-50, completeness ≥ 50%, cardinality < 70%
- **SKU Level:** Everything else (low score OR high uniqueness OR sparse data)

### How Presets Work

Presets use **stricter criteria** than initial analysis:

| Preset | Levels | Use Case |
|--------|--------|----------|
| **Flat Model** | 1 | All properties at product level, no hierarchy |
| **Parent-Variant** | 2 | Taxonomy → SKU details (most common) |
| **Multi-Level PIM** | 3 | Family → Model → Variant (complex catalogs) |

**Preset Selection Logic:**
- Uses the **same property distribution** as initial analysis
- Preserves Record ID/Name selections
- Automatically assigns properties to correct levels

### How Taxonomy Detection Works

Taxonomy properties are identified by:

1. **Keyword matching:** L1, L2, L3, Level, Category, Sector, Division, Class, Family
2. **Cardinality analysis:** Low cardinality (< 30%) + High completeness (> 60%)
3. **Pattern detection:** Hierarchical naming patterns (e.g., "Electronics > Phones > Smartphones")

**Taxonomy Validation:**
- ✅ OK: Taxonomy property is at Parent Level (Level 1)
- ❌ NOK: Taxonomy property is at SKU Level (should be moved up)

### Data Protection Guarantee

**CRITICAL:** The system includes a "Safety Net" that:
1. Counts all properties BEFORE any operation
2. Counts all properties AFTER the operation
3. If any property is missing → automatically recovers it to SKU level
4. Logs all movements for debugging

```
✅ SUCCESS: All properties accounted for after consolidation
```

This ensures **NO DATA IS EVER LOST** during:
- Initial analysis
- Preset selection
- SKU level forcing
- Level consolidation

---

## 🚀 BEFORE THE PRESENTATION

- [ ] App running locally (`npm run dev`)
- [ ] 3 test Excel files ready
- [ ] Browser in fullscreen
- [ ] Sample PDF already generated (backup)
- [ ] Notes printed or on a second screen
