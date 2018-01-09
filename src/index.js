const Sequelize = require('sequelize')

const TableNameMode = require('./constants/table-name-modes')
const FieldNameMode = require('./constants/field-name-modes')

const defineModel = require('./define-model')
const accessModel = require('./access-model')

const { isFunction } = require('./utils/check-type')

function getSequelizeInstance (v) {
  return v instanceof Sequelize ? v : new Sequelize(v)
}

function getCustomizedProcedure (model, option, preset) {
  let procedure
  if (isFunction(option)) {
    procedure = option
  } else if (preset && option[preset]) {
    procedure = option[preset]
  }
  return procedure
}

function getAccessProcedure (method, option) {
  let procedure
  switch (method) {
    case 'get':
      procedure = async (ctx, next, model, id) => {
        const preset = ctx.$queryOptions ? ctx.$queryOptions.preset : undefined
        const proc = getCustomizedProcedure(model, option, preset) || model.query
        const data = await proc.call(model, ctx.$queryOptions, id)
        ctx.body = JSON.stringify(data, function (key, value) {
          return (value === null) ? undefined : value
        })
        ctx.type = 'application/json; charset=utf-8'
      }
      break
    case 'post':
      procedure = async (ctx, next, model) => {
        const preset = ctx.$queryOptions ? ctx.$queryOptions.preset : undefined
        const proc = getCustomizedProcedure(model, option, preset) || model.create
        ctx.body = await proc.call(model, ctx.$queryOptions, ctx.$requestBody)
      }
      break
    case 'put':
    case 'patch':
      procedure = async (ctx, next, model, id) => {
        const preset = ctx.$queryOptions ? ctx.$queryOptions.preset : undefined
        const proc = getCustomizedProcedure(model, option, preset) || model.update
        await proc.call(model, ctx.$queryOptions, ctx.$requestBody, id)
        ctx.body = 'ok'
      }
      break
    case 'delete':
      procedure = async (ctx, next, model, id) => {
        const preset = ctx.$queryOptions ? ctx.$queryOptions.preset : undefined
        const proc = getCustomizedProcedure(model, option, preset) || model.remove
        await proc.call(model, ctx.$queryOptions, id)
        ctx.body = 'ok'
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
    const model = {}
    options = options || {}
    options.tableNameMode = options.tableNameMode || this.tableNameMode
    options.fieldNameMode = options.fieldNameMode || this.fieldNameMode
    const { sequelizeModel, associations } = defineModel(this.sequelize, modelName, attributes, options)
    model.sequelizeModel = sequelizeModel
    model.associations = associations
    model.idGenerator = options.idGenerator
    model.query = accessModel.query
    if (options.canModify !== false) {
      model.create = accessModel.create
      model.update = accessModel.update
    }
    (options.canRemove !== false) && (model.remove = accessModel.remove)

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
