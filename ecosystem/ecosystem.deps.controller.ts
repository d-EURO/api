import { Controller, Get } from '@nestjs/common';
import { ApiResponse, ApiTags } from '@nestjs/swagger';
import { EcosystemDepsService } from './ecosystem.deps.service';
import { ApiEcosystemDepsInfo } from './ecosystem.deps.types';

@ApiTags('Ecosystem Controller')
@Controller('ecosystem/deps')
export class EcosystemDepsController {
	constructor(private readonly deps: EcosystemDepsService) {}

	@Get('info')
	@ApiResponse({
		description: 'Returns info about the DEPS token',
	})
	getCollateralList(): ApiEcosystemDepsInfo {
		return this.deps.getEcosystemDepsInfo();
	}
}
