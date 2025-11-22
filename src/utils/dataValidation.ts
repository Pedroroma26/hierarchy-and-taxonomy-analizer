export interface DataValidationWarning {
  type: 'duplicate' | 'inconsistency' | 'normalization' | 'outlier' | 'missing_hierarchy';
  severity: 'low' | 'medium' | 'high';
  title: string;
  message: string;
  affectedRows: number[];
  affectedCount: number;
  suggestion: string;
  examples?: string[];
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
  hierarchyHeaders: string[]
): ValidationResult => {
  const warnings: DataValidationWarning[] = [];

  // 1. Detect duplicate products
  const duplicateWarnings = detectDuplicates(headers, data);
  warnings.push(...duplicateWarnings);

  // 2. Detect inconsistent values (normalization opportunities)
  const inconsistencyWarnings = detectInconsistencies(headers, data);
  warnings.push(...inconsistencyWarnings);

  // 3. Detect missing hierarchy values
  const missingHierarchyWarnings = detectMissingHierarchyValues(headers, data, hierarchyHeaders);
  warnings.push(...missingHierarchyWarnings);

  // 4. Detect outliers
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
      const exampleRows = duplicates[0][1].slice(0, 3).join(', ');
      warnings.push({
        type: 'duplicate',
        severity: 'high',
        title: `Duplicate ${header} Values Detected`,
        message: `Found ${duplicates.length} duplicate values in "${header}" affecting ${affectedRows.length} products`,
        affectedRows,
        affectedCount: affectedRows.length,
        suggestion: `Review and ensure each product has a unique ${header}. Consider adding a suffix or correcting data entry errors.`,
        examples: [`${exampleRows}`],
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
        title: `Inconsistent Values in "${header}"`,
        message: `Found ${inconsistentGroups.length} groups of values with inconsistent capitalization or spacing`,
        affectedRows,
        affectedCount: affectedRows.length,
        suggestion: `Consider normalizing these values for consistency. This will improve data quality and hierarchy detection.`,
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
        title: `Missing Values in Hierarchy Field "${hierarchyHeader}"`,
        message: `${missingRows.length} products (${percentage}%) are missing values in "${hierarchyHeader}"`,
        affectedRows: missingRows,
        affectedCount: missingRows.length,
        suggestion: `These products cannot be properly categorized in the hierarchy. Consider treating them as standalone products or filling in the missing values.`,
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
        title: `Potential Outliers in "${header}"`,
        message: `Found ${outlierRows.length} values that are significantly different from the typical range`,
        affectedRows: outlierRows,
        affectedCount: outlierRows.length,
        suggestion: `Review these values to ensure they are correct. Outliers might indicate data entry errors or exceptional products.`,
        examples,
      });
    }
  });

  return warnings;
};
