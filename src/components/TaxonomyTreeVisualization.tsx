import { useState } from 'react';
import { motion } from 'framer-motion';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { ChevronRight, ChevronDown, Folder, FolderOpen, FileText } from 'lucide-react';
import { TaxonomyTreeNode } from '@/utils/exportReport';

interface TaxonomyTreeVisualizationProps {
  tree: TaxonomyTreeNode;
}

interface TreeNodeProps {
  node: TaxonomyTreeNode;
  depth: number;
}

const TreeNode = ({ node, depth }: TreeNodeProps) => {
  const [isExpanded, setIsExpanded] = useState(depth < 2); // Auto-expand first 2 levels

  const hasChildren = node.children.length > 0;
  const indentWidth = depth * 24;

  const toggleExpand = () => {
    if (hasChildren) {
      setIsExpanded(!isExpanded);
    }
  };

  return (
    <div>
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.2 }}
        className="flex items-center gap-2 py-2 px-3 hover:bg-muted/50 rounded-lg cursor-pointer transition-colors"
        style={{ paddingLeft: `${indentWidth + 12}px` }}
        onClick={toggleExpand}
      >
        {/* Expand/Collapse Icon */}
        {hasChildren ? (
          <div className="w-5 h-5 flex items-center justify-center">
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            )}
          </div>
        ) : (
          <div className="w-5 h-5" />
        )}

        {/* Folder/File Icon */}
        <div className="w-5 h-5 flex items-center justify-center">
          {hasChildren ? (
            isExpanded ? (
              <FolderOpen className="w-4 h-4 text-primary" />
            ) : (
              <Folder className="w-4 h-4 text-primary" />
            )
          ) : (
            <FileText className="w-4 h-4 text-secondary" />
          )}
        </div>

        {/* Node Name */}
        <span className="font-medium flex-1">{node.name}</span>

        {/* Product Count Badge */}
        <Badge variant="secondary" className="text-xs">
          {node.productCount} {node.productCount === 1 ? 'product' : 'products'}
        </Badge>

        {/* Level Badge */}
        {node.level > 0 && (
          <Badge variant="outline" className="text-xs">
            L{node.level}
          </Badge>
        )}
      </motion.div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.2 }}
        >
          {node.children.map((child, index) => (
            <TreeNode key={`${child.name}-${index}`} node={child} depth={depth + 1} />
          ))}
        </motion.div>
      )}
    </div>
  );
};

export const TaxonomyTreeVisualization = ({ tree }: TaxonomyTreeVisualizationProps) => {
  const [isExpanded, setIsExpanded] = useState(true);

  const countTotalNodes = (node: TaxonomyTreeNode): number => {
    return 1 + node.children.reduce((sum, child) => sum + countTotalNodes(child), 0);
  };

  const countLeafNodes = (node: TaxonomyTreeNode): number => {
    if (node.children.length === 0) return 1;
    return node.children.reduce((sum, child) => sum + countLeafNodes(child), 0);
  };

  const totalNodes = countTotalNodes(tree);
  const leafNodes = countLeafNodes(tree);
  const maxDepth = Math.max(...getAllDepths(tree));

  function getAllDepths(node: TaxonomyTreeNode, currentDepth: number = 0): number[] {
    if (node.children.length === 0) return [currentDepth];
    return [currentDepth, ...node.children.flatMap(child => getAllDepths(child, currentDepth + 1))];
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
    >
      <Card className="p-6 shadow-elevated">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div 
              className="flex-1 cursor-pointer"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              <h2 className="text-2xl font-semibold mb-2 flex items-center gap-2">
                {isExpanded ? <ChevronDown className="w-6 h-6" /> : <ChevronRight className="w-6 h-6" />}
                Taxonomy Tree
              </h2>
              <p className="text-muted-foreground">
                Complete product hierarchy visualization
              </p>
            </div>
          </div>

          {isExpanded && (
          <>
          {/* Statistics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-lg bg-muted/50">
              <div className="text-sm text-muted-foreground mb-1">Total Categories</div>
              <div className="text-2xl font-bold">{totalNodes}</div>
            </div>
            <div className="p-4 rounded-lg bg-muted/50">
              <div className="text-sm text-muted-foreground mb-1">Leaf Categories</div>
              <div className="text-2xl font-bold">{leafNodes}</div>
            </div>
            <div className="p-4 rounded-lg bg-muted/50">
              <div className="text-sm text-muted-foreground mb-1">Max Depth</div>
              <div className="text-2xl font-bold">{maxDepth}</div>
            </div>
            <div className="p-4 rounded-lg bg-muted/50">
              <div className="text-sm text-muted-foreground mb-1">Total Products</div>
              <div className="text-2xl font-bold">{tree.productCount}</div>
            </div>
          </div>

          {/* Tree */}
          <div className="border rounded-lg p-4 bg-background max-h-[600px] overflow-y-auto">
            {tree.name === 'Root' && tree.children.length > 0 ? (
              tree.children.map((child, index) => (
                <TreeNode key={`${child.name}-${index}`} node={child} depth={0} />
              ))
            ) : (
              <TreeNode node={tree} depth={0} />
            )}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-6 text-sm text-muted-foreground border-t pt-4">
            <div className="flex items-center gap-2">
              <Folder className="w-4 h-4 text-primary" />
              <span>Category with subcategories</span>
            </div>
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-secondary" />
              <span>Leaf category</span>
            </div>
          </div>
          </>
          )}
        </div>
      </Card>
    </motion.div>
  );
};
