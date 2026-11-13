import {defineConfig} from '@playwright/test';
import os from 'node:os';
import path from 'node:path';
export default defineConfig({
 testDir:'./tests/browser',testMatch:'preview-av.spec.ts',grep:/1ch 16000Hz 4433.7s/,
 workers:1,timeout:1000000,
 use:{baseURL:'http://127.0.0.1:3100',headless:true,trace:'retain-on-failure',viewport:{width:1600,height:1000},channel:'msedge'},
 webServer:{command:'npm start',url:'http://127.0.0.1:3100/api/health',env:{NODE_ENV:'production',PORT:'3100',HOST:'127.0.0.1',MEDIA_DIR:path.join(os.tmpdir(),'taledit-playback-probe')}},
 reporter:[['github'],['list']],
});
