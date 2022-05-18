'use strict';

const server = require("./source/server/server")
const reqHandler = require("./source/server/reqHandler")
const peers = require("./source/server/peers")
const utils = require("./source/utils")
const g_constants = require("./source/constants")

let g_P2P_protocol = {STARTED: false}

exports.StartServer = function(P2P_protocol = {STARTED: true})
{
    if (g_P2P_protocol.STARTED) return;
    
    if (typeof window === 'object')
        return console.error('Could not to start server in browser')

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
    if (!message) return 0;
    if (!message.request || !message.request.length) return 0;
    if (!message.params) return 0;
    
    if (!message.params["TTL"] && message.params["TTL"] !== 0) message.params["TTL"] = 3;
    if (!message.params["uid"]) message.params["uid"] = peers.createUID();
            
    reqHandler.broadcastMessage(require("ip").address(), message);

    return message.params["uid"];
}

let g_Callbacks = {};

exports.SendMessage = function(params, callback)
{
    const connected = exports.GetConnectedPeers();

    if (!connected.length)
        return setTimeout(exports.SendMessage, 50000, params, callback)

    const message = {request: "custom", params: params}
    const uid = exports.broadcastMessage(message);

    if (uid) g_Callbacks[uid] = {callback: callback, time: Date.now()};

    FreeMemory();
}

exports.ProcessAnswer = function(params, answerPublic = null)
{
    if (answerPublic != null)
    {
        exports.broadcastMessage({
            request: "custom", 
            params: {
                destination: params["uid"], 
                command: "answer", 
                serverKey: params.serverKey || false, 
                values: answerPublic
            }
        });
    }

    if (params["command"] == "answer" && !!g_Callbacks[params.destination] && params.values)
    {
        try {
            g_Callbacks[params.destination].callback(params.values);
        }
        catch(e) {}
        delete g_Callbacks[params.destination];
    }
}

async function FreeMemory()
{
    const date = Date.now();

    let tmp = {}
    for (let key in g_Callbacks)
    {
        if (g_Callbacks[key] && g_Callbacks[key].time < date - 3*60*1000)
        {
            try {
                await g_Callbacks[key].callback({__result__: false, __message__: "p2plib timeout"});
            }
            catch(e)
            {}
            continue;
        }
        tmp[key] = g_Callbacks[key];
    }
    g_Callbacks = tmp;
}

global.p2plib = function(PROTOCOL = {STARTED:true}) 
{
    this.GetConnectedPeers = exports.GetConnectedPeers;
    this.GetLastSavedPeers = exports.GetLastSavedPeers;
    this.SendMessage = exports.SendMessage;
    this.ProcessAnswer = exports.ProcessAnswer;

    exports.StartPeer(PROTOCOL)
}