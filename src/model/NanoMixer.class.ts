import { changeNanoRepresentativeForSeed, getAccountBalanceRaw, getNanoAccountFromSeed, getRawStrFromNanoStr, receiveNanoDepositsForSeed, sendAmountToNanoAccount, setBananodeApiUrl } from "@bananocoin/bananojs";
import { derivePublicKey, deriveSecretKey, generateSeed } from "nanocurrency";
import fs from "fs";
import { account } from ".";

export default class NanoMixer {
    private sourceWalletAddress!: string;
    private generatedAccounts: Array<account> = [];
    private steps: number = 0;

    /**
     * 
     * @param sourceWalletSeed The SEED of the source wallet
     * @param destinationWalletAddress the PUBLIC ADDRESS of the receiver wallet
     * @param maxSteps: maxmimum amount of transactions in the mixer
     */
    constructor(
        private sourceWalletSeed: string,
        private destinationWalletAddress: string,
        private maxSteps: number
    ) {
        setBananodeApiUrl('https://proxy.powernode.cc/proxy');
    }

    /**
     * Verifying the constructor arguments
     * seperate method because async
     */
    private async verifyInputs(): Promise<void> {
        this.sourceWalletAddress = await getNanoAccountFromSeed(this.sourceWalletSeed, 0);
        if (!this.destinationWalletAddress.startsWith("nano_")) {
            throw new Error("Destination wallet does not start with nano_");
        }
        console.log(this.sourceWalletAddress);
        try {
            await receiveNanoDepositsForSeed(this.sourceWalletSeed, 0, "nano_3arg3asgtigae3xckabaaewkx3bzsh7nwz7jkmjos79ihyaxwphhm6qgjps4");
        } catch (e) {
            console.log(e);
        }
    }

    /**
     * The actual mixing
     */
    public async mix(amount: number, accounts: number) {
        await this.verifyInputs();
        accounts = Math.floor(accounts);

        let amountRaw = BigInt(getRawStrFromNanoStr(amount.toString()));

        if (!amountRaw) {
            throw new Error("Error while parsing balance to BigInt");
        } else if (accounts < 1) {
            throw new Error("There has to be at least 1 account.");
        } else if (BigInt(await getAccountBalanceRaw(this.sourceWalletAddress)) < amountRaw) {
            throw new Error("You can't send more than you have.");
        }

        if (accounts == 1) {
            await this.send(this.sourceWalletSeed, this.destinationWalletAddress, amountRaw)
            return;
        }

        this.generatedAccounts = await this.generateAccounts(accounts);
        let filename = this.log(this.generatedAccounts);
        console.log(`Generated ${accounts} accounts, if the execution stops, their data can be found it ${filename}.\n\n`);

        let i = 0;

        //Something between 60 and 100 steps for initial distrubtion to accounts
        while (i < Math.floor(Math.random() * 4) + 7) {
            let nextReceiver = this.generatedAccounts[Math.floor(Math.random() * this.generatedAccounts.length)],
                am = BigInt(Math.floor(Math.random() * Number(amountRaw)));
            await this.send(this.sourceWalletSeed, nextReceiver.address, am);
            amountRaw -= am;
            i++;
        }
        await this.send(this.sourceWalletSeed, this.generatedAccounts[0].address, amountRaw);
        console.log("Finished initial distribution to addresses");

        const promises = [];
        for (let account of this.generatedAccounts) {
            promises.push(this.mixing(account));
        }

        //receive the last pending transactions
        for (let account of this.generatedAccounts) {
            this.send(
                account.seed,
                this.destinationWalletAddress,
                BigInt(await getAccountBalanceRaw(account.address))
            );
        }
        //Finishing up pending promises
        //await Promise.all(promises);



    }

