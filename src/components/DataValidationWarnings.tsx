import { motion } from 'framer-motion';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { 
  AlertTriangle, 
  AlertCircle, 
  Info, 
  Copy, 
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { DataValidationWarning, ValidationResult } from '@/utils/dataValidation';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';
import { useState } from 'react';

interface DataValidationWarningsProps {
  validation: ValidationResult;
}

export const DataValidationWarnings = ({ validation }: DataValidationWarningsProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedWarnings, setExpandedWarnings] = useState<Set<number>>(new Set([0]));
  const [dismissedWarnings, setDismissedWarnings] = useState<Set<number>>(new Set());

  if (validation.warnings.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
      >
        <Card className="p-6 shadow-elevated border-green-500/50 bg-green-50/50 dark:bg-green-950/20">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400" />
            <div>
              <h3 className="font-semibold text-lg">Data Quality: Excellent</h3>
              <p className="text-sm text-muted-foreground">
                No data quality issues detected. Your data is ready for analysis.
              </p>
            </div>
          </div>
        </Card>
      </motion.div>
    );
  }

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'high':
        return <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />;
      case 'medium':
        return <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />;
      default:
        return <Info className="w-5 h-5 text-blue-600 dark:text-blue-400" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'border-red-500/50 bg-red-50/50 dark:bg-red-950/20';
      case 'medium':
        return 'border-yellow-500/50 bg-yellow-50/50 dark:bg-yellow-950/20';
      default:
        return 'border-blue-500/50 bg-blue-50/50 dark:bg-blue-950/20';
    }
  };

  const toggleWarning = (index: number) => {
    const newExpanded = new Set(expandedWarnings);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedWarnings(newExpanded);
  };

  const dismissWarning = (index: number) => {
    const newDismissed = new Set(dismissedWarnings);
    newDismissed.add(index);
    setDismissedWarnings(newDismissed);
  };

  // Filter out dismissed warnings
  const activeWarnings = validation.warnings.filter((_, index) => !dismissedWarnings.has(index));

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.4 }}
    >
      <Card className="p-6 shadow-elevated">
        <div className="space-y-6">
          {/* Header */}
          <div 
            className="cursor-pointer"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-2xl font-semibold flex items-center gap-2">
                {isExpanded ? <ChevronDown className="w-6 h-6" /> : <ChevronRight className="w-6 h-6" />}
                Data Quality Warnings
              </h2>
              <div className="flex gap-2">
                <Badge variant="destructive">
                  {validation.criticalIssues} Critical
                </Badge>
                <Badge variant="secondary">
                  {validation.totalIssues} Total Issues
                </Badge>
              </div>
            </div>
            <p className="text-muted-foreground">
              Review these warnings to improve data quality. <strong>No modifications will be made to your data.</strong>
            </p>
          </div>

          {isExpanded && (
          <>
          {/* Summary Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-red-100 dark:bg-red-950/30">
              <div className="text-sm text-red-800 dark:text-red-200 mb-1">High Severity</div>
              <div className="text-2xl font-bold text-red-900 dark:text-red-100">
                {validation.warnings.filter(w => w.severity === 'high').length}
              </div>
            </div>
            <div className="p-4 rounded-lg bg-yellow-100 dark:bg-yellow-950/30">
              <div className="text-sm text-yellow-800 dark:text-yellow-200 mb-1">Medium Severity</div>
              <div className="text-2xl font-bold text-yellow-900 dark:text-yellow-100">
                {validation.warnings.filter(w => w.severity === 'medium').length}
              </div>
            </div>
            <div className="p-4 rounded-lg bg-blue-100 dark:bg-blue-950/30">
              <div className="text-sm text-blue-800 dark:text-blue-200 mb-1">Low Severity</div>
              <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                {validation.warnings.filter(w => w.severity === 'low').length}
              </div>
            </div>
          </div>

          {/* Warnings List */}
          <ScrollArea className="h-[500px]">
            <div className="space-y-3 pr-4">
              {activeWarnings.map((warning, index) => {
                const originalIndex = validation.warnings.indexOf(warning);
                return (
                <Collapsible
                  key={index}
                  open={expandedWarnings.has(index)}
                  onOpenChange={() => toggleWarning(index)}
                >
                  <Card className={`p-4 ${getSeverityColor(warning.severity)}`}>
                    <CollapsibleTrigger className="w-full">
                      <div className="flex items-start gap-3">
                        {getSeverityIcon(warning.severity)}
                        <div className="flex-1 text-left">
                          <div className="flex items-center justify-between mb-1">
                            <h3 className="font-semibold">{warning.title}</h3>
                            <Badge variant="outline" className="text-xs">
                              {warning.affectedCount} affected
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{warning.message}</p>
                        </div>
                      </div>
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                      <div className="mt-4 space-y-3 border-t pt-3">
                        {/* Salsify Rule Reference */}
                        {warning.salsifyRule && (
                          <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs bg-primary/20 text-primary border-primary/30">
                                SALSIFY
                              </Badge>
                              <span className="text-xs font-medium text-primary">{warning.salsifyRule}</span>
                            </div>
                          </div>
                        )}
                        
                        {/* Suggestion */}
                        <div className="p-3 rounded-lg bg-background/50">
                          <div className="flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 text-primary mt-0.5" />
                            <div>
                              <div className="font-medium text-sm mb-1">Action:</div>
                              <p className="text-sm text-muted-foreground">{warning.suggestion}</p>
                            </div>
                          </div>
                        </div>

                        {/* Examples */}
                        {warning.examples && warning.examples.length > 0 && (
                          <div>
                            <div className="font-medium text-sm mb-2">Examples:</div>
                            <div className="space-y-1">
                              {warning.examples.map((example, idx) => (
                                <div
                                  key={idx}
                                  className="text-sm font-mono bg-background/50 p-2 rounded border"
                                >
                                  {example}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Affected Rows Info */}
                        <div className="text-xs text-muted-foreground font-mono">
                          Excel rows: {warning.affectedRows.slice(0, 10).join(', ')}
                          {warning.affectedRows.length > 10 && ` ... and ${warning.affectedRows.length - 10} more`}
                        </div>

                        {/* Dismiss Button */}
                        <div className="flex justify-end pt-2 border-t">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              dismissWarning(originalIndex);
                            }}
                            className="text-xs"
                          >
                            <XCircle className="w-3 h-3 mr-1" />
                            Dismiss Warning
                          </Button>
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
                );
              })}
            </div>
          </ScrollArea>

          {/* Footer Note */}
          <div className="p-4 rounded-lg bg-muted/50 border">
            <p className="text-sm text-muted-foreground">
              <strong>Note:</strong> These are recommendations only. Your original data remains unchanged. 
              Use these insights during client calls to discuss data quality improvements.
            </p>
          </div>
          </>
          )}
        </div>
      </Card>
    </motion.div>
  );
};
