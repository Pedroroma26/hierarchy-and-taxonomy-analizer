import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronRight, Database, Layers, Tag } from 'lucide-react';

export interface HierarchyLevel {
  level: number;
  name: string;
  headers: string[];
}

interface HierarchyProposalProps {
  hierarchy: HierarchyLevel[];
  properties: string[];
}

export const HierarchyProposal = ({ hierarchy, properties }: HierarchyProposalProps) => {
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

  const getLevelColor = (level: number) => {
    switch (level) {
      case 1:
        return 'bg-primary text-primary-foreground';
      case 2:
        return 'bg-accent text-accent-foreground';
      default:
        return 'bg-secondary text-secondary-foreground';
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
          <div>
            <h2 className="text-2xl font-semibold mb-2">Proposed Product Hierarchy</h2>
            <p className="text-muted-foreground">
              Data inheritance structure based on cardinality analysis
            </p>
          </div>

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
                  
                  <Card className={`flex-1 p-5 ${getLevelColor(level.level)} border-none`}>
                    <div className="flex items-center gap-3 mb-3">
                      {getLevelIcon(level.level)}
                      <h3 className="font-semibold text-lg">
                        Level {level.level}: {level.name}
                      </h3>
                    </div>
                    
                    <div className="flex flex-wrap gap-2">
                      {level.headers.map((header) => (
                        <Badge 
                          key={header} 
                          variant="outline"
                          className="bg-background/20 border-background/30"
                        >
                          {header}
                        </Badge>
                      ))}
                    </div>
                  </Card>
                </div>
              </motion.div>
            ))}
          </div>

          {properties.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="mt-8 p-5 rounded-lg bg-muted"
            >
              <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                <Tag className="w-5 h-5" />
                Product Properties (SKU-Level)
              </h3>
              <div className="flex flex-wrap gap-2">
                {properties.map((prop) => (
                  <Badge key={prop} variant="secondary">
                    {prop}
                  </Badge>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </Card>
    </motion.div>
  );
};
