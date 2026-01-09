import { CardinalityScore } from '@/components/CardinalityAnalysis';
import { HierarchyLevel } from '@/types';

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
  hierarchyPresets: HierarchyAlternative[]; // NEW: 3 preset structures (Flat, Parent-Variant, Multi-Level PIM)
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

// Centralized keyword lists for filtering and validation
const EXCLUDE_KEYWORDS = {
  // IDs and codes - should not be Record Names
  IDS_AND_CODES: [
    'id', 'code', 'number', 'num', 'sku', 'ean', 'gtin', 'upc',
    'zun', 'zuc', 'barcode', 'plu', 'gln', 'asin', 'model number', 'item model'
  ],
  
  // Logistics - should not be Record IDs or Record Names
  LOGISTICS: [
    'pack type', 'packing type', 'packaging type', 'pack size',
    'pallet', 'pal', 'car', 'lay', 'cs', 'cv', 'truck',
    'shipping', 'package', 'dimension'
  ],
  
  // Units of Measure - should not be Record IDs or Record Names
  UOM: [
    'unit', 'uom', 'measure', 'weight', 'volume', 'liter', 'litre',
    'height', 'width', 'depth', 'length', 'size'
  ],
  
  // Inventory/Quantity - should not be Record Names
  INVENTORY: [
    'qty', 'quantity', 'stock', 'case', 'layer', 'price'
  ],
  
  // Technical/Dates - should not be Record Names
  TECHNICAL: [
    'supervisor', 'family', 'hierarchy', 'date', 'time', 'created', 'valid',
    'listed', 'first', 'url', 'link', 'href'
  ],
  
  // Attributes/Variants - should not be Record Names (prefer descriptive names)
  ATTRIBUTES: [
    'color', 'colour', 'size'
  ]
};

// Flatten all exclude keywords for easy checking
const ALL_EXCLUDE_KEYWORDS = [
  ...EXCLUDE_KEYWORDS.IDS_AND_CODES,
  ...EXCLUDE_KEYWORDS.LOGISTICS,
  ...EXCLUDE_KEYWORDS.UOM,
  ...EXCLUDE_KEYWORDS.INVENTORY,
  ...EXCLUDE_KEYWORDS.TECHNICAL,
  ...EXCLUDE_KEYWORDS.ATTRIBUTES
];

// Exclude keywords for Record ID validation (UoM + Logistics only)
const EXCLUDE_KEYWORDS_RECORD_ID = [
  ...EXCLUDE_KEYWORDS.LOGISTICS,
  ...EXCLUDE_KEYWORDS.UOM
];

