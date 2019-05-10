const redis = require('redis');
const config = require('./aqm_config');

function queryDB(query, args) {
  rP = new Promise((resolve, reject) => {
    con.query(query, args, (err, result, fields) => {
      if (err) {
        reject(err);
      } else {
        resolve([result, fields]);
      };
    })
  });
  return rP;
}

function runTheLoop(rc) {
  var lastChDefVer = 0;
  var stopTheLoop = false;
  var channelDefs = {};
  while (!stopTheLoop) {
    let nextAlert = getNextAlert(rc);
    let nextMsgId = getNextMsgID(rc);
    let settings = getSettings(rc);
    if (settings.CHANNEL_VERSION > lastChDefVer) {
      channelDefs = getChannelDefs(rc)
    };
    if (settings.SHUTDOWN) {
      stopTheLoop = true;
      break;
    };
    alert["msgid"] = nextMsgId;
    
  }
  rc.hgetall("SETTINGS", function (err, reply) { console.log(err); console.log(reply); } )
  setTimeout(function() {
  }, 10000);
}

var rc = redis.createClient({ url: config.dbConfig.url || "redis://127.0.0.1:6379/", connect_timeout: 2000 });
rc.on('connect', function (e) { console.log("Connected to " + (config.dbConfig.url || "redis://127.0.0.1:6379/")); runTheLoop(rc)});
rc.on('error', function (e) { 
    console.log(e + "\nConnection URL used:" +  (config.dbConfig.url || "redis://127.0.0.1:6379/"));
    process.exit(1);
  });
