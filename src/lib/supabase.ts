import { createClient } from '@supabase/supabase-js';
const url=import.meta.env.VITE_SUPABASE_URL, key=import.meta.env.VITE_SUPABASE_ANON_KEY;
export const configured=Boolean(url&&key);
export const supabase=configured?createClient(url,key):null;
export function db(){if(!supabase) throw new Error('Configura las variables de Supabase en .env para conectar la aplicación.');return supabase;}
