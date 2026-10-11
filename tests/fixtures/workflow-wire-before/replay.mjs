import assert from 'node:assert/strict';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';
import tls from 'node:tls';
import http from 'node:http';
import https from 'node:https';
import dns from 'node:dns';
import { createRequire, syncBuiltinESMExports } from 'node:module';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

// No external source/configuration, network, environment files, or World is needed.
const [mode, projectDir, artifactDir] = process.argv.slice(2);
assert.ok(['capture', 'verify'].includes(mode), 'mode must be capture or verify');
assert.ok(path.isAbsolute(projectDir) && path.isAbsolute(artifactDir));
const denyNetwork = () => { throw new Error('OFFLINE_NETWORK_DENIED'); };
net.Socket.prototype.connect = denyNetwork;
tls.connect = denyNetwork;
http.request = http.get = https.request = https.get = denyNetwork;
dns.lookup = dns.resolve = dns.resolve4 = dns.resolve6 = denyNetwork;
dns.promises.lookup = dns.promises.resolve = denyNetwork;
globalThis.fetch = denyNetwork;
const checkedPath = (file) => {
  const value = file instanceof URL ? file.pathname : String(file);
  assert.ok(!/^\.env(?:\.|$)/.test(path.basename(value)), 'ENV_FILE_READ_DENIED');
};
for (const method of ['readFileSync', 'readFile', 'openSync', 'open', 'createReadStream']) {
  const original = fs[method].bind(fs);
  fs[method] = (file, ...args) => { checkedPath(file); return original(file, ...args); };
}
for (const method of ['readFile', 'open']) {
  const original = fsp[method].bind(fsp);
  fsp[method] = (file, ...args) => { checkedPath(file); return original(file, ...args); };
}
syncBuiltinESMExports();

const requireFromProject = createRequire(path.join(projectDir, 'package.json'));
const serializerPath = requireFromProject.resolve('@workflow/core/serialization');
const serializer = await import(pathToFileURL(serializerPath).href);
const classRegistryPath = requireFromProject.resolve('@workflow/core/class-serialization');
const { registerSerializationClass } = await import(pathToFileURL(classRegistryPath).href);
const serdePath = requireFromProject.resolve('@workflow/serde');
const { WORKFLOW_SERIALIZE, WORKFLOW_DESERIALIZE } = await import(pathToFileURL(serdePath).href);
const requireFromCore = createRequire(serializerPath);

function packageInfo(name, resolver) {
  let current = path.dirname(resolver.resolve(name));
  while (true) {
    const pkgPath = path.join(current, 'package.json');
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      if (pkg.name === name) return { version: pkg.version, packagePath: pkgPath };
    }
    const next = path.dirname(current);
    assert.notEqual(next, current, `Cannot resolve package metadata for ${name}`);
    current = next;
  }
}
const versions = Object.fromEntries([
  ['workflow', requireFromProject], ['@workflow/core', requireFromProject],
  ['@workflow/serde', requireFromProject], ['devalue', requireFromCore],
  ['nanoid', requireFromCore],
].map(([name, resolver]) => [name, packageInfo(name, resolver)]));

class SyntheticRecord {
  constructor(label, value) { this.label = label; this.value = value; }
  static [WORKFLOW_SERIALIZE](instance) { return { label: instance.label, value: instance.value }; }
  static [WORKFLOW_DESERIALIZE](data) { return new SyntheticRecord(data.label, data.value); }
}
registerSerializationClass('serenia-acceptance.synthetic-record.v1', SyntheticRecord);

