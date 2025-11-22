import { useState } from 'react';
import { motion } from 'framer-motion';
import { Card } from './ui/card';
import { Slider } from './ui/slider';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { RefreshCw, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';

interface ThresholdAdjusterProps {
  currentThresholds: { low: number; medium: number };
  onThresholdChange: (low: number, medium: number) => void;
  onApply: () => void;
}

export const ThresholdAdjuster = ({ 
  currentThresholds, 
  onThresholdChange,
  onApply 
}: ThresholdAdjusterProps) => {
  const [lowThreshold, setLowThreshold] = useState(currentThresholds.low);
  const [mediumThreshold, setMediumThreshold] = useState(currentThresholds.medium);

  const handleLowChange = (values: number[]) => {
    const newLow = values[0];
    setLowThreshold(newLow);
    // Ensure medium is always higher than low
    if (newLow >= mediumThreshold) {
      setMediumThreshold(Math.min(newLow + 0.1, 0.9));
    }
  };

  const handleMediumChange = (values: number[]) => {
    const newMedium = values[0];
    // Ensure medium is always higher than low
    if (newMedium > lowThreshold) {
      setMediumThreshold(newMedium);
    }
  };

  const handleApply = () => {
    onThresholdChange(lowThreshold, mediumThreshold);
    onApply();
  };

  const hasChanges = lowThreshold !== currentThresholds.low || mediumThreshold !== currentThresholds.medium;

  return (
    <Card className="p-6 shadow-elevated">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="space-y-6"
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold mb-2">Smart Threshold Adjustment</h2>
            <p className="text-muted-foreground">
              Fine-tune cardinality thresholds to optimize hierarchy detection
            </p>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Info className="w-5 h-5 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>Adjust these thresholds to control how fields are classified. Lower values create more hierarchy levels, higher values create flatter structures.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <div className="space-y-6">
          {/* Low Cardinality Threshold */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <label className="font-medium">Low Cardinality (Hierarchy Fields)</label>
                <Badge variant="secondary">{(lowThreshold * 100).toFixed(0)}% unique values</Badge>
              </div>
            </div>
            <Slider
              value={[lowThreshold]}
              onValueChange={handleLowChange}
              min={0.01}
              max={0.4}
              step={0.01}
              className="w-full"
            />
            <p className="text-sm text-muted-foreground">
              Fields with uniqueness below this threshold become hierarchy levels (e.g., categories)
            </p>
          </div>

          {/* Medium Cardinality Threshold */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <label className="font-medium">Medium Cardinality (Property Fields)</label>
                <Badge variant="secondary">{(mediumThreshold * 100).toFixed(0)}% unique values</Badge>
              </div>
            </div>
            <Slider
              value={[mediumThreshold]}
              onValueChange={handleMediumChange}
              min={lowThreshold + 0.1}
              max={0.9}
              step={0.01}
              className="w-full"
            />
            <p className="text-sm text-muted-foreground">
              Fields between low and medium thresholds can be hierarchy or properties
            </p>
          </div>

          {/* Visual representation */}
          <div className="p-4 bg-muted/50 rounded-lg space-y-2">
            <div className="text-sm font-medium mb-3">Classification Preview:</div>
            <div className="flex items-center gap-2">
              <div className="w-20 text-sm text-muted-foreground">0%</div>
              <div className="flex-1 h-8 rounded-md overflow-hidden flex">
                <div 
                  style={{ width: `${lowThreshold * 100}%` }}
                  className="bg-primary flex items-center justify-center text-xs font-medium text-primary-foreground"
                >
                  Hierarchy
                </div>
                <div 
                  style={{ width: `${(mediumThreshold - lowThreshold) * 100}%` }}
                  className="bg-secondary flex items-center justify-center text-xs font-medium"
                >
                  Flexible
                </div>
                <div 
                  style={{ width: `${(1 - mediumThreshold) * 100}%` }}
                  className="bg-accent flex items-center justify-center text-xs font-medium"
                >
                  Properties
                </div>
              </div>
              <div className="w-20 text-sm text-muted-foreground text-right">100%</div>
            </div>
          </div>

          {hasChanges && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center justify-end gap-3 pt-4 border-t"
            >
              <Button
                variant="outline"
                onClick={() => {
                  setLowThreshold(currentThresholds.low);
                  setMediumThreshold(currentThresholds.medium);
                }}
              >
                Reset
              </Button>
              <Button onClick={handleApply} className="gap-2">
                <RefreshCw className="w-4 h-4" />
                Reanalyze with New Thresholds
              </Button>
            </motion.div>
          )}
        </div>
      </motion.div>
    </Card>
  );
};
