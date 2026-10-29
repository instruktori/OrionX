const {test, before, beforeEach, afterEach} = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
const {build} = require('esbuild');
const React = require('react');
const {act, create} = require('react-test-renderer');
global.IS_REACT_ACT_ENVIRONMENT = true;
const code = 'D1-' + 'A'.repeat(32);
const originalFetch = global.fetch;
const originalNavigator = Object.getOwnPropertyDescriptor(global, 'navigator');
const filename = path.resolve(__dirname, '../src/app/verify/page.tsx');
let Verify;
before(async () => {
const compiled = (await build({entryPoints:[filename],bundle:true,jsx:'automatic',platform:'node',format:'cjs',write:false,external:['react'],logLevel:'silent',plugins:[{
  name:'verification-boundaries', setup(build) {
    build.onResolve({filter:/@\/components\/shell|@\/lib\/qr-pdf/}, args => ({path:args.path,namespace:'test'}));
    build.onLoad({filter:/.*/,namespace:'test'}, args => ({contents:args.path.endsWith('shell')
      ? 'export function Shell({children}) {return children}'
      : 'export const isValidVerificationCode = () => true; export const discoverCodesFromPdfFile = (...a) => global.__qr.discover(...a); export const decodeQrFromImageFile = (...a) => global.__qr.image(...a); export const decodeQrFromVideoFrame = (...a) => global.__qr.frame(...a);'}));
  }
}]})).outputFiles[0].text;
const mod = new Module(filename,module); mod.filename=filename; mod.paths=Module._nodeModulePaths(path.dirname(filename)); mod._compile(compiled,filename);
Verify = mod.exports.default;
});
let tree, interval, timeout, stopped, requests;
const stream = () => {const track={stop:()=>stopped++,addEventListener(){},removeEventListener(){}}; return {getTracks:()=>[track],getVideoTracks:()=>[track]};};
const text = () => JSON.stringify(tree.toJSON());
const button = name => tree.root.findAllByType('button').find(n=>n.children.some(c=>typeof c==='string'&&c.includes(name)));
const mount = async search => { window.location.search=search||''; await act(async()=>{tree=create(React.createElement(Verify),{createNodeMock: el=>el.type==='video'?{play:async()=>{},pause(){},videoWidth:640,videoHeight:480}:el.type==='canvas'?{}:null});}); };
beforeEach(()=>{
  stopped=0; requests=[]; interval=null; timeout=null;
  global.window={location:{search:''},setInterval:fn=>(interval=fn,1),clearInterval(){interval=null;},setTimeout:fn=>(timeout=fn,1),clearTimeout(){timeout=null;}};
  Object.defineProperty(global,'navigator',{configurable:true,value:{mediaDevices:{getUserMedia:async()=>stream()}}});
  global.__qr={discover:async()=>({codes:[code],unrelatedQrPayloads:[]}),image:async()=>({codes:[code],rawPayload:code}),frame:()=>({codes:[],rawPayload:null,frameReady:true,brightness:120})};
  global.fetch=async(url,init)=>{requests.push({url,init});return {ok:true,status:200,json:async()=>({registration:'REGISTERED',integrity:url.endsWith('/original')?'MATCH':'NOT_CHECKED',documentSource:url.endsWith('/original')?'stored-original':undefined,original:url.endsWith('/original')?{available:true,viewUrl:`/api/v1/verify/${code}/document`,downloadUrl:`/api/v1/verify/${code}/document?download=1`}:undefined,message:'Verified',version:1})};};
});
afterEach(async()=>{if(tree)await act(async()=>tree.unmount());tree=null;global.fetch=originalFetch;delete global.window;delete global.__qr;if(originalNavigator)Object.defineProperty(global,'navigator',originalNavigator);else delete global.navigator;});

test('a QR link automatically retrieves the original and renders view/download links',async()=>{
  await mount('?code='+code);
  assert.equal(requests[0].url,`/api/v1/verify/${code}/original`);
  assert.match(text(),/Original passport verified/);
  assert.equal(tree.root.findByType('object').props.data,`/api/v1/verify/${code}/document`);
  assert.ok(tree.root.findAllByType('a').some(a=>a.props.href.endsWith('?download=1')));
});

