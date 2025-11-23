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

export interface RecordIdNameSuggestion {
  level: number;
  levelName: string;
  recordIdCandidates: string[];  // Top 3 candidates
  recordNameCandidates: string[];  // Top 3 candidates
  selectedRecordId: string;
  selectedRecordName?: string;
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
  recordIdNameSuggestions: RecordIdNameSuggestion[];  // Per-level suggestions
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
  customThresholds?: { parent: number; childrenMin: number; childrenMax: number; sku: number; minPropertiesPerLevel?: number },
  forcedSkuHeaders?: string[]
): AnalysisResult => {
  // Use custom thresholds if provided
  if (customThresholds) {
    updateThresholds(customThresholds.parent, customThresholds.childrenMin, customThresholds.childrenMax, customThresholds.sku);
  }
  
  const MIN_PROPERTIES_PER_LEVEL = customThresholds?.minPropertiesPerLevel || 5;

  // Detect product domain
  const productDomain = detectProductDomain(headers, data);

  // Calculate cardinality scores for ALL headers (including item-level)
  const cardinalityScores = calculateCardinalityScores(headers, data);

  // Determine which headers to force to SKU-level
  // Priority: forcedSkuHeaders (user selection) > auto-detected item-level
  let itemLevelHeaders: string[];
  
  if (forcedSkuHeaders && forcedSkuHeaders.length > 0) {
    // Use user-selected forced headers
    itemLevelHeaders = forcedSkuHeaders;
    console.log('🔍 DEBUG - Using user-forced SKU headers:', itemLevelHeaders.length, itemLevelHeaders);
  } else {
    // Auto-detect item-level headers (SKU, EAN, measurements, etc.)
    itemLevelHeaders = headers.filter(h => detectUomAndLogistics(h));
    console.log('🔍 DEBUG - Item-level headers auto-detected:', itemLevelHeaders.length, itemLevelHeaders);
  }

  // Determine hierarchy based on cardinality
  // Item-level headers are analyzed but will be forced to SKU-level
  const { hierarchy, properties, confidence, propertiesWithoutValues } = determineHierarchy(
    cardinalityScores, 
    headers, 
    productDomain,
    data,
    MIN_PROPERTIES_PER_LEVEL,
    itemLevelHeaders  // Pass as hint, not exclusion
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

  // Generate Record ID/Name suggestions per level
  const recordIdNameSuggestions = generateRecordIdNameSuggestions(hierarchy, headers, data);

  return {
    cardinalityScores,
    hierarchy,
    properties,
    propertiesWithoutValues,
    taxonomyPaths,
    recordIdSuggestion,
    recordNameSuggestion,
    recordIdNameSuggestions,
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
    let classification: 'level1' | 'level2' | 'level3' | 'level4';
    if (cardinality >= SKU_THRESHOLD) {
      classification = 'level4'; // SKU/Attribute level (≥98%)
    } else if (cardinality >= CHILDREN_THRESHOLD_MAX) {
      classification = 'level3'; // Grandchildren (75%-98%)
    } else if (cardinality >= CHILDREN_THRESHOLD_MIN) {
      classification = 'level2'; // Children (50%-75%)
    } else {
      classification = 'level1'; // Parent level (≤50%)
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

// Helper: Detect if field is likely a Record ID (unique identifiers)
const isLikelyRecordId = (header: string): boolean => {
  const lower = header.toLowerCase();
  
  // EXCLUDE dates and temporal fields - NEVER use as Record ID
  const dateKeywords = [
    'date', 'time', 'timestamp', 'created', 'modified', 'updated',
    'valid', 'valid from', 'valid to', 'start', 'end', 'expiry', 'expiration',
    'dispatch', 'availab', 'launch', 'discontinue'
  ];
  if (dateKeywords.some(kw => lower.includes(kw))) {
    return false;
  }
  
  // EXCLUDE UoM and logistics - NEVER use as Record ID
  const excludeKeywords = [
    'pack type', 'packing type', 'packaging type',
    'unit', 'measure', 'weight', 'volume', 'liter', 'litre',
    'pallet', 'case', 'layer', 'truck'
  ];
  if (excludeKeywords.some(kw => lower.includes(kw))) {
    return false;
  }
  
  // Taxonomy level indicators (L1, L2, L3, L4, etc.) - HIGHEST PRIORITY
  if (/^l\d+$/i.test(lower.trim()) || /^level\s*\d+$/i.test(lower.trim())) {
    return true;
  }
  
  // SKU-level identifiers (for lowest level only)
  const skuKeywords = ['sku', 'ean', 'gtin', 'upc', 'barcode'];
  if (skuKeywords.some(kw => lower.includes(kw))) {
    return true;
  }
  
  // ZUN/ZUC identifiers (common in retail/FMCG)
  if (lower.includes('zun') || lower.includes('zuc')) {
    return true;
  }
  
  // General ID detection
  const idKeywords = ['id', 'code', 'number', 'key', 'identifier'];
  return idKeywords.some(kw => lower.includes(kw)) && !lower.includes('name') && !lower.includes('description');
};

// Helper: Detect if field is likely a Record Name (text descriptions)
const isLikelyRecordName = (header: string): boolean => {
  const lower = header.toLowerCase();
  
  // Expanded keywords for Record Name detection
  const nameKeywords = [
    'name', 'title', 'description', 'label', 'text', 
    'brand', 'category', 'sector', 'division',
    'product', 'item', 'article', 'material',
    'type', 'class', 'group', 'family',
    'designation', 'denomination', 'appellation',
    'libellé', 'libelle'  // French for label/description
  ];
  
  // CRITICAL: Exclude ID-like fields, codes, and UoM/logistics
  const excludeKeywords = [
    // IDs and codes
    'id', 'code', 'number', 'num', 'sku', 'ean', 'gtin', 'upc',
    'zun', 'zuc', 'barcode', 'plu', 'gln',
    // Logistics (MUST exclude to avoid "EAN/UPC PAL" and "Pack Type" being selected)
    'pal', 'car', 'lay', 'cs', 'cv', 'zuc', 'truck',
    'pack type', 'packing type', 'packaging type', 'pack size',
    // UoM
    'unit', 'uom', 'measure', 'weight', 'volume', 'liter', 'litre',
    // Inventory
    'qty', 'quantity', 'stock', 'pallet', 'case', 'layer'
  ];
  
  // Check if header contains name keywords but not exclude keywords
  const hasNameKeyword = nameKeywords.some(kw => lower.includes(kw));
  const hasExcludeKeyword = excludeKeywords.some(kw => lower.includes(kw));
  
  return hasNameKeyword && !hasExcludeKeyword;
};

// Helper: Detect UoM, logistics, and SKU-level identifiers
export const detectUomAndLogistics = (header: string): boolean => {
  const headerLower = header.toLowerCase();
  
  // IMPORTANT: Exclude taxonomy/hierarchy level indicators (L1, L2, L3, L4, etc.)
  // These are NOT item-level properties, they are hierarchy structure fields
  const isTaxonomyLevel = /^l\d+$/i.test(headerLower.trim()) || 
                          /^level\s*\d+$/i.test(headerLower.trim()) ||
                          /^hierarchy\s*\d+$/i.test(headerLower.trim());
  
  if (isTaxonomyLevel) {
    return false; // DO NOT exclude taxonomy levels from hierarchy analysis
  }
  
  // SKU-level identifiers (always item-level)
  const skuKeywords = [
    'sku', 'ean', 'upc', 'gtin', 'isbn', 'asin',
    'material number', 'material_number', 'materialnumber',
    'item number', 'item_number', 'itemnumber',
    'product id', 'product_id', 'productid',
    'article number', 'article_number', 'articlenumber',
    'part number', 'part_number', 'partnumber',
    'barcode', 'qr code', 'qrcode'
  ];
  
  // UoM and measurement fields
  const uomKeywords = [
    'uom', 'unit of measure', 'unit', 'measure', 'measurement', 'dimension',
    'weight', 'height', 'width', 'depth', 'length', 'size',
    'volume', 'capacity', 'area',
    'zuc', 'zun', 'numerator', 'denominator',
    'base unit', 'conversion', 'factor',
    // Liquid measurements
    'liter', 'litre', 'litros', 'ml', 'milliliter',
    'liters per case', 'litres per case', 'liter per pallet',
    'gallon', 'fluid ounce', 'fl oz',
    // Density and concentration
    'density', 'densidade', 'concentration', 'specific gravity',
    'viscosity', 'ph', 'alcohol content', 'abv'
  ];
  
  // Logistics and inventory fields
  const logisticsKeywords = [
    'pallet', 'package', 'packaging', 'logistics',
    'quantity', 'qty', 'stock', 'inventory',
    'warehouse', 'storage', 'location',
    'lead time', 'leadtime', 'delivery',
    'cases per', 'units per', 'pack size',
    'shelf life', 'shelflife', 'expiry', 'expiration',
    'best before', 'use by', 'validade',
    'batch', 'lot', 'lot number', 'batch number',
    'serial', 'serial number',
    // Additional logistics keywords
    'lay', 'layers', 'cs', 'case', 'cv',
    'type support', 'type of support', 'support',
    'pal', 'car', 'pack type', 'packing type', 'packaging type'
  ];
  
  // Pricing fields (item-level)
  const pricingKeywords = [
    'price', 'cost', 'value', 'currency',
    'msrp', 'retail', 'wholesale',
    'discount', 'margin', 'profit',
    'tax', 'vat', 'duty', 'tariff'
  ];
  
  // Dates and timestamps (item-level)
  const dateKeywords = [
    'creation date', 'created date', 'created on', 'created at',
    'modified date', 'updated date', 'last modified',
    'valid from', 'valid to', 'validity',
    'start date', 'end date', 'effective date',
    'launch date', 'discontinue date',
    // Additional date keywords
    'starting date', 'order dispatch', 'dispatch', 'dispatc'
  ];
  
  // Technical specifications (item-level)
  const technicalKeywords = [
    'specification', 'spec', 'technical',
    'compliance', 'certification', 'standard',
    'ingredient', 'composition', 'formula',
    // Allergens
    'allergen', 'allergy', 'contains', 'may contain',
    'gluten', 'dairy', 'lactose', 'milk', 'egg',
    'peanut', 'tree nut', 'soy', 'wheat', 'fish', 'shellfish',
    'sesame', 'sulfite', 'celery', 'mustard', 'lupin',
    // Nutrition
    'nutrition', 'nutritional', 'nutrient', 'nutritional label',
    'calories', 'calorie', 'energy', 'kcal', 'kj',
    'protein', 'carbohydrate', 'carbs', 'sugar', 'fat',
    'saturated fat', 'trans fat', 'fiber', 'fibre', 'sodium', 'salt',
    'vitamin', 'mineral', 'calcium', 'iron', 'potassium',
    'serving size', 'portion', 'dose', 'daily value',
    // Temperature and storage
    'temperature', 'temp', 'storage temp', 'operating temp',
    'min temp', 'max temp', 'temperature range',
    'refrigerate', 'freeze', 'ambient', 'room temp',
    'storage condition', 'storage conditions', 'keep cool', 'keep frozen',
    'stackability', 'stackable',
    // Legal and regulatory
    'fda', 'usda', 'eu regulation', 'regulation',
    'prop 65', 'proposition 65', 'california prop',
    'reg 1169', 'regulation 1169', 'eu 1169',
    'fir', 'food information regulation',
    'gmo', 'non-gmo', 'organic', 'certified',
    'halal', 'kosher', 'vegan', 'vegetarian',
    'warning', 'caution', 'hazard', 'safety'
  ];
  
  // Combine all keywords
  const allKeywords = [
    ...skuKeywords,
    ...uomKeywords,
    ...logisticsKeywords,
    ...pricingKeywords,
    ...dateKeywords,
    ...technicalKeywords
  ];
  
  return allKeywords.some(kw => headerLower.includes(kw));
};

const determineHierarchy = (
  cardinalityScores: CardinalityScore[],
  headers: string[],
  productDomain: ProductDomain,
  data: any[][],
  minPropertiesPerLevel: number = 5,
  itemLevelHeaders: string[] = []  // Renamed: these are hints, not exclusions
): { hierarchy: HierarchyLevel[]; properties: string[]; confidence: number; propertiesWithoutValues: string[] } => {
  // ANALYZE ALL HEADERS (including item-level)
  // Item-level headers will be analyzed for Record ID detection
  // but will be forced to SKU-level at the end
  const validScores = cardinalityScores;  // Use ALL scores
  const validHeaders = validScores.map(s => s.header);

  const hierarchy: HierarchyLevel[] = [];
  const properties: string[] = [];

  // Sort by cardinality (low to high)
  const sortedScores = [...validScores].sort(
    (a, b) => a.cardinality - b.cardinality
  );

  // DYNAMIC: Classify headers into 4 cardinality levels based on thresholds
  const level1Headers = sortedScores
    .filter((score) => score.cardinality <= PARENT_THRESHOLD)
    .map((score) => score.header);

  const level2Headers = sortedScores
    .filter((score) => score.cardinality > PARENT_THRESHOLD && score.cardinality < CHILDREN_THRESHOLD_MIN)
    .map((score) => score.header);

  const level3Headers = sortedScores
    .filter((score) => score.cardinality >= CHILDREN_THRESHOLD_MIN && score.cardinality < CHILDREN_THRESHOLD_MAX)
    .map((score) => score.header);
    
  const level4Headers = sortedScores
    .filter((score) => score.cardinality >= CHILDREN_THRESHOLD_MAX && score.cardinality < SKU_THRESHOLD)
    .map((score) => score.header);

  const skuHeaders = sortedScores
    .filter((score) => score.cardinality >= SKU_THRESHOLD)
    .map((score) => score.header);

  // Legacy variables for backward compatibility
  const lowCardinalityHeaders = level1Headers;
  const mediumCardinalityHeaders = [...level2Headers, ...level3Headers, ...level4Headers];
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

  // Helper: Check if header is a UoM/measurement field (should NOT be Record ID)
  const isUomOrMeasurement = (header: string): boolean => {
    const lower = header.toLowerCase();
    
    // CRITICAL: Check for measurement-related keywords
    // These should NEVER be Record IDs
    const measurementKeywords = [
      'width', 'height', 'length', 'weight', 'volume', 'gross', 'net',
      'unit of', 'measure', 'dimension', 'size', 'density', 'liter',
      'numerator', 'denominator', 'stackability', 'layers', 'pallet',
      'zuc', 'zun', 'pal', 'car', 'lay', 'cs', 'ean/upc'
    ];
    
    return measurementKeywords.some(keyword => lower.includes(keyword));
  };

  // Helper: Find best Record ID from a set of headers
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
    } else {
      // NON-SKU LEVELS: NEVER use item-level headers OR UoM fields as Record ID
      const nonItemLevelHeaders = headers.filter(h => !itemLevelHeaders.includes(h) && !isUomOrMeasurement(h));
      
      if (nonItemLevelHeaders.length === 0) {
        console.log('⚠️ WARNING - All headers are item-level, using first header as Record ID');
        return headers[0];
      }
      
      // PRIORITY 1: Simple taxonomy codes (L1, L2, L3, L4, L7, L8, etc.)
      const simpleCode = nonItemLevelHeaders.find(h => {
        const lower = h.toLowerCase().trim();
        return /^l\d+$/i.test(lower) && hasGoodRepresentation(h);
      });
      if (simpleCode) return simpleCode;
      
      // PRIORITY 2: Numeric codes (1-6 digits)
      const numericCode = nonItemLevelHeaders.find(h => {
        const trimmed = h.trim();
        return /^\d{1,6}$/.test(trimmed) && 
               hasGoodRepresentation(h) && 
               isUnique(h);
      });
      if (numericCode) return numericCode;
      
      // PRIORITY 3: Short alphanumeric codes (2-6 characters)
      const shortCode = nonItemLevelHeaders.find(h => {
        const trimmed = h.trim();
        return trimmed.length >= 2 && trimmed.length <= 6 && 
               /^[a-z0-9_-]+$/i.test(trimmed) &&
               isLikelyRecordId(h) && 
               hasGoodRepresentation(h) && 
               isUnique(h);
      });
      if (shortCode) return shortCode;
      
      // PRIORITY 4: Longer descriptive IDs (e.g., "Product_ID_123")
      const descriptiveId = nonItemLevelHeaders.find(h => {
        return isLikelyRecordId(h) && 
               hasGoodRepresentation(h) && 
               isUnique(h);
      });
      if (descriptiveId) return descriptiveId;
      
      // PRIORITY 3: Any ID-like field with full validation
      let candidate = nonItemLevelHeaders.find(h => 
        isLikelyRecordId(h) && 
        hasGoodRepresentation(h) && 
        isUnique(h)
      );
      if (candidate) return candidate;
      
      // FALLBACK 1: Relax uniqueness requirement
      candidate = nonItemLevelHeaders.find(h => 
        isLikelyRecordId(h) && 
        hasGoodRepresentation(h)
      );
      if (candidate) return candidate;
      
      // FALLBACK 2: Just find any ID-like field
      candidate = nonItemLevelHeaders.find(h => isLikelyRecordId(h));
      if (candidate) return candidate;
      
      // FALLBACK 3: Use first non-item-level header
      return nonItemLevelHeaders[0];
    }
    
    // For SKU-level, if no priority keywords found, try generic search
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

  // Helper: Score headers for Record Name suitability (UNIFIED)
  const scoreHeaderForRecordName = (header: string, recordId: string, usedRecordNames: string[] = []): number => {
    if (header === recordId) return -1000; // Never same as Record ID
    
    // CRITICAL: Never reuse Record Name from another level
    if (usedRecordNames.includes(header)) return -1000;
    
    const lower = header.toLowerCase();
    let score = 0;
    
    // PRIORITY 1: "name" fields (HIGHEST)
    if (lower.includes('name') && !lower.includes('code')) score += 100;
    
    // PRIORITY 2: "description" fields
    else if (lower.includes('description')) {
      score += 90;
      // BONUS: Prefer shorter description fields (more concise)
      // Subtract 0.01 per character to break ties
      score -= header.length * 0.01;
    }
    
    // PRIORITY 3: "brand" fields
    else if (lower.includes('brand')) score += 80;
    
    // PRIORITY 4: Other name-like fields
    else if (lower.includes('title') || lower.includes('label') || lower.includes('text')) score += 70;
    
    // CRITICAL: EXCLUDE logistics, UoM, dates, and technical fields
    const excludeKeywords = [
      // Logistics
      'pack type', 'packing type', 'packaging type', 'pack size',
      'pallet', 'pal', 'car', 'lay', 'cs', 'cv', 'truck',
      // UoM
      'unit', 'uom', 'measure', 'weight', 'volume', 'liter', 'litre',
      // IDs and codes
      'id', 'code', 'number', 'sku', 'ean', 'gtin', 'upc', 'barcode',
      // Technical/dates
      'supervisor', 'family', 'hierarchy', 'date', 'time', 'created', 'valid'
    ];
    
    if (excludeKeywords.some(kw => lower.includes(kw))) {
      score -= 200; // HEAVY penalty
    }
    
    // Bonus for good representation
    if (hasGoodRepresentation(header)) score += 10;
    
    return score;
  };

  // Helper: Find Record ID and Name for a set of headers
  const findRecordIdAndName = (levelHeaders: string[], isLowestLevel: boolean = false, usedRecordNames: string[] = []) => {
    // If level has no headers yet, search in ALL available headers
    const searchHeaders = levelHeaders.length > 0 ? levelHeaders : validHeaders;
    const recordId = findBestRecordId(searchHeaders, isLowestLevel);
    
    // Score all headers (excluding already-used Record Names)
    const scoredHeaders = searchHeaders
      .map(h => ({ header: h, score: scoreHeaderForRecordName(h, recordId, usedRecordNames) }))
      .sort((a, b) => b.score - a.score);
    
    // DEBUG: Show top 10 scored headers
    if (isLowestLevel) {
      console.log(`🔍 DEBUG - Top 10 Record Name candidates (SKU-level):`);
      scoredHeaders.slice(0, 10).forEach((h, i) => {
        console.log(`  ${i + 1}. "${h.header}" (score: ${h.score})`);
      });
    }
    
    // PRIORITY 1: Try to find a header with positive score
    let recordName = scoredHeaders.find(h => h.score > 0)?.header;
    
    // PRIORITY 2: If ALL headers have negative scores (e.g., all are logistics/UoM)
    // Pick the LEAST negative one (closest to 0)
    if (!recordName && scoredHeaders.length > 0) {
      // Look for headers with "description" or "name" even if penalized
      const descOrName = scoredHeaders.find(h => {
        const lower = h.header.toLowerCase();
        return (lower.includes('description') || lower.includes('name')) && h.header !== recordId;
      });
      
      recordName = descOrName ? descOrName.header : scoredHeaders[0].header;
      console.warn(`⚠️ WARNING - No ideal Record Name found. Using least-bad option: "${recordName}" (score: ${scoredHeaders[0].score})`);
    }
    
    if (!recordName) {
      console.warn(`⚠️ WARNING - Could not find suitable Record Name for level (Record ID: "${recordId}")`);
    }
    
    return { recordId, recordName };
  };

  // DYNAMIC HIERARCHY BUILDING: Build only levels that have data based on thresholds
  const hierarchyLevels: { name: string; headers: string[]; isLowest: boolean }[] = [];
  
  // Add Level 1 (Parent) if exists AND has enough properties
  if (level1Headers.length >= minPropertiesPerLevel) {
    hierarchyLevels.push({
      name: 'Parent Level (Taxonomy)',
      headers: level1Headers,
      isLowest: false,
    });
  }
  
  // Add Level 2 (Children) if exists AND has enough properties
  if (level2Headers.length >= minPropertiesPerLevel) {
    hierarchyLevels.push({
      name: 'Child Level',
      headers: level2Headers,
      isLowest: false,
    });
  }
  
  // Add Level 3 (Grandchildren) if exists AND has enough properties
  if (level3Headers.length >= minPropertiesPerLevel) {
    hierarchyLevels.push({
      name: 'Grandchild Level',
      headers: level3Headers,
      isLowest: false,
    });
  }
  
  // Add Level 4 (Pre-SKU) if exists AND has enough properties
  if (level4Headers.length >= minPropertiesPerLevel) {
    hierarchyLevels.push({
      name: 'Variant Level',
      headers: level4Headers,
      isLowest: false,
    });
  }
  
  // If NO hierarchy levels were created, merge everything into one level
  if (hierarchyLevels.length === 0) {
    // Combine all non-SKU headers into a single level
    const allNonSkuHeaders = [...level1Headers, ...level2Headers, ...level3Headers, ...level4Headers];
    if (allNonSkuHeaders.length > 0) {
      hierarchyLevels.push({
        name: 'Parent Level (Taxonomy)',
        headers: allNonSkuHeaders,
        isLowest: false,
      });
    }
  }
  
  // CRITICAL: Ensure ALL headers are classified in at least one level
  // Find unclassified headers
  const classifiedHeaders = new Set<string>();
  level1Headers.forEach(h => classifiedHeaders.add(h));
  level2Headers.forEach(h => classifiedHeaders.add(h));
  level3Headers.forEach(h => classifiedHeaders.add(h));
  level4Headers.forEach(h => classifiedHeaders.add(h));
  skuHeaders.forEach(h => classifiedHeaders.add(h));
  
  const unclassifiedHeaders = validHeaders.filter(h => !classifiedHeaders.has(h));
  
  if (unclassifiedHeaders.length > 0) {
    console.warn(`⚠️ WARNING - ${unclassifiedHeaders.length} unclassified headers found, forcing to SKU-level:`, unclassifiedHeaders);
    // Add unclassified headers to SKU level
    skuHeaders.push(...unclassifiedHeaders);
  }
  
  // Always add SKU level (even if empty, properties will be added later)
  hierarchyLevels.push({
    name: 'SKU-Level Properties',
    headers: skuHeaders,
    isLowest: true,
  });
  
  console.log('🔍 DEBUG - Total classified headers:', classifiedHeaders.size);
  console.log('🔍 DEBUG - Total valid headers:', validHeaders.length);
  console.log('🔍 DEBUG - Unclassified headers:', unclassifiedHeaders.length);
  
  // Mark last level as lowest
  if (hierarchyLevels.length > 0) {
    hierarchyLevels[hierarchyLevels.length - 1].isLowest = true;
  }
  
  // Build hierarchy from dynamic levels
  console.log('🔍 DEBUG - Building hierarchy from', hierarchyLevels.length, 'levels');
  console.log('🔍 DEBUG - Total headers to distribute:', headers.length);
  
  // Track Record Names already used to prevent duplication
  const usedRecordNames: string[] = [];
  
  hierarchyLevels.forEach((levelData, index) => {
    const { recordId, recordName } = findRecordIdAndName(levelData.headers, levelData.isLowest, usedRecordNames);
    
    // Add this Record Name to the used list
    if (recordName) {
      usedRecordNames.push(recordName);
    }
    
    console.log(`🔍 DEBUG - Level ${index + 1} BEFORE cleaning:`, levelData.headers.length, 'headers');
    console.log(`🔍 DEBUG - Level ${index + 1} Record ID:`, recordId);
    console.log(`🔍 DEBUG - Level ${index + 1} Record Name:`, recordName);
    
    // Remove Record ID and Record Name from headers list to avoid duplication
    const cleanHeaders = levelData.headers.filter(h => {
      if (recordId && h === recordId) {
        console.log(`🔍 DEBUG - Removing Record ID "${recordId}" from level ${index + 1} headers`);
        return false;
      }
      if (recordName && h === recordName) {
        console.log(`🔍 DEBUG - Removing Record Name "${recordName}" from level ${index + 1} headers`);
        return false;
      }
      return true;
    });
    
    // CRITICAL: Verify Record ID was actually removed
    if (recordId && cleanHeaders.includes(recordId)) {
      console.error(`❌ ERROR - Record ID "${recordId}" still in headers after cleaning!`);
    }
    if (recordName && cleanHeaders.includes(recordName)) {
      console.error(`❌ ERROR - Record Name "${recordName}" still in headers after cleaning!`);
    }
    
    console.log(`🔍 DEBUG - Level ${index + 1} AFTER cleaning:`, cleanHeaders.length, 'headers');
    
    hierarchy.push({
      level: index + 1,
      name: levelData.name,
      headers: cleanHeaders,
      recordId,
      recordName,
    });
  });
  
  // Adjust confidence based on number of levels
  if (hierarchyLevels.length === 1) {
    confidence = 0.7; // Standalone model
  } else if (hierarchyLevels.length === 2) {
    confidence = 0.8; // Simple 2-level
  } else if (hierarchyLevels.length === 3) {
    confidence = 0.9; // Good 3-level
  } else {
    confidence = 0.95; // Complex 4+ level
  }
  
  // OLD LOGIC REMOVED - Now using dynamic level building above

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

  // Hierarchy is already optimized by dynamic level building above
  // Just use it directly
  const consolidatedHierarchy = hierarchy;

  // IMPORTANT: Keep ALL properties in hierarchy, just report which ones have no values
  const propertiesWithoutValues: string[] = [];
  
  // Check ALL properties across ALL levels for values (for reporting only)
  consolidatedHierarchy.forEach(level => {
    level.headers.forEach(header => {
      if (!hasValues(header, data)) {
        propertiesWithoutValues.push(header);
      }
    });
  });
  
  console.log('🔍 DEBUG - Properties without values (kept in hierarchy):', propertiesWithoutValues.length, propertiesWithoutValues);
  
  // DO NOT REMOVE properties without values - keep them in hierarchy
  // This ensures we maintain the total property count

  // Force item-level headers to SKU-level (last level)
  // These headers were analyzed for Record ID but must appear at the lowest level
  const itemLevelFields = itemLevelHeaders.filter(h => headers.includes(h));
  
  console.log('🔍 DEBUG - Item-level fields to force to SKU:', itemLevelFields.length, itemLevelFields);
  console.log('🔍 DEBUG - Last level before forcing:', consolidatedHierarchy.length > 0 ? consolidatedHierarchy[consolidatedHierarchy.length - 1].headers.length : 'NO LEVELS');
  
  if (consolidatedHierarchy.length > 0 && itemLevelFields.length > 0) {
    const lastLevel = consolidatedHierarchy[consolidatedHierarchy.length - 1];
    
    // CRITICAL: Store Record ID/Name of last level BEFORE removing
    const lastLevelRecordId = lastLevel.recordId;
    const lastLevelRecordName = lastLevel.recordName;
    
    // CRITICAL: Collect ALL description/name fields from other levels BEFORE removing
    // Include BOTH headers AND Record Names (which will be re-added during merge)
    const descriptionNameFields: string[] = [];
    consolidatedHierarchy.forEach((level) => {
      // Check headers
      level.headers.forEach(h => {
        const lower = h.toLowerCase();
        if ((lower.includes('description') || lower.includes('name')) && 
            !lower.includes('code') && 
            !descriptionNameFields.includes(h)) {
          descriptionNameFields.push(h);
        }
      });
      
      // CRITICAL: Also check Record Name (it will be re-added during merge)
      if (level.recordName) {
        const lower = level.recordName.toLowerCase();
        if ((lower.includes('description') || lower.includes('name')) && 
            !lower.includes('code') && 
            !descriptionNameFields.includes(level.recordName)) {
          descriptionNameFields.push(level.recordName);
          console.log(`🔍 DEBUG - Found Record Name with description/name: "${level.recordName}"`);
        }
      }
    });
    
    console.log(`🔍 DEBUG - Description/Name fields to preserve (${descriptionNameFields.length}):`, descriptionNameFields);
    
    // CRITICAL: Remove item-level fields from ALL levels (including last level to avoid duplicates)
    // This includes BOTH auto-detected AND user-forced fields
    consolidatedHierarchy.forEach((level, index) => {
      const beforeCount = level.headers.length;
      level.headers = level.headers.filter(h => !itemLevelFields.includes(h));
      const afterCount = level.headers.length;
      
      if (beforeCount !== afterCount) {
        console.log(`🔍 DEBUG - Removed ${beforeCount - afterCount} item-level fields from level ${index + 1}`);
      }
    });
    
    // Add all item-level fields to SKU-level (now guaranteed no duplicates)
    lastLevel.headers.push(...itemLevelFields);
    
    // CRITICAL: Add description/name fields to SKU-level if not already there
    descriptionNameFields.forEach(field => {
      if (!lastLevel.headers.includes(field)) {
        lastLevel.headers.push(field);
        console.log(`🔍 DEBUG - Adding description/name field to SKU-level: "${field}"`);
      }
    });
    
    // CRITICAL: Clear Record ID/Name of last level if they are in itemLevelFields
    // They will be re-selected later from the forced headers
    if (lastLevelRecordId && itemLevelFields.includes(lastLevelRecordId)) {
      console.log(`🔍 DEBUG - Clearing Record ID "${lastLevelRecordId}" from last level (will be in forced headers)`);
      lastLevel.recordId = undefined;
    }
    if (lastLevelRecordName && itemLevelFields.includes(lastLevelRecordName)) {
      console.log(`🔍 DEBUG - Clearing Record Name "${lastLevelRecordName}" from last level (will be in forced headers)`);
      lastLevel.recordName = undefined;
    }
    
    // RE-SELECT Record ID and Record Name from the forced headers
    console.log(`🔍 DEBUG - SKU-level headers BEFORE re-selection (${lastLevel.headers.length}):`, lastLevel.headers.slice(0, 20));
    
    // Debug: Show which headers have "description" or "name"
    const descNameHeaders = lastLevel.headers.filter(h => {
      const lower = h.toLowerCase();
      return (lower.includes('description') || lower.includes('name')) && !lower.includes('code');
    });
    console.log(`🔍 DEBUG - Description/Name headers available (${descNameHeaders.length}):`, descNameHeaders);
    
    // CRITICAL: Collect Record Names already used in OTHER levels to prevent duplication
    const usedRecordNamesInOtherLevels = consolidatedHierarchy
      .filter(level => level !== lastLevel && level.recordName)
      .map(level => level.recordName!);
    
    const { recordId: newRecordId, recordName: newRecordName } = findRecordIdAndName(lastLevel.headers, true, usedRecordNamesInOtherLevels);
    lastLevel.recordId = newRecordId;
    lastLevel.recordName = newRecordName;
    
    console.log(`🔍 DEBUG - Re-selected Record ID for last level: ${newRecordId}`);
    console.log(`🔍 DEBUG - Re-selected Record Name for last level: ${newRecordName}`);
    
    // Now remove the new Record ID/Name from headers
    lastLevel.headers = lastLevel.headers.filter(h => h !== newRecordId && h !== newRecordName);
    
    console.log('🔍 DEBUG - Last level after forcing and re-selection:', lastLevel.headers.length, 'headers');
  }
  
  // STEP 1: DEDUPLICATION FIRST - Remove properties that appear in multiple levels
  // This ensures accurate property counts for consolidation
  let tempHierarchy = [...consolidatedHierarchy];
  
  console.log('🔍 DEBUG - Starting deduplication before consolidation...');
  const seenPropertiesPreConsolidation = new Set<string>();
  
  // Iterate from last level to first (bottom-up)
  for (let i = tempHierarchy.length - 1; i >= 0; i--) {
    const level = tempHierarchy[i];
    
    // CRITICAL: Add Record ID and Record Name to seen properties
    if (level.recordId) seenPropertiesPreConsolidation.add(level.recordId);
    if (level.recordName) seenPropertiesPreConsolidation.add(level.recordName);
    
    // Remove properties that were already seen in lower levels
    const beforeCount = level.headers.length;
    level.headers = level.headers.filter(h => {
      if (seenPropertiesPreConsolidation.has(h)) {
        console.log(`🔍 DEBUG - [Pre-consolidation] Removing duplicate "${h}" from level ${i + 1}`);
        return false;
      }
      seenPropertiesPreConsolidation.add(h);
      return true;
    });
    
    if (beforeCount !== level.headers.length) {
      console.log(`🔍 DEBUG - Level ${i + 1} after deduplication: ${level.headers.length} headers (was ${beforeCount})`);
    }
  }
  
  // STEP 2: CONSOLIDATE LEVELS - Merge levels with < minPropertiesPerLevel into next level
  // Process from end to beginning to handle cascading merges
  console.log('🔍 DEBUG - Starting consolidation after deduplication...');
  
  // Iterate backwards (except last level which is always kept)
  for (let i = tempHierarchy.length - 2; i >= 0; i--) {
    const currentLevel = tempHierarchy[i];
    
    // CRITICAL: Count properties INCLUDING Record ID and Record Name
    const totalPropsInLevel = currentLevel.headers.length + 
                              (currentLevel.recordId ? 1 : 0) + 
                              (currentLevel.recordName ? 1 : 0);
    
    console.log(`🔍 DEBUG - Checking level ${i + 1}: ${totalPropsInLevel} props (${currentLevel.headers.length} headers + ${currentLevel.recordId ? 1 : 0} ID + ${currentLevel.recordName ? 1 : 0} Name) (min: ${minPropertiesPerLevel})`);
    
    // If level has < minPropertiesPerLevel, merge with next level
    if (totalPropsInLevel < minPropertiesPerLevel) {
      const nextLevel = tempHierarchy[i + 1];
      console.log(`🔍 DEBUG - Merging level ${i + 1} (${currentLevel.headers.length} props) into level ${i + 2} (${nextLevel.headers.length} props)`);
      
      // CRITICAL: Add Record ID and Record Name back to headers before merging
      // BUT skip if they are already Record ID/Name of the next level
      const currentLevelAllHeaders = [...currentLevel.headers];
      
      if (currentLevel.recordId && 
          currentLevel.recordId !== nextLevel.recordId && 
          currentLevel.recordId !== nextLevel.recordName) {
        currentLevelAllHeaders.push(currentLevel.recordId);
        console.log(`🔍 DEBUG - Re-adding Record ID "${currentLevel.recordId}" from merged level`);
      } else if (currentLevel.recordId) {
        console.log(`🔍 DEBUG - Skipping Record ID "${currentLevel.recordId}" (already used in next level)`);
      }
      
      if (currentLevel.recordName && 
          currentLevel.recordName !== nextLevel.recordId && 
          currentLevel.recordName !== nextLevel.recordName) {
        currentLevelAllHeaders.push(currentLevel.recordName);
        console.log(`🔍 DEBUG - Re-adding Record Name "${currentLevel.recordName}" from merged level`);
      } else if (currentLevel.recordName) {
        console.log(`🔍 DEBUG - Skipping Record Name "${currentLevel.recordName}" (already used in next level)`);
      }
      
      // Merge current into next (with deduplication)
      const mergedHeaders = [...currentLevelAllHeaders, ...nextLevel.headers];
      nextLevel.headers = Array.from(new Set(mergedHeaders)); // Remove duplicates
      
      // CRITICAL: If we re-added a Record Name, and it's now the Record Name of next level, REMOVE it from headers
      if (nextLevel.recordName && nextLevel.headers.includes(nextLevel.recordName)) {
        nextLevel.headers = nextLevel.headers.filter(h => h !== nextLevel.recordName);
        console.log(`🔍 DEBUG - Removed Record Name "${nextLevel.recordName}" from merged level headers (already used as Record Name)`);
      }
      
      // Remove current level
      tempHierarchy.splice(i, 1);
    }
  }
  
  const finalHierarchy = tempHierarchy;
  
  // STEP 3: FINAL DEDUPLICATION (after merges) - Catch any duplicates introduced during consolidation
  console.log('🔍 DEBUG - Final deduplication check after consolidation...');
  const seenPropertiesFinal = new Set<string>();
  
  // Iterate from last level to first (bottom-up)
  for (let i = finalHierarchy.length - 1; i >= 0; i--) {
    const level = finalHierarchy[i];
    
    // CRITICAL: Add Record ID and Record Name to seen properties
    if (level.recordId) seenPropertiesFinal.add(level.recordId);
    if (level.recordName) seenPropertiesFinal.add(level.recordName);
    
    // Remove properties that were already seen in lower levels
    level.headers = level.headers.filter(h => {
      if (seenPropertiesFinal.has(h)) {
        console.log(`🔍 DEBUG - [Post-consolidation] Removing duplicate "${h}" from level ${i + 1}`);
        return false;
      }
      seenPropertiesFinal.add(h);
      return true;
    });
  }
  
  // Renumber levels after consolidation
  finalHierarchy.forEach((level, index) => {
    level.level = index + 1;
    // Update name for last level
    if (index === finalHierarchy.length - 1) {
      level.name = 'SKU-Level Properties';
    }
  });
  
  console.log('🔍 DEBUG - Final hierarchy levels:', finalHierarchy.length);
  
  // Count ALL unique properties (headers + Record IDs + Record Names)
  const allInHierarchy = new Set<string>();
  finalHierarchy.forEach(level => {
    level.headers.forEach(h => allInHierarchy.add(h));
    if (level.recordId) allInHierarchy.add(level.recordId);
    if (level.recordName) allInHierarchy.add(level.recordName);
  });
  
  const totalInHierarchy = finalHierarchy.reduce((sum, level) => sum + level.headers.length, 0);
  const totalRecordIds = finalHierarchy.filter(l => l.recordId).length;
  const totalRecordNames = finalHierarchy.filter(l => l.recordName).length;
  
  console.log('🔍 DEBUG - Total headers in hierarchy (properties only):', totalInHierarchy);
  console.log('🔍 DEBUG - Total Record IDs:', totalRecordIds);
  console.log('🔍 DEBUG - Total Record Names:', totalRecordNames);
  console.log('🔍 DEBUG - Total UNIQUE properties (including Record ID/Name):', allInHierarchy.size);
  console.log('🔍 DEBUG - Original headers count:', headers.length);
  console.log('🔍 DEBUG - Properties without values:', propertiesWithoutValues.length);
  
  if (allInHierarchy.size !== headers.length) {
    const diff = headers.length - allInHierarchy.size;
    console.error(`❌ CRITICAL ERROR - ${Math.abs(diff)} properties ${diff > 0 ? 'MISSING' : 'DUPLICATED'}!`);
    
    if (diff > 0) {
      const missing = headers.filter(h => !allInHierarchy.has(h));
      console.error('❌ Missing properties:', missing);
    } else {
      // Find duplicates
      const headerCounts = new Map<string, number>();
      finalHierarchy.forEach(level => {
        level.headers.forEach(h => {
          headerCounts.set(h, (headerCounts.get(h) || 0) + 1);
        });
        if (level.recordId) headerCounts.set(level.recordId, (headerCounts.get(level.recordId) || 0) + 1);
        if (level.recordName) headerCounts.set(level.recordName, (headerCounts.get(level.recordName) || 0) + 1);
      });
      
      const duplicates = Array.from(headerCounts.entries())
        .filter(([_, count]) => count > 1)
        .map(([header, count]) => `${header} (${count}x)`);
      
      console.error('❌ Duplicated properties:', duplicates);
    }
  } else {
    console.log('✅ SUCCESS - All properties accounted for!');
  }
  
  // DETAILED BREAKDOWN
  console.log('\n📊 DETAILED PROPERTY BREAKDOWN:');
  finalHierarchy.forEach((level, index) => {
    console.log(`  Level ${index + 1} (${level.name}):`);
    console.log(`    - Properties in list: ${level.headers.length}`);
    console.log(`    - Record ID: ${level.recordId || 'none'}`);
    console.log(`    - Record Name: ${level.recordName || 'none'}`);
    console.log(`    - Total for this level: ${level.headers.length + (level.recordId ? 1 : 0) + (level.recordName ? 1 : 0)}`);
  });

  return { hierarchy: finalHierarchy, properties, confidence, propertiesWithoutValues };
};

const generateAlternativeHierarchies = (
  cardinalityScores: CardinalityScore[],
  headers: string[],
  productDomain: ProductDomain
): HierarchyAlternative[] => {
  const alternatives: HierarchyAlternative[] = [];
  const sortedScores = [...cardinalityScores].sort((a, b) => a.cardinality - b.cardinality);
  
  const level1Headers = sortedScores.filter(s => s.classification === 'level1').map(s => s.header);
  const level2Headers = sortedScores.filter(s => s.classification === 'level2').map(s => s.header);
  const level3Headers = sortedScores.filter(s => s.classification === 'level3').map(s => s.header);
  const level4Headers = sortedScores.filter(s => s.classification === 'level4').map(s => s.header);
  const combinedHeaders = [...level1Headers, ...level2Headers, ...level3Headers];

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
    const properties = [...combinedHeaders.slice(1), ...level4Headers];
    
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
    const properties = [...combinedHeaders.slice(2), ...level4Headers];
    
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
    const properties = [...combinedHeaders.slice(3), ...level4Headers];
    
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
    const properties = [...combinedHeaders.slice(4), ...level4Headers];
    
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

const generateRecordIdNameSuggestions = (
  hierarchy: HierarchyLevel[],
  headers: string[],
  data: any[][]
): RecordIdNameSuggestion[] => {
  const suggestions: RecordIdNameSuggestion[] = [];
  
  // Helper: Score headers for Record ID suitability
  const scoreRecordId = (header: string): number => {
    const lower = header.toLowerCase().trim();
    let score = 0;
    
    // Simple codes (L1, L2) = highest score
    if (/^l\d+$/i.test(lower)) score += 100;
    
    // Numeric codes (1-6 digits)
    else if (/^\d{1,6}$/.test(header.trim())) score += 90;
    
    // Short alphanumeric (2-6 chars)
    else if (header.trim().length >= 2 && header.trim().length <= 6 && /^[a-z0-9_-]+$/i.test(header.trim())) score += 80;
    
    // Contains "id", "code", "key"
    else if (lower.includes('id') || lower.includes('code') || lower.includes('key')) score += 70;
    
    // Longer descriptive IDs
    else if (lower.includes('identifier') || lower.includes('number')) score += 60;
    
    // Penalize dates and logistics
    if (lower.includes('date') || lower.includes('time') || lower.includes('pack') || lower.includes('unit')) score -= 50;
    
    return score;
  };
  
  // Helper: Score headers for Record Name suitability (UNIFIED with findRecordIdAndName)
  const scoreRecordName = (header: string, recordId?: string): number => {
    if (recordId && header === recordId) return -1000; // Never same as Record ID
    
    const lower = header.toLowerCase();
    let score = 0;
    
    // PRIORITY 1: "name" fields (HIGHEST)
    if (lower.includes('name') && !lower.includes('code')) score += 100;
    
    // PRIORITY 2: "description" fields
    else if (lower.includes('description')) score += 90;
    
    // PRIORITY 3: "brand" fields
    else if (lower.includes('brand')) score += 80;
    
    // PRIORITY 4: Other name-like fields
    else if (lower.includes('title') || lower.includes('label') || lower.includes('text')) score += 70;
    
    // CRITICAL: EXCLUDE logistics, UoM, dates, and technical fields (SAME as findRecordIdAndName)
    const excludeKeywords = [
      // Logistics
      'pack type', 'packing type', 'packaging type', 'pack size',
      'pallet', 'pal', 'car', 'lay', 'cs', 'cv', 'truck',
      // UoM
      'unit', 'uom', 'measure', 'weight', 'volume', 'liter', 'litre',
      // IDs and codes
      'id', 'code', 'number', 'sku', 'ean', 'gtin', 'upc', 'barcode',
      // Technical/dates
      'supervisor', 'family', 'hierarchy', 'date', 'time', 'created', 'valid'
    ];
    
    if (excludeKeywords.some(kw => lower.includes(kw))) {
      score -= 200; // HEAVY penalty (SAME as findRecordIdAndName)
    }
    
    return score;
  };
  
  hierarchy.forEach((level) => {
    // CRITICAL: Use the ALREADY SELECTED Record ID/Name as the PRIMARY source
    // Only show alternatives from the SAME level's headers
    const levelHeaders = [...level.headers];
    
    // Score and sort ID candidates (from level headers only)
    const idCandidates = levelHeaders
      .map(h => ({ header: h, score: scoreRecordId(h) }))
      .filter(c => c.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(c => c.header);
    
    // Score and sort Name candidates (from level headers only)
    const nameCandidates = levelHeaders
      .map(h => ({ header: h, score: scoreRecordName(h) }))
      .filter(c => c.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(c => c.header);
    
    // ALWAYS put the selected Record ID/Name FIRST in the candidates list
    const finalIdCandidates = level.recordId 
      ? [level.recordId, ...idCandidates.filter(c => c !== level.recordId)].slice(0, 3)
      : idCandidates;
    
    const finalNameCandidates = level.recordName
      ? [level.recordName, ...nameCandidates.filter(c => c !== level.recordName)].slice(0, 3)
      : nameCandidates;
    
    suggestions.push({
      level: level.level,
      levelName: level.name,
      recordIdCandidates: finalIdCandidates.length > 0 ? finalIdCandidates : [level.recordId],
      recordNameCandidates: finalNameCandidates.length > 0 ? finalNameCandidates : level.recordName ? [level.recordName] : [],
      selectedRecordId: level.recordId,
      selectedRecordName: level.recordName,
    });
  });
  
  return suggestions;
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
