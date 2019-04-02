// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// All of the Node.js APIs are available in this process.
var ipcRenderer = require('electron').ipcRenderer;

const RENDER_OBJ = {};

RENDER_OBJ["console"] = function(msg){
    console.log(msg);
}

ipcRenderer.on('GUI_ConfigLoaded', function (wtfisthis, event) {
    processConfigObject(event.config);
});

ipcRenderer.on('onConsoleMessage', function (wtfisthis, event) {
    RENDER_OBJ.console(event.msg);
});

ipcRenderer.on('onBizHawkInstall', function (wtfisthis, event) {
    if (!event.done){
        document.getElementById("connect").textContent = "Installing BizHawk...";
    }else{
        document.getElementById("connect").textContent = "Connect to Server";
    }
});

let config_to_element_map = {};

function processConfigObject(config){
    console.log(config);
    Object.keys(config).forEach(function(key){
        console.log(key);
        let ele = document.getElementById(key);
        if (ele){
            if (typeof config[key] === "boolean"){
                ele.checked = config[key];
                config_to_element_map[key] = {ele: ele, isBoolean: true};
            }else{
                ele.value = config[key];
                config_to_element_map[key] = {ele: ele, isBoolean: false};
            }
        }
        if (key === "_tunic_colors"){
            processConfigObject(config[key]);
        }
    });
}

function sendToMainProcess(id, event){
    ipcRenderer.send(id, event);
}

function configChanged(){
    let cfg = {};
    Object.keys(config_to_element_map).forEach(function(key){
        if (config_to_element_map[key].isBoolean){
            cfg[key] = config_to_element_map[key].ele.checked;
        }else{
            cfg[key] = config_to_element_map[key].ele.value;
        }
    });
    console.log(cfg);
    sendToMainProcess("postEvent", {id: "GUI_ConfigChanged", config: cfg});
}

function startClient(){
    configChanged();
    document.getElementById("connect").textContent = "Starting client, please wait...";
    setTimeout(function(){
        document.getElementById("connect").textContent = "Client Started.";
    }, 10000);
    document.getElementById("connect").disabled = true; 
    sendToMainProcess("postEvent", {id: "GUI_StartButtonPressed", start: true})
}

RENDER_OBJ["onConfigChanged"] = configChanged;
RENDER_OBJ["onStartClient"] = startClient;

module.exports = RENDER_OBJ;