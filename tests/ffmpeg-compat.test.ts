import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {rippleRemove} from '../src/services/smartCut';
const exec=promisify(execFile);
const folder=await fs.mkdtemp(path.join(os.tmpdir(),'taledit AI Cut compat '));
process.env.MEDIA_DIR=folder;
const {createApp}=await import('../server');
let server:any,base:string;
before(async()=>{server=(await createApp(true)).listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));base=`http://127.0.0.1:${server.address().port}`;});
after(async()=>{server.closeAllConnections();await new Promise<void>(resolve=>server.close(resolve));await fs.rm(folder,{recursive:true,force:true});});
async function upload(file:string){const response=await fetch(base+'/api/upload-media',{method:'POST',headers:{'Content-Type':'application/octet-stream','x-filename':encodeURIComponent(path.basename(file))},body:await fs.readFile(file)});const body=await response.json();assert.equal(response.status,200,JSON.stringify(body));return body.asset;}
async function post(route:string,body:any){const response=await fetch(base+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const data=await response.json();assert.ok(response.ok,JSON.stringify(data));return data;}
async function scan(clips:any[],durationSec:number){const started=await post('/api/smart-cut',{mode:'automatic',margin:.7,clips,durationSec,language:'Italian'});const deadline=Date.now()+60000;let job:any;do{job=await(await fetch(base+'/api/captions/'+started.jobId)).json();assert.notEqual(job.status,'error',job.error);if(job.status==='complete')return job;await new Promise(resolve=>setTimeout(resolve,50));}while(Date.now()<deadline);assert.fail('AI Cut scan did not finish');}
function clip(asset:any,type=asset.type){return {id:type,name:asset.name,type,trackId:type,mediaUrl:asset.fileUrl,startTime:0,duration:asset.durationSec,offset:0,color:'#2563eb',transparency:100,volumeDb:0,fadeIn:0,fadeOut:0};}

test('AI Cut scans a 169.6 second WAV at 0.7 margin, cuts the pause and exports audible contiguous audio',{timeout:90000},async()=>{
  const source=path.join(folder,'Voce con pause e qualità.wav');
  await exec('ffmpeg',['-v','error','-y','-f','lavfi','-i','aevalsrc=if(between(t\\,1\\,167.6)\\,0\\,0.1*sin(2*PI*440*t)):s=16000:d=169.6',source]);
  const asset=await upload(source),original=clip(asset),job=await scan([original],169.6);
  assert.equal(job.candidates.length,1);const cut=job.candidates[0];
  assert.ok(Math.abs(cut.start-1.35)<.02,JSON.stringify(cut));assert.ok(Math.abs(cut.end-167.25)<.02,JSON.stringify(cut));assert.equal(cut.selected,true);
  const montage=rippleRemove([original],job.candidates);assert.equal(montage.clips.length,2);assert.ok(Math.abs(montage.duration-3.7)<.04);assert.equal(montage.clips[0].startTime+montage.clips[0].duration,montage.clips[1].startTime);
  const output=await post('/api/export',{format:'wav',resolution:'720p',durationSec:montage.duration,clips:montage.clips});
  const file=path.join(folder,output.fileName),info=JSON.parse((await exec('ffprobe',['-v','error','-show_streams','-show_format','-of','json',file])).stdout);
  assert.equal(info.streams.length,1);assert.equal(info.streams[0].codec_type,'audio');assert.ok(Math.abs(Number(info.format.duration)-3.7)<.05);
  const {stdout}=await exec('ffmpeg',['-v','error','-i',file,'-ac','1','-ar','16000','-f','f32le','-'],{encoding:'buffer'});const pcm=new Float32Array(stdout.buffer.slice(stdout.byteOffset,stdout.byteOffset+stdout.byteLength));
  assert.ok(Math.sqrt(pcm.reduce((sum,v)=>sum+v*v,0)/pcm.length)>.03,'Source tone must remain audible after the real scan, cuts and export');
});

test('AI Cut scans linked video/audio at 0.7 margin and exports joined frames with their soundtrack',{timeout:90000},async()=>{
  const source=path.join(folder,'Video con pause.mp4');
  await exec('ffmpeg',['-v','error','-y','-f','lavfi','-i','color=c=red:s=160x90:r=25:d=4','-f','lavfi','-i','aevalsrc=if(between(t\\,1\\,3)\\,0\\,0.1*sin(2*PI*440*t)):s=48000:d=4','-c:v','libx264','-threads','2','-pix_fmt','yuv420p','-c:a','aac','-shortest',source]);
  const asset=await upload(source);const originals=[{...clip(asset,'video'),isLinked:true,linkedClipId:'audio'},{...clip(asset,'audio'),isLinked:true,linkedClipId:'video'}];
  const job=await scan(originals,4);assert.equal(job.candidates.length,1);const montage=rippleRemove(originals,job.candidates);assert.ok(Math.abs(montage.duration-2.7)<.15);assert.equal(montage.clips.length,4);
  const output=await post('/api/export',{format:'mp4',resolution:'720p',durationSec:montage.duration,clips:montage.clips});const file=path.join(folder,output.fileName);
  const info=JSON.parse((await exec('ffprobe',['-v','error','-show_streams','-of','json',file])).stdout);assert.deepEqual(new Set(info.streams.map((s:any)=>s.codec_type)),new Set(['video','audio']));
  const {stdout}=await exec('ffmpeg',['-v','error','-i',file,'-vf','scale=1:1','-pix_fmt','rgb24','-f','rawvideo','-'],{encoding:'buffer'});assert.ok(stdout.length>100);for(let i=0;i<stdout.length;i+=3)assert.ok(stdout[i]>150 && stdout[i+1]<40 && stdout[i+2]<40,`Frame ${i/3} must retain the source color across cuts`);
});
