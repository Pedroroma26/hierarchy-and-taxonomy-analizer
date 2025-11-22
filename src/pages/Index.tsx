import { useState } from 'react';
import { motion } from 'framer-motion';
import * as XLSX from 'xlsx';
import { FileUpload } from '@/components/FileUpload';
import { DataPreview } from '@/components/DataPreview';
import { CardinalityAnalysis } from '@/components/CardinalityAnalysis';
import { HierarchyProposal } from '@/components/HierarchyProposal';
import { TaxonomyResults } from '@/components/TaxonomyResults';
import { PropertyRecommendations } from '@/components/PropertyRecommendations';
import { ThresholdAdjuster } from '@/components/ThresholdAdjuster';
import { AlternativeHierarchies } from '@/components/AlternativeHierarchies';
import { ProductDomainIndicator } from '@/components/ProductDomainIndicator';
import { OrphanedRecordsAlert } from '@/components/OrphanedRecordsAlert';
import { InteractiveHierarchyBuilder } from '@/components/InteractiveHierarchyBuilder';
import { analyzeProductData, AnalysisResult, HierarchyAlternative } from '@/utils/analysisEngine';
import { HierarchyLevel } from '@/components/HierarchyProposal';
import { useToast } from '@/hooks/use-toast';
import { Download } from 'lucide-react';

