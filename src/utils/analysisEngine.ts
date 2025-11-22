import { CardinalityScore } from '@/components/CardinalityAnalysis';
import { HierarchyLevel } from '@/components/HierarchyProposal';
import { TaxonomyPath } from '@/components/TaxonomyResults';

export interface PropertyRecommendation {
  header: string;
  dataType: 'string' | 'number' | 'html' | 'picklist' | 'digital_asset' | 'url' | 'yes_no';
  isPicklist: boolean;
  picklistValues?: string[];
  confidence: number;
}

export interface UomSuggestion {
  header: string;
  detectedUom: string;
  suggestedSplit: boolean;
  suggestedConversions?: {
    targetUom: string;
    newPropertyName: string;
  }[];
}

export interface ProductDomain {
  type: 'Electronics' | 'Apparel' | 'Food' | 'Furniture' | 'General';
  confidence: number;
  indicators: string[];
}

export interface HierarchyAlternative {
  name: string;
  hierarchy: HierarchyLevel[];
  properties: string[];
  confidence: number;
  reasoning: string;
}

export interface OrphanedRecord {
  rowIndex: number;
  issues: string[];
  severity: 'low' | 'medium' | 'high';
}

export interface AnalysisResult {
  cardinalityScores: CardinalityScore[];
  hierarchy: HierarchyLevel[];
  properties: string[];
  taxonomyPaths: TaxonomyPath[];
  recordIdSuggestion: string | null;
  recordNameSuggestion: string | null;
  propertyRecommendations: PropertyRecommendation[];
  uomSuggestions: UomSuggestion[];
  productDomain: ProductDomain;
  hierarchyConfidence: number;
  alternativeHierarchies: HierarchyAlternative[];
  orphanedRecords: OrphanedRecord[];
  thresholds: {
    low: number;
    medium: number;
  };
}

// Thresholds for classification
export let LOW_CARDINALITY_THRESHOLD = 0.1; // High repetition (10% unique)
export let MEDIUM_CARDINALITY_THRESHOLD = 0.5; // Medium repetition (50% unique)

export const updateThresholds = (low: number, medium: number) => {
  LOW_CARDINALITY_THRESHOLD = low;
  MEDIUM_CARDINALITY_THRESHOLD = medium;
};

export const analyzeProductData = (
  headers: string[],
  data: any[][],
  customThresholds?: { low: number; medium: number }
): AnalysisResult => {
  // Use custom thresholds if provided
  if (customThresholds) {
    updateThresholds(customThresholds.low, customThresholds.medium);
  }

  // Detect product domain
  const productDomain = detectProductDomain(headers, data);

  // Calculate cardinality scores
  const cardinalityScores = calculateCardinalityScores(headers, data);

  // Determine hierarchy based on cardinality
  const { hierarchy, properties, confidence } = determineHierarchy(
    cardinalityScores, 
    headers, 
    productDomain
  );

  // Generate alternative hierarchies
  const alternativeHierarchies = generateAlternativeHierarchies(
    cardinalityScores,
    headers,
    productDomain
  );

  // Generate taxonomy paths
  const taxonomyPaths = generateTaxonomyPaths(hierarchy, data, headers);

  // Suggest Record ID and Name
  const recordIdSuggestion = suggestRecordId(headers, data);
  const recordNameSuggestion = suggestRecordName(headers, data);

  // Analyze property data types and picklists
  const propertyRecommendations = analyzePropertyTypes(headers, data, cardinalityScores);

  // Detect UOM patterns and suggest conversions
  const uomSuggestions = analyzeUomPatterns(headers, data);

  // Detect orphaned/inconsistent records
  const orphanedRecords = detectOrphanedRecords(hierarchy, data, headers);

  return {
    cardinalityScores,
    hierarchy,
    properties,
    taxonomyPaths,
    recordIdSuggestion,
    recordNameSuggestion,
    propertyRecommendations,
    uomSuggestions,
    productDomain,
    hierarchyConfidence: confidence,
    alternativeHierarchies,
    orphanedRecords,
    thresholds: {
      low: LOW_CARDINALITY_THRESHOLD,
      medium: MEDIUM_CARDINALITY_THRESHOLD,
    },
  };
};

