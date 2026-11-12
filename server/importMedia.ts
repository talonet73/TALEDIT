import {createWriteStream} from 'node:fs';
import fs from 'node:fs/promises';
import {pipeline} from 'node:stream/promises';
import {Transform} from 'node:stream';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {spawn,type ChildProcess} from 'node:child_process';
import type {Request} from 'express';
import {downloadsDir,describeMedia,InputError,probe,run} from './media';

// Keep memory bounded by stream buffers, independently of the source size.
export async function receiveMedia(req:Request) {
  let name:string;
  try {name=path.basename(decodeURIComponent(req.get('x-filename')||'media'));}
  catch {throw new InputError('Nome del file non valido.');}
  const extension=path.extname(name).toLowerCase();
  // Unknown names still import by content; never serve uploaded HTML/JS as active web content.
  const mediaExtensions=new Set('.mp4 .mov .avi .mkv .webm .m4v .mxf .mts .m2ts .ts .mpg .mpeg .vob .ogv .3gp .3g2 .flv .wmv .asf .mp3 .wav .m4a .aac .flac .aif .aiff .ogg .opus .wma .ac3 .dts .amr .caf .au .ape .alac .mp2 .png .jpg .jpeg .webp'.split(' '));
  const ext=mediaExtensions.has(extension)?extension:'.bin';
  const file=path.join(downloadsDir,`upload_${randomUUID()}${ext}`);
  let received=0;
  const count=new Transform({transform(chunk,_encoding,callback){received+=chunk.length;callback(null,chunk);}});
  try {
    await pipeline(req,count,createWriteStream(file,{flags:'wx'}));
    if(!received)throw new InputError('File vuoto.');
    const asset=await describeMedia(file,name);
    void preparePreview(file).catch(()=>{});
    return asset;
  } catch(error) {
    await fs.rm(file,{force:true});
    await fs.rm(previewPath(file),{force:true});
    if((error as NodeJS.ErrnoException).code==='ENOSPC')throw new InputError('Spazio su disco insufficiente per importare il file e la sua anteprima.');
    throw error;
  }
}
function previewPath(file:string){return `${file}.preview.mp4`;}
interface PreviewJob {status:'preparing'|'ready'|'error'|'cancelled';percent:number;seconds:number;totalSeconds:number;speed:string;phase:'queued'|'encoding';error?:string;child?:ChildProcess;promise?:Promise<string>}
const preparing=new Map<string,PreviewJob>();
export function previewStatus(file:string){const job=preparing.get(file);return job?{status:job.status,percent:job.percent,seconds:job.seconds,totalSeconds:job.totalSeconds,speed:job.speed,phase:job.phase,error:job.error}:{status:'not_started'};}
export function cancelPreview(file:string){const job=preparing.get(file);if(job?.status==='preparing'){job.status='cancelled';job.child?.kill('SIGKILL');wakeWaiters();}return previewStatus(file);}
export async function retryPreview(file:string){const job=preparing.get(file);if(job?.status==='preparing')return;await job?.promise?.catch(()=>{});preparing.delete(file);void preparePreview(file).catch(()=>{});}
function checkCancelled(job:PreviewJob){if(job.status==='cancelled')throw new InputError('Preparazione anteprima annullata.');}
let running=0;const waiters=new Set<()=>void>();
function wakeWaiters(){const pending=[...waiters];waiters.clear();for(const resolve of pending)resolve();}
async function convert(file:string,args:string[],job:PreviewJob){
 while(running>=2){checkCancelled(job);await new Promise<void>(resolve=>waiters.add(resolve));}
 checkCancelled(job);running++;job.phase='encoding';
 try{return await convertRunning(file,args,job);}finally{running--;wakeWaiters();}
}
function convertRunning(file:string,args:string[],job:PreviewJob){return new Promise<void>((resolve,reject)=>{
 if(job.status==='cancelled'){reject(new InputError('Preparazione anteprima annullata.'));return;}
 const child=spawn('ffmpeg',args,{windowsHide:true});job.child=child;let progress='',errors='';
 const timer=setTimeout(()=>{child.kill('SIGKILL');reject(new Error('Tempo massimo di preparazione anteprima superato.'));},24*60*60*1000);timer.unref();
 child.stdout!.on('data',data=>{progress+=data.toString();const lines=progress.split('\n');progress=lines.pop()!;for(const line of lines){const [key,value]=line.trim().split('=');if(key==='out_time_us'){job.seconds=Math.max(0,Number(value)/1e6);job.percent=job.totalSeconds?Math.min(99,Math.floor(job.seconds/job.totalSeconds*100)):0;}if(key==='speed')job.speed=value;}});
 child.stderr!.on('data',data=>{errors=(errors+data.toString()).slice(-8000);});
 child.once('error',error=>{clearTimeout(timer);reject(error);});
 child.once('close',code=>{clearTimeout(timer);job.child=undefined;if(job.status==='cancelled')reject(new InputError('Preparazione anteprima annullata.'));else if(code===0)resolve();else reject(new Error(errors||`FFmpeg: uscita ${code}`));});
});}
// Share generation across concurrent audio/video elements. Never replace the original.
export async function preparePreview(file:string,repair=false):Promise<string> {
  const existing=preparing.get(file);if(existing)return existing.promise!;
  const job:PreviewJob={status:'preparing',percent:0,seconds:0,totalSeconds:0,speed:'',phase:'queued'};preparing.set(file,job);
  const pending=(async()=>{
    const webm=`${file}.preview.webm`;
    const output=repair?webm:previewPath(file);
    if(!repair){try{await fs.access(webm);return webm;}catch{}}
    try {if(!repair){await fs.access(output);return output;}}catch{/* First import. */}
    const info=await probe(file);job.totalSeconds=Number(info.format.duration)||0;
    checkCancelled(job);
    const video=info.streams.find((s:any)=>s.codec_type==='video'&& !s.disposition?.attached_pic);
    const audio=info.streams.find((s:any)=>s.codec_type==='audio');
    const ext=path.extname(file).toLowerCase();
    if(!video&&!audio)return file;
    if(video&&['.png','.jpg','.jpeg','.webp'].includes(ext))return file;
    const rate=video?.avg_frame_rate?.split('/').map(Number);const fps=rate?.[1]?rate[0]/rate[1]:0;
    const compatibleVideo=video?.codec_name==='h264'&&video?.pix_fmt==='yuv420p'&&video.width<=1920&&video.height<=1920&&fps<=30;
    const compatibleAudio=!audio||['aac','mp3'].includes(audio.codec_name);
    if(!repair&&video&&['.mp4','.m4v'].includes(ext)&&compatibleVideo&&compatibleAudio)return file;
    if(!repair&&!video&&['.mp3','.m4a','.wav','.ogg','.webm'].includes(ext)&&['mp3','aac','pcm_s16le','pcm_s24le','vorbis','opus'].includes(audio?.codec_name))return file;
    let input=file;if(repair){try{await validatePreview(previewPath(file),!!video,!!audio);const cached=await previewSignal(previewPath(file),!!video,!!audio,job.totalSeconds);if((!video||cached.video)&&(!audio||cached.audio))input=previewPath(file);else{const original=await previewSignal(file,!!video,!!audio,job.totalSeconds);if(!(video&&!cached.video&&original.video)&&!(audio&&!cached.audio&&original.audio))input=previewPath(file);}}catch{}}
    const temp=path.join(downloadsDir,`preview_${randomUUID()}.${repair?'webm':'mp4'}`);
    try {
      await convert(file,['-hide_banner','-loglevel','error','-nostats','-progress','pipe:1','-y','-threads','4','-i',input,...(video?['-map',input===file?`0:${video.index}`:'0:v:0','-vf',"fps=30,scale=w='min(1280,iw)':h='min(720,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2",'-c:v',repair?'libvpx':'libx264',...(repair?['-deadline','realtime','-cpu-used','8','-b:v','2500k']:['-preset','ultrafast','-crf','23']),'-pix_fmt','yuv420p','-threads','4']:['-vn']),'-map','0:a:0?','-c:a',repair?'libopus':'aac','-ac','2','-ar','48000','-b:a','160k',...(repair?[]:['-movflags','+faststart']),temp],job);
      checkCancelled(job);
      await validatePreview(temp,!!video,!!audio);
      await fs.rename(temp,output);return output;
    }finally{await fs.rm(temp,{force:true});}
  })();
  job.promise=pending;
  try{const result=await pending;job.status='ready';job.percent=100;return result;}catch(error){if(job.status!=='cancelled'){job.status='error';job.error=(error as Error).message;}throw error;}
}