const visibleBytes = [11, 22, 33, 44];
const secretPrefix = [201, 202, 203];
const secretSuffix = [211, 212, 213];
function backing() { return Uint8Array.from([...secretPrefix, ...visibleBytes, ...secretSuffix]); }
function makeGraph() {
  const shared = { label: 'synthetic-shared', value: 7 };
  const error = new TypeError('synthetic-error');
  error.stack = 'TypeError: synthetic-error\n    at synthetic-fixture:1:1';
  const graph = {
    date: new Date('2026-10-10T12:34:56.000Z'),
    missing: undefined, shared, sharedAgain: shared,
    map: new Map([['shared', shared], [shared, 'object-key']]),
    set: new Set(['synthetic', shared]), error,
  };
  graph.self = graph;
  return graph;
}
function checkGraph(g) {
  assert.ok(g.date instanceof Date);
  assert.equal(g.date.toISOString(), '2026-10-10T12:34:56.000Z');
  assert.ok(Object.hasOwn(g, 'missing')); assert.equal(g.missing, undefined);
  assert.equal(g.shared, g.sharedAgain); assert.equal(g.self, g);
  assert.ok(g.map instanceof Map); assert.equal(g.map.get('shared'), g.shared);
  assert.equal(g.map.get(g.shared), 'object-key');
  assert.ok(g.set instanceof Set); assert.ok(g.set.has(g.shared));
  assert.ok(g.error instanceof Error); assert.equal(g.error.name, 'TypeError');
  assert.equal(g.error.message, 'synthetic-error');
  assert.equal(g.error.stack, 'TypeError: synthetic-error\n    at synthetic-fixture:1:1');
}
function checkView(view) {
  assert.equal(view.byteLength, visibleBytes.length);
  assert.deepEqual(Array.from(new Uint8Array(view.buffer, view.byteOffset, view.byteLength)), visibleBytes);
}
const summary = {
  chief_complaint: 'Síntesis ficticia de aceptación', presenting_issues: ['dato sintético'],
  mood_affect: 'descripción ficticia', cognitive_patterns: [], questionnaires: [],
  areas_for_exploration: [], preliminary_impression: 'Sin interpretación clínica real',
  recommended_actions_for_clinician: [], patient_facing_summary: 'Resumen sintético',
  risk_assessment: { suicidality: 'none', self_harm: 'none', heteroaggression: 'none',
    substance_use_acute: null, notes: 'Solo fixture' }, proposed_tasks: [],
};
const cases = {
  'graph': { create: makeGraph, check: checkGraph },
  'uint8-offset': {
    create: () => { const a = backing(); return new Uint8Array(a.buffer, 3, 4); },
    check: (v) => { assert.ok(v instanceof Uint8Array); checkView(v); }, view: true,
  },
  'buffer-offset': {
    create: () => { const a = backing(); return Buffer.from(a.buffer, 3, 4); },
    // SDK's Uint8Array reducer intentionally revives Buffer as Uint8Array.
    check: (v) => { assert.ok(v instanceof Uint8Array); checkView(v); }, view: true,
  },
  'dataview-offset': {
    create: () => { const a = backing(); return new DataView(a.buffer, 3, 4); },
    check: (v) => { assert.ok(v instanceof DataView); checkView(v); }, view: true,
  },
  'custom-serde': {
    create: () => new SyntheticRecord('synthetic-serde', makeGraph()),
    check: (v) => { assert.ok(v instanceof SyntheticRecord); assert.equal(v.label, 'synthetic-serde'); checkGraph(v.value); },
  },
  'assessment-shape': {
    create: () => ({ input: { sessionId: '00000000-0000-4000-8000-000000000001',
      rejectionContext: { rejectionReason: 'Motivo ficticio', clinicalNotes: null },
      jobToken: '00000000-0000-4000-8000-000000000002' }, summary }),
    check: (v) => assert.deepEqual(v, cases['assessment-shape'].create()),
  },
};
const runId = 'wrun_serenia_synthetic_wire_before';
// Named SDK entrypoints, not direct devalue. key=undefined, global=host Node.
// ops=[] must remain empty: there are no streams or World/context operations.
const boundaries = {
  'workflow-arguments': {
    encode: (value, ops) => serializer.dehydrateWorkflowArguments(value, runId, undefined, ops, globalThis),
    decode: (bytes) => serializer.hydrateWorkflowArguments(bytes, runId, undefined, globalThis),
  },
  'workflow-return': {
    encode: (value) => serializer.dehydrateWorkflowReturnValue(value, runId, undefined, globalThis),
    decode: (bytes, ops) => serializer.hydrateWorkflowReturnValue(bytes, runId, undefined, ops, globalThis),
  },
  'step-arguments': {
    encode: (value) => serializer.dehydrateStepArguments(value, runId, undefined, globalThis),
    decode: (bytes, ops) => serializer.hydrateStepArguments(bytes, runId, undefined, ops, globalThis),
  },
  'step-return': {
    encode: (value, ops) => serializer.dehydrateStepReturnValue(value, runId, undefined, ops, globalThis),
    decode: (bytes) => serializer.hydrateStepReturnValue(bytes, runId, undefined, globalThis),
  },
};
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const marker = 'SERENIA_WORKFLOW_SDK_WIRE_BASELINE_V1';
const info = { marker, createdAt: new Date().toISOString(), node: process.version, versions,
  serializerPath, serializerSha256: hash(fs.readFileSync(serializerPath)),
  limits: ['SDK wire/reducers only; no compiler, worker, queue, World, VM or durable replay',
    'unencrypted devl format; no stream operations; no clinical model validation',
    'Buffer revival expected as Uint8Array; offsets may normalize but visible bytes must match'],
  results: [] };