const calculateCardinalityScores = (
  headers: string[],
  data: any[][]
): CardinalityScore[] => {
  return headers.map((header, index) => {
    const columnData = data.map((row) => row[index]);
    const uniqueValues = new Set(columnData.filter((val) => val !== null && val !== undefined && val !== ''));
    const uniqueCount = uniqueValues.size;
    const totalCount = columnData.filter((val) => val !== null && val !== undefined && val !== '').length;
    const cardinality = totalCount > 0 ? uniqueCount / totalCount : 0;

    let classification: 'high' | 'medium' | 'low';
    if (cardinality >= MEDIUM_CARDINALITY_THRESHOLD) {
      classification = 'high';
    } else if (cardinality >= LOW_CARDINALITY_THRESHOLD) {
      classification = 'medium';
    } else {
      classification = 'low';
    }

    return {
      header,
      uniqueCount,
      totalCount,
      cardinality,
      classification,
    };
  });
};

const detectProductDomain = (headers: string[], data: any[][]): ProductDomain => {
  const headerText = headers.join(' ').toLowerCase();
  const sampleData = data.slice(0, 20).flat().map(v => String(v).toLowerCase()).join(' ');
  const allText = headerText + ' ' + sampleData;

  const domainIndicators = {
    Electronics: {
      keywords: ['processor', 'ram', 'gb', 'cpu', 'gpu', 'screen', 'battery', 'wifi', 'bluetooth', 'voltage', 'watt', 'mhz', 'ghz', 'storage', 'ssd', 'hdd'],
      score: 0,
      found: [] as string[],
    },
    Apparel: {
      keywords: ['size', 'color', 'fabric', 'material', 'sleeve', 'collar', 'fit', 'waist', 'inseam', 'cotton', 'polyester', 'xl', 'small', 'medium', 'large'],
      score: 0,
      found: [] as string[],
    },
    Food: {
      keywords: ['flavor', 'ingredients', 'nutrition', 'calories', 'protein', 'carbs', 'serving', 'allergen', 'organic', 'vegan', 'gluten', 'dairy', 'expiry', 'shelf life'],
      score: 0,
      found: [] as string[],
    },
    Furniture: {
      keywords: ['wood', 'upholstery', 'assembly', 'seat', 'drawer', 'shelf', 'table', 'chair', 'sofa', 'cabinet', 'desk', 'finish', 'veneer'],
      score: 0,
      found: [] as string[],
    },
  };

  // Score each domain
  Object.entries(domainIndicators).forEach(([domain, info]) => {
    info.keywords.forEach(keyword => {
      if (allText.includes(keyword)) {
        info.score++;
        info.found.push(keyword);
      }
    });
  });

  // Find best match
  const sorted = Object.entries(domainIndicators)
    .map(([type, info]) => ({
      type: type as ProductDomain['type'],
      score: info.score,
      indicators: info.found,
    }))
    .sort((a, b) => b.score - a.score);

  const winner = sorted[0];
  const totalKeywords = Object.values(domainIndicators).reduce((sum, d) => sum + d.keywords.length, 0);
  const confidence = winner.score > 0 ? Math.min(winner.score / 5, 0.95) : 0.3;

  return {
    type: winner.score > 2 ? winner.type : 'General',
    confidence,
    indicators: winner.indicators.slice(0, 5),
  };
};

