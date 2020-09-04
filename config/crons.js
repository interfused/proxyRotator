module.exports = {
  cronTimeZone: "America/New_York",
  currentAPIVersion: 1,
  setupCronInterval: function (obj) {
    let { period, slice } = obj;
    // https://www.npmjs.com/package/cron
    console.log("setupCronInterval", period, slice);
    switch (period) {
      case "seconds":
        return `*/${slice} * * * * *`;
      case "minutes":
        return `0 */${slice} * * * *`;
      case "hours":
        return `0 0 */${slice} * * *`;
      case "days":
        return `0 0 0 */${slice} * *`;
      case "weekly_monday":
        return `0 0 0 * * 1`;
      default:
        return "* * * * * *";
    }
  },
};
