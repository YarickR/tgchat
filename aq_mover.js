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

function incrMsgID(rc, settingsKey = "SETTINGS", msgIDKey = "MSGID") {
  return new Promise((resolve, reject) => { rc.hincrby(settingsKey, msgIDKey, 1, (err, result) => { if (err) reject(err); else resolve(result); })});
}
async function getSettings(rc, settingsKey = "SETTINGS") {
  return new Promise((resolve, reject) => { rc.hgetall(settingsKey, (err, result) => { if (err) reject(err); else resolve(result); })});
}

async function getChannelDefs(rc, chDefsKey = "CHANNEL_DEFS") {
  return new Promise((resolve, reject) => { rc.lrange(chDefsKey, 0, -1, (err, result) => { if (err) reject(err); else resolve(result); })});
}

async function connectToMySQL(msc) {
  return new Promise((resolve,reject) => { 
    msc.connect((err) => { 
      if (err) { 
        console.error(err + " connecting to MySQL"); 
        reject(err);
      } else {
        console.log("Connected to MySQL");
        resolve(1);
      };
    });
  });
}

function parseChannelDefs(chDefsList, lastChDefVer, newChDefsVer) {
  return false;
}

async function runTheLoop(rc, msc) {
  var lastChDefVer = 0;
  var stopTheLoop = false;
  var channelDefs = {};
  var nextMsgID = 0;
  var settings = false;
  try {
    await connectToMySQL(msc);
  } catch (e) {
    stopTheLoop = true;
  };
  while (!stopTheLoop) {
    try {
      nextAlert = await getNextAlert(rc);
    } catch (e) {
      console.error("Failed to get next alert, exiting the loop");
      stopTheLoop = true;
      break;
    };
    nextAlert = JSON.parse(nextAlert[1]);
    for ( let _a of nextAlert.message.alerts) {
      try {
        await incrMsgID(rc);
      } catch (e) {
        console.error("Failed to increase message id, stopping, lost alert:" + nextAlert);
        stopTheLoop = true;
        break;
      };
      try {
        settings = await getSettings(rc);
      } catch (e) {
        console.error("Failed to get new settings, stopping, lost alert: " +nextAlert);
      };
      _a["msgid"] = settings.MSGID;
      console.log("next alert:");
      console.log(_a);
    };
    if (settings.CHANNEL_VERSION > lastChDefVer) {
      chDefsList = await getChannelDefs(rc);
      let newChDefs = parseChannelDefs(chDefsList, lastChDefVer, settings.CHANNNEL_VERSION);
      if ( newChDefs != false) {
        lastChDefVer = settings.CHANNEL_VERSION;
        channelDefs = newChDefs;
      } else {
        console.log("Failed to parse new channel defs , continuing with version " + lastChDefVer);
      };
    };
    if (settings.SHUTDOWN == 1) {
      stopTheLoop = true;
      break;
    };
    console.log("next cycle");
  };
  rc.quit();
  process.exit(0);
}

redis.debug_mode = true;
var rc = redis.createClient({ url: config.redisConfig.url || "redis://127.0.0.1:6379/", connect_timeout: 2000 });
var msc = mysql.createConnection(config.mysqlConfig);
rc.on('ready', function (e) { 
  console.log("Connected to redis at " + (config.redisConfig.url || "redis://127.0.0.1:6379/")); 
  runTheLoop(rc, msc);
});
rc.on('error', function (e) { 
    if (redis.debug_mode != true) {
      console.error(e + " connecting to redis");
    };
    process.exit(1);
  });
console.log("End of main module, entering the async event loop");
