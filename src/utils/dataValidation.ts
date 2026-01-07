export interface DataValidationWarning {
  type: 'duplicate' | 'inconsistency' | 'normalization' | 'outlier' | 'missing_hierarchy' | 'salsify_compliance';
  severity: 'low' | 'medium' | 'high';
  title: string;
  message: string;
  affectedRows: number[];
  affectedCount: number;
  suggestion: string;
  examples?: string[];
  salsifyRule?: string; // Salsify-specific rule reference
}

export interface ValidationResult {
  warnings: DataValidationWarning[];
  totalIssues: number;
  criticalIssues: number;
}

/**
 * Validate data quality - WARNINGS ONLY, NO MODIFICATIONS
 */
// Fields that should be unique identifiers
const ID_KEYWORDS = [
  'sku', 'id', 'ean', 'upc', 'gtin', 'code', 'reference',
  'case', 'pallet', 'zuc', 'zun', 'barcode', 'article'
];

// Fields to exclude from validation (measurements, dates, descriptions)
const EXCLUDE_KEYWORDS = [
  'unit', 'uom', 'measure', 'weight', 'height', 'width', 'depth', 'length', 'size',
  'date', 'time', 'created', 'modified', 'updated', 'valid', 'expiry',
  'description', 'desc', 'text', 'comment', 'note', 'material'
];

export const validateData = (
  headers: string[],
  data: any[][],
  hierarchyHeaders: string[],
  recordIdField?: string,
  recordNameField?: string
): ValidationResult => {
  const warnings: DataValidationWarning[] = [];

  // 1. SALSIFY COMPLIANCE: Record ID validation
  const recordIdWarnings = validateRecordId(headers, data, recordIdField);
  warnings.push(...recordIdWarnings);

  // 2. SALSIFY COMPLIANCE: Record Name validation  
  const recordNameWarnings = validateRecordName(headers, data, recordNameField);
  warnings.push(...recordNameWarnings);

  // 3. Detect duplicate products
  const duplicateWarnings = detectDuplicates(headers, data);
  warnings.push(...duplicateWarnings);

  // 4. Detect inconsistent values (normalization opportunities)
  const inconsistencyWarnings = detectInconsistencies(headers, data);
  warnings.push(...inconsistencyWarnings);

  // 5. Detect missing hierarchy values
  const missingHierarchyWarnings = detectMissingHierarchyValues(headers, data, hierarchyHeaders);
  warnings.push(...missingHierarchyWarnings);

  // 6. Detect outliers
  const outlierWarnings = detectOutliers(headers, data);
  warnings.push(...outlierWarnings);

  const criticalIssues = warnings.filter(w => w.severity === 'high').length;

  return {
    warnings,
    totalIssues: warnings.length,
    criticalIssues,
  };
};

/**
 * SALSIFY COMPLIANCE: Validate Record ID field
 * - Cannot be empty
 * - Cannot start with underscore (_)
 * - Should not contain special characters
 * - Must be unique
 */
const validateRecordId = (
  headers: string[],
  data: any[][],
  recordIdField?: string
): DataValidationWarning[] => {
  const warnings: DataValidationWarning[] = [];
  
  if (!recordIdField) return warnings;
  
  const colIndex = headers.indexOf(recordIdField);
  if (colIndex === -1) return warnings;

  const emptyRows: number[] = [];
  const underscoreRows: number[] = [];
  const specialCharRows: number[] = [];
  const underscoreExamples: string[] = [];
  const specialCharExamples: string[] = [];

  data.forEach((row, rowIndex) => {
    const value = row[colIndex];
    const excelRow = rowIndex + 2;
    
    // Check empty
    if (value === null || value === undefined || String(value).trim() === '') {
      emptyRows.push(excelRow);
      return;
    }
    
    const strValue = String(value).trim();
    
    // Check starts with underscore
    if (strValue.startsWith('_')) {
      underscoreRows.push(excelRow);
      if (underscoreExamples.length < 3) underscoreExamples.push(strValue);
    }
    
    // Check special characters (allow only alphanumeric, dash, underscore)
    if (!/^[a-zA-Z0-9_-]+$/.test(strValue)) {
      specialCharRows.push(excelRow);
      if (specialCharExamples.length < 3) specialCharExamples.push(strValue);
    }
  });

  // Empty Record IDs - CRITICAL
  if (emptyRows.length > 0) {
    warnings.push({
      type: 'salsify_compliance',
      severity: 'high',
      title: `Empty Record ID Values`,
      message: `${emptyRows.length} products have no Record ID. Cannot import to Salsify.`,
      affectedRows: emptyRows,
      affectedCount: emptyRows.length,
      suggestion: `Every product must have a unique Record ID. Add values to these rows before import.`,
      salsifyRule: 'Record ID is required for all products',
    });
  }

  // Underscore prefix - CRITICAL
  if (underscoreRows.length > 0) {
    warnings.push({
      type: 'salsify_compliance',
      severity: 'high',
      title: `Record ID Starts with Underscore`,
      message: `${underscoreRows.length} Record IDs start with "_". Salsify rejects these.`,
      affectedRows: underscoreRows,
      affectedCount: underscoreRows.length,
      suggestion: `Remove leading underscore from Record IDs. Example: "_SKU123" → "SKU123"`,
      examples: underscoreExamples,
      salsifyRule: 'Record ID cannot start with underscore (_)',
    });
  }

  // Special characters - WARNING
  if (specialCharRows.length > 0) {
    warnings.push({
      type: 'salsify_compliance',
      severity: 'medium',
      title: `Record ID Contains Special Characters`,
      message: `${specialCharRows.length} Record IDs have special characters. May cause issues.`,
      affectedRows: specialCharRows,
      affectedCount: specialCharRows.length,
      suggestion: `Use only letters, numbers, dashes and underscores in Record IDs.`,
      examples: specialCharExamples,
      salsifyRule: 'Avoid special characters in Record ID',
    });
  }

  return warnings;
};

