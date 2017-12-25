const { isArray, isString } = require('./utils/check-type')

function prepareAttributes (model, queryAttributes) {
  const sequelize = model.sequelize
  const len = queryAttributes.length
  let attributes = []
  const includes = []
  for (let i = 0; i < len; i++) {
    const attr = queryAttributes[i]
    if (isString(attr)) {
      if (attr === '*') {
        attributes = attributes.concat(Object.keys(model.attributes))
      } else if (model.attributes[attr]) {
        attributes.push(attr)
      }
    } else if (attr.model) {
      const includeModel = sequelize.models[attr.model]
      if (includeModel) {
        const includeOptions = prepareAttributes(includeModel, attr.attributes)
        const include = {
          model: includeModel,
          attributes: includeOptions.attributes,
          required: true
        }
        if (includeOptions.includes) {
          include.include = includeOptions.includes
        }
        includes.push(include)
      }
    }
  }
  const result = {}
  if (attributes) result.attributes = attributes
  if (includes) result.include = includes
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
  const seqModel = this.sequelizeModel
  let options = prepareAttributes(seqModel, attributes || ['*'])
  if (id === undefined) {
    options.limit = queryOptions.limit || 100
    options.offset = queryOptions.offset || 0
  }
  const whereOptions = {}
  for (let p in queryOptions) {
    if (p === 'fields' || p === 'limit' || p === 'offset' || p === '_ts') { continue }
    whereOptions[p] = queryOptions[p]
  }
  if (Object.keys(whereOptions).length > 0) {
    options.where = whereOptions
  }
  const ret = id === undefined
    ? await seqModel.findAll(options)
    : await seqModel.findById(id, options)
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
