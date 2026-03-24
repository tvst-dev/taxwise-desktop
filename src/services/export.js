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

    // Header
    doc.setFillColor(37, 99, 235);
    doc.rect(0, 0, 210, 35, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('Tax Calculation Report', 14, 20);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generated: ${this.formatDate(new Date())}`, 14, 28);

    // Organization Info
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(organization?.name || 'Organization', 14, 48);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`TIN: ${organization?.tin || 'N/A'}`, 14, 55);
    doc.text(`Reference: ${calculation.referenceId || 'N/A'}`, 14, 62);

    // Tax Type Header
    doc.setFillColor(22, 27, 34);
    doc.rect(14, 72, 182, 10, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(`Tax Type: ${calculation.taxType}`, 18, 79);

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
      startY: 88,
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
   * Export entries/transactions to PDF
   */
  async exportEntriesPDF(data, options = {}) {
    const doc = new jsPDF('landscape');
    const { entries, organization, dateRange, title } = data;
    const reportTitle = title || 'Transaction Report';
    const now = new Date();

    // ── Blue header banner ──
    doc.setFillColor(37, 99, 235);
    doc.rect(0, 0, 297, 38, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('TaxWise Nigeria', 14, 14);

    doc.setFontSize(13);
    doc.setFont('helvetica', 'normal');
    doc.text(reportTitle, 14, 23);

    doc.setFontSize(9);
    doc.text(`Generated: ${this.formatDate(now)}`, 14, 31);
    if (dateRange?.start && dateRange?.end) {
      doc.text(`Period: ${dateRange.start} to ${dateRange.end}`, 100, 31);
    }

    // ── Organisation info block ──
    doc.setTextColor(30, 30, 30);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(organization?.name || 'Organisation', 14, 46);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    if (organization?.tin) doc.text(`TIN: ${organization.tin}`, 14, 52);
    doc.text(`Total records: ${entries.length}`, 14, 58);

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
      startY: 64,
      head: [['#', 'Entry ID', 'Date', 'Description', 'Type', 'Category', 'Amount (NGN)', 'VAT (NGN)', 'Status']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [22, 27, 34], textColor: 255, fontStyle: 'bold', fontSize: 8 },
      styles: { fontSize: 8, cellPadding: 3 },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 28 },
        2: { cellWidth: 24 },
        3: { cellWidth: 65 },
        4: { cellWidth: 22 },
        5: { cellWidth: 28 },
        6: { cellWidth: 30, halign: 'right' },
        7: { cellWidth: 24, halign: 'right' },
        8: { cellWidth: 22, halign: 'center' }
      },
      didDrawPage: (hookData) => {
        // Footer on every page
        const pageCount = doc.internal.getNumberOfPages();
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(
          `TaxWise Nigeria · ${reportTitle} · Page ${hookData.pageNumber} of ${pageCount}`,
          14,
          doc.internal.pageSize.getHeight() - 8
        );
      }
    });

    // ── Summary totals ──
    const totalIncome = entries
      .filter(e => (e.entry_type || e.type || '').toLowerCase() === 'income')
      .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
    const totalExpense = entries
      .filter(e => (e.entry_type || e.type || '').toLowerCase() === 'expense')
      .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
    const totalVAT = entries.reduce((sum, e) => sum + (parseFloat(e.vat_amount) || 0), 0);

    const finalY = Math.min(doc.lastAutoTable.finalY + 10, doc.internal.pageSize.getHeight() - 40);

    // ── Reset font state after autoTable (prevents character-spacing corruption) ──
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(30, 30, 30);
    doc.setCharSpace(0);

    doc.setDrawColor(37, 99, 235);
    doc.setLineWidth(0.5);
    doc.line(14, finalY - 2, 283, finalY - 2);

    doc.text(`Total Income:  ${this.formatCurrency(totalIncome)}`, 14, finalY + 5);
    doc.text(`Total Expense: ${this.formatCurrency(totalExpense)}`, 14, finalY + 12);
    if (totalVAT > 0) doc.text(`Total VAT:     ${this.formatCurrency(totalVAT)}`, 14, finalY + 19);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(`Net Balance:   ${this.formatCurrency(totalIncome - totalExpense)}`, 14, finalY + (totalVAT > 0 ? 28 : 21));

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

    // ── Title block ──
    sheet.mergeCells('A1:I1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = 'TaxWise Nigeria';
    titleCell.font = { size: 18, bold: true, color: { argb: 'FF2563EB' } };
    titleCell.alignment = { horizontal: 'left' };

    sheet.mergeCells('A2:I2');
    sheet.getCell('A2').value = reportTitle;
    sheet.getCell('A2').font = { size: 13, bold: true };

    sheet.getCell('A3').value = 'Organisation:';
    sheet.getCell('A3').font = { bold: true };
    sheet.getCell('B3').value = organization?.name || 'N/A';

    sheet.getCell('A4').value = 'TIN:';
    sheet.getCell('A4').font = { bold: true };
    sheet.getCell('B4').value = organization?.tin || 'N/A';

    sheet.getCell('A5').value = 'Period:';
    sheet.getCell('A5').font = { bold: true };
    sheet.getCell('B5').value = dateRange?.start && dateRange?.end
      ? `${dateRange.start} to ${dateRange.end}` : 'All dates';

    sheet.getCell('A6').value = 'Generated:';
    sheet.getCell('A6').font = { bold: true };
    sheet.getCell('B6').value = this.formatDate(new Date());

    sheet.getCell('A7').value = 'Total Records:';
    sheet.getCell('A7').font = { bold: true };
    sheet.getCell('B7').value = entries.length;

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
