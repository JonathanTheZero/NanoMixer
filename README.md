# NanoMixer

This tool is designed to bring more privacy to the Nano chain.
This will **not** make transactions untraceable but will make it significantly harder to do so.

In the following guide, I'll assume at least some kind of familiarity with Node.js and programming.

Also please note, due to network issues it could happen that some accounts are unable to forward all the NANO received.
If some dust gets stuck along the way, you'll find a JSON file including the data of all created accounts in `/dist/logs/accounts_....json`.

## Setup
- As a first step install Node.js (latest download can be found [here](https://nodejs.org/en/), install a Version v17 or higher).
- Now run `npm install` in the command line in the directory, where you've copied the code.
- Create a folder named `dist` in the project directory
- Inside of the `/dist/` folder, you create another folder called `logs` and a file called `.env` with the following content:
  ```env
  SEED="(paste the senders account seed here, beware it needs a seed index of 0)"
  ```
- Now edit the parameters in `src/index.ts` to your liking
- Finally open the command line, navigate to the project folder and run `npm run start`