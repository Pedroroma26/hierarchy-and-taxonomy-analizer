import { useState } from 'react';
import { motion } from 'framer-motion';
import * as XLSX from 'xlsx';
import { FileUpload } from '@/components/FileUpload';
import { DataPreview } from '@/components/DataPreview';
import { CardinalityAnalysis } from '@/components/CardinalityAnalysis';
import { HierarchyProposal } from '@/components/HierarchyProposal';
import { PropertyRecommendations } from '@/components/PropertyRecommendations';
import { HeaderSelector } from '@/components/HeaderSelector';
import { TaxonomyTreeVisualization } from '@/components/TaxonomyTreeVisualization';
import { DataValidationWarnings } from '@/components/DataValidationWarnings';
import { BestPracticesRecommendations } from '@/components/BestPracticesRecommendations';
import { ThresholdAdjuster } from '@/components/ThresholdAdjuster';
import { analyzeProductData, AnalysisResult } from '@/utils/analysisEngine';
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
  const [taxonomyTree, setTaxonomyTree] = useState<any>(null);
  const [validationResult, setValidationResult] = useState<any>(null);
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

      const extractedHeaders = (jsonData[0] as string[]).map(h => 
        h ? h.toString().trim() : ''
      );
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
    runAnalysis(selected, filteredData);
  };

  const runAnalysis = (headersToAnalyze: string[], dataToAnalyze: any[][], customThresholds?: { parent: number; childrenMin: number; childrenMax: number; sku: number }) => {
    // Perform analysis with selected headers
    const result = analyzeProductData(headersToAnalyze, dataToAnalyze, customThresholds);
    setAnalysisResult(result);

    // Build taxonomy tree
    const tree = buildTaxonomyTree(result.hierarchy, dataToAnalyze, headersToAnalyze);
    setTaxonomyTree(tree);

    // Validate data quality
    const hierarchyHeaders = result.hierarchy.flatMap(h => h.headers);
    const validation = validateData(headersToAnalyze, dataToAnalyze, hierarchyHeaders);
    setValidationResult(validation);

    toast({
      title: 'Analysis Complete',
      description: `Analyzed ${headersToAnalyze.length} attributes from ${dataToAnalyze.length} products.`,
    });
  };

  const handleThresholdsChange = (newThresholds: { parent: number; childrenMin: number; childrenMax: number; sku: number }) => {
    if (headers.length > 0 && data.length > 0) {
      runAnalysis(headers, data, newThresholds);
    }
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
      generatePDFReport(analysisResult, headers, data, taxonomyTree, validationResult);
      
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
            <HeaderSelector 
              headers={allHeaders}
              data={data}
              onConfirm={handleHeaderSelection}
            />
          )}

          {!showHeaderSelection && data.length > 0 && (
            <>
              <DataPreview headers={headers} data={data} />

              {analysisResult && (
                <>
                  {/* Data Pattern Analysis - CORE for hierarchy decisions */}
                  <CardinalityAnalysis scores={analysisResult.cardinalityScores} />
                  
                  {/* Threshold Adjuster - Interactive tuning */}
                  <ThresholdAdjuster 
                    currentThresholds={analysisResult.thresholds}
                    onThresholdsChange={handleThresholdsChange}
                  />
                  
                  {/* Main Hierarchy Proposal */}
                  <HierarchyProposal
                    hierarchy={analysisResult.hierarchy}
                    properties={analysisResult.properties}
                    propertiesWithoutValues={analysisResult.propertiesWithoutValues}
                  />
                  
                  {/* Taxonomy Tree - RIGHT AFTER Hierarchy Proposal */}
                  {taxonomyTree && (
                    <TaxonomyTreeVisualization tree={taxonomyTree} />
                  )}
                  
                  {/* Property Type Recommendations - BEFORE Best Practices */}
                  <PropertyRecommendations
                    recordIdSuggestion={analysisResult.recordIdSuggestion}
                    recordNameSuggestion={analysisResult.recordNameSuggestion}
                    propertyRecommendations={analysisResult.propertyRecommendations}
                    uomSuggestions={[]}
                  />
                  
                  {/* CORE: Best Practices & Recommendations */}
                  <BestPracticesRecommendations analysisResult={analysisResult} />
                  
                  {/* Data Quality Warnings - LAST */}
                  {validationResult && (
                    <DataValidationWarnings validation={validationResult} />
                  )}
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
