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
