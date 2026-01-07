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
import { TaxonomyBuilder, TaxonomyConfig } from '@/components/TaxonomyBuilder';
import { DataValidationWarnings } from '@/components/DataValidationWarnings';
import { BestPracticesRecommendations } from '@/components/BestPracticesRecommendations';
import { PresetSelector } from '@/components/PresetSelector';
import { SkuLevelForcing } from '@/components/SkuLevelForcing';
import { analyzeProductData, AnalysisResult } from '@/utils/analysisEngine';
import { generateExportReport, buildTaxonomyTree, buildCustomTaxonomyTree } from '@/utils/exportReport';
import { validateData } from '@/utils/dataValidation';
import { generatePDFReport } from '@/utils/pdfExport';
import { useToast } from '@/hooks/use-toast';
import { Download, CheckCircle2, XCircle, Play, FileText } from 'lucide-react';
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
  const [forcedSkuHeaders, setForcedSkuHeaders] = useState<string[]>([]);
  const [selectedPreset, setSelectedPreset] = useState<any>(null);
  const [taxonomyConfig, setTaxonomyConfig] = useState<TaxonomyConfig | null>(null);
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
      
      // Check for duplicate headers and warn user with details
      const headerPositions = new Map<string, number[]>();
      extractedHeaders.forEach((h, idx) => {
        if (!headerPositions.has(h)) {
          headerPositions.set(h, []);
        }
        headerPositions.get(h)!.push(idx + 1); // 1-indexed for user
      });
      
      const duplicates = Array.from(headerPositions.entries()).filter(([_, positions]) => positions.length > 1);
      if (duplicates.length > 0) {
        const duplicateDetails = duplicates.map(([name, positions]) => 
          `"${name}" in columns ${positions.join(', ')}`
        ).join(' | ');
        
        toast({
          title: `⚠️ ${duplicates.length} Duplicate Column Name${duplicates.length > 1 ? 's' : ''} Detected`,
          description: `${duplicateDetails}. Only the first occurrence of each will be analyzed. Please fix the Excel file for complete analysis.`,
          variant: 'destructive',
        });
        console.warn('⚠️ Duplicate headers detected:', duplicates);
      }

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
    setHeaders(selected);  // Only selected headers
    setShowHeaderSelection(false);

    // Filter data to only include selected headers
    const selectedIndices = selected.map(h => allHeaders.indexOf(h));
    const filteredData = data.map(row => 
      selectedIndices.map(idx => row[idx])
    );
    setData(filteredData);
    
    // Perform analysis with ONLY selected headers
    // Item-level detection will suggest which go to SKU-level
    runAnalysis(selected, filteredData);
  };

  const runAnalysis = (
    headersToAnalyze: string[], 
    dataToAnalyze: any[][], 
    customThresholds?: { parent: number; childrenMin: number; childrenMax: number; sku: number; minPropertiesPerLevel?: number },
    selectedHeaders?: string[],  // Optional: user-selected headers for preference
    forcedHeaders?: string[]  // Optional: user-forced SKU-level headers
  ) => {
    // Perform analysis with ALL headers
    // Pass forced headers to maintain user selections across threshold changes
    const result = analyzeProductData(headersToAnalyze, dataToAnalyze, customThresholds, forcedHeaders);
    setAnalysisResult(result);

    // Build taxonomy tree - use custom config if available, otherwise automatic
    const tree = taxonomyConfig && taxonomyConfig.levels.length > 0
      ? buildCustomTaxonomyTree(taxonomyConfig, dataToAnalyze, headersToAnalyze)
      : buildTaxonomyTree(result.hierarchy, dataToAnalyze, headersToAnalyze);
    setTaxonomyTree(tree);

    // Validate data quality with Salsify compliance checks
    const hierarchyHeaders = result.hierarchy.flatMap(h => h.headers);
    const validation = validateData(
      headersToAnalyze, 
      dataToAnalyze, 
      hierarchyHeaders,
      result.recordIdSuggestion || undefined,
      result.recordNameSuggestion || undefined
    );
    setValidationResult(validation);

    toast({
      title: 'Analysis Complete',
      description: `Analyzed ${headersToAnalyze.length} attributes from ${dataToAnalyze.length} products.`,
    });
  };


  const handleSkuLevelForcing = (forcedHeaders: string[]) => {
    if (headers.length > 0 && data.length > 0) {
      // Save forced headers
      setForcedSkuHeaders(forcedHeaders);
      
      // Rerun analysis with forced SKU-level headers using runAnalysis for consistency
      const customThresholds = analysisResult?.thresholds;
      runAnalysis(headers, data, customThresholds, undefined, forcedHeaders);
      
      toast({
        title: 'SKU-Level Forcing Applied',
        description: `${forcedHeaders.length} properties forced to SKU-level. Analysis rerun complete.`,
      });
    }
  };

  const handleTaxonomyConfigChange = (config: TaxonomyConfig) => {
    setTaxonomyConfig(config);
    
    // Rebuild taxonomy tree if analysis already exists
    if (analysisResult && data.length > 0 && headers.length > 0) {
      const tree = config.levels.length > 0
        ? buildCustomTaxonomyTree(config, data, headers)
        : buildTaxonomyTree(analysisResult.hierarchy, data, headers);
      setTaxonomyTree(tree);
      
      toast({
        title: 'Taxonomy Configuration Updated',
        description: config.levels.length > 0 
          ? `Custom taxonomy with ${config.levels.length} levels applied.`
          : 'Using automatic taxonomy tree generation.',
      });
    }
  };

  const handlePresetSelection = (preset: any) => {
    console.log('\n🔵 ========== PRESET SELECTION ==========');
    console.log('🔵 Preset name:', preset.name);
    console.log('🔵 Preset hierarchy levels:', preset.hierarchy.length);
    
    setSelectedPreset(preset);
    
    if (!analysisResult) return;
    
    // Log initial hierarchy
    preset.hierarchy.forEach((level: any, i: number) => {
      console.log(`\n🔵 [BEFORE] Level ${i + 1}: ${level.name}`);
      console.log(`  - Record ID: "${level.recordId}"`);
      console.log(`  - Record Name: "${level.recordName}"`);
      console.log(`  - Headers (${level.headers.length}):`, level.headers);
    });
    
    // CRITICAL: Apply deduplication to preset hierarchy
    // Properties should only appear in their lowest level
    const deduplicatedHierarchy = [...preset.hierarchy];
    const seenProperties = new Set<string>();
    
    // Iterate from last level to first (bottom-up)
    for (let i = deduplicatedHierarchy.length - 1; i >= 0; i--) {
      const level = deduplicatedHierarchy[i];
      
      // Add Record ID and Record Name to seen properties
      if (level.recordId) seenProperties.add(level.recordId);
      if (level.recordName) seenProperties.add(level.recordName);
      
      // Remove properties that were already seen in lower levels
      const beforeCount = level.headers.length;
      level.headers = level.headers.filter((h: string) => {
        if (seenProperties.has(h)) {
          console.log(`🔍 Removing duplicate "${h}" from level ${i + 1}`);
          return false;
        }
        seenProperties.add(h);
        return true;
      });
      
      if (beforeCount !== level.headers.length) {
        console.log(`🔍 Level ${i + 1} after deduplication: ${level.headers.length} headers (was ${beforeCount})`);
      }
    }
    
    // Update analysis result with deduplicated preset hierarchy
    const updatedResult = {
      ...analysisResult,
      hierarchy: deduplicatedHierarchy,
      properties: preset.properties,
      hierarchyConfidence: preset.confidence,
    };
    
    setAnalysisResult(updatedResult);
    
    // Rebuild taxonomy tree with new hierarchy - use custom config if available
    const tree = taxonomyConfig && taxonomyConfig.levels.length > 0
      ? buildCustomTaxonomyTree(taxonomyConfig, data, headers)
      : buildTaxonomyTree(preset.hierarchy, data, headers);
    setTaxonomyTree(tree);
    
    // Revalidate data with Salsify compliance checks
    const hierarchyHeaders = preset.hierarchy.flatMap((h: any) => h.headers);
    const recordId = preset.hierarchy[preset.hierarchy.length - 1]?.recordId;
    const recordName = preset.hierarchy[preset.hierarchy.length - 1]?.recordName;
    const validation = validateData(headers, data, hierarchyHeaders, recordId, recordName);
    setValidationResult(validation);
    
    toast({
      title: 'Preset Applied',
      description: `${preset.name} structure selected. Hierarchy updated.`,
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
              <Button className="gap-2" onClick={handleExportPDF}>
                <FileText className="w-4 h-4" />
                <span className="hidden sm:inline">Export PDF Report</span>
              </Button>
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
                  {/* NEW: Preset Selector - Choose structure type */}
                  {analysisResult.hierarchyPresets && analysisResult.hierarchyPresets.length > 0 && (
                    <PresetSelector
                      presets={analysisResult.hierarchyPresets}
                      onSelectPreset={handlePresetSelection}
                      selectedPreset={selectedPreset}
                    />
                  )}
                  
                  {/* SKU-Level Forcing - Force properties to SKU-level */}
                  <SkuLevelForcing
                    headers={headers}
                    currentHierarchy={analysisResult.hierarchy}
                    onApply={handleSkuLevelForcing}
                  />
                  
                  {/* Data Pattern Analysis - CORE for hierarchy decisions */}
                  <CardinalityAnalysis 
                    scores={analysisResult.cardinalityScores}
                    thresholds={analysisResult.thresholds}
                  />
                  
                  {/* Main Hierarchy Proposal */}
                  <HierarchyProposal
                    hierarchy={analysisResult.hierarchy}
                    properties={analysisResult.properties}
                    propertiesWithoutValues={analysisResult.propertiesWithoutValues}
                  />
                  
                  {/* Taxonomy Configuration - Allow custom taxonomy setup */}
                  <TaxonomyBuilder
                    availableProperties={headers}
                    onConfigChange={handleTaxonomyConfigChange}
                    initialConfig={taxonomyConfig || undefined}
                  />
                  
                  {/* Taxonomy Tree - Shows result based on configuration */}
                  {taxonomyTree && (
                    <TaxonomyTreeVisualization tree={taxonomyTree} />
                  )}
                  
                  {/* Property Type Recommendations - BEFORE Best Practices */}
                  <PropertyRecommendations
                    recordIdSuggestion={analysisResult.recordIdSuggestion}
                    recordNameSuggestion={analysisResult.recordNameSuggestion}
                    recordIdNameSuggestions={analysisResult.recordIdNameSuggestions}
                    propertyRecommendations={analysisResult.propertyRecommendations}
                    uomSuggestions={[]}
                    hierarchy={analysisResult.hierarchy}
                  />
                  
                  {/* CORE: Best Practices & Recommendations */}
                  <BestPracticesRecommendations analysisResult={analysisResult} taxonomyTree={taxonomyTree} />
                  
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
