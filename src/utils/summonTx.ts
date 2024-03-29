import { parseEther } from "viem";
import {
  ArbitraryState,
  EthAddress,
  POSTER_TAGS,
  ZERO_ADDRESS,
  encodeFunction,
  encodeValues,
  getNonce,
  isEthAddress,
  isNumberish,
  isString,
} from "@daohaus/utils";
import {
  CONTRACT_KEYCHAINS,
  HAUS_RPC,
  Keychain,
  ValidNetwork,
} from "@daohaus/keychain-utils";
import { LOCAL_ABI } from "@daohaus/abis";
import safeAbi from "../abis/safe.json";
import safeL2Abi from "../abis/safeL2.json";
import basicHOSSummoner from "../abis/basicHOSSummoner.json";
import nftShamanHosSummoner from "../abis/nftShamanSummoner.json";
import nftCuratorShaman from "../abis/nftCuratorShaman.json"

import safeFactoryAbi from "../abis/safeFactory.json";

import { handleKeychains } from "@daohaus/contract-utils";

import {
  CLAIM_SHAMAN_PERMISSIONS,
  DEFAULT_SUMMON_VALUES,
  LOOT_NAME,
  LOOT_SYMBOL,
  SHARE_NAME,
  SHARE_PER_NFT,
  SHARE_SYMBOL,
  CURATOR_CONTRACTS,
} from "./constants";
import { createEthersContract } from "@daohaus/tx-builder";
import { BigNumber, ethers } from "ethers";
import { SaltNonce } from "../components/customFields/SaltNonce";

export const calcAmountPerNft = ({
  lootTokenSupply,
  airdropAllocation,
  maxClaims,
}: {
  lootTokenSupply: string | number;
  airdropAllocation: string | number;
  maxClaims: string | number;
}) => {
  const lootToVault =
    BigInt(lootTokenSupply) -
    (BigInt(lootTokenSupply) * BigInt(airdropAllocation)) / 100n;
  const lootToShaman = BigInt(lootTokenSupply) - lootToVault;
  const loot = BigInt(lootToShaman) / BigInt(maxClaims);

  return parseEther(loot.toString());
};

export type SummonParams = {
  daoName?: string;
  tokenName?: string;
  tokenSymbol?: string;
  lootTokenName?: string;
  lootTokenSymbol?: string;
  votingTransferable?: boolean;
  nvTransferable?: boolean;
  quorum?: string;
  minRetention?: string;
  sponsorThreshold?: string;
  newOffering?: string;
  votingPeriod?: string;
  votingPeriodInSeconds?: number;
  gracePeriod?: string;
  gracePeriodInSeconds?: number;
  shamans?: '' | {
      shamanAddresses: string[];
      shamanPermissions: string[];
  };
  members?: '' | {
      memberAddresses: string[];
      memberShares: string[];
      memberLoot: string[];
  };
  calculatedShamanAddress?: string;
  tags?: string[];
};

export const assembleCuratorSummonerArgs = (args: ArbitraryState) => {

  const memberAddress = args.appState.memberAddress as EthAddress;
  const formValues = args.appState.formValues as FormValuesWithTags;
  const chainId = args.chainId as ValidNetwork;
  let txArgs: [string, string, string, string[], string];
  console.log(">>>>>", formValues, memberAddress, chainId);

  if (!isString(formValues["saltNonce"])) {
    throw new Error("Invalid nonce");
  }

  const saltNonce = formValues["saltNonce"].toString() || "8441";

    
    console.log(">>>>> no loot token name");
    const initializationLootTokenParams = assembleLootTokenParams({
      formValues,
      chainId,
    });

    const initializationShareTokenParams = assembleShareTokenParams({
      formValues,
      chainId,
      memberAddress
    });

    const initializationShamanParams = assembleShamanParams({
      formValues,
      chainId,
      memberAddress
    });

    const postInitializationActions = assembleInitActions({
      formValues,
      memberAddress,
      chainId,
      saltNonce,
    });

    txArgs = [
      initializationLootTokenParams,
      initializationShareTokenParams,
      initializationShamanParams,
      postInitializationActions,
      saltNonce,
    ];
  

  console.log("txArgs", txArgs);

  return txArgs;
};

