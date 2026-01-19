var { DatabaseSync } = require('node:sqlite')
var crypto = require('node:crypto')

function sysdb(file) {
  var db = new DatabaseSync(file)

  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS records (
      id TEXT PRIMARY KEY,
      json TEXT NOT NULL
    );
  `)

  function encode(v) {
    if (v instanceof Date) return { $date: v.getTime() }
    if (Array.isArray(v)) return v.map(encode)
    if (v && typeof v === 'object') {
      var o = {}
      for (var k in v) o[k] = encode(v[k])
      return o
    }
    return v
  }

  function decode(v) {
    if (v && typeof v === 'object') {
      if ('$date' in v) return new Date(v.$date)
      if (Array.isArray(v)) return v.map(decode)
      var o = {}
      for (var k in v) o[k] = decode(v[k])
      return o
    }
    return v
  }

  function norm(v) {
    if (v instanceof Date) return v.getTime()
    return v
  }

  function eq(a, b) {
    return norm(a) === norm(b)
  }

  function matches(doc, query) {
    if (!query || Object.keys(query).length === 0) return true

    for (var k in query) {
      if (k === '$and') {
        if (!query[k].every((q) => matches(doc, q))) return false
        continue
      }
      if (k === '$or') {
        if (!query[k].some((q) => matches(doc, q))) return false
        continue
      }
      if (k === '$not') {
        if (matches(doc, query[k])) return false
        continue
      }

      var cond = query[k]
      var has = Object.prototype.hasOwnProperty.call(doc, k)
      var val = doc[k]

      if (
        cond &&
        typeof cond === 'object' &&
        !Array.isArray(cond) &&
        !(cond instanceof RegExp)
      ) {
        for (var op in cond) {
          var t = cond[op]

          if (op === '$exists') {
            if (t !== has) return false
            continue
          }

          if (!has) {
            if (op === '$ne' || op === '$nin') continue
            return false
          }

          var v = norm(val)
          var n = norm(t)

          if (op === '$eq' && !eq(v, n)) return false
          if (op === '$ne' && eq(v, n)) return false
          if (op === '$gt' && !(v > n)) return false
          if (op === '$gte' && !(v >= n)) return false
          if (op === '$lt' && !(v < n)) return false
          if (op === '$lte' && !(v <= n)) return false
          if (op === '$in' && !t.some((x) => eq(v, x))) return false
          if (op === '$nin' && t.some((x) => eq(v, x))) return false
          if (op === '$regex') {
            if (typeof val !== 'string') return false
            try {
              var r = t instanceof RegExp ? t : new RegExp(t)
              if (!r.test(val)) return false
            } catch {
              return false
            }
          }
        }
      } else {
        if (!has || !eq(val, cond)) return false
      }
    }
    return true
  }

  function allDocs() {
    return db
      .prepare('SELECT json FROM records')
      .all()
      .map((r) => decode(JSON.parse(r.json)))
  }

  return {
    data: db,

    get(query, options, onBatch) {
      if (!query) query = {}
      if (!options) options = {}

      var limit = options.limit == null ? 1000 : options.limit
      var skip = options.skip || 0
      var sort = options.sort
      var batch = options.batch

      var rows = allDocs().filter((d) => matches(d, query))

      if (sort) {
        var keys = Object.keys(sort)
        rows.sort(function (a, b) {
          for (var i = 0; i < keys.length; i++) {
            var k = keys[i]
            var av = a[k]
            var bv = b[k]
            if (av === undefined && bv !== undefined) return 1
            if (av !== undefined && bv === undefined) return -1
            if (eq(av, bv)) continue
            return sort[k] === -1
              ? norm(av) < norm(bv)
                ? 1
                : -1
              : norm(av) > norm(bv)
              ? 1
              : -1
          }
          return 0
        })
      }

      if (options.count) return { count: rows.length }

      rows = rows.slice(skip, skip + limit)

      if (onBatch) {
        var b = batch || rows.length
        for (var i = 0; i < rows.length; i += b) onBatch(rows.slice(i, i + b))
        return
      }

      if (options.fields) {
        rows = rows.map(function (r) {
          var o = {}
          var include = null
          for (var k in options.fields) if (options.fields[k]) include = true
          for (var k in r) {
            if (k === 'id') continue
            if (include) {
              if (options.fields[k]) o[k] = r[k]
            } else {
              if (options.fields[k] !== false) o[k] = r[k]
            }
          }
          if (options.fields.id !== false) o.id = r.id
          return o
        })
      }

      return rows
    },

    async set(q, values) {
      if (Array.isArray(q)) {
        var out = []
        for (var i = 0; i < q.length; i++) out.push(await this.set(q[i]))
        return out
      }

      if (values === undefined) {
        q.id = q.id || crypto.randomUUID()
        db.prepare('INSERT INTO records VALUES (?, ?)').run(
          q.id,
          JSON.stringify(encode(q))
        )
        return q
      }

      var rows = allDocs().filter((d) => matches(d, q))

      if (values === null) {
        var del = db.prepare('DELETE FROM records WHERE id = ?')
        rows.forEach((r) => del.run(r.id))
        return { n: rows.length }
      }

      var upd = db.prepare('UPDATE records SET json = ? WHERE id = ?')
      rows.forEach(function (r) {
        for (var k in values) {
          if (values[k] === undefined) delete r[k]
          else r[k] = values[k]
        }
        upd.run(JSON.stringify(encode(r)), r.id)
      })

      return { n: rows.length }
    }
  }
}

module.exports = sysdb
