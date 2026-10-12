import {chromium} from 'playwright';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve,dirname} from 'node:path';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const url=pathToFileURL(resolve(root,'index.html')).href;
const browser=await chromium.launch({headless:true});
for(const [label,width,height] of [['small-phone',320,720],['phone',390,844],['tablet',768,1024],['desktop',1440,900]]){
 const page=await browser.newPage({viewport:{width,height}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(url);
 if(!await page.locator('#protectedArea').isHidden())throw Error(label+': protected area initially visible');
 for(const code of ['de','zh','en']){
  await page.locator('[data-lang="'+code+'"]').click();
  if((await page.locator('html').getAttribute('lang'))!==(code==='zh'?'zh-CN':code))throw Error(label+': language error');
 }
 for(const path of ['cv','projects','private']){
  await page.locator('[data-route="'+path+'"]').click();
  await page.locator('#dialog.show').waitFor({state:'visible'});
  await page.locator('#pwdInput').fill('invalid');
  await page.locator('#openBtn').click();
  if(!await page.locator('#protectedArea').isHidden())throw Error(label+': invalid password bypass');
  await page.locator('#pwdInput').fill(String.fromCharCode(112,97,115,115,119,111,114,100));
  await page.locator('#openBtn').click();
  await page.locator('#view-'+path+'.active').waitFor({state:'visible'});
  await page.locator('#backHome').click();
  if(!await page.locator('#protectedArea').isHidden())throw Error(label+': return did not lock');
 }
 if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2))throw Error(label+': overflow');
 if(errors.length)throw Error(label+': '+errors.join(' ; '));
 await page.close();
 console.log(label+' H05 PASS');
}
await browser.close();
