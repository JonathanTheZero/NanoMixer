import { getAccountBalanceAndPendingRaw } from "@bananocoin/bananojs";
import { deriveSecretKey } from "nanocurrency";
import NanoMixer from "./model/NanoMixer.class";
require("dotenv").config();

//process.on('uncaughtException', (err) => console.log('Caught exception: ' + err.message));

const mixer = new NanoMixer(
    process.env.SEED!,
    "nano_33msdf3jd4ngz7p796g88dxtum3tmdh4fi837bmnzhqs18jfac3r87dsms43",
    100
);


mixer.mix(0.00005, 5);