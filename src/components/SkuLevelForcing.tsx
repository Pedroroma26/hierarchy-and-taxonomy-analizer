import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChevronDown, ChevronRight, Package, Ruler, Truck, Salad, Settings, Tag, RefreshCw } from 'lucide-react';
import { detectUomAndLogistics } from '@/utils/analysisEngine';
import { HierarchyLevel } from '@/types';

interface SkuLevelForcingProps {
  headers: string[];
  currentHierarchy: HierarchyLevel[];
  onApply: (forcedHeaders: string[]) => void;
}

// Property groups with detection keywords
const propertyGroups = {
  skuIds: {
    name: 'SKU Identifiers',
    description: 'Product codes, barcodes, and unique identifiers',
    keywords: [
      // Basic identifiers
      'sku', 'ean', 'gtin', 'upc', 'barcode', 'material number', 'product id', 'article number', 'item id', 
      'zuc', 'zun', 'asin', 'isbn',
      // GDSN identifiers
      'gln', 'global location number', 'gpc', 'global product classification',
      'trade item', 'consumer unit', 'base unit', 'each unit',
      'sellable unit', 'orderable unit', 'despatch unit',
      // Additional codes
      'ndc', 'national drug code', 'plu', 'price look up',
      'item reference', 'supplier item', 'buyer item', 'retailer item'
    ],
    icon: Tag,
    color: 'bg-blue-500'
  },
  measurements: {
    name: 'Measurements & UoM',
    description: 'Dimensions, weights, volumes, and units of measure',
    keywords: [
      // Basic measurements
      'weight', 'height', 'width', 'length', 'depth', 'volume', 'capacity', 
      'liter', 'litre', 'litros', 'ml', 'milliliter',
      'unit of measure', 'uom', 'dimension', 'size', 'density', 'densidade',
      // GDSN measurements
      'net content', 'net weight', 'gross weight', 'drained weight', 'tare weight',
      'net volume', 'gross volume',
      'unit descriptor', 'measurement precision',
      // Packaging dimensions
      'inner pack', 'outer pack', 'display unit',
      'consumer unit size', 'trade item unit',
      // Additional measurements
      'diameter', 'circumference', 'thickness', 'gauge',
      'serving size', 'portion size', 'dose'
    ],
    icon: Ruler,
    color: 'bg-green-500'
  },
  logistics: {
    name: 'Logistics & Inventory',
    description: 'Stock, packaging, and supply chain information',
    keywords: [
      // Basic logistics
      'quantity', 'qty', 'stock', 'inventory', 'warehouse', 'pallet', 'package', 'packaging',
      'cases per', 'units per', 'lead time', 'delivery', 'batch', 'lot', 'serial',
      'lay', 'layers', 'cs', 'case', 'cv', 'type support', 'type of support', 
      'pal', 'car', 'pack type', 'packing type', 'packaging type',
      // GDSN logistics
      'ordering unit', 'minimum order', 'order quantity increment',
      'pallet quantity', 'pallet ti', 'pallet hi', 'ti hi',
      'inner pack quantity', 'outer pack quantity',
      'display shipper', 'retail ready packaging',
      // Supply chain
      'moq', 'minimum order quantity', 'order multiple',
      'replenishment', 'safety stock', 'reorder point',
      'incoterms', 'shipping terms', 'freight class',
      // Packaging hierarchy
      'each', 'inner', 'case', 'pallet', 'container',
      'base unit', 'next level', 'packaging level',
      'nesting', 'stacking factor'
    ],
    icon: Truck,
    color: 'bg-yellow-500'
  },
  nutrition: {
    name: 'Nutrition & Allergens',
    description: 'Nutritional facts, ingredients, and allergen information',
    keywords: [
      // Basic nutrition
      'nutrition', 'nutritional', 'calories', 'protein', 'carbohydrate', 'fat', 
      'allergen', 'allergy', 'ingredient', 'gluten', 'dairy', 
      'serving size', 'vitamin', 'mineral',
      // Regulations
      'info 1169', 'fir', 'regulation 1169', 'reg 1169', 'eu 1169',
      // GDSN nutrition
      'nutrient', 'nutrient basis', 'daily value', 'rda', 'recommended daily allowance',
      'energy', 'kcal', 'kj', 'kilojoule',
      'sugar', 'salt', 'sodium', 'fiber', 'fibre',
      'saturated fat', 'trans fat', 'polyunsaturated', 'monounsaturated',
      // Allergens
      'contains', 'may contain', 'free from', 'traces of',
      'peanut', 'tree nut', 'soy', 'wheat', 'egg', 'milk',
      'fish', 'shellfish', 'sesame', 'sulfite', 'celery', 'mustard', 'lupin',
      // Dietary
      'vegan', 'vegetarian', 'organic', 'kosher', 'halal',
      'gluten free', 'lactose free', 'sugar free', 'fat free',
      'non-gmo', 'gmo free',
      // Flavour & Taste
      'flavour', 'flavor', 'taste', 'aroma', 'scent', 'fragrance',
      'type of drink', 'drink type', 'beverage type'
    ],
    icon: Salad,
    color: 'bg-orange-500'
  },
  technical: {
    name: 'Technical Specs & Dates',
    description: 'Specifications, compliance, dates, and technical details',
    keywords: [
      // Basic technical
      'specification', 'spec', 'compliance', 'certification', 'temperature', 
      'shelf life', 'price', 'cost', 'msrp',
      'starting date', 'order dispatch', 'dispatch', 'created on', 
      'stackability', 'storage conditions', 'storage', 'conditions',
      // GDSN technical
      'target market', 'country of origin', 'country of sale',
      'brand owner', 'manufacturer', 'supplier', 'importer',
      'gdsn publication', 'data source', 'gdsn recipient',
      'effective date', 'end availability', 'discontinuation date',
      // Dates
      'creation date', 'modified date', 'last change', 'publication date',
      'expiry', 'expiration', 'best before', 'use by', 'validade',
      'production date', 'manufacture date', 'packaging date',
      'valid from', 'valid to', 'validity', 'valid', 'validation date', 
      // Storage & handling
      'min temperature', 'max temperature', 'temperature range',
      'storage instructions', 'handling instructions',
      'refrigerate', 'freeze', 'keep cool', 'keep dry',
      'ambient', 'room temperature', 'controlled temperature',
      // Compliance & certification
      'regulatory', 'legal', 'standard', 'iso', 'haccp',
      'fda', 'usda', 'eu regulation', 'prop 65',
      'safety data sheet', 'sds', 'msds',
      'certificate of analysis', 'coa',
      // Product lifecycle
      'new product', 'discontinued', 'phase out', 'replacement',
      'seasonal', 'limited edition', 'promotional'
    ],
    icon: Settings,
    color: 'bg-purple-500'
  }
};

