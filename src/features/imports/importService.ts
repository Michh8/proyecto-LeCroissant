import { db } from '../../lib/supabase';
import type { ParsedFile } from '../../types';
export async function checksum(file:File){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await file.arrayBuffer()))).map(b=>b.toString(16).padStart(2,'0')).join('');}
export async function findDuplicate(hash:string){const {data,error}=await db().from('attendance_imports').select('id,original_filename').eq('file_checksum',hash).maybeSingle();if(error) throw error;return data as {id:string;original_filename:string}|null;}
export interface ImportResult {id:string;total:number;valid:number;issues:number;duplicates:number;inserted:number}
export async function confirmImport(file:File,parsed:ParsedFile,hash:string):Promise<ImportResult> {
 const client=db();const {data:{user},error:authError}=await client.auth.getUser();if(authError) throw authError;if(!user) throw new Error('Inicia sesión nuevamente.');
 const id=crypto.randomUUID(),filename=file.name.replace(/[/\\]/g,'_').slice(0,200),path=`${user.id}/${id}/${filename}`;
 const {error:uploadError}=await client.storage.from('attendance-imports').upload(path,file,{contentType:/\.xlsx$/i.test(file.name)?'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':'text/csv',upsert:false});if(uploadError) throw uploadError;
 const {data,error}=await client.rpc('confirm_import',{p_id:id,p_filename:filename,p_path:path,p_checksum:hash,p_size:file.size,p_metadata:parsed.metadata,p_rows:parsed.rows.map(r=>r.raw)});
 if(error){await client.storage.from('attendance-imports').remove([path]);throw error;}
 return data as ImportResult;
}
