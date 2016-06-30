var controller = require('./controller');
var model = require('./model');
var mysql_datasource = require('./datasource/mysql.js');

exports = module.exports = createRestServer;

function createRestServer(options)
{	
	if (typeof options.app === 'undefined') {
		throw new Error ('Express app is missing');
	}

	if (typeof options.db_config === 'undefined') {
		throw new Error ('Database configuration is missing');
	}

	if (typeof options.router === 'undefined') {
		throw new Error ('Express router is missing');
	}

	if (typeof options.path === 'undefined') {
		throw new Error ('Applicaton path is missing');
	}

	if (typeof options.validator === 'undefined') {
		options.validator = require('validation-engine');
	}

	if (typeof options.logger === 'undefined') {
		options.logger = console;
	}

	this.config = options;
}

createRestServer.prototype.createRoutes = function()
{
	return require('./routes')(this.config);
}

exports.controller = controller;
exports.model = model;