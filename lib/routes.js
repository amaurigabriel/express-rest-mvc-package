var fs = require('fs');

function accessControlAllowOrigin(req, res, next){
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "POST, GET, PUT, DELETE, OPTIONS");

    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
}

function addRoutes(app){
    var router = app.get('router');

    router.all('*', accessControlAllowOrigin);

    fs.readdirSync(app.get('path') + '/controllers').forEach(function (file) {
        if(file !== 'Controller.js' && file.substr(-3) === '.js') {
            var Controller = require(app.get('path') + '/controllers/' + file),
                controller = new Controller(app);
          
          if (typeof controller.use_default_routes !== 'undefined' && controller.use_default_routes) {
              controller.addRestRoutes(router);
          }

          if (typeof controller.addCustomRoutes === 'function') {
              controller.addCustomRoutes(router);
          }
        }
    });

    app.set('router', router);
}

module.exports = addRoutes;