const determineHierarchy = (
  cardinalityScores: CardinalityScore[],
  headers: string[],
  productDomain: ProductDomain
): { hierarchy: HierarchyLevel[]; properties: string[]; confidence: number } => {
  // Sort by cardinality (low to high)
  const sortedScores = [...cardinalityScores].sort(
    (a, b) => a.cardinality - b.cardinality
  );

  const hierarchy: HierarchyLevel[] = [];
  const properties: string[] = [];

  // Classify headers by cardinality
  const lowCardinalityHeaders = sortedScores
    .filter((score) => score.classification === 'low')
    .map((score) => score.header);

  const mediumCardinalityHeaders = sortedScores
    .filter((score) => score.classification === 'medium')
    .map((score) => score.header);

  const highCardinalityHeaders = sortedScores
    .filter((score) => score.classification === 'high')
    .map((score) => score.header);

  // Determine if we have enough structure for a hierarchy
  const totalLowMedium = lowCardinalityHeaders.length + mediumCardinalityHeaders.length;
  let confidence = 0.5;

  // Apply domain-specific logic
  if (productDomain.type === 'Apparel') {
    // For apparel, size and color are typically variants, not hierarchy
    const variantHeaders = lowCardinalityHeaders.filter(h => 
      !['size', 'color', 'colour'].some(v => h.toLowerCase().includes(v))
    );
    
    if (variantHeaders.length < totalLowMedium) {
      confidence = 0.7; // Higher confidence when we filter out variants
    }
  }
  
  // Build hierarchy intelligently based on available data
  if (totalLowMedium === 0) {
    // No repetitive data - Flat Model
    hierarchy.push({
      level: 1,
      name: 'Flat Model - No Clear Hierarchy Detected',
      headers: headers.slice(0, Math.min(2, headers.length)),
    });
    properties.push(...headers.slice(Math.min(2, headers.length)));
    confidence = 0.3;
  } else if (totalLowMedium === 1) {
    // Only 1 repetitive field - Single Level
    hierarchy.push({
      level: 1,
      name: 'Single Category Level',
      headers: [...lowCardinalityHeaders, ...mediumCardinalityHeaders].slice(0, 1),
    });
    properties.push(...highCardinalityHeaders);
    confidence = 0.6;
  } else if (totalLowMedium === 2) {
    // 2 repetitive fields - Two Level Hierarchy
    const combinedHeaders = [...lowCardinalityHeaders, ...mediumCardinalityHeaders];
    hierarchy.push({
      level: 1,
      name: 'Parent Category',
      headers: [combinedHeaders[0]],
    });
    hierarchy.push({
      level: 2,
      name: 'Child Category',
      headers: [combinedHeaders[1]],
    });
    properties.push(...highCardinalityHeaders);
    confidence = 0.75;
  } else if (totalLowMedium === 3) {
    // 3 repetitive fields - Three Level Hierarchy
    const combinedHeaders = [...lowCardinalityHeaders, ...mediumCardinalityHeaders];
    hierarchy.push({
      level: 1,
      name: 'Parent Category',
      headers: [combinedHeaders[0]],
    });
    hierarchy.push({
      level: 2,
      name: 'Child Category',
      headers: [combinedHeaders[1]],
    });
    hierarchy.push({
      level: 3,
      name: 'Grandchild Category',
      headers: [combinedHeaders[2]],
    });
    properties.push(...highCardinalityHeaders);
    confidence = 0.85;
  } else {
    // 4+ repetitive fields - Multi-level Hierarchy (max 3 levels)
    const combinedHeaders = [...lowCardinalityHeaders, ...mediumCardinalityHeaders];
    
    // Level 1: Use the most repetitive (lowest cardinality)
    hierarchy.push({
      level: 1,
      name: 'Parent Category',
      headers: combinedHeaders.slice(0, 1),
    });
    
    // Level 2: Next most repetitive
    hierarchy.push({
      level: 2,
      name: 'Child Category',
      headers: combinedHeaders.slice(1, 2),
    });
    
    // Level 3: Remaining low cardinality items
    if (combinedHeaders.length > 2) {
      hierarchy.push({
        level: 3,
        name: 'Grandchild Category',
        headers: combinedHeaders.slice(2, 3),
      });
    }
    
    // Everything else becomes properties
    properties.push(...combinedHeaders.slice(3), ...highCardinalityHeaders);
    confidence = 0.8;
  }

  return { hierarchy, properties, confidence };
};

