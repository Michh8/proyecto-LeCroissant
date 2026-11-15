import { db } from '../lib/supabase';
import type { AttendanceRecord, AttendanceImport, Filters, RecordNote, RecordEvent, ReviewStatus, Profile, Employee } from '../types';
import { searchName } from '../features/imports/csvNormalizer';
export function recordsQuery(filters:Filters,issuesOnly=false) {
 let q=db().from('attendance_records').select('*',{count:'exact'});
 if(filters.search) q=q.ilike('normalized_name',`%${searchName(filters.search).replace(/[%_]/g,'')}%`);
 if(filters.from) q=q.gte('work_date',filters.from);if(filters.to) q=q.lte('work_date',filters.to);
 if(filters.importId) q=q.eq('import_id',filters.importId);if(filters.issue) q=q.contains('issue_flags',[filters.issue]);
 if(filters.review) q=q.eq('review_status',filters.review);if(issuesOnly) q=q.neq('issue_flags','{}');
 return q.order(filters.sort,{ascending:filters.ascending,nullsFirst:false}).order('id');
}
export async function getRecords(filters:Filters,page=0,issuesOnly=false) { const {data,error,count}=await recordsQuery(filters,issuesOnly).range(page*25,page*25+24);if(error) throw error;return {rows:data as AttendanceRecord[],count:count??0}; }
export async function getImports(){const {data,error}=await db().from('attendance_imports').select('*').order('created_at',{ascending:false}).limit(1000);if(error) throw error;return data as AttendanceImport[];}
export async function getImport(id:string){const {data,error}=await db().from('attendance_imports').select('*').eq('id',id).single();if(error) throw error;return data as AttendanceImport;}
export async function getHistory(id:string){const [notes,events]=await Promise.all([db().from('attendance_record_notes').select('*').eq('record_id',id).order('created_at'),db().from('attendance_record_events').select('*').eq('record_id',id).order('created_at')]);if(notes.error) throw notes.error;if(events.error) throw events.error;return {notes:notes.data as RecordNote[],events:events.data as RecordEvent[]};}
export async function reviewRecord(id:string,status:ReviewStatus,note:string){const {error}=await db().rpc('review_record',{p_id:id,p_status:status,p_note:note});if(error) throw error;}
export async function downloadOriginal(path:string){const {data,error}=await db().storage.from('attendance-imports').createSignedUrl(path,60,{download:true});if(error) throw error;const a=document.createElement('a');a.href=data.signedUrl;a.rel='noopener';a.target='_blank';a.click();}
export async function getProfiles(){const {data,error}=await db().from('profiles').select('*').order('created_at');if(error) throw error;return data as Profile[];}
export async function getEmployees(search:string,page:number){const {data,error,count}=await db().from('employee_summary').select('*',{count:'exact'}).ilike('normalized_name',`%${searchName(search).replace(/[%_]/g,'')}%`).order('normalized_name').order('id').range(page*25,page*25+24);if(error) throw error;return {rows:data as Employee[],count:count??0};}
export interface DashboardStats {records:number;employees:number;complete:number;issues:number;pending:number;missing:number;minutes:number;imports:number;daily:{day:string;records:number;hours:number}[];by_issue:{issue:string;count:number}[];people:{name:string;count:number}[]}
export async function getStats(from:string,to:string,importId:string){const {data,error}=await db().rpc('dashboard_stats',{p_from:from||null,p_to:to||null,p_import:importId||null});if(error) throw error;return data as DashboardStats;}
