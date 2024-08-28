import { Controller, Get } from '@nestjs/common';
import { ApiResponse, ApiTags } from '@nestjs/swagger';
import { EcosystemFrankencoinService } from './ecosystem.frankencoin.service';
import { ApiEcosystemFrankencoinInfo, ApiEcosystemFrankencoinKeyValues, ApiEcosystemMintBurnMapping } from './ecosystem.frankencoin.types';

@ApiTags('Ecosystem Controller')
@Controller('ecosystem/frankencoin')
export class EcosystemFrankencoinController {
	constructor(private readonly frankencoin: EcosystemFrankencoinService) {}

	@Get('info')
	@ApiResponse({
		description: 'Returns Frankencoin Info',
	})
	getFrankencoinInfo(): ApiEcosystemFrankencoinInfo {
		return this.frankencoin.getEcosystemFrankencoinInfo();
	}

	@Get('keyvalues')
	@ApiResponse({
		description: 'Returns Frankencoin key value mapping object.',
	})
	getFrankencoinKeyValues(): ApiEcosystemFrankencoinKeyValues {
		return this.frankencoin.getEcosystemFrankencoinKeyValues();
	}

	@Get('mintburnmapping')
	@ApiResponse({
		description: 'Returns a map of addresses mapped for frankencoin mints and burns.',
	})
	getFrankencoinMintBurnMapping(): ApiEcosystemMintBurnMapping {
		return this.frankencoin.getEcosystemMintBurnMapping();
	}
}
