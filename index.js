const Websocket = require('ws');

const PORT = 4421

const wss = new Websocket.Server({port: PORT});

const { MongoClient } = require('mongodb');
const mongo_url = 'mongodb://127.0.0.1:27017/';

var SOCKET_MAP = new Map();

var PLAYER_MAP = new Map();

var currentgames = new Map();

var waitingforgame = [];

var chessmatchcounter = 100

class ChessGame {
    constructor(user1, user2, coin){
        this.user1 = user1
        this.user2 = user2
        this.whitedraw = false
        this.blackdraw = false
        this.turn = 0
        this.gameisover = false;
        this.boardstate = [14,12,13,15,16,13,12,14,
                            11,11,11,11,11,11,11,11,
                            0,0,0,0,0,0,0,0,
                            0,0,0,0,0,0,0,0,
                            0,0,0,0,0,0,0,0,
                            0,0,0,0,0,0,0,0,
                            1,1,1,1,1,1,1,1,
                            4,2,3,5,6,3,2,4]

        let newgamedata = {
            type: "newgame", data: {
                gamecode: chessmatchcounter,
                perspective: 0,
            }
        };                    
        if(coin < 0.5){
            this.white = user1
            this.black = user2
            newgamedata.data.white = this.white.split(";")[0]
            newgamedata.data.black = this.black.split(";")[0]
            SOCKET_MAP.get(user1).send(JSON.stringify(newgamedata));
            newgamedata.data.perspective = 1;
            SOCKET_MAP.get(user2).send(JSON.stringify(newgamedata));
        }else{
            this.white = user2
            this.black = user1
            newgamedata.data.white = this.white.split(";")[0]
            newgamedata.data.black = this.black.split(";")[0]
            SOCKET_MAP.get(user2).send(JSON.stringify(newgamedata));
            newgamedata.data.perspective = 1;
            SOCKET_MAP.get(user1).send(JSON.stringify(newgamedata));
        }
    }

    makeMove(move, pprom, boardstate, hasmovedbs){
        this.whitedraw = false;
        this.blackdraw = false;
        this.boardstate = boardstate
        let movedata = {}
        if(pprom){
            movedata = {
                type: "sync", data: {
                    boardstate: this.boardstate,
                    hasmovedbs: hasmovedbs
                }
            };
        }else{

            movedata = {
                type: "makemove", data: {
                    move: move
                }
            };
        }

        if(this.turn == 0){
            SOCKET_MAP.get(this.black).send(JSON.stringify(movedata));
            this.turn = 10
        }else{
            SOCKET_MAP.get(this.white).send(JSON.stringify(movedata));
            this.turn = 0
        }

    }

    calcElo(totalopponentelo, wins, losses, totalgames){
        let elo = (totalopponentelo + 400 * (wins - losses)) / totalgames
        return elo
    }

    async gameOver(reason, userthatlost, db){
        /*
        game is over if:
        -checkmate
        -draw
        -someone resigns
        -someone disconnects
        ////
        whitewins = 0
        blackwins = 1
        draw = 2
        
        */

        if(this.gameisover == false){

            let userthatwon;

            if(userthatlost === this.user1){
                userthatwon = this.user2;
            }
            else if(userthatlost === this.user2){
                userthatwon = this.user1;
            }
            else{
                userthatwon = 0;
            }
            
            let whiteuserobj = await db.collection('users').findOne({username: this.white.split(";")[0]});
            let blackuserobj = await db.collection('users').findOne({username: this.black.split(";")[0]});

            if(whiteuserobj && blackuserobj){
                let whitewin;
                let blackwin;
                let whiteloss;
                let blackloss;
                let whitedraw;
                let blackdraw;
                let whiteTOE;
                let blackTOE;
                let whitetotalgames;
                let blacktotalgames;
                let whiteelodif;
                let blackelodif;
                
                let userwinner;

                if(userthatwon === this.white){
                    whitewin = whiteuserobj.wins + 1;
                    whiteloss = whiteuserobj.losses;
                    whitedraw = whiteuserobj.draws;
                    whiteTOE = whiteuserobj.totalopponentelo + blackuserobj.elo;
                    blackwin = blackuserobj.wins;
                    blackloss = blackuserobj.losses + 1;
                    blackdraw = blackuserobj.draws;
                    blackTOE = blackuserobj.totalopponentelo + whiteuserobj.elo;

                    userwinner = this.white.split(";")[0];
                    console.log("white(" + userwinner + ") won!")
                }
                else if(userthatwon === this.black){
                    whitewin = whiteuserobj.wins;
                    whiteloss = whiteuserobj.losses + 1;
                    whitedraw = whiteuserobj.draws;
                    whiteTOE = whiteuserobj.totalopponentelo + blackuserobj.elo;
                    blackwin = blackuserobj.wins + 1;
                    blackloss = blackuserobj.losses;
                    blackdraw = blackuserobj.draws;
                    blackTOE = blackuserobj.totalopponentelo + whiteuserobj.elo;
                    userwinner = this.black.split(";")[0];
                    console.log("black(" + userwinner + ") won!")
                }
                else if(userthatwon === 0){
                    whitewin = whiteuserobj.wins;
                    whiteloss = whiteuserobj.losses;
                    whitedraw = whiteuserobj.draws + 1;
                    whiteTOE = whiteuserobj.totalopponentelo + blackuserobj.elo;
                    blackwin = blackuserobj.wins;
                    blackloss = blackuserobj.losses;
                    blackdraw = blackuserobj.draws + 1;
                    blackTOE = blackuserobj.totalopponentelo + whiteuserobj.elo;
                    userwinner = 0;
                }
                whitetotalgames = whiteuserobj.gamesplayed + 1;
                blacktotalgames = blackuserobj.gamesplayed + 1;


                let elowhite = this.calcElo(whiteTOE, whitewin, whiteloss, whitetotalgames);
                let eloblack = this.calcElo(blackTOE, blackwin, blackloss, blacktotalgames);

                whiteelodif = elowhite - whiteuserobj.elo;
                blackelodif = eloblack - blackuserobj.elo;

                db.collection("users").updateOne({username: this.white.split(";")[0]}, 
                                                {$set: {
                                                    wins: whitewin,
                                                    losses: whiteloss,
                                                    draws: whitedraw,
                                                    elo: elowhite,
                                                    gamesplayed: whitetotalgames,
                                                    totalopponentelo: whiteTOE
                                                }});

                db.collection("users").updateOne({username: this.black.split(";")[0]}, 
                                                {$set: {
                                                    wins: blackwin,
                                                    losses: blackloss,
                                                    draws: blackdraw,
                                                    elo: eloblack,
                                                    gamesplayed: blacktotalgames,
                                                    totalopponentelo: blackTOE
                                                }});

                let gameoverdata = {
                    type: "gameover", data: {
                        reason: reason,
                        winner: userwinner,
                        whiteelo: {newelo: elowhite, dif: whiteelodif},
                        blackelo: {newelo: eloblack, dif: blackelodif}
                    }
                }


                if(SOCKET_MAP.get(this.white)){
                    SOCKET_MAP.get(this.white).send(JSON.stringify(gameoverdata));
                }
                if(SOCKET_MAP.get(this.black)){
                    SOCKET_MAP.get(this.black).send(JSON.stringify(gameoverdata));
                }
                this.gameisover = true;
            }else{
                console.log("userdata not found from database");
            }
            
        }
        
    }

