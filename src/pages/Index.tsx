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
    }
    
    console.log(`🔄 SKU level now has ${skuLevel.headers.length} properties`);
    
    // ============================================================================
    // CONSOLIDATION: Merge levels that have too few properties after forcing
    // Minimum properties per level = 6 (same as analysis engine)
    // CRITICAL: NEVER lose data - all properties must be accounted for
    // ============================================================================
    const MIN_PROPERTIES_PER_LEVEL = 6;
    let consolidatedHierarchy = [...currentHierarchy];
    let structureChanged = false;
    
    // SAFETY: Count all properties BEFORE consolidation
    const allPropsBefore = new Set<string>();
    consolidatedHierarchy.forEach(level => {
      level.headers.forEach((h: string) => allPropsBefore.add(h));
      if (level.recordId) allPropsBefore.add(level.recordId);
      if (level.recordName) allPropsBefore.add(level.recordName);
    });
    console.log(`🔄 Total unique properties BEFORE consolidation: ${allPropsBefore.size}`);
    
    // Check ALL non-last levels for consolidation (including Level 1)
    // Iterate from second-to-last backwards to first (index 0)
    for (let i = consolidatedHierarchy.length - 2; i >= 0; i--) {
      const level = consolidatedHierarchy[i];
      const totalProps = level.headers.length + (level.recordId ? 1 : 0) + (level.recordName ? 1 : 0);
      
      // Only consolidate if we have more than 1 level remaining
      if (totalProps < MIN_PROPERTIES_PER_LEVEL && consolidatedHierarchy.length > 1) {
        console.log(`🔄 Level ${i + 1} has only ${totalProps} properties (< ${MIN_PROPERTIES_PER_LEVEL}). Merging into next level.`);
        
        // Move all properties from this level to next level (or SKU level if this is Level 1)
        const targetLevel = consolidatedHierarchy[i + 1] || consolidatedHierarchy[consolidatedHierarchy.length - 1];
        
        // CRITICAL: Move ALL headers to target level
        level.headers.forEach((h: string) => {
          if (!targetLevel.headers.includes(h)) {
            targetLevel.headers.push(h);
            console.log(`🔄 Moved header "${h}" to level ${i + 2}`);
          }
        });
        
        // CRITICAL: If this level had a Record ID that's not used elsewhere, add it to headers
        if (level.recordId && level.recordId !== targetLevel.recordId && level.recordId !== targetLevel.recordName) {
          if (!targetLevel.headers.includes(level.recordId)) {
            targetLevel.headers.push(level.recordId);
            console.log(`🔄 Moved Record ID "${level.recordId}" to level ${i + 2} headers`);
          }
        }
        
        // CRITICAL: If this level had a Record Name that's not used elsewhere, add it to headers
        if (level.recordName && level.recordName !== targetLevel.recordId && level.recordName !== targetLevel.recordName) {
          if (!targetLevel.headers.includes(level.recordName)) {
            targetLevel.headers.push(level.recordName);
            console.log(`🔄 Moved Record Name "${level.recordName}" to level ${i + 2} headers`);
          }
        }
        
        // Remove this level from hierarchy
        consolidatedHierarchy.splice(i, 1);
        structureChanged = true;
      }
    }
    
    // Update level numbers after consolidation
    consolidatedHierarchy = consolidatedHierarchy.map((level, idx) => ({
      ...level,
      level: idx + 1,
    }));
    
    // ============================================================================
    // SAFETY NET: Verify NO properties were lost during consolidation
    // ============================================================================
    const allPropsAfter = new Set<string>();
    consolidatedHierarchy.forEach(level => {
      level.headers.forEach((h: string) => allPropsAfter.add(h));
      if (level.recordId) allPropsAfter.add(level.recordId);
      if (level.recordName) allPropsAfter.add(level.recordName);
    });
    console.log(`🔄 Total unique properties AFTER consolidation: ${allPropsAfter.size}`);
    
    // Check for missing properties
    const missingProps = Array.from(allPropsBefore).filter(p => !allPropsAfter.has(p));
    if (missingProps.length > 0) {
      console.error(`❌ CRITICAL: ${missingProps.length} properties were LOST during consolidation:`, missingProps);
      
      // RECOVERY: Add missing properties to SKU level
      const skuLevel = consolidatedHierarchy[consolidatedHierarchy.length - 1];
      missingProps.forEach(prop => {
        if (!skuLevel.headers.includes(prop) && prop !== skuLevel.recordId && prop !== skuLevel.recordName) {
          skuLevel.headers.push(prop);
          console.log(`✅ RECOVERED: Added missing property "${prop}" to SKU level`);
        }
      });
    } else {
      console.log(`✅ SUCCESS: All properties accounted for after consolidation`);
    }
    
    if (structureChanged) {
      console.log(`🔄 Hierarchy consolidated from ${currentHierarchy.length} to ${consolidatedHierarchy.length} levels`);
    }
    
    // Determine new structure name based on level count
    const newStructureName = consolidatedHierarchy.length === 1 
      ? 'Flat Model' 
      : consolidatedHierarchy.length === 2 
        ? 'Parent-Variant' 
        : 'Multi-Level';
    
    // Update analysis result with modified hierarchy
    const updatedResult = {
      ...analysisResult,
      hierarchy: consolidatedHierarchy,
    };
    
    setAnalysisResult(updatedResult);
    
    // Clear selected preset if structure changed
    if (structureChanged && selectedPreset) {
      setSelectedPreset(null);
    }
    
    // Rebuild taxonomy tree with updated hierarchy
    const tree = taxonomyConfig && taxonomyConfig.levels.length > 0
      ? buildCustomTaxonomyTree(taxonomyConfig, data, headers)
      : buildTaxonomyTree(consolidatedHierarchy, data, headers);
    setTaxonomyTree(tree);
    
    // Revalidate data
    // CRITICAL: Pass allHeaders to detect duplicate column names
    const finalSkuLevel = consolidatedHierarchy[consolidatedHierarchy.length - 1];
    const hierarchyHeaders = consolidatedHierarchy.flatMap((h: any) => h.headers);
    const recordId = finalSkuLevel.recordId;
    const recordName = finalSkuLevel.recordName;
    const validation = validateData(headers, data, hierarchyHeaders, recordId, recordName, allHeaders);
    setValidationResult(validation);
    
    // Show appropriate toast message
    if (structureChanged) {
      toast({
        title: 'Hierarchy Structure Updated',
        description: `${forcedHeaders.length} properties moved to SKU-level. Structure changed to ${newStructureName} (${consolidatedHierarchy.length} levels).`,
      });
    } else {
      toast({
        title: 'Properties Moved to SKU-Level',
        description: `${forcedHeaders.length} properties moved to SKU-level. Hierarchy structure preserved.`,
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
