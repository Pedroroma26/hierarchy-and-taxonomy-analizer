import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import * as XLSX from 'xlsx';
import { FileUpload } from '@/components/FileUpload';
import { DataPreview } from '@/components/DataPreview';
import { CardinalityAnalysis } from '@/components/CardinalityAnalysis';
import { HierarchyProposal } from '@/components/HierarchyProposal';
import { PropertyRecommendations, DataTypeOverride, SalsifyDataType } from '@/components/PropertyRecommendations';
import { HeaderSelector } from '@/components/HeaderSelector';
import { TaxonomyTreeVisualization } from '@/components/TaxonomyTreeVisualization';
import { TaxonomyBuilder, TaxonomyConfig } from '@/components/TaxonomyBuilder';
import { DataValidationWarnings } from '@/components/DataValidationWarnings';
import { BestPracticesRecommendations } from '@/components/BestPracticesRecommendations';
import { PresetSelector } from '@/components/PresetSelector';
import { SkuLevelForcing } from '@/components/SkuLevelForcing';
import { AnalysisResult } from '@/utils/analysisEngine';
import { generateExportReport, buildTaxonomyTree, buildCustomTaxonomyTree, TaxonomyTreeNode } from '@/utils/exportReport';
import { validateData } from '@/utils/dataValidation';
import { generatePDFReport } from '@/utils/pdfExport';
import { useToast } from '@/hooks/use-toast';
import { useAnalysisWorker } from '@/hooks/useAnalysisWorker';
import { Download, CheckCircle2, XCircle, Play, FileText, RotateCcw, Loader2 } from 'lucide-react';
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
  const [presetResetKey, setPresetResetKey] = useState<number>(0); // Increment to reset SkuLevelForcing
  const [originalPresets, setOriginalPresets] = useState<any[]>([]); // Store original presets from initial analysis
  const [originalAnalysisResult, setOriginalAnalysisResult] = useState<AnalysisResult | null>(null); // Store original analysis for reset
  const [originalTaxonomyTree, setOriginalTaxonomyTree] = useState<TaxonomyTreeNode | null>(null); // Store original taxonomy for consistency across presets
  const [isProcessing, setIsProcessing] = useState(false); // For data filtering before analysis
  const [dataTypeOverrides, setDataTypeOverrides] = useState<DataTypeOverride>({}); // User overrides for data types
  const { toast } = useToast();
  
  // Web Worker for heavy analysis - runs in separate thread to avoid blocking UI
  const { analyze: analyzeInWorker, isAnalyzing, progress, terminate: terminateWorker } = useAnalysisWorker();
  
  // Combined loading state - show spinner during processing OR analyzing
  const showLoading = isProcessing || isAnalyzing;
  
  // Cleanup worker on unmount
  useEffect(() => {
    return () => terminateWorker();
  }, [terminateWorker]);

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
      
      // CRITICAL: Filter out completely empty rows from Excel (trailing empty rows)
      const rawData = jsonData.slice(1);
      const extractedData = rawData.filter((row: any[]) => 
        row && row.some(cell => cell !== null && cell !== undefined && String(cell).trim() !== '')
      );
      
      console.log(`📊 Data loaded: ${rawData.length} raw rows → ${extractedData.length} non-empty rows`);
      
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

  const handleHeaderSelection = async (selected: string[]) => {
    // Show loading immediately when user clicks Start Analysis
    setIsProcessing(true);
    setShowHeaderSelection(false);
    
    // Use setTimeout to allow UI to update before heavy data processing
    setTimeout(async () => {
      try {
        setSelectedHeaders(selected);
        setHeaders(selected);  // Only selected headers

        // Filter data to only include selected headers
        const selectedIndices = selected.map(h => allHeaders.indexOf(h));
        const filteredData = data.map(row => 
          selectedIndices.map(idx => row[idx])
        );
        setData(filteredData);
        setIsProcessing(false); // Data filtering done, now analysis starts
        
        // Perform analysis with ONLY selected headers
        // Item-level detection will suggest which go to SKU-level
        await runAnalysis(selected, filteredData);
      } catch (error) {
        setIsProcessing(false);
        console.error('Error during header selection:', error);
      }
    }, 50);
  };

  const runAnalysis = async (
    headersToAnalyze: string[], 
    dataToAnalyze: any[][], 
    customThresholds?: { parent: number; childrenMin: number; childrenMax: number; sku: number; minPropertiesPerLevel?: number },
    selectedHeaders?: string[],  // Optional: user-selected headers for preference
    forcedHeaders?: string[]  // Optional: user-forced SKU-level headers
  ) => {
    try {
      // Use Web Worker for analysis - runs in separate thread to avoid blocking UI
      const result = await analyzeInWorker(headersToAnalyze, dataToAnalyze, customThresholds, forcedHeaders);
      setAnalysisResult(result);
      
      // CRITICAL: Store original analysis result for reset functionality
      // Only store on FIRST analysis (when originalAnalysisResult is null)
      if (!originalAnalysisResult) {
        const clonedResult = JSON.parse(JSON.stringify(result));
        setOriginalAnalysisResult(clonedResult);
        console.log('📦 Stored original analysis result for reset');
      }
      
      // CRITICAL: Store original presets from initial analysis
      // These should NOT be affected by subsequent forcing operations
      if (result.hierarchyPresets && result.hierarchyPresets.length > 0) {
        // Deep clone to prevent mutations
        const clonedPresets = JSON.parse(JSON.stringify(result.hierarchyPresets));
        setOriginalPresets(clonedPresets);
        console.log('📦 Stored original presets:', clonedPresets.length);
      }

      // Build taxonomy tree - use custom config if available, otherwise automatic
      const tree = taxonomyConfig && taxonomyConfig.levels.length > 0
        ? buildCustomTaxonomyTree(taxonomyConfig, dataToAnalyze, headersToAnalyze)
        : buildTaxonomyTree(result.hierarchy, dataToAnalyze, headersToAnalyze);
      setTaxonomyTree(tree);
      
      // CRITICAL: Store original taxonomy tree for consistency across presets
      // This ensures the taxonomy doesn't change when switching between presets
      if (!originalTaxonomyTree) {
        setOriginalTaxonomyTree(tree);
        console.log('📦 Stored original taxonomy tree for preset consistency');
      }

      // Validate data quality with Salsify compliance checks
      // CRITICAL: Pass allHeaders to detect duplicate column names in original file
      const hierarchyHeaders = result.hierarchy.flatMap(h => h.headers);
      const validation = validateData(
        headersToAnalyze, 
        dataToAnalyze, 
        hierarchyHeaders,
        result.recordIdSuggestion || undefined,
        result.recordNameSuggestion || undefined,
        allHeaders // Original headers including duplicates
      );
      setValidationResult(validation);

      toast({
        title: 'Analysis Complete',
        description: `Analyzed ${headersToAnalyze.length} attributes from ${dataToAnalyze.length} products.`,
      });
    } catch (error) {
      console.error('Analysis error:', error);
      toast({
        title: 'Analysis Error',
        description: 'An error occurred during analysis. Please try again.',
        variant: 'destructive',
      });
    }
  };


  const handleSkuLevelForcing = (forcedHeaders: string[]) => {
    if (!analysisResult || forcedHeaders.length === 0) return;
    
    // Save forced headers
    setForcedSkuHeaders(forcedHeaders);
    
    // CRITICAL: Preserve current hierarchy structure, just move properties to SKU level
    // Do NOT rerun full analysis - this would lose the selected preset
    const currentHierarchy = [...analysisResult.hierarchy];
    
    if (currentHierarchy.length < 2) {
      // Flat model - nothing to force
      toast({
        title: 'No Action Needed',
        description: 'All properties are already at SKU-level in this flat model.',
      });
      return;
    }
    
    // Get the SKU level (last level)
    const skuLevel = currentHierarchy[currentHierarchy.length - 1];
    const forcedSet = new Set(forcedHeaders);
    
    console.log('\n🔄 ========== FORCING PROPERTIES TO SKU ==========');
    console.log(`🔄 Properties to force: ${forcedHeaders.length}`, forcedHeaders);
    
    // Remove forced properties from upper levels and add to SKU level
    for (let i = 0; i < currentHierarchy.length - 1; i++) {
      const level = currentHierarchy[i];
      const beforeCount = level.headers.length;
      
      // Filter out forced properties from this level
      const removedProps: string[] = [];
      level.headers = level.headers.filter((h: string) => {
        if (forcedSet.has(h)) {
          removedProps.push(h);
          return false;
        }
        return true;
      });
      
      // Add removed properties to SKU level
      removedProps.forEach(prop => {
        if (!skuLevel.headers.includes(prop)) {
          skuLevel.headers.push(prop);
        }
      });
      
      if (removedProps.length > 0) {
        console.log(`🔄 Level ${i + 1}: Moved ${removedProps.length} properties to SKU:`, removedProps);
      }
      
      // ========================================================================
      // BUG FIX: Re-select Record ID if current one was forced to SKU
      // ========================================================================
      if (level.recordId && forcedSet.has(level.recordId)) {
        console.log(`🔄 Level ${i + 1}: Record ID "${level.recordId}" was forced to SKU. Re-selecting...`);
        
        // Add old Record ID to SKU level
        if (!skuLevel.headers.includes(level.recordId)) {
          skuLevel.headers.push(level.recordId);
        }
        
        // Find new Record ID from remaining headers
        const idKeywords = ['id', 'code', 'key', 'number', 'sku', 'ean', 'gtin'];
        const newRecordId = level.headers.find((h: string) => {
          const lower = h.toLowerCase();
          return idKeywords.some(kw => lower.includes(kw));
        }) || level.headers[0]; // Fallback to first header
        
        if (newRecordId) {
          level.recordId = newRecordId;
          // Remove new Record ID from headers list
          level.headers = level.headers.filter((h: string) => h !== newRecordId);
          console.log(`✅ Level ${i + 1}: New Record ID selected: "${newRecordId}"`);
        } else {
          level.recordId = undefined;
          console.log(`⚠️ Level ${i + 1}: No suitable Record ID found`);
        }
      }
      
      // ========================================================================
      // BUG FIX: Re-select Record Name if current one was forced to SKU
      // ========================================================================
      if (level.recordName && forcedSet.has(level.recordName)) {
        console.log(`🔄 Level ${i + 1}: Record Name "${level.recordName}" was forced to SKU. Re-selecting...`);
        
        // Add old Record Name to SKU level
        if (!skuLevel.headers.includes(level.recordName)) {
          skuLevel.headers.push(level.recordName);
        }
        
        // Find new Record Name from remaining headers
        const nameKeywords = ['name', 'description', 'title', 'label'];
        const newRecordName = level.headers.find((h: string) => {
          const lower = h.toLowerCase();
          return nameKeywords.some(kw => lower.includes(kw));
        });
        
        if (newRecordName) {
          level.recordName = newRecordName;
          // Remove new Record Name from headers list
          level.headers = level.headers.filter((h: string) => h !== newRecordName);
          console.log(`✅ Level ${i + 1}: New Record Name selected: "${newRecordName}"`);
        } else {
          level.recordName = undefined;
          console.log(`⚠️ Level ${i + 1}: No suitable Record Name found`);
        }
      }
    }
    
    console.log(`🔄 SKU level now has ${skuLevel.headers.length} properties`);
    
    // Update analysis result with modified hierarchy (NO automatic consolidation)
    // User has full control over hierarchy structure after manual changes
    const updatedResult = {
      ...analysisResult,
      hierarchy: currentHierarchy,
    };
    
    setAnalysisResult(updatedResult);
    
    // Rebuild taxonomy tree with updated hierarchy
    const tree = taxonomyConfig && taxonomyConfig.levels.length > 0
      ? buildCustomTaxonomyTree(taxonomyConfig, data, headers)
      : buildTaxonomyTree(currentHierarchy, data, headers);
    setTaxonomyTree(tree);
    
    // Revalidate data
    const finalSkuLevel = currentHierarchy[currentHierarchy.length - 1];
    const hierarchyHeaders = currentHierarchy.flatMap((h: any) => h.headers);
    const recordId = finalSkuLevel.recordId;
    const recordName = finalSkuLevel.recordName;
    const validation = validateData(headers, data, hierarchyHeaders, recordId, recordName, allHeaders);
    setValidationResult(validation);
    
    toast({
      title: 'Properties Moved to SKU-Level',
      description: `${forcedHeaders.length} properties moved to SKU-level. Hierarchy structure preserved.`,
    });
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
    
    // ========================================================================
    // BUG FIX: Reset forced SKU headers when changing preset
    // This ensures the preset starts fresh without previous forcing
    // ========================================================================
    if (forcedSkuHeaders.length > 0) {
      console.log('🔵 Resetting forced SKU headers:', forcedSkuHeaders.length);
      setForcedSkuHeaders([]);
    }
    
    // Increment resetKey to trigger SkuLevelForcing component to clear its internal state
    setPresetResetKey(prev => prev + 1);
    
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
    
    // CRITICAL: Use ORIGINAL taxonomy tree for consistency across all presets
    // Only rebuild if user has custom taxonomy config set
    // This prevents taxonomy from changing when switching between Flat/Parent-Variant/Multi-Level
    const tree = taxonomyConfig && taxonomyConfig.levels.length > 0
      ? buildCustomTaxonomyTree(taxonomyConfig, data, headers)
      : originalTaxonomyTree || buildTaxonomyTree(preset.hierarchy, data, headers);
    setTaxonomyTree(tree);
    
    // Revalidate data with Salsify compliance checks
    // CRITICAL: Pass allHeaders to detect duplicate column names
    const hierarchyHeaders = preset.hierarchy.flatMap((h: any) => h.headers);
    const recordId = preset.hierarchy[preset.hierarchy.length - 1]?.recordId;
    const recordName = preset.hierarchy[preset.hierarchy.length - 1]?.recordName;
    const validation = validateData(headers, data, hierarchyHeaders, recordId, recordName, allHeaders);
    setValidationResult(validation);
    
    toast({
      title: 'Preset Applied',
      description: `${preset.name} structure selected. Hierarchy updated.`,
    });
  };

  // Reset to original analysis - restore initial state
  const handleResetToOriginal = () => {
    if (!originalAnalysisResult) {
      toast({
        title: 'No Original Analysis',
        description: 'No original analysis to restore.',
        variant: 'destructive',
      });
      return;
    }
    
    // Deep clone to prevent mutations
    const clonedResult = JSON.parse(JSON.stringify(originalAnalysisResult));
    setAnalysisResult(clonedResult);
    
    // Reset all modification states
    setForcedSkuHeaders([]);
    setSelectedPreset(null);
    setPresetResetKey(prev => prev + 1);
    setDataTypeOverrides({}); // Clear all data type overrides
    setTaxonomyConfig(null); // Reset custom taxonomy configuration
    
    // Rebuild taxonomy tree with original hierarchy (always use default, not custom)
    const tree = buildTaxonomyTree(clonedResult.hierarchy, data, headers);
    setTaxonomyTree(tree);
    setOriginalTaxonomyTree(tree); // Also update original taxonomy for future preset switches
    
    // Revalidate with original data
    const hierarchyHeaders = clonedResult.hierarchy.flatMap((h: any) => h.headers);
    const recordId = clonedResult.recordIdSuggestion;
    const recordName = clonedResult.recordNameSuggestion;
    const validation = validateData(headers, data, hierarchyHeaders, recordId, recordName, allHeaders);
    setValidationResult(validation);
    
    toast({
      title: 'Analysis Reset',
      description: 'Restored to original analysis. All manual changes have been cleared.',
    });
  };

  const handleExportPDF = () => {
    if (!analysisResult || !taxonomyTree) return;

    try {
      generatePDFReport(analysisResult, headers, data, taxonomyTree, validationResult, dataTypeOverrides);
      
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
                Customer Data Analyzer
              </h1>
              <p className="text-muted-foreground mt-1">
                Intelligent structure detection for customer data
              </p>
            </div>
            {analysisResult && (
              <div className="flex items-center gap-2">
                {originalAnalysisResult && (
                  <Button variant="outline" className="gap-2" onClick={handleResetToOriginal}>
                    <RotateCcw className="w-4 h-4" />
                    <span className="hidden sm:inline">Reset</span>
                  </Button>
                )}
                <Button className="gap-2" onClick={handleExportPDF}>
                  <FileText className="w-4 h-4" />
                  <span className="hidden sm:inline">Export PDF Report</span>
                </Button>
              </div>
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

          {/* Loading Overlay - Shows while processing or analyzing */}
          {showLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center"
            >
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-card p-8 rounded-xl shadow-elevated flex flex-col items-center gap-5 min-w-[360px]"
              >
                <div className="relative">
                  <Loader2 className="w-12 h-12 text-primary animate-spin" />
                </div>
                <div className="text-center space-y-1">
                  <h3 className="text-lg font-semibold">
                    {isProcessing ? 'Preparing Data...' : 'Analyzing Data'}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {data.length.toLocaleString()} products • {allHeaders.length || headers.length} attributes
                  </p>
                </div>
                {/* Real progress bar */}
                <div className="w-full space-y-2">
                  <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
                    <motion.div 
                      className="h-full bg-primary rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: isProcessing ? '10%' : `${progress.percent}%` }}
                      transition={{ duration: 0.3, ease: "easeOut" }}
                    />
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-muted-foreground">
                      {isProcessing ? 'Filtering selected columns...' : progress.step}
                    </span>
                    <span className="font-medium text-primary">
                      {isProcessing ? '10%' : `${progress.percent}%`}
                    </span>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
          
          {!showHeaderSelection && data.length > 0 && (
            <>
              <DataPreview headers={headers} data={data} />

              {analysisResult && (
                <>
                  {/* NEW: Preset Selector - Choose structure type */}
                  {/* CRITICAL: Use originalPresets to ensure presets are not affected by forcing operations */}
                  {originalPresets.length > 0 && (
                    <PresetSelector
                      presets={originalPresets}
                      onSelectPreset={handlePresetSelection}
                      selectedPreset={selectedPreset}
                    />
                  )}
                  
                  {/* SKU-Level Forcing - Force properties to SKU-level */}
                  <SkuLevelForcing
                    headers={headers}
                    currentHierarchy={analysisResult.hierarchy}
                    onApply={handleSkuLevelForcing}
                    resetKey={presetResetKey}
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
                    onHierarchyChange={(newHierarchy) => {
                      // Recalculate propertiesWithoutValues based on new hierarchy
                      const hasValues = (header: string): boolean => {
                        const headerIndex = headers.indexOf(header);
                        if (headerIndex === -1) return false;
                        return data.some(row => {
                          const val = row[headerIndex];
                          return val !== null && val !== undefined && String(val).trim() !== '';
                        });
                      };
                      
                      const newPropertiesWithoutValues: string[] = [];
                      newHierarchy.forEach(level => {
                        level.headers.forEach((header: string) => {
                          if (!hasValues(header)) {
                            newPropertiesWithoutValues.push(header);
                          }
                        });
                      });
                      
                      // Update analysis result with new hierarchy
                      setAnalysisResult({
                        ...analysisResult,
                        hierarchy: newHierarchy,
                        propertiesWithoutValues: newPropertiesWithoutValues,
                        // Update recordIdSuggestion and recordNameSuggestion based on last level
                        recordIdSuggestion: newHierarchy[newHierarchy.length - 1]?.recordId || null,
                        recordNameSuggestion: newHierarchy[newHierarchy.length - 1]?.recordName || null,
                      });
                      
                      toast({
                        title: 'Hierarchy Updated',
                        description: 'Record ID/Name assignment has been changed.',
                      });
                    }}
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
                    dataTypeOverrides={dataTypeOverrides}
                    onDataTypeChange={(propertyName, newType) => {
                      setDataTypeOverrides(prev => ({
                        ...prev,
                        [propertyName]: newType
                      }));
                    }}
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
          <p>Customer Data Analyzer - Intelligent structure detection for customer data</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
