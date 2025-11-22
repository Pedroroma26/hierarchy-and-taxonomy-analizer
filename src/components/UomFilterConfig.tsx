import { useState } from 'react';
import { motion } from 'framer-motion';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { X, Plus, Filter } from 'lucide-react';
import { ScrollArea } from './ui/scroll-area';

interface UomFilterConfigProps {
  headers: string[];
  onConfigChange: (excludedFields: string[]) => void;
}

const DEFAULT_UOM_KEYWORDS = [
  'uom', 'unit', 'measure', 'measurement', 'dimension',
  'weight', 'height', 'width', 'depth', 'length', 'size'
];

export const UomFilterConfig = ({ headers, onConfigChange }: UomFilterConfigProps) => {
  const [customKeywords, setCustomKeywords] = useState<string[]>([]);
  const [newKeyword, setNewKeyword] = useState('');
  const [excludedHeaders, setExcludedHeaders] = useState<Set<string>>(new Set());

  // Detect headers that match UOM keywords
  const getMatchingHeaders = () => {
    const allKeywords = [...DEFAULT_UOM_KEYWORDS, ...customKeywords];
    return headers.filter(header => {
      const headerLower = header.toLowerCase();
      return allKeywords.some(keyword => headerLower.includes(keyword.toLowerCase()));
    });
  };

  const matchingHeaders = getMatchingHeaders();

  const addCustomKeyword = () => {
    const trimmed = newKeyword.trim().toLowerCase();
    if (trimmed && !customKeywords.includes(trimmed) && !DEFAULT_UOM_KEYWORDS.includes(trimmed)) {
      const updated = [...customKeywords, trimmed];
      setCustomKeywords(updated);
      setNewKeyword('');
      updateExcludedFields(updated);
    }
  };

  const removeCustomKeyword = (keyword: string) => {
    const updated = customKeywords.filter(k => k !== keyword);
    setCustomKeywords(updated);
    updateExcludedFields(updated);
  };

  const toggleHeaderExclusion = (header: string) => {
    const newExcluded = new Set(excludedHeaders);
    if (newExcluded.has(header)) {
      newExcluded.delete(header);
    } else {
      newExcluded.add(header);
    }
    setExcludedHeaders(newExcluded);
    onConfigChange(Array.from(newExcluded));
  };

  const updateExcludedFields = (keywords: string[]) => {
    const allKeywords = [...DEFAULT_UOM_KEYWORDS, ...keywords];
    const matching = headers.filter(header => {
      const headerLower = header.toLowerCase();
      return allKeywords.some(keyword => headerLower.includes(keyword.toLowerCase()));
    });
    const newExcluded = new Set(matching);
    setExcludedHeaders(newExcluded);
    onConfigChange(Array.from(newExcluded));
  };

  const selectAllMatching = () => {
    const newExcluded = new Set(matchingHeaders);
    setExcludedHeaders(newExcluded);
    onConfigChange(Array.from(newExcluded));
  };

  const clearAll = () => {
    setExcludedHeaders(new Set());
    onConfigChange([]);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
    >
      <Card className="p-6 shadow-elevated">
        <div className="space-y-6">
          {/* Header */}
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Filter className="w-6 h-6 text-primary" />
              <h2 className="text-2xl font-semibold">UOM & Measurement Filter</h2>
            </div>
            <p className="text-muted-foreground">
              Exclude measurement and unit fields from taxonomy tree visualization
            </p>
          </div>

          {/* Default Keywords */}
          <div>
            <h3 className="font-semibold mb-3">Default Keywords (Auto-excluded)</h3>
            <div className="flex flex-wrap gap-2">
              {DEFAULT_UOM_KEYWORDS.map(keyword => (
                <Badge key={keyword} variant="secondary" className="text-xs">
                  {keyword}
                </Badge>
              ))}
            </div>
          </div>

          {/* Custom Keywords */}
          <div>
            <h3 className="font-semibold mb-3">Custom Keywords</h3>
            <div className="flex gap-2 mb-3">
              <Input
                placeholder="Add custom keyword (e.g., 'volume', 'capacity')"
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addCustomKeyword()}
              />
              <Button onClick={addCustomKeyword} size="sm">
                <Plus className="w-4 h-4 mr-1" />
                Add
              </Button>
            </div>
            
            {customKeywords.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {customKeywords.map(keyword => (
                  <Badge key={keyword} variant="default" className="text-xs gap-1">
                    {keyword}
                    <button
                      onClick={() => removeCustomKeyword(keyword)}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Matching Headers */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">
                Detected Fields ({matchingHeaders.length})
              </h3>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={selectAllMatching}>
                  Select All
                </Button>
                <Button variant="outline" size="sm" onClick={clearAll}>
                  Clear All
                </Button>
              </div>
            </div>

            {matchingHeaders.length > 0 ? (
              <ScrollArea className="h-[200px] rounded-lg border p-4">
                <div className="space-y-2">
                  {matchingHeaders.map(header => (
                    <div
                      key={header}
                      className="flex items-center justify-between p-2 rounded hover:bg-muted/50 transition-colors"
                    >
                      <span className="text-sm font-medium">{header}</span>
                      <Button
                        variant={excludedHeaders.has(header) ? 'destructive' : 'outline'}
                        size="sm"
                        onClick={() => toggleHeaderExclusion(header)}
                      >
                        {excludedHeaders.has(header) ? 'Excluded' : 'Include'}
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No matching fields detected
              </div>
            )}
          </div>

          {/* Summary */}
          <div className="p-4 rounded-lg bg-muted/50 border">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Fields to exclude from taxonomy tree:</span>
              <Badge variant="secondary">
                {excludedHeaders.size} excluded
              </Badge>
            </div>
            {excludedHeaders.size > 0 && (
              <div className="mt-2 text-xs text-muted-foreground">
                {Array.from(excludedHeaders).slice(0, 5).join(', ')}
                {excludedHeaders.size > 5 && ` ... and ${excludedHeaders.size - 5} more`}
              </div>
            )}
          </div>
        </div>
      </Card>
    </motion.div>
  );
};
