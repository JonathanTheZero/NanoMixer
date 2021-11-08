//typings by hand bases on the docs, since there are no *.d.ts files
//Docs: https://github.com/BananoCoin/bananojs/blob/master/docs/documentation.md

declare module '@bananocoin/bananojs' {
    export declare function setBananodeApiUrl(url: string): void;

    export declare async function sendAmountToNanoAccount(
        seed: string,
        seedIx: string | number,
        destAccount: string,
        amountRaw: string,
        successCallback: (success: string) => any,
        failureCallback: (failure: Error) => any
    ): Promise<void>

    export declare function getRawStrFromNanoStr(amountRaw: string): string;

    export declare function getPublicKey(privateKey: string);

    export declare function getPrivateKey(seed: string);

    export declare async function getAccountBalanceRaw(publicKey: string): Promise<string>;

    export declare async function getNanoAccountFromSeed(seed: string, seedIx: string | number): Promise<string>;

    export declare async function receiveNanoDepositsForSeed(seed: string, seedIx: string | number, representative: string, specificPendingBlockHash?: string): Promise<object>;

    export declare async function changeNanoRepresentativeForSeed(seed: string, seedIx: string | number, representative: string);
}