import { CardinalityScore } from '@/components/CardinalityAnalysis';
import { HierarchyLevel } from '@/components/HierarchyProposal';

export interface TaxonomyPath {
  path: string[];
  productCount: number;
  properties: string[];
}

export interface PropertyRecommendation {
  header: string;
  dataType: 'string' | 'picklist' | 'number' | 'date' | 'yes_no' | 'rich_text' | 'html' | 'link' | 'digital_asset';
  isPicklist: boolean;
  picklistValues?: string[];
  confidence: number;
  reasoning?: string;
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
  modelType: 'standalone' | 'hierarchical' | 'mixed';
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
  propertiesWithoutValues: string[]; // Properties with no data - uncertain hierarchy level
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
    parent: number;
    childrenMin: number;
    childrenMax: number;
    sku: number;
  };
}

// Thresholds for 4-level cardinality classification
export let PARENT_THRESHOLD = 0.02; // ≤2% unique = Parent (Level 1)
export let CHILDREN_THRESHOLD_MIN = 0.50; // 50% unique = Children start (Level 2)
export let CHILDREN_THRESHOLD_MAX = 0.75; // 75% unique = Children end (Level 3)
export let SKU_THRESHOLD = 0.98; // ≥98% unique = SKU/Attribute (Level 4)

export const updateThresholds = (parent: number, childrenMin: number, childrenMax: number, sku: number) => {
  PARENT_THRESHOLD = parent;
  CHILDREN_THRESHOLD_MIN = childrenMin;
  CHILDREN_THRESHOLD_MAX = childrenMax;
  SKU_THRESHOLD = sku;
};

