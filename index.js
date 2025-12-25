var fs = require('node:fs/promises')
var fsSync = require('node:fs')
var path = require('node:path')
var crypto = require('node:crypto')

function sysdb(file) {
  var data = [],
    writing = false,
    pending = false,
    drain = Promise.resolve(),
    resolveDrain
  var walFile = file + '.wal',
    persistTimeout = null,
    persistPromise = null,
    debounceMs = 5

  try {
    data = JSON.parse(fsSync.readFileSync(file, 'utf8'))
  } catch (e) {
    data = []
  }

  try {
    if (fsSync.existsSync(walFile)) {
      var lines = fsSync.readFileSync(walFile, 'utf8').split('\n')
      for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim()
        if (!line) continue
        try {
          var record = JSON.parse(line)
          if (record.op === 'insert') data.push(record.data)
          else if (record.op === 'update') {
            for (var j = 0; j < data.length; j++)
              if (matches(data[j], record.query))
                Object.assign(data[j], record.data)
          } else if (record.op === 'delete')
            data = data.filter(function (d) {
              return !matches(d, record.query)
            })
        } catch (err) {}
      }
    }
  } catch (e) {}

  function matches(doc, query) {
    for (var k in query) {
      var condition = query[k],
        value = doc[k]
      if (
        typeof condition === 'object' &&
        condition !== null &&
        !Array.isArray(condition) &&
        !(condition instanceof RegExp)
      ) {
        for (var op in condition) {
          var target = condition[op]
          if (op === '$regex') {
            if (typeof value !== 'string' || !target.test(value)) return false
            continue
          }
          var v =
            value instanceof Date
              ? value.getTime()
              : typeof value === 'string' && !isNaN(Date.parse(value))
              ? Date.parse(value)
              : value
          var t =
            target instanceof Date
              ? target.getTime()
              : typeof target === 'string' && !isNaN(Date.parse(target))
              ? Date.parse(target)
              : target
          if (op === '$gt') {
            if (!(v > t)) return false
          } else if (op === '$lt') {
            if (!(v < t)) return false
          } else if (op === '$gte') {
            if (!(v >= t)) return false
          } else if (op === '$lte') {
            if (!(v <= t)) return false
          } else if (op === '$ne') {
            if (v === t) return false
          } else if (op === '$in') {
            if (!target.includes(v)) return false
          } else if (op === '$nin') {
            if (target.includes(v)) return false
          } else return false
        }
      } else if (value !== condition) return false
    }
    return true
  }

  async function writeSnapshot() {
    var tmp = file + '.tmp'
    await fs.writeFile(tmp, JSON.stringify(data), 'utf8')
    await fs.rename(tmp, file)
    try {
      await fs.writeFile(walFile, '', 'utf8')
    } catch (e) {}
  }

  async function persist(force) {
    if (writing) {
      pending = true
      return drain
    }
    if (force && persistTimeout) {
      clearTimeout(persistTimeout)
      persistTimeout = null
    }
    if (!persistPromise) {
      persistPromise = new Promise(function (resolve) {
        var run = async function () {
          writing = true
          drain = new Promise(function (r) {
            resolveDrain = r
          })
          do {
            pending = false
            await writeSnapshot()
          } while (pending)
          writing = false
          if (resolveDrain) resolveDrain()
          persistPromise = null
          resolve()
        }
        if (force || debounceMs <= 0) run()
        else persistTimeout = setTimeout(run, debounceMs)
      })
    }
    return persistPromise
  }

  return {
    get(query, options) {
      var limit = (options && options.limit) || Infinity,
        skip = (options && options.skip) || 0,
        sort = options && options.sort,
        results = []
      for (var i = 0; i < data.length; i++)
        if (matches(data[i], query)) results.push(data[i])
      if (sort) {
        var keys = Object.keys(sort)
        results.sort(function (a, b) {
          for (var i = 0; i < keys.length; i++) {
            var k = keys[i],
              d = sort[k]
            if (a[k] === b[k]) continue
            return d === -1 ? (a[k] < b[k] ? 1 : -1) : a[k] > b[k] ? 1 : -1
          }
          return 0
        })
      }
      return results.slice(skip, skip + limit)
    },
    async set(query, values) {
      var id,
        entries = []
      if (values === undefined) {
        values = query
        values.id = values.id || crypto.randomUUID()
        id = values.id
        data.push(values)
        entries.push({ op: 'insert', data: values })
      } else if (values === null) {
        data = data.filter(function (d) {
          if (matches(d, query)) {
            entries.push({ op: 'delete', query: query })
            return false
          }
          return true
        })
      } else {
        for (var i = 0; i < data.length; i++)
          if (matches(data[i], query)) {
            Object.assign(data[i], values)
            entries.push({ op: 'update', query: query, data: values })
          }
      }
      if (entries.length)
        await fs.appendFile(
          walFile,
          entries.map(JSON.stringify).join('\n') + '\n',
          'utf8'
        )
      await persist()
      return id
    },
    async commit() {
      await persist(true)
    },
    get data() {
      return data
    },
    set data(v) {
      data = v
    }
  }
}

module.exports = sysdb
