// src/satellite.js
const request = require("request");
const cheerio = require("cheerio");
const fs = require("fs");
const path = require("path");
const utils = require("./utils");

const property = ["url", "date", "brightness", "events", "passType", "image", "scoreData", "exist", "score", "id"];
const events = ["rise", "reachAltitude10deg", "highestPoint", "dropBelowAltitude10deg", "set", "exitShadow", "enterShadow"];
const attribute = ["time", "altitude", "azimuth", "distance", "brightness", "sunAltitude"];

const compare = [
    (a, b) => a[property[6]][1] >= b[property[6]][1] ? 1 : -1,
    (a, b) => a[property[6]][2] >= b[property[6]][2] ? 1 : -1,
    (a, b) => a[property[6]][3] <= b[property[6]][3] ? 1 : -1,
    (a, b) => a[property[7]] <= b[property[7]] ? 1 : -1
];
const weight = [9.5, 6, 6.5, 6.5];

function getTable(config) {
    let database = config.database || [];
    let counter = config.counter || 0;
    const opt = config.opt || 0;
    const basedir = path.join(config.root, `satellite${config.target}`);

    console.log("Starting ISS data fetch for target:", config.target);
    if (!fs.existsSync(basedir)) {
        fs.mkdirSync(basedir, { recursive: true });
        console.log("Created data folder:", basedir);
    }

    const options = counter === 0
        ? utils.get_options(`PassSummary.aspx?satid=${config.target}&`)
        : utils.post_options(`PassSummary.aspx?satid=${config.target}&`, opt);

    request(options, (error, response, body) => {
        if (error) {
            console.error("Request failed:", error);
            return;
        }
        if (response.statusCode !== 200) {
            console.error("Unexpected status code:", response.statusCode);
            return;
        }

        console.log(`Page ${counter + 1} fetched successfully`);
        const $ = cheerio.load(body, { decodeEntities: false });
        const tbody = $("form").find("table.standardTable tbody");
        const queue = [];

        tbody.find("tr").each((i, o) => {
            const link = $(o).find("td").eq(0).find("a").attr("href");
            if (!link) return;
            queue.push({
                [property[0]]: "https://www.heavens-above.com/" + link.replace("type=V", "type=A"),
                [property[1]]: $(o).find("td").eq(0).find("a").text(),
                [property[2]]: $(o).find("td").eq(1).text(),
                [property[3]]: {},
                [property[4]]: $(o).find("td").eq(11).text()
            });
        });

        function factory(temp) {
            return new Promise((resolve, reject) => {
                request(utils.image_options(temp[property[0]]), (error, response, body) => {
                    if (error || response.statusCode !== 200) {
                        console.error("Failed to fetch pass details:", temp[property[0]]);
                        reject(error || new Error("Non-200 status code"));
                        return;
                    }

                    console.log("Success:", temp[property[1]]);

                    const $ = cheerio.load(body, { decodeEntities: false });
                    const table = $("form").find("table.standardTable");
                    const tbody = table.find("tbody");
                    let current = {};
                    let shift = 0;
                    let flag = false;
                    const data = [];

                    for (let i = 0; i < tbody.find("tr").length; i++) {
                        if (tbody.find("tr").eq(i).find("td").eq(0).text() === "离开地影") {
                            temp[property[3]][events[5]] = {};
                            current = temp[property[3]][events[5]];
                            shift++;
                        } else if (tbody.find("tr").eq(i).find("td").eq(0).text() === "进入地影") {
                            temp[property[3]][events[6]] = {};
                            current = temp[property[3]][events[6]];
                            shift++;
                        } else {
                            temp[property[3]][events[i - shift]] = {};
                            current = temp[property[3]][events[i - shift]];
                        }

                        for (let j = 0; j < 6; j++) {
                            current[attribute[j]] = tbody.find("tr").eq(i).find("td").eq(j + 1).text();
                        }

                        if (i - shift === 2 && !flag) {
                            flag = true;
                            data[0] = parseInt(current[attribute[0]].split(":")[0]);
                            data[1] = parseFloat(current[attribute[4]]);
                            data[2] = parseFloat(current[attribute[5]].split("°")[0]);
                            data[3] = parseInt(current[attribute[1]].split("°")[0]);
                        }
                    }

                    const startTime = utils.getTimestamp(
                        temp[property[3]][events[5]] ? temp[property[3]][events[5]][attribute[0]] : temp[property[3]][events[1]][attribute[0]]
                    );
                    const endTime = utils.getTimestamp(
                        temp[property[3]][events[6]] ? temp[property[3]][events[6]][attribute[0]] : temp[property[3]][events[3]][attribute[0]]
                    );

                    temp[property[5]] = "https://www.heavens-above.com/" + $("#ctl00_cph1_imgViewFinder").attr("src");
                    temp[property[6]] = data;
                    temp[property[7]] = endTime - startTime;
                    temp[property[8]] = 0;
                    temp[property[9]] = utils.md5(Math.random().toString());

                    fs.appendFile(path.join(basedir, temp[property[9]] + ".html"), table.html(), (err) => {
                        if (err) console.error("Failed to save HTML:", err);
                    });

                    request.get(utils.image_options(temp[property[5]])).pipe(
                        fs.createWriteStream(path.join(basedir, temp[property[9]] + ".png"), { flags: "a" })
                    ).on("error", (err) => console.error("Failed to save image:", err));

                    resolve(temp);
                });
            });
        }

        Promise.allSettled(queue.map(factory)).then(results => {
            results = results.filter(p => p.status === "fulfilled").map(p => p.value);
            database = database.concat(results);

            console.log(`Page ${counter + 1} processed. Total passes so far: ${database.length}`);

            // Handle pagination
            let next = "__EVENTTARGET=&__EVENTARGUMENT=&__LASTFOCUS=";
            $("form").find("input").each((i, o) => {
                if ($(o).attr("name") === "ctl00$cph1$btnPrev" || $(o).attr("name") === "ctl00$cph1$visible") return;
                next += `&${$(o).attr("name")}=${$(o).attr("value")}`;
            });
            next += "&ctl00$cph1$visible=radioVisible";
            next = next.replace(/\+/g, "%2B").replace(/\//g, "%2F");

            if (counter++ < config.pages) {
                getTable({ target: config.target, pages: config.pages, root: config.root, counter, opt: next, database });
            } else {
                // Save final JSON
                const jsonPath = path.join(basedir, "iss.json");
                fs.writeFile(jsonPath, JSON.stringify(database, null, 2), (err) => {
                    if (err) console.error("Failed to save ISS JSON:", err);
                    else console.log("ISS data saved successfully:", jsonPath);
                });
            }
        });
    });
}

exports.getTable = getTable;
