const Sequelize = require('sequelize')

const TableNameMode = require('./constants/table-name-modes')
const FieldNameMode = require('./constants/field-name-modes')

const defineSequelizeModel = require('./define-sequelize-model')
const access = require('./model-access')

const { isString } = require('./utils/check-type')

function getSequelizeInstance (v) {
  return v instanceof Sequelize ? v : new Sequelize(v)
}

function getAccessProcedure (method) {
  let procedure
  switch (method) {
    case 'get':
      procedure = async (ctx, next, model, id) => {
        ctx.body = await model.query(ctx.attributesQueryArray, ctx.query, id)
      }
      break
    case 'post':
      procedure = async (ctx, next, model, id) => {
        ctx.body = await model.create(ctx.request.body)
      }
      break
    case 'put':
    case 'patch':
      procedure = async (ctx, next, model, id) => {
        await model.update(ctx.request.body, id)
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
    model.sequelizeModel = defineSequelizeModel(this.sequelize, modelName, attributes, options)
    model.idGenerator = options.idGenerator
    model.query = access.query
    if (options.canModify !== false) {
      model.create = access.create
      model.update = access.update
    }
    (options.canRemove !== false) && (model.remove = access.remove)
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
