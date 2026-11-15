import Papa from 'papaparse';
import type { ImportMetadata, ParsedFile, RawRow } from '../../types';
import { searchName, normalizeDate } from './csvNormalizer';
import { normalizeCsvRow } from './csvValidator';
const headers=['nombre','apellido','fecha','hora de registro de entrada','salida a','duracion total'];
export function parseRows(input:unknown[][]):ParsedFile {
 const rows=input.map(r=>r.map(c=>c instanceof Date?c.toISOString().slice(0,10):String(c??'')));
 const headerRow=rows.findIndex(r=>headers.every(h=>r.some(c=>searchName(c.replace(/^\uFEFF/,''))===h)));
 if(headerRow<0) throw new Error('No se encontraron los encabezados de HikCentral: Nombre, Apellido, Fecha, Hora de registro de entrada, Salida a y Duración total.');
 const cols=headers.map(h=>rows[headerRow].findIndex(c=>searchName(c.replace(/^\uFEFF/,''))===h));
 const metadata:ImportMetadata={exported_at:null,hikcentral_operator:null,period_start:null,period_end:null};
 for(const r of rows.slice(0,headerRow)) {
  const s=r.filter(Boolean).join(' ').trim();
  if(/hora de exportaci[oó]n/i.test(s)) metadata.exported_at=s.match(/\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/)?.[0]??null;
  if(/^operador\s*:/i.test(s)) metadata.hikcentral_operator=s.replace(/^operador\s*:\s*/i,'');
  if(/^per[ií]odo\s*:/i.test(s)) { const dates=s.match(/\d{4}-\d{2}-\d{2}/g); metadata.period_start=normalizeDate(dates?.[0]??''); metadata.period_end=normalizeDate(dates?.[1]??''); }
 }
 const seen=new Set<string>(); let duplicates=0;
 const parsed=rows.slice(headerRow+1).map((r,i)=>({r,i})).filter(({r})=>r.some(c=>c.trim())).map(({r,i})=>{
  const v=cols.map(c=>r[c]??''); const raw:RawRow={first_name:v[0],last_name:v[1],date:v[2],check_in:v[3],check_out:v[4],duration:v[5],source_row:headerRow+i+2};
  const row=normalizeCsvRow(raw); if(seen.has(row.fingerprint)) {row.issue_flags.push('POSSIBLE_DUPLICATE');duplicates++;} seen.add(row.fingerprint); return row;
 });
 if(!parsed.length) throw new Error('El archivo contiene encabezados pero no tiene marcaciones.');
 if(parsed.length>10000) throw new Error('El límite por importación es de 10 000 filas. Divide la exportación por períodos.');
 return {metadata,rows:parsed,employees:new Set(parsed.map(r=>r.normalized_name).filter(Boolean)).size,valid:parsed.filter(r=>r.valid).length,issues:parsed.filter(r=>r.issue_flags.length).length,duplicates,headerRow:headerRow+1};
}
export function parseCsv(text:string):ParsedFile {
 const clean=text.replace(/^\uFEFF/,'');
 // Detect delimiter from the actual header; metadata has different column counts.
 const header=clean.split(/\r?\n/).find(l=>/nombre/i.test(l)&&/apellido/i.test(l));
 const delimiter=[',',';','\t'].sort((a,b)=>(header?.split(b).length??0)-(header?.split(a).length??0))[0];
 const result=Papa.parse<string[]>(clean,{delimiter,skipEmptyLines:'greedy'});
 if(result.errors.length) throw new Error(`CSV inválido: ${result.errors[0].message}`);
 return parseRows(result.data);
}
export async function parseFile(file:File):Promise<ParsedFile> {
 if(file.size>20*1024*1024) throw new Error('El archivo supera el límite de 20 MB.');
 if(/\.xlsx$/i.test(file.name)) {const {default:readXlsx}=await import('read-excel-file'); return parseRows(await readXlsx(file));}
 if(!/\.csv$/i.test(file.name)) throw new Error('Selecciona un archivo CSV o XLSX.');
 const buffer=await file.arrayBuffer(); let text=new TextDecoder('utf-8').decode(buffer); if(text.includes('\uFFFD')) text=new TextDecoder('windows-1252').decode(buffer); return parseCsv(text);
}
