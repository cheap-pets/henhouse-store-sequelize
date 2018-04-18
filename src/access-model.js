const { isArray } = require('./utils/check-type')

async function query (options, id) {
  options = options || {}
  if (id === undefined && options.limit !== 0) {
    options.limit = options.limit || 100
    options.offset = options.offset || 0
  }
  let ret
  if (id === undefined) {
    ret = await this.sequelizeModel.findAll(options)
  } else {
    ret = await this.sequelizeModel.findById(id, options)
  }
  return ret
}

async function create (data) {
  const seqModel = this.sequelizeModel
  const primaryKey = seqModel.primaryKeyAttribute
  let ret
  if (isArray(data)) {
    ret = []
    const arr = await seqModel.bulkCreate(data)
    for (let i = 0, len = arr.length; i < len; i++) {
      ret.push(arr[primaryKey])
    }
  } else {
    ret = (await seqModel.create(data))[primaryKey]
  }
  return ret
}

async function update (data, options, id) {
  const seqModel = this.sequelizeModel
  const primaryKey = seqModel.primaryKeyAttribute
  options = options || {}
  !options.where && (options.where = {})
  if (isArray(data)) {
    for (let i = 0, len = data.length; i < len; i++) {
      options.where[primaryKey] = data[i][primaryKey]
      await seqModel.update(data[i], options)
    }
  } else {
    const primaryKeyValue = id === undefined
      ? data[primaryKey]
      : id
    ;(primaryKeyValue !== undefined) && (options.where[primaryKey] = primaryKeyValue)
    await seqModel.update(data, options)
  }
}

async function remove (queryOptions, id) {
  await this.sequelizeModel.destroy(queryOptions)
}

module.exports = {
  query,
  create,
  update,
  remove
}