/**
 * SALSIFY COMPLIANCE: Validate Record Name field
 * - Should not be empty (recommended)
 */
const validateRecordName = (
  headers: string[],
  data: any[][],
  recordNameField?: string
): DataValidationWarning[] => {
  const warnings: DataValidationWarning[] = [];
  
  if (!recordNameField) return warnings;
  
  const colIndex = headers.indexOf(recordNameField);
  if (colIndex === -1) return warnings;

  const emptyRows: number[] = [];

  data.forEach((row, rowIndex) => {
    const value = row[colIndex];
    if (value === null || value === undefined || String(value).trim() === '') {
      emptyRows.push(rowIndex + 2);
    }
  });

  if (emptyRows.length > 0) {
    const percentage = ((emptyRows.length / data.length) * 100).toFixed(1);
    warnings.push({
      type: 'salsify_compliance',
      severity: 'medium',
      title: `Empty Record Name Values`,
      message: `${emptyRows.length} products (${percentage}%) have no Record Name.`,
      affectedRows: emptyRows,
      affectedCount: emptyRows.length,
      suggestion: `Add descriptive names for better product identification in Salsify.`,
      salsifyRule: 'Record Name recommended for all products',
    });
  }

  return warnings;
};

/**
 * Detect duplicate products based on key fields
 */
const detectDuplicates = (headers: string[], data: any[][]): DataValidationWarning[] => {
  const warnings: DataValidationWarning[] = [];

  headers.forEach((header, colIndex) => {
    const headerLower = header.toLowerCase();
    
    // Only check ID fields
    const isIDField = ID_KEYWORDS.some(kw => headerLower.includes(kw));
    
    // Skip excluded fields
    const isExcluded = EXCLUDE_KEYWORDS.some(kw => headerLower.includes(kw));
    
    if (!isIDField || isExcluded) {
      return; // Skip this field
    }

    const valueMap = new Map<string, number[]>();
    
    data.forEach((row, rowIndex) => {
      const value = row[colIndex];
      if (value !== null && value !== undefined && value !== '') {
        const valueStr = String(value).trim();
        if (!valueMap.has(valueStr)) {
          valueMap.set(valueStr, []);
        }
        valueMap.get(valueStr)!.push(rowIndex + 2); // +2 for Excel row number (header + 0-index)
      }
    });

    // Find duplicates
    const duplicates = Array.from(valueMap.entries()).filter(([_, indices]) => indices.length > 1);
    
    if (duplicates.length > 0) {
      const affectedRows = duplicates.flatMap(([_, indices]) => indices);
      const duplicateExamples = duplicates.slice(0, 3).map(([value, rows]) => 
        `"${value}" → Rows ${rows.slice(0, 3).join(', ')}${rows.length > 3 ? '...' : ''}`
      );
      warnings.push({
        type: 'duplicate',
        severity: 'high',
        title: `Duplicate ${header} Values`,
        message: `${duplicates.length} values appear multiple times. ${affectedRows.length} rows affected.`,
        affectedRows,
        affectedCount: affectedRows.length,
        suggestion: `Each ${header} must be unique. Add suffix or correct duplicates.`,
        examples: duplicateExamples,
        salsifyRule: 'Unique identifiers required for import',
      });
    }
  });

  return warnings;
};

/**
 * Detect inconsistent values that could be normalized
 */
