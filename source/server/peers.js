'use strict';

const WebSocket = require('isomorphic-ws');
const g_constants = require("../constants")
const reqHandler = require('./reqHandler.js');
const utils = require("../utils")

let g_sentUIDS = {};
let g_ConnectedPeers = [];

let g_ConnectionsInterval = 0;

exports.IsOwnUID = function(uid)
{
    if (g_sentUIDS[uid])
        return true;
    return false;
}


let g_P2P_protocol = null;
exports.Init = async function(P2P_protocol)
{
    g_P2P_protocol = P2P_protocol;

    if (g_P2P_protocol)
    {
        if (!g_P2P_protocol["p2p"]) g_P2P_protocol["p2p"] = require("./p2p");
        
        if (!g_P2P_protocol.STARTED)
            return StopConnections();
    }

    if (g_ConnectionsInterval)
        return;
 
    ConnectNewPeers();

    g_ConnectionsInterval = setInterval(() => {
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
            ConnectNewPeers();

        const list = exports.GetConnectedPeers("-");
        console.log("Connected peers: "+JSON.stringify(list))
    }, 30000);   
    
    function StopConnections()
    {
        clearInterval(g_ConnectionsInterval);

        g_ConnectionsInterval = 0;

        for (let i=0; i<g_ConnectedPeers.length; i++)
            g_ConnectedPeers[i].close();
    }
}

exports.HandleMessage = function(client)
{
    if (g_P2P_protocol && g_P2P_protocol.STARTED)
        return g_P2P_protocol[client.request].HandleMessage(client);
}

async function ConnectNewPeers()
{
    const peers = await utils.GetPeersFromDB("time > "+(Date.now()-60*1000));

    QueryNewPeers();

    for (let i=0; i<peers.length; i++)
        Connect(unescape(peers[i].address))

    for (let i=0; i<g_constants.seeders.length; i++)
        Connect(g_constants.seeders[i]);
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

exports.broadcastMessage = function(ip, messageObject)
{
    const data = JSON.stringify(messageObject);
    
    for (let i=0; i<g_ConnectedPeers.length; i++)
    {
        if (g_ConnectedPeers[i].readyState === WebSocket.OPEN && g_ConnectedPeers[i]["remote_address"] != ip)
             g_ConnectedPeers[i].send(data);
    }
    return true;
}

exports.SavePeers = function(uid, list)
{
    if (!exports.IsOwnUID(uid))
        return;
    
    delete g_sentUIDS[uid];

    for (let i=0; i<Math.min(10, list.length); i++)
    {
        Connect(unescape(list[i].address));

        if (typeof window !== 'undefined')
            utils.SavePeer(list[i].address, false);
    }

    if (list.length == 1 && reqHandler.IsConnected(list[0].address))
        utils.SavePeer(list[0].address); 
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
    if (g_ConnectionsInterval == 0)
        return;

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

        client.onerror = function(ev) 
        {
            client["isAlive"] = false;
            delete g_TryConnect[peer];
        };
        client.onclose = function(ev) 
        {
            client["isAlive"] = false;
            delete g_TryConnect[peer];

            utils.SavePeer(peer, false);
        };

        client.onopen = function(ev)  
        {
            delete g_TryConnect[peer];

            g_ConnectedPeers.push(client);
            reqHandler.handleConnection(client);

            utils.SavePeer(peer);
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

let g_LastPeers = {peers: [], time: 0}
exports.GetLastPeers = async function(ip = null)
{
    if (!ip) ip = require("ip").address();

    if (g_LastPeers.time > Date.now() - 60*1000)
        return g_LastPeers.peers;

    g_LastPeers = {peers: [], time: Date.now()};

    const peers = await utils.GetPeersFromDB("address<>'"+escape(ip)+"'");

    for (let i=0; i<peers.length; i++)
        g_LastPeers.peers.push(unescape(peers[i].address))
    
    return g_LastPeers.peers;
}