const generateAlternativeHierarchies = (
  cardinalityScores: CardinalityScore[],
  headers: string[],
  productDomain: ProductDomain
): HierarchyAlternative[] => {
  const alternatives: HierarchyAlternative[] = [];
  const sortedScores = [...cardinalityScores].sort((a, b) => a.cardinality - b.cardinality);
  
  const lowHeaders = sortedScores.filter(s => s.classification === 'low').map(s => s.header);
  const mediumHeaders = sortedScores.filter(s => s.classification === 'medium').map(s => s.header);
  const highHeaders = sortedScores.filter(s => s.classification === 'high').map(s => s.header);
  const combinedHeaders = [...lowHeaders, ...mediumHeaders];

  // Alternative 1: Two-level hierarchy (if we have 3+ repetitive fields)
  if (combinedHeaders.length >= 3) {
    const hierarchy: HierarchyLevel[] = [
      { level: 1, name: 'Parent Category', headers: combinedHeaders.slice(0, 1) },
      { level: 2, name: 'Child Category', headers: combinedHeaders.slice(1, 2) },
    ];
    const properties = [...combinedHeaders.slice(2), ...highHeaders];
    
    alternatives.push({
      name: 'Two-Level Structure',
      hierarchy,
      properties,
      confidence: 0.7,
      reasoning: 'Simpler structure with two levels, treating remaining fields as properties',
    });
  }

  // Alternative 2: Flat model with primary grouping
  if (combinedHeaders.length >= 1) {
    const hierarchy: HierarchyLevel[] = [
      { level: 1, name: 'Primary Category', headers: combinedHeaders.slice(0, 1) },
    ];
    const properties = [...combinedHeaders.slice(1), ...highHeaders];
    
    alternatives.push({
      name: 'Flat Model with Grouping',
      hierarchy,
      properties,
      confidence: 0.6,
      reasoning: 'Single level grouping, all other fields as product attributes',
    });
  }

  // Alternative 3: Detailed hierarchy (if we have 4+ fields)
  if (combinedHeaders.length >= 4) {
    const hierarchy: HierarchyLevel[] = [
      { level: 1, name: 'Parent Category', headers: [combinedHeaders[0]] },
      { level: 2, name: 'Child Category', headers: [combinedHeaders[1]] },
      { level: 3, name: 'Subcategory', headers: [combinedHeaders[2]] },
    ];
    const properties = [...combinedHeaders.slice(3), ...highHeaders];
    
    alternatives.push({
      name: 'Three-Level Detailed',
      hierarchy,
      properties,
      confidence: 0.75,
      reasoning: 'Detailed three-level taxonomy for complex categorization',
    });
  }

  return alternatives.slice(0, 3); // Return max 3 alternatives
};

const detectOrphanedRecords = (
  hierarchy: HierarchyLevel[],
  data: any[][],
  headers: string[]
): OrphanedRecord[] => {
  const orphaned: OrphanedRecord[] = [];
  const hierarchyHeaders = hierarchy.flatMap(h => h.headers);
  
  data.forEach((row, rowIndex) => {
    const issues: string[] = [];
    let severity: OrphanedRecord['severity'] = 'low';

    // Check for missing hierarchy values
    hierarchyHeaders.forEach(header => {
      const colIndex = headers.indexOf(header);
      const value = row[colIndex];
      if (!value || value === '' || value === null || value === undefined) {
        issues.push(`Missing value for hierarchy field: ${header}`);
        severity = 'high';
      }
    });

    // Check for unique combinations (potential duplicates)
    const hierarchyValues = hierarchyHeaders.map(h => {
      const idx = headers.indexOf(h);
      return row[idx];
    }).filter(Boolean);

    if (hierarchyValues.length < hierarchyHeaders.length) {
      issues.push('Incomplete hierarchy path');
      // Only set to medium if not already high
      if (severity === 'low') {
        severity = 'medium';
      }
    }

    // Check for extreme outliers in numeric fields
    headers.forEach((header, colIndex) => {
      const value = row[colIndex];
      if (value && !isNaN(Number(value))) {
        const columnValues = data.map(r => r[colIndex]).filter(v => v && !isNaN(Number(v))).map(Number);
        const mean = columnValues.reduce((a, b) => a + b, 0) / columnValues.length;
        const stdDev = Math.sqrt(columnValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / columnValues.length);
        
        if (Math.abs(Number(value) - mean) > 3 * stdDev) {
          issues.push(`Outlier value in ${header}: ${value}`);
          // Outliers are low severity, don't change if already higher
        }
      }
    });

    if (issues.length > 0) {
      orphaned.push({ rowIndex: rowIndex + 2, issues, severity }); // +2 for header row and 0-index
    }
  });

  return orphaned.slice(0, 50); // Return max 50 orphaned records
};

