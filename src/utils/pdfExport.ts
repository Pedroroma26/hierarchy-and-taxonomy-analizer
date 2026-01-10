import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { AnalysisResult } from './analysisEngine';
import { TaxonomyTreeNode } from './exportReport';

// Extend jsPDF type to include autoTable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: typeof autoTable;
    lastAutoTable: {
      finalY: number;
    };
  }
}

// Professional color palette - Executive style
const COLORS = {
  primary: [30, 64, 175] as [number, number, number],      // Deep Blue
  primaryLight: [59, 130, 246] as [number, number, number], // Blue-500
  success: [22, 163, 74] as [number, number, number],      // Green-600
  successLight: [220, 252, 231] as [number, number, number], // Green-100
  warning: [217, 119, 6] as [number, number, number],      // Amber-600
  warningLight: [254, 243, 199] as [number, number, number], // Amber-100
  danger: [185, 28, 28] as [number, number, number],       // Red-700
  dangerLight: [254, 226, 226] as [number, number, number], // Red-100
  gray: [107, 114, 128] as [number, number, number],       // Gray-500
  grayLight: [249, 250, 251] as [number, number, number],  // Gray-50
  grayMedium: [229, 231, 235] as [number, number, number], // Gray-200
  white: [255, 255, 255] as [number, number, number],
  black: [17, 24, 39] as [number, number, number],         // Gray-900
};

/**
 * Convert taxonomy tree to clean ASCII art with better formatting
 */
const treeToCleanAscii = (node: TaxonomyTreeNode, prefix: string = '', isLast: boolean = true, isRoot: boolean = true): string => {
  let result = '';
  
  if (!isRoot) {
    const connector = isLast ? '+--- ' : '+--- ';
    const productText = node.productCount === 1 ? '1 product' : `${node.productCount} products`;
    result += prefix + connector + `${node.name} (${productText})\n`;
  } else if (node.name !== 'Root') {
    const productText = node.productCount === 1 ? '1 product' : `${node.productCount} products`;
    result += `${node.name} (${productText})\n`;
  }

  const childPrefix = !isRoot ? prefix + (isLast ? '    ' : '|   ') : '';
  
  node.children.forEach((child, index) => {
    const isLastChild = index === node.children.length - 1;
    result += treeToCleanAscii(child, childPrefix, isLastChild, false);
  });

  return result;
};

/**
 * Generate a comprehensive PDF report
 */
