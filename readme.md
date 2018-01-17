# henhouse-store-sequelize
a store plugin for henhouse, access data by sequelize



## Installation

Install using [npm](https://www.npmjs.org/):

```sh
npm install henhouse-store-sequelize
```



## API Reference

### constructor

``` javascript
const sequelizeStore = new SequelizeStore(options)
```

#### options
| option        | Type                         | Description                         |
| ------------- | ---------------------------- | ----------------------------------- |
| tableNameMode | SequelizeStore.TableNameMode | CAMELCASE、 UNDERLINE、 TUNDERLINE    |
| fieldNameMode | SequelizeStore.FieldNameMode | CAMELCASE、 UNDERLINE、 TUNDERLINE    |
| ...           |                              | other Sequelize constructor options |

example:

```javascript
const sequelizeStore = new SequelizeStore({
  dialect: 'mysql', // connect to mysql database
  host: 'localhost',
  port: 3306,
  database: 'noname',
  username: 'root',
  password: '999999',
  timezone: '+08:00',
  dialectOptions: { // if fields got a big number value
    supportBigNumbers: true,
    bigNumberStrings: true
  },
  tableNameMode: SequelizeStore.TableNameMode.TUNDERLINE, // table name as "t_my_table"
  fieldNameMode: SequelizeStore.FieldNameMode.FUNDERLINE // field name as "f_my_field"
})
```



### define model

```javascript
const store = new SequelizeStore(options)
const myService = new Henhouse(options)
const Model = myService.define(store, modelName, attributes, options)
```



#### Model

| member         | Type            | Description                         |
| -------------- | --------------- | ----------------------------------- |
| sequelizeModel | Sequelize.Model | raw sequelize model                 |
| associations   | []              | associated models                   |
| methods        | {}              | group of functions via http request |

**methods:**

* query(sequelizeOptions, id)
* create(modelData)
* update(modelData, sequelizeOptions, id)
* remove(sequelizeOptions, id)



#### define sample

```javascript
const Types = Henhouse.DataTypes

const sequelizeStore = new SequelizeStore({
  ...
})

const myService = new Henhouse({
  servicePath: 'my-service'
})
const User = myService.define(
  sequelizeStore, // store, like a data source
  'user', // model name
  { // fields section
    id: Types.ID,
    phoneNumber: Types.INT,
    loginId: Types.STRING,
    name: Types.STRING,
    isRemoved: {
      type: Types.BOOLEAN,
      queryByDefault: false // do not query this field by default
    },
    createdAt: { // sequelize createdAt feature
      type: Types.DATE,
      queryByDefault: false
    },
    updatedAt: { // sequelize At feature
      type: Types.DATE,
      queryByDefault: false
    }
  },
  {
    path: 'users', // model name + 's' by default
    idGenerator: idGen, // generate id value by a external asynchronous function
    readonly: false, // false by default, without create / update function when true
    removable: false, //false by default, without remove function when false
    httpMethods: { // auto bind routers to default access procedures of the model
      get: true, // bind get method, access by get->http://localhost/my-service/user
      post: true, // bind post method
      put: true, // bind put method
      patch: true // bind patch method
      delete: true, // bind delete method
    }
  }
)
```

#### with associations

```javascript
const TenantUser = myService.define(
  sequelizeStore,
  'tenantUser',
  {
    id: Types.ID,
    tenant: {
      model: tenant
      // foreignKey: 'tenantId' by default
      // required: true by default, query table by inner join
    },
    person: {
      model: user,
      foreignKey: 'userId',
      required: false // query table by left outter join
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
```



#### customized methods

```javascript
const User = myService.define(sequelizeStore,
  'user',
  {
    ...
  },
  {
    httpMethods: {
      get: function (ctx, next, model, id) {
        // put your code here
        // id should exist when request '/users/:id'
      },
      post: {
        default: true, // access default create procedure when post through '/users'
        default: function (ctx, next, model, id) {
          // '/users/'
        },
        myPreset1: function (ctx, next, model, id) {
          // '/users?_preset=myPreset1'
        },
        myPreset2: function (ctx, next, model, id) {
          // '/users?_preset=myPreset2'
        },
      },
      
    }
  }
```



### http request

#### query

* query specified fields

  ```url
  http://localhost/my-service/users?_fields=id,name
  ```

  ```url
  http://localhost/my-service/users
  ```

  equals:

  ```url
  http://localhost/my-service/users?_fields=*
  ```


* query by conditions

  ```url
  http://localhost/my-service/users?loginId=foo&name=*bar*
  ```

  ```mysql
  select id, phone_number, login_id, name from user
  where login_id='foo' and name like '%bar%'
  ```

* query by order

  ```url
  http://localhost/my-service/users?_order=-id,name
  ```
  ```mysql
  select id, phone_number, login_id, name from user
  where order by id desc, convert(name using gbk)
  ```

* associations

  ```url
  http://localhost/my-service/tenant-users?_fields=id,person.name,tenant.name&tenant.name=foobar&_order=-id,user.name
  ```

  ```sql
  select id,user.name,tenant.name from tenant_user
  inner join tenant on tenant_id=tenant.id
  left outer join user on user_id=user.id
  where tenant.name='foobar'
  order by id desc,convert(user.name using gbk)
  ```

* query by preset options

  ```url
  http://localhost/my-service/tenant-users?_preset=myPreset1
  ```

  ​


#### create

* post  (code by request)

  ```javascript request
  request({
    method: 'POST',
    url: 'http://localhost:3000/my-service/users',
    form: {
      name: 'sunzz',
      phoneNumber: 13051761351
    }
  })
  ```

* batch post  (code by request)

  ```javascript
  request({
    method: 'POST',
    url: 'http://localhost:3000/my-service/users',
    form: [
      {
        name: 'sunzz',
        phoneNumber: 13051761351
      },
      {
        name: 'sunyy',
        phoneNumber: 13051761351
      }
    ]
  })
  ```

  ​

#### update

* put / patch  (code by request)

  ```javascript
  request({
    method: 'put', // or 'patch'
    url: 'http://localhost:3000/my-service/users/1',
    form: {
      name: 'sunxx'
    }
  })
  ```

* batch put/patch  (code by request)

  ```javascript
  request({
    method: 'put', // or 'patch'
    url: 'http://localhost:3000/my-service/users',
    form: [
      {
        id: 1,
        name: 'sunxx'
      },
      {
        id: 2,
        name: 'sunyy'
      }
    ]
  })
  ```



#### remove

* delete  (code by request)

  ```javascript
  request({
    method: 'delete',
    url: 'http://localhost:3000/my-service/users/1'
  })
  ```

  ​