import { motion } from 'framer-motion';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { OrphanedRecord } from '@/utils/analysisEngine';
import { AlertTriangle, AlertCircle, Info } from 'lucide-react';
import { Alert, AlertDescription } from './ui/alert';

interface OrphanedRecordsAlertProps {
  orphanedRecords: OrphanedRecord[];
}

export const OrphanedRecordsAlert = ({ orphanedRecords }: OrphanedRecordsAlertProps) => {
  if (orphanedRecords.length === 0) return null;

  const getSeverityIcon = (severity: OrphanedRecord['severity']) => {
    switch (severity) {
      case 'high':
        return <AlertTriangle className="w-4 h-4" />;
      case 'medium':
        return <AlertCircle className="w-4 h-4" />;
      default:
        return <Info className="w-4 h-4" />;
    }
  };

  const getSeverityColor = (severity: OrphanedRecord['severity']) => {
    switch (severity) {
      case 'high':
        return 'destructive';
      case 'medium':
        return 'default';
      default:
        return 'secondary';
    }
  };

  const highSeverity = orphanedRecords.filter(r => r.severity === 'high').length;
  const mediumSeverity = orphanedRecords.filter(r => r.severity === 'medium').length;
  const lowSeverity = orphanedRecords.filter(r => r.severity === 'low').length;

  return (
    <Card className="p-6 shadow-elevated border-orange-200 dark:border-orange-900">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="space-y-4"
      >
        <div>
          <div className="flex items-center gap-3 mb-2">
            <AlertTriangle className="w-6 h-6 text-orange-600 dark:text-orange-400" />
            <h2 className="text-2xl font-semibold">Data Quality Issues</h2>
          </div>
          <p className="text-muted-foreground">
            Found {orphanedRecords.length} records with potential issues
          </p>
          <div className="flex gap-2 mt-3">
            {highSeverity > 0 && (
              <Badge variant="destructive">{highSeverity} High</Badge>
            )}
            {mediumSeverity > 0 && (
              <Badge variant="default">{mediumSeverity} Medium</Badge>
            )}
            {lowSeverity > 0 && (
              <Badge variant="secondary">{lowSeverity} Low</Badge>
            )}
          </div>
        </div>

        <Alert>
          <Info className="w-4 h-4" />
          <AlertDescription>
            These records may have missing hierarchy values, incomplete data, or outlier values. Review them to ensure data consistency.
          </AlertDescription>
        </Alert>

        <ScrollArea className="h-[300px] rounded-md border p-4">
          <div className="space-y-3">
            {orphanedRecords.map((record, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2, delay: index * 0.05 }}
                className="p-3 rounded-lg bg-muted/50 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Row {record.rowIndex}</span>
                  </div>
                  <Badge variant={getSeverityColor(record.severity)} className="gap-1">
                    {getSeverityIcon(record.severity)}
                    {record.severity}
                  </Badge>
                </div>
                <ul className="space-y-1">
                  {record.issues.map((issue, idx) => (
                    <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                      <span className="text-orange-600 dark:text-orange-400">•</span>
                      <span>{issue}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
        </ScrollArea>
      </motion.div>
    </Card>
  );
};
