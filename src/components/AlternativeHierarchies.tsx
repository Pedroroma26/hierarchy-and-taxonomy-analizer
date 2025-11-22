import { motion } from 'framer-motion';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { HierarchyAlternative } from '@/utils/analysisEngine';
import { Network, CheckCircle2, Info } from 'lucide-react';

interface AlternativeHierarchiesProps {
  alternatives: HierarchyAlternative[];
  currentConfidence: number;
  onSelect: (alternative: HierarchyAlternative) => void;
}

export const AlternativeHierarchies = ({ 
  alternatives, 
  currentConfidence,
  onSelect 
}: AlternativeHierarchiesProps) => {
  if (alternatives.length === 0) return null;

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.75) return 'text-green-600 dark:text-green-400';
    if (confidence >= 0.5) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-orange-600 dark:text-orange-400';
  };

  return (
    <Card className="p-6 shadow-elevated">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="space-y-6"
      >
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Network className="w-6 h-6 text-primary" />
            <h2 className="text-2xl font-semibold">Alternative Hierarchies</h2>
          </div>
          <p className="text-muted-foreground">
            Different ways to structure your data. Current confidence: <span className={getConfidenceColor(currentConfidence)}>{(currentConfidence * 100).toFixed(0)}%</span>
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {alternatives.map((alternative, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2, delay: index * 0.1 }}
            >
              <Card className="p-4 hover:shadow-glow transition-all border-2 hover:border-primary/50">
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-lg">{alternative.name}</h3>
                      <Badge 
                        variant="secondary" 
                        className={`mt-2 ${getConfidenceColor(alternative.confidence)}`}
                      >
                        {(alternative.confidence * 100).toFixed(0)}% confidence
                      </Badge>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-sm font-medium">Structure:</div>
                    {alternative.hierarchy.map((level, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-sm">
                        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium">
                          {level.level}
                        </div>
                        <span className="text-muted-foreground">{level.name}</span>
                      </div>
                    ))}
                    <div className="flex items-center gap-2 text-sm pt-1 border-t">
                      <Info className="w-4 h-4 text-muted-foreground" />
                      <span className="text-muted-foreground">
                        {alternative.properties.length} properties
                      </span>
                    </div>
                  </div>

                  <p className="text-sm text-muted-foreground italic">
                    {alternative.reasoning}
                  </p>

                  <Button 
                    onClick={() => onSelect(alternative)}
                    className="w-full gap-2"
                    variant="outline"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Use This Structure
                  </Button>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </Card>
  );
};
