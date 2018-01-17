const Henhouse = require('henhouse')
const SequelizeStore = require('../src')
const Types = Henhouse.DataTypes

const FlakeId = require('flake-idgen')
const id2Int = require('biguint-format')
const flakeIdGen = new FlakeId()

const request = require('request-promise-native')

const moment = require('moment')
moment.locale('zh-cn')

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
  // dialect: 'sqlite',
  host: 'localhost',
  port: 3306,
  dialect: 'mysql',
  database: 'noname',
  username: 'root',
  password: '999999',
  tableNameMode: SequelizeStore.TableNameMode.UNDERLINE,
  fieldNameMode: SequelizeStore.FieldNameMode.UNDERLINE,
  /*
  storage: resolve(__dirname, 'noname.db3'),
  pool: {
    max: 5,
    idle: 30000
  },
  */
  timezone: '+08:00',
  dialectOptions: {
    supportBigNumbers: true,
    bigNumberStrings: true
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
    name: Types.STRING,
    shortName: Types.STRING,
    memo: Types.STRING,
    isDisabled: Types.BOOLEAN,
    isRemoved: Types.BOOLEAN,
    createdAt: Types.DATE,
    updatedAt: Types.DATE,
    deletedAt: Types.DATE
  },
  {
    idGenerator: idGen,
    httpMethods: {
      get: async function (ctx, next, model, id) {
        const queryOptions = ctx.$sequelizeOptions || {}
        queryOptions.attributes = ['id', 'name', 'shortName', 'deletedAt']
        const data = await model.query(queryOptions, id)
        return data
      },
      post: true,
      patch: true
    },
    getterMethods: {
      fullName () {
        return 'xxx'
      }
    }
  }
)

const user = myService.define(
  sequelizeStore,
  'user',
  {
    id: {
      type: Types.ID,
      queryByDefault: false
    },
    phoneNumber: Types.INT,
    loginId: Types.STRING,
    name: Types.STRING,
    isRemoved: {
      type: Types.BOOLEAN,
      queryByDefault: false
    },
    createdAt: {
      type: Types.DATE,
      queryByDefault: false
    },
    updatedAt: {
      type: Types.DATE,
      queryByDefault: false
    }
  },
  {
    idGenerator: idGen,
    httpMethods: {
      get: true,
      post: true,
      patch: true
    }
  }
)

myService.define(
  sequelizeStore,
  'tenantUser',
  {
    id: Types.ID,
    tenant: {
      model: tenant
    },
    person: {
      model: user,
      foreignKey: 'userId',
      required: false
    },
    userAlias: Types.STRING,
    isAdministrator: Types.BOOLEAN,
    isDisabled: Types.BOOLEAN,
    isRemoved: Types.BOOLEAN,
    createdAt: {
      type: Types.DATE,
      queryByDefault: false
    },
    updatedAt: {
      type: Types.DATE,
      queryByDefault: false
    }
  },
  {
    idGenerator: idGen,
    httpMethods: {
      get: true,
      post: true,
      patch: true
    }
  }
)

myService.listen(3000)

async function testPostTenant () {
  const ret = await request({
    method: 'POST',
    url: 'http://localhost:3000/my-service/tenants',
    form: [
      {
        name: 'xx',
        shortName: 'x',
        x: true,
        deletedAt: moment('2018-1-13 23:00:00').toDate()
      },
      {
        name: 'yy',
        shortName: 'y'
      }
    ],
    json: true
  })
  return ret
}

async function testGetTenants () {
  const ret = await request('http://localhost:3000/my-service/tenants', {
    json: true
  })
  return ret
}

async function testPatchTenant (id) {
  await request({
    method: 'PATCH',
    url: 'http://localhost:3000/my-service/tenants/' + id,
    form: {
      name: 'yy'
    },
    json: true
  })
}

async function testGetTenantById (id) {
  const ret = await request('http://localhost:3000/my-service/tenants/' + id, {
    json: true
  })
  console.log(moment(ret.createAt).format('LLLL'))
  return ret
}

async function testPostUser () {
  const ret = await request({
    method: 'POST',
    url: 'http://localhost:3000/my-service/users',
    form: {
      name: '张三',
      phoneNumber: 18611027530
    }
  })
  return ret
}

async function testGetUsers () {
  const ret = await request('http://localhost:3000/my-service/users', {
    json: true
  })
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
  const ret = await request('http://localhost:3000/my-service/users/' + id, {
    json: true
  })
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
  const ret = await request(
    'http://localhost:3000/my-service/tenant-users?_fields=id,tenant.name,person.name&_limit=10&_offset=10&_order=-tenant.name,person.name',
    { json: true }
  )
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
  const ret = await request(
    'http://localhost:3000/my-service/tenant-users/' + id,
    { json: true }
  )
  return ret
}

async function test () {
  try {
    const tenantId = (await testPostTenant())[0]
    console.info('[info]', '租户数量', (await testGetTenants()).length)
    await testPatchTenant(tenantId)
    console.info(
      '[info]',
      '租户名称',
      (await testGetTenantById(tenantId)).tenantName
    )

    const userId = await testPostUser()
    console.info('[info]', '用户数量', (await testGetUsers()).length)
    await testPatchUser(userId)
    console.info('[info]', '用户名称', (await testGetUserById(userId)).userName)
    const tenantUserId = await testPostTenantUser(tenantId, userId)
    console.info(
      '[info]',
      '租户用户数量',
      (await testGetTenantUsers()).length
    )
    await testPatchTenantUser(tenantUserId)

    const v = await testGetTenantUserById(tenantUserId)
    console.info('[info]', '备注名称', v.userAlias)
    sequelizeStore.sequelize.close()
    myService.close()
  } catch (err) {
    console.error('[error]', err)
  }
}
test()