const Index = () => {
  const [headers, setHeaders] = useState<string[]>([]);
  const [data, setData] = useState<any[][]>([]);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [customThresholds, setCustomThresholds] = useState<{ low: number; medium: number } | null>(null);
  const { toast } = useToast();

  const handleFileUpload = async (file: File) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const jsonData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      if (jsonData.length < 2) {
        toast({
          title: 'Invalid file',
          description: 'The file must contain at least a header row and one data row.',
          variant: 'destructive',
        });
        return;
      }

      const extractedHeaders = jsonData[0] as string[];
      const extractedData = jsonData.slice(1);

      setHeaders(extractedHeaders);
      setData(extractedData);

      // Perform analysis
      const result = analyzeProductData(extractedHeaders, extractedData, customThresholds || undefined);
      setAnalysisResult(result);

      toast({
        title: 'Analysis Complete',
        description: 'Your product data has been analyzed successfully.',
      });
    } catch (error) {
      console.error('Error processing file:', error);
      toast({
        title: 'Error',
        description: 'Failed to process the file. Please ensure it is a valid Excel file.',
        variant: 'destructive',
      });
    }
  };

  const handleExport = () => {
    if (!analysisResult) return;

    const exportData = {
      analysis_summary: {
        total_products: data.length,
        total_attributes: headers.length,
        hierarchy_levels: analysisResult.hierarchy.length,
      },
      record_suggestions: {
        record_id: analysisResult.recordIdSuggestion,
        record_name: analysisResult.recordNameSuggestion,
      },
      cardinality_scores: analysisResult.cardinalityScores,
      proposed_hierarchy: analysisResult.hierarchy,
      product_properties: analysisResult.properties,
      property_recommendations: analysisResult.propertyRecommendations,
      uom_suggestions: analysisResult.uomSuggestions,
      taxonomy_paths: analysisResult.taxonomyPaths,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'taxonomy-analysis-results.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: 'Export Successful',
      description: 'Analysis results have been downloaded.',
    });
  };

  const handleThresholdChange = (low: number, medium: number) => {
    setCustomThresholds({ low, medium });
  };

  const handleReanalyze = () => {
    if (headers.length > 0 && data.length > 0) {
      const result = analyzeProductData(headers, data, customThresholds || undefined);
      setAnalysisResult(result);
      toast({
        title: 'Reanalysis Complete',
        description: 'Data has been reanalyzed with new thresholds.',
      });
    }
  };

  const handleSelectAlternative = (alternative: HierarchyAlternative) => {
    if (!analysisResult) return;
    
    const newResult: AnalysisResult = {
      ...analysisResult,
      hierarchy: alternative.hierarchy,
      properties: alternative.properties,
      hierarchyConfidence: alternative.confidence,
    };
    setAnalysisResult(newResult);
    
    toast({
      title: 'Hierarchy Updated',
      description: `Applied "${alternative.name}" structure.`,
    });
  };

  const handlePreviewCustomHierarchy = (hierarchy: HierarchyLevel[]) => {
    if (!analysisResult) return;
    
    // Recalculate properties
    const hierarchyHeaders = hierarchy.flatMap(h => h.headers);
    const properties = headers.filter(h => !hierarchyHeaders.includes(h));
    
    toast({
      title: 'Preview Mode',
      description: `Previewing ${hierarchy.length}-level hierarchy with ${properties.length} properties.`,
    });
  };

  const handleApplyCustomHierarchy = (hierarchy: HierarchyLevel[]) => {
    if (!analysisResult) return;
    
    const hierarchyHeaders = hierarchy.flatMap(h => h.headers);
    const properties = headers.filter(h => !hierarchyHeaders.includes(h));
    
    const newResult: AnalysisResult = {
      ...analysisResult,
      hierarchy,
      properties,
      hierarchyConfidence: 0.8, // Custom hierarchies get fixed confidence
    };
    setAnalysisResult(newResult);
    
    toast({
      title: 'Custom Hierarchy Applied',
      description: 'Your custom hierarchy structure is now active.',
    });
  };

  return (
    <div className="min-h-screen bg-gradient-subtle">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50 shadow-card">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                Product Taxonomy Analyzer
              </h1>
              <p className="text-muted-foreground mt-1">
                Data-driven hierarchy and taxonomy proposer
              </p>
            </div>
            {analysisResult && (
              <motion.button
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                onClick={handleExport}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:shadow-glow transition-all"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Export All</span>
              </motion.button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        <div className="space-y-8">
          <FileUpload onFileUpload={handleFileUpload} />

          {data.length > 0 && (
            <>
              <DataPreview headers={headers} data={data} />

              {analysisResult && (
                <>
                  <ProductDomainIndicator domain={analysisResult.productDomain} />
                  
                  <CardinalityAnalysis scores={analysisResult.cardinalityScores} />
                  
                  <ThresholdAdjuster
                    currentThresholds={analysisResult.thresholds}
                    onThresholdChange={handleThresholdChange}
                    onApply={handleReanalyze}
                  />
                  
                  <PropertyRecommendations
                    recordIdSuggestion={analysisResult.recordIdSuggestion}
                    recordNameSuggestion={analysisResult.recordNameSuggestion}
                    propertyRecommendations={analysisResult.propertyRecommendations}
                    uomSuggestions={analysisResult.uomSuggestions}
                  />
                  
                  {analysisResult.alternativeHierarchies.length > 0 && (
                    <AlternativeHierarchies
                      alternatives={analysisResult.alternativeHierarchies}
                      currentConfidence={analysisResult.hierarchyConfidence}
                      onSelect={handleSelectAlternative}
                    />
                  )}
                  
                  <HierarchyProposal
                    hierarchy={analysisResult.hierarchy}
                    properties={analysisResult.properties}
                  />
                  
                  <InteractiveHierarchyBuilder
                    availableHeaders={headers}
                    initialHierarchy={analysisResult.hierarchy}
                    onPreview={handlePreviewCustomHierarchy}
                    onApply={handleApplyCustomHierarchy}
                  />
                  
                  {analysisResult.orphanedRecords.length > 0 && (
                    <OrphanedRecordsAlert orphanedRecords={analysisResult.orphanedRecords} />
                  )}
                  
                  <TaxonomyResults
                    taxonomyPaths={analysisResult.taxonomyPaths}
                    onExport={handleExport}
                  />
                </>
              )}
            </>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t bg-card/50 backdrop-blur-sm mt-16">
        <div className="container mx-auto px-6 py-8 text-center text-muted-foreground">
          <p>Product Taxonomy Analyzer - Automate your product catalog structuring</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
