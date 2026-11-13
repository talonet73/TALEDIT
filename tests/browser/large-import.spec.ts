import {test,expect} from '@playwright/test';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
test('stage imports ProRes MOV and FLAC and renders the MOV through its compatible preview',async({page})=>{
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'taledit browser formats '));
 try {
  const mov=path.join(folder,'Ripresa ProRes.mov'),flac=path.join(folder,'Voce.flac');
  execFileSync('ffmpeg',['-v','error','-y','-f','lavfi','-i','color=red:s=320x180:r=60:d=1','-f','lavfi','-i','sine=d=1','-c:v','prores_ks','-threads','2','-pix_fmt','yuv422p10le','-c:a','pcm_s16le','-shortest',mov]);
  execFileSync('ffmpeg',['-v','error','-y','-f','lavfi','-i','sine=d=1','-c:a','flac',flac]);
  await page.goto('/');
  const input=page.locator('[data-stage=true] input[type=file]');
  await expect(input).not.toHaveAttribute('accept');
  await input.setInputFiles([mov,flac]);
  const card=page.locator('[draggable=true]').filter({hasText:'Ripresa ProRes.mov'});
  await expect(card).toBeVisible({timeout:30000});await expect(page.locator('[draggable=true]').filter({hasText:'Voce.flac'})).toBeVisible();
  await card.dblclick();const canvas=page.locator('canvas').first();
  await expect.poll(async()=>canvas.evaluate((c:HTMLCanvasElement)=>{const p=c.getContext('2d')!.getImageData(c.width/2,c.height/2,1,1).data;return p[0]>200&&p[1]<30&&p[2]<30;})).toBe(true);
 }finally{fs.rmSync(folder,{recursive:true,force:true});}
});

test('long media appears in the stage before conversion completes, with working cancel and retry',async({page,request})=>{
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'taledit background preview '));
 try{
  const source=path.join(folder,'Anteprima lunga.mov');
  execFileSync('ffmpeg',['-v','error','-y','-f','lavfi','-i','testsrc2=s=640x360:r=60:d=120','-c:v','libx264','-preset','ultrafast','-threads','2','-pix_fmt','yuv420p',source]);
  await page.goto('/');await page.locator('[data-stage=true] input[type=file]').setInputFiles(source);
  const card=page.locator('[draggable=true]').filter({hasText:'Anteprima lunga.mov'});await expect(card).toBeVisible();
  const cancelled=page.waitForResponse(r=>r.url().endsWith('/cancel')&&r.request().method()==='POST');
  await card.getByRole('button',{name:'Annulla anteprima',exact:true}).click();
  const result=await cancelled;expect(result.status()).toBe(200);await expect(card.getByText('Anteprima annullata. Originale conservato.')).toBeVisible();
  const endpoint=result.url().replace(/\/cancel$/,'');
  await card.dblclick(); // The cancelled preview fails once in the player; retry must reload it.
  await page.waitForTimeout(300);
  expect((await request.get(endpoint+'/status')).status()).toBe(200);
  await card.getByRole('button',{name:'Prepara anteprima',exact:true}).click();
  await expect.poll(async()=> (await(await request.get(endpoint+'/status')).json()).status,{timeout:60000}).toBe('ready');
  await expect(card.getByRole('button',{name:'Annulla anteprima',exact:true})).toHaveCount(0);
  await expect.poll(async()=>page.locator('canvas').first().evaluate((c:HTMLCanvasElement)=>{const p=c.getContext('2d')!.getImageData(c.width/2,c.height/2,1,1).data;return Math.max(p[0],p[1],p[2]);})).toBeGreaterThan(100);
 }finally{fs.rmSync(folder,{recursive:true,force:true});}
});