const generateTaxonomyPaths = (
  hierarchy: HierarchyLevel[],
  data: any[][],
  headers: string[]
): TaxonomyPath[] => {
  const taxonomyMap = new Map<string, TaxonomyPath>();

  // Get all hierarchy headers in order
  const hierarchyHeaders = hierarchy.flatMap((level) => level.headers);
  const propertyHeaders = headers.filter(
    (header) => !hierarchyHeaders.includes(header)
  );

  // Build taxonomy paths
  data.forEach((row) => {
    const pathSegments = hierarchyHeaders.map((header) => {
      const index = headers.indexOf(header);
      return row[index] || 'Unknown';
    });

    const pathKey = pathSegments.join(' > ');

    if (!taxonomyMap.has(pathKey)) {
      taxonomyMap.set(pathKey, {
        path: pathSegments,
        productCount: 0,
        properties: propertyHeaders,
      });
    }

    const taxonomy = taxonomyMap.get(pathKey)!;
    taxonomy.productCount++;
  });

  return Array.from(taxonomyMap.values()).sort(
    (a, b) => b.productCount - a.productCount
  );
};

const suggestRecordId = (headers: string[], data: any[][]): string | null => {
  // Look for common ID field names
  const idKeywords = ['id', 'sku', 'product_id', 'item_id', 'code', 'product_code', 'item_code'];
  
  for (const header of headers) {
    const headerLower = header.toLowerCase();
    if (idKeywords.some(keyword => headerLower.includes(keyword))) {
      // Check if values are unique
      const index = headers.indexOf(header);
      const columnData = data.map(row => row[index]);
      const uniqueValues = new Set(columnData.filter(val => val !== null && val !== undefined && val !== ''));
      
      if (uniqueValues.size === columnData.filter(val => val !== null && val !== undefined && val !== '').length) {
        return header;
      }
    }
  }
  
  // If no clear ID found, suggest the first column with 100% unique values
  for (let i = 0; i < headers.length; i++) {
    const columnData = data.map(row => row[i]);
    const uniqueValues = new Set(columnData.filter(val => val !== null && val !== undefined && val !== ''));
    const totalCount = columnData.filter(val => val !== null && val !== undefined && val !== '').length;
    
    if (uniqueValues.size === totalCount && totalCount > 0) {
      return headers[i];
    }
  }
  
  return null;
};

const suggestRecordName = (headers: string[], data: any[][]): string | null => {
  // Look for common name field names
  const nameKeywords = ['name', 'title', 'product_name', 'item_name', 'description', 'product_title'];
  
  for (const header of headers) {
    const headerLower = header.toLowerCase();
    if (nameKeywords.some(keyword => headerLower.includes(keyword))) {
      return header;
    }
  }
  
  return null;
};

const analyzePropertyTypes = (
  headers: string[],
  data: any[][],
  cardinalityScores: CardinalityScore[]
): PropertyRecommendation[] => {
  return headers.map((header, index) => {
    const columnData = data.map(row => row[index]).filter(val => val !== null && val !== undefined && val !== '');
    const score = cardinalityScores.find(s => s.header === header)!;
    
    // Determine data type
    let dataType: PropertyRecommendation['dataType'] = 'string';
    let isPicklist = false;
    let picklistValues: string[] | undefined;
    let confidence = 0.5;
    
    // Check if picklist (low-medium cardinality, limited unique values)
    if (score.uniqueCount <= 20 && score.cardinality < 0.3) {
      isPicklist = true;
      dataType = 'picklist';
      picklistValues = Array.from(new Set(columnData.map(v => String(v)))).slice(0, 20);
      confidence = 0.9;
    }
    // Check if yes/no
    else if (score.uniqueCount <= 5) {
      const uniqueValues = Array.from(new Set(columnData.map(v => String(v).toLowerCase())));
      const yesNoPatterns = ['yes', 'no', 'true', 'false', 'y', 'n', '1', '0'];
      if (uniqueValues.every(v => yesNoPatterns.includes(v))) {
        dataType = 'yes_no';
        confidence = 0.95;
      }
    }
    // Check if number
    else if (columnData.every(val => !isNaN(Number(val)))) {
      dataType = 'number';
      confidence = 0.9;
    }
    // Check if URL
    else if (columnData.some(val => {
      const str = String(val);
      return str.startsWith('http://') || str.startsWith('https://') || str.startsWith('www.');
    })) {
      const urlCount = columnData.filter(val => {
        const str = String(val);
        return str.startsWith('http://') || str.startsWith('https://') || str.startsWith('www.');
      }).length;
      
      if (urlCount / columnData.length > 0.7) {
        // Check if likely images
        if (columnData.some(val => {
          const str = String(val).toLowerCase();
          return str.match(/\.(jpg|jpeg|png|gif|webp|svg)$/);
        })) {
          dataType = 'digital_asset';
          confidence = 0.85;
        } else {
          dataType = 'url';
          confidence = 0.85;
        }
      }
    }
    // Check if HTML
    else if (columnData.some(val => {
      const str = String(val);
      return str.includes('<') && str.includes('>');
    })) {
      const htmlCount = columnData.filter(val => {
        const str = String(val);
        return str.includes('<') && str.includes('>');
      }).length;
      
      if (htmlCount / columnData.length > 0.5) {
        dataType = 'html';
        confidence = 0.8;
      }
    }
    
    return {
      header,
      dataType,
      isPicklist,
      picklistValues,
      confidence,
    };
  });
};

