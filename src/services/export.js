/**
 * TaxWise Export Service
 * 
 * Handles generation and export of reports in various formats:
 * - PDF: Using jspdf + jspdf-autotable
 * - Excel: Using exceljs
 * - Word: Using docx
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import ExcelJS from 'exceljs';
import { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun, HeadingLevel, BorderStyle, AlignmentType } from 'docx';
import { formatNaira } from './taxCalculator';

// Company branding
const COMPANY_INFO = {
  name: 'TaxWise Nigeria',
  tagline: 'Simplified Tax Management',
  website: 'www.taxwise.ng',
  primaryColor: '#2563EB',
  secondaryColor: '#161B22'
};

/**
 * Export Service Class
 */
class ExportService {
  constructor() {
    this.dateFormat = new Intl.DateTimeFormat('en-NG', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  }

  /**
   * Format currency for export (PDF-safe: uses NGN prefix since jsPDF's built-in
   * Helvetica font does not include the ₦ glyph).
   */
  formatCurrency(amount) {
    return `NGN ${Number(amount).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  /**
   * Format date for export
   */
  formatDate(date) {
    if (!date) return '';
    return this.dateFormat.format(new Date(date));
  }

  // ==================== PDF EXPORTS ====================

  /**
   * Generate Tax Calculation Report PDF
   */
  async exportTaxCalculationPDF(data, options = {}) {
    const doc = new jsPDF();
    const { calculation, organization, generatedBy } = data;
    const W = doc.internal.pageSize.getWidth();

    const startY = this._drawPDFHeader(doc, {
      reportTitle: 'Tax Calculation Report',
      organization,
      pageWidth: W
    });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text(`Reference: ${calculation.referenceId || 'N/A'}`, 14, startY + 2);

    // Tax Type Header
    const taxTypeY = startY + 10;
    doc.setFillColor(22, 27, 34);
    doc.rect(14, taxTypeY, 182, 10, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(`Tax Type: ${calculation.taxType}`, 18, taxTypeY + 7);

    // Calculation Summary Table
    const summaryData = [
      ['Description', 'Amount'],
      ['Taxable Base', this.formatCurrency(calculation.taxableBase || 0)],
      ['Tax Rate', `${calculation.taxRate || 0}%`],
      ['Gross Tax', this.formatCurrency(calculation.grossTax || 0)],
      ['Tax Credits', `-${this.formatCurrency(calculation.taxCredits || 0)}`],
      ['Net Tax Payable', this.formatCurrency(calculation.netTax || 0)]
    ];

    autoTable(doc, {
      startY: taxTypeY + 14,
      head: [summaryData[0]],
      body: summaryData.slice(1),
      theme: 'striped',
      headStyles: {
        fillColor: [37, 99, 235],
        textColor: 255,
        fontStyle: 'bold'
      },
      footStyles: {
        fillColor: [22, 27, 34],
        textColor: 255,
        fontStyle: 'bold'
      },
      styles: {
        fontSize: 10,
        cellPadding: 5
      },
      columnStyles: {
        0: { cellWidth: 100 },
        1: { cellWidth: 82, halign: 'right' }
      }
    });

    // Breakdown Section (if applicable)
    if (calculation.breakdown && calculation.breakdown.length > 0) {
      const finalY = doc.lastAutoTable.finalY + 15;
      
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Calculation Breakdown', 14, finalY);

      const breakdownData = calculation.breakdown.map(item => [
        item.description,
        this.formatCurrency(item.amount),
        `${item.rate || 'N/A'}%`,
        this.formatCurrency(item.tax)
      ]);

      autoTable(doc, {
        startY: finalY + 5,
        head: [['Description', 'Amount', 'Rate', 'Tax']],
        body: breakdownData,
        theme: 'striped',
        headStyles: {
          fillColor: [37, 99, 235],
          textColor: 255
        },
        styles: {
          fontSize: 9,
          cellPadding: 4
        }
      });
    }

    // Footer
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(128, 128, 128);
      doc.text(
        `${COMPANY_INFO.name} | ${COMPANY_INFO.website} | Page ${i} of ${pageCount}`,
        105,
        290,
        { align: 'center' }
      );
    }

    return doc;
  }

  /**
   * Draw a reusable branded header on a jsPDF document page.
   * Call this before adding any content. Returns the Y position where
   * body content should start.
   *
   * @param {jsPDF} doc
   * @param {object} opts  { reportTitle, organization, dateRange, pageWidth }
   * @returns {number} startY — Y coordinate after the header block
   */
  _drawPDFHeader(doc, { reportTitle, organization, dateRange, pageWidth }) {
    const W = pageWidth || doc.internal.pageSize.getWidth();

    // ── Full-width gradient-style banner (two-tone) ──
    doc.setFillColor(15, 23, 42);            // near-black top strip
    doc.rect(0, 0, W, 8, 'F');
    doc.setFillColor(37, 99, 235);           // TaxWise blue main banner
    doc.rect(0, 8, W, 34, 'F');

    // ── Logo mark: rounded square + "TW" initials ──
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(14, 11, 22, 22, 4, 4, 'F');
    doc.setTextColor(37, 99, 235);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('TW', 25, 25, { align: 'center' });

    // ── Brand name ──
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('TaxWise Nigeria', 42, 20);

    // ── Tagline ──
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(180, 210, 255);
    doc.text('Simplified Tax Management', 42, 27);

    // ── Report title (right-aligned) ──
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(reportTitle, W - 14, 20, { align: 'right' });

    // ── Date/period (right-aligned, small) ──
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(180, 210, 255);
    const now = new Date();
    doc.text(`Generated: ${this.formatDate(now)}`, W - 14, 27, { align: 'right' });
    if (dateRange?.start && dateRange?.end) {
      doc.text(`Period: ${dateRange.start} to ${dateRange.end}`, W - 14, 33, { align: 'right' });
    }

    // ── Thin accent line below banner ──
    doc.setDrawColor(59, 130, 246);
    doc.setLineWidth(1);
    doc.line(0, 42, W, 42);

    // ── Organisation info row ──
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(30, 30, 30);
    const orgName = organization?.name || 'Organisation';
    doc.text(orgName, 14, 51);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    const metaParts = [];
    if (organization?.tin) metaParts.push(`TIN: ${organization.tin}`);
    metaParts.push(`${COMPANY_INFO.website}`);
    if (metaParts.length) doc.text(metaParts.join('   |   '), 14, 57);

    // ── Thin separator ──
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.3);
    doc.line(14, 60, W - 14, 60);

    return 65; // content starts here
  }

  /**
   * Export entries/transactions to PDF
   */
  async exportEntriesPDF(data, options = {}) {
    const doc = new jsPDF('landscape');
    const { entries, organization, dateRange, title } = data;
    const reportTitle = title || 'Transaction Report';
    const W = doc.internal.pageSize.getWidth();

    const startY = this._drawPDFHeader(doc, { reportTitle, organization, dateRange, pageWidth: W });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text(`Total records: ${entries.length}`, 14, startY - 1);

    // ── Table ──
    const tableData = entries.map((entry, index) => {
      const rawId = entry.entry_id || entry.entryId || entry.id || '-';
      const shortId = rawId.length > 13 ? rawId.slice(0, 13) + '…' : rawId;
      return [
        index + 1,
        shortId,
        this.formatDate(entry.date || entry.created_at),
        entry.description || '-',
        (entry.entry_type || entry.type || '-').toUpperCase(),
        entry.category || '-',
        this.formatCurrency(parseFloat(entry.amount) || 0),
        entry.vat_amount ? this.formatCurrency(parseFloat(entry.vat_amount)) : '-',
        (entry.status || 'active').charAt(0).toUpperCase() + (entry.status || 'active').slice(1)
      ];
    });

    autoTable(doc, {
      startY: startY + 4,
      head: [['#', 'Entry ID', 'Date', 'Description', 'Type', 'Category', 'Amount (NGN)', 'VAT (NGN)', 'Status']],
      body: tableData,
      theme: 'grid',
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
        cellPadding: 4
      },
      styles: { fontSize: 8, cellPadding: 3.5 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 28 },
        2: { cellWidth: 24 },
        3: { cellWidth: 65 },
        4: { cellWidth: 22 },
        5: { cellWidth: 28 },
        6: { cellWidth: 32, halign: 'right' },
        7: { cellWidth: 26, halign: 'right' },
        8: { cellWidth: 22, halign: 'center' }
      },
      didDrawPage: (hookData) => {
        // Re-draw header on subsequent pages
        if (hookData.pageNumber > 1) {
          this._drawPDFHeader(doc, { reportTitle, organization, dateRange, pageWidth: W });
        }
        // Footer
        const pageCount = doc.internal.getNumberOfPages();
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        const footerY = doc.internal.pageSize.getHeight() - 6;
        doc.text(
          `TaxWise Nigeria  |  ${reportTitle}  |  www.taxwise.ng`,
          14, footerY
        );
        doc.text(
          `Page ${hookData.pageNumber} of ${pageCount}`,
          W - 14, footerY, { align: 'right' }
        );
        // footer line
        doc.setDrawColor(220, 220, 220);
        doc.setLineWidth(0.3);
        doc.line(14, footerY - 3, W - 14, footerY - 3);
      }
    });

    // ── Summary totals box ──
    const totalIncome = entries
      .filter(e => (e.entry_type || e.type || '').toLowerCase() === 'income')
      .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
    const totalExpense = entries
      .filter(e => (e.entry_type || e.type || '').toLowerCase() === 'expense')
      .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
    const totalVAT = entries.reduce((sum, e) => sum + (parseFloat(e.vat_amount) || 0), 0);
    const netBalance = totalIncome - totalExpense;

    const finalY = Math.min(doc.lastAutoTable.finalY + 8, doc.internal.pageSize.getHeight() - 45);

    // Summary background box
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.3);
    doc.roundedRect(14, finalY, 120, totalVAT > 0 ? 32 : 26, 3, 3, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(80, 80, 80);
    doc.text('SUMMARY', 20, finalY + 7);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(30, 30, 30);
    doc.text(`Total Income:`, 20, finalY + 14);
    doc.text(this.formatCurrency(totalIncome), 80, finalY + 14, { align: 'right' });
    doc.text(`Total Expenses:`, 20, finalY + 20);
    doc.text(this.formatCurrency(totalExpense), 80, finalY + 20, { align: 'right' });
    if (totalVAT > 0) {
      doc.text(`Total VAT:`, 20, finalY + 26);
      doc.text(this.formatCurrency(totalVAT), 80, finalY + 26, { align: 'right' });
    }

    // Net balance with color
    const netY = finalY + (totalVAT > 0 ? 32 : 26) + 6;
    doc.setFillColor(netBalance >= 0 ? 34 : 239, netBalance >= 0 ? 197 : 68, netBalance >= 0 ? 94 : 68);
    doc.roundedRect(14, netY - 5, 120, 12, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.text('Net Balance:', 20, netY + 3);
    doc.text(this.formatCurrency(netBalance), 128, netY + 3, { align: 'right' });

    return doc;
  }

  // ==================== EXCEL EXPORTS ====================

  /**
   * Export tax calculation to Excel
   */
  async exportTaxCalculationExcel(data) {
    const workbook = new ExcelJS.Workbook();
    const { calculation, organization } = data;

    workbook.creator = COMPANY_INFO.name;
    workbook.created = new Date();

    // Summary Sheet
    const summarySheet = workbook.addWorksheet('Summary');
    
    // Header styling
    summarySheet.mergeCells('A1:D1');
    summarySheet.getCell('A1').value = 'Tax Calculation Report';
    summarySheet.getCell('A1').font = { size: 18, bold: true, color: { argb: 'FF2563EB' } };
    summarySheet.getCell('A1').alignment = { horizontal: 'center' };

    // Organization info
    summarySheet.getCell('A3').value = 'Organization:';
    summarySheet.getCell('B3').value = organization?.name || 'N/A';
    summarySheet.getCell('A4').value = 'TIN:';
    summarySheet.getCell('B4').value = organization?.tin || 'N/A';
    summarySheet.getCell('A5').value = 'Tax Type:';
    summarySheet.getCell('B5').value = calculation.taxType;
    summarySheet.getCell('A6').value = 'Reference:';
    summarySheet.getCell('B6').value = calculation.referenceId || 'N/A';
    summarySheet.getCell('A7').value = 'Generated:';
    summarySheet.getCell('B7').value = this.formatDate(new Date());

    // Summary data
    const summaryData = [
      ['Description', 'Amount'],
      ['Taxable Base', calculation.taxableBase || 0],
      ['Tax Rate (%)', calculation.taxRate || 0],
      ['Gross Tax', calculation.grossTax || 0],
      ['Tax Credits', calculation.taxCredits || 0],
      ['Net Tax Payable', calculation.netTax || 0]
    ];

    summarySheet.addTable({
      name: 'SummaryTable',
      ref: 'A9',
      headerRow: true,
      totalsRow: false,
      style: {
        theme: 'TableStyleMedium2',
        showRowStripes: true
      },
      columns: [
        { name: 'Description', filterButton: false },
        { name: 'Amount', filterButton: false }
      ],
      rows: summaryData.slice(1)
    });

    // Format amount column as currency
    summarySheet.getColumn('B').numFmt = '₦#,##0.00';
    summarySheet.getColumn('A').width = 25;
    summarySheet.getColumn('B').width = 20;

    // Breakdown Sheet (if applicable)
    if (calculation.breakdown && calculation.breakdown.length > 0) {
      const breakdownSheet = workbook.addWorksheet('Breakdown');
      
      breakdownSheet.addTable({
        name: 'BreakdownTable',
        ref: 'A1',
        headerRow: true,
        style: {
          theme: 'TableStyleMedium9'
        },
        columns: [
          { name: 'Description' },
          { name: 'Amount' },
          { name: 'Rate (%)' },
          { name: 'Tax' }
        ],
        rows: calculation.breakdown.map(item => [
          item.description,
          item.amount,
          item.rate || 'N/A',
          item.tax
        ])
      });

      breakdownSheet.getColumn('B').numFmt = '₦#,##0.00';
      breakdownSheet.getColumn('D').numFmt = '₦#,##0.00';
    }

    return workbook;
  }

  /**
   * Export entries/transactions to Excel
   */
  async exportEntriesExcel(data) {
    const workbook = new ExcelJS.Workbook();
    const { entries, organization, dateRange, title } = data;
    const reportTitle = title || 'Transaction Report';

    workbook.creator = 'TaxWise Nigeria';
    workbook.created = new Date();
    workbook.subject = reportTitle;

    const sheet = workbook.addWorksheet('Transactions');

    // ── Branded header block (rows 1–7) ──
    // Row 1: dark top accent strip
    sheet.mergeCells('A1:I1');
    const accentCell = sheet.getCell('A1');
    accentCell.value = '';
    accentCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F1728' } };
    sheet.getRow(1).height = 6;

    // Row 2: logo + brand name
    sheet.mergeCells('A2:I2');
    const brandCell = sheet.getCell('A2');
    brandCell.value = 'TW  TaxWise Nigeria';
    brandCell.font = { size: 18, bold: true, color: { argb: 'FFFFFFFF' } };
    brandCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
    brandCell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
    sheet.getRow(2).height = 32;

    // Row 3: tagline strip
    sheet.mergeCells('A3:I3');
    const taglineCell = sheet.getCell('A3');
    taglineCell.value = 'Simplified Tax Management  |  www.taxwise.ng';
    taglineCell.font = { size: 9, color: { argb: 'FFB4D2FF' } };
    taglineCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A6E' } };
    taglineCell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
    sheet.getRow(3).height = 16;

    // Row 4: report title
    sheet.mergeCells('A4:I4');
    const reportTitleCell = sheet.getCell('A4');
    reportTitleCell.value = reportTitle;
    reportTitleCell.font = { size: 13, bold: true, color: { argb: 'FF1E293B' } };
    reportTitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F6FF' } };
    reportTitleCell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
    sheet.getRow(4).height = 22;

    // Row 5: organisation meta
    sheet.getCell('A5').value = 'Organisation:';
    sheet.getCell('A5').font = { bold: true, color: { argb: 'FF6E7681' }, size: 10 };
    sheet.getCell('B5').value = organization?.name || 'N/A';
    sheet.getCell('B5').font = { size: 10 };
    sheet.getCell('E5').value = 'TIN:';
    sheet.getCell('E5').font = { bold: true, color: { argb: 'FF6E7681' }, size: 10 };
    sheet.getCell('F5').value = organization?.tin || 'N/A';
    sheet.getCell('F5').font = { size: 10 };
    sheet.getRow(5).height = 16;

    // Row 6: period + generated
    sheet.getCell('A6').value = 'Period:';
    sheet.getCell('A6').font = { bold: true, color: { argb: 'FF6E7681' }, size: 10 };
    sheet.getCell('B6').value = dateRange?.start && dateRange?.end
      ? `${dateRange.start}  to  ${dateRange.end}` : 'All dates';
    sheet.getCell('B6').font = { size: 10 };
    sheet.getCell('E6').value = 'Generated:';
    sheet.getCell('E6').font = { bold: true, color: { argb: 'FF6E7681' }, size: 10 };
    sheet.getCell('F6').value = this.formatDate(new Date());
    sheet.getCell('F6').font = { size: 10 };
    sheet.getRow(6).height = 16;

    // Row 7: total records
    sheet.getCell('A7').value = 'Total Records:';
    sheet.getCell('A7').font = { bold: true, color: { argb: 'FF6E7681' }, size: 10 };
    sheet.getCell('B7').value = entries.length;
    sheet.getCell('B7').font = { size: 10 };
    sheet.getRow(7).height = 16;

    // Row 8: spacer
    sheet.getRow(8).height = 6;

    // ── Data table (starting row 9) ──
    const headerRow = sheet.getRow(9);
    const headers = ['#', 'Entry ID', 'Date', 'Description', 'Type', 'Category', 'Amount (₦)', 'VAT (₦)', 'Status'];
    headers.forEach((h, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = h;
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF161B22' } };
      cell.alignment = { horizontal: i >= 6 && i <= 7 ? 'right' : 'left' };
      cell.border = {
        bottom: { style: 'medium', color: { argb: 'FF2563EB' } }
      };
    });

    entries.forEach((entry, index) => {
      const row = sheet.getRow(10 + index);
      const rowData = [
        index + 1,
        entry.entry_id || entry.entryId || entry.id || '-',
        this.formatDate(entry.date || entry.created_at),
        entry.description || '-',
        (entry.entry_type || entry.type || '-').toUpperCase(),
        entry.category || '-',
        parseFloat(entry.amount) || 0,
        parseFloat(entry.vat_amount) || 0,
        (entry.status || 'active').charAt(0).toUpperCase() + (entry.status || 'active').slice(1)
      ];
      rowData.forEach((val, i) => {
        const cell = row.getCell(i + 1);
        cell.value = val;
        if (index % 2 === 1) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F7FA' } };
        }
        if (i === 6 || i === 7) cell.numFmt = '₦#,##0.00';
      });
    });

    // ── Totals row ──
    const totalRow = sheet.getRow(10 + entries.length + 1);
    totalRow.getCell(1).value = 'TOTALS';
    totalRow.getCell(1).font = { bold: true };
    const totalIncome = entries
      .filter(e => (e.entry_type || e.type || '').toLowerCase() === 'income')
      .reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
    const totalExpense = entries
      .filter(e => (e.entry_type || e.type || '').toLowerCase() === 'expense')
      .reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
    const totalVAT = entries.reduce((s, e) => s + (parseFloat(e.vat_amount) || 0), 0);

    const labelRow = sheet.getRow(10 + entries.length + 2);
    labelRow.getCell(6).value = 'Total Income:';
    labelRow.getCell(6).font = { bold: true };
    labelRow.getCell(7).value = totalIncome;
    labelRow.getCell(7).numFmt = '₦#,##0.00';

    const expRow = sheet.getRow(10 + entries.length + 3);
    expRow.getCell(6).value = 'Total Expense:';
    expRow.getCell(6).font = { bold: true };
    expRow.getCell(7).value = totalExpense;
    expRow.getCell(7).numFmt = '₦#,##0.00';

    const vatRow = sheet.getRow(10 + entries.length + 4);
    vatRow.getCell(6).value = 'Total VAT:';
    vatRow.getCell(6).font = { bold: true };
    vatRow.getCell(7).value = totalVAT;
    vatRow.getCell(7).numFmt = '₦#,##0.00';

    const netRow = sheet.getRow(10 + entries.length + 5);
    netRow.getCell(6).value = 'Net Balance:';
    netRow.getCell(6).font = { bold: true, size: 11 };
    netRow.getCell(7).value = totalIncome - totalExpense;
    netRow.getCell(7).numFmt = '₦#,##0.00';
    netRow.getCell(7).font = { bold: true, size: 11, color: { argb: totalIncome >= totalExpense ? 'FF22C55E' : 'FFEF4444' } };

    // ── Column widths ──
    sheet.getColumn(1).width = 6;
    sheet.getColumn(2).width = 18;
    sheet.getColumn(3).width = 16;
    sheet.getColumn(4).width = 45;
    sheet.getColumn(5).width = 14;
    sheet.getColumn(6).width = 20;
    sheet.getColumn(7).width = 20;
    sheet.getColumn(8).width = 16;
    sheet.getColumn(9).width = 14;

    return workbook;
  }

  // ==================== WORD EXPORTS ====================

  /**
   * Export tax calculation to Word document
   */
  async exportTaxCalculationDOC(data) {
    const { calculation, organization } = data;

    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          // Header
          new Paragraph({
            text: 'Tax Calculation Report',
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 }
          }),
          
          // Organization Info
          new Paragraph({
            children: [
              new TextRun({ text: 'Organization: ', bold: true }),
              new TextRun(organization?.name || 'N/A')
            ]
          }),
          new Paragraph({
            children: [
              new TextRun({ text: 'TIN: ', bold: true }),
              new TextRun(organization?.tin || 'N/A')
            ]
          }),
          new Paragraph({
            children: [
              new TextRun({ text: 'Tax Type: ', bold: true }),
              new TextRun(calculation.taxType)
            ]
          }),
          new Paragraph({
            children: [
              new TextRun({ text: 'Reference: ', bold: true }),
              new TextRun(calculation.referenceId || 'N/A')
            ]
          }),
          new Paragraph({
            children: [
              new TextRun({ text: 'Generated: ', bold: true }),
              new TextRun(this.formatDate(new Date()))
            ],
            spacing: { after: 400 }
          }),

          // Summary Header
          new Paragraph({
            text: 'Calculation Summary',
            heading: HeadingLevel.HEADING_2,
            spacing: { after: 200 }
          }),

          // Summary Table
          new Table({
            width: { size: 100, type: 'pct' },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph({ text: 'Description', bold: true })],
                    shading: { fill: '2563EB' }
                  }),
                  new TableCell({
                    children: [new Paragraph({ text: 'Amount', bold: true, alignment: AlignmentType.RIGHT })],
                    shading: { fill: '2563EB' }
                  })
                ]
              }),
              this.createTableRow('Taxable Base', this.formatCurrency(calculation.taxableBase || 0)),
              this.createTableRow('Tax Rate', `${calculation.taxRate || 0}%`),
              this.createTableRow('Gross Tax', this.formatCurrency(calculation.grossTax || 0)),
              this.createTableRow('Tax Credits', `-${this.formatCurrency(calculation.taxCredits || 0)}`),
              this.createTableRow('Net Tax Payable', this.formatCurrency(calculation.netTax || 0), true)
            ]
          }),

          // Footer
          new Paragraph({
            text: `${COMPANY_INFO.name} | ${COMPANY_INFO.website}`,
            alignment: AlignmentType.CENTER,
            spacing: { before: 400 }
          })
        ]
      }]
    });

    return doc;
  }

  /**
   * Helper to create a table row for Word document
   */
  createTableRow(label, value, isBold = false) {
    return new TableRow({
      children: [
        new TableCell({
          children: [new Paragraph({ text: label })]
        }),
        new TableCell({
          children: [new Paragraph({
            text: value,
            alignment: AlignmentType.RIGHT,
            bold: isBold
          })]
        })
      ]
    });
  }

  // ==================== DOWNLOAD HELPERS ====================

  /**
   * Download PDF document
   */
  async downloadPDF(doc, filename) {
    doc.save(filename);
  }

  /**
   * Download Excel workbook
   */
  async downloadExcel(workbook, filename) {
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    });
    this.downloadBlob(blob, filename);
  }

  /**
   * Download Word document
   */
  async downloadDOC(doc, filename) {
    const blob = await Packer.toBlob(doc);
    this.downloadBlob(blob, filename);
  }

  /**
   * Generic blob download helper
   */
  downloadBlob(blob, filename) {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }
}

// Export singleton instance
export const exportService = new ExportService();
export default exportService;
