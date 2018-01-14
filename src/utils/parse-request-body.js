async function prepareValues (data, model, isPostMethod) {
  const attributes = model.sequelizeModel.attributes
  const primaryKeyAttribute = model.sequelizeModel.primaryKeyAttribute
  const values = {}

  for (let key in attributes) {
    if (data[key] !== undefined) {
      values[key] = data[key]
    } else if (
      key === primaryKeyAttribute &&
      isPostMethod &&
      model.idGenerator
    ) {
      values[key] = await model.idGenerator()
    }
  }
  return values
}

async function prepareValuesArray (arr, model, isPostMethod) {
  const ret = []
  const count = arr.length
  const primaryKeyAttribute = model.sequelizeModel.primaryKeyAttribute
  let ids
  if (isPostMethod && model.idGenerator && primaryKeyAttribute) {
    ids = await model.idGenerator(count)
  }
  for (let i = 0; i < count; i++) {
    const data = arr[i]
    if (ids && ids.length > i && data[primaryKeyAttribute] === undefined) {
      data[primaryKeyAttribute] = ids[i]
    }
    ret.push(await prepareValues(data, model))
  }
  return ret
}

async function parseRequestBody (data, model, isPostMethod) {
  let result = []
  let isArray = true
  let i = 0
  for (let key in data) {
    if (parseInt(key) !== i) {
      isArray = false
      result = data
      break
    }
    i++
    result.push(data[key])
  }
  result = isArray
    ? await prepareValuesArray(result, model, isPostMethod)
    : await prepareValues(result, model, isPostMethod)
  return result
}

module.exports = parseRequestBody
