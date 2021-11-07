import NanoMixer from "./model/NanoMixer.class";
import { deriveAddress, derivePublicKey, deriveSecretKey, generateSeed } from "nanocurrency";
import { getNanoAccountFromSeed } from "@bananocoin/bananojs";

const mixer = new NanoMixer(
);
mixer.mix(0.0001, 3);