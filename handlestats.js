//{'0:00': 1, '1:00': 2, '2:00': 4, '3:00': 7, '4:00': 12, '5:00': 14, '6:00': 18,'7:00': 27, '8:00': 29, '9:00': 34, '10:00': 33, '11:00': 59, '12:00': 72, '13:00': 31,'14:00': 0, '15:00': 0, '16:00': 0, '17:00': 0, '18:00': 0, '19:00': 0, '20:00': 0,'21:00': 0, '22:00': 0, '23:00': 0, 'peak': 0}
class StatHandler{
    constructor(db, player_map){
        this.db = db;
        this.player_map = player_map;
        this.peakminutes = [0];
        this.minval = 0;
        this.defaulthours = {'0:00': 0, '1:00': 0, '2:00': 0, '3:00': 0, '4:00': 0, '5:00': 0, '6:00': 0,
                            '7:00': 0, '8:00': 0, '9:00': 0, '10:00': 0, '11:00': 0, '12:00': 0, '13:00': 0,
                            '14:00': 0, '15:00': 0, '16:00': 0, '17:00': 0, '18:00': 0, '19:00': 0, '20:00': 0,
                            '21:00': 0, '22:00': 0, '23:00': 0, 'peak': 0}
        this.peakhours = {...this.defaulthours};
        
        this.EveryMin()
    }

    async EveryMin(){
        this.secondInterval = setInterval(async () => {
            let date_obj = new Date();
            if(date_obj.getSeconds() === 59){

                let cmin = date_obj.getMinutes()
                let chour = date_obj.getHours()
                let cday = date_obj.getDate()
                let cmonth = date_obj.getMonth()
                let cyear = date_obj.getFullYear()

                this.minval = this.player_map.size;
                this.peakminutes.push(this.minval);
                //save curplayers to db
                this.db.collection('gamestats').updateOne({dataname: "curusersonline"},
                                                            {$set:{data: this.minval}})


                //new hour
                if(cmin === 0){

                    //new day
                    if(chour === 0){
                        let dailypeak = 0;
                        let curval;
                        for (let i=0; i<24; i++){
                            curval = this.peakhours[i.toString() + ":00"];
                            if (curval > dailypeak){
                                dailypeak = curval;
                            }
                        }
                        this.peakhours['peak'] = dailypeak;

                    }

                    //
                    let peakhourval = Math.max(...this.peakminutes)
                    
                    this.peakhours[(chour).toString() + ':00'] = peakhourval


                    await this.addNewHourPeak(cyear, cmonth,
                                        cday, {...this.peakhours});
                    this.peakminutes = [0];

                    //also new day
                    if(chour === 0){

                        this.db.collection('gamestats').updateOne({dataname: cyear + ("0" + (cmonth + 1)).slice(-2)},
                                                                        {$push:{peaksofthemonth: dailypeak,
                                                                                peaksdays: cday}}).catch((err)=>{
                                                                                    console.log("*** " + err + " ***")
                                                                                })

                        this.peakhours = {...this.defaulthours}
                    }
                    
                }
            }
        }, 1000);
    }

    async addNewHourPeak(year, month, day, peakhours){
        console.log("omega1")
        let monthresult = await this.db.collection('gamestats').findOne({dataname: year + ("0" + (month + 1)).slice(-2)});
        if(monthresult){
            console.log("omega2")
            let setobj = {}
            setobj[("0" + day).slice(-2)] = peakhours
            await this.db.collection('gamestats').updateOne({dataname: year + ("0" + (month + 1)).slice(-2)},
                                                        {$set:setobj})
            
        }else{
            console.log("omega3")
            let newdoc = {'dataname': year + ("0" + (month + 1)).slice(-2)}
            newdoc[("0" + day).slice(-2)] = peakhours;

            await this.db.collection('gamestats').insertOne(newdoc)
        }
    }

}

module.exports = { StatHandler };