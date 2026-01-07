import { useState } from 'react';
import { motion } from 'framer-motion';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Checkbox } from './ui/checkbox';
import { ChevronDown, ChevronRight, Plus, Trash2, Settings } from 'lucide-react';

export interface TaxonomyLevel {
  id: string;
  property: string;
}

export interface TaxonomyConfig {
  levels: TaxonomyLevel[];
}

interface TaxonomyBuilderProps {
  availableProperties: string[];
  onConfigChange: (config: TaxonomyConfig) => void;
  initialConfig?: TaxonomyConfig;
}

export const TaxonomyBuilder = ({ 
  availableProperties, 
  onConfigChange,
  initialConfig 
}: TaxonomyBuilderProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [levels, setLevels] = useState<TaxonomyLevel[]>(
    initialConfig?.levels || []
  );
  const [useCustomTaxonomy, setUseCustomTaxonomy] = useState(false);

  const addLevel = () => {
    if (levels.length >= 3) return; // Max 3 levels
    
    const newLevel: TaxonomyLevel = {
      id: `level-${Date.now()}`,
      property: '',
    };
    
    const updatedLevels = [...levels, newLevel];
    setLevels(updatedLevels);
    onConfigChange({ levels: updatedLevels });
  };

  const removeLevel = (id: string) => {
    const updatedLevels = levels.filter(level => level.id !== id);
    setLevels(updatedLevels);
    onConfigChange({ levels: updatedLevels });
  };

  const updateLevel = (id: string, value: string) => {
    const updatedLevels = levels.map(level =>
      level.id === id ? { ...level, property: value } : level
    );
    setLevels(updatedLevels);
    onConfigChange({ levels: updatedLevels });
  };

  const toggleCustomTaxonomy = (checked: boolean) => {
    setUseCustomTaxonomy(checked);
    if (!checked) {
      setLevels([]);
      onConfigChange({ levels: [] });
    }
  };

  const usedProperties = levels.map(l => l.property);
  const availableForSelection = availableProperties.filter(
    p => !usedProperties.includes(p) || p === ''
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.35 }}
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
                <Settings className="w-6 h-6 text-primary" />
                Taxonomy Configuration
              </h2>
              {useCustomTaxonomy && (
                <Badge variant="secondary" className="text-sm px-3 py-1 font-semibold">
                  {levels.length} custom {levels.length === 1 ? 'level' : 'levels'}
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground">
              Configure custom taxonomy tree structure (optional)
            </p>
          </div>

          {isExpanded && (
            <div className="space-y-6">
              {/* Toggle Custom Taxonomy */}
              <div className="flex items-center space-x-2 p-4 bg-muted/50 rounded-lg">
                <Checkbox
                  id="use-custom"
                  checked={useCustomTaxonomy}
                  onCheckedChange={toggleCustomTaxonomy}
                />
                <Label
                  htmlFor="use-custom"
                  className="text-sm font-medium cursor-pointer"
                >
                  Use custom taxonomy configuration (default: automatic tree generation)
                </Label>
              </div>

              {useCustomTaxonomy && (
                <>
                  {/* Info Box */}
                  <div className="p-4 bg-primary/10 border border-primary/20 rounded-lg">
                    <p className="text-sm">
                      <strong>Configure up to 3 taxonomy levels.</strong> Select the property to use for each level.
                      The tree will be built automatically based on your selections.
                    </p>
                  </div>

                  {/* Levels */}
                  <div className="space-y-4">
                    {levels.map((level, index) => (
                      <motion.div
                        key={level.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="p-4 border rounded-lg bg-card"
                      >
                        <div className="flex items-center gap-4">
                          <Badge variant="outline" className="shrink-0">Level {index + 1}</Badge>
                          
                          <div className="flex-1">
                            <Select
                              value={level.property}
                              onValueChange={(value) => updateLevel(level.id, value)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select property" />
                              </SelectTrigger>
                              <SelectContent>
                                {level.property && (
                                  <SelectItem value={level.property}>
                                    {level.property}
                                  </SelectItem>
                                )}
                                {availableForSelection.map((prop) => (
                                  <SelectItem key={prop} value={prop}>
                                    {prop}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeLevel(level.id)}
                            className="shrink-0"
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </motion.div>
                    ))}

                    {/* Add Level Button */}
                    {levels.length < 3 && (
                      <Button
                        variant="outline"
                        onClick={addLevel}
                        className="w-full"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add Taxonomy Level ({levels.length}/3)
                      </Button>
                    )}

                    {levels.length === 0 && (
                      <div className="p-8 text-center text-muted-foreground border-2 border-dashed rounded-lg">
                        <Settings className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>No taxonomy levels configured.</p>
                        <p className="text-sm">Click "Add Taxonomy Level" to start.</p>
                      </div>
                    )}
                  </div>
                </>
              )}

              {!useCustomTaxonomy && (
                <div className="p-8 text-center text-muted-foreground border rounded-lg bg-muted/20">
                  <p className="text-sm">
                    Using automatic taxonomy tree generation based on data analysis.
                  </p>
                  <p className="text-xs mt-2">
                    Enable custom configuration above to manually select taxonomy properties.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </Card>
    </motion.div>
  );
};