test('legacy code-only and file comparison methods remain selectable',async()=>{
  await mount();
  const choices=tree.root.findAllByProps({className:'verification-method-button'});
  assert.equal(choices.length,3);
  assert.equal(choices[0].props['aria-pressed'],true);
  await act(async()=>choices[2].props.onClick());
  assert.equal(choices[2].props['aria-pressed'],true);
  assert.equal(choices[0].props['aria-pressed'],false);
  await act(async()=>tree.root.findByProps({id:'verify-code'}).props.onChange({target:{value:code}}));
  await act(async()=>tree.root.findByType('form').props.onSubmit({preventDefault(){}}));
  assert.equal(requests[0].url,`/api/v1/verify/${code}`);
  await act(async()=>choices[1].props.onClick());
  assert.equal(choices[1].props['aria-pressed'],true);
  assert.equal(choices[2].props['aria-pressed'],false);
  const pdf=new File(['%PDF-test'],'passport.pdf',{type:'application/pdf'});
  await act(async()=>tree.root.findByProps({id:'verify-file'}).props.onChange({target:{files:[pdf]}}));
  assert.equal(requests[1].url,'/api/v1/verify/file');
  assert.equal(requests[1].init.body.get('file').name,'passport.pdf');
  assert.ok(tree.root.findByProps({id:'pdf-verification-code'}));
});

test('camera processes real frames and shows low-light and unrelated-code prompts',async()=>{
  await mount();
  await act(async()=>button('Scan QR with camera').props.onClick());
  assert.ok(interval);
  await act(async()=>interval());
  assert.match(text(),/1 frames checked/);
  assert.match(text(),/Scanner is working/);
  global.__qr.frame=()=>({codes:[],rawPayload:null,frameReady:true,brightness:12});
  await act(async()=>interval());
  assert.match(text(),/too dark/);
  global.__qr.frame=()=>({codes:[],rawPayload:'unrelated',frameReady:true,corners:[{x:.1,y:.1},{x:.8,y:.1},{x:.8,y:.8},{x:.1,y:.8}]});
  await act(async()=>interval());
  assert.match(text(),/not an OrionX/);
  assert.ok(tree.root.findByType('polygon'));
});

test('camera QR captures tracked corners, stops processing and retrieves original',async()=>{
  await mount();
  await act(async()=>button('Scan QR with camera').props.onClick());
  global.__qr.frame=()=>({codes:[code],rawPayload:code,frameReady:true,corners:[{x:.1,y:.1},{x:.9,y:.1},{x:.9,y:.9},{x:.1,y:.9}]});
  await act(async()=>interval());
  assert.equal(interval,null);
  assert.ok(stopped>0);
  assert.match(text(),/QR captured/);
  assert.equal(requests[0].url,`/api/v1/verify/${code}/original`);
  assert.ok(tree.root.findByType('polygon'));
  await act(async()=>timeout());
  assert.equal(tree.root.findAllByType('video').length,0);
});

test('denied camera access provides an actionable fallback',async()=>{
  navigator.mediaDevices.getUserMedia=async()=>{throw Object.assign(new Error('denied'),{name:'NotAllowedError'});};
  await mount();await act(async()=>button('Scan QR with camera').props.onClick());
  assert.match(text(),/permission was denied/);
  assert.equal(tree.root.findAllByType('video').length,0);
});

test('cancelling pending camera access releases a late stream',async()=>{
  let resolve;navigator.mediaDevices.getUserMedia=()=>new Promise(r=>resolve=r);
  await mount();await act(async()=>button('Scan QR with camera').props.onClick());
  await act(async()=>button('Stop Scanning').props.onClick());
  await act(async()=>resolve(stream()));
  assert.ok(stopped>0);
  assert.equal(tree.root.findAllByType('video').length,0);
  assert.match(text(),/Camera stopped/);
});

test('a failed original check never renders a PDF viewer',async()=>{
  global.fetch=async()=>({ok:false,status:422,json:async()=>({registration:'REGISTERED',integrity:'MISMATCH',documentSource:'stored-original',original:{available:false,error:'Stored original mismatch'},message:'Mismatch'})});
  await mount('?code='+code);
  assert.equal(tree.root.findAllByType('object').length,0);
  assert.match(text(),/Stored original does not match/);
});

test('a QR image also retrieves the original, without uploading the PDF',async()=>{
  await mount();
  const input=tree.root.findAllByType('input').find(n=>n.props.accept==='image/*');
  await act(async()=>input.props.onChange({target:{files:[new File(['image'],'qr.png')],value:'qr.png'}}));
  assert.equal(requests[0].url,`/api/v1/verify/${code}/original`);
});


test('a byte-identical revoked passport never renders a valid-document viewer',async()=>{
  global.fetch=async()=>({ok:false,status:409,json:async()=>({registration:'REGISTERED',revocation:'REVOKED',integrity:'MATCH',currency:'LATEST',original:{available:false},message:'This version was revoked on Solana.'})});
  await mount('?code='+code);
  assert.match(text(),/REVOKED/);
  assert.equal(tree.root.findAllByType('object').length,0);
  assert.doesNotMatch(text(),/Original passport verified/);
});
