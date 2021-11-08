import { deriveSecretKey } from "nanocurrency";
import NanoMixer from "./model/NanoMixer.class";
require("dotenv").config();


const mixer = new NanoMixer(
    process.env.SEED!,
    "nano_38a5ikjshacs4xn55yr1scsopodd4uzpxo9i43scjuodnqzb1h51xuae8ocd",
    10
);

mixer.mix(0.00005, 3);