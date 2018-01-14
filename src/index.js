const Sequelize = require('sequelize')

const TableNameMode = require('./constants/table-name-modes')
const FieldNameMode = require('./constants/field-name-modes')

const defineModel = require('./define-model')
const accessModel = require('./access-model')

const parseQueryOptions = require('./utils/parse-query-options')
const parseRequestBody = require('./utils/parse-request-body')

const { isFunction } = require('./utils/check-type')

function getSequelizeInstance (v) {
  return v instanceof Sequelize ? v : new Sequelize(v)
}

function getCustomizedProcedure (model, option, preset) {
  let procedure
  if (isFunction(option)) {
    procedure = option
  } else if (option && isFunction(option[preset || 'default'])) {
    procedure = option[preset || 'default']
  }
  return procedure
}

function getAccessProcedure (method, option) {
  let procedure
  switch (method) {
    case 'get':
      procedure = async (ctx, next, model, id) => {
        (!ctx.$fields && ctx.$query) && (ctx.$fields = ['*'])
        ctx.$sequelizeOptions = parseQueryOptions(ctx, model)
        const proc = getCustomizedProcedure(model, option, ctx.$preset)
        let data
        if (proc) {
          data = await proc(ctx, next, model, id)
        } else {
          data = await model.query(ctx.$sequelizeOptions, id)
        }
        ctx.type = 'application/json; charset=utf-8'
        ctx.body = JSON.stringify(data, function (key, value) {
          return value === null ? undefined : value
        })
      }
      break
    case 'post':
      procedure = async (ctx, next, model) => {
        ctx.$sequelizeOptions = parseQueryOptions(ctx, model)
        ctx.$sequelizeData = await parseRequestBody(ctx.request.body, model, true)
        const proc = getCustomizedProcedure(model, option, ctx.$preset)
        let result
        if (proc) {
          result = await proc.call(ctx, next, model)
        } else {
          result = await model.create(ctx.$sequelizeData)
        }
        ctx.body = result || 'ok'
      }
      break
    case 'put':
    case 'patch':
      procedure = async (ctx, next, model, id) => {
        ctx.$sequelizeOptions = parseQueryOptions(ctx, model)
        ctx.$sequelizeData = await parseRequestBody(ctx.request.body, model)
        const proc = getCustomizedProcedure(model, option, ctx.$preset)
        let result
        if (proc) {
          result = await proc(ctx, next, model, id)
        } else {
          result = await model.update(ctx.$sequelizeData, ctx.$sequelizeOptions, id)
        }
        ctx.body = result || 'ok'
      }
      break
    case 'delete':
      procedure = async (ctx, next, model, id) => {
        if (id !== undefined) {
          !ctx.$query && (ctx.$query = {})
          ctx.$query[model.sequelizeModel.primaryKeyAttribute] = id
        }
        ctx.$sequelizeOptions = parseQueryOptions(ctx, model)
        const proc = getCustomizedProcedure(model, option, ctx.$preset)
        let result
        if (proc) {
          result = await proc(ctx, next, model, id)
        } else {
          result = await model.remove(ctx.$sequelizeOptions)
        }
        ctx.body = result || 'ok'
      }
      break
  }
  return procedure
}

class SequelizeStore {
  constructor (options) {
    this.tableNameMode = options.tableNameMode || TableNameMode.CAMELCASE
    this.fieldNameMode = options.fieldNameMode || FieldNameMode.CAMELCASE
    this.sequelize = getSequelizeInstance(options)
  }
  define (modelName, attributes, options) {
    const model = {
      attributes
    }
    options = options || {}
    options.path && (model.path = options.path)
    options.tableNameMode = options.tableNameMode || this.tableNameMode
    options.fieldNameMode = options.fieldNameMode || this.fieldNameMode

    const { sequelizeModel, associations } = defineModel(
      this.sequelize,
      modelName,
      attributes,
      options
    )

    model.sequelizeModel = sequelizeModel
    model.associations = associations
    model.idGenerator = options.idGenerator
    model.query = accessModel.query
    if (options.readonly !== true) {
      model.create = accessModel.create
      model.update = accessModel.update
      options.removable && (model.remove = accessModel.remove)
    }

    model.methods = {}
    for (let key in options.httpMethods) {
      const value = options.httpMethods[key]
      value && (model.methods[key] = getAccessProcedure(key, value))
    }
    return model
  }
}

SequelizeStore.TableNameMode = TableNameMode
SequelizeStore.FieldNameMode = FieldNameMode

module.exports = SequelizeStore
