const axios = require("axios");
const tunnel = require("tunnel");
const cheerio = require("cheerio");
const fs = require("fs");
const cronConfig = require("../config/crons");
var CronJob = require("cron").CronJob;
var proxyIndex = -1;

const jsonFile = `./data/proxylist.json`;
const currenciesArr = [
  "BTC",
  "ETH",
  "XRP",
  "LTC",
  "EOS",
  "DASH",
  "OXT",
  "MKR",
  "XLM",
  "ATOM",
  "XTZ",
  "ETC",
  "OMG",
  "LINK",
  "REP",
  "ZRX",
  "ALGO",
  "DAI",
  "KNC",
  "COMP",
  "BAND",
  "NMR",
  "CGLD",
];
const baseApiURL = "https://api.pro.coinbase.com";

/**
 * WRITE RANDOM PROXY GENERATOR
 * https://zenscrape.com/how-to-build-a-simple-proxy-rotator-in-node-js/
 * https://www.intricatecloud.io/2020/03/how-to-handle-api-errors-in-your-web-app-using-axios/
 *
 * We're grabbing proxies from hidemy.name
 */

const writeRandomProxies = async function (
  cronPeriod = { period: "minutes", slice: 10 }
) {
  const maxPages = 15;
  let proxies = [];
  let url = "https://hidemy.name/en/proxy-list/";
  /*
   each page shows 64 results so we loop through to create the start page indexes
   EX: https://hidemy.name/en/proxy-list/?start=64#list
   */

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
            // parse the response
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
      // FILTER THE LIST FOR faster, high anonymity http proxies
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
          // Write file to the data directory
          fs.writeFileSync(jsonFile, writtten_data);
          console.log("proxy list written to data directory");
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
 * CONNECT THROUGH RANDOM PROXY
 * https://github.com/axios/axios/issues/2072 (adam s comment)
 * https://github.com/axios/axios/issues/2072#issuecomment-592233032
 */
const connectThroughProxy = function () {
  //var randomProxy = getRandomProxy();

  // sampleURL example
  // https://api.pro.coinbase.com/products/BTC-USD/candles?granularity=900&start=2020-08-30T06:03:21.805Z

  let granularity = 900;
  let sampleURL = `${baseApiURL}/products/BTC-USD/candles?granularity=${granularity}&start=2020-08-30T06:03:21.805Z`;

  let allURLs = currenciesArr.map((s) => {
    return `${baseApiURL}/products/${s}-USD/candles?granularity=900&start=2020-08-30T06:03:21.805Z`;
  });

  var tmpIndex = -1;

  for (i = 0; i < allURLs.length; i++) {
    let randomProxy = getNextProxy();

    let agent = tunnel.httpsOverHttp({
      proxy: {
        host: randomProxy.ip_address,
        port: randomProxy.port_number,
      },
      rejectUnauthorized: false,
    });

    console.log("randomProxy");
    console.dir(randomProxy);
    // AXIOS DOCUMENTATION
    // https://www.npmjs.com/package/axios#axios-api
    setTimeout(function () {
      tmpIndex++;
      console.log(`timeout index: ${tmpIndex}`);

      let instance = axios
        .request({
          url: allURLs[tmpIndex],
          method: "get",
          headers: {
            "User-Agent": getRandomUserAgent(),
          },
          agent,
          additionalParams: {
            baseCurrency: currenciesArr[tmpIndex],
            quoteCurrency: "USD",
            granularity,
          },
        })
        .then(function (response) {
          //console.log("axios proxy success:");
          //console.dir(response);

          let data = JSON.stringify(response.data, null, 2);
          let str = "coinbasepro";

          try {
            let fileParams = response.config.additionalParams;
            console.log("fileParams");
            console.dir(fileParams);
            let granularityStr;
            switch (fileParams.granularity) {
              case 900:
                granularityStr = "min15";
                break;
              default:
                granularityStr = "unknown";
            }
            // Write file to the client/data directory
            fs.writeFileSync(
              `./data/${str}/${fileParams.baseCurrency}-${fileParams.quoteCurrency}-${granularityStr}.json`,
              data
            );
          } catch (error) {
            console.log("////coinbasepro writeProductsFile error is");
            console.dir(error);
          }
        })
        .catch(function (error) {
          console.log("axios proxy fail:");
          console.dir(error);
        });
    }, (i + 1) * 500);
  }
};

/**
 * GET RANDOM PROXY SETTINGS FROM DATA FILE
 */
const getRandomProxy = function () {
  let rawdata = fs.readFileSync(jsonFile);
  let allProxies = JSON.parse(rawdata);
  let random_number = Math.floor(Math.random() * allProxies.length);
  return allProxies[random_number];
};

/**
 * GET RANDOM PROXY SETTINGS FROM DATA FILE
 */
const getNextProxy = async function () {
  let rawdata = await fs.readFileSync(jsonFile);
  let allProxies = JSON.parse(rawdata);

  if (proxyIndex >= allProxies.length) {
    proxyIndex = 0;
  } else {
    proxyIndex++;
  }
  return allProxies[proxyIndex];
};

/**
 * GRAB RANDOM USER AGENT
 */
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
  let random_number = Math.floor(Math.random() * arr.length);
  return arr[random_number];
};

module.exports = {
  writeRandomProxies,
  connectThroughProxy,
  getRandomProxy,
  getNextProxy,
  getRandomUserAgent,
};
