const express = require("express");
const bodyParser = require("body-parser");
const Proxies = require("./utils/Proxies");

const app = express();

// Bodyparser middleware
app.use(
  bodyParser.urlencoded({
    extended: false,
  })
);
app.use(bodyParser.json());

Proxies.writeRandomProxies({ period: "minutes", slice: 10 });
// Proxies.connectThroughProxy();

const port = process.env.PORT || 5000; // process.env.port is Heroku's port if you choose to deploy the app there
const server = app.listen(port, () => {
  console.log(`Woohoo! Server up and running on port ${port} !`);
});

// handle server closes
process.stdin.resume(); //so the program will not close instantly

function exitHandler(options, exitCode) {
  if (options.cleanup) console.log("clean");
  if (exitCode || exitCode === 0) console.log(exitCode);
  if (options.exit) process.exit();
}

//do something when app is closing
process.on("exit", exitHandler.bind(null, { cleanup: true }));

//catches ctrl+c event
process.on("SIGINT", exitHandler.bind(null, { exit: true }));

// catches "kill pid" (for example: nodemon restart)
process.on("SIGUSR1", exitHandler.bind(null, { exit: true }));
process.on("SIGUSR2", exitHandler.bind(null, { exit: true }));

//catches uncaught exceptions
process.on("uncaughtException", exitHandler.bind(null, { exit: true }));
