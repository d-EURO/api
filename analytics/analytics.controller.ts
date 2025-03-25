import { Controller, Get } from '@nestjs/common';
import { ApiResponse, ApiTags } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';

@ApiTags('Analytics Controller')
@Controller('analytics')
export class AnalyticsController {
	constructor(private readonly analytics: AnalyticsService) {}

	@Get('deps/exposure')
	@ApiResponse({
		description: 'Returns info about the exposures within the DEPS token',
	})
	getExposure() {
		return this.analytics.getCollateralExposure();
	}

	@Get('deps/earnings')
	@ApiResponse({
		description: 'Returns earnings from the DEPS token',
	})
	getEarnings() {
		return this.analytics.getDepsEarnings();
	}
}
