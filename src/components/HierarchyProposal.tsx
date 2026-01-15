import { useState, useMemo, useCallback, memo } from 'react';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronRight, ChevronDown, Database, Layers, Tag, Pencil, Check, X, ArrowUpDown, AlertTriangle } from 'lucide-react';
import { HierarchyLevel } from '@/types';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface HierarchyProposalProps {
  hierarchy: HierarchyLevel[];
  properties: string[];
  propertiesWithoutValues?: string[];
  onHierarchyChange?: (newHierarchy: HierarchyLevel[]) => void;
}

export const HierarchyProposal = memo(({ hierarchy, properties, propertiesWithoutValues = [], onHierarchyChange }: HierarchyProposalProps) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [editingLevel, setEditingLevel] = useState<number | null>(null);
  const [editingField, setEditingField] = useState<'recordId' | 'recordName' | null>(null);
  const [movingProperty, setMovingProperty] = useState<{ property: string; fromLevel: number } | null>(null);

  // Get all properties from all levels (headers + recordId + recordName) - memoized for performance
  const allProperties = useMemo(() => {
    const allProps: { property: string; level: number; levelName: string }[] = [];
    
    hierarchy.forEach(level => {
      // Add headers
      level.headers.forEach(header => {
        allProps.push({ property: header, level: level.level, levelName: level.name });
      });
      // Add recordId if exists and not already in headers
      if (level.recordId && !level.headers.includes(level.recordId)) {
        allProps.push({ property: level.recordId, level: level.level, levelName: level.name });
      }
      // Add recordName if exists and not already in headers
      if (level.recordName && !level.headers.includes(level.recordName) && level.recordName !== level.recordId) {
        allProps.push({ property: level.recordName, level: level.level, levelName: level.name });
      }
    });
    
    return allProps;
  }, [hierarchy]);

  // Handle property selection for Record ID or Record Name
  const handlePropertySelect = (levelIndex: number, field: 'recordId' | 'recordName', newProperty: string) => {
    if (!onHierarchyChange) return;
    
    const newHierarchy = JSON.parse(JSON.stringify(hierarchy)) as HierarchyLevel[];
    const targetLevel = newHierarchy[levelIndex];
    const oldProperty = field === 'recordId' ? targetLevel.recordId : targetLevel.recordName;
    
    // Find which level the new property comes from
    let sourceLevel: HierarchyLevel | null = null;
    let sourceLevelIndex = -1;
    
    for (let i = 0; i < newHierarchy.length; i++) {
      const level = newHierarchy[i];
      if (level.headers.includes(newProperty)) {
        sourceLevel = level;
        sourceLevelIndex = i;
        break;
      }
      if (level.recordId === newProperty || level.recordName === newProperty) {
        sourceLevel = level;
        sourceLevelIndex = i;
        break;
      }
    }
    
    // Remove new property from its source location
    if (sourceLevel) {
      // Remove from headers
      sourceLevel.headers = sourceLevel.headers.filter(h => h !== newProperty);
      
      // If it was a recordId in source, auto-select a new one from remaining headers
      if (sourceLevel.recordId === newProperty) {
        // Find a new Record ID from remaining headers
        const idKeywords = ['id', 'code', 'key', 'number', 'sku', 'ean', 'gtin'];
        const newRecordId = sourceLevel.headers.find((h: string) => {
          const lower = h.toLowerCase();
          return idKeywords.some(kw => lower.includes(kw));
        }) || sourceLevel.headers[0]; // Fallback to first header
        
        if (newRecordId) {
          sourceLevel.recordId = newRecordId;
          sourceLevel.headers = sourceLevel.headers.filter(h => h !== newRecordId);
        } else {
          sourceLevel.recordId = undefined;
        }
      }
      
      // If it was a recordName in source, auto-select a new one from remaining headers
      if (sourceLevel.recordName === newProperty) {
        // Find a new Record Name from remaining headers
        const nameKeywords = ['name', 'description', 'title', 'label'];
        const newRecordName = sourceLevel.headers.find((h: string) => {
          const lower = h.toLowerCase();
          return nameKeywords.some(kw => lower.includes(kw));
        });
        
        if (newRecordName) {
          sourceLevel.recordName = newRecordName;
          sourceLevel.headers = sourceLevel.headers.filter(h => h !== newRecordName);
        } else {
          sourceLevel.recordName = undefined;
        }
      }
    }
    
    // Add old property back to target level's headers (if it exists)
    if (oldProperty && !targetLevel.headers.includes(oldProperty)) {
      targetLevel.headers.push(oldProperty);
    }
    
    // Set new property as recordId or recordName
    if (field === 'recordId') {
      targetLevel.recordId = newProperty;
    } else {
      targetLevel.recordName = newProperty;
    }
    
    // Remove new property from target level's headers (since it's now recordId/recordName)
    targetLevel.headers = targetLevel.headers.filter(h => h !== newProperty);
    
    // Close editing mode
    setEditingLevel(null);
    setEditingField(null);
    
    // Notify parent
    onHierarchyChange(newHierarchy);
  };

  const startEditing = (levelIndex: number, field: 'recordId' | 'recordName') => {
    setEditingLevel(levelIndex);
    setEditingField(field);
  };

  const cancelEditing = () => {
    setEditingLevel(null);
    setEditingField(null);
  };

  // Handle moving a property from one level to another
  const handleMoveProperty = (property: string, fromLevelIndex: number, toLevelIndex: number) => {
    if (!onHierarchyChange || fromLevelIndex === toLevelIndex) return;
    
    const newHierarchy = JSON.parse(JSON.stringify(hierarchy)) as HierarchyLevel[];
    const sourceLevel = newHierarchy[fromLevelIndex];
    const targetLevel = newHierarchy[toLevelIndex];
    
    // Remove property from source level
    sourceLevel.headers = sourceLevel.headers.filter((h: string) => h !== property);
    
    // Add property to target level (if not already there)
    if (!targetLevel.headers.includes(property)) {
      targetLevel.headers.push(property);
    }
    
    // Close moving mode
    setMovingProperty(null);
    
    // Notify parent
    onHierarchyChange(newHierarchy);
  };

  const startMoving = (property: string, fromLevel: number) => {
    setMovingProperty({ property, fromLevel });
  };

  const cancelMoving = () => {
    setMovingProperty(null);
  };

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

  const getLevelColor = (level: number, totalLevels: number) => {
    // Match colors from Data Pattern Analysis
    // If it's the last level, it's always SKU (red)
    if (level === totalLevels) {
      return 'bg-red-500 text-white';
    }
    
    // Otherwise, map to the 4-level color scheme
    switch (level) {
      case 1:
        return 'bg-blue-500 text-white'; // Level 1: Parent
      case 2:
        return 'bg-green-500 text-white'; // Level 2: Children
      case 3:
        return 'bg-yellow-500 text-white'; // Level 3: Grandchildren
      case 4:
        return 'bg-orange-500 text-white'; // Level 4: Variant
      default:
        return 'bg-gray-500 text-white';
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
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold flex items-center gap-2">
                {isExpanded ? <ChevronDown className="w-6 h-6" /> : <ChevronRight className="w-6 h-6" />}
                Proposed Product Hierarchy
              </h2>
              <Badge variant="secondary" className="text-lg px-4 py-1">
                {(() => {
                  // Count ALL unique properties (headers + Record IDs + Record Names)
                  const allProps = new Set<string>();
                  hierarchy.forEach(level => {
                    level.headers.forEach(h => allProps.add(h));
                    if (level.recordId) allProps.add(level.recordId);
                    if (level.recordName) allProps.add(level.recordName);
                  });
                  return allProps.size;
                })()} properties
              </Badge>
            </div>
            <p className="text-muted-foreground">
              Data hierarchy structure
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
                  
                  <Card className={`flex-1 p-5 ${getLevelColor(level.level, hierarchy.length)} border-none`}>
                    <div className="flex items-center gap-3 mb-3">
                      {getLevelIcon(level.level)}
                      <h3 className="font-semibold text-lg">
                        Level {level.level}: {level.name}
                      </h3>
                      {/* Warning badge for levels with few properties */}
                      {(() => {
                        const totalProps = level.headers.length + (level.recordId ? 1 : 0) + (level.recordName ? 1 : 0);
                        if (totalProps < 6 && index < hierarchy.length - 1) {
                          return (
                            <Badge variant="outline" className="bg-amber-500/20 text-amber-200 border-amber-400/50 text-xs flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              {totalProps} properties
                            </Badge>
                          );
                        }
                        return null;
                      })()}
                    </div>
                    
                    {/* Record ID and Name - MANDATORY for all levels - EDITABLE */}
                    <div className="mb-3 p-3 bg-background/30 rounded-md border border-background/40">
                      <div className="text-xs font-medium text-muted-foreground mb-2">Required for this level:</div>
                      <div className="flex gap-4 text-sm flex-wrap">
                        {/* Record ID */}
                        <div className="flex items-center gap-1">
                          <span className="font-medium">Record ID:</span>
                          {editingLevel === index && editingField === 'recordId' ? (
                            <div className="flex items-center gap-1">
                              <Select
                                value={level.recordId || ''}
                                onValueChange={(value) => handlePropertySelect(index, 'recordId', value)}
                              >
                                <SelectTrigger className="h-7 w-[180px] text-xs bg-white text-gray-900 border-gray-300">
                                  <SelectValue placeholder="Select property..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {hierarchy.map((lvl) => (
                                    <SelectGroup key={lvl.level}>
                                      <SelectLabel className="text-xs">Level {lvl.level}: {lvl.name}</SelectLabel>
                                      {/* Show recordId if exists */}
                                      {lvl.recordId && (
                                        <SelectItem value={lvl.recordId} className="text-xs">
                                          {lvl.recordId} {lvl.recordId === level.recordId ? '(current)' : ''}
                                        </SelectItem>
                                      )}
                                      {/* Show recordName if exists and different from recordId */}
                                      {lvl.recordName && lvl.recordName !== lvl.recordId && (
                                        <SelectItem value={lvl.recordName} className="text-xs">
                                          {lvl.recordName}
                                        </SelectItem>
                                      )}
                                      {/* Show headers */}
                                      {lvl.headers.map((header) => (
                                        <SelectItem key={header} value={header} className="text-xs">
                                          {header}
                                        </SelectItem>
                                      ))}
                                    </SelectGroup>
                                  ))}
                                </SelectContent>
                              </Select>
                              <button
                                onClick={cancelEditing}
                                className="p-1 hover:bg-background/50 rounded"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1">
                              {level.recordId ? (
                                <Badge variant="secondary" className="ml-1">{level.recordId}</Badge>
                              ) : (
                                <Badge variant="destructive" className="ml-1">⚠️ Not set</Badge>
                              )}
                              {onHierarchyChange && (
                                <button
                                  onClick={() => startEditing(index, 'recordId')}
                                  className="p-1 hover:bg-background/50 rounded ml-1"
                                  title="Edit Record ID"
                                >
                                  <Pencil className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                        
                        {/* Record Name */}
                        <div className="flex items-center gap-1">
                          <span className="font-medium">Record Name:</span>
                          {editingLevel === index && editingField === 'recordName' ? (
                            <div className="flex items-center gap-1">
                              <Select
                                value={level.recordName || ''}
                                onValueChange={(value) => handlePropertySelect(index, 'recordName', value)}
                              >
                                <SelectTrigger className="h-7 w-[180px] text-xs bg-white text-gray-900 border-gray-300">
                                  <SelectValue placeholder="Select property..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {hierarchy.map((lvl) => (
                                    <SelectGroup key={lvl.level}>
                                      <SelectLabel className="text-xs">Level {lvl.level}: {lvl.name}</SelectLabel>
                                      {/* Show recordId if exists */}
                                      {lvl.recordId && (
                                        <SelectItem value={lvl.recordId} className="text-xs">
                                          {lvl.recordId}
                                        </SelectItem>
                                      )}
                                      {/* Show recordName if exists and different from recordId */}
                                      {lvl.recordName && lvl.recordName !== lvl.recordId && (
                                        <SelectItem value={lvl.recordName} className="text-xs">
                                          {lvl.recordName} {lvl.recordName === level.recordName ? '(current)' : ''}
                                        </SelectItem>
                                      )}
                                      {/* Show headers */}
                                      {lvl.headers.map((header) => (
                                        <SelectItem key={header} value={header} className="text-xs">
                                          {header}
                                        </SelectItem>
                                      ))}
                                    </SelectGroup>
                                  ))}
                                </SelectContent>
                              </Select>
                              <button
                                onClick={cancelEditing}
                                className="p-1 hover:bg-background/50 rounded"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1">
                              {level.recordName ? (
                                <Badge variant="secondary" className="ml-1">{level.recordName}</Badge>
                              ) : (
                                <Badge variant="destructive" className="ml-1">⚠️ Not set</Badge>
                              )}
                              {onHierarchyChange && (
                                <button
                                  onClick={() => startEditing(index, 'recordName')}
                                  className="p-1 hover:bg-background/50 rounded ml-1"
                                  title="Edit Record Name"
                                >
                                  <Pencil className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap gap-2">
                      {level.headers.map((header) => (
                        <div key={header} className="relative group">
                          {movingProperty?.property === header && movingProperty?.fromLevel === index ? (
                            // Show level selector when moving this property
                            <div className="flex items-center gap-1 bg-white rounded-md p-1 shadow-md">
                              <span className="text-xs text-gray-700 px-1">{header}</span>
                              <Select
                                onValueChange={(value) => handleMoveProperty(header, index, parseInt(value))}
                              >
                                <SelectTrigger className="h-6 w-[100px] text-xs bg-white text-gray-900 border-gray-300">
                                  <SelectValue placeholder="Move to..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {hierarchy.map((lvl, lvlIndex) => (
                                    lvlIndex !== index && (
                                      <SelectItem key={lvl.level} value={lvlIndex.toString()} className="text-xs">
                                        L{lvl.level}: {lvl.name}
                                      </SelectItem>
                                    )
                                  ))}
                                </SelectContent>
                              </Select>
                              <button
                                onClick={cancelMoving}
                                className="p-1 hover:bg-gray-100 rounded"
                              >
                                <X className="w-3 h-3 text-gray-600" />
                              </button>
                            </div>
                          ) : (
                            // Normal badge with move button on hover
                            <Badge 
                              variant="outline"
                              className="bg-background/20 border-background/30 pr-1 flex items-center gap-1"
                            >
                              {header}
                              {onHierarchyChange && hierarchy.length > 1 && (
                                <button
                                  onClick={() => startMoving(header, index)}
                                  className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-background/50 rounded transition-opacity"
                                  title="Move to another level"
                                >
                                  <ArrowUpDown className="w-3 h-3" />
                                </button>
                              )}
                            </Badge>
                          )}
                        </div>
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
});
