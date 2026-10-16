import { Controller, Get, Param } from '@nestjs/common';
import { ApiResponse, ApiTags } from '@nestjs/swagger';
import { SavingsCoreService } from './savings.core.service';
import { ApiSavingsInfo, ApiSavingsUserTable, ApiSavingsUserLeaderboard } from './savings.core.types';
import { Address } from 'viem';
import { AddressPipe } from 'utils/address.pipe';

@ApiTags('Savings Controller')
@Controller('savings/core')
export class SavingsCoreController {
	constructor(private readonly savings: SavingsCoreService) {}

	@Get('info')
	@ApiResponse({
		description: 'returns the current savings information.',
	})
	getInfo(): ApiSavingsInfo {
		return this.savings.getInfo();
	}

	@Get('info/leaderboard')
	@ApiResponse({
		description: 'returns the current savings information for leaderboard.',
	})
	getInfoLeaderboard(): ApiSavingsUserLeaderboard[] {
		return this.savings.getSavingsUserLeaderboard();
	}

	@Get('user/:address')
	@ApiResponse({
		description: 'returns the latest user table history or recent entries from all users',
	})
	async getUserTable(@Param('address', new AddressPipe({ allowKeywords: true })) address: Address): Promise<ApiSavingsUserTable> {
		return await this.savings.getUserTables(address);
	}
}
