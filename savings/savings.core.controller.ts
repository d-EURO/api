import { Controller, Get, Param } from '@nestjs/common';
import { ApiResponse, ApiTags } from '@nestjs/swagger';
import { SavingsCoreService } from './savings.core.service';
import { ApiSavingsInfo, ApiSavingsUserTable } from './savings.core.types';
import { Address, zeroAddress } from 'viem';

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

	@Get('user/:address')
	@ApiResponse({
		description: 'returns the latest user table history or recent entries from all users',
	})
	async getUserTable(@Param('address') address: string): Promise<ApiSavingsUserTable> {
		const keywords: string[] = ['0', 'all', 'zero', 'zeroAddress', zeroAddress];
		if (keywords.includes(address)) address = zeroAddress;
		return await this.savings.getUserTables(address as Address);
	}
}
