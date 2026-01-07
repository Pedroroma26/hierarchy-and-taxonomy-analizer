import { AnalysisResult } from './analysisEngine';
import { HierarchyLevel } from '@/types';

export interface TaxonomyTreeNode {
  name: string;
  level: number;
  children: TaxonomyTreeNode[];
  productCount: number;
  taxonomyProperties?: string[]; // Properties used for each level (only on root)
}

export interface PropertyHierarchyMapping {
  propertyName: string;
  dataType: string;
  belongsToLevel: string; // 'Root', 'Level 1', 'Level 2', etc., or 'SKU-Level'
  isPicklist: boolean;
  picklistValues?: string[];
}

/**
 * Build a complete taxonomy tree from the data
 * Automatically excludes UOM and measurement-related fields
 */
export const buildTaxonomyTree = (
  hierarchy: HierarchyLevel[],
  data: any[][],
  headers: string[]
): TaxonomyTreeNode => {
  if (hierarchy.length === 0 || (hierarchy.length === 1 && hierarchy[0].headers.length === 0)) {
    return {
      name: 'Standalone Products',
      level: 0,
      children: [],
      productCount: data.length,
    };
  }

  // Auto-exclude measurement fields
  const MEASUREMENT_KEYWORDS = [
    'uom', 'unit', 'measure', 'measurement', 'dimension',
    'weight', 'height', 'width', 'depth', 'length', 'size',
    'zuc', 'zun', 'numerator', 'denominator',
    'date', 'time', 'created', 'modified', 'valid', 'expiry'
  ];

  const hierarchyHeaders = hierarchy.flatMap(h => h.headers);
  const filteredHierarchyHeaders = hierarchyHeaders.filter(header => {
    const headerLower = header.toLowerCase();
    return !MEASUREMENT_KEYWORDS.some(kw => headerLower.includes(kw));
  });

  // Helper: Check if value is text-based (prefer for taxonomy)
  const isTextBased = (value: any): boolean => {
    if (value === null || value === undefined || value === '') return false;
    const str = String(value);
    // Prefer values with letters, not just numbers
    return /[a-zA-Z]/.test(str) && str.length > 0;
  };

  // Helper: Count words in a value (prefer 1-2 words)
  const countWords = (value: any): number => {
    if (!value) return 0;
    const str = String(value).trim();
    return str.split(/\s+/).filter(w => w.length > 0).length;
  };

  // Helper: Score header for taxonomy tree (prefer SHORT names 1-2 words, not codes)
  const scoreHeaderForTaxonomy = (header: string, headerIndex: number): number => {
    let score = 0;
    const lower = header.toLowerCase();
    
    // Prefer name-like fields
    if (lower.includes('name') || lower.includes('description') || lower.includes('title')) score += 100;
    if (lower.includes('category') || lower.includes('sector') || lower.includes('division')) score += 80;
    if (lower.includes('brand') || lower.includes('type') || lower.includes('class')) score += 60;
    
    // Penalize code-like fields
    if (lower.includes('code') || lower.includes('id') || lower.includes('number')) score -= 50;
    if (/^[a-z]\d+$/i.test(header)) score -= 30; // L1, L2, etc.
    
    // Count text-based values
    const textCount = data.filter(row => isTextBased(row[headerIndex])).length;
    score += textCount / data.length * 50; // 0-50 points based on text ratio
    
    // CRITICAL: Prefer SHORT values (1-2 words)
    const avgWordCount = data.reduce((sum, row) => {
      const value = row[headerIndex];
      return sum + countWords(value);
    }, 0) / data.length;
    
    // Bonus for 1-2 word averages, penalty for long phrases
    if (avgWordCount <= 2) score += 100; // HUGE bonus for short names
    else if (avgWordCount <= 3) score += 50;
    else if (avgWordCount > 5) score -= 80; // Big penalty for long phrases
    
    return score;
  };

  // Sort headers to prioritize names/phrases for taxonomy tree
  const sortedHeaders = [...filteredHierarchyHeaders]
    .map(h => ({ header: h, score: scoreHeaderForTaxonomy(h, headers.indexOf(h)) }))
    .sort((a, b) => b.score - a.score)
    .map(item => item.header)
    .slice(0, 4); // MAX 4 levels for taxonomy tree

  if (filteredHierarchyHeaders.length === 0) {
    return {
      name: 'Root',
      level: 0,
      children: [],
      productCount: data.length,
      taxonomyProperties: [],
    };
  }

  const root: TaxonomyTreeNode = {
    name: 'Root',
    level: 0,
    children: [],
    productCount: data.length,
    taxonomyProperties: sortedHeaders, // Store which properties compose the taxonomy
  };

  // Build tree structure using sorted headers (text-based first)
  data.forEach((row) => {
    let currentNode = root;
    let skipRow = false; // Skip row if any level has missing data

    sortedHeaders.forEach((header, levelIndex) => {
      if (skipRow) return; // Skip rest of levels if already invalid
      
      const headerIndex = headers.indexOf(header);
      const value = row[headerIndex];
      
      // CRITICAL: Skip rows with missing/empty values - don't create "Unknown" branches
      if (value === null || value === undefined || value === '' || String(value).trim() === '') {
        skipRow = true;
        return;
      }
      
      const valueName = String(value).trim();
      
      // Also skip if value is literally "Unknown" or "unknown" (unless it's real data)
      const lowerValue = valueName.toLowerCase();
      if (lowerValue === 'unknown' || lowerValue === 'n/a' || lowerValue === 'null' || lowerValue === 'undefined') {
        skipRow = true;
        return;
      }

      // Find or create child node
      let childNode = currentNode.children.find(child => child.name === valueName);
      
      if (!childNode) {
        childNode = {
          name: valueName,
          level: levelIndex + 1,
          children: [],
          productCount: 0,
        };
        currentNode.children.push(childNode);
      }

      childNode.productCount++;
      currentNode = childNode;
    });
  });

  // Sort children by product count (descending)
  const sortTree = (node: TaxonomyTreeNode) => {
    node.children.sort((a, b) => b.productCount - a.productCount);
    node.children.forEach(sortTree);
  };
  sortTree(root);

  return root;
};

