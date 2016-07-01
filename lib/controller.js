function Controller(){}

Controller.prototype.addRestRoutes = function ControllerAddRestRoutes(router) {    
    var lowercaseFirstLetter = require('../lib/string').lowercaseFirstLetter,
        lowercased_model_name = lowercaseFirstLetter(this.model_name),
        pluralize = require('pluralize').plural;

    // router.all('*', this.getAppFromToken());
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
            self.config.db_pool_async.getConnectionAsync()
                .then(function(_conn){
                    conn = _conn;
                    var Model = require(self.config.app_path +  '/models/' + self.model_name),
                    model = new Model({
                        db : conn,
                        validator : self.config.validator,
                        logger : self.config.logger,
                        db_config : self.config.db_config,
                        event_emitter : self.config.event_emitter
                    });

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

                    self.config.logger.error(err.message + err.stack);

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
        self.config.db_pool_async
            .getConnectionAsync()
            .then(function(_conn){
                conn = _conn;

                var Model = require(self.config.app_path +  '/models/' + self.model_name),
                    model = new Model({
                        db : conn,
                        validator : self.config.validator,
                        logger : self.config.logger,
                        db_config : self.config.db_config,
                        event_emitter : self.config.event_emitter
                    });

                return model.findById(req.params.id);
            })    
            .then(function(result){
                conn.release();
                conn = undefined;
                res.send({success : true, data : result});
            })
            .catch(function(error){
                if (typeof conn !== 'undefined') conn.release();

                self.config.logger.error(error.stack);
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

                var Model = require(self.config.app_path +  '/models/' + self.model_name),
                    model = new Model({
                        db : conn,
                        validator : self.config.validator,
                        logger : self.config.logger,
                        db_config : self.config.db_config,
                        event_emitter : self.config.event_emitter
                    });

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

                self.config.logger.error(error.message + error.stack);
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

                var Model = require(self.config.app_path +  '/models/' + self.model_name),
                    model = new Model({
                        db : conn,
                        validator : self.config.validator,
                        logger : self.config.logger,
                        db_config : self.config.db_config,
                        event_emitter : self.config.event_emitter
                    });

                return model.save(req.body);
            })
            .then(function(){
                conn.release();
                conn = undefined;

                res.send({success : true});
            })
            .catch(function(err){
                if (typeof conn !== 'undefined') conn.release();

                self.config.logger.error(err + err.stack);
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
                var Model = require(self.config.app_path +  '/models/' + self.model_name),
                    model = new Model({
                        db : conn,
                        validator : self.config.validator,
                        logger : self.config.logger,
                        db_config : self.config.db_config,
                        event_emitter : self.config.event_emitter
                    });

                req.body.id = req.params.id;
                return model.save(req.body);
            })
            .then(function(){
                res.send({success : true});
            })
            .catch(function(err){
                self.config.logger.error(err.message + err.stack);
                res.status(500).send({success : false, error : 'Internal server error.'});
            });    
    };
};

module.exports = Controller;