const analyzeUomPatterns = (headers: string[], data: any[][]): UomSuggestion[] => {
  const suggestions: UomSuggestion[] = [];
  const uomKeywords = ['width', 'height', 'length', 'depth', 'weight', 'size', 'dimension'];
  const uomPatterns = {
    inch: /(\d+\.?\d*)\s*(inch|inches|in|")/i,
    cm: /(\d+\.?\d*)\s*(cm|centimeter|centimeters)/i,
    mm: /(\d+\.?\d*)\s*(mm|millimeter|millimeters)/i,
    kg: /(\d+\.?\d*)\s*(kg|kilogram|kilograms)/i,
    lb: /(\d+\.?\d*)\s*(lb|lbs|pound|pounds)/i,
    oz: /(\d+\.?\d*)\s*(oz|ounce|ounces)/i,
  };
  
  headers.forEach((header, index) => {
    const headerLower = header.toLowerCase();
    const columnData = data.map(row => row[index]).filter(val => val !== null && val !== undefined && val !== '');
    
    // Check if this is a dimensional/weight field
    if (uomKeywords.some(keyword => headerLower.includes(keyword))) {
      // Check if values contain UOM
      const sampleValues = columnData.slice(0, 10).map(v => String(v));
      let detectedUom = '';
      let hasEmbeddedUom = false;
      
      for (const [unit, pattern] of Object.entries(uomPatterns)) {
        if (sampleValues.some(val => pattern.test(val))) {
          detectedUom = unit;
          hasEmbeddedUom = true;
          break;
        }
      }
      
      // Check if there's a separate UOM column
      const uomColumnIndex = headers.findIndex(h => 
        h.toLowerCase().includes('uom') || h.toLowerCase().includes('unit')
      );
      
      if (hasEmbeddedUom) {
        // Suggest splitting value and UOM
        suggestions.push({
          header,
          detectedUom,
          suggestedSplit: true,
          suggestedConversions: getConversionSuggestions(detectedUom, header),
        });
      } else if (uomColumnIndex === -1 && !detectedUom) {
        // Check if all values are numbers (might have implicit UOM)
        const allNumeric = columnData.every(val => !isNaN(Number(val)));
        if (allNumeric) {
          suggestions.push({
            header,
            detectedUom: 'unknown',
            suggestedSplit: false,
            suggestedConversions: [],
          });
        }
      } else if (uomColumnIndex !== -1) {
        // Has separate UOM column, suggest conversions
        const uomValues = data.map(row => row[uomColumnIndex]).filter(val => val);
        const commonUom = String(uomValues[0]).toLowerCase();
        
        suggestions.push({
          header,
          detectedUom: commonUom,
          suggestedSplit: false,
          suggestedConversions: getConversionSuggestions(commonUom, header),
        });
      }
    }
  });
  
  return suggestions;
};

const getConversionSuggestions = (
  fromUom: string,
  propertyName: string
): { targetUom: string; newPropertyName: string }[] => {
  const conversions: { [key: string]: string[] } = {
    inch: ['cm', 'mm'],
    cm: ['inch', 'mm'],
    mm: ['inch', 'cm'],
    kg: ['lb'],
    lb: ['kg'],
    oz: ['g'],
  };
  
  const targetUnits = conversions[fromUom] || [];
  
  return targetUnits.map(targetUom => ({
    targetUom,
    newPropertyName: `${propertyName}_${targetUom}`,
  }));
};
