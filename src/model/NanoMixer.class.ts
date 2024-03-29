import {
    changeNanoRepresentativeForSeed,
    getAccountBalanceAndPendingRaw,
    getAccountBalanceRaw,
    getNanoAccountFromSeed,
    getRawStrFromNanoStr,
    openNanoAccountFromSeed,
    receiveNanoDepositsForSeed,
    sendAmountToNanoAccount,
    setBananodeApiUrl
} from "@bananocoin/bananojs";
import { derivePublicKey, deriveSecretKey, generateSeed } from "nanocurrency";
import fs from "fs";
import { account } from ".";



const sleep = (waitTimeInMs: number) => new Promise(resolve => setTimeout(resolve, waitTimeInMs));
export default class NanoMixer {
    private sourceWalletAddress!: string;
    private generatedAccounts: Array<account> = [];
    private steps: number = 0;
    public representative: string = "nano_3arg3asgtigae3xckabaaewkx3bzsh7nwz7jkmjos79ihyaxwphhm6qgjps4";

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
        setBananodeApiUrl('https://app.natrium.io/api');
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
            await receiveNanoDepositsForSeed(this.sourceWalletSeed, 0, this.representative);
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

        let amountRaw = BigInt(getRawStrFromNanoStr(amount.toString()) || 0);

        if (!amountRaw) {
            throw new Error("Error while parsing balance to BigInt");
        } else if (accounts < 1) {
            throw new Error("There has to be at least 1 account.");
        } else if (this.convertPendingBalance(await getAccountBalanceAndPendingRaw(this.sourceWalletAddress) || 0) < amountRaw) {
            throw new Error("You can't send more than you have.");
        }

        if (accounts == 1) {
            await this.send(this.sourceWalletSeed, this.destinationWalletAddress, amountRaw)
            return;
        }

        this.generatedAccounts = await this.generateAccounts(accounts);
        let filename = this.log(this.generatedAccounts);
        console.log("==================================");
        console.log(`Generated ${accounts} accounts, if the execution stops, their data can be found it ${filename}.`);
        console.log("==================================\n\n");

        let i = 0;

