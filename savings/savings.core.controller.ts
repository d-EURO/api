import { Controller, Get, Param } from '@nestjs/common';
import { ApiResponse, ApiTags } from '@nestjs/swagger';
import { SavingsCoreService } from './savings.core.service';
import { ApiSavingsInfo, ApiSavingsUserTable } from './savings.core.types';
import { Address } from 'viem';

@ApiTags('Savings Controller')
@Controller('savings/core')
export class SavingsCoreController {
	constructor(private readonly savings: SavingsCoreService) {}

	@Get('info')
	@ApiResponse({
		description: '',
	})
	getInfo(): ApiSavingsInfo {
		return this.savings.getInfo();
	}

	@Get('user/:address')
	@ApiResponse({
		description: '',
	})
	async getUserTable(@Param('address') address: string): Promise<ApiSavingsUserTable> {
		return await this.savings.getUserTables(address as Address);
	}
}
