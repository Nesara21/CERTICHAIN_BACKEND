const { ethers } = require('ethers');
const { logger } = require('./logger');
const { retryWithBackoff } = require('./retry');

class BlockchainQueue {
    constructor() {
        this.queue = [];
        this.processing = false;
        this.provider = null;
        this.wallet = null;
    }

    init(rpcUrl, privateKey) {
        if (!rpcUrl || !privateKey) {
            logger.warn('Blockchain not initialized: Missing RPC_URL or PRIVATE_KEY');
            return;
        }
        this.provider = new ethers.JsonRpcProvider(rpcUrl);
        this.wallet = new ethers.Wallet(privateKey, this.provider);
        logger.info('Blockchain queue initialized');
    }

    /**
     * Adds a transaction task to the queue.
     * @param {Function} task - Function that returns a transaction request object.
     * @returns {Promise<any>} - The transaction receipt.
     */
    add(task) {
        return new Promise((resolve, reject) => {
            this.queue.push({ task, resolve, reject });
            this.process();
        });
    }

    async process() {
        if (this.processing || this.queue.length === 0) return;

        this.processing = true;
        const { task, resolve, reject } = this.queue.shift();

        try {
            const receipt = await retryWithBackoff(async () => {
                if (!this.wallet) throw new Error('Blockchain wallet not initialized');

                // Get latest nonce
                const nonce = await this.wallet.getNonce();

                // Execute task to get tx data
                const txRequest = await task();

                // Send transaction
                const tx = await this.wallet.sendTransaction({
                    ...txRequest,
                    nonce: nonce
                });

                logger.info(`Transaction sent: ${tx.hash}`);

                // Wait for confirmations
                const receipt = await tx.wait(2); // Wait for 2 confirmations
                return receipt;
            }, 3, 2000); // 3 attempts, 2s base delay

            resolve(receipt);
        } catch (error) {
            logger.error(`Blockchain transaction failed: ${error.message}`);
            reject(error);
        } finally {
            this.processing = false;
            this.process(); // Process next item
        }
    }
}

const blockchainQueue = new BlockchainQueue();
module.exports = { blockchainQueue };
