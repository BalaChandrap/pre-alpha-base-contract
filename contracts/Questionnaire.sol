pragma solidity ^0.4.11;

import 'zeppelin-solidity/contracts/ownership/Ownable.sol';
import './helpers/Bytes32Utils.sol';


contract Questionnaire is Ownable {
    using Bytes32Utils for bytes32;

    uint public constant MAX_VARIANT_COUNT = 30;

    struct Variant {
        bytes32 title;
    }

    struct QuestionnaireStep {
        string title;
        uint[] variantIds;
        bool isMultiselect;
        mapping(uint => bytes32) variants;
    }

    bytes32 public groupName;

    QuestionnaireStep[] private questionnaire;

    function Questions() {

    }

    function getStepCount() external constant returns (uint) {
        return questionnaire.length;
    }

    function getStepType(uint8 step) external constant returns (bool) {
        require(step < questionnaire.length && step >= 0);

        return questionnaire[step].isMultiselect;
    }

    function getStepInfo(uint8 step) external constant returns (string, bool) {
        require(step < questionnaire.length && step >= 0);

        return (questionnaire[step].title, questionnaire[step].isMultiselect);
    }

    function getVariantsOfStep(uint8 step) external constant returns (bytes32[], uint[]) {
        require(step < questionnaire.length && step >= 0);

        bytes32[] memory titles = new bytes32[](questionnaire[step].variantIds.length);
        uint256[] memory ids = new uint[](questionnaire[step].variantIds.length);
        uint id;

        for(uint i = 0; i < questionnaire[step].variantIds.length; i++) {
            id = questionnaire[step].variantIds[i];
            titles[i] = bytes32(questionnaire[step].variants[id]);
            ids[i] = uint(id);
        }

        return (titles, ids);
    }

    function addVariant(uint8 step, bytes32 title) external onlyOwner {
        require(step < questionnaire.length && questionnaire.length > 0);
        require(questionnaire[step].variantIds.length + 1 <= MAX_VARIANT_COUNT);

        uint id = 1 << (questionnaire[step].variantIds.length + 1);

        questionnaire[step].variantIds.push(id);
        questionnaire[step].variants[id] = title;
    }

    function addNewStep(string _title, bool _isMultiselect) external onlyOwner {
        questionnaire.push(QuestionnaireStep({
            title: _title,
            variantIds: new uint[](0),
            isMultiselect: _isMultiselect
        }));
    }

    function setGroupName(bytes32 _groupName) external onlyOwner {
        groupName = _groupName;
    }

}
