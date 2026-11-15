import type { RawRow, ParsedRow, IssueFlag } from '../../types';
import { normalizeDate, normalizeTime, normalizeName, searchName, parseDurationToMinutes, timeMinutes } from './csvNormalizer';
export function normalizeCsvRow(raw:RawRow):ParsedRow {
 const first_name=normalizeName(raw.first_name),last_name=normalizeName(raw.last_name),normalized_name=searchName(`${first_name} ${last_name}`);
 const work_date=normalizeDate(raw.date),check_in=normalizeTime(raw.check_in),check_out=normalizeTime(raw.check_out),duration_minutes=parseDurationToMinutes(raw.duration);
 const issue_flags:IssueFlag[]=[];
 if(!work_date) issue_flags.push('INVALID_DATE'); if(!check_in) issue_flags.push('INVALID_CHECK_IN');
 if(raw.check_out.trim()==='-'||!raw.check_out.trim()) issue_flags.push('MISSING_CHECK_OUT'); else if(!check_out) issue_flags.push('INVALID_CHECK_OUT');
 if(duration_minutes===null) issue_flags.push('INVALID_DURATION'); else if(duration_minutes===0) issue_flags.push('ZERO_DURATION');
 if(!first_name||!last_name) issue_flags.push('EMPLOYEE_MATCH_REQUIRED');
 if(check_in&&check_out&&duration_minutes!==null&&(timeMinutes(check_out)-timeMinutes(check_in)+1440)%1440!==duration_minutes) issue_flags.push('DURATION_MISMATCH');
 const fingerprint=JSON.stringify([normalized_name,work_date??raw.date.trim(),check_in??raw.check_in.trim(),check_out??raw.check_out.trim(),duration_minutes??raw.duration.trim()]);
 return {raw,first_name,last_name,normalized_name,work_date,check_in,check_out,duration_minutes,issue_flags,valid:!issue_flags.some(f=>f.startsWith('INVALID_')),fingerprint};
}
