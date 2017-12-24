exports.isArray = function isArray (obj) {
  return Object.prototype.toString.call(obj) === '[object Array]'
}

exports.isFunction = function isFunction (obj) {
  return Object.prototype.toString.call(obj) === '[object Function]'
}

exports.isPlainObject = function isPlainObject (v) {
  return Object.prototype.toString.call(v) === '[object Object]'
}

exports.isString = function isString (v) {
  return Object.prototype.toString.call(v) === '[object String]'
}
