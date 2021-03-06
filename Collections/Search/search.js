/*
*
* Copyright (C) 2011, The Locker Project
* All rights reserved.
*
* Please see the LICENSE file for more information.
*
*/

var fs = require('fs'),
    locker = require('locker.js');

var lutil = require('lutil');
var lconfig = require('lconfig');
var logger;

var lockerInfo = {};
exports.lockerInfo = lockerInfo;

var express = require('express'),
    connect = require('connect');
var request = require('request');
var async = require('async');
var url = require('url');
var app = express.createServer(connect.bodyParser());
var index = require('./index');
var sync = require('./sync');
var jsonStream = require("express-jsonstream");
app.use(jsonStream());


app.post('/events', function(req, res) {
    var q = async.queue(function(event, callback){
        // we don't support these yet
        if (!event.idr || !event.data) return callback();
        var update = (event.action == "update") ? true : false;
        index.index(event.idr, event.data, update, callback);
    }, 1);
    req.jsonStream(q.push, function(error){
        if(error) console.error(error);
        res.send(200);
    });
});

app.get('/update', function(req, res) {
    logger.info("updating search index");
    sync.gather(false, function(){
        logger.info("full search reindex started")
        return res.send('Full search reindex started');
    }, function(err){
        if(err) logger.error("search reindex error: "+err);
        logger.info("full search reindex completed");
    }, req.param("delay"));
});

app.get('/reindexForType', function(req, res) {
    logger.info("updating search index for "+req.param("type"));
    sync.gather(req.param("type"), function(){
        return res.send('Partial search reindex started');
    });
});

// Process the startup JSON object
process.stdin.resume();
var allData = "";
process.stdin.on('data', function(data) {
    allData += data;
    if (allData.indexOf("\n") > 0) {
        data = allData.substr(0, allData.indexOf("\n"));
        lockerInfo = JSON.parse(data);
        locker.initClient(lockerInfo);
        if (!lockerInfo || !lockerInfo.workingDirectory) {
            process.stderr.write('Was not passed valid startup information.'+data+'\n');
            process.exit(1);
        }
        process.chdir(lockerInfo.workingDirectory);
        lconfig.load('../../Config/config.json');
        logger = require("logger");
        index.init("index.db", function(err){
            if(err) logger.error(err);
            sync.init(lconfig, index, logger);
            app.listen(0, function() {
              var returnedInfo = {port: app.address().port};
              process.stdout.write(JSON.stringify(returnedInfo));
            });
        });
    }
});
