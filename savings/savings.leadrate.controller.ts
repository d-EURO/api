import { Controller, Get } from '@nestjs/common';
import { ApiResponse, ApiTags } from '@nestjs/swagger';
import { SavingsLeadrateService } from './savings.leadrate.service';
import { ApiLeadrateInfo, ApiLeadrateProposed, ApiLeadrateRate } from './savings.leadrate.types';

@ApiTags('Savings Controller')
@Controller('savings/leadrate')
export class SavingsLeadrateController {
	constructor(private readonly leadrate: SavingsLeadrateService) {}

	@Get('info')
	@ApiResponse({
		description: '',
	})
	getInfo(): ApiLeadrateInfo {
		return this.leadrate.getInfo();
	}

	@Get('rates')
	@ApiResponse({
		description: '',
	})
	getRates(): ApiLeadrateRate {
		return this.leadrate.getRates();
	}

	@Get('proposals')
	@ApiResponse({
		description: '',
	})
	getProposed(): ApiLeadrateProposed {
		return this.leadrate.getProposals();
	}
}
