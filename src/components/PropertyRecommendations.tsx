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
import { PropertyRecommendation, UomSuggestion, RecordIdNameSuggestion } from '@/utils/analysisEngine';
import { HierarchyLevel } from '@/types';

interface PropertyRecommendationsProps {
  recordIdSuggestion: string | null;
  recordNameSuggestion: string | null;
  recordIdNameSuggestions: RecordIdNameSuggestion[];
  propertyRecommendations: PropertyRecommendation[];
  uomSuggestions: UomSuggestion[];
  hierarchy: HierarchyLevel[];
}

export const PropertyRecommendations = ({
  recordIdSuggestion,
  recordNameSuggestion,
  recordIdNameSuggestions,
  propertyRecommendations,
  uomSuggestions,
  hierarchy,
}: PropertyRecommendationsProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // CRITICAL: Build suggestions directly from hierarchy to ensure alignment
  // This guarantees Record ID/Name match what's shown in Hierarchy Proposal
  const filteredSuggestions = hierarchy.map((level, index) => ({
    level: index + 1,
    levelName: level.name,
    recordIdCandidates: [level.recordId],
    selectedRecordId: level.recordId,
    recordNameCandidates: level.recordName ? [level.recordName] : [],
    selectedRecordName: level.recordName || '',
  }));
  const getDataTypeIcon = (type: string) => {
    switch (type) {
      case 'number':
        return <Hash className="w-4 h-4" />;
      case 'picklist':
        return <List className="w-4 h-4" />;
      case 'date':
        return <FileText className="w-4 h-4" />;
      case 'yes_no':
        return <CheckCircle className="w-4 h-4" />;
      case 'rich_text':
        return <FileText className="w-4 h-4" />;
      case 'html':
        return <Globe className="w-4 h-4" />;
      case 'link':
        return <Globe className="w-4 h-4" />;
      case 'digital_asset':
        return <Image className="w-4 h-4" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  const getDataTypeLabel = (type: string) => {
    switch (type) {
      case 'number':
        return 'Number';
      case 'picklist':
        return 'Picklist/Category';
      case 'date':
        return 'Date';
      case 'yes_no':
        return 'Yes/No';
      case 'rich_text':
        return 'Rich Text';
      case 'html':
        return 'HTML';
      case 'link':
        return 'Link';
      case 'digital_asset':
        return 'Digital Asset';
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
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-2xl font-semibold flex items-center gap-2">
                {isExpanded ? <ChevronDown className="w-6 h-6" /> : <ChevronRight className="w-6 h-6" />}
                Property Recommendations
              </h2>
              <Badge variant="secondary" className="text-sm px-3 py-1 font-semibold">
                {propertyRecommendations.length} properties
              </Badge>
            </div>
            <p className="text-muted-foreground">
              Data type suggestions and optimization opportunities
            </p>
          </div>

          {isExpanded && (
          <>
          {/* Record ID and Name Suggestions Per Level */}
          <div>
            <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
              <Hash className="w-5 h-5" />
              Record ID & Name Recommendations by Level
            </h3>
            <div className="space-y-3">
              {filteredSuggestions.map((suggestion, index) => (
                <motion.div
                  key={suggestion.level}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="p-4 rounded-lg border bg-card"
                >
                  <div className="mb-3">
                    <h4 className="font-medium text-sm text-muted-foreground mb-1">
                      Level {suggestion.level}: {suggestion.levelName}
                    </h4>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Record ID */}
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Hash className="w-4 h-4 text-primary" />
                        <span className="text-sm font-semibold">Record ID</span>
                      </div>
                      <div className="space-y-1.5">
                        {suggestion.recordIdCandidates.map((candidate, idx) => (
                          <Badge
                            key={candidate}
                            variant={candidate === suggestion.selectedRecordId ? "default" : "outline"}
                            className={`text-xs ${candidate === suggestion.selectedRecordId ? 'bg-primary' : 'bg-primary/10'}`}
                          >
                            {idx === 0 && candidate === suggestion.selectedRecordId && '✓ '}
                            {candidate}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    
                    {/* Record Name */}
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <FileText className="w-4 h-4 text-accent" />
                        <span className="text-sm font-semibold">Record Name</span>
                      </div>
                      <div className="space-y-1.5">
                        {suggestion.recordNameCandidates.length > 0 ? (
                          suggestion.recordNameCandidates.map((candidate, idx) => (
                            <Badge
                              key={candidate}
                              variant={candidate === suggestion.selectedRecordName ? "default" : "outline"}
                              className={`text-xs ${candidate === suggestion.selectedRecordName ? 'bg-accent' : 'bg-accent/10'}`}
                            >
                              {idx === 0 && candidate === suggestion.selectedRecordName && '✓ '}
                              {candidate}
                            </Badge>
                          ))
                        ) : (
                          <p className="text-xs text-muted-foreground">No name field detected</p>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
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
