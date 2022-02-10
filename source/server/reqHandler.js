'use strict';

const WebSocket = require('isomorphic-ws');
const utils = require("../utils")
const g_constants = require("../constants")
const peers = require("./peers")

/* WebSocket message JSON format: {request: "p2p", params: {command: "getPeers", uid: "qwert", TTL: 3, ...} } 

Supported p2p commands:
getPeers - requesting peers from P2P network. Example: {request: "p2p", params: {command: "getPeers", uid: "qwert", TTL: 3, ...} 
listPeers - returned list of peers. Example: {request: "p2p", params: {command: "listPeers", uid: "qwert", TTL: 3, list: [1.1.1.1:10443, 1.2.3.4:10443, ...] } } 
getPort - request a listen port for remote connected client (with known IP address). Example: {request: "p2p", params: {command: "getPort", uid: "qwert", TTL: 0, address: 1.2.3.4} } 
*/

let g_knownUIDS = {};
function IsKnownUID(uid)
{
    let newest = {}
    for (let key in g_knownUIDS)
    {
        if (g_knownUIDS[key] > Date.now() - 60*1000)
            newest[key] = g_knownUIDS[key];
    }
    g_knownUIDS = newest;

    if (g_knownUIDS[uid])
        return true;

    g_knownUIDS[uid] = Date.now();   
    return false; 
}

exports.handleConnection = function(ws)
{
    if (utils.IsBockedAddress(ws["remote_address"]))
    {
        ws.terminate();
        console.log("blocked request")
        return;       
    }
    ws["isAlive"] = true;
 
    if (typeof window === 'undefined')
    {
        ws.on('pong', () => {
            ws["isAlive"] = true;
        });
    }

    ws.onerror = function() {
        ws["isAlive"] = false;
    };
    ws.onclose = function () {
        ws["isAlive"] = false;
    };

    ws.onmessage = function(event)  
    {
        let data = event.data;

        if (!data || !data.length || data.length > g_constants.MAX_DATA_LENGTH) return;

        ws["isAlive"] = true;

        utils.UpdateSpeed(ws["remote_address"]);
        
        if (utils.GetSpeed(ws["remote_address"]) > 10)
        {
            console.error("Blocked too big message speed from host: "+ws["remote_address"])
            return;
        }

        let client = {};
        try { client = JSON.parse(data);} catch(e) { return; }

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        //Check request syntax
        if (!client.request || !client.params || !client.params.uid || client.params.TTL*1 > 4 || client.params.TTL*1 < 0) return;
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////

        //Do not responce more than one time for one "uid" if it is not our own.
        if (IsKnownUID(client.params.uid+client.request) && !peers.IsOwnUID(client.params.uid)) return;     

        client.params.TTL = client.params.TTL*1 - 1;
        if (client.params.TTL*1 >= 0 && !peers.IsOwnUID(client.params.uid))
            exports.broadcastMessage(ws["remote_address"], client)

        try { peers.HandleMessage(client);} catch(e) {}
    };   
}

exports.broadcastMessage = function(ip, client)
{
    peers.broadcastMessage(ip, client);

    if (!g_constants.WEB_SOCKETS.clients) return;

    g_constants.WEB_SOCKETS.clients.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN && ws["remote_address"] != ip)
            ws.send(JSON.stringify(client));        
    })
}

exports.IsConnected = function(peer)
{
    if (peers.IsConnected(peer))
        return true;

    if (!g_constants.WEB_SOCKETS.clients) return false;

    let ret = false;
    g_constants.WEB_SOCKETS.clients.forEach(ws => {
        if (peer.indexOf(ws["remote_address"]) >= 0 && ws.readyState === WebSocket.OPEN)
            ret = true;
    })

    return ret;
}