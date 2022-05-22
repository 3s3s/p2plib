'use strict';

const peers = require("./peers")

exports.HandleMessage = async function(params)
{
    if (!params || !params.command) return;

    if (params.command == "getPeers")
        return __p2p__.broadcastMessage({request: "p2p", params: {destination: params.uid, command: "listPeers", list: await p2p.GetLastSavedPeers() } }) 
    
    if (params.command == "listPeers" && params.list && params.list.length && params.destination)
        return peers.SavePeers(params.destination, params.list);

    if (params.command == "getPort" && params.address && typeof window === 'undefined')
    {
        const parts = params.address.split(":");
        let address = "";
        for (let i=0; i<Math.min(10, parts.length); i++)
        {
            if (parts[i].length > 5 && parts[i].indexOf(".") > 0)
            {
                address = parts[i];
                break;
            }
        }    
        return __p2p__.broadcastMessage({request: "p2p", params: {command: "listPeers", destination: params.uid, TTL: 0, list: [{address: address+":"+p2p.GetListenPort()}] } });
    }     
}