import { useState } from 'react';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  FileText, 
  Hash, 
  Globe, 
  Image, 
  List, 
  CheckCircle, 
  AlertCircle,
  Ruler,
  ArrowRight,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { PropertyRecommendation, UomSuggestion } from '@/utils/analysisEngine';

interface PropertyRecommendationsProps {
  recordIdSuggestion: string | null;
  recordNameSuggestion: string | null;
  propertyRecommendations: PropertyRecommendation[];
  uomSuggestions: UomSuggestion[];
}

export const PropertyRecommendations = ({
  recordIdSuggestion,
  recordNameSuggestion,
  propertyRecommendations,
  uomSuggestions,
}: PropertyRecommendationsProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const getDataTypeIcon = (type: string) => {
    switch (type) {
      case 'number':
        return <Hash className="w-4 h-4" />;
      case 'picklist':
        return <List className="w-4 h-4" />;
      case 'url':
        return <Globe className="w-4 h-4" />;
      case 'digital_asset':
        return <Image className="w-4 h-4" />;
      case 'yes_no':
        return <CheckCircle className="w-4 h-4" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  const getDataTypeLabel = (type: string) => {
    switch (type) {
      case 'number':
        return 'Number';
      case 'picklist':
        return 'Picklist';
      case 'url':
        return 'URL';
      case 'digital_asset':
        return 'Digital Asset';
      case 'yes_no':
        return 'Yes/No';
      case 'html':
        return 'HTML';
      default:
        return 'String';
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'bg-green-500/20 text-green-700 dark:text-green-300';
    if (confidence >= 0.6) return 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-300';
    return 'bg-orange-500/20 text-orange-700 dark:text-orange-300';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.4 }}
    >
      <Card className="p-6 shadow-elevated">
        <div className="space-y-6">
          <div 
            className="cursor-pointer"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <h2 className="text-2xl font-semibold mb-2 flex items-center gap-2">
              {isExpanded ? <ChevronDown className="w-6 h-6" /> : <ChevronRight className="w-6 h-6" />}
              Property Recommendations
            </h2>
            <p className="text-muted-foreground">
              Data type suggestions and optimization opportunities
            </p>
          </div>

          {isExpanded && (
          <>
          {/* Record ID and Name Suggestions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="p-4 bg-primary/5 border-primary/20">
              <div className="flex items-center gap-2 mb-2">
                <Hash className="w-5 h-5 text-primary" />
                <h3 className="font-semibold">Record ID</h3>
              </div>
              {recordIdSuggestion ? (
                <Badge variant="outline" className="bg-primary/10">
                  {recordIdSuggestion}
                </Badge>
              ) : (
                <p className="text-sm text-muted-foreground">No unique identifier detected</p>
              )}
            </Card>

            <Card className="p-4 bg-accent/5 border-accent/20">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-5 h-5 text-accent" />
                <h3 className="font-semibold">Record Name</h3>
              </div>
              {recordNameSuggestion ? (
                <Badge variant="outline" className="bg-accent/10">
                  {recordNameSuggestion}
                </Badge>
              ) : (
                <p className="text-sm text-muted-foreground">No name field detected</p>
              )}
            </Card>
          </div>

          {/* Data Type Recommendations */}
          <div>
            <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Data Type Analysis
            </h3>
            <div className="space-y-3">
              {propertyRecommendations.map((rec, index) => (
                <motion.div
                  key={rec.header}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className="p-4 rounded-lg border bg-card hover:shadow-card transition-shadow"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {getDataTypeIcon(rec.dataType)}
                        <h4 className="font-medium">{rec.header}</h4>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">
                          {getDataTypeLabel(rec.dataType)}
                        </Badge>
                        <Badge className={getConfidenceColor(rec.confidence)}>
                          {Math.round(rec.confidence * 100)}% confidence
                        </Badge>
                      </div>

                      {rec.isPicklist && rec.picklistValues && rec.picklistValues.length > 0 && (
                        <div className="mt-3 p-3 rounded bg-muted/50">
                          <p className="text-sm font-medium mb-2">Suggested Picklist Values:</p>
                          <div className="flex flex-wrap gap-1.5">
                            {rec.picklistValues.slice(0, 10).map((value) => (
                              <Badge key={value} variant="outline" className="text-xs">
                                {value}
                              </Badge>
                            ))}
                            {rec.picklistValues.length > 10 && (
                              <Badge variant="outline" className="text-xs">
                                +{rec.picklistValues.length - 10} more
                              </Badge>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* UOM Suggestions */}
          {uomSuggestions.length > 0 && (
            <div>
              <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                <Ruler className="w-5 h-5" />
                Unit of Measure Recommendations
              </h3>
              <div className="space-y-3">
                {uomSuggestions.map((suggestion, index) => (
                  <motion.div
                    key={suggestion.header}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.03 }}
                    className="p-4 rounded-lg border bg-card"
                  >
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-orange-500 mt-0.5" />
                      <div className="flex-1">
                        <h4 className="font-medium mb-2">{suggestion.header}</h4>
                        
                        {suggestion.suggestedSplit && (
                          <div className="mb-3 p-3 rounded bg-orange-500/10 border border-orange-500/20">
                            <p className="text-sm font-medium text-orange-700 dark:text-orange-300 mb-1">
                              ⚠️ Split Required
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Values contain embedded units ({suggestion.detectedUom}). 
                              Consider splitting into separate value and UOM properties.
                            </p>
                          </div>
                        )}

                        {suggestion.suggestedConversions && suggestion.suggestedConversions.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-sm font-medium">Suggested Conversions:</p>
                            {suggestion.suggestedConversions.map((conversion) => (
                              <div key={conversion.targetUom} className="flex items-center gap-2 text-sm">
                                <Badge variant="outline">{suggestion.detectedUom}</Badge>
                                <ArrowRight className="w-3 h-3 text-muted-foreground" />
                                <Badge variant="outline">{conversion.targetUom}</Badge>
                                <span className="text-muted-foreground">→ {conversion.newPropertyName}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
          </>
          )}
        </div>
      </Card>
    </motion.div>
  );
};
