import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { AnalysisResult } from './analysisEngine';
import { TaxonomyTreeNode, treeToAscii } from './exportReport';

/**
 * Generate a comprehensive PDF report
 */
export const generatePDFReport = (
  analysisResult: AnalysisResult,
  headers: string[],
  data: any[][],
  taxonomyTree: TaxonomyTreeNode
): void => {
  const doc = new jsPDF();
  let yPosition = 20;

  // Helper function to add a new page if needed
  const checkPageBreak = (requiredSpace: number = 20) => {
    if (yPosition + requiredSpace > 280) {
      doc.addPage();
      yPosition = 20;
      return true;
    }
    return false;
  };

  // Helper to add section title
  const addSectionTitle = (title: string) => {
    checkPageBreak(30);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(title, 20, yPosition);
    yPosition += 10;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
  };

  // ===== COVER PAGE =====
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('Product Taxonomy Analysis', 105, 60, { align: 'center' });
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text('Comprehensive Hierarchy & Data Quality Report', 105, 75, { align: 'center' });
  
  doc.setFontSize(10);
  const reportDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  doc.text(`Generated: ${reportDate}`, 105, 90, { align: 'center' });

  // Summary box
  doc.setDrawColor(200, 200, 200);
  doc.setFillColor(245, 245, 245);
  doc.roundedRect(40, 110, 130, 60, 3, 3, 'FD');
  
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Analysis Summary', 105, 125, { align: 'center' });
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Total Products: ${data.length}`, 50, 140);
  doc.text(`Attributes Analyzed: ${headers.length}`, 50, 150);
  doc.text(`Hierarchy Levels: ${analysisResult.hierarchy.filter(h => h.headers.length > 0).length}`, 50, 160);
  doc.text(`Confidence: ${(analysisResult.hierarchyConfidence * 100).toFixed(1)}%`, 120, 140);
  doc.text(`Product Domain: ${analysisResult.productDomain.type}`, 120, 150);

  // ===== PAGE 2: CORE - PRODUCT IDENTIFICATION & PROPERTY MAPPING =====
  doc.addPage();
  yPosition = 20;
  
  addSectionTitle('CORE: Product Identification');
  
  // Record ID & Name Status
  const hasRecordId = !!analysisResult.recordIdSuggestion;
  const hasRecordName = !!analysisResult.recordNameSuggestion;
  
  doc.setFillColor(hasRecordId ? 220 : 254, hasRecordId ? 252 : 226, hasRecordId ? 231 : 226);
  doc.roundedRect(20, yPosition, 80, 25, 2, 2, 'F');
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Record ID:', 25, yPosition + 8);
  doc.setFont('helvetica', 'normal');
  doc.text(analysisResult.recordIdSuggestion || 'NOT DETECTED', 25, yPosition + 16);
  if (!hasRecordId) {
    doc.setFontSize(8);
    doc.setTextColor(185, 28, 28);
    doc.text('⚠ CRITICAL', 25, yPosition + 22);
    doc.setTextColor(0, 0, 0);
  }
  
  doc.setFillColor(hasRecordName ? 220 : 254, hasRecordName ? 252 : 243, hasRecordName ? 231 : 199);
  doc.roundedRect(110, yPosition, 80, 25, 2, 2, 'F');
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Record Name:', 115, yPosition + 8);
  doc.setFont('helvetica', 'normal');
  doc.text(analysisResult.recordNameSuggestion || 'NOT DETECTED', 115, yPosition + 16);
  if (!hasRecordName) {
    doc.setFontSize(8);
    doc.setTextColor(217, 119, 6);
    doc.text('⚠ IMPORTANT', 115, yPosition + 22);
    doc.setTextColor(0, 0, 0);
  }
  
  yPosition += 35;
  
  addSectionTitle('CORE: Property-to-Hierarchy Exclusive Mapping');
  
  // Taxonomy Properties (Highest Level)
  const taxonomyProperties = analysisResult.hierarchy.length > 0 
    ? analysisResult.hierarchy[0].headers 
    : [];
  
  if (taxonomyProperties.length > 0) {
    doc.setFillColor(79, 70, 229, 0.1);
    doc.roundedRect(20, yPosition, 170, 8 + (taxonomyProperties.length * 5), 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Taxonomy Properties (Highest Level):', 25, yPosition + 6);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    yPosition += 12;
    taxonomyProperties.forEach(prop => {
      doc.text(`✓ ${prop}`, 30, yPosition);
      yPosition += 5;
    });
    yPosition += 5;
  }
  
  // ===== PAGE 3: HIERARCHY STRUCTURE =====
  doc.addPage();
  yPosition = 20;
  
  addSectionTitle('Hierarchy Structure & Property Distribution');
  
  const hierarchyData = analysisResult.hierarchy.map(level => [
    `Level ${level.level}`,
    level.name,
    level.headers.join(', '),
    level.headers.length.toString()
  ]);

  autoTable(doc, {
    startY: yPosition,
    head: [['Level', 'Name', 'Properties', 'Count']],
    body: hierarchyData,
    theme: 'grid',
    headStyles: { fillColor: [79, 70, 229] },
    margin: { left: 20, right: 20 },
  });

  yPosition = (doc as any).lastAutoTable.finalY + 15;

  // SKU-Level Properties
  if (analysisResult.properties.length > 0) {
    checkPageBreak(30);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('SKU-Level Properties', 20, yPosition);
    yPosition += 8;
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const propertiesText = analysisResult.properties.join(', ');
    const splitProperties = doc.splitTextToSize(propertiesText, 170);
    doc.text(splitProperties, 20, yPosition);
    yPosition += splitProperties.length * 5 + 10;
  }

  // ===== TAXONOMY TREE =====
  checkPageBreak(40);
  addSectionTitle('Taxonomy Tree Structure');
  
  const treeAscii = treeToAscii(taxonomyTree);
  const treeLines = treeAscii.split('\n').slice(0, 40); // Limit lines
  
  doc.setFont('courier', 'normal');
  doc.setFontSize(8);
  treeLines.forEach(line => {
    if (checkPageBreak(5)) {
      doc.setFont('courier', 'normal');
      doc.setFontSize(8);
    }
    doc.text(line.substring(0, 90), 20, yPosition); // Limit line length
    yPosition += 4;
  });
  
  if (treeLines.length >= 40) {
    yPosition += 5;
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.text('(Tree truncated for PDF - see full tree in JSON export)', 20, yPosition);
  }

  // ===== CORE: BEST PRACTICES & RECOMMENDATIONS =====
  doc.addPage();
  yPosition = 20;
  addSectionTitle('CORE: Best Practices & Recommendations');

  // UOM Split Recommendations
  const uomSplits = analysisResult.uomSuggestions.filter(uom => uom.suggestedSplit);
  if (uomSplits.length > 0) {
    doc.setFillColor(254, 243, 199);
    doc.roundedRect(20, yPosition, 170, 10, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(217, 119, 6);
    doc.text(`⚠ ${uomSplits.length} UOM Split Recommendations`, 25, yPosition + 7);
    doc.setTextColor(0, 0, 0);
    yPosition += 15;

    uomSplits.slice(0, 3).forEach(uom => {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(`Property: ${uom.header}`, 25, yPosition);
      yPosition += 6;
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(`Current: Value with embedded UOM (e.g., "12${uom.detectedUom}")`, 30, yPosition);
      yPosition += 5;
      doc.text(`Recommended: Split into "${uom.header}" (12) + "${uom.header} UOM" (${uom.detectedUom})`, 30, yPosition);
      yPosition += 5;
      doc.setFont('helvetica', 'italic');
      doc.text('Impact: Improves consistency, enables filtering, follows Salsify best practices', 30, yPosition);
      yPosition += 8;
      doc.setFont('helvetica', 'normal');
    });

    if (uomSplits.length > 3) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'italic');
      doc.text(`... and ${uomSplits.length - 3} more (see JSON export)`, 25, yPosition);
      yPosition += 10;
    }
  }

  // Critical Issues
  const criticalIssues = [];
  if (!analysisResult.recordIdSuggestion) {
    criticalIssues.push('No Record ID detected - CRITICAL');
  }
  if (!analysisResult.recordNameSuggestion) {
    criticalIssues.push('No Record Name detected - IMPORTANT');
  }
  if (analysisResult.orphanedRecords.length > 0) {
    criticalIssues.push(`${analysisResult.orphanedRecords.length} products with hierarchy issues`);
  }

  if (criticalIssues.length > 0) {
    checkPageBreak(30);
    doc.setFillColor(254, 226, 226);
    doc.roundedRect(20, yPosition, 170, 10 + (criticalIssues.length * 6), 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(185, 28, 28);
    doc.text('Critical Issues Requiring Attention:', 25, yPosition + 7);
    doc.setTextColor(0, 0, 0);
    yPosition += 13;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    criticalIssues.forEach(issue => {
      doc.text(`• ${issue}`, 30, yPosition);
      yPosition += 6;
    });
    yPosition += 10;
  }

  // ===== ALTERNATIVE HIERARCHIES =====
  checkPageBreak(40);
  addSectionTitle('Alternative Hierarchy Options');

  const alternativesData = analysisResult.alternativeHierarchies.map(alt => [
    alt.name,
    alt.modelType,
    `${alt.hierarchy.length} levels`,
    `${(alt.confidence * 100).toFixed(0)}%`,
    alt.reasoning.substring(0, 60) + '...'
  ]);

  autoTable(doc, {
    startY: yPosition,
    head: [['Name', 'Type', 'Levels', 'Confidence', 'Reasoning']],
    body: alternativesData,
    theme: 'striped',
    headStyles: { fillColor: [79, 70, 229] },
    margin: { left: 20, right: 20 },
    columnStyles: {
      4: { cellWidth: 60 }
    }
  });

  yPosition = (doc as any).lastAutoTable.finalY + 15;

  // ===== PROPERTY RECOMMENDATIONS =====
  checkPageBreak(40);
  addSectionTitle('Property Type Recommendations');

  const propertyData = analysisResult.propertyRecommendations.slice(0, 20).map(prop => [
    prop.header,
    prop.dataType,
    prop.isPicklist ? 'Yes' : 'No',
    `${(prop.confidence * 100).toFixed(0)}%`
  ]);

  autoTable(doc, {
    startY: yPosition,
    head: [['Property', 'Data Type', 'Picklist', 'Confidence']],
    body: propertyData,
    theme: 'grid',
    headStyles: { fillColor: [79, 70, 229] },
    margin: { left: 20, right: 20 },
  });

  if (analysisResult.propertyRecommendations.length > 20) {
    yPosition = (doc as any).lastAutoTable.finalY + 5;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    doc.text(`(Showing 20 of ${analysisResult.propertyRecommendations.length} properties - see full list in JSON export)`, 20, yPosition);
  }

  // ===== MIXED MODEL ANALYSIS =====
  if ((analysisResult as any).mixedModelSuggestion) {
    doc.addPage();
    yPosition = 20;
    addSectionTitle('Mixed Model Analysis');

    const mixedModel = (analysisResult as any).mixedModelSuggestion;
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    
    const statusColor = mixedModel.shouldUseMixed ? [255, 165, 0] : [34, 197, 94];
    doc.setFillColor(statusColor[0], statusColor[1], statusColor[2]);
    doc.roundedRect(20, yPosition, 170, 8, 2, 2, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text(mixedModel.shouldUseMixed ? 'MIXED MODEL RECOMMENDED' : 'CONSISTENT MODEL', 105, yPosition + 5, { align: 'center' });
    doc.setTextColor(0, 0, 0);
    
    yPosition += 15;
    doc.setFont('helvetica', 'normal');
    const reasoningLines = doc.splitTextToSize(mixedModel.reasoning, 170);
    doc.text(reasoningLines, 20, yPosition);
    yPosition += reasoningLines.length * 5 + 10;

    // Distribution chart (simple bars)
    doc.setFont('helvetica', 'bold');
    doc.text('Product Distribution:', 20, yPosition);
    yPosition += 8;

    const hierarchicalWidth = (mixedModel.hierarchicalPercentage / 100) * 150;
    const standaloneWidth = (mixedModel.standalonePercentage / 100) * 150;

    doc.setFillColor(79, 70, 229);
    doc.rect(20, yPosition, hierarchicalWidth, 10, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Hierarchical: ${mixedModel.hierarchicalPercentage.toFixed(1)}%`, 25, yPosition + 7);

    yPosition += 15;
    doc.setFillColor(234, 179, 8);
    doc.rect(20, yPosition, standaloneWidth, 10, 'F');
    doc.text(`Standalone: ${mixedModel.standalonePercentage.toFixed(1)}%`, 25, yPosition + 7);
  }

  // ===== DATA QUALITY SUMMARY =====
  doc.addPage();
  yPosition = 20;
  addSectionTitle('Data Quality Summary');

  if (analysisResult.orphanedRecords.length > 0) {
    const orphanedPercentage = ((analysisResult.orphanedRecords.length / data.length) * 100).toFixed(1);
    
    doc.setFillColor(254, 226, 226);
    doc.roundedRect(20, yPosition, 170, 25, 2, 2, 'F');
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(185, 28, 28);
    doc.text('⚠ Data Quality Issues Detected', 25, yPosition + 8);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    doc.text(`${analysisResult.orphanedRecords.length} orphaned records (${orphanedPercentage}%)`, 25, yPosition + 18);
    
    yPosition += 35;

    const orphanedData = analysisResult.orphanedRecords.slice(0, 15).map(record => [
      `Row ${record.rowIndex + 1}`,
      record.severity.toUpperCase(),
      record.issues.join('; ').substring(0, 80)
    ]);

    autoTable(doc, {
      startY: yPosition,
      head: [['Row', 'Severity', 'Issues']],
      body: orphanedData,
      theme: 'striped',
      headStyles: { fillColor: [220, 38, 38] },
      margin: { left: 20, right: 20 },
    });

    if (analysisResult.orphanedRecords.length > 15) {
      yPosition = (doc as any).lastAutoTable.finalY + 5;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'italic');
      doc.text(`(Showing 15 of ${analysisResult.orphanedRecords.length} issues)`, 20, yPosition);
    }
  } else {
    doc.setFillColor(220, 252, 231);
    doc.roundedRect(20, yPosition, 170, 20, 2, 2, 'F');
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(21, 128, 61);
    doc.text('✓ No Data Quality Issues', 25, yPosition + 13);
    doc.setTextColor(0, 0, 0);
  }

  // ===== FOOTER ON EACH PAGE =====
  const pageCount = doc.getNumberOfPages();
  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.text(`Page ${i} of ${pageCount}`, 105, 290, { align: 'center' });
    doc.text('Product Taxonomy Analysis Report', 20, 290);
  }

  // Save the PDF
  const fileName = `taxonomy-analysis-${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
};
