const Sequelize = require('sequelize')

const TableNameMode = require('./constants/table-name-modes')
const FieldNameMode = require('./constants/field-name-modes')

const defineModel = require('./define-model')
const accessModel = require('./access-model')

const { isString } = require('./utils/check-type')

function getSequelizeInstance (v) {
  return v instanceof Sequelize ? v : new Sequelize(v)
}

function getAccessProcedure (method) {
  let procedure
  switch (method) {
    case 'get':
      procedure = async (ctx, next, model, id) => {
        const data = await model.query(ctx.$queryOptions, id)
        ctx.body = JSON.stringify(data, function (key, value) {
          return (value === null) ? undefined : value
        })
      }
      break
    case 'post':
      procedure = async (ctx, next, model, id) => {
        ctx.body = await model.create(ctx.$requestBody)
      }
      break
    case 'put':
    case 'patch':
      procedure = async (ctx, next, model, id) => {
        await model.update(ctx.$requestBody, id)
        ctx.body = 'ok'
      }
      break
    case 'delete':
      procedure = async (ctx, next, model, id) => {
        ctx.body = await model.remove(id)
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
    const methods = options.methods || []
    model.methods = {}
    for (let i = 0, len = methods.length; i < len; i++) {
      const m = methods[i]
      isString(m) ? (model.methods[m] = getAccessProcedure(m)) : (model.methods[m.type] = m.method)
    }
    return model
  }
}

SequelizeStore.TableNameMode = TableNameMode
SequelizeStore.FieldNameMode = FieldNameMode

module.exports = SequelizeStore
