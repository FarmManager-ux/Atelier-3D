import { format } from "date-fns";
import { GUEST_COLUMNS, toCsv } from "@/lib/domain/csv";

export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const stamp = () => format(new Date(), "yyyy-MM-dd");

export function exportCsv(rows: Record<string, string | number>[], base = "convidados") {
  downloadBlob(`${base}-${stamp()}.csv`, new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" }));
}

/** Excel (.xlsx) com cabeçalho formatado e colunas com largura adequada. */
export async function exportXlsx(rows: Record<string, string | number>[], base = "convidados") {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Convidados");
  const headers = GUEST_COLUMNS.map((c) => c.header);
  ws.columns = headers.map((h) => ({ header: h, key: h, width: Math.min(40, Math.max(12, h.length + 4)) }));
  rows.forEach((r) => ws.addRow(headers.map((h) => {
    const v = r[h] ?? "";
    return typeof v === "string" && /^[=+\-@]/.test(v) && !/^-?\d+([.,]\d+)?$/.test(v) ? `'${v}` : v;
  })));
  ws.getRow(1).font = { bold: true, color: { argb: "FF2F3A2C" } };
  ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE6EBE0" } };
  ws.views = [{ state: "frozen", ySplit: 1 }];
  const buf = await wb.xlsx.writeBuffer();
  downloadBlob(`${base}-${stamp()}.xlsx`, new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
}

/** Modelo para preencher e importar. */
export function downloadTemplate() {
  const headers = GUEST_COLUMNS.filter((c) => c.key !== "table" && c.key !== "seats").map((c) => c.header);
  const example: Record<string, string> = {
    "Nome completo": "Maria Silva", "Apelido": "Silva", "Telefone": "912345678", "Email": "maria@exemplo.pt", "Grupo/Família": "Família Silva",
    "Relação": "Prima", "Lado": "Ambos", "Categoria": "Família", "Adulto/Criança": "Adulto", "Nomes dos acompanhantes": "João Silva",
    "N.º acompanhantes": "1", "N.º crianças": "0", "Restrições alimentares": "Vegetariana", "Alergias": "", "Observações": "",
    "Estado do convite": "Por convidar", "Presença": "Sem resposta",
  };
  downloadBlob("modelo-convidados.csv", new Blob([toCsv([example], headers)], { type: "text/csv;charset=utf-8" }));
}

/** Lê CSV ou Excel e devolve linhas "cabeçalho → texto". */
export async function readSpreadsheet(file: File): Promise<Record<string, string>[]> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv") || name.endsWith(".txt")) {
    const Papa = (await import("papaparse")).default;
    const text = (await file.text()).replace(/^﻿/, "");
    const res = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: "greedy", delimitersToGuess: [";", ",", "\t", "|"] });
    return res.data;
  }
  if (name.endsWith(".xlsx")) {
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await file.arrayBuffer());
    const ws = wb.worksheets[0];
    if (!ws) return [];
    const headers: string[] = [];
    ws.getRow(1).eachCell({ includeEmpty: false }, (cell, col) => { headers[col - 1] = String(cell.text ?? cell.value ?? "").trim(); });
    const rows: Record<string, string>[] = [];
    ws.eachRow({ includeEmpty: false }, (row, n) => {
      if (n === 1) return;
      const rec: Record<string, string> = {};
      headers.forEach((h, i) => { if (h) rec[h] = String(row.getCell(i + 1).text ?? "").trim(); });
      rows.push(rec);
    });
    return rows;
  }
  throw new Error("Formato não suportado. Use um ficheiro .csv ou .xlsx.");
}
