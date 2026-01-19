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

test('document identity and nullability', async ({ t }) => {
  await db.set({ id: 'a', x: null })
  await db.set({ id: 'b' })
  t.equal(db.get({ x: null }).length, 1)
  t.equal(db.get({ x: { $exists: false } }).length, 1)
})

test('shorthand equality and $eq', async ({ t }) => {
  await db.set({ id: 'a', v: 1 })
  t.equal(db.get({ v: 1 }).length, 1)
  t.equal(db.get({ v: { $eq: 1 } }).length, 1)
})

test('$ne semantics include missing fields', async ({ t }) => {
  await db.set({ id: 'a', v: 1 })
  await db.set({ id: 'b' })
  t.equal(db.get({ v: { $ne: 1 } }).length, 1)
})

test('comparison operators with missing fields fail', async ({ t }) => {
  await db.set({ id: 'a' })
  t.equal(db.get({ v: { $gt: 1 } }).length, 0)
})

test('date comparison by timestamp', async ({ t }) => {
  await db.set({ id: 'a', d: new Date('2025-01-01') })
  await db.set({ id: 'b', d: new Date('2026-01-01') })
  t.equal(db.get({ d: { $gte: new Date('2026-01-01') } }).length, 1)
})

test('$in and $nin semantics with missing fields', async ({ t }) => {
  await db.set({ id: 'a', v: 1 })
  await db.set({ id: 'b' })
  t.equal(db.get({ v: { $in: [1, 2] } }).length, 1)
  t.equal(db.get({ v: { $nin: [1] } }).length, 1)
})

test('$regex string and RegExp operands', async ({ t }) => {
  await db.set({ id: 'a', n: 'Apple' })
  await db.set({ id: 'b', n: 123 })
  t.equal(db.get({ n: { $regex: '^Ap' } }).length, 1)
  t.equal(db.get({ n: { $regex: /ple$/ } }).length, 1)
})

test('$regex invalid pattern never throws', async ({ t }) => {
  await db.set({ id: 'a', n: 'Apple' })
  t.doesNotThrow(() => {
    t.equal(db.get({ n: { $regex: '[' } }).length, 0)
  })
})

test('logical operators at any level', async ({ t }) => {
  await db.set({ id: 'a', x: 1, y: 1 })
  await db.set({ id: 'b', x: 1, y: 2 })
  t.equal(db.get({ x: 1, $or: [{ y: 1 }, { y: 3 }] }).length, 1)
  t.equal(db.get({ $not: { x: 2 } }).length, 2)
})

test('multi-key sort and missing fields last', async ({ t }) => {
  await db.set({ id: 'a', x: 2 })
  await db.set({ id: 'b', x: 1 })
  await db.set({ id: 'c' })
  var r = db.get({}, { sort: { x: 1, id: 1 } })
  t.equal(r[0].id, 'b')
  t.equal(r[2].id, 'c')
})

test('limit and skip apply after sort', async ({ t }) => {
  for (let i = 0; i < 5; i++) await db.set({ n: i })
  var r = db.get({}, { sort: { n: -1 }, skip: 1, limit: 2 })
  t.equal(r[0].n, 3)
  t.equal(r.length, 2)
})

test('count disables document return and streaming', async ({ t }) => {
  await db.set({ a: 1 })
  var r = db.get({}, { count: true })
  t.equal(r.count, 1)
})

test('fields projection include and exclude', async ({ t }) => {
  await db.set({ id: 'a', x: 1, y: 2 })
  var r1 = db.get({ id: 'a' }, { fields: { x: true } })[0]
  t.ok(r1.id)
  t.equal(r1.y, undefined)

  var r2 = db.get({ id: 'a' }, { fields: { y: false } })[0]
  t.ok(r2.x)
  t.equal(r2.y, undefined)
})

test('insert returns document with id', async ({ t }) => {
  var d = await db.set({ x: 1 })
  t.ok(d.id)
})

test('update shallow merge and delete field via undefined', async ({ t }) => {
  var d = await db.set({ x: 1, y: 2 })
  await db.set({ id: d.id }, { y: undefined, z: null })
  var r = db.get({ id: d.id })[0]
  t.equal(r.y, undefined)
  t.equal(r.z, null)
})

test('delete and clear', async ({ t }) => {
  await db.set({ id: 'a', x: 1 })
  await db.set({ id: 'b', x: 2 })
  await db.set({ x: 1 }, null)
  t.equal(db.get({}).length, 1)
  await db.set({}, null)
  t.equal(db.get({}).length, 0)
})

test('bulk insert preserves object identity', async ({ t }) => {
  var docs = [{ x: 1 }, { x: 2 }]
  var res = await db.set(docs)
  t.equal(res[0], docs[0])
  t.ok(docs[0].id)
})

test('streaming batches respect global limit', async ({ t }) => {
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
