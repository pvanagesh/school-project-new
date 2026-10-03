import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface PdfColumn {
  header: string;
  key: string;
}

export function exportTableToPdf(
  title: string,
  subtitle: string | null,
  columns: PdfColumn[],
  rows: Array<Record<string, string | number>>,
  filename: string,
) {
  const doc = new jsPDF({ orientation: columns.length > 6 ? 'landscape' : 'portrait' });

  doc.setFontSize(14);
  doc.text(title, 14, 15);
  if (subtitle) {
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(subtitle, 14, 21);
  }

  autoTable(doc, {
    startY: subtitle ? 26 : 20,
    head: [columns.map((c) => c.header)],
    body: rows.map((row) => columns.map((c) => row[c.key] ?? '')),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [25, 118, 210] },
  });

  doc.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
}
