var express = require("express");
var request = require("request");
var ejs = require("ejs");
var DDPClient = require("ddp");
ddpclient = new DDPClient({
  host: "localhost", 
  port: 3000,
  /* optional: */
  auto_reconnect: true,
  auto_reconnect_timer: 500,
  use_ejson: true,  // default is false
  use_ssl: false, //connect to SSL server,
  use_ssl_strict: false, //Set to false if you have root ca trouble.
  maintain_collections: true //Set to false to maintain your own collections.
});
// console.log(ddpclient);

var app = express();
app.use(express.bodyParser());
app.engine('html', require('ejs').renderFile);

ddpclient.connect(function(error) {
  if(error) {
    console.log("DDP connection error..!");
    res.send(404);
  }
  ddpclient.loginWithUsername("nadee013","aaaaaa",function(err,result) {
    if(err) {
      console.log("User login error");
      res.send(404);
    }
  });
  console.log("Connected..!");
  app.get("/", function (req, res) {
    res.render("index.html");
  });

  app.post("/get_url", function (req, res) {
    var thinkletSpaceName = req.body.thinkletSpaceName;
    var thinkletSpaceInfo = {
      "name": thinkletSpaceName
    }
    var thinkletName = req.body.thinkletName;
    var thinkletInfo = {
      "name": thinkletName,
      "type": "brainstorm",
      "usersetId": null,
      "otherFields": {}
    }
    var userEmail = req.body.userEmail;
    var userInfo = {
      "email": userEmail,
      "permission": "participant"
    }
    var thinkletspaceId = null;
    var thinkletId = null;
    var userId = null;
    create(thinkletSpaceInfo, thinkletInfo, userInfo, res);

    function create(thinkletSpaceInfo, thinkletInfo, userInfo) {
      ddpclient.call("api.createThinkletSpace", [thinkletSpaceInfo], function(err, id) {
        if(err) {
          console.log(err);
          res.send(404);
        }
        thinkletspaceId = id;
        console.log("thinkletSpace----------", thinkletspaceId);
        if(thinkletInfo && thinkletInfo.name) {
          ddpclient.call("api.createThinklets", [thinkletspaceId, thinkletInfo], createThinklets);
        } else {
          createThinklets(null, null);
        }
      });

      function createThinklets(err, id) {
        if(err) {
          console.log("----------", err);
          res.send(404);
        } else {
          thinkletId = id;
          console.log("thinklet----------", thinkletId);
          ddpclient.call("api.addUser", [userInfo, thinkletspaceId], createNewUser);
        }
      }
    }

    function createNewUser(err, id) {
      if(err) {
        console.log(err);
        res.send(404);
      } else {
        userId = id;
        console.log("user---------------", userId);
        ddpclient.call("api.createSSOToken", [userId, thinkletspaceId, thinkletId], createSSOToken);
      }
    }

    function createSSOToken(err, tokenData) {
      if(err) {
        console.log(err);
        res.send(404);
      }
      console.log("token.................", tokenData);
      console.log(res.redirect("http://localhost:3000/sso/login/" + tokenData.token));
    }
  });
});








var port = 8000;
console.log("App listening on port : " +port);
app.listen(port);