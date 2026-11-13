import type {TimelineClip,Track} from '../types/editor';
import {clipRate} from './clipSpeed';
/** Flatten non-destructive joined clips for the existing decoder/export engine. */
export function expandCompoundClips(clips:TimelineClip[]):TimelineClip[]{
 let count=0;
 function expand(c:TimelineClip,depth=0):TimelineClip[]{
  if(++count>10000||depth>8)throw new Error('Troppi elementi nel mattoncino composto.');
  if(c.rateMultiplier!==undefined&&(!Number.isFinite(c.rateMultiplier)||c.rateMultiplier<=0||c.rateMultiplier>4096))throw new Error('Velocità composta non valida.');
  if(c.fadeEnvelopes&&(!Array.isArray(c.fadeEnvelopes)||c.fadeEnvelopes.length>32||c.fadeEnvelopes.some(e=>![e.offset,e.rate,e.duration,e.fadeIn,e.fadeOut].every(Number.isFinite)||e.rate<=0||e.duration<=0||e.fadeIn<0||e.fadeOut<0)))throw new Error('Dissolvenza composta non valida.');
  if(!c.segments)return [c];
  if(!Array.isArray(c.segments)||!c.segments.length||!Number.isFinite(c.duration)||!Number.isFinite(c.offset)||c.duration<=0||c.offset<0)throw new Error('Mattoncino composto non valido.');
  const rate=clipRate(c),from=c.offset,to=from+c.duration*rate;
  return c.segments.flatMap(segment=>expand(segment,depth+1)).flatMap(segment=>{
   const a=Math.max(from,segment.startTime),b=Math.min(to,segment.startTime+segment.duration);if(b<=a)return [];
   return [{...segment,id:`${c.id}:${segment.id}`,trackId:c.trackId,startTime:c.startTime+(a-from)/rate,duration:(b-a)/rate,offset:(segment.offset||0)+(a-segment.startTime)*clipRate(segment),rateMultiplier:(segment.rateMultiplier||1)*rate,
    fadeIn:0,fadeOut:0,fadeEnvelopes:[...(segment.fadeEnvelopes||[]).map(e=>({...e,offset:e.offset+(a-segment.startTime)*e.rate,rate:e.rate*rate})),...(segment.fadeIn||segment.fadeOut?[{offset:a-segment.startTime,rate,duration:segment.duration,fadeIn:segment.fadeIn,fadeOut:segment.fadeOut}]:[]),...(c.fadeIn||c.fadeOut?[{offset:(a-from)/rate,rate:1,duration:c.duration,fadeIn:c.fadeIn,fadeOut:c.fadeOut}]:[])],
    transparency:segment.transparency*c.transparency/100,volumeDb:segment.volumeDb+c.volumeDb,
    effects:[...(segment.effects||[]),...(c.effects||[])],adjustments:{...segment.adjustments,...c.adjustments},colorGrade:c.colorGrade||segment.colorGrade,
    linkedClipId:segment.linkedClipId?`compound-linked:${segment.linkedClipId}`:undefined,
   }];
  });
 }
 return clips.flatMap(c=>expand(c));
}
/** One joined block per selected track, preserving timeline positions and gaps. */
export function joinSelectedClips(clips:TimelineClip[],tracks:Track[],ids:string[]){
 const selected=new Set(ids),chosen=clips.filter(c=>selected.has(c.id));
 if(chosen.length!==selected.size||chosen.length<2||chosen.some(c=>!['video','audio'].includes(c.type)))throw new Error('Seleziona almeno due mattoncini video o audio.');
 const groups=new Map<string,TimelineClip[]>();for(const c of chosen){if(!tracks.some(t=>t.id===c.trackId&&t.type===c.type))throw new Error('Pista della selezione non valida.');groups.set(c.trackId,[...(groups.get(c.trackId)||[]),c]);}
 const merged:TimelineClip[]=[],removed=new Set<string>(),members=new Map<string,Set<string>>();
 for(const [trackId,parts] of groups){
  if(parts.length<2)continue;
  const start=Math.min(...parts.map(c=>c.startTime)),end=Math.max(...parts.map(c=>c.startTime+c.duration));
  if(clips.some(c=>c.trackId===trackId&&!selected.has(c.id)&&c.startTime<end-.0001&&c.startTime+c.duration>start+.0001))throw new Error('La selezione contiene mattoncini non selezionati tra i pezzi da unire. Selezionali oppure unisci un intervallo diverso.');
  const id=crypto.randomUUID();const segments=expandCompoundClips(parts).map(c=>({...c,startTime:c.startTime-start}));
  merged.push({id,name:`Unione (${parts.length})`,type:parts[0].type,trackId,startTime:start,duration:end-start,offset:0,color:parts[0].color,transparency:100,volumeDb:0,fadeIn:0,fadeOut:0,segments});
  members.set(id,new Set(parts.map(c=>c.id)));parts.forEach(c=>removed.add(c.id));
 }
 if(!merged.length)throw new Error('Seleziona almeno due mattoncini sulla stessa pista. Per collegare un solo video e un solo audio usa Collega video e audio.');
 for(const video of merged.filter(c=>c.type==='video')){
  const audio=merged.find(a=>a.type==='audio'&&Math.abs(a.startTime-video.startTime)<.001&&Math.abs(a.duration-video.duration)<.001&&chosen.filter(c=>members.get(video.id)!.has(c.id)).every(c=>!!c.linkedClipId&&members.get(a.id)!.has(c.linkedClipId)));
  if(audio){video.linkedClipId=audio.id;video.isLinked=true;audio.linkedClipId=video.id;audio.isLinked=true;}
 }
 const remaining=clips.filter(c=>!removed.has(c.id)).map(c=>c.linkedClipId&&removed.has(c.linkedClipId)?{...c,linkedClipId:undefined,isLinked:false,suppressEmbeddedAudio:c.type==='video'||c.suppressEmbeddedAudio}:c);
 return {clips:[...remaining,...merged],joinedIds:merged.map(c=>c.id)};
}
