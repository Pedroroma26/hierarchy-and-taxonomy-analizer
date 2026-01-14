import { useState, memo } from 'react';
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

export const PropertyRecommendations = memo(({
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
              Data type suggestions
            </p>
          </div>

          {isExpanded && (
          <>
          {/* Record ID and Name Suggestions Per Level */}
          <div>
            <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
              <Hash className="w-5 h-5" />
              Record ID & Name by Level
            </h3>
            <div className="space-y-3">
              {hierarchy.map((level, index) => (
                <motion.div
                  key={level.level}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="p-4 rounded-lg border bg-card"
                >
                  <div className="mb-3">
                    <h4 className="font-medium text-sm text-muted-foreground mb-1">
                      Level {level.level}: {level.name}
                    </h4>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Record ID - Show actual property name */}
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Hash className="w-4 h-4 text-primary" />
                        <span className="text-sm font-semibold">Record ID</span>
                      </div>
                      <div className="space-y-1.5">
                        {level.recordId ? (
                          <Badge variant="default" className="text-xs bg-primary">
                            {level.recordId}
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="text-xs">
                            ⚠️ No Record ID found
                          </Badge>
                        )}
                      </div>
                    </div>
                    
                    {/* Record Name - Show actual property name */}
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <FileText className="w-4 h-4 text-accent" />
                        <span className="text-sm font-semibold">Record Name</span>
                      </div>
                      <div className="space-y-1.5">
                        {level.recordName ? (
                          <Badge variant="default" className="text-xs bg-accent">
                            {level.recordName}
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="text-xs">
                            ⚠️ No Record Name found
                          </Badge>
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
              {propertyRecommendations.map((rec, index) => {
                // Check if this property is a Record ID or Record Name in any level
                const recordIdLevel = hierarchy.find(level => level.recordId === rec.header);
                const recordNameLevel = hierarchy.find(level => level.recordName === rec.header);
                const isRecordId = !!recordIdLevel;
                const isRecordName = !!recordNameLevel;
                
                return (
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
                        {isRecordId && (
                          <Badge variant="default" className="bg-primary text-xs">
                            Record ID (L{recordIdLevel?.level})
                          </Badge>
                        )}
                        {isRecordName && (
                          <Badge variant="default" className="bg-accent text-xs">
                            Record Name (L{recordNameLevel?.level})
                          </Badge>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">
                          {getDataTypeLabel(rec.dataType)}
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
              );
              })}
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
});
