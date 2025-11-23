import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface DataPreviewProps {
  headers: string[];
  data: any[][];
}

export const DataPreview = ({ headers, data }: DataPreviewProps) => {
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
              Showing {data.length} total products (scroll to view all)
            </p>
          </div>
          
          <div className="relative border rounded-lg">
            <div className="overflow-auto max-h-[500px] w-full">
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
                  {data.map((row, rowIndex) => (
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
                <span>Scroll horizontally and vertically to view all {data.length} rows</span>
              </div>
              <span className="font-mono">{data.length} products</span>
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
};
