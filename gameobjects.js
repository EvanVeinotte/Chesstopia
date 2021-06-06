const { sendIMessage } = require("./utils");

class ChessGame {
    constructor(user1, user2, gametime, u1elo, u2elo, coin, code, currentgames, SOCKET_MAP){
        this.code = code;
        this.gametime;
        this.currentgames = currentgames;
        this.SOCKET_MAP = SOCKET_MAP;
        this.user1 = user1;
        this.user2 = user2;
        this.whitedraw = false;
        this.blackdraw = false;
        this.turn = 0;
        this.gameisover = false;
        this.userexited = false;
        this.userthatexited = null;
        this.boardstate = [14,12,13,15,16,13,12,14,
                            11,11,11,11,11,11,11,11,
                            0,0,0,0,0,0,0,0,
                            0,0,0,0,0,0,0,0,
                            0,0,0,0,0,0,0,0,
                            0,0,0,0,0,0,0,0,
                            1,1,1,1,1,1,1,1,
                            4,2,3,5,6,3,2,4]
        
        //
        
        this.u1elo = u1elo
        this.u2elo = u2elo
        

        let newgamedata = {
            type: "newgame", data: {
                gamecode: code,
                gametime: gametime,
                perspective: 0,
            }
        };                    
        if(coin < 0.5){
            this.white = user1
            this.black = user2
            newgamedata.data.white = this.white.split(";")[0]
            newgamedata.data.black = this.black.split(";")[0]
            newgamedata.data.whiteelo = this.u1elo;
            newgamedata.data.blackelo = this.u2elo;
            this.SOCKET_MAP.get(user1).send(JSON.stringify(newgamedata));
            //sendIMessage(JSON.stringify(newgamedata), this.SOCKET_MAP.get(user1))
            newgamedata.data.perspective = 1;
            this.SOCKET_MAP.get(user2).send(JSON.stringify(newgamedata));
            //sendIMessage(JSON.stringify(newgamedata), this.SOCKET_MAP.get(user2))
        }else{
            this.white = user2
            this.black = user1
            newgamedata.data.white = this.white.split(";")[0]
            newgamedata.data.black = this.black.split(";")[0]
            newgamedata.data.whiteelo = this.u2elo;
            newgamedata.data.blackelo = this.u1elo;
            this.SOCKET_MAP.get(user2).send(JSON.stringify(newgamedata));
            //sendIMessage(JSON.stringify(newgamedata), this.SOCKET_MAP.get(user2))
            newgamedata.data.perspective = 1;
            this.SOCKET_MAP.get(user1).send(JSON.stringify(newgamedata));
            //sendIMessage(JSON.stringify(newgamedata), this.SOCKET_MAP.get(user1))
        }
    }

