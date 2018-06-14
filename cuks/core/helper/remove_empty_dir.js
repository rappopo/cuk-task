'use strict'

const deleteEmpty = require('delete-empty')

module.exports = function(cuk) {

  return (dir) => {
    return deleteEmpty.sync(dir)
  }

}