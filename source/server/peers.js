'use strict';

const WebSocket = require('isomorphic-ws');
const g_constants = require("../constants")
const reqHandler = require('./reqHandler.js');
const utils = require("../utils")

let g_sentUIDS = {};
let g_ConnectedPeers = [];

exports.IsOwnUID = function(uid)
{
    if (g_sentUIDS[uid])
        return true;
    return false;
}

let g_P2P_protocol = null;

exports.UpdateProtocol = function(P2P_protocol)
{
    g_P2P_protocol = P2P_protocol;
}

exports.Init = async function(P2P_protocol = {STARTED: true})
{
    exports.UpdateProtocol(P2P_protocol);

    if (g_P2P_protocol)
    {
        if (!g_P2P_protocol["p2p"]) g_P2P_protocol["p2p"] = require("./p2p");

        g_P2P_protocol["seeders"] = g_P2P_protocol["seeders"] ? g_P2P_protocol["seeders"].concat(g_constants.seeders) : g_constants.seeders;
        
        if (!g_P2P_protocol.STARTED)
            return StopConnections();
    }

    ReconnectNewPeers();

    function StopConnections()
    {
        for (let i=0; i<g_ConnectedPeers.length; i++)
            g_ConnectedPeers[i].close();
    }
}

async function ReconnectNewPeers()
{
    if (!g_P2P_protocol.STARTED)
        return;

    let alivePeers = [];
    for (let i=0; i<g_ConnectedPeers.length; i++)
    {
        if (g_ConnectedPeers[i]["isAlive"] === false)
        {
            console.log("Terminate dead connection: "+g_ConnectedPeers[i]["remote_address"])
            g_ConnectedPeers[i].close();
            continue;
        }
        g_ConnectedPeers[i]["isAlive"] = false;
        alivePeers.push(g_ConnectedPeers[i])
    }
    g_ConnectedPeers = alivePeers;

    if (g_ConnectedPeers.length < g_constants.MAX_CONNECTIONS)
        await ConnectNewPeers();

    const list = exports.GetConnectedPeers("-");
    console.log("Connected peers: "+JSON.stringify(list))

    setTimeout(ReconnectNewPeers, 30000)
}

exports.HandleMessage = function(client)
{
    if (!client || !client["params"] || !client.params["command"])
        return;

    if (!!g_P2P_protocol && !!g_P2P_protocol.STARTED && !!client.params["uid"])
    {
        //g_P2P_protocol[client.request].HandleMessage(client.params);
        const message = client.params["command"];
        if (!!g_P2P_protocol["__handlers__"] && !!g_P2P_protocol["__handlers__"][message])
            g_P2P_protocol["__handlers__"][message](client.params)
    }

    return require("./p2p").HandleMessage(client.params)
}

async function ConnectNewPeers()
{
    const peers = await utils.GetPeersFromDB("");

    QueryNewPeers();

    for (let i=0; i<peers.length; i++)
    {
        Connect(unescape(peers[i].address))
    }

    for (let i=0; i<g_P2P_protocol["seeders"].length; i++)
        Connect(g_P2P_protocol["seeders"][i]);
}

exports.createUID = function()
{
    const uid = utils.createUID();
    g_sentUIDS[uid] = {time: Date.now()};

    return uid;
}

function QueryNewPeers()
{
    reqHandler.broadcastMessage("", {request: "p2p", params: {command: "getPeers", uid: exports.createUID(), TTL: 3} })

    ClearMemory()
}

exports.GetPort = function(ws)
{
    const responce = {request: "p2p", params: {command: "getPort", uid: exports.createUID(), TTL: 0, address: ws["remote_address"]} };

    if (ws.readyState === WebSocket.OPEN) 
        return ws.send(JSON.stringify(responce));    

    ClearMemory()
}

exports.GetPeers = function()
{
    return g_ConnectedPeers;
}


