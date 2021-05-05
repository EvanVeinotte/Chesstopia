function getKeyByValue(map, searchValue){
    for(let [key, value] of map){
        if(value === searchValue){
            return(key);
        }
    }
}

function isLoggedIn(user, SOCKET_MAP){
    let result = SOCKET_MAP.get(user)
    if (result){
        return true;
    }else{
        return false;
    }
}

function sendIMessage(imessage, ws){
    imessage = JSON.parse(imessage);
    imessage["repcode"] = repcode;
    imessage = JSON.stringify(imessage);
    repcode += 1;
    ws.send(imessage);
    ws.send(imessage);
    ws.send(imessage);
}

module.exports = { getKeyByValue, isLoggedIn, sendIMessage }