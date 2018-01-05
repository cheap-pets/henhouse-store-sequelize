const Sequelize = require('sequelize')
const Op = Sequelize.Op

const { isArray } = require('./utils/check-type')

function getAllAttributes (sqlzModel, onlyWhitelist) {
  const result = []
  let includeAll = true
  for (let key in sqlzModel.attributes) {
    const item = sqlzModel.attributes[key]
    if (onlyWhitelist === false || item.whitelist !== false) {
      result.push(key)
    } else {
      includeAll = false
    }
  }
  return includeAll ? undefined : result
}

function prepareAttributes (sqlzModel, attributes) {
  let result = []
  for (let i = 0, len = attributes.length; i < len; i++) {
    const attr = attributes[i]
    if (attr === '*') {
      result = getAllAttributes(sqlzModel)
      break
    } else if (sqlzModel.attributes[attr]) {
      result.push(attr)
    }
  }
  return result
}

function convertConditionValueType (value, type) {
  switch (type) {
    case 'INTEGER':
      value = parseInt(value)
      break
    case 'FLOAT':
    case 'DOUBLE':
      value = parseFloat(value)
      break
  }
  return value
}

function prepareConditions (sqlzModel, conditions) {
  let result = {}
  for (let i = 0, len = conditions.length; i < len; i++) {
    const item = conditions[i]
    for (let key in item) {
      if (!sqlzModel.attributes[key]) continue
      const type = sqlzModel.attributes[key].type.constructor.name
      let value = item[key]
      let op = Op.eq
      if (value[0] === '(' && value[value.length - 1] === ')') {
        op = Op.between
        value = value.substr(1, value.length - 2)
      }
      let arr = value.split(',')
      if (arr.length > 1) {
        op = op === Op.between && arr.length === 2 ? Op.between : Op.in
        value = []
        for (let j = 0, len = arr.length; j < len; j++) {
          value.push(convertConditionValueType(arr[i], type))
        }
      } else {
        if (value[0] === '*') {
          op = Op.like
          value = '%' + value.substr(1)
        }
        if (value[value.length - 1] === '*') {
          op = Op.like
          value = value.substr(0, value.length - 1) + '%'
        }
        value = convertConditionValueType(value, type)
      }
      result[key] = {
        [op]: value
      }
    }
  }
  return result
}

function prepareOrders (sqlzModel, orders) {
  let result = []
  for (let i = 0, len = orders.length; i < len; i++) {
    let orderOption = []
    let attr = orders[i]
    let isDesc = false
    if (attr[0] === '-') {
      attr = attr.substr(1)
      isDesc = true
    }
    if (sqlzModel.attributes[attr]) {
      orderOption.push(attr)
      if (isDesc) orderOption.push('desc')
      result.push(orderOption)
    }
  }
  return result
}

function prepareQueryOptions (model, queryOptions) {
  const result = {}
  const { attributes, conditions, orders, associations } = queryOptions
  if (attributes && attributes.length) {
    const validAttrs = prepareAttributes(model.sequelizeModel, attributes)
    validAttrs && (result.attributes = validAttrs)
  }
  if (conditions && conditions.length) {
    result.where = prepareConditions(model.sequelizeModel, conditions)
  }
  if (orders && orders.length) {
    result.order = prepareOrders(model.sequelizeModel, orders)
  }
  if (associations) {
    const includeOptions = []
    for (let key in associations) {
      const association = model.associations[key]
      if (!association) continue
      const associationModel = association.model
      const sqlzModel = associationModel.sequelizeModel
      if (!sqlzModel) continue

      const includeOption = prepareQueryOptions(
        associationModel,
        associations[key]
      )
      includeOption.model = sqlzModel
      includeOption.required = association.required
      includeOption.as = key

      includeOptions.push(includeOption)
    }
    includeOptions.length && (result.include = includeOptions)
  }
  return result
}

async function prepareSingleRecordValues (data, model, isPostMethod) {
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

async function prepareValues (data, model, isPostMethod) {
  let ret
  if (isArray(data)) {
    ret = []
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
      ret.push(await prepareValues(item, model))
    }
  } else {
    ret = await prepareSingleRecordValues(data, model, isPostMethod)
  }
  return ret
}

async function query (queryOptions, id) {
  queryOptions = queryOptions || { attributes: ['*'] }
  let options = prepareQueryOptions(this, queryOptions)
  if (id === undefined && queryOptions.limit !== 0) {
    options.limit = parseInt(queryOptions.limit || 100)
    options.offset = parseInt(queryOptions.offset || 0)
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
  const modelData = await prepareValues(data, this, true)
  if (isArray(modelData)) {
    ret = []
    for (let i = 0, len = modelData.length; i < len; i++) {
      ret.push((await seqModel.create(modelData[i]))[primaryKey])
    }
  } else {
    ret = (await seqModel.create(modelData))[primaryKey]
  }
  return ret
}

async function update (data, id) {
  const seqModel = this.sequelizeModel
  const primaryKey = seqModel.primaryKeyAttribute
  const modelData = await prepareValues(data, this)
  if (isArray(modelData)) {
    for (let i = 0, len = modelData.length; i < len; i++) {
      const queryOptions = {}
      queryOptions[primaryKey] = modelData[i][primaryKey]
      await seqModel.update(modelData[i], { where: queryOptions })
    }
  } else {
    const queryOptions = {}
    queryOptions[primaryKey] = id === undefined ? data[primaryKey] : id
    await seqModel.update(modelData, { where: queryOptions })
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
