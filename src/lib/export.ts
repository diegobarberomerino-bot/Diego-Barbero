import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType } from 'docx';
import * as XLSX from 'xlsx';
import { Quote, CompanyInfo } from '../types';
import { formatCurrency, formatDate } from './utils';

export async function exportToPDF(elementId: string, filename: string) {
  const element = document.getElementById(elementId);
  if (!element) return;

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    logging: false,
  });

  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF('p', 'mm', 'a4');
  const imgProps = pdf.getImageProperties(imgData);
  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

  pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
  pdf.save(`${filename}.pdf`);
}

export async function exportToWord(quote: Quote, company: CompanyInfo) {
  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            children: [
              new TextRun({ text: company.name, bold: true, size: 32 }),
            ],
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({
            children: [
              new TextRun({ text: `Presupuesto Nº: ${quote.quoteNumber}`, bold: true }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: `Fecha: ${formatDate(quote.date)}` }),
            ],
          }),
          new Paragraph({ text: "" }),
          new Paragraph({
            children: [new TextRun({ text: "Datos del Cliente:", bold: true })],
          }),
          new Paragraph({ text: quote.client.name }),
          new Paragraph({ text: quote.client.address }),
          new Paragraph({ text: quote.client.nif }),
          new Paragraph({ text: "" }),
          new Paragraph({
            children: [new TextRun({ text: "Descripción del Trabajo:", bold: true })],
          }),
          new Paragraph({ text: quote.workDescription }),
          new Paragraph({ text: "" }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph("Material")] }),
                  new TableCell({ children: [new Paragraph("Cant.")] }),
                  new TableCell({ children: [new Paragraph("Precio Unit.")] }),
                  new TableCell({ children: [new Paragraph("Total")] }),
                ],
              }),
              ...quote.items.map(item => new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph(item.name)] }),
                  new TableCell({ children: [new Paragraph(item.quantity.toString())] }),
                  new TableCell({ children: [new Paragraph(formatCurrency(item.unitPrice))] }),
                  new TableCell({ children: [new Paragraph(formatCurrency(item.total))] }),
                ],
              })),
            ],
          }),
          new Paragraph({ text: "" }),
          new Paragraph({
            children: [new TextRun({ text: `Total: ${formatCurrency(quote.total)}`, bold: true })],
            alignment: AlignmentType.RIGHT,
          }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${quote.quoteNumber}.docx`;
  a.click();
}

export function exportToExcel(quote: Quote) {
  const data = [
    ["Presupuesto Nº", quote.quoteNumber],
    ["Fecha", formatDate(quote.date)],
    ["Cliente", quote.client.name],
    ["NIF", quote.client.nif],
    ["Dirección", quote.client.address],
    [],
    ["Material", "Cantidad", "Precio Unitario", "Total"],
    ...quote.items.map(item => [item.name, item.quantity, item.unitPrice, item.total]),
    [],
    ["Mano de Obra", "", "", quote.laborCost],
    ["Costes Adicionales", "", "", quote.additionalCosts],
    ["Subtotal", "", "", quote.subtotal],
    ["IVA", "", "", quote.taxAmount],
    ["TOTAL", "", "", quote.total],
  ];

  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Presupuesto");
  XLSX.writeFile(wb, `${quote.quoteNumber}.xlsx`);
}
