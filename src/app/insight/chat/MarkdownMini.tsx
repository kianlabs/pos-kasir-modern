"use client";

import type { ReactNode } from "react";

// Renderer ringan untuk balasan "KRING! Insight": bold, inline code, bullet,
// dan tabel markdown. Tanpa dependensi eksternal (proyek ini stdlib-lean) —
// cukup untuk bentuk jawaban yang dihasilkan prompt narasi (≤150 kata, angka
// dari tool deterministik). Bukan parser markdown umum.

function inline(text: string, keyBase: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let last = 0;
  let k = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("**")) {
      nodes.push(
        <strong key={`${keyBase}-b${k++}`} className="font-semibold text-ink-950">
          {tok.slice(2, -2)}
        </strong>,
      );
    } else {
      nodes.push(
        <code key={`${keyBase}-c${k++}`} className="rounded bg-ink-100 px-1 py-0.5 text-caption">
          {tok.slice(1, -1)}
        </code>,
      );
    }
    last = m.index + tok.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

function isSeparator(line: string): boolean {
  return /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?$/.test(line.trim());
}

function splitCells(line: string): string[] {
  let s = line.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|")) s = s.slice(0, -1);
  return s.split("|").map((c) => c.trim());
}

export default function MarkdownMini({ text }: { text: string }) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }

    // Tabel markdown (baris diawali "|", baris pemisah --- dilewati).
    if (line.trim().startsWith("|")) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        if (!isSeparator(lines[i])) rows.push(splitCells(lines[i]));
        i++;
      }
      if (rows.length) {
        const [head, ...body] = rows;
        blocks.push(
          <div key={`t${key++}`} className="my-2 overflow-x-auto">
            <table className="w-full border-collapse text-caption">
              <thead>
                <tr>
                  {head.map((h, hi) => (
                    <th
                      key={hi}
                      className="border-b border-ink-200 px-2 py-1 text-left font-semibold text-ink-950"
                    >
                      {inline(h, `th${hi}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {body.map((r, ri) => (
                  <tr key={ri}>
                    {r.map((c, ci) => (
                      <td key={ci} className="border-b border-ink-100 px-2 py-1 text-ink-700">
                        {inline(c, `td${ri}-${ci}`)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>,
        );
      }
      continue;
    }

    // Daftar bullet.
    if (/^\s*[-*•]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*•]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*•]\s+/, ""));
        i++;
      }
      blocks.push(
        <ul key={`l${key++}`} className="my-1 list-disc space-y-0.5 pl-5">
          {items.map((it, ii) => (
            <li key={ii} className="text-body-sm text-ink-700">
              {inline(it, `li${ii}`)}
            </li>
          ))}
        </ul>,
      );
      continue;
    }

    // Paragraf (sampai baris kosong atau awal blok lain).
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].trim().startsWith("|") &&
      !/^\s*[-*•]\s+/.test(lines[i])
    ) {
      para.push(lines[i]);
      i++;
    }
    blocks.push(
      <p key={`p${key++}`} className="whitespace-pre-wrap text-body-sm text-ink-700">
        {inline(para.join("\n"), `p${key}`)}
      </p>,
    );
  }

  return <div className="space-y-1">{blocks}</div>;
}
