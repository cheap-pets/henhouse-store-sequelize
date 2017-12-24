const TableNameMode = require('../constants/table-name-modes')
const FieldNameMode = require('../constants/field-name-modes')

function camelCase2Underline (name, mode) {
  let prefix = ''
  switch (mode) {
    case TableNameMode.TUNDERLINE:
      prefix = 't_'
      break
    case FieldNameMode.FUNDERLINE:
      prefix = 'f_'
      break
  }
  return prefix + name.replace(/([A-Z])/g, '_$1').toLowerCase()
}

module.exports = camelCase2Underline
