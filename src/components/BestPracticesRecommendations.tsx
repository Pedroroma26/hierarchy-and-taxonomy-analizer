import { useState } from 'react';
import { motion } from 'framer-motion';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { 
  Lightbulb, 
  CheckCircle2, 
  AlertTriangle, 
  TrendingUp,
  Split,
  Database,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { AnalysisResult } from '@/utils/analysisEngine';
import { TaxonomyTreeNode } from '@/utils/exportReport';
import { ScrollArea } from './ui/scroll-area';

interface BestPracticesRecommendationsProps {
  analysisResult: AnalysisResult;
  taxonomyTree?: TaxonomyTreeNode;
}

interface Recommendation {
  type: 'critical' | 'important' | 'suggestion';
  category: 'uom' | 'data_quality' | 'structure' | 'taxonomy';
  title: string;
  description: string;
  impact: string;
  examples?: string[];
}

export const BestPracticesRecommendations = ({ 
  analysisResult,
  taxonomyTree
}: BestPracticesRecommendationsProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const recommendations: Recommendation[] = [];

  // 1. UOM Split Recommendations
  if (analysisResult.uomSuggestions.length > 0) {
    analysisResult.uomSuggestions.forEach(uom => {
      if (uom.suggestedSplit) {
        recommendations.push({
          type: 'important',
          category: 'uom',
          title: `Split "${uom.header}" into Value + Unit`,
          description: `Field contains mixed value and unit (e.g., "12g"). Split into two separate properties.`,
          impact: 'Enables filtering, calculations, and unit conversions.',
          examples: [
            `Current: "${uom.header}" contains "12g"`,
            `Action: Create "${uom.header}" = "12" and "${uom.header} UOM" = "g"`
          ]
        });
      }
    });
  }

  // 2. Taxonomy Compliance Check - Use ACTUAL taxonomy tree properties
  const taxonomyProperties = taxonomyTree?.taxonomyProperties || [];
  const level1Headers = analysisResult.hierarchy.length > 0 ? analysisResult.hierarchy[0].headers : [];
  
  // Check which taxonomy properties are at Level 1 vs lower levels
  const taxonomyAtTopLevel = taxonomyProperties.filter(prop => level1Headers.includes(prop));
  const taxonomyInWrongLevel = taxonomyProperties.filter(prop => !level1Headers.includes(prop));
  
  // ALWAYS SHOW if taxonomy properties exist - with green/red indicators
  if (taxonomyProperties.length > 0) {
    const hasErrors = taxonomyInWrongLevel.length > 0;
    recommendations.push({
      type: hasErrors ? 'critical' : 'suggestion',
      category: 'taxonomy',
      title: hasErrors 
        ? `Taxonomy: ${taxonomyInWrongLevel.length} Incorrect, ${taxonomyAtTopLevel.length} Correct`
        : `Taxonomy: ${taxonomyAtTopLevel.length} Properties Correctly Positioned`,
      description: hasErrors
        ? `Some taxonomy properties in wrong hierarchy level. Should be at Level 1.`
        : `All taxonomy properties correctly placed at top hierarchy level.`,
      impact: hasErrors
        ? 'Move incorrect properties to Level 1 for proper categorization.'
        : 'Taxonomy structure is correct. Enables proper filtering and navigation.',
      examples: [
        ...(taxonomyAtTopLevel.length > 0 
          ? taxonomyAtTopLevel.map(prop => `✅ ${prop} (Level 1)`)
          : []
        ),
        ...(taxonomyInWrongLevel.length > 0 
          ? taxonomyInWrongLevel.map(prop => `❌ ${prop} → Move to Level 1`)
          : []
        )
      ]
    });
  }

  // 3. Record ID & Name
  if (!analysisResult.recordIdSuggestion) {
    recommendations.push({
      type: 'critical',
      category: 'structure',
      title: 'Missing Unique Identifier (Record ID)',
      description: 'No unique identifier column found. Required for Salsify import.',
      impact: 'Cannot import products without unique IDs.',
      examples: [
        'Action: Add SKU, Product Code, or Item Number column',
        'Requirement: Values must be 100% unique'
      ]
    });
  }

  if (!analysisResult.recordNameSuggestion) {
    recommendations.push({
      type: 'important',
      category: 'structure',
      title: 'Missing Product Name (Record Name)',
      description: 'No product name/title column found.',
      impact: 'Difficult to identify products in Salsify interface.',
      examples: [
        'Action: Add "Product Name" or "Title" column',
        'Example: "Men\'s Cotton T-Shirt Blue Large"'
      ]
    });
  }

  // 4. Orphaned Records - Products with Missing Data
  if (analysisResult.orphanedRecords.length > 0) {
    const totalProducts = analysisResult.cardinalityScores[0]?.totalCount || analysisResult.orphanedRecords.length;
    const percentage = ((analysisResult.orphanedRecords.length / totalProducts) * 100).toFixed(1);
    const completeProducts = totalProducts - analysisResult.orphanedRecords.length;
    
    recommendations.push({
      type: 'important',
      category: 'data_quality',
      title: `${analysisResult.orphanedRecords.length} of ${totalProducts} Products Have Missing Data`,
      description: `${percentage}% incomplete. Missing data.`,
      impact: `${completeProducts} products OK. ${analysisResult.orphanedRecords.length} need data completion.`,
      examples: [
        ...analysisResult.orphanedRecords.slice(0, 3).map(record => {
          const missingFields = record.issues
            .filter(issue => issue.includes('Missing value'))
            .map(issue => issue.replace('Missing value for hierarchy field: ', ''))
            .join(', ');
          return `Row ${record.rowIndex + 1}: Missing → ${missingFields || 'Incomplete hierarchy'}`;
        })
      ]
    });
  }

  // 5. Property Exclusivity
  const allProperties = [
    ...analysisResult.hierarchy.flatMap(h => h.headers),
    ...analysisResult.properties
  ];
  const uniqueProperties = new Set(allProperties);
  
  if (allProperties.length !== uniqueProperties.size) {
    recommendations.push({
      type: 'critical',
      category: 'structure',
      title: 'Duplicate Properties in Multiple Levels',
      description: 'Same property appears in multiple hierarchy levels.',
      impact: 'Data conflicts - each property must exist in only ONE level.',
      examples: ['Action: Review hierarchy structure', 'Rule: One property = One level only']
    });
  }

  // 6. Picklist Opportunities
  const picklistProperties = analysisResult.propertyRecommendations.filter(
    r => r.isPicklist && r.picklistValues && r.picklistValues.length <= 20
  );
  
  if (picklistProperties.length > 0) {
    recommendations.push({
      type: 'suggestion',
      category: 'data_quality',
      title: `${picklistProperties.length} Properties → Convert to Picklist`,
      description: 'Fields with limited repeating values. Use dropdowns instead of free text.',
      impact: 'Prevents typos, standardizes values, easier filtering.',
      examples: picklistProperties.slice(0, 3).map(prop => 
        `${prop.header}: ${prop.picklistValues!.length} values (${prop.picklistValues!.slice(0, 3).join(', ')}...)`
      )
    });
  }

  // 7. Mixed Model Suggestion
  if ((analysisResult as any).mixedModelSuggestion?.shouldUseMixed) {
    const mixed = (analysisResult as any).mixedModelSuggestion;
    recommendations.push({
      type: 'important',
      category: 'structure',
      title: 'Consider Mixed Model Structure',
      description: 'Dataset contains both hierarchical and standalone products.',
      impact: 'Some products fit parent-child, others work better standalone.',
      examples: [
        `${mixed.hierarchicalPercentage.toFixed(1)}% → Use Parent-Variant structure`,
        `${mixed.standalonePercentage.toFixed(1)}% → Keep as Standalone (Flat Model)`
      ]
    });
  }

  const getIcon = (type: string) => {
    switch (type) {
      case 'critical':
        return <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />;
      case 'important':
        return <TrendingUp className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />;
      default:
        return <Lightbulb className="w-5 h-5 text-blue-600 dark:text-blue-400" />;
    }
  };

  const getColor = (type: string) => {
    switch (type) {
      case 'critical':
        return 'border-red-500/50 bg-red-50/50 dark:bg-red-950/20';
      case 'important':
        return 'border-yellow-500/50 bg-yellow-50/50 dark:bg-yellow-950/20';
      default:
        return 'border-blue-500/50 bg-blue-50/50 dark:bg-blue-950/20';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'uom':
        return <Split className="w-4 h-4" />;
      case 'taxonomy':
        return <Database className="w-4 h-4" />;
      default:
        return <CheckCircle2 className="w-4 h-4" />;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.35 }}
    >
      <Card className="p-6 shadow-elevated">
        <div className="space-y-6">
          {/* Header */}
          <div 
            className="cursor-pointer"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <div className="flex items-center gap-3 mb-2">
              {isExpanded ? <ChevronDown className="w-6 h-6" /> : <ChevronRight className="w-6 h-6" />}
              <Lightbulb className="w-6 h-6 text-primary" />
              <h2 className="text-2xl font-semibold">Best Practices & Recommendations</h2>
            </div>
            <p className="text-muted-foreground">
              Critical insights for Salsify implementation and client discussions
            </p>
          </div>

          {isExpanded && (
          <>

          {/* Summary Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-red-100 dark:bg-red-950/30">
              <div className="text-sm text-red-800 dark:text-red-200 mb-1">Critical</div>
              <div className="text-2xl font-bold text-red-900 dark:text-red-100">
                {recommendations.filter(r => r.type === 'critical').length}
              </div>
            </div>
            <div className="p-4 rounded-lg bg-yellow-100 dark:bg-yellow-950/30">
              <div className="text-sm text-yellow-800 dark:text-yellow-200 mb-1">Important</div>
              <div className="text-2xl font-bold text-yellow-900 dark:text-yellow-100">
                {recommendations.filter(r => r.type === 'important').length}
              </div>
            </div>
            <div className="p-4 rounded-lg bg-blue-100 dark:bg-blue-950/30">
              <div className="text-sm text-blue-800 dark:text-blue-200 mb-1">Suggestions</div>
              <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                {recommendations.filter(r => r.type === 'suggestion').length}
              </div>
            </div>
          </div>

          {/* Recommendations List */}
          <ScrollArea className="h-[600px]">
            <div className="space-y-4 pr-4">
              {recommendations.map((rec, index) => (
                <Alert key={index} className={getColor(rec.type)}>
                  <div className="flex items-start gap-3">
                    {getIcon(rec.type)}
                    <div className="flex-1">
                      <AlertTitle className="flex items-center gap-2 mb-2">
                        {getCategoryIcon(rec.category)}
                        {rec.title}
                        <Badge variant="outline" className="text-xs ml-auto">
                          {rec.category.replace('_', ' ').toUpperCase()}
                        </Badge>
                      </AlertTitle>
                      <AlertDescription className="space-y-3">
                        <p className="text-sm">{rec.description}</p>
                        
                        <div className="p-3 rounded-lg bg-background/50 border">
                          <div className="text-xs font-semibold mb-1">Impact:</div>
                          <div className="text-sm">{rec.impact}</div>
                        </div>

                        {rec.examples && rec.examples.length > 0 && (
                          <div>
                            <div className="text-xs font-semibold mb-2">Examples / Actions:</div>
                            <div className="space-y-1">
                              {rec.examples.map((example, idx) => (
                                <div key={idx} className="text-sm font-mono bg-background/50 p-2 rounded border text-xs">
                                  {example}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </AlertDescription>
                    </div>
                  </div>
                </Alert>
              ))}

              {recommendations.length === 0 && (
                <Alert className="border-green-500/50 bg-green-50/50 dark:bg-green-950/20">
                  <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                  <AlertTitle>Excellent Data Quality!</AlertTitle>
                  <AlertDescription>
                    No critical issues detected. Your data follows Salsify best practices.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </ScrollArea>
          </>
          )}
        </div>
      </Card>
    </motion.div>
  );
};
