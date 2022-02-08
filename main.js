'use strict';

const server = require("./source/server/server")
const reqHandler = require("./source/server/reqHandler")
const peers = require("./source/server/peers")
const utils = require("./source/utils")
const g_constants = require("./source/constants")

let g_P2P_protocol = {STARTED: false}

exports.StartServer = function(P2P_protocol = {STARTED: true})
{
    if (g_P2P_protocol.STARTED)
        return;
    
    if (typeof window === 'object')
    {
        console.error('Could not to start server in browser')
        return;
    }

    if (!P2P_protocol["STARTED"]) P2P_protocol["STARTED"] = true;
    
    g_P2P_protocol = P2P_protocol;

    server.StartServer(P2P_protocol);
}

exports.GetListenPort = function()
{
    return g_P2P_protocol["my_portSSL"] || g_constants.my_portSSL;
}

exports.StartPeer = function(PROTOCOL = {STARTED:true})
{
    peers.Init(PROTOCOL);

    g_P2P_protocol = PROTOCOL;
}

exports.GetConnectedPeers = function()
{
    return peers.GetConnectedPeers();    
}

exports.GetLastSavedPeers = function()
{
    return new Promise(async ok => {
        return ok(await utils.GetPeersFromDB())
    })
}

exports.broadcastMessage = function(message)
{
    if (!message)
        return 0;
    if (!message.request || !message.request.length)
        return 0;
    if (!message.params)
        return 0;
    
    if (!message.params["TTL"]) message.params["TTL"] = 3;
    if (!message.params["uid"]) message.params["uid"] = peers.createUID();
            
    reqHandler.broadcastMessage(require("ip").address(), message);

    return message.params["uid"];
}