import {test,expect} from '@playwright/test';
test('complete reference interface and local TALedit branding remain present',async({page})=>{
  await page.goto('/');
  const logo=page.getByRole('img',{name:'Logo TALedit'});
  await expect(logo).toBeVisible();
  expect(await logo.evaluate((img:HTMLImageElement)=>img.complete && img.naturalWidth>0)).toBe(true);
  for(const name of ['ChatGPT MCP','Effects','Transitions','Captions','Adjustment','BG Remover','AI Cut','Pen Mask']) {
    await expect(page.getByRole('button',{name,exact:true})).toBeVisible();
  }
  for(const name of ['VIDEO','AUDIO','COLOR']) await expect(page.getByRole('tab',{name,exact:true})).toBeVisible();
  await page.screenshot({path:'test-results/restored-complete-interface.png',fullPage:true});
});
