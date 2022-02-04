# P2P client and server in node.js

Install from npm:

```
npm i p2plib
```

Usage:

1. Start P2P server

```
require("p2plib").StartServer();
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

