export const normalizeName=(value:string)=>value.trim().replace(/\s+/g,' ');
export const searchName=(value:string)=>normalizeName(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export function normalizeDate(value:string):string|null {
  const s=value.trim(); if(!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y,m,d]=s.split('-').map(Number); const date=new Date(`${s}T12:00:00Z`);
  return y>=1900 && y<=2100 && date.getUTCFullYear()===y && date.getUTCMonth()+1===m && date.getUTCDate()===d?s:null;
}
export function normalizeTime(value:string):string|null { const s=value.trim(); return /^([01]\d|2[0-3]):[0-5]\d$/.test(s)?s:null; }
export function parseDurationToMinutes(value:string):number|null { const s=value.replace(/\s/g,''); if(!/^\d{1,3}:[0-5]\d$/.test(s)) return null; const [h,m]=s.split(':').map(Number); return h*60+m; }
export const durationLabel=(n:number|null)=>n===null?'—':`${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;
export const timeMinutes=(t:string)=>Number(t.slice(0,2))*60+Number(t.slice(3,5));
