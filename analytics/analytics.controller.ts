import { Controller, Get } from '@nestjs/common';
import { ApiResponse, ApiTags } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';

@ApiTags('Analytics Controller')
@Controller('analytics')
export class AnalyticsController {
	constructor(private readonly analytics: AnalyticsService) {}

	@Get('fps/exposure')
	@ApiResponse({
		description: 'Returns info about the exposures within the FPS token',
	})
	getExposure() {
		return this.analytics.getCollateralExposure();
	}
}
