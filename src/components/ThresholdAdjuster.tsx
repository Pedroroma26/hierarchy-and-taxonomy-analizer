import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { motion } from 'framer-motion';
import { Play, RotateCcw, Info, HelpCircle } from 'lucide-react';

interface ThresholdAdjusterProps {
  currentThresholds: {
    parent: number;
    childrenMin: number;
    childrenMax: number;
    sku: number;
  };
  onThresholdsChange: (thresholds: { parent: number; childrenMin: number; childrenMax: number; sku: number; minPropertiesPerLevel: number }) => void;
}

export const ThresholdAdjuster = ({ currentThresholds, onThresholdsChange }: ThresholdAdjusterProps) => {
  const [parent, setParent] = useState(currentThresholds.parent);
  const [childrenMin, setChildrenMin] = useState(currentThresholds.childrenMin);
  const [childrenMax, setChildrenMax] = useState(currentThresholds.childrenMax);
  const [sku, setSku] = useState(currentThresholds.sku);
  const [minPropertiesPerLevel, setMinPropertiesPerLevel] = useState(5);
  const [showExplanation, setShowExplanation] = useState(true);

  const handleReset = () => {
    setParent(0.02);
    setChildrenMin(0.50);
    setChildrenMax(0.75);
    setSku(0.98);
    setMinPropertiesPerLevel(5);
  };

  const handleApply = () => {
    onThresholdsChange({ parent, childrenMin, childrenMax, sku, minPropertiesPerLevel });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
    >
      <Card className="p-6 shadow-elevated">
        <div className="flex items-center justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-semibold">Adjust Cardinality Thresholds</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowExplanation(!showExplanation)}
                className="h-6 w-6 p-0"
              >
                <HelpCircle className="w-4 h-4 text-muted-foreground" />
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Fine-tune the 4-level hierarchy detection by adjusting threshold values
            </p>
          </div>
          <Badge variant="outline" className="text-xs">
            4 Levels
          </Badge>
        </div>

        {showExplanation && (
          <Alert className="mb-6 bg-primary/5 border-primary/20">
            <Info className="h-4 w-4 text-primary" />
            <AlertDescription className="text-sm">
              <p className="font-semibold mb-2">What is Cardinality?</p>
              <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                <strong>Cardinality</strong> measures how unique the values are in a property. 
                It's calculated as: <strong>(unique values / total values) × 100%</strong>
              </p>
              <div className="space-y-1 text-xs">
                <p>• <strong>Low cardinality (≤2%)</strong>: Few unique values → Good for taxonomy/parent levels (e.g., "Category", "Brand")</p>
                <p>• <strong>Medium cardinality (~50%)</strong>: Moderate uniqueness → Good for child/variant levels</p>
                <p>• <strong>Medium-high (~75%)</strong>: Higher uniqueness → Grandchild levels</p>
                <p>• <strong>High cardinality (≥98%)</strong>: Almost all unique → SKU-level attributes (e.g., "Product ID", "SKU")</p>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Visual Threshold Scale */}
        <div className="bg-gradient-to-r from-blue-500 via-green-500 via-yellow-500 to-red-500 h-3 rounded-full relative mb-8">
          <div className="absolute -top-8 left-0 text-xs font-semibold text-blue-600">0%</div>
          <div className="absolute -top-8 right-0 text-xs font-semibold text-red-600">100%</div>
        </div>

        <div className="space-y-8">
          {/* Level 1: Parent */}
          <div className="space-y-3 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border-2 border-blue-200 dark:border-blue-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge className="bg-blue-500 text-white">Level 1</Badge>
                <label className="text-sm font-semibold">Parent/Taxonomy</label>
              </div>
              <Badge variant="secondary" className="text-base font-bold">
                ≤ {(parent * 100).toFixed(1)}%
              </Badge>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground whitespace-nowrap">0%</span>
              <Slider
                value={[parent * 100]}
                onValueChange={(value) => setParent(value[0] / 100)}
                min={1}
                max={10}
                step={0.5}
                className="flex-1"
              />
              <span className="text-xs text-muted-foreground whitespace-nowrap">10%</span>
            </div>
            <p className="text-xs text-muted-foreground">
              ← Move left for stricter (fewer items) | Move right for looser (more items) →
            </p>
          </div>

          {/* Level 2: Children */}
          <div className="space-y-3 p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border-2 border-green-200 dark:border-green-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge className="bg-green-500 text-white">Level 2</Badge>
                <label className="text-sm font-semibold">Children/Variants</label>
              </div>
              <Badge variant="secondary" className="text-base font-bold">
                {(childrenMin * 100).toFixed(0)}%
              </Badge>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground whitespace-nowrap">0%</span>
              <Slider
                value={[childrenMin * 100]}
                onValueChange={(value) => setChildrenMin(value[0] / 100)}
                min={0}
                max={100}
                step={5}
                className="flex-1"
              />
              <span className="text-xs text-muted-foreground whitespace-nowrap">100%</span>
            </div>
            <p className="text-xs text-muted-foreground">
              ✨ Can overlap with other levels for flexible grouping
            </p>
          </div>

          {/* Level 3: Grandchildren */}
          <div className="space-y-3 p-4 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg border-2 border-yellow-200 dark:border-yellow-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge className="bg-yellow-500 text-white">Level 3</Badge>
                <label className="text-sm font-semibold">Grandchildren</label>
              </div>
              <Badge variant="secondary" className="text-base font-bold">
                {(childrenMax * 100).toFixed(0)}%
              </Badge>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground whitespace-nowrap">0%</span>
              <Slider
                value={[childrenMax * 100]}
                onValueChange={(value) => setChildrenMax(value[0] / 100)}
                min={0}
                max={100}
                step={5}
                className="flex-1"
              />
              <span className="text-xs text-muted-foreground whitespace-nowrap">100%</span>
            </div>
            <p className="text-xs text-muted-foreground">
              ✨ Can overlap with other levels for flexible grouping
            </p>
          </div>

          {/* Level 4: SKU */}
          <div className="space-y-3 p-4 bg-red-50 dark:bg-red-950/20 rounded-lg border-2 border-red-200 dark:border-red-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge className="bg-red-500 text-white">Level 4</Badge>
                <label className="text-sm font-semibold">SKU/Attributes</label>
              </div>
              <Badge variant="secondary" className="text-base font-bold">
                ≥ {(sku * 100).toFixed(0)}%
              </Badge>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground whitespace-nowrap">90%</span>
              <Slider
                value={[sku * 100]}
                onValueChange={(value) => setSku(value[0] / 100)}
                min={90}
                max={100}
                step={1}
                className="flex-1"
              />
              <span className="text-xs text-muted-foreground whitespace-nowrap">100%</span>
            </div>
            <p className="text-xs text-muted-foreground">
              ← Lower threshold = more items in Level 4 | Higher threshold = only unique items →
            </p>
          </div>

          {/* Minimum Properties Per Level */}
          <div className="space-y-3 pt-4 border-t">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">
                Minimum Properties Per Hierarchy Level
              </label>
              <Badge variant="secondary" className="text-xs">
                {minPropertiesPerLevel} properties
              </Badge>
            </div>
            <div className="flex items-center gap-3">
              <Input
                type="number"
                min={1}
                max={20}
                value={minPropertiesPerLevel}
                onChange={(e) => setMinPropertiesPerLevel(parseInt(e.target.value) || 5)}
                className="w-24"
              />
              <p className="text-xs text-muted-foreground flex-1">
                Levels with fewer than {minPropertiesPerLevel} properties will be merged with the level below
              </p>
            </div>
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
