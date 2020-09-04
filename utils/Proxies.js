const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");
const cronConfig = require("../config/crons");
var CronJob = require("cron").CronJob;

const jsonFile = `./data/proxylist.json`;
const sampleURL =
  "https://api.pro.coinbase.com/products/BCH-USD/candles?granularity=900&start=2020-08-30T06:03:21.805Z";

/**
 * RANDOM PROXY GENERATOR
 * https://zenscrape.com/how-to-build-a-simple-proxy-rotator-in-node-js/
 * https://www.intricatecloud.io/2020/03/how-to-handle-api-errors-in-your-web-app-using-axios/
 * https://sslproxies.org/
 */

const writeRandomProxies = async function (
  cronPeriod = { period: "minutes", slice: 10 }
) {
  const maxPages = 15;
  let proxies = [];
  let ip_addresses = [];
  let port_numbers = [];
  let url = "https://hidemy.name/en/proxy-list/";

  //https://hidemy.name/en/proxy-list/?start=64#list
  let array = [];
  for (let i = 0; i < maxPages; i++) {
    var newURL = url;
    if (i > 0) {
      let startIndex = i * 64;
      newURL = url + `?start=${startIndex}#list`;
    }
    array.push(newURL);
  }

  const proxy_write_cron = new CronJob(
    cronConfig.setupCronInterval(cronPeriod),
    async function () {
      let promises = [];
      for (let i = 0; i < array.length; i++) {
        promises.push(
          axios.get(array[i]).then((response) => {
            // do something with response
            const $ = cheerio.load(response.data);
            const baseSelector = ".table_block tbody tr";
            $(`${baseSelector}`).each(function (index, value) {
              proxies.push({
                ip_address: $(this).find("td:nth-child(1)").text(),
                port_number: $(this).find("td:nth-child(2)").text(),
                speed: $(this).find("td:nth-child(4) p").text().split(" ")[0],
                type: $(this).find("td:nth-child(5)").text().toLowerCase(),
                anonymity: $(this).find("td:nth-child(6)").text().toLowerCase(),
              });
            });
          })
        );
      }

      Promise.all(promises).then(() => {
        let filteredProxies = proxies
          .filter(function (n) {
            return n.speed < 2000;
          })
          .filter(function (n) {
            return n.anonymity === "high";
          })
          .filter(function (n) {
            return n.type === "http";
            //return n.type.includes("socks5");
          });

        let writtten_data = JSON.stringify(filteredProxies, null, 2);
        try {
          // Write file to the client/data directory
          fs.writeFileSync(jsonFile, writtten_data);
        } catch (error) {
          console.log("!!!proxy list writing error is");
          console.dir(error);
        }
      });
    },
    null,
    true,
    cronConfig.cronTimeZone,
    null,
    true
  );
};

/**
 * https://codingmiles.com/node-js-making-https-request-via-proxy/
 */
const connectThroughProxy = function () {
  var randomProxy = getRandomProxy();
  console.log("randomProxy");
  console.dir(randomProxy);

  var proxy = `http://${randomProxy.ip_address}:${randomProxy.port_number}`;
  let config = {};
  config.url = sampleURL;
  config.proxy = {
    host: randomProxy.ip_address,
    port: randomProxy.port_number,
  };
  config.headers = { "User-Agent": getRandomUserAgent() };

  axios
    .request(config)
    .then(function (response) {
      console.log("axios proxy success:");
      console.dir(response.data);
    })
    .catch(function (error) {
      console.log("axios proxy fail:");
      console.dir(error);
    });
};

const getRandomProxy = function () {
  let rawdata = fs.readFileSync(jsonFile);
  let allProxies = JSON.parse(rawdata);
  let random_number = Math.floor(Math.random() * allProxies.length);
  return allProxies[random_number];
};

const getRandomUserAgent = function () {
  let arr = [];
  // Desktops
  arr.push(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/42.0.2311.135 Safari/537.36 Edge/12.246"
  );
  arr.push(
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_2) AppleWebKit/601.3.9 (KHTML, like Gecko) Version/9.0.2 Safari/601.3.9"
  );
  arr.push(
    "Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/47.0.2526.111 Safari/537.36"
  );

  // mobile
  arr.push(
    "Mozilla/5.0 (iPhone; CPU iPhone OS 11_0 like Mac OS X) AppleWebKit/604.1.34 (KHTML, like Gecko) Version/11.0 Mobile/15A5341f Safari/604.1"
  );
  arr.push(
    "Mozilla/5.0 (iPhone; CPU iPhone OS 11_0 like Mac OS X) AppleWebKit/604.1.38 (KHTML, like Gecko) Version/11.0 Mobile/15A372 Safari/604.1"
  );
  arr.push(
    "Mozilla/5.0 (Linux; Android 8.0.0; SM-G960F Build/R16NW) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/62.0.3202.84 Mobile Safari/537.36"
  );
  arr.push(
    "Mozilla/5.0 (Linux; Android 7.0; SM-G930VC Build/NRD90M; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/58.0.3029.83 Mobile Safari/537.36"
  );
};

module.exports = {
  writeRandomProxies,
  connectThroughProxy,
  getRandomProxy,
  getRandomUserAgent,
};
