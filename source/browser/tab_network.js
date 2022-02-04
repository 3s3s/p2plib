"use strict";

const utils = require("../utils.js");
const $ = require('jquery');
const peers = require("../server/peers")

const P2P_PROTOCOL = {
    getPeers: require("../server/protocol/getPeers"),
    getPort: require("../server/protocol/getPort"),
    listPeers: require("../server/protocol/listPeers"),
    STARTED: false
}

exports.Init = function()
{
    ConnectP2P();
    
    UpdatePeers();
    
    setInterval(UpdatePeers, 10000)
}

function ConnectP2P()
{
    P2P_PROTOCOL.STARTED = true;

    peers.Init(P2P_PROTOCOL);
}

$("#network-start").on("click", e => 
{
    P2P_PROTOCOL.STARTED = !P2P_PROTOCOL.STARTED;

    peers.Init(P2P_PROTOCOL);

    UpdatePeers();
})

async function UpdatePeers()
{
    $("#network-start").text(P2P_PROTOCOL.STARTED ? "Stop" : "Start")

    const connected = peers.GetConnectedPeers();
    const saved = await utils.GetPeersFromDB();

    $("#network-status").empty();
    if (!P2P_PROTOCOL.STARTED)
        $("#network-status").append($("<span class='text-danger'>Offline</span>"))
    else 
    {
        if (!connected.length)
            $("#network-status").append($("<span class='text-warning'>Connecting...</span>"))
        else
            $("#network-status").append($("<span class='text-success'>Online</span>"))
    }

    const FUTURE = Date.now()+1000;
    for (let i=0; i<saved.length; i++)
    {
        for (let j=0; j<connected.length; j++)
        {
            if (saved[i].address == connected[j])
                saved[i].time = FUTURE;
        }        
    }

    saved.sort((a, b) => {return b.time - a.time});

    $("#table_peers_body").empty();
    for (let i=0; i<saved.length; i++)
    {
        let tr = $("<tr></tr>");
        const td1 = $("<td>"+saved[i].address+"</td>");
        const td2 = saved[i].time == FUTURE ? $("<td class='text-success'><b>connected</b></td>") : $("<td>saved  "+(new Date(saved[i].time)).toLocaleDateString()+"</td>");

        tr.append(td1).append(td2);
        $("#table_peers_body").append(tr);
    }
}