export interface CustomTaxonomyLevel {
  id: string;
  property: string;
}

export interface CustomTaxonomyConfig {
  levels: CustomTaxonomyLevel[];
}

/**
 * Build a custom taxonomy tree based on user configuration
 */
export const buildCustomTaxonomyTree = (
  config: CustomTaxonomyConfig,
  data: any[][],
  headers: string[]
): TaxonomyTreeNode => {
  if (config.levels.length === 0) {
    return {
      name: 'Root',
      level: 0,
      children: [],
      productCount: data.length,
    };
  }

  const root: TaxonomyTreeNode = {
    name: 'Root',
    level: 0,
    children: [],
    productCount: data.length,
  };

  // Build tree structure using custom configuration
  data.forEach((row) => {
    let currentNode = root;
    let skipRow = false;

    config.levels.forEach((levelConfig, levelIndex) => {
      if (skipRow) return;
      
      const headerIndex = headers.indexOf(levelConfig.property);
      if (headerIndex === -1) {
        skipRow = true;
        return;
      }
      
      const value = row[headerIndex];
      
      // Skip rows with missing/empty values
      if (value === null || value === undefined || value === '' || String(value).trim() === '') {
        skipRow = true;
        return;
      }
      
      const valueName = String(value).trim();
      
      // Skip common invalid values
      const lowerValue = valueName.toLowerCase();
      if (lowerValue === 'unknown' || lowerValue === 'n/a' || lowerValue === 'null' || lowerValue === 'undefined') {
        skipRow = true;
        return;
      }

      // Find or create child node
      let childNode = currentNode.children.find(child => child.name === valueName);
      
      if (!childNode) {
        childNode = {
          name: valueName,
          level: levelIndex + 1,
          children: [],
          productCount: 0,
        };
        currentNode.children.push(childNode);
      }

      childNode.productCount++;
      currentNode = childNode;
    });
  });

  // Sort children by product count (descending)
  const sortTree = (node: TaxonomyTreeNode) => {
    node.children.sort((a, b) => b.productCount - a.productCount);
    node.children.forEach(sortTree);
  };
  sortTree(root);

  return root;
};

/**
 * Convert taxonomy tree to ASCII art representation
 */
export const treeToAscii = (node: TaxonomyTreeNode, prefix: string = '', isLast: boolean = true): string => {
  let result = '';
  
  if (node.level > 0) {
    const connector = isLast ? '└── ' : '├── ';
    result += prefix + connector + `${node.name} (${node.productCount} products)\n`;
  } else if (node.name !== 'Root') {
    result += `${node.name} (${node.productCount} products)\n`;
  }

  const childPrefix = node.level > 0 ? prefix + (isLast ? '    ' : '│   ') : '';
  
  node.children.forEach((child, index) => {
    const isLastChild = index === node.children.length - 1;
    result += treeToAscii(child, childPrefix, isLastChild);
  });

  return result;
};

/**
 * Map properties to their hierarchy levels
 */
