const Types = require('henhouse').DataTypes

const TypeMapping = require('./constants/type-mapping')
const TableNameMode = require('./constants/table-name-modes')
const FieldNameMode = require('./constants/field-name-modes')

const camelCase2Underline = require('./utils/camel-case-to-underline')

function convert2SequelizeType (localType) {
  return TypeMapping[localType].Sequelize
}

function defineModel (sequelize, name, attributes, options) {
  const tableNameMode = options.tableNameMode
  const fieldNameMode = options.fieldNameMode

  const defineOptions = Object.assign(
    {
      freezeTableName: true,
      tableName: tableNameMode === TableNameMode.CAMELCASE
        ? name
        : camelCase2Underline(name, tableNameMode),
      createdAt: false,
      updatedAt: false,
      deletedAt: false
    },
    options.sequelizeDefineOptions
  )

  const attributesOptions = {}
  Object.keys(attributes).forEach(attr => {
    const v = attributes[attr]
    const attrOptions = typeof v === 'string' ? { type: v } : v

    // field name
    !attrOptions.field &&
      fieldNameMode !== FieldNameMode.CAMELCASE &&
      (attrOptions.field = camelCase2Underline(attr, fieldNameMode))
    // primary key
    if (
      attr === 'id' ||
      attrOptions.type === Types.ID ||
      attrOptions.type === Types.STRID
    ) {
      attrOptions.primaryKey = true
      // it can be find in model.primaryKeyField
    }
    // field type
    attrOptions.rawType = attrOptions.type
    typeof attrOptions.type === 'string' &&
      (attrOptions.type = convert2SequelizeType(attrOptions.type))

    // createdAt && updatedAt
    if (attr === 'createdAt' || attrOptions.createdAt) {
      defineOptions.createdAt = attrOptions.field
    } else if (attr === 'updatedAt' || attrOptions.updatedAt) {
      defineOptions.updatedAt = attrOptions.field
    }

    attributesOptions[attr] = attrOptions
  })

  return sequelize.define(name, attributesOptions, defineOptions)
}

module.exports = defineModel
