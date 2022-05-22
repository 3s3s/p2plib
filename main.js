'use strict';

const server = require("./source/server/server")
const reqHandler = require("./source/server/reqHandler")
const peers = require("./source/server/peers")
const utils = require("./source/utils")
const g_constants = require("./source/constants")

let g_P2P_protocol = {STARTED: false, __handlers__: {}}

exports.StartServer = function(P2P_protocol = {STARTED: true, __handlers__: {}})
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
    try {
        const connected = exports.GetConnectedPeers();

        if (!connected || !connected.length) throw new Error("Offline: no connected peers.")

        const message = {request: "custom", params: params}
        const uid = exports.broadcastMessage(message);

        if (uid) g_Callbacks[uid] = {callback: callback, time: Date.now()};

        FreeMemory();
    }
    catch(e) {
        callback({result: false, message: e.message})
    }
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

    if (params["command"] == "answer" && !!g_Callbacks[params.destination] && !!params.values)
    {
        try {
            g_Callbacks[params.destination].time = 0;
            g_Callbacks[params.destination].callback(params.values);
        }
        catch(e) {
            console.log(e)
        }
    }
}

let g_bProcessingFreeMemory = false;
function FreeMemory()
{
    if (g_bProcessingFreeMemory)
        return;

    g_bProcessingFreeMemory = true;

    try {
        const date = Date.now();

        let tmp = {}
        for (let key in g_Callbacks)
        {
            if (g_Callbacks[key] && g_Callbacks[key].time < date - 3*60*1000)
            {
                try {
                    g_Callbacks[key].callback({__result__: false, __message__: "p2plib timeout"});
                }
                catch(e){}
                continue;
            }
            tmp[key] = g_Callbacks[key];
        }
        g_Callbacks = tmp;
    }
    catch(e) {}

    g_bProcessingFreeMemory = false;
}

global.p2plib = function(start = true) 
{
    this.GetConnectedPeers = exports.GetConnectedPeers;
    this.GetLastSavedPeers = exports.GetLastSavedPeers;
    this.SendMessage = exports.SendMessage;
    this.ProcessAnswer = exports.ProcessAnswer;

    g_P2P_protocol["__handlers__"] = {}

    this.StartPeer = function(options = null) {
        if (options)
        {
            for (let key in options)
                g_P2P_protocol[key] = options[key]
        }
        g_P2P_protocol.STARTED = true;

        StartPeer(g_P2P_protocol)
    }
    this.StopPeer = function() {
        g_P2P_protocol.STARTED = false;
        StartPeer(g_P2P_protocol)
    }

    this.StartServer = function(options = null) {
        if (options)
        {
            for (let key in options)
                g_P2P_protocol[key] = options[key]
        }
        g_P2P_protocol.STARTED = false;

        exports.StartServer(g_P2P_protocol)
    }
    this.StopServer = function() {
        g_P2P_protocol.STARTED = true;
        exports.StartServer(g_P2P_protocol)
    }
    this.IsStarted = function () {return g_P2P_protocol.STARTED;}

    this.on = function(message, handler) {
        g_P2P_protocol["__handlers__"][message] = handler;
    }

    if (start) this.StartPeer();

    return this;
    
    function StartPeer (PROTOCOL = {STARTED:true, __handlers__: {}})
    {
        peers.Init(PROTOCOL);
    
        g_P2P_protocol = PROTOCOL;
    }
}