export const mapPropertiesToHierarchy = (
  analysisResult: AnalysisResult,
  headers: string[]
): PropertyHierarchyMapping[] => {
  const { hierarchy, properties, propertyRecommendations } = analysisResult;
  const mappings: PropertyHierarchyMapping[] = [];

  // Get hierarchy headers
  const hierarchyHeaders = hierarchy.flatMap(h => h.headers);

  // Map hierarchy properties to their levels
  hierarchy.forEach((level, index) => {
    level.headers.forEach(header => {
      const recommendation = propertyRecommendations.find(r => r.header === header);
      mappings.push({
        propertyName: header,
        dataType: recommendation?.dataType || 'string',
        belongsToLevel: index === 0 ? 'Root Level' : `Level ${index}`,
        isPicklist: recommendation?.isPicklist || false,
        picklistValues: recommendation?.picklistValues,
      });
    });
  });

  // Map SKU-level properties
  properties.forEach(prop => {
    const recommendation = propertyRecommendations.find(r => r.header === prop);
    mappings.push({
      propertyName: prop,
      dataType: recommendation?.dataType || 'string',
      belongsToLevel: 'SKU-Level (Product Variant)',
      isPicklist: recommendation?.isPicklist || false,
      picklistValues: recommendation?.picklistValues,
    });
  });

  return mappings;
};

/**
 * Generate a comprehensive export report
 */
