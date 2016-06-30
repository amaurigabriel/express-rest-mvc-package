var Promise = require('Bluebird'),
    util = require('util'),
    _squel = require('squel');

_squel.registerValueHandler(Date, function(date){

  return date.getFullYear() + '-' + (date.getMonth() + 1) + '-' + date.getDate() + ' ' + date.getHours() + ':' + date.getMinutes() + ':' + date.getSeconds();
});

function Model(){
}

Model.prototype.primary = 'id';

Model.prototype.getDatabaseColumns = function ModelGetDatabaseColumns()
{
  var squel = require('squel')
      .select()
      .from('information_schema.COLUMNS ')
      .where('TABLE_SCHEMA=?', this.db.config.database)
      .where('TABLE_NAME=?', this.table);


    var query = squel.toParam();

    return this.executeQuery(query.text, query.values)
}

/**
 * Receive an object with the data to be saved in the database, and "returns" only fields
 * which have a correspondent column in the database
 */
Model.prototype.extractDataToSave = function ModelExtractDataToSave(data)
{
  var self = this;

  return new Promise(function(resolve, reject){
    self
    .getDatabaseColumns()
    .then(function(columns){
      var data_to_save = {};
      require('async').each(columns, function(column, callback){
        for (var key_data in data) {
          if (key_data == column.COLUMN_NAME) {
            data_to_save[key_data] = data[key_data];
          }
        }
        callback();
      }, function(){
        resolve(data_to_save);
      });
    })
    .catch(reject);
  })
}

Model.prototype.addValidationRules = function ModelAddValidationRules(){
  this.validator = this.app.get('validator');
  this.validator.rules = this.validationRules;
};

/**
 * Parse a query to the format expected by squel
 */
Model.prototype.parseQuery = function ModelParseQuery(squel, options){
    if (typeof options.limit !== 'undefined'){
      squel = squel.limit(options.limit);
    }

    if (typeof options.offset !== 'undefined'){
      squel = squel.offset(options.offset);
    }

    if (typeof options.order !== 'undefined'){
      squel = squel.order.apply(squel, options.order);
    }

    if (typeof options.group !== 'undefined'){
      squel = squel.group(options.group);
    }

    for (var field in options.fields){
      var field = options.fields[field];

      if (typeof field === 'string'){
        squel = squel.field(field);
      }
      else{
        squel = squel.field(field.name, field.alias);
      }
    }
    for (var condition in options.conditions){
      squel = squel.where.apply(squel, options.conditions[condition]);
    }

    return squel;
};

Model.prototype.executeQuery = function ModelExecuteQuery(text, values){
  var self = this;
  
  return new Promise(function(resolve, reject){
      self.db.query(text, values, function(err, data){
          if (err){
              reject(err);
          }

          resolve(data);
      });
  });
};

Model.prototype.validate = function(data){
  if (typeof this.validator !== 'undefined') {
    return validator.validate(data);
  } else {
    return new Promise(function(resolve, reject){
      resolve(data);
    });
  }
};


/**
 * This function may be overrided by each model in order to do some useful operation
 */
Model.prototype.beforeSave = function(data) {
  return new Promise(function(resolve, reject){
    resolve(data);
  });
}

/**
 * This function may be overrided by each model in order to do some useful operation
 */
Model.prototype.afterFind = function(data) {
  return new Promise(function(resolve, reject){
    resolve(data);
  });
}

Model.prototype.save = function ModelSave(data){  
  var self = this;
  return new Promise(function(resolve, reject){
      self.validate(data)
          .then(function(){
            return self.beforeSave(data);
          })
          .then(function(data){
            return self.extractDataToSave(data);
          })
          .then(function(data){
            // console.log(data);
            var squel = _squel;

            if (typeof data[self.primary] === 'undefined'){
              squel = require('squel')
                .insert()
                .into(self.table);

                if (typeof self.created !== 'undefined' && typeof data[self.created] === 'undefined'){
                  squel = squel.set(self.created, new Date());
                }
            }
            else{
              squel = require('squel')
                .update()
                .table(self.table);
            }

            for (var field_name in data){
                squel = squel.set(field_name, data[field_name]);
            }

            if (typeof data[self.primary] !== 'undefined'){
              squel = squel.where(self.primary + ' = ?', data[self.primary]);
            }
            
            var params = squel.toParam();
            return self.executeQuery(params.text, params.values);
          })
          .then(resolve)
          .catch(reject);
  });
};

// Model.prototype.saveAll = function ModelSaveAll(data){
//   return new Promise(function(resolve, reject){
//     self.db.beginTransactionAsync()
//       .then(function(){
//         //adicionar relacionamento belogsTo para saber em qual ordem salvar os registros
//       });
//   });
// };

