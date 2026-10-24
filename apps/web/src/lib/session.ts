"use client";
import {useEffect,useState} from 'react';
export const API=(process.env.NEXT_PUBLIC_API_ORIGIN||'').replace(/\/+$/,'');
export async function api(path:string,options:RequestInit={}){
 const request=()=>fetch(API+'/api/v1'+path,{...options,credentials:'include',headers:{...(options.body&&typeof options.body==='string'?{'Content-Type':'application/json'}:{}),...options.headers}});
 let response=await request();
 if(response.status===401&&!['/auth/login','/auth/refresh','/auth/logout'].includes(path)){const refresh=await fetch(API+'/api/v1/auth/refresh',{method:'POST',credentials:'include'});if(refresh.ok)response=await request();}
 const data=await response.json();if(!response.ok)throw Error(data.error?.message||data.message||'Service unavailable');return data;
}
export function useSession(){
 const [session,setSession]=useState<{role:'student'|'admin'}|null>(null),[loading,setLoading]=useState(true);
 useEffect(()=>{let active=true;api('/auth/session').then(s=>{if(active)setSession(s)}).catch(()=>{}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[]);
 return {session,loading};
}
