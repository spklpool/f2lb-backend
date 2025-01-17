//const fetch = require("node-fetch");
const axios = require('axios');
const dotenv = require("dotenv")
const koios = require('../api/koios')
dotenv.config()
const GOOGLE_API = process.env.GOOGLE_API
const {bech32} = require('bech32');
const redis = require('../db/redis')


async function getGooglesheetData(){
    console.log("Recovering data from googlesheet. Try again on error...")
    var pools = []
    const gSheetData = await axios(`https://sheets.googleapis.com/v4/spreadsheets/1-mA8vY0ZtzlVdH4XA5-J4nIZo4qFR_vFbnBFkpMLlYo/values/MainQueue?key=${GOOGLE_API}`)
    .then(res => {
        //const header = res.data.values[1];
        const rows = res.data.values.slice(15);
        return rows
    })
    const currentEpoch = await koios.epoch()
    const poolList = await koios.pools().then(d => {return d});
    var targetEpoch = parseInt(currentEpoch);
    var index = 0
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
        // calc epochs
        const ticker = gSheetData[row][2];
        const epochsGranted = parseInt(gSheetData[row][4]);
        var epochs = []
        for (let i = 0; i < epochsGranted; i++){
            epochs.push(parseInt(targetEpoch + i))
        }
        targetEpoch += epochsGranted;
        // get pool ID
        const poolData = await poolList.find(p => p.ticker !== null && p.ticker.toUpperCase() === ticker.toUpperCase());
        var poolId = undefined;
        if(poolData !== undefined){
            poolId = poolData.pool_id_bech32
        }
        else if(ticker.toUpperCase() === "MAPLE"){ // handle edge case
            console.log(`🐛 ${ticker}`)
            poolId = "pool1xpfe5q3v3axrjdc8h38taaa93frq3m9pfewxk46x4r6jgy2yj5n"
        }
        else {
            throw `Pool not found with ${ticker} when using https://api.koios.rest/api/v0/pool_list (retry)`;
        }
        // get metadata
        const poolMeta = await  koios.poolMeta(poolId);
        const website = poolMeta[0].meta_json ? poolMeta[0].meta_json.homepage : null;
        const description = poolMeta[0].meta_json ? poolMeta[0].meta_json.description : null;
        const metaUrl = poolMeta[0].meta_url;
        var meta = null;
        try{
            meta = await axios(metaUrl).then(res => {return res.data});
        } catch(e){};
        var extendedMeta = null
        try{
            extendedMeta = await axios(meta.extended).then(res => {return res.data});
        }catch(e){};
        const image = extendedMeta ? extendedMeta.info.url_png_logo : null;

        // get wallet info
        const accountInfo = await koios.accountInfo(bech32StakeAddress);
        const laceAmount = parseInt(accountInfo[0].total_balance);
        const delegation = accountInfo[0].delegated_pool;

        // create pool json
        const pool = {
            poolIdBech32:poolId,
            ticker:ticker,
            website:website ? website : '',
            imageUrl:image ? image : '',
            description:description ? description : '',
            epochs:epochs,
            numEpochs:epochs.length,
            queuePos:index,
            status: 0,
            wallet:{
                stakeAddress: bech32StakeAddress,
                amount: laceAmount,
                delegation: delegation,
            }
        }
        pools.push(pool)
        index += 1
        console.log(`\nFinshed processing import for ${ticker}\n\tEpochs [${epochs}]\n\tLace '${laceAmount}'\n\tDelegated to ${delegation}`)
    }
    redis.set("pools", JSON.stringify(pools))
    return pools;
}

module.exports = {getGooglesheetData};