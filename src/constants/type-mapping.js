const Sequelize = require('sequelize')

module.exports = {
  BOOLEAN: {
    Sequelize: Sequelize.BOOLEAN
  },
  DATE: {
    Sequelize: Sequelize.DATE
  },
  FLOAT: {
    Sequelize: Sequelize.FLOAT
  },
  INTEGER: {
    Sequelize: Sequelize.INTEGER
  },
  STRING: {
    Sequelize: Sequelize.STRING
  },
  ID: {
    Sequelize: Sequelize.INTEGER
  },
  STRID: {
    Sequelize: Sequelize.STRING
  }
}
