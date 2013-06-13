/*
**  ComponentJS -- Component System for JavaScript <http://componentjs.com>
**  Copyright (c) 2009-2013 Ralf S. Engelschall <http://engelschall.com>
**
**  This Source Code Form is subject to the terms of the Mozilla Public
**  License, v. 2.0. If a copy of the MPL was not distributed with this
**  file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/

/*  program identification  */
var app = {
    name: "Server",
    vers: "0.0.0",
    date: "2013-01-01",
    logger: null
};

/*  determine path to server base directory  */
var basedir = __dirname;

/*  load required libraries (1/3)  */
var fs       = require("fs");
var path     = require("path");
var tracing  = require("./assets/transpiler/transpiler-lib.js").tracing;

/*  determine path to Node library directory  */
var libdir = path.resolve(path.join(basedir, "/lib/node_modules/"));
module.paths.unshift(libdir);

/*  load required libraries (2/3)  */
var ini      = require("node-ini");
var util     = require("util")
var dashdash = require("dashdash");

/*  default command-line value loading  */
var k = 0;
var argv = [];
argv.push(process.argv[k++]);
argv.push(process.argv[k++]);
var sections = [ "default" ];
if (k < process.argv.length) {
    var m = process.argv[k].match(/^--config=(.+)$/);
    if (m !== null) {
        sections.push(m[1]);
        k++;
    }
}
var config = ini.parseSync(path.join(basedir, "/server.ini"));
for (var j = 0; j < sections.length; j++) {
    if (typeof config[sections[j]] !== "undefined") {
        for (var name in config[sections[j]]) {
            if (config[sections[j]].hasOwnProperty(name)) {
                if (typeof config[sections[j]][name] === "string") {
                    argv.push("--" + name);
                    argv.push(config[sections[j]][name]);
                }
                else if (config[sections[j]][name] instanceof Array) {
                    for (var i = 0; i < config[sections[j]][name].length; i++) {
                        argv.push("--" + name);
                        argv.push(config[sections[j]][name][i]);
                    }
                }
            }
        }
    }
}
while (k < process.argv.length)
    argv.push(process.argv[k++]);

/*  die the reasonable way  */
var die = function (msg) {
    console.error("server: ERROR: %s", msg)
    process.exit(1)
};

/*  command-line argument parsing  */
var options = [
    {   name: "version", type: "bool", "default": false,
        help: "Print tool version and exit." },
    {   names: [ "help", "h" ], type: "bool", "default": false,
        help: "Print this help and exit." },
    {   names: [ "addr", "a" ], type: "string", "default": "127.0.0.1",
        help: "IP address to listen", helpArg: "ADDRESS" },
    {   names: [ "port", "p" ], type: "integer", "default": 8080,
        help: "TCP port to listen", helpArg: "PORT" },
    {   names: [ "backlog", "b" ], type: "integer", "default": 511,
        help: "TCP socket connection backlog", helpArg: "CONNECTIONS" },
    {   names: [ "componentjs" , "cjs" ], type: "string", "default": ".*\/component.js",
        help: "Regex matching the url of the ComponentJS file", helpArg: "REGEX" },
    {   names: [ "components", "cmps" ], type: "string", "default": ".*/app/.*",
        help: "Regex matching the urls of the components files of the SPA", helpArg: "REGEX" },
    {   names: [ "proxyaddr", "A" ], type: "string", "default": "127.0.0.1",
        help: "IP address to listen", helpArg: "ADDRESS" },
    {   names: [ "latestcjs", "lcjs" ], type: "bool", "default": false,
        help: "Overwrites applications ComponentJS file", helpArg: "BOOL" },
    {   names: [ "proxyport", "P" ], type: "integer", "default": 8129,
        help: "TCP port to listen", helpArg: "PORT" },
    {   names: [ "proxyfwd", "F" ], type: "string", "default": "",
        help: "host and port of forwarding proxy", helpArg: "HOST:PORT" },
    {   names: [ "app", "X" ], type: "arrayOfString", "default": "",
        help: "application to load", helpArg: "APP" }
]
var parser = dashdash.createParser({
    options: options,
    interspersed: false
})
try {
    var opts = parser.parse(argv)
} catch (e) {
    die(e.message)
}
if (opts.help) {
    var help = parser.help().trimRight()
    console.log(
        "server: USAGE: server [options] [arguments]\n" +
        "options:\n" +
        help
    )
    process.exit(0)
}
else if (opts.version) {
    console.log(util.format("%s %s (%s)", app.name, app.vers, app.date))
    process.exit(0)
}

