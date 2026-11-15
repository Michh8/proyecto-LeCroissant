import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import { AlertCircle, CheckCircle2, FileClock, X } from 'lucide-react';
export function Loading(){return <div className="skeletons" role="status" aria-label="Cargando"><div/><div/><div/></div>;}
export function ErrorBox({message}:{message:string}){return message?<div role="alert" className="notice error"><AlertCircle size={18}/><span>{message}</span></div>:null;}
export function Empty({title='No hay registros importados todavía',text='Sube un archivo de HikCentral para comenzar.',children}:{title?:string;text?:string;children?:ReactNode}){return <div className="empty"><FileClock size={36}/><h3>{title}</h3><p>{text}</p>{children}</div>;}
export function PageTitle({eyebrow,title,description,action}:{eyebrow?:string;title:string;description:string;action?:ReactNode}){return <div className="page-title"><div><span className="eyebrow">{eyebrow??'RECURSOS HUMANOS'}</span><h1>{title}</h1><p>{description}</p></div>{action}</div>;}
export function Pagination({page,total,onChange}:{page:number;total:number;onChange:(p:number)=>void}){return <div className="pagination"><span>{total?`${page*25+1}–${Math.min((page+1)*25,total)} de ${total}`:'0 resultados'}</span><div><button className="button secondary small" disabled={page===0} onClick={()=>onChange(page-1)}>Anterior</button><button className="button secondary small" disabled={(page+1)*25>=total} onClick={()=>onChange(page+1)}>Siguiente</button></div></div>;}
const ToastContext=createContext<(message:string)=>void>(()=>{});
export function ToastProvider({children}:{children:ReactNode}){const [message,setMessage]=useState('');return <ToastContext.Provider value={m=>{setMessage(m);setTimeout(()=>setMessage(v=>v===m?'':v),6000);}}>{children}{message&&<div role="status" className="toast"><CheckCircle2 size={18}/>{message}<button aria-label="Cerrar aviso" onClick={()=>setMessage('')}><X size={16}/></button></div>}</ToastContext.Provider>;}
export const useToast=()=>useContext(ToastContext);
