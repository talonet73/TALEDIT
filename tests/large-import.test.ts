import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {Readable} from 'node:stream';
import {promisify} from 'node:util';
import {execFile} from 'node:child_process';
import http from 'node:http';
const exec=promisify(execFile);
const folder=await fs.mkdtemp(path.join(os.tmpdir(),'taledit large import '));
process.env.MEDIA_DIR=folder;
const {createApp}=await import('../server');
let server:any,base:string;
before(async()=>{server=(await createApp(true)).listen(0,'127.0.0.1');server.requestTimeout=0;await new Promise<void>(r=>server.once('listening',r));base=`http://127.0.0.1:${server.address().port}`;});
after(async()=>{server.closeAllConnections();await new Promise<void>(r=>server.close(r));await fs.rm(folder,{recursive:true,force:true});});
async function upload(name:string,body:any,extra:any={}) {
  const response=await fetch(base+'/api/upload-media',{method:'POST',headers:{'x-filename':encodeURIComponent(name),'Content-Type':'application/octet-stream',...extra.headers},body,...extra});
  const result=await response.json();assert.equal(response.status,200,JSON.stringify(result));return result.asset;
}
test('4K 60 fps MOV imports above 500 MB with bounded streaming and a seekable proxy; original retained',{timeout:600000},async()=>{
 const source=path.join(folder,'camera.mov');
 await exec('ffmpeg',['-v','error','-y','-f','lavfi','-i','color=red:s=3840x2160:r=60:d=0.1','-f','lavfi','-i','sine=d=0.1','-c:v','libx264','-preset','ultrafast','-threads','2','-pix_fmt','yuv420p','-c:a','aac','-movflags','+faststart','-shortest',source]);
 const header=await fs.readFile(source),size=Number(process.env.LARGE_IMPORT_BYTES||513*1024*1024);
 assert.ok(size>500*1024*1024);const block=Buffer.alloc(1024*1024);
 async function* chunks(){yield header;for(let remaining=size-header.length;remaining>0;remaining-=block.length)yield block.subarray(0,Math.min(remaining,block.length));}
 const asset=await upload('Ripresa 4K 60fps.MOV',Readable.from(chunks()),{duplex:'half'});
 assert.equal(asset.type,'video');assert.equal(asset.width,3840);assert.equal(asset.height,2160);assert.equal(asset.hasAudio,true);
 const original=path.join(folder,path.basename(asset.fileUrl));assert.equal((await fs.stat(original)).size,size);
 const originalInfo=JSON.parse((await exec('ffprobe',['-v','error','-show_streams','-of','json',original])).stdout);assert.equal(originalInfo.streams[0].avg_frame_rate,'60/1');
 const preview=await fetch(base+'/api/media-preview/'+path.basename(asset.fileUrl));assert.equal(preview.status,200);
 const proxy=original+'.preview.mp4';const info=JSON.parse((await exec('ffprobe',['-v','error','-show_streams','-of','json',proxy])).stdout);
 assert.equal(info.streams[0].codec_name,'h264');assert.equal(info.streams[0].width,1280);assert.equal(info.streams[0].avg_frame_rate,'30/1');
 const range=await fetch(base+'/api/media-preview/'+path.basename(asset.fileUrl),{headers:{Range:'bytes=0-31'}});assert.equal(range.status,206);assert.equal((await range.arrayBuffer()).byteLength,32);
 console.log(`Verified streamed import: ${size} bytes; original 3840x2160/60 fps preserved; 720p proxy and Range playback valid`);
});
test('FFmpeg detects FLAC and MPEG-TS, including unknown extensions, instead of extension allowlisting',async()=>{
 for(const [format,name,args] of [['flac','Registrazione.flac',['-f','lavfi','-i','sine=d=0.1','-c:a','flac']],['mpegts','Camera.mts',['-f','lavfi','-i','color=blue:s=160x90:r=25:d=1','-c:v','mpeg2video','-threads','2']]] as const){
  const source=path.join(folder,'source-'+format);await exec('ffmpeg',['-v','error','-y',...args,'-f',format,source]);
  if(format==='flac'){for(const name of ['Audio.dat','Audio.html']){const unknown=await upload(name,await fs.readFile(source));assert.equal(unknown.type,'audio');assert.match(unknown.fileUrl,/\.bin$/);const response=await fetch(base+unknown.fileUrl);assert.match(response.headers.get('content-type')||'',/application\/octet-stream/);assert.equal(response.headers.get('x-content-type-options'),'nosniff');await response.arrayBuffer();const preview=await fetch(base+'/api/media-preview/'+path.basename(unknown.fileUrl));assert.equal(preview.status,200);await preview.arrayBuffer();}}
  const asset=await upload(name,await fs.readFile(source));assert.equal(asset.type,format==='flac'?'audio':'video');
  const preview=await fetch(base+'/api/media-preview/'+path.basename(asset.fileUrl));assert.equal(preview.status,200);await preview.arrayBuffer();
 }
});
test('invalid, empty and aborted uploads leave no partial media',async()=>{
 const before=(await fs.readdir(folder)).sort();
 for(const body of [Buffer.alloc(0),Buffer.from('not media')]){const r=await fetch(base+'/api/upload-media',{method:'POST',headers:{'x-filename':'bad.xyz'},body});assert.equal(r.status,400);}
 assert.deepEqual((await fs.readdir(folder)).sort(),before);
 await new Promise<void>(resolve=>{
  const req=http.request(base+'/api/upload-media',{method:'POST',headers:{'x-filename':'interrotto.mov','Content-Length':'1000000000'}});
  req.on('error',()=>resolve());req.write(Buffer.alloc(65536));setTimeout(()=>req.destroy(),50);
 });
 for(let i=0;i<50;i++){if(JSON.stringify((await fs.readdir(folder)).sort())===JSON.stringify(before))break;await new Promise(r=>setTimeout(r,20));}
 assert.deepEqual((await fs.readdir(folder)).sort(),before);
 const r=await fetch(base+'/api/media-preview/%2e%2e%5cfile');assert.equal(r.status,400);
});