/*  load required libraries (3/3)  */
var util            = require("util");
var cors            = require("cors");
var express         = require("express");
var express_io      = require("express.io");
var express_winston = require("express-winston");
var winston         = require("winston");

/*  create a server logger  */
var loggerTransport = new winston.transports.File({
    filename: "server.log",
    handleExceptions: true,
    maxsize: 1024*1024,
    maxFiles: 10,
    json: false,
    colorize: false
});
app.logger = new (winston.Logger)({
    transports: [ loggerTransport ]
});
app.logger.log("info", "starting %s %s (%s)", app.name, app.vers, app.date);
process.on("uncaughtException", function (error) {
    app.logger.log("error", error);
    console.log("server: ERROR: " + error);
});

/*  establish a root server  */
var srv = express_io();
srv.http().io();
app.srv = srv;

/*  adjust server identification  */
srv.enable("trust proxy");
srv.disable("x-powered-by");
srv.use(function (req, res, next) {
    res.setHeader("Server", util.format("%s %s (%s)", app.name, app.vers, app.date));
    next();
});

/*  allow to be used behind a reverse proxy  */
srv.enable("trust proxy");

/*  support CORS  */
srv.use(cors(function (req, cb) {
    var options = { origin: false, credentials: true };
    if (typeof req.header("Origin") === "string")
        options.origin = true;
    cb(null, options);
}));

/*  access logging  */
srv.use(express_winston.logger({
    transports: [
        new winston.transports.File({
            filename: "server.access.log",
            maxsize: 1024*1024,
            maxFiles: 10,
            json: false,
            colorize: false
        })
    ]
}));

/*  make an Express server from custom JavaScript code  */
var mkAppJS = function (filename) {
    var mod;
    try        { mod = require(filename); }
    catch (ex) { die("failed to load JavaScript module \"" + filename + "\": " + ex.message); }
    if (typeof mod.setup !== "function")
        die("JavaScript module does not export \"setup\" function: " + filename);
    var srv = mod.setup(app);
    return srv;
};

/*  make an Express server as standard directory listing  */
var mkAppDir = function (dirname) {
    var srv = express();
    srv.disable("x-powered-by");
    srv.use(express.favicon(dirname + "/favicon.ico", { maxAge: 24*60*60*1000 }));
    srv.use(express.compress());
    srv.use(express.responseTime());
    srv.use(express.static(dirname, { maxAge: 1*60*60*1000 }));
    return srv;
};

/*  iterate over all configured servers  */
if (typeof opts.app === "undefined")
    die("no application(s) defined");
