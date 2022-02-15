'use strict';

const p2p = require("../../main")
const peers = require("./peers")

exports.HandleMessage = async function(client)
{
    if (!client || !client.params || !client.params.command) return;

    if (client.params.command == "getPeers")
        return p2p.broadcastMessage({request: "p2p", params: {destination: client.params.uid, command: "listPeers", list: await p2p.GetLastSavedPeers() } }) 
    
    if (client.params.command == "listPeers" && client.params.list && client.params.list.length && client.params.destination)
        return peers.SavePeers(client.params.destination, client.params.list);

    if (client.params.command == "getPort" && client.params.address && typeof window === 'undefined')
    {
        const parts = client.params.address.split(":");
        let address = "";
        for (let i=0; i<Math.min(10, parts.length); i++)
        {
            if (parts[i].length > 5 && parts[i].indexOf(".") > 0)
            {
                address = parts[i];
                break;
            }
        }    
        return p2p.broadcastMessage({request: "p2p", params: {command: "listPeers", destination: client.params.uid, TTL: 0, list: [{address: address+":"+p2p.GetListenPort()}] } });
    }     
}