const assembleFixedLootTokenParams = ({
  formValues,
  chainId,
}: {
  formValues: Record<string, unknown>;
  chainId: ValidNetwork;
}) => {
  const tokenName = formValues["lootTokenName"];
  const tokenSymbol = formValues["lootTokenSymbol"];
  const lootSingleton = CURATOR_CONTRACTS["FIXED_LOOT_SINGLETON"][chainId];
  const initialHolders = [] as EthAddress[];
  const lootTokenSupply = formValues["lootTokenSupply"];
  const airdropAllocation = formValues["airdropAllocation"];

  if (
    !isString(tokenName) ||
    !isString(tokenSymbol) ||
    !lootSingleton ||
    !isNumberish(lootTokenSupply) ||
    !isNumberish(airdropAllocation)
  ) {
    console.log("ERROR: Form Values", formValues);

    throw new Error(
      "assembleFixedLootTokenParams recieved arguments in the wrong shape or type"
    );
  }
  const lootToVault =
    BigInt(lootTokenSupply) -
    (BigInt(lootTokenSupply) * BigInt(airdropAllocation)) / 100n;

  const lootToShaman = BigInt(lootTokenSupply) - lootToVault;

  console.log(
    "loot token: lootTokenSupply, airdropAllocation, lootToShaman, lootToVault",
    lootTokenSupply,
    airdropAllocation,
    lootToShaman,
    lootToVault
  );

  const lootParams = encodeValues(
    ["string", "string", "address[]", "uint256[]"],
    [tokenName, tokenSymbol, initialHolders, [lootToShaman, lootToVault]]
  );

  return encodeValues(["address", "bytes"], [lootSingleton, lootParams]);
};

const assembleLootTokenParamsNew = ({
  formValues,
  chainId,
}: {
  formValues: Record<string, unknown>;
  chainId: ValidNetwork;
}) => {
  const lootSingleton = CURATOR_CONTRACTS["GOV_LOOT_SINGLETON"][chainId];
  const daoName = formValues["daoName"] as string;
  const tokenName = formValues["lootTokenName"] as string;
  const tokenSymbol = formValues["lootTokenSymbol"] as string;

  if (!isString(daoName) || !lootSingleton) {
    console.log("ERROR: Form Values", formValues);

    throw new Error(
      "assembleLootTokenParams recieved arguments in the wrong shape or type"
    );
  }

  const lootParams = encodeValues(
    ["string", "string", "address[]", "uint256[]"],
    [tokenName, tokenSymbol, [], []]
  );

  return encodeValues(["address", "bytes"], [lootSingleton, lootParams]);
};

const assembleLootTokenParams = ({
  chainId,
  formValues,
}: {
  chainId: ValidNetwork;
  formValues: Record<string, unknown>;
}) => {
  const lootSingleton = CURATOR_CONTRACTS["GOV_LOOT_SINGLETON"][chainId];
  const daoName = formValues["daoName"] as string;

  if (!lootSingleton) {
    console.log("ERROR: passed args");

    throw new Error(
      "assembleLootTokenParams recieved arguments in the wrong shape or type"
    );
  }
  console.log(
    ">>>>> assembleLootTokenParams",
    daoName + " " + LOOT_NAME,
    daoName.substring(0, 3).toUpperCase() + "-" + LOOT_SYMBOL
  );

  const lootParams = encodeValues(
    ["string", "string"],
    [
      daoName + " " + LOOT_NAME,
      daoName.substring(0, 3).toUpperCase() + "-" + LOOT_SYMBOL
    ]
  );

  return encodeValues(["address", "bytes"], [lootSingleton, lootParams]);
};

// Needs to be non transferable
const assembleShareTokenParams = ({
  chainId,
  formValues,
  memberAddress
}: {
  chainId: ValidNetwork;
  formValues: Record<string, unknown>;
  memberAddress: EthAddress;
}) => {
  const shareSingleton = CONTRACT_KEYCHAINS["SHARES_SINGLETON"][chainId];
  const daoName = formValues["daoName"] as string;

  if (!shareSingleton) {
    console.log("ERROR: passed args");

    throw new Error(
      "assembleShareTokenParams recieved arguments in the wrong shape or type"
    );
  }

  const shareParams = encodeValues(
    ["string", "string"],
    [
      daoName + " " + SHARE_NAME,
      daoName.substring(0, 3).toUpperCase() + "-" + SHARE_SYMBOL
    ]
  );

  return encodeValues(["address", "bytes"], [shareSingleton, shareParams]);
};

