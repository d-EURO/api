import { Controller, Get } from '@nestjs/common';
import { ApiResponse, ApiTags } from '@nestjs/swagger';
import { EcosystemStablecoinService } from './ecosystem.stablecoin.service';
import { ApiEcosystemStablecoinInfo, ApiEcosystemStablecoinKeyValues, ApiEcosystemMintBurnMapping } from './ecosystem.stablecoin.types';

@ApiTags('Ecosystem Controller')
@Controller('ecosystem/stablecoin')
export class EcosystemStablecoinController {
	constructor(private readonly stablecoin: EcosystemStablecoinService) {}

	@Get('info')
	@ApiResponse({
		description: 'Returns Stablecoin Info',
	})
	getStablecoinInfo(): ApiEcosystemStablecoinInfo {
		return this.stablecoin.getEcosystemStablecoinInfo();
	}

	@Get('keyvalues')
	@ApiResponse({
		description: 'Returns Stablecoin key value mapping object.',
	})
	getStablecoinKeyValues(): ApiEcosystemStablecoinKeyValues {
		return this.stablecoin.getEcosystemStablecoinKeyValues();
	}

	@Get('mintburnmapping')
	@ApiResponse({
		description: 'Returns a map of addresses mapped for stablecoin mints and burns.',
	})
	getStablecoinMintBurnMapping(): ApiEcosystemMintBurnMapping {
		return this.stablecoin.getEcosystemMintBurnMapping();
	}
}
