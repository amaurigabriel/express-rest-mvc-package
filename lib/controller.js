function Controller(){}

/*
 * get app data based on the token used in the request. this function does not block the access
 * if no access token is provided.
 */
Controller.prototype.getAppFromToken = function ControllerGetAppFromToken(){
    var self = this;

    return function(req, res, next){
        if (typeof req.query.token === 'undefined') {
            next();
        }

        var conn;            
        return self.app.get('dbPoolAsync').getConnectionAsync()
        .then(function(_conn){
            conn = _conn;
            var appToken = new AppToken(conn);
            
            return appToken.tokenIsValid(req.query.token);
        })
        .then(function(app_id){
            var appModel = new AppModel(conn);

            return appModel.find({
                conditions : [
                    ['id=?', app_id]
                ]
            });
        })
        .then(function(app_data){
            app_data = app_data[0];

            if (!app_data['active']) {
                next();
            }

            req.body.app = app_data;
            req.body.app_id_from_token = app_data.id;

            conn.release();

            return next();
        })
        .catch(function(err){
            next();
        });
    }
};

/*
 * get app data based on the token used in the request. this function does block the access
 * if no access token is provided.
 */
Controller.prototype.checkToken = function ControllerCheckToken(){
   var self = this;

    return function(req, res, next){
        if (typeof req.query.token === 'undefined') {
            return res.header(502).send('Access token is missing.');
        }

        var conn;            
        return self.app.get('dbPoolAsync').getConnectionAsync()
        .then(function(_conn){
            conn = _conn;
            var appToken = new AppToken(conn);
            
            return appToken.tokenIsValid(req.query.token);
        })
        .then(function(app_id){
            var appModel = new AppModel(conn);

            return appModel.find({
                conditions : [
                    ['id=?', app_id]
                ]
            });
        })
        .then(function(app_data){
            app_data = app_data[0];

            if (!app_data['active']) {
                return res.header(403).send('You can not access this resource.');
            }

            req.body.app = app_data;
            req.body.app_id = app_data.id;

            conn.release();

            return next();
        })
        .catch(function(err){
            if (typeof conn !== 'undefined'){
              conn.release();          
            }
            self.app.get('logger').error(err.message + err.stack);

            res.send({success : false, error : 'Internal Server Error'});
        })

        next();
    };
}


Controller.prototype.addRestRoutes = function ControllerAddRestRoutes(router) {    
    var lowercaseFirstLetter = require('../lib/string').lowercaseFirstLetter,
        lowercased_model_name = lowercaseFirstLetter(this.model_name),
        pluralize = require('pluralize').plural;

    router.all('*', this.getAppFromToken());
    router.get('/' + lowercased_model_name + '/:id', this.getById());
    router.get('/' + pluralize(lowercased_model_name) + '/', this.search());
    router.post('/' + pluralize(lowercased_model_name) + '/searches', this.search());
    router.post('/' + pluralize(lowercased_model_name) + '/', this.create());
    router.put('/' + lowercased_model_name + '/:id', this.edit());
    router.delete('/' + lowercased_model_name + '/:id', this.delete());
};


/**
 * Parse the conditions to be used in the search() method in the format expected by
 * the models.
 */
Controller.prototype.parseConditions = function ControllerParseConditions(req){
    if (typeof req.body !== 'undefined') {
        var conditions = req.body.conditions;
        req.body.conditions = [];

        for (var field in conditions){
            req.body.conditions.push([field + ' = ?', conditions[field]]);
        }
    }
};

Controller.prototype.search = function ControllerSearch (){
    var self = this;

    return function(req, res, next){
            if (typeof self.model_name === 'undefined'){
                return next();
            }

            self.parseConditions(req);

            var conn;            
            self.app.get('dbPoolAsync').getConnectionAsync()
                .then(function(_conn){
                    conn = _conn;
                    var Model = require('../model/' + self.model_name),
                    model = new Model(self.app, conn);

                    var search_params = {};
                    if (typeof req.body !== 'undefined') {
                        search_params.limit = req.body.limit;
                        search_params.order = req.body.order;
                        search_params.conditions = req.body.conditions;
                    }

                    return model.find(search_params);
                })            
                .then(function(results){
                    res.send({success : true, data : results});
                })
                .catch(function(err){
                    if (typeof conn !== 'undefined'){
                      conn.release();
                    }

                    self.app.get('logger').error(err.message + err.stack);

                    res.send({success : false, error : 'Internal Server Error'});
                });
    };
};

Controller.prototype.getById = function ControllerGetById (){
    var self = this;

    return function(req, res, next){
        if (typeof self.model_name === 'undefined'){
            return next();
        }

        var conn;
        self.app.get('dbPoolAsync')
            .getConnectionAsync()
            .then(function(_conn){
                conn = _conn;

                var Model = require('../model/' + self.model_name),
                    model = new Model(self.app, conn);

                return model.findById(req.params.id);
            })    
            .then(function(result){
                conn.release();
                conn = undefined;
                res.send({success : true, data : result});
            })
            .catch(function(error){
                if (typeof conn !== 'undefined') conn.release();

                self.app.get('logger').error(error.stack);
                res.status(500).send({success : false, error : 'Internal server error.'});
            });         
    };          
};

Controller.prototype.delete = function ControllerDelete(){    
    var self = this;

    return function(req, res, next){
        if (typeof self.model_name === 'undefined'){
            return next();
        }

        var conn;
        poolAsync.getConnectionAsync()
            .then(function(_conn){
                conn = _conn;

                var Model = require('../model/' + self.model_name),
                    model = new Model(self.app, conn);

                return model.delete({
                    conditions : [
                        [' id = ? ', req.params.id]
                    ]
                });
            })
            .then(function(){
                conn.release();
                conn = undefined;

                res.send({success : true});
            })
            .catch(function(error){
                if (typeof conn !== 'undefined') conn.release();

                self.app.get('logger').error(error.message + error.stack);
                res.status(500).send({success : false, error : 'Internal server error.'});
            });
    };     
};

Controller.prototype.create =  function ControllerCreate(){
    var self = this;
    return function(req, res, next){
        if (typeof self.model_name === 'undefined'){
            return next();
        }

        var conn;
        poolAsync.getConnectionAsync()
            .then(function(_conn){
                conn = _conn;

                var Model = require('../model/' + self.model_name),
                    model = new Model(self.app, conn);

                return model.save(req.body);
            })
            .then(function(){
                conn.release();
                conn = undefined;

                res.send({success : true});
            })
            .catch(function(err){
                if (typeof conn !== 'undefined') conn.release();

                self.app.get('logger').error(err + err.stack);
                res.status(500).send({success : false, error : err.message});
            });
    };
};

Controller.prototype.edit = function ControllerEdit(){
    var self = this;

    return function (req, res, next) {
        if (typeof self.model_name === 'undefined'){
            return next();
        }

        poolAsync.getConnectionAsync()
            .then(function(conn){
                var Model = require('../model/' + self.model_name),
                    model = new Model(self.app, conn);

                req.body.id = req.params.id;
                return model.save(req.body);
            })
            .then(function(){
                res.send({success : true});
            })
            .catch(function(err){
                self.app.get('logger').error(err.message + err.stack);
                res.status(500).send({success : false, error : 'Internal server error.'});
            });    
    };
};

module.exports = Controller;