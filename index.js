var fs = require('node:fs/promises')
var fsSync = require('node:fs')
var crypto = require('node:crypto')

function sysdb(file) {
  var data = []
  var debounceMs = 5
  var queue = Promise.resolve()

  try {
    data = JSON.parse(fsSync.readFileSync(file, 'utf8'))
  } catch {
    data = []
  }

  function matches(doc, query) {
    for (var k in query) {
      var condition = query[k]
      var value = doc[k]

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

          if (op === '$gt' && !(v > t)) return false
          if (op === '$lt' && !(v < t)) return false
          if (op === '$gte' && !(v >= t)) return false
          if (op === '$lte' && !(v <= t)) return false
          if (op === '$ne' && v === t) return false
          if (op === '$in' && !target.includes(v)) return false
          if (op === '$nin' && target.includes(v)) return false
        }
      } else {
        if (value !== condition) return false
      }
    }
    return true
  }

  async function writeSnapshot() {
    var tmp = file + '.tmp'
    await fs.writeFile(tmp, JSON.stringify(data), 'utf8')
    await fs.rename(tmp, file)
  }

  function persist(force) {
    queue = queue.then(async function () {
      if (!force && debounceMs > 0)
        await new Promise(function (r) {
          setTimeout(r, debounceMs)
        })
      await writeSnapshot()
    })
    return queue
  }

  return {
    get(query, options) {
      var limit = (options && options.limit) || Infinity
      var skip = (options && options.skip) || 0
      var sort = options && options.sort
      var results = []

      for (var i = 0; i < data.length; i++)
        if (matches(data[i], query)) results.push(data[i])

      if (sort) {
        var keys = Object.keys(sort)
        results.sort(function (a, b) {
          for (var i = 0; i < keys.length; i++) {
            var k = keys[i]
            var d = sort[k]
            if (a[k] === b[k]) continue
            return d === -1 ? (a[k] < b[k] ? 1 : -1) : a[k] > b[k] ? 1 : -1
          }
          return 0
        })
      }

      return results.slice(skip, skip + limit)
    },

    async set(query, values) {
      var id

      if (values === undefined) {
        values = query
        values.id = values.id || crypto.randomUUID()
        id = values.id
        data.push(values)
      } else if (values === null) {
        data = data.filter(function (d) {
          return !matches(d, query)
        })
      } else {
        for (var i = 0; i < data.length; i++)
          if (matches(data[i], query)) Object.assign(data[i], values)
      }

      await persist(false)
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
