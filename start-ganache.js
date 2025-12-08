#!/usr/bin/env node

/**
 * Start local Ganache blockchain with deterministic configuration
 * This provides a local Ethereum blockchain for development and testing
 */

const ganache = require('ganache');

const server = ganache.server({
    wallet: {
        // Use deterministic mnemonic for consistent accounts
        mnemonic: 'test test test test test test test test test test test junk',
        totalAccounts: 10,
    },
    chain: {
        chainId: 1337,
        networkId: 1337,
    },
    logging: {
        quiet: false,
    },
});

const PORT = 8545;

server.listen(PORT, async (err) => {
    if (err) {
        console.error('Failed to start Ganache:', err);
        process.exit(1);
    }

    console.log('\n🎉 Ganache blockchain started successfully!\n');
    console.log(`RPC URL: http://127.0.0.1:${PORT}`);
    console.log(`Network ID: 1337`);
    console.log(`Chain ID: 1337\n`);

    const provider = server.provider;
    const accounts = await provider.request({
        method: 'eth_accounts',
        params: [],
    });

    console.log('Available Accounts:');
    accounts.forEach((account, i) => {
        console.log(`(${i}) ${account}`);
    });

    console.log('\n📋 Add these to your .env file:');
    console.log(`RPC_URL=http://127.0.0.1:${PORT}`);
    console.log('PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80\n');

    console.log('⚠️  Note: The private key above is for the first account (Account 0)');
    console.log('⚠️  This is a DEVELOPMENT KEY - never use it for real funds!\n');
});
