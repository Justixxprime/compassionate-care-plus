// prisma/demo-pdf.ts
//
// Builds a tiny, valid, one-page PDF containing a title and the words
// "Synthetic demo document". Used by the seed script (so the demo
// documents can really be downloaded and opened) and by
// scripts/verify-access.ts (so the upload tests send real PDF bytes).
//
// Written by hand rather than with a PDF library because the project
// takes no new dependencies. Every character is plain ASCII, so byte
// offsets equal string offsets and the cross-reference table is exact.

function escapePdfText(text: string): string {
  return text
    .replace(/[^\x20-\x7e]/g, "?")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

export function makeDemoPdf(title: string): Uint8Array {
  const stream =
    `BT /F1 20 Tf 72 720 Td (${escapePdfText(title)}) Tj ET\n` +
    `BT /F1 12 Tf 72 690 Td (Synthetic demo document. Not a real record.) Tj ET\n`;

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 5 0 R /Resources << /Font << /F1 4 0 R >> >> >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}endstream`,
  ];

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xrefAt = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) {
    pdf += `${String(off).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`;

  return new Uint8Array(Buffer.from(pdf, "latin1"));
}
