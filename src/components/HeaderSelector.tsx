import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, XCircle, Play, Info, AlertCircle } from 'lucide-react';
import { detectUomAndLogistics } from '@/utils/analysisEngine';

interface HeaderSelectorProps {
  headers: string[];
  data: any[][];
  onConfirm: (selectedHeaders: string[]) => void;
}

export const HeaderSelector = ({ headers, data, onConfirm }: HeaderSelectorProps) => {
  // Detect UoM/logistics headers
  const uomHeaders = useMemo(() => {
    return headers.filter(h => detectUomAndLogistics(h));
  }, [headers]);

  // Non-UoM headers selected by default, UoM headers deselected
  const [selectedHeaders, setSelectedHeaders] = useState<Set<string>>(
    new Set(headers.filter(h => !uomHeaders.includes(h)))
  );
  const [hoveredHeader, setHoveredHeader] = useState<string | null>(null);
  const [showUomInfo, setShowUomInfo] = useState(uomHeaders.length > 0);

  const toggleHeader = (header: string) => {
    const newSelected = new Set(selectedHeaders);
    if (newSelected.has(header)) {
      newSelected.delete(header);
    } else {
      newSelected.add(header);
    }
    setSelectedHeaders(newSelected);
  };

  const selectAll = () => {
    setSelectedHeaders(new Set(headers));
  };

  const deselectAll = () => {
    setSelectedHeaders(new Set());
  };

  const enableUomHeaders = () => {
    const newSelected = new Set(selectedHeaders);
    uomHeaders.forEach(h => newSelected.add(h));
    setSelectedHeaders(newSelected);
    setShowUomInfo(false);
  };

  const handleConfirm = () => {
    if (selectedHeaders.size === 0) {
      return;
    }
    onConfirm(Array.from(selectedHeaders));
  };

  // Get sample data for preview (first 10 rows)
  const getSampleData = (headerIndex: number) => {
    return data.slice(0, 10).map(row => row[headerIndex]);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
    >
      <Card className="p-8 shadow-elevated bg-gradient-to-br from-card via-card to-card/80 border-2">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left side: Header selection */}
          <div className="space-y-5 flex flex-col">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                  Select Properties
                </h2>
                <Badge variant="secondary" className="text-sm font-semibold px-3 py-1">
                  {selectedHeaders.size} / {headers.length}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Choose which columns should be included in the taxonomy analysis
              </p>
            </div>

            {showUomInfo && uomHeaders.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                transition={{ duration: 0.3 }}
              >
                <Alert className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-primary/30 shadow-sm">
                  <Info className="h-4 w-4 text-primary" />
                  <AlertDescription className="text-sm">
                    <div className="space-y-3">
                      <p className="font-semibold text-foreground">
                        {uomHeaders.length} UoM/logistics propert{uomHeaders.length === 1 ? 'y' : 'ies'} auto-disabled
                      </p>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Properties related to units of measure, quantities, and logistics are automatically 
                        assigned to SKU-level and excluded from hierarchy analysis.
                      </p>
                      <div className="flex gap-2 mt-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={enableUomHeaders}
                          className="gap-2 hover:bg-primary/10 hover:border-primary transition-all"
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          Enable Properties
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowUomInfo(false)}
                          className="hover:bg-muted"
                        >
                          Dismiss
                        </Button>
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>
              </motion.div>
            )}

          <div className="flex gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={selectAll}
              className="gap-2 flex-1 hover:bg-primary/10 hover:border-primary transition-all"
            >
              <CheckCircle2 className="w-4 h-4" />
              Select All
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={deselectAll}
              className="gap-2 flex-1 hover:bg-destructive/10 hover:border-destructive transition-all"
            >
              <XCircle className="w-4 h-4" />
              Deselect All
            </Button>
          </div>

            <ScrollArea className="h-[520px] rounded-xl border-2 border-border/50 p-4 bg-muted/20 backdrop-blur-sm shadow-inner">
              <div className="space-y-2 pr-2">
                {headers.map((header, index) => {
                  const isUom = uomHeaders.includes(header);
                  const isSelected = selectedHeaders.has(header);
                  const isHovered = hoveredHeader === header;
                  return (
                    <motion.div
                      key={header}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.015 }}
                      className={`
                        flex items-center space-x-3 p-3.5 rounded-xl 
                        transition-all duration-200 cursor-pointer
                        ${isHovered ? 'bg-primary/10 border-2 border-primary/30 shadow-md scale-[1.02]' : 'bg-card border-2 border-transparent'}
                        ${isSelected ? 'ring-2 ring-primary/20' : ''}
                      `}
                      onMouseEnter={() => setHoveredHeader(header)}
                      onMouseLeave={() => setHoveredHeader(null)}
                      onClick={() => toggleHeader(header)}
                    >
                      <Checkbox
                        id={`header-${index}`}
                        checked={isSelected}
                        onCheckedChange={() => toggleHeader(header)}
                        className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                      />
                      <label
                        htmlFor={`header-${index}`}
                        className="flex-1 text-sm font-medium cursor-pointer flex items-center gap-2"
                      >
                        <span className={isHovered ? 'text-primary font-semibold' : ''}>
                          {header}
                        </span>
                        {isUom && (
                          <Badge variant="outline" className="text-xs bg-muted">
                            UoM
                          </Badge>
                        )}
                      </label>
                    </motion.div>
                  );
                })}
              </div>
            </ScrollArea>

            <div className="flex justify-end pt-5 border-t-2 border-border/50">
              <Button
                onClick={handleConfirm}
                disabled={selectedHeaders.size === 0}
                className="gap-2 bg-gradient-primary hover:shadow-lg transition-all px-8"
                size="lg"
              >
                <Play className="w-5 h-5" />
                <span className="font-semibold">Start Analysis</span>
              </Button>
            </div>
          </div>

          {/* Right side: Data Preview */}
          <div className="space-y-5 flex flex-col">
            <div className="space-y-2">
              <h3 className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                Data Preview
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Hover over a property to see sample values from your dataset
              </p>
            </div>

            <div className="rounded-xl border-2 border-border/50 bg-gradient-to-br from-muted/30 via-muted/10 to-transparent backdrop-blur-sm flex-1 flex items-center justify-center overflow-hidden shadow-inner">
              {hoveredHeader ? (
                <motion.div
                  key={hoveredHeader}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.2 }}
                  className="w-full h-full p-6 flex flex-col"
                >
                  <div className="flex items-center gap-3 mb-4 pb-3 border-b-2 border-primary/20">
                    <div className="w-2 h-8 bg-gradient-primary rounded-full" />
                    <div className="text-base font-bold text-foreground">
                      {hoveredHeader}
                    </div>
                  </div>

                  <ScrollArea className="flex-1">
                    <div className="space-y-2 pr-2">
                      {getSampleData(headers.indexOf(hoveredHeader)).map((value, idx) => (
                        <motion.div
                          key={idx}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.03 }}
                          className="py-2 px-3 bg-card hover:bg-primary/5 rounded-lg transition-all duration-200 border border-border/30 hover:border-primary/30 hover:shadow-sm"
                        >
                          {value !== null && value !== undefined && value !== '' 
                            ? <span className="text-sm font-mono text-foreground">{String(value)}</span>
                            : <span className="text-muted-foreground italic text-xs">empty</span>
                          }
                        </motion.div>
                      ))}
                    </div>
                  </ScrollArea>
                </motion.div>
              ) : (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center text-muted-foreground space-y-4 p-8"
                >
                  <div className="w-20 h-20 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                    <Info className="w-10 h-10 text-primary/50" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-base font-medium">No property selected</p>
                    <p className="text-sm">Hover over a property to preview data</p>
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
};
