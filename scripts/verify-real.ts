import readXlsx from 'read-excel-file/node';
import { parseRows } from '../src/features/imports/csvParser';
import { readFile } from 'node:fs/promises';
const file=process.argv[2];if(!file)throw new Error('Uso: npm run test:real -- "ruta/al/archivo.xlsx"');
const p=parseRows(await readXlsx(await readFile(file)));
const missing=p.rows.filter(r=>r.issue_flags.includes('MISSING_CHECK_OUT'));
console.log(JSON.stringify({records:p.rows.length,employees:p.employees,missingCheckOut:missing.length,missingWithZero:missing.filter(r=>r.duration_minutes===0).length,valid:p.valid,issues:p.issues,issueTypes:p.rows.flatMap(r=>r.issue_flags).reduce<Record<string,number>>((a,f)=>({...a,[f]:(a[f]??0)+1}),{}),metadata:p.metadata,headerRow:p.headerRow},null,2));
if(p.rows.length!==115||p.employees!==19||missing.length!==11||missing.some(r=>r.duration_minutes!==0))throw new Error('El archivo no coincide con los valores de aceptación de la muestra original.');
