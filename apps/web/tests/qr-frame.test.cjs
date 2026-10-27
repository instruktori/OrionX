const {test} = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
const {buildSync} = require('esbuild');
const QRCode = require('qrcode');
const filename = path.resolve(__dirname,'../src/lib/qr-pdf.ts');
const compiled=buildSync({entryPoints:[filename],bundle:true,platform:'node',format:'cjs',write:false,logLevel:'silent'}).outputFiles[0].text;
const mod=new Module(filename,module);mod.filename=filename;mod.paths=Module._nodeModulePaths(path.dirname(filename));mod._compile(compiled,filename);
const {decodeQrFromVideoFrame} = mod.exports;
const video={videoWidth:360,videoHeight:360,readyState:4};
const canvas = pixels => ({getContext:()=>({drawImage(){},getImageData:()=>({data:pixels})})});

test('real QR decoder returns a passport code and normalized tracking corners',()=>{
  const code='D1-'+'A'.repeat(32);
  const qr=QRCode.create('https://orionx-phi.vercel.app/verify?code='+code);
  const pixels=new Uint8ClampedArray(360*360*4).fill(255);
  const scale=Math.floor(360/(qr.modules.size+8));
  const offset=Math.floor((360-qr.modules.size*scale)/2);
  for(let y=0;y<qr.modules.size;y++) for(let x=0;x<qr.modules.size;x++) if(qr.modules.get(y,x)) {
    for(let dy=0;dy<scale;dy++) for(let dx=0;dx<scale;dx++) {
      const i=((offset+y*scale+dy)*360+offset+x*scale+dx)*4;
      pixels[i]=pixels[i+1]=pixels[i+2]=0;
    }
  }
  const result=decodeQrFromVideoFrame(video,canvas(pixels));
  assert.deepEqual(result.codes,[code]);
  assert.equal(result.frameReady,true);
  assert.equal(result.corners.length,4);
  for(const p of result.corners)assert.ok(p.x>0&&p.x<1&&p.y>0&&p.y<1);
  assert.ok(result.brightness>45);
});

test('decoder distinguishes dark frames from video that has not started',()=>{
  const dark=decodeQrFromVideoFrame(video,canvas(new Uint8ClampedArray(360*360*4)));
  assert.equal(dark.frameReady,true);
  assert.equal(dark.brightness,0);
  assert.deepEqual(dark.codes,[]);
  assert.equal(decodeQrFromVideoFrame({...video,readyState:0},{}).frameReady,false);
});
