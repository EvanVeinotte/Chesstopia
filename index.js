const Websocket = require('ws');

const ChessGame = require('./gameobjects').ChessGame
const Player = require('./gameobjects').Player
const StatHandler = require('./handlestats').StatHandler

const getKeyByValue = require('./utils').getKeyByValue
const isLoggedIn = require('./utils').isLoggedIn
//const sendIMessage = require('./utils').sendIMessage

const VERSION = "0.1.0";

const PORT = 4421;

const wss = new Websocket.Server({port: PORT});

const { MongoClient } = require('mongodb');
//const mongo_url = process.env.MONGO_URL;
const mongo_url = "mongodb://127.0.0.1:27017/";
const MOD_KEY = "alhouette74";

var SOCKET_MAP = new Map();

var MOD_MAP = new Map();

var most_reported = [];

const most_reported_length = 10;

var PLAYER_MAP = new Map();

var currentgames = new Map();

var waitingforgame = [];

var chessmatchcounter = 100;

global.repcode = 100;
var listofrepcodes = [];



MongoClient.connect(mongo_url, (err, client) => {

    if(err) throw err;

    var db = client.db('Chesstopia');

    console.log(`running WebSocket Server on port ${PORT}`);

    var HandlerOfStats = new StatHandler(db, PLAYER_MAP);

    wss.on('connection', async function(ws) {

        ws.on('message', async function(message){

            let msg = JSON.parse(message);
            let readmessage = true;
            /*
            if(!(msg.repcode == 0)){
                if(listofrepcodes.includes(msg.repcode)){
                    readmessage = false;
                }
                else{
                    listofrepcodes.push(msg.repcode)
                }
            }
            */
            if(readmessage){
            
                if (msg["type"] == "login"){
                    
                    let loginresult = await login(msg.data.username, msg.data.password, msg.data.version);
                    //check if user is already logged in
                    if(SOCKET_MAP.has(msg.data.username + ";" + msg.data.password)){
                        loginresult = {type: "loginresult", data: {result: "useralreadyloggedin"}};
                    }

                    ws.send(JSON.stringify(loginresult));
                    //sendIMessage(JSON.stringify(loginresult), ws);
                    if(loginresult.data.result == "loginsuccess"){
                        SOCKET_MAP.set(msg["data"]["username"] + ";" + msg["data"]["password"], ws);
                        console.log(`client logged in to ${msg["data"]["username"]}`);
                        //spawn the player into the world
                        spawnPlayer(msg["data"]["username"] + ";" + msg["data"]["password"], db, ws);
                    }
                
                }
                else if (msg["type"] == "createaccount"){
                    let result = await createUser(msg.data.username, msg.data.password, msg.data.email,
                                                    msg.data.version);
                    ws.send(JSON.stringify(result));
                    //sendIMessage(JSON.stringify(result), ws)
                    if(result.data.result == "usercreated"){
                        SOCKET_MAP.set(msg["data"]["username"] + ";" + msg["data"]["password"], ws);
                        console.log(`client logged in to ${msg["data"]["username"]}`);
                        //spawn the player into the world
                        spawnPlayer(msg["data"]["username"] + ";" + msg["data"]["password"], db, ws);
                    }
                }

                //isn't used anymore
                else if (msg["type"] == "newgame"){
                    //username
                    if(isLoggedIn(msg.data.username + ";" + msg.data.password, SOCKET_MAP)){
                        waitingforgame.push(msg.data.username + ";" + msg.data.password)
                        if(waitingforgame.length >= 2){
                            let coin = Math.random()
                            currentgames.set(chessmatchcounter, new ChessGame(waitingforgame[0], 
                                                                                waitingforgame[1], 800, 800,
                                                                                coin, chessmatchcounter, 
                                                                                currentgames,
                                                                                SOCKET_MAP));
                            
                            console.log("new game created")
                            waitingforgame = [];
                            chessmatchcounter += 1;
                        }
                    }
                    
                }

                else if (msg["type"] == "reqspec"){
                    console.log(msg.data.username + " started spectating " + msg.data.gamecode.toString())
                    let usergame = currentgames.get(msg.data.gamecode)
                    if(usergame){
                        usergame.fetchTimeForSpec(msg.data.username + ";" + msg.data.password);
                    }
                    else{
                        PLAYER_MAP.get(msg.data.username).ws.send(JSON.stringify({type:"specinvalidroomcode"}))
                    }
                }

                else if (msg["type"] == "servespectimes"){
                    let usergame = currentgames.get(msg.data.gamecode)
                    if(usergame){
                        usergame.spectatorJoins(msg.data.whitetime, msg.data.blacktime,
                                                    msg.data.ufmm, msg.data.ofmm);
                    }
                }

                else if (msg["type"] == "makemove"){
                    console.log("makemove:" + msg.data.gamecode.toString())
                    let usergame = currentgames.get(msg.data.gamecode)
                    if(usergame){
                        usergame.makeMove(msg.data.move, msg.data.pprom, msg.data.boardstate, msg.data.hasmovedbs,
                                            msg.data.mytime, msg.data.deadpieces);
                    }
                    else{
                        console.log("game not found")
                    }
                }

                else if (msg["type"] == "restartgame"){
                    let usergame = currentgames.get(msg.data.gamecode)
                    if(usergame){
                        usergame.newGame()
                    }
                    else{
                        console.log("game not found")
                    }
                }
                else if (msg["type"] == "gameover"){
                    let usergame = currentgames.get(msg.data.gamecode)
                    if(usergame){
                        usergame.gameOver(msg.data.reason, msg.data.loser, db);
                    }
                    else{
                        console.log("game not found")
                    }
                }
                else if (msg["type"] == "offerdraw"){
                    let usergame = currentgames.get(msg.data.gamecode)
                    if(usergame){
                        usergame.offerDraw(msg.data.who);
                    }
                    else{
                        console.log("game not found")
                    }
                }
                else if (msg["type"] == "drawaccepted"){
                    let usergame = currentgames.get(msg.data.gamecode)
                    if(usergame){
                        usergame.gameOver("Draw!", 0, db);
                    }
                    else{
                        console.log("game not found")
                    }
                }
                else if (msg["type"] == "stalemate"){
                    let usergame = currentgames.get(msg.data.gamecode)
                    if(usergame){
                        usergame.gameOver("Stalemate!", 0, db);
                    }
                    else{
                        console.log("game not found")
                    }
                }
                else if (msg["type"] == "offernewgame"){
                    let usergame = currentgames.get(msg.data.gamecode)
                    if(usergame){
                        usergame.offerNewGame(msg.data.who);
                    }
                    else{
                        console.log("game not found")
                    }
                }
                else if (msg["type"] == "gameexited"){
                    let usergame = currentgames.get(msg.data.gamecode)
                    if(usergame){
                        usergame.gameExited(msg.data.username + ";" + msg.data.password, db);
                    }
                    else{
                        console.log("game not found")
                    }
                }
                else if(msg["type"] == "newchesschatmessage"){
                    let usergame = currentgames.get(msg.data.gamecode)
                    if(usergame){
                        usergame.sendNewChatMessage(msg.data.txtmsg, msg.data.username);
                    }
                    else{
                        console.log("game not found")
                    }
                }
                else if(msg["type"] == "report"){
                    processMostReported(msg.data.reported, msg.data.reporter, msg.data.reason, db)

                }
                //MOD
                
                //if type first three letters == mod
                //then its a mod command
                else if(msg["type"].substring(0, 3) == "mod"){

                    if (msg["type"] == "modlogin"){
                    
                        let loginresult = await loginmod(msg.data.username, msg.data.password, msg.data.modkey);
        
                        ws.send(JSON.stringify(loginresult));
                        //sendIMessage(JSON.stringify(loginresult), ws);
                        if(loginresult.data.result == "loginsuccess"){
                            MOD_MAP.set(msg.data.username, ws);
                            console.log(`mod logged in to ${msg["data"]["username"]}`);
                        }
                    }
                    else {
                        
                        let moduserdata = await db.collection('users').findOne({username: msg.data.moduser});
                        if(moduserdata.password == msg.data.modpass && MOD_KEY == msg.data.modkey){
        
                            if (msg["type"] == "modgetuserdata"){
                                let userdata = await db.collection('users').findOne({username: msg.data.username});

                                if(userdata){
                                    //delete private data
                                    delete userdata.password;
                                    delete userdata.email;
                    
                                    ws.send(JSON.stringify({type:"userdatares", data: userdata}));
                                }else{
                                    ws.send(JSON.stringify({type:"userdataresfail"}));
                                }
                
                            }
                            
                            else if (msg["type"] == "modsetban"){
                                db.collection("users").updateOne({username: msg.data.username},
                                                                {$set:{banned: msg.data.setbanto}});
                                if(msg.data.setbanto){
                                    db.collection("users").updateOne({username: msg.data.username},
                                                                    {$push: {banreasons: msg.data.reasonforban}});
                                    if(PLAYER_MAP.has(msg.data.username)){
                                        PLAYER_MAP.get(msg.data.username).ws.send(JSON.stringify({type: "getbanned",
                                                                        data: {reasonforban: msg.data.reasonforban}}))
                                    }

                                    reportedListUponBan(msg.data.username)
                                }
                            }
        
        
                        }  
                    }
        
                }

                //Overworld

                else if (msg["type"] == "worlddatareq"){
                    //user must also give information about self
                    //server updates it
                    //let playerref = PLAYER_MAP.get(msg.data.username + ";" + msg.data.password)
                    let playerref = PLAYER_MAP.get(msg.data.username)

                    if (playerref){
                        playerref.position = msg.data.position;
                        playerref.velocity = msg.data.velocity;
                        playerref.dir = msg.data.dir;
                        playerref.animstate = msg.data.animstate;
                        playerref.curhat = msg.data.curhat;
                        playerref.skin = msg.data.skin;
                        playerref.speech = msg.data.speech;
                        playerref.eyesopen = msg.data.eyesopen;
                    }

                    let otherplayerdata = {type: "worlddata", data:{
                        listofplayers: {}
                    }};

                    PLAYER_MAP.forEach((value, key, _map) => {
                        let username = key;
                        otherplayerdata.data.listofplayers[username] = {
                            position: value.position,
                            velocity: value.velocity,
                            dir: value.dir,
                            animstate: value.animstate,
                            curhat: value.curhat,
                            skin: value.skin,
                            speech: value.speech,
                            eyesopen: value.eyesopen
                        };
                    });

                    ws.send(JSON.stringify(otherplayerdata));
                }

                else if (msg["type"] == "sendpm"){
                    let receiver = await db.collection("users").findOne({username: msg.data.receiver})
                    if(receiver){
                        
                        if(receiver.hasOwnProperty("streamermode")){
                            if(receiver.streamermode){
                                if(receiver.trusted.includes(msg.data.pm.signature)){
                                    addPM(receiver, msg.data.pm)
                                }
                            }
                            else if(receiver.hasOwnProperty("blocked")){
                                if(!(receiver.blocked.includes(msg.data.pm.signature))){
                                    addPM(receiver, msg.data.pm)
                                }
                            }
                        }
                        else{
                            addPM(receiver, msg.data.pm)
                        }
                        
                    }
                    else{
                        ws.send(JSON.stringify({type: "pmfailed", data: {failedusername: msg.data.receiver}}));
                    }
                }
                else if (msg["type"] == "readpm"){
                    let result = await db.collection("users").findOne({username: msg.data.username,
                                                                        password: msg.data.password});
                    if(result){
                        if(result.hasOwnProperty("privatemessages")){
                            let oldestpm = result.privatemessages[0];
                            if(oldestpm){
                                let islastpm = false;
                                if(result.privatemessages.length <= 1){
                                    islastpm = true
                                }

                                ws.send(JSON.stringify({type: "pminfo", data: {pm: oldestpm, islastpm: islastpm}}));
                                db.collection("users").updateOne({username: msg.data.username},{$pop: {privatemessages: -1}});
                            }
                            else{
                                ws.send(JSON.stringify({type: "pminfo", data: {pm: "nopm"}}));
                            }
                        }
                        else{
                            ws.send(JSON.stringify({type: "pminfo", data: {pm: "nopm"}}));
                        }
                        
                        
                    }
                    else{
                        console.log("A user with wrong username or password tried to read a PM")
                    }
                }
                else if (msg["type"] == "blocksomeone"){
                    db.collection("users").updateOne({username: msg.data.username},{
                        $push: {blocks: msg.data.blockee}
                    });
                }
                else if (msg["type"] == "updatequestdata"){
                    db.collection("users").updateOne({username: msg.data.username},{
                        $set: {questdata: msg.data.questdata}
                    });
                }

                else if (msg["type"] == "unlockcosmetic"){

                    let unlockables = ["trash_can"]
                    if(unlockables.includes(msg.data.itemname)){
                        if(msg.data.itemtype == "hats"){
                            let hat = await db.collection("hats").findOne({hatname: msg.data.itemname})
                            if(hat){
                                db.collection("users").updateOne({username: msg.data.username}, 
                                                                {$push: {ownedhats: msg.data.itemname}});
                                db.collection("hats").updateOne({hatname: msg.data.itemname}, 
                                                                {$set: {howmany: hat.howmany + 1}})
                            }  
                        }
                        else if(msg.data.itemtype == "skins"){
                            let skin = await db.collection("skins").findOne({skinname: msg.data.itemname})
                            if(skin){
                                db.collection("users").updateOne({username: msg.data.username}, 
                                                                {$push: {ownedskins: msg.data.itemname}});
                                db.collection("skins").updateOne({skinname: msg.data.itemname}, 
                                                                {$set: {howmany: skin.howmany + 1}})
                            }
                        }
                        else if(msg.data.itemtype == "chesssets"){
                            let chessset = await db.collection("chesssets").findOne({chesssetname: msg.data.itemname})
                            if(chessset){
                                db.collection("users").updateOne({username: msg.data.username}, 
                                                                {$push: {ownedchesssets: msg.data.itemname}});
                                db.collection("chesssets").updateOne({chesssetname: msg.data.itemname}, 
                                                                {$set: {howmany: chessset.howmany + 1}})
                            }
                        }
                    }
                }

                else if (msg["type"] == "settingsupdate"){
                    db.collection("users").updateOne({username: msg.data.username},{
                        $set: {usersettings: msg.data.newsettings}
                    });
                }

                else if (msg["type"] == "blocktruststreamupdate"){
                    db.collection("users").updateOne({username: msg.data.username},{
                        $set: {blocked: msg.data.blocked, trusted: msg.data.trusted,
                                streamermode: msg.data.streamermode}
                    });

                }

                else if (msg["type"] == "challengereq"){

                    let result = await db.collection("users").findOne({username: msg.data.challengee});
                    if(result){
                        if(result.hasOwnProperty("blocked")){
                            if(!result.blocked.includes(msg.data.challenger)){
                                PLAYER_MAP.get(msg.data.challengee).ws.send(JSON.stringify({
                                    type: "newchallenge",
                                    data: {
                                        challenger: msg.data.challenger,
                                        challengee: msg.data.challengee,
                                        gametime: msg.data.gametime
                                    }
                                }));
                            }
                        }
                    }
                    
                }

                else if (msg["type"] == "challengeans"){
                    PLAYER_MAP.get(msg.data.challenger).ws.send(JSON.stringify({
                        type: "challengeresponse",
                        data: {
                            challenger: msg.data.challenger,
                            challengee: msg.data.challengee,
                            answer: msg.data.answer
                        }
                    }));

                    if(msg.data.answer === true){
                        let user1 = getKeyByValue(SOCKET_MAP, PLAYER_MAP.get(msg.data.challenger).ws);
                        let user2 = getKeyByValue(SOCKET_MAP, PLAYER_MAP.get(msg.data.challengee).ws);

                        let rawdata = await db.collection("users").findOne({username: user1.split(";")[0]});
                        let u1elo = rawdata.elo;
                        rawdata = await db.collection("users").findOne({username: user2.split(";")[0]});
                        let u2elo = rawdata.elo;
                        if(isLoggedIn(user1, SOCKET_MAP) && isLoggedIn(user2, SOCKET_MAP)){

                            let coin = Math.random()
                            currentgames.set(chessmatchcounter, new ChessGame(user1, user2, msg.data.gametime,
                                                                                u1elo, u2elo, coin,
                                                                                chessmatchcounter, 
                                                                                currentgames,
                                                                                SOCKET_MAP));
                            
                            console.log("new game created");
                            console.log(currentgames.keys())
                            chessmatchcounter += 1;
                        }
                    }
                }

                else if (msg["type"] == "purchasecosmetic"){

                    console.log("cosmeticpurchasemade")
                    let playerobj = await getPlayerPubData(msg.data.username, db);
                    let playertopaz = playerobj.topaz;
                    //not doing a response if it costs too much because that should never happen
                    //because the client side will only send this if player has enough money
                    if(msg.data.itemtype == "hats"){
                        let hat = await db.collection("hats").findOne({hatname: msg.data.itemname})
                        if(hat){
                            console.log(hat.price)
                            console.log(playertopaz)
                            if(hat.price <= playertopaz){
                                db.collection("users").updateOne({username: msg.data.username}, 
                                                        {$push: {ownedhats: msg.data.itemname},
                                                        $set: {topaz: playertopaz - hat.price}});
                                db.collection("hats").updateOne({hatname: msg.data.itemname}, 
                                                        {$set: {howmany: hat.howmany + 1}})
                            }
                        }
                    }


                    else if(msg.data.itemtype == "skins"){
                        let skin = await db.collection("skins").findOne({skinname: msg.data.itemname})
                        if(skin){
                            if(skin.price <= playertopaz){
                                db.collection("users").updateOne({username: msg.data.username}, 
                                                        {$push: {ownedskins: msg.data.itemname},
                                                        $set: {topaz: playertopaz - skin.price}});
                                db.collection("skins").updateOne({skinname: msg.data.itemname}, 
                                                        {$set: {howmany: skin.howmany + 1}})
                            }
                        }
                    }
                    else if(msg.data.itemtype == "chesssets"){
                        let chessset = await db.collection("chesssets").findOne({chesssetname: msg.data.itemname})
                        if(chessset){
                            if(chessset.price <= playertopaz){
                                db.collection("users").updateOne({username: msg.data.username}, 
                                                        {$push: {ownedchesssets: msg.data.itemname},
                                                        $set: {topaz: playertopaz - chessset.price}});
                                db.collection("chesssets").updateOne({chesssetname: msg.data.itemname}, 
                                                        {$set: {howmany: chessset.howmany + 1}})
                            }
                        }
                    }
                }

                else if (msg["type"] == "getpubdata"){
                    let pubdata = await getPlayerPubData(msg.data.otherusername, db);
                    ws.send(JSON.stringify({type:"pubdata", data: pubdata}));
                }
            }
        });
        

        ws.on('close', (code, reason) => {
            let user = getKeyByValue(SOCKET_MAP, ws);
            let moduser = getKeyByValue(MOD_MAP, ws);
            if(user){

                SOCKET_MAP.delete(user)

                console.log(user)
                userwaitingindex = waitingforgame.indexOf(user);
                if(userwaitingindex > -1){
                    waitingforgame.splice(userwaitingindex, 1);
                }

                let username = user.split(";")[0]
                if(PLAYER_MAP.has(username)){
                    db.collection("users").updateOne({username: username}, 
                                                        {$set: {
                                                            position: PLAYER_MAP.get(username).position,
                                                            curhat: PLAYER_MAP.get(username).curhat,
                                                            skin: PLAYER_MAP.get(username).skin
                                                        }});
                    PLAYER_MAP.delete(username);
                }

                //this is terrible and should be fixed someday
                //you could probably add what game player is currently in in PLAYERMAP and then
                //when they disconnect just gameexit them using that reference
                currentgames.forEach((value, key, _map) => {
                    if(value.user1 == user){
                        console.log("user1 disconnected from game", )
                        //value.gameOver("opponent disconnected from game", value.user1, db);
                        value.gameExited(value.user1, db);
                        //end the game and make user that didn't disconnect win
                    }
                    else if(value.user2 == user){
                        console.log("user2 disconnected from game")
                        value.gameExited(value.user2, db);
                    }
                    if(value.spectators.includes(user)){
                        value.gameExited(user, db);
                    }
                });

                console.log(`user ${user} disconnected with code ${code}`);
                console.log(waitingforgame)

            }
            else if(moduser){
                MOD_MAP.delete(moduser)
                console.log(`mod user ${user} disconnected with code ${code}`);
            }
            else{
                console.log(`unknown user disconnected with code ${code}`)
            }
            
        });

    }
    );

    
    ////////////////////////////////////////////////////////////////////////////////////////////////
    

    async function createUser(username, password, email, version){
        if(version != VERSION){
            return({type:"usercreationresult", data:{result:"wrongversion"}});
        }

        if(!email.includes("@")){
            return({type:"usercreationresult", data:{result:"invalidemail"}});
        }

        if(!username.match("^[A-Za-z0-9_]+$") || !password.match("^[A-Za-z0-9_]+$")){
            return({type:"usercreationresult", data:{result:"invalidchars"}});
        }

        if(username.length < 4 || username.length > 24 || password.length < 8 || password.length > 32){
            return({type:"usercreationresult", data:{result:"invalidlength"}});
        }
        
        let result = await db.collection('users').findOne({username: username});
        //result will be true if username is already taken
        if(result){
            return({type:"usercreationresult", data:{result:"alreadytaken"}});
        }
        //if username is not taken
        else{
            //new user template
            let user_obj = {
                username: username,
                password: password,
                email: email,
                position: [0, 450],
                curhat: "no_hat",
                elo: 800,
                totalopponentelo: 0,
                topaz: 0,
                ownedskins: ["naked", "poor_skin"],
                ownedhats: ["no_hat", "poor_hat"],
                gamesplayed: 0,
                wins: 0,
                losses: 0,
                draws: 0,
                skin: "naked",
                chessset: 0,
                ownedchesssets: ["default"],
                privatemessages: [],
                usersettings: [0, 0],
                questdata: {},
                modstatus: 0,
                banned: false,
                banreasons: []
            }
            //insert the new user in database
            await db.collection('users').insertOne(user_obj);
            console.log("user " + username + " created");

            return({type:"usercreationresult", data:{result:"usercreated"}});
        }
    }

    async function login(username, password, version){
        let result = await db.collection('users').findOne({username: username});

        if(version != VERSION){
            return({type:"loginresult", data:{result:"wrongversion"}});
        }

        if(!result){
            //100 = user does not exist
            return({type: "loginresult", data: {result: "usernoexist"}});
        }
        else if(result.banned == true){
            //200 = login success
            return({type: "loginresult", data: {result: "userisbanned", 
                                                reason: result.banreasons[result.banreasons.length - 1]}});
        }
        else if(result.password === password){
            //200 = login success
            return({type: "loginresult", data: {result: "loginsuccess"}});
        }
        else{
            //300 = password incorrect
            return({type: "loginresult", data: {result: "passwordincorrect"}});
        }
    }

    async function loginmod(username, password, modkey){
        let result = await db.collection('users').findOne({username: username});

        if(!result){
            //100 = user does not exist
            return({type: "loginresult", data: {result: "usernoexist"}});
        }
        else if(result.modstatus <= 0 || !result.hasOwnProperty("modstatus")){
            return({type: "loginresult", data: {result: "isnotmod"}});
        }
        else if(modkey != MOD_KEY){
            return({type: "loginresult", data: {result: "incorrectmodkey"}});
        }
        else if(result.password === password){
            //200 = login success
            return({type: "loginresult", data: {result: "loginsuccess"}});
        }
        else{
            //300 = password incorrect
            return({type: "loginresult", data: {result: "passwordincorrect"}});
        }
    }

    async function spawnPlayer(user, db, ws){
        let userdata = await getPlayerPubData(user.split(";")[0], db);
        if(userdata){
            PLAYER_MAP.set(user.split(";")[0], new Player(userdata.position, userdata.curhat, userdata.skin, ws));

            let userobj = await db.collection("users").findOne({username: user.split(";")[0]});
            if(userobj.hasOwnProperty("privatemessages")){
                userdata["haspms"] = !(userobj.privatemessages.length === 0);
            }else{
                userdata["haspms"] = false;
            }
            if(userobj.hasOwnProperty("questdata")){
                userdata["questdata"] = userobj.questdata
            }else{
                userdata["questdata"] = {}
            }
            if(userobj.hasOwnProperty("streamermode")){
                userdata["streamermode"] = userobj.streamermode
            }else{
                userdata["streamermode"] = false
            }
            if(userobj.hasOwnProperty("blocked")){
                userdata["blocked"] = userobj.blocked
            }else{
                userdata["blocked"] = []
            }
            if(userobj.hasOwnProperty("trusted")){
                userdata["trusted"] = userobj.trusted
            }else{
                userdata["trusted"] = []
            }

            let playerspawndata = {type: "spawninworld", data: userdata};

            SOCKET_MAP.get(user).send(JSON.stringify(playerspawndata));
            //sendIMessage(JSON.stringify(playerspawndata), SOCKET_MAP.get(user));
        }
        else{
            console.log("user could not be accessed from database");
        }
        
    }

    async function getPlayerPubData(username, db){
        let rawdata = await db.collection("users").findOne({username: username});
        let pubdata = {}
        if(rawdata){
            if(!rawdata.hasOwnProperty('usersettings')){
                rawdata['usersettings'] = [0,0]
            }
    
            pubdata = {
                username: rawdata.username,
                position: rawdata.position,
                curhat: rawdata.curhat,
                elo: rawdata.elo,
                topaz: rawdata.topaz,
                gamesplayed: rawdata.gamesplayed,
                wins: rawdata.wins,
                losses: rawdata.losses,
                draws: rawdata.draws,
                skin: rawdata.skin,
                chessset: rawdata.chessset,
                ownedhats: rawdata.ownedhats,
                ownedskins: rawdata.ownedskins,
                ownedchesssets: rawdata.ownedchesssets,
                usersettings: rawdata.usersettings

            }
        }
        return pubdata;
    }

    async function addPM(receiver, pm){
        db.collection("users").updateOne({username: receiver.username},{
            $push: {privatemessages: pm}
        });

        if(PLAYER_MAP.has(receiver.username)){
            PLAYER_MAP.get(receiver.username).ws.send(JSON.stringify({type:"newpm"}))
        }
    }

    async function getPlayerLiveData(username, PLAYER_MAP){
        let player = PLAYER_MAP.get(username);
        let pubdata = {
            username: username,
            position: player.position,
            curhat: player.curhat,
            skin: player.skin
        }
        return pubdata;
    }

    async function processMostReported(newreporteduser, reporter, reason, db){
        let dateobj = new Date()
        db.collection("users").updateOne({username: newreporteduser},{
            $push: {reports: {date: dateobj.toDateString() + " " + dateobj.toTimeString(), reporter: reporter, reason: reason}}
        }).then(async (T) => {

            let result = await db.collection("users").findOne({username: newreporteduser});
            let numofreports;
            if(result.hasOwnProperty('reports')){
                numofreports = result.reports.length;
            }else{
                numofreports = 0;
                console.log("Something went very wrong")
            }
            let reportobject = [numofreports, newreporteduser]
            //-1 means no
            let alreadyinlistindex = -1;
            for(let i=0; i<most_reported.length; i++){
                if(most_reported[i][1] === newreporteduser){
                    alreadyinlistindex = i;
                }
            }
            if(most_reported.length < most_reported_length){
                if(alreadyinlistindex !== -1){
                    most_reported[alreadyinlistindex] = reportobject
                }else{
                    most_reported.push(reportobject)
                }
            }
            else{
                if(alreadyinlistindex !== -1){
                    //if old number of my reports is more than current
                    if(most_reported[alreadyinlistindex][0] > numofreports){
                        //delete
                        most_reported.splice(alreadyinlistindex, 1);
                    }
                    else{
                        most_reported[alreadyinlistindex] = reportobject
                    }
                    most_reported.sort(function(a, b){return b[0] - a[0]});
                }
                else{
                    most_reported.push(reportobject);
                    most_reported.sort(function(a, b){return b[0] - a[0]});
                    most_reported.pop()
                }

            }

            let topreportedobj = {};
            for(let i=0; i<most_reported.length; i++){
                topreportedobj[most_reported[i][1]] = most_reported[i][0]
            }

            MOD_MAP.forEach((value, key, _map) => {
                value.send(JSON.stringify({
                    type:"newreport",
                    data: {
                        reported: newreporteduser,
                        reason: reason,
                        reporter: reporter,
                        mostreported: topreportedobj
                    }
                }))
            })
            console.log(most_reported)

        }).catch((err)=>{
            console.log("someonereportedinvaliduser")
        })
    }
    async function reportedListUponBan(username){
        for (let i=0; i<most_reported.length; i++){
            if(most_reported[i][1] === username){
                most_reported.splice(i, 1);
            }
        }
    }
    
});

/*
setInterval(() => {
    listofrepcodes = listofrepcodes.slice(-5)
    console.log(listofrepcodes)
}, 20000);*/