    makeMove(move, pprom, boardstate, hasmovedbs, mytime){
        this.whitedraw = false;
        this.blackdraw = false;
        this.boardstate = boardstate
        let movedata = {}
        if(pprom){
            movedata = {
                type: "sync", data: {
                    boardstate: this.boardstate,
                    hasmovedbs: hasmovedbs,
                    opponenttime: mytime
                }
            };
        }else{

            movedata = {
                type: "makemove", data: {
                    move: move,
                    opponenttime: mytime
                }
            };
        }

        if(this.turn == 0){
            this.SOCKET_MAP.get(this.black).send(JSON.stringify(movedata));
            //sendIMessage(JSON.stringify(movedata), this.SOCKET_MAP.get(this.black))
            this.turn = 10
        }else{
            this.SOCKET_MAP.get(this.white).send(JSON.stringify(movedata));
            //sendIMessage(JSON.stringify(movedata), this.SOCKET_MAP.get(this.white))
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

                let whiteearnedtopaz = 0;
                let blackearnedtopaz = 0;

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

                    whiteearnedtopaz = Math.floor((blackuserobj.elo/800) * 100);
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

                    blackearnedtopaz = Math.floor((whiteuserobj.elo/800) * 100);
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
                                                    totalopponentelo: whiteTOE,
                                                    topaz: whiteearnedtopaz + whiteuserobj.topaz
                                                }});

                db.collection("users").updateOne({username: this.black.split(";")[0]}, 
                                                {$set: {
                                                    wins: blackwin,
                                                    losses: blackloss,
                                                    draws: blackdraw,
                                                    elo: eloblack,
                                                    gamesplayed: blacktotalgames,
                                                    totalopponentelo: blackTOE,
                                                    topaz: blackearnedtopaz + blackuserobj.topaz
                                                }});

                let gameoverdata = {
                    type: "gameover", data: {
                        reason: reason,
                        winner: userwinner,
                        whiteelo: {newelo: elowhite, dif: whiteelodif},
                        whitetopaz: whiteearnedtopaz,
                        blackelo: {newelo: eloblack, dif: blackelodif},
                        blacktopaz: blackearnedtopaz
                    }
                }


                if(this.SOCKET_MAP.get(this.white)){
                    this.SOCKET_MAP.get(this.white).send(JSON.stringify(gameoverdata));
                    //sendIMessage(JSON.stringify(gameoverdata), this.SOCKET_MAP.get(this.white))
                }
                if(this.SOCKET_MAP.get(this.black)){
                    this.SOCKET_MAP.get(this.black).send(JSON.stringify(gameoverdata));
                    //sendIMessage(JSON.stringify(gameoverdata), this.SOCKET_MAP.get(this.black))
                }
                this.gameisover = true;
            }else{
                console.log("userdata not found from database");
            }
            
        }   
    }

    gameExited(who, db){

        if(!this.gameisover){
            if(this.userexited === false){
                this.userexited = true;
                this.userthatexited = who
                let exitstring = who.split(";")[0] + " exited the game!";
                this.gameOver(exitstring, who, db);
            }
        }
        else{
            if(this.userexited === false){
                this.userexited = true;
                this.userthatexited = who;

                let userexiteddata = {
                    type: "opponentexited",
                    data: {
                        who: who.split(";")[0]
                    }
                }

                if(this.user1 === who){
                    this.SOCKET_MAP.get(this.user2).send(JSON.stringify(userexiteddata));
                    //sendIMessage(JSON.stringify(userexiteddata), this.SOCKET_MAP.get(this.user2))
                }else{
                    this.SOCKET_MAP.get(this.user1).send(JSON.stringify(userexiteddata));
                    //sendIMessage(JSON.stringify(userexiteddata), this.SOCKET_MAP.get(this.user1))
                }
            }
            else{
                this.closeYourself();
            }
        }
    }

    newGame(){
        if(!this.userexited){
            this.SOCKET_MAP.get(this.user1).send(JSON.stringify({type:"restartgame"}));
            this.SOCKET_MAP.get(this.user2).send(JSON.stringify({type:"restartgame"}));
            //sendIMessage(JSON.stringify({type:"restartgame"}), this.SOCKET_MAP.get(this.user1))
            //sendIMessage(JSON.stringify({type:"restartgame"}), this.SOCKET_MAP.get(this.user2))
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
        else{
            if(this.userthatexited == this.user1){
                this.SOCKET_MAP.get(this.user2).send(JSON.stringify({type:"opponentexited", data:{
                    who: this.user1.split(";")[0]
                }}));
                /*sendIMessage(JSON.stringify(JSON.stringify({type:"opponentexited", data:{
                    who: this.user1.split(";")[0]
                }})), this.SOCKET_MAP.get(this.user2))*/
            }
            else if(this.userthatexited == this.user2){
                this.SOCKET_MAP.get(this.user1).send(JSON.stringify({type:"opponentexited", data:{
                    who: this.user2.split(";")[0]
                }}));
                /*sendIMessage(JSON.stringify(JSON.stringify({type:"opponentexited", data:{
                    who: this.user2.split(";")[0]
                }})), this.SOCKET_MAP.get(this.user1))*/
            }
        }
    }

    offerDraw(who){
        if(!this.gameisover){
            if (who === this.white){
                if(this.whitedraw == false){
                    this.whitedraw = true;
                    this.SOCKET_MAP.get(this.black).send(JSON.stringify({type:"drawoffered"}));
                    //sendIMessage(JSON.stringify({type:"drawoffered"}), this.SOCKET_MAP.get(this.black))
                }
            }
            else if(who === this.black){
                if(this.blackdraw == false){
                    this.blackdraw = true;
                    this.SOCKET_MAP.get(this.white).send(JSON.stringify({type:"drawoffered"}));
                    //sendIMessage(JSON.stringify({type:"drawoffered"}), this.SOCKET_MAP.get(this.white))
                }
            }
        }
        
    }

    offerNewGame(who){
        
        if(this.userexited === false){
            if (who === this.white){
                this.SOCKET_MAP.get(this.black).send(JSON.stringify({type:"offerednewgame"}));
            }
            else if(who === this.black){
                this.SOCKET_MAP.get(this.white).send(JSON.stringify({type:"offerednewgame"}));
            }
        }
    
        
    }

    closeYourself(){
        this.currentgames.delete(this.code);
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
        this.speech = "";
        this.ws = ws;
    }
}

module.exports = { ChessGame, Player };