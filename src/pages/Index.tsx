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
import { HeaderSelector } from '@/components/HeaderSelector';
import { TaxonomyTreeVisualization } from '@/components/TaxonomyTreeVisualization';
import { DataValidationWarnings } from '@/components/DataValidationWarnings';
import { UomFilterConfig } from '@/components/UomFilterConfig';
import { PropertyHierarchyMapping } from '@/components/PropertyHierarchyMapping';
import { BestPracticesRecommendations } from '@/components/BestPracticesRecommendations';
import { analyzeProductData, AnalysisResult, HierarchyAlternative } from '@/utils/analysisEngine';
import { HierarchyLevel } from '@/components/HierarchyProposal';
import { generateExportReport, buildTaxonomyTree } from '@/utils/exportReport';
import { validateData } from '@/utils/dataValidation';
import { generatePDFReport } from '@/utils/pdfExport';
import { useToast } from '@/hooks/use-toast';
import { Download, CheckCircle2, XCircle, Play, FileJson, FileText } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const Index = () => {
  const [allHeaders, setAllHeaders] = useState<string[]>([]);
  const [selectedHeaders, setSelectedHeaders] = useState<string[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [data, setData] = useState<any[][]>([]);
  const [showHeaderSelection, setShowHeaderSelection] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [customThresholds, setCustomThresholds] = useState<{ low: number; medium: number } | null>(null);
  const [taxonomyTree, setTaxonomyTree] = useState<any>(null);
  const [validationResult, setValidationResult] = useState<any>(null);
  const [excludedUomFields, setExcludedUomFields] = useState<string[]>([]);
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
          title: 'Invalid File',
          description: 'The file must contain at least a header row and one data row.',
          variant: 'destructive',
        });
        return;
      }

      const extractedHeaders = jsonData[0] as string[];
      const extractedData = jsonData.slice(1);

      // Store all headers and data, show header selection
      setAllHeaders(extractedHeaders);
      setData(extractedData);
      setShowHeaderSelection(true);
      setAnalysisResult(null);

      toast({
        title: 'File Loaded',
        description: 'Select the columns you want to analyze.',
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

  const handleHeaderSelection = (selected: string[]) => {
    setSelectedHeaders(selected);
    setHeaders(selected);
    setShowHeaderSelection(false);

    // Filter data to only include selected headers
    const selectedIndices = selected.map(h => allHeaders.indexOf(h));
    const filteredData = data.map(row => 
      selectedIndices.map(idx => row[idx])
    );
    setData(filteredData);

    // Perform analysis with selected headers
    const result = analyzeProductData(selected, filteredData, customThresholds || undefined);
    setAnalysisResult(result);

    // Build taxonomy tree with excluded UOM fields
    const tree = buildTaxonomyTree(result.hierarchy, filteredData, selected, excludedUomFields);
    setTaxonomyTree(tree);

    // Validate data quality
    const hierarchyHeaders = result.hierarchy.flatMap(h => h.headers);
    const validation = validateData(selected, filteredData, hierarchyHeaders);
    setValidationResult(validation);

    toast({
      title: 'Analysis Complete',
      description: `Analyzed ${selected.length} attributes from ${filteredData.length} products.`,
    });
  };

  const handleExportJSON = () => {
    if (!analysisResult) return;

    // Generate comprehensive export report
    const exportData = generateExportReport(analysisResult, headers, data);

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `product-taxonomy-analysis-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: 'JSON Export Successful',
      description: 'Comprehensive analysis report has been downloaded.',
    });
  };

  const handleExportPDF = () => {
    if (!analysisResult || !taxonomyTree) return;

    try {
      generatePDFReport(analysisResult, headers, data, taxonomyTree);
      
      toast({
        title: 'PDF Export Successful',
        description: 'Analysis report has been generated as PDF.',
      });
    } catch (error) {
      console.error('PDF generation error:', error);
      toast({
        title: 'PDF Export Failed',
        description: 'There was an error generating the PDF report.',
        variant: 'destructive',
      });
    }
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
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button className="gap-2">
                    <Download className="w-4 h-4" />
                    <span className="hidden sm:inline">Export Report</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={handleExportJSON}>
                    <FileJson className="w-4 h-4 mr-2" />
                    Export as JSON
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleExportPDF}>
                    <FileText className="w-4 h-4 mr-2" />
                    Export as PDF
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        <div className="space-y-8">
          <FileUpload onFileUpload={handleFileUpload} />

          {showHeaderSelection && allHeaders.length > 0 && (
            <>
              <HeaderSelector 
                headers={allHeaders} 
                onConfirm={handleHeaderSelection}
              />
              
              <UomFilterConfig
                headers={allHeaders}
                onConfigChange={setExcludedUomFields}
              />
            </>
          )}

          {!showHeaderSelection && data.length > 0 && (
            <>
              <DataPreview headers={headers} data={data} />

              {analysisResult && (
                <>
                  <ProductDomainIndicator domain={analysisResult.productDomain} />
                  
                  {/* CORE: Property-to-Hierarchy Mapping */}
                  <PropertyHierarchyMapping analysisResult={analysisResult} />
                  
                  {/* CORE: Best Practices & Recommendations */}
                  <BestPracticesRecommendations analysisResult={analysisResult} />
                  
                  {validationResult && (
                    <DataValidationWarnings validation={validationResult} />
                  )}
                  
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
                  
                  {taxonomyTree && (
                    <TaxonomyTreeVisualization tree={taxonomyTree} />
                  )}
                  
                  <TaxonomyResults
                    taxonomyPaths={analysisResult.taxonomyPaths}
                    onExport={handleExportJSON}
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
