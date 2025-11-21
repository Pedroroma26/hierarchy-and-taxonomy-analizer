import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, GitBranch, Tags } from 'lucide-react';

export interface TaxonomyPath {
  path: string[];
  productCount: number;
  properties: string[];
}

interface TaxonomyResultsProps {
  taxonomyPaths: TaxonomyPath[];
  onExport: () => void;
}

export const TaxonomyResults = ({ taxonomyPaths, onExport }: TaxonomyResultsProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.4 }}
    >
      <Card className="p-6 shadow-elevated">
        <div className="space-y-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-semibold mb-2">Taxonomy Classification</h2>
              <p className="text-muted-foreground">
                Product categorization paths and assigned properties
              </p>
            </div>
            <Button onClick={onExport} className="bg-gradient-secondary">
              <Download className="w-4 h-4 mr-2" />
              Export Results
            </Button>
          </div>

          <div className="space-y-4">
            {taxonomyPaths.slice(0, 10).map((taxonomy, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="p-5 rounded-lg border bg-card hover:shadow-card transition-all"
              >
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-lg font-semibold">
                    <GitBranch className="w-5 h-5 text-primary" />
                    <div className="flex items-center gap-2 flex-wrap">
                      {taxonomy.path.map((segment, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <span className={idx === 0 ? 'text-primary' : idx === 1 ? 'text-accent' : 'text-secondary'}>
                            {segment}
                          </span>
                          {idx < taxonomy.path.length - 1 && (
                            <span className="text-muted-foreground">→</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>{taxonomy.productCount} products</span>
                  </div>

                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Tags className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium text-muted-foreground">
                        Assigned Properties:
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {taxonomy.properties.map((prop) => (
                        <Badge key={prop} variant="outline" className="text-xs">
                          {prop}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {taxonomyPaths.length > 10 && (
            <p className="text-center text-muted-foreground text-sm">
              Showing 10 of {taxonomyPaths.length} taxonomy paths. Export to see all results.
            </p>
          )}
        </div>
      </Card>
    </motion.div>
  );
};
