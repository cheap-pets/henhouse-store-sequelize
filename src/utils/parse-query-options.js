const Sequelize = require('sequelize')
const Op = Sequelize.Op

const { isString, isArray } = require('../utils/check-type')

function combineAttribute (options, model, attribute) {
  const arr = attribute.split('.')
  for (let i = 0, len = arr.length; i < len; i++) {
    const attr = arr[i].trim()
    if (i === len - 1) {
      !options.attributes && (options.attributes = [])
      options.attributes.push(attr)
    } else {
      !options.associations && (options.associations = {})
      !options.associations[attr] && (options.associations[attr] = {})
      options = options.associations[attr]
    }
  }
}

function combineAttributes (options, model, attributes) {
  for (let i = 0, len = attributes.length; i < len; i++) {
    const field = attributes[i].trim()
    if (field === '') continue
    combineAttribute(options, model, field)
  }
}

function combineCondition (options, model, key, value) {
  const arr = key.split('.')
  for (let i = 0, len = arr.length; i < len; i++) {
    const attr = arr[i].trim()
    if (i === len - 1) {
      !options.conditions && (options.conditions = [])
      options.conditions.push({
        [attr]: value
      })
    } else {
      !options.associations && (options.associations = {})
      !options.associations[attr] && (options.associations[attr] = {})
      options = options.associations[attr]
    }
  }
}

function combineConditions (options, model, conditions) {
  for (const key in conditions) {
    let value = conditions[key]
    isString(value) && (value = value.trim())
    combineCondition(options, model, key, value)
  }
}

function combineOrder (options, model, field, isDesc) {
  const arr = field.split('.')
  for (let i = 0, len = arr.length; i < len; i++) {
    const attr = arr[i].trim()
    if (i === len - 1) {
      !options.orders && (options.orders = [])
      options.orders.push(isDesc ? '-' + attr : attr)
    } else {
      !options.associations && (options.associations = {})
      !options.associations[attr] && (options.associations[attr] = {})
      options = options.associations[attr]
    }
  }
}

function combineOrders (options, model, orders) {
  for (let i = 0, len = orders.length; i < len; i++) {
    let field = orders[i].trim()
    let isDesc = false
    if (field[0] === '-') {
      field = field.substr(1)
      isDesc = true
    }
    if (field === '') continue
    combineOrder(options, model, field, isDesc)
  }
}

function getAllAttributes (sqlzModel) {
  const result = []
  let includeAll = true
  for (let key in sqlzModel.attributes) {
    const item = sqlzModel.attributes[key]
    if (item.queryByDefault !== false) {
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
    case Sequelize.INTEGER:
    case Sequelize.BIGINT:
      value = parseInt(value)
      break
    case 'FLOAT':
    case 'DOUBLE':
    case Sequelize.FLOAT:
    case Sequelize.DOUBLE:
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
      let arr = isArray(value) ? value : value.split(',')
      if (arr.length > 1) {
        op = op === Op.between && arr.length === 2 ? Op.between : Op.in
        value = []
        for (let j = 0, len = arr.length; j < len; j++) {
          value.push(convertConditionValueType(arr[j], type))
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

function prepareOrders (model, orders, root, modelsPath) {
  const sqlzModel = model.sequelizeModel
  for (let i = 0, len = orders.length; i < len; i++) {
    let field = orders[i]
    let isDesc = false
    if (field[0] === '-') {
      field = field.substr(1)
      isDesc = true
    }
    const rawField = sqlzModel.attributes[field]
    if (rawField) {
      let literal = (modelsPath || []).concat([rawField.field]).join('.')
      if (
        sqlzModel.sequelize.connectionManager.dialectName === 'mysql' &&
        rawField.type.constructor.name === 'STRING'
      ) {
        literal = 'convert(' + literal + ' using gbk)'
      }
      if (isDesc) {
        literal += ' desc'
      }
      !root.order && (root.order = [])
      root.order.push(Sequelize.literal(literal))
    }
  }
}

function convert2SqlzOptions (model, options, root, modelsPath) {
  const result = {}
  !root && (root = result)
  const { attributes, conditions, associations, orders } = options
  if (attributes && attributes.length) {
    const validAttrs = prepareAttributes(model.sequelizeModel, attributes)
    validAttrs && (result.attributes = validAttrs)
  }
  if (conditions && conditions.length) {
    result.where = prepareConditions(model.sequelizeModel, conditions)
  }
  if (orders && orders.length) {
    prepareOrders(model, orders, root, modelsPath || [model.sequelizeModel.name])
  }
  if (associations) {
    const includeOptions = []
    for (let key in associations) {
      const association = model.associations[key]
      if (!association) continue
      const associationModel = association.model
      const sqlzModel = associationModel.sequelizeModel
      if (!sqlzModel && model.sequelizeModel.sequelize !== sqlzModel.sequelize) continue
      const includeOption = convert2SqlzOptions(
        associationModel,
        associations[key],
        root,
        (modelsPath || []).concat([key])
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

function parseQueryOptions (ctx, model) {
  const combinedOptions = {}
  ctx.$fields && combineAttributes(combinedOptions, model, ctx.$fields)
  ctx.$query && combineConditions(combinedOptions, model, ctx.$query)
  ctx.$order && combineOrders(combinedOptions, model, ctx.$order)

  const result = convert2SqlzOptions(model, combinedOptions)
  ctx.$limit !== undefined && (result.limit = ctx.$limit)
  ctx.$offset !== undefined && (result.offset = ctx.$offset)
  return result === {} ? null : result
}

module.exports = parseQueryOptions
