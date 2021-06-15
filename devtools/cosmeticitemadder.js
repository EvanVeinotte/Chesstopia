const { MongoClient } = require('mongodb');
const mongo_url = 'mongodb://127.0.0.1:27017/';

const readline = require("readline");
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});


MongoClient.connect(mongo_url, (err, client) => {

    if(err) throw err;

    var db = client.db('Chesstopia');

    let quit = false;

    while(!quit){
        rl.question("What type of item would you like to add?", (itemtype) => {
            rl.question("What is the name of the item?", (itemname) => {
                rl.question("What is the price of the item?", itemprice => {
                    if(itemtype == "hats"){
                        let insertDoc = {
                            hatname: itemname,
                            price: itemprice,
                            howmany: 0
                        }
                    }
                    else if(itemtype == "skins"){
                        let insertDoc = {
                            skinname: itemname,
                            price: itemprice,
                            howmany: 0
                        }
                    }
                    else if(itemtype == "chesssets"){
                        let insertDoc = {
                            chesssetname: itemname,
                            price: itemprice,
                            howmany: 0
                        }
                    }else{
                        console.log("error: invalid itemtype")
                        process.exit(0)
                    }

                    db.collection(itemtype).insertOne(insertDoc)

                    rl.question("Would you like to go again?(y/n)", (answer) => {
                        if(answer != "y"){
                            quit = true
                        }
                    })
                })
            })
        })
    }
})