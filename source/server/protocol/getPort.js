'use strict';

const p2p = require("../../../main")

exports.HandleMessage = function(client)
{
    if (typeof window !== 'undefined') return;

    if (client.params.address)
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

        const responce = {request: "listPeers", params: {uid: client.params.uid, TTL: 0, list: [address+":"+p2p.GetListenPort()] } };
        
        p2p.broadcastMessage(responce) 
    }
    return;     
}