const detectInconsistencies = (headers: string[], data: any[][]): DataValidationWarning[] => {
  const warnings: DataValidationWarning[] = [];

  headers.forEach((header, colIndex) => {
    const columnData = data.map(row => String(row[colIndex] || '').trim()).filter(v => v);
    const uniqueValues = Array.from(new Set(columnData));

    // Skip if too many unique values (likely not categorical)
    if (uniqueValues.length > 50 || uniqueValues.length < 2) return;

    // Group similar values (case-insensitive)
    const normalizedGroups = new Map<string, string[]>();
    
    uniqueValues.forEach(value => {
      const normalized = value.toLowerCase();
      if (!normalizedGroups.has(normalized)) {
        normalizedGroups.set(normalized, []);
      }
      normalizedGroups.get(normalized)!.push(value);
    });

    // Find groups with multiple variations
    const inconsistentGroups = Array.from(normalizedGroups.entries())
      .filter(([_, variations]) => variations.length > 1);

    if (inconsistentGroups.length > 0) {
      const affectedRows: number[] = [];
      const examples: string[] = [];

      inconsistentGroups.forEach(([normalized, variations]) => {
        variations.forEach(variation => {
          data.forEach((row, rowIndex) => {
            if (String(row[colIndex] || '').trim() === variation) {
              affectedRows.push(rowIndex);
            }
          });
        });

        if (examples.length < 3) {
          examples.push(`"${variations.join('", "')}" → suggest "${variations[0]}"`);
        }
      });

      warnings.push({
        type: 'normalization',
        severity: 'medium',
        title: `Inconsistent Capitalization in "${header}"`,
        message: `${inconsistentGroups.length} value groups have mixed case. Affects ${affectedRows.length} rows.`,
        affectedRows,
        affectedCount: affectedRows.length,
        suggestion: `Standardize to single format. Picklists require exact match.`,
        examples,
      });
    }
  });

  return warnings;
};

/**
 * Detect missing hierarchy values
 */
const detectMissingHierarchyValues = (
  headers: string[],
  data: any[][],
  hierarchyHeaders: string[]
): DataValidationWarning[] => {
  const warnings: DataValidationWarning[] = [];

  if (hierarchyHeaders.length === 0) return warnings;

  hierarchyHeaders.forEach(hierarchyHeader => {
    const colIndex = headers.indexOf(hierarchyHeader);
    if (colIndex === -1) return;

    const missingRows: number[] = [];
    
    data.forEach((row, rowIndex) => {
      const value = row[colIndex];
      if (value === null || value === undefined || String(value).trim() === '') {
        missingRows.push(rowIndex);
      }
    });

    if (missingRows.length > 0) {
      const percentage = ((missingRows.length / data.length) * 100).toFixed(1);
      
      warnings.push({
        type: 'missing_hierarchy',
        severity: missingRows.length / data.length > 0.1 ? 'high' : 'medium',
        title: `Missing "${hierarchyHeader}" Values`,
        message: `${missingRows.length} of ${data.length} products (${percentage}%) have no value.`,
        affectedRows: missingRows,
        affectedCount: missingRows.length,
        suggestion: `Fill missing values or treat as standalone products.`,
      });
    }
  });

  return warnings;
};

/**
 * Detect outliers in numeric fields
 */
const detectOutliers = (headers: string[], data: any[][]): DataValidationWarning[] => {
  const warnings: DataValidationWarning[] = [];

  headers.forEach((header, colIndex) => {
    const columnData = data.map(row => row[colIndex]).filter(v => v !== null && v !== undefined);
    
    // Check if mostly numeric
    const numericValues = columnData.filter(v => !isNaN(Number(v))).map(v => Number(v));
    
    if (numericValues.length < columnData.length * 0.8 || numericValues.length < 10) return;

    // Calculate statistics
    const sorted = [...numericValues].sort((a, b) => a - b);
    const q1 = sorted[Math.floor(sorted.length * 0.25)];
    const q3 = sorted[Math.floor(sorted.length * 0.75)];
    const iqr = q3 - q1;
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;

    // Find outliers
    const outlierRows: number[] = [];
    const outlierValues: number[] = [];

    data.forEach((row, rowIndex) => {
      const value = Number(row[colIndex]);
      if (!isNaN(value) && (value < lowerBound || value > upperBound)) {
        outlierRows.push(rowIndex);
        outlierValues.push(value);
      }
    });

    if (outlierRows.length > 0 && outlierRows.length < data.length * 0.1) {
      const examples = outlierValues.slice(0, 5).map(v => v.toString());
      
      warnings.push({
        type: 'outlier',
        severity: 'low',
        title: `Unusual Values in "${header}"`,
        message: `${outlierRows.length} values outside normal range (${lowerBound.toFixed(0)}-${upperBound.toFixed(0)}).`,
        affectedRows: outlierRows,
        affectedCount: outlierRows.length,
        suggestion: `Verify if these are correct or data entry errors.`,
        examples,
      });
    }
  });

  return warnings;
};
