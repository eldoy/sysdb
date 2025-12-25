var sysdb = require('../../index.js')
var os = require('node:os')
var path = require('node:path')
var fsSync = require('node:fs')

var tmpdir = os.tmpdir()
var dbPath = path.join(tmpdir, 'sysdb.json')
var db

beforeEach(function () {
  if (fsSync.existsSync(dbPath)) fsSync.unlinkSync(dbPath)
  db = sysdb(dbPath)
})

test('get() basic and numeric operators', async function ({ t }) {
  await db.set({ name: 'a', val: 10 })
  await db.set({ name: 'a', val: 20 })

  t.equal(db.get({ name: 'a' }).length, 2)
  t.equal(db.get({ val: { $gt: 15 } }).length, 1)
  t.equal(db.get({ val: { $lte: 10 } }).length, 1)
})

test('get() with multi-key sorting', async function ({ t }) {
  await db.set({ name: 'Charlie', age: 30 })
  await db.set({ name: 'Alice', age: 25 })
  await db.set({ name: 'Bob', age: 25 })

  var res = db.get({}, { sort: { age: 1, name: 1 } })
  t.equal(res[0].name, 'Alice')
  t.equal(res[1].name, 'Bob')
  t.equal(res[2].name, 'Charlie')

  var resDesc = db.get({}, { sort: { age: -1 } })
  t.equal(resDesc[0].name, 'Charlie')
})

test('set() create, update, remove', async function ({ t }) {
  var id = await db.set({ type: 'job', name: 'a' })
  t.ok(id)

  await db.set({ id: id }, { name: 'b' })
  t.equal(db.get({ name: 'b' })[0].id, id)

  await db.set({ id: id }, null)
  t.equal(db.get({ id: id }).length, 0)
})

test('pagination (limit and skip) with sort', async function ({ t }) {
  for (var i = 1; i <= 5; i++) await db.set({ n: i })

  var res = db.get({}, { sort: { n: -1 }, skip: 2, limit: 2 })
  t.equal(res.length, 2)
  t.equal(res[0].n, 3)
  t.equal(res[1].n, 2)
})

test('get() array and regex operators', async function ({ t }) {
  await db.set({ tag: 'a', name: 'Apple' })
  await db.set({ tag: 'b', name: 'Banana' })

  t.equal(db.get({ tag: { $in: ['a', 'c'] } }).length, 1)
  t.equal(db.get({ tag: { $nin: ['a'] } }).length, 1)
  t.equal(db.get({ name: { $regex: /^Ap/ } }).length, 1)
})

test('date handling and persistence across reopen', async function ({ t }) {
  var myDate = new Date('2025-05-05')
  await db.set({ id: 'dt', time: myDate })

  t.equal(db.get({ time: { $gt: new Date('2025-01-01') } }).length, 1)

  var db2 = sysdb(dbPath)
  t.equal(db2.get({ time: { $gt: new Date('2025-01-01') } }).length, 1)
})

test('concurrent writes and persistence', async function ({ t }) {
  var p1 = db.set({ name: 'a' })
  var p2 = db.set({ name: 'b' })
  await p1
  await p2

  var db2 = sysdb(dbPath)
  t.equal(db2.get({}).length, 2)
})

test('edge cases: missing keys and nulls', async function ({ t }) {
  await db.set({ name: 'a', meta: null })
  t.equal(db.get({ nonExistent: 'foo' }).length, 0)
  t.equal(db.get({ meta: null }).length, 1)
  t.equal(db.get({ meta: { $ne: 'something' } }).length, 1)
})

test('edge cases: regex safety with numbers', async function ({ t }) {
  await db.set({ name: 123 })
  t.doesNotThrow(function () {
    var res = db.get({ name: { $regex: /abc/ } })
    t.equal(res.length, 0)
  })
})
