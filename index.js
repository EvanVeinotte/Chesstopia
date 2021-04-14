const Websocket = require('ws');

const PORT = 4421

const wss = new Websocket.Server({port: PORT});

const { MongoClient } = require('mongodb');
const mongo_url = 'mongodb://127.0.0.1:27017/';

var SOCKET_MAP = new Map();

var currentgames = new Map();

var waitingforgame = [];

var chessmatchcounter = 100

class ChessGame {
    constructor(user1, user2, coin){
        this.user1 = user1
        this.user2 = user2
        this.turn = 0
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
                perspective: 0
            }
        };                    
        if(coin < 0.5){
            this.white = user1
            this.black = user2
            SOCKET_MAP.get(user1).send(JSON.stringify(newgamedata));
            newgamedata.data.perspective = 1;
            SOCKET_MAP.get(user2).send(JSON.stringify(newgamedata));
        }else{
            this.white = user2
            this.black = user1
            SOCKET_MAP.get(user2).send(JSON.stringify(newgamedata));
            newgamedata.data.perspective = 1;
            SOCKET_MAP.get(user1).send(JSON.stringify(newgamedata));
        }
    }

    makeMove(move, pprom, boardstate, hasmovedbs){
        this.boardstate = boardstate
        let movedata = {}
        if(pprom){
            console.log("syncsent")
            movedata = {
                type: "sync", data: {
                    boardstate: this.boardstate,
                    hasmovedbs: hasmovedbs
                }
            };
        }else{
            console.log("movesent")

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

    gameOver(){

    }

    newGame(){
        SOCKET_MAP.get(this.user1).send(JSON.stringify({type:"restartgame"}));
        SOCKET_MAP.get(this.user2).send(JSON.stringify({type:"restartgame"}));
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
                }
            
            }
            else if (msg["type"] == "createaccount"){
                let result = await createUser(msg.data.username, msg.data.password);
                ws.send(JSON.stringify(result));
                if(result.data.result == "usercreated"){
                    SOCKET_MAP.set(msg["data"]["username"] + ";" + msg["data"]["password"], ws);
                    console.log(`client logged in to ${msg["data"]["username"]}`);
                }
            }

            else if (msg["type"] == "newgame"){
                //username
                if(isLoggedIn(msg.data.username + ";" + msg.data.password)){
                    waitingforgame.push(msg.data.username + ";" + msg.data.password)
                    console.log(waitingforgame)
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

        });

        ws.on('close', (code, reason) => {
            let user = getKeyByValue(SOCKET_MAP, ws);
            if(user){

                SOCKET_MAP.delete(user)

                console.log(user)
                userwaitingindex = waitingforgame.indexOf(user);
                if(userwaitingindex > -1){
                    console.log("userwaswaitingforgame")
                    waitingforgame.splice(userwaitingindex, 1);
                }

                currentgames.forEach((value, key, _map) => {
                    if(value.user1 == user){
                        console.log("user1 disconnected from game")
                        //end the game and make user that didn't disconnect win
                    }
                    else if(value.user2 == user){
                        console.log("user2 disconnected from game")
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
        
        let result = await db.collection('Users').findOne({username: username});
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
                position: 0,
                curhat: 0,
                elo: 800,
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
        let result = await db.collection('Users').findOne({username: username});

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

    function isLoggedIn(user){
        let result = SOCKET_MAP.get(user)
        if (result){
            return true;
        }else{
            return false;
        }
    }
});