test('upload returns before a real long preview finishes; progress, cancellation and retry preserve the original',{timeout:120000},async()=>{
 const source=path.join(folder,'long-preview.mov');
 await exec('ffmpeg',['-v','error','-y','-f','lavfi','-i','testsrc2=s=640x360:r=60:d=120','-c:v','libx264','-preset','ultrafast','-threads','2','-pix_fmt','yuv420p',source]);
 const asset=await upload('Ripresa lunga.mov',await fs.readFile(source));
 const endpoint=base+'/api/media-preview/'+path.basename(asset.fileUrl);
 const status=async()=>await(await fetch(endpoint+'/status')).json();
 assert.equal((await status()).status,'preparing','The asset must be returned while the real FFmpeg preview is still running');
 const original=path.join(folder,path.basename(asset.fileUrl)),size=(await fs.stat(original)).size;
 const cancelled=await(await fetch(endpoint+'/cancel',{method:'POST'})).json();assert.equal(cancelled.status,'cancelled');
 assert.equal((await fs.stat(original)).size,size,'Cancelling must preserve the imported source');
 assert.equal((await fetch(endpoint)).status,400,'Cancellation must not silently restart expensive work');
 await fetch(endpoint+'/retry',{method:'POST'});
 let latest:any,measuredProgress=false;const deadline=Date.now()+90000;
 do{latest=await status();assert.notEqual(latest.status,'error',latest.error);if(latest.seconds>0)measuredProgress=true;if(latest.status==='ready')break;await new Promise(r=>setTimeout(r,100));}while(Date.now()<deadline);
 assert.equal(latest.status,'ready');assert.equal(latest.percent,100);assert.ok(measuredProgress,'Progress must come from real FFmpeg output time');
 assert.equal((await fs.stat(original)).size,size);
 const partial=await fetch(endpoint,{headers:{Range:'bytes=0-31'}});assert.equal(partial.status,206);await partial.arrayBuffer();
 // Multiple file selection must not start an unbounded number of encoders.
 const bytes=await fs.readFile(source);
 const batch=await Promise.all([1,2,3].map(i=>upload(`Ripresa in coda ${i}.mov`,bytes)));
 const urls=batch.map(a=>base+'/api/media-preview/'+path.basename(a.fileUrl));
 const states=await Promise.all(urls.map(async u=>await(await fetch(u+'/status')).json()));
 assert.ok(states.filter(s=>s.status==='preparing'&&s.phase==='encoding').length<=2);
 assert.ok(states.some(s=>s.status==='preparing'&&s.phase==='queued'),'An extra preview must queue instead of spawning another encoder');
 await Promise.all(urls.map(u=>fetch(u+'/cancel',{method:'POST'})));
 await Promise.all(urls.map(async u=>{const r=await fetch(u);assert.equal(r.status,400);await r.json();}));
 for(const asset of batch)assert.ok((await fs.stat(path.join(folder,path.basename(asset.fileUrl)))).size>0);
});