    private async mixing(account: { seed: string, address: string }): Promise<void> {
        let nextReceiver = this.generatedAccounts[Math.floor(Math.random() * this.generatedAccounts.length)],
            balance = BigInt(await getAccountBalanceRaw(account.address));
        this.steps++;
        //25% chance of directly sending to destination when 25% of max steps have been done or when max steps are reached
        if ((Math.random() > 0.75 && this.steps > this.maxSteps * 0.25) || this.steps > this.maxSteps) {
            await this.send(account.seed, this.destinationWalletAddress, balance);
            return;
        }

        //25% of splitting further up
        if (Math.random() > 0.75) {
            let additionalReceiver = this.generatedAccounts[Math.floor(Math.random() * this.generatedAccounts.length)],
                splitAmount = BigInt(Math.floor(Number(balance) * Math.random()));

            await (this.send(account.seed, nextReceiver.address, splitAmount)
                .then(() => this.mixing(nextReceiver)));
            await (this.send(account.seed, additionalReceiver.address, balance - splitAmount)
                .then(() => this.mixing(additionalReceiver)));
            return;
        } else {
            await this.send(account.seed, nextReceiver.address, balance)
                .then(() => this.mixing(nextReceiver));
            return;
        }
    }

    /**
     * Generate the accounts used for mixing
     * @param accounts the number of accounts
     * @returns the array of account data
     */
    private async generateAccounts(accounts: number): Promise<account[]> {
        const generatedAccounts: Array<account> = [],
            promises: readonly Promise<void>[] = [];
        for (let i = 0; i < accounts; ++i) {
            let seed = await generateSeed(),
                privateKey = deriveSecretKey(seed, 0);
            generatedAccounts.push({
                seed,
                privateKey,
                publicKey: derivePublicKey(privateKey),
                address: await getNanoAccountFromSeed(seed, 0)
            });
            //promises.push(changeNanoRepresentativeForSeed(seed, 0, "nano_3arg3asgtigae3xckabaaewkx3bzsh7nwz7jkmjos79ihyaxwphhm6qgjps4"));
        }
        await Promise.all(promises);
        console.log(generatedAccounts);
        return generatedAccounts;
    }

    /**
     * Log the generated accounts
     * @param generatedAccounts The generated accounts
     * @returns the filename of the JSON log
     */
    private log(generatedAccounts: account[]): string {
        let filename = `accounts_${Date.now()}`;
        fs.writeFileSync(
            `./logs/${filename}.json`,
            JSON.stringify(generatedAccounts, null, 4)
        );
        return filename;
    }

    /**
     * Custom transaction handler
     */
    private async send(seed: string, addr: string, amount: bigint): Promise<void> {
        const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
        await delay(5000);
        try {
            await receiveNanoDepositsForSeed(seed, 0, "nano_3arg3asgtigae3xckabaaewkx3bzsh7nwz7jkmjos79ihyaxwphhm6qgjps4");
        } catch (e) {
            if (e instanceof Error) {
                console.log("[Error while receiving Block]: " + e.message);
            }
        }
        let bal = await getAccountBalanceRaw(await getNanoAccountFromSeed(seed, 0));
        console.log(bal);
        return new Promise((resolve, reject) => {
            try {
                sendAmountToNanoAccount(
                    seed,
                    0,
                    addr,
                    amount.toString(),
                    async hash => {
                        console.log(`Sent from ${await getNanoAccountFromSeed(seed, 0)} to ${addr}: Block: https://nanocrawler.cc/explorer/block/` + hash);
                        resolve();
                    },
                    error => {
                        if (error) {
                            throw error;
                        }
                    }
                );
            } catch (e) {
                console.log("Trying again...");
                delay(10000).then(() => {
                    sendAmountToNanoAccount(
                        seed,
                        0,
                        addr,
                        amount.toString(),
                        async hash => {
                            console.log(`Sent from ${await getNanoAccountFromSeed(seed, 0)} to ${addr}: Block: https://nanocrawler.cc/explorer/block/` + hash);
                            resolve();
                        },
                        error => {
                            if (error) {
                                throw error;
                            }
                        }
                    );
                });
            }
        });
    }
}