export const SkuLevelForcing = ({ headers, currentHierarchy, onApply }: SkuLevelForcingProps) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
  const [manuallySelected, setManuallySelected] = useState<Set<string>>(new Set());
  const [excludedFromGroups, setExcludedFromGroups] = useState<Set<string>>(new Set());

  // Get properties currently NOT in SKU-level (lowest level)
  // These are the ONLY properties that should be available for forcing
  // MOVED UP: This needs to be calculated before propertyGroupMapping
  const nonSkuProperties = useMemo(() => {
    const skuLevel = currentHierarchy[currentHierarchy.length - 1];
    if (!skuLevel) return [];  // No hierarchy = nothing to force
    
    // If only 1 level (Flat Model), all properties are at SKU level already
    if (currentHierarchy.length === 1) return [];
    
    // Get all properties in the SKU level (headers + recordId + recordName)
    const skuLevelProperties = new Set([
      ...skuLevel.headers,
      skuLevel.recordId,
      skuLevel.recordName
    ].filter(Boolean));
    
    // Return only properties that are NOT in the SKU level
    return headers.filter(h => !skuLevelProperties.has(h));
  }, [headers, currentHierarchy]);

  // Detect which properties belong to which groups
  // CRITICAL: Only map from nonSkuProperties, not all headers
  const propertyGroupMapping = useMemo(() => {
    const mapping: Record<string, string[]> = {};
    
    Object.entries(propertyGroups).forEach(([groupKey, group]) => {
      // Only include properties that are NOT already at SKU level
      mapping[groupKey] = nonSkuProperties.filter(header => {
        const headerLower = header.toLowerCase();
        return group.keywords.some(kw => headerLower.includes(kw));
      });
    });
    
    return mapping;
  }, [nonSkuProperties]);

  // Get properties that will be forced to SKU-level
  const forcedProperties = useMemo(() => {
    const forced = new Set<string>();
    
    // Add properties from selected groups (excluding manually excluded ones)
    selectedGroups.forEach(groupKey => {
      propertyGroupMapping[groupKey]?.forEach(prop => {
        if (!excludedFromGroups.has(prop)) {
          forced.add(prop);
        }
      });
    });
    
    // Add manually selected properties
    manuallySelected.forEach(prop => forced.add(prop));
    
    return Array.from(forced);
  }, [selectedGroups, manuallySelected, excludedFromGroups, propertyGroupMapping]);

  // Get properties that are candidates for forcing (not already in SKU)
  const candidateProperties = useMemo(() => {
    return nonSkuProperties.filter(h => !forcedProperties.includes(h));
  }, [nonSkuProperties, forcedProperties]);

  const toggleGroup = (groupKey: string) => {
    const newSelected = new Set(selectedGroups);
    if (newSelected.has(groupKey)) {
      newSelected.delete(groupKey);
    } else {
      newSelected.add(groupKey);
    }
    setSelectedGroups(newSelected);
  };

  const toggleProperty = (property: string) => {
    const newSelected = new Set(manuallySelected);
    if (newSelected.has(property)) {
      newSelected.delete(property);
    } else {
      newSelected.add(property);
    }
    setManuallySelected(newSelected);
  };

  const handleApply = () => {
    onApply(forcedProperties);
  };

  const selectAllGroups = () => {
    setSelectedGroups(new Set(Object.keys(propertyGroups)));
  };

  const deselectAllGroups = () => {
    setSelectedGroups(new Set());
    setManuallySelected(new Set());
    setExcludedFromGroups(new Set());
  };

  const removeFromForced = (prop: string) => {
    // Check if this property came from a group
    const isFromGroup = Array.from(selectedGroups).some(groupKey => 
      propertyGroupMapping[groupKey]?.includes(prop)
    );
    
    if (isFromGroup) {
      // Add to exclusion list
      const newExcluded = new Set(excludedFromGroups);
      newExcluded.add(prop);
      setExcludedFromGroups(newExcluded);
    }
    
    // Also remove from manual selection if it's there
    if (manuallySelected.has(prop)) {
      toggleProperty(prop);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
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
                <Package className="w-6 h-6 text-primary" />
                Force Properties to SKU-Level
              </h2>
              <Badge variant="secondary" className="text-lg px-4 py-1">
                {forcedProperties.length} properties selected
              </Badge>
            </div>
            <p className="text-muted-foreground mt-2">
              Select property groups or individual properties to force to the SKU-level (lowest level) in the hierarchy
            </p>
          </div>

          {isExpanded && (
            <>
              {/* Show message if no properties available to force (Flat Model or all at SKU) */}
              {nonSkuProperties.length === 0 ? (
                <div className="p-6 text-center bg-muted/30 rounded-lg border border-dashed">
                  <Package className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                  <h3 className="text-lg font-semibold text-muted-foreground">
                    All properties are already at SKU-level
                  </h3>
                  <p className="text-sm text-muted-foreground mt-2">
                    {currentHierarchy.length === 1 
                      ? 'This is a Flat Model with all properties at the lowest level.'
                      : 'All properties are already assigned to the SKU-level (lowest level) in this hierarchy.'}
                  </p>
                </div>
              ) : (
              <>
              {/* Property Groups */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Property Groups</h3>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={selectAllGroups}
                      className="gap-2"
                    >
                      Select All Groups
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={deselectAllGroups}
                      className="gap-2"
                    >
                      Clear All
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Object.entries(propertyGroups).map(([groupKey, group]) => {
                    const Icon = group.icon;
                    const propertiesInGroup = propertyGroupMapping[groupKey] || [];
                    const isSelected = selectedGroups.has(groupKey);
                    
                    return (
                      <motion.div
                        key={groupKey}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <Card
                          className={`p-4 cursor-pointer transition-all ${
                            isSelected 
                              ? 'ring-2 ring-primary bg-primary/5' 
                              : 'hover:bg-muted/50'
                          }`}
                          onClick={() => toggleGroup(groupKey)}
                        >
                          <div className="flex items-start gap-3">
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleGroup(groupKey)}
                              onClick={(e) => e.stopPropagation()}
                              className="mt-1"
                            />
                            <div className="flex-1 space-y-2">
                              <div className="flex items-center gap-2">
                                <Icon className={`w-5 h-5 text-white p-1 rounded ${group.color}`} />
                                <h4 className="font-semibold">{group.name}</h4>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {group.description}
                              </p>
                              <Badge variant="secondary" className="text-xs">
                                {propertiesInGroup.length} properties
                              </Badge>
                            </div>
                          </div>
                        </Card>
                      </motion.div>
                    );
                  })}
                </div>
              </div>

              {/* Properties to be forced - EDITABLE */}
              {forcedProperties.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold">
                    Properties that will be forced to SKU-level ({forcedProperties.length})
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Click on a property to remove it from the forced list
                  </p>
                  <ScrollArea className="h-[200px] rounded-lg border p-4 bg-muted/20">
                    <div className="flex flex-wrap gap-2">
                      {forcedProperties.map(prop => {
                        return (
                          <Badge 
                            key={prop} 
                            variant="secondary" 
                            className="text-xs cursor-pointer hover:bg-destructive/20 hover:line-through transition-all group"
                            onClick={() => removeFromForced(prop)}
                            title="Click to remove from forced list"
                          >
                            {prop}
                            <span className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity">×</span>
                          </Badge>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </div>
              )}

              {/* Manual property selection */}
              {candidateProperties.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold">
                    Additional Properties (not in selected groups)
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Select individual properties to force to SKU-level
                  </p>
                  <ScrollArea className="h-[300px] rounded-lg border p-4 bg-muted/20">
                    <div className="space-y-2">
                      {candidateProperties.map(prop => {
                        const isSelected = manuallySelected.has(prop);
                        return (
                          <div
                            key={prop}
                            className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-all ${
                              isSelected ? 'bg-primary/10' : 'hover:bg-muted'
                            }`}
                            onClick={() => toggleProperty(prop)}
                          >
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleProperty(prop)}
                              onClick={(e) => e.stopPropagation()}
                            />
                            <span className="text-sm">{prop}</span>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </div>
              )}

              {/* Apply button */}
              <div className="flex justify-end pt-4 border-t">
                <Button
                  onClick={handleApply}
                  disabled={forcedProperties.length === 0}
                  className="gap-2 bg-gradient-primary"
                  size="lg"
                >
                  <RefreshCw className="w-5 h-5" />
                  Apply & Rerun Analysis ({forcedProperties.length} properties)
                </Button>
              </div>
              </>
              )}
            </>
          )}
        </div>
      </Card>
    </motion.div>
  );
};
