var fs = require('fs');

function accessControlAllowOrigin(req, res, next){
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "POST, GET, PUT, DELETE, OPTIONS");

    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
}

function addRoutes(config){
    var router = config.router;

    router.all('*', accessControlAllowOrigin);

    fs.readdirSync(config.path + '/controllers').forEach(function (file) {
        if(file !== 'Controller.js' && file.substr(-3) === '.js') {
            var Controller = require(config.path + '/controllers/' + file),
                controller = new Controller({
                  app_path : config.path,
                  db_pool_async : config.db_pool_async,
                  db_config : config.db_config,
                  logger : config.logger,
                  validator : config.validator
                });
          
          if (typeof controller.use_default_routes === 'undefined' || controller.use_default_routes) {
              controller.addRestRoutes(router);
          }

          if (typeof controller.addCustomRoutes === 'function') {
              controller.addCustomRoutes(router);
          }
        }
    });

    return router;
}

module.exports = addRoutes;