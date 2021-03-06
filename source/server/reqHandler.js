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
let g_knownUIDs = {}
exports.handleConnection = function(ws)
{
    if (utils.IsBockedAddress(ws["remote_address"]))
    {
        ws.close();
        console.log("blocked request")
        return;       
    }
    ws["isAlive"] = true;
 
    ws.onerror = function() {
        this["isAlive"] = false;
    };
    ws.onclose = function () {
        this["isAlive"] = false;
    };

    ws.onmessage = function(event)  
    {
        this["isAlive"] = false;

        let data = event.data;

        if (!data || !data.length || data.length > g_constants.MAX_DATA_LENGTH) {
            return console.log("SKIPED MESAGE: wrong data or data length")
        }

        let client = {};
        try { client = JSON.parse(data);} 
        catch(e) { 
            return console.log(e);
        }

        /*if (client.request != "p2p" && client.params.command == "answer" && !client.params.values.orders)
        {
            const i = 1;
        }*/

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        //Check request syntax
        if (!client.request || !client.params || !client.params.uid || client.params.TTL*1 > 4 || client.params.TTL*1 < 0) return;
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////

        this["isAlive"] = true;

        if (g_knownUIDs[client.params.uid] !== undefined)  return;

        g_knownUIDs[client.params.uid] = Date.now();
        CleanMemory();

        utils.UpdateSpeed(this["remote_address"]);
        
        if (utils.GetSpeed(this["remote_address"]) > 100)
        {
            console.error("Blocked too big message speed from host: "+this["remote_address"])
            return console.log("command: "+client.params.command+"; TTL="+client.params.TTL)
        }


        client.params.TTL = client.params.TTL*1 - 1;
        if (client.params.TTL*1 >= 0 && !peers.IsOwnUID(client.params.uid))
            exports.broadcastMessage(this["remote_address"], client)

        try { peers.HandleMessage(client);} catch(e) {
            console.log(e)
        }
    };   
}

exports.broadcastMessage = function(ip, client)
{
    try {
        const data = JSON.stringify(client);

        if (data.length > g_constants.MAX_DATA_LENGTH) throw new Error("too big data length "+data)

        const connectedFromMe = peers.GetPeers();

        for (let i=0; i<connectedFromMe.length; i++)
        {
            if (connectedFromMe[i].readyState === WebSocket.OPEN)// && connectedFromMe[i]["remote_address"] != ip)
                connectedFromMe[i].send(data);
        }

        if (!g_constants.WEB_SOCKETS.clients) return;

        g_constants.WEB_SOCKETS.clients.forEach(ws => {
            if (ws.readyState === WebSocket.OPEN)// && ws["remote_address"] != ip)
                ws.send(data);        
        })

    }
    catch(e) {
        console.log(e);
    }
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

let g_LastClean = 0
function CleanMemory()
{
    if (g_LastClean > Date.now() - 60*1000)
        return;

    g_LastClean = Date.now();

    let newest = {};
    for(let key in g_knownUIDs)
    {
        if (Date.now() - g_knownUIDs[key] < 60*1000)
            newest[key] = g_knownUIDs[key]
    }
    g_knownUIDs = newest;
}