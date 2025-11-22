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
  onConfirm: (selectedHeaders: string[]) => void;
}

export const HeaderSelector = ({ headers, onConfirm }: HeaderSelectorProps) => {
  // All headers selected by default
  const [selectedHeaders, setSelectedHeaders] = useState<Set<string>>(
    new Set(headers)
  );

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

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
    >
      <Card className="p-6 shadow-elevated">
        <div className="space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-semibold mb-2">Select Properties</h2>
              <p className="text-muted-foreground">
                Choose which columns should be included in the analysis
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">
                {selectedHeaders.size} of {headers.length} selected
              </Badge>
            </div>
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

          <ScrollArea className="h-[400px] rounded-lg border p-4">
            <div className="space-y-2">
              {headers.map((header, index) => (
                <motion.div
                  key={header}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.02 }}
                  className="flex items-center space-x-3 p-3 rounded-lg hover:bg-muted/50 transition-colors"
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
      </Card>
    </motion.div>
  );
};
