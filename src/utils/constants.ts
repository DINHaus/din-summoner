import { KeychainList } from "@daohaus/keychain-utils";

export const SILO_CONTRACTS: KeychainList = {
  FIXED_LOOT_SUMMONER: {
    "0x1": "0x86C9118898922f5f7F55cfF0850A59b7B30F1820",
    "0x5": "0x86C9118898922f5f7F55cfF0850A59b7B30F1820",
    "0xa": "0x86C9118898922f5f7F55cfF0850A59b7B30F1820",
  },
  FIXED_LOOT_SINGLETON: {
    "0x1": "0xa21220572A205B8160982e04ecACE8a4D2304E96",
    "0x5": "0xa21220572A205B8160982e04ecACE8a4D2304E96",
    "0xa": "0xa21220572A205B8160982e04ecACE8a4D2304E96",
  },
  CLAIM_SHAMAN_SINGLETON: {
    "0x1": "0x878783dadB70F6035f5708A4Bc4B303936240D53",
    "0x5": "0x878783dadB70F6035f5708A4Bc4B303936240D53",
    "0xa": "0x878783dadB70F6035f5708A4Bc4B303936240D53",
  },
  TBA_REGISTRY: {
    "0x1": "0x02101dfB77FDE026414827Fdc604ddAF224F0921",
    "0x5": "0x02101dfB77FDE026414827Fdc604ddAF224F0921",
    "0xa": "0x02101dfB77FDE026414827Fdc604ddAF224F0921",
  },
  TBA_IMPLEMENTATION: {
    "0x1": "0x2d25602551487c3f3354dd80d76d54383a243358",
    "0x5": "0x2d25602551487c3f3354dd80d76d54383a243358",
    "0xa": "0x2d25602551487c3f3354dd80d76d54383a243358",
  },
};

/// https://docs.tokenbound.org/contracts/deployments

export const SHARE_PER_NFT = "1000000000000000000";
export const CLAIM_SHAMAN_PERMISSIONS = "2";
export const SHARE_NAME = "vNFT";
export const SHARE_SYMBOL = "NFT";
export const DEFAULT_SUMMON_VALUES = {
  votingPeriodInSeconds: 259200,
  gracePeriodInSeconds: 172800,
  newOffering: "10000000000000000",
  quorum: "20",
  sponsorThreshold: SHARE_PER_NFT,
  minRetention: "66",
  votingTransferable: false,
  nvTransferable: true,
};
