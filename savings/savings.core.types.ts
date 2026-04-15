import { Address } from 'viem';

// --------------------------------------------------------------------------
// Ponder return types
export type SavingsIdSaved = `${Address}-${number}`;
export type SavingsSavedQuery = {
	id: SavingsIdSaved;
	created: number;
	blockheight: number;
	txHash: string;
	account: Address;
	amount: string;
	rate: number;
	total: string;
	balance: string;
};

export type SavingsIdInterest = `${Address}-${number}`;
export type SavingsInterestQuery = {
	id: SavingsIdInterest;
	created: number;
	blockheight: number;
	txHash: string;
	account: Address;
	amount: string;
	rate: number;
	total: string;
	balance: string;
};

export type SavingsIdWithdraw = `${Address}-${number}`;
export type SavingsWithdrawQuery = {
	id: SavingsIdWithdraw;
	created: number;
	blockheight: number;
	txHash: string;
	account: Address;
	amount: string;
	rate: number;
	total: string;
	balance: string;
};

export type SavingsVaultDepositQuery = {
	id: string;
	vault: Address;
	owner: Address;
	assets: string;
	blockheight: number;
	timestamp: number;
	txHash: string;
};

export type SavingsVaultWithdrawQuery = {
	id: string;
	vault: Address;
	owner: Address;
	assets: string;
	blockheight: number;
	timestamp: number;
	txHash: string;
};
// --------------------------------------------------------------------------
// Service

// --------------------------------------------------------------------------
// Api
export type ApiSavingsInfo = {
	totalSaved: number;
	totalWithdrawn: number;
	totalBalance: number;
	totalInterest: number;
	rate: number;
	rateV2: number;
	rateV3: number;
	ratioOfSupply: number;
};

export type ApiSavingsUserTable = {
	save: SavingsSavedQuery[];
	interest: SavingsInterestQuery[];
	withdraw: SavingsWithdrawQuery[];
	vaultSave: SavingsVaultDepositQuery[];
	vaultWithdraw: SavingsVaultWithdrawQuery[];
};

export type ApiSavingsUserLeaderboard = {
	account: Address;
	amountSaved: string;
	unrealizedInterest: string;
	interestReceived: string;
};
