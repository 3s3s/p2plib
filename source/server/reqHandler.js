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

let g_ClientMessages = [];

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

    ws.onmessage = function(_event)  
    {
        if (!_event.data || !_event.data.length || _event.data.length > g_constants.MAX_DATA_LENGTH) return;

        ws["isAlive"] = true;

/////////////////////////////////////////////////////////////////////////////////////////
        //Restrict data speed
        g_ClientMessages.push({event: _event, time: Date.now});

        const currentMessage = g_ClientMessages.shift();
    
        if (Date.now() - g_ClientMessages.time < 1000)
            return setTimeout(ws.onmessage, 1000, currentMessage.event)
/////////////////////////////////////////////////////////////////////////////////////////

        let data = currentMessage.event.data;

        let client = {};
        try { client = JSON.parse(data);} catch(e) { return; }

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        //Check request syntax
        if (!client.request || !client.params || !client.params.uid || client.params.TTL*1 > 4 || client.params.TTL*1 < 0) return;
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////

        client.params.TTL = client.params.TTL*1 - 1;
        if (client.params.TTL*1 >= 0 && !peers.IsOwnUID(client.params.uid))
            exports.broadcastMessage(ws["remote_address"], client)

        try { peers.HandleMessage(client);} catch(e) {}
    };   
}

exports.broadcastMessage = function(_ip, _client)
{
    const ip = currentMessage.ip; 
    const client = currentMessage.client;

    const data = JSON.stringify(client);

    const connectedFromMe = peers.GetPeers();

    for (let i=0; i<connectedFromMe.length; i++)
    {
        if (connectedFromMe[i].readyState === WebSocket.OPEN && connectedFromMe[i]["remote_address"] != ip)
            connectedFromMe[i].send(data);
    }

    if (!g_constants.WEB_SOCKETS.clients) return;

    g_constants.WEB_SOCKETS.clients.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN && ws["remote_address"] != ip)
            ws.send(data);        
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