export const generatePDFReport = (
  analysisResult: AnalysisResult,
  headers: string[],
  data: any[][],
  taxonomyTree: TaxonomyTreeNode,
  validationResult?: any
): void => {
  const doc = new jsPDF();
  let yPosition = 20;

  // Helper function to add a new page if needed (leave space for footer)
  const checkPageBreak = (requiredSpace: number = 20) => {
    if (yPosition + requiredSpace > 260) {
      doc.addPage();
      yPosition = 25;
      return true;
    }
    return false;
  };

  // Helper to add section title with accent bar
  const addSectionTitle = (title: string, color: [number, number, number] = COLORS.primary) => {
    checkPageBreak(25);
    doc.setFillColor(...color);
    doc.rect(15, yPosition - 5, 4, 12, 'F');
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.black);
    doc.text(title, 22, yPosition + 3);
    yPosition += 15;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
  };

  // Helper to add subtitle
  const addSubtitle = (text: string) => {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.gray);
    doc.text(text, 22, yPosition);
    doc.setTextColor(...COLORS.black);
    yPosition += 8;
  };

  // Get selected preset info
  const selectedPreset = analysisResult.alternativeHierarchies.find(
    h => h.hierarchy.length === analysisResult.hierarchy.length
  );
  const modelType = selectedPreset?.modelType || 'Custom';
  const modelName = selectedPreset?.name || 'Custom Configuration';

  // ===== PAGE 1: EXECUTIVE SUMMARY =====
  // Clean header bar
  doc.setFillColor(...COLORS.primary);
  doc.rect(0, 0, 210, 40, 'F');
  
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.white);
  doc.text('Product Data Model Analysis', 105, 22, { align: 'center' });
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text('Executive Summary Report', 105, 32, { align: 'center' });
  
  // Report metadata
  const reportDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  
  doc.setTextColor(...COLORS.black);
  yPosition = 50;
  
  // Key Metrics Row - 4 cards
  const totalProps = headers.length;
  const totalProducts = data.length;
  const hierarchyLevels = analysisResult.hierarchy.filter(h => h.headers.length > 0).length;
  const dataQuality = analysisResult.orphanedRecords.length === 0 ? 100 : 
    Math.round(((totalProducts - analysisResult.orphanedRecords.length) / totalProducts) * 100);
  
  const metrics = [
    { value: totalProducts.toLocaleString(), label: 'Products', color: COLORS.primary },
    { value: totalProps.toString(), label: 'Properties', color: COLORS.primaryLight },
    { value: hierarchyLevels.toString(), label: 'Hierarchy Levels', color: COLORS.success },
    { value: `${dataQuality}%`, label: 'Data Quality', color: dataQuality >= 95 ? COLORS.success : dataQuality >= 80 ? COLORS.warning : COLORS.danger },
  ];
  
  const metricWidth = 42;
  const metricGap = 5;
  const startX = 15;
  
  metrics.forEach((metric, i) => {
    const x = startX + (metricWidth + metricGap) * i;
    doc.setFillColor(...metric.color);
    doc.roundedRect(x, yPosition, metricWidth, 28, 3, 3, 'F');
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.white);
    doc.text(metric.value, x + metricWidth/2, yPosition + 14, { align: 'center' });
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text(metric.label, x + metricWidth/2, yPosition + 22, { align: 'center' });
  });
  
  yPosition += 38;
  
  // Model Type - Clean badge
  doc.setFillColor(...COLORS.grayLight);
  doc.roundedRect(15, yPosition, 180, 20, 3, 3, 'F');
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.gray);
  doc.text('Recommended Model:', 22, yPosition + 13);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.primary);
  doc.text(modelName, 75, yPosition + 13);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.gray);
  doc.text(`Generated: ${reportDate}`, 175, yPosition + 13, { align: 'right' });
  
  doc.setTextColor(...COLORS.black);
  yPosition += 30;

  // ===== HIERARCHY VISUALIZATION (cleaner, lighter design) =====
  const levelColors: { [key: number]: [number, number, number] } = {
    1: [59, 130, 246],   // Blue for Level 1
    2: [34, 197, 94],    // Green for Level 2
    3: [239, 68, 68],    // Red for Level 3
  };

  const hierarchyLevelsList = analysisResult.hierarchy.filter(level => level.headers.length > 0);
  
  hierarchyLevelsList.forEach((level, levelIndex) => {
      const levelColor = levelColors[level.level] || COLORS.primary;
      const propsWithoutIdName = level.headers.filter(
        h => h !== level.recordId && h !== level.recordName
      );
      const propsPerRow = 3;
      const propRows = Math.ceil(propsWithoutIdName.length / propsPerRow);
      const boxHeight = 55 + propRows * 12;
      
      checkPageBreak(boxHeight + 15);
      
      // Calculate starting Y for this box
      const boxStartY = yPosition;
      
      // Level container with border only (lighter)
      doc.setDrawColor(...levelColor);
      doc.setLineWidth(1.5);
      doc.roundedRect(15, boxStartY, 180, boxHeight, 6, 6, 'S');
      
      // Level title bar (clean, no overlay)
      doc.setFillColor(...levelColor);
      doc.rect(15, boxStartY, 180, 18, 'F');
      // Round top corners only by overlaying
      doc.setFillColor(...levelColor);
      doc.roundedRect(15, boxStartY, 180, 12, 6, 6, 'F');
      
      // Level title
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...COLORS.white);
      doc.text(`Level ${level.level}: ${level.name}`, 22, boxStartY + 12);
      
      // Record ID and Record Name (clean layout)
      yPosition = boxStartY + 26;
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...COLORS.gray);
      doc.text('Record ID:', 22, yPosition);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...levelColor);
      doc.text(level.recordId || 'Not set', 50, yPosition);
      
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...COLORS.gray);
      doc.text('Record Name:', 100, yPosition);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...levelColor);
      doc.text(level.recordName || 'Not set', 138, yPosition);
      
      // Properties section
      yPosition += 12;
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...COLORS.gray);
      doc.text('Properties:', 22, yPosition);
      yPosition += 8;
      
      // Properties as pills (bigger, more readable)
      let propX = 22;
      const maxWidth = 175;
      
      propsWithoutIdName.forEach(prop => {
        doc.setFontSize(8);
        const propWidth = doc.getTextWidth(prop) + 10;
        
        if (propX + propWidth > maxWidth) {
          propX = 22;
          yPosition += 11;
        }
        
        // Light pill background
        doc.setFillColor(...COLORS.grayLight);
        doc.roundedRect(propX, yPosition - 6, propWidth, 9, 2, 2, 'F');
        
        // Property text
        doc.setTextColor(...COLORS.black);
        doc.text(prop, propX + 5, yPosition);
        
        propX += propWidth + 4;
      });
      
      doc.setTextColor(...COLORS.black);
      yPosition += 20;
    });

  // Add spacing after hierarchy boxes
  yPosition += 5;

  // ===== PAGE 2: TAXONOMY =====
  doc.addPage();
  yPosition = 25;
  
  addSectionTitle('Product Taxonomy');
  addSubtitle('Category structure derived from your data');
  
  // Taxonomy Properties Legend
  const taxonomyProps = taxonomyTree.taxonomyProperties || [];
  if (taxonomyProps.length > 0) {
    doc.setFillColor(...COLORS.grayLight);
    doc.roundedRect(15, yPosition, 180, 20, 3, 3, 'F');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.primary);
    doc.text('Taxonomy Properties (per level):', 20, yPosition + 8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.black);
    
    const propsText = taxonomyProps.map((p, i) => `L${i + 1}: ${p}`).join('  |  ');
    doc.text(propsText, 20, yPosition + 15);
    yPosition += 28;
  }
  
  // Taxonomy Validation Status (OK/NOK for parent level)
  const level1Headers = analysisResult.hierarchy.find(h => h.level === 1)?.headers || [];
  if (taxonomyProps.length > 0) {
    const taxonomyOk = taxonomyProps.filter(p => level1Headers.includes(p));
    const taxonomyNok = taxonomyProps.filter(p => !level1Headers.includes(p));
    
    const taxBgColor = taxonomyNok.length === 0 ? COLORS.successLight : COLORS.warningLight;
    const taxColor = taxonomyNok.length === 0 ? COLORS.success : COLORS.warning;
    
    doc.setFillColor(...taxBgColor);
    const boxHeight = 18 + (taxonomyOk.length > 0 ? 10 : 0) + (taxonomyNok.length > 0 ? 10 : 0);
    doc.roundedRect(15, yPosition, 180, boxHeight, 3, 3, 'F');
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...taxColor);
    doc.text('Taxonomy Property Placement', 22, yPosition + 10);
    yPosition += 16;
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    
    if (taxonomyOk.length > 0) {
      doc.setTextColor(...COLORS.success);
      doc.text(`✓ At Parent Level: ${taxonomyOk.join(', ')}`, 25, yPosition);
      yPosition += 10;
    }
    if (taxonomyNok.length > 0) {
      doc.setTextColor(...COLORS.danger);
      doc.text(`✗ Not at Parent Level: ${taxonomyNok.join(', ')}`, 25, yPosition);
      yPosition += 10;
    }
    
    yPosition += 8;
  }
  
  addSubtitle('Product category tree visualization');
  
  const treeAscii = treeToCleanAscii(taxonomyTree);
  const treeLines = treeAscii.split('\n').slice(0, 50);
  
  doc.setFont('courier', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.black);
  
  treeLines.forEach(line => {
    if (checkPageBreak(5)) {
      doc.setFont('courier', 'normal');
      doc.setFontSize(8);
    }
    doc.text(line.substring(0, 100), 15, yPosition);
    yPosition += 4;
  });
  
  if (treeLines.length >= 50) {
    yPosition += 3;
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.gray);
    doc.text('(Tree truncated - full tree available in application)', 15, yPosition);
    doc.setTextColor(...COLORS.black);
  }

  // ===== PAGE 4: ALL PROPERTIES =====
  doc.addPage();
  yPosition = 25;
  
  addSectionTitle('Property Recommendations');
  addSubtitle('Complete list of properties with data types and hierarchy placement');

  // Find which level each property belongs to - returns numeric level for sorting
  const getPropertyLevelNum = (prop: string): number => {
    for (const level of analysisResult.hierarchy) {
      // Check headers, recordId, and recordName
      if (level.headers.includes(prop) || level.recordId === prop || level.recordName === prop) {
        return level.level;
      }
    }
    if (analysisResult.properties.includes(prop)) return 99; // SKU level last
    return 100; // Unknown
  };

  const getPropertyLevelText = (prop: string): string => {
    for (const level of analysisResult.hierarchy) {
      // Check headers, recordId, and recordName
      if (level.headers.includes(prop) || level.recordId === prop || level.recordName === prop) {
        return `L${level.level}`;
      }
    }
    if (analysisResult.properties.includes(prop)) return 'SKU';
    return '-';
  };

  // Find role (Record ID/Name) and which level it belongs to
  const getPropertyRole = (prop: string): string => {
    for (const level of analysisResult.hierarchy) {
      if (level.recordId === prop) return `Record ID`;
      if (level.recordName === prop) return `Record Name`;
    }
    return '-';
  };

  // Get role priority for sorting (Record ID = 0, Record Name = 1, others = 2)
  const getRolePriority = (role: string): number => {
    if (role === 'Record ID') return 0;
    if (role === 'Record Name') return 1;
    return 2;
  };

  // Sort properties by: 1) Level, 2) Role (ID first, Name second, others last)
  const sortedPropertyData = analysisResult.propertyRecommendations
    .map(prop => {
      const levelNum = getPropertyLevelNum(prop.header);
      const levelText = getPropertyLevelText(prop.header);
      const role = getPropertyRole(prop.header);
      const rolePriority = getRolePriority(role);
      return {
        data: [
          prop.header,
          prop.dataType,
          levelText,
          role
        ],
        levelNum,
        rolePriority
      };
    })
    .sort((a, b) => {
      // First sort by level
      if (a.levelNum !== b.levelNum) return a.levelNum - b.levelNum;
      // Then sort by role priority
      return a.rolePriority - b.rolePriority;
    })
    .map(item => item.data);

  autoTable(doc, {
    startY: yPosition,
    head: [['Property', 'Data Type', 'Level', 'Role']],
    body: sortedPropertyData,
    theme: 'grid',
    headStyles: { 
      fillColor: COLORS.primary,
      textColor: COLORS.white,
      fontStyle: 'bold',
      fontSize: 9
    },
    bodyStyles: {
      fontSize: 9,
      textColor: COLORS.black
    },
    alternateRowStyles: {
      fillColor: COLORS.grayLight
    },
    margin: { left: 15, right: 15 },
    columnStyles: {
      0: { cellWidth: 70 },
      1: { cellWidth: 40 },
      2: { cellWidth: 25 },
      3: { cellWidth: 45 }
    },
    didParseCell: (data) => {
      if (data.column.index === 3 && data.cell.text[0] !== '-' && data.section === 'body') {
        data.cell.styles.fillColor = [219, 234, 254];
        data.cell.styles.fontStyle = 'bold';
      }
    }
  });

  // ===== PAGE 4: DATA QUALITY & RECOMMENDATIONS =====
  doc.addPage();
  yPosition = 25;
  
  addSectionTitle('Data Quality Assessment', COLORS.primary);
  
  // Data Quality Score Card
  const qualityScore = dataQuality;
  const qualityColor = qualityScore >= 95 ? COLORS.success : qualityScore >= 80 ? COLORS.warning : COLORS.danger;
  const qualityBgColor = qualityScore >= 95 ? COLORS.successLight : qualityScore >= 80 ? COLORS.warningLight : COLORS.dangerLight;
  
  doc.setFillColor(...qualityBgColor);
  doc.roundedRect(15, yPosition, 180, 35, 4, 4, 'F');
  
  // Score circle
  doc.setFillColor(...qualityColor);
  doc.circle(45, yPosition + 17, 12, 'F');
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.white);
  doc.text(`${qualityScore}%`, 45, yPosition + 21, { align: 'center' });
  
  // Quality text
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...qualityColor);
  const qualityLabel = qualityScore >= 95 ? 'Excellent' : qualityScore >= 80 ? 'Good' : 'Needs Attention';
  doc.text(`Data Quality: ${qualityLabel}`, 65, yPosition + 14);
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.gray);
  const incompleteCount = analysisResult.orphanedRecords.length;
  doc.text(`${totalProducts - incompleteCount} of ${totalProducts} products are complete`, 65, yPosition + 24);
  
  yPosition += 45;
  
  // Critical Issues (if any)
  const criticalIssues: string[] = [];
  if (!analysisResult.recordIdSuggestion) criticalIssues.push('Missing Record ID - Required for Salsify import');
  if (!analysisResult.recordNameSuggestion) criticalIssues.push('Missing Record Name - Recommended for display');
  
  // Add validation warnings to critical issues (EXCLUDE duplicate_header - shown in Best Practices)
  if (validationResult && validationResult.warnings) {
    const highSeverityWarnings = validationResult.warnings.filter((w: any) => 
      w.severity === 'high' && w.type !== 'duplicate_header'
    );
    highSeverityWarnings.forEach((w: any) => {
      const rowsText = w.affectedRows && w.affectedRows.length > 0 
        ? ` (Rows: ${w.affectedRows.slice(0, 5).join(', ')}${w.affectedRows.length > 5 ? '...' : ''})` 
        : '';
      criticalIssues.push(`${w.title}: ${w.affectedCount} affected${rowsText}`);
    });
  }
  
  if (criticalIssues.length > 0) {
    checkPageBreak(20 + criticalIssues.length * 10);
    doc.setFillColor(...COLORS.dangerLight);
    doc.roundedRect(15, yPosition, 180, 15 + criticalIssues.length * 9, 3, 3, 'F');
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.danger);
    doc.text('Action Required', 22, yPosition + 10);
    yPosition += 16;
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.black);
    criticalIssues.forEach(issue => {
      doc.text(`• ${issue}`, 25, yPosition);
      yPosition += 9;
    });
    yPosition += 10;
  } else {
    doc.setFillColor(...COLORS.successLight);
    doc.roundedRect(15, yPosition, 180, 18, 3, 3, 'F');
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.success);
    doc.text('✓ All critical checks passed - Ready for import', 22, yPosition + 12);
    yPosition += 28;
  }
  
  // ===== BEST PRACTICES & RECOMMENDATIONS =====
  yPosition += 10;
  checkPageBreak(60);
  addSectionTitle('Best Practices & Recommendations', COLORS.success);
  
  // Duplicate Column Names Warning (moved from Action Required for better formatting)
  const duplicateHeaderWarning = validationResult?.warnings?.find((w: any) => w.type === 'duplicate_header');
  if (duplicateHeaderWarning) {
    const examples = duplicateHeaderWarning.examples || [];
    const boxHeight = 40 + Math.min(examples.length, 5) * 12;
    checkPageBreak(boxHeight + 10);
    
    // Warning box
    doc.setFillColor(...COLORS.warningLight);
    doc.roundedRect(15, yPosition, 180, boxHeight, 3, 3, 'F');
    
    // Title with icon
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.warning);
    doc.text('Duplicate Column Names Detected', 22, yPosition + 12);
    
    // Badge with count
    doc.setFillColor(...COLORS.warning);
    doc.roundedRect(150, yPosition + 5, 40, 14, 2, 2, 'F');
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text(`${duplicateHeaderWarning.affectedCount} found`, 155, yPosition + 14);
    
    // Description
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.black);
    doc.text('Only the first occurrence of each duplicated column is analyzed. Data in duplicate columns may be ignored.', 22, yPosition + 24);
    
    // Examples
    yPosition += 32;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.gray);
    doc.text('Duplicates:', 22, yPosition);
    yPosition += 8;
    
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.black);
    examples.slice(0, 5).forEach((ex: string) => {
      doc.text(`• ${ex}`, 25, yPosition);
      yPosition += 10;
    });
    if (examples.length > 5) {
      doc.setTextColor(...COLORS.gray);
      doc.text(`... and ${examples.length - 5} more`, 25, yPosition);
      yPosition += 10;
    }
    
    yPosition += 8;
  }
  
  // UOM Split Recommendations
  const uomSplits = analysisResult.uomSuggestions.filter(uom => uom.suggestedSplit);
  if (uomSplits.length > 0) {
    checkPageBreak(20 + Math.min(uomSplits.length, 5) * 10);
    doc.setFillColor(...COLORS.warningLight);
    doc.roundedRect(15, yPosition, 180, 16 + Math.min(uomSplits.length, 5) * 10, 3, 3, 'F');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.warning);
    doc.text(`UOM Fields to Split (${uomSplits.length} found)`, 22, yPosition + 10);
    yPosition += 16;
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.black);
    uomSplits.slice(0, 5).forEach(uom => {
      const splitText = `${uom.header}  ->  "${uom.header}" + "${uom.header} UOM"`;
      doc.text(splitText, 25, yPosition);
      yPosition += 10;
    });
    if (uomSplits.length > 5) {
      doc.setTextColor(...COLORS.gray);
      doc.text(`... and ${uomSplits.length - 5} more`, 25, yPosition);
      yPosition += 10;
    }
    yPosition += 5;
  }
  
  // General Recommendations
  const recommendations: string[] = [];
  
  if (!analysisResult.recordIdSuggestion) {
    recommendations.push('Define a Record ID field - Required for Salsify import');
  }
  if (!analysisResult.recordNameSuggestion) {
    recommendations.push('Define a Record Name field - Recommended for product display');
  }
  if (uomSplits.length > 0) {
    recommendations.push(`Split ${uomSplits.length} UOM fields into separate value and unit columns`);
  }
  
  if (recommendations.length > 0) {
    checkPageBreak(20 + recommendations.length * 10);
    doc.setFillColor(...COLORS.grayLight);
    doc.roundedRect(15, yPosition, 180, 14 + recommendations.length * 9, 3, 3, 'F');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.primary);
    doc.text('Action Items', 22, yPosition + 10);
    yPosition += 16;
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.black);
    recommendations.forEach((rec, i) => {
      doc.text(`${i + 1}. ${rec}`, 25, yPosition);
      yPosition += 9;
    });
    yPosition += 8;
  }
  
  // ===== INCOMPLETE PRODUCTS SECTION (like in the app) =====
  if (analysisResult.orphanedRecords.length > 0) {
    const orphanedCount = analysisResult.orphanedRecords.length;
    const totalProducts = data.length;
    const incompletePercent = ((orphanedCount / totalProducts) * 100).toFixed(1);
    const completeCount = totalProducts - orphanedCount;
    
    // Calculate box height based on examples
    const maxExamples = 3;
    const exampleHeight = 35; // Height per example row
    const boxHeight = 70 + Math.min(orphanedCount, maxExamples) * exampleHeight;
    
    checkPageBreak(boxHeight + 10);
    
    // Main container
    doc.setFillColor(...COLORS.warningLight);
    doc.roundedRect(15, yPosition, 180, boxHeight, 3, 3, 'F');
    
    // Header with icon and badge
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.warning);
    doc.text(`${orphanedCount} of ${totalProducts} Products Have Missing Data`, 22, yPosition + 12);
    
    // Badge
    doc.setFillColor(...COLORS.warning);
    doc.roundedRect(165, yPosition + 5, 25, 12, 2, 2, 'F');
    doc.setFontSize(7);
    doc.setTextColor(255, 255, 255);
    doc.text('DATA QUALITY', 167, yPosition + 13);
    
    // Subtitle
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.gray);
    doc.text(`${incompletePercent}% incomplete. Missing data.`, 22, yPosition + 22);
    
    // Impact box
    yPosition += 28;
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(20, yPosition, 170, 16, 2, 2, 'F');
    doc.setDrawColor(...COLORS.grayMedium);
    doc.rect(20, yPosition, 170, 16);
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.black);
    doc.text('Impact:', 25, yPosition + 6);
    doc.setFont('helvetica', 'normal');
    doc.text(`${completeCount} products OK. ${orphanedCount} need data completion.`, 25, yPosition + 13);
    
    // Examples section
    yPosition += 22;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.gray);
    doc.text('Examples / Actions:', 22, yPosition);
    yPosition += 6;
    
    // Show up to 3 examples with missing fields - use autoTable for consistent styling
    const exampleRows = analysisResult.orphanedRecords.slice(0, maxExamples).map((orphan: any, idx: number) => {
      const rowNum = orphan.rowIndex !== undefined ? orphan.rowIndex + 2 : idx + 2;
      const missingFields = orphan.issues 
        ? orphan.issues.map((issue: string) => issue.replace('Missing value for hierarchy field: ', '').replace('Missing value for: ', '')).slice(0, 8).join(', ')
        : 'Multiple fields';
      return [`Row ${rowNum}`, `Missing: ${missingFields}${orphan.issues && orphan.issues.length > 8 ? '...' : ''}`];
    });
    
    autoTable(doc, {
      startY: yPosition,
      head: [],
      body: exampleRows,
      theme: 'plain',
      styles: {
        fontSize: 8,
        cellPadding: 3,
        textColor: COLORS.black,
        font: 'helvetica',
      },
      columnStyles: {
        0: { cellWidth: 25, fontStyle: 'bold', textColor: COLORS.warning },
        1: { cellWidth: 145 },
      },
      margin: { left: 22, right: 22 },
      tableWidth: 170,
    });
    
    yPosition = doc.lastAutoTable.finalY + 5;
    
    if (orphanedCount > maxExamples) {
      doc.setFontSize(8);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(...COLORS.gray);
      doc.text(`... and ${orphanedCount - maxExamples} more products with missing data`, 22, yPosition);
      yPosition += 8;
    }
    
    yPosition += 10;
  } else {
    // All products complete
    checkPageBreak(25);
    doc.setFillColor(...COLORS.successLight);
    doc.roundedRect(15, yPosition, 180, 18, 3, 3, 'F');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.success);
    doc.text('✓ All products have complete data', 22, yPosition + 12);
    yPosition += 26;
  }
  
  // ===== FOOTER ON EACH PAGE =====
  const pageCount = doc.getNumberOfPages();
  
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    // Footer line
    doc.setDrawColor(...COLORS.grayMedium);
    doc.line(15, 285, 195, 285);
    // Footer text
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.gray);
    doc.text('Product Data Model Analysis Report', 15, 291);
    doc.text(`Page ${i} of ${pageCount}`, 195, 291, { align: 'right' });
  }

  // Save the PDF
  const fileName = `product-data-model-${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
};