export async function repairPreview(file:string){const job=preparing.get(file);if(job?.status==='preparing'){cancelPreview(file);await job.promise?.catch(()=>{});}preparing.delete(file);void preparePreview(file,true).catch(()=>{});}
export async function previewDiagnostics(file:string){const describe=(info:any)=>({duration:info.format?.duration,streams:info.streams.map((s:any)=>({index:s.index,type:s.codec_type,codec:s.codec_name,pixelFormat:s.pix_fmt,width:s.width,height:s.height,frameRate:s.avg_frame_rate,channels:s.channels,sampleRate:s.sample_rate}))});const result:any={status:previewStatus(file),source:describe(await probe(file))};for(const ext of ['mp4','webm']){try{result[ext]=describe(await probe(`${file}.preview.${ext}`));}catch{}}return result;}

async function validatePreview(file:string,video:boolean,audio:boolean){const info=await probe(file);if(video){if(!info.streams.some((s:any)=>s.codec_type==='video'))throw new Error('Anteprima priva di video.');const decoded=await run('ffmpeg',['-v','error','-i',file,'-map','0:v:0','-frames:v','1','-vf','scale=1:1','-pix_fmt','rgb24','-f','rawvideo','pipe:1']);if(!decoded.stdout.length)throw new Error('Anteprima video non decodificabile.');}if(audio){if(!info.streams.some((s:any)=>s.codec_type==='audio'))throw new Error('Anteprima priva di audio.');const decoded=await run('ffmpeg',['-v','error','-i',file,'-map','0:a:0','-t','0.1','-f','s16le','pipe:1']);if(!decoded.stdout.length)throw new Error('Anteprima audio non decodificabile.');}}

async function previewSignal(file:string,video:boolean,audio:boolean,duration:number){let picture=false,sound=false;for(const time of [Math.min(5,duration/4),duration/2,Math.max(0,duration*.9)]){if(video&&!picture){const r=await run('ffmpeg',['-v','error','-ss',String(time),'-i',file,'-map','0:v:0','-frames:v','1','-vf','scale=1:1','-pix_fmt','rgb24','-f','rawvideo','pipe:1']);picture=[...r.stdout].some(v=>v.charCodeAt(0)>5);}if(audio&&!sound){const r=await run('ffmpeg',['-v','error','-ss',String(time),'-i',file,'-map','0:a:0','-t','0.1','-f','s16le','pipe:1']);sound=[...r.stdout].some(v=>v.charCodeAt(0)!==0);}if((!video||picture)&&(!audio||sound))break;}return {video:picture,audio:sound};}
