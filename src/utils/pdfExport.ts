import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { AnalysisResult } from './analysisEngine';
import { TaxonomyTreeNode } from './exportReport';

// Professional color palette
const COLORS = {
  primary: [37, 99, 235] as [number, number, number],      // Blue-600
  primaryDark: [29, 78, 216] as [number, number, number],  // Blue-700
  success: [22, 163, 74] as [number, number, number],      // Green-600
  warning: [217, 119, 6] as [number, number, number],      // Amber-600
  danger: [220, 38, 38] as [number, number, number],       // Red-600
  gray: [107, 114, 128] as [number, number, number],       // Gray-500
  grayLight: [243, 244, 246] as [number, number, number],  // Gray-100
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

  // Helper function to add a new page if needed
  const checkPageBreak = (requiredSpace: number = 20) => {
    if (yPosition + requiredSpace > 275) {
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

  // ===== COVER PAGE =====
  // Header bar
  doc.setFillColor(...COLORS.primary);
  doc.rect(0, 0, 210, 45, 'F');
  
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.white);
  doc.text('Product Data Model', 105, 25, { align: 'center' });
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text('Analysis Report', 105, 35, { align: 'center' });
  
  doc.setTextColor(...COLORS.black);
  
  // Report info
  const reportDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.gray);
  doc.text(`Generated: ${reportDate}`, 105, 55, { align: 'center' });

  // Total properties badge (top right like web app)
  const totalProps = headers.length;
  doc.setFillColor(...COLORS.success);
  doc.roundedRect(150, 50, 45, 15, 3, 3, 'F');
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.white);
  doc.text(`${totalProps} properties`, 172.5, 60, { align: 'center' });

  // Model Type Badge
  yPosition = 75;
  doc.setFillColor(...COLORS.primary);
  doc.roundedRect(55, yPosition, 100, 18, 3, 3, 'F');
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.white);
  doc.text(modelName.toUpperCase(), 105, yPosition + 12, { align: 'center' });
  
  doc.setTextColor(...COLORS.black);
  yPosition += 28;

  // ===== HIERARCHY VISUALIZATION (cleaner, lighter design) =====
  const levelColors: { [key: number]: [number, number, number] } = {
    1: [59, 130, 246],   // Blue for Level 1
    2: [239, 68, 68],    // Red for Level 2
    3: [34, 197, 94],    // Green for Level 3
  };

  const hierarchyLevels = analysisResult.hierarchy.filter(level => level.headers.length > 0);
  
  hierarchyLevels.forEach((level, levelIndex) => {
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
  yPosition += 10;

  // Summary cards (3 cards - Products, Properties, Levels)
  checkPageBreak(35);
  const cardWidth = 55;
  const summaryData = [
    { label: 'Products', value: data.length.toString() },
    { label: 'Properties', value: totalProps.toString() },
    { label: 'Hierarchy Levels', value: analysisResult.hierarchy.filter(h => h.headers.length > 0).length.toString() },
  ];

  summaryData.forEach((item, i) => {
    const x = 15 + (cardWidth + 10) * i;
    doc.setFillColor(...COLORS.grayLight);
    doc.roundedRect(x, yPosition, cardWidth, 22, 2, 2, 'F');
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.primary);
    doc.text(item.value, x + cardWidth/2, yPosition + 11, { align: 'center' });
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.gray);
    doc.text(item.label, x + cardWidth/2, yPosition + 18, { align: 'center' });
  });
  
  doc.setTextColor(...COLORS.black);

  // ===== PAGE 3: TAXONOMY =====
  doc.addPage();
  yPosition = 25;
  
  addSectionTitle('Taxonomy Structure');
  
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

  // ===== PAGE 5: BEST PRACTICES =====
  doc.addPage();
  yPosition = 25;
  
  addSectionTitle('Best Practices', COLORS.success);
  addSubtitle('Recommendations for Salsify import optimization');

  // UOM Split Recommendations
  const uomSplits = analysisResult.uomSuggestions.filter(uom => uom.suggestedSplit);
  if (uomSplits.length > 0) {
    checkPageBreak(30);
    doc.setFillColor(254, 243, 199);
    doc.roundedRect(15, yPosition, 180, 12, 3, 3, 'F');
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.warning);
    doc.text(`${uomSplits.length} UOM Split Recommendations`, 20, yPosition + 8);
    doc.setTextColor(...COLORS.black);
    yPosition += 18;

    uomSplits.slice(0, 5).forEach(uom => {
      checkPageBreak(20);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text(`• ${uom.header}`, 20, yPosition);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...COLORS.gray);
      doc.text(`Split into "${uom.header}" + "${uom.header} UOM"`, 25, yPosition + 5);
      doc.setTextColor(...COLORS.black);
      yPosition += 12;
    });
    yPosition += 5;
  }

  // Taxonomy Properties Section - show actual taxonomy properties with OK/NOK status
  const actualTaxonomyProps = taxonomyTree.taxonomyProperties || [];
  const level1Headers = analysisResult.hierarchy.find(h => h.level === 1)?.headers || [];
  
  if (actualTaxonomyProps.length > 0) {
    // Check which taxonomy properties are correctly positioned in Level 1
    const taxonomyStatus = actualTaxonomyProps.map(prop => ({
      name: prop,
      isOk: level1Headers.includes(prop)
    }));
    
    const okCount = taxonomyStatus.filter(t => t.isOk).length;
    const nokCount = taxonomyStatus.filter(t => !t.isOk).length;
    
    checkPageBreak(40 + actualTaxonomyProps.length * 12);
    doc.setFillColor(...COLORS.grayLight);
    doc.roundedRect(15, yPosition, 180, 28 + actualTaxonomyProps.length * 10, 3, 3, 'F');
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.black);
    const statusText = nokCount === 0 
      ? `Taxonomy: ${okCount} Properties Correctly Positioned`
      : `Taxonomy: ${okCount} OK, ${nokCount} Need Attention`;
    doc.text(statusText, 20, yPosition + 8);
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.gray);
    doc.text('Taxonomy properties should be at Level 1 (top hierarchy level).', 20, yPosition + 16);
    
    yPosition += 26;
    
    taxonomyStatus.forEach(item => {
      // Status box (OK = green, NOK = red)
      if (item.isOk) {
        doc.setFillColor(...COLORS.success);
      } else {
        doc.setFillColor(...COLORS.danger);
      }
      doc.roundedRect(22, yPosition - 5, 12, 7, 1, 1, 'F');
      doc.setFontSize(6);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...COLORS.white);
      doc.text(item.isOk ? 'OK' : 'NOK', item.isOk ? 25 : 24, yPosition);
      
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...COLORS.black);
      const levelInfo = item.isOk ? '(Level 1)' : '(Not in Level 1)';
      doc.text(`${item.name} ${levelInfo}`, 38, yPosition);
      yPosition += 10;
    });
    
    yPosition += 8;
  }

  // Critical Issues Summary
  const criticalIssues: string[] = [];
  if (!analysisResult.recordIdSuggestion) criticalIssues.push('Missing Record ID - Required for Salsify import');
  if (!analysisResult.recordNameSuggestion) criticalIssues.push('Missing Record Name - Recommended for product display');
  if (analysisResult.orphanedRecords.length > 0) {
    criticalIssues.push(`${analysisResult.orphanedRecords.length} products with incomplete data`);
  }

  if (criticalIssues.length > 0) {
    checkPageBreak(30);
    doc.setFillColor(254, 226, 226);
    doc.roundedRect(15, yPosition, 180, 10 + criticalIssues.length * 8, 3, 3, 'F');
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.danger);
    doc.text('Issues Requiring Attention', 20, yPosition + 8);
    yPosition += 14;
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.black);
    criticalIssues.forEach(issue => {
      doc.text(`• ${issue}`, 22, yPosition);
      yPosition += 7;
    });
    yPosition += 10;
  } else {
    doc.setFillColor(220, 252, 231);
    doc.roundedRect(15, yPosition, 180, 15, 3, 3, 'F');
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.success);
    doc.text('All critical checks passed', 20, yPosition + 10);
    doc.setTextColor(...COLORS.black);
    yPosition += 25;
  }

  // Incomplete Products Detail (orphaned records)
  if (analysisResult.orphanedRecords.length > 0) {
    checkPageBreak(60);
    addSectionTitle('Products with Incomplete Data', COLORS.warning);
    addSubtitle(`${analysisResult.orphanedRecords.length} products have missing hierarchy values`);
    
    // Show sample of orphaned records
    const orphanedSample = analysisResult.orphanedRecords.slice(0, 10);
    const orphanedData = orphanedSample.map((record, idx) => {
      const rowNum = typeof record === 'number' ? record : idx + 2;
      return [`Row ${rowNum}`, 'Missing data'];
    });

    autoTable(doc, {
      startY: yPosition,
      head: [['Excel Row', 'Issue']],
      body: orphanedData,
      theme: 'grid',
      headStyles: { 
        fillColor: COLORS.warning,
        textColor: COLORS.white,
        fontStyle: 'bold',
        fontSize: 8
      },
      bodyStyles: {
        fontSize: 8,
        textColor: COLORS.black
      },
      margin: { left: 15, right: 15 },
      columnStyles: {
        0: { cellWidth: 30 },
        1: { cellWidth: 140 }
      }
    });

    yPosition = (doc as any).lastAutoTable.finalY + 5;
    
    if (analysisResult.orphanedRecords.length > 10) {
      doc.setFontSize(8);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(...COLORS.gray);
      doc.text(`Showing 10 of ${analysisResult.orphanedRecords.length} products with incomplete data`, 15, yPosition);
      doc.setTextColor(...COLORS.black);
    }
  }

  // ===== PAGE 6: DATA QUALITY WARNINGS =====
  doc.addPage();
  yPosition = 25;
  
  addSectionTitle('Data Quality Warnings', COLORS.warning);
  addSubtitle('Issues detected in the source data');

  if (validationResult && validationResult.warnings.length > 0) {
    // Summary bar
    const highCount = validationResult.warnings.filter((w: any) => w.severity === 'high').length;
    const medCount = validationResult.warnings.filter((w: any) => w.severity === 'medium').length;
    const lowCount = validationResult.warnings.filter((w: any) => w.severity === 'low').length;
    
    doc.setFillColor(...COLORS.grayLight);
    doc.roundedRect(15, yPosition, 180, 15, 3, 3, 'F');
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.danger);
    doc.text(`${highCount} Critical`, 25, yPosition + 10);
    doc.setTextColor(...COLORS.warning);
    doc.text(`${medCount} Medium`, 70, yPosition + 10);
    doc.setTextColor(...COLORS.primary);
    doc.text(`${lowCount} Low`, 115, yPosition + 10);
    doc.setTextColor(...COLORS.gray);
    doc.text(`${validationResult.totalIssues} Total`, 155, yPosition + 10);
    doc.setTextColor(...COLORS.black);
    yPosition += 25;

    // Warnings table - full text, no truncation
    const warningsData = validationResult.warnings.slice(0, 15).map((w: any) => [
      w.severity.toUpperCase(),
      w.title,
      w.message, // Full message, autoTable will wrap
      w.affectedCount.toString()
    ]);

    autoTable(doc, {
      startY: yPosition,
      head: [['Severity', 'Issue', 'Description', 'Affected']],
      body: warningsData,
      theme: 'grid',
      headStyles: { 
        fillColor: COLORS.warning,
        textColor: COLORS.white,
        fontStyle: 'bold',
        fontSize: 8
      },
      bodyStyles: {
        fontSize: 8,
        textColor: COLORS.black,
        cellPadding: 3
      },
      margin: { left: 15, right: 15 },
      columnStyles: {
        0: { cellWidth: 18 },
        1: { cellWidth: 45 },
        2: { cellWidth: 95 }, // Wider for full text
        3: { cellWidth: 17 }
      },
      styles: {
        overflow: 'linebreak', // Wrap text instead of truncating
        cellWidth: 'wrap'
      },
      didParseCell: (data) => {
        if (data.column.index === 0 && data.section === 'body') {
          const text = data.cell.text[0];
          if (text === 'HIGH') data.cell.styles.textColor = COLORS.danger;
          else if (text === 'MEDIUM') data.cell.styles.textColor = COLORS.warning;
          else data.cell.styles.textColor = COLORS.primary;
          data.cell.styles.fontStyle = 'bold';
        }
      }
    });

    if (validationResult.warnings.length > 15) {
      yPosition = (doc as any).lastAutoTable.finalY + 5;
      doc.setFontSize(8);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(...COLORS.gray);
      doc.text(`Showing 15 of ${validationResult.warnings.length} warnings`, 15, yPosition);
    }
  } else {
    doc.setFillColor(220, 252, 231);
    doc.roundedRect(15, yPosition, 180, 25, 3, 3, 'F');
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.success);
    doc.text('No Data Quality Issues Detected', 105, yPosition + 15, { align: 'center' });
    doc.setTextColor(...COLORS.black);
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
