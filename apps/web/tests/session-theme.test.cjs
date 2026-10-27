const { test, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const Module = require("node:module");
const { buildSync } = require("esbuild");
const React = require("react");
const { act, create } = require("react-test-renderer");

global.IS_REACT_ACT_ENVIRONMENT = true;
const originalFetch = global.fetch;
let tree;
function loadSource(relative) {
  const filename = path.resolve(__dirname, "../src", relative);
  const { outputFiles } = buildSync({
    entryPoints: [filename],
    bundle: true,
    jsx: "automatic",
    platform: "node",
    format: "cjs",
    write: false,
    external: ["react"],
    logLevel: "silent",
  });
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  mod._compile(outputFiles[0].text, filename);
  return mod.exports;
}
const { SessionProvider, useSession } = loadSource("lib/session.ts");
const { ThemeToggle } = loadSource("components/theme-toggle.tsx");
const session = {
  authenticated: true,
  authorized: true,
  role: "student",
  verification: "UNIVERSITY_VERIFIED",
  studentId: "student-1",
  subject: "subject-1",
};
const response = (value, ok = true, status = 200) => ({
  ok,
  status,
  json: async () => value,
});
const deferred = () => {
  let resolve;
  const promise = new Promise((r) => (resolve = r));
  return { promise, resolve };
};
afterEach(async () => {
  if (tree) await act(async () => tree.unmount());
  tree = null;
  global.fetch = originalFetch;
  delete global.document;
  delete global.localStorage;
});

test("one provider shares a single session request across page and navigation consumers", async () => {
  let requests = 0;
  const observed = [];
  global.fetch = async () => {
    requests++;
    return response(session);
  };
  function Consumer() {
    observed.push(useSession());
    return null;
  }
  await act(async () => {
    tree = create(
      React.createElement(
        SessionProvider,
        null,
        React.createElement(Consumer),
        React.createElement(Consumer),
      ),
    );
  });
  assert.equal(requests, 1);
  assert.equal(observed.at(-1).session.studentId, "student-1");
  assert.equal(observed.at(-1).loading, false);
});

test("callback refresh wins over an earlier session request that completes late", async () => {
  const old = deferred(),
    fresh = deferred();
  let requests = 0,
    context;
  global.fetch = () => (++requests === 1 ? old.promise : fresh.promise);
  function Consumer() {
    context = useSession();
    return null;
  }
  await act(async () => {
    tree = create(
      React.createElement(SessionProvider, null, React.createElement(Consumer)),
    );
  });
  let refresh;
  await act(async () => {
    refresh = context.refresh();
    fresh.resolve(response(session));
    await refresh;
  });
  assert.equal(context.session.studentId, "student-1");
  await act(async () => {
    old.resolve(
      response({
        ...session,
        subject: "stale-subject",
        studentId: "stale-student",
      }),
    );
    await old.promise;
  });
  assert.equal(context.session.studentId, "student-1");
  assert.equal(context.loading, false);
});

test("failed sign-out preserves the active session and successful sign-out clears it", async () => {
  let context;
  global.fetch = async () => response(session);
  function Consumer() {
    context = useSession();
    return null;
  }
  await act(async () => {
    tree = create(
      React.createElement(SessionProvider, null, React.createElement(Consumer)),
    );
  });
  global.fetch = async () =>
    response({ error: { message: "Offline" } }, false, 503);
  await act(async () => {
    await assert.rejects(() => context.signOut(), /Offline/);
  });
  assert.equal(context.session.studentId, "student-1");
  global.fetch = async () => response({ ok: true });
  await act(async () => context.signOut());
  assert.equal(context.session, null);
});

test("theme control toggles paired themes, persists the choice, and tolerates blocked storage", async () => {
  const stored = [];
  global.document = { documentElement: { dataset: { theme: "dark" } } };
  global.localStorage = { setItem: (...args) => stored.push(args) };
  await act(async () => {
    tree = create(React.createElement(ThemeToggle));
  });
  assert.equal(
    tree.root.findByType("button").props["aria-label"],
    "Switch to light theme",
  );
  await act(async () => tree.root.findByType("button").props.onClick());
  assert.equal(document.documentElement.dataset.theme, "light");
  assert.deepEqual(stored[0], ["orionx-theme", "light"]);
  assert.equal(
    tree.root.findByType("button").props["aria-label"],
    "Switch to dark theme",
  );
  global.localStorage = {
    setItem: () => {
      throw Error("Storage blocked");
    },
  };
  await act(async () => tree.root.findByType("button").props.onClick());
  assert.equal(document.documentElement.dataset.theme, "dark");
});
