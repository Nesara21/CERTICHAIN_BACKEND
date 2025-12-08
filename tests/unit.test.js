const { expect } = require('chai');
const sinon = require('sinon');
const { retryWithBackoff } = require('../lib/retry');
const { generatePdfBuffer } = require('../services/pdf');

describe('Unit Tests', () => {

    describe('retryWithBackoff', () => {
        it('should succeed if the function succeeds', async () => {
            const fn = sinon.stub().resolves('success');
            const result = await retryWithBackoff(fn);
            expect(result).to.equal('success');
            expect(fn.calledOnce).to.be.true;
        });

        it('should retry on failure and eventually succeed', async () => {
            const fn = sinon.stub();
            fn.onFirstCall().rejects(new Error('fail'));
            fn.onSecondCall().resolves('success');

            const result = await retryWithBackoff(fn, 3, 10); // Fast retry
            expect(result).to.equal('success');
            expect(fn.calledTwice).to.be.true;
        });

        it('should fail after max attempts', async () => {
            const fn = sinon.stub().rejects(new Error('fail'));

            try {
                await retryWithBackoff(fn, 3, 10);
                throw new Error('Should have failed');
            } catch (err) {
                expect(err.message).to.equal('fail');
                expect(fn.callCount).to.equal(3);
            }
        });
    });

    describe('generatePdfBuffer', () => {
        it('should return a buffer', async () => {
            const buffer = await generatePdfBuffer('Degree Certificate', { student_name: 'Test' });
            expect(buffer).to.be.instanceOf(Buffer);
        });

        // Note: Strict binary determinism is hard to test without mocking internal PDFKit dates exactly,
        // but we can check if two calls produce same length or similar structure.
        // For this test, we just ensure it runs.
    });
});
