import { expect,it } from 'vitest';
import Papa from 'papaparse';
import { csvExportAdapter } from '../src/services/export';
import type { AttendanceRecord } from '../src/types';
it('exports notes, escapes formulas and preserves quoted names',()=>{
 const row={id:'r1',raw_first_name:'=HYPERLINK("bad")',raw_last_name:'Prueba, Nombre',work_date:'2026-09-19',check_in:'08:00:00',check_out:null,duration_minutes:0,issue_flags:['MISSING_CHECK_OUT'],review_status:'pending',raw_row:{date:'2026-09-19',check_in:'08:00'}} as AttendanceRecord;
 const csv=csvExportAdapter.serialize([row],[{id:'n1',record_id:'r1',user_id:'u1',body:'Nota con coma, y salto\nde línea',created_at:'2026-09-21T10:00:00Z'}]);
 const data=Papa.parse<Record<string,string>>(csv,{header:true}).data[0];
 expect(data.Nombre).toBe("'=HYPERLINK(\"bad\")");expect(data.Apellido).toBe('Prueba, Nombre');expect(data.Salida).toBe('');expect(data.Duración).toBe('00:00');expect(data.Observación).toContain('Nota con coma, y salto\nde línea');
});
