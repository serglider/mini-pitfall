var express = require("express"),
    app = express(),
    bodyParser = require("body-parser"),
    errorHandler = require("errorhandler"),
    hostname = process.env.HOSTNAME || "localhost",
    port = parseInt(process.env.PORT, 10) || 9229;
app.get("/", function (req, res) {
	res.redirect("index.html");
});
app.use(bodyParser.urlencoded({
	extended: true
}));
app.use(express.static(__dirname + "/."));
app.use(errorHandler({
	dumpExceptions: true,
	showStack: true
}));
app.use("/*", function(req, res){
 	res.sendFile(__dirname + "/index.html");
});
console.log("Server listening at http://" + hostname + ":" + port);
app.listen(port, hostname);
