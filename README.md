# Express-rest-mvc

This package generates some useful middlewares for creating a REST server in Node.js following the MVC approach. It creates some default routes to your controllers, and allow you to create custom routes for each one of them. These routes use some default methods of your models to perform database operations. You can easily add validation rules to your models and perform some previous authentication in your routes.

For now you have to use a mysql database. This package users bluebird promises for almost every asynchoronous operations.

## Basic Usage

In your ``app.js``, use the following code.

```js
var express = require('express');
var app = express();

var db_config = {
    host : 'localhost',
    user : 'root',
    password : '',
    database : 'nodejs_rest_server',
    connectionLimit : 500
};

var Rest = require('express-rest-mvc');
var rest = new Rest({
    app : app,
    path : __dirname, //path of app root
    router : express.Router(),
    db_config : db_config
});

var router = rest.createRoutes();
app.use('/', router);

app.listen(3000, function(){
    console.log('running...');
});
```

Let's say you have a table `users`. So, you will have to create a `UsersController` and a `User` model. The controller must be inside the `controllers/` directory, inside the app `path`, and the model must be inside the `models` directory. Your controller is as simples as this:

```js
var util = require('util');
var Rest = require('express-rest-mvc');
var Controller = Rest.controller;

function UsersController(config) {  
    this.config = config;
}

util.inherits(UsersController, Controller);
module.exports = UsersController;
```

Your model is also very simple:

```js
var util = require('util');
var Rest = require('express-rest-mvc');
var Model = Rest.model;

function User(config){
    this.config = config;
}

util.inherits(User, Model);

User.prototype.table = 'users';
 //optional, column which contains the user registration date
User.prototype.creatd = 'created';

module.exports = User;
```

The function ``createRoutes()`` automatically create some default REST routes to your express app. These routes are:
- GET('/user/:id') - print the data of a single user;
- GET('/users/') - print data of all users registered in the database;
- POST('/users/') - create a new user;
- PUT('/user/:id') - edit a user;
- DELETE('/user/:id') - remove a user from the database;
- POST('/users/searches') - print data of users that satisfies some conditions (see [detailed explanations](#the-searches-route) about how to use this route).

### The searches route

To get the data from users with e-mail *foo@bar.com*, the body of your POST request should be
```json
{
	conditions : [{
		'email' : 'foo@bar.com'
	}]
}
```

To get the last 10 registered users, use
```json
{
	limit : 10,
	order : 'created DESC'
}
```

## Configuring your Model

### Validation
You may add validation rules in the `User.prototype.validation_rules`. The validation must be an array that follows the format specified by the [validation-engine](https://github.com/amaurigabriel/node-validation-engine) package.

If you use validation in your model, you must call the ``this.addValidationRules()`` method in your Model constructor.

## Extending your Controller

### Creating Custom Routes

To create custom routes, just create a method ``MyController.prototype.addCustomRoutes()`` in your controller:
    
```js
var User = require('../models/User');

UsersController.prototype.addCustomRoutes = function(router)
{
	router.get('/user/:id/some_custom_operation', this.customOperation());
}

UsersController.prototype.customOperation = function()
{
	var self = this;

    return function(req, res, next)
    {
        var conn, user;

    	self.config.db_pool_async.getConnectionAsync()
        .then(function(_conn){
            conn = _conn;
            user = new User({
                db : conn,
                validator : self.config.validator,
                logger : self.config.logger,
                db_config : self.config.db_config,
                event_emitter : self.config.event_emitter
            });

            return user.doSomeCustomOperation(req.body.user_id);
        })
        .then(function(){
            conn.release();
        	res.send({success : 1});
        })
        .catch(function(err){
            if (typeof conn !== 'undefined') {
                conn.release();
            }
            
        	res.send({
        		success : 0,
        		error : err.message
        	});
        });
    }
}
```
### Disabling Default Routes
If you does not want to use the default routes in your controller, set the ``YourController.prototype.use_default_routes`` property to ``false``.

## Authentication

By default, every route of the server is public. Also, there is not any kind of validation implemented in this package yet. I hope that this will be implemented in future versions. If you want, you can contribute to this package adding support to some authentication protocol. Also, you may use your own authentication routines adding some routes to the Router object in your ``app.js`` file.

```js
var router = express.Router();

router.all('*', function(req, res, next){
	if (/*user authenticated /*) {
		next();
	} else {
		/*some authentication logic here*/
	}
});

var Rest = require('express-rest-mvc');
var rest = new Rest({
    app : app,
    path : __dirname, //path of app root
    router : express.Router(),
    db_config : db_config
});

```