export const analyzeProductData = (
  headers: string[],
  data: any[][],
  customThresholds?: { parent: number; childrenMin: number; childrenMax: number; sku: number }
): AnalysisResult => {
  // Use custom thresholds if provided
  if (customThresholds) {
    updateThresholds(customThresholds.parent, customThresholds.childrenMin, customThresholds.childrenMax, customThresholds.sku);
  }

  // Detect product domain
  const productDomain = detectProductDomain(headers, data);

  // Calculate cardinality scores
  const cardinalityScores = calculateCardinalityScores(headers, data);

  // Auto-detect UoM/logistics headers
  const autoExcludedHeaders = headers.filter(h => detectUomAndLogistics(h));

  // Determine hierarchy based on cardinality (excluding UoM/logistics)
  const { hierarchy, properties, confidence, propertiesWithoutValues } = determineHierarchy(
    cardinalityScores, 
    headers, 
    productDomain,
    data,
    autoExcludedHeaders
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
    propertiesWithoutValues,
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
      parent: PARENT_THRESHOLD,
      childrenMin: CHILDREN_THRESHOLD_MIN,
      childrenMax: CHILDREN_THRESHOLD_MAX,
      sku: SKU_THRESHOLD,
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

    // 4-level classification based on new thresholds
    let classification: 'high' | 'medium' | 'low';
    if (cardinality >= SKU_THRESHOLD) {
      classification = 'high'; // SKU/Attribute level (≥98%)
    } else if (cardinality >= CHILDREN_THRESHOLD_MIN) {
      classification = 'medium'; // Children/Grandchildren (50%-75%)
    } else {
      classification = 'low'; // Parent level (≤2%)
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

// Helper: Detect if field is likely a Record ID (numbers, codes, IDs)
const isLikelyRecordId = (header: string): boolean => {
  const lower = header.toLowerCase();
  
  // SKU/GTIN/EAN keywords (prioritize for lowest level)
  const skuKeywords = ['sku', 'gtin', 'ean', 'upc', 'barcode', 'article', 'zuc', 'product_id', 'item_id', 'zun'];
  if (skuKeywords.some(kw => lower.includes(kw))) {
    return true;
  }
  
  // General ID detection
  const idKeywords = ['id', 'code', 'number', 'key', 'identifier'];
  return idKeywords.some(kw => lower.includes(kw)) && !lower.includes('name') && !lower.includes('description');
};

// Helper: Detect if field is likely a Record Name (text descriptions)
const isLikelyRecordName = (header: string): boolean => {
  const lower = header.toLowerCase();
  const nameKeywords = ['name', 'title', 'description', 'label', 'text', 'brand', 'category', 'sector', 'division'];
  // Prefer single words or short phrases, avoid numbers
  return nameKeywords.some(kw => lower.includes(kw)) && !lower.includes('id') && !lower.includes('code');
};

// Helper: Detect UoM and logistics headers
export const detectUomAndLogistics = (header: string): boolean => {
  const headerLower = header.toLowerCase();
  const keywords = [
    'uom', 'unit', 'measure', 'measurement', 'dimension',
    'weight', 'height', 'width', 'depth', 'length',
    'zuc', 'zun', 'numerator', 'denominator',
    'price', 'cost', 'value', 'currency',
    'pallet', 'package', 'packaging', 'logistics',
    'quantity', 'qty', 'stock', 'inventory'
  ];
  return keywords.some(kw => headerLower.includes(kw));
};

const determineHierarchy = (
  cardinalityScores: CardinalityScore[],
  headers: string[],
  productDomain: ProductDomain,
  data: any[][],
  excludedHeaders: string[] = []
): { hierarchy: HierarchyLevel[]; properties: string[]; confidence: number; propertiesWithoutValues: string[] } => {
  // Filter out excluded headers (UoM/logistics by default, can be overridden)
  const validScores = cardinalityScores.filter(score => 
    !excludedHeaders.includes(score.header)
  );

  const validHeaders = validScores.map(s => s.header);

  const hierarchy: HierarchyLevel[] = [];
  const properties: string[] = [];

  // Sort by cardinality (low to high)
  const sortedScores = [...validScores].sort(
    (a, b) => a.cardinality - b.cardinality
  );

  // Classify headers into 4 cardinality levels
  const parentHeaders = sortedScores
    .filter((score) => score.cardinality <= PARENT_THRESHOLD)
    .map((score) => score.header);

  const childrenHeaders = sortedScores
    .filter((score) => score.cardinality > PARENT_THRESHOLD && score.cardinality < CHILDREN_THRESHOLD_MAX)
    .map((score) => score.header);

  const grandchildrenHeaders = sortedScores
    .filter((score) => score.cardinality >= CHILDREN_THRESHOLD_MAX && score.cardinality < SKU_THRESHOLD)
    .map((score) => score.header);

  const skuHeaders = sortedScores
    .filter((score) => score.cardinality >= SKU_THRESHOLD)
    .map((score) => score.header);

  // Legacy variables for backward compatibility
  const lowCardinalityHeaders = parentHeaders;
  const mediumCardinalityHeaders = [...childrenHeaders, ...grandchildrenHeaders];
  const highCardinalityHeaders = skuHeaders;

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
  
  // Build hierarchy based on cardinality distribution
  // High Repetition (Low Cardinality) = Parent Levels
  // Medium Repetition = Middle/Variant Levels  
  // High Uniqueness (High Cardinality) = SKU-Level Properties
  
  // Helper: Check if field has good data representation (not too many empty values)
  const hasGoodRepresentation = (header: string): boolean => {
    const headerIndex = headers.indexOf(header);
    if (headerIndex === -1) return false;
    
    const nonEmptyCount = data.filter(row => {
      const value = row[headerIndex];
      return value !== null && value !== undefined && value !== '';
    }).length;
    
    return nonEmptyCount / data.length >= 0.7; // At least 70% filled
  };

  // Helper: Check if field is unique (good for Record ID)
  const isUnique = (header: string): boolean => {
    const headerIndex = headers.indexOf(header);
    if (headerIndex === -1) return false;
    
    const values = data.map(row => row[headerIndex]).filter(v => v !== null && v !== undefined && v !== '');
    const uniqueValues = new Set(values);
    
    return uniqueValues.size / values.length >= 0.95; // At least 95% unique
  };

  // Helper: Find Record ID with priority order and validation
  const findBestRecordId = (headers: string[], isLowestLevel: boolean = false): string => {
    if (isLowestLevel) {
      // SKU-Level: Priority order - SKU > ZUN > GTIN > EAN > ZUC
      const priorityKeywords = [
        ['sku', 'sku_id', 'product_sku'],
        ['zun', 'zun_id'],
        ['gtin', 'gtin_id'],
        ['ean', 'ean_id', 'barcode'],
        ['zuc', 'zuc_id'],
        ['upc', 'article', 'product_id', 'item_id']
      ];
      
      for (const keywords of priorityKeywords) {
        const candidate = headers.find(h => {
          const lower = h.toLowerCase();
          return keywords.some(kw => lower.includes(kw)) && 
                 hasGoodRepresentation(h) && 
                 isUnique(h);
        });
        
        if (candidate) return candidate;
      }
    }
    
    // CRITICAL: For ALL levels - Try with full validation first
    let candidate = headers.find(h => 
      isLikelyRecordId(h) && 
      hasGoodRepresentation(h) && 
      isUnique(h)
    );
    
    if (candidate) return candidate;
    
    // FALLBACK 1: Relax uniqueness requirement (only 70% filled)
    candidate = headers.find(h => 
      isLikelyRecordId(h) && 
      hasGoodRepresentation(h)
    );
    
    if (candidate) return candidate;
    
    // FALLBACK 2: Just find any ID-like field
    candidate = headers.find(h => isLikelyRecordId(h));
    
    if (candidate) return candidate;
    
    // FALLBACK 3: MANDATORY - Use first header as Record ID
    // Every level MUST have a Record ID!
    return headers[0];
  };

  // Helper: Find Record ID and Name for a set of headers
  const findRecordIdAndName = (headers: string[], isLowestLevel: boolean = false) => {
    const recordId = findBestRecordId(headers, isLowestLevel);
    const recordName = headers.find(h => isLikelyRecordName(h) && hasGoodRepresentation(h));
    return { recordId, recordName };
  };

  if (totalLowMedium === 0) {
    // No repetitive data - STANDALONE MODEL (all products are independent)
    const { recordId, recordName } = findRecordIdAndName(validHeaders, true);
    hierarchy.push({
      level: 1,
      name: 'SKU-Level Properties',
      headers: validHeaders, // All fields are SKU-level
      recordId,
      recordName,
    });
    confidence = 0.8;
  } else if (totalLowMedium === 1) {
    // 1 repetitive field - SINGLE LEVEL HIERARCHY
    const levelHeaders = [...lowCardinalityHeaders, ...mediumCardinalityHeaders];
    const { recordId, recordName } = findRecordIdAndName(levelHeaders);
    hierarchy.push({
      level: 1,
      name: 'Parent Level (Taxonomy)',
      headers: levelHeaders,
      recordId,
      recordName,
    });
    confidence = 0.75;
  } else if (totalLowMedium === 2) {
    // 2 repetitive fields - TWO LEVEL HIERARCHY
    const level1Headers = lowCardinalityHeaders;
    const level2Headers = [...mediumCardinalityHeaders, ...highCardinalityHeaders];
    
    hierarchy.push({
      level: 1,
      name: 'Parent Level (Taxonomy)',
      headers: level1Headers,
      ...findRecordIdAndName(level1Headers),
    });
    hierarchy.push({
      level: 2,
      name: 'SKU-Level Properties',
      headers: level2Headers,
      ...findRecordIdAndName(level2Headers, true),
    });
    confidence = 0.85;
  } else if (totalLowMedium === 3) {
    // 3 repetitive fields - THREE LEVEL HIERARCHY
    const level1Headers = lowCardinalityHeaders;
    const level2Headers = mediumCardinalityHeaders.slice(0, Math.ceil(mediumCardinalityHeaders.length / 2));
    const level3Headers = [...mediumCardinalityHeaders.slice(Math.ceil(mediumCardinalityHeaders.length / 2)), ...highCardinalityHeaders];
    
    hierarchy.push({
      level: 1,
      name: 'Parent Level (Taxonomy)',
      headers: level1Headers,
      ...findRecordIdAndName(level1Headers),
    });
    hierarchy.push({
      level: 2,
      name: 'Child Level',
      headers: level2Headers,
      ...findRecordIdAndName(level2Headers),
    });
    hierarchy.push({
      level: 3,
      name: 'SKU-Level Properties',
      headers: level3Headers,
      ...findRecordIdAndName(level3Headers, true),
    });
    confidence = 0.9;
  } else {
    // 4+ repetitive fields - MULTI-LEVEL HIERARCHY
    const numLevels = Math.min(4, Math.ceil(totalLowMedium / 2) + 1);
    
    // Level 1: High Repetition (Parent/Taxonomy)
    hierarchy.push({
      level: 1,
      name: 'Parent Level (Taxonomy)',
      headers: lowCardinalityHeaders,
      ...findRecordIdAndName(lowCardinalityHeaders),
    });
    
    // Middle levels: Medium Repetition
    const mediumPerLevel = Math.ceil(mediumCardinalityHeaders.length / (numLevels - 2));
    for (let i = 0; i < numLevels - 2; i++) {
      const start = i * mediumPerLevel;
      const end = Math.min((i + 1) * mediumPerLevel, mediumCardinalityHeaders.length);
      if (start < mediumCardinalityHeaders.length) {
        const levelHeaders = mediumCardinalityHeaders.slice(start, end);
        hierarchy.push({
          level: i + 2,
          name: `Level ${i + 2}`,
          headers: levelHeaders,
          ...findRecordIdAndName(levelHeaders),
        });
      }
    }
    
    // Last level: SKU-Level Properties (High Uniqueness)
    const lastMediumIndex = (numLevels - 2) * mediumPerLevel;
    const skuLevelHeaders = [...mediumCardinalityHeaders.slice(lastMediumIndex), ...highCardinalityHeaders];
    hierarchy.push({
      level: numLevels,
      name: 'SKU-Level Properties',
      headers: skuLevelHeaders,
      ...findRecordIdAndName(skuLevelHeaders, true),
    });
    
    confidence = 0.85;
  }

  // Helper: Check if property has values in data
  const hasValues = (header: string, data: any[][]): boolean => {
    const headerIndex = headers.indexOf(header);
    if (headerIndex === -1) return false;
    
    // Check if at least 10% of rows have non-empty values
    const nonEmptyCount = data.filter(row => {
      const value = row[headerIndex];
      return value !== null && value !== undefined && value !== '';
    }).length;
    
    return nonEmptyCount / data.length >= 0.1; // At least 10% filled
  };

  // DYNAMIC HIERARCHY OPTIMIZATION (Aggregation Rule)
  // Rule: If a level results in fewer than 5 unique values under its parent, merge with next level
  const MIN_UNIQUE_VALUES_PER_LEVEL = 5;
  const consolidatedHierarchy: typeof hierarchy = [];
  
  for (let i = 0; i < hierarchy.length; i++) {
    const level = hierarchy[i];
    
    // If this is the last level, always keep it (SKU-Level)
    if (i === hierarchy.length - 1) {
      consolidatedHierarchy.push(level);
      continue;
    }
    
    // Count unique values for this level in the data
    const levelHeaderIndices = level.headers.map(h => headers.indexOf(h));
    const uniqueCombinations = new Set();
    data.forEach(row => {
      const combo = levelHeaderIndices.map(idx => row[idx]).join('|');
      if (combo.trim()) uniqueCombinations.add(combo);
    });
    
    // If level produces < 5 unique nodes, merge with next level
    if (uniqueCombinations.size < MIN_UNIQUE_VALUES_PER_LEVEL && i < hierarchy.length - 1) {
      const nextLevel = hierarchy[i + 1];
      nextLevel.headers = [...level.headers, ...nextLevel.headers];
      nextLevel.level = level.level; // Keep current level number
      nextLevel.name = level.name; // Keep current level name
      // Skip this level, it's merged
      continue;
    }
    
    consolidatedHierarchy.push(level);
  }
  
  // Renumber levels after consolidation
  consolidatedHierarchy.forEach((level, index) => {
    level.level = index + 1;
    // Update name for last level
    if (index === consolidatedHierarchy.length - 1) {
      level.name = 'SKU-Level Properties';
    }
  });

  // Separate properties with and without values
  const propertiesWithoutValues: string[] = [];
  const allHeaders = consolidatedHierarchy.flatMap(level => level.headers);
  
  // Check each property in the last level for values
  if (consolidatedHierarchy.length > 0) {
    const lastLevel = consolidatedHierarchy[consolidatedHierarchy.length - 1];
    const headersWithValues: string[] = [];
    
    lastLevel.headers.forEach(header => {
      if (hasValues(header, data)) {
        headersWithValues.push(header);
      } else {
        propertiesWithoutValues.push(header);
      }
    });
    
    lastLevel.headers = headersWithValues;
  }

  // Add excluded UoM/logistics fields to SKU-level (last level)
  const excludedFields = excludedHeaders.filter(h => headers.includes(h));
  if (consolidatedHierarchy.length > 0 && excludedFields.length > 0) {
    const lastLevel = consolidatedHierarchy[consolidatedHierarchy.length - 1];
    excludedFields.forEach(field => {
      if (hasValues(field, data)) {
        if (!lastLevel.headers.includes(field)) {
          lastLevel.headers.push(field);
        }
      } else {
        if (!propertiesWithoutValues.includes(field)) {
          propertiesWithoutValues.push(field);
        }
      }
    });
  }

  return { hierarchy: consolidatedHierarchy, properties, confidence, propertiesWithoutValues };
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

  // Alternative 1: Standalone Model (no hierarchy)
  alternatives.push({
    name: 'Standalone Model',
    hierarchy: [{ level: 1, name: 'Independent Products', headers: [], recordId: headers[0] || 'id' }],
    properties: headers,
    confidence: 0.6,
    reasoning: 'All products are independent, no hierarchical structure',
    modelType: 'standalone',
  });

  // Alternative 2: Flat model with primary grouping (if we have 1+ repetitive fields)
  if (combinedHeaders.length >= 1) {
    const hierarchy: HierarchyLevel[] = [
      { level: 1, name: 'Single Category', headers: combinedHeaders.slice(0, 1), recordId: combinedHeaders[0] },
    ];
    const properties = [...combinedHeaders.slice(1), ...highHeaders];
    
    alternatives.push({
      name: 'Flat Model (1 Level)',
      hierarchy,
      properties,
      confidence: 0.7,
      reasoning: 'Simple grouping with a single category level',
      modelType: 'hierarchical',
    });
  }

  // Alternative 3: Two-level hierarchy (if we have 2+ repetitive fields)
  if (combinedHeaders.length >= 2) {
    const hierarchy: HierarchyLevel[] = [
      { level: 1, name: 'Main Category', headers: combinedHeaders.slice(0, 1), recordId: combinedHeaders[0] },
      { level: 2, name: 'Subcategory', headers: combinedHeaders.slice(1, 2), recordId: combinedHeaders[1] },
    ];
    const properties = [...combinedHeaders.slice(2), ...highHeaders];
    
    alternatives.push({
      name: '2-Level Hierarchy',
      hierarchy,
      properties,
      confidence: 0.75,
      reasoning: 'Structure with two hierarchical levels (Parent → Variant)',
      modelType: 'hierarchical',
    });
  }

  // Alternative 4: Three-level hierarchy (if we have 3+ fields)
  if (combinedHeaders.length >= 3) {
    const hierarchy: HierarchyLevel[] = [
      { level: 1, name: 'Main Category', headers: [combinedHeaders[0]], recordId: combinedHeaders[0] },
      { level: 2, name: 'Subcategory', headers: [combinedHeaders[1]], recordId: combinedHeaders[1] },
      { level: 3, name: 'Detailed Category', headers: [combinedHeaders[2]], recordId: combinedHeaders[2] },
    ];
    const properties = [...combinedHeaders.slice(3), ...highHeaders];
    
    alternatives.push({
      name: '3-Level Hierarchy',
      hierarchy,
      properties,
      confidence: 0.8,
      reasoning: 'Detailed taxonomy with three levels (Parent → Child → Grandchild)',
      modelType: 'hierarchical',
    });
  }

  // Alternative 5: Four-level hierarchy (if we have 4+ fields)
  if (combinedHeaders.length >= 4) {
    const hierarchy: HierarchyLevel[] = [
      { level: 1, name: 'Main Category', headers: [combinedHeaders[0]], recordId: combinedHeaders[0] },
      { level: 2, name: 'Subcategory', headers: [combinedHeaders[1]], recordId: combinedHeaders[1] },
      { level: 3, name: 'Detailed Category', headers: [combinedHeaders[2]], recordId: combinedHeaders[2] },
      { level: 4, name: 'Specification', headers: [combinedHeaders[3]], recordId: combinedHeaders[3] },
    ];
    const properties = [...combinedHeaders.slice(4), ...highHeaders];
    
    alternatives.push({
      name: '4-Level Hierarchy',
      hierarchy,
      properties,
      confidence: 0.85,
      reasoning: 'Complex taxonomy with four hierarchical levels',
      modelType: 'hierarchical',
    });
  }

  return alternatives.slice(0, 5); // Return max 5 alternatives
};

const detectMixedModel = (
  hierarchy: HierarchyLevel[],
  data: any[][],
  headers: string[],
  orphanedRecords: OrphanedRecord[]
): {
  shouldUseMixed: boolean;
  reasoning: string;
  standalonePercentage: number;
  hierarchicalPercentage: number;
} => {
  // If no hierarchy detected, no mixed model needed
  if (hierarchy.length === 0 || (hierarchy.length === 1 && hierarchy[0].headers.length === 0)) {
    return {
      shouldUseMixed: false,
      reasoning: 'No hierarchy detected - pure standalone model',
      standalonePercentage: 100,
      hierarchicalPercentage: 0,
    };
  }

  const hierarchyHeaders = hierarchy.flatMap(h => h.headers);
  
  // Count products with missing hierarchy values
  let productsWithMissingHierarchy = 0;
  let productsWithCompleteHierarchy = 0;
  
  data.forEach((row) => {
    let hasMissingHierarchyValue = false;
    
    hierarchyHeaders.forEach(header => {
      const index = headers.indexOf(header);
      const value = row[index];
      if (value === null || value === undefined || value === '' || value === 'Unknown') {
        hasMissingHierarchyValue = true;
      }
    });
    
    if (hasMissingHierarchyValue) {
      productsWithMissingHierarchy++;
    } else {
      productsWithCompleteHierarchy++;
    }
  });
  
  const totalProducts = data.length;
  const standalonePercentage = (productsWithMissingHierarchy / totalProducts) * 100;
  const hierarchicalPercentage = (productsWithCompleteHierarchy / totalProducts) * 100;
  
  // Suggest mixed model if:
  // 1. Between 10% and 90% of products have missing hierarchy values
  // 2. Or if there are many orphaned records
  const orphanedPercentage = (orphanedRecords.length / totalProducts) * 100;
  
  const shouldUseMixed = 
    (standalonePercentage >= 10 && standalonePercentage <= 90) ||
    (orphanedPercentage >= 15);
  
  let reasoning = '';
  
  if (shouldUseMixed) {
    if (standalonePercentage >= 10 && standalonePercentage <= 90) {
      reasoning = `Mixed model recommended: ${hierarchicalPercentage.toFixed(1)}% of products have complete hierarchy, while ${standalonePercentage.toFixed(1)}% can be standalone. This suggests the catalog contains products of different natures.`;
    } else if (orphanedPercentage >= 15) {
      reasoning = `Mixed model recommended: ${orphanedPercentage.toFixed(1)}% of products have hierarchy inconsistencies. Consider treating these products as standalone.`;
    }
  } else {
    if (standalonePercentage < 10) {
      reasoning = `Pure hierarchical model recommended: ${hierarchicalPercentage.toFixed(1)}% of products have complete hierarchy. Few products (${standalonePercentage.toFixed(1)}%) need special treatment.`;
    } else {
      reasoning = `Pure standalone model may be more appropriate: ${standalonePercentage.toFixed(1)}% of products don't fit the proposed hierarchy.`;
    }
  }
  
  return {
    shouldUseMixed,
    reasoning,
    standalonePercentage,
    hierarchicalPercentage,
  };
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
  
  // Taxonomy properties should belong to the highest hierarchy level
  // These are properties that are shared across the top-level category
  const topLevelHeaders = hierarchy.length > 0 ? hierarchy[0].headers : [];
  
  // Property headers are all headers not in hierarchy
  const propertyHeaders = headers.filter(
    (header) => !hierarchyHeaders.includes(header)
  );

  // Build taxonomy paths
  data.forEach((row) => {
    const pathSegments = hierarchyHeaders.map((header) => {
      const index = headers.indexOf(header);
      return row[index] || 'Desconhecido';
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

  // Sort by product count (most common paths first)
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
    const headerLower = header.toLowerCase();
    
    // Determine data type
    let dataType: PropertyRecommendation['dataType'] = 'string';
    let isPicklist = false;
    let picklistValues: string[] | undefined;
    let confidence = 0.5;
    let reasoning = '';
    
    // Check if yes/no (highest priority for boolean fields)
    if (score.uniqueCount <= 5) {
      const uniqueValues = Array.from(new Set(columnData.map(v => String(v).toLowerCase())));
      const yesNoPatterns = ['yes', 'no', 'true', 'false', 'y', 'n', '1', '0', 'sim', 'n\u00e3o'];
      if (uniqueValues.every(v => yesNoPatterns.includes(v))) {
        dataType = 'yes_no';
        confidence = 0.95;
        reasoning = 'Boolean values detected (yes/no, true/false)';
        return { header, dataType, isPicklist, picklistValues, confidence, reasoning };
      }
    }
    
    // Check if date
    const datePatterns = [
      /^\d{4}-\d{2}-\d{2}$/,  // YYYY-MM-DD
      /^\d{2}\/\d{2}\/\d{4}$/,  // DD/MM/YYYY or MM/DD/YYYY
      /^\d{2}-\d{2}-\d{4}$/,  // DD-MM-YYYY
      /^\d{1,2}\/\d{1,2}\/\d{2,4}$/,  // Flexible date
    ];
    const dateKeywords = ['date', 'data', 'fecha', 'expiry', 'validade', 'created', 'updated', 'modified'];
    
    if (dateKeywords.some(kw => headerLower.includes(kw))) {
      const dateCount = columnData.filter(val => {
        const str = String(val);
        return datePatterns.some(pattern => pattern.test(str)) || !isNaN(Date.parse(str));
      }).length;
      
      if (dateCount / columnData.length > 0.7) {
        dataType = 'date';
        confidence = 0.9;
        reasoning = 'Date format detected in column name and values';
        return { header, dataType, isPicklist, picklistValues, confidence, reasoning };
      }
    }
    
    // Check if number (before picklist to avoid numeric picklists being misclassified)
    const numericCount = columnData.filter(val => !isNaN(Number(val))).length;
    if (numericCount / columnData.length > 0.9 && score.uniqueCount > 10) {
      dataType = 'number';
      confidence = 0.9;
      reasoning = 'Numeric values detected';
      return { header, dataType, isPicklist, picklistValues, confidence, reasoning };
    }
    
    // Check if picklist (low-medium cardinality, limited unique values)
    if (score.uniqueCount <= 50 && score.cardinality < 0.3) {
      isPicklist = true;
      dataType = 'picklist';
      picklistValues = Array.from(new Set(columnData.map(v => String(v)))).slice(0, 50);
      confidence = 0.9;
      reasoning = `Limited value list (${score.uniqueCount} unique values)`;
      return { header, dataType, isPicklist, picklistValues, confidence, reasoning };
    }
    
    // Check if digital asset (images, videos, documents)
    const assetExtensions = /\.(jpg|jpeg|png|gif|webp|svg|bmp|tiff|pdf|doc|docx|mp4|mov|avi)$/i;
    const assetCount = columnData.filter(val => {
      const str = String(val).toLowerCase();
      return assetExtensions.test(str) || 
             str.startsWith('http://') && assetExtensions.test(str) ||
             str.startsWith('https://') && assetExtensions.test(str);
    }).length;
    
    if (assetCount / columnData.length > 0.6) {
      dataType = 'digital_asset';
      confidence = 0.85;
      reasoning = 'URLs or media file paths detected';
      return { header, dataType, isPicklist, picklistValues, confidence, reasoning };
    }
    
    // Check if link (URLs without asset extensions)
    const urlCount = columnData.filter(val => {
      const str = String(val);
      return str.startsWith('http://') || str.startsWith('https://') || str.startsWith('www.');
    }).length;
    
    if (urlCount / columnData.length > 0.7) {
      dataType = 'link';
      confidence = 0.85;
      reasoning = 'URLs detected';
      return { header, dataType, isPicklist, picklistValues, confidence, reasoning };
    }
    
    // Check if HTML (contains HTML tags)
    const htmlCount = columnData.filter(val => {
      const str = String(val);
      return str.includes('<') && str.includes('>');
    }).length;
    
    if (htmlCount / columnData.length > 0.5) {
      dataType = 'html';
      confidence = 0.8;
      reasoning = 'HTML tags detected in content';
      return { header, dataType, isPicklist, picklistValues, confidence, reasoning };
    }
    
    // Check if rich text (long text with formatting indicators)
    const avgLength = columnData.reduce((sum, val) => sum + String(val).length, 0) / columnData.length;
    const hasFormatting = columnData.some(val => {
      const str = String(val);
      return str.includes('\\n') || str.includes('\\t') || str.length > 500;
    });
    
    if (avgLength > 200 || hasFormatting) {
      dataType = 'rich_text';
      confidence = 0.75;
      reasoning = 'Long text with possible formatting detected';
      return { header, dataType, isPicklist, picklistValues, confidence, reasoning };
    }
    
    // Default to string
    dataType = 'string';
    confidence = 0.6;
    reasoning = 'Default text type';
    
    return {
      header,
      dataType,
      isPicklist,
      picklistValues,
      confidence,
      reasoning,
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
