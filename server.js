#!/bin/env node

var express = require('express');
var fs      = require('fs');
var mongodb = require('mongodb');
var util    = require('util');
var mu      = require('mu2');

mu.root = process.env.OPENSHIFT_DATA_DIR + '/templates';

var App = function(){

  // Scope
  var self = this;


  // Setup
  console.log('MongoDb HOST: ' + process.env.OPENSHIFT_MONGODB_DB_HOST);
  console.log('MongoDb PORT: ' + process.env.OPENSHIFT_MONGODB_DB_PORT);

  self.dbServer = new mongodb.Server(process.env.OPENSHIFT_MONGODB_DB_HOST, parseInt(process.env.OPENSHIFT_MONGODB_DB_PORT));
  self.db = new mongodb.Db(process.env.OPENSHIFT_APP_NAME, self.dbServer, {auto_reconnect: true, safe: false});
  self.dbUser = process.env.OPENSHIFT_MONGODB_DB_USERNAME;
  self.dbPass = process.env.OPENSHIFT_MONGODB_DB_PASSWORD;
  self.staticData = process.env.OPENSHIFT_DATA_DIR;
  self.mustacheTemplates = self.staticData + '/templates';

  self.ipaddr  = process.env.OPENSHIFT_INTERNAL_IP;
  self.port    = parseInt(process.env.OPENSHIFT_INTERNAL_PORT) || 8080;

  if (typeof self.ipaddr === "undefined") {
    console.warn('No OPENSHIFT_INTERNAL_IP environment variable');
  };

  // Web app logic
  self.routes = {};
  //self.routes['health'] = function(req, res){ res.send('1'); };

  self.routes['root'] = function(req, res) {
    var names = self.db.collection('names').find().toArray(function(err, names) {
      console.log(names);
      var stream = mu.compileAndRender(self.mustacheTemplates + '/names.html', { "names" : names });
      util.pump(stream, res);
    });
  };

  self.routes['testing'] = function(req, res) {
    mu.clearCache();
    var names = self.db.collection('names').find().toArray(function(err, names) {
      console.log(names);
      var stream = mu.compileAndRender(self.mustacheTemplates + '/names.html', { "names" : names });
      util.pump(stream, res);
    });
  };

  self.routes['addNames'] = function(req, res) {
  	console.log('Req: ' + req);
  	console.log('Body: ' + req.body);

 	  var name = req.body;
  	console.log('Adding name: ' + JSON.stringify(name));
  	self.db.collection('names', function(err, collection) {
  		collection.insert(name, { safe: true }, function(err, result) {
	  		if (err) {
	  			res.send({ 'error': 'An error has ocurred'});
	  		} else {
	  			console.log('Success' + JSON.stringify(result[0]));
	  			res.send(result[0]);
	  		}
	  	});
  	});
  };

  self.routes['getNames'] = function(req, res) {
    mu.clearCache();
    var names = self.db.collection('names').find().toArray(function(err, names) {
      var stream = mu.compileAndRender(self.mustacheTemplates + '/namesform.html', { "names" : names });
      util.pump(stream, res);
    });
  };

  self.routes['addPackItem'] = function(req, res) {
    console.log('Req: ' + req);
    console.log('Body: ' + req.body);

    var packItem = req.body;
    console.log('Adding pack item: ' + JSON.stringify(packItem));
    self.db.collection('packitems', function(err, collection) {
      collection.insert(packItem, { safe: true }, function(err, result) {
        if (err) {
          res.send({ 'error': 'An error has ocurred'});
        } else {
          console.log('Success' + JSON.stringify(result[0]));
          res.send(result[0]);
        }
      });
    });
  };

  self.routes['getTemplate'] = function(req, res) {
    console.log('*** getTemplate');
    console.log('Req: ' + req);
    console.log('Body: ' + req.body);
    console.log('id: ' + req.params.id);

    var templateId = req.params.id;

    self.db.collection('templates', function(err, collection) {
      collection.findOne({ "template": templateId }, function(err, template) {
        mu.clearCache();
        if (template == null)
        {
          template = { "template": templateId, "data": "" };
        }

        var stream = mu.compileAndRender(self.mustacheTemplates + '/template_edit.html', template);
        util.pump(stream, res);
      });
      if (err) {
        res.send({ 'error': 'An error has occured'});
      };
    })
  };

  self.routes['getTemplates'] = function(req, res) {
    console.log('Req: ' + req);
    console.log('Body: ' + req.body);

    self.db.collection('templates', function(err, collection) {
      collection.find().toArray(function(err, templates) {
        mu.clearCache();
        var stream = mu.compileAndRender(self.mustacheTemplates + '/templates.html', { "templates": templates });
        util.pump(stream, res);
      });
      if (err) {
        res.send({ 'error': 'An error has occured'});
      };
    })
  };

  self.routes['addTemplate'] = function(req, res) {
    console.log('*** addTemplate');
    console.log('Req: ' + req);
    console.log('Body: ' + req.body);

    var template = req.body;
    console.log('Adding template: ' + JSON.stringify(template));
    self.db.collection('templates', function(err, collection) {
      collection.insert(template, { safe: true }, function(err, result) {
        if (err) {
          res.send({ 'error': 'An error has ocurred'});
        } else {
          console.log('Success' + JSON.stringify(result[0]));
          res.send(result[0]);
        }
      });
    });
  };

  self.routes['updTemplate'] = function(req, res) {
    console.log('*** updTemplate');
    console.log('Req: ' + req);
    console.log('Body: ' + req.body);
    console.log('id: ' + req.params.id);

    var templateId = req.params.id;
    var templateInfo = req.body;
    templateInfo.template = templateId;

    console.log('Adding template: ' + JSON.stringify(templateInfo));

    self.db.collection('templates', function(err, collection) {
      if (err) {
        console.log(err);
      } else {
        console.log('Collection ok');
      }

      // Upsert
      collection.update({ template: templateId }, templateInfo, { safe: true, upsert: true }, function(err, result) {
        if (err) {
          console.log(err);
          console.log(result);
          res.send({ 'error': 'An error has ocurred'});
        } else {
          console.log('Success' + JSON.stringify(result[0]));

          // Return new document
          res.send(result[0]);
        }
      });
    });
  };

  // Webapp urls

  self.app  = express();
  self.app.configure(function() {
  	self.app.use(express.logger('dev'));
  	self.app.use(express.bodyParser());
    self.app.use('/js', express.static(self.staticData + '/js'));
    self.app.use('/css', express.static(self.staticData + '/css'));
    self.app.use('/img', express.static(self.staticData + '/img'));
    self.app.use('/edit_area', express.static(self.staticData + '/edit_area'));
  });


  self.app.get('/', self.routes['root']);
  self.app.get('/testing', self.routes['testing']);
  self.app.get('/names', self.routes['getNames']);
  self.app.post('/names', self.routes['addNames']);
  self.app.post('/packitem', self.routes['addPackItem']);
  self.app.get('/templates', self.routes['getTemplates']);
  self.app.get('/template/:id', self.routes['getTemplate']);
  self.app.post('/template', self.routes['addTemplate']);
  self.app.put('/template/:id', self.routes['updTemplate']);

  // Logic to open a database connection. We are going to call this outside of app so it is available to all our functions inside.

  self.connectDb = function(callback) {
    self.db.open(function(err, db) {
      if(err) {
        console.log("Cannot connect to MongoDb.");
        console.log(err);

        throw err 
      };
      self.db.authenticate(self.dbUser, self.dbPass, {authdb: "admin"},  function(err, res){
        if(err){ throw err };
        callback();
      });
    });
  };
  
  
  //starting the nodejs server with express

  self.startServer = function(){
    self.app.listen(self.port, self.ipaddr, function(){
      console.log('%s: Node server started on %s:%d ...', Date(Date.now()), self.ipaddr, self.port);
    });
  }

  // Destructors

  self.terminator = function(sig) {
    if (typeof sig === "string") {
      console.log('%s: Received %s - terminating Node server ...', Date(Date.now()), sig);
      process.exit(1);
    };
    console.log('%s: Node server stopped.', Date(Date.now()) );
  };

  process.on('exit', function() { self.terminator(); });

  self.terminatorSetup = function(element, index, array) {
    process.on(element, function() { self.terminator(element); });
  };

  ['SIGHUP', 'SIGINT', 'SIGQUIT', 'SIGILL', 'SIGTRAP', 'SIGABRT', 'SIGBUS', 'SIGFPE', 'SIGUSR1', 'SIGSEGV', 'SIGUSR2', 'SIGPIPE', 'SIGTERM'].forEach(self.terminatorSetup);

};

//make a new express app
var app = new App();

//call the connectDb function and pass in the start server command
app.connectDb(app.startServer);
