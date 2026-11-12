import {defineConfig} from '@playwright/test';
export default defineConfig({
 testDir:'./tests/browser',testMatch:['preview-av.spec.ts','editing-requests.spec.ts'],workers:1,timeout:300000,
 use:{baseURL:process.env.TALEDIT_BASE_URL||'http://127.0.0.1:3000',headless:true,trace:'retain-on-failure',screenshot:'only-on-failure',viewport:{width:1600,height:1000}},
 projects:[{name:'chrome',use:{browserName:'chromium',channel:'chrome'}},{name:'edge',use:{browserName:'chromium',channel:'msedge'}}],
 reporter:[['github'],['list'],['html',{open:'never'}]],
});
