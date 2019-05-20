const redis = require('redis');
const mysql = require('mysql');
const jsep = require('jsep');

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

function parseChannelDefs(chDefsList, lastChDefVer) {
  var ret = [];
  const reqdProps = ["id", "version", "rules"];
  for (let chDef of chDefsList[1]) {
    let cd = JSON.parse(chDef);
    let missingRules = [];
    reqdProps.forEach((prop) => {  if (cd.hasOwnProperty(prop) == false) missingRules.push(prop); });
    if (missingRules.length > 0) {
      console.error("Channel " +  chDef  +  " missing required properties: " + prop);
      continue;     
    };
    if (cd.version <= lastChDefVer) {
      // Rule has not been changed, skip
      continue;
    };
    let ruleList = [];
    cd.rules.forEach(function (_rule) {      
      if (((cd.id != 0) && (_rule.src >= _cd.id)) || ((cd.id == 0) && (_rule.src != 0))) {
        console.error("Channel #"  + cd.id + " potential channel filter loop at rule with src " + _rule.src);
        continue; // crude attempt at not allowing filter loops; also skipping entire channel filter 
      };
      let tree = undefined;
      try { _tree = jsep(_rule.cond); } catch (e) {
        console.error("Failed to parse rule " + _rule.cond + " of channel def #" +_cd.id);
        continue; // skip this channel definition completely;
      };
      ruleList.push({ "src": _rule.src, "cond": _tree });
    });
    if (ruleList.length > 0) {
      ret.push({ "id": cd.id, "version": cd.version, "rules": ruleList});
    };
  }
  return ret;
}

function mergeChDef(channelDefs, def) {
  // here we have full current array (yes, this is an array) of actual channel filters, and new channel filter that should replace current entry
  // first , let's compare sources for current and new entry, to ensure we won't have broken links 
  var cdPs = []; // current def parents
  var ndPs = []; // new def parents
  def.rules.forEach((_r) => ndPs.push[_r.src]);
  var cE = channelDefs[def.id]; // current entry 
  if (cE != undefined) {
    cE.rules.forEach((_r) => cdPs.push[_r.src]);
  };
  // Apologies. We're keeping array of destinations (channel filters on the next level) in dsts array for each source channel filter . 
  // If current version of channel filter has some channel as a source in any of it's rules, and new version does not have that, 
  // then we need to remove channeld id from that source channel's dsts array
  cdPs.forEach((_id) => { if !ndPs.includes(_id) {
        cdP = channelDefs[_id];
        cdP.dsts = cdP.dsts.filter(__id => __id != def.id ); 
      };
    }); 
    // And ensure new sources have their dsts properly updated 
  ndPs.forEach((_id) => {
    cdP = channelDefs[_id];
    if (cdP != undefined) {
      if (!cdP.dsts.includes(def.id) {
        cdP.dsts.push(def.id);
      };
    } else {
      console.error("channel filter #" +  def.id + " lists missing channel filter #" + _id + " as source; this won't work" );
    };
  });
  // Ok we linked this filter with parent sources
  channelDefs[def.id] = def;
}

function processMessage(channelDefs, startChId, parentChId, msg) { // The gist of all this . Recursive, of course
  var ret = [];
  var counter = 0;
  var cd = channelDefs[startChId];
  if (cd == undefined) {
    console.error("Unknown channel def #" + startChId );
    return ret;
  };
  for (const _r of cd.rules) {
    if (_r.src == parentChId) {
      counter += 1; // will use that for possibly invalid src<->dst link checks
      if (evaluateChRule(_r.cond, msg) == true) {
        ret.push(cd.id);
        break; // do not allow several rules in one channel filter with the same parent id. cram all conditions into one rue
      };
    };
  };
  if (ret.length > 0 ) { 
    // Struck a match
    for (const dstId of ret.dsts) {
      ret = ret.concat(processMessage(channelDefs, dstId, cd.id, msg)); // recursion
    };
  } else {
    if (counter == 0) {
      console.error("Channel def #" + parentChId + " lists channel def #" + ch.id + " as destination, but no rule in latter has former as source");
    };
  }
  return ret;
}


function evaluateChRule(jsrt, msg ) {
  var ret = false;

}

async function runTheLoop(rc, msc) {
  var channelDefsVersion = 0;
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
    if (settings.CHANNEL_VERSION > channelDefsVersion) {
      let _nd = await getChannelDefs(rc);
      let newDefs = parseChannelDefs(_nd, channelDefsVersion);
      if (newDefs != false) {
        newDefs.forEach((def) => mergeChDef(channelDefs, def));
        channelDefsVersion = settings.CHANNEL_VERSION;
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
jsep.addBinaryOp("~=", 6); // Check jsep source 
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
