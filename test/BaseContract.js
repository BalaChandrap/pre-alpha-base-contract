'use strict';

import {fromAscii} from './helpers/Bytes32Helper';
import EVMThrow from './helpers/EVMThrow';

var fs = require('fs');
var crypto = require("crypto");

const BaseContract = artifacts.require('BaseContract');
const Questionnaire = artifacts.require('Questionnaire');
const Offer = artifacts.require('OfferContract');
const Search = artifacts.require('Search');
const SearchContract = artifacts.require('SearchContract');
const Client = artifacts.require('Client');
const PreCATToken = artifacts.require('PreCATToken');
const HolderAdCoins = artifacts.require('HolderAdCoins');

const BigNumber = web3.BigNumber;
const should = require('chai')
    .use(require('chai-as-promised'))
    .use(require('chai-bignumber')(web3.BigNumber))
    .should();

const { Environment } = require('storj');

const preCatTokenDecimals = new BigNumber(3);
const preCatTokenIncrease = new BigNumber(10).pow(preCatTokenDecimals);

contract('BaseContract', function ([_, advertiserWallet, clientWallet]) {

    const groupName = 'cleaning';
    const steps = ['numbers of rooms?', 'How many times a week?', 'What time?'];
    const stepIsCheckbox = [false, false, true];
    const variants = [
        ['one room', 'two room', 'three and more rooms'],
        ['once', 'every monday', 'only on weekends'],
        ['morning at 8 - 10 am', 'at noon', 'evening'],
    ];

    const rulesKeys = [
        fromAscii('salary', 32),
        fromAscii('age', 32),
        fromAscii('country', 32)];

    const offerUserDataValues = [
        fromAscii('5000', 32),
        fromAscii('18', 32),
        fromAscii('russia', 32)];

    const offerMinReward = new BigNumber(100).mul(preCatTokenIncrease);
    const offerMaxReward = new BigNumber(2000).mul(preCatTokenIncrease);

    const rulesActions = [3, 3, 1]; //0 - '=='; 1 - '!='; 2 - '<='; 3 - '>='; 4 - '>'; 5 - '<'.
    const rulesRewardPercents = [60, 20, 20]; //total of items can be 100;

    const offerUrl = 'http://www.toyota-global.com/';
    const offerDesc = 'this is crossover of toyota motors. Best of the best!? =)';
    var offerBucketId = 'f86cd799439011507f1f77bc';
    var offerFileId = '507f1f77bcf86cd799439011';

    const offerBalance = new BigNumber(10000).mul(preCatTokenIncrease);
    var storj;

    before(async function() {
        storj = new Environment({
            bridgeUrl: 'https://api.storj.io',
            bridgeUser: 'anton@bitclave.com',
            bridgePass: '3Z8-baQ-PHC-7rw', // 3f0421c7e383100f1b7c13bfe694b649811d967cccdcd1d1723aee535345527c
            encryptionKey: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
            //publicKey: '0370c3d549102a548d39e75759781eed1b79a182dbc610f03b4c23d736955fde8c',
            //privateKey: '1738ff4b31f2631847dc9b67d7337a647b8134ddf8b3aeeba9ed2892a0408267',
            logLevel: 0
        });

        //
        // Curl with email, sha256 of password and public key
        // $ curl -u anton@bitclave.com:3f0421c7e383100f1b7c13bfe694b649811d967cccdcd1d1723aee535345527c -X POST --header 'Content-Type: application/json' --header 'Accept: application/json' -d '{"key":"0370c3d549102a548d39e75759781eed1b79a182dbc610f03b4c23d736955fde8c"}' 'https://api.storj.io/keys'
        // {"user":"anton@bitclave.com","label":"","key":"0370c3d549102a548d39e75759781eed1b79a182dbc610f03b4c23d736955fde8c","id":"0370c3d549102a548d39e75759781eed1b79a182dbc610f03b4c23d736955fde8c"}
        //
    });

    after(async function() {
        storj.destroy();
    });

    const storj_getBuckets = async function(storj) {
        var buckets;
        const promise = new Promise(resolve => storj.getBuckets(function(err, result) {
            buckets = result;
            resolve();
        }));
        await promise;
        return buckets;
    }

    const storj_upload = async function(storj, bucketId, uploadFilePath, fileName) {
        var result;
        const promise = new Promise(resolve => storj.storeFile(bucketId, uploadFilePath, {
            filename: fileName,
            progressCallback: function(progress, uploadedBytes, totalBytes) {
                //console.log('Progress: %d, uploadedBytes: %d, totalBytes: %d',
                //            progress, uploadedBytes, totalBytes);
            },
            finishedCallback: function(err, fileId) {
                if (err) {
                    return console.error(err);
                }
                console.log('File upload complete:', fileId);
                result = fileId;
                resolve();
            }
        }));

        await promise;
        return result;
    };

    const storj_download = async function(storj, bucketId, fileId, downloadFilePath) {
        var result = false;
        const promise = new Promise(resolve => storj.resolveFile(bucketId, fileId, downloadFilePath, {
            progressCallback: function(progress, downloadedBytes, totalBytes) {
                //console.log('Progress: %d, downloadedBytes: %d, totalBytes: %d',
                //            progress, downloadedBytes, totalBytes);
            },
            finishedCallback: function(err) {
                if (err) {
                    return console.error(err);
                }
                console.log('File download complete');
                result = true;
                resolve();
            }
        }));

        await promise;
        return result;
    };

    it('storj', async function() {

        const buckets = await storj_getBuckets(storj);
        offerBucketId = buckets[0].id;
        console.log('buckets:', buckets);

        offerFileId = await storj_upload(storj, offerBucketId, 'test/resources/1.png', 'test-ad-' + Math.random() + '.png');
        const finished = await storj_download(storj, offerBucketId, offerFileId, 'test/resources/1-out'+offerFileId+'.png');
        finished.should.eql(true);

        var buf1 = fs.readFileSync('test/resources/1.png');
        var buf2 = fs.readFileSync('test/resources/1-out'+offerFileId+'.png');

        const buf1Hash = crypto.createHash('sha256').update(buf1).digest();
        const buf2Hash = crypto.createHash('sha256').update(buf2).digest();
        buf1Hash.should.eql(buf2Hash);

        // const promise = new Promise(resolve => storj.getInfo(function(err, result) {
        //     if (err) {
        //         resolve();
        //         return console.error(err);
        //     }
        //     console.log('info:', result);

        //     storj.getBuckets(function(err, result) {
        //         if (err) {
        //             resolve();
        //             return console.error(err);
        //         }
        //         console.log('buckets:', result);
        //         //storj.destroy();
        //         resolve();
        //     });
        // }));

        //await promise;
    });

    it('init', async function () {
        this.baseContract = await BaseContract.new();

        this.tokensContract = await PreCATToken.new();
        await this.baseContract.setTokensContract(this.tokensContract.address);

        this.searchContract = await SearchContract.new(this.baseContract.address);
        await this.baseContract.setSearchContract(this.searchContract.address);
    });

    it('add client data keys', async function () {
        await this.searchContract.addClientDataKeys(rulesKeys);
        let keys = await this.searchContract.getClientDataKeys();
        keys.length.should.be.equal(rulesKeys.length);

        await this.searchContract.addClientDataKeys(rulesKeys);
        keys = await this.searchContract.getClientDataKeys();
        keys.length.should.be.equal(rulesKeys.length);
    });

    it('create questionnaire and add to the BaseContract', async function () {
        const questionnaire = await Questionnaire.new();
        await questionnaire.setGroupName(fromAscii(groupName, 32));

        for (let i = 0; i < steps.length; i++) {
            await questionnaire.addNewStep(steps[i], stepIsCheckbox[i]);
        }
        const variantsBytes32 = [];
        for (let i = 0; i < variants.length; i++) {
            variantsBytes32.length = 0;
            for (let j = 0; j < variants[i].length; j++) {
                variantsBytes32.push(fromAscii(variants[i][j], 32));
            }
            await questionnaire.addVariants(i, variantsBytes32);
        }

        await this.baseContract.addQuestionnaire(questionnaire.address);

        const listOfQuestionnaire = await this.baseContract.getQuestionnaires();

        assert.equal(listOfQuestionnaire.length, 1, 'incorrect count of questionnaire');
        listOfQuestionnaire[0].should.be.equal(questionnaire.address);
    });

    it('create new offer', async function () {
        const listOfQuestionnaire = await this.baseContract.getQuestionnaires();
        assert.equal(listOfQuestionnaire.length, 1, 'incorrect count of questionnaire');

        const questionnaireAddress = Questionnaire.at(listOfQuestionnaire[0]).address;

        await this.baseContract.createOffer(questionnaireAddress, {from: advertiserWallet});
        const offers = await this.baseContract.getAdvertiserOffers({from: advertiserWallet});

        offers.length.should.be.equal(1);

        const offer = Offer.at(offers[0]);

        const offerQuestionnaire = await offer.questionnaireAddress();
        offerQuestionnaire.should.be.equal(questionnaireAddress);
    });

    it('setup offer with questionnaire steps', async function () {
        const offers = await this.baseContract.getAdvertiserOffers({from: advertiserWallet});
        const offer = Offer.at(offers[0]);
        //step 1 - 14. where it's any selected variant (any of three) == (1 << 1) + (1 << 2) + (1 << 3 )
        // step 2 - 4 . second selected variant. (1 << 2);
        //step 3 - 12. two selected variant's. (one and three) (1 << 2) + (1 << 3);
        const steps = [14, 4, 12];
        await offer.setQuestionnaireSteps(steps);
        const stepsFromOffer = await offer.getQuestionnaireSteps();

        assert.deepEqualNumber(stepsFromOffer, steps);
    });

    it('other wallet no have offers', async function () {
        const offers = await this.baseContract.getAdvertiserOffers({from: clientWallet});
        offers.length.should.be.equal(0)
    });

    it('update offer', async function () {
        const offers = await this.baseContract.getAdvertiserOffers({from: advertiserWallet});
        const offer = Offer.at(offers[0]);

        await offer.setOfferInfo(
            offerUrl,
            offerDesc,
            offerBucketId,
            offerFileId,
            {from: advertiserWallet});

        const clientDataKeys = await this.searchContract.getClientDataKeys();

        await offer.setRules(
            offerMinReward,
            offerMaxReward,
            clientDataKeys,
            offerUserDataValues,
            rulesActions,
            rulesRewardPercents,
            {from: advertiserWallet}
        );

        const updatedOffer = await offer.getOffer();
        updatedOffer.length.should.be.equal(5);
        updatedOffer[1].should.be.equal(offerUrl);
        updatedOffer[2].should.be.equal(offerDesc);
        updatedOffer[3].should.be.equal(offerBucketId);
        updatedOffer[4].should.be.equal(offerFileId);

        const updatedRules = await offer.getRules();
        updatedRules.length.should.be.equal(6);
        updatedRules[0].should.bignumber.equal(offerMinReward);
        updatedRules[1].should.bignumber.equal(offerMaxReward);
        updatedRules[2].length.should.be.equal(updatedRules[3].length);
        updatedRules[3].length.should.be.equal(updatedRules[4].length);
        updatedRules[4].length.should.be.equal(updatedRules[5].length);

        assert.deepEqual(updatedRules[2], rulesKeys, 'incorrect array of Keys');
        assert.deepEqual(updatedRules[3], offerUserDataValues, 'incorrect array of Values');

        assert.deepEqualNumber(updatedRules[4], rulesActions);
        assert.deepEqualNumber(updatedRules[5], rulesRewardPercents);
    });

    // In this test we verify that we can create OFFER that holds reference to PNG image that is stored in StorJ
    // The following are the verification steps
    // 1. We upload PNG image to Storj
    // 2. We create OFFER and update its properties to point to PNG in Storj
    // 3. We store OFFER in blockchain
    // 4. We retrieve OFFER from blockchain
    // 5. We read OFFER properties and get the IDs of PNG image in Storg
    // 6. We read PNG file
    // 7. We compare that PNG file is identical to the original file 
    it('update offer with StorJ', async function () {

        // get Storj buckets and select 1st bucket for OFFER upadte
        const buckets = await storj_getBuckets(storj);
        offerBucketId = buckets[0].id;
        console.log('buckets:', buckets);

        // upload PNG image to StorJ
        offerFileId = await storj_upload(storj, offerBucketId, 'test/resources/1.png', 'test-ad-' + Math.random() + '.png');

        const offers = await this.baseContract.getAdvertiserOffers({from: advertiserWallet});
        const offer = Offer.at(offers[0]);

        // set StorJ bucket and Storj FileId in OFFER
        await offer.setOfferInfo(
            offerUrl,
            offerDesc,
            offerBucketId,
            offerFileId,
            {from: advertiserWallet});

        // verify OFFER set operation
        const updatedOffer = await offer.getOffer();
        updatedOffer.length.should.be.equal(5);
        updatedOffer[1].should.be.equal(offerUrl);
        updatedOffer[2].should.be.equal(offerDesc);
        updatedOffer[3].should.be.equal(offerBucketId);
        updatedOffer[4].should.be.equal(offerFileId);

    
        // read PNG image from StorJ
        const finished = await storj_download(storj, offerBucketId, offerFileId, 'test/resources/1-out'+offerFileId+'.png');
        finished.should.eql(true);

        // verify the PNG image is identical before and after storing in StorJ
        var buf1 = fs.readFileSync('test/resources/1.png');
        var buf2 = fs.readFileSync('test/resources/1-out'+offerFileId+'.png');

        // compute hash 
        const buf1Hash = crypto.createHash('sha256').update(buf1).digest();
        const buf2Hash = crypto.createHash('sha256').update(buf2).digest();
        buf1Hash.should.eql(buf2Hash);
    
 
    });

    it('create client and setup his data', async function () {
        await this.baseContract.createClient({from: clientWallet});
        await this.baseContract.createClient({from: clientWallet}).should
            .be
            .rejectedWith(EVMThrow);

        const clientAddress = await this.baseContract.getClient(clientWallet);

        const clientContract = Client.at(clientAddress);

        const clientDataKeys = await this.searchContract.getClientDataKeys();
        offerUserDataValues.length.should.be.equal(clientDataKeys.length);

        await clientContract.setData(clientDataKeys, offerUserDataValues, {from: clientWallet});

        const values = await clientContract.getData(clientDataKeys);

        assert.deepEqual(values, offerUserDataValues, 'incorrect array of Values');
    });

    it('search with negative balance on offer holder of coins', async function () {
        const searchData = [4, 4, 8];
        const listOfQuestionnaire = await this.baseContract.getQuestionnaires();
        const questionnaireAddress = Questionnaire.at(listOfQuestionnaire[0]).address;

        await this.searchContract.searchOffers(questionnaireAddress, searchData, {from: clientWallet});
        const result = await this.searchContract.getLatestSearchResult({from: clientWallet});
        result.length.should.be.equal(0);
    });

    it('pay for offer balance', async function () {
        const offers = await this.baseContract.getAdvertiserOffers({from: advertiserWallet});
        const offer = Offer.at(offers[0]);
        const holder = HolderAdCoins.at(await offer.holderCoins.call());
        let balance = await holder.getBalance();

        balance.should.be.bignumber.equal(0);

        //advertiserWallet no have tokens
        await this.tokensContract.transfer(holder.address, offerBalance, {from: advertiserWallet})
            .should
            .be
            .rejectedWith(EVMThrow);

        await this.tokensContract.transfer(holder.address, offerBalance);
        balance = await holder.getBalance();
        balance.should.be.bignumber.equal(offerBalance);
    });

    it('search with positive balance on offer holder of coins', async function () {
        const searchData = [4, 4, 8];
        const listOfQuestionnaire = await this.baseContract.getQuestionnaires();
        const questionnaireAddress = Questionnaire.at(listOfQuestionnaire[0]).address;

        await this.searchContract.searchOffers(questionnaireAddress, searchData, {from: clientWallet});
        const result = await this.searchContract.getLatestSearchResult({from: clientWallet});
        result.length.should.be.equal(1);
    });

    it('give to client his reward after search', async function () {
        const clientAddress = await this.baseContract.getClient(clientWallet);
        const clientContract = Client.at(clientAddress);

        const result = await this.searchContract.getLatestSearchResult({from: clientWallet});
        result.length.should.be.equal(1);
        const offerReward = await clientContract.rewardOffersAddresses(0);
        offerReward.should.be.equal(result[0]);

        await clientContract.rewardOffersAddresses(1).should
            .be
            .rejectedWith(EVMThrow);

        const giveReward = await clientContract.getRewardByOffer(result[0]);
        //0.8 - this - rulesRewardPercents = [60 (salary), 20 (age), 20 (country)]; and matching 80%  (salary and age)
        giveReward.should.be.bignumber.equal(offerMaxReward.mul(0.8));

        await this.baseContract.transferClientRewards(result[0], {from: clientWallet});

        const clientBalance = await this.tokensContract.balanceOf(clientWallet);
        clientBalance.should.be.bignumber.equal(giveReward);

        const reward = await clientContract.getRewardByOffer(result[0]);
        reward.should.be.bignumber.equal(0);

        const offer = Offer.at(result[0]);
        const holder = HolderAdCoins.at(await offer.holderCoins.call());
        const offerUpdatedBalance = await holder.getBalance();
        offerUpdatedBalance.should.be.bignumber.equal(offerBalance.minus(giveReward));
    });

    it('change client data and search', async function () {
        const otherData = [
            fromAscii('1000', 32),
            fromAscii('10', 32),
            fromAscii('usa', 32)];

        const clientAddress = await this.baseContract.getClient(clientWallet);

        const clientContract = Client.at(clientAddress);

        const clientDataKeys = await this.searchContract.getClientDataKeys();
        offerUserDataValues.length.should.be.equal(clientDataKeys.length);

        await clientContract.setData(clientDataKeys, otherData, {from: clientWallet});

        const values = await clientContract.getData(clientDataKeys);
        assert.deepEqual(values, otherData, 'incorrect array of Values');

        const searchData = [4, 4, 8];
        const listOfQuestionnaire = await this.baseContract.getQuestionnaires();
        const questionnaireAddress = Questionnaire.at(listOfQuestionnaire[0]).address;

        await this.searchContract.searchOffers(questionnaireAddress, searchData, {from: clientWallet});
        const result = await this.searchContract.getLatestSearchResult({from: clientWallet});
        result.length.should.be.equal(0);
    });

    assert.deepEqualNumber = function (arrayNumber1, arrayNumber2) {
        arrayNumber1.length.should.be.equal(arrayNumber2.length);

        for (let i = 0; i < arrayNumber1.length; i++) {
            arrayNumber1[i].should.be.bignumber.equal(arrayNumber2[i]);
        }
    };

});
