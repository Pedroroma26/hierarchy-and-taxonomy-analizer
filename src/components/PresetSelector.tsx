import { useState } from 'react';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Layers, Database, FileText } from 'lucide-react';

interface HierarchyAlternative {
  name: string;
  hierarchy: any[];
  properties: string[];
  confidence: number;
  reasoning: string;
  modelType: 'standalone' | 'hierarchical' | 'mixed';
}

interface PresetSelectorProps {
  presets: HierarchyAlternative[];
  onSelectPreset: (preset: HierarchyAlternative) => void;
  selectedPreset?: HierarchyAlternative;
}

export const PresetSelector = ({ presets, onSelectPreset, selectedPreset }: PresetSelectorProps) => {
  const [hoveredPreset, setHoveredPreset] = useState<string | null>(null);

  const getPresetIcon = (name: string) => {
    if (name.includes('Flat')) return FileText;
    if (name.includes('Parent-Variant')) return Database;
    if (name.includes('Multi-Level')) return Layers;
    return Database;
  };

  const getPresetColor = (name: string) => {
    if (name.includes('Flat')) return 'bg-blue-500';
    if (name.includes('Parent-Variant')) return 'bg-green-500';
    if (name.includes('Multi-Level')) return 'bg-purple-500';
    return 'bg-gray-500';
  };

  if (!presets || presets.length === 0) {
    return null;
  }

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold mb-2">Select Hierarchy Structure</h3>
          <p className="text-sm text-muted-foreground">
            Choose a preset structure based on your PIM requirements. The analysis automatically recommends the best option.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {presets.map((preset, index) => {
            const Icon = getPresetIcon(preset.name);
            const colorClass = getPresetColor(preset.name);
            const isSelected = selectedPreset?.name === preset.name;
            const isHovered = hoveredPreset === preset.name;

            return (
              <motion.div
                key={preset.name}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                onMouseEnter={() => setHoveredPreset(preset.name)}
                onMouseLeave={() => setHoveredPreset(null)}
              >
                <Card
                  className={`relative p-4 cursor-pointer transition-all ${
                    isSelected
                      ? 'border-2 border-primary shadow-lg'
                      : isHovered
                      ? 'border-2 border-primary/50 shadow-md'
                      : 'border border-border hover:shadow-md'
                  }`}
                  onClick={() => onSelectPreset(preset)}
                >
                  {/* Selection Indicator */}
                  {isSelected && (
                    <div className="absolute top-2 right-2">
                      <div className="bg-primary text-primary-foreground rounded-full p-1">
                        <Check className="h-4 w-4" />
                      </div>
                    </div>
                  )}

                  {/* Icon */}
                  <div className={`${colorClass} w-12 h-12 rounded-lg flex items-center justify-center mb-3`}>
                    <Icon className="h-6 w-6 text-white" />
                  </div>

                  {/* Title */}
                  <h4 className="font-semibold text-base mb-2">{preset.name}</h4>

                  {/* Hierarchy Levels */}
                  <div className="flex items-center gap-2 mb-3">
                    <Badge variant="outline" className="text-xs">
                      {preset.hierarchy.length} {preset.hierarchy.length === 1 ? 'Level' : 'Levels'}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {Math.round(preset.confidence * 100)}% confidence
                    </Badge>
                  </div>

                  {/* Level Names */}
                  <div className="text-xs text-muted-foreground mb-3">
                    {preset.hierarchy.map((level, idx) => (
                      <div key={idx} className="flex items-center gap-1">
                        <span className="font-medium">L{level.level}:</span>
                        <span>{level.name}</span>
                      </div>
                    ))}
                  </div>

                  {/* Reasoning */}
                  <p className="text-xs text-muted-foreground line-clamp-3">
                    {preset.reasoning}
                  </p>

                  {/* Select Button */}
                  <Button
                    variant={isSelected ? 'default' : 'outline'}
                    size="sm"
                    className="w-full mt-3"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectPreset(preset);
                    }}
                  >
                    {isSelected ? 'Selected' : 'Select'}
                  </Button>
                </Card>
              </motion.div>
            );
          })}
        </div>

      </div>
    </Card>
  );
};
