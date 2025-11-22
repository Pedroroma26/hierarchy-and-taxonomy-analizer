import { motion } from 'framer-motion';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { ProductDomain } from '@/utils/analysisEngine';
import { Sparkles, Shirt, Cpu, Apple, Armchair } from 'lucide-react';

interface ProductDomainIndicatorProps {
  domain: ProductDomain;
}

export const ProductDomainIndicator = ({ domain }: ProductDomainIndicatorProps) => {
  const getDomainIcon = (type: ProductDomain['type']) => {
    switch (type) {
      case 'Electronics':
        return <Cpu className="w-5 h-5" />;
      case 'Apparel':
        return <Shirt className="w-5 h-5" />;
      case 'Food':
        return <Apple className="w-5 h-5" />;
      case 'Furniture':
        return <Armchair className="w-5 h-5" />;
      default:
        return <Sparkles className="w-5 h-5" />;
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.7) return 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-950';
    if (confidence >= 0.5) return 'text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-950';
    return 'text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-950';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="p-4 bg-gradient-subtle border-primary/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              {getDomainIcon(domain.type)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold">Detected Product Domain:</span>
                <Badge variant="secondary" className="font-medium">
                  {domain.type}
                </Badge>
              </div>
              {domain.indicators.length > 0 && (
                <p className="text-sm text-muted-foreground mt-1">
                  Based on: {domain.indicators.join(', ')}
                </p>
              )}
            </div>
          </div>
          <Badge className={getConfidenceColor(domain.confidence)}>
            {(domain.confidence * 100).toFixed(0)}% confidence
          </Badge>
        </div>
      </Card>
    </motion.div>
  );
};