exports.SavePeers = function(uid, list)
{
    if (!exports.IsOwnUID(uid))
        return;
    
    g_sentUIDS[uid].time = 0;
    ClearMemory();

    if (!list.length)
        return;

    for (let i=0; i<Math.min(10, list.length); i++)
    {
        const address = unescape(list[i].address);
        Connect(address);

        if (typeof window !== 'undefined')
            utils.SavePeer(address, false);
    }

    const address = unescape(list[0].address);

    if (list.length == 1 && reqHandler.IsConnected(address))
        utils.SavePeer(address); 
}

exports.IsConnected = function(peer)
{
    for (let i=0; i<g_ConnectedPeers.length; i++)
    {
        if (peer == g_ConnectedPeers[i]["remote_address"])
            return true;
    }
    return false;
}


let g_TryConnect = {}
function Connect(peer)
{
    if (utils.IsBockedAddress(peer))
        return;
        
    try {
        for (let key in g_TryConnect)
        {
            if (g_TryConnect[key].peer == peer)
                return;
        }

        if (reqHandler.IsConnected(peer))
            return;

        if (g_ConnectedPeers.length > g_constants.MAX_CONNECTIONS)
            return;

        g_TryConnect[peer] = {peer: peer, time: Date.now()}

        const protocol = peer.indexOf("://") == -1 ? "wss://" : "";

        const client = new WebSocket(protocol + peer);

        client["remote_address"] = peer;
        client["isAlive"] = false;

        g_ConnectedPeers.push(client)

        client.onerror = function(ev) 
        {
            this["isAlive"] = false;
            if (!!g_TryConnect[this["remote_address"]]) g_TryConnect[this["remote_address"]].time = 0;
        };
        client.onclose = function(ev) 
        {
            this["isAlive"] = false;
            if (!!g_TryConnect[this["remote_address"]]) g_TryConnect[this["remote_address"]].time = 0;

            utils.SavePeer(this["remote_address"], false);
        };

        client.onopen = function(ev)  
        {
            reqHandler.handleConnection(this);

            utils.SavePeer(this["remote_address"]);

            if (!!g_TryConnect[this["remote_address"]]) g_TryConnect[this["remote_address"]].time = 0;
        }
    }
    catch(e) {
        console.log("Connect to " + peer + "catch error: " + e.message)
    }
}

function ClearMemory()
{
    let freshUIDS = {}
    for (let uid in g_sentUIDS)
    {
        if (Date.now() - g_sentUIDS[uid].time < 60*1000)
            freshUIDS[uid] = g_sentUIDS[uid];
    }
    g_sentUIDS = freshUIDS;

    let freshPeers = {}
    for (let peer in g_TryConnect)
    {
        if (Date.now() - g_TryConnect[peer].time < 60*1000)
            freshPeers[peer] = g_TryConnect[peer];   
    }
    g_TryConnect = freshPeers;
}

exports.GetConnectedPeers = function(ip = null)
{
    if (!ip) ip = require("ip").address();

    let list = [];
    for (let i=0; i<g_ConnectedPeers.length; i++)
    {
        if (g_ConnectedPeers[i].readyState === WebSocket.OPEN && g_ConnectedPeers[i]["remote_address"] != ip)
            list.push(g_ConnectedPeers[i]["remote_address"]);
    }
    
    return list;
}

let g_lastClear = 0;
let g_LastPeers = {peers: [], time: 0}
exports.GetLastPeers = async function(ip = null)
{
    if (Date.now() - g_lastClear < 60*1000) return;
    g_lastClear = Date.now();

    if (!ip) ip = require("ip").address();

    if (g_LastPeers.time > Date.now() - 60*1000)
        return g_LastPeers.peers;

    g_LastPeers = {peers: [], time: Date.now()};

    const peers = await utils.GetPeersFromDB("address<>'"+escape(ip)+"'");

    for (let i=0; i<peers.length; i++)
        g_LastPeers.peers.push(unescape(peers[i].address))
    
    return g_LastPeers.peers;
}