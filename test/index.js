const Henhouse = require('henhouse')
const SequelizeStore = require('../src')

const { resolve } = require('path')
const FlakeId = require('flake-idgen')

const request = require('request-promise-native')

const Types = Henhouse.DataTypes
const flakeIdGen = new FlakeId()
const id2Int = require('biguint-format')

function idGen (count) {
  let ret
  if (count) {
    ret = []
    for (let i = 0; i < count; i++) {
      ret.push(id2Int(flakeIdGen.next(), 'dec'))
    }
  } else ret = id2Int(flakeIdGen.next(), 'dec')
  return ret
}

const myService = new Henhouse({
  servicePath: 'my-service'
})
const sequelizeStore = new SequelizeStore({
  dialect: 'sqlite',
  tableNameMode: SequelizeStore.TableNameMode.UNDERLINE,
  fieldNameMode: SequelizeStore.FieldNameMode.UNDERLINE,
  storage: resolve(__dirname, 'noname.db3'),
  pool: {
    max: 5,
    idle: 30000
  }
})
/*
myService.sequelize
  .authenticate()
  .then(() => {
    console.log('Connection is ok.')
  })
  .catch(err => {
    console.error('Connection is bad.', err)
  })
*/
const tenant = myService.define(
  sequelizeStore,
  'tenant',
  {
    id: Types.ID,
    tenantName: Types.STRING,
    shortName: Types.STRING,
    memo: Types.STRING,
    isDisabled: Types.BOOLEAN,
    isRemoved: Types.BOOLEAN,
    createdAt: Types.DATE,
    updatedAt: Types.DATE
  },
  {
    idGenerator: idGen,
    methods: ['get', 'post', 'put', 'patch']
  }
).sequelizeModel

const user = myService.define(
  sequelizeStore,
  'user',
  {
    id: Types.ID,
    phoneNumber: Types.INT,
    loginId: Types.STRING,
    userName: Types.STRING,
    isRemoved: Types.BOOLEAN,
    createdAt: Types.DATE,
    updatedAt: Types.DATE
  },
  {
    idGenerator: idGen,
    methods: ['get', 'post', 'put', 'patch']
  }
).sequelizeModel

const tenantUser = myService.define(
  sequelizeStore,
  'tenantUser',
  {
    id: Types.ID,
    tenantId: {
      type: Types.INTEGER,
      references: {
        model: 'tenant',
        key: 'id'
      }
    },
    userId: {
      type: Types.INTEGER,
      references: {
        model: 'user',
        key: 'id'
      }
    },
    userAlias: Types.STRING,
    isAdmin: Types.BOOLEAN,
    isDisabled: Types.BOOLEAN,
    isRemoved: Types.BOOLEAN,
    createdAt: Types.DATE,
    updatedAt: Types.DATE
  },
  {
    idGenerator: idGen,
    methods: ['get', 'post', 'put', 'patch']
  }
).sequelizeModel
tenantUser.belongsTo(tenant)
tenantUser.belongsTo(user)

myService.listen(3000)

async function testPostTenant () {
  const ret = await request({
    method: 'POST',
    url: 'http://localhost:3000/my-service/tenants',
    form: {
      tenantName: 'xx',
      shortName: 'x'
    }
  })
  return ret
}

async function testGetTenants () {
  const ret = await request('http://localhost:3000/my-service/tenants', { json: true })
  return ret
}

async function testPatchTenant (id) {
  await request({
    method: 'PATCH',
    url: 'http://localhost:3000/my-service/tenants/' + id,
    form: {
      tenantName: 'yy'
    }
  })
}

async function testGetTenantById (id) {
  const ret = await request('http://localhost:3000/my-service/tenants/' + id, { json: true })
  return ret
}

async function testPostUser () {
  const ret = await request({
    method: 'POST',
    url: 'http://localhost:3000/my-service/users',
    form: {
      userName: '张三',
      phoneNumber: 18611027530
    }
  })
  return ret
}

async function testGetUsers () {
  const ret = await request('http://localhost:3000/my-service/users', { json: true })
  return ret
}

async function testPatchUser (id) {
  await request({
    method: 'PATCH',
    url: 'http://localhost:3000/my-service/users/' + id,
    form: {
      name: '李四'
    }
  })
}

async function testGetUserById (id) {
  const ret = await request('http://localhost:3000/my-service/users/' + id, { json: true })
  return ret
}

async function testPostTenantUser (tenantId, userId) {
  const ret = await request({
    method: 'POST',
    url: 'http://localhost:3000/my-service/tenant-users',
    form: {
      tenantId,
      userId,
      userAlias: '大张三'
    }
  })
  return ret
}

async function testGetTenantUsers () {
  const ret = await request('http://localhost:3000/my-service/tenant-users?fields=*,user(id, userName)', { json: true })
  return ret
}

async function testPatchTenantUser (id) {
  await request({
    method: 'PATCH',
    url: 'http://localhost:3000/my-service/tenant-users/' + id,
    form: {
      userAlias: '大李四'
    }
  })
}

async function testGetTenantUserById (id) {
  const ret = await request('http://localhost:3000/my-service/tenant-users/' + id, { json: true })
  return ret
}

async function test () {
  try {
    const tenantId = await testPostTenant()
    console.info('[info]', '租户数量', (await testGetTenants()).length)
    await testPatchTenant(tenantId)
    console.info('[info]', '租户名称', (await testGetTenantById(tenantId)).userName)

    const userId = await testPostUser()
    console.info('[info]', '用户数量', (await testGetUsers()).length)
    await testPatchUser(userId)
    console.info('[info]', '用户名称', (await testGetUserById(userId)).userName)

    const tenantUserId = await testPostTenantUser(tenantId, userId)
    console.info('[info]', '租户用户数量', (await testGetTenantUsers(tenantId)).length)
    await testPatchTenantUser(tenantUserId)
    const v = (await testGetTenantUserById(tenantUserId))
    console.info('[info]', '备注名称', v.userAlias)
  } catch (err) {
    console.error('[error]', err)
  }
}
test()
