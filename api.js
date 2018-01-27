const http = require('http');
const mysql = require('mysql');
const qs = require('querystring');
var config = require('./config');

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

async function apiGetUsers(body) {
  var req = qs.parse(body);
  var ret = [];
  if ((req['user_mask'] != undefined) && (typeof req['user_mask'] == 'string')) {
    var userMask = req.user_mask.startsWith('@') ? req.user_mask.substr(1) : req.user_mask;
    result = await queryDB(req.user_mask.startsWith('@') ? "select * from users where lower(username) REGEXP ? " : "select * from users where lower(name) REGEXP ? ", [ userMask ]);
    while (result.length > 0) {
      var row = result.shift(); 
      ret.push({ 'id': row.id, 'name': row.name, 'username': row.username});
    };
  };
  console.log(ret);
  return ret;
}

async function apiGetChats(body) {
  var req = qs.parse(body);
  var ret = [];
  if ((req['chatgroup_mask'] != undefined) && (typeof req['chatgroup_mask'] == 'string')) {
    result = await queryDB("select * from chatgroups where lower(name) REGEXP ? " , [ req.chatgroup_mask ]);
    while (result.length > 0) {
      var row = result.shift(); 
      ret.push({ 'id': row.id, 'name': row.name});
    };
  };
  console.log(ret);
  return ret;
}

async function apiGetMsgs(body) {
  var req = qs.parse(body);
  var ret = [];
  var conds = [];
  var condValues = [];
  var order = "ASC";
  if ((req['user_mask'] != undefined) && (typeof req['user_mask'] == 'string')) {
    var userMask = req.user_mask.startsWith('@') ? req.user_mask.substr(1) : req.user_mask;
    conds.push(req.user_mask.startsWith('@') ? "lower(u.username) REGEXP ? " : "lower(u.name) REGEXP ? ");
    condValues.push(userMask);
  }  
  if ((req['chatgroup_mask'] != undefined) && (typeof req['chatgroup_mask'] == 'string')) {
    conds.push("lower(c.name) REGEXP ?");
    condValues.push(req['chatgroup_mask']);
  };
  if ((req['search_term'] != undefined) && (typeof req['search_term'] == 'string')) {
    conds.push("lower(m.contents) REGEXP ?");
    condValues.push(req['search_term']);
  };
  if (req['start_date'] != undefined) {
    conds.push("m.date >= ?");
    condValues.push(parseInt(req['start_date']) != NaN ? parseInt(req['start_date']) : 0);
  };
  if (req['end_date'] != undefined) {
    conds.push("m.date <= ?");
    condValues.push(parseInt(req['end_date']) != NaN ? parseInt(req['end_date']) : Math.floor(Date.now() / 1000));
  };
  if (req['start_msgid'] != undefined) {
    conds.push("m.id >= ?");
    condValues.push(parseInt(req['start_msgid']));
  } else
  if (req['end_msgid']) {
    conds.push("m.id <= ?");
    condValues.push(parseInt(req['end_msgid']));
    order = "DESC";
  };
  // Assembling all the conditions, considering ignored groups and users;
  var q = "select c.id as chatgroup_id, c.name as chatgroup_name, u.id as sender_id, u.name as sender_name,  u.username as sender_username, m.id as msgid, m.timestamp as ts, m.contents as contents" ;
  q += " from chatgroups c , users u, messages m where c.ignored = 0 and u.ignored = 0 ";
  q += conds.length > 0 ? " and " + conds.join(" and ") : "";
  q += " and m.sender_id=u.id and m.group_id=c.id order by m.id " + order + " limit 100";
  console.log(q);
  try  {
    var pR, fields;
    [ pR, fields ]  = await queryDB(q ,  condValues);
  } catch (e) {
    console.log(e);
    return ret;
  };

  while (pR.length > 0) {
    var row = pR.shift(); 
    var retRow = {}
    fields.forEach((field) => { retRow[field.name] = row[field.name]; });
    ret.push(retRow);
  };
  console.log(ret);
  return ret;
}

var dispatcherTable  = {
  "api" : {"get_users": apiGetUsers, "get_chats": apiGetChats , "get_msgs" :  apiGetMsgs }
}

function processRequest(url, body, response) {
  var parts = url.split('/');
  parts.shift(); // getting rid of first empty string
  var dispPtr = dispatcherTable;
  var currPath = "";
  while (parts.length > 0) {
    var part = parts.shift();
    currPath = currPath + "/" + part;
    dispPtr = dispPtr[part];
    if (typeof dispPtr === "function" ) {
        response.writeHeader(200, "OK here are your results");
        dispPtr(body).then((apiRet) => {
          response.write(JSON.stringify(apiRet));
          response.end();
        });
        break;
    } else {
      if (typeof dispPtr == 'undefined') {
        console.log("Can't find a handler for " + currPath);
        response.writeHeader(404, "Not found");
        response.end();
        break;
      };
    }
  };
}

function httpListener(request, response) {
  let body = [];
  const { method, url } = request;
  request.on('data', (chunk) => { body.push(chunk.toString()) }).on('end', () => { processRequest(request.url, body.join(''), response); });
}

var con = mysql.createConnection(config.dbConfig);
con.connect(function (err) { if (err) { throw err }; });
http.createServer(httpListener).listen(9090); 


