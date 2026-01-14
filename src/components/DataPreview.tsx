import { memo, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface DataPreviewProps {
  headers: string[];
  data: any[][];
}

// Limit rows to render for performance - show first 100 rows only
const MAX_PREVIEW_ROWS = 100;

export const DataPreview = memo(({ headers, data }: DataPreviewProps) => {
  // Memoize the preview data to avoid recalculating on every render
  const previewData = useMemo(() => {
    return data.slice(0, MAX_PREVIEW_ROWS);
  }, [data]);

  const isLimited = data.length > MAX_PREVIEW_ROWS;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
    >
      <Card className="p-6 shadow-elevated">
        <div className="space-y-4">
          <div>
            <h2 className="text-2xl font-semibold mb-2">Data Preview</h2>
            <p className="text-muted-foreground">
              {isLimited 
                ? `Showing first ${MAX_PREVIEW_ROWS} of ${data.length.toLocaleString()} products`
                : `Showing all ${data.length} products`
              }
            </p>
          </div>
          
          <div className="relative border rounded-lg">
            <div className="overflow-auto max-h-[400px] w-full">
              <Table className="relative">
                <TableHeader className="sticky top-0 bg-muted/90 backdrop-blur-sm z-10 shadow-sm">
                  <TableRow>
                    {headers.map((header, index) => (
                      <TableHead key={index} className="font-semibold whitespace-nowrap px-4 min-w-[150px] border-b-2">
                        {header}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewData.map((row, rowIndex) => (
                    <TableRow key={rowIndex} className="hover:bg-muted/30">
                      {row.map((cell, cellIndex) => (
                        <TableCell key={cellIndex} className="whitespace-nowrap px-4 min-w-[150px]">
                          {cell || '-'}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="bg-muted/30 px-4 py-2 text-xs text-muted-foreground border-t flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-semibold">💡 Tip:</span>
                <span>
                  {isLimited 
                    ? `Preview limited to ${MAX_PREVIEW_ROWS} rows for performance. Full dataset: ${data.length.toLocaleString()} products`
                    : `Scroll to view all ${data.length} rows`
                  }
                </span>
              </div>
              <span className="font-mono">{data.length.toLocaleString()} products</span>
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
});
