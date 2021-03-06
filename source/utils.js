'use strict';

const g_crypto = require('crypto');
const g_constants = require('./constants')

let g_lastClear = 0;
let g_ipMessageSpeed = {}
exports.UpdateSpeed = function(ip)
{
  if (!g_ipMessageSpeed[ip])
    g_ipMessageSpeed[ip] = {firstTime: Date.now(), count: 1.0}

  g_ipMessageSpeed[ip].count++;
 
  //////////////////////////////////////////////////////////////////
  //Clear memory from old data
  if (Date.now() - g_lastClear < 60*1000) return;
  g_lastClear = Date.now();
  
  let newest = {}
  for (let key in g_ipMessageSpeed)
  {
    if (g_ipMessageSpeed[key].prevTime > Date.now() - 3600*1000)
      newest[key] = g_ipMessageSpeed[key];
  }
  g_ipMessageSpeed = newest;
  //////////////////////////////////////////////////////////////////
}
exports.GetSpeed = function(ip)
{
  if (!g_ipMessageSpeed[ip])
    g_ipMessageSpeed[ip] = {firstTime: Date.now()-2000, count: 1.0}

  //Calculate average speed for messages (messages / sec)
  const speed = (1000.0*g_ipMessageSpeed[ip].count) / (Math.max(1, Date.now() - g_ipMessageSpeed[ip].firstTime));

  if (g_ipMessageSpeed[ip].count < 100)
    return 0;

  return speed;
}

exports.IsBockedAddress = function(ip)
{
  if (ip.indexOf("127.0.0.1") > 0 || ip.indexOf(require("ip").address()) > 0)
    return true;
 
  return false; 
}


exports.Hash160 = function(arg, encode = "hex")
{
  const str = arg+"";
  
  const buffer = encode == "hex" ? Buffer.from(str, "hex") : Buffer.from(str);

  return g_crypto.createHash("ripemd160").update(buffer).digest('hex')
}

exports.createUID = function()
{
  return exports.Hash160(Math.random()+Date.now(), "")
}

exports.GetPeersFromDB = function(WHERE)
{
  return new Promise(async ok => {
    if (typeof window === 'undefined')
      return ok(await g_constants.dbTables["peers"].Select("*", WHERE, "ORDER BY time DESC LIMIT 20"));

    let peers = exports.storage.getItem("saved_peers");
    if (!peers) peers = [];

    peers.sort((a, b) => {return b.time - a.time})

    ok(peers);
  })  
}

let g_LastSavedTime = 0;
exports.SavePeer = async function(peer, connected = true, need_reverse = true)
{
  if (!peer || peer.toString().indexOf(":") == -1)
    return;

  if (Date.now() - g_LastSavedTime < 1000)
    return setTimeout(exports.SavePeer, 1000, peer, connected);

  g_LastSavedTime = Date.now();

  if (need_reverse)
  {
    try {
      const addr = peer.split(":");
      if (addr.length == 2)
      {
        require("dns").reverse(addr[0], (err, hostnames) => {
          if (err || !hostnames) return;
          for (let i=0; i<hostnames.length; i++)
            exports.SavePeer(hostnames[i]+":"+addr[1], false, false)
        })
      }
    }
    catch(e) {}
  }
  
  let peers = await exports.GetPeersFromDB();
  for (let i=0; i<peers.length; i++)
  {
    if (peers[i].address == peer)
    {
      if (connected)
        peers[i].time = g_LastSavedTime;

      if (typeof window === 'undefined')
        return g_constants.dbTables["peers"].Insert(peer, peers[i].time, err => {});
      else
        return exports.storage.setItem("saved_peers", peers);
    }
  }

  if (typeof window === 'undefined')
    return g_constants.dbTables["peers"].Insert(peer, connected ? g_LastSavedTime : 0, err => {});

  peers.push({address: peer, time: connected ? g_LastSavedTime : 0});

  peers.sort((a, b) => {return b.time - a.time})

  exports.storage.setItem("saved_peers", peers);
}

exports.storage = {
  getItem : function(key) {
      var stor;
      if (window.content != undefined)
          stor = window.content.localStorage;
      else
          stor = localStorage;
  
      var str = stor.getItem(key);
      if (str == undefined)
          return null;
      
      try {
          return JSON.parse(str);
      }
      catch(e) {
          return null;
      }
  },
  setItem : function(key, value) {
      var stor;
      if (window.content != undefined)
          stor = window.content.localStorage;
      else
          stor = localStorage;
  
    stor.setItem(key, JSON.stringify(value));
  }
};