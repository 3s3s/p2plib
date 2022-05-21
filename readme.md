# P2P client and server in node.js

Install from npm:

```
npm i p2plib
```

Usage:

Start P2P server (will not work in browser)

```
require("p2plib").StartServer();
```

Start P2P client (will work in browser)

```
require("p2plib")
let p2p = new p2plib()
p2p.StartPeer();
```

Stop P2P client 

```
p2p.StopPeer();
```



Step-by-step build instructions:

1. Install nvm

For Linux:

```
[sudo] apt-get update
[sudo] apt-get install build-essential libssl-dev curl -y
curl -sL https://raw.githubusercontent.com/creationix/nvm/v0.31.0/install.sh -o install_nvm.sh
bash install_nvm.sh
[sudo] reboot

nvm install 16.13.0
```

For Windows:

You can use terminal in Visual Studio Code https://code.visualstudio.com/download or in c9sdk https://cloud9-sdk.readme.io/docs/running-the-sdk

2. Clone repository and install modules

```
git clone https://github.com/3s3s/p2plib.git
cd p2plib
npm install
npm install -g forever
npm install -g browserify
```

3. Start P2P server

```
npm run server
```

Instead of running the server, you can compile the code for browser:

```
npm run compile
```

The p2plib/browser directory will contain the code for the browser extension. It is compatible with Firefox and Chrome browsers.

Also you can run server as a background process (daemon)


```
npm run daemon
```

To stop the daemon jus type:

```
npm run daemon_stop
```

Examples: 

https://3s3s.github.io/p2plib/browser/html/popup.html

https://3s3s.github.io/p2plib/browser/html/simple_chat.html