const assembleShamanParams = ({
  formValues,
  memberAddress,
  chainId,
}: {
  formValues: Record<string, unknown>;
  memberAddress: EthAddress;
  chainId: ValidNetwork;
}) => {

  const nftCuratorShamanSingleton = CURATOR_CONTRACTS["NFT_CURATOR_SINGLETON"][chainId];
  const price = formValues["collectorPrice"] as string;
  const content = formValues["article"] as string;

console.log("??????????", price, memberAddress, nftCuratorShamanSingleton, content);


  if (
    !isEthAddress(memberAddress) ||

    !nftCuratorShamanSingleton
  ) {
    console.log("ERROR: Form Values", formValues);

    throw new Error(
      "assembleShamanParams recieved arguments in the wrong shape or type"
    );
  }

  // 
  const shamanParams = encodeValues(
    ["string", "string", "uint256", "uint256", "uint256", "uint256", "address", "string"],
    [
      "test",
      "TOK",
      "1000000000000000000",
      "1000000000000000000",
      price,
      "5",
      memberAddress,
      assembleInitialContent({formValues, memberAddress, chainId})
    ]
  );

  return encodeValues(
    ["address", "uint256", "bytes[]"],
    [nftCuratorShamanSingleton, CLAIM_SHAMAN_PERMISSIONS, [shamanParams]]
  );
};

function assembleInitialContent(
  {
    formValues,
    memberAddress,
    chainId,
  }: {
    formValues: Record<string, unknown>;
    memberAddress: EthAddress;
    chainId: ValidNetwork;
  }
) {
  const daoName = formValues["daoName"] as string;
  const calculatedDAOAddress = formValues["calculatedDAOAddress"] as string;
  const body = formValues["article"] as string;
  const headerImage = formValues["headerImage"] as string;
  const name = formValues["daoName"] as string;

  const content = { 
                name: name,
                daoId: calculatedDAOAddress || "0x00000000",
                table: 'daoProfile', 
                queryType: 'list',
                title: `${daoName} Incarnation`,
                description: body,
                contentURI: "",
                contentURIType: "url",
                imageURI: headerImage,
                imageURIType: "url",
                contentHash: "", // TODO: uuid, maybe use signature
                authorAddress: memberAddress,
                parentId: 0
              };
  return JSON.stringify(content);

}

interface FormValuesWithTags extends Record<string, unknown> {
  tags: string[];
}

const assembleInitActions = ({
  formValues,
  memberAddress,
  chainId,
  saltNonce,
}: {
  formValues: FormValuesWithTags;
  memberAddress: EthAddress;
  chainId: ValidNetwork;
  saltNonce: string;
}) => {
  const { POSTER } = handleKeychains(chainId);

  let initActions = [];
  console.log("formValues ????????????/", formValues);

    initActions = [
      governanceConfigTX(DEFAULT_SUMMON_VALUES),
      metadataConfigTX(formValues, memberAddress, POSTER.toLowerCase()),
      tokenConfigTX(),
      tokenDistroTX(formValues, memberAddress),
      // this will not be indexed as is. move intro post to metadataConfigTX
      // introPostConfigTX(formValues, memberAddress, POSTER.toLowerCase(), chainId), 
    ];
  
  return initActions;
};

const governanceConfigTX = (formValues: SummonParams) => {
  const {
    votingPeriodInSeconds,
    gracePeriodInSeconds,
    newOffering,
    quorum,
    sponsorThreshold,
    minRetention,
  } = formValues;

  if (
    !isNumberish(votingPeriodInSeconds) ||
    !isNumberish(gracePeriodInSeconds) ||
    !isNumberish(newOffering) ||
    !isNumberish(quorum) ||
    !isNumberish(sponsorThreshold) ||
    !isNumberish(minRetention)
  ) {
    throw new Error(
      "governanceConfigTX recieved arguments in the wrong shape or type"
    );
  }

  const encodedValues = encodeValues(
    ["uint32", "uint32", "uint256", "uint256", "uint256", "uint256"],
    [
      votingPeriodInSeconds,
      gracePeriodInSeconds,
      newOffering,
      quorum,
      sponsorThreshold,
      minRetention,
    ]
  );
  const encoded = encodeFunction(LOCAL_ABI.BAAL, "setGovernanceConfig", [
    encodedValues,
  ]);
  if (isString(encoded)) {
    return encoded;
  }
  throw new Error("Encoding Error");
};

const tokenConfigTX = () => {
  const pauseVoteToken = true;
  const pauseNvToken = true;

  const encoded = encodeFunction(LOCAL_ABI.BAAL, "setAdminConfig", [
    pauseVoteToken,
    pauseNvToken,
  ]);

  if (isString(encoded)) {
    return encoded;
  }
  throw new Error("Encoding Error");
};

