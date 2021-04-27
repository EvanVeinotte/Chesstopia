const Websocket = require('ws');

const ChessGame = require('./gameobjects').ChessGame
const Player = require('./gameobjects').Player

const getKeyByValue = require('./utils').getKeyByValue
const isLoggedIn = require('./utils').isLoggedIn

const PORT = 4421

const wss = new Websocket.Server({port: PORT});

const { MongoClient } = require('mongodb');
const mongo_url = 'mongodb://127.0.0.1:27017/';

var SOCKET_MAP = new Map();

var PLAYER_MAP = new Map();

var currentgames = new Map();

var waitingforgame = [];

var chessmatchcounter = 100



MongoClient.connect(mongo_url, (err, client) => {

    if(err) throw err;

    var db = client.db('Chesstopia');

    console.log(`running WebSocket Server on port ${PORT}`);

    wss.on('connection', async function(ws) {

        ws.on('message', async function(message){

            let msg = JSON.parse(message);

            if (msg["type"] == "login"){
                
                let loginresult = await login(msg.data.username, msg.data.password);
                ws.send(JSON.stringify(loginresult));
                if(loginresult.data.result == "loginsuccess"){
                    SOCKET_MAP.set(msg["data"]["username"] + ";" + msg["data"]["password"], ws);
                    console.log(`client logged in to ${msg["data"]["username"]}`);
                    //spawn the player into the world
                    spawnPlayer(msg["data"]["username"] + ";" + msg["data"]["password"], db, ws);
                }
            
            }
            else if (msg["type"] == "createaccount"){
                let result = await createUser(msg.data.username, msg.data.password);
                ws.send(JSON.stringify(result));
                if(result.data.result == "usercreated"){
                    SOCKET_MAP.set(msg["data"]["username"] + ";" + msg["data"]["password"], ws);
                    console.log(`client logged in to ${msg["data"]["username"]}`);
                    //spawn the player into the world
                    spawnPlayer(msg["data"]["username"] + ";" + msg["data"]["password"], db, ws);
                }
            }

            else if (msg["type"] == "newgame"){
                //username
                if(isLoggedIn(msg.data.username + ";" + msg.data.password)){
                    waitingforgame.push(msg.data.username + ";" + msg.data.password)
                    if(waitingforgame.length >= 2){
                        let coin = Math.random()
                        currentgames.set(chessmatchcounter, new ChessGame(waitingforgame[0], 
                                                                            waitingforgame[1],
                                                                            coin, chessmatchcounter));
                        
                        console.log("new game created")
                        waitingforgame = [];
                        chessmatchcounter += 1;
                    }
                }
                
            }

            else if (msg["type"] == "makemove"){
                console.log("makemove:" + msg.data.gamecode.toString())
                let usergame = currentgames.get(msg.data.gamecode)
                if(usergame){
                    usergame.makeMove(msg.data.move, msg.data.pprom, msg.data.boardstate, msg.data.hasmovedbs);
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
            else if (msg["type"] == "gameexited"){
                let usergame = currentgames.get(msg.data.gamecode)
                if(usergame){
                    usergame.gameExited(msg.data.username + ";" + msg.data.password, db);
                }
                else{
                    console.log("game not found")
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
                        skin: value.skin
                    };
                });

                ws.send(JSON.stringify(otherplayerdata));
            }

            else if (msg["type"] == "challengereq"){
                PLAYER_MAP.get(msg.data.challengee).ws.send(JSON.stringify({
                    type: "newchallenge",
                    data: {
                        challenger: msg.data.challenger,
                        challengee: msg.data.challengee
                    }
                }));
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
                    if(isLoggedIn(user1) && isLoggedIn(user2)){

                        let coin = Math.random()
                        currentgames.set(chessmatchcounter, new ChessGame(user1, user2, coin, chessmatchcounter));
                        
                        console.log("new game created");
                        chessmatchcounter += 1;
                    }
                }
            }
        });
        

        ws.on('close', (code, reason) => {
            let user = getKeyByValue(SOCKET_MAP, ws);
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
                });

                console.log(`user ${user} disconnected with code ${code}`);
                console.log(waitingforgame)

            }else{
                console.log(`unknown user disconnected with code ${code}`)
            }
            
        });

    }
    );




    async function createUser(username, password){

        if(!username.match("^[A-Za-z0-9]+$") || !password.match("^[A-Za-z0-9]+$")){
            return({type:"usercreationresult", data:{result:"invalidchars"}});
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
                position: [0, 450],
                curhat: 0,
                elo: 800,
                totalopponentelo: 0,
                credits: 0,
                ownedhats: [0],
                gamesplayed: 0,
                wins: 0,
                losses: 0,
                draws: 0,
                skin: 0,
                chessset: 0,
                ownedchesssets: [0]
            }
            //insert the new user in database
            db.collection('users').insertOne(user_obj, (err, result) => {
                if(err) throw err;
                console.log("Created new user " + username);    
            });
            //1 is code for user creation success
            //using semicolon split system
            return({type:"usercreationresult", data:{result:"usercreated"}});
        }
    }

    async function login(username, password){
        let result = await db.collection('users').findOne({username: username});

        if(!result){
            //100 = user does not exist
            return({type: "loginresult", data: {result: "usernoexist"}});
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
        let userdata = await db.collection('users').findOne({username: user.split(";")[0]});
        if(userdata){
            PLAYER_MAP.set(user.split(";")[0], new Player(userdata.position, userdata.curhat, userdata.skin, ws));

            let playerspawndata = {type: "spawninworld", data: {
                position: userdata.position,
                curhat: userdata.curhat,
                skin: userdata.skin
            }};

            SOCKET_MAP.get(user).send(JSON.stringify(playerspawndata));
        }
        else{
            console.log("user could not be accessed from database");
        }
        
    }

    
});