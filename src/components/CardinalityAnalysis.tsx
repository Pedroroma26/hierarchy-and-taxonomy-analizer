import { useState } from 'react';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronRight } from 'lucide-react';

export interface CardinalityScore {
  header: string;
  uniqueCount: number;
  totalCount: number;
  cardinality: number;
  completeness: number; // NEW: % of non-empty values (data density)
  hierarchyScore: number; // NEW: Combined score for hierarchy placement
  classification: 'level1' | 'level2' | 'level3';
}

interface CardinalityAnalysisProps {
  scores: CardinalityScore[];
  thresholds?: {
    parent: number;
    childrenMin: number;
    childrenMax: number;
    sku: number;
  };
}

export const CardinalityAnalysis = ({ scores, thresholds }: CardinalityAnalysisProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const getClassificationColor = (classification: string) => {
    switch (classification) {
      case 'level1':
        return 'bg-blue-500 text-white';
      case 'level2':
        return 'bg-green-500 text-white';
      case 'level3':
        return 'bg-red-500 text-white'; // SKU-level
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getClassificationLabel = (classification: string) => {
    switch (classification) {
      case 'level1':
        return 'Level 1: Parent';
      case 'level2':
        return 'Level 2: Child/Variant';
      case 'level3':
        return 'Level 3: SKU';
      default:
        return 'Unknown';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
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
                Data Pattern Analysis
              </h2>
              <Badge variant="secondary" className="text-sm px-3 py-1 font-semibold">
                {scores.length} properties analyzed
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-muted-foreground">
                Analyzing repetition and uniqueness patterns in product attributes
              </p>
              <div className="flex gap-2 items-center flex-wrap">
                <Badge className="bg-blue-500 text-white text-xs px-2 py-1">Level 1: Parent</Badge>
                <Badge className="bg-green-500 text-white text-xs px-2 py-1">Level 2: Child/Variant</Badge>
                <Badge className="bg-red-500 text-white text-xs px-2 py-1">Level 3: SKU</Badge>
              </div>
            </div>
          </div>

          {isExpanded && (
          <div className="space-y-4">
            {scores.map((score, index) => (
              <motion.div
                key={score.header}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="p-4 rounded-lg border bg-card hover:shadow-card transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg mb-1">{score.header}</h3>
                    <p className="text-sm text-muted-foreground">
                      {score.uniqueCount} unique values out of {score.totalCount} total
                    </p>
                  </div>
                  <Badge className={getClassificationColor(score.classification)}>
                    {getClassificationLabel(score.classification)}
                  </Badge>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Uniqueness Index</span>
                    <span className="font-semibold">{(score.cardinality * 100).toFixed(1)}%</span>
                  </div>
                  <Progress value={score.cardinality * 100} className="h-2" />
                </div>
              </motion.div>
            ))}
          </div>
          )}
        </div>
      </Card>
    </motion.div>
  );
};