        //Something between 10 and 25% of max steps
        while (i < Math.floor(Math.random() * (this.maxSteps * .1)) + (this.maxSteps * .15)) {
            let nextReceiver = this.generatedAccounts[Math.floor(Math.random() * this.generatedAccounts.length)],
                possibleSources = [
                    this.sourceWalletSeed,
                    ...this.generatedAccounts.filter(e => e.isOpenend).map(e => e.seed)
                ],
                am;

            let source = possibleSources[Math.floor(Math.random() * possibleSources.length)];
            if (source === this.sourceWalletSeed) {
                am = BigInt(Math.floor(Math.random() * Number(amountRaw / 2n)));
                amountRaw -= am;
            } else {
                am = BigInt(await getAccountBalanceRaw(await getNanoAccountFromSeed(source, 0)) || 0);
            }
            this.steps++;
            await this.send(source, nextReceiver.address, am);
            i++;
        }
        await this.send(this.sourceWalletSeed, this.generatedAccounts[0].address, amountRaw);
        /*for (let address of this.generatedAccounts) {
            await this.send(this.sourceWalletSeed, address.address, amountRaw / BigInt(accounts));
        }*/
        console.log("==================================");
        console.log("Finished initial distribution to addresses");
        console.log("Starting to mix...");
        console.log("==================================");
        for (let account of this.generatedAccounts) {
            await this._mixing(account);
            //Dunno why, sometiems code do be like that
            await receiveNanoDepositsForSeed(account.seed, 0, this.representative);
            await receiveNanoDepositsForSeed(account.seed, 0, this.representative);
            await receiveNanoDepositsForSeed(account.seed, 0, this.representative);
        }
        await sleep(15000);
        console.log("==================================");
        console.log("Finished mixing");
        console.log("Transferring remaining funds");
        console.log("==================================");
        console.log(this.generatedAccounts.length)
        while (this.generatedAccounts.length) {
            for (let account of this.generatedAccounts) {
                //console.log(await receiveNanoDepositsForSeed(account.seed, 0, this.representative), this.convertPendingBalance(await getAccountBalanceAndPendingRaw(account.address) || 0), BigInt(await getAccountBalanceRaw(account.address) || 0));
                //console.log("Second time:");
                //console.log(await receiveNanoDepositsForSeed(account.seed, 0, this.representative), this.convertPendingBalance(await getAccountBalanceAndPendingRaw(account.address) || 0), BigInt(await getAccountBalanceRaw(account.address) || 0));
                await receiveNanoDepositsForSeed(account.seed, 0, this.representative);
                await receiveNanoDepositsForSeed(account.seed, 0, this.representative);
                let bal = this.convertPendingBalance(await getAccountBalanceAndPendingRaw(account.address) || 0);
                await sleep(5000);
                if (await this.send(
                    account.seed,
                    this.destinationWalletAddress,
                    bal
                ) !== false || bal === 0n) {
                    this.generatedAccounts.splice(this.generatedAccounts.indexOf(account), 1);
                }
            }
        }
        //Finishing up pending promises
        //await Promise.all(promises);
        console.log("==================================");
        console.log(`Finished with ${this.steps} steps, please check the destination wallet`);
        console.log("==================================");
    }

    //Legacy implementation
    /*private async mixing(account: { seed: string, address: string }): Promise<void> {
        let nextReceiver = this.generatedAccounts[Math.floor(Math.random() * this.generatedAccounts.length)],
            balance = this.convertPendingBalance(await getAccountBalanceAndPendingRaw(account.address) || 0);
        this.steps++;
        if (balance === 0n) {
            return;
        }
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
                .then(() => {
                    if (splitAmount)
                        return this.mixing(nextReceiver)
                }));
            await (this.send(account.seed, additionalReceiver.address, balance - splitAmount)
                .then(() => {
                    if (balance - splitAmount)
                        return this.mixing(additionalReceiver)
                }));
            return;
        } else {
            await this.send(account.seed, nextReceiver.address, balance)
                .then(() => this.mixing(nextReceiver));
            return;
        }
    }*/

    private async _mixing(account: account): Promise<void> /*Recursion time babey*/ {
        this.steps++;
        let nextReceiver = this.generatedAccounts[Math.floor(Math.random() * this.generatedAccounts.length)],
            balance = this.convertPendingBalance(await getAccountBalanceAndPendingRaw(account.address) || 0);

        if ((Math.random() >= 0.8 && this.steps > this.maxSteps * 0.25) || this.steps >= this.maxSteps) {
            await this.send(account.seed, this.destinationWalletAddress, balance);
            return;
        }

        await receiveNanoDepositsForSeed(account.seed, 0, this.representative);
        await receiveNanoDepositsForSeed(account.seed, 0, this.representative);


        /*if (Math.random() <= 0.25) {
            let additionalReceiver = this.generatedAccounts[Math.floor(Math.random() * this.generatedAccounts.length)];

            await this.send(account.seed, nextReceiver.address, balance / 2n);
            await this.send(account.seed, additionalReceiver.address, balance / 2n);

            //@ts-ignore
            return [this._mixing(nextReceiver), this._mixing(additionalReceiver)];
        } else {*/
        await this.send(account.seed, nextReceiver.address, BigInt(Math.floor(Number(balance) * Math.random())));
        return await this._mixing(nextReceiver);
        //}
    }

    /**
     * Generate the accounts used for mixing
     * @param accounts the number of accounts
     * @returns the array of account data
     */
    private async generateAccounts(accounts: number): Promise<account[]> {
        const generatedAccounts: Array<account> = [],
            promises: Promise<void>[] = [];
        for (let i = 0; i < accounts; ++i) {
            let seed = await generateSeed(),
                privateKey = deriveSecretKey(seed, 0);
            generatedAccounts.push({
                seed,
                privateKey,
                publicKey: derivePublicKey(privateKey),
                address: await getNanoAccountFromSeed(seed, 0),
                isOpenend: false
            });
            //promises.push(changeNanoRepresentativeForSeed(seed, 0, this.representative));
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

    private convertPendingBalance(obj: { pending: string, balance: string }): bigint {
        return BigInt(obj.pending || 0) + BigInt(obj.balance || 0);
    }

    /**
     * Custom transaction handler
     */
    private async send(seed: string, addr: string, amount: bigint): Promise<boolean | boolean> {
        const receiverAccount = this.generatedAccounts.filter(e => e.address == addr)[0];
        if (amount === 0n) {
            return false;
        }

        try {
            await receiveNanoDepositsForSeed(seed, 0, this.representative);
        } catch (e) {
            if (e instanceof Error) {
                console.log("[Error while receiving Block]: " + e.message);
            }
        }
        let bal = this.convertPendingBalance(await getAccountBalanceAndPendingRaw(await getNanoAccountFromSeed(seed, 0))),
            actualBalance = BigInt(await getAccountBalanceRaw(await getNanoAccountFromSeed(seed, 0)) || 0);
        console.log("Balance of ", await getNanoAccountFromSeed(seed, 0), ":", bal, actualBalance);
        if (actualBalance === 0n || amount > actualBalance) {
            return false;
        }
        await receiveNanoDepositsForSeed(seed, 0, this.representative);
        await sleep(1000);
        return new Promise<boolean>((resolve, reject) => {
            sendAmountToNanoAccount(
                seed,
                0,
                addr,
                amount.toString(),
                async hash => {
                    console.log(`Sent from ${await getNanoAccountFromSeed(seed, 0)} to ${addr}\nBlock: https://nanocrawler.cc/explorer/block/` + hash);
                    //Open the account if it hasn't been opened before
                    if (receiverAccount && !receiverAccount.isOpenend) {
                        await sleep(2000);
                        await openNanoAccountFromSeed(receiverAccount.seed, 0, this.representative, hash, amount.toString());
                        await changeNanoRepresentativeForSeed(receiverAccount.seed, 0, this.representative);
                        receiverAccount.isOpenend = true;
                        console.log("Opened account", receiverAccount.address);
                    }
                    resolve(true);
                },
                error => {
                    if (error) {
                        throw error;
                    }
                }
            );
        });
    }
}