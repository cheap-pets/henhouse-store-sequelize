const Sequelize = require('sequelize')

const TableNameMode = require('./constants/table-name-modes')
const FieldNameMode = require('./constants/field-name-modes')

const defineSequelizeModel = require('./define-sequelize-model')
const defaultMethods = require('./model-methods')

const { isString } = require('./utils/check-type')

function getSequelizeInstance (v) {
  return v instanceof Sequelize ? v : new Sequelize(v)
}

class SequelizeStore {
  constructor (options) {
    this.tableNameMode = options.tableNameMode || TableNameMode.CAMELCASE
    this.fieldNameMode = options.fieldNameMode || FieldNameMode.CAMELCASE
    this.sequelize = getSequelizeInstance(options)
  }
  define (modelName, attributes, options) {
    const model = {}
    options.tableNameMode = options.tableNameMode || this.tableNameMode
    options.fieldNameMode = options.fieldNameMode || this.fieldNameMode
    model.sequelizeModel = defineSequelizeModel(this.sequelize, modelName, attributes, options)
    model.idGenerator = options.idGenerator
    const methods = options.methods || []
    model.methods = {}
    for (let i = 0, len = methods.length; i < len; i++) {
      const m = methods[i]
      isString(m) ? (model.methods[m] = defaultMethods[m]) : (model.methods[m.type] = m.methods)
    }
    return model
  }
}

SequelizeStore.TableNameMode = TableNameMode
SequelizeStore.FieldNameMode = FieldNameMode

module.exports = SequelizeStore
