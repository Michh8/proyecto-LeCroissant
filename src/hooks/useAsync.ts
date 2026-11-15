import { useEffect, useState } from 'react';
export function useAsync<T>(fn:()=>Promise<T>,deps:unknown[]){
 const [data,setData]=useState<T>();const [error,setError]=useState('');const [loading,setLoading]=useState(true);const [version,setVersion]=useState(0);
 useEffect(()=>{let current=true;setLoading(true);setError('');fn().then(v=>{if(current)setData(v);}).catch(e=>{if(current)setError(errorMessage(e));}).finally(()=>{if(current)setLoading(false);});return()=>{current=false;};},[...deps,version]);
 return {data,error,loading,reload:()=>setVersion(v=>v+1)};
}
export function errorMessage(e:unknown):string {return e&&typeof e==='object'&&'message' in e?String(e.message):'No se pudo completar la operación. Intenta nuevamente.';}