const tokenDistroTX = (formValues: SummonParams , memberAddress: EthAddress) => {

  // const shamanAddress = formValues.calculatedShamanAddress;

  const encoded = encodeFunction(LOCAL_ABI.BAAL, "mintShares", [
    [memberAddress],
    ["10000000000000000000"]
  ]);

  if (isString(encoded)) {
    return encoded;
  }
  throw new Error("Encoding Error");
};

const introPostConfigTX = (formValues: SummonParams, memberAddress: EthAddress, posterAddress: string, chainId: ValidNetwork) => {
  const { daoName } = formValues;
  if (!isString(daoName)) {
    console.log("ERROR: Form Values", formValues);
    throw new Error("metadataTX recieved arguments in the wrong shape or type");
  }
  console.log("POSTER", posterAddress);

  const METADATA = encodeFunction(LOCAL_ABI.POSTER, "post", [
    assembleInitialContent({formValues, memberAddress, chainId}),
    POSTER_TAGS.summoner,
  ]);

  const encoded = encodeFunction(LOCAL_ABI.BAAL, "executeAsBaal", [
    posterAddress,
    0,
    METADATA,
  ]);
  if (isString(encoded)) {
    return encoded;
  }
  throw new Error("Encoding Error");
};

const metadataConfigTX = (formValues: FormValuesWithTags, memberAddress: EthAddress, posterAddress: string) => {
  const { daoName, calculatedDAOAddress, article: body, headerImage, description, paramTag, tags } = formValues;
  if (!isString(daoName)) {
    console.log("ERROR: Form Values", formValues);
    throw new Error("metadataTX recieved arguments in the wrong shape or type");
  }
  console.log("POSTER", posterAddress);

  const content = { 
                name: daoName,
                daoId: calculatedDAOAddress,
                table: 'daoProfile', 
                queryType: 'list',
                description: description || "",
                longDescription: body || "",
                avatarImg: headerImage || "",
                title: `${daoName} Incarnation`,
                tags: ["DIN", "Incarnation", paramTag || "topic", ...tags],
                authorAddress: memberAddress,
                // parentId: 0
              };

  const METADATA = encodeFunction(LOCAL_ABI.POSTER, "post", [
    JSON.stringify(content),
    POSTER_TAGS.summoner,
  ]);

  const encoded = encodeFunction(LOCAL_ABI.BAAL, "executeAsBaal", [
    posterAddress,
    0,
    METADATA,
  ]);
  if (isString(encoded)) {
    return encoded;
  }
  throw new Error("Encoding Error");
};

const initialContentTX = (formValues: SummonParams, memberAddress: EthAddress, chainId: ValidNetwork) => {

  console.log("shaman >>>", formValues.calculatedShamanAddress);

  const DATA = encodeFunction(nftCuratorShaman, "introPost", [
    memberAddress,
    assembleInitialContent({formValues, memberAddress, chainId}),
  ]);

  console.log("DATA >>>", DATA);

  const encoded = encodeFunction(LOCAL_ABI.BAAL, "executeAsBaal", [
    formValues.calculatedShamanAddress,
    0,
    DATA,
  ]);

  console.log("encoded >>>", encoded);
  if (isString(encoded)) {
    return encoded;
  }
  throw new Error("Encoding Error");
};

const managerAccountConfigTX = (
  formValues: Record<string, unknown>,
  saltNonce: string,
  chainId: ValidNetwork
) => {
  const { managerAccountAddress, calculatedTreasuryAddress } = formValues;

  if (
    !isEthAddress(managerAccountAddress) ||
    !isEthAddress(calculatedTreasuryAddress)
  ) {
    console.log("ERROR: Form Values", formValues);
    throw new Error(
      "Manager addresses recieved arguments in the wrong shape or type"
    );
  }

  // SafeAbi and SafeL2Abi are the same
  // there is a different master copy and proxy factory for L2 though
  const ADD_MODULE = encodeFunction(safeAbi, "enableModule", [
    managerAccountAddress,
  ]);

  const EXEC_TX_FROM_MODULE = encodeFunction(
    safeAbi,
    "execTransactionFromModule",
    [
      calculatedTreasuryAddress, // to
      "0", //value
      ADD_MODULE, // data
      "0", // operation
    ]
  );

  // console.log("EXEC_TX_FROM_MODULE", EXEC_TX_FROM_MODULE);

  const encoded = encodeFunction(LOCAL_ABI.BAAL, "executeAsBaal", [
    calculatedTreasuryAddress as EthAddress,
    0,
    EXEC_TX_FROM_MODULE,
  ]);

  if (isString(encoded)) {
    return encoded;
  }
  throw new Error("***********Encoding Error***************");
};

