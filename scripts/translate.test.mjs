import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {build,batches,collectStrings,requestTranslation} from './translate.mjs';

test('Excludes URLs, email and structural identifiers; includes new nested content',()=>{
 assert.deepEqual([...collectStrings({email:'a@b.com',url:'https://a.com',type:'research',year:'2026',initials:'YN',skills:[{category:'Research',items:['Python','New skill']}],name:'Alex'})],['Research','Python','New skill','Alex']);
 assert.deepEqual(batches(Array.from({length:81},(_,i)=>String(i))).map(b=>b.length),[40,40,1]);
});
test('Uses documented DeepL auth, Free endpoint and Simplified Chinese',async()=>{
 const result=await requestTranslation(['Education'],'test:fx',async(url,options)=>{
 assert.equal(url,'https://api-free.deepl.com/v2/translate');assert.equal(options.headers.Authorization,'DeepL-Auth-Key test:fx');assert.equal(JSON.parse(options.body).target_lang,'ZH-HANS');return {ok:true,json:async()=>({translations:[{text:'教育背景'}]})};});
 assert.deepEqual(result,['教育背景']);
});
test('Rejects incomplete or failed responses',async()=>{
 await assert.rejects(requestTranslation(['Hello'],'test',async()=>({ok:true,json:async()=>({translations:[]})})),/incomplete/);
 await assert.rejects(requestTranslation(['Hello'],'test',async()=>({ok:false,status:403})),/HTTP 403/);
});
test('Translates changed English only, preserves output on failure and never uses stale text',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'portfolio-test-'));
 try {
 await fs.mkdir(path.join(root,'dist'));
 await fs.writeFile(path.join(root,'dist/content.js'),'window.PORTFOLIO={name:"Existing",bio:"New English"}');
 await fs.writeFile(path.join(root,'dist/ui.js'),'window.PORTFOLIO_UI={education:"Education"}');
 const file=path.join(root,'dist/translations.js');const initial='window.PORTFOLIO_ZH={"Existing":"已有","Education":"教育背景","Old English":"旧内容"};';await fs.writeFile(file,initial);
 await assert.rejects(build({root,key:''}),/DEEPL_API_KEY/);assert.equal(await fs.readFile(file,'utf8'),initial);
 await assert.rejects(build({root,key:'test',fetcher:async()=>({ok:false,status:403})}),/403/);assert.equal(await fs.readFile(file,'utf8'),initial);
 await build({root,key:'test',fetcher:async(_url,options)=>{assert.deepEqual(JSON.parse(options.body).text,['New English']);return {ok:true,json:async()=>({translations:[{text:'新内容'}]})};}});
 const ctx={window:{}};vm.runInNewContext(await fs.readFile(file,'utf8'),ctx);assert.equal(ctx.window.PORTFOLIO_ZH['New English'],'新内容');assert.equal(ctx.window.PORTFOLIO_ZH['Old English'],undefined);
 await build({root,key:'',fetcher:()=>{throw Error('Cache hit must not call the API')}});await build({root,check:true});
 } finally {await fs.rm(root,{recursive:true,force:true});}
});

test('Old Actions cache cannot overwrite newly committed translations',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'portfolio-cache-test-'));
 try {
  await fs.mkdir(path.join(root,'dist'));await fs.mkdir(path.join(root,'.translation-cache'));
  await fs.writeFile(path.join(root,'dist/content.js'),'window.PORTFOLIO={name:"New CV",bio:"Existing"}');
  await fs.writeFile(path.join(root,'dist/ui.js'),'window.PORTFOLIO_UI={}');
  await fs.writeFile(path.join(root,'dist/translations.js'),'window.PORTFOLIO_ZH={"New CV":"新简历","Existing":"已校对"}');
  await fs.writeFile(path.join(root,'.translation-cache/zh.json'),JSON.stringify({Existing:'旧翻译'}));
  await build({root,key:'',fetcher:()=>{throw Error('Must not call DeepL for committed translations')}});
  const ctx={window:{}};vm.runInNewContext(await fs.readFile(path.join(root,'dist/translations.js'),'utf8'),ctx);
  assert.equal(ctx.window.PORTFOLIO_ZH['New CV'],'新简历');assert.equal(ctx.window.PORTFOLIO_ZH.Existing,'已校对');
 } finally {await fs.rm(root,{recursive:true,force:true});}
});
