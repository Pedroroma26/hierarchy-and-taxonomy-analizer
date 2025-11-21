import { CardinalityScore } from '@/components/CardinalityAnalysis';
import { HierarchyLevel } from '@/components/HierarchyProposal';
import { TaxonomyPath } from '@/components/TaxonomyResults';

export interface AnalysisResult {
  cardinalityScores: CardinalityScore[];
  hierarchy: HierarchyLevel[];
  properties: string[];
  taxonomyPaths: TaxonomyPath[];
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

  return {
    cardinalityScores,
    hierarchy,
    properties,
    taxonomyPaths,
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
