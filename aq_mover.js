const redis = require('redis');
const mysql = require('mysql');

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
  return new Promise((resolve, reject) => { rc.brpop(alertsListKey, 0, (err, result) => { if (err) reject(err); else resolve(result); }); } );
}

function getNextMsgID(rc, msgIDKey = "MSGID") {
  return new Promise((resolve, reject) => { rc.incr(msgIDKey, (err, result) => { if (err) reject(err); else resolve(result); })});
}
async function getSettings(rc, settingsKey = "SETTINGS") {
  return new Promise((resolve, reject) => { rc.hgetall(settingsKey, (err, result) => { if (err) reject(err); else resolve(result); })});
}

async function getChannelDefs(rc, chDefsKey = "CHANNEL_DEFS") {
  return new Promise((resolve, reject) => { rc.lrange(chDefsKey, 0, -1, (err, result) => { if (err) reject(err); else resolve(result); })});
}

async function runTheLoop(rc, msc) {
  var lastChDefVer = 0;
  var stopTheLoop = false;
  var channelDefs = {};
  console.log(rc);
  while (!stopTheLoop) {
    nextAlert = await getNextAlert(rc);
    let nextMsgId = getNextMsgID(rc);
/*
    let settings = getSettings(rc);
    if (settings.CHANNEL_VERSION > lastChDefVer) {
      channelDefs = getChannelDefs(rc);
    };
    if (settings.SHUTDOWN) {
      stopTheLoop = true;
      break;
    };
    */
    nextAlert["msgid"] = nextMsgId; 
    console.log("Next alert:" + nextAlert);
  };
  rc.quit();
}

redis.debug_mode = true;
var rc = redis.createClient({ url: config.redisConfig.url || "redis://127.0.0.1:6379/", connect_timeout: 2000 });
var msc = mysql.createConnection(config.mysqlConfig);
msc.connect((err) => { console.error(err + " connecting to mysql at " + config.mysqlConfig); process.exit(2);});
rc.on('ready', function (e) { 
  console.log("Connected to redis at " + (config.redisConfig.url || "redis://127.0.0.1:6379/" + " and mysql at " + config.mysqlConfig)); 
  runTheLoop(rc, msc);
});
rc.on('error', function (e) { 
    console.error(e + "\nConnection URL used:" +  (config.dbConfig.url || "redis://127.0.0.1:6379/"));
    process.exit(1);
  });
