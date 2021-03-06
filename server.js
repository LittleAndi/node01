#!/bin/env node

var express = require('express');
var fs      = require('fs');
var mongodb = require('mongodb');
var util    = require('util');
var stream  = require('stream');
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
      //console.log(names);
      var stream = mu.compileAndRender(self.mustacheTemplates + '/names.html', { "names" : names });
      res.header("Content-Type", "text/html");
      res.header("Cache-Control", "max-age:10");
      stream.pipe(res);
    });
  };

  self.routes['testing'] = function(req, res) {
    mu.clearCache();
    var names = self.db.collection('names').find().toArray(function(err, names) {
      console.log(names);
      var stream = mu.compileAndRender(self.mustacheTemplates + '/names.html', { "names" : names });
      res.header("Content-Type", "text/html");
      stream.pipe(res);
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
      stream.pipe(res);
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

  self.routes['getTemplates'] = function(req, res) {
    console.log('Req: ' + req);
    console.log('Body: ' + req.body);

    self.db.collection('templates', function(err, collection) {
      if (err) {
        console.log(err);
        res.send({ 'error': 'An error has occured'});
      };
      collection.find().toArray(function(err, templates) {
        mu.clearCache();
        var stream = mu.compileAndRender(self.mustacheTemplates + '/templates.html', { "templates": templates });
        res.header("Content-Type", "text/html");
        stream.pipe(res);
      });
    })
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

        // Get the template for template_edit
        collection.findOne({ "template": "template_edit" }, function(err, template_edit) {
          if (template_edit != null) {
            mu.compileText(template_edit.template, template_edit.data, function(err, compiledEditTemplate) {
              var stream = mu.render(compiledEditTemplate, template);
              res.header("Content-Type", "text/html");
              stream.pipe(res);
            });
          } else {
            // Template not found, using file
            var stream = mu.compileAndRender(self.mustacheTemplates + '/template_edit.html', template);
            res.header("Content-Type", "text/html");
            stream.pipe(res);
          }
        });

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

  self.routes['putTemplate'] = function(req, res) {
    console.log('*** putTemplate');
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
      }

      // Upsert
      collection.update({ template: templateId }, templateInfo, { safe: true, upsert: true }, function(err, result) {
        if (err) {
          console.log(err);
          console.log(result);
          res.send({ 'error': 'An error has ocurred'});
        } else {
          console.log('Template updated!');

          // Return new document
          res.send('Template updated!');
        }
      });
    });
  };

  self.routes['getPages'] = function(req, res) {
    console.log('*** getPages');
    console.log('Req: ' + req);
    console.log('Body: ' + req.body);

    self.db.collection('pages', function(err, collection) {
      if (err) {
        console.log(err);
        res.send({ 'error': 'An error has occured'});
      };
      collection.find().toArray(function(err, pages) {
        mu.clearCache();
        var stream = mu.compileAndRender(self.mustacheTemplates + '/pages.html', { "pages": pages });
        res.header("Content-Type", "text/html");
        stream.pipe(res);
      });
    })
  };

  self.routes['getPage'] = function(req, res) {
    console.log('*** getPage');
    console.log('Req: ' + req);
    console.log('Body: ' + req.body);
    console.log('id: ' + req.params[0]);

    var pageId = req.params[0];

    self.db.collection('pages', function(err, collection) {
      collection.findOne({ "pageId": pageId }, function(err, page) {
        mu.clearCache();
        if (page == null)
        {
          page = { "pageId": pageId, "data": "", "html": "", "templateId": "" };
        }

        // Get the template collection
        self.db.collection('templates', function(err, templatecollection) {
          if (err)
          {
            console.log(err);
          }

          // Get all templates
          templatecollection.find().toArray(function(err, templates) {
            page.templates = templates;

            // Set the selected template from the page.templateId
            for (var i = 0, n = page.templates.length; i<n; i++) {
              if (page.templates[i].template == page.templateId) {
                page.templates[i].selected = true;
              }
            }

            console.log(JSON.stringify(page));

            // Get the template for page_edit
            templatecollection.findOne({ "template": "page_edit" }, function(err, page_edit) {
              if (page_edit != null) {
                mu.compileText(page_edit.template, page_edit.data, function(err, compiledEditPage) {
                  var stream = mu.render(compiledEditPage, page);
                  res.header("Content-Type", "text/html");
                  stream.pipe(res);
                });
              } else {
                // Template not found, using file
                var stream = mu.compileAndRender(self.mustacheTemplates + '/page_edit.html', page);
                res.header("Content-Type", "text/html");
                stream.pipe(res);
              }
            });

          });
  
        });

      });
      if (err) {
        res.send({ 'error': 'An error has occured'});
      };
    })
  };

  self.routes['putPage'] = function(req, res) {
    console.log('*** putPage');
    console.log('Req: ' + req);
    console.log('Body: ' + req.body);
    console.log('id: ' + req.params[0]);

    var pageId = req.params[0];
    var pageInfo = req.body;
    pageInfo.pageId = pageId;

    console.log('Adding page: ' + JSON.stringify(pageInfo));

    self.db.collection('pages', function(err, collection) {
      if (err) {
        console.log(err);
      }

      // Upsert
      collection.update({ pageId: pageId }, pageInfo, { safe: true, upsert: true }, function(err, result) {
        if (err) {
          console.log(err);
          console.log(result);
          res.send({ 'error': 'An error has ocurred'});
        } else {
          console.log('Page updated!');

          // Return new document
          res.send('Page updated!');
        }
      });
    });
  };

  self.renderPage = function(page, template, req, res) {
    mu.compileText(template.template, template.data, function(err, compiledTemplate) {
      if (err)
      {
        console.log(err);
        res.send(err);
      }

      var stream = mu.render(compiledTemplate, page);

      // Convert stream to string
      var sStream = new StringStream();
      sStream.on('end', function() {
        console.log('Trying to render the template with the page.');
        console.log(this.toString());
        console.log(JSON.stringify(page.data));

        // Compile page template
        mu.compileText(page.pageId, this.toString(), function(err, compiledPage) {
          if (err)
          {
            console.log(err);
            res.send(err);
          }

          // Create JSON object from page data string
          var pageData;
          try {
            pageData = JSON.parse(page.data);
            if (pageData == null)
            {
              pageData = {};
            }

            var pageStream = mu.render(compiledPage, pageData);
            res.header("Content-Type", "text/html");
            pageStream.pipe(res);
          } catch(e) {
            console.log(e);
            res.send(e);
          }

        });
      });
      stream.pipe(sStream);
    });

  };

  self.routes['renderPage'] = function(req, res) {
    console.log('*** renderPage');
    console.log(req.route);
    console.log(req.params[0]);
    var pageId = req.params[0];

    // Get the pages collection
    self.db.collection('pages', function(err, pageCollection) {
      if (err) {
        console.log(err);
      }

      // Try to find the page that the user is looking for
      pageCollection.findOne({ "pageId": pageId }, function(err, page) {
        if (err) {
          console.log(err);
          res.send(err);
        }

        if (page != null) {
          if (page.templateId != null && page.templateId != "") {

            // Use template, try to load it from db
            console.log('Page has template, try to load it.');

            // Get the templates collection
            self.db.collection('templates', function(err, templateCollection) {

              // Find the one from page.templateId
              templateCollection.findOne({ "template": page.templateId }, function(err, template) {
                if (err) {
                  console.log(err);
                  res.send(err);
                }

                if (template != null && template.data != null) {
                  console.log('Template found: ' + template.template);
                  //console.log(JSON.stringify(template));

                  self.renderPage(page, template, req, res);
                  
                } else {
                  console.log('Template not found or data not ok.');
                }
              });
            });
          } else {
            // No template, just send page data
            console.log('Page has no template, sending raw data.');

            res.header("Content-Type", "text/html");
            res.send(page.html);
          }
        } else {
          res.send(req.route);
        }
      });
    });

  };

  // Webapp urls

  self.app  = express();
  self.app.configure(function() {
  	self.app.use(express.logger('dev'));
  	self.app.use(express.bodyParser());
    self.app.use(express.favicon(self.staticData + '/img/favicon.ico'));
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
  self.app.put('/template/:id', self.routes['putTemplate']);
  self.app.get('/pages', self.routes['getPages']);
  self.app.get('/page/*', self.routes['getPage']);
  self.app.put('/page/*', self.routes['putPage']);
  self.app.get('*', self.routes['renderPage']);

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

  ['SIGHUP', 'SIGINT', 'SIGQUIT', 'SIGILL', 'SIGTRAP', 'SIGABRT', 'SIGBUS', 'SIGFPE', 'SIGUSR1', 'SIGSEGV', 'SIGUSR2', 'SIGTERM'].forEach(self.terminatorSetup);

};

function StringStream() {
  stream.Stream.call(this);
  this.writable = true;
  this.buffer = "";
};
util.inherits(StringStream, stream.Stream);

StringStream.prototype.write = function(data) {
  if (data && data.length)
    this.buffer += data.toString();
};

StringStream.prototype.end = function(data) {
  this.write(data);
  this.emit('end');
};

StringStream.prototype.toString = function() {
  return this.buffer;
};


//make a new express app
var app = new App();

//call the connectDb function and pass in the start server command
app.connectDb(app.startServer);
