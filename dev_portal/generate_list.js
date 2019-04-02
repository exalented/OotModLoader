const fs = require("fs");

let list = [];

fs.readdirSync("./dist").forEach(file => {
    if (file.indexOf(".zip") > -1) {
        list.push(file);
    }
});

fs.writeFileSync("./dist/dist.json", JSON.stringify(list, null, 2));