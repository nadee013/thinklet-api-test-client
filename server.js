var express = require("express");
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
app.use(express.static("public"));
app.engine('html', require('ejs').renderFile);

//connect to ddpclient
ddpclient.connect(function(error) {
  if(error) {
    console.log("DDP connection error..!");
  }
  //login with ddpclient
  //uses meteor db
  //user is an api user
  ddpclient.loginWithUsername("apiuser","aaaaaa",function(err,result) {
    if(err) {
      console.log("User login error");
    }
  });
  console.log("Connected..!");

  app.get("/", function (req, res) {
    res.render("index.html");
  });

  app.post("/get_url", function (req, res) {
    var thinkletSpaceName = req.body.thinkletSpaceName;
    if(!thinkletSpaceName) {
      console.log("thinkletSpace field not found");
      res.send(404);
    } else {  
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
      if(!userEmail) {
        console.log("User email field not found");
        res.send(404);
      } else {
        var userInfo = {
          "email": userEmail,
          "permission": "participant"
        }
        var thinkletspaceId = null;
        var thinkletId = null;
        var userId = null;
        create(thinkletSpaceInfo, thinkletInfo, userInfo);

        //calling api methods
        //each in callback in the order to create sso loginToken
        function create(thinkletSpaceInfo, thinkletInfo, userInfo) {
          //call api.createThinkletSpace
          ddpclient.call("api.createThinkletSpace", [thinkletSpaceInfo], function(err, id) {
            if(err) {
              console.log(err);
              res.send(404);
            }
            thinkletspaceId = id;
            //thinkletInfo can be null as well
            if(thinkletInfo && thinkletInfo.name) {
              //if thinkletInfo exists
              //call api.createThinklets with created thinklet group id
              ddpclient.call("api.createThinklets", [thinkletspaceId, thinkletInfo], createNewUser);
            } else {
              //if not
              createNewUser(null, null);
            }
          });

          function createNewUser(err, id) {
            if(err) {
              console.log(err);
              res.send(404);
            } else {
              thinkletId = id;
              //call api.addUser with created thinklet group adn thinklet ids
              ddpclient.call("api.addUser", [userInfo, thinkletspaceId], createNewSSOToken);
            }
          }
        }

        function createNewSSOToken(err, id) {
          if(err) {
            console.log(err);
            res.send(404);
          } else {
            userId = id;
            //call api.createSSOToken with created thinklet group id, thinklet id and new user id
            ddpclient.call("api.createSSOToken", [userId, thinkletspaceId, thinkletId], generateUrl);
          }
        }

        function generateUrl(err, tokenData) {
          if(err) {
            console.log(err);
            res.send(404);
          } else {
            //redirect user to generated url with login token
            res.redirect("http://localhost:3000/sso/login/" + tokenData.token);
          }
        }
      }
    }
  });
});

var port = 8000;
console.log("App listening on port : " +port);
app.listen(port);