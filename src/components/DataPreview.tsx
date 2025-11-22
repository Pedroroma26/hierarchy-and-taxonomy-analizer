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
              Showing first {Math.min(10, data.length)} rows of {data.length} total products
            </p>
          </div>
          
          <ScrollArea className="w-full rounded-lg border">
            <div className="w-max min-w-full">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    {headers.map((header, index) => (
                      <TableHead key={index} className="font-semibold whitespace-nowrap">
                        {header}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.slice(0, 10).map((row, rowIndex) => (
                    <TableRow key={rowIndex} className="hover:bg-muted/30">
                      {row.map((cell, cellIndex) => (
                        <TableCell key={cellIndex} className="whitespace-nowrap">
                          {cell || '-'}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </ScrollArea>
        </div>
      </Card>
    </motion.div>
  );
};
