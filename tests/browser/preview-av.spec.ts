import {test,expect} from '@playwright/test';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
test.beforeEach(async({request})=>{const snapshot=await(await request.get('/api/editor/state')).json();const response=await request.put('/api/editor/state',{data:{revision:snapshot.revision,state:{...snapshot.state,clips:[],mediaAssets:[],subtitles:[],currentTime:0,selectedClipId:null,audioMaster:{},tracks:[{id:'av-video',name:'VIDEO 01',type:'video',isMuted:false,isSolo:false,headerBg:'#0f2942',laneBg:'#111d2e'},{id:'av-audio',name:'AUDIO 01',type:'audio',isMuted:false,isSolo:false,headerBg:'#0d3324',laneBg:'#10251e'}]}}});expect(response.status()).toBe(200);});
for(const [channels,rate,duration,hevc] of [[2,48000,8,0],[8,48000,8,0],[2,96000,8,0],[2,192000,8,0],[1,16000,4433.7,0],[2,48000,4,8],[2,48000,4,10]])test(`converted MOV plays actual picture and sound: ${channels}ch ${rate}Hz ${duration}s HEVC=${hevc}`,async({page,request})=>{
 const previewDeadline=duration>1000?900000:240000;
 test.setTimeout(previewDeadline+60000);
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'taledit av playback ')),file=path.join(dir,`camera-${channels}-${rate}.mov`);
 try{
 const sound=Array(channels).fill('0.1*sin(2*PI*440*t)').join('|');
 if(hevc)execFileSync('ffmpeg',['-v','error','-y','-f','lavfi','-i','color=red:s=3840x2160:r=186213/3125:d=4','-f','lavfi','-i','aevalsrc=0.1*sin(2*PI*440*t)|0.1*sin(2*PI*440*t):s=48000:d=4','-c:v','libx265','-preset','ultrafast','-x265-params','pools=4:frame-threads=2','-pix_fmt',hevc===10?'yuv420p10le':'yuv420p','-tag:v','hvc1','-color_primaries','bt709','-color_trc','bt709','-colorspace','bt709','-color_range','tv','-c:a','aac','-shortest',file],{stdio:'pipe'});
 else if(duration>1000&&process.env.LONG_MOV_FIXTURE)fs.copyFileSync(process.env.LONG_MOV_FIXTURE,file);else execFileSync('ffmpeg',['-v','error','-y','-f','lavfi','-i',`color=red:s=160x90:r=${duration>1000?1:60}:d=${duration}${duration>1000?",drawbox=c=blue:t=fill:enable='between(t,60,1799)',drawbox=c=lime:t=fill:enable='between(t,1800,4399)',drawbox=c=yellow:t=fill:enable='gte(t,4400)'":''}`,'-f','lavfi','-i',`aevalsrc=${sound}:s=${rate}:d=${duration}`,'-c:v','libx264','-preset','ultrafast','-threads','2','-pix_fmt','yuv420p','-c:a','pcm_s24le','-shortest',file]);
 await page.addInitScript(()=>{
  (window as any).__sound=[];(window as any).__media=[];(window as any).__mediaEvents=[];
  const source=AudioContext.prototype.createMediaElementSource;AudioContext.prototype.createMediaElementSource=function(element:HTMLMediaElement){(window as any).__media.push(element);for(const event of ['seeking','seeked','waiting','playing','stalled'])element.addEventListener(event,()=>{const events=(window as any).__mediaEvents;events.push({event,at:performance.now(),time:element.currentTime,ready:element.readyState});if(events.length>200)events.shift();});return source.call(this,element);};
  const connect=AudioNode.prototype.connect;
  AudioNode.prototype.connect=function(this:AudioNode,destination:any,...args:any[]){
   const result=(connect as any).call(this,destination,...args);
   if(destination instanceof AudioDestinationNode){const analyser=this.context.createAnalyser();analyser.fftSize=2048;(connect as any).call(this,analyser);(window as any).__sound.push(analyser);}
   return result;
  } as any;
 });
 await page.goto('/',{waitUntil:'domcontentloaded'});await page.locator('[data-stage=true] input[type=file]').setInputFiles(file);
 const card=page.locator('[draggable=true]').filter({hasText:path.basename(file)});await expect(card).toBeVisible();
 await expect.poll(async()=>{const state=(await(await request.get('/api/editor/state')).json()).state;const asset=state.mediaAssets.find((a:any)=>a.name===path.basename(file));if(!asset)return 'uploading';return (await(await request.get('/api/media-preview/'+path.basename(asset.fileUrl)+'/status')).json()).status;},{timeout:previewDeadline}).toBe('ready');
 if(hevc)await card.dragTo(page.locator('[data-track-id=av-video]'),{targetPosition:{x:1,y:5}});else await card.dblclick();
 await expect.poll(async()=>{const snapshot=await(await request.get('/api/editor/state')).json();return snapshot.state.clips.length;}).toBe(2);
 const canvas=page.getByTestId('player-canvas');
 await expect.poll(async()=>canvas.evaluate((c:HTMLCanvasElement)=>{const p=c.getContext('2d')!.getImageData(c.width/2,c.height/2,1,1).data;return p[0]>200&&p[1]<30&&p[2]<30;})).toBe(true);
 await page.getByRole('button',{name:'Riproduci anteprima',exact:true}).first().click();
 await expect.poll(async()=>page.evaluate(()=>Math.max(0,...(window as any).__sound.map((a:AnalyserNode)=>{const pcm=new Float32Array(a.fftSize);a.getFloatTimeDomainData(pcm);return Math.sqrt(pcm.reduce((n,v)=>n+v*v,0)/pcm.length);}))),{timeout:10000}).toBeGreaterThan(.02);
 if(duration>1000)for(const target of [4.9,60.5,1800.5,4400.5]){
  await page.getByTitle('Pausa (Spazio)',{exact:true}).click();
  let applied=false;
  for(let i=0;i<5&&!applied;i++){const snapshot=await(await request.get('/api/editor/state')).json();applied=(await request.put('/api/editor/state',{data:{revision:snapshot.revision,state:{...snapshot.state,currentTime:target}}})).ok();}
  expect(applied).toBe(true);
  const expected=target<60?[255,0,0]:target<1800?[0,0,255]:target<4400?[0,255,0]:[255,255,0];
  await expect.poll(async()=>canvas.evaluate((c:HTMLCanvasElement)=>[...c.getContext('2d')!.getImageData(c.width/2,c.height/2,1,1).data].slice(0,3)).then(pixel=>pixel.every((value,i)=>Math.abs(value-expected[i])<8))).toBe(true);
  await page.getByTitle('Riproduci (Spazio)',{exact:true}).click();
  await expect.poll(async()=>page.evaluate((t:number)=>(window as any).__media.some((m:HTMLMediaElement)=>!m.paused&&!m.error&&m.currentTime>t+.1&&m.currentTime<t+3),target),{timeout:10000}).toBe(true);
  await expect.poll(async()=>page.evaluate(()=>Math.max(0,...(window as any).__sound.map((a:AnalyserNode)=>{const pcm=new Float32Array(a.fftSize);a.getFloatTimeDomainData(pcm);return Math.sqrt(pcm.reduce((n,v)=>n+v*v,0)/pcm.length);}))),{timeout:10000}).toBeGreaterThan(.02);
 }
 }catch(error){
  const diagnostics=await page.evaluate(()=>({media:(window as any).__media?.map((m:HTMLMediaElement)=>({src:m.currentSrc,time:m.currentTime,paused:m.paused,seeking:m.seeking,ready:m.readyState,muted:m.muted,volume:m.volume,error:m.error?.message})),audio:(window as any).__sound?.map((a:AnalyserNode)=>{const pcm=new Float32Array(a.fftSize);a.getFloatTimeDomainData(pcm);return {rms:Math.sqrt(pcm.reduce((n,v)=>n+v*v,0)/pcm.length),context:a.context.state,time:a.context.currentTime,sampleRate:a.context.sampleRate};}),events:(window as any).__mediaEvents}));
  console.log('PLAYBACK_DIAGNOSTICS '+JSON.stringify(diagnostics));
  await test.info().attach('playback-diagnostics',{body:JSON.stringify(diagnostics,null,2),contentType:'application/json'});
  throw error;
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('a browser decoder failure is visible in the Player instead of an unexplained black frame',async({page})=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'taledit decoder error ')),file=path.join(dir,'Errore anteprima.mov');
 try{
  execFileSync('ffmpeg',['-v','error','-y','-f','lavfi','-i','color=red:s=160x90:r=25:d=1','-c:v','libx264','-threads','2','-pix_fmt','yuv420p',file]);
  await page.goto('/',{waitUntil:'domcontentloaded'});await page.locator('[data-stage=true] input[type=file]').setInputFiles(file);
  const card=page.locator('[draggable=true]').filter({hasText:path.basename(file)});await expect(card).toBeVisible();
  await page.route('**/api/media-preview/*',route=>route.fulfill({status:200,contentType:'video/mp4',body:'invalid media bytes'}));
  await card.dblclick();
  await expect(page.getByRole('alert').filter({hasText:'Errore anteprima.mov'})).toContainText(/errore [234]/);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
