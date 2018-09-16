"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const web3_1 = __importDefault(require("web3"));
const contract_helper_1 = require("../services/contract.helper");
// import moment from 'moment';
// import fs from 'fs';
class NegotiationAgent {
    constructor(owner = "0x00a329c0648769a73afac7f9381e08fb43dbea72", web3 = contract_helper_1.connectToWeb3Provider()) {
        this.owner = owner;
        this.web3 = web3;
        this.gas = 4000000;
        this.gasPrice = 0; // 1000000000
        if (!(web3 instanceof web3_1.default))
            throw Error('could not initialize the Agreement class');
    }
    async authenticate(pass = process.env.ETH_PW || '') {
        try {
            //@ts-ignore
            return this.authenticated = await this.web3.eth.personal.unlockAccount(this.owner, pass);
        }
        catch (error) {
            console.log('Could not authenticate check that your node is running with an active json rpc\n', error);
            return false;
        }
    }
    setOwner(address) {
        this.owner = address;
    }
    setContract(compiledContract, address) {
        const { jsonInterface } = compiledContract;
        if (address && jsonInterface && typeof address === 'string') {
            this.contract = new this.web3.eth.Contract(jsonInterface, address, {
                from: this.owner,
                gas: this.gas,
                gasPrice: this.gasPrice,
            });
        }
        else {
            throw Error('Contract was not properly defined');
        }
    }
    deploy(compiledContract, args) {
        const { jsonInterface, bytecode } = compiledContract;
        const contract = new this.web3.eth.Contract(jsonInterface, '', {
            from: this.owner,
            gasPrice: this.gasPrice,
        });
        return new Promise((resolve, reject) => {
            contract
                .deploy({
                data: bytecode,
                arguments: args,
            })
                .send({
                from: this.owner,
                gas: this.gas,
                gasPrice: this.gasPrice,
            }).on('receipt', (receipt) => {
                receipt['meta'] = {
                    type: 'deploy'
                };
                this.saveTransaction(receipt);
            })
                .then((newContractInstance) => {
                this.contract = newContractInstance;
                resolve(newContractInstance);
            })
                .catch((err) => reject(err));
        });
    }
    async saveTransaction(transaction) {
        // transaction.meta.date = moment().unix();
        // transaction.meta.from = this.owner;
        // fs.appendFileSync('./log.json', JSON.stringify(transaction) + ",");
    }
    async getBalance() {
        //@ts-ignore
        return parseInt(await this.web3.eth.getBalance(this.owner));
    }
    async getContractBalance() {
        if (this.contract && this.contract._address) {
            const balance = await this.web3.eth.getBalance(this.contract._address);
            //@ts-ignore
            return parseInt(balance);
        }
        else
            throw Error("Cloud not get contract balance");
    }
    async offer(ipfs_reference, deposit, duration) {
        const transaction = await this.contract.methods.offer(ipfs_reference, deposit, duration).send({ from: this.owner }).on('error', err => console.log);
        transaction.meta = {
            type: "offer",
            ipfs_reference,
            deposit,
            duration
        };
        this.saveTransaction(transaction);
        return transaction;
    }
    async counterOfferState(responseTo, ipfs_reference, state) {
        const resolvedState = typeof state === 'string' ? this.retrieveState(state) : state;
        const transaction = await this.contract.methods.counterOffer(responseTo, ipfs_reference, resolvedState).send({ from: this.owner }).on('error', err => console.log);
        transaction.meta = {
            type: "counterOfferState",
            ipfs_reference,
            responseTo,
            state
        };
        this.saveTransaction(transaction);
        return transaction;
    }
    async counterOffer(responseTo, ipfs_reference, deposit, duration, state) {
        const resolvedState = typeof state === 'string' ? this.retrieveState(state) : state;
        const transaction = await this.contract.methods.counterOffer(responseTo, ipfs_reference, deposit, duration, resolvedState).send({ from: this.owner }).on('error', err => console.log);
        transaction.meta = {
            type: "counterOffer",
            ipfs_reference,
            responseTo,
            state,
            deposit,
            duration
        };
        this.saveTransaction(transaction);
        return transaction;
    }
    async negotiationEnd() {
        const _negotiationEnd = this.contract.methods.negotiationEnd().call({ from: this.owner });
        const negotiationEnd = parseInt(_negotiationEnd);
        return negotiationEnd;
    }
    async getOffer(index) {
        const offer = await this.contract.methods.offers(index).call({ from: this.owner });
        return this.mapOffer(offer);
    }
    async createAgreement(responseTo, ipfs_reference) {
        const transaction = await this.contract.methods.createAgreement(responseTo, ipfs_reference).send({ from: this.owner }).on('error', err => console.log);
        transaction.meta = {
            type: "createAgreement",
            responseTo,
            ipfs_reference
        };
        this.saveTransaction(transaction);
        return transaction;
    }
    async withdraw(index) {
        const transaction = await this.contract.methods.withdraw(index).send({ from: this.owner }).on('error', err => console.log('error withdrawing: ', err));
        transaction.meta = {
            type: 'withdraw',
            index
        };
        this.saveTransaction(transaction);
        return transaction;
    }
    async dispute(index) {
        const transaction = await this.contract.methods.dispute(index).send({ from: this.owner }).on('error', err => console.log('error: ', err));
        // this.saveTransaction(transaction);
        return transaction;
    }
    async deposit(index, value) {
        const transaction = await this.contract.methods.deposit(index).send({ from: this.owner, value }).on('error', err => console.log);
        transaction.meta = {
            type: 'deposit',
            index,
            value
        };
        this.saveTransaction(transaction);
        return transaction;
    }
    async flag(index, flag) {
        const transaction = await this.contract.methods.setFlag(index, flag).send({ from: this.owner }).on('error', err => console.log);
        return transaction;
    }
    mapOffer(offer) {
        return {
            id: parseInt(offer.id),
            creator: offer.creator.toLowerCase(),
            ipfs_reference: offer.ipfs_reference,
            deposit: parseInt(offer.deposit),
            duration: parseInt(offer.duration),
            state: this.getState(parseInt(offer.state)),
            flag: this.getFlag(parseInt(offer.flag))
        };
    }
    getState(state) {
        switch (state) {
            case 0:
                return "Advisory";
            case 1:
                return "Solicited";
            case 2:
                return "Acceptable";
            case 3:
                return "Rejected";
            case 4:
                return "Accept_Acknowledge";
            case 5:
                return "Binding";
            case 6:
                return "Deposited";
            case 7:
                return "Disputed";
            case 8:
                return "Withdrawn";
            default:
                return "Unknown";
        }
    }
    retrieveState(state) {
        switch (state) {
            case "Advisory":
                return 0;
            case "Solicited":
                return 1;
            case "Acceptable":
                return 2;
            case "Rejected":
                return 3;
            case "Accept_Acknowledge":
                return 4;
            case "Binding":
                return 5;
            case "Deposited":
                return 6;
            case "Withdrawn":
                return 7;
            default:
                return "Unknown";
        }
    }
    getFlag(flag) {
        switch (flag) {
            case 0:
                return "white";
            case 1:
                return "yellow";
            case 2:
                return "red";
            default:
                return "unknown flag";
        }
    }
    retrieveFlag(flag) {
        switch (flag) {
            case "white":
                return 0;
            case "yellow":
                return 1;
            case "red":
                return 2;
        }
    }
}
exports.default = NegotiationAgent;
//# sourceMappingURL=negotiation.agent.js.map