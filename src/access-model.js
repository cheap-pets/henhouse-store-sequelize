const { isArray, isString } = require('./utils/check-type')

function getAllAttributes (sqlzModel) {
  const result = []
  const fields = {}
  for (let key in sqlzModel.attributes) {
    const item = sqlzModel.attributes[key]
    if (!fields[item.field]) {
      fields[item.field] = true
      result.push(key)
    }
  }
  return result
}

function getIncludeAttributes (associations, name, queryAttributes) {
  const item = associations[name]
  if (!item || !item.model.sequelizeModel) return false
  const sqlzModel = item.model.sequelizeModel
  const result = {
    model: sqlzModel,
    required: item.required,
    as: name
  }
  const { attributes, includes } = prepareAttributes(
    item.model,
    queryAttributes
  )
  attributes && (result.attributes = attributes)
  includes && (result.include = includes)
  return result
}

function prepareAttributes (model, queryAttributes) {
  const sqlzModel = model.sequelizeModel
  const len = queryAttributes.length
  let attributes = []
  const includeOptions = []
  for (let i = 0; i < len; i++) {
    const item = queryAttributes[i]
    if (isString(item)) {
      if (item === '*') {
        attributes = getAllAttributes(sqlzModel)
      } else if (sqlzModel.attributes[item]) {
        attributes.push(item)
      }
    } else if (item) {
      for (let key in item) {
        const include = getIncludeAttributes(model.associations, key, item[key])
        include && includeOptions.push(include)
      }
    }
  }
  const result = {}
  if (attributes) result.attributes = attributes
  if (includeOptions) result.include = includeOptions
  return result
}

async function prepareValues (data, model, isPostMethod) {
  const attributes = model.sequelizeModel.attributes
  const primaryKeyAttribute = model.sequelizeModel.primaryKeyAttribute
  const values = {}

  for (let key in attributes) {
    if (data[key] !== undefined) {
      values[key] = data[key]
    } else if (
      key === primaryKeyAttribute &&
      isPostMethod &&
      model.idGenerator
    ) {
      values[key] = await model.idGenerator()
    }
  }
  return values
}

async function prepareValuesArray (data, model, isPostMethod) {
  const valuesArray = []
  if (isArray(data)) {
    const count = data.length
    const primaryKeyAttribute = model.sequelizeModel.primaryKeyAttribute
    let ids
    if (isPostMethod && model.idGenerator && primaryKeyAttribute) {
      ids = await model.idGenerator(count)
    }
    for (let i = 0; i < count; i++) {
      const item = data[i]
      if (ids && ids.length > i && item[primaryKeyAttribute] === undefined) {
        item[primaryKeyAttribute] = ids[i]
      }
      valuesArray.push(await prepareValues(item, model))
    }
  } else {
    return prepareValues(data, model, isPostMethod)
  }
}

async function query (attributes, queryOptions, id) {
  queryOptions = queryOptions || {}
  let options = prepareAttributes(this, attributes || ['*'])
  if (id === undefined) {
    options.limit = queryOptions.limit || 100
    options.offset = queryOptions.offset || 0
  }
  const whereOptions = {}
  for (let p in queryOptions) {
    if (p === 'fields' || p === 'limit' || p === 'offset' || p === '_ts') {
      continue
    }
    whereOptions[p] = queryOptions[p]
  }
  if (Object.keys(whereOptions).length > 0) {
    options.where = whereOptions
  }
  const ret = id === undefined
    ? await this.sequelizeModel.findAll(options)
    : await this.sequelizeModel.findById(id, options)
  return ret
}

async function create (data) {
  const seqModel = this.sequelizeModel
  const primaryKey = seqModel.primaryKeyAttribute
  let ret
  if (isArray(data)) {
    const dataArr = await prepareValuesArray(data, this, true)
    ret = []
    for (let i = 0, len = dataArr.length; i < len; i++) {
      ret.push((await seqModel.create(dataArr[i]))[primaryKey])
    }
  } else {
    const modelData = await prepareValues(data, this, true)
    ret = (await seqModel.create(modelData))[primaryKey]
  }
  return ret
}

async function update (data, id) {
  const seqModel = this.sequelizeModel
  const primaryKey = seqModel.primaryKeyAttribute
  if (isArray(data)) {
    const dataArr = await prepareValuesArray(data, this)
    for (let i = 0, len = dataArr.length; i < len; i++) {
      const queryOptions = {}
      queryOptions[primaryKey] = dataArr[i][primaryKey]
      await seqModel.update(dataArr[i], { where: queryOptions })
    }
  } else {
    const updateData = await prepareValues(data, this)
    const queryOptions = {}
    queryOptions[primaryKey] = id === undefined ? data[primaryKey] : id
    await seqModel.update(updateData, { where: queryOptions })
  }
}

async function remove (id) {
  const seqModel = this.sequelizeModel
  const queryOptions = {}
  if (id !== undefined) queryOptions[seqModel.primaryKeyAttribute] = id
  await seqModel.destroy({ where: queryOptions })
}

module.exports = {
  query,
  create,
  update,
  remove
}