export const calculateDAOAddress = async (
  saltNonce: string,
  chainId: ValidNetwork
) => {
  const nftCuratorSummoner = CURATOR_CONTRACTS["NFT_CURATOR_SUMMONER"][chainId] || ZERO_ADDRESS;
  // calculateBaalAddress

  console.log("nftCuratorSummoner", nftCuratorSummoner, chainId);

  const hos = createEthersContract({
    address: nftCuratorSummoner,
    abi: basicHOSSummoner,
    chainId: chainId,
    rpcs: HAUS_RPC,
  });
  let expectedDAOAddress = await hos.callStatic.calculateBaalAddress(
      saltNonce
    );

    console.log(">>>>>>>>>>>>>>>>>>>>>>>>>>>expectedDAOAddress", expectedDAOAddress, ethers.utils.getAddress(expectedDAOAddress));

  return ethers.utils.getAddress(expectedDAOAddress);
}

export const calculateShamanAddress= async (
  saltNonce: string,
  chainId: ValidNetwork
) => {
  const nftShamanSingleton = CURATOR_CONTRACTS["NFT_CURATOR_SINGLETON"][chainId] || ZERO_ADDRESS;
  const nftShamanSummoner = CURATOR_CONTRACTS["NFT_CURATOR_SUMMONER"][chainId] || ZERO_ADDRESS;
  console.log("nftShaman", nftShamanSingleton, nftShamanSummoner, chainId);
  const hos = createEthersContract({
    address: nftShamanSummoner,
    abi: nftShamanHosSummoner,
    chainId: chainId,
    rpcs: HAUS_RPC,
  });
  let expectedShamanAddress = ZERO_ADDRESS;

  try {
    expectedShamanAddress = await hos.callStatic.predictDeterministicShamanAddress(
      nftShamanSingleton,
      saltNonce
    );
    console.log(">>>>>>>>>>>>>> expectedShamanAddress", expectedShamanAddress);
  
  } catch (e: any) {

    console.log("expectedShamanAddress error", e);
  }

  return expectedShamanAddress;

}

// util to get the address of a safe before it is deployed
export const calculateCreateProxyWithNonceAddress = async (
  saltNonce: string,
  chainId: ValidNetwork
) => {
  const gnosisSafeProxyFactoryAddress =
    CURATOR_CONTRACTS["GNOSIS_SAFE_PROXY_FACTORY"][chainId] || ZERO_ADDRESS;
  const masterCopyAddress = CURATOR_CONTRACTS["GNOSIS_SAFE_MASTER_COPY"][chainId];
  const initializer = "0x";
  if (
    !isEthAddress(gnosisSafeProxyFactoryAddress) ||
    !isEthAddress(masterCopyAddress)
  ) {
    throw new Error("Invalid address");
  }
  const gnosisSafeProxyFactory = createEthersContract({
    address: gnosisSafeProxyFactoryAddress,
    abi: safeFactoryAbi,
    chainId: chainId,
    rpcs: HAUS_RPC,
  });
  let expectedSafeAddress = ZERO_ADDRESS;

  try {
    await gnosisSafeProxyFactory.estimateGas.calculateCreateProxyWithNonceAddress(
      masterCopyAddress,
      initializer,
      BigNumber.from(saltNonce),
      { from: gnosisSafeProxyFactoryAddress }
    );
  } catch (e: any) {
    expectedSafeAddress = getSafeAddressFromRevertMessage(e);
  }

  return expectedSafeAddress;
};

const getSafeAddressFromRevertMessage = (e: any): string => {
  let safeAddress;
  if (e.error.error.data) {
    safeAddress = ethers.utils.getAddress(e.error.error.data.slice(138, 178));
  } else {
    let messages: string[] = e.error.split(" ");
    safeAddress =
      messages
        .find((m) => m.match(/^0x[a-fA-F0-9]{40,44}$/))
        ?.replace(",", "") ?? ZERO_ADDRESS;
  }
  return safeAddress;
};

export const getSaltNonce = (length = 32) => {
  let text = "";
  const possible = "0123456789";
  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
};
