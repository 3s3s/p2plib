"use strict";

const peers = require("./peers")

function ShowHelp()
{
    console.log("help                 This help")
    console.log("peers                Show latest peers")
    console.log("stop (quit, exit)    Stopping the process (like CTRL+C)")
}

exports.Handle = function(line)
{
    try 
    {
        const commands = line.split(" ");
        if (commands[0] == "help" || commands[0] == "")
            return ShowHelp();
        if (commands[0] == "peers")
            return ShowLastPeers();
        if (commands[0] == "stop" || commands[0] == "quit" || commands[0] == "exit")
            return process.exit(0);
    }
    catch(e)
    {
        console.log(e.message)
    }
}

async function ShowLastPeers()
{
    const list = await peers.GetLastPeers();
    for (let i=0; i<list.length; i++)
        console.log(list[i]);
}