started = 0
our_id = 0

dbUser = "tgchat"
dbPassword = "rees7Shae0Thaf"
dbName = "tgchat"
dbHost = "socfarm.ru"
dbPort = 3306

package.cpath = package.cpath .. ";/usr/lib/lua/luarocks/lib/lua/5.1/?.so"
package.path = package.path .. ";./?.lua"
local sqlDrv = require "luasql.mysql"
tdBot = require "tdbot"
env = assert(sqlDrv.mysql(), "Can't init mysql driver")

userCache = {}
chatCache = {}


function connDB(host, port, user, pass, db)
  print("connDB")
  conn = assert(env:connect(db,user,pass, host, port), "Failed to connect")
  conn:execute("set wait_timeout=3600")
  conn:execute("set interactive_timeout=3600")
  conn:execute("set names utf8")
end

connDB(dbHost, dbPort, dbUser, dbPassword, dbName)

function safeSQL(stmt)
  print("safeSQL")
  local stmtRet, stmtErr
  local cycleCount = 1
  repeat
    stmtRet, stmtErr = conn:execute(stmt)
    if stmtRet == nil then
      if string.find(stmtErr, "MySQL server has gone away") then
        print("Seems like DB server went south, reconnecting" )
        connDB(dbHost, dbPort, dbUser, dbPassword, dbName)
        
        cycleCount = cycleCount + 1
      else
        print("SQL error: " .. stmtErr)
        return nil
      end
    else
      return stmtRet  -- either number or cursor , per documentation
    end
  until cycleCount > 3
  print("tried " .. stmt  .. " " .. cycleCount .. " times, got nil anyway")
  return nil 
end

function vardump(value, depth, key)
  local linePrefix = ""
  local spaces = ""
  
  if key ~= nil then
    linePrefix = "["..key.."] = "
  end
  
  if depth == nil then
    depth = 0
  else
    depth = depth + 1
    for i=1, depth do spaces = spaces .. "  " end
  end
  
  if type(value) == 'table' then
    mTable = getmetatable(value)
    if mTable == nil then
      print(spaces ..linePrefix.."(table) ")
    else
      print(spaces .."(metatable) ")
        value = mTable
    end		
    for tableKey, tableValue in pairs(value) do
      vardump(tableValue, depth, tableKey)
    end
  elseif type(value)	== 'function' or 
      type(value)	== 'thread' or 
      type(value)	== 'userdata' or
      value		== nil
  then
    print(spaces..tostring(value))
  else
    print(spaces..linePrefix.."("..type(value)..") "..tostring(value))
  end
end


function ok_cb(extra, success, result)
end

-- Notification code {{{

function get_title (P, Q)
  if (Q.type == 'user') then
    return P.first_name .. " " .. P.last_name
  elseif (Q.type == 'chat') then
    return Q.title
  elseif (Q.type == 'encr_chat') then
    return 'Secret chat with ' .. P.first_name .. ' ' .. P.last_name
  else
    return ''
  end
end

-- }}}
function checkOrCreateUser(userData)
  print("checkOrCreateUser")
  local numR = {}
  local cur = safeSQL("select count(*) as counter from users where id = " .. userData.id)
  if cur == nil then 
    print("Error doing select count(*) as counter from users where id = " .. userData.id);
    return nil 
  end
  cur:fetch(numR, "a")
  local name = ""
  local space = ""
  local userName = ""
  if (userData["first_name"] ~= nil) then 
    name = userData["first_name"]
    space = " "
  end
  if (userData["last_name"] ~= nil) then
    name = name .. space .. userData["last_name"]
  end
  if (userData["username"] ~= nil) then
    userName = userData["username"]
  end
  name = conn:escape(name)
  if numR.counter == "0" then
    
    local ret = safeSQL("insert into users (id, name, username) values (".. userData.id .. ", '" .. name .. "', '" .. userName .."')")
    if ret == nil then
      print("Error creating new user with id " .. userData.id)
      return 0
    end
  else 
    local ret = safeSQL("update users set name = '" .. name .. "' , username = '" .. userName .."' where id = " .. userData.id)
    if ret == nil then
      print("Error updating user with id " .. userData.id)
      return 0
    end
  end
  return userData.id
end

function checkOrCreateCh(chData)
  print("checkOrCreateCh")
  if (chData["@type"]  ~= "chat") or (chData["type"]["@type"] == "chatTypePrivate") then
    return 0
  end
  local chId = tonumber(tdBot.getChatId(chData["id"]).id)
  
  if (chId <=  0) then
    return 0
  end
  
 -- TODO: insert into chatroups on duplicate key update 
  local cur = safeSQL("select count(*) as counter from chatgroups where id = " .. chId)
  if cur == nil  then 
    print("Error doing select count(*) as counter from chatgroups where id = " .. chId)
    return 0 
  end
  local numR = {}
  cur:fetch(numR, "a")
  name = conn:escape(chData["title"])
  if numR.counter == "0" then
    local ret = safeSQL("insert into chatgroups (id, name) values (".. chId .. ", '" .. name .."')")
    if ret == nil then 
      print("Error creating channel with id " .. chId .. " and title " .. name)
      return 0
    end
  else
    local ret = safeSQL("update chatgroups set name = '" ..name.. "' where id = " .. chId)
    if ret == nil then
      print("Error updating channel with id " .. chId .. " and title " .. name)
      return 0
    end
  end
  return chId
end

