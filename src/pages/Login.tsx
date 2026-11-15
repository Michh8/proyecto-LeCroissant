import { useState } from 'react';
import type { FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { ArrowRight, Leaf, ShieldCheck } from 'lucide-react';
import { configured, db } from '../lib/supabase';
import { useAuth } from '../features/auth/AuthProvider';
import { ErrorBox } from '../components/ui';
import { errorMessage } from '../hooks/useAsync';
export default function Login(){const {session}=useAuth();const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 if(session)return <Navigate to="/dashboard" replace/>;
 async function submit(e:FormEvent){e.preventDefault();setBusy(true);setError('');try{const {error}=await db().auth.signInWithPassword({email,password});if(error)throw error;}catch(e){setError(errorMessage(e));}finally{setBusy(false);}}
 return <div className="login"><aside><div className="brand"><Leaf/><span>Le Croissant<small>PERSONAS & OPERACIONES</small></span></div><div><span className="eyebrow">CADA REGISTRO CUENTA</span><h1>Más claridad.<br/>Mejor cuidado<br/>de tu equipo.</h1><p>Un espacio para organizar la asistencia, revisar excepciones y trabajar con información confiable.</p></div><span className="login-footer"><ShieldCheck size={18}/> Acceso interno · Recursos Humanos</span></aside><main><div className="login-form"><span className="eyebrow">BIENVENIDO A TU ESPACIO</span><h2>Control de asistencia</h2><p>Ingresa con tu cuenta de Recursos Humanos.</p>{!configured?<div className="notice"><div><strong>Conecta tu proyecto de Supabase</strong><p>Copia <code>.env.example</code> a <code>.env</code>, agrega la URL y clave pública, ejecuta la migración SQL y reinicia el servidor.</p><p>Las instrucciones completas están en el README del proyecto.</p></div></div>:<form onSubmit={submit}><label>Correo electrónico<input type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="tu@empresa.com"/></label><label>Contraseña<input type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)}/></label><ErrorBox message={error}/><button className="button" disabled={busy}>{busy?'Ingresando…':'Iniciar sesión'}<ArrowRight size={18}/></button></form>}<p className="muted small-text">¿Necesitas acceso? Contacta al administrador de tu organización.</p></div></main></div>;
}
