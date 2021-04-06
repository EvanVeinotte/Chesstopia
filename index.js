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
    constructor(user1, user2){
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
        let coin = Math.random()
        if(coin < 0.5){
            this.white = user1
            this.black = user2
        }else{
            this.white = user2
            this.black = user1
        }
    }

    makeMove(move, pprom, boardstate){
        this.boardstate = boardstate
        let movedata = {}
        if(pprom){
            movedata = {
                type: "sync", data: {
                    boardstate: this.boardstate
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

    gameOver(){

    }

}

MongoClient.connect(mongo_url, (err, client) => {

    if(err) throw err;

    var db = client.db('Chesstopia');

    console.log(`running WebSocket Server on port ${PORT}`);

    wss.on('connection', ws => {

        ws.on('message', message =>{

            let msg = JSON.parse(message);

            if (msg["type"] == "set_name"){

                SOCKET_MAP.set(msg["data"]["username"], ws)
                console.log(`client set name to ${msg["data"]["username"]}`)
            
            }
            else if (msg["type"] == "newgame"){
                waitingforgame.push(msg.data.username)

                if(waitingforgame.length >= 2){
                    currentgames.set(chessmatchcounter, new ChessGame(waitingforgame[0], 
                                                                        waitingforgame[1]));

                    let newgamedata = {
                        type: "newgame", data: {
                            gamecode = chessmatchcounter
                        }
                    };

                    SOCKET_MAP.get(waitingforgame[0]).send(JSON.stringify(newgamedata));
                    SOCKET_MAP.get(waitingforgame[1]).send(JSON.stringify(newgamedata));

                    waitingforgame = [];
                    chessmatchcounter += 1;
                }
            }

            else if (msg["type"] == "makemove"){
                let usergame = currentgames.get(msg.data.gamecode)
                if(usergame){
                    usergame.makeMove(msg.data.move, msg.data.pprom, msg.data.boardstate);
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

                console.log(`user ${user} disconnected with code ${code}`);

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
});