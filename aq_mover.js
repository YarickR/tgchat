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

function getNextAlert(rc, alertsListKey = "alerts") {
  return new Promise((resolve, reject) => { brPopRet = rc.brpop(alertsListKey, 0, (err, result) => { if (err) reject(err); else resolve(result); }); } );
}

function getNextMsgID(rc, msgIDKey = "MSGID") {
  var rP = new Promise((resolve, reject) => { rc.incr(msgIDKey, (err, result) => { if (err) reject(err); else resolve(result); })});
  const ret = await rP;
  console.log("getNextMsgID() => " + ret);
  return ret;
}
async function getSettings(rc, settingsKey = "SETTINGS") {
  var rP = new Promise((resolve, reject) => { rc.hgetall(settingsKey, (err, result) => { if (err) reject(err); else resolve(result); })});
  const ret = await rP;
  console.log("getSettings() => " + ret);
  return ret;
}

async function getChannelDefs(rc, chDefsKey = "CHANNEL_DEFS") {
  var rP = new Promise((resolve, reject) => { rc.lrange(chDefsKey, 0, -1, (err, result) => { if (err) reject(err); else resolve(result); })});
  const ret = await rP;
  console.log("getChannelDefs() => " + ret);
  return ret;
}

async function runTheLoop(rc) {
  var lastChDefVer = 0;
  var stopTheLoop = false;
  var channelDefs = {};
  console.log(rc);
  while (!stopTheLoop) {
    ret = await getNextAlert(rc);
    console.log("getNextAlert() returns " + ret);
/*
    let nextMsgId = getNextMsgID(rc);
    let settings = getSettings(rc);
    if (settings.CHANNEL_VERSION > lastChDefVer) {
      channelDefs = getChannelDefs(rc);
    };
    if (settings.SHUTDOWN) {
      stopTheLoop = true;
      break;
    };
    nextAlert["msgid"] = nextMsgId; 
    */
  };
  rc.quit();
}
redis.debug_mode = true;
var rc = redis.createClient({ url: config.dbConfig.url || "redis://127.0.0.1:6379/", connect_timeout: 2000 });
rc.on('ready', function (e) { console.log("Connected to " + (config.dbConfig.url || "redis://127.0.0.1:6379/")); runTheLoop(rc)});
rc.on('error', function (e) { 
    console.log(e + "\nConnection URL used:" +  (config.dbConfig.url || "redis://127.0.0.1:6379/"));
    process.exit(1);
  });
