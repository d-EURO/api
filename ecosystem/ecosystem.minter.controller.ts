import { Controller, Get } from '@nestjs/common';
import { ApiResponse, ApiTags } from '@nestjs/swagger';
import { EcosystemMinterService } from './ecosystem.minter.service';
import { ApiMinterListing, ApiMinterMapping } from './ecosystem.minter.types';

@ApiTags('Ecosystem Controller')
@Controller('ecosystem/stablecoin/minter')
export class EcosystemMinterController {
	constructor(private readonly minter: EcosystemMinterService) {}

	@Get('list')
	@ApiResponse({
		description: 'Returns a list of all minter proposals',
	})
	getList(): ApiMinterListing {
		return this.minter.getMintersList();
	}

	@Get('mapping')
	@ApiResponse({
		description: 'Returns a mapping of all minter proposals',
	})
	getMapping(): ApiMinterMapping {
		return this.minter.getMintersMapping();
	}
}