// Exclude keywords for Record Name validation (all categories)
const EXCLUDE_KEYWORDS_RECORD_NAME = ALL_EXCLUDE_KEYWORDS;

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
  
  // CRITICAL: Minimum 6 properties per level to favor 2-level hierarchies (Parent + SKU)
  // Levels with < 6 properties will be merged into the next level
  const MIN_PROPERTIES_PER_LEVEL = customThresholds?.minPropertiesPerLevel || 6;

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

  // NEW: Generate 3 preset hierarchy structures (Flat, Parent-Variant, Multi-Level PIM)
  // CRITICAL: Pass actual hierarchy to ensure presets match initial analysis distribution
  const hierarchyPresets = generateHierarchyPresets(cardinalityScores, headers, hierarchy);
  
  // Generate alternative hierarchies (legacy - keep for backward compatibility)
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
    hierarchyPresets,
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
    const allValues = columnData.length;
    const nonEmptyValues = columnData.filter((val) => val !== null && val !== undefined && val !== '');
    const uniqueValues = new Set(nonEmptyValues);
    const uniqueCount = uniqueValues.size;
    const totalCount = nonEmptyValues.length;
    const cardinality = totalCount > 0 ? uniqueCount / totalCount : 0;
    
    // NEW: Calculate completeness (data density)
    const completeness = allValues > 0 ? totalCount / allValues : 0;
    
    // NEW: Calculate hierarchy score (multi-factor)
    // Formula: Completeness weight * Cardinality weight
    // High completeness + Low cardinality = Top hierarchy level
    // High completeness + High cardinality = SKU/Attribute level
    // Low completeness = Variant/Attribute (regardless of cardinality)
    let hierarchyScore = 0;
    
    if (completeness >= 0.8) {
      // High completeness (≥80% filled)
      if (cardinality <= 0.05) {
        hierarchyScore = 100; // Top level (Brand, Category)
      } else if (cardinality <= 0.30) {
        hierarchyScore = 75;  // Mid level (Subcategory, Material)
      } else if (cardinality <= 0.70) {
        hierarchyScore = 50;  // Variant level (Color, Size)
      } else {
        hierarchyScore = 25;  // SKU/Attribute level (EAN, SKU)
      }
    } else if (completeness >= 0.50) {
      // Medium completeness (50-80% filled)
      hierarchyScore = 40; // Likely variant/attribute
    } else {
      // Low completeness (<50% filled)
      hierarchyScore = 10; // Sparse attribute (never top-level)
    }

    // CRITICAL: 3-level classification (max 3 levels per user requirement)
    let classification: 'level1' | 'level2' | 'level3';
    if (cardinality >= SKU_THRESHOLD) {
      classification = 'level3'; // SKU/Attribute level (≥98%)
    } else if (cardinality >= CHILDREN_THRESHOLD_MIN) {
      classification = 'level2'; // Child/Variant (50%-98%)
    } else {
      classification = 'level1'; // Parent level (≤50%)
    }

    return {
      header,
      uniqueCount,
      totalCount,
      cardinality,
      completeness,
      hierarchyScore,
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
  
  // CRITICAL: EXCLUDE dates and temporal fields - NEVER use as Record ID
  const dateKeywords = [
    'date', 'time', 'timestamp', 'created', 'modified', 'updated',
    'valid', 'valid from', 'valid to', 'start', 'end', 'expiry', 'expiration',
    'dispatch', 'availab', 'launch', 'discontinue', 'listed', 'added',
    'first', 'last', 'since', 'until', 'from', 'to', 'on', 'at'
  ];
  if (dateKeywords.some(kw => lower.includes(kw))) {
    return false;
  }
  
  // CRITICAL: EXCLUDE descriptions - NEVER use as Record ID
  const descriptionKeywords = [
    'description', 'desc', 'note', 'comment', 'remark', 'detail',
    'summary', 'overview', 'text', 'content', 'information', 'info'
  ];
  if (descriptionKeywords.some(kw => lower.includes(kw))) {
    return false;
  }
  
  // CRITICAL: EXCLUDE UoM, measurements, and media - NEVER use as Record ID
  const measurementKeywords = [
    'uom', 'unit', 'measure', 'measurement', 'dimension',
    'weight', 'height', 'width', 'depth', 'length', 'size',
    'quantity', 'amount', 'volume', 'capacity',
    'url', 'link', 'image', 'photo', 'picture', 'media', 'asset',
    'price', 'cost', 'value', 'rate'
  ];
  if (measurementKeywords.some(kw => lower.includes(kw))) {
    return false;
  }
  
  // EXCLUDE UoM and logistics - NEVER use as Record ID
  if (EXCLUDE_KEYWORDS_RECORD_ID.some(kw => lower.includes(kw))) {
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
  // Check if header contains name keywords but not exclude keywords
  const hasNameKeyword = nameKeywords.some(kw => lower.includes(kw));
  const hasExcludeKeyword = EXCLUDE_KEYWORDS_RECORD_NAME.some(kw => lower.includes(kw));
  
  return hasNameKeyword && !hasExcludeKeyword;
};

// Helper: Score a header for Record ID suitability (shared scoring logic)
const getRecordIdScore = (header: string): number => {
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

// Helper: Score headers for Record Name suitability (shared across functions)
const scoreHeaderForRecordName = (header: string, recordId: string, usedRecordNames: string[] = []): number => {
  if (header === recordId) return -1000; // Never same as Record ID
  
  // CRITICAL: Never reuse Record Name from another level
  if (usedRecordNames.includes(header)) {
    console.log(`🚫 BLOCKED - "${header}" already used as Record Name in another level`);
    return -1000;
  }
  
  const lower = header.toLowerCase();
  let score = 0;
  
  // PRIORITY 1: Simple "Name" field (HIGHEST - most concise and clear)
  if (lower === 'name') {
    score += 300; // CRITICAL: Massive bonus for simple "Name" - always prefer this
  }
  // PRIORITY 2: "Product Name" or similar specific name fields
  else if (lower.includes('product') && lower.includes('name') && !lower.includes('code')) {
    score += 200;
    // Small penalty for longer names
    score -= header.length * 0.1;
  }
  // PRIORITY 3: Other "name" fields
  else if (lower.includes('name') && !lower.includes('code')) {
    score += 150;
    // Penalty for longer names (prefer concise)
    score -= header.length * 0.2;
  }
  
  // PRIORITY 4: "description" fields (LOWER than name fields)
  else if (lower.includes('description')) {
    score += 50; // Reduced from 90 to ensure name fields win
    // Penalty for longer descriptions
    score -= header.length * 0.5;
  }
  
  // PRIORITY 4: "brand" fields
  else if (lower.includes('brand')) score += 80;
  
  // PRIORITY 5: Other name-like fields
  else if (lower.includes('title') || lower.includes('label') || lower.includes('text')) score += 70;
  
  // CRITICAL: EXCLUDE logistics, UoM, dates, and technical fields
  if (EXCLUDE_KEYWORDS_RECORD_NAME.some(kw => lower.includes(kw))) {
    score -= 200; // HEAVY penalty
  }
  
  return score;
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
  minPropertiesPerLevel: number = 6,
  itemLevelHeaders: string[] = []  // Renamed: these are hints, not exclusions
): { hierarchy: HierarchyLevel[]; properties: string[]; confidence: number; propertiesWithoutValues: string[] } => {
  // ANALYZE ALL HEADERS (including item-level)
  // Item-level headers will be analyzed for Record ID detection
  // but will be forced to SKU-level at the end
  const validScores = cardinalityScores;  // Use ALL scores
  const validHeaders = validScores.map(s => s.header);

  const hierarchy: HierarchyLevel[] = [];
  const properties: string[] = [];

  // NEW: Sort by hierarchyScore (high to low) instead of cardinality
  // This ensures attributes with high completeness + low cardinality come first
  const sortedScores = [...validScores].sort(
    (a, b) => b.hierarchyScore - a.hierarchyScore
  );

  // NEW: Classify headers using hierarchyScore (multi-factor)
  // hierarchyScore ranges:
  // 100 = Top level (Brand, Category) - High completeness + Very low cardinality
  // 75  = Mid level (Subcategory, Material) - High completeness + Low cardinality
  // 50  = Variant level (Color, Size) - High completeness + Medium cardinality
  // 40  = Variant/Attribute - Medium completeness
  // 25  = SKU/Attribute (EAN, SKU) - High completeness + High cardinality
  // 10  = Sparse attribute - Low completeness (NEVER top-level)
  
  // ============================================================================
  // SIMPLIFIED HIERARCHY: Favor 2-level models (Parent + SKU)
  // Only create Level 2 if there's clear separation in the data
  // ============================================================================
  
  // Level 1: STRICT criteria - High hierarchy score (≥75) + high completeness (≥85%)
  // These are true taxonomy/category properties (Brand, Category, Product Type)
  const level1Headers = sortedScores
    .filter((score) => score.hierarchyScore >= 75 && score.completeness >= 0.85)
    .map((score) => score.header);

  // Level 2: VERY STRICT - Only create if data has clear mid-level structure
  // Must have high completeness (≥80%) AND mid-range hierarchy score (50-75)
  // This prevents creating unnecessary 3-level hierarchies
  const level2Headers = sortedScores
    .filter((score) => 
      score.hierarchyScore >= 50 && 
      score.hierarchyScore < 75 && 
      score.completeness >= 0.80 &&
      score.cardinality < 0.5  // Not too unique - should have repetition
    )
    .map((score) => score.header);

  // SKU Level: Everything else - low hierarchy score OR high uniqueness OR incomplete data
  // Includes: logistics, dates, technical specs, item-level attributes
  const skuHeaders = sortedScores
    .filter((score) => 
      score.hierarchyScore < 50 ||  // Low hierarchy score
      score.cardinality >= 0.5 ||   // High uniqueness
      score.completeness < 0.80     // Incomplete data
    )
    .map((score) => score.header);

  // For backward compatibility in logging (level3Headers is now empty - merged into level2)
  const level3Headers: string[] = [];

  // Legacy variables for backward compatibility
  const lowCardinalityHeaders = level1Headers;
  const mediumCardinalityHeaders = level2Headers;
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
      // CRITICAL: EXCLUDE "Name" - it should be reserved for Record Name, not Record ID
      const shortCode = nonItemLevelHeaders.find(h => {
        const trimmed = h.trim();
        const lower = h.toLowerCase();
        // Skip "Name" field - reserved for Record Name
        if (lower === 'name') return false;
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
      // CRITICAL: EXCLUDE "Name" - reserved for Record Name
      let candidate = nonItemLevelHeaders.find(h => {
        const lower = h.toLowerCase();
        if (lower === 'name') return false; // Reserved for Record Name
        return isLikelyRecordId(h) && hasGoodRepresentation(h) && isUnique(h);
      });
      if (candidate) return candidate;
      
      // FALLBACK 1: Relax uniqueness requirement
      candidate = nonItemLevelHeaders.find(h => {
        const lower = h.toLowerCase();
        if (lower === 'name') return false; // Reserved for Record Name
        return isLikelyRecordId(h) && hasGoodRepresentation(h);
      });
      if (candidate) return candidate;
      
      // FALLBACK 2: Just find any ID-like field
      candidate = nonItemLevelHeaders.find(h => {
        const lower = h.toLowerCase();
        if (lower === 'name') return false; // Reserved for Record Name
        return isLikelyRecordId(h);
      });
      if (candidate) return candidate;
      
      // FALLBACK 3: Use first non-item-level header (but not "Name")
      return nonItemLevelHeaders.find(h => h.toLowerCase() !== 'name') || nonItemLevelHeaders[0];
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
    
    // PRIORITY 2: If ALL headers have negative scores
    // CRITICAL: NEVER use fields with score < 0 (Color, shipping, UoM, etc.)
    if (!recordName && scoredHeaders.length > 0) {
      console.error(`❌ ERROR - No suitable Record Name found. All candidates have negative scores.`);
      console.error(`❌ Top candidates:`, scoredHeaders.slice(0, 5).map(h => `"${h.header}" (${h.score})`));
      
      // If this is SKU-level, look for preserved description/name fields
      if (isLowestLevel) {
        const preservedNameFields = levelHeaders.filter(h => {
          const lower = h.toLowerCase();
          return (lower.includes('name') || lower.includes('description')) && 
                 !usedRecordNames.includes(h) && 
                 h !== recordId;
        });
        
        if (preservedNameFields.length > 0) {
          recordName = preservedNameFields[0];
          console.log(`✅ Using preserved name/description field: "${recordName}"`);
        }
      }
      
      // If still no Record Name, leave undefined (better than using bad options like "Color")
      if (!recordName) {
        console.warn(`⚠️ WARNING - No Record Name assigned. All candidates are unsuitable.`);
        recordName = undefined;
      }
    }
    
    if (!recordName) {
      console.warn(`⚠️ WARNING - Could not find suitable Record Name for level (Record ID: "${recordId}")`);
    }
    
    return { recordId, recordName };
  };

  // ============================================================================
  // DYNAMIC HIERARCHY BUILDING: Maximum 3 levels (Level 1 + Level 2 + SKU)
  // CRITICAL: If a level has < minPropertiesPerLevel (default 6), merge into next level
  // ============================================================================
  const hierarchyLevels: { name: string; headers: string[]; isLowest: boolean }[] = [];
  let orphanedHeaders: string[] = [];
  
  console.log(`🔍 DEBUG - Building hierarchy with minPropertiesPerLevel = ${minPropertiesPerLevel}`);
  console.log(`🔍 DEBUG - Level 1 candidates: ${level1Headers.length}, Level 2 candidates: ${level2Headers.length}, SKU candidates: ${skuHeaders.length}`);
  
  // Add Level 1 (Parent/Taxonomy) if exists AND has enough properties
  if (level1Headers.length >= minPropertiesPerLevel) {
    hierarchyLevels.push({
      name: 'Parent Level (Taxonomy)',
      headers: [...level1Headers],
      isLowest: false,
    });
    console.log(`✅ Level 1 created with ${level1Headers.length} properties`);
  } else if (level1Headers.length > 0) {
    console.log(`🔍 DEBUG - Level 1 has < ${minPropertiesPerLevel} properties (${level1Headers.length}). Merging to next level.`);
    orphanedHeaders.push(...level1Headers);
  }
  
  // Add Level 2 (Child/Variant) if exists AND has enough properties (including orphaned)
  const level2Combined = [...orphanedHeaders, ...level2Headers];
  if (level2Combined.length >= minPropertiesPerLevel) {
    hierarchyLevels.push({
      name: hierarchyLevels.length === 0 ? 'Parent Level (Taxonomy)' : 'SKU-Level Properties',
      headers: level2Combined,
      isLowest: false,
    });
    console.log(`✅ Level 2 created with ${level2Combined.length} properties (${orphanedHeaders.length} orphaned + ${level2Headers.length} native)`);
    orphanedHeaders = [];
  } else if (level2Headers.length > 0) {
    console.log(`🔍 DEBUG - Level 2 has < ${minPropertiesPerLevel} properties (${level2Combined.length}). Merging to SKU level.`);
    orphanedHeaders = level2Combined;
  }
  
  // MAXIMUM 2 hierarchy levels - everything else goes to SKU
  
  // If NO hierarchy levels were created, all non-SKU headers become orphaned
  if (hierarchyLevels.length === 0 && (level1Headers.length > 0 || level2Headers.length > 0)) {
    const allNonSkuHeaders = [...level1Headers, ...level2Headers];
    console.log(`🔍 DEBUG - No hierarchy levels created. ${allNonSkuHeaders.length} headers will go to SKU level.`);
    orphanedHeaders = allNonSkuHeaders;
  }
  
  // CRITICAL: Ensure ALL headers are classified in at least one level
  const classifiedHeaders = new Set<string>();
  level1Headers.forEach(h => classifiedHeaders.add(h));
  level2Headers.forEach(h => classifiedHeaders.add(h));
  skuHeaders.forEach(h => classifiedHeaders.add(h));
  
  const unclassifiedHeaders = validHeaders.filter(h => !classifiedHeaders.has(h));
  
  if (unclassifiedHeaders.length > 0) {
    console.warn(`⚠️ WARNING - ${unclassifiedHeaders.length} unclassified headers found, forcing to SKU-level:`, unclassifiedHeaders);
    // Add unclassified headers to SKU level
    skuHeaders.push(...unclassifiedHeaders);
  }
  
  // Always add SKU level (even if empty, properties will be added later)
  // CRITICAL: Add any orphaned headers from skipped levels
  if (orphanedHeaders.length > 0) {
    console.log(`🔍 DEBUG - Adding ${orphanedHeaders.length} orphaned headers to SKU-level:`, orphanedHeaders);
  }
  
  hierarchyLevels.push({
    name: 'SKU-Level Properties',
    headers: [...orphanedHeaders, ...skuHeaders],
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
    console.log(`\n🔍 DEBUG - ========== LEVEL ${index + 1} ==========`);
    console.log(`🔍 DEBUG - Level headers (${levelData.headers.length}):`, levelData.headers.slice(0, 10));
    console.log(`🔍 DEBUG - Used Record Names so far:`, usedRecordNames);
    
    let { recordId, recordName } = findRecordIdAndName(levelData.headers, levelData.isLowest, usedRecordNames);
    
    console.log(`🔍 DEBUG - findRecordIdAndName returned:`);
    console.log(`  - Record ID: "${recordId}"`);
    console.log(`  - Record Name: "${recordName}"`);
    console.log(`  - Is duplicate? ${recordName && usedRecordNames.includes(recordName) ? 'YES ❌' : 'NO ✅'}`);
    
    console.log(`🔍 DEBUG - Selected Record Name for level ${index + 1}: "${recordName}"`);
    
    // CRITICAL: Check if Record Name was already used (double-check safety)
    if (recordName && usedRecordNames.includes(recordName)) {
      console.error(`❌ CRITICAL ERROR - Record Name "${recordName}" was already used in another level!`);
      console.error(`❌ FORCING RE-SELECTION with stricter filtering...`);
      
      // FORCE re-selection: find alternative Record Name that's NOT in usedRecordNames
      const alternativeCandidates = levelData.headers
        .filter(h => h !== recordId && !usedRecordNames.includes(h))
        .map(h => ({ header: h, score: scoreHeaderForRecordName(h, recordId, usedRecordNames) }))
        .filter(h => h.score > 0)
        .sort((a, b) => b.score - a.score);
      
      if (alternativeCandidates.length > 0) {
        recordName = alternativeCandidates[0].header;
        console.log(`✅ FIXED - Using alternative Record Name: "${recordName}"`);
      } else {
        console.warn(`⚠️ WARNING - No alternative Record Name found. Setting to undefined.`);
        recordName = undefined;
      }
    }
    
    // Add this Record Name to the used list
    if (recordName) {
      usedRecordNames.push(recordName);
      console.log(`🔍 DEBUG - Added "${recordName}" to usedRecordNames. Total used:`, usedRecordNames.length);
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
    
    // CRITICAL: Collect ONLY Record Names that need to be preserved during merge
    // DO NOT collect all "description/name" fields - only actual Record Names
    const recordNamesToPreserve: string[] = [];
    consolidatedHierarchy.forEach(level => {
      if (level.recordName) {
        const lower = level.recordName.toLowerCase();
        if ((lower.includes('description') || lower.includes('name')) && 
            !lower.includes('code') && 
            !recordNamesToPreserve.includes(level.recordName)) {
          recordNamesToPreserve.push(level.recordName);
          console.log(`🔍 DEBUG - Record Name to preserve: "${level.recordName}"`);
        }
      }
    });
    
    console.log(`🔍 DEBUG - Record Names to preserve during merge (${recordNamesToPreserve.length}):`, recordNamesToPreserve);
    
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
    
    // CRITICAL: Do NOT add arbitrary description/name fields to SKU-level
    // Only Record Names from merged levels will be re-added during consolidation
    // This prevents "Short Description" from being added when "Name" was already selected
    console.log(`🔍 DEBUG - Skipping automatic addition of description/name fields to prevent unwanted Record Name candidates`);
    
    // CRITICAL: Clear Record ID/Name of last level if they are in itemLevelFields
    // They will be re-selected later from the forced headers
    // BUT: We must add them back to headers BEFORE clearing to prevent property loss!
    if (lastLevelRecordId && itemLevelFields.includes(lastLevelRecordId)) {
      console.log(`🔍 DEBUG - Clearing Record ID "${lastLevelRecordId}" from last level (will be in forced headers)`);
      // Add back to headers before clearing (if not already there)
      if (!lastLevel.headers.includes(lastLevelRecordId)) {
        lastLevel.headers.push(lastLevelRecordId);
        console.log(`🔍 DEBUG - Added Record ID "${lastLevelRecordId}" back to headers before clearing`);
      }
      lastLevel.recordId = undefined;
    }
    if (lastLevelRecordName && itemLevelFields.includes(lastLevelRecordName)) {
      console.log(`🔍 DEBUG - Clearing Record Name "${lastLevelRecordName}" from last level (will be in forced headers)`);
      // Add back to headers before clearing (if not already there)
      if (!lastLevel.headers.includes(lastLevelRecordName)) {
        lastLevel.headers.push(lastLevelRecordName);
        console.log(`🔍 DEBUG - Added Record Name "${lastLevelRecordName}" back to headers before clearing`);
      }
      lastLevel.recordName = undefined;
    }
    
    // RE-SELECT Record ID and Record Name from the forced headers
    // ONLY if they were cleared (undefined), otherwise preserve them
    console.log(`🔍 DEBUG - SKU-level headers BEFORE re-selection (${lastLevel.headers.length}):`, lastLevel.headers.slice(0, 20));
    console.log(`🔍 DEBUG - Current Record ID: ${lastLevel.recordId}, Current Record Name: ${lastLevel.recordName}`);
    
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
    
    // Only re-select if Record ID/Name were cleared (undefined)
    if (!lastLevel.recordId || !lastLevel.recordName) {
      const { recordId: newRecordId, recordName: newRecordName } = findRecordIdAndName(lastLevel.headers, true, usedRecordNamesInOtherLevels);
      
      // Only update if currently undefined
      if (!lastLevel.recordId && newRecordId) {
        lastLevel.recordId = newRecordId;
        console.log(`🔍 DEBUG - Re-selected Record ID for last level: ${newRecordId}`);
        // Remove from headers
        lastLevel.headers = lastLevel.headers.filter(h => h !== newRecordId);
      }
      if (!lastLevel.recordName && newRecordName) {
        lastLevel.recordName = newRecordName;
        console.log(`🔍 DEBUG - Re-selected Record Name for last level: ${newRecordName}`);
        // Remove from headers
        lastLevel.headers = lastLevel.headers.filter(h => h !== newRecordName);
      }
    } else {
      console.log(`🔍 DEBUG - Keeping existing Record ID: ${lastLevel.recordId}, Record Name: ${lastLevel.recordName}`);
    }
    
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
  
  // CRITICAL: RE-SELECT Record Name for last level AFTER consolidation
  // This is necessary because consolidation may have added better candidates (e.g., "Name" from merged levels)
  if (finalHierarchy.length > 0) {
    const lastLevel = finalHierarchy[finalHierarchy.length - 1];
    const recordNamesInOtherLevels = finalHierarchy
      .filter(level => level !== lastLevel && level.recordName)
      .map(level => level.recordName!);
    
    console.log(`🔍 DEBUG - RE-SELECTING Record Name for last level after consolidation...`);
    console.log(`🔍 DEBUG - Last level headers AFTER consolidation (${lastLevel.headers.length}):`, lastLevel.headers.slice(0, 20));
    
    const { recordName: newRecordName } = findRecordIdAndName(
      [...lastLevel.headers, lastLevel.recordId].filter(h => h !== undefined) as string[], 
      true, 
      recordNamesInOtherLevels
    );
    
    // Only update if we found a better Record Name
    if (newRecordName && newRecordName !== lastLevel.recordName) {
      console.log(`🔍 DEBUG - UPDATING Record Name from "${lastLevel.recordName}" to "${newRecordName}"`);
      
      // Add old Record Name back to headers if it exists
      if (lastLevel.recordName && !lastLevel.headers.includes(lastLevel.recordName)) {
        lastLevel.headers.push(lastLevel.recordName);
      }
      
      // Set new Record Name
      lastLevel.recordName = newRecordName;
      
      // Remove new Record Name from headers
      lastLevel.headers = lastLevel.headers.filter(h => h !== newRecordName);
    } else {
      console.log(`🔍 DEBUG - Keeping existing Record Name: "${lastLevel.recordName}"`);
    }
  }
  
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
      
      // SAFETY NET: Automatically recover missing properties by adding them to the last level
      // This ensures NO properties are ever lost
      if (finalHierarchy.length > 0) {
        const lastLevel = finalHierarchy[finalHierarchy.length - 1];
        missing.forEach(prop => {
          if (!lastLevel.headers.includes(prop) && 
              prop !== lastLevel.recordId && 
              prop !== lastLevel.recordName) {
            lastLevel.headers.push(prop);
            console.log(`✅ RECOVERED - Added missing property "${prop}" to last level`);
          }
        });
      }
      
      // DEBUG: Check where these properties were lost (for future debugging)
      console.log('\n🔍 DEBUG - Investigating missing properties:');
      missing.forEach(prop => {
        const inLevel1 = level1Headers.includes(prop);
        const inLevel2 = level2Headers.includes(prop);
        const inSku = skuHeaders.includes(prop);
        const inItemLevel = itemLevelFields.includes(prop);
        const score = cardinalityScores.find(s => s.header === prop);
        
        console.log(`  "${prop}":`);
        console.log(`    - In level1Headers? ${inLevel1}`);
        console.log(`    - In level2Headers? ${inLevel2}`);
        console.log(`    - In skuHeaders? ${inSku}`);
        console.log(`    - In itemLevelFields? ${inItemLevel}`);
        console.log(`    - hierarchyScore: ${score?.hierarchyScore}`);
        console.log(`    - completeness: ${score?.completeness}`);
      });
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

// NEW: Generate 3 preset hierarchy structures based on ACTUAL analysis results
// CRITICAL: Uses the actual hierarchy from determineHierarchy to ensure consistent distribution
const generateHierarchyPresets = (
  cardinalityScores: CardinalityScore[],
  headers: string[],
  actualHierarchy: HierarchyLevel[]  // The ACTUAL hierarchy from initial analysis
): HierarchyAlternative[] => {
  const presets: HierarchyAlternative[] = [];
  
  // CRITICAL: Use ACTUAL hierarchy levels from initial analysis
  // This ensures presets match the initial analysis distribution
  const actualLevel1Headers = actualHierarchy.length > 0 
    ? [...actualHierarchy[0].headers, actualHierarchy[0].recordId, actualHierarchy[0].recordName].filter(Boolean) as string[]
    : [];
  
  const actualSkuHeaders = actualHierarchy.length > 1 
    ? [...actualHierarchy[actualHierarchy.length - 1].headers, 
       actualHierarchy[actualHierarchy.length - 1].recordId, 
       actualHierarchy[actualHierarchy.length - 1].recordName].filter(Boolean) as string[]
    : headers;
  
  // For mid-level (if 3+ levels exist)
  const actualMidHeaders = actualHierarchy.length > 2
    ? actualHierarchy.slice(1, -1).flatMap(l => [...l.headers, l.recordId, l.recordName].filter(Boolean)) as string[]
    : [];
  
  console.log(`🔍 [generateHierarchyPresets] Using ACTUAL hierarchy distribution:`);
  console.log(`   - Level 1 headers: ${actualLevel1Headers.length}`);
  console.log(`   - Mid-level headers: ${actualMidHeaders.length}`);
  console.log(`   - SKU headers: ${actualSkuHeaders.length}`);
  
  // Legacy classification for backward compatibility (only used if actual hierarchy is empty)
  const sortedByScore = [...cardinalityScores].sort((a, b) => b.hierarchyScore - a.hierarchyScore);
  const denseAttributes = sortedByScore.filter(s => s.completeness >= 0.5);
  const topLevel = denseAttributes.filter(s => s.hierarchyScore >= 75);
  const midLevel = denseAttributes.filter(s => s.hierarchyScore >= 50 && s.hierarchyScore < 75);
  const variantLevel = denseAttributes.filter(s => s.hierarchyScore >= 25 && s.hierarchyScore < 50);
  const skuLevel = sortedByScore.filter(s => s.hierarchyScore < 25 || s.cardinality >= 0.98);
  
  // Helper: Find best Record ID from headers (CRITICAL: use same logic as findBestRecordId)
  const findRecordIdForPreset = (levelHeaders: string[], isSkuLevel: boolean = false): string => {
    console.log(`🔍 [findRecordIdForPreset] Level headers (${levelHeaders.length}):`, levelHeaders);
    console.log(`🔍 [findRecordIdForPreset] isSkuLevel: ${isSkuLevel}`);
    
    // CRITICAL: Filter using isLikelyRecordId to exclude dates, descriptions, UoMs, etc.
    const validHeaders = levelHeaders.filter(h => isLikelyRecordId(h));
    console.log(`🔍 [findRecordIdForPreset] Valid headers after isLikelyRecordId filter (${validHeaders.length}):`, validHeaders);
    
    if (isSkuLevel) {
      // Priority for SKU-level: SKU > GTIN > EAN > ASIN > any valid ID
      const skuKeywords = ['sku', 'gtin', 'ean', 'barcode', 'asin', 'upc'];
      for (const kw of skuKeywords) {
        const found = validHeaders.find(h => h.toLowerCase().includes(kw));
        if (found) {
          console.log(`✅ [findRecordIdForPreset] Selected SKU-level Record ID: "${found}"`);
          return found;
        }
      }
      const fallback = validHeaders[0] || levelHeaders[0];
      console.log(`⚠️ [findRecordIdForPreset] No SKU keyword found, using fallback: "${fallback}"`);
      return fallback;
    }
    
    // For non-SKU levels: L1/L2/L3 codes > any valid ID
    const levelCode = validHeaders.find(h => /^l\d+$/i.test(h.toLowerCase()));
    if (levelCode) {
      console.log(`✅ [findRecordIdForPreset] Selected level code Record ID: "${levelCode}"`);
      return levelCode;
    }
    
    const selected = validHeaders[0] || levelHeaders[0];
    console.log(`✅ [findRecordIdForPreset] Selected Record ID: "${selected}"`);
    return selected;
  };
  
  // Helper: Find best Record Name from headers using same logic as initial analysis
  const findRecordNameForPreset = (levelHeaders: string[], recordId: string, usedNames: string[]): string | undefined => {
    // Use the SAME scoring function as initial analysis for consistency
    const scoredHeaders = levelHeaders
      .map(h => ({ header: h, score: scoreHeaderForRecordName(h, recordId, usedNames) }))
      .sort((a, b) => b.score - a.score);
    
    // Find first with positive score
    let recordName = scoredHeaders.find(h => h.score > 0)?.header;
    
    // Fallback: If all negative, pick least-bad (but exclude score = -1000)
    if (!recordName && scoredHeaders.length > 0) {
      const availableCandidates = scoredHeaders.filter(h => h.score > -1000);
      if (availableCandidates.length > 0) {
        recordName = availableCandidates[0].header;
      }
    }
    
    return recordName;
  };
  
  // Track used Record IDs and Names to prevent duplication
  const usedRecordIds = new Set<string>();
  const usedRecordNames = new Set<string>();
  
  // PRESET A: Flat Model (1 Level - Raw Data Mapping)
  const flatRecordId = findRecordIdForPreset(headers, true);
  const flatRecordName = findRecordNameForPreset(headers, flatRecordId, []);
  usedRecordIds.add(flatRecordId);
  if (flatRecordName) usedRecordNames.add(flatRecordName);
  
  presets.push({
    name: 'Flat Model',
    hierarchy: [
      {
        level: 1,
        name: 'Product',
        headers: headers.filter(h => h !== flatRecordId && h !== flatRecordName),
        recordId: flatRecordId,
        recordName: flatRecordName,
      }
    ],
    properties: [],
    confidence: 0.6,
    reasoning: '1-level structure. All attributes at product level.',
    modelType: 'standalone',
  });
  
  // PRESET B: Parent-Variant (2 Levels: Product → SKU)
  // CRITICAL: Use ACTUAL hierarchy distribution from initial analysis
  // This ensures the preset matches what the user sees in the initial analysis
  
  if (actualLevel1Headers.length > 0 && actualSkuHeaders.length > 0) {
    // Use the ACTUAL Record ID and Record Name from initial analysis
    const level1RecordId = actualHierarchy[0]?.recordId || findRecordIdForPreset(actualLevel1Headers, false);
    const level1RecordName = actualHierarchy[0]?.recordName;
    
    const lastLevel = actualHierarchy[actualHierarchy.length - 1];
    const level2RecordId = lastLevel?.recordId || findRecordIdForPreset(actualSkuHeaders, true);
    const level2RecordName = lastLevel?.recordName;
    
    // Get headers WITHOUT Record ID/Name (they're separate)
    const level1HeadersClean = actualHierarchy[0]?.headers || [];
    const level2HeadersClean = lastLevel?.headers || [];
    
    presets.push({
      name: 'Parent-Variant',
      hierarchy: [
        {
          level: 1,
          name: 'Parent Level (Taxonomy)',
          headers: level1HeadersClean,
          recordId: level1RecordId,
          recordName: level1RecordName,
        },
        {
          level: 2,
          name: 'SKU-Level Properties',
          headers: level2HeadersClean,
          recordId: level2RecordId,
          recordName: level2RecordName,
        }
      ],
      properties: [],
      confidence: 0.85,  // High confidence - matches initial analysis
      reasoning: '2-level structure (RECOMMENDED). Matches initial analysis distribution. Parent taxonomy → SKU-level details.',
      modelType: 'hierarchical',
    });
  }
  
  // PRESET C: Multi-Level PIM (3 Levels: Family → Model → Variant)
  // CRITICAL: Generate based on ORIGINAL classification (before consolidation)
  // This allows 3-level option even when initial analysis consolidated to 2 levels
  
  // Use original score-based classification to check if 3-level makes sense
  const hasEnoughForMultiLevel = topLevel.length >= 3 && midLevel.length >= 1;
  
  if (hasEnoughForMultiLevel) {
    const usedInPresetC = new Set<string>();
    const usedNamesInPresetC: string[] = [];
    
    // Use Level 1 from actual hierarchy (preserves item-level field filtering)
    const familyHeaders = actualLevel1Headers;
    
    // Level 2 (Model): Use mid-level properties from original classification
    const modelHeaders = midLevel.map(s => s.header).filter(h => !actualLevel1Headers.includes(h));
    
    // Level 3 (SKU): Everything else
    const variantSkuHeaders = actualSkuHeaders.filter(h => 
      !familyHeaders.includes(h) && !modelHeaders.includes(h)
    );
    
    // Level 1: Family - Use actual hierarchy Level 1
    const fam1RecordId = actualHierarchy[0]?.recordId || findRecordIdForPreset(familyHeaders, false);
    const fam1RecordName = actualHierarchy[0]?.recordName;
    usedInPresetC.add(fam1RecordId);
    if (fam1RecordName) {
      usedNamesInPresetC.push(fam1RecordName);
      usedInPresetC.add(fam1RecordName);
    }
    
    // Level 2: Model
    const mod2Headers = modelHeaders.filter(h => !usedInPresetC.has(h));
    const mod2RecordId = findRecordIdForPreset(mod2Headers, false);
    const mod2RecordName = findRecordNameForPreset(mod2Headers, mod2RecordId, usedNamesInPresetC);
    usedInPresetC.add(mod2RecordId);
    if (mod2RecordName) {
      usedNamesInPresetC.push(mod2RecordName);
      usedInPresetC.add(mod2RecordName);
    }
    
    // Level 3: Variant/SKU
    const var3Headers = variantSkuHeaders.filter(h => !usedInPresetC.has(h));
    const var3RecordId = actualHierarchy[actualHierarchy.length - 1]?.recordId || findRecordIdForPreset(var3Headers, true);
    const var3RecordName = actualHierarchy[actualHierarchy.length - 1]?.recordName || findRecordNameForPreset(var3Headers, var3RecordId, usedNamesInPresetC);
    
    presets.push({
      name: 'Multi-Level PIM',
      hierarchy: [
        {
          level: 1,
          name: 'Family',
          headers: actualHierarchy[0]?.headers || familyHeaders.filter(h => h !== fam1RecordId && h !== fam1RecordName),
          recordId: fam1RecordId,
          recordName: fam1RecordName,
        },
        {
          level: 2,
          name: 'Model',
          headers: mod2Headers.filter(h => h !== mod2RecordId && h !== mod2RecordName),
          recordId: mod2RecordId,
          recordName: mod2RecordName,
        },
        {
          level: 3,
          name: 'Variant',
          headers: var3Headers.filter(h => h !== var3RecordId && h !== var3RecordName),
          recordId: var3RecordId,
          recordName: var3RecordName,
        }
      ],
      properties: [],
      confidence: 0.70,  // Lower confidence than 2-level (we favor 2-level)
      reasoning: '3-level structure. Family → Model → Variant. Use when you need an intermediate grouping level.',
      modelType: 'hierarchical',
    });
  }
  
  return presets;
};

const generateAlternativeHierarchies = (
  cardinalityScores: CardinalityScore[],
  headers: string[],
  productDomain: ProductDomain
): HierarchyAlternative[] => {
  const alternatives: HierarchyAlternative[] = [];
  const sortedScores = [...cardinalityScores].sort((a, b) => a.cardinality - b.cardinality);
  
  // SIMPLIFIED: Only 2 classification levels + SKU (max 3 total)
  const level1Headers = sortedScores.filter(s => s.classification === 'level1').map(s => s.header);
  const level2Headers = sortedScores.filter(s => s.classification === 'level2' || s.classification === 'level3').map(s => s.header);
  const combinedHeaders = [...level1Headers, ...level2Headers];

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
    const properties = combinedHeaders.slice(1);
    
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
    const properties = combinedHeaders.slice(2);
    
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
    const properties = combinedHeaders.slice(3);
    
    alternatives.push({
      name: '3-Level Hierarchy',
      hierarchy,
      properties,
      confidence: 0.8,
      reasoning: 'Detailed taxonomy with three levels (Parent → Child → Grandchild)',
      modelType: 'hierarchical',
    });
  }

  // REMOVED: Alternative 5 (4-Level Hierarchy) - User requirement is maximum 3 levels

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
  
  hierarchy.forEach((level) => {
    // CRITICAL: Use the ALREADY SELECTED Record ID/Name as the PRIMARY source
    // Only show alternatives from the SAME level's headers
    const levelHeaders = [...level.headers];
    
    // Score and sort ID candidates (from level headers only)
    // Reuse getRecordIdScore for consistency
    const idCandidates = levelHeaders
      .map(h => ({ header: h, score: getRecordIdScore(h) }))
      .filter(c => c.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(c => c.header);
    
    // Score and sort Name candidates (from level headers only)
    // Reuse scoreHeaderForRecordName from findRecordIdAndName (no duplication)
    const nameCandidates = levelHeaders
      .map(h => ({ header: h, score: scoreHeaderForRecordName(h, level.recordId || '', []) }))
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
