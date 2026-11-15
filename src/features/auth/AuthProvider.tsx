import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { Profile } from '../../types';
import { supabase } from '../../lib/supabase';
const Context=createContext<{session:Session|null;profile:Profile|null;loading:boolean;error:string}>({session:null,profile:null,loading:true,error:''});
export function AuthProvider({children}:{children:ReactNode}) {
 const [session,setSession]=useState<Session|null>(null),[profile,setProfile]=useState<Profile|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
 useEffect(()=>{if(!supabase){setLoading(false);return;}const client=supabase;let alive=true;let generation=0;
  async function update(next:Session|null){const current=++generation;if(!alive)return;setSession(next);setProfile(null);setError('');setLoading(true);
   if(next){const {data,error:err}=await client.from('profiles').select('*').eq('id',next.user.id).single();if(alive&&current===generation){setProfile(data as Profile|null);if(err)setError('No se pudo cargar tu perfil. Verifica las migraciones y permisos en Supabase.');}}
   if(alive&&current===generation)setLoading(false);
  }
  client.auth.getSession().then(({data,error:err})=>{if(err&&alive){setError(err.message);setLoading(false);}else void update(data.session);});
  const {data:{subscription}}=client.auth.onAuthStateChange((_event,next)=>{setTimeout(()=>void update(next),0);});
  return()=>{alive=false;subscription.unsubscribe();};
 },[]);
 return <Context.Provider value={{session,profile,loading,error}}>{children}</Context.Provider>;
}
export const useAuth=()=>useContext(Context);
