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
import { ScrollArea } from './ui/scroll-area';

interface BestPracticesRecommendationsProps {
  analysisResult: AnalysisResult;
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
  analysisResult 
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
          title: `Split UOM in "${uom.header}"`,
          description: `This field contains embedded unit of measure. Best practice is to separate value and UOM into two properties.`,
          impact: 'Improves data consistency, enables proper filtering, and follows Salsify best practices.',
          examples: [
            `Current: "${uom.header}" = "12g"`,
            `Recommended: "${uom.header}" = "12" + "${uom.header} UOM" = "g"`,
            ...(uom.suggestedConversions ? [`Conversions available: ${uom.suggestedConversions.join(', ')}`] : [])
          ]
        });
      }
    });
  }

  // 2. Taxonomy at Highest Level
  const taxonomyProperties = analysisResult.hierarchy.length > 0 
    ? analysisResult.hierarchy[0].headers 
    : [];
  
  if (taxonomyProperties.length > 0) {
    recommendations.push({
      type: 'critical',
      category: 'taxonomy',
      title: 'Taxonomy Properties Identified',
      description: `${taxonomyProperties.length} properties identified as taxonomy (categorization). These MUST be at the highest hierarchy level.`,
      impact: 'Ensures proper product categorization and navigation structure in Salsify.',
      examples: taxonomyProperties.map(prop => `✓ ${prop} (Taxonomy property)`)
    });
  }

  // 3. Record ID & Name
  if (!analysisResult.recordIdSuggestion) {
    recommendations.push({
      type: 'critical',
      category: 'structure',
      title: 'No Record ID Detected',
      description: 'Could not identify a unique identifier field. Every product MUST have a unique Record ID.',
      impact: 'Without Record ID, products cannot be properly imported or managed in Salsify.',
      examples: [
        'Add a column with unique identifiers (SKU, Product Code, etc.)',
        'Ensure values are 100% unique across all products'
      ]
    });
  }

  if (!analysisResult.recordNameSuggestion) {
    recommendations.push({
      type: 'important',
      category: 'structure',
      title: 'No Record Name Detected',
      description: 'Could not identify a product name field. Record Name is essential for product identification.',
      impact: 'Makes product management and search difficult in Salsify.',
      examples: [
        'Add a "Product Name" or "Title" column',
        'Should be human-readable and descriptive'
      ]
    });
  }

  // 4. Orphaned Records
  if (analysisResult.orphanedRecords.length > 0) {
    const percentage = ((analysisResult.orphanedRecords.length / analysisResult.cardinalityScores[0]?.totalCount || 1) * 100).toFixed(1);
    recommendations.push({
      type: 'important',
      category: 'data_quality',
      title: `${analysisResult.orphanedRecords.length} Products with Hierarchy Issues`,
      description: `${percentage}% of products have missing or inconsistent hierarchy values.`,
      impact: 'These products cannot be properly categorized and may need to be treated as standalone.',
      examples: analysisResult.orphanedRecords.slice(0, 3).map(record => 
        `Row ${record.rowIndex + 1}: ${record.issues.join(', ')}`
      )
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
      title: 'Duplicate Properties Across Levels',
      description: 'Some properties appear in multiple hierarchy levels. Properties must be EXCLUSIVE to one level.',
      impact: 'Causes data conflicts and incorrect product structure in Salsify.',
      examples: ['Review property allocation', 'Ensure each property belongs to only ONE hierarchy level']
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
      title: `${picklistProperties.length} Properties Should Be Picklists`,
      description: 'These properties have limited, repeating values. Converting to picklists improves data consistency.',
      impact: 'Reduces data entry errors and ensures standardized values.',
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
      title: 'Mixed Model Recommended',
      description: mixed.reasoning,
      impact: 'Some products fit hierarchical structure, others should be standalone.',
      examples: [
        `${mixed.hierarchicalPercentage.toFixed(1)}% products: Use hierarchy`,
        `${mixed.standalonePercentage.toFixed(1)}% products: Treat as standalone`
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
