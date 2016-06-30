var controller = require('./controller');
var model = require('./model');

exports = module.exports = createRestServer;

function createRestServer(app)
{	
	this.app = app;
}

createRestServer.prototype.createRoutes = function()
{
	return require('./routes')(this.app);
}

exports.controller = controller;
exports.model = model;