export const generateExportReport = (
  analysisResult: AnalysisResult,
  headers: string[],
  data: any[][]
): any => {
  const taxonomyTree = buildTaxonomyTree(analysisResult.hierarchy, data, headers);
  const propertyMappings = mapPropertiesToHierarchy(analysisResult, headers);

  // Core: Property to Hierarchy Mapping
  const hierarchyProperties = analysisResult.hierarchy.flatMap(h => h.headers);
  const skuProperties = analysisResult.properties;
  const taxonomyProperties = analysisResult.hierarchy.length > 0 
    ? analysisResult.hierarchy[0].headers 
    : [];

  return {
    report_metadata: {
      generated_at: new Date().toISOString(),
      total_products: data.length,
      total_attributes_analyzed: headers.length,
      analysis_confidence: (analysisResult.hierarchyConfidence * 100).toFixed(1) + '%',
    },

    product_domain: {
      detected_type: analysisResult.productDomain.type,
      confidence: (analysisResult.productDomain.confidence * 100).toFixed(1) + '%',
      indicators: analysisResult.productDomain.indicators,
    },

    // CORE: Product Identification
    product_identification: {
      record_id: analysisResult.recordIdSuggestion || 'NOT_DETECTED',
      record_name: analysisResult.recordNameSuggestion || 'NOT_DETECTED',
      status: {
        has_record_id: !!analysisResult.recordIdSuggestion,
        has_record_name: !!analysisResult.recordNameSuggestion,
      }
    },

    hierarchy_structure: {
      model_type: analysisResult.hierarchy.length === 0 || 
                   (analysisResult.hierarchy.length === 1 && analysisResult.hierarchy[0].headers.length === 0)
                   ? 'Standalone'
                   : 'Hierarchical',
      total_levels: analysisResult.hierarchy.filter(h => h.headers.length > 0).length,
      levels: analysisResult.hierarchy.map((level, index) => ({
        level_number: index + 1,
        level_name: level.name,
        properties: level.headers,
        property_count: level.headers.length,
      })),
    },

    mixed_model_analysis: (analysisResult as any).mixedModelSuggestion ? {
      should_use_mixed: (analysisResult as any).mixedModelSuggestion.shouldUseMixed,
      reasoning: (analysisResult as any).mixedModelSuggestion.reasoning,
      hierarchical_products_percentage: (analysisResult as any).mixedModelSuggestion.hierarchicalPercentage.toFixed(1) + '%',
      standalone_products_percentage: (analysisResult as any).mixedModelSuggestion.standalonePercentage.toFixed(1) + '%',
    } : {
      should_use_mixed: false,
      reasoning: 'Mixed model analysis not available',
      hierarchical_products_percentage: '100%',
      standalone_products_percentage: '0%',
    },

    taxonomy_tree: {
      description: 'Complete product taxonomy tree showing all category paths',
      tree_structure: taxonomyTree,
      ascii_representation: treeToAscii(taxonomyTree),
    },

    alternative_hierarchies: analysisResult.alternativeHierarchies.map(alt => ({
      name: alt.name,
      model_type: alt.modelType,
      confidence: (alt.confidence * 100).toFixed(1) + '%',
      reasoning: alt.reasoning,
      levels: alt.hierarchy.length,
      hierarchy_structure: alt.hierarchy.map(h => ({
        level: h.level,
        name: h.name,
        properties: h.headers,
      })),
      sku_properties: alt.properties,
    })),

    // CORE: Property to Hierarchy Exclusive Mapping
    property_to_hierarchy_mapping: {
      summary: {
        total_properties: propertyMappings.length,
        hierarchy_properties: hierarchyProperties.length,
        sku_properties: skuProperties.length,
        taxonomy_properties: taxonomyProperties.length,
      },
      taxonomy_properties: {
        description: 'Properties at the HIGHEST hierarchy level - used for product categorization',
        properties: taxonomyProperties.map(prop => ({
          name: prop,
          data_type: analysisResult.propertyRecommendations.find(r => r.header === prop)?.dataType || 'string',
          is_picklist: analysisResult.propertyRecommendations.find(r => r.header === prop)?.isPicklist || false,
        })),
      },
      by_hierarchy_level: propertyMappings.reduce((acc, prop) => {
        if (!acc[prop.belongsToLevel]) {
          acc[prop.belongsToLevel] = [];
        }
        acc[prop.belongsToLevel].push({
          name: prop.propertyName,
          data_type: prop.dataType,
          is_picklist: prop.isPicklist,
          picklist_values: prop.picklistValues,
          is_taxonomy: taxonomyProperties.includes(prop.propertyName),
        });
        return acc;
      }, {} as Record<string, any[]>),
      detailed_list: propertyMappings.map(prop => ({
        property_name: prop.propertyName,
        data_type: prop.dataType,
        hierarchy_level: prop.belongsToLevel,
        is_picklist: prop.isPicklist,
        is_taxonomy: taxonomyProperties.includes(prop.propertyName),
        picklist_values: prop.picklistValues,
        recommendation: analysisResult.propertyRecommendations.find(r => r.header === prop.propertyName),
      })),
    },

    // CORE: Best Practices & Recommendations
    best_practices_recommendations: {
      uom_split_recommendations: analysisResult.uomSuggestions
        .filter(uom => uom.suggestedSplit)
        .map(uom => ({
          property: uom.header,
          current_format: 'Value with embedded UOM (e.g., "12g")',
          recommended_format: {
            value_property: uom.header,
            uom_property: `${uom.header} UOM`,
            example_value: 'Numeric value only',
            example_uom: uom.detectedUom,
          },
          detected_uom: uom.detectedUom,
          available_conversions: uom.suggestedConversions,
          impact: 'Improves data consistency, enables proper filtering, follows Salsify best practices',
        })),
      critical_issues: [
        ...(!analysisResult.recordIdSuggestion ? [{
          type: 'missing_record_id',
          severity: 'CRITICAL',
          message: 'No unique Record ID detected',
          impact: 'Products cannot be imported or managed in Salsify',
          action_required: 'Add a column with unique identifiers for each product',
        }] : []),
        ...(!analysisResult.recordNameSuggestion ? [{
          type: 'missing_record_name',
          severity: 'IMPORTANT',
          message: 'No Record Name detected',
          impact: 'Makes product management and search difficult',
          action_required: 'Add a "Product Name" or "Title" column',
        }] : []),
        ...(analysisResult.orphanedRecords.length > 0 ? [{
          type: 'orphaned_products',
          severity: 'IMPORTANT',
          message: `${analysisResult.orphanedRecords.length} products with hierarchy issues`,
          impact: 'These products cannot be properly categorized',
          action_required: 'Review and fix hierarchy values or treat as standalone',
          affected_rows: analysisResult.orphanedRecords.slice(0, 10).map(r => r.rowIndex),
        }] : []),
      ],
      picklist_opportunities: analysisResult.propertyRecommendations
        .filter(r => r.isPicklist && r.picklistValues && r.picklistValues.length <= 20)
        .map(prop => ({
          property: prop.header,
          unique_values: prop.picklistValues?.length || 0,
          sample_values: prop.picklistValues?.slice(0, 5) || [],
          recommendation: 'Convert to picklist to reduce data entry errors',
        })),
    },

    record_id_and_name: {
      suggested_record_id: analysisResult.recordIdSuggestion,
      suggested_record_name: analysisResult.recordNameSuggestion,
    },

    data_quality: {
      orphaned_records: {
        count: analysisResult.orphanedRecords.length,
        percentage: ((analysisResult.orphanedRecords.length / data.length) * 100).toFixed(1) + '%',
        details: analysisResult.orphanedRecords.slice(0, 10).map(record => ({
          row_index: record.rowIndex,
          issues: record.issues,
          severity: record.severity,
        })),
      },
    },

    uom_suggestions: analysisResult.uomSuggestions.map(uom => ({
      property: uom.header,
      detected_uom: uom.detectedUom,
      should_split: uom.suggestedSplit,
      conversion_suggestions: uom.suggestedConversions,
    })),

    analysis_thresholds: {
      parent_level_threshold: (analysisResult.thresholds.parent * 100).toFixed(1) + '%',
      children_min_threshold: (analysisResult.thresholds.childrenMin * 100).toFixed(0) + '%',
      children_max_threshold: (analysisResult.thresholds.childrenMax * 100).toFixed(0) + '%',
      sku_level_threshold: (analysisResult.thresholds.sku * 100).toFixed(0) + '%',
      description: '4-level cardinality thresholds: Parent (≤2%), Children (50-75%), SKU (≥98%)',
    },
  };
};
