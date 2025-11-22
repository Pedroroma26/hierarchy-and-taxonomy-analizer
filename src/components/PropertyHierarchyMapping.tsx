import { motion } from 'framer-motion';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Layers, Box, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { AnalysisResult } from '@/utils/analysisEngine';
import { ScrollArea } from './ui/scroll-area';

interface PropertyHierarchyMappingProps {
  analysisResult: AnalysisResult;
}

export const PropertyHierarchyMapping = ({ analysisResult }: PropertyHierarchyMappingProps) => {
  // Get all properties mapped to hierarchy levels
  const hierarchyProperties = analysisResult.hierarchy.flatMap(h => h.headers);
  const skuProperties = analysisResult.properties;
  
  // Identify taxonomy properties (highest level)
  const taxonomyProperties = analysisResult.hierarchy.length > 0 
    ? analysisResult.hierarchy[0].headers 
    : [];

  // Get property type recommendations
  const getPropertyType = (propName: string) => {
    const recommendation = analysisResult.propertyRecommendations.find(
      r => r.header === propName
    );
    return recommendation?.dataType || 'string';
  };

  const getPropertyConfidence = (propName: string) => {
    const recommendation = analysisResult.propertyRecommendations.find(
      r => r.header === propName
    );
    return recommendation?.confidence || 0;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.25 }}
    >
      <Card className="p-6 shadow-elevated">
        <div className="space-y-6">
          {/* Header */}
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Layers className="w-6 h-6 text-primary" />
              <h2 className="text-2xl font-semibold">Property-to-Hierarchy Mapping</h2>
            </div>
            <p className="text-muted-foreground">
              Exclusive property allocation per hierarchy level - Core for Salsify implementation
            </p>
          </div>

          {/* Key Information Alert */}
          <Alert className="border-blue-500/50 bg-blue-50/50 dark:bg-blue-950/20">
            <Info className="w-4 h-4" />
            <AlertTitle>Core Implementation Rules</AlertTitle>
            <AlertDescription>
              <ul className="list-disc list-inside space-y-1 text-sm mt-2">
                <li><strong>Properties are EXCLUSIVE</strong> to their hierarchy level</li>
                <li><strong>Taxonomy properties</strong> belong to the highest hierarchy level</li>
                <li><strong>Record ID & Name</strong> are identified for product identification</li>
                <li><strong>SKU-level properties</strong> are variant-specific attributes</li>
              </ul>
            </AlertDescription>
          </Alert>

          {/* Record ID & Name */}
          <div className="p-4 rounded-lg bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-primary" />
              Product Identification
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-muted-foreground mb-1">Record ID</div>
                <Badge variant="default" className="text-sm">
                  {analysisResult.recordIdSuggestion || 'Not detected'}
                </Badge>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">Record Name</div>
                <Badge variant="default" className="text-sm">
                  {analysisResult.recordNameSuggestion || 'Not detected'}
                </Badge>
              </div>
            </div>
          </div>

          {/* Hierarchy Levels with Properties */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Hierarchy Structure & Properties</h3>
            
            {analysisResult.hierarchy.map((level, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="border rounded-lg p-4 bg-muted/30"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="font-bold text-primary">{level.level}</span>
                    </div>
                    <div>
                      <h4 className="font-semibold">{level.name}</h4>
                      <p className="text-sm text-muted-foreground">
                        {level.headers.length} {level.headers.length === 1 ? 'property' : 'properties'}
                        {index === 0 && taxonomyProperties.length > 0 && (
                          <span className="ml-2 text-primary font-medium">
                            (Taxonomy Level)
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline">
                    Level {level.level}
                  </Badge>
                </div>

                <ScrollArea className="max-h-[200px]">
                  <div className="space-y-2">
                    {level.headers.map(header => {
                      const dataType = getPropertyType(header);
                      const confidence = getPropertyConfidence(header);
                      const isTaxonomy = taxonomyProperties.includes(header);

                      return (
                        <div
                          key={header}
                          className="flex items-center justify-between p-2 rounded bg-background/50 hover:bg-background transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            {isTaxonomy && (
                              <Badge variant="default" className="text-xs bg-primary">
                                Taxonomy
                              </Badge>
                            )}
                            <span className="font-medium text-sm">{header}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-xs">
                              {dataType}
                            </Badge>
                            <Badge 
                              variant="outline" 
                              className={`text-xs ${
                                confidence >= 0.8 ? 'border-green-500 text-green-700 dark:text-green-400' :
                                confidence >= 0.6 ? 'border-yellow-500 text-yellow-700 dark:text-yellow-400' :
                                'border-orange-500 text-orange-700 dark:text-orange-400'
                              }`}
                            >
                              {(confidence * 100).toFixed(0)}%
                            </Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </motion.div>
            ))}

            {/* SKU-Level Properties */}
            {skuProperties.length > 0 && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: analysisResult.hierarchy.length * 0.1 }}
                className="border rounded-lg p-4 bg-secondary/10"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-secondary/20 flex items-center justify-center">
                      <Box className="w-5 h-5 text-secondary" />
                    </div>
                    <div>
                      <h4 className="font-semibold">SKU-Level Properties</h4>
                      <p className="text-sm text-muted-foreground">
                        {skuProperties.length} variant-specific {skuProperties.length === 1 ? 'property' : 'properties'}
                      </p>
                    </div>
                  </div>
                  <Badge variant="secondary">
                    Product Variant
                  </Badge>
                </div>

                <ScrollArea className="max-h-[300px]">
                  <div className="space-y-2">
                    {skuProperties.map(header => {
                      const dataType = getPropertyType(header);
                      const confidence = getPropertyConfidence(header);

                      return (
                        <div
                          key={header}
                          className="flex items-center justify-between p-2 rounded bg-background/50 hover:bg-background transition-colors"
                        >
                          <span className="font-medium text-sm">{header}</span>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-xs">
                              {dataType}
                            </Badge>
                            <Badge 
                              variant="outline" 
                              className={`text-xs ${
                                confidence >= 0.8 ? 'border-green-500 text-green-700 dark:text-green-400' :
                                confidence >= 0.6 ? 'border-yellow-500 text-yellow-700 dark:text-yellow-400' :
                                'border-orange-500 text-orange-700 dark:text-orange-400'
                              }`}
                            >
                              {(confidence * 100).toFixed(0)}%
                            </Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </motion.div>
            )}
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-3 gap-4 pt-4 border-t">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">
                {hierarchyProperties.length}
              </div>
              <div className="text-sm text-muted-foreground">Hierarchy Properties</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-secondary">
                {skuProperties.length}
              </div>
              <div className="text-sm text-muted-foreground">SKU Properties</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">
                {taxonomyProperties.length}
              </div>
              <div className="text-sm text-muted-foreground">Taxonomy Properties</div>
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
};
