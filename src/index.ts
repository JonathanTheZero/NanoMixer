import NanoMixer from "./model/NanoMixer.class";
require("dotenv").config();

//process.on('uncaughtException', (err) => console.log('Caught exception: ' + err.message));

/**
 * Edit these values
 */
const DESTINATION_ADDRESS = "nano_3hhf1ia96k6jyzthpsd8ozr676rwm6a9c931jg8yur99sk3padkqk7i934t3";
const MAX_STEPS = 200; //maximum amount of transactions the total process will take
const AMOUNT_TO_SEND = 0.0001; //NANO amount to send
const ACCOUNTS_TO_ROUTE_THROUGH = 20; //Amount of accounts that will be created to route the transactions through
/**
 * 
 */

const mixer = new NanoMixer(
    process.env.SEED!,
    DESTINATION_ADDRESS,
    MAX_STEPS
);

mixer.mix(AMOUNT_TO_SEND, ACCOUNTS_TO_ROUTE_THROUGH);