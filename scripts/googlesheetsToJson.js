//const fetch = require("node-fetch");
const axios = require('axios');
const dotenv = require("dotenv")
const blockfrost = require('@blockfrost/blockfrost-js');
dotenv.config()
const GOOGLE_API = process.env.GOOGLE_API
const {bech32} = require('bech32');


async function getAllPools(offset=0, data=[]){
    return await axios(`https://api.koios.rest/api/v0/pool_list?offset=${offset}&limit=500`)
    .then(res => {
        if (res.data.length > 0){
            data.push(...res.data);
            console.log(`${offset} with len ${res.data.length} last ${JSON.stringify(data[data.length-1])}`);
            return getAllPools(offset + 500, data);
        }
        return data
    }).catch(e => {console.log(e)})
}

async function getGooglesheetData(){
    const gSheetData = await axios(`https://sheets.googleapis.com/v4/spreadsheets/1-mA8vY0ZtzlVdH4XA5-J4nIZo4qFR_vFbnBFkpMLlYo/values/MainQueue?key=${GOOGLE_API}`)
    .then(res => {
        //const header = res.data.values[1];
        const rows = res.data.values.slice(15);
        //return [header, ...rows]
        return rows
    })

    const poolList = await getAllPools().then(d => {return d});
    for (x in poolList){
        //console.log(poolList[x].ticker)
        if (poolList[x].poolId === "pool1xpfe5q3v3axrjdc8h38taaa93frq3m9pfewxk46x4r6jgy2yj5n")
        {
            console.log("found it")
            console.log(poolList[x].ticker)
        }
    }

    for(row in gSheetData){
        const stakeHex = gSheetData[row][8];
        const stakeAddressDecoded = 'e1' + stakeHex;
        var bech32StakeAddress = stakeHex;
        if (stakeHex.indexOf("stake") !== 0){
           bech32StakeAddress = bech32.encode(
              'stake',
              bech32.toWords(Uint8Array.from(Buffer.from(stakeAddressDecoded, 'hex'))),
              1000
            );
        }
        const ticker = gSheetData[row][2];
        const poolData = poolList.find(p => p.ticker === ticker.toUpperCase());
        // handle the maple edge case
        var poolId = undefined;
        if(poolData !== undefined){
            poolId = poolData.pool_id_bech32
        }
        else if(ticker === "MAPLE"){
            // handle MAPLE edge case
            poolId = "pool1xpfe5q3v3axrjdc8h38taaa93frq3m9pfewxk46x4r6jgy2yj5n"
        }
        else if(ticker === "ASTCH"){
            // handle ASTCH edge case
            poolID = "pool1q2fh3cl6rx0wv5gry4qx5l4h65qpjf7x99xmq66nqj2fj5g6u9z"
        }
        console.log(`ticker=${ticker} : stake=${bech32StakeAddress} : poolId=${poolId}`)
    }
}

getGooglesheetData()