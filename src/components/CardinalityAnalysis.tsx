import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';

export interface CardinalityScore {
  header: string;
  uniqueCount: number;
  totalCount: number;
  cardinality: number;
  classification: 'high' | 'medium' | 'low';
}

interface CardinalityAnalysisProps {
  scores: CardinalityScore[];
}

export const CardinalityAnalysis = ({ scores }: CardinalityAnalysisProps) => {
  const getClassificationColor = (classification: string) => {
    switch (classification) {
      case 'high':
        return 'bg-secondary text-secondary-foreground';
      case 'medium':
        return 'bg-accent text-accent-foreground';
      case 'low':
        return 'bg-primary text-primary-foreground';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getClassificationLabel = (classification: string) => {
    switch (classification) {
      case 'high':
        return 'High Uniqueness';
      case 'medium':
        return 'Medium Repetition';
      case 'low':
        return 'High Repetition';
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
          <div>
            <h2 className="text-2xl font-semibold mb-2">Cardinality Analysis</h2>
            <p className="text-muted-foreground">
              Analyzing uniqueness of values across all product attributes
            </p>
          </div>

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
                    <span className="text-muted-foreground">Cardinality Score</span>
                    <span className="font-semibold">{(score.cardinality * 100).toFixed(1)}%</span>
                  </div>
                  <Progress value={score.cardinality * 100} className="h-2" />
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </Card>
    </motion.div>
  );
};
