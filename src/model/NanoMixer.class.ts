import { getAccountBalanceRaw, getNanoAccountFromSeed, getRawStrFromNanoStr, sendAmountToNanoAccount, setBananodeApiUrl } from "@bananocoin/bananojs";
import { generateSeed } from "nanocurrency";
import fs from "fs";

export default class NanoMixer {
    private sourceWalletAddress!: string;
    private generatedAccounts: Array<{ seed: string, address: string }> = [];
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
    }

    /**
     * The actual mixing
     */
    public async mix(amount: number, accounts: number) {
        await this.verifyInputs();
        accounts = Math.floor(accounts);

        if (accounts < 1) {
            throw new Error("There has to be at least 1 account.");
        } else if (Number(await getAccountBalanceRaw(this.sourceWalletAddress)) / 1e30 < amount) {
            throw new Error("You can't send more than you have.");
        }

        if (accounts == 1) {
            await this.send(this.sourceWalletSeed, this.destinationWalletAddress, amount)
            return;
        }

        this.generatedAccounts = await this.generateAccounts(accounts);
        let filename = this.log(this.generatedAccounts);
        console.log(`Generated ${accounts} accounts, if the execution stops, their data can be found it ${filename}`);

        let i = 0,
            amountRaw = BigInt(getRawStrFromNanoStr(amount.toString()));
        if (!amountRaw) throw new Error();

        //Something between 60 and 100 steps for initial distrubtion to accounts
        while (i < Math.floor(Math.random() * 40) + 70) {
            let nextReceiver = this.generatedAccounts[Math.floor(Math.random() * this.generatedAccounts.length)],
                am = Math.floor(Math.random() * amountRaw);
            await this.send(this.sourceWalletSeed, nextReceiver.address, am / 1e30);
            amountRaw -= am;
            i++;
        }

        for (let account of this.generatedAccounts) {
            this.mixing(account);
        }
    }

    private async mixing(account: { seed: string, address: string }): Promise<void> {
        let nextReceiver = this.generatedAccounts[Math.floor(Math.random() * this.generatedAccounts.length)],
            balance = Number(await getAccountBalanceRaw(account.address));
        this.steps++;
        //25% chance of directly sending to destination or when max steps are reached
        if (Math.random() > 0.75 || this.steps > this.maxSteps) {
            this.send(account.seed, this.destinationWalletAddress, balance / 1e30);
            return;
        }

        //25% of splitting further up
        if (Math.random() > 0.75) {
            let additionalReceiver = this.generatedAccounts[Math.floor(Math.random() * this.generatedAccounts.length)],
                splitAmount = Math.floor(balance * Math.random());

            this.send(account.seed, nextReceiver.address, splitAmount / 1e30)
                .then(() => this.mixing(nextReceiver));
            this.send(account.seed, additionalReceiver.address, (balance - splitAmount) / 1e30)
                .then(() => this.mixing(additionalReceiver));
            return;
        } else {
            await this.send(account.seed, nextReceiver.address, balance);
            return this.mixing(nextReceiver);
        }
    }

    /**
     * Generate the accounts used for mixing
     * @param accounts the number of accounts
     * @returns the array of account data
     */
    private async generateAccounts(accounts: number): Promise<{ seed: string; address: string; }[]> {
        const generatedAccounts: Array<{ seed: string, address: string }> = [];
        for (let i = 0; i < accounts; ++i) {
            let seed = await generateSeed();
            generatedAccounts.push({
                seed,
                address: await getNanoAccountFromSeed(seed, 0)
            });
        }
        console.log(generatedAccounts);
        return generatedAccounts;
    }

    /**
     * Log the generated accounts
     * @param generatedAccounts The generated accounts
     * @returns the filename of the JSON log
     */
    private log(generatedAccounts: { seed: string; address: string; }[]): string {
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
    private async send(seed: string, addr: string, amount: number | string): Promise<void> {
        return await sendAmountToNanoAccount(
            seed,
            0,
            addr,
            getRawStrFromNanoStr(amount.toString()),
            hash => {
                console.log(`Sent from ${this.sourceWalletAddress} to ${this.destinationWalletAddress}: Block: https://nanocrawler.cc/explorer/block/` + hash);
            },
            error => {
                if (error) {
                    throw error;
                }
            }
        );
    }
}