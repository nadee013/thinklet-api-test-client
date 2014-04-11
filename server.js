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

var app = express();
app.use(express.bodyParser());
app.use(express.static("public"));
app.engine('html', require('ejs').renderFile);

var thinkletspaceId = null;
var thinkletId = null;
var userId = null;
var url = null;
//connect to ddpclient
ddpclient.connect(function(error) {
  if(error) {
    console.log("DDP connection error..!");
  }
  //login with ddpclient
  //uses meteor db
  //user is an api user
  ddpclient.loginWithUsername("userApi","aaaaaa",function(err,result) {
    if(err) {
      console.log("User login error");
    }
  });
  console.log("Connected..!");

  //home route
  app.get("/", function (req, res) {
    res.render("index.html", {"url": null, "thinkletspaceId": null, "thinkletId": null, "userId": null});
  });

  app.post("/get_url", function (req, res) {
    //check thinkletspace name
    var thinkletSpaceName = req.body.thinkletSpaceName;
    if(!thinkletSpaceName) {
      console.log("thinkletSpace field not found");
      res.send(404);
    } else {
      //check org id
      var organization = req.body.org;
      if(!organization) {
        console.log("Organization field not found");
        res.send(404);
      } else {
        //thinkletname can be null
        var thinkletName = req.body.thinkletName;
        //check user email
        var userEmail = req.body.userEmail;
        if(!userEmail) {
          console.log("User email field not found");
          res.send(404);
        }
        else {
          var userInfo = {
            "email": userEmail,
            "permission": "facilitator",
            "firstname": "nadee",
            "lastname": "anu",
            "organization": "new"
          } 
          //call api.createUser 
          //if user exist for this email, users him
          //else create one on this
          ddpclient.call("api.createUser", [userInfo], addedUserCallback);

          function addedUserCallback(err, id) {
            if(err) {
              console.log(err);
              res.send(404);
            } else {
              userId = id;
              var thinkletSpaceInfo = {
                "name": thinkletSpaceName,
                "orgId": organization,
                "user": userId
              }
              ddpclient.call("api.createThinkletSpace", [thinkletSpaceInfo], createdThinkletSpacesCallback);
            }
          }

          function createdThinkletSpacesCallback(err, id) {
            if(err) {
              console.log(err);
              res.send(404);
            }
            thinkletspaceId = id;
            if(thinkletName) {
              var thinkletInfo = {
                "name": thinkletName,
                "type": "brainstorm",
                "usersetId": null,
                "otherFields": {}
              }
            }
            //subscription changes according to thinklet existance and non-existance
            if(thinkletInfo) {
              ddpclient.call("api.createThinklets", [thinkletspaceId, thinkletInfo], createdThinkletsCallback);
            } else {
              changedThinkletStateCallback(null);
            }
          }

          function createdThinkletsCallback(err, id) {
            if(err) {
              console.log(err);
              res.send(404);
            } else {
              thinkletId = id;
              console.log("--------", thinkletspaceId, thinkletId);
              //start thinklet for one hour
              ddpclient.call("api.thinkletStateChange", [thinkletId, "start", 60*60*1000, Date.now(), userId], changedThinkletStateCallback);
            }
          }

          function changedThinkletStateCallback(err) {
            if(err) {
              console.log(err);
              res.send(404);
            } else {
              //call api.createSSOToken to create sso token with created thinklet group id, thinklet id and new user id
              ddpclient.call("api.createSSOToken", [userId, "facilitator", thinkletspaceId, thinkletId], createdSSOTokenCallback);
            }
          }

          function createdSSOTokenCallback(err, tokenData) {
            if(err) {
              console.log(err);
              res.send(404);
            } else {
              //generate url with login token
              // url = "/api/thinklets/group?thinkletSpaceId=" + thinkletspaceId + "&userId=" + userId + "&thinkletId=" + thinkletId + "&permission=facilitator"
              // url = url + "&redirectUrl=" + encodeURIComponent("http://localhost:3000/sso/login/" + tokenData.token);
              // window.open(url);
              url = "http://localhost:3000/sso/login/" + tokenData.token;
              console.log("----url", url);
              // url = url + "&redirectUrl=" + "localhost:8000";
              res.render("index.html", {"url": url, "thinkletspaceId": thinkletspaceId, "thinkletId": thinkletId, "userId": userId});
            }
          }
        }     
      }
    }
  });

  //chat route
  app.get("/chat", function (req, res) {
    res.render("chat.html", {"url": url});
  });

  app.post("/get_chat", function (req, res) {
    var chatMessage = req.body.message;
    if(!chatMessage) {
      console.log("Chat message field should have a value");
      res.redirect("/chat", {"url": url});
    } else {
      //calli api.chat to add chat messages
      ddpclient.call("api.chat", [thinkletspaceId, thinkletId, userId, chatMessage], chatSentcallback);
    }

    function chatSentcallback(err) {
      if(err) {
        console.log(err);
        res.send(404);
      } else {
        //on success, redirect to add another chat message
        res.redirect("/chat");
      }
    }
  });

  //brainstorm group route
  app.get("/brainstorm_group", function (req, res) {
    res.render("brainstorm_group.html", {"url": url});
  });

  app.post("/get_group", function (req, res) {
    var groupName = req.body.groupName;
    if(!groupName) {
      console.log(err);
      res.send(404);
    } else {
      var ideaGroupInfo = {
        "name": groupName
      }
      //call api.addIdeaGroups to add idea groups
      ddpclient.call("api.addIdeaGroups", [thinkletId, ideaGroupInfo, userId], addedIdeaGroupsCallback);
    }

    function addedIdeaGroupsCallback(err, id) {
      if(err) {
        console.log(err);
        res.send(404);
      } else {
        //on success redirect to brainstorm idea route to add ideas
        res.redirect("/brainstorm_idea");
      }
    }
  });

  //brainstorm idea route
  app.get("/brainstorm_idea", function (req, res) {
    res.render("brainstorm_idea.html", {"url": url});
  });

  app.post("/get_idea", function (req, res) {
    var ideaName = req.body.ideaName;
    if(!ideaName) {
      console.log(err);
      res.send(404);
    } else {
      var ideaInfo = {
        "text": ideaName
      }
      //call api.addIdea to add new ideas
      ddpclient.call("api.addIdea",  [thinkletId, ideaInfo, userId], addedIdeaCallback);
    }

    function addedIdeaCallback(err, id) {
      if(err) {
        console.log(err);
        res.send(404);
      } else {
        //on success redirect to same path to add more ideas
        res.redirect("/brainstorm_idea");
      }
    }
  });

  //thinkletSpace view via read apis
  app.get("/thinkletSpace", function (req, res) {
    ddpclient.call("api.getThinkletSpaceSettings", [thinkletspaceId, null], function (err, result) {
      if(err) {
        console.log(err);
        res.send(404);
      } else {
        res.render("thinkletSpace.html", {"url": url, "thinkletSpace": result.thinkletSpace});
      }
    });
  });

  app.get("/thinklet", function (req, res) {
    ddpclient.call("api.getThinkletsSummary", [thinkletId, null], function(err, result) {
      if(err) {
        console.log(err);
        res.send(404);
      } else {
        // res.send(result);
        res.render("thinklet.html", {"url": url, "doc": result});
      }
    });
  });

});

var port = 8000;
console.log("App listening on port : " +port);
app.listen(port);