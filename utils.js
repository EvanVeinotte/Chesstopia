function getKeyByValue(map, searchValue){
    for(let [key, value] of map){
        if(value === searchValue){
            return(key);
        }
    }
}

function isLoggedIn(user){
    let result = SOCKET_MAP.get(user)
    if (result){
        return true;
    }else{
        return false;
    }
}

module.exports = { getKeyByValue, isLoggedIn }