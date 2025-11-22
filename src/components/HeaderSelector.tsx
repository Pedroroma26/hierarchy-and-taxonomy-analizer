import { useState } from 'react';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CheckCircle2, XCircle, Play } from 'lucide-react';

interface HeaderSelectorProps {
  headers: string[];
  data: any[][];
  onConfirm: (selectedHeaders: string[]) => void;
}

export const HeaderSelector = ({ headers, data, onConfirm }: HeaderSelectorProps) => {
  // All headers selected by default
  const [selectedHeaders, setSelectedHeaders] = useState<Set<string>>(
    new Set(headers)
  );
  const [hoveredHeader, setHoveredHeader] = useState<string | null>(null);

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
      <Card className="p-6 shadow-elevated">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr,1fr] gap-6">
          {/* Left side: Header selection */}
          <div className="space-y-4 flex flex-col">
            <div>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-2xl font-semibold">Select Properties</h2>
                <Badge variant="secondary" className="text-sm">
                  {selectedHeaders.size} of {headers.length} selected
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Choose which columns should be included in the analysis
              </p>
            </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={selectAll}
              className="gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              Select All
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={deselectAll}
              className="gap-2"
            >
              <XCircle className="w-4 h-4" />
              Deselect All
            </Button>
          </div>

            <ScrollArea className="h-[500px] rounded-lg border p-4">
              <div className="space-y-2">
                {headers.map((header, index) => (
                  <motion.div
                    key={header}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.02 }}
                    className="flex items-center space-x-3 p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                    onMouseEnter={() => setHoveredHeader(header)}
                    onMouseLeave={() => setHoveredHeader(null)}
                  >
                    <Checkbox
                      id={`header-${index}`}
                      checked={selectedHeaders.has(header)}
                      onCheckedChange={() => toggleHeader(header)}
                    />
                    <label
                      htmlFor={`header-${index}`}
                      className="flex-1 text-sm font-medium cursor-pointer"
                    >
                      {header}
                    </label>
                  </motion.div>
                ))}
              </div>
            </ScrollArea>

            <div className="flex justify-end pt-4 border-t">
              <Button
                onClick={handleConfirm}
                disabled={selectedHeaders.size === 0}
                className="gap-2 bg-gradient-primary"
                size="lg"
              >
                <Play className="w-4 h-4" />
                Start Analysis
              </Button>
            </div>
          </div>

          {/* Right side: Data Preview */}
          <div className="space-y-3 flex flex-col">
            <div>
              <h3 className="text-lg font-semibold">Data Preview</h3>
              <p className="text-xs text-muted-foreground">
                Hover over a property to see sample values
              </p>
            </div>

            <div className="rounded-lg border bg-muted/10 flex-1 flex items-center justify-center">
              {hoveredHeader ? (
                <motion.div
                  key={hoveredHeader}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="w-full h-full p-4"
                >
                  <div className="text-sm font-semibold mb-3 pb-2 border-b">
                    {hoveredHeader}
                  </div>

                  <ScrollArea className="h-[450px]">
                    <div className="space-y-1 text-sm font-mono pr-2">
                      {getSampleData(headers.indexOf(hoveredHeader)).map((value, idx) => (
                        <div
                          key={idx}
                          className="py-1 px-2 hover:bg-muted/50 rounded"
                        >
                          {value !== null && value !== undefined && value !== '' 
                            ? String(value) 
                            : <span className="text-muted-foreground italic text-xs">empty</span>
                          }
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </motion.div>
              ) : (
                <div className="text-center text-muted-foreground text-sm">
                  <p>Hover over a property name</p>
                  <p>to preview its data</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
};
