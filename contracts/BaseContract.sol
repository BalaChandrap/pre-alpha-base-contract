pragma solidity ^0.4.11;

import "./PreCATToken.sol";
import "./HolderAdCoins.sol";

contract BaseContract {
    event Transfer(address indexed _from, address indexed _to, uint advertId, uint256 _value);

    event CreateAdvert(
        address indexed advertiser,
        uint advertId,
        bytes32 argAdvertType,
        bytes32[] argCategories,
        bytes32[] argCategoryValues
    );

    event SearchAdvert(
        address indexed addr,
        bytes32 advertType,
        bytes32[] categories,
        bytes32[] categoryValues
    );

    event foundOffers(
        address indexed addr,
        uint[] advertIds
    );

    event SaveUserData(address indexed addr, bytes32[] keys, bytes32[] values);

    uint8 constant MIN_PERCENTAGE_SIMILARITY = 0x50;
    uint8 constant MAX_COUNT_SHOWED_AD = 0x4; //start from 0 (zero);
    address constant ADDRESS_CONTRACT_OF_TOKENS = 0xcF6137b80171540a9c6C10D3332E3de5d93B4EF7;

    struct Client {
        uint[] resultIds;
        mapping(bytes32 => bytes32) info;
        mapping(uint => uint256) rewards;
    }

    struct ClientInfoKeys {
        mapping (bytes32 => bool) existed;
        bytes32[] keys;
    }

    struct Rules {
        uint256 minWorth;
        uint256 maxWorth;
        bytes32[] key;
        bytes32[] value;
        uint8[] action; //0 - '=='; 1 - '!='; 2 - '<='; 3 - '>='; 4 - '>'; 5 - '<'.
        uint8[] worth; // 0-100; worth for calculate rewards. (100 - this is max value of all items).
    }

    struct Advert {
        uint advertId;
        HolderAdCoins holderCoins;
        mapping (bytes32 => bytes32) searchData;
        string url;
        string shortDesc;
        string imageUrl;
        Rules rules;
    }

    struct SubCategories {
        mapping (bytes32 => uint[]) mapCategories; // name of categories => advertIds;
        bytes32[] categories;
        bool exists;
    }

    // userAddress => (advertId => count). count - may be max == 4.
    mapping(address => mapping(uint => uint8)) mapAdvertShowedCount;

    mapping (address => uint[]) private mapAdvertiserOffers;

    // advertTypes (car/home etc) => struct(second categories (mark, city etc.) => array of id);
    mapping (bytes32 => SubCategories) private rootSearch;

    // car/home/tv/phones/animals etc.
    bytes32[] private advertTypes;

    // index of items adverts for generate unique number
    uint private advertIndexedId;
    mapping (uint => Advert) private adverts;

    mapping (address => Client) private clients;

    ClientInfoKeys private clientInfoKeys;

    PreCATToken private tokenContract = new PreCATToken("TOKEN", "TKN"); //PreCATToken(ADDRESS_CONTRACT_OF_TOKENS);

    function BaseContract() {
    }

    function getAdvertiserOffers() public constant returns(uint[]) {
        return mapAdvertiserOffers[msg.sender];
    }

    function getClientFoundOffers() public constant returns(uint[]) {
        return clients[msg.sender].resultIds;
    }

    function getClientInfoValues() public constant returns(bytes32[]) {
        uint size = clientInfoKeys.keys.length;
        mapping(bytes32 => bytes32) info = clients[msg.sender].info;

        bytes32[] memory values = new bytes32[](size);
        for(uint i = 0; i < size; i++) {
            values[i] = info[clientInfoKeys.keys[i]];
        }

        return values;
    }

    function getClientInfoFields() public constant returns(bytes32[]) {
        return clientInfoKeys.keys;
    }

    function getSubCategories(bytes32 advertType) public constant returns (bytes32[]) {
        return rootSearch[advertType].categories;
    }

    function getAdvertTypes() public constant returns (bytes32[]) {
        return advertTypes;
    }

    function getAdvert(uint advertId)
        public
        constant
        returns
    (
        address holder,
        string url,
        string shortDesc,
        string imageUrl,
        uint256 reward
    )
    {
        byte accessSuccess = 0;

        uint[] storage advertiserOffers = mapAdvertiserOffers[msg.sender];

        for(uint i = 0; i < advertiserOffers.length; i++) {
            if (advertiserOffers[i] == advertId) {
                accessSuccess = 0x1;
                break;
            }
        }

        uint256 clientRewards = clients[msg.sender].rewards[advertId];
        if (clientRewards > 0) {
            accessSuccess = 0x1;
        }

        require(accessSuccess == 0x1);

        Advert storage advert = adverts[advertId];

        return (advert.holderCoins, advert.url, advert.shortDesc, advert.imageUrl, clientRewards);
    }

    function getAdvertRules(uint advertId)
        public
        constant
        returns
    (
        uint256 minWorth,
        uint256 maxWorth,
        bytes32[] key,
        bytes32[] value,
        uint8[] action,
        uint8[] worth
    )
    {
        Advert storage advert = adverts[advertId];

        return (
            advert.rules.minWorth,
            advert.rules.maxWorth,
            advert.rules.key,
            advert.rules.value,
            advert.rules.action,
            advert.rules.worth
        );
    }

    function saveUserInfo(bytes32[] keys, bytes32[] values) public {
        SaveUserData(msg.sender, keys, values);

        mapping(bytes32 => bytes32) info = clients[msg.sender].info;
        for (uint i = 0; i < keys.length; i++)
            info[keys[i]] = values[i];
    }

    function getUserRewards(uint advertId) public constant returns (uint256) {
        return clients[msg.sender].rewards[advertId];
    }

    function transferUserRewards(uint advertId) public {
        Client storage client = clients[msg.sender];
        Advert storage advert = adverts[advertId];

        require(advert.advertId == advertId);
        require(client.rewards[advertId] > 0);
        require(tokenContract.balanceOf(advert.holderCoins) >= client.rewards[advertId]);

        uint256 reward = client.rewards[advertId];
        client.rewards[advertId] = 0x0;

        advert.holderCoins.transfer(msg.sender, reward);

        if (mapAdvertShowedCount[msg.sender][advert.advertId] < MAX_COUNT_SHOWED_AD) {
            mapAdvertShowedCount[msg.sender][advert.advertId]++;
        }
        Transfer(advert.holderCoins, msg.sender, advertId, reward);
    }

    function getAdvertBufferCoins(uint advertId) public constant returns (uint256) {
        Advert storage advert = adverts[advertId];

        require(advert.advertId > 0);
        require(advert.holderCoins.isOfferAddress(msg.sender));

        return tokenContract.balanceOf(advert.holderCoins);
    }

    function updateAdBalance(uint advertId, uint256 value) {
        tokenContract.transfer(adverts[advertId].holderCoins, value);
    }

    // todo separate to few functions.
    function createAdvertInCatalog(
        bytes32 argAdvertType,
        bytes32[] argCategories,
        bytes32[] argCategoryValues,
        string argUrl,
        string argShortDesc,
        string argImageUrl,
        uint256 rulesMinWorth,
        uint256 rulesMaxWorth,
        bytes32[] rulesKey,
        bytes32[] rulesValue,
        uint8[] rulesAction,
        uint8[] rulesWorth
    )
        public
    {
        require(msg.sender > 0x0);
        require(argAdvertType > 0x0);
        require(rulesMaxWorth > 0x0);
        require(rulesMinWorth <= rulesMaxWorth);
        require(argCategories.length == argCategoryValues.length);

        advertIndexedId++;

        updateSubCategories(argAdvertType, argCategories);
        createOfferWordsByAdvertType(argAdvertType);

        HolderAdCoins holderAddress = new HolderAdCoins(tokenContract, msg.sender, advertIndexedId);
        adverts[advertIndexedId] = Advert(
            advertIndexedId,
            holderAddress,
            argUrl,
            argShortDesc,
            argImageUrl,
            Rules(rulesMinWorth, rulesMaxWorth, rulesKey, rulesValue, rulesAction, rulesWorth)
        );
        mapAdvertiserOffers[msg.sender].push(advertIndexedId);

        updateAdvertSearchData(adverts[advertIndexedId], argCategories, argCategoryValues);
        mergeClientInfoKeys(rulesKey);

        CreateAdvert(
            msg.sender,
            advertIndexedId,
            argAdvertType,
            argCategories,
            argCategoryValues
        );
    }

    function searchAdvert(
        bytes32 advertType,
        bytes32[] categories,
        bytes32[] categoryValues
    )
        public
    {
        require(msg.sender != address(0));
        require(categories.length > 0);
        require(categories.length == categoryValues.length);

        SubCategories storage subCategories = rootSearch[advertType];

        require(subCategories.exists == true);

        SearchAdvert(msg.sender, advertType, categories, categoryValues);

        clearUserRewards();

        uint256[] storage resultIds = clients[msg.sender].resultIds;
        uint8 foundItem = 0;

        for(uint i = 0; i < categories.length; i++) {
            uint256[] memory advertIds = subCategories.mapCategories[categories[i]];
            for (uint j = 0; j < advertIds.length; j++) {
                foundItem = 0;
                for(uint k = 0; k < resultIds.length; k++) {
                    if (resultIds[k] == advertIds[j]){
                        foundItem = 1;
                        break;
                    }
                }
                if (foundItem == 0
                    && comparisonAdvertData(adverts[advertIds[j]], categories, categoryValues)
                    && comparisonAdvertRules(adverts[advertIds[j]])) {
                    resultIds.push(advertIds[j]);
                }
            }
        }

        foundOffers(msg.sender, resultIds);
    }

    function clearUserRewards() private {
        uint256[] storage resultIds = clients[msg.sender].resultIds;
        mapping(uint => uint256) rewards = clients[msg.sender].rewards;

        for (uint i = 0; i < resultIds.length; i++) {
            rewards[resultIds[i]] = 0;
        }

        delete clients[msg.sender].resultIds;
    }

    function comparisonAdvertData(
        Advert storage advert,
        bytes32[] categories,
        bytes32[] categoryValues
    )
        private
        returns (bool)
    {
        require(advert.rules.maxWorth > 0x0);

        if (tokenContract.balanceOf(advert.holderCoins) < advert.rules.maxWorth) {
            return false;
        }

        for(uint i = 0; i < categories.length; i++) {
            if (advert.searchData[categories[i]] != categoryValues[i]) {
                return false;
            }
        }

        return true;
    }

    function comparisonAdvertRules(Advert advert) private returns (bool) {
        Client storage client = clients[msg.sender];
        mapping (bytes32 => bytes32) info = client.info;
        bytes32 clientKeyValue;
        bytes32 advertKeyValue;
        uint8 action;
        uint worthPresents;

        for (uint i = 0; i < advert.rules.key.length; i++) {
            clientKeyValue = info[advert.rules.key[i]];
            advertKeyValue = advert.rules.value[i];
            action = advert.rules.action[i];

            if (action == 0 && clientKeyValue == advertKeyValue) {
                worthPresents += advert.rules.worth[i];
            } else if (action == 1 && clientKeyValue != advertKeyValue) {
                worthPresents += advert.rules.worth[i];
            } else if (action == 2 && clientKeyValue <= advertKeyValue) {
                worthPresents += advert.rules.worth[i];
            } else if (action == 3 && clientKeyValue >= advertKeyValue) {
                worthPresents += advert.rules.worth[i];
            } else if (action == 4 && clientKeyValue > advertKeyValue) {
                worthPresents += advert.rules.worth[i];
            } else if (action == 5 && clientKeyValue < advertKeyValue) {
                worthPresents += advert.rules.worth[i];
            }
        }

        uint8 showedCount = mapAdvertShowedCount[msg.sender][advert.advertId];

        if (worthPresents >= MIN_PERCENTAGE_SIMILARITY) {
            if (showedCount < MAX_COUNT_SHOWED_AD) {
                worthPresents = mathDiv(worthPresents, showedCount + 1);
                uint256 rewards = mathDiv(mathMul(advert.rules.maxWorth, worthPresents), 100);
                client.rewards[advert.advertId] = mathMax(rewards, advert.rules.minWorth);

            } else {
                client.rewards[advert.advertId] = 0x0;
            }

            return true;
        }

        client.rewards[advert.advertId] = 0x0;
        return false;
    }

    function updateAdvertSearchData(
        Advert storage advert,
        bytes32[] argCategories,
        bytes32[] argCategoryValues
    )
        private
    {
        for(uint i = 0; i < argCategories.length; i++) {
            advert.searchData[argCategories[i]] = argCategoryValues[i];
        }
    }

    function updateSubCategories(
        bytes32 argAdvertType,
        bytes32[] argCategories
    )
        private
    {
        SubCategories storage subCategories = rootSearch[argAdvertType];

        for (uint i = 0; i < argCategories.length; i++) {
            if (subCategories.mapCategories[argCategories[i]].length == 0) {
                subCategories.categories.push(argCategories[i]);
            }
            subCategories.mapCategories[argCategories[i]].push(advertIndexedId);
        }
    }

    function mergeClientInfoKeys(bytes32[] keys) private {
        for(uint i = 0; i < keys.length; i++) {
            if (!clientInfoKeys.existed[keys[i]]) {
                clientInfoKeys.keys.push(keys[i]);
                clientInfoKeys.existed[keys[i]] = true;
            }
        }
    }

    function mathMul(uint256 a, uint256 b) internal constant returns (uint256) {
        uint256 c = a * b;
        assert(a == 0 || c / a == b);
        return c;
    }

    function mathDiv(uint256 a, uint256 b) internal constant returns (uint256) {
        uint256 c = a / b;
        return c;
    }

    function mathMax(uint a, uint b) private constant returns (uint) {
        if (a > b) return a;
        else return b;
    }

    function createOfferWordsByAdvertType(bytes32 argAdvertType) private {
        if (!rootSearch[argAdvertType].exists) {
            advertTypes.push(argAdvertType);
            rootSearch[argAdvertType].exists = true;
        }
    }
}
