import {playbackEngine} from '../services/playbackEngine';
import React,{useEffect,useState} from 'react';
import type {MediaAsset} from '../types/editor';
type Status={status:string;phase?:string;percent?:number;speed?:string;seconds?:number;totalSeconds?:number;error?:string};
export function MediaPreviewStatus({asset}:{asset:MediaAsset}){
 const [status,setStatus]=useState<Status|null>(null);
 const base=asset.fileUrl?.startsWith('/media_downloads/')?'/api/media-preview/'+encodeURIComponent(asset.fileUrl.slice('/media_downloads/'.length)):null;
 useEffect(()=>{
  if(!base||asset.type==='image'||(status&&status.status!=='preparing'))return;
  let disposed=false;
  async function poll(){try{const response=await fetch(base+'/status');if(response.ok){const value=await response.json();if(!disposed){setStatus(value);if(value.status==='ready'&&asset.fileUrl)playbackEngine.refreshMedia(asset.fileUrl);}}}catch{/* Keep the last known progress on a temporary connection failure. */}}
  void poll();const timer=setInterval(poll,1000);return()=>{disposed=true;clearInterval(timer);};
 },[base,asset.type,status?.status]);
 if(!status||status.status==='ready'||asset.type==='image')return null;
 async function action(name:string){try{const response=await fetch(base+'/'+name,{method:'POST'});if(response.ok)setStatus(name==='cancel'?{status:'cancelled'}:{status:'preparing',percent:0});}catch{/* A retry remains available after temporary connection failures. */}}
 const speed=Number.parseFloat(status.speed||'');const remaining=speed>0&&status.totalSeconds?Math.ceil(Math.max(0,status.totalSeconds-(status.seconds||0))/speed/60):null;
 return <div role="status" onClick={e=>e.stopPropagation()} onDoubleClick={e=>e.stopPropagation()} className="mt-1 rounded bg-slate-900 p-1 text-[10px] text-cyan-200">
  {status.status==='preparing'?<><span>{status.phase==='queued'?'Anteprima in coda':'Anteprima'}: {status.percent||0}% {remaining!==null?` · circa ${Math.max(1,remaining)} min rimanenti`:''}</span><progress aria-label={`Preparazione anteprima ${asset.name}`} max={100} value={status.percent||0} className="w-full"/><button type="button" className="underline" onClick={()=>void action('cancel')}>Annulla anteprima</button></>:<><span>{status.status==='cancelled'?'Anteprima annullata. Originale conservato.':status.status==='error'?'Anteprima non riuscita. Originale conservato.':'Anteprima da preparare.'}</span><button type="button" className="ml-1 underline" onClick={()=>void action('retry')}>Prepara anteprima</button></>}
 </div>;
}