Model.prototype.afterFindHasMany = function ModelAfterFindHasMany(i, j, results){
  var self = this;

  return function(hasManyResults){            
    return new Promise(function(resolve){
      results[j][self.hasMany[i].model] = [];

      var count_has_many_results = hasManyResults.length;
      for (var k = 0; k < count_has_many_results; k++) {
        results[j][self.hasMany[i].model].push(hasManyResults[k]);
      }

      resolve();
    });     
  };
};

Model.prototype.afterFindHasOne = function ModelAfterFindHasMany(i, j, results){
  var self = this;

  return function(hasOneResult){            
    return new Promise(function(resolve){
      results[j][self.hasOne[i].model] = hasOneResult[0];
      resolve(results);
    });     
  };
};

Model.prototype.afterFindBelongsTo = function ModelAfterFindBelongsTo(i, j, results){
  var self = this;

  return function(belongsToResult){            
    return new Promise(function(resolve){
      results[j][self.belongsTo[i].model] = belongsToResult[0];
      resolve(results);
    });     
  };
};

Model.prototype.findAssociations = function ModelFindAssociations(results, current_recursive){
  var self = this;

  var count_has_many = 0,
      count_belongs_to = 0,
      count_has_one = 0,
      count_results = results.length;

  if (typeof self.hasMany !== 'undefined') count_has_many = self.hasMany.length;
  if (typeof self.belongsTo !== 'undefined') count_belongs_to = self.belongsTo.length;
  if (typeof self.hasOne !== 'undefined') count_has_one = self.hasOne.length;

  var promises = [];
 
  for (var i = 0; i < count_has_one; i++){
      var Model = require('./' + self.hasOne[i].model),
          model = new Model(self.db);

      for (var j = 0; j < count_results; j++){
        var find_data = {
          recursive : current_recursive - 1,
          conditions : [
            [self.hasOne[i].foreignKey + ' = ?', results[j][self.hasOne[i].selfKey]]
          ],
          limit : 1
        };

        var promise = model.find(find_data).then(self.afterFindHasOne(i, j, results));
        promises.push(promise);
      }
  }

  for (var i = 0; i < count_belongs_to; i++){
    var Model = require('./' + self.belongsTo[i].model),
        model = new Model(self.db);

    for (var j = 0; j < count_results; j++){
      var find_data = {
        recursive : current_recursive - 1,
        conditions : [
          [self.belongsTo[i].foreignKey + ' = ?', results[j][self.belongsTo[i].selfKey]]
        ],
        limit : 1
      };

      var promise = model.find(find_data).then(self.afterFindBelongsTo(i, j, results));
      promises.push(promise);
    }
  }

  for (var i = 0; i < count_has_many; i++){
      var Model = require('./' + self.hasMany[i].model),
          model = new Model(self.db);

      for (var j = 0; j < count_results; j++){
        var find_data = {
          recursive : current_recursive - 1,
          conditions : [
            [self.hasMany[i].foreignKey + ' = ?', results[j][self.hasMany[i].selfKey]]
          ]
        };

        var promise = model.find(find_data).then(self.afterFindHasMany(i, j, results));
        promises.push(promise);
      }
  }

  return new Promise(function(resolve, reject){
    Promise.all(promises).then(function(){
      resolve(results);
    })
    .catch(reject);
  });
};

Model.prototype.find = function ModelFind(options){
    var self = this;
    squel = require('squel')  
        .select()        
        .from(this.table);

    if (typeof this.public_fields !== 'undefined') {
      squel = squel.fields(this.public_fields);
    }

    squel = this.parseQuery(squel, options);

    var query = squel.toParam();

    return new Promise(function(resolve, reject){
      self.executeQuery(query.text, query.values)
        .then(function(results){
          if (typeof options.recursive === 'undefined'){
            options.recursive = 1;
          } 

          if (options.recursive <= 0){
            return resolve(results);
          }
                  
          return self.findAssociations(results, options.recursive); 
        })
        .then(function(results){
          return self.afterFind(results);
        })
        .then(resolve)
        .catch(function(err){
          reject(err);
        })
    });    
};

Model.prototype.findById = function ModelFindById(id){
    var self = this;

    return new Promise(function(resolve, reject){
        self.find({
            conditions : [
                ['id = ?', id]
            ]
        })
        .then(function(result){
            if (result && result.length === 1){
                resolve(result[0]);
            }
            else if (result.length > 1){
                reject(new Error('Duplicated record with id ' + id + ' for table ' + self.table + '.'));
            }
            else{
                reject(new Error('Not found.'));
            }
        })
        .catch(reject);
    });
};

Model.prototype.delete = function ModelDelete(options){
   squel = require('squel')  
            .delete()
            .from(this.table);

    squel = this.parseQuery(squel, options);
    var query = squel.toParam();
    return this.executeQuery(query.text, query.values);
};

module.exports = Model;
