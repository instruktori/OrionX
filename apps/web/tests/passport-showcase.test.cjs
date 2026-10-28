const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
const { build } = require('esbuild');
const React = require('react');
const { act, create } = require('react-test-renderer');
global.IS_REACT_ACT_ENVIRONMENT = true;
let tree;
afterEach(async () => { if (tree) await act(async () => tree.unmount()); tree = null; delete global.window; });
async function load(component = "passport-showcase") {
  const filename = path.resolve(__dirname, `../src/components/${component}.tsx`);
  const { outputFiles } = await build({entryPoints:[filename],bundle:true,jsx:'automatic',platform:'node',format:'cjs',write:false,external:['react'],plugins:[{
    name:'test-assets',setup(b) {
      b.onLoad({filter:/\.module\.css$/},()=>({contents:'export default new Proxy({}, { get: (_, key) => key });',loader:'js'}));
      b.onResolve({filter:/^next\/image$/},()=>({path:'image',namespace:'test'}));
      b.onLoad({filter:/.*/,namespace:'test'},()=>({contents:'module.exports = function Image() { return null; };',loader:'js'}));
    }
  }]});
  const mod = new Module(filename,module); mod.filename=filename; mod.paths=Module._nodeModulePaths(path.dirname(filename)); mod._compile(outputFiles[0].text,filename);
  return component === "skill-field" ? mod.exports.SkillField : mod.exports.PassportShowcase;
}
function media(matches = false) {
  let listener;
  global.window = { matchMedia: () => ({matches, addEventListener:(_,fn)=>{listener=fn;},removeEventListener:()=>{listener=null;}}) };
  return () => listener;
}
test('formats start unselected and reveal details only after user selection, with keyboard navigation', async () => {
  media(); const Showcase = await load();
  await act(async () => { tree=create(React.createElement(Showcase)); });
  const tabs=()=>tree.root.findAll(n=>n.props.role==='tab');
  const active=()=>tabs().findIndex(n=>n.props['aria-selected']);
  assert.equal(active(), -1, 'no format should be selected on load');
  assert.equal(tree.root.findAll(n=>n.props.role==='tabpanel' && !n.props.hidden).length, 0);
  assert.equal(tree.root.findAllByType('p').some(n=>n.children.join('').includes('No credential has been issued')), false);
  assert.equal(tabs()[0].props.tabIndex, 0, 'formats remain keyboard reachable before selection');
  const key=async (value)=>act(async()=>tabs()[active()].props.onKeyDown({key:value,preventDefault(){}}));
  await act(async()=>tabs()[1].props.onClick()); assert.equal(active(),1);
  assert.equal(tree.root.findAllByType('p').some(n=>n.children.join('').includes('No credential has been issued')), true);
  assert.equal(tree.root.findAll(n=>n.props.role==='tabpanel' && !n.props.hidden)[0].props.id,'format-panel-1');
  await key('End'); assert.equal(active(),2);
  await key('ArrowRight'); assert.equal(active(),0);
  await key('ArrowLeft'); assert.equal(active(),2);
  await key('Home'); assert.equal(active(),0);
  assert.equal(tabs().filter(n=>n.props.tabIndex===0).length,1);
});
test('pause is reversible and reduced motion disables animation independently', async () => {
  media(); const Showcase=await load();
  await act(async()=>{tree=create(React.createElement(Showcase));});
  const control=()=>tree.root.findAllByType('button').find(n=>n.props['aria-pressed']!==undefined);
  await act(async()=>control().props.onClick()); assert.equal(control().props['aria-label'],'Play badge animation');
  await act(async()=>control().props.onClick()); assert.equal(control().props['aria-label'],'Pause badge animation');
  await act(async()=>tree.unmount()); tree=null;
  media(true);
  await act(async()=>{tree=create(React.createElement(Showcase));});
  assert.equal(control().props.disabled,true);
  assert.equal(control().props['aria-pressed'],true);
  assert.equal(tree.root.findAll(n=>n.props['data-paused']===true).length,1);
});

test('field pulses without pointer input and pause stops scheduling frames', async () => {
  const previous = Object.fromEntries(['document', 'ResizeObserver', 'IntersectionObserver', 'requestAnimationFrame', 'cancelAnimationFrame'].map(k => [k, global[k]]));
  let nextFrame = 0;
  const frames = new Map();
  let endpoints = [];
  const context = {
    clearRect() { endpoints = []; }, setTransform() {},
    createLinearGradient() { return { addColorStop() {} }; },
    beginPath() {}, moveTo() {}, quadraticCurveTo() {}, stroke() {}, fill() {},
    arc(x, y) { endpoints.push([x, y]); },
  };
  const canvas = { getContext: () => context, getBoundingClientRect: () => ({ width: 600, height: 300 }), addEventListener() {}, removeEventListener() {} };
  global.window = { devicePixelRatio: 1 };
  global.document = { hidden: false, addEventListener() {}, removeEventListener() {} };
  global.ResizeObserver = global.IntersectionObserver = class { observe() {} disconnect() {} };
  global.requestAnimationFrame = fn => { frames.set(++nextFrame, fn); return nextFrame; };
  global.cancelAnimationFrame = id => frames.delete(id);
  try {
    const Field = await load('skill-field');
    await act(async () => { tree = create(React.createElement(Field, { format: 0, mood: 0, paused: false }), { createNodeMock: node => node.type === 'canvas' ? canvas : null }); });
    const before = JSON.stringify(endpoints);
    const start = performance.now();
    for (let i = 1; i <= 90; i++) {
      const [id, fn] = frames.entries().next().value;
      frames.delete(id); fn(start + i * 16.667);
    }
    assert.notEqual(JSON.stringify(endpoints), before, 'idle scene should expand and contract without pointer events');
    await act(async () => tree.update(React.createElement(Field, { format: 0, mood: 0, paused: true })));
    assert.equal(frames.size, 0, 'paused scene should stop requesting frames');
    await act(async () => tree.unmount()); tree = null;
  } finally {
    for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete global[key]; else global[key] = value; }
  }
});