await fsp.mkdir(artifactDir, { recursive: true });

if (mode === 'capture') {
  assert.ok(!fs.existsSync(path.join(artifactDir, 'metadata.json')), 'Refusing to replace baseline');
  for (const [boundaryName, boundary] of Object.entries(boundaries)) {
    for (const [caseName, scenario] of Object.entries(cases)) {
      const result = { boundary: boundaryName, case: caseName, status: 'FAIL' };
      try {
        const ops = [];
        const payload = await boundary.encode(scenario.create(), ops);
        assert.equal(ops.length, 0);
        assert.ok(payload instanceof Uint8Array);
        assert.equal(Buffer.from(payload.subarray(0, 4)).toString('ascii'), 'devl');
        result.file = `${boundaryName}--${caseName}.bin`;
        result.sha256 = hash(payload); result.bytes = payload.byteLength;
        await fsp.writeFile(path.join(artifactDir, result.file), payload, { flag: 'wx' });
        const revived = await boundary.decode(payload, ops);
        assert.equal(ops.length, 0);
        scenario.check(revived);
        result.status = 'PASS';
        if (scenario.view) {
          result.revivedType = revived.constructor.name;
          result.byteOffset = revived.byteOffset;
          result.backingByteLength = revived.buffer.byteLength;
          result.byteExposure = revived.buffer.byteLength === revived.byteLength ? 'PASS' : 'FAIL';
        }
      } catch (error) {
        result.error = { name: error.name, message: error.message, cause: error.cause?.message };
      }
      info.results.push(result);
    }
  }
  await fsp.writeFile(path.join(artifactDir, 'metadata.json'), JSON.stringify(info, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ marker, mode, versions: Object.fromEntries(Object.entries(versions).map(([k,v]) => [k,v.version])),
    pass: info.results.filter(r => r.status === 'PASS').length,
    fail: info.results.filter(r => r.status !== 'PASS').length,
    byteExposureFailures: info.results.filter(r => r.byteExposure === 'FAIL').length }));
} else {
  const baseline = JSON.parse(await fsp.readFile(path.join(artifactDir, 'metadata.json'), 'utf8'));
  assert.equal(baseline.marker, marker);
  let failures = 0;
  for (const original of baseline.results) {
    const boundary = boundaries[original.boundary];
    const scenario = cases[original.case];
    const result = { boundary: original.boundary, case: original.case };
    try {
      const ops = [];
      if (original.file) {
        const stored = new Uint8Array(await fsp.readFile(path.join(artifactDir, original.file)));
        assert.equal(hash(stored), original.sha256, 'Baseline byte hash changed');
        const revived = await boundary.decode(stored, ops);
        scenario.check(revived);
        if (scenario.view) assert.equal(revived.buffer.byteLength, revived.byteLength, 'Backing bytes outside view are exposed');
        result.previousPayload = 'PASS';
      } else result.previousPayload = 'NOT_AVAILABLE_BASELINE_ENCODE_REJECTED';
      // Also require the final SDK to encode and roundtrip the case now.
      const encoded = await boundary.encode(scenario.create(), ops);
      const revived = await boundary.decode(encoded, ops);
      scenario.check(revived);
      if (scenario.view) assert.equal(revived.buffer.byteLength, revived.byteLength, 'Backing bytes outside view are exposed');
      assert.equal(ops.length, 0);
      result.currentRoundtrip = 'PASS';
    } catch (error) {
      failures++;
      result.status = 'FAIL';
      result.error = { name: error.name, message: error.message, cause: error.cause?.message };
    }
    info.results.push(result);
  }
  const output = path.join(artifactDir, `verification-${versions['@workflow/core'].version}-${Date.now()}.json`);
  await fsp.writeFile(output, JSON.stringify(info, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ marker, mode, failures, output }));
  if (failures) process.exitCode = 1;
}
