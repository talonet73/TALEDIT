import {createWriteStream} from 'node:fs';
import fs from 'node:fs/promises';
import {pipeline} from 'node:stream/promises';
import {Transform} from 'node:stream';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
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
    await preparePreview(file);
    return asset;
  } catch(error) {
    await fs.rm(file,{force:true});
    await fs.rm(previewPath(file),{force:true});
    if((error as NodeJS.ErrnoException).code==='ENOSPC')throw new InputError('Spazio su disco insufficiente per importare il file e la sua anteprima.');
    throw error;
  }
}
function previewPath(file:string){return `${file}.preview.mp4`;}
const preparing=new Map<string,Promise<string>>();
// Share generation across concurrent audio/video elements. Never replace the original.
export async function preparePreview(file:string):Promise<string> {
  const existing=preparing.get(file);if(existing)return existing;
  const pending=(async()=>{
    const output=previewPath(file);
    try {await fs.access(output);return output;}catch{/* First import. */}
    const info=await probe(file);
    const video=info.streams.find((s:any)=>s.codec_type==='video'&& !s.disposition?.attached_pic);
    const audio=info.streams.find((s:any)=>s.codec_type==='audio');
    const ext=path.extname(file).toLowerCase();
    if(!video&&!audio)return file;
    if(video&&['.png','.jpg','.jpeg','.webp'].includes(ext))return file;
    const rate=video?.avg_frame_rate?.split('/').map(Number);const fps=rate?.[1]?rate[0]/rate[1]:0;
    const compatibleVideo=video?.codec_name==='h264'&&video?.pix_fmt==='yuv420p'&&video.width<=1920&&video.height<=1920&&fps<=30;
    const compatibleAudio=!audio||['aac','mp3'].includes(audio.codec_name);
    if(video&&['.mp4','.m4v'].includes(ext)&&compatibleVideo&&compatibleAudio)return file;
    if(!video&&['.mp3','.m4a','.wav','.ogg','.webm'].includes(ext)&&['mp3','aac','pcm_s16le','pcm_s24le','vorbis','opus'].includes(audio?.codec_name))return file;
    const temp=path.join(downloadsDir,`preview_${randomUUID()}.mp4`);
    try {
      await run('ffmpeg',['-hide_banner','-loglevel','error','-y','-i',file,...(video?['-map','0:v:0','-vf',"scale=w='min(1280,iw)':h='min(720,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2,fps=30",'-c:v','libx264','-preset','veryfast','-crf','23','-pix_fmt','yuv420p','-threads','2']:['-vn']),'-map','0:a:0?','-c:a','aac','-b:a','160k','-movflags','+faststart',temp],24*60*60*1000);
      await fs.rename(temp,output);return output;
    }finally{await fs.rm(temp,{force:true});}
  })();
  preparing.set(file,pending);
  try{return await pending;}finally{preparing.delete(file);}
}