function addNewMessage(text, ts, sender, channel)
  print("addNewMessage")
  local msg = text and conn:escape(text) or ''
  local numRows = safeSQL("insert into messages (sender_id, group_id, timestamp, contents) values (" ..sender .. ", " .. channel .. ", " .. ts .. ", '" .. msg .. "')")
  if numRows  == 0 or numRows == nil then
    print("Error doing  " .. " insert into messages (sender_id, group_id, timestamp, contents) values (" ..sender .. ", " .. channel .. ", " .. ts .. ", '" .. msg .. "')")
    return 0
  else
    print("Inserted " .. numRows .. " line(s)")
    safeSQL("update chatgroups set mtime = " .. ts .. " where id = " .. channel  )
    return numRows
  end  
end 

function on_msg_receive (msg, chat)
  print("on_msg_receive")
  chatId = chat["id"]
  if (msg["@type"] ~= "message") or not msg["sender_user_id"] or not chat["id"] or not chat["type"] then
    print("Invalid arguments to 'on_msg_receive': " )
    vardump(msg)
    vardump(chat)
    return 0
  end
  if (chat["type"] == "chatTypeBasicGroup") or (chat["type"] == "chatTypeSupergroup") then
    local uC = userCache[msg["sender_user_id"]]["data"]
    local cC = chatCache[chat["id"]]["data"]
    local mT = "*Empty text*"
    if msg["content"] and msg["content"]["text"] and msg["content"]["text"]["text"] then
      mT = msg["content"]["text"]["text"]  
    end
    if (addNewMessage(mT, msg["date"], msg["sender_user_id"], chat["id"]) > 0) then
      print("Added message:")
      print("From: " .. uC["first_name"] .." " .. uC["last_name"])
      print("To: " .. cC["title"] )
      print("Body: " .. mT)
    else
      print("Error adding new message:")
      vardump(msg)
      vardump(chat)
      vardump(uC)
      vardump(cC)
      vardump(mT)
    end
  end
end


function tdbot_update_callback (data)
  if (data["@type"] == "updateNewMessage") then
      print("updateNewMessage")
      local msg = data["message"]
      if msg["sender_user_id"] and msg["chat_id"]  then
        local userId = tonumber(msg["sender_user_id"])
        if not userCache[userId] then
          print("Updating cache for user " .. userId)
          userCache[userId] =  { data = { id = userId, username = "", first_name = "Unknown", last_name = "User"}, loading = 1}
          checkOrCreateUser(userCache[userId]["data"]) -- creaing bogus record, so we can reference user id later at addNewMessage
          tdBot.getUser(userId, on_user_update, userId)
        end
     	local chatId = tonumber(tdBot.getChatId(msg["chat_id"]).id)
        if not chatCache[chatId] then
          print("Priming cache for chat " .. chatId)
          chatCache[chatId] = { pending = {} , data = {  }, loading = 1 }
          tdBot.getChat(msg["chat_id"], on_chat_update, msg["chat_id"])
        end
        local chat = chatCache[chatId]
        if not chat["data"]["id"] then
          print("Placing messages to pending queue")
          table.insert(chat["pending"], msg) 
        else
          if chat["data"]["type"] ~= "chatTypePrivate" then
            on_msg_receive(msg, chat["data"])
          end
        end
      else
        print("*** Invalid payload ***")
        vardump(msg)
      end
  elseif (data["@type"] == "updateUser") then
    print("updateUseR")
    on_user_update(data["user"]["id"], data["user"])
  end

end
function on_our_id (id)
  our_id = id
end

function on_user_update (userId, data)
  print("user id " .. userId .. " username : *" .. (data["username"] or "") .. "*, name :*" .. (data["first_name"] or "") .. " " .. (data["last_name"] or "") .. "*") 
  if not userCache[userId] then 
    userCache[userId] = { data = { id = userId, username = "", first_name = "Unknown", last_name = "User"}, loading = 1}
  end
  local user = userCache[userId]
  if (user["loading"] == 1) or (user["data"]["id"] ~= data["id"]) or (user["data"]["username"] ~= data["username"]) or (user["data"]["first_name"] ~= data["first_name"]) or (user["data"]["last_name"] ~= data["last_name"]) then
    local newData = { id = userId, username = data["username"] or "", first_name = data["first_name"] or "Unknown" , last_name = data["last_name"] or "User" }
    user["data"] = newData
    user["loading"] = 0
    checkOrCreateUser(newData)
  end 
end

function on_chat_update (chat_id, data)
  local chatId = tonumber(tdBot.getChatId(chat_id).id)
  print("chat id " .. chatId .. " title: " .. data["title"] or "Unknown title")
  if not chatCache[chatId] then
    print("Priming cache for chat " .. chatId)
    chatCache[chatId] = { pending = {}, data = {}, loading = 1 } 
  end
  local chat = chatCache[chatId]
  if (chat["loading"] == 1) or (chat["data"]["title"] ~= data["title"]) then
    chat["loading"] = 0
    chat["data"]["id"] = chatId 
    chat["data"]["title"]= data["title"]
    chat["data"]["type"] = data["type"]["@type"]
    checkOrCreateCh(data)
  end
  if (chat["loading"]== 0) and (#chat["pending"] > 0) then
    print("Pushing pending messages for this chat")
    if chat["data"]["type"] ~= "chatTypePrivate" then
      for _, msg in pairs(chat["pending"]) do
        on_msg_receive(msg, chat["data"])
      end
    end
    chat["pending"] = {}
  end
end

function on_secret_chat_update (schat, what)
  vardump (schat)
end

function on_get_difference_end ()
end

function cron()
  -- do something
  postpone (cron, false, 1.0)
end

function on_binlog_replay_end ()
  started = 1
  postpone (cron, false, 1.0)
end