for (var i = 0; i < opts.app.length; i++) {
    /*  parse application specification  */
    var m = (opts.app[i] + "").match(/^(.+):(.+)$/);
    if (m === null)
        die("invalid app specification (has to be \"<url-prefix>:<file-or-dir-path>\")");
    var url = m[1];
    var src = m[2];

    /*  sanity check parameters  */
    if (!url.match(/^\//))
        die("invalid URL prefix (has to start with a slash)");
    if (!fs.existsSync(src))
        die("invalid app source: \"" + src + "\"  (has to be either JavaScript file or directory)");

    /*  determine type of Express application  */
    var stats = fs.statSync(src);
    var subsrv;
    if (stats.isFile()) {
        app.logger.log("info", "deploying custom app: url=%s src=%s", url, src);
        subsrv = mkAppJS(src);
    }
    else if (stats.isDirectory()) {
        var index = src + "/root.js";
        if (fs.existsSync(index) && fs.statSync(index).isFile()) {
            app.logger.log("info", "deploying custom app: url=%s src=%s", url, index);
            subsrv = mkAppJS(index);
        }
        else {
            app.logger.log("info", "deploying directory-index: url=%s src=%s", url, src);
            subsrv = mkAppDir(src);
        }
    }

    /*  configure as sub-server  */
    srv.use(url, subsrv);
}

/*  configure a fallback middleware  */
srv.use(function(req, res) {
    res.send(404, "Resource Not Found");
});

/*  error logging  */
srv.use(express_winston.errorLogger({
    level: "info",
    transports: [ loggerTransport ]
}));

/*  error logging  */
srv.use(express.errorHandler({ dumpExceptions: false, showStack: false }));

app.logger.log("info", "listening on http://%s:%d for PROXY requests", opts.proxyaddr, opts.proxyport);
var proxyserver = require("http-proxy-simple").createProxyServer({
    host:  opts.proxyaddr,
    port:  opts.proxyport,
    proxy: opts.proxyfwd
});

proxyserver.on("http-request", function (cid, request) {
   app.logger.log("info", "proxy: " + cid + ": HTTP request: " + request.url);
});

proxyserver.on("http-error", function (cid, error) {
   app.logger.log("info", "proxy: " + cid + ": HTTP error: " + error);
});

/*  get supplied arguments, identifying the ComponentJS library file and the application component files  */
var cjsFile  = new RegExp(opts.componentjs)
var cmpFiles = new RegExp(opts.components)

proxyserver.on("http-intercept-response", function (cid, request, response, remoteResponse, remoteResponseBody, performResponse) {
    /*  Did we inject anything? If yes, fix the HTTP request  */
    var finishResponse = function () {
        /*  Make sure the file is never marked as loaded from cache  */
        remoteResponse.statusCode = 200;
        remoteResponse.headers["content-length"] = remoteResponseBody.length;
        remoteResponse.headers["content-type"] = "application/javascript";
        remoteResponse.headers["accept-ranges"] = "bytes";
        /*  Take care of the caching headers  */
        var cacheControl = remoteResponse.headers["x-cache"];
        if (cacheControl)
            cacheControl = cacheControl.replace("HIT", "MISS");
        cacheControl = remoteResponse.headers["x-cache-lookup"];
        if (cacheControl)
            cacheControl = cacheControl.replace("HIT", "MISS");
    };

    if (remoteResponse.req.path.match(cjsFile) !== null) {
        /*  Convert the remoteResponseBody to a string  */
        remoteResponseBody = remoteResponseBody.toString("utf8");
        console.log("Discovered CJS file: " + request.url);

        /*  Which files do we want to be injected?  */
        var filesToInject = [
            "./assets/plugins/component.plugin.tracing.js",
            "./assets/socket.io.js",
            "./assets/plugins/component.plugin.tracing-remote.js"
        ];

        /*  Should the latest version of ComponentJS be injected as well?  */
        if (opts.latestcjs) {
            console.log("Injecting the latest ComponentJS version");
            filesToInject.unshift("./assets/component.js");
            remoteResponseBody = "";
        }

        /*  Now inject each file */
        for (var i = 0; i < filesToInject.length; i++) {
            /*  Load the file to inject to a temporary string  */
            var append = fs.readFileSync(filesToInject[i]).toString("utf8");
            /*  Append file to the responseBody  */
            remoteResponseBody += append;
        }

        console.log("Append necessary plug-ins and libraries");
        finishResponse();
    } else if (remoteResponse.req.path.match(cmpFiles) !== null) {
        /*  read original remoteResponseBody, instrument it and write instrumented remoteResponseBody  */
        remoteResponseBody = remoteResponseBody.toString("utf8");
        remoteResponseBody = tracing.instrument("cs", remoteResponseBody);

        console.log("Transpiled component file: " + request.url);
        finishResponse();
    }

    performResponse(remoteResponse, remoteResponseBody);
});

/*  start the listening on the root server  */
srv.listen(opts.port, opts.addr, opts.backlog, function () {
    app.logger.log("info", "listening on http://%s:%d for ORIGIN requests", opts.addr, opts.port);
});