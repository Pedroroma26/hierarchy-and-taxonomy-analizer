import { useState } from 'react';
import { motion, Reorder } from 'framer-motion';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { HierarchyLevel } from './HierarchyProposal';
import { GripVertical, Plus, Trash2, Eye, LayoutGrid } from 'lucide-react';
import { ScrollArea } from './ui/scroll-area';

interface InteractiveHierarchyBuilderProps {
  availableHeaders: string[];
  initialHierarchy: HierarchyLevel[];
  onPreview: (hierarchy: HierarchyLevel[]) => void;
  onApply: (hierarchy: HierarchyLevel[]) => void;
}

export const InteractiveHierarchyBuilder = ({
  availableHeaders,
  initialHierarchy,
  onPreview,
  onApply,
}: InteractiveHierarchyBuilderProps) => {
  const [hierarchy, setHierarchy] = useState<HierarchyLevel[]>(initialHierarchy);
  const [unassignedHeaders, setUnassignedHeaders] = useState<string[]>(
    availableHeaders.filter(
      h => !initialHierarchy.some(level => level.headers.includes(h))
    )
  );

  const addLevel = () => {
    const newLevel: HierarchyLevel = {
      level: hierarchy.length + 1,
      name: `Level ${hierarchy.length + 1}`,
      headers: [],
    };
    setHierarchy([...hierarchy, newLevel]);
  };

  const removeLevel = (levelIndex: number) => {
    const removedHeaders = hierarchy[levelIndex].headers;
    setUnassignedHeaders([...unassignedHeaders, ...removedHeaders]);
    setHierarchy(hierarchy.filter((_, idx) => idx !== levelIndex)
      .map((level, idx) => ({ ...level, level: idx + 1, name: `Level ${idx + 1}` })));
  };

  const addHeaderToLevel = (header: string, levelIndex: number) => {
    const newHierarchy = [...hierarchy];
    newHierarchy[levelIndex].headers.push(header);
    setHierarchy(newHierarchy);
    setUnassignedHeaders(unassignedHeaders.filter(h => h !== header));
  };

  const removeHeaderFromLevel = (header: string, levelIndex: number) => {
    const newHierarchy = [...hierarchy];
    newHierarchy[levelIndex].headers = newHierarchy[levelIndex].headers.filter(h => h !== header);
    setHierarchy(newHierarchy);
    setUnassignedHeaders([...unassignedHeaders, header]);
  };

  const reorderLevels = (newOrder: HierarchyLevel[]) => {
    setHierarchy(newOrder.map((level, idx) => ({ 
      ...level, 
      level: idx + 1,
      name: `Level ${idx + 1}` 
    })));
  };

  return (
    <Card className="p-6 shadow-elevated">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="space-y-6"
      >
        <div>
          <div className="flex items-center gap-3 mb-2">
            <LayoutGrid className="w-6 h-6 text-primary" />
            <h2 className="text-2xl font-semibold">Interactive Hierarchy Builder</h2>
          </div>
          <p className="text-muted-foreground">
            Drag fields to reorder levels, add or remove fields to test different structures
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Available Headers */}
          <Card className="p-4 bg-muted/30">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Badge variant="secondary">{unassignedHeaders.length}</Badge>
              Available Fields
            </h3>
            <ScrollArea className="h-[400px]">
              <div className="space-y-2">
                {unassignedHeaders.map((header) => (
                  <motion.div
                    key={header}
                    layout
                    className="p-2 rounded-md bg-background border hover:border-primary cursor-pointer text-sm"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {header}
                  </motion.div>
                ))}
              </div>
            </ScrollArea>
          </Card>

          {/* Hierarchy Levels */}
          <Card className="p-4 md:col-span-2">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Hierarchy Structure</h3>
              <Button onClick={addLevel} size="sm" variant="outline" className="gap-2">
                <Plus className="w-4 h-4" />
                Add Level
              </Button>
            </div>
            
            <ScrollArea className="h-[400px]">
              <Reorder.Group
                axis="y"
                values={hierarchy}
                onReorder={reorderLevels}
                className="space-y-3"
              >
                {hierarchy.map((level, levelIndex) => (
                  <Reorder.Item key={level.level} value={level}>
                    <Card className="p-4 bg-muted/50 cursor-move">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <GripVertical className="w-4 h-4 text-muted-foreground" />
                          <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-medium">
                            {level.level}
                          </div>
                          <span className="font-medium">{level.name}</span>
                        </div>
                        <Button
                          onClick={() => removeLevel(levelIndex)}
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>

                      <div className="space-y-2">
                        {level.headers.map((header) => (
                          <motion.div
                            key={header}
                            layout
                            className="flex items-center justify-between p-2 rounded-md bg-background text-sm"
                          >
                            <span>{header}</span>
                            <Button
                              onClick={() => removeHeaderFromLevel(header, levelIndex)}
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </motion.div>
                        ))}
                        
                        {unassignedHeaders.length > 0 && (
                          <select
                            className="w-full p-2 rounded-md bg-background border text-sm"
                            onChange={(e) => {
                              if (e.target.value) {
                                addHeaderToLevel(e.target.value, levelIndex);
                                e.target.value = '';
                              }
                            }}
                            defaultValue=""
                          >
                            <option value="">+ Add field...</option>
                            {unassignedHeaders.map((header) => (
                              <option key={header} value={header}>
                                {header}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    </Card>
                  </Reorder.Item>
                ))}
              </Reorder.Group>
            </ScrollArea>
          </Card>
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t">
          <Button onClick={() => onPreview(hierarchy)} variant="outline" className="gap-2">
            <Eye className="w-4 h-4" />
            Preview Taxonomy
          </Button>
          <Button onClick={() => onApply(hierarchy)} className="gap-2">
            Apply This Structure
          </Button>
        </div>
      </motion.div>
    </Card>
  );
};
