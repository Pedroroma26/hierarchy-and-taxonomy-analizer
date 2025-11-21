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

export interface AnalysisResult {
  cardinalityScores: CardinalityScore[];
  hierarchy: HierarchyLevel[];
  properties: string[];
  taxonomyPaths: TaxonomyPath[];
  recordIdSuggestion: string | null;
  recordNameSuggestion: string | null;
  propertyRecommendations: PropertyRecommendation[];
  uomSuggestions: UomSuggestion[];
}

// Thresholds for classification
const LOW_CARDINALITY_THRESHOLD = 0.1; // High repetition (10% unique)
const MEDIUM_CARDINALITY_THRESHOLD = 0.5; // Medium repetition (50% unique)

export const analyzeProductData = (
  headers: string[],
  data: any[][]
): AnalysisResult => {
  // Calculate cardinality scores
  const cardinalityScores = calculateCardinalityScores(headers, data);

  // Determine hierarchy based on cardinality
  const { hierarchy, properties } = determineHierarchy(cardinalityScores, headers);

  // Generate taxonomy paths
  const taxonomyPaths = generateTaxonomyPaths(hierarchy, data, headers);

  // Suggest Record ID and Name
  const recordIdSuggestion = suggestRecordId(headers, data);
  const recordNameSuggestion = suggestRecordName(headers, data);

  // Analyze property data types and picklists
  const propertyRecommendations = analyzePropertyTypes(headers, data, cardinalityScores);

  // Detect UOM patterns and suggest conversions
  const uomSuggestions = analyzeUomPatterns(headers, data);

  return {
    cardinalityScores,
    hierarchy,
    properties,
    taxonomyPaths,
    recordIdSuggestion,
    recordNameSuggestion,
    propertyRecommendations,
    uomSuggestions,
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

const determineHierarchy = (
  cardinalityScores: CardinalityScore[],
  headers: string[]
): { hierarchy: HierarchyLevel[]; properties: string[] } => {
  // Sort by cardinality (low to high)
  const sortedScores = [...cardinalityScores].sort(
    (a, b) => a.cardinality - b.cardinality
  );

  const hierarchy: HierarchyLevel[] = [];
  const properties: string[] = [];

  // Determine hierarchy levels
  const lowCardinalityHeaders = sortedScores
    .filter((score) => score.classification === 'low')
    .map((score) => score.header);

  const mediumCardinalityHeaders = sortedScores
    .filter((score) => score.classification === 'medium')
    .map((score) => score.header);

  const highCardinalityHeaders = sortedScores
    .filter((score) => score.classification === 'high')
    .map((score) => score.header);

  // Build hierarchy
  if (lowCardinalityHeaders.length > 0) {
    hierarchy.push({
      level: 1,
      name: 'Parent Level',
      headers: lowCardinalityHeaders.slice(0, 2), // Top 2 most repetitive
    });
  }

  if (lowCardinalityHeaders.length > 2 || mediumCardinalityHeaders.length > 0) {
    const childHeaders = [
      ...lowCardinalityHeaders.slice(2),
      ...mediumCardinalityHeaders.slice(0, 2),
    ];
    if (childHeaders.length > 0) {
      hierarchy.push({
        level: 2,
        name: 'Child Level',
        headers: childHeaders,
      });
    }
  }

  if (mediumCardinalityHeaders.length > 2) {
    hierarchy.push({
      level: 3,
      name: 'Grandchild Level',
      headers: mediumCardinalityHeaders.slice(2, 4),
    });
  }

  // All high cardinality headers become properties
  properties.push(...highCardinalityHeaders);

  // If no clear hierarchy, create a flat model
  if (hierarchy.length === 0) {
    hierarchy.push({
      level: 1,
      name: 'Flat Model',
      headers: headers.slice(0, 3),
    });
    properties.push(...headers.slice(3));
  }

  return { hierarchy, properties };
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
