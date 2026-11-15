import Papa from 'papaparse';
import { db } from '../lib/supabase';
import { recordsQuery } from './attendance';
import type { AttendanceRecord, Filters, RecordNote } from '../types';
import { reviewLabels } from '../types';
import { durationLabel } from '../features/imports/csvNormalizer';
export interface ExportAdapter { serialize:(rows:AttendanceRecord[],notes:RecordNote[])=>string }
// An OdooExportAdapter belongs here once the official target mapping is provided.
export const csvExportAdapter:ExportAdapter={serialize:(rows,notes)=>Papa.unparse(rows.map(r=>({Nombre:r.raw_first_name,Apellido:r.raw_last_name,Fecha:r.work_date??r.raw_row.date,Entrada:r.check_in??r.raw_row.check_in,Salida:r.check_out??'',Duración:durationLabel(r.duration_minutes),'Estado de calidad':r.issue_flags.length?r.issue_flags.join(' | '):'Completo','Estado de revisión':reviewLabels[r.review_status],Observación:notes.filter(n=>n.record_id===r.id).map(n=>`[${n.created_at}] ${n.body}`).join(' | ')})),{escapeFormulae:true,newline:'\r\n'})};
export async function exportRecords(filters:Filters,issuesOnly=false){
 const rows:AttendanceRecord[]=[];let offset=0;
 while(true){const {data,error}=await recordsQuery(filters,issuesOnly).range(offset,offset+499);if(error) throw error;rows.push(...data as AttendanceRecord[]);if(data.length<500) break;offset+=500;}
 if(!rows.length) throw new Error('No hay registros para exportar con estos filtros.');
 const notes:RecordNote[]=[];
 for(let i=0;i<rows.length;i+=100){let start=0;while(true){const {data,error}=await db().from('attendance_record_notes').select('*').in('record_id',rows.slice(i,i+100).map(r=>r.id)).order('created_at').order('id').range(start,start+499);if(error) throw error;notes.push(...data as RecordNote[]);if(data.length<500) break;start+=500;}}
 const content=csvExportAdapter.serialize(rows,notes);
 const {error}=await db().rpc('log_export',{p_metadata:{filters,issuesOnly,records:rows.length}});if(error) throw error;
 const url=URL.createObjectURL(new Blob(['\uFEFF',content],{type:'text/csv;charset=utf-8;'}));const a=document.createElement('a');a.href=url;a.download=`asistencia-procesada-${new Date().toISOString().slice(0,10)}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 return rows.length;
}