    newGame(){
        SOCKET_MAP.get(this.user1).send(JSON.stringify({type:"restartgame"}));
        SOCKET_MAP.get(this.user2).send(JSON.stringify({type:"restartgame"}));
        this.turn = 0
        this.whitedraw = false
        this.blackdraw = false
        this.gameisover = false;
        this.boardstate = [14,12,13,15,16,13,12,14,
                            11,11,11,11,11,11,11,11,
                            0,0,0,0,0,0,0,0,
                            0,0,0,0,0,0,0,0,
                            0,0,0,0,0,0,0,0,
                            0,0,0,0,0,0,0,0,
                            1,1,1,1,1,1,1,1,
                            4,2,3,5,6,3,2,4]
    }

    offerDraw(who){
        if (who === this.white){
            if(this.whitedraw == false){
                this.whitedraw = true;
                SOCKET_MAP.get(this.black).send(JSON.stringify({type:"drawoffered"}));
            }
        }
        else if(who === this.black){
            if(this.blackdraw == false){
                this.blackdraw = true;
                SOCKET_MAP.get(this.white).send(JSON.stringify({type:"drawoffered"}));
            }
        }
    }

}

class Player {
    constructor(position, curhat, skin, ws){
        this.position = position;
        this.velocity = [0, 0];
        this.dir = 1;
        this.animstate = "Idle";
        this.curhat = curhat;
        this.skin = skin;
        this.ws = ws;
    }

}

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
                                                                            coin));
                        
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

            //Overworld

            else if (msg["type"] == "worlddatareq"){
                //user must also give information about self
                //server updates it
                let playerref = PLAYER_MAP.get(msg.data.username + ";" + msg.data.password)

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
                ///
                //possibly really bad????
                PLAYER_MAP.forEach((value, key, _map) => {
                    let username = key.split(";")[0];
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

                if(PLAYER_MAP.has(user)){
                    db.collection("users").updateOne({username: user.split(";")[0]}, 
                                                        {$set: {
                                                            position: PLAYER_MAP.get(user).position,
                                                            curhat: PLAYER_MAP.get(user).curhat,
                                                            skin: PLAYER_MAP.get(user).skin
                                                        }});

                    PLAYER_MAP.delete(user);
                }

                currentgames.forEach((value, key, _map) => {
                    if(value.user1 == user){
                        console.log("user1 disconnected from game", )
                        value.gameOver("opponent disconnected from game", value.user1, db);
                        //end the game and make user that didn't disconnect win
                    }
                    else if(value.user2 == user){
                        console.log("user2 disconnected from game")
                        value.gameOver("opponent disconnected from game", value.user2, db);
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


    function getKeyByValue(map, searchValue){
        for(let [key, value] of map){
            if(value === searchValue){
                return(key);
            }
        }
    }

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
            PLAYER_MAP.set(user, new Player(userdata.position, userdata.curhat, userdata.skin, ws));

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

    function isLoggedIn(user){
        let result = SOCKET_MAP.get(user)
        if (result){
            return true;
        }else{
            return false;
        }
    }
});