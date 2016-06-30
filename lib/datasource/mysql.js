var mysql = require('mysql2');
var Promise = require('bluebird');

exports.getPoolAsync = function(db_config){
	var pool = mysql.createPool(db_config);
	var poolAsync = Promise.promisifyAll(exports.pool);

	return poolAsync;
}