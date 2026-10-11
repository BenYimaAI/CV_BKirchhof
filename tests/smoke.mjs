import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve, dirname } from 'node:path';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const url=pathToFileURL(resolve(root,'index.html')).href;
const browser=await chromium.launch({headless:true});
for(const [name,width,height] of [['phone-small',320,720],['phone',390,844],['tablet',768,1024],['desktop',1440,900]]){
 const page=await browser.newPage({viewport:{width,height}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(url);
 if(!await page.locator('#portfolio').isHidden())throw Error(name+': access bypass');
 for(const lang of ['zh','de','en']){
  await page.locator('[data-lang="'+lang+'"]').click();
  if(await page.locator('html').getAttribute('lang')!==(lang==='zh'?'zh-CN':lang))throw Error('locale '+lang);
  const blank=await page.locator('[data-t]').evaluateAll(els=>els.filter(x=>!x.textContent.trim()).length);
  if(blank)throw Error(name+': untranslated labels');
 }
 await page.locator('[data-path="portfolio"]').click();
 await page.locator('#accessDialog').waitFor({state:'visible'});
 await page.locator('#accessInput').fill('invalid');
 await page.locator('#accessForm button[type=submit]').click();
 if(!await page.locator('#portfolio').isHidden())throw Error(name+': wrong code accepted');
 await page.locator('#accessInput').fill(String.fromCharCode(112,97,115,115,119,111,114,100));
 await page.locator('#accessForm button[type=submit]').click();
 await page.locator('#portfolio').waitFor({state:'visible'});
 for(const id of ['projects','gen5','skills','leadership','ai','awards','career']){
  if(!await page.locator('#'+id).isVisible())throw Error(name+': '+id+' section missing');
 }
 if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2))throw Error(name+': horizontal overflow');
 await page.locator('.section-nav a[href="#choose"]').click();
 if(!await page.locator('#portfolio').isHidden())throw Error(name+': signout failed');
 if(errors.length)throw Error(name+': '+errors.join(';'));
 console.log(name+' PASS');
 await page.close();
}
await browser.close();
