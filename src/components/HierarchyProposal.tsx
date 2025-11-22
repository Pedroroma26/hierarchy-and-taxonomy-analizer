import { useState } from 'react';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronRight, ChevronDown, Database, Layers, Tag } from 'lucide-react';

export interface HierarchyLevel {
  level: number;
  name: string;
  headers: string[];
  recordId: string; // MANDATORY - Record ID field for this level
  recordName?: string; // Suggested Record Name field for this level
}

interface HierarchyProposalProps {
  hierarchy: HierarchyLevel[];
  properties: string[];
  propertiesWithoutValues?: string[];
}

export const HierarchyProposal = ({ hierarchy, properties, propertiesWithoutValues = [] }: HierarchyProposalProps) => {
  const [isExpanded, setIsExpanded] = useState(true);

  const getLevelIcon = (level: number) => {
    switch (level) {
      case 1:
        return <Database className="w-5 h-5" />;
      case 2:
        return <Layers className="w-5 h-5" />;
      default:
        return <Tag className="w-5 h-5" />;
    }
  };

  const getLevelColor = (level: number) => {
    switch (level) {
      case 1:
        return 'bg-primary text-primary-foreground';
      case 2:
        return 'bg-accent text-accent-foreground';
      default:
        return 'bg-secondary text-secondary-foreground';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
    >
      <Card className="p-6 shadow-elevated">
        <div className="space-y-6">
          <div 
            className="cursor-pointer"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <h2 className="text-2xl font-semibold mb-2 flex items-center gap-2">
              {isExpanded ? <ChevronDown className="w-6 h-6" /> : <ChevronRight className="w-6 h-6" />}
              Proposed Product Hierarchy
            </h2>
            <p className="text-muted-foreground">
              Data inheritance structure based on cardinality analysis
            </p>
          </div>

          {isExpanded && (
          <>
            <div className="space-y-4">
            {hierarchy.map((level, index) => (
              <motion.div
                key={level.level}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <div className="flex items-start gap-4">
                  {index > 0 && (
                    <div className="flex flex-col items-center pt-2">
                      <ChevronRight className="w-5 h-5 text-muted-foreground rotate-90" />
                    </div>
                  )}
                  
                  <Card className={`flex-1 p-5 ${getLevelColor(level.level)} border-none`}>
                    <div className="flex items-center gap-3 mb-3">
                      {getLevelIcon(level.level)}
                      <h3 className="font-semibold text-lg">
                        Level {level.level}: {level.name}
                      </h3>
                    </div>
                    
                    {/* Record ID and Name - MANDATORY for all levels */}
                    <div className="mb-3 p-3 bg-background/30 rounded-md border border-background/40">
                      <div className="text-xs font-medium text-muted-foreground mb-2">Required for this level:</div>
                      <div className="flex gap-4 text-sm">
                        <div>
                          <span className="font-medium">Record ID:</span>{' '}
                          <Badge variant="secondary" className="ml-1">{level.recordId}</Badge>
                        </div>
                        {level.recordName && (
                          <div>
                            <span className="font-medium">Record Name:</span>{' '}
                            <Badge variant="secondary" className="ml-1">{level.recordName}</Badge>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap gap-2">
                      {level.headers.map((header) => (
                        <Badge 
                          key={header} 
                          variant="outline"
                          className="bg-background/20 border-background/30"
                        >
                          {header}
                        </Badge>
                      ))}
                    </div>
                  </Card>
                </div>
              </motion.div>
            ))}
            </div>

            {/* Properties Without Values - Uncertain Hierarchy Level */}
            {propertiesWithoutValues.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="mt-6 p-5 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800"
            >
              <div className="flex items-center gap-2 mb-3">
                <Tag className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                <h3 className="font-semibold text-lg text-yellow-800 dark:text-yellow-300">
                  Properties Without Values
                </h3>
              </div>
              <p className="text-sm text-yellow-700 dark:text-yellow-400 mb-3">
                {propertiesWithoutValues.length} properties have no data. Uncertain which hierarchy level they belong to.
              </p>
              <div className="flex flex-wrap gap-2">
                {propertiesWithoutValues.map((prop) => (
                  <Badge key={prop} variant="outline" className="bg-yellow-100 dark:bg-yellow-900/30 border-yellow-300 dark:border-yellow-700">
                    {prop}
                  </Badge>
                ))}
              </div>
            </motion.div>
            )}
          </>
          )}
        </div>
      </Card>
    </motion.div>
  );
};
