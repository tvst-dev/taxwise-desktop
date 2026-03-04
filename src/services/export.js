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
   * Format currency for export
   */
  formatCurrency(amount) {
    return `₦${Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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

    // Header
    doc.setFillColor(37, 99, 235);
    doc.rect(0, 0, 297, 30, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(title || 'Transaction Report', 14, 18);
    
    doc.setFontSize(9);
    doc.text(`${dateRange?.start || ''} - ${dateRange?.end || ''}`, 14, 25);

    // Entries Table
    const tableData = entries.map((entry, index) => [
      index + 1,
      entry.entryId || `#ENT-${entry.id}`,
      this.formatDate(entry.date),
      entry.description || '',
      entry.type || '',
      this.formatCurrency(entry.amount),
      entry.status || ''
    ]);

    autoTable(doc, {
      startY: 38,
      head: [['#', 'Entry ID', 'Date', 'Description', 'Type', 'Amount', 'Status']],
      body: tableData,
      theme: 'striped',
      headStyles: {
        fillColor: [22, 27, 34],
        textColor: 255,
        fontStyle: 'bold'
      },
      styles: {
        fontSize: 9,
        cellPadding: 3
      },
      columnStyles: {
        0: { cellWidth: 15 },
        1: { cellWidth: 35 },
        2: { cellWidth: 30 },
        3: { cellWidth: 80 },
        4: { cellWidth: 30 },
        5: { cellWidth: 40, halign: 'right' },
        6: { cellWidth: 30 }
      }
    });

    // Summary
    const totalIncome = entries
      .filter(e => e.type === 'income' || e.type === 'Revenue')
      .reduce((sum, e) => sum + (e.amount || 0), 0);
    
    const totalExpense = entries
      .filter(e => e.type === 'expense' || e.type === 'Expense')
      .reduce((sum, e) => sum + (e.amount || 0), 0);

    const finalY = doc.lastAutoTable.finalY + 10;
    
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.text(`Total Income: ${this.formatCurrency(totalIncome)}`, 14, finalY);
    doc.text(`Total Expense: ${this.formatCurrency(totalExpense)}`, 14, finalY + 6);
    doc.setFont('helvetica', 'bold');
    doc.text(`Net: ${this.formatCurrency(totalIncome - totalExpense)}`, 14, finalY + 14);

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

    workbook.creator = COMPANY_INFO.name;
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Transactions');

    // Header
    sheet.mergeCells('A1:G1');
    sheet.getCell('A1').value = title || 'Transaction Report';
    sheet.getCell('A1').font = { size: 16, bold: true };

    sheet.getCell('A2').value = `Date Range: ${dateRange?.start || ''} - ${dateRange?.end || ''}`;
    sheet.getCell('A3').value = `Organization: ${organization?.name || 'N/A'}`;

    // Data table
    sheet.addTable({
      name: 'TransactionsTable',
      ref: 'A5',
      headerRow: true,
      totalsRow: true,
      style: {
        theme: 'TableStyleMedium2',
        showRowStripes: true
      },
      columns: [
        { name: '#', filterButton: false },
        { name: 'Entry ID', filterButton: true },
        { name: 'Date', filterButton: true },
        { name: 'Description', filterButton: false },
        { name: 'Type', filterButton: true },
        { name: 'Amount', filterButton: false, totalsRowFunction: 'sum' },
        { name: 'Status', filterButton: true }
      ],
      rows: entries.map((entry, index) => [
        index + 1,
        entry.entryId || `#ENT-${entry.id}`,
        this.formatDate(entry.date),
        entry.description || '',
        entry.type || '',
        entry.amount || 0,
        entry.status || ''
      ])
    });

    // Column widths
    sheet.getColumn('A').width = 8;
    sheet.getColumn('B').width = 15;
    sheet.getColumn('C').width = 15;
    sheet.getColumn('D').width = 40;
    sheet.getColumn('E').width = 12;
    sheet.getColumn('F').width = 18;
    sheet.getColumn('F').numFmt = '₦#,##0.00';
    sheet.getColumn('G').width = 12;

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
