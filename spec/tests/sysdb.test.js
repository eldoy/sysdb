// dbspec v1.0 comprehensive conformance tests

var sysdb = require('../../index.js')
var os = require('node:os')
var path = require('node:path')
var fs = require('node:fs')

var tmpdir = os.tmpdir()
var dbPath = path.join(tmpdir, 'sysdb.sqlite')
var db

beforeEach(function () {
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath)
  db = sysdb(dbPath)
})

test('empty query matches all documents', async ({ t }) => {
  await db.set({ id: 'a' })
  await db.set({ id: 'b' })
  t.equal(db.get({}).length, 2)
})

test('missing field vs null distinction', async ({ t }) => {
  await db.set({ id: 'a', x: null })
  await db.set({ id: 'b' })
  t.equal(db.get({ x: null }).length, 1)
  t.equal(db.get({ x: { $exists: false } }).length, 1)
})

test('$exists true and false', async ({ t }) => {
  await db.set({ id: 'a', x: 1 })
  await db.set({ id: 'b' })
  t.equal(db.get({ x: { $exists: true } }).length, 1)
  t.equal(db.get({ x: { $exists: false } }).length, 1)
})

test('$eq and shorthand equality', async ({ t }) => {
  await db.set({ id: 'a', v: 1 })
  t.equal(db.get({ v: 1 }).length, 1)
  t.equal(db.get({ v: { $eq: 1 } }).length, 1)
})

test('$ne includes missing fields', async ({ t }) => {
  await db.set({ id: 'a', v: 1 })
  await db.set({ id: 'b' })
  t.equal(db.get({ v: { $ne: 1 } }).length, 1)
})

test('comparison operators require field existence', async ({ t }) => {
  await db.set({ id: 'a' })
  t.equal(db.get({ x: { $gt: 1 } }).length, 0)
  t.equal(db.get({ x: { $lte: 1 } }).length, 0)
})

test('date equality and ordering by timestamp', async ({ t }) => {
  await db.set({ id: 'a', d: new Date('2025-01-01') })
  await db.set({ id: 'b', d: new Date('2026-01-01') })
  t.equal(db.get({ d: { $eq: new Date('2025-01-01') } }).length, 1)
  t.equal(db.get({ d: { $gt: new Date('2025-12-31') } }).length, 1)
})

test('$in and $nin behavior', async ({ t }) => {
  await db.set({ id: 'a', v: 1 })
  await db.set({ id: 'b', v: 2 })
  await db.set({ id: 'c' })
  t.equal(db.get({ v: { $in: [1, 3] } }).length, 1)
  t.equal(db.get({ v: { $nin: [1] } }).length, 2)
})

test('$regex with string and RegExp', async ({ t }) => {
  await db.set({ id: 'a', n: 'Apple' })
  await db.set({ id: 'b', n: 'Banana' })
  await db.set({ id: 'c', n: 123 })
  t.equal(db.get({ n: { $regex: '^Ap' } }).length, 1)
  t.equal(db.get({ n: { $regex: /na$/ } }).length, 1)
})

test('$regex invalid pattern never throws', async ({ t }) => {
  await db.set({ id: 'a', n: 'Apple' })
  t.doesNotThrow(() => {
    t.equal(db.get({ n: { $regex: '[' } }).length, 0)
  })
})

test('$and, $or, $not combinations', async ({ t }) => {
  await db.set({ id: 'a', x: 1, y: 1 })
  await db.set({ id: 'b', x: 1, y: 2 })
  await db.set({ id: 'c', x: 2 })
  t.equal(db.get({ $and: [{ x: 1 }, { y: 1 }] }).length, 1)
  t.equal(db.get({ $or: [{ x: 2 }, { y: 2 }] }).length, 2)
  t.equal(db.get({ $not: { x: 1 } }).length, 1)
})

test('sort order and missing fields last', async ({ t }) => {
  await db.set({ id: 'a', x: 2 })
  await db.set({ id: 'b', x: 1 })
  await db.set({ id: 'c' })
  var r = db.get({}, { sort: { x: 1, id: 1 } })
  t.equal(r.map((d) => d.id).join(','), 'b,a,c')
})

test('limit and skip applied after sort', async ({ t }) => {
  for (let i = 0; i < 5; i++) await db.set({ n: i })
  var r = db.get({}, { sort: { n: -1 }, skip: 1, limit: 2 })
  t.equal(r.length, 2)
  t.equal(r[0].n, 3)
})

test('count returns only count and disables streaming', async ({ t }) => {
  await db.set({ a: 1 })
  await db.set({ a: 2 })
  var r = db.get({}, { count: true })
  t.equal(r.count, 2)
})

test('fields projection inclusive and exclusive', async ({ t }) => {
  await db.set({ id: 'a', x: 1, y: 2 })
  var inc = db.get({ id: 'a' }, { fields: { x: true } })[0]
  t.ok(inc.id)
  t.equal(inc.y, undefined)

  var exc = db.get({ id: 'a' }, { fields: { y: false } })[0]
  t.ok(exc.x)
  t.equal(exc.y, undefined)
})

test('insert assigns id if missing', async ({ t }) => {
  var d = await db.set({ x: 1 })
  t.ok(d.id)
})

test('bulk insert preserves object identity', async ({ t }) => {
  var docs = [{ x: 1 }, { x: 2 }]
  var res = await db.set(docs)
  t.equal(res[0], docs[0])
  t.ok(docs[0].id)
})

test('update shallow merge semantics', async ({ t }) => {
  var d = await db.set({ x: 1, y: 2 })
  await db.set({ id: d.id }, { y: undefined, z: null })
  var r = db.get({ id: d.id })[0]
  t.equal(r.y, undefined)
  t.equal(r.z, null)
})

test('delete by query and clear', async ({ t }) => {
  await db.set({ id: 'a', x: 1 })
  await db.set({ id: 'b', x: 2 })
  await db.set({ x: 1 }, null)
  t.equal(db.get({}).length, 1)
  await db.set({}, null)
  t.equal(db.get({}).length, 0)
})

test('streaming batches respect limit', async ({ t }) => {
  for (let i = 0; i < 5; i++) await db.set({ n: i })
  var seen = 0
  db.get({}, { batch: 2, limit: 3 }, (batch) => {
    seen += batch.length
  })
  t.equal(seen, 3)
})

test('persistence across reopen', async ({ t }) => {
  await db.set({ id: 'p', d: new Date('2025-01-01') })
  var db2 = sysdb(dbPath)
  t.equal(db2.get({ d: { $eq: new Date('2025-01-01') } }).length, 1)
})

test('data escape hatch exposes native client', async ({ t }) => {
  t.ok(db.data)
  t.equal(typeof db.data.exec, 'function')
  t.equal(typeof db.data.prepare, 'function')

  db.data.exec(`
    INSERT INTO records (id, json)
    VALUES ('raw', '{"id":"raw","x":42}')
  `)

  var r = db.get({ id: 'raw' })[0]
  t.equal(r.x, 42)
})
