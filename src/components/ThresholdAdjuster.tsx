import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import { Play, RotateCcw } from 'lucide-react';

interface ThresholdAdjusterProps {
  currentThresholds: {
    parent: number;
    childrenMin: number;
    childrenMax: number;
    sku: number;
  };
  onThresholdsChange: (thresholds: { parent: number; childrenMin: number; childrenMax: number; sku: number }) => void;
}

export const ThresholdAdjuster = ({ currentThresholds, onThresholdsChange }: ThresholdAdjusterProps) => {
  const [parent, setParent] = useState(currentThresholds.parent);
  const [childrenMin, setChildrenMin] = useState(currentThresholds.childrenMin);
  const [childrenMax, setChildrenMax] = useState(currentThresholds.childrenMax);
  const [sku, setSku] = useState(currentThresholds.sku);

  const handleReset = () => {
    setParent(0.02);
    setChildrenMin(0.50);
    setChildrenMax(0.75);
    setSku(0.98);
  };

  const handleApply = () => {
    onThresholdsChange({ parent, childrenMin, childrenMax, sku });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
    >
      <Card className="p-6 shadow-elevated">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-xl font-semibold">Adjust Cardinality Thresholds</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Fine-tune the 4-level hierarchy detection by adjusting threshold values
            </p>
          </div>
          <Badge variant="outline" className="text-xs">
            4 Levels
          </Badge>
        </div>

        <div className="space-y-6">
          {/* Parent Level Threshold */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">
                Level 1: Parent Threshold
              </label>
              <Badge variant="secondary" className="text-xs">
                ≤ {(parent * 100).toFixed(1)}%
              </Badge>
            </div>
            <Slider
              value={[parent]}
              onValueChange={(value) => setParent(value[0])}
              min={0.01}
              max={0.10}
              step={0.005}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Very low cardinality (≤{(parent * 100).toFixed(1)}% unique) = Parent/Taxonomy level
            </p>
          </div>

          {/* Children Min Threshold */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">
                Level 2: Children Start
              </label>
              <Badge variant="secondary" className="text-xs">
                {(childrenMin * 100).toFixed(0)}%
              </Badge>
            </div>
            <Slider
              value={[childrenMin]}
              onValueChange={(value) => setChildrenMin(value[0])}
              min={0.10}
              max={0.70}
              step={0.05}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Medium cardinality starts at {(childrenMin * 100).toFixed(0)}% unique
            </p>
          </div>

          {/* Children Max Threshold */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">
                Level 3: Grandchildren End
              </label>
              <Badge variant="secondary" className="text-xs">
                {(childrenMax * 100).toFixed(0)}%
              </Badge>
            </div>
            <Slider
              value={[childrenMax]}
              onValueChange={(value) => setChildrenMax(value[0])}
              min={0.60}
              max={0.95}
              step={0.05}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Medium cardinality ends at {(childrenMax * 100).toFixed(0)}% unique
            </p>
          </div>

          {/* SKU Level Threshold */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">
                Level 4: SKU/Attribute Threshold
              </label>
              <Badge variant="secondary" className="text-xs">
                ≥ {(sku * 100).toFixed(0)}%
              </Badge>
            </div>
            <Slider
              value={[sku]}
              onValueChange={(value) => setSku(value[0])}
              min={0.90}
              max={1.0}
              step={0.01}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Very high cardinality (≥{(sku * 100).toFixed(0)}% unique) = SKU-level attributes
            </p>
          </div>
        </div>

        <div className="flex gap-2 justify-end mt-6 pt-4 border-t">
          <Button
            variant="outline"
            onClick={handleReset}
            className="gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            Reset to Defaults
          </Button>
          <Button
            onClick={handleApply}
            className="gap-2 bg-gradient-primary"
          >
            <Play className="w-4 h-4" />
            Rerun Analysis
          </Button>
        </div>
      </Card>
    </motion.div>
  );
};
