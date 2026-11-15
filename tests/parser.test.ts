import { describe, it, expect } from 'vitest';
import { parseCsv, parseRows } from '../src/features/imports/csvParser';
import { normalizeDate, normalizeTime, normalizeName, searchName, parseDurationToMinutes } from '../src/features/imports/csvNormalizer';
import { normalizeCsvRow } from '../src/features/imports/csvValidator';
const header='Nombre,Apellido,Fecha,Hora de registro de entrada,Salida a,Duración total';
describe('HikCentral parser',()=>{
 it('finds headers after metadata and extracts period',()=>{const result=parseCsv(`Registros de entradas y salidas\nHora de exportación: 2026-09-21 10:05\nOperador: admin\nPeriodo: 2026-09-12 - 2026-09-19\n\n${header}\nPersona,Prueba,2026-09-19,13:31,22:14,08 : 43\n`);expect(result.rows).toHaveLength(1);expect(result.metadata).toEqual({exported_at:'2026-09-21 10:05',hikcentral_operator:'admin',period_start:'2026-09-12',period_end:'2026-09-19'});expect(result.rows[0].duration_minutes).toBe(523);expect(result.rows[0].issue_flags).toEqual([]);});
 it('normalizes missing check out and zero duration',()=>{const r=parseCsv(`${header}\nPersona,Prueba,2026-09-19,08:02,-,00 : 00`).rows[0];expect(r.check_out).toBeNull();expect(r.duration_minutes).toBe(0);expect(r.issue_flags).toEqual(['MISSING_CHECK_OUT','ZERO_DURATION']);expect(r.valid).toBe(true);});
 it('ignores blank rows, quoted fields, and handles semicolons',()=>{const result=parseCsv(`metadata\n${header.replaceAll(',',';')}\n"Persona, Uno";Prueba;2026-09-19;08:00;09:00;01:00\n;;;;;\n`);expect(result.rows).toHaveLength(1);expect(result.rows[0].first_name).toBe('Persona, Uno');});
 it('rejects missing headers',()=>expect(()=>parseCsv('nombre,fecha\nA,2026-01-01')).toThrow('encabezados'));
 it('validates impossible dates and times',()=>{expect(normalizeDate('2026-02-30')).toBeNull();expect(normalizeDate('2024-02-29')).toBe('2024-02-29');expect(normalizeDate('2026-02-29')).toBeNull();expect(normalizeTime('24:30')).toBeNull();expect(normalizeTime('08:99')).toBeNull();expect(parseDurationToMinutes('2:80')).toBeNull();});
 it('flags invalid records without dropping original fields',()=>{const r=parseCsv(`${header}\nPersona,Prueba,2026-02-30,25:00,x,n/a`).rows[0];expect(r.valid).toBe(false);expect(r.issue_flags).toEqual(['INVALID_DATE','INVALID_CHECK_IN','INVALID_CHECK_OUT','INVALID_DURATION']);expect(r.raw.date).toBe('2026-02-30');});
 it('supports midnight and detects mismatch',()=>{const raw={first_name:' Ana ',last_name:'Peña',date:'2026-09-19',check_in:'22:00',check_out:'06:00',duration:'08 : 00',source_row:1};expect(normalizeCsvRow(raw).issue_flags).toEqual([]);expect(normalizeCsvRow({...raw,duration:'07:00'}).issue_flags).toContain('DURATION_MISMATCH');});
 it('preserves accents for display and original names for audit',()=>{expect(normalizeName('  María   Muñoz ')).toBe('María Muñoz');expect(searchName('  María   Muñoz ')).toBe('maria munoz');});
 it('detects duplicates',()=>{const line='Persona,Prueba,2026-09-19,08:00,09:00,01:00';const p=parseCsv(`${header}\n${line}\n${line}`);expect(p.duplicates).toBe(1);expect(p.rows[1].issue_flags).toContain('POSSIBLE_DUPLICATE');});
 it('supports reordered headers and numeric cell values as text',()=>{const p=parseRows([['Fecha','Nombre','Apellido','Salida a','Duración total','Hora de registro de entrada'],['2026-01-01','A','B','10:00','01:00','09:00']]);expect(p.rows[0].check_in).toBe('09:00');});
});
